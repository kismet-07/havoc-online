from pathlib import Path

PROJECT = Path('Havoc Online.json')
OLD_PATH = 'assets/equipment/brawler/basic_iron_gauntlet.glb'
NEW_PATH = 'bb_gauntlet.glb'
OLD_NAME = '"name": "basic_iron_gauntlet.glb"'
NEW_NAME = '"name": "bb_gauntlet.glb"'
OLD_MODEL = '"modelResourceName": "basic_iron_gauntlet.glb"'
NEW_MODEL = '"modelResourceName": "bb_gauntlet.glb"'

text = PROJECT.read_text(encoding='utf-8')

checks = [
    (OLD_PATH, NEW_PATH, 1, 'resource path'),
    (OLD_NAME, NEW_NAME, 1, 'resource name'),
    (OLD_MODEL, NEW_MODEL, 1, 'IronGauntlet model resource'),
]

for old, new, expected, label in checks:
    count = text.count(old)
    if count != expected:
        raise RuntimeError(f'{label}: expected {expected} occurrence, found {count}')
    text = text.replace(old, new)

PROJECT.write_text(text, encoding='utf-8', newline='')
print('Brawler gauntlet model replacement applied.')
print('Changed only the existing GDevelop Model3D resource references.')
print('No scene instances, attachment runtime, bone logic, transforms, or combat code were modified.')
