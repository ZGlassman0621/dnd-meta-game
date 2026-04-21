/**
 * Character-creator reference maps.
 *
 * Single source of truth for 1-sentence explainers of shared D&D 5e concepts
 * that appear in multiple pickers (skills, tools, languages, damage types,
 * ability scores, weapon properties, Magic Initiate class options).
 *
 * These were previously bare names in dropdowns / option grids. Surfacing them
 * inline lets new players understand what they're picking without a rulebook.
 *
 * Wording draws from the 5e SRD (freely licensed) and is condensed for UI.
 */

// --- Ability scores --------------------------------------------------------

export const ABILITY_SCORES = {
  str: {
    name: 'Strength',
    short: 'Physical power.',
    description: 'Melee attack and damage rolls, carrying capacity, Athletics (climbing, jumping, swimming), and forcing open doors or breaking objects.'
  },
  dex: {
    name: 'Dexterity',
    short: 'Reflexes and agility.',
    description: 'Ranged attacks, AC in light armor, initiative, Acrobatics, Sleight of Hand, and Stealth.'
  },
  con: {
    name: 'Constitution',
    short: 'Toughness and stamina.',
    description: 'Hit points per level, holding concentration on spells under duress, and resisting poison, disease, and exhaustion.'
  },
  int: {
    name: 'Intelligence',
    short: 'Reasoning and memory.',
    description: 'Wizard and Artificer spellcasting; Arcana, History, Investigation, Nature, and Religion checks.'
  },
  wis: {
    name: 'Wisdom',
    short: 'Perception and insight.',
    description: 'Cleric, Druid, and Ranger spellcasting; Animal Handling, Insight, Medicine, Perception, and Survival.'
  },
  cha: {
    name: 'Charisma',
    short: 'Force of personality.',
    description: 'Bard, Sorcerer, Warlock, and Paladin spellcasting; Deception, Intimidation, Performance, and Persuasion.'
  }
};

// --- Skills ----------------------------------------------------------------

export const SKILLS = {
  acrobatics: { name: 'Acrobatics', ability: 'dex',
    description: 'Stay on your feet in tricky situations: tumbling, balancing on a beam, or staying upright on a pitching ship deck.' },
  animal_handling: { name: 'Animal Handling', ability: 'wis',
    description: 'Calm a spooked mount, read a creature\'s intentions, or control a trained animal in a tense moment.' },
  arcana: { name: 'Arcana', ability: 'int',
    description: 'Recall lore about spells, magic items, eldritch symbols, magical traditions, and planes of existence.' },
  athletics: { name: 'Athletics', ability: 'str',
    description: 'Climb cliffs, swim against currents, jump gaps, grapple, or shove enemies around.' },
  deception: { name: 'Deception', ability: 'cha',
    description: 'Convincingly hide the truth — through lies, disguise, or misleading body language.' },
  history: { name: 'History', ability: 'int',
    description: 'Recall lore about historical events, legendary people, ancient kingdoms, past disputes, and lost civilizations.' },
  insight: { name: 'Insight', ability: 'wis',
    description: 'Read a creature\'s true intentions — lie detection, mood, motivation, hidden agenda.' },
  intimidation: { name: 'Intimidation', ability: 'cha',
    description: 'Influence someone through overt threats, hostile actions, or a display of physical menace.' },
  investigation: { name: 'Investigation', ability: 'int',
    description: 'Find clues, deduce meaning from scenes, spot hidden details, and piece together puzzles.' },
  medicine: { name: 'Medicine', ability: 'wis',
    description: 'Stabilize the dying, diagnose an illness, or identify a poison.' },
  nature: { name: 'Nature', ability: 'int',
    description: 'Recall lore about terrain, plants, animals, weather, and natural cycles.' },
  perception: { name: 'Perception', ability: 'wis',
    description: 'Spot, hear, or otherwise detect the presence of something — traps, ambushes, hidden doors.' },
  performance: { name: 'Performance', ability: 'cha',
    description: 'Delight an audience through music, dance, oratory, acting, or other entertainment.' },
  persuasion: { name: 'Persuasion', ability: 'cha',
    description: 'Influence someone through tact, social grace, or good nature rather than force or deceit.' },
  religion: { name: 'Religion', ability: 'int',
    description: 'Recall lore about deities, rites, prayers, religious hierarchies, holy symbols, and cult practices.' },
  sleight_of_hand: { name: 'Sleight of Hand', ability: 'dex',
    description: 'Pickpocket, plant something on a person, conceal an object, or otherwise perform manual trickery.' },
  stealth: { name: 'Stealth', ability: 'dex',
    description: 'Conceal yourself from enemies, slip past guards, sneak up on unwary prey, or move silently.' },
  survival: { name: 'Survival', ability: 'wis',
    description: 'Follow tracks, hunt wild game, forage, navigate wilderness, avoid quicksand, and predict weather.' }
};

