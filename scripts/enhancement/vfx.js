/**
 * Enhancement presentation runtime.
 *
 * +10 is intentionally a heavy MMORPG-style enhancement effect: layered
 * emissive shells, hot edge highlights, thick animated plasma ribbons,
 * saturated sparks, and a pulsing local light source.
 *
 * Everything is renderer-local. The equipment mesh, attachment transform,
 * and skeleton are never modified by the enhancement presentation.
 */
const HAVOC_PLUS10_VFX_CONFIG = Object.freeze({
  itemObjectName: 'IronGauntlet',
  groupName: 'HavocPlus10VFX',
  coreColor: 0xffb52a,
  hotColor: 0xffffdf,
  colors: [0xff7a18ff, 0xff168cff, 0xffff2f9a, 0xffff7a18, 0xffffc83d],
  shellOpacity: 0.11,
  edgeOpacity: 0.62,
  pulseSpeed: 4.8,
  particleCount: 64,
  particleSize: 0.065,
  ribbonCount: 5,
  ribbonTubeRadius: 0.028,
  ribbonSegments: 56,
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
      if (node && node.isMesh && node.geometry && !(node.userData && node.userData.havocPlus10Vfx)) {
        meshes.push(node);
      }
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

function createHavocPlus10ShellLayer(renderer, group, opacity, scaleFactor, color) {
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

    const edgesGeometry = new THREE.EdgesGeometry(node.geometry, 20);
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
    edges.userData.baseOpacity = HAVOC_PLUS10_VFX_CONFIG.edgeOpacity;
    edges.position.copy(position);
    edges.quaternion.copy(quaternion);
    edges.scale.copy(scale).multiplyScalar(1.012);
    group.add(edges);
  });
}

function createHavocPlus10Ribbons(renderer, group, bounds) {
  if (!renderer || !group || !bounds || typeof THREE === 'undefined') return;
  if (typeof THREE.Group !== 'function' || typeof THREE.CatmullRomCurve3 !== 'function') return;
  if (typeof THREE.TubeGeometry !== 'function' || typeof THREE.MeshBasicMaterial !== 'function') return;
  if (typeof THREE.Mesh !== 'function') return;

  const center = bounds.getCenter(new THREE.Vector3());
  const size = bounds.getSize(new THREE.Vector3());
  const height = Math.max(size.y, size.x, size.z);
  const radius = Math.max(size.x, size.z) * 0.62;
  if (!Number.isFinite(height) || !Number.isFinite(radius) || height <= 0 || radius <= 0) return;

  const ribbonGroup = new THREE.Group();
  ribbonGroup.name = 'HavocPlus10Ribbons';
  ribbonGroup.userData.havocPlus10Vfx = true;
  ribbonGroup.position.copy(center);
  group.add(ribbonGroup);

  for (let i = 0; i < HAVOC_PLUS10_VFX_CONFIG.ribbonCount; i += 1) {
    const points = [];
    const phase = (i / HAVOC_PLUS10_VFX_CONFIG.ribbonCount) * Math.PI * 2;
    const turns = 1.35 + (i % 3) * 0.22;
    const pointCount = 30;

    for (let p = 0; p < pointCount; p += 1) {
      const t = p / (pointCount - 1);
      const angle = phase + t * Math.PI * 2 * turns;
      const wobble = 1 + Math.sin(t * Math.PI * 5 + phase) * 0.11;
      const y = (t - 0.5) * height * 1.18;
      const r = radius * wobble * (0.92 + 0.12 * Math.sin(t * Math.PI));

      points.push(new THREE.Vector3(
        Math.cos(angle) * r,
        y,
        Math.sin(angle) * r,
      ));
    }

    const curve = new THREE.CatmullRomCurve3(points);
    const geometry = new THREE.TubeGeometry(
      curve,
      HAVOC_PLUS10_VFX_CONFIG.ribbonSegments,
      HAVOC_PLUS10_VFX_CONFIG.ribbonTubeRadius,
      7,
      false,
    );

    const color = HAVOC_PLUS10_VFX_CONFIG.colors[i % HAVOC_PLUS10_VFX_CONFIG.colors.length];
    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.82,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: true,
    });

    const ribbon = new THREE.Mesh(geometry, material);
    ribbon.name = 'HavocPlus10Ribbon';
    ribbon.userData = ribbon.userData || {};
    ribbon.userData.havocPlus10Vfx = true;
    ribbon.userData.baseOpacity = 0.82;
    ribbon.userData.phase = phase;
    ribbonGroup.add(ribbon);

    const glowGeometry = new THREE.TubeGeometry(
      curve,
      HAVOC_PLUS10_VFX_CONFIG.ribbonSegments,
      HAVOC_PLUS10_VFX_CONFIG.ribbonTubeRadius * 2.6,
      7,
      false,
    );
    const glowMaterial = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.18,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: true,
    });
    const glow = new THREE.Mesh(glowGeometry, glowMaterial);
    glow.name = 'HavocPlus10RibbonGlow';
    glow.userData = glow.userData || {};
    glow.userData.havocPlus10Vfx = true;
    glow.userData.baseOpacity = 0.18;
    glow.userData.phase = phase;
    ribbonGroup.add(glow);
  }
}

