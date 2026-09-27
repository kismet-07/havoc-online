from __future__ import annotations

import json
import struct
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PROJECT = ROOT / 'Havoc Online.json'
GLB = ROOT / 'target_icon.glb'
BACKUP = ROOT / 'Havoc Online.json.before-target-icon.bak'

OLD_NAMES = {
    'TargetSelectionArrowStem',
    'TargetSelectionArrowHead',
    'TargetSelectionRingSegment',
    'TargetSelectionRingTop',
    'TargetSelectionRingBottom',
    'TargetSelectionRingLeft',
    'TargetSelectionRingRight',
}
TARGET_NAME = 'TargetSelectionIcon'


def read_glb_animation_name(path: Path) -> str | None:
    data = path.read_bytes()
    if len(data) < 20 or data[:4] != b'glTF':
        raise RuntimeError(f'{path.name} is not a valid GLB file.')

    version, length = struct.unpack_from('<II', data, 4)
    if version != 2 or length > len(data):
        raise RuntimeError(f'Unsupported or truncated GLB header: version={version}, length={length}')

    offset = 12
    while offset + 8 <= len(data):
        chunk_length, chunk_type = struct.unpack_from('<II', data, offset)
        offset += 8
        chunk = data[offset:offset + chunk_length]
        offset += chunk_length
        if chunk_type == 0x4E4F534A:  # JSON
            doc = json.loads(chunk.decode('utf-8'))
            animations = doc.get('animations') or []
            if animations:
                return animations[0].get('name') or 'Spin'
            return None
    return None


def main() -> None:
    if not PROJECT.exists():
        raise SystemExit(f'Missing project file: {PROJECT}')
    if not GLB.exists():
        raise SystemExit(f'Missing target icon: {GLB}')

    project = json.loads(PROJECT.read_text(encoding='utf-8'))
    layout = project['layouts'][0]

    animation_source = read_glb_animation_name(GLB)

    objects = layout.get('objects', [])
    killer = next((o for o in objects if o.get('name') == 'Killer_clown'), None)
    if killer is None:
        raise SystemExit('Could not find Killer_clown object definition to use as the 3D model template.')

    # Preserve the existing project structure but replace the old temporary
    # primitive indicators with one real 3D model object.
    layout['objects'] = [o for o in objects if o.get('name') not in OLD_NAMES and o.get('name') != TARGET_NAME]

    icon = json.loads(json.dumps(killer))
    icon['name'] = TARGET_NAME
    icon['persistentUuid'] = str(uuid.uuid4())
    content = icon.setdefault('content', {})
    content['modelResourceName'] = 'target_icon.glb'
    content['width'] = 220
    content['height'] = 220
    content['depth'] = 220
    content['keepAspectRatio'] = True
    content['isCastingShadow'] = False
    content['isReceivingShadow'] = False
    if animation_source:
        content['animations'] = [
            {'loop': True, 'name': 'Spin', 'source': animation_source}
        ]
    else:
        content['animations'] = []

    layout['objects'].append(icon)

    instances = layout.get('instances', [])
    layout['instances'] = [i for i in instances if i.get('name') not in OLD_NAMES and i.get('name') != TARGET_NAME]

    layout['instances'].append({
        'angle': 0,
        'customSize': True,
        'depth': 220,
        'height': 220,
        'layer': '',
        'name': TARGET_NAME,
        'persistentUuid': str(uuid.uuid4()),
        'width': 220,
        'x': -100000,
        'y': -100000,
        'z': 0,
        'zOrder': 0,
        'numberProperties': [],
        'stringProperties': [],
        'initialVariables': [],
    })

    resources = project.setdefault('resources', {}).setdefault('resources', [])
    resources[:] = [r for r in resources if r.get('name') != 'target_icon.glb' and r.get('file') != 'target_icon.glb']
    resources.append({
        'file': 'target_icon.glb',
        'kind': 'model3D',
        'metadata': '',
        'name': 'target_icon.glb',
        'userAdded': True,
    })

    if not BACKUP.exists():
        BACKUP.write_text(PROJECT.read_text(encoding='utf-8'), encoding='utf-8', newline='\n')

    PROJECT.write_text(json.dumps(project, indent=2, ensure_ascii=False) + '\n', encoding='utf-8', newline='\n')

    print('Installed target_icon.glb as TargetSelectionIcon.')
    print('Removed old target arrow/ring object definitions and instances.')
    print(f'Embedded GLB animation: {animation_source or "NONE FOUND"}')
    print('Created one hidden base-layer TargetSelectionIcon instance.')
    print(f'Backup: {BACKUP.name}')


if __name__ == '__main__':
    main()
