import bpy
import os
import math

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
INPUT = os.path.join(ROOT, 'brawler_inplace_attack2_modified.glb')
ACTION_NAME = 'box_03.001'

SAMPLE_COUNT = 120
MOTION_EPS = 1e-5
HOLD_EPS = 1e-4

ARM_BONES = [
    'mixamorig:LeftShoulder', 'mixamorig:LeftArm',
    'mixamorig:LeftForeArm', 'mixamorig:LeftHand',
    'mixamorig:RightShoulder', 'mixamorig:RightArm',
    'mixamorig:RightForeArm', 'mixamorig:RightHand',
]

def action_fcurves(action):
    result = []
    for layer in action.layers:
        for strip in layer.strips:
            for bag in strip.channelbags:
                result.extend(list(bag.fcurves))
    return result

def curves_for_bones(all_curves, bones):
    wanted = tuple(f'pose.bones["{bone}"]' for bone in bones)
    return [fc for fc in all_curves if any(fc.data_path.startswith(prefix) for prefix in wanted)]

def max_step_motion(curves, start, end, samples=SAMPLE_COUNT):
    maximum = 0.0
    if end <= start:
        return maximum
    previous = start
    for i in range(1, samples + 1):
        current = start + (end - start) * (i / samples)
        for fc in curves:
            maximum = max(maximum, abs(fc.evaluate(current) - fc.evaluate(previous)))
        previous = current
    return maximum

def main():
    if not os.path.exists(INPUT):
        raise FileNotFoundError(INPUT)

    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=INPUT)

    action = bpy.data.actions.get(ACTION_NAME)
    if action is None:
        raise RuntimeError(f'Missing action: {ACTION_NAME}')

    first, last = action.frame_range
    duration = last - first
    hook_end = first + duration * 0.48
    hold_start = math.ceil(first + duration * 0.78)

    all_curves = action_fcurves(action)
    arm_curves = curves_for_bones(all_curves, ARM_BONES)

    hook_motion = max_step_motion(arm_curves, first, hook_end)
    punch_motion = max_step_motion(arm_curves, hook_end, hold_start)
    hold_motion = max_step_motion(arm_curves, hold_start, last)

    print('\n' + '=' * 70)
    print('BRAWLER ATTACK2 EXPORTED GLB VALIDATION')
    print('=' * 70)
    print(f'Action           : {ACTION_NAME}')
    print(f'Frame range      : {first:.2f} -> {last:.2f}')
    print(f'Hook section     : {first:.2f} -> {hook_end:.2f}')
    print(f'Power punch      : {hook_end:.2f} -> {hold_start:.2f}')
    print(f'Final hold       : {hold_start:.2f} -> {last:.2f}')
    print(f'Hook arm motion  : {hook_motion:.8f}')
    print(f'Punch arm motion : {punch_motion:.8f}')
    print(f'Hold arm motion  : {hold_motion:.8f}')
    print(f'Hold stable      : {hold_motion <= HOLD_EPS}')
    passed = hook_motion > MOTION_EPS and punch_motion > MOTION_EPS and hold_motion <= HOLD_EPS
    print(f'PASS             : {passed}')
    print('=' * 70)

    if not passed:
        raise SystemExit(1)

if __name__ == '__main__':
    main()
