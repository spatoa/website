/**
 * pocket_pet.js - Complete 1997 Gen-1 Pocket_Pet Virtual Pet Simulation
 * Dedicated to Lachlan's World (Web 2.0 & Desktop OS)
 *
 * Features:
 * - Authentic 32x19 virtual LCD dot-matrix canvas renderer (scaled crisp)
 * - Complete Gen-1 character roster: Egg -> Babytchi -> Marutchi -> Teenagers -> Adults -> Ghost/Angel
 * - Hardcore real-time clock persistence via localStorage with offline decay
 * - Web Audio API synthesized 1-bit piezo buzzer sound effects with Mute toggle
 * - Strict 3-button navigation (A: Select, B: Execute, C: Cancel) & direct icon access
 * - Heading minigame (Left/Right guessing game, best of 5)
 * - Full status meters, feeding (meal/snack), light switch, medicine, poop flush, discipline
 * - Cross-page and cross-layout state synchronization
 */

(function () {
  'use strict';

  const STORAGE_KEY = 'lachlan_pocket_pet_v1';
  const SOUND_KEY = 'lachlan_pocket_pet_sound';

  // --- Web Audio 1-bit Piezo Buzzer Synthesizer ---
  const AudioEngine = {
    ctx: null,
    muted: false,

    init: function () {
      try {
        const savedSound = localStorage.getItem(SOUND_KEY);
        this.muted = savedSound === 'muted';
      } catch (e) {
        this.muted = false;
      }
    },

    _getAudioContext: function () {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) {
          this.ctx = new AudioCtx();
        }
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(function () {});
      }
      return this.ctx;
    },

    toggleMute: function () {
      this.muted = !this.muted;
      try {
        localStorage.setItem(SOUND_KEY, this.muted ? 'muted' : 'active');
      } catch (e) {}
      return !this.muted;
    },

    playTone: function (freq, durationMs, type) {
      if (this.muted) return;
      const ctx = this._getAudioContext();
      if (!ctx) return;

      try {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = type || 'square';
        osc.frequency.setValueAtTime(freq, ctx.currentTime);

        // Crisp 1-bit piezo envelope
        gain.gain.setValueAtTime(0.09, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + durationMs / 1000);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start();
        osc.stop(ctx.currentTime + durationMs / 1000);
      } catch (e) {}
    },

    beepClick: function () {
      this.playTone(2200, 25);
    },

    beepSelect: function () {
      const self = this;
      self.playTone(1600, 30);
      setTimeout(function () { self.playTone(2400, 40); }, 35);
    },

    beepCancel: function () {
      const self = this;
      self.playTone(850, 35);
      setTimeout(function () { self.playTone(550, 45); }, 40);
    },

    beepAttention: function () {
      const self = this;
      self.playTone(1900, 45);
      setTimeout(function () { self.playTone(1900, 45); }, 90);
      setTimeout(function () { self.playTone(1900, 45); }, 220);
      setTimeout(function () { self.playTone(1900, 45); }, 270);
    },

    beepEat: function () {
      const self = this;
      self.playTone(1100, 35);
      setTimeout(function () { self.playTone(850, 35); }, 60);
      setTimeout(function () { self.playTone(1100, 35); }, 120);
      setTimeout(function () { self.playTone(850, 35); }, 180);
    },

    beepWin: function () {
      const self = this;
      const notes = [523, 659, 784, 1046];
      notes.forEach(function (freq, i) {
        setTimeout(function () { self.playTone(freq, 60); }, i * 70);
      });
    },

    beepLose: function () {
      const self = this;
      const notes = [784, 659, 523, 415];
      notes.forEach(function (freq, i) {
        setTimeout(function () { self.playTone(freq, 75); }, i * 85);
      });
    },

    beepFlush: function () {
      const self = this;
      for (let i = 0; i < 6; i++) {
        setTimeout(function () {
          self.playTone(400 + i * 150, 30);
        }, i * 40);
      }
    },

    beepEvolve: function () {
      const self = this;
      const fanfare = [440, 554, 659, 880, 659, 880, 1108];
      fanfare.forEach(function (freq, i) {
        setTimeout(function () { self.playTone(freq, 80); }, i * 90);
      });
    },

    beepDeath: function () {
      const self = this;
      const dirge = [587, 554, 523, 440, 392, 330];
      dirge.forEach(function (freq, i) {
        setTimeout(function () { self.playTone(freq, 120); }, i * 140);
      });
    }
  };

  // --- Pixel Art 16x16 / 8x8 Sprite Definitions ---
  // Represented as binary strings (1 = pixel drawn, 0 = transparent)
  const SPRITES = {
    // Egg (16x16)
    egg_0: [
      ".....11111......",
      "...11.....11....",
      "..1..111....1...",
      ".1..11111....1..",
      ".1...111.....1..",
      "1.........11..1.",
      "1........1111.1.",
      "1........1111.1.",
      "1..11.....11..1.",
      "1.1111........1.",
      "1..11.........1.",
      ".1.......11..1..",
      ".1......1111.1..",
      "..1......11.1...",
      "...11.....11....",
      ".....11111......"
    ],
    egg_1: [
      "......11111.....",
      "....11.....11...",
      "...1..111....1..",
      "..1..11111....1.",
      "..1...111.....1.",
      ".1.........11..1",
      ".1........1111.1",
      ".1........1111.1",
      ".1..11.....11..1",
      ".1.1111........1",
      ".1..11.........1",
      "..1.......11..1.",
      "..1......1111.1.",
      "...1......11.1..",
      "....11.....11...",
      "......11111....."
    ],
    // Egg Hatching / Cracking
    egg_crack: [
      ".....11111......",
      "...11.....11....",
      "..1..111....1...",
      ".1...111..11.1..",
      ".1..1...1..1.1..",
      "..11.111.11.1...",
      "................",
      "....11....11....",
      "....11....11....",
      "................",
      ".11..111..111...",
      "1..11...11...11.",
      ".1..11...11..1..",
      "..1.11...11.1...",
      "...11.....11....",
      ".....11111......"
    ],

    // Babytchi (16x16)
    babytchi_0: [
      "................",
      ".......11.......",
      "......1..1......",
      "....11111111....",
      "...1........1...",
      "..1..........1..",
      ".1..11....11..1.",
      ".1..11....11..1.",
      ".1............1.",
      ".1....1111....1.",
      "..1..........1..",
      "...1111111111...",
      "....11....11....",
      "................",
      "................",
      "................"
    ],
    babytchi_1: [
      ".......11.......",
      "......1..1......",
      "....11111111....",
      "...1........1...",
      "..1..........1..",
      ".1..11....11..1.",
      "1...11....11...1",
      "1..............1",
      "1....111111....1",
      ".1....1..1....1.",
      "..1....11....1..",
      "...1111111111...",
      "...11......11...",
      "................",
      "................",
      "................"
    ],

    // Marutchi (16x16)
    marutchi_0: [
      "................",
      "....11111111....",
      "..11........11..",
      ".1............1.",
      ".1..11....11..1.",
      "1...11....11...1",
      "1..............1",
      "1.1...1111...1.1",
      "1..............1",
      ".1............1.",
      "..1..........1..",
      "...1111111111...",
      "...11......11...",
      "..1111....1111..",
      "................",
      "................"
    ],
    marutchi_1: [
      "....11111111....",
      "..11........11..",
      ".1............1.",
      ".1..11....11..1.",
      "1...11....11...1",
      "1..............1",
      "1.1..111111..1.1",
      "1....1....1....1",
      ".1....1111....1.",
      "..1..........1..",
      "...1111111111...",
      "..11........11..",
      ".1111......1111.",
      "................",
      "................",
      "................"
    ],

    // Tamatchi (Teen Good)
    tamatchi_0: [
      "..111......111..",
      ".1...1....1...1.",
      ".1....1111....1.",
      "..1..........1..",
      ".1..11....11..1.",
      ".1..11....11..1.",
      "1..............1",
      "1.1...1111...1.1",
      "1.1..........1.1",
      ".1............1.",
      "..1..........1..",
      "...1111111111...",
      "....11....11....",
      "....11....11....",
      "...111....111...",
      "................"
    ],
    tamatchi_1: [
      "..111......111..",
      ".1...1....1...1.",
      ".1....1111....1.",
      "..1..........1..",
      ".1..11....11..1.",
      "1.1.11....11.1.1",
      "1..............1",
      ".1...111111...1.",
      ".1...1....1...1.",
      "..1...1111...1..",
      "...1111111111...",
      "...11......11...",
      "..111......111..",
      "................",
      "................",
      "................"
    ],

    // Kuchitamatchi (Teen Bad)
    kuchitamatchi_0: [
      "....11111111....",
      "..11........11..",
      ".1............1.",
      ".1..11....11..1.",
      ".1..11....11..1.",
      "1..............1",
      "1...11111111...1",
      "1..1........1..1",
      "1..1111111111..1",
      ".1..1......1..1.",
      "..1..111111..1..",
      "...1111111111...",
      "....11....11....",
      "....11....11....",
      "...111....111...",
      "................"
    ],
    kuchitamatchi_1: [
      "....11111111....",
      "..11........11..",
      ".1..11....11..1.",
      ".1..11....11..1.",
      "1..............1",
      "1...11111111...1",
      "1..1........1..1",
      "1..1.111111.1..1",
      "1..1........1..1",
      ".1..11111111..1.",
      "..1..........1..",
      "...1111111111...",
      "...11......11...",
      "..111......111..",
      "................",
      "................"
    ],

    // Mametchi (Adult - Genius/Best)
    mametchi_0: [
      "..1111....1111..",
      ".111111..111111.",
      ".11111111111111.",
      ".111........111.",
      "1...11....11...1",
      "1...11....11...1",
      "1..............1",
      ".1....1111....1.",
      "..1..........1..",
      "...1111111111...",
      "..1.1......1.1..",
      ".1..1......1..1.",
      "....11111111....",
      "....11....11....",
      "...111....111...",
      "................"
    ],
    mametchi_1: [
      "..1111....1111..",
      ".111111..111111.",
      ".11111111111111.",
      ".111........111.",
      "1...11....11...1",
      "1...11....11...1",
      "1...1......1...1",
      ".1...111111...1.",
      "..1..........1..",
      ".1.1111111111.1.",
      "1...1......1...1",
      "....1......1....",
      "....11111111....",
      "...11......11...",
      "..111......111..",
      "................"
    ],

    // Kuchipatchi (Adult - Cute Duck Lips)
    kuchipatchi_0: [
      "....11111111....",
      "...1........1...",
      "..1..11..11..1..",
      "..1..11..11..1..",
      ".1............1.",
      ".1..11111111..1.",
      ".1.1........1.1.",
      "1..1111111111..1",
      "1.1.1......1.1.1",
      "1.1..111111..1.1",
      "1..............1",
      ".1............1.",
      "..111111111111..",
      "....11....11....",
      "...111....111...",
      "................"
    ],
    kuchipatchi_1: [
      "....11111111....",
      "...1........1...",
      "..1..11..11..1..",
      "..1..11..11..1..",
      ".1............1.",
      "1.1.11111111.1.1",
      "1..1........1..1",
      "1..1.111111.1..1",
      ".1.1........1.1.",
      ".1..11111111..1.",
      ".1............1.",
      "..111111111111..",
      "...11......11...",
      "..111......111..",
      "................",
      "................"
    ],

    // Ginjirotchi (Adult - Penguin)
    ginjirotchi_0: [
      "...1...11...1...",
      "...11..11..11...",
      "....11111111....",
      "..11........11..",
      ".1..11....11..1.",
      ".1..11....11..1.",
      "1..............1",
      "1.1...1111...1.1",
      "1.1....11....1.1",
      "1.1..........1.1",
      ".1...111111...1.",
      ".1..1......1..1.",
      "..111111111111..",
      "....11....11....",
      "...111....111...",
      "................"
    ],
    ginjirotchi_1: [
      "...1...11...1...",
      "...11..11..11...",
      "....11111111....",
      "..11........11..",
      ".1..11....11..1.",
      "1.1.11....11.1.1",
      "1....111111....1",
      ".1....1..1....1.",
      ".1............1.",
      ".1...111111...1.",
      ".1..1......1..1.",
      "..111111111111..",
      "...11......11...",
      "..111......111..",
      "................",
      "................"
    ],

    // Ghost / Tombstone on Death
    ghost_0: [
      ".....111111.....",
      "....1......1....",
      ".....111111.....",
      "................",
      "....11111111....",
      "...1........1...",
      "..1..11..11..1..",
      "..1..11..11..1..",
      ".1............1.",
      "1.1...1111...1.1",
      "1.1..1....1..1.1",
      "..1..........1..",
      "..1..........1..",
      "..1.11.11.11.1..",
      "..11..1..1..11..",
      "................"
    ],
    ghost_1: [
      ".....111111.....",
      "....1......1....",
      ".....111111.....",
      "....11111111....",
      "...1........1...",
      "..1..11..11..1..",
      "..1..11..11..1..",
      ".1............1.",
      "1.1...1111...1.1",
      "1.1..1....1..1.1",
      "..1..........1..",
      "..1..........1..",
      "..1..1.11.1..1..",
      "..1.11....11.1..",
      "...1........1...",
      "................"
    ],

    // 8x8 Accessories & Items
    poop: [
      "...11...",
      "..1111..",
      ".1.11.1.",
      "..1111..",
      ".111111.",
      "11111111",
      "11111111",
      ".111111."
    ],
    skull: [
      ".111111.",
      "11111111",
      "1.1111.1",
      "1.1111.1",
      "111..111",
      ".111111.",
      "..1.1...",
      "..111..."
    ],
    heart_full: [
      ".11..11.",
      "11111111",
      "11111111",
      "11111111",
      ".111111.",
      "..1111..",
      "...11...",
      "........"
    ],
    heart_empty: [
      ".11..11.",
      "1..11..1",
      "1......1",
      "1......1",
      ".1....1.",
      "..1..1..",
      "...11...",
      "........"
    ],
    burger: [
      "..1111..",
      ".111111.",
      "11111111",
      "1.1.1.11",
      "11111111",
      "11111111",
      ".111111.",
      "........"
    ],
    candy: [
      "...11...",
      "1..11..1",
      ".111111.",
      ".111111.",
      ".111111.",
      "1..11..1",
      "...11...",
      "........"
    ],
    duck_flush: [
      "...111..",
      "..11111.",
      ".111111.",
      "1111111.",
      "11111111",
      ".111111.",
      "..1111..",
      "........"
    ]
  };

  // --- Initial Pet State Generator ---
  function createDefaultState() {
    const now = Date.now();
    return {
      stage: 'EGG',
      species: 'egg',
      bornTimestamp: now,
      hatchedTimestamp: null,
      lastTickTimestamp: now,
      hunger: 4,        // 0 to 4 hearts
      happiness: 4,     // 0 to 4 hearts
      discipline: 0,    // 0 to 100%
      weight: 5,        // in oz
      age: 0,           // in days
      isSick: false,
      poopCount: 0,     // 0 to 4
      lightsOn: true,
      isSleeping: false,
      careMistakes: 0,
      deathCause: null
    };
  }

  const VALID_STAGES = ['EGG', 'BABY', 'CHILD', 'TEEN', 'ADULT', 'DEAD'];
  const VALID_SPECIES = [
    'egg', 'babytchi', 'marutchi', 'tamatchi', 'kuchitamatchi',
    'mametchi', 'ginjirotchi', 'maskutchi', 'kuchipatchi', 'nyatchi', 'tarakotchi',
    'oyajitchi', 'ghost'
  ];

  function sanitizePetState(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      return createDefaultState();
    }
    const def = createDefaultState();
    const clean = Object.assign({}, def);

    if (typeof raw.bornTimestamp === 'number' && !isNaN(raw.bornTimestamp) && raw.bornTimestamp > 0) {
      clean.bornTimestamp = raw.bornTimestamp;
    }
    if (typeof raw.lastTickTimestamp === 'number' && !isNaN(raw.lastTickTimestamp)) {
      clean.lastTickTimestamp = Math.min(Date.now(), Math.max(clean.bornTimestamp, raw.lastTickTimestamp));
    }
    if (typeof raw.hunger === 'number' && !isNaN(raw.hunger)) {
      clean.hunger = Math.max(0, Math.min(4, Math.floor(raw.hunger)));
    }
    if (typeof raw.happiness === 'number' && !isNaN(raw.happiness)) {
      clean.happiness = Math.max(0, Math.min(4, Math.floor(raw.happiness)));
    }
    if (typeof raw.discipline === 'number' && !isNaN(raw.discipline)) {
      clean.discipline = Math.max(0, Math.min(100, Math.floor(raw.discipline)));
    }
    if (typeof raw.weight === 'number' && !isNaN(raw.weight)) {
      clean.weight = Math.max(1, Math.min(99, Math.floor(raw.weight)));
    }
    if (typeof raw.age === 'number' && !isNaN(raw.age)) {
      clean.age = Math.max(0, Math.min(99, Math.floor(raw.age)));
    }
    if (typeof raw.poopCount === 'number' && !isNaN(raw.poopCount)) {
      clean.poopCount = Math.max(0, Math.min(4, Math.floor(raw.poopCount)));
    }
    if (typeof raw.careMistakes === 'number' && !isNaN(raw.careMistakes)) {
      clean.careMistakes = Math.max(0, Math.min(50, Math.floor(raw.careMistakes)));
    }

    clean.isSick = Boolean(raw.isSick);
    clean.lightsOn = raw.lightsOn !== false;
    clean.isSleeping = Boolean(raw.isSleeping);

    if (typeof raw.stage === 'string' && VALID_STAGES.includes(raw.stage.toUpperCase())) {
      clean.stage = raw.stage.toUpperCase();
    }
    if (typeof raw.species === 'string' && VALID_SPECIES.includes(raw.species.toLowerCase())) {
      clean.species = raw.species.toLowerCase();
    }
    if (raw.deathCause === 'sickness' || raw.deathCause === 'starvation' || raw.deathCause === 'old_age') {
      clean.deathCause = raw.deathCause;
    }

    return clean;
  }

  // --- Main Pocket_Pet Engine Object ---
  const Pocket_Pet = {
    state: createDefaultState(),
    selectedIconIndex: null, // null (idle) or 0..6
    mode: 'IDLE',           // 'IDLE', 'FEED_SELECT', 'GAME_PLAY', 'METER_VIEW', 'ANIMATING'
    meterPage: 0,           // 0: Age/Weight, 1: Discipline, 2: Hunger, 3: Happiness
    feedChoice: 'MEAL',     // 'MEAL' or 'SNACK'
    gameRound: 0,           // 1 to 5
    gameWins: 0,
    gamePlayerChoice: null, // 'L' or 'R'
    gamePetChoice: null,    // 'L' or 'R'
    animFrame: 0,
    petX: 8,                // 0 to 16 (center is 8)
    petDirection: 1,        // 1 (right) or -1 (left)
    specialAnim: null,      // 'EAT', 'FLUSH', 'NO', 'JUMP', 'CURE'
    specialAnimTimer: 0,
    tickIntervalId: null,
    animIntervalId: null,
    storageBound: false,
    _keydownBound: false,

    init: function () {
      if (!document.querySelector('.pocket_pet-canvas') && !document.querySelector('.pocket_pet-deck')) {
        return;
      }

      AudioEngine.init();
      this.loadState();
      this.processOfflineCatchup();

      // Clear existing intervals if re-initialized to prevent stacking
      if (this.tickIntervalId) {
        clearInterval(this.tickIntervalId);
        this.tickIntervalId = null;
      }
      if (this.animIntervalId) {
        clearInterval(this.animIntervalId);
        this.animIntervalId = null;
      }

      // Start tick loop (every 1 second)
      const self = this;
      this.tickIntervalId = setInterval(function () {
        self.tick();
      }, 1000);

      // Start animation loop (approx 2.5 FPS for retro authentic LCD bounce)
      this.animIntervalId = setInterval(function () {
        self.updateAnimation();
      }, 400);

      // Listen for cross-tab storage changes
      if (!this.storageBound) {
        this.storageBound = true;
        window.addEventListener('storage', function (e) {
          if (e.key === STORAGE_KEY) {
            self.loadState();
            self.renderAll();
          } else if (e.key === 'lachlan_pet_skin') {
            self.applyCurrentSkin();
          }
        });
      }

      // Mobile audio unlock on first touch gesture
      const unlockAudio = function () {
        AudioEngine._getAudioContext();
        document.removeEventListener('touchstart', unlockAudio);
        document.removeEventListener('pointerdown', unlockAudio);
      };
      document.addEventListener('touchstart', unlockAudio, { passive: true });
      document.addEventListener('pointerdown', unlockAudio, { passive: true });

      this.applyCurrentSkin();
      this.bindDOM();
      this.renderAll();
    },

    setSkin: function (skinId) {
      const validSkins = ['windows', 'egg-pink', 'atomic-purple', 'cyber-neon', 'gameboy'];
      if (!validSkins.includes(skinId)) {
        skinId = 'windows';
      }
      try {
        localStorage.setItem('lachlan_pet_skin', skinId);
      } catch (e) {}
      this.applyCurrentSkin();
    },

    getSkin: function () {
      try {
        return localStorage.getItem('lachlan_pet_skin') || 'windows';
      } catch (e) {
        return 'windows';
      }
    },

    applyCurrentSkin: function () {
      const skinId = this.getSkin();
      document.querySelectorAll('.pocket_pet-deck').forEach(function (deck) {
        deck.setAttribute('data-pet-skin', skinId);
      });
      this.renderScreen();
    },

    registerSprite: function (name, matrixArray) {
      if (typeof name === 'string' && Array.isArray(matrixArray)) {
        SPRITES[name] = matrixArray;
        return true;
      }
      return false;
    },

    getSprite: function (name) {
      return SPRITES[name] || null;
    },

    listSprites: function () {
      return Object.keys(SPRITES);
    },

    validateState: sanitizePetState,

    loadState: function () {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object') {
            this.state = sanitizePetState(parsed);
            return;
          }
        }
      } catch (e) {}
      this.state = createDefaultState();
      this.saveState();
    },

    saveState: function () {
      try {
        this.state.lastTickTimestamp = Date.now();
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
      } catch (e) {}
    },

    resetPet: function () {
      this.state = createDefaultState();
      this.selectedIconIndex = null;
      this.mode = 'IDLE';
      this.specialAnim = null;
      this.saveState();
      AudioEngine.beepSelect();
      this.renderAll();
    },

    // --- Hardcore 1997 Real-Time Offline Simulation ---
    processOfflineCatchup: function () {
      const now = Date.now();
      const elapsedMs = now - (this.state.lastTickTimestamp || now);
      const elapsedMinutes = Math.floor(elapsedMs / 60000);

      if (elapsedMinutes <= 0) return;

      // If already dead, nothing changes
      if (this.state.stage === 'DEAD') {
        this.saveState();
        return;
      }

      // Egg stage hatching check
      if (this.state.stage === 'EGG') {
        const eggAgeMin = Math.floor((now - this.state.bornTimestamp) / 60000);
        if (eggAgeMin >= 1) {
          this.hatchEgg();
        }
        this.saveState();
        return;
      }

      // Age calculation (1 day = 24 hours)
      const totalAgeDays = Math.floor((now - (this.state.hatchedTimestamp || now)) / 86400000);
      this.state.age = Math.max(this.state.age, totalAgeDays);

      // Metabolism rate based on stage
      let hungerRateMin = 50;
      let happyRateMin = 60;
      let poopRateMin = 120;

      if (this.state.stage === 'BABY') {
        hungerRateMin = 15;
        happyRateMin = 15;
        poopRateMin = 35;
      } else if (this.state.stage === 'CHILD') {
        hungerRateMin = 35;
        happyRateMin = 40;
        poopRateMin = 80;
      }

      // Offline stat decay
      const hungerDrop = Math.floor(elapsedMinutes / hungerRateMin);
      const happyDrop = Math.floor(elapsedMinutes / happyRateMin);
      const newPoops = Math.floor(elapsedMinutes / poopRateMin);

      this.state.hunger = Math.max(0, this.state.hunger - hungerDrop);
      this.state.happiness = Math.max(0, this.state.happiness - happyDrop);
      this.state.poopCount = Math.min(4, this.state.poopCount + newPoops);

      // Neglect & Sickness
      if (this.state.hunger === 0 || this.state.poopCount >= 3) {
        if (elapsedMinutes >= 180) {
          this.state.isSick = true;
        }
      }

      // Hardcore Fatal Neglect Check (unattended > 24 hours while sick / 0 hunger)
      if (elapsedMinutes >= 1440 && (this.state.hunger === 0 || this.state.isSick)) {
        this.killPet('Severe Neglect (Offline Starvation)');
        return;
      }

      // Evolution check
      this.checkEvolution(now);
      this.saveState();
    },

    // --- Regular Active Tick (runs once per second) ---
    tick: function () {
      const now = Date.now();
      this.state.lastTickTimestamp = now;

      if (this.state.stage === 'DEAD') return;

      // Egg auto-hatch after 60 seconds
      if (this.state.stage === 'EGG') {
        const eggAgeSec = Math.floor((now - this.state.bornTimestamp) / 1000);
        if (eggAgeSec >= 60) {
          this.hatchEgg();
        }
        return;
      }

      // Nighttime sleep schedule (8:00 PM to 8:00 AM)
      const currentHour = new Date(now).getHours();
      const shouldSleep = (currentHour >= 20 || currentHour < 8);
      if (shouldSleep && !this.state.isSleeping) {
        this.state.isSleeping = true;
      } else if (!shouldSleep && this.state.isSleeping) {
        this.state.isSleeping = false;
        this.state.lightsOn = true;
      }

      // Evolution check
      this.checkEvolution(now);

      // Attention trigger check
      const needsCare = (this.state.hunger === 0 || this.state.happiness === 0 || this.state.isSick || this.state.poopCount >= 2);
      this.updateAttentionLight(needsCare);

      // Periodic random attention beep
      if (needsCare && Math.random() < 0.05) {
        AudioEngine.beepAttention();
      }

      // Save every 30 seconds
      if (Math.floor(now / 1000) % 30 === 0) {
        this.saveState();
      }
    },

    hatchEgg: function () {
      this.state.stage = 'BABY';
      this.state.species = 'babytchi';
      this.state.hatchedTimestamp = Date.now();
      this.state.hunger = 4;
      this.state.happiness = 4;
      this.state.weight = 5;
      this.saveState();
      AudioEngine.beepEvolve();
      this.renderAll();
    },

    checkEvolution: function (now) {
      if (!this.state.hatchedTimestamp) return;
      const ageHours = (now - this.state.hatchedTimestamp) / 3600000;

      // Baby -> Child (after 1 hour)
      if (this.state.stage === 'BABY' && ageHours >= 1) {
        this.state.stage = 'CHILD';
        this.state.species = 'marutchi';
        this.state.weight = Math.max(10, this.state.weight);
        AudioEngine.beepEvolve();
        this.saveState();
      }
      // Child -> Teen (after 24 hours)
      else if (this.state.stage === 'CHILD' && ageHours >= 24) {
        this.state.stage = 'TEEN';
        this.state.species = (this.state.discipline >= 50 && this.state.careMistakes <= 2) ? 'tamatchi' : 'kuchitamatchi';
        this.state.weight = Math.max(20, this.state.weight);
        AudioEngine.beepEvolve();
        this.saveState();
      }
      // Teen -> Adult (after 72 hours)
      else if (this.state.stage === 'TEEN' && ageHours >= 72) {
        this.state.stage = 'ADULT';
        if (this.state.discipline >= 75 && this.state.careMistakes <= 1) {
          this.state.species = 'mametchi';
        } else if (this.state.discipline >= 50) {
          this.state.species = 'ginjirotchi';
        } else if (this.state.discipline >= 25) {
          this.state.species = 'kuchipatchi';
        } else {
          this.state.species = 'kuchitamatchi';
        }
        this.state.weight = Math.max(30, this.state.weight);
        AudioEngine.beepEvolve();
        this.saveState();
      }
    },

    killPet: function (cause) {
      this.state.stage = 'DEAD';
      this.state.species = 'ghost';
      this.state.deathCause = cause || 'Illness & Neglect';
      this.saveState();
      AudioEngine.beepDeath();
      this.renderAll();
    },

    // --- Animation & Movement Loop ---
    updateAnimation: function () {
      this.animFrame = (this.animFrame + 1) % 2;

      // Handle special animations countdown
      if (this.specialAnim) {
        this.specialAnimTimer--;
        if (this.specialAnimTimer <= 0) {
          this.specialAnim = null;
          if (this.mode === 'ANIMATING') {
            this.mode = 'IDLE';
          }
        }
      }

      // Idle movement across screen
      if (this.mode === 'IDLE' && this.state.stage !== 'EGG' && this.state.stage !== 'DEAD' && !this.state.isSleeping) {
        if (Math.random() < 0.4) {
          this.petX += this.petDirection;
          if (this.petX <= 2) {
            this.petX = 2;
            this.petDirection = 1;
          } else if (this.petX >= 14) {
            this.petX = 14;
            this.petDirection = -1;
          }
        }
      }

      this.renderScreen();
    },

    // --- Controls: 3 Buttons (A, B, C) ---
    pressA: function () {
      AudioEngine.beepClick();

      if (this.state.stage === 'DEAD') {
        // Can't interact except reset
        return;
      }

      if (this.specialAnim) return;

      // In Minigame: Button A chooses LEFT
      if (this.mode === 'GAME_PLAY') {
        this.handleGameChoice('L');
        return;
      }

      // In Feed Select: Toggle between MEAL and SNACK
      if (this.mode === 'FEED_SELECT') {
        this.feedChoice = (this.feedChoice === 'MEAL') ? 'SNACK' : 'MEAL';
        this.renderScreen();
        return;
      }

      // In Meter View: Cycle pages
      if (this.mode === 'METER_VIEW') {
        this.meterPage = (this.meterPage + 1) % 4;
        this.renderScreen();
        return;
      }

      // Egg hatching fast-forward
      if (this.state.stage === 'EGG') {
        this.hatchEgg();
        return;
      }

      // In Idle: Cycle 7 icons (0 to 6)
      if (this.selectedIconIndex === null) {
        this.selectedIconIndex = 0;
      } else {
        this.selectedIconIndex = (this.selectedIconIndex + 1) % 7;
      }

      this.updateIconBarUI();
      this.renderScreen();
    },

    pressB: function () {
      if (this.state.stage === 'DEAD') {
        // A+B or B on dead restarts egg
        this.resetPet();
        return;
      }

      if (this.specialAnim) return;

      // In Minigame: Button B chooses RIGHT
      if (this.mode === 'GAME_PLAY') {
        this.handleGameChoice('R');
        return;
      }

      // In Feed Select: Confirm feeding choice
      if (this.mode === 'FEED_SELECT') {
        this.executeFeed(this.feedChoice);
        return;
      }

      // In Meter View: Page through stats
      if (this.mode === 'METER_VIEW') {
        this.meterPage = (this.meterPage + 1) % 4;
        this.renderScreen();
        return;
      }

      // Egg quick-hatch
      if (this.state.stage === 'EGG') {
        this.hatchEgg();
        return;
      }

      // If an icon is selected, execute its action
      if (this.selectedIconIndex !== null) {
        AudioEngine.beepSelect();
        this.executeIconAction(this.selectedIconIndex);
      }
    },

    pressC: function () {
      AudioEngine.beepCancel();

      // Return to Idle from any mode/menu
      this.selectedIconIndex = null;
      this.mode = 'IDLE';
      this.specialAnim = null;
      this.updateIconBarUI();
      this.renderScreen();
    },

    // --- Action Execution ---
    executeIconAction: function (iconIndex) {
      switch (iconIndex) {
        case 0: // FEED
          if (this.state.isSleeping) {
            this.triggerNoAnim();
            return;
          }
          this.mode = 'FEED_SELECT';
          this.feedChoice = 'MEAL';
          this.renderScreen();
          break;

        case 1: // LIGHTS
          this.state.lightsOn = !this.state.lightsOn;
          this.saveState();
          this.selectedIconIndex = null;
          this.updateIconBarUI();
          this.renderScreen();
          break;

        case 2: // GAME (Heading Minigame)
          if (this.state.isSleeping || this.state.isSick) {
            this.triggerNoAnim();
            return;
          }
          this.startMinigame();
          break;

        case 3: // MEDICINE
          this.executeMedicine();
          break;

        case 4: // CLEAN POOP
          this.executeClean();
          break;

        case 5: // STATUS METER
          this.mode = 'METER_VIEW';
          this.meterPage = 0;
          this.renderScreen();
          break;

        case 6: // DISCIPLINE
          this.executeDiscipline();
          break;
      }
    },

    executeFeed: function (type) {
      this.mode = 'IDLE';
      this.selectedIconIndex = null;
      this.updateIconBarUI();

      if (type === 'MEAL') {
        if (this.state.hunger >= 4) {
          this.triggerNoAnim();
          return;
        }
        this.state.hunger = Math.min(4, this.state.hunger + 1);
        this.state.weight += 1;
        this.triggerSpecialAnim('EAT_BURGER', 6);
        AudioEngine.beepEat();
      } else {
        // Snack
        if (this.state.happiness >= 4 && Math.random() < 0.5) {
          this.triggerNoAnim();
          return;
        }
        this.state.happiness = Math.min(4, this.state.happiness + 1);
        this.state.weight += 2;
        // Risk of toothache/sickness from candy
        if (Math.random() < 0.15 && this.state.weight > 20) {
          this.state.isSick = true;
        }
        this.triggerSpecialAnim('EAT_CANDY', 6);
        AudioEngine.beepEat();
      }
      this.saveState();
    },

    executeMedicine: function () {
      this.selectedIconIndex = null;
      this.updateIconBarUI();

      if (this.state.isSick) {
        this.state.isSick = false;
        this.triggerSpecialAnim('HAPPY_JUMP', 6);
        AudioEngine.beepWin();
      } else {
        this.triggerNoAnim();
      }
      this.saveState();
    },

    executeClean: function () {
      this.selectedIconIndex = null;
      this.updateIconBarUI();

      if (this.state.poopCount > 0) {
        this.state.poopCount = 0;
        this.triggerSpecialAnim('FLUSH', 7);
        AudioEngine.beepFlush();
      } else {
        AudioEngine.beepSelect();
      }
      this.saveState();
    },

    executeDiscipline: function () {
      this.selectedIconIndex = null;
      this.updateIconBarUI();

      const calledWithoutNeed = (this.state.hunger > 1 && this.state.happiness > 1 && !this.state.isSick && this.state.poopCount === 0);

      if (calledWithoutNeed) {
        this.state.discipline = Math.min(100, this.state.discipline + 25);
        this.triggerSpecialAnim('HAPPY_JUMP', 5);
        AudioEngine.beepWin();
      } else {
        // Unfair discipline
        this.state.happiness = Math.max(0, this.state.happiness - 1);
        this.triggerNoAnim();
      }
      this.saveState();
    },

    startMinigame: function () {
      this.mode = 'GAME_PLAY';
      this.gameRound = 1;
      this.gameWins = 0;
      this.gamePlayerChoice = null;
      this.gamePetChoice = null;
      this.selectedIconIndex = null;
      this.updateIconBarUI();
      this.renderScreen();
    },

    handleGameChoice: function (choice) {
      this.gamePlayerChoice = choice;
      // 50/50 pet heading
      this.gamePetChoice = (Math.random() < 0.5) ? 'L' : 'R';

      const isWin = (this.gamePlayerChoice === this.gamePetChoice);
      if (isWin) {
        this.gameWins++;
        AudioEngine.beepWin();
      } else {
        AudioEngine.beepLose();
      }

      this.renderScreen();

      const self = this;
      setTimeout(function () {
        self.gameRound++;
        if (self.gameRound > 5) {
          self.finishMinigame();
        } else {
          self.gamePlayerChoice = null;
          self.gamePetChoice = null;
          self.renderScreen();
        }
      }, 700);
    },

    finishMinigame: function () {
      this.mode = 'IDLE';
      if (this.gameWins >= 3) {
        this.state.happiness = Math.min(4, this.state.happiness + 1);
        this.state.weight = Math.max(5, this.state.weight - 1);
        this.triggerSpecialAnim('HAPPY_JUMP', 6);
        AudioEngine.beepWin();
      } else {
        this.triggerNoAnim();
      }
      this.saveState();
      this.renderScreen();
    },

    triggerNoAnim: function () {
      this.triggerSpecialAnim('NO', 5);
      AudioEngine.beepCancel();
    },

    triggerSpecialAnim: function (type, durationFrames) {
      this.specialAnim = type;
      this.specialAnimTimer = durationFrames || 5;
      this.renderScreen();
    },

    // --- Screen Drawing (32x19 Virtual Matrix) ---
    renderScreen: function () {
      const canvases = document.querySelectorAll('.pocket_pet-canvas');
      if (canvases.length === 0) return;

      const self = this;
      canvases.forEach(function (canvas) {
        self._drawCanvas(canvas);
      });
    },

    _drawCanvas: function (canvas) {
      const self = this;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const V_W = 32;
      const V_H = 19;
      const P_SIZE = 5; // Scaled to 160x95

      // Read dynamic CSS custom properties from computed style
      let computedStyle = null;
      try {
        computedStyle = window.getComputedStyle(canvas);
      } catch (e) {}

      const isNight = (!this.state.lightsOn || this.state.isSleeping);
      const bgProp = isNight ? '--pet-lcd-bg-night' : '--pet-lcd-bg';
      const pixelProp = isNight ? '--pet-lcd-pixel-night' : '--pet-lcd-pixel';

      const customBg = computedStyle ? computedStyle.getPropertyValue(bgProp).trim() : '';
      const customPixel = computedStyle ? computedStyle.getPropertyValue(pixelProp).trim() : '';

      const lcdBg = customBg || (isNight ? '#7d8e68' : '#9bb084');
      const pixelColor = customPixel || (isNight ? '#10170a' : '#182412');

      ctx.fillStyle = lcdBg;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Pixel draw helper
      function setPixel(x, y, on) {
        if (!on) return;
        if (x < 0 || x >= V_W || y < 0 || y >= V_H) return;
        ctx.fillStyle = pixelColor;
        ctx.fillRect(x * P_SIZE, y * P_SIZE, P_SIZE - 1, P_SIZE - 1);
      }

      function drawSprite(spriteArray, startX, startY) {
        if (!spriteArray) return;
        for (let row = 0; row < spriteArray.length; row++) {
          const line = spriteArray[row];
          for (let col = 0; col < line.length; col++) {
            if (line[col] === '1') {
              setPixel(startX + col, startY + row, true);
            }
          }
        }
      }

      // Draw text string using 3x5 font
      function drawText(text, x, y) {
        const FONT = {
          '0': ["111","1.1","1.1","1.1","111"],
          '1': [".1.","11.",".1.",".1.","111"],
          '2': ["111","..1","111","1..","111"],
          '3': ["111","..1","111","..1","111"],
          '4': ["1.1","1.1","111","..1","..1"],
          '5': ["111","1..","111","..1","111"],
          '6': ["111","1..","111","1.1","111"],
          '7': ["111","..1","..1","..1","..1"],
          '8': ["111","1.1","111","1.1","111"],
          '9': ["111","1.1","111","..1","111"],
          'A': ["111","1.1","111","1.1","1.1"],
          'B': ["11.","1.1","11.","1.1","11."],
          'C': ["111","1..","1..","1..","111"],
          'D': ["11.","1.1","1.1","1.1","11."],
          'E': ["111","1..","111","1..","111"],
          'F': ["111","1..","11.","1..","1.."],
          'G': ["111","1..","1.1","1.1","111"],
          'H': ["1.1","1.1","111","1.1","1.1"],
          'I': ["111",".1.",".1.",".1.","111"],
          'K': ["1.1","11.","1..","11.","1.1"],
          'L': ["1..","1..","1..","1..","111"],
          'M': ["1.1","111","1.1","1.1","1.1"],
          'N': ["11.","1.1","1.1","1.1","1.1"],
          'O': ["111","1.1","1.1","1.1","111"],
          'P': ["111","1.1","111","1..","1.."],
          'R': ["11.","1.1","11.","1.1","1.1"],
          'S': ["111","1..","111","..1","111"],
          'T': ["111",".1.",".1.",".1.",".1."],
          'U': ["1.1","1.1","1.1","1.1","111"],
          'V': ["1.1","1.1","1.1","1.1",".1."],
          'W': ["1.1","1.1","1.1","111","1.1"],
          'Y': ["1.1","1.1",".1.",".1.",".1."],
          'Z': ["111","..1",".1.","1..","111"],
          ':': [".",".","1",".","1"],
          '-': ["...","...","111","...","..."],
          '>': ["1..",".1.","..1",".1.","1.."],
          '<': ["..1",".1.","1..",".1.","..1"],
          '%': ["1.1","..1",".1.","1..","1.1"],
          ' ': ["...","...","...","...","..."]
        };

        const upper = String(text).toUpperCase();
        let curX = x;
        for (let i = 0; i < upper.length; i++) {
          const char = upper[i];
          const glyph = FONT[char] || FONT[' '];
          for (let r = 0; r < glyph.length; r++) {
            for (let c = 0; c < glyph[r].length; c++) {
              if (glyph[r][c] === '1') {
                setPixel(curX + c, y + r, true);
              }
            }
          }
          curX += (glyph[0] ? glyph[0].length : 3) + 1;
        }
      }

      // --- Mode Rendering Branching ---

      // 1. Minigame Mode
      if (this.mode === 'GAME_PLAY') {
        drawText(`RND ${this.gameRound}/5`, 2, 1);
        drawText(`WIN ${this.gameWins}`, 20, 1);

        if (this.gamePlayerChoice) {
          // Show Choices
          drawText(this.gamePlayerChoice, 6, 8);
          drawText('VS', 14, 8);
          drawText(this.gamePetChoice, 22, 8);
        } else {
          // Pet waiting in center
          const petSprite = SPRITES[`${this.state.species}_${this.animFrame}`] || SPRITES.babytchi_0;
          drawSprite(petSprite, 8, 3);
          drawText('< A   B >', 4, 13);
        }
        return;
      }

      // 2. Feed Choice Mode
      if (this.mode === 'FEED_SELECT') {
        drawText('FEED PET', 8, 1);
        if (this.feedChoice === 'MEAL') {
          drawText('> MEAL', 4, 8);
          drawText('  SNACK', 4, 13);
          drawSprite(SPRITES.burger, 22, 6);
        } else {
          drawText('  MEAL', 4, 8);
          drawText('> SNACK', 4, 13);
          drawSprite(SPRITES.candy, 22, 10);
        }
        return;
      }

      // 3. Status Meter Mode
      if (this.mode === 'METER_VIEW') {
        if (this.meterPage === 0) {
          drawText('AGE & WEIGHT', 3, 1);
          drawText(`AGE: ${this.state.age}D`, 3, 7);
          drawText(`WT : ${this.state.weight}OZ`, 3, 13);
        } else if (this.meterPage === 1) {
          drawText('DISCIPLINE', 4, 1);
          drawText(`${this.state.discipline}%`, 10, 8);
          // Discipline bar
          const barWidth = Math.floor((this.state.discipline / 100) * 20);
          for (let bx = 0; bx < 20; bx++) {
            setPixel(6 + bx, 14, bx < barWidth);
            setPixel(6 + bx, 15, bx < barWidth);
          }
        } else if (this.meterPage === 2) {
          drawText('HUNGER', 8, 1);
          for (let h = 0; h < 4; h++) {
            const spr = (h < this.state.hunger) ? SPRITES.heart_full : SPRITES.heart_empty;
            drawSprite(spr, 2 + h * 7, 8);
          }
        } else if (this.meterPage === 3) {
          drawText('HAPPINESS', 4, 1);
          for (let h = 0; h < 4; h++) {
            const spr = (h < this.state.happiness) ? SPRITES.heart_full : SPRITES.heart_empty;
            drawSprite(spr, 2 + h * 7, 8);
          }
        }
        return;
      }

      // 4. Dead / Ghost Screen
      if (this.state.stage === 'DEAD') {
        drawSprite(SPRITES[`ghost_${this.animFrame}`], 8, 1);
        drawText('R.I.P.', 10, 13);
        return;
      }

      // 5. Special Animations
      if (this.specialAnim === 'EAT_BURGER') {
        const petSprite = SPRITES[`${this.state.species}_${this.animFrame}`] || SPRITES.babytchi_0;
        drawSprite(petSprite, 3, 2);
        drawSprite(SPRITES.burger, 20, 5);
        return;
      }
      if (this.specialAnim === 'EAT_CANDY') {
        const petSprite = SPRITES[`${this.state.species}_${this.animFrame}`] || SPRITES.babytchi_0;
        drawSprite(petSprite, 3, 2);
        drawSprite(SPRITES.candy, 20, 5);
        return;
      }
      if (this.specialAnim === 'FLUSH') {
        const flushX = 24 - (7 - this.specialAnimTimer) * 4;
        drawSprite(SPRITES.duck_flush, flushX, 5);
        return;
      }
      if (this.specialAnim === 'HAPPY_JUMP') {
        const petSprite = SPRITES[`${this.state.species}_${this.animFrame}`] || SPRITES.babytchi_0;
        const jumpY = (this.animFrame === 0) ? 0 : 3;
        drawSprite(petSprite, 8, jumpY);
        drawSprite(SPRITES.heart_full, 2, 2);
        drawSprite(SPRITES.heart_full, 22, 2);
        return;
      }
      if (this.specialAnim === 'NO') {
        const petSprite = SPRITES[`${this.state.species}_0`] || SPRITES.babytchi_0;
        drawSprite(petSprite, 8, 2);
        drawText('NO', 12, 13);
        return;
      }

      // 6. Idle Screen (Standard View)
      if (this.state.stage === 'EGG') {
        const eggSprite = SPRITES[`egg_${this.animFrame}`];
        drawSprite(eggSprite, 8, 2);
      } else {
        // Active Creature
        const spriteKey = `${this.state.species}_${this.animFrame}`;
        const petSprite = SPRITES[spriteKey] || SPRITES.babytchi_0;
        const posY = this.state.isSleeping ? 3 : 2;
        drawSprite(petSprite, this.petX, posY);

        // Sleeping ZZZ
        if (this.state.isSleeping) {
          drawText('Z', 22, 2);
          drawText('Z', 25, 6);
        }

        // Sickness Skull
        if (this.state.isSick) {
          drawSprite(SPRITES.skull, 22, 1);
        }

        // Poops on screen
        if (this.state.poopCount > 0) {
          for (let p = 0; p < this.state.poopCount; p++) {
            const px = 22 - (p % 2) * 5;
            const py = 10 - Math.floor(p / 2) * 5;
            drawSprite(SPRITES.poop, px, py);
          }
        }
      }
    },

    // --- DOM UI Synchronization ---
    bindDOM: function () {
      const self = this;

      // Bind all button As
      document.querySelectorAll('.btn-a, [data-t-btn="a"]').forEach(function (btn) {
        if (!btn._bound) {
          btn._bound = true;
          btn.addEventListener('click', function (e) {
            e.stopPropagation();
            self.pressA();
          });
        }
      });

      // Bind all button Bs
      document.querySelectorAll('.btn-b, [data-t-btn="b"]').forEach(function (btn) {
        if (!btn._bound) {
          btn._bound = true;
          btn.addEventListener('click', function (e) {
            e.stopPropagation();
            self.pressB();
          });
        }
      });

      // Bind all button Cs
      document.querySelectorAll('.btn-c, [data-t-btn="c"]').forEach(function (btn) {
        if (!btn._bound) {
          btn._bound = true;
          btn.addEventListener('click', function (e) {
            e.stopPropagation();
            self.pressC();
          });
        }
      });

      // Direct clickable icons
      document.querySelectorAll('.t-icon[data-icon-index]').forEach(function (iconEl) {
        if (!iconEl._bound) {
          iconEl._bound = true;
          iconEl.addEventListener('click', function (e) {
            e.stopPropagation();
            const idx = parseInt(iconEl.getAttribute('data-icon-index'), 10);
            if (!isNaN(idx)) {
              self.selectedIconIndex = idx;
              self.updateIconBarUI();
              AudioEngine.beepClick();
              self.executeIconAction(idx);
            }
          });
        }
      });

      // Mute toggle buttons
      document.querySelectorAll('.btn-mute-toggle, #pocket_pet-mute-toggle').forEach(function (btn) {
        if (!btn._bound) {
          btn._bound = true;
          btn.addEventListener('click', function (e) {
            e.stopPropagation();
            const isUnmuted = AudioEngine.toggleMute();
            self.updateSoundUI(isUnmuted);
            if (isUnmuted) {
              AudioEngine.beepSelect();
            }
          });
        }
      });

      // Reset / Rebirth buttons
      document.querySelectorAll('.btn-reset-toggle, #pocket_pet-reset-btn').forEach(function (btn) {
        if (!btn._bound) {
          btn._bound = true;
          btn.addEventListener('click', function (e) {
            e.stopPropagation();
            if (self.state.stage === 'DEAD' || confirm('Reset pet and hatch a new egg?')) {
              self.resetPet();
            }
          });
        }
      });

      // Scoped Keyboard Controls (A, B, C or Left, Enter, Escape)
      if (!self._keydownBound) {
        self._keydownBound = true;
        document.addEventListener('keydown', function (e) {
          // Don't intercept when user is typing in inputs, textareas, or select dropdowns
          if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT')) {
            return;
          }

          // Only handle if pet deck or pet window is focused or has focus-within, OR on standalone pet page
          const isStandalonePage = document.body.classList.contains('pet-standalone-page');
          const petDeck = document.querySelector('.pocket_pet-deck');
          const petWindow = document.getElementById('pocket_pet-app');
          const isFocused = isStandalonePage ||
            (petDeck && (petDeck.matches(':focus-within') || petDeck.contains(document.activeElement))) ||
            (petWindow && petWindow.classList.contains('window-focused'));

          if (!isFocused) return;

          const key = e.key.toLowerCase();
          if (key === 'a' || e.key === 'ArrowLeft') {
            e.preventDefault();
            self.pressA();
          } else if (key === 'b' || e.key === 'Enter') {
            e.preventDefault();
            self.pressB();
          } else if (key === 'c' || e.key === 'Escape') {
            e.preventDefault();
            self.pressC();
          }
        });
      }
    },

    updateIconBarUI: function () {
      const self = this;
      document.querySelectorAll('.t-icon[data-icon-index]').forEach(function (el) {
        const idx = parseInt(el.getAttribute('data-icon-index'), 10);
        if (self.selectedIconIndex === idx) {
          el.classList.add('active');
        } else {
          el.classList.remove('active');
        }
      });
    },

    updateAttentionLight: function (isActive) {
      document.querySelectorAll('.t-icon-alert').forEach(function (alertEl) {
        if (isActive) {
          alertEl.classList.add('active');
        } else {
          alertEl.classList.remove('active');
        }
      });
    },

    updateSoundUI: function (isUnmuted) {
      document.querySelectorAll('.btn-mute-toggle, #pocket_pet-mute-toggle').forEach(function (btn) {
        btn.textContent = isUnmuted ? '🔊 Sound: ON' : '🔇 Sound: OFF';
      });
    },

    updateStatusBarUI: function () {
      const statusEl = document.getElementById('pocket_pet-status');
      const stageEl = document.getElementById('pocket_pet-stage');
      if (statusEl) {
        if (this.state.stage === 'DEAD') {
          statusEl.textContent = 'STATUS: DECEASED (R.I.P.)';
        } else if (this.state.isSleeping) {
          statusEl.textContent = 'STATUS: ASLEEP (ZZZ)';
        } else if (this.state.isSick) {
          statusEl.textContent = 'STATUS: SICK (NEED MED)';
        } else if (this.state.hunger === 0) {
          statusEl.textContent = 'STATUS: STARVING';
        } else {
          statusEl.textContent = 'STATUS: ACTIVE';
        }
      }
      if (stageEl) {
        stageEl.textContent = 'STAGE: ' + (this.state.species || this.state.stage).toUpperCase();
      }
    },

    renderAll: function () {
      this.updateIconBarUI();
      this.updateSoundUI(!AudioEngine.muted);
      this.updateStatusBarUI();
      this.renderScreen();
    }
  };

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      Pocket_Pet.init();
    });
  } else {
    Pocket_Pet.init();
  }

  // Export globally for testing or desktop window integration
  window.Pocket_Pet = Pocket_Pet;
  window.pocket_pet = Pocket_Pet;
})();