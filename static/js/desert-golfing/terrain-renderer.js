/**
 * @module DesertGolfing/TerrainRenderer
 * @description Layered Canvas 2D rendering pipeline for the procedural desert, sky, cup, flag, and ball.
 * Dedicated to the Desert Golfing engine in Lachlan's World.
 */

(function (root, factory) {
  'use strict';
  const Config = (root && root.DesertGolfingConfig) ||
    ((typeof require === 'function') ? require('./config.js') : {});
  const MathUtils = (root && root.DesertGolfingMath) ||
    ((typeof require === 'function') ? require('./math.js') : {});
  const res = factory(Config, MathUtils);
  if (root) root.DesertGolfingTerrainRenderer = res;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = res;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (CONFIG, MathUtils) {
  'use strict';

  const smoothstep = MathUtils.smoothstep;
  const interpolateColor = MathUtils.interpolateColor;

  const R = (CONFIG && CONFIG.RENDER) || {};
  const BALL_RADIUS = (CONFIG && CONFIG.PHYSICS && CONFIG.PHYSICS.BALL_RADIUS) || 3.5;
  const PALETTES = (CONFIG && CONFIG.PALETTES) || [];
  const THEME_CONFIG = (CONFIG && CONFIG.THEME) || {};
  const HOLES_PER_EPOCH = THEME_CONFIG.HOLES_PER_EPOCH || 150;
  const TRANSITION_WINDOW = THEME_CONFIG.TRANSITION_WINDOW || 18;
  const OVERRIDES = THEME_CONFIG.OVERRIDES || {};

  /**
   * Evaluates the color palette for the current hole index and active site theme.
   *
   * @param {number} holeIndex - 1-based hole index
   * @returns {Object} Palette colors { sky, sand, flag, ball, hud, cactus }
   */
  function getPaletteColors(holeIndex) {
    let themeAttr = 'windows';
    if (typeof document !== 'undefined') {
      const doc = document.documentElement;
      themeAttr = (doc && doc.getAttribute('data-theme')) || (document.body && document.body.getAttribute('data-theme')) || 'windows';
    }

    if (OVERRIDES[themeAttr]) {
      return OVERRIDES[themeAttr];
    }

    if (!PALETTES || PALETTES.length === 0) {
      return { sky: '#f7d399', sand: '#e09953', flag: '#dc2626', ball: '#ffffff', hud: '#7c2d12', cactus: '#2e7d32' };
    }

    const M = PALETTES.length;
    const h = Math.max(1, holeIndex);
    const epoch = Math.floor((h - 1) / HOLES_PER_EPOCH);
    const curIdx = epoch % M;
    const nextIdx = (epoch + 1) % M;

    const pCur = PALETTES[curIdx];
    const pNext = PALETTES[nextIdx];

    const offsetInEpoch = (h - 1) % HOLES_PER_EPOCH;
    const transitionStart = HOLES_PER_EPOCH - TRANSITION_WINDOW;

    if (offsetInEpoch >= transitionStart) {
      const tau = (offsetInEpoch - transitionStart) / TRANSITION_WINDOW;
      const t = smoothstep(tau);
      return {
        sky: interpolateColor(pCur.sky, pNext.sky, t),
        sand: interpolateColor(pCur.sand, pNext.sand, t),
        flag: interpolateColor(pCur.flag, pNext.flag, t),
        ball: interpolateColor(pCur.ball, pNext.ball, t),
        hud: interpolateColor(pCur.hud, pNext.hud, t),
        cactus: interpolateColor(pCur.cactus, pNext.cactus, t)
      };
    }

    return {
      sky: `rgb(${pCur.sky.join(',')})`,
      sand: `rgb(${pCur.sand.join(',')})`,
      flag: `rgb(${pCur.flag.join(',')})`,
      ball: `rgb(${pCur.ball.join(',')})`,
      hud: `rgb(${pCur.hud.join(',')})`,
      cactus: `rgb(${pCur.cactus.join(',')})`
    };
  }

  /**
   * Draws the solid sky background.
   */
  function drawSky(ctx, simWidth, simHeight, palette) {
    ctx.fillStyle = palette.sky;
    ctx.fillRect(0, 0, simWidth, simHeight);
  }

  /**
   * Draws the continuous sand dune polygon across the camera view with subpixel U-trench for the cup.
   */
  function drawSandDunes(ctx, cameraX, holeInfo, world, simWidth, simHeight, palette, currentHole) {
    ctx.beginPath();
    ctx.moveTo(0, simHeight);

    const activeCupScreenX = holeInfo.cupX - cameraX;
    const cupLeftScreen = activeCupScreenX - world.cupWidth * 0.5;
    const cupRightScreen = activeCupScreenX + world.cupWidth * 0.5;
    const rimY = holeInfo.cupY;
    const bottomY = rimY + world.cupDepth;

    let renderedCup = false;
    const stepPx = R.TERRAIN_STEP_PX || 3;

    for (let px = 0; px <= simWidth + stepPx; px += stepPx) {
      const wx = cameraX + px;

      // Subpixel insertion of vertical U-trench cutout for the target hole
      if (!renderedCup && px >= cupLeftScreen) {
        ctx.lineTo(cupLeftScreen, rimY);
        ctx.lineTo(cupLeftScreen, bottomY);
        ctx.lineTo(cupRightScreen, bottomY);
        ctx.lineTo(cupRightScreen, rimY);
        renderedCup = true;
        continue;
      }

      if (renderedCup && px < cupRightScreen) {
        continue;
      }

      const gy = world.getDuneElevation(wx, currentHole, simWidth);
      ctx.lineTo(px, gy);
    }

    ctx.lineTo(simWidth, simHeight);
    ctx.closePath();
    ctx.fillStyle = palette.sand;
    ctx.fill();
  }

  /**
   * Draws the dark cup cavity, flag pole, and waving triangular flag.
   */
  function drawCupCavityAndPin(ctx, cameraX, holeInfo, world, palette, currentState, riseElapsed, simWidth) {
    const activeCupScreenX = holeInfo.cupX - cameraX;
    if (activeCupScreenX <= -40 || activeCupScreenX >= simWidth + 40) return;

    const cupLeftScreen = activeCupScreenX - world.cupWidth * 0.5;
    const rimY = holeInfo.cupY;
    const bottomY = rimY + world.cupDepth;

    // Dark cavity interior
    ctx.fillStyle = R.CUP_CAVITY_COLOR || '#111827';
    ctx.fillRect(cupLeftScreen, rimY, world.cupWidth, world.cupDepth);

    // Pin Pole & Flag
    let flagAlpha = 1.0;
    if (currentState === 'CUP_RISING') {
      flagAlpha = Math.max(0.0, 1.0 - (riseElapsed / 0.10));
    }

    if (flagAlpha > 0.0) {
      ctx.save();
      ctx.globalAlpha = flagAlpha;

      const poleHeight = R.FLAG_POLE_HEIGHT || 36;
      ctx.strokeStyle = R.FLAG_POLE_COLOR || '#1f2937';
      ctx.lineWidth = R.FLAG_POLE_WIDTH || 1.5;
      ctx.beginPath();
      ctx.moveTo(activeCupScreenX, bottomY);
      ctx.lineTo(activeCupScreenX, rimY - poleHeight);
      ctx.stroke();

      ctx.fillStyle = palette.flag;
      ctx.beginPath();
      ctx.moveTo(activeCupScreenX, rimY - poleHeight);
      ctx.lineTo(activeCupScreenX - 14, rimY - poleHeight + 7);
      ctx.lineTo(activeCupScreenX, rimY - poleHeight + 14);
      ctx.closePath();
      ctx.fill();

      ctx.restore();
    }
  }

  /**
   * Draws procedural cacti within the visible camera viewport.
   */
  function drawVegetation(ctx, cameraX, currentHole, world, simWidth, palette) {
    const startHoleScan = Math.max(1, currentHole - 4);
    const endHoleScan = currentHole + 3;

    for (let hScan = startHoleScan; hScan <= endHoleScan; hScan++) {
      const hScanInfo = world.getHoleInfo(hScan, simWidth);
      if (hScanInfo && hScanInfo.cactus) {
        const cScreenX = hScanInfo.cactus.worldX - cameraX;
        if (cScreenX > -50 && cScreenX < simWidth + 50) {
          ctx.strokeStyle = palette.cactus;
          ctx.lineWidth = 3.5;
          ctx.lineCap = 'round';

          ctx.beginPath();
          ctx.moveTo(cScreenX, hScanInfo.cactus.groundY + 1.5);
          ctx.lineTo(cScreenX, hScanInfo.cactus.groundY - hScanInfo.cactus.height);
          ctx.stroke();

          ctx.beginPath();
          ctx.moveTo(cScreenX, hScanInfo.cactus.groundY - hScanInfo.cactus.height * 0.4);
          ctx.lineTo(cScreenX - 7, hScanInfo.cactus.groundY - hScanInfo.cactus.height * 0.4);
          ctx.lineTo(cScreenX - 7, hScanInfo.cactus.groundY - hScanInfo.cactus.height * 0.75);
          ctx.stroke();

          ctx.beginPath();
          ctx.moveTo(cScreenX, hScanInfo.cactus.groundY - hScanInfo.cactus.height * 0.55);
          ctx.lineTo(cScreenX + 7, hScanInfo.cactus.groundY - hScanInfo.cactus.height * 0.55);
          ctx.lineTo(cScreenX + 7, hScanInfo.cactus.groundY - hScanInfo.cactus.height * 0.88);
          ctx.stroke();
        }
      }
    }
  }

  /**
   * Draws the segmented dashed slingshot aiming trajectory.
   */
  function drawAimingTrajectory(ctx, cameraX, ball, dragVector) {
    if (!dragVector) return;

    const ballScreenX = ball.x - cameraX;
    const ballScreenY = ball.y;

    const rawDx = dragVector.currentX - dragVector.originX;
    const rawDy = dragVector.currentY - dragVector.originY;
    const rawDist = Math.hypot(rawDx, rawDy);

    if (rawDist > 5.0) {
      const dMax = 110.0;
      const lMax = 70.0;
      const clampedDist = Math.min(dMax, rawDist);
      const normForce = clampedDist / dMax;
      const guideLength = normForce * lMax;

      const guideDirX = -rawDx / rawDist;
      const guideDirY = -rawDy / rawDist;

      ctx.save();
      ctx.strokeStyle = R.AIM_GUIDE_COLOR || '#ffffff';
      ctx.lineWidth = R.AIM_GUIDE_WIDTH || 2.0;
      ctx.lineCap = 'round';
      ctx.setLineDash(R.AIM_GUIDE_DASH || [4, 4]);

      ctx.beginPath();
      ctx.moveTo(ballScreenX, ballScreenY);
      ctx.lineTo(ballScreenX + guideDirX * guideLength, ballScreenY + guideDirY * guideLength);
      ctx.stroke();
      ctx.restore();
    }
  }

  /**
   * Draws the golf ball with fade-in opacity support.
   */
  function drawBall(ctx, cameraX, ball, palette, currentState, fadeElapsed, simWidth) {
    if (currentState === 'RESPAWN_DELAY') return;

    const ballScreenX = ball.x - cameraX;
    const ballScreenY = ball.y;

    if (ballScreenX > -10 && ballScreenX < simWidth + 10) {
      const alpha = Math.min(1.0, Math.max(0.0, fadeElapsed / 0.10));
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = palette.ball;
      ctx.beginPath();
      ctx.arc(ballScreenX, ballScreenY, BALL_RADIUS, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  /**
   * Draws minimalist retro HUD text: "HOLE X" and total stroke count.
   */
  function drawHUD(ctx, simWidth, palette, currentHole, totalStrokes) {
    ctx.font = R.HUD_FONT || 'bold 12px "Lucida Console", Monaco, Tahoma, monospace';
    ctx.fillStyle = palette.hud;

    ctx.fillText(`HOLE ${currentHole}`, 14, 20);

    const strokeText = `${totalStrokes}`;
    const strokeWidth = ctx.measureText(strokeText).width;
    ctx.fillText(strokeText, simWidth - strokeWidth - 14, 20);
  }

  /**
   * Master frame rendering function orchestrating all canvas draw passes.
   */
  function renderFrame(ctx, canvasWidth, canvasHeight, scaleX, scaleY, simWidth, simHeight, renderState) {
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    const palette = getPaletteColors(renderState.currentHole);

    ctx.save();
    ctx.scale(scaleX, scaleY);

    drawSky(ctx, simWidth, simHeight, palette);
    drawSandDunes(ctx, renderState.cameraX, renderState.holeInfo, renderState.world, simWidth, simHeight, palette, renderState.currentHole);
    drawCupCavityAndPin(ctx, renderState.cameraX, renderState.holeInfo, renderState.world, palette, renderState.currentState, renderState.riseElapsed, simWidth);
    drawVegetation(ctx, renderState.cameraX, renderState.currentHole, renderState.world, simWidth, palette);

    if (renderState.currentState === 'DRAGGING' && renderState.dragVector) {
      drawAimingTrajectory(ctx, renderState.cameraX, renderState.ball, renderState.dragVector);
    }

    drawBall(ctx, renderState.cameraX, renderState.ball, palette, renderState.currentState, renderState.fadeElapsed, simWidth);
    drawHUD(ctx, simWidth, palette, renderState.currentHole, renderState.totalStrokes);

    ctx.restore();
  }

  return {
    getPaletteColors: getPaletteColors,
    drawSky: drawSky,
    drawSandDunes: drawSandDunes,
    drawCupCavityAndPin: drawCupCavityAndPin,
    drawVegetation: drawVegetation,
    drawAimingTrajectory: drawAimingTrajectory,
    drawBall: drawBall,
    drawHUD: drawHUD,
    renderFrame: renderFrame
  };
});
