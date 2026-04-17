/**
 * Migration 026: Narrative Trackers Schema
 *
 * Creates tables for long-term narrative tracking systems:
 * - mythic_arcs: per-character atonement/corruption act counters for Redemption
 *   and Corrupted Dawn Shadow Paths, plus dissonant amplification arcs
 * - mentor_imprints: per-character Mentor's Imprint state (declared mentor,
 *   session count accumulated, imprint granted status)
 * - prelude_unlock_flags: tracks the early-Expertise-Die benefit for characters
 *   who completed a prelude session (d4 at L5 instead of L11)
 */

export async function up(db) {
  // Mythic arc tracker — atonement/corruption acts for Shadow Paths and Dissonant combos
  await db.execute(`
    CREATE TABLE IF NOT EXISTS mythic_arcs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      character_id INTEGER NOT NULL,
      arc_type TEXT NOT NULL,
      mythic_path TEXT,
      theme_id TEXT,
      atonement_acts INTEGER DEFAULT 0,
      corruption_acts INTEGER DEFAULT 0,
      milestones_reached TEXT,
      arc_events TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE,
      CHECK(arc_type IN ('redemption', 'corrupted_dawn', 'dissonant_amplification'))
    )
  `);

  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_mythic_arcs_char
    ON mythic_arcs(character_id)
  `);

  // Mentor's Imprint tracker
  await db.execute(`
    CREATE TABLE IF NOT EXISTS mentor_imprints (
      character_id INTEGER PRIMARY KEY,
      mentor_npc_id INTEGER,
      mentor_companion_id INTEGER,
      mentor_name TEXT,
      declared_at_game_day INTEGER,
      session_count INTEGER DEFAULT 0,
      affinity_score INTEGER DEFAULT 0,
      imprint_granted INTEGER DEFAULT 0,
      imprint_trait_source_theme TEXT,
      imprint_granted_at TEXT,
      declared_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE
    )
  `);

  // Prelude bonus tracker (early Expertise Die unlock at L5 instead of L11)
  await db.execute(`
    CREATE TABLE IF NOT EXISTS prelude_unlock_flags (
      character_id INTEGER PRIMARY KEY,
      early_expertise_die_unlocked INTEGER DEFAULT 0,
      unlock_source TEXT DEFAULT 'prelude',
      unlocked_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE
    )
  `);
}

export async function down(db) {
  await db.execute('DROP TABLE IF EXISTS prelude_unlock_flags');
  await db.execute('DROP TABLE IF EXISTS mentor_imprints');
  await db.execute('DROP TABLE IF EXISTS mythic_arcs');
}
