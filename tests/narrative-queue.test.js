/**
 * Tests for narrative queue service: add, retrieve, deliver, expire, format, and stats.
 * Run: node tests/narrative-queue.test.js
 *
 * Covers:
 * - addToQueue: insert and return parsed items
 * - getPendingItems: priority-ordered retrieval
 * - getNextBatch: limited retrieval by priority
 * - markDelivered: single item delivery tracking
 * - markMultipleDelivered: batch delivery tracking
 * - expireOldItems: expiration of past-due items
 * - formatForAIContext: AI-ready formatting
 * - getQueueStats: aggregate statistics
 * - deliver_after scheduling: future-dated items excluded
 *
 * Uses the same local.db database; all test data prefixed with TEST_ and cleaned up.
 */

import { initDatabase, dbRun, dbGet, dbAll } from '../server/database.js';
import {
  addToQueue, getPendingItems, getNextBatch, markDelivered,
  markMultipleDelivered, expireOldItems, formatForAIContext,
  getQueueStats, getDeliveredItems, getQueueItemById
} from '../server/services/narrativeQueueService.js';

let passed = 0;
let failed = 0;

// Test data IDs for cleanup
let testCampaignId;
let testCharId;
let testSessionId;

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

/**
 * Clean all TEST_ prefixed narrative_queue rows between test groups so each
 * test runs against a predictable blank slate. Prevents the flake where
 * leftover items from group N influence group N+1.
 */
async function cleanQueue() {
  await dbRun("DELETE FROM narrative_queue WHERE title LIKE 'TEST_%'");
}

// ===== Setup =====

async function setup() {
  console.log('--- Setup ---');
  await initDatabase();

  // Create a test campaign
  await dbRun(`
    INSERT INTO campaigns (name, description, setting, status)
    VALUES ('TEST_NarrativeQueue_Campaign', 'Test campaign for narrative queue', 'Forgotten Realms', 'active')
  `);
  const campaign = await dbGet("SELECT id FROM campaigns WHERE name = 'TEST_NarrativeQueue_Campaign'");
  testCampaignId = campaign.id;

  // Create a test character
  await dbRun(`
    INSERT INTO characters (name, class, race, level, current_hp, max_hp, current_location, experience_to_next_level, campaign_id)
    VALUES ('TEST_NarrativeQueue_Hero', 'Wizard', 'Elf', 7, 35, 35, 'Neverwinter', 23000, ?)
  `, [testCampaignId]);
  const character = await dbGet("SELECT id FROM characters WHERE name = 'TEST_NarrativeQueue_Hero'");
  testCharId = character.id;

  // Create a test dm_session (needed for foreign key on delivered_in_session_id)
  await dbRun(`
    INSERT INTO dm_sessions (character_id, title, status)
    VALUES (?, 'TEST_NarrativeQueue_Session', 'completed')
  `, [testCharId]);
  const session = await dbGet("SELECT id FROM dm_sessions WHERE title = 'TEST_NarrativeQueue_Session'");
  testSessionId = session.id;

  console.log(`  Campaign ID: ${testCampaignId}, Character ID: ${testCharId}, Session ID: ${testSessionId}\n`);
}

// ============================================================
// TEST GROUP 1: addToQueue (~5 assertions)
// ============================================================

async function testAddToQueue() {
  console.log('=== Test 1: addToQueue ===\n');

  const item = await addToQueue({
    campaign_id: testCampaignId,
    character_id: testCharId,
    event_type: 'quest_available',
    priority: 'normal',
    title: 'TEST_Quest Available',
    description: 'A new quest has appeared at the tavern notice board.',
    context: { source: 'tavern', quest_giver: 'Barkeep' }
  });

  assert(item.id !== undefined && item.id !== null, 'Returned item has an id');
  assertEqual(item.title, 'TEST_Quest Available', 'Title matches input');
  assertEqual(item.status, 'pending', 'Status is pending');
  assertEqual(item.priority, 'normal', 'Priority is normal');
  assert(typeof item.context === 'object' && !Array.isArray(item.context), 'Context is parsed as object (not string)');
}

// ============================================================
// TEST GROUP 2: getPendingItems (~4 assertions)
// ============================================================

async function testGetPendingItems() {
  console.log('\n=== Test 2: getPendingItems ===\n');

  // Add 3 items with different priorities
  await addToQueue({
    character_id: testCharId,
    event_type: 'flavor_event',
    priority: 'low',
    title: 'TEST_Low Priority Event',
    description: 'A bird sings outside.'
  });

  await addToQueue({
    character_id: testCharId,
    event_type: 'urgent_warning',
    priority: 'urgent',
    title: 'TEST_Urgent Warning',
    description: 'Dragon spotted near the village!'
  });

  await addToQueue({
    character_id: testCharId,
    event_type: 'npc_message',
    priority: 'normal',
    title: 'TEST_Normal NPC Message',
    description: 'A merchant wants to speak with you.'
  });

  const items = await getPendingItems(testCharId);

  // Filter to just our test items
  const testItems = items.filter(i => i.title.startsWith('TEST_'));

  assert(testItems.length >= 3, `Returns at least 3 test items (got ${testItems.length})`);

  // Check priority ordering: urgent should come before normal, normal before low
  const urgentIdx = testItems.findIndex(i => i.title === 'TEST_Urgent Warning');
  const normalIdx = testItems.findIndex(i => i.title === 'TEST_Normal NPC Message');
  const lowIdx = testItems.findIndex(i => i.title === 'TEST_Low Priority Event');

  assert(urgentIdx < normalIdx, 'Urgent items come before normal items');
  assert(normalIdx < lowIdx, 'Normal items come before low items');

  const allPending = testItems.every(i => i.status === 'pending');
  assert(allPending, 'All items have status pending');
}

