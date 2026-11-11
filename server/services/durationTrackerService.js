/**
 * Duration Tracker Service — mechanics hooks, Family 5 (shared piece).
 *
 * One generic "for the next minute" tracker, reused across the eleven
 * Wild Magic rows that need it (01–04, 09–12, 13–16, 21–24, 29–32,
 * 33–36, 41–44, 45–48, 49–52, 81–84, 93–96) plus the Potted Plant
 * revert, Flammable Touch minute, Astral Jaunt return, and the
 * cosmetic blue-skin world-clock expiry (Amendment 2 §1.4).
 *
 * Shape (per the Family 5 task contract): PURE functions over a JSON
 * blob stored in session_config.timedEffects:
 *
 *   timedEffects = {
 *     [actorKey]: {
 *       [effectKey]: { turnsLeft, data }
 *     }
 *   }
 *
 * actorKey is the turn-ledger / position key for the actor
 * (`player:<id>`, `companion:<id>`, or a world id — the same key the
 * turn ledger and movement positions already use). effectKey is a
 * namespaced effect name, e.g. 'wild_magic_regeneration'.
 *
 * Turns are counted like Slow: `turnsLeft` decrements on the OWNER's
 * turn boundary (their turn starting), and the effect expires when it
 * reaches 0. A 1-minute effect is 10 turns (10 rounds × 1 turn each
 * for the owner). Callers that need "until the end/start of your next
 * turn" pass turns = 2 (this turn's boundary + next turn's) or
 * turns = 1 and tick at the matching boundary — see the per-row notes
 * in wildMagicService.js; the tracker itself only counts.
 *
 * World-clock effects (Death Ward's 1 hour, Poisoned Creature's 1d4
 * hours, blue skin's 24 hours) store `turnsLeft: null` and carry the
 * expiry in `data` (`{ hours: N }`); the tracker never expires them
 * on a turn boundary — the world-clock tick clears them. `hasTimedEffect`
 * still returns their data.
 *
 * No DB, no migration. The blob lives in session_config, which
 * spellCastService already reads/writes (readSessionCfg /
 * writeSessionCfg). Functions mutate the passed sessionConfig object
 * in place (the caller's write persists it) and return values; they
 * never throw on a malformed blob — a missing or non-object blob is
 * treated as empty.
 */

const MINUTE_TURNS = 10;

function timedEffectsOf(sessionConfig) {
  if (!sessionConfig || typeof sessionConfig !== 'object') return {};
  const blob = sessionConfig.timedEffects;
  return blob && typeof blob === 'object' && !Array.isArray(blob) ? blob : {};
}

function ensureActorBucket(sessionConfig, actorKey) {
  if (!sessionConfig || typeof sessionConfig !== 'object') return null;
  if (!sessionConfig.timedEffects || typeof sessionConfig.timedEffects !== 'object' || Array.isArray(sessionConfig.timedEffects)) {
    sessionConfig.timedEffects = {};
  }
  const key = String(actorKey);
  if (!sessionConfig.timedEffects[key] || typeof sessionConfig.timedEffects[key] !== 'object' || Array.isArray(sessionConfig.timedEffects[key])) {
    sessionConfig.timedEffects[key] = {};
  }
  return sessionConfig.timedEffects[key];
}

/**
 * Record (or replace) a timed effect on an actor.
 * `turns` is the number of the owner's turn boundaries the effect
 * survives; pass null for a world-clock effect (expiry carried in
 * `data`, e.g. `{ hours: 1 }`). Returns the stored record.
 */
export function applyTimedEffect(sessionConfig, actorKey, effectKey, data, turns) {
  const bucket = ensureActorBucket(sessionConfig, actorKey);
  if (!bucket || !effectKey) return null;
  const record = {
    turnsLeft: turns == null ? null : Math.max(0, Math.trunc(Number(turns) || 0)),
    data: data && typeof data === 'object' ? { ...data } : (data ?? null),
  };
  bucket[String(effectKey)] = record;
  return record;
}

/**
 * Tick one owner's turn boundary: decrement every turn-counted effect
 * on that actor by 1 and drop the ones that reach 0. World-clock
 * effects (turnsLeft null) are left alone. Returns the list of effect
 * keys that expired on this tick (in insertion order). Never throws.
 */
export function tickTimedEffects(sessionConfig, actorKey) {
  const expired = [];
  const blob = timedEffectsOf(sessionConfig);
  const bucket = blob[String(actorKey)];
  if (!bucket || typeof bucket !== 'object') return expired;
  for (const [key, record] of Object.entries(bucket)) {
    if (!record || typeof record !== 'object') { delete bucket[key]; continue; }
    if (record.turnsLeft == null) continue; // world-clock effect: not ticked here
    record.turnsLeft = Math.max(0, (Number(record.turnsLeft) || 0) - 1);
    if (record.turnsLeft <= 0) {
      delete bucket[key];
      expired.push(key);
    }
  }
  return expired;
}

/** The stored `data` for an active effect, or null when it is not active. */
export function hasTimedEffect(sessionConfig, actorKey, effectKey) {
  const bucket = timedEffectsOf(sessionConfig)[String(actorKey)];
  const record = bucket && typeof bucket === 'object' ? bucket[String(effectKey)] : null;
  if (!record || typeof record !== 'object') return null;
  return record.data ?? null;
}

/** Remove one effect from an actor. Returns true when something was removed. */
export function clearTimedEffect(sessionConfig, actorKey, effectKey) {
  const bucket = timedEffectsOf(sessionConfig)[String(actorKey)];
  if (!bucket || typeof bucket !== 'object') return false;
  if (!(String(effectKey) in bucket)) return false;
  delete bucket[String(effectKey)];
  return true;
}

/** All active effect keys for an actor (insertion order). */
export function timedEffectKeys(sessionConfig, actorKey) {
  const bucket = timedEffectsOf(sessionConfig)[String(actorKey)];
  if (!bucket || typeof bucket !== 'object') return [];
  return Object.keys(bucket);
}

/** Whole timed-effects blob (the stored object, not a copy). */
export function listTimedEffects(sessionConfig) {
  return timedEffectsOf(sessionConfig);
}

/** Turns in a minute of combat, for callers converting "1 minute" to a count. */
export { MINUTE_TURNS };

export default {
  applyTimedEffect,
  tickTimedEffects,
  hasTimedEffect,
  clearTimedEffect,
  timedEffectKeys,
  listTimedEffects,
  MINUTE_TURNS,
};
