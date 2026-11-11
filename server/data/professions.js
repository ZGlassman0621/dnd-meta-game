/**
 * professions.js — the profession catalog (DM System, designed 2026-10-21).
 *
 * An NPC's trade is their identity AND their mechanical competence. Each
 * entry: the skills the trade trains (2-4), the abilities it leans on
 * (1-2), the adventuring classes it can grow into at recruitment
 * (affinities), and whether it is adventuring stock (its NPCs also roll a
 * build archetype at first appearance).
 *
 * Vocabulary seeded from the 459 historic professions list (d20.pub),
 * trimmed to the trades a campaign actually meets. Occupations that miss
 * every entry fall back to a category signature, then to nothing (the
 * resolver's CR path) — never to an invented competence.
 *
 * Pure data + pure functions. No DB access here.
 */
import { roll } from '../utils/rng.js';

// ---------------------------------------------------------------------------
// Mastery tiers — rolled by the system at first appearance (25/50/20/5).
// The proficiency component of a trade-covered check. The full modifier is
// tier proficiency + 2 when the check's governing ability is one of the
// trade's dominant abilities, + 1 otherwise — the same ability+proficiency
// shape as a PC's math.
// ---------------------------------------------------------------------------
export const MASTERY_TIERS = ['apprentice', 'journeyman', 'master', 'legend'];
export const TIER_PROFICIENCY = { apprentice: 2, journeyman: 3, master: 4, legend: 6 };
export const TIER_LABEL = {
  apprentice: 'an apprentice',
  journeyman: 'a journeyman',
  master: 'a master',
  legend: 'a legend-grade master'
};

export function rollMasteryTier() {
  const { total } = roll(100, 1, { reason: 'npc mastery tier' });
  if (total <= 25) return 'apprentice';
  if (total <= 75) return 'journeyman';
  if (total <= 95) return 'master';
  return 'legend';
}

// ---------------------------------------------------------------------------
// GUP pools — Get Specific / Unique Aspect (the Purpose slot is the agenda
// system). One concrete sensory detail + one distinguishing aspect, rolled
// at first appearance. Deliberately profession-agnostic: the DM
// contextualizes them to the trade in narration.
// ---------------------------------------------------------------------------
export const GUP_SPECIFIC_POOL = [
  'Smells faintly of lavender oil and old paper.',
  'One boot is always immaculately polished; the other never is.',
  'A thin scar crosses the left eyebrow, old and pale.',
  'Hands stained dark at the fingertips, permanently.',
  'Speaks to animals in the same tone used for people.',
  'Keeps a small carved token on a cord, touches it when thinking.',
  'Laugh lines far deeper than their troubles would suggest.',
  'Missing the tip of one finger; never explains it.',
  'Hair worn in a style twenty years out of fashion.',
  'A voice that carries — audible through walls, through crowds.',
  'Eyes of two slightly different colors.',
  'Always slightly too warmly dressed for the weather.',
  'Chews a twig or a sliver of wood when concentrating.',
  'One ear noticeably lower than the other.',
  'Moves with the economy of someone who has done hard labor for decades.',
  'A wedding band worn on the wrong hand.'
];

export const GUP_UNIQUE_POOL = [
  'Never sits with their back to a door.',
  'Remembers the name of everyone they have ever been introduced to.',
  'Quotes proverbs from a homeland they never describe.',
  'Feeds strays before feeding themselves.',
  'Cannot abide a crooked picture, a loose thread, an uneven stack.',
  'Collects small debts of gratitude and never spends them carelessly.',
  'Hums while working — stops instantly when watched.',
  'Asks every traveler the same single question about the road.',
  'Keeps two sets of books in everything: the shown and the real.',
  'Treats children as full adults in conversation.',
  'Will not discuss business while eating.',
  'Counts coins by sound, not by sight.',
  'Always knows what day it is and how long until the next holy day.',
  'Repairs things for the poor without being asked, and never mentions it.',
  'Speaks of the local lord the way others speak of weather.',
  'Keeps a list — written or memorized — of everyone who owes them an apology.'
];

