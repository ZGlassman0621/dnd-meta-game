/**
 * Kill XP Service (Combat Pipeline #10).
 * Award XP when an enemy dies, based on bestiary XP value.
 * Marks death event to prevent double-awarding.
 */
import { dbGet, dbRun } from '../database.js';

/**
 * Award kill XP to a character.
 * @param {number} characterId
 * @param {number} deathEventId
 * @returns {Promise<object>} XP result
 */
export async function awardKillXp(characterId, deathEventId) {
  if (!characterId || !deathEventId) return null;
  
  const evt = await dbGet('SELECT xp_value, xp_awarded, enemy_name FROM combat_death_events WHERE id = ?', [deathEventId]);
  if (!evt) return null;
  if (evt.xp_awarded) return { type: 'kill_xp', alreadyAwarded: true };
  
  const xp = evt.xp_value || 0;
  if (xp <= 0) {
    await dbRun('UPDATE combat_death_events SET xp_awarded = 1 WHERE id = ?', [deathEventId]);
    return { type: 'kill_xp', xp: 0, noXp: true };
  }
  
  // Add to character's experience. Use experience_points if exists, else track via death event.
  // For now, we record it in the death event and let the session system aggregate.
  // The character's total kill XP can be summed from combat_death_events.
  await dbRun('UPDATE combat_death_events SET xp_awarded = 1 WHERE id = ?', [deathEventId]);
  
  return { type: 'kill_xp', enemyName: evt.enemy_name, xp, deathEventId };
}

/**
 * Get total kill XP for a character in a session.
 */
export async function getSessionKillXp(characterId, sessionId) {
  // Kill XP is awarded per death event; sum all awarded in session
  // Note: characterId is for future per-character tracking; currently session-wide
  const row = await dbGet(
    'SELECT COALESCE(SUM(xp_value), 0) as total FROM combat_death_events WHERE session_id = ? AND xp_awarded = 1',
    [sessionId]
  );
  return row?.total || 0;
}

export default { awardKillXp, getSessionKillXp };
