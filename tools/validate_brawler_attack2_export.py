import bpy
import os

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
INPUT = os.path.join(ROOT, 'brawler_inplace_attack2_modified.glb')
ACTION_NAME = 'box_03.001'
ROOT_BONE = 'mixamorig:Hips'
EPS = 1e-4

ARM_BONES = [
    'mixamorig:LeftShoulder', 'mixamorig:LeftArm', 'mixamorig:LeftForeArm', 'mixamorig:LeftHand',
    'mixamorig:RightShoulder', 'mixamorig:RightArm', 'mixamorig:RightForeArm', 'mixamorig:RightHand',
]

def action_fcurves(action):
    curves = []
    for layer in action.layers:
        for strip in layer.strips:
            for bag in strip.channelbags:
                curves.extend(list(bag.fcurves))
    return curves

def bone_curves(all_curves, bone_name):
    prefix = f'pose.bones["{bone_name}"]'
    return [fc for fc in all_curves if fc.data_path.startswith(prefix)]

def max_delta(curves, frame_a, frame_b):
    value = 0.0
    for fc in curves:
        value = max(value, abs(fc.evaluate(frame_a) - fc.evaluate(frame_b)))
    return value

def max_section_motion(curves, start, end, samples=60):
    value = 0.0
    for i in range(samples):
        a = start + (end - start) * (i / samples)
        b = start + (end - start) * ((i + 1) / samples)
        value = max(value, max_delta(curves, a, b))
    return value

def main():
    if not os.path.exists(INPUT):
        raise FileNotFoundError(INPUT)

    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=INPUT)

    action = bpy.data.actions.get(ACTION_NAME)
    if action is None:
        raise RuntimeError(f"Missing action: {ACTION_NAME}")

    first, last = action.frame_range
    duration = last - first
    hook_end = first + duration * 0.48
    hold_start = first + duration * 0.78

    all_curves = action_fcurves(action)
    pose_curves = [fc for fc in all_curves if fc.data_path.startswith('pose.bones[')]
    root_curves = bone_curves(all_curves, ROOT_BONE)

    arm_curves = []
    for bone in ARM_BONES:
        arm_curves.extend(bone_curves(all_curves, bone))

    # The exporter may bake channels because the modifier intentionally creates
    # mixed interpolation types. Validate the exported action semantically:
    # hook and punch sections must contain motion, while the final hold must be flat.
    hook_motion = max_section_motion(arm_curves, first, hook_end)
    punch_motion = max_section_motion(arm_curves, hook_end, hold_start)
    pose_hold_delta = max_delta(pose_curves, hold_start, last)
    root_hold_delta = max_delta(root_curves, hold_start, last)

    print("\n" + "=" * 70)
    print("BRAWLER ATTACK2 EXPORTED GLB VALIDATION")
    print("=" * 70)
    print(f"Action           : {ACTION_NAME}")
    print(f"Frame range      : {first:.2f} -> {last:.2f}")
    print(f"Hook section     : {first:.2f} -> {hook_end:.2f}")
    print(f"Power punch      : {hook_end:.2f} -> {hold_start:.2f}")
    print(f"Final hold       : {hold_start:.2f} -> {last:.2f}")
    print(f"Hook arm motion  : {hook_motion:.8f}")
    print(f"Punch arm motion : {punch_motion:.8f}")
    print(f"Pose hold delta  : {pose_hold_delta:.8f}")
    print(f"Root hold delta  : {root_hold_delta:.8f}")
    print(f"Hold stable      : {pose_hold_delta <= EPS}")
    print(f"Root stable      : {root_hold_delta <= EPS}")
    passed = (
        hook_motion > EPS and
        punch_motion > EPS and
        pose_hold_delta <= EPS and
        root_hold_delta <= EPS
    )
    print(f"PASS             : {passed}")
    print("=" * 70)

    if not passed:
        raise SystemExit(1)

if __name__ == "__main__":
    main()