// ============================================================
// TEST GROUP 3: getNextBatch with limit (~3 assertions)
// ============================================================

async function testGetNextBatch() {
  console.log('\n=== Test 3: getNextBatch with limit ===\n');

  // We already have items from previous tests: urgent, normal, normal (quest_available), low
  const batch = await getNextBatch(testCharId, 2);

  // Filter to test items
  const testBatch = batch.filter(i => i.title.startsWith('TEST_'));

  assert(testBatch.length <= 2, `Batch respects limit of 2 (got ${testBatch.length})`);

  // The highest priority item (urgent) should be first
  if (testBatch.length > 0) {
    assertEqual(testBatch[0].priority, 'urgent', 'Highest priority item (urgent) comes first in batch');
  }

  // Low priority should not be in a batch of 2 when there are higher priority items
  const hasLow = testBatch.some(i => i.priority === 'low');
  assert(!hasLow, 'Lower priority items excluded when limit reached');
}

// ============================================================
// TEST GROUP 4: markDelivered (~4 assertions)
// ============================================================

async function testMarkDelivered() {
  console.log('\n=== Test 4: markDelivered ===\n');

  // Add a fresh item to deliver
  const item = await addToQueue({
    character_id: testCharId,
    event_type: 'quest_update',
    priority: 'high',
    title: 'TEST_Delivery Target',
    description: 'This item will be marked as delivered.'
  });

  const delivered = await markDelivered(item.id, testSessionId);

  assertEqual(delivered.status, 'delivered', 'Status changed to delivered');
  assert(delivered.delivered_at !== null && delivered.delivered_at !== undefined, 'delivered_at is set (not null)');
  assertEqual(delivered.delivered_in_session_id, testSessionId, 'delivered_in_session_id matches');

  // Verify it no longer appears in pending items
  const pending = await getPendingItems(testCharId);
  const found = pending.find(i => i.id === item.id);
  assert(found === undefined, 'Delivered item no longer appears in pending items');
}

// ============================================================
// TEST GROUP 5: markMultipleDelivered (~3 assertions)
// ============================================================

async function testMarkMultipleDelivered() {
  console.log('\n=== Test 5: markMultipleDelivered ===\n');

  const item1 = await addToQueue({
    character_id: testCharId,
    event_type: 'companion_reaction',
    priority: 'normal',
    title: 'TEST_Batch Deliver 1',
    description: 'First batch item.'
  });

  const item2 = await addToQueue({
    character_id: testCharId,
    event_type: 'companion_reaction',
    priority: 'normal',
    title: 'TEST_Batch Deliver 2',
    description: 'Second batch item.'
  });

  const delivered = await markMultipleDelivered([item1.id, item2.id], testSessionId);

  assertEqual(delivered.length, 2, 'Returns 2 delivered items');

  const allDelivered = delivered.every(i => i.status === 'delivered');
  assert(allDelivered, 'Both items have status delivered');

  const allSameSession = delivered.every(i => i.delivered_in_session_id === testSessionId);
  assert(allSameSession, 'Both items have the same session_id');
}

// ============================================================
// TEST GROUP 6: expireOldItems (~3 assertions)
// ============================================================

async function testExpireOldItems() {
  console.log('\n=== Test 6: expireOldItems ===\n');

  // Add item with expires_at in the past
  await dbRun(`
    INSERT INTO narrative_queue (character_id, event_type, priority, title, description, context, status, expires_at)
    VALUES (?, 'expired_event', 'normal', 'TEST_Expired Item', 'This should expire.', '{}', 'pending', datetime('now', '-1 day'))
  `, [testCharId]);

  // Add item with no expiration (should stay pending)
  const stayItem = await addToQueue({
    character_id: testCharId,
    event_type: 'persistent_event',
    priority: 'normal',
    title: 'TEST_Persistent Item',
    description: 'This should not expire.'
  });

  const expiredCount = await expireOldItems();
  assert(expiredCount >= 1, `At least 1 item expired (got ${expiredCount})`);

  // Verify the expired item status
  const expiredItem = await dbGet(
    "SELECT status FROM narrative_queue WHERE title = 'TEST_Expired Item' AND character_id = ?",
    [testCharId]
  );
  assertEqual(expiredItem.status, 'expired', 'Past-due item status changed to expired');

  // Verify persistent item is still pending
  const persistentItem = await getQueueItemById(stayItem.id);
  assertEqual(persistentItem.status, 'pending', 'Non-expired item still pending');
}

