from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PROJECT = ROOT / 'Havoc Online.json'
SOURCE = ROOT / 'scripts' / 'mobs' / 'killer_clown' / 'killer-clown.js'
MARKER = '// HAVOC_KILLER_CLOWN_MOB_V1'
DEFAULT_CAMERA_DISTANCE = 2200


def install() -> None:
    project = json.loads(PROJECT.read_text(encoding='utf-8'))
    source = SOURCE.read_text(encoding='utf-8')
    # Keep the embedded runtime aligned with the current Killer Clown config.
    # The runtime source currently contains the same combat constants inline.
    source = source.replace('chaseSpeed: 180,', 'chaseSpeed: 200,', 1)

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
        'Sword_Attack': False,
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
        'const killerClownDt = gdjs.evtTools.runtimeScene.getElapsedTimeInSeconds(runtimeScene);',
        'updateKillerClowns(runtimeScene, killerClownDt);',
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
            print('Refreshed Killer Clown mob V1.9.')
            print('Population          : 15')
            print('Respawn             : 15 seconds')
            print('Walk duration       : 10-15 seconds')
            print('Walk animation      : LOOPED')
            print('Walk speed          : 110')
            print('Chase speed         : 200')
            print('Return speed        : 140')
            print('Animation names     : GLB names preserved')
            print('Clone Z height      : inherited from placed Killer_clown')
            print('Minimum separation  : 1000')
            print('Aggro bridge        : consumed BEFORE AI update')
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
        print('Installed Killer Clown mob V1.9.')
        print('Population          : 15')
        print('Respawn             : 15 seconds')
        print('Walk duration       : 10-15 seconds')
        print('Walk animation      : LOOPED')
        print('Walk speed          : 110')
        print('Chase speed         : 200')
        print('Return speed        : 140')
        print('Animation names     : GLB names preserved')
        print('Clone Z height      : inherited from placed Killer_clown')
        print('Minimum separation  : 1000')
        print('Aggro bridge        : consumed BEFORE AI update')
        print('Default camera       : maximum zoom out (2200)')
        return

    raise RuntimeError("Untitled scene layout was not found")


if __name__ == '__main__':
    install()
