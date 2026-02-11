import express from 'express';
import { dbAll, dbGet, dbRun } from '../database.js';
import ollama from '../services/ollama.js';
import claude from '../services/claude.js';
import { dayToDate, advanceTime } from '../config/harptos.js';
import { XP_THRESHOLDS } from '../config/levelProgression.js';
import { formatThreadsForAI } from '../services/storyThreads.js';
import { getNarrativeContextForSession, markNarrativeItemsDelivered, onDMSessionStarted } from '../services/narrativeIntegration.js';
import { getPlanSummaryForSession } from '../services/campaignPlanService.js';
import { getCharacterWorldView } from '../services/livingWorldService.js';
import { getActiveFactions } from '../services/factionService.js';
import { getCharacterRelationshipsWithNpcs } from '../services/npcRelationshipService.js';
import { getDiscoveredLocations } from '../services/locationService.js';
import { getEventsVisibleToCharacter } from '../services/worldEventService.js';
import { getMerchantInventory, getMerchantsByCampaign, restockMerchant, updateMerchantAfterTransaction, generateBuybackPrices, createMerchantOnTheFly, addItemToMerchant, ensureItemAtMerchant } from '../services/merchantService.js';
import {
  parseNpcJoinMarker, detectDowntime, detectRecruitment, detectMerchantShop,
  detectMerchantRefer, detectAddItem, detectLootDrop, detectCombatStart, detectCombatEnd, estimateEnemyDexMod,
  buildAnalysisPrompt, parseAnalysisResponse, calculateSessionRewards,
  calculateHPChange, calculateGameTimeAdvance,
  buildNotesExtractionPrompt, appendCampaignNotes,
  buildNpcExtractionPrompt, saveExtractedNpcs,
  buildMemoryExtractionPrompt, updateCharacterMemories,
  extractAndTrackUsedNames,
  emitSessionEvents, emitSessionEndedEvent
} from '../services/dmSessionService.js';
import { lookupItemByName } from '../data/merchantLootTables.js';
import { getLootTableForLevel } from '../config/rewards.js';

const router = express.Router();

/**
 * Pick a starting day based on campaign description keywords.
 * Returns a day-of-year (1-365) in the matching season, or random if no match.
 * Harptos calendar seasons:
 *   Winter: days 1-61 (Hammer, Midwinter, Alturiak) + 336-365 (Nightal)
 *   Spring: days 62-152 (Ches, Tarsakh, Greengrass, Mirtul)
 *   Summer: days 153-243 (Kythorn, Flamerule, Midsummer, Eleasis)
 *   Autumn: days 244-335 (Eleint, Highharvestide, Marpenoth, Uktar, Feast of the Moon)
 */
function pickSeasonalStartDay(campaignDescription, startingLocationName) {
  const text = `${campaignDescription || ''} ${startingLocationName || ''}`.toLowerCase();

  const SEASON_RANGES = {
    winter: [[1, 61], [336, 365]],
    spring: [[62, 152]],
    summer: [[153, 243]],
    autumn: [[244, 335]]
  };

  const SEASON_KEYWORDS = {
    winter: ['winter', 'cold', 'frost', 'ice', 'snow', 'frozen', 'blizzard', 'icewind', 'dead of winter', 'deepwinter', 'frigid', 'chill'],
    summer: ['summer', 'heat', 'hot', 'scorching', 'desert', 'arid', 'swelter', 'blazing sun'],
    spring: ['spring', 'thaw', 'bloom', 'renewal', 'planting', 'melting'],
    autumn: ['autumn', 'fall', 'harvest', 'leaves', 'rotting', 'fading']
  };

  let matchedSeason = null;
  for (const [season, keywords] of Object.entries(SEASON_KEYWORDS)) {
    if (keywords.some(kw => text.includes(kw))) {
      matchedSeason = season;
      break;
    }
  }

  if (!matchedSeason) {
    return Math.floor(Math.random() * 365) + 1;
  }

  // Pick a random day within the matched season's ranges
  const ranges = SEASON_RANGES[matchedSeason];
  const possibleDays = [];
  for (const [start, end] of ranges) {
    for (let d = start; d <= end; d++) {
      possibleDays.push(d);
    }
  }
  return possibleDays[Math.floor(Math.random() * possibleDays.length)];
}

// Helper to determine which LLM provider to use
async function getLLMProvider(preference = 'auto') {
  // If user explicitly requested a specific provider, try that first
  if (preference === 'ollama') {
    const ollamaStatus = await ollama.checkOllamaStatus();
    if (ollamaStatus.available) {
      return { provider: 'ollama', status: ollamaStatus };
    }
    return { provider: null, status: { available: false, error: 'Ollama is not running. Start Ollama to use local AI.' } };
  }

  if (preference === 'claude') {
    if (claude.isClaudeAvailable()) {
      const status = await claude.checkClaudeStatus();
      if (status.available) {
        return { provider: 'claude', status };
      }
    }
    return { provider: null, status: { available: false, error: 'Claude API not available. Check your ANTHROPIC_API_KEY.' } };
  }

  // Auto mode: try Claude first, then Ollama fallback
  if (claude.isClaudeAvailable()) {
    const status = await claude.checkClaudeStatus();
    if (status.available) {
      return { provider: 'claude', status };
    }
    console.log('Claude unavailable, checking Ollama fallback...');
  }

  const ollamaStatus = await ollama.checkOllamaStatus();
  if (ollamaStatus.available) {
    return { provider: 'ollama', status: ollamaStatus };
  }

  const claudeConfigured = claude.isClaudeAvailable();
  const errorMsg = claudeConfigured
    ? 'Claude API unavailable (no internet?) and Ollama not running. Start Ollama for offline mode.'
    : 'No LLM provider available. Set ANTHROPIC_API_KEY for Claude or install Ollama for local AI.';

  return { provider: null, status: { available: false, error: errorMsg } };
}

