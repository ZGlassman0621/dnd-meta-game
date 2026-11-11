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
// L19 STAYS an ASI level (2026-11-06 closeout decision): every 2024 PHB
// table grants an Epic Boon at 19, not an ASI — but hasASI() is the only
// mechanism that surfaces a choice at level-up (needsASI + the asiChoice
// application in character.js / companion.js), and no Epic Boon feat
// picker exists in the level-up path (featRegistry has no Boon feats;
// the mythic epic-boon system is a separate track, not wired to L19).
// Removing 19 would leave a dead level (the 'Epic Boon' CLASS_FEATURES
// row displays, nothing is granted); keeping it offers the ASI-or-feat
// choice — book-imprecise, strictly better than nothing. When a real
// Epic Boon picker exists, REPLACE the 19 entry with that picker; do
// not just delete it. Reversal cost: one entry per list below.
const ASI_LEVELS = {
  default: [4, 8, 12, 16, 19],
  fighter: [4, 6, 8, 12, 14, 16, 19],
  rogue: [4, 8, 10, 12, 16, 19],
  duelist: [
    4,
    8,
    10,
    12,
    16,
    19
  ],
  warlord: [4, 8, 10, 12, 16, 19],
}

// Class features by level for each class
// This defines what features are gained at each level
const CLASS_FEATURES = {
  barbarian: {
    1: ['Rage', 'Unarmored Defense', 'Weapon Mastery'],
    2: ['Danger Sense', 'Reckless Attack'],
    3: ['Barbarian Subclass', 'Primal Knowledge'], // Subclass selection
    4: ['Ability Score Improvement'],
    5: ['Extra Attack', 'Fast Movement'],
    6: ['Subclass Feature'],
    7: ['Feral Instinct', 'Instinctive Pounce'],
    8: ['Ability Score Improvement'],
    9: ['Brutal Strike'],
    10: ['Subclass Feature'],
    11: ['Relentless Rage'],
    12: ['Ability Score Improvement'],
    13: ['Improved Brutal Strike'],
    14: ['Subclass Feature'],
    15: ['Persistent Rage'],
    16: ['Ability Score Improvement'],
    17: ['Improved Brutal Strike'],
    18: ['Indomitable Might'],
    19: ['Epic Boon'],
    20: ['Primal Champion']
  },
  bard: {
    1: ['Bardic Inspiration', 'Spellcasting'],
    2: ['Expertise', 'Jack of All Trades'],
    3: ['Bard Subclass'],
    4: ['Ability Score Improvement'],
    5: ['Font of Inspiration'],
    6: ['Subclass Feature'],
    7: ['Countercharm'],
    8: ['Ability Score Improvement'],
    9: ['Expertise'],
    10: ['Magical Secrets'],
    11: [],
    12: ['Ability Score Improvement'],
    13: [],
    14: ['Subclass Feature'],
    15: [],
    16: ['Ability Score Improvement'],
    17: [],
    18: ['Superior Inspiration'],
    19: ['Epic Boon'],
    20: ['Words of Creation']
  },
  cleric: {
    1: ['Divine Order', 'Spellcasting'],
    2: ['Channel Divinity'],
    3: ['Cleric Subclass'],
    4: ['Ability Score Improvement'],
    5: ['Sear Undead'],
    6: ['Subclass Feature'],
    7: ['Blessed Strikes'],
    8: ['Ability Score Improvement'],
    9: [],
    10: ['Divine Intervention'],
    11: [],
    12: ['Ability Score Improvement'],
    13: [],
    14: ['Improved Blessed Strikes'],
    15: [],
    16: ['Ability Score Improvement'],
    17: ['Subclass Feature'],
    18: [],
    19: ['Epic Boon'],
    20: ['Greater Divine Intervention']
  },
  druid: {
    1: ['Druidic', 'Primal Order', 'Spellcasting'],
    2: ['Wild Shape', 'Wild Companion'],
    3: ['Druid Subclass'],
    4: ['Ability Score Improvement'],
    5: ['Wild Resurgence'],
    6: ['Subclass Feature'],
    7: ['Elemental Fury'],
    8: ['Ability Score Improvement'],
    9: [],
    10: ['Subclass Feature'],
    11: [],
    12: ['Ability Score Improvement'],
    13: [],
    14: ['Subclass Feature'],
    15: ['Improved Elemental Fury'],
    16: ['Ability Score Improvement'],
    17: [],
    18: ['Beast Spells'],
    19: ['Epic Boon'],
    20: ['Archdruid']
  },
  fighter: {
    1: ['Fighting Style', 'Second Wind', 'Weapon Mastery'],
    2: ['Action Surge (one use)', 'Tactical Mind'],
    3: ['Fighter Subclass'],
    4: ['Ability Score Improvement'],
    5: ['Extra Attack', 'Tactical Shift'],
    6: ['Ability Score Improvement'],
    7: ['Subclass Feature'],
    8: ['Ability Score Improvement'],
    9: ['Indomitable (one use)', 'Tactical Master'],
    10: ['Subclass Feature'],
    11: ['Two Extra Attacks'],
    12: ['Ability Score Improvement'],
    13: ['Indomitable (two uses)', 'Studied Attacks'],
    14: ['Ability Score Improvement'],
    15: ['Subclass Feature'],
    16: ['Ability Score Improvement'],
    17: ['Action Surge (two uses)', 'Indomitable (three uses)'],
    18: ['Subclass Feature'],
    19: ['Epic Boon'],
    20: ['Three Extra Attacks']
  },
  monk: {
    1: ['Martial Arts', 'Unarmored Defense'],
    2: ["Monk's Focus", 'Unarmored Movement', 'Uncanny Metabolism'],
    3: ['Deflect Attacks', 'Monk Subclass'],
    4: ['Ability Score Improvement', 'Slow Fall'],
    5: ['Extra Attack', 'Stunning Strike'],
    6: ['Empowered Strikes', 'Subclass Feature'],
    7: ['Evasion'],
    8: ['Ability Score Improvement'],
    9: ['Acrobatic Movement'],
    10: ['Heightened Focus', 'Self-Restoration'],
    11: ['Subclass Feature'],
    12: ['Ability Score Improvement'],
    13: ['Deflect Energy'],
    14: ['Disciplined Survivor'],
    15: ['Perfect Focus'],
    16: ['Ability Score Improvement'],
    17: ['Subclass Feature'],
    18: ['Superior Defense'],
    19: ['Epic Boon'],
    20: ['Body and Mind']
  },
  paladin: {
    1: ['Lay on Hands', 'Spellcasting', 'Weapon Mastery'],
    2: ['Fighting Style', "Paladin's Smite"],
    3: ['Channel Divinity', 'Paladin Subclass'],
    4: ['Ability Score Improvement'],
    5: ['Extra Attack', 'Faithful Steed'],
    6: ['Aura of Protection'],
    7: ['Subclass Feature'],
    8: ['Ability Score Improvement'],
    9: ['Abjure Foes'],
    10: ['Aura of Courage'],
    11: ['Radiant Strikes'],
    12: ['Ability Score Improvement'],
    13: [],
    14: ['Restoring Touch'],
    15: ['Subclass Feature'],
    16: ['Ability Score Improvement'],
    17: [],
    18: ['Aura Expansion'],
    19: ['Epic Boon'],
    20: ['Subclass Feature']
  },
  ranger: {
    1: ['Spellcasting', 'Favored Enemy', 'Weapon Mastery'],
    2: ['Deft Explorer', 'Fighting Style'],
    3: ['Ranger Subclass'],
    4: ['Ability Score Improvement'],
    5: ['Extra Attack'],
    6: ['Roving'],
    7: ['Subclass Feature'],
    8: ['Ability Score Improvement'],
    9: ['Expertise'],
    10: ['Tireless'],
    11: ['Subclass Feature'],
    12: ['Ability Score Improvement'],
    13: ['Relentless Hunter'],
    14: ["Nature's Veil"],
    15: ['Subclass Feature'],
    16: ['Ability Score Improvement'],
    17: ['Precise Hunter'],
    18: ['Feral Senses'],
    19: ['Epic Boon'],
    20: ['Foe Slayer']
  },
  rogue: {
    1: ['Expertise', 'Sneak Attack', "Thieves' Cant", 'Weapon Mastery'],
    2: ['Cunning Action'],
    3: ['Rogue Subclass', 'Steady Aim'],
    4: ['Ability Score Improvement'],
    5: ['Cunning Strike', 'Uncanny Dodge'],
    6: ['Expertise'],
    7: ['Evasion', 'Reliable Talent'],
    8: ['Ability Score Improvement'],
    9: ['Subclass Feature'],
    10: ['Ability Score Improvement'],
    11: ['Improved Cunning Strike'],
    12: ['Ability Score Improvement'],
    13: ['Subclass Feature'],
    14: ['Devious Strikes'],
    15: ['Slippery Mind'],
    16: ['Ability Score Improvement'],
    17: ['Subclass Feature'],
    18: ['Elusive'],
    19: ['Epic Boon'],
    20: ['Stroke of Luck']
  },
  sorcerer: {
    1: ['Spellcasting', 'Innate Sorcery'],
    2: ['Font of Magic', 'Metamagic'],
    3: ['Sorcerer Subclass'],
    4: ['Ability Score Improvement'],
    5: ['Sorcerous Restoration'],
    6: ['Subclass Feature'],
    7: ['Sorcery Incarnate'],
    8: ['Ability Score Improvement'],
    9: [],
    10: ['Metamagic'],
    11: [],
    12: ['Ability Score Improvement'],
    13: [],
    14: ['Subclass Feature'],
    15: [],
    16: ['Ability Score Improvement'],
    17: ['Metamagic'],
    18: ['Subclass Feature'],
    19: ['Epic Boon'],
    20: ['Arcane Apotheosis']
  },
  warlock: {
    1: ['Eldritch Invocations', 'Pact Magic'],
    2: ['Magical Cunning'],
    3: ['Warlock Subclass'],
    4: ['Ability Score Improvement'],
    5: [],
    6: ['Subclass Feature'],
    7: [],
    8: ['Ability Score Improvement'],
    9: ['Contact Patron'],
    10: ['Subclass Feature'],
    11: ['Mystic Arcanum (level 6 spell)'],
    12: ['Ability Score Improvement'],
    13: ['Mystic Arcanum (level 7 spell)'],
    14: ['Subclass Feature'],
    15: ['Mystic Arcanum (level 8 spell)'],
    16: ['Ability Score Improvement'],
    17: ['Mystic Arcanum (level 9 spell)'],
    18: [],
    19: ['Epic Boon'],
    20: ['Eldritch Master']
  },
  wizard: {
    1: ['Spellcasting', 'Ritual Adept', 'Arcane Recovery'],
    2: ['Scholar'],
    3: ['Wizard Subclass'],
    4: ['Ability Score Improvement'],
    5: ['Memorize Spell'],
    6: ['Subclass Feature'],
    7: [],
    8: ['Ability Score Improvement'],
    9: [],
    10: ['Subclass Feature'],
    11: [],
    12: ['Ability Score Improvement'],
    13: [],
    14: ['Subclass Feature'],
    15: [],
    16: ['Ability Score Improvement'],
    17: [],
    18: ['Spell Mastery'],
    19: ['Epic Boon'],
    20: ['Signature Spells']
  },
  artificer: {
    1: ['Spellcasting', "Tinker's Magic"],
    2: ['Replicate Magic Item'],
    3: ['Artificer Subclass', 'The Right Tool for the Job'],
    4: ['Ability Score Improvement'],
    5: ['Subclass Feature'],
    6: ['Magic Item Tinker', 'Tool Expertise'],
    7: ['Flash of Genius'],
    8: ['Ability Score Improvement'],
    9: ['Subclass Feature'],
    10: ['Magic Item Adept'],
    11: ['Spell-Storing Item'],
    12: ['Ability Score Improvement'],
    13: [],
    14: ['Advanced Artifice'],
    15: ['Subclass Feature'],
    16: ['Ability Score Improvement'],
    17: [],
    18: ['Magic Item Master'],
    19: ['Epic Boon'],
    20: ['Soul of Artifice']
  },
  keeper: {
    1: ['Recitation', 'Manifest Weapon', "Keeper's Library", "Keeper's Insight"],
    2: ['Literary Recall', "Keeper's Study"],
    3: ['Genre Domain'],
    4: ['Ability Score Improvement'],
    5: ['Extra Attack', 'Eidetic Memory'],
    6: ['Keeper Specialization or Polymath'],
    7: ['Annotated Texts'],
    8: ['Ability Score Improvement'],
    9: ['Expanded Library'],
    10: ['Compelling Rhetoric'],
    11: ['Specialization Feature / Polymath: Broad Study', 'Manifest Weapon Improvement'],
    12: ['Ability Score Improvement'],
    13: ['Living Text'],
    14: ['Unwritten Knowledge'],
    15: ['Specialization Feature / Polymath: Renaissance Scholar', 'Second Genre Domain or Genre Mastery'],
    16: ['Ability Score Improvement'],
    17: ['Masterwork Manifest'],
    18: ["Keeper's Authority"],
    19: ['Ability Score Improvement'],
    20: ['Living Library']
  },
  spellshot: {
    "1": [
      "Explosive Arsenal",
      "Adrenaline Dynamo",
      "Skill Shots"
    ],
    "2": [
      "Spell Battery",
      "Spell Dynamo"
    ],
    "3": [
      "Drive"
    ],
    "4": [
      "Ability Score Improvement"
    ],
    "5": [
      "Extra Attack",
      "Spell and Shot (Skill Shot)"
    ],
    "6": [
      "Enchanted Arsenal",
      "Arcane Ammunitions",
      "Quick Swap"
    ],
    "7": [
      "Drive Feature"
    ],
    "8": [
      "Ability Score Improvement"
    ],
    "9": [
      "Unshakeable Grit",
      "Quickdraw"
    ],
    "10": [
      "Drive Feature"
    ],
    "11": [
      "Improved Weapons",
      "Elemental Arsenal"
    ],
    "12": [
      "Ability Score Improvement"
    ],
    "13": [
      "Speed Loader"
    ],
    "14": [
      "Improved Ammunitions"
    ],
    "15": [
      "Drive Feature"
    ],
    "16": [
      "Ability Score Improvement"
    ],
    "17": [
      "Mastered Weapons"
    ],
    "18": [
      "Unrelenting Grit"
    ],
    "19": [
      "Ability Score Improvement"
    ],
    "20": [
      "Determined Desperado"
    ]
  },
  warden: {
    "1": [
      "Sentinel's Stand",
      "Warden's Grasp"
    ],
    "2": [
      "Fighting Style",
      "Warden's Mark"
    ],
    "3": [
      "Champion's Call",
      "Warden's Resolve"
    ],
    "4": [
      "Ability Score Improvement",
      "Font of Life"
    ],
    "5": [
      "Extra Attack"
    ],
    "6": [
      "Call Feature"
    ],
    "7": [
      "Sentinel's Step"
    ],
    "8": [
      "Ability Score Improvement"
    ],
    "9": [
      "Undying"
    ],
    "10": [
      "Interrupt"
    ],
    "11": [
      "Mark Improvement (additional attack against a marked creature)"
    ],
    "12": [
      "Ability Score Improvement"
    ],
    "13": [
      "Call Feature"
    ],
    "14": [
      "Grasp Improvement (range 10 feet)"
    ],
    "15": [
      "Font of Life Improvement"
    ],
    "16": [
      "Ability Score Improvement"
    ],
    "17": [
      "Resolve Improvement"
    ],
    "18": [
      "Sentinel's Soul"
    ],
    "19": [
      "Ability Score Improvement"
    ],
    "20": [
      "Call Feature"
    ]
  },
  magus: {
    "1": [
      "Eldritch Society",
      "Esoteric Eye"
    ],
    "2": [
      "Mystic Mark",
      "Spellcasting"
    ],
    "3": [
      "Eldritch Armament",
      "Society Feature"
    ],
    "4": [
      "Ability Score Improvement"
    ],
    "5": [],
    "6": [
      "Mystic Meditation"
    ],
    "7": [
      "Society Feature",
      "War Magic"
    ],
    "8": [
      "Ability Score Improvement"
    ],
    "9": [
      "Aegis and Enspell Improvement (+2)"
    ],
    "10": [
      "Spell Surge"
    ],
    "11": [
      "Improved War Magic"
    ],
    "12": [
      "Ability Score Improvement"
    ],
    "13": [
      "Aegis and Enspell Improvement (+3)"
    ],
    "14": [
      "Society Feature"
    ],
    "15": [
      "Spell Ward"
    ],
    "16": [
      "Ability Score Improvement"
    ],
    "17": [],
    "18": [
      "Greater Spell Surge"
    ],
    "19": [
      "Ability Score Improvement"
    ],
    "20": [
      "Spell Surge Improvement",
      "Greater Spell Surge Improvement"
    ]
  },
  pugilist: {
    "1": [
      "Fisticuffs",
      "Iron Chin"
    ],
    "2": [
      "Moxie",
      "Street Smart"
    ],
    "3": [
      "Bloodied But Unbowed",
      "Fight Club"
    ],
    "4": [
      "Ability Score Improvement",
      "Dig Deep"
    ],
    "5": [
      "Extra Attack",
      "Haymaker"
    ],
    "6": [
      "Fight Club Feature",
      "Moxie-Fueled Fists"
    ],
    "7": [
      "Fancy Footwork",
      "Shake It Off"
    ],
    "8": [
      "Ability Score Improvement"
    ],
    "9": [
      "Down But Not Out"
    ],
    "10": [
      "School of Hard Knocks"
    ],
    "11": [
      "Fight Club Feature"
    ],
    "12": [
      "Ability Score Improvement"
    ],
    "13": [
      "Rabble Rouser"
    ],
    "14": [
      "Unbreakable"
    ],
    "15": [
      "Herculean"
    ],
    "16": [
      "Ability Score Improvement"
    ],
    "17": [
      "Fight Club Feature"
    ],
    "18": [
      "Fighting Spirit"
    ],
    "19": [
      "Ability Score Improvement"
    ],
    "20": [
      "Peak Physical Condition"
    ]
  },
  scholar: {
    "1": [
      "Academic Discourse",
      "Field of Study",
      "Sage Advice"
    ],
    "2": [
      "Analyze Enemy",
      "Erudite Applications"
    ],
    "3": [
      "Field of Study Feature"
    ],
    "4": [
      "Ability Score Improvement"
    ],
    "5": [
      "Analyze Enemy Improvement (1d10)",
      "Sagacious Font"
    ],
    "6": [
      "Quick Study"
    ],
    "7": [
      "Iron Will"
    ],
    "8": [
      "Ability Score Improvement",
      "Esoteric Application"
    ],
    "9": [
      "Field of Study Feature"
    ],
    "10": [
      "Brilliant Mind"
    ],
    "11": [
      "Analyze Enemy Improvement (2d10)",
      "Reliable Talent"
    ],
    "12": [
      "Ability Score Improvement"
    ],
    "13": [
      "Field of Study Feature"
    ],
    "14": [
      "Esoteric Application Improvement"
    ],
    "15": [
      "Expansive Intellect (Intelligence 22)"
    ],
    "16": [
      "Ability Score Improvement"
    ],
    "17": [
      "Analyze Enemy Improvement (3d10)"
    ],
    "18": [
      "Flash of Genius"
    ],
    "19": [
      "Ability Score Improvement"
    ],
    "20": [
      "Field of Study Feature",
      "Expansive Intellect Improvement (Intelligence 24)"
    ]
  },
  duelist: {
    "1": [
      "Fighting Style",
      "Daring",
      "Martial Advantage"
    ],
    "2": [
      "Light-footed",
      "Brave"
    ],
    "3": [
      "Combat Expertise",
      "Dueling Archetype"
    ],
    "4": [
      "Ability Score Improvement"
    ],
    "5": [
      "Critical Strikes",
      "Extra Attack"
    ],
    "6": [
      "Dueling Archetype Feature"
    ],
    "7": [
      "Determined"
    ],
    "8": [
      "Ability Score Improvement"
    ],
    "9": [
      "Critical Strikes Improvement"
    ],
    "10": [
      "Ability Score Improvement"
    ],
    "11": [
      "Determined Improvement (2 uses)"
    ],
    "12": [
      "Ability Score Improvement"
    ],
    "13": [
      "Dueling Archetype Feature"
    ],
    "14": [
      "Critical Strikes Improvement"
    ],
    "15": [
      "Determined Improvement (3 uses)"
    ],
    "16": [
      "Ability Score Improvement"
    ],
    "17": [
      "Dueling Archetype Feature"
    ],
    "18": [
      "Determined Improvement (4 uses)"
    ],
    "19": [
      "Ability Score Improvement"
    ],
    "20": [
      "Steely Determination"
    ]
  },
  blackguard: {
    "1": [
      "Shroud of Shadow",
      "Unholy Vigor"
    ],
    "2": [
      "Fighting Style",
      "Spellcasting",
      "Dread Smite"
    ],
    "3": [
      "Inured to Decay",
      "Blackguard Vice"
    ],
    "4": [
      "Ability Score Improvement"
    ],
    "5": [
      "Extra Attack"
    ],
    "6": [
      "Dark Blessing"
    ],
    "7": [
      "Blackguard Vice Feature"
    ],
    "8": [
      "Ability Score Improvement"
    ],
    "9": [],
    "10": [
      "Aura of Hate"
    ],
    "11": [
      "Improved Dread Smite"
    ],
    "12": [
      "Ability Score Improvement"
    ],
    "13": [],
    "14": [
      "Vile Touch"
    ],
    "15": [
      "Blackguard Vice Feature"
    ],
    "16": [
      "Ability Score Improvement"
    ],
    "17": [],
    "18": [
      "Aura Improvements"
    ],
    "19": [
      "Ability Score Improvement"
    ],
    "20": [
      "Blackguard Vice Feature"
    ]
  },
  // Blood Hunter (2024 Rules, GM Binder fan conversion of Matt Mercer's
  // Blood Hunter — 2026-11-06): feature table transcribed from the PDF's
  // "The Blood Hunter" table. ASI at 4/8/12/16 (default ASI_LEVELS);
  // Epic Boon at 19th (default list). Subclass ("Blood Hunter Order")
  // at 3rd, subclass features at 7/11/15/18.
  blood_hunter: {
    1: ["Hunter's Bane", 'Blood Maledict', 'Weapon Mastery'],
    2: ['Fighting Style', 'Crimson Rite'],
    3: ['Blood Hunter Order'], // Subclass selection
    4: ['Ability Score Improvement'],
    5: ['Extra Attack', 'Rite Focus'],
    6: ['Brand of Castigation', 'Blood Maledict (2 uses)'],
    7: ['Subclass Feature', 'Primal Rite'],
    8: ['Ability Score Improvement'],
    9: ['Grim Psychometry'],
    10: ['Dark Augmentation'],
    11: ['Subclass Feature'],
    12: ['Ability Score Improvement'],
    13: ['Brand of Tethering', 'Blood Maledict (3 uses)'],
    14: ['Hardened Soul', 'Esoteric Rite'],
    15: ['Subclass Feature'],
    16: ['Ability Score Improvement'],
    17: ['Blood Maledict (4 uses)'],
    18: ['Subclass Feature'],
    19: ['Epic Boon'],
    20: ['Sanguine Mastery']
  },
  warlord: {
    "1": [
      "Warlord Specialization",
      "Battlefield Presence"
    ],
    "2": [
      "Leadership Dice"
    ],
    "3": [
      "Warlord Specialization Feature",
      "Warlord's Expertise"
    ],
    "4": [
      "Ability Score Improvement"
    ],
    "5": [
      "Extra Attack"
    ],
    "6": [
      "Prepare for Battle",
      "Leadership Dice Limit Increase (2)"
    ],
    "7": [
      "Warlord Specialization Feature"
    ],
    "8": [
      "Ability Score Improvement"
    ],
    "9": [
      "Press the Attack"
    ],
    "10": [
      "Ability Score Improvement"
    ],
    "11": [
      "Warlord Specialization Feature",
      "Leadership Dice Limit Increase (3)"
    ],
    "12": [
      "Ability Score Improvement"
    ],
    "13": [
      "Warlord's Intuition"
    ],
    "14": [
      "Shift the Field"
    ],
    "15": [
      "Warlord Specialization Feature"
    ],
    "16": [
      "Ability Score Improvement"
    ],
    "17": [
      "Unbreakable Will",
      "Leadership Dice Limit Increase (4)"
    ],
    "18": [
      "Warlord Specialization Feature"
    ],
    "19": [
      "Ability Score Improvement"
    ],
    "20": [
      "Tireless Leader"
    ]
  },
}

