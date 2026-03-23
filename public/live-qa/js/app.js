// ============================================================
// Shabibeh - Live Q&A (User-facing)
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
  const noSession = document.getElementById('no-session');
  const sessionView = document.getElementById('session-view');
  const form = document.getElementById('question-form');
  const input = document.getElementById('question-input');
  const submitBtn = document.getElementById('submit-btn');
  const charCounter = document.getElementById('char-counter');
  const charCountWrap = document.querySelector('.char-count');
  const submitSuccess = document.getElementById('submit-success');
  const errorMessage = document.getElementById('error-message');
  const questionsSection = document.getElementById('questions-section');
  const questionsList = document.getElementById('questions-list');
  const questionCount = document.getElementById('question-count');
  const privateMessage = document.getElementById('private-message');
  const lastUpdated = document.getElementById('last-updated');

  let pollTimer = null;

  // ----- Upvote Tracking (localStorage) -----
  function getUpvoted() {
    try {
      return JSON.parse(localStorage.getItem('live_qa_upvoted') || '[]');
    } catch { return []; }
  }

  function saveUpvoted(ids) {
    localStorage.setItem('live_qa_upvoted', JSON.stringify(ids));
  }

  function hasUpvoted(id) {
    return getUpvoted().includes(id);
  }

  function addUpvote(id) {
    const ids = getUpvoted();
    if (!ids.includes(id)) { ids.push(id); saveUpvoted(ids); }
  }

  function removeUpvoteLocal(id) {
    const ids = getUpvoted().filter(i => i !== id);
    saveUpvoted(ids);
  }

  // ----- Character Counter -----
  input.addEventListener('input', () => {
    const len = input.value.length;
    charCounter.textContent = len;
    charCountWrap.classList.toggle('over-limit', len > 500);
  });

  // ----- Form Submission -----
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideError();
    submitSuccess.classList.add('hidden');

    const text = input.value.trim();
    if (!text) { showError('Please enter a question.'); return; }
    if (text.length > 500) { showError('Question must be 500 characters or less.'); return; }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting...';

    try {
      const res = await fetch('/api/live-qa/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question_text: text }),
      });

      const data = await res.json();

      if (res.ok) {
        input.value = '';
        charCounter.textContent = '0';
        submitSuccess.classList.remove('hidden');
        setTimeout(() => submitSuccess.classList.add('hidden'), 3000);
        loadQuestions();
      } else {
        showError(data.error || 'Something went wrong.');
      }
    } catch {
      showError('Could not connect to the server.');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Submit Question';
    }
  });

  // ----- Check Session & Poll -----
  async function checkSession() {
    try {
      const res = await fetch('/api/live-qa/session');
      const data = await res.json();

      if (data.active) {
        noSession.classList.add('hidden');
        sessionView.classList.remove('hidden');
        loadQuestions();
        startPolling();
      } else {
        noSession.classList.remove('hidden');
        noSession.textContent = 'No active Q&A session right now.';
        sessionView.classList.add('hidden');
        stopPolling();
      }
    } catch {
      noSession.classList.remove('hidden');
      noSession.textContent = 'Could not connect to the server.';
      sessionView.classList.add('hidden');
    }
  }

  async function loadQuestions() {
    try {
      const res = await fetch('/api/live-qa/questions');
      const data = await res.json();

      if (data.public_voting) {
        questionsSection.classList.remove('hidden');
        privateMessage.classList.add('hidden');
        questionCount.textContent = `(${data.questions.length})`;
        const now = new Date();
        lastUpdated.textContent = 'Updated ' + now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit' });
        renderQuestions(data.questions);
      } else {
        questionsSection.classList.add('hidden');
        privateMessage.classList.remove('hidden');
      }
    } catch {
      // silently fail on poll
    }
  }

  function renderQuestions(questions) {
    questionsList.innerHTML = '';

    if (questions.length === 0) {
      questionsList.innerHTML = '<p class="muted">No questions yet. Be the first!</p>';
      return;
    }

    questions.forEach(q => {
      const card = document.createElement('div');
      card.className = 'live-qa-card';

      const voted = hasUpvoted(q.id);

      card.innerHTML = `
        <button class="upvote-btn ${voted ? 'upvoted' : ''}" title="${voted ? 'Remove upvote' : 'Upvote'}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="${voted ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>
          <span class="upvote-count">${q.upvotes}</span>
        </button>
        <div class="live-qa-text">${escapeHtml(q.question_text)}</div>
      `;

      card.querySelector('.upvote-btn').addEventListener('click', () => toggleUpvote(q.id, voted));

      questionsList.appendChild(card);
    });
  }

  const upvoteInFlight = new Set();

  async function toggleUpvote(id, currentlyVoted) {
    if (upvoteInFlight.has(id)) return;
    upvoteInFlight.add(id);
    try {
      if (currentlyVoted) {
        await fetch(`/api/live-qa/questions/${id}/upvote`, { method: 'DELETE' });
        removeUpvoteLocal(id);
      } else {
        await fetch(`/api/live-qa/questions/${id}/upvote`, { method: 'POST' });
        addUpvote(id);
      }
      loadQuestions();
    } catch {
      // silently fail
    } finally {
      upvoteInFlight.delete(id);
    }
  }

  function startPolling() {
    stopPolling();
    pollTimer = setInterval(() => {
      loadQuestions();
    }, 5000);
  }

  function stopPolling() {
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
  }

  // Re-check session every 5 seconds in case it opens/closes
  setInterval(checkSession, 5000);

  function showError(msg) {
    errorMessage.textContent = msg;
    errorMessage.classList.remove('hidden');
  }

  function hideError() {
    errorMessage.classList.add('hidden');
  }

  checkSession();
});
