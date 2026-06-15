/**
 * DM Mode Bond-Shift Service (Phase 3 SC-5).
 *
 * Extracted from `routes/dmMode.js` per spec §2.7 step 1. Owns the
 * application of warmth/trust deltas to the per-pair `party_relationships`
 * sub-object inside each character's entry in `dm_mode_parties.party_data`.
 *
 * Three application paths converge here:
 *   1. Per-turn `[BOND_SHIFT]` markers (was lines 295-329 in routes/dmMode.js)
 *   2. Session-end Sonnet extraction (`dmModeChronicleService.extractRelationshipEvolution`)
 *   3. Manual DM adjustment (`PUT /api/dm-mode/party/:partyId/relationship`)
 *
 * All three paths converge on the abstraction's clamp-to-range logic via
 * `clampToRange(value, config.range)` — single source of truth for the
 * [-5, +5] floor/ceiling. The shared-history shape (one entry per shift,
 * combining warmth+trust deltas into a single `shift` string, FIFO max 10)
 * lives consumer-side because per-config audit doesn't fit a SHARED audit
 * column. See SC-5 DECISION_LOG entry for the audit-strategy reasoning.
 *
 * Per spec §2.7 step 7: `[BOND_SHIFT]` marker handler registered in the
 * markerPipeline at module-load. Replaces the inline detect-function
 * call in `routes/dmMode.js`. Legacy `detectBondShifts` stays exported
 * in `dmModeService.js` per the "deprecate by hiding" policy.
 *
 * **Schema migration to a `party_relationships` table is OUT of scope**
 * per Phase 3 Call 3 — that's Phase 6 work. The repository callbacks here
 * encode the JSON-blob walk (load → parse → mutate → stringify → write);
 * Phase 6 will swap them for SQL on a dedicated table without the
 * abstraction or the call sites needing to change.
 */

import { dbGet, dbRun } from '../database.js';
import { AUDIT_STRATEGIES, clampToRange } from './standingScalar.js';
import { registerHandler as registerMarkerHandler } from './markerPipeline.js';

const HISTORY_FIFO_MAX = 10;

/**
 * Walk into the JSON blob to find the relationship sub-object. Returns
 * `{ characters, fromChar, rel }` or `null` if any link in the chain is
 * missing. Caller is responsible for write-back (the walk doesn't mutate
 * its own copy of `characters` — that's the caller's reference).
 */
async function loadRelationship(partyId, fromCharName, toCharName) {
  const row = await dbGet('SELECT party_data FROM dm_mode_parties WHERE id = ?', [partyId]);
  if (!row) return null;
  let characters;
  try { characters = JSON.parse(row.party_data || '[]'); }
  catch { return null; }
  const fromChar = characters.find(c => c.name === fromCharName);
  if (!fromChar?.party_relationships) return null;
  const rel = fromChar.party_relationships[toCharName];
  if (!rel) return null;
  return { characters, fromChar, rel };
}

async function persistCharacters(partyId, characters) {
  await dbRun(
    'UPDATE dm_mode_parties SET party_data = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [JSON.stringify(characters), partyId]
  );
}

// ============================================================
// STANDING-SCALAR CONFIGS (Phase 3 SC-5 — dual-scalar + directional pair)
// ============================================================

/**
 * DM Mode bond-warmth configuration. Range -5..+5, default 0, no label
 * bands (warmth surfaces in prompts as raw signed integer via
 * `dmModePromptBuilder.js` lines 326-330). Audit storage = NONE — the
 * per-pair history array is SHARED with trust (one entry combines
 * warmth+trust deltas), so per-config audit doesn't fit. The wrapper
 * `applyBondShift` below owns the shared-history append.
 *
 * ContextKey shape: `{ partyId, fromCharName, toCharName }` — directional
 * (A→B is independent of B→A; the JSON blob stores them as separate
 * sub-objects under each character's `party_relationships` map).
 */
