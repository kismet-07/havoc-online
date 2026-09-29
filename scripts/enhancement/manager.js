/**
 * Runtime enhancement state manager.
 * Stores enhancement state only. Visual presentation is separate.
 */
function initializeHavocEnhancementManager(runtimeScene) {
  if (!runtimeScene.__havocEnhancementManager) {
    runtimeScene.__havocEnhancementManager = {
      itemLevels: Object.create(null),
    };
  }
  return runtimeScene.__havocEnhancementManager;
}

function setHavocItemEnhancementLevel(runtimeScene, itemInstanceId, level) {
  if (!runtimeScene || !itemInstanceId) return false;
  const state = initializeHavocEnhancementManager(runtimeScene);
  state.itemLevels[itemInstanceId] = normalizeHavocEnhancementLevel(level);
  return true;
}

function getHavocItemEnhancementLevel(runtimeScene, itemInstanceId) {
  if (!runtimeScene || !itemInstanceId) return 0;
  const state = initializeHavocEnhancementManager(runtimeScene);
  return state.itemLevels[itemInstanceId] || 0;
}
