/**
 * Companion Activity Service
 *
 * Manages companion independent experiences when they're sent away on activities.
 * Companions can train, scout, guard, research, etc. while separated from the party.
 * Activities resolve via Opus AI when sufficient game days have passed.
 *
 * Activity types: training, scouting, personal_quest, guarding, researching, shopping, socializing, resting
 */

import { dbAll, dbGet, dbRun } from '../database.js';
import { isClaudeAvailable, chat as claudeChat } from './claude.js';
import { adjustLoyalty, setMood } from './companionBackstoryService.js';
import { emit } from './eventEmitter.js';
import { GAME_EVENTS } from '../config/eventTypes.js';

const VALID_ACTIVITY_TYPES = [
  'training', 'scouting', 'personal_quest', 'guarding',
  'researching', 'shopping', 'socializing', 'resting'
];

// ============================================================
// SEND COMPANION ON ACTIVITY
// ============================================================

/**
 * Send an active companion on an independent activity.
 * Sets companion status to 'away' and creates an activity record.
 *
 * @param {number} companionId - The companion to send
 * @param {object} data - { activity_type, description, location, objectives, duration_days, campaign_id, current_game_day }
 * @returns {object} - The created activity
 */
export async function sendOnActivity(companionId, data) {
  const companion = await dbGet(`
    SELECT c.*, n.name as npc_name, n.race as npc_race, n.occupation as npc_occupation
    FROM companions c
    JOIN npcs n ON c.npc_id = n.id
    WHERE c.id = ? AND c.status = 'active'
  `, [companionId]);

  if (!companion) {
    throw new Error(`Companion not found or not active: ${companionId}`);
  }

  if (!VALID_ACTIVITY_TYPES.includes(data.activity_type)) {
    throw new Error(`Invalid activity type: ${data.activity_type}. Valid types: ${VALID_ACTIVITY_TYPES.join(', ')}`);
  }

  const durationDays = Math.max(1, Math.min(30, data.duration_days || 3));
  const objectives = Array.isArray(data.objectives) ? data.objectives : [];

  // Create the activity record
  const result = await dbRun(`
    INSERT INTO companion_activities
      (companion_id, character_id, campaign_id, activity_type, description, location, objectives,
       start_game_day, expected_duration_days, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'in_progress')
  `, [
    companionId,
    companion.recruited_by_character_id,
    data.campaign_id || null,
    data.activity_type,
    data.description || null,
    data.location || null,
    JSON.stringify(objectives),
    data.current_game_day,
    durationDays
  ]);

  const activityId = result.lastInsertRowid;

  // Set companion status to 'away' and link activity
  await dbRun(`
    UPDATE companions SET status = 'away', away_activity_id = ?
    WHERE id = ?
  `, [activityId, companionId]);

  return getActivityById(activityId);
}

// ============================================================
// QUERY FUNCTIONS
// ============================================================

/**
 * Get a single activity by ID.
 */
export async function getActivityById(activityId) {
  const activity = await dbGet(`
    SELECT ca.*, n.name as companion_name, n.race as companion_race, n.occupation as companion_occupation
    FROM companion_activities ca
    JOIN companions c ON ca.companion_id = c.id
    JOIN npcs n ON c.npc_id = n.id
    WHERE ca.id = ?
  `, [activityId]);

  if (activity) {
    activity.objectives = JSON.parse(activity.objectives || '[]');
    activity.outcomes = activity.outcomes ? JSON.parse(activity.outcomes) : null;
  }

  return activity;
}

/**
 * Get all companions currently away for a character.
 * Returns companion data joined with their active activity.
 */
export async function getAwayCompanions(characterId) {
  const rows = await dbAll(`
    SELECT c.id as companion_id, c.npc_id, c.away_activity_id,
           n.name, n.race, n.occupation,
           ca.id as activity_id, ca.activity_type, ca.description, ca.location,
           ca.objectives, ca.start_game_day, ca.expected_duration_days, ca.status as activity_status,
           ca.outcomes, ca.reunion_narrative
    FROM companions c
    JOIN npcs n ON c.npc_id = n.id
    LEFT JOIN companion_activities ca ON c.away_activity_id = ca.id
    WHERE c.recruited_by_character_id = ? AND c.status = 'away'
  `, [characterId]);

  return rows.map(r => ({
    ...r,
    objectives: JSON.parse(r.objectives || '[]'),
    outcomes: r.outcomes ? JSON.parse(r.outcomes) : null
  }));
}

/**
 * Get all in-progress activities for a character.
 */
