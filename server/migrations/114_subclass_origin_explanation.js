// Migration 114: subclass origin explanation (creation-solidification
// item 5, 2026-11-12).
//
// subclassService.validateSelection requires an origin explanation for
// a subclass from outside the Forgotten Realms (plan section 12,
// outside-FR ruling) — how its holder came to be in the Realms. The
// creator never collected one, so validateSelection could not be wired
// into the commit path without refusing every outside-FR subclass with
// no way to satisfy it. This is that field.
//
// A plain TEXT column on characters, like `pact` (113) and `subclass`:
// one value per character, read by the commit validator and the row GET
// the creator resume reads. It is NOT characters.origin_explanation —
// that one explains how the CHARACTER (an outside-FR origin setting)
// came to the Realms; this one explains the SUBCLASS's tradition.
// NULL for FR subclasses, for characters with no subclass yet, and for
// every existing row (no backfill: no such data exists anywhere).
//
// Runner convention: up(db) + db.execute only, inside the runner's
// transaction — never import dbAll/dbRun here. Additive column stays in
// place on rollback (same convention as 104 / 112 / 113).
export async function up(db) {
  await db.execute('ALTER TABLE characters ADD COLUMN subclass_origin_explanation TEXT');
}

export async function down(db) {
  // Additive column; inert when NULL, so a rollback leaves it in place.
}
