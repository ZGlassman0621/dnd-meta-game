/**
 * Migration 060: characters.distinguishing_features
 *
 * RECONSTRUCTED from the live database schema (2026-08-10). See migration
 * 054's header for why these files had to be rebuilt.
 *
 * The player-character counterpart to migration 054, which added the same
 * column to `npcs`. Two migrations six apart share a name because they
 * target two different tables — 054 is the NPC side, this is the character
 * side. Reading the `_migrations` ledger alone, they look like a duplicate;
 * they are not.
 *
 * Backs the optional "Distinguishing Features" field in Step 7 (Identity
 * Details) of the rebuilt creator — see `Step7IdentityDetails.jsx` and
 * `Step8Review.jsx`. Free descriptive text (scars, tattoos, a limp), which
 * is why it is nullable with no default and gets no backfill: characters
 * created before Step 7 shipped simply never had one captured.
 *
 * Additive and idempotent.
 */

export async function up(db) {
  const cols = await db.execute(`PRAGMA table_info(characters)`);
  const hasColumn = cols.rows.some((c) => c.name === 'distinguishing_features');
  if (!hasColumn) {
    await db.execute(`ALTER TABLE characters ADD COLUMN distinguishing_features TEXT`);
  }
}

export async function down(db) {
  // SQLite < 3.35 doesn't support DROP COLUMN portably; the column is
  // nullable and harmless if unused.
}
