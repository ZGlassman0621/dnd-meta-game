/**
 * Combat Turn Service tests (Combat Pipeline #2).
 * Real integration: initializes turn order, advances, verifies DB state.
 */
import { initDatabase, dbRun } from '../server/database.js';
import { initializeTurnOrder, getTurnState, advanceTurn } from '../server/services/combatTurnService.js';

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

  console.log('\n=== Test 1: Initialize and advance ===\n');
  const order = [
    { name: 'Hero', initiative: 18 },
    { name: 'Goblin', initiative: 12 },
    { name: 'Orc', initiative: 8 },
  ];
  await initializeTurnOrder(SESS_ID, 1, order);
  let state = await getTurnState(SESS_ID, 1);
  assert(state?.currentTurn?.name === 'Hero', `First turn: Hero (got ${state?.currentTurn?.name})`);
  assert(state?.round === 1, 'Round 1');

  state = await advanceTurn(SESS_ID, 1);
  assert(state?.currentTurn?.name === 'Goblin', `Second turn: Goblin (got ${state?.currentTurn?.name})`);

  state = await advanceTurn(SESS_ID, 1);
  assert(state?.currentTurn?.name === 'Orc', `Third turn: Orc (got ${state?.currentTurn?.name})`);

  state = await advanceTurn(SESS_ID, 1);
  assert(state?.currentTurn?.name === 'Hero', `Wraps to Hero (got ${state?.currentTurn?.name})`);
  assert(state?.round === 2, `Round 2 (got ${state?.round})`);

  await dbRun('DELETE FROM combat_turn_state WHERE session_id = ?', [SESS_ID]);
  await dbRun('DELETE FROM dm_sessions WHERE id = ?', [SESS_ID]);

  console.log(`\n${'='.repeat(50)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log(`${'='.repeat(50)}\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(e => { console.error('Test failed:', e.message); process.exit(1); });
