/**
 * @module WordArt
 * @description Authentic Microsoft Office 97/2000/XP WordArt styling generator.
 * Provides CSS gradient and transform algorithms for vintage retro title banners.
 *
 * @dependencies
 * - DOM: .wordart
 *
 * @exports
 * - window.randomizeWordArt
 *
 * @storageKeys
 * - lachlan_wordart_style (localStorage: active preset index)
 */

(function () {
  'use strict';

  var WORDART_STYLES = [
    'wordart-rainbow',
    'wordart-chrome',
    'wordart-sunset',
    'wordart-extruded-blue',
    'wordart-outline-shadow',
    'wordart-purple-wave',
    'wordart-neon-lime',
    'wordart-gold-bevel',
    'wordart-superhero',
    'wordart-inflatable'
  ];

  var STORAGE_KEY = 'lachlan_wordart_style';

  function getRandomStyle(currentStyle) {
    var pool = WORDART_STYLES.filter(function (s) {
      return s !== currentStyle;
    });
    if (!pool.length) pool = WORDART_STYLES;
    var index = Math.floor(Math.random() * pool.length);
    return pool[index];
  }

  function applyWordArtStyle(el, newStyle) {
    if (!el) return;
    WORDART_STYLES.forEach(function (s) {
      el.classList.remove(s);
    });
    el.classList.add(newStyle);
    try {
      sessionStorage.setItem(STORAGE_KEY, newStyle);
    } catch (e) {}
  }

  function initWordArt() {
    var titleEl = document.getElementById('site-banner-title');
    if (!titleEl) return;

    var currentStyle = null;
    WORDART_STYLES.forEach(function (s) {
      if (titleEl.classList.contains(s)) {
        currentStyle = s;
      }
    });

    // If an initial style wasn't already attached by inline bootstrap, pick one
    if (!currentStyle) {
      var savedStyle = null;
      try {
        savedStyle = sessionStorage.getItem(STORAGE_KEY);
      } catch (e) {}
      var chosenStyle = getRandomStyle(savedStyle);
      applyWordArtStyle(titleEl, chosenStyle);
    }

    // Interactive easter egg: clicking title cycles to another WordArt style
    titleEl.addEventListener('click', function () {
      var active = WORDART_STYLES.find(function (s) {
        return titleEl.classList.contains(s);
      });
      var next = getRandomStyle(active);
      applyWordArtStyle(titleEl, next);
    });

    titleEl.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        var active = WORDART_STYLES.find(function (s) {
          return titleEl.classList.contains(s);
        });
        var next = getRandomStyle(active);
        applyWordArtStyle(titleEl, next);
      }
    });
  }

  // Expose global helper API
  window.randomizeWordArt = function () {
    var titleEl = document.getElementById('site-banner-title');
    if (titleEl) {
      var active = WORDART_STYLES.find(function (s) {
        return titleEl.classList.contains(s);
      });
      var next = getRandomStyle(active);
      applyWordArtStyle(titleEl, next);
      return next;
    }
    return null;
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initWordArt);
  } else {
    initWordArt();
  }
})();
