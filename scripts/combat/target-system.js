/**
 * Temporary target selection for the first Brawler combat test.
 *
 * A tap/click in the world projects Killer Clown instances to screen space and
 * selects the closest mob under the pointer. This is presentation/test logic;
 * it is not authoritative multiplayer targeting.
 */

const HAVOC_TARGET_CONFIG = {
  mobObjectName: 'Killer_clown',
  selectionRadius: 85,
};

function projectHavoc3DObjectToScreen(runtimeScene, object) {
  const baseLayer = runtimeScene.getLayer('');
  if (!baseLayer || !object || !object.get3DRendererObject) return null;

  const camera = baseLayer.getRenderer().getThreeCamera();
  if (!camera) return null;

  const rendererObject = object.get3DRendererObject();
  if (!rendererObject) return null;

  const Vector3 = camera.position.constructor;
  const worldPosition = new Vector3();
  rendererObject.getWorldPosition(worldPosition);
  worldPosition.project(camera);

  const width = runtimeScene.getViewportWidth();
  const height = runtimeScene.getViewportHeight();

  return {
    x: (worldPosition.x + 1) * width * 0.5,
    y: (1 - worldPosition.y) * height * 0.5,
    visible: worldPosition.z >= -1 && worldPosition.z <= 1,
  };
}

function selectHavocTargetAtScreenPosition(runtimeScene, screenX, screenY) {
  const mobs = runtimeScene.getObjects(HAVOC_TARGET_CONFIG.mobObjectName);
  let bestTarget = null;
  let bestDistanceSquared = HAVOC_TARGET_CONFIG.selectionRadius ** 2;

  for (const mob of mobs) {
    const projected = projectHavoc3DObjectToScreen(runtimeScene, mob);
    if (!projected || !projected.visible) continue;

    const dx = projected.x - screenX;
    const dy = projected.y - screenY;
    const distanceSquared = dx * dx + dy * dy;

    if (distanceSquared <= bestDistanceSquared) {
      bestDistanceSquared = distanceSquared;
      bestTarget = mob;
    }
  }

  return bestTarget;
}

function updateHavocTargetSelection(runtimeScene) {
  const input = initializeHavocMobileInput(runtimeScene);
  const combat = initializeBrawlerCombat(runtimeScene);

  if (!input.targetTapRequested) return;

  combat.target = selectHavocTargetAtScreenPosition(
    runtimeScene,
    input.targetTapX,
    input.targetTapY,
  );
}
