/**
 * Event Types Configuration
 * Defines all event types used in the narrative systems
 */

// ============================================================
// GAME EVENTS - Emitted by gameplay actions
// ============================================================

export const GAME_EVENTS = {
  // Adventure events
  ADVENTURE_STARTED: 'adventure_started',
  ADVENTURE_COMPLETE: 'adventure_complete',
  ADVENTURE_FAILED: 'adventure_failed',
  ADVENTURE_CANCELLED: 'adventure_cancelled',

  // Story thread events
  STORY_THREAD_CREATED: 'story_thread_created',
  STORY_THREAD_RESOLVED: 'story_thread_resolved',
  STORY_THREAD_EXPIRED: 'story_thread_expired',

  // Location events
  LOCATION_DISCOVERED: 'location_discovered',
  LOCATION_VISITED: 'location_visited',
  LOCATION_STATE_CHANGED: 'location_state_changed',

  // NPC events
  NPC_INTERACTION: 'npc_interaction',
  NPC_DISPOSITION_CHANGED: 'npc_disposition_changed',
  NPC_TRUST_CHANGED: 'npc_trust_changed',
  NPC_SECRET_DISCOVERED: 'npc_secret_discovered',
  NPC_PROMISE_MADE: 'npc_promise_made',
  NPC_PROMISE_FULFILLED: 'npc_promise_fulfilled',
  NPC_PROMISE_BROKEN: 'npc_promise_broken',

  // Item events
  ITEM_OBTAINED: 'item_obtained',
  ITEM_LOST: 'item_lost',
  ITEM_USED: 'item_used',

  // Faction events
  FACTION_STANDING_CHANGED: 'faction_standing_changed',

  // Companion events
  COMPANION_RECRUITED: 'companion_recruited',
  COMPANION_DISMISSED: 'companion_dismissed',
  COMPANION_DECEASED: 'companion_deceased',
  COMPANION_LOYALTY_CHANGED: 'companion_loyalty_changed',
  COMPANION_SECRET_REVEALED: 'companion_secret_revealed',
  COMPANION_THREAD_ACTIVATED: 'companion_thread_activated',
  COMPANION_THREAD_RESOLVED: 'companion_thread_resolved',

  // DM Session events
  DM_SESSION_STARTED: 'dm_session_started',
  DM_SESSION_ENDED: 'dm_session_ended',
  DM_SESSION_REWARDS_CLAIMED: 'dm_session_rewards_claimed',

  // Downtime events
  DOWNTIME_STARTED: 'downtime_started',
  DOWNTIME_COMPLETE: 'downtime_complete',

  // Character events
  CHARACTER_LEVEL_UP: 'character_level_up',
  CHARACTER_REST: 'character_rest',
  CHARACTER_LOCATION_CHANGED: 'character_location_changed',

  // Time events
  GAME_TIME_ADVANCED: 'game_time_advanced',
  GAME_DAY_CHANGED: 'game_day_changed'
};

// ============================================================
// QUEST REQUIREMENT TYPES - Used for quest progress matching
// ============================================================

export const REQUIREMENT_TYPES = {
  // Thread-based
  STORY_THREAD_RESOLVED: 'story_thread_resolved',
  INTEL_GATHERED: 'intel_gathered',

  // Location-based
  LOCATION_DISCOVERED: 'location_discovered',
  LOCATION_VISITED: 'location_visited',

  // NPC-based
  NPC_MET: 'npc_met',
  NPC_DISPOSITION: 'npc_disposition',
  NPC_TRUST: 'npc_trust',

  // Item-based
  ITEM_OBTAINED: 'item_obtained',

  // Faction-based
  FACTION_STANDING: 'faction_standing',

  // Combat/Adventure-based
  ENEMY_DEFEATED: 'enemy_defeated',
  ADVENTURE_COMPLETED: 'adventure_completed',

  // Time-based
  TIME_PASSED: 'time_passed',

  // Custom (for special cases)
  CUSTOM: 'custom'
};

// ============================================================
// NARRATIVE QUEUE EVENT TYPES - For narrative delivery
// ============================================================

export const NARRATIVE_EVENTS = {
  // Quest progression
  QUEST_STAGE_ADVANCED: 'quest_stage_advanced',
  QUEST_COMPLETED: 'quest_completed',
  QUEST_FAILED: 'quest_failed',
  QUEST_AVAILABLE: 'quest_available',

  // Companion narratives
  COMPANION_REACTION: 'companion_reaction',
  COMPANION_SECRET_REVEALED: 'companion_secret_revealed',
  COMPANION_THREAD_ACTIVATED: 'companion_thread_activated',

  // World state
  WORLD_STATE_CHANGE: 'world_state_change',
  LOCATION_STATE_CHANGE: 'location_state_change',

  // NPC narratives
  NPC_RELATIONSHIP_SHIFT: 'npc_relationship_shift',

  // Time-sensitive
  TIME_SENSITIVE_WARNING: 'time_sensitive_warning',
  DEADLINE_APPROACHING: 'deadline_approaching',

  // Downtime
  DOWNTIME_EVENT: 'downtime_event',

  // Discovery
  DISCOVERY_MADE: 'discovery_made',

  // Flavor/ambient
  FLAVOR_EVENT: 'flavor_event'
};

