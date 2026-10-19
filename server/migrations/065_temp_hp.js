/**
 * Migration 065: Temporary HP (Combat Pipeline #1).
 * Foundation for the damage pipeline. Per D&D 2024 rules:
 * - Damage subtracts from temp HP first, then regular HP.
 * - Temp HP does not stack; gaining new temp HP replaces old (take higher).
 * - Healing does not restore temp HP.
 */
export async function up(db) {
  await db.execute(`ALTER TABLE characters ADD COLUMN temp_hp INTEGER NOT NULL DEFAULT 0`);
  await db.execute(`ALTER TABLE companions ADD COLUMN companion_temp_hp INTEGER NOT NULL DEFAULT 0`);
}
export async function down(db) {
  // SQLite DROP COLUMN not supported in older versions; additive columns safe to leave.
}
