/**
 * World-space target selection indicator.
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
      diagnosticLogged: false,
    };
  }

  const state = runtimeScene.__havocTargetSelection;

  if (state.indicatorSegments.length !== HAVOC_TARGET_CONFIG.indicatorObjectNames.length) {
    state.indicatorSegments = HAVOC_TARGET_CONFIG.indicatorObjectNames.map((name) => {
      const objects = runtimeScene.getObjects(name);
      return objects.length > 0 ? objects[0] : null;
    });
  }

  if (!state.diagnosticLogged) {
    state.diagnosticLogged = true;
    console.log('[Havoc Target] Arrow lookup:',
      HAVOC_TARGET_CONFIG.indicatorObjectNames.map((name, index) => {
        const object = state.indicatorSegments[index];
        return {
          name,
          found: !!object,
          type: object ? object.type : null,
          hasSetPosition: !!(object && typeof object.setPosition === 'function'),
          hasSetZ: !!(object && typeof object.setZ === 'function'),
          hasSetCenterZInScene: !!(object && typeof object.setCenterZInScene === 'function'),
          hidden: !!(object && typeof object.isHidden === 'function' && object.isHidden()),
        };
      })
    );
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

  const stem = state.indicatorSegments[0];
  const head = state.indicatorSegments[1];

  const stemShown = setHavocIndicatorPosition(
    stem,
    x,
    y,
    targetTopZ + HAVOC_TARGET_CONFIG.arrowStemZOffset,
  );

  const headShown = setHavocIndicatorPosition(
    head,
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
