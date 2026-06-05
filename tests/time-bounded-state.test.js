/**
 * Phase 3.3 SC-7.1 — Time-bounded state primitive tests.
 *
 * Foundation ship — no consumer migrations yet. Tests cover:
 *   1. daysSince arithmetic (incl. null-anchor + clamp-to-0 semantics)
 *   2. registerDecayConsumer config validation (catches malformed configs early)
 *   3. registerDecayConsumer applyDecay — three semantics divergence
 *      (high-water-mark / consumed / written-back)
 *   4. registerDecayConsumer floor/ceiling clamping
 *   5. registerThresholdConsumer config validation
 *   6. registerThresholdConsumer checkAndFire — threshold + idempotency +
 *      probability + handler-error containment
 *   7. Empty-state safety (consumers with no anchor / no data don't crash)
 *
 * No DB. All tests use synthetic in-memory repository callbacks.
 */

import {
  daysSince,
  registerDecayConsumer,
  registerThresholdConsumer,
  DECAY_SEMANTICS
} from '../server/services/timeBoundedState.js'

let passed = 0
let failed = 0

function assert(condition, message) {
  if (condition) { console.log(`  ✓ ${message}`); passed++ }
  else { console.error(`  ✗ ${message}`); failed++ }
}

function expectThrow(fn, fragment, message) {
  try {
    fn()
    console.error(`  ✗ ${message} — expected throw, got nothing`)
    failed++
  } catch (e) {
    if (fragment && !e.message.includes(fragment)) {
      console.error(`  ✗ ${message} — threw but message "${e.message}" missing "${fragment}"`)
      failed++
      return
    }
    console.log(`  ✓ ${message}`)
    passed++
  }
}

console.log('\n=== daysSince — null/clamp semantics ===\n')
{
  assert(daysSince(null, 10) === null, 'null anchor → null')
  assert(daysSince(undefined, 10) === null, 'undefined anchor → null')
  assert(daysSince(5, null) === null, 'null currentGameDay → null')
  assert(daysSince(5, undefined) === null, 'undefined currentGameDay → null')
  assert(daysSince(5, 10) === 5, '10 - 5 = 5')
  assert(daysSince(0, 0) === 0, '0 - 0 = 0')
  assert(daysSince(10, 5) === 0, 'negative elapsed clamped to 0 (game-day rollback safety)')
  assert(daysSince(0, 100) === 100, 'large elapsed works')
}

console.log('\n=== registerDecayConsumer — config validation ===\n')
{
  expectThrow(() => registerDecayConsumer(), 'config required', 'no config → throw')
  expectThrow(() => registerDecayConsumer({}), 'name', 'no name → throw')
  expectThrow(() => registerDecayConsumer({ name: 'x' }), 'decayFunction', 'no decayFunction → throw')
  expectThrow(
    () => registerDecayConsumer({ name: 'x', decayFunction: () => 1 }),
    'repository',
    'no repository → throw'
  )
  expectThrow(
    () => registerDecayConsumer({ name: 'x', decayFunction: () => 1, repository: {} }),
    'readAnchor',
    'repository missing readAnchor → throw'
  )
  expectThrow(
    () => registerDecayConsumer({
      name: 'x',
      decayFunction: () => 1,
      semantics: 'invalid_value',
      repository: { readAnchor: async () => 1, readValue: async () => 1, writeValue: async () => {} }
    }),
    'semantics',
    'invalid semantics enum → throw'
  )
  // Valid config doesn't throw
  const ok = registerDecayConsumer({
    name: 'valid',
    decayFunction: () => 1,
    repository: {
      readAnchor: async () => null,
      readValue: async () => 0,
      writeValue: async () => {}
    }
  })
  assert(typeof ok.applyDecay === 'function', 'valid config returns API with applyDecay')
}

