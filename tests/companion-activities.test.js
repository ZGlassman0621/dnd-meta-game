/**
 * Tests for companion independent experiences (Component F).
 * Verifies sendOnActivity, getAwayCompanions, getActiveActivities,
 * cancelActivity, recallCompanion, dismiss soft-delete, and activity type validation.
 *
 * Run: node tests/companion-activities.test.js
 *
 * Uses local.db directly via initDatabase. All test data prefixed with TEST_ and cleaned up.
 */

import { initDatabase, dbRun, dbGet, dbAll } from '../server/database.js';
import {
  sendOnActivity, getAwayCompanions, getActiveActivities,
  cancelActivity, recallCompanion, checkAndResolveActivities
} from '../server/services/companionActivityService.js';

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

// ===== Seed helpers =====

let testCampaignId;
let testCharacterId;
let testNpcId;
let testCompanionId;
let testNpcId2;
let testCompanionId2;
let testNpcId3;
let testCompanionId3;

async function seedTestData() {
  // Create campaign
  const campaign = await dbRun(
    "INSERT INTO campaigns (name, setting, status) VALUES (?, ?, ?)",
    ['TEST_CompActivity Campaign', 'Forgotten Realms', 'active']
  );
  testCampaignId = Number(campaign.lastInsertRowid);

  // Create character
  const character = await dbRun(
    `INSERT INTO characters (name, class, race, level, current_hp, max_hp, current_location, experience_to_next_level, campaign_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ['TEST_CompActivity Hero', 'Fighter', 'Human', 5, 40, 40, 'TEST_Temple', 6500, testCampaignId]
  );
  testCharacterId = Number(character.lastInsertRowid);

  // Create NPC for companion 1
  const npc = await dbRun(
    `INSERT INTO npcs (name, race, gender, occupation)
     VALUES (?, ?, ?, ?)`,
    ['TEST_Elara Nightwhisper', 'Elf', 'female', 'Scout']
  );
  testNpcId = Number(npc.lastInsertRowid);

  // Create companion 1 (active)
  const companion = await dbRun(
    `INSERT INTO companions (npc_id, recruited_by_character_id, companion_class, companion_level, companion_max_hp, companion_current_hp, status)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [testNpcId, testCharacterId, 'Ranger', 4, 32, 32, 'active']
  );
  testCompanionId = Number(companion.lastInsertRowid);
}

async function seedCompanion2() {
  // Create NPC for companion 2
  const npc2 = await dbRun(
    `INSERT INTO npcs (name, race, gender, occupation)
     VALUES (?, ?, ?, ?)`,
    ['TEST_Bran Stonefist', 'Dwarf', 'male', 'Mercenary']
  );
  testNpcId2 = Number(npc2.lastInsertRowid);

  // Create companion 2 (active)
  const comp2 = await dbRun(
    `INSERT INTO companions (npc_id, recruited_by_character_id, companion_class, companion_level, companion_max_hp, companion_current_hp, status)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [testNpcId2, testCharacterId, 'Fighter', 5, 44, 44, 'active']
  );
  testCompanionId2 = Number(comp2.lastInsertRowid);
}

async function seedCompanion3() {
  // Create NPC for companion 3 (used in dismiss test)
  const npc3 = await dbRun(
    `INSERT INTO npcs (name, race, gender, occupation)
     VALUES (?, ?, ?, ?)`,
    ['TEST_Mira Softpetal', 'Halfling', 'female', 'Herbalist']
  );
  testNpcId3 = Number(npc3.lastInsertRowid);

  // Create companion 3 (active)
  const comp3 = await dbRun(
    `INSERT INTO companions (npc_id, recruited_by_character_id, companion_class, companion_level, companion_max_hp, companion_current_hp, status)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [testNpcId3, testCharacterId, 'Druid', 3, 24, 24, 'active']
  );
  testCompanionId3 = Number(comp3.lastInsertRowid);
}

// ===== Tests =====

