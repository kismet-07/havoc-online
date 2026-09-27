from __future__ import annotations

import struct
from pathlib import Path

from pygltflib import GLTF2

ROOT = Path(__file__).resolve().parents[1]
GLB = ROOT / 'killer_clown.glb'
TARGET_ANIMATIONS = {'Idle_Sword', 'Walk_Large', 'Run_Stealth'}
TARGET_NODE_HINTS = ('root', 'pelvis', 'hips', 'hip')


def accessor_values(gltf: GLTF2, accessor_index: int):
    accessor = gltf.accessors[accessor_index]
    if accessor.bufferView is None:
        return []
    view = gltf.bufferViews[accessor.bufferView]
    blob = gltf.binary_blob()
    base = (view.byteOffset or 0) + (accessor.byteOffset or 0)
    stride = view.byteStride or 12
    values = []
    for i in range(accessor.count):
        offset = base + i * stride
        if accessor.type == 'VEC3':
            values.append(struct.unpack_from('<fff', blob, offset))
        elif accessor.type == 'VEC4':
            values.append(struct.unpack_from('<ffff', blob, offset))
    return values


def main() -> None:
    gltf = GLTF2().load(GLB)
    nodes = {
        i: (node.name or '')
        for i, node in enumerate(gltf.nodes)
        if any(hint in (node.name or '').lower() for hint in TARGET_NODE_HINTS)
    }

    print('=' * 72)
    print('KILLER_CLOWN.GLB — ROOT MOTION INSPECTION')
    print('=' * 72)
    print('Candidate nodes:')
    for index, name in nodes.items():
        print(f'  {index}: {name}')

    for animation in gltf.animations or []:
        if animation.name not in TARGET_ANIMATIONS:
            continue
        print('\nANIMATION:', animation.name)
        found = False
        for channel in animation.channels:
            node_index = channel.target.node
            if node_index not in nodes or channel.target.path != 'translation':
                continue
            found = True
            sampler = animation.samplers[channel.sampler]
            values = accessor_values(gltf, sampler.output)
            if not values:
                continue
            ranges = [
                (min(v[axis] for v in values), max(v[axis] for v in values))
                for axis in range(3)
            ]
            print(f'  {nodes[node_index]} translation: keyframes={len(values)}')
            print(f'    X: {ranges[0][0]:.9f} -> {ranges[0][1]:.9f}')
            print(f'    Y: {ranges[1][0]:.9f} -> {ranges[1][1]:.9f}')
            print(f'    Z: {ranges[2][0]:.9f} -> {ranges[2][1]:.9f}')
        if not found:
            print('  No candidate-node translation channel found.')

    print('\nIf Idle_Sword has meaningful root/pelvis translation, the idle slide is')
    print('inside the GLB animation and cannot be eliminated by object setPosition().')
    print('=' * 72)


if __name__ == '__main__':
    main()
