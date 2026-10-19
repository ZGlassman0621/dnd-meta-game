/**
 * Migration 076: Add level_up_pending_choices to characters.
 *
 * Stores queued level-up choices (ASI/feat, spell selections) for the DM
 * to resolve with the player at next session start.
 */
export async function up(db) {
  await db.execute(`ALTER TABLE characters ADD COLUMN level_up_pending_choices TEXT`);
}

export async function down(db) {
  // SQLite doesn't support DROP COLUMN in older versions; no-op.
}
