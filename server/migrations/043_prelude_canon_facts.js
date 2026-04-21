/**
 * Migration 043: Prelude canon facts
 *
 * Adds `prelude_canon_facts` — a per-character ledger of canonical facts
 * the AI has established during prelude play. Ported pattern from the main
 * DM's `canon_facts` concept. Prevents context drift by giving Sonnet a
 * ground-truth block in every prompt it can check against before generating.
 *
 * Facts are additive — Sonnet emits `[CANON_FACT: subject="..." category="..."
 * fact="..."]` when establishing a new canonical detail, and the server
 * stores it. Facts can be retired (marked inactive) via `[CANON_FACT_RETIRE:
 * subject="..." fact_contains="..."]` when they're no longer true
 * (typically after AGE_ADVANCE replaces an age, or a character dies).
 *
 * Categories:
 *   npc           — named characters in the PC's life
 *   location      — places that matter (beyond what's in prelude_canon_locations)
 *   event         — things that happened with narrative weight
 *   relationship  — who knows whom and how
 *   trait         — traits of the PC or an NPC ("left-handed", "scarred at 7")
 *   item          — significant objects (a parent's medallion, a locket, etc.)
 *
 * The existing `prelude_canon_npcs` and `prelude_canon_locations` tables
 * from migration 042 stay — they're for the transition-to-primary-campaign
 * seeding work in Phase 5. This new table is the RUNNING LEDGER used during
 * play. There's some overlap (an NPC lives in both), but they're written for
 * different consumers and at different times.
 */

export async function up(db) {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS prelude_canon_facts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      character_id INTEGER NOT NULL,
      category TEXT NOT NULL,
      subject TEXT NOT NULL,
      fact TEXT NOT NULL,
      established_age INTEGER,
      session_id INTEGER,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      retired_at TEXT,
      FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE
    )
  `);

  // Fast retrieval of active facts by character, grouped by category.
  await db.execute(
    `CREATE INDEX IF NOT EXISTS idx_prelude_canon_facts_char_status
     ON prelude_canon_facts(character_id, status, category)`
  );

  // Dedup support — same (character, subject, fact) shouldn't be inserted twice.
  await db.execute(
    `CREATE UNIQUE INDEX IF NOT EXISTS uq_prelude_canon_facts_dedup
     ON prelude_canon_facts(character_id, category, subject, fact)
     WHERE status = 'active'`
  );
}

export async function down(db) {
  await db.execute(`DROP TABLE IF EXISTS prelude_canon_facts`);
}
