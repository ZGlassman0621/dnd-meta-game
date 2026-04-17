/**
 * Merchant Order Service (M2)
 *
 * Custom-order business logic: commissioning, collecting, cancelling,
 * ready-polling, and narrative queue hand-off. Kept out of the HTTP
 * route layer so living-world tick can invoke the same helpers.
 */

import { dbAll, dbGet, dbRun } from '../database.js';
import { safeParse } from '../utils/safeParse.js';

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

/**
 * Mark pending orders as ready when their deadline has been reached.
 * Called from the living-world tick. Returns the list of orders that
 * just flipped status so the caller can hand them to the narrative
 * queue.
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
    await dbRun(
      `UPDATE merchant_orders
       SET status = 'ready', ready_game_day = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND status = 'pending'`,
      [currentGameDay, order.id]
    );
    becameReady.push({ ...order, status: 'ready', ready_game_day: currentGameDay });
  }
  return becameReady;
}

/**
 * Expire ready orders that have sat too long (30 game days post-ready).
 * Merchants don't hold stock forever. Returns expired orders for
 * narrative notification.
 */
export async function expireStaleReadyOrders(currentGameDay, holdDays = 30) {
  const stale = await dbAll(
    `SELECT o.*, m.merchant_name
     FROM merchant_orders o
     LEFT JOIN merchant_inventories m ON o.merchant_id = m.id
     WHERE o.status = 'ready' AND o.ready_game_day IS NOT NULL
       AND (? - o.ready_game_day) > ?`,
    [currentGameDay, holdDays]
  );

  const expired = [];
  for (const order of stale) {
    await dbRun(
      `UPDATE merchant_orders
       SET status = 'expired', updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND status = 'ready'`,
      [order.id]
    );
    expired.push({ ...order, status: 'expired' });
  }
  return expired;
}
