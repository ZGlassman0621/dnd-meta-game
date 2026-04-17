/**
 * Migration 023: Themes Schema
 *
 * Creates the core Themes system that replaces static D&D Backgrounds with a
 * four-tier progression layer (L1/L5/L11/L17).
 *
 * Tables:
 * - themes: reference table of the 21 theme definitions
 * - theme_abilities: per-tier abilities for each theme (one ability per tier,
 *   as defined in THEME_DESIGNS.md)
 * - character_themes: which theme each character has chosen + any creation-time
 *   path choice (Knight order type, Outlander biome)
 * - character_theme_unlocks: tracks which tier abilities a character has unlocked
 * - knight_moral_paths: state tracker for Knight of the Order's six paths
 *   (True/Reformer/Martyr/Complicit/Fallen/Redemption). Other themes that have
 *   behavior-contingent states can reuse this pattern later.
 */

export async function up(db) {
  // Reference: theme definitions
  await db.execute(`
    CREATE TABLE IF NOT EXISTS themes (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      identity TEXT,
      signature_skill_1 TEXT,
      signature_skill_2 TEXT,
      tags TEXT,
      creation_choice_label TEXT,
      creation_choice_options TEXT,
      divergence_notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Reference: per-tier abilities for each theme
  await db.execute(`
    CREATE TABLE IF NOT EXISTS theme_abilities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      theme_id TEXT NOT NULL,
      tier INTEGER NOT NULL,
      ability_name TEXT NOT NULL,
      ability_description TEXT NOT NULL,
      mechanics TEXT,
      flavor_text TEXT,
      path_variant TEXT,
      FOREIGN KEY (theme_id) REFERENCES themes(id),
      UNIQUE(theme_id, tier, path_variant)
    )
  `);

  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_theme_abilities_theme
    ON theme_abilities(theme_id, tier)
  `);

  // Character's theme selection
  await db.execute(`
    CREATE TABLE IF NOT EXISTS character_themes (
      character_id INTEGER PRIMARY KEY,
      theme_id TEXT NOT NULL,
      path_choice TEXT,
      path_data TEXT,
      assigned_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE,
      FOREIGN KEY (theme_id) REFERENCES themes(id)
    )
  `);

  // Track which tier abilities a character has unlocked
  await db.execute(`
    CREATE TABLE IF NOT EXISTS character_theme_unlocks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      character_id INTEGER NOT NULL,
      theme_id TEXT NOT NULL,
      tier INTEGER NOT NULL,
      tier_ability_id INTEGER,
      unlocked_at_level INTEGER NOT NULL,
      unlocked_at_game_day INTEGER,
      narrative_delivery TEXT,
      unlocked_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE,
      FOREIGN KEY (theme_id) REFERENCES themes(id),
      FOREIGN KEY (tier_ability_id) REFERENCES theme_abilities(id),
      UNIQUE(character_id, tier)
    )
  `);

  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_character_theme_unlocks_char
    ON character_theme_unlocks(character_id)
  `);

  // Knight of the Order moral path tracker
  // Other themes with behavior-contingent states can add their own trackers
  // later; this one is Knight-specific per the six-path design.
  await db.execute(`
    CREATE TABLE IF NOT EXISTS knight_moral_paths (
      character_id INTEGER PRIMARY KEY,
      current_path TEXT NOT NULL DEFAULT 'true',
      path_history TEXT,
      last_path_change_session_id INTEGER,
      last_path_change_reason TEXT,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE,
      CHECK(current_path IN ('true', 'reformer', 'martyr', 'complicit', 'fallen', 'redemption'))
    )
  `);
}

export async function down(db) {
  await db.execute('DROP TABLE IF EXISTS knight_moral_paths');
  await db.execute('DROP TABLE IF EXISTS character_theme_unlocks');
  await db.execute('DROP TABLE IF EXISTS character_themes');
  await db.execute('DROP TABLE IF EXISTS theme_abilities');
  await db.execute('DROP TABLE IF EXISTS themes');
}
