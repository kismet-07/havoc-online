/**
 * Runtime equipment state manager.
 * Owns equipped item state only. It does not load models or create VFX.
 */
function initializeHavocEquipment(runtimeScene) {
  if (!runtimeScene.__havocEquipment) {
    runtimeScene.__havocEquipment = { slots: Object.create(null) };
  }
  return runtimeScene.__havocEquipment;
}

function equipHavocItem(runtimeScene, itemInstance) {
  if (!runtimeScene || !itemInstance || !itemInstance.slot) return false;
  const state = initializeHavocEquipment(runtimeScene);
  state.slots[itemInstance.slot] = { ...itemInstance };
  return true;
}

function unequipHavocSlot(runtimeScene, slot) {
  if (!runtimeScene || !slot) return null;
  const state = initializeHavocEquipment(runtimeScene);
  const previous = state.slots[slot] || null;
  delete state.slots[slot];
  return previous;
}

function getHavocEquippedItem(runtimeScene, slot) {
  if (!runtimeScene || !slot) return null;
  const state = initializeHavocEquipment(runtimeScene);
  return state.slots[slot] || null;
}
