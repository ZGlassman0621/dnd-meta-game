/**
 * Migration 064: Combat Enemies (Structural #8)
 *
 * Server-side enemy HP + enemy turn resolution. Before this, combat was
 * theater: enemies were names in a turn-order array, the AI narrated their
 * actions and rolled "itself," and nothing prevented every fight from
 * resolving in the party's favor.
 *
 * combat_enemies gives each enemy real HP, AC, attack bonus, and damage dice
 * in the database. The server rolls enemy attacks via rng.js and applies
 * damage through the same applyHpChange() path as player damage.
 */

export async function up(db) {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS combat_enemies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL,
      encounter_seq INTEGER NOT NULL DEFAULT 1,
      name TEXT NOT NULL,
      max_hp INTEGER NOT NULL,
      current_hp INTEGER NOT NULL,
      armor_class INTEGER NOT NULL DEFAULT 10,
      attack_bonus INTEGER NOT NULL DEFAULT 0,
      damage_dice TEXT NOT NULL DEFAULT '1d6',
      dex_mod INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'active'
        CHECK(status IN ('active', 'dead', 'fled')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (session_id) REFERENCES dm_sessions(id) ON DELETE CASCADE
    )
  `);

  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_combat_enemies_session
    ON combat_enemies(session_id, encounter_seq, status)
  `);

  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_combat_enemies_name
    ON combat_enemies(session_id, encounter_seq, name)
  `);
}

export async function down(db) {
  await db.execute('DROP INDEX IF EXISTS idx_combat_enemies_name');
  await db.execute('DROP INDEX IF EXISTS idx_combat_enemies_session');
  await db.execute('DROP TABLE IF EXISTS combat_enemies');
}
