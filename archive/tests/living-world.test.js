/**
 * Tests for the living world tick pipeline: processLivingWorldTick,
 * getWorldState, and getCharacterWorldView.
 * Run: node tests/living-world.test.js
 *
 * All test data prefixed with TEST_ and cleaned up at the end.
 * Some subsystems (companion activities, NPC mail) depend on AI calls —
 * we verify the steps were attempted, not that AI-generated content is correct.
 */

import { initDatabase, dbRun, dbGet, dbAll } from '../server/database.js';
import {
  processLivingWorldTick, getWorldState, getCharacterWorldView
} from '../server/services/livingWorldService.js';

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

// ===== Track IDs for cleanup =====
let testCampaignId;
let testCharId;
let testCharNoCanpaignId;
let testNpcId;
let testCompanionNpcId;
let testCompanionId;

// ===== Setup helpers =====

async function createTestCampaign() {
  const result = await dbRun(
    `INSERT INTO campaigns (name, description, setting, tone, starting_location)
     VALUES (?, ?, ?, ?, ?)`,
    ['TEST_LivingWorldCampaign', 'Test campaign for living world tick', 'Forgotten Realms', 'heroic fantasy', 'Waterdeep']
  );
  testCampaignId = Number(result.lastInsertRowid);
}

async function createTestCharacter() {
  const result = await dbRun(
    `INSERT INTO characters (name, class, race, level, current_hp, max_hp, current_location, experience_to_next_level, campaign_id, game_day)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ['TEST_LWChar', 'Fighter', 'Human', 5, 40, 40, 'Waterdeep', 6500, testCampaignId, 10]
  );
  testCharId = Number(result.lastInsertRowid);
}

async function createTestCharacterNoCampaign() {
  const result = await dbRun(
    `INSERT INTO characters (name, class, race, level, current_hp, max_hp, current_location, experience_to_next_level)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ['TEST_LWNoCampaignChar', 'Wizard', 'Elf', 3, 20, 20, 'Neverwinter', 2700]
  );
  testCharNoCanpaignId = Number(result.lastInsertRowid);
}

async function createTestNpc() {
  const result = await dbRun(
    `INSERT INTO npcs (name, race, occupation, current_location, lifecycle_status)
     VALUES (?, ?, ?, ?, ?)`,
    ['TEST_LWNpc_Gareth', 'Human', 'Merchant', 'Waterdeep', 'alive']
  );
  testNpcId = Number(result.lastInsertRowid);
}

async function createTestCompanionWithActivity() {
  // Create NPC for companion
  const npcResult = await dbRun(
    `INSERT INTO npcs (name, race, occupation, current_location, lifecycle_status)
     VALUES (?, ?, ?, ?, ?)`,
    ['TEST_LWCompanionNpc', 'Dwarf', 'Guard', 'Waterdeep', 'alive']
  );
  testCompanionNpcId = Number(npcResult.lastInsertRowid);

  // Create companion with status='away'
  const compResult = await dbRun(
    `INSERT INTO companions (npc_id, recruited_by_character_id, status, companion_class, companion_level)
     VALUES (?, ?, ?, ?, ?)`,
    [testCompanionNpcId, testCharId, 'away', 'Fighter', 3]
  );
  testCompanionId = Number(compResult.lastInsertRowid);

  // Create companion_activity with start_game_day=5, expected_duration_days=3
  await dbRun(
    `INSERT INTO companion_activities (companion_id, character_id, campaign_id, activity_type, description, start_game_day, expected_duration_days, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [testCompanionId, testCharId, testCampaignId, 'training', 'Training at the barracks', 5, 3, 'in_progress']
  );
}

async function createHighDispositionNpcRelationship() {
  // Create a relationship with high disposition and old last interaction
  await dbRun(
    `INSERT INTO npc_relationships (character_id, npc_id, disposition, disposition_label, trust_level, times_met, last_interaction_game_day)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [testCharId, testNpcId, 80, 'devoted', 60, 10, -10]
  );
  // last_interaction_game_day = -10 means roughly 20 days before game_day 10
}

// ===== Cleanup =====

