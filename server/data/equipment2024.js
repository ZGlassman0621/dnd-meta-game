/**
 * Equipment 2024 — the 2024 PHB Equipment Chapter 6 (pp. 213–233) as data.
 *
 * SOURCE OF TRUTH for Stage 5 (Gear & Story) gear data. Chapter-verbatim
 * from the parent-verified transcription
 * (`~/workspace/dnd-app-review/stage5-build/equipment-chapter-transcription.md`).
 * The book wins on any conflict.
 *
 * MONEY: every price is stored as integer COPPER PIECES (`costCp`).
 * 1 GP = 100 CP, 1 SP = 10 CP, 1 EP = 50 CP, 1 PP = 1,000 CP.
 * `costGp` is carried alongside only as a human-readable convenience.
 * Weights are pounds (`weightLb`); `null` means negligible ("—" in the book).
 *
 * COUNT FLAG: the build brief and the transcription header say "37 weapons"
 * and "13 armor + shield", but the ENUMERATED chapter tables contain
 * 38 weapons (10 simple melee + 4 simple ranged + 18 martial melee +
 * 6 martial ranged) and 12 armor (3 light + 5 medium + 4 heavy) + Shield.
 * This module encodes the enumerated tables (38 / 12 + Shield).
 * Setting weapons (2026-11-08, job (c)): +3 setting weapons from the
 * 2014 setting books — Yklwa (Tomb of Annihilation), Double-Bladed
 * Scimitar (Eberron: Rising from the Last War), Hoopak (Dragonlance:
 * Shadow of the Dragon Queen) — so this module now encodes 38 chapter
 * + 3 setting = 41 weapons. The chapter count itself is unchanged.
 *
 * pp. 216–218 were NOT photographed (likely the weapons/armor art spread).
 * Nothing in this module is sourced from those pages.
 *
 * FLAG 1 — AMMUNITION RECOVERY (item-1 ruling, Zach 2026-10-29, wins over
 * the book): the book's Ammunition property says after a fight, spend
 * 1 minute to recover half the ammunition used (round down). That rule is
 * DELIBERATELY NOT encoded here. Recovery is scavenging as part of the
 * looting scene, NO automatic half-back, with ammo spent tracked per
 * encounter. See AMMUNITION_RECOVERY below and the `ammunition` rule text.
 *
 * CORRECTIONS APPLIED (book wins; see the transcription header):
 *  1. Heavy = Disadvantage unless Str 13 (melee) or Dex 13 (ranged) —
 *     NOT the 2014 Small/Tiny rule.
 *  2. Cleave = second attack roll; the second creature takes the WEAPON'S
 *     DAMAGE (no ability modifier unless negative), once per turn.
 *  3. Club mastery = Slow.
 *  4. Druidic Focus has THREE entries only — Sprig of Mistletoe, Wooden
 *     Staff, Yew Wand. NO Totem (2014 holdover).
 *  5. Armor with a Strength requirement reduces speed by 10 ft unless
 *     the wearer's Strength meets it.
 *
 * Canonical item names match the chapter so package resolution can match
 * by name. No third-party (GM-book) prices live here.
 */

export const EQUIPMENT_2024_SOURCE = '2024 PHB Equipment Chapter 6 (pp. 213–233)';
export const EQUIPMENT_2024_VERSION = '1.0.0';

// ---------------------------------------------------------------- coins
export const COINS = {
  cpPerGp: 100, cpPerSp: 10, cpPerEp: 50, cpPerPp: 1000,
  coinsPerLb: 50,
  conversions: '1 CP = 1/100 GP; 1 SP = 1/10 GP; 1 EP = 1/2 GP; 1 GP = 1 GP; 1 PP = 10 GP. 50 coins weigh 1 lb.',
  selling: 'Selling equipment: half cost when sold; gems, trade goods, and art retain full value.',
};

/** gp (float) -> integer copper pieces. */
export function gpToCp(gp) { return Math.round(Number(gp) * 100); }
/** Integer copper pieces -> gp (float). */
export function cpToGp(cp) { return Number(cp) / 100; }

// ------------------------------------------------------- weapon properties
// Rule text is the book's, with corrections 1–2 applied. The Ammunition
// text carries the expended-on-use / loading / melee-disadvantage
// mechanics WITHOUT the book's half-back recovery sentence (Flag 1).
export const WEAPON_PROPERTY_RULES = {
  ammunition: 'Ammunition is expended on use. Loading weapons need a free hand to load. A ranged weapon in melee has Disadvantage on attack rolls within 5 ft of a hostile creature that can see you and isn\'t Incapacitated. (Book recovery rule NOT used here — see AMMUNITION_RECOVERY.)',
  finesse: 'Use Strength or Dexterity (your choice) for attack and damage rolls.',
  heavy: 'You have Disadvantage on attack rolls with a Heavy weapon if it is a Melee weapon and your Strength score isn\'t at least 13 or if it is a Ranged weapon and your Dexterity score isn\'t at least 13.',
  light: 'Can be used for two-weapon fighting with another Light weapon.',
  loading: 'You can make only one attack with it per action, Bonus Action, or Reaction, regardless of Extra Attack.',
  range: 'Short/long range in feet; attacks beyond short range (up to long) have Disadvantage.',
  reach: 'Adds 5 feet to your reach with this weapon.',
  thrown: 'Can be thrown as a ranged attack; uses the listed range.',
  'two-handed': 'Requires two hands to use.',
  versatile: 'Can be used one- or two-handed; the versatile damage applies when wielded in two hands.',
};

export const MASTERY_RULES = {
  cleave: 'If you hit a creature with a melee attack roll using this weapon, you can make a melee attack roll with the weapon against a second creature within 5 feet of the first that is also within your reach. On a hit, the second creature takes the weapon\'s damage, but don\'t add your ability modifier to that damage unless that modifier is negative. You can make this extra attack only once per turn.',
  graze: 'If you miss with this weapon, the target still takes damage equal to your ability modifier used for the attack.',
  nick: 'This Light weapon\'s extra attack is part of the same Attack action, not a Bonus Action.',
  push: 'If you hit a creature with this weapon, you can push a Large or smaller creature 10 feet straight away from you.',
  sap: 'If you hit a creature with this weapon, that creature has Disadvantage on its next attack roll before the start of your next turn.',
  slow: 'If you hit a creature with this weapon, its Speed is reduced by 10 feet until the start of your next turn.',
  topple: 'If you hit a creature with this weapon, it must make a Constitution saving throw (DC 8 + ability modifier + Proficiency Bonus) or have the Prone condition.',
  vex: 'If you hit a creature with this weapon, you have Advantage on your next attack roll against that creature before the end of your next turn.',
};

/** Flag 1 record: the book rule that is deliberately NOT encoded. */
export const AMMUNITION_RECOVERY = {
  bookRule: 'After a fight, spend 1 minute to recover half the ammunition used (round down).',
  encoded: false,
  ruling: 'Item-1 ruling (Zach, 2026-10-29): recovery is scavenging as part of the looting scene, NO automatic half-back, with ammo spent tracked per encounter. The book rule is NOT encoded anywhere in this module.',
};

