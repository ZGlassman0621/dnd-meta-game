/**
 * World Event NPC Service
 *
 * Generates and applies NPC effects when world events advance stages.
 * Links the world event system to NPC lifecycle, disposition, and location.
 *
 * Effect types:
 * - disposition_shift → adjust NPC disposition toward player
 * - location_change → relocate NPC to a new location
 * - status_change → transition NPC lifecycle (missing/imprisoned/deceased)
 * - occupation_change → change NPC's occupation
 */

import { dbAll, dbGet, dbRun } from '../database.js';
import { getNpcsByLocation } from './npcRelationshipService.js';
import { adjustDisposition } from './npcRelationshipService.js';
import { transitionNpcStatus } from './npcLifecycleService.js';

// ============================================================
// EFFECT TYPE MAPPING: event_type × stage → effect types
// ============================================================

const EFFECT_MAP = {
  political: {
    0: ['disposition_shift'],
    1: ['disposition_shift'],
    2: ['location_change', 'status_change']
  },
  military: {
    0: [],
    1: ['location_change'],
    2: ['status_change', 'location_change']
  },
  natural_disaster: {
    0: [],
    1: ['location_change'],
    2: ['status_change', 'occupation_change']
  },
  economic: {
    0: ['disposition_shift'],
    1: ['occupation_change'],
    2: ['location_change']
  },
  conspiracy: {
    0: [],
    1: ['disposition_shift'],
    2: ['status_change']
  }
};

// Disposition shift amounts by event type
const DISPOSITION_SHIFTS = {
  political: { min: -15, max: 10 },
  military: { min: -20, max: -5 },
  natural_disaster: { min: -10, max: 15 },
  economic: { min: -15, max: 5 },
  conspiracy: { min: -20, max: -10 }
};

// Status changes by event type
const STATUS_TRANSITIONS = {
  political: ['imprisoned', 'missing'],
  military: ['deceased', 'missing'],
  natural_disaster: ['missing', 'deceased'],
  economic: ['missing'],
  conspiracy: ['imprisoned', 'missing', 'deceased']
};

// ============================================================
// CORE: GENERATE NPC EFFECTS FOR A STAGE ADVANCE
// ============================================================

/**
 * Generate NPC effects when a world event advances to a new stage.
 * Finds affected NPCs at event locations, creates event_effects rows,
 * and applies the effects.
 *
 * @param {object} event - The world event (parsed JSON fields)
 * @param {number} newStage - The stage the event just advanced to
 * @returns {object[]} - Array of effects created
 */
export async function generateNpcEffectsForEvent(event, newStage) {
  const effectTypes = EFFECT_MAP[event.event_type]?.[newStage] || [];
  if (effectTypes.length === 0) return [];

  // Find NPCs at affected locations
  const affectedNpcs = await findAffectedNpcs(event);
  if (affectedNpcs.length === 0) return [];

  const createdEffects = [];

  // Cap at 3 NPCs per stage to avoid overwhelming changes
  const npcsToAffect = affectedNpcs.slice(0, 3);

  for (const npc of npcsToAffect) {
    // Pick one effect type per NPC (first applicable)
    const effectType = pickEffectForNpc(effectTypes, npc, event);
    if (!effectType) continue;

    const effect = await createAndApplyEffect(event, npc, effectType, newStage);
    if (effect) {
      createdEffects.push(effect);
    }
  }

  // Update world_events.affected_npcs
  if (createdEffects.length > 0) {
    const existingNpcs = JSON.parse(event.affected_npcs || '[]');
    const newNpcIds = createdEffects.map(e => e.npc_id).filter(id => !existingNpcs.includes(id));
    const updatedNpcs = [...existingNpcs, ...newNpcIds];
    await dbRun('UPDATE world_events SET affected_npcs = ? WHERE id = ?', [
      JSON.stringify(updatedNpcs), event.id
    ]);
  }

  return createdEffects;
}

// ============================================================
// FIND AFFECTED NPCs
// ============================================================

/**
 * Find NPCs at the event's affected locations.
 * Only includes NPCs the player has met (exist in npc_relationships).
 */
async function findAffectedNpcs(event) {
  const locations = JSON.parse(event.affected_locations || '[]');
  if (locations.length === 0) return [];

  const allNpcs = [];
  const seenIds = new Set();

  for (const location of locations) {
    const locationName = typeof location === 'string' ? location : location.name;
    if (!locationName) continue;

    const npcs = await getNpcsByLocation(event.campaign_id, locationName);
    for (const npc of npcs) {
      if (!seenIds.has(npc.id)) {
        seenIds.add(npc.id);
        allNpcs.push(npc);
      }
    }
  }

  return allNpcs;
}

// ============================================================
// EFFECT CREATION & APPLICATION
// ============================================================

/**
 * Pick the most appropriate effect type for a specific NPC.
 */
function pickEffectForNpc(effectTypes, npc, event) {
  for (const type of effectTypes) {
    // Don't apply status_change to NPCs with very high disposition (they flee or are protected)
    if (type === 'status_change' && npc.disposition >= 50) continue;
    // Don't apply location_change if NPC has no known location
    if (type === 'location_change' && !npc.current_location) continue;
    return type;
  }
  // Fallback to first type
  return effectTypes[0] || null;
}

/**
 * Create an event_effects row and apply the effect.
 */
