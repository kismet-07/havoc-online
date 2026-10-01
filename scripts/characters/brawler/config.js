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
    attackRange: 450,
    animationSpeed: {
      Attack1: 1.35,
      Attack2: 1.35,
    },
  },
  animations: {
    idle: 'Brawler_Idle',
    walk: 'Brawler_Walk',
    run: 'Brawler_Run',
    attack1: 'Brawler_Smash',
    attack2: 'Brawler_Punching',
  },
};
