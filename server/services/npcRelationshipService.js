import { dbAll, dbGet, dbRun } from '../database.js';

/**
 * NPC Relationship Service - CRUD operations for character-NPC relationships
 */

/**
 * Create or get a relationship (upsert pattern)
 */
export async function getOrCreateRelationship(characterId, npcId) {
  let rel = await getRelationship(characterId, npcId);
  if (!rel) {
    rel = await createRelationship({ character_id: characterId, npc_id: npcId });
  }
  return rel;
}

/**
 * Create a new relationship
 */
export async function createRelationship(data) {
  const {
    character_id,
    npc_id,
    disposition = 0,
    trust_level = 0,
    first_met_date = null,
    first_met_location_id = null
  } = data;

  const dispositionLabel = getDispositionLabel(disposition);

  const result = await dbRun(`
    INSERT INTO npc_relationships (
      character_id, npc_id, disposition, disposition_label, trust_level,
      times_met, first_met_date, first_met_location_id
    ) VALUES (?, ?, ?, ?, ?, 1, ?, ?)
  `, [character_id, npc_id, disposition, dispositionLabel, trust_level, first_met_date, first_met_location_id]);

  return getRelationshipById(result.lastInsertRowid);
}

/**
 * Get a relationship by ID
 */
export async function getRelationshipById(id) {
  const rel = await dbGet('SELECT * FROM npc_relationships WHERE id = ?', [id]);
  return rel ? parseRelationshipJson(rel) : null;
}

/**
 * Get a relationship between a character and NPC
 */
export async function getRelationship(characterId, npcId) {
  const rel = await dbGet(
    'SELECT * FROM npc_relationships WHERE character_id = ? AND npc_id = ?',
    [characterId, npcId]
  );
  return rel ? parseRelationshipJson(rel) : null;
}

/**
 * Get all relationships for a character
 */
export async function getCharacterRelationships(characterId) {
  const rels = await dbAll(
    'SELECT * FROM npc_relationships WHERE character_id = ? ORDER BY disposition DESC',
    [characterId]
  );
  return rels.map(parseRelationshipJson);
}

/**
 * Get all relationships for a character with NPC details
 */
export async function getCharacterRelationshipsWithNpcs(characterId) {
  const rels = await dbAll(`
    SELECT r.*, n.name as npc_name, n.race as npc_race, n.occupation as npc_occupation,
           n.current_location as npc_location, n.avatar as npc_avatar
    FROM npc_relationships r
    JOIN npcs n ON r.npc_id = n.id
    WHERE r.character_id = ?
    ORDER BY r.disposition DESC
  `, [characterId]);
  return rels.map(parseRelationshipJson);
}

/**
 * Get relationships by disposition level
 */
export async function getRelationshipsByDisposition(characterId, minDisposition, maxDisposition = 100) {
  const rels = await dbAll(`
    SELECT * FROM npc_relationships
    WHERE character_id = ? AND disposition >= ? AND disposition <= ?
    ORDER BY disposition DESC
  `, [characterId, minDisposition, maxDisposition]);
  return rels.map(parseRelationshipJson);
}

/**
 * Get allied NPCs (disposition >= 50)
 */
export async function getAlliedNpcs(characterId) {
  return getRelationshipsByDisposition(characterId, 50);
}

/**
 * Get hostile NPCs (disposition <= -50)
 */
export async function getHostileNpcs(characterId) {
  return getRelationshipsByDisposition(characterId, -100, -50);
}

/**
 * Update a relationship
 */
