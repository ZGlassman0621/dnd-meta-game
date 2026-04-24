/**
 * Quest Generator Service
 *
 * Generates structured quests using AI (Claude primary, Ollama fallback).
 * Creates main quests (5 stages), side quests (2-3 stages), and one-time quests.
 */

import { isClaudeAvailable, chat as claudeChat } from './claude.js';
import { checkOllamaStatus, chat as ollamaChat } from './ollama.js';
import { REQUIREMENT_TYPES } from '../config/eventTypes.js';
import { extractLLMJson } from '../utils/llmJson.js';

/**
 * Generate a main quest (5-stage epic storyline)
 * @param {object} context - Context for generation
 * @param {object} context.character - The character this quest is for
 * @param {object} context.campaign - Campaign settings
 * @param {object} context.location - Current location info
 * @param {array} context.existingQuests - Existing quests to avoid overlap
 * @returns {object} Generated quest data ready for questService.createQuest
 */
export async function generateMainQuest(context) {
  const prompt = buildMainQuestPrompt(context);
  const result = await generateWithAI(prompt);
  return parseQuestResponse(result, 'main', context);
}

/**
 * Generate a side quest (2-3 stage storyline)
 * @param {object} context - Context for generation
 * @returns {object} Generated quest data
 */
export async function generateSideQuest(context) {
  const prompt = buildSideQuestPrompt(context);
  const result = await generateWithAI(prompt);
  return parseQuestResponse(result, 'side', context);
}

/**
 * Generate a one-time quest (single objective)
 * @param {object} context - Context for generation
 * @returns {object} Generated quest data
 */
export async function generateOneTimeQuest(context) {
  const prompt = buildOneTimeQuestPrompt(context);
  const result = await generateWithAI(prompt);
  return parseQuestResponse(result, 'one_time', context);
}

/**
 * Generate a companion quest (tied to companion backstory)
 * @param {object} context - Context including companion info
 * @returns {object} Generated quest data
 */
export async function generateCompanionQuest(context) {
  const prompt = buildCompanionQuestPrompt(context);
  const result = await generateWithAI(prompt);
  return parseQuestResponse(result, 'companion', context);
}

/**
 * Generate a faction quest (tied to faction milestone)
 * @param {object} context - Context for generation
 * @param {object} context.character - The character
 * @param {object} context.campaign - Campaign settings
 * @param {object} context.faction - The faction
 * @param {object} context.goal - The faction goal that hit a milestone
 * @param {number} context.milestone - Milestone percentage (25, 50, 75, 100)
 * @param {object} context.standing - Character's standing with this faction
 * @param {array} context.existingQuests - Existing quests to avoid overlap
 * @returns {object} Generated quest data
 */
export async function generateFactionQuest(context) {
  const prompt = buildFactionQuestPrompt(context);
  const result = await generateWithAI(prompt);
  return parseQuestResponse(result, 'faction', context);
}

// ============================================================
// PROMPT BUILDERS
// ============================================================

function buildMainQuestPrompt(context) {
  const { character, campaign, location, existingQuests } = context;

  const existingQuestTitles = existingQuests?.map(q => q.title).join(', ') || 'None';

  return `You are a D&D quest designer. Generate a MAIN QUEST for a character.

CHARACTER:
- Name: ${character.name}
- Class: ${character.class}
- Level: ${character.level}
- Background: ${character.background || 'Unknown'}
- Current Location: ${location?.name || character.current_location || 'Unknown'}

CAMPAIGN:
- Setting: ${campaign?.setting || 'Forgotten Realms'}
- Tone: ${campaign?.tone || 'heroic fantasy'}

EXISTING QUESTS (avoid overlap): ${existingQuestTitles}

Generate a 5-stage MAIN QUEST. This should be an epic storyline that takes multiple sessions to complete.

REQUIREMENTS:
1. Each stage should have ABSTRACT requirements that can be satisfied through multiple gameplay paths
2. Use these requirement types: ${Object.values(REQUIREMENT_TYPES).join(', ')}
3. Requirements should be flexible (e.g., "defeat bandits" not "defeat the specific bandit chief at the cave")

Return ONLY valid JSON in this exact format:
{
  "title": "Quest Title",
  "premise": "One sentence hook that draws the player in",
  "description": "2-3 sentences describing the quest",
  "antagonist": {
    "name": "Villain Name",
    "type": "Type (person, organization, creature, force)",
    "motivation": "Why they oppose the hero",
    "weakness": "Their exploitable flaw"
  },
  "stages": [
    {
      "name": "Stage 1 Name",
      "description": "What happens in this stage",
      "objectives": ["Objective 1", "Objective 2"]
    }
  ],
  "requirements": [
    {
      "stage_index": 0,
      "type": "adventure_completed",
      "description": "What the player needs to do",
      "params": {"adventure_tag": "investigation"},
      "is_optional": false
    }
  ],
  "rewards": {
    "gold": 500,
    "xp": 1000,
    "items": ["Magic Item Name"],
    "reputation": "Faction reputation gain"
  },
  "world_impact_on_complete": "How the world changes when this quest is done",
  "time_sensitive": false,
  "escalation_if_ignored": "What happens if the player ignores this quest"
}`;
}

