/**
 * Migration 057 — Canon facts behave like overwritable variables (field-aware supersede).
 *
 * Phase 1 of the "canon facts as variables" work. A variable is keyed by
 * (subject, category, field) — unrelated attributes about the same subject are
 * DISTINCT variables. When two writes collide on that key, the NEWEST wins and
 * the older row is retired (is_active=0). To make that invariant enforceable at
 * the storage layer (and to backstop the service-level supersede in
 * storyChronicleService.recordCanonFact), we:
 *
 *   1. Add a nullable `field` column to canon_facts. Existing free-form facts
 *      leave it NULL and stay completely UNCONSTRAINED — only explicit variables
 *      carry a non-null field.
 *   2. Add a PARTIAL unique index over (campaign_id, character_id, subject,
 *      category, field) for active rows WHERE field IS NOT NULL. The
 *      "field IS NOT NULL" predicate is REQUIRED: without it every legacy
 *      field-null fact would collide, breaking history (event/lore/player_choice
 *      are append-only) and the multi-fact-per-subject behavior the read side
 *      relies on.
 *
 * There are NO old saves (canon_facts is empty), so the uniqueness guarantee is
 * added directly with no data backfill. Mirrors migrations 054/056: PRAGMA
 * existence check, defensive try/catch that never wedges boot, no-op down().
 */

export async function up(db) {
  try {
    const columns = await db.execute('PRAGMA table_info(canon_facts)');
    const exists = columns.rows.some(r => r[1] === 'field' || r.name === 'field');
    if (!exists) {
      await db.execute('ALTER TABLE canon_facts ADD COLUMN field TEXT');
    }
  } catch (e) {
    // Defensive: a concurrent add or pre-existing column shouldn't fail startup.
    console.warn('Migration 057 (canon_facts.field) note:', e.message);
  }

  try {
    // One active value per variable key. Partial: only explicit variables
    // (field IS NOT NULL) are constrained; free-form facts (field NULL) stay
    // unconstrained so history / multi-fact-per-subject keep working.
    await db.execute(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_canon_facts_variable
        ON canon_facts(campaign_id, character_id, subject, category, field)
        WHERE is_active = 1 AND field IS NOT NULL
    `);
  } catch (e) {
    // Defensive: never wedge startup over an index create.
    console.warn('Migration 057 (uq_canon_facts_variable) note:', e.message);
  }
}

export async function down() {
  // No-op on purpose. SQLite has no clean DROP COLUMN; leaving the `field`
  // column and the partial unique index in place is the safe rollback behavior
  // (they are inert for legacy field-null facts).
}
