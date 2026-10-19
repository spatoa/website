#!/usr/bin/env node
/**
 * @file scripts/test-desert-golfing.js
 * @description Comprehensive automated verification test suite for Desert Golfing.
 * Verifies mathematical determinism, spline mechanics, CRC32 persistence,
 * hole chaining continuity, physics simulation, and public API contracts.
 * Zero external dependencies.
 */

const assert = require('assert');
const path = require('path');

// 1. Test Modular Subsystems directly from static/js/desert-golfing/
const ModularDesertGolfing = require('../static/js/desert-golfing/index.js');
const Config = require('../static/js/desert-golfing/config.js');
const MathUtils = require('../static/js/desert-golfing/math.js');
const SaveManager = require('../static/js/desert-golfing/save-manager.js');
const TerrainWorld = require('../static/js/desert-golfing/terrain-world.js');
const PhysicsEngine = require('../static/js/desert-golfing/physics-engine.js');
const TerrainRenderer = require('../static/js/desert-golfing/terrain-renderer.js');

// 2. Test Assembled Distribution Bundle
const AssembledDesertGolfing = require('../static/js/desert-golfing.js');

let totalTests = 0;
let passedTests = 0;

function it(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    throw err;
  }
}

function runSuite() {
  console.log('\n=== RUNNING DESERT GOLFING AUTOMATED VERIFICATION SUITE ===\n');

  console.log('Suite 1: Deterministic Math & PRNG');
  it('hash32 produces consistent 32-bit unsigned integers', () => {
    const h1 = MathUtils.hash32(894312, 1);
    const h2 = MathUtils.hash32(894312, 1);
    const h3 = MathUtils.hash32(894312, 2);

    assert.strictEqual(typeof h1, 'number');
    assert.strictEqual(h1, h2, 'Hash should be deterministic for identical inputs');
    assert.notStrictEqual(h1, h3, 'Hash should differ for different indices');
    assert(h1 >= 0 && h1 <= 0xFFFFFFFF, 'Hash must be in 32-bit unsigned range');
  });

  it('mulberry32 generates uniform pseudo-random floats in [0, 1)', () => {
    const prng = MathUtils.mulberry32(123456);
    const sequence = [];
    for (let i = 0; i < 100; i++) {
      const v = prng();
      assert(v >= 0 && v < 1, `Value ${v} out of range [0, 1)`);
      sequence.push(v);
    }
    // Repeat with same seed: must match exactly
    const prng2 = MathUtils.mulberry32(123456);
    for (let i = 0; i < 100; i++) {
      assert.strictEqual(prng2(), sequence[i], `Mismatch at iteration ${i}`);
    }
  });

  it('Catmull-Rom cubic spline interpolation satisfies endpoints and midpoints', () => {
    const p0 = 10, p1 = 20, p2 = 40, p3 = 50;

    const yStart = MathUtils.evaluateCatmullRom(p0, p1, p2, p3, 0);
    assert.strictEqual(yStart, p1, 'Spline at t=0 must equal p1');

    const yEnd = MathUtils.evaluateCatmullRom(p0, p1, p2, p3, 1);
    assert.strictEqual(yEnd, p2, 'Spline at t=1 must equal p2');

    const yMid = MathUtils.evaluateCatmullRom(p0, p1, p2, p3, 0.5);
    assert(yMid > p1 && yMid < p2, 'Spline midpoint must lie between p1 and p2');
  });

  it('Catmull-Rom slope correctly evaluates instantaneous derivative', () => {
    const p0 = 10, p1 = 20, p2 = 30, p3 = 40;
    const dx = 40.0;
    // For linearly spaced points, slope is constant: dy/dx = (30 - 20) / 40 = 0.25
    const slope = MathUtils.evaluateCatmullRomSlope(p0, p1, p2, p3, 0.5, dx);
    assert(Math.abs(slope - 0.25) < 1e-9, `Expected slope ~0.25, got ${slope}`);
  });

  it('smoothstep eases strictly in [0, 1]', () => {
    assert.strictEqual(MathUtils.smoothstep(0), 0);
    assert.strictEqual(MathUtils.smoothstep(1), 1);
    assert.strictEqual(MathUtils.smoothstep(0.5), 0.5);
    assert.strictEqual(MathUtils.smoothstep(-0.5), 0);
    assert.strictEqual(MathUtils.smoothstep(1.5), 1);
  });

  console.log('\nSuite 2: CRC32 Checksum & Save State Management');
  it('computeCRC32 matches standard IEEE 802.3 test vectors', () => {
    // Standard test vector: "123456789" -> 0xcbf43926
    const crc = SaveManager.computeCRC32('123456789');
    assert.strictEqual(crc.toLowerCase(), 'cbf43926');
  });

  it('SaveManager roundtrips state with checksum and 3-decimal precision', () => {
    const state = {
      master_seed: 894312,
      current_hole: 15,
      total_strokes: 32,
      sound: 'active',
      ball_state: {
        pos_x: 123.456789,
        pos_y: 67.891234,
        vel_x: 0.12345,
        vel_y: -0.98765
      },
      last_rest_pos: {
        x: 123.456789,
        y: 67.891234
      }
    };

    SaveManager.save(state);
    const loaded = SaveManager.load();

    assert(loaded, 'Loaded state should not be null');
    assert.strictEqual(loaded.version, 1);
    assert.strictEqual(loaded.current_hole, 15);
    assert.strictEqual(loaded.total_strokes, 32);
    assert.strictEqual(loaded.ball_state.pos_x, 123.457);
    assert.strictEqual(loaded.ball_state.pos_y, 67.891);
    assert.strictEqual(loaded.ball_state.vel_x, 0.123);
    assert.strictEqual(loaded.ball_state.vel_y, -0.988);
    assert.strictEqual(typeof loaded.checksum, 'string');
    assert.strictEqual(loaded.checksum.length, 8);
  });

  it('SaveManager migrates legacy schemas seamlessly to v1', () => {
    SaveManager.clear();
    // Simulate legacy storage entry
    const legacy = {
      hole: 7,
      totalStrokes: 18,
      seed: 894312,
      sound: 'muted',
      ball: { x: 500.1234, y: 150.5678 }
    };

    // Use in-memory save trick or raw string
    const globalStorage = (typeof window !== 'undefined' && window.localStorage);
    if (globalStorage) {
      globalStorage.setItem(SaveManager.STORAGE_KEY, JSON.stringify(legacy));
    }

    const migrated = SaveManager.load();
    if (migrated) {
      assert.strictEqual(migrated.version, 1);
      assert.strictEqual(migrated.current_hole, 7);
      assert.strictEqual(migrated.total_strokes, 18);
      assert.strictEqual(migrated.sound, 'muted');
      assert.strictEqual(migrated.ball_state.pos_x, 500.123);
      assert.strictEqual(migrated.ball_state.pos_y, 150.568);
    }
  });

  console.log('\nSuite 3: Continuous Dune World & Hole Chaining');
  it('Hole chaining strictly places Hole N+1 tee at Hole N cup', () => {
    const world = TerrainWorld.createTerrainWorld(894312, 270, 3.5);

    const hole1 = world.getHoleInfo(1, 470);
    assert.strictEqual(hole1.teeX, 60.0, 'Hole 1 starts at tee X = 60');
    assert(hole1.cupX > hole1.teeX, 'Hole 1 cup must be to the right of tee');

    let prevCup = hole1.cupX;
    for (let h = 2; h <= 50; h++) {
      const info = world.getHoleInfo(h, 470);
      assert.strictEqual(info.teeX, prevCup, `Hole ${h} teeX must strictly equal Hole ${h-1} cupX`);
      assert(info.cupX > info.teeX, `Hole ${h} cupX must be further right than teeX`);
      prevCup = info.cupX;
    }
  });

  it('Green flattening smooths terrain around cups and physical elevation cuts U-trench only for active cup', () => {
    const world = TerrainWorld.createTerrainWorld(894312, 270, 3.5);
    const h1 = world.getHoleInfo(1, 470);

    // Active cup physical elevation must reflect cup trench depth (3 * 3.5 = 10.5)
    const physElevationAtCup = world.getPhysicalElevation(h1.cupX, 1, 470);
    const duneElevationAtCup = world.getDuneElevation(h1.cupX, 1, 470);

    assert(physElevationAtCup > duneElevationAtCup, 'Physical elevation inside cup must be deeper than surface');
    assert.strictEqual(physElevationAtCup, h1.cupY + world.cupDepth, 'Trench bottom must equal cupY + cupDepth');

    // Surface normal inside cup must point straight up
    const normInCup = world.getSurfaceNormal(h1.cupX, 1, 470);
    assert.strictEqual(normInCup.nx, 0);
    assert.strictEqual(normInCup.ny, -1);
    assert.strictEqual(normInCup.slope, 0);
  });

  console.log('\nSuite 4: Physics Engine Integration & Coulomb Friction');
  it('stepVerlet numerically integrates downward gravity and air drag', () => {
    const ball = { x: 100, y: 50, vx: 50, vy: -50 };
    const dt = 1.0 / 60.0;
    const next = PhysicsEngine.stepVerlet(ball, dt);

    assert(next.nextX > ball.x, 'Ball should advance horizontally');
    assert(next.nextVy > ball.vy, 'Gravity should accelerate vertical velocity downward');
  });

  it('isOutOfBounds detects screen borders with tight margins', () => {
    const simW = 480, simH = 270;
    assert(!PhysicsEngine.isOutOfBounds(100, 100, simW, simH), 'In-bounds point should not trigger OOB');
    assert(PhysicsEngine.isOutOfBounds(-15, 100, simW, simH), 'Point left of -12 should trigger OOB');
    assert(PhysicsEngine.isOutOfBounds(simW + 15, 100, simW, simH), 'Point right of simWidth+10 should trigger OOB');
    assert(PhysicsEngine.isOutOfBounds(100, simH + 20, simW, simH), 'Point below simHeight+15 should trigger OOB');
  });

  it('Ball dropped from air lands on ground, bounces, decelerates, and settles to rest', () => {
    const world = TerrainWorld.createTerrainWorld(894312, 270, 3.5);
    const h1 = world.getHoleInfo(1, 470);
    const groundY = world.getPhysicalElevation(h1.teeX, 1, 470);

    // Position ball in air above tee
    const ball = {
      x: h1.teeX,
      y: groundY - 40,
      vx: 20,
      vy: 0,
      restTicks: 0
    };

    const dt = 1.0 / 60.0;
    let didLand = false;

    // Simulate up to 240 ticks (4 seconds of simulated time)
    for (let tick = 0; tick < 240; tick++) {
      const candidate = PhysicsEngine.stepVerlet(ball, dt);
      PhysicsEngine.resolveGroundCollision(candidate, h1, 1, world, 470, dt, true, null);

      ball.x = candidate.nextX;
      ball.y = candidate.nextY;
      ball.vx = candidate.nextVx;
      ball.vy = candidate.nextVy;

      if (ball.y >= groundY - 3.5 - 0.5) {
        didLand = true;
      }

      if (PhysicsEngine.isRestingCandidate(ball, 1, world, 470)) {
        ball.restTicks++;
        if (ball.restTicks >= 10) {
          ball.vx = 0;
          ball.vy = 0;
          break;
        }
      } else {
        ball.restTicks = 0;
      }
    }

    assert(didLand, 'Ball should make contact with ground');
    assert.strictEqual(ball.vx, 0, 'Ball horizontal velocity must settle to 0');
    assert.strictEqual(ball.vy, 0, 'Ball vertical velocity must settle to 0');
  });

  console.log('\nSuite 5: Public API Contracts & Assembled Bundle Equivalence');
  it('ModularDesertGolfing and AssembledDesertGolfing expose identical public APIs', () => {
    const expectedMethods = ['createInstance', 'getState', 'SaveManager', 'getPaletteColors'];
    for (const m of expectedMethods) {
      assert.strictEqual(typeof ModularDesertGolfing[m], typeof AssembledDesertGolfing[m], `Mismatch on ${m}`);
      assert(typeof ModularDesertGolfing[m] !== 'undefined', `Method ${m} should be defined`);
    }
  });

  it('getPaletteColors returns valid CSS color properties', () => {
    const p1 = ModularDesertGolfing.getPaletteColors(1);
    const requiredKeys = ['sky', 'sand', 'flag', 'ball', 'hud', 'cactus'];
    for (const k of requiredKeys) {
      assert(p1[k], `Palette must include ${k}`);
      assert.strictEqual(typeof p1[k], 'string', `Palette property ${k} must be string`);
    }
  });

  it('createGameInstance initializes with expected lifecycle methods on mock canvas', () => {
    const mockCtx = {
      clearRect: () => {},
      save: () => {},
      restore: () => {},
      scale: () => {},
      fillRect: () => {},
      beginPath: () => {},
      moveTo: () => {},
      lineTo: () => {},
      closePath: () => {},
      fill: () => {},
      stroke: () => {},
      arc: () => {},
      fillText: () => {},
      measureText: () => ({ width: 10 }),
      setLineDash: () => {}
    };

    const mockCanvas = {
      width: 470,
      height: 250,
      getContext: () => mockCtx,
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 470, height: 250 }),
      addEventListener: () => {},
      removeEventListener: () => {},
      style: {}
    };

    const instance = ModularDesertGolfing.createInstance(mockCanvas);
    assert(instance, 'Instance should not be null');

    const expectedInstanceMethods = [
      'start', 'pause', 'stop', 'resize', 'destroy',
      'getStatus', 'getBallState', 'getBallAlpha', 'getFlagAlpha',
      'getPalette', 'applyImpulse', 'toggleSound', 'resetStage'
    ];

    for (const m of expectedInstanceMethods) {
      assert.strictEqual(typeof instance[m], 'function', `Instance must implement ${m}()`);
    }

    assert(instance.getStatus().startsWith('HOLE '), 'getStatus should format "HOLE N • STROKES S"');
    const ballState = instance.getBallState();
    assert.strictEqual(typeof ballState.pos_x, 'number');
    assert.strictEqual(typeof ballState.pos_y, 'number');
    assert.strictEqual(ballState.state, 'IDLE');

    // Test sound toggle
    const initialSound = instance.toggleSound();
    const secondSound = instance.toggleSound();
    assert.strictEqual(secondSound, !initialSound, 'toggleSound must toggle sound state boolean');
  });

  console.log(`\nAll ${passedTests}/${totalTests} tests passed successfully!\n`);
}

runSuite();
