// ============================================================
// Shabibeh - Analytics Routes
// ============================================================

const express = require('express');

const MAX_STRING = 300;
const MAX_PATH = 500;
const MAX_METADATA_BYTES = 4000;
const FETCH_PAGE_SIZE = 1000;
const FETCH_MAX_ROWS = 20000;

function sanitizeString(value, maxLen = MAX_STRING) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLen);
}

function sanitizeMetadata(metadata) {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return null;
  }

  try {
    const asJson = JSON.stringify(metadata);
    if (asJson.length > MAX_METADATA_BYTES) {
      return { truncated: true };
    }
    return metadata;
  } catch {
    return null;
  }
}

function clampInteger(value, min, max, fallback) {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

async function fetchEventsInWindow(supabase, startIso) {
  let offset = 0;
  const rows = [];

  while (offset < FETCH_MAX_ROWS) {
    const to = offset + FETCH_PAGE_SIZE - 1;

    const { data, error } = await supabase
      .from('analytics_events')
      .select('occurred_at, event_name, event_type, page_path, element, visitor_id')
      .gte('occurred_at', startIso)
      .order('occurred_at', { ascending: true })
      .range(offset, to);

    if (error) {
      throw error;
    }

    const batch = data || [];
    rows.push(...batch);

    if (batch.length < FETCH_PAGE_SIZE) {
      break;
    }

    offset += FETCH_PAGE_SIZE;
  }

  return rows;
}

module.exports = function (supabase, ADMIN_PASSWORD) {
  const router = express.Router();

  // POST /api/analytics/event - Ingest a single analytics event
  router.post('/event', async (req, res) => {
    const body = req.body || {};

    const event_name = sanitizeString(body.event_name, 80);
    if (!event_name) {
      return res.status(400).json({ error: 'event_name is required.' });
    }

    const occurred_at = body.occurred_at ? new Date(body.occurred_at) : new Date();
    if (Number.isNaN(occurred_at.getTime())) {
      return res.status(400).json({ error: 'occurred_at must be a valid date.' });
    }

    const payload = {
      event_name,
      event_type: sanitizeString(body.event_type, 80),
      page_path: sanitizeString(body.page_path, MAX_PATH),
      element: sanitizeString(body.element, MAX_STRING),
      visitor_id: sanitizeString(body.visitor_id, 120),
      session_id: sanitizeString(body.session_id, 120),
      metadata: sanitizeMetadata(body.metadata),
      occurred_at: occurred_at.toISOString(),
      ip_address: sanitizeString(req.ip || req.connection.remoteAddress || 'unknown', 120),
      user_agent: sanitizeString(req.get('user-agent'), 500),
      referrer: sanitizeString(req.get('referer') || req.get('referrer'), MAX_PATH),
    };

    const { error } = await supabase
      .from('analytics_events')
      .insert(payload);

    if (error) {
      console.error('Analytics insert error:', error);
      return res.status(500).json({ error: 'Failed to store analytics event.' });
    }

    return res.status(202).json({ success: true });
  });

  function requireAdmin(req, res) {
    const password = req.headers['x-admin-password'];
    if (password !== ADMIN_PASSWORD) {
      res.status(401).json({ error: 'Unauthorized.' });
      return false;
    }
    return true;
  }

  // GET /api/analytics/admin/overview?days=30
  router.get('/admin/overview', async (req, res) => {
    if (!requireAdmin(req, res)) return;

    const days = clampInteger(req.query.days, 1, 90, 30);
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - (days - 1));
    const startIso = start.toISOString();

    let events;
    try {
      events = await fetchEventsInWindow(supabase, startIso);
    } catch (error) {
      console.error('Analytics overview fetch error:', error);
      return res.status(500).json({ error: 'Failed to fetch analytics data.' });
    }

    const uniqueVisitors = new Set();
    const byDay = new Map();
    const clickCounts = new Map();
    const pageViewCounts = new Map();
    const eventCounts = new Map();

    events.forEach((event) => {
      const dateKey = (event.occurred_at || '').slice(0, 10) || 'unknown';
      const visitorId = event.visitor_id || null;

      if (!byDay.has(dateKey)) {
        byDay.set(dateKey, { events: 0, visitors: new Set() });
      }

      const day = byDay.get(dateKey);
      day.events += 1;

      if (visitorId) {
        uniqueVisitors.add(visitorId);
        day.visitors.add(visitorId);
      }

      const eventName = event.event_name || 'unknown';
      eventCounts.set(eventName, (eventCounts.get(eventName) || 0) + 1);

      const isClick = eventName === 'click' || event.event_type === 'click';
      if (isClick) {
        const target = event.element || 'unknown';
        clickCounts.set(target, (clickCounts.get(target) || 0) + 1);
      }

      if (eventName === 'page_view') {
        const path = event.page_path || 'unknown';
        pageViewCounts.set(path, (pageViewCounts.get(path) || 0) + 1);
      }
    });

    const daily = Array.from(byDay.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, values]) => ({
        date,
        events: values.events,
        unique_visitors: values.visitors.size,
      }));

    const top_clicks = Array.from(clickCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([element, count]) => ({ element, count }));

    const top_pages = Array.from(pageViewCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([page_path, views]) => ({ page_path, views }));

    const event_breakdown = Array.from(eventCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([event_name, count]) => ({ event_name, count }));

    return res.json({
      period_days: days,
      total_events: events.length,
      unique_visitors: uniqueVisitors.size,
      daily,
      top_clicks,
      top_pages,
      event_breakdown,
      truncated: events.length >= FETCH_MAX_ROWS,
    });
  });

  // GET /api/analytics/admin/events?limit=100
  router.get('/admin/events', async (req, res) => {
    if (!requireAdmin(req, res)) return;

    const limit = clampInteger(req.query.limit, 1, 500, 100);

    const { data, error } = await supabase
      .from('analytics_events')
      .select('id, occurred_at, event_name, event_type, page_path, element, visitor_id, session_id, metadata')
      .order('occurred_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Analytics list error:', error);
      return res.status(500).json({ error: 'Failed to fetch analytics events.' });
    }

    return res.json({ events: data || [] });
  });

  return router;
};
