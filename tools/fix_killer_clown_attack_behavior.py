from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'scripts' / 'mobs' / 'killer_clown' / 'killer-clown.js'
CONFIG = ROOT / 'scripts' / 'mobs' / 'killer_clown' / 'killer-clown.config.js'


def replace_once(source: str, old: str, new: str, label: str) -> str:
    if old not in source:
        raise RuntimeError(f'Expected {label} was not found in killer-clown.js.')
    return source.replace(old, new, 1)


def patch_source(source: str) -> str:
    # Keep the inline runtime copy synchronized with the intended combat range.
    if '  attackRange: 450,\n  attackCooldownSeconds: 0.8,' in source:
        source = source.replace(
            '  attackRange: 450,\n  attackCooldownSeconds: 0.8,',
            '  attackRange: 600,\n  attackCooldownSeconds: 0.8,\n  combatHardSeparation: 220,',
            1,
        )
    elif '  attackRange: 600,\n  attackCooldownSeconds: 0.8,' in source and 'combatHardSeparation: 220,' not in source:
        source = source.replace(
            '  attackRange: 600,\n  attackCooldownSeconds: 0.8,',
            '  attackRange: 600,\n  attackCooldownSeconds: 0.8,\n  combatHardSeparation: 220,',
            1,
        )

    # CRITICAL: inside attack range the mob must not use the crowd-separation
    # vector as movement. The previous implementation converted separation into
    # a tangent vector, which made mobs keep running/orbiting instead of attacking.
    old_tangent = '''  if (distance <= KILLER_CLOWN_CONFIG.attackRange) {
    let tangentX = -ny;
    let tangentY = nx;
    const tangentDot = separation.x * tangentX + separation.y * tangentY;

    if (Math.abs(tangentDot) < 0.08) {
      tangentX = separation.x;
      tangentY = separation.y;
    } else if (tangentDot < 0) {
      tangentX = -tangentX;
      tangentY = -tangentY;
    }

    return {
      x: tangentX,
      y: tangentY,
      separationMagnitude: separation.magnitude,
    };
  }
'''
    new_stop = '''  if (distance <= KILLER_CLOWN_CONFIG.attackRange) {
    // Attack range is a hard movement boundary. Once inside it, do not orbit,
    // strafe, or chase because of crowd separation. The mob stops and attacks.
    return {
      x: 0,
      y: 0,
      separationMagnitude: separation.magnitude,
    };
  }
'''
    if old_tangent in source:
        source = source.replace(old_tangent, new_stop, 1)
    elif 'Attack range is a hard movement boundary.' not in source:
        raise RuntimeError('Expected inside-attack-range steering block was not found.')

    # The attack state may still apply a separation vector. Restrict that to
    # genuine physical overlap so normal spacing never makes an attacker run.
    old_attack_separation = '''  if (move.separationMagnitude > 0) {
    const separationStep = Math.min(
      KILLER_CLOWN_CONFIG.combatSeparationSpeed * dt * move.separationMagnitude,
      KILLER_CLOWN_CONFIG.combatSeparationSpeed * dt,
    );
    mob.setPosition(
      mob.getX() + move.x * separationStep,
      mob.getY() + move.y * separationStep,
    );
    killerClownApplySpawnHeight(mob, ai.homeZ);
  }

  mob.setAngle(Math.atan2(dy, dx) * 180 / Math.PI);
  ai.state = 'attack';
'''
    new_attack_separation = '''  // Do not move merely because another attacker is within the normal combat
  // spacing. Only resolve a genuine hard overlap, otherwise the mob remains
  // stationary in attack range.
  if (move.separationMagnitude > 0 && move.separationMagnitude >= 0.95) {
    const hardSeparation = KILLER_CLOWN_CONFIG.combatHardSeparation || 220;
    let nearestOverlap = Infinity;

    for (const other of allMobs) {
      if (other === mob) continue;
      const otherAI = other.__killerClownAI;
      if (!otherAI || !otherAI.aggressive || otherAI.target !== target || otherAI.state === 'return') continue;

      const otherDistance = Math.hypot(
        mob.getX() - other.getX(),
        mob.getY() - other.getY(),
      );
      nearestOverlap = Math.min(nearestOverlap, otherDistance);
    }

    if (nearestOverlap < hardSeparation) {
      const separationStep = Math.min(
        KILLER_CLOWN_CONFIG.combatSeparationSpeed * dt,
        KILLER_CLOWN_CONFIG.combatSeparationSpeed * dt,
      );
      mob.setPosition(
        mob.getX() + move.x * separationStep,
        mob.getY() + move.y * separationStep,
      );
      killerClownApplySpawnHeight(mob, ai.homeZ);
    }
  }

  // Attack orientation is based only on the mob-to-player vector. The player's
  // facing direction has no bearing on whether this attack can hit.
  mob.setAngle(Math.atan2(dy, dx) * 180 / Math.PI);
  ai.state = 'attack';
'''
    if old_attack_separation in source:
        source = source.replace(old_attack_separation, new_attack_separation, 1)
    elif 'Only resolve a genuine hard overlap' not in source:
        raise RuntimeError('Expected attack-state separation block was not found.')

    return source


def main() -> None:
    source = SOURCE.read_text(encoding='utf-8')
    patched = patch_source(source)
    SOURCE.write_text(patched, encoding='utf-8', newline='\n')

    config = CONFIG.read_text(encoding='utf-8')
    config = config.replace('attackRange: 450,', 'attackRange: 600,', 1)
    CONFIG.write_text(config, encoding='utf-8', newline='\n')

    print('Patched Killer Clown attack behavior.')
    print('Attack range        : 600')
    print('Attack steering     : STOPPED inside attack range')
    print('Hard combat spacing : 220')
    print('Attack angle        : ANY POSITION / ANY PLAYER FACING')


if __name__ == '__main__':
    main()
