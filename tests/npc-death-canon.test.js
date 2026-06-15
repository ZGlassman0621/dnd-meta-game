/**
 * Regression guard for the "dead NPCs come back to life" bug.
 * Run: node tests/npc-death-canon.test.js
 *
 * The bug: propagateNpcDeath() wrote death canon facts under category 'npc_death',
 * but getRelevantContext()'s always-included "DEATHS (DO NOT RESURRECT)" block (and
 * getChronicleStats()) only queried category 'death'. The two never matched, so a
 * propagated NPC death could silently fall out of the guaranteed-deaths section the
 * DM is shown every session — directly enabling resurrection over a long campaign.
 *
 * Covers:
 * - A propagated death is written under the canonical 'death' category.
 * - That death appears in getRelevantContext's DEATHS block and getChronicleStats.
 * - A LEGACY 'npc_death' row (a pre-migration save) STILL surfaces in both reads
 *   (the IN('death','npc_death') read-normalization heals existing saves).
 * - Migration 056's up() relabels a legacy 'npc_death' row to 'death'.
 *
 * Uses the same local.db; all test data prefixed with TEST_ and cleaned up.
 */

import { initDatabase, dbRun, dbGet, dbAll } from '../server/database.js';
import { propagateNpcDeath } from '../server/services/npcLifecycleService.js';
import { getRelevantContext, getChronicleStats } from '../server/services/storyChronicleService.js';
import { up as migration056Up } from '../server/migrations/056_unify_death_canon_category.js';

let passed = 0;
let failed = 0;

