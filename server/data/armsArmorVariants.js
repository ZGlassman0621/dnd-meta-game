/**
 * armsArmorVariants.js — Arms & Armor (Troll Lord, 2018) brought into
 * the 2024 system, delineated.
 *
 * LIVE (wired into combatStatsService):
 *   - WEAPON_ALIASES: a variant name resolves to a canonical 2024
 *     weapon's stats. The display name stays the variant name; the
 *     numbers, properties, and mastery come from the canonical weapon.
 *     An item's own fields always win over both, as before.
 *   - ARMOR_VARIANTS: a variant armor name resolves to a canonical
 *     2024 armor's AC/type. No C&C AC bonus is imported, and layering
 *     (aketon/gambeson under or over) adds nothing — 2024 has no
 *     layering bonus, so "with aketon" variants map to their base armor.
 *   - SHIELD_BONUSES: a name-only shield in the off hand gives its
 *     bonus (+2, Buckler +1). An explicit acBonus on the item wins.
 *     Pavis and Tower are NOT in this map — they are cover, not shields.
 *
 * DATA ONLY (exported, not wired into combat):
 *   - HELMET_NAMES, ARMOR_COMPONENTS: description / loot vocabulary.
 *     2024 has no head slot and no piece-armor AC, so these change no AC.
 *   - AMMUNITION_VARIANTS: arrow types. Flight / Broadpoint are
 *     range/damage tradeoffs; the rest are flavor until a vs-armor
 *     ruling exists. No combat code consumes these yet.
 *   - PROPOSED_WEAPONS: genuinely new weapons from the sort that are
 *     NOT in WEAPON_DATA and are NOT returned by lookupWeaponData.
 *     Adding any of them is combat-item-1 work, with a mastery
 *     assignment, not something this module does silently.
 *   - PAVIS_COVER: deployable cover idea, not a shield bonus.
 *
 * NOT imported, anywhere: C&C damage dice (1d2/1d3/1d5/2d4+1),
 * C&C AC bonuses, C&C bow/crossbow ranges, C&C "vs armor" modifiers,
 * the bow draw-weight table, and the martial-arts table. Those are
 * subsystems or new rules, not conversions.
 *
 * Alias grouping rule, stated so it can be checked: swords, knives,
 * axes, spears, and polearms are grouped by their 2024 damage
 * profile, not by exact historical equivalence. A shamshir and a
 * scimitar are both 1d6 finesse slashing in 2024 terms; a bardiche
 * and a halberd are both reach heavy slashing polearms. If a
 * grouping is wrong for a specific item, fix the one alias line —
 * do not add a new weapon for it.
 */

const norm = (name) =>
  String(name || '').toLowerCase().trim().replace(/,/g, '').replace(/\s+/g, ' ');

function buildLookup(map) {
  const out = new Map();
  for (const [k, v] of Object.entries(map)) out.set(norm(k), v);
  return out;
}

