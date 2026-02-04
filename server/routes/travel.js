import express from 'express';
import * as travelService from '../services/travelService.js';
import { handleServerError, notFound, validationError } from '../utils/errorHandler.js';

const router = express.Router();

// ============================================================
// STATIC ROUTES (must come before dynamic :id routes)
// ============================================================

// GET /api/travel/constants - Get travel constants (speeds, modifiers, encounter types)
router.get('/constants', (req, res) => {
  res.json({
    travel_speeds: travelService.TRAVEL_SPEEDS,
    route_modifiers: travelService.ROUTE_MODIFIERS,
    encounter_types: Object.keys(travelService.ENCOUNTER_TYPES)
  });
});

// ============================================================
// JOURNEY ROUTES
// ============================================================

// GET /api/travel/character/:characterId - Get all journeys for a character
router.get('/character/:characterId', async (req, res) => {
  try {
    const journeys = await travelService.getCharacterJourneys(req.params.characterId);
    res.json(journeys);
  } catch (error) {
    handleServerError(res, error, 'fetch journeys');
  }
});

// GET /api/travel/character/:characterId/active - Get active journey
router.get('/character/:characterId/active', async (req, res) => {
  try {
    const journey = await travelService.getActiveJourney(req.params.characterId);
    res.json(journey);
  } catch (error) {
    handleServerError(res, error, 'fetch active journey');
  }
});

// GET /api/travel/campaign/:campaignId - Get all journeys for a campaign
router.get('/campaign/:campaignId', async (req, res) => {
  try {
    const journeys = await travelService.getCampaignJourneys(req.params.campaignId);
    res.json(journeys);
  } catch (error) {
    handleServerError(res, error, 'fetch campaign journeys');
  }
});

// GET /api/travel/:id - Get a specific journey
router.get('/:id', async (req, res) => {
  try {
    const journey = await travelService.getJourneyById(req.params.id);
    if (!journey) {
      return notFound(res, 'Journey');
    }
    res.json(journey);
  } catch (error) {
    handleServerError(res, error, 'fetch journey');
  }
});

// GET /api/travel/:id/full - Get journey with encounters
router.get('/:id/full', async (req, res) => {
  try {
    const journey = await travelService.getJourneyWithEncounters(req.params.id);
    if (!journey) {
      return res.status(404).json({ error: 'Journey not found' });
    }
    res.json(journey);
  } catch (error) {
    console.error('Error fetching journey with encounters:', error);
    res.status(500).json({ error: 'Failed to fetch journey' });
  }
});

// POST /api/travel - Start a new journey
router.post('/', async (req, res) => {
  try {
    const { character_id, origin_location_id, destination_location_id } = req.body;

    if (!character_id || !origin_location_id || !destination_location_id) {
      return res.status(400).json({
        error: 'character_id, origin_location_id, and destination_location_id are required'
      });
    }

    const journey = await travelService.startJourney(req.body);
    res.status(201).json(journey);
  } catch (error) {
    console.error('Error starting journey:', error);
    res.status(500).json({ error: 'Failed to start journey' });
  }
});

// PUT /api/travel/:id - Update a journey
router.put('/:id', async (req, res) => {
  try {
    const journey = await travelService.updateJourney(req.params.id, req.body);
    if (!journey) {
      return res.status(404).json({ error: 'Journey not found' });
    }
    res.json(journey);
  } catch (error) {
    console.error('Error updating journey:', error);
    res.status(500).json({ error: 'Failed to update journey' });
  }
});

// POST /api/travel/:id/complete - Complete a journey
router.post('/:id/complete', async (req, res) => {
  try {
    const { actual_hours, outcome_description } = req.body;
    const journey = await travelService.completeJourney(
      req.params.id,
      actual_hours,
      outcome_description
    );
    if (!journey) {
      return res.status(404).json({ error: 'Journey not found' });
    }
    res.json(journey);
  } catch (error) {
    console.error('Error completing journey:', error);
    res.status(500).json({ error: 'Failed to complete journey' });
  }
});

// POST /api/travel/:id/abort - Abort a journey
router.post('/:id/abort', async (req, res) => {
  try {
    const { reason, outcome = 'aborted' } = req.body;
    const journey = await travelService.abortJourney(req.params.id, reason, outcome);
    if (!journey) {
      return res.status(404).json({ error: 'Journey not found' });
    }
    res.json(journey);
  } catch (error) {
    console.error('Error aborting journey:', error);
    res.status(500).json({ error: 'Failed to abort journey' });
  }
});

// POST /api/travel/:id/consume-resources - Consume resources during journey
router.post('/:id/consume-resources', async (req, res) => {
  try {
    const { rations = 0, gold = 0 } = req.body;
    const journey = await travelService.consumeResources(req.params.id, rations, gold);
    if (!journey) {
      return res.status(404).json({ error: 'Journey not found' });
    }
    res.json(journey);
  } catch (error) {
    console.error('Error consuming resources:', error);
    res.status(500).json({ error: 'Failed to consume resources' });
  }
});

// DELETE /api/travel/:id - Delete a journey
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await travelService.deleteJourney(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Journey not found' });
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting journey:', error);
    res.status(500).json({ error: 'Failed to delete journey' });
  }
});

// ============================================================
// ENCOUNTER ROUTES
// ============================================================

