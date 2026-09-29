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
LEGACY_DIAGNOSTIC_OBJECT = 'GauntletDiagnostic'
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
        '// --- Desktop gauntlet diagnostic ---',
        'function updateHavocGauntletDiagnostic(runtimeScene) {',
        '  if (!runtimeScene) return;',
        '  const diagnosticState = runtimeScene.__havocGauntletDiagnostic || { overlay: null, timer: 0 };',
        '  runtimeScene.__havocGauntletDiagnostic = diagnosticState;',
        '',
        '  const diagnosticDocument = typeof document !== "undefined" ? document : null;',
        '  if (!diagnosticDocument || !diagnosticDocument.body) return;',
        '',
        '  if (!diagnosticState.overlay || !diagnosticDocument.body.contains(diagnosticState.overlay)) {',
        '    diagnosticState.overlay = diagnosticDocument.getElementById("havoc-gauntlet-diagnostic");',
        '    if (!diagnosticState.overlay) {',
        '      const overlay = diagnosticDocument.createElement("div");',
        '      overlay.id = "havoc-gauntlet-diagnostic";',
        '      overlay.style.position = "fixed";',
        '      overlay.style.left = "12px";',
        '      overlay.style.top = "12px";',
        '      overlay.style.zIndex = "999999";',
        '      overlay.style.padding = "10px 12px";',
        '      overlay.style.background = "rgba(0,0,0,0.86)";',
        '      overlay.style.color = "#ffffff";',
        '      overlay.style.font = "12px/1.45 monospace";',
        '      overlay.style.whiteSpace = "pre";',
        '      overlay.style.pointerEvents = "none";',
        '      overlay.textContent = "GAUNTLET DIAGNOSTIC\\nInitializing...";',
        '      diagnosticDocument.body.appendChild(overlay);',
        '      diagnosticState.overlay = overlay;',
        '    }',
        '  }',
        '',
        '  diagnosticState.timer += gdjs.evtTools.runtimeScene.getElapsedTimeInSeconds(runtimeScene);',
        '  if (diagnosticState.timer < 0.25) return;',
        '  diagnosticState.timer = 0;',
        '',
        '  const player = runtimeScene.getObjects("Character")[0] || null;',
        '  const gauntlet = runtimeScene.getObjects("IronGauntlet")[0] || null;',
        '  const state = runtimeScene.__havocEquipmentAttachments || null;',
        '  const binding = state && state.bindings ? state.bindings.brawler_starter_gauntlets_test : null;',
        '  const playerRenderer = player && typeof player.get3DRendererObject === "function" ? player.get3DRendererObject() : null;',
        '  const gauntletRenderer = gauntlet && typeof gauntlet.get3DRendererObject === "function" ? gauntlet.get3DRendererObject() : null;',
        '  const bone = player && binding ? findHavocAttachmentBone(player, binding.rightAnchor) : null;',
        '  let meshCount = 0;',
        '  let culledMeshCount = 0;',
        '  if (gauntletRenderer && typeof gauntletRenderer.traverse === "function") {',
        '    gauntletRenderer.traverse((node) => {',
        '      if (node && node.isMesh) {',
        '        meshCount += 1;',
        '        if (node.frustumCulled) culledMeshCount += 1;',
        '      }',
        '    });',
        '  }',
        '  const rendererPosition = gauntletRenderer && gauntletRenderer.position ? [gauntletRenderer.position.x, gauntletRenderer.position.y, gauntletRenderer.position.z].map(v => Number(v).toFixed(2)).join(", ") : "NONE";',
        '  const rendererScale = gauntletRenderer && gauntletRenderer.scale ? [gauntletRenderer.scale.x, gauntletRenderer.scale.y, gauntletRenderer.scale.z].map(v => Number(v).toFixed(3)).join(", ") : "NONE";',
        '  const bonePosition = bone && bone.matrixWorld && typeof THREE !== "undefined" && typeof THREE.Vector3 === "function" ? new THREE.Vector3().setFromMatrixPosition(bone.matrixWorld) : null;',
        '  const bonePositionText = bonePosition ? [bonePosition.x, bonePosition.y, bonePosition.z].map(v => Number(v).toFixed(2)).join(", ") : "NONE";',
        '  const objectSize = gauntlet && typeof gauntlet.getWidth === "function" ? [gauntlet.getWidth(), gauntlet.getHeight(), gauntlet.getDepth()].map(v => Number(v).toFixed(2)).join(", ") : "NONE";',
        '  const objectScale = gauntlet && typeof gauntlet.getScale === "function" ? Number(gauntlet.getScale()).toFixed(3) : "NONE";',
        '  const lines = [',
        '    "GAUNTLET DIAGNOSTIC",',
        '    "------------------",',
        '    "Character:          " + (player ? "FOUND" : "MISSING"),',
        '    "Character renderer: " + (playerRenderer ? "FOUND" : "MISSING"),',
        '    "IronGauntlet:       " + (gauntlet ? "FOUND" : "MISSING"),',
        '    "Gauntlet renderer:  " + (gauntletRenderer ? "FOUND" : "MISSING"),',
        '    "Mesh count:          " + meshCount,',
        '    "Culled meshes:      " + culledMeshCount,',
        '    "Object size:        " + objectSize,',
        '    "Object scale:       " + objectScale,',
        '    "Renderer visible:   " + (gauntletRenderer && gauntletRenderer.visible ? "YES" : "NO"),',
        '    "Renderer position:  " + rendererPosition,',
        '    "Renderer scale:     " + rendererScale,',
        '    "RightHand bone:     " + (bone ? "FOUND" : "MISSING"),',
        '    "Actual bone:        " + (bone && bone.name ? bone.name : "NONE"),',
        '    "Bone world pos:     " + bonePositionText,',
        '    "Binding:            " + (binding ? "FOUND" : "MISSING"),',
        '    "Attached:           " + (binding && binding.modelAttached ? "YES" : "NO"),',
        '    "Renderer parented:  " + (binding && binding.rendererParented ? "YES" : "NO"),',
        '  ];',
        '  diagnosticState.overlay.textContent = lines.join("\\n");',
        '}',
        '',
        '// --- Brawler runtime entry point ---',
        'const brawlerDt = gdjs.evtTools.runtimeScene.getElapsedTimeInSeconds(runtimeScene);',
        'initializeHavocMobileInput(runtimeScene);',
        'updateHavocMobileInput(runtimeScene);',
        'updateBrawlerMovement(runtimeScene, brawlerDt);',
        'updateBrawlerCombat(runtimeScene, brawlerDt);',
        'updateHavocEnhancement(runtimeScene, brawlerDt);',
        'updateHavocEquipmentAttachments(runtimeScene);',
        'updateHavocGauntletDiagnostic(runtimeScene);',
    ])
    return lines


