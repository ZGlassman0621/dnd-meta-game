/**
 * Migration 001: Initial Schema
 *
 * Creates all 24 tables, applies all column migrations, and creates all indexes.
 * Fully idempotent — safe to run on existing databases (uses IF NOT EXISTS and
 * PRAGMA table_info checks before ALTER TABLE).
 */

// Helper: run conditional column migrations for a table
async function migrateColumns(db, table, migrations) {
  const columns = await db.execute(`PRAGMA table_info(${table})`);
  const existing = columns.rows.map(col => col.name);

  for (const m of migrations) {
    if (!existing.includes(m.col)) {
      try {
        await db.execute(m.sql);
      } catch (e) {
        if (!e.message.includes('duplicate column')) {
          console.error(`Migration error for ${table}.${m.col}:`, e.message);
        }
      }
    }
  }
}

export async function up(db) {

  // ============================================================
  // CHARACTERS
  // ============================================================

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

  await migrateColumns(db, 'characters', [
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
    { col: 'known_spells', sql: "ALTER TABLE characters ADD COLUMN known_spells TEXT DEFAULT '[]'" },
    { col: 'feats', sql: "ALTER TABLE characters ADD COLUMN feats TEXT DEFAULT '[]'" },
    { col: 'parsed_backstory', sql: 'ALTER TABLE characters ADD COLUMN parsed_backstory TEXT' },
    { col: 'languages', sql: "ALTER TABLE characters ADD COLUMN languages TEXT DEFAULT '[]'" },
    { col: 'tool_proficiencies', sql: "ALTER TABLE characters ADD COLUMN tool_proficiencies TEXT DEFAULT '[]'" },
    { col: 'character_memories', sql: "ALTER TABLE characters ADD COLUMN character_memories TEXT DEFAULT ''" },
    { col: 'campaign_id', sql: 'ALTER TABLE characters ADD COLUMN campaign_id INTEGER REFERENCES campaigns(id)' },
    { col: 'current_location_id', sql: 'ALTER TABLE characters ADD COLUMN current_location_id INTEGER REFERENCES locations(id)' },
  ]);

  // ============================================================
  // ADVENTURES
  // ============================================================

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

  await migrateColumns(db, 'adventures', [
    { col: 'participating_companions', sql: "ALTER TABLE adventures ADD COLUMN participating_companions TEXT DEFAULT '[]'" },
    { col: 'estimated_game_hours', sql: 'ALTER TABLE adventures ADD COLUMN estimated_game_hours INTEGER DEFAULT 8' },
    { col: 'activity_type', sql: "ALTER TABLE adventures ADD COLUMN activity_type TEXT DEFAULT 'combat'" },
    { col: 'quest_relevance', sql: "ALTER TABLE adventures ADD COLUMN quest_relevance TEXT DEFAULT 'side_quest'" },
    { col: 'location_id', sql: 'ALTER TABLE adventures ADD COLUMN location_id INTEGER REFERENCES locations(id)' },
    { col: 'tags', sql: "ALTER TABLE adventures ADD COLUMN tags TEXT DEFAULT '[]'" },
  ]);

  // ============================================================
  // ADVENTURE OPTIONS CACHE
  // ============================================================

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

  // ============================================================
  // DM SESSIONS
  // ============================================================

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

  await migrateColumns(db, 'dm_sessions', [
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
  ]);

  // ============================================================
  // NPCS
  // ============================================================

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

  await migrateColumns(db, 'npcs', [
    { col: 'campaign_availability', sql: "ALTER TABLE npcs ADD COLUMN campaign_availability TEXT DEFAULT 'available'" },
  ]);

  // ============================================================
  // DOWNTIME
  // ============================================================

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

  await migrateColumns(db, 'downtime', [
    { col: 'work_type', sql: 'ALTER TABLE downtime ADD COLUMN work_type TEXT' },
    { col: 'rest_type', sql: 'ALTER TABLE downtime ADD COLUMN rest_type TEXT' },
  ]);

  // ============================================================
  // COMPANIONS
  // ============================================================

  await db.execute(`
    CREATE TABLE IF NOT EXISTS companions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      npc_id INTEGER NOT NULL,
      recruited_by_character_id INTEGER NOT NULL,
      recruited_session_id INTEGER,
      recruited_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      companion_class TEXT,
      companion_level INTEGER DEFAULT 1,
      companion_subclass TEXT,
      companion_max_hp INTEGER,
      companion_current_hp INTEGER,
      companion_ability_scores TEXT,
      progression_type TEXT DEFAULT 'npc_stats',
      original_stats_snapshot TEXT,
      status TEXT DEFAULT 'active',
      dismissed_at DATETIME,
      notes TEXT,
      FOREIGN KEY (npc_id) REFERENCES npcs(id),
      FOREIGN KEY (recruited_by_character_id) REFERENCES characters(id),
      FOREIGN KEY (recruited_session_id) REFERENCES dm_sessions(id)
    )
  `);

  await migrateColumns(db, 'companions', [
    { col: 'inventory', sql: "ALTER TABLE companions ADD COLUMN inventory TEXT DEFAULT '[]'" },
    { col: 'gold_gp', sql: 'ALTER TABLE companions ADD COLUMN gold_gp INTEGER DEFAULT 0' },
    { col: 'gold_sp', sql: 'ALTER TABLE companions ADD COLUMN gold_sp INTEGER DEFAULT 0' },
    { col: 'gold_cp', sql: 'ALTER TABLE companions ADD COLUMN gold_cp INTEGER DEFAULT 0' },
    { col: 'equipment', sql: "ALTER TABLE companions ADD COLUMN equipment TEXT DEFAULT '{}'" },
    { col: 'companion_experience', sql: 'ALTER TABLE companions ADD COLUMN companion_experience INTEGER DEFAULT 0' },
    { col: 'skill_proficiencies', sql: "ALTER TABLE companions ADD COLUMN skill_proficiencies TEXT DEFAULT '[]'" },
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
    { col: 'cantrips', sql: "ALTER TABLE companions ADD COLUMN cantrips TEXT DEFAULT '[]'" },
    { col: 'spells_known', sql: "ALTER TABLE companions ADD COLUMN spells_known TEXT DEFAULT '[]'" },
  ]);

  // ============================================================
  // ACTIVITY QUEUE
  // ============================================================

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

  // ============================================================
  // STORY THREADS
  // ============================================================

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

  await migrateColumns(db, 'story_threads', [
    { col: 'consequence_category', sql: "ALTER TABLE story_threads ADD COLUMN consequence_category TEXT DEFAULT 'intel'" },
    { col: 'can_resolve_quest', sql: 'ALTER TABLE story_threads ADD COLUMN can_resolve_quest INTEGER DEFAULT 0' },
  ]);

  // ============================================================
  // CAMPAIGNS
  // ============================================================

  await db.execute(`
    CREATE TABLE IF NOT EXISTS campaigns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      setting TEXT DEFAULT 'Forgotten Realms',
      tone TEXT DEFAULT 'heroic fantasy',
      starting_location TEXT,
      status TEXT DEFAULT 'active',
      time_ratio TEXT DEFAULT 'normal',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await migrateColumns(db, 'campaigns', [
    { col: 'campaign_plan', sql: 'ALTER TABLE campaigns ADD COLUMN campaign_plan TEXT' },
  ]);

  // ============================================================
  // LOCATIONS
  // ============================================================

  await db.execute(`
    CREATE TABLE IF NOT EXISTS locations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id INTEGER,
      name TEXT NOT NULL,
      description TEXT,
      location_type TEXT NOT NULL DEFAULT 'settlement',
      parent_location_id INTEGER,
      region TEXT,
      population_size TEXT,
      danger_level INTEGER DEFAULT 1,
      prosperity_level INTEGER DEFAULT 5,
      services TEXT DEFAULT '[]',
      tags TEXT DEFAULT '[]',
      climate TEXT DEFAULT 'temperate',
      discovery_status TEXT DEFAULT 'unknown',
      first_visited_date TEXT,
      times_visited INTEGER DEFAULT 0,
      connected_locations TEXT DEFAULT '[]',
      current_state TEXT DEFAULT 'peaceful',
      state_description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (campaign_id) REFERENCES campaigns(id),
      FOREIGN KEY (parent_location_id) REFERENCES locations(id)
    )
  `);

  try {
    await db.execute('CREATE INDEX IF NOT EXISTS idx_locations_campaign ON locations(campaign_id)');
    await db.execute('CREATE INDEX IF NOT EXISTS idx_locations_type ON locations(location_type)');
    await db.execute('CREATE INDEX IF NOT EXISTS idx_locations_discovery ON locations(discovery_status)');
  } catch (e) { /* indexes may already exist */ }

  // ============================================================
  // QUESTS
  // ============================================================

  await db.execute(`
    CREATE TABLE IF NOT EXISTS quests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id INTEGER,
      character_id INTEGER NOT NULL,
      quest_type TEXT NOT NULL DEFAULT 'side',
      source_type TEXT,
      source_id INTEGER,
      title TEXT NOT NULL,
      premise TEXT NOT NULL,
      description TEXT,
      antagonist TEXT,
      status TEXT DEFAULT 'active',
      priority TEXT DEFAULT 'normal',
      current_stage INTEGER DEFAULT 0,
      stages TEXT DEFAULT '[]',
      completion_criteria TEXT,
      rewards TEXT DEFAULT '{}',
      world_impact_on_complete TEXT,
      world_state_changes TEXT DEFAULT '[]',
      time_sensitive INTEGER DEFAULT 0,
      deadline_date TEXT,
      escalation_if_ignored TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      started_at DATETIME,
      completed_at DATETIME,
      FOREIGN KEY (campaign_id) REFERENCES campaigns(id),
      FOREIGN KEY (character_id) REFERENCES characters(id)
    )
  `);

  try {
    await db.execute('CREATE INDEX IF NOT EXISTS idx_quests_campaign ON quests(campaign_id)');
    await db.execute('CREATE INDEX IF NOT EXISTS idx_quests_character ON quests(character_id)');
    await db.execute('CREATE INDEX IF NOT EXISTS idx_quests_status ON quests(status)');
    await db.execute('CREATE INDEX IF NOT EXISTS idx_quests_type ON quests(quest_type)');
  } catch (e) { /* indexes may already exist */ }

  // ============================================================
  // QUEST REQUIREMENTS
  // ============================================================

  await db.execute(`
    CREATE TABLE IF NOT EXISTS quest_requirements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quest_id INTEGER NOT NULL,
      stage_index INTEGER NOT NULL,
      requirement_type TEXT NOT NULL,
      description TEXT NOT NULL,
      params TEXT DEFAULT '{}',
      status TEXT DEFAULT 'incomplete',
      completed_at DATETIME,
      completed_by TEXT,
      is_optional INTEGER DEFAULT 0,
      FOREIGN KEY (quest_id) REFERENCES quests(id) ON DELETE CASCADE
    )
  `);

  try {
    await db.execute('CREATE INDEX IF NOT EXISTS idx_quest_req_quest ON quest_requirements(quest_id)');
    await db.execute('CREATE INDEX IF NOT EXISTS idx_quest_req_status ON quest_requirements(status)');
  } catch (e) { /* indexes may already exist */ }

  // ============================================================
  // NPC RELATIONSHIPS
  // ============================================================

  await db.execute(`
    CREATE TABLE IF NOT EXISTS npc_relationships (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      character_id INTEGER NOT NULL,
      npc_id INTEGER NOT NULL,
      disposition INTEGER DEFAULT 0,
      disposition_label TEXT DEFAULT 'neutral',
      trust_level INTEGER DEFAULT 0,
      times_met INTEGER DEFAULT 0,
      first_met_date TEXT,
      first_met_location_id INTEGER,
      last_interaction_date TEXT,
      witnessed_deeds TEXT DEFAULT '[]',
      known_facts TEXT DEFAULT '[]',
      rumors_heard TEXT DEFAULT '[]',
      player_known_facts TEXT DEFAULT '[]',
      discovered_secrets TEXT DEFAULT '[]',
      promises_made TEXT DEFAULT '[]',
      debts_owed TEXT DEFAULT '[]',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (character_id) REFERENCES characters(id),
      FOREIGN KEY (npc_id) REFERENCES npcs(id),
      FOREIGN KEY (first_met_location_id) REFERENCES locations(id),
      UNIQUE(character_id, npc_id)
    )
  `);

  try {
    await db.execute('CREATE INDEX IF NOT EXISTS idx_npc_rel_character ON npc_relationships(character_id)');
    await db.execute('CREATE INDEX IF NOT EXISTS idx_npc_rel_disposition ON npc_relationships(disposition)');
  } catch (e) { /* indexes may already exist */ }

  // ============================================================
  // COMPANION BACKSTORIES
  // ============================================================

  await db.execute(`
    CREATE TABLE IF NOT EXISTS companion_backstories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      companion_id INTEGER NOT NULL UNIQUE,
      origin_location TEXT,
      origin_description TEXT,
      formative_event TEXT,
      formative_event_date TEXT,
      personal_goal TEXT,
      goal_progress TEXT,
      unresolved_threads TEXT DEFAULT '[]',
      loyalty INTEGER DEFAULT 50,
      loyalty_events TEXT DEFAULT '[]',
      secrets TEXT DEFAULT '[]',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (companion_id) REFERENCES companions(id) ON DELETE CASCADE
    )
  `);

  try {
    await db.execute('CREATE INDEX IF NOT EXISTS idx_companion_backstory ON companion_backstories(companion_id)');
  } catch (e) { /* index may already exist */ }

  // ============================================================
  // NARRATIVE QUEUE
  // ============================================================

  await db.execute(`
    CREATE TABLE IF NOT EXISTS narrative_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id INTEGER,
      character_id INTEGER NOT NULL,
      event_type TEXT NOT NULL,
      priority TEXT DEFAULT 'normal',
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      context TEXT DEFAULT '{}',
      related_quest_id INTEGER,
      related_companion_id INTEGER,
      related_npc_id INTEGER,
      related_location_id INTEGER,
      related_thread_id INTEGER,
      status TEXT DEFAULT 'pending',
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

  try {
    await db.execute('CREATE INDEX IF NOT EXISTS idx_narrative_queue_campaign ON narrative_queue(campaign_id, status)');
    await db.execute('CREATE INDEX IF NOT EXISTS idx_narrative_queue_priority ON narrative_queue(priority)');
    await db.execute('CREATE INDEX IF NOT EXISTS idx_narrative_queue_character ON narrative_queue(character_id, status)');
  } catch (e) { /* indexes may already exist */ }

  // ============================================================
  // FACTIONS
  // ============================================================

  await db.execute(`
    CREATE TABLE IF NOT EXISTS factions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id INTEGER,
      name TEXT NOT NULL,
      description TEXT,
      symbol TEXT,
      motto TEXT,
      scope TEXT DEFAULT 'local',
      power_level INTEGER DEFAULT 5,
      influence_areas TEXT DEFAULT '[]',
      headquarters_location_id INTEGER,
      territory TEXT DEFAULT '[]',
      leader_npc_id INTEGER,
      leadership_structure TEXT DEFAULT 'autocratic',
      notable_members TEXT DEFAULT '[]',
      wealth_level INTEGER DEFAULT 5,
      military_strength INTEGER DEFAULT 5,
      political_influence INTEGER DEFAULT 5,
      magical_resources INTEGER DEFAULT 3,
      information_network INTEGER DEFAULT 5,
      faction_relationships TEXT DEFAULT '{}',
      alignment TEXT DEFAULT 'neutral',
      primary_values TEXT DEFAULT '[]',
      typical_methods TEXT DEFAULT '[]',
      recruitment_requirements TEXT,
      membership_benefits TEXT DEFAULT '[]',
      status TEXT DEFAULT 'active',
      public_reputation INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (campaign_id) REFERENCES campaigns(id),
      FOREIGN KEY (headquarters_location_id) REFERENCES locations(id),
      FOREIGN KEY (leader_npc_id) REFERENCES npcs(id)
    )
  `);

  try {
    await db.execute('CREATE INDEX IF NOT EXISTS idx_factions_campaign ON factions(campaign_id)');
    await db.execute('CREATE INDEX IF NOT EXISTS idx_factions_scope ON factions(scope)');
    await db.execute('CREATE INDEX IF NOT EXISTS idx_factions_status ON factions(status)');
  } catch (e) { /* indexes may already exist */ }

  // ============================================================
  // FACTION GOALS
  // ============================================================

  await db.execute(`
    CREATE TABLE IF NOT EXISTS faction_goals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      faction_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      goal_type TEXT DEFAULT 'expansion',
      progress INTEGER DEFAULT 0,
      progress_max INTEGER DEFAULT 100,
      milestones TEXT DEFAULT '[]',
      deadline TEXT,
      urgency TEXT DEFAULT 'normal',
      started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      success_consequences TEXT,
      failure_consequences TEXT,
      stakes_level TEXT DEFAULT 'moderate',
      target_location_id INTEGER,
      target_faction_id INTEGER,
      target_npc_id INTEGER,
      target_character_id INTEGER,
      visibility TEXT DEFAULT 'secret',
      discovered_by_characters TEXT DEFAULT '[]',
      status TEXT DEFAULT 'active',
      completed_at DATETIME,
      outcome TEXT,
      last_tick_at DATETIME,
      tick_notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (faction_id) REFERENCES factions(id) ON DELETE CASCADE,
      FOREIGN KEY (target_location_id) REFERENCES locations(id),
      FOREIGN KEY (target_faction_id) REFERENCES factions(id),
      FOREIGN KEY (target_npc_id) REFERENCES npcs(id),
      FOREIGN KEY (target_character_id) REFERENCES characters(id)
    )
  `);

  try {
    await db.execute('CREATE INDEX IF NOT EXISTS idx_faction_goals_faction ON faction_goals(faction_id)');
    await db.execute('CREATE INDEX IF NOT EXISTS idx_faction_goals_status ON faction_goals(status)');
    await db.execute('CREATE INDEX IF NOT EXISTS idx_faction_goals_visibility ON faction_goals(visibility)');
  } catch (e) { /* indexes may already exist */ }

  // ============================================================
  // FACTION STANDINGS
  // ============================================================

  await db.execute(`
    CREATE TABLE IF NOT EXISTS faction_standings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      character_id INTEGER NOT NULL,
      faction_id INTEGER NOT NULL,
      standing INTEGER DEFAULT 0,
      standing_label TEXT DEFAULT 'unknown',
      rank TEXT,
      is_member INTEGER DEFAULT 0,
      joined_at DATETIME,
      membership_level TEXT,
      deeds_for TEXT DEFAULT '[]',
      deeds_against TEXT DEFAULT '[]',
      gifts_given TEXT DEFAULT '[]',
      quests_completed TEXT DEFAULT '[]',
      known_members TEXT DEFAULT '[]',
      known_goals TEXT DEFAULT '[]',
      known_secrets TEXT DEFAULT '[]',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (character_id) REFERENCES characters(id),
      FOREIGN KEY (faction_id) REFERENCES factions(id) ON DELETE CASCADE,
      UNIQUE(character_id, faction_id)
    )
  `);

  try {
    await db.execute('CREATE INDEX IF NOT EXISTS idx_faction_standings_character ON faction_standings(character_id)');
    await db.execute('CREATE INDEX IF NOT EXISTS idx_faction_standings_faction ON faction_standings(faction_id)');
    await db.execute('CREATE INDEX IF NOT EXISTS idx_faction_standings_standing ON faction_standings(standing)');
  } catch (e) { /* indexes may already exist */ }

  // ============================================================
  // WORLD EVENTS
  // ============================================================

  await db.execute(`
    CREATE TABLE IF NOT EXISTS world_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id INTEGER,
      title TEXT NOT NULL,
      description TEXT,
      event_type TEXT DEFAULT 'political',
      scope TEXT DEFAULT 'local',
      affected_locations TEXT DEFAULT '[]',
      affected_factions TEXT DEFAULT '[]',
      current_stage INTEGER DEFAULT 0,
      stages TEXT DEFAULT '[]',
      stage_descriptions TEXT DEFAULT '[]',
      started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expected_duration_days INTEGER,
      deadline TEXT,
      visibility TEXT DEFAULT 'public',
      discovered_by_characters TEXT DEFAULT '[]',
      triggered_by_faction_id INTEGER,
      triggered_by_character_id INTEGER,
      triggered_by_event_id INTEGER,
      possible_outcomes TEXT DEFAULT '[]',
      player_intervention_options TEXT DEFAULT '[]',
      status TEXT DEFAULT 'active',
      completed_at DATETIME,
      outcome TEXT,
      outcome_description TEXT,
      last_tick_at DATETIME,
      tick_notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (campaign_id) REFERENCES campaigns(id),
      FOREIGN KEY (triggered_by_faction_id) REFERENCES factions(id),
      FOREIGN KEY (triggered_by_character_id) REFERENCES characters(id),
      FOREIGN KEY (triggered_by_event_id) REFERENCES world_events(id)
    )
  `);

  try {
    await db.execute('CREATE INDEX IF NOT EXISTS idx_world_events_campaign ON world_events(campaign_id)');
    await db.execute('CREATE INDEX IF NOT EXISTS idx_world_events_status ON world_events(status)');
    await db.execute('CREATE INDEX IF NOT EXISTS idx_world_events_type ON world_events(event_type)');
    await db.execute('CREATE INDEX IF NOT EXISTS idx_world_events_scope ON world_events(scope)');
  } catch (e) { /* indexes may already exist */ }

  // ============================================================
  // EVENT EFFECTS
  // ============================================================

  await db.execute(`
    CREATE TABLE IF NOT EXISTS event_effects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id INTEGER NOT NULL,
      effect_type TEXT NOT NULL,
      description TEXT,
      target_type TEXT NOT NULL,
      target_id INTEGER,
      parameters TEXT DEFAULT '{}',
      stage_applied INTEGER DEFAULT 0,
      duration TEXT,
      expires_at DATETIME,
      status TEXT DEFAULT 'active',
      reversed_at DATETIME,
      reversal_reason TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (event_id) REFERENCES world_events(id) ON DELETE CASCADE
    )
  `);

  try {
    await db.execute('CREATE INDEX IF NOT EXISTS idx_event_effects_event ON event_effects(event_id)');
    await db.execute('CREATE INDEX IF NOT EXISTS idx_event_effects_target ON event_effects(target_type, target_id)');
    await db.execute('CREATE INDEX IF NOT EXISTS idx_event_effects_status ON event_effects(status)');
  } catch (e) { /* indexes may already exist */ }

  // ============================================================
  // JOURNEYS (TRAVEL)
  // ============================================================

  await db.execute(`
    CREATE TABLE IF NOT EXISTS journeys (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      character_id INTEGER NOT NULL,
      campaign_id INTEGER,
      origin_location_id INTEGER NOT NULL,
      destination_location_id INTEGER NOT NULL,
      origin_name TEXT,
      destination_name TEXT,
      travel_method TEXT DEFAULT 'walking',
      route_type TEXT DEFAULT 'road',
      distance_miles INTEGER,
      estimated_hours INTEGER,
      actual_hours INTEGER,
      started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expected_arrival DATETIME,
      actual_arrival DATETIME,
      game_start_day INTEGER,
      game_start_hour INTEGER,
      rations_consumed INTEGER DEFAULT 0,
      gold_spent INTEGER DEFAULT 0,
      traveling_companions TEXT DEFAULT '[]',
      status TEXT DEFAULT 'in_progress',
      outcome TEXT,
      outcome_description TEXT,
      encounters_faced INTEGER DEFAULT 0,
      encounters_avoided INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (character_id) REFERENCES characters(id),
      FOREIGN KEY (campaign_id) REFERENCES campaigns(id),
      FOREIGN KEY (origin_location_id) REFERENCES locations(id),
      FOREIGN KEY (destination_location_id) REFERENCES locations(id)
    )
  `);

  try {
    await db.execute('CREATE INDEX IF NOT EXISTS idx_journeys_character ON journeys(character_id)');
    await db.execute('CREATE INDEX IF NOT EXISTS idx_journeys_campaign ON journeys(campaign_id)');
    await db.execute('CREATE INDEX IF NOT EXISTS idx_journeys_status ON journeys(status)');
  } catch (e) { /* indexes may already exist */ }

  // ============================================================
  // JOURNEY ENCOUNTERS
  // ============================================================

  await db.execute(`
    CREATE TABLE IF NOT EXISTS journey_encounters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      journey_id INTEGER NOT NULL,
      encounter_type TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      hours_into_journey INTEGER,
      game_day INTEGER,
      game_hour INTEGER,
      danger_level INTEGER DEFAULT 3,
      challenge_type TEXT,
      status TEXT DEFAULT 'pending',
      approach TEXT,
      outcome TEXT,
      outcome_description TEXT,
      hp_change INTEGER DEFAULT 0,
      gold_change INTEGER DEFAULT 0,
      items_gained TEXT DEFAULT '[]',
      items_lost TEXT DEFAULT '[]',
      time_lost_hours INTEGER DEFAULT 0,
      npcs_involved TEXT DEFAULT '[]',
      created_story_thread_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (journey_id) REFERENCES journeys(id) ON DELETE CASCADE,
      FOREIGN KEY (created_story_thread_id) REFERENCES story_threads(id)
    )
  `);

  try {
    await db.execute('CREATE INDEX IF NOT EXISTS idx_journey_encounters_journey ON journey_encounters(journey_id)');
    await db.execute('CREATE INDEX IF NOT EXISTS idx_journey_encounters_type ON journey_encounters(encounter_type)');
    await db.execute('CREATE INDEX IF NOT EXISTS idx_journey_encounters_status ON journey_encounters(status)');
  } catch (e) { /* indexes may already exist */ }

  // ============================================================
  // MERCHANT INVENTORIES
  // ============================================================

  await db.execute(`
    CREATE TABLE IF NOT EXISTS merchant_inventories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id INTEGER NOT NULL,
      merchant_name TEXT NOT NULL,
      merchant_type TEXT NOT NULL,
      location TEXT,
      specialty TEXT,
      personality TEXT,
      prosperity TEXT DEFAULT 'comfortable',
      inventory TEXT DEFAULT '[]',
      gold_gp INTEGER DEFAULT 500,
      last_restocked TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (campaign_id) REFERENCES campaigns(id)
    )
  `);

  try {
    await db.execute('CREATE INDEX IF NOT EXISTS idx_merchant_inv_campaign ON merchant_inventories(campaign_id)');
    await db.execute('CREATE INDEX IF NOT EXISTS idx_merchant_inv_name ON merchant_inventories(merchant_name)');
  } catch (e) { /* indexes may already exist */ }

  await migrateColumns(db, 'merchant_inventories', [
    { col: 'inventory_version', sql: 'ALTER TABLE merchant_inventories ADD COLUMN inventory_version INTEGER DEFAULT 0' },
  ]);

  // ============================================================
  // DM MODE - AI-controlled player character parties
  // ============================================================

  await migrateColumns(db, 'dm_sessions', [
    { col: 'session_type', sql: "ALTER TABLE dm_sessions ADD COLUMN session_type TEXT DEFAULT 'player'" },
    { col: 'dm_mode_party_id', sql: 'ALTER TABLE dm_sessions ADD COLUMN dm_mode_party_id INTEGER' },
  ]);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS dm_mode_parties (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      setting TEXT DEFAULT 'Forgotten Realms',
      tone TEXT DEFAULT 'heroic fantasy',
      level INTEGER DEFAULT 1,
      party_data TEXT NOT NULL,
      party_dynamics TEXT,
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
}
