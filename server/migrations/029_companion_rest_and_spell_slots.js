/**
 * Migration 029: Companion Rest + Spell Slots (Phase 6)
 *
 * Mirrors the existing character-side spell-slot + hit-dice storage so
 * spellcasting companions (wizards, clerics, druids, warlocks, etc.) can
 * actually cast leveled spells, and all companions can take a long/short
 * rest that restores HP + spell slots just like a PC.
 *
 * New columns on `companions`:
 *  - companion_spell_slots: JSON {"1": 4, "2": 3, ...} — max slots per level
 *    (computed from class+level on demand; stored to allow edit-override)
 *  - companion_spell_slots_used: JSON {"1": 1, "2": 0, ...} — used count per
 *    level; cleared on long rest
 *  - companion_hit_dice: JSON {"d8": 3} — total hit-dice pool per die type
 *    (informational / matches the character-side `hit_dice` column)
 *
 * Non-casters keep these columns as NULL and the endpoints return an empty
 * shape for them.
 */

export async function up(db) {
  const cols = [
    { col: 'companion_spell_slots', sql: "ALTER TABLE companions ADD COLUMN companion_spell_slots TEXT DEFAULT NULL" },
    { col: 'companion_spell_slots_used', sql: "ALTER TABLE companions ADD COLUMN companion_spell_slots_used TEXT DEFAULT NULL" },
    { col: 'companion_hit_dice', sql: "ALTER TABLE companions ADD COLUMN companion_hit_dice TEXT DEFAULT NULL" }
  ];

  // PRAGMA table_info to check existing columns — this migration has to be
  // safe to run on a DB that already has some of the columns from an earlier
  // manual fix (unlikely but cheap insurance).
  const existing = await db.execute(`PRAGMA table_info(companions)`);
  const existingNames = new Set(existing.rows.map(r => r.name));

  for (const { col, sql } of cols) {
    if (!existingNames.has(col)) {
      await db.execute(sql);
    }
  }
}

export async function down(db) {
  // SQLite can't drop columns without rebuilding the table. Accept the
  // no-op; the columns are nullable and harmless if left behind.
}
