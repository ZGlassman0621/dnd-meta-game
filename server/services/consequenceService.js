import { dbAll, dbGet, dbRun } from '../database.js';
import * as npcRelationshipService from './npcRelationshipService.js';
import * as questService from './questService.js';
import * as narrativeQueueService from './narrativeQueueService.js';
import { emit, GAME_EVENTS } from './eventEmitter.js';

/**
 * Consequence Service - Automated consequence processing
 *
 * Handles:
 * - Overdue promise detection and auto-breaking
 * - Quest deadline enforcement and escalation
 * - Consequence logging and narrative queue integration
 */

// ============================================================
// TIMING CONSTANTS
// ============================================================

// Promise thresholds (in game days since promise was made)
const PROMISE_WARNING_DAYS = 21;      // Queue a reminder to narrative
const PROMISE_BREAK_DAYS = 45;        // Auto-break if no explicit deadline
const PROMISE_WARNING_FRACTION = 0.5; // Warn at half of explicit deadline

// ============================================================
// MAIN TICK PROCESSING
// ============================================================

/**
 * Process all consequences for a campaign during the living world tick.
 * Called as step 3.8 in the living world pipeline.
 */
export async function processConsequences(campaignId, characterId, currentGameDay) {
  const results = {
    brokenPromises: [],
    promiseWarnings: [],
    expiredQuests: [],
    errors: []
  };

  // Step 1: Check for overdue promises
  try {
    const promiseResults = await checkOverduePromises(characterId, campaignId, currentGameDay);
    results.brokenPromises = promiseResults.broken;
    results.promiseWarnings = promiseResults.warnings;
  } catch (e) {
    console.error('Error checking overdue promises:', e);
    results.errors.push(`Promises: ${e.message}`);
  }

  // Step 2: Check for expired quests
  try {
    results.expiredQuests = await checkExpiredQuests(characterId, campaignId, currentGameDay);
  } catch (e) {
    console.error('Error checking expired quests:', e);
    results.errors.push(`Quests: ${e.message}`);
  }

  return results;
}

// ============================================================
// PROMISE CHECKING
// ============================================================

/**
 * Scan all pending promises and check for overdue ones.
 * Returns { broken: [...], warnings: [...] }
 */
async function checkOverduePromises(characterId, campaignId, currentGameDay) {
  const broken = [];
  const warnings = [];

  const pendingPromises = await npcRelationshipService.getPendingPromises(characterId);

  for (const p of pendingPromises) {
    const gameDayMade = p.game_day_made || 0;
    if (!gameDayMade) continue; // Skip promises without game_day tracking (legacy)

    const daysSinceMade = currentGameDay - gameDayMade;
    const deadline = p.deadline_game_day || 0;

    // Check for auto-break
    if (deadline > 0 && currentGameDay > deadline) {
      // Explicit deadline passed
      const result = await applyPromiseBrokenConsequences(
        characterId, campaignId, p.npc_id, p.promise_index, p, currentGameDay,
        `Deadline passed (day ${deadline})`
      );
      if (result) broken.push(result);
    } else if (!deadline && daysSinceMade >= PROMISE_BREAK_DAYS) {
      // No explicit deadline, but too much time has passed
      const result = await applyPromiseBrokenConsequences(
        characterId, campaignId, p.npc_id, p.promise_index, p, currentGameDay,
        `${daysSinceMade} days without fulfillment`
      );
      if (result) broken.push(result);
    }
    // Check for warning (only if not already breaking)
    else if (shouldWarn(p, daysSinceMade, deadline, currentGameDay)) {
      const alreadyWarned = await hasRecentWarning(characterId, p.npc_id, p.promise);
      if (!alreadyWarned) {
        const result = await queuePromiseWarning(
          characterId, campaignId, p, currentGameDay, daysSinceMade, deadline
        );
        if (result) warnings.push(result);
      }
    }
  }

  return { broken, warnings };
}

/**
 * Determine if a promise warning should be issued.
 */
function shouldWarn(promise, daysSinceMade, deadline, currentGameDay) {
  if (deadline > 0) {
    // Warn at half of remaining deadline
    const totalDays = deadline - (promise.game_day_made || 0);
    const warningDay = (promise.game_day_made || 0) + Math.floor(totalDays * PROMISE_WARNING_FRACTION);
    return currentGameDay >= warningDay && currentGameDay <= deadline;
  }
  // No deadline: warn at the standard threshold
  return daysSinceMade >= PROMISE_WARNING_DAYS && daysSinceMade < PROMISE_BREAK_DAYS;
}

/**
 * Check if a recent warning already exists for this promise (avoid spamming).
 */
