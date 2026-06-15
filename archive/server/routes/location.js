import express from 'express';
import * as locationService from '../services/locationService.js';
import * as locationGenerator from '../services/locationGenerator.js';
import { dbGet } from '../database.js';
import { handleServerError } from '../utils/errorHandler.js';

const router = express.Router();

// GET /api/location/campaign/:campaignId - Get all locations for a campaign
router.get('/campaign/:campaignId', async (req, res) => {
  try {
    const locations = await locationService.getCampaignLocations(req.params.campaignId);
    res.json(locations);
  } catch (error) {
    handleServerError(res, error, 'fetch locations');
  }
});

// GET /api/location/campaign/:campaignId/discovered - Get discovered locations only
router.get('/campaign/:campaignId/discovered', async (req, res) => {
  try {
    const locations = await locationService.getDiscoveredLocations(req.params.campaignId);
    res.json(locations);
  } catch (error) {
    handleServerError(res, error, 'fetch discovered locations');
  }
});

// GET /api/location/campaign/:campaignId/type/:type - Get locations by type
router.get('/campaign/:campaignId/type/:type', async (req, res) => {
  try {
    const locations = await locationService.getLocationsByType(
      req.params.campaignId,
      req.params.type
    );
    res.json(locations);
  } catch (error) {
    handleServerError(res, error, 'fetch locations by type');
  }
});

// GET /api/location/campaign/:campaignId/region/:region - Get locations by region
router.get('/campaign/:campaignId/region/:region', async (req, res) => {
  try {
    const locations = await locationService.getLocationsByRegion(
      req.params.campaignId,
      req.params.region
    );
    res.json(locations);
  } catch (error) {
    handleServerError(res, error, 'fetch locations by region');
  }
});

// GET /api/location/campaign/:campaignId/search - Search locations
router.get('/campaign/:campaignId/search', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) {
      return res.status(400).json({ error: 'Search query (q) is required' });
    }
    const locations = await locationService.searchLocations(req.params.campaignId, q);
    res.json(locations);
  } catch (error) {
    handleServerError(res, error, 'search locations');
  }
});

// GET /api/location/:id - Get a specific location
router.get('/:id', async (req, res) => {
  try {
    const location = await locationService.getLocationById(req.params.id);
    if (!location) {
      return res.status(404).json({ error: 'Location not found' });
    }
    res.json(location);
  } catch (error) {
    handleServerError(res, error, 'fetch location');
  }
});

// GET /api/location/:id/children - Get child locations
router.get('/:id/children', async (req, res) => {
  try {
    const locations = await locationService.getChildLocations(req.params.id);
    res.json(locations);
  } catch (error) {
    handleServerError(res, error, 'fetch child locations');
  }
});

// GET /api/location/:id/connections - Get connected locations with details
router.get('/:id/connections', async (req, res) => {
  try {
    const locations = await locationService.getConnectedLocationsWithDetails(req.params.id);
    res.json(locations);
  } catch (error) {
    handleServerError(res, error, 'fetch connected locations');
  }
});

// POST /api/location - Create a new location
router.post('/', async (req, res) => {
  try {
    const { name, campaign_id } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Location name is required' });
    }

    const location = await locationService.createLocation(req.body);
    res.status(201).json(location);
  } catch (error) {
    handleServerError(res, error, 'create location');
  }
});

// PUT /api/location/:id - Update a location
router.put('/:id', async (req, res) => {
  try {
    const location = await locationService.updateLocation(req.params.id, req.body);
    if (!location) {
      return res.status(404).json({ error: 'Location not found' });
    }
    res.json(location);
  } catch (error) {
    handleServerError(res, error, 'update location');
  }
});

// POST /api/location/:id/discover - Mark a location as discovered/visited
router.post('/:id/discover', async (req, res) => {
  try {
    const { game_date } = req.body;
    const location = await locationService.discoverLocation(req.params.id, game_date);
    if (!location) {
      return res.status(404).json({ error: 'Location not found' });
    }
    res.json(location);
  } catch (error) {
    handleServerError(res, error, 'discover location');
  }
});

// PUT /api/location/:id/discovery-status - Update discovery status
router.put('/:id/discovery-status', async (req, res) => {
  try {
    const { status } = req.body;
    if (!status) {
      return res.status(400).json({ error: 'Status is required' });
    }

    const validStatuses = ['unknown', 'heard_of', 'visited', 'familiar', 'home_base'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
    }

    const location = await locationService.updateDiscoveryStatus(req.params.id, status);
    if (!location) {
      return res.status(404).json({ error: 'Location not found' });
    }
    res.json(location);
  } catch (error) {
    handleServerError(res, error, 'update discovery status');
  }
});

// PUT /api/location/:id/state - Update location state
router.put('/:id/state', async (req, res) => {
  try {
    const { state, description } = req.body;
    if (!state) {
      return res.status(400).json({ error: 'State is required' });
    }

    const location = await locationService.updateLocationState(req.params.id, state, description);
    if (!location) {
      return res.status(404).json({ error: 'Location not found' });
    }
    res.json(location);
  } catch (error) {
    handleServerError(res, error, 'update location state');
  }
});

