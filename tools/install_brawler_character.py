from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PROJECT = ROOT / 'Havoc Online.json'
SOURCE_DIR = ROOT / 'scripts' / 'characters' / 'brawler'
MARKER = '// HAVOC_BRAWLER_CHARACTER_V1'

SOURCE_FILES = [
    'config.js',
    'animation.js',
    'movement.js',
    'basic_attacks.js',
    'combat.js',
]


def build_source() -> list[str]:
    lines = [MARKER]
    for filename in SOURCE_FILES:
        lines.append(f'// --- scripts/characters/brawler/{filename} ---')
        lines.extend((SOURCE_DIR / filename).read_text(encoding='utf-8').splitlines())
        lines.append('')

    lines.extend([
        '// --- Brawler runtime entry point ---',
        "const brawlerDt = gdjs.evtTools.runtimeScene.getElapsedTimeInSeconds(runtimeScene);",
        'updateBrawlerMovement(runtimeScene, brawlerDt);',
    ])
    return lines


def install() -> None:
    project = json.loads(PROJECT.read_text(encoding='utf-8'))
    replacement = build_source()
    found = False

    for layout in project.get('layouts', []):
        for event in layout.get('events', []):
            if event.get('type') != 'BuiltinCommonInstructions::JsCode':
                continue

            inline = event.get('inlineCode', [])
            joined = '\n'.join(inline)

            # The current first event is the Brawler movement/camera event.
            # The fallback makes the installer work before the marker exists.
            if MARKER in joined or "runtimeScene.getObjects('Character')[0]" in joined:
                event['inlineCode'] = replacement
                found = True
                break

        if found:
            break

    if not found:
        raise RuntimeError('Brawler JavaScript event was not found.')

    PROJECT.write_text(
        json.dumps(project, indent=2, ensure_ascii=False),
        encoding='utf-8',
        newline='\n',
    )

    print('Installed modular Brawler character source.')
    print('Movement behavior preserved.')
    print('Camera behavior preserved.')
    print('Combat controller remains inactive.')
    print('Killer Clown event was not modified.')


if __name__ == '__main__':
    install()