async function hasRecentWarning(characterId, npcId, promiseText) {
  const recent = await dbGet(`
    SELECT id FROM consequence_log
    WHERE character_id = ? AND consequence_type = 'promise_warning'
      AND source_id LIKE ?
      AND created_at > datetime('now', '-7 days')
    LIMIT 1
  `, [characterId, `%"npc_id":${npcId}%`]);
  return !!recent;
}

/**
 * Apply consequences for a broken promise.
 */
async function applyPromiseBrokenConsequences(characterId, campaignId, npcId, promiseIndex, promise, currentGameDay, reason) {
  const effects = [];

  // 1. Break the promise (applies -15 disposition via existing function)
  await npcRelationshipService.breakPromise(characterId, npcId, promiseIndex, reason);
  effects.push({ type: 'disposition', npc_id: npcId, change: -15, reason: 'Broken promise' });

  // 2. Additional trust penalty (-5)
  await npcRelationshipService.adjustTrust(characterId, npcId, -5, 'Broke a promise');
  effects.push({ type: 'trust', npc_id: npcId, change: -5, reason: 'Broken promise' });

  // 3. Get NPC name for narrative
  const npc = await dbGet('SELECT name, occupation FROM npcs WHERE id = ?', [npcId]);
  const npcName = npc?.name || 'Unknown NPC';
  const npcOccupation = npc?.occupation || '';
  const promiseText = promise.promise || promise.text || 'a promise';

  // 4. Log the consequence
  const sourceId = JSON.stringify({ npc_id: npcId, promise_index: promiseIndex });
  const logEntry = await logConsequence({
    campaign_id: campaignId,
    character_id: characterId,
    consequence_type: 'broken_promise',
    source_type: 'promise',
    source_id: sourceId,
    title: `Broken promise to ${npcName}`,
    description: `You failed to fulfill your promise to ${npcName}${npcOccupation ? ` (${npcOccupation})` : ''}: "${promiseText}". ${reason}.`,
    effects_applied: JSON.stringify(effects),
    severity: 'moderate',
    game_day: currentGameDay
  });

  // 5. Queue narrative for DM delivery
  const queueEntry = await narrativeQueueService.addToQueue({
    campaign_id: campaignId,
    character_id: characterId,
    event_type: 'broken_promise',
    priority: 'high',
    title: `Broken promise to ${npcName}`,
    description: `${npcName} has grown bitter about your unfulfilled promise: "${promiseText}". Their trust in you has diminished. ${reason}.`,
    context: {
      npc_id: npcId,
      npc_name: npcName,
      promise: promiseText,
      disposition_change: -15,
      trust_change: -5,
      consequence_id: logEntry?.id
    },
    related_npc_id: npcId
  });

  // 6. Update consequence log with narrative queue ID
  if (logEntry && queueEntry) {
    await dbRun('UPDATE consequence_log SET narrative_queue_id = ? WHERE id = ?', [queueEntry.id, logEntry.id]);
  }

  // 7. Create canon fact about the broken promise
  try {
    await dbRun(`
      INSERT INTO canon_facts (campaign_id, character_id, category, subject, fact, game_day, importance, is_active, tags)
      VALUES (?, ?, 'promise', ?, ?, ?, 'major', 1, '["broken_promise","consequence"]')
    `, [
      campaignId, characterId,
      npcName,
      `Broke promise to ${npcName}: "${promiseText}" — ${reason}`,
      currentGameDay
    ]);
  } catch (e) {
    console.error('Error creating canon fact for broken promise:', e.message);
  }

  return {
    npc_id: npcId,
    npc_name: npcName,
    promise: promiseText,
    reason,
    effects
  };
}

/**
 * Queue a warning about an overdue promise (doesn't break it yet).
 */
