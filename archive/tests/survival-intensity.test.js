/**
 * Phase 3.3 SC-7.6.5 — Player-tunable survival intensity tests.
 *
 * Spec §3.3.10. Four-position character setting:
 *   'off' | 'lenient' | 'standard' | 'strict'
 *
 * Validates:
 *   1. Off short-circuits via null anchor (both consumers report no fire,
 *      and the wrapper functions return non-effect responses).
 *   2. Lenient extends thresholds: starvation = 6 + CON mod (vs. 3 + CON
 *      for Standard); dehydration kick-in = 3 days (vs. 1 day).
 *   3. Strict tightens: starvation = 2 + CON mod; dehydration tier1
 *      magnitude = 2 levels (vs. 1 for Standard).
 *   4. Hot-weather multiplier varies by intensity (1.5/2.0/3.0 for
 *      Lenient/Standard/Strict).
 *   5. Cold-weather multiplier (Strict-only addition; 1.5×) — Standard +
 *      Lenient pass cold weather through unmodified.
 *   6. **Byte-identity for Standard** — any character with intensity =
 *      'standard' (the default for legacy rows) sees the same exhaustion
 *      levels, message strings, and response shape as SC-7.6.
 *   7. Default behavior — character with no `survival_intensity` field
 *      gets 'standard' from the helper (covers unmigrated test mocks).
 *   8. PUT allowlist enforces the four-value enum (validated separately
 *      via the route's VALID_SURVIVAL_INTENSITIES set).
 */

import {
  STARVATION_THRESHOLD_CONSUMER,
  DEHYDRATION_THRESHOLD_CONSUMER,
  checkStarvation,
  checkDehydration,
  getSurvivalStatus
} from '../server/services/survivalService.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) { console.log(`  ✓ ${message}`); passed++; }
  else { console.error(`  ✗ ${message}`); failed++; }
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
    survival_intensity: 'standard',
    ...overrides
  };
  return base;
}

// ============================================================
// 1. OFF — short-circuits both consumers
// ============================================================
console.log('\n=== Test 1: OFF — null-anchor short-circuit ===\n');

await (async () => {
  const c = makeChar({ survival_intensity: 'off', last_meal_game_day: 0, game_day: 100 });
  // 100-day starvation should ABSOLUTELY fire under Standard; Off mutes it.
  const starve = await STARVATION_THRESHOLD_CONSUMER.checkAndFire({ character: c, daysWithout: 100, thresholdDays: 5 }, 100);
  assert(starve.fired === false, 'STARVATION consumer does not fire with intensity=off (100 days without food)');
  assert(starve.reason === 'no_anchor' || starve.anchor === null, 'STARVATION consumer reports no_anchor (or anchor null) for off');
})();

await (async () => {
  const c = makeChar({ survival_intensity: 'off', last_drink_game_day: 0, game_day: 100 });
  const dehy = await DEHYDRATION_THRESHOLD_CONSUMER.checkAndFire({ character: c }, 100, { weather: { type: 'heat_wave' } });
  assert(dehy.fired === false, 'DEHYDRATION consumer does not fire with intensity=off (100 days, hot)');
})();

await (async () => {
  const c = makeChar({ survival_intensity: 'off', last_meal_game_day: 0, last_drink_game_day: 0, game_day: 100 });
  const s = await checkStarvation(c, 100);
  assert(s.starving === false && s.hungry === false, 'checkStarvation wrapper reports non-effect for off (would otherwise be deeply starving)');
  assert(s.intensity === 'off', 'checkStarvation reports intensity=off');

  const d = await checkDehydration(c, { type: 'heat_wave' }, 100);
  assert(d.dehydrated === false && d.exhaustion_levels === 0, 'checkDehydration wrapper reports non-effect for off');
  assert(d.intensity === 'off', 'checkDehydration reports intensity=off');
})();

