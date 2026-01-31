// D&D 5e Level Progression Configuration
// XP thresholds are cumulative totals needed to reach each level

const XP_THRESHOLDS = {
  1: 0,
  2: 300,
  3: 900,
  4: 2700,
  5: 6500,
  6: 14000,
  7: 23000,
  8: 34000,
  9: 48000,
  10: 64000,
  11: 85000,
  12: 100000,
  13: 120000,
  14: 140000,
  15: 165000,
  16: 195000,
  17: 225000,
  18: 265000,
  19: 305000,
  20: 355000
}

// Proficiency bonus by level
const PROFICIENCY_BONUS = {
  1: 2, 2: 2, 3: 2, 4: 2,
  5: 3, 6: 3, 7: 3, 8: 3,
  9: 4, 10: 4, 11: 4, 12: 4,
  13: 5, 14: 5, 15: 5, 16: 5,
  17: 6, 18: 6, 19: 6, 20: 6
}

// Levels at which characters get Ability Score Improvements (or Feats)
// Note: Fighters get extra at 6 and 14, Rogues get extra at 10
const ASI_LEVELS = {
  default: [4, 8, 12, 16, 19],
  fighter: [4, 6, 8, 12, 14, 16, 19],
  rogue: [4, 8, 10, 12, 16, 19]
}

