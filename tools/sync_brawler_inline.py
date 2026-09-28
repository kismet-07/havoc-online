from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PROJECT = ROOT / 'Havoc Online.json'

SOURCE_FILES = [
    ROOT / 'scripts' / 'input' / 'mobile-controller.js',
    ROOT / 'scripts' / 'combat' / 'target-system.js',
    ROOT / 'scripts' / 'characters' / 'brawler' / 'config.js',
    ROOT / 'scripts' / 'characters' / 'brawler' / 'animation.js',
    ROOT / 'scripts' / 'characters' / 'brawler' / 'movement.js',
    ROOT / 'scripts' / 'characters' / 'brawler' / 'basic_attacks.js',
    ROOT / 'scripts' / 'characters' / 'brawler' / 'combat.js',
]

MARKER = '// HAVOC_BRAWLER_CHARACTER_V1'
TARGET_ICON = 'TargetSelectionIcon'
OBSOLETE = (
    'TargetSelectionArrowStem',
    'TargetSelectionArrowHead',
    'TargetSelectionRingTop',
    'TargetSelectionRingBottom',
    'TargetSelectionRingLeft',
    'TargetSelectionRingRight',
)


def build_inline_source() -> list[str]:
    lines = [MARKER]
    for path in SOURCE_FILES:
        rel = path.relative_to(ROOT).as_posix()
        lines.append(f'// --- {rel} ---')
        lines.extend(path.read_text(encoding='utf-8').splitlines())
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


def find_brawler_events(project: dict) -> list[dict]:
    found = []
    for layout in project.get('layouts', []):
        for event in layout.get('events', []):
            if event.get('type') != 'BuiltinCommonInstructions::JsCode':
                continue
            inline = event.get('inlineCode', [])
            text = '\n'.join(inline)
            if MARKER in text or 'initializeHavocMobileInput' in text or 'initializeBrawlerCombat' in text:
                found.append(event)
    return found


def main() -> None:
    project = json.loads(PROJECT.read_text(encoding='utf-8'))
    events = find_brawler_events(project)

    if len(events) != 1:
        raise SystemExit(
            f'Safety check failed: expected exactly one brawler inline JS event, found {len(events)}.'
        )

    source = build_inline_source()
    events[0]['inlineCode'] = source

    serialized = json.dumps(project, ensure_ascii=False)
    for token in OBSOLETE:
        if token in serialized:
            raise SystemExit(
                f'Safety check failed: obsolete target indicator reference remains: {token}'
            )

    if TARGET_ICON not in serialized:
        raise SystemExit(
            'Safety check failed: TargetSelectionIcon is missing. Refusing to modify the project.'
        )

    combat_source = (ROOT / 'scripts' / 'characters' / 'brawler' / 'combat.js').read_text(encoding='utf-8')
    if 'return !!target && !target.isDestroyed;' not in combat_source:
        raise SystemExit(
            'Safety check failed: combat target validity is not using the current destroyed-only rule.'
        )

    backup = PROJECT.with_name(PROJECT.name + '.before-brawler-inline-sync.bak')
    backup.write_text(PROJECT.read_text(encoding='utf-8'), encoding='utf-8', newline='\n')
    PROJECT.write_text(
        json.dumps(project, indent=2, ensure_ascii=False),
        encoding='utf-8',
        newline='\n',
    )

    print('Brawler inline-code synchronization complete.')
    print('Replaced exactly one inline brawler JS event from the external source files.')
    print('Preserved TargetSelectionIcon and refused obsolete target-arrow objects.')
    print('Current combat target validity: destroyed-only.')
    print('Desktop target selection: mouse press transition.')
    print('Mouse release: no target-selection request.')
    print(f'Backup: {backup.name}')


if __name__ == '__main__':
    main()
