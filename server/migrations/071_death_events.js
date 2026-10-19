/**
 * Migration 071: Death events (Combat Pipeline #8).
 * Death is an event, not just a flag. Enables kill-loot (#9) and kill-XP (#10).
 */
export async function up(db) {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS combat_death_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL,
      encounter_seq INTEGER NOT NULL,
      enemy_id INTEGER,
      enemy_name TEXT NOT NULL,
      killed_by TEXT,
      xp_value INTEGER DEFAULT 0,
      looted INTEGER NOT NULL DEFAULT 0,
      xp_awarded INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (session_id) REFERENCES dm_sessions(id) ON DELETE CASCADE
    )
  `);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_death_events_session ON combat_death_events(session_id, encounter_seq)`);
}
export async function down(db) {
  await db.execute('DROP INDEX IF EXISTS idx_death_events_session');
  await db.execute('DROP TABLE IF EXISTS combat_death_events');
}
