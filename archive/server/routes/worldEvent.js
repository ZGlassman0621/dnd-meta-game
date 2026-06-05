import express from 'express';
import * as worldEventService from '../services/worldEventService.js';
import { handleServerError } from '../utils/errorHandler.js';

const router = express.Router();

// ============================================================
// WORLD EVENT ROUTES
// ============================================================

// GET /api/world-event/campaign/:campaignId - Get all events for a campaign
router.get('/campaign/:campaignId', async (req, res) => {
  try {
    const events = await worldEventService.getCampaignEvents(req.params.campaignId);
    res.json(events);
  } catch (error) {
    handleServerError(res, error, 'fetch campaign events');
  }
});

// GET /api/world-event/campaign/:campaignId/active - Get active events
router.get('/campaign/:campaignId/active', async (req, res) => {
  try {
    const events = await worldEventService.getActiveEvents(req.params.campaignId);
    res.json(events);
  } catch (error) {
    handleServerError(res, error, 'fetch active events');
  }
});

// GET /api/world-event/campaign/:campaignId/type/:eventType - Get events by type
router.get('/campaign/:campaignId/type/:eventType', async (req, res) => {
  try {
    const events = await worldEventService.getEventsByType(
      req.params.campaignId,
      req.params.eventType
    );
    res.json(events);
  } catch (error) {
    handleServerError(res, error, 'fetch events by type');
  }
});

// GET /api/world-event/location/:locationId - Get events affecting a location
router.get('/location/:locationId', async (req, res) => {
  try {
    const events = await worldEventService.getEventsAffectingLocation(req.params.locationId);
    res.json(events);
  } catch (error) {
    handleServerError(res, error, 'fetch events for location');
  }
});

// GET /api/world-event/faction/:factionId - Get events affecting a faction
router.get('/faction/:factionId', async (req, res) => {
  try {
    const events = await worldEventService.getEventsAffectingFaction(req.params.factionId);
    res.json(events);
  } catch (error) {
    handleServerError(res, error, 'fetch events for faction');
  }
});

// GET /api/world-event/character/:characterId - Get events visible to a character
router.get('/character/:characterId', async (req, res) => {
  try {
    const events = await worldEventService.getEventsVisibleToCharacter(req.params.characterId);
    res.json(events);
  } catch (error) {
    handleServerError(res, error, 'fetch events for character');
  }
});

// GET /api/world-event/:id - Get a specific event
router.get('/:id', async (req, res) => {
  try {
    const event = await worldEventService.getWorldEventById(req.params.id);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }
    res.json(event);
  } catch (error) {
    handleServerError(res, error, 'fetch event');
  }
});

// POST /api/world-event - Create a new world event
router.post('/', async (req, res) => {
  try {
    const { title } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Event title is required' });
    }

    const event = await worldEventService.createWorldEvent(req.body);
    res.status(201).json(event);
  } catch (error) {
    handleServerError(res, error, 'create event');
  }
});

// PUT /api/world-event/:id - Update an event
router.put('/:id', async (req, res) => {
  try {
    const event = await worldEventService.updateWorldEvent(req.params.id, req.body);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }
    res.json(event);
  } catch (error) {
    handleServerError(res, error, 'update event');
  }
});

// POST /api/world-event/:id/advance-stage - Advance event to next stage
router.post('/:id/advance-stage', async (req, res) => {
  try {
    const event = await worldEventService.advanceEventStage(req.params.id);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }
    res.json(event);
  } catch (error) {
    handleServerError(res, error, 'advance event stage');
  }
});

// POST /api/world-event/:id/resolve - Resolve an event
router.post('/:id/resolve', async (req, res) => {
  try {
    const { outcome, outcome_description } = req.body;

    if (!outcome) {
      return res.status(400).json({ error: 'outcome is required' });
    }

    const event = await worldEventService.resolveEvent(
      req.params.id,
      outcome,
      outcome_description
    );
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }
    res.json(event);
  } catch (error) {
    handleServerError(res, error, 'resolve event');
  }
});

// POST /api/world-event/:id/cancel - Cancel an event
router.post('/:id/cancel', async (req, res) => {
  try {
    const { reason } = req.body;
    const event = await worldEventService.cancelEvent(req.params.id, reason);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }
    res.json(event);
  } catch (error) {
    handleServerError(res, error, 'cancel event');
  }
});

