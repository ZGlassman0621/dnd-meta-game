/**
 * Combat Stats Service — the ONE place combat numbers come from.
 *
 * Extracted from dmPromptBuilder (v1.0.191, combat-real B1) where this
 * math lived as display-only code: the prompt computed AC and weapon
 * stats from equipment while combat read a separate armor_class column
 * (Q9's two truths). Now the prompt imports this for display and combat
 * imports it for authority — same function, same equipment, same numbers.
 *
 * Actors are character-shaped: { ability_scores, equipment, level }.
 * Companions map onto it (companion_ability_scores / companion_level,
 * same equipment shape). Companion equipment is often name-only
 * ({ name }) — WEAPON_DATA below fills the mechanical gaps by name.
 */
import { dbGet } from '../database.js';
import { societyKeyForName, SOCIETY_SPELLCASTING_ABILITY } from './magusService.js';
import { CASTING_SUBCLASS_ABILITY } from './wardenService.js';
import { safeParse } from '../utils/safeParse.js';
import { resolveWeaponAlias, resolveArmorVariant, shieldBonusForOffHand } from '../data/armsArmorVariants.js';
import { erodeScores } from './coldExposureService.js'; // Frost Exhaustion erodes scores at this one math site
import { defenseAcBonus } from './classFeatureService.js'; // Defense fighting style (item 2)

// Quality rank bonuses for equipment (verbatim from dmPromptBuilder)
export const QUALITY_BONUSES = {
  poor: { weapon: -1, armor: -1 },
  common: { weapon: 0, armor: 0 },
  fine: { weapon: 0, armor: 0 },
  masterwork: { weapon: 1, armor: 0 },
  exceptional: { weapon: 1, armor: 1 },
  legendary: { weapon: 2, armor: 1 }
};

// Armor base AC values (verbatim from dmPromptBuilder)
export const ARMOR_DATA = {
  'Padded': { baseAC: 11, type: 'light' },
  'Leather': { baseAC: 11, type: 'light' },
  'Studded Leather': { baseAC: 12, type: 'light' },
  'Hide': { baseAC: 12, type: 'medium', maxDex: 2 },
  'Chain Shirt': { baseAC: 13, type: 'medium', maxDex: 2 },
  'Scale Mail': { baseAC: 14, type: 'medium', maxDex: 2 },
  'Breastplate': { baseAC: 14, type: 'medium', maxDex: 2 },
  'Half Plate': { baseAC: 15, type: 'medium', maxDex: 2 },
  'Ring Mail': { baseAC: 14, type: 'heavy' },
  'Chain Mail': { baseAC: 16, type: 'heavy' },
  'Splint': { baseAC: 17, type: 'heavy' },
  'Plate': { baseAC: 18, type: 'heavy' }
};

/**
 * Canonical weapon data by display name — the full 2024 PHB weapons
 * table (Step 2, v1.0.195; verified against the book's table: damage,
 * properties, ranges, and each weapon's mastery property). Companion
 * equipment slots frequently hold only a name; this table is how a
 * name-only longsword still deals 1d8. An item's own fields always
 * win over the table.
 *
 * 2024 corrections vs the old 2014-era table: Lance deals 1d10 (not
 * 1d12) and is Heavy; Trident deals 1d8 with versatile 1d10 (not
 * 1d6/1d8); Shortsword is piercing; Musket and Pistol join the table.
 *
 * Setting weapons (2026-11-08, job (c)): +3 weapons from the 2014
 * setting books — Yklwa, Double-Bladed Scimitar, Hoopak — so this
 * table now holds 38 chapter + 3 setting = 41 weapons (+ Unarmed
 * Strike). The chapter count itself is unchanged.
 */
