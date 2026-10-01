/**
 * Enhancement presentation runtime.
 *
 * +10 uses a dense MMORPG-style enhancement aura inspired by the heavy glow
 * used by classic online RPG equipment upgrades. The effect is built from
 * layered local shells and compact energy sparks. It intentionally avoids
 * spiral/curling ribbons and long magical trails.
 *
 * Everything is renderer-local. The equipment mesh, attachment transform,
 * and skeleton are never modified by the enhancement presentation.
 */
const HAVOC_PLUS10_VFX_CONFIG = Object.freeze({
  itemObjectName: 'IronGauntlet',
  groupName: 'HavocPlus10VFX',
  coreColor: 0xffff9b22,
  hotColor: 0xfffff4df,
  colors: Object.freeze([
    0xffff351d,
    0xffff7a18,
    0xffffcf32,
    0xffff3bc7,
    0xff8c35ff,
    0xff219cff,
  ]),
  pulseSpeed: 5.2,
  particleCount: 128,
  particleSize: 0.085,
  sparkCount: 56,
  sparkSize: 0.045,
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

function addHavocPlus10ShellLayer(renderer, group, scaleFactor, opacity, color, name) {
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
    shell.name = name || 'HavocPlus10Shell';
    shell.userData = shell.userData || {};
    shell.userData.havocPlus10Vfx = true;
    shell.userData.baseOpacity = opacity;
    shell.userData.shellScale = scaleFactor;
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
      new THREE.EdgesGeometry(node.geometry, 18),
      new THREE.LineBasicMaterial({
        color: HAVOC_PLUS10_VFX_CONFIG.hotColor,
        transparent: true,
        opacity: 0.48,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        depthTest: true,
      }),
    );

    edges.name = 'HavocPlus10Edges';
    edges.userData = edges.userData || {};
    edges.userData.havocPlus10Vfx = true;
    edges.userData.baseOpacity = 0.48;
    edges.position.copy(position);
    edges.quaternion.copy(quaternion);
    edges.scale.copy(scale).multiplyScalar(1.018);
    group.add(edges);
  });
}

