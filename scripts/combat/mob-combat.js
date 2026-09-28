/**
 * Prototype mob combat bridge.
 *
 * This is intentionally client-side for the current combat prototype.
 * It provides animation-timed damage and a small player HP state so the
 * Killer Clown can actually fight the Brawler.
 *
 * These values are NOT authoritative game stats. They will be replaced by
 * server/database-driven combat values later.
 */

const MOB_COMBAT_CONFIG = Object.freeze({
  player: {
    maxHp: 500,
  },
  killerClown: {
    objectName: 'Killer_clown',
    targetObjectName: 'Character',
    attackAnimation: 'Sword_Attack',
    attackRange: 450,
    hitDelaySeconds: 0.25,
    damage: 50,
  },
});

function initializePrototypePlayerCombat(runtimeScene, player) {
  if (!runtimeScene.__fatePlayerCombat) {
    runtimeScene.__fatePlayerCombat = {
      player,
      maxHp: MOB_COMBAT_CONFIG.player.maxHp,
      hp: MOB_COMBAT_CONFIG.player.maxHp,
      dead: false,
    };
  }

  const combat = runtimeScene.__fatePlayerCombat;
  if (combat.player !== player) combat.player = player;
  return combat;
}

function queueMobDamage(runtimeScene, source, target, amount) {
  if (!runtimeScene.__havocMobDamageQueue) {
    runtimeScene.__havocMobDamageQueue = [];
  }

  runtimeScene.__havocMobDamageQueue.push({
    source,
    target,
    amount,
  });
}

function updateKillerClownCombatDamage(runtimeScene, dt) {
  const mobs = runtimeScene.getObjects(MOB_COMBAT_CONFIG.killerClown.objectName);
  if (!mobs || mobs.length === 0) return;

  for (const mob of mobs) {
    const ai = mob.__killerClownAI;
    if (!ai || ai.dead || !ai.aggressive || ai.state === 'return') {
      if (mob.__havocMobAttackState) {
        mob.__havocMobAttackState.active = false;
        mob.__havocMobAttackState.hitApplied = false;
        mob.__havocMobAttackState.elapsed = 0;
      }
      continue;
    }

    const target = ai.targetPlayer;
    if (!target || target.isDestroyed || target._livingOnScene === false) continue;

    const isAttackAnimation = mob.getAnimationName() === MOB_COMBAT_CONFIG.killerClown.attackAnimation;

    if (!isAttackAnimation) {
      if (mob.__havocMobAttackState) {
        mob.__havocMobAttackState.active = false;
        mob.__havocMobAttackState.hitApplied = false;
        mob.__havocMobAttackState.elapsed = 0;
      }
      continue;
    }

    if (!mob.__havocMobAttackState) {
      mob.__havocMobAttackState = {
        active: false,
        hitApplied: false,
        elapsed: 0,
      };
    }

    const attackState = mob.__havocMobAttackState;
    if (!attackState.active) {
      attackState.active = true;
      attackState.hitApplied = false;
      attackState.elapsed = 0;
    }

    attackState.elapsed += dt;

    if (attackState.hitApplied || attackState.elapsed < MOB_COMBAT_CONFIG.killerClown.hitDelaySeconds) continue;

    const distance = mob.getDistanceToObject(target);
    if (distance <= MOB_COMBAT_CONFIG.killerClown.attackRange) {
      queueMobDamage(
        runtimeScene,
        mob,
        target,
        MOB_COMBAT_CONFIG.killerClown.damage
      );
    }

    // One damage event per attack animation. If the player moved out of range,
    // this attack simply misses; the next attack gets a new hit window.
    attackState.hitApplied = true;
  }
}

function consumeMobDamageQueue(runtimeScene, player) {
  const queue = runtimeScene.__havocMobDamageQueue;
  if (!queue || queue.length === 0) return;

  runtimeScene.__havocMobDamageQueue = [];
  const combat = initializePrototypePlayerCombat(runtimeScene, player);
  if (combat.dead) return;

  for (const event of queue) {
    if (event.target !== player) continue;
    if (!Number.isFinite(event.amount) || event.amount <= 0) continue;

    combat.hp = Math.max(0, combat.hp - event.amount);

    if (combat.hp <= 0) {
      combat.dead = true;
      player._livingOnScene = false;
      break;
    }
  }
}
