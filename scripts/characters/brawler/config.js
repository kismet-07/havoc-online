/**
 * Brawler character configuration.
 *
 * Keep class-specific values here so movement, animation and combat systems
 * do not need hard-coded Brawler values scattered through runtime code.
 */

const BRAWLER_CONFIG = {
  objectName: 'MainChar',
  movement: {
    walkSpeed: 300,
    runSpeed: 600,
  },
  combat: {
    // 3D model centers can remain visually separated even when the character
    // and mob are already in melee contact because their model bounds are large.
    attackRange: 450,
    animationSpeed: {
      Attack1: 1.35,
      Attack2: 1.35,
    },
  },
  animations: {
    // No dedicated idle clip exists in the current Brawler GLB.
    // Empty idle name means movement code will hold the first walk frame.
    idle: '',
    walk: 'Brawler_Walk',
    run: 'Brawler_Run',
    attack1: 'Attack1',
    attack2: 'Attack2',
  },
};
