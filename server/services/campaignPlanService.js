/**
 * Campaign Plan Service
 *
 * Generates comprehensive campaign plans using Claude Opus 4.5.
 * Creates living worlds with independent events, backstory integration,
 * and long-term narrative arcs set in Faerun circa 1350 DR.
 */

import { isClaudeAvailable, chat as claudeChat } from './claude.js';
import { dbGet, dbRun, dbAll } from '../database.js';
import { randomUUID } from 'crypto';
import { createMerchantsFromPlan } from './merchantService.js';

/**
 * Generate a comprehensive campaign plan using Opus
 * @param {number} campaignId - The campaign ID
 * @param {number} characterId - The primary character ID (for backstory integration)
 * @returns {object} Generated campaign plan
 */
export async function generateCampaignPlan(campaignId, characterId) {
  const campaign = await dbGet('SELECT * FROM campaigns WHERE id = ?', [campaignId]);
  if (!campaign) {
    throw new Error('Campaign not found');
  }

  const character = await dbGet('SELECT * FROM characters WHERE id = ?', [characterId]);
  if (!character) {
    throw new Error('Character not found');
  }

  // Get parsed backstory elements if available
  const parsedBackstory = character.parsed_backstory
    ? JSON.parse(character.parsed_backstory)
    : null;

  // Get any existing companions
  const companions = await dbAll(
    'SELECT * FROM companions WHERE recruited_by_character_id = ? AND status = ?',
    [characterId, 'active']
  );

  // Build the generation prompt
  const prompt = buildPlanningPrompt(campaign, character, parsedBackstory, companions);

  // Generate with Opus (required for quality campaign planning)
  if (!isClaudeAvailable()) {
    throw new Error('Claude API is required for campaign plan generation');
  }

  const response = await claudeChat(
    buildSystemPrompt(),
    [{ role: 'user', content: prompt }],
    3,
    'opus',  // Use Opus 4.5 for campaign planning
    16000,   // Campaign plans are large - need high token budget
    true     // Raw response - don't run cleanup on JSON
  );

  const plan = parseAIResponse(response);

  // Store the plan
  await dbRun(
    'UPDATE campaigns SET campaign_plan = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [JSON.stringify(plan), campaignId]
  );

  // Create persistent merchant inventory entries from the plan
  try {
    await createMerchantsFromPlan(campaignId, plan);
  } catch (e) {
    console.error('Error creating merchants from plan:', e.message);
  }

  return plan;
}

/**
 * Get the current campaign plan
 * @param {number} campaignId - The campaign ID
 * @returns {object|null} Campaign plan or null
 */
export async function getCampaignPlan(campaignId) {
  const campaign = await dbGet('SELECT campaign_plan FROM campaigns WHERE id = ?', [campaignId]);
  if (!campaign) {
    throw new Error('Campaign not found');
  }

  if (!campaign.campaign_plan) {
    return null;
  }

  return JSON.parse(campaign.campaign_plan);
}

/**
 * Update a specific section of the campaign plan
 * @param {number} campaignId - The campaign ID
 * @param {string} section - Section to update (e.g., 'main_quest', 'world_events')
 * @param {object} updates - Updated data for that section
 * @returns {object} Updated campaign plan
 */
export async function updatePlanSection(campaignId, section, updates) {
  const campaign = await dbGet('SELECT campaign_plan FROM campaigns WHERE id = ?', [campaignId]);
  if (!campaign || !campaign.campaign_plan) {
    throw new Error('No campaign plan found');
  }

  const plan = JSON.parse(campaign.campaign_plan);

  if (!plan[section]) {
    throw new Error(`Invalid section: ${section}`);
  }

  plan[section] = { ...plan[section], ...updates };
  plan.last_modified = new Date().toISOString();

  await dbRun(
    'UPDATE campaigns SET campaign_plan = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [JSON.stringify(plan), campaignId]
  );

  return plan;
}

/**
 * Add a world event to the campaign plan
 * @param {number} campaignId - The campaign ID
 * @param {object} event - The world event to add
 * @returns {object} Updated campaign plan
 */