// ---------------------------------------------------------------- weapons
// Shape: { name, category: 'simple'|'martial', rangeType: 'melee'|'ranged',
//   damage, damageType, properties: [lowercase keys], range: 'short/long'|null,
//   ammunition: 'Arrow'|'Bolt'|'Bullet'|'Needle'|null, versatile: '1d8'|null,
//   mastery: lowercase mastery key, weightLb, costCp, costGp, notes? }
// `properties` uses the same lowercase vocabulary as combatStatsService
// WEAPON_DATA so the three tables agree field-for-field.
export const WEAPONS = [
  // Simple melee
  { name: 'Club', category: 'simple', rangeType: 'melee', damage: '1d4', damageType: 'bludgeoning', properties: ['light'], range: null, ammunition: null, versatile: null, mastery: 'slow', weightLb: 2, costCp: 10, costGp: 0.1 },
  { name: 'Dagger', category: 'simple', rangeType: 'melee', damage: '1d4', damageType: 'piercing', properties: ['finesse', 'light', 'thrown'], range: '20/60', ammunition: null, versatile: null, mastery: 'nick', weightLb: 1, costCp: 200, costGp: 2 },
  { name: 'Greatclub', category: 'simple', rangeType: 'melee', damage: '1d8', damageType: 'bludgeoning', properties: ['two-handed'], range: null, ammunition: null, versatile: null, mastery: 'push', weightLb: 10, costCp: 20, costGp: 0.2 },
  { name: 'Handaxe', category: 'simple', rangeType: 'melee', damage: '1d6', damageType: 'slashing', properties: ['light', 'thrown'], range: '20/60', ammunition: null, versatile: null, mastery: 'vex', weightLb: 2, costCp: 500, costGp: 5 },
  { name: 'Javelin', category: 'simple', rangeType: 'melee', damage: '1d6', damageType: 'piercing', properties: ['thrown'], range: '30/120', ammunition: null, versatile: null, mastery: 'slow', weightLb: 2, costCp: 50, costGp: 0.5 },
  { name: 'Light Hammer', category: 'simple', rangeType: 'melee', damage: '1d4', damageType: 'bludgeoning', properties: ['light', 'thrown'], range: '20/60', ammunition: null, versatile: null, mastery: 'nick', weightLb: 2, costCp: 200, costGp: 2 },
  { name: 'Mace', category: 'simple', rangeType: 'melee', damage: '1d6', damageType: 'bludgeoning', properties: [], range: null, ammunition: null, versatile: null, mastery: 'sap', weightLb: 4, costCp: 500, costGp: 5 },
  { name: 'Quarterstaff', category: 'simple', rangeType: 'melee', damage: '1d6', damageType: 'bludgeoning', properties: ['versatile'], range: null, ammunition: null, versatile: '1d8', mastery: 'topple', weightLb: 4, costCp: 20, costGp: 0.2 },
  { name: 'Sickle', category: 'simple', rangeType: 'melee', damage: '1d4', damageType: 'slashing', properties: ['light'], range: null, ammunition: null, versatile: null, mastery: 'nick', weightLb: 2, costCp: 100, costGp: 1 },
  { name: 'Spear', category: 'simple', rangeType: 'melee', damage: '1d6', damageType: 'piercing', properties: ['thrown', 'versatile'], range: '20/60', ammunition: null, versatile: '1d8', mastery: 'sap', weightLb: 3, costCp: 100, costGp: 1 },
  { name: 'Yklwa', category: 'simple', rangeType: 'melee', damage: '1d8', damageType: 'piercing', properties: ['thrown'], range: '10/30', ammunition: null, versatile: null, mastery: 'sap', weightLb: 2, costCp: 100, costGp: 1 },
  // Simple ranged
  { name: 'Dart', category: 'simple', rangeType: 'ranged', damage: '1d4', damageType: 'piercing', properties: ['finesse', 'thrown'], range: '20/60', ammunition: null, versatile: null, mastery: 'vex', weightLb: 0.25, costCp: 5, costGp: 0.05 },
  { name: 'Light Crossbow', category: 'simple', rangeType: 'ranged', damage: '1d8', damageType: 'piercing', properties: ['ammunition', 'loading', 'two-handed'], range: '80/320', ammunition: 'Bolt', versatile: null, mastery: 'slow', weightLb: 5, costCp: 2500, costGp: 25 },
  { name: 'Shortbow', category: 'simple', rangeType: 'ranged', damage: '1d6', damageType: 'piercing', properties: ['ammunition', 'two-handed'], range: '80/320', ammunition: 'Arrow', versatile: null, mastery: 'vex', weightLb: 2, costCp: 2500, costGp: 25 },
  { name: 'Sling', category: 'simple', rangeType: 'ranged', damage: '1d4', damageType: 'bludgeoning', properties: ['ammunition'], range: '30/120', ammunition: 'Bullet', versatile: null, mastery: 'slow', weightLb: null, costCp: 10, costGp: 0.1 },
  // Martial melee
  { name: 'Battleaxe', category: 'martial', rangeType: 'melee', damage: '1d8', damageType: 'slashing', properties: ['versatile'], range: null, ammunition: null, versatile: '1d10', mastery: 'topple', weightLb: 4, costCp: 1000, costGp: 10 },
  { name: 'Flail', category: 'martial', rangeType: 'melee', damage: '1d8', damageType: 'bludgeoning', properties: [], range: null, ammunition: null, versatile: null, mastery: 'sap', weightLb: 2, costCp: 1000, costGp: 10 },
  { name: 'Glaive', category: 'martial', rangeType: 'melee', damage: '1d10', damageType: 'slashing', properties: ['heavy', 'reach', 'two-handed'], range: null, ammunition: null, versatile: null, mastery: 'graze', weightLb: 6, costCp: 2000, costGp: 20 },
  { name: 'Greataxe', category: 'martial', rangeType: 'melee', damage: '1d12', damageType: 'slashing', properties: ['heavy', 'two-handed'], range: null, ammunition: null, versatile: null, mastery: 'cleave', weightLb: 7, costCp: 3000, costGp: 30 },
  { name: 'Greatsword', category: 'martial', rangeType: 'melee', damage: '2d6', damageType: 'slashing', properties: ['heavy', 'two-handed'], range: null, ammunition: null, versatile: null, mastery: 'graze', weightLb: 6, costCp: 5000, costGp: 50 },
  { name: 'Halberd', category: 'martial', rangeType: 'melee', damage: '1d10', damageType: 'slashing', properties: ['heavy', 'reach', 'two-handed'], range: null, ammunition: null, versatile: null, mastery: 'cleave', weightLb: 6, costCp: 2000, costGp: 20 },
  { name: 'Lance', category: 'martial', rangeType: 'melee', damage: '1d10', damageType: 'piercing', properties: ['heavy', 'reach', 'two-handed'], range: null, ammunition: null, versatile: null, mastery: 'topple', weightLb: 6, costCp: 1000, costGp: 10, notes: 'Two-Handed does not apply while mounted.' },
  { name: 'Longsword', category: 'martial', rangeType: 'melee', damage: '1d8', damageType: 'slashing', properties: ['versatile'], range: null, ammunition: null, versatile: '1d10', mastery: 'sap', weightLb: 3, costCp: 1500, costGp: 15 },
  { name: 'Maul', category: 'martial', rangeType: 'melee', damage: '2d6', damageType: 'bludgeoning', properties: ['heavy', 'two-handed'], range: null, ammunition: null, versatile: null, mastery: 'topple', weightLb: 10, costCp: 1000, costGp: 10 },
  { name: 'Morningstar', category: 'martial', rangeType: 'melee', damage: '1d8', damageType: 'piercing', properties: [], range: null, ammunition: null, versatile: null, mastery: 'sap', weightLb: 4, costCp: 1500, costGp: 15 },
  { name: 'Pike', category: 'martial', rangeType: 'melee', damage: '1d10', damageType: 'piercing', properties: ['heavy', 'reach', 'two-handed'], range: null, ammunition: null, versatile: null, mastery: 'push', weightLb: 18, costCp: 500, costGp: 5 },
  { name: 'Rapier', category: 'martial', rangeType: 'melee', damage: '1d8', damageType: 'piercing', properties: ['finesse'], range: null, ammunition: null, versatile: null, mastery: 'vex', weightLb: 2, costCp: 2500, costGp: 25 },
  { name: 'Scimitar', category: 'martial', rangeType: 'melee', damage: '1d6', damageType: 'slashing', properties: ['finesse', 'light'], range: null, ammunition: null, versatile: null, mastery: 'nick', weightLb: 3, costCp: 2500, costGp: 25 },
  { name: 'Shortsword', category: 'martial', rangeType: 'melee', damage: '1d6', damageType: 'piercing', properties: ['finesse', 'light'], range: null, ammunition: null, versatile: null, mastery: 'vex', weightLb: 2, costCp: 1000, costGp: 10 },
  { name: 'Trident', category: 'martial', rangeType: 'melee', damage: '1d8', damageType: 'piercing', properties: ['thrown', 'versatile'], range: '20/60', ammunition: null, versatile: '1d10', mastery: 'topple', weightLb: 4, costCp: 500, costGp: 5 },
  { name: 'War Pick', category: 'martial', rangeType: 'melee', damage: '1d8', damageType: 'piercing', properties: ['versatile'], range: null, ammunition: null, versatile: '1d10', mastery: 'sap', weightLb: 2, costCp: 500, costGp: 5 },
  { name: 'Warhammer', category: 'martial', rangeType: 'melee', damage: '1d8', damageType: 'bludgeoning', properties: ['versatile'], range: null, ammunition: null, versatile: '1d10', mastery: 'push', weightLb: 5, costCp: 1500, costGp: 15 },
  { name: 'Whip', category: 'martial', rangeType: 'melee', damage: '1d4', damageType: 'slashing', properties: ['finesse', 'reach'], range: null, ammunition: null, versatile: null, mastery: 'slow', weightLb: 3, costCp: 200, costGp: 2 },
  { name: 'Double-Bladed Scimitar', category: 'martial', rangeType: 'melee', damage: '2d4', damageType: 'slashing', properties: ['special', 'two-handed'], range: null, ammunition: null, versatile: null, mastery: 'graze', weightLb: 6, costCp: 10000, costGp: 100, notes: 'Special: if you attack with it as part of the Attack action on your turn, you can use a bonus action immediately after to make a melee attack with it for 1d4 slashing damage instead of 2d4. (DM-adjudicated in v1 — no engine path for the 1d4 bonus attack.)' },
  { name: 'Hoopak', category: 'martial', rangeType: 'melee', damage: '1d6', damageType: 'piercing', properties: ['ammunition', 'finesse', 'special', 'two-handed'], range: '40/160', ammunition: 'Bullet', versatile: null, mastery: 'topple', weightLb: 2, costCp: 100, costGp: 1, notes: 'Special: when you make a melee attack with this weapon, you ignore its ammunition property. You can use it as a martial ranged weapon (sling bullets, 1d4 bludgeoning). (Ranged mode DM-adjudicated in v1 — the engine carries the melee 1d6.)' },
  // Martial ranged
  { name: 'Blowgun', category: 'martial', rangeType: 'ranged', damage: '1', damageType: 'piercing', properties: ['ammunition', 'loading'], range: '25/100', ammunition: 'Needle', versatile: null, mastery: 'vex', weightLb: 1, costCp: 1000, costGp: 10 },
  { name: 'Hand Crossbow', category: 'martial', rangeType: 'ranged', damage: '1d6', damageType: 'piercing', properties: ['ammunition', 'light', 'loading'], range: '30/120', ammunition: 'Bolt', versatile: null, mastery: 'vex', weightLb: 3, costCp: 7500, costGp: 75 },
  { name: 'Heavy Crossbow', category: 'martial', rangeType: 'ranged', damage: '1d10', damageType: 'piercing', properties: ['ammunition', 'heavy', 'loading', 'two-handed'], range: '100/400', ammunition: 'Bolt', versatile: null, mastery: 'push', weightLb: 18, costCp: 5000, costGp: 50 },
  { name: 'Longbow', category: 'martial', rangeType: 'ranged', damage: '1d8', damageType: 'piercing', properties: ['ammunition', 'heavy', 'two-handed'], range: '150/600', ammunition: 'Arrow', versatile: null, mastery: 'slow', weightLb: 2, costCp: 5000, costGp: 50 },
  { name: 'Musket', category: 'martial', rangeType: 'ranged', damage: '1d12', damageType: 'piercing', properties: ['ammunition', 'loading', 'two-handed'], range: '40/120', ammunition: 'Bullet', versatile: null, mastery: 'slow', weightLb: 10, costCp: 50000, costGp: 500 },
  { name: 'Pistol', category: 'martial', rangeType: 'ranged', damage: '1d10', damageType: 'piercing', properties: ['ammunition', 'loading'], range: '30/90', ammunition: 'Bullet', versatile: null, mastery: 'vex', weightLb: 3, costCp: 25000, costGp: 250 },
];
// NOTE: Net is NOT a weapon in 2024 — it is adventuring gear only (see
// ADVENTURING_GEAR). The 2024 chapter carries no 'special' property, but
// the two setting Special weapons DO: Double-Bladed Scimitar and Hoopak
// carry 'special' in properties, with the full rule in their `notes`
// (Lance precedent). 'special' is NOT added to WEAPON_PROPERTY_RULES —
// that table is the 2024 chapter's property rules; a setting-book rule
// does not belong there.

