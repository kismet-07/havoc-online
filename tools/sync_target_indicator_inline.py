import json
from pathlib import Path

PROJECT = Path('Havoc Online.json')
EXTERNAL = Path('scripts/combat/target-system.js')
BACKUP = PROJECT.with_name(PROJECT.name + '.before-target-inline-sync.bak')

START_MARKER = '// --- scripts/combat/target-system.js ---'
END_MARKER = '// --- scripts/characters/brawler/config.js ---'
STALE_NAMES = {'TargetSelectionArrowStem', 'TargetSelectionArrowHead'}


def replace_target_section(node, replacement):
    """Replace exactly one target-system section, whether GDevelop stored it as
    individual inlineCode lines or as one multiline inlineCode string."""
    if isinstance(node, list):
        for i, value in enumerate(node):
            if isinstance(value, str) and value.strip() == START_MARKER:
                end = next((j for j in range(i + 1, len(node))
                            if isinstance(node[j], str) and node[j].strip() == END_MARKER), None)
                if end is None:
                    raise RuntimeError('Found target-system start marker but not the brawler config end marker.')
                node[i:end] = [START_MARKER, *replacement.splitlines(), END_MARKER]
                return 1

            if isinstance(value, str) and START_MARKER in value:
                start = value.find(START_MARKER)
                end = value.find(END_MARKER, start + len(START_MARKER))
                if end == -1:
                    raise RuntimeError('Found target-system start marker but not the brawler config end marker.')
                prefix = value[:start]
                suffix = value[end + len(END_MARKER):]
                node[i] = prefix + START_MARKER + '\n' + replacement + '\n' + END_MARKER + suffix
                return 1

        for value in node:
            if isinstance(value, (dict, list)):
                found = replace_target_section(value, replacement)
                if found:
                    return found
        return 0

    if isinstance(node, dict):
        for value in node.values():
            if isinstance(value, (dict, list)):
                found = replace_target_section(value, replacement)
                if found:
                    return found
            elif isinstance(value, str) and START_MARKER in value:
                start = value.find(START_MARKER)
                end = value.find(END_MARKER, start + len(START_MARKER))
                if end == -1:
                    raise RuntimeError('Found target-system start marker but not the brawler config end marker.')
                prefix = value[:start]
                suffix = value[end + len(END_MARKER):]
                key = next(k for k, v in node.items() if v is value)
                node[key] = prefix + START_MARKER + '\n' + replacement + '\n' + END_MARKER + suffix
                return 1
    return 0


def remove_stale_references(node):
    """Remove only exact stale target-arrow names from the GDevelop JSON tree."""
    removed = 0
    if isinstance(node, dict):
        for key in list(node.keys()):
            value = node[key]
            if key in {'name', 'objectName'} and value in STALE_NAMES:
                return 1
            if isinstance(value, (dict, list)):
                cleaned = remove_stale_references(value)
                if cleaned and isinstance(value, list):
                    removed += cleaned
                else:
                    removed += cleaned
        return removed

    if isinstance(node, list):
        kept = []
        for value in node:
            if isinstance(value, dict) and (
                value.get('name') in STALE_NAMES or value.get('objectName') in STALE_NAMES
            ):
                removed += 1
                continue
            if isinstance(value, str) and value in STALE_NAMES:
                removed += 1
                continue
            removed += remove_stale_references(value)
            kept.append(value)
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
    BACKUP.write_text(original, encoding='utf-8', newline='\n')

    replaced = replace_target_section(data, external)
    if replaced != 1:
        raise SystemExit(f'Safety check failed: expected exactly one target-system inline section, found {replaced}.')

    removed = remove_stale_references(data)

    output = json.dumps(data, indent=2, ensure_ascii=False) + '\n'
    PROJECT.write_text(output, encoding='utf-8', newline='\n')

    verify = json.loads(PROJECT.read_text(encoding='utf-8'))
    verify_text = json.dumps(verify, ensure_ascii=False)
    if START_MARKER not in verify_text:
        raise SystemExit('Validation failed: target-system marker missing after write.')
    if 'TargetSelectionArrowStem' in verify_text or 'TargetSelectionArrowHead' in verify_text:
        raise SystemExit('Validation failed: obsolete target-arrow references remain in the project JSON.')
    if 'TargetSelectionIcon' not in verify_text:
        raise SystemExit('Validation failed: TargetSelectionIcon disappeared.')

    print('Target indicator inline-code synchronization complete.')
    print(f'Inline target-system sections replaced: {replaced}')
    print(f'Stale target-arrow references removed: {removed}')
    print(f'Backup: {BACKUP}')
    print('TargetSelectionIcon was preserved.')
    print('No combat, movement, HP, damage, or Killer Clown logic was intentionally changed.')


if __name__ == '__main__':
    main()
