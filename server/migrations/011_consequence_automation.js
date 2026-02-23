/**
 * Migration 011: Consequence Automation
 *
 * Adds:
 * - consequence_log table for tracking automated consequences
 * - deadline_game_day column on quests for game-day-based deadlines
 */

export async function up(db) {
  // Consequence log — tracks all automated consequences that fire
  await db.execute(`
    CREATE TABLE IF NOT EXISTS consequence_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id INTEGER NOT NULL,
      character_id INTEGER NOT NULL,
      consequence_type TEXT NOT NULL,
      source_type TEXT NOT NULL,
      source_id TEXT,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      effects_applied TEXT,
      severity TEXT DEFAULT 'moderate',
      game_day INTEGER NOT NULL,
      delivered INTEGER DEFAULT 0,
      narrative_queue_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_consequence_log_character
    ON consequence_log(character_id)
  `);

  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_consequence_log_campaign
    ON consequence_log(campaign_id)
  `);

  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_consequence_log_delivered
    ON consequence_log(delivered)
  `);

  // Add game-day-based deadline to quests (more useful than ISO date for in-game time)
  try {
    await db.execute('ALTER TABLE quests ADD COLUMN deadline_game_day INTEGER');
  } catch (e) {
    if (!e.message?.includes('duplicate column')) throw e;
  }
}

export async function down(db) {
  await db.execute('DROP TABLE IF EXISTS consequence_log');
  // SQLite doesn't support DROP COLUMN easily, so we leave deadline_game_day
}
