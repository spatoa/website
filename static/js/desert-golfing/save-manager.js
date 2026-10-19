/**
 * @module DesertGolfing/SaveManager
 * @description Robust persistence subsystem with IEEE 802.3 CRC32 checksum integrity verification.
 * Dedicated to the Desert Golfing engine in Lachlan's World.
 */

(function (root, factory) {
  'use strict';
  const Config = (root && root.DesertGolfingConfig) ||
    ((typeof require === 'function') ? require('./config.js') : {});
  const res = factory(Config);
  if (root) root.DesertGolfingSaveManager = res;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = res;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (CONFIG) {
  'use strict';

  const STORAGE_KEY = (CONFIG && CONFIG.STORAGE && CONFIG.STORAGE.KEY) || 'lachlan_desert_golfing_v1';
  const DEFAULT_MASTER_SEED = (CONFIG && CONFIG.STORAGE && CONFIG.STORAGE.DEFAULT_MASTER_SEED) || 894312;

  /**
   * Precomputed 256-entry lookup table for polynomial 0xEDB88320 (IEEE 802.3 standard).
   */
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

  /**
   * Computes an 8-character hexadecimal CRC32 checksum for an ASCII/UTF-8 string.
   *
   * @param {string} asciiStr - Serialized JSON string to checksum
   * @returns {string} 8-character lowercase hexadecimal checksum
   */
  function computeCRC32(asciiStr) {
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < asciiStr.length; i++) {
      const code = asciiStr.charCodeAt(i);
      crc = (crc >>> 8) ^ CRC32_TABLE[(crc ^ code) & 0xFF];
    }
    return ((crc ^ 0xFFFFFFFF) >>> 0).toString(16).padStart(8, '0');
  }

  /**
   * In-memory state cache used as fallback if localStorage is disabled or throws quota errors.
   */
  let inMemoryState = null;

  /**
   * Safe getter for localStorage.
   *
   * @returns {Storage|null} LocalStorage reference or null if restricted
   */
  function getLocalStorage() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage;
      }
    } catch (e) {
      // Storage access blocked by security policy or private browsing
    }
    return null;
  }

  /**
   * Rounds a numerical floating coordinate or velocity to 3 decimal places.
   * Prevents micro-float drift across JSON serialization cycles.
   *
   * @param {number} val - Numerical value
   * @returns {number} Value rounded to 1/1000th precision
   */
  function round3(val) {
    return Math.round((Number(val) || 0) * 1000) / 1000;
  }

  const SaveManager = {
    STORAGE_KEY: STORAGE_KEY,
    computeCRC32: computeCRC32,

    /**
     * Loads and validates persistent game state.
     * Automatically handles checksum verification and legacy migration.
     *
     * @returns {Object|null} Validated game state or null if clean start
     */
    load: function () {
      try {
        const storage = getLocalStorage();
        let raw = null;
        if (storage) {
          raw = storage.getItem(STORAGE_KEY);
        }
        if (!raw && inMemoryState) {
          raw = JSON.stringify(inMemoryState);
        }
        if (!raw) return null;

        const parsed = JSON.parse(raw);

        // Version 1 Schema with Checksum Validation
        if (parsed && parsed.version === 1 && typeof parsed.checksum === 'string') {
          const expectedChecksum = parsed.checksum;
          const copy = Object.assign({}, parsed);
          delete copy.checksum;
          const actualChecksum = computeCRC32(JSON.stringify(copy));

          if (expectedChecksum.toLowerCase() === actualChecksum.toLowerCase()) {
            inMemoryState = parsed;
            return parsed;
          }
          console.warn('[DesertGolfing] Checksum mismatch in saved state. Restoring integrity.');
        }

        // Legacy format migration
        if (parsed && typeof parsed.hole === 'number') {
          const ballX = (parsed.ball && typeof parsed.ball.x === 'number') ? parsed.ball.x : 60;
          const ballY = (parsed.ball && typeof parsed.ball.y === 'number') ? parsed.ball.y : 140;

          const migrated = {
            version: 1,
            master_seed: parsed.seed || DEFAULT_MASTER_SEED,
            current_hole: Math.max(1, parsed.hole),
            total_strokes: Math.max(0, parsed.totalStrokes || 0),
            sound: parsed.sound || 'active',
            ball_state: {
              pos_x: round3(ballX),
              pos_y: round3(ballY),
              vel_x: 0,
              vel_y: 0
            },
            last_rest_pos: {
              x: round3(ballX),
              y: round3(ballY)
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

    /**
     * Persists game state to localStorage with IEEE 802.3 CRC32 checksum.
     *
     * @param {Object} data - Game state payload
     * @returns {boolean} True if successfully stored
     */
    save: function (data) {
      if (!data) return false;
      try {
        const ballState = data.ball_state || {};
        const lastRest = data.last_rest_pos || {};

        const payload = {
          version: 1,
          master_seed: data.master_seed || DEFAULT_MASTER_SEED,
          current_hole: data.current_hole || 1,
          total_strokes: data.total_strokes || 0,
          sound: data.sound || 'active',
          ball_state: {
            pos_x: round3(ballState.pos_x),
            pos_y: round3(ballState.pos_y),
            vel_x: round3(ballState.vel_x),
            vel_y: round3(ballState.vel_y)
          },
          last_rest_pos: {
            x: round3(lastRest.x !== undefined ? lastRest.x : ballState.pos_x),
            y: round3(lastRest.y !== undefined ? lastRest.y : ballState.pos_y)
          }
        };

        payload.checksum = computeCRC32(JSON.stringify(payload));
        inMemoryState = payload;

        const storage = getLocalStorage();
        if (storage) {
          storage.setItem(STORAGE_KEY, JSON.stringify(payload));
        }
        return true;
      } catch (err) {
        console.warn('[DesertGolfing] Error saving state:', err);
        return false;
      }
    },

    /**
     * Resets persistent storage (clears saved state).
     */
    clear: function () {
      inMemoryState = null;
      try {
        const storage = getLocalStorage();
        if (storage) {
          storage.removeItem(STORAGE_KEY);
        }
      } catch (err) {
        console.warn('[DesertGolfing] Error clearing state:', err);
      }
    }
  };

  return SaveManager;
});
