/**
 * @module DesertGolfing
 * @description Main entry point and aggregator for the Desert Golfing engine in Lachlan's World.
 * Assembles modular sub-components, exposes public API, and registers cartridge with GameEngine.
 */

(function (root, factory) {
  'use strict';
  const req = typeof require === 'function' ? require : (() => ({}));
  const Config = (root && root.DesertGolfingConfig) || req('./config.js');
  const MathUtils = (root && root.DesertGolfingMath) || req('./math.js');
  const SaveManager = (root && root.DesertGolfingSaveManager) || req('./save-manager.js');
  const SoundEngine = (root && root.DesertGolfingSoundEngine) || req('./sound-engine.js');
  const TerrainWorld = (root && root.DesertGolfingTerrainWorld) || req('./terrain-world.js');
  const PhysicsEngine = (root && root.DesertGolfingPhysicsEngine) || req('./physics-engine.js');
  const InputController = (root && root.DesertGolfingInputController) || req('./input-controller.js');
  const TerrainRenderer = (root && root.DesertGolfingTerrainRenderer) || req('./terrain-renderer.js');
  const GameInstance = (root && root.DesertGolfingInstance) || req('./game-instance.js');

  const DesertGolfing = factory(
    Config, MathUtils, SaveManager, SoundEngine, TerrainWorld, PhysicsEngine, InputController, TerrainRenderer, GameInstance
  );

  if (root) root.DesertGolfing = DesertGolfing;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = DesertGolfing;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (
  CONFIG, MathUtils, SaveManager, SoundEngine, TerrainWorld, PhysicsEngine, InputController, TerrainRenderer, GameInstance
) {
  'use strict';

  function registerCartridge() {
    if (typeof window !== 'undefined' && window.GameEngine && typeof window.GameEngine.registerCartridge === 'function') {
      window.GameEngine.registerCartridge('desert-golfing', {
        id: 'desert-golfing',
        title: 'Desert Golfing',
        icon: '⚑',
        description: 'Deterministic continuous 2D physics & dune engine across endless sand dunes.',
        createInstance: GameInstance.createGameInstance
      });
    }
  }

  // Register cartridge immediately and on DOMContentLoaded
  registerCartridge();
  if (typeof window !== 'undefined') {
    window.addEventListener('DOMContentLoaded', registerCartridge);
  }

  const DesertGolfing = {
    createInstance: GameInstance.createGameInstance,
    getState: SaveManager.load,
    SaveManager: SaveManager,
    getPaletteColors: TerrainRenderer.getPaletteColors,

    // Exposed sub-modules for diagnostics and automated testing
    CONFIG: CONFIG,
    MathUtils: MathUtils,
    SoundEngine: SoundEngine,
    TerrainWorld: TerrainWorld,
    PhysicsEngine: PhysicsEngine,
    InputController: InputController,
    TerrainRenderer: TerrainRenderer,
    register: registerCartridge
  };

  return DesertGolfing;
});
