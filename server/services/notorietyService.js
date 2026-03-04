import { dbAll, dbGet, dbRun } from '../database.js';
import { ENTANGLEMENT_THRESHOLDS, rollEntanglement, getEntanglementRisk } from '../config/partyBaseConfig.js';
import * as narrativeQueueService from './narrativeQueueService.js';

/**
 * Notoriety Service
 * Blades in the Dark-style heat system. Actions generate notoriety with
 * specific factions/authorities. Heat decays over time but high scores
 * trigger entanglements (complications delivered via narrative queue).
 */

const DECAY_PER_DAY = 2;         // base decay rate
const SLOW_DECAY_THRESHOLD = 50; // above this, decay slows to 1/day
const MAX_SCORE = 100;
const MIN_DECAY_INTERVAL = 1;    // minimum days between decay ticks

// ============================================================
// CRUD
// ============================================================

export async function getNotoriety(characterId, campaignId) {
  return dbAll(`
    SELECT * FROM character_notoriety
    WHERE character_id = ? AND campaign_id = ?
    ORDER BY score DESC
  `, [characterId, campaignId]);
}

export async function getNotorietyBySource(characterId, campaignId, source) {
  return dbGet(`
    SELECT * FROM character_notoriety
    WHERE character_id = ? AND campaign_id = ? AND source = ?
  `, [characterId, campaignId, source]);
}

/**
 * Add notoriety. Upserts — creates if not exists, increments if exists.
 * Negative amounts reduce notoriety (minimum 0).
 */
export async function addNotoriety(characterId, campaignId, { source, amount, category, reason }) {
  if (!source || amount === undefined) {
    throw new Error('Source and amount are required');
  }

  const existing = await getNotorietyBySource(characterId, campaignId, source);

  if (existing) {
    const newScore = Math.max(0, Math.min(MAX_SCORE, existing.score + amount));
    await dbRun(`
      UPDATE character_notoriety
      SET score = ?, last_event_game_day = COALESCE(?, last_event_game_day),
          category = COALESCE(?, category)
      WHERE id = ?
    `, [newScore, null, category || null, existing.id]);

    return dbGet('SELECT * FROM character_notoriety WHERE id = ?', [existing.id]);
  }

  if (amount <= 0) return null; // Don't create entries for negative-only changes

  const result = await dbRun(`
    INSERT INTO character_notoriety (character_id, campaign_id, source, score, category)
    VALUES (?, ?, ?, ?, ?)
  `, [characterId, campaignId, source, Math.min(MAX_SCORE, amount), category || 'criminal']);

  return dbGet('SELECT * FROM character_notoriety WHERE id = ?', [result.lastInsertRowid]);
}

// ============================================================
// TICK PROCESSING
// ============================================================

/**
 * Process notoriety for a living world tick.
 * 1. Decay all scores
 * 2. Check for entanglements at high scores
 * Returns { decayed, entanglements }
 */
export async function processNotorietyTick(campaignId, characterId, currentGameDay) {
  const decayed = await decayScores(characterId, campaignId, currentGameDay);
  const entanglements = await checkEntanglements(characterId, campaignId, currentGameDay);

  return { decayed, entanglements };
}

/**
 * Decay all notoriety scores by the daily rate.
 * Above 50: decay 1/day (heat is sticky at high levels).
 * Below 50: decay 2/day.
 * Entries at 0 are cleaned up after 30 days of inactivity.
 */
