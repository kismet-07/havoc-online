/**
 * Character equipment attachment contract and runtime binding state.
 *
 * Equipment uses a standalone GDevelop 3D Model object. Its renderer is
 * parented to the animated Mixamo hand bone. The GDevelop object itself is
 * kept at the player position so its normal visibility/culling system still
 * considers the equipment near the player.
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
    sizeApplied: false,
    rendererParented: false,
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

function applyHavocEquipmentModelSize(equipmentObject, definition, binding) {
  if (!equipmentObject || !definition || !definition.defaultSize || binding.sizeApplied) return;

  const size = definition.defaultSize;
  if (typeof equipmentObject.setWidth === 'function') equipmentObject.setWidth(size.width);
  if (typeof equipmentObject.setHeight === 'function') equipmentObject.setHeight(size.height);
  if (typeof equipmentObject.setDepth === 'function') equipmentObject.setDepth(size.depth);

  binding.sizeApplied = true;
}

function attachHavocEquipmentRendererToBone(runtimeScene, player, equipmentObject, binding) {
  if (!player || !equipmentObject || !binding) return false;
  if (typeof player.get3DRendererObject !== 'function') return false;
  if (typeof equipmentObject.get3DRendererObject !== 'function') return false;

  const boneName = HAVOC_EQUIPMENT_ATTACHMENT_CONFIG.activeHand === 'left'
    ? binding.leftAnchor
    : binding.rightAnchor;
  const bone = findHavocAttachmentBone(player, boneName);
  if (!bone || typeof bone.add !== 'function') return false;

  const equipmentRendererObject = equipmentObject.get3DRendererObject();
  if (!equipmentRendererObject) return false;

  /*
   * Keep the runtime object's scene-space position on the player. GDevelop
   * uses the runtime object's AABB for visibility culling. The actual model
   * renderer is then placed at the hand as a child of the bone.
   */
  if (typeof equipmentObject.setX === 'function' && typeof player.getX === 'function') {
    equipmentObject.setX(player.getX());
  }
  if (typeof equipmentObject.setY === 'function' && typeof player.getY === 'function') {
    equipmentObject.setY(player.getY());
  }
  if (typeof equipmentObject.setZ === 'function' && typeof player.getZ === 'function') {
    equipmentObject.setZ(player.getZ());
  }

  if (equipmentRendererObject.parent !== bone) {
    bone.add(equipmentRendererObject);
  }

  /* GDevelop updates the model renderer from its own object transform.
   * Reset that transform after parenting so the bone is the sole positional
   * parent and the equipment offsets remain local to the hand.
   */
  if (equipmentRendererObject.position && typeof equipmentRendererObject.position.set === 'function') {
    equipmentRendererObject.position.set(
      HAVOC_EQUIPMENT_ATTACHMENT_CONFIG.positionOffset.x,
      HAVOC_EQUIPMENT_ATTACHMENT_CONFIG.positionOffset.y,
      HAVOC_EQUIPMENT_ATTACHMENT_CONFIG.positionOffset.z
    );
  }

  if (equipmentRendererObject.rotation && typeof equipmentRendererObject.rotation.set === 'function') {
    const degreesToRadians = Math.PI / 180;
    equipmentRendererObject.rotation.set(
      HAVOC_EQUIPMENT_ATTACHMENT_CONFIG.rotationOffsetDegrees.x * degreesToRadians,
      HAVOC_EQUIPMENT_ATTACHMENT_CONFIG.rotationOffsetDegrees.y * degreesToRadians,
      HAVOC_EQUIPMENT_ATTACHMENT_CONFIG.rotationOffsetDegrees.z * degreesToRadians
    );
  }

  if (typeof equipmentObject.hide === 'function') equipmentObject.hide(false);
  equipmentRendererObject.visible = true;

  binding.modelAttached = true;
  binding.rendererParented = true;
  binding.activeBone = bone.name || boneName;
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
    console.warn(
      '[Havoc Equipment] Model object mismatch:',
      binding.modelObjectName,
      equipmentObject.getName()
    );
    return null;
  }

  applyHavocEquipmentModelSize(equipmentObject, definition, binding);
  return binding || null;
}

function updateHavocEquipmentAttachments(runtimeScene) {
  if (!runtimeScene) return;

  const state = initializeHavocEquipmentAttachments(runtimeScene);
  const players = runtimeScene.getObjects(HAVOC_EQUIPMENT_ATTACHMENT_CONFIG.playerObjectName);
  let equipmentObjects = runtimeScene.getObjects('IronGauntlet');

  const player = players && players[0];
  let equipmentObject = equipmentObjects && equipmentObjects[0];

  if (!player) {
    if (!state.warnedMissingPlayer) {
      state.warnedMissingPlayer = true;
      console.warn('[Havoc Equipment] Character object not found.');
    }
    return;
  }

  if (!equipmentObject && typeof runtimeScene.createObject === 'function') {
    equipmentObject = runtimeScene.createObject('IronGauntlet');
    equipmentObjects = equipmentObject ? [equipmentObject] : [];
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

  const binding = ensureHavocBrawlerGauntletBinding(runtimeScene, player, equipmentObject);
  if (!binding) return;

  const synced = attachHavocEquipmentRendererToBone(
    runtimeScene,
    player,
    equipmentObject,
    binding
  );

  if (!synced && !state.warnedAttachFailure) {
    state.warnedAttachFailure = true;
    console.warn(
      '[Havoc Equipment] Renderer attachment failed.',
      'object=', equipmentObject.getName ? equipmentObject.getName() : null,
      'renderer=', typeof equipmentObject.get3DRendererObject === 'function'
        ? !!equipmentObject.get3DRendererObject()
        : false,
      'bone=', HAVOC_EQUIPMENT_ATTACHMENT_CONFIG.activeHand === 'left'
        ? binding.leftAnchor
        : binding.rightAnchor
    );
  }

  if (synced) state.warnedAttachFailure = false;
}
