import bpy
import os

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
INPUT = os.path.join(ROOT, 'brawler_inplace.glb')
OUTPUT = os.path.join(ROOT, 'brawler_inplace_attack2_modified.glb')
WORK_BLEND = os.path.join(ROOT, 'brawler_attack2_work.blend')
ACTION_NAME = 'box_03.001'

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
    if not hasattr(action, 'layers'):
        raise RuntimeError('Blender 5.2 action layer API is unavailable')
    for layer in action.layers:
        for strip in layer.strips:
            for bag in strip.channelbags:
                curves.extend(list(bag.fcurves))
    return curves


def clear_range(curve, start, end):
    # Blender 5.2 can invalidate a Keyframe reference after removal. Remove
    # by descending index so every removal targets the current collection.
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


def mirrored_quat_value(index, value):
    return value if index in (0, 1) else -value


def mirror_right_to_left(action, start, end):
    curves = action_fcurves(action)

    for right, left in ARM_PAIRS:
        srcs = {fc.array_index: fc for fc in curves
                if fc.data_path == f'pose.bones["{right}"].rotation_quaternion'}
        dsts = {fc.array_index: fc for fc in curves
                if fc.data_path == f'pose.bones["{left}"].rotation_quaternion'}
        if len(srcs) != 4 or len(dsts) != 4:
            continue

        source_keys = {idx: [(kp.co.x, kp.co.y, kp.interpolation)
                             for kp in srcs[idx].keyframe_points
                             if start <= kp.co.x <= end] for idx in range(4)}
        for idx in range(4):
            clear_range(dsts[idx], start, end)
            for frame, value, interpolation in source_keys[idx]:
                insert_key(dsts[idx], frame, mirrored_quat_value(idx, value), interpolation)

    for right in HAND_RIGHT_BONES:
        left = right.replace('mixamorig:Right', 'mixamorig:Left', 1)
        srcs = {fc.array_index: fc for fc in curves
                if fc.data_path == f'pose.bones["{right}"].rotation_quaternion'}
        dsts = {fc.array_index: fc for fc in curves
                if fc.data_path == f'pose.bones["{left}"].rotation_quaternion'}
        if len(srcs) != 4 or len(dsts) != 4:
            continue

        source_keys = {idx: [(kp.co.x, kp.co.y, kp.interpolation)
                             for kp in srcs[idx].keyframe_points
                             if start <= kp.co.x <= end] for idx in range(4)}
        for idx in range(4):
            clear_range(dsts[idx], start, end)
            for frame, value, interpolation in source_keys[idx]:
                insert_key(dsts[idx], frame, mirrored_quat_value(idx, value), interpolation)


def neutralize_right_arm(action, start, end):
    curves = action_fcurves(action)
    for bone in ['mixamorig:RightShoulder','mixamorig:RightArm',
                 'mixamorig:RightForeArm','mixamorig:RightHand']:
        targets = [fc for fc in curves
                   if fc.data_path == f'pose.bones["{bone}"].rotation_quaternion']
        for fc in targets:
            if not fc.keyframe_points:
                continue
            value = fc.evaluate(start)
            clear_range(fc, start, end)
            insert_key(fc, start, value)
            insert_key(fc, end, value)


def freeze_final_hold(action, freeze_frame):
    end = action.frame_range[1]
    for fc in action_fcurves(action):
        if not fc.keyframe_points:
            continue
        final_value = fc.evaluate(end)
        clear_range(fc, freeze_frame, end)
        insert_key(fc, freeze_frame, final_value, 'CONSTANT')
        insert_key(fc, end, final_value, 'CONSTANT')


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
    mirror_right_to_left(action, start, split)
    neutralize_right_arm(action, start, split)

    freeze_frame = start + duration * 0.78
    freeze_final_hold(action, freeze_frame)
    action.update_tag(refresh={'DATA'})

    bpy.ops.wm.save_as_mainfile(filepath=WORK_BLEND)
    bpy.ops.export_scene.gltf(filepath=OUTPUT, export_format='GLB',
                              export_animations=True, export_skins=True,
                              export_morph=False, export_apply=False)

    print('\n' + '=' * 68)
    print('BRAWLER ATTACK2 MODIFICATION COMPLETE')
    print('=' * 68)
    print(f'Action      : {ACTION_NAME}')
    print(f'Range       : {start:.2f} -> {end:.2f}')
    print(f'Hook split  : {split:.2f}')
    print(f'Final hold  : {freeze_frame:.2f} -> {end:.2f}')
    print('Sequence    : LEFT HOOK -> RIGHT POWER PUNCH -> HOLD')
    print(f'Output      : {OUTPUT}')


if __name__ == '__main__':
    main()
