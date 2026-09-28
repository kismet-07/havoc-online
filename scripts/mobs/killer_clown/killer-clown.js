/**
 * Killer Clown V2 runtime behavior for GDevelop 5.
 *
 * The project is currently a single-file GDevelop project, so the installer
 * embeds this source into a JsCode event. Keep this file as the maintainable
 * source of truth.
 *
 * Combat prototype:
 *   idle/wander -> aggro -> chase -> attack
 *                           \-> leash exceeded -> return home -> idle/wander
 *
 * No HP, damage, death, stats, networking or database state is implemented.
 * Those belong to the future authoritative FATE game server.
 */

const KILLER_CLOWN_CONFIG = {
  objectName: 'Killer_clown',
  targetObjectName: 'Character',
  maxPopulation: 15,
  respawnSeconds: 15,
  animations: {
    idle: 'Idle_Sword',
    walk: 'Walk_Large',
    run: 'Run_Stealth',
    attack: 'Sword_Attack',
  },
  walkSpeed: 110,
  chaseSpeed: 1000,
  returnSpeed: 140,
  idleMinSeconds: 2,
  idleMaxSeconds: 5,
  walkMinSeconds: 10,
  walkMaxSeconds: 15,
  boundaryMargin: 300,
  minimumSeparation: 1000,
  initialIdleChance: 0.4,
  spawnColumns: 5,
  spawnRows: 4,
  spawnJitter: 0.28,
  spawnAttempts: 80,
  attackRange: 160,
  attackCooldownSeconds: 0.8,
  leashDistance: 3200,
  homeArrivalDistance: 12,
};

function killerClownTargetIsValid(target) {
  if (!target) return false;
  if (target.isDestroyed) return false;
  if (target._livingOnScene === false) return false;
  return true;
}

function updateKillerClowns(runtimeScene, dt) {
  if (!runtimeScene.__havocKillerClownSystem) {
    runtimeScene.__havocKillerClownSystem = {
      initialized: false,
      respawnTimer: 0,
      spawnZ: null,
    };
  }

  const system = runtimeScene.__havocKillerClownSystem;
  const mobs = runtimeScene.getObjects(KILLER_CLOWN_CONFIG.objectName);
  const player = runtimeScene.getObjects(KILLER_CLOWN_CONFIG.targetObjectName)[0];

  if (!player) return;

  if (!system.initialized) {
    system.initialized = true;
    system.spawnZ = mobs.length > 0 ? mobs[0].getZ() : 0;
    for (const mob of mobs) {
      initializeKillerClown(mob, player, system.spawnZ);
    }
  }

  for (const mob of mobs) {
    const ai = mob.__killerClownAI;
    if (!ai) {
      initializeKillerClown(mob, player, system.spawnZ);
    }
  }

  for (const mob of mobs) {
    updateKillerClown(mob, player, dt, system);
  }
}

function initializeKillerClown(mob, player, spawnZ) {
  const homeX = mob.getX();
  const homeY = mob.getY();

  mob.__killerClownAI = {
    state: 'idle',
    aggressive: false,
    target: null,
    homeX,
    homeY,
    homeZ: spawnZ,
    idleTimer: KILLER_CLOWN_CONFIG.idleMinSeconds +
      Math.random() * (KILLER_CLOWN_CONFIG.idleMaxSeconds - KILLER_CLOWN_CONFIG.idleMinSeconds),
    walkTimer: 0,
    walkDirection: null,
    attackTimer: 0,
    attackCooldown: 0,
    attackPlaying: false,
    lastAttackAt: 0,
  };

  applySpawnHeight(mob);
  mob.setAnimationName(KILLER_CLOWN_CONFIG.animations.idle);
}

function updateKillerClown(mob, player, dt, system) {
  const ai = mob.__killerClownAI;
  if (!ai) return;

  if (!killerClownTargetIsValid(ai.target)) {
    ai.target = null;
  }

  if (ai.aggressive && !ai.target) {
    ai.aggressive = false;
    ai.state = 'idle';
  }

  if (!ai.aggressive) {
    updateIdleWander(mob, player, dt, ai, system);
    return;
  }

  const target = ai.target;
  const dx = target.getX() - mob.getX();
  const dy = target.getY() - mob.getY();
  const distance = Math.hypot(dx, dy);

  if (distance >= KILLER_CLOWN_CONFIG.leashDistance) {
    beginReturnHome(mob, ai);
    return;
  }

  if (distance > KILLER_CLOWN_CONFIG.attackRange) {
    if (distance > 0.001) {
      const nx = dx / distance;
      const ny = dy / distance;
      const step = Math.min(KILLER_CLOWN_CONFIG.chaseSpeed * dt, distance - KILLER_CLOWN_CONFIG.attackRange);
      mob.setPosition(mob.getX() + nx * step, mob.getY() + ny * step);
      applySpawnHeight(mob);
      mob.setAngle(Math.atan2(ny, nx) * 180 / Math.PI);
    }
    ai.state = 'chase';
    ai.attackPlaying = false;
    mob.setAnimationName(KILLER_CLOWN_CONFIG.animations.run);
    return;
  }

  ai.state = 'attack';
  ai.attackCooldown = Math.max(0, ai.attackCooldown - dt);
  if (!ai.attackPlaying && ai.attackCooldown <= 0) {
    ai.attackPlaying = true;
    ai.attackCooldown = KILLER_CLOWN_CONFIG.attackCooldownSeconds;
    ai.lastAttackAt = Date.now();
    mob.setAnimationName(KILLER_CLOWN_CONFIG.animations.attack);
  }

  if (ai.attackPlaying) {
    const elapsed = (Date.now() - ai.lastAttackAt) / 1000;
    if (elapsed >= 0.8) {
      ai.attackPlaying = false;
      mob.setAnimationName(KILLER_CLOWN_CONFIG.animations.idle);
    }
  }
}

