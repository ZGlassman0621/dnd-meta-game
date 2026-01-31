import express from 'express';
import db from '../database.js';
import ollama from '../services/ollama.js';
import claude from '../services/claude.js';
import {
  getBaseXPReward,
  calculateGoldReward,
  generateLoot
} from '../config/rewards.js';
import { dayToDate, advanceTime } from '../config/harptos.js';
import { XP_THRESHOLDS } from '../config/levelProgression.js';

const router = express.Router();

// Helper to determine which LLM provider to use
async function getLLMProvider() {
  // If Claude API key is configured, use Claude exclusively
  // Don't silently fall back to Ollama - surface Claude errors so user knows about issues
  if (claude.isClaudeAvailable()) {
    const status = await claude.checkClaudeStatus();
    if (status.available) {
      return { provider: 'claude', status };
    }
    // Claude key is set but not working - return the error, don't fall back
    return { provider: null, status: { available: false, error: status.error || 'Claude API error' } };
  }

  // No Claude API key configured - use Ollama as the local fallback
  const ollamaStatus = await ollama.checkOllamaStatus();
  if (ollamaStatus.available) {
    return { provider: 'ollama', status: ollamaStatus };
  }

  return { provider: null, status: { available: false, error: 'No LLM provider available. Set ANTHROPIC_API_KEY for Claude or install Ollama for local AI.' } };
}

