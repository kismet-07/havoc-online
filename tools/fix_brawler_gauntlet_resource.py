from __future__ import annotations

from pathlib import Path

PROJECT = Path("Havoc Online.json")
MODEL = Path("bb_gauntlet.glb")
OLD_RESOURCE_PATH = '"file": "assets/equipment/brawler/basic_iron_gauntlet.glb"'
OLD_RESOURCE_NAME = '"name": "basic_iron_gauntlet.glb"'
OLD_MODEL_RESOURCE = '"modelResourceName": "basic_iron_gauntlet.glb"'
NEW_RESOURCE_PATH = '"file": "bb_gauntlet.glb"'
NEW_RESOURCE_NAME = '"name": "bb_gauntlet.glb"'
NEW_MODEL_RESOURCE = '"modelResourceName": "bb_gauntlet.glb"'


def replace_exact(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"Expected exactly one {label}; found {count}.")
    return text.replace(old, new, 1)


def main() -> None:
    if not PROJECT.is_file():
        raise SystemExit(f"Missing project file: {PROJECT}")
    if not MODEL.is_file():
        raise SystemExit(f"Missing replacement model: {MODEL}")

    text = PROJECT.read_text(encoding="utf-8-sig")

    # Change only the existing GDevelop Model3D resource registration.
    text = replace_exact(
        text,
        OLD_RESOURCE_PATH,
        NEW_RESOURCE_PATH,
        "old Brawler Model3D resource path",
    )
    text = replace_exact(
        text,
        OLD_RESOURCE_NAME,
        NEW_RESOURCE_NAME,
        "old Brawler Model3D resource name",
    )
    text = replace_exact(
        text,
        OLD_MODEL_RESOURCE,
        NEW_MODEL_RESOURCE,
        "old IronGauntlet modelResourceName",
    )

    backup = PROJECT.with_name(PROJECT.name + ".before-gauntlet-resource-fix.bak")
    if not backup.exists():
        backup.write_bytes(PROJECT.read_bytes())

    PROJECT.write_text(text, encoding="utf-8", newline="\n")

    print("Brawler gauntlet resource fix applied.")
    print(f"Model resource: {MODEL.name}")
    print("Updated exactly one Model3D resource registration.")
    print("Updated exactly one IronGauntlet modelResourceName.")
    print("Existing GDevelop project formatting was preserved.")
    print(f"Backup: {backup.name}")


if __name__ == "__main__":
    main()
