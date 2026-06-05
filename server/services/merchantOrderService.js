/**
 * Merchant Order Service (M2)
 *
 * Custom-order business logic: commissioning, collecting, cancelling,
 * ready-polling, and narrative queue hand-off. Kept out of the HTTP
 * route layer so living-world tick can invoke the same helpers.
 */

import { dbAll, dbGet, dbRun } from '../database.js';
import { safeParse } from '../utils/safeParse.js';
import { registerHandler as registerMarkerHandler } from './markerPipeline.js';
import { getMerchantInventory, createMerchantOnTheFly } from './merchantService.js';
import { registerThresholdConsumer } from './timeBoundedState.js';

const CP_PER_GP = 100;
const CP_PER_SP = 10;

function gpSpCpToCp(gp = 0, sp = 0, cp = 0) {
  return gp * CP_PER_GP + sp * CP_PER_SP + cp;
}

function cpToCoins(totalCp) {
  const gp = Math.floor(totalCp / CP_PER_GP);
  const remainder = totalCp % CP_PER_GP;
  const sp = Math.floor(remainder / CP_PER_SP);
  const cp = remainder % CP_PER_SP;
  return { gp, sp, cp };
}

/**
 * Place a commission. Validates the party has enough gold for the deposit,
 * deducts it from the character's purse, credits the merchant, and records
 * the order.
 *
 * @param {object} args
 * @param {number} args.merchantId
 * @param {number} args.characterId
 * @param {string} args.itemName
 * @param {object} [args.itemSpec]       — { description, quality, rarity, ... }
 * @param {number} args.quotedPriceCp    — total price in copper
 * @param {number} args.depositCp        — deposit paid up front (<= total)
 * @param {number} args.leadTimeDays     — how many game days until ready
 * @param {number} args.currentGameDay
 * @param {string} [args.narrativeHook]
 * @returns {Promise<{ok:boolean, order?, error?}>}
 */
