import { dbAll, dbGet, dbRun } from '../database.js';

/**
 * Location Service - CRUD operations for locations
 */

/**
 * Create a new location
 */
export async function createLocation(data) {
  const {
    campaign_id,
    name,
    description = null,
    location_type = 'settlement',
    parent_location_id = null,
    region = null,
    population_size = null,
    danger_level = 1,
    prosperity_level = 5,
    services = [],
    tags = [],
    climate = 'temperate',
    discovery_status = 'unknown',
    current_state = 'peaceful',
    state_description = null,
    connected_locations = []
  } = data;

  const result = await dbRun(`
    INSERT INTO locations (
      campaign_id, name, description, location_type, parent_location_id, region,
      population_size, danger_level, prosperity_level, services, tags, climate,
      discovery_status, current_state, state_description, connected_locations
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    campaign_id, name, description, location_type, parent_location_id, region,
    population_size, danger_level, prosperity_level,
    JSON.stringify(services), JSON.stringify(tags), climate,
    discovery_status, current_state, state_description, JSON.stringify(connected_locations)
  ]);

  return getLocationById(result.lastInsertRowid);
}

/**
 * Get a location by ID
 */
export async function getLocationById(id) {
  const location = await dbGet('SELECT * FROM locations WHERE id = ?', [id]);
  if (location) {
    location.services = JSON.parse(location.services || '[]');
    location.tags = JSON.parse(location.tags || '[]');
    location.connected_locations = JSON.parse(location.connected_locations || '[]');
  }
  return location;
}

/**
 * Get all locations for a campaign
 */
export async function getCampaignLocations(campaignId) {
  const locations = await dbAll(
    'SELECT * FROM locations WHERE campaign_id = ? ORDER BY name',
    [campaignId]
  );
  return locations.map(loc => ({
    ...loc,
    services: JSON.parse(loc.services || '[]'),
    tags: JSON.parse(loc.tags || '[]'),
    connected_locations: JSON.parse(loc.connected_locations || '[]')
  }));
}

/**
 * Get locations by discovery status
 */
export async function getLocationsByDiscoveryStatus(campaignId, status) {
  const locations = await dbAll(
    'SELECT * FROM locations WHERE campaign_id = ? AND discovery_status = ? ORDER BY name',
    [campaignId, status]
  );
  return locations.map(loc => ({
    ...loc,
    services: JSON.parse(loc.services || '[]'),
    tags: JSON.parse(loc.tags || '[]'),
    connected_locations: JSON.parse(loc.connected_locations || '[]')
  }));
}

/**
 * Get discovered locations (visited or familiar)
 */
export async function getDiscoveredLocations(campaignId) {
  const locations = await dbAll(`
    SELECT * FROM locations
    WHERE campaign_id = ? AND discovery_status IN ('visited', 'familiar', 'home_base')
    ORDER BY name
  `, [campaignId]);
  return locations.map(loc => ({
    ...loc,
    services: JSON.parse(loc.services || '[]'),
    tags: JSON.parse(loc.tags || '[]'),
    connected_locations: JSON.parse(loc.connected_locations || '[]')
  }));
}

/**
 * Get locations by type
 */
export async function getLocationsByType(campaignId, locationType) {
  const locations = await dbAll(
    'SELECT * FROM locations WHERE campaign_id = ? AND location_type = ? ORDER BY name',
    [campaignId, locationType]
  );
  return locations.map(loc => ({
    ...loc,
    services: JSON.parse(loc.services || '[]'),
    tags: JSON.parse(loc.tags || '[]'),
    connected_locations: JSON.parse(loc.connected_locations || '[]')
  }));
}

/**
 * Get locations by region
 */
export async function getLocationsByRegion(campaignId, region) {
  const locations = await dbAll(
    'SELECT * FROM locations WHERE campaign_id = ? AND region = ? ORDER BY name',
    [campaignId, region]
  );
  return locations.map(loc => ({
    ...loc,
    services: JSON.parse(loc.services || '[]'),
    tags: JSON.parse(loc.tags || '[]'),
    connected_locations: JSON.parse(loc.connected_locations || '[]')
  }));
}

/**
 * Get child locations (locations within a parent)
 */
export async function getChildLocations(parentId) {
  const locations = await dbAll(
    'SELECT * FROM locations WHERE parent_location_id = ? ORDER BY name',
    [parentId]
  );
  return locations.map(loc => ({
    ...loc,
    services: JSON.parse(loc.services || '[]'),
    tags: JSON.parse(loc.tags || '[]'),
    connected_locations: JSON.parse(loc.connected_locations || '[]')
  }));
}

/**
 * Update a location
 */
export async function updateLocation(id, data) {
  const location = await getLocationById(id);
  if (!location) return null;

  const updates = { ...location, ...data };

  // Ensure JSON fields are stringified
  const services = typeof updates.services === 'string'
    ? updates.services
    : JSON.stringify(updates.services || []);
  const tags = typeof updates.tags === 'string'
    ? updates.tags
    : JSON.stringify(updates.tags || []);
  const connected_locations = typeof updates.connected_locations === 'string'
    ? updates.connected_locations
    : JSON.stringify(updates.connected_locations || []);

  await dbRun(`
    UPDATE locations SET
      name = ?, description = ?, location_type = ?, parent_location_id = ?,
      region = ?, population_size = ?, danger_level = ?, prosperity_level = ?,
      services = ?, tags = ?, climate = ?, discovery_status = ?,
      first_visited_date = ?, times_visited = ?, connected_locations = ?,
      current_state = ?, state_description = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [
    updates.name, updates.description, updates.location_type, updates.parent_location_id,
    updates.region, updates.population_size, updates.danger_level, updates.prosperity_level,
    services, tags, updates.climate, updates.discovery_status,
    updates.first_visited_date, updates.times_visited, connected_locations,
    updates.current_state, updates.state_description, id
  ]);

  return getLocationById(id);
}

