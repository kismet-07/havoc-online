/**
 * Brawler movement and camera runtime behavior for GDevelop 5.
 *
 * This is intentionally behavior-preserving. The existing movement state
 * names are retained so the verified locomotion baseline is not changed.
 */

function updateBrawlerMovement(runtimeScene, dt) {
  const player = runtimeScene.getObjects(BRAWLER_CONFIG.objectName)[0];
  if (!player) return;

  if (!runtimeScene.__fatePlayerMovement) {
    runtimeScene.__fatePlayerMovement = { x: player.getX(), y: player.getY() };
  }

  if (!runtimeScene.__fateCamera) {
    runtimeScene.__fateCamera = { yaw: 0, pitch: 22, distance: 2200, initialized: true };
  }

  const movement = runtimeScene.__fatePlayerMovement;
  const camera = runtimeScene.__fateCamera;
  const input = gdjs.evtTools.input;
  const inputManager = runtimeScene.getGame().getInputManager();
  const left = input.isKeyPressed(runtimeScene, 'a');
  const right = input.isKeyPressed(runtimeScene, 'd');
  const forward = input.isKeyPressed(runtimeScene, 'w');
  const backward = input.isKeyPressed(runtimeScene, 's');
  const running = input.isKeyPressed(runtimeScene, 'LShift') || input.isKeyPressed(runtimeScene, 'RShift');

  let forwardInput = 0;
  let strafeInput = 0;
  if (forward) forwardInput += 1;
  if (backward) forwardInput -= 1;
  if (right) strafeInput += 1;
  if (left) strafeInput -= 1;

  const layer = runtimeScene.getLayer('');

  if (layer) {
    const orbiting = inputManager.isMouseButtonPressed(1);
    if (orbiting) {
      const deltaX = Math.max(-60, Math.min(60, inputManager.getMouseMovementX()));
      const deltaY = Math.max(-60, Math.min(60, inputManager.getMouseMovementY()));
      camera.yaw -= deltaX * 0.25;
      camera.pitch -= deltaY * 0.20;
      camera.pitch = Math.max(8, Math.min(55, camera.pitch));
    }

    const wheel = inputManager.getMouseWheelDelta();
    if (wheel !== 0) {
      camera.distance += wheel * 0.5;
      camera.distance = Math.max(500, Math.min(2200, camera.distance));
    }

    const forwardX = layer.getCameraForwardX();
    const forwardY = layer.getCameraForwardY();
    const rightX = layer.getCameraRightX();
    const rightY = layer.getCameraRightY();
    let moveX = forwardX * forwardInput + rightX * strafeInput;
    let moveY = forwardY * forwardInput + rightY * strafeInput;
    const moving = moveX !== 0 || moveY !== 0;

    if (moving) {
      const length = Math.sqrt(moveX * moveX + moveY * moveY);
      moveX /= length;
      moveY /= length;
      const speed = running ? BRAWLER_CONFIG.movement.runSpeed : BRAWLER_CONFIG.movement.walkSpeed;
      movement.x += moveX * speed * dt;
      movement.y += moveY * speed * dt;
      const targetAngle = Math.atan2(moveY, moveX) * 180 / Math.PI;
      player.setAngle(targetAngle);
      setBrawlerAnimation(
        player,
        running ? BRAWLER_CONFIG.animations.run : BRAWLER_CONFIG.animations.walk,
      );
    } else if (player.getAnimationName() !== BRAWLER_CONFIG.animations.idle) {
      setBrawlerAnimation(player, BRAWLER_CONFIG.animations.idle);
    }

    player.setPosition(movement.x, movement.y);

    const yawRadians = camera.yaw * Math.PI / 180;
    const pitchRadians = camera.pitch * Math.PI / 180;
    const horizontalDistance = Math.cos(pitchRadians) * camera.distance;
    const cameraX = movement.x + Math.sin(yawRadians) * horizontalDistance;
    const cameraY = movement.y - Math.cos(yawRadians) * horizontalDistance;
    const cameraZ = player.getZ() + Math.sin(pitchRadians) * camera.distance;
    layer.setCameraX(cameraX);
    layer.setCameraY(cameraY);
    gdjs.scene3d.camera.setCameraZ(runtimeScene, cameraZ, '', 0);
    const targetZ = player.getZ() + 120;
    gdjs.scene3d.camera.turnCameraTowardPosition(
      runtimeScene,
      movement.x,
      movement.y,
      targetZ,
      '',
      0,
      false,
    );
  }
}
