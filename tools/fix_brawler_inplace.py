from __future__ import annotations

import argparse
import struct
from pathlib import Path

from pygltflib import GLTF2


TARGET_ANIMATIONS = {"walk.001", "run.001"}
TARGET_NODE_NAME = "mixamorig:Hips"
TARGET_AXIS = 2  # Z


def read_vec3_accessor(gltf: GLTF2, accessor_index: int, blob: bytes):
    accessor = gltf.accessors[accessor_index]
    if accessor.type != "VEC3" or accessor.componentType != 5126:
        raise ValueError(
            f"Accessor {accessor_index} must be FLOAT VEC3; "
            f"got type={accessor.type!r}, componentType={accessor.componentType}"
        )

    view = gltf.bufferViews[accessor.bufferView]
    stride = view.byteStride or 12
    base = (view.byteOffset or 0) + (accessor.byteOffset or 0)

    values = []
    for i in range(accessor.count):
        offset = base + i * stride
        values.append(list(struct.unpack_from("<3f", blob, offset)))
    return values, base, stride


def write_z_values(blob: bytearray, base: int, stride: int, values, z_value: float):
    for i in range(len(values)):
        struct.pack_into("<f", blob, base + i * stride + TARGET_AXIS * 4, z_value)


def find_target_node(gltf: GLTF2) -> int:
    matches = [i for i, node in enumerate(gltf.nodes) if node.name == TARGET_NODE_NAME]
    if len(matches) != 1:
        raise RuntimeError(
            f"Expected exactly one node named {TARGET_NODE_NAME!r}; found {matches}"
        )
    return matches[0]


def process(input_path: Path, output_path: Path):
    gltf = GLTF2().load(str(input_path))
    blob = bytearray(gltf.binary_blob())
    node_index = find_target_node(gltf)

    changed = []

    for animation in gltf.animations:
        if animation.name not in TARGET_ANIMATIONS:
            continue

        channels = [
            channel
            for channel in animation.channels
            if channel.target.node == node_index and channel.target.path == "translation"
        ]

        if len(channels) != 1:
            raise RuntimeError(
                f"{animation.name!r}: expected exactly one translation channel "
                f"for {TARGET_NODE_NAME}; found {len(channels)}"
            )

        sampler = animation.samplers[channels[0].sampler]
        values, base, stride = read_vec3_accessor(gltf, sampler.output, blob)

        if not values:
            raise RuntimeError(f"{animation.name!r}: translation accessor is empty")

        original_z = [v[TARGET_AXIS] for v in values]
        fixed_z = original_z[0]

        write_z_values(blob, base, stride, values, fixed_z)

        changed.append(
            {
                "animation": animation.name,
                "accessor": sampler.output,
                "keyframes": len(values),
                "original_min_z": min(original_z),
                "original_max_z": max(original_z),
                "fixed_z": fixed_z,
            }
        )

    if {item["animation"] for item in changed} != TARGET_ANIMATIONS:
        raise RuntimeError(
            f"Expected {sorted(TARGET_ANIMATIONS)}, "
            f"modified {[item['animation'] for item in changed]}"
        )

    # Replace the GLB's embedded binary payload without changing accessor sizes.
    gltf.set_binary_blob(bytes(blob))
    gltf.save(str(output_path))

    # Reload and verify the output still contains the expected animation channels.
    verify = GLTF2().load(str(output_path))
    verify_blob = verify.binary_blob()
    verify_node = find_target_node(verify)

    for animation in verify.animations:
        if animation.name not in TARGET_ANIMATIONS:
            continue
        channel = next(
            c for c in animation.channels
            if c.target.node == verify_node and c.target.path == "translation"
        )
        sampler = animation.samplers[channel.sampler]
        values, _, _ = read_vec3_accessor(verify, sampler.output, verify_blob)
        z_values = [v[TARGET_AXIS] for v in values]
        if max(z_values) - min(z_values) > 1e-6:
            raise RuntimeError(
                f"Verification failed for {animation.name!r}: "
                f"Z range is {min(z_values)} -> {max(z_values)}"
            )

    print(f"Input : {input_path}")
    print(f"Output: {output_path}")
    print(f"Node  : {TARGET_NODE_NAME} (index {node_index})")
    print()
    for item in changed:
        print(
            f"{item['animation']}: keyframes={item['keyframes']}, "
            f"Z {item['original_min_z']:.9f} -> {item['original_max_z']:.9f}, "
            f"fixed={item['fixed_z']:.9f}"
        )
    print()
    print("Verification passed: Walk/Run Hips Z translation is constant in output.")


def main():
    parser = argparse.ArgumentParser(
        description="Remove forward Hips Z root motion from Brawler Walk/Run animations."
    )
    parser.add_argument("input", nargs="?", default="Brawler.glb")
    parser.add_argument("output", nargs="?", default="Brawler_inplace.glb")
    args = parser.parse_args()

    input_path = Path(args.input)
    output_path = Path(args.output)

    if not input_path.is_file():
        raise SystemExit(f"Input GLB not found: {input_path}")
    if output_path.resolve() == input_path.resolve():
        raise SystemExit("Refusing to overwrite the original Brawler.glb")
    if output_path.exists():
        raise SystemExit(f"Output already exists: {output_path}")

    process(input_path, output_path)


if __name__ == "__main__":
    main()
