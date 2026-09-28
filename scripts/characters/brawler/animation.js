/**
 * Brawler animation helpers.
 *
 * This module owns animation names, transitions, and combat playback tuning.
 * The underlying GLB and animation names remain unchanged.
 */

function setBrawlerAnimation(player, animationName, options) {
  if (!player || !animationName) return;
  if (player.getAnimationName() !== animationName) {
    player.setAnimationName(animationName);
  }

  if (options && typeof options.speedScale === 'number' && typeof player.setAnimationSpeedScale === 'function') {
    player.setAnimationSpeedScale(options.speedScale);
  }
}

function setBrawlerCombatAnimation(player, animationName) {
  if (!player || !animationName) return;

  const speedScale = BRAWLER_CONFIG.combat.animationSpeed[animationName] || 1;
  setBrawlerAnimation(player, animationName, { speedScale });
  player.setAnimationElapsedTime(0);
}
