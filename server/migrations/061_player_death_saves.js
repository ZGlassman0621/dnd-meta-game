/**
 * Migration 061: Player Death Saves (Phase 3.1)
 *
 * Renumbered from 054 on 2026-08-10. The live database had already recorded
 * a different 054-060 block (applied from a working tree that was never
 * committed), so this Phase 3.1 work was renumbered to sit after it and keep
 * the timeline linear. Behaviour is unchanged.
 *
 * Until now the protagonist could not reach 0 HP. HP moved only at session end
 * via a heuristic clamped with Math.max(1, ...), so the one character the
 * player actually controls was the only one in the game who could not die —
 * companions have had real HP and death saves since migration 030.
 *
 * These columns give the player the same apparatus, deliberately mirroring the
 * companion shape so both sides of the party share one mental model:
 *  - death_save_successes: INTEGER 0..3. Reset when HP rises above 0.
 *  - death_save_failures:  INTEGER 0..3. Reset when HP rises above 0 or on a
 *    long rest.
 *  - is_unconscious: 0/1. Set when HP hits 0, cleared when HP rises above 0.
 *  - is_dead: 0/1. Set on the third death-save failure. Terminal — nothing in
 *    the normal play loop clears it; resurrection is a deliberate act.
 *
 * Additive only, and idempotent via PRAGMA table_info, matching migration 030.
 */

export async function up(db) {
  const cols = [
    { col: 'death_save_successes', sql: 'ALTER TABLE characters ADD COLUMN death_save_successes INTEGER DEFAULT 0' },
    { col: 'death_save_failures', sql: 'ALTER TABLE characters ADD COLUMN death_save_failures INTEGER DEFAULT 0' },
    { col: 'is_unconscious', sql: 'ALTER TABLE characters ADD COLUMN is_unconscious INTEGER DEFAULT 0' },
    { col: 'is_dead', sql: 'ALTER TABLE characters ADD COLUMN is_dead INTEGER DEFAULT 0' }
  ];

  const existing = await db.execute('PRAGMA table_info(characters)');
  const existingNames = new Set(existing.rows.map(r => r.name));

  for (const { col, sql } of cols) {
    if (!existingNames.has(col)) {
      await db.execute(sql);
    }
  }
}

export async function down(db) {
  // SQLite can't drop columns without rebuilding the table. No-op, matching
  // the convention established by migration 030.
}