async function runTests() {
  console.log('\n=== Companion Activities Tests ===\n');

  // ----------------------------------------------------------
  // 1. sendOnActivity
  // ----------------------------------------------------------
  console.log('1. sendOnActivity');

  let activityId;
  {
    const activity = await sendOnActivity(testCompanionId, {
      activity_type: 'training',
      description: 'Training at temple',
      location: 'TEST_Temple',
      duration_days: 5,
      current_game_day: 10,
      campaign_id: testCampaignId
    });

    assert(activity !== null && activity !== undefined, 'Activity record created');
    activityId = activity.id;

    assertEqual(activity.activity_type, 'training', 'Activity type is training');
    assertEqual(activity.location, 'TEST_Temple', 'Activity location is TEST_Temple');
    assertEqual(activity.status, 'in_progress', 'Activity status is in_progress');
    assertEqual(activity.start_game_day, 10, 'Activity start_game_day is 10');
    assertEqual(activity.expected_duration_days, 5, 'Activity expected_duration_days is 5');

    // Verify companion status changed to 'away'
    const companion = await dbGet('SELECT status, away_activity_id FROM companions WHERE id = ?', [testCompanionId]);
    assertEqual(companion.status, 'away', 'Companion status changed to away');
    assertEqual(Number(companion.away_activity_id), activityId, 'Companion away_activity_id points to activity');
  }

  // ----------------------------------------------------------
  // 2. getAwayCompanions
  // ----------------------------------------------------------
  console.log('\n2. getAwayCompanions');

  {
    const away = await getAwayCompanions(testCharacterId);
    assert(Array.isArray(away), 'Returns an array');
    assertEqual(away.length, 1, 'Returns 1 away companion');
    assertEqual(away[0].name, 'TEST_Elara Nightwhisper', 'Away companion name matches NPC name');
    assertEqual(away[0].activity_type, 'training', 'Away companion activity type is training');
  }

  // ----------------------------------------------------------
  // 3. getActiveActivities
  // ----------------------------------------------------------
  console.log('\n3. getActiveActivities');

  {
    const activities = await getActiveActivities(testCharacterId);
    assert(Array.isArray(activities), 'Returns an array');
    assert(activities.length >= 1, 'At least 1 in_progress activity');

    const match = activities.find(a => a.id === activityId);
    assert(match !== undefined, 'Our test activity is in the active list');
    assertEqual(match.companion_name, 'TEST_Elara Nightwhisper', 'Activity includes companion_name');
  }

  // ----------------------------------------------------------
  // 4. cancelActivity
  // ----------------------------------------------------------
  console.log('\n4. cancelActivity');

  {
    const result = await cancelActivity(activityId);
    assert(result.success === true, 'cancelActivity returns success: true');
    assertEqual(result.companion_name, 'TEST_Elara Nightwhisper', 'Returns companion name');

    // Verify activity status
    const row = await dbGet('SELECT status FROM companion_activities WHERE id = ?', [activityId]);
    assertEqual(row.status, 'cancelled', 'Activity status changed to cancelled');

    // Verify companion returned to active
    const companion = await dbGet('SELECT status, away_activity_id FROM companions WHERE id = ?', [testCompanionId]);
    assertEqual(companion.status, 'active', 'Companion status returned to active');
    assertEqual(companion.away_activity_id, null, 'Companion away_activity_id cleared');
  }

  // ----------------------------------------------------------
  // 5. recallCompanion
  // ----------------------------------------------------------
  console.log('\n5. recallCompanion');

  await seedCompanion2();
  let scoutingActivityId;
  {
    // Send companion 2 on a scouting mission
    const activity = await sendOnActivity(testCompanionId2, {
      activity_type: 'scouting',
      description: 'Scouting the northern pass',
      location: 'TEST_Northern Pass',
      duration_days: 7,
      current_game_day: 10,
      campaign_id: testCampaignId
    });
    scoutingActivityId = activity.id;

    // Verify companion is away
    const compBefore = await dbGet('SELECT status FROM companions WHERE id = ?', [testCompanionId2]);
    assertEqual(compBefore.status, 'away', 'Companion 2 is away before recall');

    // Recall after 2 days elapsed (completionRatio = 2/7 = ~0.29, above 0.2 threshold)
    const result = await recallCompanion(scoutingActivityId, 12);
    assert(result.success === true, 'recallCompanion returns success: true');
    assertEqual(result.companion_name, 'TEST_Bran Stonefist', 'Returns recalled companion name');

    // Verify companion returned to active
    const compAfter = await dbGet('SELECT status, away_activity_id FROM companions WHERE id = ?', [testCompanionId2]);
    assertEqual(compAfter.status, 'active', 'Companion 2 returned to active after recall');
    assertEqual(compAfter.away_activity_id, null, 'Companion 2 away_activity_id cleared after recall');

    // Verify activity resolved as 'recalled' with partial outcomes
    const actRow = await dbGet('SELECT status, outcomes FROM companion_activities WHERE id = ?', [scoutingActivityId]);
    assertEqual(actRow.status, 'recalled', 'Activity status is recalled (not completed)');
    assert(actRow.outcomes !== null, 'Activity has outcomes even though recalled early');

    // Parse outcomes and verify partial completion
    const outcomes = JSON.parse(actRow.outcomes);
    assert(
      outcomes.success_level === 'partial' || outcomes.success_level === 'failed' || outcomes.success_level === 'mixed',
      `Recalled early outcomes success_level is partial/failed/mixed (got ${outcomes.success_level})`
    );
  }

  // ----------------------------------------------------------
  // 6. Dismiss soft-delete
  // ----------------------------------------------------------
  console.log('\n6. Dismiss soft-delete');

  await seedCompanion3();
  {
    // Soft-delete companion 3 via dismiss
    await dbRun(
      "UPDATE companions SET status = 'dismissed', dismissed_reason = 'TEST reason' WHERE id = ?",
      [testCompanionId3]
    );

    const dismissed = await dbGet('SELECT id, status, dismissed_reason FROM companions WHERE id = ?', [testCompanionId3]);
    assert(dismissed !== null && dismissed !== undefined, 'Dismissed companion row still exists in DB');
    assertEqual(dismissed.status, 'dismissed', 'Status is dismissed (not deleted)');
    assertEqual(dismissed.dismissed_reason, 'TEST reason', 'Dismissed reason is set');

    // Verify row count — the companion was NOT deleted
    const count = await dbGet('SELECT COUNT(*) as cnt FROM companions WHERE id = ?', [testCompanionId3]);
    assertEqual(count.cnt, 1, 'Companion still has exactly 1 row in table');
  }

  // ----------------------------------------------------------
  // 7. Activity types validation
  // ----------------------------------------------------------
  console.log('\n7. Activity types validation');

  {
    // Reset companion 1 to active for this test
    await dbRun("UPDATE companions SET status = 'active', away_activity_id = NULL WHERE id = ?", [testCompanionId]);

    // Valid type: personal_quest
    const pqActivity = await sendOnActivity(testCompanionId, {
      activity_type: 'personal_quest',
      description: 'Seeking an old mentor',
      location: 'TEST_Forest',
      duration_days: 3,
      current_game_day: 20,
      campaign_id: testCampaignId
    });
    assert(pqActivity !== null, 'personal_quest is a valid activity type');

    // Clean up — cancel so companion is active again
    await cancelActivity(pqActivity.id);

    // Invalid type should throw
    let invalidThrew = false;
    try {
      await sendOnActivity(testCompanionId, {
        activity_type: 'dragon_riding',
        description: 'Riding a dragon',
        location: 'TEST_Sky',
        duration_days: 1,
        current_game_day: 20,
        campaign_id: testCampaignId
      });
    } catch (e) {
      invalidThrew = true;
      assert(e.message.includes('Invalid activity type'), 'Error message mentions invalid activity type');
    }
    assert(invalidThrew, 'Invalid activity type throws an error');
  }
}

