/**
 * pet-standalone.js - Standalone Win32 Appliance Controller & PWA Integration
 * Dedicated to Lachlan's World (/pet)
 */

(function () {
  'use strict';

  const STORAGE_KEY = 'lachlan_pocket_pet_v1';
  const SOUND_KEY = 'lachlan_pocket_pet_sound';
  const THEME_KEY = 'lachlan_site_theme';
  const THEMES = ['windows', 'paper', 'midnight', 'cyber-y2k', 'candy-2000', 'scene-punk'];

  // Register PWA Service Worker for offline play
  function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', function () {
        navigator.serviceWorker.register('/pet-sw.js', { scope: '/' })
          .then(function (reg) {
            console.log('[PocketPet PWA] Service Worker registered with scope:', reg.scope);
          })
          .catch(function (err) {
            console.warn('[PocketPet PWA] Service Worker registration failed:', err);
          });
      });
    }
  }

  // --- Win32 Menu Bar Management ---
  function initMenuBar() {
    const menuButtons = document.querySelectorAll('.win-menu-btn');
    const dropdowns = document.querySelectorAll('.win-dropdown-menu');

    function closeAllMenus() {
      dropdowns.forEach(function (drop) {
        drop.classList.remove('open');
      });
      menuButtons.forEach(function (btn) {
        btn.classList.remove('active');
        btn.setAttribute('aria-expanded', 'false');
      });
    }

    menuButtons.forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        const isOpen = btn.classList.contains('active');
        closeAllMenus();
        if (!isOpen) {
          btn.classList.add('active');
          btn.setAttribute('aria-expanded', 'true');
          const menuId = btn.getAttribute('data-menu');
          const targetMenu = document.getElementById(menuId);
          if (targetMenu) {
            targetMenu.classList.add('open');
          }
        }
      });

      btn.addEventListener('mouseenter', function () {
        const anyOpen = Array.from(menuButtons).some(function (b) {
          return b.classList.contains('active');
        });
        if (anyOpen) {
          closeAllMenus();
          btn.classList.add('active');
          btn.setAttribute('aria-expanded', 'true');
          const menuId = btn.getAttribute('data-menu');
          const targetMenu = document.getElementById(menuId);
          if (targetMenu) {
            targetMenu.classList.add('open');
          }
        }
      });
    });

    document.addEventListener('click', function (e) {
      if (!e.target.closest('.win-menubar')) {
        closeAllMenus();
      }
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        closeAllMenus();
        closeModal('pet-help-modal');
        closeModal('pet-about-modal');
      }
    });

    // --- Menu Item Handlers ---
    // File -> Export Save
    const exportBtn = document.getElementById('menu-file-export');
    if (exportBtn) {
      exportBtn.addEventListener('click', function () {
        closeAllMenus();
        exportSave();
      });
    }

    // File -> Import Save
    const importBtn = document.getElementById('menu-file-import');
    const fileInput = document.getElementById('pet-import-file');
    if (importBtn && fileInput) {
      importBtn.addEventListener('click', function () {
        closeAllMenus();
        fileInput.value = '';
        fileInput.click();
      });

      fileInput.addEventListener('change', function (e) {
        const file = e.target.files && e.target.files[0];
        if (file) {
          importSaveFile(file);
        }
      });
    }

    // File -> Reset Pet
    const menuResetBtn = document.getElementById('menu-file-reset');
    if (menuResetBtn) {
      menuResetBtn.addEventListener('click', function () {
        closeAllMenus();
        const resetBtn = document.getElementById('pocket_pet-reset-btn');
        if (resetBtn) resetBtn.click();
      });
    }

    // Options -> Toggle Sound
    const soundItem = document.getElementById('menu-opt-sound');
    if (soundItem) {
      soundItem.addEventListener('click', function () {
        closeAllMenus();
        const muteBtn = document.getElementById('pocket_pet-mute-toggle');
        if (muteBtn) {
          muteBtn.click();
          updateSoundLabel();
        }
      });
    }

    // Options -> Cycle Theme
    const themeItem = document.getElementById('menu-opt-theme');
    if (themeItem) {
      themeItem.addEventListener('click', function () {
        closeAllMenus();
        cycleSiteTheme();
      });
    }

    // Help -> Controls
    const helpBtn = document.getElementById('menu-help-controls');
    if (helpBtn) {
      helpBtn.addEventListener('click', function () {
        closeAllMenus();
        openModal('pet-help-modal');
      });
    }

    // Help -> About
    const aboutBtn = document.getElementById('menu-help-about');
    if (aboutBtn) {
      aboutBtn.addEventListener('click', function () {
        closeAllMenus();
        openModal('pet-about-modal');
      });
    }

    updateSoundLabel();
  }

  // --- Export Save to JSON File ---
  function exportSave() {
    try {
      const rawData = localStorage.getItem(STORAGE_KEY);
      if (!rawData) {
        alert('No saved pet data found to export. Hatch an egg first!');
        return;
      }
      const dataObj = JSON.parse(rawData);
      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10);
      const filename = `pocket_pet_save_${dataObj.species || 'egg'}_${dateStr}.json`;

      const blob = new Blob([JSON.stringify(dataObj, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('Error exporting save file: ' + err.message);
    }
  }

  // --- Import Save from JSON File ---
  function importSaveFile(file) {
    const reader = new FileReader();
    reader.onload = function (e) {
      try {
        const text = e.target.result;
        const parsed = JSON.parse(text);

        // Basic schema verification
        if (typeof parsed !== 'object' || parsed === null || !('stage' in parsed) || !('bornTimestamp' in parsed)) {
          alert('Invalid save file format. Please upload a valid Pocket Pet JSON save file.');
          return;
        }

        const species = parsed.species || parsed.stage || 'egg';
        const confirmMsg = `Restore pet save for "${species}" (Stage: ${parsed.stage})?\nThis will replace your current pet save.`;
        if (confirm(confirmMsg)) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
          if (window.Pocket_Pet && typeof window.Pocket_Pet.init === 'function') {
            window.Pocket_Pet.init();
          } else {
            window.location.reload();
          }
          alert(`Pocket Pet restored successfully: ${species}!`);
        }
      } catch (err) {
        alert('Failed to parse save file: ' + err.message);
      }
    };
    reader.readAsText(file);
  }

  // --- Sound Label Sync ---
  function updateSoundLabel() {
    const soundItem = document.getElementById('menu-opt-sound');
    if (!soundItem) return;
    const isMuted = localStorage.getItem(SOUND_KEY) === 'muted';
    soundItem.textContent = isMuted ? '🔇 Sound: OFF (Click to Unmute)' : '🔊 Sound: ON (Click to Mute)';
  }

  // --- Cycle Site Theme ---
  function cycleSiteTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'windows';
    const currentIndex = THEMES.indexOf(currentTheme);
    const nextIndex = (currentIndex + 1) % THEMES.length;
    const nextTheme = THEMES[nextIndex];

    if (typeof window.switchSiteTheme === 'function') {
      window.switchSiteTheme(nextTheme);
    } else {
      document.documentElement.setAttribute('data-theme', nextTheme);
      try {
        localStorage.setItem(THEME_KEY, nextTheme);
      } catch (e) {}
    }
  }

  // --- Modal Helpers ---
  function openModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
      modal.classList.add('visible');
      const closeBtn = modal.querySelector('.modal-ok-btn') || modal.querySelector('.window-close-btn');
      if (closeBtn) closeBtn.focus();
    }
  }

  function closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
      modal.classList.remove('visible');
    }
  }

  function initModals() {
    document.querySelectorAll('.modal-overlay').forEach(function (overlay) {
      overlay.addEventListener('click', function (e) {
        if (e.target === overlay) {
          overlay.classList.remove('visible');
        }
      });
    });

    document.querySelectorAll('.modal-close-trigger').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const modalId = btn.getAttribute('data-target');
        if (modalId) {
          closeModal(modalId);
        } else {
          const parentModal = btn.closest('.modal-overlay');
          if (parentModal) parentModal.classList.remove('visible');
        }
      });
    });
  }

  // Initialize on DOM Ready
  function init() {
    registerServiceWorker();
    initMenuBar();
    initModals();

    // Listen to changes in mute toggle button from pocket_pet.js
    // Deep-linking hash support (#help, #about)
    function checkUrlHash() {
      if (window.location.hash === '#help') {
        openModal('pet-help-modal');
      } else if (window.location.hash === '#about') {
        openModal('pet-about-modal');
      }
    }
    checkUrlHash();
    window.addEventListener('hashchange', checkUrlHash);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
