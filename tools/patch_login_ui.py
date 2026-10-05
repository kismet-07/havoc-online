import copy
import json
from pathlib import Path

PROJECT = Path('Havoc Online.json')


def uid():
    import uuid
    return str(uuid.uuid4())


def text_object(name, string, size, color, bold=False):
    return {
        'bold': bold,
        'italic': False,
        'name': name,
        'smoothed': True,
        'tags': '',
        'type': 'TextObject::Text',
        'underlined': False,
        'variables': [],
        'behaviors': [],
        'effects': [],
        'string': string,
        'font': '',
        'characterSize': size,
        'color': color,
    }


def sprite_object(name, image):
    return {
        'name': name,
        'tags': '',
        'type': 'Sprite',
        'updateIfNotVisible': False,
        'variables': [],
        'effects': [],
        'behaviors': [],
        'animations': [{
            'name': '',
            'useMultipleDirections': False,
            'directions': [{
                'looping': False,
                'timeBetweenFrames': 0.08,
                'sprites': [{
                    'hasCustomCollisionMask': False,
                    'image': image,
                    'points': [],
                    'originPoint': {'name': 'origine', 'x': 0, 'y': 0},
                    'centerPoint': {'automatic': True, 'name': 'centre', 'x': 0, 'y': 0},
                    'customCollisionMask': [],
                }],
            }],
        }],
    }


def tiled_object(name, texture, width, height):
    return {
        'height': height,
        'name': name,
        'tags': '',
        'texture': texture,
        'tiled': False,
        'type': 'TiledSpriteObject::TiledSprite',
        'width': width,
        'variables': [],
        'behaviors': [],
        'effects': [],
    }


def text_input(name, placeholder, input_type):
    return {
        'name': name,
        'tags': '',
        'type': 'TextInput::TextInputObject',
        'variables': [],
        'effects': [],
        'behaviors': [],
        'content': {
            'initialValue': '',
            'placeholder': placeholder,
            'fontResourceName': '',
            'fontSize': 22,
            'inputType': input_type,
            'textColor': '235;238;245',
            'textAlign': 'left',
            'fillColor': '8;11;18',
            'fillOpacity': 235,
            'borderColor': '105;116;135',
            'borderOpacity': 255,
            'borderWidth': 2,
            'readOnly': False,
            'disabled': False,
            'paddingX': 18,
            'paddingY': 8,
            'spellCheck': False,
        },
    }


def instance(name, x, y, width, height, layer='UI', z=0):
    return {
        'angle': 0,
        'customSize': True,
        'height': height,
        'layer': layer,
        'name': name,
        'persistentUuid': uid(),
        'width': width,
        'x': x,
        'y': y,
        'zOrder': z,
        'numberProperties': [],
        'stringProperties': [],
        'initialVariables': [],
    }


def clone_model_object(original, new_name):
    obj = copy.deepcopy(original)
    obj['name'] = new_name
    obj['persistentUuid'] = uid()
    return obj


