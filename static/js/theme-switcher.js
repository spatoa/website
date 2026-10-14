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
  const defaultTheme = (window.SITE_CONFIG && window.SITE_CONFIG.defaultTheme) || document.documentElement.getAttribute('data-theme') || 'paper';

  // --- Theme Management ---
  const VALID_THEMES = ['paper', 'windows', 'midnight', 'cyber-y2k', 'candy-2000', 'scene-punk'];

  function applyTheme(theme) {
    if (!VALID_THEMES.includes(theme)) {
      theme = defaultTheme;
    }
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_KEY, theme);

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
    if (!['default', 'medium', 'large'].includes(scale)) {
      scale = 'default';
    }
    document.documentElement.setAttribute('data-font-scale', scale);
    localStorage.setItem(FONT_KEY, scale);

    // Update active state on all font scale buttons across portal and desktop windows
    document.querySelectorAll('.font-btn[data-font-scale]').forEach(function (btn) {
      btn.classList.toggle('active', btn.getAttribute('data-font-scale') === scale);
    });

    // Backward compatibility for non-annotated elements if any exist
    const btnSm = document.getElementById('font-btn-sm');
    const btnMd = document.getElementById('font-btn-md');
    const btnLg = document.getElementById('font-btn-lg');
    if (btnSm && !btnSm.hasAttribute('data-font-scale')) btnSm.classList.toggle('active', scale === 'default');
    if (btnMd && !btnMd.hasAttribute('data-font-scale')) btnMd.classList.toggle('active', scale === 'medium');
    if (btnLg && !btnLg.hasAttribute('data-font-scale')) btnLg.classList.toggle('active', scale === 'large');
  }

  window.setFontScale = function (scale) {
    applyFontScale(scale);
  };

  // Initialize on DOM load
  document.addEventListener('DOMContentLoaded', function () {
    const savedTheme = localStorage.getItem(THEME_KEY) || defaultTheme;
    applyTheme(savedTheme);

    const savedFont = localStorage.getItem(FONT_KEY) || 'default';
    applyFontScale(savedFont);

    // Declarative event listeners (replaces inline onclick and onchange handlers)
    document.addEventListener('change', function (e) {
      if (e.target && (e.target.matches('select[data-theme-select], #theme-selector, #settings-theme-select'))) {
        applyTheme(e.target.value);
      }
    });

    document.addEventListener('click', function (e) {
      const fontBtn = e.target && e.target.closest('.font-btn[data-font-scale]');
      if (fontBtn) {
        applyFontScale(fontBtn.getAttribute('data-font-scale'));
      }
    });
  });
})();
