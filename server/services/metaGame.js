/**
 * Meta Game Service - Intelligent Campaign Management
 *
 * This service provides:
 * 1. Campaign context aggregation - pulls together all relevant campaign state
 * 2. Time ratio management - configurable real-time to in-game time ratio
 * 3. Activity scheduling - queue activities that run while player is away
 * 4. Intelligent event generation - contextual events during downtime
 */

import { dbAll, dbGet, dbRun } from '../database.js';

// Time ratio presets (real hours : in-game hours)
export const TIME_RATIOS = {
  realtime: { label: 'Real-Time', ratio: 1, description: '1 real hour = 1 in-game hour' },
  leisurely: { label: 'Leisurely', ratio: 4, description: '1 real hour = 4 in-game hours' },
  normal: { label: 'Normal', ratio: 8, description: '1 real hour = 8 in-game hours (default)' },
  fast: { label: 'Fast', ratio: 12, description: '1 real hour = 12 in-game hours' },
  montage: { label: 'Montage', ratio: 24, description: '1 real hour = 1 in-game day' }
};

// Harptos calendar months (30 days each, plus special days)
const HARPTOS_MONTHS = [
  { name: 'Hammer', days: 30, season: 'winter' },
  // Midwinter (special day)
  { name: 'Alturiak', days: 30, season: 'winter' },
  { name: 'Ches', days: 30, season: 'spring' },
  { name: 'Tarsakh', days: 30, season: 'spring' },
  // Greengrass (special day)
  { name: 'Mirtul', days: 30, season: 'spring' },
  { name: 'Kythorn', days: 30, season: 'summer' },
  { name: 'Flamerule', days: 30, season: 'summer' },
  // Midsummer (special day), Shieldmeet (leap years)
  { name: 'Eleasis', days: 30, season: 'summer' },
  { name: 'Eleint', days: 30, season: 'autumn' },
  // Highharvestide (special day)
  { name: 'Marpenoth', days: 30, season: 'autumn' },
  { name: 'Uktar', days: 30, season: 'autumn' },
  // Feast of the Moon (special day)
  { name: 'Nightal', days: 30, season: 'winter' }
];

/**
 * Convert day-of-year to Harptos date
 */
export function dayToHarptosDate(dayOfYear, year) {
  let remainingDays = dayOfYear;
  let monthIndex = 0;

  // Account for special days between months
  const specialDays = [
    { afterMonth: 0, name: 'Midwinter', day: 31 },
    { afterMonth: 3, name: 'Greengrass', day: 122 },
    { afterMonth: 6, name: 'Midsummer', day: 213 },
    { afterMonth: 8, name: 'Highharvestide', day: 275 },
    { afterMonth: 10, name: 'Feast of the Moon', day: 336 }
  ];

  // Check if it's a special day
  for (const special of specialDays) {
    if (dayOfYear === special.day) {
      return {
        day: 1,
        month: special.name,
        monthIndex: -1,
        year,
        season: HARPTOS_MONTHS[special.afterMonth]?.season || 'winter',
        isSpecialDay: true,
        formatted: `${special.name}, ${year} DR`
      };
    }
  }

  // Calculate month and day
  let dayOffset = 0;
  for (let i = 0; i < HARPTOS_MONTHS.length; i++) {
    const specialAfter = specialDays.find(s => s.afterMonth === i);
    const monthStart = dayOffset + 1;
    const monthEnd = dayOffset + HARPTOS_MONTHS[i].days;

    if (dayOfYear >= monthStart && dayOfYear <= monthEnd) {
      const dayInMonth = dayOfYear - dayOffset;
      return {
        day: dayInMonth,
        month: HARPTOS_MONTHS[i].name,
        monthIndex: i,
        year,
        season: HARPTOS_MONTHS[i].season,
        isSpecialDay: false,
        formatted: `${dayInMonth} ${HARPTOS_MONTHS[i].name}, ${year} DR`
      };
    }

    dayOffset += HARPTOS_MONTHS[i].days;
    if (specialAfter) {
      dayOffset += 1; // Special day
    }
  }

  // Fallback
  return {
    day: 1,
    month: 'Hammer',
    monthIndex: 0,
    year,
    season: 'winter',
    isSpecialDay: false,
    formatted: `1 Hammer, ${year} DR`
  };
}

