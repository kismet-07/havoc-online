/**
 * World-space target selection indicator and 3D target acquisition.
 *
 * Target selection uses the active 3D camera and a Three.js ray cast from the
 * desktop/mobile pointer position. This avoids RuntimeObject3D.cursorOnObject,
 * which is not reliable for our moving third-person 3D camera.
 *
 * The visual target indicator is a flat circular ground ring centered around
 * the selected mob's feet/base on the ground plane (XY), tracking the mob
 * dynamically while it moves.
 */
const HAVOC_TARGET_CONFIG = {
  mobObjectName: 'Killer_clown',
  indicatorObjectName: 'TargetSelectionIcon',
  // Ground ring radius and positioning:
  // Circles around the mob's feet flat on the floor (XY plane).
  ringInnerRadius: 200,
  ringOuterRadius: 240,
  ringGroundZOffset: 4,
  ringColor: 0xff2020,
  hiddenX: -100000,
  hiddenY: -100000,
};

function havocTargetDiagnosticObjectName(object) {
  if (!object) return null;
  try {
    if (typeof object.getName === 'function') return object.getName();
  } catch (e) {
    // Diagnostic helper only; never allow logging to affect gameplay.
  }
  return HAVOC_TARGET_CONFIG.mobObjectName;
}

function havocTargetLogState(runtimeScene, event, data) {
  const state = runtimeScene.__havocTargetSelection;
  if (!state) return;

  const target = state.indicatorTarget;
  const combat = runtimeScene.__havocBrawlerCombat;
  const ring = state.groundRingMesh;

  console.log('[Havoc Target][DIAG]', event, {
    ...data,
    combatTarget: combat && combat.target ? havocTargetDiagnosticObjectName(combat.target) : null,
    combatTargetDestroyed: !!(combat && combat.target && combat.target.isDestroyed),
    indicatorTarget: target ? havocTargetDiagnosticObjectName(target) : null,
    indicatorTargetDestroyed: !!(target && target.isDestroyed),
    ringExists: !!ring,
    ringVisible: ring ? ring.visible : false,
  });
}

function initializeHavocTargetSelection(runtimeScene) {
  if (!runtimeScene.__havocTargetSelection) {
    runtimeScene.__havocTargetSelection = {
      indicator: null,
      groundRingMesh: null,
      indicatorTarget: null,
      raycastLogged: false,
      indicatorLogged: false,
      indicatorConfigured: false,
      diagnosticLastTarget: null,
      diagnosticLastIndicatorVisible: null,
      diagnosticLastIndicatorTarget: null,
    };
  }

  const state = runtimeScene.__havocTargetSelection;

  // Keep legacy TargetSelectionIcon permanently parked and hidden offscreen.
  if (!state.indicator) {
    const objects = runtimeScene.getObjects(HAVOC_TARGET_CONFIG.indicatorObjectName);
    state.indicator = objects.length > 0 ? objects[0] : null;
  }

  if (state.indicator && !state.indicator.isDestroyed) {
    if (typeof state.indicator.hide === 'function') {
      state.indicator.hide(true);
    }
    if (typeof state.indicator.setPosition === 'function') {
      state.indicator.setPosition(HAVOC_TARGET_CONFIG.hiddenX, HAVOC_TARGET_CONFIG.hiddenY);
    }
  }

  return state;
}

function getHavocGroundRing(runtimeScene) {
  const state = initializeHavocTargetSelection(runtimeScene);
  const worldLayer = runtimeScene.getLayer('');
  if (!worldLayer || !worldLayer.getRenderer) return null;
  const layerRenderer = worldLayer.getRenderer();

  if (typeof THREE === 'undefined' || typeof THREE.RingGeometry !== 'function') {
    return null;
  }

  if (state.groundRingMesh) {
    if (state.groundRingMesh.parent) {
      return state.groundRingMesh;
    }
    if (typeof layerRenderer.add3DRendererObject === 'function') {
      layerRenderer.add3DRendererObject(state.groundRingMesh);
      return state.groundRingMesh;
    }
  }

  const innerRadius = HAVOC_TARGET_CONFIG.ringInnerRadius;
  const outerRadius = HAVOC_TARGET_CONFIG.ringOuterRadius;
  const group = new THREE.Group();

  // Primary outer circular ring (oriented in XY ground plane with Z=0)
  const ringGeo = new THREE.RingGeometry(innerRadius, outerRadius, 64);
  const ringMat = new THREE.MeshBasicMaterial({
    color: HAVOC_TARGET_CONFIG.ringColor,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1.0,
    polygonOffsetUnits: -1.0,
  });
  const ringMesh = new THREE.Mesh(ringGeo, ringMat);
  group.add(ringMesh);

  // Subtle translucent inner circle fill
  if (typeof THREE.CircleGeometry === 'function') {
    const innerGeo = new THREE.CircleGeometry(innerRadius, 64);
    const innerMat = new THREE.MeshBasicMaterial({
      color: HAVOC_TARGET_CONFIG.ringColor,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.15,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1.0,
      polygonOffsetUnits: -1.0,
    });
    const innerMesh = new THREE.Mesh(innerGeo, innerMat);
    group.add(innerMesh);
  }

  group.visible = false;
  group.position.set(HAVOC_TARGET_CONFIG.hiddenX, HAVOC_TARGET_CONFIG.hiddenY, 0);

  if (typeof layerRenderer.add3DRendererObject === 'function') {
    layerRenderer.add3DRendererObject(group);
  }

  state.groundRingMesh = group;
  return group;
}

