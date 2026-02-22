/**
 * Migration 008: Weather, Survival & Crafting Systems
 *
 * Adds:
 * - campaign_weather table (per-campaign weather state)
 * - Survival columns on characters (hunger/thirst tracking)
 * - crafting_recipes table (master recipe catalog)
 * - character_recipes table (discovered recipes per character)
 * - crafting_projects table (active crafting work)
 * - character_materials table (crafting material inventory)
 */

export async function up(db) {
  // Helper: check if column exists before adding
  const addColumn = async (table, col, sql) => {
    const columns = await db.execute(`PRAGMA table_info(${table})`);
    const exists = columns.rows.some(r => r.name === col);
    if (!exists) await db.execute(sql);
  };

  // ============================================================
  // WEATHER STATE
  // ============================================================

  await db.execute(`
    CREATE TABLE IF NOT EXISTS campaign_weather (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id INTEGER NOT NULL,
      weather_type TEXT NOT NULL DEFAULT 'clear',
      temperature_f INTEGER NOT NULL DEFAULT 65,
      wind_speed TEXT NOT NULL DEFAULT 'calm',
      visibility TEXT NOT NULL DEFAULT 'normal',
      precipitation TEXT NOT NULL DEFAULT 'none',
      weather_started_game_day INTEGER,
      weather_duration_hours INTEGER DEFAULT 24,
      last_weather_change_day INTEGER,
      region_type TEXT DEFAULT 'temperate',
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (campaign_id) REFERENCES campaigns(id)
    )
  `);

  await db.execute(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_campaign_weather_campaign
    ON campaign_weather(campaign_id)
  `);

  // ============================================================
  // SURVIVAL COLUMNS ON CHARACTERS
  // ============================================================

  await addColumn('characters', 'days_without_food',
    'ALTER TABLE characters ADD COLUMN days_without_food INTEGER DEFAULT 0');
  await addColumn('characters', 'days_without_water',
    'ALTER TABLE characters ADD COLUMN days_without_water INTEGER DEFAULT 0');
  await addColumn('characters', 'last_meal_game_day',
    'ALTER TABLE characters ADD COLUMN last_meal_game_day INTEGER');
  await addColumn('characters', 'last_drink_game_day',
    'ALTER TABLE characters ADD COLUMN last_drink_game_day INTEGER');
  await addColumn('characters', 'shelter_type',
    "ALTER TABLE characters ADD COLUMN shelter_type TEXT DEFAULT 'none'");

  // ============================================================
  // CRAFTING RECIPES (master catalog)
  // ============================================================

  await db.execute(`
    CREATE TABLE IF NOT EXISTS crafting_recipes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      description TEXT,
      required_materials TEXT DEFAULT '[]',
      required_tools TEXT DEFAULT '[]',
      required_proficiency TEXT,
      craft_time_hours INTEGER NOT NULL DEFAULT 8,
      difficulty_dc INTEGER NOT NULL DEFAULT 10,
      ability_check TEXT DEFAULT 'intelligence',
      output_item TEXT NOT NULL,
      output_quantity INTEGER DEFAULT 1,
      level_requirement INTEGER DEFAULT 1,
      gold_cost INTEGER DEFAULT 0,
      is_default INTEGER DEFAULT 1,
      rarity TEXT DEFAULT 'common',
      source_hint TEXT,
      weather_requirement TEXT,
      season_requirement TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_crafting_recipes_category
    ON crafting_recipes(category)
  `);

  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_crafting_recipes_default
    ON crafting_recipes(is_default)
  `);

  // ============================================================
  // CHARACTER RECIPES (discovered recipes)
  // ============================================================

  await db.execute(`
    CREATE TABLE IF NOT EXISTS character_recipes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      character_id INTEGER NOT NULL,
      recipe_id INTEGER NOT NULL,
      discovered_method TEXT,
      discovered_game_day INTEGER,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (character_id) REFERENCES characters(id),
      FOREIGN KEY (recipe_id) REFERENCES crafting_recipes(id),
      UNIQUE(character_id, recipe_id)
    )
  `);

  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_character_recipes_char
    ON character_recipes(character_id)
  `);

  // ============================================================
  // CRAFTING PROJECTS (active work)
  // ============================================================

  await db.execute(`
    CREATE TABLE IF NOT EXISTS crafting_projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      character_id INTEGER NOT NULL,
      recipe_id INTEGER NOT NULL,
      campaign_id INTEGER,
      status TEXT DEFAULT 'in_progress',
      hours_invested REAL DEFAULT 0,
      hours_required INTEGER NOT NULL,
      materials_consumed TEXT DEFAULT '[]',
      gold_spent INTEGER DEFAULT 0,
      quality_result TEXT,
      started_game_day INTEGER,
      completed_game_day INTEGER,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (character_id) REFERENCES characters(id),
      FOREIGN KEY (recipe_id) REFERENCES crafting_recipes(id)
    )
  `);

  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_crafting_projects_char_status
    ON crafting_projects(character_id, status)
  `);

  // ============================================================
  // CHARACTER MATERIALS (crafting inventory)
  // ============================================================

  await db.execute(`
    CREATE TABLE IF NOT EXISTS character_materials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      character_id INTEGER NOT NULL,
      material_name TEXT NOT NULL,
      quantity INTEGER DEFAULT 1,
      quality TEXT DEFAULT 'standard',
      source TEXT,
      acquired_game_day INTEGER,
      perishable INTEGER DEFAULT 0,
      spoils_in_days INTEGER,
      value_gp REAL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (character_id) REFERENCES characters(id)
    )
  `);

  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_character_materials_char
    ON character_materials(character_id)
  `);
}

export async function down(db) {
  await db.execute('DROP TABLE IF EXISTS character_materials');
  await db.execute('DROP TABLE IF EXISTS crafting_projects');
  await db.execute('DROP TABLE IF EXISTS character_recipes');
  await db.execute('DROP TABLE IF EXISTS crafting_recipes');
  await db.execute('DROP TABLE IF EXISTS campaign_weather');
  // Note: SQLite doesn't support DROP COLUMN — survival columns remain
}
