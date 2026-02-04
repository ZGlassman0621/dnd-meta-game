/**
 * Quest Progress Checker
 *
 * Listens to game events and checks if any quest requirements are satisfied.
 * When requirements are met, it updates quest progress and may advance quest stages.
 */

import { dbAll, dbGet, dbRun } from '../database.js';
import { on, GAME_EVENTS } from './eventEmitter.js';
import { REQUIREMENT_TYPES, getRequirementTypesForEvent } from '../config/eventTypes.js';
import * as questService from './questService.js';
import * as narrativeQueueService from './narrativeQueueService.js';

// Track if handlers are registered
let handlersRegistered = false;

/**
 * Initialize the quest progress checker by registering event handlers
 */
export function initQuestProgressChecker() {
  if (handlersRegistered) {
    console.log('Quest progress checker already initialized');
    return;
  }

  // Register handlers for events that can satisfy requirements
  on(GAME_EVENTS.ADVENTURE_COMPLETE, handleAdventureComplete);
  on(GAME_EVENTS.STORY_THREAD_RESOLVED, handleStoryThreadResolved);
  on(GAME_EVENTS.LOCATION_DISCOVERED, handleLocationDiscovered);
  on(GAME_EVENTS.LOCATION_VISITED, handleLocationVisited);
  on(GAME_EVENTS.NPC_INTERACTION, handleNpcInteraction);
  on(GAME_EVENTS.NPC_DISPOSITION_CHANGED, handleNpcDispositionChanged);
  on(GAME_EVENTS.ITEM_OBTAINED, handleItemObtained);
  on(GAME_EVENTS.FACTION_STANDING_CHANGED, handleFactionStandingChanged);
  on(GAME_EVENTS.GAME_TIME_ADVANCED, handleGameTimeAdvanced);

  handlersRegistered = true;
  console.log('Quest progress checker initialized');
}

/**
 * Check all active quests for a character against an event
 * @param {string} characterId - The character to check quests for
 * @param {object} event - The event that occurred
 * @returns {object} - Results of the check
 */
export async function checkQuestProgress(characterId, event) {
  const results = {
    requirementsCompleted: [],
    stagesAdvanced: [],
    questsCompleted: []
  };

  // Get all active quests for this character
  const activeQuests = await questService.getActiveQuests(characterId);

  for (const quest of activeQuests) {
    // Get incomplete requirements for the current stage
    const requirements = await questService.getIncompleteStageRequirements(
      quest.id,
      quest.current_stage
    );

    for (const req of requirements) {
      const isSatisfied = await checkRequirement(req, event);

      if (isSatisfied) {
        // Mark requirement as complete
        await questService.completeRequirement(req.id, {
          event_type: event.type,
          event_data: event.data,
          completed_at: event.timestamp
        });

        results.requirementsCompleted.push({
          quest_id: quest.id,
          quest_title: quest.title,
          requirement_id: req.id,
          requirement_description: req.description
        });

        console.log(`Requirement completed: "${req.description}" for quest "${quest.title}"`);
      }
    }

    // Check if the stage is now complete
    const stageComplete = await questService.isStageComplete(quest.id, quest.current_stage);

    if (stageComplete) {
      // Advance to next stage
      const updatedQuest = await questService.advanceQuestStage(quest.id);

      if (updatedQuest.status === 'completed') {
        results.questsCompleted.push({
          quest_id: quest.id,
          quest_title: quest.title,
          quest_type: quest.quest_type
        });

        // Add quest completion to narrative queue
        await narrativeQueueService.addQuestCompleted(characterId, updatedQuest);

        console.log(`Quest completed: "${quest.title}"`);
      } else {
        results.stagesAdvanced.push({
          quest_id: quest.id,
          quest_title: quest.title,
          new_stage: updatedQuest.current_stage,
          stage_name: updatedQuest.stages[updatedQuest.current_stage]?.name
        });

        // Add stage advancement to narrative queue
        const newStage = updatedQuest.stages[updatedQuest.current_stage];
        const previousStage = updatedQuest.stages[updatedQuest.current_stage - 1];
        await narrativeQueueService.addQuestStageAdvanced(
          characterId,
          updatedQuest,
          newStage,
          previousStage
        );

        console.log(`Quest stage advanced: "${quest.title}" -> Stage ${updatedQuest.current_stage}`);
      }
    }
  }

  return results;
}

/**
 * Check if a requirement is satisfied by an event
 * @param {object} requirement - The requirement to check
 * @param {object} event - The event data
 * @returns {boolean} - Whether the requirement is satisfied
 */
