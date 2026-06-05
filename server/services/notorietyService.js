import { dbAll, dbGet, dbRun } from '../database.js';
import { ENTANGLEMENT_THRESHOLDS, rollEntanglement, getEntanglementRisk } from '../config/partyBaseConfig.js';
import * as narrativeQueueService from './narrativeQueueService.js';
import { registerHandler as registerMarkerHandler } from './markerPipeline.js';
import { registerDecayConsumer, DECAY_SEMANTICS } from './timeBoundedState.js';

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
 * Notoriety decay consumer (Phase 3.3 SC-7.4 — third Pattern D port).
 *
 * **WRITTEN_BACK semantics** — anchor (`last_decay_game_day`) advances
 * to currentGameDay after each decay tick. Distinguishes notoriety from
 * the HIGH_WATER_MARK shape (NPC absence, where anchor is `last_event`
 * and stays put across ticks) and the CONSUMED shape (companion mood,
 * where anchor NULLs at floor). Anchor here is "last time we ticked,"
 * not "last time the event occurred."
 *
 * Anchor fallback chain preserved exactly: `last_decay_game_day ||
 * last_event_game_day || currentGameDay`. The third fallback yields a
 * 0-elapsed read on first-ever-decay-tick where neither field is set —
 * the abstraction's `daysElapsed === 0` short-circuit handles this as
 * a no-op naturally.
 *
 * Tiered decay rate per legacy: above 50 → 1/day (heat is sticky at
 * high levels); ≤50 → 2/day. The decay function inspects currentValue
 * to choose the rate, then multiplies by daysElapsed.
 *
 * **Two-step write trade-off (mirrors SC-7.2):** legacy writes both
 * `score` and `last_decay_game_day` in one UPDATE; the abstraction
 * splits into writeValue (score) + advanceAnchor (last_decay_game_day).
 * 2 statements vs 1. Acceptable cost: notoriety decay runs on the
 * living-world tick (not session start), entries per character are
 * small (typically <10), most ticks are no-ops (no elapsed since
 * last decay).
 */
const NOTORIETY_DECAY_CONSUMER = registerDecayConsumer({
  name: 'character_notoriety_decay',
  semantics: DECAY_SEMANTICS.WRITTEN_BACK,
  decayFunction: (daysElapsed, currentValue) => {
    const rate = currentValue > SLOW_DECAY_THRESHOLD ? 1 : DECAY_PER_DAY;
    return rate * daysElapsed;
  },
  floor: 0,
  ceiling: MAX_SCORE,
  repository: {
    async readAnchor(contextKey) {
      const row = await dbGet(
        'SELECT last_decay_game_day, last_event_game_day FROM character_notoriety WHERE id = ?',
        [contextKey.entryId]
      );
      if (!row) return null;
      // Fallback chain: last_decay → last_event → currentGameDay (caller
      // hint). The third fallback only applies if BOTH columns are null;
      // the abstraction's 0-elapsed short-circuit handles that as no-op.
      return row.last_decay_game_day || row.last_event_game_day || contextKey.currentGameDayFallback || null;
    },
    async readValue(contextKey) {
      const row = await dbGet(
        'SELECT score FROM character_notoriety WHERE id = ?',
        [contextKey.entryId]
      );
      return row ? row.score : 0;
    },
    async writeValue(contextKey, newValue) {
      await dbRun(
        'UPDATE character_notoriety SET score = ? WHERE id = ?',
        [newValue, contextKey.entryId]
      );
    },
    async advanceAnchor(contextKey, newAnchor) {
      await dbRun(
        'UPDATE character_notoriety SET last_decay_game_day = ? WHERE id = ?',
        [newAnchor, contextKey.entryId]
      );
    }
  }
});

/**
 * Decay all notoriety scores by the daily rate.
 * Above 50: decay 1/day (heat is sticky at high levels).
 * Below 50: decay 2/day.
 * Entries at 0 are cleaned up after 30 days of inactivity.
 *
 * Phase 3.3 SC-7.4 (v1.0.158): per-entry decay logic delegated to
 * NOTORIETY_DECAY_CONSUMER above. This function stays as the
 * orchestrator (SELECT entries → for each: skip+GC if zeroed,
 * otherwise applyDecay → aggregate results). Same shape as SC-7.2
 * decayMoods + SC-7.3 processAbsenceEffects orchestrators.
 *
 * The skip-and-GC of zeroed entries stays consumer-side — it's
 * housekeeping adjacent to decay, not a decay operation itself. Pushing
 * it into the abstraction would leak consumer-specific cleanup logic.
 */
