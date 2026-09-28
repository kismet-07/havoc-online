from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PROJECT = ROOT / 'Havoc Online.json'
SOURCE = ROOT / 'scripts' / 'combat' / 'mob-combat.js'
MARKER = '// HAVOC_MOB_COMBAT_SYSTEM_V1'


def source_lines() -> list[str]:
    lines = [MARKER]
    lines.extend(SOURCE.read_text(encoding='utf-8').splitlines())
    lines.append('')
    return lines


def remove_existing_block(lines: list[str]) -> list[str]:
    result = []
    inside = False
    for line in lines:
        if line.strip() == MARKER:
            inside = True
            continue
        if inside:
            if line.strip() in {
                "const brawlerDt = gdjs.evtTools.runtimeScene.getElapsedTimeInSeconds(runtimeScene);",
                "const killerClownDt = gdjs.evtTools.runtimeScene.getElapsedTimeInSeconds(runtimeScene);",
            }:
                inside = False
                result.append(line)
            continue
        result.append(line)
    return result


def insert_before_entry(lines: list[str], entry_prefix: str, extra_call: str) -> list[str]:
    result = []
    inserted = False
    for line in lines:
        if not inserted and line.strip().startswith(entry_prefix):
            result.extend(source_lines())
            result.append(extra_call)
            inserted = True
        result.append(line)
    if not inserted:
        raise RuntimeError(f'Could not find runtime entry point: {entry_prefix}')
    return result


def find_events(project: dict) -> tuple[dict, dict]:
    brawler_event = None
    killer_event = None

    for layout in project.get('layouts', []):
        for event in layout.get('events', []):
            if event.get('type') != 'BuiltinCommonInstructions::JsCode':
                continue
            joined = '\n'.join(event.get('inlineCode', []))
            if '// HAVOC_BRAWLER_CHARACTER_V1' in joined:
                brawler_event = event
            if '// HAVOC_KILLER_CLOWN_MOB_V1' in joined:
                killer_event = event

    if brawler_event is None:
        raise RuntimeError('Brawler inline-code event was not found.')
    if killer_event is None:
        raise RuntimeError('Killer Clown inline-code event was not found.')
    return brawler_event, killer_event


def install() -> None:
    if not PROJECT.exists():
        raise RuntimeError(f'Missing project file: {PROJECT}')
    if not SOURCE.exists():
        raise RuntimeError(f'Missing source file: {SOURCE}')

    project = json.loads(PROJECT.read_text(encoding='utf-8'))
    brawler_event, killer_event = find_events(project)

    brawler_lines = remove_existing_block(brawler_event.get('inlineCode', []))
    killer_lines = remove_existing_block(killer_event.get('inlineCode', []))

    brawler_event['inlineCode'] = insert_before_entry(
        brawler_lines,
        "const brawlerDt =",
        "consumeMobDamageQueue(runtimeScene, runtimeScene.getObjects('Character')[0]);",
    )
    killer_event['inlineCode'] = insert_before_entry(
        killer_lines,
        "const killerClownDt =",
        'updateKillerClownCombatDamage(runtimeScene, killerClownDt);',
    )

    PROJECT.write_text(
        json.dumps(project, indent=2, ensure_ascii=False),
        encoding='utf-8',
        newline='\n',
    )

    print('Mob combat system installed.')
    print('Killer Clown: animation-timed melee damage')
    print('Brawler: prototype 500 HP damage receiver')
    print('Damage: 50 per successful Sword_Attack hit')
    print('Hit timing: 0.25 seconds after attack starts')
    print('One hit maximum per attack animation')
    print('No database or authoritative stats modified.')


if __name__ == '__main__':
    install()
