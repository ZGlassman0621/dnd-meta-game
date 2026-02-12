/**
 * DM Coaching Service — Provides contextual tips for new DMs using Sonnet.
 * Analyzes current session state and offers suggestions for pacing, encounters, and character hooks.
 */

import { isClaudeAvailable, chat as claudeChat } from './claude.js';

const COACHING_SYSTEM_PROMPT = `You are an experienced, friendly D&D Dungeon Master coach. You're helping a new DM run their first games. Your tone is encouraging but practical — give specific, actionable advice, not vague platitudes.

You analyze the current session and provide:
1. A brief scene tip (what's working, what could be better)
2. An encounter or challenge suggestion appropriate to the moment
3. A character hook — a specific opportunity to engage one of the player characters based on their personality, secrets, or relationships

Keep everything SHORT and USEFUL. No more than 2-3 sentences per section.

Return ONLY valid JSON: { "sceneTip": "...", "encounterSuggestion": "...", "characterHook": "..." }`;

/**
 * Generate a coaching tip based on current session state.
 * @param {Array} recentMessages - Last 6-8 messages from the session
 * @param {Array} partyData - Array of 4 character objects
 * @returns {Object} - { sceneTip, encounterSuggestion, characterHook }
 */
export async function generateCoachingTip(recentMessages, partyData) {
  if (!isClaudeAvailable()) {
    return getOfflineTip(partyData);
  }

  const charSummaries = partyData.map(c =>
    `${c.name} (${c.race} ${c.class}, ${c.alignment}): Motivation="${c.motivation}" Secret="${c.secret}" Fear="${c.fear}" Flaw="${c.flaws}"`
  ).join('\n');

  const messageContext = recentMessages
    .slice(-8)
    .map(m => `${m.role === 'user' ? 'DM' : 'Players'}: ${m.content?.substring(0, 200)}`)
    .join('\n');

  const userPrompt = `Here's the current session state:

PARTY:
${charSummaries}

RECENT CONVERSATION:
${messageContext}

Analyze this and provide coaching tips. What should the DM do next? What character hooks are available? What kind of encounter would fit this moment?`;

  try {
    const response = await claudeChat(
      COACHING_SYSTEM_PROMPT,
      [{ role: 'user', content: userPrompt }],
      2,        // maxRetries
      'sonnet', // model (fast + cheap)
      500,      // maxTokens
      true      // rawResponse
    );

    // Parse JSON response
    let jsonStr = response;
    const fenceMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) jsonStr = fenceMatch[1].trim();
    const firstBrace = jsonStr.indexOf('{');
    const lastBrace = jsonStr.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      jsonStr = jsonStr.substring(firstBrace, lastBrace + 1);
    }

    return JSON.parse(jsonStr);
  } catch (error) {
    console.error('Coaching tip generation failed:', error.message);
    return getOfflineTip(partyData);
  }
}

/**
 * Fallback tips when AI is unavailable.
 */
function getOfflineTip(partyData) {
  const tips = [
    { sceneTip: "Remember the rule of three: describe what they see, hear, and smell to make scenes vivid.", encounterSuggestion: "Try a social encounter — have an NPC ask the party for help with something mundane that turns complicated.", characterHook: `Ask ${partyData?.[0]?.name || 'a character'} how they feel about the current situation. Let them roleplay.` },
    { sceneTip: "If the pace feels slow, introduce a complication — a noise, a stranger, a ticking clock.", encounterSuggestion: "A group of travelers on the road: friendly? suspicious? in need of help? Let the party decide.", characterHook: `${partyData?.[1]?.name || 'A character'} has a secret. Create a situation that puts pressure on it.` },
    { sceneTip: "Great DMs ask 'What do you do?' and then wait. Give players space to act.", encounterSuggestion: "Environmental hazard: a rickety bridge, a rising tide, a collapsing tunnel. Not everything is combat.", characterHook: `Two party members disagree on something? Let them argue it out. Don't resolve it for them.` },
  ];
  return tips[Math.floor(Math.random() * tips.length)];
}

/**
 * DC Quick Reference for the coaching panel.
 */
export const DC_REFERENCE = [
  { dc: 5, difficulty: 'Trivial', example: 'Climb a knotted rope, recall common knowledge' },
  { dc: 10, difficulty: 'Easy', example: 'Pick a simple lock, calm a friendly animal' },
  { dc: 15, difficulty: 'Medium', example: 'Navigate a forest, persuade a guard' },
  { dc: 20, difficulty: 'Hard', example: 'Pick a good lock, track through rain' },
  { dc: 25, difficulty: 'Very Hard', example: 'Pick an expert lock, recall obscure lore' },
  { dc: 30, difficulty: 'Nearly Impossible', example: 'Leap a 30ft chasm, convince a king' }
];