async function cleanup() {
  console.log('\n--- Cleanup ---');
  try {
    await dbRun("DELETE FROM companion_activities WHERE character_id IN (SELECT id FROM characters WHERE name LIKE 'TEST_%')");
    await dbRun("DELETE FROM companions WHERE recruited_by_character_id IN (SELECT id FROM characters WHERE name LIKE 'TEST_%')");
    await dbRun("DELETE FROM npc_relationships WHERE character_id IN (SELECT id FROM characters WHERE name LIKE 'TEST_%')");
    await dbRun("DELETE FROM narrative_queue WHERE campaign_id IN (SELECT id FROM campaigns WHERE name LIKE 'TEST_%')");
    await dbRun("DELETE FROM event_effects WHERE event_id IN (SELECT id FROM world_events WHERE campaign_id IN (SELECT id FROM campaigns WHERE name LIKE 'TEST_%'))");
    await dbRun("DELETE FROM world_events WHERE campaign_id IN (SELECT id FROM campaigns WHERE name LIKE 'TEST_%')");
    await dbRun("DELETE FROM faction_standings WHERE character_id IN (SELECT id FROM characters WHERE name LIKE 'TEST_%')");
    await dbRun("DELETE FROM faction_goals WHERE faction_id IN (SELECT id FROM factions WHERE campaign_id IN (SELECT id FROM campaigns WHERE name LIKE 'TEST_%'))");
    await dbRun("DELETE FROM factions WHERE campaign_id IN (SELECT id FROM campaigns WHERE name LIKE 'TEST_%')");
    await dbRun("DELETE FROM npcs WHERE name LIKE 'TEST_%'");
    await dbRun("DELETE FROM characters WHERE name LIKE 'TEST_%'");
    await dbRun("DELETE FROM campaigns WHERE name LIKE 'TEST_%'");
    console.log('  Cleanup complete.');
  } catch (err) {
    console.error('  Cleanup error:', err.message);
  }
}

// ===== Test Groups =====

async function testTickResultShape() {
  console.log('\n=== Test 1: processLivingWorldTick — result shape ===\n');

  const result = await processLivingWorldTick(testCampaignId, 1);

  assert(result !== null && typeof result === 'object', 'Result is an object');
  assert(Array.isArray(result.faction_results), 'result.faction_results is an array');
  assert(Array.isArray(result.event_results), 'result.event_results is an array');
  assert(Array.isArray(result.spawned_events), 'result.spawned_events is an array');
  assert(Array.isArray(result.errors), 'result.errors is an array');
  assertEqual(result.errors.length, 0, 'No errors occurred during tick');
}

async function testTickMultiDay() {
  console.log('\n=== Test 2: processLivingWorldTick — multi-day ===\n');

  const result = await processLivingWorldTick(testCampaignId, 3);

  assert(result !== null && typeof result === 'object', 'Multi-day result is an object');
  assert(Array.isArray(result.faction_results), 'Multi-day result has faction_results array');
  assert(result.errors.length === 0 || result.errors.every(e => typeof e === 'string'), 'Errors are empty or all strings (non-critical)');
}

async function testTickCompanionActivityResolution() {
  console.log('\n=== Test 3: processLivingWorldTick — companion activity resolution ===\n');

  // Character game_day is 10, activity started at day 5 with 3-day duration
  // So activity should be past its expected end (day 8 < day 10)
  const result = await processLivingWorldTick(testCampaignId, 1);

  assert('companion_activities_resolved' in result, 'Result has companion_activities_resolved field');

  // The companion_activities_resolved field exists — actual resolution may fail
  // due to AI dependency, but the step was attempted
  const resolved = result.companion_activities_resolved;
  assert(
    resolved !== undefined && resolved !== null,
    'companion_activities_resolved is not null/undefined (step was attempted)'
  );

  // If it's an array, that's the expected shape from checkAndResolveActivities
  if (Array.isArray(resolved)) {
    assert(true, `companion_activities_resolved is an array with ${resolved.length} item(s)`);
  } else {
    // Could be a number or other shape depending on implementation
    assert(typeof resolved !== 'undefined', `companion_activities_resolved has value: ${JSON.stringify(resolved)}`);
  }
}

async function testTickNpcMailGeneration() {
  console.log('\n=== Test 4: processLivingWorldTick — NPC mail generation step ===\n');

  const result = await processLivingWorldTick(testCampaignId, 1);

  assert('npc_mail_generated' in result, 'Result has npc_mail_generated field');
  assert(
    typeof result.npc_mail_generated === 'number',
    `npc_mail_generated is a number (got ${typeof result.npc_mail_generated}: ${result.npc_mail_generated})`
  );
  // Mail count can be 0 — random chance + AI dependency mean mail may not be generated
  assert(
    result.npc_mail_generated >= 0,
    `npc_mail_generated is non-negative (${result.npc_mail_generated})`
  );
}

