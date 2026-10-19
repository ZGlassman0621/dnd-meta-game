/**
 * Spell Cast tests (Combat Pipeline #3).
 * Real integration: seeds character with slots, calls castSpell(), verifies DB.
 */
import { initDatabase, dbRun, dbGet } from '../server/database.js';
import { castSpell } from '../server/services/spellCastService.js';

let passed = 0;
let failed = 0;
let CHAR_ID = null;
let CAMP_ID = null;

function assert(condition, message) {
  if (condition) { console.log(`  ✓ ${message}`); passed++; }
  else { console.error(`  ✗ ${message}`); failed++; }
}

async function seed() {
  const c = await dbRun(`INSERT INTO campaigns (name, setting, status) VALUES ('TEST_SPELL', 'FR', 'active')`);
  CAMP_ID = Number(c.lastInsertRowid);
  const ch = await dbRun(
    `INSERT INTO characters (name, class, race, level, current_hp, max_hp, current_location, experience_to_next_level, campaign_id, spell_slots, spell_slots_used)
     VALUES ('TEST_Caster', 'Wizard', 'Human', 5, 30, 30, 'TEST', 900, ?, ?, ?)`,
    [CAMP_ID, JSON.stringify({1:4,2:3,3:2}), JSON.stringify({1:0,2:0,3:0})]
  );
  CHAR_ID = Number(ch.lastInsertRowid);
}

async function getUsed() {
  const r = await dbGet('SELECT spell_slots_used FROM characters WHERE id = ?', [CHAR_ID]);
  return JSON.parse(r.spell_slots_used || '{}');
}

async function cleanup() {
  if (CHAR_ID) await dbRun('DELETE FROM characters WHERE id = ?', [CHAR_ID]);
  if (CAMP_ID) await dbRun('DELETE FROM campaigns WHERE id = ?', [CAMP_ID]);
}

async function run() {
  await initDatabase();
  await seed();

  console.log('\n=== Test 1: Cantrip (no slot) ===\n');
  let r = await castSpell(CHAR_ID, 'Fire Bolt', 0);
  assert(r?.success === true, 'Cantrip succeeds');
  assert(r?.slotConsumed === false, 'No slot consumed');

  console.log('\n=== Test 2: Cast consumes slot ===\n');
  r = await castSpell(CHAR_ID, 'Magic Missile', 1);
  assert(r?.success === true, 'Cast succeeds');
  assert(r?.slotConsumed === true, 'Slot consumed');
  let used = await getUsed();
  assert(used['1'] === 1, `DB shows 1 used (got ${used['1']})`);

  console.log('\n=== Test 3: Exhausted slots blocked ===\n');
  // Use all 4 level-1 slots (1 already used)
  await castSpell(CHAR_ID, 'Shield', 1);
  await castSpell(CHAR_ID, 'Shield', 1);
  await castSpell(CHAR_ID, 'Shield', 1);
  r = await castSpell(CHAR_ID, 'Shield', 1); // 5th attempt, should fail
  assert(r?.success === false, 'Blocked when exhausted');
  assert(r?.reason === 'no_slots_available', `Reason correct (got ${r?.reason})`);

  await cleanup();
  console.log(`\n${'='.repeat(50)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log(`${'='.repeat(50)}\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(e => { console.error('Test failed:', e.message); process.exit(1); });
