/**
 * Central RNG.
 *
 * Phase 3.3. There were 95 bare `Math.random()` sites across the server and no
 * shared dice helper, so mechanically meaningful rolls — initiative, crafting
 * checks, death saves — were unreproducible and unauditable. When something
 * strange happens three hundred sessions in, there is currently no way to
 * reconstruct what was rolled.
 *
 * Scope, deliberately narrow: this module exists so *mechanically meaningful*
 * rolls share one implementation and one log. Cosmetic randomness (flavour
 * picks, display shuffling, jitter) is intentionally left alone — migrating all
 * 95 sites is a wide mechanical change with little payoff, and mixing cosmetic
 * noise into the roll log would bury the rolls that matter.
 *
 * Seeding is not implemented yet. The natural home is per-session
 * (dm_sessions), NOT per-campaign: characters.campaign_id is NULL on the
 * default creation path, so a per-campaign seed would be null exactly where
 * reproducibility is wanted. Deferred rather than half-built.
 */

/** Ring buffer of recent rolls, newest last. Purely diagnostic. */
const rollLog = [];
const ROLL_LOG_MAX = 500;

function record(entry) {
  rollLog.push(entry);
  if (rollLog.length > ROLL_LOG_MAX) rollLog.shift();
}

/**
 * Roll `count` dice with `sides` faces each.
 *
 * @param {number} sides - Faces per die. Must be a positive integer.
 * @param {number} [count=1] - Number of dice. Must be a positive integer.
 * @param {object} [opts]
 * @param {string} [opts.reason] - What the roll was for; shows up in the log.
 * @returns {{ total: number, rolls: number[] }}
 */
export function roll(sides, count = 1, opts = {}) {
  if (!Number.isInteger(sides) || sides < 1) {
    throw new TypeError(`roll(): sides must be a positive integer, got ${sides}`);
  }
  if (!Number.isInteger(count) || count < 1) {
    throw new TypeError(`roll(): count must be a positive integer, got ${count}`);
  }

  const rolls = [];
  for (let i = 0; i < count; i++) {
    rolls.push(Math.floor(Math.random() * sides) + 1);
  }
  const total = rolls.reduce((a, b) => a + b, 0);

  record({ sides, count, rolls, total, reason: opts.reason || null });
  return { total, rolls };
}

/**
 * Roll a single d20. The most common mechanically meaningful roll in the
 * system — this replaces two byte-identical private `rollD20` definitions that
 * had drifted into separate services.
 *
 * @param {string} [reason]
 * @returns {number} 1-20
 */
export function rollD20(reason) {
  return roll(20, 1, { reason: reason || 'd20' }).total;
}

/**
 * Pick one element uniformly at random.
 * Returns undefined for an empty or non-array input rather than throwing —
 * callers routinely pass filtered lists that can legitimately come back empty.
 *
 * @template T
 * @param {T[]} array
 * @param {string} [reason]
 * @returns {T|undefined}
 */
export function pick(array, reason) {
  if (!Array.isArray(array) || array.length === 0) return undefined;
  const index = Math.floor(Math.random() * array.length);
  record({ sides: array.length, count: 1, rolls: [index + 1], total: index + 1, reason: reason || 'pick' });
  return array[index];
}

/**
 * Fisher-Yates shuffle, returning a new array.
 *
 * Provided because the codebase contains `sort(() => Math.random() - 0.5)`,
 * which is not a uniform shuffle — comparator-based shuffling is biased and, on
 * some engines, can violate the comparator contract outright.
 *
 * @template T
 * @param {T[]} array
 * @returns {T[]}
 */
export function shuffle(array) {
  if (!Array.isArray(array)) return [];
  const out = [...array];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Recent rolls, oldest first. Diagnostic only. */
export function getRollLog() {
  return [...rollLog];
}

/** Drop the roll log. Used by tests. */
export function clearRollLog() {
  rollLog.length = 0;
}

export default { roll, rollD20, pick, shuffle, getRollLog, clearRollLog };
