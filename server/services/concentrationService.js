/**
 * Concentration Service (Combat Pipeline #4).
 * D&D 2024: taking damage while concentrating forces a CON save.
 * DC 10 or half damage taken, whichever is higher. Fail = spell ends.
 */
import { dbGet, dbRun, dbAll } from '../database.js';
import { safeParse } from '../utils/safeParse.js';
import { rollD20 } from '../utils/rng.js';
import { proficiencyBonusForLevel } from './combatStatsService.js';
import { classSaveProficiencies } from './rollRequestService.js';
import { getConditions, exhaustionPenalty, removeCondition } from './conditionService.js';
import { combatFallbackId } from './worldIdService.js';

export async function startConcentration(characterId, spellName) {
  if (!characterId || !spellName) return null;
  // Combat item 6: replacing concentration ends the old spell's
  // concentration-bound effects (its conditions clear), the same as
  // breaking it — otherwise a switched spell leaves stale effects.
  const cur = await dbGet('SELECT concentrating_on FROM characters WHERE id = ?', [characterId]);
  if (cur?.concentrating_on && cur.concentrating_on.toLowerCase() !== String(spellName).toLowerCase()) {
    await clearCasterEffects('player', characterId);
  }
  await dbRun('UPDATE characters SET concentrating_on = ? WHERE id = ?', [spellName, characterId]);
  return { type: 'concentration_start', characterId, spell: spellName };
}

export async function breakConcentration(characterId, reason = 'unknown') {
  if (!characterId) return null;
  const c = await dbGet('SELECT concentrating_on FROM characters WHERE id = ?', [characterId]);
  if (!c?.concentrating_on) return null;
  const spell = c.concentrating_on;
  await dbRun('UPDATE characters SET concentrating_on = NULL WHERE id = ?', [characterId]);
  const effectsCleared = await clearCasterEffects('player', characterId);
  return { type: 'concentration_break', characterId, spell, reason, effectsCleared };
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
  // 2024 exhaustion (ruled 2026-10-26): the penalty applies to this CON save.
  const penalty = exhaustionPenalty(await getConditions('player', characterId));
  const total = roll + conMod + penalty;
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
    penalty,
    total,
    success,
    broken: !success,
  };
}

/**
 * Companion concentration (combat-real B4) — the PC functions above,
 * mirrored against companions.concentrating_on (migration 084). The
 * check rolls the companion's CON save from their true sheet: CON
 * modifier + proficiency when their class is CON-save proficient.
 */
export async function startCompanionConcentration(companionId, spellName) {
  if (!companionId || !spellName) return null;
  // Combat item 6: replacing concentration ends the old spell's
  // concentration-bound effects, same as breaking it (see
  // startConcentration above).
  const cur = await dbGet('SELECT concentrating_on FROM companions WHERE id = ?', [companionId]);
  if (cur?.concentrating_on && cur.concentrating_on.toLowerCase() !== String(spellName).toLowerCase()) {
    await clearCasterEffects('companion', companionId);
  }
  await dbRun('UPDATE companions SET concentrating_on = ? WHERE id = ?', [spellName, companionId]);
  return { type: 'concentration_start', companionId, spell: spellName };
}

export async function breakCompanionConcentration(companionId, reason = 'unknown') {
  if (!companionId) return null;
  const c = await dbGet('SELECT concentrating_on FROM companions WHERE id = ?', [companionId]);
  if (!c?.concentrating_on) return null;
  const spell = c.concentrating_on;
  await dbRun('UPDATE companions SET concentrating_on = NULL WHERE id = ?', [companionId]);
  const effectsCleared = await clearCasterEffects('companion', companionId);
  return { type: 'concentration_break', companionId, spell, reason, effectsCleared };
}

export async function getCompanionConcentration(companionId) {
  const c = await dbGet('SELECT concentrating_on FROM companions WHERE id = ?', [companionId]);
  return c?.concentrating_on || null;
}

export async function checkCompanionConcentration(companionId, damageTaken) {
  if (!companionId || damageTaken <= 0) return null;
  const c = await dbGet('SELECT concentrating_on, companion_ability_scores, companion_class, companion_level FROM companions WHERE id = ?', [companionId]);
  if (!c?.concentrating_on) return null;
  const abilities = safeParse(c.companion_ability_scores, {});
  const conScore = abilities.con ?? abilities.constitution ?? 10;
  const conMod = Math.floor(((Number(conScore) || 10) - 10) / 2);
  const proficient = classSaveProficiencies(c.companion_class).includes('con');
  const saveBonus = conMod + (proficient ? proficiencyBonusForLevel(c.companion_level || 1) : 0);
  const dc = Math.max(10, Math.floor(damageTaken / 2));
  const roll = rollD20('companion concentration save');
  // 2024 exhaustion (ruled 2026-10-26): the penalty applies to this CON save.
  const penalty = exhaustionPenalty(await getConditions('companion', companionId));
  const total = roll + saveBonus + penalty;
  const success = total >= dc;
  if (!success) {
    await breakCompanionConcentration(companionId, 'failed_save');
  }
  return {
    type: 'concentration_check',
    companionId,
    spell: c.concentrating_on,
    damageTaken,
    dc,
    roll,
    saveBonus,
    penalty,
    total,
    success,
    broken: !success,
  };
}

