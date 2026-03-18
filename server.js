// ============================================================
// AnonAEBC - Anonymous Question Submission Server
// Main Express server using Supabase for persistent storage
// ============================================================

require('dotenv').config();
const express = require('express');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;

// ----- Admin Password (change this before deploying!) -----
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'aebc2024';

// ----- Supabase Setup -----
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY; // Use the service_role key for server-side

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_KEY environment variables.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ----- Middleware -----
app.set('trust proxy', true); // trust proxy to get real IP (e.g. behind Render/Vercel)
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ----- Rate Limiting -----
// Users can submit max 1 question every 10 seconds
const submitLimiter = rateLimit({
  windowMs: 10 * 1000, // 10 seconds
  max: 1,
  message: { error: 'Please wait 10 seconds before submitting another question.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ----- API Routes -----

// POST /api/questions - Submit a new anonymous question
app.post('/api/questions', submitLimiter, async (req, res) => {
  const { question_text } = req.body;

  // Validate: question must exist
  if (!question_text || typeof question_text !== 'string') {
    return res.status(400).json({ error: 'Question text is required.' });
  }

  // Validate: trim and check length
  const trimmed = question_text.trim();
  if (trimmed.length === 0) {
    return res.status(400).json({ error: 'Question cannot be empty.' });
  }
  if (trimmed.length > 500) {
    return res.status(400).json({ error: 'Question must be 500 characters or less.' });
  }

  // Generate a random edit token so the submitter can edit their question later
  const edit_token = crypto.randomUUID();
  const ip_address = req.ip || req.connection.remoteAddress || 'unknown';

  const { data, error } = await supabase
    .from('questions')
    .insert({ question_text: trimmed, edit_token, ip_address })
    .select('id, question_text, created_at, edit_token')
    .single();

  if (error) {
    console.error('Supabase insert error:', error);
    return res.status(500).json({ error: 'Failed to submit question.' });
  }

  res.status(201).json({ success: true, question: data });
});

// POST /api/questions/mine - Fetch the submitter's own questions by edit tokens
app.post('/api/questions/mine', async (req, res) => {
  const { tokens } = req.body; // array of { id, edit_token }

  if (!Array.isArray(tokens) || tokens.length === 0) {
    return res.json({ questions: [] });
  }

  // Fetch each question and verify its edit_token
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

  // Only return questions where the provided token matches
  const tokenMap = new Map(tokens.map(t => [t.id, t.edit_token]));
  const verified = data
    .filter(q => tokenMap.get(q.id) === q.edit_token)
    .map(({ edit_token, ...rest }) => rest);

  res.json({ questions: verified });
});

// PUT /api/questions/:id - Edit a question (requires edit_token)
app.put('/api/questions/:id', async (req, res) => {
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

  // Verify the edit token matches
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
app.delete('/api/questions/:id', async (req, res) => {
  const { id } = req.params;
  const edit_token = req.headers['x-edit-token'];

  if (!edit_token) {
    return res.status(401).json({ error: 'Edit token is required.' });
  }

  // Verify the edit token matches
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

// POST /api/admin/login - Verify admin password
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;

  if (password === ADMIN_PASSWORD) {
    res.json({ success: true });
  } else {
    res.status(401).json({ error: 'Incorrect password.' });
  }
});

// GET /api/admin/questions - Fetch questions (admin only)
// Query param ?answered=1 to get answered questions, default is unanswered
app.get('/api/admin/questions', async (req, res) => {
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

// PUT /api/admin/questions/answer - Mark questions as answered (admin only)
app.put('/api/admin/questions/answer', async (req, res) => {
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

// PUT /api/admin/questions/unanswer - Mark questions as unanswered (admin only)
app.put('/api/admin/questions/unanswer', async (req, res) => {
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

// DELETE /api/admin/questions/:id - Delete a question (admin only)
app.delete('/api/admin/questions/:id', async (req, res) => {
  const password = req.headers['x-admin-password'];

  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized.' });
  }

  const { id } = req.params;

  const { error, count } = await supabase
    .from('questions')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Supabase delete error:', error);
    return res.status(500).json({ error: 'Failed to delete question.' });
  }

  res.json({ success: true, message: 'Question deleted.' });
});

// ----- Serve Frontend -----
// Serve admin page
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Catch-all: serve the homepage
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ----- Start Server -----
app.listen(PORT, () => {
  console.log(`AnonAEBC server running at http://localhost:${PORT}`);
});

module.exports = app;