console.log('\n=== registerDecayConsumer.applyDecay — high-water-mark semantics ===\n')
{
  // Anchor stays; value decays per tick.
  let value = 50
  let anchor = 100  // currentGameDay 110 → 10 days elapsed
  let writeCount = 0
  const consumer = registerDecayConsumer({
    name: 'test_high_water',
    semantics: DECAY_SEMANTICS.HIGH_WATER_MARK,
    decayFunction: (daysElapsed) => Math.floor(daysElapsed / 2),  // 1 per 2 days
    floor: 0,
    repository: {
      readAnchor: async () => anchor,
      readValue: async () => value,
      writeValue: async (_, v) => { value = v; writeCount++ }
    }
  })
  const result = await consumer.applyDecay({}, 110)
  assert(result.daysElapsed === 10, 'daysElapsed = 10')
  assert(result.decayAmount === 5, 'decayAmount = 5 (10/2)')
  assert(result.oldValue === 50 && result.newValue === 45, '50 → 45')
  assert(value === 45, 'writeValue called with 45')
  assert(anchor === 100, 'anchor UNCHANGED (high-water-mark)')
}

console.log('\n=== registerDecayConsumer.applyDecay — consumed semantics ===\n')
{
  // Anchor NULLs when value reaches floor.
  let value = 1
  let anchor = 100
  let consumeCount = 0
  const consumer = registerDecayConsumer({
    name: 'test_consumed',
    semantics: DECAY_SEMANTICS.CONSUMED,
    decayFunction: (daysElapsed) => daysElapsed,  // 1 per day
    floor: 0,
    repository: {
      readAnchor: async () => anchor,
      readValue: async () => value,
      writeValue: async (_, v) => { value = v },
      consumeAnchor: async () => { anchor = null; consumeCount++ }
    }
  })
  // currentGameDay 102 → 2 days elapsed → decay 2 → value 1 - 2 = -1 → clamped to 0
  const result = await consumer.applyDecay({}, 102)
  assert(result.newValue === 0, 'value clamped to floor 0')
  assert(consumeCount === 1, 'consumeAnchor called once at floor')
  assert(anchor === null, 'anchor NULLed (consumed semantics)')

  // Subsequent tick — anchor null → no-op
  const result2 = await consumer.applyDecay({}, 200)
  assert(result2 === null, 'subsequent tick on null anchor returns null (no decay)')
}

console.log('\n=== registerDecayConsumer.applyDecay — written-back semantics ===\n')
{
  // Anchor advances to currentGameDay after each tick.
  let value = 50
  let anchor = 100
  let advanceCount = 0
  const consumer = registerDecayConsumer({
    name: 'test_written_back',
    semantics: DECAY_SEMANTICS.WRITTEN_BACK,
    decayFunction: (daysElapsed) => daysElapsed * 2,  // 2 per day
    floor: 0,
    repository: {
      readAnchor: async () => anchor,
      readValue: async () => value,
      writeValue: async (_, v) => { value = v },
      advanceAnchor: async (_, newAnchor) => { anchor = newAnchor; advanceCount++ }
    }
  })
  // currentGameDay 105 → 5 days elapsed → decay 10 → value 50 - 10 = 40
  const result = await consumer.applyDecay({}, 105)
  assert(result.newValue === 40, 'value 50 → 40')
  assert(anchor === 105, 'anchor advanced to currentGameDay')
  assert(advanceCount === 1, 'advanceAnchor called once')

  // Next tick at 108 → 3 days elapsed (since advanced anchor) → decay 6 → 34
  const result2 = await consumer.applyDecay({}, 108)
  assert(result2.daysElapsed === 3, 'daysElapsed measured from advanced anchor')
  assert(result2.newValue === 34, '40 → 34')
}

console.log('\n=== registerDecayConsumer.applyDecay — null anchor + zero elapsed = no-op ===\n')
{
  let writeCount = 0
  const consumer = registerDecayConsumer({
    name: 'test_no_op',
    decayFunction: () => 1,
    repository: {
      readAnchor: async () => null,
      readValue: async () => 100,
      writeValue: async () => { writeCount++ }
    }
  })
  const result = await consumer.applyDecay({}, 50)
  assert(result === null, 'null anchor → null result')
  assert(writeCount === 0, 'no writeValue call')

  const consumer2 = registerDecayConsumer({
    name: 'test_zero_elapsed',
    decayFunction: () => 1,
    repository: {
      readAnchor: async () => 50,
      readValue: async () => 100,
      writeValue: async () => { writeCount++ }
    }
  })
  const result2 = await consumer2.applyDecay({}, 50)
  assert(result2 === null, '0 days elapsed → null result')
  assert(writeCount === 0, 'still no writeValue call')
}