// ------------------------------------------------------------------ armor
// Shape: { name, category: 'light'|'medium'|'heavy', baseAC, maxDex: number|null
//   (null = no cap; heavy uses 0), strengthRequirement: number|null,
//   stealthDisadvantage, weightLb, costCp, costGp, donMinutes, doffMinutes }
export const ARMOR = [
  { name: 'Padded', category: 'light', baseAC: 11, maxDex: null, strengthRequirement: null, stealthDisadvantage: false, weightLb: 8, costCp: 500, costGp: 5, donMinutes: 1, doffMinutes: 1 },
  { name: 'Leather', category: 'light', baseAC: 11, maxDex: null, strengthRequirement: null, stealthDisadvantage: false, weightLb: 10, costCp: 1000, costGp: 10, donMinutes: 1, doffMinutes: 1 },
  { name: 'Studded Leather', category: 'light', baseAC: 12, maxDex: null, strengthRequirement: null, stealthDisadvantage: true, weightLb: 13, costCp: 4500, costGp: 45, donMinutes: 1, doffMinutes: 1 },
  { name: 'Hide', category: 'medium', baseAC: 12, maxDex: 2, strengthRequirement: null, stealthDisadvantage: false, weightLb: 12, costCp: 1000, costGp: 10, donMinutes: 5, doffMinutes: 1 },
  { name: 'Chain Shirt', category: 'medium', baseAC: 13, maxDex: 2, strengthRequirement: null, stealthDisadvantage: false, weightLb: 20, costCp: 5000, costGp: 50, donMinutes: 5, doffMinutes: 1 },
  { name: 'Scale Mail', category: 'medium', baseAC: 14, maxDex: 2, strengthRequirement: null, stealthDisadvantage: true, weightLb: 45, costCp: 5000, costGp: 50, donMinutes: 5, doffMinutes: 1 },
  { name: 'Breastplate', category: 'medium', baseAC: 14, maxDex: 2, strengthRequirement: null, stealthDisadvantage: false, weightLb: 20, costCp: 40000, costGp: 400, donMinutes: 5, doffMinutes: 1 },
  { name: 'Half Plate', category: 'medium', baseAC: 15, maxDex: 2, strengthRequirement: null, stealthDisadvantage: true, weightLb: 40, costCp: 75000, costGp: 750, donMinutes: 5, doffMinutes: 1 },
  { name: 'Ring Mail', category: 'heavy', baseAC: 14, maxDex: 0, strengthRequirement: null, stealthDisadvantage: true, weightLb: 40, costCp: 3000, costGp: 30, donMinutes: 10, doffMinutes: 5 },
  { name: 'Chain Mail', category: 'heavy', baseAC: 16, maxDex: 0, strengthRequirement: 13, stealthDisadvantage: true, weightLb: 55, costCp: 7500, costGp: 75, donMinutes: 10, doffMinutes: 5 },
  { name: 'Splint', category: 'heavy', baseAC: 17, maxDex: 0, strengthRequirement: 15, stealthDisadvantage: true, weightLb: 60, costCp: 20000, costGp: 200, donMinutes: 10, doffMinutes: 5 },
  { name: 'Plate', category: 'heavy', baseAC: 18, maxDex: 0, strengthRequirement: 15, stealthDisadvantage: true, weightLb: 65, costCp: 150000, costGp: 1500, donMinutes: 10, doffMinutes: 5 },
];

export const SHIELD = {
  name: 'Shield', acBonus: 2, strengthRequirement: null, stealthDisadvantage: false,
  weightLb: 6, costCp: 1000, costGp: 10, donDoff: 'Utilize action',
};

export const ARMOR_RULES = {
  strength: 'If the table shows a Strength score in the Strength column for an armor type, that armor reduces the wearer\'s speed by 10 feet unless the wearer has a Strength score equal to or higher than the listed score.',
  untrained: 'Without training in a worn armor type, Disadvantage on Strength/Dexterity checks, saves, and attack rolls, and can\'t cast spells.',
  shieldTraining: 'A Shield grants its benefit only with training (proficiency with shields).',
  oneAtATime: 'A creature wears one suit of armor and one Shield at a time.',
  sizes: 'Equipment Sizes variant: armor for a non-Medium creature costs 1d4 × 10% more (DM rolls) and weighs proportionally; Small/Medium armor fits either.',
  barding: 'Barding: any armor on the Armor table is purchasable as barding at 4× cost, 2× weight.',
};

