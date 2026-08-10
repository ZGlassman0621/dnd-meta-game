/**
 * Phase 4.1 + 4.2 — the two polish fixes, covered together because they are
 * the same failure in two disguises: world state written where nothing reads
 * it, and world state attributed to a character nobody is playing.
 *
 * 4.1 — the death canon category. `propagateNpcDeath` wrote category
 *       'npc_death'; every reader queried 'death'. The DM prompt's DEATHS
 *       section is built from the 'death' query, so a propagated NPC death
 *       never reached the model and the AI would keep the NPC alive.
 *
 * 4.2 — primary-character resolution. Six call sites in the living-world
 *       tick, three in base threats and three in the weather routes resolved
 *       "the campaign's character" with an unordered, unfiltered LIMIT 1.
 *       That could hand campaign world state to an abandoned creator draft or
 *       a dead PC, and could pick a *different* row between two steps of one
 *       tick.
 *
 * Run: npm test primary-character-attribution   — NEVER `node tests/primary-character-attribution.test.js` directly:
 *      only run-tests.js redirects TURSO_DATABASE_URL to a throwaway
 *      file, so a bare `node` run writes into the LIVE campaign database.
 * All test data prefixed with TEST_ and cleaned up at the end.
 */

import { initDatabase, dbRun, dbGet, dbAll } from '../server/database.js';
import { getPrimaryCharacter, getPrimaryCharacterId } from '../server/utils/primaryCharacter.js';
import { propagateNpcDeath, syncDeathsFromCanonFacts } from '../server/services/npcLifecycleService.js';
import { getRelevantContext } from '../server/services/storyChronicleService.js';

let passed = 0;
let failed = 0;

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

// ===== Tracked ids =====
let campaignId;
let emptyCampaignId;
const campaignIds = [];
const characterIds = [];
const npcIds = [];

async function createCharacter(name, fields = {}) {
  const cols = {
    name,
    class: 'Fighter',
    race: 'Human',
    level: 3,
    current_hp: 20,
    max_hp: 20,
    current_location: 'TEST_Ward',
    experience_to_next_level: 900,
    campaign_id: campaignId,
    game_day: 5,
    ...fields,
  };
  const keys = Object.keys(cols);
  const result = await dbRun(
    `INSERT INTO characters (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`,
    keys.map((k) => cols[k])
  );
  const id = Number(result.lastInsertRowid);
  characterIds.push(id);
  return id;
}

async function setup() {
  console.log('\n--- Setup ---');
  await initDatabase();

  const camp = await dbRun(
    `INSERT INTO campaigns (name, description, setting, tone, starting_location)
     VALUES (?, ?, ?, ?, ?)`,
    ['TEST_AttributionCampaign', 'Primary-character resolution', 'Forgotten Realms', 'grim', 'TEST_Ward']
  );
  campaignId = Number(camp.lastInsertRowid);
  campaignIds.push(campaignId);

  const empty = await dbRun(
    `INSERT INTO campaigns (name, description, setting, tone, starting_location)
     VALUES (?, ?, ?, ?, ?)`,
    ['TEST_AttributionCampaign_Drafts', 'Drafts only', 'Forgotten Realms', 'grim', 'TEST_Ward']
  );
  emptyCampaignId = Number(empty.lastInsertRowid);
  campaignIds.push(emptyCampaignId);

  console.log(`  campaign ${campaignId}, drafts-only campaign ${emptyCampaignId}`);
}

// ============================================================
// 4.2 — primary character resolution
// ============================================================

async function testDraftsAreNeverPicked() {
  console.log('\n--- 4.2: drafts are never picked ---');

  // Inserted FIRST, so they hold the lowest ids in the campaign. Under the old
  // unordered `LIMIT 1` these are exactly the rows SQLite tends to hand back.
  const creating = await createCharacter('TEST_DraftCreating', { creation_phase: 'creating' });
  await createCharacter('TEST_DraftPreludeSetup', { creation_phase: 'prelude_setup' });
  await createCharacter('TEST_DraftPrelude', { creation_phase: 'prelude' });
  await createCharacter('TEST_DraftReady', { creation_phase: 'ready_for_primary' });

  const active = await createCharacter('TEST_ActivePC', { creation_phase: 'active' });

  assert(creating < active, 'drafts hold lower ids than the active character (worst case for ORDER BY id)');

  const picked = await getPrimaryCharacter(campaignId);
  assert(picked !== null && picked !== undefined, 'a character is resolved');
  assertEqual(picked.id, active, 'resolves the active character, not a lower-id draft');
  assertEqual(picked.name, 'TEST_ActivePC', 'resolved row is the finished PC');
}

