/**
 * Marker/rule correction retry (P1-G).
 *
 * When the AI emits a malformed marker (or breaks a response rule), the
 * failure is stashed on `dm_sessions.session_config.pendingMarkerCorrections`
 * so the next turns' system prompts can ask the AI to re-emit. Previously
 * the pending correction was consumed unconditionally after a single turn —
 * if the AI ignored it, the correction (and the marker's intent) was lost.
 *
 * Now pending corrections are entries:
 *   { kind: 'marker'|'rule', text, keys, attempts }
 * where `keys` are the schema keys (marker) or rule names (rule) the entry
 * covers, and `attempts` counts how many times it has been surfaced.
 *
 * An entry clears when its failure stops recurring (the AI re-emitted
 * correctly, or dropped the marker/rule break). If it is still failing after
 * MAX_CORRECTION_ATTEMPTS surfacings, it is dropped and its keys are added
 * to `session_config.correctionExhaustedKeys` — the AI has demonstrated it
 * won't act on the note, so we stop nagging. A key leaves the exhausted set
 * as soon as a turn passes without that failure, so a later recurrence is
 * treated as a new correction with fresh attempts.
 *
 * All functions here are pure (no DB); the route owns persistence.
 */

import { buildCorrectionMessage } from './markerSchemas.js';
import { buildRuleCorrectionMessage } from './ruleVerifiers.js';

/**
 * How many turns a correction is re-surfaced before being dropped. A
 * correction clears early if its failure stops recurring; otherwise it gets
 * this many chances before we stop nagging the AI.
 */
export const MAX_CORRECTION_ATTEMPTS = 3;

/**
 * Normalize a stored pendingMarkerCorrections value to an entry array.
 * Legacy plain-string format is dropped — it was already surfaced under the
 * old single-turn rule, so carrying it forward would be a behavior change.
 */
export function normalizeCorrectionEntries(pending) {
  if (Array.isArray(pending)) {
    return pending.filter(e => e && typeof e.text === 'string');
  }
  return [];
}

/**
 * Render stored pending corrections to the text injected into the system
 * prompt. Handles the legacy plain-string format.
 */
export function renderCorrectionText(pending) {
  if (Array.isArray(pending)) {
    return pending.map(e => e?.text).filter(Boolean).join('\n');
  }
  return pending;
}

/**
 * Compute the next pending-correction entries after a turn's validation.
 *
 * - Prior entries whose failure still recurs and that haven't exhausted
 *   their attempts are carried forward with attempts + 1.
 * - Prior entries still failing at the attempt cap are dropped and their
 *   keys added to the exhausted set (no re-queue while the failure persists).
 * - New failures not already covered by carried entries, and not exhausted,
 *   are queued as fresh entries (attempts: 0).
 * - Exhausted keys are pruned as soon as a turn passes without that failure.
 *
 * @param {*} priorPending - stored pendingMarkerCorrections (array|string|undefined)
 * @param {Array} failures - validateDmMarkers failures [{ schemaKey, errors }]
 * @param {Array} ruleViolations - verifyDmResponse violations [{ rule, ... }]
 * @param {Object} options - { maxAttempts, exhaustedKeys }
 * @returns {{ entries: Array, exhaustedKeys: Array }}
 */
export function nextCorrectionEntries(priorPending, failures, ruleViolations, options = {}) {
  const { maxAttempts = MAX_CORRECTION_ATTEMPTS, exhaustedKeys = [] } = options;
  const exhausted = new Set(exhaustedKeys);
  const priorEntries = normalizeCorrectionEntries(priorPending);
  const failedKeys = new Set((failures || []).map(f => f.schemaKey));
  const violatedRules = new Set((ruleViolations || []).map(v => v.rule));

  const carried = [];
  const newlyExhausted = [];
  for (const entry of priorEntries) {
    const keys = Array.isArray(entry.keys) ? entry.keys : [];
    const stillFailing = entry.kind === 'rule'
      ? keys.some(k => violatedRules.has(k))
      : keys.some(k => failedKeys.has(k));
    if (!stillFailing) continue; // fixed → drop
    if (entry.attempts + 1 < maxAttempts) {
      carried.push({ ...entry, attempts: entry.attempts + 1 });
    } else {
      newlyExhausted.push(...keys); // exhausted → drop + remember
    }
  }

  const coveredKeys = new Set(carried.flatMap(e => e.keys || []));
  const blockedKeys = new Set([...exhausted, ...newlyExhausted]);

  const uncoveredFailures = (failures || [])
    .filter(f => !coveredKeys.has(f.schemaKey) && !blockedKeys.has(f.schemaKey));
  if (uncoveredFailures.length > 0) {
    const msg = buildCorrectionMessage(uncoveredFailures);
    if (msg) {
      carried.push({
        kind: 'marker',
        text: msg,
        keys: [...new Set(uncoveredFailures.map(f => f.schemaKey))],
        attempts: 0
      });
    }
  }

  const uncoveredViolations = (ruleViolations || [])
    .filter(v => !coveredKeys.has(v.rule) && !blockedKeys.has(v.rule));
  if (uncoveredViolations.length > 0) {
    const msg = buildRuleCorrectionMessage(uncoveredViolations);
    if (msg) {
      carried.push({
        kind: 'rule',
        text: msg,
        keys: [...new Set(uncoveredViolations.map(v => v.rule))],
        attempts: 0
      });
    }
  }

  // Prune exhausted keys that are no longer failing — a clean turn wipes the
  // slate, so a later recurrence is treated as a new correction.
  const stillActiveKeys = new Set([...failedKeys, ...violatedRules]);
  const nextExhausted = [...blockedKeys].filter(k => stillActiveKeys.has(k));

  return { entries: carried, exhaustedKeys: nextExhausted };
}
