import { aggregateCampaignContext, dayToHarptosDate } from './metaGame.js';
import { isClaudeAvailable, chat as claudeChat } from './claude.js';

// Ollama API endpoint (runs locally) - fallback when Claude is unavailable
const OLLAMA_API = 'http://localhost:11434/api/generate';
const ADVENTURE_MODEL = 'llama3.2:3b';  // Fast model for adventure generation
const NARRATIVE_MODEL = 'llama3.2';     // Better model for narrative generation

/**
 * Unified LLM call - uses Claude when available, Ollama as fallback
 */
async function callLLM(prompt, temperature = 0.8) {
  // Try Claude first if available
  if (isClaudeAvailable()) {
    try {
      console.log('Using Claude for adventure generation...');
      const response = await claudeChat(
        'You are a D&D adventure generator. Return ONLY valid JSON, no other text.',
        [{ role: 'user', content: prompt }]
      );
      return response;
    } catch (error) {
      console.error('Claude error, falling back to Ollama:', error.message);
    }
  }

  // Fall back to Ollama
  return callOllama(prompt, ADVENTURE_MODEL, temperature);
}

async function callOllama(prompt, modelName = ADVENTURE_MODEL, temperature = 0.8) {
  try {
    console.log('Using Ollama for adventure generation...');
    const response = await fetch(OLLAMA_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: modelName,
        prompt: prompt,
        stream: false,
        options: {
          temperature: temperature,
          top_p: 0.9,
          num_predict: 800,  // Increased for longer JSON responses
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Ollama API error response:', errorText);
      throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.response;
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      console.error('Ollama is not running. Start it with: ollama serve');
    } else if (error.message.includes('model')) {
      console.error(`Model ${modelName} may not be installed. Try: ollama pull ${modelName}`);
    }
    throw error;
  }
}

export async function generateAdventureOptions(character, riskLevel) {
  const { current_location, current_quest, level, class: charClass, injuries } = character;

  console.log('\n=== GENERATING ADVENTURE OPTIONS ===');
  console.log('Character:', character.name);
  console.log('Location:', current_location);
  console.log('Quest:', current_quest);
  console.log('Risk Level:', riskLevel);
  console.log('Using Ollama model:', ADVENTURE_MODEL);

  // If character is injured, prioritize recovery options
  const injuriesArray = JSON.parse(injuries || '[]');
  const isInjured = injuriesArray.length > 0;

  const prompt = `You are a D&D adventure generator. Create 3 different adventure options for a character with the following context:

Character: Level ${level} ${charClass}
Current Location: ${current_location}
Current Quest: ${current_quest || 'None'}
Injured: ${isInjured ? 'Yes - ' + injuriesArray.join(', ') : 'No'}
Risk Level: ${riskLevel}

${isInjured ? 'IMPORTANT: Since the character is injured, at least one option should focus on recovery/healing.' : ''}

Requirements:
- Adventures must be appropriate for the character's current location
- Adventures should relate to or support the current quest if one exists
- Risk level should be ${riskLevel} - consider appropriate challenges
- Each adventure should be self-contained and completable in the timeframe
- Adventures should feel like D&D downtime activities or side quests

Please provide EXACTLY 3 adventure options in the following JSON format:
{
  "adventures": [
    {
      "title": "Brief adventure title",
      "description": "2-3 sentence description of what the character will do",
      "activity_type": "combat/exploration/social/recovery/crafting/research",
      "estimated_game_hours": 8
    }
  ]
}

Make the adventures interesting, varied, and thematically appropriate. Return ONLY valid JSON, no other text.`;

  try {
    console.log('Generating adventure options...');
    const responseText = await callLLM(prompt);
    console.log('LLM call successful!');
    console.log('Response text:', responseText.substring(0, 200) + '...');

    // Try to extract JSON from the response - look for the adventures object
    let jsonMatch = responseText.match(/\{\s*"adventures"\s*:\s*\[[\s\S]*?\]\s*\}/);

    if (!jsonMatch) {
      // Try alternate pattern - just an array
      jsonMatch = responseText.match(/\[[\s\S]*?\]/);
      if (jsonMatch) {
        const adventuresArray = JSON.parse(jsonMatch[0]);
        console.log('Parsed adventures array successfully:', adventuresArray.length, 'options');
        return adventuresArray;
      }
      throw new Error('No JSON found in response');
    }

    const adventures = JSON.parse(jsonMatch[0]);
    console.log('Parsed adventures successfully:', adventures.adventures.length, 'options');
    return adventures.adventures;
  } catch (error) {
    console.error('Error generating adventures:', error.message);
    console.error('Full response:', responseText);

    // Fallback to basic procedural generation if LLM fails
    console.log('Using fallback adventures');
    return generateFallbackAdventures(character, riskLevel);
  }
}

function generateFallbackAdventures(character, riskLevel) {
  const { current_location, level } = character;
  const location = current_location || 'the area';

  // Return risk-appropriate fallback adventures with variety
  const fallbacksByRisk = {
    low: [
      {
        title: 'Rest and Recuperation',
        description: `Take time to rest at ${location}, tending to equipment, writing letters, or simply recovering strength. A safe and peaceful day.`,
        activity_type: 'recovery',
        estimated_game_hours: 8
      },
      {
        title: 'Gather Local Rumors',
        description: `Spend time in taverns and markets at ${location}, learning about the area's history and hearing the latest gossip from travelers.`,
        activity_type: 'social',
        estimated_game_hours: 6
      },
      {
        title: 'Training Session',
        description: `Practice combat forms, study spellwork, or hone skills in a safe environment at ${location}. Steady improvement without risk.`,
        activity_type: 'training',
        estimated_game_hours: 4
      },
      {
        title: 'Craft and Repair',
        description: `Spend time crafting useful items, repairing gear, or creating supplies at ${location}. Productive work with tangible results.`,
        activity_type: 'crafting',
        estimated_game_hours: 6
      },
      {
        title: 'Work for Hire',
        description: `Take on honest work at ${location} - helping merchants, assisting craftsmen, or performing services for coin.`,
        activity_type: 'work',
        estimated_game_hours: 8
      }
    ],
    medium: [
      {
        title: 'Patrol the Perimeter',
        description: `Scout the area surrounding ${location}, watching for signs of danger or unusual activity. Some risk of encounters.`,
        activity_type: 'exploration',
        estimated_game_hours: 8
      },
      {
        title: 'Investigate Disturbances',
        description: `Look into reports of strange occurrences near ${location}. Follow leads and uncover what's really going on.`,
        activity_type: 'investigation',
        estimated_game_hours: 6
      },
      {
        title: 'Escort Duty',
        description: `Help escort travelers or goods through dangerous territory near ${location}. Bandits are always a possibility.`,
        activity_type: 'escort',
        estimated_game_hours: 10
      },
      {
        title: 'Hunting Expedition',
        description: `Track game or gather rare materials in the wilds near ${location}. The prey isn't always what you expect.`,
        activity_type: 'hunting',
        estimated_game_hours: 8
      },
      {
        title: 'Negotiate a Deal',
        description: `Broker an agreement, settle a dispute, or make contacts with influential figures at ${location}.`,
        activity_type: 'negotiation',
        estimated_game_hours: 4
      }
    ],
    high: [
      {
        title: 'Hunt Dangerous Prey',
        description: `Track and confront a dangerous creature that has been threatening the area around ${location}. Significant combat expected.`,
        activity_type: 'monster_hunt',
        estimated_game_hours: 12
      },
      {
        title: 'Clear a Threat',
        description: `Venture into dangerous territory near ${location} to eliminate a known threat. High risk, high reward.`,
        activity_type: 'combat',
        estimated_game_hours: 10
      },
      {
        title: 'Explore the Ruins',
        description: `Delve into dangerous ruins or caves near ${location}. Ancient treasures await, but so do ancient dangers.`,
        activity_type: 'dungeon',
        estimated_game_hours: 12
      },
      {
        title: 'Infiltration Mission',
        description: `Sneak into a guarded location near ${location} to gather intelligence or retrieve something valuable.`,
        activity_type: 'heist',
        estimated_game_hours: 8
      },
      {
        title: 'Confront the Enemy',
        description: `Face a known adversary who has been operating near ${location}. This confrontation has been a long time coming.`,
        activity_type: 'confrontation',
        estimated_game_hours: 6
      }
    ]
  };

  // Randomly select one adventure from the appropriate risk level
  const options = fallbacksByRisk[riskLevel] || fallbacksByRisk.medium;
  const randomIndex = Math.floor(Math.random() * options.length);
  return [options[randomIndex]];
}

/**
 * Generate adventure options using full campaign context
 * This is the enhanced version that considers session history, companions, calendar, etc.
 */
export async function generateContextualAdventures(characterId, riskLevel) {
  console.log('\n=== GENERATING CONTEXTUAL ADVENTURE OPTIONS ===');

  // Get full campaign context
  let context;
  try {
    context = await aggregateCampaignContext(characterId);
  } catch (error) {
    console.error('Failed to get campaign context, falling back to basic generation');
    // Fall back to basic character lookup
    const { dbGet } = await import('../database.js');
    const character = await dbGet('SELECT * FROM characters WHERE id = ?', [characterId]);
    return generateAdventureOptions(character, riskLevel);
  }

  const { character, calendar, companions, recentSessions, campaignNotes, campaignConfig } = context;

  // Get used names for naming conventions
  const usedNames = campaignConfig?.usedNames || [];

  console.log('Character:', character.name);
  console.log('Location:', character.currentLocation);
  console.log('Current Quest:', character.currentQuest);
  console.log('Date:', calendar.formatted);
  console.log('Season:', calendar.season);
  console.log('Companions:', companions.length);
  console.log('Recent Sessions:', recentSessions.length);
  console.log('Risk Level:', riskLevel);

  // Build rich context for the prompt
  const companionInfo = companions.length > 0
    ? `\nCompanions traveling with you:\n${companions.map(c => `- ${c.name}: ${c.race} ${c.class || c.occupation || 'companion'}`).join('\n')}`
    : '\nTraveling alone.';

  const sessionContext = recentSessions.length > 0
    ? `\nRecent adventures:\n${recentSessions.slice(0, 3).map(s => `- ${s.title}: ${s.summary?.substring(0, 100) || 'No summary'}...`).join('\n')}`
    : '\nThis is the beginning of a new campaign.';

  const questContext = character.currentQuest
    ? `\nActive Quest: ${character.currentQuest}`
    : '\nNo active quest - looking for opportunities.';

  const campaignMemory = campaignNotes
    ? `\nCampaign Memory (important details):\n${campaignNotes.substring(0, 500)}...`
    : '';

  // Health status
  const healthPercent = Math.round((character.currentHp / character.maxHp) * 100);
  const healthStatus = healthPercent < 30 ? 'severely wounded'
    : healthPercent < 60 ? 'wounded'
    : healthPercent < 90 ? 'lightly injured'
    : 'healthy';

  // Build the enhanced prompt
  const prompt = `You are a D&D adventure generator creating contextual adventure hooks. Consider the FULL campaign state:

CHARACTER:
- ${character.name}, Level ${character.level} ${character.race} ${character.class}
- Health: ${healthStatus} (${character.currentHp}/${character.maxHp} HP)
- Current Location: ${character.currentLocation}
- Gold: ${character.gold.gp} gp
${questContext}
${companionInfo}

CAMPAIGN STATE:
- Date: ${calendar.formatted}
- Season: ${calendar.season}
${sessionContext}
${campaignMemory}

ADVENTURE REQUIREMENTS:
- Risk Level: ${riskLevel.toUpperCase()}
- Adventures MUST fit the current location and season
- Adventures should connect to the ongoing story if one exists
- Consider the party composition (${companions.length + 1} total)
- ${healthStatus !== 'healthy' ? 'Consider the party\'s wounded state' : 'Party is ready for action'}
- If mentioning NPCs, prefer roles/titles over names (e.g., "a local merchant", "the guard captain")
- FORBIDDEN NPC NAMES (never use): Marcus, Elena, Lyra, Aldric, Garrett, Marta, Alaric, Liora, Elara, Cedric, Viktor
- FORBIDDEN LAST NAMES: Crane, Thorne, Blackwood, Darkhollow, Nightshade, Stormwind, Ravencrest
${usedNames.length > 0 ? `- NAMES ALREADY IN CAMPAIGN (never reuse): ${usedNames.join(', ')}` : ''}

Generate 3 adventure options that:
1. Make sense for the current situation and location
2. Reference or build on recent events if applicable
3. Feel connected to the world (not random encounters)
4. Are appropriate for the ${riskLevel} risk level

Return ONLY valid JSON in this format:
{
  "adventures": [
    {
      "title": "Short adventure title",
      "description": "2-3 sentences describing the adventure hook and what makes it interesting",
      "activity_type": "combat/exploration/social/recovery/crafting/research/mystery",
      "estimated_game_hours": 8,
      "connection": "How this connects to the campaign (optional)"
    }
  ]
}`;

  try {
    console.log('Generating contextual adventures...');
    const responseText = await callLLM(prompt, 0.8);
    console.log('LLM call successful!');

    // Parse JSON response
    let jsonMatch = responseText.match(/\{\s*"adventures"\s*:\s*\[[\s\S]*?\]\s*\}/);

    if (!jsonMatch) {
      jsonMatch = responseText.match(/\[[\s\S]*?\]/);
      if (jsonMatch) {
        const adventuresArray = JSON.parse(jsonMatch[0]);
        console.log('Parsed adventures array:', adventuresArray.length, 'options');
        return adventuresArray;
      }
      throw new Error('No JSON found in response');
    }

    const adventures = JSON.parse(jsonMatch[0]);
    console.log('Parsed contextual adventures:', adventures.adventures.length, 'options');
    return adventures.adventures;
  } catch (error) {
    console.error('Error generating contextual adventures:', error.message);
    // Fall back to basic generation using character data from context
    return generateFallbackAdventures({
      current_location: character.currentLocation,
      level: character.level,
      injuries: '[]'
    }, riskLevel);
  }
}

/**
 * Get detailed seasonal description based on Harptos calendar
 */
function getSeasonalContext(calendar) {
  const { month, day, season } = calendar;

  // Harptos months and their position in season
  const seasonDescriptions = {
    // Winter months
    'Hammer': 'deep winter (Deepwinter) - the coldest month, heavy snow and bitter cold',
    'Alturiak': 'late winter (The Claw of Winter) - still very cold, occasional blizzards',
    'Nightal': 'early winter (The Drawing Down) - first snows, temperatures dropping',

    // Spring months
    'Ches': 'early spring (The Claw of Sunsets) - snow melting, roads muddy',
    'Tarsakh': 'mid-spring (The Claw of Storms) - spring rains, warming days',
    'Mirtul': 'late spring (The Melting) - flowers blooming, pleasant weather',

    // Summer months
    'Kythorn': 'early summer (The Time of Flowers) - warm and pleasant',
    'Flamerule': 'high summer (Summertide) - hottest month, long days',
    'Eleasis': 'late summer (Highsun) - harvest begins, warm evenings',

    // Autumn months
    'Eleint': 'early autumn (The Fading) - leaves changing, cooling nights',
    'Marpenoth': 'mid-autumn (Leaffall) - harvest season, frequent rain',
    'Uktar': 'late autumn (The Rotting) - cold rain, bare trees, first frosts'
  };

  const description = seasonDescriptions[month] || `${season} season`;

  // Add day-specific context
  let dayContext = '';
  if (day <= 10) {
    dayContext = 'early in the month';
  } else if (day <= 20) {
    dayContext = 'mid-month';
  } else {
    dayContext = 'late in the month';
  }

  return `${description} (${dayContext})`;
}

/**
 * Generate one adventure option for each risk level (low, medium, high)
 * Returns 3 adventures, each with its own risk_level property
 */
export async function generateAllRiskLevelAdventures(characterId) {
  console.log('\n=== GENERATING ADVENTURES FOR ALL RISK LEVELS ===');

  // Get full campaign context once
  let context;
  try {
    context = await aggregateCampaignContext(characterId);
  } catch (error) {
    console.error('Failed to get campaign context, using fallback');
    const { dbGet } = await import('../database.js');
    const character = await dbGet('SELECT * FROM characters WHERE id = ?', [characterId]);
    return [
      { ...generateFallbackAdventures(character, 'low')[0], risk_level: 'low' },
      { ...generateFallbackAdventures(character, 'medium')[0], risk_level: 'medium' },
      { ...generateFallbackAdventures(character, 'high')[0], risk_level: 'high' }
    ];
  }

  const { character, calendar, companions, recentSessions, campaignNotes } = context;

  // Get campaign config for naming conventions
  const campaignConfig = JSON.parse(character.campaign_config || '{}');
  const usedNames = campaignConfig.usedNames || [];

  // Build context strings (same as generateContextualAdventures)
  const companionInfo = companions.length > 0
    ? `Companions: ${companions.map(c => c.name.split(' ')[0]).join(', ')}`
    : 'Traveling alone';

  const healthPercent = Math.round((character.currentHp / character.maxHp) * 100);
  const healthStatus = healthPercent < 30 ? 'severely wounded'
    : healthPercent < 60 ? 'wounded'
    : healthPercent < 90 ? 'lightly injured'
    : 'healthy';

  const questContext = character.currentQuest || 'No active quest';

  // Get detailed seasonal context
  const seasonalContext = getSeasonalContext(calendar);

  // Determine location type
  const location = (character.currentLocation || '').toLowerCase();
  const isInSettlement = ['keep', 'castle', 'city', 'town', 'village', 'inn', 'tavern', 'fort'].some(k => location.includes(k));
  const locationContext = isInSettlement
    ? 'The party is staying at a settlement with shelter, food, and beds.'
    : 'The party is traveling or camping in the wilderness.';

  const prompt = `You are a D&D adventure generator for a FANTASY MEDIEVAL setting (no modern technology - no electricity, heating systems, or machinery).

Create 3 adventure options with DIFFERENT risk levels for:

CHARACTER: ${character.name}, Level ${character.level} ${character.race} ${character.class}
LOCATION: ${character.currentLocation}
${locationContext}

QUEST: ${questContext}
HEALTH: ${healthStatus}
PARTY: ${companionInfo}

CALENDAR: ${calendar.formatted}
SEASON: ${seasonalContext}
IMPORTANT: It is currently ${calendar.month} - ${seasonalContext}. Adventures MUST reflect this specific time of year accurately. Do NOT mention thawing snow in deep winter or freezing cold in summer.

Generate exactly 3 DIVERSE adventures with different activity types:

LOW RISK (10% failure) - Choose ONE:
- Training: practice combat, study magic, learn new skills
- Social: make contacts, gather rumors, build relationships
- Recovery: rest, healing, equipment maintenance
- Crafting: create items, brew potions, scribe scrolls
- Work: earn gold through honest labor appropriate to class

MEDIUM RISK (25% failure) - Choose ONE:
- Investigation: follow leads, uncover secrets, solve mysteries
- Exploration: scout areas, map terrain, find hidden places
- Escort/Guard: protect travelers, guard shipments, watch duties
- Negotiation: broker deals, settle disputes, make alliances
- Hunting: track game, gather rare materials, thin predator populations

HIGH RISK (40% failure) - Choose ONE:
- Combat: confront enemies, clear threats, rescue captives
- Heist/Infiltration: steal objects, gather intelligence, sabotage
- Monster Hunt: track and slay dangerous creatures
- Dungeon Delve: explore ruins, tombs, or dangerous locations
- Confrontation: face rivals, challenge villains, settle scores

Requirements:
- Each adventure must have a DIFFERENT activity type
- Adventures should connect to the current quest if one exists
- Be creative and specific to the location and season
- Use only fantasy medieval technology
- If mentioning NPCs, prefer roles/titles over names (e.g., "a local merchant", "the guard captain")
- FORBIDDEN NPC NAMES (never use): Marcus, Elena, Lyra, Aldric, Garrett, Marta, Alaric, Liora, Elara, Cedric, Viktor
- FORBIDDEN LAST NAMES: Crane, Thorne, Blackwood, Darkhollow, Nightshade, Stormwind, Ravencrest
${usedNames.length > 0 ? `- NAMES ALREADY IN CAMPAIGN (never reuse): ${usedNames.join(', ')}` : ''}

Return ONLY valid JSON:
{
  "adventures": [
    {
      "title": "Short evocative title",
      "description": "2-3 sentences describing what the character will do and why it matters",
      "activity_type": "training/social/recovery/crafting/work/investigation/exploration/escort/negotiation/hunting/combat/heist/monster_hunt/dungeon/confrontation",
      "risk_level": "low",
      "estimated_game_hours": 8
    },
    {
      "title": "Title",
      "description": "2-3 sentences",
      "activity_type": "type",
      "risk_level": "medium",
      "estimated_game_hours": 8
    },
    {
      "title": "Title",
      "description": "2-3 sentences",
      "activity_type": "type",
      "risk_level": "high",
      "estimated_game_hours": 8
    }
  ]
}`;

  try {
    console.log('Generating adventures for all risk levels...');
    const responseText = await callLLM(prompt, 0.8);

    let jsonMatch = responseText.match(/\{\s*"adventures"\s*:\s*\[[\s\S]*?\]\s*\}/);

    if (!jsonMatch) {
      jsonMatch = responseText.match(/\[[\s\S]*?\]/);
      if (jsonMatch) {
        const adventures = JSON.parse(jsonMatch[0]);
        // Ensure risk levels are set
        if (adventures.length >= 3) {
          adventures[0].risk_level = adventures[0].risk_level || 'low';
          adventures[1].risk_level = adventures[1].risk_level || 'medium';
          adventures[2].risk_level = adventures[2].risk_level || 'high';
        }
        return adventures;
      }
      throw new Error('No JSON found');
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const adventures = parsed.adventures;

    // Ensure risk levels are set correctly
    if (adventures.length >= 3) {
      adventures[0].risk_level = adventures[0].risk_level || 'low';
      adventures[1].risk_level = adventures[1].risk_level || 'medium';
      adventures[2].risk_level = adventures[2].risk_level || 'high';
    }

    console.log('Generated all risk level adventures:', adventures.length);
    return adventures;
  } catch (error) {
    console.error('Error generating all risk level adventures:', error.message);
    // Fallback
    return [
      { ...generateFallbackAdventures({ current_location: character.currentLocation, level: character.level, injuries: '[]' }, 'low')[0], risk_level: 'low' },
      { ...generateFallbackAdventures({ current_location: character.currentLocation, level: character.level, injuries: '[]' }, 'medium')[0], risk_level: 'medium' },
      { ...generateFallbackAdventures({ current_location: character.currentLocation, level: character.level, injuries: '[]' }, 'high')[0], risk_level: 'high' }
    ];
  }
}

export async function generateAdventureNarrative(adventure, character, success, rewards, consequences) {
  // Parse character data for more personalization
  const skills = JSON.parse(character.skills || '[]');
  const advantages = JSON.parse(character.advantages || '[]');
  const currentQuest = character.current_quest || 'no current quest';

  // Get campaign config for naming conventions
  const campaignConfig = JSON.parse(character.campaign_config || '{}');
  const usedNames = campaignConfig.usedNames || [];

  // Determine pronouns based on character gender
  const gender = character.gender || 'Male';
  let pronouns;
  if (gender === 'Male') {
    pronouns = { subject: 'he', object: 'him', possessive: 'his' };
  } else if (gender === 'Female') {
    pronouns = { subject: 'she', object: 'her', possessive: 'her' };
  } else {
    pronouns = { subject: 'they', object: 'them', possessive: 'their' };
  }

  const pronounGuide = `IMPORTANT: ${character.name} is ${gender.toLowerCase()}. Use ${pronouns.subject}/${pronouns.object}/${pronouns.possessive} pronouns.`;

  // NPC naming rules - same as DM session
  const namingRules = `
NPC NAMING RULES (CRITICAL):
- If you introduce ANY NPC by name, you MUST follow these rules
- FORBIDDEN FIRST NAMES (never use): Marcus, Elena, Lyra, Aldric, Garrett, Marta, Alaric, Liora, Elara, Cedric, Viktor
- FORBIDDEN LAST NAMES (never use): Crane, Thorne, Blackwood, Darkhollow, Nightshade, Stormwind, Ravencrest
${usedNames.length > 0 ? `- NAMES ALREADY USED IN THIS CAMPAIGN (never reuse): ${usedNames.join(', ')}` : ''}
- Use unique, setting-appropriate names (Forgotten Realms style)
- Prefer describing NPCs by role/title if a name isn't essential (e.g., "the caravan guard", "a local merchant")`;

  const prompt = success
    ? `Write a brief D&D adventure outcome in 2-3 sentences. ${character.name} (Level ${character.level} ${character.race} ${character.class}, ${gender}) successfully completed "${adventure.title}" in ${character.current_location}.

${pronounGuide}
${namingRules}

Focus on:
- One specific event that happened (encounter, discovery, or challenge)
- How it relates to their quest: ${currentQuest}
- Keep it straightforward and clear
- If mentioning any NPC, prefer role/title over names unless essential

Example: "${character.name} tracked cultist activity to an abandoned mill outside ${character.current_location}. Inside, ${pronouns.subject} discovered ritual markings and intercepted correspondence revealing the cult's next gathering point. The locals were grateful for ${pronouns.possessive} warning."

Write ONLY the narrative:`
    : `Write a brief D&D failure outcome in 2-3 sentences. ${character.name} (Level ${character.level} ${character.race} ${character.class}, ${gender}) failed "${adventure.title}" in ${character.current_location}.

${pronounGuide}
${namingRules}

Focus on:
- What went wrong (ambush, trap, misinformation, etc.)
- The immediate consequence: ${consequences.map(c => c.description).join(', ')}
- Keep it clear and direct
- If mentioning any NPC, prefer role/title over names unless essential

Example: "${character.name} walked into a cultist ambush while investigating the old mill. ${pronouns.subject.charAt(0).toUpperCase() + pronouns.subject.slice(1)} barely escaped with ${pronouns.possessive} life, taking serious injuries in the process. The cult now knows someone is hunting ${pronouns.object}."

Write ONLY the narrative:`;

  try {
    console.log('Generating adventure narrative...');
    const narrative = await callLLM(prompt, 0.7);  // Lower temperature for more coherent text

    // Clean up the response - sometimes models add extra commentary
    const cleaned = narrative
      .replace(/^(Here is|Here's|The narrative is).*?:/i, '')
      .replace(/^["']|["']$/g, '')
      .trim();

    console.log('Generated narrative:', cleaned.substring(0, 100) + '...');
    return cleaned;
  } catch (error) {
    console.error('Error generating narrative:', error);

    // Fallback narrative with more flavor - use correct pronouns
    const subjectCap = pronouns.subject.charAt(0).toUpperCase() + pronouns.subject.slice(1);

    if (success) {
      const actions = [
        `${character.name} ventured through ${character.current_location} and encountered unexpected challenges. Through skill and determination, ${pronouns.subject} overcame the obstacles and emerged victorious, earning valuable experience and rewards.`,
        `During ${pronouns.possessive} time in ${character.current_location}, ${character.name} discovered an opportunity for adventure. ${subjectCap} quick thinking and bold action led to success, impressing locals and filling ${pronouns.possessive} coin purse.`,
        `${character.name} spent the day navigating the dangers of ${character.current_location}. When trouble found ${pronouns.object}, ${pronouns.subject} rose to the challenge and proved ${pronouns.possessive} worth as an adventurer.`
      ];
      return actions[Math.floor(Math.random() * actions.length)];
    } else {
      const failures = [
        `${character.name}'s adventure in ${character.current_location} didn't go as planned. Despite ${pronouns.possessive} best efforts, things went awry, leaving ${pronouns.object} battered and wiser from the experience.`,
        `Fortune did not favor ${character.name} this day. ${subjectCap} expedition through ${character.current_location} met with unforeseen complications, and ${pronouns.subject} was forced to retreat, licking ${pronouns.possessive} wounds.`,
        `The challenges of ${character.current_location} proved too much for ${character.name} on this occasion. ${subjectCap} survived the ordeal, but paid a price for ${pronouns.possessive} ambition.`
      ];
      return failures[Math.floor(Math.random() * failures.length)];
    }
  }
}
