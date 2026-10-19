/**
 * Migration 073: Custom spells (Combat Pipeline #12 extension).
 * Homebrew spells. lookupSpell() checks here first, then SRD catalog.
 * Mirrors the bestiary pattern.
 */
export async function up(db) {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS custom_spells (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      level INTEGER NOT NULL DEFAULT 0,
      school TEXT DEFAULT '',
      cast_time TEXT DEFAULT 'action',
      range_text TEXT DEFAULT '',
      components TEXT DEFAULT '',
      material_desc TEXT DEFAULT '',
      concentration INTEGER NOT NULL DEFAULT 0,
      duration_text TEXT DEFAULT '',
      description TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_custom_spells_name ON custom_spells(name)`);
}
export async function down(db) {
  await db.execute('DROP INDEX IF EXISTS idx_custom_spells_name');
  await db.execute('DROP TABLE IF EXISTS custom_spells');
}
