import { dbAll, dbGet, dbRun } from '../database.js';

/**
 * Narrative Queue Service - Manage pending narrative events for delivery
 */

/**
 * Add an event to the narrative queue
 */
/**
 * Known event types — the ones the DM prompt / UI recognize. Unknown types
 * still get queued (to support future integrations without a code push),
 * but we log a warning so typos don't silently disappear into a "ghost"
 * queue entry that never gets delivered.
 */
export const KNOWN_EVENT_TYPES = new Set([
  'quest_available', 'quest_started', 'quest_completed', 'quest_failed',
  'quest_expired', 'faction_quest_spawned', 'faction_goal_completed',
  'companion_recruited', 'companion_dismissed', 'companion_mood_change',
  'promise_overdue', 'reputation_loss',
  'merchant_order_ready', 'merchant_order_expired',
  'base_threat_approaching', 'base_threat_repelled', 'base_captured',
  'base_damaged', 'base_defended', 'base_permanently_lost',
  'notoriety_entanglement', 'npc_mail', 'achievement_unlocked',
  'world_event_escalated', 'npc_death', 'location_discovered',
  'rumor_heard', 'tactic_discovered'
]);

export async function addToQueue(data) {
  const {
    campaign_id = null,
    character_id,
    event_type,
    priority = 'normal',
    title,
    description,
    context = {},
    related_quest_id = null,
    related_companion_id = null,
    related_npc_id = null,
    related_location_id = null,
    related_thread_id = null,
    deliver_after = null,
    expires_at = null
  } = data;

  if (typeof event_type !== 'string' || !event_type) {
    throw new Error('narrative queue: event_type is required and must be a string');
  }
  if (!KNOWN_EVENT_TYPES.has(event_type)) {
    console.warn(
      `[narrativeQueue] Unknown event_type "${event_type}" — it will be queued, ` +
      `but downstream consumers may not recognize it. Add it to KNOWN_EVENT_TYPES if intentional.`
    );
  }

  const result = await dbRun(`
    INSERT INTO narrative_queue (
      campaign_id, character_id, event_type, priority, title, description, context,
      related_quest_id, related_companion_id, related_npc_id, related_location_id,
      related_thread_id, deliver_after, expires_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    campaign_id, character_id, event_type, priority, title, description,
    JSON.stringify(context),
    related_quest_id, related_companion_id, related_npc_id, related_location_id,
    related_thread_id, deliver_after, expires_at
  ]);

  return getQueueItemById(result.lastInsertRowid);
}

/**
 * Get a queue item by ID
 */
export async function getQueueItemById(id) {
  const item = await dbGet('SELECT * FROM narrative_queue WHERE id = ?', [id]);
  return item ? parseQueueItemJson(item) : null;
}

/**
 * Get all pending items for a character
 */
export async function getPendingItems(characterId) {
  const items = await dbAll(`
    SELECT * FROM narrative_queue
    WHERE character_id = ? AND status = 'pending'
      AND (deliver_after IS NULL OR deliver_after <= CURRENT_TIMESTAMP)
      AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
    ORDER BY
      CASE priority
        WHEN 'urgent' THEN 0
        WHEN 'high' THEN 1
        WHEN 'normal' THEN 2
        WHEN 'low' THEN 3
        WHEN 'flavor' THEN 4
        ELSE 5
      END,
      created_at ASC
  `, [characterId]);

  return items.map(parseQueueItemJson);
}

/**
 * Get pending items by priority
 */
export async function getPendingItemsByPriority(characterId, priority) {
  const items = await dbAll(`
    SELECT * FROM narrative_queue
    WHERE character_id = ? AND status = 'pending' AND priority = ?
      AND (deliver_after IS NULL OR deliver_after <= CURRENT_TIMESTAMP)
      AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
    ORDER BY created_at ASC
  `, [characterId, priority]);

  return items.map(parseQueueItemJson);
}

/**
 * Mark an item as delivered
 */
export async function markDelivered(id, sessionId = null) {
  await dbRun(`
    UPDATE narrative_queue SET
      status = 'delivered',
      delivered_at = CURRENT_TIMESTAMP,
      delivered_in_session_id = ?
    WHERE id = ?
  `, [sessionId, id]);

  return getQueueItemById(id);
}

/**
 * Expire old items that have passed their expiration date
 */
export async function expireOldItems() {
  const result = await dbRun(`
    UPDATE narrative_queue SET status = 'expired'
    WHERE status = 'pending' AND expires_at IS NOT NULL AND expires_at <= CURRENT_TIMESTAMP
  `);

  return result.changes;
}

/**
 * Get the next batch of items to deliver (for DM session context)
 * Returns up to `limit` items, prioritized appropriately
 */
export async function getNextBatch(characterId, limit = 5) {
  // First expire any old items
  await expireOldItems();

  const items = await dbAll(`
    SELECT * FROM narrative_queue
    WHERE character_id = ? AND status = 'pending'
      AND (deliver_after IS NULL OR deliver_after <= CURRENT_TIMESTAMP)
      AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
    ORDER BY
      CASE priority
        WHEN 'urgent' THEN 0
        WHEN 'high' THEN 1
        WHEN 'normal' THEN 2
        WHEN 'low' THEN 3
        WHEN 'flavor' THEN 4
        ELSE 5
      END,
      created_at ASC
    LIMIT ?
  `, [characterId, limit]);

  return items.map(parseQueueItemJson);
}

/**
 * Format queue items for AI context injection
 */
export async function formatForAIContext(characterId, limit = 5) {
  const items = await getNextBatch(characterId, limit);

  if (items.length === 0) {
    return null;
  }

  const formatted = items.map(item => {
    let entry = `[${item.priority.toUpperCase()}] ${item.title}: ${item.description}`;
    if (item.context && Object.keys(item.context).length > 0) {
      // Add relevant context details
      if (item.context.companion_name) {
        entry += ` (Companion: ${item.context.companion_name})`;
      }
      if (item.context.quest_title) {
        entry += ` (Quest: ${item.context.quest_title})`;
      }
    }
    return entry;
  });

  return {
    items,
    formatted: formatted.join('\n'),
    count: items.length
  };
}

/**
 * Delete a queue item
 */
export async function deleteQueueItem(id) {
  const result = await dbRun('DELETE FROM narrative_queue WHERE id = ?', [id]);
  return result.changes > 0;
}

/**
 * Get delivered items history for a character
 */
export async function getDeliveredItems(characterId, limit = 50) {
  const items = await dbAll(`
    SELECT * FROM narrative_queue
    WHERE character_id = ? AND status = 'delivered'
    ORDER BY delivered_at DESC
    LIMIT ?
  `, [characterId, limit]);

  return items.map(parseQueueItemJson);
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function parseQueueItemJson(item) {
  return {
    ...item,
    context: JSON.parse(item.context || '{}')
  };
}

// ============================================================
// CONVENIENCE FUNCTIONS FOR COMMON EVENT TYPES
// ============================================================

/**
 * Add a quest stage advancement notification
 */
export async function addQuestStageAdvanced(characterId, quest, newStage, previousStage) {
  return addToQueue({
    character_id: characterId,
    campaign_id: quest.campaign_id,
    event_type: 'quest_stage_advanced',
    priority: quest.quest_type === 'main' ? 'high' : 'normal',
    title: `Quest Progress: ${quest.title}`,
    description: `You have advanced to the ${newStage.name} stage. ${newStage.description}`,
    context: {
      quest_id: quest.id,
      quest_title: quest.title,
      new_stage: newStage,
      previous_stage: previousStage
    },
    related_quest_id: quest.id
  });
}

/**
 * Add a companion reaction notification
 */
export async function addCompanionReaction(characterId, companion, thread, triggerContext) {
  return addToQueue({
    character_id: characterId,
    event_type: 'companion_reaction',
    priority: thread.intensity >= 7 ? 'high' : 'normal',
    title: `${companion.name}'s Past Resurfaces`,
    description: `Something about the current situation has stirred memories for ${companion.name}.`,
    context: {
      companion_id: companion.id,
      companion_name: companion.name,
      thread,
      trigger_context: triggerContext
    },
    related_companion_id: companion.id
  });
}

/**
 * Add a secret revealed notification
 */
export async function addSecretRevealed(characterId, companion, secret) {
  return addToQueue({
    character_id: characterId,
    event_type: 'companion_secret_revealed',
    priority: 'high',
    title: `${companion.name} Reveals a Secret`,
    description: `After building trust with ${companion.name}, they finally reveal something they've been hiding: ${secret.content}`,
    context: {
      companion_id: companion.id,
      companion_name: companion.name,
      secret
    },
    related_companion_id: companion.id
  });
}

/**
 * Add a quest completed notification
 */
export async function addQuestCompleted(characterId, quest) {
  return addToQueue({
    character_id: characterId,
    campaign_id: quest.campaign_id,
    event_type: 'quest_completed',
    priority: quest.quest_type === 'main' ? 'urgent' : 'high',
    title: `Quest Completed: ${quest.title}`,
    description: quest.world_impact_on_complete || `You have completed the quest "${quest.title}".`,
    context: {
      quest_id: quest.id,
      quest_title: quest.title,
      quest_type: quest.quest_type,
      rewards: quest.rewards
    },
    related_quest_id: quest.id
  });
}
