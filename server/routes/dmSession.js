import express from 'express';
import db, { dbAll, dbGet, dbRun } from '../database.js';
import ollama from '../services/ollama.js';
import claude from '../services/claude.js';
import { dayToDate, advanceTime, getSeason, getTimeOfDay } from '../config/harptos.js';
import { XP_THRESHOLDS, getSpellSlots } from '../config/levelProgression.js';
import { formatThreadsForAI } from '../services/storyThreads.js';
import { getNarrativeContextForSession, markNarrativeItemsDelivered, onDMSessionStarted } from '../services/narrativeIntegration.js';
import { getPlanSummaryForSession } from '../services/campaignPlanService.js';
import { getCharacterWorldView, processLivingWorldTick } from '../services/livingWorldService.js';
import { getActiveFactions } from '../services/factionService.js';
import { getCharacterRelationshipsWithNpcs, getConversationsForCharacter, addPromise, fulfillPromise, getPendingPromises, adjustDisposition as adjustNpcDisposition, adjustTrust as adjustNpcTrust } from '../services/npcRelationshipService.js';
import { getDiscoveredLocations } from '../services/locationService.js';
import { getEventsVisibleToCharacter } from '../services/worldEventService.js';
import { getMerchantInventory, getMerchantsByCampaign, restockMerchant, updateMerchantAfterTransaction, generateBuybackPrices, createMerchantOnTheFly, addItemToMerchant, ensureItemAtMerchant } from '../services/merchantService.js';
import { placeCommission } from '../services/merchantOrderService.js';
import { recordPlayerDefenseOutcome } from '../services/baseThreatService.js';
import {
  parseNpcJoinMarker, detectDowntime, detectRecruitment, detectMerchantShop,
  detectMerchantRefer, detectAddItem, detectLootDrop, detectMerchantCommission, detectBaseDefenseResult, detectCombatStart, detectCombatEnd, estimateEnemyDexMod,
  detectWeatherChange, detectShelterFound, detectSwim, detectEat, detectDrink,
  detectForage, detectRecipeFound, detectMaterialFound, detectCraftProgress, detectRecipeGift,
  detectMythicTrial, detectPietyChange, detectItemAwaken, detectMythicSurge,
  detectPromiseMade, detectPromiseFulfilled,
  detectNotorietyGain, detectNotorietyLoss,
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
import { detectConditionChanges, formatConditionsForAI } from '../data/conditions.js';
import { safeParse } from '../utils/safeParse.js';
import { validateDmMarkers, buildCorrectionMessage } from '../services/markerSchemas.js';
import { verifyDmResponse, buildRuleCorrectionMessage } from '../services/ruleVerifiers.js';
import { logTurn as playtestLogTurn, logSessionEnd as playtestLogSessionEnd } from '../utils/playtestLogger.js';
import { initTranscript, appendToTranscript, getTurnCount, getTranscript } from '../utils/sessionTranscript.js';
import { generateSessionChronicle, getRelevantContext, getSessionSummariesForPrompt } from '../services/storyChronicleService.js';
import { getCharacterProgression } from '../services/progressionService.js';
import { resolveForNpcBatch as resolveNicknamesForNpcBatch } from '../services/nicknameService.js';
import { getCompanionProgression, ensureCompanionProgressionInitialized } from '../services/progressionCompanionService.js';
import { decayMoods } from '../services/companionBackstoryService.js';
import { syncDeathsFromCanonFacts } from '../services/npcLifecycleService.js';
import { getActiveNpcEffects } from '../services/worldEventNpcService.js';
import { getAwayCompanions } from '../services/companionActivityService.js';
import { processAbsenceEffects } from '../services/npcAgingService.js';
import { shouldCompress, compressMessageHistory, estimateTokens, calculateChronicleBudget } from '../utils/contextManager.js';
import { handleServerError } from '../utils/errorHandler.js';
import { getWeather, setWeather, getEffectiveTemperature, calculateGearWarmth, checkExposureEffects, hasShelter as checkHasShelter, formatWeatherForPrompt } from '../services/weatherService.js';
import { getSurvivalStatus, consumeFood, consumeWater, formatSurvivalForPrompt } from '../services/survivalService.js';
import { formatCraftingForPrompt, discoverRecipe, addMaterial, advanceProject, getProjectStatus, createRadiantRecipe } from '../services/craftingService.js';
import { formatMythicForPrompt, applyLeanTransforms } from '../services/dmPromptBuilder.js';
import { getMythicStatus, recordTrial, useMythicPower, advanceTier, findLegendaryItemByName, advanceItemState } from '../services/mythicService.js';
import { adjustPiety } from '../services/pietyService.js';
import { FULFILL_WEIGHTS, spreadReputationRipple, spreadFactionStanding, calculatePriceModifier } from '../services/consequenceService.js';
import { getActiveQuests as getCharacterActiveQuests } from '../services/questService.js';
import { calculateEconomyModifiers, getItemEconomyMultiplier, recordTransaction, getBulkDiscount } from '../services/economyService.js';
import { getBaseForPrompt } from '../services/partyBaseService.js';
import { getNotorietyForPrompt, addNotoriety as addNotorietyScore } from '../services/notorietyService.js';
import { getProjectsForPrompt } from '../services/longTermProjectService.js';
// Old single-session "origin story" prelude builder removed in v1.0.44 —
// replaced wholesale by the prelude-forward character creator (see
// server/services/preludeArcService.js + client PreludeSetupWizard).

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
    handleServerError(res, error, 'check LLM status');
  }
});

// Check Ollama status (legacy endpoint)
router.get('/ollama-status', async (req, res) => {
  try {
    const status = await ollama.checkOllamaStatus();
    res.json(status);
  } catch (error) {
    handleServerError(res, error, 'check Ollama status');
  }
});

// List available models
router.get('/models', async (req, res) => {
  try {
    const models = await ollama.listModels();
    res.json({ models });
  } catch (error) {
    handleServerError(res, error, 'list models');
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

    const messages = safeParse(session.messages, []);
    const config = safeParse(session.session_config, {});

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
    handleServerError(res, error, 'fetch latest session');
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
      session.messages = safeParse(session.messages, []);
      if (session.rewards) {
        session.rewards = safeParse(session.rewards, {});
      }
      // Add game date info
      if (session.game_start_day && session.game_start_year) {
        session.gameDate = dayToDate(session.game_start_day, session.game_start_year);
      }
    }

    res.json({ session });
  } catch (error) {
    handleServerError(res, error, 'fetch active session');
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
      if (s.rewards) s.rewards = safeParse(s.rewards, {});
    });

    res.json({ sessions });
  } catch (error) {
    handleServerError(res, error, 'fetch session history');
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
          const plan = safeParse(campaign.campaign_plan, null);
          if (plan) {
            campaignPlanInfo.questTitle = plan.main_quest?.title;
            campaignPlanInfo.themes = plan.themes || [];
          }
        }
      }
    }

    const campaignConfig = safeParse(character?.campaign_config, {});

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

    // Get ALL session summaries for story context (no limit — memory is part of the fun)
    const recentSessions = await dbAll(`
      SELECT id, title, summary, game_start_day, game_start_year,
             game_end_day, game_end_year, end_time
      FROM dm_sessions
      WHERE character_id = ? AND status = 'completed' AND rewards_claimed = 1
      ORDER BY created_at DESC
    `, [req.params.characterId]);

    // Parse the session config from the last session
    let sessionConfig = {};
    try {
      sessionConfig = safeParse(lastSession.session_config, {});
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
    handleServerError(res, error, 'get campaign context');
  }
});

