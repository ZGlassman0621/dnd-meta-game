/**
 * Phase 3.3 SC-7.3 — NPC absence cluster migration tests.
 *
 * Validates:
 *   1. All four consumers built + exposed (DISPOSITION_DECAY,
 *      TRUST_DECAY, RELOCATION_THRESHOLD, FORGET_THRESHOLD)
 *   2. Disposition decay function preserved exactly (piecewise tier
 *      formula + high-trust modifier + -20 floor cap)
 *   3. Trust decay function preserved exactly (two-tier formula + 0
 *      floor cap)
 *   4. Dual-decay-from-one-anchor pattern: both decays read
 *      `last_interaction_game_day`, write to different value columns
 *   5. Stochastic threshold: relocation 10% probability roll exercises
 *      the abstraction's `probability` parameter for the first time
 *   6. **Fix-along-the-way: relocation idempotency via location prefix
 *      check** — legacy compounded `Unknown (left Unknown (left X))`
 *      across consecutive 10% rolls; migration prevents the compound
 *   7. **Fix-along-the-way: forget idempotency via both-zero check** —
 *      legacy fired wasted UPDATEs every tick once forgotten; migration
 *      blocks repeat fires.
 *   8. Behavior parity vs legacy decay functions on representative
 *      day-elapsed/value combinations.
 *
 * Pure tests with synthetic state — production wire-up exercised via
 * smoke + the existing `routes/dmSession.js:773` orchestrator call.
 */

import {
  calculateDispositionDecay,
  calculateTrustDecay,
  DISPOSITION_DECAY_CONSUMER,
  TRUST_DECAY_CONSUMER,
  RELOCATION_THRESHOLD_CONSUMER,
  FORGET_THRESHOLD_CONSUMER
} from '../server/services/npcAgingService.js'
import { DECAY_SEMANTICS, registerDecayConsumer, registerThresholdConsumer } from '../server/services/timeBoundedState.js'

let passed = 0
let failed = 0

function assert(condition, message) {
  if (condition) { console.log(`  ✓ ${message}`); passed++ }
  else { console.error(`  ✗ ${message}`); failed++ }
}

console.log('\n=== All four consumers built + exposed ===\n')
{
  assert(DISPOSITION_DECAY_CONSUMER.name === 'npc_disposition_absence_decay', 'disposition consumer name')
  assert(DISPOSITION_DECAY_CONSUMER.semantics === DECAY_SEMANTICS.HIGH_WATER_MARK, 'disposition: HIGH_WATER_MARK')
  assert(typeof DISPOSITION_DECAY_CONSUMER.applyDecay === 'function', 'disposition: applyDecay exposed')

  assert(TRUST_DECAY_CONSUMER.name === 'npc_trust_absence_decay', 'trust consumer name')
  assert(TRUST_DECAY_CONSUMER.semantics === DECAY_SEMANTICS.HIGH_WATER_MARK, 'trust: HIGH_WATER_MARK')

  assert(RELOCATION_THRESHOLD_CONSUMER.name === 'npc_relocation_on_long_absence', 'relocation consumer name')
  assert(RELOCATION_THRESHOLD_CONSUMER.threshold === 60, 'relocation threshold = 60 days')
  assert(typeof RELOCATION_THRESHOLD_CONSUMER.checkAndFire === 'function', 'relocation: checkAndFire exposed')

  assert(FORGET_THRESHOLD_CONSUMER.name === 'npc_forget_on_extreme_absence', 'forget consumer name')
  assert(FORGET_THRESHOLD_CONSUMER.threshold === 120, 'forget threshold = 120 days')
}

console.log('\n=== Disposition decay function: legacy formula preserved exactly ===\n')
{
  // Three-tier piecewise:
  //   8-30d: floor((days-7)/5) per the function (1 per 5 days)
  //   31-90d: 4 + floor((days-30)/3)
  //   90+d: 24 + floor((days-90)/3) * 2
  assert(calculateDispositionDecay(7, 50) === 0, 'days 7: no decay (boundary)')
  assert(calculateDispositionDecay(8, 50) === 0, 'days 8: floor((8-7)/5)=0')
  assert(calculateDispositionDecay(12, 50) === 1, 'days 12: floor(5/5)=1')
  assert(calculateDispositionDecay(30, 50) === 4, 'days 30: floor(23/5)=4')
  assert(calculateDispositionDecay(31, 50) === 4, 'days 31: 4 + floor(1/3)=4')
  assert(calculateDispositionDecay(33, 50) === 5, 'days 33: 4 + floor(3/3)=5')
  assert(calculateDispositionDecay(90, 50) === 24, 'days 90: 4 + floor(60/3)=24')
  assert(calculateDispositionDecay(93, 50) === 26, 'days 93: 24 + floor(3/3)*2=26')
}

console.log('\n=== Disposition decay: high-trust modifier (half rate) ===\n')
{
  const normalDecay = calculateDispositionDecay(30, 50)
  const highTrustDecay = calculateDispositionDecay(30, 50, { highTrust: true })
  assert(highTrustDecay === Math.floor(normalDecay / 2), 'high-trust halves the decay rate')
}

