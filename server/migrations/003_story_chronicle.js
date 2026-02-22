/**
 * Migration 003: Story Chronicle System
 *
 * Creates tables for structured session chronicles, canonical facts,
 * and compressed message summaries for context window management.
 */

export async function up(db) {
  // Structured session summaries — one row per completed session
  await db.execute(`
    CREATE TABLE IF NOT EXISTS story_chronicles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id INTEGER NOT NULL,
      character_id INTEGER NOT NULL,
      session_id INTEGER NOT NULL UNIQUE,
      game_day_start INTEGER,
      game_day_end INTEGER,
      session_number INTEGER,
      summary TEXT,
      key_decisions TEXT DEFAULT '[]',
      npcs_involved TEXT DEFAULT '[]',
      locations_visited TEXT DEFAULT '[]',
      quests_progressed TEXT DEFAULT '[]',
      combat_encounters TEXT DEFAULT '[]',
      items_gained TEXT DEFAULT '[]',
      items_lost TEXT DEFAULT '[]',
      gold_change INTEGER DEFAULT 0,
      player_death INTEGER DEFAULT 0,
      companion_deaths TEXT DEFAULT '[]',
      mood TEXT,
      cliffhanger TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (campaign_id) REFERENCES campaigns(id),
      FOREIGN KEY (character_id) REFERENCES characters(id),
      FOREIGN KEY (session_id) REFERENCES dm_sessions(id)
    )
  `);

  // Individual canonical facts — queryable story memory
  await db.execute(`
    CREATE TABLE IF NOT EXISTS canon_facts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id INTEGER NOT NULL,
      character_id INTEGER NOT NULL,
      category TEXT NOT NULL,
      subject TEXT NOT NULL,
      fact TEXT NOT NULL,
      source_session_id INTEGER,
      game_day INTEGER,
      is_active INTEGER DEFAULT 1,
      superseded_by INTEGER,
      tags TEXT,
      importance TEXT DEFAULT 'minor',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (campaign_id) REFERENCES campaigns(id),
      FOREIGN KEY (character_id) REFERENCES characters(id),
      FOREIGN KEY (source_session_id) REFERENCES dm_sessions(id),
      FOREIGN KEY (superseded_by) REFERENCES canon_facts(id)
    )
  `);

  // Compressed message blocks for context window management
  await db.execute(`
    CREATE TABLE IF NOT EXISTS session_message_summaries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL,
      message_range_start INTEGER NOT NULL,
      message_range_end INTEGER NOT NULL,
      summary TEXT NOT NULL,
      token_estimate INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (session_id) REFERENCES dm_sessions(id)
    )
  `);

  // Indexes for efficient queries
  await db.execute('CREATE INDEX IF NOT EXISTS idx_chronicles_campaign ON story_chronicles(campaign_id)');
  await db.execute('CREATE INDEX IF NOT EXISTS idx_chronicles_character ON story_chronicles(character_id)');
  await db.execute('CREATE INDEX IF NOT EXISTS idx_chronicles_session ON story_chronicles(session_id)');

  await db.execute('CREATE INDEX IF NOT EXISTS idx_canon_facts_campaign ON canon_facts(campaign_id)');
  await db.execute('CREATE INDEX IF NOT EXISTS idx_canon_facts_character ON canon_facts(character_id)');
  await db.execute('CREATE INDEX IF NOT EXISTS idx_canon_facts_category ON canon_facts(campaign_id, category)');
  await db.execute('CREATE INDEX IF NOT EXISTS idx_canon_facts_subject ON canon_facts(campaign_id, subject)');
  await db.execute('CREATE INDEX IF NOT EXISTS idx_canon_facts_active ON canon_facts(campaign_id, is_active)');
  await db.execute('CREATE INDEX IF NOT EXISTS idx_canon_facts_importance ON canon_facts(campaign_id, importance, is_active)');
  await db.execute('CREATE INDEX IF NOT EXISTS idx_canon_facts_session ON canon_facts(source_session_id)');

  await db.execute('CREATE INDEX IF NOT EXISTS idx_msg_summaries_session ON session_message_summaries(session_id)');
}

export async function down(db) {
  await db.execute('DROP TABLE IF EXISTS session_message_summaries');
  await db.execute('DROP TABLE IF EXISTS canon_facts');
  await db.execute('DROP TABLE IF EXISTS story_chronicles');
}
