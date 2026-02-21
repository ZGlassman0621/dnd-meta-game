import express from 'express';
import { dbAll, dbGet, dbRun } from '../database.js';
import { handleServerError } from '../utils/errorHandler.js';

const router = express.Router();

// Downtime activity definitions
const ACTIVITIES = {
  rest: {
    name: 'Rest & Sleep',
    description: 'Take a short rest or long rest to recover',
    maxHours: 10,
    icon: '😴',
    benefits: {
      base: 'Short Rest (1h) or Long Rest (8h)',
      perHour: 'Uses D&D rest mechanics'
    },
    requirements: null, // Can rest anywhere
    hasRestTypes: true // Flag to show rest type selection
  },
  pray: {
    name: 'Pray & Meditate',
    description: 'Connect with your deity or find inner peace',
    maxHours: 6,
    icon: '🙏',
    benefits: {
      base: 'Spiritual renewal',
      perHour: 'Small chance of divine favor per hour'
    },
    requirements: null // Can pray anywhere
  },
  train: {
    name: 'Train & Practice',
    description: 'Hone your combat skills or practice abilities',
    maxHours: 10,
    icon: '⚔️',
    benefits: {
      base: 'Improve your abilities',
      perHour: 'Gain training points toward skill improvement'
    },
    requirements: null // Can train anywhere with space
  },
  study: {
    name: 'Study & Read',
    description: 'Learn from books, scrolls, or research',
    maxHours: 10,
    icon: '📚',
    benefits: {
      base: 'Gain knowledge',
      perHour: 'Learn lore, languages, or arcane secrets'
    },
    requirements: { hasBooks: true } // Needs reading material
  },
  craft: {
    name: 'Craft & Create',
    description: 'Use your tools to create or repair items',
    maxHours: 8,
    icon: '🔨',
    benefits: {
      base: 'Create or repair items',
      perHour: 'Progress on crafting projects'
    },
    requirements: { hasTools: true } // Needs appropriate tools
  },
  work: {
    name: 'Work for Hire',
    description: 'Earn gold through honest labor',
    maxHours: 8,
    icon: '💰',
    benefits: {
      base: 'Earn wages',
      perHour: 'Earn gold based on skills'
    },
    requirements: { inSettlement: true } // Must be in a town/city
  },
  socialize: {
    name: 'Socialize',
    description: 'Meet people, gather information, build relationships',
    maxHours: null, // No limit
    icon: '🗣️',
    benefits: {
      base: 'Make connections',
      perHour: 'Gather rumors, make contacts'
    },
    requirements: { hasCompany: true } // Must be around other people
  },
  carouse: {
    name: 'Carouse',
    description: 'Drink, gamble, and make merry at the tavern',
    maxHours: 4,
    icon: '🍺',
    benefits: {
      base: 'Have fun (with consequences)',
      perHour: 'Random events - good and bad'
    },
    requirements: { inTavern: true } // Must be in a tavern
  },
  maintain: {
    name: 'Maintain Equipment',
    description: 'Clean, oil, and repair your weapons and armor',
    maxHours: 4,
    icon: '🛠️',
    benefits: {
      base: 'Keep your gear in working order',
      perHour: 'Prevent degradation and ensure reliability'
    },
    requirements: null, // Can maintain anywhere with basic supplies
    allowedHours: [2, 4] // Only allow 2 or 4 hour sessions
  }
};