export async function decayScores(characterId, campaignId, currentGameDay) {
  const entries = await getNotoriety(characterId, campaignId);
  const results = [];

  for (const entry of entries) {
    if (entry.score <= 0) {
      // Clean up old zeroed entries (housekeeping; not decay).
      if (entry.last_event_game_day && (currentGameDay - entry.last_event_game_day) > 30) {
        await dbRun('DELETE FROM character_notoriety WHERE id = ?', [entry.id]);
      }
      continue;
    }

    const oldScore = entry.score;
    const decayResult = await NOTORIETY_DECAY_CONSUMER.applyDecay(
      { entryId: entry.id, currentGameDayFallback: currentGameDay },
      currentGameDay
    );

    if (decayResult) {
      results.push({
        source: entry.source,
        category: entry.category,
        oldScore,
        newScore: decayResult.newValue,
        decayed: decayResult.decayAmount
      });
    }
  }

  return results;
}

// Exported for direct test access.
export { NOTORIETY_DECAY_CONSUMER };

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

// ============================================================
// SC-6.4c — NOTORIETY_GAIN / NOTORIETY_LOSS marker handlers
// ============================================================

/**
 * NOTORIETY_GAIN handler. Multi-instance — pipeline dispatches once per
 * marker. Replaces the inline detect-call dispatch at the pre-SC-6.4c
 * routes/dmSession.js:1906 site.
 *
 * **Resolves the silent-drop bug** (KNOWN_BUGS.md archive entry, found
 * during SC-6.4 prep): the legacy detect path used `parseMarkerKeyValue`
 * which only parsed comma-separated unquoted values; the AI prompt
 * instructs the canonical quoted-space-separated format
 * (`source="City Watch" amount=15 category="criminal"`). Canonical-format
 * markers were silently dropped because parseMarkerKeyValue's
 * `str.split(',')` returned one entry containing the whole quoted string,
 * which the key-extraction routine couldn't decode. Migration through
 * the marker pipeline uses `markerSchemas.js`'s `extractField` regex,
 * which natively handles BOTH formats — auto-resolving the bug.
 */
registerMarkerHandler('NOTORIETY_GAIN', async (parsed, context) => {
  if (!context?.characterId) return null;
  const character = await dbGet(
    'SELECT campaign_id, game_day FROM characters WHERE id = ?',
    [context.characterId]
  );
  if (!character?.campaign_id) return null;
  try {
    await addNotoriety(context.characterId, character.campaign_id, {
      source: parsed.source,
      amount: parsed.amount,
      category: parsed.category,
      reason: `Session event (game day ${character.game_day || 0})`
    });
    return {
      type: 'notoriety_gain',
      source: parsed.source,
      amount: parsed.amount,
      category: parsed.category
    };
  } catch (e) {
    console.error(`[notorietyService] NOTORIETY_GAIN handler failed for ${parsed.source}:`, e.message);
    return null;
  }
});

/**
 * NOTORIETY_LOSS handler. Same shape as GAIN but inverts amount.
 * Schema doesn't carry a `category` field for losses — legacy code
 * hardcoded 'criminal'; preserved here.
 */
registerMarkerHandler('NOTORIETY_LOSS', async (parsed, context) => {
  if (!context?.characterId) return null;
  const character = await dbGet(
    'SELECT campaign_id, game_day FROM characters WHERE id = ?',
    [context.characterId]
  );
  if (!character?.campaign_id) return null;
  try {
    await addNotoriety(context.characterId, character.campaign_id, {
      source: parsed.source,
      amount: -parsed.amount,
      category: 'criminal',
      reason: `Cleared name (game day ${character.game_day || 0})`
    });
    return {
      type: 'notoriety_loss',
      source: parsed.source,
      amount: parsed.amount
    };
  } catch (e) {
    console.error(`[notorietyService] NOTORIETY_LOSS handler failed for ${parsed.source}:`, e.message);
    return null;
  }
});
