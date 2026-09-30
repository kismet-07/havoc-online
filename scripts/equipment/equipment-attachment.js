/**
 * Character equipment attachment contract and runtime binding state.
 *
 * Equipment remains a GDevelop Model3D object. The imported GLTF visual is
 * detached from the GDevelop wrapper and parented directly to the character
 * hand bone. GDevelop continues to own the resource/object lifecycle.
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
    activeBone: null,
    visualRoot: null,
    originalParent: null,
    baseScale: null,
    baseQuaternion: null,
    baseVisualPosition: null,
    baseVisualQuaternion: null,
    baseVisualScale: null,
    standaloneSize: null,
    fitScale: 1,
  };

  return true;
}

function detachHavocEquipmentVisual(binding) {
  if (!binding || !binding.visualRoot) return false;

  const visualRoot = binding.visualRoot;
  const originalParent = binding.originalParent;

  if (visualRoot.parent) visualRoot.parent.remove(visualRoot);

  if (originalParent && typeof originalParent.add === 'function') {
    originalParent.add(visualRoot);
    visualRoot.position.set(0, 0, 0);
    if (binding.baseVisualPosition) visualRoot.position.copy(binding.baseVisualPosition);
    if (binding.baseVisualQuaternion) visualRoot.quaternion.copy(binding.baseVisualQuaternion);
    if (binding.baseVisualScale) visualRoot.scale.copy(binding.baseVisualScale);
    visualRoot.matrixAutoUpdate = true;
    if (typeof visualRoot.updateMatrixWorld === 'function') {
      visualRoot.updateMatrixWorld(true);
    }
  }

  binding.visualRoot = null;
  binding.originalParent = null;
  binding.modelAttached = false;
  binding.rendererParented = false;
  binding.activeBone = null;
  binding.baseVisualPosition = null;
  binding.baseVisualQuaternion = null;
  binding.baseVisualScale = null;
  binding.standaloneSize = null;
  binding.fitScale = 1;
  return true;
}

function detachHavocEquipmentInstance(runtimeScene, itemInstanceId) {
  if (!runtimeScene || !itemInstanceId) return false;

  const state = initializeHavocEquipmentAttachments(runtimeScene);
  const binding = state.bindings[itemInstanceId];
  if (!binding) return false;

  detachHavocEquipmentVisual(binding);
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

  if (typeof root.updateMatrixWorld === 'function') root.updateMatrixWorld(true);

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
    if (candidates.has(normalizeHavocBoneName(node.name))) matchedBone = node;
  });

  return matchedBone;
}

function prepareHavocEquipmentVisual(visualRoot) {
  if (!visualRoot) return false;

  visualRoot.visible = true;

  if (typeof visualRoot.traverse === 'function') {
    visualRoot.traverse((node) => {
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

function captureHavocEquipmentBaseTransform(equipmentRendererObject, binding) {
  if (!equipmentRendererObject || !binding) return false;
  if (binding.baseScale && binding.baseQuaternion) return true;
  if (!equipmentRendererObject.scale || !equipmentRendererObject.quaternion) return false;

  binding.baseScale = equipmentRendererObject.scale.clone();
  binding.baseQuaternion = equipmentRendererObject.quaternion.clone();
  return true;
}

function captureHavocEquipmentVisualTransform(visualRoot, renderer, binding) {
  if (!visualRoot || !renderer || !binding) return false;
  if (binding.baseVisualScale && binding.standaloneSize) return true;

  binding.baseVisualPosition = visualRoot.position.clone();
  binding.baseVisualQuaternion = visualRoot.quaternion.clone();
  binding.baseVisualScale = visualRoot.scale.clone();

  if (typeof renderer.updateWorldMatrix === 'function') {
    renderer.updateWorldMatrix(true, true);
  } else if (typeof renderer.updateMatrixWorld === 'function') {
    renderer.updateMatrixWorld(true);
  }

  if (typeof THREE !== 'undefined' && THREE.Box3 && THREE.Vector3) {
    const box = new THREE.Box3().setFromObject(visualRoot, true);
    const size = new THREE.Vector3();
    box.getSize(size);
    binding.standaloneSize = size;
  }

  return !!binding.standaloneSize;
}

function getHavocAttachmentSegmentLength(bone) {
  if (!bone || !bone.parent || typeof THREE === 'undefined') return 0;

  const bonePosition = new THREE.Vector3();
  const parentPosition = new THREE.Vector3();

  if (typeof bone.getWorldPosition === 'function') {
    bone.getWorldPosition(bonePosition);
  }
  if (typeof bone.parent.getWorldPosition === 'function') {
    bone.parent.getWorldPosition(parentPosition);
  }

  return bonePosition.distanceTo(parentPosition);
}

function getHavocHandCoverageLocalPosition(bone) {
  if (!bone || typeof THREE === 'undefined' || !THREE.Vector3) return new THREE.Vector3(0, 0, 0);
  if (!bone.children || typeof bone.getWorldPosition !== 'function' || typeof bone.worldToLocal !== 'function') {
    return new THREE.Vector3(0, 0, 0);
  }

  const handWorld = new THREE.Vector3();
  const fingerBasesWorld = new THREE.Vector3();
  let fingerCount = 0;

  bone.getWorldPosition(handWorld);

  bone.children.forEach((child) => {
    if (!child || !child.name || typeof child.getWorldPosition !== 'function') return;
    const normalized = normalizeHavocBoneName(child.name);
    if (!normalized.includes('hand')) return;
    if (!/(thumb|index|middle|ring|pinky)/.test(normalized)) return;

    const childWorld = new THREE.Vector3();
    child.getWorldPosition(childWorld);
    fingerBasesWorld.add(childWorld);
    fingerCount += 1;
  });

  if (fingerCount === 0) return new THREE.Vector3(0, 0, 0);

  fingerBasesWorld.multiplyScalar(1 / fingerCount);

  /* Place the gauntlet root at the palm midpoint between wrist and finger bases. */
  const palmWorld = handWorld.clone().lerp(fingerBasesWorld, 0.5);
  return bone.worldToLocal(palmWorld);
}