function updateIdleWander(mob, player, dt, ai, system) {
  ai.idleTimer -= dt;
  if (ai.idleTimer > 0) {
    ai.state = 'idle';
    mob.setAnimationName(KILLER_CLOWN_CONFIG.animations.idle);
    return;
  }

  if (!ai.walkDirection || ai.walkTimer <= 0) {
    const angle = Math.random() * Math.PI * 2;
    ai.walkDirection = { x: Math.cos(angle), y: Math.sin(angle) };
    ai.walkTimer = KILLER_CLOWN_CONFIG.walkMinSeconds +
      Math.random() * (KILLER_CLOWN_CONFIG.walkMaxSeconds - KILLER_CLOWN_CONFIG.walkMinSeconds);
  }

  ai.walkTimer -= dt;
  ai.state = 'wander';
  const step = KILLER_CLOWN_CONFIG.walkSpeed * dt;
  mob.setPosition(
    mob.getX() + ai.walkDirection.x * step,
    mob.getY() + ai.walkDirection.y * step,
  );
  applySpawnHeight(mob);
  mob.setAngle(Math.atan2(ai.walkDirection.y, ai.walkDirection.x) * 180 / Math.PI);
  mob.setAnimationName(KILLER_CLOWN_CONFIG.animations.walk);

  const distanceFromHome = Math.hypot(mob.getX() - ai.homeX, mob.getY() - ai.homeY);
  if (distanceFromHome >= KILLER_CLOWN_CONFIG.boundaryMargin) {
    ai.walkDirection.x *= -1;
    ai.walkDirection.y *= -1;
  }

  if (ai.walkTimer <= 0) {
    ai.walkDirection = null;
    ai.idleTimer = KILLER_CLOWN_CONFIG.idleMinSeconds +
      Math.random() * (KILLER_CLOWN_CONFIG.idleMaxSeconds - KILLER_CLOWN_CONFIG.idleMinSeconds);
  }
}

function beginReturnHome(mob, ai) {
  ai.state = 'return';
  ai.target = null;
  ai.aggressive = false;
  ai.attackPlaying = false;
  mob.setAnimationName(KILLER_CLOWN_CONFIG.animations.run);
}

function updateReturnHome(mob, dt, ai) {
  const dx = ai.homeX - mob.getX();
  const dy = ai.homeY - mob.getY();
  const distance = Math.hypot(dx, dy);

  if (distance <= KILLER_CLOWN_CONFIG.homeArrivalDistance) {
    mob.setPosition(ai.homeX, ai.homeY);
    applySpawnHeight(mob);
    ai.state = 'idle';
    ai.idleTimer = KILLER_CLOWN_CONFIG.idleMinSeconds;
    mob.setAnimationName(KILLER_CLOWN_CONFIG.animations.idle);
    return;
  }

  const nx = dx / distance;
  const ny = dy / distance;
  const step = Math.min(KILLER_CLOWN_CONFIG.returnSpeed * dt, distance);
  mob.setPosition(mob.getX() + nx * step, mob.getY() + ny * step);
  applySpawnHeight(mob);
  mob.setAngle(Math.atan2(ny, nx) * 180 / Math.PI);
  mob.setAnimationName(KILLER_CLOWN_CONFIG.animations.run);
}

function applySpawnHeight(mob) {
  if (mob.__killerClownAI && mob.__killerClownAI.homeZ !== null) {
    mob.setZ(mob.__killerClownAI.homeZ);
  }
}

function aggroKillerClown(mob, player) {
  if (!mob || !player) return false;
  const ai = mob.__killerClownAI;
  if (!ai) return false;
  ai.aggressive = true;
  ai.target = player;
  ai.state = 'chase';
  ai.attackPlaying = false;
  ai.attackCooldown = 0;
  return true;
}

if (typeof module !== 'undefined') {
  module.exports = { KILLER_CLOWN_CONFIG, updateKillerClowns, aggroKillerClown };
}