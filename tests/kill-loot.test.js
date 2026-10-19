/**
 * Kill Loot tests (Combat Pipeline #9).
 * Verifies loot generates on kill.
 */
import { initDatabase, dbRun, dbGet } from '../server/database.js';
import { generateKillLoot } from '../server/services/killLootService.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) { console.log(`  ✓ ${message}`); passed++; }
  else { console.error(`  ✗ ${message}`); failed++; }
}

async function run() {
  await initDatabase();
  
  // Seed
  const c = await dbRun(`INSERT INTO campaigns (name, setting, status) VALUES ('TEST_LOOT', 'FR', 'active')`);
  const campId = Number(c.lastInsertRowid);
  const ch = await dbRun(`INSERT INTO characters (name, class, race, level, current_hp, max_hp, current_location, experience_to_next_level, campaign_id, inventory) VALUES ('TEST_Hero', 'Fighter', 'Human', 3, 30, 30, 'TEST', 900, ?, '[]')`, [campId]);
  const charId = Number(ch.lastInsertRowid);
  const s = await dbRun('INSERT INTO dm_sessions DEFAULT VALUES');
  const sessId = Number(s.lastInsertRowid);
  const d = await dbRun(`INSERT INTO combat_death_events (session_id, encounter_seq, enemy_name, xp_value) VALUES (?, 1, 'Goblin', 50)`, [sessId]);
  const deathId = Number(d.lastInsertRowid);
  
  console.log('\n=== Test 1: Kill loot generates ===\n');
  const loot = await generateKillLoot(charId, deathId, 'Goblin', 3);
  assert(loot !== null, 'Loot generated');
  assert(loot?.items?.length > 0, 'Has items');
  
  const evt = await dbGet('SELECT looted FROM combat_death_events WHERE id = ?', [deathId]);
  assert(evt?.looted === 1, 'Marked as looted');
  
  console.log('\n=== Test 2: No double-loot ===\n');
  const loot2 = await generateKillLoot(charId, deathId, 'Goblin', 3);
  assert(loot2?.alreadyLooted === true, 'Second call blocked');
  
  // Cleanup
  await dbRun('DELETE FROM combat_death_events WHERE id = ?', [deathId]);
  await dbRun('DELETE FROM dm_sessions WHERE id = ?', [sessId]);
  await dbRun('DELETE FROM characters WHERE id = ?', [charId]);
  await dbRun('DELETE FROM campaigns WHERE id = ?', [campId]);
  
  console.log(`\n${'='.repeat(50)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log(`${'='.repeat(50)}\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(e => { console.error('Test failed:', e.message); process.exit(1); });
