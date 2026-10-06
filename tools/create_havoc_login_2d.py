import json
from pathlib import Path
from uuid import uuid4

PROJECT = Path("Havoc Online.json")
BRANCH_LAYOUT_NAME = "Login"


def uid():
    return str(uuid4())


def text_object(name, value, size, color, bold=False):
    return {
        "bold": bold,
        "italic": False,
        "name": name,
        "smoothed": True,
        "tags": "",
        "type": "TextObject::Text",
        "underlined": False,
        "variables": [],
        "behaviors": [],
        "effects": [],
        "string": value,
        "font": "",
        "characterSize": size,
        "color": color,
    }


def sprite_object(name, image):
    return {
        "name": name,
        "tags": "",
        "type": "Sprite",
        "updateIfNotVisible": False,
        "variables": [],
        "effects": [],
        "behaviors": [],
        "animations": [{
            "name": "",
            "useMultipleDirections": False,
            "directions": [{
                "looping": False,
                "timeBetweenFrames": 0.08,
                "sprites": [{
                    "hasCustomCollisionMask": False,
                    "image": image,
                    "points": [],
                    "originPoint": {"name": "origine", "x": 0, "y": 0},
                    "centerPoint": {"automatic": True, "name": "centre", "x": 0, "y": 0},
                    "customCollisionMask": []
                }]
            }]
        }]
    }


def text_input_object(name, placeholder, input_type="text"):
    return {
        "name": name,
        "tags": "",
        "type": "TextInput::TextInputObject",
        "variables": [],
        "effects": [],
        "behaviors": [],
        "content": {
            "initialValue": "",
            "placeholder": placeholder,
            "fontResourceName": "",
            "fontSize": 20,
            "inputType": input_type,
            "textColor": "235;238;245",
            "textAlign": "left",
            "fillColor": "8;11;18",
            "fillOpacity": 245,
            "borderColor": "63;160;183",
            "borderOpacity": 255,
            "borderWidth": 2,
            "readOnly": False,
            "disabled": False,
            "paddingX": 16,
            "paddingY": 8,
            "spellCheck": False
        }
    }


def instance(name, x, y, width=None, height=None, z=0, layer="UI"):
    out = {
        "angle": 0,
        "customSize": width is not None or height is not None,
        "height": height if height is not None else 0,
        "layer": layer,
        "name": name,
        "persistentUuid": uid(),
        "width": width if width is not None else 0,
        "x": x,
        "y": y,
        "zOrder": z,
        "numberProperties": [],
        "stringProperties": [],
        "initialVariables": []
    }
    return out


def add_resource(data, file_path, name):
    resources = data.setdefault("resources", {}).setdefault("resources", [])
    if not any(r.get("file") == file_path for r in resources):
        resources.append({
            "file": file_path,
            "kind": "image",
            "metadata": "",
            "name": name,
            "smoothed": True,
            "userAdded": True
        })


