/**
 * Merchant Relationship Service (M4)
 *
 * Surfaces the merchant-memory data that's been quietly persisted in
 * `merchant_inventories.transaction_history` (since migration 011) plus
 * per-character notes and the favorite flag (migration 034).
 *
 * Nothing new is persisted here beyond what migration 034 adds — the
 * visit counts / gold flow / loyalty tier are all derived on read.
 */

import { dbAll, dbGet, dbRun } from '../database.js';
import { safeParse } from '../utils/safeParse.js';
import { getMerchantMemoryModifiers } from './economyService.js';

/**
 * Build the relationship summary for every merchant this character has
 * transacted with. Returns one entry per merchant, sorted with favorites
 * first, then most-recently-visited.
 */
export async function getRelationshipsForCharacter(characterId) {
  // Every merchant in the character's campaign — we'll filter down to
  // only those with at least one transaction OR a note/favorite row.
  const char = await dbGet('SELECT campaign_id FROM characters WHERE id = ?', [characterId]);
  if (!char?.campaign_id) return [];

  const merchants = await dbAll(
    `SELECT id, merchant_name, merchant_type, location, prosperity, transaction_history, gold_gp, last_restocked
     FROM merchant_inventories
     WHERE campaign_id = ?`,
    [char.campaign_id]
  );

  const notesRows = await dbAll(
    'SELECT merchant_id, notes, favorited, updated_at FROM character_merchant_relationships WHERE character_id = ?',
    [characterId]
  );
  const notesByMerchant = new Map(notesRows.map(r => [r.merchant_id, r]));

  const out = [];
  for (const m of merchants) {
    const history = safeParse(m.transaction_history, []);
    const charHistory = history.filter(h => h.character_id === characterId);
    const notesRow = notesByMerchant.get(m.id);

    if (charHistory.length === 0 && !notesRow) continue; // never visited, no notes

    // Totals
    let totalSpentCp = 0;
    let totalEarnedCp = 0;
    let lastVisitGameDay = null;
    let lastVisitAt = null;
    for (const tx of charHistory) {
      totalSpentCp += tx.total_spent_cp || 0;
      totalEarnedCp += tx.total_earned_cp || 0;
      if (typeof tx.game_day === 'number' && (lastVisitGameDay == null || tx.game_day > lastVisitGameDay)) {
        lastVisitGameDay = tx.game_day;
      }
      if (tx.at && (lastVisitAt == null || tx.at > lastVisitAt)) lastVisitAt = tx.at;
    }

    // Current loyalty via economy service (single source of truth)
    const mem = await getMerchantMemoryModifiers(m.id, characterId).catch(
      () => ({ loyaltyDiscount: 0, visitCount: charHistory.length })
    );

    // Try to pull disposition from npc_relationships if there's a matching NPC
    let disposition = null;
    try {
      const npc = await dbGet(
        'SELECT id FROM npcs WHERE LOWER(name) LIKE LOWER(?) LIMIT 1',
        [`%${m.merchant_name}%`]
      );
      if (npc) {
        const rel = await dbGet(
          'SELECT disposition_label FROM npc_relationships WHERE character_id = ? AND npc_id = ?',
          [characterId, npc.id]
        );
        disposition = rel?.disposition_label || null;
      }
    } catch (_) { /* neutral */ }

    out.push({
      merchant_id: m.id,
      merchant_name: m.merchant_name,
      merchant_type: m.merchant_type,
      location: m.location,
      prosperity: m.prosperity,
      merchant_gold_gp: m.gold_gp,
      last_restocked: m.last_restocked,
      visit_count: mem.visitCount,
      total_spent_cp: totalSpentCp,
      total_earned_cp: totalEarnedCp,
      last_visit_game_day: lastVisitGameDay,
      last_visit_at: lastVisitAt,
      loyalty_discount_percent: Math.round((mem.loyaltyDiscount || 0) * 100),
      disposition,
      notes: notesRow?.notes || null,
      favorited: notesRow?.favorited === 1,
      notes_updated_at: notesRow?.updated_at || null
    });
  }

  // Favorites first, then most-recently-visited
  out.sort((a, b) => {
    if (a.favorited !== b.favorited) return a.favorited ? -1 : 1;
    return (b.last_visit_game_day || 0) - (a.last_visit_game_day || 0);
  });
  return out;
}

/**
 * Upsert the notes + favorited flag for a character/merchant pair.
 * Either field can be omitted; unspecified fields are preserved.
 */
export async function upsertRelationship(characterId, merchantId, { notes, favorited } = {}) {
  const existing = await dbGet(
    'SELECT id, notes, favorited FROM character_merchant_relationships WHERE character_id = ? AND merchant_id = ?',
    [characterId, merchantId]
  );

  const newNotes = notes !== undefined ? notes : (existing?.notes ?? null);
  const newFavorited = favorited !== undefined
    ? (favorited ? 1 : 0)
    : (existing?.favorited ?? 0);

  if (existing) {
    await dbRun(
      `UPDATE character_merchant_relationships
       SET notes = ?, favorited = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [newNotes, newFavorited, existing.id]
    );
  } else {
    await dbRun(
      `INSERT INTO character_merchant_relationships
       (character_id, merchant_id, notes, favorited)
       VALUES (?, ?, ?, ?)`,
      [characterId, merchantId, newNotes, newFavorited]
    );
  }

  return {
    character_id: characterId,
    merchant_id: merchantId,
    notes: newNotes,
    favorited: newFavorited === 1
  };
}
