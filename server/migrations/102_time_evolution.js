/**
 * Migration 102: time-evolution engine (2026-11-03).
 *
 * Scenes carry a generated anchor (migration 101); evolution needs
 * its own anchors plus an audit trail. Additive columns and two new
 * tables only — the seed packet in seed_json is never rewritten by
 * evolution, so a place's birth record stays intact.
 *
 *   scenes.last_evolved_world_day/year — absolute world day + DR
 *     year of the last applied evolution (NULL until the first).
 *   scenes.last_visited_world_day/year — last return-visit stamp.
 *   scenes.current_occupants / current_use — queryable current
 *     state; the history table is authoritative for the full story.
 *   scene_evolution_history — one row per applied evolution
 *     (a chapter in the place's history).
 *   scene_evolution_news — one row per applied evolution, channel
 *     news/story/song/rumor, for the DM prompt to read. News is
 *     only ever written for an evolution that already happened.
 */
export async function up(db) {
  await db.execute(`ALTER TABLE scenes ADD COLUMN last_evolved_world_day INTEGER`);
  await db.execute(`ALTER TABLE scenes ADD COLUMN last_evolved_world_year INTEGER`);
  await db.execute(`ALTER TABLE scenes ADD COLUMN last_visited_world_day INTEGER`);
  await db.execute(`ALTER TABLE scenes ADD COLUMN last_visited_world_year INTEGER`);
  await db.execute(`ALTER TABLE scenes ADD COLUMN current_occupants TEXT`);
  await db.execute(`ALTER TABLE scenes ADD COLUMN current_use TEXT`);
  await db.execute(`
    CREATE TABLE IF NOT EXISTS scene_evolution_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      scene_id INTEGER NOT NULL,
      world_day INTEGER,
      world_year INTEGER,
      band TEXT NOT NULL,
      previous_occupants TEXT,
      new_occupants TEXT,
      new_use TEXT,
      loot_state TEXT,
      condition TEXT,
      justification TEXT,
      flags_json TEXT NOT NULL DEFAULT '[]',
      event_override TEXT,
      protected INTEGER NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);
  await db.execute(`
    CREATE TABLE IF NOT EXISTS scene_evolution_news (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      scene_id INTEGER NOT NULL,
      channel TEXT NOT NULL,
      body TEXT NOT NULL,
      world_day INTEGER,
      world_year INTEGER,
      party_significant INTEGER NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);
}

export async function down(db) {
  // SQLite cannot drop a column without a table rebuild; the columns
  // and tables are inert when unused, so a rollback leaves them in
  // place (same convention as other additive migrations in this repo).
}
