/**
 * Time-bounded state primitives (Phase 3.3 SC-7.1).
 *
 * A behavioral library for "wait N game-time units, then do X" logic
 * across the codebase. Per Code's Pattern D survey
 * (`triage/pattern-d-survey.md`, 2026-05-04) and PHASE_3_REFACTOR_SPEC §3.3:
 * 11 existing surfaces share the same underlying primitive —
 * **(start_marker, threshold, current_clock) → status / effect** — but
 * each implements it inline with subtle inconsistencies. This module
 * provides shared BEHAVIOR (game-day arithmetic, decay-on-read,
 * threshold-with-effect) without forcing schema convergence.
 *
 * **Parameterize, don't converge** — same call as Pattern A's SC-1
 * (DECISION_LOG entry 2026-05-03). Each consumer keeps its own anchor
 * column, its own decay function shape, its own idempotency strategy.
 * The abstraction provides the orchestration shell; the consumer's
 * `repository` callbacks own storage and the consumer's config
 * functions own the per-system shape decisions.
 *
 * Three primitives per spec §3.3.2:
 *   1. `daysSince(anchorGameDay, currentGameDay)` — normalized arithmetic
 *      helper. Returns null when anchor is null (explicit no-anchor
 *      semantics); returns max(0, elapsed) otherwise.
 *   2. `registerDecayConsumer(config)` — decay-on-read consumer factory.
 *      Returns a consumer-facing API that reads anchor, computes decay
 *      via `config.decayFunction`, clamps to floor/ceiling, writes back
 *      via `config.repository.writeValue`. Three semantics distinguish
 *      consumer behaviors (high-water-mark / consumed / written-back).
 *   3. `registerThresholdConsumer(config)` — threshold-crossed-with-effect
 *      consumer factory. Returns a consumer-facing API that reads anchor,
 *      compares elapsed time to threshold, runs idempotency check,
 *      optionally rolls probability for stochastic crossers, fires the
 *      handler. Idempotency strategy is consumer-owned via callbacks.
 *
 * What this module does NOT do (per spec §3.3.3):
 *   - Game-clock advancement itself. `metaGame.advanceGameTime` owns the
 *     clock; this module consumes it via `currentGameDay` parameters.
 *   - Combat effect rounds (§1.14 client-side state).
 *   - Companion activity completion (lazy-poll, different shape).
 *
 * Per Q11 (spec §3.3.4): API today is day-granularity. Future
 * hour-granularity would grow a unit parameter without breaking call
 * sites. YAGNI today; no future migration cost.
 *
 * Ship status: SC-7.1 lands the primitives only. No consumer migrations
 * yet — those land in SC-7.2 through SC-7.7. Same shape as §3.1's SC-1:
 * foundation ship, API review gate, then incremental consumer migrations.
 */

// ============================================================
// Decay semantics — distinguishes the three observed shapes
// ============================================================
//
// Three shapes were identified in the Pattern D survey:
//   1. high-water-mark (default): anchor stays put across decay ticks.
//      Each tick reads the same anchor + computes decay from elapsed
//      time. Used by NPC disposition decay (§1.2), NPC trust decay
//      (§1.3). The anchor is "last time the event of record occurred."
//   2. consumed: anchor NULLs when value reaches floor. The decay is
//      "consumed" — a one-shot countdown. Used by companion mood
//      (§1.1): mood_set_game_day NULLs when intensity hits 0 and mood
//      resets to 'content'. The anchor is a "decay credit," spent.
//   3. written-back: anchor advances to currentGameDay after each tick.
//      Each tick treats the anchor as "last time we ticked," not "last
//      time the event occurred." Used by notoriety decay (§1.9). Anchor
//      moves forward whether or not the score reaches floor.
//
// Each consumer specifies its semantics in config; the abstraction
// dispatches to the appropriate post-decay anchor handling.
export const DECAY_SEMANTICS = Object.freeze({
  HIGH_WATER_MARK: 'high-water-mark',
  CONSUMED: 'consumed',
  WRITTEN_BACK: 'written-back'
})

// ============================================================
// Primitive 1 — daysSince helper (spec §3.3.2 P1)
// ============================================================

/**
 * Normalized game-day arithmetic. Returns days elapsed between an anchor
 * game-day and the current game-day, or null when no anchor is set.
 *
 * Replaces ~20 sites of inline `currentGameDay - someAnchor` arithmetic
 * across the codebase. Centralizing here means future hour-granularity
 * work, future game-time-unit changes happen in one place.
 *
 * Returns null (not 0 or NaN) when anchorGameDay is null/undefined —
 * explicit "no anchor set" semantics. Callers can distinguish "no
 * anchor" from "0 days elapsed" with a strict null check.
 *
 * Returns max(0, elapsed) when anchor is set — guards against
 * accidentally-negative elapsed times (e.g., game-day rollback during
 * testing). Consumers depending on negative elapsed time as a signal
 * should compute it themselves.
 */
export function daysSince(anchorGameDay, currentGameDay) {
  if (anchorGameDay == null) return null
  if (currentGameDay == null) return null
  return Math.max(0, currentGameDay - anchorGameDay)
}

