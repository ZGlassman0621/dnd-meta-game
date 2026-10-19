/**
 * Concentration tests (Combat Pipeline #4).
 * Real integration: seeds character, sets concentration, deals damage, verifies.
 * D&D 2024: DC 10 or half damage, whichever higher.
 */
import { initDatabase, dbRun, dbGet } from '../server/database.js';
import { startConcentration, getConcentration, checkConcentration } from '../server/services/concentrationService.js';
import { applyHpChange } from '../server/services/characterHpService.js';

let passed = 0;
let failed = 0;
let CHAR_ID = null;
let CAMP_ID = null;

function assert(condition, message) {
  if (condition) { console.log(`  ✓ ${message}`); passed++; }
  else { console.error(`  ✗ ${message}`); failed++; }
}

async function seed(con = 14) {
  const c = await dbRun(`INSERT INTO campaigns (name, setting, status) VALUES ('TEST_CONC', 'FR', 'active')`);
  CAMP_ID = Number(c.lastInsertRowid);
  const ch = await dbRun(
    `INSERT INTO characters (name, class, race, level, current_hp, max_hp, current_location, experience_to_next_level, campaign_id, ability_scores)
     VALUES ('TEST_ConcCaster', 'Wizard', 'Human', 5, 30, 30, 'TEST', 900, ?, ?)`,
    [CAMP_ID, JSON.stringify({ constitution: con })]
  );
  CHAR_ID = Number(ch.lastInsertRowid);
}

async function cleanup() {
  if (CHAR_ID) await dbRun('DELETE FROM characters WHERE id = ?', [CHAR_ID]);
  if (CAMP_ID) await dbRun('DELETE FROM campaigns WHERE id = ?', [CAMP_ID]);
}

async function run() {
  await initDatabase();

  console.log('\n=== Test 1: Start and get concentration ===\n');
  await seed();
  await startConcentration(CHAR_ID, 'Hold Person');
  let conc = await getConcentration(CHAR_ID);
  assert(conc === 'Hold Person', `Concentrating on Hold Person (got ${conc})`);
  await cleanup();

  console.log('\n=== Test 2: DC calculation (damage 8 -> DC 10, damage 30 -> DC 15) ===\n');
  await seed(10); // CON 10 = +0 mod, makes math predictable
  await startConcentration(CHAR_ID, 'Bless');
  // We can't control the d20 roll, but we can verify the check runs and returns structure
  const result = await checkConcentration(CHAR_ID, 8);
  assert(result !== null, 'Check runs when concentrating');
  assert(result?.dc === 10, `DC 10 for 8 damage (got ${result?.dc})`);
  assert(typeof result?.roll === 'number', 'Roll is a number');
  assert(typeof result?.success === 'boolean', 'Success is boolean');
  await cleanup();

  console.log('\n=== Test 3: High damage raises DC ===\n');
  await seed(10);
  await startConcentration(CHAR_ID, 'Bless');
  const r2 = await checkConcentration(CHAR_ID, 30);
  assert(r2?.dc === 15, `DC 15 for 30 damage (got ${r2?.dc})`);
  await cleanup();

  console.log('\n=== Test 4: No check when not concentrating ===\n');
  await seed();
  const r3 = await checkConcentration(CHAR_ID, 20);
  assert(r3 === null, 'Null when not concentrating');
  await cleanup();

  console.log(`\n${'='.repeat(50)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log(`${'='.repeat(50)}\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(e => { console.error('Test failed:', e.message); process.exit(1); });
