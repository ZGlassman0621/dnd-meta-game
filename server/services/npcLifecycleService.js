/**
 * NPC Lifecycle Service
 *
 * Central authority for NPC lifecycle state transitions. All status changes
 * (alive → deceased, alive → missing, etc.) must go through this service.
 *
 * Provides:
 * - transitionNpcStatus() — single entry point for all status changes
 * - propagateNpcDeath() — cascade effects when an NPC dies
 * - syncDeathsFromCanonFacts() — bridge canon_facts death records to lifecycle state
 * - canRecruit() — guard for companion recruitment
 */

import { dbAll, dbGet, dbRun } from '../database.js';
import { emit } from './eventEmitter.js';
import { GAME_EVENTS } from '../config/eventTypes.js';

// Valid lifecycle statuses
const VALID_STATUSES = ['alive', 'deceased', 'missing', 'imprisoned', 'unknown'];

// Valid transitions: from → [allowed to states]
const VALID_TRANSITIONS = {
  alive: ['deceased', 'missing', 'imprisoned', 'unknown'],
  missing: ['alive', 'deceased', 'imprisoned', 'unknown'],
  imprisoned: ['alive', 'deceased', 'missing', 'unknown'],
  unknown: ['alive', 'deceased', 'missing', 'imprisoned'],
  deceased: [] // death is final
};

// ============================================================
// CORE STATUS TRANSITION
// ============================================================

/**
 * Transition an NPC to a new lifecycle status.
 * Single entry point for ALL status changes.
 *
 * @param {number} npcId
 * @param {string} newStatus - one of VALID_STATUSES
 * @param {object} details - { cause, gameDay, location, killer, sessionId, campaignId }
 * @returns {object} - { success, npc, transition }
 */
export async function transitionNpcStatus(npcId, newStatus, details = {}) {
  if (!VALID_STATUSES.includes(newStatus)) {
    throw new Error(`Invalid lifecycle status: ${newStatus}`);
  }

  const npc = await dbGet('SELECT id, name, lifecycle_status FROM npcs WHERE id = ?', [npcId]);
  if (!npc) {
    throw new Error(`NPC not found: ${npcId}`);
  }

  const oldStatus = npc.lifecycle_status || 'alive';

  // Check if transition is valid
  const allowed = VALID_TRANSITIONS[oldStatus] || [];
  if (!allowed.includes(newStatus)) {
    console.warn(`Invalid NPC lifecycle transition: ${oldStatus} → ${newStatus} for ${npc.name} (id: ${npcId})`);
    return { success: false, reason: `Cannot transition from ${oldStatus} to ${newStatus}` };
  }

  // Update the NPC record
  const updateFields = ['lifecycle_status = ?', 'status_changed_at = CURRENT_TIMESTAMP'];
  const updateValues = [newStatus];

  if (newStatus === 'deceased') {
    if (details.cause) { updateFields.push('death_cause = ?'); updateValues.push(details.cause); }
    if (details.gameDay) { updateFields.push('death_game_day = ?'); updateValues.push(details.gameDay); }
    if (details.location) { updateFields.push('death_location = ?'); updateValues.push(details.location); }
    if (details.killer) { updateFields.push('death_killer = ?'); updateValues.push(details.killer); }
    if (details.sessionId) { updateFields.push('death_session_id = ?'); updateValues.push(details.sessionId); }
  }

  updateValues.push(npcId);
  await dbRun(`UPDATE npcs SET ${updateFields.join(', ')} WHERE id = ?`, updateValues);

  // Record in lifecycle history
  await dbRun(`
    INSERT INTO npc_lifecycle_history (npc_id, campaign_id, old_status, new_status, cause, game_day, session_id, details)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    npcId,
    details.campaignId || null,
    oldStatus,
    newStatus,
    details.cause || null,
    details.gameDay || null,
    details.sessionId || null,
    details.details || null
  ]);

  // Emit appropriate event
  const eventType = newStatus === 'deceased' ? GAME_EVENTS.NPC_DECEASED : GAME_EVENTS.NPC_STATUS_CHANGED;
  await emit(eventType, {
    npcId,
    npcName: npc.name,
    oldStatus,
    newStatus,
    cause: details.cause,
    campaignId: details.campaignId,
    sessionId: details.sessionId
  });

  return {
    success: true,
    npc: { id: npcId, name: npc.name },
    transition: { from: oldStatus, to: newStatus }
  };
}

// ============================================================
// DEATH PROPAGATION CASCADE
// ============================================================

/**
 * Propagate NPC death across all related systems.
 * Call this whenever an NPC dies, regardless of source.
 *
 * Cascade:
 * 1. Transition NPC to deceased
 * 2. Mark any active companion record as deceased
 * 3. Create canon fact recording the death
 * 4. Void pending promises/debts
 * 5. Expire narrative queue items
 *
 * @param {number} npcId
 * @param {number} campaignId
 * @param {number} characterId
 * @param {object} details - { cause, gameDay, location, killer, sessionId }
 */
export async function propagateNpcDeath(npcId, campaignId, characterId, details = {}) {
  const npc = await dbGet('SELECT id, name, lifecycle_status FROM npcs WHERE id = ?', [npcId]);
  if (!npc) {
    throw new Error(`NPC not found: ${npcId}`);
  }

  // Already deceased — no-op
  if (npc.lifecycle_status === 'deceased') {
    return { success: true, alreadyDeceased: true };
  }

  // 1. Transition NPC to deceased
  const transition = await transitionNpcStatus(npcId, 'deceased', {
    ...details,
    campaignId
  });

  if (!transition.success) {
    return transition;
  }

  // 2. Mark any active companion record as deceased
  const activeCompanion = await dbGet(`
    SELECT id FROM companions
    WHERE npc_id = ? AND status = 'active'
  `, [npcId]);

  if (activeCompanion) {
    await dbRun(`
      UPDATE companions SET status = 'deceased', dismissed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [activeCompanion.id]);
  }

  // 3. Create canon fact
  const causeText = details.cause || 'unknown causes';
  const locationText = details.location ? ` at ${details.location}` : '';
  const killerText = details.killer ? ` by ${details.killer}` : '';
  const factText = `${npc.name} died${killerText} from ${causeText}${locationText}.`;

  await dbRun(`
    INSERT INTO canon_facts (campaign_id, character_id, category, subject, fact, source_session_id, game_day, importance)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    campaignId,
    characterId,
    'npc_death',
    npc.name,
    factText,
    details.sessionId || null,
    details.gameDay || null,
    'major'
  ]);

  // 4. Void pending promises/debts
  const relationship = await dbGet(`
    SELECT id, promises_made, debts_owed FROM npc_relationships
    WHERE character_id = ? AND npc_id = ?
  `, [characterId, npcId]);

  if (relationship) {
    let updated = false;
    let promises = [];
    let debts = [];

    try { promises = JSON.parse(relationship.promises_made || '[]'); } catch (e) { promises = []; }
    try { debts = JSON.parse(relationship.debts_owed || '[]'); } catch (e) { debts = []; }

    if (promises.length > 0) {
      promises = promises.map(p => {
        if (typeof p === 'string' && !p.includes('[DECEASED]')) return `${p} [DECEASED]`;
        if (typeof p === 'object' && p.text && !p.text.includes('[DECEASED]')) {
          return { ...p, text: `${p.text} [DECEASED]` };
        }
        return p;
      });
      updated = true;
    }

    if (debts.length > 0) {
      debts = debts.map(d => {
        if (typeof d === 'string' && !d.includes('[DECEASED]')) return `${d} [DECEASED]`;
        if (typeof d === 'object' && d.text && !d.text.includes('[DECEASED]')) {
          return { ...d, text: `${d.text} [DECEASED]` };
        }
        return d;
      });
      updated = true;
    }

    if (updated) {
      await dbRun(`
        UPDATE npc_relationships SET promises_made = ?, debts_owed = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [JSON.stringify(promises), JSON.stringify(debts), relationship.id]);
    }
  }

  // 5. Expire pending narrative queue items for this NPC
  await dbRun(`
    UPDATE narrative_queue SET status = 'expired'
    WHERE related_npc_id = ? AND status = 'pending'
  `, [npcId]);

  return { success: true, npcName: npc.name, companionMarked: !!activeCompanion };
}