// ---------------------------------------------------------------------------
// Category fallback signatures — used when an NPC's occupation_category is
// known but the specific trade matches no catalog entry. Coverage is
// narrower than a real entry on purpose: a category is a hint, not a trade.
// ---------------------------------------------------------------------------
export const CATEGORY_SIGNATURES = {
  agriculture: { skills: ['Survival', 'Animal Handling'], abilities: ['wis'] },
  craft: { skills: ['Perception', 'Athletics'], abilities: ['str'] },
  trade: { skills: ['Persuasion', 'Insight'], abilities: ['cha'] },
  service: { skills: ['Perception', 'Insight'], abilities: ['wis'] },
  scholarly: { skills: ['Investigation', 'History'], abilities: ['int'] },
  religious: { skills: ['Religion', 'Insight'], abilities: ['wis'] },
  military: { skills: ['Athletics', 'Perception'], abilities: ['str'] },
  maritime: { skills: ['Athletics', 'Perception'], abilities: ['dex'] },
  arts: { skills: ['Performance', 'Persuasion'], abilities: ['cha'] },
  crime: { skills: ['Stealth', 'Deception'], abilities: ['dex'] },
  labor: { skills: ['Athletics'], abilities: ['str', 'con'] }
};

const CATEGORY_SYNONYMS = {
  merchant: 'trade', craftsman: 'craft', crafting: 'craft', farmer: 'agriculture',
  farming: 'agriculture', guard: 'military', soldier: 'military', clergy: 'religious',
  priest: 'religious', scholar: 'scholarly', academic: 'scholarly', sailor: 'maritime',
  performer: 'arts', entertainer: 'arts', criminal: 'crime', underworld: 'crime',
  worker: 'labor', domestic: 'service', hospitality: 'service'
};

export function categorySignature(occupationCategory) {
  if (!occupationCategory) return null;
  const raw = String(occupationCategory).toLowerCase().trim();
  const key = CATEGORY_SIGNATURES[raw] ? raw : CATEGORY_SYNONYMS[raw];
  if (!key) return null;
  return { key: `category:${key}`, name: key, category: key, ...CATEGORY_SIGNATURES[key], affinities: [], adventuring: false };
}