// --- Tools -----------------------------------------------------------------

export const TOOLS = {
  // Artisan's tools
  "Alchemist's Supplies": 'Brewing potions and identifying alchemical substances — vials, flasks, and reagents for extractions and analysis.',
  "Brewer's Supplies": 'Brewing ales, beers, and meads. Also useful for identifying beverages or sanitizing water.',
  "Calligrapher's Supplies": 'Writing elegant hand-lettered documents. Useful for forging signatures or recognizing a scribe\'s hand.',
  "Carpenter's Tools": 'Shaping wood — building structures, furniture, doors, and traps. Also useful for identifying weak spots in wooden construction.',
  "Cartographer's Tools": 'Drafting maps, estimating scale from terrain, and navigating by land features.',
  "Cobbler's Tools": 'Crafting and repairing footwear. Also useful for spotting worn shoe patterns that reveal a wearer\'s habits.',
  "Cook's Utensils": 'Preparing meals — seasoning, preservation, identifying ingredients, and spotting tainted food.',
  "Glassblower's Tools": 'Shaping molten glass. Also useful for identifying glass quality, origin, and craftsmanship.',
  "Jeweler's Tools": 'Appraising gems, cutting stones, setting jewelry. Useful for spotting fakes and valuing treasure.',
  "Leatherworker's Tools": 'Treating hides, making armor, saddles, belts, and bindings. Useful for identifying leather origin.',
  "Mason's Tools": 'Working stone — building walls, identifying construction techniques, spotting weak points in stonework.',
  "Painter's Supplies": 'Creating paintings, identifying an artist\'s hand, and copying visual details. Good for blending in with any art culture.',
  "Potter's Tools": 'Shaping clay vessels. Useful for identifying pottery origins, periods, and cultural markers.',
  "Smith's Tools": 'Forging and repairing metal weapons and armor. Useful for identifying metallurgy and armor strength.',
  "Tinker's Tools": 'Assembling, repairing, and modifying small mechanical devices — locks, clockwork, and constructs.',
  "Weaver's Tools": 'Producing and mending cloth and tapestries. Useful for identifying fabric origin and quality.',
  "Woodcarver's Tools": 'Carving wooden objects — arrows, figurines, puzzle boxes. Useful for crafting replacement bow shafts.',

  // Gaming sets
  "Dice Set": 'Wagering with dice. Gaming sets grant proficiency on games involving them and let you cheat by hand.',
  "Dragonchess Set": 'Playing dragonchess — a three-tiered strategy game enjoyed in urbane or scholarly circles.',
  "Playing Card Set": 'Playing card games of chance and skill. Useful for wagering in taverns or reading a player\'s tell.',
  "Three-Dragon Ante Set": 'Playing the gambling card game favored across the Realms. A common tavern pastime.',

  // Kits & specialty
  "Disguise Kit": 'Changing appearance — cosmetics, hair dye, prosthetics, and costume pieces to impersonate another.',
  "Forgery Kit": 'Producing false documents — seals, parchment, inks, and scripts to fool an untrained inspector.',
  "Herbalism Kit": 'Identifying plants, brewing antitoxins, and crafting healing potions from natural ingredients.',
  "Navigator's Tools": 'Charting courses, reading maps, and fixing position at sea by sextant and stars.',
  "Poisoner's Kit": 'Crafting poisons, applying them to weapons, and identifying poisons in food or drink.',
  "Thieves' Tools": 'Picking locks, disabling traps, and performing subtle mechanical tampering. Required proficiency for most locks.',

  // Instruments
  "Bagpipes": 'A drone-and-chanter instrument associated with highland and military traditions.',
  "Drum": 'Percussion for tavern songs, martial cadences, and tribal dance.',
  "Dulcimer": 'A hammered stringed instrument producing shimmering, layered tones.',
  "Flute": 'A transverse woodwind — bright, airy, good for carrying across crowds.',
  "Lute": 'The classic bard\'s plucked string instrument. Portable, expressive, and suited to song.',
  "Lyre": 'An ancient plucked string instrument associated with poetry, scholarship, and classical music.',
  "Horn": 'Brass signaling instrument — hunt calls, warnings, and ceremonial fanfare.',
  "Pan Flute": 'A set of pitched pipes played by blowing across them. Pastoral and woodland in character.',
  "Shawm": 'A piercing double-reed woodwind, ancestor of the oboe. Loud, formal, and festival-appropriate.',
  "Viol": 'A bowed string instrument with a mellow, melancholy tone.'
};

