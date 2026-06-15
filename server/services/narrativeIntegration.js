/**
 * Narrative Integration Service
 *
 * Provides integration functions that connect the new narrative systems
 * (quests, locations, companion backstories, event emitter) with the
 * existing codebase (adventures, story threads, DM sessions, companions).
 *
 * This service is designed to be called from existing routes/services
 * without requiring major refactoring.
 */

import { emit, GAME_EVENTS } from './eventEmitter.js';
import * as companionBackstoryGenerator from './companionBackstoryGenerator.js';
import * as companionBackstoryService from './companionBackstoryService.js';

// ============================================================
// ADVENTURE INTEGRATION
// ============================================================

/**
 * Emit adventure completion event and check for quest progress
 * Call this after an adventure is completed and results are processed
 *
 * @param {object} adventure - The completed adventure
 * @param {object} results - Adventure results (success, rewards, narrative)
 * @param {object} character - The character who completed the adventure
 */
export async function onAdventureComplete(adventure, results, character) {
  // Adventure system archived in MVP reduction — no-op (export retained).
  return null;
}

/**
 * Emit adventure started event
 */
export async function onAdventureStarted(adventure, character) {
  // Adventure system archived in MVP reduction — no-op (export retained).
}

// ============================================================
// STORY THREAD INTEGRATION
// ============================================================

/**
 * Emit story thread created event
 * Call this after creating a story thread
 */
export async function onStoryThreadCreated(thread, characterId) {
  // Story threads cluster archived in MVP reduction — no-op (export retained).
}

/**
 * Emit story thread resolved event
 * Call this after resolving a story thread
 */
export async function onStoryThreadResolved(thread, characterId, resolution) {
  // Story threads cluster archived in MVP reduction — no-op (export retained).
}

// ============================================================
// DM SESSION INTEGRATION
// ============================================================

/**
 * Get narrative context for a DM session start
 * Returns pending narrative queue items formatted for the AI context
 *
 * @param {string} characterId - The character starting the session
 * @param {string} campaignId - Optional campaign ID
 * @returns {object} Narrative context to include in session
 */
export async function getNarrativeContextForSession(characterId, campaignId = null) {
  // Narrative queue system removed in MVP reduction — return empty context.
  return {
    narrativeQueueItems: [],
    formattedContext: '',
    itemCount: 0
  };
}

/**
 * Mark narrative queue items as delivered after session starts
 *
 * @param {array} itemIds - IDs of items to mark as delivered
 * @param {number} sessionId - The DM session ID
 */
export async function markNarrativeItemsDelivered(itemIds, sessionId) {
  // Narrative queue system removed in MVP reduction — no-op.
}

/**
 * Emit DM session started event
 */
export async function onDMSessionStarted(session, character) {
  await emit(GAME_EVENTS.DM_SESSION_STARTED, {
    character_id: character.id,
    session_id: session.id
  });
}

/**
 * Emit DM session ended event
 */
export async function onDMSessionEnded(session, character, summary, messages) {
  await emit(GAME_EVENTS.DM_SESSION_ENDED, {
    character_id: character.id,
    session_id: session.id,
    summary,
    messages
  });
}

// ============================================================
// COMPANION INTEGRATION
// ============================================================

/**
 * Generate and create a backstory for a newly recruited companion
 * Call this after a companion is recruited
 *
 * @param {object} companion - The companion data (with npc info)
 * @param {object} character - The recruiting character
 * @param {object} campaign - Optional campaign data
 * @returns {object} The created backstory
 */
export async function onCompanionRecruited(companion, character, campaign = null) {
  // Emit companion recruited event
  await emit(GAME_EVENTS.COMPANION_RECRUITED, {
    character_id: character.id,
    companion_id: companion.id,
    companion_name: companion.name,
    companion_race: companion.race,
    companion_class: companion.companion_class
  });

  // Check if companion already has a backstory
  const existingBackstory = await companionBackstoryService.getBackstoryByCompanionId(companion.id);
  if (existingBackstory) {
    return existingBackstory;
  }

  // Generate a backstory for the companion
  try {
    const backstoryData = await companionBackstoryGenerator.generateBackstory({
      companion,
      character,
      campaign
    });

    // Create the backstory in the database
    const backstory = await companionBackstoryService.createBackstory({
      companion_id: companion.id,
      ...backstoryData
    });

    return backstory;
  } catch (error) {
    console.error('Failed to generate companion backstory:', error);
    // Don't fail the recruitment if backstory generation fails
    return null;
  }
}