export const DM_MODE_BOND_WARMTH_CONFIG = {
  name: 'dm_mode_bond_warmth',
  range: { min: -5, max: 5 },
  defaultValue: 0,
  labelBands: [],
  thresholds: [],
  auditTrail: { storage: AUDIT_STRATEGIES.NONE },
  formatForPrompt: (current) => {
    const sign = current.score >= 0 ? '+' : '';
    return `warmth: ${sign}${current.score}`;
  },
  repository: {
    async readScore(contextKey) {
      const found = await loadRelationship(contextKey.partyId, contextKey.fromCharName, contextKey.toCharName);
      return found ? (found.rel.warmth ?? 0) : null;
    },
    async writeScore(contextKey, newScore) {
      const found = await loadRelationship(contextKey.partyId, contextKey.fromCharName, contextKey.toCharName);
      if (!found) return;
      found.rel.warmth = newScore;
      await persistCharacters(contextKey.partyId, found.characters);
    }
    // No appendAuditEntry — auditTrail.storage = NONE. The shared history
    // is owned by applyBondShift below.
  }
};

/**
 * DM Mode bond-trust configuration. Same shape as warmth — second scalar
 * on the same per-pair sub-object. Independent in the abstraction's
 * eyes (distinct `name` → distinct threshold registry, independent
 * configurations); shares storage location with warmth via the consumer's
 * repository callbacks. See spec §2.7 step 2.
 */
export const DM_MODE_BOND_TRUST_CONFIG = {
  name: 'dm_mode_bond_trust',
  range: { min: -5, max: 5 },
  defaultValue: 0,
  labelBands: [],
  thresholds: [],
  auditTrail: { storage: AUDIT_STRATEGIES.NONE },
  formatForPrompt: (current) => {
    const sign = current.score >= 0 ? '+' : '';
    return `trust: ${sign}${current.score}`;
  },
  repository: {
    async readScore(contextKey) {
      const found = await loadRelationship(contextKey.partyId, contextKey.fromCharName, contextKey.toCharName);
      return found ? (found.rel.trust ?? 0) : null;
    },
    async writeScore(contextKey, newScore) {
      const found = await loadRelationship(contextKey.partyId, contextKey.fromCharName, contextKey.toCharName);
      if (!found) return;
      found.rel.trust = newScore;
      await persistCharacters(contextKey.partyId, found.characters);
    }
  }
};

// ============================================================
// SHARED-HISTORY APPLICATION WRAPPER
// ============================================================

/**
 * Internal helper — push a unified history entry (combining warmth+trust
 * deltas into a single `shift` string) and trim FIFO to max 10. Mutates
 * `rel.history` in place. The caller is responsible for write-back.
 *
 * Matches the legacy shape from routes/dmMode.js lines 316-322 and
 * dmModeChronicleService.js lines 366-378 exactly — preserves any UI or
 * prompt-builder code that reads rel.history (`dmModePromptBuilder.js`
 * line 333 — "Recent: ${h.shift} — ${h.reason} (Session ${h.session})").
 */
function pushSharedHistoryEntry(rel, warmthDelta, trustDelta, reason, sessionLabel) {
  if (!rel.history) rel.history = [];
  const deltas = [];
  if (warmthDelta) deltas.push(`warmth${warmthDelta > 0 ? '+' : ''}${warmthDelta}`);
  if (trustDelta) deltas.push(`trust${trustDelta > 0 ? '+' : ''}${trustDelta}`);
  if (deltas.length === 0) return;
  rel.history.push({
    session: sessionLabel,
    shift: deltas.join(', '),
    reason: reason || ''
  });
  if (rel.history.length > HISTORY_FIFO_MAX) {
    rel.history = rel.history.slice(-HISTORY_FIFO_MAX);
  }
}

/**
 * Mutate a relationship sub-object's scalars + shared history IN PLACE.
 * Used by callers that have their own load + persist logic (e.g.,
 * dmModeChronicleService.extractRelationshipEvolution, which needs to
 * also set rel.attitude / rel.tension and preserve the JSON blob's
 * original array-vs-object shape on write).
 *
 * Routes the clamp through `clampToRange(value, config.range)` so the
 * [-5, +5] bounds stay a single source of truth. Pushes a unified
 * history entry combining warmth+trust deltas (FIFO max 10).
 */
export function mutateRelationshipScalars(rel, warmthDelta, trustDelta, reason, sessionLabel) {
  rel.warmth = clampToRange((rel.warmth || 0) + (warmthDelta || 0), DM_MODE_BOND_WARMTH_CONFIG.range);
  rel.trust = clampToRange((rel.trust || 0) + (trustDelta || 0), DM_MODE_BOND_TRUST_CONFIG.range);
  pushSharedHistoryEntry(rel, warmthDelta, trustDelta, reason, sessionLabel);
}