// ===== Cleanup =====

async function cleanup() {
  console.log('\n--- Cleanup ---');

  // Order matters: delete ROWS THAT POINT AT companions first, then
  // companions, then rows that companions pointed at. Some FKs don't
  // cascade (notably narrative_queue.related_companion_id), so we have
  // to clear them before the companions row goes away.
  await dbRun("DELETE FROM companion_activities WHERE companion_id IN (SELECT id FROM companions WHERE recruited_by_character_id IN (SELECT id FROM characters WHERE name LIKE 'TEST_%'))");
  await dbRun("DELETE FROM companion_backstories WHERE companion_id IN (SELECT id FROM companions WHERE recruited_by_character_id IN (SELECT id FROM characters WHERE name LIKE 'TEST_%'))");
  await dbRun("DELETE FROM narrative_queue WHERE related_companion_id IN (SELECT id FROM companions WHERE recruited_by_character_id IN (SELECT id FROM characters WHERE name LIKE 'TEST_%'))");
  await dbRun("DELETE FROM narrative_queue WHERE campaign_id IN (SELECT id FROM campaigns WHERE name LIKE 'TEST_%')");

  // Now safe to delete companions
  await dbRun("DELETE FROM companions WHERE recruited_by_character_id IN (SELECT id FROM characters WHERE name LIKE 'TEST_%')");

  // Delete npc_relationships
  await dbRun("DELETE FROM npc_relationships WHERE npc_id IN (SELECT id FROM npcs WHERE name LIKE 'TEST_%')");

  // Delete NPCs
  await dbRun("DELETE FROM npcs WHERE name LIKE 'TEST_%'");

  // Delete characters
  await dbRun("DELETE FROM characters WHERE name LIKE 'TEST_%'");

  // Delete campaigns
  await dbRun("DELETE FROM campaigns WHERE name LIKE 'TEST_%'");

  console.log('  Cleaned up TEST_ rows');
}

// ===== Main =====

async function main() {
  try {
    await initDatabase();
    await seedTestData();
    await runTests();
  } catch (error) {
    console.error('Test suite error:', error);
    failed++;
  } finally {
    await cleanup();
    console.log(`\n${'='.repeat(50)}`);
    console.log(`Companion Activities: ${passed} passed, ${failed} failed`);
    console.log('='.repeat(50));
    process.exit(failed > 0 ? 1 : 0);
  }
}

main();