// ------------------------------------------------------------------ tools
// Shape: { name, category: 'artisan'|'gaming'|'other'|'instrument',
//   ability: 'Str'|'Dex'|'Int'|'Wis'|'Cha', weightLb, costCp, costGp,
//   crafts: [chapter-verbatim craft list] (absent where the book lists none) }
// Tool rules: proficiency lets you add PB to ability checks using that tool;
// crafting requires the tool AND proficiency with it; helpers must also
// have proficiency. Proficient in both the tool and the skill used with it
// = Advantage on the check.
export const TOOL_RULES = 'Proficiency lets you add your Proficiency Bonus to ability checks using that tool. Crafting requires the tool AND proficiency with it; helpers must also have proficiency. If you are proficient in both a tool and the skill used with it, you have Advantage on the check.';
export const TOOLS = [
  { name: "Alchemist's Supplies", category: 'artisan', ability: 'Int', weightLb: 8, costCp: 5000, costGp: 50, crafts: ['Acid', "Alchemist's Fire", 'Component Pouch', 'Oil', 'Paper', 'Perfume'] },
  { name: "Brewer's Supplies", category: 'artisan', ability: 'Int', weightLb: 9, costCp: 2000, costGp: 20, crafts: ['Antitoxin'] },
  { name: "Calligrapher's Supplies", category: 'artisan', ability: 'Dex', weightLb: 5, costCp: 1000, costGp: 10, crafts: ['Ink', 'Spell Scroll'] },
  { name: "Carpenter's Tools", category: 'artisan', ability: 'Str', weightLb: 6, costCp: 800, costGp: 8, crafts: ['Club', 'Greatclub', 'Quarterstaff', 'Barrel', 'Chest', 'Ladder', 'Pole', 'Portable Ram', 'Torch'] },
  { name: "Cartographer's Tools", category: 'artisan', ability: 'Wis', weightLb: 6, costCp: 1500, costGp: 15, crafts: ['Map'] },
  { name: "Cobbler's Tools", category: 'artisan', ability: 'Dex', weightLb: 5, costCp: 500, costGp: 5, crafts: ["Climber's Kit"] },
  { name: "Cook's Utensils", category: 'artisan', ability: 'Wis', weightLb: 8, costCp: 100, costGp: 1, crafts: ['Rations'] },
  { name: "Glassblower's Tools", category: 'artisan', ability: 'Int', weightLb: 5, costCp: 3000, costGp: 30, crafts: ['Glass Bottle', 'Magnifying Glass', 'Spyglass', 'Vial'] },
  { name: "Jeweler's Tools", category: 'artisan', ability: 'Int', weightLb: 2, costCp: 2500, costGp: 25, crafts: ['Arcane Focus', 'Holy Symbol'] },
  { name: "Leatherworker's Tools", category: 'artisan', ability: 'Dex', weightLb: 5, costCp: 500, costGp: 5, crafts: ['Sling', 'Whip', 'Hide Armor', 'Leather Armor', 'Studded Leather Armor', 'Backpack', 'Crossbow Bolt Case', 'Map or Scroll Case', 'Parchment', 'Pouch', 'Quiver', 'Waterskin'] },
  { name: "Mason's Tools", category: 'artisan', ability: 'Str', weightLb: 8, costCp: 1000, costGp: 10, crafts: ['Block and Tackle'] },
  { name: "Painter's Supplies", category: 'artisan', ability: 'Wis', weightLb: 5, costCp: 1000, costGp: 10, crafts: ['Druidic Focus', 'Holy Symbol'] },
  { name: "Potter's Tools", category: 'artisan', ability: 'Int', weightLb: 3, costCp: 1000, costGp: 10, crafts: ['Jug', 'Lamp'] },
  { name: "Smith's Tools", category: 'artisan', ability: 'Str', weightLb: 8, costCp: 2000, costGp: 20, crafts: ['Any Melee weapon except Club, Greatclub, Quarterstaff, Whip', 'Medium armor except Hide', 'Heavy armor', 'Ball Bearings', 'Bucket', 'Caltrops', 'Chain', 'Crowbar', 'Firearm Bullets', 'Grappling Hook', 'Iron Pot', 'Iron Spikes', 'Sling Bullets'] },
  { name: "Tinker's Tools", category: 'artisan', ability: 'Dex', weightLb: 10, costCp: 5000, costGp: 50, crafts: ['Musket', 'Pistol', 'Bell', 'Bullseye Lantern', 'Flask', 'Hooded Lantern', 'Hunting Trap', 'Lock', 'Manacles', 'Mirror', 'Shovel', 'Signal Whistle', 'Tinderbox'] },
  { name: "Weaver's Tools", category: 'artisan', ability: 'Dex', weightLb: 5, costCp: 100, costGp: 1, crafts: ['Padded Armor', 'Basket', 'Bedroll', 'Blanket', 'Fine Clothes', 'Net', 'Robe', 'Rope', 'Sack', 'String', 'Tent', "Traveler's Clothes"] },
  { name: "Woodcarver's Tools", category: 'artisan', ability: 'Dex', weightLb: 5, costCp: 100, costGp: 1, crafts: ['Club', 'Greatclub', 'Quarterstaff', 'Ranged weapons except Pistol, Musket, Sling', 'Arcane Focus', 'Arrows', 'Bolts', 'Druidic Focus', 'Ink Pen', 'Needles'] },
  { name: 'Disguise Kit', category: 'other', ability: 'Cha', weightLb: 3, costCp: 2500, costGp: 25, crafts: ['Costume'] },
  { name: 'Forgery Kit', category: 'other', ability: 'Dex', weightLb: 5, costCp: 1500, costGp: 15 },
  { name: 'Herbalism Kit', category: 'other', ability: 'Int', weightLb: 3, costCp: 500, costGp: 5, crafts: ['Antitoxin', 'Candle', "Healer's Kit", 'Potion of Healing'] },
  { name: "Navigator's Tools", category: 'other', ability: 'Wis', weightLb: 2, costCp: 2500, costGp: 25 },
  { name: "Poisoner's Kit", category: 'other', ability: 'Int', weightLb: 2, costCp: 5000, costGp: 50, crafts: ['Basic Poison'] },
  { name: "Thieves' Tools", category: 'other', ability: 'Dex', weightLb: 1, costCp: 2500, costGp: 25 },
  { name: 'Dice', category: 'gaming', ability: 'Wis', weightLb: null, costCp: 10, costGp: 0.1 },
  { name: 'Dragonchess', category: 'gaming', ability: 'Wis', weightLb: null, costCp: 100, costGp: 1 },
  { name: 'Playing Cards', category: 'gaming', ability: 'Wis', weightLb: null, costCp: 50, costGp: 0.5 },
  { name: 'Three-Dragon Ante', category: 'gaming', ability: 'Wis', weightLb: null, costCp: 100, costGp: 1 },
  { name: 'Bagpipes', category: 'instrument', ability: 'Cha', weightLb: 6, costCp: 3000, costGp: 30 },
  { name: 'Drum', category: 'instrument', ability: 'Cha', weightLb: 3, costCp: 600, costGp: 6 },
  { name: 'Dulcimer', category: 'instrument', ability: 'Cha', weightLb: 10, costCp: 2500, costGp: 25 },
  { name: 'Flute', category: 'instrument', ability: 'Cha', weightLb: 1, costCp: 200, costGp: 2 },
  { name: 'Horn', category: 'instrument', ability: 'Cha', weightLb: 2, costCp: 300, costGp: 3 },
  { name: 'Lute', category: 'instrument', ability: 'Cha', weightLb: 2, costCp: 3500, costGp: 35 },
  { name: 'Lyre', category: 'instrument', ability: 'Cha', weightLb: 2, costCp: 3000, costGp: 30 },
  { name: 'Pan Flute', category: 'instrument', ability: 'Cha', weightLb: 2, costCp: 1200, costGp: 12 },
  { name: 'Shawm', category: 'instrument', ability: 'Cha', weightLb: 1, costCp: 200, costGp: 2 },
  { name: 'Viol', category: 'instrument', ability: 'Cha', weightLb: 1, costCp: 3000, costGp: 30 },
];

