/**
 * Character equipment attachment contract and runtime binding state.
 *
 * This layer deliberately does not create Three.js objects. The current
 * Brawler equipment is embedded in the skinned character GLB, so the runtime
 * binding records which character anchors an equipment instance owns. A
 * future standalone equipment model adapter can consume the same binding
 * without changing equipment state or enhancement logic.
 */
const HAVOC_EQUIPMENT_ATTACHMENT_PROFILES = Object.freeze({
  brawler_hands: Object.freeze({
    characterId: 'brawler',
    slot: 'hands',
    leftAnchor: 'mixamorig:LeftHand',
    rightAnchor: 'mixamorig:RightHand',
    modelRequired: false,
  }),
});

function getHavocEquipmentAttachmentProfile(profileId) {
  return HAVOC_EQUIPMENT_ATTACHMENT_PROFILES[profileId] || null;
}

function initializeHavocEquipmentAttachments(runtimeScene) {
  if (!runtimeScene.__havocEquipmentAttachments) {
    runtimeScene.__havocEquipmentAttachments = {
      bindings: Object.create(null),
    };
  }
  return runtimeScene.__havocEquipmentAttachments;
}

function attachHavocEquipmentInstance(runtimeScene, player, itemInstance) {
  if (!runtimeScene || !player || !itemInstance) return false;

  const definition = getHavocEquipmentDefinition(itemInstance.itemId);
  if (!definition || !definition.attachmentProfile) return false;

  const profile = getHavocEquipmentAttachmentProfile(definition.attachmentProfile);
  if (!profile) return false;

  const state = initializeHavocEquipmentAttachments(runtimeScene);
  state.bindings[itemInstance.instanceId || itemInstance.itemId] = {
    itemId: itemInstance.itemId,
    instanceId: itemInstance.instanceId || null,
    slot: itemInstance.slot,
    characterId: profile.characterId,
    leftAnchor: profile.leftAnchor,
    rightAnchor: profile.rightAnchor,
    playerObjectName: player.getName ? player.getName() : null,
    modelAttached: false,
  };

  return true;
}

function detachHavocEquipmentInstance(runtimeScene, itemInstanceId) {
  if (!runtimeScene || !itemInstanceId) return false;

  const state = initializeHavocEquipmentAttachments(runtimeScene);
  if (!state.bindings[itemInstanceId]) return false;

  delete state.bindings[itemInstanceId];
  return true;
}

function getHavocEquipmentAttachment(runtimeScene, itemInstanceId) {
  if (!runtimeScene || !itemInstanceId) return null;
  const state = initializeHavocEquipmentAttachments(runtimeScene);
  return state.bindings[itemInstanceId] || null;
}
