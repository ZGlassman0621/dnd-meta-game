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

export default { hasReactionAvailable, useReaction, resetReaction, resetAllReactions };