/**
 * Handle companion loyalty change and check for secret reveals
 */
export async function onCompanionLoyaltyChanged(companionId, oldLoyalty, newLoyalty, reason) {
  await emit(GAME_EVENTS.COMPANION_LOYALTY_CHANGED, {
    companion_id: companionId,
    old_loyalty: oldLoyalty,
    new_loyalty: newLoyalty,
    reason
  });
}

/**
 * Handle companion dismissal
 */
export async function onCompanionDismissed(companion, character) {
  await emit(GAME_EVENTS.COMPANION_DISMISSED, {
    character_id: character.id,
    companion_id: companion.id,
    companion_name: companion.name
  });
}

// ============================================================
// LOCATION INTEGRATION
// ============================================================

/**
 * Emit location discovered event
 * Call this when a character discovers a new location
 */
export async function onLocationDiscovered(characterId, location) {
  const eventData = {
    character_id: characterId,
    location_id: location.id,
    location_name: location.name,
    location_type: location.location_type,
    location_tags: parseTags(location.tags),
    region: location.region
  };

  await emit(GAME_EVENTS.LOCATION_DISCOVERED, eventData);

  // Location-driven quest generation removed in MVP reduction (quest/location
  // services archived). Event emission retained for kept consumers.
}

/**
 * Emit location visited event
 */
export async function emitLocationVisited(characterId, locationName, locationId = null) {
  // Location persistence service archived in MVP reduction — emit with the
  // location name only (no DB lookup / visit-count update).
  await emit(GAME_EVENTS.LOCATION_VISITED, {
    character_id: characterId,
    location_name: locationName
  });
}

// ============================================================
// NPC INTEGRATION
// ============================================================

/**
 * Emit NPC interaction event
 */
export async function onNpcInteraction(characterId, npc, interactionContent) {
  await emit(GAME_EVENTS.NPC_INTERACTION, {
    character_id: characterId,
    npc_id: npc.id,
    npc_name: npc.name,
    npc_role: npc.occupation,
    npc_tags: parseTags(npc.tags),
    interaction_content: interactionContent
  });
}

/**
 * Emit NPC disposition changed event
 */
export async function onNpcDispositionChanged(characterId, npcId, oldDisposition, newDisposition) {
  await emit(GAME_EVENTS.NPC_DISPOSITION_CHANGED, {
    character_id: characterId,
    npc_id: npcId,
    old_disposition: oldDisposition,
    new_disposition: newDisposition
  });
}

// ============================================================
// ITEM INTEGRATION
// ============================================================

/**
 * Emit item obtained event
 */
export async function onItemObtained(characterId, item) {
  await emit(GAME_EVENTS.ITEM_OBTAINED, {
    character_id: characterId,
    item_id: item.id,
    item_name: item.name,
    item_type: item.type,
    item_tags: parseTags(item.tags)
  });
}

// ============================================================
// TIME INTEGRATION
// ============================================================

/**
 * Emit game time advanced event
 */
export async function onGameTimeAdvanced(characterId, hoursElapsed, daysElapsed, newDay, newYear, newHour) {
  await emit(GAME_EVENTS.GAME_TIME_ADVANCED, {
    character_id: characterId,
    hours_elapsed: hoursElapsed,
    days_elapsed: daysElapsed,
    new_day: newDay,
    new_year: newYear,
    new_hour: newHour
  });
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function parseTags(tags) {
  if (!tags) return [];
  if (Array.isArray(tags)) return tags;
  if (typeof tags === 'string') {
    try {
      return JSON.parse(tags);
    } catch {
      return tags.split(',').map(t => t.trim());
    }
  }
  return [];
}

export default {
  // Adventure
  onAdventureComplete,
  onAdventureStarted,

  // Story Threads
  onStoryThreadCreated,
  onStoryThreadResolved,

  // DM Sessions
  getNarrativeContextForSession,
  markNarrativeItemsDelivered,
  onDMSessionStarted,
  onDMSessionEnded,

  // Companions
  onCompanionRecruited,
  onCompanionLoyaltyChanged,
  onCompanionDismissed,

  // Locations
  onLocationDiscovered,
  emitLocationVisited,

  // NPCs
  onNpcInteraction,
  onNpcDispositionChanged,

  // Items
  onItemObtained,

  // Time
  onGameTimeAdvanced
};