// ============================================================
// Primitive 2 — registerDecayConsumer (spec §3.3.2 P2)
// ============================================================

/**
 * Build a decay-on-read consumer from a configuration object. Returns
 * an object with `applyDecay(contextKey, currentGameDay, contextHints)`
 * the consumer calls (typically from session-start orchestrators or
 * the living-world tick).
 *
 * Configuration shape:
 *   {
 *     name: string,                           // for logging / introspection
 *     semantics: DECAY_SEMANTICS,             // default HIGH_WATER_MARK
 *     decayFunction: (daysElapsed, currentValue, hints) => number,
 *                                              // returns decay AMOUNT (positive)
 *     floor?: number,                         // value clamp (default -Infinity)
 *     ceiling?: number,                       // value clamp (default Infinity)
 *     repository: {
 *       readAnchor(contextKey) → Promise<number|null>
 *       readValue(contextKey)  → Promise<number>
 *       writeValue(contextKey, newValue) → Promise<void>
 *       consumeAnchor?(contextKey) → Promise<void>     // required if semantics='consumed'
 *       advanceAnchor?(contextKey, newAnchor) → Promise<void>  // required if semantics='written-back'
 *     }
 *   }
 *
 * Per parameterize-not-converge: storage shape is consumer-owned via
 * the repository callbacks. The abstraction never builds SQL; it
 * orchestrates the read → compute → clamp → write sequence and the
 * post-decay anchor handling per semantics.
 *
 * Handler return: `{ oldValue, newValue, decayAmount, daysElapsed }`
 * on apply, `null` on no-op (no anchor / 0 days elapsed / 0 decay).
 */
export function registerDecayConsumer(config) {
  validateDecayConfig(config)

  const semantics = config.semantics || DECAY_SEMANTICS.HIGH_WATER_MARK
  const floor = config.floor != null ? config.floor : -Infinity
  const ceiling = config.ceiling != null ? config.ceiling : Infinity

  return {
    name: config.name,
    semantics,

    async applyDecay(contextKey, currentGameDay, contextHints = {}) {
      const anchor = await config.repository.readAnchor(contextKey)
      if (anchor == null) return null

      const daysElapsed = daysSince(anchor, currentGameDay)
      if (daysElapsed == null || daysElapsed === 0) return null

      const currentValue = await config.repository.readValue(contextKey)
      const decayAmount = config.decayFunction(daysElapsed, currentValue, contextHints)
      if (!decayAmount || decayAmount <= 0) return null

      let newValue = currentValue - decayAmount
      newValue = Math.max(floor, Math.min(ceiling, newValue))

      if (newValue === currentValue) return null  // clamp made it a no-op

      await config.repository.writeValue(contextKey, newValue)

      // Post-decay anchor handling — semantics-specific.
      if (semantics === DECAY_SEMANTICS.CONSUMED && newValue === floor) {
        // Anchor consumed — null it so subsequent ticks no-op until reset.
        if (typeof config.repository.consumeAnchor === 'function') {
          await config.repository.consumeAnchor(contextKey)
        } else {
          console.warn(`[timeBoundedState] consumer "${config.name}" semantics='consumed' but repository.consumeAnchor missing; anchor not nulled at floor`)
        }
      } else if (semantics === DECAY_SEMANTICS.WRITTEN_BACK) {
        // Anchor advances to currentGameDay so next tick measures from now.
        if (typeof config.repository.advanceAnchor === 'function') {
          await config.repository.advanceAnchor(contextKey, currentGameDay)
        } else {
          console.warn(`[timeBoundedState] consumer "${config.name}" semantics='written-back' but repository.advanceAnchor missing; anchor not advanced`)
        }
      }
      // HIGH_WATER_MARK: anchor stays put (no-op).

      return { oldValue: currentValue, newValue, decayAmount, daysElapsed }
    }
  }
}

// ============================================================
// Primitive 3 — registerThresholdConsumer (spec §3.3.2 P3)
// ============================================================

/**
 * Build a threshold-crossed-with-effect consumer from configuration.
 * Returns an object with `checkAndFire(contextKey, currentGameDay, hints)`
 * the consumer calls per-tick.
 *
 * Configuration shape:
 *   {
 *     name: string,                           // for logging / introspection
 *     threshold: number,                      // days from anchor before fire
 *     handler: (contextKey, daysElapsed, hints) => Promise<any>,
 *     probability?: number,                   // 0..1, default 1 (always fire)
 *     idempotency: {
 *       hasFiredRecently(contextKey) → Promise<boolean>
 *       recordFired(contextKey)      → Promise<void>
 *     },
 *     repository: {
 *       readAnchor(contextKey) → Promise<number|null>
 *     }
 *   }
 *
 * Per Q8 (spec §3.3.4): the optional `probability` parameter supports
 * stochastic crossers like NPC relocation (10% roll on 60+ day absence).
 * When the roll fails, idempotency is NOT recorded — the next tick gets
 * a fresh roll.
 *
 * Idempotency strategy is consumer-owned. Common patterns:
 *   - Anchor written-back post-fire (notoriety pattern)
 *   - Status-field comparison (consequence_log entries for promise breaks)
 *   - Separate audit-log check (`hasRecentWarning` in consequenceService)
 *
 * Handler errors are CONTAINED (logged, not thrown) — parallels SC-1's
 * standingScalar threshold-handler containment policy.
 *
 * Returns:
 *   - { fired: true, handlerResult, daysElapsed } when handler ran
 *   - { fired: false, reason } when blocked (no_anchor / before_threshold /
 *     idempotency_blocked / probability_roll_failed / handler_error)
 */
