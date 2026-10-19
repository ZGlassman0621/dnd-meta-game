/**
 * Temporary HP tests (Combat Pipeline #1).
 * Real integration: seeds a character, calls applyHpChange(), verifies DB state.
 * D&D 2024: damage hits temp HP first, no stacking, healing ignores temp.
 */
import { initDatabase, dbRun, dbGet } from '../server/database.js';
import { applyHpChange, gainTempHp } from '../server/services/characterHpService.js';

let passed = 0;
let failed = 0;
let CHAR_ID = null;
let CAMP_ID = null;

function assert(condition, message) {
  if (condition) { console.log(`  ✓ ${message}`); passed++; }
  else { console.error(`  ✗ ${message}`); failed++; }
}

async function seed(hp = 20, maxHp = 30, tempHp = 0) {
  const c = await dbRun(`INSERT INTO campaigns (name, setting, status) VALUES ('TEST_TEMPHP', 'FR', 'active')`);
  CAMP_ID = Number(c.lastInsertRowid);
  const ch = await dbRun(
    `INSERT INTO characters (name, class, race, level, current_hp, max_hp, temp_hp, current_location, experience_to_next_level, campaign_id)
     VALUES ('TEST_TempHero', 'Fighter', 'Human', 3, ?, ?, ?, 'TEST', 900, ?)`,
    [hp, maxHp, tempHp, CAMP_ID]
  );
  CHAR_ID = Number(ch.lastInsertRowid);
}

async function getHp() {
  return dbGet('SELECT current_hp, max_hp, temp_hp FROM characters WHERE id = ?', [CHAR_ID]);
}

async function cleanup() {
  if (CHAR_ID) await dbRun('DELETE FROM characters WHERE id = ?', [CHAR_ID]);
  if (CAMP_ID) await dbRun('DELETE FROM campaigns WHERE id = ?', [CAMP_ID]);
}

async function run() {
  await initDatabase();

  console.log('\n=== Test 1: Damage hits temp HP first ===\n');
  await seed(20, 30, 5);
  await applyHpChange(CHAR_ID, -8, 'test');
  let s = await getHp();
  assert(s.temp_hp === 0, `Temp depleted (got ${s.temp_hp})`);
  assert(s.current_hp === 17, `Overflow to HP: 20-3=17 (got ${s.current_hp})`);
  await cleanup();

  console.log('\n=== Test 2: Damage less than temp ===\n');
  await seed(20, 30, 5);
  await applyHpChange(CHAR_ID, -3, 'test');
  s = await getHp();
  assert(s.temp_hp === 2, `Temp reduced to 2 (got ${s.temp_hp})`);
  assert(s.current_hp === 20, `HP untouched (got ${s.current_hp})`);
  await cleanup();

  console.log('\n=== Test 3: Healing ignores temp ===\n');
  await seed(15, 30, 5);
  await applyHpChange(CHAR_ID, 10, 'test');
  s = await getHp();
  assert(s.temp_hp === 5, `Temp unchanged (got ${s.temp_hp})`);
  assert(s.current_hp === 25, `HP healed to 25 (got ${s.current_hp})`);
  await cleanup();

  console.log('\n=== Test 4: gainTempHp does not stack (takes higher) ===\n');
  await seed(20, 30, 5);
  await gainTempHp(CHAR_ID, 3); // lower, should keep 5
  s = await getHp();
  assert(s.temp_hp === 5, `Keeps higher (got ${s.temp_hp})`);
  await gainTempHp(CHAR_ID, 8); // higher, should take 8
  s = await getHp();
  assert(s.temp_hp === 8, `Takes higher (got ${s.temp_hp})`);
  await cleanup();

  console.log(`\n${'='.repeat(50)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log(`${'='.repeat(50)}\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(e => { console.error('Test failed:', e.message); process.exit(1); });
