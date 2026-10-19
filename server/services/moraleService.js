/**
 * Morale Service (Combat Pipeline #11).
 * Symmetric morale: both sides check when losing, both can gain buffs when winning.
 * 
 * LOSING (50%+ casualties on your side):
 *   - DC 10 Wisdom save → fail = fled/broken
 * 
 * WINNING (enemy at 50%+ casualties):
 *   - DC 14 Morale save → pass = +1 to attack rolls (remainder of combat)
 * 
 * D&D 2024 has no RAW morale; this is homebrew. Cuts both ways.
 */
import { dbAll, dbRun, dbGet } from '../database.js';
import { rollD20 } from '../utils/rng.js';

const MORALE_BUFF_BONUS = 1;
const BREAK_DC = 10;
const RALLY_DC = 14;
const CASUALTY_THRESHOLD = 0.5;

/**
 * Check morale for losing side + rally for winning side.
 * @param {number} sessionId
 * @param {number} encounterSeq
 * @param {string} losingSide - 'enemies' or 'friendlies'
 */
export async function checkMorale(sessionId, encounterSeq, losingSide = 'enemies') {
  if (!sessionId || !encounterSeq) return null;
  
  const enemies = await dbAll(
    'SELECT * FROM combat_enemies WHERE session_id = ? AND encounter_seq = ?',
    [sessionId, encounterSeq]
  );
  
  const aliveEnemies = enemies.filter(e => e.status === 'active');
  const deadEnemies = enemies.filter(e => e.status === 'dead');
  const totalEnemies = enemies.length;
  
  if (totalEnemies === 0) return { type: 'morale_check', triggered: false, reason: 'no_combatants' };
  
  const enemyCasualtyRate = deadEnemies.length / totalEnemies;
  const results = { type: 'morale_check', triggered: false, breakChecks: [], rallyChecks: [] };
  
  // LOSING SIDE: Break check at 50%+ casualties
  if (losingSide === 'enemies' && enemyCasualtyRate >= CASUALTY_THRESHOLD && aliveEnemies.length > 0) {
    results.triggered = true;
    const dc = BREAK_DC + Math.floor((enemyCasualtyRate - CASUALTY_THRESHOLD) * 8);
    for (const enemy of aliveEnemies) {
      const saveRoll = rollD20(`morale break save: ${enemy.name}`);
      if (saveRoll < dc) {
        await dbRun("UPDATE combat_enemies SET status = 'fled' WHERE id = ?", [enemy.id]);
        results.breakChecks.push({ name: enemy.name, roll: saveRoll, dc, outcome: 'fled' });
      } else {
        results.breakChecks.push({ name: enemy.name, roll: saveRoll, dc, outcome: 'held' });
      }
    }
  }
  
  // WINNING SIDE: Rally check (DC 14) for +1 attack buff
  // If enemies are losing, friendlies can rally. If friendlies are losing, enemies can rally.
  const winningSideLoserRate = losingSide === 'enemies' ? enemyCasualtyRate : 0;
  // For now, rally triggers when the OPPOSING side hits 50% casualties
  // Friendlies rally when enemies are breaking; enemies rally when friendlies are breaking
  // (Friendly casualty tracking TBD - needs companion/NPC combat integration)
  
  if (losingSide === 'enemies' && enemyCasualtyRate >= CASUALTY_THRESHOLD) {
    // Friendlies rally: DC 14 for +1 to attacks
    // Stored in combat_turn_state for the encounter
    const rallyRoll = rollD20('friendly rally check');
    if (rallyRoll >= RALLY_DC) {
      await setMoraleBuff(sessionId, encounterSeq, 'friendlies', MORALE_BUFF_BONUS);
      results.rallyChecks.push({ side: 'friendlies', roll: rallyRoll, dc: RALLY_DC, outcome: 'rallied', buff: MORALE_BUFF_BONUS });
    } else {
      results.rallyChecks.push({ side: 'friendlies', roll: rallyRoll, dc: RALLY_DC, outcome: 'no_rally' });
    }
    results.triggered = true;
  }
  
  // Build system note
  const notes = [];
  const fled = results.breakChecks.filter(c => c.outcome === 'fled');
  if (fled.length > 0) {
    notes.push(`Morale broken! ${fled.map(f => f.name).join(', ')} ${fled.length === 1 ? 'flees' : 'flee'} the battle!`);
  }
  const rallied = results.rallyChecks.filter(c => c.outcome === 'rallied');
  if (rallied.length > 0) {
    notes.push(`Your side rallies! +${MORALE_BUFF_BONUS} to attack rolls for the remainder of combat!`);
  }
  if (notes.length > 0) {
    results.systemNote = `[SYSTEM NOTE - DO NOT RESPOND TO THIS]: ${notes.join(' ')}`;
  }
  
  return results;
}

/**
 * Set morale buff for a side. Stored in combat_turn_state.
 */
export async function setMoraleBuff(sessionId, encounterSeq, side, bonus) {
  const state = await dbGet(
    'SELECT morale_buff_json FROM combat_turn_state WHERE session_id = ? AND encounter_seq = ?',
    [sessionId, encounterSeq]
  );
  // Column may not exist yet; handle gracefully
  if (!state) return;
  try {
    const buffs = state.morale_buff_json ? JSON.parse(state.morale_buff_json) : {};
    buffs[side] = bonus;
    await dbRun(
      'UPDATE combat_turn_state SET morale_buff_json = ? WHERE session_id = ? AND encounter_seq = ?',
      [JSON.stringify(buffs), sessionId, encounterSeq]
    );
  } catch (e) { /* column may not exist */ }
}

/**
 * Get morale buff for a side (applied to attack rolls).
 */
export async function getMoraleBuff(sessionId, encounterSeq, side) {
  try {
    const state = await dbGet(
      'SELECT morale_buff_json FROM combat_turn_state WHERE session_id = ? AND encounter_seq = ?',
      [sessionId, encounterSeq]
    );
    if (!state?.morale_buff_json) return 0;
    const buffs = JSON.parse(state.morale_buff_json);
    return buffs[side] || 0;
  } catch (e) {
    return 0;
  }
}

export default { checkMorale, setMoraleBuff, getMoraleBuff };
