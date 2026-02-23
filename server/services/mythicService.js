/**
 * Mythic Service — Core CRUD and logic for mythic progression system.
 *
 * Manages mythic tier advancement, path selection, ability grants,
 * mythic power tracking, trials, and shadow point constraints.
 */

import { dbAll, dbGet, dbRun } from '../database.js';
import {
  getMythicTierInfo,
  getBaseAbilitiesForTier,
  getPathInfo,
  getPathAbilitiesForTier,
  getMythicPowerMax,
  getSurgeDie,
  canSelectPath,
  isLegendPath,
  getTrialsRequired,
  getShadowCategory
} from '../config/mythicProgression.js';

// ============================================================
// READ
// ============================================================

/**
 * Get full mythic status for a character.
 * Returns null if character has no mythic record.
 */
export async function getMythicStatus(characterId) {
  const mc = await dbGet(
    'SELECT * FROM mythic_characters WHERE character_id = ?',
    [characterId]
  );
  if (!mc) return null;

  const abilities = await getActiveAbilities(characterId);
  const trials = await getTrials(characterId);
  const tierInfo = getMythicTierInfo(mc.mythic_tier);
  const pathInfo = mc.mythic_path ? getPathInfo(mc.mythic_path) : null;

  return {
    characterId,
    tier: mc.mythic_tier,
    tierName: tierInfo?.name || 'Mortal',
    path: mc.mythic_path,
    pathName: pathInfo?.name || null,
    pathSubtitle: pathInfo?.subtitle || null,
    mythicPowerMax: mc.mythic_power_max,
    mythicPowerUsed: mc.mythic_power_used,
    mythicPowerRemaining: mc.mythic_power_max - mc.mythic_power_used,
    surgeDie: mc.surge_die,
    trialsCompleted: mc.trials_completed,
    trialsRequired: mc.trials_required,
    pathSelectedGameDay: mc.path_selected_game_day,
    tierUnlockedGameDay: mc.tier_unlocked_game_day,
    abilities,
    trials,
    isLegend: mc.mythic_path === 'legend'
  };
}

/**
 * Get all active abilities for a character.
 */
export async function getActiveAbilities(characterId) {
  return dbAll(
    'SELECT * FROM mythic_abilities WHERE character_id = ? AND is_active = 1 ORDER BY tier_unlocked, ability_type',
    [characterId]
  );
}

/**
 * Get all trials for a character.
 */
export async function getTrials(characterId) {
  return dbAll(
    'SELECT * FROM mythic_trials WHERE character_id = ? ORDER BY created_at DESC',
    [characterId]
  );
}

// ============================================================
// INITIALIZE
// ============================================================

/**
 * Initialize mythic tracking for a character (creates row at tier 0).
 * Idempotent — returns existing record if already initialized.
 */
export async function initializeMythic(characterId) {
  const existing = await dbGet(
    'SELECT * FROM mythic_characters WHERE character_id = ?',
    [characterId]
  );
  if (existing) return existing;

  await dbRun(`
    INSERT INTO mythic_characters (character_id, mythic_tier, mythic_power_max, mythic_power_used, surge_die, trials_completed, trials_required)
    VALUES (?, 0, 0, 0, 'd6', 0, 1)
  `, [characterId]);

  return dbGet('SELECT * FROM mythic_characters WHERE character_id = ?', [characterId]);
}

// ============================================================
// PATH SELECTION
// ============================================================

/**
 * Select a mythic path for a character.
 * Validates shadow point constraints for light/dark paths.
 */
export async function selectMythicPath(characterId, pathKey, gameDay = null) {
  const pathInfo = getPathInfo(pathKey);
  if (!pathInfo) {
    throw new Error(`Unknown mythic path: ${pathKey}`);
  }
  if (!pathInfo.isPlayerSelectable) {
    throw new Error(`Path ${pathKey} is not player-selectable`);
  }

  // Check shadow constraints
  const character = await dbGet('SELECT shadow_points FROM characters WHERE id = ?', [characterId]);
  const shadowPoints = character?.shadow_points || 0;

  if (!canSelectPath(pathKey, shadowPoints)) {
    const category = getShadowCategory(pathKey);
    throw new Error(`Shadow points (${shadowPoints}) prevent selecting ${category} path ${pathKey}`);
  }

  // Ensure mythic record exists
  await initializeMythic(characterId);

  await dbRun(`
    UPDATE mythic_characters
    SET mythic_path = ?, path_selected_game_day = ?
    WHERE character_id = ?
  `, [pathKey, gameDay, characterId]);

  return getMythicStatus(characterId);
}

// ============================================================
// TIER ADVANCEMENT
// ============================================================

/**
 * Advance a character to the next mythic tier.
 * Grants base abilities and path abilities for the new tier.
 * Updates mythic power pool and surge die.
 */
