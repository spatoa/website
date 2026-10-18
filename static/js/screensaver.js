/**
 * @module Screensaver
 * @description Mid-2000s 3D Starfield Screensaver running on HTML5 Canvas.
 * Supports interactive mouse steering, warp speed acceleration bursts, and pause/resume hooks.
 * Primed for hot-swapping with custom WebAssembly binaries or mounting as a GameEngine cartridge.
 *
 * @dependencies
 * - DOM: #wasm-canvas, #btn-warp, #btn-toggle, #canvas-status
 * - window.GameEngine (static/js/game-engine.js)
 *
 * @exports
 * - window.GamePlayerWasm
 * - window.startScreensaver
 * - window.stopScreensaver
 *
 * @storageKeys
 * - None
 */

(function () {
  'use strict';

  // Hook for future custom WASM binary
  window.GamePlayerWasm = window.GamePlayerWasm || {
    isLoaded: false,
    init: function (canvas) {
      console.log('[Game_Player.exe] WASM engine hook ready. Awaiting module initialization.');
    }
  };

  const NUM_STARS = 450;
  const warpSpeeds = [
    { label: 'CRUISE (3.5x)', speed: 3.5 },
    { label: 'WARP SPEED (8.0x)', speed: 8.0 },
    { label: 'HYPERDRIVE (16.0x)', speed: 16.0 }
  ];

  const colorThemes = [
    { name: 'STARS: MONOCHROME', starColor: [240, 245, 255], glow: '#00ffff' },
    { name: 'STARS: GREEN CRT', starColor: [0, 255, 102], glow: '#00ff66' },
    { name: 'STARS: AMBER RETRO', starColor: [255, 180, 50], glow: '#ffaa00' },
    { name: 'STARS: CYBER NEON', starColor: [255, 80, 180], glow: '#ff00aa' }
  ];

  let activeScreensaverInstance = null;

  function createScreensaverInstance(canvas, options) {
    if (!canvas) return null;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    options = options || {};

    let width = canvas.width || 380;
    let height = canvas.height || 200;
    let cx = width / 2;
    let cy = height / 2;

    let isPaused = false;
    let animFrameId = null;
    let burstTimer = null;
    let currentSpeed = 3.5;
    let targetSpeed = 3.5;
    let warpModeIndex = 0;
    let themeIndex = 0;

    let targetOffsetX = 0;
    let targetOffsetY = 0;
    let currentOffsetX = 0;
    let currentOffsetY = 0;

    let frameCount = 0;
    let fps = 60;
    let lastFpsUpdate = performance.now();

    const stars = [];
    function createStar(randomZ) {
      return {
        x: (Math.random() - 0.5) * width * 2,
        y: (Math.random() - 0.5) * height * 2,
        z: randomZ ? Math.random() * width : width,
        pz: width,
        size: Math.random() * 1.5 + 0.8
      };
    }

    for (let i = 0; i < NUM_STARS; i++) {
      stars.push(createStar(true));
    }

    function resizeCanvas(newWidth, newHeight) {
      if (newWidth > 0 && newHeight > 0) {
        canvas.width = Math.floor(newWidth);
        canvas.height = Math.floor(newHeight);
      }
      width = canvas.width;
      height = canvas.height;
      cx = width / 2;
      cy = height / 2;
    }

    function handlePointerMove(clientX, clientY) {
      const rect = canvas.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const px = clientX - rect.left;
      const py = clientY - rect.top;
      targetOffsetX = (px - rect.width / 2) * 0.65;
      targetOffsetY = (py - rect.height / 2) * 0.65;
    }

    function triggerBurst() {
      targetSpeed = 22.0;
      if (burstTimer) {
        clearTimeout(burstTimer);
      }
      burstTimer = setTimeout(function () {
        targetSpeed = warpSpeeds[warpModeIndex].speed;
        burstTimer = null;
      }, 400);

      for (let i = 0; i < 60; i++) {
        const idx = Math.floor(Math.random() * stars.length);
        stars[idx].z = Math.random() * 100 + 10;
      }
    }

    let lastTouchTime = 0;
    function onPointerMove(e) {
      handlePointerMove(e.clientX, e.clientY);
    }
    function onPointerLeave() {
      targetOffsetX = 0;
      targetOffsetY = 0;
    }
    function onPointerDown() {
      triggerBurst();
    }

    function bindInput() {
      if ('PointerEvent' in window) {
        canvas.addEventListener('pointermove', onPointerMove);
        canvas.addEventListener('pointerleave', onPointerLeave);
        canvas.addEventListener('pointerdown', onPointerDown);
      } else {
        canvas.addEventListener('mousemove', function (e) {
          if (Date.now() - lastTouchTime < 500) return;
          handlePointerMove(e.clientX, e.clientY);
        });
        canvas.addEventListener('mouseleave', onPointerLeave);
        canvas.addEventListener('touchmove', function (e) {
          lastTouchTime = Date.now();
          if (e.touches.length > 0) {
            handlePointerMove(e.touches[0].clientX, e.touches[0].clientY);
          }
        }, { passive: true });
        canvas.addEventListener('touchstart', function () {
          lastTouchTime = Date.now();
          triggerBurst();
        }, { passive: true });
        canvas.addEventListener('click', function () {
          if (Date.now() - lastTouchTime < 500) return;
          triggerBurst();
        });
      }
    }

    function unbindInput() {
      if ('PointerEvent' in window) {
        canvas.removeEventListener('pointermove', onPointerMove);
        canvas.removeEventListener('pointerleave', onPointerLeave);
        canvas.removeEventListener('pointerdown', onPointerDown);
      }
    }

    // Render loop
    function render() {
      if (isPaused) return;

      currentSpeed += (targetSpeed - currentSpeed) * 0.08;
      currentOffsetX += (targetOffsetX - currentOffsetX) * 0.05;
      currentOffsetY += (targetOffsetY - currentOffsetY) * 0.05;

      frameCount++;
      const now = performance.now();
      if (now - lastFpsUpdate >= 1000) {
        fps = Math.round((frameCount * 1000) / (now - lastFpsUpdate));
        frameCount = 0;
        lastFpsUpdate = now;
        const statusEl = document.getElementById('canvas-status');
        if (statusEl && !isPaused) {
          statusEl.textContent = `STATUS: RUNNING (${fps} FPS)`;
        }
      }

      ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
      ctx.fillRect(0, 0, width, height);

      const theme = colorThemes[themeIndex];
      const [r, g, b] = theme.starColor;

      for (let i = 0; i < stars.length; i++) {
        const s = stars[i];
        s.pz = s.z;
        s.z -= currentSpeed;

        if (s.z <= 0) {
          s.x = (Math.random() - 0.5) * width * 2;
          s.y = (Math.random() - 0.5) * height * 2;
          s.z = width;
          s.pz = width;
        }

        const k = width / s.z;
        const x2d = (s.x - currentOffsetX) * k + cx;
        const y2d = (s.y - currentOffsetY) * k + cy;

        const pk = width / s.pz;
        const px2d = (s.x - currentOffsetX) * pk + cx;
        const py2d = (s.y - currentOffsetY) * pk + cy;

        if (x2d >= 0 && x2d <= width && y2d >= 0 && y2d <= height) {
          const brightness = Math.min(1, Math.max(0.1, (1 - s.z / width) * 1.2));
          ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${brightness})`;
          ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${brightness})`;
          ctx.lineWidth = Math.max(1, s.size * (1 - s.z / width) * 2);

          if (currentSpeed > 4) {
            ctx.beginPath();
            ctx.moveTo(px2d, py2d);
            ctx.lineTo(x2d, y2d);
            ctx.stroke();
          } else {
            ctx.beginPath();
            ctx.arc(x2d, y2d, Math.max(0.8, s.size * (1 - s.z / width) * 1.5), 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      animFrameId = requestAnimationFrame(render);
    }

    function start() {
      if (!isPaused && animFrameId !== null) return;
      isPaused = false;
      bindInput();
      const rect = canvas.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        resizeCanvas(rect.width, rect.height);
      }
      lastFpsUpdate = performance.now();
      frameCount = 0;
      animFrameId = requestAnimationFrame(render);
    }

    function pause() {
      isPaused = true;
      if (animFrameId !== null) {
        cancelAnimationFrame(animFrameId);
        animFrameId = null;
      }
      const statusEl = document.getElementById('canvas-status');
      if (statusEl) {
        statusEl.textContent = 'STATUS: PAUSED';
      }
    }

    function stop() {
      pause();
      unbindInput();
    }

    function destroy() {
      stop();
    }

    // UI Buttons Binding if attached to #wasm-canvas
    const btnWarp = document.getElementById('btn-warp');
    const btnToggle = document.getElementById('btn-toggle');
    const btnTheme = document.getElementById('btn-theme');

    if (btnWarp) {
      btnWarp.onclick = function () {
        warpModeIndex = (warpModeIndex + 1) % warpSpeeds.length;
        targetSpeed = warpSpeeds[warpModeIndex].speed;
        btnWarp.textContent = warpSpeeds[warpModeIndex].label;
        const modeEl = document.getElementById('canvas-mode');
        if (modeEl) modeEl.textContent = 'MODE: ' + warpSpeeds[warpModeIndex].label;
      };
    }

    if (btnToggle) {
      btnToggle.onclick = function () {
        if (isPaused) {
          start();
          btnToggle.textContent = 'Pause / Play';
          btnToggle.setAttribute('aria-pressed', 'false');
        } else {
          pause();
          btnToggle.textContent = 'Resume Simulation';
          btnToggle.setAttribute('aria-pressed', 'true');
        }
      };
    }

    if (btnTheme) {
      btnTheme.onclick = function () {
        themeIndex = (themeIndex + 1) % colorThemes.length;
        btnTheme.textContent = 'Palette: ' + colorThemes[themeIndex].name.replace('STARS: ', '');
      };
    }

    const instance = {
      start: start,
      pause: pause,
      stop: stop,
      resize: resizeCanvas,
      destroy: destroy,
      getStatus: function () {
        return `FPS: ${fps} | SPEED: ${warpSpeeds[warpModeIndex].label}`;
      }
    };

    activeScreensaverInstance = instance;
    return instance;
  }

  // Register cartridge into GameEngine if loaded
  function register() {
    if (window.GameEngine && typeof window.GameEngine.registerCartridge === 'function') {
      window.GameEngine.registerCartridge('starfield-screensaver', {
        id: 'starfield-screensaver',
        title: '3D Starfield',
        icon: '★',
        description: 'Authentic 3D warp speed starfield screensaver with mouse steering and acceleration bursts.',
        createInstance: createScreensaverInstance
      });
    }
  }

  register();
  window.addEventListener('DOMContentLoaded', register);

  // Global lifecycle helpers for DesktopOS backward compatibility
  window.startScreensaver = function () {
    if (activeScreensaverInstance) {
      activeScreensaverInstance.start();
    } else {
      const canvas = document.getElementById('wasm-canvas');
      if (canvas && window.GameEngine) {
        window.GameEngine.mountCartridge(canvas, 'starfield-screensaver');
      }
    }
  };

  window.stopScreensaver = function () {
    if (activeScreensaverInstance) {
      activeScreensaverInstance.pause();
    }
  };
})();