function buildSideQuestPrompt(context) {
  const { character, campaign, location, questHook } = context;

  return `You are a D&D quest designer. Generate a SIDE QUEST for a character.

CHARACTER:
- Name: ${character.name}
- Class: ${character.class}
- Level: ${character.level}
- Current Location: ${location?.name || character.current_location || 'Unknown'}

CAMPAIGN:
- Setting: ${campaign?.setting || 'Forgotten Realms'}
- Tone: ${campaign?.tone || 'heroic fantasy'}

${questHook ? `QUEST HOOK: ${questHook}` : ''}

Generate a 2-3 stage SIDE QUEST. This should be a focused storyline completable in 1-2 sessions.

REQUIREMENT TYPES: ${Object.values(REQUIREMENT_TYPES).join(', ')}

Return ONLY valid JSON in this exact format:
{
  "title": "Quest Title",
  "premise": "One sentence hook",
  "description": "2-3 sentences describing the quest",
  "stages": [
    {
      "name": "Stage Name",
      "description": "What happens",
      "objectives": ["Objective"]
    }
  ],
  "requirements": [
    {
      "stage_index": 0,
      "type": "location_visited",
      "description": "Visit the location",
      "params": {"location_type": "dungeon"},
      "is_optional": false
    }
  ],
  "rewards": {
    "gold": 100,
    "xp": 250,
    "items": []
  },
  "world_impact_on_complete": "Minor world change"
}`;
}

function buildOneTimeQuestPrompt(context) {
  const { character, location, questType } = context;

  const questTypes = {
    bounty: 'A bounty to eliminate a threat',
    rescue: 'Rescue someone in danger',
    retrieval: 'Retrieve a stolen or lost item',
    delivery: 'Deliver something important',
    escort: 'Escort someone safely',
    investigation: 'Investigate a mystery',
    exploration: 'Explore an uncharted area'
  };

  const typeDescription = questTypes[questType] || 'A simple task';

  return `You are a D&D quest designer. Generate a ONE-TIME QUEST.

CHARACTER:
- Name: ${character.name}
- Level: ${character.level}
- Location: ${location?.name || character.current_location || 'Unknown'}

QUEST TYPE: ${typeDescription}

Generate a simple ONE-TIME QUEST with a single objective. These are quick tasks from job boards or NPCs.

REQUIREMENT TYPES: ${Object.values(REQUIREMENT_TYPES).join(', ')}

Return ONLY valid JSON:
{
  "title": "Quest Title",
  "premise": "One sentence description",
  "description": "Brief description",
  "stages": [
    {
      "name": "Complete Task",
      "description": "What to do",
      "objectives": ["Single objective"]
    }
  ],
  "requirements": [
    {
      "stage_index": 0,
      "type": "adventure_completed",
      "description": "Complete the task",
      "params": {"adventure_tag": "${questType || 'task'}"},
      "is_optional": false
    }
  ],
  "rewards": {
    "gold": 50,
    "xp": 100
  }
}`;
}

