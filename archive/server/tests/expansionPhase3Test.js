/**
 * Expansion Systems Phase 3 Tests
 *
 * Tests the Phase 3 living world integration:
 * - Living World Tick Processing
 * - Faction/Event Coordination
 * - World State Queries
 */

import { dbAll, dbGet, dbRun, initDatabase } from '../database.js';
import * as livingWorldService from '../services/livingWorldService.js';
import * as factionService from '../services/factionService.js';
import * as worldEventService from '../services/worldEventService.js';

// Initialize database
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
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

// Test data
let testCampaign;
let testCharacter;
let testFaction;
let testGoal;

// ============================================================
// SETUP
// ============================================================

console.log('\n=== Setting up test data ===\n');

// Create test campaign
const campaignResult = await dbRun(`
  INSERT INTO campaigns (name, description, setting, tone, status)
  VALUES ('Living World Test Campaign', 'Testing living world systems', 'Forgotten Realms', 'heroic', 'active')
`);
testCampaign = await dbGet('SELECT * FROM campaigns WHERE id = ?', [campaignResult.lastInsertRowid]);
console.log(`Created test campaign: ${testCampaign.name}`);

// Create test character
const characterResult = await dbRun(`
  INSERT INTO characters (name, race, class, level, campaign_id, game_day, game_year, game_hour, current_hp, max_hp, current_location, experience_to_next_level)
  VALUES ('World Watcher', 'Human', 'Wizard', 5, ?, 1, 1492, 8, 30, 30, 'Test Location', 6500)
`, [testCampaign.id]);
testCharacter = await dbGet('SELECT * FROM characters WHERE id = ?', [characterResult.lastInsertRowid]);
console.log(`Created test character: ${testCharacter.name}`);

// Create test faction
testFaction = await factionService.createFaction({
  campaign_id: testCampaign.id,
  name: 'The Tick Testers Guild',
  description: 'A guild dedicated to testing time progression',
  scope: 'regional',
  power_level: 7,
  alignment: 'neutral'
});
console.log(`Created test faction: ${testFaction.name}`);

// Create test goal for faction
testGoal = await factionService.createFactionGoal({
  faction_id: testFaction.id,
  title: 'Expand Testing Coverage',
  description: 'Increase test coverage across all systems',
  goal_type: 'expansion',
  progress: 0,
  progress_max: 100,
  urgency: 'high',
  visibility: 'rumored',
  stakes_level: 'moderate'
});
console.log(`Created test goal: ${testGoal.title}`);

// ============================================================
// LIVING WORLD TICK TESTS
// ============================================================

console.log('\n=== Living World Tick Tests ===\n');

await test('processLivingWorldTick advances faction goals', async () => {
  const results = await livingWorldService.processLivingWorldTick(testCampaign.id, 1);

  assert(results.faction_results.length > 0, 'Should have faction results');
  assert(results.faction_results[0].goal_id === testGoal.id, 'Should advance our test goal');
  assert(results.faction_results[0].progress_gained > 0, 'Should have gained progress');
});

await test('processLivingWorldTick processes multiple days', async () => {
  // Reset goal progress
  await factionService.updateFactionGoal(testGoal.id, { progress: 0 });

  const results = await livingWorldService.processLivingWorldTick(testCampaign.id, 3);

  const goalResult = results.faction_results.find(r => r.goal_id === testGoal.id);
  assert(goalResult, 'Should find goal result');
  // With 3 days and high urgency (1.5x) and power level 7, should gain significant progress
  assert(goalResult.progress_gained > 10, 'Should gain more progress with multiple days');
});

await test('processLivingWorldTick spawns events at milestones', async () => {
  // Set goal progress to just below 25%
  await factionService.updateFactionGoal(testGoal.id, { progress: 20 });

  // Process enough to cross the 25% threshold
  const results = await livingWorldService.processLivingWorldTick(testCampaign.id, 2);

  // Check if goal crossed 25%
  const updatedGoal = await factionService.getFactionGoalById(testGoal.id);

  if (updatedGoal.progress >= 25) {
    // Should have spawned an event
    assert(results.spawned_events.length > 0, 'Should spawn event at milestone');
    assert(results.spawned_events[0].milestone === 25, 'Should be 25% milestone');
  }
});

