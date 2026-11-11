/**
 * Migration 096: Enemy spell slots column (combat item 5, enemy
 * action economy).
 *
 * combat_enemies gains enemy_spell_slots_json: the enemy's remaining
 * spell slots for this encounter ({"1": 4, "2": 3} for slot casters;
 * per-day powers map to buckets via ENEMY_SLOTS). Row-scoped and
 * encounter-scoped, so slots naturally reset with a new encounter.
 * Lazy bestiary seeding (enemyEconomyService) fills it on first
 * cast for bestiary-backed casters; DM-declared casters use
 * ENEMY_SLOTS. No other item-5 state needs a column: budgets ride
 * turn_budget_json (093, merge-safe) and multiattack/legendary
 * ride action_state_json (094).
 */
export async function up(db) {
  const info = await db.execute(`PRAGMA table_info(combat_enemies)`);
  const cols = info.rows.map((c) => c.name);
  if (!cols.includes('enemy_spell_slots_json')) {
    await db.execute(
      `ALTER TABLE combat_enemies ADD COLUMN enemy_spell_slots_json TEXT NOT NULL DEFAULT '{}'`
    );
  }
}

export function down() {
  // No-op by convention (091 pattern): columns are never dropped.
}
