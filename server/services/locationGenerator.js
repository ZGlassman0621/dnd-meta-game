/**
 * Location Generator Service
 *
 * Generates locations for a region using AI (Claude primary, Ollama fallback).
 * Creates settlements, dungeons, points of interest, and connections between them.
 */

import { isClaudeAvailable, chat as claudeChat } from './claude.js';
import { checkOllamaStatus, chat as ollamaChat } from './ollama.js';

/**
 * Generate locations for a region
 * @param {object} context - Context for generation
 * @param {object} context.campaign - Campaign settings
 * @param {string} context.region - Region name
 * @param {string} context.regionDescription - Optional region description
 * @param {number} context.count - Number of locations to generate (default 5)
 * @param {array} context.existingLocations - Existing locations to connect to
 * @returns {array} Generated location data ready for locationService
 */
export async function generateRegionLocations(context) {
  const prompt = buildRegionPrompt(context);
  const result = await generateWithAI(prompt);
  return parseLocationsResponse(result, context);
}

/**
 * Generate a single detailed location
 * @param {object} context - Context for generation
 * @param {string} context.locationType - Type of location (city, dungeon, etc.)
 * @param {string} context.purpose - Why this location is needed
 * @returns {object} Generated location data
 */
export async function generateLocation(context) {
  const prompt = buildSingleLocationPrompt(context);
  const result = await generateWithAI(prompt);
  const locations = parseLocationsResponse(result, context);
  return locations[0] || null;
}

/**
 * Generate a dungeon or adventure site
 * @param {object} context - Context for generation
 * @returns {object} Generated dungeon location
 */
export async function generateDungeon(context) {
  const prompt = buildDungeonPrompt(context);
  const result = await generateWithAI(prompt);
  const locations = parseLocationsResponse(result, context);
  return locations[0] || null;
}

/**
 * Generate connections between locations
 * @param {array} locations - Locations to connect
 * @param {object} context - Campaign context
 * @returns {array} Connection data
 */
export async function generateConnections(locations, context) {
  const prompt = buildConnectionsPrompt(locations, context);
  const result = await generateWithAI(prompt);
  return parseConnectionsResponse(result);
}

// ============================================================
// PROMPT BUILDERS
// ============================================================

function buildRegionPrompt(context) {
  const { campaign, region, regionDescription, count = 5, existingLocations } = context;

  const existingNames = existingLocations?.map(l => l.name).join(', ') || 'None';

  return `You are a D&D world builder. Generate ${count} locations for a region.

CAMPAIGN:
- Setting: ${campaign?.setting || 'Forgotten Realms'}
- Tone: ${campaign?.tone || 'heroic fantasy'}

REGION: ${region}
${regionDescription ? `DESCRIPTION: ${regionDescription}` : ''}

EXISTING LOCATIONS (can reference for connections): ${existingNames}

Generate ${count} diverse locations. Include a mix of:
- Settlements (cities, towns, villages)
- Dungeons or adventure sites
- Points of interest (landmarks, ruins, natural features)
- Service locations (inns, temples, shops)

Return ONLY valid JSON array:
[
  {
    "name": "Location Name",
    "description": "2-3 sentences describing the location",
    "location_type": "city|town|village|dungeon|ruins|temple|inn|landmark|cave|forest|mountain|other",
    "region": "${region}",
    "population_size": "none|tiny|small|medium|large|huge",
    "danger_level": 1-10,
    "prosperity_level": 1-10,
    "services": ["inn", "blacksmith", "temple", "market", "stables"],
    "tags": ["tag1", "tag2"],
    "climate": "temperate|cold|hot|tropical|desert|arctic",
    "current_state": "thriving|declining|abandoned|contested|rebuilding",
    "state_description": "Current situation details",
    "connected_to": ["Other Location Name"]
  }
]`;
}

function buildSingleLocationPrompt(context) {
  const { campaign, locationType, purpose, region, parentLocation } = context;

  return `You are a D&D world builder. Generate a detailed location.

CAMPAIGN:
- Setting: ${campaign?.setting || 'Forgotten Realms'}
- Tone: ${campaign?.tone || 'heroic fantasy'}

LOCATION TYPE: ${locationType || 'settlement'}
PURPOSE: ${purpose || 'General exploration'}
REGION: ${region || 'Unknown'}
${parentLocation ? `PARENT LOCATION: ${parentLocation.name}` : ''}

Generate ONE detailed location.

Return ONLY valid JSON:
{
  "name": "Location Name",
  "description": "3-4 sentences with vivid details",
  "location_type": "${locationType || 'settlement'}",
  "region": "${region || 'Unknown'}",
  "population_size": "none|tiny|small|medium|large|huge",
  "danger_level": 1-10,
  "prosperity_level": 1-10,
  "services": [],
  "tags": [],
  "climate": "temperate",
  "current_state": "thriving",
  "state_description": "Current situation",
  "notable_npcs": [
    {
      "name": "NPC Name",
      "role": "Their role here",
      "personality": "Brief trait"
    }
  ],
  "hooks": [
    "Potential adventure hook 1",
    "Potential adventure hook 2"
  ]
}`;
}

