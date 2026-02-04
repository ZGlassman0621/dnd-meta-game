/**
 * Narrative Systems Initialization
 *
 * This module initializes all the narrative system event handlers
 * when the server starts. It should be called once after database
 * initialization.
 */

import { initQuestProgressChecker } from './questProgressChecker.js';
import { initCompanionTriggerChecker } from './companionTriggerChecker.js';
import { on, GAME_EVENTS } from './eventEmitter.js';

let initialized = false;

/**
 * Initialize all narrative system event handlers
 */
export function initNarrativeSystems() {
  if (initialized) {
    console.log('Narrative systems already initialized');
    return;
  }

  console.log('Initializing narrative systems...');

  // Initialize quest progress checker
  initQuestProgressChecker();

  // Initialize companion trigger checker
  initCompanionTriggerChecker();

  // Register any additional global handlers here
  registerGlobalHandlers();

  initialized = true;
  console.log('Narrative systems initialized successfully');
}

/**
 * Register global event handlers that don't fit in specific checkers
 */
function registerGlobalHandlers() {
  // Log all events in development mode
  if (process.env.NODE_ENV !== 'production') {
    on('*', (event) => {
      console.log(`[EVENT] ${event.type}:`, JSON.stringify(event.data, null, 2).slice(0, 200));
    });
  }

  // Handle narrative queue cleanup periodically
  // This could be expanded to run on a schedule
  on(GAME_EVENTS.DM_SESSION_STARTED, async (event) => {
    try {
      const { expireOldItems } = await import('./narrativeQueueService.js');
      await expireOldItems();
    } catch (error) {
      console.error('Error expiring old narrative queue items:', error);
    }
  });
}

/**
 * Check if narrative systems are initialized
 */
export function isInitialized() {
  return initialized;
}

/**
 * Reset initialization state (for testing)
 */
export function resetInitialization() {
  initialized = false;
}
