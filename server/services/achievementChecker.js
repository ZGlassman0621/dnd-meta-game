/**
 * Achievement Checker
 *
 * Listens to game events and checks if any achievements should be earned.
 * Follows the same pattern as questProgressChecker.js.
 */

import { on, emit, GAME_EVENTS } from './eventEmitter.js';
import { ACHIEVEMENTS } from '../config/achievements.js';
import * as achievementService from './achievementService.js';
import * as narrativeQueueService from './narrativeQueueService.js';

let handlersRegistered = false;

/**
 * Initialize the achievement checker by registering event handlers
 */
export function initAchievementChecker() {
  if (handlersRegistered) {
    console.log('Achievement checker already initialized');
    return;
  }

  on(GAME_EVENTS.ADVENTURE_COMPLETE, handleEvent);
  on(GAME_EVENTS.LOCATION_VISITED, handleEvent);
  on(GAME_EVENTS.LOCATION_DISCOVERED, handleEvent);
  on(GAME_EVENTS.NPC_INTERACTION, handleEvent);
  on(GAME_EVENTS.NPC_DISPOSITION_CHANGED, handleEvent);
  on(GAME_EVENTS.FACTION_STANDING_CHANGED, handleEvent);
  on(GAME_EVENTS.COMPANION_RECRUITED, handleEvent);
  on(GAME_EVENTS.COMPANION_LOYALTY_CHANGED, handleEvent);
  on(GAME_EVENTS.COMPANION_SECRET_REVEALED, handleEvent);
  on(GAME_EVENTS.DM_SESSION_ENDED, handleEvent);
  on(GAME_EVENTS.CHARACTER_LEVEL_UP, handleEvent);
  on(GAME_EVENTS.ITEM_OBTAINED, handleEvent);
  on(GAME_EVENTS.QUEST_COMPLETED, handleEvent);

  handlersRegistered = true;
  console.log('Achievement checker initialized');
}

/**
 * Handle a game event and check all relevant achievements
 */
async function handleEvent(event) {
  const { character_id } = event.data;
  if (!character_id) return;

  const results = [];

  for (const achievement of ACHIEVEMENTS) {
    // Skip if this achievement doesn't care about this event type
    if (achievement.criteria.event !== event.type) continue;

    try {
      // Check if already earned
      const tracker = await achievementService.getOrCreateProgress(character_id, achievement.key);
      if (tracker.earned_at) continue;

      // Check if event data matches criteria params
      if (!matchesCriteria(achievement.criteria, event.data)) continue;

      // Process based on criteria type
      let result;
      if (achievement.criteria.type === 'flag') {
        result = await achievementService.earnAchievement(character_id, achievement.key);
      } else if (achievement.criteria.type === 'counter') {
        result = await achievementService.incrementProgress(character_id, achievement.key, 1);
      }

      if (result?.earned) {
        results.push(result.achievement);

        // Add to narrative queue so DM can reference it
        await narrativeQueueService.addToQueue({
          character_id,
          event_type: 'achievement_earned',
          priority: 'normal',
          title: `Achievement Earned: ${achievement.title}`,
          description: achievement.description,
          context: {
            achievement_key: achievement.key,
            category: achievement.category,
            rewards: achievement.rewards
          }
        });

        // Emit achievement earned event
        await emit(GAME_EVENTS.ACHIEVEMENT_EARNED, {
          character_id,
          achievement_key: achievement.key,
          achievement_title: achievement.title,
          category: achievement.category,
          rewards: achievement.rewards
        });
      }
    } catch (error) {
      console.error(`Error checking achievement "${achievement.key}":`, error);
    }
  }

  return results;
}

/**
 * Check if event data matches achievement criteria params
 */
function matchesCriteria(criteria, eventData) {
  const params = criteria.params || {};

  // No params = matches any event of the right type
  if (Object.keys(params).length === 0) return true;

  // Tag matching (e.g., tags_include: 'combat')
  if (params.tags_include) {
    const tags = eventData.tags || [];
    if (!tags.some(t => t.toLowerCase().includes(params.tags_include.toLowerCase()))) {
      return false;
    }
  }

  // Risk level matching
  if (params.risk_level && eventData.risk_level !== params.risk_level) {
    return false;
  }

  // Quest type matching
  if (params.quest_type && eventData.quest_type !== params.quest_type) {
    return false;
  }

  // Source type matching (e.g., faction quests)
  if (params.source_type && eventData.source_type !== params.source_type) {
    return false;
  }

  // Minimum standing check
  if (params.min_standing !== undefined) {
    if ((eventData.new_standing || 0) < params.min_standing) {
      return false;
    }
  }

  // Minimum disposition check
  if (params.min_disposition !== undefined) {
    if ((eventData.new_disposition || 0) < params.min_disposition) {
      return false;
    }
  }

  // Minimum loyalty check
  if (params.min_loyalty !== undefined) {
    if ((eventData.new_loyalty || 0) < params.min_loyalty) {
      return false;
    }
  }

  // Minimum gold check (for wealth achievements)
  if (params.min_gold !== undefined) {
    if ((eventData.gold || 0) < params.min_gold) {
      return false;
    }
  }

  return true;
}
