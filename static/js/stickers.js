/**
 * @module StickerEngine
 * @description Unified Retro Sticker Physics & Placement Engine.
 * Supports dragging, rotating, deleting, floating CSS animations, motion accessibility preference,
 * and isolated persistence across both Web Portal and Desktop OS environments.
 *
 * @dependencies
 * - DOM: .sticker-item, #sticker-tray, #desktop-sticker-layer, #sticker-canvas-grid
 *
 * @exports
 * - window.clearDesktopStickers
 * - window.applyStickerMotionPreference
 * - window.toggleStickerMotionPreference
 * - window.StickerEngine
 *
 * @storageKeys
 * - lachlan_grid_stickers (JSON array of portal stickers)
 * - lachlan_desktop_stickers (JSON array of desktop OS stickers)
 * - lachlan_stickers (Legacy portal stickers mirror)
 * - lachlan_sticker_motion ("enabled" | "disabled")
 * - lachlan_grid_sticker_drawer_open ("true" | "false")
 */

(function () {
  'use strict';

  const MOTION_KEY = 'lachlan_sticker_motion';
  const LEGACY_GRID_KEY = 'lachlan_stickers';

  function safeGetItem(key) {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      return null;
    }
  }

  function safeSetItem(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch (e) {}
  }

  function sanitizeStickerSrc(rawSrc) {
    if (!rawSrc || typeof rawSrc !== 'string') return null;
    const trimmed = rawSrc.trim();
    if (/^(javascript|data|vbscript):/i.test(trimmed)) return null;
    try {
      const parsed = new URL(trimmed, window.location.origin);
      if (parsed.hostname === 'www.lachlans.world' || parsed.hostname === 'lachlans.world') {
        return parsed.pathname;
      }
      if (parsed.origin === window.location.origin) {
        return parsed.pathname;
      }
      if ((parsed.protocol === 'http:' || parsed.protocol === 'https:') && /\.(svg|png|gif|webp)$/i.test(parsed.pathname)) {
        return parsed.href;
      }
    } catch (e) {}
    if (trimmed.includes('stickers/') && /\.(svg|png|gif|webp)$/i.test(trimmed)) {
      return trimmed.replace(/["'<>\\]/g, '');
    }
    return null;
  }

  function resolveStickerAnimType(src) {
    if (!src) return 'anim-float';
    if (src.includes('sparkle-star') || src.includes('y2k-butterfly') || src.includes('cdr-disc') || src.includes('flip-phone')) return 'anim-shimmer';
    if (src.includes('pixel-flame') || src.includes('retro-smiley') || src.includes('reticulum-radio')) return 'anim-pulse';
    if (src.includes('notepad-made') || src.includes('xhtml-valid') || src.includes('css-valid') || src.includes('rss-feed') || src.includes('res-1024') || src.includes('ctf-flag') || src.includes('winamp-whips') || src.includes('ie-best') || src.includes('dialup-56k') || src.includes('cassette-mixtape') || src.includes('no-spyware')) return 'anim-sway';
    return 'anim-float';
  }

  function applyMotionPreference() {
    const motionPref = safeGetItem(MOTION_KEY);
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
    safeSetItem(MOTION_KEY, newState);
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

    function sanitizeStickerRecord(raw) {
      if (!raw || typeof raw !== 'object') return null;
      const safeSrc = sanitizeStickerSrc(raw.src);
      if (!safeSrc) return null;
      const x = (typeof raw.x === 'number' && isFinite(raw.x)) ? Math.max(0, Math.min(10000, Math.round(raw.x))) : 100;
      const y = (typeof raw.y === 'number' && isFinite(raw.y)) ? Math.max(0, Math.min(50000, Math.round(raw.y))) : 100;
      const rotation = (typeof raw.rotation === 'number' && isFinite(raw.rotation)) ? (Math.round(raw.rotation) % 360) : 0;
      const id = (typeof raw.id === 'string' && raw.id.length > 0 && raw.id.length < 64)
        ? raw.id.replace(/[^a-zA-Z0-9_-]/g, '')
        : (Date.now().toString(36) + '-' + nextId++);
      return {
        id: id,
        src: safeSrc,
        x: x,
        y: y,
        rotation: rotation,
        animType: resolveStickerAnimType(safeSrc)
      };
    }

    function loadStickers() {
      try {
        let data = safeGetItem(cfg.storageKey);
        if (!data && !cfg.isDesktop) {
          data = safeGetItem(LEGACY_GRID_KEY);
        }
        if (!data) return [];
        const parsed = JSON.parse(data);
        if (!Array.isArray(parsed)) return [];
        const valid = [];
        for (let i = 0; i < parsed.length; i++) {
          const clean = sanitizeStickerRecord(parsed[i]);
          if (clean) valid.push(clean);
        }
        return valid;
      } catch (e) {
        return [];
      }
    }

    function saveStickers() {
      const serialized = JSON.stringify(stickers);
      safeSetItem(cfg.storageKey, serialized);
      if (!cfg.isDesktop) {
        safeSetItem(LEGACY_GRID_KEY, serialized);
      }
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
      el.setAttribute('tabindex', '0');
      el.setAttribute('role', 'group');
      const stickerName = (stickerData.src.split('/').pop() || 'Sticker').replace('.svg', '');
      el.setAttribute('aria-label', `Placed sticker: ${stickerName}`);
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
      img.alt = stickerName + ' sticker';
      img.draggable = false;

      const delBtn = document.createElement('button');
      delBtn.type = 'button';
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

      // Dragging on canvas (Hybrid Pointer / Touch / Mouse support)
      let isDragging = false;
      let startX = 0;
      let startY = 0;
      let initialLeft = 0;
      let initialTop = 0;

      function getPageCoord(clientVal, scrollVal, pageVal) {
        return (typeof pageVal === 'number' && isFinite(pageVal)) ? pageVal : (clientVal + (scrollVal || 0));
      }

      function beginDrag(clientX, clientY, pointerId, pageX, pageY) {
        isDragging = true;
        startX = getPageCoord(clientX, window.scrollX, pageX);
        startY = getPageCoord(clientY, window.scrollY, pageY);
        initialLeft = el.offsetLeft;
        initialTop = el.offsetTop;
        if (pointerId !== undefined && typeof el.setPointerCapture === 'function') {
          try { el.setPointerCapture(pointerId); } catch (err) {}
        }
        el.classList.add('dragging', 'is-dragging', 'sticker-selected');
      }

      function moveDrag(clientX, clientY, pageX, pageY) {
        if (!isDragging) return;
        const curX = getPageCoord(clientX, window.scrollX, pageX);
        const curY = getPageCoord(clientY, window.scrollY, pageY);
        const dx = curX - startX;
        const dy = curY - startY;
        const maxLeft = Math.max(0, (layer.clientWidth || window.innerWidth) - 60);
        const maxTop = Math.max(0, (layer.offsetHeight || document.documentElement.scrollHeight || window.innerHeight) - 60);
        const newLeft = Math.max(0, Math.min(maxLeft, initialLeft + dx));
        const newTop = Math.max(0, Math.min(maxTop, initialTop + dy));

        el.style.left = newLeft + 'px';
        el.style.top = newTop + 'px';

        const item = stickers.find(function (s) { return s.id === stickerData.id; });
        if (item) {
          item.x = newLeft;
          item.y = newTop;
        }
      }

      function endDrag(pointerId) {
        if (!isDragging) return;
        isDragging = false;
        if (pointerId !== undefined && typeof el.releasePointerCapture === 'function') {
          try { el.releasePointerCapture(pointerId); } catch (err) {}
        }
        el.classList.remove('dragging', 'is-dragging');
        saveStickers();
      }

      if ('PointerEvent' in window) {
        el.addEventListener('pointerdown', function (e) {
          if (e.target === delBtn) return;
          beginDrag(e.clientX, e.clientY, e.pointerId, e.pageX, e.pageY);
          e.preventDefault();
        });
        el.addEventListener('pointermove', function (e) {
          moveDrag(e.clientX, e.clientY, e.pageX, e.pageY);
        });
        el.addEventListener('pointerup', function (e) {
          endDrag(e.pointerId);
        });
        el.addEventListener('pointercancel', function (e) {
          endDrag(e.pointerId);
        });
      } else {
        el.addEventListener('mousedown', function (e) {
          if (e.target === delBtn) return;
          beginDrag(e.clientX, e.clientY, undefined, e.pageX, e.pageY);
          e.preventDefault();
        });
        window.addEventListener('mousemove', function (e) {
          moveDrag(e.clientX, e.clientY, e.pageX, e.pageY);
        });
        window.addEventListener('mouseup', function () {
          endDrag();
        });
        el.addEventListener('touchstart', function (e) {
          if (e.target === delBtn || e.touches.length === 0) return;
          beginDrag(e.touches[0].clientX, e.touches[0].clientY, undefined, e.touches[0].pageX, e.touches[0].pageY);
          e.preventDefault();
        }, { passive: false });
        el.addEventListener('touchmove', function (e) {
          if (!isDragging || e.touches.length === 0) return;
          moveDrag(e.touches[0].clientX, e.touches[0].clientY, e.touches[0].pageX, e.touches[0].pageY);
          e.preventDefault();
        }, { passive: false });
        el.addEventListener('touchend', function () {
          endDrag();
        });
      }

      function rotateSticker() {
        const item = stickers.find(function (s) { return s.id === stickerData.id; });
        if (item) {
          item.rotation = ((item.rotation || 0) + 15) % 360;
          el.style.transform = 'rotate(' + item.rotation + 'deg)';
          saveStickers();
        }
      }

      // Double click rotates sticker 15 degrees
      el.addEventListener('dblclick', function (e) {
        e.stopPropagation();
        rotateSticker();
      });

      // Keyboard navigation on placed sticker
      el.addEventListener('keydown', function (e) {
        const item = stickers.find(function (s) { return s.id === stickerData.id; });
        if (!item) return;
        const step = e.shiftKey ? 20 : 8;
        if (e.key === 'Delete' || e.key === 'Backspace') {
          e.preventDefault();
          removeSticker(stickerData.id);
        } else if (e.key === 'r' || e.key === 'R') {
          e.preventDefault();
          rotateSticker();
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          item.x = Math.max(0, item.x - step);
          el.style.left = item.x + 'px';
          saveStickers();
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          const maxLeft = Math.max(0, (layer.clientWidth || window.innerWidth) - 60);
          item.x = Math.min(maxLeft, item.x + step);
          el.style.left = item.x + 'px';
          saveStickers();
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          item.y = Math.max(0, item.y - step);
          el.style.top = item.y + 'px';
          saveStickers();
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          const maxTop = Math.max(0, (layer.offsetHeight || document.documentElement.scrollHeight || window.innerHeight) - 60);
          item.y = Math.min(maxTop, item.y + step);
          el.style.top = item.y + 'px';
          saveStickers();
        }
      });

      layer.appendChild(el);
      return el;
    }

    function addSticker(rawSrc, x, y, rotation) {
      const safeSrc = sanitizeStickerSrc(rawSrc);
      if (!safeSrc) return null;
      const id = Date.now().toString(36) + '-' + nextId++;
      const rot = (typeof rotation === 'number' && isFinite(rotation)) ? rotation : (Math.floor(Math.random() * 24) - 12);
      const maxX = Math.max(20, (layer.clientWidth || window.innerWidth) - 80);
      const maxY = Math.max(20, (layer.offsetHeight || document.documentElement.scrollHeight || window.innerHeight) - 80);
      const data = {
        id: id,
        src: safeSrc,
        x: Math.max(10, Math.min(maxX, isFinite(x) ? x : 120)),
        y: Math.max(10, Math.min(maxY, isFinite(y) ? y : 120)),
        rotation: rot,
        animType: resolveStickerAnimType(safeSrc)
      };
      stickers.push(data);
      saveStickers();
      return createStickerElement(data, true);
    }

    function clearAll() {
      stickers = [];
      saveStickers();
      layer.replaceChildren();
    }

    function spawnDefaultPosition(src) {
      const availW = Math.max(160, (layer.clientWidth || window.innerWidth) - 250);
      const availH = Math.max(160, window.innerHeight - 300);
      const scrollY = window.scrollY || window.pageYOffset || 0;
      const targetX = cfg.isDesktop
        ? Math.floor(Math.random() * availW + 100)
        : Math.floor(Math.random() * Math.max(100, (layer.clientWidth || window.innerWidth) - 200) + 60);
      const targetY = cfg.isDesktop
        ? Math.floor(Math.random() * availH + 80)
        : Math.floor(scrollY + Math.random() * 260 + 100);
      addSticker(src, targetX, targetY);
    }

    // Init palette items
    const palette = document.getElementById(cfg.paletteId);
    if (palette) {
      palette.querySelectorAll('.sticker-item').forEach(function (item) {
        const src = item.getAttribute('data-src');
        if (!src) return;

        // Native HTML5 Drag and Drop
        item.addEventListener('dragstart', function (e) {
          if (e.dataTransfer) {
            e.dataTransfer.setData('text/plain', src);
            e.dataTransfer.setData('application/x-sticker-src', src);
            e.dataTransfer.effectAllowed = 'copy';
          }
        });

        // Click / Tap to spawn on screen
        item.addEventListener('click', function (e) {
          e.preventDefault();
          spawnDefaultPosition(src);
        });

        // Keyboard Enter / Space to spawn on screen
        item.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            spawnDefaultPosition(src);
          }
        });
      });
    }

    // Window Drag Over & Drop target
    window.addEventListener('dragover', function (e) {
      e.preventDefault();
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'copy';
      }
    });

    window.addEventListener('drop', function (e) {
      e.preventDefault();
      if (!e.dataTransfer) return;
      const src = e.dataTransfer.getData('application/x-sticker-src') || e.dataTransfer.getData('text/plain');
      if (src && (src.includes('.svg') || src.includes('stickers/'))) {
        const rect = layer.getBoundingClientRect();
        const dropX = e.clientX - rect.left - 35;
        const dropY = e.clientY - rect.top - 35;
        addSticker(src, dropX, dropY);
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
        safeSetItem(DRAWER_KEY, open ? 'true' : 'false');
      }

      if (toggle && drawer) {
        toggle.addEventListener('click', function () {
          const isCollapsed = drawer.classList.contains('collapsed');
          setDrawerOpen(isCollapsed);
        });
        const savedOpen = safeGetItem(DRAWER_KEY) === 'true';
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
