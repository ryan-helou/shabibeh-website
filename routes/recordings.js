// ============================================================
// Shabibeh - Recordings Routes
// Fetches MP3 files from a public Google Drive folder
// ============================================================

const express = require('express');

module.exports = function () {
  const router = express.Router();

  const API_KEY = process.env.GOOGLE_DRIVE_API_KEY;
  const FOLDER_ID = process.env.GOOGLE_DRIVE_RECORDINGS_FOLDER_ID;

  // GET /api/recordings - List all MP3 files in the Drive folder
  router.get('/', async (req, res) => {
    if (!API_KEY || !FOLDER_ID) {
      return res.status(500).json({ error: 'Google Drive not configured.' });
    }

    try {
      const query = `'${FOLDER_ID}' in parents and mimeType='audio/mpeg' and trashed=false`;
      const fields = 'files(id,name,size,createdTime)';
      const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=${encodeURIComponent(fields)}&orderBy=createdTime desc&pageSize=100&key=${API_KEY}`;

      const response = await fetch(url);
      const data = await response.json();

      if (data.error) {
        console.error('Google Drive API error:', data.error);
        return res.status(500).json({ error: 'Failed to fetch recordings.' });
      }

      const recordings = (data.files || []).map(f => {
        const raw = f.name.replace(/\.mp3$/i, '');
        const parts = raw.split('_');
        let sermon = raw, pastor = '', date = '';
        if (parts.length >= 3) {
          sermon = parts.slice(0, -2).join(' ');
          pastor = parts[parts.length - 2];
          date = parts[parts.length - 1];
        } else if (parts.length === 2) {
          sermon = parts[0];
          pastor = parts[1];
        }
        return {
          id: f.id,
          name: raw,
          sermon,
          pastor,
          date,
          size: f.size ? Math.round(Number(f.size) / (1024 * 1024) * 10) / 10 : null,
          created_at: f.createdTime,
          stream_url: `/api/recordings/stream/${f.id}`,
          download_url: `https://docs.google.com/uc?export=download&id=${f.id}`,
        };
      });

      recordings.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

      res.json({ recordings });
    } catch (err) {
      console.error('Recordings fetch error:', err);
      res.status(500).json({ error: 'Failed to fetch recordings.' });
    }
  });

  // GET /api/recordings/stream/:id - Proxy audio with Range request support
  router.get('/stream/:id', async (req, res) => {
    const { id } = req.params;
    const driveUrl = `https://www.googleapis.com/drive/v3/files/${id}?alt=media&key=${API_KEY}`;

    try {
      // Forward the Range header from the browser to Google Drive
      const headers = {};
      if (req.headers.range) {
        headers['Range'] = req.headers.range;
      }

      const response = await fetch(driveUrl, { headers });

      // Set response headers
      res.set('Content-Type', 'audio/mpeg');
      res.set('Accept-Ranges', 'bytes');

      const contentLength = response.headers.get('content-length');
      const contentRange = response.headers.get('content-range');

      if (contentLength) res.set('Content-Length', contentLength);
      if (contentRange) res.set('Content-Range', contentRange);

      // 206 for partial content (range requests), 200 for full
      res.status(response.status === 206 ? 206 : 200);

      // Stream the response
      const reader = response.body.getReader();
      const pump = async () => {
        while (true) {
          const { done, value } = await reader.read();
          if (done) { res.end(); return; }
          if (!res.write(value)) {
            await new Promise(resolve => res.once('drain', resolve));
          }
        }
      };
      pump().catch(() => res.end());
    } catch (err) {
      console.error('Stream error:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to stream recording.' });
      }
    }
  });

  return router;
};
