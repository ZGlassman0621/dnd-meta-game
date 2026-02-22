/**
 * Tests for NPC lifecycle state machine and personality enrichment (Components A + B).
 * Run: node tests/npc-lifecycle.test.js
 *
 * Covers:
 * - Valid lifecycle transitions (alive, missing, imprisoned, deceased)
 * - Invalid lifecycle transitions (deceased is final)
 * - Transition history audit trail
 * - NPC enrichment fields (voice, personality, mannerism, etc.)
 * - Death propagation cascade (companion, canon_fact, narrative_queue)
 *
 * Uses the same local.db database; all test data prefixed with TEST_ and cleaned up.
 */

import { initDatabase, dbRun, dbGet, dbAll } from '../server/database.js';
import {
  transitionNpcStatus,
  getNpcLifecycleHistory,
  propagateNpcDeath
} from '../server/services/npcLifecycleService.js';

let passed = 0;
let failed = 0;

// Test data IDs for cleanup
let testCampaignId;
let testCharId;
let testNpcIds = [];
let testCompanionIds = [];

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
    console.error(`  \u2717 ${message} \u2014 expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    failed++;
  }
}

// ===== Setup =====

async function setup() {
  console.log('--- Setup ---');
  await initDatabase();

  // Create a test campaign
  await dbRun(`
    INSERT INTO campaigns (name, description, setting, status)
    VALUES ('TEST_NPC_Lifecycle_Campaign', 'Test campaign for NPC lifecycle', 'Forgotten Realms', 'active')
  `);
  const campaign = await dbGet("SELECT id FROM campaigns WHERE name = 'TEST_NPC_Lifecycle_Campaign'");
  testCampaignId = campaign.id;

  // Create a test character
  await dbRun(`
    INSERT INTO characters (name, class, race, level, current_hp, max_hp, current_location, experience_to_next_level, campaign_id)
    VALUES ('TEST_NPC_Lifecycle_Hero', 'Fighter', 'Human', 5, 40, 40, 'Waterdeep', 6500, ?)
  `, [testCampaignId]);
  const character = await dbGet("SELECT id FROM characters WHERE name = 'TEST_NPC_Lifecycle_Hero'");
  testCharId = character.id;

  console.log(`  Campaign ID: ${testCampaignId}, Character ID: ${testCharId}\n`);
}

// Helper to create a test NPC and track its ID
async function createTestNpc(name, extra = {}) {
  const voice = extra.voice || null;
  const personality1 = extra.personality_trait_1 || null;
  const mannerism = extra.mannerism || null;
  const motivation = extra.motivation || null;
  const enrichmentLevel = extra.enrichment_level ?? 0;

  await dbRun(`
    INSERT INTO npcs (name, race, occupation, voice, personality_trait_1, mannerism, motivation, enrichment_level)
    VALUES (?, 'Human', 'Guard', ?, ?, ?, ?, ?)
  `, [name, voice, personality1, mannerism, motivation, enrichmentLevel]);

  const npc = await dbGet('SELECT id FROM npcs WHERE name = ?', [name]);
  testNpcIds.push(npc.id);
  return npc.id;
}

// ============================================================
// TEST GROUP 1: Valid Lifecycle Transitions (~8 assertions)
// ============================================================

async function testValidTransitions() {
  console.log('=== Test 1: Valid Lifecycle Transitions ===\n');

  const npcId = await createTestNpc('TEST_NPC_Transition_Valid');

  // Verify default lifecycle_status is 'alive'
  const npc = await dbGet('SELECT lifecycle_status FROM npcs WHERE id = ?', [npcId]);
  assertEqual(npc.lifecycle_status, 'alive', 'Default lifecycle_status is alive');

  // alive -> missing
  const r1 = await transitionNpcStatus(npcId, 'missing', { cause: 'Vanished during patrol', campaignId: testCampaignId });
  assert(r1.success === true, 'alive -> missing: transition succeeds');
  const after1 = await dbGet('SELECT lifecycle_status FROM npcs WHERE id = ?', [npcId]);
  assertEqual(after1.lifecycle_status, 'missing', 'alive -> missing: status is now missing');

  // missing -> alive (recovery)
  const r2 = await transitionNpcStatus(npcId, 'alive', { cause: 'Found in the woods', campaignId: testCampaignId });
  assert(r2.success === true, 'missing -> alive: recovery succeeds');

  // alive -> imprisoned
  const r3 = await transitionNpcStatus(npcId, 'imprisoned', { cause: 'Captured by bandits', campaignId: testCampaignId });
  assert(r3.success === true, 'alive -> imprisoned: transition succeeds');

  // imprisoned -> alive (rescue)
  const r4 = await transitionNpcStatus(npcId, 'alive', { cause: 'Rescued by adventurers', campaignId: testCampaignId });
  assert(r4.success === true, 'imprisoned -> alive: rescue succeeds');

  // alive -> deceased
  const r5 = await transitionNpcStatus(npcId, 'deceased', {
    cause: 'Killed in battle',
    gameDay: 15,
    location: 'Trollclaw Ford',
    killer: 'Orc Warchief',
    campaignId: testCampaignId
  });
  assert(r5.success === true, 'alive -> deceased: transition succeeds');

  const afterDeath = await dbGet('SELECT lifecycle_status, death_cause, death_game_day, death_location, death_killer FROM npcs WHERE id = ?', [npcId]);
  assertEqual(afterDeath.lifecycle_status, 'deceased', 'alive -> deceased: status is now deceased');
}

// ============================================================
// TEST GROUP 2: Invalid Lifecycle Transitions (~4 assertions)
// ============================================================

async function testInvalidTransitions() {
  console.log('\n=== Test 2: Invalid Lifecycle Transitions ===\n');

  // Create an NPC and kill them
  const npcId = await createTestNpc('TEST_NPC_Transition_Invalid');
  await transitionNpcStatus(npcId, 'deceased', { cause: 'Fell off a cliff', campaignId: testCampaignId });

  // deceased -> alive: should fail (death is final)
  const r1 = await transitionNpcStatus(npcId, 'alive', { cause: 'Resurrection attempt' });
  assert(r1.success === false, 'deceased -> alive: correctly fails (death is final)');
  assert(r1.reason && r1.reason.includes('Cannot transition'), 'deceased -> alive: returns reason message');

  // Create another NPC: unknown -> deceased -> alive should fail on the second step
  const npcId2 = await createTestNpc('TEST_NPC_Transition_Invalid2');
  await transitionNpcStatus(npcId2, 'unknown', { cause: 'Disappeared', campaignId: testCampaignId });
  await transitionNpcStatus(npcId2, 'deceased', { cause: 'Found dead', campaignId: testCampaignId });
  const r2 = await transitionNpcStatus(npcId2, 'alive', { cause: 'Miracle' });
  assert(r2.success === false, 'unknown -> deceased -> alive: second revival correctly fails');

  // Verify that transition history was still recorded for valid transitions
  const history = await getNpcLifecycleHistory(npcId2);
  assert(history.length >= 2, 'Transition history records created for valid transitions on NPC');
}

// ============================================================
// TEST GROUP 3: Transition History Audit Trail (~6 assertions)
// ============================================================

async function testTransitionHistory() {
  console.log('\n=== Test 3: Transition History Audit Trail ===\n');

  const npcId = await createTestNpc('TEST_NPC_History_Audit');

  // Perform several transitions
  await transitionNpcStatus(npcId, 'missing', { cause: 'Went on a journey', campaignId: testCampaignId, gameDay: 1 });
  await transitionNpcStatus(npcId, 'alive', { cause: 'Returned home', campaignId: testCampaignId, gameDay: 5 });
  await transitionNpcStatus(npcId, 'imprisoned', { cause: 'Arrested for smuggling', campaignId: testCampaignId, gameDay: 10 });
  await transitionNpcStatus(npcId, 'alive', { cause: 'Bailed out', campaignId: testCampaignId, gameDay: 12 });

  const history = await getNpcLifecycleHistory(npcId);

  // Should have 4 entries
  assertEqual(history.length, 4, 'History has 4 entries after 4 transitions');

  // Pick any entry to verify required fields are present
  const sample = history[0];
  assert(sample.old_status !== undefined && sample.old_status !== null, 'History entry has old_status (from_status)');
  assert(sample.new_status !== undefined && sample.new_status !== null, 'History entry has new_status (to_status)');
  assert(sample.created_at !== undefined && sample.created_at !== null, 'History entry has created_at (transitioned_at)');
  assert(sample.cause !== undefined && sample.cause !== null, 'History entry has cause');

  // Verify all expected transition pairs exist in history (order-independent)
  const pairs = history.map(h => `${h.old_status}->${h.new_status}`);
  assert(pairs.includes('alive->missing'), 'History contains alive -> missing transition');
  assert(pairs.includes('missing->alive'), 'History contains missing -> alive transition');
}

// ============================================================
// TEST GROUP 4: NPC Enrichment Fields (~8 assertions)
// ============================================================

async function testEnrichmentFields() {
  console.log('\n=== Test 4: NPC Enrichment Fields ===\n');

  // Create NPC with enrichment fields
  const npcId = await createTestNpc('TEST_NPC_Enriched', {
    voice: 'Deep baritone with a slight rasp',
    personality_trait_1: 'Fiercely loyal to friends',
    mannerism: 'Cracks knuckles when nervous',
    motivation: 'Seeks redemption for past crimes',
    enrichment_level: 2
  });

  const npc = await dbGet(`
    SELECT name, voice, personality_trait_1, mannerism, motivation, enrichment_level
    FROM npcs WHERE id = ?
  `, [npcId]);

  assertEqual(npc.name, 'TEST_NPC_Enriched', 'Enriched NPC name stored correctly');
  assertEqual(npc.voice, 'Deep baritone with a slight rasp', 'Voice field stored correctly');
  assertEqual(npc.personality_trait_1, 'Fiercely loyal to friends', 'Personality trait 1 stored correctly');
  assertEqual(npc.mannerism, 'Cracks knuckles when nervous', 'Mannerism stored correctly');
  assertEqual(npc.motivation, 'Seeks redemption for past crimes', 'Motivation stored correctly');
  assertEqual(npc.enrichment_level, 2, 'Enrichment level stored correctly');

  // Create NPC with no enrichment — verify defaults
  const npcId2 = await createTestNpc('TEST_NPC_Unenriched');
  const npc2 = await dbGet(`
    SELECT voice, personality_trait_1, mannerism, motivation, enrichment_level
    FROM npcs WHERE id = ?
  `, [npcId2]);

  assertEqual(npc2.enrichment_level, 0, 'Default enrichment_level is 0 for new NPC');
  assertEqual(npc2.voice, null, 'Voice is null when not provided');
}

// ============================================================
// TEST GROUP 5: Death Propagation Effects (~4 assertions)
// ============================================================

async function testDeathPropagation() {
  console.log('\n=== Test 5: Death Propagation Effects ===\n');

  // Create NPC
  const npcId = await createTestNpc('TEST_NPC_Death_Propagation');

  // Create an active companion linked to this NPC
  await dbRun(`
    INSERT INTO companions (npc_id, recruited_by_character_id, status, companion_class, companion_level)
    VALUES (?, ?, 'active', 'Fighter', 3)
  `, [npcId, testCharId]);
  const companion = await dbGet('SELECT id FROM companions WHERE npc_id = ? AND status = ?', [npcId, 'active']);
  testCompanionIds.push(companion.id);

  // Create a pending narrative_queue item for this NPC
  await dbRun(`
    INSERT INTO narrative_queue (campaign_id, character_id, event_type, priority, title, description, related_npc_id, status)
    VALUES (?, ?, 'npc_relationship_shift', 'normal', 'TEST_NPC rumor', 'A rumor about TEST_NPC_Death_Propagation', ?, 'pending')
  `, [testCampaignId, testCharId, npcId]);

  // Use propagateNpcDeath
  const result = await propagateNpcDeath(npcId, testCampaignId, testCharId, {
    cause: 'Slain by dragon fire',
    gameDay: 20,
    location: 'Dragon Peak',
    killer: 'Red Dragon'
  });

  assert(result.success === true, 'propagateNpcDeath succeeds');

  // Verify companion status changed to deceased
  const companionAfter = await dbGet('SELECT status FROM companions WHERE id = ?', [companion.id]);
  assertEqual(companionAfter.status, 'deceased', 'Companion status changed to deceased after NPC death');

  // Verify canon_fact was created for the death
  const deathFact = await dbGet(`
    SELECT * FROM canon_facts
    WHERE campaign_id = ? AND category = 'npc_death' AND subject = 'TEST_NPC_Death_Propagation'
  `, [testCampaignId]);
  assert(deathFact !== null && deathFact !== undefined, 'Canon fact created recording the NPC death');

  // Verify narrative_queue item was expired
  const queueItem = await dbGet(`
    SELECT status FROM narrative_queue
    WHERE related_npc_id = ? AND title = 'TEST_NPC rumor'
  `, [npcId]);
  assertEqual(queueItem.status, 'expired', 'Pending narrative_queue item expired after NPC death');
}

// ============================================================
// Cleanup
// ============================================================

async function cleanup() {
  console.log('\n--- Cleanup ---');
  try {
    // Clean up in dependency order (children before parents)
    for (const companionId of testCompanionIds) {
      await dbRun('DELETE FROM companion_backstories WHERE companion_id = ?', [companionId]);
    }

    // Clean NPC-related tables by TEST_ prefix on NPC names
    const testNpcs = await dbAll("SELECT id FROM npcs WHERE name LIKE 'TEST_%'");
    const testNpcIdList = testNpcs.map(n => n.id);

    if (testNpcIdList.length > 0) {
      for (const id of testNpcIdList) {
        await dbRun('DELETE FROM npc_lifecycle_history WHERE npc_id = ?', [id]);
        await dbRun('DELETE FROM npc_relationships WHERE npc_id = ?', [id]);
        await dbRun('DELETE FROM narrative_queue WHERE related_npc_id = ?', [id]);
        await dbRun('DELETE FROM companions WHERE npc_id = ?', [id]);
      }
      for (const id of testNpcIdList) {
        await dbRun('DELETE FROM npcs WHERE id = ?', [id]);
      }
    }

    // Clean canon_facts by TEST_ subject prefix
    await dbRun("DELETE FROM canon_facts WHERE subject LIKE 'TEST_%'");

    // Clean narrative_queue by TEST_ title prefix
    await dbRun("DELETE FROM narrative_queue WHERE title LIKE 'TEST_%'");

    // Clean remaining narrative_queue and canon_facts referencing the test character
    if (testCharId) {
      await dbRun('DELETE FROM narrative_queue WHERE character_id = ?', [testCharId]);
      await dbRun('DELETE FROM canon_facts WHERE character_id = ?', [testCharId]);
      await dbRun('DELETE FROM characters WHERE id = ?', [testCharId]);
    }
    if (testCampaignId) {
      await dbRun('DELETE FROM campaigns WHERE id = ?', [testCampaignId]);
    }

    console.log('  Cleanup complete.');
  } catch (err) {
    console.error('  Cleanup error:', err.message);
  }
}

// ============================================================
// Run all tests
// ============================================================

async function runAll() {
  try {
    await setup();
    await testValidTransitions();
    await testInvalidTransitions();
    await testTransitionHistory();
    await testEnrichmentFields();
    await testDeathPropagation();
  } catch (err) {
    console.error('\nFATAL ERROR:', err);
    failed++;
  } finally {
    // Small delay to let any async event emitter writes settle before cleanup
    await new Promise(resolve => setTimeout(resolve, 200));
    await cleanup();
    console.log(`\n${'='.repeat(50)}`);
    console.log(`NPC Lifecycle Tests: ${passed} passed, ${failed} failed`);
    console.log('='.repeat(50));
    process.exit(failed > 0 ? 1 : 0);
  }
}

runAll();
