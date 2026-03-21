// ============================================================
// Shabibeh - Ideas
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
  const loginView = document.getElementById('login-view');
  const dashboardView = document.getElementById('dashboard-view');
  const loginForm = document.getElementById('login-form');
  const passwordInput = document.getElementById('password-input');
  const loginError = document.getElementById('login-error');
  const ideaForm = document.getElementById('idea-form');
  const ideaInput = document.getElementById('idea-input');
  const submitBtn = document.getElementById('submit-btn');
  const errorMessage = document.getElementById('error-message');
  const ideaCount = document.getElementById('idea-count');
  const ideasList = document.getElementById('ideas-list');
  const noIdeas = document.getElementById('no-ideas');

  let adminPassword = '';

  // ----- Auto-login -----
  const saved = localStorage.getItem('admin_password');
  if (saved) {
    adminPassword = saved;
    tryLogin(saved);
  }

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    loginError.classList.add('hidden');
    const pw = passwordInput.value.trim();
    if (!pw) return;
    adminPassword = pw;
    tryLogin(pw);
  });

  async function tryLogin(pw) {
    try {
      const res = await fetch('/api/ideas', {
        headers: { 'x-admin-password': pw },
      });

      if (res.ok) {
        localStorage.setItem('admin_password', pw);
        loginView.classList.add('hidden');
        dashboardView.classList.remove('hidden');
        const data = await res.json();
        renderIdeas(data.ideas);
      } else {
        loginError.textContent = 'Wrong password.';
        loginError.classList.remove('hidden');
      }
    } catch {
      loginError.textContent = 'Could not connect to server.';
      loginError.classList.remove('hidden');
    }
  }

  // ----- Add Idea -----
  ideaForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorMessage.classList.add('hidden');

    const text = ideaInput.value.trim();
    if (!text) return;

    submitBtn.disabled = true;
    submitBtn.textContent = 'Adding...';

    try {
      const res = await fetch('/api/ideas', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-password': adminPassword,
        },
        body: JSON.stringify({ text }),
      });

      if (res.ok) {
        ideaInput.value = '';
        loadIdeas();
      } else {
        const data = await res.json();
        showError(data.error || 'Failed to add idea.');
      }
    } catch {
      showError('Could not connect to server.');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Add Idea';
    }
  });

  // ----- Load Ideas -----
  async function loadIdeas() {
    try {
      const res = await fetch('/api/ideas', {
        headers: { 'x-admin-password': adminPassword },
      });
      const data = await res.json();
      renderIdeas(data.ideas);
    } catch {}
  }

  function renderIdeas(ideas) {
    ideasList.innerHTML = '';
    ideaCount.textContent = `(${ideas.length})`;

    if (ideas.length === 0) {
      noIdeas.classList.remove('hidden');
      return;
    }

    noIdeas.classList.add('hidden');

    ideas.forEach(idea => {
      const card = document.createElement('div');
      card.className = 'idea-card';

      const time = timeAgo(idea.created_at);

      card.innerHTML = `
        <div class="idea-text">${escapeHtml(idea.text)}</div>
        <div class="idea-footer">
          <span class="timestamp">${time}</span>
          <button class="delete-btn" title="Delete">&#10005;</button>
        </div>
      `;

      card.querySelector('.delete-btn').addEventListener('click', () => deleteIdea(idea.id));

      ideasList.appendChild(card);
    });
  }

  async function deleteIdea(id) {
    try {
      await fetch(`/api/ideas/${id}`, {
        method: 'DELETE',
        headers: { 'x-admin-password': adminPassword },
      });
      loadIdeas();
    } catch {}
  }

  function showError(msg) {
    errorMessage.textContent = msg;
    errorMessage.classList.remove('hidden');
  }
});
