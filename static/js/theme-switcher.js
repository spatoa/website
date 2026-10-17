/**
 * @module ThemeSwitcher
 * @description Manages site-wide themes (paper, windows, midnight, cyber-y2k, candy-2000, scene-punk).
 * Persists theme selection to localStorage and updates document.body class hierarchy.
 *
 * @dependencies
 * - DOM: select[data-theme-select], #theme-selector, #settings-theme-select
 * - window.SITE_CONFIG
 *
 * @exports
 * - window.switchSiteTheme
 *
 * @storageKeys
 * - lachlan_site_theme (string: theme name)
 */

(function () {
  'use strict';

  const THEME_KEY = 'lachlan_site_theme';
  const VALID_THEMES = ['paper', 'windows', 'midnight', 'cyber-y2k', 'candy-2000', 'scene-punk'];

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

  function safeRemoveItem(key) {
    try {
      localStorage.removeItem(key);
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

  let initialized = false;
  function init() {
    if (initialized) return;
    initialized = true;

    // Purge any legacy font-scale storage or attribute
    safeRemoveItem('lachlan_font_scale');
    document.documentElement.removeAttribute('data-font-scale');

    const savedTheme = safeGetItem(THEME_KEY) || defaultTheme;
    applyTheme(savedTheme);

    // Declarative event listeners
    document.addEventListener('change', function (e) {
      if (e.target && typeof e.target.matches === 'function' && e.target.matches('select[data-theme-select], #theme-selector, #settings-theme-select')) {
        applyTheme(e.target.value);
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
