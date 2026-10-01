/*
 * +100 Supernova presentation layer.
 *
 * The effect is intentionally compact around the gauntlet. It uses a thick
 * volumetric MMORPG-style aura made from overlapping additive radial sprites,
 * a saturated white core, dense sparks, and colored energy clouds. It must
 * read as energy surrounding the equipment, not as a large world-space
 * explosion.
 */
const HAVOC_PLUS100_SUPERNOVA_CONFIG = Object.freeze({
  cloudCount: 78,
  sparkCount: 180,
  coreCount: 18,
  pulseSpeed: 5.2,
  cloudOpacity: 0.72,
  sparkOpacity: 0.92,
  colors: Object.freeze([
    0xffff2d92,
    0xff9b32ff,
    0xff286cff,
    0xffff4a1c,
    0xffffa51f,
    0xffffd84a,
    0xffffffff,
  ]),
});

function havocPlus100SpriteTexture() {
  if (typeof document === 'undefined' || typeof THREE === 'undefined') return null;
  if (typeof THREE.CanvasTexture !== 'function') return null;

  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.12, 'rgba(255,255,255,0.98)');
  gradient.addColorStop(0.30, 'rgba(255,255,255,0.72)');
  gradient.addColorStop(0.55, 'rgba(255,255,255,0.25)');
  gradient.addColorStop(0.78, 'rgba(255,255,255,0.07)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 128);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

function createHavocPlus100SupernovaVfx(renderer) {
  if (!renderer || typeof THREE === 'undefined' || typeof THREE.Group !== 'function') return null;
  if (typeof THREE.Sprite !== 'function' || typeof THREE.SpriteMaterial !== 'function') return null;
  if (typeof getHavocPlus10VfxBounds !== 'function') return null;

  const bounds = getHavocPlus10VfxBounds(renderer);
  if (!bounds) return null;

  const texture = havocPlus100SpriteTexture();
  if (!texture) return null;

  const group = new THREE.Group();
  group.name = 'HavocPlus100SupernovaVFX';
  group.userData = group.userData || {};
  group.userData.havocPlus100Supernova = true;
  group.userData.elapsed = 0;
  group.userData.texture = texture;
  group.userData.baseCenter = bounds.getCenter(new THREE.Vector3());
  group.userData.baseSize = bounds.getSize(new THREE.Vector3());

  const center = group.userData.baseCenter;
  const size = group.userData.baseSize;
  const extent = Math.max(size.x, size.y, size.z);

  // Keep the entire energy mass tightly wrapped around the gauntlet.
  const radialX = Math.max(size.x, size.z) * 0.34;
  const radialZ = Math.max(size.x, size.z) * 0.34;
  const vertical = Math.max(size.y * 0.46, extent * 0.38);

  // Saturated central energy mass. These overlap heavily so the result reads
  // as a bright compact volume instead of a large radial explosion.
  for (let i = 0; i < HAVOC_PLUS100_SUPERNOVA_CONFIG.coreCount; i += 1) {
    const material = new THREE.SpriteMaterial({
      map: texture,
      color: HAVOC_PLUS100_SUPERNOVA_CONFIG.colors[6],
      transparent: true,
      opacity: 0.28 + Math.random() * 0.22,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false,
    });
    const sprite = new THREE.Sprite(material);
    const scale = extent * (0.34 + Math.random() * 0.28);
    sprite.position.set(
      center.x + (Math.random() - 0.5) * radialX * 0.70,
      center.y + (Math.random() - 0.5) * vertical * 0.70,
      center.z + (Math.random() - 0.5) * radialZ * 0.70,
    );
    sprite.scale.set(scale, scale * (1.05 + Math.random() * 0.45), 1);
    sprite.renderOrder = 55;
    sprite.userData = {
      havocPlus100Supernova: true,
      kind: 'core',
      baseScale: scale,
      phase: Math.random() * Math.PI * 2,
      speed: 0.8 + Math.random() * 1.2,
      baseOpacity: material.opacity,
    };
    group.add(sprite);
  }

  // Compact colored cloud. Keep the sprites close to the gauntlet.
  for (let i = 0; i < HAVOC_PLUS100_SUPERNOVA_CONFIG.cloudCount; i += 1) {
    const color = HAVOC_PLUS100_SUPERNOVA_CONFIG.colors[i % 6];
    const material = new THREE.SpriteMaterial({
      map: texture,
      color,
      transparent: true,
      opacity: HAVOC_PLUS100_SUPERNOVA_CONFIG.cloudOpacity * (0.48 + Math.random() * 0.52),
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false,
    });
    const sprite = new THREE.Sprite(material);
    const edge = 0.22 + Math.random() * 0.34;
    const scale = extent * (0.16 + Math.random() * 0.24) * (0.88 + edge * 0.40);
    sprite.position.set(
      center.x + (Math.random() * 2 - 1) * radialX * edge,
      center.y + (Math.random() * 2 - 1) * vertical * edge,
      center.z + (Math.random() * 2 - 1) * radialZ * edge,
    );
    sprite.scale.set(scale * (0.72 + Math.random() * 0.60), scale * (0.82 + Math.random() * 0.82), 1);
    sprite.renderOrder = 50;
    sprite.userData = {
      havocPlus100Supernova: true,
      kind: 'cloud',
      baseScale: scale,
      phase: Math.random() * Math.PI * 2,
      speed: 0.25 + Math.random() * 0.65,
      driftX: (Math.random() - 0.5) * extent * 0.035,
      driftY: (Math.random() - 0.5) * extent * 0.045,
      driftZ: (Math.random() - 0.5) * extent * 0.035,
      baseOpacity: material.opacity,
    };
    group.add(sprite);
  }

  // Compact explosive sparks. They remain close to the gauntlet instead of
  // forming a large particle field around the character.
  for (let i = 0; i < HAVOC_PLUS100_SUPERNOVA_CONFIG.sparkCount; i += 1) {
    const color = HAVOC_PLUS100_SUPERNOVA_CONFIG.colors[i % 6];
    const material = new THREE.SpriteMaterial({
      map: texture,
      color,
      transparent: true,
      opacity: HAVOC_PLUS100_SUPERNOVA_CONFIG.sparkOpacity * (0.55 + Math.random() * 0.45),
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false,
    });
    const sprite = new THREE.Sprite(material);
    const angle = Math.random() * Math.PI * 2;
    const radius = Math.max(size.x, size.z) * (0.34 + Math.random() * 0.52);
    const sparkSize = extent * (0.018 + Math.random() * 0.045);
    sprite.position.set(
      center.x + Math.cos(angle) * radius,
      center.y + (Math.random() - 0.5) * size.y * 0.95,
      center.z + Math.sin(angle) * radius,
    );
    sprite.scale.setScalar(sparkSize);
    sprite.renderOrder = 65;
    sprite.userData = {
      havocPlus100Supernova: true,
      kind: 'spark',
      baseScale: sparkSize,
      phase: Math.random() * Math.PI * 2,
      speed: 0.45 + Math.random() * 1.8,
      baseOpacity: material.opacity,
    };
    group.add(sprite);
  }

  if (typeof THREE.PointLight === 'function') {
    const white = new THREE.PointLight(0xffffff, 16, Math.max(8, extent * 5), 1.25);
    white.name = 'HavocPlus100WhiteLight';
    white.position.copy(center);
    white.userData = { havocPlus100Supernova: true, kind: 'light', baseIntensity: 16 };
    group.add(white);

    const magenta = new THREE.PointLight(0xff3bc7, 8, Math.max(10, extent * 6), 1.45);
    magenta.name = 'HavocPlus100ColorLight';
    magenta.position.copy(center);
    magenta.userData = { havocPlus100Supernova: true, kind: 'light', baseIntensity: 8 };
    group.add(magenta);
  }

  renderer.add(group);
  return group;
}

function updateHavocPlus100SupernovaVfx(group, dt) {
  if (!group || !group.userData) return;
  const delta = Math.max(0, Number(dt) || 0);
  group.userData.elapsed += delta;

  const elapsed = group.userData.elapsed;
  const pulse = 0.5 + 0.5 * Math.sin(elapsed * HAVOC_PLUS100_SUPERNOVA_CONFIG.pulseSpeed);
  const flash = 0.5 + 0.5 * Math.sin(elapsed * 17.0);

  group.children.forEach((child) => {
    if (!child || !child.userData || !child.userData.havocPlus100Supernova) return;

    if (child.userData.kind === 'cloud' || child.userData.kind === 'core') {
      const data = child.userData;
      const phase = data.phase || 0;
      const speed = data.speed || 0.5;
      const breathe = 1 + Math.sin(elapsed * speed + phase) * (data.kind === 'core' ? 0.12 : 0.18);
      const drift = data.kind === 'cloud' ? 1 : 0.45;
      const baseScale = data.baseScale || 1;
      child.scale.x = baseScale * breathe;
      child.scale.y = baseScale * breathe;
      if (data.kind === 'cloud') {
        child.position.x += Math.sin(elapsed * speed + phase) * data.driftX * delta * drift;
        child.position.y += Math.cos(elapsed * speed * 0.83 + phase) * data.driftY * delta * drift;
        child.position.z += Math.sin(elapsed * speed * 0.71 + phase) * data.driftZ * delta * drift;
      }
      if (child.material) {
        const baseOpacity = Number(data.baseOpacity) || 0.4;
        child.material.opacity = baseOpacity * (0.72 + pulse * 0.72 + flash * (data.kind === 'core' ? 0.65 : 0.20));
      }
    }

    if (child.userData.kind === 'spark') {
      const data = child.userData;
      const flicker = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(elapsed * data.speed * 12 + data.phase));
      const scale = data.baseScale * (0.55 + flicker * 1.55);
      child.scale.setScalar(scale);
      if (child.material) child.material.opacity = data.baseOpacity * flicker;
    }

    if (child.userData.kind === 'light') {
      child.intensity = child.userData.baseIntensity * (0.70 + pulse * 0.95 + flash * 0.40);
    }
  });
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

  if (group) updateHavocPlus100SupernovaVfx(group, dt);
}
