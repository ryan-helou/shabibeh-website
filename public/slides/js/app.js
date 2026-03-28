// ============================================================
// Shabibeh - Sermon Slides
// List, view, and download PDF slides from Google Drive
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
  const list = document.getElementById('slides-list');
  const loading = document.getElementById('loading');
  const errorMessage = document.getElementById('error-message');
  const searchInput = document.getElementById('search-input');
  const viewer = document.getElementById('slide-viewer');
  const viewerTitle = document.getElementById('viewer-title');
  const viewerFrame = document.getElementById('viewer-frame');
  const viewerClose = document.getElementById('viewer-close');
  const viewerFullscreen = document.getElementById('viewer-fullscreen');

  let allSlides = [];

  const pastorFilter = document.getElementById('pastor-filter');
  const dateFilter = document.getElementById('date-filter');

  function applyFilters() {
    const query = searchInput.value.toLowerCase().trim();
    const pastor = pastorFilter.value;
    const date = dateFilter.value;
    const filtered = allSlides.filter(s => {
      if (query && !s.sermon.toLowerCase().includes(query) && !s.pastor.toLowerCase().includes(query)) return false;
      if (pastor && s.pastor !== pastor) return false;
      if (date && s.date !== date) return false;
      return true;
    });
    renderSlides(filtered);
  }

  searchInput.addEventListener('input', applyFilters);
  pastorFilter.addEventListener('change', applyFilters);
  dateFilter.addEventListener('change', applyFilters);

  // ----- Viewer -----
  viewerClose.addEventListener('click', closeViewer);

  viewerFullscreen.addEventListener('click', () => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      viewer.requestFullscreen().catch(() => {
        // Fallback for iOS Safari
        if (viewer.webkitRequestFullscreen) viewer.webkitRequestFullscreen();
      });
    }
  });

  function openViewer(slide) {
    viewerTitle.textContent = slide.sermon || slide.name;
    viewerFrame.src = `https://drive.google.com/file/d/${slide.id}/preview`;
    viewer.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }

  function closeViewer() {
    if (document.fullscreenElement) document.exitFullscreen();
    viewer.classList.add('hidden');
    viewerFrame.src = '';
    document.body.style.overflow = '';
  }

  async function loadSlides() {
    try {
      const res = await fetch('/api/slides');
      const data = await res.json();

      loading.classList.add('hidden');

      if (!res.ok) {
        showError(data.error || 'Failed to load slides.');
        return;
      }

      if (data.slides.length === 0) {
        loading.classList.remove('hidden');
        loading.textContent = 'No slides yet.';
        return;
      }

      allSlides = data.slides;

      const pastors = [...new Set(allSlides.map(s => s.pastor).filter(Boolean))].sort();
      pastors.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p;
        opt.textContent = p;
        pastorFilter.appendChild(opt);
      });

      renderSlides(allSlides);
    } catch {
      loading.classList.add('hidden');
      showError('Could not connect to the server.');
    }
  }

  function renderSlides(slides) {
    list.innerHTML = '';

    if (slides.length === 0) {
      list.innerHTML = '<p class="muted">No slides found.</p>';
      return;
    }

    slides.forEach(s => {
      const card = document.createElement('div');
      card.className = 'slide-card';

      card.innerHTML = `
        <div class="slide-info">
          <div class="slide-name">${escapeHtml(s.sermon)}</div>
          ${s.pastor ? `<div class="slide-pastor">${escapeHtml(s.pastor)}</div>` : ''}
          ${s.date ? `<div class="slide-date">${escapeHtml(s.date)}</div>` : ''}
        </div>
        <div class="slide-controls">
          <button class="view-btn" title="View">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          </button>
          <a href="${s.download_url}" class="download-btn" title="Download" download>&#8615;</a>
          ${navigator.share ? '<button class="share-btn" title="Share"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg></button>' : ''}
        </div>
      `;

      card.querySelector('.view-btn').addEventListener('click', () => openViewer(s));

      const shareBtn = card.querySelector('.share-btn');
      if (shareBtn) {
        shareBtn.addEventListener('click', () => {
          navigator.share({ title: s.name, url: s.download_url }).catch(() => {});
        });
      }

      list.appendChild(card);
    });
  }

  function showError(msg) {
    errorMessage.textContent = msg;
    errorMessage.classList.remove('hidden');
  }

  loadSlides();
});
