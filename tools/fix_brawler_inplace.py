from __future__ import annotations

import argparse
import json
import struct
from pathlib import Path

TARGET_ANIMATIONS = {"walk.001", "run.001"}
TARGET_NODE_NAME = "mixamorig:Hips"
TARGET_AXIS = 2  # Z


def load_glb(path: Path):
    data = bytearray(path.read_bytes())
    if len(data) < 20 or data[0:4] != b"glTF":
        raise ValueError("Not a GLB file")

    version, total_length = struct.unpack_from("<II", data, 4)
    if version != 2:
        raise ValueError(f"Expected GLB version 2, got {version}")
    if total_length != len(data):
        raise ValueError(
            f"GLB length mismatch: header={total_length}, actual={len(data)}"
        )

    offset = 12
    json_chunk = None
    bin_start = None
    bin_length = None

    while offset < len(data):
        chunk_length, chunk_type = struct.unpack_from("<II", data, offset)
        chunk_data_start = offset + 8
        chunk_data_end = chunk_data_start + chunk_length

        if chunk_data_end > len(data):
            raise ValueError("GLB chunk extends beyond file")

        if chunk_type == 0x4E4F534A:  # JSON
            json_chunk = json.loads(data[chunk_data_start:chunk_data_end].decode("utf-8"))
        elif chunk_type == 0x004E4942:  # BIN
            bin_start = chunk_data_start
            bin_length = chunk_length

        offset = chunk_data_end

    if json_chunk is None or bin_start is None:
        raise ValueError("GLB must contain JSON and BIN chunks")

    return data, json_chunk, bin_start, bin_length


def read_vec3_accessor(gltf, accessor_index, data, bin_start):
    accessor = gltf["accessors"][accessor_index]
    if accessor.get("type") != "VEC3" or accessor.get("componentType") != 5126:
        raise ValueError(
            f"Accessor {accessor_index} must be FLOAT VEC3; "
            f"got type={accessor.get('type')!r}, "
            f"componentType={accessor.get('componentType')}"
        )

    if "bufferView" not in accessor:
        raise ValueError(f"Accessor {accessor_index} has no bufferView")

    view = gltf["bufferViews"][accessor["bufferView"]]
    if view.get("buffer", 0) != 0:
        raise ValueError("Target accessor is not in GLB buffer 0")

    stride = view.get("byteStride", 12)
    base = (
        bin_start
        + view.get("byteOffset", 0)
        + accessor.get("byteOffset", 0)
    )

    values = []
    for i in range(accessor["count"]):
        offset = base + i * stride
        values.append(list(struct.unpack_from("<3f", data, offset)))

    return values, base, stride


def find_target_node(gltf):
    matches = [
        i for i, node in enumerate(gltf.get("nodes", []))
        if node.get("name") == TARGET_NODE_NAME
    ]
    if len(matches) != 1:
        raise RuntimeError(
            f"Expected exactly one node named {TARGET_NODE_NAME!r}; found {matches}"
        )
    return matches[0]


def process(input_path: Path, output_path: Path):
    original = input_path.read_bytes()
    data, gltf, bin_start, bin_length = load_glb(input_path)

    node_index = find_target_node(gltf)
    animations = gltf.get("animations", [])
    changed = []

    for animation in animations:
        if animation.get("name") not in TARGET_ANIMATIONS:
            continue

        channels = [
            channel
            for channel in animation.get("channels", [])
            if channel.get("target", {}).get("node") == node_index
            and channel.get("target", {}).get("path") == "translation"
        ]

        if len(channels) != 1:
            raise RuntimeError(
                f"{animation.get('name')!r}: expected exactly one translation "
                f"channel for {TARGET_NODE_NAME}; found {len(channels)}"
            )

        sampler = animation["samplers"][channels[0]["sampler"]]
        values, base, stride = read_vec3_accessor(
            gltf, sampler["output"], data, bin_start
        )

        if not values:
            raise RuntimeError(f"{animation.get('name')!r}: empty translation accessor")

        original_z = [v[TARGET_AXIS] for v in values]
        fixed_z = original_z[0]

        for i in range(len(values)):
            struct.pack_into(
                "<f",
                data,
                base + i * stride + TARGET_AXIS * 4,
                fixed_z,
            )

        changed.append({
            "animation": animation.get("name"),
            "accessor": sampler["output"],
            "keyframes": len(values),
            "original_min_z": min(original_z),
            "original_max_z": max(original_z),
            "fixed_z": fixed_z,
        })

    if {item["animation"] for item in changed} != TARGET_ANIMATIONS:
        raise RuntimeError(
            f"Expected {sorted(TARGET_ANIMATIONS)}, "
            f"modified {[item['animation'] for item in changed]}"
        )

    # The important difference from the previous implementation:
    # write the modified bytes back into the ORIGINAL GLB byte stream.
    # We do not reserialize the GLTF structure. This preserves meshes,
    # textures, accessors, JSON, chunk layout, and all unrelated data byte-for-byte.
    output_path.write_bytes(data)

    # Structural verification: JSON and GLB chunk layout remain unchanged.
    output_data, output_gltf, output_bin_start, output_bin_length = load_glb(output_path)
    if len(output_data) != len(original):
        raise RuntimeError("Output GLB size changed unexpectedly")

    # Verify only the intended Z values changed in the binary payload.
    changed_offsets = set()
    for animation in animations:
        if animation.get("name") not in TARGET_ANIMATIONS:
            continue
        channel = next(
            c for c in animation["channels"]
            if c["target"]["node"] == node_index
            and c["target"]["path"] == "translation"
        )
        sampler = animation["samplers"][channel["sampler"]]
        accessor = gltf["accessors"][sampler["output"]]
        view = gltf["bufferViews"][accessor["bufferView"]]
        stride = view.get("byteStride", 12)
        base = output_bin_start + view.get("byteOffset", 0) + accessor.get("byteOffset", 0)
        for i in range(accessor["count"]):
            changed_offsets.add(base + i * stride + TARGET_AXIS * 4)

    differences = [i for i, (a, b) in enumerate(zip(original, output_data)) if a != b]
    if set(differences) != changed_offsets:
        raise RuntimeError(
            "Verification failed: output contains byte changes outside the "
            "intended Walk/Run Hips Z values"
        )

    for animation in output_gltf.get("animations", []):
        if animation.get("name") not in TARGET_ANIMATIONS:
            continue
        channel = next(
            c for c in animation["channels"]
            if c["target"]["node"] == node_index
            and c["target"]["path"] == "translation"
        )
        sampler = animation["samplers"][channel["sampler"]]
        values, _, _ = read_vec3_accessor(
            output_gltf, sampler["output"], output_data, output_bin_start
        )
        z_values = [v[TARGET_AXIS] for v in values]
        if max(z_values) - min(z_values) > 1e-6:
            raise RuntimeError(
                f"Verification failed for {animation.get('name')!r}: "
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
    print("Verification passed: only Walk/Run Hips Z values were changed.")


def main():
    parser = argparse.ArgumentParser(
        description="Remove forward Hips Z root motion from Brawler Walk/Run animations without reserializing the GLB."
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
