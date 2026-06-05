/**
 * Migration 052: survival_intensity column on characters.
 *
 * Phase 3.3 SC-7.6.5 (v1.0.162). Adds the player-tunable survival
 * intensity setting per spec §3.3.10. Four-position slider:
 *   'off' | 'lenient' | 'standard' | 'strict'
 *
 * Default 'standard' for all rows — byte-identical behavior to SC-7.6's
 * shipped state for any character who hasn't explicitly chosen otherwise.
 *
 * Per spec §3.3.10 storage shape: CHECK constraint enforces the four
 * allowed values; runtime reads the value at decay/threshold evaluation
 * time (not at consumer-registration time) so the setting can change
 * mid-campaign without rebuilding consumers.
 *
 * Idempotent — checks PRAGMA table_info before ALTER. No backfill needed
 * beyond the default; all existing rows pick up 'standard' as the
 * default value when the column is added.
 */

export async function up(db) {
  const cols = await db.execute(`PRAGMA table_info(characters)`);
  const hasColumn = cols.rows.some(c => c.name === 'survival_intensity');
  if (!hasColumn) {
    // SQLite ALTER TABLE doesn't support adding a CHECK constraint inline;
    // we add the column with a default and rely on application-layer
    // validation (PUT allowlist) to enforce the enum. The CHECK
    // constraint shape is documented in this migration's header for
    // when a future schema-recreate ship adds it via table rebuild.
    await db.execute(
      `ALTER TABLE characters ADD COLUMN survival_intensity TEXT NOT NULL DEFAULT 'standard'`
    );
  }
}

export async function down(db) {
  // SQLite < 3.35 doesn't support DROP COLUMN portably; we leave the
  // column in place on rollback. Existing rows keep their value;
  // application layer ignores the column when SC-7.6.5 is rolled back
  // (defaults to 'standard' read).
}
