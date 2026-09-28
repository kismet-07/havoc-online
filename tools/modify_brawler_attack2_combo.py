import bpy
import os
import math
from mathutils import Matrix

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
INPUT = os.path.join(ROOT, 'brawler_inplace.glb')
OUTPUT = os.path.join(ROOT, 'brawler_inplace_attack2_modified.glb')
ACTION_NAME = 'box_03.001'

ARM_BONES = [
    'mixamorig:LeftShoulder', 'mixamorig:LeftArm', 'mixamorig:LeftForeArm', 'mixamorig:LeftHand',
    'mixamorig:RightShoulder', 'mixamorig:RightArm', 'mixamorig:RightForeArm', 'mixamorig:RightHand',
]
HAND_BONES = [
    'mixamorig:LeftHandIndex1','mixamorig:LeftHandIndex2','mixamorig:LeftHandIndex3','mixamorig:LeftHandIndex4',
    'mixamorig:LeftHandMiddle1','mixamorig:LeftHandMiddle2','mixamorig:LeftHandMiddle3','mixamorig:LeftHandMiddle4',
    'mixamorig:LeftHandPinky1','mixamorig:LeftHandPinky2','mixamorig:LeftHandPinky3','mixamorig:LeftHandPinky4',
    'mixamorig:LeftHandRing1','mixamorig:LeftHandRing2','mixamorig:LeftHandRing3','mixamorig:LeftHandRing4',
    'mixamorig:LeftHandThumb1','mixamorig:LeftHandThumb2','mixamorig:LeftHandThumb3','mixamorig:LeftHandThumb4',
    'mixamorig:RightHandIndex1','mixamorig:RightHandIndex2','mixamorig:RightHandIndex3','mixamorig:RightHandIndex4',
    'mixamorig:RightHandMiddle1','mixamorig:RightHandMiddle2','mixamorig:RightHandMiddle3','mixamorig:RightHandMiddle4',
    'mixamorig:RightHandPinky1','mixamorig:RightHandPinky2','mixamorig:RightHandPinky3','mixamorig:RightHandPinky4',
    'mixamorig:RightHandRing1','mixamorig:RightHandRing2','mixamorig:RightHandRing3','mixamorig:RightHandRing4',
    'mixamorig:RightHandThumb1','mixamorig:RightHandThumb2','mixamorig:RightHandThumb3','mixamorig:RightHandThumb4',
]


def action_bone_fcurves(action, bone_name):
    prefix = f'pose.bones["{bone_name}"]'
    return [fc for fc in action.fcurves if fc.data_path.startswith(prefix)]


def copy_curve_values(src, dst, start, end):
    # Copy the source curve's sampled motion into the destination curve for the
    # requested interval. Existing destination keys in that interval are removed.
    for kp in list(dst.keyframe_points):
        if start <= kp.co.x <= end:
            dst.keyframe_points.remove(kp)
    for kp in src.keyframe_points:
        if start <= kp.co.x <= end:
            nk = dst.keyframe_points.insert(kp.co.x, kp.co.y, options={'FAST'})
            nk.interpolation = kp.interpolation


def mirror_quaternion_component(path_index, value):
    # Reflection X * R * X for a quaternion: (w, x, -y, -z).
    if path_index == 0:
        return value
    if path_index == 1:
        return value
    return -value


