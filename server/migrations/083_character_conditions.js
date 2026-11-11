/**
 * Migration 083: PC conditions (Phase 1, v1.0.190).
 *
 * The player character's conditions lived in the CLIENT: the /message
 * request carried activeConditions, the server formatted it into a
 * one-line note, and the DM's CONDITION_ADD/REMOVE markers were regex-
 * detected and handed back in the response for the client to apply.
 * Nothing was stored server-side and nothing was enforced — a poison
 * that outlived the session evaporated, and "disadvantage" was a
 * request the DM could forget.
 *
 * This adds the mirror of the companion column (migration 030):
 *   characters.active_conditions TEXT DEFAULT '[]'
 * a JSON array of lowercase_underscore condition keys (the
 * CONDITION_ADD schema enum). conditionService.js owns reads/writes
 * for both tables so the two can never drift into separate dialects.
 */
export async function up(db) {
  const existing = await db.execute('PRAGMA table_info(characters)');
  const existingNames = new Set(existing.rows.map(r => r.name));

  if (!existingNames.has('active_conditions')) {
    await db.execute("ALTER TABLE characters ADD COLUMN active_conditions TEXT DEFAULT '[]'");
  }
}

export async function down(db) {
  // SQLite can't drop columns without rebuilding the table. No-op.
}