function buildCompanionQuestPrompt(context) {
  const { character, companion, backstory } = context;

  const threads = backstory?.unresolved_threads || [];
  const activeThread = threads.find(t => t.status === 'active') || threads[0];

  return `You are a D&D quest designer. Generate a COMPANION QUEST.

CHARACTER:
- Name: ${character.name}
- Class: ${character.class}
- Level: ${character.level}

COMPANION:
- Name: ${companion.name}
- Origin: ${backstory?.origin_description || 'Unknown'}
- Personal Goal: ${backstory?.personal_goal || 'Unknown'}
- Active Thread: ${activeThread?.description || 'None'}

Generate a 3-stage COMPANION QUEST that helps resolve this companion's backstory thread.
This should be personal and emotionally meaningful.

REQUIREMENT TYPES: ${Object.values(REQUIREMENT_TYPES).join(', ')}

Return ONLY valid JSON:
{
  "title": "Quest Title",
  "premise": "One sentence hook tied to companion's story",
  "description": "2-3 sentences",
  "stages": [
    {
      "name": "Stage Name",
      "description": "What happens",
      "objectives": ["Objective"]
    }
  ],
  "requirements": [
    {
      "stage_index": 0,
      "type": "npc_met",
      "description": "Meet someone from the companion's past",
      "params": {},
      "is_optional": false
    }
  ],
  "rewards": {
    "gold": 0,
    "xp": 500,
    "companion_loyalty": 20,
    "thread_resolved": "${activeThread?.id || ''}"
  },
  "world_impact_on_complete": "How this affects the companion"
}`;
}

/**
 * Generate a faction conflict quest (two factions clashing)
 * @param {object} context - Context for generation
 * @param {object} context.character - The character
 * @param {object} context.campaign - Campaign settings
 * @param {object} context.aggressor - The rival faction launching the counter-action
 * @param {object} context.defender - The faction being opposed
 * @param {object} context.goal - The defender's goal that triggered the conflict
 * @param {number} context.milestone - Goal milestone percentage
 * @param {object} context.aggressorStanding - Character's standing with the aggressor
 * @param {object} context.defenderStanding - Character's standing with the defender
 * @param {array} context.existingQuests - Existing quests to avoid overlap
 * @returns {object} Generated quest data
 */
export async function generateConflictQuest(context) {
  const prompt = buildConflictQuestPrompt(context);
  const result = await generateWithAI(prompt);
  return parseQuestResponse(result, 'faction_conflict', context);
}

function buildConflictQuestPrompt(context) {
  const { character, campaign, aggressor, defender, goal, milestone, aggressorStanding, defenderStanding, existingQuests } = context;

  const aggressorStandingValue = aggressorStanding?.standing || 0;
  const defenderStandingValue = defenderStanding?.standing || 0;
  const existingQuestTitles = existingQuests?.map(q => q.title).join(', ') || 'None';

  // Determine how the player is positioned in this conflict
  let playerContext;
  if (defenderStandingValue >= 20 && aggressorStandingValue <= -20) {
    playerContext = `The player is ALLIED with ${defender.name} and HOSTILE to ${aggressor.name}. The quest should favor helping ${defender.name} defend against ${aggressor.name}'s aggression.`;
  } else if (aggressorStandingValue >= 20 && defenderStandingValue <= -20) {
    playerContext = `The player is ALLIED with ${aggressor.name} and HOSTILE to ${defender.name}. The quest should favor helping ${aggressor.name} undermine ${defender.name}'s goal.`;
  } else {
    playerContext = `The player has no strong allegiance to either faction (${defender.name}: ${defenderStandingValue}, ${aggressor.name}: ${aggressorStandingValue}). Both sides approach the player seeking help. The quest should present a genuine CHOICE — the player must decide which faction to support or attempt a risky mediation.`;
  }

  return `You are a D&D quest designer. Generate a FACTION CONFLICT QUEST where two factions are clashing.

CHARACTER:
- Name: ${character.name}
- Class: ${character.class}
- Level: ${character.level}
- Current Location: ${character.current_location || 'Unknown'}

CAMPAIGN:
- Setting: ${campaign?.setting || 'Forgotten Realms'}
- Tone: ${campaign?.tone || 'heroic fantasy'}

DEFENDING FACTION (being opposed):
- Name: ${defender.name}
- Description: ${defender.description || 'A powerful organization'}
- Scope: ${defender.scope || 'regional'}
- Goal Under Threat: "${goal.title}" (${milestone}% complete)

AGGRESSOR FACTION (launching counter-action):
- Name: ${aggressor.name}
- Description: ${aggressor.description || 'A rival organization'}
- Scope: ${aggressor.scope || 'regional'}

PLAYER POSITION: ${playerContext}

EXISTING QUESTS (avoid overlap): ${existingQuestTitles}

Generate a 3-stage FACTION CONFLICT QUEST. This quest must involve the tension between two factions and present the player with a meaningful CHOICE about which side to support. The quest should:
- Stage 1: Both factions approach the player or the conflict directly affects the player's area
- Stage 2: The player must take action that either helps one faction or mediates
- Stage 3: Resolution with consequences for the losing faction

REQUIREMENT TYPES: ${Object.values(REQUIREMENT_TYPES).join(', ')}

Return ONLY valid JSON:
{
  "title": "Quest Title reflecting the conflict",
  "premise": "One sentence hook about the faction clash",
  "description": "2-3 sentences about the conflict and the player's role",
  "stages": [
    {
      "name": "Stage Name",
      "description": "What happens",
      "objectives": ["Objective"]
    }
  ],
  "requirements": [
    {
      "stage_index": 0,
      "type": "adventure_completed",
      "description": "What the player needs to do",
      "params": {"adventure_tag": "investigation"},
      "is_optional": false
    }
  ],
  "rewards": {
    "gold": ${milestone >= 75 ? 250 : 150},
    "xp": ${milestone >= 75 ? 500 : 300},
    "items": [],
    "faction_standing_change": 10,
    "opposing_faction_standing_change": -5
  },
  "world_impact_on_complete": "How completing this quest changes the balance of power",
  "aggressor_faction_id": ${aggressor.id},
  "defender_faction_id": ${defender.id}
}`;
}

