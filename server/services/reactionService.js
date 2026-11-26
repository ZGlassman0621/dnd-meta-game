/**
 * Reaction Service (Combat Pipeline #5).
 * D&D 2024: one reaction per round per combatant. Resets at start of your turn.
 * Framework for opportunity attacks, Shield, Counterspell, etc.
 */
import { dbGet, dbRun } from '../database.js';
import { safeParse } from '../utils/safeParse.js';

export async function hasReactionAvailable(sessionId, encounterSeq, combatantName) {
  const row = await dbGet('SELECT reactions_used_json FROM combat_turn_state WHERE session_id = ? AND encounter_seq = ?', [sessionId, encounterSeq]);
  if (!row) return false;
  const used = safeParse(row.reactions_used_json, {});
  return !used[combatantName.toLowerCase()];
}

export async function useReaction(sessionId, encounterSeq, combatantName) {
  const available = await hasReactionAvailable(sessionId, encounterSeq, combatantName);
  if (!available) return { success: false, reason: 'reaction_already_used' };
  const row = await dbGet('SELECT reactions_used_json FROM combat_turn_state WHERE session_id = ? AND encounter_seq = ?', [sessionId, encounterSeq]);
  const used = safeParse(row.reactions_used_json, {});
  used[combatantName.toLowerCase()] = true;
  await dbRun('UPDATE combat_turn_state SET reactions_used_json = ?, updated_at = CURRENT_TIMESTAMP WHERE session_id = ? AND encounter_seq = ?', [JSON.stringify(used), sessionId, encounterSeq]);
  return { success: true, combatant: combatantName };
}

export async function resetReaction(sessionId, encounterSeq, combatantName) {
  const row = await dbGet('SELECT reactions_used_json FROM combat_turn_state WHERE session_id = ? AND encounter_seq = ?', [sessionId, encounterSeq]);
  if (!row) return;
  const used = safeParse(row.reactions_used_json, {});
  delete used[combatantName.toLowerCase()];
  await dbRun('UPDATE combat_turn_state SET reactions_used_json = ?, updated_at = CURRENT_TIMESTAMP WHERE session_id = ? AND encounter_seq = ?', [JSON.stringify(used), sessionId, encounterSeq]);
}

export async function resetAllReactions(sessionId, encounterSeq) {
  await dbRun('UPDATE combat_turn_state SET reactions_used_json = \'{}\' , updated_at = CURRENT_TIMESTAMP WHERE session_id = ? AND encounter_seq = ?', [sessionId, encounterSeq]);
}

/**
 * mechanical-reactions item 3: run a reaction FEATURE (Bend Luck, Flash
 * of Genius, ...) through the reaction budget. During a fight with a
 * turn order, the actor's reaction must be available before `fn` runs,
 * and it is spent exactly once, only when `fn` reports success. Out of
 * combat (no encounter / no turn order) the budget is untracked and
 * `fn` simply runs, as every other reaction path does.
 *   actor: { kind: 'player'|'companion'|'ally', id, name }
 *   fn: async () => result with `success` (true spends the reaction)
 * Returns fn's result, or a refusal { success:false, reason } when the
 * reaction is already used.
 */
export async function withReactionBudget(sessionId, actor, fn, refusal = {}) {
  let encounterSeq = null;
  let reactionName = actor?.name || null;
  let tracked = false;
  try {
    if (sessionId && actor) {
      const { getCurrentEncounterSeq } = await import('./enemyCombatService.js');
      encounterSeq = await getCurrentEncounterSeq(sessionId);
      if (encounterSeq) {
        const row = await dbGet('SELECT turn_order_json FROM combat_turn_state WHERE session_id = ? AND encounter_seq = ?', [sessionId, encounterSeq]);
        if (row) {
          tracked = true;
          const { ledgerKeyForTarget } = await import('./turnLedgerService.js');
          const key = await ledgerKeyForTarget(actor.kind, actor.id);
          const order = safeParse(row.turn_order_json, []);
          const entry = (Array.isArray(order) ? order : []).find((e) => e && e.key === key);
          if (entry?.name) reactionName = entry.name;
        }
      }
    }
  } catch { tracked = false; }
  if (tracked && reactionName && !(await hasReactionAvailable(sessionId, encounterSeq, reactionName))) {
    return { ...refusal, success: false, reason: 'reaction already used', remedy: 'A creature has one reaction per round; it returns at the start of its next turn.' };
  }
  const res = await fn();
  if (tracked && reactionName && res && res.success) {
    await useReaction(sessionId, encounterSeq, reactionName);
    res.reactionSpent = true;
  }
  return res;
}

export default { hasReactionAvailable, useReaction, resetReaction, resetAllReactions, withReactionBudget };
