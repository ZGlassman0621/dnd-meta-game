/**
 * Migration 039: Multi-nickname system with audience rules
 *
 * Replaces the single `characters.nickname` column with a proper
 * many-to-one table. Each row is one name (full name, title, nickname)
 * with an `audience_type` describing who uses it: strangers, friends
 * (disposition ≥ 25), allied (≥ 50), devoted (≥ 75), a specific NPC,
 * or NPCs of a particular role/occupation.
 *
 * Bards ignore the rules and may use any nickname — enforced in the
 * resolver service, not the schema.
 *
 * Backfill: every character with a non-empty `characters.nickname` gets a
 * row inserted with audience_type='friends' — matches the prior DM-prompt
 * semantics that the nickname was "only used by close friends or those
 * the character has shared it with."
 *
 * The existing `characters.nickname` column is kept in place for
 * backwards compatibility (sessions, exports, prelude builder) but the
 * new `character_nicknames` table is the source of truth going forward.
 */

export async function up(db) {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS character_nicknames (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      character_id INTEGER NOT NULL,
      nickname TEXT NOT NULL,
      audience_type TEXT NOT NULL
        CHECK(audience_type IN ('default','friends','allied','devoted','specific_npc','role')),
      audience_value TEXT,
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE
    )
  `);

  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_character_nicknames_char
    ON character_nicknames(character_id)
  `);

  // Backfill: any existing characters.nickname becomes a 'friends' rule
  const existing = await db.execute(`
    SELECT id, nickname FROM characters
    WHERE nickname IS NOT NULL AND TRIM(nickname) != ''
  `);

  for (const row of existing.rows) {
    // Skip if this character already has an imported nickname (re-run safety)
    const already = await db.execute({
      sql: `SELECT id FROM character_nicknames
            WHERE character_id = ? AND nickname = ? AND audience_type = 'friends'`,
      args: [row.id, row.nickname]
    });
    if (already.rows.length > 0) continue;

    await db.execute({
      sql: `INSERT INTO character_nicknames
            (character_id, nickname, audience_type, notes)
            VALUES (?, ?, 'friends', 'Backfilled from the legacy single-nickname field.')`,
      args: [row.id, row.nickname]
    });
  }
}

export async function down(db) {
  await db.execute(`DROP INDEX IF EXISTS idx_character_nicknames_char`);
  await db.execute(`DROP TABLE IF EXISTS character_nicknames`);
}
