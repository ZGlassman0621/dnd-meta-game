/**
 * Character HP + death saves (Phase 3.1).
 *
 * Makes the player's HP authoritative in the database. Before this, HP was
 * nominally stored in `characters.current_hp` but actually lived in the model's
 * narration: the only write happened at session end, from a heuristic derived
 * from an LLM 0-10 "combat" score, floored at 1. The protagonist could not
 * reach 0 HP, while companions have had real HP and death saves since
 * migration 030.
 *
 * The rule, chosen deliberately (5e death saves):
 *   - HP is clamped to [0, max_hp].
 *   - Dropping to 0 sets is_unconscious and zeroes both death-save counters.
 *   - While at 0, each death save is a d20: 20 revives at 1 HP, total (d20 + exhaustion penalty) of 10+ is a
 *     success, below 10 a failure, and a natural 1 counts as two failures.
 *     Three successes stabilise; three failures kill.
 *   - Rising above 0 clears unconsciousness and both counters.
 *   - is_dead is terminal; nothing in the normal loop clears it.
 */

import { dbGet, dbRun } from '../database.js';
import { registerHandler as registerMarkerHandler } from './markerPipeline.js';
import { rollD20 } from '../utils/rng.js';
import { getConditions, exhaustionPenalty } from './conditionService.js';

/**
 * Apply an HP delta to a character.
 *
 * The write is a single atomic UPDATE with the clamp expressed in SQL, so
 * concurrent writers cannot interleave a read-modify-write and lose damage.
 * It needs no surrounding transaction for that reason.
 *
 * @param {number} characterId
 * @param {number} delta - Positive heals, negative damages.
 * @param {string} [reason]
 * @returns {Promise<object|null>} Null when the character is missing or the
 *   delta is not a usable non-zero number.
 */
export async function applyHpChange(characterId, delta, reason = null) {
  if (!characterId) return null;
  if (!Number.isFinite(delta) || delta === 0) return null;

  const before = await dbGet(
    'SELECT id, name, current_hp, max_hp, COALESCE(temp_hp, 0) as temp_hp, is_unconscious, is_dead, death_save_successes, death_save_failures FROM characters WHERE id = ?',
    [characterId]
  );
  if (!before) return null;

  // Damage to an already-dead character is meaningless; healing is a
  // resurrection and must be an explicit act, not an HP_CHANGE marker.
  if (before.is_dead) {
    return {
      type: 'hp_change',
      applied: false,
      reason: 'character_is_dead',
      currentHp: before.current_hp,
      maxHp: before.max_hp,
      tempHp: before.temp_hp || 0
    };
  }

  const d = Math.trunc(delta);
  // Temp HP (D&D 2024): damage hits temp HP first, then regular HP.
  // Healing does not restore temp HP. Single atomic UPDATE.
  // COALESCE handles NULL temp_hp (pre-migration rows or fixtures that don't set it).
  await dbRun(
    `UPDATE characters
        SET temp_hp = CASE WHEN ? < 0 THEN MAX(0, COALESCE(temp_hp, 0) + ?) ELSE COALESCE(temp_hp, 0) END,
            current_hp = CASE
              WHEN ? < 0 THEN MAX(0, current_hp - MAX(0, -? - COALESCE(temp_hp, 0)))
              ELSE MAX(0, MIN(max_hp, current_hp + ?))
            END
      WHERE id = ?`,
    [d, d, d, d, d, characterId]
  );

  const after = await dbGet(
    'SELECT current_hp, max_hp, temp_hp FROM characters WHERE id = ?',
    [characterId]
  );

  const droppedToZero = before.current_hp > 0 && after.current_hp === 0;
  const roseAboveZero = before.current_hp === 0 && after.current_hp > 0;

  if (droppedToZero) {
    // Entering the dying state resets the counters — a fresh set of saves.
    await dbRun(
      `UPDATE characters
          SET is_unconscious = 1, death_save_successes = 0, death_save_failures = 0
        WHERE id = ?`,
      [characterId]
    );
  } else if (roseAboveZero) {
    await dbRun(
      `UPDATE characters
          SET is_unconscious = 0, death_save_successes = 0, death_save_failures = 0
        WHERE id = ?`,
      [characterId]
    );
  }

  // Combat Pipeline #4: Concentration check on HP damage (not temp HP damage).
  // Per D&D 2024: DC 10 or half HP damage taken, whichever is higher.
  let concentrationCheck = null;
  const hpDamage = before.current_hp - after.current_hp;
  if (hpDamage > 0 && !droppedToZero) {
    try {
      const { checkConcentration } = await import('./concentrationService.js');
      concentrationCheck = await checkConcentration(characterId, hpDamage);
    } catch (e) {
      console.error('[characterHpService] Concentration check failed:', e.message);
    }
  }

  return {
    type: 'hp_change',
    applied: true,
    characterId,
    delta: Math.trunc(delta),
    reason,
    previousHp: before.current_hp,
    currentHp: after.current_hp,
    maxHp: after.max_hp,
    tempHp: after.temp_hp || 0,
    previousTempHp: before.temp_hp || 0,
    droppedToZero,
    roseAboveZero,
    isUnconscious: droppedToZero ? true : roseAboveZero ? false : Boolean(before.is_unconscious),
    concentrationCheck
  };
}

