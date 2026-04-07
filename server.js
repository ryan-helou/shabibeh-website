// ============================================================
// Shabibeh - AEBC Youth Website
// Main Express server
// ============================================================

require('dotenv').config();
const express = require('express');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;

// ----- Config -----
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'aebc2024';

// ----- Supabase Setup -----
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_KEY environment variables.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ----- Middleware -----
app.set('trust proxy', true);
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ----- API Routes -----
// Each feature gets its own route module under /api/<feature>
const questionsRoutes = require('./routes/questions')(supabase, ADMIN_PASSWORD);
app.use('/api/questions', questionsRoutes);

const recordingsRoutes = require('./routes/recordings')();
app.use('/api/recordings', recordingsRoutes);

const slidesRoutes = require('./routes/slides')();
app.use('/api/slides', slidesRoutes);

const liveQaRoutes = require('./routes/live-qa')(supabase, ADMIN_PASSWORD);
app.use('/api/live-qa', liveQaRoutes);

const ideasRoutes = require('./routes/ideas')(supabase, ADMIN_PASSWORD);
app.use('/api/ideas', ideasRoutes);

const settingsRoutes = require('./routes/settings')(supabase, ADMIN_PASSWORD);
app.use('/api/settings', settingsRoutes);

const analyticsRoutes = require('./routes/analytics')(supabase, ADMIN_PASSWORD);
app.use('/api/analytics', analyticsRoutes);

// ----- Page Routes -----
app.get('/questions', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'questions', 'index.html'));
});

app.get('/questions/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'questions', 'admin.html'));
});

app.get('/recordings', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'recordings', 'index.html'));
});

app.get('/live-qa', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'live-qa', 'index.html'));
});

app.get('/live-qa/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'live-qa', 'admin.html'));
});

app.get('/slides', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'slides', 'index.html'));
});

app.get('/settings', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'settings', 'index.html'));
});

app.get('/ideas', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'ideas', 'index.html'));
});

app.get('/analytics', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'analytics', 'index.html'));
});

// Home page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ----- Start Server -----
app.listen(PORT, () => {
  console.log(`Shabibeh server running at http://localhost:${PORT}`);
});

module.exports = app;