// Class-based work options with pay rates (base GP per hour, scales with level)
// Formula: baseRate * (1 + (level - 1) * 0.15) - so level 10 = 2.35x base rate
const CLASS_WORK_OPTIONS = {
  // Cleric work options
  cleric: [
    { id: 'heal_wounded', name: 'Heal the Wounded', icon: '💚', description: 'Offer healing services at a temple or infirmary', baseRate: 1.5, requirements: { inSettlement: true } },
    { id: 'temple_service', name: 'Temple Service', icon: '⛪', description: 'Lead prayers, perform rites, and counsel the faithful', baseRate: 1.0, requirements: { inSettlement: true } },
    { id: 'preach', name: 'Preach & Proselytize', icon: '📖', description: 'Spread the word of your deity in public', baseRate: 0.5, requirements: { inSettlement: true }, xpBonus: 2 },
    { id: 'bless_goods', name: 'Bless Goods & Homes', icon: '✨', description: 'Provide blessings for merchants, farmers, and families', baseRate: 0.75, requirements: { inSettlement: true } },
    { id: 'teach_healing', name: 'Teach Healing Arts', icon: '🏥', description: 'Instruct others in basic medicine and first aid', baseRate: 1.25, requirements: { inSettlement: true }, xpBonus: 3 },
    { id: 'herb_gathering', name: 'Gather Medicinal Herbs', icon: '🌿', description: 'Collect herbs for healing poultices and remedies', baseRate: 0.5, requirements: { inWilderness: true } }
  ],

  // Paladin work options
  paladin: [
    { id: 'guard_duty', name: 'Guard Duty', icon: '🛡️', description: 'Protect a merchant, noble, or establishment', baseRate: 1.5, requirements: { inSettlement: true } },
    { id: 'train_militia', name: 'Train Local Militia', icon: '⚔️', description: 'Teach combat basics to town guards or volunteers', baseRate: 1.25, requirements: { inSettlement: true }, xpBonus: 3 },
    { id: 'temple_service', name: 'Temple Service', icon: '⛪', description: 'Serve at a temple of your order', baseRate: 1.0, requirements: { inSettlement: true } },
    { id: 'escort_duty', name: 'Escort Travelers', icon: '🚶', description: 'Protect travelers on dangerous roads', baseRate: 1.75, requirements: { inSettlement: true } },
    { id: 'judge_disputes', name: 'Mediate Disputes', icon: '⚖️', description: 'Help settle conflicts with wisdom and fairness', baseRate: 1.0, requirements: { inSettlement: true }, xpBonus: 2 }
  ],

  // Fighter work options
  fighter: [
    { id: 'guard_duty', name: 'Guard Duty', icon: '🛡️', description: 'Work as a hired guard or bouncer', baseRate: 1.25, requirements: { inSettlement: true } },
    { id: 'train_others', name: 'Combat Training', icon: '⚔️', description: 'Teach weapon skills to paying students', baseRate: 1.5, requirements: { inSettlement: true }, xpBonus: 2 },
    { id: 'arena_fight', name: 'Arena Fighting', icon: '🏟️', description: 'Compete in exhibition matches for coin', baseRate: 2.0, requirements: { inSettlement: true }, riskLevel: 'medium' },
    { id: 'escort_duty', name: 'Caravan Guard', icon: '🐴', description: 'Protect merchant caravans', baseRate: 1.5, requirements: { inSettlement: true } },
    { id: 'bounty_hunting', name: 'Bounty Board Work', icon: '📜', description: 'Take small bounties from the local board', baseRate: 1.75, requirements: { inSettlement: true }, riskLevel: 'low' }
  ],

  // Rogue work options
  rogue: [
    { id: 'locksmith', name: 'Locksmith Services', icon: '🔐', description: 'Help people who locked themselves out (legally)', baseRate: 1.5, requirements: { inSettlement: true } },
    { id: 'scout_work', name: 'Scout & Spy', icon: '👁️', description: 'Gather information for merchants or nobles', baseRate: 1.75, requirements: { inSettlement: true } },
    { id: 'street_perform', name: 'Street Performance', icon: '🎭', description: 'Entertain crowds with sleight of hand', baseRate: 0.75, requirements: { inSettlement: true } },
    { id: 'courier', name: 'Discreet Courier', icon: '📨', description: 'Deliver sensitive packages quickly and quietly', baseRate: 1.25, requirements: { inSettlement: true } },
    { id: 'trap_finding', name: 'Security Consultant', icon: '⚠️', description: 'Test and improve security for wealthy clients', baseRate: 2.0, requirements: { inSettlement: true } },
    { id: 'gambling', name: 'Professional Gambling', icon: '🎲', description: 'Test your luck at cards and dice', baseRate: 0, requirements: { inTavern: true }, special: 'gambling' }
  ],

  // Wizard work options
  wizard: [
    { id: 'identify_items', name: 'Identify Magic Items', icon: '🔮', description: 'Use your knowledge to identify enchantments', baseRate: 2.0, requirements: { inSettlement: true } },
    { id: 'scribe_scrolls', name: 'Scribe Scrolls', icon: '📜', description: 'Copy spells and documents for clients', baseRate: 1.5, requirements: { inSettlement: true } },
    { id: 'tutor', name: 'Arcane Tutoring', icon: '📚', description: 'Teach magical theory to aspiring students', baseRate: 1.75, requirements: { inSettlement: true }, xpBonus: 3 },
    { id: 'consult', name: 'Magical Consultation', icon: '🧙', description: 'Advise on magical matters and phenomena', baseRate: 1.5, requirements: { inSettlement: true } },
    { id: 'research_assist', name: 'Research Assistant', icon: '🔬', description: 'Help with magical research at academies', baseRate: 1.25, requirements: { inSettlement: true }, xpBonus: 4 }
  ],

  // Sorcerer work options
  sorcerer: [
    { id: 'fortune_telling', name: 'Fortune Telling', icon: '🔮', description: 'Read fortunes and offer mystical guidance', baseRate: 1.0, requirements: { inSettlement: true } },
    { id: 'entertainment', name: 'Magical Entertainment', icon: '✨', description: 'Dazzle crowds with magical displays', baseRate: 1.25, requirements: { inSettlement: true } },
    { id: 'detect_magic', name: 'Magic Detection', icon: '👁️', description: 'Scan items and locations for magical auras', baseRate: 1.75, requirements: { inSettlement: true } },
    { id: 'minor_enchant', name: 'Minor Enchantments', icon: '💫', description: 'Provide small magical services', baseRate: 1.5, requirements: { inSettlement: true } }
  ],

  // Warlock work options
  warlock: [
    { id: 'fortune_telling', name: 'Occult Readings', icon: '🔮', description: 'Offer mysterious insights from beyond', baseRate: 1.25, requirements: { inSettlement: true } },
    { id: 'spirit_medium', name: 'Spirit Medium', icon: '👻', description: 'Help the living contact the departed', baseRate: 1.5, requirements: { inSettlement: true } },
    { id: 'curse_breaking', name: 'Curse Consultation', icon: '🌙', description: 'Advise on curses and dark magic', baseRate: 2.0, requirements: { inSettlement: true } },
    { id: 'eldritch_guard', name: 'Supernatural Guard', icon: '🛡️', description: 'Protect against otherworldly threats', baseRate: 1.75, requirements: { inSettlement: true } }
  ],

  // Bard work options
  bard: [
    { id: 'tavern_perform', name: 'Tavern Performance', icon: '🎵', description: 'Sing, play, and tell tales for tips', baseRate: 1.0, requirements: { inTavern: true } },
    { id: 'private_event', name: 'Private Entertainment', icon: '🎭', description: 'Perform at parties and noble gatherings', baseRate: 2.0, requirements: { inSettlement: true } },
    { id: 'teach_music', name: 'Music Lessons', icon: '🎶', description: 'Teach instruments or singing', baseRate: 1.25, requirements: { inSettlement: true }, xpBonus: 2 },
    { id: 'town_crier', name: 'Town Crier', icon: '📢', description: 'Announce news and proclamations', baseRate: 0.75, requirements: { inSettlement: true } },
    { id: 'write_songs', name: 'Commission Songs', icon: '✍️', description: 'Write custom songs or poems for patrons', baseRate: 1.5, requirements: { inSettlement: true } },
    { id: 'gather_stories', name: 'Gather Local Tales', icon: '📖', description: 'Collect stories and legends', baseRate: 0.5, requirements: { inSettlement: true }, xpBonus: 4 }
  ],

  // Ranger work options
  ranger: [
    { id: 'guide', name: 'Wilderness Guide', icon: '🧭', description: 'Lead travelers safely through dangerous terrain', baseRate: 1.5, requirements: { inSettlement: true } },
    { id: 'hunt', name: 'Hunt Game', icon: '🏹', description: 'Hunt animals for meat and pelts', baseRate: 1.25, requirements: { inWilderness: true } },
    { id: 'track', name: 'Tracking Services', icon: '👣', description: 'Find lost people, animals, or items', baseRate: 1.75, requirements: { inSettlement: true } },
    { id: 'pest_control', name: 'Monster Pest Control', icon: '🐺', description: 'Clear out dangerous creatures near settlements', baseRate: 2.0, requirements: { inSettlement: true }, riskLevel: 'low' },
    { id: 'herb_gathering', name: 'Forage & Gather', icon: '🌿', description: 'Collect herbs, berries, and useful plants', baseRate: 0.75, requirements: { inWilderness: true } }
  ],

  // Druid work options
  druid: [
    { id: 'animal_healing', name: 'Heal Animals', icon: '🐾', description: 'Treat sick and injured animals', baseRate: 1.25, requirements: { inSettlement: true } },
    { id: 'crop_blessing', name: 'Bless Crops', icon: '🌾', description: 'Help farmers with growth and weather', baseRate: 1.0, requirements: { inSettlement: true } },
    { id: 'nature_guide', name: 'Nature Guide', icon: '🌲', description: 'Lead nature walks and teach about plants', baseRate: 1.0, requirements: { inSettlement: true }, xpBonus: 2 },
    { id: 'weather_predict', name: 'Weather Prediction', icon: '🌤️', description: 'Advise on weather patterns for farmers and sailors', baseRate: 1.5, requirements: { inSettlement: true } },
    { id: 'herb_gathering', name: 'Gather Components', icon: '🌿', description: 'Collect rare plants and natural materials', baseRate: 1.0, requirements: { inWilderness: true } }
  ],

  // Monk work options
  monk: [
    { id: 'teach_martial', name: 'Teach Martial Arts', icon: '🥋', description: 'Instruct students in combat techniques', baseRate: 1.5, requirements: { inSettlement: true }, xpBonus: 3 },
    { id: 'meditation_guide', name: 'Meditation Guide', icon: '🧘', description: 'Lead meditation and mindfulness sessions', baseRate: 1.0, requirements: { inSettlement: true }, xpBonus: 2 },
    { id: 'monastery_work', name: 'Monastery Labor', icon: '⛩️', description: 'Work at a local monastery', baseRate: 0.5, requirements: { inSettlement: true }, xpBonus: 4 },
    { id: 'courier', name: 'Swift Courier', icon: '📨', description: 'Deliver messages with speed and discretion', baseRate: 1.25, requirements: { inSettlement: true } },
    { id: 'bodyguard', name: 'Personal Bodyguard', icon: '🛡️', description: 'Protect a client with your martial prowess', baseRate: 1.75, requirements: { inSettlement: true } }
  ],

  // Barbarian work options
  barbarian: [
    { id: 'heavy_labor', name: 'Heavy Labor', icon: '💪', description: 'Move cargo, clear land, or demolish buildings', baseRate: 1.0, requirements: { inSettlement: true } },
    { id: 'bouncer', name: 'Tavern Bouncer', icon: '🚪', description: 'Keep the peace at rough establishments', baseRate: 1.25, requirements: { inTavern: true } },
    { id: 'arena_fight', name: 'Pit Fighting', icon: '🏟️', description: 'Fight in underground matches', baseRate: 2.25, requirements: { inSettlement: true }, riskLevel: 'medium' },
    { id: 'intimidation', name: 'Debt Collection', icon: '😠', description: 'Help merchants collect difficult debts', baseRate: 1.5, requirements: { inSettlement: true } },
    { id: 'hunt', name: 'Big Game Hunt', icon: '🐗', description: 'Hunt dangerous beasts', baseRate: 1.75, requirements: { inWilderness: true }, riskLevel: 'low' }
  ],

  // Artificer work options
  artificer: [
    { id: 'repair', name: 'Repair Services', icon: '🔧', description: 'Fix broken equipment and mechanisms', baseRate: 1.5, requirements: { inSettlement: true } },
    { id: 'craft_items', name: 'Craft Goods', icon: '⚙️', description: 'Create useful items and tools', baseRate: 1.75, requirements: { inSettlement: true } },
    { id: 'magic_tinker', name: 'Magic Item Repair', icon: '✨', description: 'Repair and maintain magical items', baseRate: 2.25, requirements: { inSettlement: true } },
    { id: 'consult', name: 'Technical Consultation', icon: '📋', description: 'Advise on engineering and construction', baseRate: 1.5, requirements: { inSettlement: true } },
    { id: 'teach', name: 'Teach Crafting', icon: '📚', description: 'Instruct apprentices in your craft', baseRate: 1.25, requirements: { inSettlement: true }, xpBonus: 3 }
  ]
};

