/**
 * Killer Clown runtime behavior for GDevelop 5.
 *
 * Runtime responsibilities:
 *   population -> idle/wander -> aggro -> chase -> attack
 *                                      \-> leash exceeded -> return home
 *
 * The scene contains one Killer_clown template instance. Missing population
 * members are created around that template's spawn point.
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
  spawnAttempts: 120,
  attackRange: 450,
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
  const halfWidth = ((columns - 1) * KILLER_CLOWN_CONFIG.spawnSpacing) / 2;
  const halfHeight = ((rows - 1) * KILLER_CLOWN_CONFIG.spawnSpacing) / 2;

  // Clamp the cluster CENTER, not each point. Clamping each point separately
  // can compress the outer row/column and break minimum separation near edges.
  const centerX = killerClownClamp(
    anchorX,
    bounds.minX + halfWidth,
    bounds.maxX - halfWidth,
  );
  const centerY = killerClownClamp(
    anchorY,
    bounds.minY + halfHeight,
    bounds.maxY - halfHeight,
  );

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      positions.push({
        x: centerX + (column - (columns - 1) / 2) * KILLER_CLOWN_CONFIG.spawnSpacing,
        y: centerY + (row - (rows - 1) / 2) * KILLER_CLOWN_CONFIG.spawnSpacing,
      });
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

  // Fallback remains around the original template instead of scattering new
  // mobs across the entire floor.
  for (let attempt = 0; attempt < KILLER_CLOWN_CONFIG.spawnAttempts; attempt += 1) {
    const angle = Math.random() * Math.PI * 2;
    const radius = killerClownRandomBetween(1200, 3000);
    const x = killerClownClamp(anchor.x + Math.cos(angle) * radius, bounds.minX, bounds.maxX);
    const y = killerClownClamp(anchor.y + Math.sin(angle) * radius, bounds.minY, bounds.maxY);
    if (killerClownIsFarEnough(x, y, existing, null)) return { x, y };
  }

  // Never intentionally stack a clone on another mob.
  return null;
}

function killerClownChooseWanderDirection(mob, allMobs, floor) {
  const bounds = killerClownGetFloorBounds(floor);
  const preferredAngle = Math.random() * Math.PI * 2;

  for (let attempt = 0; attempt < 24; attempt += 1) {
    const angle = attempt === 0
      ? preferredAngle
      : Math.random() * Math.PI * 2;
    const distance = killerClownRandomBetween(700, 1400);
    const targetX = killerClownClamp(
      mob.getX() + Math.cos(angle) * distance,
      bounds.minX,
      bounds.maxX,
    );
    const targetY = killerClownClamp(
      mob.getY() + Math.sin(angle) * distance,
      bounds.minY,
      bounds.maxY,
    );

    if (killerClownIsFarEnough(targetX, targetY, allMobs, mob)) {
      return { x: Math.cos(angle), y: Math.sin(angle) };
    }
  }

  return null;
}

function killerClownBeginWander(mob, ai, allMobs, floor) {
  const direction = killerClownChooseWanderDirection(mob, allMobs, floor);
  if (!direction) {
    ai.walkDirection = null;
    ai.state = 'idle';
    ai.idleTimer = 0.5;
    killerClownSetAnimation(mob, KILLER_CLOWN_CONFIG.animations.idle, false);
    return;
  }

  ai.walkDirection = direction;
  ai.walkTimer = killerClownRandomBetween(
    KILLER_CLOWN_CONFIG.walkMinSeconds,
    KILLER_CLOWN_CONFIG.walkMaxSeconds,
  );
  ai.state = 'wander';
  mob.setAngle(Math.atan2(direction.y, direction.x) * 180 / Math.PI);
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
  if (!forcedPosition) return null;

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
  ai.walkDirection = null;
  killerClownSetAnimation(mob, KILLER_CLOWN_CONFIG.animations.run, false);
}

function killerClownUpdateReturnHome(mob, dt, ai) {
  const dx = ai.homeX - mob.getX();
  const dy = ai.homeY - mob.getY();
  const distance = Math.hypot(dx, dy);

  if (distance <= KILLER_CLOWN_CONFIG.homeArrivalDistance || distance <= 0.001) {
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
    if (ai.state !== 'wander') return;
  }

  ai.walkTimer -= dt;
  const step = KILLER_CLOWN_CONFIG.walkSpeed * dt;
  const bounds = killerClownGetFloorBounds(floor);
  const nextX = killerClownClamp(
    mob.getX() + ai.walkDirection.x * step,
    bounds.minX,
    bounds.maxX,
  );
  const nextY = killerClownClamp(
    mob.getY() + ai.walkDirection.y * step,
    bounds.minY,
    bounds.maxY,
  );

  if (!killerClownIsFarEnough(nextX, nextY, allMobs, mob)) {
    // Never walk through another mob. Pick a new direction on the next tick.
    ai.walkDirection = null;
    ai.walkTimer = 0;
    ai.state = 'idle';
    ai.idleTimer = 0;
    killerClownSetAnimation(mob, KILLER_CLOWN_CONFIG.animations.idle, false);
    return;
  }

  mob.setPosition(nextX, nextY);
  killerClownApplySpawnHeight(mob, ai.homeZ);
  mob.setAngle(Math.atan2(ai.walkDirection.y, ai.walkDirection.x) * 180 / Math.PI);
  killerClownSetAnimation(mob, KILLER_CLOWN_CONFIG.animations.walk, false);

  const distanceFromHome = Math.hypot(mob.getX() - ai.homeX, mob.getY() - ai.homeY);
  if (distanceFromHome >= KILLER_CLOWN_CONFIG.boundaryMargin) {
    ai.walkDirection = null;
    ai.walkTimer = 0;
    ai.state = 'idle';
    ai.idleTimer = killerClownRandomBetween(
      KILLER_CLOWN_CONFIG.idleMinSeconds,
      KILLER_CLOWN_CONFIG.idleMaxSeconds,
    );
    killerClownSetAnimation(mob, KILLER_CLOWN_CONFIG.animations.idle, false);
    return;
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

    // Preserve already placed instances exactly where they are.
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
      if (!forcedPosition) break;
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
      if (!forcedPosition) break;
      if (!killerClownCreateMob(runtimeScene, system.spawnZ, forcedPosition, floor)) break;
    }
  }

  const allMobs = runtimeScene.getObjects(KILLER_CLOWN_CONFIG.objectName);
  for (const mob of allMobs) {
    if (!mob.__killerClownAI) {
      killerClownInitializeMob(mob, system.spawnZ, 'idle', null, floor, allMobs);
    }

    const ai = mob.__killerClownAI;

    // RETURN is a real state. Do not send it through aggressive update:
    // target is intentionally null while the mob travels back home.
    if (ai.state === 'return') {
      killerClownUpdateReturnHome(mob, dt, ai);
    } else if (ai.aggressive) {
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
  ai.walkDirection = null;
  return true;
}

if (typeof module !== 'undefined') {
  module.exports = { KILLER_CLOWN_CONFIG, updateKillerClowns, aggroKillerClown };
}
