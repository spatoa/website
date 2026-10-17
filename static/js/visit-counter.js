/**
 * @module VisitCounter
 * @description Retro mechanical odometer personal visit counter.
 * Tracks visits per user using localStorage with a sessionStorage guard to prevent reload spam,
 * rendering a classic 7-digit rolling counter with ordinal suffixes.
 *
 * @dependencies
 * - DOM: #visit-counter-odometer, #visit-counter-text
 *
 * @exports
 * - window.VisitCounter
 *
 * @storageKeys
 * - lachlan_user_visits (localStorage: total visit count string)
 * - lachlan_session_visited (sessionStorage: boolean flag)
 */

(function () {
  'use strict';

  const STORAGE_KEY = 'lachlan_user_visits';
  const SESSION_KEY = 'lachlan_session_visited';

  function getOrdinalSuffix(n) {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return s[(v - 20) % 10] || s[v] || s[0];
  }

  function getVisitCount() {
    try {
      const stored = parseInt(localStorage.getItem(STORAGE_KEY), 10);
      return isNaN(stored) || stored < 1 ? 1 : stored;
    } catch (e) {
      return 1;
    }
  }

  function updateVisitCount() {
    let count = 1;
    let isSessionCounted = false;
    try {
      isSessionCounted = Boolean(sessionStorage.getItem(SESSION_KEY));
    } catch (e) {
      isSessionCounted = false;
    }

    if (!isSessionCounted) {
      let stored = NaN;
      try {
        stored = parseInt(localStorage.getItem(STORAGE_KEY), 10);
      } catch (e) {}
      count = isNaN(stored) || stored < 1 ? 1 : stored + 1;
      try {
        localStorage.setItem(STORAGE_KEY, String(count));
        sessionStorage.setItem(SESSION_KEY, 'true');
      } catch (e) {
        // Handle private browsing or storage quota issues gracefully
      }
    } else {
      count = getVisitCount();
    }

    return count;
  }

  function render(count) {
    const safeCount = (typeof count === 'number' && !isNaN(count) && count >= 1) ? Math.floor(count) : 1;
    const formatted = String(safeCount).padStart(7, '0');

    // Update all counter boxes on the page (supports status panel and settings window)
    const boxes = document.querySelectorAll('.counter-box, #counter-box');
    boxes.forEach(function (box) {
      box.replaceChildren();
      box.setAttribute('aria-label', 'Visit count: ' + safeCount);
      for (let i = 0; i < formatted.length; i++) {
        const span = document.createElement('span');
        span.className = 'counter-digit';
        span.setAttribute('aria-hidden', 'true');
        span.textContent = formatted[i];
        box.appendChild(span);
      }
    });

    // Format personalized visit message
    const suffix = getOrdinalSuffix(safeCount);
    const message = safeCount === 1
      ? 'Welcome! This is your 1st visit to this portal.'
      : `Welcome back! This is your ${safeCount}${suffix} visit to this portal.`;

    const subtexts = document.querySelectorAll('.counter-subtext, #counter-subtext');
    subtexts.forEach(function (subtext) {
      subtext.textContent = message;
    });
  }

  function init() {
    const count = updateVisitCount();
    render(count);
  }

  // Expose clean helper methods for inspection or debugging
  window.VisitCounter = {
    getCount: function () {
      return getVisitCount();
    },
    resetCount: function () {
      try {
        localStorage.removeItem(STORAGE_KEY);
        sessionStorage.removeItem(SESSION_KEY);
      } catch (e) {}
      init();
    },
    refresh: function () {
      render(getVisitCount());
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