def main():
    data = json.loads(PROJECT.read_text(encoding="utf-8"))

    if any(layout.get("name") == BRANCH_LAYOUT_NAME for layout in data.get("layouts", [])):
        raise RuntimeError("Login layout already exists. Refusing to overwrite it.")

    add_resource(data, "assets/ui/havoc_login_2d_background.svg", "havoc_login_2d_background.svg")
    add_resource(data, "assets/ui/havoc_login_2d_panel.svg", "havoc_login_2d_panel.svg")
    add_resource(data, "assets/ui/havoc_login_2d_button.svg", "havoc_login_2d_button.svg")

    objects = [
        sprite_object("LoginBackground", "assets/ui/havoc_login_2d_background.svg"),
        sprite_object("LoginPanel", "assets/ui/havoc_login_2d_panel.svg"),
        sprite_object("LoginButton", "assets/ui/havoc_login_2d_button.svg"),
        text_object("LoginTitle", "HAVOC", 52, "235;248;255", True),
        text_object("LoginSubtitle", "ONLINE", 18, "99;220;240", True),
        text_object("UsernameLabel", "USERNAME", 15, "132;196;211", True),
        text_object("PasswordLabel", "PASSWORD", 15, "132;196;211", True),
        text_input_object("LoginUsername", "Username"),
        text_input_object("LoginPassword", "Password", "password"),
        text_object("LoginButtonText", "LOGIN", 23, "225;251;255", True),
        text_object("ForgotPasswordText", "FORGOT PASSWORD", 14, "122;202;218"),
        text_object("CreateAccountText", "CREATE ACCOUNT", 14, "122;202;218"),
        text_object("LoginStatusText", "●  SERVER ONLINE", 14, "91;229;143", True),
        text_object("VersionText", "v0.1.0", 12, "110;130;145")
    ]

    instances = [
        instance("LoginBackground", 0, 0, 1280, 720, 0),
        instance("LoginPanel", 720, 80, 520, 560, 10),
        instance("LoginTitle", 790, 118, z=20),
        instance("LoginSubtitle", 793, 178, z=20),
        instance("UsernameLabel", 780, 235, z=20),
        instance("LoginUsername", 780, 260, 440, 58, 21),
        instance("PasswordLabel", 780, 340, z=20),
        instance("LoginPassword", 780, 365, 440, 58, 21),
        instance("LoginButton", 780, 455, 440, 70, 22),
        instance("LoginButtonText", 928, 478, z=23),
        instance("ForgotPasswordText", 780, 555, z=23),
        instance("CreateAccountText", 1050, 555, z=23),
        instance("LoginStatusText", 780, 610, z=23),
        instance("VersionText", 1170, 675, z=23)
    ]

    login = {
        "b": 12,
        "disableInputWhenNotFocused": True,
        "mangledName": "Login",
        "name": "Login",
        "r": 14,
        "standardSortMethod": True,
        "stopSoundsOnStartup": True,
        "title": "HAVOC ONLINE",
        "v": 18,
        "uiSettings": {
            "grid": True,
            "gridType": "rectangular",
            "gridWidth": 32,
            "gridHeight": 32,
            "gridDepth": 32,
            "gridOffsetX": 0,
            "gridOffsetY": 0,
            "gridColor": 10401023,
            "gridAlpha": 0.8,
            "snap": True,
            "zoomFactor": 0.75,
            "windowMask": True,
            "selectedLayer": "UI",
            "gameEditorMode": "2d"
        },
        "objectsGroups": [],
        "variables": [],
        "instances": instances,
        "objects": objects,
        "events": [],
        "layers": [{
            "ambientLightColorB": 200,
            "ambientLightColorG": 200,
            "ambientLightColorR": 200,
            "camera2DPlaneMaxDrawingDistance": 5000,
            "camera3DFarPlaneDistance": 10000,
            "camera3DFieldOfView": 45,
            "camera3DNearPlaneDistance": 3,
            "cameraType": "",
            "followBaseLayerCamera": False,
            "isLightingLayer": False,
            "isLocked": False,
            "name": "",
            "renderingType": "",
            "visibility": True,
            "cameras": [{
                "defaultSize": True,
                "defaultViewport": True,
                "height": 0,
                "viewportBottom": 1,
                "viewportLeft": 0,
                "viewportRight": 1,
                "viewportTop": 0,
                "width": 0
            }],
            "effects": []
        }, {
            "ambientLightColorB": 200,
            "ambientLightColorG": 200,
            "ambientLightColorR": 200,
            "camera2DPlaneMaxDrawingDistance": 5000,
            "camera3DFarPlaneDistance": 10000,
            "camera3DFieldOfView": 45,
            "camera3DNearPlaneDistance": 3,
            "cameraType": "",
            "followBaseLayerCamera": True,
            "isLightingLayer": False,
            "isLocked": False,
            "name": "UI",
            "renderingType": "",
            "visibility": True,
            "cameras": [{
                "defaultSize": True,
                "defaultViewport": True,
                "height": 0,
                "viewportBottom": 1,
                "viewportLeft": 0,
                "viewportRight": 1,
                "viewportTop": 0,
                "width": 0
            }],
            "effects": []
        }],
        "behaviorsSharedData": [
            {"name": "Animation", "type": "AnimatableCapability::AnimatableBehavior"},
            {"name": "Effect", "type": "EffectCapability::EffectBehavior"},
            {"name": "Flippable", "type": "FlippableCapability::FlippableBehavior"},
            {"name": "Opacity", "type": "OpacityCapability::OpacityBehavior"},
            {"name": "Resizable", "type": "ResizableCapability::ResizableBehavior"},
            {"name": "Scale", "type": "ScalableCapability::ScalableBehavior"},
            {"name": "Text", "type": "TextContainerCapability::TextContainerBehavior"}
        ],
        "objectsFolderStructure": {
            "folderName": "__ROOT",
            "children": [{"objectName": o["name"]} for o in objects]
        }
    }

    data["layouts"].append(login)
    data["firstLayout"] = "Login"
    PROJECT.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    # Re-read as a final syntax check.
    json.loads(PROJECT.read_text(encoding="utf-8"))
    print("2D HAVOC Login layout created.")
    print("firstLayout:", data["firstLayout"])
    print("objects:", len(objects))


if __name__ == "__main__":
    main()
