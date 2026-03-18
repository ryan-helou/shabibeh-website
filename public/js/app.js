// ============================================================
// AnonAEBC - User-Facing JavaScript
// Handles anonymous question submission, viewing, editing, and deleting
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
  // ----- DOM Elements -----
  const form = document.getElementById('question-form');
  const input = document.getElementById('question-input');
  const submitBtn = document.getElementById('submit-btn');
  const charCounter = document.getElementById('char-counter');
  const charCountWrap = document.querySelector('.char-count');
  const formView = document.getElementById('form-view');
  const successView = document.getElementById('success-view');
  const anotherBtn = document.getElementById('another-btn');
  const errorMessage = document.getElementById('error-message');
  const myQuestionsList = document.getElementById('my-questions-list');
  const myQuestionsSection = document.getElementById('my-questions');

  // ----- LocalStorage Helpers -----
  function getStoredTokens() {
    try {
      return JSON.parse(localStorage.getItem('my_questions') || '[]');
    } catch {
      return [];
    }
  }

  function saveTokens(tokens) {
    localStorage.setItem('my_questions', JSON.stringify(tokens));
  }

  function addToken(id, edit_token) {
    const tokens = getStoredTokens();
    tokens.push({ id, edit_token });
    saveTokens(tokens);
  }

  function removeToken(id) {
    const tokens = getStoredTokens().filter(t => t.id !== id);
    saveTokens(tokens);
  }

  // ----- Character Counter -----
  input.addEventListener('input', () => {
    const len = input.value.length;
    charCounter.textContent = len;

    if (len > 500) {
      charCountWrap.classList.add('over-limit');
    } else {
      charCountWrap.classList.remove('over-limit');
    }
  });

  // ----- Form Submission -----
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideError();

    const questionText = input.value.trim();

    if (!questionText) {
      showError('Please enter a question.');
      return;
    }
    if (questionText.length > 500) {
      showError('Question must be 500 characters or less.');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting...';

    try {
      const res = await fetch('/api/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question_text: questionText }),
      });

      const data = await res.json();

      if (res.ok) {
        // Store the edit token
        addToken(data.question.id, data.question.edit_token);

        // Show success view and load user's questions
        formView.classList.add('hidden');
        successView.classList.remove('hidden');
        loadMyQuestions();
      } else {
        showError(data.error || 'Something went wrong. Please try again.');
      }
    } catch {
      showError('Could not connect to the server. Please try again.');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Submit Question';
    }
  });

  // ----- "Ask Another Question" Button -----
  anotherBtn.addEventListener('click', () => {
    input.value = '';
    charCounter.textContent = '0';
    charCountWrap.classList.remove('over-limit');
    successView.classList.add('hidden');
    formView.classList.remove('hidden');
    input.focus();
  });

  // ----- Load User's Submitted Questions -----
  async function loadMyQuestions() {
    const tokens = getStoredTokens();

    if (tokens.length === 0) {
      myQuestionsSection.classList.add('hidden');
      return;
    }

    try {
      const res = await fetch('/api/questions/mine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tokens }),
      });

      const data = await res.json();

      if (data.questions.length === 0) {
        myQuestionsSection.classList.add('hidden');
        return;
      }

      myQuestionsSection.classList.remove('hidden');
      renderMyQuestions(data.questions);
    } catch {
      myQuestionsSection.classList.add('hidden');
    }
  }

  // ----- Render Question Cards -----
  function renderMyQuestions(questions) {
    myQuestionsList.innerHTML = '';

    questions.forEach(q => {
      const card = document.createElement('div');
      card.className = 'question-card my-question-card';
      card.dataset.id = q.id;

      const time = new Date(q.created_at).toLocaleString();

      card.innerHTML = `
        <div class="question-text">${escapeHtml(q.question_text)}</div>
        <div class="question-meta">
          <span class="timestamp">${time}</span>
          <div class="question-actions">
            <button class="edit-btn" title="Edit">&#9998;</button>
            <button class="delete-btn" title="Delete">&#10005;</button>
          </div>
        </div>
      `;

      // Edit button
      card.querySelector('.edit-btn').addEventListener('click', () => {
        startEditing(card, q);
      });

      // Delete button
      card.querySelector('.delete-btn').addEventListener('click', () => {
        showDeleteModal(q.id);
      });

      myQuestionsList.appendChild(card);
    });
  }

  // ----- Edit Mode -----
  function startEditing(card, question) {
    const textEl = card.querySelector('.question-text');
    const actionsEl = card.querySelector('.question-actions');

    // Replace text with textarea
    const textarea = document.createElement('textarea');
    textarea.className = 'edit-textarea';
    textarea.value = question.question_text;
    textarea.maxLength = 500;
    textEl.replaceWith(textarea);

    // Replace action buttons with save/cancel
    actionsEl.innerHTML = `
      <button class="save-btn" title="Save">&#10003;</button>
      <button class="cancel-btn secondary-btn" title="Cancel">&#10005;</button>
    `;

    textarea.focus();

    actionsEl.querySelector('.save-btn').addEventListener('click', async () => {
      const newText = textarea.value.trim();
      if (!newText) return;
      if (newText.length > 500) return;

      const tokens = getStoredTokens();
      const token = tokens.find(t => t.id === question.id);
      if (!token) return;

      try {
        const res = await fetch(`/api/questions/${question.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ edit_token: token.edit_token, question_text: newText }),
        });

        if (res.ok) {
          question.question_text = newText;
          loadMyQuestions();
        }
      } catch {
        // silently fail
      }
    });

    actionsEl.querySelector('.cancel-btn').addEventListener('click', () => {
      loadMyQuestions();
    });
  }

  // ----- Delete Modal -----
  function showDeleteModal(questionId) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal">
        <p>Delete this question?</p>
        <div class="modal-actions">
          <button class="secondary-btn modal-cancel-btn">Cancel</button>
          <button class="delete-confirm-btn">Delete</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    overlay.querySelector('.modal-cancel-btn').addEventListener('click', () => {
      overlay.remove();
    });

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.remove();
    });

    overlay.querySelector('.delete-confirm-btn').addEventListener('click', async () => {
      const tokens = getStoredTokens();
      const token = tokens.find(t => t.id === questionId);
      if (!token) return;

      try {
        const res = await fetch(`/api/questions/${questionId}`, {
          method: 'DELETE',
          headers: { 'X-Edit-Token': token.edit_token },
        });

        if (res.ok) {
          removeToken(questionId);
          overlay.remove();
          loadMyQuestions();
        }
      } catch {
        // silently fail
      }
    });
  }

  // ----- Helper Functions -----
  function showError(msg) {
    errorMessage.textContent = msg;
    errorMessage.classList.remove('hidden');
  }

  function hideError() {
    errorMessage.classList.add('hidden');
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
});
