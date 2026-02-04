import { dbAll, dbGet, dbRun } from '../database.js';

/**
 * Faction Service - CRUD operations for factions, faction goals, and faction standings
 */

// ============================================================
// FACTION CRUD
// ============================================================

/**
 * Create a new faction
 */
export async function createFaction(data) {
  const {
    campaign_id,
    name,
    description = null,
    symbol = null,
    motto = null,
    scope = 'local',
    power_level = 5,
    influence_areas = [],
    headquarters_location_id = null,
    territory = [],
    leader_npc_id = null,
    leadership_structure = 'autocratic',
    notable_members = [],
    wealth_level = 5,
    military_strength = 5,
    political_influence = 5,
    magical_resources = 3,
    information_network = 5,
    faction_relationships = {},
    alignment = 'neutral',
    primary_values = [],
    typical_methods = [],
    recruitment_requirements = null,
    membership_benefits = [],
    status = 'active',
    public_reputation = 0
  } = data;

  const result = await dbRun(`
    INSERT INTO factions (
      campaign_id, name, description, symbol, motto, scope, power_level,
      influence_areas, headquarters_location_id, territory, leader_npc_id,
      leadership_structure, notable_members, wealth_level, military_strength,
      political_influence, magical_resources, information_network,
      faction_relationships, alignment, primary_values, typical_methods,
      recruitment_requirements, membership_benefits, status, public_reputation
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    campaign_id, name, description, symbol, motto, scope, power_level,
    JSON.stringify(influence_areas), headquarters_location_id, JSON.stringify(territory),
    leader_npc_id, leadership_structure, JSON.stringify(notable_members),
    wealth_level, military_strength, political_influence, magical_resources,
    information_network, JSON.stringify(faction_relationships), alignment,
    JSON.stringify(primary_values), JSON.stringify(typical_methods),
    recruitment_requirements, JSON.stringify(membership_benefits), status, public_reputation
  ]);

  return getFactionById(result.lastInsertRowid);
}

/**
 * Get a faction by ID
 */
export async function getFactionById(id) {
  const faction = await dbGet('SELECT * FROM factions WHERE id = ?', [id]);
  return faction ? parseFactionJson(faction) : null;
}

/**
 * Get all factions for a campaign
 */
export async function getCampaignFactions(campaignId) {
  const factions = await dbAll(
    'SELECT * FROM factions WHERE campaign_id = ? ORDER BY power_level DESC, name',
    [campaignId]
  );
  return factions.map(parseFactionJson);
}

/**
 * Get active factions for a campaign
 */
export async function getActiveFactions(campaignId) {
  const factions = await dbAll(
    "SELECT * FROM factions WHERE campaign_id = ? AND status = 'active' ORDER BY power_level DESC, name",
    [campaignId]
  );
  return factions.map(parseFactionJson);
}

/**
 * Get factions by scope
 */
export async function getFactionsByScope(campaignId, scope) {
  const factions = await dbAll(
    'SELECT * FROM factions WHERE campaign_id = ? AND scope = ? ORDER BY power_level DESC',
    [campaignId, scope]
  );
  return factions.map(parseFactionJson);
}

/**
 * Update a faction
 */
export async function updateFaction(id, data) {
  const faction = await getFactionById(id);
  if (!faction) return null;

  const updates = { ...faction, ...data };

  await dbRun(`
    UPDATE factions SET
      name = ?, description = ?, symbol = ?, motto = ?, scope = ?, power_level = ?,
      influence_areas = ?, headquarters_location_id = ?, territory = ?, leader_npc_id = ?,
      leadership_structure = ?, notable_members = ?, wealth_level = ?, military_strength = ?,
      political_influence = ?, magical_resources = ?, information_network = ?,
      faction_relationships = ?, alignment = ?, primary_values = ?, typical_methods = ?,
      recruitment_requirements = ?, membership_benefits = ?, status = ?, public_reputation = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [
    updates.name, updates.description, updates.symbol, updates.motto, updates.scope,
    updates.power_level, JSON.stringify(updates.influence_areas),
    updates.headquarters_location_id, JSON.stringify(updates.territory),
    updates.leader_npc_id, updates.leadership_structure, JSON.stringify(updates.notable_members),
    updates.wealth_level, updates.military_strength, updates.political_influence,
    updates.magical_resources, updates.information_network,
    JSON.stringify(updates.faction_relationships), updates.alignment,
    JSON.stringify(updates.primary_values), JSON.stringify(updates.typical_methods),
    updates.recruitment_requirements, JSON.stringify(updates.membership_benefits),
    updates.status, updates.public_reputation, id
  ]);

  return getFactionById(id);
}

