/**
 * Expansion Systems Phase 1 Tests
 *
 * Tests the Phase 1 expansion endpoints:
 * - Faction System (factions, goals, standings)
 * - World Events System (events, effects)
 */

import { dbAll, dbGet, dbRun, initDatabase } from '../database.js';
import * as factionService from '../services/factionService.js';
import * as worldEventService from '../services/worldEventService.js';
import * as campaignService from '../services/campaignService.js';

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
    name: 'Expansion Test Campaign',
    description: 'Campaign for testing expansion systems',
    setting: 'Forgotten Realms',
    tone: 'heroic fantasy'
  });
  console.log(`  Created campaign: ${testData.campaign.name} (ID: ${testData.campaign.id})`);

  // Create test character
  const charResult = await dbRun(`
    INSERT INTO characters (name, race, class, level, experience, experience_to_next_level, max_hp, current_hp, current_location, campaign_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, ['Expansion Test Hero', 'Human', 'Fighter', 5, 6500, 14000, 45, 45, 'Waterdeep', testData.campaign.id]);
  testData.character = await dbGet('SELECT * FROM characters WHERE id = ?', [charResult.lastInsertRowid]);
  console.log(`  Created character: ${testData.character.name} (ID: ${testData.character.id})`);

  // Create test NPC for faction leader
  const npcResult = await dbRun(`
    INSERT INTO npcs (name, race, occupation, current_location)
    VALUES (?, ?, ?, ?)
  `, ['Lord Dagult Neverember', 'Human', 'Noble', 'Waterdeep']);
  testData.leaderNpc = await dbGet('SELECT * FROM npcs WHERE id = ?', [npcResult.lastInsertRowid]);
  console.log(`  Created NPC: ${testData.leaderNpc.name} (ID: ${testData.leaderNpc.id})`);
}

async function cleanupTestData() {
  console.log('\n🧹 Cleaning up test data...');

  // Clean up event effects first
  if (testData.worldEvent) {
    await dbRun('DELETE FROM event_effects WHERE event_id = ?', [testData.worldEvent.id]);
  }

  // Clean up world events
  if (testData.campaign) {
    await dbRun('DELETE FROM world_events WHERE campaign_id = ?', [testData.campaign.id]);
  }

  // Clean up faction standings
  if (testData.character && testData.faction) {
    await dbRun('DELETE FROM faction_standings WHERE character_id = ? AND faction_id = ?',
      [testData.character.id, testData.faction.id]);
  }

  // Clean up faction goals
  if (testData.faction) {
    await dbRun('DELETE FROM faction_goals WHERE faction_id = ?', [testData.faction.id]);
  }

  // Clean up factions
  if (testData.campaign) {
    await dbRun('DELETE FROM factions WHERE campaign_id = ?', [testData.campaign.id]);
  }

  // Clean up NPC
  if (testData.leaderNpc) {
    await dbRun('DELETE FROM npcs WHERE id = ?', [testData.leaderNpc.id]);
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
  console.log('🧪 EXPANSION SYSTEMS PHASE 1 TESTS');
  console.log('\n==================================================\n');

  await setupTestData();

  console.log('\n📋 Running tests...\n');

  // ============================================================
  // FACTION CRUD TESTS
  // ============================================================

  console.log('--- Faction CRUD Tests ---\n');

  await test('Can create a faction', async () => {
    testData.faction = await factionService.createFaction({
      campaign_id: testData.campaign.id,
      name: 'Lords Alliance',
      description: 'A coalition of rulers from cities across Faerûn',
      symbol: 'A crowned lion',
      motto: 'Strength through unity',
      scope: 'regional',
      power_level: 8,
      influence_areas: ['Waterdeep', 'Neverwinter', 'Baldurs Gate'],
      leader_npc_id: testData.leaderNpc.id,
      leadership_structure: 'council',
      alignment: 'lawful neutral',
      primary_values: ['order', 'civilization', 'mutual defense'],
      typical_methods: ['diplomacy', 'military alliance', 'trade agreements']
    });
    assert(testData.faction.id, 'Faction should have an ID');
    assert(testData.faction.name === 'Lords Alliance', 'Faction name should match');
    assert(testData.faction.scope === 'regional', 'Faction scope should be regional');
  });

  await test('Can get faction by ID', async () => {
    const faction = await factionService.getFactionById(testData.faction.id);
    assert(faction, 'Faction should be found');
    assert(faction.name === 'Lords Alliance', 'Faction name should match');
    assert(Array.isArray(faction.influence_areas), 'Influence areas should be an array');
    assert(faction.influence_areas.length === 3, 'Should have 3 influence areas');
  });

  await test('Can get campaign factions', async () => {
    const factions = await factionService.getCampaignFactions(testData.campaign.id);
    assert(Array.isArray(factions), 'Should return array');
    const found = factions.find(f => f.id === testData.faction.id);
    assert(found, 'Should include test faction');
  });

  await test('Can update a faction', async () => {
    const updated = await factionService.updateFaction(testData.faction.id, {
      power_level: 9,
      public_reputation: 50
    });
    assert(updated.power_level === 9, 'Power level should be updated');
    assert(updated.public_reputation === 50, 'Public reputation should be updated');
  });

  await test('Can update faction relationships', async () => {
    // Create a second faction
    testData.faction2 = await factionService.createFaction({
      campaign_id: testData.campaign.id,
      name: 'Zhentarim',
      description: 'A shadowy network of merchants and mercenaries',
      scope: 'continental',
      power_level: 7,
      alignment: 'lawful evil'
    });

    const updated = await factionService.updateFactionRelationship(
      testData.faction.id,
      testData.faction2.id,
      -50 // hostile relationship
    );
    assert(updated.faction_relationships[testData.faction2.id] === -50, 'Relationship should be set');
  });

  // ============================================================
  // FACTION GOAL TESTS
  // ============================================================

  console.log('\n--- Faction Goal Tests ---\n');

  await test('Can create a faction goal', async () => {
    testData.factionGoal = await factionService.createFactionGoal({
      faction_id: testData.faction.id,
      title: 'Expand Trade Routes',
      description: 'Establish new trade agreements with Amn',
      goal_type: 'economic',
      progress: 0,
      progress_max: 100,
      urgency: 'normal',
      stakes_level: 'moderate',
      visibility: 'public'
    });
    assert(testData.factionGoal.id, 'Goal should have an ID');
    assert(testData.factionGoal.progress === 0, 'Progress should start at 0');
  });

  await test('Can get faction goals', async () => {
    const goals = await factionService.getFactionGoals(testData.faction.id);
    assert(Array.isArray(goals), 'Should return array');
    const found = goals.find(g => g.id === testData.factionGoal.id);
    assert(found, 'Should include test goal');
  });

  await test('Can advance goal progress', async () => {
    const updated = await factionService.advanceGoalProgress(testData.factionGoal.id, 25);
    assert(updated.progress === 25, 'Progress should be 25');
  });

  await test('Can mark goal as discovered by character', async () => {
    const updated = await factionService.discoverGoal(testData.factionGoal.id, testData.character.id);
    assert(updated.discovered_by_characters.includes(testData.character.id), 'Character should have discovered goal');
  });

  await test('Goal completes when progress reaches max', async () => {
    await factionService.advanceGoalProgress(testData.factionGoal.id, 75);
    const goal = await factionService.getFactionGoalById(testData.factionGoal.id);
    assert(goal.progress === 100, 'Progress should be 100');
    assert(goal.status === 'completed', 'Goal should be completed');
  });

  // ============================================================
  // FACTION STANDING TESTS
  // ============================================================

  console.log('\n--- Faction Standing Tests ---\n');

  await test('Can get or create faction standing', async () => {
    testData.standing = await factionService.getOrCreateStanding(
      testData.character.id,
      testData.faction.id
    );
    assert(testData.standing, 'Standing should be created');
    assert(testData.standing.standing === 0, 'Initial standing should be 0');
    assert(testData.standing.standing_label === 'neutral', 'Initial label should be neutral');
  });

  await test('Can modify standing', async () => {
    const updated = await factionService.modifyStanding(
      testData.character.id,
      testData.faction.id,
      30,
      { description: 'Saved the city from bandits', location: 'Waterdeep' }
    );
    assert(updated.standing === 30, 'Standing should be 30');
    assert(updated.standing_label === 'friendly', 'Label should be friendly');
    assert(updated.deeds_for.length === 1, 'Should have 1 deed for faction');
  });

  await test('Can join faction', async () => {
    const updated = await factionService.joinFaction(
      testData.character.id,
      testData.faction.id,
      'agent'
    );
    assert(updated.is_member === true, 'Should be a member');
    assert(updated.membership_level === 'agent', 'Membership level should be agent');
  });

  await test('Can get all standings for character', async () => {
    const standings = await factionService.getCharacterStandings(testData.character.id);
    assert(Array.isArray(standings), 'Should return array');
    const found = standings.find(s => s.faction_id === testData.faction.id);
    assert(found, 'Should include standing with test faction');
    assert(found.faction_name === 'Lords Alliance', 'Should include faction name');
  });

  await test('Can leave faction', async () => {
    const updated = await factionService.leaveFaction(
      testData.character.id,
      testData.faction.id
    );
    assert(updated.is_member === false, 'Should no longer be a member');
  });

  // ============================================================
  // WORLD EVENT TESTS
  // ============================================================

  console.log('\n--- World Event Tests ---\n');

  await test('Can create a world event', async () => {
    testData.worldEvent = await worldEventService.createWorldEvent({
      campaign_id: testData.campaign.id,
      title: 'Dragon Sighting Near Waterdeep',
      description: 'A great red dragon has been spotted flying over the mountains north of Waterdeep',
      event_type: 'threat',
      scope: 'regional',
      affected_locations: [1, 2], // placeholder location IDs
      affected_factions: [testData.faction.id],
      stages: ['Sighting', 'Investigation', 'Confrontation', 'Resolution'],
      stage_descriptions: [
        'Initial reports come in',
        'Heroes investigate the threat',
        'Face the dragon',
        'Aftermath'
      ],
      expected_duration_days: 30,
      visibility: 'public',
      triggered_by_faction_id: null,
      possible_outcomes: ['Dragon defeated', 'Dragon driven off', 'Dragon makes deal', 'Dragon conquers region']
    });
    assert(testData.worldEvent.id, 'Event should have an ID');
    assert(testData.worldEvent.current_stage === 0, 'Should start at stage 0');
    assert(testData.worldEvent.stages.length === 4, 'Should have 4 stages');
  });

  await test('Can get world event by ID', async () => {
    const event = await worldEventService.getWorldEventById(testData.worldEvent.id);
    assert(event, 'Event should be found');
    assert(event.title === 'Dragon Sighting Near Waterdeep', 'Title should match');
    assert(Array.isArray(event.stages), 'Stages should be an array');
  });

  await test('Can get active events for campaign', async () => {
    const events = await worldEventService.getActiveEvents(testData.campaign.id);
    assert(Array.isArray(events), 'Should return array');
    const found = events.find(e => e.id === testData.worldEvent.id);
    assert(found, 'Should include test event');
  });

  await test('Can get events affecting a faction', async () => {
    const events = await worldEventService.getEventsAffectingFaction(testData.faction.id);
    assert(Array.isArray(events), 'Should return array');
    const found = events.find(e => e.id === testData.worldEvent.id);
    assert(found, 'Should include test event');
  });

  await test('Can advance event stage', async () => {
    const updated = await worldEventService.advanceEventStage(testData.worldEvent.id);
    assert(updated.current_stage === 1, 'Should be at stage 1');
  });

  await test('Character can discover event', async () => {
    // Create a secret event first
    testData.secretEvent = await worldEventService.createWorldEvent({
      campaign_id: testData.campaign.id,
      title: 'Cult Activity',
      description: 'A cult is secretly operating in the sewers',
      event_type: 'conspiracy',
      visibility: 'secret'
    });

    const discovered = await worldEventService.discoverEvent(testData.secretEvent.id, testData.character.id);
    assert(discovered.discovered_by_characters.includes(testData.character.id), 'Character should have discovered event');
  });

  await test('Can get events visible to character', async () => {
    const events = await worldEventService.getEventsVisibleToCharacter(testData.character.id);
    assert(Array.isArray(events), 'Should return array');
    // Should include public event and discovered secret event
    const publicFound = events.find(e => e.id === testData.worldEvent.id);
    const secretFound = events.find(e => e.id === testData.secretEvent.id);
    assert(publicFound, 'Should include public event');
    assert(secretFound, 'Should include discovered secret event');
  });

  await test('Can resolve an event', async () => {
    const resolved = await worldEventService.resolveEvent(
      testData.worldEvent.id,
      'Dragon driven off',
      'The heroes successfully drove the dragon away'
    );
    assert(resolved.status === 'resolved', 'Event should be resolved');
    assert(resolved.outcome === 'Dragon driven off', 'Outcome should match');
  });

  // ============================================================
  // EVENT EFFECT TESTS
  // ============================================================

  console.log('\n--- Event Effect Tests ---\n');

  // Create a new event for effect testing
  testData.effectEvent = await worldEventService.createWorldEvent({
    campaign_id: testData.campaign.id,
    title: 'Merchant Festival',
    event_type: 'economic',
    scope: 'local'
  });

  await test('Can create an event effect', async () => {
    testData.eventEffect = await worldEventService.createEventEffect({
      event_id: testData.effectEvent.id,
      effect_type: 'price_modifier',
      description: 'Goods are 20% cheaper during the festival',
      target_type: 'location',
      target_id: 1,
      parameters: { modifier: -0.20, affected_goods: ['all'] },
      duration: '7 days'
    });
    assert(testData.eventEffect.id, 'Effect should have an ID');
    assert(testData.eventEffect.effect_type === 'price_modifier', 'Effect type should match');
  });

  await test('Can get effects for an event', async () => {
    const effects = await worldEventService.getEventEffects(testData.effectEvent.id);
    assert(Array.isArray(effects), 'Should return array');
    const found = effects.find(e => e.id === testData.eventEffect.id);
    assert(found, 'Should include test effect');
  });

  await test('Can get active effects for target', async () => {
    const effects = await worldEventService.getActiveEffectsForTarget('location', 1);
    assert(Array.isArray(effects), 'Should return array');
    const found = effects.find(e => e.id === testData.eventEffect.id);
    assert(found, 'Should include effect targeting location');
  });

  await test('Can reverse an effect', async () => {
    const reversed = await worldEventService.reverseEffect(
      testData.eventEffect.id,
      'Festival ended early'
    );
    assert(reversed.status === 'reversed', 'Effect should be reversed');
    assert(reversed.reversal_reason === 'Festival ended early', 'Reason should be recorded');
  });

  // ============================================================
  // TICK PROCESSING TESTS
  // ============================================================

  console.log('\n--- Tick Processing Tests ---\n');

  // Create a new goal for tick testing
  testData.tickGoal = await factionService.createFactionGoal({
    faction_id: testData.faction.id,
    title: 'Test Tick Goal',
    goal_type: 'military',
    urgency: 'high',
    status: 'active'
  });

  await test('Faction tick processing advances goals', async () => {
    const results = await factionService.processFactionTick(testData.campaign.id, 1);
    assert(Array.isArray(results), 'Should return array of results');
    // With high urgency and faction power level 9, should have some progress
    const goalResult = results.find(r => r.goal_id === testData.tickGoal.id);
    if (goalResult) {
      assert(goalResult.progress_gained > 0, 'Should have gained progress');
    }
  });

  // Create an active event for event tick testing
  testData.tickEvent = await worldEventService.createWorldEvent({
    campaign_id: testData.campaign.id,
    title: 'Test Tick Event',
    event_type: 'political',
    stages: ['Stage 1', 'Stage 2', 'Stage 3'],
    expected_duration_days: 3, // 1 day per stage
    status: 'active'
  });

  await test('Event tick processing runs without error', async () => {
    const results = await worldEventService.processEventTick(testData.campaign.id, 1);
    assert(Array.isArray(results), 'Should return array of results');
  });

  // Cleanup extra test data
  if (testData.secretEvent) {
    await dbRun('DELETE FROM world_events WHERE id = ?', [testData.secretEvent.id]);
  }
  if (testData.effectEvent) {
    await dbRun('DELETE FROM event_effects WHERE event_id = ?', [testData.effectEvent.id]);
    await dbRun('DELETE FROM world_events WHERE id = ?', [testData.effectEvent.id]);
  }
  if (testData.tickEvent) {
    await dbRun('DELETE FROM world_events WHERE id = ?', [testData.tickEvent.id]);
  }
  if (testData.tickGoal) {
    await dbRun('DELETE FROM faction_goals WHERE id = ?', [testData.tickGoal.id]);
  }
  if (testData.faction2) {
    await dbRun('DELETE FROM factions WHERE id = ?', [testData.faction2.id]);
  }

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
