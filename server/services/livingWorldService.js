import { dbAll, dbGet, dbRun } from '../database.js';
import { safeParse } from '../utils/safeParse.js';
import * as factionService from './factionService.js';
import * as worldEventService from './worldEventService.js';
import * as questGenerator from './questGenerator.js';
import * as questService from './questService.js';
import * as narrativeQueueService from './narrativeQueueService.js';
import { checkAndResolveActivities } from './companionActivityService.js';
import { generateNpcMail } from './npcMailService.js';
import { advanceWeather, getWeather } from './weatherService.js';
import { processDayChange as processSurvivalDayChange } from './survivalService.js';
import { processConsequences } from './consequenceService.js';
import * as partyBaseService from './partyBaseService.js';
import * as notorietyService from './notorietyService.js';
import { processDueOrders, expireStaleReadyOrders } from './merchantOrderService.js';
import {
  generateThreatsForCampaign,
  markDueThreatsForResolution,
  autoResolveDueThreats,
  expireStaleCapturedBases
} from './baseThreatService.js';
import { getSeason } from '../config/harptos.js';

/**
 * Living World Service - Coordinates faction and world event progression
 *
 * This service ties together:
 * - Faction goal advancement
 * - World event progression
 * - Auto-spawning events from faction milestones
 * - Campaign-wide world state management
 */

// ============================================================
// MAIN TICK PROCESSING
// ============================================================

/**
 * Process the living world tick for a campaign
 * This is the main entry point called when game time advances
 *
 * @param {number} campaignId - Campaign to process
 * @param {number} gameDaysPassed - Number of in-game days that passed
 * @returns {object} Results of all tick processing
 */