// Default work options for classes not specifically defined
const DEFAULT_WORK_OPTIONS = [
  { id: 'manual_labor', name: 'Manual Labor', icon: '🏗️', description: 'Basic physical work', baseRate: 0.5, requirements: { inSettlement: true } },
  { id: 'odd_jobs', name: 'Odd Jobs', icon: '📋', description: 'Various small tasks around town', baseRate: 0.4, requirements: { inSettlement: true } }
];

// Location context keywords for determining available activities
const LOCATION_CONTEXTS = {
  settlement: ['city', 'town', 'village', 'hamlet', 'settlement', 'waterdeep', 'neverwinter', 'baldur', 'daggerford', 'phandalin', 'triboar', 'longsaddle', 'mirabar', 'luskan', 'icewind', 'port', 'market'],
  tavern: ['tavern', 'inn', 'bar', 'pub', 'alehouse', 'yawning portal', 'sleeping', 'resting', 'common room'],
  wilderness: ['forest', 'woods', 'mountain', 'cave', 'dungeon', 'road', 'trail', 'camp', 'wilderness', 'wild', 'outside'],
  temple: ['temple', 'church', 'shrine', 'monastery', 'cathedral', 'chapel'],
  library: ['library', 'archive', 'study', 'tower', 'academy', 'school', 'wizard']
};

// Rest types - Short Rest and Long Rest following D&D 5e mechanics
const REST_TYPES = {
  short: {
    id: 'short',
    name: 'Short Rest',
    icon: '⏰',
    duration: 1, // 1 hour
    description: 'A period of at least 1 hour during which you do nothing more strenuous than eating, drinking, reading, and tending to wounds.',
    benefits: {
      hitDice: true, // Can spend Hit Dice to recover HP
      hpPercent: 0, // No automatic HP recovery
      abilities: 'short_rest' // Some class abilities recharge
    }
  },
  long: {
    id: 'long',
    name: 'Long Rest',
    icon: '🌙',
    duration: 8, // 8 hours
    description: 'A period of extended rest, at least 8 hours long, during which you sleep for at least 6 hours and perform no more than 2 hours of light activity.',
    benefits: {
      hitDice: false, // Regain half your Hit Dice (handled separately)
      hpPercent: 100, // Recover all HP
      abilities: 'long_rest' // Most abilities recharge
    }
  }
};

// Rest quality modifiers based on conditions
// Quality levels affect the effectiveness of rest
// 'luxurious' (bonus effects), 'comfortable' (full benefits), 'adequate' (full benefits),
// 'poor' (reduced benefits), 'terrible' (may not complete rest, may take damage)
const REST_CONDITIONS = {
  // Luxurious conditions (best rooms, perfect environment)
  luxurious: ['suite', 'mansion', 'palace', 'estate', 'noble', 'luxury', 'finest', 'best room', 'private quarters'],
  // Comfortable conditions (good inn, nice home)
  comfortable: ['comfortable', 'private room', 'warm', 'cozy', 'home', 'house', 'residence', 'apartment', 'quarters'],
  // Adequate conditions (basic inn, common room)
  adequate: ['inn', 'tavern', 'common room', 'barracks', 'dormitory', 'hostel', 'shelter'],
  // Poor conditions (rough camping, bad weather, dangerous areas)
  poor: ['camp', 'camping', 'tent', 'bedroll', 'outdoor', 'outside', 'road', 'trail', 'rain', 'cold', 'storm'],
  // Terrible conditions (dangerous/hostile environments)
  terrible: ['underdark', 'dungeon', 'cave', 'swamp', 'blizzard', 'frozen', 'haunted', 'cursed', 'dangerous', 'hostile', 'sewers', 'crypt', 'tomb', 'ruins']
};

// Determine location context from character's current location
function analyzeLocation(locationString) {
  if (!locationString) return {
    inSettlement: false,
    inTavern: false,
    inWilderness: true,
    hasCompany: false,
    restQuality: 'poor',
    restMultiplier: 0.5,
    restDescription: 'Unknown location - rest may be difficult'
  };

  const loc = locationString.toLowerCase();

  const inSettlement = LOCATION_CONTEXTS.settlement.some(kw => loc.includes(kw));
  const inTavern = LOCATION_CONTEXTS.tavern.some(kw => loc.includes(kw));
  const inWilderness = LOCATION_CONTEXTS.wilderness.some(kw => loc.includes(kw)) && !inSettlement;
  const inTemple = LOCATION_CONTEXTS.temple.some(kw => loc.includes(kw));
  const inLibrary = LOCATION_CONTEXTS.library.some(kw => loc.includes(kw));

  // Has company if in settlement or tavern (not alone in wilderness)
  const hasCompany = inSettlement || inTavern;

  // Determine rest quality based on location
  const restInfo = analyzeRestConditions(loc, inSettlement, inTavern, inWilderness, inTemple);

  return {
    inSettlement,
    inTavern,
    inWilderness,
    inTemple,
    inLibrary,
    hasCompany,
    ...restInfo
  };
}

