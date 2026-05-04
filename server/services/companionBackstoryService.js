import { dbAll, dbGet, dbRun } from '../database.js';
import { adjustStanding, AUDIT_STRATEGIES, mapToLabel } from './standingScalar.js';

/**
 * Companion Backstory Service - CRUD operations for companion backstories
 *
 * Phase 3 SC-2 (v1.0.145): companion loyalty migrated to the
 * standingScalar abstraction. `adjustLoyalty` now delegates the math /
 * range clamping / audit recording to `adjustStanding`. Per spec
 * Invariant B, the secret-reveal cascade (`checkSecretReveals`) stays
 * consumer-side because secret thresholds are per-secret, not per-band
 * (don't fit the abstraction's threshold-detection model).
 *
 * `COMPANION_LOYALTY_CONFIG` (exported below) is the per-consumer-static
 * configuration the abstraction reads. `formatLoyaltyForPrompt` is the
 * sync helper for prompt builders that already have loyalty data loaded
 * (avoids an extra repository round-trip).
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
// LOYALTY SYSTEM (Phase 3 SC-2 — migrated to standingScalar)
// ============================================================

/**
 * Companion loyalty configuration for the standingScalar abstraction.
 * Range / labels / audit-storage match the legacy adjustLoyalty behavior
 * exactly — this is a behavioral migration, not a content change.
 *
 * Repository callbacks own the SQL (the abstraction never builds queries
 * itself per the SC-1 design). The audit-entry append maps from the
 * abstraction's standard entry shape (strategy/change/newScore/reason/
 * sessionId/gameDay/date) to the legacy `loyalty_events` shape
 * (event/change/new_total/date) so any UI or debugging code that reads
 * loyalty_events directly stays compatible.
 *
 * Thresholds intentionally empty — secret reveals fire at PER-SECRET
 * thresholds (each secret carries its own loyalty_threshold), which
 * doesn't fit the abstraction's per-config-static threshold list.
 * Cascade stays consumer-side via `checkSecretReveals` per spec Invariant B.
 */
export const COMPANION_LOYALTY_CONFIG = {
  name: 'companion_loyalty',
  range: { min: 0, max: 100 },
  defaultValue: 50,
  labelBands: [
    { atOrAbove: 90, label: 'devoted' },
    { atOrAbove: 75, label: 'loyal' },
    { atOrAbove: 50, label: 'trusted' },
    { atOrAbove: 25, label: 'uncertain' },
    { atOrAbove: 10, label: 'distrustful' },
    { atOrAbove: 0,  label: 'hostile' }
  ],
  thresholds: [],  // see header comment — per-secret, not per-band
  auditTrail: { storage: AUDIT_STRATEGIES.INLINE_JSON },
  formatForPrompt: (current) => {
    const parts = [`Loyalty: ${current.label.toUpperCase()} (${current.score}/100)`];
    const recent = current.recentAuditEntries[0];
    if (recent && recent.reason) {
      const sign = recent.change > 0 ? '+' : '';
      parts.push(`Recent: ${recent.reason} (${sign}${recent.change})`);
    }
    return parts.join('. ');
  },
  repository: {
    async readScore(contextKey) {
      const row = await dbGet(
        `SELECT loyalty FROM companion_backstories WHERE companion_id = ?`,
        [contextKey.companionId]
      );
      return row ? row.loyalty : null;
    },
    async writeScore(contextKey, newScore) {
      await dbRun(
        `UPDATE companion_backstories
         SET loyalty = ?, updated_at = CURRENT_TIMESTAMP
         WHERE companion_id = ?`,
        [newScore, contextKey.companionId]
      );
    },
    async readAuditTrail(contextKey, limit) {
      const row = await dbGet(
        `SELECT loyalty_events FROM companion_backstories WHERE companion_id = ?`,
        [contextKey.companionId]
      );
      if (!row) return [];
      let events;
      try { events = JSON.parse(row.loyalty_events || '[]'); }
      catch { events = []; }
      // Map back to abstraction shape so getStanding's caller sees the
      // standard entry fields (reason, newScore, change, date).
      return events.slice(-limit).reverse().map(e => ({
        reason: e.event,
        change: e.change,
        newScore: e.new_total,
        date: e.date
      }));
    },
    async appendAuditEntry(contextKey, entry) {
      // Map abstraction shape → legacy loyalty_events shape so consumers
      // reading the column directly (UI, debug tools) stay compatible.
      const row = await dbGet(
        `SELECT loyalty_events FROM companion_backstories WHERE companion_id = ?`,
        [contextKey.companionId]
      );
      let events;
      try { events = row ? JSON.parse(row.loyalty_events || '[]') : []; }
      catch { events = []; }
      events.push({
        event: entry.reason,
        change: entry.change,
        new_total: entry.newScore,
        date: entry.date
      });
      await dbRun(
        `UPDATE companion_backstories
         SET loyalty_events = ?, updated_at = CURRENT_TIMESTAMP
         WHERE companion_id = ?`,
        [JSON.stringify(events), contextKey.companionId]
      );
    }
  }
};

/**
 * Adjust companion loyalty. Migrated to standingScalar in Phase 3 SC-2.
 *
 * The function's own behavior is unchanged from the legacy version:
 * (1) ensure backstory row exists, (2) clamp + record + apply, (3) cascade
 * secret reveals, (4) return updated backstory. The math + audit + clamp
 * step now goes through `adjustStanding` instead of inline code.
 *
 * Return shape preserved for back-compat (callers like
 * companionActivityService.js expect the full backstory row).
 */
