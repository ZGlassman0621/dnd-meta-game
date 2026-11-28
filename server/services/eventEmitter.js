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
 * Clear event history
 */
export function clearEventHistory() {
  eventHistory.length = 0;
}

// Export the GAME_EVENTS for convenience
export { GAME_EVENTS };