export async function advanceTier(characterId, gameDay = null) {
  const mc = await dbGet(
    'SELECT * FROM mythic_characters WHERE character_id = ?',
    [characterId]
  );
  if (!mc) {
    throw new Error('Character has no mythic record. Initialize first.');
  }

  const newTier = mc.mythic_tier + 1;
  if (newTier > 5) {
    throw new Error('Already at maximum mythic tier (5).');
  }

  const tierInfo = getMythicTierInfo(newTier);
  const newPowerMax = getMythicPowerMax(newTier);
  const newSurgeDie = getSurgeDie(newTier);
  const newTrialsRequired = getTrialsRequired(newTier) || 1;

  // For Legend path, mythic power is reduced: 1 + tier per day
  const isLegend = mc.mythic_path === 'legend';
  const actualPowerMax = isLegend ? (1 + newTier) : newPowerMax;

  // Update mythic_characters
  await dbRun(`
    UPDATE mythic_characters
    SET mythic_tier = ?,
        mythic_power_max = ?,
        mythic_power_used = 0,
        surge_die = ?,
        trials_completed = 0,
        trials_required = ?,
        tier_unlocked_game_day = ?
    WHERE character_id = ?
  `, [newTier, actualPowerMax, newSurgeDie, newTrialsRequired, gameDay, characterId]);

  // Mark character as mythic
  await dbRun(
    'UPDATE characters SET has_mythic = 1 WHERE id = ?',
    [characterId]
  );

  // Grant base abilities for this tier
  const baseAbilities = getBaseAbilitiesForTier(newTier);
  const existingAbilities = await getActiveAbilities(characterId);
  const existingKeys = new Set(existingAbilities.map(a => a.ability_key));

  for (const ability of baseAbilities) {
    if (!existingKeys.has(ability.key)) {
      await grantAbility(characterId, ability.key, 'base', newTier);
    }
  }

  // Grant path abilities for this tier (if path selected and not Legend)
  if (mc.mythic_path && !isLegend) {
    const pathAbilities = getPathAbilitiesForTier(mc.mythic_path, newTier);
    // Only grant abilities for the exact new tier, not previous tiers
    const tierAbilities = pathAbilities.filter(a => a.tier === newTier);
    for (const ability of tierAbilities) {
      if (!existingKeys.has(ability.key)) {
        await grantAbility(characterId, ability.key, 'path', newTier);
      }
    }
  }

  return getMythicStatus(characterId);
}

// ============================================================
// TRIALS
// ============================================================

/**
 * Record a completed trial.
 * If trials_completed reaches trials_required after this, returns { canAdvance: true }.
 */
