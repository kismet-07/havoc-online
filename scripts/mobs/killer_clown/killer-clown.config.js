/** Killer Clown V1 configuration. */

const KillerClownConfig = Object.freeze({
  objectName: 'Killer_clown',
  maxPopulation: 20,
  respawnSeconds: 30,

  animations: {
    idle: 'Idle_Sword',
    walk: 'Walk_Large',
    run: 'Run_Stealth',
    attack: 'Sword_Attack',
  },

  movement: {
    walkSpeed: 110,
    idleMinSeconds: 2,
    idleMaxSeconds: 5,
    walkMinSeconds: 2,
    walkMaxSeconds: 6,
    boundaryMargin: 300,
    spawnRadius: 1800,
  },

  combat: {
    aggressiveByDefault: false,
    aggroRange: 0,
    attackRange: 0,
  },
});

if (typeof module !== 'undefined') {
  module.exports = { KillerClownConfig };
}
