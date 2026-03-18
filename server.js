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

// ----- Page Routes -----
app.get('/questions', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'questions', 'index.html'));
});

app.get('/questions/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'questions', 'admin.html'));
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