console.log('\n=== Disposition decay: floor at -20 ===\n')
{
  // Even with huge days elapsed, decay caps so disposition can't drop below -20.
  assert(calculateDispositionDecay(1000, -10) === Math.max(0, -10 - (-20)), 'dispo -10 caps decay at 10 (to reach -20)')
  assert(calculateDispositionDecay(1000, -25) === 0, 'dispo already below -20: no further decay')
  assert(calculateDispositionDecay(1000, -20) === 0, 'dispo at floor -20: no decay')
}

console.log('\n=== Trust decay function: legacy formula preserved exactly ===\n')
{
  // Two-tier:
  //   15-60d: floor((days-14)/10) (1 per 10 days)
  //   60+d: floor(46/10) + floor((days-60)/5) = 4 + floor((days-60)/5)
  assert(calculateTrustDecay(14, 50) === 0, 'days 14: no decay (boundary)')
  assert(calculateTrustDecay(15, 50) === 0, 'days 15: floor(1/10)=0')
  assert(calculateTrustDecay(24, 50) === 1, 'days 24: floor(10/10)=1')
  assert(calculateTrustDecay(60, 50) === 4, 'days 60: floor(46/10)=4')
  assert(calculateTrustDecay(65, 50) === 5, 'days 65: 4 + floor(5/5)=5')
  assert(calculateTrustDecay(80, 50) === 8, 'days 80: 4 + floor(20/5)=8')
}

console.log('\n=== Trust decay: floor at 0 + zero-trust shortcut ===\n')
{
  assert(calculateTrustDecay(100, 0) === 0, 'trust 0 → no decay (zero-shortcut)')
  assert(calculateTrustDecay(100, -5) === 0, 'trust below 0 → no decay')
  assert(calculateTrustDecay(1000, 5) === 5, 'caps decay so trust never goes negative')
}

console.log('\n=== Dual-decay-from-one-anchor: parallel synthetic test ===\n')
{
  // Build mocked versions of both decay consumers reading from the SAME
  // synthetic anchor + different value columns. Verify both decays apply
  // independently against the shared anchor (the "two scalars, one
  // anchor" shape that is the cluster's distinguishing feature).
  const state = {
    last_interaction_game_day: 100,
    disposition: 50,
    trust_level: 50
  }

  const sharedAnchorReadCount = { disposition: 0, trust: 0 }
  const dispoConsumer = registerDecayConsumer({
    name: 'test_dispo',
    semantics: DECAY_SEMANTICS.HIGH_WATER_MARK,
    decayFunction: (days, current, hints) => calculateDispositionDecay(days, current, hints),
    repository: {
      readAnchor: async () => { sharedAnchorReadCount.disposition++; return state.last_interaction_game_day },
      readValue: async () => state.disposition,
      writeValue: async (_, v) => { state.disposition = v }
    }
  })
  const trustConsumer = registerDecayConsumer({
    name: 'test_trust',
    semantics: DECAY_SEMANTICS.HIGH_WATER_MARK,
    decayFunction: (days, current) => calculateTrustDecay(days, current),
    repository: {
      readAnchor: async () => { sharedAnchorReadCount.trust++; return state.last_interaction_game_day },
      readValue: async () => state.trust_level,
      writeValue: async (_, v) => { state.trust_level = v }
    }
  })

  // Run both at game-day 130 (30 days absent)
  await dispoConsumer.applyDecay({}, 130)
  await trustConsumer.applyDecay({}, 130)

  // Disposition: legacy 30 days → decay 4 → 50 - 4 = 46
  assert(state.disposition === 46, `dispo 50 - 4 = 46 (got ${state.disposition})`)
  // Trust: legacy 30 days → decay floor((30-14)/10) = 1 → 50 - 1 = 49
  assert(state.trust_level === 49, `trust 50 - 1 = 49 (got ${state.trust_level})`)
  // Anchor unchanged (HIGH_WATER_MARK)
  assert(state.last_interaction_game_day === 100, 'anchor stays at 100 (high-water-mark)')
  assert(sharedAnchorReadCount.disposition === 1 && sharedAnchorReadCount.trust === 1, 'each consumer reads anchor once')
}

