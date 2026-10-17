/**
 * @module DesktopOS
 * @description Extensible Mid-2000s Web OS Shell, Window Manager, and Integrated Desktop Applications.
 * Dedicated to Lachlan's World Desktop OS (/desktop/).
 *
 * Implements a robust DesktopOS App Registry:
 * - Hybrid activation logic combining window.matchMedia viewport checks with pointer/touch input support
 * - Clean mobile isolation & dynamic resize teardown/re-initialization without listener or timer leaks
 * - Automatically discovers apps defined in HTML templates (.desktop-window with data-app-*)
 * - Dynamically renders Desktop Shortcut Icons and Start Menu Programs using safe DOM methods
 * - Provides programmatic registration API: DesktopOS.registerApp() & DesktopOS.unregisterApp()
 * - Standardizes draggable window chrome with Minimize and Close controls for mouse, touch, and pen
 * - Handles window lifecycles (pausing screensaver canvas & audio on close or mobile teardown)
 * - Rich File Explorer with live search dropdown pane, folder navigation, and column sorting
 * - Dedicated Display Properties & Settings App (Settings.exe)
 *
 * @dependencies
 * - DOM: .desktop-window, #desktop-viewport, #taskbar-tasks, #desktop-start-menu, etc.
 * - window.switchSiteTheme (static/js/theme-switcher.js)
 * - window.stopMusicPlayback (static/js/music-player.js)
 * - window.stopScreensaver / window.startScreensaver (static/js/screensaver.js)
 * - window.clearDesktopStickers (static/js/stickers.js)
 *
 * @exports
 * - window.DesktopOS
 * - window.openDesktopWindow
 * - window.closeDesktopWindow
 * - window.minimizeDesktopWindow
 * - window.openDesktopArticle
 *
 * @storageKeys
 * - lachlan_desktop_window_positions (JSON Object mapping appId -> { x, y })
 * - lachlan_window_states (Legacy window positions mirror)
 * - lachlan_desktop_mode ("true" | "false")
 * - lachlan_custom_wallpaper (string data URL or path)
 * - lachlan_custom_wallpaper_fit ("center" | "tile" | "stretch")
 * - lachlan_sticker_motion ("enabled" | "disabled")
 *
 * ============================================================================
 * TABLE OF CONTENTS:
 * 1. Storage & Persistence Engine (Safe localStorage helpers & position state)
 * 2. Capability & Viewport Engine (Hybrid pointer, touch, and media-query checks)
 * 3. System Shell Utilities (System tray clock, keyboard activation helper)
 * 4. DesktopOS Core Controller & Window Manager (Registration, Drag, Chrome, Z-Index)
 * 5. Desktop Shell Interface (Show Desktop toggle, desktop shortcuts, taskbar)
 * 6. Application: Blog Reader (initBlogReader & article switching)
 * 7. Application: File Explorer (Virtual filesystem, tree navigation, search, sorting)
 * 8. Application: Start Menu & System Tray (initStartMenu, initShowDesktopBtn)
 * 9. Application: Settings & Display Properties (initSettingsApp)
 * 10. Viewport Synchronization & Boot (syncViewportMode, boot lifecycle)
 * ============================================================================
 */

