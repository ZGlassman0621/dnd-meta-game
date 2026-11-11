/**
 * Migration 087: Cold exposure — Frost Exhaustion track + Wet/Soaked status.
 *
 * Frost Exhaustion is a SEPARATE track from standard 2024 exhaustion
 * (conditionService, active_conditions) — it is deliberately NOT a
 * condition key. One integer per actor, default 0, so existing rows
 * start unfrosted. Wet/Soaked is a small status string per actor,
 * default 'dry'; the depth-aware rule (ankle-deep = Wet, immersion =
 * Soaked) is the DM's call when setting it, not the migration's.
 *
 * Writes only through the runner's transaction (up(db) +
 * db.execute(...)), like migration 077. Never import dbAll/dbRun
 * from database.js inside a migration.
 */
export async function up(db) {
  const charInfo = await db.execute('PRAGMA table_info(characters)');
  const charCols = new Set(charInfo.rows.map(r => r.name));
  if (!charCols.has('frost_exhaustion')) {
    await db.execute('ALTER TABLE characters ADD COLUMN frost_exhaustion INTEGER DEFAULT 0');
  }
  if (!charCols.has('cold_wet_status')) {
    await db.execute("ALTER TABLE characters ADD COLUMN cold_wet_status TEXT DEFAULT 'dry'");
  }
  const compInfo = await db.execute('PRAGMA table_info(companions)');
  const compCols = new Set(compInfo.rows.map(r => r.name));
  if (!compCols.has('frost_exhaustion')) {
    await db.execute('ALTER TABLE companions ADD COLUMN frost_exhaustion INTEGER DEFAULT 0');
  }
  if (!compCols.has('cold_wet_status')) {
    await db.execute("ALTER TABLE companions ADD COLUMN cold_wet_status TEXT DEFAULT 'dry'");
  }
}

export async function down(db) {
  // SQLite can't drop columns without rebuilding the table. No-op,
  // like migration 083 — the columns are nullable/defaulted and harmless.
}
