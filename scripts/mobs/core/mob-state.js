/**
 * Generic mob state constants for Havoc Online.
 * This file is the canonical source for mob state names; GDevelop
 * currently executes the runtime implementation from its JSON JsCode event.
 */

const MobState = Object.freeze({
  IDLE: 'idle',
  WANDER: 'wander',
  AGGRO: 'aggro',
  ATTACK: 'attack',
  DEAD: 'dead',
});

if (typeof module !== 'undefined') {
  module.exports = { MobState };
}
