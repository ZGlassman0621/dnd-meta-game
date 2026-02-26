/**
 * Migration 016: DM Mode Chronicles
 *
 * Adds persistent structured memory for DM Mode sessions.
 * At session end, Sonnet extracts NPCs, locations, plot threads,
 * decisions, and character moments into this table. All chronicles
 * are injected into the next session's system prompt.
 */

export async function up(db) {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS dm_mode_chronicles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      dm_mode_party_id INTEGER NOT NULL,
      session_id INTEGER NOT NULL UNIQUE,
      session_number INTEGER,
      summary TEXT,
      key_decisions TEXT DEFAULT '[]',
      npcs_involved TEXT DEFAULT '[]',
      locations_visited TEXT DEFAULT '[]',
      plot_threads TEXT DEFAULT '[]',
      combat_encounters TEXT DEFAULT '[]',
      items_gained TEXT DEFAULT '[]',
      character_moments TEXT DEFAULT '[]',
      mood TEXT,
      cliffhanger TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (dm_mode_party_id) REFERENCES dm_mode_parties(id),
      FOREIGN KEY (session_id) REFERENCES dm_sessions(id)
    )
  `);

  await db.execute('CREATE INDEX IF NOT EXISTS idx_dm_mode_chronicles_party ON dm_mode_chronicles(dm_mode_party_id)');
  await db.execute('CREATE INDEX IF NOT EXISTS idx_dm_mode_chronicles_session ON dm_mode_chronicles(session_id)');
}

export async function down(db) {
  await db.execute('DROP TABLE IF EXISTS dm_mode_chronicles');
}
