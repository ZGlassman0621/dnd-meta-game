// Migration 111: wizard spellbook state (2026-11-07).
//
// The book itself lives in the existing `known_spells` column
// (the sheet already treats it as the book), so the only new
// storage is one JSON column for the state that has no home:
//   spellbook_json TEXT DEFAULT '{}'
//   { status: 'intact' | 'lost', mastery: [names], signature: [names] }
//   - status tracks the physical book (lost via discard/steal/
//     destroy; prepared changes are refused while 'lost').
//   - mastery / signature hold the Spell Mastery (L18) and
//     Signature Spells (L20) always-prepared picks, which the
//     wizard validator excludes from the prepared cap.
//
// Additive column, nullable TEXT, no backfill: existing rows read
// as '{}' (intact, no picks) until a pick is stored, and a wizard
// with no stored state is intact, never defaulted to lost.
//
// Follows the runner convention (up(db) + db.execute only, inside
// the runner's transaction — never import dbAll/dbRun here) and the
// 103/110 rollback convention (additive columns stay in place).
export async function up(db) {
  await db.execute(`ALTER TABLE characters ADD COLUMN spellbook_json TEXT DEFAULT '{}'`);
}

export async function down(db) {
  // Additive column; a rollback leaves it in place (same
  // convention as other additive migrations in this repo).
}
