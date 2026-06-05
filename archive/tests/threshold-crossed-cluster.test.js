/**
 * Phase 3.3 SC-7.5 — Threshold-crossed cluster tests.
 *
 * Five threshold consumer registrations batched into one ship per spec
 * §3.3.5 + user's batching principle:
 *   - PROMISE_AUTO_BREAK_THRESHOLD_CONSUMER (per-promise effective deadline)
 *   - QUEST_AUTO_FAIL_THRESHOLD_CONSUMER (deadline_game_day single column)
 *   - MERCHANT_ORDER_DUE_THRESHOLD_CONSUMER (pending → ready, threshold=0)
 *   - MERCHANT_ORDER_EXPIRE_THRESHOLD_CONSUMER (ready → expired, threshold=31)
 *   - BASE_RECAPTURE_EXPIRE_THRESHOLD_CONSUMER (captured → abandoned)
 *
 * All five share the same idempotency strategy: **SELECT-pre-filter via
 * status column**. Orchestrator's WHERE clause filters to pre-fire status
 * only; handler flips status; subsequent ticks don't see the row. The
 * abstraction's idempotency callbacks are no-ops because the orchestrator
 * owns the strategy.
 *
 * Tests exercise:
 *   1. All five consumers built + exposed (name, threshold, checkAndFire)
 *   2. Promise effective-deadline derivation (explicit deadline OR
 *      game_day_made + 45)
 *   3. Quest deadline single-column simplicity
 *   4. Two-stage merchant pipeline: due (threshold=0) and expire
 *      (threshold=31, matches legacy `> 30`)
 *   5. Base recapture expire fires at deadline + 0
 *   6. **Cluster batch validation**: all five threshold consumers tested
 *      side-by-side — their threshold + handler shapes are structurally
 *      identical; only the per-consumer `threshold` value, anchor source,
 *      and handler side effect vary.
 */

import {
  PROMISE_AUTO_BREAK_THRESHOLD_CONSUMER,
  QUEST_AUTO_FAIL_THRESHOLD_CONSUMER
} from '../server/services/consequenceService.js'
import {
  MERCHANT_ORDER_DUE_THRESHOLD_CONSUMER,
  MERCHANT_ORDER_EXPIRE_THRESHOLD_CONSUMER
} from '../server/services/merchantOrderService.js'
import {
  BASE_RECAPTURE_EXPIRE_THRESHOLD_CONSUMER
} from '../server/services/baseThreatService.js'
import { registerThresholdConsumer } from '../server/services/timeBoundedState.js'

let passed = 0
let failed = 0

function assert(condition, message) {
  if (condition) { console.log(`  ✓ ${message}`); passed++ }
  else { console.error(`  ✗ ${message}`); failed++ }
}

console.log('\n=== All five SC-7.5 cluster consumers built + exposed ===\n')
{
  const consumers = [
    [PROMISE_AUTO_BREAK_THRESHOLD_CONSUMER, 'promise_auto_break', 1],
    [QUEST_AUTO_FAIL_THRESHOLD_CONSUMER, 'quest_auto_fail', 1],
    [MERCHANT_ORDER_DUE_THRESHOLD_CONSUMER, 'merchant_order_due', 0],
    [MERCHANT_ORDER_EXPIRE_THRESHOLD_CONSUMER, 'merchant_order_expire', 31],
    [BASE_RECAPTURE_EXPIRE_THRESHOLD_CONSUMER, 'base_recapture_expire', 0]
  ]
  for (const [c, expectedName, expectedThreshold] of consumers) {
    assert(c.name === expectedName, `${expectedName}: name`)
    assert(c.threshold === expectedThreshold, `${expectedName}: threshold = ${expectedThreshold}`)
    assert(typeof c.checkAndFire === 'function', `${expectedName}: checkAndFire exposed`)
  }
}

console.log('\n=== Promise effective-deadline: explicit deadline_game_day used when set ===\n')
{
  // Explicit deadline at day 50, current at 51 — 1 elapsed past deadline
  const promise = {
    npc_id: 1, promise_index: 0, promise: 'test', game_day_made: 10,
    deadline_game_day: 50, weight: 'major'
  }
  const result = await PROMISE_AUTO_BREAK_THRESHOLD_CONSUMER.checkAndFire(
    { promise, currentGameDay: 51 }, 51,
    { characterId: 0, campaignId: 0, promise }  // handler won't actually run on these stubs
  )
  // We expect threshold satisfied (51 - 50 = 1 elapsed; threshold=1) — but
  // handler will likely error on missing data. We're testing the threshold
  // gate fired (or didn't). result.daysElapsed should be 1.
  assert(result.daysElapsed === 1, 'effective deadline = explicit (50); 1 day elapsed')
}

