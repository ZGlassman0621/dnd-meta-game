// Migration 105: origin columns for the new character creator (2026-11-04).
//
// Stage 1 (Origin & Identity) stores where a character comes from as
// three durable facts, on characters AND npcs (the NPC creator fills
// origin in at creation per the same ruling; the npc route wiring is a
// follow-up — these columns are inert until then):
//   origin_setting      — e.g. 'Forgotten Realms', 'Eberron' (as-is,
//                          never reskinned)
//   origin_region       — free text, e.g. 'Sword Coast'
//   origin_explanation  — required when the setting is outside the
//                          Forgotten Realms: how they came to be here
//
// Follows the runner convention (up(db) + db.execute only, inside the
// runner's transaction — never import dbAll/dbRun here) and the 104
// rollback convention (additive columns stay in place on rollback).

export async function up(db) {
  await db.execute(`ALTER TABLE characters ADD COLUMN origin_setting TEXT`);
  await db.execute(`ALTER TABLE characters ADD COLUMN origin_region TEXT`);
  await db.execute(`ALTER TABLE characters ADD COLUMN origin_explanation TEXT`);
  await db.execute(`ALTER TABLE npcs ADD COLUMN origin_setting TEXT`);
  await db.execute(`ALTER TABLE npcs ADD COLUMN origin_region TEXT`);
  await db.execute(`ALTER TABLE npcs ADD COLUMN origin_explanation TEXT`);
}

export async function down(db) {
  // SQLite cannot drop a column without a table rebuild; the columns
  // are inert when unused, so a rollback leaves them in place (same
  // convention as other additive migrations in this repo).
}