/**
 * Discover a location (mark as visited)
 */
export async function discoverLocation(id, gameDate = null) {
  const location = await getLocationById(id);
  if (!location) return null;

  const newStatus = location.discovery_status === 'unknown' ? 'visited' : location.discovery_status;
  const firstVisited = location.first_visited_date || gameDate || new Date().toISOString();

  await dbRun(`
    UPDATE locations SET
      discovery_status = ?,
      first_visited_date = ?,
      times_visited = times_visited + 1,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [newStatus, firstVisited, id]);

  return getLocationById(id);
}

/**
 * Update location discovery status
 */
export async function updateDiscoveryStatus(id, status) {
  await dbRun(`
    UPDATE locations SET discovery_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
  `, [status, id]);
  return getLocationById(id);
}

/**
 * Update location state
 */
export async function updateLocationState(id, state, description = null) {
  await dbRun(`
    UPDATE locations SET
      current_state = ?,
      state_description = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [state, description, id]);
  return getLocationById(id);
}

/**
 * Connect two locations (bidirectional)
 */
export async function connectLocations(locationId1, locationId2, travelTimeHours, routeType = 'road') {
  const loc1 = await getLocationById(locationId1);
  const loc2 = await getLocationById(locationId2);

  if (!loc1 || !loc2) return null;

  // Add connection to location 1
  const connections1 = loc1.connected_locations || [];
  if (!connections1.find(c => c.location_id === locationId2)) {
    connections1.push({ location_id: locationId2, travel_time_hours: travelTimeHours, route_type: routeType });
    await dbRun(
      'UPDATE locations SET connected_locations = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [JSON.stringify(connections1), locationId1]
    );
  }

  // Add connection to location 2
  const connections2 = loc2.connected_locations || [];
  if (!connections2.find(c => c.location_id === locationId1)) {
    connections2.push({ location_id: locationId1, travel_time_hours: travelTimeHours, route_type: routeType });
    await dbRun(
      'UPDATE locations SET connected_locations = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [JSON.stringify(connections2), locationId2]
    );
  }

  return { location1: await getLocationById(locationId1), location2: await getLocationById(locationId2) };
}

/**
 * Get connected locations with full details
 */
export async function getConnectedLocationsWithDetails(locationId) {
  const location = await getLocationById(locationId);
  if (!location) return [];

  const connections = location.connected_locations || [];
  const results = [];

  for (const conn of connections) {
    const connectedLoc = await getLocationById(conn.location_id);
    if (connectedLoc) {
      results.push({
        ...connectedLoc,
        travel_time_hours: conn.travel_time_hours,
        route_type: conn.route_type
      });
    }
  }

  return results;
}

/**
 * Delete a location
 */
export async function deleteLocation(id) {
  const result = await dbRun('DELETE FROM locations WHERE id = ?', [id]);
  return result.changes > 0;
}

/**
 * Search locations by name or tags
 */
export async function searchLocations(campaignId, query) {
  const locations = await dbAll(`
    SELECT * FROM locations
    WHERE campaign_id = ? AND (
      name LIKE ? OR
      description LIKE ? OR
      tags LIKE ? OR
      region LIKE ?
    )
    ORDER BY name
  `, [campaignId, `%${query}%`, `%${query}%`, `%${query}%`, `%${query}%`]);

  return locations.map(loc => ({
    ...loc,
    services: JSON.parse(loc.services || '[]'),
    tags: JSON.parse(loc.tags || '[]'),
    connected_locations: JSON.parse(loc.connected_locations || '[]')
  }));
}
