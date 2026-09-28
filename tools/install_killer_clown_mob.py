from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PROJECT = ROOT / 'Havoc Online.json'
SOURCE = ROOT / 'scripts' / 'mobs' / 'killer_clown' / 'killer-clown.js'
CONFIG = ROOT / 'scripts' / 'mobs' / 'killer_clown' / 'killer-clown.config.js'
MARKER = '// HAVOC_KILLER_CLOWN_MOB_V1'
DEFAULT_CAMERA_DISTANCE = 2200


def get_chase_speed() -> int:
    config = CONFIG.read_text(encoding='utf-8')
    match = re.search(r'\bchaseSpeed:\s*(\d+)', config)
    if not match:
        raise RuntimeError("chaseSpeed was not found in killer-clown.config.js")
    return int(match.group(1))


def install() -> None:
    project = json.loads(PROJECT.read_text(encoding='utf-8'))
    source = SOURCE.read_text(encoding='utf-8')
    chase_speed = get_chase_speed()

    source, replacements = re.subn(
        r'(\bchaseSpeed:\s*)\d+',
        rf'\g<1>{chase_speed}',
        source,
        count=1,
    )
    if replacements != 1:
        raise RuntimeError("chaseSpeed was not found in killer-clown.js")

    killer_object = None
    for layout in project.get('layouts', []):
        for obj in layout.get('objects', []):
            if obj.get('name') == 'Killer_clown':
                killer_object = obj
                break
        if killer_object:
            break

    if killer_object is None:
        raise RuntimeError("Killer_clown object definition was not found in Havoc Online.json")

    content = killer_object.setdefault('content', {})
    animations = content.setdefault('animations', [])
    required = {
        'Idle_Sword': True,
        'Walk_Large': True,
        'Run_Stealth': True,
        # The mob must keep attacking while the player remains in melee range.
        # Do not make Sword_Attack non-looping: that causes the mob to finish
        # one swing and remain frozen until another animation transition.
        'Sword_Attack': True,
    }

    existing_by_source = {a.get('source'): a for a in animations}
    for animation_name, should_loop in required.items():
        animation = existing_by_source.get(animation_name)
        if animation is None:
            animation = {
                'loop': should_loop,
                'name': animation_name,
                'source': animation_name,
            }
            animations.append(animation)
        else:
            animation['loop'] = should_loop
            animation['name'] = animation_name
            animation['source'] = animation_name

    replacement = [MARKER]
    replacement.extend(source.splitlines())
    replacement.extend([
        '',
        '// Consume Brawler aggro requests BEFORE the AI update so the mob',
        '// enters aggressive state in the same runtime tick.',
        'const killerClownAggroRequest = runtimeScene.__havocKillerClownAggroRequest;',
        'if (killerClownAggroRequest) {',
        '  const requestedMob = killerClownAggroRequest.mob;',
        '  const requestedPlayer = killerClownAggroRequest.player;',
        '  runtimeScene.__havocKillerClownAggroRequest = null;',
        '  if (requestedMob && requestedPlayer && typeof aggroKillerClown === \'function\') {',
        '    aggroKillerClown(requestedMob, requestedPlayer);',
        '  }',
        '}',
        '',
        '// Temporary in-game chase diagnostic. This deliberately avoids the',
        '// GDevelop debugger so it also works with the free version.',
        'const killerClownDiagnostics = runtimeScene.__havocKillerClownDiagnostics || {',
        '  timer: 0,',
        '  lastMobX: null,',
        '  lastMobY: null,',
        '  lastPlayerX: null,',
        '  lastPlayerY: null,',
        '  overlay: null,',
        '};',
        'const diagnosticDocument = typeof document !== \'undefined\' ? document : null;',
        'if (diagnosticDocument && !killerClownDiagnostics.overlay) {',
        '  const overlay = diagnosticDocument.createElement(\'div\');',
        '  overlay.id = \'havoc-killer-clown-diagnostic\';',
        '  overlay.style.position = \'fixed\';',
        '  overlay.style.left = \'12px\';',
        '  overlay.style.top = \'12px\';',
        '  overlay.style.zIndex = \'999999\';',
        '  overlay.style.padding = \'10px 12px\';',
        '  overlay.style.background = \'rgba(0,0,0,0.82)\';',
        '  overlay.style.color = \'#ffffff\';',
        '  overlay.style.font = \'12px/1.45 monospace\';',
        '  overlay.style.whiteSpace = \'pre\';',
        '  overlay.style.pointerEvents = \'none\';',
        '  overlay.textContent = \'KILLER CLOWN DIAGNOSTIC\\nWaiting for aggro...\';',
        '  diagnosticDocument.body.appendChild(overlay);',
        '  killerClownDiagnostics.overlay = overlay;',
        '}',
        'killerClownDiagnostics.timer += gdjs.evtTools.runtimeScene.getElapsedTimeInSeconds(runtimeScene);',
        'if (killerClownDiagnostics.timer >= 0.5) {',
        '  killerClownDiagnostics.timer = 0;',
        '  const diagnosticMob = runtimeScene.getObjects(KILLER_CLOWN_CONFIG.objectName).find(m => m.__killerClownAI && m.__killerClownAI.aggressive && m.__killerClownAI.state !== \'return\');',
        '  const diagnosticPlayer = runtimeScene.getObjects(KILLER_CLOWN_CONFIG.targetObjectName)[0];',
        '  if (diagnosticMob && diagnosticPlayer) {',
        '    const mx = diagnosticMob.getX();',
        '    const my = diagnosticMob.getY();',
        '    const px = diagnosticPlayer.getX();',
        '    const py = diagnosticPlayer.getY();',
        '    const elapsed = 0.5;',
        '    const distance = Math.hypot(px - mx, py - my);',
        '    const mobDelta = killerClownDiagnostics.lastMobX === null ? 0 : Math.hypot(mx - killerClownDiagnostics.lastMobX, my - killerClownDiagnostics.lastMobY);',
        '    const playerDelta = killerClownDiagnostics.lastPlayerX === null ? 0 : Math.hypot(px - killerClownDiagnostics.lastPlayerX, py - killerClownDiagnostics.lastPlayerY);',
        '    const mobObservedSpeed = mobDelta / elapsed;',
        '    const playerObservedSpeed = playerDelta / elapsed;',
        '    const text = [',
        '      \'KILLER CLOWN DIAGNOSTIC\',',
        '      \'------------------------\',',
        '      `Configured chase: ${KILLER_CLOWN_CONFIG.chaseSpeed.toFixed(0)}`,',
        '      `Mob observed:    ${mobObservedSpeed.toFixed(1)} units/s`,',
        '      `Player observed: ${playerObservedSpeed.toFixed(1)} units/s`,',
        '      `Distance:        ${distance.toFixed(1)}`,',
        '      `Attack range:    ${KILLER_CLOWN_CONFIG.attackRange.toFixed(0)}`,',
        '      `Mob delta/0.5s:  ${mobDelta.toFixed(1)}`,',
        '      `Player delta/0.5s:${playerDelta.toFixed(1)}`,',
        '    ].join(\'\\n\');',
        '    if (killerClownDiagnostics.overlay) killerClownDiagnostics.overlay.textContent = text;',
        '    killerClownDiagnostics.lastMobX = mx;',
        '    killerClownDiagnostics.lastMobY = my;',
        '    killerClownDiagnostics.lastPlayerX = px;',
        '    killerClownDiagnostics.lastPlayerY = py;',
        '  } else if (killerClownDiagnostics.overlay) {',
        '    killerClownDiagnostics.overlay.textContent = \'KILLER CLOWN DIAGNOSTIC\\nWaiting for aggressive mob...\';',
        '    killerClownDiagnostics.lastMobX = null;',
        '    killerClownDiagnostics.lastMobY = null;',
        '    killerClownDiagnostics.lastPlayerX = null;',
        '    killerClownDiagnostics.lastPlayerY = null;',
        '  }',
        '}',
        'runtimeScene.__havocKillerClownDiagnostics = killerClownDiagnostics;',
        '',
        '// Pass elapsed time directly. GDevelop can place multiple inline-code',
        '// blocks in a shared generated scope, so avoid a block-scoped dt name here.',
        'updateKillerClowns(runtimeScene, gdjs.evtTools.runtimeScene.getElapsedTimeInSeconds(runtimeScene));',
    ])

    for layout in project.get('layouts', []):
        events = layout.get('events', [])
        found = False
        for event in events:
            if event.get('type') != 'BuiltinCommonInstructions::JsCode':
                continue
            inline = event.get('inlineCode', [])
            joined = '\n'.join(inline)

            if MARKER in joined:
                event['inlineCode'] = replacement
                found = True

            if 'runtimeScene.__fateCamera' in joined and 'distance: 900' in joined:
                event['inlineCode'] = [
                    line.replace('distance: 900', f'distance: {DEFAULT_CAMERA_DISTANCE}')
                    for line in event.get('inlineCode', [])
                ]

        if found:
            PROJECT.write_text(
                json.dumps(project, indent=2, ensure_ascii=False),
                encoding='utf-8',
                newline='\n',
            )
            print('Refreshed Killer Clown mob V1.14.')
            print('Population          : 15')
            print('Respawn             : 15 seconds')
            print('Walk duration       : 10-15 seconds')
            print('Walk animation      : LOOPED')
            print('Walk speed          : 110')
            print(f'Chase speed         : {chase_speed}')
            print('Return speed        : 140')
            print('Attack animation    : LOOPED')
            print('Animation names     : GLB names preserved')
            print('Clone Z height      : inherited from placed Killer_clown')
            print('Minimum separation  : 1000')
            print('Aggro bridge        : consumed BEFORE AI update')
            print('Runtime chase diagnostic : IN-GAME OVERLAY')
            print('Default camera       : maximum zoom out (2200)')
            return

        if layout.get('name') != 'Untitled scene':
            continue

        events.append({
            'type': 'BuiltinCommonInstructions::JsCode',
            'inlineCode': replacement,
        })
        PROJECT.write_text(
            json.dumps(project, indent=2, ensure_ascii=False),
            encoding='utf-8',
            newline='\n',
        )
        print('Installed Killer Clown mob V1.14.')
        print('Population          : 15')
        print('Respawn             : 15 seconds')
        print('Walk duration       : 10-15 seconds')
        print('Walk animation      : LOOPED')
        print('Walk speed          : 110')
        print(f'Chase speed         : {chase_speed}')
        print('Return speed        : 140')
        print('Attack animation    : LOOPED')
        print('Animation names     : GLB names preserved')
        print('Clone Z height      : inherited from placed Killer_clown')
        print('Minimum separation  : 1000')
        print('Aggro bridge        : consumed BEFORE AI update')
        print('Runtime chase diagnostic : IN-GAME OVERLAY')
        print('Default camera       : maximum zoom out (2200)')
        return

    raise RuntimeError("Untitled scene layout was not found")


if __name__ == '__main__':
    install()