/**
 * Combat item 6: end a caster's concentration-bound spell_effects
 * rows and clear their conditions. The caster key matches the key the
 * effect-creation path stores: world IDs for party/companions (with
 * the ledger fallbacks), the combat fallback key for enemies (which
 * is why enemy callers must pass session + encounter). Function
 * declarations hoist, so the start/break functions above may call
 * this even though it is defined here.
 */
async function clearCasterEffects(kind, id, sessionId = null, encounterSeq = null) {
  let key = null;
  try {
    if (kind === 'player') {
      const row = await dbGet('SELECT world_id FROM characters WHERE id = ?', [id]);
      key = row?.world_id || `player:${id}`;
    } else if (kind === 'companion') {
      const row = await dbGet('SELECT c.npc_id, n.world_id FROM companions c LEFT JOIN npcs n ON n.id = c.npc_id WHERE c.id = ?', [id]);
      key = row?.world_id || `companion:${id}`;
    } else if (kind === 'enemy') {
      if (sessionId == null || encounterSeq == null) return 0;
      key = combatFallbackId(sessionId, encounterSeq, id);
    } else return 0;
  } catch { return 0; }
  let rows = [];
  try {
    rows = await dbAll('SELECT id, target_kind, target_id, condition_name FROM spell_effects WHERE caster_key = ? AND concentration = 1', [key]);
  } catch { return 0; }
  for (const r of rows) {
    try { if (r.condition_name) await removeCondition(r.target_kind, r.target_id, r.condition_name); } catch { /* best-effort */ }
    try { await dbRun('DELETE FROM spell_effects WHERE id = ?', [r.id]); } catch { /* best-effort */ }
  }
  return rows.length;
}

/**
 * Enemy concentration (combat item 6) — the PC/companion functions,
 * mirrored against combat_enemies.concentrating_on (migration 097).
 * The check rolls the enemy's CON save through the shared enemy
 * save-modifier path (statblock snapshot → ability score → CR
 * fallback, spellCastService.enemySaveModifier), with the 2024
 * exhaustion penalty when the enemy carries exhaustion.
 */
export async function startEnemyConcentration(sessionId, encounterSeq, combatEnemyId, spellName) {
  if (!combatEnemyId || !spellName) return null;
  const cur = await dbGet('SELECT concentrating_on FROM combat_enemies WHERE id = ?', [combatEnemyId]);
  if (cur?.concentrating_on && cur.concentrating_on.toLowerCase() !== String(spellName).toLowerCase()) {
    await clearCasterEffects('enemy', combatEnemyId, sessionId, encounterSeq);
  }
  await dbRun('UPDATE combat_enemies SET concentrating_on = ? WHERE id = ?', [spellName, combatEnemyId]);
  return { type: 'concentration_start', combatEnemyId, spell: spellName };
}

export async function breakEnemyConcentration(sessionId, encounterSeq, combatEnemyId, reason = 'unknown') {
  if (!combatEnemyId) return null;
  const c = await dbGet('SELECT concentrating_on FROM combat_enemies WHERE id = ?', [combatEnemyId]);
  if (!c?.concentrating_on) return null;
  const spell = c.concentrating_on;
  await dbRun('UPDATE combat_enemies SET concentrating_on = NULL WHERE id = ?', [combatEnemyId]);
  const effectsCleared = await clearCasterEffects('enemy', combatEnemyId, sessionId, encounterSeq);
  return { type: 'concentration_break', combatEnemyId, spell, reason, effectsCleared };
}

export async function getEnemyConcentration(sessionId, encounterSeq, combatEnemyId) {
  // Family signature (sessionId, encounterSeq, id) like start/break;
  // a lone id also works. The id is always the last argument given.
  const id = combatEnemyId ?? encounterSeq ?? sessionId;
  const c = await dbGet('SELECT concentrating_on FROM combat_enemies WHERE id = ?', [id]);
  return c?.concentrating_on || null;
}

export async function checkEnemyConcentration(sessionId, encounterSeq, combatEnemyId, damageTaken) {
  if (!combatEnemyId || damageTaken <= 0) return null;
  const c = await dbGet('SELECT concentrating_on, stats_json, name FROM combat_enemies WHERE id = ?', [combatEnemyId]);
  if (!c?.concentrating_on) return null;
  const { enemySaveModifier } = await import('./spellCastService.js');
  const saveBonus = await enemySaveModifier(c, 'con');
  const penalty = exhaustionPenalty(await getConditions('enemy', combatEnemyId));
  const dc = Math.max(10, Math.floor(damageTaken / 2));
  const roll = rollD20('enemy concentration save');
  const total = roll + saveBonus + penalty;
  const success = total >= dc;
  if (!success) {
    await breakEnemyConcentration(sessionId, encounterSeq, combatEnemyId, 'failed_save');
  }
  return {
    type: 'concentration_check',
    combatEnemyId,
    spell: c.concentrating_on,
    damageTaken,
    dc,
    roll,
    saveBonus,
    penalty,
    total,
    success,
    broken: !success,
  };
}

export default { startConcentration, breakConcentration, getConcentration, checkConcentration, startCompanionConcentration, breakCompanionConcentration, getCompanionConcentration, checkCompanionConcentration, startEnemyConcentration, breakEnemyConcentration, getEnemyConcentration, checkEnemyConcentration };
