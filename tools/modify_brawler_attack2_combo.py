import bpy
import os
import math

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
INPUT = os.path.join(ROOT, 'brawler_inplace.glb')
OUTPUT = os.path.join(ROOT, 'brawler_inplace_attack2_modified.glb')
WORK_BLEND = os.path.join(ROOT, 'brawler_attack2_work.blend')
ACTION_NAME = 'box_03.001'

# The source Attack 2 is a right-hand attack. For the first section we mirror
# only the upper-body punching chain to create a left hook. The previous
# version used an incorrect quaternion reflection (Z/W sign inversion), which
# produced an unnatural pose. Reflection across the character X/sagittal axis
# requires (-X, Y, Z, -W) for the quaternion components.
ARM_PAIRS = [
    ('mixamorig:RightShoulder', 'mixamorig:LeftShoulder'),
    ('mixamorig:RightArm', 'mixamorig:LeftArm'),
    ('mixamorig:RightForeArm', 'mixamorig:LeftForeArm'),
    ('mixamorig:RightHand', 'mixamorig:LeftHand'),
]

HAND_RIGHT_BONES = [
    'mixamorig:RightHandIndex1','mixamorig:RightHandIndex2','mixamorig:RightHandIndex3','mixamorig:RightHandIndex4',
    'mixamorig:RightHandMiddle1','mixamorig:RightHandMiddle2','mixamorig:RightHandMiddle3','mixamorig:RightHandMiddle4',
    'mixamorig:RightHandPinky1','mixamorig:RightHandPinky2','mixamorig:RightHandPinky3','mixamorig:RightHandPinky4',
    'mixamorig:RightHandRing1','mixamorig:RightHandRing2','mixamorig:RightHandRing3','mixamorig:RightHandRing4',
    'mixamorig:RightHandThumb1','mixamorig:RightHandThumb2','mixamorig:RightHandThumb3','mixamorig:RightHandThumb4',
]

def action_fcurves(action):
    curves = []
    for layer in action.layers:
        for strip in layer.strips:
            for bag in strip.channelbags:
                curves.extend(list(bag.fcurves))
    return curves

def clear_range(curve, start, end):
    indices = [i for i, kp in enumerate(curve.keyframe_points)
               if start <= kp.co.x <= end]
    for index in reversed(indices):
        if index < len(curve.keyframe_points):
            curve.keyframe_points.remove(curve.keyframe_points[index], fast=True)
    curve.update()

def insert_key(curve, frame, value, interpolation='BEZIER'):
    kp = curve.keyframe_points.insert(frame, value, options={'FAST'})
    kp.interpolation = interpolation
    return kp

def mirror_quaternion_x(index, value):
    # Reflection across the character's left/right (X) plane:
    # q' = (-x, y, z, -w)
    if index == 0:
        return -value
    if index == 1:
        return value
    if index == 2:
        return value
    return -value

def copy_keys(curve):
    return [(kp.co.x, kp.co.y, kp.interpolation) for kp in curve.keyframe_points]

def mirror_chain(action, start, end):
    curves = action_fcurves(action)
    pairs = list(ARM_PAIRS)
    for right in HAND_RIGHT_BONES:
        left = right.replace('mixamorig:Right', 'mixamorig:Left', 1)
        pairs.append((right, left))

    for right, left in pairs:
        srcs = {fc.array_index: fc for fc in curves
                if fc.data_path == f'pose.bones["{right}"].rotation_quaternion'}
        dsts = {fc.array_index: fc for fc in curves
                if fc.data_path == f'pose.bones["{left}"].rotation_quaternion'}
        if len(srcs) != 4 or len(dsts) != 4:
            continue

        source_keys = {
            idx: [(frame, value, interpolation)
                  for frame, value, interpolation in copy_keys(srcs[idx])
                  if start <= frame < end]
            for idx in range(4)
        }

        for idx in range(4):
            clear_range(dsts[idx], start, end)
            for frame, value, interpolation in source_keys[idx]:
                insert_key(dsts[idx], frame, mirror_quaternion_x(idx, value), interpolation)

def neutralize_right_arm(action, start, end):
    curves = action_fcurves(action)
    for bone in [
        'mixamorig:RightShoulder',
        'mixamorig:RightArm',
        'mixamorig:RightForeArm',
        'mixamorig:RightHand',
    ]:
        targets = [fc for fc in curves
                   if fc.data_path == f'pose.bones["{bone}"].rotation_quaternion']
        for fc in targets:
            if not fc.keyframe_points:
                continue
            value = fc.evaluate(start)
            clear_range(fc, start, end)
            insert_key(fc, start, value)
            insert_key(fc, end, value)

def freeze_final_hold_from_pose(action, hold_start, end):
    for fc in action_fcurves(action):
        if not fc.keyframe_points:
            continue
        hold_value = fc.evaluate(hold_start)
        clear_range(fc, hold_start, end)
        insert_key(fc, hold_start, hold_value, 'CONSTANT')
        insert_key(fc, end, hold_value, 'CONSTANT')

def main():
    if not os.path.exists(INPUT):
        raise FileNotFoundError(INPUT)

    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=INPUT)

    action = bpy.data.actions.get(ACTION_NAME)
    if action is None:
        raise RuntimeError(f'Missing action: {ACTION_NAME}')

    start, end = action.frame_range
    duration = end - start
    split = start + duration * 0.48
    hold_start = math.ceil(start + duration * 0.78)

    # First section: original right punch mirrored into a left hook.
    mirror_chain(action, start, split)
    neutralize_right_arm(action, start, end=split)

    # Second section remains the original right-hand power punch.
    # Final section is frozen at the actual power-punch pose.
    freeze_final_hold_from_pose(action, hold_start, end)

    bpy.context.view_layer.update()
    bpy.ops.wm.save_as_mainfile(filepath=WORK_BLEND)
    bpy.ops.export_scene.gltf(
        filepath=OUTPUT,
        export_format='GLB',
        export_animations=True,
        export_skins=True,
        export_morph=False,
        export_apply=False,
    )

    print('\n' + '=' * 68)
    print('BRAWLER ATTACK2 MODIFICATION COMPLETE')
    print('=' * 68)
    print(f'Action      : {ACTION_NAME}')
    print(f'Range       : {start:.2f} -> {end:.2f}')
    print(f'Hook split  : {split:.2f}')
    print(f'Final hold  : {hold_start:.2f} -> {end:.2f}')
    print('Sequence    : LEFT HOOK -> RIGHT POWER PUNCH -> HOLD')
    print('Mirror      : corrected X-axis quaternion reflection')
    print(f'Output      : {OUTPUT}')

if __name__ == '__main__':
    main()
