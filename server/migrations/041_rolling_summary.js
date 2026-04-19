/**
 * Migration 041: Rolling session summaries
 *
 * Replaces the reactive "compress when the context window fills" pattern with
 * proactive, incremental summarization. Every few turns we condense the older
 * exchanges into a rolling prose summary while keeping the most-recent turns
 * verbatim. Avoids the mid-session latency spike where compression used to
 * fire on a panic threshold.
 *
 * Columns added to `dm_sessions`:
 *   rolling_summary TEXT
 *       Prose summary of everything before `rolling_summary_through_index`.
 *       NULL until the first roll fires for this session.
 *   rolling_summary_through_index INTEGER
 *       Index (into the saved messages array) up to and including which the
 *       summary covers. Messages at indices 0..N (inclusive) have been
 *       summarized; messages at indices N+1..end are kept verbatim.
 *       NULL or 0 before the first roll.
 *   rolling_summary_updated_at TEXT
 *       ISO timestamp of the most recent roll. Used only for telemetry /
 *       troubleshooting.
 *
 * The summary itself is generated in the background (fire-and-forget) after
 * an AI response is saved, so it never delays the turn the player just took.
 * It appears in the NEXT turn's prompt as a synthetic user message stating
 * "PREVIOUS SCENES — SUMMARY: ...", followed by the kept-verbatim tail.
 *
 * Reactive `compressMessageHistory` stays in place as a last-resort fallback
 * in case rolling summaries lag behind (e.g., multiple AI calls in rapid
 * succession).
 */

export async function up(db) {
  const info = await db.execute(`PRAGMA table_info(dm_sessions)`);
  const cols = new Set(info.rows.map(r => r.name));

  if (!cols.has('rolling_summary')) {
    await db.execute(`ALTER TABLE dm_sessions ADD COLUMN rolling_summary TEXT`);
  }
  if (!cols.has('rolling_summary_through_index')) {
    await db.execute(`ALTER TABLE dm_sessions ADD COLUMN rolling_summary_through_index INTEGER`);
  }
  if (!cols.has('rolling_summary_updated_at')) {
    await db.execute(`ALTER TABLE dm_sessions ADD COLUMN rolling_summary_updated_at TEXT`);
  }
}

export async function down(db) {
  // SQLite DROP COLUMN requires 3.35+; safest to leave the columns in place
  // on rollback — they're nullable and harmless.
}
