/**
 * @module DesertGolfing/SoundEngine
 * @description Diegetic Web Audio API audio synthesis subsystem.
 * Dedicated to the Desert Golfing engine in Lachlan's World.
 */

(function (root, factory) {
  'use strict';
  const res = factory();
  if (root) root.DesertGolfingSoundEngine = res;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = res;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  let sharedAudioCtx = null;

  /**
   * Safe getter for shared Web Audio API context.
   * Resumes audio context if suspended by browser autoplay policy.
   *
   * @returns {AudioContext|null} AudioContext instance or null if unavailable
   */
  function getAudioContext() {
    try {
      if (!sharedAudioCtx && typeof window !== 'undefined') {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) {
          sharedAudioCtx = new AudioCtx();
        }
      }
      if (sharedAudioCtx && sharedAudioCtx.state === 'suspended') {
        sharedAudioCtx.resume().catch(function () {});
      }
    } catch (e) {
      // Web Audio API blocked or unsupported
    }
    return sharedAudioCtx;
  }

  const SoundEngine = {
    getAudioContext: getAudioContext,

    /**
     * Synthesizes the tactile "thwack" of the club striking the ball.
     * Uses a pitch-sweeping triangle oscillator.
     *
     * @param {boolean} isMuted - Audio mute toggle
     * @param {number} [impulseRatio=0.5] - Normalized stroke power in [0.1, 1.0]
     */
    playHit: function (isMuted, impulseRatio) {
      if (isMuted) return;
      const ctx = getAudioContext();
      if (!ctx) return;

      try {
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
      } catch (err) {
        // Safe degrade if oscillator creation fails
      }
    },

    /**
     * Synthesizes the dull sand impact thud when the ball bounces against dunes.
     *
     * @param {boolean} isMuted - Audio mute toggle
     * @param {number} vnMag - Normal velocity magnitude (px/s)
     */
    playBounce: function (isMuted, vnMag) {
      if (isMuted) return;
      const ctx = getAudioContext();
      if (!ctx) return;

      try {
        const now = ctx.currentTime;
        const gainRatio = Math.max(0.08, Math.min(1.0, (vnMag || 0) / 450.0));

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
      } catch (err) {
        // Safe degrade
      }
    },

    /**
     * Synthesizes the hollow cup capture sound: a low hollow drop followed by a subtle metallic ring.
     *
     * @param {boolean} isMuted - Audio mute toggle
     */
    playCup: function (isMuted) {
      if (isMuted) return;
      const ctx = getAudioContext();
      if (!ctx) return;

      try {
        const now = ctx.currentTime;

        // 1. Dry diegetic hollow drop
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

        // 2. Subtle metallic cup ring
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
      } catch (err) {
        // Safe degrade
      }
    }
  };

  return SoundEngine;
});
