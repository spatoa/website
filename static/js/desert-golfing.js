/**
 * @module DesertGolfing
 * @description Technical Specification Compliant: 2D Minimalist Physics and Dune Engine.
 *
 * Authentic Justin Smith Desert Golfing continuous world mechanics:
 * 1. Continuous Infinite Dune World: Single continuous Catmull-Rom heightmap across all holes.
 *    No seams or terrain jumps between stages.
 * 2. Hole Chaining & Ball Elevation:
 *    - Hole 1 tee starts at X = 60, cup at X_cup(1).
 *    - For Hole N+1, the tee is AT the previous hole's cup: X_tee(N+1) = X_cup(N).
 *    - The ball is raised from the cup bottom to the surface rim of the previous hole.
 *    - The previous hole is REMOVED the instant the ball is raised to its new position.
 *    - Camera glides horizontally right across the continuous terrain, bringing the old cup
 *      (now smooth sand tee) and resting ball to the left (X ~ 50) and the new target cup into view on the right.
 * 3. Last-Stroke Position Reset with 1-Second Despawn Delay:
 *    - Tight right-side border buffer (screenX > width + 10).
 *    - When the ball passes out of view / off-screen, it immediately despawns, waits 1.0 second,
 *      and then respawns at the exact position before the stroke that sent it off screen.
 * 4. Tuned Dynamic Physics:
 *    - Ball rolls faster and more dynamically down slopes (slope gravity coupling ~0.90).
 *    - Sand kinetic rolling friction decelerates the ball crisply on shallow inclines, stopping micro-slides.
 * 5. Clean U-Trench Cup Geometry:
 *    - Subpixel-aligned vertical cutout in the sand mesh eliminates any gaps or sky bleed under rim.
 * 6. Slope-Constrained Cacti:
 *    - Vegetation only spawns on flat plateaus (|slope| <= 0.12).
 * 7. Persistence & Audio:
 *    - Version 1 schema with IEEE 802.3 CRC32 checksum.
 *    - Diegetic single-trigger cup drop audio.
 *
 * @exports window.DesertGolfing
 * @storageKeys lachlan_desert_golfing_v1
 */