// Analyze rest conditions from location string
function analyzeRestConditions(loc, inSettlement, inTavern, inWilderness, inTemple) {
  // Check for terrible conditions first (most specific/dangerous)
  if (REST_CONDITIONS.terrible.some(kw => loc.includes(kw))) {
    return {
      restQuality: 'terrible',
      restMultiplier: 0.25,
      restDescription: 'Hostile environment - rest will be difficult and potentially harmful'
    };
  }

  // Check for luxurious conditions
  if (REST_CONDITIONS.luxurious.some(kw => loc.includes(kw))) {
    return {
      restQuality: 'luxurious',
      restMultiplier: 1.5,
      restDescription: 'Luxurious accommodations - you will rest exceptionally well'
    };
  }

  // Check for comfortable conditions
  if (REST_CONDITIONS.comfortable.some(kw => loc.includes(kw))) {
    return {
      restQuality: 'comfortable',
      restMultiplier: 1.25,
      restDescription: 'Comfortable surroundings - a good night\'s rest awaits'
    };
  }

  // In a temple - generally peaceful rest
  if (inTemple) {
    return {
      restQuality: 'comfortable',
      restMultiplier: 1.25,
      restDescription: 'Sacred ground - rest peacefully under divine protection'
    };
  }

  // Check for adequate conditions (standard inn/tavern)
  if (inTavern || REST_CONDITIONS.adequate.some(kw => loc.includes(kw))) {
    return {
      restQuality: 'adequate',
      restMultiplier: 1.0,
      restDescription: 'Basic accommodations - you can rest adequately'
    };
  }

  // In settlement but no specific lodging mentioned - assume adequate
  if (inSettlement) {
    return {
      restQuality: 'adequate',
      restMultiplier: 1.0,
      restDescription: 'In town - basic rest available'
    };
  }

  // Check for poor conditions (camping, weather)
  if (inWilderness || REST_CONDITIONS.poor.some(kw => loc.includes(kw))) {
    return {
      restQuality: 'poor',
      restMultiplier: 0.5,
      restDescription: 'Rough conditions - rest will be limited'
    };
  }

  // Default to adequate if nothing else matches
  return {
    restQuality: 'adequate',
    restMultiplier: 1.0,
    restDescription: 'Conditions seem acceptable for rest'
  };
}

// Generate flavor text for rest events based on quality
function generateRestEvent(quality, success) {
  const events = {
    terrible: {
      success: [
        'You managed to catch a few hours of fitful sleep despite the dangers',
        'Every sound kept you on edge, but exhaustion eventually won out',
        'You slept with one eye open, weapon at the ready',
        'The oppressive environment made rest nearly impossible'
      ],
      failure: [
        'Strange noises kept you awake most of the night',
        'The cold seeped into your bones, preventing any real rest',
        'Something crawled over you in the darkness',
        'Nightmares plagued your attempts at sleep',
        'The toxic air left you feeling worse than before'
      ]
    },
    poor: {
      success: [
        'The ground was hard, but you managed to rest',
        'The sounds of the wilderness provided an uneasy backdrop to your sleep',
        'You woke several times but eventually got some rest',
        'A passing patrol made you hide in your bedroll for an hour'
      ]
    },
    luxurious: {
      success: [
        'You woke refreshed, feeling better than you have in weeks',
        'The soft bed and warm blankets made for an exceptional rest',
        'You enjoyed a hot bath before retiring to silken sheets',
        'Room service brought breakfast just as you were waking',
        'The peaceful surroundings let you sleep deeply and dream pleasantly'
      ]
    }
  };

  const qualityEvents = events[quality];
  if (!qualityEvents) return null;

  const eventList = success ? qualityEvents.success : qualityEvents.failure;
  if (!eventList || eventList.length === 0) return null;

  return eventList[Math.floor(Math.random() * eventList.length)];
}

// Get average hit die value for a class (used for short rest calculations)
function getClassHitDieAverage(className) {
  const hitDice = {
    // d12 classes (average 6.5, round to 7)
    barbarian: 7,
    // d10 classes (average 5.5, round to 6)
    fighter: 6,
    paladin: 6,
    ranger: 6,
    // d8 classes (average 4.5, round to 5)
    bard: 5,
    cleric: 5,
    druid: 5,
    monk: 5,
    rogue: 5,
    warlock: 5,
    // d6 classes (average 3.5, round to 4)
    sorcerer: 4,
    wizard: 4,
    // Artificer uses d8
    artificer: 5
  };

  const classLower = (className || '').toLowerCase();
  return hitDice[classLower] || 5; // Default to d8 average
}

// Generate narrative description for a rest
function generateRestNarrative(isLongRest, quality, location, characterName, hasCompanions) {
  const firstName = characterName?.split(' ')[0] || 'the adventurer';
  const loc = (location || 'the wilderness').toLowerCase();

  // Determine setting type
  const isIndoors = loc.includes('inn') || loc.includes('tavern') || loc.includes('home') ||
                    loc.includes('house') || loc.includes('room') || loc.includes('temple') ||
                    loc.includes('manor') || loc.includes('castle') || loc.includes('tower');
  const isUrban = loc.includes('city') || loc.includes('town') || loc.includes('village') ||
                  loc.includes('waterdeep') || loc.includes('baldur') || loc.includes('neverwinter');

  // Short rest narratives (1 hour break)
  const shortRestNarratives = {
    luxurious: [
      `${firstName} settles into plush cushions, savoring a warm drink as servants attend to minor needs. The hour passes in comfort.`,
      `In the privacy of elegant quarters, ${firstName} takes time to catch their breath, enjoying the rare luxury of true relaxation.`
    ],
    comfortable: [
      `${firstName} finds a quiet corner and takes a moment to rest, eating some rations and tending to minor scrapes.`,
      `Taking shelter from the bustle outside, ${firstName} spends an hour recovering strength and gathering thoughts.`,
      `${firstName} sits down for a brief respite, bandaging wounds and catching their breath.`
    ],
    adequate: [
      `${firstName} takes a short break, leaning against a wall and resting weary legs while staying alert.`,
      `Finding a relatively safe spot, ${firstName} pauses to rest and regain composure.`
    ],
    poor: [
      `${firstName} manages a brief, uneasy rest despite the uncomfortable conditions, never quite able to fully relax.`,
      `The hour passes fitfully as ${firstName} tries to rest while remaining watchful of the surroundings.`
    ],
    terrible: [
      `${firstName} attempts to rest, but the oppressive environment makes true relaxation impossible. Every shadow seems to move.`,
      `Sleep is out of the question in this hostile place. ${firstName} manages only a tense, watchful pause.`
    ]
  };

  // Long rest narratives (overnight)
  const longRestNarratives = {
    luxurious: [
      `${firstName} enjoys a night of true comfort - a soft bed, warm blankets, and the peace that comes from safety. Dreams come easily.`,
      `The night passes in blissful rest. ${firstName} awakens refreshed, the aches of adventure faded like morning mist.`,
      hasCompanions
        ? `${firstName} and companions share stories over a fine meal before retiring to comfortable beds. Morning finds them all restored.`
        : `${firstName} sleeps deeply in luxurious surroundings, waking to breakfast brought on a silver tray.`
    ],
    comfortable: [
      `${firstName} settles in for the night, the simple comfort of a warm bed and roof overhead a welcome respite from the road.`,
      hasCompanions
        ? `Around a crackling fire, ${firstName} and friends share the evening watch before taking turns at restful sleep.`
        : `${firstName} finds a comfortable spot and sleeps through the night, waking with renewed vigor.`,
      `The night passes peacefully. ${firstName} rises with the dawn, stretching away the last vestiges of fatigue.`
    ],
    adequate: [
      `${firstName} makes do with basic accommodations, sleeping lightly but well enough to face another day.`,
      `It's not luxurious, but the rest is adequate. ${firstName} wakes stiff but restored.`
    ],
    poor: [
      hasCompanions
        ? `${firstName} and companions take turns on watch throughout the cold night. Sleep comes in fitful snatches.`
        : `${firstName} camps under the stars, the hard ground and night sounds making for restless sleep.`,
      `The night is long and uncomfortable. ${firstName} wakes tired but at least somewhat recovered.`,
      `Sleeping outdoors with one eye open, ${firstName} manages to get some rest despite the conditions.`
    ],
    terrible: [
      `${firstName} barely sleeps, the threatening environment demanding constant vigilance. Dawn is a relief.`,
      `The night is a trial of endurance. ${firstName} catches what rest they can between moments of alarm.`,
      `Every sound could be danger in this cursed place. ${firstName}'s rest is more survival than recovery.`
    ]
  };

  const narratives = isLongRest ? longRestNarratives : shortRestNarratives;
  const qualityNarratives = narratives[quality] || narratives.adequate;

  return qualityNarratives[Math.floor(Math.random() * qualityNarratives.length)];
}

