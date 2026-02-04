/**
 * Living World Generator Service
 *
 * Generates dynamic content for the living world:
 * - Faction goals
 * - World events
 * Uses AI (Claude primary, Ollama fallback).
 */

import { isClaudeAvailable, chat as claudeChat } from './claude.js';
import { checkOllamaStatus, chat as ollamaChat } from './ollama.js';

// ============================================================
// FACTION GOAL GENERATION
// ============================================================

/**
 * Generate a faction goal based on faction identity and world state
 * @param {object} context - Context for generation
 * @param {object} context.faction - The faction this goal is for
 * @param {object} context.campaign - Campaign settings
 * @param {array} context.otherFactions - Other factions in the world
 * @param {array} context.existingGoals - Existing goals to avoid overlap
 * @returns {object} Generated goal data ready for factionService.createFactionGoal
 */
export async function generateFactionGoal(context) {
  const prompt = buildFactionGoalPrompt(context);
  const result = await generateWithAI(prompt);
  return parseFactionGoalResponse(result, context);
}

/**
 * Generate multiple goals for a faction (initial setup)
 */
export async function generateFactionGoals(context, count = 2) {
  const goals = [];
  for (let i = 0; i < count; i++) {
    // Add previously generated goals to context to avoid duplicates
    const goalContext = {
      ...context,
      existingGoals: [...(context.existingGoals || []), ...goals]
    };
    const goal = await generateFactionGoal(goalContext);
    goals.push(goal);
  }
  return goals;
}

function buildFactionGoalPrompt(context) {
  const { faction, campaign, otherFactions, existingGoals } = context;

  const factionRelationships = otherFactions
    ?.filter(f => f.id !== faction.id)
    .map(f => `- ${f.name}: ${faction.faction_relationships?.[f.id] || 'neutral'}`)
    .join('\n') || 'None';

  const existingGoalTitles = existingGoals?.map(g => g.title).join(', ') || 'None';

  return `You are a D&D world builder. Generate a FACTION GOAL for an organization.

FACTION:
- Name: ${faction.name}
- Description: ${faction.description || 'A powerful organization'}
- Scope: ${faction.scope} (local/regional/continental/global)
- Power Level: ${faction.power_level}/10
- Alignment: ${faction.alignment || 'neutral'}
- Primary Values: ${faction.primary_values?.join(', ') || 'Power, influence'}
- Typical Methods: ${faction.typical_methods?.join(', ') || 'Diplomacy, subterfuge'}
- Resources: Wealth ${faction.wealth_level}/10, Military ${faction.military_strength}/10, Political ${faction.political_influence}/10

RELATIONSHIPS WITH OTHER FACTIONS:
${factionRelationships}

CAMPAIGN:
- Setting: ${campaign?.setting || 'Forgotten Realms'}
- Tone: ${campaign?.tone || 'heroic fantasy'}

EXISTING GOALS (avoid overlap): ${existingGoalTitles}

Generate a FACTION GOAL that this organization is actively pursuing. Consider:
1. Goals should match the faction's values, methods, and power level
2. Goals can target locations, other factions, NPCs, or be internal
3. Goals should create opportunities for player involvement (help or hinder)

GOAL TYPES:
- expansion: Grow territory or influence
- defense: Protect against threats
- economic: Acquire wealth or trade advantage
- political: Gain political power or legitimacy
- military: Military conquest or deterrence
- covert: Secret operations, espionage
- religious: Spread faith or oppose heresy
- magical: Acquire magical power or artifacts

VISIBILITY:
- public: Everyone knows about it
- rumored: Whispers and hints exist
- secret: Hidden from outsiders

Return ONLY valid JSON in this exact format:
{
  "title": "Goal Title (short, action-oriented)",
  "description": "2-3 sentences describing the goal",
  "goal_type": "expansion",
  "progress_max": 100,
  "milestones": [
    {"at_progress": 25, "description": "First milestone"},
    {"at_progress": 50, "description": "Halfway point"},
    {"at_progress": 75, "description": "Nearly complete"},
    {"at_progress": 100, "description": "Goal achieved"}
  ],
  "urgency": "normal",
  "stakes_level": "moderate",
  "visibility": "rumored",
  "success_consequences": "What happens if the faction succeeds",
  "failure_consequences": "What happens if the faction fails or is stopped",
  "target_type": "location|faction|npc|none",
  "target_description": "What/who they're targeting (if applicable)",
  "player_hooks": [
    "How players might help this faction",
    "How players might oppose this faction"
  ]
}`;
}

