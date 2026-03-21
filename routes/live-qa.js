// ============================================================
// Shabibeh - Live Q&A Routes
// ============================================================

const express = require('express');

module.exports = function (supabase, ADMIN_PASSWORD) {
  const router = express.Router();

  // ---------- Public Routes ----------

  // GET /api/live-qa/session - Get active session status
  router.get('/session', async (req, res) => {
    const { data, error } = await supabase
      .from('live_qa_sessions')
      .select('id, public_voting, created_at')
      .eq('active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      return res.json({ active: false });
    }

    res.json({ active: true, session: data });
  });

  // POST /api/live-qa/questions - Submit a question
  router.post('/questions', async (req, res) => {
    const { question_text } = req.body;

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

    // Check for active session
    const { data: session } = await supabase
      .from('live_qa_sessions')
      .select('id')
      .eq('active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!session) {
      return res.status(400).json({ error: 'No active Q&A session.' });
    }

    const ip_address = req.ip || req.connection.remoteAddress || 'unknown';

    const { data, error } = await supabase
      .from('live_qa_questions')
      .insert({ session_id: session.id, question_text: trimmed, ip_address })
      .select('id, question_text, upvotes, created_at')
      .single();

    if (error) {
      console.error('Live Q&A insert error:', error);
      return res.status(500).json({ error: 'Failed to submit question.' });
    }

    res.status(201).json({ success: true, question: data });
  });

  // GET /api/live-qa/questions - Get questions (only if public voting is on)
  router.get('/questions', async (req, res) => {
    const { data: session } = await supabase
      .from('live_qa_sessions')
      .select('id, public_voting')
      .eq('active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!session) {
      return res.json({ questions: [], public_voting: false });
    }

    if (!session.public_voting) {
      return res.json({ questions: [], public_voting: false });
    }

    const { data, error } = await supabase
      .from('live_qa_questions')
      .select('id, question_text, upvotes, created_at')
      .eq('session_id', session.id)
      .order('upvotes', { ascending: false })
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Live Q&A fetch error:', error);
      return res.status(500).json({ error: 'Failed to fetch questions.' });
    }

    res.json({ questions: data || [], public_voting: true });
  });

  // POST /api/live-qa/questions/:id/upvote - Upvote a question
  router.post('/questions/:id/upvote', async (req, res) => {
    const { id } = req.params;

    const { data: question, error: fetchError } = await supabase
      .from('live_qa_questions')
      .select('upvotes')
      .eq('id', id)
      .single();

    if (fetchError || !question) {
      return res.status(404).json({ error: 'Question not found.' });
    }

    const { error } = await supabase
      .from('live_qa_questions')
      .update({ upvotes: question.upvotes + 1 })
      .eq('id', id);

    if (error) {
      return res.status(500).json({ error: 'Failed to upvote.' });
    }

    res.json({ success: true, upvotes: question.upvotes + 1 });
  });

  // DELETE /api/live-qa/questions/:id/upvote - Remove upvote
  router.delete('/questions/:id/upvote', async (req, res) => {
    const { id } = req.params;

    const { data: question, error: fetchError } = await supabase
      .from('live_qa_questions')
      .select('upvotes')
      .eq('id', id)
      .single();

    if (fetchError || !question) {
      return res.status(404).json({ error: 'Question not found.' });
    }

    const newUpvotes = Math.max(0, question.upvotes - 1);

    const { error } = await supabase
      .from('live_qa_questions')
      .update({ upvotes: newUpvotes })
      .eq('id', id);

    if (error) {
      return res.status(500).json({ error: 'Failed to remove upvote.' });
    }

    res.json({ success: true, upvotes: newUpvotes });
  });

  // ---------- Admin Routes ----------

  // POST /api/live-qa/admin/session - Open a new session
  router.post('/admin/session', async (req, res) => {
    const password = req.headers['x-admin-password'];
    if (password !== ADMIN_PASSWORD) {
      return res.status(401).json({ error: 'Unauthorized.' });
    }

    const { public_voting } = req.body;

    // Close any existing active sessions
    await supabase
      .from('live_qa_sessions')
      .update({ active: false })
      .eq('active', true);

    const { data, error } = await supabase
      .from('live_qa_sessions')
      .insert({ active: true, public_voting: !!public_voting })
      .select('id, public_voting, created_at')
      .single();

    if (error) {
      console.error('Session create error:', error);
      return res.status(500).json({ error: 'Failed to create session.' });
    }

    res.status(201).json({ success: true, session: data });
  });

  // PUT /api/live-qa/admin/session - Toggle public voting
  router.put('/admin/session', async (req, res) => {
    const password = req.headers['x-admin-password'];
    if (password !== ADMIN_PASSWORD) {
      return res.status(401).json({ error: 'Unauthorized.' });
    }

    const { public_voting } = req.body;

    const { data: session } = await supabase
      .from('live_qa_sessions')
      .select('id')
      .eq('active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!session) {
      return res.status(400).json({ error: 'No active session.' });
    }

    const { error } = await supabase
      .from('live_qa_sessions')
      .update({ public_voting: !!public_voting })
      .eq('id', session.id);

    if (error) {
      return res.status(500).json({ error: 'Failed to update session.' });
    }

    res.json({ success: true, public_voting: !!public_voting });
  });

  // DELETE /api/live-qa/admin/session - Close the active session
  router.delete('/admin/session', async (req, res) => {
    const password = req.headers['x-admin-password'];
    if (password !== ADMIN_PASSWORD) {
      return res.status(401).json({ error: 'Unauthorized.' });
    }

    const { error } = await supabase
      .from('live_qa_sessions')
      .update({ active: false })
      .eq('active', true);

    if (error) {
      return res.status(500).json({ error: 'Failed to close session.' });
    }

    res.json({ success: true, message: 'Session closed.' });
  });

  // GET /api/live-qa/admin/questions - Get all questions (admin always sees them)
  router.get('/admin/questions', async (req, res) => {
    const password = req.headers['x-admin-password'];
    if (password !== ADMIN_PASSWORD) {
      return res.status(401).json({ error: 'Unauthorized.' });
    }

    const { data: session } = await supabase
      .from('live_qa_sessions')
      .select('id, public_voting')
      .eq('active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!session) {
      return res.json({ questions: [], session: null });
    }

    const { data, error } = await supabase
      .from('live_qa_questions')
      .select('id, question_text, upvotes, created_at, ip_address')
      .eq('session_id', session.id)
      .order('upvotes', { ascending: false })
      .order('created_at', { ascending: true });

    if (error) {
      return res.status(500).json({ error: 'Failed to fetch questions.' });
    }

    res.json({ questions: data || [], session });
  });

  // GET /api/live-qa/admin/past-sessions - Get past (inactive) sessions with questions
  router.get('/admin/past-sessions', async (req, res) => {
    const password = req.headers['x-admin-password'];
    if (password !== ADMIN_PASSWORD) {
      return res.status(401).json({ error: 'Unauthorized.' });
    }

    const { data: sessions, error: sessionsError } = await supabase
      .from('live_qa_sessions')
      .select('id, created_at')
      .eq('active', false)
      .order('created_at', { ascending: false })
      .limit(20);

    if (sessionsError) {
      return res.status(500).json({ error: 'Failed to fetch past sessions.' });
    }

    if (!sessions || sessions.length === 0) {
      return res.json({ sessions: [] });
    }

    const sessionIds = sessions.map(s => s.id);
    const { data: questions, error: questionsError } = await supabase
      .from('live_qa_questions')
      .select('id, session_id, question_text, upvotes, created_at')
      .in('session_id', sessionIds)
      .order('upvotes', { ascending: false });

    if (questionsError) {
      return res.status(500).json({ error: 'Failed to fetch questions.' });
    }

    const result = sessions.map(s => ({
      ...s,
      questions: (questions || []).filter(q => q.session_id === s.id),
    }));

    res.json({ sessions: result });
  });

  // DELETE /api/live-qa/admin/questions/:id - Delete a question
  router.delete('/admin/questions/:id', async (req, res) => {
    const password = req.headers['x-admin-password'];
    if (password !== ADMIN_PASSWORD) {
      return res.status(401).json({ error: 'Unauthorized.' });
    }

    const { id } = req.params;

    const { error } = await supabase
      .from('live_qa_questions')
      .delete()
      .eq('id', id);

    if (error) {
      return res.status(500).json({ error: 'Failed to delete question.' });
    }

    res.json({ success: true });
  });

  return router;
};
