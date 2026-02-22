/**
 * Migration 007 — NPC Aging & Absence
 *
 * New column on npc_relationships: last_interaction_game_day (INTEGER)
 * Tracks the game day of last interaction for time-based decay calculations.
 * The existing last_interaction_date (ISO string) is kept for display purposes.
 *
 * Index for efficient absence queries.
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

  // Add last_interaction_game_day to npc_relationships
  await addColumn(
    'npc_relationships',
    'last_interaction_game_day',
    'ALTER TABLE npc_relationships ADD COLUMN last_interaction_game_day INTEGER'
  );

  // Index for efficient absence queries
  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_npc_rel_last_interaction_day
    ON npc_relationships(character_id, last_interaction_game_day)
  `);
}

export async function down(db) {
  // SQLite doesn't support DROP COLUMN. Column will remain but be unused.
  await db.execute('DROP INDEX IF EXISTS idx_npc_rel_last_interaction_day');
}
