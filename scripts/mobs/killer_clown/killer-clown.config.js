/** Killer Clown V2 combat/AI configuration. */

const KillerClownConfig = Object.freeze({
  objectName: 'Killer_clown',
  maxPopulation: 15,
  respawnSeconds: 15,

  animations: {
    idle: 'Idle_Sword',
    walk: 'Walk_Large',
    run: 'Run_Stealth',
    attack: 'Sword_Attack',
  },

  movement: {
    walkSpeed: 110,
    chaseSpeed: 1000,
    returnSpeed: 140,
    idleMinSeconds: 2,
    idleMaxSeconds: 5,
    walkMinSeconds: 10,
    walkMaxSeconds: 15,
    boundaryMargin: 300,
    spawnRadius: 1800,
    minimumSeparation: 1000,
  },

  combat: {
    aggressiveByDefault: false,
    aggroRange: 0,
    attackRange: 450,
    attackCooldownSeconds: 0.8,
    leashDistance: 3200,
    homeArrivalDistance: 12,
    combatSeparation: 300,
    combatSeparationSpeed: 240,
  },
});

if (typeof module !== 'undefined') {
  module.exports = { KillerClownConfig };
}
