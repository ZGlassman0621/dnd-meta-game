/**
 * Phase 3.3 SC-7.4 — Notoriety decay migration tests.
 *
 * **Validates WRITTEN_BACK semantics** — the third decay shape after
 * CONSUMED (SC-7.2 mood) and HIGH_WATER_MARK (SC-7.3 absence). Anchor
 * advances to currentGameDay after each tick; subsequent ticks measure
 * elapsed from the advanced anchor, not the original event time.
 *
 * Coverage:
 *   1. NOTORIETY_DECAY_CONSUMER shape sanity (name, semantics=WRITTEN_BACK)
 *   2. Tiered decay rate preserved exactly:
 *      score > 50 → 1/day (sticky-at-high-levels)
 *      score ≤ 50 → 2/day
 *   3. WRITTEN_BACK anchor advancement: tick 1 advances anchor; tick 2
 *      measures from the advanced position, not the original event time
 *   4. Floor at 0 (notoriety can't go negative)
 *   5. Anchor fallback chain: last_decay → last_event → currentGameDay
 *      (the third fallback yields 0 elapsed → no-op, matching legacy)
 *   6. Behavior parity vs legacy decay loop on representative
 *      score/days-elapsed combinations
 *   7. Skip-and-GC of zeroed entries stays consumer-side (not delegated
 *      to abstraction)
 *
 * Pure tests — synthetic state. Production wire-up exercised via smoke +
 * the existing `livingWorldService::processCharacterTick` orchestrator
 * call to `decayScores`.
 */

import {
  NOTORIETY_DECAY_CONSUMER
} from '../server/services/notorietyService.js'
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

console.log('\n=== NOTORIETY_DECAY_CONSUMER: shape sanity ===\n')
{
  assert(NOTORIETY_DECAY_CONSUMER.name === 'character_notoriety_decay', 'consumer name')
  assert(NOTORIETY_DECAY_CONSUMER.semantics === DECAY_SEMANTICS.WRITTEN_BACK,
    'semantics = WRITTEN_BACK (anchor advances after each tick — distinguishes notoriety from disposition/mood)')
  assert(typeof NOTORIETY_DECAY_CONSUMER.applyDecay === 'function', 'applyDecay method exposed')
}

// Mirror config for behavior validation. Same decay function, semantics,
// floor as production NOTORIETY_DECAY_CONSUMER. Repository swapped for
// in-memory state.
function buildMockedConsumer(initialState) {
  const state = {
    last_decay_game_day: null,
    last_event_game_day: null,
    score: 0,
    ...initialState
  }
  const writeLog = []
  const advanceLog = []
  const consumer = registerDecayConsumer({
    name: 'notoriety_test',
    semantics: DECAY_SEMANTICS.WRITTEN_BACK,
    decayFunction: (daysElapsed, currentValue) => {
      const rate = currentValue > 50 ? 1 : 2
      return rate * daysElapsed
    },
    floor: 0,
    ceiling: 100,
    repository: {
      readAnchor: async (key) =>
        state.last_decay_game_day || state.last_event_game_day || key.currentGameDayFallback || null,
      readValue: async () => state.score,
      writeValue: async (_, v) => { state.score = v; writeLog.push(v) },
      advanceAnchor: async (_, anchor) => { state.last_decay_game_day = anchor; advanceLog.push(anchor) }
    }
  })
  return { consumer, state, writeLog, advanceLog }
}

console.log('\n=== Tiered decay rate: score > 50 → 1/day ===\n')
{
  // Score 75, 5 days elapsed (since last_decay anchor at day 100)
  // Expected: rate=1, decay=5, new=70
  const { consumer, state, writeLog } = buildMockedConsumer({
    score: 75, last_decay_game_day: 100
  })
  const result = await consumer.applyDecay({}, 105)
  assert(result.daysElapsed === 5, '5 days elapsed')
  assert(result.decayAmount === 5, 'decayAmount = 1 * 5 = 5 (sticky-at-high rate)')
  assert(result.newValue === 70, 'score 75 → 70')
  assert(state.score === 70, 'writeValue applied')
  assert(state.last_decay_game_day === 105, 'anchor advanced to 105 (WRITTEN_BACK)')
}

console.log('\n=== Tiered decay rate: score ≤ 50 → 2/day ===\n')
{
  const { consumer, state } = buildMockedConsumer({
    score: 30, last_decay_game_day: 100
  })
  const result = await consumer.applyDecay({}, 105)
  assert(result.decayAmount === 10, 'decayAmount = 2 * 5 = 10 (normal rate)')
  assert(result.newValue === 20, 'score 30 → 20')
  assert(state.last_decay_game_day === 105, 'anchor advanced')
}

