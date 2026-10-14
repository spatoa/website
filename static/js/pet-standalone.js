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

  // Register PWA Service Worker for offline play
  function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', function () {
        navigator.serviceWorker.register('/pet-sw.js', { scope: '/pet/' })
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

    function openMenuButton(btn) {
      closeAllMenus();
      btn.classList.add('active');
      btn.setAttribute('aria-expanded', 'true');
      const menuId = btn.getAttribute('data-menu');
      const targetMenu = document.getElementById(menuId);
      if (targetMenu) {
        targetMenu.classList.add('open');
      }
    }

    menuButtons.forEach(function (btn, idx) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        const isOpen = btn.classList.contains('active');
        if (isOpen) {
          closeAllMenus();
        } else {
          openMenuButton(btn);
        }
      });

      btn.addEventListener('mouseenter', function () {
        const anyOpen = Array.from(menuButtons).some(function (b) {
          return b.classList.contains('active');
        });
        if (anyOpen) {
          openMenuButton(btn);
        }
      });

      btn.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openMenuButton(btn);
          const menuId = btn.getAttribute('data-menu');
          const targetMenu = document.getElementById(menuId);
          const firstItem = targetMenu ? targetMenu.querySelector('.win-dropdown-item') : null;
          if (firstItem) firstItem.focus();
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          const nextBtn = menuButtons[(idx + 1) % menuButtons.length];
          if (nextBtn) {
            nextBtn.focus();
            if (btn.classList.contains('active')) openMenuButton(nextBtn);
          }
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          const prevBtn = menuButtons[(idx - 1 + menuButtons.length) % menuButtons.length];
          if (prevBtn) {
            prevBtn.focus();
            if (btn.classList.contains('active')) openMenuButton(prevBtn);
          }
        }
      });
    });

    dropdowns.forEach(function (drop) {
      drop.addEventListener('keydown', function (e) {
        const items = Array.from(drop.querySelectorAll('.win-dropdown-item'));
        const curIdx = items.indexOf(document.activeElement);
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          const nextIdx = (curIdx + 1) % items.length;
          if (items[nextIdx]) items[nextIdx].focus();
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          const prevIdx = (curIdx - 1 + items.length) % items.length;
          if (items[prevIdx]) items[prevIdx].focus();
        }
      });
    });

    document.addEventListener('click', function (e) {
      if (!e.target || typeof e.target.closest !== 'function' || !e.target.closest('.win-menubar')) {
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
        openModal('pet-help-modal', helpBtn);
      });
    }

    // Help -> About
    const aboutBtn = document.getElementById('menu-help-about');
    if (aboutBtn) {
      aboutBtn.addEventListener('click', function () {
        closeAllMenus();
        openModal('pet-about-modal', aboutBtn);
      });
    }

    // Options -> Skin Switcher
    const skinButtons = document.querySelectorAll('.menu-skin-btn');
    skinButtons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        const skinId = btn.getAttribute('data-skin');
        if (skinId && window.Pocket_Pet && typeof window.Pocket_Pet.setSkin === 'function') {
          window.Pocket_Pet.setSkin(skinId);
        } else if (skinId) {
          safeSetItem('lachlan_pet_skin', skinId);
          document.querySelectorAll('.pocket_pet-deck').forEach(function (deck) {
            deck.setAttribute('data-pet-skin', skinId);
          });
        }
        updateActiveSkinUI();
        closeAllMenus();
      });
    });

    function updateActiveSkinUI() {
      const activeSkin = (window.Pocket_Pet && typeof window.Pocket_Pet.getSkin === 'function')
        ? window.Pocket_Pet.getSkin()
        : (safeGetItem('lachlan_pet_skin') || 'windows');

      document.querySelectorAll('.menu-skin-btn').forEach(function (btn) {
        const isCurrent = btn.getAttribute('data-skin') === activeSkin;
        btn.classList.toggle('active-skin', isCurrent);
        btn.setAttribute('aria-checked', isCurrent ? 'true' : 'false');
      });
    }

    updateActiveSkinUI();
    updateSoundLabel();
  }

  // --- Export Save to JSON File ---
  function exportSave() {
    try {
      const rawData = safeGetItem(STORAGE_KEY);
      if (!rawData) {
        alert('No saved pet data found to export. Hatch an egg first!');
        return;
      }
      const dataObj = JSON.parse(rawData);
      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10);
      const safeSpecies = String(dataObj.species || dataObj.stage || 'egg').replace(/[^a-zA-Z0-9_-]/g, '');
      const filename = `pocket_pet_save_${safeSpecies}_${dateStr}.json`;

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
    reader.onerror = function () {
      alert('Failed to read the selected save file.');
    };
    reader.onload = function (e) {
      try {
        const text = e.target.result;
        const parsed = JSON.parse(text);

        // Schema verification & normalization
        if (typeof parsed !== 'object' || parsed === null) {
          alert('Invalid save file format. Please upload a valid Pocket Pet JSON save file.');
          return;
        }

        let validated;
        if (window.Pocket_Pet && typeof window.Pocket_Pet.validateState === 'function') {
          validated = window.Pocket_Pet.validateState(parsed);
        } else {
          if (!('stage' in parsed) || !('bornTimestamp' in parsed)) {
            alert('Invalid save file format. Missing core pet properties.');
            return;
          }
          validated = parsed;
        }

        const species = validated.species || validated.stage || 'egg';
        const confirmMsg = `Restore pet save for "${species}" (Stage: ${validated.stage})?\nThis will replace your current pet save.`;
        if (confirm(confirmMsg)) {
          safeSetItem(STORAGE_KEY, JSON.stringify(validated));
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
    const isMuted = safeGetItem(SOUND_KEY) === 'muted';
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
      safeSetItem(THEME_KEY, nextTheme);
    }
  }

  // --- Modal Helpers ---
  let lastModalTrigger = null;

  function openModal(id, triggerEl) {
    const modal = document.getElementById(id);
    if (modal) {
      lastModalTrigger = triggerEl || document.activeElement;
      modal.classList.add('visible');
      const closeBtn = modal.querySelector('.modal-ok-btn') || modal.querySelector('.window-btn');
      if (closeBtn) closeBtn.focus();
    }
  }

  function closeModal(id) {
    const modal = document.getElementById(id);
    if (modal && modal.classList.contains('visible')) {
      modal.classList.remove('visible');
      if (lastModalTrigger && typeof lastModalTrigger.focus === 'function') {
        lastModalTrigger.focus();
        lastModalTrigger = null;
      }
    }
  }

  function initModals() {
    document.querySelectorAll('.modal-overlay').forEach(function (overlay) {
      overlay.addEventListener('click', function (e) {
        if (e.target === overlay) {
          closeModal(overlay.id);
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
          if (parentModal) closeModal(parentModal.id);
        }
      });
    });
  }

  // Initialize on DOM Ready
  function init() {
    registerServiceWorker();
    initMenuBar();
    initModals();

    const muteBtn = document.getElementById('pocket_pet-mute-toggle');
    if (muteBtn) {
      muteBtn.addEventListener('click', updateSoundLabel);
    }

    // Deep-linking hash support (#help, #about)
    function checkUrlHash() {
      if (window.location.hash === '#help') {
        openModal('pet-help-modal');
      } else if (window.location.hash === '#about') {
        openModal('pet-about-modal');
      } else if (window.location.hash.startsWith('#skin-')) {
        const targetSkin = window.location.hash.replace('#skin-', '');
        if (window.Pocket_Pet && typeof window.Pocket_Pet.setSkin === 'function') {
          window.Pocket_Pet.setSkin(targetSkin);
        }
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
