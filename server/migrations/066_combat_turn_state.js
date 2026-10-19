/**
 * Migration 066: Combat Turn State (Combat Pipeline #2).
 * Foundation for turn order enforcement.
 */
export async function up(db) {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS combat_turn_state (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL,
      encounter_seq INTEGER NOT NULL,
      turn_order_json TEXT NOT NULL,
      current_index INTEGER NOT NULL DEFAULT 0,
      round_number INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (session_id) REFERENCES dm_sessions(id) ON DELETE CASCADE,
      UNIQUE(session_id, encounter_seq)
    )
  `);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_combat_turn_state ON combat_turn_state(session_id, encounter_seq)`);
}
export async function down(db) {
  await db.execute('DROP INDEX IF EXISTS idx_combat_turn_state');
  await db.execute('DROP TABLE IF EXISTS combat_turn_state');
}