def main():
    data = json.loads(PROJECT.read_text(encoding='utf-8'))

    layouts = data.get('layouts', [])
    original = next((x for x in layouts if x.get('name') == 'Untitled scene'), None)
    if original is None:
        raise RuntimeError('Expected current gameplay layout "Untitled scene" was not found.')

    existing = next((x for x in layouts if x.get('name') == 'Login'), None)
    if existing is not None:
        raise RuntimeError('Login layout already exists. Refusing to overwrite it.')

    source_objects = {o.get('name'): o for o in original.get('objects', [])}
    required_models = ['MainChar', 'IronGauntlet']
    missing = [name for name in required_models if name not in source_objects]
    if missing:
        raise RuntimeError(f'Missing required existing 3D object definitions: {missing}')

    login = copy.deepcopy(original)
    login['name'] = 'Login'
    login['mangledName'] = 'Login'
    login['title'] = 'HAVOC ONLINE'
    login['instances'] = []
    login['objects'] = []
    login['events'] = []
    login['variables'] = []
    login['objectsGroups'] = []
    login['persistentUuid'] = uid()

    # Preserve the existing layer/camera configuration. The UI remains on the
    # existing fixed UI layer while the Brawler is rendered on the world layer.
    layers = login.get('layers', [])
    if not layers:
        raise RuntimeError('Expected layer configuration was not found in the existing scene.')

    # Existing 3D character and equipment definitions are reused rather than recreated.
    main_char = clone_model_object(source_objects['MainChar'], 'LoginBrawler')
    right_gauntlet = clone_model_object(source_objects['IronGauntlet'], 'LoginGauntletRight')
    left_gauntlet = clone_model_object(source_objects['IronGauntlet'], 'LoginGauntletLeft')

    floor = source_objects.get('Floor')
    if floor:
        floor_obj = clone_model_object(floor, 'LoginFloor')
        login['objects'].append(floor_obj)
    login['objects'].extend([main_char, right_gauntlet, left_gauntlet])

    # UI object definitions.
    login['objects'].extend([
        sprite_object('LoginBackground', 'havoc_login_background.svg'),
        tiled_object('LoginPanel', 'assets/ui/havoc_login_panel.svg', 500, 560),
        tiled_object('LoginButton', 'assets/ui/havoc_login_button.svg', 440, 76),
        text_input('LoginUsername', 'Username', 'text'),
        text_input('LoginPassword', 'Password', 'password'),
        text_object('HavocLogo', 'HAVOC', 68, {'b': 238, 'g': 238, 'r': 242}, True),
        text_object('OnlineLogo', 'ONLINE', 25, {'b': 125, 'g': 132, 'r': 150}, True),
        text_object('LoginTitle', 'LOGIN', 30, {'b': 245, 'g': 245, 'r': 245}, True),
        text_object('LoginSubtitle', 'Enter the world of HAVOC ONLINE.', 15, {'b': 145, 'g': 151, 'r': 164}),
        text_object('UsernameLabel', 'USERNAME', 13, {'b': 145, 'g': 151, 'r': 164}, True),
        text_object('PasswordLabel', 'PASSWORD', 13, {'b': 145, 'g': 151, 'r': 164}, True),
        text_object('LoginButtonText', 'LOGIN', 24, {'b': 255, 'g': 255, 'r': 255}, True),
        text_object('CreateAccountText', 'CREATE ACCOUNT', 16, {'b': 226, 'g': 231, 'r': 240}, True),
        text_object('ForgotPasswordText', 'Forgot Password?', 14, {'b': 160, 'g': 168, 'r': 184}),
        text_object('ServerStatusText', '●  SERVER ONLINE', 14, {'b': 120, 'g': 230, 'r': 90}, True),
        text_object('VersionText', 'v0.1.0', 13, {'b': 135, 'g': 142, 'r': 156}),
        text_object('LoginStatusText', '', 14, {'b': 225, 'g': 95, 'r': 75}),
    ])

    # World objects. The Brawler is intentionally isolated from gameplay logic.
    login['instances'].extend([
        instance('LoginFloor', -250, -180, 1500, 1100, '', -10),
        instance('LoginBrawler', 270, 335, 360, 620, '', 0),
        instance('LoginGauntletRight', 270, 335, 180, 180, '', 1),
        instance('LoginGauntletLeft', 270, 335, 180, 180, '', 1),
    ])

    # Screen-space UI.
    login['instances'].extend([
        instance('LoginBackground', 0, 0, 1280, 720, 'UI', 0),
        instance('LoginPanel', 740, 95, 500, 560, 'UI', 10),
        instance('HavocLogo', 805, 42, 0, 0, 'UI', 20),
        instance('OnlineLogo', 965, 116, 0, 0, 'UI', 21),
        instance('LoginTitle', 915, 175, 0, 0, 'UI', 22),
        instance('LoginSubtitle', 865, 214, 0, 0, 'UI', 22),
        instance('UsernameLabel', 790, 250, 0, 0, 'UI', 22),
        instance('LoginUsername', 790, 270, 400, 56, 'UI', 23),
        instance('PasswordLabel', 790, 340, 0, 0, 'UI', 22),
        instance('LoginPassword', 790, 360, 400, 56, 'UI', 23),
        instance('ForgotPasswordText', 1030, 425, 0, 0, 'UI', 24),
        instance('LoginButton', 770, 455, 440, 76, 'UI', 23),
        instance('LoginButtonText', 900, 478, 0, 0, 'UI', 24),
        instance('CreateAccountText', 890, 560, 0, 0, 'UI', 24),
        instance('LoginStatusText', 850, 595, 0, 0, 'UI', 24),
        instance('ServerStatusText', 40, 675, 0, 0, 'UI', 24),
        instance('VersionText', 1160, 675, 0, 0, 'UI', 24),
    ])

    # Login-only runtime logic. This deliberately contains no authentication
    # authority. It only handles presentation, camera setup, glow and a UI stub.
    js = r'''const scene = runtimeScene;
const game = scene.getGame();
const input = game.getInputManager();
const world = scene.getLayer('');
const player = scene.getObjects('LoginBrawler')[0] || null;
const right = scene.getObjects('LoginGauntletRight')[0] || null;
const left = scene.getObjects('LoginGauntletLeft')[0] || null;
const loginButton = scene.getObjects('LoginButton')[0] || null;
const status = scene.getObjects('LoginStatusText')[0] || null;

if (!scene.__havocLogin) {
  scene.__havocLogin = { initialized: false, t: 0, rightFx: null, leftFx: null };
}
const state = scene.__havocLogin;
state.t += gdjs.evtTools.runtimeScene.getElapsedTimeInSeconds(scene);

if (!state.initialized && world && player) {
  world.setCameraX(760);
  world.setCameraY(900);
  gdjs.scene3d.camera.setCameraZ(scene, 340, '', 0);
  gdjs.scene3d.camera.turnCameraTowardPosition(scene, 270, 335, 120, '', 0);
  player.setAngle(0);
  state.initialized = true;
}

function findBone(root, names) {
  if (!root || !root.traverse) return null;
  const wanted = names.map(n => n.toLowerCase().replace(/[^a-z0-9]/g, ''));
  let found = null;
  root.traverse(node => {
    if (found || !node || !node.name) return;
    const normalized = node.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (wanted.includes(normalized)) found = node;
  });
  return found;
}

function attachAndGlow(item, boneNames, side) {
  if (!item || !player) return null;
  const pr = player.get3DRendererObject && player.get3DRendererObject();
  const ir = item.get3DRendererObject && item.get3DRendererObject();
  if (!pr || !ir || typeof THREE === 'undefined') return null;
  const bone = findBone(pr, boneNames);
  if (!bone) return null;

  const fxKey = side === 'left' ? 'leftFx' : 'rightFx';
  if (!state[fxKey]) {
    const group = new THREE.Group();
    group.name = 'HavocLoginGauntletFX_' + side;
    const ringMaterial = new THREE.MeshBasicMaterial({
      color: 0xff3218,
      transparent: true,
      opacity: 0.62,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    for (let i = 0; i < 3; i++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(34 + i * 10, 2.4, 10, 48), ringMaterial.clone());
      ring.rotation.x = Math.PI / 2 + i * 0.45;
      ring.rotation.y = i * 0.7;
      group.add(ring);
    }
    const light = new THREE.PointLight(0xff2b12, 7, 260, 2);
    group.add(light);
    ir.add(group);
    state[fxKey] = { group, light, materialNodes: [] };

    ir.traverse(node => {
      if (!node || !node.isMesh || !node.material) return;
      const materials = Array.isArray(node.material) ? node.material : [node.material];
      materials.forEach(material => {
        if (!material || !material.emissive) return;
        material.emissive.setHex(0xff2412);
        material.emissiveIntensity = 2.8;
        state[fxKey].materialNodes.push(material);
      });
    });
  }

  const boneWorld = new THREE.Vector3();
  const boneQuat = new THREE.Quaternion();
  bone.getWorldPosition(boneWorld);
  bone.getWorldQuaternion(boneQuat);
  const invParent = new THREE.Matrix4();
  const parent = ir.parent;
  if (parent) {
    parent.updateWorldMatrix(true, false);
    invParent.copy(parent.matrixWorld).invert();
    boneWorld.applyMatrix4(invParent);
  }
  ir.position.copy(boneWorld);
  ir.quaternion.copy(boneQuat);
  ir.scale.setScalar(1.10);
  ir.position.y += 18;
  ir.rotateX(Math.PI);

  const pulse = 2.8 + Math.sin(state.t * 3.2) * 0.9;
  state[fxKey].light.intensity = 7 + Math.sin(state.t * 4.4) * 2.0;
  state[fxKey].group.rotation.z = state.t * (side === 'left' ? -1.6 : 1.6);
  state[fxKey].group.rotation.y = Math.sin(state.t * 1.7) * 0.4;
  state[fxKey].materialNodes.forEach(m => { m.emissiveIntensity = pulse; });
  state[fxKey].group.children.forEach((child, index) => {
    if (child.isMesh && child.material) {
      child.material.opacity = 0.45 + Math.sin(state.t * 4 + index) * 0.16;
      child.scale.setScalar(1 + Math.sin(state.t * 3 + index) * 0.08);
    }
  });
  return state[fxKey];
}

attachAndGlow(right, ['mixamorigRightHand', 'rightHand'], 'right');
attachAndGlow(left, ['mixamorigLeftHand', 'leftHand'], 'left');

if (loginButton) {
  const hovered = loginButton.cursorOnObject();
  loginButton.setOpacity(hovered ? 255 : 235);
  if (hovered) {
    loginButton.setScale(1.012);
  } else {
    loginButton.setScale(1);
  }
  if (hovered && input.isMouseButtonReleased(0) && status) {
    status.setString('AUTHENTICATION SERVICE NOT CONNECTED');
    status.setColor('225;95;75');
  }
}
'''

    login['events'] = [{
        'type': 'BuiltinCommonInstructions::Standard',
        'conditions': [],
        'actions': [{
            'type': 'BuiltinCommonInstructions::JsCode',
            'inlineCode': js.splitlines(),
            'parameterObjects': '',
            'useStrict': False,
            'eventsSheetExpanded': True,
        }],
        'events': [],
    }]

    data['firstLayout'] = 'Login'

    # Register the new SVG resources once.
    resources = data.setdefault('resources', {}).setdefault('resources', [])
    existing_names = {r.get('name') for r in resources}
    for file_path, name in [
        ('assets/ui/havoc_login_background.svg', 'havoc_login_background.svg'),
        ('assets/ui/havoc_login_panel.svg', 'havoc_login_panel.svg'),
        ('assets/ui/havoc_login_button.svg', 'havoc_login_button.svg'),
    ]:
        if name not in existing_names:
            resources.append({
                'file': file_path,
                'kind': 'image',
                'metadata': '',
                'name': name,
                'smoothed': True,
                'userAdded': True,
            })

    layouts.append(login)
    PROJECT.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


if __name__ == '__main__':
    main()
