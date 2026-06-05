/**
 * Phase 3.3 SC-7.2 — Companion mood decay migration tests.
 *
 * First Pattern D consumer port. Validates:
 *   1. MOOD_DECAY_CONSUMER shape sanity (name, semantics='consumed', applyDecay)
 *   2. The legacy decay function semantics preserved exactly
 *      (1 intensity per 2 game days)
 *   3. CONSUMED-vs-HIGH-WATER distinction:
 *      - Below floor: anchor stays put, value decays
 *      - At floor: anchor NULLs, full state reset (the consumed-anchor
 *        semantics that distinguishes mood from disposition/notoriety)
 *   4. Reset shape exactly mirrors legacy behavior:
 *      mood='content', mood_cause=NULL, mood_intensity=1, mood_set_game_day=NULL
 *   5. Subsequent ticks after reset are no-ops (anchor=null, no decay)
 *
 * **Production wire-up** (registerDecayConsumer with real dbGet/dbRun
 * callbacks) is exercised by the smoke test (server boot) + the existing
 * route call to `decayMoods` from `routes/dmSession.js:812`. This test
 * builds a PARALLEL consumer with mirror config + in-memory repo to
 * validate the per-companion behavior without DB dependency.
 */

import {
  MOOD_DECAY_CONSUMER
} from '../server/services/companionBackstoryService.js'
import {
  registerDecayConsumer,
  DECAY_SEMANTICS
} from '../server/services/timeBoundedState.js'

let passed = 0
let failed = 0

function assert(condition, message) {
  if (condition) { console.log(`  ✓ ${message}`); passed++ }
  else { console.error(`  ✗ ${message}`); failed++ }
}

console.log('\n=== MOOD_DECAY_CONSUMER: shape sanity ===\n')
{
  assert(MOOD_DECAY_CONSUMER.name === 'companion_mood', 'consumer name = "companion_mood"')
  assert(MOOD_DECAY_CONSUMER.semantics === DECAY_SEMANTICS.CONSUMED, 'semantics = CONSUMED (distinguishes mood from disposition/notoriety)')
  assert(typeof MOOD_DECAY_CONSUMER.applyDecay === 'function', 'applyDecay method exposed')
}

// ---- Mirror config for behavior verification ----
// Same decay function + semantics + floor as production MOOD_DECAY_CONSUMER.
// Repository swapped for in-memory state so we can observe the abstraction's
// behavior without DB.
function buildMockedMoodConsumer(initialState) {
  const state = { ...initialState }  // { mood_set_game_day, mood_intensity, mood, mood_cause }
  const writeLog = []
  const consumeLog = []
  const consumer = registerDecayConsumer({
    name: 'companion_mood_test',
    semantics: DECAY_SEMANTICS.CONSUMED,
    decayFunction: (daysElapsed) => Math.floor(daysElapsed / 2),
    floor: 0,
    repository: {
      readAnchor: async () => state.mood_set_game_day,
      readValue: async () => state.mood_intensity || 1,
      writeValue: async (_, newValue) => {
        state.mood_intensity = newValue
        writeLog.push({ field: 'intensity', value: newValue })
      },
      consumeAnchor: async () => {
        // Mirror production: full state reset (NOT just null the anchor)
        state.mood = 'content'
        state.mood_cause = null
        state.mood_intensity = 1
        state.mood_set_game_day = null
        consumeLog.push({ ...state })
      }
    }
  })
  return { consumer, state, writeLog, consumeLog }
}

console.log('\n=== Decay function: 1 intensity per 2 game days (legacy preserved) ===\n')
{
  // Intensity 5, anchor at game-day 100, current 102 → 2 days elapsed → decay 1 → newValue 4
  const { consumer, state } = buildMockedMoodConsumer({
    mood: 'angry', mood_cause: 'betrayal', mood_intensity: 5, mood_set_game_day: 100
  })
  const result = await consumer.applyDecay({}, 102)
  assert(result.daysElapsed === 2, '2 days elapsed')
  assert(result.decayAmount === 1, 'decayAmount = floor(2/2) = 1')
  assert(result.oldValue === 5 && result.newValue === 4, 'intensity 5 → 4')
  assert(state.mood === 'angry', 'mood unchanged (not at floor)')
  assert(state.mood_set_game_day === 100, 'anchor unchanged (not at floor)')
}

console.log('\n=== CONSUMED-vs-HIGH-WATER: anchor stays below floor, NULLs AT floor ===\n')
{
  // Sequence: intensity 3 at day 100 → tick at 104 (4 elapsed → decay 2 → intensity 1, anchor STAYS)
  //                                  → tick at 106 (6 elapsed → decay 3 → newValue 1-3=-2, clamp 0 → RESET)
  // The CONSUMED semantics fires on the second tick when newValue hits floor.
  const { consumer, state, consumeLog } = buildMockedMoodConsumer({
    mood: 'sad', mood_cause: 'lost item', mood_intensity: 3, mood_set_game_day: 100
  })

  const tick1 = await consumer.applyDecay({}, 104)
  assert(tick1.newValue === 1, 'tick1: intensity 3 - 2 = 1')
  assert(state.mood_set_game_day === 100, 'tick1: anchor STAYS at 100 (not at floor)')
  assert(state.mood === 'sad', 'tick1: mood STAYS as sad')
  assert(consumeLog.length === 0, 'tick1: consumeAnchor NOT called yet')

  const tick2 = await consumer.applyDecay({}, 106)
  assert(tick2.newValue === 0, 'tick2: intensity 1 - decay → clamp to floor 0')
  assert(consumeLog.length === 1, 'tick2: consumeAnchor called ONCE at floor')
  assert(state.mood === 'content', 'tick2: mood RESET to content')
  assert(state.mood_cause === null, 'tick2: mood_cause RESET to null')
  assert(state.mood_intensity === 1, 'tick2: mood_intensity RESET to 1 (NOT 0; legacy reset shape)')
  assert(state.mood_set_game_day === null, 'tick2: anchor NULLed (consumed semantics)')
}

