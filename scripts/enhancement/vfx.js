/**
 * Enhancement presentation runtime.
 *
 * +10 uses a thick, supernova-like MMORPG enhancement aura. The effect stays
 * renderer-local and never modifies the equipment transform or skeleton.
 */
const HAVOC_PLUS10_VFX_CONFIG = Object.freeze({
  itemObjectName: 'IronGauntlet',
  groupName: 'HavocPlus10VFX',
  coreColor: 0xffffc533,
  hotColor: 0xffffffea,
  colors: Object.freeze([
    0xffff2b18,
    0xffff7a18,
    0xffffcf32,
    0xffff3bc7,
    0xff8c35ff,
    0xff219cff,
  ]),
  pulseSpeed: 5.2,
  particleCount: 96,
  particleSize: 0.07,
  ribbonCount: 7,
  ribbonTubeRadius: 0.045,
  ribbonSegments: 56,
});

function getHavocPlus10RelativeMatrix(renderer, node) {
  if (!renderer || !node || typeof THREE === 'undefined' || typeof THREE.Matrix4 !== 'function') return null;
  if (typeof renderer.updateMatrixWorld === 'function') renderer.updateMatrixWorld(true);
  if (typeof node.updateMatrixWorld === 'function') node.updateMatrixWorld(true);

  const rendererInverse = new THREE.Matrix4().copy(renderer.matrixWorld).invert();
  return rendererInverse.multiply(node.matrixWorld);
}

function getHavocPlus10SourceMeshes(renderer) {
  const meshes = [];
  if (!renderer || typeof renderer.traverse !== 'function') return meshes;

  renderer.traverse((node) => {
    if (node && node.isMesh && node.geometry && !(node.userData && node.userData.havocPlus10Vfx)) {
      meshes.push(node);
    }
  });

  return meshes;
}

function getHavocPlus10VfxBounds(renderer) {
  if (!renderer || typeof THREE === 'undefined' || typeof THREE.Box3 !== 'function') return null;

  const bounds = new THREE.Box3();
  let hasBounds = false;

  getHavocPlus10SourceMeshes(renderer).forEach((node) => {
    if (typeof node.geometry.computeBoundingBox === 'function') node.geometry.computeBoundingBox();
    if (!node.geometry.boundingBox) return;

    const relativeMatrix = getHavocPlus10RelativeMatrix(renderer, node);
    if (!relativeMatrix) return;

    const box = node.geometry.boundingBox.clone();
    box.applyMatrix4(relativeMatrix);
    bounds.union(box);
    hasBounds = true;
  });

  return hasBounds ? bounds : null;
}

function addHavocPlus10ShellLayer(renderer, group, scaleFactor, opacity, color) {
  if (!renderer || !group || typeof THREE === 'undefined') return;
  if (typeof THREE.MeshBasicMaterial !== 'function' || typeof THREE.Mesh !== 'function') return;

  getHavocPlus10SourceMeshes(renderer).forEach((node) => {
    const relativeMatrix = getHavocPlus10RelativeMatrix(renderer, node);
    if (!relativeMatrix) return;

    const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    relativeMatrix.decompose(position, quaternion, scale);

    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: true,
      side: THREE.DoubleSide,
    });

    const shell = new THREE.Mesh(node.geometry, material);
    shell.name = 'HavocPlus10Shell';
    shell.userData = shell.userData || {};
    shell.userData.havocPlus10Vfx = true;
    shell.userData.baseOpacity = opacity;
    shell.position.copy(position);
    shell.quaternion.copy(quaternion);
    shell.scale.copy(scale).multiplyScalar(scaleFactor);
    group.add(shell);
  });
}