// Check if character has relevant items in inventory
function analyzeInventory(inventoryJson) {
  let inventory = [];
  try {
    inventory = typeof inventoryJson === 'string' ? JSON.parse(inventoryJson) : (inventoryJson || []);
  } catch (e) {
    inventory = [];
  }

  const itemNames = inventory.map(i => (typeof i === 'string' ? i : i.name || '').toLowerCase());
  const allItems = itemNames.join(' ');

  const hasBooks = itemNames.some(name =>
    name.includes('book') || name.includes('scroll') || name.includes('tome') ||
    name.includes('manual') || name.includes('journal') || name.includes('map')
  );

  const hasTools = itemNames.some(name =>
    name.includes('tools') || name.includes("smith") || name.includes('kit') ||
    name.includes('supplies') || name.includes('instrument')
  );

  return { hasBooks, hasTools };
}

// Get available activities for a character based on location and inventory
router.get('/available/:characterId', async (req, res) => {
  try {
    const character = await dbGet('SELECT * FROM characters WHERE id = ?', [req.params.characterId]);
    if (!character) {
      return res.status(404).json({ error: 'Character not found' });
    }

    const locationContext = analyzeLocation(character.current_location);
    const inventoryContext = analyzeInventory(character.inventory);
    const context = { ...locationContext, ...inventoryContext };

    const available = [];
    const unavailable = [];

    for (const [key, activity] of Object.entries(ACTIVITIES)) {
      const activityData = {
        id: key,
        ...activity,
        available: true,
        unavailableReason: null
      };

      // Check requirements
      if (activity.requirements) {
        for (const [req, needed] of Object.entries(activity.requirements)) {
          if (needed && !context[req]) {
            activityData.available = false;
            // Generate human-readable reason
            switch (req) {
              case 'inSettlement':
                activityData.unavailableReason = 'Must be in a town or city';
                break;
              case 'inTavern':
                activityData.unavailableReason = 'Must be at a tavern or inn';
                break;
              case 'hasCompany':
                activityData.unavailableReason = 'No one around to socialize with';
                break;
              case 'hasBooks':
                activityData.unavailableReason = 'Need books or scrolls to study';
                break;
              case 'hasTools':
                activityData.unavailableReason = 'Need appropriate tools';
                break;
              default:
                activityData.unavailableReason = 'Requirements not met';
            }
            break;
          }
        }
      }

      if (activityData.available) {
        available.push(activityData);
      } else {
        unavailable.push(activityData);
      }
    }

    res.json({
      characterLocation: character.current_location,
      locationContext,
      inventoryContext,
      available,
      unavailable
    });
  } catch (error) {
    handleServerError(res, error, 'get available activities');
  }
});

// Get available work options for a character
router.get('/work-options/:characterId', async (req, res) => {
  try {
    const character = await dbGet('SELECT * FROM characters WHERE id = ?', [req.params.characterId]);
    if (!character) {
      return res.status(404).json({ error: 'Character not found' });
    }

    const locationContext = analyzeLocation(character.current_location);
    const charClass = (character.class || '').toLowerCase();
    const level = character.level || 1;

    // Get class-specific work options or default
    const classOptions = CLASS_WORK_OPTIONS[charClass] || DEFAULT_WORK_OPTIONS;

    // Calculate level multiplier: level 1 = 1x, level 10 = 2.35x, level 20 = 3.85x
    const levelMultiplier = 1 + (level - 1) * 0.15;

    const available = [];
    const unavailable = [];

    for (const option of classOptions) {
      const gpPerHour = Math.round(option.baseRate * levelMultiplier * 100) / 100;
      const workOption = {
        ...option,
        gpPerHour,
        available: true,
        unavailableReason: null
      };

      // Check requirements
      if (option.requirements) {
        for (const [req, needed] of Object.entries(option.requirements)) {
          if (needed && !locationContext[req]) {
            workOption.available = false;
            switch (req) {
              case 'inSettlement':
                workOption.unavailableReason = 'Must be in a town or city';
                break;
              case 'inTavern':
                workOption.unavailableReason = 'Must be at a tavern or inn';
                break;
              case 'inWilderness':
                workOption.unavailableReason = 'Must be in the wilderness';
                break;
              default:
                workOption.unavailableReason = 'Requirements not met';
            }
            break;
          }
        }
      }

      if (workOption.available) {
        available.push(workOption);
      } else {
        unavailable.push(workOption);
      }
    }

    res.json({
      characterClass: character.class,
      characterLevel: level,
      levelMultiplier,
      locationContext,
      available,
      unavailable
    });
  } catch (error) {
    handleServerError(res, error, 'get work options');
  }
});

// Check for active downtime
router.get('/status/:characterId', async (req, res) => {
  try {
    const active = await dbGet(`
      SELECT * FROM downtime
      WHERE character_id = ? AND status = 'active'
      ORDER BY start_time DESC
      LIMIT 1
    `, [req.params.characterId]);

    if (active) {
      const now = new Date();
      const endTime = new Date(active.end_time);

      if (now >= endTime) {
        // Activity completed
        res.json({
          status: 'completed',
          activity: active,
          activity_type: ACTIVITIES[active.activity_type]
        });
      } else {
        // Still in progress
        res.json({
          status: 'active',
          activity: active,
          activity_type: ACTIVITIES[active.activity_type],
          timeRemaining: endTime - now
        });
      }
    } else {
      res.json({ status: 'none' });
    }
  } catch (error) {
    handleServerError(res, error, 'check downtime status');
  }
});

