// ============================================================
// Shabibeh - Sermon Slides Routes
// Fetches PDF slides from a public Google Drive folder
// ============================================================

const express = require('express');

// Parse "Month Day, Year" (e.g. "December 20, 2025") into "YYYY-MM-DD" for sorting
function parseEnglishDate(str) {
  if (!str) return '';
  const d = new Date(str);
  if (isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

module.exports = function () {
  const router = express.Router();

  const API_KEY = process.env.GOOGLE_DRIVE_API_KEY;
  const FOLDER_ID = process.env.GOOGLE_DRIVE_SLIDES_FOLDER_ID;

  // GET /api/slides - List all PDF files in the Drive folder
  router.get('/', async (req, res) => {
    if (!API_KEY || !FOLDER_ID) {
      return res.status(500).json({ error: 'Google Drive not configured.' });
    }

    try {
      const query = `'${FOLDER_ID}' in parents and mimeType='application/pdf' and trashed=false`;
      const fields = 'files(id,name,size,createdTime)';
      const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=${encodeURIComponent(fields)}&orderBy=createdTime desc&pageSize=100&key=${API_KEY}`;

      const response = await fetch(url);
      const data = await response.json();

      if (data.error) {
        console.error('Google Drive API error:', data.error);
        return res.status(500).json({ error: 'Failed to fetch slides.' });
      }

      const slides = (data.files || []).map(f => {
        const raw = f.name.replace(/\.pdf$/i, '');
        const parts = raw.split(/\s*_\s*/);
        let sermon = raw, pastor = '', date = '';
        if (parts.length >= 3) {
          sermon = parts.slice(0, -2).join(' ');
          pastor = parts[parts.length - 2].trim();
          date = parts[parts.length - 1].trim();
        } else if (parts.length === 2) {
          sermon = parts[0].trim();
          pastor = parts[1].trim();
        }
        return {
          id: f.id,
          name: raw,
          sermon: sermon.trim(),
          pastor,
          date,
          sort_date: parseEnglishDate(date),
          size: f.size ? Math.round(Number(f.size) / (1024 * 1024) * 10) / 10 : null,
          created_at: f.createdTime,
          view_url: `https://drive.google.com/file/d/${f.id}/view`,
          download_url: `https://docs.google.com/uc?export=download&id=${f.id}`,
        };
      });

      slides.sort((a, b) => (b.sort_date || '').localeCompare(a.sort_date || ''));

      res.json({ slides });
    } catch (err) {
      console.error('Slides fetch error:', err);
      res.status(500).json({ error: 'Failed to fetch slides.' });
    }
  });

  return router;
};
