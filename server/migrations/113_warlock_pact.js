// Migration 113: warlock pact column (creator test-notes item 11).
//
// The 2024 Pact choice (Blade / Chain / Tome) is an L1 invocation, and
// the creator's Stage 2 picker needs somewhere to persist it. There is
// no pact column anywhere today and no invocation data in the app at
// all. The pact is a single choice per warlock — exactly like
// `subclass`, a plain column — not a per-tier feat (the side tables
// character_origin_feats / character_ancestry_feats hold feat picks
// with slots/tiers, the wrong shape for one class choice), and not a
// JSON blob (class_levels holds level counts, subclass_choices_json
// holds subclass subchoices; a pact hidden in either would be
// invisible to queries and to the row GET the creator resume reads).
//
// Why a column now, not a character_invocations side table: the full
// 28-invocation registry is a follow-up, and it will define its own
// schema (keys, prerequisites, levels). A premature table risks a
// wrong shape the follow-up must migrate. The follow-up reads
// characters.pact as the L1 invocation, or migrates one row per
// character — trivially portable either way.
//
// CHECK over the three 2024 pacts only (Talisman is 2014-only, never
// stored). NULL for non-warlocks and for warlocks who have not picked
// yet — a draft may legitimately hold no pact. No backfill: no pact
// data exists anywhere today.
//
// Follows the runner convention (up(db) + db.execute only, inside the
// runner's transaction — never import dbAll/dbRun here) and the 104 /
// 112 rollback convention (additive column stays in place on rollback).
export async function up(db) {
  await db.execute(`ALTER TABLE characters ADD COLUMN pact TEXT CHECK (pact IS NULL OR pact IN ('blade', 'chain', 'tome'))`);
}

export async function down(db) {
  // Additive column; inert when NULL, so a rollback leaves it in place
  // (same convention as other additive migrations in this repo).
}