function orientHavocEquipmentAlongForearm(visualRoot, binding, bone) {
  if (!visualRoot || !binding || !binding.baseVisualQuaternion || !bone || !bone.parent) return false;
  if (typeof THREE === 'undefined' || !THREE.Vector3 || !THREE.Quaternion) return false;
  if (typeof bone.getWorldPosition !== 'function' || typeof bone.parent.getWorldPosition !== 'function') return false;
  if (typeof bone.getWorldQuaternion !== 'function') return false;

  const handWorld = new THREE.Vector3();
  const parentWorld = new THREE.Vector3();
  const forearmDirectionWorld = new THREE.Vector3();
  const forearmDirectionLocal = new THREE.Vector3();
  const baseAxisLocal = new THREE.Vector3(0, 1, 0);
  const boneWorldQuaternion = new THREE.Quaternion();
  const inverseBoneWorldQuaternion = new THREE.Quaternion();
  const alignmentQuaternion = new THREE.Quaternion();
  const handRollQuaternion = new THREE.Quaternion();
  const desiredQuaternion = new THREE.Quaternion();

  bone.getWorldPosition(handWorld);
  bone.parent.getWorldPosition(parentWorld);
  forearmDirectionWorld.subVectors(handWorld, parentWorld);

  if (forearmDirectionWorld.lengthSq() <= 1e-10) return false;
  forearmDirectionWorld.normalize();

  bone.getWorldQuaternion(boneWorldQuaternion);
  inverseBoneWorldQuaternion.copy(boneWorldQuaternion).invert();
  forearmDirectionLocal.copy(forearmDirectionWorld).applyQuaternion(inverseBoneWorldQuaternion).normalize();

  baseAxisLocal.applyQuaternion(binding.baseVisualQuaternion).normalize();
  alignmentQuaternion.setFromUnitVectors(baseAxisLocal, forearmDirectionLocal);

  const rollAngle = HAVOC_EQUIPMENT_ATTACHMENT_CONFIG.activeHand === 'left'
    ? Math.PI / 2
    : -Math.PI / 2;
  handRollQuaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rollAngle);
  desiredQuaternion
    .copy(alignmentQuaternion)
    .multiply(binding.baseVisualQuaternion)
    .multiply(handRollQuaternion)
    .normalize();

  visualRoot.quaternion.copy(desiredQuaternion);
  return true;
}

function setHavocEquipmentVisualVisibility(equipmentObject, visualRoot) {
  if (!visualRoot) return;

  let visible = true;
  if (equipmentObject && typeof equipmentObject.isHidden === 'function') {
    visible = !equipmentObject.isHidden();
  }

  visualRoot.visible = visible;
}