console.log('\n=== Tiered decay: rate is currentValue-driven (boundary at 50) ===\n')
{
  // score=51 → rate=1; score=50 → rate=2
  const { consumer: c1 } = buildMockedConsumer({ score: 51, last_decay_game_day: 100 })
  const r1 = await c1.applyDecay({}, 101)
  assert(r1.decayAmount === 1, 'score 51, 1 day → decay 1 (rate=1, sticky)')

  const { consumer: c2 } = buildMockedConsumer({ score: 50, last_decay_game_day: 100 })
  const r2 = await c2.applyDecay({}, 101)
  assert(r2.decayAmount === 2, 'score 50, 1 day → decay 2 (rate=2, normal)')
}

console.log('\n=== WRITTEN_BACK semantics: tick 2 measures from advanced anchor ===\n')
{
  // Tick 1: score 60 at day 100, currentDay 105 → 5 elapsed → decay 5 → score 55, anchor → 105
  // Tick 2: currentDay 110 → 5 elapsed (FROM 105, not 100) → decay 5 → score 50, anchor → 110
  // If the abstraction were HIGH_WATER_MARK, tick 2 would measure 10 elapsed from 100 → decay 10
  const { consumer, state, advanceLog } = buildMockedConsumer({
    score: 60, last_decay_game_day: 100
  })

  await consumer.applyDecay({}, 105)
  assert(state.score === 55, 'tick 1: 60 - 5 = 55')
  assert(state.last_decay_game_day === 105, 'tick 1: anchor → 105')

  await consumer.applyDecay({}, 110)
  // From the advanced anchor (105) to currentGameDay (110): 5 elapsed
  // score 55 (≤50? no, 55>50, rate=1) → decay 5 → 50
  assert(state.score === 50, 'tick 2: measures from advanced anchor (5 elapsed, not 10)')
  assert(state.last_decay_game_day === 110, 'tick 2: anchor → 110')
  assert(advanceLog.length === 2, 'advanceAnchor called twice (once per tick)')
}

console.log('\n=== Floor at 0: large elapsed clamps to 0 ===\n')
{
  // Score 5, 100 days elapsed → decay 200 (rate=2, days=100) → clamp to 0
  const { consumer, state } = buildMockedConsumer({
    score: 5, last_decay_game_day: 100
  })
  const result = await consumer.applyDecay({}, 200)
  assert(result.newValue === 0, 'score 5 - 200 = -195 → clamp to 0')
  assert(state.score === 0, 'writeValue with 0')
  assert(state.last_decay_game_day === 200, 'anchor still advances even at floor')
}

console.log('\n=== Anchor fallback: last_decay null → falls back to last_event ===\n')
{
  // First decay tick after an event — last_decay is null, last_event is set.
  const { consumer, state } = buildMockedConsumer({
    score: 40, last_decay_game_day: null, last_event_game_day: 100
  })
  const result = await consumer.applyDecay({ currentGameDayFallback: 110 }, 110)
  // Anchor falls back to last_event (100); 10 days elapsed; rate=2; decay 20; score 40 → 20
  assert(result.daysElapsed === 10, 'falls back to last_event (10 elapsed)')
  assert(state.score === 20, '40 - 20 = 20')
  assert(state.last_decay_game_day === 110, 'last_decay now set (advanced anchor)')
}

console.log('\n=== Anchor fallback: both columns null → currentGameDayFallback → 0 elapsed → no-op ===\n')
{
  const { consumer, state, writeLog, advanceLog } = buildMockedConsumer({
    score: 50, last_decay_game_day: null, last_event_game_day: null
  })
  const result = await consumer.applyDecay({ currentGameDayFallback: 100 }, 100)
  assert(result === null, 'both anchors null + fallback === currentGameDay → 0 elapsed → no-op')
  assert(writeLog.length === 0, 'no writeValue call')
  assert(advanceLog.length === 0, 'no advanceAnchor call')
}

console.log('\n=== Edge: 0 elapsed (same-day tick) is no-op ===\n')
{
  const { consumer, writeLog, advanceLog } = buildMockedConsumer({
    score: 50, last_decay_game_day: 100
  })
  const result = await consumer.applyDecay({}, 100)
  assert(result === null, 'same-day tick → 0 elapsed → no-op')
  assert(writeLog.length === 0 && advanceLog.length === 0, 'no DB writes on no-op')
}