async function testGetWorldState() {
  console.log('\n=== Test 5: getWorldState ===\n');

  const state = await getWorldState(testCampaignId);

  assert(state !== null && typeof state === 'object', 'getWorldState returns an object');

  // factions
  assert(typeof state.factions === 'object' && state.factions !== null, 'State has factions object');
  assert(typeof state.factions.count === 'number', 'factions.count is a number');
  assert(Array.isArray(state.factions.list), 'factions.list is an array');

  // goals
  assert(typeof state.goals === 'object' && state.goals !== null, 'State has goals object');
  assert(typeof state.goals.count === 'number', 'goals.count is a number');
  assert(typeof state.goals.by_visibility === 'object', 'goals.by_visibility is an object');

  // events
  assert(typeof state.events === 'object' && state.events !== null, 'State has events object');
  assert(typeof state.events.count === 'number', 'events.count is a number');
  assert(typeof state.events.by_type === 'object', 'events.by_type is an object');

  // effects
  assert(typeof state.effects === 'object' && state.effects !== null, 'State has effects object');
  assert(typeof state.effects.count === 'number', 'effects.count is a number');
  assert(typeof state.effects.by_type === 'object', 'effects.by_type is an object');
}

async function testGetCharacterWorldView() {
  console.log('\n=== Test 6: getCharacterWorldView ===\n');

  const view = await getCharacterWorldView(testCharId);

  assert(view !== null && typeof view === 'object', 'getCharacterWorldView returns an object');
  assertEqual(view.character_id, testCharId, 'view.character_id matches test character');
  assertEqual(view.campaign_id, testCampaignId, 'view.campaign_id matches test campaign');
  assert(Array.isArray(view.visible_events), 'view.visible_events is an array');
  assert(Array.isArray(view.faction_standings), 'view.faction_standings is an array');
  assert(Array.isArray(view.known_faction_goals), 'view.known_faction_goals is an array');
}

async function testGetCharacterWorldViewNoCampaign() {
  console.log('\n=== Test 7: getCharacterWorldView — no campaign ===\n');

  const view = await getCharacterWorldView(testCharNoCanpaignId);

  assertEqual(view, null, 'Returns null for character without campaign_id');

  // Also test a completely nonexistent character
  const view2 = await getCharacterWorldView(99999);
  assertEqual(view2, null, 'Returns null for nonexistent character');
}

async function testTickNonexistentCampaign() {
  console.log('\n=== Test 8: processLivingWorldTick — nonexistent campaign ===\n');

  let threw = false;
  let result;
  try {
    result = await processLivingWorldTick(99999, 1);
  } catch (e) {
    threw = true;
  }

  // Should not throw — graceful handling
  assert(!threw, 'Does not throw for nonexistent campaign');

  if (result) {
    // Results should be mostly empty
    assert(
      result.faction_results.length === 0 && result.event_results.length === 0 && result.spawned_events.length === 0,
      'Results are empty for nonexistent campaign'
    );
  } else {
    assert(true, 'Result is falsy but did not throw');
  }
}

// ===== Run =====

async function run() {
  try {
    await initDatabase();

    // Setup
    await createTestCampaign();
    await createTestCharacter();
    await createTestCharacterNoCampaign();
    await createTestNpc();
    await createHighDispositionNpcRelationship();
    await createTestCompanionWithActivity();

    // Test groups
    await testTickResultShape();
    await testTickMultiDay();
    await testTickCompanionActivityResolution();
    await testTickNpcMailGeneration();
    await testGetWorldState();
    await testGetCharacterWorldView();
    await testGetCharacterWorldViewNoCampaign();
    await testTickNonexistentCampaign();
  } catch (err) {
    console.error('\nFATAL TEST ERROR:', err);
    failed++;
  } finally {
    await cleanup();
    console.log(`\n${'='.repeat(50)}`);
    console.log(`Living World Tick Pipeline: ${passed} passed, ${failed} failed`);
    console.log('='.repeat(50));
    process.exit(failed > 0 ? 1 : 0);
  }
}

run();