export async function addWorldEvent(campaignId, event) {
  const campaign = await dbGet('SELECT campaign_plan FROM campaigns WHERE id = ?', [campaignId]);
  if (!campaign || !campaign.campaign_plan) {
    throw new Error('No campaign plan found');
  }

  const plan = JSON.parse(campaign.campaign_plan);

  const newEvent = {
    ...event,
    id: event.id || randomUUID(),
    manually_added: true
  };

  plan.world_timeline.events.push(newEvent);
  plan.last_modified = new Date().toISOString();

  await dbRun(
    'UPDATE campaigns SET campaign_plan = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [JSON.stringify(plan), campaignId]
  );

  return plan;
}

/**
 * Add an NPC to the campaign plan
 * @param {number} campaignId - The campaign ID
 * @param {object} npc - The NPC to add
 * @returns {object} Updated campaign plan
 */
export async function addNPC(campaignId, npc) {
  const campaign = await dbGet('SELECT campaign_plan FROM campaigns WHERE id = ?', [campaignId]);
  if (!campaign || !campaign.campaign_plan) {
    throw new Error('No campaign plan found');
  }

  const plan = JSON.parse(campaign.campaign_plan);

  const newNPC = {
    ...npc,
    id: npc.id || randomUUID(),
    manually_added: true
  };

  plan.npcs.push(newNPC);
  plan.last_modified = new Date().toISOString();

  await dbRun(
    'UPDATE campaigns SET campaign_plan = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [JSON.stringify(plan), campaignId]
  );

  return plan;
}

// ============================================================
// SYSTEM PROMPT
// ============================================================

function buildSystemPrompt() {
  return `You are a master Dungeon Master and world-builder for Dungeons & Dragons campaigns. You are creating a comprehensive campaign plan for the Forgotten Realms setting, specifically in the year 1350 DR (the Time of Troubles is still 8 years away).

THE MOST IMPORTANT RULE: The CAMPAIGN DESCRIPTION provided by the user defines the main quest's tone, premise, and central conflict. The main quest MUST directly fulfill the vision described in the campaign description. The character's backstory is secondary - backstory characters should be woven INTO the campaign description's vision as supporting elements, personal connections, and emotional stakes. Do NOT replace the campaign's central premise with a storyline derived purely from the backstory.

Your goal is to create a LIVING WORLD that:
1. Fulfills the campaign description's vision as its PRIMARY narrative
2. Feels real and dynamic - events happen regardless of player actions
3. Weaves the player's backstory characters into the campaign as important NPCs
4. Has political intrigue, faction conflicts, and world-changing events
5. Provides a main quest arc but allows for player agency
6. Includes NPCs with their own motivations and agendas

CRITICAL: You must use the characters, mentors, and NPCs from the player's backstory. Do NOT invent generic NPCs (like "Brother Aldous" or "Old Man Jenkins") when backstory characters exist. But their roles must serve the CAMPAIGN DESCRIPTION's vision, not replace it.

IMPORTANT FORMATTING RULES:
- Return ONLY valid JSON, no explanation or markdown code fences.
- Be CONCISE. Each description field should be 1-3 sentences max.
- NPC descriptions: 1-2 sentences for appearance/personality.
- Motivations, secrets, summaries: 1-2 sentences each.
- Act summaries: 2-3 sentences max.
- Keep the total response compact. Quality over quantity.`;
}

// ============================================================
// PROMPT BUILDER
// ============================================================

