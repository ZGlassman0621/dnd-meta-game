import { createClient } from '@libsql/client';
import dotenv from 'dotenv';

dotenv.config();

// Create Turso client (cloud SQLite)
const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

export async function initDatabase() {
  // Characters table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS characters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      class TEXT NOT NULL,
      race TEXT,
      level INTEGER NOT NULL,
      current_hp INTEGER NOT NULL,
      max_hp INTEGER NOT NULL,
      current_location TEXT NOT NULL,
      current_quest TEXT,
      gold_cp INTEGER DEFAULT 0,
      gold_sp INTEGER DEFAULT 0,
      gold_gp INTEGER DEFAULT 0,
      experience INTEGER DEFAULT 0,
      experience_to_next_level INTEGER NOT NULL,
      armor_class INTEGER DEFAULT 10,
      speed INTEGER DEFAULT 30,
      ability_scores TEXT DEFAULT '{"str":10,"dex":10,"con":10,"int":10,"wis":10,"cha":10}',
      skills TEXT DEFAULT '[]',
      advantages TEXT DEFAULT '[]',
      inventory TEXT DEFAULT '[]',
      faction_standings TEXT,
      injuries TEXT,
      debuffs TEXT,
      equipment TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Add new columns to existing table if they don't exist
  const columns = await db.execute("PRAGMA table_info(characters)");
  const columnNames = columns.rows.map(col => col.name);

  const characterMigrations = [
    { col: 'race', sql: 'ALTER TABLE characters ADD COLUMN race TEXT' },
    { col: 'armor_class', sql: 'ALTER TABLE characters ADD COLUMN armor_class INTEGER DEFAULT 10' },
    { col: 'speed', sql: 'ALTER TABLE characters ADD COLUMN speed INTEGER DEFAULT 30' },
    { col: 'ability_scores', sql: "ALTER TABLE characters ADD COLUMN ability_scores TEXT DEFAULT '{\"str\":10,\"dex\":10,\"con\":10,\"int\":10,\"wis\":10,\"cha\":10}'" },
    { col: 'skills', sql: "ALTER TABLE characters ADD COLUMN skills TEXT DEFAULT '[]'" },
    { col: 'advantages', sql: "ALTER TABLE characters ADD COLUMN advantages TEXT DEFAULT '[]'" },
    { col: 'inventory', sql: "ALTER TABLE characters ADD COLUMN inventory TEXT DEFAULT '[]'" },
    { col: 'starting_gold_cp', sql: 'ALTER TABLE characters ADD COLUMN starting_gold_cp INTEGER DEFAULT 0' },
    { col: 'starting_gold_sp', sql: 'ALTER TABLE characters ADD COLUMN starting_gold_sp INTEGER DEFAULT 0' },
    { col: 'starting_gold_gp', sql: 'ALTER TABLE characters ADD COLUMN starting_gold_gp INTEGER DEFAULT 0' },
    { col: 'gender', sql: 'ALTER TABLE characters ADD COLUMN gender TEXT' },
    { col: 'subrace', sql: 'ALTER TABLE characters ADD COLUMN subrace TEXT' },
    { col: 'first_name', sql: 'ALTER TABLE characters ADD COLUMN first_name TEXT' },
    { col: 'last_name', sql: 'ALTER TABLE characters ADD COLUMN last_name TEXT' },
    { col: 'background', sql: 'ALTER TABLE characters ADD COLUMN background TEXT' },
    { col: 'avatar', sql: 'ALTER TABLE characters ADD COLUMN avatar TEXT' },
    { col: 'alignment', sql: 'ALTER TABLE characters ADD COLUMN alignment TEXT' },
    { col: 'faith', sql: 'ALTER TABLE characters ADD COLUMN faith TEXT' },
    { col: 'lifestyle', sql: 'ALTER TABLE characters ADD COLUMN lifestyle TEXT' },
    { col: 'hair_color', sql: 'ALTER TABLE characters ADD COLUMN hair_color TEXT' },
    { col: 'skin_color', sql: 'ALTER TABLE characters ADD COLUMN skin_color TEXT' },
    { col: 'eye_color', sql: 'ALTER TABLE characters ADD COLUMN eye_color TEXT' },
    { col: 'height', sql: 'ALTER TABLE characters ADD COLUMN height TEXT' },
    { col: 'weight', sql: 'ALTER TABLE characters ADD COLUMN weight TEXT' },
    { col: 'age', sql: 'ALTER TABLE characters ADD COLUMN age TEXT' },
    { col: 'personality_traits', sql: 'ALTER TABLE characters ADD COLUMN personality_traits TEXT' },
    { col: 'ideals', sql: 'ALTER TABLE characters ADD COLUMN ideals TEXT' },
    { col: 'bonds', sql: 'ALTER TABLE characters ADD COLUMN bonds TEXT' },
    { col: 'flaws', sql: 'ALTER TABLE characters ADD COLUMN flaws TEXT' },
    { col: 'organizations', sql: 'ALTER TABLE characters ADD COLUMN organizations TEXT' },
    { col: 'allies', sql: 'ALTER TABLE characters ADD COLUMN allies TEXT' },
    { col: 'enemies', sql: 'ALTER TABLE characters ADD COLUMN enemies TEXT' },
    { col: 'backstory', sql: 'ALTER TABLE characters ADD COLUMN backstory TEXT' },
    { col: 'other_notes', sql: 'ALTER TABLE characters ADD COLUMN other_notes TEXT' },
    { col: 'subclass', sql: 'ALTER TABLE characters ADD COLUMN subclass TEXT' },
    { col: 'nickname', sql: 'ALTER TABLE characters ADD COLUMN nickname TEXT' },
    { col: 'known_cantrips', sql: "ALTER TABLE characters ADD COLUMN known_cantrips TEXT DEFAULT '[]'" },
    { col: 'prepared_spells', sql: "ALTER TABLE characters ADD COLUMN prepared_spells TEXT DEFAULT '[]'" },
    { col: 'class_levels', sql: 'ALTER TABLE characters ADD COLUMN class_levels TEXT' },
    { col: 'hit_dice', sql: 'ALTER TABLE characters ADD COLUMN hit_dice TEXT' },
    { col: 'spell_slots', sql: "ALTER TABLE characters ADD COLUMN spell_slots TEXT DEFAULT '{}'" },
    { col: 'spell_slots_used', sql: "ALTER TABLE characters ADD COLUMN spell_slots_used TEXT DEFAULT '{}'" },
    { col: 'game_day', sql: 'ALTER TABLE characters ADD COLUMN game_day INTEGER DEFAULT 1' },
    { col: 'game_year', sql: 'ALTER TABLE characters ADD COLUMN game_year INTEGER DEFAULT 1492' },
    { col: 'game_hour', sql: 'ALTER TABLE characters ADD COLUMN game_hour INTEGER DEFAULT 8' },
    { col: 'pending_downtime_narratives', sql: "ALTER TABLE characters ADD COLUMN pending_downtime_narratives TEXT DEFAULT '[]'" },
    { col: 'campaign_notes', sql: "ALTER TABLE characters ADD COLUMN campaign_notes TEXT DEFAULT ''" },
    { col: 'equipment', sql: "ALTER TABLE characters ADD COLUMN equipment TEXT DEFAULT '{}'" },
    { col: 'campaign_config', sql: "ALTER TABLE characters ADD COLUMN campaign_config TEXT DEFAULT '{}'" },
  ];

  for (const migration of characterMigrations) {
    if (!columnNames.includes(migration.col)) {
      try {
        await db.execute(migration.sql);
      } catch (e) {
        // Column might already exist, ignore duplicate column errors
        if (!e.message.includes('duplicate column')) {
          console.error(`Migration error for ${migration.col}:`, e.message);
        }
      }
    }
  }

  // Adventures table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS adventures (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      character_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      location TEXT NOT NULL,
      risk_level TEXT NOT NULL,
      duration_hours REAL NOT NULL,
      start_time DATETIME NOT NULL,
      end_time DATETIME NOT NULL,
      status TEXT NOT NULL,
      results TEXT,
      rewards TEXT,
      consequences TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (character_id) REFERENCES characters(id)
    )
  `);

  // Add new columns to adventures table if they don't exist
  const adventureColumns = await db.execute("PRAGMA table_info(adventures)");
  const adventureColumnNames = adventureColumns.rows.map(col => col.name);

  const adventureMigrations = [
    { col: 'participating_companions', sql: "ALTER TABLE adventures ADD COLUMN participating_companions TEXT DEFAULT '[]'" },
    { col: 'estimated_game_hours', sql: 'ALTER TABLE adventures ADD COLUMN estimated_game_hours INTEGER DEFAULT 8' },
  ];

  for (const migration of adventureMigrations) {
    if (!adventureColumnNames.includes(migration.col)) {
      try {
        await db.execute(migration.sql);
      } catch (e) {
        if (!e.message.includes('duplicate column')) {
          console.error(`Migration error for ${migration.col}:`, e.message);
        }
      }
    }
  }

  // Adventure options cache
  await db.execute(`
    CREATE TABLE IF NOT EXISTS adventure_options (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      character_id INTEGER NOT NULL,
      location TEXT NOT NULL,
      quest_context TEXT,
      risk_level TEXT NOT NULL,
      options_json TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (character_id) REFERENCES characters(id)
    )
  `);

  // DM Sessions table for AI-powered text adventure sessions
  await db.execute(`
    CREATE TABLE IF NOT EXISTS dm_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      character_id INTEGER NOT NULL,
      title TEXT,
      setting TEXT,
      tone TEXT,
      model TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      messages TEXT DEFAULT '[]',
      summary TEXT,
      rewards TEXT,
      rewards_claimed INTEGER DEFAULT 0,
      hp_change INTEGER DEFAULT 0,
      new_location TEXT,
      new_quest TEXT,
      start_time DATETIME DEFAULT CURRENT_TIMESTAMP,
      end_time DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (character_id) REFERENCES characters(id)
    )
  `);

  // Add new columns to dm_sessions if they don't exist
  const dmColumns = await db.execute("PRAGMA table_info(dm_sessions)");
  const dmColumnNames = dmColumns.rows.map(col => col.name);

  const dmMigrations = [
    { col: 'rewards', sql: 'ALTER TABLE dm_sessions ADD COLUMN rewards TEXT' },
    { col: 'rewards_claimed', sql: 'ALTER TABLE dm_sessions ADD COLUMN rewards_claimed INTEGER DEFAULT 0' },
    { col: 'hp_change', sql: 'ALTER TABLE dm_sessions ADD COLUMN hp_change INTEGER DEFAULT 0' },
    { col: 'new_location', sql: 'ALTER TABLE dm_sessions ADD COLUMN new_location TEXT' },
    { col: 'new_quest', sql: 'ALTER TABLE dm_sessions ADD COLUMN new_quest TEXT' },
    { col: 'second_character_id', sql: 'ALTER TABLE dm_sessions ADD COLUMN second_character_id INTEGER' },
    { col: 'session_config', sql: 'ALTER TABLE dm_sessions ADD COLUMN session_config TEXT' },
    { col: 'recap', sql: 'ALTER TABLE dm_sessions ADD COLUMN recap TEXT' },
    { col: 'game_start_day', sql: 'ALTER TABLE dm_sessions ADD COLUMN game_start_day INTEGER' },
    { col: 'game_start_year', sql: 'ALTER TABLE dm_sessions ADD COLUMN game_start_year INTEGER' },
    { col: 'game_end_day', sql: 'ALTER TABLE dm_sessions ADD COLUMN game_end_day INTEGER' },
    { col: 'game_end_year', sql: 'ALTER TABLE dm_sessions ADD COLUMN game_end_year INTEGER' },
  ];

  for (const migration of dmMigrations) {
    if (!dmColumnNames.includes(migration.col)) {
      try {
        await db.execute(migration.sql);
      } catch (e) {
        if (!e.message.includes('duplicate column')) {
          console.error(`Migration error for ${migration.col}:`, e.message);
        }
      }
    }
  }

  // NPCs table for custom NPC creation
  await db.execute(`
    CREATE TABLE IF NOT EXISTS npcs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      nickname TEXT,
      race TEXT NOT NULL,
      gender TEXT,
      age TEXT,
      occupation TEXT,
      occupation_category TEXT,
      stat_block TEXT,
      cr TEXT,
      ac INTEGER DEFAULT 10,
      hp INTEGER DEFAULT 4,
      speed TEXT DEFAULT '30 ft.',
      ability_scores TEXT DEFAULT '{"str":10,"dex":10,"con":10,"int":10,"wis":10,"cha":10}',
      skills TEXT DEFAULT '[]',
      languages TEXT DEFAULT 'Common',
      height TEXT,
      build TEXT,
      hair_color TEXT,
      hair_style TEXT,
      eye_color TEXT,
      skin_tone TEXT,
      facial_features TEXT,
      distinguishing_marks TEXT,
      facial_hair TEXT,
      clothing_style TEXT,
      accessories TEXT,
      voice TEXT,
      personality_trait_1 TEXT,
      personality_trait_2 TEXT,
      mannerism TEXT,
      motivation TEXT,
      fear TEXT,
      secret TEXT,
      quirk TEXT,
      current_location TEXT,
      typical_locations TEXT,
      background_notes TEXT,
      relationship_to_party TEXT,
      campaign_availability TEXT DEFAULT 'available',
      avatar TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Add campaign_availability column if it doesn't exist (migration)
  const npcColumns = await db.execute("PRAGMA table_info(npcs)");
  const npcColumnNames = npcColumns.rows.map(c => c.name);
  if (!npcColumnNames.includes('campaign_availability')) {
    try {
      await db.execute("ALTER TABLE npcs ADD COLUMN campaign_availability TEXT DEFAULT 'available'");
    } catch (e) {
      if (!e.message.includes('duplicate column')) {
        console.error('Migration error for campaign_availability:', e.message);
      }
    }
  }

  // Downtime activities table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS downtime (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      character_id INTEGER NOT NULL,
      activity_type TEXT NOT NULL,
      work_type TEXT,
      duration_hours INTEGER NOT NULL,
      start_time DATETIME NOT NULL,
      end_time DATETIME NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      results TEXT,
      benefits TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (character_id) REFERENCES characters(id)
    )
  `);

  // Add work_type column if it doesn't exist (migration)
  const downtimeColumns = await db.execute("PRAGMA table_info(downtime)");
  const downtimeColumnNames = downtimeColumns.rows.map(c => c.name);

  const downtimeMigrations = [
    { col: 'work_type', sql: 'ALTER TABLE downtime ADD COLUMN work_type TEXT' },
    { col: 'rest_type', sql: 'ALTER TABLE downtime ADD COLUMN rest_type TEXT' },
  ];

  for (const migration of downtimeMigrations) {
    if (!downtimeColumnNames.includes(migration.col)) {
      try {
        await db.execute(migration.sql);
      } catch (e) {
        if (!e.message.includes('duplicate column')) {
          console.error(`Migration error for ${migration.col}:`, e.message);
        }
      }
    }
  }

  // Companions table - NPCs recruited by player characters
  await db.execute(`
    CREATE TABLE IF NOT EXISTS companions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      npc_id INTEGER NOT NULL,
      recruited_by_character_id INTEGER NOT NULL,
      recruited_session_id INTEGER,
      recruited_at DATETIME DEFAULT CURRENT_TIMESTAMP,

      -- Progression (when converted to class-based)
      companion_class TEXT,
      companion_level INTEGER DEFAULT 1,
      companion_subclass TEXT,
      companion_max_hp INTEGER,
      companion_current_hp INTEGER,
      companion_ability_scores TEXT,

      -- 'npc_stats' (use original CR/stat block) or 'class_based' (full leveling)
      progression_type TEXT DEFAULT 'npc_stats',

      -- Snapshot of NPC stats at recruitment time
      original_stats_snapshot TEXT,

      -- Status: 'active', 'dismissed', 'deceased'
      status TEXT DEFAULT 'active',
      dismissed_at DATETIME,

      -- Notes about the companion
      notes TEXT,

      FOREIGN KEY (npc_id) REFERENCES npcs(id),
      FOREIGN KEY (recruited_by_character_id) REFERENCES characters(id),
      FOREIGN KEY (recruited_session_id) REFERENCES dm_sessions(id)
    )
  `);

  // Add columns to companions table if they don't exist
  const companionColumns = await db.execute("PRAGMA table_info(companions)");
  const companionColumnNames = companionColumns.rows.map(c => c.name);

  const companionMigrations = [
    { col: 'inventory', sql: "ALTER TABLE companions ADD COLUMN inventory TEXT DEFAULT '[]'" },
    { col: 'gold_gp', sql: 'ALTER TABLE companions ADD COLUMN gold_gp INTEGER DEFAULT 0' },
    { col: 'gold_sp', sql: 'ALTER TABLE companions ADD COLUMN gold_sp INTEGER DEFAULT 0' },
    { col: 'gold_cp', sql: 'ALTER TABLE companions ADD COLUMN gold_cp INTEGER DEFAULT 0' },
    { col: 'equipment', sql: "ALTER TABLE companions ADD COLUMN equipment TEXT DEFAULT '{}'" },
    { col: 'companion_experience', sql: 'ALTER TABLE companions ADD COLUMN companion_experience INTEGER DEFAULT 0' },
    { col: 'skill_proficiencies', sql: "ALTER TABLE companions ADD COLUMN skill_proficiencies TEXT DEFAULT '[]'" },
    // Character-like fields for fully-fleshed companions
    { col: 'alignment', sql: 'ALTER TABLE companions ADD COLUMN alignment TEXT' },
    { col: 'faith', sql: 'ALTER TABLE companions ADD COLUMN faith TEXT' },
    { col: 'lifestyle', sql: 'ALTER TABLE companions ADD COLUMN lifestyle TEXT' },
    { col: 'ideals', sql: 'ALTER TABLE companions ADD COLUMN ideals TEXT' },
    { col: 'bonds', sql: 'ALTER TABLE companions ADD COLUMN bonds TEXT' },
    { col: 'flaws', sql: 'ALTER TABLE companions ADD COLUMN flaws TEXT' },
    { col: 'armor_class', sql: 'ALTER TABLE companions ADD COLUMN armor_class INTEGER DEFAULT 10' },
    { col: 'speed', sql: 'ALTER TABLE companions ADD COLUMN speed INTEGER DEFAULT 30' },
    { col: 'subrace', sql: 'ALTER TABLE companions ADD COLUMN subrace TEXT' },
    { col: 'background', sql: 'ALTER TABLE companions ADD COLUMN background TEXT' },
    // Spellcasting
    { col: 'cantrips', sql: "ALTER TABLE companions ADD COLUMN cantrips TEXT DEFAULT '[]'" },
    { col: 'spells_known', sql: "ALTER TABLE companions ADD COLUMN spells_known TEXT DEFAULT '[]'" },
  ];

  for (const migration of companionMigrations) {
    if (!companionColumnNames.includes(migration.col)) {
      try {
        await db.execute(migration.sql);
      } catch (e) {
        if (!e.message.includes('duplicate column')) {
          console.error(`Migration error for ${migration.col}:`, e.message);
        }
      }
    }
  }

  // Activity queue table for Meta Game scheduling
  await db.execute(`
    CREATE TABLE IF NOT EXISTS activity_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      character_id INTEGER NOT NULL,
      activity_type TEXT NOT NULL,
      duration_hours INTEGER NOT NULL,
      options TEXT DEFAULT '{}',
      queue_order INTEGER NOT NULL,
      status TEXT DEFAULT 'pending',
      started_at DATETIME,
      completed_at DATETIME,
      results TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (character_id) REFERENCES characters(id)
    )
  `);

  console.log('Database initialized successfully (Turso cloud)');
}

// Helper functions for common database operations (async wrappers)
export async function dbAll(sql, params = []) {
  const result = await db.execute({ sql, args: params });
  return result.rows;
}

export async function dbGet(sql, params = []) {
  const result = await db.execute({ sql, args: params });
  return result.rows[0] || null;
}

export async function dbRun(sql, params = []) {
  const result = await db.execute({ sql, args: params });
  return { lastInsertRowid: result.lastInsertRowid, changes: result.rowsAffected };
}

export default db;
