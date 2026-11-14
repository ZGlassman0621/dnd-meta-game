import express from 'express';
import db, { dbAll, dbGet, dbRun } from '../database.js';
import { FEATURE_FLAGS } from '../config/featureFlags.js';
import llm from '../services/llm.js';
import { modelFor } from '../services/localModels.js';
import { wrapLlmCallWithId, annotateAiCallLog, loggedChat, pruneAiCallLog } from '../services/aiCallLogger.js';
import { dayToDate, advanceTime, getSeason, getTimeOfDay } from '../config/harptos.js';
import { XP_THRESHOLDS, getSpellSlots } from '../config/levelProgression.js';
import { formatThreadsForAI } from '../services/storyThreads.js';
import { getNarrativeContextForSession, markNarrativeItemsDelivered, onDMSessionStarted } from '../services/narrativeIntegration.js';
import { getPlanSummaryForSession } from '../services/campaignPlanService.js';
import { getCharacterWorldView, processLivingWorldTick, queueTickHighlights } from '../services/livingWorldService.js';
import { getActiveFactions } from '../services/factionService.js';
// SC-6.4c: addPromise / fulfillPromise / getPendingPromises /
// adjustDisposition / adjustTrust no longer imported — PROMISE_MADE +
// PROMISE_FULFILLED handlers in consequenceService.js own those calls.
import { getCharacterRelationshipsWithNpcs, getConversationsForCharacter } from '../services/npcRelationshipService.js';
import { ensureComplexityTier, ensureAgendaContent } from '../services/npcComplexityService.js';
import { dealSessionNpcs } from '../services/npcBankService.js';
import { dealAvailableNames } from '../services/xanatharNameService.js';
import { assignWorldId } from '../services/worldIdService.js';
import { ensureNpcProfession } from '../services/npcProfessionService.js';
import { getDiscoveredLocations } from '../services/locationService.js';
import { getEventsVisibleToCharacter } from '../services/worldEventService.js';
import { getMerchantInventory, getMerchantsByCampaign, restockMerchant, updateMerchantAfterTransaction, generateBuybackPrices, createMerchantOnTheFly } from '../services/merchantService.js';
// SC-6.4b: merchantOrderService loaded for module-level
// registerMarkerHandler('MERCHANT_COMMISSION', ...). Direct placeCommission
// + addItemToMerchant + ensureItemAtMerchant imports no longer needed —
// handlers in merchantService.js / merchantOrderService.js own the calls.
import '../services/merchantOrderService.js';
// SC-6.4b: lootDropService is new — registers the LOOT_DROP handler at
// module load.
import '../services/lootDropService.js';
// Loot wiring (R-02): magicItemDiscoveryService registers the
// ITEM_REVEAL_ONE / ITEM_IDENTIFY handlers at module load.
import '../services/magicItemDiscoveryService.js';
// SC-6.4d: recordPlayerDefenseOutcome no longer imported — BASE_DEFENSE_RESULT
// handler in baseThreatService.js owns the call. Loading the module fires
// the module-level registerMarkerHandler registration.
import '../services/baseThreatService.js';
// SC-6.4d: combatMarkerService is new — registers COMBAT_START + COMBAT_END
// handlers at module load.
import '../services/combatMarkerService.js';
// Display casting (combined build with combat item 8): displayService
// registers the DISPLAY + ENEMY_DISPLAY handlers at module load.
import '../services/displayService.js';
// Lair durability (migration 099): lairDurabilityService registers the
// LAIR_CREATE / LAIR_DAMAGE / LAIR_STABILIZE / LAIR_HAZARD_ROLL handlers
// at module load. Imported for its side effect, like the services above —
// without this import the markers silently never run.
import '../services/lairDurabilityService.js';
// Scene layer wiring: sceneLinkService registers the SET_ROOM handler
// at module load. Imported for its side effect, like the services above —
// without this import the marker silently never runs.
import '../services/sceneLinkService.js';
// Dungeon generation wiring: dungeonGenerationService registers the
// GENERATE_DUNGEON handler at module load. Imported for its side effect,
// like the services above — without this import the marker silently
// never runs.
import '../services/dungeonGenerationService.js';
// Time-evolution engine: timeEvolutionService registers the
// EVOLVE_PLACE handler at module load. Imported for its side effect,
// like the services above — without this import the marker silently
// never runs.
import '../services/timeEvolutionService.js';
  // Family 8 — subclass markers (mechanics-hooks): registers the
  // BEND_LUCK / TIDES_OF_CHAOS / PRESERVE_LIFE / TAMED_SURGE /
  // TELEPATHIC_SPEECH / AWAKENED_MIND / HOUND_OF_ILL_OMEN /
  // ACCURSED_SPECTER / FAITHFUL_SUMMONS handlers at module load.
  // Imported for its side effect, like the services above — without
  // this import the markers validate but silently never run.
  // ATTUNE / UNATTUNE schemas exist in markerSchemas.js, but their
  // handlers live in attunementService.js (attunement family) — see
  // HANDOFF.md; do NOT import that file here until it lands.
import '../services/subclassMarkerService.js';
// General magic-item attunement (mechanics-hooks D10): attunementService
// registers the ATTUNE / UNATTUNE handlers at module load. Imported for
// its side effect, like the services above — without this import the
// markers silently never run.
import '../services/attunementService.js';
// Phase 3.1: characterHpService registers the HP_CHANGE handler on the player
// path at module load. Imported for its side effect, like the services above —
// without this import damage silently never applies.
import '../services/characterHpService.js';
import { getHpState, rollDeathSave } from '../services/characterHpService.js';
import { reconcileTurn } from '../services/fictionMarkerReconciliation.js';
// Structural #9: Fiction-marker reconciliation (strict both directions). Service
// file deployed separately; import here wires it into the turn pipeline.
import { getPendingSpellEffect, resolveReportedSpellEffect, formatSpellEffectBlock } from '../services/spellCastService.js';
// Combat Pipeline #3: SPELL_CAST handler registration.
// ROLL_REQUEST: non-combat check mechanics. The service registers its marker
// handler at module load; the named imports drive the pending-roll flow in
// the /message handler below.
import { getPendingRoll, resolveReportedRoll, formatRollOutcomeBlock } from '../services/rollRequestService.js';
// Perception pre-roll: importing the module registers the
// PERCEPTION_PREROLL / PERCEPTION_USE marker handlers (see
// markerPipeline.js — a handler service must be imported for
// side effect in this route or it silently never runs).
import { resolveBankRoll, formatPerceptionBankBlock, formatPerceptionUseBlock, formatActiveBankBlock } from '../services/perceptionPreRollService.js';
import { getPendingAttack, resolveReportedAttack, formatAttackOutcomeBlock } from '../services/partyAttackService.js';
import { getTurnState, advanceTurn } from '../services/combatTurnService.js';
import { formatTurnStateBlock } from '../services/turnLedgerService.js';
import { getCurrentEncounterSeq } from '../services/enemyCombatService.js';
// REST / TIME_ADVANCE: rest + clock mechanics. The service registers its
// marker handlers at module load; the named imports drive the next-turn
// time-event injection in /message and the measured session-end span.
import { formatTimeEventBlock, sessionEndDays } from '../services/restTimeService.js';
import { getPartyConditions } from '../services/conditionService.js';
import { ensureCompanionSheet } from '../services/companionSheetService.js';
import {
  parseNpcJoinMarker, detectDowntime, detectRecruitment,
  // SC-6.4d (v1.0.153) — combat / mythic / base defense detect-functions
  // (detectCombatStart / CombatEnd / BaseDefenseResult / MythicTrial /
  // ItemAwaken / MythicSurge) migrated to handlers in combatMarkerService.js,
  // mythicService.js, baseThreatService.js. Legacy exports stay per
  // "deprecate by hiding." estimateEnemyDexMod stays imported by
  // combatMarkerService.js (utility helper, PARK ENTIRELY per Q6 survey).
  // SC-6.4a (v1.0.150) — survival + crafting cluster detect-functions
  // migrated to markerPipeline handlers (survivalService.js,
  // weatherService.js, craftingService.js). Legacy exports stay.
  // SC-6.4b (v1.0.151) — merchant cluster detect-functions
  // (detectMerchantShop / MerchantRefer / AddItem / LootDrop /
  // MerchantCommission) migrated to handlers in merchantService.js,
  // merchantOrderService.js, lootDropService.js. Legacy exports stay.
  // SC-6.4c (v1.0.152) — promise + notoriety cluster detect-functions
  // (detectPromiseMade / PromiseFulfilled / NotorietyGain / NotorietyLoss)
  // migrated to handlers in consequenceService.js + notorietyService.js.
  // Legacy exports stay per "deprecate by hiding."
  buildAnalysisPrompt, parseAnalysisResponse,
  calculateHPChange,
  buildNotesExtractionPrompt, appendCampaignNotes,
  buildNpcExtractionPrompt, saveExtractedNpcs,
  buildMemoryExtractionPrompt, updateCharacterMemories,
  extractAndTrackUsedNames,
  emitSessionEvents, emitSessionEndedEvent
} from '../services/dmSessionService.js';
import { lookupItemByName } from '../data/merchantLootTables.js';
// SC-6.4b: getLootTableForLevel moved into lootDropService.js with the
// LOOT_DROP handler. No remaining usage in this file.
import { detectConditionChanges, formatConditionsForAI } from '../data/conditions.js';
// Phase 0 (clock unification): all clock reads/writes go through scheduleService.
import { advanceDays as advanceClockDays, setClockDate, getClock } from '../services/scheduleService.js';
import { safeParse } from '../utils/safeParse.js';
import { validateDmMarkers } from '../services/markerSchemas.js';
import { verifyDmResponse } from '../services/ruleVerifiers.js';
import { nextCorrectionEntries, renderCorrectionText } from '../services/markerCorrectionRetry.js';
import { processResponseMarkers } from '../services/markerPipeline.js';
import { logTurn as playtestLogTurn, logSessionEnd as playtestLogSessionEnd } from '../utils/playtestLogger.js';
import { initTranscript, appendToTranscript, getTurnCount, getTranscript } from '../utils/sessionTranscript.js';
import { generateSessionChronicle, getRelevantContext, getSessionSummariesForPrompt, getCampaignRollup, rollUpOldChronicles } from '../services/storyChronicleService.js';
import { getCharacterProgression } from '../services/progressionService.js';
import { resolveForNpcBatch as resolveNicknamesForNpcBatch } from '../services/nicknameService.js';
import { getCompanionProgression, ensureCompanionProgressionInitialized } from '../services/progressionCompanionService.js';
import { decayMoods } from '../services/companionBackstoryService.js';
import { syncDeathsFromCanonFacts } from '../services/npcLifecycleService.js';
import { getActiveNpcEffects } from '../services/worldEventNpcService.js';
import { getAwayCompanions } from '../services/companionActivityService.js';
import { endSession } from '../services/sessionEndService.js';
import { processAbsenceEffects } from '../services/npcAgingService.js';
import { shouldCompress, compressMessageHistory, estimateTokens, calculateChronicleBudget, sliceTailByTokens, MAX_NOTES_TOKENS, MAX_MEMORIES_TOKENS } from '../utils/contextManager.js';
import { handleServerError, conflict } from '../utils/errorHandler.js';
import { acquireSessionLock, releaseSessionLock } from '../utils/sessionLocks.js';
import { getWeather, getEffectiveTemperature, calculateGearWarmth, checkExposureEffects, hasShelter as checkHasShelter, formatWeatherForPrompt } from '../services/weatherService.js';
import { getSurvivalStatus, formatSurvivalForPrompt } from '../services/survivalService.js';
import { formatCraftingForPrompt } from '../services/craftingService.js';
// (Loading these services also fires their module-level
// registerMarkerHandler() calls — survival/weather/crafting handlers
// wire up at server boot regardless of import order.)
import { createDMSystemPrompt, formatMythicForPrompt, applyLeanTransforms, detectObservationVerbs, OBSERVATION_AS_CHECK_BLOCK, parsePlayerDiceInput, formatPlayerDiceDirective } from '../services/dmPromptBuilder.js';
// SC-6.4d: recordTrial / useMythicPower / advanceTier / findLegendaryItemByName /
// advanceItemState no longer imported — MYTHIC_TRIAL / ITEM_AWAKEN / MYTHIC_SURGE
// handlers in mythicService.js own the calls.
import { getMythicStatus } from '../services/mythicService.js';
import { getAllCharacterPiety, formatPietyForPrompt } from '../services/pietyService.js';
// (Loading pietyService here also fires its module-level
// registerMarkerHandler('PIETY_CHANGE', ...) — SC-4 wired the dispatch
// path through the marker pipeline; the old detect-function call site
// in this file was removed.)
// SC-6.4c: FULFILL_WEIGHTS / spreadReputationRipple / spreadFactionStanding
// no longer imported here — PROMISE_FULFILLED handler in consequenceService.js
// owns those calls. calculatePriceModifier is still used for the merchant
// price-modifier path (~line 1969) so it stays.
import { calculatePriceModifier } from '../services/consequenceService.js';
import { getActiveQuests as getCharacterActiveQuests } from '../services/questService.js';
import { calculateEconomyModifiers, getItemEconomyMultiplier, recordTransaction, getBulkDiscount } from '../services/economyService.js';
import { getBaseForPrompt } from '../services/partyBaseService.js';
// SC-6.4c: addNotoriety no longer imported — NOTORIETY_GAIN/LOSS handlers
// in notorietyService.js own the calls (loading the module fires the
// module-level registerMarkerHandler registrations).
import { getNotorietyForPrompt } from '../services/notorietyService.js';
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

