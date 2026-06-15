/**
 * Mythic Progression Routes
 *
 * API endpoints for mythic tiers, paths, abilities, trials, piety,
 * epic boons, and legendary items.
 */

import express from 'express';
import * as mythicService from '../services/mythicService.js';
import * as pietyService from '../services/pietyService.js';
import {
  MYTHIC_PATHS,
  EPIC_BOONS,
  PIETY_DEITIES,
  getPathInfo,
  getPlayerSelectablePaths,
  getEpicBoon
} from '../config/mythicProgression.js';
import { dbGet } from '../database.js';
import { handleServerError } from '../utils/errorHandler.js';

const router = express.Router();

// ============================================================
// STATIC DATA (no character required)
// ============================================================

/**
 * List all player-selectable mythic paths with metadata
 * GET /api/mythic/paths
 */
router.get('/paths', (req, res) => {
  try {
    const paths = getPlayerSelectablePaths();
    const summary = paths.map(p => ({
      key: p.key,
      name: p.name,
      subtitle: p.subtitle,
      bestSuited: p.bestSuited,
      coreTheme: p.coreTheme,
      definingFeature: p.definingFeature,
      alignmentPreference: p.alignmentPreference
    }));
    res.json(summary);
  } catch (err) {
    handleServerError(res, err, 'fetch mythic paths');
  }
});

/**
 * Get full path detail with all tier abilities
 * GET /api/mythic/paths/:pathKey
 */
router.get('/paths/:pathKey', (req, res) => {
  try {
    const path = getPathInfo(req.params.pathKey);
    if (!path) {
      return res.status(404).json({ error: `Path ${req.params.pathKey} not found` });
    }
    res.json(path);
  } catch (err) {
    handleServerError(res, err, 'fetch path detail');
  }
});

/**
 * List all available epic boons
 * GET /api/mythic/epic-boons
 */
router.get('/epic-boons', (req, res) => {
  try {
    res.json(EPIC_BOONS);
  } catch (err) {
    handleServerError(res, err, 'fetch epic boons');
  }
});

/**
 * List deities with piety data
 * GET /api/mythic/deities
 */
router.get('/deities', (req, res) => {
  try {
    res.json(PIETY_DEITIES);
  } catch (err) {
    handleServerError(res, err, 'fetch deities');
  }
});

// ============================================================
// MYTHIC STATUS
// ============================================================

/**
 * Get full mythic status for a character
 * GET /api/mythic/:characterId
 */
router.get('/:characterId', async (req, res) => {
  try {
    const characterId = parseInt(req.params.characterId);
    const character = await dbGet('SELECT * FROM characters WHERE id = ?', [characterId]);
    if (!character) {
      return res.status(404).json({ error: 'Character not found' });
    }

    const status = await mythicService.getMythicStatus(characterId);
    if (!status) {
      return res.json({ initialized: false, tier: 0, path: null });
    }

    const epicBoons = await mythicService.getEpicBoons(characterId);
    const legendaryItems = await mythicService.getLegendaryItems(characterId);
    const piety = await pietyService.getAllCharacterPiety(characterId);

    res.json({
      initialized: true,
      ...status,
      epicBoons,
      legendaryItems,
      piety
    });
  } catch (err) {
    handleServerError(res, err, 'fetch mythic status');
  }
});

/**
 * Initialize mythic tracking for a character
 * POST /api/mythic/:characterId/initialize
 */
router.post('/:characterId/initialize', async (req, res) => {
  try {
    const characterId = parseInt(req.params.characterId);
    const result = await mythicService.initializeMythic(characterId);
    res.json({ message: 'Mythic tracking initialized', data: result });
  } catch (err) {
    handleServerError(res, err, 'initialize mythic');
  }
});

// ============================================================
// PATH SELECTION
// ============================================================

/**
 * Select a mythic path
 * POST /api/mythic/:characterId/select-path
 * Body: { pathKey, gameDay? }
 */
router.post('/:characterId/select-path', async (req, res) => {
  try {
    const characterId = parseInt(req.params.characterId);
    const { pathKey, gameDay } = req.body;

    if (!pathKey) {
      return res.status(400).json({ error: 'pathKey is required' });
    }

    const status = await mythicService.selectMythicPath(characterId, pathKey, gameDay || null);
    res.json({ message: `Selected mythic path: ${status.pathName}`, data: status });
  } catch (err) {
    if (err.message.includes('Unknown') || err.message.includes('not player-selectable') || err.message.includes('Shadow points')) {
      return res.status(400).json({ error: err.message });
    }
    handleServerError(res, err, 'select mythic path');
  }
});

// ============================================================
// TIER ADVANCEMENT
// ============================================================

/**
 * Advance to next mythic tier
 * POST /api/mythic/:characterId/advance-tier
 * Body: { gameDay? }
 */