async function queuePromiseWarning(characterId, campaignId, promise, currentGameDay, daysSinceMade, deadline) {
  const npc = await dbGet('SELECT name, occupation FROM npcs WHERE id = ?', [promise.npc_id]);
  const npcName = npc?.name || 'Unknown NPC';
  const promiseText = promise.promise || promise.text || 'a promise';

  let urgencyText;
  if (deadline > 0) {
    const daysRemaining = deadline - currentGameDay;
    urgencyText = `Only ${daysRemaining} day${daysRemaining !== 1 ? 's' : ''} remain before this promise is considered broken.`;
  } else {
    urgencyText = `It has been ${daysSinceMade} days since this promise was made.`;
  }

  // Log warning
  await logConsequence({
    campaign_id: campaignId,
    character_id: characterId,
    consequence_type: 'promise_warning',
    source_type: 'promise',
    source_id: JSON.stringify({ npc_id: promise.npc_id, promise_index: promise.promise_index }),
    title: `Overdue promise to ${npcName}`,
    description: `Your promise to ${npcName} — "${promiseText}" — is overdue. ${urgencyText}`,
    effects_applied: null,
    severity: 'minor',
    game_day: currentGameDay
  });

  // Queue narrative reminder
  await narrativeQueueService.addToQueue({
    campaign_id: campaignId,
    character_id: characterId,
    event_type: 'promise_reminder',
    priority: 'normal',
    title: `Reminder: Promise to ${npcName}`,
    description: `${npcName} is waiting for you to fulfill your promise: "${promiseText}". ${urgencyText} They may bring it up if you encounter them.`,
    context: {
      npc_id: promise.npc_id,
      npc_name: npcName,
      promise: promiseText,
      days_since_made: daysSinceMade,
      deadline_game_day: deadline || null
    },
    related_npc_id: promise.npc_id
  });

  return {
    npc_id: promise.npc_id,
    npc_name: npcName,
    promise: promiseText,
    days_overdue: daysSinceMade
  };
}

// ============================================================
// QUEST DEADLINE CHECKING
// ============================================================

/**
 * Check active quests for expired deadlines.
 */
async function checkExpiredQuests(characterId, campaignId, currentGameDay) {
  const expiredQuests = [];

  // Get time-sensitive active quests with game day deadlines
  const quests = await dbAll(`
    SELECT * FROM quests
    WHERE character_id = ? AND status = 'active'
      AND (deadline_game_day IS NOT NULL AND deadline_game_day > 0 AND deadline_game_day < ?)
  `, [characterId, currentGameDay]);

  for (const quest of quests) {
    const result = await applyQuestExpiredConsequences(characterId, campaignId, quest, currentGameDay);
    if (result) expiredQuests.push(result);
  }

  return expiredQuests;
}

/**
 * Apply consequences for an expired quest.
 */
async function applyQuestExpiredConsequences(characterId, campaignId, quest, currentGameDay) {
  const effects = [];

  // 1. Fail the quest
  await questService.failQuest(quest.id);
  effects.push({ type: 'quest_failed', quest_id: quest.id, quest_title: quest.title });

  // 2. If it's a faction quest, reduce standing
  if (quest.source_type === 'faction' && quest.source_id) {
    try {
      const { modifyStanding } = await import('./factionService.js');
      await modifyStanding(characterId, quest.source_id, -10, `Failed quest: ${quest.title}`);
      effects.push({ type: 'faction_standing', faction_id: quest.source_id, change: -10 });
    } catch (e) {
      console.error('Error modifying faction standing for failed quest:', e.message);
    }
  }

  // 3. Build escalation description
  const escalation = quest.escalation_if_ignored || `The consequences of ignoring "${quest.title}" have come to pass.`;

  // 4. Log consequence
  const logEntry = await logConsequence({
    campaign_id: campaignId,
    character_id: characterId,
    consequence_type: 'quest_expired',
    source_type: 'quest',
    source_id: JSON.stringify({ quest_id: quest.id }),
    title: `Quest failed: ${quest.title}`,
    description: `The deadline for "${quest.title}" has passed (day ${quest.deadline_game_day}). ${escalation}`,
    effects_applied: JSON.stringify(effects),
    severity: quest.priority === 'high' ? 'major' : 'moderate',
    game_day: currentGameDay
  });

  // 5. Queue narrative for DM delivery
  const queueEntry = await narrativeQueueService.addToQueue({
    campaign_id: campaignId,
    character_id: characterId,
    event_type: 'quest_expired',
    priority: 'high',
    title: `Quest failed: ${quest.title}`,
    description: `The deadline for "${quest.title}" has passed. ${escalation}`,
    context: {
      quest_id: quest.id,
      quest_title: quest.title,
      escalation,
      effects,
      consequence_id: logEntry?.id
    },
    related_quest_id: quest.id
  });

  if (logEntry && queueEntry) {
    await dbRun('UPDATE consequence_log SET narrative_queue_id = ? WHERE id = ?', [queueEntry.id, logEntry.id]);
  }

  // 6. Create canon fact about the failed quest
  try {
    await dbRun(`
      INSERT INTO canon_facts (campaign_id, character_id, category, subject, fact, game_day, importance, is_active, tags)
      VALUES (?, ?, 'quest', ?, ?, ?, 'major', 1, '["quest_failed","consequence"]')
    `, [
      campaignId, characterId,
      quest.title,
      `Quest "${quest.title}" failed — deadline passed. ${escalation}`,
      currentGameDay
    ]);
  } catch (e) {
    console.error('Error creating canon fact for failed quest:', e.message);
  }

  return {
    quest_id: quest.id,
    quest_title: quest.title,
    escalation,
    effects
  };
}

