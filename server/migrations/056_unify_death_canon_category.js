/**
 * Migration 056: unify death canon category (data-only)
 *
 * RECONSTRUCTED from the live database schema (2026-08-10). See migration
 * 054's header for why these files had to be rebuilt.
 *
 * Like 055, this left no schema footprint, so it was a one-time data
 * migration. Its intent is legible from a real inconsistency that was present
 * in the code at the time this file was reconstructed:
 *
 *   - `npcLifecycleService.js` INSERTed canon facts with category 'npc_death'.
 *   - `storyChronicleService.js` read and filtered on category 'death'.
 *
 * So NPC deaths were written under one category and read under another. This
 * migration evidently normalised the existing rows to 'death'. It did not fix
 * the writer, which is why the divergence outlived it.
 *
 * RESOLVED (Phase 4.1): `npcLifecycleService.js` now writes 'death' and
 * `syncDeathsFromCanonFacts` now reads 'death'. 'death' is the single canon
 * category for the event across the application; 'npc_death' survives only as
 * a `narrative_queue.event_type`, which is a different namespace entirely.
 * Pre-existing rows are repaired by
 * `server/scripts/normalize-npc-death-canon-category.js` — a re-runnable
 * utility, deliberately not a migration, since the writer bug produced rows
 * continuously rather than in one schema event.
 *
 * The body is intentionally empty. `canon_facts` on live currently holds
 * ZERO rows, so even the original had nothing to convert, and on a fresh
 * database there is nothing to convert either. As with 055, the file exists
 * to reserve the name for the by-name migration ledger.
 */

export async function up(db) {
  // Intentionally no-op. canon_facts is empty on live; nothing to unify.
  // The writer/reader category mismatch is a code bug, not a schema one —
  // see header. Do not add speculative logic here.
}

export async function down(db) {
  // Nothing to roll back.
}
