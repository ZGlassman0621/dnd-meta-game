/**
 * Migration 042: Prelude scaffolding
 *
 * Phase 1 of the Prelude-Forward Character Creator (see
 * PRELUDE_IMPLEMENTATION_PLAN.md). Adds the data model needed to create a
 * prelude-phase character and persist the setup answers. Later phases will
 * add arc-plan generation, emergence tracking, gameplay loop, and transition.
 *
 * Changes:
 *   `characters` gets 4 new columns:
 *     creation_phase        'prelude' | 'ready_for_primary' | 'active'
 *                           existing rows default to 'active'
 *     prelude_age           INTEGER — in-fiction age during prelude play
 *     prelude_chapter       INTEGER 1-4 — tracks chapter boundary crossings
 *     prelude_setup_data    TEXT (JSON) — the 12-question setup blob
 *
 *   5 new tables:
 *     prelude_emergences       Per-character record of every stat/skill/class/
 *                              theme/ancestry/value hint offered by the AI,
 *                              and whether the player accepted it.
 *     prelude_values           Rolling tally of emergent values.
 *     prelude_canon_npcs       NPCs that emerged in the prelude and should
 *                              persist into the primary campaign.
 *     prelude_canon_locations  Locations (home village, landmarks) that
 *                              emerged in the prelude and carry forward.
 *     prelude_arc_plans        Opus-generated structured arc plan (Phase 2
 *                              fills this in, but the table ships now to
 *                              keep migration numbering sane).
 *
 * Nothing in this migration affects existing data — character rows created
 * before Phase 1 default to creation_phase='active' and are unaffected by
 * the prelude system.
 */

export async function up(db) {
  // --- characters columns --------------------------------------------------
  const info = await db.execute(`PRAGMA table_info(characters)`);
  const cols = new Set(info.rows.map(r => r.name));

  if (!cols.has('creation_phase')) {
    await db.execute(`ALTER TABLE characters ADD COLUMN creation_phase TEXT DEFAULT 'active'`);
  }
  if (!cols.has('prelude_age')) {
    await db.execute(`ALTER TABLE characters ADD COLUMN prelude_age INTEGER`);
  }
  if (!cols.has('prelude_chapter')) {
    await db.execute(`ALTER TABLE characters ADD COLUMN prelude_chapter INTEGER`);
  }
  if (!cols.has('prelude_setup_data')) {
    await db.execute(`ALTER TABLE characters ADD COLUMN prelude_setup_data TEXT`);
  }

  // --- prelude_emergences --------------------------------------------------
  await db.execute(`
    CREATE TABLE IF NOT EXISTS prelude_emergences (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      character_id INTEGER NOT NULL,
      kind TEXT NOT NULL,
      target TEXT NOT NULL,
      magnitude INTEGER DEFAULT 1,
      reason TEXT,
      game_age INTEGER,
      chapter INTEGER,
      session_id INTEGER,
      offered_at_message_index INTEGER,
      status TEXT NOT NULL DEFAULT 'offered',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE
    )
  `);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_prelude_emergences_char ON prelude_emergences(character_id)`);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_prelude_emergences_kind ON prelude_emergences(character_id, kind, status)`);

  // --- prelude_values ------------------------------------------------------
  await db.execute(`
    CREATE TABLE IF NOT EXISTS prelude_values (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      character_id INTEGER NOT NULL,
      value TEXT NOT NULL,
      score INTEGER NOT NULL DEFAULT 0,
      last_changed_age INTEGER,
      last_changed_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE,
      UNIQUE (character_id, value)
    )
  `);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_prelude_values_char ON prelude_values(character_id)`);

  // --- prelude_canon_npcs --------------------------------------------------
  await db.execute(`
    CREATE TABLE IF NOT EXISTS prelude_canon_npcs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      character_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      relationship TEXT,
      age_at_prelude_end INTEGER,
      description TEXT,
      status TEXT DEFAULT 'alive',
      first_appeared_age INTEGER,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE
    )
  `);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_prelude_canon_npcs_char ON prelude_canon_npcs(character_id)`);

  // --- prelude_canon_locations --------------------------------------------
  await db.execute(`
    CREATE TABLE IF NOT EXISTS prelude_canon_locations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      character_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      type TEXT,
      description TEXT,
      is_home INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE
    )
  `);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_prelude_canon_locations_char ON prelude_canon_locations(character_id)`);

  // --- prelude_arc_plans --------------------------------------------------
  // Scaffolding only — Phase 2 populates these via preludeArcService.js.
  await db.execute(`
    CREATE TABLE IF NOT EXISTS prelude_arc_plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      character_id INTEGER NOT NULL UNIQUE,
      generated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      model TEXT,
      tone_tags TEXT,
      home_world TEXT,
      chapter_1_arc TEXT,
      chapter_2_arc TEXT,
      chapter_3_arc TEXT,
      chapter_4_arc TEXT,
      recurring_threads TEXT,
      character_trajectory TEXT,
      seed_emergences TEXT,
      departure_seed TEXT,
      regenerate_count INTEGER DEFAULT 0,
      FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE
    )
  `);
}

export async function down(db) {
  // Leaves the new columns on `characters` in place — ALTER TABLE DROP COLUMN
  // requires SQLite 3.35+ and these columns are harmless if unused.
  await db.execute(`DROP TABLE IF EXISTS prelude_arc_plans`);
  await db.execute(`DROP TABLE IF EXISTS prelude_canon_locations`);
  await db.execute(`DROP TABLE IF EXISTS prelude_canon_npcs`);
  await db.execute(`DROP TABLE IF EXISTS prelude_values`);
  await db.execute(`DROP TABLE IF EXISTS prelude_emergences`);
}
