/**
 * Marker pipeline — validation and dispatch for AI-emitted markers.
 *
 * This is THE marker pipeline. All ~26 handled marker schemas dispatch through
 * `processResponseMarkers` below; each handler is registered by the service
 * that owns its side effect, at that service's module load. A handler service
 * must therefore be imported for side effect in `routes/dmSession.js` or it
 * silently never runs.
 *
 * CORRECTION (Phase 3.5): this header previously read "No handlers are
 * registered yet at SC-6.1 ship; behavior is unchanged", describing the state
 * on the day the module landed. It stayed there while 26 handlers accumulated,
 * and a subsequent audit built a whole finding on it — concluding the codebase
 * ran two competing marker pipelines and that the "legacy" detect-functions
 * needed deleting. It does not, and they did not. The note is corrected here
 * rather than removed, because the failure mode is worth remembering: a comment
 * describing a moment in time reads as a description of the present.
 *
 * What is genuinely still true:
 *   • `markerSchemas.js` defines ~50 schemas; a schema with no handler is a
 *     legitimate end state, because validation alone feeds the correction loop.
 *   • `ruleVerifiers.js` stays a parallel sibling — text-pattern detection with
 *     no schema. The two are combined only at the last mile, in
 *     `buildPendingCorrectionsNote`.
 *   • Handler errors are CONTAINED: they land in `handlerResults` as
 *     `{ok:false}` and never throw. That is why marker dispatch must not be
 *     wrapped in a transaction — a rolled-back turn would surface as a 200 with
 *     a saved narrative and no effects. See CLAUDE.md, "The turn loop".
 *
 * Public API:
 *   registerHandler(schemaKey, handler)
 *   processResponseMarkers(text, context) → { handlerResults, failures }
 *   buildPendingCorrectionsNote({ markerFailures, ruleViolations }) → string|null
 *
 * Reuses unchanged: validateDmMarkers (markerSchemas.js),
 * buildCorrectionMessage (markerSchemas.js), buildRuleCorrectionMessage
 * (ruleVerifiers.js). The pipeline composes these; it doesn't reimplement.
 */

import { validateDmMarkers, buildCorrectionMessage } from './markerSchemas.js'
import { buildRuleCorrectionMessage } from './ruleVerifiers.js'

// Module-level handler registry. Per spec Q3 (recommendation: module-load
// timing), consumers call registerHandler at service-file import. One
// handler per schemaKey; replacing a handler logs a warning (common in
// tests; rare in production).
const HANDLER_REGISTRY = new Map()

// ============================================================
// Public API
// ============================================================

/**
 * Register a handler for a marker schema. Handler is a pure function from
 * (parsedMarker, context) → Promise<any>. Called once per successful marker
 * parse during processResponseMarkers.
 *
 * @param {string}   schemaKey  one of the keys in MARKER_SCHEMAS (markerSchemas.js)
 * @param {function} handler    async (parsedMarker, context) => any
 */
export function registerHandler(schemaKey, handler) {
  if (typeof schemaKey !== 'string' || !schemaKey) {
    throw new Error('registerHandler: schemaKey (string) required')
  }
  if (typeof handler !== 'function') {
    throw new Error(`registerHandler(${schemaKey}): handler must be a function`)
  }
  if (HANDLER_REGISTRY.has(schemaKey)) {
    console.warn(`[markerPipeline] replacing handler for ${schemaKey}`)
  }
  HANDLER_REGISTRY.set(schemaKey, handler)
}

/**
 * Process all markers in a response text. Validates each schema's marker
 * instances; for successful parses, dispatches to the registered handler;
 * collects validation failures separately for correction-loop feedback.
 *
 * Per spec §3.7's example shape — returned object has:
 *   handlerResults: [{ schemaKey, parsed, result, ok: true } | { ..., error, ok: false }]
 *   failures:       [{ schemaKey, errors, rawBody }]
 *
 * Handler errors are CONTAINED — they go in handlerResults with ok:false
 * but don't throw or stop other markers from dispatching. This parallels
 * the standingScalar abstraction's error-containment policy and matches
 * spec Q5 (recommendation: log errors only; don't surface engineering
 * detail to the AI).
 *
 * Markers with no registered handler are silently skipped (still parsed,
 * but no dispatch). Schemas in MARKER_SCHEMAS without handlers are valid —
 * during the migration from detect-functions, some markers will have
 * handlers and some won't yet.
 *
 * @param {string} text     AI response text
 * @param {object} context  per-call context passed to each handler (characterId, sessionId, etc.)
 */
export async function processResponseMarkers(text, context = {}) {
  const { validByKey, failures } = validateDmMarkers(text)
  const handlerResults = []

  for (const [schemaKey, instances] of Object.entries(validByKey)) {
    const handler = HANDLER_REGISTRY.get(schemaKey)
    if (!handler) continue

    for (const parsed of instances) {
      try {
        const result = await handler(parsed, context)
        handlerResults.push({ schemaKey, parsed, result, ok: true })
      } catch (err) {
        const message = err?.message || String(err)
        handlerResults.push({ schemaKey, parsed, error: message, ok: false })
        console.error(`[markerPipeline] handler error for ${schemaKey}:`, err)
      }
    }
  }

  return { handlerResults, failures }
}

/**
 * Combine marker validation failures + rule violations into a single
 * correction note for next-turn injection. Returns null when both are
 * empty (no correction needed).
 *
 * Composes existing helpers — buildCorrectionMessage from markerSchemas.js
 * for marker failures, buildRuleCorrectionMessage from ruleVerifiers.js
 * for rule violations. The pipeline's contribution is just the combination.
 *
 * Per spec §3.8 + Q4: rule verification stays a parallel sibling system
 * (categorically different operation — text pattern detection, no schema).
 * The combined-note path here unifies them at the LAST mile (the
 * SYSTEM-note prepended to next turn) without unifying their detection.
 *
 * @returns {string|null}
 */
export function buildPendingCorrectionsNote({ markerFailures, ruleViolations } = {}) {
  const parts = []
  if (Array.isArray(markerFailures) && markerFailures.length > 0) {
    const msg = buildCorrectionMessage(markerFailures)
    if (msg) parts.push(msg)
  }
  if (Array.isArray(ruleViolations) && ruleViolations.length > 0) {
    const msg = buildRuleCorrectionMessage(ruleViolations)
    if (msg) parts.push(msg)
  }
  return parts.length > 0 ? parts.join('\n') : null
}

// ============================================================
// Test-only helpers (not part of the public API contract)
// ============================================================

/** Reset the handler registry. Used by tests to isolate runs. */
export function _resetHandlerRegistry() {
  HANDLER_REGISTRY.clear()
}

/** Return the count of registered handlers. Used by tests. */
export function _getHandlerCount() {
  return HANDLER_REGISTRY.size
}

/** Check if a handler is registered for a schema key. Used by tests. */
export function _hasHandler(schemaKey) {
  return HANDLER_REGISTRY.has(schemaKey)
}
