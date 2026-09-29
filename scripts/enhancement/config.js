/**
 * Enhancement presentation configuration.
 *
 * Phase 2 prototype only. This does not change character stats, damage,
 * inventory, equipment ownership, or server state.
 */
const HAVOC_ENHANCEMENT_CONFIG = {
  objectName: 'Character',
  testLevel: 10,
  enabled: true,
  leftHandBone: 'mixamorig:LeftHand',
  rightHandBone: 'mixamorig:RightHand',
  pulseSpeed: 2.4,
  pulseAmount: 0.12,
  auraRadius: 16,
  auraSegments: 16,
  ringRadius: 20,
  ringTube: 2.2,
  ringSegments: 16,
  color: 0x33aaff,
  opacity: 0.42,
  coreOpacity: 0.72,
};

const HAVOC_ENHANCEMENT_LEVELS = {
  0: null,
  10: {
    color: HAVOC_ENHANCEMENT_CONFIG.color,
    auraRadius: HAVOC_ENHANCEMENT_CONFIG.auraRadius,
    ringRadius: HAVOC_ENHANCEMENT_CONFIG.ringRadius,
    opacity: HAVOC_ENHANCEMENT_CONFIG.opacity,
    coreOpacity: HAVOC_ENHANCEMENT_CONFIG.coreOpacity,
  },
};

function getHavocEnhancementProfile(level) {
  const numericLevel = Number(level);
  if (!Number.isFinite(numericLevel) || numericLevel <= 0) return null;
  return HAVOC_ENHANCEMENT_LEVELS[numericLevel] || HAVOC_ENHANCEMENT_LEVELS[10];
}

// Phase 2 prototype verified against Brawler_inplace.glb hand-bone names.
