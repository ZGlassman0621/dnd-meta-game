/**
 * In-flight session locks.
 *
 * Phase 2.2 — prevents a turn being processed twice for the same session. The
 * message endpoint makes a slow LLM call mid-handler, so a client retry after a
 * timeout (or an impatient second tab) would otherwise fire a second LLM call
 * and apply a second set of markers to the same session — double loot, double
 * gold, double piety, all from one narrative beat.
 *
 * Scope and limits, stated plainly:
 *
 *  - This is per-process memory. A clustered or multi-instance deployment would
 *    need a database or Redis lock instead. That is a deliberate fit to a
 *    single-player, single-process app; revisit it if that ever changes.
 *  - It protects against concurrent duplicates, not sequential ones. A retry
 *    after the first turn has fully completed is indistinguishable from the
 *    player legitimately sending another action, and is allowed through.
 *
 * A Map with timestamps rather than a bare Set: if a handler somehow exits
 * without releasing, a bare Set would wedge that session permanently with no
 * recovery short of a server restart. The stale sweep bounds that damage.
 */

/** sessionId (string) → epoch ms when the lock was taken. */
const inFlight = new Map();

/**
 * How long a lock may be held before it is presumed abandoned.
 * Comfortably longer than the slowest realistic turn: a long the model response with
 * retries can run into the low minutes, and expiring a live turn would let the
 * duplicate through — the exact thing this exists to stop.
 */
export const STALE_LOCK_MS = 10 * 60 * 1000;

/**
 * Try to take the lock for a session.
 *
 * @param {string|number} sessionId
 * @returns {{ acquired: boolean, heldForMs?: number }} `acquired: false` when a
 *   turn is already in flight; `heldForMs` reports how long it has been running,
 *   which is useful in the 409 body and in logs.
 */
export function acquireSessionLock(sessionId) {
  const key = String(sessionId);
  const existing = inFlight.get(key);

  if (existing !== undefined) {
    const heldForMs = Date.now() - existing;
    if (heldForMs < STALE_LOCK_MS) {
      return { acquired: false, heldForMs };
    }
    // Presumed abandoned — take it over rather than wedge the session forever.
    console.warn(
      `[sessionLocks] reclaiming stale lock on session ${key} after ${Math.round(heldForMs / 1000)}s`
    );
  }

  inFlight.set(key, Date.now());
  return { acquired: true };
}

/**
 * Release the lock. Safe to call when not held, so it can live in a `finally`
 * without the caller tracking whether acquisition succeeded.
 *
 * @param {string|number} sessionId
 */
export function releaseSessionLock(sessionId) {
  inFlight.delete(String(sessionId));
}

/** Whether a turn is currently in flight for this session. */
export function isSessionLocked(sessionId) {
  const started = inFlight.get(String(sessionId));
  if (started === undefined) return false;
  return Date.now() - started < STALE_LOCK_MS;
}

/** Test helper — drops every lock. Not used in production paths. */
export function _clearAllSessionLocks() {
  inFlight.clear();
}
