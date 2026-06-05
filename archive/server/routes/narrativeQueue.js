/**
 * Narrative Queue Routes
 *
 * API endpoints for managing the narrative queue - story events
 * that need to be delivered to players during DM sessions.
 */

import express from 'express';
import * as narrativeQueueService from '../services/narrativeQueueService.js';
import { dbAll } from '../database.js';
import { handleServerError } from '../utils/errorHandler.js';

const router = express.Router();

/**
 * Get pending narrative items for a character
 * GET /api/narrative-queue/:characterId
 */
router.get('/:characterId', async (req, res) => {
  try {
    const { characterId } = req.params;
    const { limit = 20, priority } = req.query;

    let items;
    if (priority) {
      items = await narrativeQueueService.getPendingItemsByPriority(characterId, priority);
    } else {
      items = await narrativeQueueService.getPendingItems(characterId);
    }
    // Apply limit
    items = items.slice(0, parseInt(limit));

    res.json(items);
  } catch (err) {
    handleServerError(res, err, 'fetch narrative queue');
  }
});

/**
 * Get narrative context formatted for AI (DM session use)
 * GET /api/narrative-queue/:characterId/context
 */
router.get('/:characterId/context', async (req, res) => {
  try {
    const { characterId } = req.params;
    const { limit = 10 } = req.query;

    const context = await narrativeQueueService.formatForAIContext(characterId, parseInt(limit));

    res.json(context || { items: [], formatted: null, count: 0 });
  } catch (err) {
    handleServerError(res, err, 'format narrative context');
  }
});

/**
 * Mark items as delivered (after DM session incorporates them)
 * POST /api/narrative-queue/deliver
 */
router.post('/deliver', async (req, res) => {
  try {
    const { item_ids, session_id } = req.body;

    if (!item_ids || !Array.isArray(item_ids)) {
      return res.status(400).json({ error: 'item_ids array is required' });
    }

    const results = [];
    for (const itemId of item_ids) {
      const result = await narrativeQueueService.markDelivered(itemId, session_id);
      results.push(result);
    }

    res.json({ delivered: results.length, items: results });
  } catch (err) {
    handleServerError(res, err, 'mark items delivered');
  }
});

/**
 * Add a manual item to the narrative queue
 * POST /api/narrative-queue
 */
router.post('/', async (req, res) => {
  try {
    const {
      campaign_id,
      character_id,
      event_type,
      priority = 'normal',
      title,
      description,
      context,
      related_quest_id,
      related_location_id,
      related_companion_id,
      expires_at
    } = req.body;

    if (!character_id || !event_type || !title) {
      return res.status(400).json({ error: 'character_id, event_type, and title are required' });
    }

    const item = await narrativeQueueService.addToQueue({
      campaign_id,
      character_id,
      event_type,
      priority,
      title,
      description,
      context,
      related_quest_id,
      related_location_id,
      related_companion_id,
      expires_at
    });

    res.status(201).json(item);
  } catch (err) {
    handleServerError(res, err, 'add to narrative queue');
  }
});

/**
 * Get delivery history for a character
 * GET /api/narrative-queue/:characterId/history
 */
router.get('/:characterId/history', async (req, res) => {
  try {
    const { characterId } = req.params;
    const { limit = 50 } = req.query;

    const history = await narrativeQueueService.getDeliveredItems(characterId, parseInt(limit));

    res.json(history);
  } catch (err) {
    handleServerError(res, err, 'fetch delivery history');
  }
});

/**
 * Delete a pending item (before delivery)
 * DELETE /api/narrative-queue/:itemId
 */
router.delete('/:itemId', async (req, res) => {
  try {
    const { itemId } = req.params;

    await narrativeQueueService.deleteQueueItem(itemId);

    res.json({ success: true });
  } catch (err) {
    handleServerError(res, err, 'delete narrative item');
  }
});

/**
 * Get NPC mail items (delivered + pending) for a character
 * GET /api/narrative-queue/character/:characterId/mail
 */
router.get('/character/:characterId/mail', async (req, res) => {
  try {
    const { characterId } = req.params;
    const { limit = 50 } = req.query;

    // Get both delivered and pending NPC mail items
    const allItems = await dbAll(`
      SELECT * FROM narrative_queue
      WHERE character_id = ? AND event_type LIKE 'npc_%'
      ORDER BY
        CASE status WHEN 'pending' THEN 0 WHEN 'delivered' THEN 1 ELSE 2 END,
        created_at DESC
      LIMIT ?
    `, [characterId, parseInt(limit)]);

    res.json((allItems || []).map(item => ({
      ...item,
      context: JSON.parse(item.context || '{}')
    })));
  } catch (err) {
    handleServerError(res, err, 'fetch NPC mail');
  }
});

export default router;
