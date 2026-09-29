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
    modelId: 'assets/equipment/brawler/basic_iron_gauntlet.glb',
    modelObjectName: 'BrawlerGauntlet',
    attachmentProfile: 'brawler_hands',
    enhancementAllowed: true,
    defaultSize: Object.freeze({
      width: 15,
      height: 38,
      depth: 9,
    }),
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
    itemId,
    slot: definition.slot,
    classId: definition.classId,
    attachmentProfile: definition.attachmentProfile,
    modelId: definition.modelId,
    modelObjectName: definition.modelObjectName,
    enhancementAllowed: definition.enhancementAllowed,
    enhancementLevel: level,
  };
}
