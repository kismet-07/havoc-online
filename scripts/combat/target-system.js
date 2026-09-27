/**
 * Temporary target selection for the first Brawler combat test.
 *
 * GDevelop's cursorOnObject() handles mouse/touch hit testing, including
 * current 3D model objects. The selected target gets a world-space red
 * selection ring made from four pre-sized 3D box objects.
 *
 * The box dimensions are defined in the project rather than changed at
 * runtime. This avoids relying on 3D size mutators that are not exposed by
 * the preview runtime object returned by createObject().
 */

const HAVOC_TARGET_CONFIG = {
  mobObjectName: 'Killer_clown',
  indicatorObjectNames: [
    'TargetSelectionRingTop',
    'TargetSelectionRingBottom',
    'TargetSelectionRingLeft',
    'TargetSelectionRingRight',
  ],
  indicatorRadius: 260,
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
  if (!segment) return;

  // setCenterZInScene is the documented 3D position API. Keep a renderer
  // fallback for preview/runtime differences.
  if (typeof segment.setCenterZInScene === 'function') {
    segment.setCenterZInScene(z);
    return;
  }

  if (typeof segment.get3DRendererObject === 'function') {
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
  const z = target.getZ() + HAVOC_TARGET_CONFIG.indicatorZOffset;
  const x = target.getX();
  const y = target.getY();

  const definitions = [
    { name: 'TargetSelectionRingTop', x: x, y: y - radius },
    { name: 'TargetSelectionRingBottom', x: x, y: y + radius },
    { name: 'TargetSelectionRingLeft', x: x - radius, y: y },
    { name: 'TargetSelectionRingRight', x: x + radius, y: y },
  ];

  for (const definition of definitions) {
    const segment = runtimeScene.createObject(definition.name);
    if (!segment) continue;

    segment.setPosition(definition.x, definition.y);
    setHavocIndicatorZ(segment, z);
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
