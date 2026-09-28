from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PROJECT = ROOT / 'Havoc Online.json'
SOURCE = ROOT / 'scripts' / 'input' / 'mobile-controller.js'
BACKUP = ROOT / 'Havoc Online.json.before-mobile-input-safe-sync.bak'
MARKER = 'function initializeHavocMobileInput'


def find_target_inline_array(raw: str) -> tuple[int, int]:
    matches: list[tuple[int, int]] = []

    for match in re.finditer(r'"inlineCode"\s*:\s*\[', raw):
        array_start = raw.find('[', match.start(), match.end())
        if array_start < 0:
            continue

        try:
            value, end = json.JSONDecoder().raw_decode(raw[array_start:])
        except json.JSONDecodeError:
            continue

        if isinstance(value, list) and any(
            isinstance(line, str) and MARKER in line for line in value
        ):
            matches.append((array_start, array_start + end))

    if len(matches) != 1:
        raise SystemExit(
            f'Safety check failed: expected exactly one mobile-controller inline array, found {len(matches)}.'
        )

    return matches[0]


def main() -> None:
    if not PROJECT.exists():
        raise SystemExit(f'Project file not found: {PROJECT}')
    if not SOURCE.exists():
        raise SystemExit(f'Source file not found: {SOURCE}')

    raw = PROJECT.read_text(encoding='utf-8')
    source_lines = SOURCE.read_text(encoding='utf-8').splitlines()

    start, end = find_target_inline_array(raw)
    replacement = json.dumps(source_lines, ensure_ascii=False, separators=(',', ':'))

    if not BACKUP.exists():
        BACKUP.write_text(raw, encoding='utf-8', newline='\n')

    updated = raw[:start] + replacement + raw[end:]
    json.loads(updated)  # Validate the complete project before writing.
    PROJECT.write_text(updated, encoding='utf-8', newline='\n')

    print('Byte-preserving mobile input inline synchronization complete.')
    print('Replaced exactly one inline mobile-controller array.')
    print('Desktop left-mouse target selection now uses the press transition.')
    print('Mouse release no longer generates a second target-selection request.')
    print(f'Backup: {BACKUP.name}')
    print('The rest of Havoc Online.json was preserved byte-for-byte.')


if __name__ == '__main__':
    main()
