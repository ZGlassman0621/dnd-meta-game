/**
 * Standing-scalar abstraction (Phase 3 SC-1).
 *
 * A behavioral library — not a schema, not a single source of truth. Five
 * existing standing systems (companion loyalty, faction standing, NPC
 * disposition, Mythic piety, DM Mode bond-shifts) all track "an integer
 * score representing a relationship + a label + an audit trail of changes."
 * Each does this with a different schema, different range, different
 * label cuts, and different audit-trail strategy. This module provides
 * the shared BEHAVIOR (range clamping, label mapping, audit recording,
 * threshold detection, prompt formatting, side-effect dispatch) without
 * forcing schema convergence.
 *
 * Per PHASE_3_REFACTOR_SPEC §2 + DECISION_LOG entry 2026-05-03 Call 1
 * (Parameterize, don't converge): each consumer keeps its own table,
 * column names, range, defaults, label-band cuts. Configuration is
 * per-consumer-static (defined in the consumer's service file as a
 * module-level constant). Storage is owned by the consumer via the
 * `repository` callbacks injected through the configuration object —
 * the abstraction never builds SQL itself.
 *
 * Public API (per spec §2.3):
 *   adjustStanding(config, contextKey, change, options)
 *   getStanding(config, contextKey)
 *   formatStandingForPrompt(config, contextKey)
 *   registerThresholdHandler(config, threshold, handler)
 *
 * Internal helpers (private to this module):
 *   clampToRange(value, range)
 *   mapToLabel(score, labelBands)
 *   recordAuditEntry(config, contextKey, entry) — delegates to repository
 *   detectThresholdCrossings(oldScore, newScore, thresholds)
 *
 * Configuration shape (per spec §2.2; see CONFIG_KEYS for documentation):
 *   {
 *     name: string,
 *     range: { min, max },          // max may be Infinity for piety
 *     defaultValue: number,
 *     labelBands: [{ atOrAbove, label }, ...]   // descending; first match wins; may be empty
 *     thresholds: [{ value, direction: 'up'|'down'|'both' }, ...]
 *     auditTrail: { storage, ... }   // see AUDIT_STRATEGIES below
 *     formatForPrompt: (current) => string
 *     repository: {                  // injected by consumer; abstraction never builds SQL
 *       readScore(contextKey): Promise<number|null>
 *       writeScore(contextKey, newScore): Promise<void>
 *       readAuditTrail(contextKey, limit): Promise<array>
 *       appendAuditEntry(contextKey, entry): Promise<void>
 *     }
 *   }
 *
 * What this module does NOT do (per spec §2.1):
 *   - Storage: each consumer owns its own table + columns. Writes go through
 *     the consumer's `repository` callbacks. The abstraction never builds SQL.
 *   - Migration of legacy data: clean slate per Phase 3 entry call.
 *   - Cross-consumer queries: artifact of schema convergence (rejected).
 *   - Range/label/threshold convergence: 0–100 loyalty stays 0–100;
 *     -100..+100 disposition stays -100..+100; piety stays 0-to-no-cap.
 */

// Audit-trail storage strategies recognized by the abstraction. Per Q1 in
// spec §6, the 'split_by_sign' strategy supports faction standing's
// dual-array audit (deeds_for / deeds_against, picked by sign of change).
// 'inline_json' is the most common (companion loyalty, NPC disposition).
// 'separate_table' is piety's strategy. 'none' lets a consumer opt out
// entirely (the abstraction skips the audit step).
//
// Each strategy is enacted by the consumer's repository.appendAuditEntry
// callback — the abstraction passes the strategy through as metadata on
// the entry so the repository knows which path to take.
export const AUDIT_STRATEGIES = Object.freeze({
  INLINE_JSON: 'inline_json',
  SEPARATE_TABLE: 'separate_table',
  SPLIT_BY_SIGN: 'split_by_sign',
  NONE: 'none'
})

// Module-level threshold handler registry. Per Q3 in spec §6 (recommendation:
// module-load registration). One handler per (configName, thresholdValue,
// direction) tuple. Replacing a handler logs a warning — common cause is
// double-import in tests.
const THRESHOLD_HANDLERS = new Map()
const _handlerKey = (configName, threshold, direction) =>
  `${configName}:${threshold}:${direction}`

// ============================================================
// Public API
// ============================================================

/**
 * Adjust a standing scalar. Clamps to range, records audit entry, detects
 * threshold crossings, dispatches threshold handlers.
 *
 * @param {object} config        — see module header for shape
 * @param {object} contextKey    — opaque to the abstraction; passed to repository callbacks
 * @param {number} change        — signed integer
 * @param {object} options       — { reason?, sessionId?, gameDay? }
 * @returns {object} { oldScore, newScore, change, label, thresholdsCrossed }
 *
 * Threshold crossings fire AFTER the score is written. Handler errors are
 * logged but don't block the adjust call's success — adjust returns
 * normally even if a handler throws (parallels markerPipeline.js's
 * handler-error containment policy).
 */
