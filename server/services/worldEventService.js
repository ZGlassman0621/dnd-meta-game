import { dbAll, dbGet, dbRun } from '../database.js';

/**
 * World Event Service - CRUD operations for world events and event effects
 */

// ============================================================
// WORLD EVENT CRUD
// ============================================================

/**
 * Create a new world event
 */
export async function createWorldEvent(data) {
  const {
    campaign_id,
    title,
    description = null,
    event_type = 'political',
    scope = 'local',
    affected_locations = [],
    affected_factions = [],
    current_stage = 0,
    stages = [],
    stage_descriptions = [],
    expected_duration_days = null,
    deadline = null,
    visibility = 'public',
    discovered_by_characters = [],
    triggered_by_faction_id = null,
    triggered_by_character_id = null,
    triggered_by_event_id = null,
    possible_outcomes = [],
    player_intervention_options = [],
    status = 'active'
  } = data;

  const result = await dbRun(`
    INSERT INTO world_events (
      campaign_id, title, description, event_type, scope, affected_locations,
      affected_factions, current_stage, stages, stage_descriptions,
      expected_duration_days, deadline, visibility, discovered_by_characters,
      triggered_by_faction_id, triggered_by_character_id, triggered_by_event_id,
      possible_outcomes, player_intervention_options, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    campaign_id, title, description, event_type, scope,
    JSON.stringify(affected_locations), JSON.stringify(affected_factions),
    current_stage, JSON.stringify(stages), JSON.stringify(stage_descriptions),
    expected_duration_days, deadline, visibility,
    JSON.stringify(discovered_by_characters), triggered_by_faction_id,
    triggered_by_character_id, triggered_by_event_id,
    JSON.stringify(possible_outcomes), JSON.stringify(player_intervention_options),
    status
  ]);

  return getWorldEventById(result.lastInsertRowid);
}

/**
 * Get a world event by ID
 */
export async function getWorldEventById(id) {
  const event = await dbGet('SELECT * FROM world_events WHERE id = ?', [id]);
  return event ? parseEventJson(event) : null;
}

/**
 * Get all world events for a campaign
 */
export async function getCampaignEvents(campaignId) {
  const events = await dbAll(
    'SELECT * FROM world_events WHERE campaign_id = ? ORDER BY started_at DESC',
    [campaignId]
  );
  return events.map(parseEventJson);
}

/**
 * Get active world events for a campaign
 */
export async function getActiveEvents(campaignId) {
  const events = await dbAll(
    "SELECT * FROM world_events WHERE campaign_id = ? AND status = 'active' ORDER BY started_at DESC",
    [campaignId]
  );
  return events.map(parseEventJson);
}

/**
 * Get events by type
 */
export async function getEventsByType(campaignId, eventType) {
  const events = await dbAll(
    'SELECT * FROM world_events WHERE campaign_id = ? AND event_type = ? ORDER BY started_at DESC',
    [campaignId, eventType]
  );
  return events.map(parseEventJson);
}

/**
 * Get events affecting a location
 */
export async function getEventsAffectingLocation(locationId) {
  // Search for location ID in JSON array
  const searchPattern = `%${locationId}%`;
  const events = await dbAll(`
    SELECT * FROM world_events
    WHERE status = 'active'
    AND affected_locations LIKE ?
    ORDER BY started_at DESC
  `, [searchPattern]);
  return events.map(parseEventJson);
}

/**
 * Get events affecting a faction
 */
export async function getEventsAffectingFaction(factionId) {
  // Search for faction ID in JSON array (handles [5], [1,5], [5,10] patterns)
  const searchPattern = `%${factionId}%`;
  const events = await dbAll(`
    SELECT * FROM world_events
    WHERE status = 'active'
    AND (
      affected_factions LIKE ?
      OR triggered_by_faction_id = ?
    )
    ORDER BY started_at DESC
  `, [searchPattern, factionId]);
  return events.map(parseEventJson);
}

/**
 * Get events visible to a character
 */
export async function getEventsVisibleToCharacter(characterId) {
  // Search for character ID in JSON array
  const searchPattern = `%${characterId}%`;
  const events = await dbAll(`
    SELECT * FROM world_events
    WHERE status = 'active'
    AND (
      visibility = 'public'
      OR discovered_by_characters LIKE ?
      OR triggered_by_character_id = ?
    )
    ORDER BY started_at DESC
  `, [searchPattern, characterId]);
  return events.map(parseEventJson);
}

/**
 * Update a world event
 */
export async function updateWorldEvent(id, data) {
  const event = await getWorldEventById(id);
  if (!event) return null;

  const updates = { ...event, ...data };

  await dbRun(`
    UPDATE world_events SET
      title = ?, description = ?, event_type = ?, scope = ?,
      affected_locations = ?, affected_factions = ?, current_stage = ?,
      stages = ?, stage_descriptions = ?, expected_duration_days = ?,
      deadline = ?, visibility = ?, discovered_by_characters = ?,
      triggered_by_faction_id = ?, triggered_by_character_id = ?,
      triggered_by_event_id = ?, possible_outcomes = ?,
      player_intervention_options = ?, status = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [
    updates.title, updates.description, updates.event_type, updates.scope,
    JSON.stringify(updates.affected_locations), JSON.stringify(updates.affected_factions),
    updates.current_stage, JSON.stringify(updates.stages),
    JSON.stringify(updates.stage_descriptions), updates.expected_duration_days,
    updates.deadline, updates.visibility, JSON.stringify(updates.discovered_by_characters),
    updates.triggered_by_faction_id, updates.triggered_by_character_id,
    updates.triggered_by_event_id, JSON.stringify(updates.possible_outcomes),
    JSON.stringify(updates.player_intervention_options), updates.status, id
  ]);

  return getWorldEventById(id);
}

