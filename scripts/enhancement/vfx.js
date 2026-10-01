/**
 * Enhancement presentation runtime.
 *
 * V1 +10 VFX is renderer-local and procedural. It does not modify the
 * equipment mesh, its transform, or the attachment system.
 */
const HAVOC_PLUS10_VFX_CONFIG = Object.freeze({
  itemObjectName: 'IronGauntlet',
  groupName: 'HavocPlus10VFX',
  color: 0xffc94a,
  lightColor: 0xffb300,
  baseOpacity: 0.48,
  pulseSpeed: 3.5,
});

function getHavocPlus10VfxScale(renderer) {
  if (!renderer || typeof THREE === 'undefined' || typeof THREE.Box3 !== 'function') return 1;

  const bounds = new THREE.Box3();
  let hasBounds = false;

  if (typeof renderer.traverse === 'function') {
    renderer.traverse((node) => {
      if (!node || !node.isMesh || !node.geometry) return;
      if (typeof node.geometry.computeBoundingBox === 'function') node.geometry.computeBoundingBox();
      if (!node.geometry.boundingBox) return;
      bounds.union(node.geometry.boundingBox);
      hasBounds = true;
    });
  }

  if (!hasBounds) return 1;
  const size = new THREE.Vector3();
  bounds.getSize(size);
  return Math.max(0.25, Math.max(size.x, size.z) * 0.9);
}

function createHavocPlus10Vfx(renderer) {
  if (!renderer || typeof THREE === 'undefined') return null;
  if (typeof THREE.Group !== 'function' || typeof THREE.TorusGeometry !== 'function') return null;
  if (typeof THREE.MeshBasicMaterial !== 'function' || typeof THREE.Mesh !== 'function') return null;

  const group = new THREE.Group();
  group.name = HAVOC_PLUS10_VFX_CONFIG.groupName;
  group.userData = group.userData || {};
  group.userData.havocPlus10Vfx = true;
  group.userData.elapsed = 0;
  group.userData.previousScalePulse = 1;

  const scale = getHavocPlus10VfxScale(renderer);
  group.scale.setScalar(scale);

  const ringGeometry = new THREE.TorusGeometry(0.42, 0.035, 8, 32);
  const ringOffsets = [-0.28, 0, 0.28];

  ringOffsets.forEach((offset, index) => {
    const material = new THREE.MeshBasicMaterial({
      color: HAVOC_PLUS10_VFX_CONFIG.color,
      transparent: true,
      opacity: HAVOC_PLUS10_VFX_CONFIG.baseOpacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: true,
    });
    const ring = new THREE.Mesh(ringGeometry, material);
    ring.name = `HavocPlus10Ring${index + 1}`;
    ring.position.y = offset;
    ring.rotation.x = index % 2 === 0 ? 0 : Math.PI * 0.5;
    ring.userData.phase = index * 0.8;
    group.add(ring);
  });

  if (typeof THREE.SphereGeometry === 'function') {
    const auraMaterial = new THREE.MeshBasicMaterial({
      color: HAVOC_PLUS10_VFX_CONFIG.color,
      transparent: true,
      opacity: 0.055,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: true,
    });
    const aura = new THREE.Mesh(new THREE.SphereGeometry(0.52, 16, 12), auraMaterial);
    aura.name = 'HavocPlus10Aura';
    aura.userData.phase = 1.7;
    group.add(aura);
  }

  if (typeof THREE.PointLight === 'function') {
    const light = new THREE.PointLight(HAVOC_PLUS10_VFX_CONFIG.lightColor, 0.8, 3.0, 2.0);
    light.name = 'HavocPlus10Light';
    group.add(light);
  }

  renderer.add(group);
  return group;
}

function updateHavocPlus10Vfx(group, dt) {
  if (!group) return;

  const delta = Math.max(0, Number(dt) || 0);
  group.userData.elapsed = (group.userData.elapsed || 0) + delta;
  const elapsed = group.userData.elapsed;
  const pulse = 0.5 + 0.5 * Math.sin(elapsed * HAVOC_PLUS10_VFX_CONFIG.pulseSpeed);
  const scalePulse = 1 + pulse * 0.08;

  group.scale.multiplyScalar(scalePulse / (group.userData.previousScalePulse || 1));
  group.userData.previousScalePulse = scalePulse;
  group.rotation.y = elapsed * 0.55;
  group.rotation.z = Math.sin(elapsed * 1.7) * 0.08;

  group.children.forEach((child) => {
    if (!child) return;
    const phase = Number(child.userData && child.userData.phase) || 0;
    const wave = 0.5 + 0.5 * Math.sin(elapsed * HAVOC_PLUS10_VFX_CONFIG.pulseSpeed + phase);

    if (child.isMesh && child.material && 'opacity' in child.material) {
      if (child.name === 'HavocPlus10Aura') {
        child.material.opacity = 0.035 + wave * 0.045;
        child.scale.setScalar(1 + wave * 0.10);
      } else {
        child.material.opacity = 0.25 + wave * 0.35;
        child.rotation.y += delta * (0.8 + phase * 0.2);
      }
    }

    if (child.isLight) child.intensity = 0.45 + wave * 0.55;
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
