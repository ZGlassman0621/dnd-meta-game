/**
 * Migration 046: dm_sessions.transcript
 *
 * v1.0.95 — separate full transcript from rolling-summary-compacted messages.
 *
 * Background: `dm_sessions.messages` is the LLM-facing conversation array.
 * When the rolling summary fires (≥30 messages), the older messages are
 * replaced with a synthetic "PREVIOUS SCENES — SUMMARY" block before the
 * next AI call, and the COMPACTED version gets persisted back to .messages.
 *
 * Side effect: anything downstream that wanted the full play history
 * (chronicle generation, recap, the player's transcript display, exports,
 * the playtest turn counter) was reading a lossy view.
 *
 * Fix: add a separate `transcript` column that grows append-only with the
 * actual full message history. `messages` continues to drive what the LLM
 * sees (compacted, bounded). `transcript` becomes the source of truth for
 * "what happened in this session."
 *
 * Backfill: existing sessions get NULL initially. On first persist after
 * this migration, the route layer copies the current .messages contents
 * over as the initial transcript baseline (better than nothing, even if
 * it's already partially compacted).
 */

export async function up(db) {
  await db.execute(`ALTER TABLE dm_sessions ADD COLUMN transcript TEXT DEFAULT NULL`);
}

export async function down(db) {
  // SQLite pre-3.35 doesn't support DROP COLUMN cleanly; no-op on down
  // per this project's convention.
}
