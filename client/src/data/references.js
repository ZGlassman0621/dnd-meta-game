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

// repo-check-fixes-tools (2026-11-24): each tool is a structured entry —
// { description, ability, utilize: [{ action, dc }] } — from the 2024 PHB
// Tools entries (pp. 220–221, PM transcription of Zach's photos). `ability`
// is the Utilize action's ability; `utilize` lists every Utilize option with
// its own DC, in book order (a tool with two options stores both). The 17
// descriptions the repo check flagged are rewritten from the book's Utilize +
// Craft lines; the other 20 keep their text byte-for-byte. Gaming sets share
// the book's one Gaming Set entry; the 10 instruments share its one Musical
// Instrument entry. Nothing here resolves a check yet — the data is stored
// for a later job. Read a description with toolDescription(name).
export const TOOLS = {
  // Artisan's tools
  "Alchemist's Supplies": { description: 'Identify a substance or start a fire, and craft acid, alchemist\'s fire, a component pouch, oil, paper, or perfume.', ability: 'Intelligence', utilize: [{ action: 'Identify a substance', dc: 15 }, { action: 'Start a fire', dc: 15 }] },
  "Brewer's Supplies": { description: 'Detect a poisoned drink or identify alcohol, and craft antitoxin.', ability: 'Intelligence', utilize: [{ action: 'Detect poisoned drink', dc: 15 }, { action: 'Identify alcohol', dc: 10 }] },
  "Calligrapher's Supplies": { description: 'Write text with impressive flourishes that guard against forgery, and craft ink or a spell scroll.', ability: 'Dexterity', utilize: [{ action: 'Write text with impressive flourishes that guard against forgery', dc: 15 }] },
  "Carpenter's Tools": { description: 'Seal or pry open a door or container, and craft a club, greatclub, quarterstaff, barrel, chest, ladder, pole, portable ram, or torch.', ability: 'Strength', utilize: [{ action: 'Seal or pry open a door or container', dc: 20 }] },
  "Cartographer's Tools": { description: 'Draft a map of a small area, and craft maps.', ability: 'Wisdom', utilize: [{ action: 'Draft a map of a small area', dc: 15 }] },
  "Cobbler's Tools": { description: 'Modify footwear to give Advantage on the wearer\'s next Dexterity (Acrobatics) check, and craft a climber\'s kit.', ability: 'Dexterity', utilize: [{ action: 'Modify footwear to give Advantage on the wearer\'s next Dexterity (Acrobatics) check', dc: 10 }] },
  "Cook's Utensils": { description: 'Preparing meals — seasoning, preservation, identifying ingredients, and spotting tainted food.', ability: 'Wisdom', utilize: [{ action: 'Improve food\'s flavor', dc: 10 }, { action: 'Detect spoiled or poisoned food', dc: 15 }] },
  "Glassblower's Tools": { description: 'Discern what a glass object held in the past 24 hours, and craft a glass bottle, magnifying glass, spyglass, or vial.', ability: 'Intelligence', utilize: [{ action: 'Discern what a glass object held in the past 24 hours', dc: 15 }] },
  "Jeweler's Tools": { description: 'Discern a gem\'s value, and craft an arcane focus or a holy symbol.', ability: 'Intelligence', utilize: [{ action: 'Discern a gem\'s value', dc: 15 }] },
  "Leatherworker's Tools": { description: 'Add a design to a leather item, and craft a sling, whip, hide armor, leather armor, studded leather armor, backpack, crossbow bolt case, map or scroll case, parchment, pouch, quiver, or waterskin.', ability: 'Dexterity', utilize: [{ action: 'Add a design to a leather item', dc: 10 }] },
  "Mason's Tools": { description: 'Chisel a symbol or hole in stone, and craft a block and tackle.', ability: 'Strength', utilize: [{ action: 'Chisel a symbol or hole in stone', dc: 10 }] },
  "Painter's Supplies": { description: 'Paint a recognizable image of something you\'ve seen, and craft a druidic focus or a holy symbol.', ability: 'Wisdom', utilize: [{ action: 'Paint a recognizable image of something you\'ve seen', dc: 10 }] },
  "Potter's Tools": { description: 'Discern what a ceramic object held in the past 24 hours, and craft a jug or a lamp.', ability: 'Intelligence', utilize: [{ action: 'Discern what a ceramic object held in the past 24 hours', dc: 15 }] },
  "Smith's Tools": { description: 'Pry open a door or container, and craft any melee weapon except a club, greatclub, quarterstaff, or whip, medium armor except hide, heavy armor, ball bearings, a bucket, caltrops, a chain, a crowbar, firearm bullets, a grappling hook, an iron pot, iron spikes, or sling bullets.', ability: 'Strength', utilize: [{ action: 'Pry open a door or container', dc: 20 }] },
  "Tinker's Tools": { description: 'Assemble a Tiny item composed of scrap, which falls apart in 1 minute, and craft a musket, pistol, bell, bullseye lantern, flask, hooded lantern, hunting trap, lock, manacles, mirror, shovel, signal whistle, or tinderbox.', ability: 'Dexterity', utilize: [{ action: 'Assemble a Tiny item composed of scrap, which falls apart in 1 minute', dc: 20 }] },
  "Weaver's Tools": { description: 'Mend a tear in clothing or sew a Tiny design, and craft padded armor, a basket, bedroll, blanket, fine clothes, net, robe, rope, sack, string, tent, or traveler\'s clothes.', ability: 'Dexterity', utilize: [{ action: 'Mend a tear in clothing', dc: 10 }, { action: 'Sew a Tiny design', dc: 10 }] },
  "Woodcarver's Tools": { description: 'Carve a pattern in wood, and craft a club, greatclub, quarterstaff, ranged weapon (except a pistol, musket, or sling), arcane focus, arrows, bolts, druidic focus, ink pen, or needles.', ability: 'Dexterity', utilize: [{ action: 'Carve a pattern in wood', dc: 10 }] },

  // Gaming sets (one book entry, Gaming Set, covers all four)
  "Dice Set": { description: 'Discern whether someone is cheating at dice, or win the game.', ability: 'Wisdom', utilize: [{ action: 'Discern whether someone is cheating', dc: 10 }, { action: 'Win the game', dc: 20 }] },
  "Dragonchess Set": { description: 'Playing dragonchess — a three-tiered strategy game enjoyed in urbane or scholarly circles.', ability: 'Wisdom', utilize: [{ action: 'Discern whether someone is cheating', dc: 10 }, { action: 'Win the game', dc: 20 }] },
  "Playing Card Set": { description: 'Playing card games of chance and skill. Useful for wagering in taverns or reading a player\'s tell.', ability: 'Wisdom', utilize: [{ action: 'Discern whether someone is cheating', dc: 10 }, { action: 'Win the game', dc: 20 }] },
  "Three-Dragon Ante Set": { description: 'Playing the gambling card game favored across the Realms. A common tavern pastime.', ability: 'Wisdom', utilize: [{ action: 'Discern whether someone is cheating', dc: 10 }, { action: 'Win the game', dc: 20 }] },

  // Kits & specialty
  "Disguise Kit": { description: 'Changing appearance — cosmetics, hair dye, prosthetics, and costume pieces to impersonate another.', ability: 'Charisma', utilize: [{ action: 'Apply makeup', dc: 10 }] },
  "Forgery Kit": { description: 'Producing false documents — seals, parchment, inks, and scripts to fool an untrained inspector.', ability: 'Dexterity', utilize: [{ action: 'Mimic 10 or fewer words of someone else\'s handwriting', dc: 15 }, { action: 'Duplicate a wax seal', dc: 20 }] },
  "Herbalism Kit": { description: 'Identifying plants, brewing antitoxins, and crafting healing potions from natural ingredients.', ability: 'Intelligence', utilize: [{ action: 'Identify a plant', dc: 10 }] },
  "Navigator's Tools": { description: 'Charting courses, reading maps, and fixing position at sea by sextant and stars.', ability: 'Wisdom', utilize: [{ action: 'Plot a course', dc: 10 }, { action: 'Determine position by stargazing', dc: 15 }] },
  "Poisoner's Kit": { description: 'Crafting poisons, applying them to weapons, and identifying poisons in food or drink.', ability: 'Intelligence', utilize: [{ action: 'Detect a poisoned object', dc: 10 }] },
  "Thieves' Tools": { description: 'Picking locks, disabling traps, and performing subtle mechanical tampering. Required proficiency for most locks.', ability: 'Dexterity', utilize: [{ action: 'Pick a lock', dc: 15 }, { action: 'Disarm a trap', dc: 15 }] },

  // Instruments (one book entry, Musical Instrument, covers all ten)
  "Bagpipes": { description: 'A drone-and-chanter instrument associated with highland and military traditions.', ability: 'Charisma', utilize: [{ action: 'Play a known tune', dc: 10 }, { action: 'Improvise a song', dc: 15 }] },
  "Drum": { description: 'Percussion for tavern songs, martial cadences, and tribal dance.', ability: 'Charisma', utilize: [{ action: 'Play a known tune', dc: 10 }, { action: 'Improvise a song', dc: 15 }] },
  "Dulcimer": { description: 'A hammered stringed instrument producing shimmering, layered tones.', ability: 'Charisma', utilize: [{ action: 'Play a known tune', dc: 10 }, { action: 'Improvise a song', dc: 15 }] },
  "Flute": { description: 'A transverse woodwind — bright, airy, good for carrying across crowds.', ability: 'Charisma', utilize: [{ action: 'Play a known tune', dc: 10 }, { action: 'Improvise a song', dc: 15 }] },
  "Lute": { description: 'The classic bard\'s plucked string instrument. Portable, expressive, and suited to song.', ability: 'Charisma', utilize: [{ action: 'Play a known tune', dc: 10 }, { action: 'Improvise a song', dc: 15 }] },
  "Lyre": { description: 'An ancient plucked string instrument associated with poetry, scholarship, and classical music.', ability: 'Charisma', utilize: [{ action: 'Play a known tune', dc: 10 }, { action: 'Improvise a song', dc: 15 }] },
  "Horn": { description: 'Brass signaling instrument — hunt calls, warnings, and ceremonial fanfare.', ability: 'Charisma', utilize: [{ action: 'Play a known tune', dc: 10 }, { action: 'Improvise a song', dc: 15 }] },
  "Pan Flute": { description: 'A set of pitched pipes played by blowing across them. Pastoral and woodland in character.', ability: 'Charisma', utilize: [{ action: 'Play a known tune', dc: 10 }, { action: 'Improvise a song', dc: 15 }] },
  "Shawm": { description: 'A piercing double-reed woodwind, ancestor of the oboe. Loud, formal, and festival-appropriate.', ability: 'Charisma', utilize: [{ action: 'Play a known tune', dc: 10 }, { action: 'Improvise a song', dc: 15 }] },
  "Viol": { description: 'A bowed string instrument with a mellow, melancholy tone.', ability: 'Charisma', utilize: [{ action: 'Play a known tune', dc: 10 }, { action: 'Improvise a song', dc: 15 }] }
};

/** A tool's one-sentence description, or null (TOOLS entries are structured). */
export function toolDescription(name) {
  const t = TOOLS[name];
  return t && typeof t === 'object' ? (t.description || null) : (typeof t === 'string' ? t : null);
}

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

/**
 * Species language grants carry a choice as a placeholder string
 * ("One extra language of your choice" — human, half-elf), not a
 * language: the picker on Stage 1 resolves it, and the derived
 * Stage 4 list must never carry the placeholder as if it were a
 * language. These three helpers are the one place that knows the
 * placeholder shape, so Stage 1 and Stage 4 cannot drift apart.
 */
const CHOICE_LANGUAGE_RE = /of your choice/i;

/** True when a language-grant string is a choice placeholder, not a language. */
export function isChoiceLanguage(value) {
  return CHOICE_LANGUAGE_RE.test(String(value || ''));
}

/** The granted languages minus any "of your choice" placeholders. */
export function concreteLanguages(languages) {
  return (languages || []).filter(l => !isChoiceLanguage(l));
}

/** How many "one extra language of your choice" slots a grant promises. */
export function languageChoiceCount(languages) {
  return (languages || []).filter(l => isChoiceLanguage(l)).length;
}

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
      return toolDescription(key);
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