function clearHavocTargetIndicator(runtimeScene, reason = 'unspecified') {
  const state = initializeHavocTargetSelection(runtimeScene);
  const ring = state.groundRingMesh;

  havocTargetLogState(runtimeScene, 'CLEAR_INDICATOR', { reason });

  if (ring) {
    ring.visible = false;
    ring.position.set(HAVOC_TARGET_CONFIG.hiddenX, HAVOC_TARGET_CONFIG.hiddenY, 0);
  }

  const indicator = state.indicator;
  if (indicator && !indicator.isDestroyed) {
    if (typeof indicator.setPosition === 'function') {
      indicator.setPosition(HAVOC_TARGET_CONFIG.hiddenX, HAVOC_TARGET_CONFIG.hiddenY);
    }
    if (typeof indicator.hide === 'function') {
      indicator.hide(true);
    }
  }

  state.indicatorTarget = null;
}

function getHavocTargetAnchorPosition(target) {
  // Use the mob's GDevelop 3D object coordinates directly.
  // In GDevelop 5's 3D runtime:
  // 1. Killer Clown's GDevelop coordinates are target.getX(), target.getY(), target.getZ().
  // 2. layerRenderer.add3DRendererObject() adds Three.js objects directly into layer._threeGroup.
  // 3. Inside _threeGroup, the local coordinate space IS the GDevelop coordinate system:
  //    threeGroup.position is (0,0,0) with scale (1,1,1).
  // 4. Do NOT use Three.js Box3 / setFromObject(): Box3 traverses into root scene world space,
  //    where GDevelop has _threeScene.scale.y = -1. That inverts world Y and corrupts Z,
  //    throwing the indicator thousands of units off the map!
  const x = target.getX();
  const y = target.getY();
  const groundZ = typeof target.getZ === 'function' ? target.getZ() : 0;

  return { x, y, groundZ };
}

function updateHavocTargetIndicator(runtimeScene, target) {
  const state = initializeHavocTargetSelection(runtimeScene);

  if (!brawlerTargetIsValid(target)) {
    havocTargetLogState(runtimeScene, 'INDICATOR_TARGET_INVALID', {
      suppliedTarget: !!target,
      suppliedTargetDestroyed: !!(target && target.isDestroyed),
    });
    clearHavocTargetIndicator(runtimeScene, 'indicator-target-invalid');
    return;
  }

  const ring = getHavocGroundRing(runtimeScene);
  if (!ring) {
    console.warn('[Havoc Target] Unable to initialize ground selection ring.');
    return;
  }

  const anchor = getHavocTargetAnchorPosition(target);
  const ringZ = anchor.groundZ + HAVOC_TARGET_CONFIG.ringGroundZOffset;

  ring.position.set(anchor.x, anchor.y, ringZ);
  ring.visible = true;

  state.indicatorTarget = target;

  const targetChanged = state.diagnosticLastTarget !== target;
  const indicatorTargetChanged = state.diagnosticLastIndicatorTarget !== target;
  const visibilityChanged = state.diagnosticLastIndicatorVisible !== ring.visible;

  if (targetChanged || indicatorTargetChanged || visibilityChanged) {
    havocTargetLogState(runtimeScene, 'INDICATOR_UPDATED', {
      targetChanged,
      indicatorTargetChanged,
      visibilityChanged,
      targetX: anchor.x,
      targetY: anchor.y,
      ringZ,
      ringVisible: ring.visible,
    });

    state.diagnosticLastTarget = target;
    state.diagnosticLastIndicatorTarget = target;
    state.diagnosticLastIndicatorVisible = ring.visible;
  }

  if (!state.indicatorLogged) {
    state.indicatorLogged = true;
    console.log('[Havoc Target] Ground target ring positioned.', {
      targetX: anchor.x,
      targetY: anchor.y,
      ringZ,
      ringVisible: ring.visible,
      ringInnerRadius: HAVOC_TARGET_CONFIG.ringInnerRadius,
      ringOuterRadius: HAVOC_TARGET_CONFIG.ringOuterRadius,
    });
  }
}

function getHavocPointerCoordinates(runtimeScene, input) {
  if (Number.isFinite(input.targetTapX) && Number.isFinite(input.targetTapY)) {
    return { x: input.targetTapX, y: input.targetTapY };
  }

  const inputManager = runtimeScene.getGame().getInputManager();
  return {
    x: inputManager.getCursorX(),
    y: inputManager.getCursorY(),
  };
}

