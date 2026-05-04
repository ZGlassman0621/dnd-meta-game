/**
 * Marker pipeline (Phase 3 SC-6.1).
 *
 * Two parallel marker-processing pipelines run in the codebase today:
 *   1. Schema-driven (`markerSchemas.js` + `ruleVerifiers.js` + correction-loop)
 *      — validates AI output, surfaces correction notes for next-turn re-emission,
 *      but DOES NOT drive side effects.
 *   2. Ad-hoc detect-functions sprawl (`dmSessionService.js` ~28 functions)
 *      — drives side effects, but lacks schema validation, has 28 separate
 *      regex parsers with inconsistent error handling, and silently drops
 *      malformed markers.
 *
 * SC-6.1 lays the foundation for consolidation: a small dispatch module that
 * pairs each existing marker schema with a registered handler. The handler
 * is the single place that knows about the consumer service. Per spec §3.3,
 * this is the integration point with §3.1's standing-scalar abstraction —
 * standing markers like [PIETY_CHANGE] and [BOND_SHIFT] become handlers
 * that call `adjustStanding(...)`.
 *
 * Per spec §3.7 + DECISION_LOG entry 2026-05-03: this module wires
 * ALONGSIDE the existing detect-functions in routes/dmSession.js. No
 * handlers are registered yet at SC-6.1 ship; behavior is unchanged.
 * SC-2 through SC-5 register their per-system handlers as part of those
 * sub-checkpoints (§4.2 — handlers move WITH abstraction migrations to
 * keep the codebase honest about half-implementations).
 *
 * Public API (per spec §3.7):
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
