/**
 * Brawler combat orchestration for the first combat presentation test.
 *
 * Responsibilities:
 * - hold the temporary selected target;
 * - approach a selected target when outside basic-attack range;
 * - execute the configured three Attack1 + one Attack2 sequence;
 * - return control to locomotion after a non-looping attack finishes.
 *
 * No damage, hitbox, HP, stats, death or server state exists here.
 */

function initializeBrawlerCombat(runtimeScene) {
  if (!runtimeScene.__havocBrawlerCombat) {
    runtimeScene.__havocBrawlerCombat = {
      target: null,
      attackIndex: 0,
      attacking: false,
      approaching: false,
    };
  }

  return runtimeScene.__havocBrawlerCombat;
}

function brawlerTargetIsValid(target) {
  return !!target && !target.isDestroyed && !target.isHidden();
}

function startBrawlerBasicAttack(player, combat) {
  const attackAnimation = BRAWLER_BASIC_ATTACKS.combo[combat.attackIndex % BRAWLER_BASIC_ATTACKS.combo.length];
  combat.attackIndex += 1;
  combat.attacking = true;
  combat.approaching = false;
  setBrawlerAnimation(player, attackAnimation);
  player.setAnimationElapsedTime(0);
}

function updateBrawlerCombat(runtimeScene, dt) {
  const player = runtimeScene.getObjects(BRAWLER_CONFIG.objectName)[0];
  if (!player) return;

  const combat = initializeBrawlerCombat(runtimeScene);
  const mobileInput = initializeHavocMobileInput(runtimeScene);

  updateHavocTargetSelection(runtimeScene);

  if (!brawlerTargetIsValid(combat.target)) {
    combat.target = null;
    combat.approaching = false;
  }

  if (combat.attacking) {
    if (player.hasAnimationEnded()) {
      combat.attacking = false;
      combat.approaching = false;
      setBrawlerAnimation(player, BRAWLER_CONFIG.animations.idle);
    }
    return;
  }

  const activeTarget = combat.target;
  if (!activeTarget) return;

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

  const attackRequested = mobileInput.attackRequested ||
    gdjs.evtTools.input.wasKeyJustPressed(runtimeScene, 'space');

  if (attackRequested) {
    player.setAngle(player.getAngleToObject(activeTarget));
    startBrawlerBasicAttack(player, combat);
  }
}