// Local AI status: is Ollama reachable, and is every role's model installed?
// The game has one provider — the local model (localModels.js / llm.js).
router.get('/llm-status', async (req, res) => {
  try {
    const status = await llm.checkStatus();
    res.json(status);
  } catch (error) {
    handleServerError(res, error, 'check local AI status');
  }
});

// Installed Ollama models (for the settings display).
router.get('/models', async (req, res) => {
  try {
    const models = await llm.listModels();
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
        customConcepts: sessionConfig.customConcepts
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
    let {
      characterId,
      startingLocation,
      era,
      arrivalHook,
      customConcepts,
      campaignLength,
      customNpcs,
      bankDeals = [],  // optional array of { profession, location } — NPC-bank handoff
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
             n.skills as npc_skills, c.skill_proficiencies, c.archetype_key,
             n.avatar, n.personality_trait_1, n.personality_trait_2, n.voice, n.mannerism,
             n.motivation, n.background_notes, n.relationship_to_party,
             cb.mood as companion_mood, cb.mood_cause as companion_mood_cause,
             cb.mood_intensity as companion_mood_intensity,
             cb.loyalty as companion_loyalty,
             cb.loyalty_events as companion_loyalty_events
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
        // Real character sheet: backfill generated ability scores + skill
        // proficiencies for companions recruited before sheets existed
        // (or with the old flat-10 placeholder). Refresh the in-memory row
        // so THIS session's prompt renders the real sheet, not the stale one.
        const sheet = await ensureCompanionSheet(c.id);
        if (sheet?.generated) {
          c.companion_ability_scores = JSON.stringify(sheet.abilityScores);
          c.skill_proficiencies = JSON.stringify(sheet.skills);
          if (sheet.archetypeKey) c.archetype_key = sheet.archetypeKey;
        }
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

    // Xanathar names: deal a hand of unused bank names for new NPCs.
    // Best-effort: a failed deal never blocks session start.
    let availableNames = [];
    try {
      availableNames = await dealAvailableNames({ usedNames, dbAll });
    } catch (e) {
      console.error('[xanathar-names] deal failed:', e?.message || e);
      availableNames = [];
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
          currentGameDay: (await getClock(character.campaign_id ?? null)).dayOfYear,
          activeQuests: []
        };
      } catch (e) {
        console.error('Error gathering world state for session:', e);
      }
    }

    // P1-C: campaign_notes / character_memories grow without bound on disk.
    // Slice to the recent tail at render time so session-start prompt size
    // stays bounded no matter how long the campaign runs.
    const campaignNotes = sliceTailByTokens(character.campaign_notes || '', MAX_NOTES_TOKENS);
    const characterMemories = sliceTailByTokens(character.character_memories || '', MAX_MEMORIES_TOKENS);

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
        const estimatedPromptTokens = estimateTokens(JSON.stringify(worldState || '') + campaignNotes + characterMemories);
        const chronicleBudget = calculateChronicleBudget(estimatedPromptTokens, 0);

        const chronicleResult = await getRelevantContext(characterId, character.campaign_id, hints, chronicleBudget);
        chronicleContext = chronicleResult.context || '';
        if (chronicleResult.factsIncluded > 0) {
          console.log(`Story chronicle: ${chronicleResult.factsIncluded}/${chronicleResult.totalFacts} facts included (budget: ${chronicleBudget} tokens)`);
        }
      } catch (e) {
        console.error('Error fetching chronicle context:', e);
      }
    }

    // Sync any deaths from canon facts that weren't propagated to NPC lifecycle.
    // Deliberately still ON during the Phase 1.2 scale-back: this is a canon
    // reconciler, not world simulation. Disabling it would let an NPC the
    // chronicle records as dead reappear alive in the DM prompt.
    if (FEATURE_FLAGS.NPC_DEATH_SYNC && character.campaign_id) {
      try {
        await syncDeathsFromCanonFacts(character.campaign_id);
      } catch (e) {
        console.error('Error syncing deaths from canon facts:', e);
      }
    }

    // NPC-bank handoff: deal requested bank NPCs into this session's
    // known people, before the prompt is built. Best-effort: a failed
    // deal never blocks session start. Dealt rows join customNpcs, so
    // the backfill, prompt, sessionConfig, and selectedNpcIds below all
    // see them with no other route changes.
    if (Array.isArray(bankDeals) && bankDeals.length) {
      try {
        const handoff = await dealSessionNpcs({ bankDeals, existingNpcs: customNpcs || [] });
        if (Array.isArray(customNpcs)) {
          customNpcs.push(...handoff.npcs.filter((n) => !(customNpcs || []).some((e) => e && e.id === n.id)));
        } else {
          customNpcs = handoff.npcs;
        }
      } catch (e) {
        console.error('[npc-bank] handoff failed:', e?.message || e);
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
    //
    // Phase 1.2: each is gated independently so one can be re-enabled without
    // the other. Both off for MVP — with the living-world tick static, decaying
    // moods and dispositions here would be the only thing still moving.
    if (character.game_day) {
      const agingWork = [];
      if (FEATURE_FLAGS.COMPANION_MOOD_DECAY) {
        agingWork.push(
          decayMoods(characterId, character.game_day).catch(e => {
            console.error('Error decaying companion moods:', e);
          })
        );
      }
      if (FEATURE_FLAGS.NPC_AGING) {
        agingWork.push(
          processAbsenceEffects(characterId, character.game_day).catch(e => {
            console.error('Error processing NPC absence effects:', e);
          })
        );
      }
      if (agingWork.length > 0) await Promise.all(agingWork);
    }

    // Phase C — remaining independent reads. Also dedupes the weather fetch
    // (previously fetched twice — once for weatherContext, once for
    // survivalContext).
    const [
      weatherSnapshot,
      craftingContextResult,
      mythicStatusResult,
      pietyRowsResult,
      partyBaseContextResult,
      notorietyContextResult,
      projectsContextResult,
      chronicleSummariesResult,
      campaignRollupResult,
      progression,
      nicknameResolutionsResult
    ] = await Promise.all([
      campaignId
        ? getWeather(campaignId).catch(e => { console.error('Error fetching weather:', e); return null; })
        : Promise.resolve(null),
      campaignId
        ? formatCraftingForPrompt(characterId).catch(e => { console.error('Error formatting crafting:', e); return ''; })
        : Promise.resolve(''),
      getMythicStatus(characterId).catch(e => { console.error('Error fetching mythic:', e); return null; }),
      getAllCharacterPiety(characterId).catch(e => { console.error('Error fetching piety:', e); return []; }),
      getBaseForPrompt(characterId, campaignId).then(r => r || '').catch(e => { console.error('Error base:', e); return ''; }),
      getNotorietyForPrompt(characterId, campaignId).then(r => r || '').catch(e => { console.error('Error notoriety:', e); return ''; }),
      getProjectsForPrompt(characterId, campaignId).then(r => r || '').catch(e => { console.error('Error projects:', e); return ''; }),
      campaignId
        ? getSessionSummariesForPrompt(campaignId, characterId).catch(e => { console.error('Error chronicle summaries:', e); return []; })
        : Promise.resolve([]),
      // Phase 4 — the compressed half of campaign history. Pairs with the
      // verbatim chronicles above; see rollUpOldChronicles.
      campaignId
        ? getCampaignRollup(campaignId, characterId).catch(e => { console.error('Error chronicle rollup:', e); return null; })
        : Promise.resolve(null),
      getCharacterProgression(characterId).catch(e => { console.error('Error progression primary:', e); return null; }),
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
    const campaignRollup = campaignRollupResult;
    const nicknameResolutions = nicknameResolutionsResult;

    let mythicContext = '';
    if (mythicStatusResult && mythicStatusResult.tier > 0) {
      mythicContext = formatMythicForPrompt(mythicStatusResult, character);
    }
    // Piety prompt injection (Phase 3 SC-4 gap fix). Surfaces every
    // deity the character has piety with, regardless of mythic tier —
    // characters can earn piety pre-mythic. The formatter returns
    // empty string for an empty array; we wrap with the section
    // header only when there's content to inject.
    const pietyBody = formatPietyForPrompt(pietyRowsResult);
    const pietyContext = pietyBody
      ? `=== PIETY ===\n${pietyBody}\n\nReference unlocked piety abilities (3/10/25/50 thresholds) when relevant. The character's deity may answer prayers or send subtle signs at higher tiers.`
      : '';
    // ──────────── END PARALLEL CONTEXT ASSEMBLY ────────────

    // DM System Part 1 — backfill-on-appearance (Zach 2026-10-19): NPCs that
    // predate the complexity system get their tier rolled the next time they
    // appear — the SYSTEM rolls, never the AI. Covers this session's custom
    // NPCs plus active companions' NPC rows (companion agenda content
    // deferred at recruitment completes here). Agenda fields are merged into
    // the customNpc objects so buildAgendaPromptBlock can actually see them.
    // Best-effort throughout: nothing here may block session start.
    try {
      const agendaLlmCall = async (prompt) => loggedChat(
        { call_purpose: 'npc_agenda_backfill', prompt_builder: 'dmSession_route', session_id: null },
        'You generate hidden agendas for NPCs in a D&D campaign. Respond with JSON only.',
        [{ role: 'user', content: prompt }],
        3, 'generation'
      );
      const backfillIds = new Set();
      for (const n of (Array.isArray(customNpcs) ? customNpcs : [])) {
        if (n?.id) backfillIds.add(n.id);
      }
      for (const c of (companions || [])) {
        if (c?.npc_id) backfillIds.add(c.npc_id);
      }
      for (const npcId of backfillIds) {
        try {
          await ensureComplexityTier(npcId);
          await ensureAgendaContent(npcId, agendaLlmCall);
          await ensureNpcProfession(npcId);
        } catch (e) {
          console.error(`[npc-complexity] backfill failed for npc ${npcId}:`, e?.message || e);
        }
      }
      for (const n of (Array.isArray(customNpcs) ? customNpcs : [])) {
        if (!n?.id) continue;
        const fresh = await dbGet(
          'SELECT complexity_tier, hidden_agenda, agenda_status, what_they_want_from_pc, disposition_json, profession_key, mastery_tier, archetype_key, gup_specific, gup_unique FROM npcs WHERE id = ?',
          [n.id]
        );
        if (fresh) Object.assign(n, fresh);
      }
    } catch (e) {
      console.error('[npc-complexity] backfill block failed:', e?.message || e);
    }

    // Build session config with the custom Forgotten Realms context
    const sessionConfig = {
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
      campaignNotes,
      characterMemories,
      usedNames,
      availableNames,
      storyThreadsContext,
      narrativeQueueContext,
      narrativeQueueItemIds,
      worldState,
      campaignPlanSummary,
      chronicleContext,
      chronicleSummaries,
      campaignRollup,
      weatherContext,
      survivalContext,
      craftingContext,
      mythicContext,
      pietyContext,
      partyBaseContext,
      notorietyContext,
      projectsContext,
      progression
    };

    // The local model must be reachable, with its model installed.
    const llmStatus = await llm.checkStatus();
    if (!llmStatus.available) {
      return res.status(503).json({
        error: 'Local AI not available',
        details: llmStatus.error
      });
    }

    let result;
    {
      const systemPrompt = createDMSystemPrompt(character, sessionConfig);

      // Build opening prompt (simplified version of what Ollama does internally)
      const charName = character.nickname || character.name.split(' ')[0];
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

      if (isImportedMidProgress && !isContinuing) {
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

      // Lean prompt: strips MECHANICAL MARKERS + softens Cardinal Rule 2.
      // Applied per-call only — the FULL prompt is what we store in messages[0]
      // so toggling lean off later restores all rules.
      const apiSystemPrompt = leanPrompt ? applyLeanTransforms(systemPrompt) : systemPrompt;

      // Phase 4a SC-4a.1 — wrap with the call logger. session_id isn't
      // known yet (the dm_sessions row gets inserted right after this
      // call; turn_number = 0 for the opening turn).
      const wrappedStart = await wrapLlmCallWithId(
        {
          character_id: character?.id,
          campaign_id: character?.campaign_id,
          turn_number: 0,
          prompt_builder: 'dmPromptBuilder',
          call_purpose: 'session_start',
          system_prompt: apiSystemPrompt,
          user_message: openingPrompt,
          metadata: { lean_prompt: !!leanPrompt }
        },
        (chatOptions) => llm.startSession(apiSystemPrompt, openingPrompt, 'dm', chatOptions)
      );
      const startResult = wrappedStart.result;
      const __sessionStartLogId = wrappedStart.logId;
      // Restore the full prompt as the persisted system message regardless
      // of which variant we sent to the API this turn.
      if (startResult.messages?.[0]?.role === 'system') {
        startResult.messages[0] = { role: 'system', content: systemPrompt };
      }
      result = {
        systemPrompt,
        openingNarrative: startResult.response,
        model: startResult.model,
        messages: startResult.messages
      };
    }

    // Create the session in the database
    const locationName = startingLocation?.name || 'Unknown Location';

    const title = `${character.nickname || character.name} in ${locationName}`;

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
    // Phase 0: sync the unified campaign clock to the session's start
    // date, forward-only (era/flashback starts keep session-local dates
    // and never drag the world clock backward).
    try {
      const cid = character.campaign_id ?? null;
      const clk = await getClock(cid);
      if (gameStartYear > clk.year || (gameStartYear === clk.year && gameStartDay >= clk.dayOfYear)) {
        await setClockDate(cid, { dayOfYear: gameStartDay, year: gameStartYear });
      }
    } catch (e) { console.warn('[clock] session-start sync failed (non-fatal):', e.message); }
    const gameDate = dayToDate(gameStartDay, gameStartYear);

    const info = await dbRun(`
      INSERT INTO dm_sessions (character_id, title, setting, tone, model, status, messages, start_time, session_config, game_start_day, game_start_year)
      VALUES (?, ?, ?, ?, ?, 'active', ?, datetime('now'), ?, ?, ?)
    `, [
      characterId,
      title,
      locationName,
      campaignLength || 'ongoing-saga',
      result.model,
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
  const { sessionId: lockKey } = req.params;

  // Phase 2.2 — one turn per session at a time. The handler makes a slow LLM
  // call, so a client retry after a timeout would otherwise run the turn twice
  // and apply every marker twice. Acquired before any work and released in the
  // finally below, which covers all nine exits (validation returns, the 404,
  // the tagged-error branches, and the success path alike) — a missed path
  // would wedge the session until the lock went stale.
  const lock = acquireSessionLock(lockKey);
  if (!lock.acquired) {
    return conflict(
      res,
      'A turn is already being processed for this session. Wait for it to finish before sending another action.'
    );
  }

  try {
    const { sessionId } = req.params;
    // attackRoll / damage: Phase 4 hybrid combat. Optional whole numbers the
    // player rolled at their own table; see parsePlayerDiceInput.
    const { action, leanPrompt, activeConditions, attackRoll, damage, checkRoll, checkRoll2 } = req.body;

    if (!action || !action.trim()) {
      return res.status(400).json({ error: 'Action is required' });
    }

    // Validated before the session lookup and long before the LLM call — a
    // malformed number should cost nothing, and a 400 here still releases the
    // session lock through the finally below.
    const dice = parsePlayerDiceInput({ attackRoll, damage });
    if (!dice.ok) {
      return res.status(400).json({ error: dice.error });
    }
    const diceDirective = formatPlayerDiceDirective(dice.value);
    // What the model sees. `action` stays the clean, player-authored text and
    // is what gets persisted, transcribed, and echoed back to the client.
    let actionForLlm = action + diceDirective;

    // Get the session
    const session = await dbGet('SELECT * FROM dm_sessions WHERE id = ?', [sessionId]);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (session.status !== 'active') {
      return res.status(400).json({ error: 'Session is not active' });
    }

    // ROLL_REQUEST resolution: if the DM asked for a check last turn, the
    // roll is pending on session_config. The player reports real dice —
    // structured (checkRoll/checkRoll2 body fields, the same channel as
    // attackRoll) or as a bare-number action. Resolve BEFORE the turn runs;
    // the outcome is injected as a system fact further below. Best-effort:
    // a failure here must never cost the player their turn.
    let rollOutcome = null;
    try {
      const pendingRoll = await getPendingRoll(parseInt(sessionId));
      if (pendingRoll) {
        let reportedDice = null;
        if (Number.isInteger(checkRoll) && checkRoll >= 1 && checkRoll <= 20) {
          reportedDice = [checkRoll];
          if (Number.isInteger(checkRoll2) && checkRoll2 >= 1 && checkRoll2 <= 20) {
            reportedDice.push(checkRoll2);
          }
        } else {
          const m = action.trim().match(/^(\d{1,2})(?:\s*(?:and|,|\+)\s*(\d{1,2}))?\s*$/);
          if (m) {
            const d1 = parseInt(m[1], 10);
            const d2 = m[2] ? parseInt(m[2], 10) : null;
            if (d1 >= 1 && d1 <= 20 && (d2 === null || (d2 >= 1 && d2 <= 20))) {
              reportedDice = d2 === null ? [d1] : [d1, d2];
            }
          }
        }
        if (reportedDice) {
          // Item 6: a pending save request may carry a pending spell
          // effect (enemy save spell, retaliation, countered cast) —
          // capture its key BEFORE resolving, since resolution clears
          // the pending roll that carries it.
          const pendingEffectKey = pendingRoll?.effectKey || null;
          // Perception pre-roll: a pending BANK roll (the PC's door die)
          // banks the number instead of judging it — no DC, no outcome.
          // (A bank outcome carries no effectKey and kind 'skill', so the
          // Item-6 effect block below is skipped for it, naturally.)
          rollOutcome = pendingRoll.bank === 'perception'
            ? await resolveBankRoll(parseInt(sessionId), reportedDice)
            : await resolveReportedRoll(parseInt(sessionId), reportedDice);
          if (rollOutcome) {
            // Keep the in-memory session in sync — the post-turn
            // session_config write parses this object and must not
            // resurrect the just-cleared pending roll.
            const fresh = await dbGet('SELECT session_config FROM dm_sessions WHERE id = ?', [sessionId]);
            if (fresh) session.session_config = fresh.session_config;
            // Item 6: apply the pending effect, or the PC's repeat
            // save, on the reported roll. Best-effort: never costs
            // the player their turn.
            try {
              const ess = await import('../services/enemySpellService.js');
              if (pendingEffectKey) {
                // Display casting: a pending display resolves here
                // first; any other key falls through to item 8, then
                // item 7, then item 6.
                const { applyPendingDisplay } = await import('../services/displayService.js');
                const displayHandled = await applyPendingDisplay(parseInt(sessionId), pendingEffectKey, rollOutcome);
                if (!displayHandled) {
                  // Combat item 8: a pending escape resolves here
                  // next; any other key falls through to item 7, then
                  // item 6.
                  const { applyPendingEscape } = await import('../services/conditionService.js');
                  const escapeHandled = await applyPendingEscape(parseInt(sessionId), pendingEffectKey, rollOutcome);
                  if (!escapeHandled) {
                    // Combat item 7: a pending trap save resolves here
                    // next; any other key falls through to item 6.
                    const dts = await import('../services/damageTableService.js');
                    const trapHandled = await dts.applyPendingTrapSave(parseInt(sessionId), pendingEffectKey, rollOutcome);
                    if (!trapHandled) {
                      await ess.applyPendingSaveEffect(parseInt(sessionId), pendingEffectKey, rollOutcome);
                    }
                  }
                }
              } else if (rollOutcome.kind === 'save') {
                await ess.resolvePcRepeatSave(parseInt(sessionId), rollOutcome);
              }
              const fresh2 = await dbGet('SELECT session_config FROM dm_sessions WHERE id = ?', [sessionId]);
              if (fresh2) session.session_config = fresh2.session_config;
            } catch (e) { console.warn('[spells] pending save effect failed (non-fatal):', e.message); }
          }
        }
      }
    } catch (err) {
      console.warn('[rolls] pending roll resolution failed (non-fatal):', err.message);
    }

    // ATTACK resolution (combat-real B2): a pending party attack from
    // last turn resolves from the player's reported dice — the
    // attackRoll/damage body fields, or a bare-number action (the same
    // two channels as check rolls). When the engine consumes the dice,
    // the narrative dice directive is stripped from what the model
    // sees: the ATTACK RESULT block below carries the judged outcome,
    // and the DM must not adjudicate the same dice a second time.
    let attackOutcome = null;
    try {
      const pendingAttack = await getPendingAttack(parseInt(sessionId));
      if (pendingAttack) {
        let reportedDice = null;
        if (Number.isInteger(dice.value.attackRoll)) {
          reportedDice = [dice.value.attackRoll];
        } else {
          const m = action.trim().match(/^(\d{1,2})(?:\s*(?:and|,|\+)\s*(\d{1,2}))?\s*$/);
          if (m) {
            const d1 = parseInt(m[1], 10);
            const d2 = m[2] ? parseInt(m[2], 10) : null;
            if (d1 >= 1 && d1 <= 20 && (d2 === null || (d2 >= 1 && d2 <= 20))) {
              reportedDice = d2 === null ? [d1] : [d1, d2];
            }
          }
        }
        if (reportedDice) {
          attackOutcome = await resolveReportedAttack(parseInt(sessionId), session.character_id, reportedDice, dice.value.damage);
          if (attackOutcome) {
            actionForLlm = action;
            const fresh = await dbGet('SELECT session_config FROM dm_sessions WHERE id = ?', [sessionId]);
            if (fresh) session.session_config = fresh.session_config;
          }
        }
      }
    } catch (err) {
      console.warn('[attacks] pending attack resolution failed (non-fatal):', err.message);
    }

    // SPELL EFFECT resolution (spell-damage build): the player's
    // reported damage/healing total for a pending spell effect from
    // the cast turn. Channels: the damage body field, or a bare-number
    // action (any positive total — spell damage isn't a d20). Runs
    // after checks and attacks, which own their numbers first; when an
    // attack resolved this turn, its damage field was the attack's.
    try {
      const pendingEffect = await getPendingSpellEffect(parseInt(sessionId));
      // Item 6: a pending Backlash reduction owns the reported total
      // when it is newer than any pending spell effect (both ride
      // the same reported-total channel). When it consumes the total,
      // the older spell effect waits for a later report.
      let backlashConsumed = false;
      if (!attackOutcome) {
        const scfgB = safeParse((await dbGet('SELECT session_config FROM dm_sessions WHERE id = ?', [sessionId]))?.session_config, {});
        const backlash = scfgB.pendingBacklashReduction || null;
        const backlashFirst = backlash && (!pendingEffect || (backlash.postedAt || 0) > (pendingEffect.postedAt || 0));
        if (backlashFirst) {
          let reportedTotal = null;
          if (Number.isInteger(dice.value.damage)) reportedTotal = dice.value.damage;
          else {
            const m = action.trim().match(/^(\d{1,3})\s*$/);
            if (m) reportedTotal = parseInt(m[1], 10);
          }
          if (reportedTotal !== null && reportedTotal >= 0) {
            const essB = await import('../services/enemySpellService.js');
            await essB.resolveBacklashReduction(parseInt(sessionId), reportedTotal);
            backlashConsumed = true;
            const freshB = await dbGet('SELECT session_config FROM dm_sessions WHERE id = ?', [sessionId]);
            if (freshB) session.session_config = freshB.session_config;
          }
        }
      }
      if (pendingEffect && !attackOutcome && !backlashConsumed) {
        let reportedTotal = null;
        if (Number.isInteger(dice.value.damage)) {
          reportedTotal = dice.value.damage;
        } else {
          const m = action.trim().match(/^(\d{1,3})\s*$/);
          if (m) reportedTotal = parseInt(m[1], 10);
        }
        if (reportedTotal !== null && reportedTotal >= 0) {
          const effectOutcome = await resolveReportedSpellEffect(parseInt(sessionId), session.character_id, reportedTotal);
          if (effectOutcome) {
            actionForLlm = action;
            const fresh = await dbGet('SELECT session_config FROM dm_sessions WHERE id = ?', [sessionId]);
            if (fresh) session.session_config = fresh.session_config;
          }
        }
      }
    } catch (err) {
      console.warn('[spells] pending spell effect resolution failed (non-fatal):', err.message);
    }

    const messages = safeParse(session.messages, []);

    // Inject active conditions as context (v1.0.190: the server's
    // stored state is the authority — conditions persist across
    // sessions and are mechanically enforced, so the note is built
    // from the DB whenever the server has any. The client-supplied
    // activeConditions remains only as a fallback for state the
    // server has never seen.)
    let conditionNote = null;
    try {
      const party = await getPartyConditions(session.character_id);
      if (party.player.length > 0 || Object.keys(party.companions).length > 0) {
        conditionNote = formatConditionsForAI(party.player, party.companions);
        if (conditionNote) {
          conditionNote += ' These are applied mechanically by the system (disadvantage, auto-failed saves, attack modifiers) — narrate their effects; do not apply them a second time.';
        }
      }
    } catch (err) {
      console.warn('[conditions] server condition lookup failed (non-fatal):', err.message);
    }
    if (!conditionNote && activeConditions) {
      conditionNote = formatConditionsForAI(activeConditions.player, activeConditions.companions);
    }
    if (conditionNote) {
      messages.push({ role: 'user', content: conditionNote });
    }

    // The local model must be reachable, with its model installed.
    const llmStatus = await llm.checkStatus();
    if (!llmStatus.available) {
      return res.status(503).json({ error: 'Local AI not available', details: llmStatus.error });
    }

    // Pillar 5: inject the repetition ledger into the system prompt so the DM
    // sees "Recently used imagery — do not reuse" before composing the next
    // response. Builds an augmented messages array without mutating the
    // original (which is const). Silent-fail on read errors.
    // Per-turn system-prompt suffixes. Two blocks are re-appended fresh each
    // turn — current vitals (Phase 3.1) and the repetition ledger — and BOTH
    // must be stripped before re-appending.
    //
    // One combined strip, not two: these blocks sit at the tail of the prompt
    // and the old ledger-only regex consumed `[\s\S]*` to the end of the
    // string. Stripping only the ledger would either delete a vitals block
    // appended after it, or let a vitals block appended before it accrete
    // every turn forever. Anchoring on whichever tail block comes first and
    // cutting from there rebuilds the suffix cleanly.
    const TURN_SUFFIX_RE =
      /\n*══════════════════════════════════════════════════════════════\n(?:RECENTLY USED IMAGERY|CURRENT VITALS|PERCEPTION PRE-ROLL)[\s\S]*/;

    let augmentedMessages = messages;
    try {
      let suffix = '';

      // Vitals first — the DM must see current HP before composing the turn.
      // The character sheet in the system prompt was assembled at session start
      // and is frozen, so without this the AI is narrating from stale HP.
      try {
        const { getHpState } = await import('../services/characterHpService.js');
        const hp = await getHpState(session.character_id);
        if (hp) {
          const dying = hp.current_hp === 0 && !hp.is_dead;
          suffix +=
            `\n\n══════════════════════════════════════════════════════════════\n` +
            `CURRENT VITALS (live — overrides the character sheet above)\n` +
            `══════════════════════════════════════════════════════════════\n` +
            `Hit points: ${hp.current_hp}/${hp.max_hp}\n` +
            (dying
              ? `THE PLAYER IS AT 0 HP AND DYING. Death saves: ${hp.death_save_successes || 0} success(es), ${hp.death_save_failures || 0} failure(s). The system rolls these — narrate, then stop.\n`
              : '') +
            (hp.is_dead ? `THE PLAYER CHARACTER IS DEAD.\n` : '');
        }
      } catch {
        // Silent-fail — a vitals read must never cost the player their turn.
      }

      const { getLedger, formatRepetitionLedger } = await import('../services/repetitionLedgerService.js');
      const ledger = await getLedger(parseInt(sessionId));
      const ledgerBlock = formatRepetitionLedger(ledger);
      if (ledgerBlock) suffix += ledgerBlock;

      // Perception pre-roll: the active dungeon's bank, re-appended fresh
      // each turn like vitals and the ledger (stripped by TURN_SUFFIX_RE
      // above). Lists who holds a number — never the numbers.
      const bankBlock = await formatActiveBankBlock(parseInt(sessionId));
      if (bankBlock) suffix += bankBlock;

      if (suffix && messages[0] && messages[0].role === 'system' && messages[0].content) {
        const cleaned = messages[0].content.replace(TURN_SUFFIX_RE, '');
        augmentedMessages = [
          { ...messages[0], content: cleaned + suffix },
          ...messages.slice(1)
        ];
      }
    } catch (err) {
      // Silent-fail — ledger is polish.
    }

    // Marker correction injection: if a previous turn emitted a marker that
    // failed schema validation (or broke a response rule), the failure was
    // stashed on session_config. Surface it in the system prompt now so the
    // AI can re-emit correctly. Entries retry for a few turns (see
    // markerCorrectionRetry.js) instead of being consumed unconditionally —
    // but each entry still carries an attempt count, so the same note never
    // accretes forever. Player never sees any of this; it lives entirely
    // in the system-prompt layer.
    try {
      const cfg = safeParse(session.session_config, {});
      const correctionText = renderCorrectionText(cfg.pendingMarkerCorrections);
      if (correctionText && augmentedMessages[0]?.role === 'system' && augmentedMessages[0]?.content) {
        const correctionBlock = `\n\n══════════════ MARKER CORRECTION NEEDED (from last turn) ══════════════\n${correctionText}\n═══════════════════════════════════════════════════════════════════════\n`;
        augmentedMessages = [
          { ...augmentedMessages[0], content: augmentedMessages[0].content + correctionBlock },
          ...augmentedMessages.slice(1)
        ];
      }
    } catch (err) {
      // Silent-fail — correction is additive.
    }

    // ROLL RESULT injection: checks resolved by the system are facts the
    // DM must narrate — the PC outcome resolved at the top of this turn,
    // plus any companion/NPC/enemy outcomes the ROLL_REQUEST handler
    // stashed on session_config last turn (consumed once, here).
    try {
      let rollBlock = rollOutcome
        ? (rollOutcome.perceptionBank ? formatPerceptionBankBlock(rollOutcome) : formatRollOutcomeBlock(rollOutcome))
        : '';
      const freshCfg = safeParse((await dbGet('SELECT session_config FROM dm_sessions WHERE id = ?', [sessionId]))?.session_config, {});
      if (Array.isArray(freshCfg.recentRolls) && freshCfg.recentRolls.length > 0) {
        for (const r of freshCfg.recentRolls) rollBlock += r.perceptionUse ? formatPerceptionUseBlock(r) : formatRollOutcomeBlock(r);
        delete freshCfg.recentRolls;
        await dbRun('UPDATE dm_sessions SET session_config = ? WHERE id = ?', [JSON.stringify(freshCfg), sessionId]);
        session.session_config = JSON.stringify(freshCfg);
      }
      if (rollBlock && augmentedMessages[0]?.role === 'system' && augmentedMessages[0]?.content) {
        augmentedMessages = [
          { ...augmentedMessages[0], content: augmentedMessages[0].content + rollBlock },
          ...augmentedMessages.slice(1)
        ];
      }
    } catch (err) {
      // Silent-fail — roll outcome injection is additive.
    }

    // TIME EVENT injection (v1.0.188): rests and time advances resolved by
    // the REST / TIME_ADVANCE handlers last turn are facts the DM must
    // narrate — consumed once from session_config, same pattern as rolls.
    try {
      const tcfg = safeParse((await dbGet('SELECT session_config FROM dm_sessions WHERE id = ?', [sessionId]))?.session_config, {});
      if (Array.isArray(tcfg.recentTimeEvents) && tcfg.recentTimeEvents.length > 0) {
        let timeBlock = '';
        for (const evt of tcfg.recentTimeEvents) timeBlock += formatTimeEventBlock(evt);
        delete tcfg.recentTimeEvents;
        await dbRun('UPDATE dm_sessions SET session_config = ? WHERE id = ?', [JSON.stringify(tcfg), sessionId]);
        session.session_config = JSON.stringify(tcfg);
        if (timeBlock && augmentedMessages[0]?.role === 'system' && augmentedMessages[0]?.content) {
          augmentedMessages = [
            { ...augmentedMessages[0], content: augmentedMessages[0].content + timeBlock },
            ...augmentedMessages.slice(1)
          ];
        }
      }
    } catch (err) {
      // Silent-fail — time event injection is additive.
    }

    // ATTACK RESULT injection (combat-real B2): party attacks resolved
    // by the engine — the PC's at the top of this turn, companions'
    // during last turn — are facts the DM narrates. Consumed once from
    // session_config, same pattern as TIME EVENT.
    try {
      const acfg = safeParse((await dbGet('SELECT session_config FROM dm_sessions WHERE id = ?', [sessionId]))?.session_config, {});
      if (Array.isArray(acfg.recentAttacks) && acfg.recentAttacks.length > 0) {
        const attackBlock = formatAttackOutcomeBlock(acfg.recentAttacks);
        delete acfg.recentAttacks;
        await dbRun('UPDATE dm_sessions SET session_config = ? WHERE id = ?', [JSON.stringify(acfg), sessionId]);
        session.session_config = JSON.stringify(acfg);
        if (attackBlock && augmentedMessages[0]?.role === 'system' && augmentedMessages[0]?.content) {
          augmentedMessages = [
            { ...augmentedMessages[0], content: augmentedMessages[0].content + '\n\n' + attackBlock },
            ...augmentedMessages.slice(1)
          ];
        }
      }
    } catch (err) {
      // Silent-fail — attack outcome injection is additive.
    }

    // SPELL EFFECT injection (spell-damage build): pending spell
    // damage/healing asks and resolved spell effects are facts for
    // the DM, same consume-once pattern as ATTACK RESULT.
    try {
      const scfg = safeParse((await dbGet('SELECT session_config FROM dm_sessions WHERE id = ?', [sessionId]))?.session_config, {});
      if (Array.isArray(scfg.recentSpellEffects) && scfg.recentSpellEffects.length > 0) {
        const spellBlock = formatSpellEffectBlock(scfg.recentSpellEffects);
        delete scfg.recentSpellEffects;
        await dbRun('UPDATE dm_sessions SET session_config = ? WHERE id = ?', [JSON.stringify(scfg), sessionId]);
        session.session_config = JSON.stringify(scfg);
        if (spellBlock && augmentedMessages[0]?.role === 'system' && augmentedMessages[0]?.content) {
          augmentedMessages = [
            { ...augmentedMessages[0], content: augmentedMessages[0].content + '\n\n' + spellBlock },
            ...augmentedMessages.slice(1)
          ];
        }
      }
    } catch (err) {
      // Silent-fail — spell effect injection is additive.
    }

    // SPELL NOTICE injection (combat item 6): repeat-save asks,
    // superseded effects, and expired counters are system facts for
    // the DM — same consume-once pattern as the blocks above.
    try {
      const scfgN = safeParse((await dbGet('SELECT session_config FROM dm_sessions WHERE id = ?', [sessionId]))?.session_config, {});
      if (Array.isArray(scfgN.pendingDmNotices) && scfgN.pendingDmNotices.length > 0) {
        const noticeBlock = '[SPELL NOTICE — system facts for the DM. ' + scfgN.pendingDmNotices.join(' ') + ']';
        delete scfgN.pendingDmNotices;
        await dbRun('UPDATE dm_sessions SET session_config = ? WHERE id = ?', [JSON.stringify(scfgN), sessionId]);
        session.session_config = JSON.stringify(scfgN);
        if (augmentedMessages[0]?.role === 'system' && augmentedMessages[0]?.content) {
          augmentedMessages = [
            { ...augmentedMessages[0], content: augmentedMessages[0].content + '\n\n' + noticeBlock },
            ...augmentedMessages.slice(1)
          ];
        }
      }
    } catch (err) {
      // Silent-fail — notice injection is additive.
    }

    // COMBAT TURN STATE injection (combat item 3, Tier 1, Q1
    // consequence): every DM prompt during combat carries whose turn
    // it is and the order, so the DM emits ATTACK for the right
    // combatant and TURN_ADVANCE at the right time. Additive and
    // silent-fail like the ATTACK RESULT block above. After COMBAT_END
    // the turn-state row is deleted (see below), so no stale block
    // fires into post-combat prompts.
    try {
      const turnEncounterSeq = await getCurrentEncounterSeq(sessionId);
      if (turnEncounterSeq) {
        const turnState = await getTurnState(sessionId, turnEncounterSeq);
        const turnBlock = turnState ? formatTurnStateBlock(turnState) : '';
        if (turnBlock && augmentedMessages[0]?.role === 'system' && augmentedMessages[0]?.content) {
          augmentedMessages = [
            { ...augmentedMessages[0], content: augmentedMessages[0].content + '\n\n' + turnBlock },
            ...augmentedMessages.slice(1)
          ];
        }
      }
    } catch (err) {
      // Silent-fail — turn state injection is additive.
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
    const compressionCheck = shouldCompress(messagesToSend);

    if (compressionCheck.needsCompression) {
      console.log(`Context compression triggered (${compressionCheck.urgency}): ${compressionCheck.totalTokens} estimated tokens`);
      try {
        messagesToSend = await compressMessageHistory(messagesToSend, parseInt(sessionId));
        console.log(`Compressed to ${messagesToSend.length} messages`);
      } catch (compressError) {
        console.error('Context compression failed, using full history:', compressError.message);
      }
    }

    let result;
    // Phase 4a SC-4a.1 — `__aiLogId` is the ai_call_log row for this turn
    // (null if logging persistence failed). Threaded into the marker-dispatch
    // annotation below.
    let __aiLogId = null;
    {
      // leanPrompt=true strips MECHANICAL MARKERS for this call;
      //   we restore the full prompt to messages[0] before persisting so the toggle is reversible.
      // v1.0.101 (H7): when the player's action commits to a perception/
      //   investigation/stealth-class verb, append OBSERVATION_AS_CHECK_BLOCK
      //   to the system prompt for this turn only. We restore the
      //   un-injected systemPrompt to messages[0] before persisting so the
      //   block doesn't accumulate across turns.
      const systemMessage = messagesToSend.find(m => m.role === 'system');
      const systemPrompt = systemMessage?.content || '';
      const apiSystemPromptBase = leanPrompt ? applyLeanTransforms(systemPrompt) : systemPrompt;
      const observationVerbInjection = detectObservationVerbs(action) ? OBSERVATION_AS_CHECK_BLOCK : '';
      const apiSystemPrompt = apiSystemPromptBase + observationVerbInjection;
      // Phase 4a SC-4a.1 — wrap with the call logger. wrapLlmCallWithId
      // returns { result: <continueSession return>, logId } so the marker
      // dispatch pass below can amend the row with markers_detected,
      // marker_failures, triggered_correction_loop. logId is null when
      // logging persistence fails (best-effort; never blocks gameplay).
      const wrapped = await wrapLlmCallWithId(
        {
          character_id: session.character_id,
          campaign_id: session.campaign_id,
          session_id: parseInt(sessionId),
          prompt_builder: 'dmPromptBuilder',
          call_purpose: 'gameplay_turn',
          system_prompt: apiSystemPrompt,
          // Logs what was actually sent, dice directive included — otherwise a
          // turn where the AI ignored a binding roll is undiagnosable from the log.
          user_message: actionForLlm,
          conversation_history: messagesToSend.filter(m => m.role !== 'system'),
          metadata: {
            lean_prompt: !!leanPrompt,
            observation_verb_injected: !!observationVerbInjection,
            player_dice: diceDirective ? dice.value : null
          }
        },
        (chatOptions) => llm.continueSession(
          apiSystemPrompt, messagesToSend, actionForLlm, 'dm',
          { ...chatOptions, sessionId }
        )
      );
      const turnResult = wrapped.result;
      __aiLogId = wrapped.logId;  // threaded into the marker-dispatch annotation below
      if (turnResult.messages?.[0]?.role === 'system') {
        turnResult.messages[0] = { role: 'system', content: systemPrompt };
      }
      result = {
        narrative: turnResult.response,
        messages: turnResult.messages
      };
    }

    // Strip the dice directive back out of the history about to be persisted.
    // Same discipline as the system-prompt restore above and the observation
    // block: a per-turn injection must not survive into stored history, where
    // it would replay "these numbers are authoritative" against a roll that
    // resolved twenty turns ago. Matched on the exact suffix and walked from
    // the end, so it can only ever hit the turn that was just sent.
    if (diceDirective && Array.isArray(result.messages)) {
      for (let i = result.messages.length - 1; i >= 0; i--) {
        const m = result.messages[i];
        if (m?.role === 'user' && typeof m.content === 'string' && m.content.endsWith(diceDirective)) {
          result.messages[i] = { ...m, content: action };
          break;
        }
      }
    }

    // ─────────── MARKER DISPATCH RUNS BEFORE ANY PERSIST (Phase 2.1) ───────────
    // Ordering is the whole point. Previously the narrative was written first
    // and markers dispatched afterwards, so a crash between the two left a
    // transcript saying "you hand over 50 gold and take the blade" with the
    // gold unspent and no blade — permanently, and silently, because each step
    // swallowed its own errors.
    //
    // Dispatching first means a failure loses the turn instead of recording a
    // narrative whose mechanical consequences never happened. The single
    // `dm_sessions.messages` write now happens once, further down, after the
    // handler results have been folded into result.messages — replacing what
    // used to be five separate writes of the same column.
    //
    // Phase 3 SC-6.1 — dispatches to handlers registered against marker
    // schemas. SC-6.4 captures the result so downstream code can read
    // handlerResults to assemble response-payload arrays (survivalEvents, etc.)
    // preserving the existing client contract. Wrapped in try/catch so a
    // pipeline bug never blocks the existing flow.
    let pipelineResult = { handlerResults: [], failures: [] };
    try {
      // gameDay isn't passed in context — handlers that need it can SELECT
      // characters.game_day via characterId (matches the SC-4 piety pattern).
      // SC-6.4b adds `narrative` so MERCHANT_SHOP handler can self-orchestrate
      // the coupled ADD_ITEM markers (parked from independent dispatch).
      pipelineResult = await processResponseMarkers(result.narrative || '', {
        characterId: session.character_id,
        sessionId: parseInt(sessionId),
        narrative: result.narrative || ''
      });
    } catch (err) {
      console.error('[markerPipeline] dispatch failed (non-fatal):', err.message);
    }

    // Phase 3.1 — death saves. If the turn left the player at 0 HP, roll one
    // save now. The prompt instructs the DM to narrate the fall and stop; the
    // system owns the die, so the AI cannot decide whether the player lives.
    // Runs after dispatch so an HP_CHANGE from this very turn is reflected.
    let deathSave = null;
    try {
      const hpState = await getHpState(session.character_id);
      if (hpState && hpState.current_hp === 0 && !hpState.is_dead) {
        deathSave = await rollDeathSave(session.character_id);
        if (deathSave) {
          result.messages.push({
            role: 'user',
            content:
              `[SYSTEM NOTE - DO NOT RESPOND TO THIS]: Death saving throw rolled: ${deathSave.roll}. ` +
              `Result: ${deathSave.outcome}. Successes ${deathSave.successes}/3, failures ${deathSave.failures}/3.` +
              (deathSave.died ? ' THE PLAYER CHARACTER HAS DIED.' : '') +
              (deathSave.stabilised ? ' The player is now stable at 0 HP, still unconscious.' : '') +
              (deathSave.outcome === 'revived' ? ' The player regained 1 HP and is conscious again.' : '')
          });
        }
      }
    } catch (err) {
      console.error('[hp] death save failed (non-fatal):', err.message);
    }

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

    // Validate every marker the AI emitted against its schema. Failures
    // (missing required fields, invalid enums, out-of-range numbers) and
    // rule violations are stashed on session_config as correction entries so
    // the NEXT turns' system prompts can ask the AI to re-emit. See
    // services/markerCorrectionRetry.js — entries retry for a few turns
    // (P1-G) instead of being consumed unconditionally, and clear once fixed
    // or exhausted. Both reads/writes are best-effort.
    let validationSummary = null;  // captured for playtest logging below
    try {
      const validateResult = validateDmMarkers(result.narrative || '');
      const { failures, validByKey } = validateResult;
      const { violations: ruleViolations } = verifyDmResponse(result.narrative || '');
      const cfg = safeParse(session.session_config, {});
      const nextCfg = { ...cfg };
      const hadPriorCorrection = !!cfg.pendingMarkerCorrections;
      if (failures.length > 0) {
        console.warn(`[marker-schema] ${failures.length} malformed marker(s) on session ${sessionId}:`, failures.map(f => `${f.schemaKey}(${f.errors.map(e => e.field).join(',')})`).join(', '));
      }
      if (ruleViolations.length > 0) {
        console.warn(`[rule-verify] ${ruleViolations.length} rule violation(s) on session ${sessionId}:`, ruleViolations.map(v => v.rule).join(', '));
      }
      const { entries, exhaustedKeys } = nextCorrectionEntries(
        cfg.pendingMarkerCorrections, failures, ruleViolations,
        { exhaustedKeys: cfg.correctionExhaustedKeys }
      );
      delete nextCfg.pendingMarkerCorrections;
      delete nextCfg.correctionExhaustedKeys;
      if (entries.length > 0) {
        nextCfg.pendingMarkerCorrections = entries;
      }
      if (exhaustedKeys.length > 0) {
        nextCfg.correctionExhaustedKeys = exhaustedKeys;
      }
      // Only write if something actually changed (deep compare — entries are
      // objects now, so reference equality is useless).
      const beforeJson = JSON.stringify({ p: cfg.pendingMarkerCorrections ?? null, e: cfg.correctionExhaustedKeys ?? null });
      const afterJson = JSON.stringify({ p: nextCfg.pendingMarkerCorrections ?? null, e: nextCfg.correctionExhaustedKeys ?? null });
      if (beforeJson !== afterJson) {
        // Preserve a pendingRoll the ROLL_REQUEST handler wrote to the DB
        // during this turn's marker dispatch — nextCfg was built from the
        // turn-start snapshot and would otherwise erase it.
        try {
          const freshCfg = safeParse((await dbGet('SELECT session_config FROM dm_sessions WHERE id = ?', [sessionId]))?.session_config, {});
          if (freshCfg.pendingRoll) nextCfg.pendingRoll = freshCfg.pendingRoll;
          // Perception pre-roll: the bank key and any USE outcome the
          // handler stashed must survive this rebuild too — nextCfg was
          // built from the turn-start snapshot and would otherwise erase
          // a dungeon banked (or a use resolved) during this turn.
          if (freshCfg.activePerceptionDungeon) nextCfg.activePerceptionDungeon = freshCfg.activePerceptionDungeon;
          if (freshCfg.recentRolls) nextCfg.recentRolls = freshCfg.recentRolls;
          // F5 surfacing: the spell-cast hook outcomes stashed during
          // this turn's dispatch (recentSpellEffects, the Life pending
          // effect, and the Wild Magic offer record) must survive the
          // same rebuild — otherwise a correction-change turn silently
          // wipes the DM's next-turn spell facts before they are read.
          if (freshCfg.recentSpellEffects) nextCfg.recentSpellEffects = freshCfg.recentSpellEffects;
          if (freshCfg.pendingSpellEffect) nextCfg.pendingSpellEffect = freshCfg.pendingSpellEffect;
          if (freshCfg.pendingWildMagicOffer) nextCfg.pendingWildMagicOffer = freshCfg.pendingWildMagicOffer;
        } catch { /* best-effort — a lost pending roll can be re-asked */ }
        await dbRun('UPDATE dm_sessions SET session_config = ? WHERE id = ?', [JSON.stringify(nextCfg), sessionId]);
      }
      // Capture summary for playtest logger
      const validMarkerCount = Object.values(validByKey).reduce((sum, arr) => sum + arr.length, 0);
      validationSummary = {
        markersValid: validMarkerCount,
        markersMalformed: failures.length,
        ruleViolations: ruleViolations.length,
        correctionConsumed: hadPriorCorrection,
        correctionQueued: entries.length > 0
      };
    } catch (err) {
      console.error('[marker-schema] validation pass failed (non-fatal):', err.message);
    }

    // (Marker dispatch moved above, ahead of every persist — see Phase 2.1.)

    // Phase 4a SC-4a.1 — annotate the ai_call_log row created above with
    // marker-dispatch + correction-loop outcomes. Best-effort; row id is
    // null when this turn ran via Ollama or logger persistence failed.
    if (__aiLogId != null) {
      // Group successful marker results by schemaKey for the markers_detected
      // count map. Failures get the structured failures array verbatim.
      const detected = {};
      for (const r of (pipelineResult.handlerResults || [])) {
        if (r?.schemaKey) detected[r.schemaKey] = (detected[r.schemaKey] || 0) + 1;
      }
      try {
        await annotateAiCallLog(__aiLogId, {
          markers_detected: detected,
          marker_failures: pipelineResult.failures || [],
          triggered_correction_loop: (pipelineResult.failures || []).length > 0
        });
      } catch { /* best-effort */ }
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
      // Phase 4a SC-4a.1 — backfill turn_number on the log row now that
      // we know it. Best-effort.
      if (__aiLogId != null) {
        try {
          await dbRun('UPDATE ai_call_log SET turn_number = ? WHERE id = ?', [turnNumber, __aiLogId]);
        } catch { /* best-effort */ }
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

        // World ID (item 3, Tier 0): best-effort at creation.
        try { await assignWorldId('npcs', insertResult.lastInsertRowid); } catch (e) { console.error('[dmSession] world ID assignment failed:', e.message); }
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

    // SC-6.4b: MERCHANT_SHOP detection + console log moved into the
    // handler in merchantService.js (orchestrates ADD_ITEM coupling
    // internally). Inline block deleted; the handlerResults extraction
    // below pushes the inventoryContext to result.messages.

    // Strip all system markers from displayed narrative
    let cleanNarrative = result.narrative;
    cleanNarrative = cleanNarrative.replace(/\[MERCHANT_SHOP:[^\]]+\]\s*/gi, '').trim();
    cleanNarrative = cleanNarrative.replace(/\[MERCHANT_REFER:[^\]]+\]\s*/gi, '').trim();
    cleanNarrative = cleanNarrative.replace(/\[ADD_ITEM:[^\]]+\]\s*/gi, '').trim();
    cleanNarrative = cleanNarrative.replace(/\[LOOT_DROP:[^\]]+\]\s*/gi, '').trim();
    cleanNarrative = cleanNarrative.replace(/\[COMBAT_START:[^\]]+\]\s*/gi, '').trim();
    cleanNarrative = cleanNarrative.replace(/\[COMBAT_END\]\s*/gi, '').trim();
    // Rest consolidation (2026-11-07): [REST] / [TIME_ADVANCE] move
    // the clock and apply the rest — the DM narrates the outcome
    // from the system's next-turn note, so the raw markers must
    // never reach the player as text. They were the only markers
    // missing from this strip list; every rest-button press now
    // routes through a turn whose narrative carries [REST].
    cleanNarrative = cleanNarrative.replace(/\[REST(?::[^\]]+)?\]\s*/gi, '').trim();
    cleanNarrative = cleanNarrative.replace(/\[TIME_ADVANCE(?::[^\]]+)?\]\s*/gi, '').trim();
    // Phase 3.1 — HP_CHANGE drives real damage now, so the marker must not
    // reach the player as raw text.
    cleanNarrative = cleanNarrative.replace(/\[HP_CHANGE:[^\]]+\]\s*/gi, '').trim();
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

    // Structural #9: Fiction-marker reconciliation (strict both directions).
    // If narration claims damage without a marker, auto-apply it.
    // If a marker was applied but not narrated, append a system note.
    try {
      const reconciliation = await reconcileTurn(cleanNarrative, pipelineResult.handlerResults || [], { characterId, sessionId });
      for (const item of reconciliation.missingFiction) {
        cleanNarrative += `\n\n${item.message}`;
      }
      if (reconciliation.autoApplied.length > 0 || reconciliation.missingFiction.length > 0) {
        console.log(`[reconciliation] autoApplied=${reconciliation.autoApplied.length} missingFiction=${reconciliation.missingFiction.length}`);
      }
    } catch (e) {
      console.error('[reconciliation] failed:', e.message);
    }

    // SC-6.4b — merchant cluster handlers run inside the marker pipeline
    // (merchantService.js: MERCHANT_SHOP, MERCHANT_REFER; merchantOrderService.js:
    // MERCHANT_COMMISSION). Side effects done in handlers; AI-context
    // message construction stays at the route call site so the
    // result.messages reference (closed over here) gets the push, then
    // the whole array persists once at the end of the merchant block.
    //
    // ADD_ITEM is parked from independent dispatch (schema-only). The
    // MERCHANT_SHOP handler self-orchestrates ADD_ITEM markers from the
    // same narrative because they coordinate (legacy behavior preserved).
    let merchantShop = null;
    for (const hr of pipelineResult.handlerResults) {
      if (!hr.ok || !hr.result) continue;
      if (hr.schemaKey === 'MERCHANT_SHOP') {
        result.messages.push({ role: 'user', content: hr.result.inventoryContext });
        // Reshape handler result → client-facing payload (DMSession.jsx
        // checks data.merchantShop?.detected to drive the shop UI).
        merchantShop = {
          detected: true,
          merchantName: hr.result.merchantName,
          merchantType: hr.result.merchantType,
          location: hr.result.location
        };
      } else if (hr.schemaKey === 'MERCHANT_COMMISSION') {
        result.messages.push({ role: 'user', content: hr.result.systemNote });
      }
      // MERCHANT_REFER: no AI-context message push (silent side effect).
    }

    // SC-6.4d — BASE_DEFENSE_RESULT handler in baseThreatService.js
    // owns the threat-status flip; route consolidates handlerResults
    // and pushes systemNote(s) to result.messages.
    const defenseHandlerResults = pipelineResult.handlerResults
      .filter(hr => hr.ok && hr.schemaKey === 'BASE_DEFENSE_RESULT' && hr.result);
    if (defenseHandlerResults.length > 0) {
      for (const hr of defenseHandlerResults) {
        result.messages.push({ role: 'user', content: hr.result.systemNote });
      }
    }

    // SC-6.4b — LOOT_DROP handler in lootDropService.js owns the
    // per-drop inventory mutation. Route consolidates handlerResults
    // across all LOOT_DROP entries into ONE combined SYSTEM note (the
    // legacy "items have been added: A, B, C" shape) and persists once.
    const lootDropResults = pipelineResult.handlerResults
      .filter(hr => hr.ok && hr.schemaKey === 'LOOT_DROP' && hr.result)
      .map(hr => hr.result);
    if (lootDropResults.length > 0) {
      const itemNames = lootDropResults.map(d => d.item).join(', ');
      result.messages.push({
        role: 'user',
        content: `[SYSTEM NOTE - DO NOT RESPOND TO THIS]: The following items have been added to the player's inventory: ${itemNames}. The player's character sheet now reflects these items.`
      });
    }

    // SC-6.4d — COMBAT_START + COMBAT_END handlers in combatMarkerService.js
    // own the initiative roll + system-note text. Route extracts the
    // combatStart payload + pushes the systemNote to result.messages.
    let combatStart = null;
    let combatEnd = false;
    for (const hr of pipelineResult.handlerResults) {
      if (!hr.ok || !hr.result) continue;
      if (hr.schemaKey === 'COMBAT_START') {
        combatStart = hr.result.combatStart;
        result.messages.push({ role: 'user', content: hr.result.systemNote });
      } else if (hr.schemaKey === 'COMBAT_END') {
        combatEnd = true;
      } else if (hr.schemaKey === 'TURN_ADVANCE' && hr.result.systemNote) {
        // Item 3, Tier 1: the advance note was previously dropped here
        // (only COMBAT_START/SET_COVER notes were pushed), so the DM
        // never learned whose turn it now is.
        result.messages.push({ role: 'user', content: hr.result.systemNote });
      }
    }

    // Item 3, Tier 1: COMBAT_END clears the turn-state row, so the
    // per-message turn block stops firing after combat and a later
    // combat starts from a clean ledger (initializeTurnOrder also
    // resets it, but the row must not linger as stale state).
    if (combatEnd) {
      try {
        const endSeq = await getCurrentEncounterSeq(sessionId);
        if (endSeq) await dbRun('DELETE FROM combat_turn_state WHERE session_id = ? AND encounter_seq = ?', [sessionId, endSeq]);
      } catch { /* stale turn state is harmless; next combat re-inits */ }
    }

    // Phase B — SET_COVER failures must SURFACE (ruled 2026-10-29), not
    // fail silently. The handler returns a systemNote only on a failed
    // validation (feature missing / not cover / wrong tier / no feature
    // named in a linked room); pushing it here puts it in the DM's
    // context for the next turn, so the DM can tell the player the
    // cover is not there and they need to move. Successful grants
    // carry no systemNote and stay silent, as before.
    for (const hr of pipelineResult.handlerResults) {
      if (!hr.ok || !hr.result) continue;
      if (hr.schemaKey === 'SET_COVER' && hr.result.systemNote) {
        result.messages.push({ role: 'user', content: hr.result.systemNote });
      }
    }

    // ─────────── THE SINGLE MESSAGES WRITE (Phase 2.1) ───────────
    // Every handler-derived system note has now been folded into
    // result.messages, so the LLM-facing history persists exactly once.
    // This replaces five separate UPDATEs of the same column — one eager write
    // before dispatch plus four conditional re-writes after it — which on the
    // Turso path meant up to five sequential round trips per turn to store
    // successively longer versions of the same array.
    await dbRun('UPDATE dm_sessions SET messages = ? WHERE id = ?', [JSON.stringify(result.messages), sessionId]);

    // Detect condition changes from AI response
    const conditionChanges = detectConditionChanges(result.narrative);
    const hasConditionChanges = conditionChanges.applied.length > 0 || conditionChanges.removed.length > 0;

    // Process weather/survival/crafting markers
    let weatherChangeResult = null;
    let survivalEvents = [];
    let craftingEvents = [];

    // Phase 3 SC-6.4a — survival + crafting cluster handlers run inside
    // the marker pipeline (see survivalService.js, weatherService.js,
    // craftingService.js). Side effects are dispatched there; here we
    // read pipelineResult.handlerResults to populate the response-payload
    // arrays (preserves DMSession.jsx:869's refresh-trigger contract).
    //
    // SURVIVAL: SHELTER_FOUND, EAT, DRINK, FORAGE
    // CRAFTING: RECIPE_FOUND, MATERIAL_FOUND, CRAFT_PROGRESS, RECIPE_GIFT
    // WEATHER:  WEATHER_CHANGE (assigned to weatherChangeResult separately)
    const SURVIVAL_KEYS = new Set(['SHELTER_FOUND', 'EAT', 'DRINK', 'FORAGE']);
    const CRAFTING_KEYS = new Set(['RECIPE_FOUND', 'MATERIAL_FOUND', 'CRAFT_PROGRESS', 'RECIPE_GIFT']);
    for (const hr of pipelineResult.handlerResults) {
      if (!hr.ok || !hr.result) continue;
      if (SURVIVAL_KEYS.has(hr.schemaKey)) survivalEvents.push(hr.result);
      else if (CRAFTING_KEYS.has(hr.schemaKey)) craftingEvents.push(hr.result);
      else if (hr.schemaKey === 'WEATHER_CHANGE') weatherChangeResult = hr.result;
    }

    // SC-6.4d — Mythic cluster handlers run inside the marker pipeline
    // (mythicService.js: TRIAL, ITEM_AWAKEN, SURGE; pietyService.js:
    // PIETY_CHANGE since SC-4). Route assembles mythicEvents from
    // handlerResults. MYTHIC_TRIAL handler returns a `mythicEvents`
    // array (it can produce 1 trial event + optional 1 tier_advance
    // event from the auto-advance cascade); other handlers return
    // single events.
    //
    // **Composition reconfirmed in SC-6.4d prep**: MYTHIC_TRIAL does
    // NOT touch piety. The Q6 survey's hypothesized trial→piety cascade
    // was a misread; recordTrial only inserts mythic_trials + bumps
    // trials_completed. Piety stays in its own SC-4 abstraction.
    const mythicEvents = [];
    for (const hr of pipelineResult.handlerResults) {
      if (!hr.ok || !hr.result) continue;
      if (hr.schemaKey === 'MYTHIC_TRIAL') {
        // Trial handler returns {mythicEvents: [trial, optional tier_advance]}
        if (Array.isArray(hr.result.mythicEvents)) mythicEvents.push(...hr.result.mythicEvents);
      } else if (hr.schemaKey === 'ITEM_AWAKEN' || hr.schemaKey === 'MYTHIC_SURGE') {
        mythicEvents.push(hr.result);
      }
    }

    // SC-6.4c — promise + notoriety cluster handlers run inside the
    // marker pipeline (consequenceService.js: PROMISE_MADE/FULFILLED;
    // notorietyService.js: NOTORIETY_GAIN/LOSS). Side effects done in
    // handlers; route assembles per-marker event arrays from
    // handlerResults to preserve any downstream consumers.
    //
    // **Notoriety silent-drop bug fix**: NOTORIETY_GAIN/LOSS handlers
    // use the schema's extractField parser (handles both quoted-space-sep
    // canonical AND comma-sep legacy formats), resolving the parser
    // divergence that caused canonical-format markers to silently fail
    // pre-SC-6.4c. See KNOWN_BUGS.md Resolved archive.
    const PROMISE_KEYS = new Set(['PROMISE_MADE', 'PROMISE_FULFILLED']);
    const NOTORIETY_KEYS = new Set(['NOTORIETY_GAIN', 'NOTORIETY_LOSS']);
    const promiseEvents = [];
    const notorietyEvents = [];
    for (const hr of pipelineResult.handlerResults) {
      if (!hr.ok || !hr.result) continue;
      if (PROMISE_KEYS.has(hr.schemaKey)) promiseEvents.push(hr.result);
      else if (NOTORIETY_KEYS.has(hr.schemaKey)) notorietyEvents.push(hr.result);
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
      notorietyEvents: notorietyEvents.length > 0 ? notorietyEvents : undefined,
      // Phase 3.1 — HP is authoritative server-side now, so the turn reports it
      // back rather than leaving the client to infer damage from prose.
      hpChanges: pipelineResult.handlerResults
        .filter(hr => hr.ok && hr.schemaKey === 'HP_CHANGE' && hr.result?.applied)
        .map(hr => hr.result),
      deathSave: deathSave || undefined,
      // ROLL_REQUEST: this turn's check requests (a PC request is pending —
      // the client prompts the player to roll real dice) and the outcome
      // resolved from the player's reported dice at the top of this turn.
      rollRequests: pipelineResult.handlerResults
        .filter(hr => hr.ok && hr.schemaKey === 'ROLL_REQUEST' && hr.result?.success)
        .map(hr => hr.result),
      // F5 surfacing: this turn's spell casts, with the Life (life) and
      // Wild Magic (wildMagic) hook results the cast returns — the
      // client/session-facing half of the surfacing; the DM-prompt half
      // rides the SPELL EFFECT block (recentSpellEffects).
      spellCasts: pipelineResult.handlerResults
        .filter(hr => hr.ok && hr.schemaKey === 'SPELL_CAST' && hr.result?.success)
        .map(hr => hr.result),
      rollOutcome: rollOutcome || undefined
    });
  } catch (error) {
    // Tagged errors from llm.js: the local model is not reachable, or its
    // model is not installed. 503 with the fix in plain words; the player's
    // input is preserved client-side and a resend works once Ollama is up.
    if (error?.message?.startsWith('LOCAL_MODEL_UNAVAILABLE:') || error?.message?.startsWith('LOCAL_MODEL_MISSING:')) {
      return res.status(503).json({
        error: 'Local AI not available',
        message: `${error.message.replace(/^LOCAL_MODEL_[A-Z]+: /, '')} Your input has been preserved — send it again once it's running.`,
        retryable: true
      });
    }
    handleServerError(res, error, 'process DM session message');
  } finally {
    // Every exit above — early return, thrown error, or success — lands here.
    releaseSessionLock(lockKey);
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
        // Phase 0: advance the unified clock — it mirrors game_day onto
        // the campaign's characters (the old direct write skipped year
        // rollover entirely).
        await advanceClockDays(daysToAdd, { campaignId: character.campaign_id ?? null, reason: 'adjust_date' }).catch(e =>
          console.warn('adjust-date: clock advance failed:', e.message));
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

    // Try to get AI narrative (local model, DM role). Best-effort: if the
    // model is unavailable the rest still applies, just without narration.
    let narrative = null;
    try {
      narrative = await loggedChat(
        { call_purpose: 'dm_rest_check', prompt_builder: 'dmSession_route' },
        restPrompt, recentMessages, 1, 'dm', 200
      );
    } catch (err) {
      console.error('Rest narrative AI error:', err.message);
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
// Combat item 3, Tier 1 (Q1 consequence): the tracker Next Turn button
// used to advance local React state only, drifting from the server
// turn order. This endpoint advances the server order and returns the
// tracker shape the client already renders.
router.post('/:sessionId/advance-turn', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = await dbGet('SELECT * FROM dm_sessions WHERE id = ?', [sessionId]);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    const encounterSeq = req.body?.encounterSeq || await getCurrentEncounterSeq(sessionId);
    if (!encounterSeq) return res.status(400).json({ error: 'No active encounter' });
    const newState = await advanceTurn(sessionId, encounterSeq);
    if (!newState) return res.status(400).json({ error: 'No turn order for this encounter' });
    return res.json({ turnOrder: newState.turnOrder, currentTurn: newState.currentIndex, round: newState.round, encounterSeq });
  } catch (e) {
    console.error('[dmSession] advance-turn failed:', e.message);
    return res.status(500).json({ error: 'Failed to advance the turn' });
  }
});

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

      const systemMessage = messages.find(m => m.role === 'system');
      const systemPrompt = systemMessage?.content || '';
      const analysisMessages = [
        ...messages.filter(m => m.role !== 'system'),
        { role: 'user', content: analysisPrompt }
      ];
      const analysisResponse = await loggedChat(
        { call_purpose: 'dm_session_analysis', prompt_builder: 'dmSession_route',
          session_id: parseInt(req.params.sessionId) },
        systemPrompt, analysisMessages, 3, 'extraction'
      );

      ({ summary, rewardsAnalysis } = parseAnalysisResponse(analysisResponse));
    } catch (e) {
      console.error('Could not generate analysis:', e);
      summary = 'The adventure concluded.';
      rewardsAnalysis = { combat: 0, exploration: 0, quests: 0, discovery: 0, social: 0, danger: 0, inventoryChanges: null };
    }

    // Check if anything meaningful happened
    // v1.0 (2026-10-19): Session-end orchestrator supersedes the old XP system.
    // The orchestrator runs: XP scoring (LLM) → downtime → domains (stub) →
    // digest (stub) → deferred sweep. It is idempotent via session_end_runs.
    //
    // The route's AI analysis above (summary, rewardsAnalysis) is preserved
    // for: session summary, game-time advance, and session event emission.
    // Only the XP calculation is replaced.
    const sessionNarrative = messages
      .filter(m => m.role === 'assistant')
      .map(m => typeof m.content === 'string' ? m.content : '')
      .join('\n');

    const xpScorerCall = async (prompt) => {
      const systemMessage = messages.find(m => m.role === 'system');
      const systemPrompt = systemMessage?.content || '';
      return await loggedChat(
        { call_purpose: 'session_end_xp_scoring', prompt_builder: 'dmSession_route',
          session_id: parseInt(sessionId) },
        systemPrompt,
        [{ role: 'user', content: prompt }],
        3, 'extraction'
      );
    };

    const orchResult = await endSession(sessionId, {
      characterId: session.character_id,
      campaignId: character.campaign_id,
      sessionData: { narrative: sessionNarrative, characterLevel: character.level },
      llmCall: xpScorerCall,
      downtimeChoice: req.body.downtimeChoice || { path: 'clean' },
    });

    // Map orchestrator XP to the legacy rewards shape the client expects.
    // Gold/loot are no longer awarded at session end (kill-loot handles it
    // during play); XP comes from the LLM scorer.
    const xpAwarded = orchResult.xp?.xpAwarded || 0;
    const rewards = {
      xp: xpAwarded,
      gold: { cp: 0, sp: 0, gp: 0 },
      loot: null,
      breakdown: orchResult.xp?.breakdown || null,
      leveledUp: orchResult.xp?.leveledUp || false,
      newLevel: orchResult.xp?.newLevel,
      downtime: orchResult.downtime || null,
    };

    // Phase 3.2 — the session-end HP heuristic is retired. HP is now applied
    // per-turn from [HP_CHANGE] markers (characterHpService), so running
    // calculateHPChange here as well would subtract a second, invented amount
    // of damage on top of the damage that actually happened during play.
    //
    // calculateHPChange itself stays exported in dmSessionService; it is simply
    // no longer called. It derived damage from an LLM 0-10 "combat" score and
    // carried a known bug where the quests branch discarded the damage branch.
    const hpChange = 0;
    // Phase 1 (v1.0.188) — session-end time is MEASURED, not invented.
    // [TIME_ADVANCE] and [REST] markers moved the world clock during play
    // and accumulated the session's own elapsed hours on session_config;
    // the span below is computed from those facts (restTimeService).
    // calculateGameTimeAdvance — days derived from XP-analysis scores —
    // is retired. A session whose DM never marked time advances 0 days:
    // time that didn't pass in the fiction didn't pass.
    const endCfg = safeParse(session.session_config, {});
    const elapsedHours = Number(endCfg.elapsedHours) || 0;
    let daysElapsed = 0;

    // Advance game date
    const currentGameDay = session.game_start_day || character.game_day || 1;
    const currentGameYear = session.game_start_year || character.game_year || 1492;
    // The clock already stands where the markers left it (Phase 0 synced
    // it to the session's start date at /start). The explicit UPDATE below
    // stamps the final date onto the session character; scheduleService's
    // mirror already covered the campaign's other characters on each
    // in-session advance.
    let newGameDate;
    try {
      const cid = character.campaign_id ?? null;
      const clkBefore = await getClock(cid);
      const sessionAtOrAhead = currentGameYear > clkBefore.year ||
        (currentGameYear === clkBefore.year && currentGameDay >= clkBefore.dayOfYear);
      // Flashback determination: if the rest/time service ran this
      // session it recorded the start gap (and never moved the world
      // clock for a flashback); if no marker fired, the legacy date
      // comparison decides — the clock never moved, so a start date
      // behind it means the session was dated in the past.
      const gapAtStart = Number(endCfg.clockGapAtStart);
      const isFlashback = Number.isFinite(gapAtStart) ? gapAtStart > 0 : !sessionAtOrAhead;
      if (!isFlashback) {
        daysElapsed = sessionEndDays({ startDay: currentGameDay, startYear: currentGameYear, clockDayOfYear: clkBefore.dayOfYear, clockYear: clkBefore.year });
        // The character's date never moves backward: if the clock somehow
        // ends behind the session's start (an unsynced clock — /start's
        // sync normally prevents this), the session's own date stands.
        const clockAtOrAhead = clkBefore.year > currentGameYear ||
          (clkBefore.year === currentGameYear && clkBefore.dayOfYear >= currentGameDay);
        newGameDate = clockAtOrAhead
          ? { day: clkBefore.dayOfYear, year: clkBefore.year }
          : { day: currentGameDay, year: currentGameYear };
      } else {
        // Flashback session: the world clock stays put; the character's
        // date advances by the session's own accumulated elapsed time.
        daysElapsed = sessionEndDays({ flashback: true, elapsedHours });
        newGameDate = advanceTime(currentGameDay, currentGameYear, daysElapsed);
      }
    } catch (e) {
      console.warn('[clock] session-end elapsed computation failed, falling back to session elapsed time:', e.message);
      daysElapsed = Math.max(1, Math.ceil(elapsedHours / 24));
      newGameDate = advanceTime(currentGameDay, currentGameYear, daysElapsed);
    }

    await dbRun('UPDATE characters SET game_day = ?, game_year = ? WHERE id = ?',
      [newGameDate.day, newGameDate.year, session.character_id]);

    // ─────────── PHASE 4: THE WORLD MOVES WITH IN-GAME TIME ───────────
    // The living-world tick used to run only when someone pressed a button —
    // a debug endpoint, or the meta-game "advance time" control. That made the
    // world's motion an out-of-character chore, and a player who never touched
    // those screens played in a world frozen since session one.
    //
    // Session end is the right driver: it is the one moment the campaign clock
    // moves a meaningful amount, and `daysElapsed` above is exactly the amount
    // it moved. Ticking here means the world advances by the same span the
    // adventure consumed, with no UI involvement at all.
    //
    // ORDERING IS LOAD-BEARING: this must run AFTER the clock advance
    // above. Since Phase 0 the tick reads the unified world_clock
    // (scheduleService.getClock) for weather, world events, mail,
    // consequences, notoriety, merchant orders and base threats.
    // Ticking before the write would advance the world against the day the
    // session STARTED on, so every deadline would resolve one session late.
    //
    // Gated on FEATURE_FLAGS.LIVING_WORLD_TICK. The tick self-guards too and
    // returns its full result shape when disabled; the check here is so a
    // disabled world costs nothing rather than paying for a no-op call.
    let worldTick = null;
    if (FEATURE_FLAGS.LIVING_WORLD_TICK && character.campaign_id && daysElapsed > 0) {
      try {
        worldTick = await processLivingWorldTick(character.campaign_id, daysElapsed);

        const failedSteps = (worldTick.step_statuses || []).filter(s => s.status === 'failed');
        console.log(
          `[living-world] session ${sessionId}: ticked ${daysElapsed} day(s) — ` +
          `${worldTick.faction_results?.length || 0} faction goal(s), ` +
          `${worldTick.spawned_events?.length || 0} event(s) spawned, ` +
          `${failedSteps.length} step(s) failed`
        );

        // Feed the outcomes into the next session's prompt. Only the world
        // events spawned here need it — every other subsystem the tick touches
        // queues its own entries. See queueTickHighlights.
        const queued = await queueTickHighlights(
          character.campaign_id, session.character_id, worldTick
        );
        if (queued.queued > 0) {
          console.log(`[living-world] queued ${queued.queued} narrative item(s) for the next session`);
        }
      } catch (e) {
        // A world that failed to advance is a strictly better outcome than a
        // session that failed to end. The turn's rewards, chronicle and game
        // date are all still recorded below.
        console.error('[living-world] tick failed at session end (non-fatal):', e?.message);
      }
    }

    // v1.0 (2026-10-19): Deferred sweep is now handled by the session-end
    // orchestrator (endSession → sweep stage). Removed the inline sweep here
    // to avoid double-running. The orchestrator's sweep is idempotent.

    // Extract campaign notes
    let extractedNotes = '';
    try {
      if (playerActionCount > 0) {
        const extractionPrompt = buildNotesExtractionPrompt();
        const systemMessage = messages.find(m => m.role === 'system');
        const systemPrompt = systemMessage?.content || '';
        const notesResponse = await loggedChat(
          { call_purpose: 'dm_session_notes_extract', prompt_builder: 'dmSession_route',
            session_id: parseInt(req.params.sessionId) },
          systemPrompt,
          [
            ...messages.filter(m => m.role !== 'system'),
            { role: 'user', content: extractionPrompt }
          ],
          3, 'extraction'
        );

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
      if (playerActionCount > 0) {
        const npcExtractionPrompt = buildNpcExtractionPrompt();
        const systemMessage = messages.find(m => m.role === 'system');
        const systemPrompt = systemMessage?.content || '';
        const npcResponse = await loggedChat(
          { call_purpose: 'dm_session_npc_extract', prompt_builder: 'dmSession_route',
            session_id: parseInt(req.params.sessionId) },
          systemPrompt,
          [
            ...messages.filter(m => m.role !== 'system'),
            { role: 'user', content: npcExtractionPrompt }
          ],
          3, 'extraction'
        );

        extractedNpcs = await saveExtractedNpcs(npcResponse, session.title);
      }
    } catch (e) {
      console.error('Could not extract NPCs:', e);
    }

    // Extract character personality memories
    try {
      if (playerActionCount > 0) {
        const memoryPrompt = buildMemoryExtractionPrompt(character.character_memories || '');
        const systemMessage = messages.find(m => m.role === 'system');
        const systemPrompt = systemMessage?.content || '';
        const memoryResponse = await loggedChat(
          { call_purpose: 'dm_session_memory_extract', prompt_builder: 'dmSession_route',
            session_id: parseInt(req.params.sessionId),
            character_id: character?.id },
          systemPrompt,
          [
            ...messages.filter(m => m.role !== 'system'),
            { role: 'user', content: memoryPrompt }
          ],
          3, 'extraction'
        );

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

    // Phase 4 — compress whatever just aged out of the verbatim window.
    //
    // Must run AFTER generateSessionChronicle: this session's chronicle is what
    // pushes the oldest one out of the window, so rolling first would leave the
    // campaign permanently one session behind.
    //
    // Cheap in the common case — it reads two counts and returns without an
    // LLM call unless a chronicle actually aged out, which for a 10-session
    // window means at most once per session and never at all before session 11.
    try {
      if (character.campaign_id) {
        const rollup = await rollUpOldChronicles(character.campaign_id, session.character_id);
        if (rollup.rolled) {
          console.log(
            `[chronicle] rolled ${rollup.newlyRolled} session(s) into the campaign summary ` +
            `(now covering 1-${rollup.throughSession})`
          );
        }
      }
    } catch (e) {
      // Losing a rollup costs prompt fidelity next session, not data — the
      // chronicles themselves are untouched and the next roll retries.
      console.error('Error rolling up chronicles (non-fatal):', e?.message);
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
      npcsExtracted: extractedNpcs.length > 0 ? extractedNpcs : undefined,
      // Phase 4 — what the world did while the session ran. Undefined when the
      // tick is disabled or no in-game time passed.
      worldTick: worldTick
        ? {
            daysElapsed,
            factionGoalsAdvanced: worldTick.faction_results?.length || 0,
            eventsSpawned: worldTick.spawned_events?.length || 0,
            effectsExpired: worldTick.effects_expired || 0,
            failedSteps: (worldTick.step_statuses || [])
              .filter(s => s.status === 'failed')
              .map(s => s.step)
          }
        : undefined
    });

    // Phase 2.3b — snapshot the campaign after the session is safely recorded.
    //
    // Deliberately AFTER res.json and deliberately not awaited: pulling the
    // database down is multi-megabyte work that grows with the campaign, and
    // holding the response open for it would make every session end feel
    // broken. A backup failure is logged, never surfaced — the session already
    // succeeded, and failing the request over a backup would be worse than the
    // missing backup.
    if (FEATURE_FLAGS.SESSION_END_BACKUP) {
      import('../scripts/backup.js')
        .then(({ main: runBackup }) => runBackup())
        .catch(err => console.error('[backup] session-end backup failed (non-fatal):', err?.message));
    }

    // P1-D: prune old ai_call_log content (fire-and-forget, non-fatal). The
    // log stores full prompts per call and grows quadratically within a
    // session; without pruning, backups get progressively more expensive.
    // Runs after res.json like the backup above — never delays session end.
    pruneAiCallLog().catch(err =>
      console.error('[aiCallLogger] session-end prune failed (non-fatal):', err?.message)
    );
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
        const recapPrompt = `The player is returning to a paused adventure. Write a brief "Previously on..." style recap (2-3 sentences max) summarizing what has happened so far in this adventure. Write in past tense. Be dramatic but concise. Do NOT include any meta-commentary.`;
        const systemMessage = messages.find(m => m.role === 'system');
        const systemPrompt = systemMessage?.content || '';
        const recapMessages = [
          ...messages.filter(m => m.role !== 'system'),
          { role: 'user', content: recapPrompt }
        ];
        recap = await loggedChat(
          { call_purpose: 'dm_session_recap', prompt_builder: 'dmSession_route',
            session_id: parseInt(req.params.sessionId) },
          systemPrompt, recapMessages, 3, 'summary'
        );

        // Save the recap so we don't regenerate it each time
        await dbRun('UPDATE dm_sessions SET recap = ? WHERE id = ?', [recap, sessionId]);
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
      // Phase 3.2 — floor removed. This clamps to [0, max_hp], not [1, max_hp]:
      // the old Math.max(1, ...) was not an edge-case guard, it was the reason
      // the player character could never reach 0 HP. session.hp_change is 0 for
      // sessions run after Phase 3.2, so in practice this now preserves the HP
      // that per-turn markers already wrote.
      current_hp: Math.max(0, Math.min(character.max_hp, character.current_hp + (session.hp_change || 0)))
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
      WHERE character_id = ?
      AND status = 'completed'
    `, [characterId]);

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

    // The local model must be reachable, with its model installed.
    const llmStatus = await llm.checkStatus();
    if (!llmStatus.available) {
      return res.status(503).json({ error: 'Local AI not available', details: llmStatus.error });
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

    const systemMessage = messages.find(m => m.role === 'system');
    const systemPrompt = systemMessage?.content || '';
    const npcMessages = [
      ...messages.filter(m => m.role !== 'system'),
      { role: 'user', content: npcExtractionPrompt }
    ];
    const npcResponse = await loggedChat(
      { call_purpose: 'dm_session_npc_codex_extract', prompt_builder: 'dmSession_route',
        session_id: parseInt(req.params.sessionId) },
      systemPrompt, npcMessages, 3, 'extraction'
    );

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

        // World ID (item 3, Tier 0): best-effort at creation.
        try { await assignWorldId('npcs', result.lastInsertRowid); } catch (e) { console.error('[dmSession] world ID assignment failed:', e.message); }
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

        const llmStatus = await llm.checkStatus();
        if (!llmStatus.available) continue;

        const npcExtractionPrompt = `List ALL named NPCs (non-player characters) who appeared in this session. For each NPC, provide their details in this EXACT format, one per line:

NPC: Name="Full Name" Race="Race" Gender="Male/Female/Other" Occupation="Their role or job" Location="Where encountered" Relationship="ally/neutral/enemy/unknown" Description="One sentence physical or personality description"

Rules:
- Only include NPCs with actual names (not "the guard" or "a merchant")
- Include NPCs who were just mentioned or referenced, not just those who spoke
- Use "unknown" for any field you're not sure about
- Do not include the player characters
- Include ALL named characters, even minor ones

If no named NPCs appeared, respond with: NO_NPCS`;

        const systemMessage = messages.find(m => m.role === 'system');
        const systemPrompt = systemMessage?.content || '';
        const npcMessages = [
          ...messages.filter(m => m.role !== 'system'),
          { role: 'user', content: npcExtractionPrompt }
        ];
        const npcResponse = await loggedChat(
          { call_purpose: 'dm_session_npc_extract_alt', prompt_builder: 'dmSession_route',
            session_id: parseInt(req.params.sessionId) },
          systemPrompt, npcMessages, 3, 'extraction'
        );

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

            // World ID (item 3, Tier 0): best-effort at creation.
            try { await assignWorldId('npcs', result.lastInsertRowid); } catch (e) { console.error('[dmSession] world ID assignment failed:', e.message); }
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