/**
 * Delete a faction
 */
export async function deleteFaction(id) {
  // Goals and standings will cascade delete
  const result = await dbRun('DELETE FROM factions WHERE id = ?', [id]);
  return result.changes > 0;
}

/**
 * Update faction relationship with another faction
 */
export async function updateFactionRelationship(factionId, targetFactionId, relationshipValue) {
  const faction = await getFactionById(factionId);
  if (!faction) return null;

  const relationships = { ...faction.faction_relationships };
  relationships[targetFactionId] = relationshipValue;

  await dbRun(`
    UPDATE factions SET faction_relationships = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
  `, [JSON.stringify(relationships), factionId]);

  return getFactionById(factionId);
}

// ============================================================
// FACTION GOALS CRUD
// ============================================================

/**
 * Create a faction goal
 */
export async function createFactionGoal(data) {
  const {
    faction_id,
    title,
    description = null,
    goal_type = 'expansion',
    progress = 0,
    progress_max = 100,
    milestones = [],
    deadline = null,
    urgency = 'normal',
    success_consequences = null,
    failure_consequences = null,
    stakes_level = 'moderate',
    target_location_id = null,
    target_faction_id = null,
    target_npc_id = null,
    target_character_id = null,
    visibility = 'secret',
    discovered_by_characters = [],
    status = 'active'
  } = data;

  const result = await dbRun(`
    INSERT INTO faction_goals (
      faction_id, title, description, goal_type, progress, progress_max,
      milestones, deadline, urgency, success_consequences, failure_consequences,
      stakes_level, target_location_id, target_faction_id, target_npc_id,
      target_character_id, visibility, discovered_by_characters, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    faction_id, title, description, goal_type, progress, progress_max,
    JSON.stringify(milestones), deadline, urgency, success_consequences,
    failure_consequences, stakes_level, target_location_id, target_faction_id,
    target_npc_id, target_character_id, visibility,
    JSON.stringify(discovered_by_characters), status
  ]);

  return getFactionGoalById(result.lastInsertRowid);
}

/**
 * Get a faction goal by ID
 */
export async function getFactionGoalById(id) {
  const goal = await dbGet('SELECT * FROM faction_goals WHERE id = ?', [id]);
  return goal ? parseFactionGoalJson(goal) : null;
}

/**
 * Get all goals for a faction
 */
export async function getFactionGoals(factionId) {
  const goals = await dbAll(
    'SELECT * FROM faction_goals WHERE faction_id = ? ORDER BY urgency DESC, created_at DESC',
    [factionId]
  );
  return goals.map(parseFactionGoalJson);
}

/**
 * Get active goals for a faction
 */
export async function getActiveFactionGoals(factionId) {
  const goals = await dbAll(
    "SELECT * FROM faction_goals WHERE faction_id = ? AND status = 'active' ORDER BY urgency DESC",
    [factionId]
  );
  return goals.map(parseFactionGoalJson);
}

/**
 * Get goals visible to a character
 */
export async function getGoalsVisibleToCharacter(characterId) {
  // Get all active goals then filter in JS for reliable JSON array search
  const goals = await dbAll(`
    SELECT fg.*, f.name as faction_name, f.campaign_id
    FROM faction_goals fg
    JOIN factions f ON fg.faction_id = f.id
    WHERE fg.status = 'active'
    ORDER BY fg.urgency DESC
  `);

  const parsedGoals = goals.map(parseFactionGoalJson);

  // Filter to visible goals (public or discovered by this character)
  return parsedGoals.filter(goal =>
    goal.visibility === 'public' ||
    goal.discovered_by_characters.includes(characterId)
  );
}

/**
 * Update a faction goal
 */
export async function updateFactionGoal(id, data) {
  const goal = await getFactionGoalById(id);
  if (!goal) return null;

  const updates = { ...goal, ...data };

  await dbRun(`
    UPDATE faction_goals SET
      title = ?, description = ?, goal_type = ?, progress = ?, progress_max = ?,
      milestones = ?, deadline = ?, urgency = ?, success_consequences = ?,
      failure_consequences = ?, stakes_level = ?, target_location_id = ?,
      target_faction_id = ?, target_npc_id = ?, target_character_id = ?,
      visibility = ?, discovered_by_characters = ?, status = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [
    updates.title, updates.description, updates.goal_type, updates.progress,
    updates.progress_max, JSON.stringify(updates.milestones), updates.deadline,
    updates.urgency, updates.success_consequences, updates.failure_consequences,
    updates.stakes_level, updates.target_location_id, updates.target_faction_id,
    updates.target_npc_id, updates.target_character_id, updates.visibility,
    JSON.stringify(updates.discovered_by_characters), updates.status, id
  ]);

  return getFactionGoalById(id);
}

