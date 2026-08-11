/**
 * Migration 059: characters.creator_draft
 *
 * RECONSTRUCTED from the live database schema (2026-08-10). See migration
 * 054's header for why these files had to be rebuilt.
 *
 * Server-side home for the character creator's in-progress draft state — the
 * JSON blob the wizard needs to save and resume a partially built character
 * across devices or sessions.
 *
 * Nullable TEXT with no default: a row only carries a draft while it is mid
 * creation. It pairs with `creation_phase` (migration 049), which marks the
 * row as 'creating' rather than finished.
 *
 * NOTE — currently unreferenced by any code in this repository. The client
 * keeps creator drafts in `creatorPersistence.js` (browser-side), and no
 * server route reads or writes this column; it is NULL on all three live
 * rows. It is reproduced anyway because the repo's job is to build the
 * schema the live database actually has. Whether the server-side draft path
 * gets finished or the column gets dropped is a product decision, not
 * something to settle by quietly omitting it here.
 *
 * Additive and idempotent.
 */

export async function up(db) {
  const cols = await db.execute(`PRAGMA table_info(characters)`);
  const hasColumn = cols.rows.some((c) => c.name === 'creator_draft');
  if (!hasColumn) {
    await db.execute(`ALTER TABLE characters ADD COLUMN creator_draft TEXT`);
  }
}

export async function down(db) {
  // SQLite < 3.35 doesn't support DROP COLUMN portably; the column is
  // nullable and harmless if unused.
}
