/**
 * Migration 068: Reaction tracking (Combat Pipeline #5).
 * D&D 2024: one reaction per round, resets at start of your turn.
 */
export async function up(db) {
  await db.execute(`ALTER TABLE combat_turn_state ADD COLUMN reactions_used_json TEXT NOT NULL DEFAULT '{}'`);
}
export async function down(db) {
  // Additive column, safe to leave.
}
