import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const db = new Database(join(__dirname, 'data/game.db'));

export function initDatabase() {
  // Characters table
  db.exec(`
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
  const columns = db.prepare("PRAGMA table_info(characters)").all();
  const columnNames = columns.map(col => col.name);

  if (!columnNames.includes('race')) {
    db.exec('ALTER TABLE characters ADD COLUMN race TEXT');
  }
  if (!columnNames.includes('armor_class')) {
    db.exec('ALTER TABLE characters ADD COLUMN armor_class INTEGER DEFAULT 10');
  }
  if (!columnNames.includes('speed')) {
    db.exec('ALTER TABLE characters ADD COLUMN speed INTEGER DEFAULT 30');
  }
  if (!columnNames.includes('ability_scores')) {
    db.exec('ALTER TABLE characters ADD COLUMN ability_scores TEXT DEFAULT \'{"str":10,"dex":10,"con":10,"int":10,"wis":10,"cha":10}\'');
  }
  if (!columnNames.includes('skills')) {
    db.exec('ALTER TABLE characters ADD COLUMN skills TEXT DEFAULT \'[]\'');
  }
  if (!columnNames.includes('advantages')) {
    db.exec('ALTER TABLE characters ADD COLUMN advantages TEXT DEFAULT \'[]\'');
  }
  if (!columnNames.includes('inventory')) {
    db.exec('ALTER TABLE characters ADD COLUMN inventory TEXT DEFAULT \'[]\'');
  }
  if (!columnNames.includes('starting_gold_cp')) {
    db.exec('ALTER TABLE characters ADD COLUMN starting_gold_cp INTEGER DEFAULT 0');
  }
  if (!columnNames.includes('starting_gold_sp')) {
    db.exec('ALTER TABLE characters ADD COLUMN starting_gold_sp INTEGER DEFAULT 0');
  }
  if (!columnNames.includes('starting_gold_gp')) {
    db.exec('ALTER TABLE characters ADD COLUMN starting_gold_gp INTEGER DEFAULT 0');
  }
  if (!columnNames.includes('gender')) {
    db.exec('ALTER TABLE characters ADD COLUMN gender TEXT');
  }
  if (!columnNames.includes('subrace')) {
    db.exec('ALTER TABLE characters ADD COLUMN subrace TEXT');
  }
  if (!columnNames.includes('first_name')) {
    db.exec('ALTER TABLE characters ADD COLUMN first_name TEXT');
  }
  if (!columnNames.includes('last_name')) {
    db.exec('ALTER TABLE characters ADD COLUMN last_name TEXT');
  }
  if (!columnNames.includes('background')) {
    db.exec('ALTER TABLE characters ADD COLUMN background TEXT');
  }
  if (!columnNames.includes('avatar')) {
    db.exec('ALTER TABLE characters ADD COLUMN avatar TEXT');
  }
  if (!columnNames.includes('alignment')) {
    db.exec('ALTER TABLE characters ADD COLUMN alignment TEXT');
  }
  if (!columnNames.includes('faith')) {
    db.exec('ALTER TABLE characters ADD COLUMN faith TEXT');
  }
  if (!columnNames.includes('lifestyle')) {
    db.exec('ALTER TABLE characters ADD COLUMN lifestyle TEXT');
  }
  if (!columnNames.includes('hair_color')) {
    db.exec('ALTER TABLE characters ADD COLUMN hair_color TEXT');
  }
  if (!columnNames.includes('skin_color')) {
    db.exec('ALTER TABLE characters ADD COLUMN skin_color TEXT');
  }
  if (!columnNames.includes('eye_color')) {
    db.exec('ALTER TABLE characters ADD COLUMN eye_color TEXT');
  }
  if (!columnNames.includes('height')) {
    db.exec('ALTER TABLE characters ADD COLUMN height TEXT');
  }
  if (!columnNames.includes('weight')) {
    db.exec('ALTER TABLE characters ADD COLUMN weight TEXT');
  }
  if (!columnNames.includes('age')) {
    db.exec('ALTER TABLE characters ADD COLUMN age TEXT');
  }
  if (!columnNames.includes('personality_traits')) {
    db.exec('ALTER TABLE characters ADD COLUMN personality_traits TEXT');
  }
  if (!columnNames.includes('ideals')) {
    db.exec('ALTER TABLE characters ADD COLUMN ideals TEXT');
  }
  if (!columnNames.includes('bonds')) {
    db.exec('ALTER TABLE characters ADD COLUMN bonds TEXT');
  }
  if (!columnNames.includes('flaws')) {
    db.exec('ALTER TABLE characters ADD COLUMN flaws TEXT');
  }
  if (!columnNames.includes('organizations')) {
    db.exec('ALTER TABLE characters ADD COLUMN organizations TEXT');
  }
  if (!columnNames.includes('allies')) {
    db.exec('ALTER TABLE characters ADD COLUMN allies TEXT');
  }
  if (!columnNames.includes('enemies')) {
    db.exec('ALTER TABLE characters ADD COLUMN enemies TEXT');
  }
  if (!columnNames.includes('backstory')) {
    db.exec('ALTER TABLE characters ADD COLUMN backstory TEXT');
  }
  if (!columnNames.includes('other_notes')) {
    db.exec('ALTER TABLE characters ADD COLUMN other_notes TEXT');
  }
  if (!columnNames.includes('subclass')) {
    db.exec('ALTER TABLE characters ADD COLUMN subclass TEXT');
  }
  if (!columnNames.includes('nickname')) {
    db.exec('ALTER TABLE characters ADD COLUMN nickname TEXT');
  }
  if (!columnNames.includes('known_cantrips')) {
    db.exec('ALTER TABLE characters ADD COLUMN known_cantrips TEXT DEFAULT \'[]\'');
  }
  if (!columnNames.includes('prepared_spells')) {
    db.exec('ALTER TABLE characters ADD COLUMN prepared_spells TEXT DEFAULT \'[]\'');
  }
  // Multiclassing support columns
  if (!columnNames.includes('class_levels')) {
    db.exec('ALTER TABLE characters ADD COLUMN class_levels TEXT');
  }
  if (!columnNames.includes('hit_dice')) {
    db.exec('ALTER TABLE characters ADD COLUMN hit_dice TEXT');
  }
  // Spell slot tracking
  if (!columnNames.includes('spell_slots')) {
    db.exec('ALTER TABLE characters ADD COLUMN spell_slots TEXT DEFAULT \'{}\'');
  }
  if (!columnNames.includes('spell_slots_used')) {
    db.exec('ALTER TABLE characters ADD COLUMN spell_slots_used TEXT DEFAULT \'{}\'');
  }
  // In-game calendar tracking (Harptos calendar - day of year 1-365, year in DR)
  if (!columnNames.includes('game_day')) {
    db.exec('ALTER TABLE characters ADD COLUMN game_day INTEGER DEFAULT 1');
  }
  if (!columnNames.includes('game_year')) {
    db.exec('ALTER TABLE characters ADD COLUMN game_year INTEGER DEFAULT 1492');
  }
  // Pending narrative events from downtime activities (to be woven into next DM session)
  if (!columnNames.includes('pending_downtime_narratives')) {
    db.exec("ALTER TABLE characters ADD COLUMN pending_downtime_narratives TEXT DEFAULT '[]'");
  }
  // Persistent campaign notes - AI extracts + player edits, included in every session
  if (!columnNames.includes('campaign_notes')) {
    db.exec("ALTER TABLE characters ADD COLUMN campaign_notes TEXT DEFAULT ''");
  }
  // Equipment slots - JSON object with slot -> item mapping (same as companions)
  if (!columnNames.includes('equipment')) {
    db.exec("ALTER TABLE characters ADD COLUMN equipment TEXT DEFAULT '{}'");
  }
  // Campaign config - persists custom concepts, NPCs, settings across sessions
  if (!columnNames.includes('campaign_config')) {
    db.exec("ALTER TABLE characters ADD COLUMN campaign_config TEXT DEFAULT '{}'");
  }

  // Adventures table
  db.exec(`
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

  // Adventure options cache (to avoid regenerating same options repeatedly)
  db.exec(`
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
  db.exec(`
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
  const dmColumns = db.prepare("PRAGMA table_info(dm_sessions)").all();
  const dmColumnNames = dmColumns.map(col => col.name);

  if (!dmColumnNames.includes('rewards')) {
    db.exec('ALTER TABLE dm_sessions ADD COLUMN rewards TEXT');
  }
  if (!dmColumnNames.includes('rewards_claimed')) {
    db.exec('ALTER TABLE dm_sessions ADD COLUMN rewards_claimed INTEGER DEFAULT 0');
  }
  if (!dmColumnNames.includes('hp_change')) {
    db.exec('ALTER TABLE dm_sessions ADD COLUMN hp_change INTEGER DEFAULT 0');
  }
  if (!dmColumnNames.includes('new_location')) {
    db.exec('ALTER TABLE dm_sessions ADD COLUMN new_location TEXT');
  }
  if (!dmColumnNames.includes('new_quest')) {
    db.exec('ALTER TABLE dm_sessions ADD COLUMN new_quest TEXT');
  }
  if (!dmColumnNames.includes('second_character_id')) {
    db.exec('ALTER TABLE dm_sessions ADD COLUMN second_character_id INTEGER');
  }
  if (!dmColumnNames.includes('session_config')) {
    db.exec('ALTER TABLE dm_sessions ADD COLUMN session_config TEXT');
  }
  // Session recap for "Previously on..." when resuming
  if (!dmColumnNames.includes('recap')) {
    db.exec('ALTER TABLE dm_sessions ADD COLUMN recap TEXT');
  }
  // In-game time tracking for this session
  if (!dmColumnNames.includes('game_start_day')) {
    db.exec('ALTER TABLE dm_sessions ADD COLUMN game_start_day INTEGER');
  }
  if (!dmColumnNames.includes('game_start_year')) {
    db.exec('ALTER TABLE dm_sessions ADD COLUMN game_start_year INTEGER');
  }
  if (!dmColumnNames.includes('game_end_day')) {
    db.exec('ALTER TABLE dm_sessions ADD COLUMN game_end_day INTEGER');
  }
  if (!dmColumnNames.includes('game_end_year')) {
    db.exec('ALTER TABLE dm_sessions ADD COLUMN game_end_year INTEGER');
  }

  // NPCs table for custom NPC creation
  db.exec(`
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
  const npcColumns = db.prepare("PRAGMA table_info(npcs)").all();
  const npcColumnNames = npcColumns.map(c => c.name);
  if (!npcColumnNames.includes('campaign_availability')) {
    db.exec("ALTER TABLE npcs ADD COLUMN campaign_availability TEXT DEFAULT 'available'");
  }

  // Downtime activities table
  db.exec(`
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
  const downtimeColumns = db.prepare("PRAGMA table_info(downtime)").all();
  const downtimeColumnNames = downtimeColumns.map(c => c.name);
  if (!downtimeColumnNames.includes('work_type')) {
    db.exec("ALTER TABLE downtime ADD COLUMN work_type TEXT");
  }
  if (!downtimeColumnNames.includes('rest_type')) {
    db.exec("ALTER TABLE downtime ADD COLUMN rest_type TEXT");
  }

  // Companions table - NPCs recruited by player characters
  db.exec(`
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

  // Add inventory column to companions table if it doesn't exist
  const companionColumns = db.prepare("PRAGMA table_info(companions)").all().map(c => c.name);
  if (!companionColumns.includes('inventory')) {
    db.exec("ALTER TABLE companions ADD COLUMN inventory TEXT DEFAULT '[]'");
  }
  if (!companionColumns.includes('gold_gp')) {
    db.exec("ALTER TABLE companions ADD COLUMN gold_gp INTEGER DEFAULT 0");
  }
  if (!companionColumns.includes('gold_sp')) {
    db.exec("ALTER TABLE companions ADD COLUMN gold_sp INTEGER DEFAULT 0");
  }
  if (!companionColumns.includes('gold_cp')) {
    db.exec("ALTER TABLE companions ADD COLUMN gold_cp INTEGER DEFAULT 0");
  }
  // Equipment slots - JSON object with slot -> item mapping
  if (!companionColumns.includes('equipment')) {
    db.exec("ALTER TABLE companions ADD COLUMN equipment TEXT DEFAULT '{}'");
  }
  // Experience tracking for class-based companions
  if (!companionColumns.includes('companion_experience')) {
    db.exec("ALTER TABLE companions ADD COLUMN companion_experience INTEGER DEFAULT 0");
  }
  // Skill proficiencies - JSON array of skill names
  if (!companionColumns.includes('skill_proficiencies')) {
    db.exec("ALTER TABLE companions ADD COLUMN skill_proficiencies TEXT DEFAULT '[]'");
  }

  console.log('Database initialized successfully');
}

export default db;