export async function adjustStanding(config, contextKey, change, options = {}) {
  validateConfig(config)
  const oldScoreRaw = await config.repository.readScore(contextKey)
  const oldScore = oldScoreRaw == null ? config.defaultValue : oldScoreRaw

  // Clamp to range. Piety has max=Infinity; clamp still works (Math.min(Infinity, x) = x).
  const newScore = clampToRange(oldScore + change, config.range)
  const label = mapToLabel(newScore, config.labelBands)

  await config.repository.writeScore(contextKey, newScore)

  // Audit trail — skip when strategy is 'none' or no reason supplied
  // (silent score adjustments shouldn't pollute the trail).
  const auditStorage = config.auditTrail?.storage
  if (auditStorage && auditStorage !== AUDIT_STRATEGIES.NONE && options.reason) {
    const entry = {
      strategy: auditStorage,
      change,
      newScore,
      reason: options.reason,
      sessionId: options.sessionId ?? null,
      gameDay: options.gameDay ?? null,
      date: new Date().toISOString()
    }
    await recordAuditEntry(config, contextKey, entry)
  }

  // Threshold dispatch. Crossings fire on cross-up, cross-down, or both
  // depending on each threshold's direction. Per Invariant B in spec §2.8,
  // existing per-system cascades stay consumer-side — this dispatch is
  // future-facing, exercised by piety's checkNewThreshold migration in SC-4.
  const thresholdsCrossed = detectThresholdCrossings(oldScore, newScore, config.thresholds || [])
  for (const crossing of thresholdsCrossed) {
    const handler = THRESHOLD_HANDLERS.get(_handlerKey(config.name, crossing.threshold, crossing.direction))
    if (!handler) continue
    try {
      await handler({
        configName: config.name,
        contextKey,
        threshold: crossing.threshold,
        direction: crossing.direction,
        oldScore,
        newScore,
        ...options
      })
    } catch (err) {
      console.error(`[standingScalar] threshold handler error for ${config.name}:${crossing.threshold}:${crossing.direction}:`, err)
    }
  }

  return { oldScore, newScore, change, label, thresholdsCrossed }
}

/**
 * Read current standing for a context. Returns null when the consumer's
 * repository reports no row exists for this context (the abstraction does
 * NOT auto-create — consumers manage row lifecycle, see spec §2.4 for
 * companion loyalty's get-or-create pattern outside the abstraction).
 *
 * @returns {object|null} { score, label, recentAuditEntries } or null
 */
export async function getStanding(config, contextKey) {
  validateConfig(config)
  const score = await config.repository.readScore(contextKey)
  if (score == null) return null
  const label = mapToLabel(score, config.labelBands)
  const recentAuditEntries = config.repository.readAuditTrail
    ? await config.repository.readAuditTrail(contextKey, 5)
    : []
  return { score, label, recentAuditEntries }
}

/**
 * Render a standing into a string fragment for prompt builders. Returns
 * the empty string when no standing exists for this context, so callers
 * can string-concatenate without conditionals.
 *
 * Each consumer's config supplies its own `formatForPrompt(current)`
 * function — the abstraction provides the consistent call site (and
 * the empty-when-absent contract) but doesn't dictate format.
 */
export async function formatStandingForPrompt(config, contextKey) {
  validateConfig(config)
  const current = await getStanding(config, contextKey)
  if (!current) return ''
  if (typeof config.formatForPrompt !== 'function') {
    console.warn(`[standingScalar] config "${config.name}" has no formatForPrompt; returning empty fragment`)
    return ''
  }
  return config.formatForPrompt(current)
}

/**
 * Register a handler for a specific threshold crossing on a specific
 * config. Per spec Q3 (module-load timing): consumers call this once at
 * service-file import time. One handler per (configName, threshold,
 * direction); replacing logs a warning.
 *
 * Handler signature: async (crossingEvent) => void
 *   crossingEvent = { configName, contextKey, threshold, direction, oldScore, newScore, ...options }
 *
 * Per Invariant B in spec §2.8, this API exists in Phase 3 but is only
 * actively exercised by piety's threshold detection in SC-4. Loyalty's
 * checkSecretReveals stays consumer-side because it's per-secret, not
 * per-threshold (doesn't fit the model).
 */