// Subclass selection levels by class — 2024 PHB: every PHB class chooses
// its subclass at 3rd level (druid included; the 2014 rule had druid at
// 2nd, cleric/sorcerer/warlock at 1st, wizard at 2nd). Magus/scholar stay
// 1st (their own books print the choice at 1st); keeper stays 6th (its
// class table prints Specialization at 6th); warlord is 1st (KibblesTasty
// Warlord v1.5 prints the Presence choice at 1st — gaps-batch item 8b,
// 2026-11-06; coordinator ruling: the 2024 3rd-level rule covers PHB
// classes only, third-party classes follow their own books).
// blood_hunter joined the table 2026-11-06 (Blood Hunter
// subclasses build): the PDF prints the Order choice at 3rd, and
// server/data/subclasses/blood_hunter.js now covers it.
const SUBCLASS_LEVELS = {
  barbarian: 3,
  bard: 3,
  cleric: 3,
  druid: 3,
  fighter: 3,
  monk: 3,
  paladin: 3,
  ranger: 3,
  rogue: 3,
  sorcerer: 3,
  warlock: 3,
  wizard: 3,
  artificer: 3,
  keeper: 6,
  spellshot: 3,
  warden: 3,
  magus: 1,
  pugilist: 3,
  scholar: 1,
  duelist: 3,
  blackguard: 3,
  blood_hunter: 3,
  warlord: 1,
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

// Half caster spell slots (Blackguard)
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
// Paladin spell slots (2024 PHB, pp. 109-110, verified from the book
// 2026-11-06): the 2024 table starts at L1 with two 1st-level slots —
// the shared HALF_CASTER_SPELL_SLOTS is the 2014 table (L1 {}, slots
// start L2) and must NOT be changed: blackguard keeps it per its own
// book (no L1 slots). Ranger has its own table now (RANGER_SPELL_SLOTS,
// 2026-11-06 — the one-level shift this comment used to flag as
// not-built).
const PALADIN_SPELL_SLOTS = {
  1:  { 1: 2 },
  2:  { 1: 2 },
  3:  { 1: 3 },
  4:  { 1: 4, 2: 2 },
  5:  { 1: 4, 2: 2 },
  6:  { 1: 4, 2: 3 },
  7:  { 1: 4, 2: 3 },
  8:  { 1: 4, 2: 3, 3: 2 },
  9:  { 1: 4, 2: 3, 3: 2 },
  10: { 1: 4, 2: 3, 3: 3 },
  11: { 1: 4, 2: 3, 3: 3 },
  12: { 1: 4, 2: 3, 3: 3, 4: 1 },
  13: { 1: 4, 2: 3, 3: 3, 4: 1 },
  14: { 1: 4, 2: 3, 3: 3, 4: 2 },
  15: { 1: 4, 2: 3, 3: 3, 4: 2 },
  16: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 1 },
  17: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 1 },
  18: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 1 },
  19: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2 },
  20: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2 }
}

