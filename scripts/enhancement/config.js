/**
 * Enhancement data model.
 *
 * Gameplay-independent enhancement definitions only.
 */
const HAVOC_ENHANCEMENT_CONFIG = Object.freeze({
  minLevel: 0,
  maxLevel: 50,
  allowedLevels: Object.freeze([0, 10, 25, 40, 50]),
});

function normalizeHavocEnhancementLevel(level) {
  const numericLevel = Number(level);
  if (!Number.isFinite(numericLevel)) return 0;
  return Math.max(
    HAVOC_ENHANCEMENT_CONFIG.minLevel,
    Math.min(HAVOC_ENHANCEMENT_CONFIG.maxLevel, Math.trunc(numericLevel)),
  );
}

function createHavocEnhancementState(level = 0) {
  return Object.freeze({
    level: normalizeHavocEnhancementLevel(level),
  });
}

function isHavocEnhancementLevelSupported(level) {
  return HAVOC_ENHANCEMENT_CONFIG.allowedLevels.includes(
    normalizeHavocEnhancementLevel(level),
  );
}
