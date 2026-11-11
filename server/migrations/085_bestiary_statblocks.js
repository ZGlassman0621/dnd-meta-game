/**
 * Migration 085: Full bestiary statblocks (Step 1 — Bestiary expansion).
 *
 * The bestiary held 10 creatures described by six numbers (hp, ac, one
 * attack line, dex mod). The 2024 books carry full statblocks — ability
 * scores, real saving throws, resistances, traits, spellcasting — and the
 * engine needs them squirreled away in two places:
 *
 *   bestiary.statblock_json TEXT
 *     The full canonical entry for a creature, in the bestiaryData entry
 *     shape. The DB table is the custom/homebrew overlay (lookup checks
 *     the DB first, then the built-in data module — the lookupSpellFull
 *     pattern); legacy rows without JSON are shaped from their columns.
 *
 *   combat_enemies.stats_json TEXT
 *     A snapshot of the full block taken at COMBAT_START, so a live
 *     encounter never mutates when bestiary data is edited mid-campaign,
 *     and in-combat reads (spell saves, resistances) never re-join.
 */
export async function up(db) {
  const bestiary = await db.execute('PRAGMA table_info(bestiary)');
  const bestiaryNames = new Set(bestiary.rows.map(r => r.name));
  if (!bestiaryNames.has('statblock_json')) {
    await db.execute('ALTER TABLE bestiary ADD COLUMN statblock_json TEXT');
  }

  const enemies = await db.execute('PRAGMA table_info(combat_enemies)');
  const enemyNames = new Set(enemies.rows.map(r => r.name));
  if (!enemyNames.has('stats_json')) {
    await db.execute('ALTER TABLE combat_enemies ADD COLUMN stats_json TEXT');
  }
}

export async function down(db) {
  // SQLite can't drop columns without rebuilding the table. No-op.
}
