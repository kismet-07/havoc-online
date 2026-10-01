/**
 * Enhancement presentation runtime.
 *
 * V1 +10 VFX is renderer-local and procedural. It does not modify the
 * equipment mesh, its transform, or the attachment system.
 *
 * The presentation is deliberately close to the equipment: soft emissive
 * shell, bright edge energy, restrained sparks, and a tight light source.
 * No large rings, beams, or world-space geometry are used.
 */
const HAVOC_PLUS10_VFX_CONFIG = Object.freeze({
  itemObjectName: 'IronGauntlet',
  groupName: 'HavocPlus10VFX',
  color: 0xffc94a,
  hotColor: 0xffffe6,
  lightColor: 0xffb52a,
  shellOpacity: 0.055,
  edgeOpacity: 0.28,
  pulseSpeed: 3.2,
  particleCount: 20,
  particleSize: 0.045,
});

function getHavocPlus10RelativeMatrix(renderer, node) {
  if (!renderer || !node || typeof THREE === 'undefined' || typeof THREE.Matrix4 !== 'function') return null;
  if (typeof renderer.updateMatrixWorld === 'function') renderer.updateMatrixWorld(true);

  const rendererInverse = new THREE.Matrix4().copy(renderer.matrixWorld).invert();
  return rendererInverse.multiply(node.matrixWorld);
}