/**
 * Advance time by a number of in-game hours
 * @param {number} currentDay - Current day of year (1-365)
 * @param {number} currentYear - Current year
 * @param {number} currentHour - Current hour of day (0-23)
 * @param {number} hoursToAdvance - Number of in-game hours to advance
 */
export function advanceGameTime(currentDay, currentYear, currentHour, hoursToAdvance) {
  // Handle legacy calls without currentHour
  if (typeof currentHour !== 'number') {
    hoursToAdvance = currentHour;
    currentHour = 8; // Default to 8am
  }

  let totalHours = currentHour + hoursToAdvance;
  const daysToAdvance = Math.floor(totalHours / 24);
  const newHour = totalHours % 24;

  let newDay = currentDay + daysToAdvance;
  const daysInYear = 365; // Harptos calendar

  let newYear = currentYear;
  while (newDay > daysInYear) {
    newDay -= daysInYear;
    newYear += 1;
  }

  return {
    day: newDay,
    year: newYear,
    hour: newHour,
    // Legacy compatibility
    hoursIntoDay: newHour
  };
}

/**
 * Get time of day description from hour
 */
export function getTimeOfDay(hour) {
  if (hour >= 5 && hour < 7) return 'dawn';
  if (hour >= 7 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 14) return 'midday';
  if (hour >= 14 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 20) return 'evening';
  if (hour >= 20 && hour < 22) return 'dusk';
  return 'night';
}

/**
 * Format hour as readable time string
 */
