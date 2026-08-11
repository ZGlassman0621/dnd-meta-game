/**
 * Phase 1.2 — MVP scale-back feature flags.
 *
 * Asserts the two properties the scale-back depends on:
 *   1. Flags resolve from process.env at READ time, not module-load time.
 *      Every guard in the codebase relies on this — it is what lets the other
 *      suites opt back into the subsystems they exercise.
 *   2. The living-world tick, when gated off, returns the FULL result shape.
 *      routes/livingWorld.js reduces over faction_results.length,
 *      spawned_events.length and effects_expired, and the simulate endpoint
 *      loops on them, so returning null or {} would throw at the call site.
 */

import { FEATURE_FLAGS } from '../server/config/featureFlags.js';
import { initDatabase } from '../server/database.js';
import { processLivingWorldTick } from '../server/services/livingWorldService.js';
import { processFactionTick } from '../server/services/factionService.js';
import { processEventTick } from '../server/services/worldEventService.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${message}`);
  } else {
    failed++;
    console.log(`  ✗ ${message}`);
  }
}

function assertEqual(actual, expected, message) {
  assert(actual === expected, `${message} (got ${JSON.stringify(actual)})`);
}

async function run() {
  await initDatabase();

  // ============================================================
  console.log('\n=== Test 1: MVP defaults ===\n');
  // ============================================================

  delete process.env.FF_LIVING_WORLD_TICK;
  delete process.env.FF_NPC_AGING;
  delete process.env.FF_COMPANION_MOOD_DECAY;
  delete process.env.FF_SURVIVAL_DAY_CHANGE;
  delete process.env.FF_DEFERRED_RESOLUTION_ACTIONS;
  delete process.env.FF_NPC_DEATH_SYNC;
  delete process.env.FF_PROGRESSION_AWARDS;

  // The MVP is narrative-first — dialogue, exploration, persistent progression.
  // Simulation is deferred to Phase 2, so the tick is off again; it was on
  // through Phase 4, which is where its time-driven wiring was built.
  assertEqual(FEATURE_FLAGS.LIVING_WORLD_TICK, false, 'living world tick defaults OFF for the MVP');
  assertEqual(FEATURE_FLAGS.NPC_AGING, false, 'NPC aging defaults off');
  assertEqual(FEATURE_FLAGS.COMPANION_MOOD_DECAY, false, 'companion mood decay defaults off');
  assertEqual(FEATURE_FLAGS.SURVIVAL_DAY_CHANGE, false, 'survival day change defaults off');
  assertEqual(FEATURE_FLAGS.DEFERRED_RESOLUTION_ACTIONS, false, 'deferred-resolution actions default off');
  assertEqual(FEATURE_FLAGS.NPC_DEATH_SYNC, true, 'canon death reconciler stays ON — not simulation');

  // Persistent progression is an MVP pillar: with this off, quests and
  // achievements paid gold and items but never XP.
  assertEqual(FEATURE_FLAGS.PROGRESSION_AWARDS, true, 'progression awards default ON for the MVP');

  // The soft-lock pair. Deferred actions queue a resolution only the tick
  // delivers, so "deferred on, tick off" strands a companion sent away
  // permanently. Asserted as a pair so the two cannot drift apart silently.
  assert(
    !(FEATURE_FLAGS.DEFERRED_RESOLUTION_ACTIONS && !FEATURE_FLAGS.LIVING_WORLD_TICK),
    'deferred-resolution actions are never on while the tick is off'
  );

  // ============================================================
  console.log('\n=== Test 2: env override is read live ===\n');
  // ============================================================

  // Both directions matter, and which one is the "interesting" one depends on
  // the default — so assert both against a flag whose default is true.
  process.env.FF_PROGRESSION_AWARDS = 'false';
  assertEqual(FEATURE_FLAGS.PROGRESSION_AWARDS, false, 'literal "false" turns a default-on flag off, live');

  process.env.FF_PROGRESSION_AWARDS = 'true';
  assertEqual(FEATURE_FLAGS.PROGRESSION_AWARDS, true, 'flag flips back on without re-importing the module');

  delete process.env.FF_PROGRESSION_AWARDS;
  assertEqual(FEATURE_FLAGS.PROGRESSION_AWARDS, true, 'unsetting restores the MVP default');

  // NPC_AGING is still default-off, so it proves the opposite direction.
  process.env.FF_NPC_AGING = 'true';
  assertEqual(FEATURE_FLAGS.NPC_AGING, true, 'a default-off flag can be forced on');
  delete process.env.FF_NPC_AGING;
  assertEqual(FEATURE_FLAGS.NPC_AGING, false, 'unsetting restores the default off');

  process.env.FF_NPC_DEATH_SYNC = 'false';
  assertEqual(FEATURE_FLAGS.NPC_DEATH_SYNC, false, 'a default-on flag can be forced off');
  delete process.env.FF_NPC_DEATH_SYNC;
  assertEqual(FEATURE_FLAGS.NPC_DEATH_SYNC, true, 'unsetting restores the default');

  // ============================================================
  console.log('\n=== Test 3: gated tick returns the full result shape ===\n');
  // ============================================================

  process.env.FF_LIVING_WORLD_TICK = 'false';
  const result = await processLivingWorldTick(999999, 5);

  assert(result && typeof result === 'object', 'returns an object, never null');
  assert(Array.isArray(result.faction_results), 'faction_results is an array — callers read .length');
  assert(Array.isArray(result.event_results), 'event_results is an array');
  assert(Array.isArray(result.spawned_events), 'spawned_events is an array — callers read .length');
  assert(Array.isArray(result.errors), 'errors is an array');
  assertEqual(result.effects_expired, 0, 'effects_expired is numeric — callers sum it');
  assertEqual(result.faction_results.length, 0, 'no faction work was done');

  const skip = result.step_statuses.find((s) => s.step === 'ALL');
  assert(skip && skip.status === 'skipped', 'reports a visible "skipped" status rather than failing silently');

  // A campaign id that does not exist would normally make the tick throw on
  // empty results; the guard must short-circuit before that.
  assertEqual(result.errors.length, 0, 'gated tick reports no errors');

  // ============================================================
  console.log('\n=== Test 4: direct-call bypasses are also gated ===\n');
  // ============================================================

  // routes/faction.js and routes/worldEvent.js call these directly, skipping
  // the livingWorldService choke point entirely.
  const factionResults = await processFactionTick(999999, 5);
  assert(Array.isArray(factionResults) && factionResults.length === 0, 'processFactionTick short-circuits to []');

  const eventResults = await processEventTick(999999, 5);
  assert(Array.isArray(eventResults) && eventResults.length === 0, 'processEventTick short-circuits to []');

  // ============================================================
  console.log('\n=== Test 5: re-enabling actually runs the tick ===\n');
  // ============================================================

  process.env.FF_LIVING_WORLD_TICK = 'true';
  const enabled = await processLivingWorldTick(999999, 1);
  const stillSkipped = enabled.step_statuses.find((s) => s.step === 'ALL' && s.status === 'skipped');
  assert(!stillSkipped, 'with the flag on, the guard no longer short-circuits');
  process.env.FF_LIVING_WORLD_TICK = 'false';

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
  if (failed > 0) process.exit(1);
}

await run();
