/**
 * Session Recovery Service — startup sweep for abandoned sessions.
 *
 * Phase 3 (Continuous persistence). The problem: a DM session that is never
 * formally ended (browser closed, server crash, machine sleep) keeps its
 * status at 'active' or 'paused' and NEVER gets a story_chronicles row — so the
 * structured recap + canon facts for everything that happened in that session
 * are lost forever, even though the verbatim transcript is sitting in
 * dm_sessions.messages.
 *
 * The fix: on boot, sweep for sessions that look abandoned but salvageable —
 * status IN ('active','paused'), a non-trivial message history, and NO
 * chronicle yet — and generate the chronicle for each via the (now non-lossy)
 * generateSessionChronicle. The session's status is intentionally LEFT ALONE:
 * the player may still want to resume an 'active'/'paused' session, and the
 * chronicle generator is idempotent, so a later /end-session simply no-ops the
 * second write. Recovery only ensures the memory exists; it does not close the
 * session.
 *
 * Guarantees:
 *   - IDEMPOTENT: selection excludes sessions that already have a chronicle, and
 *     generateSessionChronicle ALSO guards on "chronicle already exists for this
 *     session" — so running the sweep twice (or racing the /end-session path)
 *     never double-writes.
 *   - NEVER throws into boot: every per-session call is wrapped in try/catch;
 *     a failure is logged and the sweep continues with the next session. The
 *     top-level call is itself defensive in index.js.
 */

import { dbAll } from '../database.js';
import { generateSessionChronicle } from './storyChronicleService.js';
import { safeParse } from '../utils/safeParse.js';

// A session needs at least this many conversation (non-system) messages before
// it's worth a chronicle. Mirrors the "too short for chronicle" floor in
// generateSessionChronicle (which bails under 2) but is stricter here so the
// recovery sweep doesn't spend an LLM call on a session that barely started.
export const MIN_RECOVERABLE_MESSAGES = 4;

/**
 * Count the conversation (non-system) messages in a stored dm_sessions.messages
 * JSON blob. Defensive: bad/empty JSON counts as 0.
 *
 * @param {string} messagesJson
 * @returns {number}
 */
export function countConversationMessages(messagesJson) {
  const parsed = safeParse(messagesJson, []);
  if (!Array.isArray(parsed)) return 0;
  return parsed.filter(m => m && m.role !== 'system').length;
}

/**
 * Find dm_sessions that are abandoned-but-recoverable: open status, enough
 * history to be worth recapping, and no chronicle yet.
 *
 * The "no chronicle yet" filter is done in SQL via NOT EXISTS so the sweep
 * stays idempotent at the selection layer even before the per-session guard.
 * The message-count floor can't be expressed cleanly in SQL against a JSON TEXT
 * column, so we over-select on status + chronicle-absence and filter the count
 * in JS.
 *
 * @returns {Promise<Array<{id:number, messageCount:number}>>}
 */
export async function findAbandonedSessions() {
  const rows = await dbAll(
    `SELECT s.id, s.messages
       FROM dm_sessions s
      WHERE s.status IN ('active', 'paused')
        AND NOT EXISTS (
          SELECT 1 FROM story_chronicles c WHERE c.session_id = s.id
        )`
  );

  const recoverable = [];
  for (const row of rows) {
    const messageCount = countConversationMessages(row.messages);
    if (messageCount >= MIN_RECOVERABLE_MESSAGES) {
      recoverable.push({ id: Number(row.id), messageCount });
    }
  }
  return recoverable;
}

/**
 * Startup recovery sweep. Generates a chronicle for each abandoned-but-
 * recoverable session. Idempotent and crash-safe.
 *
 * @returns {Promise<{scanned:number, recovered:number, failed:number, skipped:number}>}
 *   A summary for logging/tests. Always resolves; never rejects.
 */
export async function recoverAbandonedSessions() {
  let candidates = [];
  try {
    candidates = await findAbandonedSessions();
  } catch (e) {
    // A failure to even SELECT must not crash boot.
    console.error('[Recovery] Failed to scan for abandoned sessions:', e.message);
    return { scanned: 0, recovered: 0, failed: 0, skipped: 0 };
  }

  if (candidates.length === 0) {
    console.log('[Recovery] No abandoned sessions need chronicling.');
    return { scanned: 0, recovered: 0, failed: 0, skipped: 0 };
  }

  console.log(`[Recovery] ${candidates.length} abandoned session(s) without a chronicle — generating recaps.`);

  let recovered = 0;
  let failed = 0;
  let skipped = 0;

  for (const { id } of candidates) {
    try {
      const result = await generateSessionChronicle(id);
      if (result) {
        // Either a freshly created chronicle ({ sessionNumber, ... }) or the
        // pre-existing guard row ({ id }). Both mean "a chronicle now exists".
        if (result.sessionNumber) {
          recovered++;
          console.log(`[Recovery] Chronicled abandoned session ${id} (#${result.sessionNumber}).`);
        } else {
          // Raced with /end-session or a prior sweep — chronicle already there.
          skipped++;
        }
      } else {
        // generateSessionChronicle returned null (too short, parse failure, or
        // the LLM extraction failed). Not fatal — log and continue.
        skipped++;
        console.log(`[Recovery] Session ${id} produced no chronicle (skipped).`);
      }
    } catch (e) {
      failed++;
      console.error(`[Recovery] Failed to chronicle abandoned session ${id}:`, e.message);
    }
  }

  console.log(`[Recovery] Sweep complete: ${recovered} recovered, ${skipped} skipped, ${failed} failed (of ${candidates.length} scanned).`);
  return { scanned: candidates.length, recovered, failed, skipped };
}

export default {
  recoverAbandonedSessions,
  findAbandonedSessions,
  countConversationMessages,
  MIN_RECOVERABLE_MESSAGES
};
