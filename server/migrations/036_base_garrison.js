/**
 * Migration 036: Base Garrison + Defense (F2)
 *
 * Adds defensive stats to bases and a table for assigning companions as
 * named garrison officers. Foundation for F3 (raid/siege world events).
 *
 * Columns on `party_bases`:
 *   defense_rating    INTEGER — derived from building perks +
 *                               officer bonuses. Compared to attacker
 *                               force in F3 raid/siege resolution.
 *   garrison_strength INTEGER — anonymous troop capacity derived from
 *                               building perks (barracks etc.). Officers
 *                               lead them but aren't counted here.
 *   subtype_defense_bonus INTEGER — inherent defense bonus from subtype
 *                                   (fortress/castle start higher than
 *                                   tavern). Set at creation, static.
 *
 * New table `base_officers`:
 *   Links companions to bases in leadership roles. One officer per
 *   companion per base (unique). Each officer adds defense from their
 *   companion_level (min 1).
 */

export async function up(db) {
  // Add defense columns to party_bases
  const existing = await db.execute(`PRAGMA table_info(party_bases)`);
  const existingNames = new Set(existing.rows.map(r => r.name));
  const additions = [
    { col: 'defense_rating', sql: 'ALTER TABLE party_bases ADD COLUMN defense_rating INTEGER DEFAULT 0' },
    { col: 'garrison_strength', sql: 'ALTER TABLE party_bases ADD COLUMN garrison_strength INTEGER DEFAULT 0' },
    { col: 'subtype_defense_bonus', sql: 'ALTER TABLE party_bases ADD COLUMN subtype_defense_bonus INTEGER DEFAULT 0' }
  ];
  for (const { col, sql } of additions) {
    if (!existingNames.has(col)) await db.execute(sql);
  }

  // Officers: companions assigned to a base in a leadership role.
  await db.execute(`
    CREATE TABLE IF NOT EXISTS base_officers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      base_id INTEGER NOT NULL,
      companion_id INTEGER NOT NULL,
      role TEXT NOT NULL DEFAULT 'garrison_officer',
      assigned_at_game_day INTEGER,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(base_id, companion_id),
      FOREIGN KEY (base_id) REFERENCES party_bases(id) ON DELETE CASCADE,
      FOREIGN KEY (companion_id) REFERENCES companions(id) ON DELETE CASCADE
    )
  `);
  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_base_officers_base
    ON base_officers(base_id)
  `);
  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_base_officers_companion
    ON base_officers(companion_id)
  `);
}

export async function down(db) {
  await db.execute('DROP INDEX IF EXISTS idx_base_officers_companion');
  await db.execute('DROP INDEX IF EXISTS idx_base_officers_base');
  await db.execute('DROP TABLE IF EXISTS base_officers');
  // SQLite can't drop columns; leave defense_rating/garrison_strength/subtype_defense_bonus in place.
}
