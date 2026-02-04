/**
 * Companion Trigger Checker
 *
 * Listens to game events and checks if any companion backstory threads
 * should be activated based on trigger keywords.
 */

import { on, GAME_EVENTS, emit } from './eventEmitter.js';
import { dbAll, dbGet } from '../database.js';
import * as companionBackstoryService from './companionBackstoryService.js';
import * as narrativeQueueService from './narrativeQueueService.js';

// Track if handlers are registered
let handlersRegistered = false;

/**
 * Initialize the companion trigger checker by registering event handlers
 */
export function initCompanionTriggerChecker() {
  if (handlersRegistered) {
    console.log('Companion trigger checker already initialized');
    return;
  }

  // Register handlers for events that might trigger companion backstories
  on(GAME_EVENTS.ADVENTURE_COMPLETE, handleAdventureComplete);
  on(GAME_EVENTS.LOCATION_DISCOVERED, handleLocationDiscovered);
  on(GAME_EVENTS.LOCATION_VISITED, handleLocationVisited);
  on(GAME_EVENTS.NPC_INTERACTION, handleNpcInteraction);
  on(GAME_EVENTS.STORY_THREAD_CREATED, handleStoryThreadCreated);
  on(GAME_EVENTS.DM_SESSION_ENDED, handleDmSessionEnded);

  // Also listen for loyalty changes to check for secret reveals
  on(GAME_EVENTS.COMPANION_LOYALTY_CHANGED, handleLoyaltyChanged);

  handlersRegistered = true;
  console.log('Companion trigger checker initialized');
}

/**
 * Check all active companions for trigger matches
 * @param {string} characterId - The character whose companions to check
 * @param {object} context - Context containing content to match against
 * @returns {object} - Results of the check
 */
export async function checkCompanionTriggers(characterId, context) {
  const results = {
    threadsActivated: [],
    secretsRevealed: []
  };

  // Get all active companions for this character
  const companions = await dbAll(`
    SELECT c.*, cb.unresolved_threads, cb.loyalty, cb.secrets
    FROM companions c
    LEFT JOIN companion_backstories cb ON c.id = cb.companion_id
    WHERE c.recruited_by_character_id = ? AND c.status = 'active'
  `, [characterId]);

  for (const companion of companions) {
    // Skip if no backstory
    if (!companion.unresolved_threads) continue;

    const threads = JSON.parse(companion.unresolved_threads || '[]');
    const dormantThreads = threads.filter(t => t.status === 'dormant');

    for (const thread of dormantThreads) {
      const isTriggered = checkTriggerMatch(thread, context);

      if (isTriggered) {
        // Activate the thread
        await companionBackstoryService.activateThread(companion.id, thread.id);

        // Get companion name from NPC table
        const npc = await dbGet('SELECT name FROM npcs WHERE id = ?', [companion.npc_id]);
        const companionName = npc?.name || 'Companion';

        results.threadsActivated.push({
          companion_id: companion.id,
          companion_name: companionName,
          thread_id: thread.id,
          thread_type: thread.type,
          thread_description: thread.description,
          intensity: thread.intensity
        });

        // Add to narrative queue
        await narrativeQueueService.addCompanionReaction(
          characterId,
          { id: companion.id, name: companionName },
          thread,
          context
        );

        // Emit companion thread activated event
        await emit(GAME_EVENTS.COMPANION_THREAD_ACTIVATED, {
          character_id: characterId,
          companion_id: companion.id,
          companion_name: companionName,
          thread,
          trigger_context: context
        });

        console.log(`Companion thread activated: ${companionName} - "${thread.description}"`);
      }
    }
  }

  return results;
}

/**
 * Check if a thread's triggers match the given context
 * @param {object} thread - The thread with activation_triggers
 * @param {object} context - The context to match against
 * @returns {boolean} - Whether any trigger matches
 */
