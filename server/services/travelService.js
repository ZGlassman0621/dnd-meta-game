import { dbAll, dbGet, dbRun } from '../database.js';
import { generateEncounterLoot } from '../config/rewards.js';

/**
 * Travel Service - Journey mechanics, encounters, and resource management
 */

// ============================================================
// JOURNEY CRUD
// ============================================================

/**
 * Start a new journey
 */
export async function startJourney(data) {
  const {
    character_id,
    campaign_id = null,
    origin_location_id,
    destination_location_id,
    origin_name = null,
    destination_name = null,
    travel_method = 'walking',
    route_type = 'road',
    distance_miles = null,
    estimated_hours = null,
    traveling_companions = [],
    game_start_day = null,
    game_start_hour = null
  } = data;

  // Calculate estimated hours if not provided
  let hours = estimated_hours;
  if (!hours && distance_miles) {
    hours = calculateTravelTime(distance_miles, travel_method, route_type);
  }

  const result = await dbRun(`
    INSERT INTO journeys (
      character_id, campaign_id, origin_location_id, destination_location_id,
      origin_name, destination_name, travel_method, route_type,
      distance_miles, estimated_hours, traveling_companions,
      game_start_day, game_start_hour, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'in_progress')
  `, [
    character_id, campaign_id, origin_location_id, destination_location_id,
    origin_name, destination_name, travel_method, route_type,
    distance_miles, hours, JSON.stringify(traveling_companions),
    game_start_day, game_start_hour
  ]);

  return getJourneyById(result.lastInsertRowid);
}

/**
 * Get a journey by ID
 */
export async function getJourneyById(id) {
  const journey = await dbGet('SELECT * FROM journeys WHERE id = ?', [id]);
  return journey ? parseJourneyJson(journey) : null;
}

/**
 * Get a journey with its encounters
 */
export async function getJourneyWithEncounters(id) {
  const journey = await getJourneyById(id);
  if (!journey) return null;

  const encounters = await getJourneyEncounters(id);
  journey.encounters = encounters;

  return journey;
}

/**
 * Get all journeys for a character
 */
export async function getCharacterJourneys(characterId) {
  const journeys = await dbAll(
    'SELECT * FROM journeys WHERE character_id = ? ORDER BY created_at DESC',
    [characterId]
  );
  return journeys.map(parseJourneyJson);
}

/**
 * Get active journey for a character (should be only one)
 */
export async function getActiveJourney(characterId) {
  const journey = await dbGet(
    "SELECT * FROM journeys WHERE character_id = ? AND status = 'in_progress'",
    [characterId]
  );
  return journey ? parseJourneyJson(journey) : null;
}

/**
 * Get journeys for a campaign
 */
export async function getCampaignJourneys(campaignId) {
  const journeys = await dbAll(
    'SELECT * FROM journeys WHERE campaign_id = ? ORDER BY created_at DESC',
    [campaignId]
  );
  return journeys.map(parseJourneyJson);
}

/**
 * Update a journey
 */
export async function updateJourney(id, data) {
  const journey = await getJourneyById(id);
  if (!journey) return null;

  const updates = { ...journey, ...data };

  await dbRun(`
    UPDATE journeys SET
      travel_method = ?, route_type = ?, distance_miles = ?,
      estimated_hours = ?, actual_hours = ?, expected_arrival = ?,
      actual_arrival = ?, rations_consumed = ?, gold_spent = ?,
      traveling_companions = ?, status = ?, outcome = ?, outcome_description = ?,
      encounters_faced = ?, encounters_avoided = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [
    updates.travel_method, updates.route_type, updates.distance_miles,
    updates.estimated_hours, updates.actual_hours, updates.expected_arrival,
    updates.actual_arrival, updates.rations_consumed, updates.gold_spent,
    JSON.stringify(updates.traveling_companions), updates.status,
    updates.outcome, updates.outcome_description,
    updates.encounters_faced, updates.encounters_avoided, id
  ]);

  return getJourneyById(id);
}

/**
 * Complete a journey successfully
 */
export async function completeJourney(id, actualHours = null, outcomeDescription = null) {
  const journey = await getJourneyById(id);
  if (!journey) return null;

  await dbRun(`
    UPDATE journeys SET
      status = 'completed',
      outcome = 'arrived',
      outcome_description = ?,
      actual_hours = ?,
      actual_arrival = CURRENT_TIMESTAMP,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [outcomeDescription, actualHours || journey.estimated_hours, id]);

  return getJourneyById(id);
}

