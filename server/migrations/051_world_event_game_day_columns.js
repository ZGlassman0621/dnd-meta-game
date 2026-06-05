/**
 * Migration 051: world_events game-day clock standardization.
 *
 * Phase 3.3 SC-7.7 (v1.0.161). Adds `started_game_day` and
 * `deadline_game_day` integer columns to `world_events`. Pre-SC-7.7,
 * world events tracked time via `started_at` (DATETIME) and `deadline`
 * (TEXT, ISO timestamp). Both used `new Date()` comparisons in the tick
 * processor — making world events the only consumer in the codebase
 * NOT running on the `currentGameDay` clock. Pattern D survey §1.12
 * (2026-05-04) flagged this as a clock-divergence bug; SC-7.7 fixes it.
 *
 * Backfill strategy:
 *   - `started_game_day`: best-effort backfill to MAX(game_day) per
 *     campaign for active events. Treats existing events as "started
 *     today" in game-time terms — their `current_stage` is already
 *     baked in (past advances happened), so future advances measure
 *     from this fresh anchor. Acceptable: the bug we're fixing is
 *     real-time-vs-game-day mismatch going FORWARD; past advances are
 *     historical and untouched.
 *   - `deadline_game_day`: stays NULL for legacy events. The deadline
 *     check gracefully no-ops on null. New events written via
 *     createWorldEvent populate the field directly.
 *
 * Additive only — `started_at` and `deadline` columns stay (vestigial,
 * for any code that still reads them; SC-7.7 stops writing them as
 * the source of truth).
 */

export async function up(db) {
  // Add columns idempotently
  const cols = await db.execute(`PRAGMA table_info(world_events)`);
  const colNames = cols.rows.map(c => c.name);
  if (!colNames.includes('started_game_day')) {
    await db.execute(`ALTER TABLE world_events ADD COLUMN started_game_day INTEGER`);
  }
  if (!colNames.includes('deadline_game_day')) {
    await db.execute(`ALTER TABLE world_events ADD COLUMN deadline_game_day INTEGER`);
  }

  // Backfill: for each campaign with active events, set started_game_day
  // = current_max_game_day for that campaign's characters. Events
  // associated with campaigns that have no characters (edge case) get
  // NULL — the tick processor's null-anchor short-circuit handles them.
  await db.execute(`
    UPDATE world_events
    SET started_game_day = (
      SELECT MAX(c.game_day)
      FROM characters c
      WHERE c.campaign_id = world_events.campaign_id
    )
    WHERE started_game_day IS NULL
      AND status = 'active'
      AND campaign_id IS NOT NULL
  `);
}

export async function down(db) {
  // SQLite < 3.35 doesn't support DROP COLUMN portably; we leave the
  // columns in place on rollback. They're nullable and the new code
  // continues working with the legacy timestamp columns as fallback.
}