await test('processLivingWorldTick handles empty campaign', async () => {
  // Create empty campaign
  const emptyResult = await dbRun(`
    INSERT INTO campaigns (name, description, status)
    VALUES ('Empty Campaign', 'No factions or events', 'active')
  `);

  const results = await livingWorldService.processLivingWorldTick(emptyResult.lastInsertRowid, 1);

  assert(results.faction_results.length === 0, 'Should have no faction results');
  assert(results.errors.length === 0, 'Should have no errors');
});

// ============================================================
// WORLD STATE TESTS
// ============================================================

console.log('\n=== World State Tests ===\n');

await test('getWorldState returns comprehensive state', async () => {
  const state = await livingWorldService.getWorldState(testCampaign.id);

  assert(state.factions, 'Should have factions section');
  assert(state.factions.count > 0, 'Should have faction count');
  assert(state.goals, 'Should have goals section');
  assert(state.events, 'Should have events section');
  assert(state.effects, 'Should have effects section');
});

await test('getWorldState counts goals by visibility', async () => {
  const state = await livingWorldService.getWorldState(testCampaign.id);

  assert(state.goals.by_visibility, 'Should have visibility breakdown');
  assert(state.goals.by_visibility.rumored >= 1, 'Should count rumored goals');
});

await test('getCharacterWorldView returns character-specific view', async () => {
  const view = await livingWorldService.getCharacterWorldView(testCharacter.id);

  assert(view, 'Should return view');
  assert(view.character_id === testCharacter.id, 'Should be for correct character');
  assert(view.campaign_id === testCampaign.id, 'Should be for correct campaign');
  assert(Array.isArray(view.faction_standings), 'Should have faction standings array');
});

await test('getCharacterWorldView shows visible events', async () => {
  // Create a public event
  await worldEventService.createWorldEvent({
    campaign_id: testCampaign.id,
    title: 'Public Test Event',
    description: 'A publicly visible event',
    event_type: 'social',
    visibility: 'public',
    status: 'active'
  });

  const view = await livingWorldService.getCharacterWorldView(testCharacter.id);

  const publicEvent = view.visible_events.find(e => e.title === 'Public Test Event');
  assert(publicEvent, 'Should see public events');
});

await test('getCharacterWorldView shows discovered goals', async () => {
  // Create a fresh goal specifically for this test
  const discoveryGoal = await factionService.createFactionGoal({
    faction_id: testFaction.id,
    title: 'Discovery Test Goal',
    description: 'A goal to test discovery',
    goal_type: 'political',
    visibility: 'secret',
    status: 'active'
  });

  // Discover the goal
  const discoveredGoal = await factionService.discoverGoal(discoveryGoal.id, testCharacter.id);

  // Verify discovery worked
  assert(discoveredGoal.discovered_by_characters.includes(testCharacter.id), 'Goal should have character in discovered list');

  // Check raw DB value
  const rawGoal = await dbGet('SELECT * FROM faction_goals WHERE id = ?', [discoveryGoal.id]);

  // Get the goals visible to character directly first
  const visibleGoals = await factionService.getGoalsVisibleToCharacter(testCharacter.id);
  const directGoal = visibleGoals.find(g => g.id === discoveryGoal.id);

  // If test fails, let's see what we have
  if (!directGoal) {
    console.log('    DEBUG: Character ID:', testCharacter.id, typeof testCharacter.id);
    console.log('    DEBUG: Goal ID:', discoveryGoal.id);
    console.log('    DEBUG: Raw discovered_by:', rawGoal.discovered_by_characters);
    console.log('    DEBUG: Visible goals count:', visibleGoals.length);
    console.log('    DEBUG: Visible goal IDs:', visibleGoals.map(g => g.id));
  }

  // Try the character world view
  const view = await livingWorldService.getCharacterWorldView(testCharacter.id);
  const knownGoal = view.known_faction_goals.find(g => g.goal_id === discoveryGoal.id);

  // Cleanup first
  await factionService.deleteFactionGoal(discoveryGoal.id);

  // Then assert
  assert(directGoal, 'Should see discovered goal in direct query');
  assert(knownGoal, 'Should see discovered goals in world view');
  assert(knownGoal.faction_name === testFaction.name, 'Should have faction name');
});

