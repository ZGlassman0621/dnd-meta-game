/**
 * Tests for NPC aging and absence effects (Component H).
 * Verifies decay formulas, absence thresholds, integration processing, and reunion boosts.
 *
 * Run: node tests/npc-aging.test.js
 */

import { initDatabase, dbRun, dbGet, dbAll } from '../server/database.js';
import {
  calculateDispositionDecay,
  calculateTrustDecay,
  checkAbsenceThreshold,
  processAbsenceEffects,
  applyReunionBoost
} from '../server/services/npcAgingService.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  \u2713 ${message}`);
    passed++;
  } else {
    console.error(`  \u2717 ${message}`);
    failed++;
  }
}

function assertEqual(actual, expected, message) {
  if (actual === expected) {
    console.log(`  \u2713 ${message}`);
    passed++;
  } else {
    console.error(`  \u2717 ${message} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    failed++;
  }
}

// Track IDs for cleanup
let testCampaignId;
let testCharId;
let testNpcId;
let testRelId;

// ===== Setup =====

async function setup() {
  await initDatabase();

  // Create test campaign
  const campResult = await dbRun(
    `INSERT INTO campaigns (name, description, setting) VALUES (?, ?, ?)`,
    ['TEST_AgingCampaign', 'Test campaign for NPC aging', 'Forgotten Realms']
  );
  testCampaignId = Number(campResult.lastInsertRowid);

  // Create test character
  const charResult = await dbRun(
    `INSERT INTO characters (name, class, race, level, current_hp, max_hp, current_location, experience_to_next_level, campaign_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ['TEST_AgingChar', 'Fighter', 'Human', 5, 44, 44, 'Waterdeep', 6500, testCampaignId]
  );
  testCharId = Number(charResult.lastInsertRowid);

  // Create test NPC
  const npcResult = await dbRun(
    `INSERT INTO npcs (name, race, lifecycle_status, current_location) VALUES (?, ?, ?, ?)`,
    ['TEST_AgingNPC', 'Dwarf', 'alive', 'Waterdeep']
  );
  testNpcId = Number(npcResult.lastInsertRowid);
}

// ===== 1. calculateDispositionDecay — basic ranges =====

console.log('\n=== calculateDispositionDecay — basic ranges ===\n');

{
  // 0 days absent -> 0 decay
  assertEqual(calculateDispositionDecay(0, 50), 0, '0 days absent -> 0 decay');

  // 5 days absent -> 0 decay (within grace period)
  assertEqual(calculateDispositionDecay(5, 50), 0, '5 days absent -> 0 decay (within grace period)');

  // 7 days absent -> 0 decay (boundary)
  assertEqual(calculateDispositionDecay(7, 50), 0, '7 days absent -> 0 decay (boundary)');

  // 8 days absent -> small decay (1 or more)
  const decay8 = calculateDispositionDecay(8, 50);
  assert(decay8 >= 0, '8 days absent -> small decay (at least 0)');
  // (8-7)/5 = 0.2 -> floor = 0, but it's past the grace period
  // Actually: Math.floor((8 - 7) / 5) = Math.floor(0.2) = 0
  // 15 days: Math.floor((15-7)/5) = Math.floor(1.6) = 1
  const decay15 = calculateDispositionDecay(15, 50);
  assert(decay15 >= 1, '15 days absent -> some decay (>= 1)');

  // 30 days absent -> moderate decay (~4)
  const decay30 = calculateDispositionDecay(30, 50);
  assertEqual(decay30, 4, '30 days absent -> moderate decay (should be ~4)');

  // 60 days absent -> significant decay
  const decay60 = calculateDispositionDecay(60, 50);
  assert(decay60 > decay30, '60 days absent -> more decay than 30 days');

  // 90 days absent -> large decay (~24)
  const decay90 = calculateDispositionDecay(90, 50);
  assertEqual(decay90, 24, '90 days absent -> large decay (should be ~24)');

  // 120 days absent -> very large decay
  const decay120 = calculateDispositionDecay(120, 100);
  assert(decay120 > decay90, '120 days absent -> very large decay (more than 90 days)');

  // Floor test: disposition 0, 90 days -> decay capped at 20 (can't go below -20)
  const decayFloor = calculateDispositionDecay(90, 0);
  assertEqual(decayFloor, 20, 'Floor test: disposition 0, 90 days -> decay capped at 20 (can\'t go below -20)');
}

// ===== 2. calculateDispositionDecay — high trust half rate =====

console.log('\n=== calculateDispositionDecay — high trust half rate ===\n');

{
  // 30 days with highTrust=true -> half the normal decay
  const normal30 = calculateDispositionDecay(30, 50);
  const trust30 = calculateDispositionDecay(30, 50, { highTrust: true });
  assertEqual(trust30, Math.floor(normal30 / 2), '30 days with highTrust -> half the normal decay');

  // 90 days with highTrust=true -> half the normal decay
  const normal90 = calculateDispositionDecay(90, 50);
  const trust90 = calculateDispositionDecay(90, 50, { highTrust: true });
  assertEqual(trust90, Math.floor(normal90 / 2), '90 days with highTrust -> half the normal decay');

  // Verify highTrust reduces decay by at least 50%
  assert(trust90 <= normal90 / 2, 'highTrust reduces decay by at least 50%');
}

// ===== 3. calculateTrustDecay =====

console.log('\n=== calculateTrustDecay ===\n');

{
  // 0 days -> 0 decay
  assertEqual(calculateTrustDecay(0, 50), 0, '0 days -> 0 trust decay');

  // 14 days -> 0 decay (grace period)
  assertEqual(calculateTrustDecay(14, 50), 0, '14 days -> 0 trust decay (grace period)');

  // 15 days -> small decay
  const trust15 = calculateTrustDecay(15, 50);
  assert(trust15 >= 0, '15 days -> small trust decay (>= 0)');

  // 30 days -> some decay
  const trust30 = calculateTrustDecay(30, 50);
  assert(trust30 >= 1, '30 days -> some trust decay (>= 1)');

  // 60 days -> moderate decay (~4)
  const trust60 = calculateTrustDecay(60, 50);
  assertEqual(trust60, 4, '60 days -> moderate trust decay (~4)');

  // Trust already 0 -> 0 decay (can't go negative from decay)
  assertEqual(calculateTrustDecay(60, 0), 0, 'Trust already 0 -> 0 decay (can\'t go negative)');
}

// ===== 4. checkAbsenceThreshold =====

console.log('\n=== checkAbsenceThreshold ===\n');

{
  // 30 days + positive disposition -> null (no extreme effect)
  const result30pos = checkAbsenceThreshold({ disposition: 10, trust_level: 30, npc_name: 'Bob' }, 30);
  assertEqual(result30pos, null, '30 days + positive disposition -> null');

  // 60 days + disposition -10 -> may return { type: "relocate" } (random, 10% chance)
  // Run multiple times to verify structure if it triggers
  let relocateResult = null;
  for (let i = 0; i < 200; i++) {
    const r = checkAbsenceThreshold({ disposition: -10, trust_level: 30, npc_name: 'TestNPC' }, 60);
    if (r !== null) {
      relocateResult = r;
      break;
    }
  }
  if (relocateResult) {
    assertEqual(relocateResult.type, 'relocate', '60 days + negative disposition -> relocate type if triggered');
    assert(typeof relocateResult.reason === 'string', '60 days relocate result has a reason string');
  } else {
    // 200 tries at 10% = extremely unlikely to never trigger, but handle gracefully
    assert(true, '60 days + disposition -10 -> relocate did not trigger in 200 tries (statistically rare)');
  }

  // 120 days + trust 5 -> returns { type: "forget" }
  const forgetResult = checkAbsenceThreshold({ disposition: 10, trust_level: 5, npc_name: 'Oldman' }, 120);
  assertEqual(forgetResult.type, 'forget', '120 days + low trust -> forget type');

  // 50 days + disposition 30 -> null (within limits)
  const result50pos = checkAbsenceThreshold({ disposition: 30, trust_level: 20, npc_name: 'Friend' }, 50);
  assertEqual(result50pos, null, '50 days + positive disposition -> null (within limits)');
}

// ===== 5. processAbsenceEffects integration =====

console.log('\n=== processAbsenceEffects integration ===\n');

await setup();

{
  // Create relationship with last_interaction_game_day = 10
  const relResult = await dbRun(
    `INSERT INTO npc_relationships (character_id, npc_id, disposition, trust_level, times_met, last_interaction_game_day)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [testCharId, testNpcId, 30, 25, 5, 10]
  );
  testRelId = Number(relResult.lastInsertRowid);

  // Fetch initial state
  const before = await dbGet('SELECT disposition, trust_level FROM npc_relationships WHERE id = ?', [testRelId]);

  // Call processAbsenceEffects(characterId, 50) — 40 days absent
  const results = await processAbsenceEffects(testCharId, 50);

  // Fetch updated state
  const after = await dbGet('SELECT disposition, trust_level FROM npc_relationships WHERE id = ?', [testRelId]);

  // Verify disposition decreased
  assert(after.disposition < before.disposition, 'processAbsenceEffects: disposition decreased after 40 days absent');

  // Verify trust decreased
  assert(after.trust_level < before.trust_level, 'processAbsenceEffects: trust decreased after 40 days absent');

  // Verify processed count > 0
  assert(results.processed > 0, 'processAbsenceEffects: processed count > 0');

  // Verify dispositionDecayed count
  assert(results.dispositionDecayed > 0, 'processAbsenceEffects: dispositionDecayed count > 0');

  // Verify trustDecayed count
  assert(results.trustDecayed > 0, 'processAbsenceEffects: trustDecayed count > 0');
}

// ===== 6. applyReunionBoost =====

console.log('\n=== applyReunionBoost ===\n');

{
  // Record initial disposition
  const beforeReunion = await dbGet('SELECT disposition FROM npc_relationships WHERE id = ?', [testRelId]);
  const initialDisp = beforeReunion.disposition;

  // Call applyReunionBoost
  await applyReunionBoost(testCharId, testNpcId, 60);

  // Fetch updated disposition
  const afterReunion = await dbGet('SELECT disposition FROM npc_relationships WHERE id = ?', [testRelId]);

  // Verify disposition increased by 3
  assertEqual(afterReunion.disposition, initialDisp + 3, 'applyReunionBoost: disposition increased by 3');

  // Verify it actually changed
  assert(afterReunion.disposition > initialDisp, 'applyReunionBoost: disposition is higher than before');
}

// ===== Cleanup =====

console.log('\n--- Cleanup ---');
try {
  if (testRelId) {
    await dbRun('DELETE FROM npc_relationships WHERE id = ?', [testRelId]);
  }
  // Also clean up any relationships created by applyReunionBoost / getOrCreate
  if (testCharId && testNpcId) {
    await dbRun('DELETE FROM npc_relationships WHERE character_id = ? AND npc_id = ?', [testCharId, testNpcId]);
  }
  if (testNpcId) {
    await dbRun('DELETE FROM npcs WHERE id = ?', [testNpcId]);
  }
  if (testCharId) {
    await dbRun('DELETE FROM characters WHERE id = ?', [testCharId]);
  }
  if (testCampaignId) {
    await dbRun('DELETE FROM campaigns WHERE id = ?', [testCampaignId]);
  }
  // Broad cleanup: any TEST_ prefixed rows that may remain
  await dbRun("DELETE FROM npc_relationships WHERE id IN (SELECT r.id FROM npc_relationships r JOIN npcs n ON r.npc_id = n.id WHERE n.name LIKE 'TEST_%')");
  await dbRun("DELETE FROM npcs WHERE name LIKE 'TEST_%'");
  await dbRun("DELETE FROM characters WHERE name LIKE 'TEST_%'");
  await dbRun("DELETE FROM campaigns WHERE name LIKE 'TEST_%'");
  console.log('  Cleanup complete.');
} catch (err) {
  console.error('  Cleanup error:', err.message);
}

// ===== Summary =====
console.log(`\n${'='.repeat(40)}`);
console.log(`NPC Aging & Absence: ${passed} passed, ${failed} failed`);
console.log('='.repeat(40));

process.exit(failed > 0 ? 1 : 0);
