// ============================================================
// Shabibeh - Ideas Board
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
  const todoCount = document.getElementById('todo-count');
  const doneCount = document.getElementById('done-count');
  const todoList = document.getElementById('todo-list');
  const doneList = document.getElementById('done-list');
  const noTodo = document.getElementById('no-todo');
  const toggleDoneBtn = document.getElementById('toggle-done');

  let adminPassword = '';
  let doneVisible = false;

  // ----- Toggle Done Section -----
  toggleDoneBtn.addEventListener('click', () => {
    doneVisible = !doneVisible;
    doneList.classList.toggle('hidden', !doneVisible);
    toggleDoneBtn.textContent = doneVisible ? 'Hide' : 'Show';
  });

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
        renderBoard(data.ideas);
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
      renderBoard(data.ideas);
    } catch {}
  }

  function renderBoard(ideas) {
    const todoIdeas = ideas.filter(i => i.status !== 'done');
    const doneIdeas = ideas.filter(i => i.status === 'done');

    todoCount.textContent = `(${todoIdeas.length})`;
    doneCount.textContent = `(${doneIdeas.length})`;

    // Render todo
    todoList.innerHTML = '';
    if (todoIdeas.length === 0) {
      noTodo.classList.remove('hidden');
    } else {
      noTodo.classList.add('hidden');
      todoIdeas.forEach(idea => todoList.appendChild(createCard(idea)));
    }

    // Render done
    doneList.innerHTML = '';
    if (doneIdeas.length === 0) {
      doneList.innerHTML = '<p class="muted">No completed ideas yet.</p>';
    } else {
      doneIdeas.forEach(idea => doneList.appendChild(createCard(idea)));
    }
  }

  function createCard(idea) {
    const card = document.createElement('div');
    const isDone = idea.status === 'done';
    card.className = 'idea-card' + (isDone ? ' done' : '');

    const time = timeAgo(idea.created_at);

    card.innerHTML = `
      <div class="idea-content">
        <div class="idea-text">${escapeHtml(idea.text)}</div>
        <div class="idea-footer">
          <span class="timestamp">${time}</span>
        </div>
      </div>
      <div class="idea-actions">
        <button class="idea-action-btn check-btn" title="${isDone ? 'Undo' : 'Mark done'}">
          ${isDone ? '↩' : '✓'}
        </button>
        <button class="idea-action-btn edit-btn" title="Edit">✎</button>
        <button class="idea-action-btn del-btn" title="Delete">✕</button>
      </div>
    `;

    // Check / uncheck
    card.querySelector('.check-btn').addEventListener('click', () => {
      updateIdea(idea.id, { status: isDone ? 'todo' : 'done' });
    });

    // Edit
    card.querySelector('.edit-btn').addEventListener('click', () => {
      const content = card.querySelector('.idea-content');
      const currentText = idea.text;

      content.innerHTML = `
        <textarea class="idea-edit-textarea">${escapeHtml(currentText)}</textarea>
        <div class="idea-edit-actions">
          <button class="idea-save-btn">Save</button>
          <button class="idea-cancel-btn secondary-btn">Cancel</button>
        </div>
      `;

      const textarea = content.querySelector('.idea-edit-textarea');
      textarea.focus();
      textarea.setSelectionRange(textarea.value.length, textarea.value.length);

      content.querySelector('.idea-save-btn').addEventListener('click', () => {
        const newText = textarea.value.trim();
        if (newText && newText !== currentText) {
          updateIdea(idea.id, { text: newText });
        } else {
          loadIdeas();
        }
      });

      content.querySelector('.idea-cancel-btn').addEventListener('click', () => loadIdeas());
    });

    // Delete
    card.querySelector('.del-btn').addEventListener('click', () => deleteIdea(idea.id));

    return card;
  }

  async function updateIdea(id, updates) {
    try {
      await fetch(`/api/ideas/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-password': adminPassword,
        },
        body: JSON.stringify(updates),
      });
      loadIdeas();
    } catch {}
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
