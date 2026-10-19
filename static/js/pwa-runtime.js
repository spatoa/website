/**
 * @module PWARuntime
 * @description Standardized client runtime and lifecycle manager for offline Progressive Web Apps (PWAs).
 * Used across standalone games and appliances in Lachlan's World (Desert Golfing, etc.).
 *
 * @exports window.PWARuntime
 */

(function () {
  'use strict';

  /**
   * Registers a dedicated, scoped service worker.
   * @param {string} swUrl - Relative or absolute URL to service worker script.
   * @param {string} scope - App scope path (e.g. '/golf/').
   * @returns {Promise<ServiceWorkerRegistration|null>}
   */
  function registerServiceWorker(swUrl, scope) {
    if (!('serviceWorker' in navigator)) {
      console.info('[PWARuntime] Service Workers not supported in this browser environment.');
      return Promise.resolve(null);
    }

    return new Promise(function (resolve) {
      function doRegister() {
        navigator.serviceWorker.register(swUrl, { scope: scope })
          .then(function (reg) {
            console.log(`[PWARuntime] Service Worker active for scope "${scope}":`, reg.scope);

            // Listen for waiting workers and updates
            reg.addEventListener('updatefound', function () {
              const installingWorker = reg.installing;
              if (installingWorker) {
                installingWorker.addEventListener('statechange', function () {
                  if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                    console.log(`[PWARuntime] New version available for "${scope}". Stale-while-revalidate will apply on next run.`);
                  }
                });
              }
            });

            resolve(reg);
          })
          .catch(function (err) {
            console.warn(`[PWARuntime] Service Worker registration failed for "${scope}":`, err);
            resolve(null);
          });
      }

      if (document.readyState === 'complete') {
        doRegister();
      } else {
        window.addEventListener('load', doRegister);
      }
    });
  }

  /**
   * Checks whether the current window is running inside an installed standalone PWA.
   * @returns {boolean}
   */
  function isStandalone() {
    try {
      return (
        window.matchMedia('(display-mode: standalone)').matches ||
        window.matchMedia('(display-mode: fullscreen)').matches ||
        window.navigator.standalone === true ||
        document.referrer.includes('android-app://')
      );
    } catch (e) {
      return false;
    }
  }

  /**
   * Requests landscape orientation lock on supported devices (Chromium, installed mobile PWAs).
   * Safe to call repeatedly; silently catches permission or browser rejections.
   */
  function lockLandscape() {
    if (screen.orientation && typeof screen.orientation.lock === 'function') {
      try {
        const promise = screen.orientation.lock('landscape');
        if (promise && typeof promise.catch === 'function') {
          promise.catch(function () {
            // In Android Chrome, orientation.lock requires fullscreen mode.
            // Attempt requestFullscreen on active user gesture if supported.
            if (!document.fullscreenElement && typeof document.documentElement.requestFullscreen === 'function') {
              document.documentElement.requestFullscreen().then(function () {
                if (screen.orientation && typeof screen.orientation.lock === 'function') {
                  screen.orientation.lock('landscape').catch(function () {});
                }
              }).catch(function () {});
            }
          });
        }
      } catch (e) {}
    }
  }

  /**
   * Automatically requests orientation lock on the first user interaction (tap/click),
   * satisfying browser security policies requiring an active user gesture.
   */
  function attachGestureOrientationLock() {
    function onGesture() {
      lockLandscape();
      window.removeEventListener('pointerdown', onGesture, { capture: true });
      window.removeEventListener('touchstart', onGesture, { capture: true });
      window.removeEventListener('click', onGesture, { capture: true });
    }

    window.addEventListener('pointerdown', onGesture, { capture: true, once: true });
    window.addEventListener('touchstart', onGesture, { capture: true, once: true });
    window.addEventListener('click', onGesture, { capture: true, once: true });
  }

  /**
   * Binds fullscreen viewport resize observers to guarantee 100vw x 100dvh coverage
   * without mobile address bar or home bar jumps.
   *
   * @param {HTMLCanvasElement} canvas - The primary rendering canvas element.
   * @param {function(number, number): void} onResize - Callback invoked with (width, height).
   */
  function bindViewport(canvas, onResize) {
    let pendingRaf = null;

    function getViewportDimensions() {
      let w = window.innerWidth;
      let h = window.innerHeight;

      if (window.visualViewport) {
        w = Math.round(window.visualViewport.width);
        h = Math.round(window.visualViewport.height);
      } else if (document.documentElement) {
        w = document.documentElement.clientWidth || w;
        h = document.documentElement.clientHeight || h;
      }

      return { width: Math.max(1, w), height: Math.max(1, h) };
    }

    function notifyResize() {
      if (pendingRaf) return;
      pendingRaf = requestAnimationFrame(function () {
        pendingRaf = null;
        if (typeof onResize === 'function') {
          const rect = canvas ? canvas.getBoundingClientRect() : null;
          if (rect && rect.width > 0 && rect.height > 0) {
            onResize(rect.width, rect.height);
          } else {
            const dims = getViewportDimensions();
            onResize(dims.width, dims.height);
          }
        }
      });
    }

    window.addEventListener('resize', notifyResize, { passive: true });
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', notifyResize, { passive: true });
    }
    window.addEventListener('orientationchange', function () {
      notifyResize();
      setTimeout(notifyResize, 120);
      setTimeout(notifyResize, 300);
    }, { passive: true });

    // Initial trigger
    notifyResize();
  }

  window.PWARuntime = {
    registerServiceWorker: registerServiceWorker,
    isStandalone: isStandalone,
    lockLandscape: lockLandscape,
    attachGestureOrientationLock: attachGestureOrientationLock,
    bindViewport: bindViewport
  };
})();
