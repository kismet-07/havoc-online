from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PROJECT = ROOT / 'Havoc Online.json'
TARGET = ROOT / 'scripts' / 'combat' / 'target-system.js'

TARGET_SOURCE = r'''/**
 * Temporary world-space target arrow diagnostic.
 * Keeps a pre-created Primitive3D::Box arrow visible at a known world position.
 */
const HAVOC_TARGET_CONFIG = {
  mobObjectName: 'Killer_clown',
  indicatorObjectNames: [
    'TargetSelectionArrowStem',
    'TargetSelectionArrowHead',
  ],
  hiddenX: -100000,
  hiddenY: -100000,
  debugZ: 900,
};

function initializeHavocTargetSelection(runtimeScene) {
  if (!runtimeScene.__havocTargetSelection) {
    runtimeScene.__havocTargetSelection = {
      indicatorSegments: [],
      indicatorTarget: null,
      diagnosticShown: false,
    };
  }

  const state = runtimeScene.__havocTargetSelection;
  if (state.indicatorSegments.length !== HAVOC_TARGET_CONFIG.indicatorObjectNames.length) {
    state.indicatorSegments = HAVOC_TARGET_CONFIG.indicatorObjectNames.map((name) => {
      const objects = runtimeScene.getObjects(name);
      return objects.length > 0 ? objects[0] : null;
    });
  }

  return state;
}

function setHavocIndicatorPosition(segment, x, y, z) {
  if (!segment || segment.isDestroyed) return false;

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

function showDiagnosticArrow(runtimeScene) {
  const state = initializeHavocTargetSelection(runtimeScene);
  const stem = state.indicatorSegments[0];
  const head = state.indicatorSegments[1];

  if (!stem || !head) {
    console.warn('[Havoc Target] Diagnostic arrow objects missing.');
    return;
  }

  setHavocIndicatorPosition(stem, 0, 0, HAVOC_TARGET_CONFIG.debugZ);
  setHavocIndicatorPosition(head, 0, 0, HAVOC_TARGET_CONFIG.debugZ - 120);

  if (!state.diagnosticShown) {
    console.log('[Havoc Target] Diagnostic arrow placed at world origin.');
    state.diagnosticShown = true;
  }
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

  showDiagnosticArrow(runtimeScene);

  if (input.targetTapRequested) {
    const selectedTarget = selectHavocTargetUnderCursor(runtimeScene);
    if (selectedTarget) {
      combat.target = selectedTarget;
      updateHavocTargetIndicator(runtimeScene, selectedTarget);
    } else {
      combat.target = null;
      // Diagnostic arrow intentionally remains visible.
    }
  }

  if (!brawlerTargetIsValid(combat.target)) {
    combat.target = null;
    return;
  }

  if (selection.indicatorTarget === combat.target) {
    updateHavocTargetIndicator(runtimeScene, combat.target);
  }
}
'''

TARGET.write_text(TARGET_SOURCE, encoding='utf-8', newline='\n')
project = json.loads(PROJECT.read_text(encoding='utf-8'))
for layout in project.get('layouts', []):
    objects = layout.setdefault('objects', [])
    for name, width, height, depth in [
        ('TargetSelectionArrowStem', 32, 32, 180),
        ('TargetSelectionArrowHead', 150, 32, 70),
    ]:
        if not any(o.get('name') == name for o in objects):
            objects.append({
                'name': name, 'tags': 'HavocCombatUI', 'type': 'Primitive3D::Box',
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
            })
    world = layout.setdefault('layers', [])[0]
    instances = world.setdefault('instances', [])
    for name in ['TargetSelectionArrowStem', 'TargetSelectionArrowHead']:
        if not any(i.get('name') == name for i in instances):
            instances.append({
                'angle': 0, 'customSize': False, 'height': 0,
                'layer': world.get('name', ''), 'name': name,
                'persistentUuid': name + '-diagnostic', 'width': 0,
                'x': 0, 'y': 0, 'zOrder': 1000,
                'numberProperties': [], 'stringProperties': [], 'initialVariables': [],
            })
    break
PROJECT.write_text(json.dumps(project, indent=2, ensure_ascii=False), encoding='utf-8', newline='\n')
print('Installed target-arrow render diagnostic.')
print('Arrow is forced visible at world origin; target selection remains available.')
