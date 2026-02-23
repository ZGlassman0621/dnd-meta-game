/**
 * Migration 010 — Mythic Progression System
 *
 * Creates tables for mythic tiers, paths, abilities, trials, piety, epic boons,
 * and legendary items. Adds glory/shadow point columns to characters.
 */

export async function up(db) {
  const addColumn = async (table, col, sql) => {
    const columns = await db.execute(`PRAGMA table_info(${table})`);
    const exists = columns.rows.some(r => r.name === col);
    if (!exists) await db.execute(sql);
  };

  // Quick boolean on characters for mythic status
  await addColumn('characters', 'has_mythic',
    'ALTER TABLE characters ADD COLUMN has_mythic INTEGER DEFAULT 0');

  // Glory and Shadow points on characters
  await addColumn('characters', 'glory_points',
    'ALTER TABLE characters ADD COLUMN glory_points INTEGER DEFAULT 0');
  await addColumn('characters', 'shadow_points',
    'ALTER TABLE characters ADD COLUMN shadow_points INTEGER DEFAULT 0');

  // Core mythic character state
  await db.execute(`
    CREATE TABLE IF NOT EXISTS mythic_characters (
      character_id INTEGER PRIMARY KEY,
      mythic_tier INTEGER DEFAULT 0,
      mythic_path TEXT,
      mythic_power_max INTEGER DEFAULT 0,
      mythic_power_used INTEGER DEFAULT 0,
      surge_die TEXT DEFAULT 'd6',
      trials_completed INTEGER DEFAULT 0,
      trials_required INTEGER DEFAULT 1,
      path_selected_game_day INTEGER,
      tier_unlocked_game_day INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Trial audit trail
  await db.execute(`
    CREATE TABLE IF NOT EXISTS mythic_trials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      character_id INTEGER NOT NULL,
      campaign_id INTEGER,
      tier_at_completion INTEGER,
      trial_name TEXT NOT NULL,
      trial_description TEXT,
      outcome TEXT NOT NULL DEFAULT 'passed',
      path_effect TEXT,
      game_day INTEGER,
      session_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Unlocked mythic abilities per character
  await db.execute(`
    CREATE TABLE IF NOT EXISTS mythic_abilities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      character_id INTEGER NOT NULL,
      ability_key TEXT NOT NULL,
      ability_type TEXT NOT NULL DEFAULT 'base',
      tier_unlocked INTEGER NOT NULL,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(character_id, ability_key)
    )
  `);

  // Deity piety scores
  await db.execute(`
    CREATE TABLE IF NOT EXISTS character_piety (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      character_id INTEGER NOT NULL,
      deity_name TEXT NOT NULL,
      piety_score INTEGER DEFAULT 1,
      highest_threshold_unlocked INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(character_id, deity_name)
    )
  `);

  // Selected epic boons
  await db.execute(`
    CREATE TABLE IF NOT EXISTS character_epic_boons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      character_id INTEGER NOT NULL,
      boon_key TEXT NOT NULL,
      ability_score_bonus TEXT,
      game_day_acquired INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(character_id, boon_key)
    )
  `);

  // Legendary items with evolving states
  await db.execute(`
    CREATE TABLE IF NOT EXISTS legendary_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      character_id INTEGER NOT NULL,
      campaign_id INTEGER,
      item_name TEXT NOT NULL,
      item_base_type TEXT,
      current_state TEXT DEFAULT 'dormant',
      dormant_properties TEXT,
      awakened_properties TEXT,
      exalted_properties TEXT,
      mythic_properties TEXT,
      awakened_deed TEXT,
      exalted_deed TEXT,
      mythic_deed TEXT,
      state_changed_game_day INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Piety change audit trail
  await db.execute(`
    CREATE TABLE IF NOT EXISTS piety_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      character_id INTEGER NOT NULL,
      deity_name TEXT NOT NULL,
      change_amount INTEGER NOT NULL,
      reason TEXT,
      new_score INTEGER NOT NULL,
      game_day INTEGER,
      session_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Indexes for common queries
  await db.execute('CREATE INDEX IF NOT EXISTS idx_mythic_trials_character ON mythic_trials(character_id)');
  await db.execute('CREATE INDEX IF NOT EXISTS idx_mythic_abilities_character ON mythic_abilities(character_id)');
  await db.execute('CREATE INDEX IF NOT EXISTS idx_character_piety_character ON character_piety(character_id)');
  await db.execute('CREATE INDEX IF NOT EXISTS idx_piety_history_character ON piety_history(character_id, deity_name)');
  await db.execute('CREATE INDEX IF NOT EXISTS idx_legendary_items_character ON legendary_items(character_id)');
  await db.execute('CREATE INDEX IF NOT EXISTS idx_epic_boons_character ON character_epic_boons(character_id)');
}

export async function down(db) {
  await db.execute('DROP INDEX IF EXISTS idx_epic_boons_character');
  await db.execute('DROP INDEX IF EXISTS idx_legendary_items_character');
  await db.execute('DROP INDEX IF EXISTS idx_piety_history_character');
  await db.execute('DROP INDEX IF EXISTS idx_character_piety_character');
  await db.execute('DROP INDEX IF EXISTS idx_mythic_abilities_character');
  await db.execute('DROP INDEX IF EXISTS idx_mythic_trials_character');
  await db.execute('DROP TABLE IF EXISTS piety_history');
  await db.execute('DROP TABLE IF EXISTS legendary_items');
  await db.execute('DROP TABLE IF EXISTS character_epic_boons');
  await db.execute('DROP TABLE IF EXISTS character_piety');
  await db.execute('DROP TABLE IF EXISTS mythic_abilities');
  await db.execute('DROP TABLE IF EXISTS mythic_trials');
  await db.execute('DROP TABLE IF EXISTS mythic_characters');
}
