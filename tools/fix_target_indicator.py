from __future__ import annotations

import json
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PROJECT = ROOT / 'Havoc Online.json'
TARGET = ROOT / 'scripts' / 'combat' / 'target-system.js'

TARGET_SOURCE = r'''/**
 * World-space target selection indicator.
 * Uses pre-created 3D box instances instead of runtime-created 3D objects.
 */
const HAVOC_TARGET_CONFIG = {
  mobObjectName: 'Killer_clown',
  indicatorObjectNames: [
    'TargetSelectionRingTop',
    'TargetSelectionRingBottom',
    'TargetSelectionRingLeft',
    'TargetSelectionRingRight',
  ],
  indicatorRadius: 260,
  indicatorZOffset: 12,
  hiddenX: -100000,
  hiddenY: -100000,
};

function initializeHavocTargetSelection(runtimeScene) {
  if (!runtimeScene.__havocTargetSelection) {
    runtimeScene.__havocTargetSelection = { indicatorSegments: [], indicatorTarget: null };
  }
  const state = runtimeScene.__havocTargetSelection;
  if (state.indicatorSegments.length !== 4) {
    state.indicatorSegments = HAVOC_TARGET_CONFIG.indicatorObjectNames.map((name) => {
      const objects = runtimeScene.getObjects(name);
      return objects.length > 0 ? objects[0] : null;
    });
  }
  return state;
}

function setHavocIndicatorZ(segment, z) {
  if (!segment) return;
  if (typeof segment.setCenterZInScene === 'function') {
    segment.setCenterZInScene(z);
  }
}

function clearHavocTargetIndicator(runtimeScene) {
  const state = initializeHavocTargetSelection(runtimeScene);
  for (const segment of state.indicatorSegments) {
    if (!segment) continue;
    segment.setPosition(HAVOC_TARGET_CONFIG.hiddenX, HAVOC_TARGET_CONFIG.hiddenY);
    setHavocIndicatorZ(segment, 0);
  }
  state.indicatorTarget = null;
}

function updateHavocTargetIndicator(runtimeScene, target) {
  const state = initializeHavocTargetSelection(runtimeScene);
  if (!brawlerTargetIsValid(target)) {
    clearHavocTargetIndicator(runtimeScene);
    return;
  }
  if (state.indicatorSegments.some((segment) => !segment)) return;

  const r = HAVOC_TARGET_CONFIG.indicatorRadius;
  const x = target.getX();
  const y = target.getY();
  const z = target.getZ() + HAVOC_TARGET_CONFIG.indicatorZOffset;
  const positions = [[x, y-r], [x, y+r], [x-r, y], [x+r, y]];

  for (let i = 0; i < 4; i += 1) {
    state.indicatorSegments[i].setPosition(positions[i][0], positions[i][1]);
    setHavocIndicatorZ(state.indicatorSegments[i], z);
  }
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
    layers = layout.setdefault('layers', [])
    world = layers[0]
    instances = world.setdefault('instances', [])
    if any(i.get('name') == name for i in instances):
        return
    instances.append({
        'angle': 0, 'customSize': False, 'height': 0, 'layer': world.get('name', ''),
        'name': name, 'persistentUuid': str(uuid.uuid4()), 'width': 0,
        'x': -100000, 'y': -100000, 'zOrder': 0,
        'numberProperties': [], 'stringProperties': [], 'initialVariables': [],
    })


def main() -> None:
    TARGET.write_text(TARGET_SOURCE, encoding='utf-8', newline='\n')
    project = json.loads(PROJECT.read_text(encoding='utf-8'))
    for layout in project.get('layouts', []):
        objects = layout.setdefault('objects', [])
        definitions = [
            # X/Y are the ground plane in this project; Z is vertical.
            indicator_object('TargetSelectionRingTop', 520, 20, 6),
            indicator_object('TargetSelectionRingBottom', 520, 20, 6),
            indicator_object('TargetSelectionRingLeft', 20, 520, 6),
            indicator_object('TargetSelectionRingRight', 20, 520, 6),
        ]
        existing = {o.get('name') for o in objects}
        for definition in definitions:
            if definition['name'] not in existing:
                objects.append(definition)
            else:
                # Update only these four indicator definitions. No combat,
                # character, mob, camera, or other object definitions are touched.
                for obj in objects:
                    if obj.get('name') == definition['name']:
                        obj.clear()
                        obj.update(definition)
                        break
        folder = layout.setdefault('objectsFolderStructure', {'folderName': '__ROOT'})
        children = folder.setdefault('children', [])
        child_names = {c.get('objectName') for c in children}
        for definition in definitions:
            if definition['name'] not in child_names:
                children.append({'objectName': definition['name']})
        add_instance(layout, 'TargetSelectionRingTop')
        add_instance(layout, 'TargetSelectionRingBottom')
        add_instance(layout, 'TargetSelectionRingLeft')
        add_instance(layout, 'TargetSelectionRingRight')
        break
    PROJECT.write_text(json.dumps(project, indent=2, ensure_ascii=False), encoding='utf-8', newline='\n')
    print('Installed corrected ground-plane target indicator geometry.')
    print('Target selection and Brawler combat logic were not changed.')
    print('Killer Clown event was not modified.')


if __name__ == '__main__':
    main()