/**
 * Abort a journey (return to origin or stranded)
 */
export async function abortJourney(id, reason = null, outcome = 'aborted') {
  await dbRun(`
    UPDATE journeys SET
      status = ?,
      outcome = ?,
      outcome_description = ?,
      actual_arrival = CURRENT_TIMESTAMP,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [outcome, outcome, reason, id]);

  return getJourneyById(id);
}

/**
 * Consume resources during journey
 */
export async function consumeResources(id, rations = 0, gold = 0) {
  const journey = await getJourneyById(id);
  if (!journey) return null;

  await dbRun(`
    UPDATE journeys SET
      rations_consumed = rations_consumed + ?,
      gold_spent = gold_spent + ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [rations, gold, id]);

  return getJourneyById(id);
}

/**
 * Delete a journey
 */
export async function deleteJourney(id) {
  // Encounters will cascade delete
  const result = await dbRun('DELETE FROM journeys WHERE id = ?', [id]);
  return result.changes > 0;
}

// ============================================================
// JOURNEY ENCOUNTER CRUD
// ============================================================

/**
 * Create an encounter during a journey
 */
export async function createEncounter(data) {
  const {
    journey_id,
    encounter_type,
    title,
    description = null,
    hours_into_journey = 0,
    game_day = null,
    game_hour = null,
    danger_level = 3,
    challenge_type = null,
    npcs_involved = []
  } = data;

  const result = await dbRun(`
    INSERT INTO journey_encounters (
      journey_id, encounter_type, title, description,
      hours_into_journey, game_day, game_hour, danger_level,
      challenge_type, npcs_involved, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
  `, [
    journey_id, encounter_type, title, description,
    hours_into_journey, game_day, game_hour, danger_level,
    challenge_type, JSON.stringify(npcs_involved)
  ]);

  // Update journey encounter count
  await dbRun(`
    UPDATE journeys SET encounters_faced = encounters_faced + 1 WHERE id = ?
  `, [journey_id]);

  return getEncounterById(result.lastInsertRowid);
}

/**
 * Get an encounter by ID
 */
export async function getEncounterById(id) {
  const encounter = await dbGet('SELECT * FROM journey_encounters WHERE id = ?', [id]);
  return encounter ? parseEncounterJson(encounter) : null;
}

/**
 * Get all encounters for a journey
 */
export async function getJourneyEncounters(journeyId) {
  const encounters = await dbAll(
    'SELECT * FROM journey_encounters WHERE journey_id = ? ORDER BY hours_into_journey',
    [journeyId]
  );
  return encounters.map(parseEncounterJson);
}

/**
 * Get pending encounters for a journey
 */
export async function getPendingEncounters(journeyId) {
  const encounters = await dbAll(
    "SELECT * FROM journey_encounters WHERE journey_id = ? AND status = 'pending' ORDER BY hours_into_journey",
    [journeyId]
  );
  return encounters.map(parseEncounterJson);
}

/**
 * Resolve an encounter (with automatic loot generation)
 */
