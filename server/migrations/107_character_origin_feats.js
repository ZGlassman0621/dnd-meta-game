/**
 * Migration 107: Character Origin Feats Schema (Stage 3, 2026-11-06).
 *
 * One origin feat per character — the fixed feat granted by the
 * character's theme at creation (Stage 3), mirroring the ancestry
 * pattern (migration 024) but simpler: a character has exactly one
 * origin feat, so the table carries UNIQUE(character_id) instead of
 * a per-tier unique key, and the grant is INSERT OR REPLACE.
 *
 * Tables:
 * - character_origin_feats: which origin feat each character took
 *   (feat_key is a featRegistry key, e.g. 'magic_initiate'), plus
 *   the player's sub-choices for feats that need picks (Magic
 *   Initiate spell list/ability/spells, Musician instruments,
 *   Skilled skills/tools, Crafter tools) as choices_json.
 *
 * The theme's ASI is NOT stored here — it resolves from themes.js
 * via the stored theme at Stage 4. The character `feats` JSON column
 * is NOT touched either: progressionService is the single source of
 * truth for this grant, mirroring ancestry.
 *
 * Follows migration 024's shape and the runner's transaction rule
 * (up(db) + db.execute(...) only, inside the runner's transaction —
 * never import dbAll/dbRun here).
 */

export async function up(db) {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS character_origin_feats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      character_id INTEGER NOT NULL,
      feat_key TEXT NOT NULL,
      choices_json TEXT,
      selected_at_level INTEGER NOT NULL,
      selected_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE,
      UNIQUE(character_id)
    )
  `);

  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_character_origin_feats_char
    ON character_origin_feats(character_id)
  `);
}

export async function down(db) {
  await db.execute('DROP TABLE IF EXISTS character_origin_feats');
}