// Start a downtime activity
router.post('/start', async (req, res) => {
  try {
    const { characterId, activityType, durationHours, workType, restType } = req.body;

    // Validate activity exists
    const activity = ACTIVITIES[activityType];
    if (!activity) {
      return res.status(400).json({ error: 'Invalid activity type' });
    }

    // For rest activity, validate rest type and use its duration
    let actualDuration = durationHours;
    let restTypeData = null;
    if (activityType === 'rest' && restType) {
      restTypeData = REST_TYPES[restType];
      if (!restTypeData) {
        return res.status(400).json({ error: 'Invalid rest type' });
      }
      actualDuration = restTypeData.duration;
    }

    // Validate duration (skip for rest with specific rest type)
    if (!restType && activity.maxHours && actualDuration > activity.maxHours) {
      return res.status(400).json({ error: `Maximum duration for ${activity.name} is ${activity.maxHours} hours` });
    }

    // Check for existing active downtime
    const existing = await dbGet(`
      SELECT * FROM downtime
      WHERE character_id = ? AND status = 'active'
    `, [characterId]);

    if (existing) {
      return res.status(400).json({ error: 'Character already has an active downtime activity' });
    }

    // Check for active adventure
    const activeAdventure = await dbGet(`
      SELECT * FROM adventures
      WHERE character_id = ? AND status = 'active'
    `, [characterId]);

    if (activeAdventure) {
      return res.status(400).json({ error: 'Character is currently on an adventure' });
    }

    // Get character for context validation
    const character = await dbGet('SELECT * FROM characters WHERE id = ?', [characterId]);
    if (!character) {
      return res.status(404).json({ error: 'Character not found' });
    }

    // Validate requirements are met
    const locationContext = analyzeLocation(character.current_location);
    const inventoryContext = analyzeInventory(character.inventory);
    const context = { ...locationContext, ...inventoryContext };

    if (activity.requirements) {
      for (const [req, needed] of Object.entries(activity.requirements)) {
        if (needed && !context[req]) {
          return res.status(400).json({ error: `Cannot perform ${activity.name} - requirements not met` });
        }
      }
    }

    // For work activity, validate the work type
    let workOptionData = null;
    if (activityType === 'work' && workType) {
      const charClass = (character.class || '').toLowerCase();
      const classOptions = CLASS_WORK_OPTIONS[charClass] || DEFAULT_WORK_OPTIONS;
      workOptionData = classOptions.find(o => o.id === workType);

      if (!workOptionData) {
        return res.status(400).json({ error: 'Invalid work type for this class' });
      }

      // Check work-specific requirements
      if (workOptionData.requirements) {
        for (const [req, needed] of Object.entries(workOptionData.requirements)) {
          if (needed && !context[req]) {
            return res.status(400).json({ error: `Cannot perform ${workOptionData.name} - requirements not met` });
          }
        }
      }
    }

    const now = new Date();
    // Convert in-game hours to real-world time
    // 1 real-world hour = 8 in-game hours, so 1 in-game hour = 7.5 real minutes
    const realMinutesPerInGameHour = 7.5;
    const realMilliseconds = actualDuration * realMinutesPerInGameHour * 60 * 1000;
    const endTime = new Date(now.getTime() + realMilliseconds);

    const result = await dbRun(`
      INSERT INTO downtime (character_id, activity_type, work_type, rest_type, duration_hours, start_time, end_time, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'active')
    `, [characterId, activityType, workType || null, restType || null, actualDuration, now.toISOString(), endTime.toISOString()]);

    const newDowntime = await dbGet('SELECT * FROM downtime WHERE id = ?', [result.lastInsertRowid]);

    // Determine display name
    let activityName = activity.name;
    if (activityType === 'work' && workOptionData) {
      activityName = workOptionData.name;
    } else if (activityType === 'rest' && restTypeData) {
      activityName = restTypeData.name;
    }

    // Format real-world duration for message
    const realMinutes = actualDuration * realMinutesPerInGameHour;
    let realTimeStr;
    if (realMinutes < 60) {
      realTimeStr = `${Math.round(realMinutes)} minute${Math.round(realMinutes) !== 1 ? 's' : ''}`;
    } else {
      const hours = Math.floor(realMinutes / 60);
      const mins = Math.round(realMinutes % 60);
      realTimeStr = mins === 0 ? `${hours} hour${hours !== 1 ? 's' : ''}` : `${hours}h ${mins}m`;
    }

    res.status(201).json({
      downtime: newDowntime,
      activity: activity,
      workOption: workOptionData,
      restType: restTypeData,
      message: `Started ${activityName} for ${actualDuration} in-game hour${actualDuration !== 1 ? 's' : ''} (${realTimeStr} real time)`
    });
  } catch (error) {
    handleServerError(res, error, 'start downtime');
  }
});

// Complete/claim downtime results
router.post('/complete/:id', async (req, res) => {
  try {
    const downtime = await dbGet('SELECT * FROM downtime WHERE id = ?', [req.params.id]);

    if (!downtime) {
      return res.status(404).json({ error: 'Downtime activity not found' });
    }

    if (downtime.status !== 'active') {
      return res.status(400).json({ error: 'Downtime activity is not active' });
    }

    const now = new Date();
    const endTime = new Date(downtime.end_time);

    if (now < endTime) {
      return res.status(400).json({
        error: 'Downtime activity not yet complete',
        timeRemaining: endTime - now
      });
    }

    const character = await dbGet('SELECT * FROM characters WHERE id = ?', [downtime.character_id]);
    const activity = ACTIVITIES[downtime.activity_type];

    // Calculate benefits based on activity type and duration
    const benefits = calculateBenefits(downtime, character, activity);

    // Update downtime record
    await dbRun(`
      UPDATE downtime
      SET status = 'completed', results = ?, benefits = ?
      WHERE id = ?
    `, [benefits.description, JSON.stringify(benefits), req.params.id]);

    // Apply benefits to character
    await applyBenefits(character, benefits);

    // Save a pending narrative event for the next DM session
    await saveDowntimeNarrative(character, downtime, activity, benefits);

    const updatedDowntime = await dbGet('SELECT * FROM downtime WHERE id = ?', [req.params.id]);
    const updatedCharacter = await dbGet('SELECT * FROM characters WHERE id = ?', [downtime.character_id]);

    res.json({
      downtime: updatedDowntime,
      benefits,
      character: updatedCharacter
    });
  } catch (error) {
    handleServerError(res, error, 'complete downtime');
  }
});

// Cancel active downtime
router.post('/cancel/:id', async (req, res) => {
  try {
    const downtime = await dbGet('SELECT * FROM downtime WHERE id = ?', [req.params.id]);

    if (!downtime) {
      return res.status(404).json({ error: 'Downtime activity not found' });
    }

    if (downtime.status !== 'active') {
      return res.status(400).json({ error: 'Downtime activity is not active' });
    }

    await dbRun('UPDATE downtime SET status = ? WHERE id = ?', ['cancelled', req.params.id]);

    res.json({ message: 'Downtime activity cancelled' });
  } catch (error) {
    handleServerError(res, error, 'cancel downtime');
  }
});

// Get downtime history
router.get('/history/:characterId', async (req, res) => {
  try {
    const history = await dbAll(`
      SELECT * FROM downtime
      WHERE character_id = ? AND status = 'completed'
      ORDER BY end_time DESC
      LIMIT 20
    `, [req.params.characterId]);

    // Enrich with activity info
    const enriched = history.map(d => ({
      ...d,
      activity: ACTIVITIES[d.activity_type]
    }));

    res.json(enriched);
  } catch (error) {
    handleServerError(res, error, 'fetch downtime history');
  }
});