// Get a specific session
router.get('/:sessionId', async (req, res) => {
  try {
    const session = await dbGet('SELECT * FROM dm_sessions WHERE id = ?', [req.params.sessionId]);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    session.messages = safeParse(session.messages, []);
    if (session.rewards) session.rewards = safeParse(session.rewards, {});
    res.json({ session });
  } catch (error) {
    handleServerError(res, error, 'fetch session');
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
      modelOverride,  // 'opus' | null — diagnostic override, forces Opus for all turns
      leanPrompt,  // boolean — diagnostic override, strips MECHANICAL MARKERS + softens HARD STOPS for prose-quality testing
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
             n.skills as npc_skills, c.skill_proficiencies,
             n.avatar, n.personality_trait_1, n.personality_trait_2, n.voice, n.mannerism,
             n.motivation, n.background_notes, n.relationship_to_party,
             cb.mood as companion_mood, cb.mood_cause as companion_mood_cause,
             cb.mood_intensity as companion_mood_intensity
      FROM companions c
      JOIN npcs n ON c.npc_id = n.id
      LEFT JOIN companion_backstories cb ON cb.companion_id = c.id
      WHERE c.recruited_by_character_id = ? AND c.status = 'active'
    `, [characterId]);

    // Phase 5.6: attach progression snapshot to each class-based companion so
    // the DM prompt can surface their theme abilities + ancestry feats.
    // Lazy-backfill + silent failure — a progression hiccup must not block a
    // session start.
    for (const c of companions) {
      if (c.progression_type !== 'class_based') continue;
      try {
        await ensureCompanionProgressionInitialized(c.id);
        c.progression = await getCompanionProgression(c.id);
      } catch (e) {
        console.error(`Error fetching companion progression for ${c.id}:`, e);
      }

      // Phase 6: attach spell slot state (max + used) so the DM prompt knows
      // what's available. `getSpellSlots` returns {} for non-casters and the
      // warlock object shape for warlocks; both cases are handled downstream.
      try {
        const max = getSpellSlots(c.companion_class, c.companion_level) || {};
        const used = safeParse(c.companion_spell_slots_used, {});
        c.spell_slots_max = max;
        c.spell_slots_used = used;
      } catch (e) {
        console.error(`Error computing companion spell slots for ${c.id}:`, e);
      }
    }

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
      pendingNarratives = safeParse(character.pending_downtime_narratives, []);
    } catch (e) {
      pendingNarratives = [];
    }

    // Extract used NPC names from past sessions to avoid reuse
    let usedNames = [];
    try {
      // First, check if we have names in campaign_config
      const campaignConfig = safeParse(character.campaign_config, {});
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
            const messages = safeParse(sess.messages, []);
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

      // Deduplicate — no cap, store all names
      usedNames = [...new Set(usedNames)];
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
          activeFactions: activeFactions || [],
          currentGameDay: character.game_day || null,
          activeQuests: []
        };
      } catch (e) {
        console.error('Error gathering world state for session:', e);
      }
    }

    // Get story chronicle context (canon facts for AI prompt)
    let chronicleContext = '';
    if (character.campaign_id) {
      try {
        // Build hints from current session context
        const hints = {
          location: startingLocation?.name || null,
          npcs: [],
          quests: []
        };
        // Extract NPC names from world state relationships
        if (worldState?.npcRelationships) {
          hints.npcs = worldState.npcRelationships.slice(0, 30).map(r => r.npc_name).filter(Boolean);
        }

        // Calculate adaptive token budget
        const estimatedPromptTokens = estimateTokens(JSON.stringify(worldState || '') + (character.campaign_notes || '') + (character.character_memories || ''));
        const chronicleBudget = calculateChronicleBudget(estimatedPromptTokens, 0, 'claude-sonnet-4-6');

        const chronicleResult = await getRelevantContext(characterId, character.campaign_id, hints, chronicleBudget);
        chronicleContext = chronicleResult.context || '';
        if (chronicleResult.factsIncluded > 0) {
          console.log(`Story chronicle: ${chronicleResult.factsIncluded}/${chronicleResult.totalFacts} facts included (budget: ${chronicleBudget} tokens)`);
        }
      } catch (e) {
        console.error('Error fetching chronicle context:', e);
      }
    }

    // Sync any deaths from canon facts that weren't propagated to NPC lifecycle
    if (character.campaign_id) {
      try {
        await syncDeathsFromCanonFacts(character.campaign_id);
      } catch (e) {
        console.error('Error syncing deaths from canon facts:', e);
      }
    }

    // ──────────── PARALLEL CONTEXT ASSEMBLY (v1.0.36) ────────────
    // Previously the context-gathering block was 15+ sequential awaits totalling
    // ~150-300ms. All of these reads are independent — Promise.all collapses the
    // latency to the slowest single fetch (~30-50ms).
    //
    // Ordering we still enforce:
    //   Phase A — worldState-filling reads (NPC convs, NPC events, quests) +
    //             awayCompanions. Parallel internally.
    //   Phase B — mood/absence mutations. Parallel internally, but must
    //             complete before any subsequent read that depends on them.
    //             (In practice nothing after this block reads moods/dispositions
    //             until the prompt is built, so this is a safety precaution.)
    //   Phase C — all remaining independent reads, parallel.

    // Phase A — parallel reads that fill worldState
    const campaignId = character.campaign_id;
    const worldStateFills = campaignId && worldState
      ? [
          getConversationsForCharacter(characterId).catch(e => {
            console.error('Error fetching NPC conversations:', e); return null;
          }),
          getActiveNpcEffects(campaignId).catch(e => {
            console.error('Error fetching NPC event effects:', e); return null;
          }),
          getCharacterActiveQuests(characterId).catch(e => {
            console.error('Error fetching active quests:', e); return null;
          })
        ]
      : [Promise.resolve(null), Promise.resolve(null), Promise.resolve(null)];

    const awayCompanionsPromise = getAwayCompanions(characterId).catch(e => {
      console.error('Error fetching away companions:', e); return [];
    });

    const [npcConversations, npcEventEffects, activeQuestsRaw, awayCompanions] = await Promise.all([
      ...worldStateFills,
      awayCompanionsPromise
    ]);

    if (worldState) {
      if (npcConversations) worldState.npcConversations = npcConversations;
      if (npcEventEffects) worldState.npcEventEffects = npcEventEffects;
      if (activeQuestsRaw) {
        // Enrich active quests with faction names using already-loaded worldState
        for (const q of activeQuestsRaw) {
          if (q.source_type === 'faction' && q.source_id) {
            const faction = worldState.activeFactions?.find(f => f.id === q.source_id);
            q.faction_name = faction?.name || null;
          }
          if (q.quest_type === 'faction_conflict' && q.rewards) {
            const agg = worldState.activeFactions?.find(f => f.id === q.rewards.aggressor_faction_id);
            const def = worldState.activeFactions?.find(f => f.id === q.rewards.defender_faction_id);
            q.rewards.aggressor_faction_name = agg?.name || null;
            q.rewards.defender_faction_name = def?.name || null;
          }
        }
        worldState.activeQuests = activeQuestsRaw;
      }
    }

    // Phase B — mutations (decay companion moods + NPC dispositions). Parallel
    // since they touch different tables.
    if (character.game_day) {
      await Promise.all([
        decayMoods(characterId, character.game_day).catch(e => {
          console.error('Error decaying companion moods:', e);
        }),
        processAbsenceEffects(characterId, character.game_day).catch(e => {
          console.error('Error processing NPC absence effects:', e);
        })
      ]);
    }

    // Phase C — remaining independent reads. Also dedupes the weather fetch
    // (previously fetched twice — once for weatherContext, once for
    // survivalContext).
    const [
      weatherSnapshot,
      craftingContextResult,
      mythicStatusResult,
      partyBaseContextResult,
      notorietyContextResult,
      projectsContextResult,
      chronicleSummariesResult,
      progression,
      secondaryProgression,
      nicknameResolutionsResult
    ] = await Promise.all([
      campaignId
        ? getWeather(campaignId).catch(e => { console.error('Error fetching weather:', e); return null; })
        : Promise.resolve(null),
      campaignId
        ? formatCraftingForPrompt(characterId).catch(e => { console.error('Error formatting crafting:', e); return ''; })
        : Promise.resolve(''),
      getMythicStatus(characterId).catch(e => { console.error('Error fetching mythic:', e); return null; }),
      getBaseForPrompt(characterId, campaignId).then(r => r || '').catch(e => { console.error('Error base:', e); return ''; }),
      getNotorietyForPrompt(characterId, campaignId).then(r => r || '').catch(e => { console.error('Error notoriety:', e); return ''; }),
      getProjectsForPrompt(characterId, campaignId).then(r => r || '').catch(e => { console.error('Error projects:', e); return ''; }),
      campaignId
        ? getSessionSummariesForPrompt(campaignId, characterId).catch(e => { console.error('Error chronicle summaries:', e); return []; })
        : Promise.resolve([]),
      getCharacterProgression(characterId).catch(e => { console.error('Error progression primary:', e); return null; }),
      secondCharacterId
        ? getCharacterProgression(secondCharacterId).catch(e => { console.error('Error progression secondary:', e); return null; })
        : Promise.resolve(null),
      (Array.isArray(customNpcs) && customNpcs.length > 0)
        ? resolveNicknamesForNpcBatch(characterId, customNpcs.map(n => n?.id).filter(Boolean)).catch(e => {
            console.error('Error resolving nicknames:', e); return null;
          })
        : Promise.resolve(null)
    ]);

    // Synchronous formatting from the fetched data
    let weatherContext = '';
    let survivalContext = '';
    if (weatherSnapshot) {
      try {
        const timeOfDay = getTimeOfDay(character.game_hour || 8);
        const effectiveTemp = getEffectiveTemperature(weatherSnapshot.temperature_f, weatherSnapshot.weather_type, timeOfDay);
        const gearSummary = calculateGearWarmth(character.inventory, character.equipment);
        const shelterType = checkHasShelter(character.current_location || '', character.inventory);
        weatherContext = formatWeatherForPrompt(weatherSnapshot, effectiveTemp, timeOfDay, gearSummary, shelterType, character.current_location || '');
      } catch (e) {
        console.error('Error formatting weather context:', e);
      }
      try {
        survivalContext = formatSurvivalForPrompt(character, weatherSnapshot, null);
      } catch (e) {
        console.error('Error formatting survival context:', e);
      }
    }

    const craftingContext = craftingContextResult;
    const partyBaseContext = partyBaseContextResult;
    const notorietyContext = notorietyContextResult;
    const projectsContext = projectsContextResult;
    const chronicleSummaries = chronicleSummariesResult;
    const nicknameResolutions = nicknameResolutionsResult;

    let mythicContext = '';
    if (mythicStatusResult && mythicStatusResult.tier > 0) {
      mythicContext = formatMythicForPrompt(mythicStatusResult, character);
    }
    // ──────────── END PARALLEL CONTEXT ASSEMBLY ────────────

    // Build session config with campaign module or custom Forgotten Realms context
    const sessionConfig = {
      campaignModule,
      startingLocation,
      era,
      arrivalHook,
      customConcepts,
      campaignLength,
      customNpcs,
      nicknameResolutions,
      companions,
      awayCompanions,
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
      campaignPlanSummary,
      chronicleContext,
      chronicleSummaries,
      weatherContext,
      survivalContext,
      craftingContext,
      mythicContext,
      partyBaseContext,
      notorietyContext,
      projectsContext,
      progression,
      secondaryProgression
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
      // Prefer richer chronicle summary over dm_sessions summary
      const lastChronicle = chronicleSummaries.length > 0 ? chronicleSummaries[chronicleSummaries.length - 1] : null;
      const lastSessionSummary = isContinuing
        ? (lastChronicle?.summary || previousSessionSummaries[previousSessionSummaries.length - 1]?.summary)
        : null;

      // Detect imported mid-progress campaigns: the plan has session_continuity,
      // meaning the campaign is already underway even if this character has no prior sessions
      const isImportedMidProgress = campaignPlanSummary?.session_continuity
        && (campaignPlanSummary?.campaign_metadata || campaignPlanSummary?.dm_directives);

      if (isPublishedModule) {
        if (isContinuing && lastSessionSummary) {
          openingPrompt = `Continue the ${campaignModule.name} campaign! This is a CONTINUATION from the previous session. Here's what happened last time:\n\n${lastSessionSummary}\n\nCRITICAL - HONOR SPECIFIC PLANS: If the summary mentions ANY specific plans, decisions, or timing the party made (like "agreed to leave at dawn", "planned to depart before sunrise", "decided to meet someone at midnight"), you MUST start the scene at EXACTLY that moment. Do NOT skip past their plans or change the timing they chose. The player made those decisions - respect them.\n\nPick up the story from where it left off. Write in second person ("you see", "you hear"). Do not speak dialogue for the player character. Do NOT recap the entire previous session - just smoothly continue the narrative.`;
        } else {
          openingPrompt = `Begin the ${campaignModule.name} campaign! Set an appropriate opening scene in ${campaignModule.setting}. Write in second person ("you see", "you hear"). Do not speak dialogue for the player character. Present the scene and let the player decide what to do.`;
        }
      } else if (isImportedMidProgress && !isContinuing) {
        // Imported mid-progress campaign, character's first session in the system.
        // Use session_continuity from plan to pick up where the external campaign left off.
        const currentLoc = character.current_location || 'their current location';
        const sc = campaignPlanSummary.session_continuity;
        const currentState = sc.current_state
          ? (typeof sc.current_state === 'string' ? sc.current_state : JSON.stringify(sc.current_state))
          : '';
        const immediateCtx = sc.immediate_context
          ? (typeof sc.immediate_context === 'string' ? sc.immediate_context : JSON.stringify(sc.immediate_context))
          : '';

        openingPrompt = `Continue this imported campaign! This campaign was previously played externally and is now continuing in this system. DO NOT start from the beginning — the story is already in progress.

CURRENT SITUATION: ${currentState}${immediateCtx ? `\n\nIMMEDIATE CONTEXT: ${immediateCtx}` : ''}

The character ${charName} is currently at ${currentLoc}. Pick up the story from the CURRENT CAMPAIGN STATE described in the campaign plan. Write in second person ("you see", "you hear"). Do not speak dialogue for the player character. Set a scene that flows naturally from where the story left off — do NOT recap the entire backstory, just establish the current moment and present the player with an engaging situation.`;
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
      // Imported mid-progress campaigns use Sonnet even for the first system session
      // modelOverride='opus' forces Opus for all turns (diagnostic / prose-quality playtest)
      const baseModelChoice = (isContinuing || isImportedMidProgress) ? 'sonnet' : 'opus';
      const modelChoice = modelOverride === 'opus' ? 'opus' : baseModelChoice;

      // Lean prompt: strips MECHANICAL MARKERS + softens Cardinal Rule 2.
      // Applied per-call only — the FULL prompt is what we store in messages[0]
      // so toggling lean off later restores all rules.
      const apiSystemPrompt = leanPrompt ? applyLeanTransforms(systemPrompt) : systemPrompt;

      const claudeResult = await claude.startSession(apiSystemPrompt, openingPrompt, modelChoice);
      // Restore the full prompt as the persisted system message regardless
      // of which variant we sent to the API this turn.
      if (claudeResult.messages?.[0]?.role === 'system') {
        claudeResult.messages[0] = { role: 'system', content: systemPrompt };
      }
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
    // For imported mid-progress campaigns, use the character's existing game_day (don't randomize)
    const priorSessions = await dbGet('SELECT COUNT(*) as count FROM dm_sessions WHERE character_id = ?', [characterId]);
    const isFirstSession = !priorSessions || priorSessions.count === 0;
    const planHasSessionContinuity = campaignPlanSummary?.session_continuity
      && (campaignPlanSummary?.campaign_metadata || campaignPlanSummary?.dm_directives);
    let gameStartDay;
    if ((isFirstSession && !planHasSessionContinuity) || !character.game_day) {
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
    } else if (campaignPlanSummary?.campaign_metadata?.year) {
      // Use year from imported campaign plan metadata
      gameStartYear = campaignPlanSummary.campaign_metadata.year;
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
      model || process.env.OLLAMA_MODEL || 'gpt-oss:20b',
      JSON.stringify(result.messages),
      JSON.stringify(sessionConfig),
      gameStartDay,
      gameStartYear
    ]);

    // Initialize the append-only transcript with the opening exchange
    // (migration 046). The LLM-facing `messages` blob may compact later;
    // transcript stays complete.
    try {
      await initTranscript(Number(info.lastInsertRowid), result.messages);
    } catch (err) {
      console.error('[dm-session] failed to initialize transcript (non-fatal):', err.message);
    }

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
    handleServerError(res, error, 'start DM session');
  }
});