router.post('/:characterId/advance-tier', async (req, res) => {
  try {
    const characterId = parseInt(req.params.characterId);
    const { gameDay } = req.body || {};

    const status = await mythicService.advanceTier(characterId, gameDay || null);
    res.json({
      message: `Advanced to Mythic Tier ${status.tier}: ${status.tierName}`,
      data: status
    });
  } catch (err) {
    if (err.message.includes('maximum') || err.message.includes('No mythic record')) {
      return res.status(400).json({ error: err.message });
    }
    handleServerError(res, err, 'advance mythic tier');
  }
});

// ============================================================
// TRIALS
// ============================================================

/**
 * Record a trial completion
 * POST /api/mythic/:characterId/record-trial
 * Body: { name, description, outcome?, pathEffect?, gameDay?, sessionId?, campaignId? }
 */
router.post('/:characterId/record-trial', async (req, res) => {
  try {
    const characterId = parseInt(req.params.characterId);
    const { name, description, outcome, pathEffect, gameDay, sessionId, campaignId } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Trial name is required' });
    }

    const result = await mythicService.recordTrial(characterId, campaignId || null, {
      name, description, outcome, pathEffect, gameDay, sessionId
    });

    res.json({
      message: result.canAdvance
        ? `Trial "${name}" completed! Ready to advance tier (${result.trialsCompleted}/${result.trialsRequired}).`
        : `Trial "${name}" recorded (${result.trialsCompleted}/${result.trialsRequired}).`,
      data: result
    });
  } catch (err) {
    handleServerError(res, err, 'record mythic trial');
  }
});

// ============================================================
// MYTHIC POWER
// ============================================================

/**
 * Spend mythic power
 * POST /api/mythic/:characterId/use-power
 * Body: { amount?, abilityKey? }
 */
router.post('/:characterId/use-power', async (req, res) => {
  try {
    const characterId = parseInt(req.params.characterId);
    const { amount = 1 } = req.body;

    const result = await mythicService.useMythicPower(characterId, amount);
    res.json({ message: `Spent ${amount} mythic power`, data: result });
  } catch (err) {
    if (err.message.includes('Insufficient')) {
      return res.status(400).json({ error: err.message });
    }
    handleServerError(res, err, 'use mythic power');
  }
});

/**
 * Restore mythic power (long rest)
 * POST /api/mythic/:characterId/rest
 */
router.post('/:characterId/rest', async (req, res) => {
  try {
    const characterId = parseInt(req.params.characterId);
    await mythicService.resetMythicPower(characterId);
    const status = await mythicService.getMythicStatus(characterId);
    res.json({ message: 'Mythic power restored', data: status });
  } catch (err) {
    handleServerError(res, err, 'restore mythic power');
  }
});

// ============================================================
// PIETY
// ============================================================

/**
 * Get all deity piety scores for a character
 * GET /api/mythic/piety/:characterId
 */
router.get('/piety/:characterId', async (req, res) => {
  try {
    const characterId = parseInt(req.params.characterId);
    const piety = await pietyService.getAllCharacterPiety(characterId);
    res.json(piety);
  } catch (err) {
    handleServerError(res, err, 'fetch piety');
  }
});

/**
 * Adjust piety for a deity
 * POST /api/mythic/piety/:characterId/adjust
 * Body: { deityName, amount, reason?, gameDay?, sessionId? }
 */
router.post('/piety/:characterId/adjust', async (req, res) => {
  try {
    const characterId = parseInt(req.params.characterId);
    const { deityName, amount, reason, gameDay, sessionId } = req.body;

    if (!deityName || amount === undefined) {
      return res.status(400).json({ error: 'deityName and amount are required' });
    }

    const result = await pietyService.adjustPiety(characterId, deityName, amount, reason, gameDay, sessionId);
    const message = result.thresholdCrossed
      ? `Piety with ${deityName}: ${result.oldScore} → ${result.newScore}. NEW THRESHOLD UNLOCKED at ${result.thresholdCrossed}!`
      : `Piety with ${deityName}: ${result.oldScore} → ${result.newScore}`;

    res.json({ message, data: result });
  } catch (err) {
    handleServerError(res, err, 'adjust piety');
  }
});

/**
 * Initialize piety with a deity
 * POST /api/mythic/piety/:characterId/initialize
 * Body: { deityName, startingScore? }
 */
router.post('/piety/:characterId/initialize', async (req, res) => {
  try {
    const characterId = parseInt(req.params.characterId);
    const { deityName, startingScore } = req.body;

    if (!deityName) {
      return res.status(400).json({ error: 'deityName is required' });
    }

    const result = await pietyService.initializePiety(characterId, deityName, startingScore || 1);
    res.json({ message: `Piety with ${deityName} initialized`, data: result });
  } catch (err) {
    handleServerError(res, err, 'initialize piety');
  }
});