function buildPlanningPrompt(campaign, character, parsedBackstory, companions) {
  // Extract backstory characters for emphasis
  const backstoryCharacters = parsedBackstory?.elements?.characters || [];
  const backstoryLocations = parsedBackstory?.elements?.locations || [];
  const backstoryFactions = parsedBackstory?.elements?.factions || [];
  const backstoryHooks = parsedBackstory?.elements?.story_hooks || [];

  return `Create a comprehensive campaign plan for a D&D 5e campaign in the Forgotten Realms.

=== CAMPAIGN VISION (THIS IS THE #1 PRIORITY) ===
The following campaign description defines the MAIN QUEST's tone, premise, and central narrative. Everything you generate must serve this vision:

"${campaign.description || 'A new adventure in Faerun'}"

Campaign Name: ${campaign.name}
Setting: ${campaign.setting || 'Forgotten Realms'}
Year: 1350 DR (Dale Reckoning)
Tone: ${campaign.tone || 'heroic fantasy'}
Starting Location: ${campaign.starting_location || 'To be determined based on character backstory'}

The main quest title, summary, hook, stakes, and acts MUST directly reflect the campaign vision above. The character's backstory elements should be woven into this vision as personal stakes and emotional connections - NOT replace it with their own storyline.
=== END CAMPAIGN VISION ===

PRIMARY CHARACTER:
- Name: ${character.name}
- Race: ${character.race}
- Class: ${character.class}
- Background: ${character.background}
- Level: ${character.level || 1}

CHARACTER BACKSTORY:
${character.backstory || 'No backstory provided'}

${backstoryCharacters.length > 0 ? `
BACKSTORY CHARACTERS (MUST USE THESE - DO NOT INVENT REPLACEMENTS):
${backstoryCharacters.map(c => `- ${c.name}: ${c.relationship} - ${c.description} (Status: ${c.status})`).join('\n')}
` : ''}

${backstoryLocations.length > 0 ? `
BACKSTORY LOCATIONS:
${backstoryLocations.map(l => `- ${l.name}: ${l.type} - ${l.description}`).join('\n')}
` : ''}

${backstoryFactions.length > 0 ? `
BACKSTORY FACTIONS:
${backstoryFactions.map(f => `- ${f.name}: ${f.relationship} - ${f.description}`).join('\n')}
` : ''}

${backstoryHooks.length > 0 ? `
STORY HOOKS FROM BACKSTORY:
${backstoryHooks.map(h => `- ${h.title}: ${h.description} (Category: ${h.category})`).join('\n')}
` : ''}

${companions.length > 0 ? `
CURRENT COMPANIONS:
${companions.map(c => `- ${c.name}: ${c.race} ${c.occupation} - ${c.personality_traits}`).join('\n')}
` : ''}

HISTORICAL CONTEXT FOR 1350 DR:
- The Harpers are active but secretive
- Zhentarim influence is growing in the Moonsea region
- Thay's Red Wizards are expanding their trade enclaves
- The Sword Coast is relatively stable but threatened by orcish tribes
- Waterdeep is ruled by the Lords of Waterdeep
- Baldur's Gate is a major trading hub
- Cult of the Dragon seeks to create dracoliches
- Cormyr is strong under King Azoun IV

Generate a campaign plan with this EXACT JSON structure:
{
  "version": 1,
  "generated_at": "ISO timestamp",

  "main_quest": {
    "title": "Epic title for the main quest",
    "summary": "2-3 paragraph overview of the main quest arc",
    "hook": "How the character gets drawn into this quest (MUST use backstory elements)",
    "stakes": "What happens if the heroes fail",
    "acts": [
      {
        "act_number": 1,
        "title": "Act title",
        "summary": "What happens in this act",
        "key_locations": ["Location names"],
        "key_npcs": ["NPC names from this plan"],
        "potential_outcomes": ["Possible ways this act could resolve"]
      }
    ]
  },

  "world_state": {
    "political_situation": "Current political tensions in the region",
    "major_threats": ["Active threats in the world"],
    "faction_tensions": [
      {
        "factions": ["Faction A", "Faction B"],
        "nature": "What they're fighting about",
        "current_state": "How this affects the region"
      }
    ],
    "regional_news": ["Recent events commoners would know about"]
  },

  "world_timeline": {
    "description": "Events that will happen regardless of player intervention",
    "events": [
      {
        "id": "unique_id",
        "title": "Event title",
        "description": "What happens",
        "timing": "When this occurs (e.g., '2 weeks from campaign start', 'End of Act 1')",
        "visibility": "public|rumored|secret",
        "affected_locations": ["Location names"],
        "affected_factions": ["Faction names"],
        "player_can_influence": true,
        "consequences_if_ignored": "What happens if players don't intervene"
      }
    ]
  },

  "npcs": [
    {
      "id": "unique_id",
      "name": "NPC name",
      "role": "ally|enemy|neutral|patron|rival|mentor",
      "from_backstory": true,
      "description": "Physical description and personality",
      "motivation": "What drives this NPC",
      "secrets": ["Things they're hiding"],
      "location": "Where they can typically be found",
      "faction_affiliations": ["Factions they belong to"],
      "relationship_to_player": "How they connect to the PC"
    }
  ],

  "potential_companions": [
    {
      "id": "unique_id",
      "name": "Companion name",
      "race": "Race",
      "class": "Class suggestion",
      "personality": "Brief personality description",
      "motivation": "Why they would join the party",
      "connection_to_main_quest": "How they tie into the story",
      "recruitment_location": "Where they can be found",
      "personal_quest_hook": "Potential personal storyline"
    }
  ],

  "locations": [
    {
      "id": "unique_id",
      "name": "Location name",
      "type": "city|town|village|dungeon|wilderness|landmark",
      "region": "Geographic region in Faerun",
      "description": "What makes this place notable",
      "importance_to_plot": "Why this location matters",
      "notable_features": ["Key features or landmarks"],
      "dangers": ["Threats in this location"],
      "opportunities": ["What players can gain here"]
    }
  ],

  "merchants": [
    {
      "id": "unique_id",
      "name": "Merchant name (a named character)",
      "type": "general|blacksmith|alchemist|magic|jeweler|tanner|tailor",
      "location": "Which plan location they operate in",
      "specialty": "What they're known for (e.g., 'exotic weapons from Calimshan')",
      "personality": "Brief personality (1 sentence)",
      "prosperity_level": "poor|modest|comfortable|wealthy|aristocratic"
    }
  ],

  "factions": [
    {
      "id": "unique_id",
      "name": "Faction name",
      "type": "guild|religious|criminal|political|military|arcane",
      "alignment_tendency": "general alignment",
      "description": "What this faction is about",
      "goals": ["What they're trying to achieve"],
      "resources": ["What they have at their disposal"],
      "relationship_to_party": "ally|enemy|neutral|potential",
      "key_members": ["Important NPCs in this faction"]
    }
  ],

  "side_quests": [
    {
      "id": "unique_id",
      "title": "Quest title",
      "type": "personal|faction|exploration|mystery|combat",
      "description": "Brief quest description",
      "quest_giver": "NPC who gives this quest",
      "location": "Where this quest takes place",
      "rewards": "What players can gain",
      "connection_to_main_quest": "How it ties in (if at all)"
    }
  ],

  "themes": ["Major themes to explore in this campaign"],

  "dm_notes": {
    "session_zero_topics": ["Things to discuss with players"],
    "potential_twists": ["Surprising developments to consider"],
    "backup_hooks": ["Alternative ways to engage players if they go off-track"],
    "tone_guidance": "How to maintain the campaign's tone"
  }
}

IMPORTANT RULES:
1. The MAIN QUEST must directly fulfill the CAMPAIGN VISION above - it is the #1 priority. Do NOT generate a main quest based solely on the backstory if the campaign description tells a different story.
2. MUST use NPCs from the character's backstory - they should appear in the npcs array with from_backstory: true. Their roles should serve the campaign vision.
3. The hook for the main quest should connect to the character's personal history while serving the campaign vision
4. World events should feel consequential - not everything revolves around the player
5. Include at least 5 world timeline events that happen independently
6. Factions should have their own agendas that create opportunities and complications
7. Potential companions should have their own stories, not just be sidekicks
8. BE CONCISE - keep descriptions to 1-3 sentences. Keep secrets to short phrases. The entire JSON must fit within 12000 tokens.
9. Limit to 6-8 NPCs, 3-4 companions, 5-6 locations, 3-4 factions, 4-5 side quests
10. 3 acts maximum for the main quest
11. Generate merchants scaled by settlement size. For each location in the plan:
    - City: 5-8 merchants (diverse types — blacksmith, alchemist, magic shop, jeweler, tailor, general stores, etc.)
    - Town: 3-4 merchants (common types — general, blacksmith, alchemist, maybe one specialty)
    - Village: 1-2 merchants (general store, maybe a blacksmith)
    - Also include 1-2 traveling merchants not tied to a specific location
    - Prosperity should match the settlement's wealth (poor village = poor merchants, wealthy city district = wealthy shops)
    - Each merchant type should fit their location naturally
    - Skip dungeon/wilderness/landmark locations (no merchants there unless it makes narrative sense)`;
}

