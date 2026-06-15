/**
 * Achievement Service
 *
 * CRUD operations for achievements and per-character achievement tracking.
 * Achievement definitions come from config/achievements.js and are seeded
 * into the database on startup.
 */

import { dbAll, dbGet, dbRun } from '../database.js';
import { ACHIEVEMENTS } from '../config/achievements.js';

// ============================================================
// SEEDING
// ============================================================

/**
 * Seed achievement definitions from config into the database.
 * Uses INSERT OR IGNORE so existing rows are untouched.
 */
export async function seedAchievements() {
  let inserted = 0;
  for (const ach of ACHIEVEMENTS) {
    const existing = await dbGet('SELECT id FROM achievements WHERE key = ?', [ach.key]);
    if (existing) continue;

    await dbRun(`
      INSERT INTO achievements (key, title, description, category, icon, hidden, rewards, criteria)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      ach.key, ach.title, ach.description, ach.category,
      ach.icon, ach.hidden ? 1 : 0,
      JSON.stringify(ach.rewards || {}),
      JSON.stringify(ach.criteria || {})
    ]);
    inserted++;
  }
  if (inserted > 0) {
    console.log(`Seeded ${inserted} achievement definition(s).`);
  }
}

// ============================================================
// QUERIES
// ============================================================

/**
 * Get all achievement definitions
 */
export async function getAllAchievements() {
  const rows = await dbAll('SELECT * FROM achievements ORDER BY category, id');
  return rows.map(parseAchievementJson);
}

/**
 * Get a single achievement by key
 */
export async function getAchievementByKey(key) {
  const row = await dbGet('SELECT * FROM achievements WHERE key = ?', [key]);
  return row ? parseAchievementJson(row) : null;
}

/**
 * Get all earned achievements for a character
 */
export async function getCharacterAchievements(characterId) {
  const rows = await dbAll(`
    SELECT a.*, ca.progress, ca.earned_at, ca.notified, ca.reward_claimed
    FROM character_achievements ca
    JOIN achievements a ON ca.achievement_key = a.key
    WHERE ca.character_id = ? AND ca.earned_at IS NOT NULL
    ORDER BY ca.earned_at DESC
  `, [characterId]);
  return rows.map(parseAchievementJson);
}

/**
 * Get all achievements with progress for a character.
 * Returns all visible achievements plus any hidden ones the character has earned.
 */
export async function getAchievementsWithProgress(characterId) {
  const rows = await dbAll(`
    SELECT a.*, ca.progress, ca.earned_at, ca.notified, ca.reward_claimed
    FROM achievements a
    LEFT JOIN character_achievements ca ON a.key = ca.achievement_key AND ca.character_id = ?
    WHERE a.hidden = 0 OR (ca.earned_at IS NOT NULL)
    ORDER BY
      CASE WHEN ca.earned_at IS NOT NULL THEN 0 ELSE 1 END,
      a.category, a.id
  `, [characterId]);
  return rows.map(parseAchievementJson);
}

/**
 * Get recently earned, unnotified achievements for a character
 */
export async function getRecentAchievements(characterId) {
  const rows = await dbAll(`
    SELECT a.*, ca.progress, ca.earned_at, ca.notified, ca.reward_claimed
    FROM character_achievements ca
    JOIN achievements a ON ca.achievement_key = a.key
    WHERE ca.character_id = ? AND ca.notified = 0 AND ca.earned_at IS NOT NULL
    ORDER BY ca.earned_at DESC
  `, [characterId]);
  return rows.map(parseAchievementJson);
}

// ============================================================
// PROGRESS TRACKING
// ============================================================

/**
 * Get or create a progress tracker for a character + achievement key
 */
export async function getOrCreateProgress(characterId, achievementKey) {
  let row = await dbGet(
    'SELECT * FROM character_achievements WHERE character_id = ? AND achievement_key = ?',
    [characterId, achievementKey]
  );

  if (!row) {
    await dbRun(
      'INSERT INTO character_achievements (character_id, achievement_key, progress) VALUES (?, ?, 0)',
      [characterId, achievementKey]
    );
    row = await dbGet(
      'SELECT * FROM character_achievements WHERE character_id = ? AND achievement_key = ?',
      [characterId, achievementKey]
    );
  }

  return row;
}

/**
 * Increment progress for a counter-type achievement.
 * If the threshold is reached, the achievement is earned and rewards applied.
 *
 * @returns {{ earned: boolean, achievement: object|null, progress: number }}
 */
export async function incrementProgress(characterId, achievementKey, amount = 1) {
  const tracker = await getOrCreateProgress(characterId, achievementKey);

  // Already earned — no-op
  if (tracker.earned_at) {
    return { earned: false, achievement: null, progress: tracker.progress };
  }

  const newProgress = tracker.progress + amount;
  await dbRun(
    'UPDATE character_achievements SET progress = ? WHERE id = ?',
    [newProgress, tracker.id]
  );

  // Check threshold
  const achievementDef = ACHIEVEMENTS.find(a => a.key === achievementKey);
  const threshold = achievementDef?.criteria?.threshold || 1;

  if (newProgress >= threshold) {
    return earnAchievement(characterId, achievementKey);
  }

  return { earned: false, achievement: null, progress: newProgress };
}

/**
 * Immediately earn an achievement (for flag-type or when threshold is met).
 * Auto-applies rewards.
 */
export async function earnAchievement(characterId, achievementKey) {
  const tracker = await getOrCreateProgress(characterId, achievementKey);
  if (tracker.earned_at) {
    return { earned: false, achievement: null, progress: tracker.progress };
  }

  const achievementDef = ACHIEVEMENTS.find(a => a.key === achievementKey);
  if (!achievementDef) {
    console.warn(`Achievement "${achievementKey}" not found in config.`);
    return { earned: false, achievement: null, progress: tracker.progress };
  }

  const threshold = achievementDef.criteria?.threshold || 1;
  await dbRun(
    'UPDATE character_achievements SET earned_at = CURRENT_TIMESTAMP, progress = ? WHERE id = ?',
    [threshold, tracker.id]
  );

  // Apply rewards
  if (achievementDef.rewards && Object.keys(achievementDef.rewards).length > 0) {
    try {
      await applyAchievementRewards(characterId, achievementDef.rewards);
      await dbRun(
        'UPDATE character_achievements SET reward_claimed = 1 WHERE id = ?',
        [tracker.id]
      );
    } catch (e) {
      console.error(`Error applying rewards for achievement "${achievementKey}":`, e);
    }
  }

  console.log(`Achievement earned: "${achievementDef.title}" for character ${characterId}`);

  return {
    earned: true,
    achievement: achievementDef,
    progress: threshold
  };
}

/**
 * Mark all unnotified achievements as notified for a character
 */
export async function acknowledgeAchievements(characterId) {
  const result = await dbRun(
    'UPDATE character_achievements SET notified = 1 WHERE character_id = ? AND notified = 0 AND earned_at IS NOT NULL',
    [characterId]
  );
  return result.changes;
}

// ============================================================
// REWARD APPLICATION
// ============================================================

/**
 * Apply achievement rewards to a character.
 * Follows same pattern as questService.applyQuestRewards.
 */
async function applyAchievementRewards(characterId, rewards) {
  const character = await dbGet('SELECT * FROM characters WHERE id = ?', [characterId]);
  if (!character) return;

  const updates = [];
  const params = [];

  if (rewards.gold && typeof rewards.gold === 'number' && rewards.gold > 0) {
    updates.push('gold_gp = ?');
    params.push((character.gold_gp || 0) + rewards.gold);
  }

  if (rewards.xp && typeof rewards.xp === 'number' && rewards.xp > 0) {
    updates.push('experience = ?');
    params.push((character.experience || 0) + rewards.xp);
  }

  if (rewards.items && rewards.items.length > 0) {
    let inventory = [];
    try { inventory = JSON.parse(character.inventory || '[]'); } catch { inventory = []; }

    for (const itemName of rewards.items) {
      if (!itemName || typeof itemName !== 'string') continue;
      const existing = inventory.find(i => i.name.toLowerCase() === itemName.toLowerCase());
      if (existing) {
        existing.quantity = (existing.quantity || 1) + 1;
      } else {
        inventory.push({ name: itemName, quantity: 1 });
      }
    }
    updates.push('inventory = ?');
    params.push(JSON.stringify(inventory));
  }

  if (updates.length > 0) {
    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(characterId);
    await dbRun(`UPDATE characters SET ${updates.join(', ')} WHERE id = ?`, params);
  }
}

// ============================================================
// HELPERS
// ============================================================

function parseAchievementJson(row) {
  return {
    ...row,
    hidden: Boolean(row.hidden),
    rewards: safeJsonParse(row.rewards, {}),
    criteria: safeJsonParse(row.criteria, {}),
    notified: row.notified !== undefined ? Boolean(row.notified) : undefined,
    reward_claimed: row.reward_claimed !== undefined ? Boolean(row.reward_claimed) : undefined
  };
}

function safeJsonParse(str, fallback) {
  if (!str) return fallback;
  if (typeof str === 'object') return str;
  try { return JSON.parse(str); } catch { return fallback; }
}
