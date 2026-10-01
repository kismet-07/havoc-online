/**
 * Enhancement presentation runtime.
 *
 * V1 +10 VFX is renderer-local and procedural. It does not modify the
 * equipment mesh, its transform, or the attachment system.
 *
 * The effect is intentionally equipment-local: a soft additive shell,
 * restrained edge energy, a tight point light, and sparse upward sparks.
 * There are no large world-space rings or beams.
 */
const HAVOC_PLUS10_VFX_CONFIG = Object.freeze({
  itemObjectName: 'IronGauntlet',
  groupName: 'HavocPlus10VFX',
  color: 0xffd45a,
  hotColor: 0xffffe0,
  lightColor: 0xffb52a,
  shellOpacity: 0.075,
  edgeOpacity: 0.32,
  pulseSpeed: 3.2,
  particleCount: 24,
  particleSize: 0.055,
});

function getHavocPlus10VfxBounds(renderer) {
  if (!renderer || typeof THREE === 'undefined' || typeof THREE.Box3 !== 'function') return null;

  const bounds = new THREE.Box3();
  let hasBounds = false;

  if (typeof renderer.traverse === 'function') {
    renderer.traverse((node) => {
      if (!node || !node.isMesh || !node.geometry) return;
      if (typeof node.geometry.computeBoundingBox === 'function') node.geometry.computeBoundingBox();
      if (!node.geometry.boundingBox) return;

      const box = node.geometry.boundingBox.clone();
      if (node.matrixWorld && typeof box.applyMatrix4 === 'function') box.applyMatrix4(node.matrixWorld);
      bounds.union(box);
      hasBounds = true;
    });
  }

  return hasBounds ? bounds : null;
}

function createHavocPlus10Shell(renderer, group, opacity, scaleFactor, name) {
  if (!renderer || !group || typeof THREE === 'undefined') return;
  if (typeof THREE.MeshBasicMaterial !== 'function' || typeof THREE.Mesh !== 'function') return;

  const shellMaterial = new THREE.MeshBasicMaterial({
    color: HAVOC_PLUS10_VFX_CONFIG.color,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: true,
    side: THREE.DoubleSide,
  });

  if (typeof renderer.traverse !== 'function') return;

  renderer.traverse((node) => {
    if (!node || !node.isMesh || !node.geometry) return;
    if (node.userData && node.userData.havocPlus10Vfx) return;

    const shell = new THREE.Mesh(node.geometry, shellMaterial.clone());
    shell.name = name;
    shell.userData = shell.userData || {};
    shell.userData.havocPlus10Vfx = true;
    shell.userData.sourceMesh = node;
    shell.position.copy(node.position);
    shell.quaternion.copy(node.quaternion);
    shell.scale.copy(node.scale).multiplyScalar(scaleFactor);

    if (node.parent === renderer) {
      group.add(shell);
    } else if (node.matrixWorld && renderer.matrixWorld && typeof renderer.worldToLocal === 'function') {
      const worldPosition = new THREE.Vector3();
      const worldQuaternion = new THREE.Quaternion();
      const worldScale = new THREE.Vector3();
      node.getWorldPosition(worldPosition);
      node.getWorldQuaternion(worldQuaternion);
      node.getWorldScale(worldScale);
      renderer.worldToLocal(worldPosition);
      shell.position.copy(worldPosition);
      shell.quaternion.copy(worldQuaternion);
      shell.scale.copy(worldScale).multiplyScalar(scaleFactor);
      group.add(shell);
    } else {
      group.add(shell);
    }
  });
}

function createHavocPlus10Edges(renderer, group) {
  if (!renderer || !group || typeof THREE === 'undefined') return;
  if (typeof THREE.EdgesGeometry !== 'function' || typeof THREE.LineBasicMaterial !== 'function') return;
  if (typeof THREE.LineSegments !== 'function' || typeof renderer.traverse !== 'function') return;

  renderer.traverse((node) => {
    if (!node || !node.isMesh || !node.geometry) return;
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
    edges.position.copy(node.position);
    edges.quaternion.copy(node.quaternion);
    edges.scale.copy(node.scale).multiplyScalar(1.012);
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
  const baseX = size.x * 0.48;
  const baseY = size.y * 0.48;
  const baseZ = size.z * 0.48;

  for (let i = 0; i < HAVOC_PLUS10_VFX_CONFIG.particleCount; i += 1) {
    const angle = (i / HAVOC_PLUS10_VFX_CONFIG.particleCount) * Math.PI * 2;
    const radius = 0.75 + Math.random() * 0.35;
    positions.push(
      center.x + Math.cos(angle) * baseX * radius,
      center.y + (Math.random() - 0.5) * baseY * 1.6,
      center.z + Math.sin(angle) * baseZ * radius,
    );
    phases.push(Math.random() * Math.PI * 2);
    speeds.push(0.18 + Math.random() * 0.24);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));

  const material = new THREE.PointsMaterial({
    color: HAVOC_PLUS10_VFX_CONFIG.color,
    size: HAVOC_PLUS10_VFX_CONFIG.particleSize,
    transparent: true,
    opacity: 0.62,
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
  group.add(particles);
}

function createHavocPlus10Vfx(renderer) {
  if (!renderer || typeof THREE === 'undefined') return null;
  if (typeof THREE.Group !== 'function') return null;

  const group = new THREE.Group();
  group.name = HAVOC_PLUS10_VFX_CONFIG.groupName;
  group.userData = group.userData || {};
  group.userData.havocPlus10Vfx = true;
  group.userData.elapsed = 0;

  createHavocPlus10Shell(renderer, group, HAVOC_PLUS10_VFX_CONFIG.shellOpacity, 1.018, 'HavocPlus10Shell');
  createHavocPlus10Edges(renderer, group);
  createHavocPlus10Particles(renderer, group);

  if (typeof THREE.PointLight === 'function') {
    const light = new THREE.PointLight(HAVOC_PLUS10_VFX_CONFIG.lightColor, 0.7, 1.8, 2.0);
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

  const phases = particles.userData.phases || [];
  const speeds = particles.userData.speeds || [];
  const center = particles.userData.center;
  const size = particles.userData.size;
  if (!center || !size) return;

  for (let i = 0; i < position.count; i += 1) {
    const phase = phases[i] || 0;
    const speed = speeds[i] || 0.2;
    const t = (elapsed * speed + phase / (Math.PI * 2)) % 1;
    const angle = phase + elapsed * (0.55 + speed);
    const radius = 0.76 + Math.sin(phase * 1.7) * 0.08;

    position.setXYZ(
      i,
      center.x + Math.cos(angle) * size.x * radius,
      center.y + (t - 0.5) * size.y * 1.15,
      center.z + Math.sin(angle) * size.z * radius,
    );
  }

  position.needsUpdate = true;
  if (particles.material) {
    particles.material.opacity = 0.35 + pulse * 0.38;
    particles.material.size = HAVOC_PLUS10_VFX_CONFIG.particleSize * (0.85 + pulse * 0.35);
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
      child.material.opacity = 0.035 + pulse * 0.065;
      child.scale.setScalar(1.014 + pulse * 0.012);
    }

    if (child.name === 'HavocPlus10Edges' && child.material) {
      child.material.opacity = 0.18 + pulse * 0.30;
    }

    if (child.name === 'HavocPlus10Particles') {
      updateHavocPlus10Particles(child, elapsed, pulse);
    }

    if (child.name === 'HavocPlus10Light' && child.isLight) {
      child.intensity = 0.35 + pulse * 0.55;
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