function buildDungeonPrompt(context) {
  const { campaign, dungeonType, level, region, theme } = context;

  const dungeonTypes = {
    cave: 'Natural cave system',
    ruins: 'Ancient ruins',
    crypt: 'Undead-infested crypt',
    fortress: 'Abandoned fortress',
    temple: 'Corrupted temple',
    mine: 'Overrun mine',
    tower: 'Wizard tower',
    lair: 'Monster lair'
  };

  return `You are a D&D dungeon designer. Generate a dungeon location.

CAMPAIGN:
- Setting: ${campaign?.setting || 'Forgotten Realms'}
- Tone: ${campaign?.tone || 'heroic fantasy'}

DUNGEON TYPE: ${dungeonTypes[dungeonType] || dungeonType || 'Ancient ruins'}
APPROPRIATE LEVEL: ${level || '1-5'}
REGION: ${region || 'Unknown'}
${theme ? `THEME: ${theme}` : ''}

Generate a dungeon location suitable for exploration.

Return ONLY valid JSON:
{
  "name": "Dungeon Name",
  "description": "Evocative description of the dungeon entrance and atmosphere",
  "location_type": "dungeon",
  "region": "${region || 'Unknown'}",
  "population_size": "none",
  "danger_level": ${level ? Math.min(10, Math.ceil(parseInt(level) / 2)) : 5},
  "prosperity_level": 1,
  "services": [],
  "tags": ["dungeon", "${dungeonType || 'ruins'}", "${theme || 'exploration'}"],
  "climate": "underground",
  "current_state": "dangerous",
  "state_description": "Current dungeon state",
  "dungeon_info": {
    "floors": 1-5,
    "primary_inhabitants": "What lives here",
    "boss": "Notable enemy or guardian",
    "treasure_type": "Type of loot to find",
    "history": "Why this place exists",
    "hazards": ["Environmental hazard 1", "Hazard 2"]
  },
  "hooks": [
    "Why adventurers would come here"
  ]
}`;
}

function buildConnectionsPrompt(locations, context) {
  const locationList = locations.map(l => `- ${l.name} (${l.location_type})`).join('\n');

  return `You are a D&D world builder. Define travel connections between locations.

LOCATIONS:
${locationList}

For each reasonable connection, specify:
- Which locations connect
- Travel method (road, trail, river, etc.)
- Travel time (hours or days)
- Danger level of the route

Return ONLY valid JSON:
{
  "connections": [
    {
      "from": "Location A",
      "to": "Location B",
      "travel_method": "road|trail|river|sea|mountain_pass|forest_path",
      "travel_time": "4 hours|2 days",
      "danger_level": 1-10,
      "notes": "Any special considerations"
    }
  ]
}`;
}

// ============================================================
// AI GENERATION
// ============================================================

async function generateWithAI(prompt) {
  // Try Claude first
  if (isClaudeAvailable()) {
    try {
      const response = await claudeChat(
        'You are a D&D world builder. Return ONLY valid JSON, no explanation or markdown.',
        [{ role: 'user', content: prompt }],
        3, 'opus'
      );
      return response;
    } catch (error) {
      console.error('Claude location generation failed:', error.message);
    }
  }

  // Try Ollama as fallback
  const ollamaStatus = await checkOllamaStatus();
  if (ollamaStatus.available) {
    try {
      const response = await ollamaChat([
        { role: 'system', content: 'You are a D&D world builder. Return ONLY valid JSON, no explanation or markdown.' },
        { role: 'user', content: prompt }
      ]);
      return response;
    } catch (error) {
      console.error('Ollama location generation failed:', error.message);
    }
  }

  throw new Error('No AI provider available for location generation');
}

// ============================================================
// RESPONSE PARSERS
// ============================================================

function parseLocationsResponse(response, context) {
  let jsonStr = response;

  // Handle markdown code blocks
  const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1];
  }

  // Try to find JSON array or object
  const arrayMatch = jsonStr.match(/\[[\s\S]*\]/);
  const objectMatch = jsonStr.match(/\{[\s\S]*\}/);

  if (arrayMatch) {
    jsonStr = arrayMatch[0];
  } else if (objectMatch) {
    jsonStr = `[${objectMatch[0]}]`;
  }

  try {
    const parsed = JSON.parse(jsonStr);
    const locations = Array.isArray(parsed) ? parsed : [parsed];

    return locations.map(loc => ({
      campaign_id: context.campaign?.id || null,
      name: loc.name,
      description: loc.description,
      location_type: loc.location_type || 'other',
      region: loc.region || context.region,
      population_size: loc.population_size || 'none',
      danger_level: loc.danger_level || 1,
      prosperity_level: loc.prosperity_level || 1,
      services: loc.services || [],
      tags: loc.tags || [],
      climate: loc.climate || 'temperate',
      discovery_status: 'unknown',
      current_state: loc.current_state || 'normal',
      state_description: loc.state_description || null,
      connected_locations: loc.connected_to || [],
      // Extra data not in main table
      _notable_npcs: loc.notable_npcs || [],
      _hooks: loc.hooks || [],
      _dungeon_info: loc.dungeon_info || null
    }));
  } catch (error) {
    console.error('Failed to parse locations response:', error);
    console.error('Response was:', response);
    throw new Error('Failed to parse AI-generated locations');
  }
}

function parseConnectionsResponse(response) {
  let jsonStr = response;

  const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1];
  }

  const objectMatch = jsonStr.match(/\{[\s\S]*\}/);
  if (objectMatch) {
    jsonStr = objectMatch[0];
  }

  try {
    const parsed = JSON.parse(jsonStr);
    return parsed.connections || [];
  } catch (error) {
    console.error('Failed to parse connections response:', error);
    return [];
  }
}

export default {
  generateRegionLocations,
  generateLocation,
  generateDungeon,
  generateConnections
};
