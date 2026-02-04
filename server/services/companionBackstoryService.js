import { dbAll, dbGet, dbRun } from '../database.js';

/**
 * Companion Backstory Service - CRUD operations for companion backstories
 */

/**
 * Create a backstory for a companion
 */
export async function createBackstory(data) {
  const {
    companion_id,
    origin_location = null,
    origin_description = null,
    formative_event = null,
    formative_event_date = null,
    personal_goal = null,
    goal_progress = null,
    unresolved_threads = [],
    loyalty = 50,
    loyalty_events = [],
    secrets = []
  } = data;

  const result = await dbRun(`
    INSERT INTO companion_backstories (
      companion_id, origin_location, origin_description,
      formative_event, formative_event_date, personal_goal, goal_progress,
      unresolved_threads, loyalty, loyalty_events, secrets
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    companion_id, origin_location, origin_description,
    formative_event, formative_event_date, personal_goal, goal_progress,
    JSON.stringify(unresolved_threads), loyalty,
    JSON.stringify(loyalty_events), JSON.stringify(secrets)
  ]);

  return getBackstoryById(result.lastInsertRowid);
}

/**
 * Get a backstory by ID
 */
export async function getBackstoryById(id) {
  const backstory = await dbGet('SELECT * FROM companion_backstories WHERE id = ?', [id]);
  return backstory ? parseBackstoryJson(backstory) : null;
}

/**
 * Get a backstory by companion ID
 */
export async function getBackstoryByCompanionId(companionId) {
  const backstory = await dbGet(
    'SELECT * FROM companion_backstories WHERE companion_id = ?',
    [companionId]
  );
  return backstory ? parseBackstoryJson(backstory) : null;
}

/**
 * Get or create a backstory for a companion
 */
export async function getOrCreateBackstory(companionId) {
  let backstory = await getBackstoryByCompanionId(companionId);
  if (!backstory) {
    backstory = await createBackstory({ companion_id: companionId });
  }
  return backstory;
}

/**
 * Update a backstory
 */
export async function updateBackstory(id, data) {
  const backstory = await getBackstoryById(id);
  if (!backstory) return null;

  const updates = { ...backstory, ...data };

  await dbRun(`
    UPDATE companion_backstories SET
      origin_location = ?, origin_description = ?,
      formative_event = ?, formative_event_date = ?,
      personal_goal = ?, goal_progress = ?,
      unresolved_threads = ?, loyalty = ?, loyalty_events = ?, secrets = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [
    updates.origin_location, updates.origin_description,
    updates.formative_event, updates.formative_event_date,
    updates.personal_goal, updates.goal_progress,
    JSON.stringify(updates.unresolved_threads),
    updates.loyalty,
    JSON.stringify(updates.loyalty_events),
    JSON.stringify(updates.secrets),
    id
  ]);

  return getBackstoryById(id);
}

/**
 * Update backstory by companion ID
 */
export async function updateBackstoryByCompanionId(companionId, data) {
  const backstory = await getBackstoryByCompanionId(companionId);
  if (!backstory) return null;
  return updateBackstory(backstory.id, data);
}

// ============================================================
// LOYALTY SYSTEM
// ============================================================

/**
 * Adjust companion loyalty
 */