export async function decayScores(characterId, campaignId, currentGameDay) {
  const entries = await getNotoriety(characterId, campaignId);
  const results = [];

  for (const entry of entries) {
    if (entry.score <= 0) {
      // Clean up old zeroed entries
      if (entry.last_event_game_day && (currentGameDay - entry.last_event_game_day) > 30) {
        await dbRun('DELETE FROM character_notoriety WHERE id = ?', [entry.id]);
      }
      continue;
    }

    const lastDecay = entry.last_decay_game_day || entry.last_event_game_day || currentGameDay;
    const daysSinceDecay = currentGameDay - lastDecay;

    if (daysSinceDecay < MIN_DECAY_INTERVAL) continue;

    const rate = entry.score > SLOW_DECAY_THRESHOLD ? 1 : DECAY_PER_DAY;
    const totalDecay = rate * daysSinceDecay;
    const newScore = Math.max(0, entry.score - totalDecay);

    await dbRun(`
      UPDATE character_notoriety
      SET score = ?, last_decay_game_day = ?
      WHERE id = ?
    `, [newScore, currentGameDay, entry.id]);

    results.push({
      source: entry.source,
      category: entry.category,
      oldScore: entry.score,
      newScore,
      decayed: entry.score - newScore
    });
  }

  return results;
}

/**
 * Check each notoriety entry for entanglement triggers.
 * Risk percentage is checked once per tick.
 */
export async function checkEntanglements(characterId, campaignId, currentGameDay) {
  const entries = await getNotoriety(characterId, campaignId);
  const triggered = [];

  for (const entry of entries) {
    const threshold = getEntanglementRisk(entry.score);
    if (threshold.risk <= 0) continue;

    // Roll for entanglement
    if (Math.random() < threshold.risk) {
      const entanglement = await generateEntanglement(entry, characterId, campaignId, currentGameDay);
      if (entanglement) {
        triggered.push(entanglement);
      }
    }
  }

  return triggered;
}

/**
 * Generate an entanglement event and queue it for DM delivery.
 */
async function generateEntanglement(notorietyEntry, characterId, campaignId, currentGameDay) {
  const entanglement = rollEntanglement(notorietyEntry.category);

  // Check if character has a base — entanglements target the base if it exists
  const base = await dbGet(`
    SELECT id FROM party_bases WHERE character_id = ? AND campaign_id = ? AND status = 'active'
  `, [characterId, campaignId]);

  // Create base event if base exists
  let baseEventId = null;
  if (base) {
    const result = await dbRun(`
      INSERT INTO base_events (base_id, event_type, title, description, game_day, severity)
      VALUES (?, 'entanglement', ?, ?, ?, ?)
    `, [base.id, entanglement.title, entanglement.description, currentGameDay, entanglement.severity]);
    baseEventId = result.lastInsertRowid;
  }

  // Queue for DM narrative delivery
  const queueItem = await narrativeQueueService.addToQueue({
    campaign_id: campaignId,
    character_id: characterId,
    event_type: 'entanglement',
    priority: entanglement.severity === 'critical' ? 'urgent' : entanglement.severity === 'major' ? 'high' : 'normal',
    title: `[ENTANGLEMENT] ${entanglement.title}`,
    description: `${entanglement.description} (Source: ${notorietyEntry.source}, Heat: ${notorietyEntry.score}/100)`,
    context: {
      source: notorietyEntry.source,
      category: notorietyEntry.category,
      score: notorietyEntry.score,
      severity: entanglement.severity,
      base_event_id: baseEventId
    }
  });

  // Update base event with narrative queue link
  if (baseEventId && queueItem) {
    await dbRun('UPDATE base_events SET narrative_queue_id = ? WHERE id = ?', [queueItem.id, baseEventId]);
  }

  return {
    source: notorietyEntry.source,
    category: notorietyEntry.category,
    score: notorietyEntry.score,
    entanglement,
    baseEventId,
    narrativeQueueId: queueItem?.id
  };
}

// ============================================================
// PROMPT FORMATTING
// ============================================================

export async function getNotorietyForPrompt(characterId, campaignId) {
  const entries = await getNotoriety(characterId, campaignId);
  const active = entries.filter(e => e.score > 0);

  if (active.length === 0) return '';

  const lines = active.map(e => {
    const risk = getEntanglementRisk(e.score);
    return `[HEAT: ${e.source} ${e.score}/100 — ${risk.label}]`;
  });

  return `\n=== NOTORIETY ===\n${lines.join('\n')}\n`;
}
