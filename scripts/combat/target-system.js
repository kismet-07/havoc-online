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
  arrowZOffset: 260,
  hiddenX: -100000,
  hiddenY: -100000,
};

function initializeHavocTargetSelection(runtimeScene) {
  if (!runtimeScene.__havocTargetSelection) {
    runtimeScene.__havocTargetSelection = {
      indicator: null,
      indicatorTarget: null,
      raycastLogged: false,
    };
  }

  const state = runtimeScene.__havocTargetSelection;
  const objects = runtimeScene.getObjects(HAVOC_TARGET_CONFIG.indicatorObjectName);
  state.indicator = objects.length > 0 ? objects[0] : null;
  return state;
}

function setHavocIndicatorPosition(indicator, x, y, z) {
  if (!indicator || indicator.isDestroyed) return false;

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

function clearHavocTargetIndicator(runtimeScene) {
  const state = initializeHavocTargetSelection(runtimeScene);
  const indicator = state.indicator;

  if (indicator && !indicator.isDestroyed) {
    if (typeof indicator.setPosition === 'function') {
      indicator.setPosition(HAVOC_TARGET_CONFIG.hiddenX, HAVOC_TARGET_CONFIG.hiddenY);
    }
    if (typeof indicator.setCenterZInScene === 'function') {
      indicator.setCenterZInScene(0);
    } else if (typeof indicator.setZ === 'function') {
      indicator.setZ(0);
    }
  }

  state.indicatorTarget = null;
}

function updateHavocTargetIndicator(runtimeScene, target) {
  const state = initializeHavocTargetSelection(runtimeScene);

  if (!brawlerTargetIsValid(target)) {
    clearHavocTargetIndicator(runtimeScene);
    return;
  }

  const indicator = state.indicator;
  if (!indicator || indicator.isDestroyed) {
    console.warn('[Havoc Target] TargetSelectionIcon instance is missing from the scene.');
    return;
  }

  const x = target.getX();
  const y = target.getY();
  const targetTopZ = typeof target.getUnrotatedAABBMaxZ === 'function'
    ? target.getUnrotatedAABBMaxZ()
    : target.getZ();

  const shown = setHavocIndicatorPosition(
    indicator,
    x,
    y,
    targetTopZ + HAVOC_TARGET_CONFIG.arrowZOffset,
  );

  if (!shown) {
    console.warn('[Havoc Target] TargetSelectionIcon does not expose the required 3D positioning API.');
    return;
  }

  state.indicatorTarget = target;
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
    return null;
  }

  const camera = worldLayer.getRenderer().getThreeCamera();
  const renderer = runtimeScene.getGame().getRenderer().getThreeRenderer();
  if (!camera || !renderer || typeof THREE === 'undefined' || typeof THREE.Raycaster !== 'function') {
    return null;
  }

  const pointer = getHavocPointerCoordinates(runtimeScene, input);
  const viewportWidth = runtimeScene.getViewportWidth();
  const viewportHeight = runtimeScene.getViewportHeight();

  if (!(viewportWidth > 0) || !(viewportHeight > 0)) return null;

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

  return selectedTarget;
}

function updateHavocTargetSelection(runtimeScene) {
  const input = initializeHavocMobileInput(runtimeScene);
  const combat = initializeBrawlerCombat(runtimeScene);
  const selection = initializeHavocTargetSelection(runtimeScene);

  if (input.targetTapRequested) {
    const selectedTarget = selectHavocTargetUnderPointer(runtimeScene, input);

    if (selectedTarget) {
      combat.target = selectedTarget;
      updateHavocTargetIndicator(runtimeScene, selectedTarget);
    } else {
      combat.target = null;
      clearHavocTargetIndicator(runtimeScene);
    }
  }

  if (!brawlerTargetIsValid(combat.target)) {
    combat.target = null;
    clearHavocTargetIndicator(runtimeScene);
    return;
  }

  if (selection.indicatorTarget === combat.target) {
    updateHavocTargetIndicator(runtimeScene, combat.target);
  }
}