console.log('\n=== registerDecayConsumer.applyDecay — clamping at floor + ceiling ===\n')
{
  let value = 5
  const floorConsumer = registerDecayConsumer({
    name: 'test_floor',
    decayFunction: () => 100,  // huge decay
    floor: -10,
    repository: {
      readAnchor: async () => 0,
      readValue: async () => value,
      writeValue: async (_, v) => { value = v }
    }
  })
  const result = await floorConsumer.applyDecay({}, 1)
  assert(result.newValue === -10, 'value clamped to floor -10 (5 - 100 = -95 → -10)')

  // Clamp made it a no-op (already at floor, decay tries to go below)
  const result2 = await floorConsumer.applyDecay({}, 2)
  assert(result2 === null, 'no-op when clamp prevents change')
}

console.log('\n=== registerThresholdConsumer — config validation ===\n')
{
  expectThrow(() => registerThresholdConsumer(), 'config required', 'no config → throw')
  expectThrow(() => registerThresholdConsumer({}), 'name', 'no name → throw')
  expectThrow(() => registerThresholdConsumer({ name: 'x' }), 'threshold', 'no threshold → throw')
  expectThrow(
    () => registerThresholdConsumer({ name: 'x', threshold: -1, handler: async () => {}, idempotency: { hasFiredRecently: async () => false, recordFired: async () => {} }, repository: { readAnchor: async () => 0 } }),
    'threshold',
    'negative threshold → throw'
  )
  expectThrow(
    () => registerThresholdConsumer({ name: 'x', threshold: 5 }),
    'handler',
    'no handler → throw'
  )
  expectThrow(
    () => registerThresholdConsumer({ name: 'x', threshold: 5, handler: async () => {} }),
    'idempotency',
    'no idempotency → throw'
  )
  expectThrow(
    () => registerThresholdConsumer({
      name: 'x', threshold: 5, handler: async () => {},
      idempotency: { hasFiredRecently: async () => false, recordFired: async () => {} }
    }),
    'repository',
    'no repository → throw'
  )
  expectThrow(
    () => registerThresholdConsumer({
      name: 'x', threshold: 5, handler: async () => {}, probability: 1.5,
      idempotency: { hasFiredRecently: async () => false, recordFired: async () => {} },
      repository: { readAnchor: async () => 0 }
    }),
    'probability',
    'probability > 1 → throw'
  )
  // Valid
  const ok = registerThresholdConsumer({
    name: 'valid',
    threshold: 10,
    handler: async () => 'ok',
    idempotency: { hasFiredRecently: async () => false, recordFired: async () => {} },
    repository: { readAnchor: async () => 0 }
  })
  assert(typeof ok.checkAndFire === 'function', 'valid config returns API with checkAndFire')
}

console.log('\n=== registerThresholdConsumer.checkAndFire — basic threshold + idempotency ===\n')
{
  let firedFlag = false
  let handlerCalls = 0
  const consumer = registerThresholdConsumer({
    name: 'test_threshold',
    threshold: 7,
    handler: async () => { handlerCalls++; return 'handled' },
    idempotency: {
      hasFiredRecently: async () => firedFlag,
      recordFired: async () => { firedFlag = true }
    },
    repository: { readAnchor: async () => 100 }
  })

  const before = await consumer.checkAndFire({}, 105)
  assert(!before.fired && before.reason === 'before_threshold', 'before threshold → no fire')
  assert(before.daysElapsed === 5, 'reports daysElapsed=5')
  assert(handlerCalls === 0, 'handler not called')

  const fired = await consumer.checkAndFire({}, 110)
  assert(fired.fired === true, 'crosses threshold → fires')
  assert(fired.handlerResult === 'handled', 'handler return surfaced')
  assert(fired.daysElapsed === 10, 'daysElapsed=10')
  assert(handlerCalls === 1, 'handler called once')

  const second = await consumer.checkAndFire({}, 115)
  assert(!second.fired && second.reason === 'idempotency_blocked', 'idempotency blocks second fire')
  assert(handlerCalls === 1, 'handler still called only once')
}

