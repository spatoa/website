/**
 * @module DesertGolfing/Config
 * @description Centralized configuration, physics parameters, world constants, and color palettes.
 * Dedicated to the Desert Golfing engine in Lachlan's World.
 */

(function (root, factory) {
  'use strict';
  const res = factory();
  if (root) root.DesertGolfingConfig = res;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = res;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const CONFIG = Object.freeze({
    /**
     * Storage & Persistence Settings
     */
    STORAGE: Object.freeze({
      KEY: 'lachlan_desert_golfing_v1',
      DEFAULT_MASTER_SEED: 894312,
      VERSION: 1
    }),

    /**
     * Simulation & Physics Constants
     * Tuned to match authentic Desert Golfing 2D physics.
     */
    PHYSICS: Object.freeze({
      GRAVITY_Y: 560.0,              // Downward gravitational acceleration (px/s^2)
      AIR_DRAG_CD: 0.001,            // Aerodynamic velocity-squared drag coefficient
      RESTITUTION_E: 0.20,           // Normal coefficient of restitution (highly damped sand bounce)
      MU_K: 0.45,                    // Kinetic friction coefficient for sliding sand contact
      MU_S: 0.62,                    // Static friction coefficient (tan(31.8 deg) angle of repose)
      V_THRESHOLD: 8.0,              // Velocity cutoff threshold below which ball can settle (px/s)
      BOUNCE_MIN_SPEED: 140.0,       // Minimum normal impact velocity to produce a rebound (px/s)
      BOUNCE_SOUND_MIN_SPEED: 35.0,  // Minimum normal velocity to trigger bounce audio (px/s)
      BOUNCE_WALL_FACTOR: 0.25,      // Horizontal velocity damping when striking inner cup walls
      SLOPE_GRAVITY_FACTOR: 0.38,    // Tangential gravity scale factor to prevent runaway roll down dunes
      ROLLING_FRICTION_BASE: 72.0,   // Base rolling resistance deceleration on dunes (px/s^2)
      LINEAR_ROLLING_DRAG: 1.05,     // Linear rolling velocity drag (s^-1)
      BALL_MASS: 1.0,                // Mass of the golf ball (arbitrary units)
      BALL_RADIUS: 3.5,              // Radius of the ball in simulation space (px)
      REST_CONSECUTIVE_TICKS: 10,    // Number of consecutive ticks below threshold needed to rest
      REST_MAX_SURFACE_DIST: 1.5,    // Max distance from surface to qualify for resting lock (px)
      ANTI_CREEP_SPEED_THRESHOLD: 55.0, // Speed under which rolling friction ramps up downhill (px/s)
      ANTI_CREEP_MIN_DECEL_BOOST: 50.0, // Minimum deceleration surplus over downhill gravity (px/s^2)
      LANDING_ABSORPTION_FACTOR: 0.88   // Tangential velocity retention upon low-velocity landing
    }),

    /**
     * Slingshot Launch & Pull Vector Parameters
     */
    SLINGSHOT: Object.freeze({
      D_MAX: 110.0,       // Maximum drag distance clamped in simulation coordinates (px)
      K_FORCE: 5.2,       // Force multiplier converting drag distance to impulse magnitude
      L_MAX: 70.0,        // Maximum visual length of the dashed aiming guide line (px)
      MIN_DRAG_DIST: 5.0, // Minimum drag distance to display the aiming trajectory guide (px)
      MIN_FIRE_DIST: 6.0  // Minimum drag distance required to execute a stroke on release (px)
    }),

    /**
     * Continuous Procedural Dune World Geometry
     */
    WORLD: Object.freeze({
      CONTROL_POINT_SPACING_DX: 40.0, // Distance between spline control points along world X (px)
      STAGE_WIDTH: 480.0,             // Virtual canvas reference width for resolution independence (px)
      STAGE_HEIGHT: 270.0,            // Virtual canvas reference height for resolution independence (px)
      CUP_WIDTH_FACTOR: 2.5,          // Ratio of cup width to ball radius (width = 2.5 * r)
      CUP_DEPTH_FACTOR: 3.0,          // Ratio of cup depth to ball radius (depth = 3.0 * r)
      GREEN_RADIUS_FACTOR: 1.5,       // Factor for the flattened "green" radius around cups
      MIN_DIST_RATIO: 0.65,           // Minimum distance to next hole relative to viewport width
      MAX_DIST_RATIO: 0.82,           // Maximum distance to next hole relative to viewport width
      DEFAULT_VIEWPORT_WIDTH: 470.0,  // Fallback viewport width (px)
      Y_BASE_RATIO: 0.72,             // Base terrain height as fraction of viewport height
      A_BASE: 12.0,                   // Base terrain spline noise amplitude
      K_A: 6.8,                       // Logarithmic terrain roughness growth coefficient
      A_MAX_RATIO: 0.36,              // Maximum terrain elevation amplitude as fraction of height
      CACTUS_MAX_SLOPE: 0.08,         // Maximum absolute slope allowed for procedural cactus spawning
      CACTUS_SCAN_STEP: 6.0,          // Search step when scanning plateau for cactus placement (px)
      CACTUS_MIN_HOLE: 25,            // Earliest hole at which rare random cacti may appear
      CACTUS_PROBABILITY: 0.025,      // Random spawn probability per hole after CACTUS_MIN_HOLE
      CAMERA_TEE_OFFSET: 50.0,        // Offset from left screen edge to the tee in camera view (px)
      TEE_INITIAL_X: 60.0             // World X coordinate for Hole 1 starting tee (px)
    }),

    /**
     * Animation Durations & State Timing
     */
    TIMING: Object.freeze({
      FIXED_DT: 1.0 / 60.0,        // Fixed simulation physics step time (seconds, ~16.67ms)
      MAX_FRAME_DELTA: 0.1,        // Maximum frame delta clamped to prevent spiral of death (seconds)
      CUP_DWELL: 0.35,             // Pause duration at bottom of cup before rising (seconds)
      CUP_RISE: 0.45,              // Duration of smooth vertical rise from cup to surface rim (seconds)
      CAMERA_PAN: 1.0,             // Duration of smooth horizontal camera glide to next hole (seconds)
      BALL_FADE: 0.10,             // Ball fade-in opacity transition duration after respawn (seconds)
      FLAG_FADE: 0.10,             // Flag fade-out duration when hole is scored (seconds)
      RESPAWN_DELAY: 1.0           // Despawn wait duration before out-of-bounds respawn (seconds)
    }),

    /**
     * Screen Out-of-Bounds Detection Margins (Camera Relative)
     */
    BOUNDS: Object.freeze({
      SCREEN_LEFT: -12.0,  // Left out-of-bounds border buffer relative to screen (px)
      SCREEN_RIGHT: 10.0,  // Right out-of-bounds border buffer relative to screen (px)
      SCREEN_BOTTOM: 15.0  // Bottom out-of-bounds border buffer relative to screen (px)
    }),

    /**
     * Canvas 2D Rendering Options
     */
    RENDER: Object.freeze({
      TERRAIN_STEP_PX: 3,         // Pixel step resolution when drawing continuous sand polygon
      FLAG_POLE_HEIGHT: 36,       // Height of the pin flag pole (px)
      FLAG_POLE_WIDTH: 1.5,       // Line width of the pin flag pole (px)
      FLAG_POLE_COLOR: '#1f2937', // Stroke color for the pin flag pole
      CUP_CAVITY_COLOR: '#111827',// Solid fill color for the dark cup trench cutout
      AIM_GUIDE_DASH: [4, 4],     // Line dash pattern for the aiming trajectory guide
      AIM_GUIDE_WIDTH: 2.0,       // Line width of the aiming trajectory guide (px)
      AIM_GUIDE_COLOR: '#ffffff', // Stroke color for the aiming trajectory guide
      HUD_FONT: 'bold 12px "Lucida Console", Monaco, Tahoma, monospace',
      HUD_MARGIN_X: 14,           // Left and right HUD text padding (px)
      HUD_MARGIN_Y: 20            // Baseline HUD text Y coordinate (px)
    }),

    /**
     * Color Palettes Across 6 Major Epochs & Theme Overrides
     */
    PALETTES: Object.freeze([
      Object.freeze({ sky: [247, 211, 153], sand: [224, 153, 83], flag: [220, 38, 38], ball: [255, 255, 255], hud: [124, 45, 18], cactus: [46, 125, 50] }),
      Object.freeze({ sky: [252, 165, 165], sand: [194, 65, 12], flag: [255, 255, 255], ball: [255, 255, 255], hud: [69, 10, 10], cactus: [21, 128, 61] }),
      Object.freeze({ sky: [109, 40, 217], sand: [76, 29, 149], flag: [244, 63, 94], ball: [255, 255, 255], hud: [233, 213, 255], cactus: [4, 120, 87] }),
      Object.freeze({ sky: [30, 27, 75], sand: [15, 23, 42], flag: [56, 189, 248], ball: [255, 255, 255], hud: [147, 197, 253], cactus: [2, 132, 199] }),
      Object.freeze({ sky: [251, 207, 232], sand: [219, 39, 119], flag: [255, 255, 255], ball: [255, 255, 255], hud: [131, 24, 67], cactus: [16, 185, 129] }),
      Object.freeze({ sky: [186, 230, 253], sand: [202, 138, 4], flag: [225, 29, 72], ball: [255, 255, 255], hud: [113, 63, 18], cactus: [5, 150, 105] })
    ]),

    THEME: Object.freeze({
      HOLES_PER_EPOCH: 150,
      TRANSITION_WINDOW: 18,
      OVERRIDES: Object.freeze({
        midnight: Object.freeze({ sky: '#0b1120', sand: '#1e293b', flag: '#06b6d4', ball: '#f8fafc', hud: '#38bdf8', cactus: '#0284c7' }),
        'cyber-y2k': Object.freeze({ sky: '#130424', sand: '#220838', flag: '#00ff88', ball: '#00ff88', hud: '#00ff88', cactus: '#a855f7' }),
        'scene-punk': Object.freeze({ sky: '#0a0005', sand: '#230013', flag: '#ff1493', ball: '#ffffff', hud: '#ff1493', cactus: '#ff1493' })
      })
    }),

    /**
     * Finite State Machine States
     */
    STATES: Object.freeze({
      IDLE: 'IDLE',
      DRAGGING: 'DRAGGING',
      BALL_FLIGHT: 'BALL_FLIGHT',
      CUP_DWELL: 'CUP_DWELL',
      CUP_RISING: 'CUP_RISING',
      CAMERA_PANNING: 'CAMERA_PANNING',
      RESPAWN_DELAY: 'RESPAWN_DELAY'
    })
  });

  return CONFIG;
});
