/**
 * Migration 054: npcs.distinguishing_features
 *
 * RECONSTRUCTED from the live database schema (2026-08-10).
 *
 * This migration is recorded as applied in the live Turso `_migrations`
 * ledger, but its source file never existed in this repository — it was
 * applied from a working tree that was never committed, on this machine or
 * any other. `git log --all`, every dangling commit, and a filesystem sweep
 * all came up empty. It is rebuilt here from the observed live schema so
 * that `server/migrations/` can build a database that matches production.
 *
 * Why this matters: `dmSessionService.js` and `npcRelationshipService.js`
 * both SELECT `npcs.distinguishing_features`. Without this migration a
 * freshly built database (every test run, every new dev environment) raises
 * `SQLITE_ERROR: no such column: distinguishing_features` the moment NPC
 * enrichment or relationship context is touched.
 *
 * Note the near-duplicate: migration 001 already created
 * `npcs.distinguishing_marks`, which no current code path reads. Both
 * columns exist on live and both are NULL across all 54 NPC rows. The
 * duplication is reproduced rather than resolved — this migration's job is
 * to make the repo match the database, not to redesign it. Collapsing the
 * two is a separate, deliberate change.
 *
 * Additive and idempotent via PRAGMA table_info, matching house style.
 */

export async function up(db) {
  const cols = await db.execute(`PRAGMA table_info(npcs)`);
  const hasColumn = cols.rows.some((c) => c.name === 'distinguishing_features');
  if (!hasColumn) {
    await db.execute(`ALTER TABLE npcs ADD COLUMN distinguishing_features TEXT`);
  }
}

export async function down(db) {
  // SQLite < 3.35 doesn't support DROP COLUMN portably; the column is
  // nullable and harmless if unused, so rollback leaves it in place.
}
