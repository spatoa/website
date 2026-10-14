/**
 * stickers.js - Unified Retro Sticker Engine
 * Lachlan's World (Web 2.0 & Desktop OS)
 *
 * Supports drag-and-drop stickers, rotation, deletion, subtle CSS floating animations,
 * motion accessibility preference, and isolated localStorage persistence for both
 * standard Web Portal and Desktop OS environments.
 */

(function () {
  'use strict';

  const MOTION_KEY = 'lachlan_sticker_motion';

  function resolveStickerAnimType(src) {
    if (!src) return 'anim-float';
    if (src.includes('sparkle-star') || src.includes('y2k-butterfly') || src.includes('cdr-disc') || src.includes('flip-phone')) return 'anim-shimmer';
    if (src.includes('pixel-flame') || src.includes('pocket_pet-egg') || src.includes('pocket_pet-critter') || src.includes('retro-smiley') || src.includes('reticulum-radio')) return 'anim-pulse';
    if (src.includes('notepad-made') || src.includes('xhtml-valid') || src.includes('css-valid') || src.includes('rss-feed') || src.includes('res-1024') || src.includes('ctf-flag') || src.includes('winamp-whips') || src.includes('ie-best') || src.includes('dialup-56k') || src.includes('cassette-mixtape') || src.includes('no-spyware')) return 'anim-sway';
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
    const motionBtns = document.querySelectorAll('#sticker-motion-btn, #desktop-sticker-motion-btn');
    motionBtns.forEach(function (btn) {
      btn.textContent = disabled ? 'Motion: OFF' : 'Motion: ON';
      btn.setAttribute('aria-pressed', disabled ? 'false' : 'true');
    });
  }

  function toggleMotionPreference() {
    const isCurrentlyDisabled = document.documentElement.classList.contains('stickers-motion-disabled');
    const newState = isCurrentlyDisabled ? 'enabled' : 'disabled';
    try {
      localStorage.setItem(MOTION_KEY, newState);
    } catch (e) {}
    applyMotionPreference();
  }

  window.applyStickerMotionPreference = applyMotionPreference;
  window.toggleStickerMotionPreference = toggleMotionPreference;

  /**
   * Factory to create an isolated Sticker Context
   * @param {Object} cfg - { layerId, storageKey, paletteId, clearBtnId, motionBtnId, drawerToggleId, drawerId, isDesktop }
   */
  function createStickerContext(cfg) {
    const layer = document.getElementById(cfg.layerId);
    if (!layer) return null;

    let stickers = [];
    let nextId = 1;

    function loadStickers() {
      try {
        const data = localStorage.getItem(cfg.storageKey);
        return data ? JSON.parse(data) : [];
      } catch (e) {
        return [];
      }
    }

    function saveStickers() {
      try {
        localStorage.setItem(cfg.storageKey, JSON.stringify(stickers));
      } catch (e) {}
    }

    function removeSticker(id) {
      stickers = stickers.filter(function (s) { return s.id !== id; });
      saveStickers();
      const el = layer.querySelector(`[data-sticker-id="${id}"]`);
      if (el) {
        el.classList.add('is-spawning');
        setTimeout(function () { el.remove(); }, 180);
      }
    }

    function createStickerElement(stickerData, isNew) {
      const el = document.createElement('div');
      const animClass = stickerData.animType || resolveStickerAnimType(stickerData.src);
      el.className = 'desktop-sticker ' + animClass;
      el.setAttribute('data-sticker-id', stickerData.id);
      el.style.left = stickerData.x + 'px';
      el.style.top = stickerData.y + 'px';
      if (stickerData.rotation) {
        el.style.transform = 'rotate(' + stickerData.rotation + 'deg)';
      }

      const seed = (typeof stickerData.id === 'string' ? stickerData.id.charCodeAt(stickerData.id.length - 1) : Math.floor(Math.random() * 10)) || 0;
      const delayOffset = ((seed % 10) * 0.4).toFixed(2);
      const duration = (3.2 + (seed % 5) * 0.35).toFixed(2);
      el.style.setProperty('--anim-delay', '-' + delayOffset + 's');
      el.style.setProperty('--anim-duration', duration + 's');

      if (isNew) {
        el.classList.add('is-spawned');
        setTimeout(function () { el.classList.remove('is-spawned'); }, 260);
      }

      const img = document.createElement('img');
      img.src = stickerData.src;
      img.alt = 'Sticker';
      img.draggable = false;

      const delBtn = document.createElement('button');
      delBtn.className = 'sticker-delete-btn';
      delBtn.textContent = '×';
      delBtn.title = 'Remove Sticker';
      delBtn.setAttribute('aria-label', 'Remove Sticker');
      delBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        removeSticker(stickerData.id);
      });

      el.appendChild(img);
      el.appendChild(delBtn);

      // Dragging on canvas
      let isDragging = false;
      let startX = 0;
      let startY = 0;
      let initialLeft = 0;
      let initialTop = 0;

      el.addEventListener('pointerdown', function (e) {
        if (e.target === delBtn) return;
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        initialLeft = el.offsetLeft;
        initialTop = el.offsetTop;
        el.setPointerCapture(e.pointerId);
        el.classList.add('dragging');
        e.preventDefault();
      });

      el.addEventListener('pointermove', function (e) {
        if (!isDragging) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        const newLeft = Math.max(0, Math.min(window.innerWidth - 60, initialLeft + dx));
        const newTop = Math.max(0, Math.min(window.innerHeight - 60, initialTop + dy));

        el.style.left = newLeft + 'px';
        el.style.top = newTop + 'px';

        const item = stickers.find(function (s) { return s.id === stickerData.id; });
        if (item) {
          item.x = newLeft;
          item.y = newTop;
        }
      });

      function stopDrag(e) {
        if (!isDragging) return;
        isDragging = false;
        try { el.releasePointerCapture(e.pointerId); } catch (err) {}
        el.classList.remove('dragging');
        saveStickers();
      }

      el.addEventListener('pointerup', stopDrag);
      el.addEventListener('pointercancel', stopDrag);

      // Double click or right click rotates sticker 15 degrees
      el.addEventListener('dblclick', function (e) {
        e.stopPropagation();
        const item = stickers.find(function (s) { return s.id === stickerData.id; });
        if (item) {
          item.rotation = ((item.rotation || 0) + 15) % 360;
          el.style.transform = 'rotate(' + item.rotation + 'deg)';
          saveStickers();
        }
      });

      layer.appendChild(el);
      return el;
    }

    function addSticker(src, x, y, rotation) {
      const id = Date.now().toString(36) + '-' + nextId++;
      const rot = typeof rotation === 'number' ? rotation : (Math.floor(Math.random() * 24) - 12);
      const data = {
        id: id,
        src: src,
        x: Math.max(10, Math.min(window.innerWidth - 80, x)),
        y: Math.max(10, Math.min(window.innerHeight - 80, y)),
        rotation: rot,
        animType: resolveStickerAnimType(src)
      };
      stickers.push(data);
      saveStickers();
      createStickerElement(data, true);
    }

    function clearAll() {
      stickers = [];
      saveStickers();
      layer.innerHTML = '';
    }

    // Init palette items
    const palette = document.getElementById(cfg.paletteId);
    if (palette) {
      palette.querySelectorAll('.sticker-item').forEach(function (item) {
        const src = item.getAttribute('data-src');
        if (!src) return;

        // Native HTML5 Drag and Drop
        item.addEventListener('dragstart', function (e) {
          e.dataTransfer.setData('text/plain', src);
          e.dataTransfer.setData('application/x-sticker-src', src);
          e.dataTransfer.effectAllowed = 'copy';
        });

        // Click to spawn on screen
        item.addEventListener('click', function (e) {
          e.preventDefault();
          const targetX = cfg.isDesktop
            ? Math.floor(Math.random() * (window.innerWidth - 250) + 120)
            : Math.floor(Math.random() * (window.innerWidth - 200) + 80);
          const targetY = cfg.isDesktop
            ? Math.floor(Math.random() * (window.innerHeight - 300) + 100)
            : Math.floor(Math.random() * 300 + 150);
          addSticker(src, targetX, targetY);
        });
      });
    }

    // Window Drag Over & Drop target
    window.addEventListener('dragover', function (e) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    });

    window.addEventListener('drop', function (e) {
      e.preventDefault();
      const src = e.dataTransfer.getData('application/x-sticker-src') || e.dataTransfer.getData('text/plain');
      if (src && (src.includes('.svg') || src.includes('stickers/'))) {
        addSticker(src, e.clientX - 35, e.clientY - 35);
      }
    });

    // Clear Button
    if (cfg.clearBtnId) {
      const clearBtn = document.getElementById(cfg.clearBtnId);
      if (clearBtn) {
        clearBtn.addEventListener('click', function () {
          if (confirm('Clear all stickers from this canvas?')) {
            clearAll();
          }
        });
      }
    }

    // Motion Button
    if (cfg.motionBtnId) {
      const motionBtn = document.getElementById(cfg.motionBtnId);
      if (motionBtn) {
        motionBtn.addEventListener('click', toggleMotionPreference);
      }
    }

    // Drawer Toggle (for Web Portal drawer)
    if (cfg.drawerToggleId && cfg.drawerId) {
      const drawer = document.getElementById(cfg.drawerId);
      const toggle = document.getElementById(cfg.drawerToggleId);
      const DRAWER_KEY = 'lachlan_grid_sticker_drawer_open';

      function setDrawerOpen(open) {
        if (!drawer || !toggle) return;
        drawer.classList.toggle('collapsed', !open);
        toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
        const arrow = document.getElementById('sticker-tab-arrow');
        if (arrow) arrow.textContent = open ? '▼' : '▲';
        try { localStorage.setItem(DRAWER_KEY, open ? 'true' : 'false'); } catch (e) {}
      }

      if (toggle) {
        toggle.addEventListener('click', function () {
          const isCollapsed = drawer.classList.contains('collapsed');
          setDrawerOpen(isCollapsed);
        });
        const savedOpen = localStorage.getItem(DRAWER_KEY) === 'true';
        setDrawerOpen(savedOpen);
      }
    }

    // Load initial placed stickers
    stickers = loadStickers();
    stickers.forEach(function (data) {
      createStickerElement(data, false);
    });

    return {
      addSticker: addSticker,
      clearAll: clearAll,
      getStickers: function () { return stickers; }
    };
  }

  // --- Boot Sticker Engines on DOM Ready ---
  function init() {
    applyMotionPreference();

    // 1. Grid Mode Sticker Context
    const gridContext = createStickerContext({
      layerId: 'sticker-canvas-layer',
      storageKey: 'lachlan_grid_stickers',
      paletteId: 'sticker-palette',
      clearBtnId: 'sticker-clear-btn',
      motionBtnId: 'sticker-motion-btn',
      drawerToggleId: 'sticker-drawer-toggle',
      drawerId: 'sticker-book-drawer',
      isDesktop: false
    });

    // 2. Desktop OS Sticker Context
    const desktopContext = createStickerContext({
      layerId: 'desktop-sticker-layer',
      storageKey: 'lachlan_desktop_stickers',
      paletteId: 'desktop-sticker-palette',
      clearBtnId: 'desktop-sticker-clear-btn',
      motionBtnId: 'desktop-sticker-motion-btn',
      isDesktop: true
    });

    if (desktopContext) {
      window.clearDesktopStickers = function () {
        desktopContext.clearAll();
      };
    }

    window.StickerEngine = {
      grid: gridContext,
      desktop: desktopContext,
      toggleMotionPreference: toggleMotionPreference
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