// Variant name -> canonical 2024 weapon name (must exist in WEAPON_DATA).
export const WEAPON_ALIASES = {
  'Baculus': 'Club', 'Baggoro': 'Club', 'Baston': 'Club', 'Budd': 'Club',
  'Cudgel': 'Club', 'Gata': 'Club', 'Tambara': 'Club', 'Vajra': 'Club',
  'Nunchaku': 'Club', 'Nunchaku wood': 'Club', 'Nunchaku metal': 'Club',
  'Staff': 'Quarterstaff', 'Three-sectional staff': 'Quarterstaff',
  'Godentag': 'Greatclub', 'Goedendag': 'Greatclub',
  'Mace foot round': 'Mace', 'Mace foot flanged': 'Mace',
  'Mace large round': 'Mace', 'Mace large flanged': 'Mace',
  'Mace heavy round': 'Mace', 'Mace heavy flanged': 'Warhammer',
  'Morningstar light': 'Morningstar', 'Morningstar medium': 'Morningstar',
  'Morningstar heavy': 'Morningstar', 'Maul battle': 'Maul',
  'Hammer light war': 'Light Hammer', 'Hammer light spiked': 'Light Hammer',
  'Hammer heavy war': 'Warhammer', 'Hammer heavy spiked': 'Warhammer',
  'Flail wood 1 hand': 'Flail', 'Flail wood 2 hand': 'Flail',
  'Flail metal 1 hand': 'Flail', 'Flail metal 2 hand': 'Flail',
  'Flail military wood 1h': 'Flail', 'Flail military metal 2h': 'Flail',
  'Flail military wood 1 hand': 'Flail', 'Flail military metal 2 hand': 'Flail',
  'Aikuchi': 'Dagger', 'Bada Bade Knife': 'Dagger', 'Badik': 'Dagger',
  'Balisong': 'Dagger', 'Barong': 'Dagger', 'Bichaq': 'Dagger',
  'Bolo': 'Dagger', 'Choora': 'Dagger', 'Dirk': 'Dagger',
  'Dha Montegnard': 'Dagger', 'Dha Naga': 'Dagger', 'Flatchet': 'Dagger',
  'Golok': 'Dagger', 'Kard': 'Dagger', 'Kinjal': 'Dagger',
  'Kukri': 'Dagger', 'Navaja': 'Dagger', 'Navaja Sevillana': 'Dagger',
  'Rampuri Chaku': 'Dagger', 'Rentjang': 'Dagger', 'Seax': 'Dagger',
  'Talibon': 'Dagger', 'Akinaka': 'Dagger', 'Baselard': 'Dagger',
  'Baswa': 'Dagger', 'Batardeau': 'Dagger', 'Bayu': 'Dagger',
  'Bichua': 'Dagger', 'Billao': 'Dagger', 'Bodkin': 'Dagger',
  'Bollock': 'Dagger', 'Bracelet dagger': 'Dagger', 'Buyu': 'Dagger',
  'Chilanum': 'Dagger', 'Cinqueda': 'Dagger', 'Estradoit': 'Dagger',
  'Kris': 'Dagger', 'Pongiard': 'Dagger', 'Pugio': 'Dagger',
  'Sica': 'Dagger', 'Bank Sickle Knife': 'Dagger', 'Beladau': 'Dagger',
  'Cleaver': 'Dagger', 'Karambit': 'Dagger', 'Katar': 'Dagger',
  'Kuba': 'Dagger', 'Kujang': 'Dagger', 'Dacian Falx': 'Dagger',
  'Main Gauche': 'Dagger', 'Trident Dagger': 'Dagger',
  'Gladius Mainz': 'Shortsword', 'Gladius Pompeii': 'Shortsword',
  'Xiphos': 'Shortsword', 'Seme': 'Shortsword', 'Wakizashi': 'Shortsword',
  'Small Sword': 'Shortsword', 'Seax long': 'Shortsword',
  'Katzbalger': 'Shortsword',
  'Arming Sword': 'Longsword', 'Arslentepe': 'Longsword',
  'Babnga': 'Longsword', 'Bilbo': 'Longsword', "Carp's Tongue": 'Longsword',
  'Espada Rotera': 'Longsword', 'Gladius Hispaniensis': 'Longsword',
  'Gupti': 'Longsword', 'Jian': 'Longsword', 'Kalis': 'Longsword',
  'Khanda': 'Longsword', 'Merovingian': 'Longsword',
  'Mortuary Sword': 'Longsword', 'Spatha': 'Longsword',
  'Takouba': 'Longsword', 'Ulfberht': 'Longsword',
  'Viking Sword': 'Longsword', 'Bastard sword': 'Longsword',
  'Broadsword': 'Longsword', 'Falchion': 'Longsword',
  'Kampilan': 'Longsword', 'Pulwar': 'Longsword', 'Tegha': 'Longsword',
  'Kilij': 'Longsword', 'Shotel': 'Longsword',
  'Claymore': 'Greatsword', 'Two handed Sword': 'Greatsword',
  'Flamberge': 'Greatsword', "Executioner's Sword": 'Greatsword',
  'Scimitar great': 'Greatsword', 'Great Scimitar': 'Greatsword',
  'Colichimarde': 'Rapier',
  'Ayda Katti': 'Scimitar', 'Badelaire': 'Scimitar', 'Cutlass': 'Scimitar',
  'Dahong Balay': 'Scimitar', 'Falcata': 'Scimitar', 'Firangi': 'Scimitar',
  'Flyssa short': 'Scimitar', 'Flyssa long': 'Scimitar',
  'Kachin Dha': 'Scimitar', 'Karbela': 'Scimitar', 'Katana': 'Scimitar',
  'Khopesh': 'Scimitar', 'Klewang': 'Scimitar', 'Kopis': 'Scimitar',
  'Makhaira': 'Scimitar', 'Messer': 'Scimitar', 'Nimcha': 'Scimitar',
  'Pallacsh': 'Scimitar', 'Pandat': 'Scimitar', 'Saber': 'Scimitar',
  'Saif': 'Scimitar', 'Schnepfer': 'Scimitar', 'Scimitar': 'Scimitar',
  'Shamshir': 'Scimitar', 'Shaska': 'Scimitar',
  'Sikin Panyang': 'Scimitar', 'Sosun-Pattah': 'Scimitar',
  'Spadroon': 'Scimitar', 'Surik': 'Scimitar', 'Szabla': 'Scimitar',
  'Talwar': 'Scimitar', 'Tachi': 'Scimitar', 'Yatagan': 'Scimitar',
  'Battle Axe': 'Battleaxe', 'Bearded battle axe': 'Battleaxe',
  'Double bladed axe': 'Greataxe', 'Two handed axe': 'Greataxe',
  'Rhomphaia': 'Greataxe', 'Hatchet': 'Handaxe', 'Throwing Axe': 'Handaxe',
  'Pick light': 'War Pick', 'Pick heavy': 'War Pick',
  'Piercing axe': 'War Pick', 'Crowbill': 'War Pick',
  'Assegai': 'Spear', 'Boar Spear': 'Spear', 'Bear Spear': 'Spear',
  'Budiak': 'Spear', 'Cape Assegai': 'Spear', 'Dung short': 'Spear',
  'Dung long': 'Spear', 'Framea': 'Spear', 'Hasta': 'Spear',
  'Iklwa': 'Spear', 'Kikuchi yari': 'Spear', 'Qiang': 'Spear',
  'Sankaku Yari': 'Spear', 'Sang': 'Spear', 'Viking Spear': 'Spear',
  'Nandum': 'Spear', 'Javelin': 'Javelin', 'Pilum': 'Javelin',
  'Lance Heavy': 'Lance', 'Lance light': 'Lance',
  'Pike': 'Pike', 'Kontos': 'Pike', 'Viking Broad Spear': 'Pike',
  'Partizan': 'Pike', 'Ranseur': 'Pike',
  'Trident': 'Trident', 'Trishula': 'Trident',
  'Glaive': 'Glaive', 'Glaive Gisarme': 'Glaive', 'Gisarme': 'Glaive',
  'Naginata': 'Glaive', 'Fauchard': 'Glaive', 'Fauchard Fork': 'Glaive',
  'Hook': 'Glaive',
  'Halberd': 'Halberd', 'Bardiche': 'Halberd', 'Voulge': 'Halberd',
  'Bec de Corbin': 'Halberd', 'Lucerne Hammer': 'Halberd',
  'Billhook': 'Halberd', 'Dacian Falx polearm': 'Halberd',
  'War Scythe': 'Halberd', 'Ji': 'Halberd', 'Spontoon': 'Halberd',
  'Dart': 'Dart', 'Sling': 'Sling', 'Staff sling': 'Sling',
  'Whip': 'Whip', 'Cat-O-Nine Tails': 'Whip',
  'Harpoon': 'Javelin', 'Throwing stick': 'Club',
  'Skull crusher': 'Club',
  'Arcus I': 'Shortbow', 'Assyrian Angular': 'Shortbow',
  'Egyptian I': 'Shortbow', 'Greek Bow': 'Shortbow', 'Hun I': 'Shortbow',
  'Scythian I': 'Shortbow', 'Scythian smallbow': 'Shortbow',
  'Smallbow composite': 'Shortbow', 'Viking I': 'Shortbow',
  'Native American Bow': 'Shortbow',
  'Arcus II': 'Longbow', 'Assyrian Curved': 'Longbow',
  'Egyptian II': 'Longbow', 'Gungdo': 'Longbow', 'Hun II': 'Longbow',
  'Hun asymmetric': 'Longbow', 'Mongolian Bow': 'Longbow',
  'Turkish Bow': 'Longbow', 'Viking Bow II': 'Longbow',
  'English Longbow': 'Longbow', 'Quing Horn Bow': 'Longbow',
  'Wooden light Crossbow': 'Light Crossbow',
  'Composite light Crossbow': 'Light Crossbow',
  'Steel light Crossbow': 'Light Crossbow',
  'Wooden heavy Crossbow': 'Heavy Crossbow',
  'Composite heavy Crossbow': 'Heavy Crossbow',
  'Steel heavy Crossbow': 'Heavy Crossbow',
  'Gastraphetes': 'Heavy Crossbow',
  'Pistol Crossbow': 'Hand Crossbow'
};

