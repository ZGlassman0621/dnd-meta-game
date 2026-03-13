/**
 * Migration 021: NPC Codex Enrichment
 * Adds structured fields to dm_mode_npcs for better AI memory:
 * location, race, class_profession, age_description, personality, status, disposition, connections
 */

export async function up(db) {
  const columns = [
    { name: 'location', type: 'TEXT' },
    { name: 'race', type: 'TEXT' },
    { name: 'class_profession', type: 'TEXT' },
    { name: 'age_description', type: 'TEXT' },
    { name: 'personality', type: 'TEXT' },
    { name: 'status', type: "TEXT DEFAULT 'alive'" },
    { name: 'disposition', type: "TEXT DEFAULT 'neutral'" },
    { name: 'connections', type: 'TEXT' }
  ];

  for (const col of columns) {
    try {
      await db.execute(`ALTER TABLE dm_mode_npcs ADD COLUMN ${col.name} ${col.type}`);
    } catch (e) {
      if (!e.message?.includes('duplicate column')) throw e;
    }
  }
}

export async function down(db) {
  // SQLite doesn't support DROP COLUMN in older versions — recreate table
  await db.execute(`
    CREATE TABLE dm_mode_npcs_backup AS
    SELECT id, dm_mode_party_id, name, role, description, voice_notes,
           sessions_appeared, first_seen_session, last_seen_session,
           created_at, updated_at
    FROM dm_mode_npcs
  `);
  await db.execute('DROP TABLE dm_mode_npcs');
  await db.execute('ALTER TABLE dm_mode_npcs_backup RENAME TO dm_mode_npcs');
  await db.execute('CREATE INDEX IF NOT EXISTS idx_dm_mode_npcs_party ON dm_mode_npcs(dm_mode_party_id)');
}
