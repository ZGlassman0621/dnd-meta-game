/**
 * Migration 049: 'creating' phase + heirloom candidate table
 *
 * Phase 2 chunk 5.A. Lays the data model deltas the rebuilt main creator
 * needs (per PHASE_2_CREATOR_SPEC.md §8.1).
 *
 * Two changes:
 *
 * 1. `characters.creation_phase` enum gains `'creating'` (Decision 1 from the
 *    2026-05-02 spec authoring entry in DECISION_LOG.md). The column is
 *    `TEXT DEFAULT 'active'` with no CHECK constraint — the enum is project
 *    convention, not enforced at the DB layer — so this migration carries
 *    no DDL for the new value, only documentation. Final conceptual enum:
 *
 *      'active'              — post-creation, normal play (default)
 *      'creating'            — manual-mode mid-creator-flow (new in chunk 5)
 *      'ready_for_primary'   — Prelude-played, creator-unfinished (chunk 2)
 *
 *    Existing rows stay at 'active' — additive, no backfill.
 *
 * 2. New `prelude_canon_heirlooms` table per spec §8.1.2. Holds heirloom
 *    candidates carried from the Prelude into Step 6 (Equipment) of the main
 *    creator's handoff mode. Player picks one (or none); picked one flips to
 *    'carried_forward' and copies into the character's inventory at submit
 *    with `is_heirloom=true` plus `awakening_hook`. Unpicked candidates flip
 *    to 'left_behind' and are kept in the table for narrative reference.
 *
 *    Producer-side wiring is DEFERRED — no producer exists today (no
 *    `[OBJECT_HINT]` marker, no extraction pass). The table is created here
 *    so the consumer-side empty-state ships clean and a future scoped
 *    follow-up can populate it without a new migration. See PM parking lot
 *    in CONSOLIDATED_TODO.md and the producer-deferred annotations in
 *    PHASE_2_CREATOR_SPEC.md §8.1.2 + §5.6.3 and PRELUDE_IMPLEMENTATION_PLAN
 *    §5d for why the producer choice (marker / extraction / hybrid) is
 *    intentionally open.
 *
 * Manual-mode heirloom authoring does NOT pass through this table — it
 * writes directly to `characters.inventory` JSON at submit. Only Prelude-
 * derived candidates live here.
 */

export async function up(db) {
  // --- prelude_canon_heirlooms --------------------------------------------
  await db.execute(`
    CREATE TABLE IF NOT EXISTS prelude_canon_heirlooms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      character_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      specific_item_ref TEXT,
      description TEXT,
      awakening_hook TEXT,
      acquired_at_age INTEGER,
      acquired_at_chapter INTEGER,
      status TEXT NOT NULL DEFAULT 'candidate',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE
    )
  `);
  await db.execute(
    `CREATE INDEX IF NOT EXISTS idx_prelude_canon_heirlooms_char
       ON prelude_canon_heirlooms(character_id, status)`
  );

  // No DDL for `creation_phase` — column is unconstrained TEXT; the new
  // 'creating' value is application-level. This migration's presence is
  // the ledger entry that chunk 5 expects the value to be in use.
}

export async function down(db) {
  await db.execute(`DROP INDEX IF EXISTS idx_prelude_canon_heirlooms_char`);
  await db.execute(`DROP TABLE IF EXISTS prelude_canon_heirlooms`);
  // No-op for creation_phase — values are application-level. A rollback that
  // wanted to remove 'creating' rows would need a separate data migration.
}
