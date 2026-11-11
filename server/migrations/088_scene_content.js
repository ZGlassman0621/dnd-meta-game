/**
 * Migration 088: Scene content (Dungeon generation + scene layer, Phase B).
 *
 * Phase A (086) created the scene tables with geometry-free rooms:
 * no dimensions, ceiling or light, and no place for room traps,
 * treasure or connection traps. Phase B fills those gaps so the DM
 * digest can meet the room description contract (N2/N3) and stored
 * rooms carry their assigned content:
 *   scenes: era (the siteEra that filtered treasure: sealed/active/mixed)
 *   scene_rooms: width_ft, length_ft, ceiling_ft, light_level,
 *     traps_json, treasure_json
 *   scene_connections: trap_json (a trapped connection's trap detail;
 *     the trapped flag alone cannot carry DCs or damage)
 *
 * Writes only through the runner's transaction (up(db) +
 * db.execute(...)), like migration 087. Never import dbAll/dbRun
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

  await addColumn('scenes', 'era', "TEXT DEFAULT 'sealed'");
  await addColumn('scene_rooms', 'width_ft', 'INTEGER');
  await addColumn('scene_rooms', 'length_ft', 'INTEGER');
  await addColumn('scene_rooms', 'ceiling_ft', 'INTEGER');
  await addColumn('scene_rooms', 'light_level', "TEXT DEFAULT 'dark'");
  await addColumn('scene_rooms', 'traps_json', "TEXT DEFAULT '[]'");
  await addColumn('scene_rooms', 'treasure_json', 'TEXT');
  await addColumn('scene_connections', 'trap_json', 'TEXT');
}

export async function down(db) {
  // SQLite can't drop columns without rebuilding the table. No-op,
  // like migration 087 — the columns are nullable/defaulted and harmless.
}