export async function getActiveActivities(characterId) {
  const rows = await dbAll(`
    SELECT ca.*, n.name as companion_name, n.race as companion_race
    FROM companion_activities ca
    JOIN companions c ON ca.companion_id = c.id
    JOIN npcs n ON c.npc_id = n.id
    WHERE ca.character_id = ? AND ca.status = 'in_progress'
    ORDER BY ca.start_game_day DESC
  `, [characterId]);

  return rows.map(r => ({
    ...r,
    objectives: JSON.parse(r.objectives || '[]'),
    outcomes: r.outcomes ? JSON.parse(r.outcomes) : null
  }));
}

// ============================================================
// CANCEL / RECALL
// ============================================================

/**
 * Cancel an activity — companion returns immediately with no outcomes.
 */
export async function cancelActivity(activityId) {
  const activity = await getActivityById(activityId);
  if (!activity) throw new Error(`Activity not found: ${activityId}`);
  if (activity.status !== 'in_progress') throw new Error(`Activity is not in progress`);

  // Mark activity cancelled
  await dbRun(`
    UPDATE companion_activities SET status = 'cancelled', resolved_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [activityId]);

  // Return companion to active
  await dbRun(`
    UPDATE companions SET status = 'active', away_activity_id = NULL
    WHERE id = ?
  `, [activity.companion_id]);

  return { success: true, companion_name: activity.companion_name };
}

/**
 * Recall a companion early — resolves with partial outcomes proportional to time elapsed.
 *
 * @param {number} activityId
 * @param {number} currentGameDay - Current game day for calculating elapsed time
 */
export async function recallCompanion(activityId, currentGameDay) {
  const activity = await getActivityById(activityId);
  if (!activity) throw new Error(`Activity not found: ${activityId}`);
  if (activity.status !== 'in_progress') throw new Error(`Activity is not in progress`);

  const elapsed = currentGameDay - activity.start_game_day;
  const completionRatio = Math.min(1, elapsed / activity.expected_duration_days);

  // If barely started (< 20% complete), just cancel
  if (completionRatio < 0.2) {
    return cancelActivity(activityId);
  }

  // Resolve with partial outcomes
  return resolveActivity(activityId, currentGameDay, completionRatio);
}

// ============================================================
// RESOLUTION
// ============================================================

/**
 * Check all in-progress activities for a campaign and resolve any that are past their expected duration.
 *
 * @param {number} campaignId
 * @param {number} currentGameDay
 * @returns {number} Number of activities resolved
 */
export async function checkAndResolveActivities(campaignId, currentGameDay) {
  if (!currentGameDay) return 0;

  const activities = await dbAll(`
    SELECT ca.id, ca.start_game_day, ca.expected_duration_days
    FROM companion_activities ca
    WHERE ca.campaign_id = ? AND ca.status = 'in_progress'
      AND (ca.start_game_day + ca.expected_duration_days) <= ?
  `, [campaignId, currentGameDay]);

  let resolved = 0;
  for (const activity of activities) {
    try {
      await resolveActivity(activity.id, currentGameDay, 1.0);
      resolved++;
    } catch (e) {
      console.error(`Error resolving activity ${activity.id}:`, e);
    }
  }

  if (resolved > 0) {
    console.log(`[Companion Activities] Resolved ${resolved} activities for campaign ${campaignId}`);
  }

  return resolved;
}

/**
 * Resolve a companion activity — generates outcomes via Opus AI and applies them.
 *
 * @param {number} activityId
 * @param {number} currentGameDay
 * @param {number} completionRatio - 0.0 to 1.0, how much of the activity was completed
 */
export async function resolveActivity(activityId, currentGameDay, completionRatio = 1.0) {
  const activity = await getActivityById(activityId);
  if (!activity) throw new Error(`Activity not found: ${activityId}`);

  // Get companion backstory + NPC personality for context
  const backstory = await dbGet(`
    SELECT cb.personal_goal, cb.loyalty, cb.formative_event,
           n.personality_trait_1, n.personality_trait_2
    FROM companion_backstories cb
    LEFT JOIN companions c ON cb.companion_id = c.id
    LEFT JOIN npcs n ON c.npc_id = n.id
    WHERE cb.companion_id = ?
  `, [activity.companion_id]);

  // Generate outcomes via AI
  let outcomes;
  if (isClaudeAvailable()) {
    outcomes = await generateOutcomesViaAI(activity, backstory, completionRatio);
  } else {
    outcomes = generateFallbackOutcomes(activity, completionRatio);
  }

  // Apply outcomes
  await applyOutcomes(activity, outcomes);

  // Update activity record
  await dbRun(`
    UPDATE companion_activities SET
      status = ?, actual_end_game_day = ?, outcomes = ?, reunion_narrative = ?, resolved_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [
    completionRatio >= 1.0 ? 'completed' : 'recalled',
    currentGameDay,
    JSON.stringify(outcomes),
    outcomes.reunion_narrative || null,
    activityId
  ]);

  // Return companion to active
  await dbRun(`
    UPDATE companions SET status = 'active', away_activity_id = NULL
    WHERE id = ?
  `, [activity.companion_id]);

  // Queue reunion narrative for next session. Uses direct SQL because the
  // narrative_queue schema requires title (for indexing) + description
  // (for display), with context as a JSON blob. Uses
  // 'companion_mood_change' as the event_type since it's the known type
  // that best covers a companion returning with a story.
  if (outcomes.reunion_narrative) {
    try {
      await dbRun(`
        INSERT INTO narrative_queue
          (campaign_id, character_id, event_type, priority, title, description,
           context, related_companion_id, status)
        VALUES (?, ?, 'companion_mood_change', 'high', ?, ?, ?, ?, 'pending')
      `, [
        activity.campaign_id,
        activity.character_id,
        `${activity.companion_name} returns`,
        outcomes.reunion_narrative,
        JSON.stringify({
          companion_name: activity.companion_name,
          activity_type: activity.activity_type,
          story_summary: outcomes.story_summary,
          success_level: outcomes.success_level
        }),
        activity.companion_id
      ]);
    } catch (e) {
      console.error('Error queuing reunion narrative:', e);
    }
  }

  return {
    success: true,
    companion_name: activity.companion_name,
    outcomes
  };
}

