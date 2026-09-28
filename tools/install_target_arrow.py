from __future__ import annotations

import json
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PROJECT = ROOT / 'Havoc Online.json'
TARGET = ROOT / 'scripts' / 'combat' / 'target-system.js'

TARGET_SOURCE = r'''/**
 * World-space target selection indicator.
 * Uses two pre-created 3D boxes: a vertical stem and a wider arrow head.
 *
 * Important: the indicator objects are placed in the scene ahead of time.
 * We only move/show them at runtime; no 3D objects are created dynamically.
 */
const HAVOC_TARGET_CONFIG = {
  mobObjectName: 'Killer_clown',
  indicatorObjectNames: [
    'TargetSelectionArrowStem',
    'TargetSelectionArrowHead',
  ],
  arrowHeadZOffset: 80,
  arrowStemZOffset: 250,
  hiddenX: -100000,
  hiddenY: -100000,
};

function initializeHavocTargetSelection(runtimeScene) {
  if (!runtimeScene.__havocTargetSelection) {
    runtimeScene.__havocTargetSelection = {
      indicatorSegments: [],
      indicatorTarget: null,
      warnedMissingIndicator: false,
    };
  }

  const state = runtimeScene.__havocTargetSelection;
  if (state.indicatorSegments.length !== HAVOC_TARGET_CONFIG.indicatorObjectNames.length) {
    state.indicatorSegments = HAVOC_TARGET_CONFIG.indicatorObjectNames.map((name) => {
      const objects = runtimeScene.getObjects(name);
      return objects.length > 0 ? objects[0] : null;
    });
  }

  if (!state.warnedMissingIndicator && state.indicatorSegments.some((segment) => !segment)) {
    console.warn('[Havoc Target] Target arrow objects are missing from the scene.');
    state.warnedMissingIndicator = true;
  }

  return state;
}

function setHavocIndicatorPosition(segment, x, y, z) {
  if (!segment || segment.isDestroyed) return false;

  // Use the documented 3D center-position API when available. The fallback
  // keeps the indicator compatible with runtimes exposing only setPosition/setZ.
  if (typeof segment.setCenterPositionInScene === 'function') {
    segment.setCenterPositionInScene(x, y);
  } else {
    segment.setPosition(x, y);
  }

  if (typeof segment.setCenterZInScene === 'function') {
    segment.setCenterZInScene(z);
  } else if (typeof segment.setZ === 'function') {
    segment.setZ(z);
  }

  segment.hidden = false;
  return true;
}

function clearHavocTargetIndicator(runtimeScene) {
  const state = initializeHavocTargetSelection(runtimeScene);

  for (const segment of state.indicatorSegments) {
    if (!segment || segment.isDestroyed) continue;
    segment.hidden = true;
    segment.setPosition(HAVOC_TARGET_CONFIG.hiddenX, HAVOC_TARGET_CONFIG.hiddenY);
  }

  state.indicatorTarget = null;
}

function updateHavocTargetIndicator(runtimeScene, target) {
  const state = initializeHavocTargetSelection(runtimeScene);

  if (!brawlerTargetIsValid(target)) {
    clearHavocTargetIndicator(runtimeScene);
    return;
  }

  if (state.indicatorSegments.some((segment) => !segment || segment.isDestroyed)) {
    return;
  }

  const x = target.getX();
  const y = target.getY();

  // Anchor the arrow to the actual top of the selected 3D model instead of
  // assuming a fixed character height.
  const targetTopZ = typeof target.getUnrotatedAABBMaxZ === 'function'
    ? target.getUnrotatedAABBMaxZ()
    : target.getZ();

  const stem = state.indicatorSegments[0];
  const head = state.indicatorSegments[1];

  setHavocIndicatorPosition(
    stem,
    x,
    y,
    targetTopZ + HAVOC_TARGET_CONFIG.arrowStemZOffset,
  );

  setHavocIndicatorPosition(
    head,
    x,
    y,
    targetTopZ + HAVOC_TARGET_CONFIG.arrowHeadZOffset,
  );

  state.indicatorTarget = target;
}

function selectHavocTargetUnderCursor(runtimeScene) {
  const mobs = runtimeScene.getObjects(HAVOC_TARGET_CONFIG.mobObjectName);

  for (const mob of mobs) {
    if (mob.cursorOnObject()) return mob;
  }

  return null;
}

function updateHavocTargetSelection(runtimeScene) {
  const input = initializeHavocMobileInput(runtimeScene);
  const combat = initializeBrawlerCombat(runtimeScene);
  const selection = initializeHavocTargetSelection(runtimeScene);

  if (input.targetTapRequested) {
    const selectedTarget = selectHavocTargetUnderCursor(runtimeScene);

    if (selectedTarget) {
      combat.target = selectedTarget;
      updateHavocTargetIndicator(runtimeScene, selectedTarget);
    } else {
      combat.target = null;
      clearHavocTargetIndicator(runtimeScene);
    }
  }

  if (!brawlerTargetIsValid(combat.target)) {
    combat.target = null;
    clearHavocTargetIndicator(runtimeScene);
    return;
  }

  if (selection.indicatorTarget === combat.target) {
    updateHavocTargetIndicator(runtimeScene, combat.target);
  }
}
'''


