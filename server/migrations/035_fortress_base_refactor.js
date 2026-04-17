/**
 * Migration 035: Fortress-Capable Base Refactor (F1a)
 *
 * Refactors the party base system to support multi-category, multi-subtype
 * bases (fortresses, watchtowers, keeps) that each contain a variable number
 * of buildings. The old 6 BitD-style base types (tavern / guild_hall /
 * wizard_tower / temple / thieves_den / manor) become BUILDINGS you install
 * inside a base rather than being bases themselves.
 *
 * Schema model (new):
 *   BASE (party_bases):
 *     category: civilian | martial | arcane | sanctified
 *     subtype: fortress, keep, outpost, watchtower, manor, hall, tavern,
 *              wizard_tower, temple, sanctuary, encampment, ...
 *     is_primary: one flag per character — their "home" base
 *     building_slots: how many buildings can fit (derived from subtype)
 *   BUILDING (base_buildings):
 *     building_type: tavern, guild_hall, wizard_tower, temple, barracks,
 *                    armory, gatehouse, watchtower, training_yard, stables,
 *                    chapel, manor_house, etc.
 *     level, status, hours_invested, hours_required, gold_cost, perks_granted
 *
 * No saves to preserve — per user directive. We drop and recreate the three
 * core tables to avoid awkward column migrations. Notoriety,
 * long_term_projects, and base_events tables are preserved as-is since the
 * user said fortress changes don't touch those systems.
 */

export async function up(db) {
  // Drop the old party-base tables (fresh slate).
  await db.execute('DROP TABLE IF EXISTS base_upgrades');
  await db.execute('DROP TABLE IF EXISTS party_bases');

  // ==========================================================================
  // PARTY_BASES (rebuilt)
  // ==========================================================================
  await db.execute(`
    CREATE TABLE IF NOT EXISTS party_bases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id INTEGER NOT NULL,
      character_id INTEGER NOT NULL,
      location_id INTEGER,
      name TEXT NOT NULL,
      category TEXT NOT NULL CHECK(category IN ('civilian','martial','arcane','sanctified')),
      subtype TEXT NOT NULL,
      is_primary INTEGER NOT NULL DEFAULT 0,
      building_slots INTEGER NOT NULL DEFAULT 4,
      level INTEGER NOT NULL DEFAULT 1,
      renown INTEGER NOT NULL DEFAULT 0,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'establishing'
        CHECK(status IN ('establishing','active','damaged','abandoned')),
      established_game_day INTEGER,
      gold_treasury INTEGER NOT NULL DEFAULT 0,
      monthly_upkeep_gp INTEGER NOT NULL DEFAULT 10,
      last_upkeep_game_day INTEGER,
      staff TEXT DEFAULT '[]',
      active_perks TEXT DEFAULT '[]',
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
      FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE
    )
  `);
  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_bases_char_campaign
    ON party_bases(character_id, campaign_id)
  `);
  // Only one PRIMARY base per character+campaign (partial unique index).
  await db.execute(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_bases_one_primary
    ON party_bases(character_id, campaign_id)
    WHERE is_primary = 1
  `);

  // ==========================================================================
  // BASE_BUILDINGS (new)
  // ==========================================================================
  await db.execute(`
    CREATE TABLE IF NOT EXISTS base_buildings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      base_id INTEGER NOT NULL,
      building_type TEXT NOT NULL,
      name TEXT,
      level INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'planned'
        CHECK(status IN ('planned','in_progress','completed','damaged')),
      gold_cost INTEGER NOT NULL DEFAULT 0,
      hours_required INTEGER NOT NULL DEFAULT 0,
      hours_invested INTEGER NOT NULL DEFAULT 0,
      perks_granted TEXT DEFAULT '[]',
      started_game_day INTEGER,
      completed_game_day INTEGER,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (base_id) REFERENCES party_bases(id) ON DELETE CASCADE
    )
  `);
  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_base_buildings_base
    ON base_buildings(base_id, status)
  `);

  // ==========================================================================
  // BUILDING_UPGRADES (replaces old base_upgrades; now scoped to a building)
  // ==========================================================================
  await db.execute(`
    CREATE TABLE IF NOT EXISTS building_upgrades (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      building_id INTEGER NOT NULL,
      upgrade_key TEXT NOT NULL,
      name TEXT NOT NULL,
      category TEXT,
      level INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'planned'
        CHECK(status IN ('planned','in_progress','completed')),
      gold_cost INTEGER NOT NULL DEFAULT 0,
      hours_required INTEGER NOT NULL DEFAULT 0,
      hours_invested INTEGER NOT NULL DEFAULT 0,
      started_game_day INTEGER,
      completed_game_day INTEGER,
      perk_granted TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(building_id, upgrade_key, level),
      FOREIGN KEY (building_id) REFERENCES base_buildings(id) ON DELETE CASCADE
    )
  `);
}

export async function down(db) {
  await db.execute('DROP TABLE IF EXISTS building_upgrades');
  await db.execute('DROP TABLE IF EXISTS base_buildings');
  await db.execute('DROP TABLE IF EXISTS party_bases');
}
