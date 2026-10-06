import json
from pathlib import Path

PROJECT = Path('Havoc Online.json')


def instance(layout, name):
    for item in layout.get('instances', []):
        if item.get('name') == name:
            return item
    return None


def object_def(layout, name):
    for item in layout.get('objects', []):
        if item.get('name') == name:
            return item
    return None


def set_text(layout, name, text, size=None, color=None, bold=None):
    obj = object_def(layout, name)
    if not obj:
        return
    if 'string' in obj:
        obj['string'] = text
    content = obj.get('content')
    if isinstance(content, dict):
        if 'text' in content:
            content['text'] = text
        if size is not None and 'characterSize' in content:
            content['characterSize'] = size
        if color is not None and 'color' in content:
            content['color'] = color
    if size is not None and 'characterSize' in obj:
        obj['characterSize'] = size
    if color is not None and 'color' in obj:
        obj['color'] = color
    if bold is not None and 'bold' in obj:
        obj['bold'] = bold


def set_instance(layout, name, *, x=None, y=None, z=None, width=None, height=None, depth=None, layer=None, z_order=None):
    item = instance(layout, name)
    if not item:
        return
    if x is not None:
        item['x'] = x
    if y is not None:
        item['y'] = y
    if z is not None:
        item['z'] = z
    if width is not None:
        item['width'] = width
        item['customSize'] = True
    if height is not None:
        item['height'] = height
        item['customSize'] = True
    if depth is not None:
        item['depth'] = depth
        item['customSize'] = True
    if layer is not None:
        item['layer'] = layer
    if z_order is not None:
        item['zOrder'] = z_order


def add_resource(data, file_path, kind, name):
    resources = data.setdefault('resources', {}).setdefault('resources', [])
    if any(r.get('file') == file_path for r in resources):
        return
    resources.append({
        'file': file_path,
        'kind': kind,
        'metadata': '',
        'name': name,
        'smoothed': True,
        'userAdded': True,
    })


def replace_texture(layout, object_name, texture):
    obj = object_def(layout, object_name)
    if not obj:
        raise RuntimeError(f"Object '{object_name}' is missing from Login layout.")

    changed = False

    if 'texture' in obj:
        obj['texture'] = texture
        changed = True

    content = obj.get('content')
    if isinstance(content, dict):
        for key in ('texture', 'textureResourceName', 'resourceName'):
            if key in content:
                content[key] = texture
                changed = True

    # GDevelop Sprite objects store their image inside:
    # animations -> directions -> sprites -> image.
    animations = obj.get('animations')
    if isinstance(animations, list):
        for animation in animations:
            for direction in animation.get('directions', []):
                for sprite in direction.get('sprites', []):
                    if 'image' in sprite:
                        sprite['image'] = texture
                        changed = True

    if not changed:
        raise RuntimeError(
            f"Object '{object_name}' does not expose a recognized texture/image field."
        )


