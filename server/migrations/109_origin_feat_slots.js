// Migration 109: origin-feat slots (Human Versatile, item 19, 2026-11-06).
//
// A character can now hold TWO origin feats: the theme's fixed feat
// (slot 'theme', migration 107) and the human Versatile pick (slot
// 'versatile', any one of the 10 origin feats, chosen at Stage 1).
// The two feats must be different — enforced by the character-route
// validators, not by the schema (the schema cannot compare feat keys
// across rows).
//
// SQLite cannot drop a UNIQUE constraint or add a column with a
// CHECK in place, so the table is rebuilt: the new table carries
// UNIQUE(character_id, slot) instead of UNIQUE(character_id), plus a
// `slot` column (CHECK slot IN ('theme','versatile')). Existing rows
// are all theme grants and copy over as slot 'theme'. The rebuild
// runs inside the runner's transaction (up(db) + db.execute only —
// never import dbAll/dbRun here).
export async function up(db) {
  await db.execute(`
    CREATE TABLE character_origin_feats_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      character_id INTEGER NOT NULL,
      feat_key TEXT NOT NULL,
      choices_json TEXT,
      selected_at_level INTEGER NOT NULL,
      selected_at TEXT DEFAULT CURRENT_TIMESTAMP,
      slot TEXT NOT NULL DEFAULT 'theme' CHECK (slot IN ('theme', 'versatile')),
      FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE,
      UNIQUE(character_id, slot)
    )
  `);

  await db.execute(`
    INSERT INTO character_origin_feats_new
      (id, character_id, feat_key, choices_json, selected_at_level, selected_at, slot)
    SELECT id, character_id, feat_key, choices_json, selected_at_level, selected_at, 'theme'
    FROM character_origin_feats
  `);

  await db.execute('DROP TABLE character_origin_feats');

  await db.execute('ALTER TABLE character_origin_feats_new RENAME TO character_origin_feats');

  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_character_origin_feats_char
    ON character_origin_feats(character_id)
  `);
}

export async function down(db) {
  // The slot column and the relaxed UNIQUE are additive/structural;
  // a rollback leaves them in place (same convention as other
  // additive migrations in this repo). Downgrading would strand the
  // versatile rows, which have no pre-109 home.
}
