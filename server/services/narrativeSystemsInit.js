/**
 * Narrative Systems Initialization
 *
 * Initializes narrative system event handlers when the server starts. Called
 * once after database initialization.
 *
 * MVP note: the quest-progress, companion-trigger, achievement, and
 * narrative-queue checkers were removed in the MVP reduction (their systems are
 * archived). Session memory now flows entirely through story chronicles + canon
 * facts + NPC conversation recall, which are wired directly in the DM session
 * route — they don't need an event-handler registration here.
 */

import { on } from './eventEmitter.js';

let initialized = false;

/**
 * Initialize all narrative system event handlers
 */
export async function initNarrativeSystems() {
  if (initialized) {
    console.log('Narrative systems already initialized');
    return;
  }

  console.log('Initializing narrative systems...');
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