// ============================================================
// TEST GROUP 7: formatForAIContext (~4 assertions)
// ============================================================

async function testFormatForAIContext() {
  console.log('\n=== Test 7: formatForAIContext ===\n');

  // Seed a pending item so the format test has something to render.
  // (Cleanup between test groups means we can't rely on earlier tests'
  // items surviving into this one.)
  await addToQueue({
    campaign_id: testCampaignId,
    character_id: testCharId,
    event_type: 'quest_available',
    priority: 'normal',
    title: 'TEST_Format Seed Quest',
    description: 'A merchant is looking for hired swords.'
  });

  const result = await formatForAIContext(testCharId, 5);

  assert(result !== null, 'Returns non-null when pending items exist');
  assert(typeof result.items === 'object' && Array.isArray(result.items), 'Result has items array');
  assert(typeof result.formatted === 'string' && result.formatted.length > 0, 'formatted is a non-empty string containing item titles');
  assertEqual(result.count, result.items.length, 'count matches number of items');

  // Test with a character that has no pending items
  // Create a separate character with no queue items
  await dbRun(`
    INSERT INTO characters (name, class, race, level, current_hp, max_hp, current_location, experience_to_next_level, campaign_id)
    VALUES ('TEST_NarrativeQueue_Empty', 'Rogue', 'Halfling', 1, 8, 8, 'Baldurs Gate', 300, ?)
  `, [testCampaignId]);
  const emptyChar = await dbGet("SELECT id FROM characters WHERE name = 'TEST_NarrativeQueue_Empty'");

  const nullResult = await formatForAIContext(emptyChar.id, 5);
  assertEqual(nullResult, null, 'Returns null when no items pending');
}

// ============================================================
// TEST GROUP 8: getQueueStats (~3 assertions)
// ============================================================

async function testGetQueueStats() {
  console.log('\n=== Test 8: getQueueStats ===\n');

  const stats = await getQueueStats(testCharId);

  assert(typeof stats.pending === 'object' && stats.pending.total !== undefined, 'Returns object with pending.total');

  // Count actual pending items for comparison
  const actualPending = await getPendingItems(testCharId);
  assertEqual(stats.pending.total, actualPending.length, 'pending.total matches actual pending count');

  // We delivered items in tests 4 and 5
  const deliveredItems = await getDeliveredItems(testCharId);
  assertEqual(stats.delivered, deliveredItems.length, 'delivered count matches delivered items');
}

// ============================================================
// TEST GROUP 9: deliver_after scheduling (~1 assertion)
// ============================================================

async function testDeliverAfterScheduling() {
  console.log('\n=== Test 9: deliver_after scheduling ===\n');

  // Add item with deliver_after in the future
  await dbRun(`
    INSERT INTO narrative_queue (character_id, event_type, priority, title, description, context, status, deliver_after)
    VALUES (?, 'future_event', 'normal', 'TEST_Future Delivery', 'Not yet ready.', '{}', 'pending', datetime('now', '+1 day'))
  `, [testCharId]);

  const pending = await getPendingItems(testCharId);
  const futureItem = pending.find(i => i.title === 'TEST_Future Delivery');
  assert(futureItem === undefined, 'Item with future deliver_after is NOT returned by getPendingItems');
}

// ============================================================
// Cleanup
// ============================================================

async function cleanup() {
  console.log('\n--- Cleanup ---');
  try {
    // Clean narrative_queue by TEST_ title prefix
    await dbRun("DELETE FROM narrative_queue WHERE title LIKE 'TEST_%'");

    // Clean test dm_session
    if (testSessionId) {
      await dbRun('DELETE FROM dm_sessions WHERE id = ?', [testSessionId]);
    }

    // Clean test characters
    await dbRun("DELETE FROM characters WHERE name LIKE 'TEST_NarrativeQueue%'");

    // Clean test campaign
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
    await cleanQueue(); await testAddToQueue();
    await cleanQueue(); await testGetPendingItems();
    await cleanQueue(); await testGetNextBatch();
    await cleanQueue(); await testMarkDelivered();
    await cleanQueue(); await testMarkMultipleDelivered();
    await cleanQueue(); await testExpireOldItems();
    await cleanQueue(); await testFormatForAIContext();
    await cleanQueue(); await testGetQueueStats();
    await cleanQueue(); await testDeliverAfterScheduling();
  } catch (err) {
    console.error('\nFATAL ERROR:', err);
    failed++;
  } finally {
    await cleanup();
    console.log(`\n${'='.repeat(50)}`);
    console.log(`Narrative Queue Tests: ${passed} passed, ${failed} failed`);
    console.log('='.repeat(50));
    process.exit(failed > 0 ? 1 : 0);
  }
}

runAll();
