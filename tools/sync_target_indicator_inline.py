import json
from pathlib import Path

PROJECT = Path('Havoc Online.json')
EXTERNAL = Path('scripts/combat/target-system.js')
BACKUP = PROJECT.with_suffix('.json.before-target-inline-sync.bak')

START_MARKER = '// --- scripts/combat/target-system.js ---'
END_MARKER = '// --- scripts/characters/brawler/config.js ---'
STALE_NAMES = {'TargetSelectionArrowStem', 'TargetSelectionArrowHead'}
KEEP_NAMES = {'TargetSelectionIcon'}


def replace_in_list(node, replacement):
    """Replace the target-system section inside the project's inlineCode list."""
    if not isinstance(node, list):
        return 0

    for i, value in enumerate(node):
        if value == START_MARKER:
            end = None
            for j in range(i + 1, len(node)):
                if node[j] == END_MARKER:
                    end = j
                    break
            if end is None:
                raise RuntimeError('Found target-system start marker but not the brawler config end marker.')

            node[i:end] = [START_MARKER, *replacement.splitlines(), END_MARKER]
            return 1

    for value in node:
        if isinstance(value, (dict, list)) and replace_in_list(value, replacement):
            return 1
    return 0


def remove_stale_names(node):
    removed = 0
    if isinstance(node, dict):
        for key, value in list(node.items()):
            if key in {'name', 'objectName'} and value in STALE_NAMES:
                return 0
            removed += remove_stale_names(value)
    elif isinstance(node, list):
        kept = []
        for value in node:
            if isinstance(value, dict) and value.get('name') in STALE_NAMES:
                removed += 1
                continue
            if value in STALE_NAMES:
                removed += 1
                continue
            kept.append(value)
            removed += remove_stale_names(value)
        node[:] = kept
    return removed


def main():
    if not PROJECT.exists():
        raise SystemExit(f'Missing {PROJECT}')
    if not EXTERNAL.exists():
        raise SystemExit(f'Missing {EXTERNAL}')

    data = json.loads(PROJECT.read_text(encoding='utf-8'))
    external = EXTERNAL.read_text(encoding='utf-8').replace('\r\n', '\n').replace('\r', '\n').rstrip('\n')

    if 'TargetSelectionIcon' not in external:
        raise SystemExit('Safety check failed: external target-system.js does not contain TargetSelectionIcon.')
    if 'TargetSelectionArrowStem' in external or 'TargetSelectionArrowHead' in external:
        raise SystemExit('Safety check failed: external target-system.js still references obsolete arrow objects.')

    original = json.dumps(data, indent=2, ensure_ascii=False) + '\n'
    backup = PROJECT.with_name(PROJECT.name + '.before-target-inline-sync.bak')
    backup.write_text(original, encoding='utf-8', newline='\n')

    replaced = replace_in_list(data, external)
    if replaced != 1:
        raise SystemExit(f'Safety check failed: expected exactly one target-system inline section, found {replaced}.')

    # Remove only stale object-folder entries / references. Object definitions and instances
    # are not blindly rewritten here; the installed TargetSelectionIcon remains untouched.
    removed = remove_stale_names(data.get('objectsFolderStructure', {}))

    output = json.dumps(data, indent=2, ensure_ascii=False) + '\n'
    PROJECT.write_text(output, encoding='utf-8', newline='\n')

    # Post-write validation.
    verify = json.loads(PROJECT.read_text(encoding='utf-8'))
    verify_text = json.dumps(verify, ensure_ascii=False)
    if START_MARKER not in verify_text:
        raise SystemExit('Validation failed: target-system marker missing after write.')
    if 'TargetSelectionArrowStem' in verify_text or 'TargetSelectionArrowHead' in verify_text:
        raise SystemExit('Validation failed: obsolete target-arrow references remain in objectsFolderStructure.')
    if 'TargetSelectionIcon' not in verify_text:
        raise SystemExit('Validation failed: TargetSelectionIcon disappeared.')

    print('Target indicator inline-code synchronization complete.')
    print(f'Inline target-system sections replaced: {replaced}')
    print(f'Stale folder entries removed: {removed}')
    print(f'Backup: {backup}')
    print('TargetSelectionIcon was preserved.')
    print('No combat, movement, HP, damage, or Killer Clown logic was intentionally changed.')


if __name__ == '__main__':
    main()
