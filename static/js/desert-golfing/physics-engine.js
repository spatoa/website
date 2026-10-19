/**
 * @module DesertGolfing/PhysicsEngine
 * @description 2D minimalist physics engine: Velocity Verlet numerical integration,
 * Coulomb friction, slope gravity coupling, anti-creep progressive deceleration, and settling.
 * Dedicated to the Desert Golfing engine in Lachlan's World.
 */

(function (root, factory) {
  'use strict';
  const Config = (root && root.DesertGolfingConfig) ||
    ((typeof require === 'function') ? require('./config.js') : {});
  const res = factory(Config);
  if (root) root.DesertGolfingPhysicsEngine = res;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = res;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (CONFIG) {
  'use strict';

  const P = (CONFIG && CONFIG.PHYSICS) || {};
  const GRAVITY_Y = P.GRAVITY_Y || 560.0;
  const AIR_DRAG_CD = P.AIR_DRAG_CD || 0.001;
  const RESTITUTION_E = P.RESTITUTION_E || 0.20;
  const MU_K = P.MU_K || 0.45;
  const MU_S = P.MU_S || 0.62;
  const V_THRESHOLD = P.V_THRESHOLD || 8.0;
  const BOUNCE_MIN_SPEED = P.BOUNCE_MIN_SPEED || 140.0;
  const BOUNCE_SOUND_MIN_SPEED = P.BOUNCE_SOUND_MIN_SPEED || 35.0;
  const BOUNCE_WALL_FACTOR = P.BOUNCE_WALL_FACTOR || 0.25;
  const SLOPE_GRAVITY_FACTOR = P.SLOPE_GRAVITY_FACTOR || 0.38;
  const ROLLING_FRICTION_BASE = P.ROLLING_FRICTION_BASE || 72.0;
  const LINEAR_ROLLING_DRAG = P.LINEAR_ROLLING_DRAG || 1.05;
  const BALL_MASS = P.BALL_MASS || 1.0;
  const BALL_RADIUS = P.BALL_RADIUS || 3.5;
  const REST_CONSECUTIVE_TICKS = P.REST_CONSECUTIVE_TICKS || 10;
  const REST_MAX_SURFACE_DIST = P.REST_MAX_SURFACE_DIST || 1.5;
  const ANTI_CREEP_SPEED_THRESHOLD = P.ANTI_CREEP_SPEED_THRESHOLD || 55.0;
  const ANTI_CREEP_MIN_DECEL_BOOST = P.ANTI_CREEP_MIN_DECEL_BOOST || 50.0;
  const LANDING_ABSORPTION_FACTOR = P.LANDING_ABSORPTION_FACTOR || 0.88;

  const BOUNDS = (CONFIG && CONFIG.BOUNDS) || {};
  const SCREEN_LEFT = BOUNDS.SCREEN_LEFT || -12.0;
  const SCREEN_RIGHT = BOUNDS.SCREEN_RIGHT || 10.0;
  const SCREEN_BOTTOM = BOUNDS.SCREEN_BOTTOM || 15.0;

  /**
   * Computes net acceleration vector accounting for downward gravity and velocity-squared aerodynamic drag.
   *
   * @param {number} vx - Horizontal velocity (px/s)
   * @param {number} vy - Vertical velocity (px/s)
   * @returns {{ ax: number, ay: number }}
   */
  function computeAcceleration(vx, vy) {
    const speed = Math.hypot(vx, vy);
    const ax = -AIR_DRAG_CD * speed * vx;
    const ay = GRAVITY_Y - AIR_DRAG_CD * speed * vy;
    return { ax: ax, ay: ay };
  }

  /**
   * Executes a Velocity Verlet numerical integration step.
   *
   * @param {Object} ball - { x, y, vx, vy }
   * @param {number} dt - Time delta (seconds)
   * @returns {{ nextX: number, nextY: number, nextVx: number, nextVy: number }} Candidate state
   */
  function stepVerlet(ball, dt) {
    const aCurrent = computeAcceleration(ball.vx, ball.vy);

    const nextX = ball.x + ball.vx * dt + 0.5 * aCurrent.ax * dt * dt;
    const nextY = ball.y + ball.vy * dt + 0.5 * aCurrent.ay * dt * dt;

    const estVx = ball.vx + aCurrent.ax * dt;
    const estVy = ball.vy + aCurrent.ay * dt;
    const aNext = computeAcceleration(estVx, estVy);

    const nextVx = ball.vx + 0.5 * (aCurrent.ax + aNext.ax) * dt;
    const nextVy = ball.vy + 0.5 * (aCurrent.ay + aNext.ay) * dt;

    return {
      nextX: nextX,
      nextY: nextY,
      nextVx: nextVx,
      nextVy: nextVy
    };
  }

  /**
   * Tests whether candidate position has passed out of the tight screen camera bounds.
   *
   * @param {number} screenX - Ball screen X coordinate (nextX - cameraX)
   * @param {number} nextY - Ball world Y coordinate
   * @param {number} simWidth - Simulation viewport width
   * @param {number} simHeight - Simulation viewport height
   * @returns {boolean} True if out-of-bounds
   */
  function isOutOfBounds(screenX, nextY, simWidth, simHeight) {
    return (screenX < SCREEN_LEFT || nextY > simHeight + SCREEN_BOTTOM || screenX > simWidth + SCREEN_RIGHT);
  }

  /**
   * Tests if the ball has penetrated the bottom capture zone of the cup.
   *
   * @param {number} nextX - Candidate world X
   * @param {number} nextY - Candidate world Y
   * @param {Object} holeInfo - Active hole info { cupX, cupY }
   * @param {Object} world - World instance { cupWidth, cupDepth }
   * @returns {boolean} True if captured at bottom of cup
   */
  function checkCupEntry(nextX, nextY, holeInfo, world) {
    const cupLeftX = holeInfo.cupX - world.cupWidth * 0.5;
    const cupRightX = holeInfo.cupX + world.cupWidth * 0.5;
    const cupBottomY = holeInfo.cupY + world.cupDepth;

    const isInsideHorizontal = (nextX > cupLeftX + BALL_RADIUS * 0.5) && (nextX < cupRightX - BALL_RADIUS * 0.5);
    const isAtBottom = (nextY + BALL_RADIUS >= cupBottomY - 1.2);
    return isInsideHorizontal && isAtBottom;
  }

  /**
   * Resolves elastic reflection against vertical inner cup sidewalls.
   *
   * @param {Object} candidate - { nextX, nextY, nextVx, nextVy }
   * @param {Object} holeInfo - Active hole info
   * @param {Object} world - World instance
   */
  function resolveCupWallBounce(candidate, holeInfo, world) {
    const cupLeftX = holeInfo.cupX - world.cupWidth * 0.5;
    const cupRightX = holeInfo.cupX + world.cupWidth * 0.5;
    const cupRimY = holeInfo.cupY;

    if (candidate.nextX >= cupLeftX && candidate.nextX <= cupRightX && candidate.nextY + BALL_RADIUS >= cupRimY) {
      if (candidate.nextX - BALL_RADIUS <= cupLeftX) {
        candidate.nextX = cupLeftX + BALL_RADIUS;
        candidate.nextVx = Math.abs(candidate.nextVx) * BOUNCE_WALL_FACTOR;
      } else if (candidate.nextX + BALL_RADIUS >= cupRightX) {
        candidate.nextX = cupRightX - BALL_RADIUS;
        candidate.nextVx = -Math.abs(candidate.nextVx) * BOUNCE_WALL_FACTOR;
      }
    }
  }

  /**
   * Resolves 2D ground surface collision, restitution rebound, and Coulomb rolling friction.
   *
   * @param {Object} candidate - { nextX, nextY, nextVx, nextVy }
   * @param {Object} holeInfo - Active hole metadata
   * @param {number} currentHole - Active hole index
   * @param {Object} world - Terrain world instance
   * @param {number} simWidth - Simulation width
   * @param {number} dt - Time delta (seconds)
   * @param {boolean} isMuted - Sound mute flag
   * @param {Object} soundEngine - Audio synthesis module
   */
  function resolveGroundCollision(candidate, holeInfo, currentHole, world, simWidth, dt, isMuted, soundEngine) {
    const groundY = world.getPhysicalElevation(candidate.nextX, currentHole, simWidth);
    const penetration = (candidate.nextY + BALL_RADIUS) - groundY;

    if (penetration < 0) {
      return; // Ball is in free flight above surface
    }

    // Clamp candidate position to ground contact
    candidate.nextY = groundY - BALL_RADIUS;
    const norm = world.getSurfaceNormal(candidate.nextX, currentHole, simWidth);

    // 1. Velocity Decomposition: v_n = (v . n)n, v_t = v - v_n
    const vnMag = candidate.nextVx * norm.nx + candidate.nextVy * norm.ny;
    let vtMag = candidate.nextVx * norm.tx + candidate.nextVy * norm.ty;

    const cosTheta = -norm.ny;
    const sinTheta = Math.abs(norm.ty);
    const tanTheta = Math.abs(norm.slope);

    const cupLeftX = holeInfo.cupX - world.cupWidth * 0.5;
    const cupRightX = holeInfo.cupX + world.cupWidth * 0.5;
    const isAboveCup = candidate.nextX >= cupLeftX && candidate.nextX <= cupRightX;

    // 2. Inelastic Normal Rebound
    if (vnMag < -BOUNCE_MIN_SPEED) {
      const newVnMag = -RESTITUTION_E * vnMag;

      if (Math.abs(vnMag) > BOUNCE_SOUND_MIN_SPEED && !isAboveCup && soundEngine) {
        soundEngine.playBounce(isMuted, Math.abs(vnMag));
      }

      candidate.nextVx = newVnMag * norm.nx + vtMag * norm.tx;
      candidate.nextVy = newVnMag * norm.ny + vtMag * norm.ty;
      candidate.nextY = groundY - BALL_RADIUS - 0.25;
    } else {
      // Deadens immediately into continuous surface contact
      if (vnMag < 0) {
        vtMag *= LANDING_ABSORPTION_FACTOR; // Gentle landing absorption
        if (Math.abs(vnMag) > BOUNCE_SOUND_MIN_SPEED && !isAboveCup && soundEngine) {
          soundEngine.playBounce(isMuted, Math.abs(vnMag));
        }
      }

      // 3. Arcade Rolling Friction & Controlled Slope Dynamics
      const slopeGravity = GRAVITY_Y * SLOPE_GRAVITY_FACTOR * norm.ty;

      // Base deceleration: linear drag + rolling resistance
      let decelRate = LINEAR_ROLLING_DRAG * Math.abs(vtMag) + ROLLING_FRICTION_BASE * cosTheta;

      // Anti-creep progressive static bite:
      // When rolling downhill on stable dunes (tanTheta <= MU_S), downhill gravity fights
      // rolling friction, causing a slow everlasting crawl at terminal velocity.
      // We guarantee that as speed drops below 55 px/s, rolling resistance smoothly ramps up
      // to strictly exceed downhill gravity by at least 50 px/s^2, ensuring a prompt, natural stop.
      const isMovingDownhill = (vtMag * norm.ty > 0);
      if (tanTheta <= MU_S && isMovingDownhill) {
        const downhillPull = Math.abs(slopeGravity);
        if (Math.abs(vtMag) < ANTI_CREEP_SPEED_THRESHOLD) {
          const biteFactor = 1.0 - (Math.abs(vtMag) / ANTI_CREEP_SPEED_THRESHOLD);
          const minNeededDecel = downhillPull + ANTI_CREEP_MIN_DECEL_BOOST;
          if (decelRate < minNeededDecel) {
            decelRate += (minNeededDecel - decelRate) * biteFactor;
          }
        }
      }

      const rollingDecel = decelRate * dt;

      if (Math.abs(vtMag) > V_THRESHOLD) {
        // Tangential motion along slope
        const netVt = vtMag + slopeGravity * dt;
        if (Math.abs(netVt) <= rollingDecel) {
          vtMag = 0;
        } else {
          vtMag = netVt - Math.sign(netVt) * rollingDecel;
        }
      } else {
        // Below zero-velocity threshold
        if (tanTheta <= MU_S) {
          // Sticking condition: slope <= angle of repose -> lock position
          vtMag = 0;
        } else {
          // Sliding condition: slope > angle of repose -> accelerate down steep dune crest
          const downhillDir = Math.sign(norm.ty) || 1;
          const aSlope = GRAVITY_Y * SLOPE_GRAVITY_FACTOR * (sinTheta - 0.20 * cosTheta);
          vtMag += downhillDir * Math.max(0, aSlope) * dt;
        }
      }

      candidate.nextVx = vtMag * norm.tx;
      candidate.nextVy = vtMag * norm.ty;
    }
  }

  /**
   * Tests whether the ball meets the criteria to settle and enter the resting IDLE state.
   *
   * @param {Object} ball - Ball state
   * @param {number} currentHole - Active hole index
   * @param {Object} world - World instance
   * @param {number} simWidth - Simulation width
   * @returns {boolean} True if candidate satisfies static equilibrium
   */
  function isRestingCandidate(ball, currentHole, world, simWidth) {
    const currentSpeed = Math.hypot(ball.vx, ball.vy);
    const groundY = world.getPhysicalElevation(ball.x, currentHole, simWidth);
    const distToSurface = Math.abs((ball.y + BALL_RADIUS) - groundY);
    const norm = world.getSurfaceNormal(ball.x, currentHole, simWidth);
    const tanTheta = Math.abs(norm.slope);

    return (currentSpeed < V_THRESHOLD && distToSurface <= REST_MAX_SURFACE_DIST && tanTheta <= MU_S);
  }

  return {
    BALL_RADIUS: BALL_RADIUS,
    BALL_MASS: BALL_MASS,
    REST_CONSECUTIVE_TICKS: REST_CONSECUTIVE_TICKS,
    computeAcceleration: computeAcceleration,
    stepVerlet: stepVerlet,
    isOutOfBounds: isOutOfBounds,
    checkCupEntry: checkCupEntry,
    resolveCupWallBounce: resolveCupWallBounce,
    resolveGroundCollision: resolveGroundCollision,
    isRestingCandidate: isRestingCandidate
  };
});
