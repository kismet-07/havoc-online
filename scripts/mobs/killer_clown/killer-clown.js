/**
 * Killer Clown runtime behavior for GDevelop 5.
 *
 * Runtime responsibilities:
 *   population -> idle/wander -> aggro -> chase -> attack
 *                                      \-> leash exceeded -> return home
 *
 * The scene contains one Killer_clown template instance. Missing population
 * members are created at runtime around that template's spawn point.
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
  spawnRows: 3,
  spawnSpacing: 1100,
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
  if (spawnZ !== null && typeof mob.setZ === 'function') mob.setZ(spawnZ);
}

function killerClownSetAnimation(mob, name, restart) {
  if (mob.getAnimationName() !== name) {
    mob.setAnimationName(name);
    if (restart && typeof mob.setAnimationElapsedTime === 'function') {
      mob.setAnimationElapsedTime(0);
    }
    return;
  }

  if (restart && typeof mob.setAnimationElapsedTime === 'function') {
    mob.setAnimationElapsedTime(0);
  }
}

function killerClownIsFarEnough(x, y, existing, ignoreMob) {
  const minimumDistanceSquared =
    KILLER_CLOWN_CONFIG.minimumSeparation * KILLER_CLOWN_CONFIG.minimumSeparation;

  for (const mob of existing) {
    if (mob === ignoreMob) continue;
    if (killerClownDistanceSquared(x, y, mob.getX(), mob.getY()) < minimumDistanceSquared) {
      return false;
    }
  }

  return true;
}

function killerClownGetFloorBounds(floor) {
  return {
    minX: floor.getX() + KILLER_CLOWN_CONFIG.boundaryMargin,
    maxX: floor.getX() + floor.getWidth() - KILLER_CLOWN_CONFIG.boundaryMargin,
    minY: floor.getY() + KILLER_CLOWN_CONFIG.boundaryMargin,
    maxY: floor.getY() + floor.getHeight() - KILLER_CLOWN_CONFIG.boundaryMargin,
  };
}

function killerClownBuildClusterPositions(anchorX, anchorY, floor) {
  const bounds = killerClownGetFloorBounds(floor);
  const positions = [];
  const columns = KILLER_CLOWN_CONFIG.spawnColumns;
  const rows = KILLER_CLOWN_CONFIG.spawnRows;
  const centerColumn = (columns - 1) / 2;
  const centerRow = (rows - 1) / 2;

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const x = killerClownClamp(
        anchorX + (column - centerColumn) * KILLER_CLOWN_CONFIG.spawnSpacing,
        bounds.minX,
        bounds.maxX,
      );
      const y = killerClownClamp(
        anchorY + (row - centerRow) * KILLER_CLOWN_CONFIG.spawnSpacing,
        bounds.minY,
        bounds.maxY,
      );
      positions.push({ x, y });
    }
  }

  return positions;
}

function killerClownFindSpawnPosition(anchor, floor, existing, preferredPositions) {
  for (const position of preferredPositions) {
    if (killerClownIsFarEnough(position.x, position.y, existing, null)) {
      return position;
    }
  }

  const bounds = killerClownGetFloorBounds(floor);
  for (let attempt = 0; attempt < KILLER_CLOWN_CONFIG.spawnAttempts; attempt += 1) {
    const angle = Math.random() * Math.PI * 2;
    const radius = killerClownRandomBetween(1100, 2200);
    const x = killerClownClamp(anchor.x + Math.cos(angle) * radius, bounds.minX, bounds.maxX);
    const y = killerClownClamp(anchor.y + Math.sin(angle) * radius, bounds.minY, bounds.maxY);
    if (killerClownIsFarEnough(x, y, existing, null)) return { x, y };
  }

  return {
    x: killerClownClamp(anchor.x, bounds.minX, bounds.maxX),
    y: killerClownClamp(anchor.y, bounds.minY, bounds.maxY),
  };
}

function killerClownBeginWander(mob, ai, allMobs, floor) {
  const bounds = killerClownGetFloorBounds(floor);
  const angle = Math.random() * Math.PI * 2;
  const distance = killerClownRandomBetween(700, 1400);
  let targetX = killerClownClamp(mob.getX() + Math.cos(angle) * distance, bounds.minX, bounds.maxX);
  let targetY = killerClownClamp(mob.getY() + Math.sin(angle) * distance, bounds.minY, bounds.maxY);

  if (!killerClownIsFarEnough(targetX, targetY, allMobs, mob)) {
    targetX = mob.getX();
    targetY = mob.getY();
  }

  ai.walkDirection = {
    x: targetX - mob.getX(),
    y: targetY - mob.getY(),
  };
  const length = Math.hypot(ai.walkDirection.x, ai.walkDirection.y) || 1;
  ai.walkDirection.x /= length;
  ai.walkDirection.y /= length;
  ai.walkTimer = killerClownRandomBetween(
    KILLER_CLOWN_CONFIG.walkMinSeconds,
    KILLER_CLOWN_CONFIG.walkMaxSeconds,
  );
  ai.state = 'wander';
  mob.setAngle(Math.atan2(ai.walkDirection.y, ai.walkDirection.x) * 180 / Math.PI);
  killerClownSetAnimation(mob, KILLER_CLOWN_CONFIG.animations.walk, false);
}

function killerClownInitializeMob(mob, spawnZ, stateOverride, forcedPosition, floor, allMobs) {
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
  };

  if (state === 'idle') {
    killerClownSetAnimation(mob, KILLER_CLOWN_CONFIG.animations.idle, false);
  } else {
    killerClownBeginWander(mob, mob.__killerClownAI, allMobs, floor);
  }
}

function killerClownCreateMob(runtimeScene, spawnZ, forcedPosition, floor) {
  const current = runtimeScene.getObjects(KILLER_CLOWN_CONFIG.objectName);
  if (current.length >= KILLER_CLOWN_CONFIG.maxPopulation) return null;

  const mob = runtimeScene.createObject(KILLER_CLOWN_CONFIG.objectName);
  if (!mob) return null;

  killerClownInitializeMob(
    mob,
    spawnZ,
    undefined,
    forcedPosition,
    floor,
    runtimeScene.getObjects(KILLER_CLOWN_CONFIG.objectName),
  );
  return mob;
}

function killerClownBeginReturnHome(mob, ai) {
  ai.state = 'return';
  ai.target = null;
  ai.aggressive = false;
  ai.attackTimer = 0;
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

function killerClownUpdateIdleWander(mob, dt, ai, allMobs, floor) {
  if (ai.state === 'return') {
    killerClownUpdateReturnHome(mob, dt, ai);
    return;
  }

  if (ai.state === 'idle') {
    ai.idleTimer -= dt;
    killerClownSetAnimation(mob, KILLER_CLOWN_CONFIG.animations.idle, false);
    if (ai.idleTimer <= 0) killerClownBeginWander(mob, ai, allMobs, floor);
    return;
  }

  if (!ai.walkDirection || ai.walkTimer <= 0) {
    killerClownBeginWander(mob, ai, allMobs, floor);
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
    ai.idleTimer = killerClownRandomBetween(
      KILLER_CLOWN_CONFIG.idleMinSeconds,
      KILLER_CLOWN_CONFIG.idleMaxSeconds,
    );
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
    ai.attackTimer = 0;
    killerClownSetAnimation(mob, KILLER_CLOWN_CONFIG.animations.run, false);
    return;
  }

  // Sword_Attack is installed as LOOPED. Do not restart its timeline on a
  // timer; doing so cuts the GLB action short and makes the attack look stuck.
  mob.setAngle(Math.atan2(dy, dx) * 180 / Math.PI);
  ai.state = 'attack';
  killerClownSetAnimation(mob, KILLER_CLOWN_CONFIG.animations.attack, false);
}

function updateKillerClowns(runtimeScene, dt) {
  if (!runtimeScene.__havocKillerClownSystem) {
    runtimeScene.__havocKillerClownSystem = {
      initialized: false,
      respawnTimer: 0,
      spawnZ: null,
      spawnAnchor: null,
      spawnPositions: [],
    };
  }

  const system = runtimeScene.__havocKillerClownSystem;
  const floor = runtimeScene.getObjects('Floor')[0];
  const player = runtimeScene.getObjects(KILLER_CLOWN_CONFIG.targetObjectName)[0];
  if (!floor || !player) return;

  const bounds = killerClownGetFloorBounds(floor);
  if (bounds.maxX <= bounds.minX || bounds.maxY <= bounds.minY) return;

  if (!system.initialized) {
    system.initialized = true;
    const existing = runtimeScene.getObjects(KILLER_CLOWN_CONFIG.objectName);

    system.spawnZ = existing.length > 0 && typeof existing[0].getZ === 'function'
      ? existing[0].getZ()
      : 0;

    system.spawnAnchor = existing.length > 0
      ? { x: existing[0].getX(), y: existing[0].getY() }
      : {
          x: killerClownClamp((bounds.minX + bounds.maxX) * 0.5, bounds.minX, bounds.maxX),
          y: killerClownClamp((bounds.minY + bounds.maxY) * 0.5, bounds.minY, bounds.maxY),
        };

    // IMPORTANT: preserve the positions of already placed instances. The
    // previous implementation moved every existing mob to a floor-wide grid,
    // which made most of the population disappear outside the camera view.
    for (const mob of existing) {
      killerClownInitializeMob(mob, system.spawnZ, undefined, null, floor, existing);
    }

    system.spawnPositions = killerClownBuildClusterPositions(
      system.spawnAnchor.x,
      system.spawnAnchor.y,
      floor,
    );

    while (runtimeScene.getObjects(KILLER_CLOWN_CONFIG.objectName).length < KILLER_CLOWN_CONFIG.maxPopulation) {
      const current = runtimeScene.getObjects(KILLER_CLOWN_CONFIG.objectName);
      const forcedPosition = killerClownFindSpawnPosition(
        system.spawnAnchor,
        floor,
        current,
        system.spawnPositions,
      );
      if (!killerClownCreateMob(runtimeScene, system.spawnZ, forcedPosition, floor)) break;
    }
  }

  system.respawnTimer += dt;
  if (system.respawnTimer >= KILLER_CLOWN_CONFIG.respawnSeconds) {
    system.respawnTimer = 0;
    while (runtimeScene.getObjects(KILLER_CLOWN_CONFIG.objectName).length < KILLER_CLOWN_CONFIG.maxPopulation) {
      const current = runtimeScene.getObjects(KILLER_CLOWN_CONFIG.objectName);
      const forcedPosition = killerClownFindSpawnPosition(
        system.spawnAnchor,
        floor,
        current,
        system.spawnPositions,
      );
      if (!killerClownCreateMob(runtimeScene, system.spawnZ, forcedPosition, floor)) break;
    }
  }

  const allMobs = runtimeScene.getObjects(KILLER_CLOWN_CONFIG.objectName);
  for (const mob of allMobs) {
    if (!mob.__killerClownAI) {
      killerClownInitializeMob(mob, system.spawnZ, 'idle', null, floor, allMobs);
    }

    const ai = mob.__killerClownAI;
    if (ai.aggressive || ai.state === 'return') {
      killerClownUpdateAggressive(mob, dt, ai);
    } else {
      killerClownUpdateIdleWander(mob, dt, ai, allMobs, floor);
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
  ai.attackTimer = 0;
  return true;
}

if (typeof module !== 'undefined') {
  module.exports = { KILLER_CLOWN_CONFIG, updateKillerClowns, aggroKillerClown };
}