def mirror_right_to_left(action, start, end):
    # Build a mirrored left-hand motion from the existing right-hand motion.
    # Mixamo's paired armature uses mirrored local axes, so quaternion components
    # are reflected across the character's sagittal plane.
    pairs = [
        ('mixamorig:RightShoulder', 'mixamorig:LeftShoulder'),
        ('mixamorig:RightArm', 'mixamorig:LeftArm'),
        ('mixamorig:RightForeArm', 'mixamorig:LeftForeArm'),
        ('mixamorig:RightHand', 'mixamorig:LeftHand'),
    ]
    for right, left in pairs:
        srcs = {fc.array_index: fc for fc in action_bone_fcurves(action, right)
                if fc.data_path.endswith('rotation_quaternion')}
        dsts = {fc.array_index: fc for fc in action_bone_fcurves(action, left)
                if fc.data_path.endswith('rotation_quaternion')}
        if len(srcs) != 4 or len(dsts) != 4:
            continue
        for idx in range(4):
            dst = dsts[idx]
            for kp in list(dst.keyframe_points):
                if start <= kp.co.x <= end:
                    dst.keyframe_points.remove(kp)
            for kp in srcs[idx].keyframe_points:
                if start <= kp.co.x <= end:
                    value = mirror_quaternion_component(idx, kp.co.y)
                    nk = dst.keyframe_points.insert(kp.co.x, value, options={'FAST'})
                    nk.interpolation = kp.interpolation

    # Mirror the fist/finger animation as well so the left hand stays closed.
    for right in HAND_BONES:
        if not right.startswith('mixamorig:Right'):
            continue
        left = right.replace('mixamorig:Right', 'mixamorig:Left', 1)
        srcs = {fc.array_index: fc for fc in action_bone_fcurves(action, right)
                if fc.data_path.endswith('rotation_quaternion')}
        dsts = {fc.array_index: fc for fc in action_bone_fcurves(action, left)
                if fc.data_path.endswith('rotation_quaternion')}
        if len(srcs) != 4 or len(dsts) != 4:
            continue
        for idx in range(4):
            dst = dsts[idx]
            for kp in list(dst.keyframe_points):
                if start <= kp.co.x <= end:
                    dst.keyframe_points.remove(kp)
            for kp in srcs[idx].keyframe_points:
                if start <= kp.co.x <= end:
                    value = mirror_quaternion_component(idx, kp.co.y)
                    nk = dst.keyframe_points.insert(kp.co.x, value, options={'FAST'})
                    nk.interpolation = kp.interpolation


def neutralize_right_arm(action, start, end):
    # Keep the right side out of the first hook so the sequence reads clearly
    # as left hook -> right power punch.
    for bone in [
        'mixamorig:RightShoulder','mixamorig:RightArm','mixamorig:RightForeArm','mixamorig:RightHand'
    ]:
        curves = [fc for fc in action_bone_fcurves(action, bone) if fc.data_path.endswith('rotation_quaternion')]
        for fc in curves:
            if not fc.keyframe_points:
                continue
            value = fc.evaluate(start)
            for kp in list(fc.keyframe_points):
                if start <= kp.co.x <= end:
                    fc.keyframe_points.remove(kp)
            fc.keyframe_points.insert(start, value, options={'FAST'})
            fc.keyframe_points.insert(end, value, options={'FAST'})


def main():
    if not os.path.exists(INPUT):
        raise FileNotFoundError(INPUT)

    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=INPUT)

    armatures = [o for o in bpy.context.scene.objects if o.type == 'ARMATURE']
    if not armatures:
        raise RuntimeError('No armature found')
    armature = armatures[0]
    action = bpy.data.actions.get(ACTION_NAME)
    if action is None:
        raise RuntimeError(f'Missing action: {ACTION_NAME}')

    start, end = action.frame_range
    duration = end - start
    split = start + duration * 0.48

    # First section: left hook synthesized from the existing right-hand motion.
    mirror_right_to_left(action, start, split)
    neutralize_right_arm(action, start, split)

    # The second section remains the original right-hand power-punch motion.
    # Keep the animation's existing root motion untouched; gameplay already
    # handles character movement independently from the GLB.
    action.update_tag(refresh={'DATA'})

    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT, 'brawler_attack2_work.blend'))
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
    print(f'Action : {ACTION_NAME}')
    print(f'Range  : {start:.2f} -> {end:.2f}')
    print(f'Split  : {split:.2f}')
    print('Sequence: LEFT HOOK -> RIGHT POWER PUNCH')
    print(f'Output : {OUTPUT}')


if __name__ == '__main__':
    main()
