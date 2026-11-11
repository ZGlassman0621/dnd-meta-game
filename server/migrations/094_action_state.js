/**
 * Migration 094: Action-state column (combat item 3, Tier 3).
 *
 * combat_turn_state gains action_state_json: Dodge / Disengage /
 * Help / Hide / Ready state keyed by combatant (world ID for
 * party/companions, combat fallback key for mooks), following the
 * Q6 ruling that combat_turn_state is the state home. Timed fields
 * (dodge, disengage, help, ready) carry the (round, index) at which
 * the owner's next turn starts, so they expire lazily by position
 * instead of needing a hook on TURN_ADVANCE; hidden has no expiry
 * (consumed by the next attack). The row dies on COMBAT_END, so
 * no action state survives a fight.
 */
export async function up(db) {
  const info = await db.execute(`PRAGMA table_info(combat_turn_state)`);
  const cols = info.rows.map((c) => c.name);
  if (!cols.includes('action_state_json')) {
    await db.execute(
      `ALTER TABLE combat_turn_state ADD COLUMN action_state_json TEXT NOT NULL DEFAULT '{}'`
    );
  }
}

export function down() {
  // No-op by convention (091 pattern): columns are never dropped.
}
