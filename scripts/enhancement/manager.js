/**
 * Enhancement policy manager.
 *
 * Enhancement level belongs to the equipment instance. This module resolves
 * enhancement state without creating a second copy of that state.
 */
function getHavocEnhancementLevelFromItem(itemInstance) {
  if (!itemInstance) return 0;
  return normalizeHavocEnhancementLevel(itemInstance.enhancementLevel);
}

function canHavocItemBeEnhanced(itemInstance) {
  if (!itemInstance || itemInstance.enhancementAllowed === false) return false;
  return Number.isFinite(Number(itemInstance.enhancementLevel));
}

function setHavocItemEnhancementLevel(itemInstance, level) {
  if (!itemInstance || itemInstance.enhancementAllowed === false) return false;
  itemInstance.enhancementLevel = normalizeHavocEnhancementLevel(level);
  return true;
}