// ---------------------------------------------------------------------------
// The catalog. skills: canonical 5e skill names the trade trains.
// abilities: dominant ability keys. affinities: classes this trade can be
// recruited into (first = default). adventuring: NPCs of this trade are
// adventuring stock — they roll a build archetype at first appearance.
// ---------------------------------------------------------------------------
export const PROFESSIONS = [
  // Agriculture & the wilds
  { key: 'farmer', name: 'farmer', category: 'agriculture', skills: ['Survival', 'Animal Handling', 'Athletics', 'Nature'], abilities: ['wis', 'str'], affinities: [], adventuring: false },
  { key: 'shepherd', name: 'shepherd', category: 'agriculture', skills: ['Animal Handling', 'Perception', 'Survival'], abilities: ['wis'], affinities: [], adventuring: false },
  { key: 'hunter', name: 'hunter', category: 'agriculture', skills: ['Survival', 'Perception', 'Stealth', 'Nature'], abilities: ['dex', 'wis'], affinities: ['ranger'], adventuring: true },
  { key: 'trapper', name: 'trapper', category: 'agriculture', skills: ['Survival', 'Stealth', 'Nature'], abilities: ['dex', 'wis'], affinities: ['ranger'], adventuring: false },
  { key: 'fisher', name: 'fisher', category: 'agriculture', skills: ['Survival', 'Perception', 'Athletics'], abilities: ['wis', 'str'], affinities: [], adventuring: false },
  { key: 'lumberjack', name: 'lumberjack', category: 'agriculture', skills: ['Athletics', 'Survival'], abilities: ['str', 'con'], affinities: [], adventuring: false },
  { key: 'miner', name: 'miner', category: 'labor', skills: ['Athletics', 'Perception'], abilities: ['str', 'con'], affinities: [], adventuring: false },
  { key: 'beekeeper', name: 'beekeeper', category: 'agriculture', skills: ['Animal Handling', 'Nature'], abilities: ['wis'], affinities: [], adventuring: false },
  { key: 'falconer', name: 'falconer', category: 'agriculture', skills: ['Animal Handling', 'Perception'], abilities: ['wis', 'dex'], affinities: ['ranger'], adventuring: false },
  { key: 'groom', name: 'stablehand', category: 'agriculture', skills: ['Animal Handling', 'Perception'], abilities: ['wis'], affinities: [], adventuring: false },
  // Craft
  { key: 'blacksmith', name: 'blacksmith', category: 'craft', skills: ['Athletics', 'Perception', 'Investigation'], abilities: ['str', 'con'], affinities: [], adventuring: false },
  { key: 'armorer', name: 'armorer', category: 'craft', skills: ['Athletics', 'Investigation', 'Perception'], abilities: ['str', 'int'], affinities: [], adventuring: false },
  { key: 'weaponsmith', name: 'weaponsmith', category: 'craft', skills: ['Athletics', 'Investigation', 'Perception'], abilities: ['str', 'int'], affinities: [], adventuring: false },
  { key: 'carpenter', name: 'carpenter', category: 'craft', skills: ['Athletics', 'Perception'], abilities: ['str', 'dex'], affinities: [], adventuring: false },
  { key: 'mason', name: 'mason', category: 'craft', skills: ['Athletics', 'Perception'], abilities: ['str', 'con'], affinities: [], adventuring: false },
  { key: 'leatherworker', name: 'leatherworker', category: 'craft', skills: ['Sleight of Hand', 'Perception'], abilities: ['dex'], affinities: [], adventuring: false },
  { key: 'tailor', name: 'tailor', category: 'craft', skills: ['Sleight of Hand', 'Perception'], abilities: ['dex'], affinities: [], adventuring: false },
  { key: 'jeweler', name: 'jeweler', category: 'craft', skills: ['Investigation', 'Sleight of Hand', 'Perception'], abilities: ['dex', 'int'], affinities: [], adventuring: false },
  { key: 'locksmith', name: 'locksmith', category: 'craft', skills: ['Sleight of Hand', 'Investigation'], abilities: ['dex', 'int'], affinities: [], adventuring: false },
  { key: 'brewer', name: 'brewer', category: 'craft', skills: ['Nature', 'Persuasion'], abilities: ['con', 'wis'], affinities: [], adventuring: false },
  { key: 'cook', name: 'cook', category: 'service', skills: ['Perception', 'Survival', 'Nature'], abilities: ['wis'], affinities: [], adventuring: false },
  { key: 'potter', name: 'potter', category: 'craft', skills: ['Sleight of Hand', 'Perception'], abilities: ['dex', 'wis'], affinities: [], adventuring: false },
  { key: 'fletcher', name: 'fletcher', category: 'craft', skills: ['Perception', 'Survival'], abilities: ['dex'], affinities: [], adventuring: false },
  { key: 'alchemist', name: 'alchemist', category: 'scholarly', skills: ['Arcana', 'Medicine', 'Nature', 'Investigation'], abilities: ['int'], affinities: ['artificer', 'wizard'], adventuring: false },
  // Trade & service
  { key: 'merchant', name: 'merchant', category: 'trade', skills: ['Persuasion', 'Insight', 'Deception'], abilities: ['cha', 'int'], affinities: [], adventuring: false },
  { key: 'innkeeper', name: 'innkeeper', category: 'trade', skills: ['Persuasion', 'Insight', 'Perception'], abilities: ['cha', 'wis'], affinities: [], adventuring: false },
  { key: 'peddler', name: 'peddler', category: 'trade', skills: ['Persuasion', 'Deception', 'Perception'], abilities: ['cha'], affinities: [], adventuring: false },
  { key: 'moneylender', name: 'moneylender', category: 'trade', skills: ['Investigation', 'Intimidation', 'Insight'], abilities: ['int', 'cha'], affinities: [], adventuring: false },
  { key: 'appraiser', name: 'appraiser', category: 'trade', skills: ['Investigation', 'Perception'], abilities: ['int'], affinities: [], adventuring: false },
  { key: 'healer', name: 'healer', category: 'service', skills: ['Medicine', 'Nature', 'Survival'], abilities: ['wis', 'int'], affinities: ['cleric', 'druid'], adventuring: false },
  { key: 'physician', name: 'physician', category: 'service', skills: ['Medicine', 'Investigation', 'Insight'], abilities: ['int', 'wis'], affinities: [], adventuring: false },
  { key: 'courier', name: 'courier', category: 'service', skills: ['Athletics', 'Perception', 'Survival'], abilities: ['dex', 'con'], affinities: [], adventuring: false },
  { key: 'servant', name: 'servant', category: 'service', skills: ['Perception', 'Insight'], abilities: ['wis'], affinities: [], adventuring: false },
  { key: 'laborer', name: 'laborer', category: 'labor', skills: ['Athletics'], abilities: ['str', 'con'], affinities: [], adventuring: false },
  { key: 'town crier', name: 'town crier', category: 'service', skills: ['Performance', 'Persuasion'], abilities: ['cha'], affinities: [], adventuring: false },
  { key: 'tax collector', name: 'tax collector', category: 'trade', skills: ['Intimidation', 'Investigation', 'Insight'], abilities: ['cha', 'int'], affinities: [], adventuring: false },
  // Scholarly & religious
  { key: 'sage', name: 'sage', category: 'scholarly', skills: ['Arcana', 'History', 'Investigation'], abilities: ['int'], affinities: ['wizard'], adventuring: false },
  { key: 'scribe', name: 'scribe', category: 'scholarly', skills: ['History', 'Investigation'], abilities: ['int'], affinities: [], adventuring: false },
  { key: 'librarian', name: 'librarian', category: 'scholarly', skills: ['History', 'Investigation', 'Arcana'], abilities: ['int'], affinities: [], adventuring: false },
  { key: 'cartographer', name: 'cartographer', category: 'scholarly', skills: ['Investigation', 'Survival', 'Perception'], abilities: ['int', 'wis'], affinities: [], adventuring: false },
  { key: 'priest', name: 'priest', category: 'religious', skills: ['Religion', 'Insight', 'Persuasion'], abilities: ['wis', 'cha'], affinities: ['cleric'], adventuring: false },
  { key: 'acolyte', name: 'acolyte', category: 'religious', skills: ['Religion', 'Insight'], abilities: ['wis'], affinities: ['cleric'], adventuring: false },
  { key: 'undertaker', name: 'undertaker', category: 'religious', skills: ['Religion', 'Medicine'], abilities: ['wis'], affinities: [], adventuring: false },
  { key: 'hermit', name: 'hermit', category: 'religious', skills: ['Survival', 'Nature', 'Medicine', 'Religion'], abilities: ['wis'], affinities: ['druid'], adventuring: true },
  { key: 'monastic', name: 'monk', category: 'religious', skills: ['Religion', 'Insight', 'Acrobatics'], abilities: ['wis', 'dex'], affinities: ['monk'], adventuring: true },
  // Maritime & military
  { key: 'sailor', name: 'sailor', category: 'maritime', skills: ['Athletics', 'Perception', 'Acrobatics'], abilities: ['str', 'dex'], affinities: [], adventuring: false },
  { key: 'ship captain', name: 'ship captain', category: 'maritime', skills: ['Persuasion', 'Intimidation', 'Perception'], abilities: ['cha', 'wis'], affinities: [], adventuring: false },
  { key: 'guard', name: 'guard', category: 'military', skills: ['Athletics', 'Intimidation', 'Perception'], abilities: ['str', 'con'], affinities: ['fighter'], adventuring: false },
  { key: 'soldier', name: 'soldier', category: 'military', skills: ['Athletics', 'Intimidation', 'Survival'], abilities: ['str', 'con'], affinities: ['fighter'], adventuring: false },
  { key: 'knight', name: 'knight', category: 'military', skills: ['Athletics', 'Persuasion', 'Intimidation'], abilities: ['str', 'cha'], affinities: ['paladin', 'fighter'], adventuring: true },
  { key: 'sellsword', name: 'sellsword', category: 'military', skills: ['Athletics', 'Intimidation', 'Survival'], abilities: ['str', 'con'], affinities: ['fighter', 'barbarian'], adventuring: true },
  { key: 'bounty hunter', name: 'bounty hunter', category: 'military', skills: ['Survival', 'Perception', 'Investigation', 'Stealth'], abilities: ['dex', 'wis'], affinities: ['ranger', 'fighter'], adventuring: true },
  { key: 'gladiator', name: 'gladiator', category: 'arts', skills: ['Athletics', 'Acrobatics', 'Intimidation'], abilities: ['str', 'dex'], affinities: ['fighter', 'barbarian'], adventuring: true },
  // Arts
  { key: 'minstrel', name: 'minstrel', category: 'arts', skills: ['Performance', 'Persuasion', 'Acrobatics'], abilities: ['cha', 'dex'], affinities: ['bard'], adventuring: true },
  { key: 'actor', name: 'actor', category: 'arts', skills: ['Performance', 'Deception'], abilities: ['cha'], affinities: ['bard'], adventuring: false },
  // Adventuring stock & the underworld
  { key: 'hedge wizard', name: 'hedge wizard', category: 'scholarly', skills: ['Arcana', 'History', 'Medicine'], abilities: ['int'], affinities: ['wizard'], adventuring: true },
  { key: 'cultist', name: 'cultist', category: 'crime', skills: ['Religion', 'Deception', 'Arcana'], abilities: ['cha', 'wis'], affinities: ['warlock', 'cleric'], adventuring: true },
  { key: 'thief', name: 'thief', category: 'crime', skills: ['Stealth', 'Sleight of Hand', 'Acrobatics'], abilities: ['dex'], affinities: ['rogue'], adventuring: true },
  { key: 'assassin', name: 'assassin', category: 'crime', skills: ['Stealth', 'Deception', 'Sleight of Hand'], abilities: ['dex', 'int'], affinities: ['rogue'], adventuring: true },
  { key: 'smuggler', name: 'smuggler', category: 'crime', skills: ['Deception', 'Stealth', 'Perception'], abilities: ['dex', 'cha'], affinities: ['rogue'], adventuring: true },
  { key: 'tomb robber', name: 'tomb robber', category: 'crime', skills: ['Investigation', 'Sleight of Hand', 'Stealth', 'Perception'], abilities: ['dex', 'int'], affinities: ['rogue'], adventuring: true },
  { key: 'pathfinder', name: 'pathfinder', category: 'agriculture', skills: ['Survival', 'Perception', 'Athletics', 'Stealth'], abilities: ['wis', 'dex'], affinities: ['ranger'], adventuring: true },
  { key: 'beggar', name: 'beggar', category: 'service', skills: ['Deception', 'Insight', 'Perception'], abilities: ['cha', 'wis'], affinities: [], adventuring: false }
];

