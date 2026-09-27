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
  arrowZOffset: 300,
  indicatorScale: 0.4,
  hiddenX: -100000,
  hiddenY: -100000,
};

function initializeHavocTargetSelection(runtimeScene) {
  if (!runtimeScene.__havocTargetSelection) {
    runtimeScene.__havocTargetSelection = {
      indicator: null,
      indicatorTarget: null,
      raycastLogged: false,
      indicatorLogged: false,
      indicatorConfigured: false,
    };
  }

  const state = runtimeScene.__havocTargetSelection;
  const objects = runtimeScene.getObjects(HAVOC_TARGET_CONFIG.indicatorObjectName);
  state.indicator = objects.length > 0 ? objects[0] : null;

  if (state.indicator && !state.indicatorConfigured) {
    if (typeof state.indicator.setScale === 'function') {
      state.indicator.setScale(HAVOC_TARGET_CONFIG.indicatorScale);
    }

    // target_icon.glb is a closed crystal, but its GLB material does not mark
    // itself double-sided. During the embedded spin, back-face culling can make
    // the entire icon disappear from this camera. Force the rendered material
    // to render both sides while preserving the GLB's spin animation.
    if (typeof state.indicator.get3DRendererObject === 'function' && typeof THREE !== 'undefined') {
      const rendererObject = state.indicator.get3DRendererObject();
      if (rendererObject && typeof rendererObject.traverse === 'function') {
        rendererObject.traverse((child) => {
          if (!child || !child.material) return;

          const materials = Array.isArray(child.material)
            ? child.material
            : [child.material];

          for (const material of materials) {
            if (!material) continue;
            material.side = THREE.DoubleSide;
            material.needsUpdate = true;
          }
        });
      }
    }

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

    if (typeof indicator.hide === 'function') {
      indicator.hide(true);
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
  const indicatorZ = targetTopZ + HAVOC_TARGET_CONFIG.arrowZOffset;

  const shown = setHavocIndicatorPosition(indicator, x, y, indicatorZ);

  if (!shown) {
    console.warn('[Havoc Target] TargetSelectionIcon does not expose the required 3D positioning API.');
    return;
  }

  state.indicatorTarget = target;

  if (!state.indicatorLogged) {
    state.indicatorLogged = true;
    console.log('[Havoc Target] TargetSelectionIcon positioned.', {
      targetX: x,
      targetY: y,
      targetTopZ,
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

  // Keep the indicator attached to the selected mob every frame. Do not gate
  // this on indicatorTarget equality: the mob can move between frames and the
  // target remains selected until the object is destroyed or another target is
  // explicitly selected.
  updateHavocTargetIndicator(runtimeScene, combat.target);
}