(function () {
  'use strict';

  const STORAGE_KEY = 'lachlan_desert_golfing_v1';
  const DEFAULT_MASTER_SEED = 894312;

  // =========================================================================
  // SECTION 2.1: Pseudo-Random Number Generator (PRNG) & Hash32
  // =========================================================================

  function hash32(masterSeed, index) {
    let x = (masterSeed ^ index) >>> 0;
    x = (x ^ (x >>> 16)) >>> 0;
    x = Math.imul(x, 0x45D9F3B);
    x = (x ^ (x >>> 16)) >>> 0;
    x = Math.imul(x, 0x45D9F3B);
    x = (x ^ (x >>> 16)) >>> 0;
    return x >>> 0;
  }

  function mulberry32(seed) {
    return function () {
      seed |= 0;
      seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // =========================================================================
  // SECTION 6: Persistence & CRC32 Checksum
  // =========================================================================

  const CRC32_TABLE = (function () {
    const table = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) {
        c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      }
      table[i] = c >>> 0;
    }
    return table;
  })();

  function computeCRC32(asciiStr) {
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < asciiStr.length; i++) {
      const code = asciiStr.charCodeAt(i);
      crc = (crc >>> 8) ^ CRC32_TABLE[(crc ^ code) & 0xFF];
    }
    return ((crc ^ 0xFFFFFFFF) >>> 0).toString(16).padStart(8, '0');
  }

  const SaveManager = {
    load: function () {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);

        if (parsed && parsed.version === 1 && typeof parsed.checksum === 'string') {
          const expectedChecksum = parsed.checksum;
          const copy = Object.assign({}, parsed);
          delete copy.checksum;
          const actualChecksum = computeCRC32(JSON.stringify(copy));

          if (expectedChecksum.toLowerCase() === actualChecksum.toLowerCase()) {
            return parsed;
          }
          console.warn('[DesertGolfing] Checksum mismatch in saved state. Restoring integrity.');
        }

        // Legacy format migration
        if (parsed && typeof parsed.hole === 'number') {
          const migrated = {
            version: 1,
            master_seed: parsed.seed || DEFAULT_MASTER_SEED,
            current_hole: Math.max(1, parsed.hole),
            total_strokes: Math.max(0, parsed.totalStrokes || 0),
            sound: parsed.sound || 'active',
            ball_state: {
              pos_x: (parsed.ball && typeof parsed.ball.x === 'number') ? parsed.ball.x : 60,
              pos_y: (parsed.ball && typeof parsed.ball.y === 'number') ? parsed.ball.y : 140,
              vel_x: 0,
              vel_y: 0
            },
            last_rest_pos: {
              x: (parsed.ball && typeof parsed.ball.x === 'number') ? parsed.ball.x : 60,
              y: (parsed.ball && typeof parsed.ball.y === 'number') ? parsed.ball.y : 140
            }
          };
          migrated.checksum = computeCRC32(JSON.stringify(migrated));
          this.save(migrated);
          return migrated;
        }
      } catch (err) {
        console.warn('[DesertGolfing] Error reading state:', err);
      }
      return null;
    },

    save: function (data) {
      try {
        const payload = {
          version: 1,
          master_seed: data.master_seed || DEFAULT_MASTER_SEED,
          current_hole: data.current_hole || 1,
          total_strokes: data.total_strokes || 0,
          sound: data.sound || 'active',
          ball_state: {
            pos_x: Math.round((data.ball_state.pos_x || 0) * 1000) / 1000,
            pos_y: Math.round((data.ball_state.pos_y || 0) * 1000) / 1000,
            vel_x: Math.round((data.ball_state.vel_x || 0) * 1000) / 1000,
            vel_y: Math.round((data.ball_state.vel_y || 0) * 1000) / 1000
          },
          last_rest_pos: {
            x: Math.round((data.last_rest_pos ? data.last_rest_pos.x : data.ball_state.pos_x || 0) * 1000) / 1000,
            y: Math.round((data.last_rest_pos ? data.last_rest_pos.y : data.ball_state.pos_y || 0) * 1000) / 1000
          }
        };
        payload.checksum = computeCRC32(JSON.stringify(payload));
        localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      } catch (err) {
        console.warn('[DesertGolfing] Error saving state:', err);
      }
    }
  };

  // =========================================================================
  // SECTION 7.2: Audio Subsystem (Diegetic Web Audio API Events)
  // =========================================================================

  let sharedAudioCtx = null;
  function getAudioContext() {
    if (!sharedAudioCtx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        sharedAudioCtx = new AudioCtx();
      }
    }
    if (sharedAudioCtx && sharedAudioCtx.state === 'suspended') {
      sharedAudioCtx.resume().catch(function () {});
    }
    return sharedAudioCtx;
  }

  const AudioOutput = {
    playHit: function (isMuted, impulseRatio) {
      if (isMuted) return;
      const ctx = getAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;
      const ratio = Math.max(0.1, Math.min(1.0, impulseRatio || 0.5));

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      const startFreq = 260 + 380 * ratio;
      osc.frequency.setValueAtTime(startFreq, now);
      osc.frequency.exponentialRampToValueAtTime(45, now + 0.065);

      gain.gain.setValueAtTime(0.35 * ratio, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.075);
    },

    playBounce: function (isMuted, vnMag) {
      if (isMuted) return;
      const ctx = getAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;
      const gainRatio = Math.max(0.08, Math.min(1.0, vnMag / 450.0));

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(90, now);
      osc.frequency.exponentialRampToValueAtTime(30, now + 0.05);

      gain.gain.setValueAtTime(0.26 * gainRatio, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.055);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.06);
    },

    playCup: function (isMuted) {
      if (isMuted) return;
      const ctx = getAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;

      // Single dry diegetic hollow drop
      const dropOsc = ctx.createOscillator();
      const dropGain = ctx.createGain();
      dropOsc.type = 'triangle';
      dropOsc.frequency.setValueAtTime(260, now);
      dropOsc.frequency.exponentialRampToValueAtTime(75, now + 0.045);
      dropGain.gain.setValueAtTime(0.30, now);
      dropGain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
      dropOsc.connect(dropGain);
      dropGain.connect(ctx.destination);
      dropOsc.start(now);
      dropOsc.stop(now + 0.055);

      // Subtle metallic cup ring
      const ringOsc = ctx.createOscillator();
      const ringGain = ctx.createGain();
      ringOsc.type = 'sine';
      ringOsc.frequency.setValueAtTime(1520, now + 0.01);
      ringGain.gain.setValueAtTime(0, now);
      ringGain.gain.setValueAtTime(0.16, now + 0.01);
      ringGain.gain.exponentialRampToValueAtTime(0.001, now + 0.20);
      ringOsc.connect(ringGain);
      ringGain.connect(ctx.destination);
      ringOsc.start(now + 0.01);
      ringOsc.stop(now + 0.22);
    }
  };

  // =========================================================================
  // SECTION 2: Infinite Continuous Desert Terrain & Catmull-Rom Spline
  // =========================================================================

  function evaluateCatmullRom(p0, p1, p2, p3, t) {
    const t2 = t * t;
    const t3 = t2 * t;
    return 0.5 * (
      (2 * p1) +
      (-p0 + p2) * t +
      (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
      (-p0 + 3 * p1 - 3 * p2 + p3) * t3
    );
  }

  function evaluateCatmullRomSlope(p0, p1, p2, p3, t, dx) {
    const t2 = t * t;
    const dy_dt = 0.5 * (
      (-p0 + p2) +
      2 * (2 * p0 - 5 * p1 + 4 * p2 - p3) * t +
      3 * (-p0 + 3 * p1 - 3 * p2 + p3) * t2
    );
    return dy_dt / dx;
  }

  const CONTROL_POINT_SPACING_DX = 40.0;

  function createContinuousWorld(masterSeed, viewportHeight, ballRadius) {
    const yBase = viewportHeight * 0.72;
    const A_base = 12.0;
    const k_a = 6.8;
    const A_max = viewportHeight * 0.36;

    const cupWidth = 2.5 * ballRadius;
    const cupDepth = 3.0 * ballRadius;
    const rGreen = 1.5 * cupWidth;

    const cpCache = new Map();

    function getControlPointY(idx) {
      if (cpCache.has(idx)) return cpCache.get(idx);
      const seed = hash32(masterSeed, idx);
      const prng = mulberry32(seed);
      const noise = prng() * 2.0 - 1.0;

      const approxHole = Math.max(1, Math.floor((idx * CONTROL_POINT_SPACING_DX) / 360));
      const amplitude = Math.min(A_max, A_base + k_a * Math.log2(approxHole + 1));
      const y = yBase + noise * amplitude;
      cpCache.set(idx, y);
      return y;
    }

    function getRawSplineElevation(worldX) {
      const idx = Math.floor(worldX / CONTROL_POINT_SPACING_DX);
      const t = (worldX - idx * CONTROL_POINT_SPACING_DX) / CONTROL_POINT_SPACING_DX;
      const p0 = getControlPointY(idx - 1);
      const p1 = getControlPointY(idx);
      const p2 = getControlPointY(idx + 1);
      const p3 = getControlPointY(idx + 2);
      return evaluateCatmullRom(p0, p1, p2, p3, t);
    }

    function getRawSplineSlope(worldX) {
      const idx = Math.floor(worldX / CONTROL_POINT_SPACING_DX);
      const t = (worldX - idx * CONTROL_POINT_SPACING_DX) / CONTROL_POINT_SPACING_DX;
      const p0 = getControlPointY(idx - 1);
      const p1 = getControlPointY(idx);
      const p2 = getControlPointY(idx + 1);
      const p3 = getControlPointY(idx + 2);
      return evaluateCatmullRomSlope(p0, p1, p2, p3, t, CONTROL_POINT_SPACING_DX);
    }

    const holeCache = new Map();

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

      // Extremely rare vegetation strictly on flat terrain (|slope| <= 0.08)
      // Rare desert anomaly: only milestone holes (100, 200, 500) or ~2.5% chance after hole 25
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

    // Continuous surface elevation with green flattening at cup locations
    function getDuneElevation(worldX, activeHoleIndex, viewportWidth) {
      let elev = getRawSplineElevation(worldX);

      const hCur = getHoleInfo(activeHoleIndex, viewportWidth);
      const hPrev = activeHoleIndex > 1 ? getHoleInfo(activeHoleIndex - 1, viewportWidth) : null;
      const hNext = getHoleInfo(activeHoleIndex + 1, viewportWidth);

      [hPrev, hCur, hNext].forEach(function (hObj) {
        if (!hObj) return;
        const dist = Math.abs(worldX - hObj.cupX);
        if (dist < rGreen) {
          const factor = dist / rGreen;
          const blend = factor * factor * (3 - 2 * factor);
          elev = hObj.cupY * (1 - blend) + elev * blend;
        }
      });

      return elev;
    }

    // Physical ground elevation: ONLY the active target cup has a trench cavity.
    // The previous hole (now the tee) has zero trench (it is smooth continuous sand).
    function getPhysicalElevation(worldX, activeHoleIndex, viewportWidth) {
      const hCur = getHoleInfo(activeHoleIndex, viewportWidth);
      const distFromCup = Math.abs(worldX - hCur.cupX);
      if (distFromCup <= cupWidth * 0.5) {
        return hCur.cupY + cupDepth;
      }
      return getDuneElevation(worldX, activeHoleIndex, viewportWidth);
    }

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
      getDuneElevation: getDuneElevation,
      getPhysicalElevation: getPhysicalElevation,
      getSurfaceNormal: getSurfaceNormal,
      getHoleInfo: getHoleInfo,
      cupWidth: cupWidth,
      cupDepth: cupDepth,
      rGreen: rGreen
    };
  }

  // =========================================================================
  // SECTION 3: Physics Parameters (Spec §3 & Dynamic Rolling Tuning)
  // =========================================================================

  const GRAVITY_Y = 560.0;
  const AIR_DRAG_CD = 0.001;
  const RESTITUTION_E = 0.20;     // Spec §1: 0.15 - 0.25 highly damped normal restitution
  const MU_K = 0.45;              // Spec §2: Kinetic friction coefficient
  const MU_S = 0.62;              // Spec §3: Static friction threshold (angle of repose ~31.8 deg)
  const V_THRESHOLD = 8.0;        // Spec §4: Zero-velocity cutoff threshold (~0.05 m/s)
  const BOUNCE_MIN_SPEED = 140.0; // px/s (only high-velocity shots rebound, others deaden immediately)
  const SLOPE_GRAVITY_FACTOR = 0.38; // Arcade tuning: scaled slope gravity prevents runaway speed
  const ROLLING_FRICTION_BASE = 72.0; // px/s^2 gentle rolling friction for gradual rollout
  const LINEAR_ROLLING_DRAG = 1.05;  // s^-1 linear velocity drag prevents bullet speeds
  const BALL_MASS = 1.0;
  const BALL_RADIUS = 3.5;
  const D_MAX = 110.0;
  const K_FORCE = 5.2;
  const L_MAX = 70.0;
  const REST_CONSECUTIVE_TICKS = 10;

  function computeAcceleration(vx, vy) {
    const speed = Math.hypot(vx, vy);
    const ax = -AIR_DRAG_CD * speed * vx;
    const ay = GRAVITY_Y - AIR_DRAG_CD * speed * vy;
    return { ax: ax, ay: ay };
  }

  // =========================================================================
  // SECTION 7.1: Visual Output & Color Palettes
  // =========================================================================

  const PALETTES = [
    { sky: [247, 211, 153], sand: [224, 153, 83], flag: [220, 38, 38], ball: [255, 255, 255], hud: [124, 45, 18], cactus: [46, 125, 50] },
    { sky: [252, 165, 165], sand: [194, 65, 12], flag: [255, 255, 255], ball: [255, 255, 255], hud: [69, 10, 10], cactus: [21, 128, 61] },
    { sky: [109, 40, 217], sand: [76, 29, 149], flag: [244, 63, 94], ball: [255, 255, 255], hud: [233, 213, 255], cactus: [4, 120, 87] },
    { sky: [30, 27, 75], sand: [15, 23, 42], flag: [56, 189, 248], ball: [255, 255, 255], hud: [147, 197, 253], cactus: [2, 132, 199] },
    { sky: [251, 207, 232], sand: [219, 39, 119], flag: [255, 255, 255], ball: [255, 255, 255], hud: [131, 24, 67], cactus: [16, 185, 129] },
    { sky: [186, 230, 253], sand: [202, 138, 4], flag: [225, 29, 72], ball: [255, 255, 255], hud: [113, 63, 18], cactus: [5, 150, 105] }
  ];

  function interpolateColor(c1, c2, t) {
    const r = Math.round(c1[0] + (c2[0] - c1[0]) * t);
    const g = Math.round(c1[1] + (c2[1] - c1[1]) * t);
    const b = Math.round(c1[2] + (c2[2] - c1[2]) * t);
    return `rgb(${r}, ${g}, ${b})`;
  }

  function getPaletteColors(holeIndex) {
    const doc = document.documentElement;
    const themeAttr = doc.getAttribute('data-theme') || (document.body && document.body.getAttribute('data-theme')) || 'windows';

    if (themeAttr === 'midnight') {
      return { sky: '#0b1120', sand: '#1e293b', flag: '#06b6d4', ball: '#f8fafc', hud: '#38bdf8', cactus: '#0284c7' };
    }
    if (themeAttr === 'cyber-y2k') {
      return { sky: '#130424', sand: '#220838', flag: '#00ff88', ball: '#00ff88', hud: '#00ff88', cactus: '#a855f7' };
    }
    if (themeAttr === 'scene-punk') {
      return { sky: '#0a0005', sand: '#230013', flag: '#ff1493', ball: '#ffffff', hud: '#ff1493', cactus: '#ff1493' };
    }

    const M = PALETTES.length;
    const h = Math.max(1, holeIndex);
    // Palettes cycle across major epochs (150 holes per epoch; sunset arrives at holes 135-150)
    const HOLES_PER_EPOCH = 150;
    const TRANSITION_WINDOW = 18;
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

  function smoothstep(tau) {
    const clamped = Math.max(0, Math.min(1, tau));
    return 3 * clamped * clamped - 2 * clamped * clamped * clamped;
  }

  // =========================================================================
  // MAIN GAME INSTANCE FACTORY
  // =========================================================================

  function createGameInstance(canvas, options) {
    if (!canvas) return null;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    options = options || {};

    let width = canvas.width || 470;
    let height = canvas.height || 250;

    const saved = SaveManager.load();
    let masterSeed = saved ? (saved.master_seed || DEFAULT_MASTER_SEED) : DEFAULT_MASTER_SEED;
    let currentHole = saved ? (saved.current_hole || 1) : 1;
    let totalStrokes = saved ? (saved.total_strokes || 0) : 0;
    let isMuted = saved ? (saved.sound === 'muted') : false;

    const world = createContinuousWorld(masterSeed, height, BALL_RADIUS);
    let holeInfo = world.getHoleInfo(currentHole, width);

    function getCameraFraming(h) {
      const info = world.getHoleInfo(h, width);
      return Math.max(0, info.teeX - 50.0);
    }

    let cameraX = getCameraFraming(currentHole);
    let cameraStartX = cameraX;
    let cameraTargetX = cameraX;
    let dwellTimer = 0;
    let riseElapsed = 0;
    let riseStartY = 0;
    let riseTargetY = 0;
    const RISE_DURATION = 0.45;
    let panElapsed = 0;
    let respawnTimer = 0;
    const PAN_DURATION = 1.0;
    const FADE_DURATION = 0.10;
    const FLAG_FADE_DURATION = 0.10;
    let fadeElapsed = FADE_DURATION;

    const States = {
      IDLE: 'IDLE',
      DRAGGING: 'DRAGGING',
      BALL_FLIGHT: 'BALL_FLIGHT',
      CUP_DWELL: 'CUP_DWELL',
      CUP_RISING: 'CUP_RISING',
      CAMERA_PANNING: 'CAMERA_PANNING',
      RESPAWN_DELAY: 'RESPAWN_DELAY'
    };
    let currentState = States.IDLE;

    const ball = {
      x: holeInfo.teeX,
      y: world.getDuneElevation(holeInfo.teeX, currentHole, width) - BALL_RADIUS - 0.5,
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

    let dragOriginX = 0;
    let dragOriginY = 0;
    let dragCurrentX = 0;
    let dragCurrentY = 0;

    let isRunning = false;
    let animFrameId = null;
    let lastTimestamp = performance.now();
    let timeAccumulator = 0;
    const FIXED_DT = 1.0 / 60.0;

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

    // =======================================================================
    // PHYSICS TICK & 6-STEP SCORING SEQUENCE
    // =======================================================================

    function physicsStep(dt) {
      // Out-of-bounds 1-second delay (ball despawned, waits 1s, then respawns at lastRestPosition with fade-in)
      if (currentState === States.RESPAWN_DELAY) {
        respawnTimer -= dt;
        if (respawnTimer <= 0) {
          ball.x = lastRestPosition.x;
          ball.y = lastRestPosition.y;
          ball.vx = 0;
          ball.vy = 0;
          ball.restTicks = REST_CONSECUTIVE_TICKS;
          currentState = States.IDLE;
          fadeElapsed = 0; // Trigger smooth fade-in from alpha 0 to 1
          persist();
        }
        return;
      }

      if (currentState === States.IDLE) {
        if (fadeElapsed < FADE_DURATION) {
          fadeElapsed += dt;
        }
      }

      // Step 2a: Dwell Phase in Cup Bottom (brief 0.35s pause)
      if (currentState === States.CUP_DWELL) {
        dwellTimer -= dt;
        if (dwellTimer <= 0) {
          const cupBottomY = holeInfo.cupY + world.cupDepth;
          currentState = States.CUP_RISING;
          riseElapsed = 0;
          riseStartY = cupBottomY - BALL_RADIUS;
          riseTargetY = world.getDuneElevation(holeInfo.cupX, currentHole, width) - BALL_RADIUS - 0.5;
        }
        return;
      }

      // Step 2b: Smooth Vertical Elevation to Surface Rim
      if (currentState === States.CUP_RISING) {
        riseElapsed += dt;
        const tau = Math.min(1.0, riseElapsed / RISE_DURATION);
        ball.x = holeInfo.cupX;
        ball.y = riseStartY + (riseTargetY - riseStartY) * smoothstep(tau);
        ball.vx = 0;
        ball.vy = 0;

        if (tau >= 1.0) {
          ball.y = riseTargetY;
          lastRestPosition.x = ball.x;
          lastRestPosition.y = ball.y;

          // Ball has reached surface rim: advance to next hole (old hole becomes flat sand at tee)
          currentHole++;
          holeInfo = world.getHoleInfo(currentHole, width);

          // Step 3: Initiate Horizontal Camera Pan across continuous terrain
          cameraStartX = cameraX;
          cameraTargetX = getCameraFraming(currentHole);
          panElapsed = 0;
          currentState = States.CAMERA_PANNING;
        }
        return;
      }

      // Step 3: Camera Pan Execution
      if (currentState === States.CAMERA_PANNING) {
        panElapsed += dt;
        const tau = Math.min(1.0, panElapsed / PAN_DURATION);
        cameraX = cameraStartX + (cameraTargetX - cameraStartX) * smoothstep(tau);

        if (tau >= 1.0) {
          // Camera pan finishes: fixed framing for new hole
          cameraX = cameraTargetX;

          // Step 5: Immediate persistence write
          persist();

          // Step 6: Input Reactivation
          currentState = States.IDLE;
        }
        return;
      }

      if (currentState !== States.BALL_FLIGHT) {
        return;
      }

      // Velocity Verlet integration
      const aCurrent = computeAcceleration(ball.vx, ball.vy);

      let nextX = ball.x + ball.vx * dt + 0.5 * aCurrent.ax * dt * dt;
      let nextY = ball.y + ball.vy * dt + 0.5 * aCurrent.ay * dt * dt;

      const estVx = ball.vx + aCurrent.ax * dt;
      const estVy = ball.vy + aCurrent.ay * dt;
      const aNext = computeAcceleration(estVx, estVy);

      let nextVx = ball.vx + 0.5 * (aCurrent.ax + aNext.ax) * dt;
      let nextVy = ball.vy + 0.5 * (aCurrent.ay + aNext.ay) * dt;

      // =====================================================================
      // OUT-OF-BOUNDS DETECTION: Tight borders (no large buffer on right)
      // Left: -12px, Right: width + 10px, Bottom: height + 15px
      // Triggers 1.0-second despawn delay before respawning at lastRestPosition
      // =====================================================================
      const screenX = nextX - cameraX;
      if (screenX < -12 || nextY > height + 15 || screenX > width + 10) {
        ball.vx = 0;
        ball.vy = 0;
        currentState = States.RESPAWN_DELAY;
        respawnTimer = 1.0; // Despawn and wait 1.0s before respawning
        fadeElapsed = 0;
        return;
      }

      // =====================================================================
      // STEP 1: Cup Trigger Detection & Single Audio Feedback
      // =====================================================================
      const cupLeftX = holeInfo.cupX - world.cupWidth * 0.5;
      const cupRightX = holeInfo.cupX + world.cupWidth * 0.5;
      const cupRimY = holeInfo.cupY;
      const cupBottomY = cupRimY + world.cupDepth;

      const isInsideCupHorizontal = (nextX > cupLeftX + BALL_RADIUS * 0.5) && (nextX < cupRightX - BALL_RADIUS * 0.5);

      if (isInsideCupHorizontal && (nextY + BALL_RADIUS >= cupBottomY - 1.2)) {
        ball.x = holeInfo.cupX;
        ball.y = cupBottomY - BALL_RADIUS;
        ball.vx = 0;
        ball.vy = 0;
        ball.restTicks = REST_CONSECUTIVE_TICKS;

        currentState = States.CUP_DWELL;
        dwellTimer = 0.35;

        AudioOutput.playCup(isMuted);
        return;
      }

      // Vertical inner cup wall reflections
      if (nextX >= cupLeftX && nextX <= cupRightX && nextY + BALL_RADIUS >= cupRimY) {
        if (nextX - BALL_RADIUS <= cupLeftX) {
          nextX = cupLeftX + BALL_RADIUS;
          nextVx = Math.abs(nextVx) * 0.25;
        } else if (nextX + BALL_RADIUS >= cupRightX) {
          nextX = cupRightX - BALL_RADIUS;
          nextVx = -Math.abs(nextVx) * 0.25;
        }
      }

      // =====================================================================
      // 2D COULOMB FRICTION & DUNE INTERACTION MODEL (Spec §1 - §4)
      // =====================================================================
      const groundY = world.getPhysicalElevation(nextX, currentHole, width);
      const penetration = (nextY + BALL_RADIUS) - groundY;

      if (penetration >= 0) {
        nextY = groundY - BALL_RADIUS;
        const norm = world.getSurfaceNormal(nextX, currentHole, width);

        // 1. Velocity Decomposition: v_n = (v . n)n, v_t = v - v_n
        const vnMag = nextVx * norm.nx + nextVy * norm.ny;
        let vtMag = nextVx * norm.tx + nextVy * norm.ty;

        const cosTheta = -norm.ny;
        const sinTheta = Math.abs(norm.ty);
        const tanTheta = Math.abs(norm.slope);

        // 2. Inelastic Normal Absorption (Spec §1): e ≈ 0.15 - 0.25
        if (vnMag < -BOUNCE_MIN_SPEED) {
          const newVnMag = -RESTITUTION_E * vnMag;

          if (Math.abs(vnMag) > 35.0 && !(nextX >= cupLeftX && nextX <= cupRightX)) {
            AudioOutput.playBounce(isMuted, Math.abs(vnMag));
          }

          nextVx = newVnMag * norm.nx + vtMag * norm.tx;
          nextVy = newVnMag * norm.ny + vtMag * norm.ty;
          nextY = groundY - BALL_RADIUS - 0.25;
        } else {
          // Deadens immediately into surface contact
          if (vnMag < 0) {
            vtMag *= 0.88; // gentle landing absorption from airborne flight to rolling
            if (Math.abs(vnMag) > 35.0 && !(nextX >= cupLeftX && nextX <= cupRightX)) {
              AudioOutput.playBounce(isMuted, Math.abs(vnMag));
            }
          }

          // 3. Arcade Rolling Friction & Controlled Slope Dynamics
          // Controlled slope gravity prevents runaway bullet speeds down dunes
          const slopeGravity = GRAVITY_Y * SLOPE_GRAVITY_FACTOR * norm.ty;

          // Gradual rolling friction deceleration (linear drag + gentle base friction)
          let decelRate = LINEAR_ROLLING_DRAG * Math.abs(vtMag) + ROLLING_FRICTION_BASE * cosTheta;

          // Anti-creep progressive static bite:
          // When rolling downhill on stable dunes (tanTheta <= MU_S), downhill gravity fights
          // rolling friction, causing a slow everlasting crawl at terminal velocity.
          // We guarantee that as speed drops below 55 px/s, rolling resistance smoothly ramps up
          // to strictly exceed downhill gravity by at least 50 px/s^2, ensuring a prompt, natural stop.
          const isMovingDownhill = (vtMag * norm.ty > 0);
          if (tanTheta <= MU_S && isMovingDownhill) {
            const downhillPull = Math.abs(slopeGravity);
            if (Math.abs(vtMag) < 55.0) {
              const biteFactor = 1.0 - (Math.abs(vtMag) / 55.0);
              const minNeededDecel = downhillPull + 50.0;
              if (decelRate < minNeededDecel) {
                decelRate += (minNeededDecel - decelRate) * biteFactor;
              }
            }
          }

          const rollingDecel = decelRate * dt;

          if (Math.abs(vtMag) > V_THRESHOLD) {
            // Ball is in tangential motion along the slope
            const netVt = vtMag + slopeGravity * dt;
            if (Math.abs(netVt) <= rollingDecel) {
              vtMag = 0;
            } else {
              vtMag = netVt - Math.sign(netVt) * rollingDecel;
            }
          } else {
            // Ball speed is below zero-velocity threshold
            if (tanTheta <= MU_S) {
              // Sticking Condition: tan(theta) <= mu_s (slope <= angle of repose)
              // Ball stops and locks position
              vtMag = 0;
            } else {
              // Sliding Condition: tan(theta) > mu_s (slope > angle of repose)
              // Accelerates down steep crest at a readable, controlled arcade pace
              const downhillDir = Math.sign(norm.ty) || 1;
              const aSlope = GRAVITY_Y * SLOPE_GRAVITY_FACTOR * (sinTheta - 0.20 * cosTheta);
              vtMag += downhillDir * Math.max(0, aSlope) * dt;
            }
          }

          nextVx = vtMag * norm.tx;
          nextVy = vtMag * norm.ty;
        }
      }

      ball.x = nextX;
      ball.y = nextY;
      ball.vx = nextVx;
      ball.vy = nextVy;

      // 4. Settling and Zero-Velocity Threshold (Spec §4)
      const currentSpeed = Math.hypot(ball.vx, ball.vy);
      const distToSurface = Math.abs((ball.y + BALL_RADIUS) - world.getPhysicalElevation(ball.x, currentHole, width));
      const norm = world.getSurfaceNormal(ball.x, currentHole, width);
      const tanTheta = Math.abs(norm.slope);

      // Lock position only if sticking condition holds (tanTheta <= MU_S)
      if (currentSpeed < V_THRESHOLD && distToSurface <= 1.5 && tanTheta <= MU_S) {
        ball.restTicks++;
        if (ball.restTicks >= REST_CONSECUTIVE_TICKS) {
          ball.vx = 0;
          ball.vy = 0;
          ball.y = world.getPhysicalElevation(ball.x, currentHole, width) - BALL_RADIUS;
          currentState = States.IDLE;
          lastRestPosition.x = ball.x;
          lastRestPosition.y = ball.y;
          persist();
        }
      } else {
        ball.restTicks = 0;
      }
    }

    // =======================================================================
    // SECTION 7.1: Continuous Terrain & UI Rendering
    // =======================================================================

    function render() {
      ctx.clearRect(0, 0, width, height);
      const palette = getPaletteColors(currentHole);

      // 1. Sky
      ctx.fillStyle = palette.sky;
      ctx.fillRect(0, 0, width, height);

      // 2. Sand Dune Polygon across camera view (with exact U-trench cutout for ONLY the active target cup)
      ctx.beginPath();
      ctx.moveTo(0, height);

      const activeCupScreenX = holeInfo.cupX - cameraX;
      const cupLeftScreen = activeCupScreenX - world.cupWidth * 0.5;
      const cupRightScreen = activeCupScreenX + world.cupWidth * 0.5;
      const rimY = holeInfo.cupY;
      const bottomY = rimY + world.cupDepth;

      let renderedCup = false;
      const stepPx = 3;

      for (let px = 0; px <= width + stepPx; px += stepPx) {
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

        const gy = world.getDuneElevation(wx, currentHole, width);
        ctx.lineTo(px, gy);
      }

      ctx.lineTo(width, height);
      ctx.closePath();
      ctx.fillStyle = palette.sand;
      ctx.fill();

      // 3. Dark Cup Cavity for the active target hole (previous hole is removed)
      if (activeCupScreenX > -40 && activeCupScreenX < width + 40) {
        ctx.fillStyle = '#111827';
        ctx.fillRect(cupLeftScreen, rimY, world.cupWidth, world.cupDepth);

        // Pin Pole & Flag (fades out in 0.1s on scoring as the ball rises)
        let flagAlpha = 1.0;
        if (currentState === States.CUP_RISING) {
          flagAlpha = Math.max(0.0, 1.0 - (riseElapsed / FLAG_FADE_DURATION));
        }

        if (flagAlpha > 0.0) {
          ctx.save();
          ctx.globalAlpha = flagAlpha;

          const poleHeight = 36;
          ctx.strokeStyle = '#1f2937';
          ctx.lineWidth = 1.5;
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

      // 4. Rare Vegetation (persisted and rendered seamlessly across current, upcoming, and past visible stages)
      const startHoleScan = Math.max(1, currentHole - 4);
      const endHoleScan = currentHole + 3;

      for (let hScan = startHoleScan; hScan <= endHoleScan; hScan++) {
        const hScanInfo = world.getHoleInfo(hScan, width);
        if (hScanInfo && hScanInfo.cactus) {
          const cScreenX = hScanInfo.cactus.worldX - cameraX;
          if (cScreenX > -50 && cScreenX < width + 50) {
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

      // 5. Segmented Trajectory Guide
      if (currentState === States.DRAGGING) {
        const ballScreenX = ball.x - cameraX;
        const ballScreenY = ball.y;

        const rawDx = dragCurrentX - dragOriginX;
        const rawDy = dragCurrentY - dragOriginY;
        const rawDist = Math.hypot(rawDx, rawDy);

        if (rawDist > 5.0) {
          const clampedDist = Math.min(D_MAX, rawDist);
          const normForce = clampedDist / D_MAX;
          const guideLength = normForce * L_MAX;

          const guideDirX = -rawDx / rawDist;
          const guideDirY = -rawDy / rawDist;

          ctx.save();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2.0;
          ctx.lineCap = 'round';
          ctx.setLineDash([4, 4]);

          ctx.beginPath();
          ctx.moveTo(ballScreenX, ballScreenY);
          ctx.lineTo(ballScreenX + guideDirX * guideLength, ballScreenY + guideDirY * guideLength);
          ctx.stroke();
          ctx.restore();
        }
      }

      // 6. Golf Ball (hidden/despawned during RESPAWN_DELAY, fades in upon respawn)
      if (currentState !== States.RESPAWN_DELAY) {
        const ballScreenX = ball.x - cameraX;
        const ballScreenY = ball.y;
        if (ballScreenX > -10 && ballScreenX < width + 10) {
          const alpha = Math.min(1.0, Math.max(0.0, fadeElapsed / FADE_DURATION));
          ctx.save();
          ctx.globalAlpha = alpha;
          ctx.fillStyle = palette.ball;
          ctx.beginPath();
          ctx.arc(ballScreenX, ballScreenY, BALL_RADIUS, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }

      // 7. Minimalist UI Overlay (Spec §7.1)
      ctx.font = 'bold 12px "Lucida Console", Monaco, Tahoma, monospace';
      ctx.fillStyle = palette.hud;

      ctx.fillText(`HOLE ${currentHole}`, 14, 20);

      const strokeText = `${totalStrokes}`;
      const strokeWidth = ctx.measureText(strokeText).width;
      ctx.fillText(strokeText, width - strokeWidth - 14, 20);
    }

    // =======================================================================
    // MAIN GAME LOOP (Fixed Time-Step Accumulator)
    // =======================================================================

    function loop(now) {
      if (!isRunning) return;

      const frameDelta = Math.min(0.1, (now - lastTimestamp) / 1000.0);
      lastTimestamp = now;
      timeAccumulator += frameDelta;

      while (timeAccumulator >= FIXED_DT) {
        physicsStep(FIXED_DT);
        timeAccumulator -= FIXED_DT;
      }

      render();
      animFrameId = requestAnimationFrame(loop);
    }

    // =======================================================================
    // SECTION 4: Input & Launch Controller
    // =======================================================================

    function handlePointerDown(e) {
      if (currentState !== States.IDLE) return;
      fadeElapsed = FADE_DURATION; // Full visibility when initiating a stroke

      const rect = canvas.getBoundingClientRect();
      const clientX = e.clientX || (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
      const clientY = e.clientY || (e.touches && e.touches[0] ? e.touches[0].clientY : 0);

      if (typeof canvas.setPointerCapture === 'function' && e.pointerId !== undefined) {
        try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
      }

      currentState = States.DRAGGING;
      dragOriginX = clientX - rect.left;
      dragOriginY = clientY - rect.top;
      dragCurrentX = dragOriginX;
      dragCurrentY = dragOriginY;

      getAudioContext();
    }

    function handlePointerMove(e) {
      if (currentState !== States.DRAGGING) return;
      const rect = canvas.getBoundingClientRect();
      const clientX = e.clientX || (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
      const clientY = e.clientY || (e.touches && e.touches[0] ? e.touches[0].clientY : 0);

      dragCurrentX = clientX - rect.left;
      dragCurrentY = clientY - rect.top;

      if (e.cancelable) {
        e.preventDefault();
      }
    }

    function handlePointerUp(e) {
      if (currentState !== States.DRAGGING) return;

      if (typeof canvas.releasePointerCapture === 'function' && e.pointerId !== undefined) {
        try { canvas.releasePointerCapture(e.pointerId); } catch (err) {}
      }

      const rawDx = dragCurrentX - dragOriginX;
      const rawDy = dragCurrentY - dragOriginY;
      const dist = Math.hypot(rawDx, rawDy);

      if (dist >= 6.0) {
        lastRestPosition.x = ball.x;
        lastRestPosition.y = ball.y;

        const clampedDist = Math.min(D_MAX, dist);
        const impulseMag = clampedDist * K_FORCE;
        const dirX = rawDx / dist;
        const dirY = rawDy / dist;

        const impulseX = -dirX * impulseMag;
        const impulseY = -dirY * impulseMag;

        ball.vx = impulseX / BALL_MASS;
        ball.vy = impulseY / BALL_MASS;
        ball.restTicks = 0;
        currentState = States.BALL_FLIGHT;

        totalStrokes++;

        AudioOutput.playHit(isMuted, clampedDist / D_MAX);
        persist();
      } else {
        currentState = States.IDLE;
      }
    }

    function bindEvents() {
      if ('PointerEvent' in window) {
        canvas.addEventListener('pointerdown', handlePointerDown);
        canvas.addEventListener('pointermove', handlePointerMove);
        canvas.addEventListener('pointerup', handlePointerUp);
        canvas.addEventListener('pointercancel', handlePointerUp);
      } else {
        canvas.addEventListener('touchstart', handlePointerDown, { passive: false });
        canvas.addEventListener('touchmove', handlePointerMove, { passive: false });
        canvas.addEventListener('touchend', handlePointerUp);
        canvas.addEventListener('touchcancel', handlePointerUp);

        canvas.addEventListener('mousedown', handlePointerDown);
        window.addEventListener('mousemove', handlePointerMove);
        window.addEventListener('mouseup', handlePointerUp);
      }
    }

    function unbindEvents() {
      if ('PointerEvent' in window) {
        canvas.removeEventListener('pointerdown', handlePointerDown);
        canvas.removeEventListener('pointermove', handlePointerMove);
        canvas.removeEventListener('pointerup', handlePointerUp);
        canvas.removeEventListener('pointercancel', handlePointerUp);
      } else {
        canvas.removeEventListener('touchstart', handlePointerDown);
        canvas.removeEventListener('touchmove', handlePointerMove);
        canvas.removeEventListener('touchend', handlePointerUp);
        canvas.removeEventListener('touchcancel', handlePointerUp);

        canvas.removeEventListener('mousedown', handlePointerDown);
        window.removeEventListener('mousemove', handlePointerMove);
        window.removeEventListener('mouseup', handlePointerUp);
      }
    }

    function resize(newW, newH) {
      if (newW > 0 && newH > 0) {
        width = Math.floor(newW);
        height = Math.floor(newH);
        canvas.width = width;
        canvas.height = height;
        holeInfo = world.getHoleInfo(currentHole, width);
        cameraX = getCameraFraming(currentHole);
        render();
      }
    }

    function start() {
      if (isRunning) return;
      isRunning = true;
      lastTimestamp = performance.now();
      timeAccumulator = 0;
      bindEvents();
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
      unbindEvents();
      persist();
    }

    function destroy() {
      stop();
    }

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
          alpha: (currentState === States.RESPAWN_DELAY) ? 0 : Math.min(1.0, Math.max(0.0, fadeElapsed / FADE_DURATION))
        };
      },
      getBallAlpha: function () {
        if (currentState === States.RESPAWN_DELAY) return 0;
        return Math.min(1.0, Math.max(0.0, fadeElapsed / FADE_DURATION));
      },
      getFlagAlpha: function () {
        if (currentState === States.CUP_RISING) {
          return Math.max(0.0, 1.0 - (riseElapsed / FLAG_FADE_DURATION));
        }
        return 1.0;
      },
      getPalette: function () {
        return getPaletteColors(currentHole);
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
      }
    };
  }

  // =========================================================================
  // INTEGRATION & REGISTRATION
  // =========================================================================

  function register() {
    if (window.GameEngine && typeof window.GameEngine.registerCartridge === 'function') {
      window.GameEngine.registerCartridge('desert-golfing', {
        id: 'desert-golfing',
        title: 'Desert Golfing',
        icon: '⚑',
        description: 'Deterministic continuous 2D physics & dune engine across endless sand dunes.',
        createInstance: createGameInstance
      });
    }
  }

  register();
  window.addEventListener('DOMContentLoaded', register);

  window.DesertGolfing = {
    createInstance: createGameInstance,
    getState: SaveManager.load,
    SaveManager: SaveManager,
    getPaletteColors: getPaletteColors
  };
})();
