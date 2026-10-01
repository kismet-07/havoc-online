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
      Brawler_Punching: 1.35,
      Brawler_Smash: 1.35,
    },
  },
  animations: {
    idle: 'Brawler_Idle',
    walk: 'Brawler_Walk',
    run: 'Brawler_Run',
    attack1: 'Brawler_Punching',
    attack2: 'Brawler_Smash',
  },
};
