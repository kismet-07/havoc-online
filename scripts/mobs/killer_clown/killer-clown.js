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
  spawnRadius: 1800,
};

function updateKillerClowns(runtimeScene, dt) {
  const mobs = runtimeScene.getObjects(KILLER_CLOWN_CONFIG.objectName);
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

  const spawnFromExisting = () => {
    const current = runtimeScene.getObjects(KILLER_CLOWN_CONFIG.objectName);
    if (current.length >= KILLER_CLOWN_CONFIG.maxPopulation) return null;

    const anchor = current[0];
    const centerX = anchor ? anchor.getX() : (floorMinX + floorMaxX) * 0.5;
    const centerY = anchor ? anchor.getY() : (floorMinY + floorMaxY) * 0.5;
    const angle = Math.random() * Math.PI * 2;
    const radius = Math.sqrt(Math.random()) * KILLER_CLOWN_CONFIG.spawnRadius;
    const x = clamp(centerX + Math.cos(angle) * radius, floorMinX, floorMaxX);
    const y = clamp(centerY + Math.sin(angle) * radius, floorMinY, floorMaxY);
    const mob = runtimeScene.createObject(KILLER_CLOWN_CONFIG.objectName);
    if (!mob) return null;
    mob.setPosition(x, y);
    mob.setAnimationName(KILLER_CLOWN_CONFIG.animations.idle);
    mob.setAnimationSpeedScale(1);
    mob.__killerClownAI = {
      state: 'idle',
      timer: randomBetween(KILLER_CLOWN_CONFIG.idleMinSeconds, KILLER_CLOWN_CONFIG.idleMaxSeconds),
      targetX: x,
      targetY: y,
      aggressive: false,
      dead: false,
    };
    return mob;
  };

  if (!system.initialized) {
    system.initialized = true;
    while (runtimeScene.getObjects(KILLER_CLOWN_CONFIG.objectName).length < KILLER_CLOWN_CONFIG.maxPopulation) {
      if (!spawnFromExisting()) break;
    }
  }

  system.respawnTimer += dt;
  if (system.respawnTimer >= KILLER_CLOWN_CONFIG.respawnSeconds) {
    system.respawnTimer = 0;
    while (runtimeScene.getObjects(KILLER_CLOWN_CONFIG.objectName).length < KILLER_CLOWN_CONFIG.maxPopulation) {
      if (!spawnFromExisting()) break;
    }
  }

  const allMobs = runtimeScene.getObjects(KILLER_CLOWN_CONFIG.objectName);
  for (const mob of allMobs) {
    if (!mob.__killerClownAI) {
      mob.__killerClownAI = {
        state: 'idle',
        timer: randomBetween(KILLER_CLOWN_CONFIG.idleMinSeconds, KILLER_CLOWN_CONFIG.idleMaxSeconds),
        targetX: mob.getX(),
        targetY: mob.getY(),
        aggressive: false,
        dead: false,
      };
      mob.setAnimationName(KILLER_CLOWN_CONFIG.animations.idle);
      mob.setAnimationSpeedScale(1);
    }

    const ai = mob.__killerClownAI;
    if (ai.dead) continue;

    // V1 is deliberately non-aggressive. Combat hooks can set aggressive=true
    // for one specific instance later without changing the wander system.
    if (ai.aggressive) {
      // Reserved for the combat implementation. Do not auto-aggro in V1.
      continue;
    }

    ai.timer -= dt;

    if (ai.state === 'idle') {
      mob.setAnimationName(KILLER_CLOWN_CONFIG.animations.idle);
      mob.setAnimationSpeedScale(1);
      if (ai.timer <= 0) {
        const targetX = randomBetween(floorMinX, floorMaxX);
        const targetY = randomBetween(floorMinY, floorMaxY);
        ai.targetX = targetX;
        ai.targetY = targetY;
        ai.state = 'wander';
        ai.timer = randomBetween(KILLER_CLOWN_CONFIG.walkMinSeconds, KILLER_CLOWN_CONFIG.walkMaxSeconds);
        mob.setAnimationName(KILLER_CLOWN_CONFIG.animations.walk);
        mob.setAnimationSpeedScale(1);
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