function buildFactionQuestPrompt(context) {
  const { character, campaign, faction, goal, milestone, standing, existingQuests } = context;

  const standingValue = standing?.standing || 0;
  const existingQuestTitles = existingQuests?.map(q => q.title).join(', ') || 'None';

  // Determine quest framing based on player's standing with the faction
  let standingContext;
  if (standingValue >= 20) {
    standingContext = `The player is FRIENDLY with ${faction.name} (standing: ${standingValue}). Generate a quest where the player HELPS the faction achieve their goal. The faction may offer the quest directly.`;
  } else if (standingValue <= -20) {
    standingContext = `The player is HOSTILE toward ${faction.name} (standing: ${standingValue}). Generate a quest where the player OPPOSES the faction's goal. An opposing faction, wronged party, or independent agent offers this quest.`;
  } else {
    standingContext = `The player is NEUTRAL toward ${faction.name} (standing: ${standingValue}). Generate a quest where the player can CHOOSE to help or oppose the faction. Both sides may approach the player.`;
  }

  // Scale quest complexity by milestone and rewards by standing
  const stageCount = milestone >= 75 ? 3 : 2;
  // Standing-based reward scaling: allied factions are generous, hostile quests pay through other means
  const standingRewardScale = standingValue >= 40 ? 1.5 : standingValue >= 20 ? 1.25 : standingValue <= -20 ? 0.75 : 1.0;
  const baseGold = milestone >= 75 ? 200 : 100;
  const baseXP = milestone >= 75 ? 400 : 200;
  const scaledGold = Math.round(baseGold * standingRewardScale);
  const scaledXP = Math.round(baseXP * standingRewardScale);

  const milestoneContext = {
    25: 'The faction has just begun working toward this goal. The quest involves early-stage activities.',
    50: 'The faction has made significant progress. The quest involves a critical turning point.',
    75: 'The faction is close to achieving their goal. The quest involves high-stakes intervention.',
    100: 'The faction has achieved their goal. The quest deals with the aftermath and consequences.'
  };

  return `You are a D&D quest designer. Generate a FACTION QUEST tied to a faction's activities.

CHARACTER:
- Name: ${character.name}
- Class: ${character.class}
- Level: ${character.level}
- Current Location: ${character.current_location || 'Unknown'}

CAMPAIGN:
- Setting: ${campaign?.setting || 'Forgotten Realms'}
- Tone: ${campaign?.tone || 'heroic fantasy'}

FACTION:
- Name: ${faction.name}
- Description: ${faction.description || 'A powerful organization'}
- Scope: ${faction.scope || 'regional'}
- Power Level: ${faction.power_level || 5}/10

FACTION GOAL:
- Goal: ${goal.title}
- Type: ${goal.goal_type || 'political'}
- Progress: ${milestone}% complete
- Context: ${milestoneContext[milestone] || milestoneContext[50]}

PLAYER STANDING: ${standingContext}

EXISTING QUESTS (avoid overlap): ${existingQuestTitles}

Generate a ${stageCount}-stage FACTION QUEST. This quest should feel directly connected to the faction's activities in the world.

REQUIREMENT TYPES: ${Object.values(REQUIREMENT_TYPES).join(', ')}

Return ONLY valid JSON:
{
  "title": "Quest Title",
  "premise": "One sentence hook tied to faction activities",
  "description": "2-3 sentences describing the quest",
  "stages": [
    {
      "name": "Stage Name",
      "description": "What happens",
      "objectives": ["Objective"]
    }
  ],
  "requirements": [
    {
      "stage_index": 0,
      "type": "adventure_completed",
      "description": "What the player needs to do",
      "params": {"adventure_tag": "investigation"},
      "is_optional": false
    }
  ],
  "rewards": {
    "gold": ${scaledGold},
    "xp": ${scaledXP},
    "items": [],
    "faction_standing_change": ${standingValue >= 20 ? 10 : (standingValue <= -20 ? -10 : 5)}
  },
  "world_impact_on_complete": "How completing this quest affects the faction and world"
}`;
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
        'You are a D&D quest designer. Return ONLY valid JSON, no explanation or markdown.',
        [{ role: 'user', content: prompt }],
        3, 'opus'
      );
      return response;
    } catch (error) {
      console.error('Claude quest generation failed:', error.message);
      // Fall through to Ollama
    }
  }

  // Try Ollama as fallback
  const ollamaStatus = await checkOllamaStatus();
  if (ollamaStatus.available) {
    try {
      const response = await ollamaChat([
        { role: 'system', content: 'You are a D&D quest designer. Return ONLY valid JSON, no explanation or markdown.' },
        { role: 'user', content: prompt }
      ]);
      return response;
    } catch (error) {
      console.error('Ollama quest generation failed:', error.message);
    }
  }

  throw new Error('No AI provider available for quest generation');
}