/**
 * Grant temporary HP (D&D 2024: does not stack, take the higher).
 * @param {number} characterId
 * @param {number} amount - Must be positive.
 * @returns {Promise<object|null>}
 */
export async function gainTempHp(characterId, amount) {
  if (!characterId) return null;
  const amt = Math.trunc(amount);
  if (!Number.isFinite(amt) || amt <= 0) return null;
  await dbRun(
    `UPDATE characters SET temp_hp = MAX(COALESCE(temp_hp, 0), ?) WHERE id = ?`,
    [amt, characterId]
  );
  const after = await dbGet('SELECT COALESCE(temp_hp, 0) as temp_hp FROM characters WHERE id = ?', [characterId]);
  return { type: 'temp_hp', characterId, amount: amt, tempHp: after?.temp_hp || 0 };
}

/**
 * Roll one death save for a character at 0 HP.
 *
 * @param {number} characterId
 * @returns {Promise<object|null>} Null if the character is missing or is not
 *   currently dying (at 0 HP, unconscious, not already dead).
 */
export async function rollDeathSave(characterId) {
  const c = await dbGet(
    'SELECT id, name, current_hp, max_hp, is_unconscious, is_dead, death_save_successes, death_save_failures FROM characters WHERE id = ?',
    [characterId]
  );
  if (!c || c.is_dead || c.current_hp > 0) return null;

  const d20 = rollD20('player death save');

  // 2024 exhaustion (ruled 2026-10-26): the penalty applies to the save
  // total vs DC 10. Nat 20 revive / nat 1 double-fail stay die-based.
  const penalty = exhaustionPenalty(await getConditions('player', characterId));

  let successes = c.death_save_successes || 0;
  let failures = c.death_save_failures || 0;
  let outcome;

  if (d20 === 20) {
    // Natural 20 — regain 1 HP and stand back up.
    await dbRun(
      `UPDATE characters
          SET current_hp = 1, is_unconscious = 0,
              death_save_successes = 0, death_save_failures = 0
        WHERE id = ?`,
      [characterId]
    );
    return {
      type: 'death_save', roll: d20, outcome: 'revived', penalty,
      successes: 0, failures: 0, currentHp: 1, characterId, name: c.name,
      // Same shape as other death-save returns; revive is its own
      // outcome, neither died nor stabilized (3 successes at 0 HP).
      died: false, stabilised: false
    };
  }

  if (d20 === 1) {
    failures += 2; // Natural 1 counts as two failures.
    outcome = 'critical_failure';
  } else if (d20 + penalty >= 10) {
    successes += 1;
    outcome = 'success';
  } else {
    failures += 1;
    outcome = 'failure';
  }

  successes = Math.min(3, successes);
  failures = Math.min(3, failures);

  const died = failures >= 3;
  const stabilised = !died && successes >= 3;

  await dbRun(
    `UPDATE characters
        SET death_save_successes = ?, death_save_failures = ?, is_dead = ?
      WHERE id = ?`,
    [successes, failures, died ? 1 : 0, characterId]
  );

  return {
    type: 'death_save',
    characterId,
    name: c.name,
    roll: d20,
    penalty,
    outcome: died ? 'died' : stabilised ? 'stabilised' : outcome,
    successes,
    failures,
    died,
    stabilised,
    currentHp: 0
  };
}

