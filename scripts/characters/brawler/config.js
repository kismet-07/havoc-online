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
      'Brawler_Punching.001': 1.35,
      'Brawler_Smash.001': 1.35,
    },
    // The Smash clip contains an unnecessary end hold after the impact.
    // Transition a full second before the clip's reported end so the combo
    // never waits through that held pose before the next Punching clip.
    comboTransitionLeadTime: {
      'Brawler_Smash.001': 1.0,
    },
  },
  animations: {
    idle: 'Brawler_Idle',
    walk: 'Brawler_Walk',
    run: 'Brawler_Run',
    attack1: 'Brawler_Punching.001',
    attack2: 'Brawler_Smash.001',
  },
};