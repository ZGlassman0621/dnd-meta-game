/**
 * Living World Routes - Dynamic World Simulation API
 *
 * Provides endpoints for:
 * - Manual tick processing
 * - World state queries
 * - AI content generation for factions and events
 */

import express from 'express';
import {
  processLivingWorldTick,
  getWorldState,
  getCharacterWorldView
} from '../services/livingWorldService.js';
import {
  generateFactionGoal,
  generateFactionGoals,
  generateWorldEvent,
  generateFactionTriggeredEvent
} from '../services/livingWorldGenerator.js';
import * as factionService from '../services/factionService.js';
import * as worldEventService from '../services/worldEventService.js';
import { dbGet } from '../database.js';

const router = express.Router();

// ============================================================
// TICK PROCESSING
// ============================================================

/**
 * POST /api/living-world/tick/:campaignId
 * Manually trigger a living world tick for a campaign
 * Advances faction goals and world events
 */
router.post('/tick/:campaignId', async (req, res) => {
  try {
    const { days = 1 } = req.body;
    const results = await processLivingWorldTick(req.params.campaignId, days);
    res.json({
      message: `Living world tick processed for ${days} day(s)`,
      ...results
    });
  } catch (error) {
    console.error('Error processing living world tick:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// WORLD STATE QUERIES
// ============================================================

/**
 * GET /api/living-world/state/:campaignId
 * Get comprehensive world state for a campaign
 */
router.get('/state/:campaignId', async (req, res) => {
  try {
    const state = await getWorldState(req.params.campaignId);
    res.json(state);
  } catch (error) {
    console.error('Error getting world state:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/living-world/character-view/:characterId
 * Get world state visible to a specific character
 */
router.get('/character-view/:characterId', async (req, res) => {
  try {
    const view = await getCharacterWorldView(req.params.characterId);
    if (!view) {
      return res.status(404).json({ error: 'Character not found or has no campaign' });
    }
    res.json(view);
  } catch (error) {
    console.error('Error getting character world view:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// FACTION GOAL GENERATION
// ============================================================

/**
 * POST /api/living-world/generate/faction-goal/:factionId
 * Generate a new goal for a faction using AI
 */
router.post('/generate/faction-goal/:factionId', async (req, res) => {
  try {
    const faction = await factionService.getFactionById(req.params.factionId);
    if (!faction) {
      return res.status(404).json({ error: 'Faction not found' });
    }

    // Get other factions in the campaign
    const otherFactions = await factionService.getCampaignFactions(faction.campaign_id);

    // Get existing goals
    const existingGoals = await factionService.getFactionGoals(faction.id);

    // Get campaign info
    const campaign = await dbGet('SELECT * FROM campaigns WHERE id = ?', [faction.campaign_id]);

    const goalData = await generateFactionGoal({
      faction,
      campaign,
      otherFactions,
      existingGoals
    });

    // Option to auto-create the goal
    const { autoCreate = false } = req.body;
    if (autoCreate) {
      const created = await factionService.createFactionGoal(goalData);
      res.status(201).json({
        message: 'Faction goal generated and created',
        goal: created,
        generated: goalData
      });
    } else {
      res.json({
        message: 'Faction goal generated (not saved)',
        generated: goalData
      });
    }
  } catch (error) {
    console.error('Error generating faction goal:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/living-world/generate/faction-goals/:factionId
 * Generate multiple goals for a faction using AI
 */
router.post('/generate/faction-goals/:factionId', async (req, res) => {
  try {
    const { count = 2, autoCreate = false } = req.body;

    const faction = await factionService.getFactionById(req.params.factionId);
    if (!faction) {
      return res.status(404).json({ error: 'Faction not found' });
    }

    const otherFactions = await factionService.getCampaignFactions(faction.campaign_id);
    const existingGoals = await factionService.getFactionGoals(faction.id);
    const campaign = await dbGet('SELECT * FROM campaigns WHERE id = ?', [faction.campaign_id]);

    const generatedGoals = await generateFactionGoals({
      faction,
      campaign,
      otherFactions,
      existingGoals
    }, count);

    const results = { generated: generatedGoals, created: [] };

    if (autoCreate) {
      for (const goalData of generatedGoals) {
        const created = await factionService.createFactionGoal(goalData);
        results.created.push(created);
      }
    }

    res.status(autoCreate ? 201 : 200).json({
      message: `Generated ${generatedGoals.length} faction goals${autoCreate ? ' and created them' : ''}`,
      ...results
    });
  } catch (error) {
    console.error('Error generating faction goals:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// WORLD EVENT GENERATION
// ============================================================

/**
 * POST /api/living-world/generate/world-event/:campaignId
 * Generate a new world event using AI
 */
router.post('/generate/world-event/:campaignId', async (req, res) => {
  try {
    const { eventType, autoCreate = false } = req.body;

    const campaign = await dbGet('SELECT * FROM campaigns WHERE id = ?', [req.params.campaignId]);
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    // Get active factions and events
    const factions = await factionService.getActiveFactions(req.params.campaignId);
    const activeEvents = await worldEventService.getActiveEvents(req.params.campaignId);

    const eventData = await generateWorldEvent({
      campaign,
      factions,
      activeEvents,
      eventType
    });

    if (autoCreate) {
      const created = await worldEventService.createWorldEvent(eventData);

      // Create suggested effects if any
      if (eventData._suggested_effects?.length > 0) {
        for (const effectData of eventData._suggested_effects) {
          await worldEventService.createEventEffect({
            event_id: created.id,
            ...effectData
          });
        }
      }

      res.status(201).json({
        message: 'World event generated and created',
        event: created,
        generated: eventData
      });
    } else {
      res.json({
        message: 'World event generated (not saved)',
        generated: eventData
      });
    }
  } catch (error) {
    console.error('Error generating world event:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/living-world/generate/faction-event/:factionId/:goalId
 * Generate a world event triggered by a faction's goal progress
 */
router.post('/generate/faction-event/:factionId/:goalId', async (req, res) => {
  try {
    const { autoCreate = false } = req.body;

    const faction = await factionService.getFactionById(req.params.factionId);
    if (!faction) {
      return res.status(404).json({ error: 'Faction not found' });
    }

    const goal = await factionService.getFactionGoalById(req.params.goalId);
    if (!goal) {
      return res.status(404).json({ error: 'Goal not found' });
    }

    const campaign = await dbGet('SELECT * FROM campaigns WHERE id = ?', [faction.campaign_id]);

    const eventData = await generateFactionTriggeredEvent({
      faction,
      goal,
      campaign
    });

    if (autoCreate) {
      const created = await worldEventService.createWorldEvent({
        ...eventData,
        triggered_by_faction_id: faction.id
      });
      res.status(201).json({
        message: 'Faction-triggered event generated and created',
        event: created,
        generated: eventData
      });
    } else {
      res.json({
        message: 'Faction-triggered event generated (not saved)',
        generated: eventData
      });
    }
  } catch (error) {
    console.error('Error generating faction-triggered event:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// SIMULATION
// ============================================================

/**
 * POST /api/living-world/simulate/:campaignId
 * Simulate multiple days of world progression
 * Useful for time skips or "what if" scenarios
 */
router.post('/simulate/:campaignId', async (req, res) => {
  try {
    const { days = 7, dryRun = false } = req.body;

    if (days > 30) {
      return res.status(400).json({ error: 'Cannot simulate more than 30 days at once' });
    }

    const allResults = [];

    for (let day = 1; day <= days; day++) {
      const dayResult = await processLivingWorldTick(req.params.campaignId, 1);
      allResults.push({
        day,
        ...dayResult
      });
    }

    // Summary statistics
    const summary = {
      total_days: days,
      goals_advanced: allResults.reduce((sum, r) => sum + r.faction_results.length, 0),
      goals_completed: allResults.flatMap(r => r.faction_results).filter(g => g.completed).length,
      events_spawned: allResults.reduce((sum, r) => sum + r.spawned_events.length, 0),
      events_advanced: allResults.flatMap(r => r.event_results).filter(e => e.type === 'event_stage_advanced').length,
      effects_expired: allResults.reduce((sum, r) => sum + r.effects_expired, 0)
    };

    res.json({
      message: `Simulated ${days} days of world progression`,
      summary,
      daily_results: allResults
    });
  } catch (error) {
    console.error('Error simulating world:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