// ============================================================
// RESPONSE PARSER
// ============================================================

function parseAIResponse(response) {
  if (!response || typeof response !== 'string') {
    throw new Error(`Invalid response from AI: got ${typeof response}`);
  }

  let jsonStr = response;

  // Handle markdown code blocks
  const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1];
  }

  // Find JSON object - match from first { to last }
  const firstBrace = jsonStr.indexOf('{');
  const lastBrace = jsonStr.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    jsonStr = jsonStr.substring(firstBrace, lastBrace + 1);
  }

  // Fix common AI JSON issues: trailing commas before } or ]
  jsonStr = jsonStr.replace(/,\s*([}\]])/g, '$1');

  try {
    const parsed = JSON.parse(jsonStr);

    // Ensure all arrays have IDs
    const ensureIds = (items) => {
      return (items || []).map(item => ({
        ...item,
        id: item.id || randomUUID()
      }));
    };

    return {
      version: parsed.version || 1,
      generated_at: parsed.generated_at || new Date().toISOString(),
      last_modified: new Date().toISOString(),

      main_quest: parsed.main_quest || { title: 'Untitled Quest', summary: '', hook: '', stakes: '', acts: [] },
      world_state: parsed.world_state || { political_situation: '', major_threats: [], faction_tensions: [], regional_news: [] },
      world_timeline: {
        description: parsed.world_timeline?.description || '',
        events: ensureIds(parsed.world_timeline?.events)
      },
      npcs: ensureIds(parsed.npcs),
      potential_companions: ensureIds(parsed.potential_companions),
      locations: ensureIds(parsed.locations),
      merchants: ensureIds(parsed.merchants),
      factions: ensureIds(parsed.factions),
      side_quests: ensureIds(parsed.side_quests),
      themes: parsed.themes || [],
      dm_notes: parsed.dm_notes || {}
    };
  } catch (error) {
    console.error('Failed to parse campaign plan response:', error.message);
    console.error('Response length:', response.length);
    console.error('Response start:', response.substring(0, 300));
    console.error('Response end:', response.substring(response.length - 300));
    throw new Error('Failed to parse AI-generated campaign plan');
  }
}

