import { dbAll, dbGet, dbRun } from '../database.js';

/**
 * Narrative Queue Service - Manage pending narrative events for delivery
 */

// Priority order for sorting (lower index = higher priority)
const PRIORITY_ORDER = ['urgent', 'high', 'normal', 'low', 'flavor'];

/**
 * Add an event to the narrative queue
 */
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
 * Get urgent and high priority items (for immediate attention)
 */
export async function getUrgentItems(characterId) {
  const items = await dbAll(`
    SELECT * FROM narrative_queue
    WHERE character_id = ? AND status = 'pending' AND priority IN ('urgent', 'high')
      AND (deliver_after IS NULL OR deliver_after <= CURRENT_TIMESTAMP)
      AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
    ORDER BY
      CASE priority WHEN 'urgent' THEN 0 ELSE 1 END,
      created_at ASC
  `, [characterId]);

  return items.map(parseQueueItemJson);
}

/**
 * Get items by event type
 */
export async function getItemsByEventType(characterId, eventType) {
  const items = await dbAll(`
    SELECT * FROM narrative_queue
    WHERE character_id = ? AND status = 'pending' AND event_type = ?
    ORDER BY created_at ASC
  `, [characterId, eventType]);

  return items.map(parseQueueItemJson);
}

/**
 * Get items related to a specific quest
 */
export async function getQuestRelatedItems(questId) {
  const items = await dbAll(`
    SELECT * FROM narrative_queue
    WHERE related_quest_id = ? AND status = 'pending'
    ORDER BY created_at ASC
  `, [questId]);

  return items.map(parseQueueItemJson);
}

/**
 * Get items related to a specific companion
 */
export async function getCompanionRelatedItems(companionId) {
  const items = await dbAll(`
    SELECT * FROM narrative_queue
    WHERE related_companion_id = ? AND status = 'pending'
    ORDER BY created_at ASC
  `, [companionId]);

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
 * Mark multiple items as delivered
 */
export async function markMultipleDelivered(ids, sessionId = null) {
  if (ids.length === 0) return [];

  const placeholders = ids.map(() => '?').join(',');
  await dbRun(`
    UPDATE narrative_queue SET
      status = 'delivered',
      delivered_at = CURRENT_TIMESTAMP,
      delivered_in_session_id = ?
    WHERE id IN (${placeholders})
  `, [sessionId, ...ids]);

  const items = [];
  for (const id of ids) {
    items.push(await getQueueItemById(id));
  }
  return items;
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
 * Update a queue item
 */
export async function updateQueueItem(id, data) {
  const item = await getQueueItemById(id);
  if (!item) return null;

  const updates = { ...item, ...data };

  await dbRun(`
    UPDATE narrative_queue SET
      event_type = ?, priority = ?, title = ?, description = ?, context = ?,
      related_quest_id = ?, related_companion_id = ?, related_npc_id = ?,
      related_location_id = ?, related_thread_id = ?,
      deliver_after = ?, expires_at = ?
    WHERE id = ?
  `, [
    updates.event_type, updates.priority, updates.title, updates.description,
    JSON.stringify(updates.context),
    updates.related_quest_id, updates.related_companion_id, updates.related_npc_id,
    updates.related_location_id, updates.related_thread_id,
    updates.deliver_after, updates.expires_at, id
  ]);

  return getQueueItemById(id);
}

/**
 * Delete a queue item
 */
export async function deleteQueueItem(id) {
  const result = await dbRun('DELETE FROM narrative_queue WHERE id = ?', [id]);
  return result.changes > 0;
}

/**
 * Delete all delivered items older than a certain date
 */
export async function cleanupDeliveredItems(olderThanDays = 30) {
  const result = await dbRun(`
    DELETE FROM narrative_queue
    WHERE status = 'delivered'
      AND delivered_at < datetime('now', '-' || ? || ' days')
  `, [olderThanDays]);

  return result.changes;
}

/**
 * Get queue statistics for a character
 */
export async function getQueueStats(characterId) {
  const stats = await dbAll(`
    SELECT
      status,
      priority,
      COUNT(*) as count
    FROM narrative_queue
    WHERE character_id = ?
    GROUP BY status, priority
  `, [characterId]);

  const result = {
    pending: { urgent: 0, high: 0, normal: 0, low: 0, flavor: 0, total: 0 },
    delivered: 0,
    expired: 0
  };

  for (const row of stats) {
    if (row.status === 'pending') {
      result.pending[row.priority] = row.count;
      result.pending.total += row.count;
    } else if (row.status === 'delivered') {
      result.delivered += row.count;
    } else if (row.status === 'expired') {
      result.expired += row.count;
    }
  }

  return result;
}

/**
 * Get delivered items for a specific session
 */
export async function getSessionDeliveredItems(sessionId) {
  const items = await dbAll(`
    SELECT * FROM narrative_queue
    WHERE delivered_in_session_id = ?
    ORDER BY delivered_at ASC
  `, [sessionId]);

  return items.map(parseQueueItemJson);
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