/**
 * Advance event to next stage
 */
export async function advanceEventStage(id) {
  const event = await getWorldEventById(id);
  if (!event) return null;

  const newStage = event.current_stage + 1;

  if (event.stages.length > 0 && newStage >= event.stages.length) {
    // Event complete
    return resolveEvent(id, 'completed', 'Event reached final stage');
  }

  await dbRun(`
    UPDATE world_events SET current_stage = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
  `, [newStage, id]);

  return getWorldEventById(id);
}

/**
 * Resolve an event with an outcome
 */
export async function resolveEvent(id, outcome, outcomeDescription = null) {
  await dbRun(`
    UPDATE world_events SET
      status = 'resolved',
      completed_at = CURRENT_TIMESTAMP,
      outcome = ?,
      outcome_description = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [outcome, outcomeDescription, id]);

  return getWorldEventById(id);
}

/**
 * Cancel an event
 */
export async function cancelEvent(id, reason = null) {
  await dbRun(`
    UPDATE world_events SET
      status = 'cancelled',
      completed_at = CURRENT_TIMESTAMP,
      outcome = 'cancelled',
      outcome_description = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [reason, id]);

  return getWorldEventById(id);
}

/**
 * Character discovers an event
 */
export async function discoverEvent(eventId, characterId) {
  const event = await getWorldEventById(eventId);
  if (!event) return null;

  if (!event.discovered_by_characters.includes(characterId)) {
    event.discovered_by_characters.push(characterId);

    await dbRun(`
      UPDATE world_events SET discovered_by_characters = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `, [JSON.stringify(event.discovered_by_characters), eventId]);
  }

  return getWorldEventById(eventId);
}

/**
 * Record tick processing for an event
 */
export async function recordEventTick(id, tickNotes) {
  await dbRun(`
    UPDATE world_events SET last_tick_at = CURRENT_TIMESTAMP, tick_notes = ? WHERE id = ?
  `, [tickNotes, id]);
  return getWorldEventById(id);
}

/**
 * Delete a world event
 */
export async function deleteWorldEvent(id) {
  // Effects will cascade delete
  const result = await dbRun('DELETE FROM world_events WHERE id = ?', [id]);
  return result.changes > 0;
}

// ============================================================
// EVENT EFFECTS CRUD
// ============================================================

/**
 * Create an event effect
 */
