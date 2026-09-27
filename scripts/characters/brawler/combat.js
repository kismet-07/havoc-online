/**
 * Brawler combat orchestration.
 *
 * This file is intentionally inactive during the locomotion refactor.
 * Targeting, approach-to-range, attack execution and damage will be added
 * incrementally after the extracted movement system is verified.
 */

function initializeBrawlerCombat(runtimeScene) {
  if (!runtimeScene.__havocBrawlerCombat) {
    runtimeScene.__havocBrawlerCombat = {
      target: null,
      attackIndex: 0,
      attacking: false,
    };
  }

  return runtimeScene.__havocBrawlerCombat;
}
