from __future__ import annotations

import struct
from pathlib import Path

from pygltflib import GLTF2

ROOT = Path(__file__).resolve().parents[1]
GLB = ROOT / 'killer_clown.glb'
TARGET_ANIMATIONS = {'Idle_Sword', 'Walk_Large', 'Run_Stealth'}
TARGET_NODE_HINTS = (
    'root', 'pelvis', 'hips', 'hip',
    'leftfoot', 'left foot', 'lefttoe', 'left toe',
    'rightfoot', 'right foot', 'righttoe', 'right toe',
    'ankle', 'foot', 'toe',
)


def accessor_values(gltf: GLTF2, accessor_index: int):
    accessor = gltf.accessors[accessor_index]
    if accessor.bufferView is None:
        return []
    view = gltf.bufferViews[accessor.bufferView]
    blob = gltf.binary_blob()
    base = (view.byteOffset or 0) + (accessor.byteOffset or 0)

    component_sizes = {
        5126: 4,  # FLOAT
        5125: 4,  # UNSIGNED_INT
        5123: 2,  # UNSIGNED_SHORT
        5121: 1,  # UNSIGNED_BYTE
    }
    component_counts = {
        'SCALAR': 1,
        'VEC2': 2,
        'VEC3': 3,
        'VEC4': 4,
    }
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


def node_label(node):
    return (node.name or '').strip()


def is_relevant_node(name: str) -> bool:
    lowered = name.lower().replace('_', '').replace('-', '')
    return any(hint.replace(' ', '').lower() in lowered for hint in TARGET_NODE_HINTS)


def print_translation_report(gltf: GLTF2, animation):
    relevant = []
    for channel in animation.channels:
        node_index = channel.target.node
        if node_index is None or channel.target.path != 'translation':
            continue
        name = node_label(gltf.nodes[node_index])
        if is_relevant_node(name):
            relevant.append((node_index, name, channel))

    if not relevant:
        print('  No root/pelvis/foot/toe translation channels found.')
        return

    # Stable anatomical/root order makes comparisons between animations easier.
    order = ('root', 'pelvis', 'hip', 'leftfoot', 'lefttoe', 'rightfoot', 'righttoe', 'foot', 'toe')
    relevant.sort(key=lambda item: (next((i for i, token in enumerate(order) if token in item[1].lower().replace('_', '').replace('-', '')), 99), item[0]))

    for node_index, name, channel in relevant:
        sampler = animation.samplers[channel.sampler]
        values = accessor_values(gltf, sampler.output)
        if not values:
            continue
        ranges = [
            (min(v[axis] for v in values), max(v[axis] for v in values))
            for axis in range(3)
        ]
        first = values[0]
        last = values[-1]
        delta = tuple(last[i] - first[i] for i in range(3))
        print(f'  {node_index}: {name} translation: keyframes={len(values)}')
        print(f'    X: {ranges[0][0]:.9f} -> {ranges[0][1]:.9f}  delta={delta[0]:+.9f}')
        print(f'    Y: {ranges[1][0]:.9f} -> {ranges[1][1]:.9f}  delta={delta[1]:+.9f}')
        print(f'    Z: {ranges[2][0]:.9f} -> {ranges[2][1]:.9f}  delta={delta[2]:+.9f}')


def main() -> None:
    gltf = GLTF2().load(GLB)

    candidate_nodes = {
        i: node_label(node)
        for i, node in enumerate(gltf.nodes)
        if is_relevant_node(node_label(node))
    }

    print('=' * 72)
    print('KILLER_CLOWN.GLB — ROOT / FOOT MOTION INSPECTION')
    print('=' * 72)
    print('Candidate nodes:')
    for index, name in candidate_nodes.items():
        print(f'  {index}: {name}')

    for animation in gltf.animations or []:
        if animation.name not in TARGET_ANIMATIONS:
            continue
        print('\nANIMATION:', animation.name)
        print_translation_report(gltf, animation)

    print('\nInterpretation:')
    print('  - Root translation is the strongest indicator of baked locomotion.')
    print('  - Pelvis translation alone is NOT proof of root motion; idle body sway can be intentional.')
    print('  - Foot/toe translation helps determine whether the visible idle slide is actually baked into the animation.')
    print('  - Do not modify the GLB until the foot/toe results confirm the source of the slide.')
    print('=' * 72)


if __name__ == '__main__':
    main()