export async function resolveEncounter(id, data) {
  const {
    approach,
    outcome,
    outcome_description = null,
    hp_change = 0,
    gold_change = 0,
    items_gained = [],
    items_lost = [],
    time_lost_hours = 0,
    created_story_thread_id = null,
    character_level = 1
  } = data;

  // Auto-generate loot if none was explicitly provided and encounter was successful
  let finalItemsGained = [...items_gained];
  let finalGoldChange = gold_change;

  if (items_gained.length === 0 && outcome !== 'failure' && outcome !== 'fled') {
    const encounter = await getEncounterById(id);
    if (encounter) {
      const loot = generateEncounterLoot(encounter.encounter_type, character_level, outcome);
      if (loot.item) {
        finalItemsGained.push(loot.item);
      }
      const lootGoldCp = (loot.gold.gp * 100) + (loot.gold.sp * 10) + loot.gold.cp;
      if (lootGoldCp > 0) {
        finalGoldChange += lootGoldCp;
      }
    }
  }

  await dbRun(`
    UPDATE journey_encounters SET
      status = 'resolved',
      approach = ?,
      outcome = ?,
      outcome_description = ?,
      hp_change = ?,
      gold_change = ?,
      items_gained = ?,
      items_lost = ?,
      time_lost_hours = ?,
      created_story_thread_id = ?
    WHERE id = ?
  `, [
    approach, outcome, outcome_description, hp_change, finalGoldChange,
    JSON.stringify(finalItemsGained), JSON.stringify(items_lost),
    time_lost_hours, created_story_thread_id, id
  ]);

  return getEncounterById(id);
}

/**
 * Avoid an encounter (stealth, diplomacy, etc.)
 */
export async function avoidEncounter(id, approach, description = null) {
  const encounter = await getEncounterById(id);
  if (!encounter) return null;

  await dbRun(`
    UPDATE journey_encounters SET
      status = 'avoided',
      approach = ?,
      outcome = 'avoided',
      outcome_description = ?
    WHERE id = ?
  `, [approach, description, id]);

  // Update journey avoided count
  await dbRun(`
    UPDATE journeys SET encounters_avoided = encounters_avoided + 1 WHERE id = ?
  `, [encounter.journey_id]);

  return getEncounterById(id);
}

/**
 * Delete an encounter
 */
export async function deleteEncounter(id) {
  const result = await dbRun('DELETE FROM journey_encounters WHERE id = ?', [id]);
  return result.changes > 0;
}

// ============================================================
// TRAVEL CALCULATIONS
// ============================================================

/**
 * Travel method speeds (miles per hour)
 */
const TRAVEL_SPEEDS = {
  walking: 3,
  forced_march: 4,
  riding: 6,
  fast_riding: 8,
  carriage: 4,
  boat: 5,
  ship: 8,
  flying: 10,
  teleportation: Infinity
};

/**
 * Route type modifiers (multiplier on time)
 */
const ROUTE_MODIFIERS = {
  road: 1.0,
  trail: 1.3,
  wilderness: 2.0,
  mountain: 2.5,
  swamp: 3.0,
  desert: 1.8,
  river: 1.0,
  sea: 1.0,
  underground: 2.0
};

/**
 * Calculate travel time in hours
 */
export function calculateTravelTime(distanceMiles, travelMethod = 'walking', routeType = 'road') {
  const speed = TRAVEL_SPEEDS[travelMethod] || TRAVEL_SPEEDS.walking;
  const modifier = ROUTE_MODIFIERS[routeType] || ROUTE_MODIFIERS.road;

  if (speed === Infinity) return 0; // Teleportation

  return Math.ceil((distanceMiles / speed) * modifier);
}

/**
 * Calculate daily rations needed
 */
export function calculateRationsNeeded(travelHours, partySize = 1) {
  const travelDays = Math.ceil(travelHours / 8); // Assume 8 hours travel per day
  return travelDays * partySize;
}

/**
 * Estimate travel cost (for hiring transport)
 */
export function estimateTravelCost(distanceMiles, travelMethod) {
  const costPerMile = {
    walking: 0,
    forced_march: 0,
    riding: 0.1,  // Horse care
    fast_riding: 0.2,
    carriage: 0.3,
    boat: 0.2,
    ship: 0.5,
    flying: 2,
    teleportation: 50
  };

  return Math.ceil(distanceMiles * (costPerMile[travelMethod] || 0));
}

// ============================================================
// ENCOUNTER GENERATION
// ============================================================

/**
 * Encounter types with their base probabilities
 */