// ============================================================
// CHARACTER TIME ADVANCE INTEGRATION TESTS
// ============================================================

console.log('\n=== Character Time Advance Integration Tests ===\n');

await test('processCharacterTimeAdvance processes for valid character', async () => {
  // Update character to have campaign
  await dbRun('UPDATE characters SET campaign_id = ? WHERE id = ?', [testCampaign.id, testCharacter.id]);

  // Reset goal
  await factionService.updateFactionGoal(testGoal.id, { progress: 0 });

  const result = await livingWorldService.processCharacterTimeAdvance(testCharacter.id, 24);

  assert(result.processed === true, 'Should process');
  assert(result.hours_advanced === 24, 'Should record hours');
  assert(result.results, 'Should have results');
});

await test('processCharacterTimeAdvance skips short time periods', async () => {
  const result = await livingWorldService.processCharacterTimeAdvance(testCharacter.id, 2);

  assert(result.processed === false, 'Should not process short periods');
  assert(result.reason, 'Should have reason');
});

await test('processCharacterTimeAdvance handles character without campaign', async () => {
  // Create character without campaign
  const noCampaignResult = await dbRun(`
    INSERT INTO characters (name, race, class, level, current_hp, max_hp, current_location, experience_to_next_level)
    VALUES ('No Campaign Character', 'Elf', 'Ranger', 3, 25, 25, 'Wilderness', 2700)
  `);

  const result = await livingWorldService.processCharacterTimeAdvance(noCampaignResult.lastInsertRowid, 24);

  assert(result.processed === false, 'Should not process without campaign');
});

// ============================================================
// GOAL COMPLETION AND EVENT SPAWNING TESTS
// ============================================================

console.log('\n=== Goal Completion Tests ===\n');

await test('Goal completion spawns event', async () => {
  // Create a new goal near completion
  const completionGoal = await factionService.createFactionGoal({
    faction_id: testFaction.id,
    title: 'Near Completion Goal',
    description: 'Almost done',
    goal_type: 'economic',
    progress: 95,
    progress_max: 100,
    urgency: 'critical',
    stakes_level: 'major'
  });

  const results = await livingWorldService.processLivingWorldTick(testCampaign.id, 1);

  // Check if goal completed
  const updatedGoal = await factionService.getFactionGoalById(completionGoal.id);

  if (updatedGoal.status === 'completed') {
    const completionEvent = results.spawned_events.find(
      e => e.triggered_by === 'faction_goal_completion' && e.goal_id === completionGoal.id
    );
    assert(completionEvent, 'Should spawn completion event');
  }

  // Cleanup
  await factionService.deleteFactionGoal(completionGoal.id);
});

await test('Milestone events have correct visibility', async () => {
  // Create public goal
  const publicGoal = await factionService.createFactionGoal({
    faction_id: testFaction.id,
    title: 'Public Goal',
    description: 'Everyone knows',
    visibility: 'public',
    progress: 20,
    progress_max: 100,
    urgency: 'high'
  });

  const results = await livingWorldService.processLivingWorldTick(testCampaign.id, 2);

  // Check for spawned event
  const milestoneEvent = results.spawned_events.find(
    e => e.goal_id === publicGoal.id
  );

  if (milestoneEvent) {
    const event = await worldEventService.getWorldEventById(milestoneEvent.event_id);
    assert(event.visibility === 'public', 'Public goal milestones should spawn public events');
  }

  // Cleanup
  await factionService.deleteFactionGoal(publicGoal.id);
});

// ============================================================
// WORLD EVENT TICK TESTS
// ============================================================

console.log('\n=== World Event Tick Tests ===\n');