const WEAPON_ALIAS_LOOKUP = buildLookup(WEAPON_ALIASES);
export function resolveWeaponAlias(name) {
  return WEAPON_ALIAS_LOOKUP.get(norm(name)) || null;
}

export const ARMOR_VARIANTS = {
  // PHB display names (2026-10-31 fix): ARMOR_DATA keys are short
  // ('Leather'), but inventory/PHB text uses the full display name
  // ('Leather Armor'). Without these aliases the name resolved to
  // nothing and calculateCombatStats silently fell back to unarmored
  // AC — armor that counted as no armor. The other PHB names
  // (Chain Shirt, Scale Mail, Plate, ...) already match ARMOR_DATA
  // keys exactly and need no alias.
  'Padded Armor': 'Padded', 'Leather Armor': 'Leather',
  'Studded Leather Armor': 'Studded Leather', 'Hide Armor': 'Hide',
  'Padded jerkin': 'Padded', 'Padded suit': 'Padded',
  'Aketon jerkin': 'Padded', 'Aketon suit': 'Padded',
  'Gambeson jerkin': 'Padded', 'Gambeson suit': 'Padded',
  'Leather light': 'Leather', 'Leather suit': 'Leather',
  'Leather coat': 'Leather', 'Leather with aketon': 'Leather',
  'Cuir Bouille': 'Leather', 'Cuir Bouille suit with aketon': 'Leather',
  'Studded leather': 'Studded Leather',
  'Studded leather with aketon': 'Studded Leather',
  'Hide': 'Hide', 'Hide with aketon': 'Hide',
  'Birnie': 'Chain Shirt', 'Byrnie': 'Chain Shirt', 'Jazerant': 'Chain Shirt',
  'Scale leather bone wood': 'Scale Mail',
  'Scale leather with aketon': 'Scale Mail',
  'Scale metal': 'Scale Mail', 'Scale metal with aketon': 'Scale Mail',
  'Lamellar wood or bone': 'Scale Mail',
  'Lamellar wood/bone with aketon': 'Scale Mail',
  'Lamellar leather': 'Scale Mail', 'Lamellar metal': 'Scale Mail',
  'Lamellar metal with aketon': 'Scale Mail',
  'Laminar leather bone': 'Scale Mail', 'Laminar metal': 'Scale Mail',
  'Brigandine': 'Scale Mail',
  'Roman ensemble plumata': 'Scale Mail',
  'Breastplate bronze': 'Breastplate', 'Breastplate iron': 'Breastplate',
  'Coat of Plates': 'Breastplate',
  'Greek ensemble bronze': 'Breastplate', 'Greek ensemble iron': 'Breastplate',
  'Roman ensemble lorica': 'Breastplate',
  'Plate and Mail': 'Half Plate',
  'Ring Mail': 'Ring Mail',
  'Mail hauberk': 'Chain Mail', 'Full chain suit': 'Chain Mail',
  'Banded Mail': 'Chain Mail',
  'Splint leather': 'Splint', 'Splint metal': 'Splint',
  'Plate full': 'Plate', 'Plate gothic': 'Plate',
  'Full Plate': 'Plate', 'Gothic Plate': 'Plate'
};

