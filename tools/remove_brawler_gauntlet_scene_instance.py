from __future__ import annotations

import json
from pathlib import Path

PROJECT = Path("Havoc Online.json")
GAUNTLET_INSTANCE_UUID = "8b6a0e49-9f45-4d50-a2f8-3f4e7d6c1a20"


def main() -> None:
    if not PROJECT.is_file():
        raise SystemExit(f"Missing project file: {PROJECT}")

    original = PROJECT.read_text(encoding="utf-8-sig")
    project = json.loads(original)

    removed = 0
    for layout in project.get("layouts", []):
        instances = layout.get("instances", [])
        kept = []
        for instance in instances:
            if instance.get("persistentUuid") == GAUNTLET_INSTANCE_UUID:
                removed += 1
            else:
                kept.append(instance)
        layout["instances"] = kept

    if removed != 1:
        raise SystemExit(
            f"Expected exactly one temporary IronGauntlet scene instance; found {removed}."
        )

    # Keep the replacement as the existing Model3D resource/object definition.
    resources = project.get("resources", {}).get("resources", [])
    matches = [r for r in resources if r.get("kind") == "model3D" and r.get("name") == "bb_gauntlet.glb"]
    if len(matches) != 1:
        raise SystemExit(f"Expected exactly one bb_gauntlet.glb resource; found {len(matches)}.")

    object_matches = []
    for layout in project.get("layouts", []):
        for obj in layout.get("objects", []):
            if obj.get("name") == "IronGauntlet":
                object_matches.append(obj)

    if len(object_matches) != 1:
        raise SystemExit(f"Expected exactly one IronGauntlet object definition; found {len(object_matches)}.")

    model_name = object_matches[0].get("content", {}).get("modelResourceName")
    if model_name != "bb_gauntlet.glb":
        raise SystemExit(f"IronGauntlet modelResourceName is {model_name!r}, not bb_gauntlet.glb.")

    backup = PROJECT.with_name(PROJECT.name + ".before-remove-gauntlet-scene-instance.bak")
    if not backup.exists():
        backup.write_bytes(PROJECT.read_bytes())

    PROJECT.write_text(json.dumps(project, indent=2) + "\n", encoding="utf-8", newline="\n")

    print("Temporary Brawler gauntlet scene instance removed.")
    print("The existing IronGauntlet object definition remains registered with bb_gauntlet.glb.")
    print("Runtime bone attachment remains responsible for creating and positioning the equipment.")
    print(f"Backup: {backup.name}")


if __name__ == "__main__":
    main()