// Paladin spells prepared (2024 PHB, pp. 109-110, "Prepared Spells"
// column of the Paladin Features table, levels 1-20): the L1
// Spellcasting text says "To start, choose two level 1 Paladin
// spells" and the count increases "as shown in the Prepared Spells
// column" — the book states NO Cha-mod formula. The book's own
// example: a level 5 Paladin prepares six spells. The 2014 formula
// (Cha mod + half level, L1 gated to 0) is retired.
const PALADIN_SPELLS_PREPARED = [2, 3, 4, 5, 6, 6, 7, 7, 9, 10, 10, 11, 11, 12, 12, 14, 14, 14, 15, 15]


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

// Warlock (2024 PHB, Warlock Features table, "Prepared Spells"
// column, PHB-photo-verified 2026-11-06): warlocks PREPARE in 2024 —
// table-driven, mod-independent: 2 at 1st -> 15 at 20th. The
// Patron spells (Archfey / Celestial / Fiend / Great Old One
// expanded lists) are ADDED TO THE WARLOCK SPELL LIST, not always
// prepared — a patron spell the player prepares counts against
// this number.
const WARLOCK_SPELLS_PREPARED = [2, 3, 4, 5, 6, 7, 8, 9, 10, 10, 11, 11, 12, 12, 13, 13, 14, 14, 15, 15];

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
  artificer: [2, 2, 2, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4],
  spellshot: [
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0
  ],
  magus: [
    2,
    2,
    2,
    3,
    3,
    3,
    3,
    3,
    3,
    4,
    4,
    4,
    4,
    4,
    4,
    4,
    4,
    4,
    4,
    4
  ],
}