export async function updateRelationship(id, data) {
  const rel = await getRelationshipById(id);
  if (!rel) return null;

  const updates = { ...rel, ...data };

  // Recalculate disposition label if disposition changed
  if (data.disposition !== undefined) {
    updates.disposition_label = getDispositionLabel(data.disposition);
  }

  await dbRun(`
    UPDATE npc_relationships SET
      disposition = ?, disposition_label = ?, trust_level = ?,
      times_met = ?, last_interaction_date = ?,
      witnessed_deeds = ?, known_facts = ?, rumors_heard = ?,
      player_known_facts = ?, discovered_secrets = ?,
      promises_made = ?, debts_owed = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [
    updates.disposition, updates.disposition_label, updates.trust_level,
    updates.times_met, updates.last_interaction_date,
    JSON.stringify(updates.witnessed_deeds),
    JSON.stringify(updates.known_facts),
    JSON.stringify(updates.rumors_heard),
    JSON.stringify(updates.player_known_facts),
    JSON.stringify(updates.discovered_secrets),
    JSON.stringify(updates.promises_made),
    JSON.stringify(updates.debts_owed),
    id
  ]);

  return getRelationshipById(id);
}

/**
 * Adjust disposition (add/subtract from current value)
 */
export async function adjustDisposition(characterId, npcId, change, reason = null) {
  const rel = await getOrCreateRelationship(characterId, npcId);

  const newDisposition = Math.max(-100, Math.min(100, rel.disposition + change));
  const newLabel = getDispositionLabel(newDisposition);

  // Add to witnessed deeds if reason provided
  let witnessedDeeds = rel.witnessed_deeds || [];
  if (reason) {
    witnessedDeeds.push({
      deed: reason,
      impact: change,
      date: new Date().toISOString()
    });
  }

  await dbRun(`
    UPDATE npc_relationships SET
      disposition = ?, disposition_label = ?,
      witnessed_deeds = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [newDisposition, newLabel, JSON.stringify(witnessedDeeds), rel.id]);

  return getRelationshipById(rel.id);
}

/**
 * Adjust trust level
 */
export async function adjustTrust(characterId, npcId, change) {
  const rel = await getOrCreateRelationship(characterId, npcId);

  const newTrust = Math.max(-100, Math.min(100, rel.trust_level + change));

  await dbRun(`
    UPDATE npc_relationships SET trust_level = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
  `, [newTrust, rel.id]);

  return getRelationshipById(rel.id);
}

/**
 * Record an interaction (increments times_met, updates last_interaction_date)
 */