// -------------------------------------------------------- adventuring gear
// Shape: { name, weightLb, costCp, costGp, rules? } — `rules` is the
// chapter's mechanical text for items that have one (pp. 224–228).
// Items with no `rules` have no chapter mechanics beyond price/weight.
export const ADVENTURING_GEAR = [
  { name: 'Acid', weightLb: 1, costCp: 2500, costGp: 25, rules: 'Attack action, replace one attack, throw at a creature or object within 20 feet; Dexterity saving throw (DC 8 + Dexterity modifier + Proficiency Bonus) or 2d6 Acid damage.' },
  { name: "Alchemist's Fire", weightLb: 1, costCp: 5000, costGp: 50, rules: 'Attack action, replace one attack, throw at a creature or object within 20 feet; Dexterity saving throw (DC 8 + Dexterity modifier + Proficiency Bonus) or 1d4 Fire damage at the start of each of its turns until it or another creature uses an action to extinguish the flames.' },
  { name: 'Antitoxin', weightLb: null, costCp: 5000, costGp: 50, rules: 'Drink as a Bonus Action; Advantage on saving throws against Poison for 1 hour.' },
  { name: 'Backpack', weightLb: 5, costCp: 200, costGp: 2, rules: 'Holds up to 30 lb within 1 cubic foot.' },
  { name: 'Ball Bearings', weightLb: 2, costCp: 100, costGp: 1, rules: 'DC 10 Dexterity saving throw or have the Prone condition; 10 minutes to recover.' },
  { name: 'Barrel', weightLb: 70, costCp: 200, costGp: 2 },
  { name: 'Basket', weightLb: 2, costCp: 40, costGp: 0.4 },
  { name: 'Bedroll', weightLb: 7, costCp: 100, costGp: 1 },
  { name: 'Bell', weightLb: null, costCp: 100, costGp: 1, rules: 'Heard up to 60 feet away.' },
  { name: 'Blanket', weightLb: 3, costCp: 50, costGp: 0.5 },
  { name: 'Block and Tackle', weightLb: 5, costCp: 100, costGp: 1 },
  { name: 'Book', weightLb: 5, costCp: 2500, costGp: 25, rules: '+5 bonus to Intelligence (Arcana, History, Nature, or Religion) checks about the book\'s topic.' },
  { name: 'Bottle, Glass', weightLb: 2, costCp: 200, costGp: 2 },
  { name: 'Bucket', weightLb: 2, costCp: 5, costGp: 0.05 },
  { name: 'Caltrops', weightLb: 2, costCp: 100, costGp: 1, rules: 'DC 15 Dexterity saving throw or 1 Piercing damage and Speed 0; 10 minutes to recover.' },
  { name: 'Candle', weightLb: null, costCp: 1, costGp: 0.01 },
  { name: 'Case, Crossbow Bolt', weightLb: 1, costCp: 100, costGp: 1 },
  { name: 'Case, Map or Scroll', weightLb: 1, costCp: 100, costGp: 1 },
  { name: 'Chain', weightLb: 10, costCp: 500, costGp: 5, rules: 'DC 13 Strength (Athletics) to wrap around a creature or object; escape DC 18 Dexterity (Acrobatics) as an action; burst DC 20 Strength (Athletics) as an action.' },
  { name: 'Chest', weightLb: 25, costCp: 500, costGp: 5 },
  { name: "Climber's Kit", weightLb: 12, costCp: 2500, costGp: 25 },
  { name: 'Clothes, Fine', weightLb: 6, costCp: 1500, costGp: 15 },
  { name: "Clothes, Traveler's", weightLb: 4, costCp: 200, costGp: 2 },
  { name: 'Component Pouch', weightLb: 2, costCp: 2500, costGp: 25 },
  { name: 'Costume', weightLb: 4, costCp: 500, costGp: 5 },
  { name: 'Crowbar', weightLb: 5, costCp: 200, costGp: 2 },
  { name: 'Flask', weightLb: 1, costCp: 2, costGp: 0.02 },
  { name: 'Grappling Hook', weightLb: 4, costCp: 200, costGp: 2 },
  { name: "Healer's Kit", weightLb: 3, costCp: 500, costGp: 5 },
  { name: 'Holy Water', weightLb: 1, costCp: 2500, costGp: 25, rules: 'Attack action, replace one attack, throw at a creature or object within 20 feet; Dexterity saving throw (DC 8 + Dexterity modifier + Proficiency Bonus) or 2d8 Radiant damage if the target is a Fiend or Undead.' },
  { name: 'Hunting Trap', weightLb: 25, costCp: 500, costGp: 5, rules: 'Utilize: DC 13 Dexterity saving throw or 1d4 Piercing damage and Speed 0 until the start of its next turn; then movement is limited by the chain (about 3 feet); DC 13 Strength (Athletics) as an action to escape (self or within reach); each failed check deals 1 Piercing damage.' },
  { name: 'Ink', weightLb: null, costCp: 1000, costGp: 10 },
  { name: 'Ink Pen', weightLb: null, costCp: 2, costGp: 0.02 },
  { name: 'Jug', weightLb: 4, costCp: 2, costGp: 0.02 },
  { name: 'Ladder', weightLb: 25, costCp: 10, costGp: 0.1 },
  { name: 'Lamp', weightLb: 1, costCp: 50, costGp: 0.5, rules: 'Oil fuel; Bright Light 15 feet + Dim Light 30 feet. 1 flask of Oil = 6 hours of fuel (non-consecutive OK; extinguish as a Utilize action).' },
  { name: 'Lantern, Bullseye', weightLb: 2, costCp: 1000, costGp: 10, rules: 'Oil fuel; Bright Light 60-foot cone + Dim Light 60 feet. 1 flask of Oil = 6 hours of fuel.' },
  { name: 'Lantern, Hooded', weightLb: 2, costCp: 500, costGp: 5, rules: 'Oil fuel; Bright Light 30 feet + Dim Light 30 feet; Bonus Action to lower the hood to Dim Light 5 feet. 1 flask of Oil = 6 hours of fuel.' },
  { name: 'Lock', weightLb: 1, costCp: 1000, costGp: 10, rules: 'Pick DC 15 Dexterity (Sleight of Hand) with Thieves\' Tools.' },
  { name: 'Magnifying Glass', weightLb: null, costCp: 10000, costGp: 100, rules: 'Advantage on ability checks to appraise or inspect a highly detailed item; lighting a fire with it needs sunlight-level light, about 5 minutes to ignite.' },
  { name: 'Manacles', weightLb: 6, costCp: 200, costGp: 2, rules: 'Utilize: bind an unwilling Small or Medium creature within 5 feet that has the Grappled, Incapacitated, or Restrained condition; DC 13 Dexterity (Sleight of Hand) or bound: Disadvantage on attack rolls, Restrained if attached to a chain or hook; escape DC 20 Dexterity (Sleight of Hand) as an action; burst DC 25 Strength (Athletics) as an action; picking the lock DC 15 Dexterity (Sleight of Hand).' },
  { name: 'Map', weightLb: null, costCp: 100, costGp: 1, rules: '+5 bonus to Wisdom (Survival) checks to find your way in the place represented, if consulted.' },
  { name: 'Mirror', weightLb: 0.5, costCp: 500, costGp: 5 },
  { name: 'Net', weightLb: 3, costCp: 100, costGp: 1, rules: 'Attack action, replace one attack, throw within 15 feet; Dexterity saving throw (DC 8 + Dexterity modifier + Proficiency Bonus) or Restrained until escape; Huge or larger creatures auto-succeed; escape as an action, DC 10 Strength (Athletics) by the target or a creature within 5 feet; destroying the Net (AC 10, 5 HP, immune to Bludgeoning, Poison, and Psychic damage) also frees the creature. Adventuring gear only — NOT a weapon in 2024.' },
  { name: 'Oil', weightLb: 1, costCp: 10, costGp: 0.1, rules: 'Douse a creature or object (Attack action, replace one attack, within 20 feet; Dexterity saving throw DC 8 + Dexterity modifier + Proficiency Bonus or covered in oil; if it takes Fire damage before the oil dries (1 minute), +5 Fire damage from the burning oil) OR douse a 5-foot square (Utilize; if lit, burns until the end of the turn 2 rounds later, 5 Fire damage to any creature entering or ending its turn there, once per turn). Fuel: 1 flask = 6 hours in a Lamp or Lantern.' },
  { name: 'Paper', weightLb: null, costCp: 2, costGp: 0.02 },
  { name: 'Parchment', weightLb: null, costCp: 1, costGp: 0.01 },
  { name: 'Perfume', weightLb: null, costCp: 500, costGp: 5, rules: 'For 1 hour after applying, Advantage on Charisma (Persuasion) checks to influence an Indifferent Humanoid within 5 feet.' },
  { name: 'Poison, Basic', weightLb: null, costCp: 10000, costGp: 100, rules: 'Bonus Action to coat one weapon or up to 3 pieces of ammunition; a creature taking Piercing or Slashing damage from it takes +1d4 Poison damage; potency lasts 1 minute or until damage is dealt.' },
  { name: 'Pole', weightLb: 7, costCp: 5, costGp: 0.05, rules: '10 feet long; touch things 10 feet away; Advantage on Strength (Athletics) checks for High or Long Jump if used to vault.' },
  { name: 'Pot, Iron', weightLb: 10, costCp: 200, costGp: 2 },
  { name: 'Potion of Healing', weightLb: 0.5, costCp: 5000, costGp: 50, rules: 'Magic item; Bonus Action to drink or administer to a creature within 5 feet; restores 2d4 + 2 Hit Points.' },
  { name: 'Pouch', weightLb: 1, costCp: 50, costGp: 0.5 },
  { name: 'Quiver', weightLb: 1, costCp: 100, costGp: 1 },
  { name: 'Ram, Portable', weightLb: 35, costCp: 400, costGp: 4, rules: '+4 to the Strength check to break down doors; one helper gives Advantage.' },
  { name: 'Rations', weightLb: 2, costCp: 50, costGp: 0.5 },
  { name: 'Robe', weightLb: 4, costCp: 100, costGp: 1 },
  { name: 'Rope', weightLb: 5, costCp: 100, costGp: 1, rules: 'Utilize: tie a knot DC 10 Dexterity (Sleight of Hand); burst DC 20 Strength (Athletics); bind an unwilling creature only if it has the Grappled, Incapacitated, or Restrained condition; escape DC 15 Dexterity (Acrobatics) as an action.' },
  { name: 'Sack', weightLb: 0.5, costCp: 1, costGp: 0.01 },
  { name: 'Shovel', weightLb: 5, costCp: 200, costGp: 2 },
  { name: 'Signal Whistle', weightLb: null, costCp: 5, costGp: 0.05, rules: 'Utilize: sound heard up to 600 feet away.' },
  { name: 'Spell Scroll (Cantrip)', weightLb: null, costCp: 3000, costGp: 30, rules: 'If the spell is on your class list, cast it using its normal casting time, no Material components; save DC 13, attack bonus +5; the scroll disintegrates when casting completes.' },
  { name: 'Spell Scroll (Level 1)', weightLb: null, costCp: 5000, costGp: 50, rules: 'If the spell is on your class list, cast it using its normal casting time, no Material components; save DC 13, attack bonus +5; the scroll disintegrates when casting completes.' },
  { name: 'Spikes, Iron', weightLb: 5, costCp: 100, costGp: 1 },
  { name: 'Spyglass', weightLb: 1, costCp: 100000, costGp: 1000, rules: 'Objects viewed through it are magnified to twice their size.' },
  { name: 'String', weightLb: null, costCp: 10, costGp: 0.1 },
  { name: 'Tent', weightLb: 20, costCp: 200, costGp: 2 },
  { name: 'Tinderbox', weightLb: 1, costCp: 50, costGp: 0.5, rules: 'Bonus Action to light a Candle, Lamp, Lantern, or Torch, or anything with exposed fuel; other fires take 1 minute.' },
  { name: 'Torch', weightLb: 1, costCp: 1, costGp: 0.01, rules: 'Burns 1 hour; Bright Light 20 feet + Dim Light 20 feet; Attack action, Simple Melee weapon, 1 Fire damage on a hit.' },
  { name: 'Vial', weightLb: null, costCp: 100, costGp: 1 },
  { name: 'Waterskin', weightLb: 5, costCp: 20, costGp: 0.2, rules: 'Holds 4 pints (full weight 5 lb); dehydration per the rules glossary.' },
];

