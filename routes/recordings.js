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
        stream_url: `https://www.googleapis.com/drive/v3/files/${f.id}?alt=media&key=${API_KEY}`,
        download_url: `https://docs.google.com/uc?export=download&id=${f.id}`,
      }));

      res.json({ recordings });
    } catch (err) {
      console.error('Recordings fetch error:', err);
      res.status(500).json({ error: 'Failed to fetch recordings.' });
    }
  });

  return router;
};