export function registerThresholdConsumer(config) {
  validateThresholdConfig(config)

  const probability = config.probability != null ? config.probability : 1.0

  return {
    name: config.name,
    threshold: config.threshold,

    async checkAndFire(contextKey, currentGameDay, contextHints = {}) {
      const anchor = await config.repository.readAnchor(contextKey)
      if (anchor == null) return { fired: false, reason: 'no_anchor' }

      const daysElapsed = daysSince(anchor, currentGameDay)
      if (daysElapsed == null || daysElapsed < config.threshold) {
        return { fired: false, reason: 'before_threshold', daysElapsed }
      }

      const alreadyFired = await config.idempotency.hasFiredRecently(contextKey)
      if (alreadyFired) {
        return { fired: false, reason: 'idempotency_blocked', daysElapsed }
      }

      // Stochastic threshold support — Q8. Roll BEFORE the handler so
      // failed rolls leave idempotency unchanged (the next tick can roll
      // again). Default probability=1.0 is a deterministic always-fire.
      if (probability < 1) {
        if (Math.random() >= probability) {
          return { fired: false, reason: 'probability_roll_failed', daysElapsed }
        }
      }

      let handlerResult
      try {
        handlerResult = await config.handler(contextKey, daysElapsed, contextHints)
      } catch (err) {
        console.error(`[timeBoundedState] threshold handler error for ${config.name}:`, err)
        return { fired: false, reason: 'handler_error', error: err?.message || String(err), daysElapsed }
      }

      // Record idempotency only after successful handler run.
      try {
        await config.idempotency.recordFired(contextKey)
      } catch (err) {
        console.error(`[timeBoundedState] idempotency recordFired error for ${config.name}:`, err)
        // Don't degrade the handler success — but flag in the return.
        return { fired: true, handlerResult, daysElapsed, idempotencyError: err?.message }
      }

      return { fired: true, handlerResult, daysElapsed }
    }
  }
}

// ============================================================
// Validation
// ============================================================

function validateDecayConfig(config) {
  if (!config) throw new Error('registerDecayConsumer: config required')
  if (!config.name || typeof config.name !== 'string') {
    throw new Error('registerDecayConsumer: config.name (string) required')
  }
  if (typeof config.decayFunction !== 'function') {
    throw new Error(`registerDecayConsumer(${config.name}): config.decayFunction (function) required`)
  }
  if (!config.repository || typeof config.repository !== 'object') {
    throw new Error(`registerDecayConsumer(${config.name}): config.repository required`)
  }
  for (const fn of ['readAnchor', 'readValue', 'writeValue']) {
    if (typeof config.repository[fn] !== 'function') {
      throw new Error(`registerDecayConsumer(${config.name}): config.repository.${fn} (function) required`)
    }
  }
  if (config.semantics != null && !Object.values(DECAY_SEMANTICS).includes(config.semantics)) {
    throw new Error(`registerDecayConsumer(${config.name}): config.semantics must be one of ${Object.values(DECAY_SEMANTICS).join('|')}, got ${config.semantics}`)
  }
}

function validateThresholdConfig(config) {
  if (!config) throw new Error('registerThresholdConsumer: config required')
  if (!config.name || typeof config.name !== 'string') {
    throw new Error('registerThresholdConsumer: config.name (string) required')
  }
  if (!Number.isFinite(config.threshold) || config.threshold < 0) {
    throw new Error(`registerThresholdConsumer(${config.name}): config.threshold (non-negative number) required`)
  }
  if (typeof config.handler !== 'function') {
    throw new Error(`registerThresholdConsumer(${config.name}): config.handler (function) required`)
  }
  if (!config.idempotency || typeof config.idempotency !== 'object') {
    throw new Error(`registerThresholdConsumer(${config.name}): config.idempotency required`)
  }
  for (const fn of ['hasFiredRecently', 'recordFired']) {
    if (typeof config.idempotency[fn] !== 'function') {
      throw new Error(`registerThresholdConsumer(${config.name}): config.idempotency.${fn} (function) required`)
    }
  }
  if (!config.repository || typeof config.repository !== 'object') {
    throw new Error(`registerThresholdConsumer(${config.name}): config.repository required`)
  }
  if (typeof config.repository.readAnchor !== 'function') {
    throw new Error(`registerThresholdConsumer(${config.name}): config.repository.readAnchor (function) required`)
  }
  if (config.probability != null) {
    if (!Number.isFinite(config.probability) || config.probability < 0 || config.probability > 1) {
      throw new Error(`registerThresholdConsumer(${config.name}): config.probability must be in [0, 1], got ${config.probability}`)
    }
  }
}
