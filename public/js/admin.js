// ============================================================
// AnonAEBC - Admin Dashboard JavaScript
// Handles admin login, question viewing grouped by IP,
// checkmark toggle for answered/unanswered, and delete
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
  // ----- DOM Elements -----
  const loginForm = document.getElementById('login-form');
  const passwordInput = document.getElementById('password-input');
  const loginError = document.getElementById('login-error');
  const loginView = document.getElementById('login-view');
  const dashboardView = document.getElementById('dashboard-view');
  const questionsList = document.getElementById('questions-list');
  const noQuestions = document.getElementById('no-questions');
  const refreshBtn = document.getElementById('refresh-btn');
  const viewTitle = document.getElementById('view-title');
  const answeredViewBtn = document.getElementById('answered-view-btn');

  // Modal elements
  const deleteModal = document.getElementById('delete-modal');
  const modalCancel = document.getElementById('modal-cancel');
  const modalConfirm = document.getElementById('modal-confirm');

  let adminPassword = '';
  let viewingAnswered = false;
  let pendingDeleteId = null;

  // ----- Login Form -----
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    loginError.classList.add('hidden');

    const password = passwordInput.value;

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      if (res.ok) {
        adminPassword = password;
        loginView.classList.add('hidden');
        dashboardView.classList.remove('hidden');
        loadQuestions();
      } else {
        loginError.textContent = 'Incorrect password.';
        loginError.classList.remove('hidden');
      }
    } catch {
      loginError.textContent = 'Could not connect to the server.';
      loginError.classList.remove('hidden');
    }
  });

  // ----- Refresh -----
  refreshBtn.addEventListener('click', loadQuestions);

  // ----- Toggle Answered / Unanswered View -----
  answeredViewBtn.addEventListener('click', () => {
    viewingAnswered = !viewingAnswered;

    if (viewingAnswered) {
      viewTitle.textContent = 'Answered Questions';
      answeredViewBtn.textContent = 'Back to Questions';
    } else {
      viewTitle.textContent = 'Submitted Questions';
      answeredViewBtn.textContent = 'Answered Questions';
    }

    loadQuestions();
  });

  // ----- Delete Modal Handlers -----
  modalCancel.addEventListener('click', () => {
    pendingDeleteId = null;
    deleteModal.classList.add('hidden');
  });

  deleteModal.addEventListener('click', (e) => {
    if (e.target === deleteModal) {
      pendingDeleteId = null;
      deleteModal.classList.add('hidden');
    }
  });

  modalConfirm.addEventListener('click', async () => {
    if (pendingDeleteId === null) return;

    const id = pendingDeleteId;
    pendingDeleteId = null;
    deleteModal.classList.add('hidden');

    try {
      const res = await fetch(`/api/admin/questions/${id}`, {
        method: 'DELETE',
        headers: { 'X-Admin-Password': adminPassword },
      });

      if (res.ok) {
        loadQuestions();
      }
    } catch {
      // Silently fail
    }
  });

  // ----- Load Questions -----
  async function loadQuestions() {
    const param = viewingAnswered ? '?answered=1' : '';

    try {
      const res = await fetch(`/api/admin/questions${param}`, {
        headers: { 'X-Admin-Password': adminPassword },
      });

      if (!res.ok) {
        questionsList.innerHTML = '<p class="error">Failed to load questions.</p>';
        return;
      }

      const data = await res.json();
      renderQuestions(data.questions);
    } catch {
      questionsList.innerHTML = '<p class="error">Could not connect to the server.</p>';
    }
  }

  // ----- Render Questions Grouped by IP -----
  function renderQuestions(questions) {
    questionsList.innerHTML = '';

    if (questions.length === 0) {
      noQuestions.classList.remove('hidden');
      noQuestions.textContent = viewingAnswered
        ? 'No answered questions yet.'
        : 'No questions yet.';
      return;
    }

    noQuestions.classList.add('hidden');

    // Group by IP address
    const groups = new Map();
    questions.forEach(q => {
      const ip = q.ip_address || 'Unknown';
      if (!groups.has(ip)) groups.set(ip, []);
      groups.get(ip).push(q);
    });

    // Sort groups: most questions first
    const sortedGroups = [...groups.entries()].sort((a, b) => b[1].length - a[1].length);

    sortedGroups.forEach(([ip, groupQuestions]) => {
      const group = document.createElement('div');
      group.className = 'ip-group';

      const header = document.createElement('div');
      header.className = 'ip-group-header';
      header.innerHTML = `
        <span class="ip-label">${escapeHtml(ip)}</span>
        <span class="ip-count">${groupQuestions.length} question${groupQuestions.length !== 1 ? 's' : ''}</span>
      `;
      group.appendChild(header);

      groupQuestions.forEach(q => {
        const card = document.createElement('div');
        card.className = 'question-card';

        const time = new Date(q.created_at).toLocaleString();
        const checkTitle = viewingAnswered ? 'Mark as unanswered' : 'Mark as answered';

        card.innerHTML = `
          <p class="question-text">${escapeHtml(q.question_text)}</p>
          <div class="question-meta">
            <span class="timestamp">${time}</span>
            <div class="question-actions">
              <button class="check-btn ${viewingAnswered ? 'checked' : ''}" title="${checkTitle}">&#10003;</button>
              <button class="delete-btn" title="Delete">&#10005;</button>
            </div>
          </div>
        `;

        card.querySelector('.check-btn').addEventListener('click', () => toggleAnswered(q.id));
        card.querySelector('.delete-btn').addEventListener('click', () => {
          pendingDeleteId = q.id;
          deleteModal.classList.remove('hidden');
        });

        group.appendChild(card);
      });

      questionsList.appendChild(group);
    });
  }

  // ----- Toggle Answered/Unanswered -----
  async function toggleAnswered(id) {
    const endpoint = viewingAnswered
      ? '/api/admin/questions/unanswer'
      : '/api/admin/questions/answer';

    try {
      const res = await fetch(endpoint, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Password': adminPassword,
        },
        body: JSON.stringify({ ids: [id] }),
      });

      if (res.ok) {
        loadQuestions();
      }
    } catch {
      // Silently fail
    }
  }

  // ----- Escape HTML to prevent XSS -----
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
});
