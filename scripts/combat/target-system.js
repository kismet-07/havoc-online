/**
 * Temporary target selection for the first Brawler combat test.
 *
 * GDevelop's RuntimeObject cursorOnObject() handles mouse/touch hit testing,
 * including the current 3D model objects. This keeps the test target system
 * small and avoids duplicating the camera projection math.
 *
 * The selected target also gets a small red 3D ring made from four thin boxes.
 * The indicator is world-space, so it follows the mob rather than the HUD.
 */

const HAVOC_TARGET_CONFIG = {
  mobObjectName: 'Killer_clown',
  indicatorObjectName: 'TargetSelectionRingSegment',
  indicatorRadius: 260,
  indicatorThickness: 20,
  indicatorHeight: 6,
  indicatorZOffset: 4,
};

function initializeHavocTargetSelection(runtimeScene) {
  if (!runtimeScene.__havocTargetSelection) {
    runtimeScene.__havocTargetSelection = {
      indicatorSegments: [],
      indicatorTarget: null,
    };
  }

  return runtimeScene.__havocTargetSelection;
}

function clearHavocTargetIndicator(runtimeScene) {
  const state = initializeHavocTargetSelection(runtimeScene);

  for (const segment of state.indicatorSegments) {
    if (segment && !segment.isDestroyed) segment.deleteFromScene();
  }

  state.indicatorSegments = [];
  state.indicatorTarget = null;
}

function setHavocIndicatorZ(segment, z) {
  // The project editor defines TargetSelectionRingSegment as a Primitive3D::Box.
  // Some GDevelop preview runtimes may expose a dynamically-created 3D object
  // without the inherited setZ() helper. Prefer the public helper when present,
  // then fall back to the object's renderer position for that runtime case.
  if (segment && typeof segment.setZ === 'function') {
    segment.setZ(z);
    return;
  }

  if (segment && typeof segment.get3DRendererObject === 'function') {
    const rendererObject = segment.get3DRendererObject();
    if (rendererObject && rendererObject.position) {
      rendererObject.position.z = z;
    }
  }
}

function createHavocTargetIndicator(runtimeScene, target) {
  const state = initializeHavocTargetSelection(runtimeScene);
  clearHavocTargetIndicator(runtimeScene);

  const radius = HAVOC_TARGET_CONFIG.indicatorRadius;
  const diameter = radius * 2;
  const thickness = HAVOC_TARGET_CONFIG.indicatorThickness;
  const height = HAVOC_TARGET_CONFIG.indicatorHeight;
  const z = target.getZ() + HAVOC_TARGET_CONFIG.indicatorZOffset;
  const x = target.getX();
  const y = target.getY();

  const definitions = [
    { x: x, y: y - radius, width: diameter, depth: height },
    { x: x, y: y + radius, width: diameter, depth: height },
    { x: x - radius, y: y, width: thickness, depth: height },
    { x: x + radius, y: y, width: thickness, depth: height },
  ];

  for (const definition of definitions) {
    const segment = runtimeScene.createObject(HAVOC_TARGET_CONFIG.indicatorObjectName);
    if (!segment) continue;

    segment.setPosition(definition.x, definition.y);
    setHavocIndicatorZ(segment, z);
    segment.setWidth(definition.width);
    segment.setHeight(definition.height);
    segment.setDepth(definition.depth);
    segment.setColor('#ff2020');
    segment.setIsCastingShadow(false);
    segment.setIsReceivingShadow(false);
    state.indicatorSegments.push(segment);
  }

  state.indicatorTarget = target;
}

function updateHavocTargetIndicator(runtimeScene, target) {
  const state = initializeHavocTargetSelection(runtimeScene);

  if (!brawlerTargetIsValid(target)) {
    clearHavocTargetIndicator(runtimeScene);
    return;
  }

  if (state.indicatorTarget !== target || state.indicatorSegments.length !== 4) {
    createHavocTargetIndicator(runtimeScene, target);
    return;
  }

  const radius = HAVOC_TARGET_CONFIG.indicatorRadius;
  const x = target.getX();
  const y = target.getY();
  const z = target.getZ() + HAVOC_TARGET_CONFIG.indicatorZOffset;

  state.indicatorSegments[0].setPosition(x, y - radius);
  state.indicatorSegments[1].setPosition(x, y + radius);
  state.indicatorSegments[2].setPosition(x - radius, y);
  state.indicatorSegments[3].setPosition(x + radius, y);

  for (const segment of state.indicatorSegments) {
    setHavocIndicatorZ(segment, z);
  }
}

function selectHavocTargetUnderCursor(runtimeScene) {
  const mobs = runtimeScene.getObjects(HAVOC_TARGET_CONFIG.mobObjectName);

  for (const mob of mobs) {
    if (mob.cursorOnObject()) return mob;
  }

  return null;
}

function updateHavocTargetSelection(runtimeScene) {
  const input = initializeHavocMobileInput(runtimeScene);
  const combat = initializeBrawlerCombat(runtimeScene);
  const selection = initializeHavocTargetSelection(runtimeScene);

  if (input.targetTapRequested) {
    const selectedTarget = selectHavocTargetUnderCursor(runtimeScene);

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
