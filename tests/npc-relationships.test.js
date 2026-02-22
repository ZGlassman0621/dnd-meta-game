/**
 * Tests for NPC relationship service functions.
 * Run: node tests/npc-relationships.test.js
 *
 * Tests getOrCreateRelationship, adjustDisposition, adjustTrust,
 * recordInteraction, getNpcsByLocation, and disposition label ranges.
 * All test data prefixed with TEST_ and cleaned up at the end.
 */

import { initDatabase, dbRun, dbGet, dbAll } from '../server/database.js';
import {
  getOrCreateRelationship, createRelationship, getRelationship,
  adjustDisposition, adjustTrust, recordInteraction,
  getCharacterRelationships, getDispositionLabel, getNpcsByLocation
} from '../server/services/npcRelationshipService.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passed++;
  } else {
    console.error(`  ✗ ${message}`);
    failed++;
  }
}

function assertEqual(actual, expected, message) {
  if (actual === expected) {
    console.log(`  ✓ ${message}`);
    passed++;
  } else {
    console.error(`  ✗ ${message} — expected ${expected}, got ${actual}`);
    failed++;
  }
}

// Track IDs for cleanup
let testCampaignId;
let testCharId;
let testNpcId;
let testNpcId2;
let testNpcId3;
let testNpcId4; // deceased NPC

// ===== Setup helpers =====

async function createTestCampaign() {
  const result = await dbRun(
    `INSERT INTO campaigns (name, description, setting, tone, starting_location)
     VALUES (?, ?, ?, ?, ?)`,
    ['TEST_RelCampaign', 'Test campaign for relationship tests', 'Forgotten Realms', 'heroic fantasy', 'Waterdeep']
  );
  testCampaignId = Number(result.lastInsertRowid);
}

