/**
 * Character equipment attachment contract and runtime binding state.
 *
 * Equipment remains a normal GDevelop Model3D object. Its renderer is NOT
 * parented to the character skeleton because GDevelop owns the renderer's
 * transform. Instead, the renderer receives the hand bone's world transform
 * after GDevelop has updated the object for the current frame.
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
      diagnosticPrinted: false,
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

function applyHavocEquipmentModelSize(equipmentObject, definition, binding) {
  if (!equipmentObject || !definition || !definition.defaultSize || binding.sizeApplied) return;

  const size = definition.defaultSize;
  if (typeof equipmentObject.setWidth === 'function') equipmentObject.setWidth(size.width);
  if (typeof equipmentObject.setHeight === 'function') equipmentObject.setHeight(size.height);
  if (typeof equipmentObject.setDepth === 'function') equipmentObject.setDepth(size.depth);

  binding.sizeApplied = true;
}

function captureHavocEquipmentBaseTransform(equipmentRendererObject, binding) {
  if (!equipmentRendererObject || !binding || binding.baseTransformCaptured) return false;
  if (!equipmentRendererObject.scale || !equipmentRendererObject.quaternion) return false;

  binding.baseScale = {
    x: equipmentRendererObject.scale.x,
    y: equipmentRendererObject.scale.y,
    z: equipmentRendererObject.scale.z,
  };
  binding.baseQuaternion = {
    x: equipmentRendererObject.quaternion.x,
    y: equipmentRendererObject.quaternion.y,
    z: equipmentRendererObject.quaternion.z,
    w: equipmentRendererObject.quaternion.w,
  };
  binding.baseTransformCaptured = true;
  return true;
}

function applyHavocEquipmentWorldTransform(player, equipmentObject, binding, bone) {
  if (!equipmentObject || !binding || !bone) return false;
  if (typeof equipmentObject.get3DRendererObject !== 'function') return false;

  const equipmentRendererObject = equipmentObject.get3DRendererObject();
  if (!equipmentRendererObject) return false;
  if (!equipmentRendererObject.position || !equipmentRendererObject.quaternion || !equipmentRendererObject.scale) return false;
  if (!binding.baseTransformCaptured) return false;

  if (typeof bone.updateWorldMatrix === 'function') {
    bone.updateWorldMatrix(true, false);
  } else if (typeof bone.updateMatrixWorld === 'function') {
    bone.updateMatrixWorld(true);
  }

  if (!bone.matrixWorld || typeof equipmentRendererObject.position.setFromMatrixPosition !== 'function') {
    return false;
  }

  equipmentRendererObject.position.setFromMatrixPosition(bone.matrixWorld);

  if (bone.matrixWorld.decompose && equipmentRendererObject.quaternion.setFromRotationMatrix) {
    const matrixScale = equipmentRendererObject.scale && typeof equipmentRendererObject.scale.clone === 'function'
      ? equipmentRendererObject.scale.clone()
      : null;
    if (matrixScale) {
      bone.matrixWorld.decompose(
        equipmentRendererObject.position,
        equipmentRendererObject.quaternion,
        matrixScale
      );
    } else {
      equipmentRendererObject.quaternion.setFromRotationMatrix(bone.matrixWorld);
    }
  } else if (typeof bone.getWorldQuaternion === 'function') {
    const worldQuaternion = equipmentRendererObject.quaternion.clone();
    bone.getWorldQuaternion(worldQuaternion);
    equipmentRendererObject.quaternion.copy(worldQuaternion);
  } else {
    return false;
  }

  equipmentRendererObject.position.x += HAVOC_EQUIPMENT_ATTACHMENT_CONFIG.positionOffset.x;
  equipmentRendererObject.position.y += HAVOC_EQUIPMENT_ATTACHMENT_CONFIG.positionOffset.y;
  equipmentRendererObject.position.z += HAVOC_EQUIPMENT_ATTACHMENT_CONFIG.positionOffset.z;

  equipmentRendererObject.scale.set(
    binding.baseScale.x,
    binding.baseScale.y,
    binding.baseScale.z
  );

  if (typeof equipmentRendererObject.rotateX === 'function' && HAVOC_EQUIPMENT_ATTACHMENT_CONFIG.rotationOffsetDegrees.x) {
    equipmentRendererObject.rotateX(HAVOC_EQUIPMENT_ATTACHMENT_CONFIG.rotationOffsetDegrees.x * Math.PI / 180);
  }
  if (typeof equipmentRendererObject.rotateY === 'function' && HAVOC_EQUIPMENT_ATTACHMENT_CONFIG.rotationOffsetDegrees.y) {
    equipmentRendererObject.rotateY(HAVOC_EQUIPMENT_ATTACHMENT_CONFIG.rotationOffsetDegrees.y * Math.PI / 180);
  }
  if (typeof equipmentRendererObject.rotateZ === 'function' && HAVOC_EQUIPMENT_ATTACHMENT_CONFIG.rotationOffsetDegrees.z) {
    equipmentRendererObject.rotateZ(HAVOC_EQUIPMENT_ATTACHMENT_CONFIG.rotationOffsetDegrees.z * Math.PI / 180);
  }

  return true;
}

function updateHavocGauntletDiagnostic(runtimeScene) {
  if (!runtimeScene) return;
  let diagnosticObject = runtimeScene.getObjects('GauntletDiagnostic')[0];
  if (!diagnosticObject && typeof runtimeScene.createObject === 'function') {
    diagnosticObject = runtimeScene.createObject('GauntletDiagnostic');
  }
  if (!diagnosticObject) return;

  const state = runtimeScene.__havocEquipmentAttachments;
  const player = runtimeScene.getObjects('Character')[0];
  const gauntlet = runtimeScene.getObjects('IronGauntlet')[0];
  const binding = state && state.bindings
    ? state.bindings.brawler_starter_gauntlets_test
    : null;
  const bone = player && binding
    ? findHavocAttachmentBone(player, binding.rightAnchor)
    : null;
  const definition = getHavocEquipmentDefinition(HAVOC_EQUIPMENT_ATTACHMENT_CONFIG.testItemId);
  const playerRenderer = player && typeof player.get3DRendererObject === 'function'
    ? player.get3DRendererObject()
    : null;
  const gauntletRenderer = gauntlet && typeof gauntlet.get3DRendererObject === 'function'
    ? gauntlet.get3DRendererObject()
    : null;

  const lines = [
    'GAUNTLET DIAGNOSTIC',
    'Character: ' + (player ? 'FOUND' : 'MISSING'),
    'Character renderer: ' + (playerRenderer ? 'FOUND' : 'MISSING'),
    'IronGauntlet: ' + (gauntlet ? 'FOUND' : 'MISSING'),
    'Gauntlet renderer: ' + (gauntletRenderer ? 'FOUND' : 'MISSING'),
    'Definition: ' + (definition ? 'FOUND' : 'MISSING'),
    'Item ID: ' + HAVOC_EQUIPMENT_ATTACHMENT_CONFIG.testItemId,
    'Model object: ' + (binding ? binding.modelObjectName : 'NONE'),
    'Model resource: ' + (binding ? binding.modelId : 'NONE'),
    'Requested bone: ' + (binding ? binding.rightAnchor : 'mixamorig:RightHand'),
    'RightHand: ' + (bone ? 'FOUND' : 'MISSING'),
    'Actual bone: ' + (bone && bone.name ? bone.name : 'NONE'),
    'MatrixWorld: ' + (bone && bone.matrixWorld ? 'OK' : 'MISSING'),
    'Base transform: ' + (binding && binding.baseTransformCaptured ? 'OK' : 'MISSING'),
    'Transform applied: ' + (binding && binding.modelAttached ? 'YES' : 'NO'),
    'Renderer visible: ' + (gauntletRenderer && gauntletRenderer.visible ? 'YES' : 'NO'),
    'Scale: ' + (gauntletRenderer && gauntletRenderer.scale
      ? [gauntletRenderer.scale.x.toFixed(3), gauntletRenderer.scale.y.toFixed(3), gauntletRenderer.scale.z.toFixed(3)].join(', ')
      : 'NONE'),
    'Position: ' + (gauntletRenderer && gauntletRenderer.position
      ? [gauntletRenderer.position.x.toFixed(3), gauntletRenderer.position.y.toFixed(3), gauntletRenderer.position.z.toFixed(3)].join(', ')
      : 'NONE'),
  ];

  if (typeof diagnosticObject.setString === 'function') diagnosticObject.setString(lines.join('\n'));
  if (typeof diagnosticObject.setX === 'function') diagnosticObject.setX(20);
  if (typeof diagnosticObject.setY === 'function') diagnosticObject.setY(20);
  if (typeof diagnosticObject.setZOrder === 'function') diagnosticObject.setZOrder(100000);
}

function attachHavocEquipmentRendererToBone(runtimeScene, player, equipmentObject, binding) {
  if (!player || !equipmentObject || !binding) return false;
  if (typeof player.get3DRendererObject !== 'function') return false;
  if (typeof equipmentObject.get3DRendererObject !== 'function') return false;

  const boneName = HAVOC_EQUIPMENT_ATTACHMENT_CONFIG.activeHand === 'left'
    ? binding.leftAnchor
    : binding.rightAnchor;
  const bone = findHavocAttachmentBone(player, boneName);
  if (!bone) return false;

  const equipmentRendererObject = equipmentObject.get3DRendererObject();
  if (!equipmentRendererObject) return false;

  if (typeof equipmentObject.setX === 'function' && typeof player.getX === 'function') equipmentObject.setX(player.getX());
  if (typeof equipmentObject.setY === 'function' && typeof player.getY === 'function') equipmentObject.setY(player.getY());
  if (typeof equipmentObject.setZ === 'function' && typeof player.getZ === 'function') equipmentObject.setZ(player.getZ());

  if (!binding.baseTransformCaptured && !captureHavocEquipmentBaseTransform(equipmentRendererObject, binding)) return false;

  if (typeof equipmentObject.hide === 'function') equipmentObject.hide(false);
  equipmentRendererObject.visible = true;

  const synced = applyHavocEquipmentWorldTransform(player, equipmentObject, binding, bone);
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

  const synced = attachHavocEquipmentRendererToBone(runtimeScene, player, equipmentObject, binding);

  if (!state.diagnosticPrinted) {
    state.diagnosticPrinted = true;
    console.groupCollapsed('[Havoc Equipment] Gauntlet diagnostic');
    console.table(collectHavocEquipmentDiagnostic(runtimeScene, player, equipmentObject, binding));
    console.log('[Havoc Equipment] Binding:', binding);
    console.groupEnd();
  }

  if (!synced && !state.warnedAttachFailure) {
    state.warnedAttachFailure = true;
    console.warn('[Havoc Equipment] Renderer attachment failed.', 'object=', equipmentObject.getName ? equipmentObject.getName() : null, 'renderer=', typeof equipmentObject.get3DRendererObject === 'function' ? !!equipmentObject.get3DRendererObject() : false, 'bone=', HAVOC_EQUIPMENT_ATTACHMENT_CONFIG.activeHand === 'left' ? binding.leftAnchor : binding.rightAnchor);
  }

  if (synced) state.warnedAttachFailure = false;
}