def main():
    raw = PROJECT.read_text(encoding='utf-8')
    decoder = json.JSONDecoder()
    data, end = decoder.raw_decode(raw.lstrip('\ufeff'))
    if raw[end:].strip():
        raise RuntimeError('Project contains trailing data after the JSON document.')

    layouts = data.get('layouts', [])
    login = next((l for l in layouts if l.get('name') == 'Login'), None)
    if login is None:
        raise RuntimeError('Login layout is missing.')

    add_resource(data, 'assets/ui/havoc_login_background_v2.svg', 'image', 'havoc_login_background_v2.svg')
    add_resource(data, 'assets/ui/havoc_login_panel_v2.svg', 'image', 'havoc_login_panel_v2.svg')
    add_resource(data, 'assets/ui/havoc_login_button_v2.svg', 'image', 'havoc_login_button_v2.svg')

    replace_texture(login, 'LoginBackground', 'assets/ui/havoc_login_background_v2.svg')
    replace_texture(login, 'LoginPanel', 'assets/ui/havoc_login_panel_v2.svg')
    replace_texture(login, 'LoginButton', 'assets/ui/havoc_login_button_v2.svg')

    # Remove the broken/obsolete event actions and replace them with one valid
    # built-in JavaScript event. This keeps the login scene self-contained and
    # avoids dependencies on missing extension actions.
    login['events'] = [{
        'type': 'BuiltinCommonInstructions::JsCode',
        'inlineCode': [
            "const scene = runtimeScene;",
            "const layer = scene.getLayer('');",
            "const player = scene.getObjects('LoginBrawler')[0] || null;",
            "const right = scene.getObjects('LoginGauntletRight')[0] || null;",
            "const left = scene.getObjects('LoginGauntletLeft')[0] || null;",
            "if (!scene.__havocLoginV2) scene.__havocLoginV2 = { initialized: false, rightBone: null, leftBone: null, rightFx: null, leftFx: null, t: 0 };",
            "const state = scene.__havocLoginV2;",
            "state.t += gdjs.evtTools.runtimeScene.getElapsedTimeInSeconds(scene);",
            "if (player) {",
            "  if (typeof player.setAnimationName === 'function' && player.getAnimationName() !== 'Brawler_Idle') player.setAnimationName('Brawler_Idle');",
            "  if (typeof player.setAnimationSpeedScale === 'function') player.setAnimationSpeedScale(1);",
            "  const root = typeof player.get3DRendererObject === 'function' ? player.get3DRendererObject() : null;",
            "  if (root && !state.initialized) {",
            "    root.rotation.x = -Math.PI / 2;",
            "    root.rotation.y = 0;",
            "    root.rotation.z = 0;",
            "    root.scale.set(1.15, 1.15, 1.15);",
            "  }",
            "  if (layer) {",
            "    layer.setCameraX(340);",
            "    layer.setCameraY(1030);",
            "    gdjs.scene3d.camera.setCameraZ(scene, 245, '', 0);",
            "    gdjs.scene3d.camera.turnCameraTowardPosition(scene, 340, 420, 125, '', 0);",
            "  }",
            "  if (root && typeof root.traverse === 'function') {",
            "    if (!state.rightBone || !state.leftBone) root.traverse((node) => { if (!state.rightBone && (node.name === 'mixamorig:RightHand' || node.name === 'RightHand')) state.rightBone = node; if (!state.leftBone && (node.name === 'mixamorig:LeftHand' || node.name === 'LeftHand')) state.leftBone = node; });",
            "  }",
            "}",
            "function ensureAttached(object, bone, side) {",
            "  if (!object || !bone || typeof object.get3DRendererObject !== 'function') return;",
            "  const renderer = object.get3DRendererObject();",
            "  if (!renderer || renderer.userData.havocLoginAttached) return;",
            "  bone.attach(renderer);",
            "  renderer.userData.havocLoginAttached = true;",
            "  renderer.position.set(0, 0, 0);",
            "  renderer.rotation.set(0, 0, 0);",
            "  renderer.scale.set(1, 1, 1);",
            "  const group = new THREE.Group();",
            "  group.name = 'HavocLoginEnergy_' + side;",
            "  const core = new THREE.Mesh(new THREE.SphereGeometry(18, 20, 20), new THREE.MeshBasicMaterial({ color: 0xa9f7ff, transparent: true, opacity: 0.92, blending: THREE.AdditiveBlending, depthWrite: false }));",
            "  group.add(core);",
            "  for (let i = 0; i < 3; i++) { const ring = new THREE.Mesh(new THREE.TorusGeometry(24 + i * 8, 2.4, 12, 40), new THREE.MeshBasicMaterial({ color: i === 0 ? 0xffffff : 0x21d8ff, transparent: true, opacity: 0.58 - i * 0.12, blending: THREE.AdditiveBlending, depthWrite: false })); ring.rotation.x = Math.PI / 2; ring.userData.spin = (i + 1) * (i % 2 ? -1 : 1); group.add(ring); }",
            "  for (let i = 0; i < 8; i++) { const spark = new THREE.Mesh(new THREE.SphereGeometry(2.4, 8, 8), new THREE.MeshBasicMaterial({ color: i % 2 ? 0x68efff : 0xffffff, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false })); spark.userData.phase = i * 0.8; spark.userData.radius = 28 + (i % 3) * 10; group.add(spark); }",
            "  const light = new THREE.PointLight(0x45eaff, 5.5, 180, 2); group.add(light);",
            "  bone.add(group);",
            "  state[side + 'Fx'] = group;",
            "}",
            "ensureAttached(right, state.rightBone, 'right');",
            "ensureAttached(left, state.leftBone, 'left');",
            "function animateFx(group, side) {",
            "  if (!group) return;",
            "  const pulse = 0.82 + Math.sin(state.t * 5.5 + (side === 'left' ? 1.7 : 0)) * 0.22;",
            "  group.scale.setScalar(pulse);",
            "  group.children.forEach((child, index) => { if (child.isMesh && child.geometry && child.geometry.type === 'TorusGeometry') { child.rotation.z += 0.018 * child.userData.spin; child.rotation.y += 0.009 * (index % 2 ? -1 : 1); } if (child.userData.radius) { const a = state.t * (1.5 + index * 0.03) + child.userData.phase; child.position.set(Math.cos(a) * child.userData.radius, Math.sin(a * 1.23) * child.userData.radius * 0.55, Math.sin(a) * child.userData.radius); child.scale.setScalar(0.7 + 0.3 * (0.5 + 0.5 * Math.sin(a * 2))); } if (child.isPointLight) child.intensity = 4.5 + Math.sin(state.t * 7 + (side === 'left' ? 1 : 0)) * 1.8; });",
            "}",
            "animateFx(state.rightFx, 'right');",
            "animateFx(state.leftFx, 'left');",
            "state.initialized = true;",
        ],
        'parameterObjects': '',
        'useStrict': False,
    }]

    # Clean, deliberate 1280x720 composition.
    set_instance(login, 'LoginBackground', x=0, y=0, width=1280, height=720, layer='UI', z_order=0)
    set_instance(login, 'LoginPanel', x=735, y=60, width=500, height=600, layer='UI', z_order=10)
    set_instance(login, 'LoginBrawler', x=270, y=315, width=430, height=610, layer='', z_order=0)
    set_instance(login, 'LoginGauntletRight', x=270, y=315, width=180, height=180, layer='', z_order=1)
    set_instance(login, 'LoginGauntletLeft', x=270, y=315, width=180, height=180, layer='', z_order=1)

    # The logo sprites were part of the failed visual pass. Use typography instead.
    login['instances'] = [i for i in login.get('instances', []) if i.get('name') not in {'HavocLogo', 'OnlineLogo'}]

    set_instance(login, 'LoginTitle', x=790, y=105, layer='UI', z_order=22)
    set_instance(login, 'LoginSubtitle', x=792, y=158, layer='UI', z_order=22)
    set_instance(login, 'UsernameLabel', x=790, y=225, layer='UI', z_order=22)
    set_instance(login, 'LoginUsername', x=790, y=252, width=400, height=56, layer='UI', z_order=23)
    set_instance(login, 'PasswordLabel', x=790, y=330, layer='UI', z_order=22)
    set_instance(login, 'LoginPassword', x=790, y=357, width=400, height=56, layer='UI', z_order=23)
    set_instance(login, 'LoginButton', x=790, y=445, width=400, height=76, layer='UI', z_order=23)
    set_instance(login, 'LoginButtonText', x=945, y=468, layer='UI', z_order=24)
    set_instance(login, 'ForgotPasswordText', x=790, y=540, layer='UI', z_order=24)
    set_instance(login, 'CreateAccountText', x=990, y=540, layer='UI', z_order=24)
    set_instance(login, 'LoginStatusText', x=790, y=610, layer='UI', z_order=24)
    set_instance(login, 'VersionText', x=1140, y=680, layer='UI', z_order=24)

    set_text(login, 'LoginTitle', 'HAVOC', size=48, color='235;248;255', bold=True)
    set_text(login, 'LoginSubtitle', 'ONLINE', size=18, color='98;224;245', bold=True)
    set_text(login, 'UsernameLabel', 'USERNAME', size=16, color='139;207;220', bold=True)
    set_text(login, 'PasswordLabel', 'PASSWORD', size=16, color='139;207;220', bold=True)
    set_text(login, 'LoginButtonText', 'LOGIN', size=24, color='220;251;255', bold=True)
    set_text(login, 'ForgotPasswordText', 'FORGOT PASSWORD', size=14, color='126;205;220', bold=False)
    set_text(login, 'CreateAccountText', 'CREATE ACCOUNT', size=14, color='126;205;220', bold=False)
    set_text(login, 'LoginStatusText', '●  SERVER ONLINE', size=14, color='91;229;143', bold=True)
    set_text(login, 'VersionText', 'v0.1.0', size=12, color='110;130;145', bold=False)

    # Input styling, preserving the existing TextInput object schema.
    for name in ('LoginUsername', 'LoginPassword'):
        obj = object_def(login, name)
        if obj and isinstance(obj.get('content'), dict):
            obj['content']['fontSize'] = 20
            obj['content']['textColor'] = '235;238;245'
            obj['content']['textAlign'] = 'left'
            obj['content']['paddingX'] = 16
            obj['content']['paddingY'] = 8
    username = object_def(login, 'LoginUsername')
    password = object_def(login, 'LoginPassword')
    if username and isinstance(username.get('content'), dict):
        username['content']['placeholder'] = 'Username'
        username['content']['inputType'] = 'text'
    if password and isinstance(password.get('content'), dict):
        password['content']['placeholder'] = 'Password'
        password['content']['inputType'] = 'password'

    data['firstLayout'] = 'Login'
    PROJECT.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    json.loads(PROJECT.read_text(encoding='utf-8'))
    print('HAVOC LOGIN UI v2 rebuilt successfully.')
    print('Startup layout:', data['firstLayout'])
    print('Login events:', len(login.get('events', [])))
    print('Login instances:', len(login.get('instances', [])))


if __name__ == '__main__':
    main()
