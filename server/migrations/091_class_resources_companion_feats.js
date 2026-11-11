/**
 * Migration 091: class resources + companion feats (combat item 2).
 *
 * class_resources_json on characters + companions holds the item-2
 * resource pool as JSON: { used: { rage, focus, bardic, secondWind,
 * actionSurge, channelDivinity, layOnHandsSpent, sorcery }, raging,
 * bardicHeld }. Maxima are computed from class/level at read time
 * (classFeatureService.resourceMaxima), never stored, so a level-up
 * cannot strand a stale max. NULL = no resources recorded yet.
 *
 * companion_feats on companions mirrors characters.feats (which
 * already exists since migration 001): companions had no feats
 * column, so combat feats could not be read for them at all.
 *
 * Writes only through the runner's transaction (up(db) +
 * db.execute(...)), like migration 090. Never import dbAll/dbRun
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

  await addColumn('characters', 'class_resources_json', 'TEXT');
  await addColumn('companions', 'class_resources_json', 'TEXT');
  await addColumn('companions', 'companion_feats', 'TEXT');
}

export async function down(db) {
  // SQLite can't drop columns without rebuilding the table. No-op,
  // like migration 090 — the columns are nullable and harmless.
}
