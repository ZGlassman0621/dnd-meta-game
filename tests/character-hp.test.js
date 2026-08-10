/**
 * Phase 3.1 / 3.2 — player HP is real, and the player can die.
 *
 * Before this, `characters.current_hp` was written only at session end from an
 * LLM-derived heuristic floored at 1, so the protagonist could not reach 0 HP
 * while companions had full death-save handling. These tests cover the
 * replacement: marker-driven HP, clamping, and 5e death saves.
 */

import { initDatabase, dbRun, dbGet } from '../server/database.js';
import {
  applyHpChange,
  rollDeathSave,
  getHpState,
} from '../server/services/characterHpService.js';
import { processResponseMarkers } from '../server/services/markerPipeline.js';
import { clearRollLog, getRollLog } from '../server/utils/rng.js';

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

let CAMPAIGN_ID = null;
let CHARACTER_ID = null;

async function seed(hp = 30, maxHp = 30) {
  const campaign = await dbRun(
    'INSERT INTO campaigns (name, setting, status) VALUES (?, ?, ?)',
    ['TEST_HP Campaign', 'Forgotten Realms', 'active']
  );
  CAMPAIGN_ID = Number(campaign.lastInsertRowid);

  const character = await dbRun(
    `INSERT INTO characters
       (name, class, race, level, current_hp, max_hp, current_location,
        experience_to_next_level, campaign_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ['TEST_HP Hero', 'Fighter', 'Human', 3, hp, maxHp, 'TEST_Keep', 900, CAMPAIGN_ID]
  );
  CHARACTER_ID = Number(character.lastInsertRowid);
}

async function setHp(hp, extra = {}) {
  await dbRun(
    `UPDATE characters
        SET current_hp = ?, is_unconscious = ?, is_dead = ?,
            death_save_successes = ?, death_save_failures = ?
      WHERE id = ?`,
    [hp, extra.unconscious ?? 0, extra.dead ?? 0, extra.successes ?? 0, extra.failures ?? 0, CHARACTER_ID]
  );
}

async function cleanup() {
  if (CAMPAIGN_ID === null) return;
  await dbRun('DELETE FROM characters WHERE campaign_id = ?', [CAMPAIGN_ID]);
  await dbRun('DELETE FROM campaigns WHERE id = ?', [CAMPAIGN_ID]);
}

async function run() {
  await initDatabase();
  await seed();

  // ============================================================
  console.log('\n=== Test 1: damage and healing apply ===\n');
  // ============================================================

  let r = await applyHpChange(CHARACTER_ID, -7, 'ogre club');
  assertEqual(r.currentHp, 23, 'damage subtracts from current_hp');
  assertEqual(r.previousHp, 30, 'previous HP reported');
  assertEqual(r.applied, true, 'change reports as applied');

  r = await applyHpChange(CHARACTER_ID, 4, 'potion');
  assertEqual(r.currentHp, 27, 'healing adds to current_hp');

  // ============================================================
  console.log('\n=== Test 2: clamping at both ends ===\n');
  // ============================================================

  r = await applyHpChange(CHARACTER_ID, 999, 'overheal');
  assertEqual(r.currentHp, 30, 'healing cannot exceed max_hp');

  r = await applyHpChange(CHARACTER_ID, -999, 'dragon');
  assertEqual(r.currentHp, 0, 'damage floors at 0 — NOT at 1');
  assertEqual(r.droppedToZero, true, 'drop to zero is reported');

  let state = await getHpState(CHARACTER_ID);
  assertEqual(state.is_unconscious, 1, 'reaching 0 HP sets unconscious');
  assertEqual(state.death_save_successes, 0, 'death saves reset on entering dying');

  // ============================================================
  console.log('\n=== Test 3: no-op inputs are rejected cleanly ===\n');
  // ============================================================

  assertEqual(await applyHpChange(CHARACTER_ID, 0), null, 'a zero delta is a no-op');
  assertEqual(await applyHpChange(CHARACTER_ID, NaN), null, 'NaN is a no-op');
  assertEqual(await applyHpChange(null, -5), null, 'missing characterId is a no-op');
  assertEqual(await applyHpChange(99999999, -5), null, 'unknown character is a no-op');

  // ============================================================
  console.log('\n=== Test 4: healing above 0 clears the dying state ===\n');
  // ============================================================

  await setHp(0, { unconscious: 1, successes: 2, failures: 1 });
  r = await applyHpChange(CHARACTER_ID, 5, 'cure wounds');
  assertEqual(r.currentHp, 5, 'healing from 0 restores HP');
  assertEqual(r.roseAboveZero, true, 'rise above zero is reported');
  state = await getHpState(CHARACTER_ID);
  assertEqual(state.is_unconscious, 0, 'consciousness restored');
  assertEqual(state.death_save_successes, 0, 'successes cleared');
  assertEqual(state.death_save_failures, 0, 'failures cleared');

  // ============================================================
  console.log('\n=== Test 5: death saves ===\n');
  // ============================================================

  // Not dying → no save.
  await setHp(10);
  assertEqual(await rollDeathSave(CHARACTER_ID), null, 'no death save while conscious');

  // Three failures kill. Roll until we observe a death, forcing the counter.
  await setHp(0, { unconscious: 1, failures: 2 });
  let sawDeath = false;
  for (let i = 0; i < 40 && !sawDeath; i++) {
    await setHp(0, { unconscious: 1, failures: 2 });
    const save = await rollDeathSave(CHARACTER_ID);
    if (save && save.died) {
      sawDeath = true;
      assertEqual(save.failures, 3, 'death occurs at three failures');
      const dead = await getHpState(CHARACTER_ID);
      assertEqual(dead.is_dead, 1, 'is_dead is persisted — the player CAN die');
    }
  }
  assert(sawDeath, 'a failing death save eventually kills at 2 prior failures');

  // Three successes stabilise.
  let sawStable = false;
  for (let i = 0; i < 40 && !sawStable; i++) {
    await setHp(0, { unconscious: 1, successes: 2 });
    const save = await rollDeathSave(CHARACTER_ID);
    if (save && save.stabilised) {
      sawStable = true;
      assertEqual(save.successes, 3, 'stabilisation occurs at three successes');
      assertEqual(save.currentHp, 0, 'stabilised but still at 0 HP');
    }
  }
  assert(sawStable, 'a succeeding death save eventually stabilises at 2 prior successes');

  // A dead character takes no further damage and cannot be healed by a marker.
  await setHp(0, { dead: 1 });
  r = await applyHpChange(CHARACTER_ID, 10, 'healing a corpse');
  assertEqual(r.applied, false, 'HP changes do not apply to a dead character');
  assertEqual(r.reason, 'character_is_dead', 'refusal reason is explicit');
  assertEqual(await rollDeathSave(CHARACTER_ID), null, 'no death saves once dead');

  // ============================================================
  console.log('\n=== Test 6: rolls go through the central RNG ===\n');
  // ============================================================

  clearRollLog();
  await setHp(0, { unconscious: 1 });
  await rollDeathSave(CHARACTER_ID);
  const log = getRollLog();
  assert(log.length === 1, 'the death save was recorded in the roll log');
  assertEqual(log[0].sides, 20, 'it was a d20');
  assert(/death save/.test(log[0].reason || ''), 'the roll log names the reason');

  // ============================================================
  console.log('\n=== Test 7: HP_CHANGE dispatches through the marker pipeline ===\n');
  // ============================================================

  await setHp(25);
  const dispatch = await processResponseMarkers(
    'The ogre\'s club connects. [HP_CHANGE: delta=-6 reason="ogre club"]',
    { characterId: CHARACTER_ID, sessionId: 1, narrative: '' }
  );

  const hpResults = dispatch.handlerResults.filter(hr => hr.schemaKey === 'HP_CHANGE');
  assert(hpResults.length === 1, 'the HP_CHANGE marker reached a handler on the player path');
  assert(hpResults[0].ok, 'the handler succeeded');
  assertEqual(hpResults[0].result.currentHp, 19, 'marker damage was applied to the database');

  state = await getHpState(CHARACTER_ID);
  assertEqual(state.current_hp, 19, 'the database reflects the marker damage');

  // ============================================================
  console.log('\n=== Cleanup ===\n');
  // ============================================================
  await cleanup();
  const gone = await dbGet('SELECT id FROM characters WHERE id = ?', [CHARACTER_ID]);
  assert(!gone, 'test character removed');

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
  if (failed > 0) process.exit(1);
}

await run();