// Spells known by level (for classes that track spells known vs prepared)
const SPELLS_KNOWN = {
  // No bard row (2026-11-06): bards PREPARE in 2024 (Cha mod + bard
  // level — see the bard arm in getSpellsPrepared). The 2014
  // known-spells row ([4, 5, 6, 7, 8, 9, ...]) was removed with the
  // arm; a class is either known or prepared, never both, and keeping
  // the row made Stage 4 route bards as known casters (refusing
  // prepared_spells) while /api/spells served both counts.
  // No sorcerer row (2026-11-06): sorcerers PREPARE in 2024 too
  // (fixed Prepared Spells column, 2 at 1st -> 22 at 20th — see the
  // sorcerer arm in getSpellsPrepared). The 2014 known-spells row
  // ([2, 3, 4, 5, 6, 7, ...]) was removed with the arm, same rule:
  // a class is either known or prepared, never both.
  // No warlock row (2026-11-06): warlocks PREPARE in 2024
  // (fixed Prepared Spells column, 2 at 1st -> 15 at 20th — see the
  // warlock arm in getSpellsPrepared). The 2014 known-spells row
  // ([2, 3, 4, 5, 6, 7, ...]) was removed with the arm, same rule:
  // a class is either known or prepared, never both; keeping the row
  // made Stage 4 route warlocks as known casters (refusing
  // prepared_spells) while /api/spells served both counts.
  // No ranger row (2026-11-06): rangers PREPARE in 2024 (fixed
  // Prepared Spells column, 2 at 1st -> 15 at 20th — see the ranger
  // arm in getSpellsPrepared). The 2014 known-spells row
  // ([0, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11])
  // was removed with the arm, same rule as bard/sorcerer/warlock: a
  // class is either known or prepared, never both.
  spellshot: [
    0,
    2,
    3,
    4,
    4,
    4,
    5,
    6,
    6,
    7,
    8,
    8,
    9,
    10,
    10,
    11,
    11,
    11,
    12,
    13
  ],
  magus: [
    0,
    3,
    3,
    4,
    5,
    5,
    6,
    7,
    8,
    8,
    9,
    10,
    11,
    11,
    12,
    13,
    14,
    14,
    15,
    16
  ],
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
  artificer: 8,
  keeper: 8,
  spellshot: 8,
  warden: 10,
  magus: 8,
  pugilist: 8,
  scholar: 6,
  duelist: 10,
  blackguard: 10,
  blood_hunter: 10, // Blood Hunter (2024 Rules): Hit Point Die D10 per Blood Hunter level
  // Warlord (2026-11-07, Stage 5): hit die 8, matching classes.json.
  // Ends the accidental fallback — HIT_DICE[class] || 8 elsewhere in
  // the codebase happened to yield the same value; this entry makes
  // it explicit. No behavior change.
  warlord: 8,
}

// Keeper texts known and recitations by level
const KEEPER_PROGRESSION = {
  textsKnown: [3, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 14],
  genreBonusTexts: [0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2],
  recitations: [2, 2, 2, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 5, 5, 5, 5, 6, 6, 6],
  recitationDamage: ['1d8', '1d8', '1d8', '1d8', '2d8', '2d8', '2d8', '2d8', '2d8', '2d8', '3d8', '3d8', '3d8', '3d8', '3d8', '3d8', '4d8', '4d8', '4d8', '4d8'],
  manifestBonusDie: [null, null, null, null, null, null, null, null, null, null, '1d6', '1d6', '1d6', '1d6', '1d6', '1d6', '1d6', '1d6', '1d6', '1d6'],
  keeperStudyDie: [null, '1d4', '1d4', '1d4', '1d4', '1d4', '1d4', '1d4', '1d6', '1d6', '1d6', '1d6', '1d6', '1d6', '1d8', '1d8', '1d8', '1d8', '1d8', '1d8'],
  genreDomainLevel: 3,
  specializationLevel: 6,
  secondGenreLevel: 15
}

