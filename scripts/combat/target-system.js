/**
 * World-space target selection indicator and 3D target acquisition.
 *
 * Target selection uses the active 3D camera and a Three.js ray cast from the
 * desktop/mobile pointer position. This avoids RuntimeObject3D.cursorOnObject,
 * which is not reliable for our moving third-person 3D camera.
 *
 * The indicator is one pre-created TargetSelectionIcon 3D model instance.
 * The model's first embedded GLB animation plays automatically.
 */
const HAVOC_TARGET_CONFIG = {
  mobObjectName: 'Killer_clown',
  indicatorObjectName: 'TargetSelectionIcon',
  // World-space height above the mob's base. Do not derive this from
  // getUnrotatedAABBMaxZ(): the Killer_clown is a rotated glTF Model3DObject,
  // so that value is not a reliable world-vertical top coordinate.
  arrowZOffset: 300,
  indicatorScale: 0.4,
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
  const indicator = state.indicator;

  console.log('[Havoc Target][DIAG]', event, {
    ...data,
    combatTarget: combat && combat.target ? havocTargetDiagnosticObjectName(combat.target) : null,
    combatTargetDestroyed: !!(combat && combat.target && combat.target.isDestroyed),
    indicatorTarget: target ? havocTargetDiagnosticObjectName(target) : null,
    indicatorTargetDestroyed: !!(target && target.isDestroyed),
    indicatorExists: !!indicator,
    indicatorDestroyed: !!(indicator && indicator.isDestroyed),
    indicatorVisible: indicator && typeof indicator.isVisible === 'function'
      ? indicator.isVisible()
      : 'unknown',
  });
}

