from pathlib import Path

PROJECT = Path("Havoc Online.json")
RUN_SCALE = 0.557

OLD_MOVING = '''            "    if (player.getAnimationName() !== animation) player.setAnimationName(animation);",\n'''
NEW_MOVING = '''            "    if (player.getAnimationName() !== animation) player.setAnimationName(animation);",\n            "    player.setAnimationSpeedScale(running ? 0.557 : 1.0);",\n'''
OLD_IDLE = '''            "  } else if (player.getAnimationName() !== 'Idle') {",\n            "    player.setAnimationName('Idle');",\n'''
NEW_IDLE = '''            "  } else if (player.getAnimationName() !== 'Idle') {",\n            "    player.setAnimationName('Idle');",\n            "    player.setAnimationSpeedScale(1.0);",\n'''


def main():
    text = PROJECT.read_text(encoding="utf-8")

    if "setAnimationSpeedScale(running ? 0.557 : 1.0);" in text:
        raise SystemExit("Locomotion polish is already applied; refusing to modify the file again.")

    if text.count(OLD_MOVING) != 1:
        raise SystemExit(f"Expected exactly 1 moving-animation target, found {text.count(OLD_MOVING)}.")

    if text.count(OLD_IDLE) != 1:
        raise SystemExit(f"Expected exactly 1 idle-animation target, found {text.count(OLD_IDLE)}.")

    patched = text.replace(OLD_MOVING, NEW_MOVING).replace(OLD_IDLE, NEW_IDLE)
    PROJECT.write_text(patched, encoding="utf-8", newline="")

    # Verify only the intended additions occurred.
    if patched.count("setAnimationSpeedScale(running ? 0.557 : 1.0);") != 1:
        raise SystemExit("Verification failed: unexpected run/walk playback-scale count.")
    if patched.count("setAnimationSpeedScale(1.0);") != 1:
        raise SystemExit("Verification failed: unexpected idle playback-scale count.")

    print("Applied locomotion polish.")
    print("Run animation scale : 0.557")
    print("Walk animation scale: 1.000")
    print("Idle animation scale: 1.000")
    print("The patch preserves the existing camera, movement, and GLB code.")


if __name__ == "__main__":
    main()
