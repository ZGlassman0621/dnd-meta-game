/**
 * Piety Service — Manages deity relationship scores and threshold abilities.
 *
 * Adapted from Mythic Odysseys of Theros. Characters earn piety through
 * actions aligned with their deity's values. Thresholds at 3, 10, 25, 50
 * unlock deity-specific abilities.
 *
 * Phase 3 SC-4 (v1.0.147): piety migrated to the standingScalar abstraction.
 * `adjustPiety` now delegates the math / range clamping / audit recording /
 * threshold dispatch to `adjustStanding(MYTHIC_PIETY_CONFIG, ...)`. The
 * threshold-crossing cascade that updates `highest_threshold_unlocked` is
 * registered as the abstraction's `up`-direction handler at module load.
 *
 * The `[PIETY_CHANGE]` marker handler is also registered in this module
 * at import time, replacing `dmSessionService.detectPietyChange`'s call
 * site in routes/dmSession.js (the legacy detect function stays exported
 * per the "deprecate by hiding nav, not deleting code" policy).
 */

import { dbAll, dbGet, dbRun } from '../database.js';
import { getDeityPiety, getPietyThreshold } from '../config/mythicProgression.js';
import {
  adjustStanding,
  AUDIT_STRATEGIES,
  registerThresholdHandler
} from './standingScalar.js';
import { registerHandler as registerMarkerHandler } from './markerPipeline.js';

// ============================================================
// READ
// ============================================================

/**
 * Get piety for a specific deity relationship.
 */
export async function getCharacterPiety(characterId, deityName) {
  const piety = await dbGet(
    'SELECT * FROM character_piety WHERE character_id = ? AND deity_name = ? COLLATE NOCASE',
    [characterId, deityName]
  );
  if (!piety) return null;

  const deityData = getDeityPiety(deityName.toLowerCase());
  const thresholdInfo = getPietyThreshold(deityName.toLowerCase(), piety.piety_score);

  return {
    ...piety,
    deityData,
    currentThreshold: thresholdInfo
  };
}

/**
 * Get all deity piety scores for a character.
 */
export async function getAllCharacterPiety(characterId) {
  const rows = await dbAll(
    'SELECT * FROM character_piety WHERE character_id = ? ORDER BY deity_name',
    [characterId]
  );
  return rows.map(row => {
    const deityData = getDeityPiety(row.deity_name.toLowerCase());
    const thresholdInfo = getPietyThreshold(row.deity_name.toLowerCase(), row.piety_score);
    return { ...row, deityData, currentThreshold: thresholdInfo };
  });
}

// ============================================================
// INITIALIZE
// ============================================================

/**
 * Initialize a piety relationship with a deity.
 * Idempotent — returns existing record if present.
 */
export async function initializePiety(characterId, deityName, startingScore = 1) {
  const existing = await dbGet(
    'SELECT * FROM character_piety WHERE character_id = ? AND deity_name = ? COLLATE NOCASE',
    [characterId, deityName]
  );
  if (existing) return existing;

  await dbRun(`
    INSERT INTO character_piety (character_id, deity_name, piety_score, highest_threshold_unlocked)
    VALUES (?, ?, ?, 0)
  `, [characterId, deityName, startingScore]);

  // Record initial history entry
  await dbRun(`
    INSERT INTO piety_history (character_id, deity_name, change_amount, reason, new_score)
    VALUES (?, ?, ?, 'Initial piety established', ?)
  `, [characterId, deityName, startingScore, startingScore]);

  return dbGet(
    'SELECT * FROM character_piety WHERE character_id = ? AND deity_name = ? COLLATE NOCASE',
    [characterId, deityName]
  );
}

// ============================================================
// STANDING-SCALAR CONFIG (Phase 3 SC-4 — migrated to standingScalar)
// ============================================================

const PIETY_THRESHOLDS = [3, 10, 25, 50];

