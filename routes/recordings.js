// ============================================================
// Shabibeh - Recordings Routes
// Fetches MP3 files from a public Google Drive folder
// ============================================================

const express = require('express');

module.exports = function () {
  const router = express.Router();

  const API_KEY = process.env.GOOGLE_DRIVE_API_KEY;
  const FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID;

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

      const recordings = (data.files || []).map(f => ({
        id: f.id,
        name: f.name.replace(/\.mp3$/i, ''),
        size: f.size ? Math.round(Number(f.size) / (1024 * 1024) * 10) / 10 : null,
        created_at: f.createdTime,
        stream_url: `/api/recordings/stream/${f.id}`,
        download_url: `https://docs.google.com/uc?export=download&id=${f.id}`,
      }));

      res.json({ recordings });
    } catch (err) {
      console.error('Recordings fetch error:', err);
      res.status(500).json({ error: 'Failed to fetch recordings.' });
    }
  });

  // GET /api/recordings/stream/:id - Proxy audio stream from Google Drive
  router.get('/stream/:id', async (req, res) => {
    const { id } = req.params;

    try {
      // First try the direct download URL
      let url = `https://drive.google.com/uc?export=download&id=${id}`;
      let response = await fetch(url, { redirect: 'follow' });

      // If we get an HTML page (virus scan warning), extract the confirm URL
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('text/html')) {
        const html = await response.text();
        const match = html.match(/href="(\/uc\?export=download[^"]+)"/);
        if (match) {
          const confirmUrl = `https://drive.google.com${match[1].replace(/&amp;/g, '&')}`;
          response = await fetch(confirmUrl, { redirect: 'follow' });
        } else {
          return res.status(500).json({ error: 'Could not resolve download link.' });
        }
      }

      res.set('Content-Type', 'audio/mpeg');
      res.set('Accept-Ranges', 'bytes');
      const size = response.headers.get('content-length');
      if (size) res.set('Content-Length', size);

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