// Class features by level for each class
// This defines what features are gained at each level
const CLASS_FEATURES = {
  barbarian: {
    1: ['Rage', 'Unarmored Defense'],
    2: ['Reckless Attack', 'Danger Sense'],
    3: ['Primal Path'], // Subclass selection
    4: ['Ability Score Improvement'],
    5: ['Extra Attack', 'Fast Movement'],
    6: ['Path Feature'],
    7: ['Feral Instinct'],
    8: ['Ability Score Improvement'],
    9: ['Brutal Critical (1 die)'],
    10: ['Path Feature'],
    11: ['Relentless Rage'],
    12: ['Ability Score Improvement'],
    13: ['Brutal Critical (2 dice)'],
    14: ['Path Feature'],
    15: ['Persistent Rage'],
    16: ['Ability Score Improvement'],
    17: ['Brutal Critical (3 dice)'],
    18: ['Indomitable Might'],
    19: ['Ability Score Improvement'],
    20: ['Primal Champion']
  },
  bard: {
    1: ['Spellcasting', 'Bardic Inspiration (d6)'],
    2: ['Jack of All Trades', 'Song of Rest (d6)'],
    3: ['Bard College', 'Expertise'],
    4: ['Ability Score Improvement'],
    5: ['Bardic Inspiration (d8)', 'Font of Inspiration'],
    6: ['Countercharm', 'College Feature'],
    7: [],
    8: ['Ability Score Improvement'],
    9: ['Song of Rest (d8)'],
    10: ['Bardic Inspiration (d10)', 'Expertise', 'Magical Secrets'],
    11: [],
    12: ['Ability Score Improvement'],
    13: ['Song of Rest (d10)'],
    14: ['Magical Secrets', 'College Feature'],
    15: ['Bardic Inspiration (d12)'],
    16: ['Ability Score Improvement'],
    17: ['Song of Rest (d12)'],
    18: ['Magical Secrets'],
    19: ['Ability Score Improvement'],
    20: ['Superior Inspiration']
  },
  cleric: {
    1: ['Spellcasting', 'Divine Domain'],
    2: ['Channel Divinity (1/rest)', 'Domain Feature'],
    3: [],
    4: ['Ability Score Improvement'],
    5: ['Destroy Undead (CR 1/2)'],
    6: ['Channel Divinity (2/rest)', 'Domain Feature'],
    7: [],
    8: ['Ability Score Improvement', 'Destroy Undead (CR 1)', 'Domain Feature'],
    9: [],
    10: ['Divine Intervention'],
    11: ['Destroy Undead (CR 2)'],
    12: ['Ability Score Improvement'],
    13: [],
    14: ['Destroy Undead (CR 3)'],
    15: [],
    16: ['Ability Score Improvement'],
    17: ['Destroy Undead (CR 4)', 'Domain Feature'],
    18: ['Channel Divinity (3/rest)'],
    19: ['Ability Score Improvement'],
    20: ['Divine Intervention Improvement']
  },
  druid: {
    1: ['Druidic', 'Spellcasting'],
    2: ['Wild Shape', 'Druid Circle'],
    3: [],
    4: ['Wild Shape Improvement', 'Ability Score Improvement'],
    5: [],
    6: ['Circle Feature'],
    7: [],
    8: ['Wild Shape Improvement', 'Ability Score Improvement'],
    9: [],
    10: ['Circle Feature'],
    11: [],
    12: ['Ability Score Improvement'],
    13: [],
    14: ['Circle Feature'],
    15: [],
    16: ['Ability Score Improvement'],
    17: [],
    18: ['Timeless Body', 'Beast Spells'],
    19: ['Ability Score Improvement'],
    20: ['Archdruid']
  },
  fighter: {
    1: ['Fighting Style', 'Second Wind'],
    2: ['Action Surge (1 use)'],
    3: ['Martial Archetype'],
    4: ['Ability Score Improvement'],
    5: ['Extra Attack'],
    6: ['Ability Score Improvement'],
    7: ['Archetype Feature'],
    8: ['Ability Score Improvement'],
    9: ['Indomitable (1 use)'],
    10: ['Archetype Feature'],
    11: ['Extra Attack (2)'],
    12: ['Ability Score Improvement'],
    13: ['Indomitable (2 uses)'],
    14: ['Ability Score Improvement'],
    15: ['Archetype Feature'],
    16: ['Ability Score Improvement'],
    17: ['Action Surge (2 uses)', 'Indomitable (3 uses)'],
    18: ['Archetype Feature'],
    19: ['Ability Score Improvement'],
    20: ['Extra Attack (3)']
  },
  monk: {
    1: ['Unarmored Defense', 'Martial Arts'],
    2: ['Ki', 'Unarmored Movement'],
    3: ['Monastic Tradition', 'Deflect Missiles'],
    4: ['Ability Score Improvement', 'Slow Fall'],
    5: ['Extra Attack', 'Stunning Strike'],
    6: ['Ki-Empowered Strikes', 'Tradition Feature'],
    7: ['Evasion', 'Stillness of Mind'],
    8: ['Ability Score Improvement'],
    9: ['Unarmored Movement Improvement'],
    10: ['Purity of Body'],
    11: ['Tradition Feature'],
    12: ['Ability Score Improvement'],
    13: ['Tongue of the Sun and Moon'],
    14: ['Diamond Soul'],
    15: ['Timeless Body'],
    16: ['Ability Score Improvement'],
    17: ['Tradition Feature'],
    18: ['Empty Body'],
    19: ['Ability Score Improvement'],
    20: ['Perfect Self']
  },
  paladin: {
    1: ['Divine Sense', 'Lay on Hands'],
    2: ['Fighting Style', 'Spellcasting', 'Divine Smite'],
    3: ['Divine Health', 'Sacred Oath'],
    4: ['Ability Score Improvement'],
    5: ['Extra Attack'],
    6: ['Aura of Protection'],
    7: ['Oath Feature'],
    8: ['Ability Score Improvement'],
    9: [],
    10: ['Aura of Courage'],
    11: ['Improved Divine Smite'],
    12: ['Ability Score Improvement'],
    13: [],
    14: ['Cleansing Touch'],
    15: ['Oath Feature'],
    16: ['Ability Score Improvement'],
    17: [],
    18: ['Aura Improvements'],
    19: ['Ability Score Improvement'],
    20: ['Oath Feature']
  },
  ranger: {
    1: ['Favored Enemy', 'Natural Explorer'],
    2: ['Fighting Style', 'Spellcasting'],
    3: ['Ranger Archetype', 'Primeval Awareness'],
    4: ['Ability Score Improvement'],
    5: ['Extra Attack'],
    6: ['Favored Enemy Improvement', 'Natural Explorer Improvement'],
    7: ['Archetype Feature'],
    8: ['Ability Score Improvement', "Land's Stride"],
    9: [],
    10: ['Natural Explorer Improvement', 'Hide in Plain Sight'],
    11: ['Archetype Feature'],
    12: ['Ability Score Improvement'],
    13: [],
    14: ['Favored Enemy Improvement', 'Vanish'],
    15: ['Archetype Feature'],
    16: ['Ability Score Improvement'],
    17: [],
    18: ['Feral Senses'],
    19: ['Ability Score Improvement'],
    20: ['Foe Slayer']
  },
  rogue: {
    1: ['Expertise', 'Sneak Attack', "Thieves' Cant"],
    2: ['Cunning Action'],
    3: ['Roguish Archetype'],
    4: ['Ability Score Improvement'],
    5: ['Uncanny Dodge'],
    6: ['Expertise'],
    7: ['Evasion'],
    8: ['Ability Score Improvement'],
    9: ['Archetype Feature'],
    10: ['Ability Score Improvement'],
    11: ['Reliable Talent'],
    12: ['Ability Score Improvement'],
    13: ['Archetype Feature'],
    14: ['Blindsense'],
    15: ['Slippery Mind'],
    16: ['Ability Score Improvement'],
    17: ['Archetype Feature'],
    18: ['Elusive'],
    19: ['Ability Score Improvement'],
    20: ['Stroke of Luck']
  },
  sorcerer: {
    1: ['Spellcasting', 'Sorcerous Origin'],
    2: ['Font of Magic'],
    3: ['Metamagic'],
    4: ['Ability Score Improvement'],
    5: [],
    6: ['Origin Feature'],
    7: [],
    8: ['Ability Score Improvement'],
    9: [],
    10: ['Metamagic'],
    11: [],
    12: ['Ability Score Improvement'],
    13: [],
    14: ['Origin Feature'],
    15: [],
    16: ['Ability Score Improvement'],
    17: ['Metamagic'],
    18: ['Origin Feature'],
    19: ['Ability Score Improvement'],
    20: ['Sorcerous Restoration']
  },
  warlock: {
    1: ['Otherworldly Patron', 'Pact Magic'],
    2: ['Eldritch Invocations'],
    3: ['Pact Boon'],
    4: ['Ability Score Improvement'],
    5: [],
    6: ['Patron Feature'],
    7: [],
    8: ['Ability Score Improvement'],
    9: [],
    10: ['Patron Feature'],
    11: ['Mystic Arcanum (6th level)'],
    12: ['Ability Score Improvement'],
    13: ['Mystic Arcanum (7th level)'],
    14: ['Patron Feature'],
    15: ['Mystic Arcanum (8th level)'],
    16: ['Ability Score Improvement'],
    17: ['Mystic Arcanum (9th level)'],
    18: [],
    19: ['Ability Score Improvement'],
    20: ['Eldritch Master']
  },
  wizard: {
    1: ['Spellcasting', 'Arcane Recovery'],
    2: ['Arcane Tradition'],
    3: [],
    4: ['Ability Score Improvement'],
    5: [],
    6: ['Tradition Feature'],
    7: [],
    8: ['Ability Score Improvement'],
    9: [],
    10: ['Tradition Feature'],
    11: [],
    12: ['Ability Score Improvement'],
    13: [],
    14: ['Tradition Feature'],
    15: [],
    16: ['Ability Score Improvement'],
    17: [],
    18: ['Spell Mastery'],
    19: ['Ability Score Improvement'],
    20: ['Signature Spells']
  },
  artificer: {
    1: ['Magical Tinkering', 'Spellcasting'],
    2: ['Infuse Item'],
    3: ['Artificer Specialist', 'The Right Tool for the Job'],
    4: ['Ability Score Improvement'],
    5: ['Specialist Feature'],
    6: ['Tool Expertise'],
    7: ['Flash of Genius'],
    8: ['Ability Score Improvement'],
    9: ['Specialist Feature'],
    10: ['Magic Item Adept'],
    11: ['Spell-Storing Item'],
    12: ['Ability Score Improvement'],
    13: [],
    14: ['Magic Item Savant'],
    15: ['Specialist Feature'],
    16: ['Ability Score Improvement'],
    17: [],
    18: ['Magic Item Master'],
    19: ['Ability Score Improvement'],
    20: ['Soul of Artifice']
  }
}

