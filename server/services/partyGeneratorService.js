/**
 * Party Generator Service — Generates 4 distinct AI-controlled player characters using Opus.
 * Each party has diverse classes, alignments, voices, and built-in inter-party tensions.
 */

import { isClaudeAvailable, chat as claudeChat } from './claude.js';

const CHARACTER_COLORS = ['#60a5fa', '#c084fc', '#10b981', '#f59e0b'];

function buildSystemPrompt() {
  return `You are a master D&D 5e character designer. You create rich, distinct player characters with genuine personality differences — not surface-level variations of the same voice. Every character you create has real flaws, selfish motivations mixed with noble ones, and a speaking style so distinct that a reader could identify them from dialogue alone.

You ALWAYS return valid JSON. No markdown, no code fences, no commentary outside the JSON.`;
}

function buildGenerationPrompt(config) {
  const { setting = 'Forgotten Realms', tone = 'heroic fantasy', level = 3 } = config;

  return `Generate a party of 4 D&D 5e adventurers for a ${tone} campaign set in ${setting}. Starting level: ${level}.

=== HARD REQUIREMENTS ===

CLASS DIVERSITY (mandatory — no duplicates):
Pick 4 DIFFERENT classes. The party must cover these roles:
- One frontline melee (Fighter, Paladin, Barbarian)
- One ranged/stealth (Rogue, Ranger, Monk)
- One healer/divine (Cleric, Druid, Paladin — if Paladin fills frontline, use Cleric or Druid here)
- One arcane caster (Wizard, Sorcerer, Warlock, Bard)

ALIGNMENT SPREAD (mandatory — no duplicates):
Each character has a DIFFERENT alignment. Requirements:
- At least one character is morally ambiguous or selfish (Chaotic Neutral, True Neutral leaning selfish, or Neutral Evil)
- At least one character has a strong moral compass (Lawful Good, Neutral Good)
- The other two should contrast (e.g., Chaotic Good and Lawful Neutral)

VOICE DIVERSITY (mandatory — this is the most important requirement):
Each character MUST have a genuinely different way of speaking:
- Character A: Formal, measured, uses metaphors and complete sentences
- Character B: Terse, practical, never uses two words when one will do
- Character C: Chatty, uses humor to deflect, nicknames everyone, can't sit still
- Character D: Thoughtful but awkward, eloquent about their specialty, stumbles in casual conversation
You may reassign these voice archetypes, but each character MUST have a clearly distinct pattern.

INTER-PARTY TENSIONS (minimum 3 specific tensions):
- Two characters who fundamentally disagree on a moral issue (e.g., "the ends justify the means" vs. "never")
- One character has a secret that would damage trust if revealed
- One relationship where Character A respects Character B, but B resents or distrusts A
- One character who is only with the group out of necessity (payment, debt, running from something), NOT loyalty

INTERLOCKING BACKSTORIES:
These 4 characters did NOT meet randomly at a tavern. There is a specific reason they are together — a shared event, a mutual employer, a debt, a coincidence that bound them. Explain what brought them together and why they stay.

PARTY NAME:
Generate a party name that reflects their dynamic or origin (e.g., "The Reluctant Accord", "Ashfall Company", "The Broken Oath").

=== CHARACTER DATA FORMAT ===

For each character, provide ALL of these fields:

{
  "name": "Full name",
  "race": "D&D 5e race",
  "subrace": "if applicable, else null",
  "gender": "Male/Female/Nonbinary",
  "class": "D&D 5e class",
  "subclass": "D&D 5e subclass appropriate for level ${level}",
  "background": "D&D 5e background",
  "level": ${level},
  "ability_scores": { "str": N, "dex": N, "con": N, "int": N, "wis": N, "cha": N },
  "max_hp": N,
  "current_hp": N,
  "armor_class": N,
  "speed": N,
  "skill_proficiencies": ["Skill1", "Skill2", ...],
  "tool_proficiencies": ["Tool1", ...],
  "equipment": {
    "mainHand": { "name": "Weapon", "damage": "1d8", "damageType": "slashing", "properties": ["versatile"] },
    "offHand": null or { "name": "Shield", "ac_bonus": 2 },
    "armor": { "name": "Chain Mail", "baseAC": 16, "type": "heavy" }
  },
  "inventory": ["Item1", "Item2", ...],
  "gold_gp": N,
  "known_cantrips": ["Cantrip1", ...] or [],
  "known_spells": ["Spell1", ...] or [],
  "spell_slots": { "1": N, "2": N } or {},
  "spell_slots_used": {},
  "alignment": "e.g. Chaotic Neutral",
  "personality_traits": "2-3 sentences. Real personality, not generic.",
  "ideals": "What they believe in. Can be selfish.",
  "bonds": "What they care about. Specific people/places/things.",
  "flaws": "Genuine flaws that cause problems. Not 'too brave' — real weaknesses like cowardice, greed, distrust, addiction, arrogance.",
  "motivation": "Why they adventure. Can be selfish: money, revenge, escape, curiosity.",
  "fear": "What genuinely scares them.",
  "secret": "Something they hide from the party. Should have narrative consequences if revealed.",
  "quirk": "A distinctive behavioral quirk.",
  "mannerism": "A physical or verbal mannerism.",
  "voice": "Brief description of how they sound.",
  "speaking_style": "Detailed description of vocabulary, sentence structure, emotional register. 2-3 sentences.",
  "combat_style": "How they fight. Aggressive/cautious/tactical/reckless. 1-2 sentences.",
  "social_style": "How they interact with NPCs and party. Leader/follower/loner/mediator. 1-2 sentences.",
  "moral_tendencies": "How they make moral decisions. What they'd do vs. what they'd refuse. 1-2 sentences.",
  "party_relationships": {
    "OtherCharName1": { "attitude": "one-word", "tension": "one sentence describing the friction or bond" },
    "OtherCharName2": { "attitude": "one-word", "tension": "..." },
    "OtherCharName3": { "attitude": "one-word", "tension": "..." }
  }
}

=== OUTPUT FORMAT ===

Return ONLY this JSON structure:
{
  "party_name": "The Party Name",
  "party_concept": "2-3 sentences explaining why these 4 are together and what holds them (loosely) as a group.",
  "characters": [ ... 4 character objects ... ],
  "tensions": [
    "Tension 1: Description of the moral disagreement between X and Y",
    "Tension 2: Description of the secret and its potential fallout",
    "Tension 3: Description of the one-sided respect/resentment",
    "Tension 4: Description of why one member would leave if they could"
  ]
}`;
}