// Check LLM status (prefers Claude, falls back to Ollama)
router.get('/llm-status', async (req, res) => {
  try {
    const preference = req.query.preference || 'auto';
    const { provider, status } = await getLLMProvider(preference);
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

// Debug: View latest session data (for testing)
router.get('/debug/latest-session', async (req, res) => {
  try {
    const session = await dbGet(`
      SELECT id, character_id, title, model, status, created_at, messages, session_config
      FROM dm_sessions
      ORDER BY id DESC
      LIMIT 1
    `);

    if (!session) {
      return res.json({ message: 'No sessions found' });
    }

    const messages = JSON.parse(session.messages || '[]');
    const config = JSON.parse(session.session_config || '{}');

    res.json({
      id: session.id,
      title: session.title,
      model: session.model,
      status: session.status,
      created_at: session.created_at,
      openingNarrative: messages.find(m => m.role === 'assistant')?.content || null,
      systemPromptPreview: messages.find(m => m.role === 'system')?.content?.substring(0, 500) + '...',
      configSummary: {
        campaignModule: config.campaignModule?.name || 'Custom',
        startingLocation: config.startingLocation?.name || 'Unknown',
        era: config.era?.id || 'default',
        campaignLength: config.campaignLength
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get active session for a character (including paused and completed but unclaimed)
router.get('/active/:characterId', async (req, res) => {
  try {
    // Check for active or paused session first
    let session = await dbGet(`
      SELECT * FROM dm_sessions
      WHERE character_id = ? AND (status = 'active' OR status = 'paused')
      ORDER BY created_at DESC LIMIT 1
    `, [req.params.characterId]);

    // If no active/paused, check for completed but unclaimed
    if (!session) {
      session = await dbGet(`
        SELECT * FROM dm_sessions
        WHERE character_id = ? AND status = 'completed' AND rewards_claimed = 0
        ORDER BY created_at DESC LIMIT 1
      `, [req.params.characterId]);
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
router.get('/history/:characterId', async (req, res) => {
  try {
    const sessions = await dbAll(`
      SELECT id, title, setting, tone, status, summary, rewards, hp_change,
             new_location, new_quest, start_time, end_time, created_at
      FROM dm_sessions
      WHERE character_id = ? AND (status = 'completed' AND rewards_claimed = 1)
      ORDER BY created_at DESC
      LIMIT 20
    `, [req.params.characterId]);

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
router.get('/campaign-context/:characterId', async (req, res) => {
  try {
    // Get the character's persistent campaign config and campaign_id
    const character = await dbGet(`
      SELECT campaign_config, campaign_id FROM characters WHERE id = ?
    `, [req.params.characterId]);

    // Check if character has a campaign plan
    let campaignPlanInfo = null;
    if (character?.campaign_id) {
      const campaign = await dbGet(
        'SELECT id, name, description, campaign_plan, starting_location FROM campaigns WHERE id = ?',
        [character.campaign_id]
      );
      if (campaign) {
        campaignPlanInfo = {
          campaignId: campaign.id,
          campaignName: campaign.name,
          campaignDescription: campaign.description,
          startingLocation: campaign.starting_location || null
        };
        if (campaign.campaign_plan) {
          try {
            const plan = JSON.parse(campaign.campaign_plan);
            campaignPlanInfo.questTitle = plan.main_quest?.title;
            campaignPlanInfo.themes = plan.themes || [];
          } catch (e) { /* invalid JSON, ignore */ }
        }
      }
    }

    let campaignConfig = {};
    try {
      campaignConfig = JSON.parse(character?.campaign_config || '{}');
    } catch (e) {
      campaignConfig = {};
    }

    // Get the most recent completed session with its full config
    const lastSession = await dbGet(`
      SELECT id, title, setting, tone, summary, session_config,
             game_end_day, game_end_year, end_time
      FROM dm_sessions
      WHERE character_id = ? AND status = 'completed' AND rewards_claimed = 1
      ORDER BY created_at DESC
      LIMIT 1
    `, [req.params.characterId]);

    if (!lastSession) {
      // Return campaign config even without previous sessions
      return res.json({
        hasPreviousSessions: false,
        campaignConfig,
        campaignPlan: campaignPlanInfo
      });
    }

    // Get recent session summaries for story context (last 5 sessions)
    const recentSessions = await dbAll(`
      SELECT id, title, summary, game_start_day, game_start_year,
             game_end_day, game_end_year, end_time
      FROM dm_sessions
      WHERE character_id = ? AND status = 'completed' AND rewards_claimed = 1
      ORDER BY created_at DESC
      LIMIT 5
    `, [req.params.characterId]);

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
        customConcepts: sessionConfig.customConcepts,
        campaignModule: sessionConfig.campaignModule
      },
      // Character's persistent campaign config (takes priority over session config)
      campaignConfig,
      campaignPlan: campaignPlanInfo,
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
router.get('/:sessionId', async (req, res) => {
  try {
    const session = await dbGet('SELECT * FROM dm_sessions WHERE id = ?', [req.params.sessionId]);
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
      campaignLength,
      customNpcs,
      model,
      providerPreference,  // 'auto' | 'claude' | 'ollama'
      continueCampaign,  // If true, pull config from last session
      previousSessionSummaries  // Array of summaries to include in context
    } = req.body;

    // Check for existing active or paused DM session
    const existingSession = await dbGet(`
      SELECT id FROM dm_sessions
      WHERE character_id = ? AND (status = 'active' OR status = 'paused')
    `, [characterId]);

    if (existingSession) {
      return res.status(400).json({
        error: 'Character already has an active or paused DM session',
        sessionId: existingSession.id
      });
    }

    // Check for unclaimed DM session
    const unclaimedSession = await dbGet(`
      SELECT id FROM dm_sessions
      WHERE character_id = ? AND status = 'completed' AND rewards_claimed = 0
    `, [characterId]);

    if (unclaimedSession) {
      return res.status(400).json({
        error: 'Character has unclaimed rewards from a previous session',
        sessionId: unclaimedSession.id
      });
    }

    // Check for active time-based adventure
    const activeAdventure = await dbGet(`
      SELECT id FROM adventures
      WHERE character_id = ? AND (status = 'active' OR status = 'completed')
    `, [characterId]);

    if (activeAdventure) {
      return res.status(400).json({
        error: 'Character is currently on a time-based adventure. Complete or cancel it first.',
        adventureId: activeAdventure.id
      });
    }

    // Get character data
    const character = await dbGet('SELECT * FROM characters WHERE id = ?', [characterId]);
    if (!character) {
      return res.status(404).json({ error: 'Character not found' });
    }

    // Get active companions for this character
    const companions = await dbAll(`
      SELECT c.*, c.inventory as companion_inventory, c.gold_gp, c.gold_sp, c.gold_cp, c.equipment,
             c.alignment, c.faith, c.lifestyle, c.ideals, c.bonds, c.flaws,
             c.armor_class, c.speed as companion_speed, c.subrace as companion_subrace, c.background as companion_background,
             n.name, n.nickname, n.race, n.gender, n.age, n.occupation,
             n.stat_block, n.cr, n.ac, n.hp, n.speed, n.ability_scores as npc_ability_scores,
             n.avatar, n.personality_trait_1, n.personality_trait_2, n.voice, n.mannerism,
             n.motivation, n.background_notes, n.relationship_to_party
      FROM companions c
      JOIN npcs n ON c.npc_id = n.id
      WHERE c.recruited_by_character_id = ? AND c.status = 'active'
    `, [characterId]);

    // Get second character if specified
    let secondCharacter = null;
    if (secondCharacterId) {
      secondCharacter = await dbGet('SELECT * FROM characters WHERE id = ?', [secondCharacterId]);

      // Check if second character has any blocking sessions
      const secondCharActive = await dbGet(`
        SELECT id FROM dm_sessions
        WHERE character_id = ? AND status = 'active'
      `, [secondCharacterId]);

      if (secondCharActive) {
        return res.status(400).json({
          error: 'Second character already has an active DM session'
        });
      }

      const secondCharAdventure = await dbGet(`
        SELECT id FROM adventures
        WHERE character_id = ? AND (status = 'active' OR status = 'completed')
      `, [secondCharacterId]);

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
        const recentSessions = await dbAll(`
          SELECT messages FROM dm_sessions
          WHERE character_id = ? AND status = 'completed'
          ORDER BY created_at DESC LIMIT 5
        `, [characterId]);

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

    // Get active story threads to include in session context
    let storyThreadsContext = '';
    try {
      storyThreadsContext = await formatThreadsForAI(characterId, 5) || '';
    } catch (e) {
      console.error('Error fetching story threads:', e);
    }

    // Get narrative queue items (quest progress, companion reactions, etc.)
    let narrativeQueueContext = null;
    let narrativeQueueItemIds = [];
    try {
      const narrativeContext = await getNarrativeContextForSession(characterId);
      if (narrativeContext && narrativeContext.formattedContext) {
        narrativeQueueContext = narrativeContext.formattedContext;
        narrativeQueueItemIds = narrativeContext.narrativeQueueItems.map(item => item.id);
      }
    } catch (e) {
      console.error('Error fetching narrative queue:', e);
    }

    // Get campaign plan summary if character has a campaign
    let campaignPlanSummary = null;
    if (character.campaign_id) {
      try {
        campaignPlanSummary = await getPlanSummaryForSession(character.campaign_id);
      } catch (e) {
        console.error('Error fetching campaign plan:', e);
      }
    }

    // Gather living world state for DM context (all queries in parallel)
    let worldState = null;
    if (character.campaign_id) {
      try {
        const [characterWorldView, npcRelationships, discoveredLocations, activeFactions, visibleEvents] = await Promise.all([
          getCharacterWorldView(characterId),
          getCharacterRelationshipsWithNpcs(characterId),
          getDiscoveredLocations(character.campaign_id),
          getActiveFactions(character.campaign_id),
          getEventsVisibleToCharacter(characterId)
        ]);

        worldState = {
          factionStandings: characterWorldView?.faction_standings || [],
          knownFactionGoals: characterWorldView?.known_faction_goals || [],
          visibleEvents: visibleEvents || [],
          npcRelationships: npcRelationships || [],
          discoveredLocations: discoveredLocations || [],
          activeFactions: activeFactions || []
        };
      } catch (e) {
        console.error('Error gathering world state for session:', e);
      }
    }

    // Build session config with campaign module or custom Forgotten Realms context
    const sessionConfig = {
      campaignModule,
      startingLocation,
      era,
      arrivalHook,
      customConcepts,
      campaignLength,
      customNpcs,
      companions,
      pendingDowntimeNarratives: pendingNarratives,
      continueCampaign: continueCampaign || false,
      previousSessionSummaries: previousSessionSummaries || [],
      campaignNotes: character.campaign_notes || '',
      characterMemories: character.character_memories || '',
      usedNames,
      storyThreadsContext,
      narrativeQueueContext,
      narrativeQueueItemIds,
      worldState,
      campaignPlanSummary
    };

    // Check which LLM provider is available (respects user preference)
    const { provider, status: llmStatus } = await getLLMProvider(providerPreference);
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

      // Use Opus for first campaign sessions (establishing the narrative arc)
      // Use Sonnet for continuing sessions (regular gameplay)
      const modelChoice = isContinuing ? 'sonnet' : 'opus';

      const claudeResult = await claude.startSession(systemPrompt, openingPrompt, modelChoice);
      result = {
        systemPrompt,
        openingNarrative: claudeResult.response,
        model: claudeResult.model,
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
    // For first-ever sessions, pick a narrative-appropriate starting day based on campaign description
    const priorSessions = await dbGet('SELECT COUNT(*) as count FROM dm_sessions WHERE character_id = ?', [characterId]);
    const isFirstSession = !priorSessions || priorSessions.count === 0;
    let gameStartDay;
    if (isFirstSession || !character.game_day) {
      // Pick season-appropriate start day based on campaign description keywords
      let campaignDesc = '';
      let campLocationName = '';
      if (character.campaign_id) {
        const camp = await dbGet('SELECT description, starting_location FROM campaigns WHERE id = ?', [character.campaign_id]);
        campaignDesc = camp?.description || '';
        campLocationName = camp?.starting_location || '';
      }
      gameStartDay = pickSeasonalStartDay(campaignDesc, campLocationName);
    } else {
      gameStartDay = character.game_day;
    }
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

    const info = await dbRun(`
      INSERT INTO dm_sessions (character_id, second_character_id, title, setting, tone, model, status, messages, start_time, session_config, game_start_day, game_start_year)
      VALUES (?, ?, ?, ?, ?, ?, 'active', ?, datetime('now'), ?, ?, ?)
    `, [
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
    ]);

    // Clear pending downtime narratives now that they've been included in the session
    if (pendingNarratives.length > 0) {
      await dbRun(`
        UPDATE characters
        SET pending_downtime_narratives = '[]'
        WHERE id = ?
      `, [characterId]);
    }

    // Save campaign-level settings to character's campaign_config for persistence
    // This ensures custom concepts, selected NPCs, and other settings persist across sessions
    const campaignConfigToSave = {
      customConcepts: customConcepts || '',
      selectedNpcIds: (customNpcs || []).map(npc => npc.id),
      campaignModule: campaignModule?.id || 'custom',
      startingLocation: startingLocation?.id || '',
      era: era?.id || '',
      arrivalHook: arrivalHook || null,  // Store the full hook object { id, name, description }
      campaignLength: campaignLength || 'ongoing-saga'
    };

    await dbRun(`
      UPDATE characters
      SET campaign_config = ?
      WHERE id = ?
    `, [JSON.stringify(campaignConfigToSave), characterId]);

    const sessionId = Number(info.lastInsertRowid);

    // Mark narrative queue items as delivered now that they're included in session context
    if (narrativeQueueItemIds && narrativeQueueItemIds.length > 0) {
      try {
        await markNarrativeItemsDelivered(narrativeQueueItemIds, sessionId);
      } catch (e) {
        console.error('Error marking narrative items delivered:', e);
      }
    }

    // Emit DM session started event
    try {
      await onDMSessionStarted({ id: sessionId, title }, character);
    } catch (e) {
      console.error('Error emitting session started event:', e);
    }

    res.json({
      sessionId,
      title,
      openingNarrative: result.openingNarrative,
      startingLocation,
      era,
      gameDate,
      narrativeItemsIncluded: narrativeQueueItemIds?.length || 0
    });
  } catch (error) {
    console.error('Error starting DM session:', error);
    res.status(500).json({ error: error.message });
  }
});

// Detection helpers imported from dmSessionService.js

// Send a message/action in the session
router.post('/:sessionId/message', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { action, providerPreference } = req.body;

    if (!action || !action.trim()) {
      return res.status(400).json({ error: 'Action is required' });
    }

    // Get the session
    const session = await dbGet('SELECT * FROM dm_sessions WHERE id = ?', [sessionId]);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (session.status !== 'active') {
      return res.status(400).json({ error: 'Session is not active' });
    }

    const messages = JSON.parse(session.messages || '[]');

    // Check which LLM provider is available (respects user preference)
    const { provider } = await getLLMProvider(providerPreference);
    if (!provider) {
      return res.status(503).json({ error: 'No LLM provider available' });
    }

    let result;
    if (provider === 'claude') {
      // Use Claude - extract system prompt from messages
      // Always use Sonnet for ongoing session actions (cost-effective for gameplay)
      const systemMessage = messages.find(m => m.role === 'system');
      const systemPrompt = systemMessage?.content || '';
      const claudeResult = await claude.continueSession(systemPrompt, messages, action, 'sonnet');
      result = {
        narrative: claudeResult.response,
        messages: claudeResult.messages
      };
    } else {
      // Use Ollama
      result = await ollama.continueSession(messages, action, session.model);
    }

    // Update the session in the database
    await dbRun('UPDATE dm_sessions SET messages = ? WHERE id = ?', [JSON.stringify(result.messages), sessionId]);

    // Check for downtime activity in the player action
    const downtimeDetected = detectDowntime(action);

    // Check for recruitment in the response
    const recruitment = detectRecruitment(result.narrative, action);

    // If recruitment detected, try to find or create the NPC in the database
    let recruitmentData = null;
    if (recruitment) {
      // Look for an NPC with this name who is available as a companion
      let npc = await dbGet(`
        SELECT id, name, nickname, race, gender, occupation, avatar
        FROM npcs
        WHERE (name LIKE ? OR nickname LIKE ?)
        AND campaign_availability IN ('available', 'companion')
        ORDER BY
          CASE WHEN name = ? THEN 1 WHEN nickname = ? THEN 2 ELSE 3 END
        LIMIT 1
      `, [`%${recruitment.npcName}%`, `%${recruitment.npcName}%`, recruitment.npcName, recruitment.npcName]);

      // If NPC not found but we have structured data from the marker, create them
      if (!npc && recruitment.npcData) {
        const npcData = recruitment.npcData;
        // Parse personality traits
        let personality1 = null;
        let personality2 = null;
        if (npcData.personality) {
          const traits = npcData.personality.split(',').map(t => t.trim());
          personality1 = traits[0] || null;
          personality2 = traits[1] || null;
        }

        // Create the NPC in the database
        const insertResult = await dbRun(`
          INSERT INTO npcs (
            name, race, gender, occupation,
            personality_trait_1, personality_trait_2,
            relationship_to_party, campaign_availability,
            background_notes
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          npcData.name,
          npcData.race || 'Human',
          npcData.gender || null,
          npcData.occupation || null,
          personality1,
          personality2,
          'ally',
          'companion',
          npcData.reason ? `Reason for joining: ${npcData.reason}. First encountered in session #${sessionId}.` : `First encountered in session #${sessionId}`
        ]);

        // Fetch the newly created NPC
        npc = await dbGet('SELECT id, name, nickname, race, gender, occupation, avatar FROM npcs WHERE id = ?', [insertResult.lastInsertRowid]);
      }

      if (npc) {
        // Check if already a companion for this character
        const existingCompanion = await dbGet(`
          SELECT id FROM companions
          WHERE npc_id = ? AND recruited_by_character_id = ? AND status = 'active'
        `, [npc.id, session.character_id]);

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
            characterId: session.character_id,
            wasCreated: !!(recruitment.npcData) // Flag if this was a newly created NPC
          };
        }
      } else {
        // NPC not in database and no structured data - offer to create them manually
        recruitmentData = {
          detected: true,
          npcName: recruitment.npcName,
          npcNotFound: true,
          sessionId: parseInt(sessionId),
          characterId: session.character_id
        };
      }
    }

    // Check for merchant shop in the response
    const merchantShop = detectMerchantShop(result.narrative);
    if (merchantShop) {
      console.log(`🏪 MERCHANT_SHOP detected: "${merchantShop.merchantName}" (${merchantShop.merchantType}) at ${merchantShop.location}`);
    }

    // Strip all system markers from displayed narrative
    let cleanNarrative = result.narrative;
    cleanNarrative = cleanNarrative.replace(/\[MERCHANT_SHOP:[^\]]+\]\s*/gi, '').trim();
    cleanNarrative = cleanNarrative.replace(/\[MERCHANT_REFER:[^\]]+\]\s*/gi, '').trim();
    cleanNarrative = cleanNarrative.replace(/\[ADD_ITEM:[^\]]+\]\s*/gi, '').trim();
    cleanNarrative = cleanNarrative.replace(/\[LOOT_DROP:[^\]]+\]\s*/gi, '').trim();
    cleanNarrative = cleanNarrative.replace(/\[COMBAT_START:[^\]]+\]\s*/gi, '').trim();
    cleanNarrative = cleanNarrative.replace(/\[COMBAT_END\]\s*/gi, '').trim();

    // Handle ADD_ITEM markers — add custom items to current merchant's inventory
    const addItems = detectAddItem(result.narrative);
    let currentMerchantId = null;
    if (addItems.length > 0 || merchantShop) {
      try {
        const character = await dbGet('SELECT campaign_id, level FROM characters WHERE id = ?', [session.character_id]);
        if (character?.campaign_id) {
          // Find the current merchant (from MERCHANT_SHOP marker or most recent context)
          const merchantName = merchantShop?.merchantName;
          if (merchantName) {
            let dbMerchant = await getMerchantInventory(character.campaign_id, merchantName);
            if (!dbMerchant) {
              dbMerchant = await createMerchantOnTheFly(
                character.campaign_id, merchantName,
                merchantShop.merchantType, merchantShop.location, character.level || 1
              );
            }
            currentMerchantId = dbMerchant.id;

            // Process ADD_ITEM markers for this merchant
            for (const item of addItems) {
              try {
                await addItemToMerchant(dbMerchant.id, item);
              } catch (e) {
                console.error('Error adding item to merchant:', e);
              }
            }

            // Re-fetch inventory after any additions
            if (addItems.length > 0) {
              dbMerchant = await getMerchantInventory(character.campaign_id, merchantName);
            }

            // Inject actual inventory into conversation so AI knows what items are available
            const itemList = dbMerchant.inventory
              .map(i => {
                let line = `- ${i.name} (${i.price_gp}gp${i.quantity > 1 ? `, qty: ${i.quantity}` : ''}${i.quality ? ` [${i.quality}]` : ''})`;
                if (i.cursed && i.true_name) {
                  line += ` [CURSED: actually ${i.true_name} — ${i.curse_description}]`;
                }
                return line;
              })
              .join('\n');
            const hasCursedItems = dbMerchant.inventory.some(i => i.cursed);
            const cursedInstructions = hasCursedItems
              ? '\nCURSED ITEMS: Items marked [CURSED] APPEAR to the player as the normal item listed. Do NOT reveal the curse — describe it convincingly as the item it appears to be. The curse reveals itself only when used or identified with Identify/Detect Magic. If the player casts Identify, THEN reveal the true nature.'
              : '';
            const inventoryContext = `[SYSTEM: ${merchantName}'s actual inventory — ONLY reference these items when the player asks what's available:\n${itemList}\nMerchant gold: ${dbMerchant.gold_gp}gp. Do NOT invent items not on this list. The shop UI shows this inventory to the player. If an item isn't here, suggest an alternative or refer to another merchant with [MERCHANT_REFER]. You can add fitting custom items with [ADD_ITEM].${cursedInstructions}]`;
            result.messages.push({ role: 'user', content: inventoryContext });
            await dbRun('UPDATE dm_sessions SET messages = ? WHERE id = ?', [JSON.stringify(result.messages), sessionId]);
          }
        }
      } catch (e) {
        console.error('Error processing merchant markers:', e);
      }
    }

    // Handle MERCHANT_REFER — ensure the referenced item exists at the other merchant
    const merchantRefer = detectMerchantRefer(result.narrative);
    if (merchantRefer) {
      try {
        const character = await dbGet('SELECT campaign_id FROM characters WHERE id = ?', [session.character_id]);
        if (character?.campaign_id) {
          await ensureItemAtMerchant(character.campaign_id, merchantRefer.toMerchant, merchantRefer.item);
        }
      } catch (e) {
        console.error('Error ensuring item at referred merchant:', e);
      }
    }

    // Handle LOOT_DROP markers — validate items and add to character inventory
    const lootDrops = detectLootDrop(result.narrative);
    let lootDropResults = [];
    if (lootDrops.length > 0) {
      try {
        const character = await dbGet('SELECT id, level, inventory FROM characters WHERE id = ?', [session.character_id]);
        if (character) {
          let inventory = JSON.parse(character.inventory || '[]');

          for (const drop of lootDrops) {
            // Try to find the item in our loot tables
            const knownItem = lookupItemByName(drop.item);
            const lootTable = getLootTableForLevel(character.level);
            const isInLootTable = lootTable.includes(drop.item);

            // Accept the item if it's known in our system OR in the level-appropriate loot table
            const itemName = knownItem ? knownItem.name : drop.item;

            // Add to character inventory
            const existing = inventory.find(i => i.name.toLowerCase() === itemName.toLowerCase());
            if (existing) {
              existing.quantity = (existing.quantity || 1) + 1;
            } else {
              inventory.push({ name: itemName, quantity: 1 });
            }

            lootDropResults.push({
              item: itemName,
              source: drop.source,
              known: !!knownItem || isInLootTable
            });
          }

          // Save updated inventory
          await dbRun('UPDATE characters SET inventory = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [JSON.stringify(inventory), character.id]);

          // Inject system context so AI knows the item was added
          const itemNames = lootDropResults.map(d => d.item).join(', ');
          result.messages.push({
            role: 'user',
            content: `[SYSTEM NOTE - DO NOT RESPOND TO THIS]: The following items have been added to the player's inventory: ${itemNames}. The player's character sheet now reflects these items.`
          });
          await dbRun('UPDATE dm_sessions SET messages = ? WHERE id = ?', [JSON.stringify(result.messages), sessionId]);
        }
      } catch (e) {
        console.error('Error processing loot drops:', e);
      }
    }

    // Handle COMBAT_START marker — roll initiative for all combatants
    const combatStartData = detectCombatStart(result.narrative);
    let combatStart = null;
    if (combatStartData.detected) {
      try {
        const character = await dbGet('SELECT id, name, nickname, ability_scores FROM characters WHERE id = ?', [session.character_id]);
        const charAbilities = typeof character.ability_scores === 'string'
          ? JSON.parse(character.ability_scores || '{}')
          : (character.ability_scores || {});
        const playerDexMod = Math.floor(((charAbilities.dexterity || 10) - 10) / 2);

        const rollD20 = () => Math.floor(Math.random() * 20) + 1;
        const turnOrder = [];

        // Player initiative
        const playerRoll = rollD20();
        turnOrder.push({
          name: character.nickname || character.name || 'Player',
          type: 'player',
          roll: playerRoll,
          modifier: playerDexMod,
          initiative: playerRoll + playerDexMod
        });

        // Companion initiatives
        const activeCompanions = await dbAll(
          'SELECT name, companion_ability_scores FROM companions WHERE character_id = ? AND is_active = 1',
          [session.character_id]
        );
        for (const comp of activeCompanions) {
          const compAbilities = typeof comp.companion_ability_scores === 'string'
            ? JSON.parse(comp.companion_ability_scores || '{}')
            : (comp.companion_ability_scores || {});
          const compDexMod = Math.floor(((compAbilities.dexterity || 10) - 10) / 2);
          const compRoll = rollD20();
          turnOrder.push({
            name: comp.name,
            type: 'companion',
            roll: compRoll,
            modifier: compDexMod,
            initiative: compRoll + compDexMod
          });
        }

        // Enemy initiatives
        for (const enemy of combatStartData.enemies) {
          const enemyDexMod = estimateEnemyDexMod(enemy);
          const enemyRoll = rollD20();
          turnOrder.push({
            name: enemy,
            type: 'enemy',
            roll: enemyRoll,
            modifier: enemyDexMod,
            initiative: enemyRoll + enemyDexMod
          });
        }

        // Sort by initiative descending, break ties by modifier, then random
        turnOrder.sort((a, b) => {
          if (b.initiative !== a.initiative) return b.initiative - a.initiative;
          if (b.modifier !== a.modifier) return b.modifier - a.modifier;
          return Math.random() - 0.5;
        });

        combatStart = { turnOrder, currentTurn: 0, round: 1 };

        // Inject initiative results into conversation so AI uses the turn order
        const orderStr = turnOrder.map(c => `${c.name} (${c.initiative})`).join(', ');
        result.messages.push({
          role: 'user',
          content: `[SYSTEM NOTE - DO NOT RESPOND TO THIS]: Initiative has been rolled. Turn order: ${orderStr}. Use this order for all combat turns. The first combatant to act is ${turnOrder[0].name}.`
        });
        await dbRun('UPDATE dm_sessions SET messages = ? WHERE id = ?', [JSON.stringify(result.messages), sessionId]);
      } catch (e) {
        console.error('Error rolling initiative:', e);
      }
    }

    // Handle COMBAT_END marker
    const combatEnd = detectCombatEnd(result.narrative);

    res.json({
      narrative: cleanNarrative,
      messageCount: result.messages.length,
      recruitment: recruitmentData,
      downtime: downtimeDetected,
      merchantShop: merchantShop,
      lootDrops: lootDropResults.length > 0 ? lootDropResults : undefined,
      combatStart: combatStart || undefined,
      combatEnd: combatEnd || undefined
    });
  } catch (error) {
    console.error('Error in DM session message:', error);
    res.status(500).json({ error: error.message });
  }
});

// Item rarity lookup — returns rarity/category for a list of item names
router.post('/item-rarity-lookup', async (req, res) => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items)) return res.status(400).json({ error: 'items must be an array' });

    const results = {};
    for (const name of items) {
      const found = lookupItemByName(name);
      if (found) {
        results[name.toLowerCase()] = {
          rarity: found.rarity || 'common',
          category: found.category || 'misc'
        };
      }
    }
    res.json({ items: results });
  } catch (error) {
    console.error('Error in item rarity lookup:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get merchant inventory (DB lookup from persistent loot-table-generated stock)
router.post('/:sessionId/generate-merchant-inventory', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { merchantName, merchantType, location, playerItems } = req.body;

    const session = await dbGet('SELECT * FROM dm_sessions WHERE id = ?', [sessionId]);
    if (!session) return res.status(404).json({ error: 'Session not found' });

    const character = await dbGet('SELECT campaign_id FROM characters WHERE id = ?', [session.character_id]);
    if (!character?.campaign_id) {
      return res.status(404).json({ error: 'No campaign found for this character' });
    }

    let dbMerchant = await getMerchantInventory(character.campaign_id, merchantName);

    // Auto-create merchant if not in DB (ad-hoc merchant discovered during gameplay)
    if (!dbMerchant) {
      const charData = await dbGet('SELECT level FROM characters WHERE id = ?', [session.character_id]);
      dbMerchant = await createMerchantOnTheFly(
        character.campaign_id,
        merchantName,
        merchantType || 'general',
        location || null,
        charData?.level || 1
      );
    }

    const buybackItems = generateBuybackPrices(playerItems || []);

    res.json({
      inventory: dbMerchant.inventory,
      buybackItems,
      merchantName: dbMerchant.merchant_name,
      merchantType: dbMerchant.merchant_type,
      merchantId: dbMerchant.id,
      personality: dbMerchant.personality,
      merchantGold: dbMerchant.gold_gp
    });
  } catch (error) {
    console.error('Error loading merchant inventory:', error);
    res.status(500).json({ error: error.message });
  }
});

// List all merchants for the session's campaign
router.get('/:sessionId/merchants', async (req, res) => {
  try {
    const session = await dbGet('SELECT character_id FROM dm_sessions WHERE id = ?', [req.params.sessionId]);
    if (!session) return res.status(404).json({ error: 'Session not found' });

    const character = await dbGet('SELECT campaign_id FROM characters WHERE id = ?', [session.character_id]);
    if (!character?.campaign_id) return res.json({ merchants: [] });

    const merchants = await getMerchantsByCampaign(character.campaign_id);
    res.json({ merchants });
  } catch (error) {
    console.error('Error listing merchants:', error);
    res.status(500).json({ error: error.message });
  }
});

// Restock a merchant's inventory from loot tables
router.post('/:sessionId/restock-merchant', async (req, res) => {
  try {
    const { merchantId } = req.body;
    const session = await dbGet('SELECT character_id FROM dm_sessions WHERE id = ?', [req.params.sessionId]);
    if (!session) return res.status(404).json({ error: 'Session not found' });

    const character = await dbGet('SELECT level FROM characters WHERE id = ?', [session.character_id]);
    const result = await restockMerchant(merchantId, character?.level || 1);
    res.json({ success: true, inventory: result.inventory, gold_gp: result.gold_gp });
  } catch (error) {
    console.error('Error restocking merchant:', error);
    res.status(500).json({ error: error.message });
  }
});

// Process merchant transaction
router.post('/:sessionId/merchant-transaction', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { merchantName, merchantId, bought, sold } = req.body;

    const session = await dbGet('SELECT * FROM dm_sessions WHERE id = ?', [sessionId]);
    if (!session) return res.status(404).json({ error: 'Session not found' });

    const character = await dbGet('SELECT * FROM characters WHERE id = ?', [session.character_id]);
    if (!character) return res.status(404).json({ error: 'Character not found' });

    let inventory = JSON.parse(character.inventory || '[]');
    const changes = [];

    // Calculate totals in copper
    let totalSpentCp = 0;
    let totalEarnedCp = 0;

    // Process bought items
    for (const item of (bought || [])) {
      const costCp = ((item.price_gp || 0) * 100 + (item.price_sp || 0) * 10 + (item.price_cp || 0)) * item.quantity;
      totalSpentCp += costCp;

      const existing = inventory.find(i => i.name.toLowerCase() === item.name.toLowerCase());
      if (existing) {
        existing.quantity = (existing.quantity || 1) + item.quantity;
      } else {
        inventory.push({ name: item.name, quantity: item.quantity });
      }
      changes.push(`Bought ${item.quantity}x ${item.name}`);
    }

    // Process sold items
    for (const item of (sold || [])) {
      const earnCp = ((item.price_gp || 0) * 100 + (item.price_sp || 0) * 10 + (item.price_cp || 0)) * item.quantity;
      totalEarnedCp += earnCp;

      const idx = inventory.findIndex(i => i.name.toLowerCase() === item.name.toLowerCase());
      if (idx !== -1) {
        const invItem = inventory[idx];
        if (invItem.quantity && invItem.quantity > item.quantity) {
          invItem.quantity -= item.quantity;
        } else {
          inventory.splice(idx, 1);
        }
      }
      changes.push(`Sold ${item.quantity}x ${item.name}`);
    }

    // Calculate net gold change
    let playerCp = (character.gold_gp || 0) * 100 + (character.gold_sp || 0) * 10 + (character.gold_cp || 0);
    const netCostCp = totalSpentCp - totalEarnedCp;

    if (netCostCp > playerCp) {
      return res.status(400).json({ error: 'Not enough gold for this transaction' });
    }

    playerCp -= netCostCp;
    const newGp = Math.floor(playerCp / 100);
    const remainCp = playerCp % 100;
    const newSp = Math.floor(remainCp / 10);
    const newCp = remainCp % 10;

    // Update character
    await dbRun(`
      UPDATE characters
      SET inventory = ?, gold_gp = ?, gold_sp = ?, gold_cp = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [JSON.stringify(inventory), newGp, newSp, newCp, character.id]);

    // Reputation: look up merchant NPC and adjust disposition
    let reputationChange = null;
    try {
      const merchantNpc = await dbGet(
        'SELECT id, name FROM npcs WHERE name LIKE ? LIMIT 1',
        [`%${merchantName}%`]
      );
      if (merchantNpc) {
        const { adjustDisposition } = await import('../services/npcRelationshipService.js');
        const change = Math.min(10, Math.max(2, Math.floor(totalSpentCp / 1000) + 2));
        await adjustDisposition(session.character_id, merchantNpc.id, change, `Traded with ${merchantName}`);
        reputationChange = { npcName: merchantNpc.name, change };
      }
    } catch (repErr) {
      console.warn('Reputation update failed:', repErr.message);
    }

    // Update the merchant's persistent inventory
    if (merchantId) {
      try {
        const merchant = await dbGet('SELECT * FROM merchant_inventories WHERE id = ?', [merchantId]);
        if (merchant) {
          let merchInv = JSON.parse(merchant.inventory || '[]');

          // Remove bought items from merchant stock
          for (const item of (bought || [])) {
            const idx = merchInv.findIndex(i => i.name.toLowerCase() === item.name.toLowerCase());
            if (idx !== -1) {
              merchInv[idx].quantity = (merchInv[idx].quantity || 1) - item.quantity;
              if (merchInv[idx].quantity <= 0) merchInv.splice(idx, 1);
            }
          }

          // Add sold items to merchant stock (at full price for resale)
          for (const item of (sold || [])) {
            const existing = merchInv.find(i => i.name.toLowerCase() === item.name.toLowerCase());
            if (existing) {
              existing.quantity = (existing.quantity || 1) + item.quantity;
            } else {
              merchInv.push({
                name: item.name,
                price_gp: (item.price_gp || 0) * 2,
                price_sp: (item.price_sp || 0) * 2,
                price_cp: (item.price_cp || 0) * 2,
                category: 'misc',
                description: 'Acquired from adventurer',
                quantity: item.quantity,
                rarity: 'common'
              });
            }
          }

          // Update merchant gold (they pay for buybacks, receive from sales)
          const newMerchGold = (merchant.gold_gp || 0) - Math.floor(totalEarnedCp / 100) + Math.floor(totalSpentCp / 100);
          await updateMerchantAfterTransaction(merchantId, merchInv, newMerchGold);
        }
      } catch (merchErr) {
        console.warn('Merchant inventory update failed:', merchErr.message);
      }
    }

    res.json({
      success: true,
      changes,
      newInventory: inventory,
      newGold: { gp: newGp, sp: newSp, cp: newCp },
      totalSpent: { gp: Math.floor(totalSpentCp / 100), sp: Math.floor((totalSpentCp % 100) / 10), cp: totalSpentCp % 10 },
      totalEarned: { gp: Math.floor(totalEarnedCp / 100), sp: Math.floor((totalEarnedCp % 100) / 10), cp: totalEarnedCp % 10 },
      reputationChange
    });
  } catch (error) {
    console.error('Error processing merchant transaction:', error);
    res.status(500).json({ error: error.message });
  }
});

// Adjust the game date during a session
router.post('/:sessionId/adjust-date', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { daysToAdd } = req.body;

    if (typeof daysToAdd !== 'number') {
      return res.status(400).json({ error: 'daysToAdd must be a number' });
    }

    const session = await dbGet('SELECT * FROM dm_sessions WHERE id = ?', [sessionId]);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Get current game date from session
    const currentDay = session.game_start_day || 1;
    const currentYear = session.game_start_year || 1492;

    // Advance (or go back) the date
    const newDate = advanceTime(currentDay, currentYear, daysToAdd);

    // Update the session with new date
    await dbRun(`
      UPDATE dm_sessions
      SET game_start_day = ?, game_start_year = ?
      WHERE id = ?
    `, [newDate.day, newDate.year, sessionId]);

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

// Inject a system notification into the session (e.g., after manual downtime)
router.post('/:sessionId/inject-context', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'message is required' });
    }

    const session = await dbGet('SELECT messages FROM dm_sessions WHERE id = ?', [sessionId]);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const messages = JSON.parse(session.messages || '[]');
    // Inject as a user message with a [SYSTEM NOTE] prefix so the AI treats it as context
    messages.push({ role: 'user', content: `[SYSTEM NOTE - DO NOT RESPOND TO THIS, just incorporate it into your awareness]: ${message}` });

    await dbRun('UPDATE dm_sessions SET messages = ? WHERE id = ?', [JSON.stringify(messages), sessionId]);

    res.json({ success: true });
  } catch (error) {
    console.error('Error injecting context:', error);
    res.status(500).json({ error: error.message });
  }
});

// End a session - generates rewards based on session content
router.post('/:sessionId/end', async (req, res) => {
  try {
    const { sessionId } = req.params;

    // Get the session
    const session = await dbGet('SELECT * FROM dm_sessions WHERE id = ?', [sessionId]);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (session.status !== 'active') {
      return res.status(400).json({ error: 'Session is not active' });
    }

    const messages = JSON.parse(session.messages || '[]');
    const character = await dbGet('SELECT * FROM characters WHERE id = ?', [session.character_id]);

    // Count player actions (user messages after the initial opening prompt)
    const playerActionCount = messages.filter((m, i) => m.role === 'user' && i > 1).length;

    // If no player actions were taken, end session with no rewards
    if (playerActionCount === 0) {
      await dbRun(`
        UPDATE dm_sessions
        SET status = 'completed', summary = ?, rewards = ?, hp_change = ?,
            end_time = datetime('now')
        WHERE id = ?
      `, ['The adventure ended before it truly began.', JSON.stringify({ xp: 0, gold: { cp: 0, sp: 0, gp: 0 }, loot: null }), 0, sessionId]);

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

    const inventory = JSON.parse(character.inventory || '[]');
    const inventoryList = inventory.map(i => `${i.name}${i.quantity > 1 ? ` (x${i.quantity})` : ''}`).join(', ');

    try {
      const analysisPrompt = buildAnalysisPrompt(
        inventoryList,
        `${character.gold_gp || 0} gp, ${character.gold_sp || 0} sp, ${character.gold_cp || 0} cp`
      );

      const { provider } = await getLLMProvider();

      let analysisResponse;
      if (provider === 'claude') {
        const systemMessage = messages.find(m => m.role === 'system');
        const systemPrompt = systemMessage?.content || '';
        const analysisMessages = [
          ...messages.filter(m => m.role !== 'system'),
          { role: 'user', content: analysisPrompt }
        ];
        analysisResponse = await claude.chat(systemPrompt, analysisMessages);
      } else {
        const analysisMessages = [
          ...messages,
          { role: 'user', content: analysisPrompt }
        ];
        analysisResponse = await ollama.chat(analysisMessages, session.model);
      }

      ({ summary, rewardsAnalysis } = parseAnalysisResponse(analysisResponse));
    } catch (e) {
      console.error('Could not generate analysis:', e);
      summary = 'The adventure concluded.';
      rewardsAnalysis = { combat: 0, exploration: 0, quests: 0, discovery: 0, social: 0, danger: 0, inventoryChanges: null };
    }

    // Check if anything meaningful happened
    const totalActivity = rewardsAnalysis.combat + rewardsAnalysis.exploration +
                          rewardsAnalysis.quests + rewardsAnalysis.discovery + rewardsAnalysis.social;
    const meaningfulSession = totalActivity >= 2;

    const rewards = !meaningfulSession
      ? { xp: 0, gold: { cp: 0, sp: 0, gp: 0 }, loot: null, breakdown: null }
      : calculateSessionRewards(character, durationHours, rewardsAnalysis);

    const hpChange = calculateHPChange(character, rewardsAnalysis);
    const daysElapsed = calculateGameTimeAdvance(rewardsAnalysis);

    // Advance game date
    const currentGameDay = session.game_start_day || character.game_day || 1;
    const currentGameYear = session.game_start_year || character.game_year || 1492;
    const newGameDate = advanceTime(currentGameDay, currentGameYear, daysElapsed);

    await dbRun('UPDATE characters SET game_day = ?, game_year = ? WHERE id = ?',
      [newGameDate.day, newGameDate.year, session.character_id]);

    // Extract campaign notes
    let extractedNotes = '';
    try {
      const { provider } = await getLLMProvider();
      if (provider && playerActionCount > 0) {
        const extractionPrompt = buildNotesExtractionPrompt();
        let notesResponse;
        if (provider === 'claude') {
          const systemMessage = messages.find(m => m.role === 'system');
          const systemPrompt = systemMessage?.content || '';
          notesResponse = await claude.chat(systemPrompt, [
            ...messages.filter(m => m.role !== 'system'),
            { role: 'user', content: extractionPrompt }
          ]);
        } else {
          notesResponse = await ollama.chat([
            ...messages,
            { role: 'user', content: extractionPrompt }
          ], session.model);
        }

        extractedNotes = notesResponse.trim();

        if (extractedNotes && extractedNotes.length > 20) {
          await appendCampaignNotes(
            session.character_id, character.campaign_notes || '',
            extractedNotes, session.title, currentGameDay, currentGameYear
          );
        }
      }
    } catch (e) {
      console.error('Could not extract campaign notes:', e);
    }

    // Extract NPCs
    let extractedNpcs = [];
    try {
      const { provider } = await getLLMProvider();
      if (provider && playerActionCount > 0) {
        const npcExtractionPrompt = buildNpcExtractionPrompt();
        let npcResponse;
        if (provider === 'claude') {
          const systemMessage = messages.find(m => m.role === 'system');
          const systemPrompt = systemMessage?.content || '';
          npcResponse = await claude.chat(systemPrompt, [
            ...messages.filter(m => m.role !== 'system'),
            { role: 'user', content: npcExtractionPrompt }
          ]);
        } else {
          npcResponse = await ollama.chat([
            ...messages,
            { role: 'user', content: npcExtractionPrompt }
          ], session.model);
        }

        extractedNpcs = await saveExtractedNpcs(npcResponse, session.title);
      }
    } catch (e) {
      console.error('Could not extract NPCs:', e);
    }

    // Extract character personality memories
    try {
      const { provider: memProvider } = await getLLMProvider();
      if (memProvider && playerActionCount > 0) {
        const memoryPrompt = buildMemoryExtractionPrompt(character.character_memories || '');
        let memoryResponse;
        if (memProvider === 'claude') {
          const systemMessage = messages.find(m => m.role === 'system');
          const systemPrompt = systemMessage?.content || '';
          memoryResponse = await claude.chat(systemPrompt, [
            ...messages.filter(m => m.role !== 'system'),
            { role: 'user', content: memoryPrompt }
          ]);
        } else {
          memoryResponse = await ollama.chat([
            ...messages,
            { role: 'user', content: memoryPrompt }
          ], session.model);
        }

        const trimmedMemory = memoryResponse.trim();
        if (trimmedMemory && !trimmedMemory.includes('NO_NEW_MEMORIES') && trimmedMemory.length > 10) {
          await updateCharacterMemories(
            session.character_id,
            character.character_memories || '',
            trimmedMemory
          );
          console.log('📝 Character memories extracted and saved');
        }
      }
    } catch (e) {
      console.error('Could not extract character memories:', e);
    }

    // Track used NPC names
    try {
      await extractAndTrackUsedNames(messages, session.character_id);
    } catch (e) {
      console.error('Error extracting used names:', e);
    }

    // Emit gameplay events for quest/companion systems
    try {
      await emitSessionEvents(
        session.character_id, character.campaign_id,
        rewardsAnalysis, extractedNotes, extractedNpcs
      );
      await emitSessionEndedEvent(session, character, summary, messages);
    } catch (e) {
      console.error('Error emitting session events:', e);
    }

    // Update the session
    await dbRun(`
      UPDATE dm_sessions
      SET status = 'completed', summary = ?, rewards = ?, hp_change = ?,
          end_time = datetime('now'), game_end_day = ?, game_end_year = ?
      WHERE id = ?
    `, [summary, JSON.stringify(rewards), hpChange, newGameDate.day, newGameDate.year, sessionId]);

    res.json({
      success: true,
      summary,
      rewards,
      hpChange,
      analysis: rewardsAnalysis,
      daysElapsed,
      newGameDate: dayToDate(newGameDate.day, newGameDate.year),
      npcsExtracted: extractedNpcs.length > 0 ? extractedNpcs : undefined
    });
  } catch (error) {
    console.error('Error ending DM session:', error);
    res.status(500).json({ error: error.message });
  }
});

// Apply inventory changes from session wrap-up
router.post('/:sessionId/apply-inventory', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { consumed, gained, goldSpent } = req.body;

    const session = await dbGet('SELECT * FROM dm_sessions WHERE id = ?', [sessionId]);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const character = await dbGet('SELECT * FROM characters WHERE id = ?', [session.character_id]);
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
    await dbRun(`
      UPDATE characters
      SET inventory = ?, gold_gp = ?, gold_sp = ?, gold_cp = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [JSON.stringify(inventory), newGp, newSp, newCp, character.id]);

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

    const session = await dbGet('SELECT * FROM dm_sessions WHERE id = ?', [sessionId]);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (session.status !== 'paused') {
      return res.status(400).json({ error: 'Session is not paused' });
    }

    // Get character and check for pending downtime narratives
    const character = await dbGet('SELECT * FROM characters WHERE id = ?', [session.character_id]);
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
        await dbRun('UPDATE dm_sessions SET messages = ? WHERE id = ?', [JSON.stringify(messages), sessionId]);
      }
      // Clear the pending narratives
      await dbRun(`
        UPDATE characters
        SET pending_downtime_narratives = '[]'
        WHERE id = ?
      `, [character.id]);
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
          await dbRun('UPDATE dm_sessions SET recap = ? WHERE id = ?', [recap, sessionId]);
        }
      } catch (e) {
        console.error('Could not generate recap:', e);
        // Continue without recap
      }
    }

    // Update session status to active
    await dbRun(`
      UPDATE dm_sessions
      SET status = 'active'
      WHERE id = ?
    `, [sessionId]);

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
router.post('/:sessionId/pause', async (req, res) => {
  try {
    const { sessionId } = req.params;

    const session = await dbGet('SELECT * FROM dm_sessions WHERE id = ?', [sessionId]);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (session.status !== 'active') {
      return res.status(400).json({ error: 'Session is not active' });
    }

    // Update session status to paused
    await dbRun(`
      UPDATE dm_sessions
      SET status = 'paused'
      WHERE id = ?
    `, [sessionId]);

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
router.post('/:sessionId/abort', async (req, res) => {
  try {
    const { sessionId } = req.params;

    const session = await dbGet('SELECT * FROM dm_sessions WHERE id = ?', [sessionId]);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (session.status !== 'active' && session.status !== 'paused') {
      return res.status(400).json({ error: 'Session is not active or paused' });
    }

    // Delete the session entirely - no logging, no rewards
    await dbRun('DELETE FROM dm_sessions WHERE id = ?', [sessionId]);

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
router.post('/:sessionId/claim', async (req, res) => {
  try {
    const { sessionId } = req.params;

    const session = await dbGet('SELECT * FROM dm_sessions WHERE id = ?', [sessionId]);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (session.status !== 'completed') {
      return res.status(400).json({ error: 'Session is not completed' });
    }

    if (session.rewards_claimed) {
      return res.status(400).json({ error: 'Rewards already claimed' });
    }

    const character = await dbGet('SELECT * FROM characters WHERE id = ?', [session.character_id]);
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
    await dbRun(`
      UPDATE characters
      SET experience = ?, gold_cp = ?, gold_sp = ?, gold_gp = ?,
          current_hp = ?, inventory = ?, current_location = ?, current_quest = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      updates.experience,
      updates.gold_cp,
      updates.gold_sp,
      updates.gold_gp,
      updates.current_hp,
      JSON.stringify(inventory),
      newLocation,
      newQuest,
      session.character_id
    ]);

    // Award XP to active companions (full XP - party shares equally, not split)
    const companionXP = rewards.xp || 0;
    const companionXPResults = [];
    if (companionXP > 0) {
      const companions = await dbAll(`
        SELECT c.id, c.companion_level, c.companion_experience, c.companion_class, n.name
        FROM companions c
        JOIN npcs n ON c.npc_id = n.id
        WHERE c.recruited_by_character_id = ? AND c.status = 'active' AND c.progression_type = 'class_based'
      `, [session.character_id]);

      for (const companion of companions) {
        const oldXP = companion.companion_experience || 0;
        const newXP = oldXP + companionXP;
        const currentLevel = companion.companion_level;
        const nextLevelXP = currentLevel < 20 ? XP_THRESHOLDS[currentLevel + 1] : null;
        const canLevelUp = nextLevelXP !== null && newXP >= nextLevelXP;

        await dbRun(`
          UPDATE companions SET companion_experience = ? WHERE id = ?
        `, [newXP, companion.id]);

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
    await dbRun('UPDATE dm_sessions SET rewards_claimed = 1 WHERE id = ?', [sessionId]);

    const updatedCharacter = await dbGet('SELECT * FROM characters WHERE id = ?', [session.character_id]);

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
router.delete('/:sessionId', async (req, res) => {
  try {
    const result = await dbRun('DELETE FROM dm_sessions WHERE id = ?', [req.params.sessionId]);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Clear all session history for a character
router.delete('/character/:characterId/history', async (req, res) => {
  try {
    const { characterId } = req.params;

    // Only delete completed sessions (not active ones)
    const result = await dbRun(`
      DELETE FROM dm_sessions
      WHERE (character_id = ? OR second_character_id = ?)
      AND status = 'completed'
    `, [characterId, characterId]);

    res.json({
      success: true,
      deletedCount: result.changes
    });
  } catch (error) {
    console.error('Error clearing session history:', error);
    res.status(500).json({ error: error.message });
  }
});

// Extract NPCs from a past session (retroactive extraction)
router.post('/:sessionId/extract-npcs', async (req, res) => {
  try {
    const { sessionId } = req.params;

    const session = await dbGet('SELECT * FROM dm_sessions WHERE id = ?', [sessionId]);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const messages = JSON.parse(session.messages || '[]');
    if (messages.length < 3) {
      return res.json({ extracted: [], message: 'Session too short to extract NPCs' });
    }

    // Check which LLM provider is available
    const { provider } = await getLLMProvider();
    if (!provider) {
      return res.status(503).json({ error: 'No LLM provider available' });
    }

    const npcExtractionPrompt = `List ALL named NPCs (non-player characters) who appeared in this session. For each NPC, provide their details in this EXACT format, one per line:

NPC: Name="Full Name" Race="Race" Gender="Male/Female/Other" Occupation="Their role or job" Location="Where encountered" Relationship="ally/neutral/enemy/unknown" Description="One sentence physical or personality description"

Rules:
- Only include NPCs with actual names (not "the guard" or "a merchant")
- Include NPCs who were just mentioned or referenced, not just those who spoke
- Use "unknown" for any field you're not sure about
- Do not include the player characters
- Include ALL named characters, even minor ones

If no named NPCs appeared, respond with: NO_NPCS`;

    let npcResponse;
    if (provider === 'claude') {
      const systemMessage = messages.find(m => m.role === 'system');
      const systemPrompt = systemMessage?.content || '';
      const npcMessages = [
        ...messages.filter(m => m.role !== 'system'),
        { role: 'user', content: npcExtractionPrompt }
      ];
      npcResponse = await claude.chat(systemPrompt, npcMessages);
    } else {
      const npcMessages = [
        ...messages,
        { role: 'user', content: npcExtractionPrompt }
      ];
      npcResponse = await ollama.chat(npcMessages, session.model);
    }

    const extractedNpcs = [];

    // Parse the NPC response
    if (npcResponse && !npcResponse.includes('NO_NPCS')) {
      const npcLines = npcResponse.split('\n').filter(line => line.startsWith('NPC:'));

      for (const line of npcLines) {
        // Parse the structured format
        const parseField = (fieldName) => {
          const match = line.match(new RegExp(`${fieldName}="([^"]+)"`));
          return match ? match[1] : null;
        };

        const name = parseField('Name');
        if (!name || name.toLowerCase() === 'unknown') continue;

        const race = parseField('Race') || 'Human';
        const gender = parseField('Gender');
        const occupation = parseField('Occupation');
        const location = parseField('Location');
        const relationship = parseField('Relationship') || 'neutral';
        const description = parseField('Description');

        // Check if NPC already exists
        const existing = await dbGet('SELECT id FROM npcs WHERE name = ?', [name]);
        if (existing) {
          // Update location if we have new info
          if (location && location !== 'unknown') {
            await dbRun(
              'UPDATE npcs SET current_location = ? WHERE id = ? AND (current_location IS NULL OR current_location = "")',
              [location, existing.id]
            );
          }
          extractedNpcs.push({ id: existing.id, name, race, occupation, existed: true });
          continue;
        }

        // Create the NPC
        const result = await dbRun(`
          INSERT INTO npcs (
            name, race, gender, occupation, current_location,
            relationship_to_party, campaign_availability,
            distinguishing_marks, background_notes
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          name,
          race !== 'unknown' ? race : 'Human',
          gender !== 'unknown' ? gender : null,
          occupation !== 'unknown' ? occupation : null,
          location !== 'unknown' ? location : null,
          relationship !== 'unknown' ? relationship : 'neutral',
          'available',
          description !== 'unknown' ? description : null,
          `First encountered in session: ${session.title}`
        ]);

        extractedNpcs.push({ id: Number(result.lastInsertRowid), name, race, occupation, existed: false });
      }
    }

    res.json({
      success: true,
      extracted: extractedNpcs,
      newCount: extractedNpcs.filter(n => !n.existed).length,
      existingCount: extractedNpcs.filter(n => n.existed).length
    });
  } catch (error) {
    console.error('Error extracting NPCs from session:', error);
    res.status(500).json({ error: error.message });
  }
});

// Extract NPCs from ALL past sessions for a character
router.post('/character/:characterId/extract-all-npcs', async (req, res) => {
  try {
    const { characterId } = req.params;

    // Get all completed sessions for this character
    const sessions = await dbAll(`
      SELECT id, title FROM dm_sessions
      WHERE character_id = ? AND status = 'completed'
      ORDER BY created_at ASC
    `, [characterId]);

    if (sessions.length === 0) {
      return res.json({ success: true, message: 'No completed sessions found', totalExtracted: 0 });
    }

    const allExtracted = [];

    for (const session of sessions) {
      try {
        // Make internal call to extract NPCs
        const fullSession = await dbGet('SELECT * FROM dm_sessions WHERE id = ?', [session.id]);
        const messages = JSON.parse(fullSession.messages || '[]');

        if (messages.length < 3) continue;

        const { provider } = await getLLMProvider();
        if (!provider) continue;

        const npcExtractionPrompt = `List ALL named NPCs (non-player characters) who appeared in this session. For each NPC, provide their details in this EXACT format, one per line:

NPC: Name="Full Name" Race="Race" Gender="Male/Female/Other" Occupation="Their role or job" Location="Where encountered" Relationship="ally/neutral/enemy/unknown" Description="One sentence physical or personality description"

Rules:
- Only include NPCs with actual names (not "the guard" or "a merchant")
- Include NPCs who were just mentioned or referenced, not just those who spoke
- Use "unknown" for any field you're not sure about
- Do not include the player characters
- Include ALL named characters, even minor ones

If no named NPCs appeared, respond with: NO_NPCS`;

        let npcResponse;
        if (provider === 'claude') {
          const systemMessage = messages.find(m => m.role === 'system');
          const systemPrompt = systemMessage?.content || '';
          const npcMessages = [
            ...messages.filter(m => m.role !== 'system'),
            { role: 'user', content: npcExtractionPrompt }
          ];
          npcResponse = await claude.chat(systemPrompt, npcMessages);
        } else {
          const npcMessages = [
            ...messages,
            { role: 'user', content: npcExtractionPrompt }
          ];
          npcResponse = await ollama.chat(npcMessages, fullSession.model);
        }

        if (npcResponse && !npcResponse.includes('NO_NPCS')) {
          const npcLines = npcResponse.split('\n').filter(line => line.startsWith('NPC:'));

          for (const line of npcLines) {
            const parseField = (fieldName) => {
              const match = line.match(new RegExp(`${fieldName}="([^"]+)"`));
              return match ? match[1] : null;
            };

            const name = parseField('Name');
            if (!name || name.toLowerCase() === 'unknown') continue;

            const race = parseField('Race') || 'Human';
            const gender = parseField('Gender');
            const occupation = parseField('Occupation');
            const location = parseField('Location');
            const relationship = parseField('Relationship') || 'neutral';
            const description = parseField('Description');

            const existing = await dbGet('SELECT id FROM npcs WHERE name = ?', [name]);
            if (existing) {
              if (location && location !== 'unknown') {
                await dbRun(
                  'UPDATE npcs SET current_location = ? WHERE id = ? AND (current_location IS NULL OR current_location = "")',
                  [location, existing.id]
                );
              }
              continue; // Skip duplicates in the results
            }

            const result = await dbRun(`
              INSERT INTO npcs (
                name, race, gender, occupation, current_location,
                relationship_to_party, campaign_availability,
                distinguishing_marks, background_notes
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
              name,
              race !== 'unknown' ? race : 'Human',
              gender !== 'unknown' ? gender : null,
              occupation !== 'unknown' ? occupation : null,
              location !== 'unknown' ? location : null,
              relationship !== 'unknown' ? relationship : 'neutral',
              'available',
              description !== 'unknown' ? description : null,
              `First encountered in session: ${fullSession.title}`
            ]);

            allExtracted.push({ id: Number(result.lastInsertRowid), name, race, occupation, fromSession: session.title });
          }
        }
      } catch (e) {
        console.error(`Error extracting NPCs from session ${session.id}:`, e);
        // Continue with next session
      }
    }

    res.json({
      success: true,
      sessionsProcessed: sessions.length,
      totalExtracted: allExtracted.length,
      npcs: allExtracted
    });
  } catch (error) {
    console.error('Error extracting NPCs from all sessions:', error);
    res.status(500).json({ error: error.message });
  }
});

export { pickSeasonalStartDay };
export default router;
