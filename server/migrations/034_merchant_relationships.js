/**
 * Migration 034: Merchant Relationships (M4)
 *
 * Per-character per-merchant notes and favorite flag. The heavy stats
 * (visit count, gold spent/earned, category preferences) are already
 * computed on-the-fly from `merchant_inventories.transaction_history`;
 * this table adds only the data that isn't derivable — player-authored
 * notes and the favorite pin.
 */

export async function up(db) {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS character_merchant_relationships (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      character_id INTEGER NOT NULL,
      merchant_id INTEGER NOT NULL,
      notes TEXT,
      favorited INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(character_id, merchant_id),
      FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE,
      FOREIGN KEY (merchant_id) REFERENCES merchant_inventories(id) ON DELETE CASCADE
    )
  `);
  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_cmr_character
    ON character_merchant_relationships(character_id)
  `);
  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_cmr_favorited
    ON character_merchant_relationships(character_id, favorited)
    WHERE favorited = 1
  `);
}

export async function down(db) {
  await db.execute('DROP INDEX IF EXISTS idx_cmr_favorited');
  await db.execute('DROP INDEX IF EXISTS idx_cmr_character');
  await db.execute('DROP TABLE IF EXISTS character_merchant_relationships');
}