const ARMOR_VARIANT_LOOKUP = buildLookup(ARMOR_VARIANTS);
export function resolveArmorVariant(name) {
  return ARMOR_VARIANT_LOOKUP.get(norm(name)) || null;
}

export const SHIELD_BONUSES = {
  'Buckler': 1,
  'Small hide': 2, 'Small wood': 2, 'Small metal': 2,
  'Medium hide': 2, 'Medium wood': 2, 'Medium metal': 2,
  'Large hide': 2, 'Large wood': 2, 'Large metal': 2,
  'Aspis': 2, 'Dipylon': 2, 'Targe': 2, 'Heater wood': 2,
  'Adarga': 2, 'Viking Shield': 2, 'Kite Shield': 2, 'Parma': 2,
  'Pelta': 2, 'Target': 2, 'Gothic Shield': 2, 'Round Shield': 2,
  'Bilobial Shield': 2, 'Rectangular Shield': 2, 'Tear drop Shield': 2,
  'Oval Shield': 2, 'Shield': 2
};

const SHIELD_LOOKUP = buildLookup(SHIELD_BONUSES);
export function shieldBonusForOffHand(name) {
  if (!name) return 0;
  return SHIELD_LOOKUP.get(norm(name)) || 0;
}

export const HELMET_NAMES = [
  'Armet', 'Arming Cap', 'Attic Helm', 'Coif mail', 'Conical Helm',
  'Corinthian Helm', 'Barbutte', 'Bassinet', 'Burgonet', 'Close Helm',
  'Dog-faced Bassinet', 'Galea', 'Great Helm', 'Kabuto', 'Kettle Hat',
  'Kulah Khud', 'Misiurka', 'Morion Helm', 'Polish Hussar', 'Pot-helm',
  'Sassanian', 'Spangenhelm', 'Valsgarde Helm', 'Sallet', 'War Hat',
  'Zischagge'
];

