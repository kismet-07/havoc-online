/**
 * Shared equipment slot definitions.
 * Character-specific attachment implementation belongs outside this module.
 */
const HAVOC_EQUIPMENT_SLOTS = Object.freeze({
  WEAPON: 'weapon',
  OFFHAND: 'offhand',
  HEAD: 'head',
  BODY: 'body',
  HANDS: 'hands',
  LEGS: 'legs',
  FEET: 'feet',
  ACCESSORY_1: 'accessory_1',
  ACCESSORY_2: 'accessory_2',
});

function isHavocEquipmentSlot(slot) {
  return Object.values(HAVOC_EQUIPMENT_SLOTS).includes(slot);
}