export const WEAPON_DATA = {
  // Simple melee
  'Club': { damage: '1d4', damageType: 'bludgeoning', category: 'simple', properties: ['light'], mastery: 'slow' },
  'Dagger': { damage: '1d4', damageType: 'piercing', category: 'simple', properties: ['finesse', 'light', 'thrown'], range: '20/60', mastery: 'nick' },
  'Greatclub': { damage: '1d8', damageType: 'bludgeoning', category: 'simple', properties: ['two-handed'], mastery: 'push' },
  'Handaxe': { damage: '1d6', damageType: 'slashing', category: 'simple', properties: ['light', 'thrown'], range: '20/60', mastery: 'vex' },
  'Javelin': { damage: '1d6', damageType: 'piercing', category: 'simple', properties: ['thrown'], range: '30/120', mastery: 'slow' },
  'Light Hammer': { damage: '1d4', damageType: 'bludgeoning', category: 'simple', properties: ['light', 'thrown'], range: '20/60', mastery: 'nick' },
  'Mace': { damage: '1d6', damageType: 'bludgeoning', category: 'simple', properties: [], mastery: 'sap' },
  'Quarterstaff': { damage: '1d6', damageType: 'bludgeoning', category: 'simple', properties: ['versatile'], versatile: '1d8', mastery: 'topple' },
  'Sickle': { damage: '1d4', damageType: 'slashing', category: 'simple', properties: ['light'], mastery: 'nick' },
  'Spear': { damage: '1d6', damageType: 'piercing', category: 'simple', properties: ['thrown', 'versatile'], range: '20/60', versatile: '1d8', mastery: 'sap' },
  'Yklwa': { damage: '1d8', damageType: 'piercing', category: 'simple', properties: ['thrown'], range: '10/30', mastery: 'sap' },
  // Simple ranged
  'Light Crossbow': { damage: '1d8', damageType: 'piercing', category: 'simple', properties: ['ammunition', 'loading', 'two-handed'], range: '80/320', rangeType: 'ranged', mastery: 'slow' },
  'Dart': { damage: '1d4', damageType: 'piercing', category: 'simple', properties: ['finesse', 'thrown'], range: '20/60', rangeType: 'ranged', mastery: 'vex' },
  'Shortbow': { damage: '1d6', damageType: 'piercing', category: 'simple', properties: ['ammunition', 'two-handed'], range: '80/320', rangeType: 'ranged', mastery: 'vex' },
  'Sling': { damage: '1d4', damageType: 'bludgeoning', category: 'simple', properties: ['ammunition'], range: '30/120', rangeType: 'ranged', mastery: 'slow' },
  // Martial melee
  'Battleaxe': { damage: '1d8', damageType: 'slashing', category: 'martial', properties: ['versatile'], versatile: '1d10', mastery: 'topple' },
  'Flail': { damage: '1d8', damageType: 'bludgeoning', category: 'martial', properties: [], mastery: 'sap' },
  'Glaive': { damage: '1d10', damageType: 'slashing', category: 'martial', properties: ['heavy', 'reach', 'two-handed'], mastery: 'graze' },
  'Greataxe': { damage: '1d12', damageType: 'slashing', category: 'martial', properties: ['heavy', 'two-handed'], mastery: 'cleave' },
  'Greatsword': { damage: '2d6', damageType: 'slashing', category: 'martial', properties: ['heavy', 'two-handed'], mastery: 'graze' },
  'Halberd': { damage: '1d10', damageType: 'slashing', category: 'martial', properties: ['heavy', 'reach', 'two-handed'], mastery: 'cleave' },
  'Lance': { damage: '1d10', damageType: 'piercing', category: 'martial', properties: ['heavy', 'reach', 'two-handed'], mastery: 'topple' },
  'Longsword': { damage: '1d8', damageType: 'slashing', category: 'martial', properties: ['versatile'], versatile: '1d10', mastery: 'sap' },
  'Maul': { damage: '2d6', damageType: 'bludgeoning', category: 'martial', properties: ['heavy', 'two-handed'], mastery: 'topple' },
  'Morningstar': { damage: '1d8', damageType: 'piercing', category: 'martial', properties: [], mastery: 'sap' },
  'Pike': { damage: '1d10', damageType: 'piercing', category: 'martial', properties: ['heavy', 'reach', 'two-handed'], mastery: 'push' },
  'Rapier': { damage: '1d8', damageType: 'piercing', category: 'martial', properties: ['finesse'], mastery: 'vex' },
  'Scimitar': { damage: '1d6', damageType: 'slashing', category: 'martial', properties: ['finesse', 'light'], mastery: 'nick' },
  'Shortsword': { damage: '1d6', damageType: 'piercing', category: 'martial', properties: ['finesse', 'light'], mastery: 'vex' },
  'Trident': { damage: '1d8', damageType: 'piercing', category: 'martial', properties: ['thrown', 'versatile'], range: '20/60', versatile: '1d10', mastery: 'topple' },
  'War Pick': { damage: '1d8', damageType: 'piercing', category: 'martial', properties: ['versatile'], versatile: '1d10', mastery: 'sap' },
  'Warhammer': { damage: '1d8', damageType: 'bludgeoning', category: 'martial', properties: ['versatile'], versatile: '1d10', mastery: 'push' },
  'Whip': { damage: '1d4', damageType: 'slashing', category: 'martial', properties: ['finesse', 'reach'], mastery: 'slow' },
  'Double-Bladed Scimitar': { damage: '2d4', damageType: 'slashing', category: 'martial', properties: ['special', 'two-handed'], mastery: 'graze' },
  'Hoopak': { damage: '1d6', damageType: 'piercing', category: 'martial', properties: ['ammunition', 'finesse', 'special', 'two-handed'], range: '40/160', mastery: 'topple' },
  // Martial ranged
  'Blowgun': { damage: '1', damageType: 'piercing', category: 'martial', properties: ['ammunition', 'loading'], range: '25/100', rangeType: 'ranged', mastery: 'vex' },
  'Hand Crossbow': { damage: '1d6', damageType: 'piercing', category: 'martial', properties: ['ammunition', 'light', 'loading'], range: '30/120', rangeType: 'ranged', mastery: 'vex' },
  'Heavy Crossbow': { damage: '1d10', damageType: 'piercing', category: 'martial', properties: ['ammunition', 'heavy', 'loading', 'two-handed'], range: '100/400', rangeType: 'ranged', mastery: 'push' },
  'Longbow': { damage: '1d8', damageType: 'piercing', category: 'martial', properties: ['ammunition', 'heavy', 'two-handed'], range: '150/600', rangeType: 'ranged', mastery: 'slow' },
  'Musket': { damage: '1d12', damageType: 'piercing', category: 'martial', properties: ['ammunition', 'loading', 'two-handed'], range: '40/120', rangeType: 'ranged', mastery: 'slow' },
  'Pistol': { damage: '1d10', damageType: 'piercing', category: 'martial', properties: ['ammunition', 'loading'], range: '30/90', rangeType: 'ranged', mastery: 'vex' },
  'Unarmed Strike': { damage: '1', damageType: 'bludgeoning', properties: [] }
};

