/**
 * Concentration Service (Combat Pipeline #4).
 * D&D 2024: taking damage while concentrating forces a CON save.
 * DC 10 or half damage taken, whichever is higher. Fail = spell ends.
 */
import { dbGet, dbRun } from '../database.js';
import { safeParse } from '../utils/safeParse.js';
import { rollD20 } from '../utils/rng.js';

export async function startConcentration(characterId, spellName) {
  if (!characterId || !spellName) return null;
  await dbRun('UPDATE characters SET concentrating_on = ? WHERE id = ?', [spellName, characterId]);
  return { type: 'concentration_start', characterId, spell: spellName };
}

export async function breakConcentration(characterId, reason = 'unknown') {
  if (!characterId) return null;
  const c = await dbGet('SELECT concentrating_on FROM characters WHERE id = ?', [characterId]);
  if (!c?.concentrating_on) return null;
  const spell = c.concentrating_on;
  await dbRun('UPDATE characters SET concentrating_on = NULL WHERE id = ?', [characterId]);
  return { type: 'concentration_break', characterId, spell, reason };
}

export async function getConcentration(characterId) {
  const c = await dbGet('SELECT concentrating_on FROM characters WHERE id = ?', [characterId]);
  return c?.concentrating_on || null;
}

/**
 * Check concentration after taking damage. Rolls CON save via rng.js.
 * @param {number} characterId
 * @param {number} damageTaken - Positive amount of HP damage (after temp HP).
 * @returns {Promise<object|null>} Null if not concentrating.
 */
export async function checkConcentration(characterId, damageTaken) {
  if (!characterId || damageTaken <= 0) return null;
  const c = await dbGet('SELECT concentrating_on, ability_scores FROM characters WHERE id = ?', [characterId]);
  if (!c?.concentrating_on) return null;
  const abilities = safeParse(c.ability_scores, {});
  const conMod = Math.floor(((abilities.constitution || abilities.con || 10) - 10) / 2);
  const dc = Math.max(10, Math.floor(damageTaken / 2));
  const roll = rollD20('concentration save');
  const total = roll + conMod;
  const success = total >= dc;
  if (!success) {
    await breakConcentration(characterId, 'failed_save');
  }
  return {
    type: 'concentration_check',
    characterId,
    spell: c.concentrating_on,
    damageTaken,
    dc,
    roll,
    conMod,
    total,
    success,
    broken: !success,
  };
}

export default { startConcentration, breakConcentration, getConcentration, checkConcentration };