function selectHavocTargetUnderPointer(runtimeScene, input) {
  const worldLayer = runtimeScene.getLayer('');
  if (!worldLayer || !worldLayer.getRenderer || !worldLayer.getRenderer().getThreeCamera) {
    havocTargetLogState(runtimeScene, 'RAYCAST_UNAVAILABLE', { reason: 'world-layer-camera-unavailable' });
    return null;
  }

  const camera = worldLayer.getRenderer().getThreeCamera();
  const renderer = runtimeScene.getGame().getRenderer().getThreeRenderer();
  if (!camera || !renderer || typeof THREE === 'undefined' || typeof THREE.Raycaster !== 'function') {
    havocTargetLogState(runtimeScene, 'RAYCAST_UNAVAILABLE', {
      reason: 'camera-renderer-three-unavailable',
      cameraAvailable: !!camera,
      rendererAvailable: !!renderer,
      threeAvailable: typeof THREE !== 'undefined',
    });
    return null;
  }

  const pointer = getHavocPointerCoordinates(runtimeScene, input);
  const viewportWidth = runtimeScene.getViewportWidth();
  const viewportHeight = runtimeScene.getViewportHeight();

  if (!(viewportWidth > 0) || !(viewportHeight > 0)) {
    havocTargetLogState(runtimeScene, 'RAYCAST_UNAVAILABLE', {
      reason: 'invalid-viewport',
      viewportWidth,
      viewportHeight,
    });
    return null;
  }

  const ndcX = (pointer.x / viewportWidth) * 2 - 1;
  const ndcY = -((pointer.y / viewportHeight) * 2 - 1);

  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera);

  const mobs = runtimeScene.getObjects(HAVOC_TARGET_CONFIG.mobObjectName);
  let selectedTarget = null;
  let nearestDistance = Infinity;

  for (const mob of mobs) {
    if (!mob || mob.isDestroyed || (typeof mob.isVisible === 'function' && !mob.isVisible())) continue;

    const rendererObject = typeof mob.get3DRendererObject === 'function'
      ? mob.get3DRendererObject()
      : null;

    if (!rendererObject) continue;

    const hits = raycaster.intersectObject(rendererObject, true);
    if (hits.length > 0 && hits[0].distance < nearestDistance) {
      nearestDistance = hits[0].distance;
      selectedTarget = mob;
    }
  }

  if (!runtimeScene.__havocTargetSelection.raycastLogged) {
    runtimeScene.__havocTargetSelection.raycastLogged = true;
    console.log('[Havoc Target] 3D ray selection initialized.', {
      mobs: mobs.length,
      pointerX: pointer.x,
      pointerY: pointer.y,
      ndcX,
      ndcY,
      camera: camera.type,
      rendererAvailable: !!renderer,
    });
  }

  havocTargetLogState(runtimeScene, selectedTarget ? 'RAYCAST_SELECTED' : 'RAYCAST_MISS', {
    pointerX: pointer.x,
    pointerY: pointer.y,
    ndcX,
    ndcY,
    mobCount: mobs.length,
    selectedTarget: selectedTarget ? havocTargetDiagnosticObjectName(selectedTarget) : null,
    nearestDistance: Number.isFinite(nearestDistance) ? nearestDistance : null,
  });

  return selectedTarget;
}

function updateHavocTargetSelection(runtimeScene) {
  const input = initializeHavocMobileInput(runtimeScene);
  const combat = initializeBrawlerCombat(runtimeScene);
  const selection = initializeHavocTargetSelection(runtimeScene);

  if (input.targetTapRequested) {
    havocTargetLogState(runtimeScene, 'TARGET_TAP_REQUESTED', {
      targetTapX: input.targetTapX,
      targetTapY: input.targetTapY,
    });

    const selectedTarget = selectHavocTargetUnderPointer(runtimeScene, input);

    if (selectedTarget) {
      combat.target = selectedTarget;
      havocTargetLogState(runtimeScene, 'COMBAT_TARGET_ASSIGNED', {
        target: havocTargetDiagnosticObjectName(selectedTarget),
      });
      updateHavocTargetIndicator(runtimeScene, selectedTarget);
    } else {
      havocTargetLogState(runtimeScene, 'TARGET_SELECTION_MISS_IGNORED', {
        retainedTarget: combat.target ? havocTargetDiagnosticObjectName(combat.target) : null,
      });
    }
  }

  if (!combat.target) {
    if (selection.indicatorTarget) {
      clearHavocTargetIndicator(runtimeScene, 'no-combat-target');
    }
    return;
  }

  if (!brawlerTargetIsValid(combat.target)) {
    havocTargetLogState(runtimeScene, 'COMBAT_TARGET_INVALIDATED', {});
    combat.target = null;
    clearHavocTargetIndicator(runtimeScene, 'combat-target-invalid');
    return;
  }

  // Keep the indicator attached to the selected mob every frame. Do not gate
  // this on indicatorTarget equality: the mob can move between frames and the
  // target remains selected until the object is destroyed or another target is
  // explicitly selected.
  updateHavocTargetIndicator(runtimeScene, combat.target);
}
