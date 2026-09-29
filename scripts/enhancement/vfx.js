/**
 * Runtime enhancement VFX prototype.
 *
 * The effect attaches to the Brawler's animated hand bones. It deliberately
 * uses lightweight Three.js geometry and MeshBasicMaterial so this first
 * milestone does not depend on post-processing or bloom support.
 */
function initializeHavocEnhancement(runtimeScene) {
  if (!runtimeScene.__havocEnhancement) {
    runtimeScene.__havocEnhancement = {
      rootObject: null,
      leftEffect: null,
      rightEffect: null,
      level: HAVOC_ENHANCEMENT_CONFIG.testLevel,
      elapsed: 0,
      initialized: false,
      warningLogged: false,
    };
  }
  return runtimeScene.__havocEnhancement;
}

function createHavocHandEnhancement(profile) {
  if (typeof THREE === 'undefined') return null;
  if (typeof THREE.Group !== 'function' || typeof THREE.Mesh !== 'function') return null;

  const group = new THREE.Group();
  group.name = 'HavocEnhancementHandVFX';

  const coreGeometry = new THREE.SphereGeometry(profile.auraRadius * 0.42, profile.auraSegments, profile.auraSegments);
  const coreMaterial = new THREE.MeshBasicMaterial({
    color: profile.color,
    transparent: true,
    opacity: profile.coreOpacity,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const core = new THREE.Mesh(coreGeometry, coreMaterial);
  core.name = 'HavocEnhancementCore';
  group.add(core);

  const auraGeometry = new THREE.SphereGeometry(profile.auraRadius, profile.auraSegments, profile.auraSegments);
  const auraMaterial = new THREE.MeshBasicMaterial({
    color: profile.color,
    transparent: true,
    opacity: profile.opacity,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const aura = new THREE.Mesh(auraGeometry, auraMaterial);
  aura.name = 'HavocEnhancementAura';
  group.add(aura);

  const ringGeometry = new THREE.TorusGeometry(profile.ringRadius, profile.ringTube, 8, profile.ringSegments);
  const ringMaterial = new THREE.MeshBasicMaterial({
    color: profile.color,
    transparent: true,
    opacity: profile.opacity,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const ringA = new THREE.Mesh(ringGeometry, ringMaterial.clone());
  const ringB = new THREE.Mesh(ringGeometry, ringMaterial.clone());
  const ringC = new THREE.Mesh(ringGeometry, ringMaterial.clone());
  ringA.name = 'HavocEnhancementRingA';
  ringB.name = 'HavocEnhancementRingB';
  ringC.name = 'HavocEnhancementRingC';
  ringB.rotation.x = Math.PI / 2;
  ringC.rotation.y = Math.PI / 2;
  group.add(ringA, ringB, ringC);

  return { group, core, aura, rings: [ringA, ringB, ringC] };
}

function findHavocBone(root, boneName) {
  if (!root || typeof root.getObjectByName !== 'function') return null;
  return root.getObjectByName(boneName) || null;
}

function attachHavocEnhancementToBone(root, boneName, profile) {
  const bone = findHavocBone(root, boneName);
  if (!bone) return null;
  const effect = createHavocHandEnhancement(profile);
  if (!effect) return null;
  bone.add(effect.group);
  effect.group.position.set(0, 0, 0);
  effect.group.rotation.set(0, 0, 0);
  return { bone, ...effect };
}

function disposeHavocEnhancementEffect(effect) {
  if (!effect) return;
  if (effect.group && effect.group.parent) effect.group.parent.remove(effect.group);
  if (!effect.group || typeof effect.group.traverse !== 'function') return;
  effect.group.traverse((child) => {
    if (child.geometry && typeof child.geometry.dispose === 'function') child.geometry.dispose();
    if (!child.material) return;
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    for (const material of materials) {
      if (material && typeof material.dispose === 'function') material.dispose();
    }
  });
}

function setupHavocEnhancement(runtimeScene, player) {
  const state = initializeHavocEnhancement(runtimeScene);
  const profile = getHavocEnhancementProfile(state.level);
  if (!HAVOC_ENHANCEMENT_CONFIG.enabled || !profile || !player) return state;
  if (typeof player.get3DRendererObject !== 'function') return state;

  const root = player.get3DRendererObject();
  if (!root) return state;
  if (state.initialized && state.rootObject === root) return state;

  disposeHavocEnhancementEffect(state.leftEffect);
  disposeHavocEnhancementEffect(state.rightEffect);

  state.leftEffect = attachHavocEnhancementToBone(root, HAVOC_ENHANCEMENT_CONFIG.leftHandBone, profile);
  state.rightEffect = attachHavocEnhancementToBone(root, HAVOC_ENHANCEMENT_CONFIG.rightHandBone, profile);
  state.rootObject = root;
  state.initialized = !!(state.leftEffect || state.rightEffect);

  if (!state.initialized && !state.warningLogged) {
    state.warningLogged = true;
    console.warn('[Havoc Enhancement] Unable to find Brawler hand bones or create VFX.');
  }

  if (state.initialized) {
    console.log('[Havoc Enhancement] +10 hand VFX attached.', {
      leftHand: !!state.leftEffect,
      rightHand: !!state.rightEffect,
      leftBone: HAVOC_ENHANCEMENT_CONFIG.leftHandBone,
      rightBone: HAVOC_ENHANCEMENT_CONFIG.rightHandBone,
    });
  }
  return state;
}

function updateHavocHandEnhancement(effect, elapsed) {
  if (!effect || !effect.group) return;
  const pulse = 1 + Math.sin(elapsed * HAVOC_ENHANCEMENT_CONFIG.pulseSpeed) * HAVOC_ENHANCEMENT_CONFIG.pulseAmount;
  const slowPulse = 1 + Math.sin(elapsed * HAVOC_ENHANCEMENT_CONFIG.pulseSpeed * 0.65) * (HAVOC_ENHANCEMENT_CONFIG.pulseAmount * 0.55);
  effect.core.scale.setScalar(pulse);
  effect.aura.scale.setScalar(slowPulse);
  effect.rings[0].rotation.z += 0.018;
  effect.rings[1].rotation.z -= 0.024;
  effect.rings[2].rotation.z += 0.031;
}

function updateHavocEnhancement(runtimeScene, dt) {
  const player = runtimeScene.getObjects(HAVOC_ENHANCEMENT_CONFIG.objectName)[0];
  if (!player) return;
  const state = setupHavocEnhancement(runtimeScene, player);
  if (!state.initialized) return;
  const safeDt = Number.isFinite(dt) && dt > 0 ? Math.min(dt, 0.1) : 0;
  state.elapsed += safeDt;
  updateHavocHandEnhancement(state.leftEffect, state.elapsed);
  updateHavocHandEnhancement(state.rightEffect, state.elapsed);
}
