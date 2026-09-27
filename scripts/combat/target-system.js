/**
 * Temporary target selection for the first Brawler combat test.
 *
 * GDevelop's RuntimeObject cursorOnObject() handles mouse/touch hit testing,
 * including the current 3D model objects. This keeps the test target system
 * small and avoids duplicating the camera projection math.
 */

const HAVOC_TARGET_CONFIG = {
  mobObjectName: 'Killer_clown',
};

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

  if (!input.targetTapRequested) return;

  combat.target = selectHavocTargetUnderCursor(runtimeScene);
}
