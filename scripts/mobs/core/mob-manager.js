/**
 * Shared population/spawn contract for Havoc Online.
 * The active GDevelop implementation lives in Havoc Online.json.
 */

const MobManager = Object.freeze({
  maxPopulation: 20,
  respawnSeconds: 30,
});

if (typeof module !== 'undefined') {
  module.exports = { MobManager };
}