function parseFactionGoalResponse(response, context) {
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

    return {
      faction_id: context.faction.id,
      title: parsed.title,
      description: parsed.description,
      goal_type: parsed.goal_type || 'expansion',
      progress: 0,
      progress_max: parsed.progress_max || 100,
      milestones: parsed.milestones || [],
      urgency: parsed.urgency || 'normal',
      stakes_level: parsed.stakes_level || 'moderate',
      visibility: parsed.visibility || 'secret',
      success_consequences: parsed.success_consequences,
      failure_consequences: parsed.failure_consequences,
      status: 'active',
      // Store hooks for narrative use
      _player_hooks: parsed.player_hooks,
      _target_description: parsed.target_description
    };
  } catch (error) {
    console.error('Failed to parse faction goal response:', error);
    console.error('Response was:', response);
    throw new Error('Failed to parse AI-generated faction goal');
  }
}

// ============================================================
// WORLD EVENT GENERATION
// ============================================================

/**
 * Generate a world event based on campaign state
 * @param {object} context - Context for generation
 * @param {object} context.campaign - Campaign settings
 * @param {array} context.factions - Active factions
 * @param {array} context.locations - Known locations
 * @param {array} context.activeEvents - Currently active events
 * @param {string} context.eventType - Optional specific event type to generate
 * @returns {object} Generated event data ready for worldEventService.createWorldEvent
 */
export async function generateWorldEvent(context) {
  const prompt = buildWorldEventPrompt(context);
  const result = await generateWithAI(prompt);
  return parseWorldEventResponse(result, context);
}

/**
 * Generate a world event triggered by a faction
 */
export async function generateFactionTriggeredEvent(context) {
  const prompt = buildFactionTriggeredEventPrompt(context);
  const result = await generateWithAI(prompt);
  return parseWorldEventResponse(result, context);
}

function buildWorldEventPrompt(context) {
  const { campaign, factions, locations, activeEvents, eventType } = context;

  const factionList = factions
    ?.slice(0, 5)
    .map(f => `- ${f.name} (${f.scope}, power ${f.power_level})`)
    .join('\n') || 'None established';

  const locationList = locations
    ?.slice(0, 5)
    .map(l => `- ${l.name} (${l.type || 'location'})`)
    .join('\n') || 'None established';

  const activeEventTitles = activeEvents?.map(e => e.title).join(', ') || 'None';

  const eventTypeHint = eventType ? `Generate a ${eventType.toUpperCase()} event specifically.` : '';

  return `You are a D&D world builder. Generate a WORLD EVENT that affects the campaign world.

CAMPAIGN:
- Setting: ${campaign?.setting || 'Forgotten Realms'}
- Tone: ${campaign?.tone || 'heroic fantasy'}

ACTIVE FACTIONS:
${factionList}

KNOWN LOCATIONS:
${locationList}

ACTIVE EVENTS (avoid overlap): ${activeEventTitles}

${eventTypeHint}

Generate a WORLD EVENT - something happening in the world that creates narrative opportunities.

EVENT TYPES:
- political: Power shifts, treaties, conflicts between rulers
- economic: Trade disruptions, market crashes, prosperity booms
- military: Wars, invasions, military campaigns
- natural: Disasters, plagues, celestial events
- magical: Wild magic surges, planar incursions, artifact awakening
- religious: Divine interventions, cult activities, holy days
- social: Festivals, riots, migrations
- conspiracy: Hidden plots affecting the world
- threat: Monster attacks, villain schemes, external dangers

SCOPE:
- local: Affects one settlement or small area
- regional: Affects a kingdom or large region
- continental: Affects multiple kingdoms
- global: World-changing event

Return ONLY valid JSON in this exact format:
{
  "title": "Event Title (dramatic but concise)",
  "description": "2-3 sentences describing what's happening",
  "event_type": "political",
  "scope": "regional",
  "stages": ["Stage 1 Name", "Stage 2 Name", "Stage 3 Name"],
  "stage_descriptions": [
    "What happens in stage 1",
    "What happens in stage 2",
    "What happens in stage 3"
  ],
  "expected_duration_days": 14,
  "visibility": "public",
  "possible_outcomes": [
    "Outcome if event runs its course",
    "Outcome if players intervene positively",
    "Outcome if players intervene negatively"
  ],
  "player_intervention_options": [
    "What players could do to help",
    "What players could do to hinder",
    "What players could investigate"
  ],
  "affected_location_types": ["city", "trade route"],
  "affected_faction_types": ["merchant guild", "nobility"],
  "suggested_effects": [
    {
      "effect_type": "price_modifier",
      "description": "Prices increase due to shortage",
      "target_type": "location",
      "parameters": {"modifier": 1.5}
    }
  ]
}`;
}

