/**
 * Migration 048: Prelude → Primary handoff schema
 *
 * Phase 2 chunk 2. Three additions plus a column on `characters`:
 *
 * 1. `characters.prelude_handoff_payload` — JSON blob written by the
 *    transition service when [PRELUDE_END] fires. Holds the aggregated
 *    Prelude state the existing CharacterCreationWizard reads on resume:
 *    suggested name parts, suggested class/alignment/lifestyle, emerged
 *    personality sentences, physical-detail emergences, flattened
 *    biography text, etc. The actual columns this populates in the
 *    creator are documented in preludeTransitionService.js.
 *
 * 2. `character_biography` — appendable per-character biography entries.
 *    Phase 2 writes seed entries from the Prelude (entry_type =
 *    'seeded_from_prelude'); later phases will append narrative milestones
 *    during main-campaign play (placeholder enum values reserved). Each
 *    row has its in-fiction age + chapter/session origin and free-form
 *    body text. UI for the living biography is deferred to a later phase
 *    (per Decision A3); this migration only builds the schema + seeding
 *    target.
 *
 * 3. `mentor_imprints` — seeded at handoff when the player chose
 *    `authority_figure='mentor'` AND the Prelude established a
 *    [NPC_CANON: relationship='mentor'] row. The mentor relationship
 *    arrives at the main campaign with prior history rather than as a
 *    blank meet. Per PRELUDE_IMPLEMENTATION_PLAN rule #23 (the rule
 *    Phase 0 flagged as design-only-until-Phase-2 — this migration is
 *    the Phase-2 implementation that flag promised).
 *
 * `creation_phase` enum extension to include `'ready_for_primary'` is a
 * data convention, not a schema change — the column is TEXT and accepts
 * any string. The transition service flips `'prelude'` → `'ready_for_primary'`
 * and the existing creator's submit handler flips `'ready_for_primary'`
 * → `'active'`. CLAUDE.md will be updated separately to document the
 * three-state shape.
 */

export async function up(db) {
  // --- characters.prelude_handoff_payload ---------------------------------
  const info = await db.execute(`PRAGMA table_info(characters)`);
  const cols = new Set(info.rows.map(r => r.name));
  if (!cols.has('prelude_handoff_payload')) {
    await db.execute(`ALTER TABLE characters ADD COLUMN prelude_handoff_payload TEXT`);
  }

  // --- character_biography ------------------------------------------------
  await db.execute(`
    CREATE TABLE IF NOT EXISTS character_biography (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      character_id INTEGER NOT NULL,
      entry_type TEXT NOT NULL,
      origin_age INTEGER,
      origin_chapter INTEGER,
      origin_session_id INTEGER,
      body TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE
    )
  `);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_character_biography_char ON character_biography(character_id, id)`);

  // --- mentor_imprints ----------------------------------------------------
  // Seeded at Prelude handoff when authority_figure='mentor' and a
  // matching prelude_canon_npcs row exists. Main-campaign AI consults
  // mentor_imprints when generating mentor-NPC interactions in primary
  // campaign play, so the mentor arrives "with prior history."
  await db.execute(`
    CREATE TABLE IF NOT EXISTS mentor_imprints (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      character_id INTEGER NOT NULL,
      campaign_id INTEGER,
      source TEXT NOT NULL DEFAULT 'prelude',
      mentor_name TEXT NOT NULL,
      mentor_role TEXT,
      mentor_status TEXT DEFAULT 'alive',
      first_met_at_age INTEGER,
      relationship_summary TEXT,
      formative_beats TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE
    )
  `);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_mentor_imprints_char ON mentor_imprints(character_id)`);
}

export async function down(db) {
  await db.execute(`DROP TABLE IF EXISTS mentor_imprints`);
  await db.execute(`DROP TABLE IF EXISTS character_biography`);
  // SQLite pre-3.35 can't DROP COLUMN; leave the column in place per repo
  // convention (additive-only).
}
