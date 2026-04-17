/**
 * Merchant routes — currently just the commission/order endpoints (M2).
 * Merchant inventory + transaction endpoints still live in dmSession.js;
 * this file hosts the order-lifecycle endpoints because they operate
 * outside of an active session (you can place / pick up an order at any
 * merchant visit, not just inside a DM-session merchant-shop marker flow).
 */

import express from 'express';
import { dbGet } from '../database.js';
import { handleServerError } from '../utils/errorHandler.js';
import {
  placeCommission,
  collectOrder,
  cancelOrder,
  listOrdersForCharacter
} from '../services/merchantOrderService.js';

const router = express.Router();

// Place a commission with a merchant.
// Body: {
//   characterId, itemName, itemSpec?,
//   quotedPriceGp?, quotedPriceSp?, quotedPriceCp?,   (at least one > 0)
//   depositGp?, depositSp?, depositCp?,
//   leadTimeDays, narrativeHook?
// }
// Passing gp/sp/cp separately is just UI ergonomics — the service uses cp
// internally.
router.post('/:merchantId/commission', async (req, res) => {
  try {
    const {
      characterId,
      itemName,
      itemSpec,
      quotedPriceGp = 0,
      quotedPriceSp = 0,
      quotedPriceCp = 0,
      depositGp = 0,
      depositSp = 0,
      depositCp = 0,
      leadTimeDays,
      narrativeHook,
      currentGameDay = 0
    } = req.body || {};

    const totalQuotedCp = (quotedPriceGp || 0) * 100 + (quotedPriceSp || 0) * 10 + (quotedPriceCp || 0);
    const totalDepositCp = (depositGp || 0) * 100 + (depositSp || 0) * 10 + (depositCp || 0);

    const result = await placeCommission({
      merchantId: Number(req.params.merchantId),
      characterId: Number(characterId),
      itemName,
      itemSpec,
      quotedPriceCp: totalQuotedCp,
      depositCp: totalDepositCp,
      leadTimeDays: Number(leadTimeDays),
      currentGameDay: Number(currentGameDay) || 0,
      narrativeHook
    });

    if (!result.ok) return res.status(400).json({ error: result.error });
    res.status(201).json({ order: result.order });
  } catch (error) {
    handleServerError(res, error, 'place merchant commission');
  }
});

// List all orders for a character (any status, most recent first)
router.get('/orders/character/:characterId', async (req, res) => {
  try {
    const orders = await listOrdersForCharacter(Number(req.params.characterId));
    res.json({ orders });
  } catch (error) {
    handleServerError(res, error, 'list character orders');
  }
});

// Fetch a single order
router.get('/orders/:orderId', async (req, res) => {
  try {
    const order = await dbGet(
      `SELECT o.*, m.merchant_name
       FROM merchant_orders o
       LEFT JOIN merchant_inventories m ON o.merchant_id = m.id
       WHERE o.id = ?`,
      [Number(req.params.orderId)]
    );
    if (!order) return res.status(404).json({ error: 'Order not found' });
    res.json({ order });
  } catch (error) {
    handleServerError(res, error, 'get order');
  }
});

// Collect a ready order — pays the balance, puts item into party inventory
router.post('/orders/:orderId/collect', async (req, res) => {
  try {
    const { characterId } = req.body || {};
    if (!characterId) return res.status(400).json({ error: 'characterId is required' });

    const result = await collectOrder(Number(req.params.orderId), Number(characterId));
    if (!result.ok) return res.status(400).json({ error: result.error });
    res.json(result);
  } catch (error) {
    handleServerError(res, error, 'collect order');
  }
});

// Cancel a pending order (deposit forfeit)
router.post('/orders/:orderId/cancel', async (req, res) => {
  try {
    const { characterId } = req.body || {};
    if (!characterId) return res.status(400).json({ error: 'characterId is required' });

    const result = await cancelOrder(Number(req.params.orderId), Number(characterId));
    if (!result.ok) return res.status(400).json({ error: result.error });
    res.json(result);
  } catch (error) {
    handleServerError(res, error, 'cancel order');
  }
});

export default router;