def indicator_object(name: str, width: int, height: int, depth: int) -> dict:
    return {
        'name': name,
        'tags': 'HavocCombatUI',
        'type': 'Primitive3D::Box',
        'variables': [], 'effects': [], 'behaviors': [],
        'content': {
            'width': width, 'height': height, 'depth': depth,
            'materialType': 'Basic', 'tint': '#ff2020',
            'frontFaceResourceName': '', 'backFaceResourceName': '',
            'topFaceResourceName': '', 'bottomFaceResourceName': '',
            'leftFaceResourceName': '', 'rightFaceResourceName': '',
            'frontFaceVisible': True, 'backFaceVisible': True,
            'topFaceVisible': True, 'bottomFaceVisible': True,
            'leftFaceVisible': True, 'rightFaceVisible': True,
            'frontFaceResourceRepeat': False, 'backFaceResourceRepeat': False,
            'topFaceResourceRepeat': False, 'bottomFaceResourceRepeat': False,
            'leftFaceResourceRepeat': False, 'rightFaceResourceRepeat': False,
            'enableTextureTransparency': False,
            'isCastingShadow': False, 'isReceivingShadow': False,
        },
    }


def add_instance(layout: dict, name: str) -> None:
    world = layout.setdefault('layers', [])[0]
    instances = world.setdefault('instances', [])
    if any(i.get('name') == name for i in instances):
        return
    instances.append({
        'angle': 0, 'customSize': False, 'height': 0,
        'layer': world.get('name', ''), 'name': name,
        'persistentUuid': str(uuid.uuid4()), 'width': 0,
        'x': -100000, 'y': -100000, 'zOrder': 0,
        'numberProperties': [], 'stringProperties': [], 'initialVariables': [],
    })


def remove_old_ring(layout: dict) -> None:
    old = {
        'TargetSelectionRingSegment', 'TargetSelectionRingTop',
        'TargetSelectionRingBottom', 'TargetSelectionRingLeft',
        'TargetSelectionRingRight',
    }
    layout['objects'] = [o for o in layout.get('objects', []) if o.get('name') not in old]
    for layer in layout.get('layers', []):
        layer['instances'] = [i for i in layer.get('instances', []) if i.get('name') not in old]
    folder = layout.get('objectsFolderStructure', {})
    folder['children'] = [c for c in folder.get('children', []) if c.get('objectName') not in old]


def main() -> None:
    project = json.loads(PROJECT.read_text(encoding='utf-8'))
    for layout in project.get('layouts', []):
        remove_old_ring(layout)
        objects = layout.setdefault('objects', [])
        definitions = [
            indicator_object('TargetSelectionArrowStem', 32, 32, 180),
            indicator_object('TargetSelectionArrowHead', 150, 32, 70),
        ]
        existing = {o.get('name') for o in objects}
        for definition in definitions:
            if definition['name'] not in existing:
                objects.append(definition)
        folder = layout.setdefault('objectsFolderStructure', {'folderName': '__ROOT'})
        children = folder.setdefault('children', [])
        child_names = {c.get('objectName') for c in children}
        for definition in definitions:
            if definition['name'] not in child_names:
                children.append({'objectName': definition['name']})
        add_instance(layout, 'TargetSelectionArrowStem')
        add_instance(layout, 'TargetSelectionArrowHead')
        break
    PROJECT.write_text(json.dumps(project, indent=2, ensure_ascii=False), encoding='utf-8', newline='\n')
    TARGET.write_text(TARGET_SOURCE, encoding='utf-8', newline='\n')
    print('Installed corrected world-space Brawler target arrow.')
    print('Arrow uses pre-created 3D objects and anchors to the selected mob top Z.')
    print('No HP, damage, hitbox, death, database, locomotion, or Killer Clown AI logic was changed.')


if __name__ == '__main__':
    main()