// Subclass selection levels by class
const SUBCLASS_LEVELS = {
  barbarian: 3,
  bard: 3,
  cleric: 1,
  druid: 2,
  fighter: 3,
  monk: 3,
  paladin: 3,
  ranger: 3,
  rogue: 3,
  sorcerer: 1,
  warlock: 1,
  wizard: 2,
  artificer: 3
}

// Spell slots by level for full casters (Bard, Cleric, Druid, Sorcerer, Wizard)
const FULL_CASTER_SPELL_SLOTS = {
  1:  { 1: 2 },
  2:  { 1: 3 },
  3:  { 1: 4, 2: 2 },
  4:  { 1: 4, 2: 3 },
  5:  { 1: 4, 2: 3, 3: 2 },
  6:  { 1: 4, 2: 3, 3: 3 },
  7:  { 1: 4, 2: 3, 3: 3, 4: 1 },
  8:  { 1: 4, 2: 3, 3: 3, 4: 2 },
  9:  { 1: 4, 2: 3, 3: 3, 4: 3, 5: 1 },
  10: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2 },
  11: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1 },
  12: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1 },
  13: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1 },
  14: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1 },
  15: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1, 8: 1 },
  16: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1, 8: 1 },
  17: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1, 8: 1, 9: 1 },
  18: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 3, 6: 1, 7: 1, 8: 1, 9: 1 },
  19: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 3, 6: 2, 7: 1, 8: 1, 9: 1 },
  20: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 3, 6: 2, 7: 2, 8: 1, 9: 1 }
}

