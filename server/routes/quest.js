import express from 'express';
import * as questService from '../services/questService.js';
import * as questGenerator from '../services/questGenerator.js';
import { dbGet } from '../database.js';

const router = express.Router();

// ============================================================
// QUEST ROUTES
// ============================================================

// GET /api/quest/character/:characterId - Get all quests for a character
router.get('/character/:characterId', async (req, res) => {
  try {
    const quests = await questService.getCharacterQuests(req.params.characterId);
    res.json(quests);
  } catch (error) {
    console.error('Error fetching character quests:', error);
    res.status(500).json({ error: 'Failed to fetch character quests' });
  }
});

// GET /api/quest/character/:characterId/active - Get active quests only
router.get('/character/:characterId/active', async (req, res) => {
  try {
    const quests = await questService.getActiveQuests(req.params.characterId);
    res.json(quests);
  } catch (error) {
    console.error('Error fetching active quests:', error);
    res.status(500).json({ error: 'Failed to fetch active quests' });
  }
});

// GET /api/quest/character/:characterId/main - Get the main quest
router.get('/character/:characterId/main', async (req, res) => {
  try {
    const quest = await questService.getMainQuest(req.params.characterId);
    if (!quest) {
      return res.status(404).json({ error: 'No active main quest found' });
    }
    res.json(quest);
  } catch (error) {
    console.error('Error fetching main quest:', error);
    res.status(500).json({ error: 'Failed to fetch main quest' });
  }
});

// GET /api/quest/character/:characterId/type/:type - Get quests by type
router.get('/character/:characterId/type/:type', async (req, res) => {
  try {
    const validTypes = ['main', 'side', 'companion', 'one_time'];
    if (!validTypes.includes(req.params.type)) {
      return res.status(400).json({ error: `Invalid quest type. Must be one of: ${validTypes.join(', ')}` });
    }

    const quests = await questService.getQuestsByType(req.params.characterId, req.params.type);
    res.json(quests);
  } catch (error) {
    console.error('Error fetching quests by type:', error);
    res.status(500).json({ error: 'Failed to fetch quests by type' });
  }
});

// GET /api/quest/campaign/:campaignId - Get all quests for a campaign
router.get('/campaign/:campaignId', async (req, res) => {
  try {
    const quests = await questService.getCampaignQuests(req.params.campaignId);
    res.json(quests);
  } catch (error) {
    console.error('Error fetching campaign quests:', error);
    res.status(500).json({ error: 'Failed to fetch campaign quests' });
  }
});

// GET /api/quest/:id - Get a specific quest
router.get('/:id', async (req, res) => {
  try {
    const quest = await questService.getQuestById(req.params.id);
    if (!quest) {
      return res.status(404).json({ error: 'Quest not found' });
    }
    res.json(quest);
  } catch (error) {
    console.error('Error fetching quest:', error);
    res.status(500).json({ error: 'Failed to fetch quest' });
  }
});

// GET /api/quest/:id/full - Get a quest with all requirements
router.get('/:id/full', async (req, res) => {
  try {
    const quest = await questService.getQuestWithRequirements(req.params.id);
    if (!quest) {
      return res.status(404).json({ error: 'Quest not found' });
    }
    res.json(quest);
  } catch (error) {
    console.error('Error fetching quest with requirements:', error);
    res.status(500).json({ error: 'Failed to fetch quest with requirements' });
  }
});

// POST /api/quest - Create a new quest
router.post('/', async (req, res) => {
  try {
    const { character_id, title, premise } = req.body;

    if (!character_id || !title || !premise) {
      return res.status(400).json({ error: 'character_id, title, and premise are required' });
    }

    const quest = await questService.createQuest(req.body);
    res.status(201).json(quest);
  } catch (error) {
    console.error('Error creating quest:', error);
    res.status(500).json({ error: 'Failed to create quest' });
  }
});

// PUT /api/quest/:id - Update a quest
router.put('/:id', async (req, res) => {
  try {
    const quest = await questService.updateQuest(req.params.id, req.body);
    if (!quest) {
      return res.status(404).json({ error: 'Quest not found' });
    }
    res.json(quest);
  } catch (error) {
    console.error('Error updating quest:', error);
    res.status(500).json({ error: 'Failed to update quest' });
  }
});

