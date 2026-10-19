/**
 * Spell Catalog tests (Combat Pipeline #12).
 * Verifies spell lookup and auto-concentration on cast.
 */
import { initDatabase, dbRun, dbGet } from '../server/database.js';
import { lookupSpell, isConcentrationSpell } from '../server/data/spellCatalog.js';
import { castSpell } from '../server/services/spellCastService.js';
import { getConcentration } from '../server/services/concentrationService.js';

let passed = 0;
let failed = 0;
let CHAR_ID = null;
let CAMP_ID = null;

function assert(condition, message) {
  if (condition) { console.log(`  ✓ ${message}`); passed++; }
  else { console.error(`  ✗ ${message}`); failed++; }
}

async function seed() {
  const c = await dbRun(`INSERT INTO campaigns (name, setting, status) VALUES ('TEST_CATALOG', 'FR', 'active')`);
  CAMP_ID = Number(c.lastInsertRowid);
  const ch = await dbRun(
    `INSERT INTO characters (name, class, race, level, current_hp, max_hp, current_location, experience_to_next_level, campaign_id, spell_slots, spell_slots_used)
     VALUES ('TEST_CatCaster', 'Wizard', 'Human', 5, 30, 30, 'TEST', 900, ?, ?, ?)`,
    [CAMP_ID, JSON.stringify({1:4,2:3,3:2}), JSON.stringify({1:0,2:0,3:0})]
  );
  CHAR_ID = Number(ch.lastInsertRowid);
}

async function cleanup() {
  if (CHAR_ID) await dbRun('DELETE FROM characters WHERE id = ?', [CHAR_ID]);
  if (CAMP_ID) await dbRun('DELETE FROM campaigns WHERE id = ?', [CAMP_ID]);
}

async function run() {
  await initDatabase();

  console.log('\n=== Test 1: Spell lookup ===\n');
  const fb = lookupSpell('fireball');
  assert(fb !== null, 'Fireball found');
  assert(fb?.level === 3, 'Level 3');
  assert(fb?.components?.includes('M'), 'Has material component');
  assert(fb?.concentration === false, 'Not concentration');

  const bless = lookupSpell('bless');
  assert(bless?.concentration === true, 'Bless is concentration');
  assert(isConcentrationSpell('Bless') === true, 'isConcentrationSpell works');
  assert(isConcentrationSpell('Fireball') === false, 'Fireball not concentration');

  console.log('\n=== Test 2: Cast concentration spell auto-starts ===\n');
  await seed();
  const r = await castSpell(CHAR_ID, 'Bless', 1);
  assert(r?.success === true, 'Cast succeeds');
  assert(r?.concentration === true, 'Concentration flagged');
  const conc = await getConcentration(CHAR_ID);
  assert(conc === 'Bless', `Auto-concentrating on Bless (got ${conc})`);
  await cleanup();

  console.log('\n=== Test 3: Non-concentration spell does not start ===\n');
  await seed();
  const r2 = await castSpell(CHAR_ID, 'Magic Missile', 1);
  assert(r2?.concentration === false || r2?.concentration === undefined, 'No concentration');
  const conc2 = await getConcentration(CHAR_ID);
  assert(conc2 === null, 'Not concentrating');
  await cleanup();

  console.log(`\n${'='.repeat(50)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log(`${'='.repeat(50)}\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(e => { console.error('Test failed:', e.message); process.exit(1); });
