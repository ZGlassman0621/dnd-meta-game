/**
 * Morale tests (Combat Pipeline #11).
 * Verifies enemies flee at 50%+ casualties.
 */
import { initDatabase, dbRun, dbGet, dbAll } from '../server/database.js';
import { checkMorale } from '../server/services/moraleService.js';
import { createEncounterEnemies, applyDamageToEnemy } from '../server/services/enemyCombatService.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) { console.log(`  ✓ ${message}`); passed++; }
  else { console.error(`  ✗ ${message}`); failed++; }
}

async function run() {
  await initDatabase();
  
  const s = await dbRun('INSERT INTO dm_sessions DEFAULT VALUES');
  const sessId = Number(s.lastInsertRowid);
  
  console.log('\n=== Test 1: No morale check below 50% casualties ===\n');
  // 4 enemies, kill 1 (25%)
  await createEncounterEnemies(sessId, 1, [
    { name: 'Goblin1', maxHp: 7, armorClass: 15, attackBonus: 4, damageDice: '1d6+2', dexMod: 2 },
    { name: 'Goblin2', maxHp: 7, armorClass: 15, attackBonus: 4, damageDice: '1d6+2', dexMod: 2 },
    { name: 'Goblin3', maxHp: 7, armorClass: 15, attackBonus: 4, damageDice: '1d6+2', dexMod: 2 },
    { name: 'Goblin4', maxHp: 7, armorClass: 15, attackBonus: 4, damageDice: '1d6+2', dexMod: 2 },
  ]);
  await applyDamageToEnemy(sessId, 1, 'Goblin1', 10);
  const m1 = await checkMorale(sessId, 1);
  assert(m1?.triggered === false, 'No check at 25% casualties');
  
  console.log('\n=== Test 2: Morale check at 50% casualties ===\n');
  await applyDamageToEnemy(sessId, 1, 'Goblin2', 10);
  const m2 = await checkMorale(sessId, 1);
  assert(m2?.triggered === true, 'Check triggered at 50%');
  
  console.log('\n=== Test 3: Rally check for winning side ===\n');
  // Rally is part of the morale check result
  assert(Array.isArray(m2?.rallyChecks), 'Rally checks present');
  // Rally may or may not succeed (DC 14, random) - just verify structure
  if (m2?.rallyChecks?.length > 0) {
    const rally = m2.rallyChecks[0];
    assert(rally.side === 'friendlies', 'Rally is for friendlies');
    assert(rally.dc === 14, 'Rally DC 14');
  }
  
  // Cleanup
  await dbRun('DELETE FROM combat_enemies WHERE session_id = ?', [sessId]);
  await dbRun('DELETE FROM dm_sessions WHERE id = ?', [sessId]);
  
  console.log(`\n${'='.repeat(50)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log(`${'='.repeat(50)}\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(e => { console.error('Test failed:', e.message); process.exit(1); });