// Calculate benefits based on activity
function calculateBenefits(downtime, character, activity) {
  const hours = downtime.duration_hours;
  const benefits = {
    type: downtime.activity_type,
    hours,
    description: '',
    hpRestored: 0,
    goldEarned: 0,
    xpGained: 0,
    events: []
  };

  // Get location context for condition-dependent activities
  const locationContext = analyzeLocation(character.current_location);

  switch (downtime.activity_type) {
    case 'rest':
      const restQuality = locationContext.restQuality;
      const restTypeId = downtime.rest_type;
      const restTypeData = REST_TYPES[restTypeId] || REST_TYPES.short;
      const isLongRest = restTypeId === 'long';
      const isShortRest = restTypeId === 'short';

      // Check if rest can complete in current conditions
      let restInterrupted = false;
      if (restQuality === 'terrible') {
        // 40% chance of rest being interrupted in terrible conditions
        restInterrupted = Math.random() < 0.4;
      }

      if (restInterrupted) {
        // Rest interrupted - no benefits, possible damage
        const damage = Math.floor(Math.random() * 3) + 1;
        benefits.hpRestored = -damage;
        benefits.events.push(generateRestEvent(restQuality, false));
        benefits.description = `Your ${restTypeData.name.toLowerCase()} was interrupted! Lost ${damage} HP`;
        benefits.restInterrupted = true;
      } else if (isLongRest) {
        // LONG REST: Recover all HP, regain half Hit Dice
        // Calculate HP to restore (100% of missing HP for long rest)
        const missingHp = character.max_hp - character.current_hp;

        // Apply quality modifiers for long rest
        let hpToRestore;
        if (restQuality === 'terrible') {
          // Terrible: only recover 25% HP
          hpToRestore = Math.floor(missingHp * 0.25);
          benefits.events.push(generateRestEvent(restQuality, true));
        } else if (restQuality === 'poor') {
          // Poor: only recover 50% HP
          hpToRestore = Math.floor(missingHp * 0.5);
          if (Math.random() < 0.3) {
            benefits.events.push(generateRestEvent(restQuality, true));
          }
        } else if (restQuality === 'luxurious') {
          // Luxurious: full HP + bonus XP
          hpToRestore = missingHp;
          benefits.xpGained = 5;
          if (Math.random() < 0.4) {
            benefits.events.push(generateRestEvent(restQuality, true));
          }
        } else {
          // Adequate or Comfortable: full HP recovery
          hpToRestore = missingHp;
        }

        benefits.hpRestored = hpToRestore;

        // Build description based on quality
        const qualityDesc = restQuality === 'luxurious' ? 'luxurious ' :
                          restQuality === 'comfortable' ? 'comfortable ' :
                          restQuality === 'poor' ? 'fitful ' :
                          restQuality === 'terrible' ? 'difficult ' : '';
        benefits.description = `Completed a ${qualityDesc}long rest and recovered ${benefits.hpRestored} HP`;
        if (benefits.xpGained > 0) {
          benefits.description += ` and gained ${benefits.xpGained} XP`;
        }
        benefits.longRest = true;
        benefits.abilitiesRecharged = 'all';
      } else {
        // SHORT REST: Can spend Hit Dice to recover HP
        // For simplicity, we'll auto-calculate a reasonable HP recovery
        // In D&D, you can spend Hit Dice (1dX + CON mod per die, where X is your class hit die)
        // We'll simulate spending half your available hit dice

        const level = character.level || 1;
        // Assume average hit die roll based on class
        const hitDieAverage = getClassHitDieAverage(character.class);
        // Estimate CON modifier from ability scores if available
        let conMod = 0;
        try {
          const abilityScores = typeof character.ability_scores === 'string'
            ? JSON.parse(character.ability_scores)
            : character.ability_scores;
          if (abilityScores && abilityScores.con) {
            conMod = Math.floor((abilityScores.con - 10) / 2);
          }
        } catch (e) {
          conMod = 0;
        }

        // Spend half your hit dice (rounded up), minimum 1
        const hitDiceToSpend = Math.max(1, Math.ceil(level / 2));
        const hpPerDie = hitDieAverage + conMod;
        let potentialHp = hitDiceToSpend * Math.max(1, hpPerDie);

        // Apply quality modifiers for short rest
        if (restQuality === 'terrible') {
          potentialHp = Math.floor(potentialHp * 0.25);
          benefits.events.push(generateRestEvent(restQuality, true));
        } else if (restQuality === 'poor') {
          potentialHp = Math.floor(potentialHp * 0.5);
          if (Math.random() < 0.3) {
            benefits.events.push(generateRestEvent(restQuality, true));
          }
        } else if (restQuality === 'luxurious') {
          potentialHp = Math.floor(potentialHp * 1.25);
          if (Math.random() < 0.3) {
            benefits.events.push(generateRestEvent(restQuality, true));
          }
        }

        // Cap at missing HP
        const missingHp = character.max_hp - character.current_hp;
        benefits.hpRestored = Math.min(potentialHp, missingHp);
        benefits.hitDiceSpent = hitDiceToSpend;

        const qualityDesc = restQuality === 'luxurious' ? 'rejuvenating ' :
                          restQuality === 'comfortable' ? 'restful ' :
                          restQuality === 'poor' ? 'uneasy ' :
                          restQuality === 'terrible' ? 'tense ' : '';
        benefits.description = `Completed a ${qualityDesc}short rest, spent ${hitDiceToSpend} Hit Dice and recovered ${benefits.hpRestored} HP`;
        benefits.shortRest = true;
        benefits.abilitiesRecharged = 'short_rest';
      }

      benefits.restType = restTypeId;
      benefits.restQuality = restQuality;
      break;

    case 'pray':
      // Small XP bonus and chance of divine favor
      benefits.xpGained = Math.floor(hours * 2);
      if (Math.random() < 0.1 * hours) {
        benefits.events.push('You feel blessed by divine favor');
        benefits.xpGained += 10;
      }
      benefits.description = `Prayed for ${hours} hours${benefits.events.length ? ' - ' + benefits.events[0] : ''}`;
      break;

    case 'train':
      // Training XP
      benefits.xpGained = Math.floor(hours * 5);
      benefits.description = `Trained for ${hours} hours, gaining ${benefits.xpGained} XP`;
      break;

    case 'study':
      // Knowledge XP
      benefits.xpGained = Math.floor(hours * 4);
      if (Math.random() < 0.15) {
        benefits.events.push('You discovered something interesting in your studies');
        benefits.xpGained += 15;
      }
      benefits.description = `Studied for ${hours} hours, gaining ${benefits.xpGained} XP`;
      break;

    case 'craft':
      // Crafting progress (for now, small gold value created)
      benefits.goldEarned = Math.floor(hours * 1.5);
      benefits.description = `Crafted for ${hours} hours, creating items worth ${benefits.goldEarned} GP`;
      break;

    case 'work':
      // Find the work option used
      const charClass = (character.class || '').toLowerCase();
      const level = character.level || 1;
      const levelMultiplier = 1 + (level - 1) * 0.15;
      const classOptions = CLASS_WORK_OPTIONS[charClass] || DEFAULT_WORK_OPTIONS;
      const workOption = downtime.work_type ? classOptions.find(o => o.id === downtime.work_type) : null;

      if (workOption) {
        // Calculate earnings based on class work option
        const gpPerHour = workOption.baseRate * levelMultiplier;

        // Handle special work types
        if (workOption.special === 'gambling') {
          // Gambling: risk vs reward
          const roll = Math.random();
          if (roll < 0.3) {
            benefits.goldEarned = -Math.floor(hours * 2 * levelMultiplier);
            benefits.events.push('Lady luck was not on your side');
          } else if (roll < 0.7) {
            benefits.goldEarned = Math.floor(hours * 1);
            benefits.events.push('You came out roughly even');
          } else if (roll < 0.9) {
            benefits.goldEarned = Math.floor(hours * 3 * levelMultiplier);
            benefits.events.push('A profitable evening at the tables');
          } else {
            benefits.goldEarned = Math.floor(hours * 6 * levelMultiplier);
            benefits.events.push('A big win! Fortune favors the bold');
          }
        } else {
          benefits.goldEarned = Math.floor(hours * gpPerHour);
        }

        // Add XP bonus if the work option has one
        if (workOption.xpBonus) {
          benefits.xpGained = Math.floor(hours * workOption.xpBonus);
        }

        // Handle risky work
        if (workOption.riskLevel === 'medium' && Math.random() < 0.15) {
          const hpLoss = Math.floor(Math.random() * 3) + 1;
          benefits.hpRestored = -hpLoss;
          benefits.events.push(`You took ${hpLoss} damage in the process`);
          benefits.xpGained = (benefits.xpGained || 0) + 10; // Bonus XP for risk
        } else if (workOption.riskLevel === 'low' && Math.random() < 0.05) {
          benefits.hpRestored = -1;
          benefits.events.push('A minor injury during work');
        }

        const workName = workOption.name;
        const xpText = benefits.xpGained > 0 ? ` and ${benefits.xpGained} XP` : '';
        const eventText = benefits.events.length > 0 ? ` - ${benefits.events.join(', ')}` : '';
        benefits.description = `${workName} for ${hours} hours, earning ${benefits.goldEarned} GP${xpText}${eventText}`;
        benefits.workType = downtime.work_type;
        benefits.workName = workName;
      } else {
        // Fallback to generic work
        benefits.goldEarned = Math.floor(hours * 0.5 * levelMultiplier);
        benefits.description = `Worked for ${hours} hours and earned ${benefits.goldEarned} GP`;
      }
      break;

    case 'socialize':
      // Information and contacts
      benefits.xpGained = Math.floor(hours * 2);
      if (Math.random() < 0.2 * Math.min(hours, 4)) {
        benefits.events.push('You heard an interesting rumor');
      }
      if (Math.random() < 0.1 * Math.min(hours, 4)) {
        benefits.events.push('You made a useful contact');
      }
      benefits.description = `Socialized for ${hours} hours${benefits.events.length ? ' - ' + benefits.events.join(', ') : ''}`;
      break;

    case 'carouse':
      // Random good/bad events
      benefits.goldEarned = -Math.floor(hours * 2); // Costs money

      // Roll on carousing table
      const roll = Math.random();
      if (roll < 0.1) {
        benefits.events.push('You woke up with a terrible hangover (-2 HP)');
        benefits.hpRestored = -2;
      } else if (roll < 0.2) {
        benefits.events.push('You won at cards!');
        benefits.goldEarned += Math.floor(Math.random() * 10) + 5;
      } else if (roll < 0.3) {
        benefits.events.push('You made a new friend who might be useful');
        benefits.xpGained += 10;
      } else if (roll < 0.4) {
        benefits.events.push('You heard valuable information');
        benefits.xpGained += 15;
      } else if (roll < 0.5) {
        benefits.events.push('You got into a minor brawl');
        benefits.hpRestored = -1;
        benefits.xpGained += 5;
      } else {
        benefits.events.push('A good time was had');
      }

      const netGold = benefits.goldEarned;
      benefits.description = `Caroused for ${hours} hours (${netGold >= 0 ? '+' : ''}${netGold} GP) - ${benefits.events[0]}`;
      break;

    case 'maintain':
      // Equipment maintenance - narrative benefit, prevents degradation
      if (hours >= 4) {
        benefits.events.push('You thoroughly cleaned and maintained all your equipment');
        benefits.events.push('Your weapons are sharp, your armor oiled and fitted');
      } else {
        benefits.events.push('You performed basic maintenance on your most-used gear');
      }

      // Small XP for the care and discipline
      benefits.xpGained = Math.floor(hours * 2);

      benefits.description = `Maintained equipment for ${hours} hours - ${benefits.events[0]}`;
      break;
  }

  return benefits;
}