// POST /api/world-event/:id/discover - Character discovers an event
router.post('/:id/discover', async (req, res) => {
  try {
    const { character_id } = req.body;

    if (!character_id) {
      return res.status(400).json({ error: 'character_id is required' });
    }

    const event = await worldEventService.discoverEvent(req.params.id, character_id);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }
    res.json(event);
  } catch (error) {
    handleServerError(res, error, 'discover event');
  }
});

// DELETE /api/world-event/:id - Delete an event
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await worldEventService.deleteWorldEvent(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Event not found' });
    }
    res.json({ success: true });
  } catch (error) {
    handleServerError(res, error, 'delete event');
  }
});

// ============================================================
// EVENT EFFECT ROUTES
// ============================================================

// GET /api/world-event/:eventId/effects - Get all effects for an event
router.get('/:eventId/effects', async (req, res) => {
  try {
    const effects = await worldEventService.getEventEffects(req.params.eventId);
    res.json(effects);
  } catch (error) {
    handleServerError(res, error, 'fetch event effects');
  }
});

// GET /api/world-event/effects/target/:targetType/:targetId - Get active effects for a target
router.get('/effects/target/:targetType/:targetId', async (req, res) => {
  try {
    const effects = await worldEventService.getActiveEffectsForTarget(
      req.params.targetType,
      req.params.targetId
    );
    res.json(effects);
  } catch (error) {
    handleServerError(res, error, 'fetch effects for target');
  }
});

// GET /api/world-event/effects/campaign/:campaignId - Get all active effects for a campaign
router.get('/effects/campaign/:campaignId', async (req, res) => {
  try {
    const effects = await worldEventService.getActiveEffectsForCampaign(req.params.campaignId);
    res.json(effects);
  } catch (error) {
    handleServerError(res, error, 'fetch effects for campaign');
  }
});

// POST /api/world-event/:eventId/effects - Create an effect for an event
router.post('/:eventId/effects', async (req, res) => {
  try {
    const { effect_type, target_type } = req.body;

    if (!effect_type || !target_type) {
      return res.status(400).json({ error: 'effect_type and target_type are required' });
    }

    const effect = await worldEventService.createEventEffect({
      ...req.body,
      event_id: req.params.eventId
    });
    res.status(201).json(effect);
  } catch (error) {
    handleServerError(res, error, 'create effect');
  }
});

// GET /api/world-event/effect/:id - Get a specific effect
router.get('/effect/:id', async (req, res) => {
  try {
    const effect = await worldEventService.getEventEffectById(req.params.id);
    if (!effect) {
      return res.status(404).json({ error: 'Effect not found' });
    }
    res.json(effect);
  } catch (error) {
    handleServerError(res, error, 'fetch effect');
  }
});

// PUT /api/world-event/effect/:id - Update an effect
router.put('/effect/:id', async (req, res) => {
  try {
    const effect = await worldEventService.updateEventEffect(req.params.id, req.body);
    if (!effect) {
      return res.status(404).json({ error: 'Effect not found' });
    }
    res.json(effect);
  } catch (error) {
    handleServerError(res, error, 'update effect');
  }
});

// POST /api/world-event/effect/:id/reverse - Reverse an effect
router.post('/effect/:id/reverse', async (req, res) => {
  try {
    const { reason } = req.body;
    const effect = await worldEventService.reverseEffect(req.params.id, reason);
    if (!effect) {
      return res.status(404).json({ error: 'Effect not found' });
    }
    res.json(effect);
  } catch (error) {
    handleServerError(res, error, 'reverse effect');
  }
});

// DELETE /api/world-event/effect/:id - Delete an effect
router.delete('/effect/:id', async (req, res) => {
  try {
    const deleted = await worldEventService.deleteEventEffect(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Effect not found' });
    }
    res.json({ success: true });
  } catch (error) {
    handleServerError(res, error, 'delete effect');
  }
});

// ============================================================
// TICK PROCESSING
// ============================================================

// POST /api/world-event/tick/:campaignId - Process world event tick
router.post('/tick/:campaignId', async (req, res) => {
  try {
    const { game_days_passed = 1 } = req.body;
    const results = await worldEventService.processEventTick(
      req.params.campaignId,
      game_days_passed
    );
    res.json({ success: true, results });
  } catch (error) {
    handleServerError(res, error, 'process event tick');
  }
});

export default router;