const ENCOUNTER_TYPES = {
  combat: { weight: 25, danger_range: [3, 8] },
  creature: { weight: 20, danger_range: [2, 6] },
  travelers: { weight: 20, danger_range: [1, 3] },
  merchant: { weight: 10, danger_range: [1, 2] },
  weather: { weight: 10, danger_range: [2, 5] },
  obstacle: { weight: 8, danger_range: [2, 4] },
  discovery: { weight: 5, danger_range: [1, 3] },
  omen: { weight: 2, danger_range: [1, 2] }
};

/**
 * Generate a random encounter for a journey segment
 */
export function generateRandomEncounter(routeType, dangerLevel) {
  // Adjust weights based on route type
  const weights = { ...ENCOUNTER_TYPES };

  // Wilderness has more creatures, roads have more travelers
  if (routeType === 'wilderness' || routeType === 'mountain') {
    weights.creature.weight *= 1.5;
    weights.travelers.weight *= 0.5;
    weights.merchant.weight *= 0.3;
  } else if (routeType === 'road') {
    weights.travelers.weight *= 1.5;
    weights.merchant.weight *= 1.5;
  } else if (routeType === 'sea' || routeType === 'river') {
    weights.weather.weight *= 2;
    weights.creature.weight *= 1.3;
  }

  // Pick encounter type
  const totalWeight = Object.values(weights).reduce((sum, w) => sum + w.weight, 0);
  let roll = Math.random() * totalWeight;

  let encounterType = 'travelers';
  for (const [type, data] of Object.entries(weights)) {
    roll -= data.weight;
    if (roll <= 0) {
      encounterType = type;
      break;
    }
  }

  // Calculate danger level for this encounter
  const typeData = ENCOUNTER_TYPES[encounterType];
  const baseDanger = typeData.danger_range[0] +
    Math.floor(Math.random() * (typeData.danger_range[1] - typeData.danger_range[0] + 1));

  // Modify by route danger level
  const finalDanger = Math.max(1, Math.min(10, baseDanger + Math.floor((dangerLevel - 3) / 2)));

  return {
    encounter_type: encounterType,
    danger_level: finalDanger,
    challenge_type: getChallengeType(encounterType)
  };
}

/**
 * Determine if an encounter occurs for a journey segment
 */
export function checkForEncounter(dangerLevel, hoursElapsed, routeType = 'road') {
  // Base chance: 10% per 4 hours on roads, modified by danger
  const baseChance = 0.10;
  const dangerModifier = 1 + (dangerLevel - 3) * 0.1; // +10% per danger level above 3
  const routeModifier = routeType === 'road' ? 0.8 : routeType === 'wilderness' ? 1.5 : 1.0;

  const checkInterval = 4; // Check every 4 hours
  const numberOfChecks = Math.floor(hoursElapsed / checkInterval);

  for (let i = 0; i < numberOfChecks; i++) {
    const chance = baseChance * dangerModifier * routeModifier;
    if (Math.random() < chance) {
      return {
        occurs: true,
        hours_into_journey: (i + 1) * checkInterval
      };
    }
  }

  return { occurs: false };
}

/**
 * Get challenge type for an encounter
 */
function getChallengeType(encounterType) {
  const challengeMap = {
    combat: 'combat',
    creature: 'combat',
    travelers: 'social',
    merchant: 'social',
    weather: 'survival',
    obstacle: 'exploration',
    discovery: 'exploration',
    omen: 'arcane'
  };
  return challengeMap[encounterType] || 'exploration';
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function parseJourneyJson(journey) {
  return {
    ...journey,
    traveling_companions: JSON.parse(journey.traveling_companions || '[]')
  };
}

function parseEncounterJson(encounter) {
  return {
    ...encounter,
    items_gained: JSON.parse(encounter.items_gained || '[]'),
    items_lost: JSON.parse(encounter.items_lost || '[]'),
    npcs_involved: JSON.parse(encounter.npcs_involved || '[]')
  };
}

// Export constants for external use
export { TRAVEL_SPEEDS, ROUTE_MODIFIERS, ENCOUNTER_TYPES };
