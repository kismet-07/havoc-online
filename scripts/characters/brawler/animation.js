/**
 * Brawler animation helpers.
 *
 * This module owns animation names, transitions, and combat playback tuning.
 * Locomotion uses the Walk/Run clips from the Brawler GLB.
 */

function setBrawlerAnimation(player, animationName, options) {
  if (!player || !animationName) return;

  const currentAnimation = player.getAnimationName();

  if (currentAnimation !== animationName) {
    player.setAnimationName(animationName);
    if (typeof player.setAnimationElapsedTime === 'function') {
      player.setAnimationElapsedTime(0);
    }
  } else if (
    (animationName === BRAWLER_CONFIG.animations.walk ||
     animationName === BRAWLER_CONFIG.animations.run) &&
    typeof player.hasAnimationEnded === 'function' &&
    player.hasAnimationEnded() &&
    typeof player.setAnimationElapsedTime === 'function'
  ) {
    player.setAnimationElapsedTime(0);
  }

  if (
    options &&
    typeof options.speedScale === 'number' &&
    typeof player.setAnimationSpeedScale === 'function'
  ) {
    player.setAnimationSpeedScale(options.speedScale);
  }
}

function setBrawlerIdlePose(player) {
  if (!player) return;

  const idleAnimation = BRAWLER_CONFIG.animations.idle;

  if (player.getAnimationName() !== idleAnimation) {
    player.setAnimationName(idleAnimation);
  }

  if (typeof player.setAnimationSpeedScale === 'function') {
    player.setAnimationSpeedScale(1);
  }

  if (typeof player.setAnimationElapsedTime === 'function') {
    player.setAnimationElapsedTime(0);
  }
}

function setBrawlerCombatAnimation(player, animationName) {
  if (!player || !animationName) return;

  const speedScale = BRAWLER_CONFIG.combat.animationSpeed[animationName] || 1;
  setBrawlerAnimation(player, animationName, { speedScale });
  player.setAnimationElapsedTime(0);
}
