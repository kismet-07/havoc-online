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
    // The current Brawler GLB only has the locomotion clips we are enabling
    // in this step. Walk is therefore the temporary non-moving fallback until
    // a dedicated Brawler idle clip is added.
    idle: 'Brawler_Walk',
    walk: 'Brawler_Walk',
    run: 'Brawler_Run',
    attack1: 'Attack1',
    attack2: 'Attack2',
  },
};