export async function createEventEffect(data) {
  const {
    event_id,
    effect_type,
    description = null,
    target_type,
    target_id = null,
    parameters = {},
    stage_applied = 0,
    duration = null,
    expires_at = null,
    status = 'active'
  } = data;

  const result = await dbRun(`
    INSERT INTO event_effects (
      event_id, effect_type, description, target_type, target_id,
      parameters, stage_applied, duration, expires_at, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    event_id, effect_type, description, target_type, target_id,
    JSON.stringify(parameters), stage_applied, duration, expires_at, status
  ]);

  return getEventEffectById(result.lastInsertRowid);
}

/**
 * Get an event effect by ID
 */
export async function getEventEffectById(id) {
  const effect = await dbGet('SELECT * FROM event_effects WHERE id = ?', [id]);
  return effect ? parseEffectJson(effect) : null;
}

/**
 * Get all effects for an event
 */
export async function getEventEffects(eventId) {
  const effects = await dbAll(
    'SELECT * FROM event_effects WHERE event_id = ? ORDER BY stage_applied, id',
    [eventId]
  );
  return effects.map(parseEffectJson);
}

/**
 * Get active effects for a target
 */
export async function getActiveEffectsForTarget(targetType, targetId) {
  const effects = await dbAll(`
    SELECT ee.*, we.title as event_title, we.event_type
    FROM event_effects ee
    JOIN world_events we ON ee.event_id = we.id
    WHERE ee.target_type = ? AND ee.target_id = ? AND ee.status = 'active'
    ORDER BY ee.created_at DESC
  `, [targetType, targetId]);
  return effects.map(parseEffectJson);
}

/**
 * Get all active effects for a campaign (via events)
 */
export async function getActiveEffectsForCampaign(campaignId) {
  const effects = await dbAll(`
    SELECT ee.*, we.title as event_title, we.campaign_id
    FROM event_effects ee
    JOIN world_events we ON ee.event_id = we.id
    WHERE we.campaign_id = ? AND ee.status = 'active'
    ORDER BY ee.created_at DESC
  `, [campaignId]);
  return effects.map(parseEffectJson);
}

/**
 * Update an event effect
 */
export async function updateEventEffect(id, data) {
  const effect = await getEventEffectById(id);
  if (!effect) return null;

  const updates = { ...effect, ...data };

  await dbRun(`
    UPDATE event_effects SET
      effect_type = ?, description = ?, target_type = ?, target_id = ?,
      parameters = ?, stage_applied = ?, duration = ?, expires_at = ?, status = ?
    WHERE id = ?
  `, [
    updates.effect_type, updates.description, updates.target_type, updates.target_id,
    JSON.stringify(updates.parameters), updates.stage_applied, updates.duration,
    updates.expires_at, updates.status, id
  ]);

  return getEventEffectById(id);
}

/**
 * Reverse an effect
 */
export async function reverseEffect(id, reason = null) {
  await dbRun(`
    UPDATE event_effects SET
      status = 'reversed',
      reversed_at = CURRENT_TIMESTAMP,
      reversal_reason = ?
    WHERE id = ?
  `, [reason, id]);

  return getEventEffectById(id);
}

/**
 * Expire effects that have passed their expiration date
 */
export async function expireEffects() {
  const result = await dbRun(`
    UPDATE event_effects
    SET status = 'expired'
    WHERE status = 'active'
    AND expires_at IS NOT NULL
    AND expires_at < CURRENT_TIMESTAMP
  `);
  return result.changes;
}

/**
 * Delete an event effect
 */
export async function deleteEventEffect(id) {
  const result = await dbRun('DELETE FROM event_effects WHERE id = ?', [id]);
  return result.changes > 0;
}

// ============================================================
// TICK PROCESSING
// ============================================================

/**
 * Get all active events that need tick processing
 */
export async function getEventsForTick(campaignId) {
  const events = await dbAll(`
    SELECT * FROM world_events
    WHERE campaign_id = ? AND status = 'active'
    ORDER BY started_at ASC
  `, [campaignId]);
  return events.map(parseEventJson);
}

/**
 * Process world events tick (called periodically to advance events)
 */
export async function processEventTick(campaignId, gameDaysPassed = 1) {
  const events = await getEventsForTick(campaignId);
  const results = [];

  // First, expire any effects that are past their date
  const expiredCount = await expireEffects();
  if (expiredCount > 0) {
    results.push({ type: 'effects_expired', count: expiredCount });
  }

  for (const event of events) {
    // Check if event has deadline and if it's passed
    if (event.deadline) {
      const deadlineDate = new Date(event.deadline);
      if (deadlineDate < new Date()) {
        const resolved = await resolveEvent(event.id, 'deadline_passed', 'Event deadline reached without intervention');
        results.push({
          type: 'event_deadline_passed',
          event_id: event.id,
          title: event.title
        });
        continue;
      }
    }

    // For multi-stage events, potentially advance stages based on duration
    if (event.stages.length > 0 && event.expected_duration_days) {
      const daysSinceStart = Math.floor(
        (new Date() - new Date(event.started_at)) / (1000 * 60 * 60 * 24)
      );
      const daysPerStage = event.expected_duration_days / event.stages.length;
      const expectedStage = Math.min(
        Math.floor(daysSinceStart / daysPerStage),
        event.stages.length - 1
      );

      if (expectedStage > event.current_stage) {
        const updated = await advanceEventStage(event.id);
        await recordEventTick(event.id, `Advanced to stage ${updated.current_stage} on day tick`);

        results.push({
          type: 'event_stage_advanced',
          event_id: event.id,
          title: event.title,
          new_stage: updated.current_stage,
          stage_name: event.stages[updated.current_stage] || 'Unknown'
        });
      }
    }
  }

  return results;
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function parseEventJson(event) {
  return {
    ...event,
    affected_locations: JSON.parse(event.affected_locations || '[]'),
    affected_factions: JSON.parse(event.affected_factions || '[]'),
    stages: JSON.parse(event.stages || '[]'),
    stage_descriptions: JSON.parse(event.stage_descriptions || '[]'),
    discovered_by_characters: JSON.parse(event.discovered_by_characters || '[]'),
    possible_outcomes: JSON.parse(event.possible_outcomes || '[]'),
    player_intervention_options: JSON.parse(event.player_intervention_options || '[]')
  };
}

function parseEffectJson(effect) {
  return {
    ...effect,
    parameters: JSON.parse(effect.parameters || '{}')
  };
}