export async function adjustLoyalty(companionId, change, reason = null) {
  const backstory = await getOrCreateBackstory(companionId);

  const newLoyalty = Math.max(0, Math.min(100, backstory.loyalty + change));
  const loyaltyEvents = backstory.loyalty_events || [];

  if (reason) {
    loyaltyEvents.push({
      event: reason,
      change,
      new_total: newLoyalty,
      date: new Date().toISOString()
    });
  }

  await dbRun(`
    UPDATE companion_backstories SET
      loyalty = ?, loyalty_events = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [newLoyalty, JSON.stringify(loyaltyEvents), backstory.id]);

  // Check for secret reveals
  await checkSecretReveals(backstory.id, newLoyalty);

  return getBackstoryById(backstory.id);
}

/**
 * Get current loyalty level
 */
export async function getLoyalty(companionId) {
  const backstory = await getBackstoryByCompanionId(companionId);
  return backstory ? backstory.loyalty : 50;
}

/**
 * Get loyalty label
 */
export function getLoyaltyLabel(loyalty) {
  if (loyalty >= 90) return 'devoted';
  if (loyalty >= 75) return 'loyal';
  if (loyalty >= 50) return 'trusted';
  if (loyalty >= 25) return 'uncertain';
  if (loyalty >= 10) return 'distrustful';
  return 'hostile';
}

// ============================================================
// SECRETS SYSTEM
// ============================================================

/**
 * Add a secret to a companion
 */
export async function addSecret(companionId, secret) {
  const backstory = await getOrCreateBackstory(companionId);

  const secrets = backstory.secrets || [];
  secrets.push({
    id: `secret_${Date.now()}`,
    content: secret.content,
    loyalty_threshold: secret.loyalty_threshold || 50,
    revealed: false,
    revealed_date: null
  });

  await dbRun(`
    UPDATE companion_backstories SET secrets = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
  `, [JSON.stringify(secrets), backstory.id]);

  return getBackstoryById(backstory.id);
}

/**
 * Check and reveal secrets based on loyalty
 */
export async function checkSecretReveals(backstoryId, currentLoyalty) {
  const backstory = await getBackstoryById(backstoryId);
  if (!backstory) return [];

  const secrets = backstory.secrets || [];
  const revealedSecrets = [];

  let updated = false;
  for (const secret of secrets) {
    if (!secret.revealed && currentLoyalty >= secret.loyalty_threshold) {
      secret.revealed = true;
      secret.revealed_date = new Date().toISOString();
      revealedSecrets.push(secret);
      updated = true;
    }
  }

  if (updated) {
    await dbRun(`
      UPDATE companion_backstories SET secrets = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `, [JSON.stringify(secrets), backstoryId]);
  }

  return revealedSecrets;
}

/**
 * Get revealed secrets
 */
export async function getRevealedSecrets(companionId) {
  const backstory = await getBackstoryByCompanionId(companionId);
  if (!backstory) return [];

  return (backstory.secrets || []).filter(s => s.revealed);
}

/**
 * Get unrevealed secrets (for internal use/debugging)
 */
export async function getUnrevealedSecrets(companionId) {
  const backstory = await getBackstoryByCompanionId(companionId);
  if (!backstory) return [];

  return (backstory.secrets || []).filter(s => !s.revealed);
}

// ============================================================
// UNRESOLVED THREADS SYSTEM
// ============================================================

/**
 * Add an unresolved thread
 */
export async function addUnresolvedThread(companionId, thread) {
  const backstory = await getOrCreateBackstory(companionId);

  const threads = backstory.unresolved_threads || [];
  threads.push({
    id: `thread_${Date.now()}`,
    type: thread.type, // enemy, lost_person, secret, debt, prophecy, inheritance
    description: thread.description,
    activation_triggers: thread.activation_triggers || [],
    intensity: thread.intensity || 5,
    status: 'dormant',
    spawned_quest_id: null,
    created_at: new Date().toISOString()
  });

  await dbRun(`
    UPDATE companion_backstories SET unresolved_threads = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
  `, [JSON.stringify(threads), backstory.id]);

  return getBackstoryById(backstory.id);
}

/**
 * Activate a thread
 */
export async function activateThread(companionId, threadId) {
  const backstory = await getBackstoryByCompanionId(companionId);
  if (!backstory) return null;

  const threads = backstory.unresolved_threads || [];
  const thread = threads.find(t => t.id === threadId);

  if (thread && thread.status === 'dormant') {
    thread.status = 'activated';
    thread.activated_at = new Date().toISOString();

    await dbRun(`
      UPDATE companion_backstories SET unresolved_threads = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `, [JSON.stringify(threads), backstory.id]);
  }

  return getBackstoryById(backstory.id);
}

/**
 * Link a thread to a spawned quest
 */
export async function linkThreadToQuest(companionId, threadId, questId) {
  const backstory = await getBackstoryByCompanionId(companionId);
  if (!backstory) return null;

  const threads = backstory.unresolved_threads || [];
  const thread = threads.find(t => t.id === threadId);

  if (thread) {
    thread.spawned_quest_id = questId;

    await dbRun(`
      UPDATE companion_backstories SET unresolved_threads = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `, [JSON.stringify(threads), backstory.id]);
  }

  return getBackstoryById(backstory.id);
}

/**
 * Resolve a thread
 */
export async function resolveThread(companionId, threadId, resolution = null) {
  const backstory = await getBackstoryByCompanionId(companionId);
  if (!backstory) return null;

  const threads = backstory.unresolved_threads || [];
  const thread = threads.find(t => t.id === threadId);

  if (thread) {
    thread.status = 'resolved';
    thread.resolved_at = new Date().toISOString();
    thread.resolution = resolution;

    await dbRun(`
      UPDATE companion_backstories SET unresolved_threads = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `, [JSON.stringify(threads), backstory.id]);
  }

  return getBackstoryById(backstory.id);
}

/**
 * Get dormant threads
 */
export async function getDormantThreads(companionId) {
  const backstory = await getBackstoryByCompanionId(companionId);
  if (!backstory) return [];

  return (backstory.unresolved_threads || []).filter(t => t.status === 'dormant');
}

/**
 * Get activated threads
 */
export async function getActivatedThreads(companionId) {
  const backstory = await getBackstoryByCompanionId(companionId);
  if (!backstory) return [];

  return (backstory.unresolved_threads || []).filter(t => t.status === 'activated');
}

/**
 * Check if any thread triggers match given content
 */
export async function checkThreadTriggers(companionId, context) {
  const dormantThreads = await getDormantThreads(companionId);
  const triggered = [];

  for (const thread of dormantThreads) {
    const triggers = thread.activation_triggers || [];

    for (const trigger of triggers) {
      const triggerLower = trigger.toLowerCase();

      // Check against content text
      if (context.content && context.content.toLowerCase().includes(triggerLower)) {
        triggered.push(thread);
        break;
      }

      // Check against tags
      if (context.tags && context.tags.some(t => t.toLowerCase().includes(triggerLower))) {
        triggered.push(thread);
        break;
      }

      // Check against location name
      if (context.location_name && context.location_name.toLowerCase().includes(triggerLower)) {
        triggered.push(thread);
        break;
      }
    }
  }

  return triggered;
}

/**
 * Delete a backstory
 */
export async function deleteBackstory(id) {
  const result = await dbRun('DELETE FROM companion_backstories WHERE id = ?', [id]);
  return result.changes > 0;
}

/**
 * Delete backstory by companion ID
 */
export async function deleteBackstoryByCompanionId(companionId) {
  const result = await dbRun('DELETE FROM companion_backstories WHERE companion_id = ?', [companionId]);
  return result.changes > 0;
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function parseBackstoryJson(backstory) {
  return {
    ...backstory,
    unresolved_threads: JSON.parse(backstory.unresolved_threads || '[]'),
    loyalty_events: JSON.parse(backstory.loyalty_events || '[]'),
    secrets: JSON.parse(backstory.secrets || '[]')
  };
}
