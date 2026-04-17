/**
 * Migration 027: Downtime v3 Schema
 *
 * Creates the between-sessions downtime system tables:
 * - downtime_periods: a span of in-game days between sessions
 * - downtime_activities: per-character activity assignments within a period
 * - downtime_outcomes: resolved results narrated as vignettes at next session start
 *
 * Integration: downtime_periods advance the game clock (characters.game_day) atomically
 * on completion. The AI DM system prompt is fed a hard time statement + activity
 * summary + vignette instructions at the next session's start.
 */

export async function up(db) {
  // A downtime period — a block of in-game days between sessions
  await db.execute(`
    CREATE TABLE IF NOT EXISTS downtime_periods (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id INTEGER,
      primary_character_id INTEGER NOT NULL,
      start_game_day INTEGER NOT NULL,
      end_game_day INTEGER NOT NULL,
      duration_days INTEGER NOT NULL,
      setting_location TEXT,
      lifestyle TEXT DEFAULT 'modest',
      status TEXT DEFAULT 'planning',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      resolved_at TEXT,
      FOREIGN KEY (primary_character_id) REFERENCES characters(id) ON DELETE CASCADE,
      CHECK(status IN ('planning', 'active', 'resolved', 'cancelled')),
      CHECK(lifestyle IN ('squalid', 'poor', 'modest', 'comfortable', 'wealthy', 'aristocratic'))
    )
  `);

  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_downtime_periods_char
    ON downtime_periods(primary_character_id)
  `);

  // Per-character activity assignments within a downtime period
  await db.execute(`
    CREATE TABLE IF NOT EXISTS downtime_activities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      downtime_period_id INTEGER NOT NULL,
      character_id INTEGER NOT NULL,
      partner_character_id INTEGER,
      slot TEXT NOT NULL,
      activity_type TEXT NOT NULL,
      activity_category TEXT,
      days_committed INTEGER,
      parameters TEXT,
      outcome_status TEXT DEFAULT 'pending',
      outcome_data TEXT,
      outcome_summary TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      resolved_at TEXT,
      FOREIGN KEY (downtime_period_id) REFERENCES downtime_periods(id) ON DELETE CASCADE,
      FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE,
      FOREIGN KEY (partner_character_id) REFERENCES characters(id) ON DELETE SET NULL,
      CHECK(slot IN ('main', 'background_1', 'background_2')),
      CHECK(outcome_status IN ('pending', 'success', 'partial', 'failure', 'cancelled'))
    )
  `);

  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_downtime_activities_period
    ON downtime_activities(downtime_period_id)
  `);

  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_downtime_activities_char
    ON downtime_activities(character_id)
  `);

  // Vignette outcomes — what the AI DM narrates at next session start
  await db.execute(`
    CREATE TABLE IF NOT EXISTS downtime_vignettes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      downtime_period_id INTEGER NOT NULL,
      sequence_order INTEGER NOT NULL,
      headline TEXT,
      related_character_id INTEGER,
      related_activity_ids TEXT,
      vignette_prompt TEXT,
      vignette_narrative TEXT,
      delivered INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (downtime_period_id) REFERENCES downtime_periods(id) ON DELETE CASCADE,
      FOREIGN KEY (related_character_id) REFERENCES characters(id) ON DELETE SET NULL
    )
  `);

  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_downtime_vignettes_period
    ON downtime_vignettes(downtime_period_id)
  `);
}

export async function down(db) {
  await db.execute('DROP TABLE IF EXISTS downtime_vignettes');
  await db.execute('DROP TABLE IF EXISTS downtime_activities');
  await db.execute('DROP TABLE IF EXISTS downtime_periods');
}
