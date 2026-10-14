/**
 * window-manager.js - Extensible Retro Desktop OS Architecture & Window Manager
 * Dedicated to Lachlan's World Desktop OS (/desktop/)
 *
 * Implements a robust DesktopOS App Registry:
 * - Automatically discovers apps defined in HTML templates (.desktop-window with data-app-*)
 * - Dynamically renders Desktop Shortcut Icons and Start Menu Programs
 * - Provides programmatic registration API: DesktopOS.registerApp() & DesktopOS.unregisterApp()
 * - Standardizes draggable window chrome with Minimize and Close controls
 * - Handles window lifecycles (pausing screensaver canvas & audio on close)
 * - Rich File Explorer with live search dropdown pane, folder navigation, and column sorting
 * - Dedicated Display Properties & Settings App (Settings.exe)
 */

(function () {
  'use strict';

  // Only run inside the dedicated Desktop OS environment
  if (!document.body.classList.contains('desktop-os-page')) {
    return;
  }

  const POS_KEY = 'lachlan_desktop_window_positions';
  let highestZ = 500;
  let windowPositions = {};

  function loadWindowPositions() {
    try {
      const data = localStorage.getItem(POS_KEY);
      return data ? JSON.parse(data) : {};
    } catch (e) {
      return {};
    }
  }

  function saveWindowPositions() {
    try {
      localStorage.setItem(POS_KEY, JSON.stringify(windowPositions));
    } catch (e) {}
  }

  // --- Clock updater ---
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

  // --- DesktopOS Architecture ---
  const DesktopOS = {
    apps: new Map(),

    /**
     * Register a new application into Desktop OS
     * @param {Object} appConfig - { id, title, icon, defaultX, defaultY, panel, shortcut, startMenu, onClose, onOpen }
     */
    registerApp: function (appConfig) {
      if (!appConfig || !appConfig.id) return;
      const id = appConfig.id;
      const panel = appConfig.panel || document.getElementById(id);
      if (!panel) return;

      const app = {
        id: id,
        title: appConfig.title || this._extractTitle(panel, id),
        icon: appConfig.icon || this._extractIcon(panel, id),
        defaultX: typeof appConfig.defaultX === 'number' ? appConfig.defaultX : (120 + this.apps.size * 30),
        defaultY: typeof appConfig.defaultY === 'number' ? appConfig.defaultY : (60 + this.apps.size * 25),
        panel: panel,
        shortcut: appConfig.shortcut !== false,
        startMenu: appConfig.startMenu !== false,
        onClose: appConfig.onClose || null,
        onOpen: appConfig.onOpen || null
      };

      this.apps.set(id, app);

      // Setup window UI & controls
      this._setupWindowChrome(app);
      this._positionWindow(app);
      this._setupWindowDrag(app);

      // Start all windows closed by default on clean launch
      panel.classList.add('desktop-window', 'window-closed');
      panel.classList.remove('window-focused', 'window-minimized');

      // Click on window focuses it
      panel.addEventListener('pointerdown', function () {
        DesktopOS.focusApp(id);
      });

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
      const app = this.apps.get(appId);
      const panel = app ? app.panel : document.getElementById(appId);
      if (!panel) return;

      panel.classList.remove('window-closed', 'window-minimized');
      this.focusApp(appId);

      // Lifecycle hook on open
      if (app && typeof app.onOpen === 'function') {
        app.onOpen();
      } else if (appId === 'interactive-element' && window.startScreensaver) {
        window.startScreensaver();
      }
    },

    /**
     * Focus an application window (brings to front)
     */
    focusApp: function (appId) {
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
        document.querySelectorAll('.taskbar-item').forEach(function (b) { b.classList.remove('active'); });
        taskBtn.classList.add('active');
      }
    },

    /**
     * Minimize an application window
     */
    minimizeApp: function (appId) {
      const app = this.apps.get(appId);
      const panel = app ? app.panel : document.getElementById(appId);
      if (!panel) return;

      panel.classList.add('window-minimized');
      panel.classList.remove('window-focused');

      const taskBtn = document.getElementById('task-btn-' + appId);
      if (taskBtn) {
        taskBtn.classList.remove('active');
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

      panel.classList.add('window-closed');
      panel.classList.remove('window-focused', 'window-minimized');

      this._removeTaskbarButton(appId);

      // Lifecycle hook on close
      if (app && typeof app.onClose === 'function') {
        app.onClose();
      } else {
        if (appId === 'interactive-element' && window.stopScreensaver) {
          window.stopScreensaver();
        }
        if (appId === 'music-player' && window.stopMusicPlayback) {
          window.stopMusicPlayback();
        }
      }

      // Focus topmost remaining visible window
      this._focusTopmost();
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
        'about': '👤',
        'interactive-element': '🎮',
        'music-player': '🎵',
        'blog-reader-window': '📝',
        'file-explorer-window': '📁',
        'recent-posts': '📋',
        'sticker-album-window': '★',
        'system-status': '💻',
        'trivia-facts': '💡',
        'pocket_pet-app': '🥚',
        'settings-window': '⚙️'
      };
      return iconMap[panelId] || '🗔';
    },

    _setupWindowChrome: function (app) {
      const panel = app.panel;
      let header = panel.querySelector('.panel-header');
      if (!header) return;

      // Ensure proper header title structure
      let titleContainer = header.querySelector('.panel-header-title');
      if (!titleContainer) {
        const rawText = header.textContent.trim();
        header.textContent = '';
        titleContainer = document.createElement('div');
        titleContainer.className = 'panel-header-title';

        const iconSpan = document.createElement('span');
        iconSpan.className = 'win-icon';
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
        minBtn.addEventListener('click', function (e) {
          e.stopPropagation();
          DesktopOS.minimizeApp(app.id);
        });

        const closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.className = 'window-btn';
        closeBtn.textContent = '✕';
        closeBtn.title = 'Close';
        closeBtn.setAttribute('aria-label', `Close ${app.title}`);
        closeBtn.addEventListener('click', function (e) {
          e.stopPropagation();
          DesktopOS.closeApp(app.id);
        });

        controls.appendChild(minBtn);
        controls.appendChild(closeBtn);
        header.appendChild(controls);
      } else {
        // Bind any existing buttons inside window-controls
        const minBtn = controls.querySelector('button[title="Minimize"], #reader-min-btn, #sticker-win-min-btn, #explorer-min-btn');
        if (minBtn && !minBtn._bound) {
          minBtn._bound = true;
          minBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            DesktopOS.minimizeApp(app.id);
          });
        }
        const closeBtn = controls.querySelector('button[title="Close"], #reader-close-btn, #sticker-win-close-btn, #explorer-close-btn');
        if (closeBtn && !closeBtn._bound) {
          closeBtn._bound = true;
          closeBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            DesktopOS.closeApp(app.id);
          });
        }
      }
    },

    _positionWindow: function (app) {
      const panel = app.panel;
      const saved = windowPositions[app.id];
      let posX, posY;

      if (saved && typeof saved.x === 'number') {
        posX = saved.x;
        posY = saved.y;
      } else {
        posX = Math.min(app.defaultX, window.innerWidth - 380);
        posY = app.defaultY;
      }

      panel.style.left = Math.max(10, posX) + 'px';
      panel.style.top = Math.max(40, posY) + 'px';
      panel.style.zIndex = highestZ++;
    },

    _setupWindowDrag: function (app) {
      const panel = app.panel;
      const header = panel.querySelector('.panel-header');
      if (!header || header._dragInitialized) return;
      header._dragInitialized = true;

      let isDragging = false;
      let startX = 0;
      let startY = 0;
      let initialX = 0;
      let initialY = 0;

      header.addEventListener('pointerdown', function (e) {
        if (e.target.closest('.window-controls') || e.target.closest('button')) return;

        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        initialX = panel.offsetLeft;
        initialY = panel.offsetTop;
        header.setPointerCapture(e.pointerId);
        DesktopOS.focusApp(app.id);
        e.preventDefault();
      });

      header.addEventListener('pointermove', function (e) {
        if (!isDragging) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;

        let newX = initialX + dx;
        let newY = initialY + dy;

        newX = Math.max(0, Math.min(window.innerWidth - 80, newX));
        newY = Math.max(34, Math.min(window.innerHeight - 70, newY));

        panel.style.left = newX + 'px';
        panel.style.top = newY + 'px';

        windowPositions[app.id] = { x: newX, y: newY };
      });

      function stopDrag(e) {
        if (!isDragging) return;
        isDragging = false;
        try {
          header.releasePointerCapture(e.pointerId);
        } catch (err) {}
        saveWindowPositions();
      }

      header.addEventListener('pointerup', stopDrag);
      header.addEventListener('pointercancel', stopDrag);
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
      taskBtn.textContent = icon + titleText;
      taskBtn.title = titleText;

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
      });

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
        iconImg.textContent = app.icon;

        const iconLabel = document.createElement('div');
        iconLabel.className = 'desktop-icon-label';
        iconLabel.textContent = app.title;

        iconEl.appendChild(iconImg);
        iconEl.appendChild(iconLabel);

        function openIt() {
          DesktopOS.openApp(app.id);
        }

        iconEl.addEventListener('click', openIt);
        iconEl.addEventListener('keydown', function (e) {
          if (e.key === 'Enter') openIt();
        });

        // Insert before system recycle bin
        if (recycleBin) {
          container.insertBefore(iconEl, recycleBin);
        } else {
          container.appendChild(iconEl);
        }
      });

      // Wire Recycle Bin if not yet wired
      if (recycleBin && !recycleBin._bound) {
        recycleBin._bound = true;
        recycleBin.addEventListener('click', function () {
          if (confirm('Empty Recycle Bin? This will clear all stickers placed on your desktop wallpaper.')) {
            if (window.clearDesktopStickers) {
              window.clearDesktopStickers();
            }
          }
        });
      }
    },

    /**
     * Render / Refresh Start Menu Programs list
     */
    renderStartMenu: function () {
      const group = document.getElementById('start-menu-apps');
      if (!group) return;

      group.innerHTML = '';

      this.apps.forEach(function (app) {
        if (!app.startMenu) return;

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'start-menu-item';
        btn.setAttribute('data-action', 'open-window');
        btn.setAttribute('data-target', app.id);

        const iconSpan = document.createElement('span');
        iconSpan.className = 'start-item-icon';
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
        'trivia-facts': { x: 920, y: 440 }
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
    }
  };

  // --- Show Desktop Toggle (Bottom Right System Tray) ---
  function toggleShowDesktop() {
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
        if (btn) btn.classList.remove('active');
      });
    } else {
      openWindows.forEach(function (p) {
        p.classList.remove('window-minimized');
        const btn = document.getElementById('task-btn-' + p.id);
        if (btn) btn.classList.add('active');
      });
      openWindows.sort(function (a, b) {
        return (parseInt(b.style.zIndex || 0, 10) - parseInt(a.style.zIndex || 0, 10));
      });
      DesktopOS.focusApp(openWindows[0].id);
    }
  }

  // --- Blog Reader Manager ---
  function initBlogReader() {
    const select = document.getElementById('reader-post-select');

    function switchArticle(slug) {
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
        status.textContent = 'ARTICLE: ' + slug.toUpperCase();
      }

      DesktopOS.openApp('blog-reader-window');
    }

    if (select) {
      select.addEventListener('change', function () {
        switchArticle(this.value);
      });
    }

    // Intercept clicks on blog post links & archive links within Desktop OS
    document.addEventListener('click', function (e) {
      const archiveLink = e.target.closest('.view-all-box a, .retro-btn-link');
      if (archiveLink) {
        e.preventDefault();
        DesktopOS.openApp('file-explorer-window');
        return;
      }

      const anyLink = e.target.closest('a');
      if (anyLink) {
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
          return;
        }
      }
    });

    window.openDesktopArticle = switchArticle;
  }

  // --- File Explorer Integration (Explorer.exe) ---
  function initFileExplorer() {
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

    // Cache initial blog files HTML
    const initialBlogFilesHTML = filesList ? filesList.innerHTML : '';

    // Navigation History Stack
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

      // Highlight active tree item
      treeItems.forEach(function (ti) {
        const match = ti.getAttribute('data-folder') === folderKey;
        ti.classList.toggle('tree-active', match);
      });

      // Clear search if open
      if (searchDropdown) {
        searchDropdown.hidden = true;
        searchDropdown.style.display = 'none';
      }

      if (folderKey === 'blog-archive') {
        if (addressInput) addressInput.value = 'C:\\Documents\\Blog_Archive\\';
        filesList.innerHTML = initialBlogFilesHTML;
        bindFileRows();
        const total = filesList.querySelectorAll('.explorer-file-row').length;
        if (statusCount) statusCount.textContent = total + ' Object(s)';
      } else if (folderKey === 'desktop') {
        if (addressInput) addressInput.value = 'C:\\Desktop\\';
        // Render desktop shortcuts as items in files pane
        let html = '';
        DesktopOS.apps.forEach(function (app) {
          html += `
            <div class="explorer-file-row" data-launch="${app.id}" tabindex="0" role="button" title="Double click or press Enter to launch ${app.title}">
              <div class="file-name">
                <span class="file-icon">${app.icon}</span>
                <span class="file-title-text">${app.title}.lnk</span>
              </div>
              <div class="file-date">2026-10-13</div>
              <div class="file-type">Application Shortcut</div>
              <div class="file-size">1 KB</div>
            </div>
          `;
        });
        filesList.innerHTML = html;
        bindAppRows();
        if (statusCount) statusCount.textContent = DesktopOS.apps.size + ' Object(s)';
      } else if (folderKey === 'documents') {
        if (addressInput) addressInput.value = 'C:\\Documents\\';
        filesList.innerHTML = `
          <div class="explorer-file-row" data-nav="blog-archive" tabindex="0" role="button" title="Open Blog Archive">
            <div class="file-name">
              <span class="file-icon">&#128194;</span>
              <span class="file-title-text">Blog_Archive</span>
            </div>
            <div class="file-date">2026-10-13</div>
            <div class="file-type">File Folder</div>
            <div class="file-size">--</div>
          </div>
          <div class="explorer-file-row" data-launch="sticker-album-window" tabindex="0" role="button" title="Open Sticker Album">
            <div class="file-name">
              <span class="file-icon">&#9733;</span>
              <span class="file-title-text">Sticker_Album.exe</span>
            </div>
            <div class="file-date">2026-10-13</div>
            <div class="file-type">Application Shortcut</div>
            <div class="file-size">2 KB</div>
          </div>
        `;
        bindNavRows();
        if (statusCount) statusCount.textContent = '2 Object(s)';
      } else if (folderKey === 'disk-c') {
        if (addressInput) addressInput.value = 'C:\\';
        filesList.innerHTML = `
          <div class="explorer-file-row" data-nav="desktop" tabindex="0" role="button" title="Open Desktop folder">
            <div class="file-name"><span class="file-icon">&#128194;</span><span class="file-title-text">Desktop</span></div>
            <div class="file-date">2026-10-13</div>
            <div class="file-type">File Folder</div>
            <div class="file-size">--</div>
          </div>
          <div class="explorer-file-row" data-nav="documents" tabindex="0" role="button" title="Open Documents folder">
            <div class="file-name"><span class="file-icon">&#128194;</span><span class="file-title-text">Documents</span></div>
            <div class="file-date">2026-10-13</div>
            <div class="file-type">File Folder</div>
            <div class="file-size">--</div>
          </div>
          <div class="explorer-file-row" tabindex="0" role="button" title="Windows System Folder">
            <div class="file-name"><span class="file-icon">&#128194;</span><span class="file-title-text">WINDOWS</span></div>
            <div class="file-date">2005-08-24</div>
            <div class="file-type">System Folder</div>
            <div class="file-size">--</div>
          </div>
          <div class="explorer-file-row" tabindex="0" role="button" title="Program Files">
            <div class="file-name"><span class="file-icon">&#128194;</span><span class="file-title-text">Program Files</span></div>
            <div class="file-date">2026-10-13</div>
            <div class="file-type">File Folder</div>
            <div class="file-size">--</div>
          </div>
        `;
        bindNavRows();
        if (statusCount) statusCount.textContent = '4 Object(s)';
      } else if (folderKey === 'floppy') {
        if (addressInput) addressInput.value = 'A:\\';
        filesList.innerHTML = `
          <div style="padding: 24px; text-align: center; color: var(--text-muted); font-family: monospace;">
            <div style="font-size: 32px; margin-bottom: 8px;">&#128190;</div>
            <strong>Drive A: is not ready.</strong><br>
            Please insert a 3½-inch floppy disk into drive A: to browse files.
          </div>
        `;
        if (statusCount) statusCount.textContent = '0 Object(s)';
      }
    }

    function bindFileRows() {
      const fileRows = filesList.querySelectorAll('.explorer-file-row[data-slug]');
      fileRows.forEach(function (row) {
        function openFile() {
          const slug = row.getAttribute('data-slug');
          if (slug && window.openDesktopArticle) {
            window.openDesktopArticle(slug);
          }
        }
        row.addEventListener('click', openFile);
        row.addEventListener('keydown', function (e) {
          if (e.key === 'Enter') openFile();
        });
      });
    }

    function bindAppRows() {
      const appRows = filesList.querySelectorAll('.explorer-file-row[data-launch]');
      appRows.forEach(function (row) {
        function launch() {
          const id = row.getAttribute('data-launch');
          if (id) DesktopOS.openApp(id);
        }
        row.addEventListener('click', launch);
        row.addEventListener('keydown', function (e) {
          if (e.key === 'Enter') launch();
        });
      });
    }

    function bindNavRows() {
      const navRows = filesList.querySelectorAll('.explorer-file-row[data-nav]');
      navRows.forEach(function (row) {
        function nav() {
          const target = row.getAttribute('data-nav');
          if (target) renderFolderContent(target, true);
        }
        row.addEventListener('click', nav);
        row.addEventListener('keydown', function (e) {
          if (e.key === 'Enter') nav();
        });
      });
      bindAppRows();
    }

    // Bind Left Folder Tree items
    treeItems.forEach(function (item) {
      item.addEventListener('click', function () {
        const folder = item.getAttribute('data-folder');
        if (folder) renderFolderContent(folder, true);
      });
    });

    // Toolbar navigation buttons
    if (backBtn) {
      backBtn.addEventListener('click', function () {
        if (historyIdx > 0) {
          historyIdx--;
          renderFolderContent(folderHistory[historyIdx], false);
        }
      });
    }

    if (forwardBtn) {
      forwardBtn.addEventListener('click', function () {
        if (historyIdx < folderHistory.length - 1) {
          historyIdx++;
          renderFolderContent(folderHistory[historyIdx], false);
        }
      });
    }

    if (upBtn) {
      upBtn.addEventListener('click', function () {
        if (currentFolder === 'blog-archive') {
          renderFolderContent('documents', true);
        } else if (currentFolder === 'documents' || currentFolder === 'desktop') {
          renderFolderContent('disk-c', true);
        }
      });
    }

    // --- Explorer Live Search & Dropdown Pane ---
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

      // Query blog documents and apps
      const results = [];
      const blogArticles = document.querySelectorAll('.reader-article');

      blogArticles.forEach(function (art) {
        const slug = art.getAttribute('data-slug') || '';
        const titleEl = art.querySelector('.single-post-title');
        const title = titleEl ? titleEl.textContent.trim() : slug;
        const text = art.textContent.toLowerCase();

        if (slug.includes(query) || title.toLowerCase().includes(query) || text.includes(query)) {
          // Extract short snippet around query
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
            meta: `Blog Bulletin &bull; ${slug}.doc`,
            snippet: snippet
          });
        }
      });

      // Also match desktop apps
      DesktopOS.apps.forEach(function (app) {
        if (app.title.toLowerCase().includes(query) || app.id.toLowerCase().includes(query)) {
          results.push({
            type: 'app',
            id: app.id,
            title: app.title,
            meta: `Application &bull; ${app.icon}`,
            snippet: `Desktop Program Shortcut: ${app.title}.lnk`
          });
        }
      });

      // Render search results dropdown pane
      if (searchDropdown && searchResultsList) {
        searchDropdown.hidden = false;
        searchDropdown.style.display = 'flex';
        searchResultsList.innerHTML = '';

        if (results.length === 0) {
          if (searchStatusBar) searchStatusBar.textContent = `No records matching "${query}"`;
          searchResultsList.innerHTML = `<li class="explorer-search-result-item" style="cursor: default; font-style: italic; color: var(--text-muted);">No records found. Try searching by keywords like "reticulum", "linux", "game", or "synth".</li>`;
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
            iconSpan.textContent = res.type === 'app' ? '⚙️' : '📄';

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
              } else {
                if (window.openDesktopArticle) {
                  window.openDesktopArticle(res.id);
                }
              }
              searchDropdown.hidden = true;
              searchDropdown.style.display = 'none';
            }

            li.addEventListener('click', openResult);
            li.addEventListener('keydown', function (e) {
              if (e.key === 'Enter') openResult();
            });

            searchResultsList.appendChild(li);
          });
        }
      }
    }

    if (searchInput) {
      searchInput.addEventListener('input', doSearch);
      searchInput.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
          searchInput.value = '';
          doSearch();
          searchInput.blur();
        }
      });
    }

    if (searchClear) {
      searchClear.addEventListener('click', function () {
        if (searchInput) {
          searchInput.value = '';
          doSearch();
          searchInput.focus();
        }
      });
    }

    if (searchClose) {
      searchClose.addEventListener('click', function () {
        if (searchDropdown) {
          searchDropdown.hidden = true;
          searchDropdown.style.display = 'none';
        }
      });
    }

    // --- Column Header Sorting ---
    let currentSortCol = 'name';
    let sortAsc = true;

    function sortFiles(col) {
      const rows = Array.from(filesList.querySelectorAll('.explorer-file-row'));
      if (rows.length === 0) return;

      if (currentSortCol === col) {
        sortAsc = !sortAsc;
      } else {
        currentSortCol = col;
        sortAsc = true;
      }

      // Update indicator arrows on headers
      document.querySelectorAll('.explorer-files-header span').forEach(function (h) {
        const ind = h.querySelector('.sort-indicator');
        if (ind) ind.textContent = '';
      });
      const activeHeader = document.getElementById('explorer-sort-' + col);
      if (activeHeader) {
        const ind = activeHeader.querySelector('.sort-indicator');
        if (ind) ind.textContent = sortAsc ? '▲' : '▼';
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
          valA = parseInt(a.querySelector('.file-size')?.textContent || '0', 10);
          valB = parseInt(b.querySelector('.file-size')?.textContent || '0', 10);
          return sortAsc ? (valA - valB) : (valB - valA);
        }
        return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
      });

      rows.forEach(function (r) { filesList.appendChild(r); });
    }

    ['name', 'date', 'type', 'size'].forEach(function (col) {
      const header = document.getElementById('explorer-sort-' + col);
      if (header) {
        header.addEventListener('click', function () { sortFiles(col); });
      }
    });

    // --- Menu Bar Interactivity ---
    document.querySelectorAll('.explorer-menubar .explorer-menu-item').forEach(function (item) {
      item.addEventListener('click', function () {
        const menu = item.getAttribute('data-menu');
        if (menu === 'file') {
          if (confirm('Close Explorer.exe session?')) {
            DesktopOS.closeApp('file-explorer-window');
          }
        } else if (menu === 'view') {
          filesList.classList.toggle('view-compact');
        } else if (menu === 'tools') {
          if (searchInput) {
            searchInput.value = '';
            doSearch();
          }
          renderFolderContent('blog-archive', true);
        } else if (menu === 'help') {
          alert("Explorer.exe (Version 2.0)\nAuthentic Retro File Manager & Blog Archive Navigator for Lachlan's World OS.");
        }
      });
    });

    // Initial binding
    bindFileRows();
    updateNavButtons();
  }

  // --- Show Desktop Button (Taskbar Tray) ---
  function initShowDesktopBtn() {
    const showDesktopBtn = document.getElementById('show-desktop-btn');
    if (showDesktopBtn) {
      showDesktopBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        toggleShowDesktop();
      });
    }
  }

  // --- Start Menu Management ---
  function initStartMenu() {
    const startBtn = document.getElementById('start-menu-btn');
    const startMenu = document.getElementById('desktop-start-menu');
    const blogFolder = document.getElementById('start-blog-folder');

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
    });

    document.addEventListener('click', function (e) {
      if (!startMenu.contains(e.target) && e.target !== startBtn && !startBtn.contains(e.target)) {
        closeStartMenu();
      }
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !startMenu.hasAttribute('hidden')) {
        closeStartMenu();
      }
    });

    if (blogFolder) {
      blogFolder.addEventListener('click', function (e) {
        e.stopPropagation();
        const parent = blogFolder.closest('.start-menu-has-submenu');
        if (parent) parent.classList.toggle('open');
      });
    }

    startMenu.addEventListener('click', function (e) {
      const item = e.target.closest('.start-menu-item');
      if (!item) return;

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
    });
  }

  // --- Settings App Integration ---
  function initSettingsApp() {
    const themeSelect = document.getElementById('settings-theme-select');
    const resSpan = document.getElementById('settings-screen-res');
    const resetPosBtn = document.getElementById('settings-reset-pos-btn');
    const clearStickersBtn = document.getElementById('settings-clear-stickers-btn');

    // Settings Window Close / OK Buttons
    document.querySelectorAll('#settings-window [data-window-close], #settings-window .settings-ok-btn').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        DesktopOS.closeApp('settings-window');
      });
    });

    if (themeSelect) {
      themeSelect.addEventListener('change', function () {
        if (typeof window.switchSiteTheme === 'function') {
          window.switchSiteTheme(themeSelect.value);
        }
      });
    }

    // Update screen resolution display
    if (resSpan) {
      resSpan.textContent = `${window.innerWidth}x${window.innerHeight}`;
      window.addEventListener('resize', function () {
        resSpan.textContent = `${window.innerWidth}x${window.innerHeight}`;
      });
    }

    // Sync theme select with active theme
    function syncTheme() {
      const current = document.documentElement.getAttribute('data-theme') || (window.SITE_CONFIG && window.SITE_CONFIG.defaultTheme) || 'paper';
      if (themeSelect && themeSelect.value !== current) {
        themeSelect.value = current;
      }
    }
    syncTheme();
    window.addEventListener('site:themechange', syncTheme);

    // Reset window positions button
    if (resetPosBtn) {
      resetPosBtn.addEventListener('click', function () {
        try {
          localStorage.removeItem(POS_KEY);
          windowPositions = {};
          DesktopOS.apps.forEach(function (app) {
            DesktopOS._positionWindow(app);
          });
          alert('Window positions successfully reset to system defaults!');
        } catch (e) {}
      });
    }

    // Clear desktop stickers button
    if (clearStickersBtn) {
      clearStickersBtn.addEventListener('click', function () {
        if (confirm('Clear all stickers from your desktop wallpaper?')) {
          if (window.clearDesktopStickers) {
            window.clearDesktopStickers();
          }
        }
      });
    }

    // Animated desktop stickers toggle
    const motionToggle = document.getElementById('settings-sticker-motion-toggle');
    if (motionToggle) {
      const isMotionDisabled = localStorage.getItem('lachlan_sticker_motion') === 'disabled';
      motionToggle.checked = !isMotionDisabled;
      motionToggle.addEventListener('change', function () {
        const newState = motionToggle.checked ? 'enabled' : 'disabled';
        try {
          localStorage.setItem('lachlan_sticker_motion', newState);
        } catch (e) {}
        document.documentElement.classList.toggle('stickers-motion-disabled', !motionToggle.checked);
        if (window.applyStickerMotionPreference) {
          window.applyStickerMotionPreference();
        }
      });
    }

    // Tabs switching in Settings.exe
    const tabButtons = document.querySelectorAll('.settings-tab-btn');
    tabButtons.forEach(function (btn) {
      btn.addEventListener('click', function () {
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
      });
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
      const rawWall = localStorage.getItem(WALLPAPER_KEY);
      const customWall = sanitizeWallpaperUrl(rawWall);
      const fitMode = localStorage.getItem(WALLPAPER_FIT_KEY) || 'cover';
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

    // Toggle URL row
    if (wallUrlBtn && wallUrlRow) {
      wallUrlBtn.addEventListener('click', function () {
        const isHidden = wallUrlRow.style.display === 'none';
        wallUrlRow.style.display = isHidden ? 'flex' : 'none';
        if (isHidden && wallUrlInput) {
          wallUrlInput.focus();
        }
      });
    }

    // Apply URL
    if (wallUrlApply && wallUrlInput) {
      wallUrlApply.addEventListener('click', function () {
        const rawUrl = wallUrlInput.value.trim();
        const validUrl = sanitizeWallpaperUrl(rawUrl);
        if (!validUrl) {
          alert('Invalid Image URL! Please provide a valid HTTP/HTTPS image URL (e.g. https://example.com/wallpaper.jpg) or upload a local file.');
          return;
        }
        try {
          localStorage.setItem(WALLPAPER_KEY, validUrl);
          applyCustomWallpaper();
          if (wallUrlRow) wallUrlRow.style.display = 'none';
        } catch (e) {
          alert('Could not save wallpaper URL: ' + e.message);
        }
      });
    }

    // File input handler (reads image, resizes if needed, saves as Data URL)
    if (wallFileInput) {
      wallFileInput.addEventListener('change', function (e) {
        const file = e.target.files && e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function (evt) {
          const rawData = evt.target.result;
          const img = new Image();
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
            ctx.drawImage(img, 0, 0, width, height);

            const compressedData = canvas.toDataURL('image/jpeg', 0.85);
            try {
              localStorage.setItem(WALLPAPER_KEY, compressedData);
              applyCustomWallpaper();
            } catch (err) {
              alert('Image file is too large for browser storage quota! Please try a smaller image.');
            }
          };
          img.src = rawData;
        };
        reader.readAsDataURL(file);
      });
    }

    // Fit mode selector
    if (wallFitSelect) {
      wallFitSelect.addEventListener('change', function () {
        try {
          localStorage.setItem(WALLPAPER_FIT_KEY, wallFitSelect.value);
        } catch (e) {}
        applyCustomWallpaper();
      });
    }

    // Reset Wallpaper
    if (wallResetBtn) {
      wallResetBtn.addEventListener('click', function () {
        try {
          localStorage.removeItem(WALLPAPER_KEY);
          localStorage.removeItem(WALLPAPER_FIT_KEY);
        } catch (e) {}
        applyCustomWallpaper();
      });
    }

    applyCustomWallpaper();
  }

  // --- Global Window Expositions ---
  window.DesktopOS = DesktopOS;
  window.openDesktopWindow = function (appId) { DesktopOS.openApp(appId); };
  window.closeDesktopWindow = function (appId) { DesktopOS.closeApp(appId); };
  window.minimizeDesktopWindow = function (appId) { DesktopOS.minimizeApp(appId); };

  // --- Boot Desktop OS ---
  function init() {
    windowPositions = loadWindowPositions();

    updateClock();
    setInterval(updateClock, 1000);

    DesktopOS.autoDiscover();
    initBlogReader();
    initFileExplorer();
    initShowDesktopBtn();
    initStartMenu();
    initSettingsApp();

    // Delegated window close handler for dialog buttons
    document.addEventListener('click', function (e) {
      const closeBtn = e.target && e.target.closest('[data-window-close]');
      if (closeBtn) {
        const appId = closeBtn.getAttribute('data-window-close');
        if (appId) DesktopOS.closeApp(appId);
      }
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
