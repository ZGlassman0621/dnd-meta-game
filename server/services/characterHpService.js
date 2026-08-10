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
 *   - While at 0, each death save is a d20: 20 revives at 1 HP, 10+ is a
 *     success, below 10 a failure, and a natural 1 counts as two failures.
 *     Three successes stabilise; three failures kill.
 *   - Rising above 0 clears unconsciousness and both counters.
 *   - is_dead is terminal; nothing in the normal loop clears it.
 */

import { dbGet, dbRun } from '../database.js';
import { registerHandler as registerMarkerHandler } from './markerPipeline.js';
import { rollD20 } from '../utils/rng.js';

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
    'SELECT id, name, current_hp, max_hp, is_unconscious, is_dead, death_save_successes, death_save_failures FROM characters WHERE id = ?',
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
      maxHp: before.max_hp
    };
  }

  await dbRun(
    `UPDATE characters
        SET current_hp = MAX(0, MIN(max_hp, current_hp + ?))
      WHERE id = ?`,
    [Math.trunc(delta), characterId]
  );

  const after = await dbGet(
    'SELECT current_hp, max_hp FROM characters WHERE id = ?',
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

  return {
    type: 'hp_change',
    applied: true,
    characterId,
    delta: Math.trunc(delta),
    reason,
    previousHp: before.current_hp,
    currentHp: after.current_hp,
    maxHp: after.max_hp,
    droppedToZero,
    roseAboveZero,
    isUnconscious: droppedToZero ? true : roseAboveZero ? false : Boolean(before.is_unconscious)
  };
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
      type: 'death_save', roll: d20, outcome: 'revived',
      successes: 0, failures: 0, currentHp: 1, characterId, name: c.name
    };
  }

  if (d20 === 1) {
    failures += 2; // Natural 1 counts as two failures.
    outcome = 'critical_failure';
  } else if (d20 >= 10) {
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

  const delta = Number(parsed?.delta);
  // The schema permits 0; only the prelude detector filtered it. A zero delta
  // is a no-op, not an error.
  if (!Number.isFinite(delta) || delta === 0) return null;

  return applyHpChange(context.characterId, delta, parsed?.reason || null);
});

export default { applyHpChange, rollDeathSave, getHpState };