let testCampaignId;
let testCharId;
const testNpcIds = [];

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
    console.error(`  ✗ ${message} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    failed++;
  }
}

async function createTestNpc(name) {
  await dbRun(
    `INSERT INTO npcs (name, race, occupation) VALUES (?, 'Human', 'Innkeeper')`,
    [name]
  );
  const npc = await dbGet('SELECT id FROM npcs WHERE name = ?', [name]);
  testNpcIds.push(npc.id);
  return npc.id;
}

async function setup() {
  console.log('--- Setup ---');
  await initDatabase();

  await dbRun(`
    INSERT INTO campaigns (name, description, setting, status)
    VALUES ('TEST_DeathCanon_Campaign', 'death canon regression', 'Forgotten Realms', 'active')
  `);
  testCampaignId = (await dbGet("SELECT id FROM campaigns WHERE name = 'TEST_DeathCanon_Campaign'")).id;

  await dbRun(`
    INSERT INTO characters (name, class, race, level, current_hp, max_hp, current_location, experience_to_next_level, campaign_id)
    VALUES ('TEST_DeathCanon_Hero', 'Fighter', 'Human', 5, 40, 40, 'Waterdeep', 6500, ?)
  `, [testCampaignId]);
  testCharId = (await dbGet("SELECT id FROM characters WHERE name = 'TEST_DeathCanon_Hero'")).id;

  console.log(`  Campaign ID: ${testCampaignId}, Character ID: ${testCharId}\n`);
}

// ============================================================
// TEST 1: A propagated death reaches the guaranteed DEATHS block
// ============================================================
async function testPropagatedDeathReachesDeathsBlock() {
  console.log('=== Test 1: Propagated death reaches the DEATHS block ===\n');

  const npcId = await createTestNpc('TEST_DeathCanon_Villain');
  await propagateNpcDeath(npcId, testCampaignId, testCharId, {
    cause: 'a blade to the heart',
    gameDay: 12,
    location: 'the Yawning Portal',
    killer: 'TEST_DeathCanon_Hero',
    sessionId: null
  });

  // The cascade must write under the canonical 'death' category.
  const fact = await dbGet(
    `SELECT category FROM canon_facts WHERE campaign_id = ? AND character_id = ? AND subject = ? AND is_active = 1`,
    [testCampaignId, testCharId, 'TEST_DeathCanon_Villain']
  );
  assert(!!fact, 'A canon fact was created for the propagated death');
  assertEqual(fact?.category, 'death', "Propagated death is written under the canonical 'death' category");

  // It must surface in the always-included DEATHS block.
  const { context } = await getRelevantContext(testCharId, testCampaignId, {}, 4000);
  assert(context.includes('DO NOT RESURRECT'), 'getRelevantContext emits the DEATHS (DO NOT RESURRECT) section');
  assert(context.includes('TEST_DeathCanon_Villain'), 'The propagated death appears in the DM context');

  // And in the stats death list.
  const stats = await getChronicleStats(testCampaignId, testCharId);
  assert(
    stats.deaths.some(d => d.subject === 'TEST_DeathCanon_Villain'),
    'getChronicleStats lists the propagated death'
  );
}

// ============================================================
// TEST 2: A legacy 'npc_death' row still surfaces (read-normalization)
// ============================================================
async function testLegacyNpcDeathStillSurfaces() {
  console.log('\n=== Test 2: Legacy npc_death rows still heal at read time ===\n');

  // Simulate a pre-migration save: a death recorded under the old label.
  await dbRun(
    `INSERT INTO canon_facts (campaign_id, character_id, category, subject, fact, game_day, is_active, importance)
     VALUES (?, ?, 'npc_death', 'TEST_DeathCanon_Legacy', 'TEST_DeathCanon_Legacy died of old wounds.', 5, 1, 'major')`,
    [testCampaignId, testCharId]
  );

  const { context } = await getRelevantContext(testCharId, testCampaignId, {}, 4000);
  assert(context.includes('TEST_DeathCanon_Legacy'), 'A legacy npc_death row still reaches the DM context');

  const stats = await getChronicleStats(testCampaignId, testCharId);
  assert(
    stats.deaths.some(d => d.subject === 'TEST_DeathCanon_Legacy'),
    'getChronicleStats includes the legacy npc_death row'
  );
}

// ============================================================
// TEST 3: Migration 056 relabels legacy rows to the canonical label
// ============================================================
async function testMigrationRelabels() {
  console.log('\n=== Test 3: Migration 056 relabels npc_death -> death ===\n');

  // Confirm the legacy row from Test 2 is still labeled 'npc_death'
  const before = await dbGet(
    `SELECT category FROM canon_facts WHERE campaign_id = ? AND subject = 'TEST_DeathCanon_Legacy'`,
    [testCampaignId]
  );
  assertEqual(before?.category, 'npc_death', "Legacy row starts as 'npc_death'");

  // Run the real migration body through a thin transport adapter.
  const adapter = {
    execute: async (sql) => {
      const r = await dbRun(sql);
      return { rowsAffected: r.changes };
    }
  };
  await migration056Up(adapter);

  const after = await dbGet(
    `SELECT category FROM canon_facts WHERE campaign_id = ? AND subject = 'TEST_DeathCanon_Legacy'`,
    [testCampaignId]
  );
  assertEqual(after?.category, 'death', "Migration relabels the legacy row to 'death'");
}

async function cleanup() {
  console.log('\n--- Cleanup ---');
  try {
    for (const id of testNpcIds) {
      await dbRun('DELETE FROM npc_lifecycle_history WHERE npc_id = ?', [id]);
      await dbRun('DELETE FROM narrative_queue WHERE related_npc_id = ?', [id]);
      await dbRun('DELETE FROM companions WHERE npc_id = ?', [id]);
      await dbRun('DELETE FROM npcs WHERE id = ?', [id]);
    }
    await dbRun("DELETE FROM canon_facts WHERE subject LIKE 'TEST_DeathCanon_%'");
    if (testCharId) {
      await dbRun('DELETE FROM narrative_queue WHERE character_id = ?', [testCharId]);
      await dbRun('DELETE FROM canon_facts WHERE character_id = ?', [testCharId]);
      await dbRun('DELETE FROM characters WHERE id = ?', [testCharId]);
    }
    if (testCampaignId) {
      await dbRun('DELETE FROM campaigns WHERE id = ?', [testCampaignId]);
    }
    console.log('  Cleanup complete.');
  } catch (e) {
    console.error('  Cleanup error:', e.message);
  }
}

async function runAll() {
  try {
    await setup();
    await testPropagatedDeathReachesDeathsBlock();
    await testLegacyNpcDeathStillSurfaces();
    await testMigrationRelabels();
  } catch (e) {
    console.error('FATAL:', e);
    failed++;
  } finally {
    await new Promise(r => setTimeout(r, 100));
    await cleanup();
    console.log(`\n${passed} passed, ${failed} failed`);
    process.exit(failed > 0 ? 1 : 0);
  }
}

runAll();
