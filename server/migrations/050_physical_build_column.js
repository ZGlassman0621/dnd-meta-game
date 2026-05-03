/**
 * Migration 050: physical_build column on characters.
 *
 * Phase 2 chunk 5 batch 3 sub-checkpoint 2 (5.L.5). Adds the
 * `physical_build` column referenced by Step 7 (Identity Details) of
 * the rebuilt creator. Per spec §5.7.4: required field describing the
 * character's body type (slim, heavy, wiry, etc.).
 *
 * Captured client-side since Step 7 shipped (v1.0.112), but server PUT
 * allowlist intentionally omitted the field (would have crashed UPDATE
 * without a column). This migration adds the column; the same commit
 * adds `physical_build` to the PUT allowlist in `server/routes/character.js`.
 *
 * Additive only — existing rows get NULL. No backfill (the field is
 * optional descriptive text; legacy characters didn't have it captured).
 */

export async function up(db) {
  const cols = await db.execute(`PRAGMA table_info(characters)`)
  const hasColumn = cols.rows.some(c => c.name === 'physical_build')
  if (!hasColumn) {
    await db.execute(`ALTER TABLE characters ADD COLUMN physical_build TEXT`)
  }
}

export async function down(db) {
  // SQLite < 3.35 doesn't support DROP COLUMN portably; we leave the
  // column in place on rollback. It's nullable and harmless if unused.
}
