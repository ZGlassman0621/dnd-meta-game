/**
 * Migration 056 — Unify the NPC-death canon-fact category label.
 *
 * Bug: propagateNpcDeath() wrote death canon facts under category 'npc_death',
 * but getRelevantContext()'s always-included "DEATHS (DO NOT RESURRECT)" prompt
 * block — and getChronicleStats() — only queried category 'death'. The two never
 * matched, so over a long campaign a propagated NPC death could silently drop out
 * of the guaranteed-deaths section and the DM was free to resurrect the NPC. This
 * is a direct hit on the project's #1 promise (play one character for years
 * without the AI forgetting canon).
 *
 * The code fix standardizes new writes on the canonical 'death' label and makes
 * every death read accept IN ('death','npc_death') as belt-and-suspenders. This
 * migration heals existing saves by relabeling any legacy 'npc_death' rows to the
 * canonical 'death' so the data itself is uniform going forward.
 *
 * Idempotent: re-running matches zero rows once converted.
 */

export async function up(db) {
  try {
    const res = await db.execute(
      "UPDATE canon_facts SET category = 'death' WHERE category = 'npc_death'"
    );
    const n = res.rowsAffected ?? 0;
    if (n > 0) {
      console.log(`Migration 056: relabeled ${n} 'npc_death' canon fact(s) -> 'death'.`);
    }
  } catch (e) {
    // Defensive: never wedge startup over a backfill.
    console.warn('Migration 056 (unify death canon category) note:', e.message);
  }
}

export async function down() {
  // No-op on purpose. We cannot safely reverse this: after the up() migration
  // (and the code change that writes 'death' for every death), genuine
  // LLM-extracted 'death' facts and relabeled-from-'npc_death' facts are
  // indistinguishable. Relabeling 'death' -> 'npc_death' on rollback would
  // corrupt the former. Leaving the canonical 'death' label in place is the
  // safe rollback behavior.
}