// --- Languages -------------------------------------------------------------

export const LANGUAGES = {
  // Standard
  "Common": 'The trade tongue spoken across civilized lands. Nearly every adventurer knows it.',
  "Dwarvish": 'The guttural, consonant-heavy tongue of dwarves. Written in the Dwarvish runes.',
  "Elvish": 'A fluid, melodic language with many dialects. Used by elves and scholars of ancient lore.',
  "Giant": 'The language of giants and ogres. Loud, blunt, and full of weather metaphors.',
  "Gnomish": 'A fast, tonal language full of technical jargon. Inventors and illusionists use it often.',
  "Goblin": 'A harsh, yelping tongue spoken by goblins, hobgoblins, and bugbears.',
  "Halfling": 'A warm, informal language centered on home, hearth, and small community life. Rarely written.',
  "Orc": 'A brutal, percussive tongue. Used by orcs and half-orcs — also as a language of command in war.',

  // Exotic
  "Abyssal": 'The chaotic tongue of demons and the Abyss. Many consider it dangerous to even speak.',
  "Celestial": 'The bright, harmonic language of angels and the Upper Planes. Used in prayers and blessings.',
  "Deep Speech": 'The alien language of aberrations — mind flayers, beholders, aboleths. Disturbing to hear.',
  "Draconic": 'The ancient, formal tongue of dragons. Used in arcane spellcraft and scholarship.',
  "Infernal": 'The rigid, contractual language of devils and the Nine Hells. Known for its binding pacts.',
  "Primordial": 'The elemental tongue with four dialects (Auran, Aquan, Ignan, Terran). Spoken by genies, mephits, and elementals.',
  "Sylvan": 'The musical language of fey — dryads, satyrs, pixies, and the Feywild.',
  "Undercommon": 'The trade tongue of the Underdark — drow, duergar, deep gnomes, and those who do business with them.',

  // Other
  "Druidic": 'The secret language of druids, known only to them. Leaving a druidic message reveals another druid\'s hand.',
  "Thieves\' Cant": 'A coded mix of dialect, jargon, and hand signs used by rogues and criminal networks.'
};

// --- Damage types ----------------------------------------------------------

export const DAMAGE_TYPES = {
  acid: 'Corrosive liquid or digestive juice — burns flesh and eats through metal.',
  bludgeoning: 'Blunt-force trauma from maces, hammers, fists, falling rocks, and crushing jaws.',
  cold: 'Freezing temperatures — frost, ice, and winter magic.',
  fire: 'Burning heat — flame, magma, dragonbreath, and alchemical fire.',
  force: 'Pure magical energy. Rarely resisted; few creatures have defenses against it.',
  lightning: 'Electrical arcs — storm magic, charged rods, and certain dragonbreath.',
  necrotic: 'Withering life-drain — undead touch, curses, and death magic. Opposes healing.',
  piercing: 'Puncture wounds from arrows, spears, fangs, and stabbing weapons.',
  poison: 'Biological toxins — venoms, miasmas, and contact poisons.',
  psychic: 'Mental attack that bypasses body and armor — struck directly at the mind.',
  radiant: 'Searing holy light. Favored by celestials and clerics; painful to undead.',
  slashing: 'Cutting wounds from swords, axes, claws, and scythes.',
  thunder: 'Concussive sonic blast — shockwaves, thunder magic, and booming commands.'
};

// --- Weapon properties -----------------------------------------------------

export const WEAPON_PROPERTIES = {
  ammunition: 'Needs ammunition (arrows, bolts, bullets) to fire; a used piece can be recovered (about half survive).',
  finesse: 'You may use Dexterity instead of Strength for the attack and damage roll.',
  heavy: 'Small creatures have disadvantage on attack rolls with this weapon.',
  light: 'Can be used in the off-hand for two-weapon fighting.',
  loading: 'You can fire only one piece of ammunition when you Attack with it, regardless of how many attacks you normally get.',
  range: 'Can be used to attack targets at a distance (short / long range in feet).',
  reach: 'Adds 5 feet to your reach when you attack with it — 10 feet total from your square.',
  special: 'Has unusual rules (see weapon description — lance, net, etc.).',
  thrown: 'Can be thrown to make a ranged attack; uses the same ability score as the melee attack.',
  'two-handed': 'Requires two hands to use in combat.',
  versatile: 'Can be used with one or two hands; two-handed use deals the listed versatile damage.'
};

