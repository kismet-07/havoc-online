/**
 * Brawler basic attack definitions.
 *
 * No attack execution or damage is implemented yet. This file only defines
 * the verified animation sequence requested for the first combat test:
 * three Attack1 punches followed by Attack2.
 */

const BRAWLER_BASIC_ATTACKS = {
  combo: [
    BRAWLER_CONFIG.animations.attack1,
    BRAWLER_CONFIG.animations.attack1,
    BRAWLER_CONFIG.animations.attack1,
    BRAWLER_CONFIG.animations.attack2,
  ],
};