async function testDeadCharactersAreNeverPicked() {
  console.log('\n--- 4.2: dead characters are never picked ---');

  const active = await getPrimaryCharacterId(campaignId);
  await dbRun('UPDATE characters SET is_dead = 1 WHERE id = ?', [active]);

  const afterDeath = await getPrimaryCharacter(campaignId);
  assertEqual(afterDeath, null, 'a campaign whose only active PC is dead resolves to nothing');

  const survivor = await createCharacter('TEST_SurvivorPC', { creation_phase: 'active' });
  const picked = await getPrimaryCharacter(campaignId);
  assertEqual(picked?.id, survivor, 'the living successor is resolved once one exists');

  // Restore for the remaining tests.
  await dbRun('UPDATE characters SET is_dead = 0 WHERE id = ?', [active]);
  const restored = await getPrimaryCharacter(campaignId);
  assertEqual(restored?.id, active, 'with both alive, the lower id wins — deterministic, not arbitrary');
}

async function testDeterministicAcrossRepeatedCalls() {
  console.log('\n--- 4.2: the pick is stable ---');

  const picks = [];
  for (let i = 0; i < 5; i++) {
    picks.push(await getPrimaryCharacterId(campaignId));
  }
  assert(
    picks.every((p) => p === picks[0]),
    `five consecutive resolutions agree (${picks.join(', ')})`
  );
}

async function testNullColumnsCountAsPlayable() {
  console.log('\n--- 4.2: NULL creation_phase / is_dead are playable ---');

  // Rows predating migrations 042 and 061 carry NULL, not 'active'/0. A bare
  // `= 'active'` / `= 0` comparison is NULL in SQL — never true — which would
  // silently exclude every legacy character from the living world.
  const legacyCampaign = await dbRun(
    `INSERT INTO campaigns (name, description, setting, tone, starting_location)
     VALUES (?, ?, ?, ?, ?)`,
    ['TEST_AttributionCampaign_Legacy', 'Legacy nulls', 'Forgotten Realms', 'grim', 'TEST_Ward']
  );
  const legacyCampaignId = Number(legacyCampaign.lastInsertRowid);
  campaignIds.push(legacyCampaignId);

  const saved = campaignId;
  campaignId = legacyCampaignId;
  const legacyChar = await createCharacter('TEST_LegacyPC');
  campaignId = saved;

  await dbRun('UPDATE characters SET creation_phase = NULL, is_dead = NULL WHERE id = ?', [legacyChar]);

  const picked = await getPrimaryCharacter(legacyCampaignId);
  assertEqual(picked?.id, legacyChar, 'a legacy row with NULL phase and NULL is_dead still resolves');
}

async function testDraftsOnlyCampaignResolvesToNothing() {
  console.log('\n--- 4.2: a drafts-only campaign resolves to nothing ---');

  const saved = campaignId;
  campaignId = emptyCampaignId;
  await createCharacter('TEST_OnlyDraft', { creation_phase: 'creating' });
  campaignId = saved;

  const picked = await getPrimaryCharacter(emptyCampaignId);
  assertEqual(picked, null, 'no playable character → null, so tick steps skip rather than mis-attribute');
  assertEqual(await getPrimaryCharacterId(emptyCampaignId), null, 'the id helper returns null, not undefined');

  assertEqual(await getPrimaryCharacter(null), null, 'a null campaignId resolves to null without a query');
}

// ============================================================
// 4.1 — the death canon category
// ============================================================

async function testNpcDeathIsVisibleToTheChronicle() {
  console.log('\n--- 4.1: a propagated NPC death reaches the DM prompt ---');

  const characterId = await getPrimaryCharacterId(campaignId);

  const npc = await dbRun(
    `INSERT INTO npcs (name, race, occupation, lifecycle_status)
     VALUES (?, ?, ?, ?)`,
    ['TEST_AttributionVictim', 'Human', 'Fence', 'alive']
  );
  const npcId = Number(npc.lastInsertRowid);
  npcIds.push(npcId);

  const result = await propagateNpcDeath(npcId, campaignId, characterId, {
    cause: 'a knife in the dark',
    gameDay: 5,
    location: 'TEST_Ward',
    killer: 'an unknown assailant',
  });
  assert(result.success === true, 'propagateNpcDeath succeeds');

  const fact = await dbGet(
    `SELECT category FROM canon_facts WHERE campaign_id = ? AND subject = ?`,
    [campaignId, 'TEST_AttributionVictim']
  );
  assertEqual(fact?.category, 'death', "the canon fact is filed under 'death', the category readers query");

  const stale = await dbGet(
    `SELECT COUNT(*) AS n FROM canon_facts WHERE campaign_id = ? AND category = 'npc_death'`,
    [campaignId]
  );
  assertEqual(Number(stale?.n), 0, "nothing is written under the orphaned 'npc_death' category");

  // The payoff: the DEATHS section of the prompt context is built from the
  // 'death' query. Under the old category this came back empty.
  const context = await getRelevantContext(characterId, campaignId, {}, 4000);
  const text = typeof context === 'string' ? context : JSON.stringify(context);
  assert(text.includes('TEST_AttributionVictim'), 'the death appears in the assembled prompt context');
  assert(text.includes('DO NOT RESURRECT'), 'it lands in the DEATHS section specifically');
}