async function createTestCharacter() {
  const result = await dbRun(
    `INSERT INTO characters (name, class, race, level, current_hp, max_hp, current_location, experience_to_next_level, campaign_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ['TEST_RelChar', 'Fighter', 'Human', 5, 40, 40, 'Waterdeep', 6500, testCampaignId]
  );
  testCharId = Number(result.lastInsertRowid);
}

async function createTestNpcs() {
  // NPC 1 — at Waterdeep Market
  let result = await dbRun(
    `INSERT INTO npcs (name, race, occupation, current_location, lifecycle_status)
     VALUES (?, ?, ?, ?, ?)`,
    ['TEST_RelNpc_Gareth', 'Human', 'Blacksmith', 'Waterdeep Market', 'alive']
  );
  testNpcId = Number(result.lastInsertRowid);

  // NPC 2 — also at Waterdeep Market
  result = await dbRun(
    `INSERT INTO npcs (name, race, occupation, current_location, lifecycle_status)
     VALUES (?, ?, ?, ?, ?)`,
    ['TEST_RelNpc_Elara', 'Elf', 'Herbalist', 'Waterdeep Market', 'alive']
  );
  testNpcId2 = Number(result.lastInsertRowid);

  // NPC 3 — at Baldur's Gate
  result = await dbRun(
    `INSERT INTO npcs (name, race, occupation, current_location, lifecycle_status)
     VALUES (?, ?, ?, ?, ?)`,
    ['TEST_RelNpc_Dorn', 'Dwarf', 'Merchant', "Baldur's Gate", 'alive']
  );
  testNpcId3 = Number(result.lastInsertRowid);

  // NPC 4 — deceased, at Waterdeep Market (should be excluded from location queries)
  result = await dbRun(
    `INSERT INTO npcs (name, race, occupation, current_location, lifecycle_status)
     VALUES (?, ?, ?, ?, ?)`,
    ['TEST_RelNpc_Dead', 'Human', 'Guard', 'Waterdeep Market', 'deceased']
  );
  testNpcId4 = Number(result.lastInsertRowid);
}

async function cleanup() {
  console.log('\n--- Cleanup ---');
  try {
    // Delete in dependency order: relationships -> characters -> npcs -> campaigns
    if (testCharId) {
      await dbRun('DELETE FROM npc_relationships WHERE character_id = ?', [testCharId]);
    }
    if (testCharId) {
      await dbRun('DELETE FROM characters WHERE id = ?', [testCharId]);
    }
    for (const npcId of [testNpcId, testNpcId2, testNpcId3, testNpcId4]) {
      if (npcId) await dbRun('DELETE FROM npcs WHERE id = ?', [npcId]);
    }
    if (testCampaignId) {
      await dbRun('DELETE FROM campaigns WHERE id = ?', [testCampaignId]);
    }
    console.log('  Cleanup complete.');
  } catch (err) {
    console.error('  Cleanup error:', err.message);
  }
}

// ===== Tests =====

async function testGetOrCreateRelationship() {
  console.log('\n=== Test 1: getOrCreateRelationship ===\n');

  // First call creates a new relationship
  const rel1 = await getOrCreateRelationship(testCharId, testNpcId);
  assert(rel1 !== null && rel1.id > 0, 'First call creates a new relationship with valid id');
  assertEqual(rel1.disposition, 0, 'Default disposition is 0');
  assertEqual(rel1.trust_level, 0, 'Default trust_level is 0');
  assertEqual(rel1.times_met, 1, 'Default times_met is 1');

  // Second call returns the same relationship (no duplicate)
  const rel2 = await getOrCreateRelationship(testCharId, testNpcId);
  assertEqual(rel2.id, rel1.id, 'Second call returns same relationship (no duplicate)');
}

async function testAdjustDisposition() {
  console.log('\n=== Test 2: adjustDisposition ===\n');

  // Adjust +30
  let rel = await adjustDisposition(testCharId, testNpcId, 30, 'Saved the blacksmith from thieves');
  assertEqual(rel.disposition, 30, 'Adjust +30 sets disposition to 30');

  // Adjust -10
  rel = await adjustDisposition(testCharId, testNpcId, -10, 'Accidentally broke a display');
  assertEqual(rel.disposition, 20, 'Adjust -10 from 30 sets disposition to 20');

  // Adjust +200 — should clamp to 100
  rel = await adjustDisposition(testCharId, testNpcId, 200, 'Heroic deed');
  assertEqual(rel.disposition, 100, 'Adjust +200 clamps disposition to 100');

  // Adjust -300 — should clamp to -100
  rel = await adjustDisposition(testCharId, testNpcId, -300, 'Terrible betrayal');
  assertEqual(rel.disposition, -100, 'Adjust -300 clamps disposition to -100');

  // Check witnessed_deeds includes reason
  assert(
    Array.isArray(rel.witnessed_deeds) && rel.witnessed_deeds.some(d => d.deed === 'Terrible betrayal'),
    'witnessed_deeds includes the reason string'
  );

  // Reset to 50 and check label
  rel = await adjustDisposition(testCharId, testNpcId, 150, 'Great friendship');
  // disposition was -100, +150 = 50
  assertEqual(rel.disposition_label, 'allied', 'Disposition 50 has label "allied"');
}

async function testAdjustTrust() {
  console.log('\n=== Test 3: adjustTrust ===\n');

  // Start fresh — use NPC 2 for clean trust tests
  let rel = await adjustTrust(testCharId, testNpcId2, 40);
  assertEqual(rel.trust_level, 40, 'Adjust +40 sets trust to 40');

  // Adjust -80 from 40 => -40
  rel = await adjustTrust(testCharId, testNpcId2, -80);
  assertEqual(rel.trust_level, -40, 'Adjust -80 from 40 sets trust to -40');

  // Verify trust is separate from disposition
  assertEqual(rel.disposition, 0, 'Trust adjustment does not affect disposition');

  // Clamp test: -200 from -40 should clamp to -100
  rel = await adjustTrust(testCharId, testNpcId2, -200);
  assertEqual(rel.trust_level, -100, 'Trust clamps to -100');
}

async function testRecordInteraction() {
  console.log('\n=== Test 4: recordInteraction ===\n');

  // NPC 2 already has a relationship from trust tests (times_met = 1)
  const before = await getRelationship(testCharId, testNpcId2);
  const initialTimesMet = before.times_met;

  // Record interaction with gameDay=50
  let rel = await recordInteraction(testCharId, testNpcId2, null, 50);
  assertEqual(rel.times_met, initialTimesMet + 1, 'times_met incremented by 1');
  assertEqual(rel.last_interaction_game_day, 50, 'last_interaction_game_day set to 50');

  // Record again with gameDay=80
  rel = await recordInteraction(testCharId, testNpcId2, null, 80);
  assertEqual(rel.times_met, initialTimesMet + 2, 'times_met incremented again');
  assertEqual(rel.last_interaction_game_day, 80, 'last_interaction_game_day updated to 80');

  // Verify last_interaction_date was also set
  assert(rel.last_interaction_date !== null, 'last_interaction_date is set');
}

async function testGetNpcsByLocation() {
  console.log('\n=== Test 5: getNpcsByLocation ===\n');

  // Create relationships for NPC 3 (Baldur's Gate) and NPC 4 (deceased, Waterdeep Market)
  await getOrCreateRelationship(testCharId, testNpcId3);
  await getOrCreateRelationship(testCharId, testNpcId4);

  // Query for "Waterdeep" — should find NPC 1 and NPC 2 (alive), NOT NPC 4 (deceased)
  const waterdeepNpcs = await getNpcsByLocation(testCampaignId, 'Waterdeep');
  const waterdeepTestNpcs = waterdeepNpcs.filter(n => n.name && n.name.startsWith('TEST_'));
  assertEqual(waterdeepTestNpcs.length, 2, 'Query for "Waterdeep" returns 2 alive NPCs');

  // Verify deceased NPC is excluded
  const hasDeceased = waterdeepNpcs.some(n => n.name === 'TEST_RelNpc_Dead');
  assert(!hasDeceased, 'Deceased NPC excluded from location query');

  // Query for "Baldur" — should find NPC 3
  const baldurNpcs = await getNpcsByLocation(testCampaignId, 'Baldur');
  const baldurTestNpcs = baldurNpcs.filter(n => n.name && n.name.startsWith('TEST_'));
  assertEqual(baldurTestNpcs.length, 1, 'Query for "Baldur" returns 1 NPC');
}

async function testDispositionLabelRanges() {
  console.log('\n=== Test 6: Disposition label ranges ===\n');

  // Use NPC 3 which has disposition 0 from getOrCreateRelationship
  // Adjust to exactly 50 => "allied"
  let rel = await adjustDisposition(testCharId, testNpcId3, 50, 'Generous trade deal');
  assertEqual(rel.disposition_label, 'allied', 'Disposition 50 maps to "allied"');

  // Adjust to exactly -50 => first go to -100, that's "nemesis"; go to -50 => "hostile"
  // Current is 50, need -100 to get to -50
  rel = await adjustDisposition(testCharId, testNpcId3, -100, 'Terrible offense');
  assertEqual(rel.disposition_label, 'hostile', 'Disposition -50 maps to "hostile"');
}

async function testGetDispositionLabelDirect() {
  console.log('\n=== Test 7: getDispositionLabel helper ===\n');

  assertEqual(getDispositionLabel(100), 'devoted', 'Disposition 100 = devoted');
  assertEqual(getDispositionLabel(75), 'devoted', 'Disposition 75 = devoted');
  assertEqual(getDispositionLabel(74), 'allied', 'Disposition 74 = allied');
  assertEqual(getDispositionLabel(50), 'allied', 'Disposition 50 = allied');
  assertEqual(getDispositionLabel(25), 'friendly', 'Disposition 25 = friendly');
  assertEqual(getDispositionLabel(0), 'neutral', 'Disposition 0 = neutral');
  assertEqual(getDispositionLabel(-24), 'neutral', 'Disposition -24 = neutral');
  assertEqual(getDispositionLabel(-25), 'unfriendly', 'Disposition -25 = unfriendly');
  assertEqual(getDispositionLabel(-49), 'unfriendly', 'Disposition -49 = unfriendly');
  assertEqual(getDispositionLabel(-50), 'hostile', 'Disposition -50 = hostile');
  assertEqual(getDispositionLabel(-74), 'hostile', 'Disposition -74 = hostile');
  assertEqual(getDispositionLabel(-75), 'nemesis', 'Disposition -75 = nemesis');
  assertEqual(getDispositionLabel(-100), 'nemesis', 'Disposition -100 = nemesis');
}

// ===== Run =====

async function run() {
  try {
    await initDatabase();

    // Setup
    await createTestCampaign();
    await createTestCharacter();
    await createTestNpcs();

    // Test groups
    await testGetOrCreateRelationship();
    await testAdjustDisposition();
    await testAdjustTrust();
    await testRecordInteraction();
    await testGetNpcsByLocation();
    await testDispositionLabelRanges();
    await testGetDispositionLabelDirect();
  } catch (err) {
    console.error('\nFATAL TEST ERROR:', err);
    failed++;
  } finally {
    await cleanup();
    console.log(`\n${'='.repeat(50)}`);
    console.log(`Results: ${passed} passed, ${failed} failed`);
    console.log('='.repeat(50));
    process.exit(failed > 0 ? 1 : 0);
  }
}

run();
