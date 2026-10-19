/**
 * Deferred-resolution sweep (P5-D).
 *
 * The living-world tick resolves time-deferred rows: companion
 * away-activities past their expected duration, merchant commissions past
 * their deadline, and ready orders left uncollected too long. With
 * LIVING_WORLD_TICK off (MVP posture) the tick never runs, so those rows
 * strand silently in `in_progress` / `pending` — a companion sent away
 * never returns, which the feature-flag docs call out as a soft-lock, not
 * a paused system. (New queueing is already blocked: sendOnActivity and
 * commission placement throw while DEFERRED_RESOLUTION_ACTIONS is off, so
 * only legacy rows from the tick-on era can strand.)
 *
 * This runs the same three resolvers the tick would run. Each is idempotent
 * (they only touch past-due rows) and individually guarded — a sweep that
 * fails is strictly better than a session that fails to end. The resolvers
 * queue their own narrative items, so the player hears about outcomes next
 * session (the queue delivers again since the narrative-queue fix).
 *
 * Called from the session-end route when the tick is disabled.
 */

import { checkAndResolveActivities } from './companionActivityService.js';
import { processDueOrders, expireStaleReadyOrders } from './merchantOrderService.js';
import * as narrativeQueueService from './narrativeQueueService.js';

/**
 * @param {number} campaignId
 * @param {number} characterId - the session's character (narrative items are scoped to them)
 * @param {number} gameDay - current campaign day (post-advance)
 * @returns {Promise<{activitiesResolved:number, ordersReadied:number, ordersExpired:number}>}
 */
export async function sweepDeferredResolutions(campaignId, characterId, gameDay) {
  const result = { activitiesResolved: 0, ordersReadied: 0, ordersExpired: 0 };
  if (!campaignId || !gameDay) return result;

  // 1. Companion away-activities past their expected duration. resolveActivity
  // returns the companion to 'active' and queues its own reunion narrative.
  try {
    result.activitiesResolved = await checkAndResolveActivities(campaignId, gameDay);
  } catch (e) {
    console.error('[deferred-sweep] companion activities failed (non-fatal):', e?.message);
  }

  // 2. Merchant commissions past their deadline → ready, with a narrative
  // item so the DM can mention the pickup next session.
  try {
    const readied = await processDueOrders(gameDay);
    for (const o of readied) {
      if (o.character_id !== characterId) continue;
      result.ordersReadied++;
      try {
        await narrativeQueueService.addToQueue({
          campaign_id: campaignId,
          character_id: o.character_id,
          event_type: 'merchant_order_ready',
          priority: 'normal',
          title: `Commission ready: ${o.item_name}`,
          description: `${o.merchant_name || 'A merchant'} has finished your commissioned ${o.item_name}. It's ready for pickup. Balance due: ${Math.ceil(o.balance_cp / 100)} gp.`,
          context: { order_id: o.id, merchant_id: o.merchant_id, balance_cp: o.balance_cp }
        });
      } catch (e) { /* narrative queue is best-effort */ }
    }
  } catch (e) {
    console.error('[deferred-sweep] due orders failed (non-fatal):', e?.message);
  }

  // 3. Ready orders left uncollected too long → expired, with a narrative item.
  try {
    const expired = await expireStaleReadyOrders(gameDay);
    for (const o of expired) {
      if (o.character_id !== characterId) continue;
      result.ordersExpired++;
      try {
        await narrativeQueueService.addToQueue({
          campaign_id: campaignId,
          character_id: o.character_id,
          event_type: 'merchant_order_expired',
          priority: 'low',
          title: `Commission abandoned: ${o.item_name}`,
          description: `${o.merchant_name || 'A merchant'} has given up holding your ${o.item_name} — it's been sold to another buyer. Your deposit is forfeit.`,
          context: { order_id: o.id, merchant_id: o.merchant_id }
        });
      } catch (e) { /* narrative queue is best-effort */ }
    }
  } catch (e) {
    console.error('[deferred-sweep] order expiry failed (non-fatal):', e?.message);
  }

  return result;
}
