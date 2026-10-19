/**
 * Migration 072: Morale buff storage (Combat Pipeline #11 extension).
 * Symmetric morale: winning side can gain +1 to attacks.
 */
export async function up(db) {
  await db.execute(`ALTER TABLE combat_turn_state ADD COLUMN morale_buff_json TEXT NOT NULL DEFAULT '{}'`);
}
export async function down(db) {
  // Additive column, safe to leave.
}
