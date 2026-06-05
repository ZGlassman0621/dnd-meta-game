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

import { dbAll, dbGet, dbRun } from '../database.js';
import { adjustDisposition, getRelationshipById } from './npcRelationshipService.js';
import {
  registerDecayConsumer,
  registerThresholdConsumer,
  DECAY_SEMANTICS
} from './timeBoundedState.js';

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
// PATTERN D CONSUMERS (Phase 3.3 SC-7.2 — second port)
// ============================================================
//
// Four consumers built from the timeBoundedState primitives:
//   - DISPOSITION_DECAY_CONSUMER (high-water-mark, calls calculateDispositionDecay)
//   - TRUST_DECAY_CONSUMER (high-water-mark, calls calculateTrustDecay)
//   - RELOCATION_THRESHOLD_CONSUMER (60d threshold, 10% probability roll)
//   - FORGET_THRESHOLD_CONSUMER (120d threshold, deterministic)
//
// Both decays read from the SAME anchor (last_interaction_game_day) but
// against different value columns (disposition, trust_level). Validates
// the spec's "dual-scalar reading from one anchor" pattern (mirror of
// Pattern A's NPC disposition+trust dual-scalar from SC-4).
//
// **Idempotency via natural fired-once markers (fix-along-the-way per
// Phase 3.2's named pattern):**
//   - Relocate: location starts with `Unknown (left ` after first fire.
//     Legacy had no idempotency → 10% roll could re-fire next session,
//     compounding the prefix into `Unknown (left Unknown (left X))`.
//     Migration adds the prefix-check as natural idempotency, fixing
//     the latent compound-prefix bug as a side effect.
//   - Forget: disposition=0 AND trust_level=0 after first fire. Legacy
//     had no idempotency → wasted UPDATE on every subsequent tick.
//     Migration adds the both-zero check as natural idempotency.
// Both fixes are documented in DECISION_LOG + KNOWN_BUGS.md archive.

const DISPOSITION_DECAY_CONSUMER = registerDecayConsumer({
  name: 'npc_disposition_absence_decay',
  semantics: DECAY_SEMANTICS.HIGH_WATER_MARK,
  decayFunction: (daysElapsed, currentDisposition, hints) =>
    calculateDispositionDecay(daysElapsed, currentDisposition, { highTrust: hints?.highTrust }),
  // Floor enforced internally by calculateDispositionDecay (caps decay so
  // disposition never drops below -20 from absence alone). Schema-level
  // -100 floor here as a safety net for the abstraction's clamp.
  floor: -100,
  ceiling: 100,
  repository: {
    async readAnchor(contextKey) {
      const row = await dbGet(
        'SELECT last_interaction_game_day FROM npc_relationships WHERE id = ?',
        [contextKey.relationshipId]
      );
      return row ? row.last_interaction_game_day : null;
    },
    async readValue(contextKey) {
      const row = await dbGet(
        'SELECT disposition FROM npc_relationships WHERE id = ?',
        [contextKey.relationshipId]
      );
      return row ? row.disposition : 0;
    },
    async writeValue(contextKey, newValue) {
      await dbRun(
        `UPDATE npc_relationships SET disposition = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [newValue, contextKey.relationshipId]
      );
    }
  }
});

const TRUST_DECAY_CONSUMER = registerDecayConsumer({
  name: 'npc_trust_absence_decay',
  semantics: DECAY_SEMANTICS.HIGH_WATER_MARK,
  decayFunction: (daysElapsed, currentTrust) => calculateTrustDecay(daysElapsed, currentTrust),
  // Floor enforced internally by calculateTrustDecay (caps decay so trust
  // never drops below 0 from absence alone). Schema-level -100 here as
  // safety net.
  floor: -100,
  ceiling: 100,
  repository: {
    async readAnchor(contextKey) {
      const row = await dbGet(
        'SELECT last_interaction_game_day FROM npc_relationships WHERE id = ?',
        [contextKey.relationshipId]
      );
      return row ? row.last_interaction_game_day : null;
    },
    async readValue(contextKey) {
      const row = await dbGet(
        'SELECT trust_level FROM npc_relationships WHERE id = ?',
        [contextKey.relationshipId]
      );
      return row ? row.trust_level : 0;
    },
    async writeValue(contextKey, newValue) {
      await dbRun(
        `UPDATE npc_relationships SET trust_level = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [newValue, contextKey.relationshipId]
      );
    }
  }
});

