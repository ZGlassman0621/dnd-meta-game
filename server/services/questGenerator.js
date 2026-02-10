/**
 * Quest Generator Service
 *
 * Generates structured quests using AI (Claude primary, Ollama fallback).
 * Creates main quests (5 stages), side quests (2-3 stages), and one-time quests.
 */

import { isClaudeAvailable, chat as claudeChat } from './claude.js';
import { checkOllamaStatus, chat as ollamaChat } from './ollama.js';
import { REQUIREMENT_TYPES } from '../config/eventTypes.js';

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
  // Extract JSON from response (handle markdown code blocks)
  let jsonStr = response;
  const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1];
  }

  // Try to find JSON object in response
  const objectMatch = jsonStr.match(/\{[\s\S]*\}/);
  if (objectMatch) {
    jsonStr = objectMatch[0];
  }

  try {
    const parsed = JSON.parse(jsonStr);

    // Build quest data structure for questService
    const questData = {
      campaign_id: context.campaign?.id || null,
      character_id: context.character?.id || null,
      quest_type: questType,
      source_type: questType === 'companion' ? 'companion' : 'generated',
      source_id: context.companion?.id || null,
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
  generateCompanionQuest
};
