/**
 * Character equipment attachment contract and runtime binding state.
 *
 * Standalone equipment models are represented by their own GDevelop 3D Model
 * object. The runtime follows the animated character's Mixamo hand bone and
 * writes the bone's world transform into that equipment object every frame.
 */
const HAVOC_EQUIPMENT_ATTACHMENT_PROFILES = Object.freeze({
  brawler_hands: Object.freeze({
    characterId: 'brawler',
    slot: 'hands',
    leftAnchor: 'mixamorig:LeftHand',
    rightAnchor: 'mixamorig:RightHand',
    modelRequired: true,
    modelObjectName: 'BrawlerGauntlet',
  }),
});

const HAVOC_EQUIPMENT_ATTACHMENT_CONFIG = Object.freeze({
  playerObjectName: 'Character',
  testItemId: 'BRAWLER_STARTER_GAUNTLETS',
  testInstanceId: 'brawler_starter_gauntlets_test',
  activeHand: 'right',
  positionOffset: Object.freeze({ x: 0, y: 0, z: 0 }),
  rotationOffsetDegrees: Object.freeze({ x: 0, y: 0, z: 0 }),
});

function getHavocEquipmentAttachmentProfile(profileId) {
  return HAVOC_EQUIPMENT_ATTACHMENT_PROFILES[profileId] || null;
}