// ============================================================
// AI OUTCOME GENERATION
// ============================================================

async function generateOutcomesViaAI(activity, backstory, completionRatio) {
  const personalityTraits = [backstory?.personality_trait_1, backstory?.personality_trait_2].filter(Boolean).join(', ') || 'unknown';
  const motivation = backstory?.personal_goal || 'unknown';
  const moralCode = backstory?.formative_event ? `Shaped by: ${backstory.formative_event}` : 'unknown';

  const completionNote = completionRatio < 1.0
    ? `\nIMPORTANT: This activity was cut short at ${Math.round(completionRatio * 100)}% completion. Scale outcomes accordingly — partial success at best.`
    : '';

  const prompt = `You are generating the outcome of an independent companion activity in a D&D 5e campaign.

Companion: ${activity.companion_name} (${activity.companion_race} ${activity.companion_occupation})
Personality: ${personalityTraits}
Motivation: ${motivation}
Moral Code: ${moralCode}
Current loyalty: ${backstory?.loyalty || 50}/100

Activity: ${activity.activity_type} at ${activity.location || 'unspecified location'} for ${activity.expected_duration_days} days
Description: ${activity.description || 'No specific instructions'}
Objectives: ${JSON.stringify(activity.objectives)}${completionNote}

Generate a JSON outcome. The companion's personality should influence what happens — a cautious companion might succeed at scouting but fail at socializing, while a brave one might take risks during training.

Return ONLY valid JSON:
{
  "success_level": "full|partial|mixed|failed",
  "story_summary": "2-3 sentences describing what happened",
  "reunion_narrative": "1-2 sentences the companion says when reuniting with the player",
  "mood_change": { "new_mood": "one of: happy, sad, angry, anxious, excited, content, melancholy, determined, fearful, proud", "cause": "brief reason", "intensity": 1-5 },
  "loyalty_change": { "amount": -10 to +10, "reason": "brief reason" },
  "xp_gained": 0-100,
  "items_found": ["item name if any — keep rare, most activities find nothing"],
  "injuries": "description or null",
  "story_development": "a plot hook or interesting discovery, or null"
}`;

  try {
    const response = await claudeChat(
      'You are a D&D narrative outcome generator. Return ONLY valid JSON, no markdown or explanation.',
      [{ role: 'user', content: prompt }],
      2, 'opus'
    );

    const text = typeof response === 'string' ? response : response?.content?.[0]?.text || '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (e) {
    console.error('Error generating activity outcomes via AI:', e);
  }

  return generateFallbackOutcomes(activity, completionRatio);
}