// Half caster spell slots (Paladin, Ranger, Artificer)
const HALF_CASTER_SPELL_SLOTS = {
  1:  {},
  2:  { 1: 2 },
  3:  { 1: 3 },
  4:  { 1: 3 },
  5:  { 1: 4, 2: 2 },
  6:  { 1: 4, 2: 2 },
  7:  { 1: 4, 2: 3 },
  8:  { 1: 4, 2: 3 },
  9:  { 1: 4, 2: 3, 3: 2 },
  10: { 1: 4, 2: 3, 3: 2 },
  11: { 1: 4, 2: 3, 3: 3 },
  12: { 1: 4, 2: 3, 3: 3 },
  13: { 1: 4, 2: 3, 3: 3, 4: 1 },
  14: { 1: 4, 2: 3, 3: 3, 4: 1 },
  15: { 1: 4, 2: 3, 3: 3, 4: 2 },
  16: { 1: 4, 2: 3, 3: 3, 4: 2 },
  17: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 1 },
  18: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 1 },
  19: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2 },
  20: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2 }
}

// Warlock Pact Magic slots (special progression)
const WARLOCK_SPELL_SLOTS = {
  1:  { slots: 1, level: 1 },
  2:  { slots: 2, level: 1 },
  3:  { slots: 2, level: 2 },
  4:  { slots: 2, level: 2 },
  5:  { slots: 2, level: 3 },
  6:  { slots: 2, level: 3 },
  7:  { slots: 2, level: 4 },
  8:  { slots: 2, level: 4 },
  9:  { slots: 2, level: 5 },
  10: { slots: 2, level: 5 },
  11: { slots: 3, level: 5 },
  12: { slots: 3, level: 5 },
  13: { slots: 3, level: 5 },
  14: { slots: 3, level: 5 },
  15: { slots: 3, level: 5 },
  16: { slots: 3, level: 5 },
  17: { slots: 4, level: 5 },
  18: { slots: 4, level: 5 },
  19: { slots: 4, level: 5 },
  20: { slots: 4, level: 5 }
}

// Artificer spell slots (starts at level 1, uses half-caster rounded up)
const ARTIFICER_SPELL_SLOTS = {
  1:  { 1: 2 },
  2:  { 1: 2 },
  3:  { 1: 3 },
  4:  { 1: 3 },
  5:  { 1: 4, 2: 2 },
  6:  { 1: 4, 2: 2 },
  7:  { 1: 4, 2: 3 },
  8:  { 1: 4, 2: 3 },
  9:  { 1: 4, 2: 3, 3: 2 },
  10: { 1: 4, 2: 3, 3: 2 },
  11: { 1: 4, 2: 3, 3: 3 },
  12: { 1: 4, 2: 3, 3: 3 },
  13: { 1: 4, 2: 3, 3: 3, 4: 1 },
  14: { 1: 4, 2: 3, 3: 3, 4: 1 },
  15: { 1: 4, 2: 3, 3: 3, 4: 2 },
  16: { 1: 4, 2: 3, 3: 3, 4: 2 },
  17: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 1 },
  18: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 1 },
  19: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2 },
  20: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2 }
}

