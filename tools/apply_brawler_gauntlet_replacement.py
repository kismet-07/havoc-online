from __future__ import annotations

import json
import shutil
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PROJECT = ROOT / 'Havoc Online.json'
EQUIPMENT_DATA = ROOT / 'scripts' / 'equipment' / 'equipment-data.js'
ATTACHMENT = ROOT / 'scripts' / 'equipment' / 'equipment-attachment.js'
SYNC = ROOT / 'tools' / 'sync_brawler_inline.py'

OLD_RESOURCE = 'basic_iron_gauntlet.glb'
NEW_RESOURCE = 'bb_gauntlet.glb'
OLD_MODEL_ID = 'assets/equipment/brawler/basic_iron_gauntlet.glb'
NEW_MODEL_ID = 'bb_gauntlet.glb'


def fail(message: str) -> None:
    raise SystemExit(f'Safety check failed: {message}')


def backup(path: Path, suffix: str) -> None:
    destination = path.with_name(path.name + suffix)
    if not destination.exists():
        shutil.copy2(path, destination)


def patch_equipment_data() -> None:
    text = EQUIPMENT_DATA.read_text(encoding='utf-8')
    if NEW_MODEL_ID in text:
        return
    if OLD_MODEL_ID not in text:
        fail(f'{OLD_MODEL_ID} was not found in equipment-data.js.')
    backup(EQUIPMENT_DATA, '.before-bb-gauntlet.bak')
    text = text.replace(OLD_MODEL_ID, NEW_MODEL_ID)
    EQUIPMENT_DATA.write_text(text, encoding='utf-8', newline='\n')


def patch_attachment_axis() -> None:
    text = ATTACHMENT.read_text(encoding='utf-8')
    old = "  const baseAxisLocal = new THREE.Vector3(0, 1, 0);"
    new = "  const baseAxisLocal = new THREE.Vector3(1, 0, 0);"
    if new in text:
        return
    if text.count(old) != 1:
        fail(f'expected exactly one forearm base-axis declaration, found {text.count(old)}.')
    backup(ATTACHMENT, '.before-bb-gauntlet.bak')
    ATTACHMENT.write_text(text.replace(old, new), encoding='utf-8', newline='\n')


def patch_project_resource() -> None:
    project = json.loads(PROJECT.read_text(encoding='utf-8'))
    resources = project.get('resources', {}).get('resources', [])
    old_entries = [r for r in resources if r.get('name') == OLD_RESOURCE]
    new_entries = [r for r in resources if r.get('name') == NEW_RESOURCE]

    if not new_entries:
        if len(old_entries) != 1:
            fail(f'expected exactly one registered {OLD_RESOURCE} resource, found {len(old_entries)}.')
        old_entry = old_entries[0]
        old_entry['name'] = NEW_RESOURCE
        new_entries = [old_entry]

    for layout in project.get('layouts', []):
        for obj in layout.get('objects', []):
            if obj.get('name') == 'IronGauntlet':
                content = obj.get('content', {})
                current = content.get('modelResourceName')
                if current not in (OLD_RESOURCE, NEW_RESOURCE):
                    fail(f'IronGauntlet uses unexpected model resource: {current!r}')
                content['modelResourceName'] = NEW_RESOURCE

    backup(PROJECT, '.before-bb-gauntlet.bak')
    PROJECT.write_text(json.dumps(project, indent=2, ensure_ascii=False), encoding='utf-8', newline='\n')


def main() -> None:
    for path in (PROJECT, EQUIPMENT_DATA, ATTACHMENT, SYNC, ROOT / NEW_RESOURCE):
        if not path.exists():
            fail(f'missing required file: {path.relative_to(ROOT)}')

    patch_equipment_data()
    patch_attachment_axis()

    # The existing sync script validates the old resource name. Run it first so
    # its other generated-code safety checks remain authoritative, then switch
    # the registered project resource to the replacement asset.
    subprocess.run(['python', str(SYNC)], cwd=ROOT, check=True)
    patch_project_resource()

    print('Brawler Level 1 gauntlet replacement applied.')
    print(f'Equipment model: {NEW_MODEL_ID}')
    print('Attachment base axis: +X')
    print('IronGauntlet project resource: bb_gauntlet.glb')
    print('Existing bone-parented attachment architecture preserved.')
    print('Backups created for modified source/project files.')


if __name__ == '__main__':
    main()
