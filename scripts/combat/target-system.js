/**
 * World-space target selection indicator.
 * Uses pre-created 3D box instances instead of runtime-created 3D objects.
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
  indicatorZOffset: 12,
  hiddenX: -100000,
  hiddenY: -100000,
};

function initializeHavocTargetSelection(runtimeScene) {
  if (!runtimeScene.__havocTargetSelection) {
    runtimeScene.__havocTargetSelection = { indicatorSegments: [], indicatorTarget: null };
  }
  const state = runtimeScene.__havocTargetSelection;
  if (state.indicatorSegments.length !== 4) {
    state.indicatorSegments = HAVOC_TARGET_CONFIG.indicatorObjectNames.map((name) => {
      const objects = runtimeScene.getObjects(name);
      return objects.length > 0 ? objects[0] : null;
    });
  }
  return state;
}

function clearHavocTargetIndicator(runtimeScene) {
  const state = initializeHavocTargetSelection(runtimeScene);

  for (const segment of state.indicatorSegments) {
    if (!segment || segment.isDestroyed) continue;
    segment.setPosition(HAVOC_TARGET_CONFIG.hiddenX, HAVOC_TARGET_CONFIG.hiddenY);
    segment.setZ(0);
  }

  state.indicatorTarget = null;
}

function setHavocIndicatorZ(segment, z) {
  if (!segment || segment.isDestroyed) return;
  segment.setZ(z);
}

function updateHavocTargetIndicator(runtimeScene, target) {
  const state = initializeHavocTargetSelection(runtimeScene);

  if (!brawlerTargetIsValid(target)) {
    clearHavocTargetIndicator(runtimeScene);
    return;
  }

  if (state.indicatorSegments.some((segment) => !segment)) return;

  const r = HAVOC_TARGET_CONFIG.indicatorRadius;
  const x = target.getX();
  const y = target.getY();
  const z = target.getZ() + HAVOC_TARGET_CONFIG.indicatorZOffset;
  const positions = [
    [x, y - r],
    [x, y + r],
    [x - r, y],
    [x + r, y],
  ];

  for (let i = 0; i < 4; i += 1) {
    const segment = state.indicatorSegments[i];
    if (!segment || segment.isDestroyed) continue;
    segment.setPosition(positions[i][0], positions[i][1]);
    setHavocIndicatorZ(segment, z);
  }

  state.indicatorTarget = target;
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
