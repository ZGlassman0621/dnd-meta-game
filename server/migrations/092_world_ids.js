/**
 * Migration 092: world IDs (combat item 3, Tier 0).
 *
 * Every persistent being gets one permanent, cross-table identity:
 * `world_id` on npcs + characters, formatted ID0000001, ID0000002, ...
 * Per-table AUTOINCREMENT ids collide across tables (npc #42 is not
 * character #42), so a single shared counter owns the sequence.
 *
 * - world_id_counter holds exactly one row (id = 1, next_value).
 *   Runtime allocation is a compare-and-swap loop in worldIdService
 *   (read next_value, UPDATE ... WHERE next_value = old, retry on
 *   zero changes), so two concurrent allocations can never share a
 *   number even though routes issue one statement at a time.
 * - Backfill, in the same transaction: characters first in id order
 *   (the PC takes ID0000001 when a character row exists), then npcs
 *   in id order. Rows that already carry a world_id are left alone
 *   and numbering continues past the largest existing suffix, so the
 *   backfill is safe to reason about even though the runner applies
 *   each migration exactly once.
 * - IDs are never reused: nothing here deletes or reassigns one, and
 *   the UNIQUE indexes below only forbid duplicates, never recycle.
 *   world_id stays NULLABLE so pre-existing direct inserts (seeds,
 *   tests) cannot fail on a missing value; worldIdService.ensure
 *   repairs such rows on first combat load.
 *
 * Writes only through the runner's transaction (up(db) +
 * db.execute(...)), like migration 091. Never import dbAll/dbRun
 * from database.js inside a migration.
 */
export async function up(db) {
  async function addColumn(table, column, ddl) {
    const info = await db.execute(`PRAGMA table_info(${table})`);
    const cols = new Set(info.rows.map(r => r.name));
    if (!cols.has(column)) {
      await db.execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddl}`);
    }
  }

  await addColumn('npcs', 'world_id', 'TEXT');
  await addColumn('characters', 'world_id', 'TEXT');

  await db.execute(`CREATE UNIQUE INDEX IF NOT EXISTS idx_npcs_world_id ON npcs(world_id)`);
  await db.execute(`CREATE UNIQUE INDEX IF NOT EXISTS idx_characters_world_id ON characters(world_id)`);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS world_id_counter (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      next_value INTEGER NOT NULL
    )
  `);

  const parseSuffix = (wid) => {
    const m = /^ID(\d+)$/.exec(String(wid || ''));
    return m ? Number(m[1]) : null;
  };

  // Largest already-assigned suffix, so numbering continues past it.
  let next = 1;
  for (const table of ['characters', 'npcs']) {
    const existing = await db.execute(`SELECT world_id FROM ${table} WHERE world_id IS NOT NULL`);
    for (const row of existing.rows) {
      const n = parseSuffix(row.world_id);
      if (n != null && n >= next) next = n + 1;
    }
  }

  // Backfill: characters first (PC takes the first number), then npcs,
  // each in id order. Only NULL rows are touched.
  for (const table of ['characters', 'npcs']) {
    const rows = await db.execute(`SELECT id FROM ${table} WHERE world_id IS NULL ORDER BY id`);
    for (const row of rows.rows) {
      const wid = `ID${String(next).padStart(7, '0')}`;
      await db.execute({
        sql: `UPDATE ${table} SET world_id = ? WHERE id = ? AND world_id IS NULL`,
        args: [wid, row.id],
      });
      next += 1;
    }
  }

  await db.execute({
    sql: 'INSERT OR IGNORE INTO world_id_counter (id, next_value) VALUES (1, ?)',
    args: [next],
  });
  // If the counter row already existed (defensive; the runner applies
  // this migration once), advance it past anything just assigned.
  await db.execute({
    sql: 'UPDATE world_id_counter SET next_value = ? WHERE id = 1 AND next_value < ?',
    args: [next, next],
  });
}

export async function down(db) {
  // No-op: columns are additive and world IDs, once assigned, are
  // never reused — dropping them would orphan every reference.
}