// ============================================================
// CONSEQUENCE LOGGING
// ============================================================

/**
 * Log a consequence to the consequence_log table.
 */
async function logConsequence(data) {
  try {
    const result = await dbRun(`
      INSERT INTO consequence_log (
        campaign_id, character_id, consequence_type, source_type, source_id,
        title, description, effects_applied, severity, game_day, delivered, narrative_queue_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
    `, [
      data.campaign_id, data.character_id, data.consequence_type, data.source_type,
      data.source_id, data.title, data.description, data.effects_applied,
      data.severity || 'moderate', data.game_day, data.narrative_queue_id || null
    ]);
    return { id: result.lastInsertRowid, ...data };
  } catch (e) {
    console.error('Error logging consequence:', e.message);
    return null;
  }
}

// ============================================================
// CONSEQUENCE QUERIES
// ============================================================

/**
 * Get all consequences for a character.
 */
export async function getConsequenceLog(characterId, limit = 50) {
  return dbAll(`
    SELECT * FROM consequence_log
    WHERE character_id = ?
    ORDER BY game_day DESC, created_at DESC
    LIMIT ?
  `, [characterId, limit]);
}

/**
 * Get undelivered consequences (for DM prompt integration).
 */
export async function getUndeliveredConsequences(characterId) {
  return dbAll(`
    SELECT * FROM consequence_log
    WHERE character_id = ? AND delivered = 0
    ORDER BY severity DESC, game_day ASC
  `, [characterId]);
}

/**
 * Mark a consequence as delivered by the DM.
 */
export async function markConsequenceDelivered(id) {
  return dbRun('UPDATE consequence_log SET delivered = 1 WHERE id = ?', [id]);
}

/**
 * Get consequence stats for a character.
 */
export async function getConsequenceStats(characterId) {
  const total = await dbGet(
    'SELECT COUNT(*) as count FROM consequence_log WHERE character_id = ?',
    [characterId]
  );
  const undelivered = await dbGet(
    'SELECT COUNT(*) as count FROM consequence_log WHERE character_id = ? AND delivered = 0',
    [characterId]
  );
  const byType = await dbAll(
    'SELECT consequence_type, COUNT(*) as count FROM consequence_log WHERE character_id = ? GROUP BY consequence_type',
    [characterId]
  );
  return {
    total: total?.count || 0,
    undelivered: undelivered?.count || 0,
    by_type: byType
  };
}

/**
 * Get overdue promises for DM prompt context (without triggering consequences).
 * Returns promises that are approaching or past their warning threshold.
 */
export async function getOverduePromisesForContext(characterId, currentGameDay) {
  const pending = await npcRelationshipService.getPendingPromises(characterId);
  const overdue = [];

  for (const p of pending) {
    const gameDayMade = p.game_day_made || 0;
    if (!gameDayMade) continue;

    const daysSinceMade = currentGameDay - gameDayMade;
    const deadline = p.deadline_game_day || 0;

    let urgency = null;
    if (deadline > 0) {
      const daysRemaining = deadline - currentGameDay;
      if (daysRemaining <= 0) {
        urgency = 'EXPIRED';
      } else if (daysRemaining <= 7) {
        urgency = `${daysRemaining} days remaining`;
      } else {
        const totalDays = deadline - gameDayMade;
        if (daysSinceMade >= totalDays * PROMISE_WARNING_FRACTION) {
          urgency = `${daysRemaining} days remaining`;
        }
      }
    } else if (daysSinceMade >= PROMISE_WARNING_DAYS) {
      urgency = `${daysSinceMade} days overdue`;
    }

    if (urgency) {
      const npc = await dbGet('SELECT name FROM npcs WHERE id = ?', [p.npc_id]);
      overdue.push({
        npc_id: p.npc_id,
        npc_name: npc?.name || 'Unknown',
        promise: p.promise || p.text || '',
        urgency,
        days_since_made: daysSinceMade,
        deadline_game_day: deadline || null
      });
    }
  }

  return overdue;
}

/**
 * Get quests approaching deadline for DM prompt context.
 */
export async function getApproachingDeadlineQuests(characterId, currentGameDay) {
  return dbAll(`
    SELECT id, title, deadline_game_day, escalation_if_ignored, priority, quest_type
    FROM quests
    WHERE character_id = ? AND status = 'active'
      AND deadline_game_day IS NOT NULL AND deadline_game_day > 0
      AND deadline_game_day <= ?
    ORDER BY deadline_game_day ASC
  `, [characterId, currentGameDay + 7]); // Within 7 days of deadline
}
