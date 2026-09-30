from __future__ import annotations

import json
from pathlib import Path

PROJECT = Path("Havoc Online.json")
MODEL = Path("bb_gauntlet.glb")
OLD_PATH = "assets/equipment/brawler/basic_iron_gauntlet.glb"
OLD_NAME = "basic_iron_gauntlet.glb"
NEW_NAME = "bb_gauntlet.glb"


def main() -> None:
    if not PROJECT.is_file():
        raise SystemExit(f"Missing project file: {PROJECT}")
    if not MODEL.is_file():
        raise SystemExit(f"Missing replacement model: {MODEL}")

    with PROJECT.open("r", encoding="utf-8-sig") as handle:
        data = json.load(handle)

    resource_changes = 0
    object_changes = 0

    resources = data.get("resources", [])
    for resource in resources:
        if not isinstance(resource, dict):
            continue
        if resource.get("kind") != "model3D":
            continue
        if resource.get("file") in {OLD_PATH, OLD_NAME}:
            resource["file"] = NEW_NAME
            resource["name"] = NEW_NAME
            resource_changes += 1

    def walk(value):
        nonlocal object_changes
        if isinstance(value, dict):
            content = value.get("content")
            if (
                isinstance(value, dict)
                and value.get("type") == "Scene3D::Model3DObject"
                and isinstance(content, dict)
                and content.get("modelResourceName") in {OLD_NAME, OLD_PATH}
            ):
                content["modelResourceName"] = NEW_NAME
                object_changes += 1
            for child in value.values():
                walk(child)
        elif isinstance(value, list):
            for child in value:
                walk(child)

    walk(data)

    if resource_changes != 1:
        raise SystemExit(
            f"Expected exactly one Brawler Model3D resource replacement; found {resource_changes}."
        )
    if object_changes != 1:
        raise SystemExit(
            f"Expected exactly one IronGauntlet Model3D object replacement; found {object_changes}."
        )

    backup = PROJECT.with_name(PROJECT.name + ".before-gauntlet-resource-fix.bak")
    if not backup.exists():
        backup.write_bytes(PROJECT.read_bytes())

    with PROJECT.open("w", encoding="utf-8", newline="\n") as handle:
        json.dump(data, handle, indent=2, ensure_ascii=False)
        handle.write("\n")

    print("Brawler gauntlet resource fix applied.")
    print(f"Model resource: {NEW_NAME}")
    print(f"Resource registrations changed: {resource_changes}")
    print(f"Model3D object references changed: {object_changes}")
    print(f"Backup: {backup.name}")


if __name__ == "__main__":
    main()