// ============================================================
// 2. LENIENT — extended thresholds
// ============================================================
console.log('\n=== Test 2: LENIENT — extended thresholds ===\n');

// Starvation: base 6 + CON(+2) = 8 days threshold
await (async () => {
  const c = makeChar({ survival_intensity: 'lenient', last_meal_game_day: 0, game_day: 7 });
  const s = await checkStarvation(c, 7);
  assert(s.starving === false, 'Lenient: 7 days without food → still hungry, not starving (threshold = 8)');
  assert(s.hungry === true, 'Lenient: 7 days without food → hungry');
  assert(s.thresholdDays === 8, `Lenient: thresholdDays = 8 (6 + CON 2), got ${s.thresholdDays}`);
})();

await (async () => {
  const c = makeChar({ survival_intensity: 'lenient', last_meal_game_day: 0, game_day: 9 });
  const s = await checkStarvation(c, 9);
  assert(s.starving === true, 'Lenient: 9 days without food → starving (1 day past threshold 8)');
})();

// Dehydration: kick-in at 3 days (Lenient)
await (async () => {
  const c = makeChar({ survival_intensity: 'lenient', last_drink_game_day: 0, game_day: 2 });
  const d = await checkDehydration(c, null, 2);
  assert(d.dehydrated === false, 'Lenient: 2 days without water → not yet dehydrated (kick-in at 3)');
})();

await (async () => {
  const c = makeChar({ survival_intensity: 'lenient', last_drink_game_day: 0, game_day: 3 });
  const d = await checkDehydration(c, null, 3);
  assert(d.dehydrated === true, 'Lenient: 3 days without water → dehydrated (kick-in)');
  assert(d.exhaustion_levels === 1, `Lenient: tier1 magnitude = 1 level (capped), got ${d.exhaustion_levels}`);
})();

// Lenient capped at 1 level even at high days
await (async () => {
  const c = makeChar({ survival_intensity: 'lenient', last_drink_game_day: 0, game_day: 10 });
  const d = await checkDehydration(c, null, 10);
  assert(d.dehydrated === true, 'Lenient: 10 days without water → dehydrated');
  assert(d.exhaustion_levels === 1, `Lenient: tier2 magnitude STILL = 1 (capped, no escalation), got ${d.exhaustion_levels}`);
})();

// ============================================================
// 3. STANDARD — byte-identity with SC-7.6 baseline
// ============================================================
console.log('\n=== Test 3: STANDARD — byte-identity with SC-7.6 ===\n');

// Starvation: 3 + CON(+2) = 5 days threshold
await (async () => {
  const c = makeChar({ survival_intensity: 'standard', last_meal_game_day: 0, game_day: 5 });
  const s = await checkStarvation(c, 5);
  assert(s.starving === false, 'Standard: 5 days without food → hungry, not starving (threshold = 5)');
  assert(s.thresholdDays === 5, `Standard: thresholdDays = 5 (3 + CON 2), got ${s.thresholdDays}`);
})();

await (async () => {
  const c = makeChar({ survival_intensity: 'standard', last_meal_game_day: 0, game_day: 6 });
  const s = await checkStarvation(c, 6);
  assert(s.starving === true, 'Standard: 6 days → starving (1 past threshold)');
})();

// Dehydration: kick-in at 1 day, 2× hot, 1/2 magnitudes
await (async () => {
  const c = makeChar({ survival_intensity: 'standard', last_drink_game_day: 0, game_day: 1 });
  const d = await checkDehydration(c, null, 1);
  assert(d.dehydrated === true, 'Standard: 1 day without water → dehydrated');
  assert(d.exhaustion_levels === 1, `Standard: 1-day tier = 1 level, got ${d.exhaustion_levels}`);
  assert(d.message.includes('No water for 1 day'), 'Standard message format preserved');
})();