/** Classes with the 2024 Weapon Mastery feature. */
export const MASTERY_CLASSES = new Set(['fighter', 'barbarian', 'paladin', 'ranger', 'rogue']);

export function classHasMastery(className) {
  return MASTERY_CLASSES.has(String(className || '').toLowerCase().trim());
}

export function lookupWeaponData(name) {
  if (!name) return null;
  const key = Object.keys(WEAPON_DATA).find(k => k.toLowerCase() === String(name).toLowerCase().trim());
  if (key) return { name: key, ...WEAPON_DATA[key] };
  // Arms & Armor variant: display name stays the variant's, stats come
  // from the canonical 2024 weapon. Proposed weapons are not aliases,
  // so they still return null here.
  const canonical = resolveWeaponAlias(name);
  // Name stays the variant's (so a Nick check comparing main vs off
  // hand still sees two different weapons); stats are canonical.
  return canonical ? { name: String(name).trim(), canonical, ...WEAPON_DATA[canonical] } : null;
}

/**
 * Mastered-weapon picks (combat item 1, Zach 2026-10-29: picks matter).
 * Stored as a JSON array of weapon names on characters.mastered_weapons
 * / companions.mastered_weapons (migration 090). NULL (no list recorded)
 * and a recorded empty list both mean nothing is mastered — the old
 * any-weapon approximation is gone, not grandfathered. Matching is by
 * canonical weapon, so a variant pick (Shamshir) matches its canonical
 * weapon (Scimitar) and vice versa.
 */
