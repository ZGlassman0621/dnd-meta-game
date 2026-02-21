import express from 'express';
import * as campaignService from '../services/campaignService.js';
import * as campaignPlanService from '../services/campaignPlanService.js';
import { validateImportPayload, importCampaign, normalizePlan } from '../services/campaignImportService.js';
import { handleServerError } from '../utils/errorHandler.js';

const router = express.Router();

// GET /api/campaign - Get all campaigns
router.get('/', async (req, res) => {
  try {
    const campaigns = await campaignService.getAllCampaigns();
    res.json(campaigns);
  } catch (error) {
    handleServerError(res, error, 'fetch campaigns');
  }
});

// GET /api/campaign/active - Get active campaigns only
router.get('/active', async (req, res) => {
  try {
    const campaigns = await campaignService.getActiveCampaigns();
    res.json(campaigns);
  } catch (error) {
    handleServerError(res, error, 'fetch active campaigns');
  }
});

// GET /api/campaign/:id - Get a specific campaign
router.get('/:id', async (req, res) => {
  try {
    const campaign = await campaignService.getCampaignById(req.params.id);
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }
    res.json(campaign);
  } catch (error) {
    handleServerError(res, error, 'fetch campaign');
  }
});

// GET /api/campaign/:id/stats - Get campaign statistics
router.get('/:id/stats', async (req, res) => {
  try {
    const stats = await campaignService.getCampaignStats(req.params.id);
    res.json(stats);
  } catch (error) {
    handleServerError(res, error, 'fetch campaign stats');
  }
});

// GET /api/campaign/:id/characters - Get all characters in a campaign
router.get('/:id/characters', async (req, res) => {
  try {
    const characters = await campaignService.getCampaignCharacters(req.params.id);
    res.json(characters);
  } catch (error) {
    handleServerError(res, error, 'fetch campaign characters');
  }
});

// POST /api/campaign - Create a new campaign
router.post('/', async (req, res) => {
  try {
    const { name, description, setting, tone, starting_location, time_ratio } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Campaign name is required' });
    }

    const campaign = await campaignService.createCampaign({
      name,
      description,
      setting,
      tone,
      starting_location,
      time_ratio
    });

    res.status(201).json(campaign);
  } catch (error) {
    handleServerError(res, error, 'create campaign');
  }
});

// POST /api/campaign/import - Import a complete campaign from JSON
router.post('/import', async (req, res) => {
  try {
    // Normalize plan field names before validation (maps alternatives like main_story → main_quest)
    if (req.body.campaign_plan) {
      req.body.campaign_plan = normalizePlan(req.body.campaign_plan);
    }
    const validation = validateImportPayload(req.body);
    if (!validation.valid) {
      return res.status(400).json({
        error: 'Invalid import payload',
        details: validation.errors
      });
    }

    const result = await importCampaign(req.body);
    const campaign = await campaignService.getCampaignById(result.campaignId);

    res.status(201).json({
      success: true,
      campaign,
      characterId: result.characterId,
      sessionsCreated: result.sessionsCreated,
      companionsCreated: result.companionsCreated,
      questsCreated: result.questsCreated || 0
    });
  } catch (error) {
    handleServerError(res, error, 'import campaign');
  }
});

// PUT /api/campaign/:id - Update a campaign
router.put('/:id', async (req, res) => {
  try {
    const campaign = await campaignService.updateCampaign(req.params.id, req.body);
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }
    res.json(campaign);
  } catch (error) {
    handleServerError(res, error, 'update campaign');
  }
});

// POST /api/campaign/:id/archive - Archive a campaign
router.post('/:id/archive', async (req, res) => {
  try {
    const campaign = await campaignService.archiveCampaign(req.params.id);
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }
    res.json(campaign);
  } catch (error) {
    handleServerError(res, error, 'archive campaign');
  }
});

// POST /api/campaign/:id/assign-character - Assign a character to this campaign
router.post('/:id/assign-character', async (req, res) => {
  try {
    const { character_id } = req.body;

    if (!character_id) {
      return res.status(400).json({ error: 'character_id is required' });
    }

    const character = await campaignService.assignCharacterToCampaign(character_id, req.params.id);
    if (!character) {
      return res.status(404).json({ error: 'Character not found' });
    }

    res.json(character);
  } catch (error) {
    handleServerError(res, error, 'assign character to campaign');
  }
});

// DELETE /api/campaign/:id - Delete a campaign (hard delete)
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await campaignService.deleteCampaign(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Campaign not found' });
    }
    res.json({ success: true });
  } catch (error) {
    handleServerError(res, error, 'delete campaign');
  }
});

// ============================================================
// CAMPAIGN PLAN ENDPOINTS
// ============================================================

// GET /api/campaign/:id/plan - Get the campaign plan
router.get('/:id/plan', async (req, res) => {
  try {
    const plan = await campaignPlanService.getCampaignPlan(req.params.id);
    res.json(plan);
  } catch (error) {
    handleServerError(res, error, 'fetch campaign plan');
  }
});

// POST /api/campaign/:id/plan/generate - Generate a new campaign plan with Opus
router.post('/:id/plan/generate', async (req, res) => {
  try {
    const { character_id } = req.body;

    if (!character_id) {
      return res.status(400).json({ error: 'character_id is required' });
    }

    const plan = await campaignPlanService.generateCampaignPlan(req.params.id, character_id);
    res.json(plan);
  } catch (error) {
    handleServerError(res, error, 'generate campaign plan');
  }
});

// GET /api/campaign/:id/plan/summary - Get plan summary for DM session context
router.get('/:id/plan/summary', async (req, res) => {
  try {
    const summary = await campaignPlanService.getPlanSummaryForSession(req.params.id);
    res.json(summary);
  } catch (error) {
    handleServerError(res, error, 'fetch plan summary');
  }
});

// PUT /api/campaign/:id/plan/:section - Update a section of the campaign plan
router.put('/:id/plan/:section', async (req, res) => {
  try {
    const plan = await campaignPlanService.updatePlanSection(
      req.params.id,
      req.params.section,
      req.body
    );
    res.json(plan);
  } catch (error) {
    handleServerError(res, error, 'update plan section');
  }
});

// POST /api/campaign/:id/plan/world-event - Add a world event
router.post('/:id/plan/world-event', async (req, res) => {
  try {
    const plan = await campaignPlanService.addWorldEvent(req.params.id, req.body);
    res.json(plan);
  } catch (error) {
    handleServerError(res, error, 'add world event');
  }
});

// POST /api/campaign/:id/plan/npc - Add an NPC to the plan
router.post('/:id/plan/npc', async (req, res) => {
  try {
    const plan = await campaignPlanService.addNPC(req.params.id, req.body);
    res.json(plan);
  } catch (error) {
    handleServerError(res, error, 'add NPC');
  }
});

export default router;