// GET /api/travel/:journeyId/encounters - Get all encounters for a journey
router.get('/:journeyId/encounters', async (req, res) => {
  try {
    const encounters = await travelService.getJourneyEncounters(req.params.journeyId);
    res.json(encounters);
  } catch (error) {
    console.error('Error fetching journey encounters:', error);
    res.status(500).json({ error: 'Failed to fetch encounters' });
  }
});

// GET /api/travel/:journeyId/encounters/pending - Get pending encounters
router.get('/:journeyId/encounters/pending', async (req, res) => {
  try {
    const encounters = await travelService.getPendingEncounters(req.params.journeyId);
    res.json(encounters);
  } catch (error) {
    console.error('Error fetching pending encounters:', error);
    res.status(500).json({ error: 'Failed to fetch encounters' });
  }
});

// POST /api/travel/:journeyId/encounters - Create an encounter
router.post('/:journeyId/encounters', async (req, res) => {
  try {
    const { encounter_type, title } = req.body;

    if (!encounter_type || !title) {
      return res.status(400).json({ error: 'encounter_type and title are required' });
    }

    const encounter = await travelService.createEncounter({
      ...req.body,
      journey_id: req.params.journeyId
    });
    res.status(201).json(encounter);
  } catch (error) {
    console.error('Error creating encounter:', error);
    res.status(500).json({ error: 'Failed to create encounter' });
  }
});

// GET /api/travel/encounter/:id - Get a specific encounter
router.get('/encounter/:id', async (req, res) => {
  try {
    const encounter = await travelService.getEncounterById(req.params.id);
    if (!encounter) {
      return res.status(404).json({ error: 'Encounter not found' });
    }
    res.json(encounter);
  } catch (error) {
    console.error('Error fetching encounter:', error);
    res.status(500).json({ error: 'Failed to fetch encounter' });
  }
});

// POST /api/travel/encounter/:id/resolve - Resolve an encounter
router.post('/encounter/:id/resolve', async (req, res) => {
  try {
    const { approach, outcome } = req.body;

    if (!approach || !outcome) {
      return res.status(400).json({ error: 'approach and outcome are required' });
    }

    const encounter = await travelService.resolveEncounter(req.params.id, req.body);
    if (!encounter) {
      return res.status(404).json({ error: 'Encounter not found' });
    }
    res.json(encounter);
  } catch (error) {
    console.error('Error resolving encounter:', error);
    res.status(500).json({ error: 'Failed to resolve encounter' });
  }
});

// POST /api/travel/encounter/:id/avoid - Avoid an encounter
router.post('/encounter/:id/avoid', async (req, res) => {
  try {
    const { approach, description } = req.body;

    if (!approach) {
      return res.status(400).json({ error: 'approach is required' });
    }

    const encounter = await travelService.avoidEncounter(req.params.id, approach, description);
    if (!encounter) {
      return res.status(404).json({ error: 'Encounter not found' });
    }
    res.json(encounter);
  } catch (error) {
    console.error('Error avoiding encounter:', error);
    res.status(500).json({ error: 'Failed to avoid encounter' });
  }
});

// DELETE /api/travel/encounter/:id - Delete an encounter
router.delete('/encounter/:id', async (req, res) => {
  try {
    const deleted = await travelService.deleteEncounter(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Encounter not found' });
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting encounter:', error);
    res.status(500).json({ error: 'Failed to delete encounter' });
  }
});

// ============================================================
// CALCULATION ROUTES
// ============================================================

// POST /api/travel/calculate/time - Calculate travel time
router.post('/calculate/time', async (req, res) => {
  try {
    const { distance_miles, travel_method = 'walking', route_type = 'road' } = req.body;

    if (!distance_miles) {
      return res.status(400).json({ error: 'distance_miles is required' });
    }

    const hours = travelService.calculateTravelTime(distance_miles, travel_method, route_type);
    const rations = travelService.calculateRationsNeeded(hours, req.body.party_size || 1);
    const cost = travelService.estimateTravelCost(distance_miles, travel_method);

    res.json({
      distance_miles,
      travel_method,
      route_type,
      estimated_hours: hours,
      estimated_days: Math.ceil(hours / 8),
      rations_needed: rations,
      estimated_cost_gp: cost
    });
  } catch (error) {
    console.error('Error calculating travel time:', error);
    res.status(500).json({ error: 'Failed to calculate travel time' });
  }
});

// POST /api/travel/generate/encounter - Generate a random encounter
router.post('/generate/encounter', async (req, res) => {
  try {
    const { route_type = 'road', danger_level = 3 } = req.body;

    const encounter = travelService.generateRandomEncounter(route_type, danger_level);
    res.json(encounter);
  } catch (error) {
    console.error('Error generating encounter:', error);
    res.status(500).json({ error: 'Failed to generate encounter' });
  }
});

// POST /api/travel/check/encounter - Check if encounter occurs
router.post('/check/encounter', async (req, res) => {
  try {
    const { danger_level, hours_elapsed, route_type = 'road' } = req.body;

    if (danger_level === undefined || hours_elapsed === undefined) {
      return res.status(400).json({ error: 'danger_level and hours_elapsed are required' });
    }

    const result = travelService.checkForEncounter(danger_level, hours_elapsed, route_type);
    res.json(result);
  } catch (error) {
    console.error('Error checking for encounter:', error);
    res.status(500).json({ error: 'Failed to check for encounter' });
  }
});

export default router;
