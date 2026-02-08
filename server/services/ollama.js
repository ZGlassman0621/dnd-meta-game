/**
 * Ollama Service - Session Orchestration for AI Dungeon Master
 *
 * Manages DM session lifecycle: starting, continuing, and summarizing sessions.
 * Uses llmClient.js for LLM communication and dmPromptBuilder.js for prompt construction.
 */

import { chat, checkOllamaStatus, listModels } from './llmClient.js';
import { createDMSystemPrompt } from './dmPromptBuilder.js';

/**
 * Start a new DM session - generates the opening scene
 */
export async function startSession(character, sessionConfig, model, secondCharacter = null) {
  const systemPrompt = createDMSystemPrompt(character, sessionConfig, secondCharacter);
  const isTwoPlayer = !!secondCharacter;

  const char1Name = character.nickname || character.name.split(' ')[0];
  const char2Name = secondCharacter ? (secondCharacter.nickname || secondCharacter.name.split(' ')[0]) : null;

  // Extract companion info for the opening prompt
  const companions = sessionConfig.companions || [];
  const hasCompanions = companions.length > 0;

  // Helper to get pronouns from gender
  const getPronouns = (gender) => {
    if (!gender) return 'they/them';
    const g = gender.toLowerCase();
    if (g === 'male' || g === 'm') return 'he/him';
    if (g === 'female' || g === 'f') return 'she/her';
    return 'they/them';
  };

  // Format companion text for opening prompts with gender info
  let companionText = '';
  let companionGenderNote = '';
  if (hasCompanions) {
    const companionDescriptions = companions.map(c => {
      const name = c.nickname || c.name;
      const pronouns = getPronouns(c.gender);
      return `${name} (${pronouns})`;
    });

    if (companionDescriptions.length === 1) {
      companionText = ` and their companion ${companions[0].nickname || companions[0].name}`;
    } else if (companionDescriptions.length === 2) {
      companionText = ` along with their companions ${companions[0].nickname || companions[0].name} and ${companions[1].nickname || companions[1].name}`;
    } else {
      const names = companions.map(c => c.nickname || c.name);
      const lastCompanion = names.pop();
      companionText = ` along with their companions ${names.join(', ')}, and ${lastCompanion}`;
    }

    // Build gender note for companions
    companionGenderNote = companions.map(c => {
      const name = c.nickname || c.name;
      const pronouns = getPronouns(c.gender);
      return `${name} uses ${pronouns} pronouns`;
    }).join('; ');
  }

  // Build detailed companion background notes for the opening prompt
  let companionBackgroundNotes = '';
  if (hasCompanions) {
    companionBackgroundNotes = companions.map(c => {
      const name = c.nickname || c.name;
      const parts = [`${name}:`];
      if (c.occupation) parts.push(`  - Former Occupation/Origin: ${c.occupation}`);
      if (c.relationship_to_party) parts.push(`  - Relationship to Player: ${c.relationship_to_party.replace(/_/g, ' ')}`);
      if (c.background_notes) parts.push(`  - Personal Story: ${c.background_notes}`);
      if (c.motivation) parts.push(`  - Motivation: ${c.motivation}`);
      return parts.join('\n');
    }).join('\n');
  }

  // Companion reminder for opening scene - CRITICAL identity clarification
  const companionReminder = hasCompanions
    ? `\n\nCRITICAL IDENTITY RULES:
- "You" = THE PLAYER = ${character.name}. These are ALL THE SAME PERSON.
- Do NOT create a separate NPC named "${character.name}" - that IS the player!
- When a companion is described as "apprentice" or similar, they are apprentice to YOU (the player)
- ${companionGenderNote}

The player character ${character.name} has the following companion(s) traveling with them:
${companionBackgroundNotes}

When describing companions:
- They travel WITH you (the player) - you are their mentor/leader/companion
- Do NOT create "${character.name}" as a separate NPC - YOU ARE ${character.name}
- Do NOT invent weapons or armor for companions`
    : '';

  // Strong perspective prefix for all opening prompts
  const perspectivePrefix = `CRITICAL: Write in SECOND PERSON. Use "you" for the player character at ALL times.
WRONG: "${char1Name} looks around" or "He sees"
RIGHT: "You look around" or "You see"
Never refer to the player character by name or in third person. Never write dialogue for them.

`;

  // Check if this is a published campaign module
  const campaignModule = sessionConfig.campaignModule;
  const isPublishedModule = campaignModule && campaignModule.type === 'published';

  // Check if continuing from a previous session
  const isContinuing = sessionConfig.continueCampaign && sessionConfig.previousSessionSummaries && sessionConfig.previousSessionSummaries.length > 0;
  const lastSessionSummary = isContinuing ? sessionConfig.previousSessionSummaries[sessionConfig.previousSessionSummaries.length - 1]?.summary : null;

  // Campaign foundation instructions for custom adventures
  const hasCampaignPlan = !!(sessionConfig.campaignPlanSummary?.main_quest_title);

  const campaignFoundationPrompt = !isPublishedModule ? (hasCampaignPlan ? `
A CAMPAIGN PLAN has been provided in your system prompt (generated by Opus 4.5).
You MUST use it. DO NOT invent your own antagonist, story arc, or quest.

For this opening scene:
- Read the MAIN QUEST, HOW IT BEGINS, and CURRENT ACT sections from the campaign plan
- Use those details to craft the opening - the quest hook should be present or foreshadowed
- Include a subtle first clue that connects to the main quest's plot
- If the plan names specific NPCs at this location, they should be present or referenced
- Set the tone described in the plan's tone guidance

Write an opening scene that:
- Establishes the immediate situation and environment
- Grounds the scene in the campaign plan's Act 1 details
- Contains a subtle hook connecting to the main quest
- Presents something concrete the player can engage with

` : `
BEFORE writing the opening scene, you MUST internally establish (do not share these with the player):

1. THE BBEG for this campaign:
   - Who/what is the antagonist? (Consider the location, era, and character backstory)
   - What is their motivation?
   - What are they doing right now that will eventually affect the player?
   - What is their weakness or flaw?

2. THE STORY ARC (8-10 sessions):
   - What's the inciting incident that will draw the player in?
   - What's the midpoint revelation that changes everything?
   - What's the climactic confrontation look like?

3. THE FIRST CLUE:
   - What small hint in this opening scene connects to the larger story?
   - This should be subtle - a detail, a rumor, an odd occurrence

Now write an opening scene that:
- Establishes the immediate situation and environment
- Contains that first subtle clue
- Presents something concrete the player can engage with
- Sets the tone for the campaign ahead

`) : '';

  let openingPrompt;

  if (isPublishedModule) {
    // Published campaign module - use campaign-specific opening
    const campaignOpenings = {
      'curse-of-strahd': `Mysterious mists have deposited ${isTwoPlayer ? char1Name + ' and ' + char2Name : char1Name}${companionText} on an unfamiliar road.

Dark woods press in on both sides. The trees are twisted and bare. An unnatural chill hangs in the air. Through the fog ahead, a village is barely visible. Behind, the mists are impenetrable.

Write 2-3 paragraphs establishing the eerie atmosphere. End with them on the road, taking in their surroundings. No NPCs yet. Let them decide how to proceed.${companionReminder}`,

      'vecna-eve-of-ruin': `${isTwoPlayer ? char1Name + ' and ' + char2Name : char1Name}${companionText} ${isTwoPlayer || hasCompanions ? 'have' : 'has'} been transported to Sigil, the City of Doors.

The architecture defies reason - buildings curve upward in all directions. Portals shimmer everywhere. They're in a grand hall where other heroes are gathering. A silver-haired woman in elegant robes stands at the head of the room, waiting to address the assembled group.

Write 2-3 paragraphs describing the strangeness of arrival. End before the briefing begins - let them look around or speak with other heroes first.${companionReminder}`,

      'tomb-of-annihilation': `${isTwoPlayer ? char1Name + ' and ' + char2Name : char1Name}${companionText} ${isTwoPlayer || hasCompanions ? 'have' : 'has'} just stepped off a ship in Port Nyanzaru, Chult.

The port is vibrant and exotic - dinosaurs serve as beasts of burden, colorful markets line the streets, and the air is thick with jungle heat. They're here to investigate a death curse for their patron, but first they need to get their bearings.

Write 2-3 paragraphs focused on the sensory experience of arrival. End with them taking in the port. No quest exposition yet - let them explore first.${companionReminder}`,

      'waterdeep-dragon-heist': `${isTwoPlayer ? char1Name + ' and ' + char2Name : char1Name}${companionText} ${isTwoPlayer || hasCompanions ? 'have' : 'has'} found a table in the Yawning Portal tavern, Waterdeep.

The tavern is famous for the 40-foot well shaft at its center - the entrance to Undermountain. Durnan, the gruff proprietor, tends bar. The place is lively with adventurers and locals.

Write 2-3 paragraphs establishing the atmosphere. End with something simple - a server approaching, a moment to take in the room, or settling into seats. No plot hooks yet. No named NPCs approaching. Let the player decide what to do first.

Write from a second-person perspective. Do not have NPCs address the player character${isTwoPlayer ? 's' : ''} by name yet.${companionReminder}`,

      'rime-of-the-frostmaiden': `${isTwoPlayer ? char1Name + ' and ' + char2Name : char1Name}${companionText} ${isTwoPlayer || hasCompanions ? 'arrive' : 'arrives'} in Bryn Shander, Icewind Dale.

The sun hasn't risen in over two years. It's always dark, always cold. The walled town is lit by torches and fires fighting back the eternal night. The locals look desperate and suspicious.

Write 2-3 paragraphs focused on the cold and the atmosphere. End with them entering the town or spotting a tavern. No lore dumps about the curse. Let them feel it first.${companionReminder}`,

      'storm-kings-thunder': `${isTwoPlayer ? char1Name + ' and ' + char2Name : char1Name}${companionText} ${isTwoPlayer || hasCompanions ? 'approach' : 'approaches'} the village of Nightstone.

Something is wrong. Boulders the size of houses lie scattered around the settlement. The wooden palisade is shattered. An eerie quiet hangs over everything, broken only by a bell ringing somewhere inside. The drawbridge is down. No guards in sight.

Write 2-3 paragraphs describing the unsettling approach. End at the threshold - the lowered drawbridge, the broken gate. Don't reveal what happened or what's inside. Let them investigate.${companionReminder}`,

      'baldurs-gate-descent': `${isTwoPlayer ? char1Name + ' and ' + char2Name : char1Name}${companionText} ${isTwoPlayer || hasCompanions ? 'walk' : 'walks'} the streets of Baldur's Gate.

The city is on edge. Refugees from Elturel crowd the streets with wild stories - their entire city vanished. The Flaming Fist patrols heavily. Fear and paranoia are thick in the air. The party has been recruited to meet with Captain Zodge at Flaming Fist headquarters.

Write 2-3 paragraphs about the tense atmosphere on the streets. End before they reach their meeting. Let them experience the city's fear first.${companionReminder}`
    };

    if (isContinuing && lastSessionSummary) {
      // Continue from previous session
      openingPrompt = perspectivePrefix + `Continue the ${campaignModule.name} campaign! This is a CONTINUATION from the previous session. Here's what happened last time:

${lastSessionSummary}

CRITICAL - HONOR SPECIFIC PLANS: If the summary mentions ANY specific plans, decisions, or timing the party made (like "agreed to leave at dawn", "planned to depart before sunrise", "decided to meet someone at midnight"), you MUST start the scene at EXACTLY that moment. Do NOT skip past their plans or change the timing they chose. The player made those decisions - respect them.

Pick up the story from where it left off. Do NOT recap the entire previous session - just smoothly continue the narrative. Do not have NPCs address the player character${isTwoPlayer ? 's' : ''} by name unless they already know them.${companionReminder}`;
    } else {
      openingPrompt = perspectivePrefix + (campaignOpenings[campaignModule.id] ||
        `Begin the ${campaignModule.name} campaign! Set an appropriate opening scene that draws ${isTwoPlayer ? char1Name + ' and ' + char2Name : char1Name}${companionText} into the adventure. Do not have NPCs address the player character${isTwoPlayer ? 's' : ''} by name yet.${companionReminder}`);
    }
  } else {
    // Custom adventure - use Forgotten Realms config
    const location = sessionConfig.startingLocation;
    const hook = sessionConfig.arrivalHook;

    const locationDesc = location ? `${location.name} in the ${location.region || 'Forgotten Realms'}` : 'the Forgotten Realms';
    const hookContext = hook ? `The party has ${hook.name.toLowerCase()}: ${hook.description}` : '';

    if (isContinuing && lastSessionSummary) {
      // Continue from previous session
      openingPrompt = perspectivePrefix + `Continue the adventure! This is a CONTINUATION from the previous session. Here's what happened last time:

${lastSessionSummary}

CRITICAL - HONOR SPECIFIC PLANS: If the summary mentions ANY specific plans, decisions, or timing the party made (like "agreed to leave at dawn", "planned to depart before sunrise", "decided to meet someone at midnight"), you MUST start the scene at EXACTLY that moment. Do NOT skip past their plans or change the timing they chose. The player made those decisions - respect them.

Pick up the story from where it left off. Do NOT recap the entire previous session - just smoothly continue the narrative from the last situation. Do not have NPCs address the player character${isTwoPlayer ? 's' : ''} by name unless they already know them.${companionReminder}`;
    } else {
      openingPrompt = perspectivePrefix + (isTwoPlayer || hasCompanions
        ? `${campaignFoundationPrompt}Begin the adventure! Set the scene in ${locationDesc}. ${hookContext} Describe where the player is and what they observe. Present an engaging situation or hook. Do not have NPCs address the player characters by name yet.${companionReminder}`
        : `${campaignFoundationPrompt}Begin the adventure! Set the scene in ${locationDesc}. ${hookContext} Describe where the player is and what they observe. Present an engaging situation or hook. Do not have NPCs address the player character by name yet.`);
    }
  }

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: openingPrompt }
  ];

  const response = await chat(messages, model);

  return {
    systemPrompt,
    openingNarrative: response,
    messages: [
      ...messages,
      { role: 'assistant', content: response }
    ]
  };
}