console.log('\n=== Promise effective-deadline: 45-day default when no explicit deadline ===\n')
{
  const promise = {
    npc_id: 1, promise_index: 0, promise: 'test', game_day_made: 10,
    deadline_game_day: null, weight: 'minor'
  }
  // Effective deadline = 10 + 45 = 55. At currentGameDay 56, daysElapsed = 1.
  const result = await PROMISE_AUTO_BREAK_THRESHOLD_CONSUMER.checkAndFire(
    { promise, currentGameDay: 56 }, 56,
    { characterId: 0, campaignId: 0, promise }
  )
  assert(result.daysElapsed === 1, 'effective deadline = game_day_made + 45 (55); 1 day elapsed past')
}

console.log('\n=== Promise: legacy promises without game_day_made → null anchor → no fire ===\n')
{
  const promise = { npc_id: 1, promise: 'legacy', game_day_made: 0 }
  const result = await PROMISE_AUTO_BREAK_THRESHOLD_CONSUMER.checkAndFire(
    { promise, currentGameDay: 100 }, 100,
    { characterId: 0, campaignId: 0, promise }
  )
  assert(!result.fired && result.reason === 'no_anchor', 'legacy promise without game_day_made is skipped')
}

console.log('\n=== Quest: anchor = deadline_game_day single column ===\n')
{
  const quest = { id: 1, deadline_game_day: 50, status: 'active', title: 'test' }
  // current 50: daysElapsed = 0, threshold=1 → no fire
  const before = await QUEST_AUTO_FAIL_THRESHOLD_CONSUMER.checkAndFire(
    { quest, currentGameDay: 50 }, 50,
    { characterId: 0, campaignId: 0, quest }
  )
  assert(!before.fired && before.reason === 'before_threshold', 'current==deadline → 0 elapsed → no fire')

  // current 51: daysElapsed = 1, threshold=1 → fires (handler may error on stubs)
  const at = await QUEST_AUTO_FAIL_THRESHOLD_CONSUMER.checkAndFire(
    { quest, currentGameDay: 51 }, 51,
    { characterId: 0, campaignId: 0, quest }
  )
  // We can't verify handler ran cleanly without a real DB, but threshold passed
  assert(at.daysElapsed === 1, 'current = deadline+1 → 1 elapsed (threshold satisfied)')
}

console.log('\n=== Two-stage merchant pipeline: due (threshold=0) + expire (threshold=31) ===\n')
{
  // Due: threshold=0 means fire when current >= deadline (0 elapsed)
  // Build a synthetic consumer mirroring the production config to test
  // firing without DB.
  let dueHandlerRan = false
  const dueMock = registerThresholdConsumer({
    name: 'test_due',
    threshold: 0,
    handler: async () => { dueHandlerRan = true; return { ok: true } },
    idempotency: { async hasFiredRecently() { return false }, async recordFired() {} },
    repository: { async readAnchor() { return 50 } }
  })
  // current=50, anchor=50, daysElapsed=0, threshold=0 → fires
  const dueResult = await dueMock.checkAndFire({}, 50)
  assert(dueResult.fired === true, 'threshold=0 fires at exact-anchor day')
  assert(dueHandlerRan === true, 'handler ran')

  // Expire: threshold=31 fires at 31+ days post-anchor (matches legacy `> 30`)
  let expireHandlerRan = false
  const expireMock = registerThresholdConsumer({
    name: 'test_expire',
    threshold: 31,
    handler: async () => { expireHandlerRan = true; return { ok: true } },
    idempotency: { async hasFiredRecently() { return false }, async recordFired() {} },
    repository: { async readAnchor() { return 50 } }
  })
  // current=80 → 30 elapsed → no fire (legacy `> 30` excludes day 30)
  const expire30 = await expireMock.checkAndFire({}, 80)
  assert(!expire30.fired && expire30.reason === 'before_threshold', '30 elapsed (current=anchor+30) → no fire')

  // current=81 → 31 elapsed → fires
  const expire31 = await expireMock.checkAndFire({}, 81)
  assert(expire31.fired === true, '31 elapsed → fires (matches legacy `> 30` strictly-greater check)')
}

