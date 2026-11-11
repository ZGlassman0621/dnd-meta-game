/**
 * Migration 103: subclass choices storage (Batch 1, 2026-11-03).
 *
 * Tier 0 deferred a generic choices column to the first batch
 * with a non-feat choice. Batch 1 is that batch: Battle Master
 * maneuvers (a list, not a feat) and Wild Heart animal (not a
 * feat) cannot live in the existing feats / companion_feats
 * lists without corrupting feat-effect reads, so they get a
 * dedicated JSON column. Stored shape, per subclassService
 * parseSubclassChoices: { choiceKey: value | [values], ... },
 * e.g. { battle_master_maneuvers: ["Precision Attack", "Riposte"],
 *        wild_heart_animal: "Bear" }.
 *
 * Additive columns only, nullable TEXT, no backfill: existing
 * rows simply have no stored choices until one is chosen, and a
 * subclass with no stored choice is incomplete, never defaulted.
 */
export async function up(db) {
  await db.execute(`ALTER TABLE characters ADD COLUMN subclass_choices_json TEXT`);
  await db.execute(`ALTER TABLE companions ADD COLUMN subclass_choices_json TEXT`);
}

export async function down(db) {
  // SQLite cannot drop a column without a table rebuild; the columns
  // are inert when unused, so a rollback leaves them in place (same
  // convention as other additive migrations in this repo).
}