function addHavocPlus10Edges(renderer, group) {
  if (!renderer || !group || typeof THREE === 'undefined') return;
  if (typeof THREE.EdgesGeometry !== 'function' ||
      typeof THREE.LineBasicMaterial !== 'function' ||
      typeof THREE.LineSegments !== 'function') return;

  getHavocPlus10SourceMeshes(renderer).forEach((node) => {
    const relativeMatrix = getHavocPlus10RelativeMatrix(renderer, node);
    if (!relativeMatrix) return;

    const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    relativeMatrix.decompose(position, quaternion, scale);

    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(node.geometry, 16),
      new THREE.LineBasicMaterial({
        color: HAVOC_PLUS10_VFX_CONFIG.hotColor,
        transparent: true,
        opacity: 0.82,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        depthTest: true,
      }),
    );

    edges.name = 'HavocPlus10Edges';
    edges.userData = edges.userData || {};
    edges.userData.havocPlus10Vfx = true;
    edges.position.copy(position);
    edges.quaternion.copy(quaternion);
    edges.scale.copy(scale).multiplyScalar(1.02);
    group.add(edges);
  });
}

function addHavocPlus10Ribbons(group, bounds) {
  if (!group || !bounds || typeof THREE === 'undefined') return;
  if (typeof THREE.Group !== 'function' ||
      typeof THREE.CatmullRomCurve3 !== 'function' ||
      typeof THREE.TubeGeometry !== 'function' ||
      typeof THREE.MeshBasicMaterial !== 'function' ||
      typeof THREE.Mesh !== 'function') return;

  const center = bounds.getCenter(new THREE.Vector3());
  const size = bounds.getSize(new THREE.Vector3());
  const height = Math.max(size.x, size.y, size.z);
  const radial = Math.max(size.x, size.z) * 0.58;

  const ribbonGroup = new THREE.Group();
  ribbonGroup.name = 'HavocPlus10Ribbons';
  ribbonGroup.userData = ribbonGroup.userData || {};
  ribbonGroup.userData.havocPlus10Vfx = true;
  ribbonGroup.position.copy(center);
  group.add(ribbonGroup);

  for (let i = 0; i < HAVOC_PLUS10_VFX_CONFIG.ribbonCount; i += 1) {
    const phase = (i / HAVOC_PLUS10_VFX_CONFIG.ribbonCount) * Math.PI * 2;
    const points = [];

    for (let p = 0; p < 34; p += 1) {
      const t = p / 33;
      const angle = phase + t * Math.PI * 2 * (1.7 + (i % 3) * 0.28);
      const wobble = 1 +
        Math.sin(t * Math.PI * 7 + phase) * 0.16 +
        Math.sin(t * Math.PI * 13 + phase * 0.6) * 0.06;
      const radius = radial * (0.92 + 0.1 * Math.sin(t * Math.PI)) * wobble;
      points.push(new THREE.Vector3(
        Math.cos(angle) * radius,
        (t - 0.5) * height * 1.24,
        Math.sin(angle) * radius,
      ));
    }

    const curve = new THREE.CatmullRomCurve3(points);
    const color = HAVOC_PLUS10_VFX_CONFIG.colors[i % HAVOC_PLUS10_VFX_CONFIG.colors.length];

    const glow = new THREE.Mesh(
      new THREE.TubeGeometry(
        curve,
        HAVOC_PLUS10_VFX_CONFIG.ribbonSegments,
        HAVOC_PLUS10_VFX_CONFIG.ribbonTubeRadius * 3.8,
        8,
        false,
      ),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.38,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        depthTest: true,
      }),
    );
    glow.name = 'HavocPlus10RibbonGlow';
    glow.userData = glow.userData || {};
    glow.userData.havocPlus10Vfx = true;
    glow.userData.phase = phase;
    glow.userData.baseOpacity = 0.38;
    ribbonGroup.add(glow);

    const core = new THREE.Mesh(
      new THREE.TubeGeometry(
        curve,
        HAVOC_PLUS10_VFX_CONFIG.ribbonSegments,
        HAVOC_PLUS10_VFX_CONFIG.ribbonTubeRadius,
        8,
        false,
      ),
      new THREE.MeshBasicMaterial({
        color: HAVOC_PLUS10_VFX_CONFIG.hotColor,
        transparent: true,
        opacity: 0.96,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        depthTest: true,
      }),
    );
    core.name = 'HavocPlus10RibbonCore';
    core.userData = core.userData || {};
    core.userData.havocPlus10Vfx = true;
    core.userData.phase = phase;
    core.userData.baseOpacity = 0.96;
    ribbonGroup.add(core);
  }
}

