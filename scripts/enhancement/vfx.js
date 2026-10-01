/**
 * Enhancement presentation runtime.
 *
 * +100 uses an extreme MMORPG enhancement aura: a white-hot core surrounded
 * by thick magenta, violet, blue, orange and gold energy, dense sparks, and
 * compact explosive particles. It intentionally avoids ribbons, spirals,
 * curling lines, and long trails.
 *
 * Everything is renderer-local. The equipment mesh, attachment transform,
 * and skeleton are never modified by the enhancement presentation.
 */
const HAVOC_PLUS10_VFX_CONFIG = Object.freeze({
  itemObjectName: 'IronGauntlet',
  groupName: 'HavocPlus10VFX',
  coreColor: 0xffff9b22,
  hotColor: 0xffffffff,
  colors: Object.freeze([
    0xffff351d,
    0xffff7a18,
    0xffffcf32,
    0xffff3bc7,
    0xff8c35ff,
    0xff219cff,
  ]),
  pulseSpeed: 4.6,
  particleCount: 260,
  particleSize: 0.12,
  sparkCount: 120,
  sparkSize: 0.065,
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
    shell.renderOrder = 20;
    group.add(shell);
  });
}

function addHavocPlus10Particles(group, bounds, count, size, color, name, verticalSpread, radialScale, opacity) {
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
    const radius = 0.62 + Math.random() * 0.70;
    const y = (Math.random() - 0.5) * boundsSize.y * verticalSpread;

    positions.push(
      center.x + Math.cos(angle) * radialBase * radius,
      center.y + y,
      center.z + Math.sin(angle) * radialBase * radius,
    );
    phases.push(Math.random() * Math.PI * 2);
    speeds.push(0.15 + Math.random() * 0.70);
    radii.push(radius);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));

  const material = new THREE.PointsMaterial({
    color,
    size,
    transparent: true,
    opacity: opacity === undefined ? 0.9 : opacity,
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
  particles.userData.baseOpacity = opacity === undefined ? 0.9 : opacity;
  particles.renderOrder = 40;
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

  // White-hot core. These close shells create the saturated center seen in
  // the reference instead of a thin outline around the equipment.
  addHavocPlus10ShellLayer(renderer, group, 1.012, 0.40, HAVOC_PLUS10_VFX_CONFIG.hotColor, 'HavocPlus10CoreWhite');
  addHavocPlus10ShellLayer(renderer, group, 1.028, 0.31, HAVOC_PLUS10_VFX_CONFIG.hotColor, 'HavocPlus10CoreWhiteWide');

  // Thick colored aura layers. They remain compact and volumetric, with no
  // geometry that can form curling lines or ribbons.
  addHavocPlus10ShellLayer(renderer, group, 1.055, 0.30, HAVOC_PLUS10_VFX_CONFIG.coreColor, 'HavocPlus10AuraGold');
  addHavocPlus10ShellLayer(renderer, group, 1.095, 0.27, HAVOC_PLUS10_VFX_CONFIG.colors[2], 'HavocPlus10AuraGoldWide');
  addHavocPlus10ShellLayer(renderer, group, 1.145, 0.235, HAVOC_PLUS10_VFX_CONFIG.colors[3], 'HavocPlus10AuraMagenta');
  addHavocPlus10ShellLayer(renderer, group, 1.205, 0.19, HAVOC_PLUS10_VFX_CONFIG.colors[4], 'HavocPlus10AuraPurple');
  addHavocPlus10ShellLayer(renderer, group, 1.275, 0.16, HAVOC_PLUS10_VFX_CONFIG.colors[5], 'HavocPlus10AuraBlue');
  addHavocPlus10ShellLayer(renderer, group, 1.355, 0.115, HAVOC_PLUS10_VFX_CONFIG.colors[0], 'HavocPlus10AuraRed');

  // Dense multi-color sparks. The reference has a storm of compact points,
  // not continuous trails.
  addHavocPlus10Particles(
    group, bounds,
    HAVOC_PLUS10_VFX_CONFIG.particleCount,
    HAVOC_PLUS10_VFX_CONFIG.particleSize,
    HAVOC_PLUS10_VFX_CONFIG.hotColor,
    'HavocPlus10ParticlesWhite',
    1.55, 0.78, 0.88,
  );

  addHavocPlus10Particles(
    group, bounds,
    Math.floor(HAVOC_PLUS10_VFX_CONFIG.particleCount * 0.72),
    HAVOC_PLUS10_VFX_CONFIG.particleSize * 0.92,
    HAVOC_PLUS10_VFX_CONFIG.colors[3],
    'HavocPlus10ParticlesMagenta',
    1.70, 0.98, 0.74,
  );

  addHavocPlus10Particles(
    group, bounds,
    Math.floor(HAVOC_PLUS10_VFX_CONFIG.particleCount * 0.60),
    HAVOC_PLUS10_VFX_CONFIG.particleSize * 0.82,
    HAVOC_PLUS10_VFX_CONFIG.colors[5],
    'HavocPlus10ParticlesBlue',
    1.85, 1.08, 0.68,
  );

  addHavocPlus10Particles(
    group, bounds,
    HAVOC_PLUS10_VFX_CONFIG.sparkCount,
    HAVOC_PLUS10_VFX_CONFIG.sparkSize,
    HAVOC_PLUS10_VFX_CONFIG.colors[1],
    'HavocPlus10SparksOrange',
    1.95, 1.18, 0.92,
  );

  addHavocPlus10Particles(
    group, bounds,
    Math.floor(HAVOC_PLUS10_VFX_CONFIG.sparkCount * 0.65),
    HAVOC_PLUS10_VFX_CONFIG.sparkSize * 0.86,
    HAVOC_PLUS10_VFX_CONFIG.colors[2],
    'HavocPlus10SparksGold',
    2.05, 1.28, 0.86,
  );

  if (typeof THREE.PointLight === 'function') {
    const center = bounds.getCenter(new THREE.Vector3());
    const radius = Math.max(4.8, bounds.getSize(new THREE.Vector3()).length() * 3.0);

    const whiteLight = new THREE.PointLight(0xffffff, 8.5, radius, 1.55);
    whiteLight.name = 'HavocPlus10LightWhite';
    whiteLight.userData = whiteLight.userData || {};
    whiteLight.userData.havocPlus10Vfx = true;
    whiteLight.position.copy(center);
    group.add(whiteLight);

    const colorLight = new THREE.PointLight(HAVOC_PLUS10_VFX_CONFIG.colors[3], 4.2, radius * 1.25, 1.65);
    colorLight.name = 'HavocPlus10LightColor';
    colorLight.userData = colorLight.userData || {};
    colorLight.userData.havocPlus10Vfx = true;
    colorLight.position.copy(center);
    group.add(colorLight);
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
    const angle = phase + elapsed * (0.45 + speed * 0.70);

    position.setXYZ(
      i,
      center.x + Math.cos(angle) * radiusBase * radius,
      center.y + (travel - 0.5) * size.y * 1.30,
      center.z + Math.sin(angle) * radiusBase * radius,
    );
  }

  position.needsUpdate = true;
  if (particles.material) {
    const baseOpacity = Number(particles.userData.baseOpacity) || 0.8;
    particles.material.opacity = baseOpacity * (0.72 + pulse * 0.52);
    particles.material.size = particles.name.indexOf('Sparks') === 0
      ? HAVOC_PLUS10_VFX_CONFIG.sparkSize * (0.88 + pulse * 1.10)
      : HAVOC_PLUS10_VFX_CONFIG.particleSize * (0.90 + pulse * 0.72);
  }
}

function updateHavocPlus10Vfx(group, dt) {
  if (!group) return;

  const delta = Math.max(0, Number(dt) || 0);
  group.userData.elapsed = (group.userData.elapsed || 0) + delta;
  const elapsed = group.userData.elapsed;
  const pulse = 0.5 + 0.5 * Math.sin(elapsed * HAVOC_PLUS10_VFX_CONFIG.pulseSpeed);
  const flash = 0.5 + 0.5 * Math.sin(elapsed * 13.5 + 0.4);

  group.children.forEach((child) => {
    if (!child) return;

    if (child.userData && child.userData.havocPlus10Vfx && child.material &&
        child.name.indexOf('HavocPlus10Aura') === 0) {
      const base = Number(child.userData.baseOpacity) || 0.03;
      child.material.opacity = base * (0.74 + pulse * 1.55 + flash * 0.38);
    }

    if (child.name.indexOf('HavocPlus10CoreWhite') === 0 && child.material) {
      const base = Number(child.userData && child.userData.baseOpacity) || 0.10;
      child.material.opacity = base * (0.78 + pulse * 1.25 + flash * 0.35);
    }

    if (child.name.indexOf('HavocPlus10Particles') === 0 ||
        child.name.indexOf('HavocPlus10Sparks') === 0) {
      updateHavocPlus10Particles(child, elapsed, pulse);
    }

    if (child.name === 'HavocPlus10LightWhite' && child.isLight) {
      child.intensity = 6.0 + pulse * 7.5 + flash * 2.8;
    }

    if (child.name === 'HavocPlus10LightColor' && child.isLight) {
      child.intensity = 2.8 + pulse * 4.8 + flash * 1.6;
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
