/**
 * Reaction tests (Combat Pipeline #5).
 * Real integration: uses combat_turn_state, tests use/reset/hasAvailable.
 * D&D 2024: one reaction per round, resets at start of your turn.
 */
import { initDatabase, dbRun } from '../server/database.js';
import { hasReactionAvailable, useReaction, resetReaction } from '../server/services/reactionService.js';
import { initializeTurnOrder } from '../server/services/combatTurnService.js';

let passed = 0;
let failed = 0;
let SESS_ID = null;

function assert(condition, message) {
  if (condition) { console.log(`  ✓ ${message}`); passed++; }
  else { console.error(`  ✗ ${message}`); failed++; }
}

async function run() {
  await initDatabase();
  const s = await dbRun('INSERT INTO dm_sessions DEFAULT VALUES');
  SESS_ID = Number(s.lastInsertRowid);
  // Need turn state row to exist (reactions_used_json lives there)
  await initializeTurnOrder(SESS_ID, 1, [{ name: 'Hero', initiative: 15 }, { name: 'Goblin', initiative: 10 }]);

  console.log('\n=== Test 1: One reaction per round ===\n');
  let avail = await hasReactionAvailable(SESS_ID, 1, 'Goblin');
  assert(avail === true, 'Available at start');
  let r = await useReaction(SESS_ID, 1, 'Goblin');
  assert(r?.success === true, 'First use succeeds');
  avail = await hasReactionAvailable(SESS_ID, 1, 'Goblin');
  assert(avail === false, 'Consumed after use');
  r = await useReaction(SESS_ID, 1, 'Goblin');
  assert(r?.success === false, 'Second use blocked');
  assert(r?.reason === 'reaction_already_used', 'Correct reason');

  console.log('\n=== Test 2: Reset restores ===\n');
  await resetReaction(SESS_ID, 1, 'Goblin');
  avail = await hasReactionAvailable(SESS_ID, 1, 'Goblin');
  assert(avail === true, 'Available after reset');

  console.log('\n=== Test 3: Independent per combatant ===\n');
  await useReaction(SESS_ID, 1, 'Goblin');
  avail = await hasReactionAvailable(SESS_ID, 1, 'Hero');
  assert(avail === true, 'Hero still has reaction');

  await dbRun('DELETE FROM combat_turn_state WHERE session_id = ?', [SESS_ID]);
  await dbRun('DELETE FROM dm_sessions WHERE id = ?', [SESS_ID]);

  console.log(`\n${'='.repeat(50)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log(`${'='.repeat(50)}\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(e => { console.error('Test failed:', e.message); process.exit(1); });
