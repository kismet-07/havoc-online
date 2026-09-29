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
    ROOT / 'scripts' / 'enhancement' / 'config.js',
    ROOT / 'scripts' / 'enhancement' / 'manager.js',
    ROOT / 'scripts' / 'enhancement' / 'vfx.js',
    ROOT / 'scripts' / 'equipment' / 'equipment-slots.js',
    ROOT / 'scripts' / 'equipment' / 'equipment-data.js',
    ROOT / 'scripts' / 'equipment' / 'equipment-manager.js',
    ROOT / 'scripts' / 'equipment' / 'equipment-attachment.js',
]

MARKER = '// HAVOC_BRAWLER_CHARACTER_V1'
TARGET_ICON = 'TargetSelectionIcon'
GAUNTLET_OBJECT = 'IronGauntlet'
GAUNTLET_RESOURCE = 'basic_iron_gauntlet.glb'
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
        'updateHavocEnhancement(runtimeScene, brawlerDt);',
        'updateHavocEquipmentAttachments(runtimeScene);',
    ])
    return lines


def ensure_gauntlet_object_definition(project: dict) -> None:
    """Register IronGauntlet as a real GDevelop Model3D object type."""
    layouts = project.get('layouts', [])
    if not layouts:
        raise SystemExit('Safety check failed: project has no layouts.')

    layout = layouts[0]
    objects = layout.setdefault('objects', [])
    existing = next((obj for obj in objects if obj.get('name') == GAUNTLET_OBJECT), None)
    if existing:
        return

    resources = project.get('resources', {}).get('resources', [])
    resource_names = {r.get('name') for r in resources}
    if GAUNTLET_RESOURCE not in resource_names:
        raise SystemExit(
            f'Safety check failed: {GAUNTLET_RESOURCE} is not registered as a project resource.'
        )

    objects.append({
        'assetStoreId': '',
        'name': GAUNTLET_OBJECT,
        'persistentUuid': '9d8f5f8e-6d0a-4c9a-8e42-1d6b7a3c5f20',
        'type': 'Scene3D::Model3DObject',
        'variables': [],
        'effects': [],
        'behaviors': [],
        'content': {
            'centerLocation': 'CenteredOnZ',
            'depth': 100,
            'height': 100,
            'isCastingShadow': True,
            'isReceivingShadow': True,
            'keepAspectRatio': True,
            'materialType': 'StandardWithoutMetalness',
            'modelResourceName': GAUNTLET_RESOURCE,
            'originLocation': 'ModelOrigin',
            'rotationX': 90,
            'rotationY': 0,
            'rotationZ': 90,
            'width': 100,
        },
    })


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

    ensure_gauntlet_object_definition(project)

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
    required_target_validity = (
        'function brawlerTargetIsValid(target) {' in combat_source
        and 'if (!target) return false;' in combat_source
        and 'if (target.isDestroyed) return false;' in combat_source
        and 'if (target._livingOnScene === false) return false;' in combat_source
        and 'return true;' in combat_source
    )
    if not required_target_validity:
        raise SystemExit(
            'Safety check failed: Brawler target validity guard is missing the current null, destroyed, and living-state checks.'
        )

    equipment_source = (ROOT / 'scripts' / 'equipment' / 'equipment-attachment.js').read_text(encoding='utf-8')
    required_equipment_runtime = (
        "modelObjectName: 'IronGauntlet'" in equipment_source
        and 'function updateHavocEquipmentAttachments(runtimeScene)' in equipment_source
        and 'mixamorig:RightHand' in equipment_source
        and 'function attachHavocEquipmentRendererToBone' in equipment_source
        and 'function applyHavocEquipmentWorldTransform' in equipment_source
        and 'bone.matrixWorld' in equipment_source
        and 'equipmentRendererObject.position.setFromMatrixPosition' in equipment_source
        and 'equipmentRendererObject.visible = true' in equipment_source
        and 'bone.add(equipmentRendererObject)' not in equipment_source
        and 'equipmentRendererObject.parent' not in equipment_source
    )
    if not required_equipment_runtime:
        raise SystemExit(
            'Safety check failed: Brawler equipment attachment runtime is incomplete or still uses skeleton parenting.'
        )

    enhancement_vfx_source = (ROOT / 'scripts' / 'enhancement' / 'vfx.js').read_text(encoding='utf-8')
    if 'function updateHavocEnhancement(runtimeScene, dt)' not in enhancement_vfx_source:
        raise SystemExit(
            'Safety check failed: enhancement VFX runtime boundary is missing.'
        )

    backup = PROJECT.with_name(PROJECT.name + '.before-brawler-inline-sync.bak')
    backup.write_text(PROJECT.read_text(encoding='utf-8'), encoding='utf-8', newline='\n')
    PROJECT.write_text(
        json.dumps(project, indent=2, ensure_ascii=False),
        encoding='utf-8',
        newline='\n',
    )

    print('Brawler inline-code synchronization complete.')
    print('Replaced exactly one brawler inline JS event from the external source files.')
    print('Registered IronGauntlet as a GDevelop Model3D object definition.')
    print('Included enhancement foundation and equipment attachment runtime.')
    print('Runtime entry point now applies the Brawler gauntlet world transform from the right-hand bone.')
    print('Enhancement VFX remains behind its current disabled presentation boundary.')
    print('Preserved TargetSelectionIcon and refused obsolete target-arrow objects.')
    print('Current combat target validity: null + destroyed + living-state checks.')
    print('Desktop target selection: mouse press transition.')
    print('Mouse release: no target-selection request.')
    print(f'Backup: {backup.name}')


if __name__ == '__main__':
    main()