export async function processLivingWorldTick(campaignId, gameDaysPassed = 1) {
  const results = {
    faction_results: [],
    event_results: [],
    spawned_events: [],
    effects_expired: 0,
    errors: []
  };

  try {
    // 0.5. Advance weather
    try {
      const maxDayRow = await dbGet(
        'SELECT MAX(game_day) as max_day FROM characters WHERE campaign_id = ?',
        [campaignId]
      );
      const currentGameDay = maxDayRow?.max_day || 1;
      const season = getSeason(currentGameDay);
      const weatherResult = await advanceWeather(campaignId, gameDaysPassed * 24, currentGameDay, season);
      results.weather = weatherResult;
    } catch (e) {
      console.error('Error advancing weather:', e);
      results.errors.push(`Weather: ${e.message}`);
    }

    // 1. Process faction goals (they advance over time)
    const factionResults = await factionService.processFactionTick(campaignId, gameDaysPassed);
    results.faction_results = factionResults;

    // 2. Check for faction goals that hit milestones and spawn events
    const spawnedEvents = await checkAndSpawnFactionEvents(campaignId, factionResults);
    results.spawned_events = spawnedEvents;

    // 3. Process world events (stages advance, deadlines enforced)
    const eventResults = await worldEventService.processEventTick(campaignId, gameDaysPassed);
    results.event_results = eventResults;

    // Count expired effects
    const expiredEntry = eventResults.find(r => r.type === 'effects_expired');
    if (expiredEntry) {
      results.effects_expired = expiredEntry.count;
    }

    // 3.5. Check and resolve companion activities that have reached their duration
    try {
      const maxDayRow = await dbGet(
        'SELECT MAX(game_day) as max_day FROM characters WHERE campaign_id = ?',
        [campaignId]
      );
      const currentGameDay = maxDayRow?.max_day || 0;
      if (currentGameDay > 0) {
        const resolvedActivities = await checkAndResolveActivities(campaignId, currentGameDay);
        results.companion_activities_resolved = resolvedActivities;
      }
    } catch (e) {
      console.error('Error resolving companion activities:', e);
      results.errors.push(`Companion activities: ${e.message}`);
    }

    // 3.6. Base income and upkeep
    try {
      const charRowBase = await dbGet(
        'SELECT id FROM characters WHERE campaign_id = ? LIMIT 1',
        [campaignId]
      );
      if (charRowBase) {
        const base = await partyBaseService.getBase(charRowBase.id, campaignId);
        if (base && base.status === 'active') {
          const maxDayRowBase = await dbGet(
            'SELECT MAX(game_day) as max_day FROM characters WHERE campaign_id = ?',
            [campaignId]
          );
          const baseGameDay = maxDayRowBase?.max_day || 1;
          const baseResults = await partyBaseService.processIncomeAndUpkeep(
            base.id, baseGameDay, gameDaysPassed
          );
          results.base_income = baseResults;
        }
      }
    } catch (e) {
      console.error('Error processing base income/upkeep:', e);
      results.errors.push(`Base income: ${e.message}`);
    }

    // 3.75. Generate NPC mail
    try {
      const maxDayRow2 = await dbGet(
        'SELECT MAX(game_day) as max_day FROM characters WHERE campaign_id = ?',
        [campaignId]
      );
      const mailGameDay = maxDayRow2?.max_day || 0;
      if (mailGameDay > 0) {
        // Get character for this campaign (solo game — one character per campaign)
        const charRow = await dbGet(
          'SELECT id FROM characters WHERE campaign_id = ? LIMIT 1',
          [campaignId]
        );
        if (charRow) {
          const npcMail = await generateNpcMail(campaignId, charRow.id, mailGameDay);
          results.npc_mail_generated = npcMail.length;
        }
      }
    } catch (e) {
      console.error('Error generating NPC mail:', e);
      results.errors.push(`NPC mail: ${e.message}`);
    }

    // 3.8. Process consequences (overdue promises, expired quests)
    try {
      const charRow2 = await dbGet(
        'SELECT id FROM characters WHERE campaign_id = ? LIMIT 1',
        [campaignId]
      );
      const maxDayRow3 = await dbGet(
        'SELECT MAX(game_day) as max_day FROM characters WHERE campaign_id = ?',
        [campaignId]
      );
      const consequenceGameDay = maxDayRow3?.max_day || 0;
      if (charRow2 && consequenceGameDay > 0) {
        const consequenceResults = await processConsequences(campaignId, charRow2.id, consequenceGameDay);
        results.consequences = consequenceResults;
      }
    } catch (e) {
      console.error('Error processing consequences:', e);
      results.errors.push(`Consequences: ${e.message}`);
    }

    // 3.85. Notoriety decay and entanglement checks
    try {
      const charRowNotoriety = await dbGet(
        'SELECT id FROM characters WHERE campaign_id = ? LIMIT 1',
        [campaignId]
      );
      const maxDayRowNotoriety = await dbGet(
        'SELECT MAX(game_day) as max_day FROM characters WHERE campaign_id = ?',
        [campaignId]
      );
      const notorietyGameDay = maxDayRowNotoriety?.max_day || 0;
      if (charRowNotoriety && notorietyGameDay > 0) {
        const notorietyResults = await notorietyService.processNotorietyTick(
          campaignId, charRowNotoriety.id, notorietyGameDay
        );
        results.notoriety = notorietyResults;
      }
    } catch (e) {
      console.error('Error processing notoriety tick:', e);
      results.errors.push(`Notoriety: ${e.message}`);
    }

    // 3.9. Merchant commissions: flip due orders to 'ready', expire stale
    //      ones. Queue a narrative queue entry for each so the DM can mention
    //      the pickup next session.
    try {
      const charRowOrders = await dbGet(
        'SELECT id FROM characters WHERE campaign_id = ? LIMIT 1',
        [campaignId]
      );
      const maxDayRowOrders = await dbGet(
        'SELECT MAX(game_day) as max_day FROM characters WHERE campaign_id = ?',
        [campaignId]
      );
      const ordersGameDay = maxDayRowOrders?.max_day || 0;
      if (charRowOrders && ordersGameDay > 0) {
        const readied = await processDueOrders(ordersGameDay);
        for (const o of readied) {
          if (o.character_id !== charRowOrders.id) continue;
          try {
            await narrativeQueueService.addToQueue({
              campaign_id: campaignId,
              character_id: o.character_id,
              event_type: 'merchant_order_ready',
              priority: 'normal',
              title: `Commission ready: ${o.item_name}`,
              description: `${o.merchant_name || 'A merchant'} has finished your commissioned ${o.item_name}. It's ready for pickup. Balance due: ${Math.ceil(o.balance_cp / 100)} gp.`,
              context: { order_id: o.id, merchant_id: o.merchant_id, balance_cp: o.balance_cp }
            });
          } catch (e) { /* narrative queue is best-effort */ }
        }
        const expired = await expireStaleReadyOrders(ordersGameDay);
        for (const o of expired) {
          if (o.character_id !== charRowOrders.id) continue;
          try {
            await narrativeQueueService.addToQueue({
              campaign_id: campaignId,
              character_id: o.character_id,
              event_type: 'merchant_order_expired',
              priority: 'low',
              title: `Commission abandoned: ${o.item_name}`,
              description: `${o.merchant_name || 'A merchant'} has given up holding your ${o.item_name} — it's been sold to another buyer. Your deposit is forfeit.`,
              context: { order_id: o.id, merchant_id: o.merchant_id }
            });
          } catch (e) { /* best-effort */ }
        }
        results.merchant_orders = { readied: readied.length, expired: expired.length };
      }
    } catch (e) {
      console.error('Error processing merchant orders:', e);
      results.errors.push(`Merchant orders: ${e.message}`);
    }

    // 3.95. Base threats (F3): scan for raid-capable world events and roll
    //       new threats against vulnerable bases; mark approaching threats
    //       that hit their deadline for auto-resolution; expire any
    //       captured bases whose 14-day recapture window closed.
    try {
      const maxDayRowThreat = await dbGet(
        'SELECT MAX(game_day) as max_day FROM characters WHERE campaign_id = ?',
        [campaignId]
      );
      const threatGameDay = maxDayRowThreat?.max_day || 0;
      if (threatGameDay > 0) {
        const generated = await generateThreatsForCampaign(campaignId, threatGameDay);
        const dueIds = await markDueThreatsForResolution(campaignId, threatGameDay);
        // Threats marked 'resolving' (deadline hit without player defense)
        // get auto-resolved now — attacker vs. defense roll determines
        // outcome; damage reports + narrative queue entries are written.
        const resolved = await autoResolveDueThreats(campaignId, threatGameDay);
        const expired = await expireStaleCapturedBases(campaignId, threatGameDay);
        results.base_threats = {
          generated: generated.generated.length,
          due_for_resolution: dueIds.length,
          auto_resolved: resolved.length,
          expired_captures: expired.length
        };
      }
    } catch (e) {
      console.error('Error processing base threats:', e);
      results.errors.push(`Base threats: ${e.message}`);
    }

    // 4. Record the tick in campaign metadata
    await recordCampaignTick(campaignId, gameDaysPassed, results);

  } catch (error) {
    console.error('Error processing living world tick:', error);
    results.errors.push(error.message);
    // Re-throw critical errors so callers know the tick failed
    if (!results.faction_results.length && !results.event_results.length) {
      throw error;
    }
  }

  return results;
}