// The old single-session "origin story" `POST /api/dm-session/start-prelude`
// endpoint was removed in v1.0.44. If you're looking for the prelude, it's
// now the prelude-forward character creator mounted under `/api/prelude/*`
// — see server/routes/prelude.js + server/services/preludeArcService.js.

// Detection helpers imported from dmSessionService.js

// Send a message/action in the session
router.post('/:sessionId/message', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { action, providerPreference, modelOverride, leanPrompt, activeConditions } = req.body;

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

    const messages = safeParse(session.messages, []);

    // Inject active conditions as context if any are present
    if (activeConditions) {
      const conditionNote = formatConditionsForAI(activeConditions.player, activeConditions.companions);
      if (conditionNote) {
        messages.push({ role: 'user', content: conditionNote });
      }
    }

    // Check which LLM provider is available (respects user preference)
    const { provider } = await getLLMProvider(providerPreference);
    if (!provider) {
      return res.status(503).json({ error: 'No LLM provider available' });
    }

    // Pillar 5: inject the repetition ledger into the system prompt so the DM
    // sees "Recently used imagery — do not reuse" before composing the next
    // response. Builds an augmented messages array without mutating the
    // original (which is const). Silent-fail on read errors.
    let augmentedMessages = messages;
    try {
      const { getLedger, formatRepetitionLedger } = await import('../services/repetitionLedgerService.js');
      const ledger = await getLedger(parseInt(sessionId));
      const ledgerBlock = formatRepetitionLedger(ledger);
      if (ledgerBlock && messages[0] && messages[0].role === 'system' && messages[0].content) {
        // Strip any previously-appended ledger (we re-inject the latest each turn).
        const cleaned = messages[0].content.replace(
          /\n*══════════════════════════════════════════════════════════════\nRECENTLY USED IMAGERY[\s\S]*/,
          ''
        );
        augmentedMessages = [
          { ...messages[0], content: cleaned + ledgerBlock },
          ...messages.slice(1)
        ];
      }
    } catch (err) {
      // Silent-fail — ledger is polish.
    }

    // Marker correction injection: if the previous turn emitted a marker that
    // failed schema validation, the failure was stashed on session_config.
    // Surface it in the system prompt now so the AI can re-emit correctly.
    // Stripped after the turn regardless of whether the AI acted on it — we
    // don't want the same correction note accreting turn after turn. Player
    // never sees any of this; it lives entirely in the system-prompt layer.
    try {
      const cfg = safeParse(session.session_config, {});
      const pendingCorrection = cfg.pendingMarkerCorrections;
      if (pendingCorrection && augmentedMessages[0]?.role === 'system' && augmentedMessages[0]?.content) {
        const correctionBlock = `\n\n══════════════ MARKER CORRECTION NEEDED (from last turn) ══════════════\n${pendingCorrection}\n═══════════════════════════════════════════════════════════════════════\n`;
        augmentedMessages = [
          { ...augmentedMessages[0], content: augmentedMessages[0].content + correctionBlock },
          ...augmentedMessages.slice(1)
        ];
      }
    } catch (err) {
      // Silent-fail — correction is additive.
    }

    // Apply the rolling session summary (Follow-up #3). If this session has
    // one, it replaces the summarized prefix with a compact "PREVIOUS SCENES —
    // SUMMARY" user message. Keeps the most recent KEEP_TAIL_MESSAGES turns
    // verbatim. No-op if the session hasn't crossed the roll threshold yet.
    let messagesToSend = augmentedMessages;
    try {
      const { applyToMessages } = await import('../services/rollingSummaryService.js');
      const rolled = applyToMessages(session, augmentedMessages);
      if (rolled.summaryInjected) {
        messagesToSend = rolled.messages;
        console.log(
          `[rolling-summary] session ${sessionId}: applied summary, compacted ${rolled.originalCount} → ${rolled.finalCount} messages`
        );
      }
    } catch (err) {
      // Silent-fail — falls back to pre-compaction messages.
    }

    // Reactive context-window compression as a safety net. With rolling
    // summaries in place this should rarely fire — but we keep it for
    // cases where summarization lags behind (e.g. rapid-fire turns).
    const modelForCompression = provider === 'claude' ? 'claude-sonnet-4-6' : (session.model || process.env.OLLAMA_MODEL || 'gpt-oss:20b');
    const compressionCheck = shouldCompress(messagesToSend, modelForCompression);

    if (compressionCheck.needsCompression) {
      console.log(`Context compression triggered (${compressionCheck.urgency}): ${compressionCheck.totalTokens} estimated tokens`);
      try {
        messagesToSend = await compressMessageHistory(messagesToSend, parseInt(sessionId), modelForCompression);
        console.log(`Compressed to ${messagesToSend.length} messages`);
      } catch (compressError) {
        console.error('Context compression failed, using full history:', compressError.message);
      }
    }

    let result;
    if (provider === 'claude') {
      // Use Claude - extract system prompt from messages
      // Default to Sonnet for ongoing session actions (cost-effective for gameplay)
      // modelOverride='opus' forces Opus for diagnostic / prose-quality playtest
      // leanPrompt=true strips MECHANICAL MARKERS + softens Cardinal Rule 2 for this call;
      //   we restore the full prompt to messages[0] before persisting so the toggle is reversible.
      const systemMessage = messagesToSend.find(m => m.role === 'system');
      const systemPrompt = systemMessage?.content || '';
      const apiSystemPrompt = leanPrompt ? applyLeanTransforms(systemPrompt) : systemPrompt;
      const turnModel = modelOverride === 'opus' ? 'opus' : 'sonnet';
      const claudeResult = await claude.continueSession(apiSystemPrompt, messagesToSend, action, turnModel, { sessionId });
      if (claudeResult.messages?.[0]?.role === 'system') {
        claudeResult.messages[0] = { role: 'system', content: systemPrompt };
      }
      result = {
        narrative: claudeResult.response,
        messages: claudeResult.messages
      };
    } else {
      // Use Ollama
      result = await ollama.continueSession(messagesToSend, action, session.model);
    }

    // Update the session in the database (LLM-facing, may be compacted)
    await dbRun('UPDATE dm_sessions SET messages = ? WHERE id = ?', [JSON.stringify(result.messages), sessionId]);

    // Append this turn's user + assistant pair to the full transcript.
    // Best-effort — never breaks the session for a persistence issue.
    try {
      await appendToTranscript(parseInt(sessionId), [
        { role: 'user', content: action },
        { role: 'assistant', content: result.narrative || '' }
      ]);
    } catch (err) {
      console.error('[dm-session] transcript append failed (non-fatal):', err.message);
    }

    // Validate every marker the AI emitted against its schema. Any failures
    // (missing required fields, invalid enums, out-of-range numbers) get
    // stashed on session_config so the NEXT turn's system prompt can ask the
    // AI to re-emit. We also clear any previous-turn correction that was
    // already served — either the AI acted on it and the new response will
    // either include a corrected marker or not; either way, stale corrections
    // shouldn't accrete. Both reads/writes are best-effort.
    let validationSummary = null;  // captured for playtest logging below
    try {
      const validateResult = validateDmMarkers(result.narrative || '');
      const { failures, validByKey } = validateResult;
      const { violations: ruleViolations } = verifyDmResponse(result.narrative || '');
      const cfg = safeParse(session.session_config, {});
      const nextCfg = { ...cfg };
      const hadPriorCorrection = !!cfg.pendingMarkerCorrections;
      // Consume any previously-surfaced correction from this turn.
      delete nextCfg.pendingMarkerCorrections;
      // Queue any new failures for next turn (schema + rule combined).
      const combinedNotes = [];
      if (failures.length > 0) {
        const msg = buildCorrectionMessage(failures);
        if (msg) combinedNotes.push(msg);
        console.warn(`[marker-schema] ${failures.length} malformed marker(s) on session ${sessionId}:`, failures.map(f => `${f.schemaKey}(${f.errors.map(e => e.field).join(',')})`).join(', '));
      }
      if (ruleViolations.length > 0) {
        const msg = buildRuleCorrectionMessage(ruleViolations);
        if (msg) combinedNotes.push(msg);
        console.warn(`[rule-verify] ${ruleViolations.length} rule violation(s) on session ${sessionId}:`, ruleViolations.map(v => v.rule).join(', '));
      }
      if (combinedNotes.length > 0) {
        nextCfg.pendingMarkerCorrections = combinedNotes.join('\n');
      }
      // Only write if something actually changed.
      if (cfg.pendingMarkerCorrections !== nextCfg.pendingMarkerCorrections) {
        await dbRun('UPDATE dm_sessions SET session_config = ? WHERE id = ?', [JSON.stringify(nextCfg), sessionId]);
      }
      // Capture summary for playtest logger
      const validMarkerCount = Object.values(validByKey).reduce((sum, arr) => sum + arr.length, 0);
      validationSummary = {
        markersValid: validMarkerCount,
        markersMalformed: failures.length,
        ruleViolations: ruleViolations.length,
        correctionConsumed: hadPriorCorrection,
        correctionQueued: combinedNotes.length > 0
      };
    } catch (err) {
      console.error('[marker-schema] validation pass failed (non-fatal):', err.message);
    }

    // Per-turn playtest log line — surfaces context-drift signals live in the terminal.
    // Turn number comes from the append-only transcript (authoritative,
    // unaffected by rolling-summary compaction).
    try {
      let turnNumber;
      try {
        turnNumber = await getTurnCount(parseInt(sessionId));
      } catch {
        turnNumber = Math.ceil(result.messages.length / 2);
      }
      const promptChars = augmentedMessages[0]?.content?.length || 0;
      // Best-effort character-name lookup for human-readable framing.
      let characterName = null;
      if (session.character_id) {
        try {
          const ch = await dbGet('SELECT name, nickname FROM characters WHERE id = ?', [session.character_id]);
          characterName = ch?.nickname || ch?.name || null;
        } catch {/* swallow */}
      }
      playtestLogTurn({
        sessionId: parseInt(sessionId),
        turnNumber,
        sessionType: 'dm',
        characterName,
        promptChars,
        markersValid: validationSummary?.markersValid,
        markersMalformed: validationSummary?.markersMalformed,
        ruleViolations: validationSummary?.ruleViolations,
        correctionConsumed: validationSummary?.correctionConsumed,
        correctionQueued: validationSummary?.correctionQueued
      });
    } catch (logErr) {
      // Logging never breaks the session.
    }

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
    // Prelude-flow skill checks. The AI is instructed to emit these when a
    // check is required, but the marker itself must never reach the player.
    cleanNarrative = cleanNarrative.replace(/\[SKILL_CHECK:[^\]]+\]\s*/gi, '').trim();
    cleanNarrative = cleanNarrative.replace(/\[CONDITION_ADD:[^\]]+\]\s*/gi, '').trim();
    cleanNarrative = cleanNarrative.replace(/\[CONDITION_REMOVE:[^\]]+\]\s*/gi, '').trim();
    cleanNarrative = cleanNarrative.replace(/\[WEATHER_CHANGE:[^\]]+\]\s*/gi, '').trim();
    cleanNarrative = cleanNarrative.replace(/\[SHELTER_FOUND:[^\]]+\]\s*/gi, '').trim();
    cleanNarrative = cleanNarrative.replace(/\[SWIM:[^\]]+\]\s*/gi, '').trim();
    cleanNarrative = cleanNarrative.replace(/\[EAT:[^\]]+\]\s*/gi, '').trim();
    cleanNarrative = cleanNarrative.replace(/\[DRINK:[^\]]+\]\s*/gi, '').trim();
    cleanNarrative = cleanNarrative.replace(/\[FORAGE:[^\]]+\]\s*/gi, '').trim();
    cleanNarrative = cleanNarrative.replace(/\[RECIPE_FOUND:[^\]]+\]\s*/gi, '').trim();
    cleanNarrative = cleanNarrative.replace(/\[MATERIAL_FOUND:[^\]]+\]\s*/gi, '').trim();
    cleanNarrative = cleanNarrative.replace(/\[CRAFT_PROGRESS:[^\]]+\]\s*/gi, '').trim();
    cleanNarrative = cleanNarrative.replace(/\[RECIPE_GIFT:[^\]]+\]\s*/gi, '').trim();
    cleanNarrative = cleanNarrative.replace(/\[MYTHIC_TRIAL:[^\]]+\]\s*/gi, '').trim();
    cleanNarrative = cleanNarrative.replace(/\[PIETY_CHANGE:[^\]]+\]\s*/gi, '').trim();
    cleanNarrative = cleanNarrative.replace(/\[ITEM_AWAKEN:[^\]]+\]\s*/gi, '').trim();
    cleanNarrative = cleanNarrative.replace(/\[MYTHIC_SURGE:[^\]]+\]\s*/gi, '').trim();
    cleanNarrative = cleanNarrative.replace(/\[PROMISE_MADE:[^\]]+\]\s*/gi, '').trim();
    cleanNarrative = cleanNarrative.replace(/\[PROMISE_FULFILLED:[^\]]+\]\s*/gi, '').trim();

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

    // M2: Handle MERCHANT_COMMISSION — player commissions a custom item from
    // the current merchant. The marker emits item + price + deposit + lead
    // time; we create a merchant_orders row, deduct the deposit from the
    // party purse, and surface the order back to the AI so it can narrate
    // the hand-off ("come back in 7 days").
    const commissions = detectMerchantCommission(result.narrative);
    if (commissions.length > 0) {
      try {
        const character = await dbGet(
          'SELECT campaign_id, game_day FROM characters WHERE id = ?',
          [session.character_id]
        );
        if (character?.campaign_id) {
          for (const c of commissions) {
            // Find or create the merchant
            let dbMerchant = await getMerchantInventory(character.campaign_id, c.merchant);
            if (!dbMerchant) {
              dbMerchant = await createMerchantOnTheFly(
                character.campaign_id, c.merchant,
                'general', null, 1
              );
            }

            // Idempotency guard: if an active order with the same item name
            // already exists at this merchant for this character, skip —
            // the AI likely repeated the marker across retries or across
            // two turns in the same narrative beat. Prevents double-charging
            // the deposit.
            const dupe = await dbGet(
              `SELECT id FROM merchant_orders
               WHERE merchant_id = ? AND character_id = ?
                 AND LOWER(item_name) = LOWER(?)
                 AND status IN ('pending','ready')
               LIMIT 1`,
              [dbMerchant.id, session.character_id, c.item]
            );
            if (dupe) {
              result.messages.push({
                role: 'user',
                content: `[SYSTEM: MERCHANT_COMMISSION skipped — an order for "${c.item}" at ${c.merchant} is already in progress (order #${dupe.id}). Don't restate the commission.]`
              });
              await dbRun('UPDATE dm_sessions SET messages = ? WHERE id = ?', [JSON.stringify(result.messages), sessionId]);
              continue;
            }

            const quotedCp = (c.price_gp || 0) * 100 + (c.price_sp || 0) * 10 + (c.price_cp || 0);
            const depositCp = (c.deposit_gp || 0) * 100 + (c.deposit_sp || 0) * 10 + (c.deposit_cp || 0);

            const result2 = await placeCommission({
              merchantId: dbMerchant.id,
              characterId: session.character_id,
              itemName: c.item,
              itemSpec: { quality: c.quality, description: c.description, hook: c.hook },
              quotedPriceCp: quotedCp,
              depositCp,
              leadTimeDays: c.lead_time_days,
              currentGameDay: character.game_day || 0,
              narrativeHook: c.hook
            });

            if (!result2.ok) {
              // Surface the reason back to the AI as a system note — it can
              // narrate the merchant changing their mind or the player
              // backing out ("you don't have enough coin for the deposit").
              result.messages.push({
                role: 'user',
                content: `[SYSTEM: MERCHANT_COMMISSION failed — ${result2.error}. Narrate the merchant withdrawing the offer or the player lacking funds. Do NOT tell the player the order was placed.]`
              });
            } else {
              result.messages.push({
                role: 'user',
                content: `[SYSTEM: Commission recorded. Order #${result2.order.id}: ${c.item} from ${c.merchant}, ready in ${c.lead_time_days} game days (day ${character.game_day + c.lead_time_days}). Deposit: ${Math.ceil(depositCp / 100)} gp. Balance due on pickup: ${Math.ceil((quotedCp - depositCp) / 100)} gp.]`
              });
            }
            await dbRun('UPDATE dm_sessions SET messages = ? WHERE id = ?', [JSON.stringify(result.messages), sessionId]);
          }
        }
      } catch (e) {
        console.error('Error processing merchant commission:', e);
      }
    }

    // F3: Handle BASE_DEFENSE_RESULT markers — record the outcome of a
    // player-led base defense so the threat flips from 'defending' to
    // 'resolved' with the declared outcome.
    const defenseResults = detectBaseDefenseResult(result.narrative);
    if (defenseResults.length > 0) {
      try {
        const character = await dbGet('SELECT game_day FROM characters WHERE id = ?', [session.character_id]);
        for (const d of defenseResults) {
          try {
            await recordPlayerDefenseOutcome(d.threatId, {
              outcome: d.outcome,
              narrative: d.narrative,
              gameDay: character?.game_day || null
            });
            result.messages.push({
              role: 'user',
              content: `[SYSTEM: Base defense outcome recorded. Threat #${d.threatId} resolved as ${d.outcome}.]`
            });
          } catch (e) {
            result.messages.push({
              role: 'user',
              content: `[SYSTEM: BASE_DEFENSE_RESULT failed — ${e.message}]`
            });
          }
        }
        await dbRun('UPDATE dm_sessions SET messages = ? WHERE id = ?', [JSON.stringify(result.messages), sessionId]);
      } catch (e) {
        console.error('Error processing base defense result:', e);
      }
    }

    // Handle LOOT_DROP markers — validate items and add to character inventory
    const lootDrops = detectLootDrop(result.narrative);
    let lootDropResults = [];
    if (lootDrops.length > 0) {
      try {
        const character = await dbGet('SELECT id, level, inventory FROM characters WHERE id = ?', [session.character_id]);
        if (character) {
          let inventory = safeParse(character.inventory, []);

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
          ? safeParse(character.ability_scores, {})
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

        // Companion initiatives.
        // Schema notes: companions.name doesn't exist (name lives on npcs via
        // npc_id); the FK column is recruited_by_character_id, and active-state
        // is `status = 'active'` rather than a boolean is_active.
        const activeCompanions = await dbAll(
          `SELECT n.name AS name, c.companion_ability_scores
           FROM companions c
           JOIN npcs n ON c.npc_id = n.id
           WHERE c.recruited_by_character_id = ? AND c.status = 'active'`,
          [session.character_id]
        );
        for (const comp of activeCompanions) {
          const compAbilities = typeof comp.companion_ability_scores === 'string'
            ? safeParse(comp.companion_ability_scores, {})
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

    // Detect condition changes from AI response
    const conditionChanges = detectConditionChanges(result.narrative);
    const hasConditionChanges = conditionChanges.applied.length > 0 || conditionChanges.removed.length > 0;

    // Process weather/survival/crafting markers
    let weatherChangeResult = null;
    let survivalEvents = [];
    let craftingEvents = [];

    try {
      const character = await dbGet('SELECT id, campaign_id, game_day, inventory FROM characters WHERE id = ?', [session.character_id]);
      if (character?.campaign_id) {
        // Weather change
        const weatherChange = detectWeatherChange(result.narrative);
        if (weatherChange) {
          const updated = await setWeather(character.campaign_id, weatherChange.type, weatherChange.duration_hours, character.game_day || 1);
          weatherChangeResult = { type: weatherChange.type, duration_hours: weatherChange.duration_hours };
          console.log(`🌦️ WEATHER_CHANGE: ${weatherChange.type} for ${weatherChange.duration_hours}h`);
        }

        // Shelter found
        const shelter = detectShelterFound(result.narrative);
        if (shelter) {
          await dbRun('UPDATE characters SET shelter_type = ? WHERE id = ?', [shelter.type, character.id]);
          survivalEvents.push({ type: 'shelter_found', shelter: shelter.type });
        }

        // Eating
        const eatMarkers = detectEat(result.narrative);
        for (const eat of eatMarkers) {
          try {
            await consumeFood(character.id, eat.item, character.game_day || 1);
            survivalEvents.push({ type: 'ate', item: eat.item });
          } catch (e) {
            console.error(`Error processing EAT marker for ${eat.item}:`, e.message);
          }
        }

        // Drinking
        const drinkMarkers = detectDrink(result.narrative);
        for (const drink of drinkMarkers) {
          try {
            await consumeWater(character.id, drink.item, character.game_day || 1);
            survivalEvents.push({ type: 'drank', item: drink.item });
          } catch (e) {
            console.error(`Error processing DRINK marker for ${drink.item}:`, e.message);
          }
        }

        // Foraging
        const forage = detectForage(result.narrative);
        if (forage && forage.result === 'success') {
          if (forage.food > 0) {
            // Add foraged food to inventory
            const inv = safeParse(character.inventory, []);
            const existing = inv.find(i => i.name === 'Foraged Food');
            if (existing) existing.quantity = (existing.quantity || 1) + forage.food;
            else inv.push({ name: 'Foraged Food', quantity: forage.food, category: 'food', nutrition_days: 1, perishable: true, spoils_in_days: 2, acquired_game_day: character.game_day || 1 });
            await dbRun('UPDATE characters SET inventory = ? WHERE id = ?', [JSON.stringify(inv), character.id]);
          }
          if (forage.water > 0) {
            const inv = safeParse(character.inventory, []);
            const existing = inv.find(i => i.name === 'Collected Water');
            if (existing) existing.quantity = (existing.quantity || 1) + forage.water;
            else inv.push({ name: 'Collected Water', quantity: forage.water, category: 'water', hydration_days: 1 });
            await dbRun('UPDATE characters SET inventory = ? WHERE id = ?', [JSON.stringify(inv), character.id]);
          }
          survivalEvents.push({ type: 'foraged', terrain: forage.terrain, food: forage.food, water: forage.water });
        }

        // Recipe discovery
        const recipes = detectRecipeFound(result.narrative);
        for (const recipe of recipes) {
          try {
            await discoverRecipe(character.id, recipe.name, recipe.source, character.game_day || 1);
            craftingEvents.push({ type: 'recipe_found', name: recipe.name, source: recipe.source });
          } catch (e) {
            console.error(`Error processing RECIPE_FOUND for ${recipe.name}:`, e.message);
          }
        }

        // Material discovery
        const materials = detectMaterialFound(result.narrative);
        for (const mat of materials) {
          try {
            await addMaterial(character.id, mat.name, mat.quantity, mat.quality, 'found', character.game_day || 1);
            craftingEvents.push({ type: 'material_found', name: mat.name, quantity: mat.quantity });
          } catch (e) {
            console.error(`Error processing MATERIAL_FOUND for ${mat.name}:`, e.message);
          }
        }

        // Craft progress
        const craftProgress = detectCraftProgress(result.narrative);
        if (craftProgress) {
          try {
            const projects = await getProjectStatus(character.id);
            const activeProject = projects.find(p => p.status === 'in_progress');
            if (activeProject) {
              await advanceProject(activeProject.id, craftProgress.hours);
              craftingEvents.push({ type: 'craft_progress', hours: craftProgress.hours, project_id: activeProject.id });
            }
          } catch (e) {
            console.error('Error processing CRAFT_PROGRESS:', e.message);
          }
        }

        // Radiant recipe gifts (AI-created unique recipes)
        const recipeGifts = detectRecipeGift(result.narrative);
        for (const gift of recipeGifts) {
          try {
            const created = await createRadiantRecipe(character.id, gift, character.game_day || 1);
            craftingEvents.push({
              type: 'recipe_gift',
              name: gift.name,
              category: gift.category,
              gifted_by: gift.giftedBy,
              recipe_id: created.recipe?.id
            });
          } catch (e) {
            console.error(`Error processing RECIPE_GIFT for ${gift.name}:`, e.message);
          }
        }
      }
    } catch (e) {
      console.error('Error processing weather/survival/crafting markers:', e);
    }

    // ---- MYTHIC PROGRESSION MARKERS ----
    let mythicEvents = [];
    try {
      const character = await dbGet('SELECT id, campaign_id, game_day, has_mythic FROM characters WHERE id = ?', [session.character_id]);

      // Mythic trial detection
      const mythicTrial = detectMythicTrial(result.narrative);
      if (mythicTrial && character) {
        try {
          const trialResult = await recordTrial(character.id, character.campaign_id, {
            name: mythicTrial.name,
            description: mythicTrial.description,
            outcome: mythicTrial.outcome,
            gameDay: character.game_day,
            sessionId: session.id
          });
          mythicEvents.push({ type: 'trial', ...mythicTrial, ...trialResult });

          // Auto-advance tier if trials completed
          if (trialResult.canAdvance) {
            try {
              const advanceResult = await advanceTier(character.id, character.game_day);
              mythicEvents.push({ type: 'tier_advance', newTier: advanceResult.tier, tierName: advanceResult.tierName });
            } catch (advErr) {
              console.error('Error auto-advancing mythic tier:', advErr.message);
            }
          }
        } catch (e) {
          console.error('Error recording mythic trial:', e.message);
        }
      }

      // Piety changes
      const pietyChanges = detectPietyChange(result.narrative);
      for (const change of pietyChanges) {
        try {
          const pietyResult = await adjustPiety(
            session.character_id, change.deity, change.amount,
            change.reason, character?.game_day, session.id
          );
          mythicEvents.push({ type: 'piety', deity: change.deity, ...pietyResult });
        } catch (e) {
          console.error(`Error adjusting piety for ${change.deity}:`, e.message);
        }
      }

      // Legendary item state changes
      const itemAwaken = detectItemAwaken(result.narrative);
      if (itemAwaken && character) {
        try {
          const legendaryItem = await findLegendaryItemByName(character.id, itemAwaken.item);
          if (legendaryItem) {
            const advancedItem = await advanceItemState(legendaryItem.id, itemAwaken.newState, itemAwaken.deed, character.game_day);
            mythicEvents.push({ type: 'item_awaken', item: itemAwaken.item, newState: itemAwaken.newState });
          }
        } catch (e) {
          console.error('Error advancing legendary item:', e.message);
        }
      }

      // Mythic power usage tracking
      const mythicSurge = detectMythicSurge(result.narrative);
      if (mythicSurge && character?.has_mythic) {
        try {
          await useMythicPower(character.id, mythicSurge.cost);
          mythicEvents.push({ type: 'surge', ability: mythicSurge.ability, cost: mythicSurge.cost });
        } catch (e) {
          console.error('Error tracking mythic power usage:', e.message);
        }
      }
    } catch (e) {
      console.error('Error processing mythic markers:', e);
    }

    // ---- PROMISE MARKERS ----
    let promiseEvents = [];
    try {
      const character = session.character_id
        ? await dbGet('SELECT id, campaign_id, game_day FROM characters WHERE id = ?', [session.character_id])
        : null;

      // Promise made detection
      const promisesMade = detectPromiseMade(result.narrative);
      for (const pm of promisesMade) {
        try {
          // NPCs are campaign-global (no campaign_id column), so we match by
          // name only. Rare collision risk across campaigns is acceptable for
          // a solo game.
          const npc = await dbGet(
            'SELECT id, name FROM npcs WHERE LOWER(name) = LOWER(?) LIMIT 1',
            [pm.npc]
          );
          if (npc && character) {
            const deadlineGameDay = pm.deadline > 0 ? (character.game_day || 0) + pm.deadline : null;
            await addPromise(character.id, npc.id, pm.promise, {
              gameDay: character.game_day || null,
              deadlineGameDay,
              weight: pm.weight || 'moderate'
            });
            promiseEvents.push({ type: 'promise_made', npc: pm.npc, promise: pm.promise, deadline: pm.deadline, weight: pm.weight });

            // Also create canon fact
            await dbRun(`
              INSERT INTO canon_facts (campaign_id, character_id, category, subject, fact, game_day, importance, is_active, tags)
              VALUES (?, ?, 'promise', ?, ?, ?, 'major', 1, '["promise_made"]')
            `, [
              character.campaign_id, character.id,
              npc.name,
              `Promised ${npc.name} (${pm.weight}): "${pm.promise}"${pm.deadline > 0 ? ` (due in ${pm.deadline} days)` : ''}`,
              character.game_day || 0
            ]);
          }
        } catch (e) {
          console.error(`Error processing PROMISE_MADE for ${pm.npc}:`, e.message);
        }
      }

      // Promise fulfilled detection
      const promisesFulfilled = detectPromiseFulfilled(result.narrative);
      for (const pf of promisesFulfilled) {
        try {
          const npc = await dbGet(
            'SELECT id, name FROM npcs WHERE LOWER(name) = LOWER(?) LIMIT 1',
            [pf.npc]
          );
          if (npc && character) {
            // Find matching pending promise by text similarity
            const pending = await getPendingPromises(character.id);
            const match = pending.find(p =>
              p.npc_id === npc.id &&
              (p.promise || '').toLowerCase().includes(pf.promise.toLowerCase().substring(0, 20))
            );
            if (match) {
              const { weight } = await fulfillPromise(character.id, npc.id, match.promise_index);

              // Apply weight-based rewards
              const fw = FULFILL_WEIGHTS[weight] || FULFILL_WEIGHTS.moderate;
              await adjustNpcDisposition(character.id, npc.id, fw.directDisposition, `Fulfilled a promise (${weight})`);
              await adjustNpcTrust(character.id, npc.id, fw.directTrust);

              // Reputation ripple — nearby NPCs hear about the kept promise
              const rippleResults = await spreadReputationRipple(character.campaign_id, character.id, npc.id, weight, false);
              // Faction standing boost
              const factionResults = await spreadFactionStanding(character.id, character.campaign_id, npc.id, weight, false);

              promiseEvents.push({
                type: 'promise_fulfilled', npc: pf.npc, promise: pf.promise, weight,
                dispositionChange: fw.directDisposition, trustChange: fw.directTrust,
                rippleCount: rippleResults.length, factionChanges: factionResults.length
              });

              // Create canon fact
              await dbRun(`
                INSERT INTO canon_facts (campaign_id, character_id, category, subject, fact, game_day, importance, is_active, tags)
                VALUES (?, ?, 'promise', ?, ?, ?, 'major', 1, '["promise_fulfilled"]')
              `, [
                character.campaign_id, character.id,
                npc.name,
                `Fulfilled ${weight} promise to ${npc.name}: "${pf.promise}"`,
                character.game_day || 0
              ]);
            }
          }
        } catch (e) {
          console.error(`Error processing PROMISE_FULFILLED for ${pf.npc}:`, e.message);
        }
      }
    } catch (e) {
      console.error('Error processing promise markers:', e);
    }

    // Notoriety gain/loss detection
    const notorietyEvents = [];
    try {
      const character = session.character_id
        ? await dbGet('SELECT id, campaign_id, game_day FROM characters WHERE id = ?', [session.character_id])
        : null;

      if (character) {
        const notorietyGains = detectNotorietyGain(result.narrative);
        for (const ng of notorietyGains) {
          try {
            await addNotorietyScore(character.id, character.campaign_id, {
              source: ng.source,
              amount: ng.amount,
              category: ng.category,
              reason: `Session event (game day ${character.game_day || 0})`
            });
            notorietyEvents.push({ type: 'notoriety_gain', ...ng });
          } catch (e) {
            console.error(`Error processing NOTORIETY_GAIN for ${ng.source}:`, e.message);
          }
        }

        const notorietyLosses = detectNotorietyLoss(result.narrative);
        for (const nl of notorietyLosses) {
          try {
            await addNotorietyScore(character.id, character.campaign_id, {
              source: nl.source,
              amount: -nl.amount,
              category: 'criminal',
              reason: `Cleared name (game day ${character.game_day || 0})`
            });
            notorietyEvents.push({ type: 'notoriety_loss', ...nl });
          } catch (e) {
            console.error(`Error processing NOTORIETY_LOSS for ${nl.source}:`, e.message);
          }
        }
      }
    } catch (e) {
      console.error('Error processing notoriety markers:', e);
    }

    // Pillar 5: record distinctive imagery from this response so the next
    // prompt can tell the DM "don't reuse these." Strict on similes +
    // "X of Y" imagery; loose on functional language (see
    // repetitionLedgerService for extraction heuristics). Fire-and-forget.
    try {
      const { captureFromResponse } = await import('../services/repetitionLedgerService.js');
      captureFromResponse(sessionId, cleanNarrative).catch(() => {});
    } catch (err) {
      // Silent-fail — repetition ledger is a polish feature.
    }

    // Rolling session summary (Follow-up #3). After the AI response is saved,
    // if the session has grown past the roll threshold, kick off a background
    // summarization of the next oldest chunk. Fire-and-forget — the player
    // never waits on this. The result lands on dm_sessions.rolling_summary
    // and is applied by the NEXT turn's prompt assembly.
    try {
      const { shouldRoll, rollSummary } = await import('../services/rollingSummaryService.js');
      // Re-read the session so we have the latest rolling_summary_through_index
      const freshSession = await dbGet('SELECT * FROM dm_sessions WHERE id = ?', [sessionId]);
      if (freshSession && shouldRoll(freshSession, result.messages)) {
        rollSummary(parseInt(sessionId), freshSession, result.messages).catch(err => {
          console.warn(`[rolling-summary] background roll failed: ${err.message}`);
        });
      }
    } catch (err) {
      // Silent-fail — rolling summary is a polish feature.
    }

    res.json({
      narrative: cleanNarrative,
      messageCount: result.messages.length,
      recruitment: recruitmentData,
      downtime: downtimeDetected,
      merchantShop: merchantShop,
      lootDrops: lootDropResults.length > 0 ? lootDropResults : undefined,
      combatStart: combatStart || undefined,
      combatEnd: combatEnd || undefined,
      conditionChanges: hasConditionChanges ? conditionChanges : undefined,
      weatherChange: weatherChangeResult || undefined,
      survivalEvents: survivalEvents.length > 0 ? survivalEvents : undefined,
      craftingEvents: craftingEvents.length > 0 ? craftingEvents : undefined,
      mythicEvents: mythicEvents.length > 0 ? mythicEvents : undefined,
      promiseEvents: promiseEvents.length > 0 ? promiseEvents : undefined,
      notorietyEvents: notorietyEvents.length > 0 ? notorietyEvents : undefined
    });
  } catch (error) {
    // Anthropic 529 — surface as 503 with a clear retryable message.
    // Player input is preserved client-side; manual retry works once the
    // API recovers.
    if (error?.message?.startsWith('OVERLOADED:')) {
      return res.status(503).json({
        error: 'AI temporarily overloaded',
        message: 'Anthropic\'s API is temporarily at capacity. Your input has been preserved — please send again in a moment.',
        retryable: true
      });
    }
    handleServerError(res, error, 'process DM session message');
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
    handleServerError(res, error, 'look up item rarity');
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

    // Calculate reputation-based price modifier (disposition + faction standing).
    // NPCs are campaign-global (no campaign_id column on npcs), so we do an
    // exact-name match first for accuracy, falling back to prefix match if
    // nothing hits. The campaign_id is still passed into calculatePriceModifier
    // to scope faction lookups (factions ARE campaign-scoped).
    let priceModifier = null;
    try {
      let merchantNpc = await dbGet(
        'SELECT id FROM npcs WHERE LOWER(name) = LOWER(?) LIMIT 1',
        [merchantName]
      );
      if (!merchantNpc) {
        merchantNpc = await dbGet(
          'SELECT id FROM npcs WHERE LOWER(name) LIKE LOWER(?) LIMIT 1',
          [`${merchantName}%`]
        );
      }
      if (merchantNpc) {
        priceModifier = await calculatePriceModifier(session.character_id, character.campaign_id, merchantNpc.id);
      }
    } catch (e) {
      console.warn('Price modifier calculation failed:', e.message);
    }

    // Calculate economy modifiers (world events + region + merchant memory)
    let economyModifiers = null;
    try {
      economyModifiers = await calculateEconomyModifiers(
        character.campaign_id, dbMerchant.id, dbMerchant.location, session.character_id
      );
    } catch (e) {
      console.warn('Economy modifier calculation failed:', e.message);
    }

    // Apply both modifiers per-item: reputation (uniform) × economy (per-category) × loyalty
    const reputationMult = priceModifier?.multiplier || 1;
    const loyaltyDiscount = economyModifiers?.loyaltyDiscount || 0;

    const inventory = dbMerchant.inventory.map(item => {
      const economyMult = economyModifiers
        ? getItemEconomyMultiplier(item.category, economyModifiers)
        : 1;
      const combinedMult = Math.max(0.50, Math.min(2.00,
        reputationMult * economyMult * (1 - loyaltyDiscount)
      ));
      const modified = Math.round(combinedMult * 100) !== 100;
      return {
        ...item,
        ...(modified ? {
          base_price_gp: item.price_gp,
          price_gp: Math.round(item.price_gp * combinedMult * 100) / 100,
          base_price_sp: item.price_sp,
          price_sp: Math.round((item.price_sp || 0) * combinedMult),
          base_price_cp: item.price_cp,
          price_cp: Math.round((item.price_cp || 0) * combinedMult)
        } : {})
      };
    });

    res.json({
      inventory,
      buybackItems,
      priceModifier: priceModifier || undefined,
      economyModifiers: economyModifiers ? {
        activeEffects: economyModifiers.eventEffects.activeEffects,
        appliedRegions: economyModifiers.regionalModifiers.appliedRegions,
        loyaltyDiscount: economyModifiers.loyaltyDiscount,
        visitCount: economyModifiers.merchantMemory.visitCount
      } : undefined,
      merchantName: dbMerchant.merchant_name,
      merchantType: dbMerchant.merchant_type,
      merchantId: dbMerchant.id,
      personality: dbMerchant.personality,
      merchantGold: dbMerchant.gold_gp
    });
  } catch (error) {
    handleServerError(res, error, 'load merchant inventory');
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
    handleServerError(res, error, 'list merchants');
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
    handleServerError(res, error, 'restock merchant');
  }
});

// Process merchant transaction (atomic — character + merchant updates succeed
// or fail together via db.transaction('write')).
router.post('/:sessionId/merchant-transaction', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { merchantName, merchantId, bought, sold, haggleDiscountPercent } = req.body;

    // ---- Input validation (prevents negative/NaN sneaking into totals) ----
    const validateItems = (items, label) => {
      if (!Array.isArray(items)) return null;
      for (const item of items) {
        if (!item || typeof item.name !== 'string' || !item.name.trim()) {
          return `${label}: each item must have a string name`;
        }
        const q = Number(item.quantity);
        if (!Number.isInteger(q) || q < 1) {
          return `${label}: "${item.name}" quantity must be a positive integer (got ${item.quantity})`;
        }
        for (const k of ['price_gp', 'price_sp', 'price_cp']) {
          const p = Number(item[k]);
          if (item[k] !== undefined && (Number.isNaN(p) || p < 0)) {
            return `${label}: "${item.name}" ${k} must be a non-negative number`;
          }
        }
      }
      return null;
    };
    const bErr = validateItems(bought, 'bought');
    if (bErr) return res.status(400).json({ error: bErr });
    const sErr = validateItems(sold, 'sold');
    if (sErr) return res.status(400).json({ error: sErr });

    const session = await dbGet('SELECT * FROM dm_sessions WHERE id = ?', [sessionId]);
    if (!session) return res.status(404).json({ error: 'Session not found' });

    const character = await dbGet('SELECT * FROM characters WHERE id = ?', [session.character_id]);
    if (!character) return res.status(404).json({ error: 'Character not found' });

    let inventory = safeParse(character.inventory, []);
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

    // Apply bulk discount for large purchases
    const totalBuyQty = (bought || []).reduce((sum, i) => sum + (i.quantity || 1), 0);
    const bulkDiscount = getBulkDiscount(totalBuyQty);
    if (bulkDiscount > 0) {
      totalSpentCp = Math.round(totalSpentCp * (1 - bulkDiscount));
    }

    // M3: Apply haggle discount. Clamped to [0, 20] server-side.
    const haggleDiscount = Math.max(0, Math.min(20, Number(haggleDiscountPercent) || 0)) / 100;
    if (haggleDiscount > 0 && totalSpentCp > 0) {
      totalSpentCp = Math.round(totalSpentCp * (1 - haggleDiscount));
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

    // Precompute merchant-side mutations (no DB writes yet)
    let merchantWrite = null;
    if (merchantId) {
      const merchant = await dbGet('SELECT * FROM merchant_inventories WHERE id = ?', [merchantId]);
      if (merchant) {
        let merchInv = safeParse(merchant.inventory, []);
        for (const item of (bought || [])) {
          const idx = merchInv.findIndex(i => i.name.toLowerCase() === item.name.toLowerCase());
          if (idx !== -1) {
            merchInv[idx].quantity = (merchInv[idx].quantity || 1) - item.quantity;
            if (merchInv[idx].quantity <= 0) merchInv.splice(idx, 1);
          }
        }
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
        const originalMerchGold = merchant.gold_gp || 0;
        const newMerchGold = originalMerchGold - Math.floor(totalEarnedCp / 100) + Math.floor(totalSpentCp / 100);
        merchantWrite = {
          id: merchantId,
          inventoryJson: JSON.stringify(merchInv),
          newGold: newMerchGold,
          expectedVersion: merchant.inventory_version || 0
        };
      }
    }

    // ---- Atomic write: character + merchant in one transaction ----
    // Either both land or neither does. If the merchant's optimistic-lock
    // version check fails inside the tx, the whole thing rolls back and the
    // character's gold is NOT deducted.
    const tx = await db.transaction('write');
    try {
      await tx.execute({
        sql: `UPDATE characters
              SET inventory = ?, gold_gp = ?, gold_sp = ?, gold_cp = ?, updated_at = CURRENT_TIMESTAMP
              WHERE id = ?`,
        args: [JSON.stringify(inventory), newGp, newSp, newCp, character.id]
      });

      if (merchantWrite) {
        const r = await tx.execute({
          sql: `UPDATE merchant_inventories
                SET inventory = ?, gold_gp = ?, inventory_version = inventory_version + 1,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ? AND inventory_version = ?`,
          args: [
            merchantWrite.inventoryJson, merchantWrite.newGold,
            merchantWrite.id, merchantWrite.expectedVersion
          ]
        });
        if (r.rowsAffected === 0) {
          throw new Error('Transaction conflict: merchant inventory changed concurrently');
        }
      }

      await tx.commit();
    } catch (txErr) {
      try { await tx.rollback(); } catch (_) { /* ignore rollback failure */ }
      if (String(txErr.message).includes('Transaction conflict')) {
        return res.status(409).json({ error: txErr.message });
      }
      throw txErr;
    }

    // Reputation: prefer merchant's linked NPC id; fall back to scoped lookup
    // by campaign_id + exact name (NOT the fuzzy LIKE that could match the
    // wrong NPC when multiple similar names exist in one campaign).
    let reputationChange = null;
    try {
      let merchantNpc = null;
      if (merchantId) {
        const m = await dbGet(
          'SELECT campaign_id, merchant_name FROM merchant_inventories WHERE id = ?',
          [merchantId]
        );
        if (m?.campaign_id) {
          // Try exact match first (case-insensitive)
          merchantNpc = await dbGet(
            'SELECT id, name FROM npcs WHERE LOWER(name) = LOWER(?) LIMIT 1',
            [m.merchant_name]
          );
          // Fall back to narrow prefix match scoped to the merchant's name
          if (!merchantNpc) {
            merchantNpc = await dbGet(
              'SELECT id, name FROM npcs WHERE LOWER(name) LIKE LOWER(?) LIMIT 1',
              [`${m.merchant_name}%`]
            );
          }
        }
      }
      if (merchantNpc) {
        const { adjustDisposition } = await import('../services/npcRelationshipService.js');
        const change = Math.min(10, Math.max(2, Math.floor(totalSpentCp / 1000) + 2));
        await adjustDisposition(session.character_id, merchantNpc.id, change, `Traded with ${merchantNpc.name}`);
        reputationChange = { npcName: merchantNpc.name, change };
      }
    } catch (repErr) {
      console.warn('Reputation update failed:', repErr.message);
    }

    // Record transaction in merchant memory for loyalty/economy tracking.
    // M4: pass totals so the relationship panel can surface lifetime spent/earned.
    if (merchantId) {
      try {
        await recordTransaction(
          merchantId, session.character_id, bought, sold, character.game_day,
          { total_spent_cp: totalSpentCp, total_earned_cp: totalEarnedCp }
        );
      } catch (e) {
        console.warn('Recording transaction history failed:', e.message);
      }
    }

    res.json({
      success: true,
      changes,
      newInventory: inventory,
      newGold: { gp: newGp, sp: newSp, cp: newCp },
      totalSpent: { gp: Math.floor(totalSpentCp / 100), sp: Math.floor((totalSpentCp % 100) / 10), cp: totalSpentCp % 10 },
      totalEarned: { gp: Math.floor(totalEarnedCp / 100), sp: Math.floor((totalEarnedCp % 100) / 10), cp: totalEarnedCp % 10 },
      bulkDiscount: bulkDiscount > 0 ? Math.round(bulkDiscount * 100) : undefined,
      reputationChange
    });
  } catch (error) {
    if (error.message?.includes('Transaction conflict')) {
      console.warn('Merchant transaction conflict:', error.message);
      return res.status(409).json({ error: error.message });
    }
    handleServerError(res, error, 'process merchant transaction');
  }
});