/**
 * Advance goal progress
 */
export async function advanceGoalProgress(id, amount) {
  const goal = await getFactionGoalById(id);
  if (!goal) return null;

  const newProgress = Math.min(goal.progress + amount, goal.progress_max);
  const isComplete = newProgress >= goal.progress_max;

  await dbRun(`
    UPDATE faction_goals SET
      progress = ?,
      status = ?,
      completed_at = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [
    newProgress,
    isComplete ? 'completed' : 'active',
    isComplete ? new Date().toISOString() : null,
    id
  ]);

  return getFactionGoalById(id);
}

/**
 * Character discovers a goal
 */
export async function discoverGoal(goalId, characterId) {
  const goal = await getFactionGoalById(goalId);
  if (!goal) return null;

  if (!goal.discovered_by_characters.includes(characterId)) {
    goal.discovered_by_characters.push(characterId);

    await dbRun(`
      UPDATE faction_goals SET discovered_by_characters = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `, [JSON.stringify(goal.discovered_by_characters), goalId]);
  }

  return getFactionGoalById(goalId);
}

/**
 * Record tick processing for a goal
 */
export async function recordGoalTick(id, tickNotes) {
  await dbRun(`
    UPDATE faction_goals SET last_tick_at = CURRENT_TIMESTAMP, tick_notes = ? WHERE id = ?
  `, [tickNotes, id]);
  return getFactionGoalById(id);
}

/**
 * Delete a faction goal
 */
export async function deleteFactionGoal(id) {
  const result = await dbRun('DELETE FROM faction_goals WHERE id = ?', [id]);
  return result.changes > 0;
}

// ============================================================
// FACTION STANDINGS CRUD
// ============================================================

/**
 * Get or create faction standing for a character
 */
export async function getOrCreateStanding(characterId, factionId) {
  let standing = await dbGet(
    'SELECT * FROM faction_standings WHERE character_id = ? AND faction_id = ?',
    [characterId, factionId]
  );

  if (!standing) {
    await dbRun(`
      INSERT INTO faction_standings (character_id, faction_id, standing_label)
      VALUES (?, ?, 'neutral')
    `, [characterId, factionId]);
    standing = await dbGet(
      'SELECT * FROM faction_standings WHERE character_id = ? AND faction_id = ?',
      [characterId, factionId]
    );
  }

  return parseStandingJson(standing);
}

/**
 * Get all faction standings for a character
 */
export async function getCharacterStandings(characterId) {
  const standings = await dbAll(`
    SELECT fs.*, f.name as faction_name, f.symbol, f.scope
    FROM faction_standings fs
    JOIN factions f ON fs.faction_id = f.id
    WHERE fs.character_id = ?
    ORDER BY fs.standing DESC
  `, [characterId]);
  return standings.map(parseStandingJson);
}

/**
 * Get all character standings for a faction
 */
export async function getFactionMembers(factionId) {
  const standings = await dbAll(`
    SELECT fs.*, c.name as character_name
    FROM faction_standings fs
    JOIN characters c ON fs.character_id = c.id
    WHERE fs.faction_id = ? AND fs.is_member = 1
    ORDER BY fs.standing DESC
  `, [factionId]);
  return standings.map(parseStandingJson);
}

/**
 * Update faction standing
 */
export async function updateStanding(characterId, factionId, data) {
  const standing = await getOrCreateStanding(characterId, factionId);

  const updates = { ...standing, ...data };

  // Calculate standing label
  updates.standing_label = getStandingLabel(updates.standing);

  await dbRun(`
    UPDATE faction_standings SET
      standing = ?, standing_label = ?, rank = ?, is_member = ?,
      joined_at = ?, membership_level = ?, deeds_for = ?, deeds_against = ?,
      gifts_given = ?, quests_completed = ?, known_members = ?,
      known_goals = ?, known_secrets = ?, updated_at = CURRENT_TIMESTAMP
    WHERE character_id = ? AND faction_id = ?
  `, [
    updates.standing, updates.standing_label, updates.rank,
    updates.is_member ? 1 : 0, updates.joined_at, updates.membership_level,
    JSON.stringify(updates.deeds_for), JSON.stringify(updates.deeds_against),
    JSON.stringify(updates.gifts_given), JSON.stringify(updates.quests_completed),
    JSON.stringify(updates.known_members), JSON.stringify(updates.known_goals),
    JSON.stringify(updates.known_secrets), characterId, factionId
  ]);

  return getOrCreateStanding(characterId, factionId);
}

/**
 * Modify standing by amount
 */
export async function modifyStanding(characterId, factionId, amount, deed = null) {
  const standing = await getOrCreateStanding(characterId, factionId);

  const newStanding = Math.max(-100, Math.min(100, standing.standing + amount));

  // Track the deed
  if (deed) {
    if (amount > 0) {
      standing.deeds_for.push({ ...deed, date: new Date().toISOString() });
    } else {
      standing.deeds_against.push({ ...deed, date: new Date().toISOString() });
    }
  }

  return updateStanding(characterId, factionId, {
    standing: newStanding,
    deeds_for: standing.deeds_for,
    deeds_against: standing.deeds_against
  });
}

/**
 * Join a faction
 */
export async function joinFaction(characterId, factionId, membershipLevel = 'initiate') {
  return updateStanding(characterId, factionId, {
    is_member: true,
    joined_at: new Date().toISOString(),
    membership_level: membershipLevel
  });
}

/**
 * Leave a faction
 */
export async function leaveFaction(characterId, factionId) {
  return updateStanding(characterId, factionId, {
    is_member: false
  });
}

/**
 * Record quest completion for faction
 */
export async function recordQuestForFaction(characterId, factionId, questInfo) {
  const standing = await getOrCreateStanding(characterId, factionId);
  standing.quests_completed.push({ ...questInfo, date: new Date().toISOString() });

  return updateStanding(characterId, factionId, {
    quests_completed: standing.quests_completed
  });
}

/**
 * Character learns about a faction member
 */
export async function discoverFactionMember(characterId, factionId, memberId) {
  const standing = await getOrCreateStanding(characterId, factionId);
  if (!standing.known_members.includes(memberId)) {
    standing.known_members.push(memberId);
    return updateStanding(characterId, factionId, {
      known_members: standing.known_members
    });
  }
  return standing;
}

/**
 * Character learns about a faction goal
 */
export async function discoverFactionGoalForStanding(characterId, factionId, goalId) {
  const standing = await getOrCreateStanding(characterId, factionId);
  if (!standing.known_goals.includes(goalId)) {
    standing.known_goals.push(goalId);
    return updateStanding(characterId, factionId, {
      known_goals: standing.known_goals
    });
  }
  return standing;
}

/**
 * Character learns a faction secret
 */
export async function discoverFactionSecret(characterId, factionId, secret) {
  const standing = await getOrCreateStanding(characterId, factionId);
  standing.known_secrets.push({ secret, discovered_at: new Date().toISOString() });
  return updateStanding(characterId, factionId, {
    known_secrets: standing.known_secrets
  });
}

// ============================================================
// TICK PROCESSING
// ============================================================

/**
 * Get all active goals that need tick processing
 */
export async function getGoalsForTick(campaignId) {
  const goals = await dbAll(`
    SELECT fg.*, f.name as faction_name, f.power_level, f.campaign_id
    FROM faction_goals fg
    JOIN factions f ON fg.faction_id = f.id
    WHERE f.campaign_id = ? AND fg.status = 'active'
    ORDER BY fg.urgency DESC
  `, [campaignId]);
  return goals.map(parseFactionGoalJson);
}

/**
 * Process faction goals tick (called periodically to advance faction activities)
 */
export async function processFactionTick(campaignId, gameDaysPassed = 1) {
  const goals = await getGoalsForTick(campaignId);
  const results = [];

  for (const goal of goals) {
    // Base progress per day based on faction power and goal urgency
    let baseProgress = goal.power_level || 5;

    // Urgency modifier
    const urgencyModifiers = {
      'critical': 2.0,
      'high': 1.5,
      'normal': 1.0,
      'low': 0.5
    };
    baseProgress *= (urgencyModifiers[goal.urgency] || 1.0);

    // Apply some randomness
    const variance = Math.random() * 0.4 + 0.8; // 0.8 to 1.2
    const progressGain = Math.floor(baseProgress * variance * gameDaysPassed);

    if (progressGain > 0) {
      const updated = await advanceGoalProgress(goal.id, progressGain);
      await recordGoalTick(goal.id, `Advanced ${progressGain} progress on day tick`);

      results.push({
        goal_id: goal.id,
        faction_name: goal.faction_name,
        title: goal.title,
        progress_gained: progressGain,
        new_progress: updated.progress,
        completed: updated.status === 'completed'
      });
    }
  }

  return results;
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function parseFactionJson(faction) {
  return {
    ...faction,
    influence_areas: JSON.parse(faction.influence_areas || '[]'),
    territory: JSON.parse(faction.territory || '[]'),
    notable_members: JSON.parse(faction.notable_members || '[]'),
    faction_relationships: JSON.parse(faction.faction_relationships || '{}'),
    primary_values: JSON.parse(faction.primary_values || '[]'),
    typical_methods: JSON.parse(faction.typical_methods || '[]'),
    membership_benefits: JSON.parse(faction.membership_benefits || '[]')
  };
}

function parseFactionGoalJson(goal) {
  return {
    ...goal,
    milestones: JSON.parse(goal.milestones || '[]'),
    discovered_by_characters: JSON.parse(goal.discovered_by_characters || '[]')
  };
}

function parseStandingJson(standing) {
  return {
    ...standing,
    is_member: Boolean(standing.is_member),
    deeds_for: JSON.parse(standing.deeds_for || '[]'),
    deeds_against: JSON.parse(standing.deeds_against || '[]'),
    gifts_given: JSON.parse(standing.gifts_given || '[]'),
    quests_completed: JSON.parse(standing.quests_completed || '[]'),
    known_members: JSON.parse(standing.known_members || '[]'),
    known_goals: JSON.parse(standing.known_goals || '[]'),
    known_secrets: JSON.parse(standing.known_secrets || '[]')
  };
}

function getStandingLabel(standing) {
  if (standing >= 80) return 'exalted';
  if (standing >= 60) return 'revered';
  if (standing >= 40) return 'honored';
  if (standing >= 20) return 'friendly';
  if (standing >= 0) return 'neutral';
  if (standing >= -20) return 'unfriendly';
  if (standing >= -40) return 'hostile';
  if (standing >= -60) return 'hated';
  return 'enemy';
}