export async function placeCommission(args) {
  const {
    merchantId, characterId, itemName, itemSpec = null,
    quotedPriceCp, depositCp, leadTimeDays, currentGameDay = 0,
    narrativeHook = null
  } = args;

  if (!merchantId || !characterId || !itemName) {
    return { ok: false, error: 'merchantId, characterId, and itemName are required' };
  }
  if (!Number.isInteger(quotedPriceCp) || quotedPriceCp <= 0) {
    return { ok: false, error: 'quotedPriceCp must be a positive integer (copper)' };
  }
  if (!Number.isInteger(depositCp) || depositCp < 0) {
    return { ok: false, error: 'depositCp must be a non-negative integer' };
  }
  if (depositCp > quotedPriceCp) {
    return { ok: false, error: 'depositCp cannot exceed quotedPriceCp' };
  }
  if (!Number.isInteger(leadTimeDays) || leadTimeDays < 1) {
    return { ok: false, error: 'leadTimeDays must be a positive integer' };
  }

  const merchant = await dbGet('SELECT id FROM merchant_inventories WHERE id = ?', [merchantId]);
  if (!merchant) return { ok: false, error: 'Merchant not found' };

  const character = await dbGet(
    'SELECT id, gold_gp, gold_sp, gold_cp FROM characters WHERE id = ?',
    [characterId]
  );
  if (!character) return { ok: false, error: 'Character not found' };

  const partyCp = gpSpCpToCp(character.gold_gp || 0, character.gold_sp || 0, character.gold_cp || 0);
  if (partyCp < depositCp) {
    return { ok: false, error: 'Party does not have enough gold for the deposit' };
  }

  // Deduct deposit from party purse
  const newPartyCp = partyCp - depositCp;
  const { gp: newGp, sp: newSp, cp: newCp } = cpToCoins(newPartyCp);
  await dbRun(
    `UPDATE characters
     SET gold_gp = ?, gold_sp = ?, gold_cp = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [newGp, newSp, newCp, characterId]
  );

  // Credit merchant (kept in gp only for simplicity; matches existing pattern)
  const depositGp = Math.floor(depositCp / CP_PER_GP);
  if (depositGp > 0) {
    await dbRun(
      `UPDATE merchant_inventories
       SET gold_gp = COALESCE(gold_gp, 0) + ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [depositGp, merchantId]
    );
  }

  const result = await dbRun(
    `INSERT INTO merchant_orders
     (merchant_id, character_id, item_name, item_spec,
      quoted_price_cp, deposit_paid_cp, balance_cp,
      commissioned_game_day, deadline_game_day, narrative_hook, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
    [
      merchantId, characterId, itemName,
      itemSpec ? JSON.stringify(itemSpec) : null,
      quotedPriceCp, depositCp, quotedPriceCp - depositCp,
      currentGameDay, currentGameDay + leadTimeDays,
      narrativeHook
    ]
  );

  const order = await dbGet('SELECT * FROM merchant_orders WHERE id = ?', [Number(result.lastInsertRowid)]);
  return { ok: true, order };
}

/**
 * Collect a ready order. Validates the party has enough gold for the
 * balance, deducts it, credits the merchant, and adds the commissioned
 * item to the party inventory.
 */
export async function collectOrder(orderId, characterId) {
  const order = await dbGet('SELECT * FROM merchant_orders WHERE id = ?', [orderId]);
  if (!order) return { ok: false, error: 'Order not found' };
  if (order.character_id !== characterId) {
    return { ok: false, error: 'Order belongs to a different character' };
  }
  if (order.status !== 'ready') {
    return { ok: false, error: `Order is ${order.status}, not ready for pickup` };
  }

  const character = await dbGet(
    'SELECT id, inventory, gold_gp, gold_sp, gold_cp FROM characters WHERE id = ?',
    [characterId]
  );
  if (!character) return { ok: false, error: 'Character not found' };

  const partyCp = gpSpCpToCp(character.gold_gp || 0, character.gold_sp || 0, character.gold_cp || 0);
  if (partyCp < order.balance_cp) {
    return { ok: false, error: 'Party does not have enough gold to pay the balance' };
  }

  // Deduct balance
  const newPartyCp = partyCp - order.balance_cp;
  const { gp: newGp, sp: newSp, cp: newCp } = cpToCoins(newPartyCp);

  // Add the item to the party inventory (stack-merge by name)
  const inventory = safeParse(character.inventory, []);
  const itemSpec = safeParse(order.item_spec, {});
  const existing = inventory.find(i => (i.name || '').toLowerCase() === order.item_name.toLowerCase());
  if (existing) {
    existing.quantity = (existing.quantity || 1) + 1;
  } else {
    inventory.push({ name: order.item_name, quantity: 1, ...itemSpec });
  }

  await dbRun(
    `UPDATE characters
     SET inventory = ?, gold_gp = ?, gold_sp = ?, gold_cp = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [JSON.stringify(inventory), newGp, newSp, newCp, characterId]
  );

  // Credit merchant the balance
  const balanceGp = Math.floor(order.balance_cp / CP_PER_GP);
  if (balanceGp > 0) {
    await dbRun(
      `UPDATE merchant_inventories
       SET gold_gp = COALESCE(gold_gp, 0) + ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [balanceGp, order.merchant_id]
    );
  }

  await dbRun(
    `UPDATE merchant_orders
     SET status = 'collected', collected_game_day = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [order.ready_game_day || order.deadline_game_day, orderId]
  );

  const updated = await dbGet('SELECT * FROM merchant_orders WHERE id = ?', [orderId]);
  return { ok: true, order: updated, item: { name: order.item_name, ...itemSpec } };
}

/**
 * Cancel a pending order. Deposit is forfeit — realistic and gives the
 * player a gameplay reason to commit thoughtfully.
 */