(function () {
  'use strict';

  // Only run inside the dedicated Desktop OS environment
  if (!document.body || !document.body.classList.contains('desktop-os-page')) {
    return;
  }

  const POS_KEY = 'lachlan_desktop_window_positions';
  const LEGACY_STATE_KEY = 'lachlan_window_states';
  const DESKTOP_MODE_KEY = 'lachlan_desktop_mode';
  const DESKTOP_BREAKPOINT_QUERY = '(min-width: 768px)';

  let highestZ = 500;
  let windowPositions = {};
  let clockIntervalId = null;
  let sessionController = null;
  let initialBlogFileNodes = null;

  // ==========================================================================
  // [01] Storage & Persistence Engine (Safe LocalStorage & Position Cache)
  // ==========================================================================
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
      return true;
    } catch (e) {
      return false;
    }
  }

  function safeRemoveItem(key) {
    try {
      localStorage.removeItem(key);
    } catch (e) {}
  }

  function loadWindowPositions() {
    try {
      const raw = safeGetItem(POS_KEY) || safeGetItem(LEGACY_STATE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return {};
      }
      const clean = {};
      Object.keys(parsed).forEach(function (id) {
        const entry = parsed[id];
        if (entry && typeof entry === 'object' && typeof entry.x === 'number' && typeof entry.y === 'number' && isFinite(entry.x) && isFinite(entry.y)) {
          clean[id] = {
            x: Math.round(entry.x),
            y: Math.round(entry.y)
          };
        }
      });
      return clean;
    } catch (e) {
      return {};
    }
  }

  function saveWindowPositions() {
    const serialized = JSON.stringify(windowPositions);
    safeSetItem(POS_KEY, serialized);
    safeSetItem(LEGACY_STATE_KEY, serialized);
  }

  /**
   * Hybrid capability check:
   * Combines viewport dimension checks via window.matchMedia('(min-width: 768px)')
   * with hybrid input support (pointer: fine, pointer: coarse, any-pointer, or touch/mouse events)
   * so traditional desktops, large-screen tablets, and touch-enabled laptops all activate cleanly,
   * while small mobile viewports (< 768px) isolate and bypass the desktop window manager.
   */
  // ==========================================================================
  // [02] Capability & Viewport Engine (Hybrid Pointer & Media Query Checks)
  // ==========================================================================
  function checkDesktopCapability() {
    if (typeof window.matchMedia !== 'function') {
      return window.innerWidth >= 768;
    }
    const viewportMatches = window.matchMedia(DESKTOP_BREAKPOINT_QUERY).matches;
    if (!viewportMatches) {
      return false;
    }
    const finePointer = window.matchMedia('(any-pointer: fine), (pointer: fine)').matches;
    const coarsePointer = window.matchMedia('(any-pointer: coarse), (pointer: coarse)').matches;
    const hoverCapable = window.matchMedia('(any-hover: hover), (hover: hover)').matches;
    const hasInputSupport = finePointer || coarsePointer || hoverCapable ||
      ('PointerEvent' in window) || ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
    return Boolean(viewportMatches && hasInputSupport);
  }

  // --- Clock updater ---
  // ==========================================================================
  // [03] System Shell Utilities (Clock, Keyboards, Accessibility)
  // ==========================================================================
  function updateClock() {
    const clock = document.getElementById('taskbar-clock');
    if (!clock) return;
    const now = new Date();
    let hours = now.getHours();
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    clock.textContent = hours + ':' + minutes + ' ' + ampm;
  }

  // Helper to attach Enter + Space keyboard activation to role="button"/menuitem/treeitem elements
  function bindKeyboardActivation(el, handler, signal) {
    if (!el) return;
    const opts = signal ? { signal: signal } : undefined;
    el.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handler(e);
      }
    }, opts);
  }

  // --- DesktopOS Architecture ---
  // ==========================================================================
  // [04] DesktopOS Core Controller & Window Manager (Drag, Chrome, Layering)
  // ==========================================================================
  const DesktopOS = {
    apps: new Map(),
    isActive: false,

    checkCapability: checkDesktopCapability,

    /**
     * Register a new application into Desktop OS
     * @param {Object} appConfig - { id, title, icon, defaultX, defaultY, panel, shortcut, startMenu, onClose, onOpen }
     */
    registerApp: function (appConfig) {
      if (!appConfig || !appConfig.id) return null;
      const id = String(appConfig.id);
      const panel = appConfig.panel || document.getElementById(id);
      if (!panel) return null;

      const app = {
        id: id,
        title: appConfig.title || this._extractTitle(panel, id),
        icon: appConfig.icon || this._extractIcon(panel, id),
        defaultX: typeof appConfig.defaultX === 'number' && !isNaN(appConfig.defaultX) ? appConfig.defaultX : (120 + this.apps.size * 30),
        defaultY: typeof appConfig.defaultY === 'number' && !isNaN(appConfig.defaultY) ? appConfig.defaultY : (60 + this.apps.size * 25),
        panel: panel,
        shortcut: appConfig.shortcut !== false,
        startMenu: appConfig.startMenu !== false,
        onClose: appConfig.onClose || null,
        onOpen: appConfig.onOpen || null
      };

      this.apps.set(id, app);

      if (!this.isActive) {
        return app;
      }

      // Setup window UI & controls
      this._setupWindowChrome(app);
      this._positionWindow(app);
      this._setupWindowDrag(app);

      // Start all windows closed by default on clean desktop launch
      panel.classList.add('desktop-window', 'window-closed');
      panel.classList.remove('window-focused', 'window-minimized');

      // Click/tap on window focuses it
      const signal = sessionController ? sessionController.signal : undefined;
      panel.addEventListener('pointerdown', function () {
        if (DesktopOS.isActive) {
          DesktopOS.focusApp(id);
        }
      }, signal ? { signal: signal } : undefined);

      // Update UI representations
      this.renderDesktopIcons();
      this.renderStartMenu();

      return app;
    },

    /**
     * Remove an application from Desktop OS
     * @param {string} appId
     */
    unregisterApp: function (appId) {
      const app = this.apps.get(appId);
      if (!app) return;

      this.closeApp(appId);

      const icon = document.querySelector(`.desktop-icon[data-target="${appId}"]`);
      if (icon) icon.remove();

      const startItem = document.querySelector(`.start-menu-item[data-target="${appId}"]`);
      if (startItem) startItem.remove();

      this.apps.delete(appId);
    },

    getApp: function (appId) {
      return this.apps.get(appId);
    },

    /**
     * Open an application window
     */
    openApp: function (appId) {
      if (!this.isActive) return;
      const app = this.apps.get(appId);
      const panel = app ? app.panel : document.getElementById(appId);
      if (!panel) return;

      panel.classList.remove('window-closed', 'window-minimized');
      this.focusApp(appId);

      // Lifecycle hook on open
      if (app && typeof app.onOpen === 'function') {
        app.onOpen();
      } else if (appId === 'interactive-element' && typeof window.startScreensaver === 'function') {
        window.startScreensaver();
      }
    },

    /**
     * Focus an application window (brings to front)
     */
    focusApp: function (appId) {
      if (!this.isActive) return;
      const app = this.apps.get(appId);
      const panel = app ? app.panel : document.getElementById(appId);
      if (!panel) return;

      // Blur other windows
      document.querySelectorAll('.desktop-windows-layer .panel').forEach(function (p) {
        p.classList.remove('window-focused');
      });

      panel.classList.remove('window-closed', 'window-minimized');
      panel.classList.add('window-focused');
      panel.style.zIndex = ++highestZ;

      // Update taskbar button
      const taskBtn = this._createTaskbarButton(appId);
      if (taskBtn) {
        document.querySelectorAll('.taskbar-item').forEach(function (b) {
          b.classList.remove('active');
          b.setAttribute('aria-selected', 'false');
        });
        taskBtn.classList.add('active');
        taskBtn.setAttribute('aria-selected', 'true');
      }
    },

    /**
     * Minimize an application window
     */
    minimizeApp: function (appId) {
      if (!this.isActive) return;
      const app = this.apps.get(appId);
      const panel = app ? app.panel : document.getElementById(appId);
      if (!panel) return;

      panel.classList.add('window-minimized');
      panel.classList.remove('window-focused');

      const taskBtn = document.getElementById('task-btn-' + appId);
      if (taskBtn) {
        taskBtn.classList.remove('active');
        taskBtn.setAttribute('aria-selected', 'false');
      }

      if (appId === 'interactive-element' && typeof window.stopScreensaver === 'function') {
        window.stopScreensaver();
      }

      // Focus topmost remaining visible window
      this._focusTopmost();
    },

    /**
     * Close an application window
     */
    closeApp: function (appId) {
      const app = this.apps.get(appId);
      const panel = app ? app.panel : document.getElementById(appId);
      if (!panel) return;

      if (this.isActive) {
        panel.classList.add('window-closed');
      }
      panel.classList.remove('window-focused', 'window-minimized');

      this._removeTaskbarButton(appId);

      // Lifecycle hook on close
      if (app && typeof app.onClose === 'function') {
        app.onClose();
      } else {
        if (appId === 'interactive-element' && typeof window.stopScreensaver === 'function') {
          window.stopScreensaver();
        }
        if (appId === 'music-player' && typeof window.stopMusicPlayback === 'function') {
          window.stopMusicPlayback();
        }
      }

      if (this.isActive) {
        this._focusTopmost();
      }
    },

    // --- Internal Helpers ---
    _focusTopmost: function () {
      const openPanels = Array.from(document.querySelectorAll('.desktop-windows-layer .panel'))
        .filter(function (p) {
          return !p.classList.contains('window-closed') && !p.classList.contains('window-minimized');
        });
      if (openPanels.length > 0) {
        openPanels.sort(function (a, b) {
          return (parseInt(b.style.zIndex || 0, 10) - parseInt(a.style.zIndex || 0, 10));
        });
        DesktopOS.focusApp(openPanels[0].id);
      }
    },

    _extractTitle: function (panel, panelId) {
      const titleAttr = panel.getAttribute('data-app-title');
      if (titleAttr) return titleAttr;

      const header = panel.querySelector('.panel-header');
      if (header) {
        const text = header.textContent.replace(/[★\[\]_✕0-9•&;]/g, '').trim();
        if (text) return text.substring(0, 20);
      }
      return panelId;
    },

    _extractIcon: function (panel, panelId) {
      const iconAttr = panel.getAttribute('data-app-icon');
      if (iconAttr) return iconAttr;

      const iconMap = {
        'about': '☺',
        'interactive-element': '★',
        'music-player': '♫',
        'blog-reader-window': '🗏',
        'file-explorer-window': '🗀',
        'recent-posts': '🗎',
        'sticker-album-window': '★',
        'system-status': '🖵',
        'legit-software': '🖫',
        'pocket_pet-app': '☺',
        'settings-window': '⚙'
      };
      return iconMap[panelId] || '🗔';
    },

    _setupWindowChrome: function (app) {
      const panel = app.panel;
      const header = panel.querySelector('.panel-header');
      if (!header) return;

      const signal = sessionController ? sessionController.signal : undefined;
      const listenerOpts = signal ? { signal: signal } : undefined;

      // Ensure proper header title structure
      let titleContainer = header.querySelector('.panel-header-title');
      if (!titleContainer) {
        const rawText = header.textContent.trim();
        header.textContent = '';
        titleContainer = document.createElement('div');
        titleContainer.className = 'panel-header-title';

        const iconSpan = document.createElement('span');
        iconSpan.className = 'win-icon';
        iconSpan.setAttribute('aria-hidden', 'true');
        iconSpan.textContent = app.icon;

        titleContainer.appendChild(iconSpan);
        titleContainer.appendChild(document.createTextNode(' ' + (rawText || app.title)));
        header.appendChild(titleContainer);
      }

      // Check if window controls already exist
      let controls = header.querySelector('.window-controls');
      if (!controls) {
        controls = document.createElement('div');
        controls.className = 'window-controls';

        const minBtn = document.createElement('button');
        minBtn.type = 'button';
        minBtn.className = 'window-btn';
        minBtn.textContent = '_';
        minBtn.title = 'Minimize';
        minBtn.setAttribute('aria-label', `Minimize ${app.title}`);

        const closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.className = 'window-btn';
        closeBtn.textContent = '✕';
        closeBtn.title = 'Close';
        closeBtn.setAttribute('aria-label', `Close ${app.title}`);

        controls.appendChild(minBtn);
        controls.appendChild(closeBtn);
        header.appendChild(controls);
      }

      const minBtn = controls.querySelector('button[title="Minimize"], #reader-min-btn, #sticker-win-min-btn, #explorer-min-btn');
      if (minBtn) {
        minBtn.addEventListener('click', function (e) {
          e.stopPropagation();
          DesktopOS.minimizeApp(app.id);
        }, listenerOpts);
      }

      const closeBtn = controls.querySelector('button[title="Close"], #reader-close-btn, #sticker-win-close-btn, #explorer-close-btn');
      if (closeBtn) {
        closeBtn.addEventListener('click', function (e) {
          e.stopPropagation();
          DesktopOS.closeApp(app.id);
        }, listenerOpts);
      }
    },

    _positionWindow: function (app) {
      const panel = app.panel;
      const saved = windowPositions[app.id];
      let posX, posY;

      const maxX = Math.max(10, window.innerWidth - 380);
      const maxY = Math.max(40, window.innerHeight - 120);

      if (saved && typeof saved.x === 'number' && typeof saved.y === 'number' && isFinite(saved.x) && isFinite(saved.y)) {
        posX = Math.max(10, Math.min( Math.max(10, window.innerWidth - 100), saved.x));
        posY = Math.max(36, Math.min(maxY, saved.y));
      } else {
        posX = Math.max(10, Math.min(maxX, app.defaultX));
        posY = Math.max(36, Math.min(maxY, app.defaultY));
      }

      panel.style.left = posX + 'px';
      panel.style.top = posY + 'px';
      panel.style.zIndex = highestZ++;
    },

    /**
     * Hybrid Window Drag Setup:
     * Supports Pointer Events (mouse, pen, touch) with Touch/Mouse fallback
     * while preventing conflict when both input types are available.
     */
    _setupWindowDrag: function (app) {
      const panel = app.panel;
      const header = panel.querySelector('.panel-header');
      if (!header) return;

      const signal = sessionController ? sessionController.signal : undefined;
      const opts = signal ? { signal: signal } : undefined;

      let isDragging = false;
      let startX = 0;
      let startY = 0;
      let initialX = 0;
      let initialY = 0;

      function startDrag(clientX, clientY, pointerId) {
        if (!DesktopOS.isActive) return;
        isDragging = true;
        startX = clientX;
        startY = clientY;
        initialX = panel.offsetLeft;
        initialY = panel.offsetTop;
        if (pointerId !== undefined && typeof header.setPointerCapture === 'function') {
          try { header.setPointerCapture(pointerId); } catch (err) {}
        }
        DesktopOS.focusApp(app.id);
      }

      function moveDrag(clientX, clientY) {
        if (!isDragging || !DesktopOS.isActive) return;
        const dx = clientX - startX;
        const dy = clientY - startY;

        let newX = initialX + dx;
        let newY = initialY + dy;

        newX = Math.max(0, Math.min(Math.max(0, window.innerWidth - 80), newX));
        newY = Math.max(34, Math.min(Math.max(34, window.innerHeight - 70), newY));

        panel.style.left = newX + 'px';
        panel.style.top = newY + 'px';

        windowPositions[app.id] = { x: Math.round(newX), y: Math.round(newY) };
      }

      function stopDrag(pointerId) {
        if (!isDragging) return;
        isDragging = false;
        if (pointerId !== undefined && typeof header.releasePointerCapture === 'function') {
          try { header.releasePointerCapture(pointerId); } catch (err) {}
        }
        saveWindowPositions();
      }

      if ('PointerEvent' in window) {
        header.addEventListener('pointerdown', function (e) {
          if (e.target.closest('.window-controls') || e.target.closest('button')) return;
          if (e.pointerType === 'mouse' && e.button !== 0) return;
          startDrag(e.clientX, e.clientY, e.pointerId);
          e.preventDefault();
        }, opts);

        header.addEventListener('pointermove', function (e) {
          moveDrag(e.clientX, e.clientY);
        }, opts);

        header.addEventListener('pointerup', function (e) {
          stopDrag(e.pointerId);
        }, opts);

        header.addEventListener('pointercancel', function (e) {
          stopDrag(e.pointerId);
        }, opts);
      } else {
        let lastTouchTs = 0;
        header.addEventListener('touchstart', function (e) {
          if (e.target.closest('.window-controls') || e.target.closest('button')) return;
          if (e.touches.length > 0) {
            lastTouchTs = Date.now();
            startDrag(e.touches[0].clientX, e.touches[0].clientY);
            e.preventDefault();
          }
        }, signal ? { signal: signal, passive: false } : { passive: false });

        header.addEventListener('touchmove', function (e) {
          if (!isDragging || e.touches.length === 0) return;
          moveDrag(e.touches[0].clientX, e.touches[0].clientY);
          e.preventDefault();
        }, signal ? { signal: signal, passive: false } : { passive: false });

        header.addEventListener('touchend', function () {
          stopDrag();
        }, opts);

        header.addEventListener('mousedown', function (e) {
          if (Date.now() - lastTouchTs < 500) return;
          if (e.button !== 0 || e.target.closest('.window-controls') || e.target.closest('button')) return;
          startDrag(e.clientX, e.clientY);
          e.preventDefault();
        }, opts);

        window.addEventListener('mousemove', function (e) {
          moveDrag(e.clientX, e.clientY);
        }, opts);

        window.addEventListener('mouseup', function () {
          stopDrag();
        }, opts);
      }
    },

    _createTaskbarButton: function (appId) {
      const taskbarTasks = document.getElementById('taskbar-tasks');
      if (!taskbarTasks) return null;

      let taskBtn = document.getElementById('task-btn-' + appId);
      if (taskBtn) return taskBtn;

      const app = this.apps.get(appId);
      const titleText = app ? app.title : appId;
      const icon = app ? (app.icon + ' ') : '🗔 ';

      taskBtn = document.createElement('button');
      taskBtn.type = 'button';
      taskBtn.className = 'taskbar-item active';
      taskBtn.id = 'task-btn-' + appId;
      taskBtn.setAttribute('role', 'tab');
      taskBtn.setAttribute('aria-selected', 'true');
      taskBtn.setAttribute('aria-controls', appId);
      taskBtn.textContent = icon + titleText;
      taskBtn.title = titleText;

      const signal = sessionController ? sessionController.signal : undefined;
      taskBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        const panel = app ? app.panel : document.getElementById(appId);
        if (!panel) return;

        if (panel.classList.contains('window-minimized')) {
          panel.classList.remove('window-minimized');
          DesktopOS.focusApp(appId);
        } else if (panel.classList.contains('window-focused')) {
          DesktopOS.minimizeApp(appId);
        } else {
          DesktopOS.focusApp(appId);
        }
      }, signal ? { signal: signal } : undefined);

      taskbarTasks.appendChild(taskBtn);
      return taskBtn;
    },

    _removeTaskbarButton: function (appId) {
      const taskBtn = document.getElementById('task-btn-' + appId);
      if (taskBtn) {
        taskBtn.remove();
      }
    },

    /**
     * Render / Refresh Desktop Shortcut Icons
     */
    renderDesktopIcons: function () {
      const container = document.getElementById('desktop-icons');
      if (!container) return;

      const recycleBin = document.getElementById('desktop-recycle-bin');
      const signal = sessionController ? sessionController.signal : undefined;
      const opts = signal ? { signal: signal } : undefined;

      // Clear existing app icons
      container.querySelectorAll('.desktop-icon[data-target]').forEach(function (el) {
        el.remove();
      });

      // Render registered app icons
      this.apps.forEach(function (app) {
        if (!app.shortcut) return;

        const iconEl = document.createElement('div');
        iconEl.className = 'desktop-icon';
        iconEl.setAttribute('data-target', app.id);
        iconEl.setAttribute('tabindex', '0');
        iconEl.setAttribute('role', 'button');
        iconEl.setAttribute('aria-label', `Open ${app.title}`);

        const iconImg = document.createElement('div');
        iconImg.className = 'desktop-icon-img';
        iconImg.setAttribute('aria-hidden', 'true');
        iconImg.textContent = app.icon;

        const iconLabel = document.createElement('div');
        iconLabel.className = 'desktop-icon-label';
        iconLabel.textContent = app.title;

        iconEl.appendChild(iconImg);
        iconEl.appendChild(iconLabel);

        function openIt() {
          DesktopOS.openApp(app.id);
        }

        iconEl.addEventListener('click', openIt, opts);
        bindKeyboardActivation(iconEl, openIt, signal);

        if (recycleBin) {
          container.insertBefore(iconEl, recycleBin);
        } else {
          container.appendChild(iconEl);
        }
      });
    },

    /**
     * Render / Refresh Start Menu Programs list using safe DOM manipulation
     */
    renderStartMenu: function () {
      const group = document.getElementById('start-menu-apps');
      if (!group) return;

      group.replaceChildren();

      this.apps.forEach(function (app) {
        if (!app.startMenu) return;

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'start-menu-item';
        btn.setAttribute('role', 'menuitem');
        btn.setAttribute('data-action', 'open-window');
        btn.setAttribute('data-target', app.id);

        const iconSpan = document.createElement('span');
        iconSpan.className = 'start-item-icon';
        iconSpan.setAttribute('aria-hidden', 'true');
        iconSpan.textContent = app.icon;

        const labelSpan = document.createElement('span');
        labelSpan.className = 'start-item-label';
        labelSpan.textContent = app.title;

        btn.appendChild(iconSpan);
        btn.appendChild(labelSpan);

        group.appendChild(btn);
      });
    },

    /**
     * Automatically discover and register all windows inside #desktop-windows-layer
     */
    autoDiscover: function () {
      const windows = document.querySelectorAll('.desktop-windows-layer .desktop-window, .desktop-windows-layer .panel');
      const defaultPositions = {
        'about': { x: 120, y: 50 },
        'music-player': { x: 530, y: 50 },
        'interactive-element': { x: 530, y: 350 },
        'blog-reader-window': { x: 120, y: 350 },
        'file-explorer-window': { x: 260, y: 110 },
        'recent-posts': { x: 530, y: 220 },
        'sticker-album-window': { x: 300, y: 150 },
        'settings-window': { x: 360, y: 120 },
        'system-status': { x: 920, y: 50 },
        'pocket_pet-app': { x: 480, y: 180 },
        'legit-software': { x: 520, y: 240 }
      };

      windows.forEach(function (panel) {
        const id = panel.getAttribute('data-app-id') || panel.id;
        if (!id) return;

        const title = panel.getAttribute('data-app-title') || DesktopOS._extractTitle(panel, id);
        const icon = panel.getAttribute('data-app-icon') || DesktopOS._extractIcon(panel, id);

        const defCoords = defaultPositions[id] || { x: 120, y: 50 };
        const defaultX = panel.hasAttribute('data-default-x') ? parseInt(panel.getAttribute('data-default-x'), 10) : defCoords.x;
        const defaultY = panel.hasAttribute('data-default-y') ? parseInt(panel.getAttribute('data-default-y'), 10) : defCoords.y;

        DesktopOS.registerApp({
          id: id,
          title: title,
          icon: icon,
          defaultX: defaultX,
          defaultY: defaultY,
          panel: panel
        });
      });
    },

    /**
     * Activate Desktop Mode (when hybrid capability check passes)
     */
    activate: function () {
      if (this.isActive) return;
      this.isActive = true;

      if (sessionController) {
        sessionController.abort();
      }
      sessionController = new AbortController();
      const signal = sessionController.signal;

      document.body.classList.add('mode-desktop');
      document.body.classList.remove('desktop-mobile-isolated');
      safeSetItem(DESKTOP_MODE_KEY, 'true');

      windowPositions = loadWindowPositions();

      // Start clock interval cleanly
      if (clockIntervalId) {
        clearInterval(clockIntervalId);
      }
      updateClock();
      clockIntervalId = setInterval(updateClock, 1000);

      // Pause screensaver initially since Game_Player.exe starts closed on desktop launch
      if (typeof window.stopScreensaver === 'function') {
        window.stopScreensaver();
      }

      this.apps.clear();
      this.autoDiscover();

      // Wire Recycle Bin click + keyboard
      const recycleBin = document.getElementById('desktop-recycle-bin');
      if (recycleBin) {
        const emptyTrash = function () {
          if (confirm('Empty Recycle Bin? This will clear all stickers placed on your desktop wallpaper.')) {
            if (typeof window.clearDesktopStickers === 'function') {
              window.clearDesktopStickers();
            }
          }
        };
        recycleBin.addEventListener('click', emptyTrash, { signal: signal });
        bindKeyboardActivation(recycleBin, emptyTrash, signal);
      }

      initBlogReader(signal);
      initFileExplorer(signal);
      initShowDesktopBtn(signal);
      initStartMenu(signal);
      initSettingsApp(signal);

      // Delegated window close handler for dialog buttons
      document.addEventListener('click', function (e) {
        const closeBtn = e.target && typeof e.target.closest === 'function' && e.target.closest('[data-window-close]');
        if (closeBtn) {
          const appId = closeBtn.getAttribute('data-window-close');
          if (appId) DesktopOS.closeApp(appId);
        }
      }, { signal: signal });
    },

    /**
     * Deactivate / Isolate Desktop Mode on small mobile viewports (< 768px):
     * Cleanly tears down DOM listeners, clock interval, and background animations/audio.
     */
    deactivate: function () {
      if (sessionController) {
        sessionController.abort();
        sessionController = null;
      }
      if (clockIntervalId) {
        clearInterval(clockIntervalId);
        clockIntervalId = null;
      }

      if (typeof window.stopScreensaver === 'function') {
        window.stopScreensaver();
      }
      if (typeof window.stopMusicPlayback === 'function') {
        window.stopMusicPlayback();
      }

      this.isActive = false;
      document.body.classList.remove('mode-desktop');
      document.body.classList.add('desktop-mobile-isolated');
      safeSetItem(DESKTOP_MODE_KEY, 'false');

      // Remove dynamic taskbar buttons and desktop shortcut icons
      const taskbarTasks = document.getElementById('taskbar-tasks');
      if (taskbarTasks) {
        taskbarTasks.replaceChildren();
      }
      const iconsContainer = document.getElementById('desktop-icons');
      if (iconsContainer) {
        iconsContainer.querySelectorAll('.desktop-icon[data-target]').forEach(function (el) {
          el.remove();
        });
      }
      const startMenu = document.getElementById('desktop-start-menu');
      if (startMenu) {
        startMenu.setAttribute('hidden', '');
      }
      const startBtn = document.getElementById('start-menu-btn');
      if (startBtn) {
        startBtn.setAttribute('aria-expanded', 'false');
        startBtn.classList.remove('active');
      }

      // Clean inline positioning and closed/minimized states so mobile layout stacks cleanly
      document.querySelectorAll('.desktop-windows-layer .panel').forEach(function (panel) {
        panel.classList.remove('window-closed', 'window-minimized', 'window-focused');
        panel.style.left = '';
        panel.style.top = '';
        panel.style.zIndex = '';
      });
    }
  };

  // ==========================================================================
  // [05] Desktop Shell Interface (Show Desktop Toggle & Windows Stacking)
  // ==========================================================================
  // --- Show Desktop Toggle (Bottom Right System Tray) ---
  function toggleShowDesktop() {
    if (!DesktopOS.isActive) return;
    const openWindows = Array.from(document.querySelectorAll('.desktop-windows-layer .panel'))
      .filter(function (p) {
        return !p.classList.contains('window-closed');
      });

    if (openWindows.length === 0) return;

    const hasVisible = openWindows.some(function (p) {
      return !p.classList.contains('window-minimized');
    });

    if (hasVisible) {
      openWindows.forEach(function (p) {
        p.classList.add('window-minimized');
        p.classList.remove('window-focused');
        const btn = document.getElementById('task-btn-' + p.id);
        if (btn) {
          btn.classList.remove('active');
          btn.setAttribute('aria-selected', 'false');
        }
      });
    } else {
      openWindows.forEach(function (p) {
        p.classList.remove('window-minimized');
        const btn = document.getElementById('task-btn-' + p.id);
        if (btn) {
          btn.classList.add('active');
          btn.setAttribute('aria-selected', 'true');
        }
      });
      openWindows.sort(function (a, b) {
        return (parseInt(b.style.zIndex || 0, 10) - parseInt(a.style.zIndex || 0, 10));
      });
      DesktopOS.focusApp(openWindows[0].id);
    }
  }

  // ==========================================================================
  // [06] Application: Blog Reader (initBlogReader & switchArticle)
  // ==========================================================================
  // --- Blog Reader Manager ---
  function initBlogReader(signal) {
    const select = document.getElementById('reader-post-select');
    const opts = signal ? { signal: signal } : undefined;

    function switchArticle(slug) {
      if (!slug) return;
      const articles = document.querySelectorAll('.reader-article');
      let found = false;
      articles.forEach(function (art) {
        const match = art.getAttribute('data-slug') === slug;
        art.classList.toggle('active', match);
        if (match) found = true;
      });

      if (select && found) {
        select.value = slug;
      }

      const status = document.getElementById('reader-status-info');
      if (status) {
        status.textContent = 'ARTICLE: ' + String(slug).toUpperCase();
      }

      DesktopOS.openApp('blog-reader-window');
    }

    if (select) {
      select.addEventListener('change', function () {
        switchArticle(this.value);
      }, opts);
    }

    // Intercept clicks on internal blog post links & archive links within Desktop OS
    document.addEventListener('click', function (e) {
      if (!DesktopOS.isActive) return;
      const targetEl = e.target && typeof e.target.closest === 'function' ? e.target : null;
      if (!targetEl) return;

      const archiveLink = targetEl.closest('.view-all-box a, .retro-btn-link');
      if (archiveLink && archiveLink.getAttribute('target') !== '_blank') {
        e.preventDefault();
        DesktopOS.openApp('file-explorer-window');
        return;
      }

      const anyLink = targetEl.closest('a');
      if (anyLink && anyLink.getAttribute('target') !== '_blank') {
        const href = anyLink.getAttribute('href') || '';
        if (href.endsWith('/blog/') || href.endsWith('/blog') || href === 'blog/' || href === 'blog') {
          e.preventDefault();
          DesktopOS.openApp('file-explorer-window');
          return;
        }

        const match = href.match(/\/blog\/([a-zA-Z0-9_-]+)\/?$/);
        if (match && match[1] && match[1] !== 'index' && match[1] !== 'blog') {
          e.preventDefault();
          switchArticle(match[1]);
        }
      }
    }, opts);

    window.openDesktopArticle = switchArticle;
  }

  // ==========================================================================
  // [07] Application: File Explorer (Explorer.exe Virtual Filesystem & Table)
  // ==========================================================================
  // --- Safe DOM Row Builders for File Explorer ---
  function createExplorerFileRow(cfg) {
    const row = document.createElement('div');
    row.className = 'explorer-file-row';
    row.setAttribute('tabindex', '0');
    row.setAttribute('role', 'button');
    if (cfg.title) row.title = cfg.title;
    if (cfg.launch) row.setAttribute('data-launch', cfg.launch);
    if (cfg.nav) row.setAttribute('data-nav', cfg.nav);
    if (cfg.slug) row.setAttribute('data-slug', cfg.slug);

    const nameDiv = document.createElement('div');
    nameDiv.className = 'file-name';

    const iconSpan = document.createElement('span');
    iconSpan.className = 'file-icon wingdings';
    iconSpan.setAttribute('aria-hidden', 'true');
    iconSpan.textContent = cfg.icon || '🗎';

    const textSpan = document.createElement('span');
    textSpan.className = 'file-title-text';
    textSpan.textContent = cfg.name || '';

    nameDiv.appendChild(iconSpan);
    nameDiv.appendChild(textSpan);

    const dateDiv = document.createElement('div');
    dateDiv.className = 'file-date';
    dateDiv.textContent = cfg.date || '';

    const typeDiv = document.createElement('div');
    typeDiv.className = 'file-type';
    typeDiv.textContent = cfg.type || '';

    const sizeDiv = document.createElement('div');
    sizeDiv.className = 'file-size';
    sizeDiv.textContent = cfg.size || '--';

    row.appendChild(nameDiv);
    row.appendChild(dateDiv);
    row.appendChild(typeDiv);
    row.appendChild(sizeDiv);

    return row;
  }

  // --- File Explorer Integration (Explorer.exe) ---
  function initFileExplorer(signal) {
    const searchInput = document.getElementById('explorer-search-input');
    const searchClear = document.getElementById('explorer-search-clear');
    const searchDropdown = document.getElementById('explorer-search-dropdown');
    const searchClose = document.getElementById('explorer-search-close-btn');
    const searchStatusBar = document.getElementById('explorer-search-status-bar');
    const searchResultsList = document.getElementById('explorer-search-results-list');
    const filesList = document.querySelector('.explorer-files-list');
    const addressInput = document.getElementById('explorer-address-input');
    const statusCount = document.getElementById('explorer-status-count');
    const backBtn = document.getElementById('explorer-back-btn');
    const forwardBtn = document.getElementById('explorer-forward-btn');
    const upBtn = document.getElementById('explorer-up-btn');
    const treeItems = document.querySelectorAll('#explorer-tree .tree-item[data-folder]');
    const opts = signal ? { signal: signal } : undefined;

    // Cache initial blog file DOM nodes once via cloneNode (no innerHTML)
    if (filesList && !initialBlogFileNodes) {
      initialBlogFileNodes = Array.from(filesList.childNodes).map(function (node) {
        return node.cloneNode(true);
      });
    }

    let folderHistory = ['blog-archive'];
    let historyIdx = 0;
    let currentFolder = 'blog-archive';

    function updateNavButtons() {
      if (backBtn) backBtn.disabled = historyIdx <= 0;
      if (forwardBtn) forwardBtn.disabled = historyIdx >= folderHistory.length - 1;
      if (upBtn) upBtn.disabled = (currentFolder === 'disk-c' || currentFolder === 'desktop');
    }

    function renderFolderContent(folderKey, addToHistory = true) {
      if (!filesList) return;
      currentFolder = folderKey;

      if (addToHistory) {
        if (historyIdx < folderHistory.length - 1) {
          folderHistory = folderHistory.slice(0, historyIdx + 1);
        }
        folderHistory.push(folderKey);
        historyIdx = folderHistory.length - 1;
      }

      updateNavButtons();

      // Highlight active tree item and sync aria-selected
      treeItems.forEach(function (ti) {
        const match = ti.getAttribute('data-folder') === folderKey;
        ti.classList.toggle('tree-active', match);
        ti.setAttribute('aria-selected', match ? 'true' : 'false');
      });

      // Clear search dropdown if open
      if (searchDropdown) {
        searchDropdown.hidden = true;
        searchDropdown.style.display = 'none';
      }

      filesList.replaceChildren();

      if (folderKey === 'blog-archive') {
        if (addressInput) addressInput.value = 'C:\\Documents\\Blog_Archive\\';
        if (initialBlogFileNodes) {
          initialBlogFileNodes.forEach(function (node) {
            filesList.appendChild(node.cloneNode(true));
          });
        }
        bindFileRows();
        const total = filesList.querySelectorAll('.explorer-file-row').length;
        if (statusCount) statusCount.textContent = total + ' Object(s)';
      } else if (folderKey === 'desktop') {
        if (addressInput) addressInput.value = 'C:\\Desktop\\';
        DesktopOS.apps.forEach(function (app) {
          const row = createExplorerFileRow({
            launch: app.id,
            title: `Click or press Enter to launch ${app.title}`,
            icon: app.icon,
            name: `${app.title}.lnk`,
            date: '2026-10-13',
            type: 'Application Shortcut',
            size: '1 KB'
          });
          filesList.appendChild(row);
        });
        bindAppRows();
        if (statusCount) statusCount.textContent = DesktopOS.apps.size + ' Object(s)';
      } else if (folderKey === 'documents') {
        if (addressInput) addressInput.value = 'C:\\Documents\\';
        filesList.appendChild(createExplorerFileRow({
          nav: 'blog-archive',
          title: 'Open Blog Archive',
          icon: '🗀',
          name: 'Blog_Archive',
          date: '2026-10-13',
          type: 'File Folder',
          size: '--'
        }));
        filesList.appendChild(createExplorerFileRow({
          launch: 'sticker-album-window',
          title: 'Open Sticker Album',
          icon: '★',
          name: 'Sticker_Album.exe',
          date: '2026-10-13',
          type: 'Application Shortcut',
          size: '2 KB'
        }));
        bindNavRows();
        if (statusCount) statusCount.textContent = '2 Object(s)';
      } else if (folderKey === 'disk-c') {
        if (addressInput) addressInput.value = 'C:\\';
        filesList.appendChild(createExplorerFileRow({
          nav: 'desktop',
          title: 'Open Desktop folder',
          icon: '🗀',
          name: 'Desktop',
          date: '2026-10-13',
          type: 'File Folder',
          size: '--'
        }));
        filesList.appendChild(createExplorerFileRow({
          nav: 'documents',
          title: 'Open Documents folder',
          icon: '🗀',
          name: 'Documents',
          date: '2026-10-13',
          type: 'File Folder',
          size: '--'
        }));
        filesList.appendChild(createExplorerFileRow({
          title: 'Windows System Folder',
          icon: '🗀',
          name: 'WINDOWS',
          date: '2005-08-24',
          type: 'System Folder',
          size: '--'
        }));
        filesList.appendChild(createExplorerFileRow({
          title: 'Program Files',
          icon: '🗀',
          name: 'Program Files',
          date: '2026-10-13',
          type: 'File Folder',
          size: '--'
        }));
        bindNavRows();
        if (statusCount) statusCount.textContent = '4 Object(s)';
      } else if (folderKey === 'floppy') {
        if (addressInput) addressInput.value = 'A:\\';
        const msgBox = document.createElement('div');
        msgBox.style.cssText = 'padding: 24px; text-align: center; color: var(--text-muted); font-family: monospace;';

        const floppyIcon = document.createElement('div');
        floppyIcon.className = 'wingdings';
        floppyIcon.style.cssText = 'font-size: 32px; margin-bottom: 8px;';
        floppyIcon.setAttribute('aria-hidden', 'true');
        floppyIcon.textContent = '🖫';

        const strongEl = document.createElement('strong');
        strongEl.textContent = 'Drive A: is not ready.';

        const brEl = document.createElement('br');
        const subText = document.createTextNode('Please insert a 3½-inch floppy disk into drive A: to browse files.');

        msgBox.appendChild(floppyIcon);
        msgBox.appendChild(strongEl);
        msgBox.appendChild(brEl);
        msgBox.appendChild(subText);
        filesList.appendChild(msgBox);
        if (statusCount) statusCount.textContent = '0 Object(s)';
      }
    }

    function bindFileRows() {
      if (!filesList) return;
      const fileRows = filesList.querySelectorAll('.explorer-file-row[data-slug]');
      fileRows.forEach(function (row) {
        function openFile() {
          const slug = row.getAttribute('data-slug');
          if (slug && typeof window.openDesktopArticle === 'function') {
            window.openDesktopArticle(slug);
          }
        }
        row.addEventListener('click', openFile, opts);
        bindKeyboardActivation(row, openFile, signal);
      });
    }

    function bindAppRows() {
      if (!filesList) return;
      const appRows = filesList.querySelectorAll('.explorer-file-row[data-launch]');
      appRows.forEach(function (row) {
        function launch() {
          const id = row.getAttribute('data-launch');
          if (id) DesktopOS.openApp(id);
        }
        row.addEventListener('click', launch, opts);
        bindKeyboardActivation(row, launch, signal);
      });
    }

    function bindNavRows() {
      if (!filesList) return;
      const navRows = filesList.querySelectorAll('.explorer-file-row[data-nav]');
      navRows.forEach(function (row) {
        function nav() {
          const target = row.getAttribute('data-nav');
          if (target) renderFolderContent(target, true);
        }
        row.addEventListener('click', nav, opts);
        bindKeyboardActivation(row, nav, signal);
      });
      bindAppRows();
    }

    // Bind Left Folder Tree items (click + keyboard Enter/Space)
    treeItems.forEach(function (item) {
      function selectFolder() {
        const folder = item.getAttribute('data-folder');
        if (folder) renderFolderContent(folder, true);
      }
      item.addEventListener('click', selectFolder, opts);
      bindKeyboardActivation(item, selectFolder, signal);
    });

    // Toolbar navigation buttons
    if (backBtn) {
      backBtn.addEventListener('click', function () {
        if (historyIdx > 0) {
          historyIdx--;
          renderFolderContent(folderHistory[historyIdx], false);
        }
      }, opts);
    }

    if (forwardBtn) {
      forwardBtn.addEventListener('click', function () {
        if (historyIdx < folderHistory.length - 1) {
          historyIdx++;
          renderFolderContent(folderHistory[historyIdx], false);
        }
      }, opts);
    }

    if (upBtn) {
      upBtn.addEventListener('click', function () {
        if (currentFolder === 'blog-archive') {
          renderFolderContent('documents', true);
        } else if (currentFolder === 'documents' || currentFolder === 'desktop') {
          renderFolderContent('disk-c', true);
        }
      }, opts);
    }

    // --- Explorer Live Search & Dropdown Pane (Safe DOM Manipulation) ---
    function doSearch() {
      if (!searchInput) return;
      const query = searchInput.value.trim().toLowerCase();

      if (searchClear) {
        searchClear.hidden = !query;
        searchClear.style.display = query ? 'block' : 'none';
      }

      if (!query) {
        if (searchDropdown) {
          searchDropdown.hidden = true;
          searchDropdown.style.display = 'none';
        }
        renderFolderContent(currentFolder, false);
        return;
      }

      const results = [];
      const blogArticles = document.querySelectorAll('.reader-article');

      blogArticles.forEach(function (art) {
        const slug = art.getAttribute('data-slug') || '';
        const titleEl = art.querySelector('.single-post-title');
        const title = titleEl ? titleEl.textContent.trim() : slug;
        const text = art.textContent.toLowerCase();

        if (slug.includes(query) || title.toLowerCase().includes(query) || text.includes(query)) {
          let snippet = '';
          const idx = text.indexOf(query);
          if (idx !== -1) {
            const start = Math.max(0, idx - 30);
            const end = Math.min(text.length, idx + 60);
            snippet = '...' + text.substring(start, end).replace(/\s+/g, ' ').trim() + '...';
          }
          results.push({
            type: 'article',
            id: slug,
            title: title,
            meta: `Blog Bulletin \u2022 ${slug}.doc`,
            snippet: snippet
          });
        }
      });

      DesktopOS.apps.forEach(function (app) {
        if (app.title.toLowerCase().includes(query) || app.id.toLowerCase().includes(query)) {
          results.push({
            type: 'app',
            id: app.id,
            title: app.title,
            meta: `Application \u2022 ${app.icon}`,
            snippet: `Desktop Program Shortcut: ${app.title}.lnk`
          });
        }
      });

      if (searchDropdown && searchResultsList) {
        searchDropdown.hidden = false;
        searchDropdown.style.display = 'flex';
        searchResultsList.replaceChildren();

        if (results.length === 0) {
          if (searchStatusBar) searchStatusBar.textContent = `No records matching "${query}"`;
          const emptyLi = document.createElement('li');
          emptyLi.className = 'explorer-search-result-item';
          emptyLi.style.cssText = 'cursor: default; font-style: italic; color: var(--text-muted);';
          emptyLi.textContent = 'No records found. Try searching by keywords like "reticulum", "linux", "game", or "synth".';
          searchResultsList.appendChild(emptyLi);
        } else {
          if (searchStatusBar) searchStatusBar.textContent = `${results.length} match(es) found`;
          results.forEach(function (res) {
            const li = document.createElement('li');
            li.className = 'explorer-search-result-item';
            li.setAttribute('tabindex', '0');
            li.setAttribute('role', 'option');

            const titleDiv = document.createElement('div');
            titleDiv.className = 'explorer-result-title';

            const iconSpan = document.createElement('span');
            iconSpan.className = 'wingdings';
            iconSpan.setAttribute('aria-hidden', 'true');
            iconSpan.textContent = res.type === 'app' ? '⚙' : '🗎';

            const strongTitle = document.createElement('strong');
            strongTitle.textContent = res.title;

            titleDiv.appendChild(iconSpan);
            titleDiv.appendChild(document.createTextNode(' '));
            titleDiv.appendChild(strongTitle);

            const metaDiv = document.createElement('div');
            metaDiv.className = 'explorer-result-meta';
            metaDiv.textContent = res.meta;

            li.appendChild(titleDiv);
            li.appendChild(metaDiv);

            if (res.snippet) {
              const snippetDiv = document.createElement('div');
              snippetDiv.style.cssText = 'font-size: 9px; color: var(--text-muted); margin-top: 2px;';
              snippetDiv.textContent = res.snippet;
              li.appendChild(snippetDiv);
            }

            function openResult() {
              if (res.type === 'app') {
                DesktopOS.openApp(res.id);
              } else if (typeof window.openDesktopArticle === 'function') {
                window.openDesktopArticle(res.id);
              }
              searchDropdown.hidden = true;
              searchDropdown.style.display = 'none';
            }

            li.addEventListener('click', openResult, opts);
            bindKeyboardActivation(li, openResult, signal);

            searchResultsList.appendChild(li);
          });
        }
      }
    }

    if (searchInput) {
      searchInput.addEventListener('input', doSearch, opts);
      searchInput.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
          searchInput.value = '';
          doSearch();
          searchInput.blur();
        }
      }, opts);
    }

    if (searchClear) {
      searchClear.addEventListener('click', function () {
        if (searchInput) {
          searchInput.value = '';
          doSearch();
          searchInput.focus();
        }
      }, opts);
    }

    if (searchClose) {
      searchClose.addEventListener('click', function () {
        if (searchDropdown) {
          searchDropdown.hidden = true;
          searchDropdown.style.display = 'none';
        }
      }, opts);
    }

    // --- Column Header Sorting ---
    let currentSortCol = 'name';
    let sortAsc = true;

    function sortFiles(col) {
      if (!filesList) return;
      const rows = Array.from(filesList.querySelectorAll('.explorer-file-row'));
      if (rows.length === 0) return;

      if (currentSortCol === col) {
        sortAsc = !sortAsc;
      } else {
        currentSortCol = col;
        sortAsc = true;
      }

      document.querySelectorAll('.explorer-files-header span[id^="explorer-sort-"]').forEach(function (h) {
        const ind = h.querySelector('.sort-indicator');
        if (ind) ind.textContent = '';
        h.removeAttribute('aria-sort');
      });
      const activeHeader = document.getElementById('explorer-sort-' + col);
      if (activeHeader) {
        const ind = activeHeader.querySelector('.sort-indicator');
        if (ind) ind.textContent = sortAsc ? '▲' : '▼';
        activeHeader.setAttribute('aria-sort', sortAsc ? 'ascending' : 'descending');
      }

      rows.sort(function (a, b) {
        let valA = '', valB = '';
        if (col === 'name') {
          valA = (a.querySelector('.file-title-text')?.textContent || '').toLowerCase();
          valB = (b.querySelector('.file-title-text')?.textContent || '').toLowerCase();
        } else if (col === 'date') {
          valA = a.querySelector('.file-date')?.textContent || '';
          valB = b.querySelector('.file-date')?.textContent || '';
        } else if (col === 'type') {
          valA = a.querySelector('.file-type')?.textContent || '';
          valB = b.querySelector('.file-type')?.textContent || '';
        } else if (col === 'size') {
          valA = parseInt(a.querySelector('.file-size')?.textContent || '0', 10) || 0;
          valB = parseInt(b.querySelector('.file-size')?.textContent || '0', 10) || 0;
          return sortAsc ? (valA - valB) : (valB - valA);
        }
        return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
      });

      rows.forEach(function (r) { filesList.appendChild(r); });
    }

    ['name', 'date', 'type', 'size'].forEach(function (col) {
      const header = document.getElementById('explorer-sort-' + col);
      if (header) {
        header.addEventListener('click', function () { sortFiles(col); }, opts);
        bindKeyboardActivation(header, function () { sortFiles(col); }, signal);
      }
    });

    // --- Menu Bar Interactivity (Click + Keyboard) ---
    document.querySelectorAll('.explorer-menubar .explorer-menu-item').forEach(function (item) {
      function handleMenuAction() {
        const menu = item.getAttribute('data-menu');
        if (menu === 'file') {
          if (confirm('Close Explorer.exe session?')) {
            DesktopOS.closeApp('file-explorer-window');
          }
        } else if (menu === 'view') {
          if (filesList) filesList.classList.toggle('view-compact');
        } else if (menu === 'tools') {
          if (searchInput) {
            searchInput.value = '';
            doSearch();
          }
          renderFolderContent('blog-archive', true);
        } else if (menu === 'help') {
          alert("Explorer.exe (Version 2.0)\nAuthentic Retro File Manager & Blog Archive Navigator for Lachlan's World OS.");
        }
      }
      item.addEventListener('click', handleMenuAction, opts);
      bindKeyboardActivation(item, handleMenuAction, signal);
    });

    // Initial binding
    renderFolderContent('blog-archive', false);
  }

  // ==========================================================================
  // [08] Application: Start Menu & Taskbar Tray Elements
  // ==========================================================================
  // --- Show Desktop Button (Taskbar Tray) ---
  function initShowDesktopBtn(signal) {
    const showDesktopBtn = document.getElementById('show-desktop-btn');
    if (showDesktopBtn) {
      showDesktopBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        toggleShowDesktop();
      }, signal ? { signal: signal } : undefined);
    }
  }

  // --- Start Menu Management ---
  function initStartMenu(signal) {
    const startBtn = document.getElementById('start-menu-btn');
    const startMenu = document.getElementById('desktop-start-menu');
    const blogFolder = document.getElementById('start-blog-folder');
    const opts = signal ? { signal: signal } : undefined;

    if (!startBtn || !startMenu) return;

    function openStartMenu() {
      startMenu.removeAttribute('hidden');
      startBtn.setAttribute('aria-expanded', 'true');
      startBtn.classList.add('active');
    }

    function closeStartMenu() {
      startMenu.setAttribute('hidden', '');
      startBtn.setAttribute('aria-expanded', 'false');
      startBtn.classList.remove('active');
      const submenu = startMenu.querySelector('.start-menu-has-submenu');
      if (submenu) submenu.classList.remove('open');
      if (blogFolder) blogFolder.setAttribute('aria-expanded', 'false');
    }

    function toggleStartMenu() {
      if (startMenu.hasAttribute('hidden')) {
        openStartMenu();
      } else {
        closeStartMenu();
      }
    }

    startBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      toggleStartMenu();
    }, opts);

    document.addEventListener('click', function (e) {
      if (!startMenu.contains(e.target) && e.target !== startBtn && !startBtn.contains(e.target)) {
        closeStartMenu();
      }
    }, opts);

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !startMenu.hasAttribute('hidden')) {
        closeStartMenu();
        startBtn.focus();
      }
    }, opts);

    if (blogFolder) {
      function toggleSubmenu(e) {
        if (e) e.stopPropagation();
        const parent = blogFolder.closest('.start-menu-has-submenu');
        if (parent) {
          const isOpen = parent.classList.toggle('open');
          blogFolder.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
        }
      }
      blogFolder.addEventListener('click', toggleSubmenu, opts);
      bindKeyboardActivation(blogFolder, toggleSubmenu, signal);
    }

    startMenu.addEventListener('click', function (e) {
      const item = e.target && typeof e.target.closest === 'function' ? e.target.closest('.start-menu-item') : null;
      if (!item || item === blogFolder) return;

      const action = item.getAttribute('data-action');
      if (action === 'open-window') {
        const targetId = item.getAttribute('data-target');
        if (targetId) {
          DesktopOS.openApp(targetId);
        }
        closeStartMenu();
      } else if (action === 'open-stickers') {
        DesktopOS.openApp('sticker-album-window');
        closeStartMenu();
      } else if (item.tagName === 'A') {
        closeStartMenu();
      }
    }, opts);
  }

  // ==========================================================================
  // [09] Application: Settings & Display Properties (Settings.exe)
  // ==========================================================================
  // --- Settings App Integration ---
  function initSettingsApp(signal) {
    const themeSelect = document.getElementById('settings-theme-select');
    const resSpan = document.getElementById('settings-screen-res');
    const resetPosBtn = document.getElementById('settings-reset-pos-btn');
    const clearStickersBtn = document.getElementById('settings-clear-stickers-btn');
    const opts = signal ? { signal: signal } : undefined;

    if (themeSelect) {
      themeSelect.addEventListener('change', function () {
        if (typeof window.switchSiteTheme === 'function') {
          window.switchSiteTheme(themeSelect.value);
        }
      }, opts);
    }

    if (resSpan) {
      resSpan.textContent = `${window.innerWidth}x${window.innerHeight}`;
    }

    function syncTheme() {
      const current = document.documentElement.getAttribute('data-theme') || (window.SITE_CONFIG && window.SITE_CONFIG.defaultTheme) || 'paper';
      if (themeSelect && themeSelect.value !== current) {
        themeSelect.value = current;
      }
    }
    syncTheme();
    window.addEventListener('site:themechange', syncTheme, opts);

    if (resetPosBtn) {
      resetPosBtn.addEventListener('click', function () {
        safeRemoveItem(POS_KEY);
        safeRemoveItem(LEGACY_STATE_KEY);
        windowPositions = {};
        DesktopOS.apps.forEach(function (app) {
          DesktopOS._positionWindow(app);
        });
        alert('Window positions successfully reset to system defaults!');
      }, opts);
    }

    if (clearStickersBtn) {
      clearStickersBtn.addEventListener('click', function () {
        if (confirm('Clear all stickers from your desktop wallpaper?')) {
          if (typeof window.clearDesktopStickers === 'function') {
            window.clearDesktopStickers();
          }
        }
      }, opts);
    }

    const motionToggle = document.getElementById('settings-sticker-motion-toggle');
    if (motionToggle) {
      const isMotionDisabled = safeGetItem('lachlan_sticker_motion') === 'disabled';
      motionToggle.checked = !isMotionDisabled;
      motionToggle.addEventListener('change', function () {
        const newState = motionToggle.checked ? 'enabled' : 'disabled';
        safeSetItem('lachlan_sticker_motion', newState);
        document.documentElement.classList.toggle('stickers-motion-disabled', !motionToggle.checked);
        if (typeof window.applyStickerMotionPreference === 'function') {
          window.applyStickerMotionPreference();
        }
      }, opts);
    }

    // Tabs switching in Settings.exe (with ArrowLeft / ArrowRight keyboard support)
    const tabButtons = Array.from(document.querySelectorAll('.settings-tab-btn'));
    function activateTab(btn) {
      const targetId = btn.getAttribute('data-tab');
      tabButtons.forEach(function (b) {
        b.classList.remove('active');
        b.setAttribute('aria-selected', 'false');
      });
      document.querySelectorAll('.settings-tab-pane').forEach(function (p) {
        p.classList.remove('active');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');
      const targetPane = document.getElementById(targetId);
      if (targetPane) {
        targetPane.classList.add('active');
      }
    }

    tabButtons.forEach(function (btn, idx) {
      btn.addEventListener('click', function () {
        activateTab(btn);
      }, opts);
      btn.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowRight') {
          e.preventDefault();
          const next = tabButtons[(idx + 1) % tabButtons.length];
          if (next) {
            next.focus();
            activateTab(next);
          }
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          const prev = tabButtons[(idx - 1 + tabButtons.length) % tabButtons.length];
          if (prev) {
            prev.focus();
            activateTab(prev);
          }
        }
      }, opts);
    });

    // Custom Wallpaper Management
    const WALLPAPER_KEY = 'lachlan_custom_wallpaper';
    const WALLPAPER_FIT_KEY = 'lachlan_custom_wallpaper_fit';

    const wallFileInput = document.getElementById('settings-wallpaper-file');
    const wallUrlBtn = document.getElementById('settings-wallpaper-url-btn');
    const wallUrlRow = document.getElementById('settings-wallpaper-url-row');
    const wallUrlInput = document.getElementById('settings-wallpaper-url-input');
    const wallUrlApply = document.getElementById('settings-wallpaper-url-apply');
    const wallResetBtn = document.getElementById('settings-wallpaper-reset-btn');
    const wallFitSelect = document.getElementById('settings-wallpaper-fit');
    const previewScreen = document.getElementById('wallpaper-preview-screen');
    const previewLabel = document.getElementById('wallpaper-preview-label');

    function sanitizeWallpaperUrl(rawUrl) {
      if (!rawUrl || typeof rawUrl !== 'string') return null;
      const trimmed = rawUrl.trim();
      const urlPattern = /^https?:\/\/[a-zA-Z0-9\-._~:/?#[\]@!$&'()*+,;=%]+$/i;
      const dataUriPattern = /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/i;
      if (urlPattern.test(trimmed) || dataUriPattern.test(trimmed)) {
        return trimmed.replace(/["'\\()]/g, '');
      }
      return null;
    }

    function applyCustomWallpaper() {
      const rawWall = safeGetItem(WALLPAPER_KEY);
      const customWall = sanitizeWallpaperUrl(rawWall);
      const fitMode = safeGetItem(WALLPAPER_FIT_KEY) || 'cover';
      const body = document.body;
      if (!body) return;

      if (wallFitSelect && wallFitSelect.value !== fitMode) {
        wallFitSelect.value = fitMode;
      }

      if (customWall) {
        body.classList.add('has-custom-wallpaper');
        document.documentElement.classList.add('has-custom-wallpaper');
        body.style.setProperty('--custom-wallpaper-image', 'url("' + customWall + '")');
        if (fitMode === 'tile') {
          body.style.setProperty('--custom-wallpaper-size', 'auto');
          body.style.setProperty('--custom-wallpaper-repeat', 'repeat');
        } else if (fitMode === 'contain') {
          body.style.setProperty('--custom-wallpaper-size', 'contain');
          body.style.setProperty('--custom-wallpaper-repeat', 'no-repeat');
        } else if (fitMode === 'center') {
          body.style.setProperty('--custom-wallpaper-size', 'auto');
          body.style.setProperty('--custom-wallpaper-repeat', 'no-repeat');
        } else {
          body.style.setProperty('--custom-wallpaper-size', 'cover');
          body.style.setProperty('--custom-wallpaper-repeat', 'no-repeat');
        }

        if (previewScreen) {
          previewScreen.style.backgroundImage = 'url("' + customWall + '")';
          previewScreen.style.backgroundSize = fitMode === 'tile' ? 'auto' : 'cover';
        }
        if (previewLabel) {
          previewLabel.textContent = 'Custom Wallpaper Active (' + fitMode + ') - Saved in client storage';
        }
      } else {
        body.classList.remove('has-custom-wallpaper');
        document.documentElement.classList.remove('has-custom-wallpaper');
        body.style.removeProperty('--custom-wallpaper-image');
        body.style.removeProperty('--custom-wallpaper-size');
        body.style.removeProperty('--custom-wallpaper-repeat');
        if (previewScreen) {
          previewScreen.style.backgroundImage = '';
          previewScreen.style.backgroundSize = '';
        }
        if (previewLabel) {
          previewLabel.textContent = 'Theme Default Pattern (Saved locally in client storage)';
        }
      }
    }

    if (wallUrlBtn && wallUrlRow) {
      wallUrlBtn.addEventListener('click', function () {
        const isHidden = wallUrlRow.style.display === 'none';
        wallUrlRow.style.display = isHidden ? 'flex' : 'none';
        if (isHidden && wallUrlInput) {
          wallUrlInput.focus();
        }
      }, opts);
    }

    if (wallUrlApply && wallUrlInput) {
      wallUrlApply.addEventListener('click', function () {
        const rawUrl = wallUrlInput.value.trim();
        const validUrl = sanitizeWallpaperUrl(rawUrl);
        if (!validUrl) {
          alert('Invalid Image URL! Please provide a valid HTTP/HTTPS image URL (e.g. https://example.com/wallpaper.jpg) or upload a local file.');
          return;
        }
        if (safeSetItem(WALLPAPER_KEY, validUrl)) {
          applyCustomWallpaper();
          if (wallUrlRow) wallUrlRow.style.display = 'none';
        } else {
          alert('Could not save wallpaper URL due to browser storage restrictions.');
        }
      }, opts);
    }

    if (wallFileInput) {
      wallFileInput.addEventListener('change', function (e) {
        const file = e.target.files && e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onerror = function () {
          alert('Failed to read selected image file.');
        };
        reader.onload = function (evt) {
          const rawData = evt.target.result;
          const img = new Image();
          img.onerror = function () {
            alert('Invalid or corrupted image file.');
          };
          img.onload = function () {
            const MAX_WIDTH = 1920;
            const MAX_HEIGHT = 1080;
            let width = img.width;
            let height = img.height;

            if (width > MAX_WIDTH || height > MAX_HEIGHT) {
              const ratio = Math.min(MAX_WIDTH / width, MAX_HEIGHT / height);
              width = Math.round(width * ratio);
              height = Math.round(height * ratio);
            }

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;
            ctx.drawImage(img, 0, 0, width, height);

            const compressedData = canvas.toDataURL('image/jpeg', 0.85);
            if (safeSetItem(WALLPAPER_KEY, compressedData)) {
              applyCustomWallpaper();
            } else {
              alert('Image file is too large for browser storage quota! Please try a smaller image.');
            }
          };
          img.src = rawData;
        };
        reader.readAsDataURL(file);
      }, opts);
    }

    if (wallFitSelect) {
      wallFitSelect.addEventListener('change', function () {
        safeSetItem(WALLPAPER_FIT_KEY, wallFitSelect.value);
        applyCustomWallpaper();
      }, opts);
    }

    if (wallResetBtn) {
      wallResetBtn.addEventListener('click', function () {
        safeRemoveItem(WALLPAPER_KEY);
        safeRemoveItem(WALLPAPER_FIT_KEY);
        applyCustomWallpaper();
      }, opts);
    }

    applyCustomWallpaper();
  }

  // ==========================================================================
  // [10] Viewport Synchronization, Global Expositions & System Boot
  // ==========================================================================
  // --- Global Window Expositions ---
  window.DesktopOS = DesktopOS;
  window.openDesktopWindow = function (appId) { DesktopOS.openApp(appId); };
  window.closeDesktopWindow = function (appId) { DesktopOS.closeApp(appId); };
  window.minimizeDesktopWindow = function (appId) { DesktopOS.minimizeApp(appId); };

  // --- Viewport Breakpoint & Hybrid Capability Sync ---
  function syncViewportMode() {
    const resSpan = document.getElementById('settings-screen-res');
    if (resSpan) {
      resSpan.textContent = `${window.innerWidth}x${window.innerHeight}`;
    }

    if (checkDesktopCapability()) {
      if (!DesktopOS.isActive) {
        DesktopOS.activate();
      } else {
        // Clamp existing window positions inside new viewport bounds
        DesktopOS.apps.forEach(function (app) {
          if (app.panel && !app.panel.classList.contains('window-closed')) {
            const curLeft = parseInt(app.panel.style.left, 10);
            const curTop = parseInt(app.panel.style.top, 10);
            if (!isNaN(curLeft) && !isNaN(curTop)) {
              const clampedX = Math.max(0, Math.min(Math.max(0, window.innerWidth - 100), curLeft));
              const clampedY = Math.max(34, Math.min(Math.max(34, window.innerHeight - 70), curTop));
              app.panel.style.left = clampedX + 'px';
              app.panel.style.top = clampedY + 'px';
            }
          }
        });
      }
    } else {
      if (DesktopOS.isActive || document.body.classList.contains('mode-desktop')) {
        DesktopOS.deactivate();
      }
    }
  }

  // --- Boot Desktop OS ---
  let booted = false;
  function boot() {
    if (booted) return;
    booted = true;

    syncViewportMode();

    if (typeof window.matchMedia === 'function') {
      const mql = window.matchMedia(DESKTOP_BREAKPOINT_QUERY);
      if (typeof mql.addEventListener === 'function') {
        mql.addEventListener('change', syncViewportMode);
      } else if (typeof mql.addListener === 'function') {
        mql.addListener(syncViewportMode);
      }
    }

    window.addEventListener('resize', syncViewportMode);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
