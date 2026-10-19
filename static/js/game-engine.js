/**
 * @module GameEngine
 * @description Modular Game Cartridge Registry and Container Host Engine for Lachlan's World.
 * Enables retro mini-games to be mounted, unmounted, swapped, and isolated across
 * both the Web Portal interactive widget (/) and Desktop OS windows (/desktop/).
 *
 * @exports
 * - window.GameEngine
 *
 * @storageKeys
 * - lachlan_active_portal_game (string ID of current or last active portal cartridge)
 */

(function () {
  'use strict';

  const STORAGE_KEY = 'lachlan_active_portal_game';
  const cartridges = new Map();
  const mountedInstances = new Map(); // targetElement -> { cartridgeId, instance, unmountHandler }

  function safeGetStorage(key) {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      return null;
    }
  }

  function safeSetStorage(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch (e) {}
  }

  function resolveCanvas(target) {
    if (!target) return null;
    if (typeof target !== 'string') return target;
    const cleanId = target.startsWith('#') ? target.slice(1) : target;
    return document.getElementById(cleanId) || document.querySelector(target);
  }

  const GameEngine = {
    /**
     * Register a new game cartridge into the registry.
     * @param {string} id
     * @param {Object} def - { id, title, icon, description, createInstance: function(canvas, options) -> { start, pause, stop, resize, destroy, getStatus } }
     */
    registerCartridge: function (id, def) {
      if (!id || !def || typeof def.createInstance !== 'function') {
        console.warn('[GameEngine] Invalid cartridge registration:', id);
        return;
      }
      cartridges.set(id, {
        id: id,
        title: def.title || id,
        icon: def.icon || '⚄',
        description: def.description || '',
        createInstance: def.createInstance
      });
      // Dispatch cartridge registration event
      window.dispatchEvent(new CustomEvent('cartridgeRegistered', { detail: { id: id } }));
    },

    getCartridge: function (id) {
      return cartridges.get(id) || null;
    },

    listCartridges: function () {
      return Array.from(cartridges.values());
    },

    pickRandomCartridge: function (excludeId) {
      const available = Array.from(cartridges.keys()).filter(function (id) {
        return id !== excludeId;
      });
      if (available.length === 0) {
        return excludeId || null;
      }
      const idx = Math.floor(Math.random() * available.length);
      return available[idx];
    },

    /**
     * Mount a registered cartridge onto a target canvas element.
     * @param {HTMLCanvasElement|string} target
     * @param {string} cartridgeId
     * @param {Object} [options]
     * @returns {Object|null} running instance
     */
    mountCartridge: function (target, cartridgeId, options) {
      const canvas = resolveCanvas(target);
      if (!canvas || !(canvas instanceof HTMLCanvasElement)) {
        console.warn('[GameEngine] Mount target is not an HTMLCanvasElement:', target);
        return null;
      }

      // If already mounted with the same cartridge, return active instance
      const existing = mountedInstances.get(canvas);
      if (existing && existing.cartridgeId === cartridgeId) {
        if (existing.instance && typeof existing.instance.start === 'function') {
          existing.instance.start();
        }
        return existing.instance;
      }

      // Unmount any previous cartridge running on this canvas
      this.unmountCartridge(canvas);

      const cartridge = cartridges.get(cartridgeId);
      if (!cartridge) {
        console.warn('[GameEngine] Cartridge not found:', cartridgeId);
        return null;
      }

      // Create new instance of the cartridge
      const instance = cartridge.createInstance(canvas, options || {});
      if (!instance) {
        console.error('[GameEngine] Failed to create cartridge instance for:', cartridgeId);
        return null;
      }

      // Automatic resize listener
      let resizeTimer = null;
      function handleResize() {
        if (resizeTimer) cancelAnimationFrame(resizeTimer);
        resizeTimer = requestAnimationFrame(function () {
          if (instance && typeof instance.resize === 'function') {
            const rect = canvas.getBoundingClientRect();
            instance.resize(rect.width, rect.height);
          }
        });
      }

      window.addEventListener('resize', handleResize, { passive: true });

      // Store mounted record
      mountedInstances.set(canvas, {
        cartridgeId: cartridgeId,
        instance: instance,
        unmountHandler: function () {
          window.removeEventListener('resize', handleResize);
          if (resizeTimer) cancelAnimationFrame(resizeTimer);
          if (instance && typeof instance.destroy === 'function') {
            try { instance.destroy(); } catch (err) {}
          }
        }
      });

      // Start instance
      if (typeof instance.start === 'function') {
        instance.start();
      }

      // Trigger custom mount event
      window.dispatchEvent(new CustomEvent('cartridgeMounted', {
        detail: { canvas: canvas, cartridgeId: cartridgeId, cartridge: cartridge, instance: instance }
      }));

      return instance;
    },

    /**
     * Unmount any cartridge currently running on a target canvas.
     */
    unmountCartridge: function (target) {
      const canvas = resolveCanvas(target);
      if (!canvas) return;

      const record = mountedInstances.get(canvas);
      if (record) {
        if (typeof record.unmountHandler === 'function') {
          record.unmountHandler();
        }
        mountedInstances.delete(canvas);
        window.dispatchEvent(new CustomEvent('cartridgeUnmounted', {
          detail: { canvas: canvas, cartridgeId: record.cartridgeId }
        }));
      }
    },

    /**
     * Retrieve the active cartridge instance running on a canvas.
     */
    getActiveInstance: function (target) {
      const canvas = resolveCanvas(target);
      if (!canvas) return null;
      const record = mountedInstances.get(canvas);
      return record ? record.instance : null;
    },

    /**
     * Retrieve the active cartridge ID running on a canvas.
     */
    getActiveCartridgeId: function (target) {
      const canvas = resolveCanvas(target);
      if (!canvas) return null;
      const record = mountedInstances.get(canvas);
      return record ? record.cartridgeId : null;
    },

    /**
     * Cycle to the next registered cartridge on a canvas.
     */
    cycleNextCartridge: function (target, options) {
      const canvas = resolveCanvas(target);
      if (!canvas) return null;

      const list = this.listCartridges();
      if (list.length === 0) return null;

      const currentId = this.getActiveCartridgeId(canvas);
      let nextIdx = 0;
      if (currentId) {
        const currIdx = list.findIndex(function (c) { return c.id === currentId; });
        if (currIdx !== -1) {
          nextIdx = (currIdx + 1) % list.length;
        }
      }

      const nextCartridge = list[nextIdx];
      this.mountCartridge(canvas, nextCartridge.id, options);
      return nextCartridge.id;
    },

    /**
     * Initialize host container integration for the Web Portal interactive widget.
     * Randomly picks an installed cartridge on page refresh (or allows cycling).
     */
    initPortalHost: function () {
      const canvas = document.getElementById('wasm-canvas');
      if (!canvas) return;

      const titleEl = document.getElementById('cartridge-active-title');
      const iconEl = document.getElementById('cartridge-active-icon');
      const swapBtn = document.getElementById('btn-swap-cartridge');
      const modeEl = document.getElementById('canvas-mode');
      const starfieldControls = document.getElementById('arcade-controls-starfield');
      const instructionsEl = document.getElementById('canvas-instructions');

      function updateHostChrome(cartridgeId) {
        const cartridge = GameEngine.getCartridge(cartridgeId);
        if (!cartridge) return;

        if (titleEl) titleEl.textContent = cartridge.title;
        if (iconEl) iconEl.textContent = cartridge.icon;
        if (modeEl) modeEl.textContent = 'MODE: ' + cartridge.title.toUpperCase();

        if (starfieldControls) {
          starfieldControls.style.display = cartridgeId === 'starfield-screensaver' ? 'flex' : 'none';
        }

        if (instructionsEl) {
          if (cartridgeId === 'desert-golfing') {
            instructionsEl.textContent = 'Pull back to set angle and power \u2022 Release to shoot \u2022 Endless sand dunes';
          } else {
            instructionsEl.textContent = 'Move cursor / touch to steer warp \u2022 Click to burst stars';
          }
        }

        safeSetStorage(STORAGE_KEY, cartridgeId);
      }

      // Listen for mount updates
      window.addEventListener('cartridgeMounted', function (e) {
        if (e.detail && e.detail.canvas === canvas) {
          updateHostChrome(e.detail.cartridgeId);
        }
      });

      // Bind swap button
      if (swapBtn) {
        swapBtn.onclick = function () {
          const newId = GameEngine.cycleNextCartridge(canvas);
          if (newId) {
            updateHostChrome(newId);
          }
        };
      }

      function ensureMount() {
        if (GameEngine.getActiveCartridgeId(canvas)) return;

        let initialCartridge = null;
        try {
          const params = new URLSearchParams(window.location.search);
          const qGame = params.get('game');
          if (qGame && GameEngine.getCartridge(qGame)) {
            initialCartridge = qGame;
          }
        } catch (e) {}

        if (!initialCartridge) {
          const list = GameEngine.listCartridges();
          if (list.length > 0) {
            const randomIndex = Math.floor(Math.random() * list.length);
            initialCartridge = list[randomIndex].id;
          }
        }

        if (initialCartridge) {
          GameEngine.mountCartridge(canvas, initialCartridge);
        }
      }

      ensureMount();
      window.addEventListener('cartridgeRegistered', ensureMount);
    }
  };

  window.GameEngine = GameEngine;

  // Auto-init portal host when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      GameEngine.initPortalHost();
    });
  } else {
    GameEngine.initPortalHost();
  }
})();
