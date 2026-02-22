/**
 * Chronicle Routes — Story Chronicle API
 *
 * Provides endpoints for viewing session chronicles, canon fact timelines,
 * fact search, and manual fact editing.
 */

import { Router } from 'express';
import { handleServerError, notFound, validationError } from '../utils/errorHandler.js';
import {
  getChroniclesForCampaign,
  getTimelineForCharacter,
  searchFacts,
  recordCanonFact,
  supersedeFact,
  getChronicleStats
} from '../services/storyChronicleService.js';

const router = Router();

// GET /api/chronicle/campaign/:campaignId — All session chronicles for a campaign
router.get('/campaign/:campaignId', async (req, res) => {
  try {
    const { campaignId } = req.params;
    const chronicles = await getChroniclesForCampaign(parseInt(campaignId));

    // Parse JSON fields for each chronicle
    const parsed = chronicles.map(c => ({
      ...c,
      key_decisions: JSON.parse(c.key_decisions || '[]'),
      npcs_involved: JSON.parse(c.npcs_involved || '[]'),
      locations_visited: JSON.parse(c.locations_visited || '[]'),
      quests_progressed: JSON.parse(c.quests_progressed || '[]'),
      combat_encounters: JSON.parse(c.combat_encounters || '[]'),
      items_gained: JSON.parse(c.items_gained || '[]'),
      items_lost: JSON.parse(c.items_lost || '[]'),
      companion_deaths: JSON.parse(c.companion_deaths || '[]')
    }));

    res.json(parsed);
  } catch (error) {
    handleServerError(res, error, 'fetch campaign chronicles');
  }
});

// GET /api/chronicle/timeline/:characterId — Chronological canon facts
router.get('/timeline/:characterId', async (req, res) => {
  try {
    const { characterId } = req.params;
    const { campaignId, category, importance, activeOnly, sessionId, limit } = req.query;

    if (!campaignId) {
      return validationError(res, 'campaignId query parameter is required');
    }

    const filters = {};
    if (category) filters.category = category;
    if (importance) filters.importance = importance;
    if (activeOnly === 'false') filters.activeOnly = false;
    if (sessionId) filters.sessionId = parseInt(sessionId);
    if (limit) filters.limit = parseInt(limit);

    const facts = await getTimelineForCharacter(parseInt(characterId), parseInt(campaignId), filters);
    res.json(facts);
  } catch (error) {
    handleServerError(res, error, 'fetch character timeline');
  }
});

// GET /api/chronicle/search/:campaignId — Search canon facts
router.get('/search/:campaignId', async (req, res) => {
  try {
    const { campaignId } = req.params;
    const { q } = req.query;

    if (!q || q.trim().length === 0) {
      return validationError(res, 'Search query (q) is required');
    }

    const results = await searchFacts(parseInt(campaignId), q.trim());
    res.json(results);
  } catch (error) {
    handleServerError(res, error, 'search canon facts');
  }
});

// GET /api/chronicle/stats/:campaignId/:characterId — Chronicle statistics
router.get('/stats/:campaignId/:characterId', async (req, res) => {
  try {
    const { campaignId, characterId } = req.params;
    const stats = await getChronicleStats(parseInt(campaignId), parseInt(characterId));
    res.json(stats);
  } catch (error) {
    handleServerError(res, error, 'fetch chronicle stats');
  }
});

// POST /api/chronicle/:characterId/fact — Manually add/edit a canon fact
router.post('/:characterId/fact', async (req, res) => {
  try {
    const { characterId } = req.params;
    const { campaignId, category, subject, fact, gameDay, importance, supersedeFactId } = req.body;

    if (!campaignId || !category || !subject || !fact) {
      return validationError(res, 'campaignId, category, subject, and fact are required');
    }

    const validCategories = ['npc', 'location', 'quest', 'item', 'event', 'lore', 'player_choice', 'death', 'promise', 'secret'];
    if (!validCategories.includes(category)) {
      return validationError(res, `category must be one of: ${validCategories.join(', ')}`);
    }

    const validImportance = ['critical', 'major', 'minor', 'flavor'];
    if (importance && !validImportance.includes(importance)) {
      return validationError(res, `importance must be one of: ${validImportance.join(', ')}`);
    }

    // If superseding an existing fact, mark it as inactive
    if (supersedeFactId) {
      await supersedeFact(parseInt(supersedeFactId));
    }

    const factId = await recordCanonFact(
      parseInt(campaignId),
      parseInt(characterId),
      category,
      subject,
      fact,
      null, // No session ID for manual facts
      gameDay ? parseInt(gameDay) : null,
      importance || 'minor'
    );

    // Link the superseded fact to the new one
    if (supersedeFactId && factId) {
      await supersedeFact(parseInt(supersedeFactId), factId);
    }

    res.json({ id: factId, message: 'Canon fact recorded' });
  } catch (error) {
    handleServerError(res, error, 'record canon fact');
  }
});

export default router;