/**
 * Get piety change history
 * GET /api/mythic/piety/:characterId/history?deity=Lathander&limit=50
 */
router.get('/piety/:characterId/history', async (req, res) => {
  try {
    const characterId = parseInt(req.params.characterId);
    const { deity, limit } = req.query;
    const history = await pietyService.getPietyHistory(characterId, deity || null, parseInt(limit) || 50);
    res.json(history);
  } catch (err) {
    handleServerError(res, err, 'fetch piety history');
  }
});

// ============================================================
// EPIC BOONS
// ============================================================

/**
 * Get selected epic boons for a character
 * GET /api/mythic/:characterId/epic-boons
 */
router.get('/:characterId/epic-boons', async (req, res) => {
  try {
    const characterId = parseInt(req.params.characterId);
    const boons = await mythicService.getEpicBoons(characterId);
    res.json(boons);
  } catch (err) {
    handleServerError(res, err, 'fetch epic boons');
  }
});

/**
 * Select an epic boon
 * POST /api/mythic/:characterId/epic-boon
 * Body: { boonKey, abilityScoreBonus?, gameDay? }
 */
router.post('/:characterId/epic-boon', async (req, res) => {
  try {
    const characterId = parseInt(req.params.characterId);
    const { boonKey, abilityScoreBonus, gameDay } = req.body;

    if (!boonKey) {
      return res.status(400).json({ error: 'boonKey is required' });
    }

    const boonInfo = getEpicBoon(boonKey);
    if (!boonInfo) {
      return res.status(400).json({ error: `Unknown epic boon: ${boonKey}` });
    }

    const boons = await mythicService.selectEpicBoon(characterId, boonKey, abilityScoreBonus, gameDay);
    res.json({ message: `Selected epic boon: ${boonInfo.name}`, data: boons });
  } catch (err) {
    if (err.message.includes('already selected')) {
      return res.status(400).json({ error: err.message });
    }
    handleServerError(res, err, 'select epic boon');
  }
});

// ============================================================
// LEGENDARY ITEMS
// ============================================================

/**
 * Get legendary items for a character
 * GET /api/mythic/:characterId/legendary-items
 */
router.get('/:characterId/legendary-items', async (req, res) => {
  try {
    const characterId = parseInt(req.params.characterId);
    const items = await mythicService.getLegendaryItems(characterId);
    res.json(items);
  } catch (err) {
    handleServerError(res, err, 'fetch legendary items');
  }
});

/**
 * Create a legendary item
 * POST /api/mythic/:characterId/legendary-item
 * Body: { itemName, itemBaseType, campaignId?, dormantProperties?, ... }
 */
router.post('/:characterId/legendary-item', async (req, res) => {
  try {
    const characterId = parseInt(req.params.characterId);
    const { itemName, itemBaseType, campaignId, dormantProperties, awakenedProperties, exaltedProperties, mythicProperties, awakenedDeed, exaltedDeed, mythicDeed } = req.body;

    if (!itemName) {
      return res.status(400).json({ error: 'itemName is required' });
    }

    const item = await mythicService.createLegendaryItem({
      characterId, campaignId, itemName, itemBaseType,
      dormantProperties, awakenedProperties, exaltedProperties, mythicProperties,
      awakenedDeed, exaltedDeed, mythicDeed
    });
    res.json({ message: `Created legendary item: ${itemName}`, data: item });
  } catch (err) {
    handleServerError(res, err, 'create legendary item');
  }
});

/**
 * Advance a legendary item's state
 * POST /api/mythic/legendary-item/:itemId/advance
 * Body: { newState, deed, gameDay? }
 */
router.post('/legendary-item/:itemId/advance', async (req, res) => {
  try {
    const itemId = parseInt(req.params.itemId);
    const { newState, deed, gameDay } = req.body;

    if (!newState) {
      return res.status(400).json({ error: 'newState is required' });
    }

    const item = await mythicService.advanceItemState(itemId, newState, deed, gameDay);
    res.json({ message: `Item advanced to ${newState}`, data: item });
  } catch (err) {
    if (err.message.includes('Invalid') || err.message.includes('Cannot regress') || err.message.includes('not found')) {
      return res.status(400).json({ error: err.message });
    }
    handleServerError(res, err, 'advance legendary item');
  }
});

// ============================================================
// SHADOW CONSTRAINTS
// ============================================================

/**
 * Check shadow point constraints for a character's mythic path
 * GET /api/mythic/:characterId/shadow-check
 */
router.get('/:characterId/shadow-check', async (req, res) => {
  try {
    const characterId = parseInt(req.params.characterId);
    const result = await mythicService.checkShadowConstraints(characterId);
    res.json(result);
  } catch (err) {
    handleServerError(res, err, 'check shadow constraints');
  }
});

export default router;