// **First exercise of the probability parameter** per spec Q8 + DECISION_LOG
// 2026-05-05 SC-7.1 stochastic threshold support note. 10% roll per
// session-start tick when threshold (60d absence) + condition (negative
// disposition) both hold. Failed rolls don't record idempotency — next
// tick can roll again.
const RELOCATION_THRESHOLD_CONSUMER = registerThresholdConsumer({
  name: 'npc_relocation_on_long_absence',
  threshold: 60,
  probability: 0.1,
  handler: async (contextKey, daysElapsed) => {
    // Legacy condition: disposition < 0 (only relocate NPCs the player
    // has alienated). Consumer-side filter inside handler — abstraction
    // doesn't need a generic "condition" parameter for one consumer.
    const rel = await dbGet(
      `SELECT r.disposition, n.id as npc_id, n.current_location
       FROM npc_relationships r
       JOIN npcs n ON r.npc_id = n.id
       WHERE r.id = ?`,
      [contextKey.relationshipId]
    );
    if (!rel || rel.disposition >= 0 || !rel.current_location) {
      return { fired: false, reason: 'condition_not_met' };
    }
    await dbRun(
      `UPDATE npcs SET current_location = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [`Unknown (left ${rel.current_location})`, rel.npc_id]
    );
    return { relocated: true, fromLocation: rel.current_location, npcId: rel.npc_id };
  },
  idempotency: {
    // Fix-along-the-way: legacy had no idempotency → compound prefix
    // bug (`Unknown (left Unknown (left X))`). Detecting the prefix
    // post-fire prevents re-fire. Captured in KNOWN_BUGS.md archive.
    async hasFiredRecently(contextKey) {
      const row = await dbGet(
        `SELECT n.current_location
         FROM npcs n
         JOIN npc_relationships r ON r.npc_id = n.id
         WHERE r.id = ?`,
        [contextKey.relationshipId]
      );
      return row?.current_location?.startsWith('Unknown (left ') ?? false;
    },
    // No-op: idempotency state is computed from current_location prefix,
    // which the handler already wrote. Nothing additional to record.
    async recordFired() { /* implicit via handler's location update */ }
  },
  repository: {
    async readAnchor(contextKey) {
      const row = await dbGet(
        'SELECT last_interaction_game_day FROM npc_relationships WHERE id = ?',
        [contextKey.relationshipId]
      );
      return row ? row.last_interaction_game_day : null;
    }
  }
});

const FORGET_THRESHOLD_CONSUMER = registerThresholdConsumer({
  name: 'npc_forget_on_extreme_absence',
  threshold: 120,
  // Deterministic — no probability. The legacy condition (trust_level < 10)
  // is consumer-side in the handler.
  handler: async (contextKey) => {
    const rel = await dbGet(
      'SELECT trust_level FROM npc_relationships WHERE id = ?',
      [contextKey.relationshipId]
    );
    if (!rel || rel.trust_level >= 10) {
      return { fired: false, reason: 'trust_above_forget_threshold' };
    }
    await dbRun(
      `UPDATE npc_relationships SET
         disposition = 0, trust_level = 0,
         updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [contextKey.relationshipId]
    );
    return { forgotten: true };
  },
  idempotency: {
    // Fix-along-the-way: legacy fired forget repeatedly (wasted UPDATEs)
    // because no idempotency. Once forgotten, both scalars sit at 0;
    // checking for that signature blocks re-fire. Pure perf win — no
    // player-visible behavior change.
    async hasFiredRecently(contextKey) {
      const row = await dbGet(
        'SELECT disposition, trust_level FROM npc_relationships WHERE id = ?',
        [contextKey.relationshipId]
      );
      return row != null && row.disposition === 0 && row.trust_level === 0;
    },
    async recordFired() { /* implicit via handler's both-zero write */ }
  },
  repository: {
    async readAnchor(contextKey) {
      const row = await dbGet(
        'SELECT last_interaction_game_day FROM npc_relationships WHERE id = ?',
        [contextKey.relationshipId]
      );
      return row ? row.last_interaction_game_day : null;
    }
  }
});

// Exported for direct test access. Production callers use processAbsenceEffects.
export {
  DISPOSITION_DECAY_CONSUMER,
  TRUST_DECAY_CONSUMER,
  RELOCATION_THRESHOLD_CONSUMER,
  FORGET_THRESHOLD_CONSUMER
};

// ============================================================
// MAIN PROCESSING
// ============================================================

/**
 * Process absence effects for all NPC relationships of a character.
 * Called at session start.
 *
 * Phase 3.3 SC-7.3: per-relationship decay + threshold logic delegated
 * to the four Pattern D consumers above. Orchestrator stays consumer-
 * side (SELECT scope decision: alive NPCs the character has met).
 * Same shape as SC-7.2's decayMoods orchestrator.
 *
 * Performance note: per relationship, the abstraction does ~6-10 round
 * trips (2 readAnchor + 2 readValue + up to 2 writeValue + 2 readAnchor
 * for thresholds + idempotency reads). Legacy did ~2-3. Acceptable for
 * session-start; see DECISION_LOG SC-7.3 for the trade-off rationale.
 *
 * @param {number} characterId - Character ID
 * @param {number} currentGameDay - Current game day
 * @returns {object} Summary of effects applied
 */
export async function processAbsenceEffects(characterId, currentGameDay) {
  if (!currentGameDay) return { processed: 0 };

  const relationships = await dbAll(`
    SELECT r.id
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
    const contextKey = { relationshipId: rel.id };
    results.processed++;

    // High-trust hint — read fresh per rel since other consumers may have
    // mutated state earlier in this same tick.
    const trustRow = await dbGet(
      'SELECT trust_level FROM npc_relationships WHERE id = ?',
      [rel.id]
    );
    const highTrust = (trustRow?.trust_level ?? 0) >= 50;

    const dispResult = await DISPOSITION_DECAY_CONSUMER.applyDecay(contextKey, currentGameDay, { highTrust });
    if (dispResult) results.dispositionDecayed++;

    const trustResult = await TRUST_DECAY_CONSUMER.applyDecay(contextKey, currentGameDay);
    if (trustResult) results.trustDecayed++;

    const relocateResult = await RELOCATION_THRESHOLD_CONSUMER.checkAndFire(contextKey, currentGameDay);
    if (relocateResult.fired && relocateResult.handlerResult?.relocated) results.relocated++;

    const forgetResult = await FORGET_THRESHOLD_CONSUMER.checkAndFire(contextKey, currentGameDay);
    if (forgetResult.fired && forgetResult.handlerResult?.forgotten) results.forgotten++;
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
