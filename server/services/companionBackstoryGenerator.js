/**
 * Companion Backstory Generator Service
 *
 * Generates rich backstories for companions using AI (Claude primary, Ollama fallback).
 * Creates origin stories, unresolved threads, secrets, and loyalty triggers.
 */

import { isClaudeAvailable, chat as claudeChat } from './claude.js';
import { checkOllamaStatus, chat as ollamaChat } from './ollama.js';
import { randomUUID } from 'crypto';

/**
 * Generate a complete backstory for a companion
 * @param {object} context - Context for generation
 * @param {object} context.companion - The companion NPC data
 * @param {object} context.character - The player character they serve
 * @param {object} context.campaign - Campaign settings
 * @returns {object} Generated backstory data ready for companionBackstoryService
 */
export async function generateBackstory(context) {
  const prompt = buildBackstoryPrompt(context);
  const result = await generateWithAI(prompt);
  return parseBackstoryResponse(result, context);
}

/**
 * Generate additional unresolved threads for an existing backstory
 * @param {object} context - Context including existing backstory
 * @returns {array} New threads to add
 */
export async function generateAdditionalThreads(context) {
  const prompt = buildThreadsPrompt(context);
  const result = await generateWithAI(prompt);
  return parseThreadsResponse(result);
}

/**
 * Generate a secret for a companion
 * @param {object} context - Context for generation
 * @returns {object} Generated secret
 */
export async function generateSecret(context) {
  const prompt = buildSecretPrompt(context);
  const result = await generateWithAI(prompt);
  return parseSecretResponse(result);
}

// ============================================================
// PROMPT BUILDERS
// ============================================================

function buildBackstoryPrompt(context) {
  const { companion, character, campaign } = context;

  return `You are a D&D character backstory writer. Generate a rich backstory for a companion NPC.

COMPANION:
- Name: ${companion.name}
- Race: ${companion.race}
- Gender: ${companion.gender || 'unspecified'}
- Occupation/Background: ${companion.occupation || companion.background || 'Unknown'}
- Current Location: ${companion.current_location || 'Unknown'}
- Personality: ${companion.personality_trait_1 || ''} ${companion.personality_trait_2 || ''}
- Motivation: ${companion.motivation || 'Unknown'}

THE PLAYER CHARACTER (their traveling companion, NOT their master):
- Name: ${character.name}
- Class: ${character.class}
- Background: ${character.background || 'Unknown'}

CAMPAIGN:
- Setting: ${campaign?.setting || 'Forgotten Realms'}
- Tone: ${campaign?.tone || 'heroic fantasy'}

Generate a compelling backstory with:
1. An origin story (where they came from)
2. A formative event (what shaped them)
3. A personal goal (what they want to achieve — can be selfish: wealth, revenge, escape, power, proving themselves)
4. 2-3 unresolved threads (past conflicts/relationships that could resurface)
5. 1-2 secrets (things they haven't told the player — can be morally compromising)

MORAL COMPLEXITY — CRITICAL:
- This companion is NOT a loyal sidekick. They are an independent person with their own moral compass.
- Their personality and flaws should create FRICTION and interesting dynamics, not just support the player.
- Give them REAL flaws that affect behavior: cowardice, greed, prejudice, impulsiveness, distrust, jealousy, zealotry, bitterness, or selfishness.
- Their loyalty triggers should reflect their VALUES — a mercenary's loyalty drops if underpaid, a lawful companion's loyalty drops if the player breaks laws.
- Secrets should include morally questionable choices they've made, not just sad backstory.

THREAD TYPES: family, enemy, debt, romance, mystery, vengeance, redemption, lost_item, forgotten_past

Return ONLY valid JSON:
{
  "origin_location": "Place name",
  "origin_description": "2-3 sentences about their background and upbringing",
  "formative_event": "The defining moment that shaped who they are today",
  "formative_event_date": "Relative time (e.g., '5 years ago', 'childhood')",
  "personal_goal": "What they ultimately want to achieve",
  "goal_progress": 0,
  "unresolved_threads": [
    {
      "id": "unique-id",
      "type": "family|enemy|debt|romance|mystery|vengeance|redemption|lost_item|forgotten_past",
      "description": "What this thread is about",
      "intensity": 1-10,
      "status": "dormant",
      "activation_triggers": ["keyword1", "keyword2", "location_name"],
      "potential_resolution": "How this might be resolved"
    }
  ],
  "secrets": [
    {
      "id": "unique-id",
      "content": "The secret itself",
      "category": "shameful|dangerous|valuable|tragic|hopeful",
      "loyalty_threshold": 50-90,
      "reveal_consequence": "What happens when revealed"
    }
  ],
  "loyalty_triggers": {
    "increase": ["What makes them more loyal"],
    "decrease": ["What damages their loyalty"]
  }
}`;
}