export async function cancelOrder(orderId, characterId) {
  const order = await dbGet('SELECT * FROM merchant_orders WHERE id = ?', [orderId]);
  if (!order) return { ok: false, error: 'Order not found' };
  if (order.character_id !== characterId) {
    return { ok: false, error: 'Order belongs to a different character' };
  }
  if (order.status !== 'pending') {
    return { ok: false, error: `Only pending orders can be cancelled (this one is ${order.status})` };
  }

  await dbRun(
    `UPDATE merchant_orders
     SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [orderId]
  );

  const updated = await dbGet('SELECT * FROM merchant_orders WHERE id = ?', [orderId]);
  return { ok: true, order: updated, deposit_forfeit_cp: order.deposit_paid_cp };
}

/**
 * List all orders for a character (all statuses, most recent first).
 */
export async function listOrdersForCharacter(characterId) {
  return dbAll(
    `SELECT o.*, m.merchant_name
     FROM merchant_orders o
     LEFT JOIN merchant_inventories m ON o.merchant_id = m.id
     WHERE o.character_id = ?
     ORDER BY o.created_at DESC`,
    [characterId]
  );
}

// ============================================================
// Phase 3.3 SC-7.5 — Two-stage merchant-order threshold pipeline
// ============================================================
//
// Two registrations per spec §3.3.5: pending → ready (stage 1, threshold=0
// fires when deadline reached); ready → expired (stage 2, threshold=31
// fires when 31+ days past ready_game_day, matching legacy `> 30`).
// SELECT-pre-filter is the idempotency strategy for both — orchestrator
// only loads orders in the pre-fire status; status flip drops them out
// of subsequent ticks.

const MERCHANT_ORDER_DUE_THRESHOLD_CONSUMER = registerThresholdConsumer({
  name: 'merchant_order_due',
  threshold: 0,
  handler: async (contextKey) => {
    const { order, currentGameDay } = contextKey;
    await dbRun(
      `UPDATE merchant_orders
       SET status = 'ready', ready_game_day = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND status = 'pending'`,
      [currentGameDay, order.id]
    );
    return { ...order, status: 'ready', ready_game_day: currentGameDay };
  },
  idempotency: {
    async hasFiredRecently() { return false; },  // SELECT pre-filters by status='pending'
    async recordFired() {}
  },
  repository: {
    async readAnchor(contextKey) {
      return contextKey.order?.deadline_game_day || null;
    }
  }
});

const MERCHANT_ORDER_EXPIRE_THRESHOLD_CONSUMER = registerThresholdConsumer({
  name: 'merchant_order_expire',
  threshold: 31,  // legacy: `(currentGameDay - ready_game_day) > 30` → 31+ elapsed
  handler: async (contextKey) => {
    const { order } = contextKey;
    await dbRun(
      `UPDATE merchant_orders
       SET status = 'expired', updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND status = 'ready'`,
      [order.id]
    );
    return { ...order, status: 'expired' };
  },
  idempotency: {
    async hasFiredRecently() { return false; },  // SELECT pre-filters by status='ready'
    async recordFired() {}
  },
  repository: {
    async readAnchor(contextKey) {
      return contextKey.order?.ready_game_day || null;
    }
  }
});

/**
 * Mark pending orders as ready when their deadline has been reached.
 * Called from the living-world tick. Returns the list of orders that
 * just flipped status so the caller can hand them to the narrative
 * queue.
 *
 * Phase 3.3 SC-7.5: per-order threshold check delegates to
 * MERCHANT_ORDER_DUE_THRESHOLD_CONSUMER. SELECT pre-filter retained as
 * the idempotency strategy.
 */
export async function processDueOrders(currentGameDay) {
  const due = await dbAll(
    `SELECT o.*, m.merchant_name
     FROM merchant_orders o
     LEFT JOIN merchant_inventories m ON o.merchant_id = m.id
     WHERE o.status = 'pending' AND o.deadline_game_day <= ?`,
    [currentGameDay]
  );

  const becameReady = [];
  for (const order of due) {
    const result = await MERCHANT_ORDER_DUE_THRESHOLD_CONSUMER.checkAndFire(
      { order, currentGameDay },
      currentGameDay
    );
    if (result.fired && result.handlerResult) becameReady.push(result.handlerResult);
  }
  return becameReady;
}

/**
 * Expire ready orders that have sat too long (30 game days post-ready).
 * Merchants don't hold stock forever. Returns expired orders for
 * narrative notification.
 *
 * Phase 3.3 SC-7.5: stage 2 of the two-stage threshold pipeline. Per-order
 * check delegates to MERCHANT_ORDER_EXPIRE_THRESHOLD_CONSUMER (threshold=31,
 * matching legacy's `> 30` strict-greater check).
 *
 * Note: legacy supported a `holdDays` parameter to override the 30-day
 * default. The threshold consumer's threshold is config-time fixed at 31.
 * Production callers (livingWorldService) always use the default; the
 * parameter override is removed in this migration. If a future caller
 * needs a different hold time, register a second consumer with that
 * threshold.
 */
export async function expireStaleReadyOrders(currentGameDay) {
  const stale = await dbAll(
    `SELECT o.*, m.merchant_name
     FROM merchant_orders o
     LEFT JOIN merchant_inventories m ON o.merchant_id = m.id
     WHERE o.status = 'ready' AND o.ready_game_day IS NOT NULL
       AND (? - o.ready_game_day) > 30`,
    [currentGameDay]
  );

  const expired = [];
  for (const order of stale) {
    const result = await MERCHANT_ORDER_EXPIRE_THRESHOLD_CONSUMER.checkAndFire(
      { order, currentGameDay },
      currentGameDay
    );
    if (result.fired && result.handlerResult) expired.push(result.handlerResult);
  }
  return expired;
}

// Exports for direct test access.
export { MERCHANT_ORDER_DUE_THRESHOLD_CONSUMER, MERCHANT_ORDER_EXPIRE_THRESHOLD_CONSUMER };

// ============================================================
// SC-6.4b — MERCHANT_COMMISSION marker handler
// ============================================================

/**
 * MERCHANT_COMMISSION handler — replaces the inline dispatch at the
 * pre-SC-6.4b routes/dmSession.js:1611-1686 site. Per-marker handler
 * (multi-instance markers fire the handler once per instance via the
 * pipeline). Returns a structured result with the success/failure
 * payload + the system note text the route should push to
 * result.messages.
 *
 * Idempotency guard preserved (skip if an active order with the same
 * item name already exists at this merchant for this character — AI
 * may repeat the marker across retries; prevents double-charging).
 *
 * Schema accepts price/deposit in mixed gp/sp/cp denominations per the
 * SC-6.4b schema extension; legacy detect-tolerance preserved.
 */
registerMarkerHandler('MERCHANT_COMMISSION', async (parsed, context) => {
  if (!context?.characterId) return null;
  const character = await dbGet(
    'SELECT campaign_id, game_day FROM characters WHERE id = ?',
    [context.characterId]
  );
  if (!character?.campaign_id) return null;

  let dbMerchant = await getMerchantInventory(character.campaign_id, parsed.Merchant);
  if (!dbMerchant) {
    dbMerchant = await createMerchantOnTheFly(
      character.campaign_id, parsed.Merchant, 'general', null, 1
    );
  }

  // Idempotency: skip if an active order already exists for this item.
  const dupe = await dbGet(
    `SELECT id FROM merchant_orders
     WHERE merchant_id = ? AND character_id = ?
       AND LOWER(item_name) = LOWER(?)
       AND status IN ('pending','ready')
     LIMIT 1`,
    [dbMerchant.id, context.characterId, parsed.Item]
  );
  if (dupe) {
    return {
      type: 'merchant_commission',
      status: 'skipped_duplicate',
      systemNote: `[SYSTEM: MERCHANT_COMMISSION skipped — an order for "${parsed.Item}" at ${parsed.Merchant} is already in progress (order #${dupe.id}). Don't restate the commission.]`
    };
  }

  const quotedCp = (parsed.Price_GP || 0) * 100 + (parsed.Price_SP || 0) * 10 + (parsed.Price_CP || 0);
  const depositCp = (parsed.Deposit_GP || 0) * 100 + (parsed.Deposit_SP || 0) * 10 + (parsed.Deposit_CP || 0);

  const placeResult = await placeCommission({
    merchantId: dbMerchant.id,
    characterId: context.characterId,
    itemName: parsed.Item,
    itemSpec: { quality: parsed.Quality, description: parsed.Description, hook: parsed.Hook },
    quotedPriceCp: quotedCp,
    depositCp,
    leadTimeDays: parsed.Lead_Time_Days,
    currentGameDay: character.game_day || 0,
    narrativeHook: parsed.Hook
  });

  if (!placeResult.ok) {
    return {
      type: 'merchant_commission',
      status: 'failed',
      systemNote: `[SYSTEM: MERCHANT_COMMISSION failed — ${placeResult.error}. Narrate the merchant withdrawing the offer or the player lacking funds. Do NOT tell the player the order was placed.]`
    };
  }

  return {
    type: 'merchant_commission',
    status: 'placed',
    orderId: placeResult.order.id,
    systemNote: `[SYSTEM: Commission recorded. Order #${placeResult.order.id}: ${parsed.Item} from ${parsed.Merchant}, ready in ${parsed.Lead_Time_Days} game days (day ${character.game_day + parsed.Lead_Time_Days}). Deposit: ${Math.ceil(depositCp / 100)} gp. Balance due on pickup: ${Math.ceil((quotedCp - depositCp) / 100)} gp.]`
  };
});
