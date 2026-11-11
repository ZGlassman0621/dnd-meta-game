/**
 * Migration 101: dungeon generation time anchor.
 *
 * dungeonGenerationService records, for each generated scene, the
 * world day/year it was generated on — the anchor the later
 * time-evolution layer measures elapsed time from (a place persists,
 * but its occupants and use evolve with world time). The seed packet
 * in scenes.seed_json is the authoritative anchor (seedPacket.
 * timeAnchor); these columns are a queryable mirror, best-effort
 * written by the service. Additive columns only, no backfill needed
 * (older scenes simply have NULL anchors).
 */
export async function up(db) {
  await db.execute(`ALTER TABLE scenes ADD COLUMN generated_world_day INTEGER`);
  await db.execute(`ALTER TABLE scenes ADD COLUMN generated_world_year INTEGER`);
}

export async function down(db) {
  // SQLite cannot drop a column without a table rebuild; the columns
  // are inert when unused, so a rollback leaves them in place (same
  // convention as other additive columns in this repo).
}
