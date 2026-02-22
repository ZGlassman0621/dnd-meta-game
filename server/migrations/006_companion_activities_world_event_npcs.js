/**
 * Migration 006 — Companion Activities & World Event NPC Effects
 *
 * New table: companion_activities — tracks what companions do while away
 * New columns on companions: dismissed_reason, away_activity_id
 * New column on world_events: affected_npcs
 * New column on narrative_queue: related_event_id
 */

export async function up(db) {
  const addColumn = async (table, col, sql) => {
    try {
      const columns = await db.execute(`PRAGMA table_info(${table})`);
      const exists = columns.rows.some(r => r[1] === col || r.name === col);
      if (!exists) {
        await db.execute(sql);
      }
    } catch (e) {
      // Column may already exist
    }
  };

  // ============================================================
  // COMPANION ACTIVITIES TABLE
  // ============================================================

  await db.execute(`
    CREATE TABLE IF NOT EXISTS companion_activities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      companion_id INTEGER NOT NULL,
      character_id INTEGER NOT NULL,
      campaign_id INTEGER,
      activity_type TEXT NOT NULL,
      description TEXT,
      location TEXT,
      objectives TEXT DEFAULT '[]',
      start_game_day INTEGER NOT NULL,
      expected_duration_days INTEGER NOT NULL,
      actual_end_game_day INTEGER,
      status TEXT DEFAULT 'in_progress',
      outcomes TEXT,
      reunion_narrative TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      resolved_at DATETIME,
      FOREIGN KEY (companion_id) REFERENCES companions(id),
      FOREIGN KEY (character_id) REFERENCES characters(id)
    )
  `);

  // Index for efficient queries
  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_companion_activities_status
    ON companion_activities(status, companion_id)
  `);

  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_companion_activities_campaign
    ON companion_activities(campaign_id, status)
  `);

  // ============================================================
  // COMPANION COLUMNS
  // ============================================================

  await addColumn('companions', 'dismissed_reason', 'ALTER TABLE companions ADD COLUMN dismissed_reason TEXT');
  await addColumn('companions', 'away_activity_id', 'ALTER TABLE companions ADD COLUMN away_activity_id INTEGER');

  // ============================================================
  // WORLD EVENT NPC EFFECTS COLUMN
  // ============================================================

  await addColumn('world_events', 'affected_npcs', "ALTER TABLE world_events ADD COLUMN affected_npcs TEXT DEFAULT '[]'");

  // ============================================================
  // NARRATIVE QUEUE EVENT LINK
  // ============================================================

  await addColumn('narrative_queue', 'related_event_id', 'ALTER TABLE narrative_queue ADD COLUMN related_event_id INTEGER');
}

export async function down(db) {
  await db.execute('DROP TABLE IF EXISTS companion_activities');
  // Note: SQLite doesn't support DROP COLUMN. New columns on companions,
  // world_events, and narrative_queue will remain but be unused.
}
