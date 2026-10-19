/**
 * @module DesertGolfing/InputController
 * @description Unified PointerEvent and slingshot drag input controller with touch gesture prevention.
 * Dedicated to the Desert Golfing engine in Lachlan's World.
 */

(function (root, factory) {
  'use strict';
  const Config = (root && root.DesertGolfingConfig) ||
    ((typeof require === 'function') ? require('./config.js') : {});
  const res = factory(Config);
  if (root) root.DesertGolfingInputController = res;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = res;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (CONFIG) {
  'use strict';

  const S = (CONFIG && CONFIG.SLINGSHOT) || {};
  const D_MAX = S.D_MAX || 110.0;
  const K_FORCE = S.K_FORCE || 5.2;
  const MIN_FIRE_DIST = S.MIN_FIRE_DIST || 6.0;

  /**
   * Tests whether a click/tap occurred inside the "HOLE X" HUD header to trigger a stage reset.
   *
   * @param {number} px - Local canvas coordinate X
   * @param {number} py - Local canvas coordinate Y
   * @param {number} currentHole - Current hole index
   * @returns {boolean} True if hole number tapped
   */
  function isHoleNumberTapped(px, py, currentHole) {
    const holeText = `HOLE ${currentHole}`;
    const textWidth = holeText.length * 9.0;
    const hitLeft = 0;
    const hitRight = Math.max(75, 14 + textWidth + 14);
    const hitTop = 0;
    const hitBottom = 38;
    return (px >= hitLeft && px <= hitRight && py >= hitTop && py <= hitBottom);
  }

  /**
   * Factory creating an input controller instance for the canvas.
   *
   * @param {HTMLCanvasElement} canvas - Target rendering canvas
   * @param {Object} callbacks - { getSimDimensions, getCurrentState, getCurrentHole, onStartDrag, onMoveDrag, onFireStroke, onCancelDrag, onResetStage, onUserInteraction }
   * @returns {Object} { attach, detach, isDragging, getDragVector }
   */
  function createInputController(canvas, callbacks) {
    let isAttached = false;
    let activePointerId = null;
    let dragging = false;

    let dragOriginX = 0;
    let dragOriginY = 0;
    let dragCurrentX = 0;
    let dragCurrentY = 0;

    /**
     * Translates client viewport coordinates to simulation coordinate space.
     *
     * @param {number} clientX
     * @param {number} clientY
     * @returns {{ clickX: number, clickY: number }}
     */
    function clientToSimCoords(clientX, clientY) {
      const rect = canvas.getBoundingClientRect();
      const dims = callbacks.getSimDimensions();
      const ptrScaleX = dims.simWidth / Math.max(1, rect.width);
      const ptrScaleY = dims.simHeight / Math.max(1, rect.height);

      if (clientX === undefined) clientX = rect.left + rect.width * 0.5;
      if (clientY === undefined) clientY = rect.top + rect.height * 0.5;

      const clickX = (clientX - rect.left) * ptrScaleX;
      const clickY = (clientY - rect.top) * ptrScaleY;
      return { clickX: clickX, clickY: clickY };
    }

    function handlePointerDown(e) {
      if (e.cancelable) {
        e.preventDefault();
      }

      let clientX = e.clientX;
      let clientY = e.clientY;
      if (e.touches && e.touches.length > 0) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      }

      const coords = clientToSimCoords(clientX, clientY);
      const clickX = coords.clickX;
      const clickY = coords.clickY;

      if (callbacks.onUserInteraction) {
        callbacks.onUserInteraction();
      }

      // Check for secret stage reset click on "HOLE X"
      if (isHoleNumberTapped(clickX, clickY, callbacks.getCurrentHole())) {
        callbacks.onResetStage();
        return;
      }

      if (callbacks.getCurrentState() !== 'IDLE') return;

      if (typeof canvas.setPointerCapture === 'function' && e.pointerId !== undefined) {
        try {
          canvas.setPointerCapture(e.pointerId);
          activePointerId = e.pointerId;
        } catch (err) {}
      }

      dragging = true;
      dragOriginX = clickX;
      dragOriginY = clickY;
      dragCurrentX = clickX;
      dragCurrentY = clickY;

      callbacks.onStartDrag(dragOriginX, dragOriginY);
    }

    function handlePointerMove(e) {
      if (!dragging) return;

      if (e.cancelable) {
        e.preventDefault();
      }

      let clientX = e.clientX;
      let clientY = e.clientY;
      if (e.touches && e.touches.length > 0) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      }

      if (clientX !== undefined && clientY !== undefined) {
        const coords = clientToSimCoords(clientX, clientY);
        dragCurrentX = coords.clickX;
        dragCurrentY = coords.clickY;
        callbacks.onMoveDrag(dragCurrentX, dragCurrentY);
      }
    }

    function handlePointerUp(e) {
      if (!dragging) return;

      if (e && e.cancelable) {
        e.preventDefault();
      }

      if (typeof canvas.releasePointerCapture === 'function' && activePointerId !== null) {
        try {
          canvas.releasePointerCapture(activePointerId);
        } catch (err) {}
        activePointerId = null;
      }

      dragging = false;

      const rawDx = dragCurrentX - dragOriginX;
      const rawDy = dragCurrentY - dragOriginY;
      const dist = Math.hypot(rawDx, rawDy);

      if (dist >= MIN_FIRE_DIST) {
        const clampedDist = Math.min(D_MAX, dist);
        const impulseMag = clampedDist * K_FORCE;
        const dirX = rawDx / dist;
        const dirY = rawDy / dist;

        const impulseX = -dirX * impulseMag;
        const impulseY = -dirY * impulseMag;

        callbacks.onFireStroke(impulseX, impulseY, clampedDist / D_MAX);
      } else {
        callbacks.onCancelDrag();
        if (isHoleNumberTapped(dragOriginX, dragOriginY, callbacks.getCurrentHole())) {
          callbacks.onResetStage();
        }
      }
    }

    function handlePointerCancel(e) {
      if (dragging) {
        dragging = false;
        if (typeof canvas.releasePointerCapture === 'function' && activePointerId !== null) {
          try {
            canvas.releasePointerCapture(activePointerId);
          } catch (err) {}
          activePointerId = null;
        }
        callbacks.onCancelDrag();
      }
    }

    function handleWindowTouchMove(e) {
      if (dragging) {
        if (e.cancelable) {
          e.preventDefault();
        }
        handlePointerMove(e);
      }
    }

    function handleWindowTouchEnd(e) {
      if (dragging) {
        handlePointerUp(e);
      }
    }

    function attach() {
      if (isAttached) return;
      isAttached = true;

      // Modern PointerEvent architecture (avoids dual firing on touchscreens)
      if (typeof window !== 'undefined' && 'PointerEvent' in window) {
        canvas.addEventListener('pointerdown', handlePointerDown);
        canvas.addEventListener('pointermove', handlePointerMove);
        canvas.addEventListener('pointerup', handlePointerUp);
        canvas.addEventListener('pointercancel', handlePointerCancel);
      } else {
        // Fallback for legacy browsers without PointerEvent
        canvas.addEventListener('touchstart', handlePointerDown, { passive: false });
        canvas.addEventListener('touchmove', handlePointerMove, { passive: false });
        canvas.addEventListener('touchend', handlePointerUp, { passive: false });
        canvas.addEventListener('touchcancel', handlePointerCancel, { passive: false });

        canvas.addEventListener('mousedown', handlePointerDown);
        window.addEventListener('mousemove', handlePointerMove);
        window.addEventListener('mouseup', handlePointerUp);
      }

      // Window drag safety net
      if (typeof window !== 'undefined') {
        window.addEventListener('touchmove', handleWindowTouchMove, { passive: false });
        window.addEventListener('touchend', handleWindowTouchEnd, { passive: false });
        window.addEventListener('touchcancel', handlePointerCancel, { passive: false });
      }
    }

    function detach() {
      if (!isAttached) return;
      isAttached = false;
      dragging = false;

      if (typeof window !== 'undefined' && 'PointerEvent' in window) {
        canvas.removeEventListener('pointerdown', handlePointerDown);
        canvas.removeEventListener('pointermove', handlePointerMove);
        canvas.removeEventListener('pointerup', handlePointerUp);
        canvas.removeEventListener('pointercancel', handlePointerCancel);
      } else {
        canvas.removeEventListener('touchstart', handlePointerDown);
        canvas.removeEventListener('touchmove', handlePointerMove);
        canvas.removeEventListener('touchend', handlePointerUp);
        canvas.removeEventListener('touchcancel', handlePointerCancel);

        canvas.removeEventListener('mousedown', handlePointerDown);
        window.removeEventListener('mousemove', handlePointerMove);
        window.removeEventListener('mouseup', handlePointerUp);
      }

      if (typeof window !== 'undefined') {
        window.removeEventListener('touchmove', handleWindowTouchMove);
        window.removeEventListener('touchend', handleWindowTouchEnd);
        window.removeEventListener('touchcancel', handlePointerCancel);
      }
    }

    return {
      attach: attach,
      detach: detach,
      isDragging: function () {
        return dragging;
      },
      getDragVector: function () {
        return {
          originX: dragOriginX,
          originY: dragOriginY,
          currentX: dragCurrentX,
          currentY: dragCurrentY
        };
      }
    };
  }

  return {
    isHoleNumberTapped: isHoleNumberTapped,
    createInputController: createInputController
  };
});