function parsePartyResponse(response) {
  // Try to extract JSON from the response
  let jsonStr = response;

  // Strip markdown code fences if present
  const fenceMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    jsonStr = fenceMatch[1].trim();
  }

  // Find JSON object boundaries
  const firstBrace = jsonStr.indexOf('{');
  const lastBrace = jsonStr.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    jsonStr = jsonStr.substring(firstBrace, lastBrace + 1);
  }

  const parsed = JSON.parse(jsonStr);

  // Validate structure
  if (!parsed.party_name || !parsed.characters || parsed.characters.length !== 4) {
    throw new Error('Invalid party response: missing party_name or need exactly 4 characters');
  }

  // Assign colors to characters
  parsed.characters.forEach((char, i) => {
    char.color = CHARACTER_COLORS[i];
    // Ensure HP is set
    if (!char.current_hp) char.current_hp = char.max_hp;
    // Ensure spell_slots_used exists
    if (!char.spell_slots_used) char.spell_slots_used = {};
  });

  return parsed;
}

/**
 * Generate a party of 4 diverse D&D characters using Opus.
 * @param {Object} config - { setting, tone, level }
 * @returns {Object} - { party_name, party_concept, characters: [...], tensions: [...] }
 */
export async function generateParty(config = {}) {
  if (!isClaudeAvailable()) {
    throw new Error('Claude API not available — ANTHROPIC_API_KEY not set');
  }

  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildGenerationPrompt(config);

  const response = await claudeChat(
    systemPrompt,
    [{ role: 'user', content: userPrompt }],
    3,       // maxRetries
    'opus',  // model
    12000,   // maxTokens (4 full character sheets)
    true     // rawResponse (JSON)
  );

  return parsePartyResponse(response);
}

export { buildSystemPrompt, buildGenerationPrompt, parsePartyResponse };
