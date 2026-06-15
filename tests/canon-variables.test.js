/**
 * Phase 1 — Canon facts as overwritable VARIABLES (field-aware supersede).
 * Run: node tests/canon-variables.test.js
 *
 * Variable key = (subject, category, field). Distinct fields about the same
 * subject are independent variables; on a key collision the NEWEST write wins
 * (older row retired). Free-form facts (field null) keep their old behavior.
 * Deaths are TERMINAL and never superseded.
 *
 * Covers:
 * - A field-bearing OVERWRITABLE fact set twice => exactly ONE active row, newest value.
 * - Two field-NULL 'npc' facts about the same subject => BOTH stay active.
 * - A 'death' fact is NEVER superseded; a later contradictory fact does not revive.
 * - The partial unique index rejects a 2nd active row with the same (subject,category,field).
 *
 * Uses the same local.db; all test data prefixed with TEST_ and cleaned up.
 */

import { initDatabase, dbRun, dbGet, dbAll } from '../server/database.js';
import { recordCanonFact } from '../server/services/storyChronicleService.js';

let passed = 0;
let failed = 0;

let testCampaignId;
let testCharId;

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

async function setup() {
  console.log('--- Setup ---');
  await initDatabase();

  await dbRun(`
    INSERT INTO campaigns (name, description, setting, status)
    VALUES ('TEST_CanonVars_Campaign', 'canon variables', 'Forgotten Realms', 'active')
  `);
  testCampaignId = (await dbGet("SELECT id FROM campaigns WHERE name = 'TEST_CanonVars_Campaign'")).id;

  await dbRun(`
    INSERT INTO characters (name, class, race, level, current_hp, max_hp, current_location, experience_to_next_level, campaign_id)
    VALUES ('TEST_CanonVars_Hero', 'Fighter', 'Human', 5, 40, 40, 'Waterdeep', 6500, ?)
  `, [testCampaignId]);
  testCharId = (await dbGet("SELECT id FROM characters WHERE name = 'TEST_CanonVars_Hero'")).id;

  console.log(`  Campaign ID: ${testCampaignId}, Character ID: ${testCharId}\n`);
}

// ============================================================
// TEST 1: A field-bearing OVERWRITABLE fact overwrites itself
// ============================================================
async function testVariableOverwrite() {
  console.log('=== Test 1: field-bearing OVERWRITABLE variable => one active row, newest wins ===\n');

  const id1 = await recordCanonFact(
    testCampaignId, testCharId, 'npc', 'TEST_Gareth',
    'Gareth lives in Neverwinter.', null, 1, 'major', 'location'
  );
  assert(!!id1, 'First variable write returns an id');

  const id2 = await recordCanonFact(
    testCampaignId, testCharId, 'npc', 'TEST_Gareth',
    'Gareth lives in Waterdeep.', null, 2, 'major', 'location'
  );
  assert(!!id2, 'Second variable write returns an id');

  const active = await dbAll(
    `SELECT id, fact, field FROM canon_facts
     WHERE campaign_id = ? AND character_id = ? AND subject = 'TEST_Gareth'
     AND category = 'npc' AND field = 'location' AND is_active = 1`,
    [testCampaignId, testCharId]
  );
  assertEqual(active.length, 1, 'Exactly ONE active row for (TEST_Gareth, npc, location)');
  assert(active[0]?.fact.includes('Waterdeep'), 'The surviving active row holds the NEWEST value (Waterdeep)');

  // The old row is retired and linked to the new one.
  const old = await dbGet('SELECT is_active, superseded_by FROM canon_facts WHERE id = ?', [id1]);
  assertEqual(old?.is_active, 0, 'The older variable row is retired (is_active=0)');
  assertEqual(Number(old?.superseded_by), Number(id2), 'The older row points to the newer via superseded_by');
}