function initializeHavocTargetSelection(runtimeScene) {
  if (!runtimeScene.__havocTargetSelection) {
    runtimeScene.__havocTargetSelection = {
      indicator: null,
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
  const objects = runtimeScene.getObjects(HAVOC_TARGET_CONFIG.indicatorObjectName);
  state.indicator = objects.length > 0 ? objects[0] : null;

  if (state.indicator && !state.indicatorConfigured) {
    if (typeof state.indicator.setScale === 'function') {
      state.indicator.setScale(HAVOC_TARGET_CONFIG.indicatorScale);
    }

    // Do not modify the GLB materials here. The asset already renders with its
    // authored material, and forcing a Three.js material recompilation is not
    // required for target selection and can break custom GLB materials.
    state.indicatorConfigured = true;
  }

  return state;
}

function setHavocIndicatorPosition(indicator, x, y, z) {
  if (!indicator || indicator.isDestroyed) return false;

  // The target icon starts hidden far outside the scene. Explicitly unhide it
  // before positioning because Model3DObject inherits RuntimeObject3D.hide().
  if (typeof indicator.hide === 'function') {
    indicator.hide(false);
  }

  // Keep the icon on the base 3D layer. The world camera is attached to this
  // layer; putting the model on UI would make it invisible to the world camera.
  if (typeof indicator.setLayer === 'function' && indicator.layer !== '') {
    indicator.setLayer('');
  }

  if (typeof indicator.setCenterPositionInScene === 'function') {
    indicator.setCenterPositionInScene(x, y);
  } else if (typeof indicator.setPosition === 'function') {
    indicator.setPosition(x, y);
  } else {
    return false;
  }

  if (typeof indicator.setCenterZInScene === 'function') {
    indicator.setCenterZInScene(z);
  } else if (typeof indicator.setZ === 'function') {
    indicator.setZ(z);
  } else {
    return false;
  }

  return true;
}

function clearHavocTargetIndicator(runtimeScene, reason = 'unspecified') {
  const state = initializeHavocTargetSelection(runtimeScene);
  const indicator = state.indicator;

  havocTargetLogState(runtimeScene, 'CLEAR_INDICATOR', { reason });

  if (indicator && !indicator.isDestroyed) {
    if (typeof indicator.setPosition === 'function') {
      indicator.setPosition(HAVOC_TARGET_CONFIG.hiddenX, HAVOC_TARGET_CONFIG.hiddenY);
    }
    if (typeof indicator.setCenterZInScene === 'function') {
      indicator.setCenterZInScene(0);
    } else if (typeof indicator.setZ === 'function') {
      indicator.setZ(0);
    }

    if (typeof indicator.hide === 'function') {
      indicator.hide(true);
    }
  }

  state.indicatorTarget = null;
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

  const indicator = state.indicator;
  if (!indicator || indicator.isDestroyed) {
    console.warn('[Havoc Target] TargetSelectionIcon instance is missing from the scene.');
    havocTargetLogState(runtimeScene, 'INDICATOR_INSTANCE_MISSING', {});
    return;
  }

  const x = target.getX();
  const y = target.getY();
  // Use the mob's actual world Z plus a fixed offset. The previous
  // getUnrotatedAABBMaxZ() calculation is not safe for this rotated glTF model.
  const targetBaseZ = typeof target.getZ === 'function' ? target.getZ() : 0;
  const indicatorZ = targetBaseZ + HAVOC_TARGET_CONFIG.arrowZOffset;

  const shown = setHavocIndicatorPosition(indicator, x, y, indicatorZ);

  if (!shown) {
    console.warn('[Havoc Target] TargetSelectionIcon does not expose the required 3D positioning API.');
    havocTargetLogState(runtimeScene, 'INDICATOR_POSITION_FAILED', {
      targetX: x,
      targetY: y,
      targetBaseZ,
      indicatorZ,
    });
    return;
  }

  state.indicatorTarget = target;

  const visible = typeof indicator.isVisible === 'function' ? indicator.isVisible() : 'unknown';
  const targetChanged = state.diagnosticLastTarget !== target;
  const indicatorTargetChanged = state.diagnosticLastIndicatorTarget !== target;
  const visibilityChanged = state.diagnosticLastIndicatorVisible !== visible;

  if (targetChanged || indicatorTargetChanged || visibilityChanged) {
    havocTargetLogState(runtimeScene, 'INDICATOR_UPDATED', {
      targetChanged,
      indicatorTargetChanged,
      visibilityChanged,
      targetX: x,
      targetY: y,
      targetBaseZ,
      indicatorZ,
      indicatorVisible: visible,
      indicatorLayer: indicator.layer,
    });

    state.diagnosticLastTarget = target;
    state.diagnosticLastIndicatorTarget = target;
    state.diagnosticLastIndicatorVisible = visible;
  }

  if (!state.indicatorLogged) {
    state.indicatorLogged = true;
    console.log('[Havoc Target] TargetSelectionIcon positioned.', {
      targetX: x,
      targetY: y,
      targetBaseZ,
      indicatorX: typeof indicator.getCenterXInScene === 'function' ? indicator.getCenterXInScene() : indicator.getX(),
      indicatorY: typeof indicator.getCenterYInScene === 'function' ? indicator.getCenterYInScene() : indicator.getY(),
      indicatorZ: typeof indicator.getCenterZInScene === 'function' ? indicator.getCenterZInScene() : indicator.getZ(),
      indicatorVisible: typeof indicator.isVisible === 'function' ? indicator.isVisible() : 'unknown',
      indicatorLayer: indicator.layer,
      indicatorScale: typeof indicator.getScale === 'function' ? indicator.getScale() : 'unknown',
      indicatorWidth: typeof indicator.getWidth === 'function' ? indicator.getWidth() : 'unknown',
      indicatorHeight: typeof indicator.getHeight === 'function' ? indicator.getHeight() : 'unknown',
      indicatorDepth: typeof indicator.getDepth === 'function' ? indicator.getDepth() : 'unknown',
    });
  }
}

function getHavocPointerCoordinates(runtimeScene, input) {
  if (Number.isFinite(input.targetTapX) && Number.isFinite(input.targetTapY)) {
    return { x: input.targetTapX, y: input.targetTapY };
  }

  return {
    x: gdjs.evtTools.input.getCursorX(runtimeScene),
    y: gdjs.evtTools.input.getCursorY(runtimeScene),
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
      combat.target = null;
      havocTargetLogState(runtimeScene, 'COMBAT_TARGET_CLEARED_BY_MISS', {});
      clearHavocTargetIndicator(runtimeScene, 'target-selection-miss');
    }
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
