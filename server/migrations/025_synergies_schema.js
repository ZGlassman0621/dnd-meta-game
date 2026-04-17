/**
 * Migration 025: Synergies Schema
 *
 * Creates tables for:
 * - team_tactics: reference catalog of 20 Pathfinder-style team tactics learnable
 *   via downtime training
 * - character_team_tactics: pair-specific tactics each character has learned
 * - subclass_theme_synergies: ~40 resonant subclass × theme pairings
 * - mythic_theme_amplifications: ~20 resonant + dissonant path × theme combos
 *
 * Note on character_team_tactics pair-specific design:
 *   Team Tactics are learned *with a specific partner*. Learning Coordinated Strike
 *   with Tormund does not let you execute it with Sera. Each pair is a separate row.
 */

export async function up(db) {
  // Team Tactics catalog
  await db.execute(`
    CREATE TABLE IF NOT EXISTS team_tactics (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      description TEXT NOT NULL,
      trigger TEXT,
      effect TEXT,
      requirements TEXT,
      CHECK(category IN ('combat', 'utility_skill', 'defensive_survival'))
    )
  `);

  // Each row represents a pair of characters who have learned a specific tactic together
  await db.execute(`
    CREATE TABLE IF NOT EXISTS character_team_tactics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      character_id INTEGER NOT NULL,
      partner_character_id INTEGER NOT NULL,
      tactic_id TEXT NOT NULL,
      learned_at_game_day INTEGER,
      learned_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE,
      FOREIGN KEY (partner_character_id) REFERENCES characters(id) ON DELETE CASCADE,
      FOREIGN KEY (tactic_id) REFERENCES team_tactics(id),
      UNIQUE(character_id, partner_character_id, tactic_id)
    )
  `);

  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_character_team_tactics_char
    ON character_team_tactics(character_id)
  `);

  // Subclass × Theme Synergies (reference data — resonant pairs only)
  await db.execute(`
    CREATE TABLE IF NOT EXISTS subclass_theme_synergies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      class_name TEXT NOT NULL,
      subclass_name TEXT NOT NULL,
      theme_id TEXT NOT NULL,
      synergy_name TEXT NOT NULL,
      description TEXT NOT NULL,
      mechanics TEXT,
      shared_tags TEXT,
      FOREIGN KEY (theme_id) REFERENCES themes(id),
      UNIQUE(class_name, subclass_name, theme_id)
    )
  `);

  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_subclass_theme_synergies_lookup
    ON subclass_theme_synergies(class_name, subclass_name, theme_id)
  `);

  // Mythic × Theme Amplifications (resonant combos) and Dissonant Arcs
  await db.execute(`
    CREATE TABLE IF NOT EXISTS mythic_theme_amplifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mythic_path TEXT NOT NULL,
      theme_id TEXT NOT NULL,
      combo_name TEXT NOT NULL,
      is_dissonant INTEGER DEFAULT 0,
      shared_identity TEXT,
      t1_bonus TEXT,
      t2_bonus TEXT,
      t3_bonus TEXT,
      t4_bonus TEXT,
      dissonant_arc_description TEXT,
      required_threshold_acts INTEGER,
      FOREIGN KEY (theme_id) REFERENCES themes(id),
      UNIQUE(mythic_path, theme_id)
    )
  `);

  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_mythic_theme_amplifications_lookup
    ON mythic_theme_amplifications(mythic_path, theme_id)
  `);
}

export async function down(db) {
  await db.execute('DROP TABLE IF EXISTS mythic_theme_amplifications');
  await db.execute('DROP TABLE IF EXISTS subclass_theme_synergies');
  await db.execute('DROP TABLE IF EXISTS character_team_tactics');
  await db.execute('DROP TABLE IF EXISTS team_tactics');
}
