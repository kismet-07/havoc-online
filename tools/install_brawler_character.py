from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PROJECT = ROOT / 'Havoc Online.json'
BRAWLER_DIR = ROOT / 'scripts' / 'characters' / 'brawler'
INPUT_DIR = ROOT / 'scripts' / 'input'
COMBAT_DIR = ROOT / 'scripts' / 'combat'
MARKER = '// HAVOC_BRAWLER_CHARACTER_V1'

SOURCE_FILES = [
    (INPUT_DIR / 'mobile-controller.js', 'scripts/input/mobile-controller.js'),
    (COMBAT_DIR / 'target-system.js', 'scripts/combat/target-system.js'),
    (BRAWLER_DIR / 'config.js', 'scripts/characters/brawler/config.js'),
    (BRAWLER_DIR / 'animation.js', 'scripts/characters/brawler/animation.js'),
    (BRAWLER_DIR / 'movement.js', 'scripts/characters/brawler/movement.js'),
    (BRAWLER_DIR / 'basic_attacks.js', 'scripts/characters/brawler/basic_attacks.js'),
    (BRAWLER_DIR / 'combat.js', 'scripts/characters/brawler/combat.js'),
]


def build_source() -> list[str]:
    lines = [MARKER]
    for source_path, display_path in SOURCE_FILES:
        lines.append(f'// --- {display_path} ---')
        lines.extend(source_path.read_text(encoding='utf-8').splitlines())
        lines.append('')

    lines.extend([
        '// --- Brawler runtime entry point ---',
        "const brawlerDt = gdjs.evtTools.runtimeScene.getElapsedTimeInSeconds(runtimeScene);",
        'initializeHavocMobileInput(runtimeScene);',
        'updateHavocMobileInput(runtimeScene);',
        'updateBrawlerMovement(runtimeScene, brawlerDt);',
        'updateBrawlerCombat(runtimeScene, brawlerDt);',
    ])
    return lines


def install() -> None:
    if not PROJECT.exists():
        raise RuntimeError(f'Missing project file: {PROJECT}')

    project = json.loads(PROJECT.read_text(encoding='utf-8'))
    replacement = build_source()
    matches = []

    for layout_index, layout in enumerate(project.get('layouts', [])):
        for event_index, event in enumerate(layout.get('events', [])):
            if event.get('type') != 'BuiltinCommonInstructions::JsCode':
                continue
            inline = event.get('inlineCode', [])
            if MARKER in '\n'.join(inline):
                matches.append((layout_index, event_index, event))

    if len(matches) != 1:
        raise RuntimeError(
            f'Safety check failed: expected exactly one {MARKER} event, found {len(matches)}.'
        )

    layout_index, event_index, event = matches[0]
    event['inlineCode'] = replacement

    PROJECT.write_text(
        json.dumps(project, indent=2, ensure_ascii=False),
        encoding='utf-8',
        newline='\n',
    )

    print('Brawler inline-code synchronization complete.')
    print(f'Replaced Brawler event: layouts[{layout_index}].events[{event_index}]')
    print('Source files embedded:')
    for _, display_path in SOURCE_FILES:
        print(f'  - {display_path}')
    print('No layout objects, instances, layers, target indicator, Killer Clown event, HP, damage, or database data were modified.')


if __name__ == '__main__':
    install()