export async function recordInteraction(characterId, npcId, gameDate = null) {
  const rel = await getOrCreateRelationship(characterId, npcId);

  await dbRun(`
    UPDATE npc_relationships SET
      times_met = times_met + 1,
      last_interaction_date = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [gameDate || new Date().toISOString(), rel.id]);

  return getRelationshipById(rel.id);
}

/**
 * Add a known fact (what NPC knows about character)
 */
export async function addKnownFact(characterId, npcId, fact) {
  const rel = await getOrCreateRelationship(characterId, npcId);

  const knownFacts = rel.known_facts || [];
  if (!knownFacts.includes(fact)) {
    knownFacts.push(fact);
    await dbRun(`
      UPDATE npc_relationships SET known_facts = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `, [JSON.stringify(knownFacts), rel.id]);
  }

  return getRelationshipById(rel.id);
}

/**
 * Add a player-known fact (what character knows about NPC)
 */
export async function addPlayerKnownFact(characterId, npcId, fact) {
  const rel = await getOrCreateRelationship(characterId, npcId);

  const playerFacts = rel.player_known_facts || [];
  if (!playerFacts.includes(fact)) {
    playerFacts.push(fact);
    await dbRun(`
      UPDATE npc_relationships SET player_known_facts = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `, [JSON.stringify(playerFacts), rel.id]);
  }

  return getRelationshipById(rel.id);
}

/**
 * Discover an NPC secret
 */
export async function discoverSecret(characterId, npcId, secret) {
  const rel = await getOrCreateRelationship(characterId, npcId);

  const secrets = rel.discovered_secrets || [];
  if (!secrets.includes(secret)) {
    secrets.push(secret);
    await dbRun(`
      UPDATE npc_relationships SET discovered_secrets = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `, [JSON.stringify(secrets), rel.id]);
  }

  return getRelationshipById(rel.id);
}

/**
 * Add a promise
 */
export async function addPromise(characterId, npcId, promise) {
  const rel = await getOrCreateRelationship(characterId, npcId);

  const promises = rel.promises_made || [];
  promises.push({
    promise,
    made_date: new Date().toISOString(),
    status: 'pending'
  });

  await dbRun(`
    UPDATE npc_relationships SET promises_made = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
  `, [JSON.stringify(promises), rel.id]);

  return getRelationshipById(rel.id);
}

/**
 * Fulfill a promise
 */
export async function fulfillPromise(characterId, npcId, promiseIndex) {
  const rel = await getOrCreateRelationship(characterId, npcId);

  const promises = rel.promises_made || [];
  if (promises[promiseIndex]) {
    promises[promiseIndex].status = 'fulfilled';
    promises[promiseIndex].fulfilled_date = new Date().toISOString();

    await dbRun(`
      UPDATE npc_relationships SET promises_made = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `, [JSON.stringify(promises), rel.id]);
  }

  return getRelationshipById(rel.id);
}

/**
 * Add a debt
 */
export async function addDebt(characterId, npcId, debt) {
  const rel = await getOrCreateRelationship(characterId, npcId);

  const debts = rel.debts_owed || [];
  debts.push({
    type: debt.type || 'favor',
    description: debt.description,
    direction: debt.direction || 'npc_owes_player', // or 'player_owes_npc'
    created_date: new Date().toISOString(),
    status: 'outstanding'
  });

  await dbRun(`
    UPDATE npc_relationships SET debts_owed = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
  `, [JSON.stringify(debts), rel.id]);

  return getRelationshipById(rel.id);
}

/**
 * Delete a relationship
 */
export async function deleteRelationship(id) {
  const result = await dbRun('DELETE FROM npc_relationships WHERE id = ?', [id]);
  return result.changes > 0;
}

// ============================================================
// ENHANCED RELATIONSHIP METHODS (Phase 2)
// ============================================================

/**
 * Add a rumor the NPC has heard about the character
 */
export async function addRumorHeard(characterId, npcId, rumor) {
  const rel = await getOrCreateRelationship(characterId, npcId);

  const rumors = rel.rumors_heard || [];
  rumors.push({
    rumor,
    heard_date: new Date().toISOString(),
    believed: true // NPC believes the rumor by default
  });

  await dbRun(`
    UPDATE npc_relationships SET rumors_heard = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
  `, [JSON.stringify(rumors), rel.id]);

  return getRelationshipById(rel.id);
}

/**
 * Mark a rumor as disproven
 */
export async function disproveRumor(characterId, npcId, rumorIndex) {
  const rel = await getOrCreateRelationship(characterId, npcId);

  const rumors = rel.rumors_heard || [];
  if (rumors[rumorIndex]) {
    rumors[rumorIndex].believed = false;
    rumors[rumorIndex].disproven_date = new Date().toISOString();

    await dbRun(`
      UPDATE npc_relationships SET rumors_heard = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `, [JSON.stringify(rumors), rel.id]);
  }

  return getRelationshipById(rel.id);
}

/**
 * Break a promise (has negative consequences)
 */
export async function breakPromise(characterId, npcId, promiseIndex, reason = null) {
  const rel = await getOrCreateRelationship(characterId, npcId);

  const promises = rel.promises_made || [];
  if (promises[promiseIndex] && promises[promiseIndex].status === 'pending') {
    promises[promiseIndex].status = 'broken';
    promises[promiseIndex].broken_date = new Date().toISOString();
    promises[promiseIndex].broken_reason = reason;

    await dbRun(`
      UPDATE npc_relationships SET promises_made = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `, [JSON.stringify(promises), rel.id]);

    // Breaking a promise should negatively impact disposition
    await adjustDisposition(characterId, npcId, -15, 'Broke a promise');
  }

  return getRelationshipById(rel.id);
}

/**
 * Settle a debt
 */
export async function settleDebt(characterId, npcId, debtIndex, howSettled = null) {
  const rel = await getOrCreateRelationship(characterId, npcId);

  const debts = rel.debts_owed || [];
  if (debts[debtIndex] && debts[debtIndex].status === 'outstanding') {
    debts[debtIndex].status = 'settled';
    debts[debtIndex].settled_date = new Date().toISOString();
    debts[debtIndex].how_settled = howSettled;

    await dbRun(`
      UPDATE npc_relationships SET debts_owed = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `, [JSON.stringify(debts), rel.id]);

    // Settling a debt improves disposition
    const dispositionBonus = debts[debtIndex].direction === 'player_owes_npc' ? 10 : 5;
    await adjustDisposition(characterId, npcId, dispositionBonus, 'Settled a debt');
  }

  return getRelationshipById(rel.id);
}

/**
 * Forgive a debt (either party can forgive)
 */
export async function forgiveDebt(characterId, npcId, debtIndex) {
  const rel = await getOrCreateRelationship(characterId, npcId);

  const debts = rel.debts_owed || [];
  if (debts[debtIndex] && debts[debtIndex].status === 'outstanding') {
    debts[debtIndex].status = 'forgiven';
    debts[debtIndex].forgiven_date = new Date().toISOString();

    await dbRun(`
      UPDATE npc_relationships SET debts_owed = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `, [JSON.stringify(debts), rel.id]);

    // Forgiving a debt is a positive action
    await adjustDisposition(characterId, npcId, 8, 'Debt was forgiven');
  }

  return getRelationshipById(rel.id);
}

/**
 * Get all NPCs who have heard a specific rumor (for rumor spreading)
 */
export async function getNpcsWhoHeardRumor(characterId, rumorText) {
  const rels = await getCharacterRelationships(characterId);
  return rels.filter(rel => {
    const rumors = rel.rumors_heard || [];
    return rumors.some(r => r.rumor.toLowerCase().includes(rumorText.toLowerCase()) && r.believed);
  });
}

/**
 * Get all pending promises for a character
 */
export async function getPendingPromises(characterId) {
  const rels = await getCharacterRelationships(characterId);
  const pendingPromises = [];

  for (const rel of rels) {
    const promises = rel.promises_made || [];
    promises.forEach((promise, index) => {
      if (promise.status === 'pending') {
        pendingPromises.push({
          npc_id: rel.npc_id,
          relationship_id: rel.id,
          promise_index: index,
          ...promise
        });
      }
    });
  }

  return pendingPromises;
}

/**
 * Get all outstanding debts for a character
 */
export async function getOutstandingDebts(characterId) {
  const rels = await getCharacterRelationships(characterId);
  const outstandingDebts = [];

  for (const rel of rels) {
    const debts = rel.debts_owed || [];
    debts.forEach((debt, index) => {
      if (debt.status === 'outstanding') {
        outstandingDebts.push({
          npc_id: rel.npc_id,
          relationship_id: rel.id,
          debt_index: index,
          ...debt
        });
      }
    });
  }

  return outstandingDebts;
}

/**
 * Get NPCs with specific disposition range
 */
export async function getNpcsByDispositionLabel(characterId, label) {
  const rels = await dbAll(`
    SELECT r.*, n.name as npc_name
    FROM npc_relationships r
    JOIN npcs n ON r.npc_id = n.id
    WHERE r.character_id = ? AND r.disposition_label = ?
    ORDER BY r.disposition DESC
  `, [characterId, label]);
  return rels.map(parseRelationshipJson);
}

/**
 * Get relationship summary for a character
 */
export async function getRelationshipSummary(characterId) {
  const rels = await getCharacterRelationships(characterId);

  const summary = {
    total: rels.length,
    by_disposition: {
      devoted: 0,
      allied: 0,
      friendly: 0,
      neutral: 0,
      unfriendly: 0,
      hostile: 0,
      nemesis: 0
    },
    pending_promises: 0,
    outstanding_debts_owed: 0,
    outstanding_debts_owed_to_player: 0,
    total_secrets_discovered: 0
  };

  for (const rel of rels) {
    // Count by disposition
    if (summary.by_disposition[rel.disposition_label] !== undefined) {
      summary.by_disposition[rel.disposition_label]++;
    }

    // Count pending promises
    const promises = rel.promises_made || [];
    summary.pending_promises += promises.filter(p => p.status === 'pending').length;

    // Count outstanding debts
    const debts = rel.debts_owed || [];
    for (const debt of debts) {
      if (debt.status === 'outstanding') {
        if (debt.direction === 'player_owes_npc') {
          summary.outstanding_debts_owed++;
        } else {
          summary.outstanding_debts_owed_to_player++;
        }
      }
    }

    // Count secrets
    const secrets = rel.discovered_secrets || [];
    summary.total_secrets_discovered += secrets.length;
  }

  return summary;
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function parseRelationshipJson(rel) {
  return {
    ...rel,
    witnessed_deeds: JSON.parse(rel.witnessed_deeds || '[]'),
    known_facts: JSON.parse(rel.known_facts || '[]'),
    rumors_heard: JSON.parse(rel.rumors_heard || '[]'),
    player_known_facts: JSON.parse(rel.player_known_facts || '[]'),
    discovered_secrets: JSON.parse(rel.discovered_secrets || '[]'),
    promises_made: JSON.parse(rel.promises_made || '[]'),
    debts_owed: JSON.parse(rel.debts_owed || '[]')
  };
}

function getDispositionLabel(disposition) {
  if (disposition >= 75) return 'devoted';
  if (disposition >= 50) return 'allied';
  if (disposition >= 25) return 'friendly';
  if (disposition >= -24) return 'neutral';
  if (disposition >= -49) return 'unfriendly';
  if (disposition >= -74) return 'hostile';
  return 'nemesis';
}

export { getDispositionLabel };
