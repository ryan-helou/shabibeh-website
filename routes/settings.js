// ============================================================
// Shabibeh - Site Settings Routes
// ============================================================

const express = require('express');

module.exports = function (supabase, ADMIN_PASSWORD) {
  const router = express.Router();

  // GET /api/settings - Public, returns visibility settings
  router.get('/', async (req, res) => {
    const { data, error } = await supabase
      .from('site_settings')
      .select('key, value');

    if (error) {
      return res.status(500).json({ error: 'Failed to load settings.' });
    }

    const settings = {};
    (data || []).forEach(row => {
      settings[row.key] = row.value;
    });

    res.json({ settings });
  });

  // PATCH /api/settings - Admin only, update a setting
  router.patch('/', async (req, res) => {
    const password = req.headers['x-admin-password'];
    if (password !== ADMIN_PASSWORD) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { key, value } = req.body;
    if (!key) {
      return res.status(400).json({ error: 'Key is required.' });
    }

    const { error } = await supabase
      .from('site_settings')
      .upsert({ key, value }, { onConflict: 'key' });

    if (error) {
      return res.status(500).json({ error: 'Failed to update setting.' });
    }

    res.json({ success: true });
  });

  return router;
};