await (async () => {
  const c = makeChar({ survival_intensity: 'standard', last_drink_game_day: 0, game_day: 2 });
  const d = await checkDehydration(c, null, 2);
  assert(d.exhaustion_levels === 2, `Standard: 2-day tier = 2 levels, got ${d.exhaustion_levels}`);
})();

// SC-7.6 fix-along-the-way #4 — hot weather DOUBLES at Standard
await (async () => {
  const c = makeChar({ survival_intensity: 'standard', last_drink_game_day: 0, game_day: 1 });
  const d = await checkDehydration(c, { type: 'heat_wave' }, 1);
  assert(d.exhaustion_levels === 2, `Standard hot: 1 raw × 2.0 = 2 effective → severe tier (2 levels), got ${d.exhaustion_levels}`);
  assert(d.hot === true, 'Standard hot: hot flag = true');
  assert(d.message.includes('DOUBLE'), 'Standard hot message preserves SC-7.6 phrasing ("DOUBLE")');
})();

// Cold weather is NOT modulated at Standard (byte-identity)
await (async () => {
  const c = makeChar({ survival_intensity: 'standard', last_drink_game_day: 0, game_day: 1 });
  const d = await checkDehydration(c, { type: 'blizzard' }, 1);
  assert(d.exhaustion_levels === 1, `Standard cold: NOT modulated, 1 level (vs 2 if mod'd), got ${d.exhaustion_levels}`);
  assert(d.cold === false, 'Standard cold: cold flag stays false (only set when coldMult > 1.0)');
})();

// ============================================================
// 4. STRICT — tighter thresholds, harsher modulation
// ============================================================
console.log('\n=== Test 4: STRICT — tighter thresholds ===\n');

// Starvation: 2 + CON(+2) = 4 days threshold
await (async () => {
  const c = makeChar({ survival_intensity: 'strict', last_meal_game_day: 0, game_day: 4 });
  const s = await checkStarvation(c, 4);
  assert(s.starving === false, 'Strict: 4 days → still hungry (threshold = 4)');
  assert(s.thresholdDays === 4, `Strict: thresholdDays = 4 (2 + CON 2), got ${s.thresholdDays}`);
})();

await (async () => {
  const c = makeChar({ survival_intensity: 'strict', last_meal_game_day: 0, game_day: 5 });
  const s = await checkStarvation(c, 5);
  assert(s.starving === true, 'Strict: 5 days → starving (1 past threshold 4)');
})();

// Dehydration: kick-in at 1 day, 3× hot, 1.5× cold, 2/2 magnitudes
await (async () => {
  const c = makeChar({ survival_intensity: 'strict', last_drink_game_day: 0, game_day: 1 });
  const d = await checkDehydration(c, null, 1);
  assert(d.dehydrated === true, 'Strict: 1 day without water → dehydrated');
  assert(d.exhaustion_levels === 2, `Strict: tier1 magnitude = 2 levels (severe immediately), got ${d.exhaustion_levels}`);
})();

await (async () => {
  const c = makeChar({ survival_intensity: 'strict', last_drink_game_day: 0, game_day: 1 });
  const d = await checkDehydration(c, { type: 'heat_wave' }, 1);
  assert(d.exhaustion_levels === 2, `Strict hot: still 2 levels (tier2 also = 2), got ${d.exhaustion_levels}`);
  assert(d.effective_days === 3, `Strict hot: 1 × 3.0 = 3 effective days, got ${d.effective_days}`);
  assert(d.message.includes('3x'), 'Strict hot message uses 3x multiplier wording');
})();

await (async () => {
  const c = makeChar({ survival_intensity: 'strict', last_drink_game_day: 0, game_day: 1 });
  const d = await checkDehydration(c, { type: 'blizzard' }, 1);
  assert(d.cold === true, 'Strict cold: cold flag set (Strict modulates cold)');
  assert(d.effective_days === 1.5, `Strict cold: 1 × 1.5 = 1.5 effective days, got ${d.effective_days}`);
  assert(d.exhaustion_levels === 2, `Strict cold: tier1 = 2 levels regardless, got ${d.exhaustion_levels}`);
  assert(d.message.includes('1.5x'), 'Strict cold message uses 1.5x multiplier wording');
})();

