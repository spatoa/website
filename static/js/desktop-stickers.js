/**
 * desktop-stickers.js - Isolated Desktop OS Sticker System
 * Lachlan's World (Web 2.0)
 */

(function () {
  'use strict';

  const STORAGE_KEY = 'lachlan_desktop_stickers';
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
    const toggleCheckbox = document.getElementById('settings-sticker-motion-toggle');
    if (toggleCheckbox) {
      toggleCheckbox.checked = !disabled;
    }
    const motionBtn = document.getElementById('desktop-sticker-motion-btn');
    if (motionBtn) {
      motionBtn.textContent = disabled ? 'Motion: OFF' : 'Motion: ON';
      motionBtn.setAttribute('aria-pressed', disabled ? 'false' : 'true');
    }
  }

  function toggleMotionPreference() {
    const isCurrentlyDisabled = document.documentElement.classList.contains('stickers-motion-disabled');
    const newState = isCurrentlyDisabled ? 'enabled' : 'disabled';
    try {
      localStorage.setItem(MOTION_KEY, newState);
    } catch (e) {}
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
    } catch (e) {}
  }

  function createStickerElement(stickerData, isNew) {
    const layer = document.getElementById('desktop-sticker-layer');
    if (!layer) return;

    const el = document.createElement('div');
    const animClass = stickerData.animType || resolveStickerAnimType(stickerData.src);
    el.className = 'desktop-sticker ' + animClass;
    el.id = 'desktop-placed-sticker-' + stickerData.id;
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
    img.alt = 'Desktop Sticker';
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

      newX = Math.max(0, Math.min(window.innerWidth - 60, newX));
      newY = Math.max(30, Math.min(window.innerHeight - 70, newY));

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
    const randomRotation = Math.floor(Math.random() * 16) - 8;
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
    const el = document.getElementById('desktop-placed-sticker-' + id);
    if (el) el.remove();
  }

  function clearAllDesktopStickers() {
    stickers = [];
    saveStickers();
    const layer = document.getElementById('desktop-sticker-layer');
    if (layer) layer.innerHTML = '';
  }

  function initDesktopStickers() {
    const palette = document.getElementById('desktop-sticker-palette');
    const clearBtn = document.getElementById('desktop-sticker-clear-btn');
    const recycleBin = document.getElementById('desktop-recycle-bin');

    applyMotionPreference();

    const motionBtn = document.getElementById('desktop-sticker-motion-btn');
    if (motionBtn) {
      motionBtn.addEventListener('click', toggleMotionPreference);
    }

    if (clearBtn) {
      clearBtn.addEventListener('click', function () {
        if (confirm('Clear all stickers from the desktop?')) {
          clearAllDesktopStickers();
        }
      });
    }

    if (recycleBin) {
      recycleBin.addEventListener('click', function () {
        if (stickers.length === 0) {
          alert('Recycle Bin: No stickers on the desktop to clear!');
          return;
        }
        if (confirm('Empty Recycle Bin and clear all stickers from desktop?')) {
          clearAllDesktopStickers();
        }
      });
    }

    if (palette) {
      const items = palette.querySelectorAll('.sticker-item');
      items.forEach(function (item) {
        item.addEventListener('dragstart', function (e) {
          const src = item.getAttribute('data-src');
          e.dataTransfer.setData('text/plain', src);
          e.dataTransfer.effectAllowed = 'copy';
        });

        item.addEventListener('click', function () {
          const src = item.getAttribute('data-src');
          const spawnX = Math.max(30, Math.floor(Math.random() * (window.innerWidth - 200)));
          const spawnY = Math.max(80, Math.floor(Math.random() * (window.innerHeight - 200)));
          addSticker(src, spawnX, spawnY);
        });
      });
    }

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

    stickers = loadStickers();
    stickers.forEach(function (s) {
      createStickerElement(s, false);
    });
  }

  // Mouse proximity excitation for nearby desktop stickers
  let proximityRaf = null;
  document.addEventListener('pointermove', function (e) {
    if (proximityRaf) return;
    proximityRaf = requestAnimationFrame(function () {
      proximityRaf = null;
      if (document.documentElement.classList.contains('stickers-motion-disabled')) {
        document.querySelectorAll('#desktop-sticker-layer .desktop-sticker.is-nearby').forEach(function (st) {
          st.classList.remove('is-nearby');
        });
        return;
      }
      const placedStickers = document.querySelectorAll('#desktop-sticker-layer .desktop-sticker');
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
    document.querySelectorAll('#desktop-sticker-layer .desktop-sticker.is-nearby').forEach(function (st) {
      st.classList.remove('is-nearby');
    });
  });

  // Export functions to global scope for DesktopOS integration
  window.clearDesktopStickers = clearAllDesktopStickers;
  window.applyStickerMotionPreference = applyMotionPreference;

  document.addEventListener('DOMContentLoaded', initDesktopStickers);
})();
