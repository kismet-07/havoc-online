/*
 * +100 Supernova presentation layer.
 *
 * The +100 effect is intentionally mesh-traced. It follows the exact shape of
 * the equipped gauntlet instead of using free-floating particles or billboard
 * sprites. All glow layers are static so the enhancement does not blink,
 * pulse, flicker, drift, or create stray particles around the character.
 *
 * The glow is built from renderer-local copies of the gauntlet meshes using
 * additive blending. Each shell is only slightly larger than the source mesh,
 * producing a compact MMORPG-style enhancement aura that traces the item.
 */
const HAVOC_PLUS100_SUPERNOVA_CONFIG = Object.freeze({
  groupName: 'HavocPlus100SupernovaVFX',
  layers: Object.freeze([
    Object.freeze({ name: 'HavocPlus100Core', scale: 1.012, opacity: 0.62, color: 0xffffffff }),
    Object.freeze({ name: 'HavocPlus100WhiteGlow', scale: 1.026, opacity: 0.46, color: 0xffffffff }),
    Object.freeze({ name: 'HavocPlus100GoldGlow', scale: 1.048, opacity: 0.34, color: 0xffffb52e }),
    Object.freeze({ name: 'HavocPlus100MagentaGlow', scale: 1.075, opacity: 0.30, color: 0xffff32b8 }),
    Object.freeze({ name: 'HavocPlus100PurpleGlow', scale: 1.105, opacity: 0.25, color: 0xff9838ff }),
    Object.freeze({ name: 'HavocPlus100BlueGlow', scale: 1.135, opacity: 0.19, color: 0xff287dff }),
    Object.freeze({ name: 'HavocPlus100RedGlow', scale: 1.165, opacity: 0.14, color: 0xffff4a24 }),
  ]),
  whiteLightIntensity: 7.5,
  whiteLightDistanceMultiplier: 2.4,
  colorLightIntensity: 3.0,
  colorLightDistanceMultiplier: 3.0,
});

function getHavocPlus100SourceMeshes(renderer) {
  const meshes = [];
  if (!renderer || typeof renderer.traverse !== 'function') return meshes;

  renderer.traverse((node) => {
    if (!node || !node.isMesh || !node.geometry) return;
    if (node.userData && (node.userData.havocPlus10Vfx || node.userData.havocPlus100Supernova)) return;
    meshes.push(node);
  });

  return meshes;
}

function getHavocPlus100RelativeMatrix(renderer, node) {
  if (!renderer || !node || typeof THREE === 'undefined' || typeof THREE.Matrix4 !== 'function') return null;

  if (typeof renderer.updateMatrixWorld === 'function') renderer.updateMatrixWorld(true);
  if (typeof node.updateMatrixWorld === 'function') node.updateMatrixWorld(true);

  if (!renderer.matrixWorld || !node.matrixWorld) return null;

  const rendererInverse = new THREE.Matrix4().copy(renderer.matrixWorld).invert();
  return rendererInverse.multiply(node.matrixWorld);
}

function getHavocPlus100Bounds(renderer) {
  if (!renderer || typeof THREE === 'undefined' || typeof THREE.Box3 !== 'function') return null;

  const bounds = new THREE.Box3();
  let hasBounds = false;

  getHavocPlus100SourceMeshes(renderer).forEach((node) => {
    if (typeof node.geometry.computeBoundingBox === 'function') node.geometry.computeBoundingBox();
    if (!node.geometry.boundingBox) return;

    const relativeMatrix = getHavocPlus100RelativeMatrix(renderer, node);
    if (!relativeMatrix) return;

    const box = node.geometry.boundingBox.clone();
    box.applyMatrix4(relativeMatrix);
    bounds.union(box);
    hasBounds = true;
  });

  return hasBounds ? bounds : null;
}

