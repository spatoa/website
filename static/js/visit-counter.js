/**
 * visit-counter.js - Personal Visit Counter
 * Lachlan's World (Web 2.0)
 *
 * Tracks individual visits from the current user using localStorage & sessionStorage.
 * Increments once per browser session to prevent reload spam, rendering
 * a classic 7-digit retro odometer display with personalized visit text.
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
    const stored = parseInt(localStorage.getItem(STORAGE_KEY), 10);
    return isNaN(stored) || stored < 1 ? 1 : stored;
  }

  function updateVisitCount() {
    let count;
    const isSessionCounted = Boolean(sessionStorage.getItem(SESSION_KEY));

    if (!isSessionCounted) {
      const stored = parseInt(localStorage.getItem(STORAGE_KEY), 10);
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
    const formatted = String(count).padStart(7, '0');

    // Update all counter boxes on the page (supports status panel and settings window)
    const boxes = document.querySelectorAll('.counter-box, #counter-box');
    boxes.forEach(function (box) {
      box.innerHTML = '';
      for (let i = 0; i < formatted.length; i++) {
        const span = document.createElement('span');
        span.className = 'counter-digit';
        span.textContent = formatted[i];
        box.appendChild(span);
      }
    });

    // Format personalized visit message
    const suffix = getOrdinalSuffix(count);
    const message = count === 1
      ? 'Welcome! This is your 1st visit to this portal.'
      : `Welcome back! This is your ${count}${suffix} visit to this portal.`;

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