// Cantrips known by level for each spellcasting class
const CANTRIPS_KNOWN = {
  bard: [2, 2, 2, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
  cleric: [3, 3, 3, 4, 4, 4, 4, 4, 4, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5],
  druid: [2, 2, 2, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
  sorcerer: [4, 4, 4, 5, 5, 5, 5, 5, 5, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6],
  warlock: [2, 2, 2, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
  wizard: [3, 3, 3, 4, 4, 4, 4, 4, 4, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5],
  artificer: [2, 2, 2, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4]
}

// Spells known by level (for classes that track spells known vs prepared)
const SPELLS_KNOWN = {
  bard: [4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 15, 15, 16, 18, 19, 19, 20, 22, 22, 22],
  ranger: [0, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11],
  sorcerer: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 12, 13, 13, 14, 14, 15, 15, 15, 15],
  warlock: [2, 3, 4, 5, 6, 7, 8, 9, 10, 10, 11, 11, 12, 12, 13, 13, 14, 14, 15, 15]
}

// Hit dice by class
const HIT_DICE = {
  barbarian: 12,
  bard: 8,
  cleric: 8,
  druid: 8,
  fighter: 10,
  monk: 8,
  paladin: 10,
  ranger: 10,
  rogue: 8,
  sorcerer: 6,
  warlock: 8,
  wizard: 6,
  artificer: 8
}

// Martial arts die progression for monks
const MARTIAL_ARTS_DIE = {
  1: 'd4', 2: 'd4', 3: 'd4', 4: 'd4',
  5: 'd6', 6: 'd6', 7: 'd6', 8: 'd6', 9: 'd6', 10: 'd6',
  11: 'd8', 12: 'd8', 13: 'd8', 14: 'd8', 15: 'd8', 16: 'd8',
  17: 'd10', 18: 'd10', 19: 'd10', 20: 'd10'
}

// Sneak attack dice progression for rogues
const SNEAK_ATTACK_DICE = {
  1: 1, 2: 1, 3: 2, 4: 2, 5: 3, 6: 3, 7: 4, 8: 4, 9: 5, 10: 5,
  11: 6, 12: 6, 13: 7, 14: 7, 15: 8, 16: 8, 17: 9, 18: 9, 19: 10, 20: 10
}

// Rage damage and uses for barbarians
const RAGE_PROGRESSION = {
  1:  { damage: 2, uses: 2 },
  2:  { damage: 2, uses: 2 },
  3:  { damage: 2, uses: 3 },
  4:  { damage: 2, uses: 3 },
  5:  { damage: 2, uses: 3 },
  6:  { damage: 2, uses: 4 },
  7:  { damage: 2, uses: 4 },
  8:  { damage: 2, uses: 4 },
  9:  { damage: 3, uses: 4 },
  10: { damage: 3, uses: 4 },
  11: { damage: 3, uses: 4 },
  12: { damage: 3, uses: 5 },
  13: { damage: 3, uses: 5 },
  14: { damage: 3, uses: 5 },
  15: { damage: 3, uses: 5 },
  16: { damage: 4, uses: 5 },
  17: { damage: 4, uses: 6 },
  18: { damage: 4, uses: 6 },
  19: { damage: 4, uses: 6 },
  20: { damage: 4, uses: 'Unlimited' }
}

// Ki points for monks
const KI_POINTS = {
  1: 0, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9, 10: 10,
  11: 11, 12: 12, 13: 13, 14: 14, 15: 15, 16: 16, 17: 17, 18: 18, 19: 19, 20: 20
}

// Sorcery points for sorcerers
const SORCERY_POINTS = {
  1: 0, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9, 10: 10,
  11: 11, 12: 12, 13: 13, 14: 14, 15: 15, 16: 16, 17: 17, 18: 18, 19: 19, 20: 20
}

// Multiclass prerequisites - ability score minimums required to multiclass INTO a class
// Also required to multiclass OUT of a class (must meet prereqs for both classes)
const MULTICLASS_REQUIREMENTS = {
  barbarian: { str: 13 },
  bard: { cha: 13 },
  cleric: { wis: 13 },
  druid: { wis: 13 },
  fighter: { str: 13, dex: 13, either: true }, // STR 13 OR DEX 13
  monk: { dex: 13, wis: 13 },
  paladin: { str: 13, cha: 13 },
  ranger: { dex: 13, wis: 13 },
  rogue: { dex: 13 },
  sorcerer: { cha: 13 },
  warlock: { cha: 13 },
  wizard: { int: 13 },
  artificer: { int: 13 }
}

// Caster type for multiclass spell slot calculation
const CASTER_TYPE = {
  bard: 'full',
  cleric: 'full',
  druid: 'full',
  sorcerer: 'full',
  wizard: 'full',
  paladin: 'half',
  ranger: 'half',
  artificer: 'half-rounded-up', // Artificer rounds up for multiclass
  warlock: 'pact', // Pact magic is separate
  fighter: 'third', // Eldritch Knight (when subclass selected)
  rogue: 'third', // Arcane Trickster (when subclass selected)
  barbarian: 'none',
  monk: 'none'
}

// Subclasses that grant spellcasting to martial classes
const SPELLCASTING_SUBCLASSES = {
  fighter: ['Eldritch Knight'],
  rogue: ['Arcane Trickster']
}

// Infusions known for artificers
const ARTIFICER_INFUSIONS = {
  known: [0, 4, 4, 4, 4, 6, 6, 6, 6, 8, 8, 8, 8, 10, 10, 10, 10, 12, 12, 12],
  infused: [0, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 6, 6, 6]
}

// Helper functions
function getXPForLevel(level) {
  return XP_THRESHOLDS[level] || 0
}

function getXPToNextLevel(currentLevel) {
  if (currentLevel >= 20) return null
  return XP_THRESHOLDS[currentLevel + 1]
}

function getLevelFromXP(xp) {
  let level = 1
  for (let i = 20; i >= 1; i--) {
    if (xp >= XP_THRESHOLDS[i]) {
      level = i
      break
    }
  }
  return level
}

function canLevelUp(currentLevel, currentXP) {
  if (currentLevel >= 20) return false
  return currentXP >= XP_THRESHOLDS[currentLevel + 1]
}

function getClassFeatures(className, level) {
  const classKey = className.toLowerCase()
  return CLASS_FEATURES[classKey]?.[level] || []
}

function getAllFeaturesUpToLevel(className, level) {
  const classKey = className.toLowerCase()
  const features = []
  for (let i = 1; i <= level; i++) {
    const levelFeatures = CLASS_FEATURES[classKey]?.[i] || []
    features.push(...levelFeatures.map(f => ({ level: i, feature: f })))
  }
  return features
}

function needsSubclassSelection(className, level) {
  const classKey = className.toLowerCase()
  return level === SUBCLASS_LEVELS[classKey]
}

function hasASI(className, level) {
  const classKey = className.toLowerCase()
  const asiLevels = ASI_LEVELS[classKey] || ASI_LEVELS.default
  return asiLevels.includes(level)
}

function getSpellSlots(className, level) {
  const classKey = className.toLowerCase()
  const fullCasters = ['bard', 'cleric', 'druid', 'sorcerer', 'wizard']
  const halfCasters = ['paladin', 'ranger']

  if (fullCasters.includes(classKey)) {
    return FULL_CASTER_SPELL_SLOTS[level]
  } else if (halfCasters.includes(classKey)) {
    return HALF_CASTER_SPELL_SLOTS[level]
  } else if (classKey === 'warlock') {
    return WARLOCK_SPELL_SLOTS[level]
  } else if (classKey === 'artificer') {
    return ARTIFICER_SPELL_SLOTS[level]
  }
  return {}
}

function getCantripsKnown(className, level) {
  const classKey = className.toLowerCase()
  if (CANTRIPS_KNOWN[classKey]) {
    return CANTRIPS_KNOWN[classKey][level - 1] || 0
  }
  return 0
}

function getSpellsKnown(className, level) {
  const classKey = className.toLowerCase()
  if (SPELLS_KNOWN[classKey]) {
    return SPELLS_KNOWN[classKey][level - 1] || 0
  }
  return null // null means class prepares spells instead of knowing them
}

// Check if a character meets multiclass prerequisites for a given class
function meetsMulticlassRequirements(abilityScores, targetClass) {
  const classKey = targetClass.toLowerCase()
  const requirements = MULTICLASS_REQUIREMENTS[classKey]
  if (!requirements) return false

  // Handle "either" case (e.g., Fighter: STR 13 OR DEX 13)
  if (requirements.either) {
    const abilityKeys = Object.keys(requirements).filter(k => k !== 'either')
    return abilityKeys.some(ability => abilityScores[ability] >= requirements[ability])
  }

  // All requirements must be met
  for (const [ability, minimum] of Object.entries(requirements)) {
    if (abilityScores[ability] < minimum) {
      return false
    }
  }
  return true
}

// Get all classes a character can multiclass into based on their ability scores
function getAvailableMulticlassOptions(abilityScores, currentClasses = []) {
  const allClasses = Object.keys(MULTICLASS_REQUIREMENTS)
  const currentClassNames = currentClasses.map(c => c.class?.toLowerCase() || c.toLowerCase())

  return allClasses.filter(className => {
    // Can't multiclass into a class you already have
    if (currentClassNames.includes(className)) return false
    // Must meet the requirements
    return meetsMulticlassRequirements(abilityScores, className)
  })
}

// Calculate multiclass spell slots based on combined caster levels
function getMulticlassSpellSlots(classLevels, subclasses = {}) {
  let totalCasterLevel = 0
  let hasPactMagic = false
  let pactMagicLevel = 0

  for (const classInfo of classLevels) {
    const className = classInfo.class.toLowerCase()
    const level = classInfo.level
    const subclass = subclasses[className] || classInfo.subclass

    const casterType = CASTER_TYPE[className]

    if (casterType === 'full') {
      totalCasterLevel += level
    } else if (casterType === 'half') {
      totalCasterLevel += Math.floor(level / 2)
    } else if (casterType === 'half-rounded-up') {
      // Artificer rounds up for multiclass calculation
      totalCasterLevel += Math.ceil(level / 2)
    } else if (casterType === 'third') {
      // Only counts if they have the spellcasting subclass
      const spellcastingSubclasses = SPELLCASTING_SUBCLASSES[className] || []
      if (spellcastingSubclasses.some(s => s.toLowerCase() === subclass?.toLowerCase())) {
        totalCasterLevel += Math.floor(level / 3)
      }
    } else if (casterType === 'pact') {
      hasPactMagic = true
      pactMagicLevel = level
    }
  }

  // Get spell slots from the multiclass table
  const spellSlots = totalCasterLevel > 0 ? FULL_CASTER_SPELL_SLOTS[totalCasterLevel] || {} : {}

  // Add pact magic info if applicable (it's tracked separately)
  if (hasPactMagic) {
    return {
      spellSlots,
      pactMagic: WARLOCK_SPELL_SLOTS[pactMagicLevel]
    }
  }

  return { spellSlots }
}

// Get the total character level from class_levels array
function getTotalLevel(classLevels) {
  if (!classLevels || !Array.isArray(classLevels)) return 0
  return classLevels.reduce((sum, c) => sum + (c.level || 0), 0)
}

// Get hit dice breakdown from class_levels
function getHitDiceBreakdown(classLevels) {
  const hitDice = {}
  for (const classInfo of classLevels) {
    const className = classInfo.class.toLowerCase()
    const die = HIT_DICE[className] || 8
    const dieKey = `d${die}`
    hitDice[dieKey] = (hitDice[dieKey] || 0) + classInfo.level
  }
  return hitDice
}

export {
  XP_THRESHOLDS,
  PROFICIENCY_BONUS,
  ASI_LEVELS,
  CLASS_FEATURES,
  SUBCLASS_LEVELS,
  FULL_CASTER_SPELL_SLOTS,
  HALF_CASTER_SPELL_SLOTS,
  WARLOCK_SPELL_SLOTS,
  ARTIFICER_SPELL_SLOTS,
  CANTRIPS_KNOWN,
  SPELLS_KNOWN,
  HIT_DICE,
  MARTIAL_ARTS_DIE,
  SNEAK_ATTACK_DICE,
  RAGE_PROGRESSION,
  KI_POINTS,
  SORCERY_POINTS,
  ARTIFICER_INFUSIONS,
  MULTICLASS_REQUIREMENTS,
  CASTER_TYPE,
  SPELLCASTING_SUBCLASSES,
  // Helper functions
  getXPForLevel,
  getXPToNextLevel,
  getLevelFromXP,
  canLevelUp,
  getClassFeatures,
  getAllFeaturesUpToLevel,
  needsSubclassSelection,
  hasASI,
  getSpellSlots,
  getCantripsKnown,
  getSpellsKnown,
  meetsMulticlassRequirements,
  getAvailableMulticlassOptions,
  getMulticlassSpellSlots,
  getTotalLevel,
  getHitDiceBreakdown
}
