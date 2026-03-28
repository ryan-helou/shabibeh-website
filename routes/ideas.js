// ============================================================
// Shabibeh - Ideas Routes
// ============================================================

const express = require('express');

module.exports = function (supabase, ADMIN_PASSWORD) {
  const router = express.Router();

  // Middleware: require admin password
  function requireAdmin(req, res, next) {
    const password = req.headers['x-admin-password'];
    if (password !== ADMIN_PASSWORD) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
  }

  // GET /api/ideas - List all ideas
  router.get('/', requireAdmin, async (req, res) => {
    const { data, error } = await supabase
      .from('ideas')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(500).json({ error: 'Failed to load ideas.' });
    }

    res.json({ ideas: data || [] });
  });

  // POST /api/ideas - Add an idea
  router.post('/', requireAdmin, async (req, res) => {
    const { text } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'Idea text is required.' });
    }

    const { data, error } = await supabase
      .from('ideas')
      .insert({ text: text.trim(), status: 'todo' })
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: 'Failed to save idea.' });
    }

    res.json({ idea: data });
  });

  // PATCH /api/ideas/:id - Update an idea (text and/or status)
  router.patch('/:id', requireAdmin, async (req, res) => {
    const updates = {};
    if (req.body.text !== undefined) updates.text = req.body.text.trim();
    if (req.body.status !== undefined) updates.status = req.body.status;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'Nothing to update.' });
    }

    const { data, error } = await supabase
      .from('ideas')
      .update(updates)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: 'Failed to update idea.' });
    }

    res.json({ idea: data });
  });

  // DELETE /api/ideas/:id - Delete an idea
  router.delete('/:id', requireAdmin, async (req, res) => {
    const { error } = await supabase
      .from('ideas')
      .delete()
      .eq('id', req.params.id);

    if (error) {
      return res.status(500).json({ error: 'Failed to delete idea.' });
    }

    res.json({ success: true });
  });

  return router;
};
