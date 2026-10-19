/**
 * Migration 069: Cover tracking (Combat Pipeline #6).
 * D&D 2024: half (+2 AC), three-quarters (+5 AC), full (untargetable).
 */
export async function up(db) {
  await db.execute(`ALTER TABLE combat_enemies ADD COLUMN cover TEXT NOT NULL DEFAULT 'none'`);
}
export async function down(db) {
  // Additive column, safe to leave.
}