// POST /api/location/connect - Connect two locations
router.post('/connect', async (req, res) => {
  try {
    const { location_id_1, location_id_2, travel_time_hours, route_type } = req.body;

    if (!location_id_1 || !location_id_2 || !travel_time_hours) {
      return res.status(400).json({
        error: 'location_id_1, location_id_2, and travel_time_hours are required'
      });
    }

    const result = await locationService.connectLocations(
      location_id_1,
      location_id_2,
      travel_time_hours,
      route_type || 'road'
    );

    if (!result) {
      return res.status(404).json({ error: 'One or both locations not found' });
    }

    res.json(result);
  } catch (error) {
    handleServerError(res, error, 'connect locations');
  }
});

// DELETE /api/location/:id - Delete a location
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await locationService.deleteLocation(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Location not found' });
    }
    res.json({ success: true });
  } catch (error) {
    handleServerError(res, error, 'delete location');
  }
});

// ============================================================
// LOCATION GENERATION ROUTES
// ============================================================

// POST /api/location/generate - Generate a single location
router.post('/generate', async (req, res) => {
  try {
    const { campaign_id, location_type, region, danger_level, theme, parent_id } = req.body;

    if (!campaign_id) {
      return res.status(400).json({ error: 'campaign_id is required' });
    }

    const campaign = await dbGet('SELECT * FROM campaigns WHERE id = ?', [campaign_id]);
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    const generated = await locationGenerator.generateLocation({
      campaign,
      locationType: location_type,
      region,
      dangerLevel: danger_level,
      theme
    });

    const location = await locationService.createLocation({
      ...generated,
      campaign_id,
      parent_id
    });

    res.status(201).json(location);
  } catch (error) {
    handleServerError(res, error, 'generate location');
  }
});

// POST /api/location/generate/region - Generate multiple locations for a region
router.post('/generate/region', async (req, res) => {
  try {
    const { campaign_id, region_name, region_type, location_count = 5, theme } = req.body;

    if (!campaign_id || !region_name) {
      return res.status(400).json({ error: 'campaign_id and region_name are required' });
    }

    const campaign = await dbGet('SELECT * FROM campaigns WHERE id = ?', [campaign_id]);
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    const generated = await locationGenerator.generateRegionLocations({
      campaign,
      regionName: region_name,
      regionType: region_type,
      count: location_count,
      theme
    });

    // Create all locations in database
    const createdLocations = [];
    for (const loc of generated.locations) {
      const location = await locationService.createLocation({
        ...loc,
        campaign_id,
        region: region_name
      });
      createdLocations.push(location);
    }

    // Create connections between locations
    const createdConnections = [];
    if (generated.connections) {
      for (const conn of generated.connections) {
        // Find locations by name
        const loc1 = createdLocations.find(l => l.name === conn.from);
        const loc2 = createdLocations.find(l => l.name === conn.to);
        if (loc1 && loc2) {
          const connection = await locationService.connectLocations(
            loc1.id,
            loc2.id,
            conn.travel_time_hours || 4,
            conn.route_type || 'road'
          );
          createdConnections.push(connection);
        }
      }
    }

    res.status(201).json({
      region: region_name,
      locations: createdLocations,
      connections: createdConnections
    });
  } catch (error) {
    handleServerError(res, error, 'generate region');
  }
});

// POST /api/location/generate/dungeon - Generate a dungeon location
router.post('/generate/dungeon', async (req, res) => {
  try {
    const { campaign_id, dungeon_type, danger_level, theme, region, parent_id } = req.body;

    if (!campaign_id) {
      return res.status(400).json({ error: 'campaign_id is required' });
    }

    const campaign = await dbGet('SELECT * FROM campaigns WHERE id = ?', [campaign_id]);
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    const generated = await locationGenerator.generateDungeon({
      campaign,
      dungeonType: dungeon_type,
      dangerLevel: danger_level || 5,
      theme
    });

    const location = await locationService.createLocation({
      ...generated,
      campaign_id,
      region,
      parent_id,
      location_type: 'dungeon'
    });

    res.status(201).json(location);
  } catch (error) {
    handleServerError(res, error, 'generate dungeon');
  }
});

// POST /api/location/generate/connections - Generate connections between existing locations
router.post('/generate/connections', async (req, res) => {
  try {
    const { campaign_id, location_ids } = req.body;

    if (!campaign_id || !location_ids || !Array.isArray(location_ids)) {
      return res.status(400).json({ error: 'campaign_id and location_ids array are required' });
    }

    // Get the locations
    const locations = [];
    for (const id of location_ids) {
      const loc = await locationService.getLocationById(id);
      if (loc) locations.push(loc);
    }

    if (locations.length < 2) {
      return res.status(400).json({ error: 'Need at least 2 valid locations to generate connections' });
    }

    const campaign = await dbGet('SELECT * FROM campaigns WHERE id = ?', [campaign_id]);

    const generated = await locationGenerator.generateConnections({
      campaign,
      locations
    });

    // Create the connections
    const createdConnections = [];
    for (const conn of generated) {
      const loc1 = locations.find(l => l.name === conn.from);
      const loc2 = locations.find(l => l.name === conn.to);
      if (loc1 && loc2) {
        const connection = await locationService.connectLocations(
          loc1.id,
          loc2.id,
          conn.travel_time_hours || 4,
          conn.route_type || 'road'
        );
        createdConnections.push(connection);
      }
    }

    res.status(201).json(createdConnections);
  } catch (error) {
    handleServerError(res, error, 'generate connections');
  }
});

export default router;