/**
 * Apply a SINGLE bond shift to the party_data JSON blob. One read + one
 * write per call. Mutates rel.warmth + rel.trust + rel.history.
 *
 * The clamp-to-range step routes through the abstraction's `clampToRange`
 * — single source of truth for the [-5, +5] bounds (config.range). The
 * shared-history append stays consumer-side here.
 *
 * Call shape mirrors the legacy inline application:
 *   - warmthDelta / trustDelta are signed deltas (-N to apply DOWN)
 *   - reason: free-text from the AI marker / Sonnet extraction / DM note
 *   - sessionLabel: number for in-session shifts, string ('dm') for manual
 *
 * Returns the updated `{ warmth, trust, history }` for the caller, or
 * null when the relationship isn't found (silent — matches legacy
 * `if (!rel) continue` behavior).
 */
export async function applyBondShift(partyId, fromCharName, toCharName, warmthDelta, trustDelta, reason, sessionLabel) {
  const found = await loadRelationship(partyId, fromCharName, toCharName);
  if (!found) return null;
  const { characters, rel } = found;

  rel.warmth = clampToRange((rel.warmth || 0) + (warmthDelta || 0), DM_MODE_BOND_WARMTH_CONFIG.range);
  rel.trust = clampToRange((rel.trust || 0) + (trustDelta || 0), DM_MODE_BOND_TRUST_CONFIG.range);

  pushSharedHistoryEntry(rel, warmthDelta, trustDelta, reason, sessionLabel);

  await persistCharacters(partyId, characters);
  return { warmth: rel.warmth, trust: rel.trust, history: rel.history };
}

/**
 * Apply a BATCH of bond shifts to one party's party_data with a single
 * read + single write. Used by the per-turn `[BOND_SHIFT]` marker path
 * (typically 0-2 shifts per turn) to avoid N round-trips.
 *
 * Each entry in `shifts`: `{ from, to, warmthDelta, trustDelta, reason }`.
 * Order is preserved (legacy behavior — each shift sees the cumulative
 * effect of prior shifts in the same batch on the same pair).
 *
 * Returns the updated `characters` array on success, null when party
 * doesn't exist or the JSON is malformed. Per-shift misses (unknown
 * from-char / unknown rel) are silently skipped — matches legacy.
 */
export async function applyBondShifts(partyId, shifts, sessionLabel) {
  if (!shifts || shifts.length === 0) return null;
  const row = await dbGet('SELECT party_data FROM dm_mode_parties WHERE id = ?', [partyId]);
  if (!row) return null;
  let characters;
  try { characters = JSON.parse(row.party_data || '[]'); }
  catch { return null; }

  for (const shift of shifts) {
    const fromChar = characters.find(c => c.name === shift.from);
    if (!fromChar?.party_relationships) continue;
    const rel = fromChar.party_relationships[shift.to];
    if (!rel) continue;

    rel.warmth = clampToRange((rel.warmth || 0) + (shift.warmthDelta || 0), DM_MODE_BOND_WARMTH_CONFIG.range);
    rel.trust = clampToRange((rel.trust || 0) + (shift.trustDelta || 0), DM_MODE_BOND_TRUST_CONFIG.range);
    pushSharedHistoryEntry(rel, shift.warmthDelta || 0, shift.trustDelta || 0, shift.reason, sessionLabel);
  }

  await persistCharacters(partyId, characters);
  return characters;
}

// ============================================================
// MARKER PIPELINE HANDLER
// ============================================================

// `[BOND_SHIFT]` handler. The pipeline's context (passed from
// routes/dmMode.js's processResponseMarkers call) carries `partyId` and
// `sessionLabel`. Multiple BOND_SHIFTs in a single response fire this
// handler N times — each does one read + one write. Acceptable because
// BOND_SHIFTs are rare per turn ("most messages have none" per the
// system prompt at dmModePromptBuilder.js line 585).
registerMarkerHandler('BOND_SHIFT', async (parsed, context) => {
  if (!context?.partyId) {
    console.warn('[dmModeBondShiftService] BOND_SHIFT handler invoked without partyId');
    return null;
  }
  return applyBondShift(
    context.partyId,
    parsed.From,
    parsed.To,
    parsed.Warmth || 0,
    parsed.Trust || 0,
    parsed.Reason || '',
    context.sessionLabel ?? '?'
  );
});
