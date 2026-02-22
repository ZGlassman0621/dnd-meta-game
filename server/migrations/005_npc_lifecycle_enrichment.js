/**
 * Migration 005 — NPC Lifecycle State Machine & Personality Enrichment
 *
 * New columns on npcs: lifecycle_status, death metadata, enrichment_level
 * New table: npc_lifecycle_history — audit trail for NPC status changes
 * Backfill: deceased companions get lifecycle_status = 'deceased' on their NPC record
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
  // NPC LIFECYCLE COLUMNS
  // ============================================================

  await addColumn('npcs', 'lifecycle_status', "ALTER TABLE npcs ADD COLUMN lifecycle_status TEXT DEFAULT 'alive'");
  await addColumn('npcs', 'death_cause', 'ALTER TABLE npcs ADD COLUMN death_cause TEXT');
  await addColumn('npcs', 'death_game_day', 'ALTER TABLE npcs ADD COLUMN death_game_day INTEGER');
  await addColumn('npcs', 'death_location', 'ALTER TABLE npcs ADD COLUMN death_location TEXT');
  await addColumn('npcs', 'death_killer', 'ALTER TABLE npcs ADD COLUMN death_killer TEXT');
  await addColumn('npcs', 'death_session_id', 'ALTER TABLE npcs ADD COLUMN death_session_id INTEGER');
  await addColumn('npcs', 'status_changed_at', 'ALTER TABLE npcs ADD COLUMN status_changed_at DATETIME');

  // ============================================================
  // NPC ENRICHMENT LEVEL
  // ============================================================

  await addColumn('npcs', 'enrichment_level', 'ALTER TABLE npcs ADD COLUMN enrichment_level INTEGER DEFAULT 0');

  // ============================================================
  // NPC LIFECYCLE HISTORY (audit trail)
  // ============================================================

  await db.execute(`
    CREATE TABLE IF NOT EXISTS npc_lifecycle_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      npc_id INTEGER NOT NULL,
      campaign_id INTEGER,
      old_status TEXT NOT NULL,
      new_status TEXT NOT NULL,
      cause TEXT,
      game_day INTEGER,
      session_id INTEGER,
      details TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (npc_id) REFERENCES npcs(id)
    )
  `);

  try {
    await db.execute('CREATE INDEX IF NOT EXISTS idx_npc_lifecycle_npc ON npc_lifecycle_history(npc_id)');
    await db.execute('CREATE INDEX IF NOT EXISTS idx_npc_lifecycle_campaign ON npc_lifecycle_history(campaign_id)');
  } catch (e) { /* indexes may already exist */ }

  // ============================================================
  // BACKFILL: Mark NPCs of deceased companions as deceased
  // ============================================================

  try {
    await db.execute(`
      UPDATE npcs SET lifecycle_status = 'deceased', status_changed_at = CURRENT_TIMESTAMP
      WHERE lifecycle_status = 'alive'
        AND id IN (SELECT npc_id FROM companions WHERE status = 'deceased')
    `);
  } catch (e) {
    console.warn('Could not backfill deceased companion NPCs:', e.message);
  }
}

export async function down(db) {
  await db.execute('DROP TABLE IF EXISTS npc_lifecycle_history');
  // Note: SQLite doesn't support DROP COLUMN — lifecycle/enrichment columns will remain
}