export function parseMasteredWeapons(raw) {
  if (raw == null) return null;
  const parsed = typeof raw === 'string' ? safeParse(raw, null) : raw;
  if (!Array.isArray(parsed)) return null;
  return parsed.map(w => String(w).trim()).filter(Boolean);
}

function canonicalWeaponName(name) {
  if (!name) return '';
  const t = lookupWeaponData(name);
  return String(t?.canonical || t?.name || name).toLowerCase().trim();
}

export function weaponIsMastered(picks, weaponName) {
  if (!Array.isArray(picks) || !weaponName) return false;
  const want = canonicalWeaponName(weaponName);
  return picks.some(p => canonicalWeaponName(p) === want);
}

/** Primary spellcasting ability by class (2024 SRD). */
export const CLASS_CASTING_ABILITY = {
  wizard: 'int', artificer: 'int', spellshot: 'int',
  cleric: 'wis', druid: 'wis', ranger: 'wis',
  bard: 'cha', paladin: 'cha', sorcerer: 'cha', warlock: 'cha', blackguard: 'cha'
};
// Overnight 7-class merge: magus/warden/scholar casting ability depends on
// the subclass (society / casting Call / casting Field), so it is resolved
// from the optional subclassName parameter of spellProfileFor, not this map.

export function abilityModifier(score) {
  return Math.floor(((Number(score) || 10) - 10) / 2);
}

export function proficiencyBonusForLevel(level) {
  return Math.ceil((Number(level) || 1) / 4) + 1;
}

function abilityScore(abilities, shortKey, fullKey) {
  return abilities?.[shortKey] ?? abilities?.[fullKey] ?? 10;
}

/**
 * Calculate combat stats from an actor's equipment.
 * Math verbatim from the former dmPromptBuilder copy (v1.0.190 and
 * earlier) — B1 moved it, it did not change it. Two additions, both
 * additive: name-only weapons resolve through WEAPON_DATA, and the
 * returned weapon carries structured damageDice/damageModifier for
 * the attack resolver alongside the display string.
 *
 * @param {object} actor - { ability_scores, equipment, level } (raw DB
 *   strings or parsed objects both accepted)
 * @returns {{ ac: number, weapon: object|null }}
 *   weapon: { name, quality, attackBonus, damage (display string),
 *             damageDice, damageModifier, damageType }
 */
