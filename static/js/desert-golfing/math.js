/**
 * @module DesertGolfing/MathUtils
 * @description Pure mathematical utilities, deterministic 32-bit PRNGs, and spline interpolation.
 * Dedicated to the Desert Golfing engine in Lachlan's World.
 */

(function (root, factory) {
  'use strict';
  const res = factory();
  if (root) root.DesertGolfingMath = res;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = res;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  /**
   * 32-bit integer hash function for procedural index-based seed generation.
   * Produces uniformly distributed pseudo-random 32-bit unsigned integers from a master seed and index.
   *
   * @param {number} masterSeed - Base integer seed for the run
   * @param {number} index - Stage or control point index
   * @returns {number} 32-bit unsigned integer hash
   */
  function hash32(masterSeed, index) {
    let x = (masterSeed ^ index) >>> 0;
    x = (x ^ (x >>> 16)) >>> 0;
    x = Math.imul(x, 0x45D9F3B);
    x = (x ^ (x >>> 16)) >>> 0;
    x = Math.imul(x, 0x45D9F3B);
    x = (x ^ (x >>> 16)) >>> 0;
    return x >>> 0;
  }

  /**
   * Mulberry32 32-bit Pseudo-Random Number Generator.
   * Produces high-quality deterministic pseudo-random floats in [0, 1).
   *
   * @param {number} seed - 32-bit seed integer
   * @returns {function(): number} Function returning a float in [0, 1)
   */
  function mulberry32(seed) {
    return function () {
      seed |= 0;
      seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /**
   * Evaluates standard uniform Catmull-Rom cubic spline interpolation between control points.
   * Given points p0, p1, p2, p3 and parameter t in [0, 1], returns the interpolated value between p1 and p2.
   *
   * Formula:
   * 0.5 * ( (2*p1) + (-p0 + p2)*t + (2*p0 - 5*p1 + 4*p2 - p3)*t^2 + (-p0 + 3*p1 - 3*p2 + p3)*t^3 )
   *
   * @param {number} p0 - Control point Y at index - 1
   * @param {number} p1 - Control point Y at index 0 (start)
   * @param {number} p2 - Control point Y at index + 1 (end)
   * @param {number} p3 - Control point Y at index + 2
   * @param {number} t - Interpolation parameter in [0, 1]
   * @returns {number} Interpolated Y value
   */
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

  /**
   * Evaluates the first derivative (slope dy/dx) of a Catmull-Rom spline segment.
   *
   * Derivative formula:
   * dy/dt = 0.5 * ( (-p0 + p2) + 2*(2*p0 - 5*p1 + 4*p2 - p3)*t + 3*(-p0 + 3*p1 - 3*p2 + p3)*t^2 )
   * dy/dx = (dy/dt) / dx
   *
   * @param {number} p0 - Control point Y at index - 1
   * @param {number} p1 - Control point Y at index 0
   * @param {number} p2 - Control point Y at index + 1
   * @param {number} p3 - Control point Y at index + 2
   * @param {number} t - Interpolation parameter in [0, 1]
   * @param {number} dx - Control point horizontal spacing
   * @returns {number} Instantaneous slope dy/dx
   */
  function evaluateCatmullRomSlope(p0, p1, p2, p3, t, dx) {
    const t2 = t * t;
    const dy_dt = 0.5 * (
      (-p0 + p2) +
      2 * (2 * p0 - 5 * p1 + 4 * p2 - p3) * t +
      3 * (-p0 + 3 * p1 - 3 * p2 + p3) * t2
    );
    return dy_dt / dx;
  }

  /**
   * Smoothstep S-curve interpolation in [0, 1].
   * Clamps tau to [0, 1] and computes 3*t^2 - 2*t^3.
   *
   * @param {number} tau - Progress value
   * @returns {number} Eased progress in [0, 1]
   */
  function smoothstep(tau) {
    const clamped = Math.max(0, Math.min(1, tau));
    return 3 * clamped * clamped - 2 * clamped * clamped * clamped;
  }

  /**
   * Linearly interpolates two RGB color triples and returns a CSS rgb(...) string.
   *
   * @param {number[]} c1 - Starting [R, G, B] array
   * @param {number[]} c2 - Ending [R, G, B] array
   * @param {number} t - Interpolation progress in [0, 1]
   * @returns {string} CSS rgb string
   */
  function interpolateColor(c1, c2, t) {
    const r = Math.round(c1[0] + (c2[0] - c1[0]) * t);
    const g = Math.round(c1[1] + (c2[1] - c1[1]) * t);
    const b = Math.round(c1[2] + (c2[2] - c1[2]) * t);
    return `rgb(${r}, ${g}, ${b})`;
  }

  /**
   * Numerical clamping helper.
   *
   * @param {number} val - Value to clamp
   * @param {number} min - Minimum allowed
   * @param {number} max - Maximum allowed
   * @returns {number} Clamped value
   */
  function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
  }

  return Object.freeze({
    hash32: hash32,
    mulberry32: mulberry32,
    evaluateCatmullRom: evaluateCatmullRom,
    evaluateCatmullRomSlope: evaluateCatmullRomSlope,
    smoothstep: smoothstep,
    interpolateColor: interpolateColor,
    clamp: clamp
  });
});