export const ARMOR_COMPONENTS = [
  'Ailette', 'Arret', 'Aventail', 'Avant-bras', 'Bazu Bands', 'Besagew',
  'Bevor', 'Bracer', 'Brassard', 'Camail', 'Chausses', 'Comb', 'Couter',
  'Culet', 'Demi-brassart', 'Demi-jambart', 'Epauileres', 'Falling Buffe',
  'Fan Plates', 'Faulds', 'Gauntlet', 'Gorget', 'Gousset', 'Greave',
  'Hoguine', 'Jambart', 'Lame', 'Manica', 'Pectorale', 'Pixane',
  'Plakart', 'Plasteon', 'Poleyn', 'Rerebrace', 'Roundrel', 'Sabbaton',
  'Shinbald', 'Spaulder', 'Taces', 'Vambrace', 'Visor'
];

export const AMMUNITION_VARIANTS = {
  'Flight Arrow': { damageModifier: -1, rangeModifierFt: 200, note: 'Longer range, lighter hit.' },
  'Broadpoint Arrow': { damageModifier: 1, rangeModifierFt: -200, note: 'Heavier hit, shorter range.' },
  'Bodkin Arrow': { damageModifier: 0, rangeModifierFt: 0, note: 'Armor-piercing point. No vs-armor rule in 2024 — flavor until ruled.' },
  'Whistling Arrow': { damageModifier: 0, rangeModifierFt: 0, note: 'Signals / intimidation, not damage.' },
  'Blunt Arrow': { damageModifier: -1, rangeModifierFt: 0, note: 'Blunt head.' },
  'Swallowtail Arrow': { damageModifier: 1, rangeModifierFt: 0, note: 'Barbed head; extra damage on removal is a DM ruling, not wired.' },
  'Pyeonjeon': { damageModifier: 0, rangeModifierFt: 0, note: 'Small bolt carried in a shaft.' }
};

