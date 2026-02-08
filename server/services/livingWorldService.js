import { dbAll, dbGet, dbRun } from '../database.js';
import * as factionService from './factionService.js';
import * as worldEventService from './worldEventService.js';

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

    // 4. Record the tick in campaign metadata
    await recordCampaignTick(campaignId, gameDaysPassed, results);

  } catch (error) {
    console.error('Error processing living world tick:', error);
    results.errors.push(error.message);
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
      const newPower = Math.min(10, (faction.power_level || 5) + powerBoost);
      await dbRun('UPDATE factions SET power_level = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [newPower, faction.id]);

      await worldEventService.createEventEffect({
        event_id: event.id,
        effect_type: 'faction_power_change',
        description: `${faction.name} has increased their influence (power ${faction.power_level || 5} → ${newPower})`,
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
 * Check if rival factions react to a goal reaching a significant milestone
 */
async function checkRivalReactions(campaignId, goal, milestone) {
  const rivalEvents = [];
  const triggerFaction = await factionService.getFactionById(goal.faction_id);
  if (!triggerFaction) return rivalEvents;

  const allFactions = await factionService.getActiveFactions(campaignId);

  for (const rival of allFactions) {
    if (rival.id === triggerFaction.id) continue;

    // Check the rival's relationship toward the triggering faction
    const relationship = String(rival.faction_relationships?.[triggerFaction.id] || 'neutral').toLowerCase();

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
        } catch (error) {
          console.error(`Failed to spawn rival reaction for ${rival.name}:`, error);
        }
      }
    }
  }

  return rivalEvents;
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

  return {
    processed: true,
    campaign_id: character.campaign_id,
    hours_advanced: hoursAdvanced,
    days_equivalent: daysPassed,
    results
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
    milestones: JSON.parse(g.milestones || '[]'),
    discovered_by_characters: JSON.parse(g.discovered_by_characters || '[]')
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