const BY_KEY = new Map(PROFESSIONS.map(p => [p.key, p]));

export function findProfessionByKey(key) {
  if (!key) return null;
  if (BY_KEY.has(key)) return BY_KEY.get(key);
  if (String(key).startsWith('category:')) {
    const cat = String(key).slice('category:'.length);
    return CATEGORY_SIGNATURES[cat]
      ? { key, name: cat, category: cat, ...CATEGORY_SIGNATURES[cat], affinities: [], adventuring: false }
      : null;
  }
  return null;
}

/**
 * Resolve an NPC's free-text occupation to a catalog entry: exact key/name
 * match, then substring match ("master blacksmith" → blacksmith), then the
 * occupation_category fallback signature. Null when nothing resolves — the
 * NPC simply has no system trade, and rolls fall through to the CR path.
 */
export function professionForOccupation(occupation, occupationCategory) {
  const text = String(occupation || '').toLowerCase().trim();
  if (text) {
    for (const p of PROFESSIONS) {
      if (text === p.key || text === p.name) return p;
    }
    for (const p of PROFESSIONS) {
      if (text.includes(p.key) || text.includes(p.name)) return p;
    }
  }
  return categorySignature(occupationCategory);
}

/**
 * The profession modifier for a check, or null when the trade doesn't
 * cover it. kind 'skill': checkName is the CANONICAL skill name and
 * skillAbilityMap maps it to its governing ability. kind 'ability':
 * checkName is the ability key. Trades never grant saving throws.
 */
export function professionCompetence(entry, tier, kind, checkName, skillAbilityMap = {}) {
  if (!entry || !checkName) return null;
  const prof = TIER_PROFICIENCY[tier] ?? TIER_PROFICIENCY.journeyman;
  if (kind === 'skill') {
    if (!entry.skills.includes(checkName)) return null;
    const governing = skillAbilityMap[checkName];
    return prof + (governing && entry.abilities.includes(governing) ? 2 : 1);
  }
  if (kind === 'ability') {
    return entry.abilities.includes(checkName) ? prof + 2 : null;
  }
  return null;
}