// POST /api/quest/:id/advance - Advance to next stage
router.post('/:id/advance', async (req, res) => {
  try {
    const quest = await questService.advanceQuestStage(req.params.id);
    if (!quest) {
      return res.status(404).json({ error: 'Quest not found' });
    }
    res.json(quest);
  } catch (error) {
    console.error('Error advancing quest stage:', error);
    res.status(500).json({ error: 'Failed to advance quest stage' });
  }
});

// POST /api/quest/:id/complete - Complete a quest
router.post('/:id/complete', async (req, res) => {
  try {
    const quest = await questService.completeQuest(req.params.id);
    if (!quest) {
      return res.status(404).json({ error: 'Quest not found' });
    }
    res.json(quest);
  } catch (error) {
    console.error('Error completing quest:', error);
    res.status(500).json({ error: 'Failed to complete quest' });
  }
});

// POST /api/quest/:id/fail - Fail a quest
router.post('/:id/fail', async (req, res) => {
  try {
    const quest = await questService.failQuest(req.params.id);
    if (!quest) {
      return res.status(404).json({ error: 'Quest not found' });
    }
    res.json(quest);
  } catch (error) {
    console.error('Error failing quest:', error);
    res.status(500).json({ error: 'Failed to fail quest' });
  }
});

// POST /api/quest/:id/abandon - Abandon a quest
router.post('/:id/abandon', async (req, res) => {
  try {
    const quest = await questService.abandonQuest(req.params.id);
    if (!quest) {
      return res.status(404).json({ error: 'Quest not found' });
    }
    res.json(quest);
  } catch (error) {
    console.error('Error abandoning quest:', error);
    res.status(500).json({ error: 'Failed to abandon quest' });
  }
});

// DELETE /api/quest/:id - Delete a quest
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await questService.deleteQuest(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Quest not found' });
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting quest:', error);
    res.status(500).json({ error: 'Failed to delete quest' });
  }
});

// ============================================================
// QUEST REQUIREMENTS ROUTES
// ============================================================

// GET /api/quest/:questId/requirements - Get all requirements for a quest
router.get('/:questId/requirements', async (req, res) => {
  try {
    const requirements = await questService.getQuestRequirements(req.params.questId);
    res.json(requirements);
  } catch (error) {
    console.error('Error fetching quest requirements:', error);
    res.status(500).json({ error: 'Failed to fetch quest requirements' });
  }
});

// GET /api/quest/:questId/requirements/stage/:stageIndex - Get requirements for a specific stage
router.get('/:questId/requirements/stage/:stageIndex', async (req, res) => {
  try {
    const requirements = await questService.getStageRequirements(
      req.params.questId,
      parseInt(req.params.stageIndex)
    );
    res.json(requirements);
  } catch (error) {
    console.error('Error fetching stage requirements:', error);
    res.status(500).json({ error: 'Failed to fetch stage requirements' });
  }
});

// GET /api/quest/:questId/requirements/incomplete - Get incomplete requirements for current stage
router.get('/:questId/requirements/incomplete', async (req, res) => {
  try {
    const quest = await questService.getQuestById(req.params.questId);
    if (!quest) {
      return res.status(404).json({ error: 'Quest not found' });
    }

    const requirements = await questService.getIncompleteStageRequirements(
      req.params.questId,
      quest.current_stage
    );
    res.json(requirements);
  } catch (error) {
    console.error('Error fetching incomplete requirements:', error);
    res.status(500).json({ error: 'Failed to fetch incomplete requirements' });
  }
});

// POST /api/quest/:questId/requirements - Create a new requirement
router.post('/:questId/requirements', async (req, res) => {
  try {
    const { stage_index, requirement_type, description } = req.body;

    if (stage_index === undefined || !requirement_type || !description) {
      return res.status(400).json({
        error: 'stage_index, requirement_type, and description are required'
      });
    }

    const requirement = await questService.createQuestRequirement({
      quest_id: req.params.questId,
      ...req.body
    });
    res.status(201).json(requirement);
  } catch (error) {
    console.error('Error creating quest requirement:', error);
    res.status(500).json({ error: 'Failed to create quest requirement' });
  }
});