/**
 * Parse AI response into quest data
 */
function parseQuestResponse(response, questType, context) {
  try {
    const parsed = extractLLMJson(response);

    // Build quest data structure for questService
    const questData = {
      campaign_id: context.campaign?.id || null,
      character_id: context.character?.id || null,
      quest_type: questType,
      source_type: questType === 'companion' ? 'companion' : (questType === 'faction' || questType === 'faction_conflict') ? 'faction' : 'generated',
      source_id: context.companion?.id || context.faction?.id || context.defender?.id || null,
      title: parsed.title,
      premise: parsed.premise,
      description: parsed.description,
      antagonist: parsed.antagonist || null,
      status: 'available',
      priority: questType === 'main' ? 'high' : (questType === 'side' ? 'medium' : 'low'),
      current_stage: 0,
      stages: parsed.stages || [],
      rewards: parsed.rewards || {},
      world_impact_on_complete: parsed.world_impact_on_complete || null,
      time_sensitive: parsed.time_sensitive || false,
      escalation_if_ignored: parsed.escalation_if_ignored || null
    };

    // Extract requirements for separate insertion
    const requirements = (parsed.requirements || []).map(req => ({
      stage_index: req.stage_index || 0,
      requirement_type: req.type,
      description: req.description,
      params: req.params || {},
      is_optional: req.is_optional || false
    }));

    return { quest: questData, requirements };
  } catch (error) {
    console.error('Failed to parse quest response:', error);
    console.error('Response was:', response);
    throw new Error('Failed to parse AI-generated quest');
  }
}

export default {
  generateMainQuest,
  generateSideQuest,
  generateOneTimeQuest,
  generateCompanionQuest,
  generateFactionQuest,
  generateConflictQuest
};
