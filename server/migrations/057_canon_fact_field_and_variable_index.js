/**
 * Migration 057: canon_facts.field + variable-fact unique index
 *
 * RECONSTRUCTED from the live database schema (2026-08-10). See migration
 * 054's header for why these files had to be rebuilt.
 *
 * Adds `canon_facts.field` and a PARTIAL UNIQUE index that models
 * "variable" canon facts — facts whose value changes over time (a location's
 * ruler, an NPC's rank) as opposed to immutable historical ones.
 *
 * The index shape encodes the rule: for a given
 * (campaign, character, subject, category, field) there may be at most ONE
 * active row. Re-stating a variable fact is meant to supersede the previous
 * value rather than accumulate a contradictory pile of them.
 *
 * Both guards in the WHERE clause are load-bearing:
 *   - `is_active = 1` lets superseded history stay in the table. Without it,
 *     retiring a fact and restating it would collide.
 *   - `field IS NOT NULL` confines the constraint to variable facts. Every
 *     ordinary canon fact leaves `field` NULL, and SQL UNIQUE treats NULLs
 *     as distinct anyway — the explicit guard makes the intent readable and
 *     keeps the index small.
 *
 * No current code path writes `field` (it is NULL on every live row, of
 * which there are currently zero), so this constraint is inert today. It is
 * reproduced because the repo must build the schema the database actually
 * has — a fresh build that silently omitted this index would let duplicate
 * variable facts through the moment the feature is wired up.
 *
 * Idempotent: PRAGMA check for the column, IF NOT EXISTS for the index.
 */

export async function up(db) {
  const cols = await db.execute(`PRAGMA table_info(canon_facts)`);
  const hasColumn = cols.rows.some((c) => c.name === 'field');
  if (!hasColumn) {
    await db.execute(`ALTER TABLE canon_facts ADD COLUMN field TEXT`);
  }

  // Partial unique index — one active row per variable fact.
  await db.execute(`
    CREATE UNIQUE INDEX IF NOT EXISTS uq_canon_facts_variable
      ON canon_facts(campaign_id, character_id, subject, category, field)
      WHERE is_active = 1 AND field IS NOT NULL
  `);
}

export async function down(db) {
  await db.execute(`DROP INDEX IF EXISTS uq_canon_facts_variable`);
  // Column left in place — SQLite < 3.35 lacks portable DROP COLUMN.
}
