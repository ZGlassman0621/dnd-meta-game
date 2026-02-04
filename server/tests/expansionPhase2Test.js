/**
 * Expansion Systems Phase 2 Tests
 *
 * Tests the Phase 2 expansion endpoints:
 * - Travel System (journeys, encounters)
 * - NPC Relationship Enhancements
 */

import { dbAll, dbGet, dbRun, initDatabase } from '../database.js';
import * as travelService from '../services/travelService.js';
import * as npcRelationshipService from '../services/npcRelationshipService.js';
import * as campaignService from '../services/campaignService.js';
import * as locationService from '../services/locationService.js';

// Initialize database with new tables
await initDatabase();

// Test utilities
let testsPassed = 0;
let testsFailed = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    testsPassed++;
  } catch (error) {
    console.log(`  ✗ ${name}`);
    console.log(`    Error: ${error.message}`);
    testsFailed++;
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion failed');
}

// Test data storage
const testData = {};

async function setupTestData() {
  console.log('\n📦 Setting up test data...');

  // Create test campaign
  testData.campaign = await campaignService.createCampaign({
    name: 'Phase 2 Test Campaign',
    description: 'Campaign for testing Phase 2 systems',
    setting: 'Forgotten Realms'
  });
  console.log(`  Created campaign: ${testData.campaign.name} (ID: ${testData.campaign.id})`);

  // Create test character
  const charResult = await dbRun(`
    INSERT INTO characters (name, race, class, level, experience, experience_to_next_level, max_hp, current_hp, current_location, campaign_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, ['Phase 2 Test Hero', 'Human', 'Ranger', 4, 2700, 6500, 38, 38, 'Waterdeep', testData.campaign.id]);
  testData.character = await dbGet('SELECT * FROM characters WHERE id = ?', [charResult.lastInsertRowid]);
  console.log(`  Created character: ${testData.character.name} (ID: ${testData.character.id})`);

  // Create test locations
  testData.originLocation = await locationService.createLocation({
    campaign_id: testData.campaign.id,
    name: 'Waterdeep',
    location_type: 'city',
    danger_level: 2
  });
  console.log(`  Created origin location: ${testData.originLocation.name} (ID: ${testData.originLocation.id})`);

  testData.destLocation = await locationService.createLocation({
    campaign_id: testData.campaign.id,
    name: 'Baldurs Gate',
    location_type: 'city',
    danger_level: 3
  });
  console.log(`  Created destination: ${testData.destLocation.name} (ID: ${testData.destLocation.id})`);

  // Create test NPC
  const npcResult = await dbRun(`
    INSERT INTO npcs (name, race, occupation, current_location)
    VALUES (?, ?, ?, ?)
  `, ['Merchant Thalasso', 'Human', 'Merchant', 'Waterdeep']);
  testData.npc = await dbGet('SELECT * FROM npcs WHERE id = ?', [npcResult.lastInsertRowid]);
  console.log(`  Created NPC: ${testData.npc.name} (ID: ${testData.npc.id})`);
}

async function cleanupTestData() {
  console.log('\n🧹 Cleaning up test data...');

  // Clean up journey encounters
  if (testData.journey) {
    await dbRun('DELETE FROM journey_encounters WHERE journey_id = ?', [testData.journey.id]);
  }

  // Clean up journeys
  if (testData.character) {
    await dbRun('DELETE FROM journeys WHERE character_id = ?', [testData.character.id]);
  }

  // Clean up NPC relationships
  if (testData.character && testData.npc) {
    await dbRun('DELETE FROM npc_relationships WHERE character_id = ? AND npc_id = ?',
      [testData.character.id, testData.npc.id]);
  }

  // Clean up locations
  if (testData.originLocation) {
    await dbRun('DELETE FROM locations WHERE id = ?', [testData.originLocation.id]);
  }
  if (testData.destLocation) {
    await dbRun('DELETE FROM locations WHERE id = ?', [testData.destLocation.id]);
  }

  // Clean up NPC
  if (testData.npc) {
    await dbRun('DELETE FROM npcs WHERE id = ?', [testData.npc.id]);
  }

  // Clean up character
  if (testData.character) {
    await dbRun('DELETE FROM characters WHERE id = ?', [testData.character.id]);
  }

  // Clean up campaign
  if (testData.campaign) {
    await campaignService.deleteCampaign(testData.campaign.id);
  }

  console.log('  Cleanup complete');
}

async function runTests() {
  console.log('🧪 EXPANSION SYSTEMS PHASE 2 TESTS');
  console.log('\n==================================================\n');

  await setupTestData();

  console.log('\n📋 Running tests...\n');

  // ============================================================
  // TRAVEL CALCULATION TESTS
  // ============================================================

  console.log('--- Travel Calculation Tests ---\n');

  await test('Calculate travel time (walking on road)', async () => {
    const hours = travelService.calculateTravelTime(30, 'walking', 'road');
    assert(hours === 10, `Expected 10 hours for 30 miles walking on road, got ${hours}`);
  });

  await test('Calculate travel time (riding through wilderness)', async () => {
    const hours = travelService.calculateTravelTime(30, 'riding', 'wilderness');
    assert(hours === 10, `Expected 10 hours for 30 miles riding through wilderness, got ${hours}`);
  });

  await test('Calculate rations needed', async () => {
    const rations = travelService.calculateRationsNeeded(24, 2); // 24 hours, party of 2
    assert(rations === 6, `Expected 6 rations (3 days * 2 people), got ${rations}`);
  });

  await test('Estimate travel cost', async () => {
    const cost = travelService.estimateTravelCost(100, 'carriage');
    assert(cost === 30, `Expected 30 gp for 100 miles by carriage, got ${cost}`);
  });

  // ============================================================
  // JOURNEY CRUD TESTS
  // ============================================================

  console.log('\n--- Journey CRUD Tests ---\n');

  await test('Can start a journey', async () => {
    testData.journey = await travelService.startJourney({
      character_id: testData.character.id,
      campaign_id: testData.campaign.id,
      origin_location_id: testData.originLocation.id,
      destination_location_id: testData.destLocation.id,
      origin_name: 'Waterdeep',
      destination_name: 'Baldurs Gate',
      travel_method: 'walking',
      route_type: 'road',
      distance_miles: 750,
      traveling_companions: [{ id: 1, name: 'Test Companion' }]
    });
    assert(testData.journey.id, 'Journey should have an ID');
    assert(testData.journey.status === 'in_progress', 'Journey should be in progress');
    assert(testData.journey.estimated_hours === 250, 'Should calculate travel time');
  });

  await test('Can get journey by ID', async () => {
    const journey = await travelService.getJourneyById(testData.journey.id);
    assert(journey, 'Journey should be found');
    assert(journey.origin_name === 'Waterdeep', 'Origin should match');
    assert(Array.isArray(journey.traveling_companions), 'Companions should be an array');
  });

  await test('Can get active journey for character', async () => {
    const journey = await travelService.getActiveJourney(testData.character.id);
    assert(journey, 'Active journey should be found');
    assert(journey.id === testData.journey.id, 'Should be the test journey');
  });

  await test('Can consume resources during journey', async () => {
    const updated = await travelService.consumeResources(testData.journey.id, 5, 10);
    assert(updated.rations_consumed === 5, 'Rations should be 5');
    assert(updated.gold_spent === 10, 'Gold spent should be 10');
  });

  await test('Can update a journey', async () => {
    const updated = await travelService.updateJourney(testData.journey.id, {
      travel_method: 'riding'
    });
    assert(updated.travel_method === 'riding', 'Travel method should be updated');
  });

  // ============================================================
  // ENCOUNTER TESTS
  // ============================================================

  console.log('\n--- Encounter Tests ---\n');

  await test('Can create an encounter', async () => {
    testData.encounter = await travelService.createEncounter({
      journey_id: testData.journey.id,
      encounter_type: 'combat',
      title: 'Bandit Ambush',
      description: 'A group of bandits blocks the road',
      hours_into_journey: 8,
      danger_level: 4,
      challenge_type: 'combat',
      npcs_involved: [{ name: 'Bandit Leader', cr: 2 }]
    });
    assert(testData.encounter.id, 'Encounter should have an ID');
    assert(testData.encounter.status === 'pending', 'Encounter should be pending');
  });

  await test('Journey encounter count is updated', async () => {
    const journey = await travelService.getJourneyById(testData.journey.id);
    assert(journey.encounters_faced === 1, 'Encounters faced should be 1');
  });

  await test('Can get pending encounters', async () => {
    const encounters = await travelService.getPendingEncounters(testData.journey.id);
    assert(Array.isArray(encounters), 'Should return array');
    assert(encounters.length === 1, 'Should have 1 pending encounter');
  });

  await test('Can resolve an encounter', async () => {
    const resolved = await travelService.resolveEncounter(testData.encounter.id, {
      approach: 'combat',
      outcome: 'victory',
      outcome_description: 'Defeated the bandits',
      hp_change: -5,
      gold_change: 50,
      items_gained: [{ name: 'Bandit Loot' }],
      time_lost_hours: 1
    });
    assert(resolved.status === 'resolved', 'Encounter should be resolved');
    assert(resolved.outcome === 'victory', 'Outcome should be victory');
    assert(resolved.hp_change === -5, 'HP change should be recorded');
  });

  await test('Can avoid an encounter', async () => {
    // Create another encounter to avoid
    const encounter2 = await travelService.createEncounter({
      journey_id: testData.journey.id,
      encounter_type: 'creature',
      title: 'Wolf Pack',
      description: 'Wolves prowling nearby',
      hours_into_journey: 16,
      danger_level: 3
    });

    const avoided = await travelService.avoidEncounter(encounter2.id, 'stealth', 'Snuck past the wolves');
    assert(avoided.status === 'avoided', 'Encounter should be avoided');
    assert(avoided.approach === 'stealth', 'Approach should be recorded');

    const journey = await travelService.getJourneyById(testData.journey.id);
    assert(journey.encounters_avoided === 1, 'Encounters avoided should be 1');
  });

  await test('Can generate random encounter', async () => {
    const encounter = travelService.generateRandomEncounter('wilderness', 5);
    assert(encounter.encounter_type, 'Should have encounter type');
    assert(encounter.danger_level >= 1 && encounter.danger_level <= 10, 'Danger level should be valid');
    assert(encounter.challenge_type, 'Should have challenge type');
  });

  await test('Check for encounter returns valid result', async () => {
    const result = travelService.checkForEncounter(5, 20, 'road');
    assert(typeof result.occurs === 'boolean', 'Should have occurs property');
  });

  // ============================================================
  // JOURNEY COMPLETION TESTS
  // ============================================================

  console.log('\n--- Journey Completion Tests ---\n');

  await test('Can complete a journey', async () => {
    const completed = await travelService.completeJourney(
      testData.journey.id,
      252, // actual hours
      'Arrived safely in Baldurs Gate'
    );
    assert(completed.status === 'completed', 'Journey should be completed');
    assert(completed.outcome === 'arrived', 'Outcome should be arrived');
    assert(completed.actual_hours === 252, 'Actual hours should be recorded');
  });

  // Create a new journey to test abort
  await test('Can abort a journey', async () => {
    const journey = await travelService.startJourney({
      character_id: testData.character.id,
      campaign_id: testData.campaign.id,
      origin_location_id: testData.originLocation.id,
      destination_location_id: testData.destLocation.id,
      travel_method: 'walking',
      route_type: 'wilderness',
      distance_miles: 100
    });

    const aborted = await travelService.abortJourney(journey.id, 'Bad weather forced return', 'aborted');
    assert(aborted.status === 'aborted', 'Journey should be aborted');
    assert(aborted.outcome === 'aborted', 'Outcome should be aborted');

    // Clean up
    await dbRun('DELETE FROM journeys WHERE id = ?', [journey.id]);
  });

  // ============================================================
  // NPC RELATIONSHIP ENHANCEMENT TESTS
  // ============================================================

  console.log('\n--- NPC Relationship Enhancement Tests ---\n');

  await test('Can create relationship with NPC', async () => {
    testData.relationship = await npcRelationshipService.createRelationship({
      character_id: testData.character.id,
      npc_id: testData.npc.id,
      disposition: 20,
      trust_level: 10
    });
    assert(testData.relationship.id, 'Relationship should have an ID');
    assert(testData.relationship.disposition === 20, 'Disposition should be 20');
  });

  await test('Can add rumor heard by NPC', async () => {
    const updated = await npcRelationshipService.addRumorHeard(
      testData.character.id,
      testData.npc.id,
      'The hero once slayed a dragon'
    );
    assert(updated.rumors_heard.length === 1, 'Should have 1 rumor');
    assert(updated.rumors_heard[0].believed === true, 'Rumor should be believed');
  });

  await test('Can disprove a rumor', async () => {
    const updated = await npcRelationshipService.disproveRumor(
      testData.character.id,
      testData.npc.id,
      0
    );
    assert(updated.rumors_heard[0].believed === false, 'Rumor should be disproven');
  });

  await test('Can add a promise', async () => {
    const updated = await npcRelationshipService.addPromise(
      testData.character.id,
      testData.npc.id,
      'I will retrieve your lost cargo'
    );
    assert(updated.promises_made.length === 1, 'Should have 1 promise');
    assert(updated.promises_made[0].status === 'pending', 'Promise should be pending');
  });

  await test('Can fulfill a promise', async () => {
    const updated = await npcRelationshipService.fulfillPromise(
      testData.character.id,
      testData.npc.id,
      0
    );
    assert(updated.promises_made[0].status === 'fulfilled', 'Promise should be fulfilled');
  });

  await test('Can break a promise (adds new promise first)', async () => {
    await npcRelationshipService.addPromise(
      testData.character.id,
      testData.npc.id,
      'I will protect your shop'
    );

    const before = await npcRelationshipService.getRelationship(testData.character.id, testData.npc.id);
    const initialDisposition = before.disposition;

    const updated = await npcRelationshipService.breakPromise(
      testData.character.id,
      testData.npc.id,
      1,
      'Called away on urgent quest'
    );
    assert(updated.promises_made[1].status === 'broken', 'Promise should be broken');
    assert(updated.disposition < initialDisposition, 'Disposition should decrease');
  });

  await test('Can add a debt', async () => {
    const updated = await npcRelationshipService.addDebt(
      testData.character.id,
      testData.npc.id,
      {
        type: 'gold',
        description: 'Borrowed 50 gold for supplies',
        direction: 'player_owes_npc'
      }
    );
    assert(updated.debts_owed.length === 1, 'Should have 1 debt');
    assert(updated.debts_owed[0].status === 'outstanding', 'Debt should be outstanding');
  });

  await test('Can settle a debt', async () => {
    const before = await npcRelationshipService.getRelationship(testData.character.id, testData.npc.id);
    const initialDisposition = before.disposition;

    const updated = await npcRelationshipService.settleDebt(
      testData.character.id,
      testData.npc.id,
      0,
      'Paid back with interest'
    );
    assert(updated.debts_owed[0].status === 'settled', 'Debt should be settled');
    assert(updated.disposition > initialDisposition, 'Disposition should improve');
  });

  await test('Can get pending promises for character', async () => {
    // Add a new pending promise
    await npcRelationshipService.addPromise(
      testData.character.id,
      testData.npc.id,
      'I will return with news'
    );

    const promises = await npcRelationshipService.getPendingPromises(testData.character.id);
    assert(Array.isArray(promises), 'Should return array');
    assert(promises.length >= 1, 'Should have at least 1 pending promise');
  });

  await test('Can get outstanding debts for character', async () => {
    // Add a new debt
    await npcRelationshipService.addDebt(
      testData.character.id,
      testData.npc.id,
      {
        type: 'favor',
        description: 'NPC provided safe passage',
        direction: 'npc_owes_player'
      }
    );

    const debts = await npcRelationshipService.getOutstandingDebts(testData.character.id);
    assert(Array.isArray(debts), 'Should return array');
    assert(debts.length >= 1, 'Should have at least 1 outstanding debt');
  });

  await test('Can get relationship summary', async () => {
    const summary = await npcRelationshipService.getRelationshipSummary(testData.character.id);
    assert(summary.total >= 1, 'Should have at least 1 relationship');
    assert(typeof summary.pending_promises === 'number', 'Should have promise count');
    assert(typeof summary.outstanding_debts_owed === 'number', 'Should have debt count');
  });

  await cleanupTestData();

  // Print summary
  console.log('\n==================================================\n');
  console.log('📊 TEST SUMMARY\n');
  console.log(`  Total: ${testsPassed + testsFailed}`);
  console.log(`  Passed: ${testsPassed} ✓`);
  console.log(`  Failed: ${testsFailed} ✗`);

  if (testsFailed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test run failed:', err);
  process.exit(1);
});