function getHavocPlus10VfxBounds(renderer) {
  if (!renderer || typeof THREE === 'undefined' || typeof THREE.Box3 !== 'function') return null;

  const bounds = new THREE.Box3();
  let hasBounds = false;

  const meshes = [];
  if (typeof renderer.traverse === 'function') {
    renderer.traverse((node) => {
      if (node && node.isMesh && node.geometry) meshes.push(node);
    });
  }

  meshes.forEach((node) => {
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

function createHavocPlus10Shell(renderer, group, opacity, scaleFactor) {
  if (!renderer || !group || typeof THREE === 'undefined') return;
  if (typeof THREE.MeshBasicMaterial !== 'function' || typeof THREE.Mesh !== 'function') return;

  const meshes = getHavocPlus10SourceMeshes(renderer);
  meshes.forEach((node) => {
    const relativeMatrix = getHavocPlus10RelativeMatrix(renderer, node);
    if (!relativeMatrix) return;

    const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    relativeMatrix.decompose(position, quaternion, scale);

    const material = new THREE.MeshBasicMaterial({
      color: HAVOC_PLUS10_VFX_CONFIG.color,
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
    shell.position.copy(position);
    shell.quaternion.copy(quaternion);
    shell.scale.copy(scale).multiplyScalar(scaleFactor);
    group.add(shell);
  });
}

function createHavocPlus10Edges(renderer, group) {
  if (!renderer || !group || typeof THREE === 'undefined') return;
  if (typeof THREE.EdgesGeometry !== 'function' || typeof THREE.LineBasicMaterial !== 'function') return;
  if (typeof THREE.LineSegments !== 'function') return;

  const meshes = getHavocPlus10SourceMeshes(renderer);
  meshes.forEach((node) => {
    const relativeMatrix = getHavocPlus10RelativeMatrix(renderer, node);
    if (!relativeMatrix) return;

    const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    relativeMatrix.decompose(position, quaternion, scale);

    const edgesGeometry = new THREE.EdgesGeometry(node.geometry, 24);
    const material = new THREE.LineBasicMaterial({
      color: HAVOC_PLUS10_VFX_CONFIG.hotColor,
      transparent: true,
      opacity: HAVOC_PLUS10_VFX_CONFIG.edgeOpacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: true,
    });

    const edges = new THREE.LineSegments(edgesGeometry, material);
    edges.name = 'HavocPlus10Edges';
    edges.userData = edges.userData || {};
    edges.userData.havocPlus10Vfx = true;
    edges.position.copy(position);
    edges.quaternion.copy(quaternion);
    edges.scale.copy(scale).multiplyScalar(1.01);
    group.add(edges);
  });
}

function createHavocPlus10Particles(renderer, group) {
  if (!renderer || !group || typeof THREE === 'undefined') return;
  if (typeof THREE.BufferGeometry !== 'function' || typeof THREE.Float32BufferAttribute !== 'function') return;
  if (typeof THREE.PointsMaterial !== 'function' || typeof THREE.Points !== 'function') return;

  const bounds = getHavocPlus10VfxBounds(renderer);
  if (!bounds) return;

  const center = bounds.getCenter(new THREE.Vector3());
  const size = bounds.getSize(new THREE.Vector3());
  const positions = [];
  const phases = [];
  const speeds = [];
  const radii = [];

  for (let i = 0; i < HAVOC_PLUS10_VFX_CONFIG.particleCount; i += 1) {
    const angle = (i / HAVOC_PLUS10_VFX_CONFIG.particleCount) * Math.PI * 2 + Math.random() * 0.45;
    const radius = 0.76 + Math.random() * 0.20;
    const vertical = (Math.random() - 0.5) * 0.8;

    positions.push(
      center.x + Math.cos(angle) * size.x * 0.5 * radius,
      center.y + vertical * size.y,
      center.z + Math.sin(angle) * size.z * 0.5 * radius,
    );
    phases.push(Math.random() * Math.PI * 2);
    speeds.push(0.14 + Math.random() * 0.22);
    radii.push(radius);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));

  const material = new THREE.PointsMaterial({
    color: HAVOC_PLUS10_VFX_CONFIG.color,
    size: HAVOC_PLUS10_VFX_CONFIG.particleSize,
    transparent: true,
    opacity: 0.55,
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
  particles.userData.phases = phases;
  particles.userData.speeds = speeds;
  particles.userData.radii = radii;
  group.add(particles);
}

function createHavocPlus10Vfx(renderer) {
  if (!renderer || typeof THREE === 'undefined' || typeof THREE.Group !== 'function') return null;

  const group = new THREE.Group();
  group.name = HAVOC_PLUS10_VFX_CONFIG.groupName;
  group.userData = group.userData || {};
  group.userData.havocPlus10Vfx = true;
  group.userData.elapsed = 0;

  createHavocPlus10Shell(renderer, group, HAVOC_PLUS10_VFX_CONFIG.shellOpacity, 1.014);
  createHavocPlus10Edges(renderer, group);
  createHavocPlus10Particles(renderer, group);

  if (typeof THREE.PointLight === 'function') {
    const light = new THREE.PointLight(HAVOC_PLUS10_VFX_CONFIG.lightColor, 0.55, 1.6, 2.0);
    light.name = 'HavocPlus10Light';
    light.userData.havocPlus10Vfx = true;
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
  const phases = particles.userData.phases || [];
  const speeds = particles.userData.speeds || [];
  const radii = particles.userData.radii || [];
  if (!center || !size) return;

  for (let i = 0; i < position.count; i += 1) {
    const phase = phases[i] || 0;
    const speed = speeds[i] || 0.2;
    const radius = radii[i] || 0.85;
    const travel = (elapsed * speed + phase / (Math.PI * 2)) % 1;
    const angle = phase + elapsed * (0.35 + speed * 0.65);

    position.setXYZ(
      i,
      center.x + Math.cos(angle) * size.x * 0.5 * radius,
      center.y + (travel - 0.5) * size.y * 1.05,
      center.z + Math.sin(angle) * size.z * 0.5 * radius,
    );
  }

  position.needsUpdate = true;
  if (particles.material) {
    particles.material.opacity = 0.28 + pulse * 0.42;
    particles.material.size = HAVOC_PLUS10_VFX_CONFIG.particleSize * (0.85 + pulse * 0.3);
  }
}

function updateHavocPlus10Vfx(group, dt) {
  if (!group) return;

  const delta = Math.max(0, Number(dt) || 0);
  group.userData.elapsed = (group.userData.elapsed || 0) + delta;
  const elapsed = group.userData.elapsed;
  const pulse = 0.5 + 0.5 * Math.sin(elapsed * HAVOC_PLUS10_VFX_CONFIG.pulseSpeed);

  group.children.forEach((child) => {
    if (!child) return;

    if (child.name === 'HavocPlus10Shell' && child.material) {
      child.material.opacity = 0.025 + pulse * 0.055;
    }

    if (child.name === 'HavocPlus10Edges' && child.material) {
      child.material.opacity = 0.12 + pulse * 0.32;
    }

    if (child.name === 'HavocPlus10Particles') {
      updateHavocPlus10Particles(child, elapsed, pulse);
    }

    if (child.name === 'HavocPlus10Light' && child.isLight) {
      child.intensity = 0.25 + pulse * 0.5;
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