// Check LLM status (prefers Claude, falls back to Ollama)
router.get('/llm-status', async (req, res) => {
  try {
    const { provider, status } = await getLLMProvider();
    // Spread status first, then provider - ensures our provider value isn't overwritten
    res.json({ ...status, provider });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Check Ollama status (legacy endpoint)
router.get('/ollama-status', async (req, res) => {
  try {
    const status = await ollama.checkOllamaStatus();
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// List available models
router.get('/models', async (req, res) => {
  try {
    const models = await ollama.listModels();
    res.json({ models });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get active session for a character (including paused and completed but unclaimed)
router.get('/active/:characterId', (req, res) => {
  try {
    // Check for active or paused session first
    let session = db.prepare(`
      SELECT * FROM dm_sessions
      WHERE character_id = ? AND (status = 'active' OR status = 'paused')
      ORDER BY created_at DESC LIMIT 1
    `).get(req.params.characterId);

    // If no active/paused, check for completed but unclaimed
    if (!session) {
      session = db.prepare(`
        SELECT * FROM dm_sessions
        WHERE character_id = ? AND status = 'completed' AND rewards_claimed = 0
        ORDER BY created_at DESC LIMIT 1
      `).get(req.params.characterId);
    }

    if (session) {
      session.messages = JSON.parse(session.messages || '[]');
      if (session.rewards) {
        session.rewards = JSON.parse(session.rewards);
      }
      // Add game date info
      if (session.game_start_day && session.game_start_year) {
        session.gameDate = dayToDate(session.game_start_day, session.game_start_year);
      }
    }

    res.json({ session });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get session history for a character (claimed sessions)
router.get('/history/:characterId', (req, res) => {
  try {
    const sessions = db.prepare(`
      SELECT id, title, setting, tone, status, summary, rewards, hp_change,
             new_location, new_quest, start_time, end_time, created_at
      FROM dm_sessions
      WHERE character_id = ? AND (status = 'completed' AND rewards_claimed = 1)
      ORDER BY created_at DESC
      LIMIT 20
    `).all(req.params.characterId);

    // Parse rewards JSON
    sessions.forEach(s => {
      if (s.rewards) s.rewards = JSON.parse(s.rewards);
    });

    res.json({ sessions });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get campaign continuity info - last session's config and recent summaries
router.get('/campaign-context/:characterId', (req, res) => {
  try {
    // Get the character's persistent campaign config
    const character = db.prepare(`
      SELECT campaign_config FROM characters WHERE id = ?
    `).get(req.params.characterId);

    let campaignConfig = {};
    try {
      campaignConfig = JSON.parse(character?.campaign_config || '{}');
    } catch (e) {
      campaignConfig = {};
    }

    // Get the most recent completed session with its full config
    const lastSession = db.prepare(`
      SELECT id, title, setting, tone, summary, session_config,
             game_end_day, game_end_year, end_time
      FROM dm_sessions
      WHERE character_id = ? AND status = 'completed' AND rewards_claimed = 1
      ORDER BY created_at DESC
      LIMIT 1
    `).get(req.params.characterId);

    if (!lastSession) {
      // Return campaign config even without previous sessions
      return res.json({
        hasPreviousSessions: false,
        campaignConfig
      });
    }

    // Get recent session summaries for story context (last 5 sessions)
    const recentSessions = db.prepare(`
      SELECT id, title, summary, game_start_day, game_start_year,
             game_end_day, game_end_year, end_time
      FROM dm_sessions
      WHERE character_id = ? AND status = 'completed' AND rewards_claimed = 1
      ORDER BY created_at DESC
      LIMIT 5
    `).all(req.params.characterId);

    // Parse the session config from the last session
    let sessionConfig = {};
    try {
      sessionConfig = JSON.parse(lastSession.session_config || '{}');
    } catch (e) {
      sessionConfig = {};
    }

    res.json({
      hasPreviousSessions: true,
      lastSession: {
        id: lastSession.id,
        title: lastSession.title,
        setting: lastSession.setting,
        summary: lastSession.summary,
        gameEndDay: lastSession.game_end_day,
        gameEndYear: lastSession.game_end_year,
        endTime: lastSession.end_time
      },
      sessionConfig: {
        era: sessionConfig.era,
        startingLocation: sessionConfig.startingLocation,
        campaignLength: sessionConfig.campaignLength,
        contentPreferences: sessionConfig.contentPreferences,
        customConcepts: sessionConfig.customConcepts,
        campaignModule: sessionConfig.campaignModule
      },
      // Character's persistent campaign config (takes priority over session config)
      campaignConfig,
      recentSummaries: recentSessions.map(s => ({
        id: s.id,
        title: s.title,
        summary: s.summary
      })).reverse() // Chronological order for story context
    });
  } catch (error) {
    console.error('Error getting campaign context:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get a specific session
router.get('/:sessionId', (req, res) => {
  try {
    const session = db.prepare('SELECT * FROM dm_sessions WHERE id = ?').get(req.params.sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    session.messages = JSON.parse(session.messages || '[]');
    if (session.rewards) session.rewards = JSON.parse(session.rewards);
    res.json({ session });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start a new DM session
router.post('/start', async (req, res) => {
  try {
    const {
      characterId,
      secondCharacterId,
      campaignModule,
      startingLocation,
      era,
      arrivalHook,
      customConcepts,
      contentPreferences,
      campaignLength,
      customNpcs,
      model,
      continueCampaign,  // If true, pull config from last session
      previousSessionSummaries  // Array of summaries to include in context
    } = req.body;

    // Check for existing active or paused DM session
    const existingSession = db.prepare(`
      SELECT id FROM dm_sessions
      WHERE character_id = ? AND (status = 'active' OR status = 'paused')
    `).get(characterId);

    if (existingSession) {
      return res.status(400).json({
        error: 'Character already has an active or paused DM session',
        sessionId: existingSession.id
      });
    }

    // Check for unclaimed DM session
    const unclaimedSession = db.prepare(`
      SELECT id FROM dm_sessions
      WHERE character_id = ? AND status = 'completed' AND rewards_claimed = 0
    `).get(characterId);

    if (unclaimedSession) {
      return res.status(400).json({
        error: 'Character has unclaimed rewards from a previous session',
        sessionId: unclaimedSession.id
      });
    }

    // Check for active time-based adventure
    const activeAdventure = db.prepare(`
      SELECT id FROM adventures
      WHERE character_id = ? AND (status = 'active' OR status = 'completed')
    `).get(characterId);

    if (activeAdventure) {
      return res.status(400).json({
        error: 'Character is currently on a time-based adventure. Complete or cancel it first.',
        adventureId: activeAdventure.id
      });
    }

    // Get character data
    const character = db.prepare('SELECT * FROM characters WHERE id = ?').get(characterId);
    if (!character) {
      return res.status(404).json({ error: 'Character not found' });
    }

    // Get active companions for this character
    const companions = db.prepare(`
      SELECT c.*, n.name, n.nickname, n.race, n.gender, n.age, n.occupation,
             n.stat_block, n.cr, n.ac, n.hp, n.speed, n.ability_scores as npc_ability_scores,
             n.avatar, n.personality_trait_1, n.personality_trait_2, n.voice, n.mannerism,
             n.motivation, n.background_notes, n.relationship_to_party
      FROM companions c
      JOIN npcs n ON c.npc_id = n.id
      WHERE c.recruited_by_character_id = ? AND c.status = 'active'
    `).all(characterId);

    // Get second character if specified
    let secondCharacter = null;
    if (secondCharacterId) {
      secondCharacter = db.prepare('SELECT * FROM characters WHERE id = ?').get(secondCharacterId);

      // Check if second character has any blocking sessions
      const secondCharActive = db.prepare(`
        SELECT id FROM dm_sessions
        WHERE character_id = ? AND status = 'active'
      `).get(secondCharacterId);

      if (secondCharActive) {
        return res.status(400).json({
          error: 'Second character already has an active DM session'
        });
      }

      const secondCharAdventure = db.prepare(`
        SELECT id FROM adventures
        WHERE character_id = ? AND (status = 'active' OR status = 'completed')
      `).get(secondCharacterId);

      if (secondCharAdventure) {
        return res.status(400).json({
          error: 'Second character is currently on a time-based adventure'
        });
      }
    }

    // Get pending downtime narratives for this character
    let pendingNarratives = [];
    try {
      pendingNarratives = JSON.parse(character.pending_downtime_narratives || '[]');
    } catch (e) {
      pendingNarratives = [];
    }

    // Extract used NPC names from past sessions to avoid reuse
    let usedNames = [];
    try {
      // First, check if we have names in campaign_config
      const campaignConfig = JSON.parse(character.campaign_config || '{}');
      if (campaignConfig.usedNames && Array.isArray(campaignConfig.usedNames)) {
        usedNames = [...campaignConfig.usedNames];
      }

      // Also extract from recent session messages if we need more context
      if (usedNames.length < 10) {
        const recentSessions = db.prepare(`
          SELECT messages FROM dm_sessions
          WHERE character_id = ? AND status = 'completed'
          ORDER BY created_at DESC LIMIT 5
        `).all(characterId);

        for (const sess of recentSessions) {
          try {
            const messages = JSON.parse(sess.messages || '[]');
            // Look for proper nouns in assistant messages (simple heuristic)
            for (const msg of messages) {
              if (msg.role === 'assistant') {
                // Match patterns like "Name says", "Name nods", etc.
                const nameMatches = msg.content.match(/\b([A-Z][a-z]{2,12})\b(?:\s+(?:says?|asks?|nods?|smiles?|grins?|replies?|responds?|turns?|looks?|whispers?))/g);
                if (nameMatches) {
                  for (const match of nameMatches) {
                    const name = match.split(/\s+/)[0];
                    // Filter out common non-names
                    const nonNames = ['You', 'The', 'Your', 'She', 'He', 'They', 'It', 'This', 'That', 'What', 'When', 'Where', 'Which', 'There'];
                    if (!nonNames.includes(name) && !usedNames.includes(name)) {
                      usedNames.push(name);
                    }
                  }
                }
              }
            }
          } catch (e) {
            // Ignore parse errors
          }
        }
      }

      // Limit to 30 names to avoid prompt bloat
      usedNames = [...new Set(usedNames)].slice(0, 30);
    } catch (e) {
      console.error('Error extracting used names:', e);
      usedNames = [];
    }

    // Build session config with campaign module or custom Forgotten Realms context
    const sessionConfig = {
      campaignModule,
      startingLocation,
      era,
      arrivalHook,
      customConcepts,
      contentPreferences,
      campaignLength,
      customNpcs,
      companions,
      pendingDowntimeNarratives: pendingNarratives,
      continueCampaign: continueCampaign || false,
      previousSessionSummaries: previousSessionSummaries || [],
      campaignNotes: character.campaign_notes || '',
      usedNames
    };

    // Check which LLM provider is available (prefers Claude)
    const { provider, status: llmStatus } = await getLLMProvider();
    if (!provider) {
      return res.status(503).json({
        error: 'No LLM provider available',
        details: llmStatus.error
      });
    }

    let result;
    if (provider === 'claude') {
      // Use Claude - build system prompt with Ollama's helper, then call Claude
      const systemPrompt = ollama.createDMSystemPrompt(character, sessionConfig, secondCharacter);

      // Build opening prompt (simplified version of what Ollama does internally)
      const charName = character.nickname || character.name.split(' ')[0];
      const isPublishedModule = campaignModule && campaignModule.type === 'published';
      const location = startingLocation;

      let openingPrompt;

      // Check if continuing from a previous session
      const isContinuing = continueCampaign && previousSessionSummaries && previousSessionSummaries.length > 0;
      const lastSessionSummary = isContinuing ? previousSessionSummaries[previousSessionSummaries.length - 1]?.summary : null;

      if (isPublishedModule) {
        if (isContinuing && lastSessionSummary) {
          openingPrompt = `Continue the ${campaignModule.name} campaign! This is a CONTINUATION from the previous session. Here's what happened last time:\n\n${lastSessionSummary}\n\nCRITICAL - HONOR SPECIFIC PLANS: If the summary mentions ANY specific plans, decisions, or timing the party made (like "agreed to leave at dawn", "planned to depart before sunrise", "decided to meet someone at midnight"), you MUST start the scene at EXACTLY that moment. Do NOT skip past their plans or change the timing they chose. The player made those decisions - respect them.\n\nPick up the story from where it left off. Write in second person ("you see", "you hear"). Do not speak dialogue for the player character. Do NOT recap the entire previous session - just smoothly continue the narrative.`;
        } else {
          openingPrompt = `Begin the ${campaignModule.name} campaign! Set an appropriate opening scene in ${campaignModule.setting}. Write in second person ("you see", "you hear"). Do not speak dialogue for the player character. Present the scene and let the player decide what to do.`;
        }
      } else {
        const locationDesc = location ? `${location.name}` : 'the Forgotten Realms';
        if (isContinuing && lastSessionSummary) {
          openingPrompt = `Continue the adventure! This is a CONTINUATION from the previous session. Here's what happened last time:\n\n${lastSessionSummary}\n\nCRITICAL - HONOR SPECIFIC PLANS: If the summary mentions ANY specific plans, decisions, or timing the party made (like "agreed to leave at dawn", "planned to depart before sunrise", "decided to meet someone at midnight"), you MUST start the scene at EXACTLY that moment. Do NOT skip past their plans or change the timing they chose. The player made those decisions - respect them.\n\nPick up the story from where it left off. Write in second person ("you see", "you hear"). Do not speak dialogue for the player character. Do NOT recap - just continue the narrative from the last situation.`;
        } else {
          openingPrompt = `Begin the adventure! Set the scene in ${locationDesc}. Write in second person ("you see", "you hear"). Do not speak dialogue for the player character. Describe where ${charName} is and what they observe. Present an engaging situation.`;
        }
      }

      const claudeResult = await claude.startSession(systemPrompt, openingPrompt);
      result = {
        systemPrompt,
        openingNarrative: claudeResult.response,
        messages: claudeResult.messages
      };
    } else {
      // Use Ollama
      result = await ollama.startSession(character, sessionConfig, model, secondCharacter);
    }

    // Create the session in the database
    const isPublishedModule = campaignModule && campaignModule.type === 'published';
    const locationName = isPublishedModule
      ? campaignModule.setting
      : (startingLocation?.name || 'Unknown Location');
    const moduleName = isPublishedModule ? campaignModule.name : null;

    const title = isPublishedModule
      ? `${moduleName}: ${character.nickname || character.name}`
      : secondCharacter
        ? `${character.nickname || character.name} & ${secondCharacter.nickname || secondCharacter.name} in ${locationName}`
        : `${character.nickname || character.name} in ${locationName}`;

    // Get character's current in-game date for session tracking
    // Prioritize the selected era's year - the player explicitly chose this era for the session
    const gameStartDay = character.game_day || 1;
    let gameStartYear = 1492; // Default fallback

    if (era && era.years) {
      // Parse year from era.years (e.g., "1271 DR", "1350-1370 DR")
      const yearMatch = era.years.match(/^(\d+)/);
      if (yearMatch) {
        gameStartYear = parseInt(yearMatch[1], 10);
      }
    } else if (character.game_year && character.game_year !== 1492) {
      // Use character's year only if they have a non-default year (from previous sessions)
      gameStartYear = character.game_year;
    }
    const gameDate = dayToDate(gameStartDay, gameStartYear);

    const stmt = db.prepare(`
      INSERT INTO dm_sessions (character_id, second_character_id, title, setting, tone, model, status, messages, start_time, session_config, game_start_day, game_start_year)
      VALUES (?, ?, ?, ?, ?, ?, 'active', ?, datetime('now'), ?, ?, ?)
    `);

    const info = stmt.run(
      characterId,
      secondCharacterId || null,
      title,
      locationName,
      campaignLength || 'ongoing-saga',
      model || 'llama3.2',
      JSON.stringify(result.messages),
      JSON.stringify(sessionConfig),
      gameStartDay,
      gameStartYear
    );

    // Clear pending downtime narratives now that they've been included in the session
    if (pendingNarratives.length > 0) {
      db.prepare(`
        UPDATE characters
        SET pending_downtime_narratives = '[]'
        WHERE id = ?
      `).run(characterId);
    }

    // Save campaign-level settings to character's campaign_config for persistence
    // This ensures custom concepts, selected NPCs, and other settings persist across sessions
    const campaignConfigToSave = {
      customConcepts: customConcepts || '',
      selectedNpcIds: (customNpcs || []).map(npc => npc.id),
      campaignModule: campaignModule?.id || 'custom',
      startingLocation: startingLocation?.id || '',
      era: era?.id || '',
      campaignLength: campaignLength || 'ongoing-saga',
      contentPreferences: contentPreferences || {}
    };

    db.prepare(`
      UPDATE characters
      SET campaign_config = ?
      WHERE id = ?
    `).run(JSON.stringify(campaignConfigToSave), characterId);

    res.json({
      sessionId: info.lastInsertRowid,
      title,
      openingNarrative: result.openingNarrative,
      startingLocation,
      era,
      gameDate
    });
  } catch (error) {
    console.error('Error starting DM session:', error);
    res.status(500).json({ error: error.message });
  }
});

// Helper: Detect if an NPC has agreed to join the party
function detectRecruitment(narrative, playerAction) {
  // Check if player asked someone to join OR if narrative shows organic joining
  const joinPhrases = [
    /join (?:us|me|my party|our party|the party)/i,
    /travel with (?:us|me)/i,
    /come with (?:us|me)/i,
    /accompany (?:us|me)/i,
    /(?:want|like) you to (?:join|come|travel)/i,
    /be (?:my|our) companion/i,
    /hire you/i,
    /recruit/i,
    /together/i,  // Organic joining phrases
    /with you/i,
    /by your side/i,
    /stand with/i
  ];

  // Also check narrative for organic joining moments
  const organicJoinPhrases = [
    /[""]together[""],?\s*(?:they|he|she|the|all)/i,
    /places? (?:their|his|her) hand (?:on top|atop|over)/i,
    /hands? (?:stack|together|clasped|joined)/i,
    /pledge(?:s|d)?\s+(?:to|their)/i,
    /swear(?:s|ing)?\s+(?:to|an? oath)/i,
    /bonds? of (?:fellowship|friendship|brotherhood)/i,
    /united\s+(?:in|by|together)/i,
    /shared\s+purpose/i
  ];

  const playerAskedToJoin = joinPhrases.some(phrase => phrase.test(playerAction));
  const organicJoinDetected = organicJoinPhrases.some(phrase => phrase.test(narrative));

  if (!playerAskedToJoin && !organicJoinDetected) {
    return null; // No joining detected
  }

  // Check if the NPC agreed in the response (or organic moment occurred)
  const agreementPhrases = [
    /i(?:'ll| will| would be (?:honored|glad|happy) to) (?:join|come|travel|accompany)/i,
    /(?:yes|aye|alright|very well)[,.]?\s*i(?:'ll| will) (?:join|come|go)/i,
    /count me in/i,
    /i(?:'m| am) (?:with you|in|coming)/i,
    /(?:lead|show) the way/i,
    /(?:glad|happy|honored|pleased) to (?:join|accompany|travel)/i,
    /you have (?:my|a) (?:sword|bow|axe|staff|blade|service)/i,
    /i'll (?:follow|serve|help) you/i,
    /where (?:do we|shall we|are we) (?:go|head|start)/i,
    /when do we (?:leave|start|begin)/i,
    // Organic agreement
    /[""]together[""],?\s*(?:they|he|she|agrees?)/i,
    /adds? (?:their|his|her) hand/i,
    /completing the circle/i,
    /firm (?:grip|resolve|nod)/i
  ];

  const npcAgreed = agreementPhrases.some(phrase => phrase.test(narrative));

  if (!npcAgreed) {
    return null;
  }

  // Try to extract the NPC name from the narrative
  // Look for dialogue patterns like: "Name says", "Name nods", etc.
  const namePatterns = [
    /[""]([^""]+?)[""] (?:says?|nods?|smiles?|grins?|agrees?|replies?|responds?|answers?)/i,
    /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+(?:says?|nods?|smiles?|grins?|agrees?|replies?|responds?|answers?)/,
    /(?:the |)([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+(?:looks at you|meets your eyes|extends|clasps|shakes)/
  ];

  let npcName = null;
  for (const pattern of namePatterns) {
    const match = narrative.match(pattern);
    if (match) {
      // Filter out common non-name words
      const candidate = match[1];
      const nonNames = ['you', 'he', 'she', 'they', 'the', 'a', 'an', 'your', 'my', 'his', 'her', 'their'];
      if (!nonNames.includes(candidate.toLowerCase())) {
        npcName = candidate;
        break;
      }
    }
  }

  // Also check player action for who they asked
  if (!npcName) {
    const askPatterns = [
      /(?:ask|invite|tell|want)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+to/i,
      /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)[,]?\s+(?:would you|will you|join)/i
    ];
    for (const pattern of askPatterns) {
      const match = playerAction.match(pattern);
      if (match) {
        npcName = match[1];
        break;
      }
    }
  }

  return {
    detected: true,
    npcName: npcName || 'Unknown NPC',
    trigger: 'agreement'
  };
}

// Send a message/action in the session
router.post('/:sessionId/message', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { action } = req.body;

    if (!action || !action.trim()) {
      return res.status(400).json({ error: 'Action is required' });
    }

    // Get the session
    const session = db.prepare('SELECT * FROM dm_sessions WHERE id = ?').get(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (session.status !== 'active') {
      return res.status(400).json({ error: 'Session is not active' });
    }

    const messages = JSON.parse(session.messages || '[]');

    // Check which LLM provider is available
    const { provider } = await getLLMProvider();
    if (!provider) {
      return res.status(503).json({ error: 'No LLM provider available' });
    }

    let result;
    if (provider === 'claude') {
      // Use Claude - extract system prompt from messages
      const systemMessage = messages.find(m => m.role === 'system');
      const systemPrompt = systemMessage?.content || '';
      const claudeResult = await claude.continueSession(systemPrompt, messages, action);
      result = {
        narrative: claudeResult.response,
        messages: claudeResult.messages
      };
    } else {
      // Use Ollama
      result = await ollama.continueSession(messages, action, session.model);
    }

    // Update the session in the database
    db.prepare('UPDATE dm_sessions SET messages = ? WHERE id = ?')
      .run(JSON.stringify(result.messages), sessionId);

    // Check for recruitment in the response
    const recruitment = detectRecruitment(result.narrative, action);

    // If recruitment detected, try to find the NPC in the database
    let recruitmentData = null;
    if (recruitment) {
      // Look for an NPC with this name who is available as a companion
      const npc = db.prepare(`
        SELECT id, name, nickname, race, gender, occupation, avatar
        FROM npcs
        WHERE (name LIKE ? OR nickname LIKE ?)
        AND campaign_availability IN ('available', 'companion')
        ORDER BY
          CASE WHEN name = ? THEN 1 WHEN nickname = ? THEN 2 ELSE 3 END
        LIMIT 1
      `).get(`%${recruitment.npcName}%`, `%${recruitment.npcName}%`, recruitment.npcName, recruitment.npcName);

      if (npc) {
        // Check if already a companion for this character
        const existingCompanion = db.prepare(`
          SELECT id FROM companions
          WHERE npc_id = ? AND recruited_by_character_id = ? AND status = 'active'
        `).get(npc.id, session.character_id);

        if (!existingCompanion) {
          recruitmentData = {
            detected: true,
            npc: {
              id: npc.id,
              name: npc.name,
              nickname: npc.nickname,
              race: npc.race,
              gender: npc.gender,
              occupation: npc.occupation,
              avatar: npc.avatar
            },
            sessionId: parseInt(sessionId),
            characterId: session.character_id
          };
        }
      } else {
        // NPC not in database - could offer to create them
        recruitmentData = {
          detected: true,
          npcName: recruitment.npcName,
          npcNotFound: true,
          sessionId: parseInt(sessionId),
          characterId: session.character_id
        };
      }
    }

    res.json({
      narrative: result.narrative,
      messageCount: result.messages.length,
      recruitment: recruitmentData
    });
  } catch (error) {
    console.error('Error in DM session message:', error);
    res.status(500).json({ error: error.message });
  }
});

// Adjust the game date during a session
router.post('/:sessionId/adjust-date', (req, res) => {
  try {
    const { sessionId } = req.params;
    const { daysToAdd } = req.body;

    if (typeof daysToAdd !== 'number') {
      return res.status(400).json({ error: 'daysToAdd must be a number' });
    }

    const session = db.prepare('SELECT * FROM dm_sessions WHERE id = ?').get(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Get current game date from session
    const currentDay = session.game_start_day || 1;
    const currentYear = session.game_start_year || 1492;

    // Advance (or go back) the date
    const newDate = advanceTime(currentDay, currentYear, daysToAdd);

    // Update the session with new date
    db.prepare(`
      UPDATE dm_sessions
      SET game_start_day = ?, game_start_year = ?
      WHERE id = ?
    `).run(newDate.day, newDate.year, sessionId);

    // Return the formatted date
    const gameDate = dayToDate(newDate.day, newDate.year);

    res.json({
      success: true,
      gameDate,
      day: newDate.day,
      year: newDate.year
    });
  } catch (error) {
    console.error('Error adjusting game date:', error);
    res.status(500).json({ error: error.message });
  }
});

// End a session - generates rewards based on session content
router.post('/:sessionId/end', async (req, res) => {
  try {
    const { sessionId } = req.params;

    // Get the session
    const session = db.prepare('SELECT * FROM dm_sessions WHERE id = ?').get(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (session.status !== 'active') {
      return res.status(400).json({ error: 'Session is not active' });
    }

    const messages = JSON.parse(session.messages || '[]');
    const character = db.prepare('SELECT * FROM characters WHERE id = ?').get(session.character_id);

    // Count player actions (user messages after the initial opening prompt)
    // Messages structure: [system, user (opening prompt), assistant (DM opening), user (player action), assistant, ...]
    // So player actions start at index 3 (every other message after that)
    const playerActionCount = messages.filter((m, i) => m.role === 'user' && i > 1).length;

    // If no player actions were taken, end session with no rewards
    if (playerActionCount === 0) {
      db.prepare(`
        UPDATE dm_sessions
        SET status = 'completed', summary = ?, rewards = ?, hp_change = ?,
            end_time = datetime('now')
        WHERE id = ?
      `).run('The adventure ended before it truly began.', JSON.stringify({ xp: 0, gold: { cp: 0, sp: 0, gp: 0 }, loot: null }), 0, sessionId);

      return res.json({
        success: true,
        summary: 'The adventure ended before it truly began.',
        rewards: { xp: 0, gold: { cp: 0, sp: 0, gp: 0 }, loot: null },
        hpChange: 0,
        analysis: { combat: 0, exploration: 0, roleplay: 0, risk: 0, success: 0 }
      });
    }

    // Calculate session duration in hours
    const startTime = new Date(session.start_time);
    const endTime = new Date();
    const durationHours = (endTime - startTime) / (1000 * 60 * 60);

    // Generate summary and rewards analysis from the AI
    let summary = '';
    let rewardsAnalysis = null;

    // Get character inventory for context
    const inventory = JSON.parse(character.inventory || '[]');
    const inventoryList = inventory.map(i => `${i.name}${i.quantity > 1 ? ` (x${i.quantity})` : ''}`).join(', ');

    try {
      // Ask AI to summarize and analyze rewards
      const analysisPrompt = `The session is ending. Analyze what the party ACTUALLY accomplished.

1. Write a summary (3-4 sentences) of what happened, including the current situation and any plans made.

2. Score each XP category based on ACTUAL accomplishments (0-10 each):

COMBAT: Fighting and defeating enemies
- 0=no combat, 2=minor skirmish/1-2 foes, 4=real fight, 6=challenging battle, 8=major battle, 10=epic war

EXPLORATION: Traveling and discovering locations
- 0=stayed in one place, 2=traveled to new location, 4=explored area thoroughly, 6=found hidden location, 8=major discovery, 10=legendary find

QUESTS: Completing objectives and missions (THIS IS IMPORTANT)
- Escorting someone safely = 3-5 depending on danger
- Rescuing someone = 4-6 depending on difficulty
- Delivering items/messages = 2-4
- Completing a mission for an NPC = 3-6
- Side objectives accomplished = 2-4 each
- 0=no objectives completed, 3=minor task done, 5=significant mission, 7=major quest milestone, 10=campaign-defining achievement

DISCOVERY: Uncovering secrets, plots, and information
- Learning important information = 2-3
- Uncovering a deception or lie = 3-4
- Discovering an enemy's plan = 4-5
- Finding crucial evidence = 3-5
- Major plot revelation = 6-8
- 0=learned nothing new, 3=useful intel, 5=significant secret, 8=major revelation, 10=world-changing truth

SOCIAL: Building relationships and alliances
- Making a new ally = 2-3
- Deepening an existing relationship = 2-3
- Recruiting a companion = 4-5
- Negotiating successfully = 2-4
- Earning trust of important NPC = 3-5
- 0=no meaningful interactions, 3=friendship formed, 5=strong bond built, 8=life-changing connection, 10=legendary alliance

DANGER: Risk faced during the session (affects XP multiplier)
- 0=completely safe, 3=some risk, 5=real danger, 8=near death, 10=facing certain doom

3. Track INVENTORY CHANGES:
The character's current inventory is: ${inventoryList || 'empty'}
The character's current gold: ${character.gold_gp || 0} gp, ${character.gold_sp || 0} sp, ${character.gold_cp || 0} cp

Format EXACTLY like this:
SUMMARY: [What happened and current situation]
COMBAT: [0-10]
EXPLORATION: [0-10]
QUESTS: [0-10]
DISCOVERY: [0-10]
SOCIAL: [0-10]
DANGER: [0-10]
ITEMS_CONSUMED: [item1 x quantity, item2 x quantity] or [none]
GOLD_SPENT: [X gp, Y sp, Z cp] or [none]
ITEMS_GAINED: [item1, item2] or [none]`;

      // Check which LLM provider is available
      const { provider } = await getLLMProvider();

      let analysisResponse;
      if (provider === 'claude') {
        // Use Claude for analysis
        const systemMessage = messages.find(m => m.role === 'system');
        const systemPrompt = systemMessage?.content || '';
        const analysisMessages = [
          ...messages.filter(m => m.role !== 'system'),
          { role: 'user', content: analysisPrompt }
        ];
        analysisResponse = await claude.chat(systemPrompt, analysisMessages);
      } else {
        // Use Ollama for analysis
        const analysisMessages = [
          ...messages,
          { role: 'user', content: analysisPrompt }
        ];
        analysisResponse = await ollama.chat(analysisMessages, session.model);
      }

      // Parse the response
      const lines = analysisResponse.split('\n');
      const summaryLine = lines.find(l => l.startsWith('SUMMARY:'));
      summary = summaryLine ? summaryLine.replace('SUMMARY:', '').trim() : 'The adventure concluded.';

      rewardsAnalysis = {
        combat: parseInt(lines.find(l => l.startsWith('COMBAT:'))?.match(/\d+/)?.[0]) || 0,
        exploration: parseInt(lines.find(l => l.startsWith('EXPLORATION:'))?.match(/\d+/)?.[0]) || 0,
        quests: parseInt(lines.find(l => l.startsWith('QUESTS:'))?.match(/\d+/)?.[0]) || 0,
        discovery: parseInt(lines.find(l => l.startsWith('DISCOVERY:'))?.match(/\d+/)?.[0]) || 0,
        social: parseInt(lines.find(l => l.startsWith('SOCIAL:'))?.match(/\d+/)?.[0]) || 0,
        danger: parseInt(lines.find(l => l.startsWith('DANGER:'))?.match(/\d+/)?.[0]) || 0
      };

      // Parse inventory changes
      const itemsConsumedLine = lines.find(l => l.startsWith('ITEMS_CONSUMED:'));
      const goldSpentLine = lines.find(l => l.startsWith('GOLD_SPENT:'));
      const itemsGainedLine = lines.find(l => l.startsWith('ITEMS_GAINED:'));

      const parseItems = (line, prefix) => {
        if (!line) return [];
        const content = line.replace(prefix, '').trim();
        if (content.toLowerCase() === '[none]' || content.toLowerCase() === 'none' || content === '[]') return [];
        // Remove brackets and split by comma
        const cleaned = content.replace(/^\[|\]$/g, '').trim();
        if (!cleaned) return [];
        return cleaned.split(',').map(item => item.trim()).filter(Boolean);
      };

      const parseGold = (line) => {
        if (!line) return { gp: 0, sp: 0, cp: 0 };
        const content = line.replace('GOLD_SPENT:', '').trim();
        if (content.toLowerCase() === '[none]' || content.toLowerCase() === 'none' || content === '[]') {
          return { gp: 0, sp: 0, cp: 0 };
        }
        const gp = parseInt(content.match(/(\d+)\s*gp/i)?.[1]) || 0;
        const sp = parseInt(content.match(/(\d+)\s*sp/i)?.[1]) || 0;
        const cp = parseInt(content.match(/(\d+)\s*cp/i)?.[1]) || 0;
        return { gp, sp, cp };
      };

      rewardsAnalysis.inventoryChanges = {
        consumed: parseItems(itemsConsumedLine, 'ITEMS_CONSUMED:'),
        gained: parseItems(itemsGainedLine, 'ITEMS_GAINED:'),
        goldSpent: parseGold(goldSpentLine)
      };
    } catch (e) {
      console.error('Could not generate analysis:', e);
      summary = 'The adventure concluded.';
      // Default to zero rewards if analysis fails
      rewardsAnalysis = { combat: 0, exploration: 0, quests: 0, discovery: 0, social: 0, danger: 0, inventoryChanges: null };
    }

    // Check if anything meaningful happened - any category with score >= 2 counts
    const totalActivity = rewardsAnalysis.combat + rewardsAnalysis.exploration +
                          rewardsAnalysis.quests + rewardsAnalysis.discovery + rewardsAnalysis.social;
    const meaningfulSession = totalActivity >= 2;

    // Calculate rewards - zero if nothing meaningful happened
    let rewards;
    if (!meaningfulSession) {
      rewards = { xp: 0, gold: { cp: 0, sp: 0, gp: 0 }, loot: null, breakdown: null };
    } else {
      rewards = calculateSessionRewards(character, durationHours, rewardsAnalysis);
    }

    // Determine HP change based on combat and danger
    let hpChange = 0;
    if (rewardsAnalysis.combat > 3) {
      // Combat occurred - potential HP loss based on danger
      const damageRisk = (rewardsAnalysis.combat + rewardsAnalysis.danger) / 2;
      const maxDamage = Math.floor(character.max_hp * 0.4); // Max 40% HP loss
      hpChange = -Math.floor(maxDamage * (damageRisk / 10) * 0.5);
    }
    // Healing if successful quests and low combat (safe rest)
    if (rewardsAnalysis.quests >= 5 && rewardsAnalysis.combat <= 2 && rewardsAnalysis.danger <= 3) {
      const missingHp = character.max_hp - character.current_hp;
      hpChange = Math.floor(missingHp * 0.25); // Heal 25% of missing HP
    }

    // Calculate in-game time passed (1-3 days based on activity)
    const activityLevel = (rewardsAnalysis.combat + rewardsAnalysis.exploration + rewardsAnalysis.quests + rewardsAnalysis.social) / 40;
    const daysElapsed = Math.max(1, Math.ceil(activityLevel * 3)); // 1-3 days based on how much happened

    // Get current game date from the session (session stores the authoritative date)
    const currentGameDay = session.game_start_day || character.game_day || 1;
    const currentGameYear = session.game_start_year || character.game_year || 1492;
    const newGameDate = advanceTime(currentGameDay, currentGameYear, daysElapsed);

    // Update character's game date
    db.prepare(`
      UPDATE characters
      SET game_day = ?, game_year = ?
      WHERE id = ?
    `).run(newGameDate.day, newGameDate.year, session.character_id);

    // Extract key campaign details for persistent memory
    let extractedNotes = '';
    try {
      const { provider } = await getLLMProvider();
      if (provider && playerActionCount > 0) {
        const extractionPrompt = `Extract ONLY the important details from this session that should be remembered for future adventures. Be concise and specific.

Format your response as bullet points under these categories (skip any category with nothing to report):

NPCS MET:
- [Name]: [Brief description, relationship to player, any promises made]

ITEMS GIVEN OR RECEIVED:
- [What was given/received, to/from whom]

PROMISES & OBLIGATIONS:
- [What was promised, to whom, what's expected]

KEY RELATIONSHIPS:
- [Person]: [Nature of relationship - ally, enemy, employer, friend, etc.]

IMPORTANT LOCATIONS:
- [Place]: [Why it matters]

UNRESOLVED THREADS:
- [Plot hooks, mysteries, or tasks left incomplete]

ONLY include things that ACTUALLY happened. Be specific with names and details. Keep each bullet to one line.`;

        let notesResponse;
        if (provider === 'claude') {
          const systemMessage = messages.find(m => m.role === 'system');
          const systemPrompt = systemMessage?.content || '';
          const extractMessages = [
            ...messages.filter(m => m.role !== 'system'),
            { role: 'user', content: extractionPrompt }
          ];
          notesResponse = await claude.chat(systemPrompt, extractMessages);
        } else {
          const extractMessages = [
            ...messages,
            { role: 'user', content: extractionPrompt }
          ];
          notesResponse = await ollama.chat(extractMessages, session.model);
        }

        extractedNotes = notesResponse.trim();

        // Append to existing campaign notes if we got something meaningful
        if (extractedNotes && extractedNotes.length > 20) {
          const existingNotes = character.campaign_notes || '';
          const sessionDate = dayToDate(currentGameDay, currentGameYear);
          const newNotesSection = `\n\n--- Session: ${session.title} (${sessionDate.formatted}) ---\n${extractedNotes}`;

          // Keep notes from growing too large - keep last ~8000 chars
          let updatedNotes = existingNotes + newNotesSection;
          if (updatedNotes.length > 10000) {
            // Find a good break point to trim from the start
            const trimPoint = updatedNotes.indexOf('\n--- Session:', 2000);
            if (trimPoint > 0) {
              updatedNotes = '[Earlier notes trimmed...]\n' + updatedNotes.substring(trimPoint);
            }
          }

          db.prepare(`
            UPDATE characters
            SET campaign_notes = ?
            WHERE id = ?
          `).run(updatedNotes, session.character_id);
        }
      }
    } catch (e) {
      console.error('Could not extract campaign notes:', e);
      // Non-fatal - continue without notes extraction
    }

    // Extract and save NPC names used in this session for future name tracking
    try {
      // Get current campaign config
      let campaignConfig = {};
      try {
        campaignConfig = JSON.parse(character.campaign_config || '{}');
      } catch (e) {
        campaignConfig = {};
      }

      // Initialize usedNames array if not present
      if (!campaignConfig.usedNames || !Array.isArray(campaignConfig.usedNames)) {
        campaignConfig.usedNames = [];
      }

      // Extract names from this session's messages
      const nameMatches = [];
      for (const msg of messages) {
        if (msg.role === 'assistant') {
          // Match patterns like "Name says", "Name nods", etc.
          const matches = msg.content.match(/\b([A-Z][a-z]{2,12})\b(?:\s+(?:says?|asks?|nods?|smiles?|grins?|replies?|responds?|turns?|looks?|whispers?|shakes?|laughs?|frowns?))/g);
          if (matches) {
            for (const match of matches) {
              const name = match.split(/\s+/)[0];
              const nonNames = ['You', 'The', 'Your', 'She', 'He', 'They', 'It', 'This', 'That', 'What', 'When', 'Where', 'Which', 'There'];
              if (!nonNames.includes(name) && !nameMatches.includes(name)) {
                nameMatches.push(name);
              }
            }
          }
        }
      }

      // Add new names to the list (avoid duplicates)
      for (const name of nameMatches) {
        if (!campaignConfig.usedNames.includes(name)) {
          campaignConfig.usedNames.push(name);
        }
      }

      // Limit to 50 names to avoid bloat
      if (campaignConfig.usedNames.length > 50) {
        campaignConfig.usedNames = campaignConfig.usedNames.slice(-50);
      }

      // Save updated campaign config
      db.prepare(`
        UPDATE characters
        SET campaign_config = ?
        WHERE id = ?
      `).run(JSON.stringify(campaignConfig), session.character_id);
    } catch (e) {
      console.error('Error extracting used names:', e);
      // Non-fatal - continue
    }

    // Update the session with end game date
    db.prepare(`
      UPDATE dm_sessions
      SET status = 'completed', summary = ?, rewards = ?, hp_change = ?,
          end_time = datetime('now'), game_end_day = ?, game_end_year = ?
      WHERE id = ?
    `).run(summary, JSON.stringify(rewards), hpChange, newGameDate.day, newGameDate.year, sessionId);

    res.json({
      success: true,
      summary,
      rewards,
      hpChange,
      analysis: rewardsAnalysis,
      daysElapsed,
      newGameDate: dayToDate(newGameDate.day, newGameDate.year)
    });
  } catch (error) {
    console.error('Error ending DM session:', error);
    res.status(500).json({ error: error.message });
  }
});

// Apply inventory changes from session wrap-up
router.post('/:sessionId/apply-inventory', (req, res) => {
  try {
    const { sessionId } = req.params;
    const { consumed, gained, goldSpent } = req.body;

    const session = db.prepare('SELECT * FROM dm_sessions WHERE id = ?').get(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const character = db.prepare('SELECT * FROM characters WHERE id = ?').get(session.character_id);
    if (!character) {
      return res.status(404).json({ error: 'Character not found' });
    }

    let inventory = JSON.parse(character.inventory || '[]');
    const changes = [];

    // Process consumed items
    if (consumed && consumed.length > 0) {
      for (const itemStr of consumed) {
        // Parse "item x quantity" format
        const match = itemStr.match(/^(.+?)\s*(?:x\s*(\d+))?$/i);
        if (!match) continue;
        const itemName = match[1].trim().toLowerCase();
        const quantity = parseInt(match[2]) || 1;

        // Find the item in inventory (case-insensitive partial match)
        const itemIndex = inventory.findIndex(i =>
          i.name.toLowerCase().includes(itemName) || itemName.includes(i.name.toLowerCase())
        );

        if (itemIndex !== -1) {
          const item = inventory[itemIndex];
          if (item.quantity && item.quantity > quantity) {
            item.quantity -= quantity;
            changes.push(`Used ${quantity}x ${item.name}`);
          } else {
            inventory.splice(itemIndex, 1);
            changes.push(`Used ${item.name}`);
          }
        }
      }
    }

    // Process gained items
    if (gained && gained.length > 0) {
      for (const itemName of gained) {
        if (!itemName || itemName.toLowerCase() === 'none') continue;
        // Check if item already exists
        const existingItem = inventory.find(i =>
          i.name.toLowerCase() === itemName.toLowerCase()
        );
        if (existingItem && existingItem.quantity) {
          existingItem.quantity += 1;
        } else {
          inventory.push({ name: itemName, quantity: 1 });
        }
        changes.push(`Gained ${itemName}`);
      }
    }

    // Process gold spent
    let newGp = character.gold_gp || 0;
    let newSp = character.gold_sp || 0;
    let newCp = character.gold_cp || 0;

    if (goldSpent) {
      // Convert everything to copper for easier math
      let totalCopper = (newGp * 100) + (newSp * 10) + newCp;
      const spentCopper = ((goldSpent.gp || 0) * 100) + ((goldSpent.sp || 0) * 10) + (goldSpent.cp || 0);
      totalCopper = Math.max(0, totalCopper - spentCopper);

      // Convert back
      newGp = Math.floor(totalCopper / 100);
      totalCopper %= 100;
      newSp = Math.floor(totalCopper / 10);
      newCp = totalCopper % 10;

      if (spentCopper > 0) {
        changes.push(`Spent ${goldSpent.gp || 0}gp ${goldSpent.sp || 0}sp ${goldSpent.cp || 0}cp`);
      }
    }

    // Update character
    db.prepare(`
      UPDATE characters
      SET inventory = ?, gold_gp = ?, gold_sp = ?, gold_cp = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(JSON.stringify(inventory), newGp, newSp, newCp, character.id);

    res.json({
      success: true,
      changes,
      newInventory: inventory,
      newGold: { gp: newGp, sp: newSp, cp: newCp }
    });
  } catch (error) {
    console.error('Error applying inventory changes:', error);
    res.status(500).json({ error: error.message });
  }
});

// Resume a paused session
router.post('/:sessionId/resume', async (req, res) => {
  try {
    const { sessionId } = req.params;

    const session = db.prepare('SELECT * FROM dm_sessions WHERE id = ?').get(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (session.status !== 'paused') {
      return res.status(400).json({ error: 'Session is not paused' });
    }

    // Get character and check for pending downtime narratives
    const character = db.prepare('SELECT * FROM characters WHERE id = ?').get(session.character_id);
    let pendingNarratives = [];
    let downtimeContext = '';
    try {
      pendingNarratives = JSON.parse(character.pending_downtime_narratives || '[]');
      if (pendingNarratives.length > 0) {
        // Build downtime context to inject into the system prompt
        const narrativeDescriptions = pendingNarratives.map(event => {
          let desc = `- ${event.activityName} (${event.duration}): ${event.result}`;
          if (event.details?.events && event.details.events.length > 0) {
            desc += ` (${event.details.events.join(', ')})`;
          }
          return desc;
        });
        downtimeContext = `\n\nRECENT DOWNTIME (since last session):\nThe character completed these activities while the adventure was paused. Acknowledge this naturally when the adventure continues:\n${narrativeDescriptions.join('\n')}\n`;
      }
    } catch (e) {
      pendingNarratives = [];
    }

    let messages = JSON.parse(session.messages || '[]');

    // If there are pending narratives, update the system prompt to include them
    if (pendingNarratives.length > 0) {
      const systemMessageIndex = messages.findIndex(m => m.role === 'system');
      if (systemMessageIndex !== -1) {
        // Append downtime context to the system prompt
        messages[systemMessageIndex].content += downtimeContext;
        // Save updated messages
        db.prepare('UPDATE dm_sessions SET messages = ? WHERE id = ?')
          .run(JSON.stringify(messages), sessionId);
      }
      // Clear the pending narratives
      db.prepare(`
        UPDATE characters
        SET pending_downtime_narratives = '[]'
        WHERE id = ?
      `).run(character.id);
    }

    // Generate a "Previously on..." recap if we don't have one yet
    let recap = session.recap;
    if (!recap && messages.length > 3) {
      try {
        const { provider } = await getLLMProvider();

        if (provider) {
          const recapPrompt = `The player is returning to a paused adventure. Write a brief "Previously on..." style recap (2-3 sentences max) summarizing what has happened so far in this adventure. Write in past tense. Be dramatic but concise. Do NOT include any meta-commentary.`;

          if (provider === 'claude') {
            const systemMessage = messages.find(m => m.role === 'system');
            const systemPrompt = systemMessage?.content || '';
            const recapMessages = [
              ...messages.filter(m => m.role !== 'system'),
              { role: 'user', content: recapPrompt }
            ];
            recap = await claude.chat(systemPrompt, recapMessages);
          } else {
            const recapMessages = [
              ...messages,
              { role: 'user', content: recapPrompt }
            ];
            recap = await ollama.chat(recapMessages, session.model);
          }

          // Save the recap so we don't regenerate it each time
          db.prepare('UPDATE dm_sessions SET recap = ? WHERE id = ?').run(recap, sessionId);
        }
      } catch (e) {
        console.error('Could not generate recap:', e);
        // Continue without recap
      }
    }

    // Update session status to active
    db.prepare(`
      UPDATE dm_sessions
      SET status = 'active'
      WHERE id = ?
    `).run(sessionId);

    res.json({
      success: true,
      message: 'Adventure resumed. Continue where you left off!',
      recap,
      downtimeAcknowledged: pendingNarratives.length > 0 ? pendingNarratives.length : 0
    });
  } catch (error) {
    console.error('Error resuming session:', error);
    res.status(500).json({ error: error.message });
  }
});

// Pause a session - saves state for later
router.post('/:sessionId/pause', (req, res) => {
  try {
    const { sessionId } = req.params;

    const session = db.prepare('SELECT * FROM dm_sessions WHERE id = ?').get(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (session.status !== 'active') {
      return res.status(400).json({ error: 'Session is not active' });
    }

    // Update session status to paused
    db.prepare(`
      UPDATE dm_sessions
      SET status = 'paused'
      WHERE id = ?
    `).run(sessionId);

    res.json({
      success: true,
      message: 'Adventure paused. You can return to continue where you left off.'
    });
  } catch (error) {
    console.error('Error pausing session:', error);
    res.status(500).json({ error: error.message });
  }
});

// Abort a session - ends without saving to history or giving rewards
router.post('/:sessionId/abort', (req, res) => {
  try {
    const { sessionId } = req.params;

    const session = db.prepare('SELECT * FROM dm_sessions WHERE id = ?').get(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (session.status !== 'active' && session.status !== 'paused') {
      return res.status(400).json({ error: 'Session is not active or paused' });
    }

    // Delete the session entirely - no logging, no rewards
    db.prepare('DELETE FROM dm_sessions WHERE id = ?').run(sessionId);

    res.json({
      success: true,
      message: 'Adventure aborted. No rewards have been given and no record has been kept.'
    });
  } catch (error) {
    console.error('Error aborting session:', error);
    res.status(500).json({ error: error.message });
  }
});

// Claim rewards from a completed session
router.post('/:sessionId/claim', (req, res) => {
  try {
    const { sessionId } = req.params;

    const session = db.prepare('SELECT * FROM dm_sessions WHERE id = ?').get(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (session.status !== 'completed') {
      return res.status(400).json({ error: 'Session is not completed' });
    }

    if (session.rewards_claimed) {
      return res.status(400).json({ error: 'Rewards already claimed' });
    }

    const character = db.prepare('SELECT * FROM characters WHERE id = ?').get(session.character_id);
    const rewards = JSON.parse(session.rewards || '{}');

    // Apply rewards to character
    const updates = {
      experience: character.experience + (rewards.xp || 0),
      gold_cp: character.gold_cp + (rewards.gold?.cp || 0),
      gold_sp: character.gold_sp + (rewards.gold?.sp || 0),
      gold_gp: character.gold_gp + (rewards.gold?.gp || 0),
      current_hp: Math.max(1, Math.min(character.max_hp, character.current_hp + (session.hp_change || 0)))
    };

    // Add loot to inventory
    let inventory = JSON.parse(character.inventory || '[]');
    if (rewards.loot) {
      inventory.push({ name: rewards.loot, quantity: 1 });
    }

    // Update location if specified
    const newLocation = session.new_location || character.current_location;
    const newQuest = session.new_quest || character.current_quest;

    // Update character
    db.prepare(`
      UPDATE characters
      SET experience = ?, gold_cp = ?, gold_sp = ?, gold_gp = ?,
          current_hp = ?, inventory = ?, current_location = ?, current_quest = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      updates.experience,
      updates.gold_cp,
      updates.gold_sp,
      updates.gold_gp,
      updates.current_hp,
      JSON.stringify(inventory),
      newLocation,
      newQuest,
      session.character_id
    );

    // Award XP to active companions (full XP - party shares equally, not split)
    const companionXP = rewards.xp || 0;
    const companionXPResults = [];
    if (companionXP > 0) {
      const companions = db.prepare(`
        SELECT c.id, c.companion_level, c.companion_experience, c.companion_class, n.name
        FROM companions c
        JOIN npcs n ON c.npc_id = n.id
        WHERE c.recruited_by_character_id = ? AND c.status = 'active' AND c.progression_type = 'class_based'
      `).all(session.character_id);

      for (const companion of companions) {
        const oldXP = companion.companion_experience || 0;
        const newXP = oldXP + companionXP;
        const currentLevel = companion.companion_level;
        const nextLevelXP = currentLevel < 20 ? XP_THRESHOLDS[currentLevel + 1] : null;
        const canLevelUp = nextLevelXP !== null && newXP >= nextLevelXP;

        db.prepare(`
          UPDATE companions SET companion_experience = ? WHERE id = ?
        `).run(newXP, companion.id);

        companionXPResults.push({
          id: companion.id,
          name: companion.name,
          class: companion.companion_class,
          level: currentLevel,
          xpGained: companionXP,
          totalXP: newXP,
          canLevelUp,
          xpToNextLevel: nextLevelXP ? nextLevelXP - newXP : null
        });
      }
    }

    // Mark rewards as claimed
    db.prepare('UPDATE dm_sessions SET rewards_claimed = 1 WHERE id = ?').run(sessionId);

    const updatedCharacter = db.prepare('SELECT * FROM characters WHERE id = ?').get(session.character_id);

    res.json({
      message: 'Session rewards claimed!',
      character: updatedCharacter,
      rewards,
      companionXP: companionXP > 0 ? companionXP : undefined,
      companionXPResults: companionXPResults.length > 0 ? companionXPResults : undefined,
      hpChange: session.hp_change
    });
  } catch (error) {
    console.error('Error claiming session rewards:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete a session
router.delete('/:sessionId', (req, res) => {
  try {
    const result = db.prepare('DELETE FROM dm_sessions WHERE id = ?').run(req.params.sessionId);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Clear all session history for a character
router.delete('/character/:characterId/history', (req, res) => {
  try {
    const { characterId } = req.params;

    // Only delete completed sessions (not active ones)
    const result = db.prepare(`
      DELETE FROM dm_sessions
      WHERE (character_id = ? OR second_character_id = ?)
      AND status = 'completed'
    `).run(characterId, characterId);

    res.json({
      success: true,
      deletedCount: result.changes
    });
  } catch (error) {
    console.error('Error clearing session history:', error);
    res.status(500).json({ error: error.message });
  }
});

// Helper: Calculate session rewards based on AI analysis
// Uses ADDITIVE XP system - each category contributes independently
function calculateSessionRewards(character, durationHours, analysis) {
  // Base XP from character level
  const baseXP = getBaseXPReward(character.level);

  // Time multiplier (cap at 2 hours - prevents gaming by leaving sessions running)
  const timeMultiplier = Math.min(2, Math.max(0.5, durationHours)) / 2;

  // XP contribution weights by category (total = 0.9 if all maxed at 10)
  // Quests are weighted highest - completing objectives is core D&D
  const weights = {
    combat: 0.25,      // Fighting is important but not the only way
    exploration: 0.15, // Traveling and discovering
    quests: 0.30,      // Completing objectives - the big one
    discovery: 0.15,   // Uncovering secrets and information
    social: 0.05       // Building relationships (low - happens every session)
  };

  // Calculate XP contribution from each category (additive, not multiplicative)
  const combatXP = Math.floor(baseXP * weights.combat * (analysis.combat / 10));
  const explorationXP = Math.floor(baseXP * weights.exploration * (analysis.exploration / 10));
  const questsXP = Math.floor(baseXP * weights.quests * (analysis.quests / 10));
  const discoveryXP = Math.floor(baseXP * weights.discovery * (analysis.discovery / 10));
  const socialXP = Math.floor(baseXP * weights.social * (analysis.social / 10));

  // Subtotal before danger bonus
  const subtotalXP = combatXP + explorationXP + questsXP + discoveryXP + socialXP;

  // Danger bonus: facing real peril deserves extra reward (up to +30%)
  const dangerBonus = analysis.danger / 10 * 0.30;
  const dangerXP = Math.floor(subtotalXP * dangerBonus);

  // Apply time multiplier to total
  const totalXP = Math.floor((subtotalXP + dangerXP) * timeMultiplier);

  // Gold scales with quests completed and danger faced
  const dangerLevel = analysis.danger >= 7 ? 'high' : analysis.danger >= 4 ? 'medium' : 'low';
  const goldMultiplier = timeMultiplier * (analysis.quests / 10);
  const gold = calculateGoldReward(character.level, dangerLevel, goldMultiplier);

  // Loot chance based on combat and exploration with danger
  let loot = null;
  const lootChance = (analysis.combat + analysis.exploration + analysis.danger) / 30;
  if (lootChance > 0.2 && Math.random() < lootChance * 0.4) {
    loot = generateLoot(character.level, dangerLevel) || generateLoot(character.level, 'high');
  }

  return {
    xp: totalXP,
    gold,
    loot,
    breakdown: {
      baseXP,
      categories: {
        combat: { score: analysis.combat, xp: combatXP },
        exploration: { score: analysis.exploration, xp: explorationXP },
        quests: { score: analysis.quests, xp: questsXP },
        discovery: { score: analysis.discovery, xp: discoveryXP },
        social: { score: analysis.social, xp: socialXP }
      },
      dangerBonus: { score: analysis.danger, xp: dangerXP },
      subtotal: subtotalXP,
      timeMultiplier: Math.round(timeMultiplier * 100) / 100
    }
  };
}

export default router;