export function formatGameTime(hour) {
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${displayHour}:00 ${period}`;
}

/**
 * Aggregate full campaign context for a character
 * This is the master function that pulls together everything the AI needs
 */
export async function aggregateCampaignContext(characterId) {
  // Get the main character
  const character = await dbGet('SELECT * FROM characters WHERE id = ?', [characterId]);
  if (!character) {
    throw new Error('Character not found');
  }

  // Get recent completed sessions (last 5 for context)
  const recentSessions = await dbAll(`
    SELECT id, title, summary, rewards, start_time, end_time,
           game_start_day, game_start_year, game_end_day, game_end_year
    FROM dm_sessions
    WHERE character_id = ? AND status = 'completed' AND rewards_claimed = 1
    ORDER BY end_time DESC
    LIMIT 5
  `, [characterId]);

  // Get active companions
  const companions = await dbAll(`
    SELECT c.*, n.name, n.nickname, n.race, n.gender, n.age, n.occupation,
           n.occupation_category, n.stat_block, n.cr, n.ac, n.hp, n.speed,
           n.ability_scores as npc_ability_scores, n.skills as npc_skills,
           n.personality_trait_1, n.personality_trait_2, n.motivation,
           n.voice, n.mannerism, n.background_notes, n.current_location,
           n.relationship_to_party
    FROM companions c
    JOIN npcs n ON c.npc_id = n.id
    WHERE c.recruited_by_character_id = ? AND c.status = 'active'
  `, [characterId]);

  // Get available NPCs in the campaign
  const campaignNpcs = await dbAll(`
    SELECT * FROM npcs
    WHERE campaign_availability IN ('available', 'companion', 'mention_only')
    ORDER BY name
  `, []);

  // Get active downtime activity (if any)
  const activeDowntime = await dbGet(`
    SELECT * FROM downtime
    WHERE character_id = ? AND status = 'active'
    ORDER BY start_time DESC
    LIMIT 1
  `, [characterId]);

  // Get active adventure (if any)
  const activeAdventure = await dbGet(`
    SELECT * FROM adventures
    WHERE character_id = ? AND status = 'active'
    ORDER BY start_time DESC
    LIMIT 1
  `, [characterId]);

  // Get pending downtime narratives
  let pendingNarratives = [];
  try {
    pendingNarratives = JSON.parse(character.pending_downtime_narratives || '[]');
  } catch (e) {
    pendingNarratives = [];
  }

  // Get campaign config
  let campaignConfig = {};
  try {
    campaignConfig = JSON.parse(character.campaign_config || '{}');
  } catch (e) {
    campaignConfig = {};
  }

  // Parse character data
  const abilityScores = typeof character.ability_scores === 'string'
    ? JSON.parse(character.ability_scores || '{}')
    : (character.ability_scores || {});

  const inventory = typeof character.inventory === 'string'
    ? JSON.parse(character.inventory || '[]')
    : (character.inventory || []);

  const skills = typeof character.skills === 'string'
    ? JSON.parse(character.skills || '[]')
    : (character.skills || []);

  const equipment = typeof character.equipment === 'string'
    ? JSON.parse(character.equipment || '{}')
    : (character.equipment || {});

  // Build current game date and time
  const gameDate = dayToHarptosDate(character.game_day || 1, character.game_year || 1492);
  const currentHour = character.game_hour ?? 8;
  const timeOfDay = getTimeOfDay(currentHour);
  const formattedTime = formatGameTime(currentHour);

  // Build the aggregated context
  return {
    character: {
      id: character.id,
      name: character.name,
      firstName: character.first_name || character.name.split(' ')[0],
      nickname: character.nickname,
      gender: character.gender,
      race: character.race,
      subrace: character.subrace,
      class: character.class,
      subclass: character.subclass,
      level: character.level,
      background: character.background,
      alignment: character.alignment,
      faith: character.faith,
      currentHp: character.current_hp,
      maxHp: character.max_hp,
      armorClass: character.armor_class,
      speed: character.speed,
      abilityScores,
      skills,
      inventory,
      equipment,
      gold: {
        cp: character.gold_cp || 0,
        sp: character.gold_sp || 0,
        gp: character.gold_gp || 0
      },
      experience: character.experience || 0,
      experienceToNextLevel: character.experience_to_next_level,
      currentLocation: character.current_location,
      currentQuest: character.current_quest,
      personalityTraits: character.personality_traits,
      ideals: character.ideals,
      bonds: character.bonds,
      flaws: character.flaws,
      backstory: character.backstory
    },

    calendar: {
      currentDay: character.game_day || 1,
      currentYear: character.game_year || 1492,
      currentHour,
      timeOfDay,
      formattedTime,
      ...gameDate,
      timeRatio: campaignConfig.timeRatio || 'normal'
    },

    companions: companions.map(c => ({
      id: c.id,
      npcId: c.npc_id,
      name: c.name,
      nickname: c.nickname,
      race: c.race,
      gender: c.gender,
      age: c.age,
      occupation: c.occupation,
      progressionType: c.progression_type,
      class: c.companion_class,
      level: c.companion_level,
      subclass: c.companion_subclass,
      currentHp: c.companion_current_hp,
      maxHp: c.companion_max_hp,
      personality: [c.personality_trait_1, c.personality_trait_2].filter(Boolean),
      motivation: c.motivation,
      voice: c.voice,
      mannerism: c.mannerism,
      backgroundNotes: c.background_notes,
      relationshipToParty: c.relationship_to_party
    })),

    recentSessions: recentSessions.map(s => ({
      id: s.id,
      title: s.title,
      summary: s.summary,
      rewards: s.rewards ? JSON.parse(s.rewards) : null,
      startTime: s.start_time,
      endTime: s.end_time,
      gameDays: {
        start: { day: s.game_start_day, year: s.game_start_year },
        end: { day: s.game_end_day, year: s.game_end_year }
      }
    })),

    campaignNotes: character.campaign_notes || '',

    campaignConfig: {
      ...campaignConfig,
      startingLocation: campaignConfig.startingLocation,
      era: campaignConfig.era,
      arrivalHook: campaignConfig.arrivalHook,
      customConcepts: campaignConfig.customConcepts,
      campaignModule: campaignConfig.campaignModule,
      usedNames: campaignConfig.usedNames || []
    },

    availableNpcs: campaignNpcs.map(n => ({
      id: n.id,
      name: n.name,
      nickname: n.nickname,
      race: n.race,
      gender: n.gender,
      occupation: n.occupation,
      currentLocation: n.current_location,
      availability: n.campaign_availability,
      relationshipToParty: n.relationship_to_party
    })),

    pendingNarratives,

    currentActivity: activeDowntime ? {
      type: 'downtime',
      activityType: activeDowntime.activity_type,
      workType: activeDowntime.work_type,
      restType: activeDowntime.rest_type,
      startTime: activeDowntime.start_time,
      endTime: activeDowntime.end_time,
      durationHours: activeDowntime.duration_hours
    } : activeAdventure ? {
      type: 'adventure',
      title: activeAdventure.title,
      description: activeAdventure.description,
      riskLevel: activeAdventure.risk_level,
      startTime: activeAdventure.start_time,
      endTime: activeAdventure.end_time,
      durationHours: activeAdventure.duration_hours
    } : null
  };
}

/**
 * Generate contextual activity suggestions based on campaign state
 */
export async function generateActivitySuggestions(characterId) {
  const context = await aggregateCampaignContext(characterId);
  const suggestions = [];

  const { character, calendar, companions, recentSessions, campaignConfig } = context;

  // Location-based suggestions
  const location = (character.currentLocation || '').toLowerCase();
  const inSettlement = ['city', 'town', 'village', 'keep', 'port'].some(k => location.includes(k));
  const inWilderness = ['forest', 'road', 'camp', 'trail'].some(k => location.includes(k));
  const inTavern = ['tavern', 'inn', 'bar', 'pub'].some(k => location.includes(k));

  // Health-based suggestions
  const healthPercent = character.currentHp / character.maxHp;
  if (healthPercent < 0.5) {
    suggestions.push({
      priority: 'high',
      type: 'rest',
      activity: 'long_rest',
      reason: `${character.firstName} is wounded and should rest to recover HP.`,
      estimatedHours: 8
    });
  }

  // Time-based suggestions (what makes sense given the time of day/season)
  // Only suggest finding shelter if actually in the wilderness (not in a settlement with shelter)
  const season = calendar.season;
  if (season === 'winter' && inWilderness && !inSettlement) {
    suggestions.push({
      priority: 'medium',
      type: 'survival',
      activity: 'find_shelter',
      reason: 'Winter in the wilderness - finding warm shelter would be wise.',
      estimatedHours: 2
    });
  }

  // Quest-based suggestions
  if (character.currentQuest) {
    suggestions.push({
      priority: 'medium',
      type: 'investigation',
      activity: 'gather_information',
      reason: `Gather information about: ${character.currentQuest}`,
      estimatedHours: 4
    });
  }

  // Companion-based suggestions
  if (companions.length > 0 && inSettlement) {
    // Use first names only (no nicknames, no last names)
    const companionFirstNames = companions.map(c => (c.name || '').split(' ')[0]).filter(Boolean);
    suggestions.push({
      priority: 'low',
      type: 'social',
      activity: 'companion_bonding',
      reason: `Spend time with ${companionFirstNames.join(' and ')}`,
      estimatedHours: 2
    });
  }

  // Gold-based suggestions
  if (character.gold.gp < 5 && inSettlement) {
    suggestions.push({
      priority: 'medium',
      type: 'work',
      activity: 'earn_gold',
      reason: 'Funds are running low - consider working for hire.',
      estimatedHours: 4
    });
  }

  // Training suggestions based on recent sessions
  if (recentSessions.length > 0) {
    const lastSession = recentSessions[0];
    if (lastSession.summary && lastSession.summary.toLowerCase().includes('combat')) {
      suggestions.push({
        priority: 'low',
        type: 'training',
        activity: 'train_combat',
        reason: 'After recent combat, training would reinforce battle lessons.',
        estimatedHours: 4
      });
    }
  }

  // Default suggestions if nothing specific
  if (suggestions.length === 0) {
    if (inTavern || inSettlement) {
      suggestions.push({
        priority: 'low',
        type: 'social',
        activity: 'socialize',
        reason: 'Meet locals and gather rumors.',
        estimatedHours: 2
      });
    } else {
      suggestions.push({
        priority: 'low',
        type: 'exploration',
        activity: 'explore_area',
        reason: 'Scout the surrounding area.',
        estimatedHours: 4
      });
    }
  }

  return {
    suggestions: suggestions.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    }),
    context: {
      location: character.currentLocation,
      healthPercent: Math.round(healthPercent * 100),
      season: calendar.season,
      currentDate: calendar.formatted,
      companions: companions.length,
      gold: character.gold.gp
    }
  };
}

/**
 * Calculate elapsed in-game time based on real time and ratio
 */
export function calculateElapsedGameTime(startTime, endTime, timeRatio = 'normal') {
  const ratio = TIME_RATIOS[timeRatio]?.ratio || TIME_RATIOS.normal.ratio;
  const realMs = new Date(endTime) - new Date(startTime);
  const realHours = realMs / (1000 * 60 * 60);
  const gameHours = realHours * ratio;

  return {
    realHours: Math.round(realHours * 100) / 100,
    gameHours: Math.round(gameHours * 100) / 100,
    gameDays: Math.floor(gameHours / 24),
    remainingHours: Math.round((gameHours % 24) * 100) / 100,
    ratio
  };
}

/**
 * Get time until next significant event (downtime completion, adventure end, etc.)
 */
export async function getNextEvent(characterId) {
  const context = await aggregateCampaignContext(characterId);

  if (!context.currentActivity) {
    return {
      hasEvent: false,
      message: 'No activities in progress.'
    };
  }

  const now = new Date();
  const endTime = new Date(context.currentActivity.endTime);

  if (now >= endTime) {
    return {
      hasEvent: true,
      eventType: context.currentActivity.type,
      status: 'completed',
      message: `${context.currentActivity.type === 'downtime' ? 'Downtime activity' : 'Adventure'} is complete!`,
      activity: context.currentActivity
    };
  }

  const remainingMs = endTime - now;
  const remainingMinutes = Math.ceil(remainingMs / 60000);
  const remainingHours = Math.floor(remainingMinutes / 60);
  const mins = remainingMinutes % 60;

  return {
    hasEvent: true,
    eventType: context.currentActivity.type,
    status: 'in_progress',
    remainingMs,
    remainingFormatted: remainingHours > 0
      ? `${remainingHours}h ${mins}m`
      : `${mins}m`,
    message: `${context.currentActivity.type === 'downtime' ? 'Downtime' : 'Adventure'} completes in ${remainingHours > 0 ? remainingHours + 'h ' : ''}${mins}m`,
    activity: context.currentActivity
  };
}

/**
 * Update the time ratio for a character's campaign
 */
export async function setTimeRatio(characterId, newRatio) {
  if (!TIME_RATIOS[newRatio]) {
    throw new Error(`Invalid time ratio: ${newRatio}`);
  }

  const character = await dbGet('SELECT campaign_config FROM characters WHERE id = ?', [characterId]);
  if (!character) {
    throw new Error('Character not found');
  }

  let campaignConfig = {};
  try {
    campaignConfig = JSON.parse(character.campaign_config || '{}');
  } catch (e) {
    campaignConfig = {};
  }

  campaignConfig.timeRatio = newRatio;

  await dbRun(`
    UPDATE characters
    SET campaign_config = ?
    WHERE id = ?
  `, [JSON.stringify(campaignConfig), characterId]);

  return {
    timeRatio: newRatio,
    ...TIME_RATIOS[newRatio]
  };
}

export default {
  TIME_RATIOS,
  dayToHarptosDate,
  advanceGameTime,
  getTimeOfDay,
  formatGameTime,
  aggregateCampaignContext,
  generateActivitySuggestions,
  calculateElapsedGameTime,
  getNextEvent,
  setTimeRatio
};