function createHavocPlus10Particles(renderer, group, bounds) {
  if (!renderer || !group || !bounds || typeof THREE === 'undefined') return;
  if (typeof THREE.BufferGeometry !== 'function' || typeof THREE.Float32BufferAttribute !== 'function') return;
  if (typeof THREE.PointsMaterial !== 'function' || typeof THREE.Points !== 'function') return;

  const center = bounds.getCenter(new THREE.Vector3());
  const size = bounds.getSize(new THREE.Vector3());
  const positions = [];
  const phases = [];
  const speeds = [];
  const radii = [];

  for (let i = 0; i < HAVOC_PLUS10_VFX_CONFIG.particleCount; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const radius = 0.78 + Math.random() * 0.52;
    const vertical = (Math.random() - 0.5) * 1.3;

    positions.push(
      center.x + Math.cos(angle) * Math.max(size.x, size.z) * 0.5 * radius,
      center.y + vertical * size.y,
      center.z + Math.sin(angle) * Math.max(size.x, size.z) * 0.5 * radius,
    );
    phases.push(Math.random() * Math.PI * 2);
    speeds.push(0.18 + Math.random() * 0.42);
    radii.push(radius);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));

  const material = new THREE.PointsMaterial({
    color: HAVOC_PLUS10_VFX_CONFIG.hotColor,
    size: HAVOC_PLUS10_VFX_CONFIG.particleSize,
    transparent: true,
    opacity: 0.78,
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

  const bounds = getHavocPlus10VfxBounds(renderer);
  if (!bounds) return null;

  const group = new THREE.Group();
  group.name = HAVOC_PLUS10_VFX_CONFIG.groupName;
  group.userData = group.userData || {};
  group.userData.havocPlus10Vfx = true;
  group.userData.elapsed = 0;

  createHavocPlus10ShellLayer(renderer, group, HAVOC_PLUS10_VFX_CONFIG.shellOpacity, 1.018, HAVOC_PLUS10_VFX_CONFIG.coreColor);
  createHavocPlus10ShellLayer(renderer, group, 0.075, 1.045, HAVOC_PLUS10_VFX_CONFIG.colors[3]);
  createHavocPlus10ShellLayer(renderer, group, 0.045, 1.075, HAVOC_PLUS10_VFX_CONFIG.colors[0]);
  createHavocPlus10Edges(renderer, group);
  createHavocPlus10Ribbons(renderer, group, bounds);
  createHavocPlus10Particles(renderer, group, bounds);

  if (typeof THREE.PointLight === 'function') {
    const light = new THREE.PointLight(0xffb52a, 1.5, Math.max(2.4, bounds.getSize(new THREE.Vector3()).length() * 1.8), 2.0);
    light.name = 'HavocPlus10Light';
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
  const phases = particles.userData.phases || [];
  const speeds = particles.userData.speeds || [];
  const radii = particles.userData.radii || [];
  if (!center || !size) return;

  for (let i = 0; i < position.count; i += 1) {
    const phase = phases[i] || 0;
    const speed = speeds[i] || 0.2;
    const radius = radii[i] || 0.85;
    const travel = (elapsed * speed + phase / (Math.PI * 2)) % 1;
    const angle = phase + elapsed * (0.55 + speed * 0.85);

    position.setXYZ(
      i,
      center.x + Math.cos(angle) * Math.max(size.x, size.z) * 0.5 * radius,
      center.y + (travel - 0.5) * size.y * 1.25,
      center.z + Math.sin(angle) * Math.max(size.x, size.z) * 0.5 * radius,
    );
  }

  position.needsUpdate = true;
  if (particles.material) {
    particles.material.opacity = 0.45 + pulse * 0.5;
    particles.material.size = HAVOC_PLUS10_VFX_CONFIG.particleSize * (0.9 + pulse * 0.55);
  }
}

function updateHavocPlus10Vfx(group, dt) {
  if (!group) return;

  const delta = Math.max(0, Number(dt) || 0);
  group.userData.elapsed = (group.userData.elapsed || 0) + delta;
  const elapsed = group.userData.elapsed;
  const pulse = 0.5 + 0.5 * Math.sin(elapsed * HAVOC_PLUS10_VFX_CONFIG.pulseSpeed);
  const flare = 0.5 + 0.5 * Math.sin(elapsed * 9.0 + 1.2);

  group.children.forEach((child) => {
    if (!child) return;

    if (child.name === 'HavocPlus10Shell' && child.material) {
      const base = child.userData.baseOpacity || 0.05;
      child.material.opacity = base * (0.72 + pulse * 0.95);
    }

    if (child.name === 'HavocPlus10Edges' && child.material) {
      child.material.opacity = HAVOC_PLUS10_VFX_CONFIG.edgeOpacity * (0.68 + pulse * 0.85);
    }

    if (child.name === 'HavocPlus10Particles') {
      updateHavocPlus10Particles(child, elapsed, pulse);
    }

    if (child.name === 'HavocPlus10Ribbons') {
      child.rotation.y = elapsed * 0.34;
      child.rotation.z = Math.sin(elapsed * 0.8) * 0.08;
      child.children.forEach((ribbon) => {
        if (!ribbon || !ribbon.material) return;
        const phase = ribbon.userData && Number.isFinite(ribbon.userData.phase) ? ribbon.userData.phase : 0;
        const localPulse = 0.72 + 0.55 * (0.5 + 0.5 * Math.sin(elapsed * 5.5 + phase));
        const base = ribbon.userData.baseOpacity || 0.18;
        ribbon.material.opacity = base * localPulse;
        if (ribbon.name === 'HavocPlus10RibbonGlow') {
          ribbon.scale.setScalar(1.0 + flare * 0.08);
        }
      });
    }

    if (child.name === 'HavocPlus10Light' && child.isLight) {
      child.intensity = 0.85 + pulse * 1.65 + flare * 0.7;
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
