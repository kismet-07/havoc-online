/**
 * Brawler animation helpers.
 *
 * This module owns animation names, transitions, and combat playback tuning.
 * Locomotion uses the Walk/Run clips from the Brawler GLB when those clips
 * are present in the model configuration.
 */

function setBrawlerAnimation(player, animationName, options) {
  if (!player || !animationName) return false;

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

  return player.getAnimationName() === animationName;
}

function setBrawlerIdlePose(player) {
  if (!player) return false;

  const idleAnimation = BRAWLER_CONFIG.animations.idle;

  if (player.getAnimationName() !== idleAnimation) {
    player.setAnimationName(idleAnimation);
    if (typeof player.setAnimationElapsedTime === 'function') {
      player.setAnimationElapsedTime(0);
    }
  }

  if (typeof player.setAnimationSpeedScale === 'function') {
    player.setAnimationSpeedScale(1);
  }

  // Do NOT reset elapsed time every frame. Doing that freezes the idle clip
  // on its first frame and makes it appear that model animation is broken.
  return player.getAnimationName() === idleAnimation;
}

function setBrawlerCombatAnimation(player, animationName) {
  if (!player || !animationName) return false;

  const speedScale = BRAWLER_CONFIG.combat.animationSpeed[animationName] || 1;
  setBrawlerAnimation(player, animationName, { speedScale });
  player.setAnimationElapsedTime(0);
  return player.getAnimationName() === animationName;
}
