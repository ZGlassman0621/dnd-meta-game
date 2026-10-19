/**
 * Kill XP tests (Combat Pipeline #10).
 * Verifies XP awards on kill.
 */
import { initDatabase, dbRun, dbGet } from '../server/database.js';
import { awardKillXp, getSessionKillXp } from '../server/services/killXpService.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) { console.log(`  ✓ ${message}`); passed++; }
  else { console.error(`  ✗ ${message}`); failed++; }
}

async function run() {
  await initDatabase();
  
  const c = await dbRun(`INSERT INTO campaigns (name, setting, status) VALUES ('TEST_XP', 'FR', 'active')`);
  const campId = Number(c.lastInsertRowid);
  const ch = await dbRun(`INSERT INTO characters (name, class, race, level, current_hp, max_hp, current_location, experience_to_next_level, campaign_id) VALUES ('TEST_Hero', 'Fighter', 'Human', 3, 30, 30, 'TEST', 900, ?)`, [campId]);
  const charId = Number(ch.lastInsertRowid);
  const s = await dbRun('INSERT INTO dm_sessions DEFAULT VALUES');
  const sessId = Number(s.lastInsertRowid);
  const d = await dbRun(`INSERT INTO combat_death_events (session_id, encounter_seq, enemy_name, xp_value) VALUES (?, 1, 'Goblin', 50)`, [sessId]);
  const deathId = Number(d.lastInsertRowid);
  
  console.log('\n=== Test 1: XP awarded ===\n');
  const xp = await awardKillXp(charId, deathId);
  assert(xp !== null, 'XP result returned');
  assert(xp?.xp === 50, 'Goblin worth 50 XP');
  
  const evt = await dbGet('SELECT xp_awarded FROM combat_death_events WHERE id = ?', [deathId]);
  assert(evt?.xp_awarded === 1, 'Marked as awarded');
  
  console.log('\n=== Test 2: No double-award ===\n');
  const xp2 = await awardKillXp(charId, deathId);
  assert(xp2?.alreadyAwarded === true, 'Second call blocked');
  
  console.log('\n=== Test 3: Session total ===\n');
  const total = await getSessionKillXp(charId, sessId);
  assert(total === 50, 'Session total 50 XP');
  
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
