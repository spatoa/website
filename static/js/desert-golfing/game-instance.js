/**
 * @module DesertGolfing/GameInstance
 * @description Core game instance lifecycle coordinator, state machine, and fixed 60Hz physics loop.
 * Dedicated to the Desert Golfing engine in Lachlan's World.
 */

(function (root, factory) {
  'use strict';
  const req = typeof require === 'function' ? require : (() => ({}));
  const Config = (root && root.DesertGolfingConfig) || req('./config.js');
  const MathUtils = (root && root.DesertGolfingMath) || req('./math.js');
  const SaveManager = (root && root.DesertGolfingSaveManager) || req('./save-manager.js');
  const SoundEngine = (root && root.DesertGolfingSoundEngine) || req('./sound-engine.js');
  const TerrainWorld = (root && root.DesertGolfingTerrainWorld) || req('./terrain-world.js');
  const PhysicsEngine = (root && root.DesertGolfingPhysicsEngine) || req('./physics-engine.js');
  const InputController = (root && root.DesertGolfingInputController) || req('./input-controller.js');
  const TerrainRenderer = (root && root.DesertGolfingTerrainRenderer) || req('./terrain-renderer.js');

  const res = factory(Config, MathUtils, SaveManager, SoundEngine, TerrainWorld, PhysicsEngine, InputController, TerrainRenderer);
  if (root) root.DesertGolfingInstance = res;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = res;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (
  CONFIG, MathUtils, SaveManager, SoundEngine, TerrainWorld, PhysicsEngine, InputController, TerrainRenderer
) {
  'use strict';

  const BALL_RADIUS = (CONFIG && CONFIG.PHYSICS && CONFIG.PHYSICS.BALL_RADIUS) || 3.5;
  const BALL_MASS = (CONFIG && CONFIG.PHYSICS && CONFIG.PHYSICS.BALL_MASS) || 1.0;
  const REST_CONSECUTIVE_TICKS = (CONFIG && CONFIG.PHYSICS && CONFIG.PHYSICS.REST_CONSECUTIVE_TICKS) || 10;
  const DEFAULT_MASTER_SEED = (CONFIG && CONFIG.STORAGE && CONFIG.STORAGE.DEFAULT_MASTER_SEED) || 894312;
  const FIXED_DT = (CONFIG && CONFIG.TIMING && CONFIG.TIMING.FIXED_DT) || (1.0 / 60.0);
  const MAX_FRAME_DELTA = (CONFIG && CONFIG.TIMING && CONFIG.TIMING.MAX_FRAME_DELTA) || 0.1;
  const CUP_DWELL_DURATION = (CONFIG && CONFIG.TIMING && CONFIG.TIMING.CUP_DWELL) || 0.35;
  const CUP_RISE_DURATION = (CONFIG && CONFIG.TIMING && CONFIG.TIMING.CUP_RISE) || 0.45;
  const CAMERA_PAN_DURATION = (CONFIG && CONFIG.TIMING && CONFIG.TIMING.CAMERA_PAN) || 1.0;
  const BALL_FADE_DURATION = (CONFIG && CONFIG.TIMING && CONFIG.TIMING.BALL_FADE) || 0.10;
  const FLAG_FADE_DURATION = (CONFIG && CONFIG.TIMING && CONFIG.TIMING.FLAG_FADE) || 0.10;
  const RESPAWN_DELAY_DURATION = (CONFIG && CONFIG.TIMING && CONFIG.TIMING.RESPAWN_DELAY) || 1.0;

  const STAGE_WIDTH = (CONFIG && CONFIG.WORLD && CONFIG.WORLD.STAGE_WIDTH) || 480.0;
  const STAGE_HEIGHT = (CONFIG && CONFIG.WORLD && CONFIG.WORLD.STAGE_HEIGHT) || 270.0;

  const States = (CONFIG && CONFIG.STATES) || {
    IDLE: 'IDLE',
    DRAGGING: 'DRAGGING',
    BALL_FLIGHT: 'BALL_FLIGHT',
    CUP_DWELL: 'CUP_DWELL',
    CUP_RISING: 'CUP_RISING',
    CAMERA_PANNING: 'CAMERA_PANNING',
    RESPAWN_DELAY: 'RESPAWN_DELAY'
  };

  /**
   * Instantiates an active Desert Golfing minigame instance on the provided HTML5 Canvas.
   *
   * @param {HTMLCanvasElement} canvas - Target canvas element
   * @param {Object} [options] - Configuration options ({ resolutionIndependent, isStandalone })
   * @returns {Object|null} Game instance API or null if canvas is invalid
   */
  function createGameInstance(canvas, options) {
    if (!canvas) return null;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    options = options || {};

    let width = canvas.width || 470;
    let height = canvas.height || 250;

    const isResIndependent = !!(options && options.resolutionIndependent);
    let dpr = 1.0;
    let scaleX = 1.0;
    let scaleY = 1.0;
    let simWidth = isResIndependent ? STAGE_WIDTH : width;
    let simHeight = isResIndependent ? STAGE_HEIGHT : height;

    // Enforce touch-action none and prevent context callouts on mobile touchscreens
    canvas.style.touchAction = 'none';
    canvas.style.webkitUserSelect = 'none';
    canvas.style.userSelect = 'none';
    canvas.style.webkitTouchCallout = 'none';
    if (canvas.parentElement) {
      canvas.parentElement.style.touchAction = 'none';
    }

    const saved = SaveManager.load();
    let masterSeed = saved ? (saved.master_seed || DEFAULT_MASTER_SEED) : DEFAULT_MASTER_SEED;
    let currentHole = saved ? (saved.current_hole || 1) : 1;
    let totalStrokes = saved ? (saved.total_strokes || 0) : 0;
    let isMuted = saved ? (saved.sound === 'muted') : false;

    // Continuous dynamic terrain world
    const world = TerrainWorld.createTerrainWorld(masterSeed, function () {
      return simHeight;
    }, BALL_RADIUS);

    let holeInfo = world.getHoleInfo(currentHole, simWidth);

    function getCameraFraming(h) {
      const info = world.getHoleInfo(h, simWidth);
      return Math.max(0, info.teeX - 50.0);
    }

    function updateDimensions(newCssW, newCssH) {
      width = Math.floor(newCssW);
      height = Math.floor(newCssH);
      dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;

      if (isResIndependent) {
        simWidth = STAGE_WIDTH;
        simHeight = STAGE_HEIGHT;
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);
        scaleX = canvas.width / simWidth;
        scaleY = canvas.height / simHeight;
      } else {
        canvas.width = width;
        canvas.height = height;
        simWidth = width;
        simHeight = height;
        scaleX = 1.0;
        scaleY = 1.0;
      }

      holeInfo = world.getHoleInfo(currentHole, simWidth);
      cameraX = getCameraFraming(currentHole);
    }

    let cameraX = getCameraFraming(currentHole);
    let cameraStartX = cameraX;
    let cameraTargetX = cameraX;
    let dwellTimer = 0;
    let riseElapsed = 0;
    let riseStartY = 0;
    let riseTargetY = 0;
    let panElapsed = 0;
    let respawnTimer = 0;
    let fadeElapsed = BALL_FADE_DURATION;

    let currentState = States.IDLE;

    const ball = {
      x: holeInfo.teeX,
      y: world.getDuneElevation(holeInfo.teeX, currentHole, simWidth) - BALL_RADIUS - 0.5,
      vx: 0,
      vy: 0,
      restTicks: REST_CONSECUTIVE_TICKS
    };

    const lastRestPosition = {
      x: ball.x,
      y: ball.y
    };

    if (saved && saved.ball_state && typeof saved.ball_state.pos_x === 'number') {
      ball.x = saved.ball_state.pos_x;
      ball.y = saved.ball_state.pos_y;
      ball.vx = saved.ball_state.vel_x || 0;
      ball.vy = saved.ball_state.vel_y || 0;
      if (saved.last_rest_pos && typeof saved.last_rest_pos.x === 'number') {
        lastRestPosition.x = saved.last_rest_pos.x;
        lastRestPosition.y = saved.last_rest_pos.y;
      } else {
        lastRestPosition.x = ball.x;
        lastRestPosition.y = ball.y;
      }
    } else {
      lastRestPosition.x = ball.x;
      lastRestPosition.y = ball.y;
    }

    let isRunning = false;
    let animFrameId = null;
    let lastTimestamp = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    let timeAccumulator = 0;

    function persist() {
      SaveManager.save({
        master_seed: masterSeed,
        current_hole: currentHole,
        total_strokes: totalStrokes,
        sound: isMuted ? 'muted' : 'active',
        ball_state: {
          pos_x: ball.x,
          pos_y: ball.y,
          vel_x: ball.vx,
          vel_y: ball.vy
        },
        last_rest_pos: {
          x: lastRestPosition.x,
          y: lastRestPosition.y
        }
      });
    }

    if (!saved) {
      persist();
    }

    function resetStage() {
      if (currentState === States.CUP_DWELL || currentState === States.CUP_RISING || currentState === States.CAMERA_PANNING) {
        return;
      }
      ball.x = holeInfo.teeX;
      ball.y = world.getDuneElevation(holeInfo.teeX, currentHole, simWidth) - BALL_RADIUS - 0.5;
      ball.vx = 0;
      ball.vy = 0;
      ball.restTicks = REST_CONSECUTIVE_TICKS;
      lastRestPosition.x = ball.x;
      lastRestPosition.y = ball.y;

      totalStrokes++;

      cameraX = getCameraFraming(currentHole);
      currentState = States.IDLE;
      fadeElapsed = BALL_FADE_DURATION;

      SoundEngine.playBounce(isMuted, 80);
      persist();
      render();
    }

    // Input Controller
    const inputController = InputController.createInputController(canvas, {
      getSimDimensions: function () {
        return { simWidth: simWidth, simHeight: simHeight };
      },
      getCurrentState: function () {
        return currentState;
      },
      getCurrentHole: function () {
        return currentHole;
      },
      onUserInteraction: function () {
        SoundEngine.getAudioContext();
      },
      onStartDrag: function () {
        currentState = States.DRAGGING;
        fadeElapsed = BALL_FADE_DURATION;
      },
      onMoveDrag: function () {
        // Handled directly via getDragVector() in render
      },
      onFireStroke: function (impulseX, impulseY, powerRatio) {
        lastRestPosition.x = ball.x;
        lastRestPosition.y = ball.y;

        ball.vx = impulseX / BALL_MASS;
        ball.vy = impulseY / BALL_MASS;
        ball.restTicks = 0;
        currentState = States.BALL_FLIGHT;

        totalStrokes++;

        SoundEngine.playHit(isMuted, powerRatio);
        persist();
      },
      onCancelDrag: function () {
        currentState = States.IDLE;
      },
      onResetStage: function () {
        resetStage();
      }
    });

    /**
     * Fixed-timestep physics simulation tick.
     */
    function physicsStep(dt) {
      // 1. Out-of-bounds 1-second delay
      if (currentState === States.RESPAWN_DELAY) {
        respawnTimer -= dt;
        if (respawnTimer <= 0) {
          ball.x = lastRestPosition.x;
          ball.y = lastRestPosition.y;
          ball.vx = 0;
          ball.vy = 0;
          ball.restTicks = REST_CONSECUTIVE_TICKS;
          currentState = States.IDLE;
          fadeElapsed = 0; // Trigger smooth fade-in
          persist();
        }
        return;
      }

      if (currentState === States.IDLE) {
        if (fadeElapsed < BALL_FADE_DURATION) {
          fadeElapsed += dt;
        }
      }

      // 2. Dwell Phase in Cup Bottom (brief 0.35s pause)
      if (currentState === States.CUP_DWELL) {
        dwellTimer -= dt;
        if (dwellTimer <= 0) {
          const cupBottomY = holeInfo.cupY + world.cupDepth;
          currentState = States.CUP_RISING;
          riseElapsed = 0;
          riseStartY = cupBottomY - BALL_RADIUS;
          riseTargetY = world.getDuneElevation(holeInfo.cupX, currentHole, simWidth) - BALL_RADIUS - 0.5;
        }
        return;
      }

      // 3. Smooth Vertical Elevation to Surface Rim (0.45s)
      if (currentState === States.CUP_RISING) {
        riseElapsed += dt;
        const tau = Math.min(1.0, riseElapsed / CUP_RISE_DURATION);
        ball.x = holeInfo.cupX;
        ball.y = riseStartY + (riseTargetY - riseStartY) * MathUtils.smoothstep(tau);
        ball.vx = 0;
        ball.vy = 0;

        if (tau >= 1.0) {
          ball.y = riseTargetY;
          lastRestPosition.x = ball.x;
          lastRestPosition.y = ball.y;

          // Ball has reached surface rim: advance to next hole
          currentHole++;
          holeInfo = world.getHoleInfo(currentHole, simWidth);

          // Initiate Horizontal Camera Glide across continuous terrain
          cameraStartX = cameraX;
          cameraTargetX = getCameraFraming(currentHole);
          panElapsed = 0;
          currentState = States.CAMERA_PANNING;
        }
        return;
      }

      // 4. Camera Glide Execution (1.0s)
      if (currentState === States.CAMERA_PANNING) {
        panElapsed += dt;
        const tau = Math.min(1.0, panElapsed / CAMERA_PAN_DURATION);
        cameraX = cameraStartX + (cameraTargetX - cameraStartX) * MathUtils.smoothstep(tau);

        if (tau >= 1.0) {
          cameraX = cameraTargetX;
          persist();
          currentState = States.IDLE;
        }
        return;
      }

      if (currentState !== States.BALL_FLIGHT) {
        return;
      }

      // 5. Velocity Verlet integration
      const candidate = PhysicsEngine.stepVerlet(ball, dt);

      // Out-of-bounds check (despawns ball, waits 1.0s, respawns at lastRestPosition)
      const screenX = candidate.nextX - cameraX;
      if (PhysicsEngine.isOutOfBounds(screenX, candidate.nextY, simWidth, simHeight)) {
        ball.vx = 0;
        ball.vy = 0;
        currentState = States.RESPAWN_DELAY;
        respawnTimer = RESPAWN_DELAY_DURATION;
        fadeElapsed = 0;
        return;
      }

      // Cup trigger detection
      if (PhysicsEngine.checkCupEntry(candidate.nextX, candidate.nextY, holeInfo, world)) {
        const cupBottomY = holeInfo.cupY + world.cupDepth;
        ball.x = holeInfo.cupX;
        ball.y = cupBottomY - BALL_RADIUS;
        ball.vx = 0;
        ball.vy = 0;
        ball.restTicks = REST_CONSECUTIVE_TICKS;

        currentState = States.CUP_DWELL;
        dwellTimer = CUP_DWELL_DURATION;

        SoundEngine.playCup(isMuted);
        return;
      }

      // Inner cup wall reflections
      PhysicsEngine.resolveCupWallBounce(candidate, holeInfo, world);

      // Ground collision & Coulomb friction
      PhysicsEngine.resolveGroundCollision(candidate, holeInfo, currentHole, world, simWidth, dt, isMuted, SoundEngine);

      ball.x = candidate.nextX;
      ball.y = candidate.nextY;
      ball.vx = candidate.nextVx;
      ball.vy = candidate.nextVy;

      // Rest / settling check
      if (PhysicsEngine.isRestingCandidate(ball, currentHole, world, simWidth)) {
        ball.restTicks++;
        if (ball.restTicks >= REST_CONSECUTIVE_TICKS) {
          ball.vx = 0;
          ball.vy = 0;
          ball.y = world.getPhysicalElevation(ball.x, currentHole, simWidth) - BALL_RADIUS;
          currentState = States.IDLE;
          lastRestPosition.x = ball.x;
          lastRestPosition.y = ball.y;
          persist();
        }
      } else {
        ball.restTicks = 0;
      }
    }

    function render() {
      TerrainRenderer.renderFrame(ctx, canvas.width, canvas.height, scaleX, scaleY, simWidth, simHeight, {
        cameraX: cameraX,
        holeInfo: holeInfo,
        world: world,
        currentHole: currentHole,
        totalStrokes: totalStrokes,
        currentState: currentState,
        riseElapsed: riseElapsed,
        fadeElapsed: fadeElapsed,
        ball: ball,
        dragVector: inputController.isDragging() ? inputController.getDragVector() : null
      });
    }

    function loop(now) {
      if (!isRunning) return;

      const frameDelta = Math.min(MAX_FRAME_DELTA, (now - lastTimestamp) / 1000.0);
      lastTimestamp = now;
      timeAccumulator += frameDelta;

      while (timeAccumulator >= FIXED_DT) {
        physicsStep(FIXED_DT);
        timeAccumulator -= FIXED_DT;
      }

      render();
      animFrameId = requestAnimationFrame(loop);
    }

    function resize(newW, newH) {
      if (newW > 0 && newH > 0) {
        updateDimensions(newW, newH);
        render();
      }
    }

    function start() {
      if (isRunning) return;
      isRunning = true;
      lastTimestamp = (typeof performance !== 'undefined' ? performance.now() : Date.now());
      timeAccumulator = 0;
      inputController.attach();
      animFrameId = requestAnimationFrame(loop);
    }

    function pause() {
      isRunning = false;
      if (animFrameId) {
        cancelAnimationFrame(animFrameId);
        animFrameId = null;
      }
    }

    function stop() {
      pause();
      inputController.detach();
      persist();
    }

    function destroy() {
      stop();
    }

    // Initialize dimensions
    const rect = canvas.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      resize(rect.width, rect.height);
    } else {
      render();
    }

    return {
      start: start,
      pause: pause,
      stop: stop,
      resize: resize,
      destroy: destroy,
      getStatus: function () {
        return `HOLE ${currentHole} \u2022 STROKES ${totalStrokes}`;
      },
      getBallState: function () {
        return {
          pos_x: ball.x,
          pos_y: ball.y,
          vel_x: ball.vx,
          vel_y: ball.vy,
          state: currentState,
          alpha: (currentState === States.RESPAWN_DELAY) ? 0 : Math.min(1.0, Math.max(0.0, fadeElapsed / BALL_FADE_DURATION))
        };
      },
      getBallAlpha: function () {
        if (currentState === States.RESPAWN_DELAY) return 0;
        return Math.min(1.0, Math.max(0.0, fadeElapsed / BALL_FADE_DURATION));
      },
      getFlagAlpha: function () {
        if (currentState === States.CUP_RISING) {
          return Math.max(0.0, 1.0 - (riseElapsed / FLAG_FADE_DURATION));
        }
        return 1.0;
      },
      getPalette: function () {
        return TerrainRenderer.getPaletteColors(currentHole);
      },
      applyImpulse: function (impulseX, impulseY) {
        if (currentState !== States.IDLE) return;
        lastRestPosition.x = ball.x;
        lastRestPosition.y = ball.y;
        ball.vx = impulseX / BALL_MASS;
        ball.vy = impulseY / BALL_MASS;
        ball.restTicks = 0;
        currentState = States.BALL_FLIGHT;
        totalStrokes++;
        persist();
      },
      toggleSound: function () {
        isMuted = !isMuted;
        persist();
        render();
        return !isMuted;
      },
      resetStage: resetStage
    };
  }

  return {
    createGameInstance: createGameInstance
  };
});