/**
 * Check faction goal results and spawn world events for significant milestones.
 * Also checks for rival faction reactions at milestones >= 50%.
 */
async function checkAndSpawnFactionEvents(campaignId, factionResults) {
  const spawnedEvents = [];

  for (const result of factionResults) {
    // Check if goal crossed a milestone threshold (25%, 50%, 75%, 100%)
    const milestones = [25, 50, 75, 100];

    for (const milestone of milestones) {
      const goal = await factionService.getFactionGoalById(result.goal_id);
      if (!goal) continue;

      const percentComplete = Math.floor((goal.progress / goal.progress_max) * 100);
      const previousPercent = Math.floor(((goal.progress - result.progress_gained) / goal.progress_max) * 100);

      // Did we just cross this milestone?
      if (percentComplete >= milestone && previousPercent < milestone) {
        const event = await spawnEventForGoalMilestone(campaignId, goal, milestone);
        if (event) {
          spawnedEvents.push(event);
        }

        // Generate a faction quest for this milestone
        const factionQuest = await spawnFactionQuestForMilestone(campaignId, goal, milestone);
        if (factionQuest) {
          spawnedEvents.push(factionQuest);
        }

        // Check for rival faction reactions at milestones >= 50%
        if (milestone >= 50) {
          const rivalEvents = await checkRivalReactions(campaignId, goal, milestone);
          spawnedEvents.push(...rivalEvents);
        }
      }
    }

    // If goal completed, spawn completion event with power shift
    if (result.completed) {
      const goal = await factionService.getFactionGoalById(result.goal_id);
      const event = await spawnGoalCompletionEvent(campaignId, goal);
      if (event) {
        spawnedEvents.push(event);
      }
    }
  }

  return spawnedEvents;
}