// Martial arts die progression for monks
// 2024 ladder (combat item 2): d6/d8/d10/d12 — the 2014 d4/d6/d8/d10
// ladder it replaces is not kept anywhere; do not revert it.
const MARTIAL_ARTS_DIE = {
  1: 'd6', 2: 'd6', 3: 'd6', 4: 'd6',
  5: 'd8', 6: 'd8', 7: 'd8', 8: 'd8', 9: 'd8', 10: 'd8',
  11: 'd10', 12: 'd10', 13: 'd10', 14: 'd10', 15: 'd10', 16: 'd10',
  17: 'd12', 18: 'd12', 19: 'd12', 20: 'd12'
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
  20: { damage: 4, uses: 6 } // 2024 (combat item 2): 6 at L20, not Unlimited
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

// Multiclass prerequisites REMOVED 2026-11-08 (Zach, main chat: all
// classes multiclass freely, no ability-score gates). The table,
// the check function, and the per-society Magus check are deleted,
// not left inert — an inert table would be re-read as authority.
// Moot by the same rule (recorded, not ruled): Blackguard Str 13 +
// Cha 13, Sidereal Con 13 + Int 13 (adopted by analogy), the
// Spellshot/Warden/Duelist "stay unlisted" question, and the whole
// "fill the table" scope. Subclass-level gates (SUBCLASS_LEVELS)
// and multiclass slot math (getMulticlassSpellSlots, Magus 0) are
// untouched — the rule covers prerequisites, not slots.

// Proficiencies gained on multiclassing INTO Blood Hunter (Blood Hunter
// 2024 Rules, "Multiclassing and the Blood Hunter", 2026-11-06):
// Light armor, Medium armor, Shields, Simple weapons, Martial weapons,
// and Alchemist's Supplies. Surfaced on the level-up-info multiclass
// option (the magus MULTICLASS_GRANT pattern in magusService.js).
// (2026-11-08: multiclass prerequisites removed — the grant is what
// you gain on multiclassing in, not a gate on doing it.)
const BLOOD_HUNTER_MULTICLASS_GRANT = {
  hitDie: 10,
  armor: ['light', 'medium', 'shields'],
  weapons: ['simple', 'martial'],
  tools: ["Alchemist's Supplies"],
}

// Proficiencies gained on multiclassing INTO Warlord (KibblesTasty
// Warlord v1.5, "Multiclassing", p. 13 — 2026-11-08, multiclass
// removal job): Light Armor, Medium Armor. (The book prints no
// prerequisite for Warlord — and prerequisites are gone anyway —
// but the proficiency grant is what you gain, not a gate, so it is
// built here beside BLOOD_HUNTER_MULTICLASS_GRANT, the same shape.)
const WARLORD_MULTICLASS_GRANT = {
  hitDie: 8,
  armor: ['light', 'medium'],
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
  monk: 'none',
  keeper: 'third',
  spellshot: "none",
  warden: "third",
  magus: "magus",
  pugilist: "none",
  scholar: "third",
  duelist: "none",
  blackguard: "half",
  blood_hunter: 'profane', // Pact magic only via Order of the Profane Soul (see SPELLCASTING_SUBCLASSES); other Orders contribute 0
  warlord: "none", // No spell slots; Leadership-Dice casting (Noble / Packleader / Dreadlord) is not slot casting
}

// Subclasses that grant spellcasting to martial classes.
// For Keeper, every L6 path (the four subclasses + Polymath) qualifies — Keeper IS the
// casting class, so all paths count as third-caster for multiclass slot calculation
// once the L6 specialization choice is made.
const SPELLCASTING_SUBCLASSES = {
  fighter: ['Eldritch Knight'],
  rogue: ['Arcane Trickster'],
  keeper: ['Lorewarden', 'Mythslinger', 'Rhetorician', 'Versebinder', 'Polymath'],
  warden: [
    "Loreseeker",
    "Soulblood Shaman"
  ],
  scholar: [
    "Ritualist",
    "Theologian"
  ],
  // Blood Hunter: only the Order of the Profane Soul casts (Pact Magic,
  // Intelligence). Ghostslayer / Lycan / Mutant never grant slots.
  blood_hunter: ['Order of the Profane Soul'],
}

// Spellcasting ability by class (Stage 4, 2026-11-06). Verified
// against client/src/data/classes.json `spellcasting.ability` for
// the 12 casting classes: artificer int, bard cha, cleric wis,
// druid wis, paladin cha, ranger wis, sorcerer cha, warlock cha,
// wizard int, spellshot int, blackguard cha, magus 'society'.
// Magus has no single ability — it is society-dependent — so the
// flat map records 'society' and the real ability resolves through
// SPELLCASTING_ABILITY_BY_SUBCLASS below. Warden/scholar are absent
// from the flat map for the same reason (casting subclass only).
// Cross-check: server/services/combatStatsService.js
// CLASS_CASTING_ABILITY carries the same 11 single-ability values.
const SPELLCASTING_ABILITY = {
  artificer: 'int',
  bard: 'cha',
  blackguard: 'cha',
  cleric: 'wis',
  druid: 'wis',
  magus: 'society',
  paladin: 'cha',
  ranger: 'wis',
  sorcerer: 'cha',
  spellshot: 'int',
  warlock: 'cha',
  wizard: 'int',
};

// Spellcasting ability by casting subclass (Stage 4). Keys are
// normalized subclass keys: lowercase, spaces/hyphens to '_',
// leading 'the ' stripped (same normalization as
// spellcastingAbilityFor below). Sources, all verified live:
//   - magus societies: server/services/magusService.js
//     SOCIETY_SPELLCASTING_ABILITY (Arcane Order int, Knights
//     Stygian cha, Primordial Seal cha, Shadow Court int, Sidereal
//     Cabal int, Sylvan Circle wis).
//   - warden Calls: server/services/wardenService.js
//     CASTING_SUBCLASS_ABILITY (Loreseeker int, Soulblood Shaman wis);
//     also server/data/subclasses/warden.js mechanics.ability.
//   - scholar Fields: server/data/subclasses/scholar.js
//     mechanics.ability ('Intelligence' for both Ritualist and
//     Theologian); also combatStatsService spellProfileFor.
// Duplicated here (rather than imported) so this config stays
// dependency-free — the same reason the slot tables live here.
const SPELLCASTING_ABILITY_BY_SUBCLASS = {
  magus: {
    arcane_order: 'int',
    knights_stygian: 'cha',
    primordial_seal: 'cha',
    shadow_court: 'int',
    sidereal_cabal: 'int',
    sylvan_circle: 'wis',
  },
  warden: {
    loreseeker: 'int',
    soulblood_shaman: 'wis',
  },
  scholar: {
    ritualist: 'int',
    theologian: 'int',
  },
  // Blood Hunter: only the Order of the Profane Soul casts, with
  // Intelligence (Pact Magic). Other Orders have no casting ability.
  blood_hunter: {
    order_of_the_profane_soul: 'int',
  },
  // Eldritch Knight / Arcane Trickster (2024 PHB, 2026-11-07):
  // Intelligence for both. Keys are normalized subclass keys, same
  // form as warden/scholar above ('Eldritch Knight' ->
  // 'eldritch_knight'); spellcastingAbilityFor resolves them.
  fighter: {
    eldritch_knight: 'int',
  },
  rogue: {
    arcane_trickster: 'int',
  },
};

// Infusions known for artificers
const ARTIFICER_INFUSIONS = {
  known: [0, 4, 4, 4, 4, 6, 6, 6, 6, 8, 8, 8, 8, 10, 10, 10, 10, 12, 12, 12],
  infused: [0, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 6, 6, 6]
}

const MAGUS_SPELL_SLOTS = {
  "1": {},
  "2": {
    "1": 2
  },
  "3": {
    "1": 3
  },
  "4": {
    "1": 3
  },
  "5": {
    "1": 4,
    "2": 2
  },
  "6": {
    "1": 4,
    "2": 2
  },
  "7": {
    "1": 4,
    "2": 3
  },
  "8": {
    "1": 4,
    "2": 3
  },
  "9": {
    "1": 4,
    "2": 3,
    "3": 2
  },
  "10": {
    "1": 4,
    "2": 3,
    "3": 2
  },
  "11": {
    "1": 4,
    "2": 3,
    "3": 3
  },
  "12": {
    "1": 4,
    "2": 3,
    "3": 3
  },
  "13": {
    "1": 4,
    "2": 3,
    "3": 3,
    "4": 1
  },
  "14": {
    "1": 4,
    "2": 3,
    "3": 3,
    "4": 1
  },
  "15": {
    "1": 4,
    "2": 3,
    "3": 3,
    "4": 2
  },
  "16": {
    "1": 4,
    "2": 3,
    "3": 3,
    "4": 2
  },
  "17": {
    "1": 4,
    "2": 3,
    "3": 3,
    "4": 3,
    "5": 1
  },
  "18": {
    "1": 4,
    "2": 3,
    "3": 3,
    "4": 3,
    "5": 1
  },
  "19": {
    "1": 4,
    "2": 3,
    "3": 3,
    "4": 3,
    "5": 2
  },
  "20": {
    "1": 4,
    "2": 3,
    "3": 3,
    "4": 3,
    "5": 2
  }
}

// Third-caster spell slots (Warden casting Calls + Scholar casting
// Fields, 2026-11-06 item 11). One shared table, two named exports:
// the Loreseeker (Warden Class extract, "Loreseeker Spellcasting"
// table), Ritualist (Scholar Class extract, "Ritualist" table) and
// Theologian (Scholar Class extract, "Theologian" table) print the
// SAME slot rows — 3rd-6th 2/—, 7th-9th 4/2, 10th-12th 4/3,
// 13th-15th 4/3/2, 16th-18th 4/3/3, 19th-20th 4/3/3/1 (max 4th
// level). Levels 1-2 have no slots: casting begins at 3rd. Base
// classes stay non-casters — the tables apply only behind the
// SPELLCASTING_SUBCLASSES gate (see getSpellSlots below).
const THIRD_CASTER_SPELL_SLOTS = {
  1: {},
  2: {},
  3: { 1: 2 },
  4: { 1: 3 },
  5: { 1: 3 },
  6: { 1: 3 },
  7: { 1: 4, 2: 2 },
  8: { 1: 4, 2: 2 },
  9: { 1: 4, 2: 2 },
  10: { 1: 4, 2: 3 },
  11: { 1: 4, 2: 3 },
  12: { 1: 4, 2: 3 },
  13: { 1: 4, 2: 3, 3: 2 },
  14: { 1: 4, 2: 3, 3: 2 },
  15: { 1: 4, 2: 3, 3: 2 },
  16: { 1: 4, 2: 3, 3: 3 },
  17: { 1: 4, 2: 3, 3: 3 },
  18: { 1: 4, 2: 3, 3: 3 },
  19: { 1: 4, 2: 3, 3: 3, 4: 1 },
  20: { 1: 4, 2: 3, 3: 3, 4: 1 },
}
const WARDEN_SPELL_SLOTS = THIRD_CASTER_SPELL_SLOTS
const SCHOLAR_SPELL_SLOTS = THIRD_CASTER_SPELL_SLOTS

// Cantrips known for the casting subclasses (same extracts):
// Warden (Loreseeker / Soulblood Shaman): 2 at 3rd, +1 at 10th.
// Scholar (Ritualist / Theologian): 2 at 3rd, +1 at 9th.
const WARDEN_CANTRIPS_KNOWN = [0, 0, 2, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3]
const SCHOLAR_CANTRIPS_KNOWN = [0, 0, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3]

// Spells known (Warden casting Calls, Scholar Ritualist) / spells
// prepared (Scholar Theologian) by class level: 3 at 3rd -> 13 at
// 20th (same printed column in all three subclass tables). Levels
// 1-2 are 0 in the arrays but the getters return null below them —
// casting begins at 3rd, so a level-1/2 character of these classes
// is still a non-caster for Stage 4 / spell-route purposes.
const WARDEN_SPELLS_KNOWN = [0, 0, 3, 4, 4, 4, 5, 6, 6, 7, 8, 8, 9, 10, 10, 11, 11, 11, 12, 13]
const SCHOLAR_SPELLS_KNOWN = WARDEN_SPELLS_KNOWN
const THEOLOGIAN_SPELLS_PREPARED = WARDEN_SPELLS_KNOWN

// Eldritch Knight / Arcane Trickster prepared spells (2024 PHB,
// Eldritch Knight / Arcane Trickster Spellcasting tables, 2026-11-07):
// 3 at 3rd -> 13 at 20th. Numerically IDENTICAL to WARDEN_SPELLS_KNOWN
// (same breakpoints 3/4/7/8/10/11/13/14/16/19/20) but a separate named
// constant: EK/AT PREPARE (the Warden Calls KNOW), and the getters are
// class-gated — do not alias silently or reuse the warden getter.
// Levels 1-2 are 0 in the array but the getter returns null below 3rd
// — casting begins at 3rd, so a level-1/2 fighter/rogue is still a
// non-caster for Stage 4 / spell-route purposes.
// Cantrips are per-subclass (PHB via the verified registry notes):
// Eldritch Knight 2 at 3rd, 3rd at 10th; Arcane Trickster Mage Hand +
// 2 Wizard cantrips at 3rd (= 3 total), 4th at 10th — Mage Hand counts
// toward the total.
const ELDRITCH_KNIGHT_ARCANE_TRICKSTER_SPELLS_PREPARED = [0, 0, 3, 4, 4, 4, 5, 6, 6, 7, 8, 8, 9, 10, 10, 11, 11, 11, 12, 13]
const ELDRITCH_KNIGHT_CANTRIPS_KNOWN = [0, 0, 2, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3]
const ARCANE_TRICKSTER_CANTRIPS_KNOWN = [0, 0, 3, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4]
const ELDRITCH_KNIGHT_SPELL_SLOTS = THIRD_CASTER_SPELL_SLOTS
const ARCANE_TRICKSTER_SPELL_SLOTS = THIRD_CASTER_SPELL_SLOTS

// Profane Soul (Blood Hunter, Order of the Profane Soul) pact tables —
// Blood Hunter (2024 Rules), "Profane Soul Spellcasting" table, 2026-11-06.
// Warlock shape { slots, level }: 1 slot at 3rd–5th, 2 slots at 6th+;
// slot level 1st at 3rd–6th, 2nd at 7th–12th, 3rd at 13th–18th, 4th at
// 19th–20th. Levels 1–2 are {} (casting begins at 3rd with the Order).
// Cantrips: 2 at 3rd, 3 at 10th. Prepared: 2 at 3rd rising to 11 at 20th
// (fixed table, not mod-based — same shape as THEOLOGIAN_SPELLS_PREPARED).
const PROFANE_SOUL_SPELL_SLOTS = {
  1: {}, 2: {},
  3: { slots: 1, level: 1 }, 4: { slots: 1, level: 1 }, 5: { slots: 1, level: 1 },
  6: { slots: 2, level: 1 },
  7: { slots: 2, level: 2 }, 8: { slots: 2, level: 2 }, 9: { slots: 2, level: 2 },
  10: { slots: 2, level: 2 }, 11: { slots: 2, level: 2 }, 12: { slots: 2, level: 2 },
  13: { slots: 2, level: 3 }, 14: { slots: 2, level: 3 }, 15: { slots: 2, level: 3 },
  16: { slots: 2, level: 3 }, 17: { slots: 2, level: 3 }, 18: { slots: 2, level: 3 },
  19: { slots: 2, level: 4 }, 20: { slots: 2, level: 4 },
}
const PROFANE_SOUL_CANTRIPS_KNOWN = [0, 0, 2, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3]
const PROFANE_SOUL_SPELLS_PREPARED = [0, 0, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 11]

// Sorcerer (2024 PHB, Sorcerer Features table, "Prepared Spells"
// column, 2026-11-06): sorcerers PREPARE in 2024 — the L1 Spellcasting
// text says "The number of spells on your list increases as you gain
// Sorcerer levels, as shown in the Prepared Spells column of the
// Sorcerer Features table." The book states NO formula — the column
// governs, so this is a fixed table (same shape as the Theologian /
// Profane Soul arms), not a mod-based rule: 2 at 1st -> 22 at 20th.
// It does NOT equal Cha mod + level at any consistent mod (L1 = 2,
// L20 = 22), so do not "simplify" it into a formula. Sorcerers have
// full-caster spell slots at every level 1-20, so no slot gate applies.
const SORCERER_SPELLS_PREPARED = [2, 4, 6, 7, 9, 10, 11, 12, 14, 15, 16, 16, 17, 17, 18, 18, 19, 20, 21, 22]

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

// Whether a subclass grants spellcasting to a martial /
// third-caster class (same normalization as
// spellcastingAbilityFor: lowercase, spaces/hyphens to '_',
// leading 'the ' stripped). Warden/scholar casting subclasses
// live in SPELLCASTING_SUBCLASSES above.
function isCastingSubclass(classKey, subclass) {
  if (subclass == null || String(subclass).trim() === '') return false;
  const norm = String(subclass).trim().toLowerCase()
    .replace(/^the\s+/, '').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  const list = SPELLCASTING_SUBCLASSES[classKey] || [];
  return list.some((s) => String(s).trim().toLowerCase()
    .replace(/^the\s+/, '').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') === norm);
}

function getSpellSlots(className, level, subclass = null) {
  const classKey = className.toLowerCase()
  const fullCasters = ['bard', 'cleric', 'druid', 'sorcerer', 'wizard']
  const halfCasters = ['blackguard']

  if (fullCasters.includes(classKey)) {
    return FULL_CASTER_SPELL_SLOTS[level]
  } else if (classKey === 'paladin') {
    // 2024 PHB table (pp. 109-110): slots start at L1 — see
    // PALADIN_SPELL_SLOTS above. The shared HALF_CASTER table is the
    // 2014 table and stays with blackguard.
    return PALADIN_SPELL_SLOTS[level]
  } else if (classKey === 'ranger') {
    // Ranger (2024 PHB, 2026-11-06): its own slot table — the shared
    // HALF_CASTER table differs at L4 (Paladin 4/2 vs Ranger 3) and
    // L6 (Paladin 4/3 vs Ranger 4/2). Do NOT merge them.
    return RANGER_SPELL_SLOTS[level]
  } else if (halfCasters.includes(classKey)) {
    return HALF_CASTER_SPELL_SLOTS[level]
  } else if (classKey === 'warlock') {
    return WARLOCK_SPELL_SLOTS[level]
  } else if (classKey === 'artificer') {
    return ARTIFICER_SPELL_SLOTS[level]
  } else if (classKey === 'magus') {
    return MAGUS_SPELL_SLOTS[level]
  } else if ((classKey === 'warden' || classKey === 'scholar') && isCastingSubclass(classKey, subclass)) {
    // Third-caster subclasses only (Loreseeker / Soulblood Shaman,
    // Ritualist / Theologian). Without a casting subclass — or with
    // no subclass at all — the base class has no slots ({}), as
    // before.
    return (classKey === 'warden' ? WARDEN_SPELL_SLOTS : SCHOLAR_SPELL_SLOTS)[level] || {}
  } else if ((classKey === 'fighter' || classKey === 'rogue') && isCastingSubclass(classKey, subclass)) {
    // Eldritch Knight / Arcane Trickster (2024 PHB, 2026-11-07):
    // the same third-caster slot table as warden/scholar, now wired
    // with the matching cantrips / prepared-spell arms below — the
    // deliberate exclusion that lived here (EK/AT stayed on {} pending
    // this job) is closed. Without the casting subclass — or with no
    // subclass at all — the base class has no slots ({}), as before.
    return THIRD_CASTER_SPELL_SLOTS[level] || {}
  } else if (classKey === 'blood_hunter' && isCastingSubclass(classKey, subclass)) {
    // Order of the Profane Soul only (Blood Hunter 2024 Rules, Pact
    // Magic): pact slots from the Profane Soul table (warlock shape).
    // Other Orders — and no subclass at all — have no slots.
    return PROFANE_SOUL_SPELL_SLOTS[level] || {}
  }
  return {}
}

function getCantripsKnown(className, level, subclass = null) {
  const classKey = className.toLowerCase()
  if ((classKey === 'fighter' || classKey === 'rogue') && isCastingSubclass(classKey, subclass)) {
    // Eldritch Knight: 2 at 3rd, 3rd at 10th. Arcane Trickster:
    // Mage Hand + 2 at 3rd (= 3 total), 4th at 10th — Mage Hand
    // counts toward the total. Per-subclass, not shared.
    const row = classKey === 'fighter' ? ELDRITCH_KNIGHT_CANTRIPS_KNOWN : ARCANE_TRICKSTER_CANTRIPS_KNOWN
    return row[level - 1] || 0
  }
  if ((classKey === 'warden' || classKey === 'scholar') && isCastingSubclass(classKey, subclass)) {
    const row = classKey === 'warden' ? WARDEN_CANTRIPS_KNOWN : SCHOLAR_CANTRIPS_KNOWN
    return row[level - 1] || 0
  }
  // Profane Soul (Blood Hunter, 2024 Rules): 2 cantrips at 3rd, 3 at 10th.
  if (classKey === 'blood_hunter' && isCastingSubclass(classKey, subclass)) {
    return PROFANE_SOUL_CANTRIPS_KNOWN[level - 1] || 0
  }
  if (CANTRIPS_KNOWN[classKey]) {
    return CANTRIPS_KNOWN[classKey][level - 1] || 0
  }
  return 0
}

function getSpellsKnown(className, level, subclass = null) {
  const classKey = className.toLowerCase()
  if (classKey === 'warden' || classKey === 'scholar') {
    // Casting subclasses only, from 3rd (casting begins at 3rd):
    // Warden Calls + Ritualist KNOW (3->13); Theologian PREPARES,
    // so it returns null here (see getSpellsPrepared). Any other
    // subclass — or none — keeps the old null: the base class does
    // not cast, and levels 1-2 have no casting yet.
    if (!isCastingSubclass(classKey, subclass)) return null
    if (classKey === 'scholar' && isTheologianSubclass(subclass)) return null
    const lvl = Number(level)
    if (!Number.isInteger(lvl) || lvl < 3 || lvl > 20) return null
    const row = classKey === 'warden' ? WARDEN_SPELLS_KNOWN : SCHOLAR_SPELLS_KNOWN
    return row[lvl - 1]
  }
  if (SPELLS_KNOWN[classKey]) {
    return SPELLS_KNOWN[classKey][level - 1] || 0
  }
  return null // null means class prepares spells instead of knowing them
}

// Theologian check (scholar casting-subclass gate above): the
// Theologian prepares from the cleric list — see getSpellsPrepared.
function isTheologianSubclass(subclass) {
  if (subclass == null || String(subclass).trim() === '') return false;
  const norm = String(subclass).trim().toLowerCase()
    .replace(/^the\s+/, '').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return norm === 'theologian';
}

// Spellcasting ability for a class, resolving subclass-dependent
// cases (Stage 4). Returns a 3-letter ability key ('int' / 'wis' /
// 'cha') or null when the class does not cast, or when the ability
// depends on a subclass that was not given (magus without a society,
// warden/scholar without a casting subclass).
function spellcastingAbilityFor(classId, subclass = null) {
  const key = String(classId || '').trim().toLowerCase();
  if (!key) return null;
  if (subclass != null && String(subclass).trim() !== '') {
    const norm = String(subclass).trim().toLowerCase()
      .replace(/^the\s+/, '').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    const bySubclass = SPELLCASTING_ABILITY_BY_SUBCLASS[key];
    if (bySubclass && bySubclass[norm]) return bySubclass[norm];
    // A subclass was given but it is not a casting subclass (e.g. a
    // warden Call that does not cast) — the ability is not this
    // class's flat value either; fall through to null only when the
    // class is subclass-dependent, otherwise use the flat map.
    if (key === 'magus' || key === 'warden' || key === 'scholar') return null;
  }
  const flat = SPELLCASTING_ABILITY[key];
  if (!flat || flat === 'society') return null;
  return flat;
}

// Spells prepared at a level (Stage 4). Returns null for
// known-casters and non-casters (they do not prepare), and the 2024
// prepared count for prepared casters:
//   - cleric, druid, wizard:
//     ability modifier + class level (minimum 1).
//   - paladin (2024 PHB, pp. 109-110, verified from the book
//     2026-11-06): the Prepared Spells column of the Paladin
//     Features table — 2, 3, 4, 5, 6, 6, 7, 7, 9, 10, 10, 11, 11,
//     12, 12, 14, 14, 14, 15, 15 for levels 1-20 (PALADIN_SPELLS_
//     PREPARED). The book states NO Cha-mod formula — the L1
//     Spellcasting text says "To start, choose two level 1 Paladin
//     spells" and the count increases "as shown in the Prepared
//     Spells column". The 2014 rule (Cha mod + half level, min 1,
//     gated to 0 at L1 for having no 1st-level slots) is retired:
//     a 2024 L1 paladin HAS two 1st-level slots and prepares 2.
//     Fixed table, not mod-based — same shape as the Theologian /
//     Profane Soul arms. abilityMod is ignored for paladin.
//   - artificer (2024 PHB — Zach, 2026-11-06: the 2024 book always
//     wins): Intelligence modifier + half artificer level, rounded
//     down (minimum 1). Same formula as
//     artificerService.preparedSpellsForLevel; the two agree at every
//     level and mod (asserted in creator-next-stage4 group (g)).
//   - blackguard (printed rule, blackguardService.preparedSpellsMax):
//     Charisma modifier + half blackguard level, rounded down
//     (minimum 1).
//   - sorcerer (2024 PHB, Sorcerer Features table — 2026-11-06):
//     fixed Prepared Spells column, 2 at 1st -> 22 at 20th. The
//     book states no formula (the L1 Spellcasting text points at
//     the column), so this is a table lookup, not Cha mod + level
//     (no consistent mod fits: L1 = 2, L20 = 22). Sorcerers have
//     spell slots at every level, so no slot gate applies.
//   - blood_hunter, Order of the Profane Soul only (Blood Hunter 2024
//     Rules, Pact Magic table — 2026-11-06): fixed 2 at 3rd -> 11 at
//     20th, not mod-based (same shape as the Theologian arm). Other
//     Orders never prepare spells. The always-prepared Revealed /
//     Unsealed Arcana patron spells do not count against this number.
// A prepared caster with no spell slots at that level prepares 0
// (blackguard has no 1st-level slots — its slot table is {} at level
// 1 — so it picks 0 spells at L1 even though the formula alone would
// give >= 1). Paladin no longer falls under this sentence: the 2024
// PHB gives it two 1st-level slots at L1, and its fixed-table arm
// below runs before the slot gate. Ranger likewise: the 2024 PHB
// gives it two 1st-level slots at L1, and its fixed-table arm below
// runs before the slot gate.

// Ranger (2024 PHB, Ranger Features table, "Prepared Spells" column,
// 2026-11-06): rangers PREPARE in 2024 — the L1 Spellcasting text
// says "The number of spells on your list increases as you gain Ranger
// levels, as shown in the Prepared Spells column of the Ranger Features
// table." The book states NO formula — the column governs, so this is
// a fixed table (same shape as the Theologian / Profane Soul / Sorcerer
// / Warlock / Paladin arms), not a mod-based rule: 2 at 1st -> 15 at
// 20th. It is IDENTICAL to the Paladin column at every level, but it
// is a separate table: the slot tables differ (L4 Paladin 4/2 vs Ranger
// 3; L6 Paladin 4/3 vs Ranger 4/2), so the two classes must not share
// a slot table. Ranger slots are their own table (RANGER_SPELL_SLOTS,
// below) — do NOT "fix" HALF_CASTER_SPELL_SLOTS in place: Blackguard
// uses it, and the Paladin coordinator owns that surface.
const RANGER_SPELLS_PREPARED = [2, 3, 4, 5, 6, 6, 7, 7, 9, 10, 10, 11, 11, 12, 12, 14, 14, 14, 15, 15];

// Ranger spell slots (2024 PHB, Ranger Features table, "Spell Slots
// per Spell Level" columns, 2026-11-06). Half-caster progression, but
// NOT the shared HALF_CASTER_SPELL_SLOTS table: it differs at L4
// (Paladin 4/2 vs Ranger 3) and L6 (Paladin 4/3 vs Ranger 4/2). This
// is the one-level shift the Paladin job flagged as not-built for
// ranger — it is built now, as its own table.
const RANGER_SPELL_SLOTS = {
  1: { 1: 2 },
  2: { 1: 2 },
  3: { 1: 3 },
  4: { 1: 3 },
  5: { 1: 4, 2: 2 },
  6: { 1: 4, 2: 2 },
  7: { 1: 4, 2: 3 },
  8: { 1: 4, 2: 3, 3: 2 },
  9: { 1: 4, 2: 3, 3: 2 },
  10: { 1: 4, 2: 3, 3: 3 },
  11: { 1: 4, 2: 3, 3: 3 },
  12: { 1: 4, 2: 3, 3: 3, 4: 1 },
  13: { 1: 4, 2: 3, 3: 3, 4: 1 },
  14: { 1: 4, 2: 3, 3: 3, 4: 2 },
  15: { 1: 4, 2: 3, 3: 3, 4: 2 },
  16: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 1 },
  17: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 1 },
  18: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 1 },
  19: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2 },
  20: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2 },
};