function attachHavocEquipmentVisualToBone(equipmentObject, binding, bone) {
  if (!equipmentObject || !binding || !bone) return false;
  if (typeof equipmentObject.get3DRendererObject !== 'function') return false;

  const renderer = equipmentObject.get3DRendererObject();
  if (!renderer || typeof renderer.add !== 'function') return false;

  if (!captureHavocEquipmentBaseTransform(renderer, binding)) return false;

  let visualRoot = binding.visualRoot;
  const loadedChild = renderer.children && renderer.children.length > 0
    ? renderer.children[0]
    : null;

  if (loadedChild && loadedChild !== visualRoot) {
    if (visualRoot && visualRoot.parent) visualRoot.parent.remove(visualRoot);
    visualRoot = loadedChild;
    binding.visualRoot = visualRoot;
    binding.originalParent = renderer;
    captureHavocEquipmentVisualTransform(visualRoot, renderer, binding);
  }

  if (!visualRoot || !binding.baseVisualScale || !binding.standaloneSize) return false;

  if (visualRoot.parent !== bone) {
    if (visualRoot.parent) visualRoot.parent.remove(visualRoot);
    bone.add(visualRoot);
  }

  visualRoot.position.copy(getHavocHandCoverageLocalPosition(bone));
  visualRoot.quaternion.copy(binding.baseVisualQuaternion);
  orientHavocEquipmentAlongForearm(visualRoot, binding, bone);
  visualRoot.scale.copy(binding.baseVisualScale);
  visualRoot.matrixAutoUpdate = true;

  if (typeof bone.updateWorldMatrix === 'function') {
    bone.updateWorldMatrix(true, true, true);
  } else if (typeof bone.updateMatrixWorld === 'function') {
    bone.updateMatrixWorld(true);
  }

  if (typeof THREE !== 'undefined' && THREE.Box3 && THREE.Vector3) {
    const currentBox = new THREE.Box3().setFromObject(visualRoot, true);
    const currentSize = new THREE.Vector3();
    currentBox.getSize(currentSize);

    const currentLongest = Math.max(currentSize.x, currentSize.y, currentSize.z);
    const segmentLength = getHavocAttachmentSegmentLength(bone);
    const standaloneLongest = Math.max(
      binding.standaloneSize.x,
      binding.standaloneSize.y,
      binding.standaloneSize.z
    );

    if (currentLongest > 0 && segmentLength > 0 && standaloneLongest > 0) {
      const targetScale = segmentLength / standaloneLongest;
      const parentCompensation = targetScale / (currentLongest / standaloneLongest);
      visualRoot.scale.multiplyScalar(parentCompensation);
      binding.fitScale = targetScale;
    }
  }

  prepareHavocEquipmentVisual(visualRoot);
  setHavocEquipmentVisualVisibility(equipmentObject, visualRoot);

  if (typeof visualRoot.updateMatrixWorld === 'function') {
    visualRoot.updateMatrixWorld(true);
  }

  binding.modelAttached = true;
  binding.rendererParented = true;
  binding.activeBone = bone.name || null;
  return true;
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

function cleanupHavocDetachedEquipment(runtimeScene, equipmentObject) {
  const state = initializeHavocEquipmentAttachments(runtimeScene);
  const binding = state.bindings[HAVOC_EQUIPMENT_ATTACHMENT_CONFIG.testInstanceId];
  if (!binding || !binding.visualRoot) return;

  const renderer = equipmentObject && typeof equipmentObject.get3DRendererObject === 'function'
    ? equipmentObject.get3DRendererObject()
    : null;

  if (!renderer && binding.visualRoot.parent) {
    binding.visualRoot.parent.remove(binding.visualRoot);
    binding.visualRoot = null;
    binding.originalParent = null;
    binding.modelAttached = false;
    binding.rendererParented = false;
    binding.activeBone = null;
  }
}

function updateHavocEquipmentAttachments(runtimeScene) {
  if (!runtimeScene) return;

  const state = initializeHavocEquipmentAttachments(runtimeScene);
  const players = runtimeScene.getObjects(HAVOC_EQUIPMENT_ATTACHMENT_CONFIG.playerObjectName);
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
    cleanupHavocDetachedEquipment(runtimeScene, null);
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

  const binding = ensureHavocBrawlerGauntletBinding(runtimeScene, player, equipmentObject);
  if (!binding) return;

  const boneName = HAVOC_EQUIPMENT_ATTACHMENT_CONFIG.activeHand === 'left'
    ? binding.leftAnchor
    : binding.rightAnchor;
  const bone = findHavocAttachmentBone(player, boneName);

  if (!bone) {
    binding.activeBone = null;
    binding.modelAttached = false;
    if (!state.warnedMissingBone) {
      state.warnedMissingBone = true;
      console.warn('[Havoc Equipment] Hand bone not found:', boneName);
    }
    return;
  }

  const synced = attachHavocEquipmentVisualToBone(equipmentObject, binding, bone);

  if (!synced && !state.warnedAttachFailure) {
    state.warnedAttachFailure = true;
    console.warn('[Havoc Equipment] GLTF visual is not loaded yet. Waiting for GDevelop model load.');
  }

  if (synced) {
    state.warnedMissingBone = false;
    state.warnedAttachFailure = false;
  }
}