export async function adjustLoyalty(companionId, change, reason = null) {
  // Pre-create the row if needed — consumer manages row lifecycle per
  // standingScalar's contract (the abstraction operates on existing rows).
  const backstory = await getOrCreateBackstory(companionId);

  const result = await adjustStanding(
    COMPANION_LOYALTY_CONFIG,
    { companionId },
    change,
    { reason }
  );

  // Cascade — per Invariant B, secret reveals stay consumer-side.
  await checkSecretReveals(backstory.id, result.newScore);

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
 * Get loyalty label. Kept for back-compat (no consumers found in current
 * codebase but exported, so external code or future consumers may use it).
 * Now redundant with `mapToLabel(loyalty, COMPANION_LOYALTY_CONFIG.labelBands)`
 * — the values match exactly. Safe to remove if a future cleanup confirms
 * no remaining external consumers.
 */
export function getLoyaltyLabel(loyalty) {
  if (loyalty >= 90) return 'devoted';
  if (loyalty >= 75) return 'loyal';
  if (loyalty >= 50) return 'trusted';
  if (loyalty >= 25) return 'uncertain';
  if (loyalty >= 10) return 'distrustful';
  return 'hostile';
}

/**
 * Sync helper for prompt builders. Takes already-loaded loyalty + audit
 * data (from a SELECT that joined companion_backstories) and returns the
 * formatForPrompt fragment WITHOUT making an extra repository round-trip.
 *
 * This is the path used by `dmPromptBuilder.js::formatCompanions` (sync
 * function called inside a template literal). The ad-hoc async path
 * goes through `formatStandingForPrompt(COMPANION_LOYALTY_CONFIG, ...)`
 * for callers that don't already have the data loaded.
 *
 * Returns empty string when loyalty is null (no backstory row exists)
 * so callers can string-concatenate safely.
 *
 * @param {number|null} loyaltyScore       — value of `loyalty` column
 * @param {string|null} loyaltyEventsJson  — value of `loyalty_events` column
 */
export function formatLoyaltyForPrompt(loyaltyScore, loyaltyEventsJson) {
  if (loyaltyScore == null) return '';
  let recentAuditEntries = [];
  try {
    const events = JSON.parse(loyaltyEventsJson || '[]');
    recentAuditEntries = events
      .slice(-2)
      .reverse()  // newest first
      .map(e => ({
        reason: e.event,
        change: e.change,
        newScore: e.new_total,
        date: e.date
      }));
  } catch { /* malformed JSON → empty audit list */ }

  const label = mapToLabel(loyaltyScore, COMPANION_LOYALTY_CONFIG.labelBands);
  return COMPANION_LOYALTY_CONFIG.formatForPrompt({
    score: loyaltyScore,
    label,
    recentAuditEntries
  });
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
// MOOD SYSTEM
// ============================================================

const VALID_MOODS = ['content', 'anxious', 'angry', 'sad', 'fearful', 'excited', 'conflicted', 'grateful', 'resentful', 'exhausted'];

const MOOD_RP_GUIDANCE = {
  content: 'Roleplay normally based on personality traits',
  anxious: 'Nervous, second-guessing, seeking reassurance',
  angry: 'Short-tempered, confrontational, holding a grudge',
  sad: 'Quiet, withdrawn, mentioning what they lost',
  fearful: 'Reluctant, cautious, urging retreat',
  excited: 'Eager, talkative, overconfident',
  conflicted: 'Hesitant, voicing doubts, asking moral questions',
  grateful: 'Warm, supportive, going extra mile for the party',
  resentful: 'Cold, passive-aggressive, bringing up grievances',
  exhausted: 'Slow, unfocused, asking for rest, making mistakes'
};

/**
 * Set a companion's mood
 */
export async function setMood(companionId, mood, cause, intensity, gameDaySet) {
  if (!VALID_MOODS.includes(mood)) {
    mood = 'content';
  }
  intensity = Math.max(1, Math.min(5, intensity || 1));

  const backstory = await getOrCreateBackstory(companionId);

  await dbRun(`
    UPDATE companion_backstories SET
      mood = ?, mood_cause = ?, mood_intensity = ?, mood_set_game_day = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [mood, cause, intensity, gameDaySet, backstory.id]);

  return getBackstoryById(backstory.id);
}

/**
 * Decay moods for all active companions of a character.
 * Intensity decays by 1 per 2 game days elapsed.
 * Resets to 'content' when intensity reaches 0.
 */
export async function decayMoods(characterId, currentGameDay) {
  if (!currentGameDay) return;

  // Get all active companions for this character with non-content moods
  const companions = await dbAll(`
    SELECT cb.id, cb.companion_id, cb.mood, cb.mood_intensity, cb.mood_set_game_day
    FROM companion_backstories cb
    JOIN companions c ON cb.companion_id = c.id
    WHERE c.recruited_by_character_id = ? AND c.status = 'active'
    AND cb.mood IS NOT NULL AND cb.mood != 'content'
    AND cb.mood_set_game_day IS NOT NULL
  `, [characterId]);

  for (const comp of companions) {
    const daysElapsed = currentGameDay - (comp.mood_set_game_day || currentGameDay);
    if (daysElapsed <= 0) continue;

    const decay = Math.floor(daysElapsed / 2);
    const newIntensity = (comp.mood_intensity || 1) - decay;

    if (newIntensity <= 0) {
      // Reset to content
      await dbRun(`
        UPDATE companion_backstories SET
          mood = 'content', mood_cause = NULL, mood_intensity = 1, mood_set_game_day = NULL,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [comp.id]);
    } else if (newIntensity < comp.mood_intensity) {
      // Reduce intensity
      await dbRun(`
        UPDATE companion_backstories SET
          mood_intensity = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [newIntensity, comp.id]);
    }
  }
}

/**
 * Get RP guidance string for a mood
 */
export function getMoodRPGuidance(mood) {
  return MOOD_RP_GUIDANCE[mood] || MOOD_RP_GUIDANCE.content;
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
