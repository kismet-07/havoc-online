/**
 * Equipment item definitions.
 * Item definitions do not contain runtime scene objects or VFX.
 */
const HAVOC_EQUIPMENT_DEFINITIONS = Object.freeze({
  BRAWLER_STARTER_GAUNTLETS: Object.freeze({
    id: 'brawler_starter_gauntlets',
    slot: 'hands',
    classId: 'brawler',
    displayName: 'Brawler Starter Gauntlets',
    modelId: null,
    attachmentProfile: 'brawler_hands',
    enhancementAllowed: true,
  }),
});

function getHavocEquipmentDefinition(itemId) {
  return HAVOC_EQUIPMENT_DEFINITIONS[itemId] || null;
}

function createHavocEquipmentInstance(itemId, enhancementLevel = 0) {
  const definition = getHavocEquipmentDefinition(itemId);
  if (!definition) return null;

  const numericLevel = Number(enhancementLevel);
  const level = Number.isFinite(numericLevel)
    ? Math.max(0, Math.min(50, Math.trunc(numericLevel)))
    : 0;

  return {
    instanceId: null,
    itemId: definition.id,
    slot: definition.slot,
    classId: definition.classId,
    attachmentProfile: definition.attachmentProfile,
    enhancementAllowed: definition.enhancementAllowed,
    enhancementLevel: level,
  };
}