// ------------------------------------------------------------ ammunition
export const AMMUNITION = [
  { name: 'Arrows (20)', type: 'Arrow', quantity: 20, weightLb: 1, costCp: 100, costGp: 1 },
  { name: 'Blowgun Needles (50)', type: 'Needle', quantity: 50, weightLb: 1, costCp: 100, costGp: 1 },
  { name: 'Crossbow Bolts (20)', type: 'Bolt', quantity: 20, weightLb: 1.5, costCp: 100, costGp: 1 },
  { name: 'Firearm Bullets (10)', type: 'Bullet', quantity: 10, weightLb: 2, costCp: 300, costGp: 3 },
  { name: 'Sling Bullets (20)', type: 'Bullet', quantity: 20, weightLb: 1.5, costCp: 4, costGp: 0.04 },
];

// ---------------------------------------------------------------- focuses
// Druidic: THREE entries only — no Totem (2014 holdover, correction 4).
export const FOCUSES = {
  arcane: [
    { name: 'Crystal', weightLb: 1, costCp: 1000, costGp: 10 },
    { name: 'Orb', weightLb: 3, costCp: 2000, costGp: 20 },
    { name: 'Rod', weightLb: 2, costCp: 1000, costGp: 10 },
    { name: 'Staff', weightLb: 4, costCp: 500, costGp: 5 },
    { name: 'Wand', weightLb: 1, costCp: 1000, costGp: 10 },
  ],
  druidic: [
    { name: 'Sprig of Mistletoe', weightLb: null, costCp: 100, costGp: 1 },
    { name: 'Wooden Staff', weightLb: 4, costCp: 500, costGp: 5 },
    { name: 'Yew Wand', weightLb: 1, costCp: 1000, costGp: 10 },
  ],
  holy: [
    { name: 'Amulet', weightLb: 1, costCp: 500, costGp: 5, notes: 'Worn or held.' },
    { name: 'Emblem', weightLb: null, costCp: 500, costGp: 5, notes: 'Borne on fabric or a Shield.' },
    { name: 'Reliquary', weightLb: 2, costCp: 500, costGp: 5, notes: 'Held.' },
  ],
};

// ------------------------------------------------------------------ packs
// Contents use canonical chapter item names with quantities, so a package
// resolver can match by name against ADVENTURING_GEAR / WEAPONS / TOOLS.
export const PACKS = {
  "Burglar's Pack": { costCp: 1600, costGp: 16, weightLb: 42, contents: [
    { name: 'Backpack', quantity: 1 }, { name: 'Ball Bearings', quantity: 1 },
    { name: 'Bell', quantity: 1 }, { name: 'Candle', quantity: 10 },
    { name: 'Crowbar', quantity: 1 }, { name: 'Lantern, Hooded', quantity: 1 },
    { name: 'Oil', quantity: 7 }, { name: 'Rations', quantity: 5 },
    { name: 'Rope', quantity: 1 }, { name: 'Tinderbox', quantity: 1 },
    { name: 'Waterskin', quantity: 1 } ] },
  "Diplomat's Pack": { costCp: 3900, costGp: 39, weightLb: 39, contents: [
    { name: 'Chest', quantity: 1 }, { name: 'Clothes, Fine', quantity: 1 },
    { name: 'Ink', quantity: 1 }, { name: 'Ink Pen', quantity: 5 },
    { name: 'Lamp', quantity: 1 }, { name: 'Case, Map or Scroll', quantity: 2 },
    { name: 'Oil', quantity: 2 }, { name: 'Paper', quantity: 5 },
    { name: 'Parchment', quantity: 5 }, { name: 'Perfume', quantity: 1 },
    { name: 'Tinderbox', quantity: 1 } ] },
  "Dungeoneer's Pack": { costCp: 1200, costGp: 12, weightLb: 55, contents: [
    { name: 'Backpack', quantity: 1 }, { name: 'Caltrops', quantity: 1 },
    { name: 'Crowbar', quantity: 1 }, { name: 'Oil', quantity: 2 },
    { name: 'Rations', quantity: 10 }, { name: 'Rope', quantity: 1 },
    { name: 'Tinderbox', quantity: 1 }, { name: 'Torch', quantity: 10 },
    { name: 'Waterskin', quantity: 1 } ] },
  "Entertainer's Pack": { costCp: 4000, costGp: 40, weightLb: 58, contents: [
    { name: 'Backpack', quantity: 1 }, { name: 'Bedroll', quantity: 1 },
    { name: 'Bell', quantity: 1 }, { name: 'Lantern, Bullseye', quantity: 1 },
    { name: 'Costume', quantity: 3 }, { name: 'Mirror', quantity: 1 },
    { name: 'Oil', quantity: 8 }, { name: 'Rations', quantity: 9 },
    { name: 'Tinderbox', quantity: 1 }, { name: 'Waterskin', quantity: 1 } ] },
  "Explorer's Pack": { costCp: 1000, costGp: 10, weightLb: 55, contents: [
    { name: 'Backpack', quantity: 1 }, { name: 'Bedroll', quantity: 1 },
    { name: 'Oil', quantity: 2 }, { name: 'Rations', quantity: 10 },
    { name: 'Rope', quantity: 1 }, { name: 'Tinderbox', quantity: 1 },
    { name: 'Torch', quantity: 10 }, { name: 'Waterskin', quantity: 1 } ] },
  "Priest's Pack": { costCp: 3300, costGp: 33, weightLb: 29, contents: [
    { name: 'Backpack', quantity: 1 }, { name: 'Blanket', quantity: 1 },
    { name: 'Holy Water', quantity: 1 }, { name: 'Lamp', quantity: 1 },
    { name: 'Rations', quantity: 7 }, { name: 'Robe', quantity: 1 },
    { name: 'Tinderbox', quantity: 1 } ] },
  "Scholar's Pack": { costCp: 4000, costGp: 40, weightLb: 22, contents: [
    { name: 'Backpack', quantity: 1 }, { name: 'Book', quantity: 1 },
    { name: 'Ink', quantity: 1 }, { name: 'Ink Pen', quantity: 1 },
    { name: 'Lamp', quantity: 1 }, { name: 'Oil', quantity: 10 },
    { name: 'Parchment', quantity: 10 }, { name: 'Tinderbox', quantity: 1 } ] },
};

