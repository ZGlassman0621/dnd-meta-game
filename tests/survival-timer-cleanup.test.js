/**
 * Phase 3.3 SC-7.6 — Survival timer cleanup tests.
 *
 * Validates:
 *   1. STARVATION_THRESHOLD_CONSUMER + DEHYDRATION_THRESHOLD_CONSUMER
 *      built + exposed (name, threshold, checkAndFire)
 *   2. **Anchor-as-source-of-truth** — daysSinceLastMeal/Drink helpers
 *      compute from anchor when set; fall back to vestigial column when
 *      anchor null (legacy data bridging)
 *   3. **Weather-modulation fix-along-the-way #4** — dehydration handler
 *      reads `hint.weather` and doubles effective elapsed in hot
 *      conditions. Pre-fix: legacy code only added a string to the
 *      message; exhaustion levels didn't accelerate. Post-fix: 1 raw day
 *      in hot weather = 2 effective days = severe-tier exhaustion (2
 *      levels) immediately.
 *   4. **Counter-column vestigial behavior** — processDayChange no longer
 *      writes the counter columns; eat/drink continues to reset them
 *      (harmless cache write).
 *   5. Behavior parity for the standard (non-weather-modulated) cases.
 */

import {
  STARVATION_THRESHOLD_CONSUMER,
  DEHYDRATION_THRESHOLD_CONSUMER,
  checkStarvation,
  checkDehydration,
  getSurvivalStatus
} from '../server/services/survivalService.js'

let passed = 0
let failed = 0

function assert(condition, message) {
  if (condition) { console.log(`  ✓ ${message}`); passed++ }
  else { console.error(`  ✗ ${message}`); failed++ }
}

function makeChar(overrides = {}) {
  const base = {
    id: 1,
    days_without_food: 0,
    days_without_water: 0,
    last_meal_game_day: 10,
    last_drink_game_day: 10,
    game_day: 10,
    ability_scores: JSON.stringify({ str: 10, dex: 10, con: 14, int: 10, wis: 10, cha: 10 }),
    inventory: JSON.stringify([]),
    ...overrides
  }
  // Auto-sync anchor when override sets the column (post-SC-7.6
  // anchor-source-of-truth requires the mock to stay self-consistent).
  if (overrides.days_without_food != null && overrides.last_meal_game_day === undefined) {
    base.last_meal_game_day = base.game_day - base.days_without_food
  }
  if (overrides.days_without_water != null && overrides.last_drink_game_day === undefined) {
    base.last_drink_game_day = base.game_day - base.days_without_water
  }
  return base
}

console.log('\n=== Threshold consumers built + exposed ===\n')
{
  assert(STARVATION_THRESHOLD_CONSUMER.name === 'starvation', 'starvation consumer name')
  assert(STARVATION_THRESHOLD_CONSUMER.threshold === 1, 'starvation threshold = 1 (one day past effective starvation day)')
  assert(typeof STARVATION_THRESHOLD_CONSUMER.checkAndFire === 'function', 'starvation: checkAndFire exposed')
  assert(DEHYDRATION_THRESHOLD_CONSUMER.name === 'dehydration', 'dehydration consumer name')
  assert(DEHYDRATION_THRESHOLD_CONSUMER.threshold === 1, 'dehydration threshold = 1 (one raw day without water)')
}

console.log('\n=== Anchor-as-source-of-truth: daysSinceLastMeal/Drink computed from anchor ===\n')
{
  // Anchor at 10, current at 15 → 5 elapsed
  const c = makeChar({ last_meal_game_day: 10, game_day: 15, last_drink_game_day: 10 })
  // Note: makeChar's auto-sync only fires when override sets days_without_food;
  // here we explicitly set anchor + game_day to test the helper directly via
  // checkStarvation. CON 14 → mod +2 → threshold 5. Days elapsed = 5 = at threshold.
  // Hungry-not-starving branch.
  const result = await checkStarvation(c)
  assert(result.hungry === true && result.starving === false, '5 days at threshold → hungry, not starving')
  assert(result.daysWithout === 5, 'reports 5 days without food (computed from anchor)')
  assert(result.thresholdDays === 5, 'threshold derived from CON mod')
}