console.log('\n=== Stochastic threshold: probability=0.1 honored, deterministic firing test ===\n')
{
  // Build a mocked relocation consumer with deterministic Math.random
  // (forced to always pass roll, then always fail) — verifies the
  // probability gate and idempotency-on-failed-roll behavior.
  const state = {
    last_interaction_game_day: 100,
    disposition: -10,
    current_location: 'Tavern',
    fired: false
  }

  const consumer = registerThresholdConsumer({
    name: 'test_relocate',
    threshold: 60,
    probability: 0.1,
    handler: async () => {
      state.fired = true
      state.current_location = `Unknown (left ${state.current_location})`
      return { relocated: true }
    },
    idempotency: {
      hasFiredRecently: async () => state.current_location?.startsWith('Unknown (left '),
      async recordFired() {}
    },
    repository: { readAnchor: async () => state.last_interaction_game_day }
  })

  // Force roll to FAIL (Math.random() >= 0.1 always when forced to 0.5)
  const realRandom = Math.random
  Math.random = () => 0.5
  const failResult = await consumer.checkAndFire({}, 200)
  assert(!failResult.fired && failResult.reason === 'probability_roll_failed', 'high random → roll fails → no fire')
  assert(state.fired === false, 'handler not called')
  assert(state.current_location === 'Tavern', 'location unchanged')

  // Force roll to PASS (Math.random() < 0.1 when forced to 0.05)
  Math.random = () => 0.05
  const passResult = await consumer.checkAndFire({}, 200)
  assert(passResult.fired === true, 'low random → roll passes → fire')
  assert(state.fired === true, 'handler called')
  assert(state.current_location === 'Unknown (left Tavern)', 'location prefix applied')

  // Now re-fire same tick: idempotency should block
  const repeat = await consumer.checkAndFire({}, 200)
  assert(!repeat.fired && repeat.reason === 'idempotency_blocked', 'idempotency blocks re-fire (compound-prefix bug fix)')
  assert(state.current_location === 'Unknown (left Tavern)', 'NO compound prefix (fix-along-the-way)')

  Math.random = realRandom
}

console.log('\n=== Fix-along-the-way: relocation idempotency prevents compound prefix ===\n')
{
  // Synthesize the compound-prefix scenario: NPC was relocated previously
  // (location starts with 'Unknown (left '). hasFiredRecently should
  // return true → the abstraction blocks the fire even on a "good" roll.
  const state = {
    last_interaction_game_day: 100,
    disposition: -50,
    current_location: 'Unknown (left Tavern)'  // already relocated
  }

  let handlerRan = false
  const consumer = registerThresholdConsumer({
    name: 'test_relocate_compound',
    threshold: 60,
    probability: 0.1,
    handler: async () => { handlerRan = true; return { relocated: true } },
    idempotency: {
      hasFiredRecently: async () => state.current_location?.startsWith('Unknown (left '),
      async recordFired() {}
    },
    repository: { readAnchor: async () => state.last_interaction_game_day }
  })

  const realRandom = Math.random
  Math.random = () => 0.05  // would pass if reached
  const result = await consumer.checkAndFire({}, 200)
  Math.random = realRandom

  assert(!result.fired && result.reason === 'idempotency_blocked', 'already-relocated NPC blocked by prefix idempotency')
  assert(handlerRan === false, 'handler did NOT run (no compound prefix)')
}

console.log('\n=== Fix-along-the-way: forget idempotency prevents repeat-fire ===\n')
{
  // Once both disposition and trust are 0, hasFiredRecently returns true.
  const state = {
    last_interaction_game_day: 50,
    disposition: 0,
    trust_level: 0
  }
  let handlerRan = false
  const consumer = registerThresholdConsumer({
    name: 'test_forget',
    threshold: 120,
    handler: async () => { handlerRan = true; return { forgotten: true } },
    idempotency: {
      hasFiredRecently: async () => state.disposition === 0 && state.trust_level === 0,
      async recordFired() {}
    },
    repository: { readAnchor: async () => state.last_interaction_game_day }
  })
  // current 200 → 150 days elapsed (past 120 threshold)
  const result = await consumer.checkAndFire({}, 200)
  assert(!result.fired && result.reason === 'idempotency_blocked', 'already-zero → idempotency blocks')
  assert(handlerRan === false, 'handler did NOT run on already-forgotten NPC')
}

console.log('\n=== Threshold consumer: condition-not-met (consumer-side filter) ===\n')
{
  // Relocation requires disposition < 0 (consumer-side condition). The
  // threshold + probability + idempotency all pass; handler returns early
  // when disposition is non-negative.
  const consumer = registerThresholdConsumer({
    name: 'test_condition',
    threshold: 60,
    probability: 1.0,  // deterministic, always rolls pass
    handler: async () => {
      // Mimic the production handler's condition check
      const dispo = 5  // simulating positive disposition
      if (dispo >= 0) return { fired: false, reason: 'condition_not_met' }
      return { relocated: true }
    },
    idempotency: {
      hasFiredRecently: async () => false,
      async recordFired() {}
    },
    repository: { readAnchor: async () => 100 }
  })
  const result = await consumer.checkAndFire({}, 200)
  // The abstraction's checkAndFire reports `fired: true` because the
  // handler ran; the handler's RETURN VALUE communicates the no-op
  // (the consumer interprets handlerResult to know the actual outcome).
  assert(result.fired === true, 'abstraction sees handler ran (fired=true)')
  assert(result.handlerResult.fired === false, 'handler-result fired=false (consumer-side filter)')
  assert(result.handlerResult.reason === 'condition_not_met', 'reason surfaced')
}

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`)
process.exit(failed > 0 ? 1 : 0)