function generateFallbackOutcomes(activity, completionRatio) {
  const success = completionRatio >= 0.8 ? 'full' : completionRatio >= 0.5 ? 'partial' : 'failed';

  const summaries = {
    training: `${activity.companion_name} spent time training${activity.location ? ` at ${activity.location}` : ''}. They returned ${success === 'full' ? 'stronger and more confident' : 'having made some progress'}.`,
    scouting: `${activity.companion_name} scouted${activity.location ? ` around ${activity.location}` : ' the area'}. They ${success === 'full' ? 'gathered useful intelligence' : 'found little of note'}.`,
    personal_quest: `${activity.companion_name} pursued a personal matter. They returned ${success === 'full' ? 'with a sense of resolution' : 'with unfinished business'}.`,
    guarding: `${activity.companion_name} stood watch${activity.location ? ` at ${activity.location}` : ''}. ${success === 'full' ? 'Nothing got past them.' : 'It was mostly uneventful.'}`,
    researching: `${activity.companion_name} spent time researching${activity.location ? ` at ${activity.location}` : ''}. They ${success === 'full' ? 'uncovered interesting information' : 'found the research challenging'}.`,
    shopping: `${activity.companion_name} browsed the local markets. They ${success === 'full' ? 'found some useful supplies' : 'didn\'t find much of interest'}.`,
    socializing: `${activity.companion_name} spent time among the locals. They ${success === 'full' ? 'made connections and heard rumors' : 'had a quiet time'}.`,
    resting: `${activity.companion_name} took time to rest and recuperate. They returned ${success === 'full' ? 'refreshed and in good spirits' : 'somewhat rested'}.`
  };

  const reunions = {
    training: success === 'full' ? "I've learned a few new tricks while you were away." : "The training was... harder than I expected.",
    scouting: success === 'full' ? "I've seen what's out there. We should talk." : "I searched, but the land keeps its secrets.",
    personal_quest: success === 'full' ? "I found what I was looking for. Thank you for letting me go." : "Some things take more time than I hoped.",
    guarding: "All quiet on my end. Nothing got through.",
    researching: success === 'full' ? "I found something in the old texts you'll want to hear." : "The research continues. More questions than answers.",
    shopping: "I browsed the stalls. Here's what I found.",
    socializing: success === 'full' ? "The locals are talking. I have news." : "People around here keep to themselves.",
    resting: "I feel much better. Ready for whatever comes next."
  };

  return {
    success_level: success,
    story_summary: summaries[activity.activity_type] || `${activity.companion_name} completed their activity.`,
    reunion_narrative: reunions[activity.activity_type] || "I'm back. Let's continue.",
    mood_change: { new_mood: success === 'full' ? 'content' : 'determined', cause: `${activity.activity_type} activity`, intensity: 2 },
    loyalty_change: { amount: success === 'full' ? 3 : 0, reason: `Trusted with independent ${activity.activity_type}` },
    xp_gained: Math.round(25 * completionRatio),
    items_found: [],
    injuries: null,
    story_development: null
  };
}

// ============================================================
// APPLY OUTCOMES
// ============================================================

async function applyOutcomes(activity, outcomes) {
  // Apply mood change
  if (outcomes.mood_change?.new_mood) {
    try {
      await setMood(
        activity.companion_id,
        outcomes.mood_change.new_mood,
        outcomes.mood_change.cause || `${activity.activity_type} activity`,
        outcomes.mood_change.intensity || 2,
        null // Will be set to current game day by the function
      );
    } catch (e) {
      console.error('Error setting mood after activity:', e);
    }
  }

  // Apply loyalty change
  if (outcomes.loyalty_change?.amount && outcomes.loyalty_change.amount !== 0) {
    try {
      await adjustLoyalty(
        activity.companion_id,
        outcomes.loyalty_change.amount,
        outcomes.loyalty_change.reason || `${activity.activity_type} activity outcome`
      );
    } catch (e) {
      console.error('Error adjusting loyalty after activity:', e);
    }
  }

  // Apply XP
  if (outcomes.xp_gained > 0) {
    try {
      await dbRun(`
        UPDATE companions SET companion_experience = COALESCE(companion_experience, 0) + ?
        WHERE id = ?
      `, [outcomes.xp_gained, activity.companion_id]);
    } catch (e) {
      console.error('Error applying activity XP:', e);
    }
  }

  // Emit event
  await emit(GAME_EVENTS.COMPANION_LOYALTY_CHANGED, {
    companionId: activity.companion_id,
    companionName: activity.companion_name,
    activityType: activity.activity_type,
    successLevel: outcomes.success_level,
    campaignId: activity.campaign_id
  });
}
