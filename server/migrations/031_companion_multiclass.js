/**
 * Migration 031: Companion Multiclass (Phase 10)
 *
 * Mirrors the `class_levels` JSON column on `characters` for companions.
 * Previously a companion had a single `companion_class` + `companion_level`
 * + `companion_subclass`, which meant a Wizard 3 / Cleric 2 companion was
 * impossible. The new column stores the full per-class breakdown.
 *
 * Column:
 *   companion_class_levels TEXT  DEFAULT NULL
 *     JSON array of { class, level, subclass } per class the companion
 *     has levels in. Null for pre-Phase-10 recruits — readers should
 *     fall back to the legacy single-class columns in that case.
 *
 * The legacy columns (companion_class / companion_level /
 * companion_subclass) remain populated to reflect the PRIMARY class
 * (the first entry in class_levels, which is the class the companion
 * was recruited in). UI that hasn't been updated to show multiclass
 * keeps working and just shows the primary class.
 */

export async function up(db) {
  const existing = await db.execute(`PRAGMA table_info(companions)`);
  const existingNames = new Set(existing.rows.map(r => r.name));
  if (!existingNames.has('companion_class_levels')) {
    await db.execute(
      "ALTER TABLE companions ADD COLUMN companion_class_levels TEXT DEFAULT NULL"
    );
  }
}

export async function down(db) {
  // SQLite can't drop columns without rebuilding the table. No-op.
}