console.log('\n=== registerThresholdConsumer.checkAndFire — no anchor → no-op ===\n')
{
  const consumer = registerThresholdConsumer({
    name: 'test_no_anchor',
    threshold: 1,
    handler: async () => 'should not run',
    idempotency: {
      hasFiredRecently: async () => false,
      recordFired: async () => {}
    },
    repository: { readAnchor: async () => null }
  })
  const result = await consumer.checkAndFire({}, 100)
  assert(!result.fired && result.reason === 'no_anchor', 'null anchor → no_anchor reason')
}

console.log('\n=== registerThresholdConsumer.checkAndFire — probability roll (stochastic) ===\n')
{
  let handlerCalls = 0
  let firedFlag = false
  const consumer = registerThresholdConsumer({
    name: 'test_probability',
    threshold: 10,
    probability: 0,  // never fires (0% chance)
    handler: async () => { handlerCalls++ },
    idempotency: {
      hasFiredRecently: async () => firedFlag,
      recordFired: async () => { firedFlag = true }
    },
    repository: { readAnchor: async () => 0 }
  })
  const result = await consumer.checkAndFire({}, 20)
  assert(!result.fired && result.reason === 'probability_roll_failed', 'p=0 → roll fails')
  assert(handlerCalls === 0, 'handler not called when roll fails')
  assert(firedFlag === false, 'idempotency NOT recorded on failed roll (next tick can retry)')

  // p=1.0 (default) deterministic
  let handlerCalls2 = 0
  const consumer2 = registerThresholdConsumer({
    name: 'test_p_one',
    threshold: 10,
    probability: 1.0,
    handler: async () => { handlerCalls2++ },
    idempotency: {
      hasFiredRecently: async () => false,
      recordFired: async () => {}
    },
    repository: { readAnchor: async () => 0 }
  })
  const result2 = await consumer2.checkAndFire({}, 20)
  assert(result2.fired === true, 'p=1 → always fires')
  assert(handlerCalls2 === 1, 'handler called when p=1')
}

console.log('\n=== registerThresholdConsumer.checkAndFire — handler error containment ===\n')
{
  let recordCalls = 0
  const consumer = registerThresholdConsumer({
    name: 'test_handler_error',
    threshold: 5,
    handler: async () => { throw new Error('boom') },
    idempotency: {
      hasFiredRecently: async () => false,
      recordFired: async () => { recordCalls++ }
    },
    repository: { readAnchor: async () => 0 }
  })
  // Should NOT throw — handler error is contained.
  let threw = false
  let result
  try {
    result = await consumer.checkAndFire({}, 10)
  } catch (e) {
    threw = true
  }
  assert(!threw, 'handler error does NOT propagate to caller')
  assert(!result.fired && result.reason === 'handler_error', 'reason=handler_error')
  assert(result.error === 'boom', 'error message surfaced')
  assert(recordCalls === 0, 'idempotency NOT recorded on handler error (allows retry)')
}

console.log('\n=== Empty-state safety: no-op consumers don\'t crash ===\n')
{
  // Foundation ship: no consumer migrations yet. Verify the abstraction
  // doesn't crash when constructed but never invoked, and when invoked
  // against repositories that return nothing useful.
  const consumer = registerDecayConsumer({
    name: 'empty_state',
    decayFunction: () => 1,
    repository: {
      readAnchor: async () => null,
      readValue: async () => 0,
      writeValue: async () => {}
    }
  })
  assert(consumer.name === 'empty_state', 'consumer name preserved')
  const result = await consumer.applyDecay({}, 100)
  assert(result === null, 'empty-state apply returns null cleanly')
}

console.log('\n=== DECAY_SEMANTICS enum exposed for consumer use ===\n')
{
  assert(DECAY_SEMANTICS.HIGH_WATER_MARK === 'high-water-mark', 'HIGH_WATER_MARK value')
  assert(DECAY_SEMANTICS.CONSUMED === 'consumed', 'CONSUMED value')
  assert(DECAY_SEMANTICS.WRITTEN_BACK === 'written-back', 'WRITTEN_BACK value')
  assert(Object.isFrozen(DECAY_SEMANTICS), 'DECAY_SEMANTICS is frozen (immutable)')
}

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`)
process.exit(failed > 0 ? 1 : 0)