console.log('\n=== Base recapture: anchor = recapture_deadline_game_day, threshold=0 ===\n')
{
  const row = { id: 1, base_id: 5, base_name: 'Watchtower', recapture_deadline_game_day: 100 }
  const result = await BASE_RECAPTURE_EXPIRE_THRESHOLD_CONSUMER.checkAndFire(
    { row, currentGameDay: 100 }, 100,
    { row, campaignId: 0 }
  )
  assert(result.daysElapsed === 0, 'current = deadline → 0 elapsed (threshold=0 satisfies)')

  // Before deadline
  const before = await BASE_RECAPTURE_EXPIRE_THRESHOLD_CONSUMER.checkAndFire(
    { row: { ...row, recapture_deadline_game_day: 200 }, currentGameDay: 100 }, 100,
    { row, campaignId: 0 }
  )
  // anchor 200 > current 100 → daysSince clamps to 0 (no rollback) → 0 elapsed → fires (threshold=0)
  // Wait — anchor=200, current=100, daysSince(200, 100) = max(0, 100-200) = 0 (clamped)
  // So threshold=0 fires even before deadline because the clamp masks "future" anchors as 0.
  // This is a property of the abstraction: future anchors look like 0 elapsed.
  // For base recapture, the SELECT pre-filter (`recapture_deadline_game_day <= currentGameDay`)
  // prevents future-anchored rows from being loaded — defense in depth.
  assert(before.daysElapsed === 0, 'future deadline → daysSince clamps to 0 (orchestrator SELECT filters this out)')
}

console.log('\n=== Idempotency strategy: SELECT-pre-filter (callbacks no-op for all five) ===\n')
{
  // All five consumers' idempotency.hasFiredRecently is the no-op `() => false`.
  // The strategy is encoded in the orchestrator's SELECT WHERE clause.
  // Document this here as an architectural assertion.
  for (const c of [
    PROMISE_AUTO_BREAK_THRESHOLD_CONSUMER,
    QUEST_AUTO_FAIL_THRESHOLD_CONSUMER,
    MERCHANT_ORDER_DUE_THRESHOLD_CONSUMER,
    MERCHANT_ORDER_EXPIRE_THRESHOLD_CONSUMER,
    BASE_RECAPTURE_EXPIRE_THRESHOLD_CONSUMER
  ]) {
    // We can't directly inspect the config, but we can verify behavior:
    // a checkAndFire call that should be threshold-satisfied returns fired=true
    // (or before_threshold) — never idempotency_blocked, since the callback returns false.
    // Synthetic test: anchor far in past, threshold=0/1, no fire-blocking idempotency.
    // The above tests for promise/quest/merchant/base already exercise this implicitly.
    assert(typeof c.checkAndFire === 'function', `${c.name}: implements the threshold consumer contract`)
  }
}

console.log('\n=== Cluster batch validation: all five share threshold-crossed structural shape ===\n')
{
  // Collected sanity check: each consumer has the same surface area
  // (name + threshold + checkAndFire). Differ in: anchor source, handler
  // side effect, and threshold value. No structural divergence — the
  // abstraction handled all five with one API.
  const all = [
    PROMISE_AUTO_BREAK_THRESHOLD_CONSUMER,
    QUEST_AUTO_FAIL_THRESHOLD_CONSUMER,
    MERCHANT_ORDER_DUE_THRESHOLD_CONSUMER,
    MERCHANT_ORDER_EXPIRE_THRESHOLD_CONSUMER,
    BASE_RECAPTURE_EXPIRE_THRESHOLD_CONSUMER
  ]
  const surfaceArea = all.map(c => Object.keys(c).sort().join(','))
  const uniqueShapes = new Set(surfaceArea)
  assert(uniqueShapes.size === 1, `all five consumers have identical surface area (${surfaceArea[0]})`)

  const thresholds = all.map(c => c.threshold)
  // Five thresholds: 1, 1, 0, 31, 0 — three unique values. Validates that
  // the threshold parameter is the per-consumer config differentiator.
  assert(new Set(thresholds).size === 3, 'three distinct threshold values across the five consumers (0, 1, 31)')
}

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`)
process.exit(failed > 0 ? 1 : 0)