function buildThreadsPrompt(context) {
  const { companion, backstory, campaign } = context;

  const existingThreads = backstory?.unresolved_threads?.map(t => t.description).join(', ') || 'None';

  return `You are a D&D story writer. Generate additional story threads for a companion.

COMPANION:
- Name: ${companion.name}
- Origin: ${backstory?.origin_description || 'Unknown'}
- Formative Event: ${backstory?.formative_event || 'Unknown'}
- Personal Goal: ${backstory?.personal_goal || 'Unknown'}

EXISTING THREADS (avoid overlap): ${existingThreads}

CAMPAIGN:
- Setting: ${campaign?.setting || 'Forgotten Realms'}
- Tone: ${campaign?.tone || 'heroic fantasy'}

Generate 2 NEW unresolved threads that could create interesting story moments.

THREAD TYPES: family, enemy, debt, romance, mystery, vengeance, redemption, lost_item, forgotten_past

Return ONLY valid JSON:
{
  "threads": [
    {
      "id": "unique-id",
      "type": "thread_type",
      "description": "What this thread is about",
      "intensity": 1-10,
      "status": "dormant",
      "activation_triggers": ["trigger1", "trigger2"],
      "potential_resolution": "How this might be resolved"
    }
  ]
}`;
}

function buildSecretPrompt(context) {
  const { companion, backstory, secretCategory } = context;

  const categories = {
    shameful: 'Something they are ashamed of',
    dangerous: 'Something that could endanger them or others',
    valuable: 'Knowledge or possession that others would want',
    tragic: 'A loss or trauma they hide',
    hopeful: 'A dream or aspiration they keep private'
  };

  return `You are a D&D story writer. Generate a secret for a companion NPC.

COMPANION:
- Name: ${companion.name}
- Origin: ${backstory?.origin_description || 'Unknown'}
- Personality: ${companion.personality_trait_1 || 'Unknown'}

SECRET CATEGORY: ${categories[secretCategory] || secretCategory || 'Any'}

Generate ONE meaningful secret that could create interesting roleplay when revealed.

Return ONLY valid JSON:
{
  "secret": {
    "id": "unique-id",
    "content": "The secret itself - be specific and evocative",
    "category": "${secretCategory || 'tragic'}",
    "loyalty_threshold": 50-90,
    "reveal_consequence": "What happens when this is revealed"
  }
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
        'You are a D&D backstory writer. Return ONLY valid JSON, no explanation or markdown.',
        [{ role: 'user', content: prompt }],
        3, 'opus'
      );
      return response;
    } catch (error) {
      console.error('Claude backstory generation failed:', error.message);
    }
  }

  // Try Ollama as fallback
  const ollamaStatus = await checkOllamaStatus();
  if (ollamaStatus.available) {
    try {
      const response = await ollamaChat([
        { role: 'system', content: 'You are a D&D backstory writer. Return ONLY valid JSON, no explanation or markdown.' },
        { role: 'user', content: prompt }
      ]);
      return response;
    } catch (error) {
      console.error('Ollama backstory generation failed:', error.message);
    }
  }

  throw new Error('No AI provider available for backstory generation');
}

// ============================================================
// RESPONSE PARSERS
// ============================================================

function parseBackstoryResponse(response, context) {
  let jsonStr = response;

  // Handle markdown code blocks
  const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1];
  }

  // Find JSON object
  const objectMatch = jsonStr.match(/\{[\s\S]*\}/);
  if (objectMatch) {
    jsonStr = objectMatch[0];
  }

  try {
    const parsed = JSON.parse(jsonStr);

    // Ensure all threads and secrets have unique IDs
    const threads = (parsed.unresolved_threads || []).map(thread => ({
      ...thread,
      id: thread.id || randomUUID(),
      status: thread.status || 'dormant',
      intensity: thread.intensity || 5
    }));

    const secrets = (parsed.secrets || []).map(secret => ({
      ...secret,
      id: secret.id || randomUUID(),
      revealed: false
    }));

    return {
      companion_id: context.companion?.id || null,
      origin_location: parsed.origin_location,
      origin_description: parsed.origin_description,
      formative_event: parsed.formative_event,
      formative_event_date: parsed.formative_event_date,
      personal_goal: parsed.personal_goal,
      goal_progress: parsed.goal_progress || 0,
      unresolved_threads: threads,
      loyalty: 50, // Start at neutral
      loyalty_events: [],
      secrets: secrets,
      // Extra data for service use
      _loyalty_triggers: parsed.loyalty_triggers || { increase: [], decrease: [] }
    };
  } catch (error) {
    console.error('Failed to parse backstory response:', error);
    console.error('Response was:', response);
    throw new Error('Failed to parse AI-generated backstory');
  }
}

function parseThreadsResponse(response) {
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
    const threads = parsed.threads || [];

    return threads.map(thread => ({
      ...thread,
      id: thread.id || randomUUID(),
      status: thread.status || 'dormant',
      intensity: thread.intensity || 5
    }));
  } catch (error) {
    console.error('Failed to parse threads response:', error);
    return [];
  }
}

function parseSecretResponse(response) {
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
    const secret = parsed.secret || parsed;

    return {
      ...secret,
      id: secret.id || randomUUID(),
      revealed: false
    };
  } catch (error) {
    console.error('Failed to parse secret response:', error);
    return null;
  }
}

export default {
  generateBackstory,
  generateAdditionalThreads,
  generateSecret
};
