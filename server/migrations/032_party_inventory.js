/**
 * Migration 032: Party Inventory (M1)
 *
 * Architectural shift: carried inventory and gold are now PARTY-level, not
 * per-entity. The recruiting character's `inventory` + `gold_*` columns
 * become the canonical shared bucket. Companions keep their equipment slots
 * (per-entity) but no longer hold their own carried items or coin.
 *
 * This migration performs a one-time merge: for every active companion, push
 * their current inventory into the recruiting character's inventory (stack-
 * merging by item name, case-insensitive) and add their gold to the
 * character's purse. After the merge, the companion's carried columns are
 * zeroed out.
 *
 * Idempotency: safe to re-run. If a companion is already zeroed (inventory
 * = '[]' or empty, gold_* = 0), we skip them. No-op on a fresh DB.
 *
 * This migration does NOT alter schema. The columns on `companions` stay
 * in place so we can fail gracefully if some code path still reads them;
 * future cleanup can drop/rename them once all readers are updated.
 */

import { safeParse } from '../utils/safeParse.js';

function mergeStacks(destArr, srcArr) {
  for (const src of srcArr) {
    if (!src || !src.name) continue;
    const qty = src.quantity || 1;
    const existing = destArr.find(
      i => (i.name || '').toLowerCase() === src.name.toLowerCase()
    );
    if (existing) {
      existing.quantity = (existing.quantity || 1) + qty;
    } else {
      destArr.push({ ...src, quantity: qty });
    }
  }
  return destArr;
}

export async function up(db) {
  // Find every active companion that has something to merge.
  const rows = await db.execute(`
    SELECT id, recruited_by_character_id, inventory, gold_gp, gold_sp, gold_cp
    FROM companions
    WHERE status = 'active'
  `);

  let mergedCount = 0;

  for (const comp of rows.rows) {
    const compInv = safeParse(comp.inventory, []);
    const hasItems = Array.isArray(compInv) && compInv.length > 0;
    const hasGold = (comp.gold_gp || 0) > 0 || (comp.gold_sp || 0) > 0 || (comp.gold_cp || 0) > 0;
    if (!hasItems && !hasGold) continue;

    // Fetch the recruiter's current party bucket
    const charRows = await db.execute({
      sql: 'SELECT id, inventory, gold_gp, gold_sp, gold_cp FROM characters WHERE id = ?',
      args: [comp.recruited_by_character_id]
    });
    const character = charRows.rows[0];
    if (!character) continue; // orphaned companion — skip safely

    const charInv = safeParse(character.inventory, []);
    const merged = mergeStacks(charInv, compInv);

    const newGp = (character.gold_gp || 0) + (comp.gold_gp || 0);
    const newSp = (character.gold_sp || 0) + (comp.gold_sp || 0);
    const newCp = (character.gold_cp || 0) + (comp.gold_cp || 0);

    await db.execute({
      sql: `UPDATE characters
            SET inventory = ?, gold_gp = ?, gold_sp = ?, gold_cp = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?`,
      args: [JSON.stringify(merged), newGp, newSp, newCp, character.id]
    });

    await db.execute({
      sql: `UPDATE companions
            SET inventory = '[]', gold_gp = 0, gold_sp = 0, gold_cp = 0
            WHERE id = ?`,
      args: [comp.id]
    });

    mergedCount++;
  }

  if (mergedCount > 0) {
    console.log(`Migration 032: merged inventories for ${mergedCount} companion(s) into their recruiting characters`);
  }
}

export async function down(db) {
  // The merge is destructive — we don't know which items originally came
  // from which companion. Rolling back would require a pre-merge snapshot
  // we don't keep. No-op.
}
