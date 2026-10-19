/**
 * Combat Turn Service (Combat Pipeline #2).
 * Server-side turn order tracking. The DB is the source of truth for whose turn it is.
 */
import { dbGet, dbRun } from '../database.js';
import { safeParse } from '../utils/safeParse.js';

export async function initializeTurnOrder(sessionId, encounterSeq, turnOrder) {
  const orderJson = JSON.stringify(turnOrder);
  await dbRun(
    `INSERT INTO combat_turn_state (session_id, encounter_seq, turn_order_json, current_index, round_number)
     VALUES (?, ?, ?, 0, 1)
     ON CONFLICT(session_id, encounter_seq) DO UPDATE SET
       turn_order_json = excluded.turn_order_json, current_index = 0, round_number = 1, updated_at = CURRENT_TIMESTAMP`,
    [sessionId, encounterSeq, orderJson]
  );
  return getTurnState(sessionId, encounterSeq);
}

export async function getTurnState(sessionId, encounterSeq) {
  const row = await dbGet('SELECT * FROM combat_turn_state WHERE session_id = ? AND encounter_seq = ?', [sessionId, encounterSeq]);
  if (!row) return null;
  const order = safeParse(row.turn_order_json, []);
  return { turnOrder: order, currentIndex: row.current_index, currentTurn: order[row.current_index] || null, round: row.round_number, totalCombatants: order.length };
}

export async function advanceTurn(sessionId, encounterSeq) {
  const state = await getTurnState(sessionId, encounterSeq);
  if (!state) return null;
  let nextIndex = state.currentIndex + 1;
  let nextRound = state.round;
  if (nextIndex >= state.totalCombatants) { nextIndex = 0; nextRound += 1; }
  await dbRun('UPDATE combat_turn_state SET current_index = ?, round_number = ?, updated_at = CURRENT_TIMESTAMP WHERE session_id = ? AND encounter_seq = ?', [nextIndex, nextRound, sessionId, encounterSeq]);
  // Combat Pipeline #5: Reset the incoming combatant's reaction (D&D 2024: refreshes at start of your turn)
  const newState = await getTurnState(sessionId, encounterSeq);
  if (newState?.currentTurn?.name) {
    try {
      const { resetReaction } = await import('./reactionService.js');
      await resetReaction(sessionId, encounterSeq, newState.currentTurn.name);
    } catch (e) { /* best-effort */ }
  }
  return newState;
}

export async function getCurrentTurn(sessionId, encounterSeq) {
  const state = await getTurnState(sessionId, encounterSeq);
  return state?.currentTurn || null;
}

export default { initializeTurnOrder, getTurnState, advanceTurn, getCurrentTurn };
