/**
 * Temporary target selection for the first Brawler combat test.
 *
 * GDevelop's cursorOnObject() handles mouse/touch hit testing, including
 * current 3D model objects. The selected target gets a world-space red
 * selection ring made from four pre-created 3D box objects.
 *
 * The box dimensions and red material are defined in the project rather
 * than changed at runtime. Only world position is changed at runtime.
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
  hiddenPosition: -100000,
};

function initializeHavocTargetSelection(runtimeScene) {
  if (!runtimeScene.__havocTargetSelection) {
    runtimeScene.__havocTargetSelection = {
      indicatorSegments: [],
      indicatorTarget: null,
    };

    for (const objectName of HAVOC_TARGET_CONFIG.indicatorObjectNames) {
      const objects = runtimeScene.getObjects(objectName);
      if (objects.length > 0) {
        runtimeScene.__havocTargetSelection.indicatorSegments.push(objects[0]);
      }
    }
  }

  return runtimeScene.__havocTargetSelection;
}

function clearHavocTargetIndicator(runtimeScene) {
  const state = initializeHavocTargetSelection(runtimeScene);

  for (const segment of state.indicatorSegments) {
    if (!segment || segment.isDestroyed) continue;
    segment.setPosition(
      HAVOC_TARGET_CONFIG.hiddenPosition,
      HAVOC_TARGET_CONFIG.hiddenPosition
    );
    segment.setZ(HAVOC_TARGET_CONFIG.hiddenPosition);
  }

  state.indicatorTarget = null;
}

function setHavocIndicatorZ(segment, z) {
  if (!segment || segment.isDestroyed) return;

  // Use the same verified 3D positioning API already used by the working
  // Killer Clown system. Do not manipulate renderer internals.
  segment.setZ(z);
}

function createHavocTargetIndicator(runtimeScene, target) {
  const state = initializeHavocTargetSelection(runtimeScene);
  clearHavocTargetIndicator(runtimeScene);

  if (state.indicatorSegments.length !== HAVOC_TARGET_CONFIG.indicatorObjectNames.length) {
    return;
  }

  const radius = HAVOC_TARGET_CONFIG.indicatorRadius;
  const z = target.getZ() + HAVOC_TARGET_CONFIG.indicatorZOffset;
  const x = target.getX();
  const y = target.getY();

  const positions = [
    [x, y - radius],
    [x, y + radius],
    [x - radius, y],
    [x + radius, y],
  ];

  for (let i = 0; i < state.indicatorSegments.length; i += 1) {
    const segment = state.indicatorSegments[i];
    if (!segment || segment.isDestroyed) continue;

    segment.setPosition(positions[i][0], positions[i][1]);
    setHavocIndicatorZ(segment, z);
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
