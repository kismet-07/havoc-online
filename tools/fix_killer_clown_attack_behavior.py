from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'scripts' / 'mobs' / 'killer_clown' / 'killer-clown.js'
CONFIG = ROOT / 'scripts' / 'mobs' / 'killer_clown' / 'killer-clown.config.js'


def patch_source(source: str) -> str:
    if 'combatHardSeparation: 220,' not in source:
        old = '  attackRange: 450,\n  attackCooldownSeconds: 0.8,'
        if old not in source:
            raise RuntimeError('Expected Killer Clown attack configuration was not found.')
        source = source.replace(old, '  attackRange: 600,\n  attackCooldownSeconds: 0.8,\n  combatHardSeparation: 220,', 1)

    if 'crowd steering. Do not orbit the player' not in source:
        start = source.find('  if (distance <= KILLER_CLOWN_CONFIG.attackRange) {', source.find('function killerClownGetCombatMoveVector'))
        end = source.find('\n  // Outside attack range', start)
        if start < 0 or end < 0:
            raise RuntimeError('Expected attack-range steering block was not found.')
        replacement = '''  if (distance <= KILLER_CLOWN_CONFIG.attackRange) {\n    // Once the mob is in attack range, target distance takes priority over\n    // crowd steering. Do not orbit the player just because another attacker\n    // is nearby; that makes the mob look like it is still chasing.\n    //\n    // The separation vector is retained only as an emergency signal. Actual\n    // overlap is resolved in the attack-state update below.\n    return {\n      x: 0,\n      y: 0,\n      separationMagnitude: separation.magnitude,\n    };\n  }\n'''
        source = source[:start] + replacement + source[end:]

    if 'Only resolve genuine' not in source:
        old = '''  if (move.separationMagnitude > 0) {\n    const separationStep = Math.min(\n      KILLER_CLOWN_CONFIG.combatSeparationSpeed * dt * move.separationMagnitude,\n      KILLER_CLOWN_CONFIG.combatSeparationSpeed * dt,\n    );\n    mob.setPosition(\n      mob.getX() + move.x * separationStep,\n      mob.getY() + move.y * separationStep,\n    );\n    killerClownApplySpawnHeight(mob, ai.homeZ);\n  }\n\n  mob.setAngle(Math.atan2(dy, dx) * 180 / Math.PI);\n  ai.state = 'attack';\n'''
        if old not in source:
            raise RuntimeError('Expected attack-state separation block was not found.')
        new = '''  // In attack range, stop the chase completely. Only resolve genuine\n  // attacker-on-attacker overlap; normal combat spacing must not make the\n  // attacker run around the player instead of attacking.\n  const combatSeparation = killerClownGetCombatSeparation(mob, target, allMobs);\n  if (combatSeparation.magnitude > 0) {\n    let nearestOverlap = Infinity;\n    for (const other of allMobs) {\n      if (other === mob) continue;\n      const otherAI = other.__killerClownAI;\n      if (!otherAI || !otherAI.aggressive || otherAI.target !== target || otherAI.state === 'return') continue;\n      const otherDistance = Math.hypot(mob.getX() - other.getX(), mob.getY() - other.getY());\n      nearestOverlap = Math.min(nearestOverlap, otherDistance);\n    }\n\n    if (nearestOverlap < KILLER_CLOWN_CONFIG.combatHardSeparation) {\n      const separationStep = Math.min(\n        KILLER_CLOWN_CONFIG.combatSeparationSpeed * dt * combatSeparation.magnitude,\n        KILLER_CLOWN_CONFIG.combatSeparationSpeed * dt,\n      );\n      mob.setPosition(\n        mob.getX() + combatSeparation.x * separationStep,\n        mob.getY() + combatSeparation.y * separationStep,\n      );\n      killerClownApplySpawnHeight(mob, ai.homeZ);\n    }\n  }\n\n  // Attack orientation is independent of the player's facing direction.\n  // The mob always faces its target before entering the attack state.\n  mob.setAngle(Math.atan2(dy, dx) * 180 / Math.PI);\n  ai.state = 'attack';\n'''
        source = source.replace(old, new, 1)

    return source


def main() -> None:
    source = SOURCE.read_text(encoding='utf-8')
    SOURCE.write_text(patch_source(source), encoding='utf-8', newline='\n')

    config = CONFIG.read_text(encoding='utf-8')
    if 'attackRange: 450,' in config:
        config = config.replace('attackRange: 450,', 'attackRange: 600,', 1)
    CONFIG.write_text(config, encoding='utf-8', newline='\n')

    print('Patched Killer Clown attack behavior.')
    print('Attack range        : 600')
    print('Attack steering     : DISABLED inside attack range')
    print('Hard combat spacing : 220')
    print('Attack angle        : ANY POSITION / ANY PLAYER FACING')


if __name__ == '__main__':
    main()