// Apply benefits to character
async function applyBenefits(character, benefits) {
  const updates = [];
  const params = [];

  if (benefits.hpRestored !== 0) {
    const newHp = Math.max(1, Math.min(character.max_hp, character.current_hp + benefits.hpRestored));
    updates.push('current_hp = ?');
    params.push(newHp);
  }

  if (benefits.goldEarned !== 0) {
    const newGold = Math.max(0, (character.gold_gp || 0) + benefits.goldEarned);
    updates.push('gold_gp = ?');
    params.push(newGold);
  }

  if (benefits.xpGained > 0) {
    const newXp = (character.experience || 0) + benefits.xpGained;
    updates.push('experience = ?');
    params.push(newXp);
  }

  // Restore spell slots on long rest, or for warlocks on short rest
  const characterClass = character.class?.toLowerCase();
  if (benefits.longRest || (benefits.shortRest && characterClass === 'warlock')) {
    updates.push("spell_slots_used = '{}'");
    benefits.spellSlotsRestored = true;
  }

  if (updates.length > 0) {
    params.push(character.id);
    await dbRun(`UPDATE characters SET ${updates.join(', ')} WHERE id = ?`, params);
  }
}

// Save a pending narrative event for the next DM session
async function saveDowntimeNarrative(character, downtime, activity, benefits) {
  try {
    // Parse existing pending narratives
    let pendingNarratives = [];
    try {
      pendingNarratives = JSON.parse(character.pending_downtime_narratives || '[]');
    } catch (e) {
      pendingNarratives = [];
    }

    // Build a narrative-friendly description of what happened
    const narrativeEvent = {
      type: downtime.activity_type,
      activityName: activity.name,
      duration: `${downtime.duration_hours} hour${downtime.duration_hours !== 1 ? 's' : ''}`,
      result: benefits.description,
      timestamp: new Date().toISOString(),
      details: {}
    };

    // Add specific details based on activity type
    if (benefits.hpRestored > 0) {
      narrativeEvent.details.hpRestored = benefits.hpRestored;
    }
    if (benefits.xpGained > 0) {
      narrativeEvent.details.xpGained = benefits.xpGained;
    }
    if (benefits.goldEarned !== 0) {
      narrativeEvent.details.goldEarned = benefits.goldEarned;
    }
    if (benefits.events && benefits.events.length > 0) {
      narrativeEvent.details.events = benefits.events;
    }
    if (benefits.workName) {
      narrativeEvent.details.workType = benefits.workName;
    }
    if (benefits.restType) {
      narrativeEvent.details.restType = benefits.restType;
      narrativeEvent.details.restQuality = benefits.restQuality;
    }

    // Add to pending narratives (keep last 5 to avoid too much context)
    pendingNarratives.push(narrativeEvent);
    if (pendingNarratives.length > 5) {
      pendingNarratives = pendingNarratives.slice(-5);
    }

    // Save back to character
    await dbRun(`
      UPDATE characters
      SET pending_downtime_narratives = ?
      WHERE id = ?
    `, [JSON.stringify(pendingNarratives), character.id]);
  } catch (e) {
    console.error('Error saving downtime narrative:', e);
    // Don't fail the main operation if narrative saving fails
  }
}

export default router;
