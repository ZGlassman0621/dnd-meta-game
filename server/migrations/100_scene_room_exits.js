/**
 * Migration 100: scene layer wiring — simple-room exits.
 *
 * Simple rooms created by sceneLinkService (non-dungeon fights) store
 * their exits in scene_rooms.exits_json as [{direction, roomKey}].
 * Dungeon scenes do not use this column; their connections live in
 * scene_connections. Additive column only, no backfill needed.
 */
export async function up(db) {
  await db.execute(`ALTER TABLE scene_rooms ADD COLUMN exits_json TEXT NOT NULL DEFAULT '[]'`);
}

export async function down(db) {
  // SQLite cannot drop a column without a table rebuild; the column is
  // inert when unused, so a rollback leaves it in place (same
  // convention as other additive columns in this repo).
}
