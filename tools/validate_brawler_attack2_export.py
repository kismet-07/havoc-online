import bpy
import os
import math

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
INPUT = os.path.join(ROOT, 'brawler_inplace_attack2_modified.glb')
ACTION_NAME = 'box_03.001'
ROOT_BONE = 'mixamorig:Hips'


def curves(action):
    out = []
    for layer in action.layers:
        for strip in layer.strips:
            for bag in getattr(strip, 'channelbags', []):
                out.extend(list(bag.fcurves))
    return out


def main():
    if not os.path.exists(INPUT):
        raise FileNotFoundError(INPUT)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=INPUT)
    action = bpy.data.actions.get(ACTION_NAME)
    arm = bpy.data.objects.get('Armature')
    if action is None:
        raise RuntimeError(f'Missing action: {ACTION_NAME}')
    if arm is None:
        raise RuntimeError('Missing Armature')

    first, last = action.frame_range
    freeze = first + (last - first) * 0.78
    all_curves = curves(action)
    pose_curves = [fc for fc in all_curves if fc.data_path.startswith('pose.bones[')]
    root_curves = [fc for fc in pose_curves if f'pose.bones["{ROOT_BONE}"]' in fc.data_path]

    def max_delta(fc_list, a, b):
        m = 0.0
        for fc in fc_list:
            va = fc.evaluate(a)
            vb = fc.evaluate(b)
            m = max(m, abs(va - vb))
        return m

    pose_delta = max_delta(pose_curves, freeze, last)
    root_delta = max_delta(root_curves, freeze, last)

    print('\n' + '=' * 70)
    print('BRAWLER ATTACK2 EXPORTED GLB VALIDATION')
    print('=' * 70)
    print(f'Action       : {ACTION_NAME}')
    print(f'Frame range  : {first:.2f} -> {last:.2f}')
    print(f'Power punch  : {freeze:.2f} -> {last:.2f}')
    print(f'Pose delta   : {pose_delta:.8f}')
    print(f'Root delta   : {root_delta:.8f}')
    print(f'Pose held    : {pose_delta <= 1e-4}')
    print(f'Root held    : {root_delta <= 1e-4}')
    print(f'PASS         : {pose_delta <= 1e-4 and root_delta <= 1e-4}')
    print('=' * 70)

    if not (pose_delta <= 1e-4 and root_delta <= 1e-4):
        raise SystemExit(1)


if __name__ == '__main__':
    main()
