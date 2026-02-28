/**
 * Migration 017: DM Mode Extensions
 * - dm_mode_npcs table (NPC Codex with voice tracking)
 * - dm_mode_plot_threads table (plot thread management with tags)
 * - current_game_day column on dm_mode_parties
 */

export async function up(db) {
  // NPC Codex table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS dm_mode_npcs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      dm_mode_party_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      role TEXT,
      description TEXT,
      voice_notes TEXT,
      sessions_appeared TEXT DEFAULT '[]',
      first_seen_session INTEGER,
      last_seen_session INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (dm_mode_party_id) REFERENCES dm_mode_parties(id),
      UNIQUE(dm_mode_party_id, name)
    )
  `);
  await db.execute('CREATE INDEX IF NOT EXISTS idx_dm_mode_npcs_party ON dm_mode_npcs(dm_mode_party_id)');

  // Plot Thread table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS dm_mode_plot_threads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      dm_mode_party_id INTEGER NOT NULL,
      thread_name TEXT NOT NULL,
      status TEXT DEFAULT 'ongoing',
      details TEXT,
      tags TEXT DEFAULT '[]',
      first_seen_session INTEGER,
      resolved_session INTEGER,
      source TEXT DEFAULT 'auto',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (dm_mode_party_id) REFERENCES dm_mode_parties(id),
      UNIQUE(dm_mode_party_id, thread_name)
    )
  `);
  await db.execute('CREATE INDEX IF NOT EXISTS idx_dm_mode_plot_threads_party ON dm_mode_plot_threads(dm_mode_party_id)');

  // Game day tracking on parties
  try {
    await db.execute("ALTER TABLE dm_mode_parties ADD COLUMN current_game_day INTEGER DEFAULT 1");
  } catch (e) {
    if (!e.message?.includes('duplicate column')) throw e;
  }
}

export async function down(db) {
  await db.execute('DROP INDEX IF EXISTS idx_dm_mode_npcs_party');
  await db.execute('DROP TABLE IF EXISTS dm_mode_npcs');
  await db.execute('DROP INDEX IF EXISTS idx_dm_mode_plot_threads_party');
  await db.execute('DROP TABLE IF EXISTS dm_mode_plot_threads');
}