console.log('\n=== Subsequent tick after reset is no-op (anchor=null) ===\n')
{
  // After reset, anchor is null → applyDecay returns null without writes.
  const { consumer, state, writeLog, consumeLog } = buildMockedMoodConsumer({
    mood: 'content', mood_cause: null, mood_intensity: 1, mood_set_game_day: null
  })
  const result = await consumer.applyDecay({}, 200)
  assert(result === null, 'null anchor → no-op (returns null)')
  assert(writeLog.length === 0, 'no writeValue calls')
  assert(consumeLog.length === 0, 'no consumeAnchor calls')
}

console.log('\n=== Edge: tick within same day (0 elapsed) is no-op ===\n')
{
  const { consumer, writeLog } = buildMockedMoodConsumer({
    mood: 'angry', mood_cause: 'x', mood_intensity: 4, mood_set_game_day: 100
  })
  const result = await consumer.applyDecay({}, 100)
  assert(result === null, '0 days elapsed → no-op')
  assert(writeLog.length === 0, 'no writes')
}

console.log('\n=== Edge: 1 day elapsed → decay 0 → no-op (legacy threshold preserved) ===\n')
{
  // floor(1/2) = 0, so intensity unchanged; abstraction's decayAmount=0 short-circuit fires.
  const { consumer, writeLog } = buildMockedMoodConsumer({
    mood: 'sad', mood_cause: 'y', mood_intensity: 3, mood_set_game_day: 100
  })
  const result = await consumer.applyDecay({}, 101)
  assert(result === null, '1 day elapsed → decay 0 → no-op')
  assert(writeLog.length === 0, 'no writes')
}

console.log('\n=== Edge: large elapsed crosses floor in single tick ===\n')
{
  // After a long absence: anchor at day 100, current at day 200 → 100 elapsed → decay 50 → clamp 0 → reset
  const { consumer, state, consumeLog } = buildMockedMoodConsumer({
    mood: 'angry', mood_cause: 'long-ago', mood_intensity: 4, mood_set_game_day: 100
  })
  const result = await consumer.applyDecay({}, 200)
  assert(result.decayAmount === 50, 'decayAmount = floor(100/2) = 50')
  assert(result.newValue === 0, 'clamped to floor 0')
  assert(consumeLog.length === 1, 'reset fires on single-tick floor crossing')
  assert(state.mood === 'content' && state.mood_set_game_day === null, 'full reset state')
}

console.log('\n=== Behavior comparison: legacy decay loop vs new abstraction (same outputs) ===\n')
{
  // Inline-replicate the legacy decayMoods per-companion loop, run side-by-side
  // with the abstraction. Verify identical end-state for the same inputs.
  function legacyDecayPerCompanion(comp, currentGameDay) {
    const result = { ...comp }
    const daysElapsed = currentGameDay - (result.mood_set_game_day || currentGameDay)
    if (daysElapsed <= 0) return result
    const decay = Math.floor(daysElapsed / 2)
    const newIntensity = (result.mood_intensity || 1) - decay
    if (newIntensity <= 0) {
      // Reset to content
      result.mood = 'content'
      result.mood_cause = null
      result.mood_intensity = 1
      result.mood_set_game_day = null
    } else if (newIntensity < result.mood_intensity) {
      result.mood_intensity = newIntensity
    }
    return result
  }

  const cases = [
    // [initial, currentGameDay, label]
    [{ mood: 'angry', mood_cause: 'x', mood_intensity: 5, mood_set_game_day: 100 }, 102, 'decay 1'],
    [{ mood: 'sad', mood_cause: 'y', mood_intensity: 3, mood_set_game_day: 100 }, 110, 'decay to floor → reset'],
    [{ mood: 'happy', mood_cause: 'z', mood_intensity: 4, mood_set_game_day: 100 }, 100, 'no elapsed → no change'],
    [{ mood: 'angry', mood_cause: 'x', mood_intensity: 2, mood_set_game_day: 50 }, 200, 'long absence → reset']
  ]
  for (const [initial, currentDay, label] of cases) {
    const legacyResult = legacyDecayPerCompanion(initial, currentDay)
    const { consumer, state } = buildMockedMoodConsumer(initial)
    await consumer.applyDecay({}, currentDay)
    assert(state.mood === legacyResult.mood, `${label}: mood matches legacy`)
    assert(state.mood_intensity === legacyResult.mood_intensity, `${label}: intensity matches legacy`)
    assert(state.mood_cause === legacyResult.mood_cause, `${label}: mood_cause matches legacy`)
    assert(state.mood_set_game_day === legacyResult.mood_set_game_day, `${label}: anchor matches legacy`)
  }
}

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`)
process.exit(failed > 0 ? 1 : 0)