function addHavocPlus100ShellLayer(renderer, group, layer) {
  if (!renderer || !group || !layer || typeof THREE === 'undefined') return;
  if (typeof THREE.MeshBasicMaterial !== 'function' || typeof THREE.Mesh !== 'function') return;

  getHavocPlus100SourceMeshes(renderer).forEach((node) => {
    const relativeMatrix = getHavocPlus100RelativeMatrix(renderer, node);
    if (!relativeMatrix) return;

    const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    relativeMatrix.decompose(position, quaternion, scale);

    const material = new THREE.MeshBasicMaterial({
      color: layer.color,
      transparent: true,
      opacity: layer.opacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: true,
      side: THREE.DoubleSide,
      toneMapped: false,
    });

    const shell = new THREE.Mesh(node.geometry, material);
    shell.name = layer.name;
    shell.userData = shell.userData || {};
    shell.userData.havocPlus100Supernova = true;
    shell.userData.staticGlow = true;
    shell.position.copy(position);
    shell.quaternion.copy(quaternion);
    shell.scale.copy(scale).multiplyScalar(layer.scale);
    shell.renderOrder = 50;
    group.add(shell);
  });
}

function createHavocPlus100SupernovaVfx(renderer) {
  if (!renderer || typeof THREE === 'undefined' || typeof THREE.Group !== 'function') return null;

  const bounds = getHavocPlus100Bounds(renderer);
  if (!bounds) return null;

  const group = new THREE.Group();
  group.name = HAVOC_PLUS100_SUPERNOVA_CONFIG.groupName;
  group.userData = group.userData || {};
  group.userData.havocPlus100Supernova = true;
  group.userData.staticGlow = true;

  // Every layer is derived from the actual gauntlet geometry. There are no
  // particles, sprites, trails, rings, ribbons, or drifting energy objects.
  HAVOC_PLUS100_SUPERNOVA_CONFIG.layers.forEach((layer) => {
    addHavocPlus100ShellLayer(renderer, group, layer);
  });

  if (typeof THREE.PointLight === 'function') {
    const center = bounds.getCenter(new THREE.Vector3());
    const extent = bounds.getSize(new THREE.Vector3()).length();

    const whiteLight = new THREE.PointLight(
      0xffffff,
      HAVOC_PLUS100_SUPERNOVA_CONFIG.whiteLightIntensity,
      Math.max(3.5, extent * HAVOC_PLUS100_SUPERNOVA_CONFIG.whiteLightDistanceMultiplier),
      1.5,
    );
    whiteLight.name = 'HavocPlus100WhiteLight';
    whiteLight.position.copy(center);
    whiteLight.userData = whiteLight.userData || {};
    whiteLight.userData.havocPlus100Supernova = true;
    whiteLight.userData.staticGlow = true;
    group.add(whiteLight);

    const colorLight = new THREE.PointLight(
      0xff32b8,
      HAVOC_PLUS100_SUPERNOVA_CONFIG.colorLightIntensity,
      Math.max(4.5, extent * HAVOC_PLUS100_SUPERNOVA_CONFIG.colorLightDistanceMultiplier),
      1.7,
    );
    colorLight.name = 'HavocPlus100ColorLight';
    colorLight.position.copy(center);
    colorLight.userData = colorLight.userData || {};
    colorLight.userData.havocPlus100Supernova = true;
    colorLight.userData.staticGlow = true;
    group.add(colorLight);
  }

  renderer.add(group);
  return group;
}

function updateHavocPlus100SupernovaVfx(group) {
  if (!group) return;

  // Deliberately empty. The +100 glow is static by design. Keeping the update
  // boundary lets the enhancement runtime remain compatible without changing
  // opacity, scale, position, intensity, or particle state every frame.
}

function updateHavocEnhancement(runtimeScene, dt) {
  if (!runtimeScene) return;

  const gauntlet = runtimeScene.getObjects('IronGauntlet')[0] || null;
  if (!gauntlet || typeof gauntlet.get3DRendererObject !== 'function') return;

  const renderer = gauntlet.get3DRendererObject();
  if (!renderer) return;

  if (!renderer.userData) renderer.userData = {};

  let group = renderer.userData.havocPlus100SupernovaGroup || null;
  if (!group || !group.parent) {
    group = createHavocPlus100SupernovaVfx(renderer);
    renderer.userData.havocPlus100SupernovaGroup = group;
  }

  if (group) updateHavocPlus100SupernovaVfx(group);
}
