/**
 * Migration 090: Mastered weapons (combat item 1).
 *
 * Per-weapon Weapon Mastery picks, tracked on the character and the
 * companion (Zach, 2026-10-29: picks matter — a mastery weapon works
 * only if it is on that character's mastered list). NULL = no list
 * recorded yet; an empty list = nothing mastered. The attack path
 * treats both as no mastery — the old any-weapon approximation is
 * gone, not grandfathered. Count limits per class/level are NOT
 * enforced here (the verified 2024 counts were not checked in this
 * pass); the list itself is the gate.
 *
 * Writes only through the runner's transaction (up(db) +
 * db.execute(...)), like migration 088. Never import dbAll/dbRun
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

  await addColumn('characters', 'mastered_weapons', 'TEXT');
  await addColumn('companions', 'mastered_weapons', 'TEXT');
}

export async function down(db) {
  // SQLite can't drop columns without rebuilding the table. No-op,
  // like migration 088 — the columns are nullable and harmless.
}