/**
 * Get a summary of the campaign plan for DM session context
 * @param {number} campaignId - The campaign ID
 * @returns {object|null} Summarized plan for session context
 */
export async function getPlanSummaryForSession(campaignId) {
  const plan = await getCampaignPlan(campaignId);
  if (!plan) return null;

  return {
    main_quest_title: plan.main_quest?.title,
    main_quest_summary: plan.main_quest?.summary,
    main_quest_hook: plan.main_quest?.hook,
    main_quest_stakes: plan.main_quest?.stakes,
    current_act: plan.main_quest?.acts?.[0],
    world_state: plan.world_state,
    active_npcs: plan.npcs?.filter(n => n.from_backstory).map(n => ({
      name: n.name,
      role: n.role,
      motivation: n.motivation,
      location: n.location
    })),
    all_npcs: plan.npcs?.filter(n => !n.from_backstory).map(n => ({
      name: n.name,
      role: n.role,
      location: n.location
    })),
    upcoming_events: plan.world_timeline?.events?.slice(0, 3).map(e => ({
      title: e.title,
      timing: e.timing,
      visibility: e.visibility
    })),
    merchants: plan.merchants?.map(m => ({
      name: m.name,
      type: m.type,
      location: m.location,
      personality: m.personality
    })),
    themes: plan.themes,
    dm_notes: plan.dm_notes ? {
      tone: plan.dm_notes.tone_guidance,
      twists: plan.dm_notes.planned_twists?.slice(0, 3)
    } : null,
    side_quests: plan.side_quests?.slice(0, 3).map(q => ({
      title: q.title,
      description: q.description
    }))
  };
}

export default {
  generateCampaignPlan,
  getCampaignPlan,
  updatePlanSection,
  addWorldEvent,
  addNPC,
  getPlanSummaryForSession
};
