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
    { col: 'activity_type', sql: "ALTER TABLE adventures ADD COLUMN activity_type TEXT DEFAULT 'combat'" },
    { col: 'quest_relevance', sql: "ALTER TABLE adventures ADD COLUMN quest_relevance TEXT DEFAULT 'side_quest'" },
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

  // Story threads table for persistent campaign consequences
  await db.execute(`
    CREATE TABLE IF NOT EXISTS story_threads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      character_id INTEGER NOT NULL,
      source_type TEXT NOT NULL,
      source_id INTEGER,
      thread_type TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      status TEXT DEFAULT 'active',
      priority TEXT DEFAULT 'normal',
      quest_relevance TEXT DEFAULT 'side_quest',
      related_npcs TEXT DEFAULT '[]',
      related_locations TEXT DEFAULT '[]',
      potential_outcomes TEXT DEFAULT '[]',
      resolution TEXT,
      resolved_at DATETIME,
      expires_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (character_id) REFERENCES characters(id)
    )
  `);

  // Add columns to story_threads if they don't exist
  const storyThreadColumns = await db.execute("PRAGMA table_info(story_threads)");
  const storyThreadColumnNames = storyThreadColumns.rows.map(c => c.name);

  const storyThreadMigrations = [
    { col: 'consequence_category', sql: "ALTER TABLE story_threads ADD COLUMN consequence_category TEXT DEFAULT 'intel'" },
    { col: 'can_resolve_quest', sql: 'ALTER TABLE story_threads ADD COLUMN can_resolve_quest INTEGER DEFAULT 0' },
  ];

  for (const migration of storyThreadMigrations) {
    if (!storyThreadColumnNames.includes(migration.col)) {
      try {
        await db.execute(migration.sql);
      } catch (e) {
        if (!e.message.includes('duplicate column')) {
          console.error(`Migration error for ${migration.col}:`, e.message);
        }
      }
    }
  }

  // ============================================================
  // NARRATIVE SYSTEMS TABLES (Phase A)
  // ============================================================

  // Campaigns table - groups characters, quests, locations together
  await db.execute(`
    CREATE TABLE IF NOT EXISTS campaigns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      setting TEXT DEFAULT 'Forgotten Realms',
      tone TEXT DEFAULT 'heroic fantasy',
      starting_location TEXT,

      -- Campaign state
      status TEXT DEFAULT 'active',

      -- Time settings
      time_ratio TEXT DEFAULT 'normal',

      -- Metadata
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Add campaign_id to characters table (migration)
  const charColsForCampaign = await db.execute("PRAGMA table_info(characters)");
  const charColNamesForCampaign = charColsForCampaign.rows.map(c => c.name);

  if (!charColNamesForCampaign.includes('campaign_id')) {
    try {
      await db.execute('ALTER TABLE characters ADD COLUMN campaign_id INTEGER REFERENCES campaigns(id)');
    } catch (e) {
      if (!e.message.includes('duplicate column')) {
        console.error('Migration error for campaign_id:', e.message);
      }
    }
  }

  // Locations table - first-class location entities with properties
  await db.execute(`
    CREATE TABLE IF NOT EXISTS locations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id INTEGER,
      name TEXT NOT NULL,
      description TEXT,

      -- Classification
      location_type TEXT NOT NULL DEFAULT 'settlement',
      parent_location_id INTEGER,
      region TEXT,

      -- Properties
      population_size TEXT,
      danger_level INTEGER DEFAULT 1,
      prosperity_level INTEGER DEFAULT 5,

      -- Available Services (JSON array)
      services TEXT DEFAULT '[]',

      -- Atmosphere
      tags TEXT DEFAULT '[]',
      climate TEXT DEFAULT 'temperate',

      -- Discovery State
      discovery_status TEXT DEFAULT 'unknown',
      first_visited_date TEXT,
      times_visited INTEGER DEFAULT 0,

      -- Connections to other locations (JSON array)
      connected_locations TEXT DEFAULT '[]',

      -- Current State
      current_state TEXT DEFAULT 'peaceful',
      state_description TEXT,

      -- Metadata
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

      FOREIGN KEY (campaign_id) REFERENCES campaigns(id),
      FOREIGN KEY (parent_location_id) REFERENCES locations(id)
    )
  `);

  // Create index for locations
  try {
    await db.execute('CREATE INDEX IF NOT EXISTS idx_locations_campaign ON locations(campaign_id)');
    await db.execute('CREATE INDEX IF NOT EXISTS idx_locations_type ON locations(location_type)');
    await db.execute('CREATE INDEX IF NOT EXISTS idx_locations_discovery ON locations(discovery_status)');
  } catch (e) {
    // Indexes might already exist
  }

  // Quests table - unified quest system (main/side/companion/one-time)
  await db.execute(`
    CREATE TABLE IF NOT EXISTS quests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id INTEGER,
      character_id INTEGER NOT NULL,

      -- Classification
      quest_type TEXT NOT NULL DEFAULT 'side',
      source_type TEXT,
      source_id INTEGER,

      -- Basic Info
      title TEXT NOT NULL,
      premise TEXT NOT NULL,
      description TEXT,

      -- Antagonist (JSON object, can be null)
      antagonist TEXT,

      -- Status
      status TEXT DEFAULT 'active',
      priority TEXT DEFAULT 'normal',

      -- Stage Tracking
      current_stage INTEGER DEFAULT 0,
      stages TEXT DEFAULT '[]',

      -- For one-time quests: Simple completion criteria
      completion_criteria TEXT,

      -- Rewards (JSON object)
      rewards TEXT DEFAULT '{}',

      -- World Impact
      world_impact_on_complete TEXT,
      world_state_changes TEXT DEFAULT '[]',

      -- Timing
      time_sensitive INTEGER DEFAULT 0,
      deadline_date TEXT,
      escalation_if_ignored TEXT,

      -- Metadata
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      started_at DATETIME,
      completed_at DATETIME,

      FOREIGN KEY (campaign_id) REFERENCES campaigns(id),
      FOREIGN KEY (character_id) REFERENCES characters(id)
    )
  `);

  // Create indexes for quests
  try {
    await db.execute('CREATE INDEX IF NOT EXISTS idx_quests_campaign ON quests(campaign_id)');
    await db.execute('CREATE INDEX IF NOT EXISTS idx_quests_character ON quests(character_id)');
    await db.execute('CREATE INDEX IF NOT EXISTS idx_quests_status ON quests(status)');
    await db.execute('CREATE INDEX IF NOT EXISTS idx_quests_type ON quests(quest_type)');
  } catch (e) {
    // Indexes might already exist
  }

  // Quest requirements table - individual requirements for quest stages
  await db.execute(`
    CREATE TABLE IF NOT EXISTS quest_requirements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quest_id INTEGER NOT NULL,
      stage_index INTEGER NOT NULL,

      -- Requirement Definition
      requirement_type TEXT NOT NULL,
      description TEXT NOT NULL,

      -- Requirement Parameters (JSON, varies by type)
      params TEXT DEFAULT '{}',

      -- Status
      status TEXT DEFAULT 'incomplete',
      completed_at DATETIME,
      completed_by TEXT,

      -- Optional vs Required
      is_optional INTEGER DEFAULT 0,

      FOREIGN KEY (quest_id) REFERENCES quests(id) ON DELETE CASCADE
    )
  `);

  // Create indexes for quest_requirements
  try {
    await db.execute('CREATE INDEX IF NOT EXISTS idx_quest_req_quest ON quest_requirements(quest_id)');
    await db.execute('CREATE INDEX IF NOT EXISTS idx_quest_req_status ON quest_requirements(status)');
  } catch (e) {
    // Indexes might already exist
  }

  // NPC Relationships table - track disposition, trust, history with NPCs
  await db.execute(`
    CREATE TABLE IF NOT EXISTS npc_relationships (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      character_id INTEGER NOT NULL,
      npc_id INTEGER NOT NULL,

      -- Relationship State
      disposition INTEGER DEFAULT 0,
      disposition_label TEXT DEFAULT 'neutral',
      trust_level INTEGER DEFAULT 0,

      -- History
      times_met INTEGER DEFAULT 0,
      first_met_date TEXT,
      first_met_location_id INTEGER,
      last_interaction_date TEXT,

      -- Knowledge (what the NPC knows about the character)
      witnessed_deeds TEXT DEFAULT '[]',
      known_facts TEXT DEFAULT '[]',
      rumors_heard TEXT DEFAULT '[]',

      -- What the character knows about the NPC
      player_known_facts TEXT DEFAULT '[]',
      discovered_secrets TEXT DEFAULT '[]',

      -- Promises and Debts
      promises_made TEXT DEFAULT '[]',
      debts_owed TEXT DEFAULT '[]',

      -- Metadata
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

      FOREIGN KEY (character_id) REFERENCES characters(id),
      FOREIGN KEY (npc_id) REFERENCES npcs(id),
      FOREIGN KEY (first_met_location_id) REFERENCES locations(id),
      UNIQUE(character_id, npc_id)
    )
  `);

  // Create indexes for npc_relationships
  try {
    await db.execute('CREATE INDEX IF NOT EXISTS idx_npc_rel_character ON npc_relationships(character_id)');
    await db.execute('CREATE INDEX IF NOT EXISTS idx_npc_rel_disposition ON npc_relationships(disposition)');
  } catch (e) {
    // Indexes might already exist
  }

  // Companion backstories table - origin, threads, loyalty, secrets
  await db.execute(`
    CREATE TABLE IF NOT EXISTS companion_backstories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      companion_id INTEGER NOT NULL UNIQUE,

      -- Origin Story
      origin_location TEXT,
      origin_description TEXT,

      -- Formative Events
      formative_event TEXT,
      formative_event_date TEXT,

      -- Personal Goal
      personal_goal TEXT,
      goal_progress TEXT,

      -- Unresolved Threads (JSON array of thread objects)
      unresolved_threads TEXT DEFAULT '[]',

      -- Loyalty System
      loyalty INTEGER DEFAULT 50,
      loyalty_events TEXT DEFAULT '[]',

      -- Secrets (JSON array, revealed at loyalty thresholds)
      secrets TEXT DEFAULT '[]',

      -- Metadata
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

      FOREIGN KEY (companion_id) REFERENCES companions(id) ON DELETE CASCADE
    )
  `);

  // Create index for companion_backstories
  try {
    await db.execute('CREATE INDEX IF NOT EXISTS idx_companion_backstory ON companion_backstories(companion_id)');
  } catch (e) {
    // Index might already exist
  }

  // Narrative queue table - pending narrative events for delivery
  await db.execute(`
    CREATE TABLE IF NOT EXISTS narrative_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id INTEGER,
      character_id INTEGER NOT NULL,

      -- Event Type
      event_type TEXT NOT NULL,

      -- Priority
      priority TEXT DEFAULT 'normal',

      -- Content
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      context TEXT DEFAULT '{}',

      -- Related Entities
      related_quest_id INTEGER,
      related_companion_id INTEGER,
      related_npc_id INTEGER,
      related_location_id INTEGER,
      related_thread_id INTEGER,

      -- Status
      status TEXT DEFAULT 'pending',

      -- Timing
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      deliver_after DATETIME,
      expires_at DATETIME,
      delivered_at DATETIME,
      delivered_in_session_id INTEGER,

      FOREIGN KEY (campaign_id) REFERENCES campaigns(id),
      FOREIGN KEY (character_id) REFERENCES characters(id),
      FOREIGN KEY (related_quest_id) REFERENCES quests(id),
      FOREIGN KEY (related_companion_id) REFERENCES companions(id),
      FOREIGN KEY (related_npc_id) REFERENCES npcs(id),
      FOREIGN KEY (related_location_id) REFERENCES locations(id),
      FOREIGN KEY (related_thread_id) REFERENCES story_threads(id),
      FOREIGN KEY (delivered_in_session_id) REFERENCES dm_sessions(id)
    )
  `);

  // Create indexes for narrative_queue
  try {
    await db.execute('CREATE INDEX IF NOT EXISTS idx_narrative_queue_campaign ON narrative_queue(campaign_id, status)');
    await db.execute('CREATE INDEX IF NOT EXISTS idx_narrative_queue_priority ON narrative_queue(priority)');
    await db.execute('CREATE INDEX IF NOT EXISTS idx_narrative_queue_character ON narrative_queue(character_id, status)');
  } catch (e) {
    // Indexes might already exist
  }

  // ============================================================
  // EXPANSION SYSTEMS - PHASE 1: FACTIONS
  // ============================================================

  // Factions table - organizations that pursue goals and interact with the world
  await db.execute(`
    CREATE TABLE IF NOT EXISTS factions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id INTEGER,

      -- Identity
      name TEXT NOT NULL,
      description TEXT,
      symbol TEXT,
      motto TEXT,

      -- Scope and Power
      scope TEXT DEFAULT 'local',
      power_level INTEGER DEFAULT 5,
      influence_areas TEXT DEFAULT '[]',

      -- Location
      headquarters_location_id INTEGER,
      territory TEXT DEFAULT '[]',

      -- Leadership
      leader_npc_id INTEGER,
      leadership_structure TEXT DEFAULT 'autocratic',
      notable_members TEXT DEFAULT '[]',

      -- Resources
      wealth_level INTEGER DEFAULT 5,
      military_strength INTEGER DEFAULT 5,
      political_influence INTEGER DEFAULT 5,
      magical_resources INTEGER DEFAULT 3,
      information_network INTEGER DEFAULT 5,

      -- Relationships with other factions (JSON: {faction_id: relationship_value})
      faction_relationships TEXT DEFAULT '{}',

      -- Values and Methods
      alignment TEXT DEFAULT 'neutral',
      primary_values TEXT DEFAULT '[]',
      typical_methods TEXT DEFAULT '[]',

      -- Recruitment
      recruitment_requirements TEXT,
      membership_benefits TEXT DEFAULT '[]',

      -- State
      status TEXT DEFAULT 'active',
      public_reputation INTEGER DEFAULT 0,

      -- Metadata
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

      FOREIGN KEY (campaign_id) REFERENCES campaigns(id),
      FOREIGN KEY (headquarters_location_id) REFERENCES locations(id),
      FOREIGN KEY (leader_npc_id) REFERENCES npcs(id)
    )
  `);

  // Create indexes for factions
  try {
    await db.execute('CREATE INDEX IF NOT EXISTS idx_factions_campaign ON factions(campaign_id)');
    await db.execute('CREATE INDEX IF NOT EXISTS idx_factions_scope ON factions(scope)');
    await db.execute('CREATE INDEX IF NOT EXISTS idx_factions_status ON factions(status)');
  } catch (e) {
    // Indexes might already exist
  }

  // Faction goals table - what factions are actively pursuing
  await db.execute(`
    CREATE TABLE IF NOT EXISTS faction_goals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      faction_id INTEGER NOT NULL,

      -- Goal Definition
      title TEXT NOT NULL,
      description TEXT,
      goal_type TEXT DEFAULT 'expansion',

      -- Progress
      progress INTEGER DEFAULT 0,
      progress_max INTEGER DEFAULT 100,
      milestones TEXT DEFAULT '[]',

      -- Timing
      deadline TEXT,
      urgency TEXT DEFAULT 'normal',
      started_at DATETIME DEFAULT CURRENT_TIMESTAMP,

      -- Stakes
      success_consequences TEXT,
      failure_consequences TEXT,
      stakes_level TEXT DEFAULT 'moderate',

      -- Targets
      target_location_id INTEGER,
      target_faction_id INTEGER,
      target_npc_id INTEGER,
      target_character_id INTEGER,

      -- Visibility
      visibility TEXT DEFAULT 'secret',
      discovered_by_characters TEXT DEFAULT '[]',

      -- Status
      status TEXT DEFAULT 'active',
      completed_at DATETIME,
      outcome TEXT,

      -- AI Processing
      last_tick_at DATETIME,
      tick_notes TEXT,

      -- Metadata
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

      FOREIGN KEY (faction_id) REFERENCES factions(id) ON DELETE CASCADE,
      FOREIGN KEY (target_location_id) REFERENCES locations(id),
      FOREIGN KEY (target_faction_id) REFERENCES factions(id),
      FOREIGN KEY (target_npc_id) REFERENCES npcs(id),
      FOREIGN KEY (target_character_id) REFERENCES characters(id)
    )
  `);

  // Create indexes for faction_goals
  try {
    await db.execute('CREATE INDEX IF NOT EXISTS idx_faction_goals_faction ON faction_goals(faction_id)');
    await db.execute('CREATE INDEX IF NOT EXISTS idx_faction_goals_status ON faction_goals(status)');
    await db.execute('CREATE INDEX IF NOT EXISTS idx_faction_goals_visibility ON faction_goals(visibility)');
  } catch (e) {
    // Indexes might already exist
  }

  // Faction standings table - character relationships with factions
  await db.execute(`
    CREATE TABLE IF NOT EXISTS faction_standings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      character_id INTEGER NOT NULL,
      faction_id INTEGER NOT NULL,

      -- Standing
      standing INTEGER DEFAULT 0,
      standing_label TEXT DEFAULT 'unknown',
      rank TEXT,

      -- Membership
      is_member INTEGER DEFAULT 0,
      joined_at DATETIME,
      membership_level TEXT,

      -- History
      deeds_for TEXT DEFAULT '[]',
      deeds_against TEXT DEFAULT '[]',
      gifts_given TEXT DEFAULT '[]',
      quests_completed TEXT DEFAULT '[]',

      -- Knowledge
      known_members TEXT DEFAULT '[]',
      known_goals TEXT DEFAULT '[]',
      known_secrets TEXT DEFAULT '[]',

      -- Metadata
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

      FOREIGN KEY (character_id) REFERENCES characters(id),
      FOREIGN KEY (faction_id) REFERENCES factions(id) ON DELETE CASCADE,
      UNIQUE(character_id, faction_id)
    )
  `);

  // Create indexes for faction_standings
  try {
    await db.execute('CREATE INDEX IF NOT EXISTS idx_faction_standings_character ON faction_standings(character_id)');
    await db.execute('CREATE INDEX IF NOT EXISTS idx_faction_standings_faction ON faction_standings(faction_id)');
    await db.execute('CREATE INDEX IF NOT EXISTS idx_faction_standings_standing ON faction_standings(standing)');
  } catch (e) {
    // Indexes might already exist
  }

  // ============================================================
  // EXPANSION SYSTEMS - PHASE 1: WORLD EVENTS
  // ============================================================

  // World events table - significant events affecting the game world
  await db.execute(`
    CREATE TABLE IF NOT EXISTS world_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id INTEGER,

      -- Event Identity
      title TEXT NOT NULL,
      description TEXT,
      event_type TEXT DEFAULT 'political',

      -- Scope
      scope TEXT DEFAULT 'local',
      affected_locations TEXT DEFAULT '[]',
      affected_factions TEXT DEFAULT '[]',

      -- Stages (multi-stage progression)
      current_stage INTEGER DEFAULT 0,
      stages TEXT DEFAULT '[]',
      stage_descriptions TEXT DEFAULT '[]',

      -- Timing
      started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expected_duration_days INTEGER,
      deadline TEXT,

      -- Visibility
      visibility TEXT DEFAULT 'public',
      discovered_by_characters TEXT DEFAULT '[]',

      -- Causation
      triggered_by_faction_id INTEGER,
      triggered_by_character_id INTEGER,
      triggered_by_event_id INTEGER,

      -- Outcomes
      possible_outcomes TEXT DEFAULT '[]',
      player_intervention_options TEXT DEFAULT '[]',

      -- Status
      status TEXT DEFAULT 'active',
      completed_at DATETIME,
      outcome TEXT,
      outcome_description TEXT,

      -- AI Processing
      last_tick_at DATETIME,
      tick_notes TEXT,

      -- Metadata
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

      FOREIGN KEY (campaign_id) REFERENCES campaigns(id),
      FOREIGN KEY (triggered_by_faction_id) REFERENCES factions(id),
      FOREIGN KEY (triggered_by_character_id) REFERENCES characters(id),
      FOREIGN KEY (triggered_by_event_id) REFERENCES world_events(id)
    )
  `);

  // Create indexes for world_events
  try {
    await db.execute('CREATE INDEX IF NOT EXISTS idx_world_events_campaign ON world_events(campaign_id)');
    await db.execute('CREATE INDEX IF NOT EXISTS idx_world_events_status ON world_events(status)');
    await db.execute('CREATE INDEX IF NOT EXISTS idx_world_events_type ON world_events(event_type)');
    await db.execute('CREATE INDEX IF NOT EXISTS idx_world_events_scope ON world_events(scope)');
  } catch (e) {
    // Indexes might already exist
  }

  // Event effects table - specific effects from world events
  await db.execute(`
    CREATE TABLE IF NOT EXISTS event_effects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id INTEGER NOT NULL,

      -- Effect Definition
      effect_type TEXT NOT NULL,
      description TEXT,

      -- Target
      target_type TEXT NOT NULL,
      target_id INTEGER,

      -- Effect Parameters (JSON)
      parameters TEXT DEFAULT '{}',

      -- Timing
      stage_applied INTEGER DEFAULT 0,
      duration TEXT,
      expires_at DATETIME,

      -- Status
      status TEXT DEFAULT 'active',
      reversed_at DATETIME,
      reversal_reason TEXT,

      -- Metadata
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

      FOREIGN KEY (event_id) REFERENCES world_events(id) ON DELETE CASCADE
    )
  `);

  // Create indexes for event_effects
  try {
    await db.execute('CREATE INDEX IF NOT EXISTS idx_event_effects_event ON event_effects(event_id)');
    await db.execute('CREATE INDEX IF NOT EXISTS idx_event_effects_target ON event_effects(target_type, target_id)');
    await db.execute('CREATE INDEX IF NOT EXISTS idx_event_effects_status ON event_effects(status)');
  } catch (e) {
    // Indexes might already exist
  }

  // ============================================================
  // EXPANSION SYSTEMS - PHASE 2: TRAVEL SYSTEM
  // ============================================================

  // Journeys table - tracks travel between locations
  await db.execute(`
    CREATE TABLE IF NOT EXISTS journeys (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      character_id INTEGER NOT NULL,
      campaign_id INTEGER,

      -- Route
      origin_location_id INTEGER NOT NULL,
      destination_location_id INTEGER NOT NULL,
      origin_name TEXT,
      destination_name TEXT,

      -- Journey Details
      travel_method TEXT DEFAULT 'walking',
      route_type TEXT DEFAULT 'road',
      distance_miles INTEGER,
      estimated_hours INTEGER,
      actual_hours INTEGER,

      -- Timing
      started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expected_arrival DATETIME,
      actual_arrival DATETIME,
      game_start_day INTEGER,
      game_start_hour INTEGER,

      -- Resources
      rations_consumed INTEGER DEFAULT 0,
      gold_spent INTEGER DEFAULT 0,

      -- Party
      traveling_companions TEXT DEFAULT '[]',

      -- Status
      status TEXT DEFAULT 'in_progress',
      outcome TEXT,
      outcome_description TEXT,

      -- Encounters (count)
      encounters_faced INTEGER DEFAULT 0,
      encounters_avoided INTEGER DEFAULT 0,

      -- Metadata
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

      FOREIGN KEY (character_id) REFERENCES characters(id),
      FOREIGN KEY (campaign_id) REFERENCES campaigns(id),
      FOREIGN KEY (origin_location_id) REFERENCES locations(id),
      FOREIGN KEY (destination_location_id) REFERENCES locations(id)
    )
  `);

  // Create indexes for journeys
  try {
    await db.execute('CREATE INDEX IF NOT EXISTS idx_journeys_character ON journeys(character_id)');
    await db.execute('CREATE INDEX IF NOT EXISTS idx_journeys_campaign ON journeys(campaign_id)');
    await db.execute('CREATE INDEX IF NOT EXISTS idx_journeys_status ON journeys(status)');
  } catch (e) {
    // Indexes might already exist
  }

  // Journey encounters table - events that happen during travel
  await db.execute(`
    CREATE TABLE IF NOT EXISTS journey_encounters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      journey_id INTEGER NOT NULL,

      -- Encounter Details
      encounter_type TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,

      -- Timing (when during journey)
      hours_into_journey INTEGER,
      game_day INTEGER,
      game_hour INTEGER,

      -- Difficulty
      danger_level INTEGER DEFAULT 3,
      challenge_type TEXT,

      -- Resolution
      status TEXT DEFAULT 'pending',
      approach TEXT,
      outcome TEXT,
      outcome_description TEXT,

      -- Consequences
      hp_change INTEGER DEFAULT 0,
      gold_change INTEGER DEFAULT 0,
      items_gained TEXT DEFAULT '[]',
      items_lost TEXT DEFAULT '[]',
      time_lost_hours INTEGER DEFAULT 0,

      -- NPCs involved
      npcs_involved TEXT DEFAULT '[]',

      -- Story Thread created (if any)
      created_story_thread_id INTEGER,

      -- Metadata
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

      FOREIGN KEY (journey_id) REFERENCES journeys(id) ON DELETE CASCADE,
      FOREIGN KEY (created_story_thread_id) REFERENCES story_threads(id)
    )
  `);

  // Create indexes for journey_encounters
  try {
    await db.execute('CREATE INDEX IF NOT EXISTS idx_journey_encounters_journey ON journey_encounters(journey_id)');
    await db.execute('CREATE INDEX IF NOT EXISTS idx_journey_encounters_type ON journey_encounters(encounter_type)');
    await db.execute('CREATE INDEX IF NOT EXISTS idx_journey_encounters_status ON journey_encounters(status)');
  } catch (e) {
    // Indexes might already exist
  }

  // Add location_id to characters table (migration) - links to locations table
  if (!charColNamesForCampaign.includes('current_location_id')) {
    try {
      await db.execute('ALTER TABLE characters ADD COLUMN current_location_id INTEGER REFERENCES locations(id)');
    } catch (e) {
      if (!e.message.includes('duplicate column')) {
        console.error('Migration error for current_location_id:', e.message);
      }
    }
  }

  // Add location_id to adventures table (migration)
  const advColsForLocation = await db.execute("PRAGMA table_info(adventures)");
  const advColNamesForLocation = advColsForLocation.rows.map(c => c.name);

  if (!advColNamesForLocation.includes('location_id')) {
    try {
      await db.execute('ALTER TABLE adventures ADD COLUMN location_id INTEGER REFERENCES locations(id)');
    } catch (e) {
      if (!e.message.includes('duplicate column')) {
        console.error('Migration error for location_id on adventures:', e.message);
      }
    }
  }

  // Add tags to adventures table for quest requirement matching
  if (!advColNamesForLocation.includes('tags')) {
    try {
      await db.execute("ALTER TABLE adventures ADD COLUMN tags TEXT DEFAULT '[]'");
    } catch (e) {
      if (!e.message.includes('duplicate column')) {
        console.error('Migration error for tags on adventures:', e.message);
      }
    }
  }

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