/**
 * Spawn a world event when a faction goal reaches a milestone
 */
async function spawnEventForGoalMilestone(campaignId, goal, milestone) {
  const faction = await factionService.getFactionById(goal.faction_id);
  if (!faction) return null;

  // Only spawn events for visible or partially visible goals
  // Secret goals at 25% might leak hints, 50% might become rumored
  let visibility = 'secret';
  if (goal.visibility === 'public') {
    visibility = 'public';
  } else if (goal.visibility === 'rumored' || milestone >= 50) {
    visibility = 'rumored';
  } else if (milestone >= 75) {
    visibility = 'rumored'; // People start noticing
  }

  // Determine event type based on goal type
  const eventTypeMap = {
    'expansion': 'political',
    'defense': 'military',
    'economic': 'economic',
    'political': 'political',
    'military': 'military',
    'covert': 'conspiracy',
    'religious': 'religious',
    'magical': 'magical'
  };

  const eventType = eventTypeMap[goal.goal_type] || 'political';

  // Build event title and description based on milestone
  const milestoneDescriptions = {
    25: {
      title: `${faction.name} Makes Progress`,
      description: `The ${faction.name} has made initial progress toward ${goal.title.toLowerCase()}. Their activities are beginning to be noticed.`
    },
    50: {
      title: `${faction.name} Gains Momentum`,
      description: `The ${faction.name}'s efforts toward ${goal.title.toLowerCase()} have reached a critical point. Their influence is spreading.`
    },
    75: {
      title: `${faction.name} Nears Goal`,
      description: `The ${faction.name} is close to achieving ${goal.title.toLowerCase()}. Only direct intervention might stop them now.`
    },
    100: {
      title: `${faction.name} Achieves Goal`,
      description: `The ${faction.name} has successfully achieved ${goal.title.toLowerCase()}. The consequences will be felt across the region.`
    }
  };

  const info = milestoneDescriptions[milestone];

  const eventData = {
    campaign_id: campaignId,
    title: info.title,
    description: info.description,
    event_type: eventType,
    scope: faction.scope,
    affected_factions: [faction.id],
    triggered_by_faction_id: faction.id,
    visibility: visibility,
    stages: ['Unfolding', 'Escalating', 'Concluding'],
    stage_descriptions: [
      'The situation is developing',
      'Events are escalating',
      'The outcome is becoming clear'
    ],
    possible_outcomes: [
      'The faction succeeds completely',
      'The faction is partially successful',
      'The faction is opposed and fails',
      'Unexpected complications arise'
    ],
    player_intervention_options: [
      `Support the ${faction.name}`,
      `Oppose the ${faction.name}`,
      `Investigate further`,
      `Stay out of it`
    ],
    status: 'active'
  };

  try {
    const event = await worldEventService.createWorldEvent(eventData);
    return {
      event_id: event.id,
      title: event.title,
      triggered_by: 'faction_goal_milestone',
      milestone: milestone,
      goal_id: goal.id,
      faction_id: faction.id
    };
  } catch (error) {
    console.error('Failed to spawn faction milestone event:', error);
    return null;
  }
}

