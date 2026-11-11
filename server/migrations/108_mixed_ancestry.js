// Migration 108: mixed-ancestry record on characters (2026-11-06).
//
// Mixed Ancestry (GM Binder homebrew, EmberBoar Creations) stores one
// structured record per character as JSON in mixed_ancestry_json:
//   { parents: [idA, idB], size, speed,
//     traits: [{ species, trait, cost, form? }],
//     budgetUsed, budgetCap, forgoOriginFeat, versatileFeat }
// The display species string derived from it is
// "Mixed Ancestry (Parent A / Parent B)" and lives in the characters
// race column (written by the character route, not by this migration).
//
// Follows the runner convention (up(db) + db.execute only, inside the
// runner's transaction — never import dbAll/dbRun here) and the 105
// rollback convention (additive columns stay in place on rollback).
export async function up(db) {
  await db.execute(`ALTER TABLE characters ADD COLUMN mixed_ancestry_json TEXT`);
}

export async function down(db) {
  // SQLite cannot drop a column without a table rebuild; the column
  // is inert when unused, so a rollback leaves it in place (same
  // convention as other additive migrations in this repo).
}
