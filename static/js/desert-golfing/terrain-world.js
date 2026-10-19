/**
 * @module DesertGolfing/TerrainWorld
 * @description Procedural continuous 2D dune world generator, Catmull-Rom spline heightmap, and hole chaining.
 * Dedicated to the Desert Golfing engine in Lachlan's World.
 */

(function (root, factory) {
  'use strict';
  const Config = (root && root.DesertGolfingConfig) ||
    ((typeof require === 'function') ? require('./config.js') : {});
  const MathUtils = (root && root.DesertGolfingMath) ||
    ((typeof require === 'function') ? require('./math.js') : {});
  const res = factory(Config, MathUtils);
  if (root) root.DesertGolfingTerrainWorld = res;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = res;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (CONFIG, MathUtils) {
  'use strict';

  const hash32 = MathUtils.hash32;
  const mulberry32 = MathUtils.mulberry32;
  const evaluateCatmullRom = MathUtils.evaluateCatmullRom;
  const evaluateCatmullRomSlope = MathUtils.evaluateCatmullRomSlope;

  const CONTROL_POINT_SPACING_DX = (CONFIG && CONFIG.WORLD && CONFIG.WORLD.CONTROL_POINT_SPACING_DX) || 40.0;
  const A_BASE = (CONFIG && CONFIG.WORLD && CONFIG.WORLD.A_BASE) || 12.0;
  const K_A = (CONFIG && CONFIG.WORLD && CONFIG.WORLD.K_A) || 6.8;
  const Y_BASE_RATIO = (CONFIG && CONFIG.WORLD && CONFIG.WORLD.Y_BASE_RATIO) || 0.72;
  const A_MAX_RATIO = (CONFIG && CONFIG.WORLD && CONFIG.WORLD.A_MAX_RATIO) || 0.36;

  /**
   * Factory creating a continuous procedural dune world instance.
   *
   * @param {number} masterSeed - Base PRNG seed
   * @param {number|function(): number} viewportHeightOrGetter - Height or dynamic getter for height
   * @param {number} ballRadius - Radius of the golf ball for cup geometry sizing
   * @returns {Object} World query API
   */
  function createTerrainWorld(masterSeed, viewportHeightOrGetter, ballRadius) {
    const cupWidth = 2.5 * ballRadius;
    const cupDepth = 3.0 * ballRadius;
    const rGreen = 1.5 * cupWidth;

    function getViewportHeight() {
      if (typeof viewportHeightOrGetter === 'function') {
        return viewportHeightOrGetter();
      }
      return Number(viewportHeightOrGetter) || 270.0;
    }

    // Cache normalized noise values (-1.0 to 1.0) so control points can scale dynamically on resize
    const noiseCache = new Map();

    /**
     * Retrieves or generates the normalized noise value for control point index.
     *
     * @param {number} idx - Control point integer index
     * @returns {number} Normalized noise in [-1, 1]
     */
    function getControlPointNoise(idx) {
      if (noiseCache.has(idx)) return noiseCache.get(idx);
      const seed = hash32(masterSeed, idx);
      const prng = mulberry32(seed);
      const noise = prng() * 2.0 - 1.0;
      noiseCache.set(idx, noise);
      return noise;
    }

    /**
     * Computes the Y elevation of a spline control point.
     * Dynamically accounts for the active viewport height to support seamless resizing.
     *
     * @param {number} idx - Control point integer index
     * @returns {number} World Y coordinate
     */
    function getControlPointY(idx) {
      const vh = getViewportHeight();
      const yBase = vh * Y_BASE_RATIO;
      const aMax = vh * A_MAX_RATIO;

      const noise = getControlPointNoise(idx);
      const approxHole = Math.max(1, Math.floor((idx * CONTROL_POINT_SPACING_DX) / 360));
      const amplitude = Math.min(aMax, A_BASE + K_A * Math.log2(approxHole + 1));
      return yBase + noise * amplitude;
    }

    /**
     * Evaluates raw Catmull-Rom spline ground elevation at world X coordinate.
     *
     * @param {number} worldX - World X coordinate
     * @returns {number} Continuous ground Y elevation
     */
    function getRawSplineElevation(worldX) {
      const idx = Math.floor(worldX / CONTROL_POINT_SPACING_DX);
      const t = (worldX - idx * CONTROL_POINT_SPACING_DX) / CONTROL_POINT_SPACING_DX;
      const p0 = getControlPointY(idx - 1);
      const p1 = getControlPointY(idx);
      const p2 = getControlPointY(idx + 1);
      const p3 = getControlPointY(idx + 2);
      return evaluateCatmullRom(p0, p1, p2, p3, t);
    }

    /**
     * Evaluates raw Catmull-Rom spline slope (dy/dx) at world X coordinate.
     *
     * @param {number} worldX - World X coordinate
     * @returns {number} Instantaneous slope dy/dx
     */
    function getRawSplineSlope(worldX) {
      const idx = Math.floor(worldX / CONTROL_POINT_SPACING_DX);
      const t = (worldX - idx * CONTROL_POINT_SPACING_DX) / CONTROL_POINT_SPACING_DX;
      const p0 = getControlPointY(idx - 1);
      const p1 = getControlPointY(idx);
      const p2 = getControlPointY(idx + 1);
      const p3 = getControlPointY(idx + 2);
      return evaluateCatmullRomSlope(p0, p1, p2, p3, t, CONTROL_POINT_SPACING_DX);
    }

    // Cache hole layout metadata
    const holeCache = new Map();

    /**
     * Computes or retrieves deterministic hole metadata: teeX, cupX, cupY, distance, and cactus.
     * Continuous Hole Chaining: The tee of Hole N is strictly positioned at the cup of Hole N-1.
     *
     * @param {number} h - 1-based hole index
     * @param {number} [viewportWidth=470] - Simulation viewport width
     * @returns {Object} Hole metadata object
     */
    function getHoleInfo(h, viewportWidth) {
      if (holeCache.has(h)) return holeCache.get(h);

      let teeX = 60.0;
      if (h > 1) {
        const prev = getHoleInfo(h - 1, viewportWidth);
        teeX = prev.cupX; // Tee of Hole N is EXACTLY at the cup of Hole N-1
      }

      const seedH = hash32(masterSeed, h);
      const prng = mulberry32(seedH);

      const w = viewportWidth || 470;
      const minDist = w * 0.65;
      const maxDist = w * 0.82;
      const holeDist = minDist + prng() * (maxDist - minDist);
      const cupX = teeX + holeDist;
      const cupY = getRawSplineElevation(cupX);

      // Procedural vegetation strictly on flat plateaus (|slope| <= 0.08)
      // Rare desert anomaly: milestone holes (100, 200, 500) or ~2.5% chance after hole 25
      let cactus = null;
      const isMilestone = (h === 100 || h === 200 || h === 500);
      const isRandomRare = (h >= 25 && prng() < 0.025);
      const hasCactus = isMilestone || isRandomRare;

      if (hasCactus) {
        const minScan = teeX + 45;
        const maxScan = cupX - 45;
        let bestX = null;
        let minSlope = Infinity;

        for (let candX = minScan; candX <= maxScan; candX += 6) {
          const slope = Math.abs(getRawSplineSlope(candX));
          if (slope < minSlope) {
            minSlope = slope;
            bestX = candX;
          }
        }

        if (bestX !== null && minSlope <= 0.08) {
          cactus = {
            worldX: bestX,
            groundY: getRawSplineElevation(bestX),
            height: 18 + prng() * 10
          };
        }
      }

      const info = {
        holeIndex: h,
        teeX: teeX,
        cupX: cupX,
        cupY: cupY,
        holeDist: holeDist,
        cactus: cactus
      };

      holeCache.set(h, info);
      return info;
    }

    /**
     * Computes continuous surface elevation with smooth Hermite green flattening at cups.
     *
     * @param {number} worldX - World X coordinate
     * @param {number} activeHoleIndex - Current hole index
     * @param {number} [viewportWidth=470] - Simulation viewport width
     * @returns {number} Surface elevation Y
     */
    function getDuneElevation(worldX, activeHoleIndex, viewportWidth) {
      let elev = getRawSplineElevation(worldX);

      const hCur = getHoleInfo(activeHoleIndex, viewportWidth);
      const hPrev = activeHoleIndex > 1 ? getHoleInfo(activeHoleIndex - 1, viewportWidth) : null;
      const hNext = getHoleInfo(activeHoleIndex + 1, viewportWidth);

      const holes = [hPrev, hCur, hNext];
      for (let i = 0; i < holes.length; i++) {
        const hObj = holes[i];
        if (!hObj) continue;
        const dist = Math.abs(worldX - hObj.cupX);
        if (dist < rGreen) {
          const factor = dist / rGreen;
          const blend = factor * factor * (3 - 2 * factor);
          elev = hObj.cupY * (1 - blend) + elev * blend;
        }
      }

      return elev;
    }

    /**
     * Computes physical elevation with U-trench cavity cutout for ONLY the active target cup.
     * The previous hole (now the tee) has zero trench (it is smooth continuous sand).
     *
     * @param {number} worldX - World X coordinate
     * @param {number} activeHoleIndex - Current hole index
     * @param {number} [viewportWidth=470] - Simulation viewport width
     * @returns {number} Physical solid ground elevation Y
     */
    function getPhysicalElevation(worldX, activeHoleIndex, viewportWidth) {
      const hCur = getHoleInfo(activeHoleIndex, viewportWidth);
      const distFromCup = Math.abs(worldX - hCur.cupX);
      if (distFromCup <= cupWidth * 0.5) {
        return hCur.cupY + cupDepth;
      }
      return getDuneElevation(worldX, activeHoleIndex, viewportWidth);
    }

    /**
     * Computes unit surface normal and tangent vectors using finite-difference sampling.
     *
     * @param {number} worldX - World X coordinate
     * @param {number} activeHoleIndex - Current hole index
     * @param {number} [viewportWidth=470] - Simulation viewport width
     * @returns {Object} { tx, ty, nx, ny, slope }
     */
    function getSurfaceNormal(worldX, activeHoleIndex, viewportWidth) {
      const hCur = getHoleInfo(activeHoleIndex, viewportWidth);
      const distFromCup = Math.abs(worldX - hCur.cupX);
      if (distFromCup <= cupWidth * 0.5) {
        return { nx: 0, ny: -1, tx: 1, ty: 0, slope: 0 };
      }

      const delta = 1.5;
      const y1 = getDuneElevation(worldX - delta, activeHoleIndex, viewportWidth);
      const y2 = getDuneElevation(worldX + delta, activeHoleIndex, viewportWidth);
      const dy = y2 - y1;
      const dxDist = delta * 2;
      const len = Math.hypot(dxDist, dy) || 1;

      return {
        tx: dxDist / len,
        ty: dy / len,
        nx: dy / len,
        ny: -dxDist / len,
        slope: dy / dxDist
      };
    }

    return {
      getControlPointY: getControlPointY,
      getRawSplineElevation: getRawSplineElevation,
      getRawSplineSlope: getRawSplineSlope,
      getDuneElevation: getDuneElevation,
      getPhysicalElevation: getPhysicalElevation,
      getSurfaceNormal: getSurfaceNormal,
      getHoleInfo: getHoleInfo,
      cupWidth: cupWidth,
      cupDepth: cupDepth,
      rGreen: rGreen
    };
  }

  return {
    createTerrainWorld: createTerrainWorld
  };
});