function addHavocPlus10Particles(group, bounds) {
  if (!group || !bounds || typeof THREE === 'undefined') return;
  if (typeof THREE.BufferGeometry !== 'function' ||
      typeof THREE.Float32BufferAttribute !== 'function' ||
      typeof THREE.PointsMaterial !== 'function' ||
      typeof THREE.Points !== 'function') return;

  const center = bounds.getCenter(new THREE.Vector3());
  const size = bounds.getSize(new THREE.Vector3());
  const radiusBase = Math.max(size.x, size.z) * 0.62;
  const positions = [];
  const phases = [];
  const speeds = [];
  const radii = [];

  for (let i = 0; i < HAVOC_PLUS10_VFX_CONFIG.particleCount; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const radius = 0.78 + Math.random() * 0.65;

    positions.push(
      center.x + Math.cos(angle) * radiusBase * radius,
      center.y + (Math.random() - 0.5) * size.y * 1.45,
      center.z + Math.sin(angle) * radiusBase * radius,
    );
    phases.push(Math.random() * Math.PI * 2);
    speeds.push(0.25 + Math.random() * 0.55);
    radii.push(radius);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));

  const material = new THREE.PointsMaterial({
    color: HAVOC_PLUS10_VFX_CONFIG.hotColor,
    size: HAVOC_PLUS10_VFX_CONFIG.particleSize,
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: true,
    sizeAttenuation: true,
  });

  const particles = new THREE.Points(geometry, material);
  particles.name = 'HavocPlus10Particles';
  particles.userData = particles.userData || {};
  particles.userData.havocPlus10Vfx = true;
  particles.userData.center = center;
  particles.userData.size = size;
  particles.userData.radiusBase = radiusBase;
  particles.userData.phases = phases;
  particles.userData.speeds = speeds;
  particles.userData.radii = radii;
  group.add(particles);
}

function createHavocPlus10Vfx(renderer) {
  if (!renderer || typeof THREE === 'undefined' || typeof THREE.Group !== 'function') return null;

  const bounds = getHavocPlus10VfxBounds(renderer);
  if (!bounds) return null;

  const group = new THREE.Group();
  group.name = HAVOC_PLUS10_VFX_CONFIG.groupName;
  group.userData = group.userData || {};
  group.userData.havocPlus10Vfx = true;
  group.userData.havocPlus10Vfx = true;
  group.userData.elapsed = 0;

  addHavocPlus10ShellLayer(renderer, group, 1.018, 0.14, HAVOC_PLUS10_VFX_CONFIG.coreColor);
  addHavocPlus10ShellLayer(renderer, group, 1.04, 0.1, HAVOC_PLUS10_VFX_CONFIG.colors[2]);
  addHavocPlus10ShellLayer(renderer, group, 1.075, 0.08, HAVOC_PLUS10_VFX_CONFIG.colors[3]);
  addHavocPlus10Edges(renderer, group);
  addHavocPlus10Ribbons(group, bounds);
  addHavocPlus10Particles(group, bounds);

  if (typeof THREE.PointLight === 'function') {
    const radius = Math.max(2.8, bounds.getSize(new THREE.Vector3()).length() * 1.7);
    const light = new THREE.PointLight(HAVOC_PLUS10_VFX_CONFIG.coreColor, 2.5, radius, 2.0);
    light.name = 'HavocPlus10Light';
    light.userData = light.userData || {};
    light.userData.havocPlus10Vfx = true;
    light.position.copy(bounds.getCenter(new THREE.Vector3()));
    group.add(light);
  }

  renderer.add(group);
  return group;
}