// POST /api/quest/:questId/requirements/bulk - Create multiple requirements
router.post('/:questId/requirements/bulk', async (req, res) => {
  try {
    const { requirements } = req.body;

    if (!requirements || !Array.isArray(requirements)) {
      return res.status(400).json({ error: 'requirements array is required' });
    }

    const created = await questService.createQuestRequirements(
      requirements.map(r => ({ quest_id: req.params.questId, ...r }))
    );
    res.status(201).json(created);
  } catch (error) {
    console.error('Error creating quest requirements:', error);
    res.status(500).json({ error: 'Failed to create quest requirements' });
  }
});

// PUT /api/quest/requirement/:id - Update a requirement
router.put('/requirement/:id', async (req, res) => {
  try {
    const requirement = await questService.updateQuestRequirement(req.params.id, req.body);
    if (!requirement) {
      return res.status(404).json({ error: 'Requirement not found' });
    }
    res.json(requirement);
  } catch (error) {
    console.error('Error updating requirement:', error);
    res.status(500).json({ error: 'Failed to update requirement' });
  }
});

// POST /api/quest/requirement/:id/complete - Mark a requirement as complete
router.post('/requirement/:id/complete', async (req, res) => {
  try {
    const { completed_by } = req.body;
    const requirement = await questService.completeRequirement(req.params.id, completed_by);
    if (!requirement) {
      return res.status(404).json({ error: 'Requirement not found' });
    }
    res.json(requirement);
  } catch (error) {
    console.error('Error completing requirement:', error);
    res.status(500).json({ error: 'Failed to complete requirement' });
  }
});