function buildFactionTriggeredEventPrompt(context) {
  const { faction, goal, campaign } = context;

  return `You are a D&D world builder. Generate a WORLD EVENT triggered by a faction's activities.

FACTION:
- Name: ${faction.name}
- Description: ${faction.description || 'A powerful organization'}
- Scope: ${faction.scope}
- Alignment: ${faction.alignment || 'neutral'}

THEIR GOAL:
- Title: ${goal.title}
- Description: ${goal.description}
- Progress: ${goal.progress}/${goal.progress_max} (${Math.floor((goal.progress / goal.progress_max) * 100)}%)

CAMPAIGN:
- Setting: ${campaign?.setting || 'Forgotten Realms'}
- Tone: ${campaign?.tone || 'heroic fantasy'}

Generate a WORLD EVENT that emerges from this faction pursuing their goal. The event should:
1. Be a consequence of the faction's activities
2. Affect others in the world (not just the faction)
3. Create opportunities for player involvement

Return ONLY valid JSON in this exact format:
{
  "title": "Event Title",
  "description": "2-3 sentences describing the event",
  "event_type": "political",
  "scope": "${faction.scope}",
  "stages": ["Emerging", "Escalating", "Climax"],
  "stage_descriptions": [
    "The initial effects are felt",
    "The situation intensifies",
    "Events reach their peak"
  ],
  "expected_duration_days": 7,
  "visibility": "rumored",
  "possible_outcomes": [
    "The faction succeeds in their aims",
    "Opposition rises to stop them",
    "Unexpected complications arise"
  ],
  "player_intervention_options": [
    "Aid the ${faction.name}",
    "Oppose the ${faction.name}",
    "Investigate what's really happening"
  ]
}`;
}

function parseWorldEventResponse(response, context) {
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

    return {
      campaign_id: context.campaign?.id || null,
      title: parsed.title,
      description: parsed.description,
      event_type: parsed.event_type || 'political',
      scope: parsed.scope || 'local',
      stages: parsed.stages || [],
      stage_descriptions: parsed.stage_descriptions || [],
      expected_duration_days: parsed.expected_duration_days || 7,
      visibility: parsed.visibility || 'public',
      possible_outcomes: parsed.possible_outcomes || [],
      player_intervention_options: parsed.player_intervention_options || [],
      triggered_by_faction_id: context.faction?.id || null,
      status: 'active',
      // Store additional info for later use
      _suggested_effects: parsed.suggested_effects,
      _affected_location_types: parsed.affected_location_types,
      _affected_faction_types: parsed.affected_faction_types
    };
  } catch (error) {
    console.error('Failed to parse world event response:', error);
    console.error('Response was:', response);
    throw new Error('Failed to parse AI-generated world event');
  }
}

// ============================================================
// AI GENERATION
// ============================================================

/**
 * Generate content using Claude (primary) or Ollama (fallback)
 */
async function generateWithAI(prompt) {
  // Try Claude first
  if (isClaudeAvailable()) {
    try {
      const response = await claudeChat(
        'You are a D&D world builder. Return ONLY valid JSON, no explanation or markdown.',
        [{ role: 'user', content: prompt }]
      );
      return response;
    } catch (error) {
      console.error('Claude living world generation failed:', error.message);
      // Fall through to Ollama
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
      console.error('Ollama living world generation failed:', error.message);
    }
  }

  throw new Error('No AI provider available for living world generation');
}

export default {
  generateFactionGoal,
  generateFactionGoals,
  generateWorldEvent,
  generateFactionTriggeredEvent
};
