/**
 * NPC Aging & Absence Service
 *
 * Applies time-based effects to NPC relationships:
 * - Disposition decay: NPCs gradually cool toward absent players
 * - Trust decay: Trust erodes slower than disposition
 * - Absence thresholds: Extreme absence causes relocation or forgetting
 * - Reunion boost: Returning to an NPC after absence gets a warmth bonus
 *
 * Called at session start (like decayMoods), NOT during living world tick,
 * to avoid compounding decay during long real-world breaks.
 */

import { dbAll, dbRun } from '../database.js';
import { adjustDisposition, getRelationshipById } from './npcRelationshipService.js';

// ============================================================
// DECAY FORMULAS (exported for testing)
// ============================================================

/**
 * Calculate disposition decay based on days absent.
 *
 * @param {number} daysAbsent - Game days since last interaction
 * @param {number} currentDisposition - Current disposition value (-100 to 100)
 * @param {object} options - { highTrust: boolean }
 * @returns {number} Negative decay amount (0 means no decay)
 */
export function calculateDispositionDecay(daysAbsent, currentDisposition, options = {}) {
  if (daysAbsent <= 7) return 0;

  let decay = 0;

  if (daysAbsent <= 30) {
    // 8-30 days: -1 per 5 days
    decay = Math.floor((daysAbsent - 7) / 5);
  } else if (daysAbsent <= 90) {
    // First 23 days (8-30): fixed at 4
    // 31-90 days: -1 per 3 days
    decay = 4 + Math.floor((daysAbsent - 30) / 3);
  } else {
    // First 23 days: 4, next 60 days (31-90): 20
    // 90+ days: -2 per 3 days
    decay = 24 + Math.floor((daysAbsent - 90) / 3) * 2;
  }

  // High-trust NPCs decay at half rate
  if (options.highTrust) {
    decay = Math.floor(decay / 2);
  }

  // Floor: disposition can't drop below -20 from decay alone
  const minDisposition = -20;
  const maxDecay = Math.max(0, currentDisposition - minDisposition);

  return Math.min(decay, maxDecay);
}

/**
 * Calculate trust decay based on days absent.
 * Trust decays slower than disposition.
 *
 * @param {number} daysAbsent - Game days since last interaction
 * @param {number} currentTrust - Current trust value (-100 to 100)
 * @returns {number} Negative decay amount (0 means no decay)
 */
export function calculateTrustDecay(daysAbsent, currentTrust) {
  if (daysAbsent <= 14) return 0;
  if (currentTrust <= 0) return 0; // Floor: trust can't drop below 0 from decay

  let decay = 0;

  if (daysAbsent <= 60) {
    // 15-60 days: -1 per 10 days
    decay = Math.floor((daysAbsent - 14) / 10);
  } else {
    // First 46 days (15-60): fixed
    const firstPhase = Math.floor(46 / 10); // 4
    // 60+ days: -1 per 5 days
    decay = firstPhase + Math.floor((daysAbsent - 60) / 5);
  }

  // Floor: trust can't drop below 0 from decay
  return Math.min(decay, currentTrust);
}

/**
 * Check for extreme absence effects.
 *
 * @param {object} rel - NPC relationship object
 * @param {number} daysAbsent - Game days since last interaction
 * @returns {object|null} Effect to apply, or null
 */
export function checkAbsenceThreshold(rel, daysAbsent) {
  // 60+ days absent + negative disposition: NPC may relocate (10% chance)
  if (daysAbsent >= 60 && rel.disposition < 0) {
    if (Math.random() < 0.1) {
      return { type: 'relocate', reason: `${rel.npc_name || 'NPC'} moved away after prolonged absence` };
    }
  }

  // 120+ days absent + very low trust: NPC "forgets" player
  if (daysAbsent >= 120 && rel.trust_level < 10) {
    return { type: 'forget', reason: `${rel.npc_name || 'NPC'} no longer remembers you well` };
  }

  return null;
}

// ============================================================
// MAIN PROCESSING
// ============================================================

/**
 * Process absence effects for all NPC relationships of a character.
 * Called at session start.
 *
 * @param {number} characterId - Character ID
 * @param {number} currentGameDay - Current game day
 * @returns {object} Summary of effects applied
 */
export async function processAbsenceEffects(characterId, currentGameDay) {
  if (!currentGameDay) return { processed: 0 };

  // Get all NPC relationships with game day tracking
  const relationships = await dbAll(`
    SELECT r.id, r.character_id, r.npc_id, r.disposition, r.trust_level,
           r.last_interaction_game_day, r.times_met,
           n.name as npc_name, n.lifecycle_status, n.current_location
    FROM npc_relationships r
    JOIN npcs n ON r.npc_id = n.id
    WHERE r.character_id = ?
      AND r.last_interaction_game_day IS NOT NULL
      AND n.lifecycle_status = 'alive'
  `, [characterId]);

  const results = {
    processed: 0,
    dispositionDecayed: 0,
    trustDecayed: 0,
    relocated: 0,
    forgotten: 0
  };

  for (const rel of relationships) {
    const daysAbsent = currentGameDay - rel.last_interaction_game_day;
    if (daysAbsent <= 0) continue;

    results.processed++;

    // Disposition decay
    const highTrust = rel.trust_level >= 50;
    const dispDecay = calculateDispositionDecay(daysAbsent, rel.disposition, { highTrust });
    if (dispDecay > 0) {
      await dbRun(`
        UPDATE npc_relationships SET
          disposition = disposition - ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [dispDecay, rel.id]);
      results.dispositionDecayed++;
    }

    // Trust decay
    const trustDecay = calculateTrustDecay(daysAbsent, rel.trust_level);
    if (trustDecay > 0) {
      await dbRun(`
        UPDATE npc_relationships SET
          trust_level = trust_level - ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [trustDecay, rel.id]);
      results.trustDecayed++;
    }

    // Extreme absence effects
    const threshold = checkAbsenceThreshold(rel, daysAbsent);
    if (threshold) {
      if (threshold.type === 'relocate' && rel.current_location) {
        await dbRun(`
          UPDATE npcs SET current_location = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
        `, [`Unknown (left ${rel.current_location})`, rel.npc_id]);
        results.relocated++;
      } else if (threshold.type === 'forget') {
        // Reset to stranger-level
        await dbRun(`
          UPDATE npc_relationships SET
            disposition = 0, trust_level = 0,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `, [rel.id]);
        results.forgotten++;
      }
    }
  }

  return results;
}

/**
 * Apply a reunion boost when a player re-encounters an NPC after 14+ days.
 *
 * @param {number} characterId - Character ID
 * @param {number} npcId - NPC ID
 * @param {number} currentGameDay - Current game day
 */
export async function applyReunionBoost(characterId, npcId, currentGameDay) {
  await adjustDisposition(characterId, npcId, 3, 'Reunion after time apart');
}