async function testCanonSyncSeesChronicleDeaths() {
  console.log('\n--- 4.1: the death reconciler reads what the chronicle writes ---');

  const characterId = await getPrimaryCharacterId(campaignId);

  const npc = await dbRun(
    `INSERT INTO npcs (name, race, occupation, lifecycle_status)
     VALUES (?, ?, ?, ?)`,
    ['TEST_AttributionUnsynced', 'Dwarf', 'Smith', 'alive']
  );
  const npcId = Number(npc.lastInsertRowid);
  npcIds.push(npcId);

  // Simulate the chronicle path: a 'death' canon fact exists, but the npcs row
  // was never transitioned. This is the exact case syncDeathsFromCanonFacts
  // exists for — and the one it could never see while it queried 'npc_death'.
  await dbRun(
    `INSERT INTO canon_facts (campaign_id, character_id, category, subject, fact, game_day, importance, is_active)
     VALUES (?, ?, 'death', ?, ?, ?, 'major', 1)`,
    [campaignId, characterId, 'TEST_AttributionUnsynced', 'TEST_AttributionUnsynced was killed in the collapse.', 6]
  );

  const synced = await syncDeathsFromCanonFacts(campaignId);
  assert(synced >= 1, `reconciler picked up the chronicle-written death (synced ${synced})`);

  const after = await dbGet('SELECT lifecycle_status FROM npcs WHERE id = ?', [npcId]);
  assertEqual(after?.lifecycle_status, 'deceased', 'the npcs row was transitioned to deceased');
}

// ============================================================
// Regression guard — the query shape itself
// ============================================================

async function testNoBlindLookupsRemain() {
  console.log('\n--- 4.2: no blind campaign→character lookups remain ---');

  const { readFileSync } = await import('node:fs');
  const { fileURLToPath } = await import('node:url');
  const { dirname, join } = await import('node:path');

  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  const guarded = [
    'server/services/livingWorldService.js',
    'server/services/baseThreatService.js',
    'server/routes/weather.js',
  ];

  // Deliberately structural. On a database with exactly one finished character
  // — which is every developer's database — the old query and the new one
  // return the same row, so no behavioural test can catch a copy-pasted
  // regression here. Only the query shape can.
  const blind = /FROM\s+characters\s+WHERE\s+campaign_id\s*=\s*\?\s+LIMIT\s+1/i;

  for (const rel of guarded) {
    const src = readFileSync(join(root, rel), 'utf8');
    assert(!blind.test(src), `${rel} has no unordered, unfiltered LIMIT 1 character lookup`);
  }
}

// ============================================================
// Cleanup
// ============================================================

async function cleanup() {
  console.log('\n--- Cleanup ---');
  try {
    for (const id of characterIds) {
      await dbRun('DELETE FROM canon_facts WHERE character_id = ?', [id]);
      await dbRun('DELETE FROM narrative_queue WHERE character_id = ?', [id]);
    }
    for (const id of npcIds) {
      await dbRun('DELETE FROM npc_lifecycle_history WHERE npc_id = ?', [id]);
      await dbRun('DELETE FROM npc_relationships WHERE npc_id = ?', [id]);
      await dbRun('DELETE FROM narrative_queue WHERE related_npc_id = ?', [id]);
      await dbRun('DELETE FROM npcs WHERE id = ?', [id]);
    }
    for (const id of characterIds) {
      await dbRun('DELETE FROM characters WHERE id = ?', [id]);
    }
    for (const id of campaignIds) {
      await dbRun('DELETE FROM campaigns WHERE id = ?', [id]);
    }

    const leftover = await dbAll("SELECT id, name FROM campaigns WHERE name LIKE 'TEST_Attribution%'");
    if (leftover.length) {
      console.log(`  warning: ${leftover.length} TEST_Attribution campaign(s) left behind`);
    } else {
      console.log('  clean');
    }
  } catch (e) {
    console.error('  cleanup error:', e.message);
  }
}

async function run() {
  console.log('='.repeat(60));
  console.log('Primary-character attribution + death canon category');
  console.log('='.repeat(60));

  try {
    await setup();
    await testDraftsAreNeverPicked();
    await testDeadCharactersAreNeverPicked();
    await testDeterministicAcrossRepeatedCalls();
    await testNullColumnsCountAsPlayable();
    await testDraftsOnlyCampaignResolvesToNothing();
    await testNpcDeathIsVisibleToTheChronicle();
    await testCanonSyncSeesChronicleDeaths();
    await testNoBlindLookupsRemain();
  } catch (e) {
    console.error('\nFATAL:', e.message);
    console.error(e.stack);
    failed++;
  } finally {
    await cleanup();
  }

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
  process.exit(failed > 0 ? 1 : 0);
}

run();