export function calculateCombatStats(actor) {
  const baseAbilities = typeof actor.ability_scores === 'string'
    ? safeParse(actor.ability_scores, {})
    : (actor.ability_scores || {});
  // Frost Exhaustion (coldExposureService): erode every score here, at
  // this one math site, so combat and display can never disagree.
  const abilities = erodeScores(baseAbilities, actor.frost_exhaustion ?? actor.frostExhaustion ?? 0);
  const equipment = typeof actor.equipment === 'string'
    ? safeParse(actor.equipment, {})
    : (actor.equipment || {});

  const dexMod = abilityModifier(abilityScore(abilities, 'dex', 'dexterity'));
  const strMod = abilityModifier(abilityScore(abilities, 'str', 'strength'));
  const profBonus = proficiencyBonusForLevel(actor.level || 1);

  // Calculate AC
  let ac = 10 + dexMod; // Base unarmored AC
  const equippedArmor = equipment.armor;
  if (equippedArmor) {
    const canonicalArmor = resolveArmorVariant(equippedArmor.name);
    const armorInfo = (canonicalArmor && ARMOR_DATA[canonicalArmor])
      || ARMOR_DATA[equippedArmor.name] || equippedArmor;
    if (armorInfo.type === 'heavy' || armorInfo.armorType === 'heavy') {
      ac = armorInfo.baseAC;
    } else if (armorInfo.type === 'medium' || armorInfo.armorType === 'medium') {
      const cappedDex = Math.min(dexMod, armorInfo.maxDex || armorInfo.maxDexBonus || 2);
      ac = armorInfo.baseAC + cappedDex;
    } else if (armorInfo.baseAC != null) {
      ac = armorInfo.baseAC + dexMod;
    }
    // Quality bonus
    const quality = equippedArmor.quality || 'common';
    ac += QUALITY_BONUSES[quality]?.armor || 0;
  }

  // Shield bonus: an explicit acBonus wins; otherwise a name-only
  // shield (Arms & Armor variant) gives its bonus, Buckler +1, most +2.
  const shieldBonus = equipment.offHand?.acBonus ?? shieldBonusForOffHand(equipment.offHand?.name);
  if (shieldBonus) {
    ac += shieldBonus;
  }

  // Defense fighting style (item 2): +1 AC while wearing armor.
  ac += defenseAcBonus(actor.feats, !!equippedArmor);

  // Calculate weapon stats
  let weaponInfo = null;
  const weapon = equipment.mainHand;
  if (weapon) {
    const table = lookupWeaponData(weapon.name);
    const properties = weapon.properties || table?.properties || [];
    const rangeType = weapon.rangeType || table?.rangeType;
    let damageDice = weapon.damage || table?.damage || '1d4';
    // Versatile (Step 2, v1.0.195): a table-driven weapon wielded in
    // two hands — off hand empty — deals its versatile die. An item's
    // own explicit damage field owns its dice outright (homebrew
    // items define themselves), so the swap applies only when the
    // die came from the table.
    const versatile = weapon.versatile || table?.versatile || null;
    if (!weapon.damage && versatile && !equipment.offHand) damageDice = versatile;
    const isFinesse = properties.includes('finesse');
    const isRanged = rangeType === 'ranged';
    const abilityMod = isFinesse ? Math.max(strMod, dexMod) : (isRanged ? dexMod : strMod);
    const qualityBonus = QUALITY_BONUSES[weapon.quality || 'common']?.weapon || 0;
    const attackBonus = abilityMod + profBonus + qualityBonus;
    const damageBonus = abilityMod >= 0 ? `+${abilityMod}` : `${abilityMod}`;

    weaponInfo = {
      name: weapon.name,
      quality: weapon.quality || 'common',
      attackBonus,
      damage: `${damageDice}${damageBonus}`,
      damageDice,
      damageModifier: abilityMod,
      damageType: weapon.damageType || table?.damageType || 'bludgeoning',
      properties,
      rangeType: rangeType || 'melee',
      mastery: weapon.mastery || table?.mastery || null,
      versatile,
      range: weapon.range || table?.range || null,
      offHandName: equipment.offHand?.name || null,
      // Item 2: two-handed wield = a two-handed property, or a versatile
      // weapon with the off hand empty (the versatile die already
      // swapped in above). Dueling / Great Weapon Fighting read this.
      twoHanded: properties.includes('two-handed') || (!!versatile && !equipment.offHand)
    };
  }

  // Off-hand weapon profile (combat item 1): same math as the main
  // hand, but never a versatile die (it is wielded one-handed by
  // definition) and never a shield — a shield name resolves to no
  // weapon, so offHandWeapon stays null. The caller zeroes the damage
  // modifier for an actual off-hand attack (2024: no ability modifier
  // to that damage); this profile carries the full modifier so the
  // number is computed in exactly one place.
  let offHandWeapon = null;
  const off = equipment.offHand;
  if (off) {
    const offTable = lookupWeaponData(off.name);
    if (offTable) {
      const offProperties = off.properties || offTable.properties || [];
      const offRangeType = off.rangeType || offTable.rangeType;
      const offDice = off.damage || offTable.damage || '1d4';
      const offIsFinesse = offProperties.includes('finesse');
      const offIsRanged = offRangeType === 'ranged';
      const offMod = offIsFinesse ? Math.max(strMod, dexMod) : (offIsRanged ? dexMod : strMod);
      const offQualityBonus = QUALITY_BONUSES[off.quality || 'common']?.weapon || 0;
      offHandWeapon = {
        name: off.name,
        quality: off.quality || 'common',
        attackBonus: offMod + profBonus + offQualityBonus,
        damageDice: offDice,
        damageModifier: offMod,
        damageType: off.damageType || offTable.damageType || 'bludgeoning',
        properties: offProperties,
        rangeType: offRangeType || 'melee',
        mastery: off.mastery || offTable.mastery || null,
        range: off.range || offTable.range || null
      };
    }
  }

  return { ac, weapon: weaponInfo, offHandWeapon };
}