function updateHavocPlus10Particles(particles, elapsed, pulse) {
  if (!particles || !particles.geometry || !particles.userData) return;
  const position = particles.geometry.getAttribute('position');
  if (!position) return;

  const center = particles.userData.center;
  const size = particles.userData.size;
  const radiusBase = particles.userData.radiusBase;
  const phases = particles.userData.phases || [];
  const speeds = particles.userData.speeds || [];
  const radii = particles.userData.radii || [];
  if (!center || !size || !radiusBase) return;

  for (let i = 0; i < position.count; i += 1) {
    const phase = phases[i] || 0;
    const speed = speeds[i] || 0.3;
    const radius = radii[i] || 0.9;
    const travel = (elapsed * speed + phase / (Math.PI * 2)) % 1;
    const angle = phase + elapsed * (0.7 + speed * 0.8);

    position.setXYZ(
      i,
      center.x + Math.cos(angle) * radiusBase * radius,
      center.y + (travel - 0.5) * size.y * 1.3,
      center.z + Math.sin(angle) * radiusBase * radius,
    );
  }

  position.needsUpdate = true;
  if (particles.material) {
    particles.material.opacity = 0.6 + pulse * 0.4;
    particles.material.size = HAVOC_PLUS10_VFX_CONFIG.particleSize * (0.9 + pulse * 0.65);
  }
}

function updateHavocPlus10Vfx(group, dt) {
  if (!group) return;

  const delta = Math.max(0, Number(dt) || 0);
  group.userData.elapsed = (group.userData.elapsed || 0) + delta;
  const elapsed = group.userData.elapsed;
  const pulse = 0.5 + 0.5 * Math.sin(elapsed * HAVOC_PLUS10_VFX_CONFIG.pulseSpeed);
  const flash = 0.5 + 0.5 * Math.sin(elapsed * 11.5 + 0.4);

  group.children.forEach((child) => {
    if (!child) return;

    if (child.name === 'HavocPlus10Shell' && child.material) {
      const base = Number(child.userData && child.userData.baseOpacity) || 0.08;
      child.material.opacity = base * (0.7 + pulse * 1.55 + flash * 0.22);
    }

    if (child.name === 'HavocPlus10Edges' && child.material) {
      child.material.opacity = 0.55 + pulse * 0.7 + flash * 0.15;
    }

    if (child.name === 'HavocPlus10Particles') {
      updateHavocPlus10Particles(child, elapsed, pulse);
    }

    if (child.name === 'HavocPlus10Ribbons') {
      child.rotation.y = elapsed * 0.58;
      child.rotation.x = Math.sin(elapsed * 0.85) * 0.09;

      child.children.forEach((ribbon) => {
        if (!ribbon || !ribbon.material) return;
        const phase = Number(ribbon.userData && ribbon.userData.phase) || 0;
        const base = Number(ribbon.userData && ribbon.userData.baseOpacity) || 0.3;
        const wave = 0.72 + 0.65 * (0.5 + 0.5 * Math.sin(elapsed * 7.0 + phase));
        ribbon.material.opacity = base * wave;

        if (ribbon.name === 'HavocPlus10RibbonGlow') {
          ribbon.scale.setScalar(1.0 + flash * 0.18);
        }
      });
    }

    if (child.name === 'HavocPlus10Light' && child.isLight) {
      child.intensity = 1.8 + pulse * 2.8 + flash * 1.4;
    }
  });
}

function updateHavocEnhancement(runtimeScene, dt) {
  if (!runtimeScene) return;

  const gauntlet = runtimeScene.getObjects(HAVOC_PLUS10_VFX_CONFIG.itemObjectName)[0] || null;
  if (!gauntlet || typeof gauntlet.get3DRendererObject !== 'function') return;

  const renderer = gauntlet.get3DRendererObject();
  if (!renderer) return;

  let vfx = null;
  if (typeof renderer.getObjectByName === 'function') {
    vfx = renderer.getObjectByName(HAVOC_PLUS10_VFX_CONFIG.groupName);
  }

  if (!vfx) vfx = createHavocPlus10Vfx(renderer);
  updateHavocPlus10Vfx(vfx, dt);
}
