/**
 * @module Screensaver
 * @description Mid-2000s 3D Starfield Screensaver running on HTML5 Canvas.
 * Supports interactive mouse steering, warp speed acceleration bursts, and pause/resume hooks.
 * Primed for hot-swapping with a custom WebAssembly binary via window.GamePlayerWasm.
 *
 * @dependencies
 * - DOM: #wasm-canvas, #btn-warp, #btn-toggle, #canvas-status
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

  const canvas = document.getElementById('wasm-canvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const statusEl = document.getElementById('canvas-status');
  const modeEl = document.getElementById('canvas-mode');
  const btnWarp = document.getElementById('btn-warp');
  const btnToggle = document.getElementById('btn-toggle');
  const btnTheme = document.getElementById('btn-theme');

  // Simulation Parameters
  const NUM_STARS = 450;
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
  let themeIndex = 0;

  // Steering offsets based on cursor / touch
  let targetOffsetX = 0;
  let targetOffsetY = 0;
  let currentOffsetX = 0;
  let currentOffsetY = 0;

  // FPS Tracking
  let frameCount = 0;
  let fps = 60;
  let lastFpsUpdate = performance.now();

  // Create stars
  const stars = [];
  function createStar(randomZ = true) {
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

  // Handle Canvas Resizing
  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      canvas.width = Math.floor(rect.width);
      canvas.height = Math.floor(rect.height);
      width = canvas.width;
      height = canvas.height;
      cx = width / 2;
      cy = height / 2;
    }
  }

  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  // Hybrid Pointer / Mouse / Touch Interaction (prevents duplicate touch+mouse event conflicts)
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
  if ('PointerEvent' in window) {
    canvas.addEventListener('pointermove', function (e) {
      handlePointerMove(e.clientX, e.clientY);
    });
    canvas.addEventListener('pointerleave', function () {
      targetOffsetX = 0;
      targetOffsetY = 0;
    });
    canvas.addEventListener('pointerdown', function () {
      triggerBurst();
    });
  } else {
    canvas.addEventListener('mousemove', function (e) {
      if (Date.now() - lastTouchTime < 500) return;
      handlePointerMove(e.clientX, e.clientY);
    });
    canvas.addEventListener('mouseleave', function () {
      targetOffsetX = 0;
      targetOffsetY = 0;
    });
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

  function startLoop() {
    if (isPaused) return;
    if (animFrameId === null) {
      lastFpsUpdate = performance.now();
      frameCount = 0;
      animFrameId = requestAnimationFrame(render);
    }
  }

  function stopLoop() {
    if (animFrameId !== null) {
      cancelAnimationFrame(animFrameId);
      animFrameId = null;
    }
  }

  // Control Buttons
  if (btnWarp) {
    btnWarp.addEventListener('click', function () {
      warpModeIndex = (warpModeIndex + 1) % warpSpeeds.length;
      targetSpeed = warpSpeeds[warpModeIndex].speed;
      btnWarp.textContent = warpSpeeds[warpModeIndex].label;
      if (modeEl) modeEl.textContent = 'MODE: ' + warpSpeeds[warpModeIndex].label;
    });
  }

  if (btnToggle) {
    btnToggle.addEventListener('click', function () {
      isPaused = !isPaused;
      btnToggle.textContent = isPaused ? 'Resume Simulation' : 'Pause / Play';
      btnToggle.setAttribute('aria-pressed', isPaused ? 'true' : 'false');
      if (statusEl) {
        statusEl.textContent = isPaused ? 'STATUS: PAUSED' : `STATUS: RUNNING (${fps} FPS)`;
      }
      if (isPaused) {
        stopLoop();
      } else {
        startLoop();
      }
    });
  }

  if (btnTheme) {
    btnTheme.addEventListener('click', function () {
      themeIndex = (themeIndex + 1) % colorThemes.length;
      btnTheme.textContent = 'Palette: ' + colorThemes[themeIndex].name.replace('STARS: ', '');
    });
  }

  // Synchronize canvas palette when site theme changes
  window.addEventListener('site:themechange', function (e) {
    if (e.detail && e.detail.theme) {
      if (e.detail.theme === 'paper') {
        themeIndex = 2; // STARS: AMBER RETRO
      } else {
        themeIndex = 0; // STARS: MONOCHROME
      }
      if (btnTheme) {
        btnTheme.textContent = 'Palette: ' + colorThemes[themeIndex].name.replace('STARS: ', '');
      }
    }
  });

  // Screensaver lifecycle controls (called by Desktop Window Manager on close/open/teardown)
  window.stopScreensaver = function () {
    isPaused = true;
    stopLoop();
    if (btnToggle) {
      btnToggle.textContent = 'Resume Simulation';
      btnToggle.setAttribute('aria-pressed', 'true');
    }
    if (statusEl) {
      statusEl.textContent = 'STATUS: PAUSED';
    }
  };

  window.startScreensaver = function () {
    isPaused = false;
    if (btnToggle) {
      btnToggle.textContent = 'Pause / Play';
      btnToggle.setAttribute('aria-pressed', 'false');
    }
    if (statusEl) {
      statusEl.textContent = `STATUS: RUNNING (${fps} FPS)`;
    }
    resizeCanvas();
    startLoop();
  };

  // Animation Loop
  function render(time) {
    if (isPaused) {
      animFrameId = null;
      return;
    }

    // If inside a closed or minimized desktop window, pause loop to save CPU/GPU
    const parentWin = canvas.closest('.desktop-window');
    if (parentWin && (parentWin.classList.contains('window-closed') || parentWin.classList.contains('window-minimized'))) {
      animFrameId = null;
      return;
    }

    animFrameId = requestAnimationFrame(render);

    // Smooth speed interpolation
    currentSpeed += (targetSpeed - currentSpeed) * 0.1;
    currentOffsetX += (targetOffsetX - currentOffsetX) * 0.05;
    currentOffsetY += (targetOffsetY - currentOffsetY) * 0.05;

    // Track FPS
    frameCount++;
    if (time - lastFpsUpdate >= 1000) {
      fps = Math.round((frameCount * 1000) / (time - lastFpsUpdate));
      frameCount = 0;
      lastFpsUpdate = time;
      if (statusEl) {
        statusEl.textContent = `STATUS: RUNNING (${fps} FPS)`;
      }
    }

    // Clear background with subtle motion trail
    ctx.fillStyle = 'rgba(7, 13, 20, 0.35)';
    ctx.fillRect(0, 0, width, height);

    const theme = colorThemes[themeIndex];
    const [r, g, b] = theme.starColor;

    for (let i = 0; i < stars.length; i++) {
      const s = stars[i];

      // Save previous Z for streak calculation
      s.pz = s.z;
      s.z -= currentSpeed;

      // Reset when passed viewer
      if (s.z <= 0) {
        s.x = (Math.random() - 0.5) * width * 2;
        s.y = (Math.random() - 0.5) * height * 2;
        s.z = width;
        s.pz = width;
      }

      // Project 3D coordinates onto 2D screen with steering offset
      const k = width / s.z;
      const x2d = (s.x - currentOffsetX) * k + cx;
      const y2d = (s.y - currentOffsetY) * k + cy;

      const pk = width / s.pz;
      const px2d = (s.x - currentOffsetX) * pk + cx;
      const py2d = (s.y - currentOffsetY) * pk + cy;

      // Draw if inside visible viewport
      if (x2d >= 0 && x2d <= width && y2d >= 0 && y2d <= height) {
        const brightness = Math.min(1, Math.max(0.1, (1 - s.z / width) * 1.2));
        ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${brightness})`;
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${brightness})`;
        ctx.lineWidth = Math.max(1, s.size * (1 - s.z / width) * 2);

        // Draw motion streak when fast
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
  }

  startLoop();
})();
