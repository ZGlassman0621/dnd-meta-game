/**
 * Migration 024: Ancestry Feats Schema
 *
 * Creates the Ancestry Feats system — 5-tier progression at L1/L3/L7/L13/L18,
 * with 3 feat choices per tier, per race. 12 effective lists (10 races + Drow
 * subrace + Aasimar paths) × 5 tiers × 3 choices = 180 feats total.
 *
 * Tables:
 * - ancestry_feats: reference table of all feat definitions
 * - character_ancestry_feats: which feats each character has selected at each tier
 *
 * Note on list_id: combines race + subrace/path variant into one string key.
 *   Examples: 'dwarf', 'elf', 'drow', 'aasimar_protector', 'aasimar_scourge',
 *   'aasimar_fallen', 'human', 'halfling', 'dragonborn', 'half_elf', 'half_orc',
 *   'tiefling', 'warforged'.
 */

export async function up(db) {
  // Reference: feat catalog
  await db.execute(`
    CREATE TABLE IF NOT EXISTS ancestry_feats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      list_id TEXT NOT NULL,
      tier INTEGER NOT NULL,
      choice_index INTEGER NOT NULL,
      feat_name TEXT NOT NULL,
      description TEXT NOT NULL,
      mechanics TEXT,
      flavor_text TEXT,
      UNIQUE(list_id, tier, choice_index)
    )
  `);

  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_ancestry_feats_list
    ON ancestry_feats(list_id, tier)
  `);

  // Character's selected feats
  await db.execute(`
    CREATE TABLE IF NOT EXISTS character_ancestry_feats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      character_id INTEGER NOT NULL,
      feat_id INTEGER NOT NULL,
      tier INTEGER NOT NULL,
      selected_at_level INTEGER NOT NULL,
      selected_at_game_day INTEGER,
      narrative_delivery TEXT,
      path_variant TEXT,
      selected_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE,
      FOREIGN KEY (feat_id) REFERENCES ancestry_feats(id),
      UNIQUE(character_id, tier)
    )
  `);

  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_character_ancestry_feats_char
    ON character_ancestry_feats(character_id)
  `);
}

export async function down(db) {
  await db.execute('DROP TABLE IF EXISTS character_ancestry_feats');
  await db.execute('DROP TABLE IF EXISTS ancestry_feats');
}