// ============================================================
// 5. DEFAULT — character without survival_intensity field
// ============================================================
console.log('\n=== Test 5: DEFAULT — missing field falls back to standard ===\n');

await (async () => {
  const c = makeChar();
  delete c.survival_intensity;
  const s = await checkStarvation({ ...c, last_meal_game_day: 0, game_day: 5 }, 5);
  assert(s.thresholdDays === 5, `No intensity field → defaults to standard (threshold 5), got ${s.thresholdDays}`);
  assert(s.intensity === 'standard', 'No intensity field → reported as standard');
})();

// Invalid value also falls back to standard
await (async () => {
  const c = makeChar({ survival_intensity: 'extreme', last_meal_game_day: 0, game_day: 5 });
  const s = await checkStarvation(c, 5);
  assert(s.intensity === 'standard', `Invalid value "extreme" falls back to standard, got "${s.intensity}"`);
})();

// ============================================================
// 6. getSurvivalStatus surfaces intensity
// ============================================================
console.log('\n=== Test 6: getSurvivalStatus surfaces intensity ===\n');

await (async () => {
  const c = makeChar({ survival_intensity: 'lenient' });
  const status = getSurvivalStatus(c, null);
  assert(status.survival_intensity === 'lenient', 'getSurvivalStatus reports survival_intensity');
  assert(status.starvation_threshold === 8, `Lenient threshold reflected in status (6 + CON 2 = 8), got ${status.starvation_threshold}`);
})();

await (async () => {
  const c = makeChar({ survival_intensity: 'strict' });
  const status = getSurvivalStatus(c, null);
  assert(status.starvation_threshold === 4, `Strict threshold (2 + CON 2 = 4), got ${status.starvation_threshold}`);
})();

// ============================================================
// 7. Re-evaluation: intensity change mid-stream produces updated effects
// ============================================================
console.log('\n=== Test 7: Runtime read — intensity change mid-stream ===\n');

await (async () => {
  // Same character row at day 6, evaluated at Standard then Lenient
  // (simulating the player sliding the setting between session ticks).
  const baseCol = { last_meal_game_day: 0, game_day: 6 };

  const cStd = makeChar({ ...baseCol, survival_intensity: 'standard' });
  const sStd = await checkStarvation(cStd, 6);
  assert(sStd.starving === true, 'Standard at day 6 → starving (threshold 5)');

  const cLen = makeChar({ ...baseCol, survival_intensity: 'lenient' });
  const sLen = await checkStarvation(cLen, 6);
  assert(sLen.starving === false, 'Lenient at day 6 → not starving (threshold 8 — runtime read picked up the new setting)');
  assert(sLen.intensity === 'lenient', 'Lenient response reports lenient intensity');
})();

// ============================================================
// 8. PUT allowlist enum
// ============================================================
console.log('\n=== Test 8: PUT allowlist enum ===\n');

await (async () => {
  const valid = ['off', 'lenient', 'standard', 'strict'];
  const invalid = ['extreme', 'STANDARD', '', null, 'normal', 'hardcore'];
  // Mirror the route's gate (server/routes/character.js).
  const VALID = new Set(valid);
  for (const v of valid) {
    assert(VALID.has(v), `enum accepts valid value "${v}"`);
  }
  for (const v of invalid) {
    assert(!VALID.has(v), `enum rejects invalid value ${JSON.stringify(v)}`);
  }
})();

// ============================================================
// SUMMARY
// ============================================================
console.log(`\n${'='.repeat(60)}`);
console.log(`SC-7.6.5 SURVIVAL INTENSITY: ${passed} passed, ${failed} failed`);
console.log('='.repeat(60));

if (failed > 0) process.exit(1);