// Adjust the game date during a session
router.post('/:sessionId/adjust-date', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { daysToAdd } = req.body;

    if (typeof daysToAdd !== 'number' || !Number.isFinite(daysToAdd)) {
      return res.status(400).json({ error: 'daysToAdd must be a finite number' });
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

    // Also advance the character's game_day so downstream systems
    // (weather, survival, companion moods, base threats) see the new
    // date. Only advance forward — going backwards is a narrative
    // flashback, not a real time skip.
    let tickResult = null;
    if (daysToAdd > 0 && session.character_id) {
      const character = await dbGet(
        'SELECT id, campaign_id, game_day FROM characters WHERE id = ?',
        [session.character_id]
      );
      if (character) {
        const newGameDay = (character.game_day || 1) + daysToAdd;
        await dbRun(
          'UPDATE characters SET game_day = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          [newGameDay, character.id]
        );
        // Fire a living-world tick for the elapsed days so weather,
        // moods, merchant orders, base threats, etc. advance too.
        // Best-effort: a tick failure shouldn't block the date change.
        if (character.campaign_id) {
          try {
            tickResult = await processLivingWorldTick(character.campaign_id, daysToAdd);
          } catch (e) {
            console.warn('adjust-date: living-world tick failed:', e.message);
          }
        }
      }
    }

    // Return the formatted date
    const gameDate = dayToDate(newDate.day, newDate.year);

    res.json({
      success: true,
      gameDate,
      day: newDate.day,
      year: newDate.year,
      tickResult
    });
  } catch (error) {
    handleServerError(res, error, 'adjust game date');
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

    const messages = safeParse(session.messages, []);
    // Inject as a user message with a [SYSTEM NOTE] prefix so the AI treats it as context
    messages.push({ role: 'user', content: `[SYSTEM NOTE - DO NOT RESPOND TO THIS, just incorporate it into your awareness]: ${message}` });

    await dbRun('UPDATE dm_sessions SET messages = ? WHERE id = ?', [JSON.stringify(messages), sessionId]);

    res.json({ success: true });
  } catch (error) {
    handleServerError(res, error, 'inject context');
  }
});

