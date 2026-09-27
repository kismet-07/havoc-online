/**
 * Brawler character configuration.
 *
 * Keep class-specific values here so movement, animation and combat systems
 * do not need hard-coded Brawler values scattered through runtime code.
 */

const BRAWLER_CONFIG = {
  objectName: 'Character',
  movement: {
    walkSpeed: 300,
    runSpeed: 600,
  },
  combat: {
    attackRange: 300,
  },
  animations: {
    idle: 'Idle',
    walk: 'Walk',
    run: 'Run',
    attack1: 'Attack1',
    attack2: 'Attack2',
  },
};