/**
 * Continue the session with a player action
 */
export async function continueSession(messages, playerAction, model) {
  const updatedMessages = [
    ...messages,
    { role: 'user', content: playerAction }
  ];

  const response = await chat(updatedMessages, model);

  return {
    narrative: response,
    messages: [
      ...updatedMessages,
      { role: 'assistant', content: response }
    ]
  };
}

/**
 * Generate a session summary when ending
 */
export async function generateSessionSummary(messages, model) {
  const summaryMessages = [
    ...messages,
    {
      role: 'user',
      content: `The session is ending. As the DM, provide a summary of this adventure session. Include:

1. KEY EVENTS: What major things happened? (2-3 sentences)
2. CURRENT STATE: Where is the party right now? What time of day/night is it in-game?
3. NEXT PLANS: What specific plans did the party make for their next move? Include ANY timing details (e.g., "agreed to leave at dawn", "will depart before sunrise", "meeting someone at midnight"). This is CRITICAL for the next session.
4. UNRESOLVED THREADS: Any mysteries, promises, or dangers left hanging?

Write in past tense as a narrative recap. Be specific about any timing or plans the party agreed to - the next session will start from exactly where this one ended.`
    }
  ];

  const response = await chat(summaryMessages, model);
  return response;
}

// Re-export everything consumers need for backward compatibility
export { checkOllamaStatus, chat, listModels, createDMSystemPrompt };

export default {
  checkOllamaStatus,
  chat,
  startSession,
  continueSession,
  generateSessionSummary,
  listModels,
  createDMSystemPrompt
};