// Generate a context-aware rest narrative using AI
router.post('/:sessionId/rest-narrative', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { restType, characterName, mechanicalResult } = req.body;

    if (!restType || !characterName) {
      return res.status(400).json({ error: 'restType and characterName are required' });
    }

    const session = await dbGet('SELECT * FROM dm_sessions WHERE id = ?', [sessionId]);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const messages = safeParse(session.messages, []);

    // Get the last 10 non-system messages for context
    const recentMessages = messages
      .filter(m => m.role !== 'system')
      .slice(-10);

    const restPrompt = `You are a D&D dungeon master. ${characterName} takes a ${restType} rest. Write a brief atmospheric rest description (2-3 sentences) based on the current location and recent events. Do NOT include any dialogue for ${characterName} — only describe the scene, atmosphere, and the passage of time. Do NOT include mechanical effects (HP restored, spell slots, etc.) — those are handled separately. Keep it immersive and contextual.${mechanicalResult ? `\n\nMechanical result (for your awareness only, do NOT repeat this): ${mechanicalResult}` : ''}`;

    // Try to get AI narrative
    const { provider } = await getLLMProvider();
    let narrative = null;

    if (provider === 'claude') {
      try {
        const result = await claude.chat(restPrompt, recentMessages, 1, 'sonnet', 200);
        narrative = result;
      } catch (err) {
        console.error('Rest narrative AI error (Claude):', err.message);
      }
    } else if (provider === 'ollama') {
      try {
        const ollamaMessages = [
          { role: 'system', content: restPrompt },
          ...recentMessages,
          { role: 'user', content: `*${characterName} takes a ${restType} rest*` }
        ];
        const result = await ollama.continueSession(ollamaMessages, `*${characterName} takes a ${restType} rest*`, session.model);
        narrative = result?.narrative;
      } catch (err) {
        console.error('Rest narrative AI error (Ollama):', err.message);
      }
    }

    // Append rest messages to session history so AI remembers the rest happened
    if (narrative) {
      messages.push({ role: 'user', content: `*Takes a ${restType} rest*` });
      messages.push({ role: 'assistant', content: narrative });
      await dbRun('UPDATE dm_sessions SET messages = ? WHERE id = ?', [JSON.stringify(messages), sessionId]);
    }

    res.json({ narrative });
  } catch (error) {
    handleServerError(res, error, 'generate rest narrative');
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

    const messages = safeParse(session.messages, []);
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

    const inventory = safeParse(character.inventory, []);
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

    // Generate story chronicle (structured session summary + canon facts)
    try {
      const chronicleResult = await generateSessionChronicle(parseInt(sessionId));
      if (chronicleResult) {
        console.log(`Story chronicle generated: session #${chronicleResult.sessionNumber}, ${chronicleResult.factsExtracted} facts extracted`);
      }
    } catch (e) {
      console.error('Error generating story chronicle:', e);
    }

    // (Old prelude completion hook removed in v1.0.44 — the origin-story
    // system is gone. The prelude-forward creator's transition is handled
    // by its own [PRELUDE_END] marker in Phase 5, not this code path.)

    // Update the session
    await dbRun(`
      UPDATE dm_sessions
      SET status = 'completed', summary = ?, rewards = ?, hp_change = ?,
          end_time = datetime('now'), game_end_day = ?, game_end_year = ?
      WHERE id = ?
    `, [summary, JSON.stringify(rewards), hpChange, newGameDate.day, newGameDate.year, sessionId]);

    // Playtest session-end summary — walks the FULL transcript (not the
    // possibly-compacted LLM-facing messages) so totals reflect the whole
    // session, not just the post-compaction tail. Falls back to messages
    // for sessions that pre-date the transcript column.
    try {
      let walkable;
      try {
        const tr = await getTranscript(parseInt(sessionId));
        walkable = tr.length > 0 ? tr : messages;
      } catch {
        walkable = messages;
      }
      const allTurns = walkable.filter(m => m.role === 'assistant');
      const totals = {
        markers_emitted: 0,
        markers_malformed: 0,
        rule_violations: 0,
        corrections_queued: 0,
        corrections_consumed: 0
      };
      for (const turn of allTurns) {
        const text = typeof turn.content === 'string' ? turn.content : '';
        const { failures, validByKey } = validateDmMarkers(text);
        const validCount = Object.values(validByKey).reduce((s, a) => s + a.length, 0);
        const { violations } = verifyDmResponse(text);
        totals.markers_emitted += validCount + failures.length;
        totals.markers_malformed += failures.length;
        totals.rule_violations += violations.length;
        if (failures.length + violations.length > 0) totals.corrections_queued += 1;
      }
      // corrections_consumed — count turns where a previous turn had emitted a
      // correction-worthy issue and the next turn was clean. Approximation: if
      // turn N was malformed and turn N+1 was clean, count as consumed.
      for (let i = 0; i < allTurns.length - 1; i++) {
        const a = typeof allTurns[i].content === 'string' ? allTurns[i].content : '';
        const b = typeof allTurns[i+1].content === 'string' ? allTurns[i+1].content : '';
        const aHadIssue = validateDmMarkers(a).failures.length + verifyDmResponse(a).violations.length > 0;
        const bClean = validateDmMarkers(b).failures.length + verifyDmResponse(b).violations.length === 0;
        if (aHadIssue && bClean) totals.corrections_consumed += 1;
      }
      const firstSystemTurn = messages.find(m => m.role === 'system');
      const firstPromptChars = firstSystemTurn?.content?.length;
      playtestLogSessionEnd({
        sessionId: parseInt(sessionId),
        sessionType: 'dm',
        characterName: character?.nickname || character?.name || null,
        totalTurns: allTurns.length,
        startTimestamp: session.start_time,
        totals,
        firstPromptChars,
        lastPromptChars: firstPromptChars,  // system prompt is sticky for DM sessions
        notes: [`Reward summary: ${summary?.slice(0, 80) || '(none)'}…`]
      });
    } catch (logErr) {
      console.error('[playtest] session-end summary failed (non-fatal):', logErr.message);
    }

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
    handleServerError(res, error, 'end DM session');
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

    let inventory = safeParse(character.inventory, []);
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
    handleServerError(res, error, 'apply inventory changes');
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
      pendingNarratives = safeParse(character.pending_downtime_narratives, []);
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

    let messages = safeParse(session.messages, []);

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
    handleServerError(res, error, 'resume session');
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
    handleServerError(res, error, 'pause session');
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
    handleServerError(res, error, 'abort session');
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
    const rewards = safeParse(session.rewards, {});

    // Apply rewards to character
    const updates = {
      experience: character.experience + (rewards.xp || 0),
      gold_cp: character.gold_cp + (rewards.gold?.cp || 0),
      gold_sp: character.gold_sp + (rewards.gold?.sp || 0),
      gold_gp: character.gold_gp + (rewards.gold?.gp || 0),
      current_hp: Math.max(1, Math.min(character.max_hp, character.current_hp + (session.hp_change || 0)))
    };

    // Add loot to inventory
    let inventory = safeParse(character.inventory, []);
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
    handleServerError(res, error, 'claim session rewards');
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
    handleServerError(res, error, 'delete session');
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
    handleServerError(res, error, 'clear session history');
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

    const messages = safeParse(session.messages, []);
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
    handleServerError(res, error, 'extract NPCs from session');
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
        const messages = safeParse(fullSession.messages, []);

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
    handleServerError(res, error, 'extract NPCs from all sessions');
  }
});

export { pickSeasonalStartDay };
export default router;