export async function recordTrial(characterId, campaignId, trialData) {
  const mc = await dbGet(
    'SELECT * FROM mythic_characters WHERE character_id = ?',
    [characterId]
  );
  if (!mc) {
    throw new Error('Character has no mythic record.');
  }

  const { name, description, outcome = 'passed', pathEffect = null, gameDay = null, sessionId = null } = trialData;

  await dbRun(`
    INSERT INTO mythic_trials (character_id, campaign_id, tier_at_completion, trial_name, trial_description, outcome, path_effect, game_day, session_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [characterId, campaignId, mc.mythic_tier, name, description, outcome, pathEffect, gameDay, sessionId]);

  // Only count passed trials toward advancement
  let canAdvance = false;
  if (outcome === 'passed') {
    const newCount = mc.trials_completed + 1;
    await dbRun(
      'UPDATE mythic_characters SET trials_completed = ? WHERE character_id = ?',
      [newCount, characterId]
    );
    canAdvance = newCount >= mc.trials_required;
  }

  return { canAdvance, trialsCompleted: mc.trials_completed + (outcome === 'passed' ? 1 : 0), trialsRequired: mc.trials_required };
}

// ============================================================
// ABILITIES
// ============================================================

/**
 * Grant a mythic ability to a character.
 * Uses INSERT OR IGNORE for idempotency.
 */
export async function grantAbility(characterId, abilityKey, abilityType, tier) {
  await dbRun(`
    INSERT OR IGNORE INTO mythic_abilities (character_id, ability_key, ability_type, tier_unlocked)
    VALUES (?, ?, ?, ?)
  `, [characterId, abilityKey, abilityType, tier]);
}

/**
 * Deactivate a mythic ability (e.g. shadow point lockout for light paths).
 */
export async function deactivateAbility(characterId, abilityKey) {
  await dbRun(
    'UPDATE mythic_abilities SET is_active = 0 WHERE character_id = ? AND ability_key = ?',
    [characterId, abilityKey]
  );
}

/**
 * Reactivate a mythic ability.
 */
export async function reactivateAbility(characterId, abilityKey) {
  await dbRun(
    'UPDATE mythic_abilities SET is_active = 1 WHERE character_id = ? AND ability_key = ?',
    [characterId, abilityKey]
  );
}

// ============================================================
// MYTHIC POWER
// ============================================================

/**
 * Spend mythic power. Returns remaining power.
 * Throws if insufficient power.
 */
export async function useMythicPower(characterId, amount = 1) {
  const mc = await dbGet(
    'SELECT mythic_power_max, mythic_power_used FROM mythic_characters WHERE character_id = ?',
    [characterId]
  );
  if (!mc) throw new Error('No mythic record found.');

  const remaining = mc.mythic_power_max - mc.mythic_power_used;
  if (amount > remaining) {
    throw new Error(`Insufficient mythic power: ${remaining} remaining, ${amount} needed.`);
  }

  const newUsed = mc.mythic_power_used + amount;
  await dbRun(
    'UPDATE mythic_characters SET mythic_power_used = ? WHERE character_id = ?',
    [newUsed, characterId]
  );

  return { remaining: mc.mythic_power_max - newUsed, max: mc.mythic_power_max, used: newUsed };
}

/**
 * Restore mythic power (partial — e.g. Legendary Hero hourly regen).
 */
export async function restoreMythicPower(characterId, amount = 1) {
  const mc = await dbGet(
    'SELECT mythic_power_max, mythic_power_used FROM mythic_characters WHERE character_id = ?',
    [characterId]
  );
  if (!mc) return;

  const newUsed = Math.max(0, mc.mythic_power_used - amount);
  await dbRun(
    'UPDATE mythic_characters SET mythic_power_used = ? WHERE character_id = ?',
    [newUsed, characterId]
  );

  return { remaining: mc.mythic_power_max - newUsed, max: mc.mythic_power_max, used: newUsed };
}

/**
 * Full restore of mythic power (long rest).
 */
export async function resetMythicPower(characterId) {
  await dbRun(
    'UPDATE mythic_characters SET mythic_power_used = 0 WHERE character_id = ?',
    [characterId]
  );
}

// ============================================================
// SHADOW CONSTRAINTS
// ============================================================

/**
 * Check if a character's shadow points allow their path abilities to function.
 * Returns { status: 'full'|'weakened'|'locked', shadowPoints, path, category }
 */
export async function checkShadowConstraints(characterId) {
  const mc = await dbGet(
    'SELECT mythic_path FROM mythic_characters WHERE character_id = ?',
    [characterId]
  );
  if (!mc?.mythic_path) return { status: 'full', shadowPoints: 0, path: null, category: null };

  const character = await dbGet('SELECT shadow_points FROM characters WHERE id = ?', [characterId]);
  const shadow = character?.shadow_points || 0;
  const category = getShadowCategory(mc.mythic_path);

  if (category === 'light') {
    if (shadow <= 2) return { status: 'full', shadowPoints: shadow, path: mc.mythic_path, category };
    if (shadow <= 5) return { status: 'weakened', shadowPoints: shadow, path: mc.mythic_path, category };
    return { status: 'locked', shadowPoints: shadow, path: mc.mythic_path, category };
  }

  // Dark and neutral paths are not constrained by shadow
  return { status: 'full', shadowPoints: shadow, path: mc.mythic_path, category };
}

// ============================================================
// LEGEND PATH
// ============================================================

/**
 * For Legend path: return bonus class levels granted at a given tier.
 * Tier 1: +4 (Level 24), Tier 2: +4 more (Level 28), etc.
 */
export function getLegendPathLevels(tier) {
  return tier * 4; // Total bonus levels = tier × 4
}

/**
 * For Legend path: return ability score maximum at a given tier.
 * Tier 1: 24, Tier 2: 26, Tier 3: 28, Tier 4: 30, Tier 5: no limit
 */
export function getLegendAbilityMax(tier) {
  if (tier >= 5) return 99; // No maximum
  return 20 + (tier * 2);
}

// ============================================================
// EPIC BOONS
// ============================================================

/**
 * Get all epic boons selected by a character.
 */
export async function getEpicBoons(characterId) {
  return dbAll(
    'SELECT * FROM character_epic_boons WHERE character_id = ? ORDER BY created_at',
    [characterId]
  );
}

/**
 * Select an epic boon for a character.
 */
export async function selectEpicBoon(characterId, boonKey, abilityScoreBonus = null, gameDay = null) {
  // Check not already selected
  const existing = await dbGet(
    'SELECT id FROM character_epic_boons WHERE character_id = ? AND boon_key = ?',
    [characterId, boonKey]
  );
  if (existing) {
    throw new Error(`Epic boon ${boonKey} already selected.`);
  }

  await dbRun(`
    INSERT INTO character_epic_boons (character_id, boon_key, ability_score_bonus, game_day_acquired)
    VALUES (?, ?, ?, ?)
  `, [characterId, boonKey, abilityScoreBonus, gameDay]);

  // Apply the +1 ability score bonus if specified
  if (abilityScoreBonus) {
    const character = await dbGet('SELECT ability_scores FROM characters WHERE id = ?', [characterId]);
    if (character) {
      const scores = typeof character.ability_scores === 'string'
        ? JSON.parse(character.ability_scores)
        : (character.ability_scores || {});
      const shortKey = { strength: 'str', dexterity: 'dex', constitution: 'con', intelligence: 'int', wisdom: 'wis', charisma: 'cha' }[abilityScoreBonus] || abilityScoreBonus;
      if (scores[shortKey] !== undefined) {
        scores[shortKey] = Math.min(30, scores[shortKey] + 1); // Epic boon cap is 30
        await dbRun(
          'UPDATE characters SET ability_scores = ? WHERE id = ?',
          [JSON.stringify(scores), characterId]
        );
      }
    }
  }

  return getEpicBoons(characterId);
}

// ============================================================
// LEGENDARY ITEMS
// ============================================================

/**
 * Get all legendary items for a character.
 */
export async function getLegendaryItems(characterId) {
  const items = await dbAll(
    'SELECT * FROM legendary_items WHERE character_id = ? ORDER BY created_at',
    [characterId]
  );
  return items.map(parseItemJson);
}

/**
 * Get legendary items for a campaign.
 */
export async function getCampaignLegendaryItems(campaignId) {
  const items = await dbAll(
    'SELECT * FROM legendary_items WHERE campaign_id = ? ORDER BY created_at',
    [campaignId]
  );
  return items.map(parseItemJson);
}

/**
 * Create a legendary item.
 */
export async function createLegendaryItem(data) {
  const {
    characterId, campaignId, itemName, itemBaseType,
    dormantProperties = null, awakenedProperties = null,
    exaltedProperties = null, mythicProperties = null,
    awakenedDeed = null, exaltedDeed = null, mythicDeed = null
  } = data;

  await dbRun(`
    INSERT INTO legendary_items (character_id, campaign_id, item_name, item_base_type, current_state,
      dormant_properties, awakened_properties, exalted_properties, mythic_properties,
      awakened_deed, exalted_deed, mythic_deed)
    VALUES (?, ?, ?, ?, 'dormant', ?, ?, ?, ?, ?, ?, ?)
  `, [
    characterId, campaignId, itemName, itemBaseType,
    dormantProperties ? JSON.stringify(dormantProperties) : null,
    awakenedProperties ? JSON.stringify(awakenedProperties) : null,
    exaltedProperties ? JSON.stringify(exaltedProperties) : null,
    mythicProperties ? JSON.stringify(mythicProperties) : null,
    awakenedDeed, exaltedDeed, mythicDeed
  ]);

  return dbGet('SELECT * FROM legendary_items WHERE character_id = ? AND item_name = ?', [characterId, itemName]);
}

/**
 * Advance a legendary item to a new state.
 */
export async function advanceItemState(itemId, newState, deed, gameDay = null) {
  const validStates = ['dormant', 'awakened', 'exalted', 'mythic'];
  if (!validStates.includes(newState)) {
    throw new Error(`Invalid item state: ${newState}`);
  }

  const item = await dbGet('SELECT * FROM legendary_items WHERE id = ?', [itemId]);
  if (!item) throw new Error(`Legendary item ${itemId} not found.`);

  const currentIdx = validStates.indexOf(item.current_state);
  const newIdx = validStates.indexOf(newState);
  if (newIdx <= currentIdx) {
    throw new Error(`Cannot regress item state from ${item.current_state} to ${newState}.`);
  }

  await dbRun(`
    UPDATE legendary_items SET current_state = ?, state_changed_game_day = ? WHERE id = ?
  `, [newState, gameDay, itemId]);

  return dbGet('SELECT * FROM legendary_items WHERE id = ?', [itemId]);
}

/**
 * Find a legendary item by name for a character.
 */
export async function findLegendaryItemByName(characterId, itemName) {
  return dbGet(
    'SELECT * FROM legendary_items WHERE character_id = ? AND item_name = ? COLLATE NOCASE',
    [characterId, itemName]
  );
}

// ============================================================
// HELPERS
// ============================================================

function parseItemJson(item) {
  if (!item) return null;
  return {
    ...item,
    dormant_properties: item.dormant_properties ? JSON.parse(item.dormant_properties) : null,
    awakened_properties: item.awakened_properties ? JSON.parse(item.awakened_properties) : null,
    exalted_properties: item.exalted_properties ? JSON.parse(item.exalted_properties) : null,
    mythic_properties: item.mythic_properties ? JSON.parse(item.mythic_properties) : null
  };
}
