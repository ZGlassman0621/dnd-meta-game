/**
 * Achievement Definitions
 *
 * Hardcoded achievement list. Each achievement has criteria that match
 * against game events emitted by the event bus.
 *
 * Criteria types:
 *   - flag: earned on first matching event
 *   - counter: counts matching events, earned when threshold reached
 *   - threshold: checks a numeric value against a minimum
 */

export const ACHIEVEMENT_CATEGORIES = [
  'combat', 'exploration', 'social', 'wealth', 'story', 'companion', 'session'
];

export const ACHIEVEMENTS = [
  // ============================================================
  // COMBAT
  // ============================================================
  {
    key: 'first_blood',
    title: 'First Blood',
    description: 'Complete your first combat encounter.',
    category: 'combat',
    icon: '\u2694\uFE0F',
    hidden: false,
    rewards: { xp: 50 },
    criteria: {
      type: 'counter',
      event: 'adventure_complete',
      params: { tags_include: 'combat' },
      threshold: 1
    }
  },
  {
    key: 'battle_hardened',
    title: 'Battle Hardened',
    description: 'Complete 10 combat encounters.',
    category: 'combat',
    icon: '\uD83D\uDEE1\uFE0F',
    hidden: false,
    rewards: { xp: 200, gold: 50 },
    criteria: {
      type: 'counter',
      event: 'adventure_complete',
      params: { tags_include: 'combat' },
      threshold: 10
    }
  },
  {
    key: 'dragon_slayer',
    title: 'Dragon Slayer',
    description: 'Defeat a dragon in combat.',
    category: 'combat',
    icon: '\uD83D\uDC09',
    hidden: true,
    rewards: { xp: 500, gold: 200 },
    criteria: {
      type: 'flag',
      event: 'adventure_complete',
      params: { tags_include: 'dragon' }
    }
  },
  {
    key: 'survivor',
    title: 'Survivor',
    description: 'Survive a deadly encounter.',
    category: 'combat',
    icon: '\uD83D\uDCA0',
    hidden: true,
    rewards: { xp: 100 },
    criteria: {
      type: 'flag',
      event: 'adventure_complete',
      params: { risk_level: 'deadly' }
    }
  },

  // ============================================================
  // EXPLORATION
  // ============================================================
  {
    key: 'wanderer',
    title: 'Wanderer',
    description: 'Visit 5 different locations.',
    category: 'exploration',
    icon: '\uD83E\uDDED',
    hidden: false,
    rewards: { xp: 75 },
    criteria: {
      type: 'counter',
      event: 'location_visited',
      params: {},
      threshold: 5
    }
  },
  {
    key: 'cartographer',
    title: 'Cartographer',
    description: 'Visit 10 different locations.',
    category: 'exploration',
    icon: '\uD83D\uDDFA\uFE0F',
    hidden: false,
    rewards: { xp: 200, gold: 50 },
    criteria: {
      type: 'counter',
      event: 'location_visited',
      params: {},
      threshold: 10
    }
  },
  {
    key: 'trailblazer',
    title: 'Trailblazer',
    description: 'Discover a hidden location.',
    category: 'exploration',
    icon: '\u2B50',
    hidden: false,
    rewards: { xp: 100 },
    criteria: {
      type: 'flag',
      event: 'location_discovered',
      params: {}
    }
  },

  // ============================================================
  // SOCIAL
  // ============================================================
  {
    key: 'diplomat',
    title: 'Diplomat',
    description: 'Reach Friendly standing with 3 different factions.',
    category: 'social',
    icon: '\uD83E\uDD1D',
    hidden: false,
    rewards: { xp: 150, gold: 100 },
    criteria: {
      type: 'counter',
      event: 'faction_standing_changed',
      params: { min_standing: 20 },
      threshold: 3
    }
  },
  {
    key: 'silver_tongue',
    title: 'Silver Tongue',
    description: 'Reach Allied disposition with any NPC.',
    category: 'social',
    icon: '\uD83D\uDDE3\uFE0F',
    hidden: false,
    rewards: { xp: 100 },
    criteria: {
      type: 'flag',
      event: 'npc_disposition_changed',
      params: { min_disposition: 50 }
    }
  },
  {
    key: 'faction_champion',
    title: 'Faction Champion',
    description: 'Complete a faction quest.',
    category: 'social',
    icon: '\uD83C\uDFF3\uFE0F',
    hidden: false,
    rewards: { xp: 200 },
    criteria: {
      type: 'flag',
      event: 'quest_completed_game',
      params: { source_type: 'faction' }
    }
  },

  // ============================================================
  // WEALTH
  // ============================================================
  {
    key: 'first_gold',
    title: 'First Gold',
    description: 'Accumulate 100 gold pieces.',
    category: 'wealth',
    icon: '\uD83D\uDCB0',
    hidden: false,
    rewards: { xp: 50 },
    criteria: {
      type: 'flag',
      event: 'dm_session_ended',
      params: { min_gold: 100 }
    }
  },
  {
    key: 'treasure_hunter',
    title: 'Treasure Hunter',
    description: 'Find loot in 5 adventures.',
    category: 'wealth',
    icon: '\uD83D\uDC8E',
    hidden: false,
    rewards: { xp: 150, gold: 75 },
    criteria: {
      type: 'counter',
      event: 'item_obtained',
      params: {},
      threshold: 5
    }
  },

  // ============================================================
  // STORY
  // ============================================================
  {
    key: 'chapter_one',
    title: 'Chapter One',
    description: 'Advance a quest to its next stage.',
    category: 'story',
    icon: '\uD83D\uDCD6',
    hidden: false,
    rewards: { xp: 75 },
    criteria: {
      type: 'flag',
      event: 'quest_completed_game',
      params: {}
    }
  },
  {
    key: 'heroes_journey',
    title: "Hero's Journey",
    description: 'Complete a main quest.',
    category: 'story',
    icon: '\uD83C\uDFC6',
    hidden: false,
    rewards: { xp: 500, gold: 200 },
    criteria: {
      type: 'flag',
      event: 'quest_completed_game',
      params: { quest_type: 'main' }
    }
  },
  {
    key: 'side_tracked',
    title: 'Side Tracked',
    description: 'Complete 3 side quests.',
    category: 'story',
    icon: '\uD83D\uDEE4\uFE0F',
    hidden: false,
    rewards: { xp: 150, gold: 50 },
    criteria: {
      type: 'counter',
      event: 'quest_completed_game',
      params: { quest_type: 'side' },
      threshold: 3
    }
  },

  // ============================================================
  // COMPANION
  // ============================================================
  {
    key: 'fellowship',
    title: 'Fellowship',
    description: 'Recruit your first companion.',
    category: 'companion',
    icon: '\uD83E\uDDD1\u200D\uD83E\uDD1D\u200D\uD83E\uDDD1',
    hidden: false,
    rewards: { xp: 75 },
    criteria: {
      type: 'flag',
      event: 'companion_recruited',
      params: {}
    }
  },
  {
    key: 'band_of_brothers',
    title: 'Band of Brothers',
    description: 'Recruit 3 companions.',
    category: 'companion',
    icon: '\uD83D\uDC65',
    hidden: false,
    rewards: { xp: 200 },
    criteria: {
      type: 'counter',
      event: 'companion_recruited',
      params: {},
      threshold: 3
    }
  },
  {
    key: 'loyal_friend',
    title: 'Loyal Friend',
    description: 'Reach Devoted loyalty with a companion.',
    category: 'companion',
    icon: '\u2764\uFE0F',
    hidden: false,
    rewards: { xp: 300 },
    criteria: {
      type: 'flag',
      event: 'companion_loyalty_changed',
      params: { min_loyalty: 100 }
    }
  },
  {
    key: 'keeper_of_secrets',
    title: 'Keeper of Secrets',
    description: 'Discover a companion\'s hidden secret.',
    category: 'companion',
    icon: '\uD83D\uDD10',
    hidden: true,
    rewards: { xp: 150 },
    criteria: {
      type: 'flag',
      event: 'companion_secret_revealed',
      params: {}
    }
  },

  // ============================================================
  // SESSION
  // ============================================================
  {
    key: 'first_session',
    title: 'First Session',
    description: 'Complete your first DM session.',
    category: 'session',
    icon: '\uD83C\uDFB2',
    hidden: false,
    rewards: { xp: 25 },
    criteria: {
      type: 'counter',
      event: 'dm_session_ended',
      params: {},
      threshold: 1
    }
  },
  {
    key: 'veteran',
    title: 'Veteran',
    description: 'Complete 10 DM sessions.',
    category: 'session',
    icon: '\uD83C\uDF1F',
    hidden: false,
    rewards: { xp: 300, gold: 100 },
    criteria: {
      type: 'counter',
      event: 'dm_session_ended',
      params: {},
      threshold: 10
    }
  },
  {
    key: 'level_up',
    title: 'Rising Power',
    description: 'Level up for the first time.',
    category: 'session',
    icon: '\u2B06\uFE0F',
    hidden: false,
    rewards: { xp: 50 },
    criteria: {
      type: 'flag',
      event: 'character_level_up',
      params: {}
    }
  }
];
