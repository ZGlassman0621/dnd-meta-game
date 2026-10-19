/**
 * Death Event tests (Combat Pipeline #8).
 * Verifies death creates an event record.
 */
import { initDatabase, dbRun, dbGet } from '../server/database.js';
import { createEncounterEnemies, applyDamageToEnemy } from '../server/services/enemyCombatService.js';

let passed = 0;
let failed = 0;
let SESSION_ID = null;

function assert(condition, message) {
  if (condition) { console.log(`  ✓ ${message}`); passed++; }
  else { console.error(`  ✗ ${message}`); failed++; }
}

async function run() {
  await initDatabase();
  
  // Create test session
  const s = await dbRun('INSERT INTO dm_sessions DEFAULT VALUES');
  SESSION_ID = Number(s.lastInsertRowid);
  
  console.log('\n=== Test 1: Death creates event ===\n');
  await createEncounterEnemies(SESSION_ID, 1, [{ name: 'Goblin', maxHp: 7, armorClass: 15, attackBonus: 4, damageDice: '1d6+2', dexMod: 2 }]);
  const r = await applyDamageToEnemy(SESSION_ID, 1, 'Goblin', 10);
  assert(r.killed === true, 'Goblin killed');
  assert(r.deathEvent !== null, 'Death event created');
  assert(r.deathEvent?.enemyName === 'Goblin', 'Event has enemy name');
  
  const evt = await dbGet('SELECT * FROM combat_death_events WHERE session_id = ? AND enemy_name = ?', [SESSION_ID, 'Goblin']);
  assert(evt !== null, 'Event in database');
  assert(evt?.xp_value === 50, 'Goblin XP 50 from bestiary');
  
  // Cleanup
  await dbRun('DELETE FROM combat_death_events WHERE session_id = ?', [SESSION_ID]);
  await dbRun('DELETE FROM combat_enemies WHERE session_id = ?', [SESSION_ID]);
  await dbRun('DELETE FROM dm_sessions WHERE id = ?', [SESSION_ID]);
  
  console.log(`\n${'='.repeat(50)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log(`${'='.repeat(50)}\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(e => { console.error('Test failed:', e.message); process.exit(1); });