/**
 * Mythic piety configuration for the standingScalar abstraction.
 *
 * Range / floor / threshold cuts match the legacy adjustPiety behavior
 * exactly. Two distinguishing features vs. SC-2/SC-3 migrations:
 *
 * 1. **Composite contextKey** — `{ characterId, deityName }` per character
 *    can have piety to multiple deities. Per-deity rows are independent
 *    standings; the abstraction routes via the contextKey opaquely (per
 *    SC-1 spec §2.2). Case-insensitive deity matching preserved via
 *    `COLLATE NOCASE` in the repository's SQL — the row creator
 *    (initializePiety) decides the canonical casing.
 *
 * 2. **`SEPARATE_TABLE` audit strategy** — piety has its own
 *    `piety_history` table with `game_day` and `session_id` columns that
 *    don't fit the JSON shape used by loyalty/disposition. The repository's
 *    appendAuditEntry INSERTs into the dedicated table; readAuditTrail
 *    SELECTs back from it.
 *
 * 3. **Threshold dispatch** — the legacy `checkNewThreshold` cascade
 *    (update `highest_threshold_unlocked` when crossing 3/10/25/50)
 *    migrates into the abstraction's `up`-direction threshold handlers,
 *    registered at module load below. Cross-down currently does not
 *    lock — preserved by registering only `up` handlers.
 *
 * `range.max = Infinity` reflects piety's no-cap design (Theros);
 * clampToRange short-circuits Math.min(Infinity, x) so this is safe.
 * `labelBands` intentionally empty — piety surfaces threshold tier
 * labels in prompts, not a bands-derived single label.
 */
