// Migration 110: character size choice (2026-11-06, 2024 PHB p. 194).
//
// The 2024 human chooses Medium or Small when the species is
// selected; the choice is stored per character (size TEXT) so the
// DM prompt and later stages read the choice, not the species
// default. NULL means no choice recorded yet (draft / legacy row) —
// readers treat that as "no size claimed", never as a default.
// The column is species-agnostic: any future species with a `sizes`
// choice list in the registry uses the same column.
//
// Follows the runner convention (up(db) + db.execute only, inside
// the runner's transaction — never import dbAll/dbRun here) and the
// 105/108 rollback convention (additive columns stay in place).
export async function up(db) {
  await db.execute(`ALTER TABLE characters ADD COLUMN size TEXT`);
}

export async function down(db) {
  // Additive column; a rollback leaves it in place (same
  // convention as other additive migrations in this repo).
}