async function createAndApplyEffect(event, npc, effectType, stage) {
  const parameters = generateEffectParameters(event, npc, effectType);
  const description = generateEffectDescription(event, npc, effectType, parameters);

  // Insert event_effects row
  const result = await dbRun(`
    INSERT INTO event_effects (event_id, effect_type, description, target_type, target_id, parameters, stage_applied, status)
    VALUES (?, ?, ?, 'npc', ?, ?, ?, 'active')
  `, [event.id, effectType, description, npc.id, JSON.stringify(parameters), stage]);

  // Apply the effect
  await applyNpcEffect({
    id: result.lastInsertRowid,
    event_id: event.id,
    effect_type: effectType,
    target_id: npc.id,
    parameters,
    description
  }, npc);

  return {
    effect_id: result.lastInsertRowid,
    npc_id: npc.id,
    npc_name: npc.name,
    effect_type: effectType,
    description
  };
}

/**
 * Generate parameters for an effect based on type.
 */
function generateEffectParameters(event, npc, effectType) {
  switch (effectType) {
    case 'disposition_shift': {
      const range = DISPOSITION_SHIFTS[event.event_type] || { min: -10, max: 5 };
      const shift = Math.floor(Math.random() * (range.max - range.min + 1)) + range.min;
      return { shift, reason: `Affected by "${event.title}"` };
    }

    case 'location_change': {
      const locations = JSON.parse(event.affected_locations || '[]');
      // NPC flees to "outskirts" or "countryside" — away from danger
      const baseLocation = typeof locations[0] === 'string' ? locations[0] : locations[0]?.name || 'the area';
      return { new_location: `Outskirts of ${baseLocation}`, old_location: npc.current_location };
    }

    case 'status_change': {
      const transitions = STATUS_TRANSITIONS[event.event_type] || ['missing'];
      const newStatus = transitions[Math.floor(Math.random() * transitions.length)];
      return { new_status: newStatus, cause: `Caught in "${event.title}"` };
    }

    case 'occupation_change': {
      // Economic disruption changes occupations
      const disruptedOccupations = {
        merchant: 'displaced merchant',
        shopkeeper: 'displaced shopkeeper',
        trader: 'scavenger',
        farmer: 'refugee',
        innkeeper: 'refugee',
        artisan: 'laborer'
      };
      const occ = (npc.occupation || '').toLowerCase();
      let newOcc = npc.occupation;
      for (const [key, val] of Object.entries(disruptedOccupations)) {
        if (occ.includes(key)) { newOcc = val; break; }
      }
      return { new_occupation: newOcc, old_occupation: npc.occupation };
    }

    default:
      return {};
  }
}

/**
 * Generate a human-readable description for the effect.
 */
function generateEffectDescription(event, npc, effectType, parameters) {
  switch (effectType) {
    case 'disposition_shift':
      return `${npc.name}'s attitude shifted (${parameters.shift > 0 ? '+' : ''}${parameters.shift}) due to "${event.title}"`;
    case 'location_change':
      return `${npc.name} relocated from ${parameters.old_location || 'unknown'} to ${parameters.new_location}`;
    case 'status_change':
      return `${npc.name} is now ${parameters.new_status} — ${parameters.cause}`;
    case 'occupation_change':
      return `${npc.name}'s occupation changed from ${parameters.old_occupation} to ${parameters.new_occupation}`;
    default:
      return `${npc.name} affected by "${event.title}"`;
  }
}

// ============================================================
// APPLY EFFECTS
// ============================================================

/**
 * Apply a single NPC effect. Dispatches based on effect_type.
 */
async function applyNpcEffect(effect, npc) {
  const params = typeof effect.parameters === 'string'
    ? JSON.parse(effect.parameters)
    : effect.parameters;

  switch (effect.effect_type) {
    case 'disposition_shift':
      if (npc.character_id && params.shift) {
        await adjustDisposition(npc.character_id, npc.id, params.shift, params.reason);
      }
      break;

    case 'location_change':
      if (params.new_location) {
        await dbRun('UPDATE npcs SET current_location = ? WHERE id = ?', [params.new_location, effect.target_id]);
      }
      break;

    case 'status_change':
      if (params.new_status) {
        await transitionNpcStatus(effect.target_id, params.new_status, {
          cause: params.cause,
          campaignId: null // NPC status is global
        });
      }
      break;

    case 'occupation_change':
      if (params.new_occupation) {
        await dbRun('UPDATE npcs SET occupation = ? WHERE id = ?', [params.new_occupation, effect.target_id]);
      }
      break;
  }
}

// ============================================================
// QUERIES
// ============================================================

/**
 * Get all active NPC effects for a campaign.
 * Used by the DM prompt to inform the AI about NPC changes.
 */
export async function getActiveNpcEffects(campaignId) {
  return dbAll(`
    SELECT ee.id, ee.event_id, ee.effect_type, ee.description, ee.target_id as npc_id,
           ee.parameters, ee.stage_applied, ee.status,
           n.name as npc_name, n.occupation as npc_occupation, n.current_location as npc_location,
           we.title as event_title, we.event_type
    FROM event_effects ee
    JOIN npcs n ON ee.target_id = n.id
    JOIN world_events we ON ee.event_id = we.id
    WHERE we.campaign_id = ?
      AND ee.target_type = 'npc'
      AND ee.status = 'active'
      AND we.status = 'active'
    ORDER BY ee.created_at DESC
  `, [campaignId]);
}

/**
 * Resolve all NPC effects for a completed/resolved event.
 * Called when an event reaches its final stage or is manually resolved.
 */
export async function resolveNpcEffectsForEvent(eventId) {
  const effects = await dbAll(`
    SELECT id, effect_type, target_id, parameters FROM event_effects
    WHERE event_id = ? AND target_type = 'npc' AND status = 'active'
  `, [eventId]);

  for (const effect of effects) {
    await dbRun(`
      UPDATE event_effects SET status = 'resolved', reversed_at = CURRENT_TIMESTAMP,
        reversal_reason = 'Event resolved'
      WHERE id = ?
    `, [effect.id]);
  }

  return effects.length;
}
