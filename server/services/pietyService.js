/**
 * Piety Service — Manages deity relationship scores and threshold abilities.
 *
 * Adapted from Mythic Odysseys of Theros. Characters earn piety through
 * actions aligned with their deity's values. Thresholds at 3, 10, 25, 50
 * unlock deity-specific abilities.
 */

import { dbAll, dbGet, dbRun } from '../database.js';
import { getDeityPiety, getPietyThreshold } from '../config/mythicProgression.js';

// ============================================================
// READ
// ============================================================

/**
 * Get piety for a specific deity relationship.
 */
export async function getCharacterPiety(characterId, deityName) {
  const piety = await dbGet(
    'SELECT * FROM character_piety WHERE character_id = ? AND deity_name = ? COLLATE NOCASE',
    [characterId, deityName]
  );
  if (!piety) return null;

  const deityData = getDeityPiety(deityName.toLowerCase());
  const thresholdInfo = getPietyThreshold(deityName.toLowerCase(), piety.piety_score);

  return {
    ...piety,
    deityData,
    currentThreshold: thresholdInfo
  };
}

/**
 * Get all deity piety scores for a character.
 */
export async function getAllCharacterPiety(characterId) {
  const rows = await dbAll(
    'SELECT * FROM character_piety WHERE character_id = ? ORDER BY deity_name',
    [characterId]
  );
  return rows.map(row => {
    const deityData = getDeityPiety(row.deity_name.toLowerCase());
    const thresholdInfo = getPietyThreshold(row.deity_name.toLowerCase(), row.piety_score);
    return { ...row, deityData, currentThreshold: thresholdInfo };
  });
}

// ============================================================
// INITIALIZE
// ============================================================

/**
 * Initialize a piety relationship with a deity.
 * Idempotent — returns existing record if present.
 */
export async function initializePiety(characterId, deityName, startingScore = 1) {
  const existing = await dbGet(
    'SELECT * FROM character_piety WHERE character_id = ? AND deity_name = ? COLLATE NOCASE',
    [characterId, deityName]
  );
  if (existing) return existing;

  await dbRun(`
    INSERT INTO character_piety (character_id, deity_name, piety_score, highest_threshold_unlocked)
    VALUES (?, ?, ?, 0)
  `, [characterId, deityName, startingScore]);

  // Record initial history entry
  await dbRun(`
    INSERT INTO piety_history (character_id, deity_name, change_amount, reason, new_score)
    VALUES (?, ?, ?, 'Initial piety established', ?)
  `, [characterId, deityName, startingScore, startingScore]);

  return dbGet(
    'SELECT * FROM character_piety WHERE character_id = ? AND deity_name = ? COLLATE NOCASE',
    [characterId, deityName]
  );
}

// ============================================================
// ADJUST
// ============================================================

/**
 * Adjust piety score. Records history and checks for new threshold crossings.
 * Returns { newScore, thresholdCrossed, thresholdAbility } or null if no record found.
 */
export async function adjustPiety(characterId, deityName, amount, reason = null, gameDay = null, sessionId = null) {
  // Ensure piety relationship exists
  let piety = await dbGet(
    'SELECT * FROM character_piety WHERE character_id = ? AND deity_name = ? COLLATE NOCASE',
    [characterId, deityName]
  );
  if (!piety) {
    // Auto-initialize if deity is known
    piety = await initializePiety(characterId, deityName, 1);
  }

  const oldScore = piety.piety_score;
  const newScore = Math.max(0, oldScore + amount); // Floor at 0

  // Update score
  await dbRun(`
    UPDATE character_piety SET piety_score = ?, updated_at = CURRENT_TIMESTAMP
    WHERE character_id = ? AND deity_name = ? COLLATE NOCASE
  `, [newScore, characterId, deityName]);

  // Record history
  await dbRun(`
    INSERT INTO piety_history (character_id, deity_name, change_amount, reason, new_score, game_day, session_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [characterId, deityName, amount, reason, newScore, gameDay, sessionId]);

  // Check for new threshold crossings
  const thresholdResult = await checkNewThreshold(characterId, deityName, oldScore, newScore);

  return {
    oldScore,
    newScore,
    change: amount,
    reason,
    ...thresholdResult
  };
}

/**
 * Check if a score change crossed a piety threshold.
 * Updates highest_threshold_unlocked if a new threshold is reached.
 */
export async function checkNewThreshold(characterId, deityName, oldScore, newScore) {
  const thresholds = [3, 10, 25, 50];
  let thresholdCrossed = null;
  let thresholdAbility = null;

  // Check ascending thresholds
  if (newScore > oldScore) {
    for (const threshold of thresholds) {
      if (oldScore < threshold && newScore >= threshold) {
        thresholdCrossed = threshold;
      }
    }
  }

  if (thresholdCrossed) {
    // Update highest threshold
    await dbRun(`
      UPDATE character_piety SET highest_threshold_unlocked = ?
      WHERE character_id = ? AND deity_name = ? COLLATE NOCASE
      AND highest_threshold_unlocked < ?
    `, [thresholdCrossed, characterId, deityName, thresholdCrossed]);

    // Get the ability info for this threshold
    const thresholdInfo = getPietyThreshold(deityName.toLowerCase(), newScore);
    thresholdAbility = thresholdInfo;
  }

  return { thresholdCrossed, thresholdAbility };
}

// ============================================================
// HISTORY
// ============================================================

/**
 * Get piety change history for a character's deity.
 */
export async function getPietyHistory(characterId, deityName = null, limit = 50) {
  if (deityName) {
    return dbAll(
      'SELECT * FROM piety_history WHERE character_id = ? AND deity_name = ? COLLATE NOCASE ORDER BY created_at DESC LIMIT ?',
      [characterId, deityName, limit]
    );
  }
  return dbAll(
    'SELECT * FROM piety_history WHERE character_id = ? ORDER BY created_at DESC LIMIT ?',
    [characterId, limit]
  );
}
