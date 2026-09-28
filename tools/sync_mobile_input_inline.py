from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PROJECT = ROOT / 'Havoc Online.json'
SOURCE = ROOT / 'scripts' / 'input' / 'mobile-controller.js'
BACKUP = ROOT / 'Havoc Online.json.before-mobile-input-sync.bak'


def main() -> None:
    if not PROJECT.exists():
        raise SystemExit(f'Project file not found: {PROJECT}')
    if not SOURCE.exists():
        raise SystemExit(f'Source file not found: {SOURCE}')

    project = json.loads(PROJECT.read_text(encoding='utf-8'))
    source_lines = SOURCE.read_text(encoding='utf-8').splitlines()

    matches: list[tuple[dict, int]] = []

    def walk(value):
        if isinstance(value, dict):
            if value.get('type') == 'BuiltinCommonInstructions::JsCode':
                inline = value.get('inlineCode')
                if isinstance(inline, list) and any(
                    isinstance(line, str) and 'function initializeHavocMobileInput' in line
                    for line in inline
                ):
                    matches.append((value, len(inline)))
            for child in value.values():
                walk(child)
        elif isinstance(value, list):
            for child in value:
                walk(child)

    walk(project)

    if len(matches) != 1:
        raise SystemExit(
            f'Safety check failed: expected exactly one inline mobile-controller section, found {len(matches)}.'
        )

    if not BACKUP.exists():
        BACKUP.write_text(PROJECT.read_text(encoding='utf-8'), encoding='utf-8', newline='\n')

    matches[0][0]['inlineCode'] = source_lines
    PROJECT.write_text(
        json.dumps(project, ensure_ascii=False, indent=2) + '\n',
        encoding='utf-8',
        newline='\n',
    )

    print('Mobile input inline-code synchronization complete.')
    print('Inline mobile-controller sections replaced: 1')
    print('Desktop left-mouse target selection now uses the press transition.')
    print('Mouse release no longer generates a second target-selection request.')
    print(f'Backup: {BACKUP.name}')
    print('No target, combat, movement, HP, damage, or Killer Clown logic was intentionally changed.')


if __name__ == '__main__':
    main()
