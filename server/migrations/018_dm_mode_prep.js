/**
 * Migration 018: DM Mode Campaign Prep
 * Single table with type discriminator + JSON content blob for
 * NPCs, enemies, locations, lore, treasure, and session notes.
 */

export async function up(db) {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS dm_mode_prep (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      dm_mode_party_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      name TEXT NOT NULL,
      content TEXT DEFAULT '{}',
      sort_order INTEGER DEFAULT 0,
      archived INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (dm_mode_party_id) REFERENCES dm_mode_parties(id),
      UNIQUE(dm_mode_party_id, type, name)
    )
  `);
  await db.execute('CREATE INDEX IF NOT EXISTS idx_dm_mode_prep_party_type ON dm_mode_prep(dm_mode_party_id, type)');
}

export async function down(db) {
  await db.execute('DROP INDEX IF EXISTS idx_dm_mode_prep_party_type');
  await db.execute('DROP TABLE IF EXISTS dm_mode_prep');
}
