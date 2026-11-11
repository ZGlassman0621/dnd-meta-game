// Migration 103: lair hazard auto-wiring state (2026-11-04).
//
// Auto-rolled hazards need one durable fact the lair row did not carry:
// a pending telegraph (a major/life-threatening hazard announced one
// round and striking on the next tick) and a benign precursor (a
// warning from one feature family that escalates the next hazard from
// that family). Both live in a single JSON column so a telegraph can
// never double-fire: striking clears it in the same step, and a
// telegraph is encounter-scoped (session + encounter_seq), so it can
// only strike on a tick for the encounter that created it — it lapses
// instead of striking into an empty room when the encounter ends,
// the lair collapses, or the lair is restored to full durability.

export async function up(db) {
  await db.execute(`ALTER TABLE lair_durability ADD COLUMN hazard_state_json TEXT`);
}

export async function down(db) {
  // SQLite cannot drop a column without a table rebuild; the column
  // is inert when unused, so a rollback leaves it in place (same
  // convention as other additive migrations in this repo).
}