// ------------------------------------------------- mounts, tack, vehicles
// Mount speeds are NOT in the transcribed p. 229 table (capacity + cost
// only); no speed is stored here — do not invent one. Carrying capacity
// is the chapter value.
export const MOUNTS = [
  { name: 'Camel', carryingCapacityLb: 450, costCp: 5000, costGp: 50 },
  { name: 'Elephant', carryingCapacityLb: 1320, costCp: 20000, costGp: 200 },
  { name: 'Horse, Draft', carryingCapacityLb: 540, costCp: 5000, costGp: 50 },
  { name: 'Horse, Riding', carryingCapacityLb: 480, costCp: 7500, costGp: 75 },
  { name: 'Mastiff', carryingCapacityLb: 195, costCp: 2500, costGp: 25 },
  { name: 'Mule', carryingCapacityLb: 420, costCp: 800, costGp: 8 },
  { name: 'Pony', carryingCapacityLb: 225, costCp: 3000, costGp: 30 },
  { name: 'Warhorse', carryingCapacityLb: 540, costCp: 40000, costGp: 400 },
];

export const TACK = [
  { name: 'Saddle, Exotic', weightLb: 40, costCp: 6000, costGp: 60, notes: 'Required for aquatic or flying mounts.' },
  { name: 'Saddle, Military', weightLb: 30, costCp: 2000, costGp: 20, notes: 'Advantage on checks to remain mounted.' },
  { name: 'Saddle, Riding', weightLb: 25, costCp: 1000, costGp: 10 },
  { name: 'Feed (per day)', weightLb: 10, costCp: 5, costGp: 0.05 },
  { name: 'Stabling (per day)', weightLb: null, costCp: 50, costGp: 0.5 },
];

export const SADDLE_RULES = 'Saddles come with a bit, bridle, and reins. Military Saddle: Advantage on checks to remain mounted. Exotic Saddle: required for aquatic or flying mounts.';

// Drawn vehicles. An animal pulling a carriage, cart, chariot, sled, or
// wagon can move weight up to 5× its base carrying capacity including the
// vehicle; multiple animals add their capacities.
export const DRAWN_VEHICLES = [
  { name: 'Carriage', weightLb: 600, costCp: 10000, costGp: 100 },
  { name: 'Cart', weightLb: 200, costCp: 1500, costGp: 15 },
  { name: 'Chariot', weightLb: 100, costCp: 25000, costGp: 250 },
  { name: 'Sled', weightLb: 300, costCp: 2000, costGp: 20 },
  { name: 'Wagon', weightLb: 400, costCp: 3500, costGp: 35 },
];
export const DRAWN_VEHICLE_RULES = 'An animal pulling a carriage, cart, chariot, sled, or wagon can move weight up to 5× its base carrying capacity including the vehicle; multiple animals add their capacities.';

// ------------------------------------------------------------------ ships
// Shape: { name, speedMph, crew, passengers: number|null ('—' in the book),
//   cargoTons: number|null, ac, hp, damageThreshold: number|null, costCp, costGp,
//   carryWeightLb? } — Rowboat can be carried and weighs 100 lb.
export const SHIPS = [
  { name: 'Airship', speedMph: 8, crew: 10, passengers: 20, cargoTons: 1, ac: 13, hp: 300, damageThreshold: null, costCp: 4000000, costGp: 40000 },
  { name: 'Galley', speedMph: 4, crew: 80, passengers: null, cargoTons: 150, ac: 15, hp: 500, damageThreshold: 20, costCp: 3000000, costGp: 30000 },
  { name: 'Keelboat', speedMph: 1, crew: 1, passengers: 6, cargoTons: 0.5, ac: 15, hp: 100, damageThreshold: 10, costCp: 300000, costGp: 3000 },
  { name: 'Longship', speedMph: 3, crew: 40, passengers: 150, cargoTons: 10, ac: 15, hp: 300, damageThreshold: 15, costCp: 1000000, costGp: 10000 },
  { name: 'Rowboat', speedMph: 1.5, crew: 1, passengers: 3, cargoTons: null, ac: 11, hp: 50, damageThreshold: null, costCp: 5000, costGp: 50, carryWeightLb: 100 },
  { name: 'Sailing Ship', speedMph: 2, crew: 20, passengers: 20, cargoTons: 100, ac: 15, hp: 300, damageThreshold: 15, costCp: 1000000, costGp: 10000 },
  { name: 'Warship', speedMph: 2.5, crew: 60, passengers: 60, cargoTons: 200, ac: 15, hp: 500, damageThreshold: 20, costCp: 2500000, costGp: 25000 },
];

export const SHIP_RULES = {
  wind: 'Sailing against a strong wind: half speed. Dead calm: a ship can\'t move under sail and must be rowed.',
  current: 'Traveling downstream, add the current (typically 3 mph). A ship can\'t be rowed against a significant current but can be pulled upstream by draft animals.',
  crew: 'Ships larger than a Keelboat or Rowboat need a skilled hireling crew (minimum per table).',
  passengers: 'Passengers are counted in hammocks; private accommodations carry 1/5 as many. A hammock passenger usually pays 5 SP/day; a small private cabin 2 GP/day.',
  repair: 'Ship repair: 1 HP/day, 20 GP materials and labor; halved time and cost where supplies and skilled labor are abundant (e.g. a city shipyard).',
  rowboat: 'A Rowboat can be carried; it weighs 100 lb.',
};

