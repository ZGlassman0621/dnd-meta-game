/**
 * Migration 019: Party Base System
 * Adds stronghold/base management (inspired by Blades in the Dark crew advancement),
 * long-term project clocks, and notoriety/heat tracking.
 */

export async function up(db) {
  // Party bases — one per character per campaign
  await db.execute(`
    CREATE TABLE IF NOT EXISTS party_bases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id INTEGER NOT NULL,
      character_id INTEGER NOT NULL,
      location_id INTEGER,
      name TEXT NOT NULL,
      base_type TEXT NOT NULL,
      level INTEGER DEFAULT 1,
      renown INTEGER DEFAULT 0,
      description TEXT,
      status TEXT DEFAULT 'establishing',
      established_game_day INTEGER,
      gold_treasury INTEGER DEFAULT 0,
      monthly_upkeep_gp INTEGER DEFAULT 10,
      last_upkeep_game_day INTEGER,
      staff TEXT DEFAULT '[]',
      active_perks TEXT DEFAULT '[]',
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (campaign_id) REFERENCES campaigns(id),
      FOREIGN KEY (character_id) REFERENCES characters(id),
      FOREIGN KEY (location_id) REFERENCES locations(id),
      UNIQUE(campaign_id, character_id)
    )
  `);
  await db.execute('CREATE INDEX IF NOT EXISTS idx_party_bases_campaign ON party_bases(campaign_id)');

  // Base upgrades — progress tracked like crafting_projects
  await db.execute(`
    CREATE TABLE IF NOT EXISTS base_upgrades (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      base_id INTEGER NOT NULL,
      upgrade_key TEXT NOT NULL,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      level INTEGER DEFAULT 1,
      status TEXT DEFAULT 'planned',
      gold_cost INTEGER NOT NULL,
      hours_required INTEGER NOT NULL,
      hours_invested REAL DEFAULT 0,
      started_game_day INTEGER,
      completed_game_day INTEGER,
      perk_granted TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (base_id) REFERENCES party_bases(id) ON DELETE CASCADE,
      UNIQUE(base_id, upgrade_key, level)
    )
  `);
  await db.execute('CREATE INDEX IF NOT EXISTS idx_base_upgrades_status ON base_upgrades(base_id, status)');

  // Base events — entanglements, attacks, visitors, income
  await db.execute(`
    CREATE TABLE IF NOT EXISTS base_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      base_id INTEGER NOT NULL,
      event_type TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      game_day INTEGER NOT NULL,
      severity TEXT DEFAULT 'minor',
      resolved INTEGER DEFAULT 0,
      resolution TEXT,
      gold_impact INTEGER DEFAULT 0,
      narrative_queue_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (base_id) REFERENCES party_bases(id) ON DELETE CASCADE
    )
  `);
  await db.execute('CREATE INDEX IF NOT EXISTS idx_base_events_unresolved ON base_events(base_id, resolved)');

  // Long-term projects — Blades-style clock system
  await db.execute(`
    CREATE TABLE IF NOT EXISTS long_term_projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      character_id INTEGER NOT NULL,
      campaign_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      project_type TEXT NOT NULL,
      total_segments INTEGER NOT NULL,
      segments_filled INTEGER DEFAULT 0,
      status TEXT DEFAULT 'active',
      skill_used TEXT,
      dc INTEGER DEFAULT 12,
      rewards TEXT DEFAULT '{}',
      started_game_day INTEGER,
      completed_game_day INTEGER,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (character_id) REFERENCES characters(id),
      FOREIGN KEY (campaign_id) REFERENCES campaigns(id)
    )
  `);
  await db.execute('CREATE INDEX IF NOT EXISTS idx_long_term_projects_active ON long_term_projects(character_id, status)');

  // Character notoriety — heat per source
  await db.execute(`
    CREATE TABLE IF NOT EXISTS character_notoriety (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      character_id INTEGER NOT NULL,
      campaign_id INTEGER NOT NULL,
      source TEXT NOT NULL,
      score INTEGER DEFAULT 0,
      category TEXT DEFAULT 'criminal',
      last_event_game_day INTEGER,
      last_decay_game_day INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (character_id) REFERENCES characters(id),
      FOREIGN KEY (campaign_id) REFERENCES campaigns(id),
      UNIQUE(character_id, campaign_id, source)
    )
  `);
  await db.execute('CREATE INDEX IF NOT EXISTS idx_notoriety_character ON character_notoriety(character_id, campaign_id)');

  // Add has_base column to characters
  try {
    await db.execute('ALTER TABLE characters ADD COLUMN has_base INTEGER DEFAULT 0');
  } catch (e) {
    // Column may already exist
  }
}

export async function down(db) {
  await db.execute('DROP INDEX IF EXISTS idx_notoriety_character');
  await db.execute('DROP TABLE IF EXISTS character_notoriety');
  await db.execute('DROP INDEX IF EXISTS idx_long_term_projects_active');
  await db.execute('DROP TABLE IF EXISTS long_term_projects');
  await db.execute('DROP INDEX IF EXISTS idx_base_events_unresolved');
  await db.execute('DROP TABLE IF EXISTS base_events');
  await db.execute('DROP INDEX IF EXISTS idx_base_upgrades_status');
  await db.execute('DROP TABLE IF EXISTS base_upgrades');
  await db.execute('DROP INDEX IF EXISTS idx_party_bases_campaign');
  await db.execute('DROP TABLE IF EXISTS party_bases');
}
