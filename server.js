// ============================================================
// AnonAEBC - Anonymous Question Submission Server
// Main Express server using Supabase for persistent storage
// ============================================================

require('dotenv').config();
const express = require('express');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
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

  // Insert into Supabase (no IP or user data stored)
  const { error } = await supabase
    .from('questions')
    .insert({ question_text: trimmed });

  if (error) {
    console.error('Supabase insert error:', error);
    return res.status(500).json({ error: 'Failed to submit question.' });
  }

  res.status(201).json({ success: true, message: 'Question submitted successfully.' });
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
