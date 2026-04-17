/**
 * Migration 028: Companion Progression (Phase 5.5)
 *
 * Companion analog of the Theme + Ancestry Feat tables created for player
 * characters in migrations 023 and 024. Companions get their own tables so
 * they can progress alongside players without muddying the character-scoped
 * tables.
 *
 * Tables:
 * - companion_themes: which theme a companion has been auto-assigned
 * - companion_theme_unlocks: which tier abilities have unlocked as they
 *   level up (auto-unlock at L1/L5/L11/L17)
 * - companion_ancestry_feats: which feats the system auto-picked at
 *   L1/L3/L7/L13/L18
 */

export async function up(db) {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS companion_themes (
      companion_id INTEGER PRIMARY KEY,
      theme_id TEXT NOT NULL,
      path_choice TEXT,
      path_data TEXT,
      assigned_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (companion_id) REFERENCES companions(id) ON DELETE CASCADE,
      FOREIGN KEY (theme_id) REFERENCES themes(id)
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS companion_theme_unlocks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      companion_id INTEGER NOT NULL,
      theme_id TEXT NOT NULL,
      tier INTEGER NOT NULL,
      tier_ability_id INTEGER,
      unlocked_at_level INTEGER NOT NULL,
      narrative_delivery TEXT,
      unlocked_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (companion_id) REFERENCES companions(id) ON DELETE CASCADE,
      FOREIGN KEY (theme_id) REFERENCES themes(id),
      FOREIGN KEY (tier_ability_id) REFERENCES theme_abilities(id),
      UNIQUE(companion_id, tier)
    )
  `);

  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_companion_theme_unlocks_companion
    ON companion_theme_unlocks(companion_id)
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS companion_ancestry_feats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      companion_id INTEGER NOT NULL,
      feat_id INTEGER NOT NULL,
      tier INTEGER NOT NULL,
      selected_at_level INTEGER NOT NULL,
      narrative_delivery TEXT,
      path_variant TEXT,
      selected_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (companion_id) REFERENCES companions(id) ON DELETE CASCADE,
      FOREIGN KEY (feat_id) REFERENCES ancestry_feats(id),
      UNIQUE(companion_id, tier)
    )
  `);

  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_companion_ancestry_feats_companion
    ON companion_ancestry_feats(companion_id)
  `);
}

export async function down(db) {
  await db.execute('DROP TABLE IF EXISTS companion_ancestry_feats');
  await db.execute('DROP TABLE IF EXISTS companion_theme_unlocks');
  await db.execute('DROP TABLE IF EXISTS companion_themes');
}