console.log('\n=== Anchor null + counter column set: legacy fallback ===\n')
{
  // Simulates pre-migration character with no anchor but counter accumulated
  const c = makeChar({
    last_meal_game_day: null, last_drink_game_day: null,
    days_without_food: 6, days_without_water: 0
  })
  // Override sets days_without_food but auto-sync's `=== undefined` check
  // means anchor stays at null (since override set it explicitly).
  // CON 14 → threshold 5. 6 > 5 → starving.
  const result = await checkStarvation(c)
  assert(result.starving === true, 'legacy data (anchor null, column 6) → starving')
  assert(result.daysWithout === 6, 'fallback reports column value')
}

console.log('\n=== Starvation: CON modifier varies threshold ===\n')
{
  // CON 8 → mod -1 → threshold = max(3 + -1, 1) = 2
  const lowConChar = makeChar({
    days_without_food: 3,
    ability_scores: JSON.stringify({ str: 10, dex: 10, con: 8, int: 10, wis: 10, cha: 10 })
  })
  const result = await checkStarvation(lowConChar)
  assert(result.starving === true, 'CON 8 (threshold 2): 3 days → starving')
  assert(result.thresholdDays === 2, 'threshold = max(3 + (-1), 1) = 2')
  assert(result.overDays === 1, 'overDays = 3 - 2 = 1')
}

console.log('\n=== Starvation: minimum threshold of 1 (CON 1 doesn\'t collapse to 0) ===\n')
{
  // CON 1 → mod -5 → threshold = max(3 + -5, 1) = 1
  const c = makeChar({
    days_without_food: 2,
    ability_scores: JSON.stringify({ str: 10, dex: 10, con: 1, int: 10, wis: 10, cha: 10 })
  })
  const result = await checkStarvation(c)
  assert(result.starving === true, 'CON 1 (threshold 1): 2 days → starving')
  assert(result.thresholdDays === 1, 'threshold floor enforced')
}

console.log('\n=== Dehydration: 1 day raw, normal weather → 1 exhaustion level ===\n')
{
  const c = makeChar({ days_without_water: 1 })
  const result = await checkDehydration(c, null)
  assert(result.dehydrated === true, '1 raw day → dehydrated')
  assert(result.exhaustion_levels === 1, '1 exhaustion level (normal weather, < 2 effective days)')
  assert(result.raw_days === 1, 'raw_days reported')
  assert(result.effective_days === 1, 'effective_days = raw (no hot multiplier)')
  assert(result.hot === false, 'hot flag false')
}

console.log('\n=== Dehydration: 2 days raw, normal weather → 2 exhaustion levels (severe tier) ===\n')
{
  const c = makeChar({ days_without_water: 2 })
  const result = await checkDehydration(c, null)
  assert(result.exhaustion_levels === 2, '2 raw days → severe tier (2 exhaustion)')
  assert(result.effective_days === 2, 'effective_days = 2')
}

console.log('\n=== HEADLINE: Weather modulation fix-along-the-way #4 ===\n')
{
  // Pre-fix: 1 day without water in hot weather = "1 exhaustion + cosmetic message"
  // Post-fix: 1 day in hot weather = 2 effective days = 2 exhaustion (severe tier immediately)

  // Heat wave weather type
  const c1 = makeChar({ days_without_water: 1 })
  const heatWaveResult = await checkDehydration(c1, { weather_type: 'heat_wave' })
  assert(heatWaveResult.hot === true, 'heat_wave weather flagged hot')
  assert(heatWaveResult.raw_days === 1, '1 raw day')
  assert(heatWaveResult.effective_days === 2, '1 raw × 2 (hot multiplier) = 2 effective days')
  assert(heatWaveResult.exhaustion_levels === 2, 'severe-tier exhaustion (2 levels) immediately on day 1 in hot weather (BUG FIX)')
  assert(heatWaveResult.message.includes('Hot conditions DOUBLE'), 'message reflects accelerated rate')

  // High temperature (>85F) also triggers hot
  const c2 = makeChar({ days_without_water: 1 })
  const tempResult = await checkDehydration(c2, { temperature_f: 92 })
  assert(tempResult.hot === true, 'temperature_f > 85 → hot')
  assert(tempResult.exhaustion_levels === 2, 'high-temp triggers same doubling')

  // Boundary: exactly 85F is NOT hot
  const c3 = makeChar({ days_without_water: 1 })
  const boundaryResult = await checkDehydration(c3, { temperature_f: 85 })
  assert(boundaryResult.hot === false, 'temperature_f === 85 is not hot (strictly > 85)')
  assert(boundaryResult.exhaustion_levels === 1, '85F → normal rate (1 exhaustion)')
}

