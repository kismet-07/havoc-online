/**
 * Killer Clown V2 runtime behavior for GDevelop 5.
 *
 * Runtime responsibilities:
 *   population -> idle/wander -> aggro -> chase -> attack
 *                                      \-> leash exceeded -> return home
 *
 * No HP, damage, death, stats, networking or database state is implemented.
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
  attackAnimationCycleSeconds: 0.8,
  leashDistance: 3200,
  homeArrivalDistance: 12,
};

function killerClownTargetIsValid(target) {
  if (!target) return false;
  if (target.isDestroyed) return false;
  if (target._livingOnScene === false) return false;
  return true;
}

function killerClownDistanceSquared(x1, y1, x2, y2) {
  const dx = x1 - x2;
  const dy = y1 - y2;
  return dx * dx + dy * dy;
}

function killerClownClamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function killerClownRandomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function killerClownApplySpawnHeight(mob, spawnZ) {
  if (spawnZ !== null && typeof mob.setZ === 'function') {
    mob.setZ(spawnZ);
  }
}

function killerClownSetAnimation(mob, name, restart) {
  if (mob.getAnimationName() !== name) {
    mob.setAnimationName(name);
    if (restart) mob.setAnimationElapsedTime(0);
    return;
  }
  if (restart) mob.setAnimationElapsedTime(0);
}

function killerClownInitializeMob(mob, spawnZ, stateOverride, forcedPosition) {
  const position = forcedPosition || { x: mob.getX(), y: mob.getY() };
  mob.setPosition(position.x, position.y);
  killerClownApplySpawnHeight(mob, spawnZ);

  const state = stateOverride || (
    Math.random() < KILLER_CLOWN_CONFIG.initialIdleChance ? 'idle' : 'wander'
  );

  mob.__killerClownAI = {
    state,
    aggressive: false,
    target: null,
    homeX: position.x,
    homeY: position.y,
    homeZ: spawnZ,
    idleTimer: state === 'idle'
      ? killerClownRandomBetween(KILLER_CLOWN_CONFIG.idleMinSeconds, KILLER_CLOWN_CONFIG.idleMaxSeconds)
      : 0,
    walkTimer: 0,
    walkDirection: null,
    attackTimer: 0,
    attackCycleTimer: 0,
    attackPlaying: false,
  };

  if (state === 'idle') {
    killerClownSetAnimation(mob, KILLER_CLOWN_CONFIG.animations.idle, false);
  } else {
    killerClownBeginWander(mob, mob.__killerClownAI, []);
  }
}

function killerClownIsFarEnough(x, y, existing, ignoreMob) {
  const minimumDistanceSquared = KILLER_CLOWN_CONFIG.minimumSeparation * KILLER_CLOWN_CONFIG.minimumSeparation;
  for (const mob of existing) {
    if (mob === ignoreMob) continue;
    if (killerClownDistanceSquared(x, y, mob.getX(), mob.getY()) < minimumDistanceSquared) {
      return false;
    }
  }
  return true;
}

function killerClownRandomFloorPosition(floor, existing, ignoreMob) {
  const minX = floor.getX() + KILLER_CLOWN_CONFIG.boundaryMargin;
  const maxX = floor.getX() + floor.getWidth() - KILLER_CLOWN_CONFIG.boundaryMargin;
  const minY = floor.getY() + KILLER_CLOWN_CONFIG.boundaryMargin;
  const maxY = floor.getY() + floor.getHeight() - KILLER_CLOWN_CONFIG.boundaryMargin;

  for (let attempt = 0; attempt < KILLER_CLOWN_CONFIG.spawnAttempts; attempt += 1) {
    const x = killerClownRandomBetween(minX, maxX);
    const y = killerClownRandomBetween(minY, maxY);
    if (killerClownIsFarEnough(x, y, existing, ignoreMob)) {
      return { x, y };
    }
  }

  return {
    x: killerClownRandomBetween(minX, maxX),
    y: killerClownRandomBetween(minY, maxY),
  };
}

function killerClownBuildSpawnPositions(floor) {
  const minX = floor.getX() + KILLER_CLOWN_CONFIG.boundaryMargin;
  const maxX = floor.getX() + floor.getWidth() - KILLER_CLOWN_CONFIG.boundaryMargin;
  const minY = floor.getY() + KILLER_CLOWN_CONFIG.boundaryMargin;
  const maxY = floor.getY() + floor.getHeight() - KILLER_CLOWN_CONFIG.boundaryMargin;
  const columns = Math.max(1, Math.min(KILLER_CLOWN_CONFIG.spawnColumns, KILLER_CLOWN_CONFIG.maxPopulation));
  const rows = Math.max(1, Math.ceil(KILLER_CLOWN_CONFIG.maxPopulation / columns));
  const cellWidth = (maxX - minX) / columns;
  const cellHeight = (maxY - minY) / rows;
  const positions = [];

  for (let row = 0; row < rows && positions.length < KILLER_CLOWN_CONFIG.maxPopulation; row += 1) {
    for (let column = 0; column < columns && positions.length < KILLER_CLOWN_CONFIG.maxPopulation; column += 1) {
      const centerX = minX + cellWidth * (column + 0.5);
      const centerY = minY + cellHeight * (row + 0.5);
      const jitterX = cellWidth * KILLER_CLOWN_CONFIG.spawnJitter * 0.5;
      const jitterY = cellHeight * KILLER_CLOWN_CONFIG.spawnJitter * 0.5;
      positions.push({
        x: killerClownClamp(killerClownRandomBetween(centerX - jitterX, centerX + jitterX), minX, maxX),
        y: killerClownClamp(killerClownRandomBetween(centerY - jitterY, centerY + jitterY), minY, maxY),
      });
    }
  }

  return positions;
}

function killerClownCreateMob(runtimeScene, floor, spawnZ, forcedPosition) {
  const current = runtimeScene.getObjects(KILLER_CLOWN_CONFIG.objectName);
  if (current.length >= KILLER_CLOWN_CONFIG.maxPopulation) return null;

  const mob = runtimeScene.createObject(KILLER_CLOWN_CONFIG.objectName);
  if (!mob) return null;

  killerClownInitializeMob(mob, spawnZ, undefined, forcedPosition || killerClownRandomFloorPosition(floor, current, null));
  return mob;
}

function killerClownBeginWander(mob, ai, existingMobs) {
  const angle = Math.random() * Math.PI * 2;
  let distance = killerClownRandomBetween(700, 1400);
  let targetX = mob.getX() + Math.cos(angle) * distance;
  let targetY = mob.getY() + Math.sin(angle) * distance;

  for (let attempt = 0; attempt < KILLER_CLOWN_CONFIG.spawnAttempts; attempt += 1) {
    const candidateAngle = Math.random() * Math.PI * 2;
    distance = killerClownRandomBetween(700, 1400);
    const candidateX = mob.getX() + Math.cos(candidateAngle) * distance;
    const candidateY = mob.getY() + Math.sin(candidateAngle) * distance;
    if (killerClownIsFarEnough(candidateX, candidateY, existingMobs, mob)) {
      targetX = candidateX;
      targetY = candidateY;
      break;
    }
  }

  ai.walkDirection = {
    x: targetX - mob.getX(),
    y: targetY - mob.getY(),
  };
  const length = Math.hypot(ai.walkDirection.x, ai.walkDirection.y) || 1;
  ai.walkDirection.x /= length;
  ai.walkDirection.y /= length;
  ai.walkTimer = killerClownRandomBetween(KILLER_CLOWN_CONFIG.walkMinSeconds, KILLER_CLOWN_CONFIG.walkMaxSeconds);
  ai.state = 'wander';
  mob.setAngle(Math.atan2(ai.walkDirection.y, ai.walkDirection.x) * 180 / Math.PI);
  killerClownSetAnimation(mob, KILLER_CLOWN_CONFIG.animations.walk, false);
}

function killerClownBeginReturnHome(mob, ai) {
  ai.state = 'return';
  ai.target = null;
  ai.aggressive = false;
  ai.attackPlaying = false;
  ai.attackTimer = 0;
  ai.attackCycleTimer = 0;
  killerClownSetAnimation(mob, KILLER_CLOWN_CONFIG.animations.run, false);
}

function killerClownUpdateReturnHome(mob, dt, ai) {
  const dx = ai.homeX - mob.getX();
  const dy = ai.homeY - mob.getY();
  const distance = Math.hypot(dx, dy);

  if (distance <= KILLER_CLOWN_CONFIG.homeArrivalDistance) {
    mob.setPosition(ai.homeX, ai.homeY);
    killerClownApplySpawnHeight(mob, ai.homeZ);
    ai.state = 'idle';
    ai.idleTimer = KILLER_CLOWN_CONFIG.idleMinSeconds;
    killerClownSetAnimation(mob, KILLER_CLOWN_CONFIG.animations.idle, false);
    return;
  }

  const nx = dx / distance;
  const ny = dy / distance;
  const step = Math.min(KILLER_CLOWN_CONFIG.returnSpeed * dt, distance);
  mob.setPosition(mob.getX() + nx * step, mob.getY() + ny * step);
  killerClownApplySpawnHeight(mob, ai.homeZ);
  mob.setAngle(Math.atan2(ny, nx) * 180 / Math.PI);
  killerClownSetAnimation(mob, KILLER_CLOWN_CONFIG.animations.run, false);
}

function killerClownUpdateIdleWander(mob, dt, ai, allMobs) {
  if (ai.state === 'return') {
    killerClownUpdateReturnHome(mob, dt, ai);
    return;
  }

  if (ai.state === 'idle') {
    ai.idleTimer -= dt;
    killerClownSetAnimation(mob, KILLER_CLOWN_CONFIG.animations.idle, false);
    if (ai.idleTimer <= 0) {
      killerClownBeginWander(mob, ai, allMobs);
    }
    return;
  }

  if (!ai.walkDirection || ai.walkTimer <= 0) {
    killerClownBeginWander(mob, ai, allMobs);
  }

  ai.walkTimer -= dt;
  const step = KILLER_CLOWN_CONFIG.walkSpeed * dt;
  mob.setPosition(
    mob.getX() + ai.walkDirection.x * step,
    mob.getY() + ai.walkDirection.y * step,
  );
  killerClownApplySpawnHeight(mob, ai.homeZ);
  mob.setAngle(Math.atan2(ai.walkDirection.y, ai.walkDirection.x) * 180 / Math.PI);
  killerClownSetAnimation(mob, KILLER_CLOWN_CONFIG.animations.walk, false);

  const distanceFromHome = Math.hypot(mob.getX() - ai.homeX, mob.getY() - ai.homeY);
  if (distanceFromHome >= KILLER_CLOWN_CONFIG.boundaryMargin) {
    ai.walkDirection.x *= -1;
    ai.walkDirection.y *= -1;
  }

  if (ai.walkTimer <= 0) {
    ai.walkDirection = null;
    ai.state = 'idle';
    ai.idleTimer = killerClownRandomBetween(KILLER_CLOWN_CONFIG.idleMinSeconds, KILLER_CLOWN_CONFIG.idleMaxSeconds);
  }
}

function killerClownUpdateAggressive(mob, dt, ai) {
  const target = ai.target;
  if (!killerClownTargetIsValid(target)) {
    killerClownBeginReturnHome(mob, ai);
    return;
  }

  const homeDistance = Math.hypot(mob.getX() - ai.homeX, mob.getY() - ai.homeY);
  if (homeDistance >= KILLER_CLOWN_CONFIG.leashDistance) {
    killerClownBeginReturnHome(mob, ai);
    return;
  }

  const dx = target.getX() - mob.getX();
  const dy = target.getY() - mob.getY();
  const distance = Math.hypot(dx, dy);

  if (distance >= KILLER_CLOWN_CONFIG.leashDistance) {
    killerClownBeginReturnHome(mob, ai);
    return;
  }

  if (distance > KILLER_CLOWN_CONFIG.attackRange) {
    const nx = distance > 0.001 ? dx / distance : 0;
    const ny = distance > 0.001 ? dy / distance : 0;
    const step = Math.min(
      KILLER_CLOWN_CONFIG.chaseSpeed * dt,
      Math.max(0, distance - KILLER_CLOWN_CONFIG.attackRange),
    );
    mob.setPosition(mob.getX() + nx * step, mob.getY() + ny * step);
    killerClownApplySpawnHeight(mob, ai.homeZ);
    mob.setAngle(Math.atan2(ny, nx) * 180 / Math.PI);
    ai.state = 'chase';
    ai.attackPlaying = false;
    ai.attackCycleTimer = 0;
    killerClownSetAnimation(mob, KILLER_CLOWN_CONFIG.animations.run, false);
    return;
  }

  mob.setAngle(Math.atan2(dy, dx) * 180 / Math.PI);
  ai.state = 'attack';
  ai.attackPlaying = true;
  ai.attackTimer = Math.max(0, ai.attackTimer - dt);
  ai.attackCycleTimer += dt;

  // Do not depend on GDevelop's animation-ended state. Some imported GLB
  // actions hold their final pose even when their loop flag is true. Restart
  // the actual animation timeline on every attack cycle instead.
  if (ai.attackCycleTimer >= KILLER_CLOWN_CONFIG.attackAnimationCycleSeconds) {
    ai.attackCycleTimer = 0;
    killerClownSetAnimation(mob, KILLER_CLOWN_CONFIG.animations.attack, true);
    ai.attackTimer = KILLER_CLOWN_CONFIG.attackCooldownSeconds;
  } else if (mob.getAnimationName() !== KILLER_CLOWN_CONFIG.animations.attack) {
    killerClownSetAnimation(mob, KILLER_CLOWN_CONFIG.animations.attack, true);
    ai.attackTimer = KILLER_CLOWN_CONFIG.attackCooldownSeconds;
  }
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
  const floor = runtimeScene.getObjects('Floor')[0];
  const player = runtimeScene.getObjects(KILLER_CLOWN_CONFIG.targetObjectName)[0];
  if (!floor || !player) return;

  const floorMinX = floor.getX() + KILLER_CLOWN_CONFIG.boundaryMargin;
  const floorMaxX = floor.getX() + floor.getWidth() - KILLER_CLOWN_CONFIG.boundaryMargin;
  const floorMinY = floor.getY() + KILLER_CLOWN_CONFIG.boundaryMargin;
  const floorMaxY = floor.getY() + floor.getHeight() - KILLER_CLOWN_CONFIG.boundaryMargin;
  if (floorMaxX <= floorMinX || floorMaxY <= floorMinY) return;

  if (!system.initialized) {
    system.initialized = true;
    const existing = runtimeScene.getObjects(KILLER_CLOWN_CONFIG.objectName);
    system.spawnZ = existing.length > 0 && typeof existing[0].getZ === 'function'
      ? existing[0].getZ()
      : 0;

    const spawnPositions = killerClownBuildSpawnPositions(floor);
    for (let i = 0; i < existing.length && i < spawnPositions.length; i += 1) {
      killerClownInitializeMob(existing[i], system.spawnZ, undefined, spawnPositions[i]);
    }

    let spawnIndex = existing.length;
    while (runtimeScene.getObjects(KILLER_CLOWN_CONFIG.objectName).length < KILLER_CLOWN_CONFIG.maxPopulation) {
      const current = runtimeScene.getObjects(KILLER_CLOWN_CONFIG.objectName);
      const forcedPosition = spawnPositions[spawnIndex] || killerClownRandomFloorPosition(floor, current, null);
      if (!killerClownCreateMob(runtimeScene, floor, system.spawnZ, forcedPosition)) break;
      spawnIndex += 1;
    }
  }

  system.respawnTimer += dt;
  if (system.respawnTimer >= KILLER_CLOWN_CONFIG.respawnSeconds) {
    system.respawnTimer = 0;
    while (runtimeScene.getObjects(KILLER_CLOWN_CONFIG.objectName).length < KILLER_CLOWN_CONFIG.maxPopulation) {
      if (!killerClownCreateMob(runtimeScene, floor, system.spawnZ, null)) break;
    }
  }

  const allMobs = runtimeScene.getObjects(KILLER_CLOWN_CONFIG.objectName);
  for (const mob of allMobs) {
    if (!mob.__killerClownAI) {
      killerClownInitializeMob(mob, system.spawnZ, 'idle');
    }

    const ai = mob.__killerClownAI;
    if (ai.aggressive || ai.state === 'return') {
      killerClownUpdateAggressive(mob, dt, ai);
    } else {
      killerClownUpdateIdleWander(mob, dt, ai, allMobs);
    }
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
  ai.attackTimer = 0;
  ai.attackCycleTimer = 0;
  return true;
}

if (typeof module !== 'undefined') {
  module.exports = { KILLER_CLOWN_CONFIG, updateKillerClowns, aggroKillerClown };
}