/**
 * Spell attack profile for a caster: attack bonus and save DC from the
 * casting ability of their (primary) class. Returns null when the class
 * has no casting ability (non-casters).
 */
export function spellProfileFor(actor, className, subclassName = null) {
  const cls = String(className || '').toLowerCase().trim();
  // Subclass-dependent casting ability (overnight 7-class merge). Callers
  // that do not pass a subclass yet get null here — plumbing the subclass
  // through spellCastService's callers is a follow-up, flagged in the merge.
  let ability = CLASS_CASTING_ABILITY[cls];
  if (!ability && subclassName) {
    if (cls === 'magus') {
      const key = societyKeyForName(subclassName);
      ability = key ? SOCIETY_SPELLCASTING_ABILITY[key] : null;
    } else if (cls === 'warden') {
      const norm = String(subclassName).toLowerCase().trim().replace(/[\s-]+/g, '_');
      ability = CASTING_SUBCLASS_ABILITY[norm] || null;
    } else if (cls === 'scholar') {
      const norm = String(subclassName).toLowerCase().trim();
      ability = (norm === 'ritualist' || norm === 'theologian') ? 'int' : null;
    }
  }
  if (!ability) return null;
  const baseAbilities = typeof actor.ability_scores === 'string'
    ? safeParse(actor.ability_scores, {})
    : (actor.ability_scores || {});
  // Frost Exhaustion erodes spellcasting scores at this same math site.
  const abilities = erodeScores(baseAbilities, actor.frost_exhaustion ?? actor.frostExhaustion ?? 0);
  const full = { int: 'intelligence', wis: 'wisdom', cha: 'charisma' }[ability];
  const mod = abilityModifier(abilityScore(abilities, ability, full));
  const pb = proficiencyBonusForLevel(actor.level || 1);
  return { ability, modifier: mod, attackBonus: pb + mod, saveDc: 8 + pb + mod };
}

/**
 * DB helper for the PC: combat AC with its source. Equipment is the
 * truth when the character carries any equipment data — the computed
 * AC; otherwise the armor_class column is the only record and wins.
 */
export async function getPlayerCombatAc(characterId) {
  const c = await dbGet('SELECT armor_class, ability_scores, equipment, level, feats FROM characters WHERE id = ?', [characterId]);
  if (!c) return null;
  const equipment = typeof c.equipment === 'string' ? safeParse(c.equipment, {}) : (c.equipment || {});
  const hasEquipment = !!(equipment.armor || equipment.mainHand || equipment.offHand);
  if (hasEquipment) {
    return { ac: calculateCombatStats(c).ac, source: 'equipment' };
  }
  return { ac: c.armor_class || 10, source: 'column' };
}

export default { QUALITY_BONUSES, ARMOR_DATA, WEAPON_DATA, lookupWeaponData, parseMasteredWeapons, weaponIsMastered, MASTERY_CLASSES, classHasMastery, CLASS_CASTING_ABILITY, abilityModifier, proficiencyBonusForLevel, calculateCombatStats, spellProfileFor, getPlayerCombatAc };

