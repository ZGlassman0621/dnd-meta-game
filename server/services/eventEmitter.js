/**
 * Event Emitter Service
 * Central event bus for the narrative systems
 *
 * This allows different parts of the application to communicate
 * without tight coupling. When something happens (adventure completes,
 * NPC interaction, etc.), an event is emitted and any registered
 * handlers can respond to it.
 */

import { GAME_EVENTS, getRequirementTypesForEvent } from '../config/eventTypes.js';

// Store for event handlers
const handlers = new Map();

// Store for one-time handlers
const onceHandlers = new Map();

// Event history for debugging (keeps last N events)
const eventHistory = [];
const MAX_HISTORY = 100;

/**
 * Register a handler for an event type
 * @param {string} eventType - The event type to listen for
 * @param {Function} handler - The handler function (receives event data)
 * @returns {Function} - Unsubscribe function
 */
export function on(eventType, handler) {
  if (!handlers.has(eventType)) {
    handlers.set(eventType, new Set());
  }
  handlers.get(eventType).add(handler);

  // Return unsubscribe function
  return () => off(eventType, handler);
}

/**
 * Register a one-time handler (automatically removed after first call)
 * @param {string} eventType - The event type to listen for
 * @param {Function} handler - The handler function
 * @returns {Function} - Unsubscribe function
 */
export function once(eventType, handler) {
  if (!onceHandlers.has(eventType)) {
    onceHandlers.set(eventType, new Set());
  }
  onceHandlers.get(eventType).add(handler);

  return () => {
    const typeHandlers = onceHandlers.get(eventType);
    if (typeHandlers) {
      typeHandlers.delete(handler);
    }
  };
}

/**
 * Remove a handler for an event type
 * @param {string} eventType - The event type
 * @param {Function} handler - The handler to remove
 */
export function off(eventType, handler) {
  const typeHandlers = handlers.get(eventType);
  if (typeHandlers) {
    typeHandlers.delete(handler);
  }
}

/**
 * Emit an event
 * @param {string} eventType - The event type
 * @param {object} data - Event data
 * @returns {Promise<Array>} - Results from all handlers
 */
export async function emit(eventType, data = {}) {
  const event = {
    type: eventType,
    data,
    timestamp: new Date().toISOString(),
    id: `${eventType}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  };

  // Add to history
  eventHistory.push(event);
  if (eventHistory.length > MAX_HISTORY) {
    eventHistory.shift();
  }

  const results = [];

  // Call regular handlers
  const typeHandlers = handlers.get(eventType);
  if (typeHandlers) {
    for (const handler of typeHandlers) {
      try {
        const result = await handler(event);
        results.push({ handler: handler.name || 'anonymous', result, success: true });
      } catch (error) {
        console.error(`Event handler error for ${eventType}:`, error);
        results.push({ handler: handler.name || 'anonymous', error: error.message, success: false });
      }
    }
  }

  // Call one-time handlers
  const typeOnceHandlers = onceHandlers.get(eventType);
  if (typeOnceHandlers) {
    for (const handler of typeOnceHandlers) {
      try {
        const result = await handler(event);
        results.push({ handler: handler.name || 'anonymous', result, success: true });
      } catch (error) {
        console.error(`One-time event handler error for ${eventType}:`, error);
        results.push({ handler: handler.name || 'anonymous', error: error.message, success: false });
      }
    }
    // Clear one-time handlers after execution
    onceHandlers.delete(eventType);
  }

  // Call wildcard handlers (listen to all events)
  const wildcardHandlers = handlers.get('*');
  if (wildcardHandlers) {
    for (const handler of wildcardHandlers) {
      try {
        const result = await handler(event);
        results.push({ handler: handler.name || 'anonymous', result, success: true });
      } catch (error) {
        console.error(`Wildcard event handler error:`, error);
        results.push({ handler: handler.name || 'anonymous', error: error.message, success: false });
      }
    }
  }

  return results;
}

/**
 * Get all registered event types
 * @returns {string[]} - Array of event types with handlers
 */
export function getRegisteredEventTypes() {
  return Array.from(handlers.keys());
}

/**
 * Get handler count for an event type
 * @param {string} eventType - The event type
 * @returns {number} - Number of handlers
 */
export function getHandlerCount(eventType) {
  const typeHandlers = handlers.get(eventType);
  const typeOnceHandlers = onceHandlers.get(eventType);
  return (typeHandlers?.size || 0) + (typeOnceHandlers?.size || 0);
}

/**
 * Get recent event history
 * @param {number} count - Number of events to return
 * @returns {object[]} - Recent events
 */
export function getEventHistory(count = 10) {
  return eventHistory.slice(-count);
}

/**
 * Get events of a specific type from history
 * @param {string} eventType - The event type
 * @param {number} count - Number of events to return
 * @returns {object[]} - Matching events
 */
export function getEventsByType(eventType, count = 10) {
  return eventHistory
    .filter(e => e.type === eventType)
    .slice(-count);
}

/**
 * Clear all handlers (useful for testing)
 */
export function clearAllHandlers() {
  handlers.clear();
  onceHandlers.clear();
}

/**
 * Clear event history
 */
export function clearEventHistory() {
  eventHistory.length = 0;
}

// ============================================================
// CONVENIENCE EMIT FUNCTIONS
// ============================================================

/**
 * Emit an adventure complete event
 */
export async function emitAdventureComplete(adventureData) {
  return emit(GAME_EVENTS.ADVENTURE_COMPLETE, adventureData);
}

/**
 * Emit a story thread resolved event
 */
export async function emitStoryThreadResolved(threadData) {
  return emit(GAME_EVENTS.STORY_THREAD_RESOLVED, threadData);
}

/**
 * Emit a location discovered event
 */
export async function emitLocationDiscovered(locationData) {
  return emit(GAME_EVENTS.LOCATION_DISCOVERED, locationData);
}

/**
 * Emit an NPC interaction event
 */
export async function emitNpcInteraction(interactionData) {
  return emit(GAME_EVENTS.NPC_INTERACTION, interactionData);
}

/**
 * Emit an NPC disposition changed event
 */
export async function emitNpcDispositionChanged(dispositionData) {
  return emit(GAME_EVENTS.NPC_DISPOSITION_CHANGED, dispositionData);
}

/**
 * Emit an item obtained event
 */
export async function emitItemObtained(itemData) {
  return emit(GAME_EVENTS.ITEM_OBTAINED, itemData);
}

/**
 * Emit a faction standing changed event
 */
export async function emitFactionStandingChanged(factionData) {
  return emit(GAME_EVENTS.FACTION_STANDING_CHANGED, factionData);
}

/**
 * Emit a companion loyalty changed event
 */
export async function emitCompanionLoyaltyChanged(loyaltyData) {
  return emit(GAME_EVENTS.COMPANION_LOYALTY_CHANGED, loyaltyData);
}

/**
 * Emit a companion secret revealed event
 */
export async function emitCompanionSecretRevealed(secretData) {
  return emit(GAME_EVENTS.COMPANION_SECRET_REVEALED, secretData);
}

/**
 * Emit a companion thread activated event
 */
export async function emitCompanionThreadActivated(threadData) {
  return emit(GAME_EVENTS.COMPANION_THREAD_ACTIVATED, threadData);
}

/**
 * Emit a game time advanced event
 */
export async function emitGameTimeAdvanced(timeData) {
  return emit(GAME_EVENTS.GAME_TIME_ADVANCED, timeData);
}

// Export the GAME_EVENTS for convenience
export { GAME_EVENTS };