// ---------------------------------------------------------------- services
export const SERVICES = {
  lifestyles: [
    { name: 'Wretched', costPerDayCp: 0 },
    { name: 'Squalid', costPerDayCp: 10 },
    { name: 'Poor', costPerDayCp: 20 },
    { name: 'Modest', costPerDayCp: 100 },
    { name: 'Comfortable', costPerDayCp: 200 },
    { name: 'Wealthy', costPerDayCp: 400 },
    { name: 'Aristocratic', costPerDayCp: 1000 },
  ],
  lifestyleNote: 'Pay at the start of each week or month (DM\'s choice). No inherent consequences, but the DM may weigh lifestyle for risks and perception.',
  foodDrinkLodging: [
    { name: 'Ale (mug)', costCp: 4 },
    { name: 'Bread (loaf)', costCp: 2 },
    { name: 'Cheese (wedge)', costCp: 10 },
    { name: 'Inn Stay per Day — Squalid', costCp: 7 },
    { name: 'Inn Stay per Day — Poor', costCp: 10 },
    { name: 'Inn Stay per Day — Modest', costCp: 50 },
    { name: 'Inn Stay per Day — Comfortable', costCp: 80 },
    { name: 'Inn Stay per Day — Wealthy', costCp: 200 },
    { name: 'Inn Stay per Day — Aristocratic', costCp: 400 },
    { name: 'Meal — Squalid', costCp: 1 },
    { name: 'Meal — Poor', costCp: 2 },
    { name: 'Meal — Modest', costCp: 10 },
    { name: 'Meal — Comfortable', costCp: 20 },
    { name: 'Meal — Wealthy', costCp: 30 },
    { name: 'Meal — Aristocratic', costCp: 60 },
    { name: 'Wine (bottle) — Common', costCp: 20 },
    { name: 'Wine (bottle) — Fine', costCp: 1000 },
  ],
  travel: [
    { name: 'Coach ride between towns', rateCpPerMile: 3 },
    { name: 'Coach ride within a city', rateCpPerMile: 1 },
    { name: 'Road or gate toll', costCp: 1 },
    { name: "Ship's passage", rateCpPerMile: 10 },
  ],
  hirelings: [
    { name: 'Skilled hireling', costPerDayCp: 200, notes: 'Any hireling performing a service involving a proficiency — mercenary, artisan, scribe. Pay shown is a minimum; experts cost more.' },
    { name: 'Untrained hireling', costPerDayCp: 20 },
    { name: 'Messenger', rateCpPerMile: 2 },
  ],
  spellcasting: [
    { name: 'Cantrip', costCp: 3000, costGp: 30, availability: 'village/town/city' },
    { name: 'Level 1', costCp: 5000, costGp: 50, availability: 'village/town/city' },
    { name: 'Level 2', costCp: 20000, costGp: 200, availability: 'village/town/city' },
    { name: 'Level 3', costCp: 30000, costGp: 300, availability: 'town/city' },
    { name: 'Levels 4–5', costCp: 200000, costGp: 2000, availability: 'town/city' },
    { name: 'Levels 6–8', costCp: 2000000, costGp: 20000, availability: 'city' },
    { name: 'Level 9', costCp: 10000000, costGp: 100000, availability: 'city' },
  ],
  spellcastingNote: 'Prices exclude the cost of expensive Material components (added on top).',
};

// ------------------------------------------------------- crafting & magic
export const CRAFTING = {
  materialsFraction: 0.5,
  materialsNote: 'Raw materials worth half the purchase cost (round down; e.g. Plate Armor 1,500 GP needs 750 GP of materials). The DM decides availability.',
  timeNote: 'Time: purchase cost in GP ÷ 10 days (round a fraction up to a day; e.g. Heavy Crossbow 50 GP = 5 days). Multiple days need not be consecutive. Characters can combine efforts — divide the time by the number working (normally only one other character can assist; the DM may allow more).',
  potionOfHealing: {
    tool: 'Herbalism Kit', requiresProficiency: true,
    materialsCp: 2500, materialsGp: 25, days: 1,
    note: '8 hours of work over 1 day.',
  },
  // Scribing a Spell Scroll: need Arcana proficiency or Calligrapher's
  // Supplies proficiency, the spell prepared each day of inscription, and
  // any Material components at hand (consumed only on completion).
  // The scroll's spell uses your save DC and attack bonus. A Cantrip
  // scroll works as if the caster were your level.
  scrollScribing: [
    { level: 'Cantrip', days: 1, costCp: 1500, costGp: 15 },
    { level: 1, days: 1, costCp: 2500, costGp: 25 },
    { level: 2, days: 3, costCp: 10000, costGp: 100 },
    { level: 3, days: 5, costCp: 15000, costGp: 150 },
    { level: 4, days: 10, costCp: 100000, costGp: 1000 },
    { level: 5, days: 25, costCp: 150000, costGp: 1500 },
    { level: 6, days: 40, costCp: 1000000, costGp: 10000 },
    { level: 7, days: 50, costCp: 1250000, costGp: 12500 },
    { level: 8, days: 60, costCp: 1500000, costGp: 15000 },
    { level: 9, days: 120, costCp: 5000000, costGp: 50000 },
  ],
};

export const POTION_OF_HEALING = {
  name: 'Potion of Healing', healing: '2d4+2', healingDice: '2d4', healingBonus: 2,
  action: 'Bonus Action', costCp: 5000, costGp: 50, weightLb: 0.5,
  rules: 'Magic item; Bonus Action to drink or administer to a creature within 5 feet; restores 2d4 + 2 Hit Points.',
};

// Purchase prices (gear table), NOT scribing costs (see CRAFTING).
export const SPELL_SCROLL_PRICES = {
  cantrip: { name: 'Spell Scroll (Cantrip)', costCp: 3000, costGp: 30 },
  level1: { name: 'Spell Scroll (Level 1)', costCp: 5000, costGp: 50 },
};

export const ATTUNEMENT = {
  max: 3,
  rules: 'Max 3 items at a time; can\'t attune to more than one copy of an item; attuning takes a Short Rest focused on only that item while in physical contact (can\'t be the same Short Rest used to learn its properties); attunement ends if prerequisites are unmet, the item is more than 100 feet away for 24+ hours, you die, another creature attunes to it, or voluntarily via a Short Rest focused on the item (unless cursed). Without attunement you gain only nonmagical benefits. Magic armor must be donned, a shield strapped, a weapon held; worn items fit any size or build (magically adjustable). Normally one pair of footwear, one pair of gloves or gauntlets, one pair of bracers, one suit of armor, one headwear, one cloak (the DM may make exceptions). Paired items: both must be worn to gain benefits.',
  identifying: 'Identify is fastest; otherwise focus on one item during a Short Rest while in physical contact — at the end you learn its properties and how to use them (not any curse).',
};

// Improvised weapons sidebar (p. 214).
export const IMPROVISED_WEAPONS = 'An object similar to a weapon can be used as such (the DM decides damage and type); otherwise 1d4 damage, no proficiency unless similar.';

// ---------------------------------------------------------------- lookups
function byName(list, name) {
  if (!name) return null;
  const want = String(name).toLowerCase().trim();
  return list.find((e) => String(e.name).toLowerCase() === want) || null;
}

export function findWeapon(name) { return byName(WEAPONS, name); }
export function findArmor(name) { return byName(ARMOR, name); }
export function findGear(name) { return byName(ADVENTURING_GEAR, name); }
export function findTool(name) { return byName(TOOLS, name); }
export function findMount(name) { return byName(MOUNTS, name); }
export function findShip(name) { return byName(SHIPS, name); }
export function findPack(name) {
  if (!name) return null;
  const key = Object.keys(PACKS).find((k) => k.toLowerCase() === String(name).toLowerCase().trim());
  return key ? { name: key, ...PACKS[key] } : null;
}
/** Structured contents of a pack: [{ name, quantity }]. Null if unknown. */
export function packContents(name) {
  const pack = findPack(name);
  return pack ? pack.contents.map((c) => ({ ...c })) : null;
}
/** Every focus, flattened, with its kind. */
export function allFocuses() {
  return [
    ...FOCUSES.arcane.map((f) => ({ ...f, kind: 'arcane' })),
    ...FOCUSES.druidic.map((f) => ({ ...f, kind: 'druidic' })),
    ...FOCUSES.holy.map((f) => ({ ...f, kind: 'holy' })),
  ];
}

export default {
  EQUIPMENT_2024_SOURCE, EQUIPMENT_2024_VERSION, COINS, gpToCp, cpToGp,
  WEAPON_PROPERTY_RULES, MASTERY_RULES, AMMUNITION_RECOVERY,
  WEAPONS, ARMOR, SHIELD, ARMOR_RULES, TOOLS, TOOL_RULES,
  ADVENTURING_GEAR, AMMUNITION, FOCUSES, PACKS, MOUNTS, TACK, SADDLE_RULES,
  DRAWN_VEHICLES, DRAWN_VEHICLE_RULES, SHIPS, SHIP_RULES, SERVICES,
  CRAFTING, POTION_OF_HEALING, SPELL_SCROLL_PRICES, ATTUNEMENT,
  IMPROVISED_WEAPONS, findWeapon, findArmor, findGear, findTool, findMount,
  findShip, findPack, packContents, allFocuses,
};