async function checkRequirement(requirement, event) {
  const params = requirement.params || {};
  const eventData = event.data || {};

  switch (requirement.requirement_type) {
    case REQUIREMENT_TYPES.ADVENTURE_COMPLETED:
      return checkAdventureCompleted(params, eventData);

    case REQUIREMENT_TYPES.ENEMY_DEFEATED:
      return checkEnemyDefeated(params, eventData);

    case REQUIREMENT_TYPES.STORY_THREAD_RESOLVED:
      return checkStoryThreadResolved(params, eventData);

    case REQUIREMENT_TYPES.INTEL_GATHERED:
      return checkIntelGathered(params, eventData);

    case REQUIREMENT_TYPES.LOCATION_DISCOVERED:
      return checkLocationDiscovered(params, eventData);

    case REQUIREMENT_TYPES.LOCATION_VISITED:
      return checkLocationVisited(params, eventData);

    case REQUIREMENT_TYPES.NPC_MET:
      return checkNpcMet(params, eventData);

    case REQUIREMENT_TYPES.NPC_DISPOSITION:
      return checkNpcDisposition(params, eventData);

    case REQUIREMENT_TYPES.NPC_TRUST:
      return checkNpcTrust(params, eventData);

    case REQUIREMENT_TYPES.ITEM_OBTAINED:
      return checkItemObtained(params, eventData);

    case REQUIREMENT_TYPES.FACTION_STANDING:
      return checkFactionStanding(params, eventData);

    case REQUIREMENT_TYPES.TIME_PASSED:
      return checkTimePassed(params, eventData);

    case REQUIREMENT_TYPES.CUSTOM:
      return checkCustomRequirement(params, eventData);

    default:
      console.warn(`Unknown requirement type: ${requirement.requirement_type}`);
      return false;
  }
}

// ============================================================
// REQUIREMENT CHECKERS
// ============================================================

function checkAdventureCompleted(params, eventData) {
  if (!eventData.success) return false;

  // Check by adventure tag
  if (params.adventure_tag) {
    const tags = eventData.tags || [];
    return tags.some(t => t.toLowerCase().includes(params.adventure_tag.toLowerCase()));
  }

  // Check by activity type
  if (params.activity_type) {
    return eventData.activity_type === params.activity_type;
  }

  // Check by risk level
  if (params.risk_level) {
    return eventData.risk_level === params.risk_level;
  }

  // Check by location
  if (params.location_id) {
    return eventData.location_id === params.location_id;
  }

  // Generic adventure completion
  return true;
}

function checkEnemyDefeated(params, eventData) {
  if (!eventData.success) return false;

  const tags = eventData.tags || [];

  // Check by enemy tag
  if (params.enemy_tag) {
    return tags.some(t => t.toLowerCase().includes(params.enemy_tag.toLowerCase()));
  }

  // Check by enemy type
  if (params.enemy_type) {
    return tags.some(t => t.toLowerCase().includes(params.enemy_type.toLowerCase()));
  }

  return false;
}

function checkStoryThreadResolved(params, eventData) {
  const thread = eventData.thread || {};

  // Check by thread type
  if (params.thread_type && thread.type !== params.thread_type) {
    return false;
  }

  // Check by consequence category
  if (params.consequence_category && thread.consequence_category !== params.consequence_category) {
    return false;
  }

  // Check by related content
  if (params.related_to) {
    const searchText = `${thread.title || ''} ${thread.description || ''}`.toLowerCase();
    if (!searchText.includes(params.related_to.toLowerCase())) {
      return false;
    }
  }

  return true;
}

function checkIntelGathered(params, eventData) {
  const thread = eventData.thread || {};

  // Intel must be from a story thread of type 'intel'
  if (thread.type !== 'intel' && thread.consequence_category !== 'intel') {
    return false;
  }

  // Check if it's about the right subject
  if (params.related_to) {
    const searchText = `${thread.title || ''} ${thread.description || ''}`.toLowerCase();
    return searchText.includes(params.related_to.toLowerCase());
  }

  return true;
}

function checkLocationDiscovered(params, eventData) {
  // Check by specific location ID
  if (params.location_id) {
    return eventData.location_id === params.location_id;
  }

  // Check by location tags
  if (params.location_tags) {
    const eventTags = eventData.location_tags || [];
    return params.location_tags.some(pt =>
      eventTags.some(et => et.toLowerCase().includes(pt.toLowerCase()))
    );
  }

  // Check by location type
  if (params.location_type) {
    return eventData.location_type === params.location_type;
  }

  // Check by location name pattern
  if (params.location_name_contains) {
    const name = eventData.location_name || '';
    return name.toLowerCase().includes(params.location_name_contains.toLowerCase());
  }

  // Check by region
  if (params.region) {
    return eventData.region === params.region;
  }

  return true;
}

function checkLocationVisited(params, eventData) {
  // Same logic as discovered, but for visits
  return checkLocationDiscovered(params, eventData);
}