// Favored Enemy free Hunter's Mark casts (2024 PHB, Ranger Features
// table, "Favored Enemy" — the feature lets the ranger cast Hunter's
// Mark without expending a spell slot a number of times per Long Rest:
// 2 at 1st -> 6 at 17th. Hunter's Mark is always prepared (see
// rangerService / Stage 4 grant); these free casts regain on Long
// Rest. There is no rest/resource row for them yet — the table and
// the count surfacing are implemented; spending/regaining uses is a
// named follow-up.
const FAVORED_ENEMY_FREE_CASTS = [2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 6, 6, 6, 6];
function getSpellsPrepared(classId, level, abilityMod = 0, subclass = null) {
  const key = String(classId || '').trim().toLowerCase();
  // Theologian (Scholar, 2026-11-06 item 11): prepares from the
  // cleric list — the extract's "Preparing and Casting Spells"
  // text ("You prepare the list of cleric spells... choose a number
  // of cleric spells according to your levels in this class on the
  // Spells Prepared column of the Theologian table") and Daily
  // Devotion ("domain spells... count as prepared for you") settle
  // the table's "Spells Known" heading as a mislabel: the count is
  // PREPARED 3 at 3rd -> 13 at 20th (same column values as the
  // Ritualist known table). Fixed table, not mod-based; Daily
  // Devotion domain spells count as prepared in addition (they do
  // not consume this count). Before 3rd there is no casting: null,
  // like any non-caster at level 1-2.
  if (key === 'scholar' && isTheologianSubclass(subclass)) {
    const lvl = Number(level);
    if (!Number.isInteger(lvl) || lvl < 3 || lvl > 20) return null;
    return THEOLOGIAN_SPELLS_PREPARED[lvl - 1];
  }
  // Profane Soul (Blood Hunter, 2024 Rules — 2026-11-06): prepares from
  // the Warlock list — fixed table 2 at 3rd -> 11 at 20th (same shape as
  // the Theologian arm above; the always-prepared Revealed/Unsealed
  // Arcana spells do NOT count against this number). Before 3rd there
  // is no casting: null, like any non-caster at level 1-2. Other
  // Orders never cast: null (they fall through to the gate below).
  if (key === 'blood_hunter' && isCastingSubclass(key, subclass)) {
    const lvl = Number(level);
    if (!Number.isInteger(lvl) || lvl < 3 || lvl > 20) return null;
    return PROFANE_SOUL_SPELLS_PREPARED[lvl - 1];
  }
  // Warlock (2026-11-06): 2024 PHB rule — fixed Prepared Spells
  // column, 2 at 1st -> 15 at 20th (WARLOCK_SPELLS_PREPARED).
  // The book states no formula, so no mod is consulted; the table
  // governs at every level. Warlocks have Pact Magic slots at every
  // level, so no slot gate applies. PUT /:id + level-up validators
  // live in server/routes/character.js (warlock blocks, 2026-11-07).
  if (key === 'warlock') {
    const lvl = Number(level);
    if (!Number.isInteger(lvl) || lvl < 1 || lvl > 20) return null;
    return WARLOCK_SPELLS_PREPARED[lvl - 1];
  }
  // Paladin (2024 PHB, pp. 109-110 — 2026-11-06 correction): fixed
  // table (PALADIN_SPELLS_PREPARED), not mod-based. Placed BEFORE
  // the slot gate below, same shape as the Theologian / Profane Soul
  // arms: the slot gate must NOT zero L1 for paladin — a 2024 L1
  // paladin has two 1st-level slots and prepares 2 spells.
  if (key === 'paladin') {
    const lvl = Number(level);
    if (!Number.isInteger(lvl) || lvl < 1 || lvl > 20) return null;
    return PALADIN_SPELLS_PREPARED[lvl - 1];
  }
  // Ranger (2024 PHB, 2026-11-06): table-driven, NOT mod-based —
  // the fixed Prepared Spells column (RANGER_SPELLS_PREPARED, 2 at
  // 1st -> 15 at 20th). Placed BEFORE the PREPARED_CASTERS gate like
  // the Theologian / Profane Soul / Sorcerer / Warlock / Paladin arms,
  // because the slot gate below would zero L1 (the shared HALF_CASTER
  // table has no L1 slots) — but rangers HAVE 2 first-level slots at
  // L1, so L1 = 2. (Every level 1-20 has slots in RANGER_SPELL_SLOTS,
  // so the table value governs directly; no separate slot gate is
  // needed here.)
  if (key === 'ranger') {
    const lvl = Number(level);
    if (!Number.isInteger(lvl) || lvl < 1 || lvl > 20) return null;
    return RANGER_SPELLS_PREPARED[lvl - 1];
  }
  // Eldritch Knight / Arcane Trickster (2024 PHB, 2026-11-07):
  // fixed Prepared Spells column, 3 at 3rd -> 13 at 20th
  // (ELDRITCH_KNIGHT_ARCANE_TRICKSTER_SPELLS_PREPARED). The book
  // states no formula, so no Int mod is consulted; the table
  // governs at every level. Placed BEFORE the PREPARED_CASTERS
  // gate like the Theologian / Profane Soul / Sorcerer / Warlock /
  // Paladin / Ranger arms. Before 3rd there is no casting: null,
  // like any non-caster at level 1-2. A fighter/rogue without the
  // casting subclass falls through to the gate below (null).
  if ((key === 'fighter' || key === 'rogue') && isCastingSubclass(key, subclass)) {
    const lvl = Number(level);
    if (!Number.isInteger(lvl) || lvl < 3 || lvl > 20) return null;
    return ELDRITCH_KNIGHT_ARCANE_TRICKSTER_SPELLS_PREPARED[lvl - 1];
  }

  const PREPARED_CASTERS = new Set(['cleric', 'druid', 'paladin', 'wizard', 'artificer', 'blackguard', 'bard', 'sorcerer']);
  if (!PREPARED_CASTERS.has(key)) return null;
  const lvl = Number(level);
  if (!Number.isInteger(lvl) || lvl < 1 || lvl > 20) return null;
  const mod = Number.isFinite(Number(abilityMod)) ? Math.trunc(Number(abilityMod)) : 0;
  const slots = getSpellSlots(key, lvl);
  const hasSlots = slots && typeof slots === 'object'
    && Object.values(slots).some((n) => Number(n) > 0);
  if (!hasSlots) return 0;
  if (key === 'blackguard') return Math.max(1, mod + Math.floor(lvl / 2));
  // Artificer: 2024 PHB formula (Int mod + half level, min 1) —
  // the same rule as artificerService.preparedSpellsForLevel, kept
  // inline here (not imported) to avoid dragging artificerService's
  // DB + marker-registration side effects into this config module;
  // a test asserts the two agree at every level and mod.
  if (key === 'artificer') return Math.max(1, mod + Math.floor(lvl / 2));
  // Bard (2026-11-06): 2024 PHB rule — Cha mod + bard level, min 1
  // (PHB prepared column 4-22; L1 = 4 at Cha +3). Bards prepare in
  // 2024, so the 2014 known-spells row is removed from SPELLS_KNOWN
  // below — a bard is a prepared caster, never both. PUT /:id +
  // level-up validators live in server/routes/character.js (bard
  // blocks, 2026-11-06/07).
  if (key === 'bard') return Math.max(1, mod + lvl);
  // Sorcerer (2026-11-06): 2024 PHB rule — fixed Prepared Spells
  // column, 2 at 1st -> 22 at 20th (SORCERER_SPELLS_PREPARED). The
  // book states no formula, so no mod is consulted; the table
  // governs at every level. Sorcerers have full-caster slots at
  // every level, so the slot gate above never fires for them.
  if (key === 'sorcerer') return SORCERER_SPELLS_PREPARED[lvl - 1];
  return Math.max(1, mod + lvl);
}