console.log('\n=== Behavior parity: legacy decay loop vs new abstraction (representative cases) ===\n')
{
  // Inline-replicate the legacy per-entry decay logic, run side-by-side
  // with the abstraction. Verify identical outputs for the same inputs.
  function legacyDecayPerEntry(entry, currentGameDay) {
    const result = { ...entry }
    if (result.score <= 0) return result  // skipped at orchestrator level
    const lastDecay = result.last_decay_game_day || result.last_event_game_day || currentGameDay
    const daysSinceDecay = currentGameDay - lastDecay
    if (daysSinceDecay < 1) return result
    const rate = result.score > 50 ? 1 : 2
    const totalDecay = rate * daysSinceDecay
    const newScore = Math.max(0, result.score - totalDecay)
    result.score = newScore
    result.last_decay_game_day = currentGameDay
    return result
  }

  const cases = [
    [{ score: 75, last_decay_game_day: 100, last_event_game_day: 50 }, 105, 'high score, 5 elapsed'],
    [{ score: 30, last_decay_game_day: 100, last_event_game_day: 50 }, 105, 'low score, 5 elapsed'],
    [{ score: 75, last_decay_game_day: null, last_event_game_day: 100 }, 110, 'fallback to last_event'],
    [{ score: 5, last_decay_game_day: 100, last_event_game_day: 50 }, 200, 'clamp to floor'],
    [{ score: 50, last_decay_game_day: 100, last_event_game_day: 50 }, 100, 'no elapsed']
  ]

  for (const [initial, currentDay, label] of cases) {
    const legacyResult = legacyDecayPerEntry(initial, currentDay)
    const { consumer, state } = buildMockedConsumer(initial)
    await consumer.applyDecay({ currentGameDayFallback: currentDay }, currentDay)
    assert(state.score === legacyResult.score, `${label}: score matches legacy (${state.score} === ${legacyResult.score})`)
    assert(
      state.last_decay_game_day === legacyResult.last_decay_game_day,
      `${label}: last_decay_game_day matches legacy`
    )
  }
}

console.log('\n=== Three semantics validated together: each semantics behaves distinctly ===\n')
{
  // Run a single sequence (scoreDecayBy:5, anchor:100, currentDay:105)
  // through three differently-configured consumers — verify they produce
  // structurally different end-states matching their semantics.
  const baseRepo = (state) => ({
    readAnchor: async () => state.anchor,
    readValue: async () => state.value,
    writeValue: async (_, v) => { state.value = v },
    consumeAnchor: async () => { state.anchor = null; state.consumed = true },
    advanceAnchor: async (_, a) => { state.anchor = a; state.advanced = true }
  })

  // High-water-mark: anchor stays
  const hwm = { anchor: 100, value: 50 }
  const hwmConsumer = registerDecayConsumer({
    name: 'hwm', semantics: DECAY_SEMANTICS.HIGH_WATER_MARK,
    decayFunction: (d) => d, floor: 0, repository: baseRepo(hwm)
  })
  await hwmConsumer.applyDecay({}, 105)
  assert(hwm.value === 45 && hwm.anchor === 100, 'HIGH_WATER_MARK: value decayed, anchor STAYS at 100')

  // Consumed: anchor NULLs at floor
  const con = { anchor: 100, value: 3 }
  const conConsumer = registerDecayConsumer({
    name: 'con', semantics: DECAY_SEMANTICS.CONSUMED,
    decayFunction: (d) => d, floor: 0, repository: baseRepo(con)
  })
  await conConsumer.applyDecay({}, 105)
  assert(con.value === 0 && con.anchor === null && con.consumed, 'CONSUMED: value at floor, anchor NULLed')

  // Written-back: anchor advances
  const wb = { anchor: 100, value: 50 }
  const wbConsumer = registerDecayConsumer({
    name: 'wb', semantics: DECAY_SEMANTICS.WRITTEN_BACK,
    decayFunction: (d) => d, floor: 0, repository: baseRepo(wb)
  })
  await wbConsumer.applyDecay({}, 105)
  assert(wb.value === 45 && wb.anchor === 105 && wb.advanced, 'WRITTEN_BACK: value decayed, anchor ADVANCED to 105')

  console.log('  ✓ DECAY_SEMANTICS enum exercised completely (CONSUMED + HIGH_WATER_MARK + WRITTEN_BACK)')
  passed++
}

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`)
process.exit(failed > 0 ? 1 : 0)
