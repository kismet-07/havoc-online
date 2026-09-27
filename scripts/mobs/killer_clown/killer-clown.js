/**
 * Killer Clown V1.5 runtime behavior for GDevelop 5.
 *
 * The project is currently a single-file GDevelop project, so the installer
 * embeds this source into a JsCode event. Keep this file as the maintainable
 * source of truth.
 */

const KILLER_CLOWN_CONFIG = {
  objectName: 'Killer_clown',
  maxPopulation: 15,
  respawnSeconds: 15,
  animations: {
    idle: 'Idle_Sword',
    walk: 'Walk_Large',
    run: 'Run_Stealth',
    attack: 'Sword_Attack',
  },
  walkSpeed: 110,
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
};

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
  if (!floor) return;

  const floorMinX = floor.getX() + KILLER_CLOWN_CONFIG.boundaryMargin;
  const floorMaxX = floor.getX() + floor.getWidth() - KILLER_CLOWN_CONFIG.boundaryMargin;
  const floorMinY = floor.getY() + KILLER_CLOWN_CONFIG.boundaryMargin;
  const floorMaxY = floor.getY() + floor.getHeight() - KILLER_CLOWN_CONFIG.boundaryMargin;

  if (floorMaxX <= floorMinX || floorMaxY <= floorMinY) return;

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const randomBetween = (min, max) => min + Math.random() * (max - min);
  const distanceSquared = (x1, y1, x2, y2) => {
    const dx = x1 - x2;
    const dy = y1 - y2;
    return dx * dx + dy * dy;
  };

  const isFarEnough = (x, y, existing, minimumDistance, ignoreMob) => {
    const minimumDistanceSquared = minimumDistance * minimumDistance;
    for (const mob of existing) {
      if (mob === ignoreMob) continue;
      if (distanceSquared(x, y, mob.getX(), mob.getY()) < minimumDistanceSquared) return false;
    }
    return true;
  };

  const buildInitialSpawnPositions = () => {
    const positions = [];
    const columns = Math.max(1, Math.min(KILLER_CLOWN_CONFIG.spawnColumns, KILLER_CLOWN_CONFIG.maxPopulation));
    const rows = Math.max(1, Math.ceil(KILLER_CLOWN_CONFIG.maxPopulation / columns));
    const cellWidth = (floorMaxX - floorMinX) / columns;
    const cellHeight = (floorMaxY - floorMinY) / rows;

    for (let row = 0; row < rows && positions.length < KILLER_CLOWN_CONFIG.maxPopulation; row += 1) {
      for (let column = 0; column < columns && positions.length < KILLER_CLOWN_CONFIG.maxPopulation; column += 1) {
        const centerX = floorMinX + cellWidth * (column + 0.5);
        const centerY = floorMinY + cellHeight * (row + 0.5);
        const jitterX = cellWidth * KILLER_CLOWN_CONFIG.spawnJitter * 0.5;
        const jitterY = cellHeight * KILLER_CLOWN_CONFIG.spawnJitter * 0.5;
        positions.push({
          x: clamp(randomBetween(centerX - jitterX, centerX + jitterX), floorMinX, floorMaxX),
          y: clamp(randomBetween(centerY - jitterY, centerY + jitterY), floorMinY, floorMaxY),
        });
      }
    }

    return positions;
  };

  const randomFloorPosition = (existing, ignoreMob) => {
    for (let attempt = 0; attempt < KILLER_CLOWN_CONFIG.spawnAttempts; attempt += 1) {
      const x = randomBetween(floorMinX, floorMaxX);
      const y = randomBetween(floorMinY, floorMaxY);
      if (isFarEnough(x, y, existing, KILLER_CLOWN_CONFIG.minimumSeparation, ignoreMob)) {
        return { x, y };
      }
    }

    return {
      x: randomBetween(floorMinX, floorMaxX),
      y: randomBetween(floorMinY, floorMaxY),
    };
  };

  const randomWanderTarget = (mob, existing) => {
    const availableWidth = floorMaxX - floorMinX;
    const availableHeight = floorMaxY - floorMinY;
    const maxTravelDistance = Math.max(1200, Math.min(availableWidth, availableHeight) * 0.45);
    const minTravelDistance = Math.min(1100, maxTravelDistance * 0.75);

    for (let attempt = 0; attempt < KILLER_CLOWN_CONFIG.spawnAttempts; attempt += 1) {
      const angle = Math.random() * Math.PI * 2;
      const distance = randomBetween(minTravelDistance, maxTravelDistance);
      const targetX = clamp(mob.getX() + Math.cos(angle) * distance, floorMinX, floorMaxX);
      const targetY = clamp(mob.getY() + Math.sin(angle) * distance, floorMinY, floorMaxY);
      const actualDistance = Math.sqrt(distanceSquared(targetX, targetY, mob.getX(), mob.getY()));

      if (actualDistance < 700) continue;
      if (!isFarEnough(targetX, targetY, existing, KILLER_CLOWN_CONFIG.minimumSeparation, mob)) continue;

      return { x: targetX, y: targetY };
    }

    return randomFloorPosition(existing, mob);
  };

  const applySpawnHeight = (mob) => {
    if (system.spawnZ !== null && typeof mob.setZ === 'function') {
      mob.setZ(system.spawnZ);
    }
  };

  const holdIdlePosition = (mob, ai) => {
    if (typeof mob.resetEstimatedVelocity === 'function') mob.resetEstimatedVelocity();
    mob.setPosition(ai.idleHoldX, ai.idleHoldY);
    applySpawnHeight(mob);
    mob.setAnimationName(KILLER_CLOWN_CONFIG.animations.idle);
    mob.setAnimationSpeedScale(1);
  };

  const beginWander = (mob, ai, allMobs) => {
    const target = randomWanderTarget(mob, allMobs);
    ai.targetX = target.x;
    ai.targetY = target.y;
    ai.state = 'wander';
    ai.timer = randomBetween(KILLER_CLOWN_CONFIG.walkMinSeconds, KILLER_CLOWN_CONFIG.walkMaxSeconds);
    applySpawnHeight(mob);
    mob.setAngle(Math.atan2(target.y - mob.getY(), target.x - mob.getX()) * 180 / Math.PI);
    mob.setAnimationName(KILLER_CLOWN_CONFIG.animations.walk);
    mob.setAnimationSpeedScale(1);
  };

  const initializeMob = (mob, stateOverride, forcedPosition) => {
    const allMobs = runtimeScene.getObjects(KILLER_CLOWN_CONFIG.objectName);
    const position = forcedPosition || randomFloorPosition(allMobs, mob);
    mob.setPosition(position.x, position.y);
    applySpawnHeight(mob);

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
      holdIdlePosition(mob, mob.__killerClownAI);
      return;
    }

    beginWander(mob, mob.__killerClownAI, allMobs);
  };

  const createMob = (forcedPosition) => {
    const current = runtimeScene.getObjects(KILLER_CLOWN_CONFIG.objectName);
    if (current.length >= KILLER_CLOWN_CONFIG.maxPopulation) return null;
    const mob = runtimeScene.createObject(KILLER_CLOWN_CONFIG.objectName);
    if (!mob) return null;
    applySpawnHeight(mob);
    initializeMob(mob, undefined, forcedPosition);
    return mob;
  };

  if (!system.initialized) {
    system.initialized = true;

    const existing = runtimeScene.getObjects(KILLER_CLOWN_CONFIG.objectName);
    if (existing.length > 0 && typeof existing[0].getZ === 'function') {
      system.spawnZ = existing[0].getZ();
    }

    const spawnPositions = buildInitialSpawnPositions();

    for (let i = 0; i < existing.length && i < spawnPositions.length; i += 1) {
      initializeMob(existing[i], undefined, spawnPositions[i]);
    }

    let spawnIndex = existing.length;
    while (runtimeScene.getObjects(KILLER_CLOWN_CONFIG.objectName).length < KILLER_CLOWN_CONFIG.maxPopulation) {
      const forcedPosition = spawnPositions[spawnIndex] || randomFloorPosition(
        runtimeScene.getObjects(KILLER_CLOWN_CONFIG.objectName),
        null,
      );
      if (!createMob(forcedPosition)) break;
      spawnIndex += 1;
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
    if (!mob.__killerClownAI) initializeMob(mob, 'idle');

    const ai = mob.__killerClownAI;
    if (ai.dead || ai.aggressive) continue;

    ai.timer -= dt;

    if (ai.state === 'idle') {
      holdIdlePosition(mob, ai);

      if (ai.timer <= 0) {
        beginWander(mob, ai, allMobs);
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
        holdIdlePosition(mob, ai);
        continue;
      }

      const nx = dx / distance;
      const ny = dy / distance;
      const step = Math.min(KILLER_CLOWN_CONFIG.walkSpeed * dt, distance);
      const nextX = clamp(mob.getX() + nx * step, floorMinX, floorMaxX);
      const nextY = clamp(mob.getY() + ny * step, floorMinY, floorMaxY);

      if (!isFarEnough(nextX, nextY, allMobs, KILLER_CLOWN_CONFIG.minimumSeparation, mob)) {
        beginWander(mob, ai, allMobs);
        continue;
      }

      mob.setPosition(nextX, nextY);
      applySpawnHeight(mob);
      mob.setAnimationName(KILLER_CLOWN_CONFIG.animations.walk);
      mob.setAnimationSpeedScale(1);
    }
  }
}

function aggroKillerClown(mob) {
  if (!mob || !mob.__killerClownAI || (mob.getName && mob.getName() !== KILLER_CLOWN_CONFIG.objectName)) return;
  mob.__killerClownAI.aggressive = true;
  mob.__killerClownAI.state = 'aggro';
  mob.setAnimationName(KILLER_CLOWN_CONFIG.animations.run);
}

if (typeof module !== 'undefined') {
  module.exports = { KILLER_CLOWN_CONFIG, updateKillerClowns, aggroKillerClown };
}
