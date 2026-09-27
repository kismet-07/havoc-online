/**
 * Shared mob AI contract for Havoc Online.
 * Runtime-specific execution is embedded in Havoc Online.json for GDevelop 5.
 */

const MobAI = Object.freeze({
  states: ['idle', 'wander', 'aggro', 'attack', 'dead'],
  chooseNextWanderState(idleSecondsMin, idleSecondsMax) {
    const min = Math.max(0, idleSecondsMin);
    const max = Math.max(min, idleSecondsMax);
    return {
      state: 'idle',
      duration: min + Math.random() * (max - min),
    };
  },
});

if (typeof module !== 'undefined') {
  module.exports = { MobAI };
}
