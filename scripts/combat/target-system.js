/**
 * World-space target selection indicator and 3D target acquisition.
 *
 * Target selection uses the active 3D camera and a Three.js ray cast from the
 * desktop/mobile pointer position. This avoids RuntimeObject3D.cursorOnObject,
 * which is not reliable for our moving third-person 3D camera.
 *
 * The indicator uses the two pre-created TargetSelectionArrow objects in the
 * scene. No 3D objects are created at runtime.
 */
const HAVOC_TARGET_CONFIG = {
  mobObjectName: 'Killer_clown',
  indicatorObjectNames: [
    'TargetSelectionArrowStem',
    'TargetSelectionArrowHead',
  ],
  arrowStemZOffset: 260,
  arrowHeadZOffset: 170,
  hiddenX: -100000,
  hiddenY: -100000,
};

function initializeHavocTargetSelection(runtimeScene) {
  if (!runtimeScene.__havocTargetSelection) {
    runtimeScene.__havocTargetSelection = {
      indicatorSegments: [],
      indicatorTarget: null,
      raycastLogged: false,
    };
  }

  const state = runtimeScene.__havocTargetSelection;

  if (state.indicatorSegments.length !== HAVOC_TARGET_CONFIG.indicatorObjectNames.length) {
    state.indicatorSegments = HAVOC_TARGET_CONFIG.indicatorObjectNames.map((name) => {
      const objects = runtimeScene.getObjects(name);
      return objects.length > 0 ? objects[0] : null;
    });
  }

  return state;
}

function setHavocIndicatorPosition(segment, x, y, z) {
  if (!segment || segment.isDestroyed) return false;

  if (typeof segment.setCenterPositionInScene === 'function') {
    segment.setCenterPositionInScene(x, y);
  } else if (typeof segment.setPosition === 'function') {
    segment.setPosition(x, y);
  } else {
    return false;
  }

  if (typeof segment.setCenterZInScene === 'function') {
    segment.setCenterZInScene(z);
  } else if (typeof segment.setZ === 'function') {
    segment.setZ(z);
  } else {
    return false;
  }

  return true;
}

function clearHavocTargetIndicator(runtimeScene) {
  const state = initializeHavocTargetSelection(runtimeScene);

  for (const segment of state.indicatorSegments) {
    if (!segment || segment.isDestroyed) continue;

    if (typeof segment.setPosition === 'function') {
      segment.setPosition(HAVOC_TARGET_CONFIG.hiddenX, HAVOC_TARGET_CONFIG.hiddenY);
    }

    if (typeof segment.setZ === 'function') {
      segment.setZ(0);
    } else if (typeof segment.setCenterZInScene === 'function') {
      segment.setCenterZInScene(0);
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

  const missing = state.indicatorSegments.some((segment) => !segment || segment.isDestroyed);
  if (missing) {
    console.warn('[Havoc Target] Arrow indicator object missing at runtime.');
    return;
  }

  const x = target.getX();
  const y = target.getY();
  const targetTopZ = typeof target.getUnrotatedAABBMaxZ === 'function'
    ? target.getUnrotatedAABBMaxZ()
    : target.getZ();

  const stemShown = setHavocIndicatorPosition(
    state.indicatorSegments[0],
    x,
    y,
    targetTopZ + HAVOC_TARGET_CONFIG.arrowStemZOffset,
  );

  const headShown = setHavocIndicatorPosition(
    state.indicatorSegments[1],
    x,
    y,
    targetTopZ + HAVOC_TARGET_CONFIG.arrowHeadZOffset,
  );

  if (!stemShown || !headShown) {
    console.warn('[Havoc Target] Arrow object does not expose the required 3D positioning API.');
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
  // GDevelop's 3D renderer exposes the actual Three.js camera and renderer.
  // Use the base gameplay layer because that is the camera driving the world.
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
