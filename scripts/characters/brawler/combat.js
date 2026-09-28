/**
 * Brawler combat orchestration for the first combat presentation test.
 *
 * No damage, hitbox, HP, stats, death or server state exists here.
 *
 * Attack input toggles automatic attack mode. Once enabled, the Brawler
 * repeats the configured combo continuously against the selected target until
 * the player toggles attack mode off, manually moves with the joystick, or the
 * target becomes invalid.
 *
 * The selected mob receives an aggro request through runtimeScene state.
 * This avoids relying on JavaScript function visibility/order between separate
 * GDevelop JsCode events. The Killer Clown event consumes that request.
 * Authoritative combat will move to the future FATE game server.
 */

function initializeBrawlerCombat(runtimeScene) {
  if (!runtimeScene.__havocBrawlerCombat) {
    runtimeScene.__havocBrawlerCombat = {
      target: null,
      attackIndex: 0,
      attacking: false,
      approaching: false,
      attackQueued: false,
      autoAttack: false,
    };
  }

  return runtimeScene.__havocBrawlerCombat;
}

function brawlerTargetIsValid(target) {
  if (!target) return false;
  if (target.isDestroyed) return false;
  if (target._livingOnScene === false) return false;
  return true;
}

function notifyBrawlerAttackTarget(runtimeScene, target, player) {
  if (!brawlerTargetIsValid(target)) return;

  runtimeScene.__havocKillerClownAggroRequest = {
    mob: target,
    player,
  };
}

function cancelBrawlerAutoAttack(player, combat) {
  combat.autoAttack = false;
  combat.attackQueued = false;
  combat.attacking = false;
  combat.approaching = false;
  combat.attackIndex = 0;

  // Movement immediately takes over on the same frame. Resetting the attack
  // animation here prevents combat from visually locking the player in place.
  if (player && player.getAnimationName() !== BRAWLER_CONFIG.animations.idle) {
    setBrawlerAnimation(player, BRAWLER_CONFIG.animations.idle);
  }
}

function startBrawlerBasicAttack(runtimeScene, player, combat) {
  const attackAnimation = BRAWLER_BASIC_ATTACKS.combo[
    combat.attackIndex % BRAWLER_BASIC_ATTACKS.combo.length
  ];

  const activeTarget = combat.target;

  combat.attackIndex += 1;
  combat.attacking = true;
  combat.approaching = false;
  combat.attackQueued = false;

  notifyBrawlerAttackTarget(runtimeScene, activeTarget, player);
  setBrawlerCombatAnimation(player, attackAnimation);
}

function updateBrawlerCombat(runtimeScene, dt) {
  const player = runtimeScene.getObjects(BRAWLER_CONFIG.objectName)[0];
  if (!player) return;

  const combat = initializeBrawlerCombat(runtimeScene);
  const mobileInput = initializeHavocMobileInput(runtimeScene);

  updateHavocTargetSelection(runtimeScene);

  // Manual joystick movement has priority over automatic combat. A small
  // dead-zone prevents an accidental touch from cancelling combat immediately.
  const joystickMagnitude = Math.sqrt(
    mobileInput.moveX * mobileInput.moveX +
    mobileInput.moveY * mobileInput.moveY
  );
  const manualJoystickMovement =
    mobileInput.joystickActive && joystickMagnitude >= 0.15;

  if (manualJoystickMovement && (combat.autoAttack || combat.attacking || combat.approaching)) {
    cancelBrawlerAutoAttack(player, combat);
  }

  // One attack-button press starts automatic combat; another press stops it.
  // Manual joystick movement wins if both inputs occur in the same frame.
  if (!manualJoystickMovement &&
      (mobileInput.attackRequested ||
       gdjs.evtTools.input.wasKeyJustPressed(runtimeScene, 'space'))) {
    combat.autoAttack = !combat.autoAttack;
    combat.attackQueued = combat.autoAttack;
  }

  if (!brawlerTargetIsValid(combat.target)) {
    combat.target = null;
    combat.approaching = false;
    combat.attackQueued = false;
    combat.attacking = false;
    combat.autoAttack = false;
    return;
  }

  if (combat.attacking) {
    if (player.hasAnimationEnded()) {
      combat.attacking = false;
      combat.approaching = false;
      setBrawlerAnimation(player, BRAWLER_CONFIG.animations.idle);

      // Continue automatically without requiring another attack-button press.
      combat.attackQueued = combat.autoAttack;
    }
    return;
  }

  if (!combat.autoAttack) {
    combat.attackQueued = false;
    return;
  }

  combat.attackQueued = true;

  const activeTarget = combat.target;
  const distance = player.getDistanceToObject(activeTarget);
  const attackRange = BRAWLER_CONFIG.combat.attackRange;

  if (distance > attackRange) {
    combat.approaching = true;

    const dx = activeTarget.getX() - player.getX();
    const dy = activeTarget.getY() - player.getY();
    const length = Math.sqrt(dx * dx + dy * dy);

    if (length > 0.001) {
      const moveX = dx / length;
      const moveY = dy / length;
      if (!runtimeScene.__fatePlayerMovement) {
        runtimeScene.__fatePlayerMovement = { x: player.getX(), y: player.getY() };
      }
      const movement = runtimeScene.__fatePlayerMovement;
      const speed = BRAWLER_CONFIG.movement.walkSpeed;

      movement.x += moveX * speed * dt;
      movement.y += moveY * speed * dt;
      player.setPosition(movement.x, movement.y);
      player.setAngle(Math.atan2(moveY, moveX) * 180 / Math.PI);
      setBrawlerAnimation(player, BRAWLER_CONFIG.animations.walk);
    }

    return;
  }

  combat.approaching = false;
  player.setAngle(player.getAngleToObject(activeTarget));
  startBrawlerBasicAttack(runtimeScene, player, combat);
}