// --- Magic Initiate class options -----------------------------------------

export const MAGIC_INITIATE_CLASSES = {
  bard: 'Learn bard spells — charm, enchantment, and inspiration magic drawn from music and story.',
  cleric: 'Learn cleric spells — divine favor, healing, guidance, and the holy word of a chosen deity.',
  druid: 'Learn druid spells — nature, weather, beasts, and the primal forces of the wilderness.',
  sorcerer: 'Learn sorcerer spells — innate bursts of elemental and arcane force, shaped by bloodline.',
  warlock: 'Learn warlock spells — eldritch pacts, fey bargains, and cosmic horror drawn from a patron.',
  wizard: 'Learn wizard spells — methodical, studied magic of ritual, formula, and arcane scholarship.'
};

// Uses Charisma for bard/sorcerer/warlock, Wisdom for cleric/druid, Intelligence for wizard.
export const MAGIC_INITIATE_ABILITIES = {
  bard: 'cha',
  cleric: 'wis',
  druid: 'wis',
  sorcerer: 'cha',
  warlock: 'cha',
  wizard: 'int'
};

// --- Helpers ---------------------------------------------------------------

/** Normalize a key like "sleight of hand" → "sleight_of_hand" for SKILLS lookup. */
export function skillKey(raw) {
  return String(raw || '').toLowerCase().trim().replace(/['']/g, '').replace(/\s+/g, '_');
}

/** Return the 1-sentence description for a skill, tool, language, or damage type, or null. */
export function lookupReference(category, key) {
  switch (category) {
    case 'skill': {
      const entry = SKILLS[skillKey(key)];
      return entry ? entry.description : null;
    }
    case 'tool':
      return TOOLS[key] || null;
    case 'language':
      return LANGUAGES[key] || null;
    case 'damage':
      return DAMAGE_TYPES[String(key || '').toLowerCase()] || null;
    case 'property':
      return WEAPON_PROPERTIES[String(key || '').toLowerCase()] || null;
    default:
      return null;
  }
}

/**
 * Compact one-line stat label for a weapon — used in picker dropdowns.
 * e.g. "Longsword (1d8 slashing · versatile · 15 gp · 3 lb)"
 */
export function formatWeaponLine(w) {
  if (!w) return '';
  const parts = [];
  if (w.damage && w.damageType) parts.push(`${w.damage} ${w.damageType}`);
  if (w.versatileDamage) parts.push(`versatile ${w.versatileDamage}`);
  if (w.range) parts.push(`range ${w.range}`);
  const props = Array.isArray(w.properties) ? w.properties.filter(p => p !== 'versatile') : [];
  props.forEach(p => parts.push(p));
  if (w.cost) parts.push(w.cost);
  if (w.weight != null) parts.push(`${w.weight} lb`);
  return parts.join(' · ');
}

/** Compact one-line stat label for armor. */
export function formatArmorLine(a) {
  if (!a) return '';
  const parts = [];
  if (a.baseAC != null) {
    let acText = `AC ${a.baseAC}`;
    if (a.armorType === 'light') acText += ' + Dex';
    else if (a.armorType === 'medium') acText += ` + Dex (max ${a.maxDexBonus ?? 2})`;
    parts.push(acText);
  }
  if (a.acBonus != null) parts.push(`+${a.acBonus} AC (shield)`);
  if (a.armorType) parts.push(a.armorType);
  if (a.strReq) parts.push(`Str ${a.strReq}`);
  if (a.stealthDisadvantage) parts.push('stealth disadvantage');
  if (a.cost) parts.push(a.cost);
  if (a.weight != null) parts.push(`${a.weight} lb`);
  return parts.join(' · ');
}

/** Compact line for generic gear items (cost + weight). */
export function formatGearLine(g) {
  if (!g) return '';
  const parts = [];
  if (g.cost) parts.push(g.cost);
  if (g.weight != null) parts.push(typeof g.weight === 'string' ? g.weight : `${g.weight} lb`);
  return parts.join(' · ');
}
