from __future__ import annotations

import json
import uuid
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


def text_object(name: str, string: str, character_size: int) -> dict:
    return {
        'assetStoreId': '',
        'bold': True,
        'italic': False,
        'name': name,
        'smoothed': True,
        'tags': 'HavocMobileUI',
        'type': 'TextObject::Text',
        'underlined': False,
        'variables': [],
        'effects': [],
        'behaviors': [],
        'string': string,
        'font': '',
        'characterSize': character_size,
        'color': {'b': 255, 'g': 255, 'r': 255},
    }


def instance(name: str, x: float, y: float, z_order: int) -> dict:
    return {
        'angle': 0,
        'customSize': False,
        'height': 0,
        'layer': 'UI',
        'name': name,
        'persistentUuid': str(uuid.uuid4()),
        'width': 0,
        'x': x,
        'y': y,
        'zOrder': z_order,
        'numberProperties': [],
        'stringProperties': [],
        'initialVariables': [],
    }


def ensure_mobile_ui(layout: dict) -> None:
    objects = layout.setdefault('objects', [])
    object_names = {obj.get('name') for obj in objects}

    definitions = [
        text_object('MobileJoystickBase', 'O', 72),
        text_object('MobileJoystickKnob', '+', 36),
        text_object('MobileAttackButton', '[ ATTACK ]', 28),
    ]

    for definition in definitions:
        if definition['name'] not in object_names:
            objects.append(definition)

    folder = layout.setdefault('objectsFolderStructure', {'folderName': '__ROOT'})
    children = folder.setdefault('children', [])
    child_names = {child.get('objectName') for child in children}
    for definition in definitions:
        if definition['name'] not in child_names:
            children.append({'objectName': definition['name']})

    layers = layout.setdefault('layers', [])
    ui_layer = next((layer for layer in layers if layer.get('name') == 'UI'), None)

    if ui_layer is None:
        ui_layer = {
            'ambientLightColorB': 0,
            'ambientLightColorG': 0,
            'ambientLightColorR': 0,
            'followBaseLayerCamera': True,
            'isLightingLayer': False,
            'name': 'UI',
            'visibility': True,
            'cameras': [{
                'defaultSize': True,
                'defaultViewport': True,
                'height': 0,
                'viewportBottom': 1,
                'viewportLeft': 0,
                'viewportRight': 1,
                'viewportTop': 0,
                'width': 0,
            }],
            'effects': [],
            'instances': [],
        }
        layers.append(ui_layer)
    else:
        ui_layer['followBaseLayerCamera'] = True
        ui_layer.setdefault('instances', [])

    # GDevelop stores scene instances inside their owning layer. The previous
    # installer incorrectly wrote these to layout.instances, so the objects
    # existed in the project definition but had no scene instances to render.
    instances = ui_layer['instances']
    instance_names = {item.get('name') for item in instances}

    for item in [
        instance('MobileJoystickBase', 80, 500, 100),
        instance('MobileJoystickKnob', 105, 525, 101),
        instance('MobileAttackButton', 1020, 590, 100),
    ]:
        if item['name'] not in instance_names:
            instances.append(item)


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

            if MARKER in joined or "runtimeScene.getObjects('Character')[0]" in joined:
                event['inlineCode'] = replacement
                ensure_mobile_ui(layout)
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

    print('Installed Brawler combat/input test source.')
    print('Added UI layer and temporary mobile controls.')
    print('Added target selection and target approach.')
    print('Added Attack1/Attack2 presentation sequence.')
    print('No HP, damage, hitbox, death or database logic added.')
    print('Killer Clown event was not modified.')


if __name__ == '__main__':
    install()