function addHavocPlus10Particles(group, bounds, count, size, color, name, verticalSpread, radialScale) {
  if (!group || !bounds || typeof THREE === 'undefined') return;
  if (typeof THREE.BufferGeometry !== 'function' ||
      typeof THREE.Float32BufferAttribute !== 'function' ||
      typeof THREE.PointsMaterial !== 'function' ||
      typeof THREE.Points !== 'function') return;

  const center = bounds.getCenter(new THREE.Vector3());
  const boundsSize = bounds.getSize(new THREE.Vector3());
  const radialBase = Math.max(boundsSize.x, boundsSize.z) * radialScale;
  const positions = [];
  const phases = [];
  const speeds = [];
  const radii = [];

  for (let i = 0; i < count; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const radius = 0.72 + Math.random() * 0.58;
    const y = (Math.random() - 0.5) * boundsSize.y * verticalSpread;

    positions.push(
      center.x + Math.cos(angle) * radialBase * radius,
      center.y + y,
      center.z + Math.sin(angle) * radialBase * radius,
    );
    phases.push(Math.random() * Math.PI * 2);
    speeds.push(0.18 + Math.random() * 0.52);
    radii.push(radius);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));

  const material = new THREE.PointsMaterial({
    color,
    size,
    transparent: true,
    opacity: 0.82,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: true,
    sizeAttenuation: true,
  });

  const particles = new THREE.Points(geometry, material);
  particles.name = name;
  particles.userData = particles.userData || {};
  particles.userData.havocPlus10Vfx = true;
  particles.userData.center = center;
  particles.userData.size = boundsSize;
  particles.userData.radiusBase = radialBase;
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
  group.userData.elapsed = 0;

  // Tight hot core. This keeps the equipment readable instead of washing it out.
  addHavocPlus10ShellLayer(renderer, group, 1.018, 0.10, HAVOC_PLUS10_VFX_CONFIG.coreColor, 'HavocPlus10Shell');

  // Dense colored aura. These layers create thickness without geometric curls.
  addHavocPlus10ShellLayer(renderer, group, 1.045, 0.065, HAVOC_PLUS10_VFX_CONFIG.colors[2], 'HavocPlus10AuraGold');
  addHavocPlus10ShellLayer(renderer, group, 1.085, 0.050, HAVOC_PLUS10_VFX_CONFIG.colors[3], 'HavocPlus10AuraMagenta');
  addHavocPlus10ShellLayer(renderer, group, 1.13, 0.035, HAVOC_PLUS10_VFX_CONFIG.colors[0], 'HavocPlus10AuraRed');
  addHavocPlus10ShellLayer(renderer, group, 1.18, 0.022, HAVOC_PLUS10_VFX_CONFIG.colors[4], 'HavocPlus10AuraPurple');

  addHavocPlus10Edges(renderer, group);

  // Dense compact particles provide the explosive enhancement feel without ribbons.
  addHavocPlus10Particles(
    group,
    bounds,
    HAVOC_PLUS10_VFX_CONFIG.particleCount,
    HAVOC_PLUS10_VFX_CONFIG.particleSize,
    HAVOC_PLUS10_VFX_CONFIG.hotColor,
    'HavocPlus10Particles',
    1.35,
    0.62,
  );

  addHavocPlus10Particles(
    group,
    bounds,
    HAVOC_PLUS10_VFX_CONFIG.sparkCount,
    HAVOC_PLUS10_VFX_CONFIG.sparkSize,
    HAVOC_PLUS10_VFX_CONFIG.colors[5],
    'HavocPlus10Sparks',
    1.65,
    0.82,
  );

  if (typeof THREE.PointLight === 'function') {
    const radius = Math.max(2.8, bounds.getSize(new THREE.Vector3()).length() * 1.7);
    const light = new THREE.PointLight(HAVOC_PLUS10_VFX_CONFIG.coreColor, 1.8, radius, 2.0);
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
    const speed = speeds[i] || 0.2;
    const radius = radii[i] || 0.85;
    const travel = (elapsed * speed + phase / (Math.PI * 2)) % 1;
    const angle = phase + elapsed * (0.55 + speed * 0.85);

    position.setXYZ(
      i,
      center.x + Math.cos(angle) * radiusBase * radius,
      center.y + (travel - 0.5) * size.y * 1.22,
      center.z + Math.sin(angle) * radiusBase * radius,
    );
  }

  position.needsUpdate = true;
  if (particles.material) {
    particles.material.opacity = 0.42 + pulse * 0.48;
    particles.material.size = particles.name === 'HavocPlus10Sparks'
      ? HAVOC_PLUS10_VFX_CONFIG.sparkSize * (0.85 + pulse * 0.8)
      : HAVOC_PLUS10_VFX_CONFIG.particleSize * (0.88 + pulse * 0.58);
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

    if (child.userData && child.userData.havocPlus10Vfx && child.material && child.name.indexOf('HavocPlus10Aura') === 0) {
      const base = Number(child.userData.baseOpacity) || 0.03;
      child.material.opacity = base * (0.72 + pulse * 1.2 + flash * 0.18);
    }

    if (child.name === 'HavocPlus10Shell' && child.material) {
      const base = Number(child.userData && child.userData.baseOpacity) || 0.10;
      child.material.opacity = base * (0.82 + pulse * 0.85 + flash * 0.16);
    }

    if (child.name === 'HavocPlus10Edges' && child.material) {
      child.material.opacity = 0.34 + pulse * 0.38 + flash * 0.10;
    }

    if (child.name === 'HavocPlus10Particles' || child.name === 'HavocPlus10Sparks') {
      updateHavocPlus10Particles(child, elapsed, pulse);
    }

    if (child.name === 'HavocPlus10Light' && child.isLight) {
      child.intensity = 1.35 + pulse * 2.0 + flash * 0.8;
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
