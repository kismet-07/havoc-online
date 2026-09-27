from __future__ import annotations

import struct
from pathlib import Path

from pygltflib import GLTF2

ROOT = Path(__file__).resolve().parents[1]
GLB = ROOT / 'killer_clown.glb'
TARGET_ANIMATIONS = {'Idle_Sword', 'Walk_Large', 'Run_Stealth'}

def accessor_values(gltf: GLTF2, accessor_index: int):
    accessor = gltf.accessors[accessor_index]
    if accessor.bufferView is None:
        return []
    view = gltf.bufferViews[accessor.bufferView]
    blob = gltf.binary_blob()
    base = (view.byteOffset or 0) + (accessor.byteOffset or 0)

    component_sizes = {5126: 4, 5125: 4, 5123: 2, 5121: 1}
    component_counts = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}
    count = component_counts.get(accessor.type)
    component_size = component_sizes.get(accessor.componentType)
    if count is None or component_size is None:
        return []

    stride = view.byteStride or count * component_size
    fmt = {
        (5126, 1): '<f',
        (5126, 2): '<ff',
        (5126, 3): '<fff',
        (5126, 4): '<ffff',
    }.get((accessor.componentType, count))
    if fmt is None:
        return []

    values = []
    for i in range(accessor.count):
        offset = base + i * stride
        values.append(struct.unpack_from(fmt, blob, offset))
    return values

def norm(name: str) -> str:
    return ''.join(ch.lower() for ch in name if ch.isalnum())

def is_relevant(name: str) -> bool:
    n = norm(name)
    return (
        n == 'root' or
        n == 'pelvis' or
        'foot' in n or
        'toe' in n or
        'ankle' in n or
        'hip' in n
    )

def print_animation(gltf: GLTF2, animation):
    print(f"\nANIMATION: {animation.name}")
    channel_map = {}
    for channel in animation.channels:
        node_index = channel.target.node
        if node_index is None:
            continue
        name = gltf.nodes[node_index].name or f"node_{node_index}"
        if is_relevant(name):
            channel_map.setdefault(node_index, []).append(channel)

    if not channel_map:
        print("  No relevant nodes have animation channels.")
        return

    for node_index in sorted(channel_map):
        name = gltf.nodes[node_index].name or f"node_{node_index}"
        paths = sorted({c.target.path for c in channel_map[node_index]})
        print(f"  {node_index}: {name} — channels={', '.join(paths)}")

        for channel in channel_map[node_index]:
            if channel.target.path != 'translation':
                continue
            sampler = animation.samplers[channel.sampler]
            values = accessor_values(gltf, sampler.output)
            if not values:
                print("    translation: unable to decode")
                continue
            first = values[0]
            last = values[-1]
            delta = tuple(last[i] - first[i] for i in range(3))
            ranges = [
                (min(v[i] for v in values), max(v[i] for v in values))
                for i in range(3)
            ]
            print(f"    translation keyframes={len(values)}")
            print(f"      X range {ranges[0][0]:.9f} -> {ranges[0][1]:.9f}, delta={delta[0]:+.9f}")
            print(f"      Y range {ranges[1][0]:.9f} -> {ranges[1][1]:.9f}, delta={delta[1]:+.9f}")
            print(f"      Z range {ranges[2][0]:.9f} -> {ranges[2][1]:.9f}, delta={delta[2]:+.9f}")

def main():
    gltf = GLTF2().load(GLB)
    print('=' * 72)
    print('KILLER_CLOWN.GLB — FULL RELEVANT NODE MOTION INSPECTION')
    print('=' * 72)

    candidate_nodes = [
        (i, gltf.nodes[i].name or f'node_{i}')
        for i in range(len(gltf.nodes))
        if is_relevant(gltf.nodes[i].name or '')
    ]
    print(f'Candidate nodes: {len(candidate_nodes)}')
    for i, name in candidate_nodes:
        print(f'  {i}: {name}')

    for animation in gltf.animations or []:
        if animation.name in TARGET_ANIMATIONS:
            print_animation(gltf, animation)

    print('\nNON-ROOT NODE TRANSLATION CHANNELS')
    print('-' * 72)
    found = False
    for animation in gltf.animations or []:
        if animation.name != 'Idle_Sword':
            continue
        for channel in animation.channels:
            if channel.target.path != 'translation' or channel.target.node is None:
                continue
            name = gltf.nodes[channel.target.node].name or f'node_{channel.target.node}'
            if norm(name) == 'root':
                continue
            sampler = animation.samplers[channel.sampler]
            values = accessor_values(gltf, sampler.output)
            if not values:
                continue
            found = True
            first = values[0]
            last = values[-1]
            delta = tuple(last[i] - first[i] for i in range(3))
            print(f'{channel.target.node}: {name} delta=({delta[0]:+.9f}, {delta[1]:+.9f}, {delta[2]:+.9f})')
    if not found:
        print('No non-root translation channels found for Idle_Sword.')

if __name__ == '__main__':
    main()
