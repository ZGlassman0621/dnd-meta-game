/**
 * Migration 095: Battlefield zones column (combat item 4, movement v1).
 *
 * combat_turn_state gains zones_json: the zone graph for the fight
 * (named areas + foot-cost edges + each combatant's current area),
 * following the Q6 ruling that combat_turn_state is the state home.
 * Movement budgets live in turn_budget_json (migration 093) as
 * moveSpent/dashed fields on the per-slot budget, so no second
 * column is needed. The row dies on COMBAT_END, so no zone graph
 * survives a fight.
 */
export async function up(db) {
  const info = await db.execute(`PRAGMA table_info(combat_turn_state)`);
  const cols = info.rows.map((c) => c.name);
  if (!cols.includes('zones_json')) {
    await db.execute(
      `ALTER TABLE combat_turn_state ADD COLUMN zones_json TEXT NOT NULL DEFAULT '{}'`
    );
  }
}

export function down() {
  // No-op by convention (091 pattern): columns are never dropped.
}