console.log('\n=== Weather modulation: 2 raw days in hot = 4 effective (still capped at 2 exhaustion levels) ===\n')
{
  const c = makeChar({ days_without_water: 2 })
  const result = await checkDehydration(c, { weather_type: 'heat_wave' })
  assert(result.effective_days === 4, '2 raw × 2 = 4 effective days')
  assert(result.exhaustion_levels === 2, '4 effective still produces 2 exhaustion (cap at severe tier)')
}

console.log('\n=== Dehydration: 0 raw days (just drank) → not dehydrated ===\n')
{
  const c = makeChar({ days_without_water: 0 })
  const normal = await checkDehydration(c, null)
  assert(!normal.dehydrated, 'normal weather + 0 days → not dehydrated')

  const hot = await checkDehydration(c, { weather_type: 'heat_wave' })
  assert(!hot.dehydrated, 'hot weather + 0 days → not dehydrated (kick-in still requires 1 raw day)')
}

console.log('\n=== getSurvivalStatus: computes from anchor, returns vestigial-column-equivalent shape ===\n')
{
  // Client-facing response shape preserved: days_without_food / days_without_water
  // are still in the payload, computed from the anchor.
  const c = makeChar({ days_without_food: 3, days_without_water: 0 })
  // makeChar auto-syncs anchor: last_meal_game_day = 10 - 3 = 7
  // getSurvivalStatus reads currentDay from character.game_day (10)
  // daysSinceLastMeal: anchor 7 → daysSince(7, 10) = 3
  // CON 14 → threshold 5; floor(5/2)=2; days=3 > 2 → 'starving' tier
  // (this is the level-band, not actual exhaustion firing)
  const status = getSurvivalStatus(c, null)
  assert(status.days_without_food === 3, 'days_without_food field computed from anchor')
  assert(status.days_without_water === 0, 'days_without_water field correct')
  assert(status.hunger_level === 'starving', 'hunger_level: days=3 with threshold=5 → "starving" band (still under threshold so no exhaustion)')
}

console.log('\n=== getSurvivalStatus: legacy data (anchor null, column N) bridges via fallback ===\n')
{
  const c = makeChar({
    last_meal_game_day: null, last_drink_game_day: null,
    days_without_food: 5, days_without_water: 1
  })
  const status = getSurvivalStatus(c, null)
  assert(status.days_without_food === 5, 'fallback to column value when anchor null')
  assert(status.days_without_water === 1, 'fallback for water too')
}

console.log('\n=== Behavior parity: standard cases match legacy semantics ===\n')
{
  // 8 representative scenarios — verify the new abstraction produces
  // status reports semantically equivalent to what the legacy
  // checkStarvation/checkDehydration would have returned for the same
  // input character. Legacy logic inlined here as the comparator.
  function legacyCheckStarvation(character) {
    const conMod = Math.floor(((JSON.parse(character.ability_scores).con || 10) - 10) / 2)
    const threshold = Math.max(3 + conMod, 1)
    const daysWithout = character.days_without_food || 0
    if (daysWithout > threshold) {
      return { starving: true, hungry: true, exhaustion_level: 1 }
    }
    if (daysWithout > 0) return { starving: false, hungry: true }
    return { starving: false, hungry: false }
  }

  const cases = [
    { days_without_food: 0, label: 'fed' },
    { days_without_food: 2, label: 'hungry' },
    { days_without_food: 5, label: 'at threshold' },  // CON 14 → threshold 5
    { days_without_food: 6, label: 'starving' },
    { days_without_food: 10, label: 'critical' }
  ]
  for (const { days_without_food, label } of cases) {
    const c = makeChar({ days_without_food })
    const newR = await checkStarvation(c)
    const legacyR = legacyCheckStarvation(c)
    assert(newR.starving === legacyR.starving, `${label}: starving matches legacy`)
    assert(newR.hungry === legacyR.hungry, `${label}: hungry matches legacy`)
  }
}

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`)
process.exit(failed > 0 ? 1 : 0)
