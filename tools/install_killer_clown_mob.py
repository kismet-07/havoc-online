from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PROJECT = ROOT / 'Havoc Online.json'
SOURCE = ROOT / 'scripts' / 'mobs' / 'killer_clown' / 'killer-clown.js'
MARKER = '// HAVOC_KILLER_CLOWN_MOB_V1'


def install() -> None:
    project = json.loads(PROJECT.read_text(encoding='utf-8'))
    source = SOURCE.read_text(encoding='utf-8')

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
        'Idle': ('Idle_Sword', True),
        'Walk': ('Walk_Large', True),
        'Run': ('Run_Stealth', True),
        'Attack': ('Sword_Attack', False),
    }

    # Enforce the runtime behavior on existing animation definitions too.
    # The original Killer Clown object had Walk_Large with loop=false, which
    # causes the animation to reach its final pose while the AI keeps moving.
    existing_by_source = {a.get('source'): a for a in animations}
    for display_name, (source_name, should_loop) in required.items():
        animation = existing_by_source.get(source_name)
        if animation is None:
            animation = {
                'loop': should_loop,
                'name': display_name,
                'source': source_name,
            }
            animations.append(animation)
        else:
            animation['loop'] = should_loop
            animation['name'] = display_name

    for layout in project.get('layouts', []):
        events = layout.get('events', [])
        replacement = [MARKER]
        replacement.extend(source.splitlines())
        replacement.extend([
            '',
            'const killerClownDt = gdjs.evtTools.runtimeScene.getElapsedTimeInSeconds(runtimeScene);',
            'updateKillerClowns(runtimeScene, killerClownDt);',
        ])

        found = False
        for event in events:
            if event.get('type') != 'BuiltinCommonInstructions::JsCode':
                continue
            inline = event.get('inlineCode', [])
            if MARKER in '\n'.join(inline):
                event['inlineCode'] = replacement
                found = True
                break

        if found:
            PROJECT.write_text(
                json.dumps(project, indent=2, ensure_ascii=False),
                encoding='utf-8',
                newline='\n',
            )
            print('Refreshed Killer Clown mob V1.3.')
            print('Population          : 20')
            print('Respawn             : 30 seconds')
            print('Walk duration       : 10-15 seconds')
            print('Walk animation      : LOOPED')
            print('Clone Z height      : inherited from placed Killer_clown')
            print('Minimum separation  : 900')
            print('Idle                : position locked')
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
        print('Installed Killer Clown mob V1.3.')
        print('Population          : 20')
        print('Respawn             : 30 seconds')
        print('Walk duration       : 10-15 seconds')
        print('Walk animation      : LOOPED')
        print('Clone Z height      : inherited from placed Killer_clown')
        print('Minimum separation  : 900')
        print('Idle                : position locked')
        return

    raise RuntimeError("Untitled scene layout was not found")


if __name__ == '__main__':
    install()
