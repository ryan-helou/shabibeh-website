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

  searchInput.addEventListener('input', () => {
    const query = searchInput.value.toLowerCase().trim();
    if (!query) {
      renderRecordings(allRecordings);
      return;
    }
    const filtered = allRecordings.filter(r =>
      r.name.toLowerCase().includes(query)
    );
    renderRecordings(filtered);
  });

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
      renderRecordings(allRecordings);
    } catch {
      loading.classList.add('hidden');
      showError('Could not connect to the server.');
    }
  }

  function renderRecordings(recordings) {
    list.innerHTML = '';

    recordings.forEach(r => {
      const card = document.createElement('div');
      card.className = 'recording-card';
      card.dataset.id = r.id;

      const sizeText = r.size ? `${r.size} MB` : '';
      const time = timeAgo(r.created_at);

      card.innerHTML = `
        <div class="recording-info">
          <div class="recording-name">${escapeHtml(r.name)}</div>
          <div class="recording-meta">
            <span class="timestamp">${time}</span>
            ${sizeText ? `<span class="recording-size">${sizeText}</span>` : ''}
          </div>
        </div>
        <div class="recording-controls">
          <button class="play-btn" title="Play">&#9654;</button>
          <a href="${r.download_url}" class="download-btn" title="Download" download>&#8615;</a>
        </div>
        <div class="audio-player hidden">
          <audio preload="none">
            <source src="${r.stream_url}" type="audio/mpeg">
          </audio>
          <div class="player-row">
            <span class="player-time">0:00</span>
            <input type="range" class="player-seek" min="0" max="100" value="0">
            <span class="player-duration">0:00</span>
          </div>
        </div>
      `;

      const playBtn = card.querySelector('.play-btn');
      const audioPlayer = card.querySelector('.audio-player');
      const audio = card.querySelector('audio');
      const seekBar = card.querySelector('.player-seek');
      const playerTime = card.querySelector('.player-time');
      const playerDuration = card.querySelector('.player-duration');

      let isLoading = false;

      playBtn.addEventListener('click', () => {
        // If another recording is playing, stop it
        if (currentAudio && currentAudio !== audio) {
          currentAudio.pause();
          currentAudio.currentTime = 0;
          currentCard.querySelector('.audio-player').classList.add('hidden');
          currentCard.querySelector('.play-btn').innerHTML = '&#9654;';
          currentCard.querySelector('.play-btn').classList.remove('loading');
        }

        if (audio.paused) {
          isLoading = true;
          playBtn.innerHTML = '';
          playBtn.classList.add('loading');
          audioPlayer.classList.remove('hidden');
          currentAudio = audio;
          currentCard = card;
          audio.play();
        } else {
          audio.pause();
          playBtn.innerHTML = '&#9654;';
          playBtn.classList.remove('loading');
        }
      });

      audio.addEventListener('playing', () => {
        isLoading = false;
        playBtn.classList.remove('loading');
        playBtn.innerHTML = '&#9646;&#9646;';
      });

      audio.addEventListener('waiting', () => {
        isLoading = true;
        playBtn.classList.add('loading');
        playBtn.innerHTML = '';
      });

      audio.addEventListener('loadedmetadata', () => {
        playerDuration.textContent = formatTime(audio.duration);
        seekBar.max = Math.floor(audio.duration);
      });

      audio.addEventListener('timeupdate', () => {
        playerTime.textContent = formatTime(audio.currentTime);
        seekBar.value = Math.floor(audio.currentTime);
      });

      audio.addEventListener('ended', () => {
        playBtn.innerHTML = '&#9654;';
        playBtn.classList.remove('loading');
        seekBar.value = 0;
        playerTime.textContent = '0:00';
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
