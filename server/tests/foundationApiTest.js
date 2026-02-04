/**
 * Foundation Layer API Tests
 *
 * Tests the Phase F endpoints:
 * - Narrative Queue API
 * - Character-Campaign association
 * - Character quest tracking
 */

import { dbAll, dbGet, dbRun } from '../database.js';
import * as campaignService from '../services/campaignService.js';
import * as questService from '../services/questService.js';
import * as narrativeQueueService from '../services/narrativeQueueService.js';

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
    name: 'API Test Campaign',
    description: 'Campaign for testing API endpoints',
    setting: 'Forgotten Realms',
    tone: 'heroic fantasy'
  });
  console.log(`  Created campaign: ${testData.campaign.name} (ID: ${testData.campaign.id})`);

  // Create test character
  const charResult = await dbRun(`
    INSERT INTO characters (name, race, class, level, experience, experience_to_next_level, max_hp, current_hp, current_location)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, ['API Test Hero', 'Elf', 'Wizard', 3, 900, 2700, 18, 18, 'Waterdeep']);
  testData.character = await dbGet('SELECT * FROM characters WHERE id = ?', [charResult.lastInsertRowid]);
  console.log(`  Created character: ${testData.character.name} (ID: ${testData.character.id})`);

  // Create test quest
  testData.quest = await questService.createQuest({
    campaign_id: testData.campaign.id,
    character_id: testData.character.id,
    quest_type: 'side',
    title: 'API Test Quest',
    premise: 'A test quest for API validation',
    status: 'active',
    priority: 'normal',
    stages: [
      { name: 'Stage 1', description: 'First stage' },
      { name: 'Stage 2', description: 'Second stage' }
    ]
  });
  console.log(`  Created quest: ${testData.quest.title} (ID: ${testData.quest.id})`);
}

async function cleanupTestData() {
  console.log('\n🧹 Cleaning up test data...');

  // Clean up narrative queue items first (references character)
  if (testData.character) {
    await dbRun('DELETE FROM narrative_queue WHERE character_id = ?', [testData.character.id]);
  }

  // Delete quest requirements (references quest)
  if (testData.quest) {
    await dbRun('DELETE FROM quest_requirements WHERE quest_id = ?', [testData.quest.id]);
  }

  // Delete test quest (references character and campaign)
  if (testData.quest) {
    await dbRun('DELETE FROM quests WHERE id = ?', [testData.quest.id]);
  }

  // Delete test character (references campaign)
  if (testData.character) {
    await dbRun('DELETE FROM characters WHERE id = ?', [testData.character.id]);
  }

  // Delete test campaign (last, as others reference it)
  if (testData.campaign) {
    await campaignService.deleteCampaign(testData.campaign.id);
  }

  console.log('  Cleanup complete');
}

async function runTests() {
  console.log('🧪 FOUNDATION LAYER API TESTS');
  console.log('\n==================================================\n');

  await setupTestData();

  console.log('\n📋 Running tests...\n');

  // ============================================================
  // CHARACTER-CAMPAIGN ASSOCIATION TESTS
  // ============================================================

  await test('Character starts without campaign assignment', async () => {
    const char = await dbGet('SELECT campaign_id FROM characters WHERE id = ?', [testData.character.id]);
    assert(char.campaign_id === null, 'Character should have no campaign initially');
  });

  await test('Can assign character to campaign', async () => {
    await dbRun('UPDATE characters SET campaign_id = ? WHERE id = ?',
      [testData.campaign.id, testData.character.id]);

    const char = await dbGet('SELECT campaign_id FROM characters WHERE id = ?', [testData.character.id]);
    assert(char.campaign_id === testData.campaign.id, 'Campaign should be assigned');
  });

  await test('Campaign characters endpoint returns assigned character', async () => {
    const characters = await campaignService.getCampaignCharacters(testData.campaign.id);
    const found = characters.find(c => c.id === testData.character.id);
    assert(found, 'Character should appear in campaign characters');
  });

  await test('Can remove character from campaign', async () => {
    await dbRun('UPDATE characters SET campaign_id = NULL WHERE id = ?', [testData.character.id]);

    const char = await dbGet('SELECT campaign_id FROM characters WHERE id = ?', [testData.character.id]);
    assert(char.campaign_id === null, 'Campaign should be removed');

    // Re-assign for remaining tests
    await dbRun('UPDATE characters SET campaign_id = ? WHERE id = ?',
      [testData.campaign.id, testData.character.id]);
  });

  // ============================================================
  // CHARACTER QUEST TRACKING TESTS
  // ============================================================

  await test('Can get all quests for character', async () => {
    const quests = await questService.getCharacterQuests(testData.character.id);
    assert(Array.isArray(quests), 'Should return array');
    const found = quests.find(q => q.id === testData.quest.id);
    assert(found, 'Should include test quest');
  });

  await test('Can get active quests for character', async () => {
    const quests = await questService.getActiveQuests(testData.character.id);
    assert(Array.isArray(quests), 'Should return array');
    const found = quests.find(q => q.id === testData.quest.id);
    assert(found, 'Should include active test quest');
  });

  await test('Can get quests by type', async () => {
    const sideQuests = await questService.getQuestsByType(testData.character.id, 'side');
    assert(Array.isArray(sideQuests), 'Should return array');
    const found = sideQuests.find(q => q.id === testData.quest.id);
    assert(found, 'Should include side quest');
  });

  await test('getMainQuest returns null when no main quest', async () => {
    const mainQuest = await questService.getMainQuest(testData.character.id);
    assert(mainQuest === null, 'Should return null for no main quest');
  });

  // ============================================================
  // NARRATIVE QUEUE TESTS
  // ============================================================

  await test('Can add item to narrative queue', async () => {
    testData.queueItem = await narrativeQueueService.addToQueue({
      campaign_id: testData.campaign.id,
      character_id: testData.character.id,
      event_type: 'test_event',
      priority: 'normal',
      title: 'API Test Queue Item',
      description: 'Testing the narrative queue API',
      context: { test: true }
    });
    assert(testData.queueItem.id, 'Should have an ID');
    assert(testData.queueItem.status === 'pending', 'Should be pending');
  });

  await test('Can get pending items for character', async () => {
    const items = await narrativeQueueService.getPendingItems(testData.character.id);
    assert(Array.isArray(items), 'Should return array');
    const found = items.find(i => i.id === testData.queueItem.id);
    assert(found, 'Should include test item');
  });

  await test('Can get pending items by priority', async () => {
    const items = await narrativeQueueService.getPendingItemsByPriority(testData.character.id, 'normal');
    assert(Array.isArray(items), 'Should return array');
    const found = items.find(i => i.id === testData.queueItem.id);
    assert(found, 'Should include test item with normal priority');
  });

  await test('Can format items for AI context', async () => {
    const context = await narrativeQueueService.formatForAIContext(testData.character.id, 10);
    // Can be null or object
    if (context) {
      assert(typeof context.formatted === 'string', 'Should have formatted string');
      assert(Array.isArray(context.items), 'Should have items array');
      assert(typeof context.count === 'number', 'Should have count');
    }
  });

  await test('Can mark item as delivered', async () => {
    // Pass null for session_id since we don't have a real session
    const result = await narrativeQueueService.markDelivered(testData.queueItem.id, null);
    assert(result.status === 'delivered', 'Should be delivered');
  });

  await test('Can get delivered items history', async () => {
    const items = await narrativeQueueService.getDeliveredItems(testData.character.id, 10);
    assert(Array.isArray(items), 'Should return array');
    const found = items.find(i => i.id === testData.queueItem.id);
    assert(found, 'Should include delivered item');
  });

  await test('Can delete queue item', async () => {
    // Create a new item to delete
    const toDelete = await narrativeQueueService.addToQueue({
      campaign_id: testData.campaign.id,
      character_id: testData.character.id,
      event_type: 'delete_test',
      priority: 'low',
      title: 'API Test Delete Item',
      description: 'This will be deleted'
    });

    await narrativeQueueService.deleteQueueItem(toDelete.id);

    const items = await narrativeQueueService.getPendingItems(testData.character.id);
    const found = items.find(i => i.id === toDelete.id);
    assert(!found, 'Deleted item should not appear');
  });

  // ============================================================
  // CAMPAIGN STATS TEST
  // ============================================================

  await test('Campaign stats include quest count', async () => {
    const stats = await campaignService.getCampaignStats(testData.campaign.id);
    assert(typeof stats.quests === 'number', 'Should have quest count');
    assert(stats.quests >= 1, 'Should count at least 1 quest');
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
