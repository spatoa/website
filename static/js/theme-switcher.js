/**
 * theme-switcher.js - High-Contrast Theme Switcher & Accessibility Font Sizing
 * Lachlan's World (Web 2.0)
 *
 * Manages Tech Paper, Windows Classic, and Midnight Dark themes,
 * as well as accessible font-scaling controls with localStorage persistence.
 */

(function () {
  'use strict';

  const THEME_KEY = 'lachlan_site_theme';
  const FONT_KEY = 'lachlan_font_scale';
  const VALID_THEMES = ['paper', 'windows', 'midnight', 'cyber-y2k', 'candy-2000', 'scene-punk'];
  const VALID_SCALES = ['default', 'medium', 'large'];

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

  const rawDefault = (window.SITE_CONFIG && window.SITE_CONFIG.defaultTheme) || document.documentElement.getAttribute('data-theme') || 'paper';
  const defaultTheme = VALID_THEMES.includes(rawDefault) ? rawDefault : 'paper';

  // --- Theme Management ---
  function applyTheme(theme) {
    if (!VALID_THEMES.includes(theme)) {
      theme = defaultTheme;
    }
    document.documentElement.setAttribute('data-theme', theme);
    safeSetItem(THEME_KEY, theme);

    // Sync all theme dropdown elements across navigation and settings windows
    document.querySelectorAll('select[data-theme-select], #theme-selector, #settings-theme-select').forEach(function (select) {
      if (select.value !== theme) {
        select.value = theme;
      }
    });

    // Notify listeners (e.g. screensaver canvas)
    window.dispatchEvent(new CustomEvent('site:themechange', { detail: { theme: theme } }));
  }

  window.switchSiteTheme = function (themeName) {
    applyTheme(themeName);
  };

  // --- Font Scaling Management ---
  function applyFontScale(scale) {
    if (!VALID_SCALES.includes(scale)) {
      scale = 'default';
    }
    document.documentElement.setAttribute('data-font-scale', scale);
    safeSetItem(FONT_KEY, scale);

    // Update active state and aria-pressed on all font scale buttons across portal and desktop windows
    document.querySelectorAll('.font-btn[data-font-scale]').forEach(function (btn) {
      const isActive = btn.getAttribute('data-font-scale') === scale;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });

    // Backward compatibility for non-annotated elements if any exist
    const btnSm = document.getElementById('font-btn-sm');
    const btnMd = document.getElementById('font-btn-md');
    const btnLg = document.getElementById('font-btn-lg');
    if (btnSm && !btnSm.hasAttribute('data-font-scale')) {
      btnSm.classList.toggle('active', scale === 'default');
      btnSm.setAttribute('aria-pressed', scale === 'default' ? 'true' : 'false');
    }
    if (btnMd && !btnMd.hasAttribute('data-font-scale')) {
      btnMd.classList.toggle('active', scale === 'medium');
      btnMd.setAttribute('aria-pressed', scale === 'medium' ? 'true' : 'false');
    }
    if (btnLg && !btnLg.hasAttribute('data-font-scale')) {
      btnLg.classList.toggle('active', scale === 'large');
      btnLg.setAttribute('aria-pressed', scale === 'large' ? 'true' : 'false');
    }
  }

  window.setFontScale = function (scale) {
    applyFontScale(scale);
  };

  let initialized = false;
  function init() {
    if (initialized) return;
    initialized = true;

    const savedTheme = safeGetItem(THEME_KEY) || defaultTheme;
    applyTheme(savedTheme);

    const savedFont = safeGetItem(FONT_KEY) || 'default';
    applyFontScale(savedFont);

    // Declarative event listeners
    document.addEventListener('change', function (e) {
      if (e.target && typeof e.target.matches === 'function' && e.target.matches('select[data-theme-select], #theme-selector, #settings-theme-select')) {
        applyTheme(e.target.value);
      }
    });

    document.addEventListener('click', function (e) {
      const fontBtn = e.target && typeof e.target.closest === 'function' && e.target.closest('.font-btn[data-font-scale]');
      if (fontBtn) {
        applyFontScale(fontBtn.getAttribute('data-font-scale'));
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
