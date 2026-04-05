/**
 * Migration 022: Prelude Sessions
 * Adds prelude_completed flag to characters and prelude_config to store setup form data.
 * session_type already supports arbitrary values ('player', 'dm_mode') — 'prelude' is added by convention.
 */

export async function up(db) {
  const columns = [
    { name: 'prelude_completed', type: 'INTEGER DEFAULT 0' },
    { name: 'prelude_config', type: 'TEXT' }
  ];

  for (const col of columns) {
    try {
      await db.execute(`ALTER TABLE characters ADD COLUMN ${col.name} ${col.type}`);
    } catch (e) {
      if (!e.message?.includes('duplicate column')) throw e;
    }
  }
}

export async function down(db) {
  // SQLite limitations — columns remain but are unused
}