def ensure_gauntlet_object_definition(project: dict) -> None:
    layouts = project.get('layouts', [])
    if not layouts:
        raise SystemExit('Safety check failed: project has no layouts.')
    layout = layouts[0]
    objects = layout.setdefault('objects', [])
    instances = layout.setdefault('instances', [])
    resources = project.get('resources', {}).get('resources', [])
    resource_names = {r.get('name') for r in resources}
    if GAUNTLET_RESOURCE not in resource_names:
        raise SystemExit(f'Safety check failed: {GAUNTLET_RESOURCE} is not registered as a project resource.')
    existing = next((obj for obj in objects if obj.get('name') == GAUNTLET_OBJECT), None)
    if not existing:
        objects.append({
            'assetStoreId': '',
            'name': GAUNTLET_OBJECT,
            'persistentUuid': '9d8f5f8e-6d0a-4c9a-8e42-1d6b7a3c5f20',
            'type': 'Scene3D::Model3DObject',
            'variables': [], 'effects': [], 'behaviors': [],
            'content': {
                'centerLocation': 'CenteredOnZ', 'crossfadeDuration': 0.1,
                'depth': 100, 'height': 100, 'isCastingShadow': True,
                'isReceivingShadow': True, 'keepAspectRatio': True,
                'materialType': 'StandardWithoutMetalness',
                'modelResourceName': GAUNTLET_RESOURCE,
                'originLocation': 'ModelOrigin', 'rotationX': 90,
                'rotationY': 0, 'rotationZ': 90, 'width': 100, 'animations': [],
            },
        })
    else:
        content = existing.get('content', {})
        if existing.get('type') != 'Scene3D::Model3DObject' or content.get('modelResourceName') != GAUNTLET_RESOURCE:
            raise SystemExit('Safety check failed: existing IronGauntlet object is not a Model3DObject using basic_iron_gauntlet.glb.')
    layout['objects'] = [obj for obj in objects if obj.get('name') != LEGACY_DIAGNOSTIC_OBJECT]
    layout['instances'] = [inst for inst in instances if inst.get('name') != LEGACY_DIAGNOSTIC_OBJECT]
    folder = layout.get('objectsFolderStructure')
    if isinstance(folder, dict) and isinstance(folder.get('children'), list):
        folder['children'] = [child for child in folder['children'] if child.get('objectName') != LEGACY_DIAGNOSTIC_OBJECT]
    if any(obj.get('name') == LEGACY_DIAGNOSTIC_OBJECT for obj in layout['objects']):
        raise SystemExit('Safety check failed: legacy GDevelop GauntletDiagnostic remains in project JSON.')
    if any(inst.get('name') == LEGACY_DIAGNOSTIC_OBJECT for inst in layout['instances']):
        raise SystemExit('Safety check failed: legacy GDevelop GauntletDiagnostic remains in project JSON.')
    folder_children = folder.get('children') if isinstance(folder, dict) else []
    if any(child.get('objectName') == LEGACY_DIAGNOSTIC_OBJECT for child in folder_children):
        raise SystemExit('Safety check failed: legacy GDevelop GauntletDiagnostic remains in object folders.')


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
        raise SystemExit(f'Safety check failed: expected exactly one brawler inline JS event, found {len(events)}.')
    ensure_gauntlet_object_definition(project)
    source = build_inline_source()
    events[0]['inlineCode'] = source
    serialized = json.dumps(project, ensure_ascii=False)
    for token in OBSOLETE:
        if token in serialized:
            raise SystemExit(f'Safety check failed: obsolete target indicator reference remains: {token}')
    if TARGET_ICON not in serialized:
        raise SystemExit('Safety check failed: TargetSelectionIcon is missing. Refusing to modify the project.')
    combat_source = (ROOT / 'scripts' / 'characters' / 'brawler' / 'combat.js').read_text(encoding='utf-8')
    required_target_validity = (
        'function brawlerTargetIsValid(target) {' in combat_source
        and 'if (!target) return false;' in combat_source
        and 'if (target.isDestroyed) return false;' in combat_source
        and 'if (target._livingOnScene === false) return false;' in combat_source
        and 'return true;' in combat_source
    )
    if not required_target_validity:
        raise SystemExit('Safety check failed: Brawler target validity guard is missing the current null, destroyed, and living-state checks.')
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
        and 'collectHavocEquipmentDiagnostic' not in equipment_source
        and 'setWidth(' not in equipment_source
        and 'setHeight(' not in equipment_source
        and 'setDepth(' not in equipment_source
    )
    if not required_equipment_runtime:
        raise SystemExit('Safety check failed: Brawler equipment attachment runtime is incomplete, resizes the model, uses skeleton parenting, or contains stale diagnostics.')
    enhancement_vfx_source = (ROOT / 'scripts' / 'enhancement' / 'vfx.js').read_text(encoding='utf-8')
    if 'function updateHavocEnhancement(runtimeScene, dt)' not in enhancement_vfx_source:
        raise SystemExit('Safety check failed: enhancement VFX runtime boundary is missing.')
    generated_inline = '\n'.join(source)
    if 'updateHavocEquipmentAttachments(runtimeScene);' not in generated_inline:
        raise SystemExit('Safety check failed: generated inline code does not call the equipment runtime.')
    if 'updateHavocGauntletDiagnostic(runtimeScene);' not in generated_inline:
        raise SystemExit('Safety check failed: generated inline code does not call the desktop gauntlet diagnostic.')
    if 'collectHavocEquipmentDiagnostic' in generated_inline:
        raise SystemExit('Safety check failed: stale gauntlet diagnostic reference remains in generated inline code.')
    if 'function updateHavocGauntletDiagnostic(runtimeScene)' not in generated_inline:
        raise SystemExit('Safety check failed: desktop gauntlet diagnostic function was not generated.')
    if 'document.createElement(' not in generated_inline or 'appendChild(overlay)' not in generated_inline:
        raise SystemExit('Safety check failed: desktop gauntlet diagnostic is not using a DOM overlay.')
    backup = PROJECT.with_name(PROJECT.name + '.before-brawler-inline-sync.bak')
    backup.write_text(PROJECT.read_text(encoding='utf-8'), encoding='utf-8', newline='\n')
    PROJECT.write_text(json.dumps(project, indent=2, ensure_ascii=False), encoding='utf-8', newline='\n')
    print('Brawler inline-code synchronization complete.')
    print('Replaced exactly one brawler inline JS event from the external source files.')
    print('Registered IronGauntlet as a GDevelop Model3D object definition.')
    print('Removed the obsolete world-space GauntletDiagnostic object.')
    print('Added a desktop DOM diagnostic modeled after the working Killer Clown diagnostic.')
    print('Equipment runtime no longer overrides Model3D width/height/depth.')
    print('Equipment runtime keeps GDevelop object transforms synchronized with the RightHand bone.')
    print('Equipment renderer mesh frustum culling is disabled for the dynamically attached model.')
    print('Enhancement VFX remains behind its current runtime boundary.')
    print('Preserved TargetSelectionIcon and refused obsolete target-arrow objects.')
    print('Current combat target validity: null + destroyed + living-state checks.')
    print('Desktop target selection: mouse press transition.')
    print('Mouse release: no target-selection request.')
    print(f'Backup: {backup.name}')


if __name__ == '__main__':
    main()
