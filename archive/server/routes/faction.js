import express from 'express';
import * as factionService from '../services/factionService.js';
import { handleServerError, notFound, validationError } from '../utils/errorHandler.js';

const router = express.Router();

// ============================================================
// FACTION ROUTES
// ============================================================

// GET /api/faction/campaign/:campaignId - Get all factions for a campaign
router.get('/campaign/:campaignId', async (req, res) => {
  try {
    const factions = await factionService.getCampaignFactions(req.params.campaignId);
    res.json(factions);
  } catch (error) {
    handleServerError(res, error, 'fetch factions');
  }
});

// GET /api/faction/campaign/:campaignId/active - Get active factions
router.get('/campaign/:campaignId/active', async (req, res) => {
  try {
    const factions = await factionService.getActiveFactions(req.params.campaignId);
    res.json(factions);
  } catch (error) {
    handleServerError(res, error, 'fetch active factions');
  }
});

// GET /api/faction/:id - Get a specific faction
router.get('/:id', async (req, res) => {
  try {
    const faction = await factionService.getFactionById(req.params.id);
    if (!faction) {
      return notFound(res, 'Faction');
    }
    res.json(faction);
  } catch (error) {
    handleServerError(res, error, 'fetch faction');
  }
});

// POST /api/faction - Create a new faction
router.post('/', async (req, res) => {
  try {
    const { name } = req.body;

    if (!name) {
      return validationError(res, 'Faction name is required');
    }

    const faction = await factionService.createFaction(req.body);
    res.status(201).json(faction);
  } catch (error) {
    handleServerError(res, error, 'create faction');
  }
});

// PUT /api/faction/:id - Update a faction
router.put('/:id', async (req, res) => {
  try {
    const faction = await factionService.updateFaction(req.params.id, req.body);
    if (!faction) {
      return notFound(res, 'Faction');
    }
    res.json(faction);
  } catch (error) {
    handleServerError(res, error, 'update faction');
  }
});

// DELETE /api/faction/:id - Delete a faction
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await factionService.deleteFaction(req.params.id);
    if (!deleted) {
      return notFound(res, 'Faction');
    }
    res.json({ success: true });
  } catch (error) {
    handleServerError(res, error, 'delete faction');
  }
});

// POST /api/faction/:id/relationship - Update relationship with another faction
router.post('/:id/relationship', async (req, res) => {
  try {
    const { target_faction_id, relationship_value } = req.body;

    if (target_faction_id === undefined || relationship_value === undefined) {
      return validationError(res, 'target_faction_id and relationship_value are required');
    }

    const faction = await factionService.updateFactionRelationship(
      req.params.id,
      target_faction_id,
      relationship_value
    );
    if (!faction) {
      return notFound(res, 'Faction');
    }
    res.json(faction);
  } catch (error) {
    handleServerError(res, error, 'update faction relationship');
  }
});

// ============================================================
// FACTION GOAL ROUTES
// ============================================================

// GET /api/faction/:factionId/goals - Get all goals for a faction
router.get('/:factionId/goals', async (req, res) => {
  try {
    const goals = await factionService.getFactionGoals(req.params.factionId);
    res.json(goals);
  } catch (error) {
    handleServerError(res, error, 'fetch faction goals');
  }
});

// GET /api/faction/:factionId/goals/active - Get active goals for a faction
router.get('/:factionId/goals/active', async (req, res) => {
  try {
    const goals = await factionService.getActiveFactionGoals(req.params.factionId);
    res.json(goals);
  } catch (error) {
    handleServerError(res, error, 'fetch active faction goals');
  }
});

// POST /api/faction/:factionId/goals - Create a new goal for a faction
router.post('/:factionId/goals', async (req, res) => {
  try {
    const { title } = req.body;

    if (!title) {
      return validationError(res, 'Goal title is required');
    }

    const goal = await factionService.createFactionGoal({
      ...req.body,
      faction_id: req.params.factionId
    });
    res.status(201).json(goal);
  } catch (error) {
    handleServerError(res, error, 'create faction goal');
  }
});

// GET /api/faction/goal/:id - Get a specific goal
router.get('/goal/:id', async (req, res) => {
  try {
    const goal = await factionService.getFactionGoalById(req.params.id);
    if (!goal) {
      return notFound(res, 'Goal');
    }
    res.json(goal);
  } catch (error) {
    handleServerError(res, error, 'fetch goal');
  }
});

// PUT /api/faction/goal/:id - Update a goal
router.put('/goal/:id', async (req, res) => {
  try {
    const goal = await factionService.updateFactionGoal(req.params.id, req.body);
    if (!goal) {
      return notFound(res, 'Goal');
    }
    res.json(goal);
  } catch (error) {
    handleServerError(res, error, 'update goal');
  }
});

