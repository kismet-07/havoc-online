/**
 * Brawler animation helpers.
 *
 * This module owns animation names and transitions used by Brawler systems.
 * Combat animation states will be added here without changing movement rules.
 */

function setBrawlerAnimation(player, animationName) {
  if (!player || !animationName) return;
  if (player.getAnimationName() !== animationName) {
    player.setAnimationName(animationName);
  }
}