// ============================================================
// TEST 2: Two field-NULL 'npc' facts both stay active
// ============================================================
async function testFieldNullCoexist() {
  console.log('\n=== Test 2: two field-NULL npc facts about the same subject both stay active ===\n');

  const idA = await recordCanonFact(
    testCampaignId, testCharId, 'npc', 'TEST_Mira',
    'Mira has a scar over her left eye.', null, 3, 'minor'
    // no field arg => field null (free-form)
  );
  const idB = await recordCanonFact(
    testCampaignId, testCharId, 'npc', 'TEST_Mira',
    'Mira distrusts the city watch.', null, 4, 'minor'
  );
  assert(!!idA && !!idB, 'Both field-null writes return ids');

  const active = await dbAll(
    `SELECT id FROM canon_facts
     WHERE campaign_id = ? AND character_id = ? AND subject = 'TEST_Mira'
     AND category = 'npc' AND is_active = 1`,
    [testCampaignId, testCharId]
  );
  assertEqual(active.length, 2, 'BOTH field-null npc facts remain active (not clobbered)');
}

// ============================================================
// TEST 3: A 'death' fact is never superseded
// ============================================================
async function testDeathNeverSuperseded() {
  console.log('\n=== Test 3: death is TERMINAL — later contradictory fact does not revive ===\n');

  const deathId = await recordCanonFact(
    testCampaignId, testCharId, 'death', 'TEST_Varen',
    'Varen died by a blade to the heart.', null, 5, 'major', null
  );
  assert(!!deathId, 'Death fact is recorded');

  // A later attempt to overwrite via the SAME label + a field must NOT retire
  // the death (death is not in OVERWRITABLE; field-keyed supersede skips it).
  await recordCanonFact(
    testCampaignId, testCharId, 'death', 'TEST_Varen',
    'Varen is alive and well.', null, 6, 'major', 'status'
  );

  const deathRow = await dbGet('SELECT is_active FROM canon_facts WHERE id = ?', [deathId]);
  assertEqual(deathRow?.is_active, 1, 'The original death fact stays active (never superseded)');

  const deaths = await dbAll(
    `SELECT id FROM canon_facts
     WHERE campaign_id = ? AND character_id = ? AND subject = 'TEST_Varen'
     AND category = 'death' AND is_active = 1`,
    [testCampaignId, testCharId]
  );
  assert(deaths.some(d => Number(d.id) === Number(deathId)), 'The death remains in the active death set');
}

// ============================================================
// TEST 4: The partial unique index enforces one active value per key
// ============================================================
async function testPartialUniqueIndexRejects() {
  console.log('\n=== Test 4: partial unique index rejects a 2nd active row for the same variable key ===\n');

  // Seed one active variable row directly.
  await dbRun(
    `INSERT INTO canon_facts (campaign_id, character_id, category, subject, fact, game_day, is_active, importance, field)
     VALUES (?, ?, 'quest', 'TEST_Index', 'Quest stage one.', 7, 1, 'major', 'stage')`,
    [testCampaignId, testCharId]
  );

  // A second active row with the SAME (subject, category, field) must be rejected
  // by uq_canon_facts_variable.
  let rejected = false;
  try {
    await dbRun(
      `INSERT INTO canon_facts (campaign_id, character_id, category, subject, fact, game_day, is_active, importance, field)
       VALUES (?, ?, 'quest', 'TEST_Index', 'Quest stage two.', 8, 1, 'major', 'stage')`,
      [testCampaignId, testCharId]
    );
  } catch (e) {
    rejected = true;
  }
  assert(rejected, 'Partial unique index rejects a 2nd active row with the same (subject,category,field)');

  // Sanity: a DIFFERENT field for the same subject is allowed (independent variable).
  let allowed = true;
  try {
    await dbRun(
      `INSERT INTO canon_facts (campaign_id, character_id, category, subject, fact, game_day, is_active, importance, field)
       VALUES (?, ?, 'quest', 'TEST_Index', 'Quest giver is the mayor.', 9, 1, 'major', 'giver')`,
      [testCampaignId, testCharId]
    );
  } catch (e) {
    allowed = false;
  }
  assert(allowed, 'A different field for the same subject is allowed (independent variable)');
}

async function cleanup() {
  console.log('\n--- Cleanup ---');
  try {
    await dbRun("DELETE FROM canon_facts WHERE subject LIKE 'TEST_%' AND campaign_id = ?", [testCampaignId]);
    if (testCharId) {
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
    await testVariableOverwrite();
    await testFieldNullCoexist();
    await testDeathNeverSuperseded();
    await testPartialUniqueIndexRejects();
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
