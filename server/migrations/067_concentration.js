/**
 * Migration 067: Concentration tracking (Combat Pipeline #4).
 * Per D&D 2024: caster concentrates on one spell; damage forces CON save.
 */
export async function up(db) {
  await db.execute(`ALTER TABLE characters ADD COLUMN concentrating_on TEXT DEFAULT NULL`);
}
export async function down(db) {
  // Additive column, safe to leave.
}
