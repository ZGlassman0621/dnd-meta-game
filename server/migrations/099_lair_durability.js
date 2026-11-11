/**
 * Migration 099: Lair durability (2026-11-02, Zach-approved design).
 *
 * One row per hazard room / lair, independent of any boss row: the boss
 * can die or be deleted and the score does not move. Environmental HP
 * is a HIGH pool (default 1000 at creation); durability % is derived
 * as HP / max HP x 100, so bands are computed, never stored.
 * Stabilization state lives here too: magical hold (halts decay, does
 * not restore HP), collapsed flag, collapse-escape pending flag, and
 * buried flag (escape failed — recorded, never applied as party damage
 * by this migration's service; burial consequences are DM-side).
 * No backfill: lairs created before this migration carry no durability
 * row until the DM declares one with LAIR_CREATE.
 */
export async function up(db) {
  await db.execute(
    `CREATE TABLE IF NOT EXISTS lair_durability (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lair_key TEXT NOT NULL UNIQUE,
      campaign_id INTEGER,
      scene_id INTEGER,
      scene_room_id INTEGER,
      name TEXT NOT NULL DEFAULT '',
      features_json TEXT NOT NULL DEFAULT '[]',
      exits_json TEXT NOT NULL DEFAULT '[]',
      env_hp INTEGER NOT NULL,
      env_max_hp INTEGER NOT NULL,
      magically_stabilized INTEGER NOT NULL DEFAULT 0,
      collapsed INTEGER NOT NULL DEFAULT 0,
      escape_pending INTEGER NOT NULL DEFAULT 0,
      buried INTEGER NOT NULL DEFAULT 0
    )`
  );
}

export function down() {
  // No-op by convention (091 pattern): tables are never dropped.
}
