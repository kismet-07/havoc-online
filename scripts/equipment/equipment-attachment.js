/**
 * Character equipment attachment contract and runtime binding state.
 *
 * Equipment remains a normal GDevelop Model3D object. The attachment runtime
 * updates the renderer in the renderer parent's LOCAL coordinate space from
 * the character hand bone's WORLD transform. It does not parent the renderer
 * to the skeleton and does not feed raw Three.js world coordinates back into
 * GDevelop's object transform setters.
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
  activeHand: 'right',
  // Offset is expressed in the gauntlet's attachment-local axes, not in
  // renderer/world axes. This keeps the correction locked to the hand during
  // animation instead of introducing a world-space drift.
  positionOffset: Object.freeze({ x: 0, y: -8, z: 0 }),
  // The gauntlet reaches the correct hand but its local facing is reversed.
  // Rotate around the local X axis so the gauntlet's top and bottom are inverted.
  rotationOffsetDegrees: Object.freeze({ x: 180, y: 0, z: 0 }),
  // Keep the existing model enlargement that was visually confirmed in-game.
  scaleMultiplier: 1.10,
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
      warnedAttachFailure: false,
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
    rendererParented: false,
    baseTransformCaptured: false,
    baseScale: null,
    baseQuaternion: null,
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
  return String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
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

function prepareHavocEquipmentRenderer(equipmentRendererObject) {
  if (!equipmentRendererObject) return false;

  equipmentRendererObject.visible = true;

  if (typeof equipmentRendererObject.traverse === 'function') {
    equipmentRendererObject.traverse((node) => {
      if (!node) return;
      if (node.isMesh) {
        node.frustumCulled = false;
        node.visible = true;
        if (node.geometry && typeof node.geometry.computeBoundingSphere === 'function') {
          node.geometry.computeBoundingSphere();
        }
      }
    });
  }

  return true;
}

function captureHavocEquipmentBaseTransform(equipmentObject, equipmentRendererObject, binding) {
  if (!equipmentObject || !equipmentRendererObject || !binding || binding.baseTransformCaptured) return false;
  if (!equipmentRendererObject.scale || !equipmentRendererObject.quaternion) return false;

  binding.baseScale = {
    x: equipmentRendererObject.scale.x,
    y: equipmentRendererObject.scale.y,
    z: equipmentRendererObject.scale.z,
  };

  if (typeof equipmentRendererObject.quaternion.clone === 'function') {
    binding.baseQuaternion = equipmentRendererObject.quaternion.clone();
  } else {
    binding.baseQuaternion = null;
  }

  binding.baseTransformCaptured = true;
  return true;
}

function applyHavocEquipmentWorldTransform(equipmentObject, binding, bone) {
  if (!equipmentObject || !binding || !bone) return false;
  if (typeof equipmentObject.get3DRendererObject !== 'function') return false;
  if (typeof THREE === 'undefined' ||
      typeof THREE.Matrix4 !== 'function' ||
      typeof THREE.Vector3 !== 'function' ||
      typeof THREE.Quaternion !== 'function' ||
      typeof THREE.Euler !== 'function') {
    return false;
  }

  const equipmentRendererObject = equipmentObject.get3DRendererObject();
  if (!equipmentRendererObject || !equipmentRendererObject.position || !equipmentRendererObject.quaternion) {
    return false;
  }

  if (typeof bone.updateWorldMatrix === 'function') {
    bone.updateWorldMatrix(true, false);
  } else if (typeof bone.updateMatrixWorld === 'function') {
    bone.updateMatrixWorld(true);
  }

  if (!bone.matrixWorld) return false;

  const parent = equipmentRendererObject.parent || null;
  if (parent && typeof parent.updateMatrixWorld === 'function') {
    parent.updateMatrixWorld(true);
  }

  const localMatrix = bone.matrixWorld.clone();
  if (parent && parent.matrixWorld) {
    const parentInverse = new THREE.Matrix4().copy(parent.matrixWorld).invert();
    localMatrix.premultiply(parentInverse);
  }

  const localPosition = new THREE.Vector3();
  const localQuaternion = new THREE.Quaternion();
  const localScale = new THREE.Vector3();
  localMatrix.decompose(localPosition, localQuaternion, localScale);

  const finalQuaternion = localQuaternion.clone();
  if (binding.baseQuaternion) {
    finalQuaternion.multiply(binding.baseQuaternion);
  }

  const offsetEuler = new THREE.Euler(
    HAVOC_EQUIPMENT_ATTACHMENT_CONFIG.rotationOffsetDegrees.x * Math.PI / 180,
    HAVOC_EQUIPMENT_ATTACHMENT_CONFIG.rotationOffsetDegrees.y * Math.PI / 180,
    HAVOC_EQUIPMENT_ATTACHMENT_CONFIG.rotationOffsetDegrees.z * Math.PI / 180,
    'ZYX'
  );
  finalQuaternion.multiply(new THREE.Quaternion().setFromEuler(offsetEuler));

  equipmentRendererObject.position.copy(localPosition);
  equipmentRendererObject.quaternion.copy(finalQuaternion);

  if (binding.baseScale && equipmentRendererObject.scale) {
    const scaleMultiplier = HAVOC_EQUIPMENT_ATTACHMENT_CONFIG.scaleMultiplier;
    equipmentRendererObject.scale.set(
      binding.baseScale.x * scaleMultiplier,
      binding.baseScale.y * scaleMultiplier,
      binding.baseScale.z * scaleMultiplier
    );
  }

  // Apply the correction in the gauntlet's final local orientation. This is
  // deliberately after the rotation correction, so the offset follows the
  // hand/gauntlet rather than the scene axes.
  const localOffset = new THREE.Vector3(
    HAVOC_EQUIPMENT_ATTACHMENT_CONFIG.positionOffset.x,
    HAVOC_EQUIPMENT_ATTACHMENT_CONFIG.positionOffset.y,
    HAVOC_EQUIPMENT_ATTACHMENT_CONFIG.positionOffset.z
  );
  localOffset.applyQuaternion(finalQuaternion);
  equipmentRendererObject.position.add(localOffset);

  prepareHavocEquipmentRenderer(equipmentRendererObject);

  if (typeof equipmentRendererObject.updateMatrixWorld === 'function') {
    equipmentRendererObject.updateMatrixWorld(true);
  }

  return true;
}

function attachHavocEquipmentRendererToBone(runtimeScene, player, equipmentObject, binding) {
  if (!runtimeScene || !player || !equipmentObject || !binding) return false;
  if (typeof player.get3DRendererObject !== 'function') return false;
  if (typeof equipmentObject.get3DRendererObject !== 'function') return false;

  const boneName = HAVOC_EQUIPMENT_ATTACHMENT_CONFIG.activeHand === 'left'
    ? binding.leftAnchor
    : binding.rightAnchor;
  const bone = findHavocAttachmentBone(player, boneName);
  if (!bone) {
    binding.activeBone = null;
    binding.modelAttached = false;
    return false;
  }

  const equipmentRendererObject = equipmentObject.get3DRendererObject();
  if (!equipmentRendererObject) return false;

  if (!binding.baseTransformCaptured && !captureHavocEquipmentBaseTransform(equipmentObject, equipmentRendererObject, binding)) {
    return false;
  }

  if (typeof equipmentObject.hide === 'function') equipmentObject.hide(false);
  prepareHavocEquipmentRenderer(equipmentRendererObject);

  const synced = applyHavocEquipmentWorldTransform(equipmentObject, binding, bone);
  binding.modelAttached = synced;
  binding.rendererParented = false;
  binding.activeBone = bone.name || boneName;
  return synced;
}

function ensureHavocBrawlerGauntletBinding(runtimeScene, player, equipmentObject) {
  const state = initializeHavocEquipmentAttachments(runtimeScene);
  const definition = getHavocEquipmentDefinition(HAVOC_EQUIPMENT_ATTACHMENT_CONFIG.testItemId);
  if (!definition) {
    console.warn('[Havoc Equipment] Missing definition:', HAVOC_EQUIPMENT_ATTACHMENT_CONFIG.testItemId);
    return null;
  }

  const instanceId = HAVOC_EQUIPMENT_ATTACHMENT_CONFIG.testInstanceId;
  let binding = state.bindings[instanceId];

  if (!binding) {
    const instance = createHavocEquipmentInstance(HAVOC_EQUIPMENT_ATTACHMENT_CONFIG.testItemId, 0);
    if (!instance) return null;
    instance.instanceId = instanceId;
    if (!attachHavocEquipmentInstance(runtimeScene, player, instance)) return null;
    binding = state.bindings[instanceId];
  }

  if (binding && binding.modelObjectName !== equipmentObject.getName()) {
    console.warn('[Havoc Equipment] Model object mismatch:', binding.modelObjectName, equipmentObject.getName());
    return null;
  }

  return binding || null;
}

function updateHavocEquipmentAttachments(runtimeScene) {
  if (!runtimeScene) return;

  const state = initializeHavocEquipmentAttachments(runtimeScene);
  const players = runtimeScene.getObjects(HAVOC_EQUIPMENT_ATTACHMENT_CONFIG.playerObjectName);
  let equipmentObject = runtimeScene.getObjects('IronGauntlet')[0];
  const player = players && players[0];

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

  const rendererObject = typeof equipmentObject.get3DRendererObject === 'function'
    ? equipmentObject.get3DRendererObject()
    : null;

  if (!rendererObject) {
    if (!state.warnedAttachFailure) {
      state.warnedAttachFailure = true;
      console.warn('[Havoc Equipment] IronGauntlet exists but has no 3D renderer yet.');
    }
    return;
  }

  prepareHavocEquipmentRenderer(rendererObject);

  const binding = ensureHavocBrawlerGauntletBinding(runtimeScene, player, equipmentObject);
  if (!binding) return;

  const synced = attachHavocEquipmentRendererToBone(runtimeScene, player, equipmentObject, binding);

  if (!synced && !state.warnedMissingBone) {
    state.warnedMissingBone = true;
    console.warn('[Havoc Equipment] Right hand bone not found:', binding.rightAnchor);
  }

  if (synced) {
    state.warnedMissingBone = false;
    state.warnedAttachFailure = false;
  }
}
