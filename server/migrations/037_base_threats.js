/**
 * Migration 037: Base Threats (F3 — raids & sieges)
 *
 * When the world turns hostile — bandits in a border region, a war front
 * pushing close, an undead uprising — bases get attacked. This table tracks
 * each attack from first warning through to outcome, letting the player
 * choose to ride back and defend or accept auto-resolution at the deadline.
 *
 * Status state machine:
 *   approaching → defending   (player engaged the defense flow)
 *   approaching → resolving   (deadline hit, auto-resolve triggered)
 *   defending   → resolved    (DM session produced an outcome)
 *   resolving   → resolved    (auto-resolver wrote an outcome)
 *   resolved    (terminal)
 *
 * Outcomes (recorded on resolve):
 *   repelled    — defenders won; base unharmed or minor damage
 *   damaged     — base held but took significant damage; buildings
 *                 flip to `damaged` status, treasury may be looted
 *   captured    — attackers took the base; 14-day recapture window begins
 *   abandoned   — captured + recapture window expired; base is lost
 *
 * Attacker categories map loosely to notoriety categories for narrative
 * attribution (criminal/political/arcane/religious/military).
 */

export async function up(db) {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS base_threats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      base_id INTEGER NOT NULL,
      campaign_id INTEGER NOT NULL,
      threat_type TEXT NOT NULL DEFAULT 'raid'
        CHECK(threat_type IN ('raid','siege')),
      status TEXT NOT NULL DEFAULT 'approaching'
        CHECK(status IN ('approaching','defending','resolving','resolved')),
      attacker_source TEXT NOT NULL,         -- "Blackfen Bandits", "Lich King's Horde"
      attacker_category TEXT NOT NULL,       -- criminal | political | arcane | religious | military
      attacker_force INTEGER NOT NULL,       -- compared to defense_rating
      source_event_id INTEGER,               -- world_events.id that spawned this, nullable
      warning_game_day INTEGER NOT NULL,
      deadline_game_day INTEGER NOT NULL,
      outcome_game_day INTEGER,
      outcome TEXT
        CHECK(outcome IS NULL OR outcome IN ('repelled','damaged','captured','abandoned')),
      player_defended INTEGER NOT NULL DEFAULT 0,
      damage_report TEXT,                    -- JSON: { buildings_damaged:[], treasury_lost:N, garrison_lost:N }
      narrative TEXT,                        -- short generated flavor string
      recapture_deadline_game_day INTEGER,   -- when a 'captured' status auto-flips to 'abandoned'
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (base_id) REFERENCES party_bases(id) ON DELETE CASCADE,
      FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
    )
  `);
  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_base_threats_base
    ON base_threats(base_id, status)
  `);
  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_base_threats_deadline
    ON base_threats(status, deadline_game_day)
  `);
  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_base_threats_campaign_active
    ON base_threats(campaign_id, status)
  `);
}

export async function down(db) {
  await db.execute('DROP INDEX IF EXISTS idx_base_threats_campaign_active');
  await db.execute('DROP INDEX IF EXISTS idx_base_threats_deadline');
  await db.execute('DROP INDEX IF EXISTS idx_base_threats_base');
  await db.execute('DROP TABLE IF EXISTS base_threats');
}