/** Current HP/death state, for prompt injection and the response payload. */
export async function getHpState(characterId) {
  return dbGet(
    `SELECT current_hp, max_hp, is_unconscious, is_dead,
            death_save_successes, death_save_failures
       FROM characters WHERE id = ?`,
    [characterId]
  );
}

// ============================================================
// MARKER HANDLER
// ============================================================

/**
 * HP_CHANGE handler on the player path.
 *
 * The schema has existed since the prelude work but was only ever implemented
 * on the prelude side; the player session neither detected nor handled it.
 * Registering it here is what finally makes damage real during play.
 *
 * Returns null without a characterId: DM Mode shares this registry and
 * dispatches without one, and a null return is the pipeline's no-op.
 */
registerMarkerHandler('HP_CHANGE', async (parsed, context) => {
  if (!context?.characterId) return null;

  // Combat item 7: a table cause (Fall/Trap/Hazard) replaces the
  // declared delta — the engine rolls, the DM names the cause.
  // Target= names a companion (Q5 symmetry); without it the PC takes
  // it. A table field present beats delta (the table is authoritative).
  // The flagged hazard path takes its amount from a negative delta
  // (HP_CHANGE damage convention); a positive delta is no amount.
  const { resolveTableCause, applyTableDamageToParty, resolveCompanionByName } = await import('./damageTableService.js');
  const tableCause = resolveTableCause({
    fall: parsed?.Fall, trap: parsed?.Trap, hazard: parsed?.Hazard,
    severity: parsed?.Severity, type: parsed?.Type, save: parsed?.Save,
    amount: (Number(parsed?.delta) < 0 ? -Number(parsed?.delta) : undefined),
  });
  if (tableCause?.refusal) {
    return { type: 'party_damage', success: false, reason: tableCause.refusal.reason, remedy: tableCause.refusal.remedy };
  }
  if (tableCause) {
    if (!context.sessionId) return null;
    let target = { kind: 'player', id: context.characterId };
    if (parsed?.Target) {
      const comp = await resolveCompanionByName(context.characterId, parsed.Target);
      if (!comp) return { type: 'party_damage', success: false, reason: `no active companion named "${parsed.Target}"` };
      target = comp;
    }
    const { getCurrentEncounterSeq } = await import('./enemyCombatService.js');
    const seq = await getCurrentEncounterSeq(context.sessionId).catch(() => 0);
    return applyTableDamageToParty(context.sessionId, seq || 0, target, tableCause, context.characterId);
  }

  const delta = Number(parsed?.delta);
  // The schema permits 0; only the prelude detector filtered it. A zero delta
  // is a no-op, not an error.
  if (!Number.isFinite(delta) || delta === 0) return null;

  const res = await applyHpChange(context.characterId, delta, parsed?.reason || null);
  // Item 6, Tier F2: declared damage writes the last-damage record,
  // unattributed (no attacker, no type) — Absorb refuses it, but the
  // record still stands for the other trio answers.
  if (delta < 0 && res?.applied && context.sessionId) {
    try {
      const hpDamage = Math.max(0, (res.previousHp ?? 0) - (res.currentHp ?? 0));
      if (hpDamage > 0) {
        const { recordDamage } = await import('./lastDamageService.js');
        const { getCurrentEncounterSeq } = await import('./enemyCombatService.js');
        const seq = await getCurrentEncounterSeq(context.sessionId).catch(() => 0);
        await recordDamage(context.sessionId, 'player', context.characterId, {
          amount: hpDamage, type: null, attackerKind: null, attackerId: null,
          attackerName: null, encounterSeq: seq || 0,
        });
      }
    } catch { /* records never break HP changes */ }
  }
  return res;
});

export default { applyHpChange, rollDeathSave, getHpState, gainTempHp };
// Note: concentration checks hook in via dynamic import to avoid circular deps.
// See applyHpChange return value: concentrationCheck field when damage breaks concentration.
