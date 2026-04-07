// ============================================================
// Shabibeh - Lightweight First-Party Analytics
// ============================================================

(function () {
  if (window.__shabibehAnalyticsLoaded) return;
  window.__shabibehAnalyticsLoaded = true;

  const ENDPOINT = '/api/analytics/event';
  const VISITOR_KEY = 'shabibeh_visitor_id';
  const SESSION_KEY = 'shabibeh_session_id';

  function generateId(prefix) {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
      return `${prefix}_${window.crypto.randomUUID()}`;
    }
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }

  function getOrCreateStorageValue(storage, key, prefix) {
    try {
      const existing = storage.getItem(key);
      if (existing) return existing;
      const created = generateId(prefix);
      storage.setItem(key, created);
      return created;
    } catch {
      return generateId(prefix);
    }
  }

  function cleanText(value, maxLen) {
    if (!value || typeof value !== 'string') return null;
    const normalized = value.replace(/\s+/g, ' ').trim();
    if (!normalized) return null;
    return normalized.slice(0, maxLen);
  }

  function getElementDescriptor(element) {
    if (!element || !element.tagName) return null;

    const tag = element.tagName.toLowerCase();
    const id = element.id ? `#${element.id}` : '';
    const classPart = element.className && typeof element.className === 'string'
      ? element.className
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map(cls => `.${cls}`)
        .join('')
      : '';

    const labelSource = element.getAttribute('data-track')
      || element.getAttribute('aria-label')
      || element.innerText
      || element.textContent
      || '';
    const label = cleanText(labelSource, 80);

    return cleanText(`${tag}${id}${classPart}${label ? ` :: ${label}` : ''}`, 300);
  }

  const visitorId = getOrCreateStorageValue(window.localStorage, VISITOR_KEY, 'v');
  const sessionId = getOrCreateStorageValue(window.sessionStorage, SESSION_KEY, 's');

  function sendEvent(eventName, data) {
    const payload = {
      event_name: cleanText(eventName, 80),
      event_type: cleanText((data && data.event_type) || eventName, 80),
      page_path: cleanText(`${window.location.pathname}${window.location.search}`, 500),
      visitor_id: visitorId,
      session_id: sessionId,
      element: cleanText(data && data.element, 300),
      metadata: (data && data.metadata && typeof data.metadata === 'object') ? data.metadata : null,
      occurred_at: new Date().toISOString(),
    };

    if (!payload.event_name) return;

    const body = JSON.stringify(payload);

    if (navigator.sendBeacon) {
      const blob = new Blob([body], { type: 'application/json' });
      navigator.sendBeacon(ENDPOINT, blob);
      return;
    }

    fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {});
  }

  sendEvent('page_view', {
    metadata: {
      title: cleanText(document.title, 120),
      referrer: cleanText(document.referrer, 300),
    },
  });

  document.addEventListener('click', (event) => {
    const tracked = event.target && event.target.closest
      ? event.target.closest('a, button, [role="button"], input[type="submit"], input[type="button"], [data-track]')
      : null;

    if (!tracked) return;
    if (tracked.hasAttribute('data-no-track')) return;

    const href = tracked.tagName.toLowerCase() === 'a' ? tracked.getAttribute('href') : null;

    sendEvent('click', {
      element: getElementDescriptor(tracked),
      metadata: {
        href: cleanText(href, 300),
      },
    });
  }, true);

  document.addEventListener('submit', (event) => {
    const form = event.target;
    if (!form || !form.tagName || form.tagName.toLowerCase() !== 'form') return;

    sendEvent('form_submit', {
      element: getElementDescriptor(form),
      metadata: {
        form_id: cleanText(form.id || '', 120),
        action: cleanText(form.getAttribute('action') || '', 300),
      },
    });
  }, true);

  window.shabibehAnalytics = {
    track(eventName, options) {
      sendEvent(eventName, options || {});
    },
  };
})();