export const MYTHIC_PIETY_CONFIG = {
  name: 'mythic_piety',
  range: { min: 0, max: Infinity },
  defaultValue: 1,
  labelBands: [],
  thresholds: PIETY_THRESHOLDS.map(value => ({ value, direction: 'up' })),
  auditTrail: { storage: AUDIT_STRATEGIES.SEPARATE_TABLE },
  formatForPrompt: (current) => {
    // Surfaces deity-agnostic shape; the deity name is added by the
    // consumer-side composer (formatPietyForPrompt) since the abstraction
    // doesn't know the contextKey at format time.
    const recent = current.recentAuditEntries[0];
    const recentNote = recent && recent.reason
      ? `. Recent: ${recent.reason} (${recent.change > 0 ? '+' : ''}${recent.change})`
      : '';
    return `Piety ${current.score}${recentNote}`;
  },
  repository: {
    async readScore(contextKey) {
      const row = await dbGet(
        'SELECT piety_score FROM character_piety WHERE character_id = ? AND deity_name = ? COLLATE NOCASE',
        [contextKey.characterId, contextKey.deityName]
      );
      return row ? row.piety_score : null;
    },
    async writeScore(contextKey, newScore) {
      await dbRun(
        `UPDATE character_piety SET piety_score = ?, updated_at = CURRENT_TIMESTAMP
         WHERE character_id = ? AND deity_name = ? COLLATE NOCASE`,
        [newScore, contextKey.characterId, contextKey.deityName]
      );
    },
    async readAuditTrail(contextKey, limit) {
      const rows = await dbAll(
        `SELECT change_amount, reason, new_score, game_day, session_id, created_at
         FROM piety_history
         WHERE character_id = ? AND deity_name = ? COLLATE NOCASE
         ORDER BY created_at DESC LIMIT ?`,
        [contextKey.characterId, contextKey.deityName, limit]
      );
      // Map legacy row shape → abstraction's standard entry shape.
      return rows.map(r => ({
        reason: r.reason,
        change: r.change_amount,
        newScore: r.new_score,
        sessionId: r.session_id,
        gameDay: r.game_day,
        date: r.created_at
      }));
    },
    async appendAuditEntry(contextKey, entry) {
      await dbRun(
        `INSERT INTO piety_history (character_id, deity_name, change_amount, reason, new_score, game_day, session_id)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          contextKey.characterId,
          contextKey.deityName,
          entry.change,
          entry.reason,
          entry.newScore,
          entry.gameDay ?? null,
          entry.sessionId ?? null
        ]
      );
    }
  }
};

// Threshold-handler registration. Per spec §2.6 step 5, cross-up unlocks
// (updates highest_threshold_unlocked); cross-down records history but
// doesn't lock. We register only `up`-direction handlers, matching legacy
// `checkNewThreshold` semantics exactly.
//
// Each handler is registered once at module-load (per spec Q3
// recommendation). The handler captures the threshold value via closure
// and runs the legacy UPDATE — keeping the highest-only invariant via
// `AND highest_threshold_unlocked < ?` in the WHERE clause (so a regress-
// then-recross doesn't downgrade an existing higher unlock).
for (const threshold of PIETY_THRESHOLDS) {
  registerThresholdHandler(MYTHIC_PIETY_CONFIG, threshold, async ({ contextKey }) => {
    await dbRun(
      `UPDATE character_piety SET highest_threshold_unlocked = ?
       WHERE character_id = ? AND deity_name = ? COLLATE NOCASE
       AND highest_threshold_unlocked < ?`,
      [threshold, contextKey.characterId, contextKey.deityName, threshold]
    );
  }, 'up');
}

// [PIETY_CHANGE] marker handler. The legacy detect-function call site in
// routes/dmSession.js (lines ~2000-2011) is removed in this same change;
// the marker pipeline now owns dispatch. detectPietyChange remains
// exported in dmSessionService.js for back-compat.
//
// The pipeline's `context` carries `characterId` and `sessionId` (per
// dmSession.js:1348-1351). `gameDay` is intentionally not in the context
// today — handlers that need it can SELECT `characters.game_day`. Since
// the legacy code path also passed `character?.game_day` (optional), we
// match that shape: pull game_day from characters when available.
registerMarkerHandler('PIETY_CHANGE', async (parsed, context) => {
  const characterId = context?.characterId;
  if (!characterId) {
    console.warn('[pietyService] PIETY_CHANGE handler invoked without characterId');
    return null;
  }
  let gameDay = null;
  try {
    const row = await dbGet('SELECT game_day FROM characters WHERE id = ?', [characterId]);
    gameDay = row?.game_day ?? null;
  } catch { /* best-effort — game_day is optional */ }
  return adjustPiety(
    characterId,
    parsed.Deity,
    parsed.Amount,
    parsed.Reason || null,
    gameDay,
    context?.sessionId ?? null
  );
});

// ============================================================
// ADJUST
// ============================================================

/**
 * Adjust piety score. Migrated to standingScalar in Phase 3 SC-4.
 *
 * Function signature unchanged from the legacy version. Internally, the
 * math + range clamping + history INSERT + threshold dispatch all flow
 * through `adjustStanding(MYTHIC_PIETY_CONFIG, ...)`. The pre-create-row
 * pattern (auto-initialize if deity is known) stays consumer-side per
 * the standingScalar contract — the abstraction operates on existing rows.
 *
 * Returns the same `{ oldScore, newScore, change, reason, thresholdCrossed,
 * thresholdAbility }` shape callers expect. `thresholdCrossed` is derived
 * from the abstraction's `thresholdsCrossed` array (highest cross-up).
 */
export async function adjustPiety(characterId, deityName, amount, reason = null, gameDay = null, sessionId = null) {
  // Ensure piety relationship exists (consumer manages row lifecycle).
  let piety = await dbGet(
    'SELECT * FROM character_piety WHERE character_id = ? AND deity_name = ? COLLATE NOCASE',
    [characterId, deityName]
  );
  if (!piety) {
    piety = await initializePiety(characterId, deityName, 1);
  }

  const result = await adjustStanding(
    MYTHIC_PIETY_CONFIG,
    { characterId, deityName },
    amount,
    { reason, gameDay, sessionId }
  );

  // Map abstraction's threshold-cross output to the legacy return shape.
  // The threshold handler above already ran (updating highest_threshold_unlocked);
  // here we just surface which threshold was crossed for caller visibility.
  let thresholdCrossed = null;
  let thresholdAbility = null;
  if (result.thresholdsCrossed && result.thresholdsCrossed.length > 0) {
    // Highest crossed threshold (matches legacy behavior — multiple
    // simultaneous crossings would land on the highest).
    thresholdCrossed = result.thresholdsCrossed
      .filter(c => c.direction === 'up')
      .map(c => c.threshold)
      .reduce((max, t) => t > max ? t : max, 0) || null;
    if (thresholdCrossed) {
      thresholdAbility = getPietyThreshold(deityName.toLowerCase(), result.newScore);
    }
  }

  return {
    oldScore: result.oldScore,
    newScore: result.newScore,
    change: amount,
    reason,
    thresholdCrossed,
    thresholdAbility
  };
}

/**
 * Sync helper for prompt builders. Takes a character's piety row(s) and
 * builds the per-deity prompt fragment WITHOUT a repository round-trip.
 *
 * Renders one line per deity: `Deity: SCORE/highest_unlocked (next: NEXT_TIER)`
 * — the gap-fix prompt-injection per spec §2.6.3. Returns empty string
 * when piety array is empty so callers can string-concatenate safely.
 *
 * @param {Array<object>} pietyRows  rows shaped like `getAllCharacterPiety` output (deity_name, piety_score, highest_threshold_unlocked)
 */
export function formatPietyForPrompt(pietyRows) {
  if (!Array.isArray(pietyRows) || pietyRows.length === 0) return '';
  const lines = pietyRows.map(r => {
    const score = r.piety_score ?? 0;
    const highest = r.highest_threshold_unlocked ?? 0;
    const nextThreshold = PIETY_THRESHOLDS.find(t => t > highest);
    const nextNote = nextThreshold ? `, next at ${nextThreshold}` : ', max tier reached';
    return `- ${r.deity_name}: ${score} piety (unlocked ${highest > 0 ? highest : 'none'}${nextNote})`;
  });
  return lines.join('\n');
}

/**
 * Legacy threshold-crossing helper. Now redundant with the abstraction's
 * threshold dispatch (registered above) — preserved as a back-compat
 * export for any external consumers and for direct unit-test access.
 *
 * Internally, it just runs the same UPDATE the registered handler runs,
 * plus returns the abstraction-shaped result. Safe to call independently
 * of adjustStanding (e.g., a backfill job).
 */
export async function checkNewThreshold(characterId, deityName, oldScore, newScore) {
  let thresholdCrossed = null;
  let thresholdAbility = null;

  if (newScore > oldScore) {
    for (const threshold of PIETY_THRESHOLDS) {
      if (oldScore < threshold && newScore >= threshold) {
        thresholdCrossed = threshold;
      }
    }
  }

  if (thresholdCrossed) {
    await dbRun(
      `UPDATE character_piety SET highest_threshold_unlocked = ?
       WHERE character_id = ? AND deity_name = ? COLLATE NOCASE
       AND highest_threshold_unlocked < ?`,
      [thresholdCrossed, characterId, deityName, thresholdCrossed]
    );
    thresholdAbility = getPietyThreshold(deityName.toLowerCase(), newScore);
  }

  return { thresholdCrossed, thresholdAbility };
}

// ============================================================
// HISTORY
// ============================================================

/**
 * Get piety change history for a character's deity.
 */
export async function getPietyHistory(characterId, deityName = null, limit = 50) {
  if (deityName) {
    return dbAll(
      'SELECT * FROM piety_history WHERE character_id = ? AND deity_name = ? COLLATE NOCASE ORDER BY created_at DESC LIMIT ?',
      [characterId, deityName, limit]
    );
  }
  return dbAll(
    'SELECT * FROM piety_history WHERE character_id = ? ORDER BY created_at DESC LIMIT ?',
    [characterId, limit]
  );
}
