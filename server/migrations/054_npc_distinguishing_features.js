/**
 * Migration 054 — Add the missing `distinguishing_features` column to npcs.
 *
 * The NPC enrichment pipeline (storyChronicleService / dmSessionService) and
 * npcRelationshipService.getCharacterRelationshipsWithNpcs both read and write
 * `npcs.distinguishing_features`, but no prior migration ever added the column.
 * Result: loading a character's NPC relationships when gathering world state
 * threw "no such column: n.distinguishing_features", silently breaking the
 * NPC-relationship context for DM sessions. This adds the column idempotently.
 */

export async function up(db) {
  try {
    const columns = await db.execute('PRAGMA table_info(npcs)');
    const exists = columns.rows.some(r => r[1] === 'distinguishing_features' || r.name === 'distinguishing_features');
    if (!exists) {
      await db.execute('ALTER TABLE npcs ADD COLUMN distinguishing_features TEXT');
    }
  } catch (e) {
    // Defensive: a concurrent add or pre-existing column shouldn't fail startup.
    console.warn('Migration 054 (npcs.distinguishing_features) note:', e.message);
  }
}

export async function down(db) {
  // SQLite has no clean DROP COLUMN; leave the column in place on rollback.
}