// DELETE /api/quest/requirement/:id - Delete a requirement
router.delete('/requirement/:id', async (req, res) => {
  try {
    const deleted = await questService.deleteQuestRequirement(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Requirement not found' });
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting requirement:', error);
    res.status(500).json({ error: 'Failed to delete requirement' });
  }
});

// GET /api/quest/:questId/stage-complete - Check if current stage is complete
router.get('/:questId/stage-complete', async (req, res) => {
  try {
    const quest = await questService.getQuestById(req.params.questId);
    if (!quest) {
      return res.status(404).json({ error: 'Quest not found' });
    }

    const isComplete = await questService.isStageComplete(req.params.questId, quest.current_stage);
    res.json({ complete: isComplete, stage: quest.current_stage });
  } catch (error) {
    console.error('Error checking stage completion:', error);
    res.status(500).json({ error: 'Failed to check stage completion' });
  }
});

// ============================================================
// QUEST GENERATION ROUTES
// ============================================================

// POST /api/quest/generate/main - Generate a main quest
router.post('/generate/main', async (req, res) => {
  try {
    const { character_id, campaign_id, theme, antagonist_type, setting } = req.body;

    if (!character_id) {
      return res.status(400).json({ error: 'character_id is required' });
    }

    const character = await dbGet('SELECT * FROM characters WHERE id = ?', [character_id]);
    if (!character) {
      return res.status(404).json({ error: 'Character not found' });
    }

    const campaign = campaign_id
      ? await dbGet('SELECT * FROM campaigns WHERE id = ?', [campaign_id])
      : null;

    const generated = await questGenerator.generateMainQuest({
      character,
      campaign,
      theme,
      antagonist_type,
      setting
    });

    // Create the quest and requirements in the database
    const quest = await questService.createQuest({
      ...generated.quest,
      character_id,
      campaign_id: campaign_id || character.campaign_id
    });

    // Create requirements for each stage
    for (const req of generated.requirements) {
      await questService.createQuestRequirement({
        quest_id: quest.id,
        ...req
      });
    }

    const fullQuest = await questService.getQuestWithRequirements(quest.id);
    res.status(201).json(fullQuest);
  } catch (error) {
    console.error('Error generating main quest:', error);
    res.status(500).json({ error: 'Failed to generate main quest' });
  }
});

// POST /api/quest/generate/side - Generate a side quest
router.post('/generate/side', async (req, res) => {
  try {
    const { character_id, campaign_id, theme, location, hook_type } = req.body;

    if (!character_id) {
      return res.status(400).json({ error: 'character_id is required' });
    }

    const character = await dbGet('SELECT * FROM characters WHERE id = ?', [character_id]);
    if (!character) {
      return res.status(404).json({ error: 'Character not found' });
    }

    const campaign = campaign_id
      ? await dbGet('SELECT * FROM campaigns WHERE id = ?', [campaign_id])
      : null;

    const generated = await questGenerator.generateSideQuest({
      character,
      campaign,
      theme,
      location,
      hook_type
    });

    const quest = await questService.createQuest({
      ...generated.quest,
      character_id,
      campaign_id: campaign_id || character.campaign_id
    });

    for (const req of generated.requirements) {
      await questService.createQuestRequirement({
        quest_id: quest.id,
        ...req
      });
    }

    const fullQuest = await questService.getQuestWithRequirements(quest.id);
    res.status(201).json(fullQuest);
  } catch (error) {
    console.error('Error generating side quest:', error);
    res.status(500).json({ error: 'Failed to generate side quest' });
  }
});

// POST /api/quest/generate/one-time - Generate a one-time quest
router.post('/generate/one-time', async (req, res) => {
  try {
    const { character_id, campaign_id, quest_type, location } = req.body;

    if (!character_id) {
      return res.status(400).json({ error: 'character_id is required' });
    }

    const validTypes = ['bounty', 'rescue', 'delivery', 'retrieval', 'exploration'];
    if (quest_type && !validTypes.includes(quest_type)) {
      return res.status(400).json({ error: `quest_type must be one of: ${validTypes.join(', ')}` });
    }

    const character = await dbGet('SELECT * FROM characters WHERE id = ?', [character_id]);
    if (!character) {
      return res.status(404).json({ error: 'Character not found' });
    }

    let locationData = null;
    if (location) {
      locationData = typeof location === 'object' ? location : { name: location };
    }

    const generated = await questGenerator.generateOneTimeQuest({
      character,
      questType: quest_type,
      location: locationData
    });

    const quest = await questService.createQuest({
      ...generated.quest,
      character_id,
      campaign_id: campaign_id || character.campaign_id
    });

    for (const req of generated.requirements) {
      await questService.createQuestRequirement({
        quest_id: quest.id,
        ...req
      });
    }

    const fullQuest = await questService.getQuestWithRequirements(quest.id);
    res.status(201).json(fullQuest);
  } catch (error) {
    console.error('Error generating one-time quest:', error);
    res.status(500).json({ error: 'Failed to generate one-time quest' });
  }
});

// POST /api/quest/generate/companion - Generate a companion quest
router.post('/generate/companion', async (req, res) => {
  try {
    const { character_id, companion_id, thread_id } = req.body;

    if (!character_id || !companion_id) {
      return res.status(400).json({ error: 'character_id and companion_id are required' });
    }

    const character = await dbGet('SELECT * FROM characters WHERE id = ?', [character_id]);
    if (!character) {
      return res.status(404).json({ error: 'Character not found' });
    }

    const companion = await dbGet('SELECT * FROM companions WHERE id = ?', [companion_id]);
    if (!companion) {
      return res.status(404).json({ error: 'Companion not found' });
    }

    // Get backstory if exists
    const backstory = await dbGet('SELECT * FROM companion_backstories WHERE companion_id = ?', [companion_id]);

    // Find the specific thread if provided, or pick the first active one
    let thread = null;
    if (backstory && backstory.unresolved_threads) {
      const threads = JSON.parse(backstory.unresolved_threads);
      if (thread_id) {
        thread = threads.find(t => t.id === thread_id);
      } else {
        thread = threads.find(t => t.status === 'active') || threads[0];
      }
    }

    const generated = await questGenerator.generateCompanionQuest({
      companion,
      character,
      backstory,
      thread
    });

    const quest = await questService.createQuest({
      ...generated.quest,
      character_id,
      campaign_id: character.campaign_id
    });

    for (const req of generated.requirements) {
      await questService.createQuestRequirement({
        quest_id: quest.id,
        ...req
      });
    }

    const fullQuest = await questService.getQuestWithRequirements(quest.id);
    res.status(201).json(fullQuest);
  } catch (error) {
    console.error('Error generating companion quest:', error);
    res.status(500).json({ error: 'Failed to generate companion quest' });
  }
});

export default router;
