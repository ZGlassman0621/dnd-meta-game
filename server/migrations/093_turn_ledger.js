/**
 * Migration 093: Turn ledger column (combat item 3, Tier 1).
 *
 * combat_turn_state gains turn_budget_json: per-turn-slot budgets
 * keyed by combatant (world ID for party/companions, combat fallback
 * key for mooks), holding the once-per-turn flags and the action
 * budget for that slot. One JSON column, same shape as
 * party_cover_json (084) and reactions_used_json (068).
 *
 * The four once-per-turn flags (sneakUsed, gwmUsed, cleaveUsed,
 * offHandUsed) move OUT of dm_sessions.session_config into this
 * ledger for ordered combat. Their old session_config keys are left
 * in place, unread for ordered combat: they remain the fallback home
 * for attacks made before any turn order exists (the no-order case),
 * and rewriting every live session JSON to delete them would risk
 * session data for no gain. No data migration is needed: a fresh
 * slot starts with an empty budget by construction.
 */
export async function up(db) {
  const info = await db.execute(`PRAGMA table_info(combat_turn_state)`);
  const cols = info.rows.map((c) => c.name);
  if (!cols.includes('turn_budget_json')) {
    await db.execute(
      `ALTER TABLE combat_turn_state ADD COLUMN turn_budget_json TEXT NOT NULL DEFAULT '{}'`
    );
  }
}

export function down() {
  // No-op by convention (091 pattern): columns are never dropped.
}