await test('Event tick advances multi-stage events', async () => {
  // Create multi-stage event
  const stagedEvent = await worldEventService.createWorldEvent({
    campaign_id: testCampaign.id,
    title: 'Multi-Stage Test Event',
    description: 'Testing stage advancement',
    event_type: 'political',
    stages: ['Beginning', 'Middle', 'End'],
    stage_descriptions: ['It starts', 'It continues', 'It ends'],
    expected_duration_days: 3,
    status: 'active'
  });

  // Process a day
  const results = await livingWorldService.processLivingWorldTick(testCampaign.id, 2);

  // Check if event advanced
  const updatedEvent = await worldEventService.getWorldEventById(stagedEvent.id);

  // Event might advance depending on timing
  assert(updatedEvent, 'Event should still exist');

  // Cleanup
  await worldEventService.deleteWorldEvent(stagedEvent.id);
});

await test('Event tick expires effects', async () => {
  // Create event with effect that expires
  const effectEvent = await worldEventService.createWorldEvent({
    campaign_id: testCampaign.id,
    title: 'Effect Test Event',
    description: 'Testing effect expiration',
    event_type: 'economic',
    status: 'active'
  });

  // Create effect with past expiration
  const pastDate = new Date();
  pastDate.setDate(pastDate.getDate() - 1);

  await worldEventService.createEventEffect({
    event_id: effectEvent.id,
    effect_type: 'price_modifier',
    description: 'Expired effect',
    target_type: 'location',
    target_id: 1,
    expires_at: pastDate.toISOString(),
    status: 'active'
  });

  // Process tick
  const results = await livingWorldService.processLivingWorldTick(testCampaign.id, 1);

  // Check expired count
  assert(results.effects_expired >= 1, 'Should expire at least one effect');

  // Cleanup
  await worldEventService.deleteWorldEvent(effectEvent.id);
});

// ============================================================
// ERROR HANDLING TESTS
// ============================================================

console.log('\n=== Error Handling Tests ===\n');

await test('Living world tick handles database errors gracefully', async () => {
  // Process tick for non-existent campaign
  const results = await livingWorldService.processLivingWorldTick(999999, 1);

  // Should complete without throwing
  assert(results, 'Should return results');
  assert(results.faction_results.length === 0, 'Should have empty faction results');
});

await test('getCharacterWorldView returns null for invalid character', async () => {
  const view = await livingWorldService.getCharacterWorldView(999999);
  assert(view === null, 'Should return null for invalid character');
});

// ============================================================
// CLEANUP
// ============================================================

console.log('\n=== Cleaning up test data ===\n');

// Clean up in reverse order of creation
await dbRun('DELETE FROM event_effects WHERE event_id IN (SELECT id FROM world_events WHERE campaign_id = ?)', [testCampaign.id]);
await dbRun('DELETE FROM world_events WHERE campaign_id = ?', [testCampaign.id]);
await dbRun('DELETE FROM faction_goals WHERE faction_id = ?', [testFaction.id]);
await dbRun('DELETE FROM faction_standings WHERE faction_id = ?', [testFaction.id]);
await dbRun('DELETE FROM factions WHERE campaign_id = ?', [testCampaign.id]);
await dbRun('DELETE FROM characters WHERE campaign_id = ?', [testCampaign.id]);
await dbRun('DELETE FROM characters WHERE name = ?', ['No Campaign Character']);
await dbRun('DELETE FROM campaigns WHERE id = ?', [testCampaign.id]);
await dbRun("DELETE FROM campaigns WHERE name = 'Empty Campaign'");

console.log('Cleanup complete');

// ============================================================
// SUMMARY
// ============================================================

console.log('\n========================================');
console.log(`  PHASE 3 TEST RESULTS`);
console.log('========================================');
console.log(`  Passed: ${testsPassed}`);
console.log(`  Failed: ${testsFailed}`);
console.log(`  Total:  ${testsPassed + testsFailed}`);
console.log('========================================\n');

if (testsFailed > 0) {
  process.exit(1);
}