// Get all classes a character can multiclass into (returns all classes except current ones)
// Multiclass prerequisites were removed 2026-11-08 (Zach: all classes
// multiclass freely, no ability-score gates) — every class in
// CLASS_FEATURES (all 23) is offered. The MVP gray-out
// (magus/blackguard/scholar) is flagged, never removed, on the
// level-up-info route; the POST /level-up guard is the enforcement.
function getAvailableMulticlassOptions(currentClasses = []) {
  const allClasses = Object.keys(CLASS_FEATURES)
  const currentClassNames = currentClasses.map(c => c.class?.toLowerCase() || c.toLowerCase())

  // Return all classes except the ones the character already has
  return allClasses.filter(className => {
    // Can't multiclass into a class you already have
    return !currentClassNames.includes(className)
  })
}

// Calculate multiclass spell slots based on combined caster levels
function getMulticlassSpellSlots(classLevels, subclasses = {}) {
  let totalCasterLevel = 0
  let hasPactMagic = false
  let pactMagicLevel = 0
  let warlockLevel = 0
  let profaneSoulLevel = 0

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
    // 'magus' deliberately contributes 0: the source states no multiclass slot rule.
    } else if (casterType === 'pact') {
      hasPactMagic = true
      warlockLevel = level
    } else if (casterType === 'profane') {
      // Order of the Profane Soul only (Blood Hunter 2024 Rules, Pact
      // Magic): other Orders contribute nothing here, and a Profane
      // Soul with no warlock levels keeps its own pact slots (below).
      if (isCastingSubclass(className, subclass)) {
        hasPactMagic = true
        profaneSoulLevel = level
      }
    }
  }

  // Get spell slots from the multiclass table
  const spellSlots = totalCasterLevel > 0 ? FULL_CASTER_SPELL_SLOTS[totalCasterLevel] || {} : {}

  // Add pact magic info if applicable (it's tracked separately)
  if (hasPactMagic) {
    // Profane Soul + Warlock (Blood Hunter 2024 Rules, "Multiclassing
    // with Warlock"): add one-third of Blood Hunter levels (rounded
    // down) to the Warlock level and consult the Warlock table for
    // total slots, cantrips, and slot level. Combined level caps at
    // 20 (the Warlock table's max) — fail-closed, never invented.
    // A Profane Soul with no warlock levels keeps its own table.
    if (warlockLevel > 0) {
      pactMagicLevel = Math.min(20, warlockLevel + Math.floor(profaneSoulLevel / 3))
      return {
        spellSlots,
        pactMagic: WARLOCK_SPELL_SLOTS[pactMagicLevel]
      }
    }
    return {
      spellSlots,
      pactMagic: PROFANE_SOUL_SPELL_SLOTS[profaneSoulLevel] || {}
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
  PALADIN_SPELL_SLOTS,
  PALADIN_SPELLS_PREPARED,
  RANGER_SPELLS_PREPARED,
  RANGER_SPELL_SLOTS,
  FAVORED_ENEMY_FREE_CASTS,
  WARLOCK_SPELL_SLOTS,
  ARTIFICER_SPELL_SLOTS,
  MAGUS_SPELL_SLOTS,
  THIRD_CASTER_SPELL_SLOTS,
  WARDEN_SPELL_SLOTS,
  SCHOLAR_SPELL_SLOTS,
  ELDRITCH_KNIGHT_SPELL_SLOTS,
  ARCANE_TRICKSTER_SPELL_SLOTS,
  ELDRITCH_KNIGHT_ARCANE_TRICKSTER_SPELLS_PREPARED,
  ELDRITCH_KNIGHT_CANTRIPS_KNOWN,
  ARCANE_TRICKSTER_CANTRIPS_KNOWN,
  WARDEN_CANTRIPS_KNOWN,
  SCHOLAR_CANTRIPS_KNOWN,
  WARDEN_SPELLS_KNOWN,
  SCHOLAR_SPELLS_KNOWN,
  THEOLOGIAN_SPELLS_PREPARED,
  PROFANE_SOUL_SPELL_SLOTS,
  PROFANE_SOUL_CANTRIPS_KNOWN,
  PROFANE_SOUL_SPELLS_PREPARED,
  WARLOCK_SPELLS_PREPARED,
  SORCERER_SPELLS_PREPARED,
  isCastingSubclass,
  CANTRIPS_KNOWN,
  SPELLS_KNOWN,
  HIT_DICE,
  MARTIAL_ARTS_DIE,
  SNEAK_ATTACK_DICE,
  RAGE_PROGRESSION,
  KI_POINTS,
  SORCERY_POINTS,
  ARTIFICER_INFUSIONS,
  KEEPER_PROGRESSION,
  BLOOD_HUNTER_MULTICLASS_GRANT,
  WARLORD_MULTICLASS_GRANT,
  CASTER_TYPE,
  SPELLCASTING_SUBCLASSES,
  SPELLCASTING_ABILITY,
  SPELLCASTING_ABILITY_BY_SUBCLASS,
  spellcastingAbilityFor,
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
  getSpellsPrepared,
  getAvailableMulticlassOptions,
  getMulticlassSpellSlots,
  getTotalLevel,
  getHitDiceBreakdown
}
