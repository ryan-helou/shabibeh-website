// ============================================================
// Shabibeh - Live Q&A Admin
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('login-form');
  const passwordInput = document.getElementById('password-input');
  const loginError = document.getElementById('login-error');
  const loginView = document.getElementById('login-view');
  const dashboardView = document.getElementById('dashboard-view');
  const noSessionAdmin = document.getElementById('no-session-admin');
  const sessionControls = document.getElementById('session-controls');
  const sessionMode = document.getElementById('session-mode');
  const toggleVisibilityBtn = document.getElementById('toggle-visibility-btn');
  const closeSessionBtn = document.getElementById('close-session-btn');
  const startPublicBtn = document.getElementById('start-public-btn');
  const startPrivateBtn = document.getElementById('start-private-btn');
  const adminQuestionsList = document.getElementById('admin-questions-list');
  const adminNoQuestions = document.getElementById('admin-no-questions');
  const adminQuestionCount = document.getElementById('admin-question-count');

  let adminPassword = '';
  let currentPublicVoting = false;
  let pollTimer = null;

  // ----- Login -----
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    loginError.classList.add('hidden');

    const password = passwordInput.value;

    try {
      const res = await fetch('/api/questions/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      if (res.ok) {
        adminPassword = password;
        loginView.classList.add('hidden');
        dashboardView.classList.remove('hidden');
        loadDashboard();
        startPolling();
      } else {
        loginError.textContent = 'Incorrect password.';
        loginError.classList.remove('hidden');
      }
    } catch {
      loginError.textContent = 'Could not connect to the server.';
      loginError.classList.remove('hidden');
    }
  });

  // ----- Start Session -----
  startPublicBtn.addEventListener('click', () => startSession(true));
  startPrivateBtn.addEventListener('click', () => startSession(false));

  async function startSession(publicVoting) {
    try {
      const res = await fetch('/api/live-qa/admin/session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Password': adminPassword,
        },
        body: JSON.stringify({ public_voting: publicVoting }),
      });

      if (res.ok) {
        loadDashboard();
      }
    } catch {}
  }

  // ----- Toggle Visibility -----
  toggleVisibilityBtn.addEventListener('click', async () => {
    try {
      const res = await fetch('/api/live-qa/admin/session', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Password': adminPassword,
        },
        body: JSON.stringify({ public_voting: !currentPublicVoting }),
      });

      if (res.ok) {
        loadDashboard();
      }
    } catch {}
  });

  // ----- Close Session -----
  const endModal = document.getElementById('end-session-modal');
  const endModalCancel = document.getElementById('end-modal-cancel');
  const endModalConfirm = document.getElementById('end-modal-confirm');

  closeSessionBtn.addEventListener('click', () => {
    endModal.classList.remove('hidden');
  });

  endModalCancel.addEventListener('click', () => {
    endModal.classList.add('hidden');
  });

  endModal.addEventListener('click', (e) => {
    if (e.target === endModal) endModal.classList.add('hidden');
  });

  endModalConfirm.addEventListener('click', async () => {
    endModal.classList.add('hidden');
    try {
      const res = await fetch('/api/live-qa/admin/session', {
        method: 'DELETE',
        headers: { 'X-Admin-Password': adminPassword },
      });

      if (res.ok) {
        loadDashboard();
      }
    } catch {}
  });

  // ----- Load Dashboard -----
  async function loadDashboard() {
    try {
      const res = await fetch('/api/live-qa/admin/questions', {
        headers: { 'X-Admin-Password': adminPassword },
      });

      const data = await res.json();

      if (!data.session) {
        noSessionAdmin.classList.remove('hidden');
        sessionControls.classList.add('hidden');
        return;
      }

      noSessionAdmin.classList.add('hidden');
      sessionControls.classList.remove('hidden');

      currentPublicVoting = data.session.public_voting;
      updateModeDisplay();

      const questions = data.questions || [];
      adminQuestionCount.textContent = `(${questions.length})`;

      if (questions.length === 0) {
        adminQuestionsList.innerHTML = '';
        adminNoQuestions.classList.remove('hidden');
      } else {
        adminNoQuestions.classList.add('hidden');
        renderAdminQuestions(questions);
      }
    } catch {}
  }

  function updateModeDisplay() {
    if (currentPublicVoting) {
      sessionMode.textContent = 'Public — Voting Open';
      sessionMode.className = 'session-mode-tag public';
      toggleVisibilityBtn.textContent = 'Hide from Public';
    } else {
      sessionMode.textContent = 'Private — Only You';
      sessionMode.className = 'session-mode-tag private';
      toggleVisibilityBtn.textContent = 'Show to Public';
    }
  }

  function renderAdminQuestions(questions) {
    adminQuestionsList.innerHTML = '';

    questions.forEach(q => {
      const card = document.createElement('div');
      card.className = 'live-qa-card admin';

      card.innerHTML = `
        <div class="live-qa-upvote-display">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>
          <span>${q.upvotes}</span>
        </div>
        <div class="live-qa-text">${escapeHtml(q.question_text)}</div>
        <button class="delete-btn" title="Delete">&#10005;</button>
      `;

      card.querySelector('.delete-btn').addEventListener('click', () => deleteQuestion(q.id));

      adminQuestionsList.appendChild(card);
    });
  }

  async function deleteQuestion(id) {
    try {
      const res = await fetch(`/api/live-qa/admin/questions/${id}`, {
        method: 'DELETE',
        headers: { 'X-Admin-Password': adminPassword },
      });

      if (res.ok) {
        loadDashboard();
      }
    } catch {}
  }

  function startPolling() {
    stopPolling();
    pollTimer = setInterval(loadDashboard, 5000);
  }

  function stopPolling() {
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
  }
});