/**
 * Spawn a world event when a faction goal is completed
 */
async function spawnGoalCompletionEvent(campaignId, goal) {
  const faction = await factionService.getFactionById(goal.faction_id);
  if (!faction) return null;

  // Completion events are significant - always at least rumored visibility
  const visibility = goal.visibility === 'public' ? 'public' : 'rumored';

  const eventData = {
    campaign_id: campaignId,
    title: `${faction.name}: ${goal.title} Complete`,
    description: goal.success_consequences || `The ${faction.name} has achieved their goal: ${goal.title}. The consequences will reshape the region.`,
    event_type: 'political',
    scope: faction.scope,
    affected_factions: [faction.id],
    triggered_by_faction_id: faction.id,
    visibility: visibility,
    stages: ['Immediate Aftermath', 'Settling Effects', 'New Normal'],
    stage_descriptions: [
      'The immediate effects of the goal completion are being felt',
      'The changes are settling into place',
      'A new status quo emerges'
    ],
    expected_duration_days: 7,
    status: 'active'
  };

  try {
    const event = await worldEventService.createWorldEvent(eventData);

    // Create effects and power shift based on goal stakes
    const powerBoost = goal.stakes_level === 'catastrophic' ? 2
                     : goal.stakes_level === 'major' ? 1
                     : 0;

    if (powerBoost > 0) {
      const newPower = Math.min(10, (faction.power_level ?? 5) + powerBoost);
      await dbRun('UPDATE factions SET power_level = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [newPower, faction.id]);

      await worldEventService.createEventEffect({
        event_id: event.id,
        effect_type: 'faction_power_change',
        description: `${faction.name} has increased their influence (power ${faction.power_level ?? 5} → ${newPower})`,
        target_type: 'faction',
        target_id: faction.id,
        parameters: { power_change: powerBoost, new_power: newPower },
        duration: 30
      });
    }

    return {
      event_id: event.id,
      title: event.title,
      triggered_by: 'faction_goal_completion',
      goal_id: goal.id,
      faction_id: faction.id,
      power_shift: powerBoost > 0 ? { faction: faction.name, boost: powerBoost } : undefined
    };
  } catch (error) {
    console.error('Failed to spawn goal completion event:', error);
    return null;
  }
}

/**
 * Check if rival factions react to a goal reaching a significant milestone.
 * Spawns both a world event AND a conflict quest for the player.
 */
async function checkRivalReactions(campaignId, goal, milestone) {
  const rivalEvents = [];
  const triggerFaction = await factionService.getFactionById(goal.faction_id);
  if (!triggerFaction) return rivalEvents;

  const allFactions = await factionService.getActiveFactions(campaignId);

  for (const rival of allFactions) {
    if (rival.id === triggerFaction.id) continue;

    // Check the rival's relationship toward the triggering faction
    const factionRels = typeof rival.faction_relationships === 'string'
      ? JSON.parse(rival.faction_relationships || '{}')
      : (rival.faction_relationships || {});
    const relationship = String(factionRels[triggerFaction.id] || 'neutral').toLowerCase();

    if (relationship === 'hostile' || relationship === 'enemy' || relationship === 'rival') {
      // 40% chance rival spawns a counter-event
      if (Math.random() < 0.4) {
        try {
          const counterEvent = await worldEventService.createWorldEvent({
            campaign_id: campaignId,
            title: `${rival.name} Moves Against ${triggerFaction.name}`,
            description: `The ${rival.name} has launched counter-operations to oppose the ${triggerFaction.name}'s progress on "${goal.title}". Tensions between the two factions are escalating.`,
            event_type: 'political',
            scope: rival.scope || triggerFaction.scope,
            affected_factions: [rival.id, triggerFaction.id],
            triggered_by_faction_id: rival.id,
            visibility: milestone >= 75 ? 'public' : 'rumored',
            stages: ['Mobilizing', 'Active Opposition', 'Outcome'],
            stage_descriptions: [
              `${rival.name} begins mobilizing resources`,
              'Open opposition and counter-moves escalate',
              'The conflict between the factions reaches a resolution'
            ],
            player_intervention_options: [
              `Support ${rival.name}`,
              `Support ${triggerFaction.name}`,
              'Mediate between them',
              'Stay out of it'
            ],
            expected_duration_days: 5,
            status: 'active'
          });

          if (counterEvent) {
            rivalEvents.push({
              event_id: counterEvent.id,
              title: counterEvent.title,
              triggered_by: 'rival_reaction',
              rival_faction: rival.name,
              target_faction: triggerFaction.name,
              goal_id: goal.id
            });
          }

          // Spawn a conflict quest so the player can participate
          const conflictQuest = await spawnConflictQuest(campaignId, rival, triggerFaction, goal, milestone);
          if (conflictQuest) {
            rivalEvents.push(conflictQuest);
          }
        } catch (error) {
          console.error(`Failed to spawn rival reaction for ${rival.name}:`, error);
        }
      }
    }
  }

  return rivalEvents;
}

/**
 * Spawn a conflict quest when two factions clash.
 * The player must choose which side to support (or mediate).
 */
async function spawnConflictQuest(campaignId, aggressor, defender, goal, milestone) {
  const characters = await dbAll(
    'SELECT * FROM characters WHERE campaign_id = ?',
    [campaignId]
  );
  if (characters.length === 0) return null;

  const campaign = await dbGet('SELECT * FROM campaigns WHERE id = ?', [campaignId]);
  const character = characters[0];

  try {
    const [aggressorStanding, defenderStanding, existingQuests] = await Promise.all([
      factionService.getOrCreateStanding(character.id, aggressor.id),
      factionService.getOrCreateStanding(character.id, defender.id),
      questService.getActiveQuests(character.id)
    ]);

    // Skip if there's already an active conflict quest between these factions
    const hasConflictQuest = existingQuests.some(q =>
      q.quest_type === 'faction_conflict' &&
      q.status === 'active' &&
      q.rewards?.aggressor_faction_id === aggressor.id &&
      q.rewards?.defender_faction_id === defender.id
    );
    if (hasConflictQuest) return null;

    const questData = await questGenerator.generateConflictQuest({
      character,
      campaign,
      aggressor,
      defender,
      goal,
      milestone,
      aggressorStanding,
      defenderStanding,
      existingQuests
    });

    // Store faction IDs in rewards for later resolution
    questData.quest.rewards = {
      ...questData.quest.rewards,
      aggressor_faction_id: aggressor.id,
      defender_faction_id: defender.id,
      linked_goal_id: goal.id
    };
    questData.quest.quest_type = 'faction_conflict';
    questData.quest.priority = milestone >= 75 ? 'high' : 'normal';

    const quest = await questService.createQuest(questData.quest);

    for (const req of questData.requirements) {
      await questService.createQuestRequirement({ quest_id: quest.id, ...req });
    }

    await narrativeQueueService.addToQueue({
      campaign_id: campaignId,
      character_id: character.id,
      event_type: 'quest_available',
      priority: 'high',
      title: `Faction Conflict: ${quest.title}`,
      description: quest.premise,
      context: {
        quest_id: quest.id,
        aggressor_faction_id: aggressor.id,
        aggressor_faction_name: aggressor.name,
        defender_faction_id: defender.id,
        defender_faction_name: defender.name,
        milestone
      },
      related_quest_id: quest.id
    });

    console.log(`Conflict quest spawned: "${quest.title}" (${aggressor.name} vs ${defender.name})`);

    return {
      type: 'conflict_quest',
      quest_id: quest.id,
      quest_title: quest.title,
      aggressor_faction: aggressor.name,
      defender_faction: defender.name,
      goal_id: goal.id,
      milestone
    };
  } catch (error) {
    console.error(`Failed to spawn conflict quest (${aggressor.name} vs ${defender.name}):`, error);
    return null;
  }
}

/**
 * Generate a faction quest when a goal hits a milestone.
 * Creates one quest per character in the campaign.
 */
async function spawnFactionQuestForMilestone(campaignId, goal, milestone) {
  const faction = await factionService.getFactionById(goal.faction_id);
  if (!faction) return null;

  // Get characters in this campaign
  const characters = await dbAll(
    'SELECT * FROM characters WHERE campaign_id = ?',
    [campaignId]
  );

  if (characters.length === 0) return null;

  const campaign = await dbGet('SELECT * FROM campaigns WHERE id = ?', [campaignId]);

  // Generate a quest for the first character (solo game, typically one character per campaign)
  const character = characters[0];

  try {
    // Get character's standing with this faction
    const standing = await factionService.getOrCreateStanding(character.id, faction.id);

    // Get existing quests to avoid overlap
    const existingQuests = await questService.getActiveQuests(character.id);

    const questData = await questGenerator.generateFactionQuest({
      character,
      campaign,
      faction,
      goal,
      milestone,
      standing,
      existingQuests
    });

    // Create the quest
    const quest = await questService.createQuest(questData.quest);

    // Create requirements
    for (const req of questData.requirements) {
      await questService.createQuestRequirement({ quest_id: quest.id, ...req });
    }

    // Add to narrative queue
    await narrativeQueueService.addToQueue({
      campaign_id: campaignId,
      character_id: character.id,
      event_type: 'quest_available',
      priority: milestone >= 75 ? 'high' : 'normal',
      title: `Faction Quest: ${quest.title}`,
      description: quest.premise,
      context: {
        quest_id: quest.id,
        faction_id: faction.id,
        faction_name: faction.name,
        milestone
      },
      related_quest_id: quest.id
    });

    console.log(`Faction quest spawned: "${quest.title}" (${faction.name} at ${milestone}%)`);

    return {
      type: 'faction_quest',
      quest_id: quest.id,
      quest_title: quest.title,
      faction_id: faction.id,
      faction_name: faction.name,
      goal_id: goal.id,
      milestone
    };
  } catch (error) {
    console.error(`Failed to spawn faction quest for ${faction.name}:`, error);
    return null;
  }
}

/**
 * Record tick processing in campaign metadata
 */
async function recordCampaignTick(campaignId, daysPassed, results) {
  try {
    await dbRun(`
      UPDATE campaigns
      SET last_world_tick = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [campaignId]);
  } catch (error) {
    // Column might not exist yet - that's okay
    console.log('Note: last_world_tick column may not exist yet');
  }
}

// ============================================================
// CHARACTER TIME ADVANCEMENT INTEGRATION
// ============================================================

/**
 * Process living world tick when a character's time advances
 * This should be called from the meta-game time advancement endpoint
 *
 * @param {number} characterId - Character whose time advanced
 * @param {number} hoursAdvanced - Hours of game time that passed
 */
export async function processCharacterTimeAdvance(characterId, hoursAdvanced) {
  // Get character's campaign
  const character = await dbGet('SELECT campaign_id, game_day FROM characters WHERE id = ?', [characterId]);
  if (!character || !character.campaign_id) {
    return { processed: false, reason: 'Character has no campaign' };
  }

  // Convert hours to days for tick processing (partial days count)
  const daysPassed = hoursAdvanced / 24;

  // Only process if at least a significant amount of time passed (4+ hours)
  if (hoursAdvanced < 4) {
    return { processed: false, reason: 'Not enough time passed for world tick' };
  }

  // Process the living world tick
  const results = await processLivingWorldTick(character.campaign_id, daysPassed);

  // Process survival day-change if a full day passed
  let survivalEffects = null;
  if (daysPassed >= 1) {
    try {
      const weather = await getWeather(character.campaign_id);
      survivalEffects = await processSurvivalDayChange(characterId, character.game_day || 1, weather);
    } catch (e) {
      console.error('Error processing survival day change:', e);
    }
  }

  return {
    processed: true,
    campaign_id: character.campaign_id,
    hours_advanced: hoursAdvanced,
    days_equivalent: daysPassed,
    results,
    survivalEffects
  };
}

// ============================================================
// WORLD STATE QUERIES
// ============================================================

/**
 * Get comprehensive world state for a campaign
 */
export async function getWorldState(campaignId) {
  const [
    activeFactions,
    activeGoals,
    activeEvents,
    activeEffects
  ] = await Promise.all([
    factionService.getActiveFactions(campaignId),
    getAllActiveGoals(campaignId),
    worldEventService.getActiveEvents(campaignId),
    worldEventService.getActiveEffectsForCampaign(campaignId)
  ]);

  return {
    factions: {
      count: activeFactions.length,
      list: activeFactions.map(f => ({
        id: f.id,
        name: f.name,
        power_level: f.power_level,
        scope: f.scope
      }))
    },
    goals: {
      count: activeGoals.length,
      by_visibility: {
        public: activeGoals.filter(g => g.visibility === 'public').length,
        rumored: activeGoals.filter(g => g.visibility === 'rumored').length,
        secret: activeGoals.filter(g => g.visibility === 'secret').length
      }
    },
    events: {
      count: activeEvents.length,
      by_type: groupBy(activeEvents, 'event_type')
    },
    effects: {
      count: activeEffects.length,
      by_type: groupBy(activeEffects, 'effect_type')
    }
  };
}

/**
 * Get all active goals across all factions in a campaign
 */
async function getAllActiveGoals(campaignId) {
  const goals = await dbAll(`
    SELECT fg.*, f.name as faction_name
    FROM faction_goals fg
    JOIN factions f ON fg.faction_id = f.id
    WHERE f.campaign_id = ? AND fg.status = 'active'
    ORDER BY fg.urgency DESC
  `, [campaignId]);

  return goals.map(g => ({
    ...g,
    milestones: safeParse(g.milestones, []),
    discovered_by_characters: safeParse(g.discovered_by_characters, [])
  }));
}

/**
 * Get world state visible to a specific character
 */
export async function getCharacterWorldView(characterId) {
  const character = await dbGet('SELECT campaign_id FROM characters WHERE id = ?', [characterId]);
  if (!character || !character.campaign_id) {
    return null;
  }

  const [
    visibleEvents,
    standings,
    visibleGoals
  ] = await Promise.all([
    worldEventService.getEventsVisibleToCharacter(characterId),
    factionService.getCharacterStandings(characterId),
    factionService.getGoalsVisibleToCharacter(characterId)
  ]);

  return {
    character_id: characterId,
    campaign_id: character.campaign_id,
    visible_events: visibleEvents.map(e => ({
      id: e.id,
      title: e.title,
      event_type: e.event_type,
      scope: e.scope,
      current_stage: e.current_stage
    })),
    faction_standings: standings.map(s => ({
      faction_id: s.faction_id,
      faction_name: s.faction_name,
      standing: s.standing,
      standing_label: s.standing_label,
      is_member: s.is_member
    })),
    known_faction_goals: visibleGoals.map(g => ({
      goal_id: g.id,
      faction_name: g.faction_name,
      title: g.title,
      progress_percent: Math.floor((g.progress / g.progress_max) * 100)
    }))
  };
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function groupBy(array, key) {
  return array.reduce((result, item) => {
    const group = item[key] || 'unknown';
    result[group] = (result[group] || 0) + 1;
    return result;
  }, {});
}

export default {
  processLivingWorldTick,
  processCharacterTimeAdvance,
  getWorldState,
  getCharacterWorldView
};