function checkTriggerMatch(thread, context) {
  const triggers = thread.activation_triggers || [];
  if (triggers.length === 0) return false;

  for (const trigger of triggers) {
    const triggerLower = trigger.toLowerCase();

    // Check against content text (adventure description, session text, etc.)
    if (context.content) {
      if (context.content.toLowerCase().includes(triggerLower)) {
        return true;
      }
    }

    // Check against tags
    if (context.tags && Array.isArray(context.tags)) {
      if (context.tags.some(t => t.toLowerCase().includes(triggerLower))) {
        return true;
      }
    }

    // Check against location name
    if (context.location_name) {
      if (context.location_name.toLowerCase().includes(triggerLower)) {
        return true;
      }
    }

    // Check against location tags
    if (context.location_tags && Array.isArray(context.location_tags)) {
      if (context.location_tags.some(t => t.toLowerCase().includes(triggerLower))) {
        return true;
      }
    }

    // Check against NPC name
    if (context.npc_name) {
      if (context.npc_name.toLowerCase().includes(triggerLower)) {
        return true;
      }
    }

    // Check against region
    if (context.region) {
      if (context.region.toLowerCase().includes(triggerLower)) {
        return true;
      }
    }

    // Check against activity type
    if (context.activity_type) {
      if (context.activity_type.toLowerCase().includes(triggerLower)) {
        return true;
      }
    }

    // Check against thread/story content
    if (context.thread_title) {
      if (context.thread_title.toLowerCase().includes(triggerLower)) {
        return true;
      }
    }

    if (context.thread_description) {
      if (context.thread_description.toLowerCase().includes(triggerLower)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Check for secret reveals based on loyalty level
 * @param {string} companionId - The companion to check
 * @param {number} newLoyalty - The new loyalty level
 */
async function checkSecretReveals(companionId, newLoyalty) {
  const revealedSecrets = await companionBackstoryService.checkSecretReveals(
    companionId,
    newLoyalty
  );

  if (revealedSecrets.length > 0) {
    // Get companion info
    const companion = await dbGet(`
      SELECT c.*, n.name as companion_name
      FROM companions c
      JOIN npcs n ON c.npc_id = n.id
      WHERE c.id = ?
    `, [companionId]);

    for (const secret of revealedSecrets) {
      // Add to narrative queue
      await narrativeQueueService.addSecretRevealed(
        companion.recruited_by_character_id,
        { id: companionId, name: companion.companion_name },
        secret
      );

      // Emit event
      await emit(GAME_EVENTS.COMPANION_SECRET_REVEALED, {
        character_id: companion.recruited_by_character_id,
        companion_id: companionId,
        companion_name: companion.companion_name,
        secret
      });

      console.log(`Companion secret revealed: ${companion.companion_name} - "${secret.content}"`);
    }
  }

  return revealedSecrets;
}

// ============================================================
// EVENT HANDLERS
// ============================================================

async function handleAdventureComplete(event) {
  const { character_id, title, description, location, tags, activity_type, location_id } = event.data;
  if (!character_id) return;

  // Get location details if we have an ID
  let locationInfo = {};
  if (location_id) {
    const loc = await dbGet('SELECT * FROM locations WHERE id = ?', [location_id]);
    if (loc) {
      locationInfo = {
        location_name: loc.name,
        location_tags: JSON.parse(loc.tags || '[]'),
        region: loc.region
      };
    }
  }

  return checkCompanionTriggers(character_id, {
    content: `${title || ''} ${description || ''}`,
    tags: tags || [],
    activity_type,
    location_name: location || locationInfo.location_name,
    ...locationInfo
  });
}

async function handleLocationDiscovered(event) {
  const { character_id, location_name, location_tags, region, location_type } = event.data;
  if (!character_id) return;

  return checkCompanionTriggers(character_id, {
    location_name,
    location_tags: location_tags || [],
    region,
    content: `Discovered ${location_name}. ${location_type || ''}`
  });
}

async function handleLocationVisited(event) {
  const { character_id, location_name, location_tags, region } = event.data;
  if (!character_id) return;

  return checkCompanionTriggers(character_id, {
    location_name,
    location_tags: location_tags || [],
    region,
    content: `Visited ${location_name}`
  });
}

async function handleNpcInteraction(event) {
  const { character_id, npc_name, npc_role, npc_tags, interaction_content } = event.data;
  if (!character_id) return;

  return checkCompanionTriggers(character_id, {
    npc_name,
    tags: npc_tags || [],
    content: `Interaction with ${npc_name}. ${npc_role || ''} ${interaction_content || ''}`
  });
}

async function handleStoryThreadCreated(event) {
  const { character_id, title, description, type, related_npcs, related_locations } = event.data;
  if (!character_id) return;

  return checkCompanionTriggers(character_id, {
    thread_title: title,
    thread_description: description,
    content: `${title} ${description}`,
    tags: [type, ...(related_npcs || []), ...(related_locations || [])]
  });
}

async function handleDmSessionEnded(event) {
  const { character_id, summary, messages } = event.data;
  if (!character_id) return;

  // Extract content from session for trigger matching
  let sessionContent = summary || '';
  if (messages && Array.isArray(messages)) {
    // Get the last few messages for context
    const recentMessages = messages.slice(-10);
    sessionContent += ' ' + recentMessages
      .filter(m => m.role === 'assistant')
      .map(m => m.content)
      .join(' ');
  }

  return checkCompanionTriggers(character_id, {
    content: sessionContent
  });
}

async function handleLoyaltyChanged(event) {
  const { companion_id, new_loyalty } = event.data;
  if (!companion_id) return;

  return checkSecretReveals(companion_id, new_loyalty);
}

// Export for manual triggering if needed
export { checkTriggerMatch, checkSecretReveals };