function checkNpcMet(params, eventData) {
  // Check by specific NPC ID
  if (params.npc_id) {
    return eventData.npc_id === params.npc_id;
  }

  // Check by NPC tags
  if (params.npc_tags) {
    const eventTags = eventData.npc_tags || [];
    return params.npc_tags.some(pt =>
      eventTags.some(et => et.toLowerCase().includes(pt.toLowerCase()))
    );
  }

  // Check by NPC role/occupation
  if (params.npc_role) {
    const role = eventData.npc_role || eventData.npc_occupation || '';
    return role.toLowerCase().includes(params.npc_role.toLowerCase());
  }

  // Check by NPC name pattern
  if (params.npc_name_contains) {
    const name = eventData.npc_name || '';
    return name.toLowerCase().includes(params.npc_name_contains.toLowerCase());
  }

  return true;
}

function checkNpcDisposition(params, eventData) {
  // Check by specific NPC
  if (params.npc_id && eventData.npc_id !== params.npc_id) {
    return false;
  }

  // Check minimum disposition
  if (params.min_disposition !== undefined) {
    return eventData.new_disposition >= params.min_disposition;
  }

  return false;
}

function checkNpcTrust(params, eventData) {
  // Check by specific NPC
  if (params.npc_id && eventData.npc_id !== params.npc_id) {
    return false;
  }

  // Check minimum trust
  if (params.min_trust !== undefined) {
    return eventData.new_trust >= params.min_trust;
  }

  return false;
}

function checkItemObtained(params, eventData) {
  // Check by specific item ID
  if (params.item_id) {
    return eventData.item_id === params.item_id;
  }

  // Check by item tags
  if (params.item_tags) {
    const eventTags = eventData.item_tags || [];
    return params.item_tags.some(pt =>
      eventTags.some(et => et.toLowerCase().includes(pt.toLowerCase()))
    );
  }

  // Check by item name pattern
  if (params.item_name_contains) {
    const name = eventData.item_name || '';
    return name.toLowerCase().includes(params.item_name_contains.toLowerCase());
  }

  // Check by item type
  if (params.item_type) {
    return eventData.item_type === params.item_type;
  }

  return true;
}

function checkFactionStanding(params, eventData) {
  // Check by specific faction
  if (params.faction_id && eventData.faction_id !== params.faction_id) {
    return false;
  }

  // Check minimum standing
  if (params.min_standing !== undefined) {
    return eventData.new_standing >= params.min_standing;
  }

  return false;
}

function checkTimePassed(params, eventData) {
  // This would need to track cumulative time
  // For now, check if a certain amount of in-game time has passed
  if (params.hours_passed !== undefined) {
    return eventData.hours_elapsed >= params.hours_passed;
  }

  if (params.days_passed !== undefined) {
    return eventData.days_elapsed >= params.days_passed;
  }

  return false;
}

function checkCustomRequirement(params, eventData) {
  // Custom requirements can define their own matching logic
  if (params.event_type && eventData.type !== params.event_type) {
    return false;
  }

  // Check for required fields
  if (params.required_fields) {
    for (const field of params.required_fields) {
      if (eventData[field] === undefined) {
        return false;
      }
    }
  }

  // Check for required values
  if (params.required_values) {
    for (const [key, value] of Object.entries(params.required_values)) {
      if (eventData[key] !== value) {
        return false;
      }
    }
  }

  return true;
}

// ============================================================
// EVENT HANDLERS
// ============================================================

async function handleAdventureComplete(event) {
  const { character_id } = event.data;
  if (!character_id) return;

  return checkQuestProgress(character_id, event);
}

async function handleStoryThreadResolved(event) {
  const { character_id } = event.data;
  if (!character_id) return;

  return checkQuestProgress(character_id, event);
}

async function handleLocationDiscovered(event) {
  const { character_id } = event.data;
  if (!character_id) return;

  return checkQuestProgress(character_id, event);
}

async function handleLocationVisited(event) {
  const { character_id } = event.data;
  if (!character_id) return;

  return checkQuestProgress(character_id, event);
}

async function handleNpcInteraction(event) {
  const { character_id } = event.data;
  if (!character_id) return;

  return checkQuestProgress(character_id, event);
}

async function handleNpcDispositionChanged(event) {
  const { character_id } = event.data;
  if (!character_id) return;

  return checkQuestProgress(character_id, event);
}

async function handleItemObtained(event) {
  const { character_id } = event.data;
  if (!character_id) return;

  return checkQuestProgress(character_id, event);
}

async function handleFactionStandingChanged(event) {
  const { character_id } = event.data;
  if (!character_id) return;

  return checkQuestProgress(character_id, event);
}

async function handleGameTimeAdvanced(event) {
  const { character_id } = event.data;
  if (!character_id) return;

  return checkQuestProgress(character_id, event);
}

// Export for manual triggering if needed
export { checkRequirement };
