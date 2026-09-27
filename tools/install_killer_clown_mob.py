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

    # Ensure the GDevelop object exposes the exact animation names supplied by the asset.
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
        'Idle': 'Idle_Sword',
        'Walk': 'Walk_Large',
        'Run': 'Run_Stealth',
        'Attack': 'Sword_Attack',
    }
    existing_sources = {a.get('source') for a in animations}
    for display_name, source_name in required.items():
        if source_name not in existing_sources:
            animations.append({
                'loop': display_name != 'Attack',
                'name': display_name,
                'source': source_name,
            })

    # Add exactly one runtime event to the scene. We keep the source file as the
    # maintainable version and embed it because this project is currently a plain
    # single-file GDevelop project (folderProject=false).
    for layout in project.get('layouts', []):
        events = layout.get('events', [])
        if any(MARKER in '\n'.join(e.get('inlineCode', [])) for e in events if e.get('type') == 'BuiltinCommonInstructions::JsCode'):
            print('Killer Clown mob is already installed.')
            return

        if layout.get('name') != 'Untitled scene':
            continue

        inline = [MARKER]
        inline.extend(source.splitlines())
        inline.extend([
            '',
            'const killerClownDt = gdjs.evtTools.runtimeScene.getElapsedTimeInSeconds(runtimeScene);',
            'updateKillerClowns(runtimeScene, killerClownDt);',
        ])
        events.append({
            'type': 'BuiltinCommonInstructions::JsCode',
            'inlineCode': inline,
        })
        break
    else:
        raise RuntimeError("Untitled scene layout was not found")

    PROJECT.write_text(json.dumps(project, indent=2, ensure_ascii=False), encoding='utf-8', newline='\n')
    print('Installed Killer Clown mob V1.')
    print('Population : 20')
    print('Respawn    : 30 seconds')
    print('Animations : Idle_Sword / Walk_Large / Run_Stealth / Sword_Attack')
    print('Behavior   : idle -> wander; no automatic aggression')


if __name__ == '__main__':
    install()