export const PROPOSED_WEAPONS = {
  'Hooked Polearm': {
    status: 'proposed', sourceNote: 'Gisarme / billhook / ranseur / fauchard fork, one weapon not twelve.',
    proposed: { damage: '1d10', damageType: 'slashing', category: 'martial', properties: ['heavy', 'reach', 'two-handed'] },
    trait: 'Dismount / disarm as a DM note. App tracks neither yet.', mastery: 'TBD'
  },
  'Brass Knuckles': {
    status: 'proposed', sourceNote: 'Worn unarmed boost; 2024 unarmed strike has no item for it.',
    proposed: { damage: '1d4', damageType: 'bludgeoning', category: 'simple', properties: ['light'] },
    trait: 'Worn, not held.', mastery: 'TBD'
  },
  'Bolas': {
    status: 'proposed', sourceNote: 'Thrown entangling weapon, not a damage weapon.',
    proposed: { damage: '1d4', damageType: 'bludgeoning', category: 'simple', properties: ['thrown'], range: '20/60' },
    trait: 'Entangle / restrain on hit — save and escape TBD.', mastery: 'TBD'
  },
  'Meteor Hammer': {
    status: 'proposed', sourceNote: 'Chain weapon, ~8 ft striking range in the book.',
    proposed: { damage: '1d6', damageType: 'bludgeoning', category: 'martial', properties: ['reach', 'two-handed'] },
    trait: 'Exotic. Closest live weapons are Whip (reach, slashing) and Flail (no reach).', mastery: 'TBD'
  },
  'Estoc': {
    status: 'proposed', sourceNote: 'Two-handed thrusting sword, no edge.',
    proposed: { damage: '1d10', damageType: 'piercing', category: 'martial', properties: ['heavy', 'two-handed'] },
    trait: 'Fills the heavy two-handed piercing non-reach gap.', mastery: 'TBD'
  },
  'Repeating Crossbow': {
    status: 'proposed', sourceNote: 'Mechanism, not just a heavier crossbow.',
    proposed: { damage: '1d6', damageType: 'piercing', category: 'martial', properties: ['ammunition', 'loading'], range: '30/120' },
    trait: 'Loading mechanism needs a ruling before it is live.', mastery: 'TBD'
  },
  'Man Catcher': {
    status: 'proposed', sourceNote: 'Capture tool.',
    proposed: { damage: '1d2', damageType: 'bludgeoning', category: 'martial', properties: ['reach', 'two-handed'] },
    trait: 'Capture / grapple effect TBD. Niche.', mastery: 'TBD'
  },
  'Sleeve Tangler': {
    status: 'proposed', sourceNote: 'Capture tool, see Man Catcher.',
    proposed: { damage: '1d4', damageType: 'bludgeoning', category: 'martial', properties: [] },
    trait: 'Capture / entangle effect TBD. Niche.', mastery: 'TBD'
  },
  'Parrying Dagger': {
    status: 'proposed', sourceNote: 'Main Gauche / Trident Dagger / Sai in the book.',
    proposed: { damage: '1d4', damageType: 'piercing', category: 'martial', properties: ['finesse', 'light'] },
    trait: '+1 AC when parrying off-hand. Overlaps Dual Wielder feat — stacking needs a ruling.', mastery: 'TBD'
  }
};

export const PAVIS_COVER = {
  status: 'proposed-not-a-shield',
  note: 'Pavis / Tower Shield as deployable cover for a ranged attacker. Not a worn +AC item. Needs a cover-system decision before wiring.'
};

export default {
  WEAPON_ALIASES, resolveWeaponAlias,
  ARMOR_VARIANTS, resolveArmorVariant,
  SHIELD_BONUSES, shieldBonusForOffHand,
  HELMET_NAMES, ARMOR_COMPONENTS,
  AMMUNITION_VARIANTS, PROPOSED_WEAPONS, PAVIS_COVER
};