function initializeHavocEquipmentAttachments(runtimeScene) {
  if (!runtimeScene.__havocEquipmentAttachments) {
    runtimeScene.__havocEquipmentAttachments = {
      bindings: Object.create(null),
      warnedMissingPlayer: false,
      warnedMissingModel: false,
      warnedMissingBone: false,
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
    modelObjectName: definition.modelObjectName || profile.modelObjectName || null,
    modelId: definition.modelId || null,
    modelAttached: false,
    sizeApplied: false,
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

function findHavocAttachmentBone(player, boneName) {
  if (!player || typeof player.get3DRendererObject !== 'function') return null;

  const root = player.get3DRendererObject();
  if (!root || typeof root.getObjectByName !== 'function') return null;

  if (typeof root.updateMatrixWorld === 'function') {
    root.updateMatrixWorld(true);
  }

  return root.getObjectByName(boneName) || null;
}

function havocQuaternionToEulerZYXDegrees(quaternion) {
  if (!quaternion) return null;

  const x = Number(quaternion.x) || 0;
  const y = Number(quaternion.y) || 0;
  const z = Number(quaternion.z) || 0;
  const w = Number(quaternion.w);
  const qw = Number.isFinite(w) ? w : 1;

  const r00 = 1 - 2 * (y * y + z * z);
  const r10 = 2 * (x * y + z * qw);
  const r20 = 2 * (x * z - y * qw);
  const r21 = 2 * (y * z + x * qw);
  const r22 = 1 - 2 * (x * x + y * y);

  const clamped = Math.max(-1, Math.min(1, -r20));
  const rotationY = Math.asin(clamped);
  const cosY = Math.cos(rotationY);

  let rotationX;
  let rotationZ;

  if (Math.abs(cosY) > 1e-6) {
    rotationX = Math.atan2(r21, r22);
    rotationZ = Math.atan2(r10, r00);
  } else {
    rotationX = 0;
    rotationZ = Math.atan2(-2 * (x * y - z * qw), 1 - 2 * (y * y + z * z));
  }

  const radiansToDegrees = 180 / Math.PI;
  return {
    x: rotationX * radiansToDegrees,
    y: rotationY * radiansToDegrees,
    z: rotationZ * radiansToDegrees,
  };
}

function syncHavocEquipmentToBone(runtimeScene, player, equipmentObject, binding) {
  if (!player || !equipmentObject || !binding) return false;
  if (typeof equipmentObject.get3DRendererObject !== 'function') return false;
  if (typeof THREE === 'undefined') return false;
  if (typeof THREE.Vector3 !== 'function' || typeof THREE.Quaternion !== 'function') return false;

  const boneName = HAVOC_EQUIPMENT_ATTACHMENT_CONFIG.activeHand === 'left'
    ? binding.leftAnchor
    : binding.rightAnchor;
  const bone = findHavocAttachmentBone(player, boneName);
  if (!bone) return false;

  if (!equipmentObject.get3DRendererObject()) return false;

  if (typeof bone.updateMatrixWorld === 'function') {
    bone.updateMatrixWorld(true);
  }

  if (
    typeof bone.getWorldPosition !== 'function' ||
    typeof bone.getWorldQuaternion !== 'function'
  ) {
    return false;
  }

  const worldPosition = new THREE.Vector3();
  const worldQuaternion = new THREE.Quaternion();

  bone.getWorldPosition(worldPosition);
  bone.getWorldQuaternion(worldQuaternion);

  const rotation = havocQuaternionToEulerZYXDegrees(worldQuaternion);
  if (!rotation) return false;

  equipmentObject.setX(
    worldPosition.x + HAVOC_EQUIPMENT_ATTACHMENT_CONFIG.positionOffset.x
  );
  equipmentObject.setY(
    worldPosition.y + HAVOC_EQUIPMENT_ATTACHMENT_CONFIG.positionOffset.y
  );
  equipmentObject.setZ(
    worldPosition.z + HAVOC_EQUIPMENT_ATTACHMENT_CONFIG.positionOffset.z
  );

  equipmentObject.setRotationX(
    rotation.x + HAVOC_EQUIPMENT_ATTACHMENT_CONFIG.rotationOffsetDegrees.x
  );
  equipmentObject.setRotationY(
    rotation.y + HAVOC_EQUIPMENT_ATTACHMENT_CONFIG.rotationOffsetDegrees.y
  );
  equipmentObject.setRotationZ(
    rotation.z + HAVOC_EQUIPMENT_ATTACHMENT_CONFIG.rotationOffsetDegrees.z
  );

  binding.modelAttached = true;
  binding.activeBone = boneName;
  return true;
}

function applyHavocEquipmentModelSize(equipmentObject, definition, binding) {
  if (!equipmentObject || !definition || !definition.defaultSize || binding.sizeApplied) return;

  const size = definition.defaultSize;
  if (typeof equipmentObject.setWidth === 'function') {
    equipmentObject.setWidth(size.width);
  }
  if (typeof equipmentObject.setHeight === 'function') {
    equipmentObject.setHeight(size.height);
  }
  if (typeof equipmentObject.setDepth === 'function') {
    equipmentObject.setDepth(size.depth);
  }

  binding.sizeApplied = true;
}

function ensureHavocBrawlerGauntletBinding(runtimeScene, player, equipmentObject) {
  const state = initializeHavocEquipmentAttachments(runtimeScene);
  const definition = getHavocEquipmentDefinition(
    HAVOC_EQUIPMENT_ATTACHMENT_CONFIG.testItemId
  );
  if (!definition) return null;

  const instanceId = HAVOC_EQUIPMENT_ATTACHMENT_CONFIG.testInstanceId;
  let binding = state.bindings[instanceId];

  if (!binding) {
    const instance = createHavocEquipmentInstance(
      HAVOC_EQUIPMENT_ATTACHMENT_CONFIG.testItemId,
      0
    );
    if (!instance) return null;
    instance.instanceId = instanceId;

    if (!attachHavocEquipmentInstance(runtimeScene, player, instance)) {
      return null;
    }

    binding = state.bindings[instanceId];
  }

  if (binding && binding.modelObjectName !== equipmentObject.getName()) {
    return null;
  }

  applyHavocEquipmentModelSize(equipmentObject, definition, binding);
  return binding || null;
}

function updateHavocEquipmentAttachments(runtimeScene) {
  if (!runtimeScene) return;

  const state = initializeHavocEquipmentAttachments(runtimeScene);
  const players = runtimeScene.getObjects(HAVOC_EQUIPMENT_ATTACHMENT_CONFIG.playerObjectName);
  const equipmentObjects = runtimeScene.getObjects('BrawlerGauntlet');

  const player = players && players[0];
  const equipmentObject = equipmentObjects && equipmentObjects[0];

  if (!player) {
    if (!state.warnedMissingPlayer) {
      state.warnedMissingPlayer = true;
      console.warn('[Havoc Equipment] Character object not found.');
    }
    return;
  }

  if (!equipmentObject) {
    if (!state.warnedMissingModel) {
      state.warnedMissingModel = true;
      console.warn('[Havoc Equipment] BrawlerGauntlet object not found.');
    }
    return;
  }

  state.warnedMissingPlayer = false;
  state.warnedMissingModel = false;

  const binding = ensureHavocBrawlerGauntletBinding(
    runtimeScene,
    player,
    equipmentObject
  );
  if (!binding) return;

  const synced = syncHavocEquipmentToBone(
    runtimeScene,
    player,
    equipmentObject,
    binding
  );

  if (!synced && !state.warnedMissingBone) {
    state.warnedMissingBone = true;
    console.warn(
      '[Havoc Equipment] Brawler hand bone not found:',
      HAVOC_EQUIPMENT_ATTACHMENT_CONFIG.activeHand === 'left'
        ? binding.leftAnchor
        : binding.rightAnchor
    );
  }

  if (synced) state.warnedMissingBone = false;
}