// ============================================================
// CANON FACT SYNC
// ============================================================

/**
 * Sync deaths recorded as canon facts to NPC lifecycle status.
 * Bridge for deaths that went through the chronicle system but
 * weren't propagated to the npcs table.
 *
 * Called at session start to catch any missed deaths.
 */
export async function syncDeathsFromCanonFacts(campaignId) {
  const deathFacts = await dbAll(`
    SELECT cf.subject, cf.fact, cf.game_day, cf.source_session_id, cf.character_id
    FROM canon_facts cf
    WHERE cf.campaign_id = ? AND cf.category = 'npc_death' AND cf.is_active = 1
  `, [campaignId]);

  let synced = 0;

  for (const fact of deathFacts) {
    // Match by subject (NPC name)
    const npc = await dbGet(`
      SELECT id, lifecycle_status FROM npcs WHERE name = ? AND lifecycle_status != 'deceased'
    `, [fact.subject]);

    if (npc) {
      await transitionNpcStatus(npc.id, 'deceased', {
        cause: fact.fact,
        gameDay: fact.game_day,
        sessionId: fact.source_session_id,
        campaignId
      });
      synced++;
    }
  }

  if (synced > 0) {
    console.log(`[NPC Lifecycle] Synced ${synced} death(s) from canon facts for campaign ${campaignId}`);
  }

  return synced;
}

// ============================================================
// RECRUITMENT GUARD
// ============================================================

/**
 * Check if an NPC can be recruited as a companion.
 * Returns false if the NPC is deceased, missing, or imprisoned.
 */
export async function canRecruit(npcId) {
  const npc = await dbGet('SELECT lifecycle_status FROM npcs WHERE id = ?', [npcId]);
  if (!npc) return false;
  return (npc.lifecycle_status || 'alive') === 'alive';
}

// ============================================================
// HISTORY / QUERIES
// ============================================================

/**
 * Get lifecycle history for an NPC
 */
export async function getNpcLifecycleHistory(npcId) {
  return dbAll(`
    SELECT * FROM npc_lifecycle_history
    WHERE npc_id = ?
    ORDER BY created_at DESC
  `, [npcId]);
}

/**
 * Get all deceased NPCs for a campaign
 */
export async function getDeceasedNpcs(campaignId) {
  return dbAll(`
    SELECT n.id, n.name, n.race, n.occupation, n.death_cause, n.death_game_day,
           n.death_location, n.death_killer, n.death_session_id
    FROM npcs n
    JOIN npc_relationships r ON r.npc_id = n.id
    JOIN characters c ON r.character_id = c.id
    WHERE c.campaign_id = ? AND n.lifecycle_status = 'deceased'
    GROUP BY n.id
  `, [campaignId]);
}
