/**
 * Killer Clown V1 runtime behavior for GDevelop 5.
 *
 * IMPORTANT:
 * GDevelop 5 does not automatically execute arbitrary files in a plain
 * single-file project. The installer copies this runtime into a JsCode event
 * in Havoc Online.json. This file is kept as the maintainable source version.
 */

const KILLER_CLOWN_CONFIG = {
  objectName: 'Killer_clown',
  maxPopulation: 20,
  respawnSeconds: 30,
  animations: {
    idle: 'Idle_Sword',
    walk: 'Walk_Large',
    run: 'Run_Stealth',
    attack: 'Sword_Attack',
  },
  walkSpeed: 110,
  idleMinSeconds: 2,
  idleMaxSeconds: 5,
  walkMinSeconds: 2,
  walkMaxSeconds: 6,
  boundaryMargin: 300,
  minSpawnDistance: 650,
  initialIdleChance: 0.4,
  spawnAttempts: 60,
};

function updateKillerClowns(runtimeScene, dt) {
  if (!runtimeScene.__havocKillerClownSystem) {
    runtimeScene.__havocKillerClownSystem = {
      initialized: false,
      respawnTimer: 0,
    };
  }

  const system = runtimeScene.__havocKillerClownSystem;
  const floor = runtimeScene.getObjects('Floor')[0];
  if (!floor) return;

  const floorMinX = floor.getX() + KILLER_CLOWN_CONFIG.boundaryMargin;
  const floorMaxX = floor.getX() + floor.getWidth() - KILLER_CLOWN_CONFIG.boundaryMargin;
  const floorMinY = floor.getY() + KILLER_CLOWN_CONFIG.boundaryMargin;
  const floorMaxY = floor.getY() + floor.getHeight() - KILLER_CLOWN_CONFIG.boundaryMargin;

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const randomBetween = (min, max) => min + Math.random() * (max - min);

  const randomFloorPosition = (existing) => {
    for (let attempt = 0; attempt < KILLER_CLOWN_CONFIG.spawnAttempts; attempt += 1) {
      const x = randomBetween(floorMinX, floorMaxX);
      const y = randomBetween(floorMinY, floorMaxY);
      let valid = true;

      for (const mob of existing) {
        const dx = x - mob.getX();
        const dy = y - mob.getY();
        if (dx * dx + dy * dy < KILLER_CLOWN_CONFIG.minSpawnDistance ** 2) {
          valid = false;
          break;
        }
      }

      if (valid) return { x, y };
    }

    // If the floor becomes too crowded for the requested spacing, use a
    // random point rather than failing to create the population.
    return {
      x: randomBetween(floorMinX, floorMaxX),
      y: randomBetween(floorMinY, floorMaxY),
    };
  };

  const initializeMob = (mob, stateOverride) => {
    const position = randomFloorPosition(runtimeScene.getObjects(KILLER_CLOWN_CONFIG.objectName).filter(other => other !== mob));
    mob.setPosition(position.x, position.y);

    const state = stateOverride || (Math.random() < KILLER_CLOWN_CONFIG.initialIdleChance ? 'idle' : 'wander');
    mob.__killerClownAI = {
      state,
      timer: state === 'idle'
        ? randomBetween(KILLER_CLOWN_CONFIG.idleMinSeconds, KILLER_CLOWN_CONFIG.idleMaxSeconds)
        : randomBetween(KILLER_CLOWN_CONFIG.walkMinSeconds, KILLER_CLOWN_CONFIG.walkMaxSeconds),
      targetX: position.x,
      targetY: position.y,
      aggressive: false,
      dead: false,
      idleHoldX: position.x,
      idleHoldY: position.y,
    };

    if (state === 'idle') {
      mob.setAnimationName(KILLER_CLOWN_CONFIG.animations.idle);
    } else {
      const target = randomFloorPosition(runtimeScene.getObjects(KILLER_CLOWN_CONFIG.objectName).filter(other => other !== mob));
      mob.__killerClownAI.targetX = target.x;
      mob.__killerClownAI.targetY = target.y;
      mob.setAngle(Math.atan2(target.y - position.y, target.x - position.x) * 180 / Math.PI);
      mob.setAnimationName(KILLER_CLOWN_CONFIG.animations.walk);
    }
    mob.setAnimationSpeedScale(1);
  };

  const createMob = () => {
    const current = runtimeScene.getObjects(KILLER_CLOWN_CONFIG.objectName);
    if (current.length >= KILLER_CLOWN_CONFIG.maxPopulation) return null;
    const mob = runtimeScene.createObject(KILLER_CLOWN_CONFIG.objectName);
    if (!mob) return null;
    initializeMob(mob);
    return mob;
  };

  if (!system.initialized) {
    system.initialized = true;

    // Reposition the design-time template as well, so the complete initial
    // population is scattered across the floor instead of clustering around it.
    const existing = runtimeScene.getObjects(KILLER_CLOWN_CONFIG.objectName);
    for (const mob of existing) initializeMob(mob);

    while (runtimeScene.getObjects(KILLER_CLOWN_CONFIG.objectName).length < KILLER_CLOWN_CONFIG.maxPopulation) {
      if (!createMob()) break;
    }
  }

  system.respawnTimer += dt;
  if (system.respawnTimer >= KILLER_CLOWN_CONFIG.respawnSeconds) {
    system.respawnTimer = 0;
    while (runtimeScene.getObjects(KILLER_CLOWN_CONFIG.objectName).length < KILLER_CLOWN_CONFIG.maxPopulation) {
      if (!createMob()) break;
    }
  }

  const allMobs = runtimeScene.getObjects(KILLER_CLOWN_CONFIG.objectName);
  for (const mob of allMobs) {
    if (!mob.__killerClownAI) {
      initializeMob(mob, 'idle');
    }

    const ai = mob.__killerClownAI;
    if (ai.dead) continue;

    // V1 is deliberately non-aggressive. Combat hooks can set aggressive=true
    // for one specific instance later without changing the wander system.
    if (ai.aggressive) continue;

    ai.timer -= dt;

    if (ai.state === 'idle') {
      // Explicitly hold the exact world position while idle. This prevents
      // residual movement from ever producing an idle sliding effect.
      mob.setPosition(ai.idleHoldX, ai.idleHoldY);
      mob.setAnimationName(KILLER_CLOWN_CONFIG.animations.idle);
      mob.setAnimationSpeedScale(1);

      if (ai.timer <= 0) {
        ai.targetX = randomBetween(floorMinX, floorMaxX);
        ai.targetY = randomBetween(floorMinY, floorMaxY);
        ai.state = 'wander';
        ai.timer = randomBetween(KILLER_CLOWN_CONFIG.walkMinSeconds, KILLER_CLOWN_CONFIG.walkMaxSeconds);
        mob.setAnimationName(KILLER_CLOWN_CONFIG.animations.walk);
      }
      continue;
    }

    if (ai.state === 'wander') {
      const dx = ai.targetX - mob.getX();
      const dy = ai.targetY - mob.getY();
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < 8 || ai.timer <= 0) {
        ai.state = 'idle';
        ai.timer = randomBetween(KILLER_CLOWN_CONFIG.idleMinSeconds, KILLER_CLOWN_CONFIG.idleMaxSeconds);
        ai.idleHoldX = mob.getX();
        ai.idleHoldY = mob.getY();
        mob.setPosition(ai.idleHoldX, ai.idleHoldY);
        mob.setAnimationName(KILLER_CLOWN_CONFIG.animations.idle);
        mob.setAnimationSpeedScale(1);
        continue;
      }

      const nx = dx / distance;
      const ny = dy / distance;
      const step = Math.min(KILLER_CLOWN_CONFIG.walkSpeed * dt, distance);
      const nextX = clamp(mob.getX() + nx * step, floorMinX, floorMaxX);
      const nextY = clamp(mob.getY() + ny * step, floorMinY, floorMaxY);

      mob.setPosition(nextX, nextY);
      mob.setAngle(Math.atan2(ny, nx) * 180 / Math.PI);
      mob.setAnimationName(KILLER_CLOWN_CONFIG.animations.walk);
      mob.setAnimationSpeedScale(1);
    }
  }
}

// Combat integration hook for a future attack system.
function aggroKillerClown(mob) {
  if (!mob || !mob.__killerClownAI || mob.getName && mob.getName() !== KILLER_CLOWN_CONFIG.objectName) return;
  mob.__killerClownAI.aggressive = true;
  mob.__killerClownAI.state = 'aggro';
  mob.setAnimationName(KILLER_CLOWN_CONFIG.animations.run);
}

if (typeof module !== 'undefined') {
  module.exports = { KILLER_CLOWN_CONFIG, updateKillerClowns, aggroKillerClown };
}