export function registerThresholdHandler(config, threshold, handler, direction = 'up') {
  if (!config?.name) throw new Error('registerThresholdHandler: config.name required')
  if (!Number.isFinite(threshold)) throw new Error('registerThresholdHandler: threshold must be a finite number')
  if (typeof handler !== 'function') throw new Error('registerThresholdHandler: handler must be a function')
  if (!['up', 'down', 'both'].includes(direction)) {
    throw new Error(`registerThresholdHandler: direction must be 'up' | 'down' | 'both', got ${direction}`)
  }
  const key = _handlerKey(config.name, threshold, direction)
  if (THRESHOLD_HANDLERS.has(key)) {
    console.warn(`[standingScalar] replacing threshold handler for ${key}`)
  }
  THRESHOLD_HANDLERS.set(key, handler)
}

// ============================================================
// Internal helpers (private — exported only for unit tests)
// ============================================================

/**
 * Clamp a value to [range.min, range.max]. Handles Infinity bounds (piety
 * has max=Infinity) by short-circuiting Math.min/max appropriately.
 */
export function clampToRange(value, range) {
  if (!range) return value
  let out = value
  if (range.min != null && Number.isFinite(range.min)) out = Math.max(range.min, out)
  if (range.max != null && Number.isFinite(range.max)) out = Math.min(range.max, out)
  return out
}

/**
 * Find the first label band whose `atOrAbove` is <= score. Bands are
 * specified in descending order; returns the band's `label`. Returns
 * null when bands array is empty (e.g., piety uses thresholds instead).
 */
export function mapToLabel(score, labelBands) {
  if (!Array.isArray(labelBands) || labelBands.length === 0) return null
  for (const band of labelBands) {
    if (score >= band.atOrAbove) return band.label
  }
  // Score below the lowest band — return the lowest band's label as the floor.
  // Faction standing's lowest band is 'enemy' at -80; a -100 standing is still 'enemy'.
  return labelBands[labelBands.length - 1].label
}

/**
 * Detect threshold crossings between an old and new score. Returns an
 * array of { threshold, direction } objects, one per crossing.
 *
 * Crossing rules:
 *   - direction 'up' fires when oldScore < threshold && newScore >= threshold
 *   - direction 'down' fires when oldScore >= threshold && newScore < threshold
 *   - direction 'both' fires either way
 *
 * Per piety's behavior (spec §2.6 step 5): cross-up unlocks abilities;
 * cross-down records but doesn't lock. Direction='up' lets piety register
 * handlers that fire only on unlock; direction='down' or 'both' supports
 * future consumers that care about regression.
 */
export function detectThresholdCrossings(oldScore, newScore, thresholds) {
  if (!Array.isArray(thresholds) || thresholds.length === 0) return []
  const crossings = []
  for (const t of thresholds) {
    const value = t.value
    const dir = t.direction || 'up'
    const wentUp = oldScore < value && newScore >= value
    const wentDown = oldScore >= value && newScore < value
    if (dir === 'up' && wentUp) crossings.push({ threshold: value, direction: 'up' })
    else if (dir === 'down' && wentDown) crossings.push({ threshold: value, direction: 'down' })
    else if (dir === 'both') {
      if (wentUp) crossings.push({ threshold: value, direction: 'up' })
      else if (wentDown) crossings.push({ threshold: value, direction: 'down' })
    }
  }
  return crossings
}

/**
 * Delegate audit-trail recording to the consumer's repository. The
 * abstraction passes the entry through with a `strategy` field set per
 * the config; the repository decides whether to push to a JSON column,
 * INSERT into a history table, or split-by-sign across two columns.
 */
async function recordAuditEntry(config, contextKey, entry) {
  if (typeof config.repository.appendAuditEntry !== 'function') {
    console.warn(`[standingScalar] config "${config.name}" has no repository.appendAuditEntry; audit entry skipped`)
    return
  }
  await config.repository.appendAuditEntry(contextKey, entry)
}

// ============================================================
// Validation
// ============================================================

function validateConfig(config) {
  if (!config) throw new Error('standingScalar: config required')
  if (!config.name || typeof config.name !== 'string') {
    throw new Error('standingScalar: config.name (string) required')
  }
  if (!config.range || typeof config.range !== 'object') {
    throw new Error(`standingScalar(${config.name}): config.range required`)
  }
  if (!config.repository || typeof config.repository !== 'object') {
    throw new Error(`standingScalar(${config.name}): config.repository required`)
  }
  if (typeof config.repository.readScore !== 'function') {
    throw new Error(`standingScalar(${config.name}): config.repository.readScore (function) required`)
  }
  if (typeof config.repository.writeScore !== 'function') {
    throw new Error(`standingScalar(${config.name}): config.repository.writeScore (function) required`)
  }
}

// ============================================================
// Test-only helpers (not part of the public API contract)
// ============================================================

/** Reset the threshold handler registry. Used by tests to isolate runs. */
export function _resetThresholdHandlers() {
  THRESHOLD_HANDLERS.clear()
}

/** Return the current handler count. Used by tests to verify registration. */
export function _getThresholdHandlerCount() {
  return THRESHOLD_HANDLERS.size
}
