// ============================================================
// Shabibeh - Recordings
// List, play, and download MP3 recordings from Google Drive
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
  const list = document.getElementById('recordings-list');
  const loading = document.getElementById('loading');
  const errorMessage = document.getElementById('error-message');

  const searchInput = document.getElementById('search-input');
  let currentAudio = null;
  let currentCard = null;
  let allRecordings = [];

  // ----- Playback Position Storage -----
  function savePosition(id, time) {
    try {
      const positions = JSON.parse(localStorage.getItem('recording_positions') || '{}');
      positions[id] = time;
      localStorage.setItem('recording_positions', JSON.stringify(positions));
    } catch {}
  }

  function getPosition(id) {
    try {
      const positions = JSON.parse(localStorage.getItem('recording_positions') || '{}');
      return positions[id] || 0;
    } catch { return 0; }
  }

  function clearPosition(id) {
    try {
      const positions = JSON.parse(localStorage.getItem('recording_positions') || '{}');
      delete positions[id];
      localStorage.setItem('recording_positions', JSON.stringify(positions));
    } catch {}
  }

  const pastorFilter = document.getElementById('pastor-filter');

  // ----- Filtering -----
  function applyFilters() {
    const query = searchInput.value.toLowerCase().trim();
    const pastor = pastorFilter.value;
    const filtered = allRecordings.filter(r => {
      if (query && !r.sermon.toLowerCase().includes(query) && !r.pastor.toLowerCase().includes(query)) return false;
      if (pastor && r.pastor !== pastor) return false;
      return true;
    });
    renderRecordings(filtered);
  }

  searchInput.addEventListener('input', applyFilters);
  pastorFilter.addEventListener('change', applyFilters);

  async function loadRecordings() {
    try {
      const res = await fetch('/api/recordings');
      const data = await res.json();

      loading.classList.add('hidden');

      if (!res.ok) {
        showError(data.error || 'Failed to load recordings.');
        return;
      }

      if (data.recordings.length === 0) {
        loading.classList.remove('hidden');
        loading.textContent = 'No recordings yet.';
        return;
      }

      allRecordings = data.recordings;

      // Populate pastor dropdown
      const pastors = [...new Set(allRecordings.map(r => r.pastor).filter(Boolean))].sort();
      pastors.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p;
        opt.textContent = p;
        pastorFilter.appendChild(opt);
      });

      renderRecordings(allRecordings);
    } catch {
      loading.classList.add('hidden');
      showError('Could not connect to the server.');
    }
  }

  function renderRecordings(recordings) {
    // Stop current audio if playing
    if (currentAudio) {
      currentAudio.pause();
      currentAudio = null;
      currentCard = null;
    }

    list.innerHTML = '';

    if (recordings.length === 0) {
      list.innerHTML = '<p class="muted">No recordings found.</p>';
      return;
    }

    recordings.forEach(r => {
      const card = document.createElement('div');
      card.className = 'recording-card';
      card.dataset.id = r.id;

      const savedPos = getPosition(r.id);
      const resumeTag = savedPos > 0 ? '<span class="resume-tag">Resume</span>' : '';

      card.innerHTML = `
        <div class="recording-info">
          <div class="recording-name">${escapeHtml(r.sermon)} ${resumeTag}</div>
          ${r.pastor ? `<div class="recording-pastor">${escapeHtml(r.pastor)}</div>` : ''}
          ${r.date ? `<div class="recording-date">${escapeHtml(r.date)}</div>` : ''}
        </div>
        <div class="recording-controls">
          <button class="play-btn" title="Play">&#9654;</button>
          <a href="${r.download_url}" class="download-btn" title="Download" download>&#8615;</a>
          ${navigator.share ? '<button class="share-btn" title="Share"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg></button>' : ''}
        </div>
        <div class="audio-player hidden">
          <audio preload="none">
            <source src="${r.stream_url}" type="audio/mpeg">
          </audio>
          <div class="player-row">
            <span class="player-time">0:00</span>
            <div class="seek-container">
              <div class="buffered-bar"></div>
              <input type="range" class="player-seek" min="0" max="100" value="0">
            </div>
            <span class="player-duration">0:00</span>
          </div>
          <div class="speed-controls">
            <button class="speed-btn" data-speed="0.5">0.5x</button>
            <button class="speed-btn active" data-speed="1">1x</button>
            <button class="speed-btn" data-speed="1.5">1.5x</button>
            <button class="speed-btn" data-speed="2">2x</button>
          </div>
        </div>
      `;

      const playBtn = card.querySelector('.play-btn');
      const audioPlayer = card.querySelector('.audio-player');
      const audio = card.querySelector('audio');
      const seekBar = card.querySelector('.player-seek');
      const bufferedBar = card.querySelector('.buffered-bar');
      const playerTime = card.querySelector('.player-time');
      const playerDuration = card.querySelector('.player-duration');
      const speedBtns = card.querySelectorAll('.speed-btn');

      // ----- Speed Controls -----
      speedBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          const speed = parseFloat(btn.dataset.speed);
          audio.playbackRate = speed;
          speedBtns.forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
        });
      });

      // ----- Share -----
      const shareBtn = card.querySelector('.share-btn');
      if (shareBtn) {
        shareBtn.addEventListener('click', () => {
          navigator.share({ title: r.name, url: r.download_url }).catch(() => {});
        });
      }

      // ----- Polling timer for mobile reliability -----
      let pollTimer = null;

      function startPolling() {
        stopPolling();
        pollTimer = setInterval(() => {
          if (!audio.paused && audio.duration) {
            // Update time display
            playerTime.textContent = formatTime(audio.currentTime);
            seekBar.value = Math.floor(audio.currentTime);

            // Update loading state
            if (audio.readyState >= 3) {
              playBtn.classList.remove('loading');
              playBtn.innerHTML = '&#9646;&#9646;';
            } else {
              playBtn.classList.add('loading');
              playBtn.innerHTML = '';
            }

            // Update buffered bar
            if (audio.buffered.length > 0) {
              const bufferedEnd = audio.buffered.end(audio.buffered.length - 1);
              bufferedBar.style.width = (bufferedEnd / audio.duration) * 100 + '%';
            }

            // Save position every 5 seconds
            if (Math.floor(audio.currentTime) % 5 === 0) {
              savePosition(r.id, audio.currentTime);
            }
          }
        }, 250);
      }

      function stopPolling() {
        if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
      }

      // ----- Play/Pause -----
      playBtn.addEventListener('click', () => {
        if (currentAudio && currentAudio !== audio) {
          savePosition(currentCard.dataset.id, currentAudio.currentTime);
          currentAudio.pause();
          currentCard.querySelector('.audio-player').classList.add('hidden');
          currentCard.querySelector('.play-btn').innerHTML = '&#9654;';
          currentCard.querySelector('.play-btn').classList.remove('loading');
        }

        if (audio.paused) {
          playBtn.innerHTML = '';
          playBtn.classList.add('loading');
          audioPlayer.classList.remove('hidden');
          currentAudio = audio;
          currentCard = card;
          audio.play().catch(() => {
            playBtn.innerHTML = '&#9654;';
            playBtn.classList.remove('loading');
          });
          startPolling();
        } else {
          audio.pause();
          savePosition(r.id, audio.currentTime);
          playBtn.innerHTML = '&#9654;';
          playBtn.classList.remove('loading');
          stopPolling();
        }
      });

      audio.addEventListener('playing', () => {
        playBtn.classList.remove('loading');
        playBtn.innerHTML = '&#9646;&#9646;';
      });

      audio.addEventListener('waiting', () => {
        playBtn.classList.add('loading');
        playBtn.innerHTML = '';
      });

      audio.addEventListener('loadedmetadata', () => {
        playerDuration.textContent = formatTime(audio.duration);
        seekBar.max = Math.floor(audio.duration);
        const saved = getPosition(r.id);
        if (saved > 0 && saved < audio.duration - 5) {
          audio.currentTime = saved;
        }
      });

      audio.addEventListener('durationchange', () => {
        if (audio.duration && isFinite(audio.duration)) {
          playerDuration.textContent = formatTime(audio.duration);
          seekBar.max = Math.floor(audio.duration);
        }
      });

      audio.addEventListener('timeupdate', () => {
        playerTime.textContent = formatTime(audio.currentTime);
        seekBar.value = Math.floor(audio.currentTime);
        if (Math.floor(audio.currentTime) % 5 === 0) {
          savePosition(r.id, audio.currentTime);
        }
      });

      audio.addEventListener('progress', () => {
        if (audio.buffered.length > 0 && audio.duration > 0) {
          const bufferedEnd = audio.buffered.end(audio.buffered.length - 1);
          bufferedBar.style.width = (bufferedEnd / audio.duration) * 100 + '%';
        }
      });

      audio.addEventListener('ended', () => {
        playBtn.innerHTML = '&#9654;';
        playBtn.classList.remove('loading');
        seekBar.value = 0;
        playerTime.textContent = '0:00';
        clearPosition(r.id);
        stopPolling();
      });

      seekBar.addEventListener('input', () => {
        audio.currentTime = seekBar.value;
      });

      list.appendChild(card);
    });
  }

  function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  function showError(msg) {
    errorMessage.textContent = msg;
    errorMessage.classList.remove('hidden');
  }

  loadRecordings();
});
