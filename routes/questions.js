// ============================================================
// Shabibeh - Anonymous Questions Routes
// ============================================================

const express = require('express');
const crypto = require('crypto');

module.exports = function (supabase, ADMIN_PASSWORD) {
  const router = express.Router();

  // POST /api/questions - Submit a new anonymous question
  router.post('/', async (req, res) => {
    const { question_text, name } = req.body;

    if (!question_text || typeof question_text !== 'string') {
      return res.status(400).json({ error: 'Question text is required.' });
    }

    const trimmed = question_text.trim();
    if (trimmed.length === 0) {
      return res.status(400).json({ error: 'Question cannot be empty.' });
    }
    if (trimmed.length > 500) {
      return res.status(400).json({ error: 'Question must be 500 characters or less.' });
    }

    const trimmedName = (name && typeof name === 'string') ? name.trim().slice(0, 100) || null : null;

    const edit_token = crypto.randomUUID();
    const ip_address = req.ip || req.connection.remoteAddress || 'unknown';

    const { data, error } = await supabase
      .from('questions')
      .insert({ question_text: trimmed, edit_token, ip_address, name: trimmedName })
      .select('id, question_text, created_at, edit_token, name')
      .single();

    if (error) {
      console.error('Supabase insert error:', error);
      return res.status(500).json({ error: 'Failed to submit question.' });
    }

    res.status(201).json({ success: true, question: data });
  });

  // POST /api/questions/mine - Fetch the submitter's own questions by edit tokens
  router.post('/mine', async (req, res) => {
    const { tokens } = req.body;

    if (!Array.isArray(tokens) || tokens.length === 0) {
      return res.json({ questions: [] });
    }

    const ids = tokens.map(t => t.id);
    const { data, error } = await supabase
      .from('questions')
      .select('id, question_text, created_at, edit_token')
      .in('id', ids)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Supabase select error:', error);
      return res.status(500).json({ error: 'Failed to fetch questions.' });
    }

    const tokenMap = new Map(tokens.map(t => [t.id, t.edit_token]));
    const verified = data
      .filter(q => tokenMap.get(q.id) === q.edit_token)
      .map(({ edit_token, ...rest }) => rest);

    res.json({ questions: verified });
  });

  // PUT /api/questions/:id - Edit a question (requires edit_token)
  router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const { edit_token, question_text } = req.body;

    if (!edit_token) {
      return res.status(401).json({ error: 'Edit token is required.' });
    }

    if (!question_text || typeof question_text !== 'string') {
      return res.status(400).json({ error: 'Question text is required.' });
    }

    const trimmed = question_text.trim();
    if (trimmed.length === 0) {
      return res.status(400).json({ error: 'Question cannot be empty.' });
    }
    if (trimmed.length > 500) {
      return res.status(400).json({ error: 'Question must be 500 characters or less.' });
    }

    const { data: existing, error: fetchError } = await supabase
      .from('questions')
      .select('edit_token')
      .eq('id', id)
      .single();

    if (fetchError || !existing) {
      return res.status(404).json({ error: 'Question not found.' });
    }

    if (existing.edit_token !== edit_token) {
      return res.status(401).json({ error: 'Invalid edit token.' });
    }

    const { error } = await supabase
      .from('questions')
      .update({ question_text: trimmed })
      .eq('id', id);

    if (error) {
      console.error('Supabase update error:', error);
      return res.status(500).json({ error: 'Failed to update question.' });
    }

    res.json({ success: true, question: { id, question_text: trimmed } });
  });

  // DELETE /api/questions/:id - Delete own question (requires edit_token)
  router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    const edit_token = req.headers['x-edit-token'];

    if (!edit_token) {
      return res.status(401).json({ error: 'Edit token is required.' });
    }

    const { data: existing, error: fetchError } = await supabase
      .from('questions')
      .select('edit_token')
      .eq('id', id)
      .single();

    if (fetchError || !existing) {
      return res.status(404).json({ error: 'Question not found.' });
    }

    if (existing.edit_token !== edit_token) {
      return res.status(401).json({ error: 'Invalid edit token.' });
    }

    const { error } = await supabase
      .from('questions')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Supabase delete error:', error);
      return res.status(500).json({ error: 'Failed to delete question.' });
    }

    res.json({ success: true, message: 'Question deleted.' });
  });

  // ----- Admin Routes -----

  // POST /api/questions/admin/login
  router.post('/admin/login', (req, res) => {
    const { password } = req.body;

    if (password === ADMIN_PASSWORD) {
      res.json({ success: true });
    } else {
      res.status(401).json({ error: 'Incorrect password.' });
    }
  });

  // GET /api/questions/admin/list
  router.get('/admin/list', async (req, res) => {
    const password = req.headers['x-admin-password'];

    if (password !== ADMIN_PASSWORD) {
      return res.status(401).json({ error: 'Unauthorized.' });
    }

    const answered = req.query.answered === '1';

    const { data, error } = await supabase
      .from('questions')
      .select('*')
      .eq('answered', answered)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Supabase select error:', error);
      return res.status(500).json({ error: 'Failed to fetch questions.' });
    }

    res.json({ questions: data });
  });

  // PUT /api/questions/admin/answer
  router.put('/admin/answer', async (req, res) => {
    const password = req.headers['x-admin-password'];

    if (password !== ADMIN_PASSWORD) {
      return res.status(401).json({ error: 'Unauthorized.' });
    }

    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'No question IDs provided.' });
    }

    const { error } = await supabase
      .from('questions')
      .update({ answered: true })
      .in('id', ids);

    if (error) {
      console.error('Supabase update error:', error);
      return res.status(500).json({ error: 'Failed to update questions.' });
    }

    res.json({ success: true, message: `${ids.length} question(s) marked as answered.` });
  });

  // PUT /api/questions/admin/unanswer
  router.put('/admin/unanswer', async (req, res) => {
    const password = req.headers['x-admin-password'];

    if (password !== ADMIN_PASSWORD) {
      return res.status(401).json({ error: 'Unauthorized.' });
    }

    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'No question IDs provided.' });
    }

    const { error } = await supabase
      .from('questions')
      .update({ answered: false })
      .in('id', ids);

    if (error) {
      console.error('Supabase update error:', error);
      return res.status(500).json({ error: 'Failed to update questions.' });
    }

    res.json({ success: true, message: `${ids.length} question(s) marked as unanswered.` });
  });

  // DELETE /api/questions/admin/:id
  router.delete('/admin/:id', async (req, res) => {
    const password = req.headers['x-admin-password'];

    if (password !== ADMIN_PASSWORD) {
      return res.status(401).json({ error: 'Unauthorized.' });
    }

    const { id } = req.params;

    const { error } = await supabase
      .from('questions')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Supabase delete error:', error);
      return res.status(500).json({ error: 'Failed to delete question.' });
    }

    res.json({ success: true, message: 'Question deleted.' });
  });

  return router;
};
