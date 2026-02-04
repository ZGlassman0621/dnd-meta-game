import express from 'express';
import * as campaignService from '../services/campaignService.js';

const router = express.Router();

// GET /api/campaign - Get all campaigns
router.get('/', async (req, res) => {
  try {
    const campaigns = await campaignService.getAllCampaigns();
    res.json(campaigns);
  } catch (error) {
    console.error('Error fetching campaigns:', error);
    res.status(500).json({ error: 'Failed to fetch campaigns' });
  }
});

// GET /api/campaign/active - Get active campaigns only
router.get('/active', async (req, res) => {
  try {
    const campaigns = await campaignService.getActiveCampaigns();
    res.json(campaigns);
  } catch (error) {
    console.error('Error fetching active campaigns:', error);
    res.status(500).json({ error: 'Failed to fetch active campaigns' });
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
    console.error('Error fetching campaign:', error);
    res.status(500).json({ error: 'Failed to fetch campaign' });
  }
});

// GET /api/campaign/:id/stats - Get campaign statistics
router.get('/:id/stats', async (req, res) => {
  try {
    const stats = await campaignService.getCampaignStats(req.params.id);
    res.json(stats);
  } catch (error) {
    console.error('Error fetching campaign stats:', error);
    res.status(500).json({ error: 'Failed to fetch campaign stats' });
  }
});

// GET /api/campaign/:id/characters - Get all characters in a campaign
router.get('/:id/characters', async (req, res) => {
  try {
    const characters = await campaignService.getCampaignCharacters(req.params.id);
    res.json(characters);
  } catch (error) {
    console.error('Error fetching campaign characters:', error);
    res.status(500).json({ error: 'Failed to fetch campaign characters' });
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
    console.error('Error creating campaign:', error);
    res.status(500).json({ error: 'Failed to create campaign' });
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
    console.error('Error updating campaign:', error);
    res.status(500).json({ error: 'Failed to update campaign' });
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
    console.error('Error archiving campaign:', error);
    res.status(500).json({ error: 'Failed to archive campaign' });
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
    console.error('Error assigning character to campaign:', error);
    res.status(500).json({ error: 'Failed to assign character to campaign' });
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
    console.error('Error deleting campaign:', error);
    res.status(500).json({ error: 'Failed to delete campaign' });
  }
});

export default router;
