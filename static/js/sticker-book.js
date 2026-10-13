/**
 * sticker-book.js - Interactive Retro Sticker Book with Drag & Drop & LocalStorage Persistence
 * Lachlan's World (Web 2.0)
 */

(function () {
  'use strict';

  const STORAGE_KEY = 'lachlan_grid_stickers';
  const DRAWER_KEY = 'lachlan_grid_sticker_drawer_open';
  const MOTION_KEY = 'lachlan_sticker_motion';

  let stickers = [];
  let nextId = 1;

  function resolveStickerAnimType(src) {
    if (!src) return 'anim-float';
    if (src.includes('sparkle-star') || src.includes('y2k-butterfly')) return 'anim-shimmer';
    if (src.includes('pixel-flame') || src.includes('pocket_pet-egg') || src.includes('retro-smiley')) return 'anim-pulse';
    if (src.includes('notepad-made') || src.includes('xhtml-valid') || src.includes('winamp-whips') || src.includes('ie-best') || src.includes('dialup-56k') || src.includes('cassette-mixtape')) return 'anim-sway';
    return 'anim-float';
  }

  function applyMotionPreference() {
    const motionPref = localStorage.getItem(MOTION_KEY);
    const disabled = motionPref === 'disabled';
    document.documentElement.classList.toggle('stickers-motion-disabled', disabled);
    const btn = document.getElementById('sticker-motion-btn');
    if (btn) {
      btn.textContent = disabled ? 'Motion: OFF' : 'Motion: ON';
      btn.setAttribute('aria-pressed', disabled ? 'false' : 'true');
    }
  }

  function toggleMotionPreference() {
    const isCurrentlyDisabled = document.documentElement.classList.contains('stickers-motion-disabled');
    const newState = isCurrentlyDisabled ? 'enabled' : 'disabled';
    localStorage.setItem(MOTION_KEY, newState);
    applyMotionPreference();
  }

  function loadStickers() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  }

  function saveStickers() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stickers));
    } catch (e) {
      // Quota exceeded or private browsing
    }
  }

  function createStickerElement(stickerData, isNew) {
    const layer = document.getElementById('sticker-canvas-layer');
    if (!layer) return;

    const el = document.createElement('div');
    const animClass = stickerData.animType || resolveStickerAnimType(stickerData.src);
    el.className = 'desktop-sticker ' + animClass;
    el.id = 'placed-sticker-' + stickerData.id;
    el.style.left = stickerData.x + 'px';
    el.style.top = stickerData.y + 'px';
    if (stickerData.rotation) {
      el.style.transform = 'rotate(' + stickerData.rotation + 'deg)';
    }

    // Stagger animation delay and duration to avoid robotic synchronization
    const seed = (typeof stickerData.id === 'string' ? stickerData.id.charCodeAt(stickerData.id.length - 1) : Math.floor(Math.random() * 10)) || 0;
    const delayOffset = ((seed % 10) * 0.4).toFixed(2);
    const duration = (3.2 + (seed % 5) * 0.35).toFixed(2);
    el.style.setProperty('--anim-delay', '-' + delayOffset + 's');
    el.style.setProperty('--anim-duration', duration + 's');

    if (isNew) {
      el.classList.add('is-spawned');
      setTimeout(function () {
        el.classList.remove('is-spawned');
      }, 260);
    }

    const img = document.createElement('img');
    img.src = stickerData.src;
    img.alt = 'Sticker';
    img.draggable = false;

    const delBtn = document.createElement('button');
    delBtn.className = 'sticker-delete-btn';
    delBtn.innerHTML = '&times;';
    delBtn.title = 'Remove Sticker';
    delBtn.setAttribute('aria-label', 'Remove Sticker');
    delBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      removeSticker(stickerData.id);
    });

    el.appendChild(img);
    el.appendChild(delBtn);

    // Setup pointer drag
    setupStickerDrag(el, stickerData);

    layer.appendChild(el);
  }

  function setupStickerDrag(el, stickerData) {
    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let initialLeft = 0;
    let initialTop = 0;

    function onPointerDown(e) {
      if (e.target.classList.contains('sticker-delete-btn')) return;
      isDragging = true;
      el.classList.add('is-dragging');
      startX = e.clientX;
      startY = e.clientY;
      initialLeft = el.offsetLeft;
      initialTop = el.offsetTop;
      el.setPointerCapture(e.pointerId);
      e.preventDefault();
    }

    function onPointerMove(e) {
      if (!isDragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      let newX = initialLeft + dx;
      let newY = initialTop + dy;

      // Keep within viewport boundaries
      newX = Math.max(0, Math.min(window.innerWidth - 60, newX));
      newY = Math.max(0, Math.min(window.innerHeight - 60, newY));

      el.style.left = newX + 'px';
      el.style.top = newY + 'px';

      stickerData.x = newX;
      stickerData.y = newY;
    }

    function onPointerUp(e) {
      if (!isDragging) return;
      isDragging = false;
      el.classList.remove('is-dragging');
      try {
        el.releasePointerCapture(e.pointerId);
      } catch (err) {}
      saveStickers();
    }

    el.addEventListener('pointerdown', onPointerDown);
    el.addEventListener('pointermove', onPointerMove);
    el.addEventListener('pointerup', onPointerUp);
    el.addEventListener('pointercancel', onPointerUp);
  }

  function addSticker(src, x, y) {
    const id = Date.now() + '-' + nextId++;
    const randomRotation = Math.floor(Math.random() * 16) - 8; // -8 to +8 degrees
    const animType = resolveStickerAnimType(src);

    const stickerData = {
      id: id,
      src: src,
      x: Math.round(x),
      y: Math.round(y),
      rotation: randomRotation,
      animType: animType
    };

    stickers.push(stickerData);
    saveStickers();
    createStickerElement(stickerData, true);
  }

  function removeSticker(id) {
    stickers = stickers.filter(function (s) { return s.id !== id; });
    saveStickers();
    const el = document.getElementById('placed-sticker-' + id);
    if (el) el.remove();
  }

  function clearAllStickers() {
    stickers = [];
    saveStickers();
    const layer = document.getElementById('sticker-canvas-layer');
    if (layer) layer.innerHTML = '';
  }

  // --- Initialize Palette & Drawer ---
  function initStickerBook() {
    const drawer = document.getElementById('sticker-book-drawer');
    const toggleBtn = document.getElementById('sticker-drawer-toggle');
    const arrow = document.getElementById('sticker-tab-arrow');
    const clearBtn = document.getElementById('sticker-clear-btn');
    const motionBtn = document.getElementById('sticker-motion-btn');
    const palette = document.getElementById('sticker-palette');

    if (!drawer || !toggleBtn) return;

    applyMotionPreference();
    if (motionBtn) {
      motionBtn.addEventListener('click', toggleMotionPreference);
    }

    // Restore drawer state
    const isDrawerOpen = localStorage.getItem(DRAWER_KEY) === 'true';
    if (isDrawerOpen) {
      drawer.classList.remove('collapsed');
      toggleBtn.setAttribute('aria-expanded', 'true');
      if (arrow) arrow.innerHTML = '&#9660;';
    }

    // Toggle drawer
    toggleBtn.addEventListener('click', function () {
      const collapsed = drawer.classList.toggle('collapsed');
      const open = !collapsed;
      toggleBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (arrow) arrow.innerHTML = open ? '&#9660;' : '&#9650;';
      localStorage.setItem(DRAWER_KEY, open ? 'true' : 'false');
    });

    if (clearBtn) {
      clearBtn.addEventListener('click', function () {
        if (confirm('Clear all stickers from the background?')) {
          clearAllStickers();
        }
      });
    }

    // Palette items: Click or Drag to spawn
    if (palette) {
      const items = palette.querySelectorAll('.sticker-item');
      items.forEach(function (item) {
        // Dragstart
        item.addEventListener('dragstart', function (e) {
          const src = item.getAttribute('data-src');
          e.dataTransfer.setData('text/plain', src);
          e.dataTransfer.effectAllowed = 'copy';
        });

        // Click to place in random visible desktop spot
        item.addEventListener('click', function () {
          const src = item.getAttribute('data-src');
          const spawnX = Math.max(20, Math.floor(Math.random() * (window.innerWidth - 180)));
          const spawnY = Math.max(60, Math.floor(Math.random() * (window.innerHeight - 180)));
          addSticker(src, spawnX, spawnY);
        });
      });
    }

    // Allow dropping on document / window
    document.addEventListener('dragover', function (e) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    });

    document.addEventListener('drop', function (e) {
      e.preventDefault();
      const src = e.dataTransfer.getData('text/plain');
      if (src && src.includes('stickers/')) {
        addSticker(src, e.clientX - 40, e.clientY - 20);
      }
    });

    // Render saved stickers
    stickers = loadStickers();
    stickers.forEach(function (s) {
      createStickerElement(s, false);
    });
  }

  // Mouse proximity excitation for nearby stickers
  let proximityRaf = null;
  document.addEventListener('pointermove', function (e) {
    if (proximityRaf) return;
    proximityRaf = requestAnimationFrame(function () {
      proximityRaf = null;
      if (document.documentElement.classList.contains('stickers-motion-disabled')) {
        document.querySelectorAll('#sticker-canvas-layer .desktop-sticker.is-nearby').forEach(function (st) {
          st.classList.remove('is-nearby');
        });
        return;
      }
      const placedStickers = document.querySelectorAll('#sticker-canvas-layer .desktop-sticker');
      const mouseX = e.clientX;
      const mouseY = e.clientY;
      const PROXIMITY_THRESHOLD = 130;

      placedStickers.forEach(function (st) {
        if (st.classList.contains('is-dragging')) {
          st.classList.remove('is-nearby');
          return;
        }
        const rect = st.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const dist = Math.hypot(mouseX - centerX, mouseY - centerY);
        if (dist < PROXIMITY_THRESHOLD) {
          st.classList.add('is-nearby');
        } else {
          st.classList.remove('is-nearby');
        }
      });
    });
  });

  window.addEventListener('mouseleave', function () {
    document.querySelectorAll('#sticker-canvas-layer .desktop-sticker.is-nearby').forEach(function (st) {
      st.classList.remove('is-nearby');
    });
  });

  // Expose global helper for cross-component motion synchronization
  window.applyStickerMotionPreference = applyMotionPreference;

  document.addEventListener('DOMContentLoaded', initStickerBook);
})();
