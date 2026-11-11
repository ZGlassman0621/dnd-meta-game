/**
 * Migration 082: Spent hit-dice tracking (Phase 1 — [REST], v1.0.188).
 *
 * Hit-dice POOLS already exist (characters.hit_dice, companions.
 * companion_hit_dice — JSON breakdowns like {"d10": 4}), but nothing
 * tracked how many dice an actor had already spent, so a short rest had
 * nothing to spend from. These columns mirror the pools:
 *
 *   characters.hit_dice_used            JSON {"d10": 2} — dice spent
 *   companions.companion_hit_dice_used  JSON {"d8": 1}  — dice spent
 *
 * NULL = nothing spent. Short rests add what they spend; long rests
 * reduce the spent count by half the actor's total dice (minimum 1).
 */
export async function up(db) {
  const addIfMissing = async (table, col, sql) => {
    const info = await db.execute(`PRAGMA table_info(${table})`);
    const names = new Set((info.rows || []).map(r => r.name));
    if (!names.has(col)) await db.execute(sql);
  };

  await addIfMissing('characters', 'hit_dice_used',
    `ALTER TABLE characters ADD COLUMN hit_dice_used TEXT DEFAULT NULL`);
  await addIfMissing('companions', 'companion_hit_dice_used',
    `ALTER TABLE companions ADD COLUMN companion_hit_dice_used TEXT DEFAULT NULL`);
}

export async function down(db) {
  // SQLite cannot drop columns without a table rebuild; the columns are
  // nullable and inert if left behind.
}
