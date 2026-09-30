/**
 * Character equipment attachment contract and runtime binding state.
 *
 * Keep the equipment as a normal GDevelop Model3D object. The renderer is
 * positioned from the animated character hand bone every frame. This is the
 * known-good attachment path and avoids depending on the imported GLTF scene
 * hierarchy, which varies between equipment models.
 */
const HAVOC_EQUIPMENT_ATTACHMENT_PROFILES = Object.freeze({
  brawler_hands: Object.freeze({
    characterId: 'brawler',
    slot: 'hands',
    leftAnchor: 'mixamorig:LeftHand',
    rightAnchor: 'mixamorig:RightHand',
    modelRequired: true,
    modelObjectName: 'IronGauntlet',
  }),
});

const HAVOC_EQUIPMENT_ATTACHMENT_CONFIG = Object.freeze({
  playerObjectName: 'Character',
  testItemId: 'BRAWLER_STARTER_GAUNTLETS',
  testInstanceId: 'brawler_starter_gauntlets_test',
  activeHand: 'left',
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
      warnedRenderer: false,
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
    activeBone: null,
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

function normalizeHavocBoneName(name) {
  return String(name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function findHavocAttachmentBone(player, boneName) {
  if (!player || typeof player.get3DRendererObject !== 'function') return null;

  const root = player.get3DRendererObject();
  if (!root) return null;

  if (typeof root.updateMatrixWorld === 'function') {
    root.updateMatrixWorld(true);
  }

  if (typeof root.getObjectByName === 'function') {
    const exact = root.getObjectByName(boneName);
    if (exact) return exact;
  }

  if (typeof root.traverse !== 'function') return null;

  const wanted = normalizeHavocBoneName(boneName);
  const candidates = new Set([
    wanted,
    normalizeHavocBoneName('mixamorig:' + boneName.replace(/^mixamorig:/i, '')),
    normalizeHavocBoneName(boneName.replace(/^mixamorig:/i, '')),
  ]);

  let matchedBone = null;
  root.traverse((node) => {
    if (matchedBone || !node || !node.name) return;
    if (candidates.has(normalizeHavocBoneName(node.name))) {
      matchedBone = node;
    }
  });

  return matchedBone;
}

function prepareHavocEquipmentRenderer(renderer) {
  if (!renderer) return false;

  renderer.visible = true;

  if (typeof renderer.traverse === 'function') {
    renderer.traverse((node) => {
      if (!node) return;
      node.visible = true;
      if (node.isMesh) {
        node.frustumCulled = false;
        if (node.geometry && typeof node.geometry.computeBoundingSphere === 'function') {
          node.geometry.computeBoundingSphere();
        }
      }
    });
  }

  return true;
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
    rotationZ = Math.atan2(
      -2 * (x * y - z * qw),
      1 - 2 * (y * y + z * z)
    );
  }

  const radiansToDegrees = 180 / Math.PI;
  return {
    x: rotationX * radiansToDegrees,
    y: rotationY * radiansToDegrees,
    z: rotationZ * radiansToDegrees,
  };
}

function syncHavocEquipmentToBone(player, equipmentObject, binding) {
  if (!player || !equipmentObject || !binding) return false;
  if (typeof equipmentObject.get3DRendererObject !== 'function') return false;
  if (typeof THREE === 'undefined') return false;
  if (typeof THREE.Vector3 !== 'function' || typeof THREE.Quaternion !== 'function') return false;

  const boneName = HAVOC_EQUIPMENT_ATTACHMENT_CONFIG.activeHand === 'left'
    ? binding.leftAnchor
    : binding.rightAnchor;

  const bone = findHavocAttachmentBone(player, boneName);
  if (!bone) return false;

  const renderer = equipmentObject.get3DRendererObject();
  if (!renderer) return false;

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

  prepareHavocEquipmentRenderer(renderer);

  binding.modelAttached = true;
  binding.activeBone = bone.name || boneName;
  return true;
}

function ensureHavocBrawlerGauntletBinding(runtimeScene, player, equipmentObject) {
  const state = initializeHavocEquipmentAttachments(runtimeScene);
  const definition = getHavocEquipmentDefinition(
    HAVOC_EQUIPMENT_ATTACHMENT_CONFIG.testItemId
  );
  if (!definition) {
    console.warn(
      '[Havoc Equipment] Missing definition:',
      HAVOC_EQUIPMENT_ATTACHMENT_CONFIG.testItemId
    );
    return null;
  }

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
    console.warn(
      '[Havoc Equipment] Model object mismatch:',
      binding.modelObjectName,
      equipmentObject.getName()
    );
    return null;
  }

  return binding || null;
}

function updateHavocEquipmentAttachments(runtimeScene) {
  if (!runtimeScene) return;

  const state = initializeHavocEquipmentAttachments(runtimeScene);
  const players = runtimeScene.getObjects(
    HAVOC_EQUIPMENT_ATTACHMENT_CONFIG.playerObjectName
  );
  const player = players && players[0];
  let equipmentObject = runtimeScene.getObjects('IronGauntlet')[0] || null;

  if (!player) {
    if (!state.warnedMissingPlayer) {
      state.warnedMissingPlayer = true;
      console.warn('[Havoc Equipment] Character object not found.');
    }
    return;
  }

  if (!equipmentObject && typeof runtimeScene.createObject === 'function') {
    equipmentObject = runtimeScene.createObject('IronGauntlet');
  }

  if (!equipmentObject) {
    if (!state.warnedMissingModel) {
      state.warnedMissingModel = true;
      console.warn('[Havoc Equipment] Unable to create IronGauntlet runtime instance.');
    }
    return;
  }

  state.warnedMissingPlayer = false;
  state.warnedMissingModel = false;

  const renderer = typeof equipmentObject.get3DRendererObject === 'function'
    ? equipmentObject.get3DRendererObject()
    : null;

  if (!renderer) {
    if (!state.warnedRenderer) {
      state.warnedRenderer = true;
      console.warn('[Havoc Equipment] IronGauntlet renderer is not ready yet.');
    }
    return;
  }

  state.warnedRenderer = false;

  const binding = ensureHavocBrawlerGauntletBinding(
    runtimeScene,
    player,
    equipmentObject
  );
  if (!binding) return;

  const synced = syncHavocEquipmentToBone(
    player,
    equipmentObject,
    binding
  );

  if (!synced) {
    binding.modelAttached = false;
    binding.activeBone = null;

    if (!state.warnedMissingBone) {
      state.warnedMissingBone = true;
      console.warn(
        '[Havoc Equipment] Brawler hand bone not found:',
        HAVOC_EQUIPMENT_ATTACHMENT_CONFIG.activeHand === 'left'
          ? binding.leftAnchor
          : binding.rightAnchor
      );
    }
    return;
  }

  state.warnedMissingBone = false;
}