// ============================================================
// PRIORITY LEVELS
// ============================================================

export const PRIORITY_LEVELS = {
  URGENT: 'urgent',     // Must be addressed immediately
  HIGH: 'high',         // Important, should be addressed soon
  NORMAL: 'normal',     // Standard priority
  LOW: 'low',           // Can wait
  FLAVOR: 'flavor'      // Optional ambient content
};

// ============================================================
// DISPOSITION THRESHOLDS
// ============================================================

export const DISPOSITION_THRESHOLDS = {
  NEMESIS: -75,
  HOSTILE: -50,
  UNFRIENDLY: -25,
  NEUTRAL: 0,
  FRIENDLY: 25,
  ALLIED: 50,
  DEVOTED: 75
};

// ============================================================
// LOYALTY THRESHOLDS
// ============================================================

export const LOYALTY_THRESHOLDS = {
  HOSTILE: 10,
  DISTRUSTFUL: 25,
  UNCERTAIN: 50,
  TRUSTED: 75,
  LOYAL: 90,
  DEVOTED: 100
};

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Get disposition label from numeric value
 */
export function getDispositionLabel(value) {
  if (value >= DISPOSITION_THRESHOLDS.DEVOTED) return 'devoted';
  if (value >= DISPOSITION_THRESHOLDS.ALLIED) return 'allied';
  if (value >= DISPOSITION_THRESHOLDS.FRIENDLY) return 'friendly';
  if (value >= DISPOSITION_THRESHOLDS.UNFRIENDLY) return 'neutral';
  if (value >= DISPOSITION_THRESHOLDS.HOSTILE) return 'unfriendly';
  if (value >= DISPOSITION_THRESHOLDS.NEMESIS) return 'hostile';
  return 'nemesis';
}

/**
 * Get loyalty label from numeric value
 */
export function getLoyaltyLabel(value) {
  if (value >= LOYALTY_THRESHOLDS.DEVOTED) return 'devoted';
  if (value >= LOYALTY_THRESHOLDS.LOYAL) return 'loyal';
  if (value >= LOYALTY_THRESHOLDS.TRUSTED) return 'trusted';
  if (value >= LOYALTY_THRESHOLDS.UNCERTAIN) return 'uncertain';
  if (value >= LOYALTY_THRESHOLDS.DISTRUSTFUL) return 'distrustful';
  return 'hostile';
}

/**
 * Map game event to potential requirement types it could satisfy
 */
export function getRequirementTypesForEvent(eventType) {
  const mapping = {
    [GAME_EVENTS.ADVENTURE_COMPLETE]: [
      REQUIREMENT_TYPES.ADVENTURE_COMPLETED,
      REQUIREMENT_TYPES.ENEMY_DEFEATED,
      REQUIREMENT_TYPES.LOCATION_VISITED
    ],
    [GAME_EVENTS.STORY_THREAD_RESOLVED]: [
      REQUIREMENT_TYPES.STORY_THREAD_RESOLVED,
      REQUIREMENT_TYPES.INTEL_GATHERED
    ],
    [GAME_EVENTS.LOCATION_DISCOVERED]: [
      REQUIREMENT_TYPES.LOCATION_DISCOVERED
    ],
    [GAME_EVENTS.LOCATION_VISITED]: [
      REQUIREMENT_TYPES.LOCATION_VISITED
    ],
    [GAME_EVENTS.NPC_INTERACTION]: [
      REQUIREMENT_TYPES.NPC_MET
    ],
    [GAME_EVENTS.NPC_DISPOSITION_CHANGED]: [
      REQUIREMENT_TYPES.NPC_DISPOSITION
    ],
    [GAME_EVENTS.NPC_TRUST_CHANGED]: [
      REQUIREMENT_TYPES.NPC_TRUST
    ],
    [GAME_EVENTS.ITEM_OBTAINED]: [
      REQUIREMENT_TYPES.ITEM_OBTAINED
    ],
    [GAME_EVENTS.FACTION_STANDING_CHANGED]: [
      REQUIREMENT_TYPES.FACTION_STANDING
    ],
    [GAME_EVENTS.GAME_TIME_ADVANCED]: [
      REQUIREMENT_TYPES.TIME_PASSED
    ]
  };

  return mapping[eventType] || [];
}