// POST /api/faction/goal/:id/advance - Advance goal progress
router.post('/goal/:id/advance', async (req, res) => {
  try {
    const { amount = 10 } = req.body;
    const goal = await factionService.advanceGoalProgress(req.params.id, amount);
    if (!goal) {
      return notFound(res, 'Goal');
    }
    res.json(goal);
  } catch (error) {
    handleServerError(res, error, 'advance goal');
  }
});

// POST /api/faction/goal/:id/discover - Character discovers a goal
router.post('/goal/:id/discover', async (req, res) => {
  try {
    const { character_id } = req.body;

    if (!character_id) {
      return validationError(res, 'character_id is required');
    }

    const goal = await factionService.discoverGoal(req.params.id, character_id);
    if (!goal) {
      return notFound(res, 'Goal');
    }
    res.json(goal);
  } catch (error) {
    handleServerError(res, error, 'discover goal');
  }
});

// DELETE /api/faction/goal/:id - Delete a goal
router.delete('/goal/:id', async (req, res) => {
  try {
    const deleted = await factionService.deleteFactionGoal(req.params.id);
    if (!deleted) {
      return notFound(res, 'Goal');
    }
    res.json({ success: true });
  } catch (error) {
    handleServerError(res, error, 'delete goal');
  }
});

// ============================================================
// FACTION STANDING ROUTES
// ============================================================

// GET /api/faction/standings/character/:characterId - Get all standings for a character
router.get('/standings/character/:characterId', async (req, res) => {
  try {
    const standings = await factionService.getCharacterStandings(req.params.characterId);
    res.json(standings);
  } catch (error) {
    handleServerError(res, error, 'fetch character standings');
  }
});

// GET /api/faction/:factionId/members - Get all members of a faction
router.get('/:factionId/members', async (req, res) => {
  try {
    const members = await factionService.getFactionMembers(req.params.factionId);
    res.json(members);
  } catch (error) {
    handleServerError(res, error, 'fetch faction members');
  }
});

// GET /api/faction/standing/:characterId/:factionId - Get specific standing
router.get('/standing/:characterId/:factionId', async (req, res) => {
  try {
    const standing = await factionService.getOrCreateStanding(
      req.params.characterId,
      req.params.factionId
    );
    res.json(standing);
  } catch (error) {
    handleServerError(res, error, 'fetch standing');
  }
});

// PUT /api/faction/standing/:characterId/:factionId - Update standing
router.put('/standing/:characterId/:factionId', async (req, res) => {
  try {
    const standing = await factionService.updateStanding(
      req.params.characterId,
      req.params.factionId,
      req.body
    );
    res.json(standing);
  } catch (error) {
    handleServerError(res, error, 'update standing');
  }
});

// POST /api/faction/standing/:characterId/:factionId/modify - Modify standing by amount
router.post('/standing/:characterId/:factionId/modify', async (req, res) => {
  try {
    const { amount, deed } = req.body;

    if (amount === undefined) {
      return validationError(res, 'amount is required');
    }

    const standing = await factionService.modifyStanding(
      req.params.characterId,
      req.params.factionId,
      amount,
      deed
    );
    res.json(standing);
  } catch (error) {
    handleServerError(res, error, 'modify standing');
  }
});

// POST /api/faction/standing/:characterId/:factionId/join - Join a faction
router.post('/standing/:characterId/:factionId/join', async (req, res) => {
  try {
    const { membership_level = 'initiate' } = req.body;
    const standing = await factionService.joinFaction(
      req.params.characterId,
      req.params.factionId,
      membership_level
    );
    res.json(standing);
  } catch (error) {
    handleServerError(res, error, 'join faction');
  }
});

// POST /api/faction/standing/:characterId/:factionId/leave - Leave a faction
router.post('/standing/:characterId/:factionId/leave', async (req, res) => {
  try {
    const standing = await factionService.leaveFaction(
      req.params.characterId,
      req.params.factionId
    );
    res.json(standing);
  } catch (error) {
    handleServerError(res, error, 'leave faction');
  }
});

// ============================================================
// TICK PROCESSING
// ============================================================

// POST /api/faction/tick/:campaignId - Process faction tick
router.post('/tick/:campaignId', async (req, res) => {
  try {
    const { game_days_passed = 1 } = req.body;
    const results = await factionService.processFactionTick(
      req.params.campaignId,
      game_days_passed
    );
    res.json({ success: true, results });
  } catch (error) {
    handleServerError(res, error, 'process faction tick');
  }
});

export default router;
