import { dbAll, dbGet, dbRun } from '../database.js';

/**
 * Quest Service - CRUD operations for quests and quest requirements
 */

// ============================================================
// QUEST CRUD
// ============================================================

/**
 * Create a new quest
 */
export async function createQuest(data) {
  const {
    campaign_id,
    character_id,
    quest_type = 'side',
    source_type = null,
    source_id = null,
    title,
    premise,
    description = null,
    antagonist = null,
    status = 'active',
    priority = 'normal',
    current_stage = 0,
    stages = [],
    completion_criteria = null,
    rewards = {},
    world_impact_on_complete = null,
    world_state_changes = [],
    time_sensitive = false,
    deadline_date = null,
    escalation_if_ignored = null
  } = data;

  const result = await dbRun(`
    INSERT INTO quests (
      campaign_id, character_id, quest_type, source_type, source_id,
      title, premise, description, antagonist, status, priority,
      current_stage, stages, completion_criteria, rewards,
      world_impact_on_complete, world_state_changes, time_sensitive,
      deadline_date, escalation_if_ignored, started_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `, [
    campaign_id, character_id, quest_type, source_type, source_id,
    title, premise, description,
    antagonist ? JSON.stringify(antagonist) : null,
    status, priority, current_stage,
    JSON.stringify(stages),
    completion_criteria ? JSON.stringify(completion_criteria) : null,
    JSON.stringify(rewards),
    world_impact_on_complete,
    JSON.stringify(world_state_changes),
    time_sensitive ? 1 : 0,
    deadline_date, escalation_if_ignored
  ]);

  return getQuestById(result.lastInsertRowid);
}

/**
 * Get a quest by ID
 */
export async function getQuestById(id) {
  const quest = await dbGet('SELECT * FROM quests WHERE id = ?', [id]);
  if (quest) {
    quest.antagonist = quest.antagonist ? JSON.parse(quest.antagonist) : null;
    quest.stages = JSON.parse(quest.stages || '[]');
    quest.completion_criteria = quest.completion_criteria ? JSON.parse(quest.completion_criteria) : null;
    quest.rewards = JSON.parse(quest.rewards || '{}');
    quest.world_state_changes = JSON.parse(quest.world_state_changes || '[]');
    quest.time_sensitive = Boolean(quest.time_sensitive);
  }
  return quest;
}

/**
 * Get a quest with its requirements
 */
export async function getQuestWithRequirements(id) {
  const quest = await getQuestById(id);
  if (!quest) return null;

  const requirements = await getQuestRequirements(id);
  quest.requirements = requirements;

  return quest;
}

/**
 * Get all quests for a character
 */
export async function getCharacterQuests(characterId) {
  const quests = await dbAll(
    'SELECT * FROM quests WHERE character_id = ? ORDER BY priority DESC, created_at DESC',
    [characterId]
  );
  return quests.map(parseQuestJson);
}

/**
 * Get active quests for a character
 */
export async function getActiveQuests(characterId) {
  const quests = await dbAll(
    "SELECT * FROM quests WHERE character_id = ? AND status = 'active' ORDER BY priority DESC, created_at DESC",
    [characterId]
  );
  return quests.map(parseQuestJson);
}

/**
 * Get quests by type
 */
export async function getQuestsByType(characterId, questType) {
  const quests = await dbAll(
    'SELECT * FROM quests WHERE character_id = ? AND quest_type = ? ORDER BY priority DESC, created_at DESC',
    [characterId, questType]
  );
  return quests.map(parseQuestJson);
}

/**
 * Get the main quest for a character
 */
export async function getMainQuest(characterId) {
  const quest = await dbGet(
    "SELECT * FROM quests WHERE character_id = ? AND quest_type = 'main' AND status = 'active'",
    [characterId]
  );
  return quest ? parseQuestJson(quest) : null;
}

/**
 * Get quests for a campaign
 */
export async function getCampaignQuests(campaignId) {
  const quests = await dbAll(
    'SELECT * FROM quests WHERE campaign_id = ? ORDER BY priority DESC, created_at DESC',
    [campaignId]
  );
  return quests.map(parseQuestJson);
}

/**
 * Update a quest
 */
export async function updateQuest(id, data) {
  const quest = await getQuestById(id);
  if (!quest) return null;

  const updates = { ...quest, ...data };

  await dbRun(`
    UPDATE quests SET
      quest_type = ?, source_type = ?, source_id = ?,
      title = ?, premise = ?, description = ?, antagonist = ?,
      status = ?, priority = ?, current_stage = ?, stages = ?,
      completion_criteria = ?, rewards = ?, world_impact_on_complete = ?,
      world_state_changes = ?, time_sensitive = ?, deadline_date = ?,
      escalation_if_ignored = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [
    updates.quest_type, updates.source_type, updates.source_id,
    updates.title, updates.premise, updates.description,
    updates.antagonist ? JSON.stringify(updates.antagonist) : null,
    updates.status, updates.priority, updates.current_stage,
    JSON.stringify(updates.stages),
    updates.completion_criteria ? JSON.stringify(updates.completion_criteria) : null,
    JSON.stringify(updates.rewards),
    updates.world_impact_on_complete,
    JSON.stringify(updates.world_state_changes),
    updates.time_sensitive ? 1 : 0,
    updates.deadline_date, updates.escalation_if_ignored, id
  ]);

  return getQuestById(id);
}

/**
 * Advance quest to next stage
 */
export async function advanceQuestStage(id) {
  const quest = await getQuestById(id);
  if (!quest) return null;

  const newStage = quest.current_stage + 1;

  if (newStage >= quest.stages.length) {
    // Quest complete
    return completeQuest(id);
  }

  await dbRun(`
    UPDATE quests SET current_stage = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
  `, [newStage, id]);

  return getQuestById(id);
}

/**
 * Complete a quest
 */
export async function completeQuest(id) {
  await dbRun(`
    UPDATE quests SET
      status = 'completed',
      completed_at = CURRENT_TIMESTAMP,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [id]);

  return getQuestById(id);
}

/**
 * Fail a quest
 */
export async function failQuest(id) {
  await dbRun(`
    UPDATE quests SET
      status = 'failed',
      completed_at = CURRENT_TIMESTAMP,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [id]);

  return getQuestById(id);
}

/**
 * Abandon a quest
 */
export async function abandonQuest(id) {
  await dbRun(`
    UPDATE quests SET
      status = 'abandoned',
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [id]);

  return getQuestById(id);
}

/**
 * Delete a quest
 */
export async function deleteQuest(id) {
  // Delete requirements first (cascade should handle this, but being explicit)
  await dbRun('DELETE FROM quest_requirements WHERE quest_id = ?', [id]);
  const result = await dbRun('DELETE FROM quests WHERE id = ?', [id]);
  return result.changes > 0;
}

// ============================================================
// QUEST REQUIREMENTS CRUD
// ============================================================

/**
 * Create a quest requirement
 */
export async function createQuestRequirement(data) {
  const {
    quest_id,
    stage_index,
    requirement_type,
    description,
    params = {},
    is_optional = false
  } = data;

  const result = await dbRun(`
    INSERT INTO quest_requirements (quest_id, stage_index, requirement_type, description, params, is_optional)
    VALUES (?, ?, ?, ?, ?, ?)
  `, [quest_id, stage_index, requirement_type, description, JSON.stringify(params), is_optional ? 1 : 0]);

  return getQuestRequirementById(result.lastInsertRowid);
}

/**
 * Create multiple quest requirements at once
 */
export async function createQuestRequirements(requirements) {
  const results = [];
  for (const req of requirements) {
    const created = await createQuestRequirement(req);
    results.push(created);
  }
  return results;
}

/**
 * Get a quest requirement by ID
 */
export async function getQuestRequirementById(id) {
  const req = await dbGet('SELECT * FROM quest_requirements WHERE id = ?', [id]);
  if (req) {
    req.params = JSON.parse(req.params || '{}');
    req.is_optional = Boolean(req.is_optional);
  }
  return req;
}

/**
 * Get all requirements for a quest
 */
export async function getQuestRequirements(questId) {
  const reqs = await dbAll(
    'SELECT * FROM quest_requirements WHERE quest_id = ? ORDER BY stage_index, id',
    [questId]
  );
  return reqs.map(req => ({
    ...req,
    params: JSON.parse(req.params || '{}'),
    is_optional: Boolean(req.is_optional)
  }));
}

/**
 * Get requirements for a specific stage
 */
export async function getStageRequirements(questId, stageIndex) {
  const reqs = await dbAll(
    'SELECT * FROM quest_requirements WHERE quest_id = ? AND stage_index = ? ORDER BY id',
    [questId, stageIndex]
  );
  return reqs.map(req => ({
    ...req,
    params: JSON.parse(req.params || '{}'),
    is_optional: Boolean(req.is_optional)
  }));
}

/**
 * Get incomplete requirements for current stage
 */
export async function getIncompleteStageRequirements(questId, stageIndex) {
  const reqs = await dbAll(`
    SELECT * FROM quest_requirements
    WHERE quest_id = ? AND stage_index = ? AND status = 'incomplete' AND is_optional = 0
    ORDER BY id
  `, [questId, stageIndex]);
  return reqs.map(req => ({
    ...req,
    params: JSON.parse(req.params || '{}'),
    is_optional: Boolean(req.is_optional)
  }));
}

/**
 * Mark a requirement as complete
 */
export async function completeRequirement(id, completedBy = null) {
  await dbRun(`
    UPDATE quest_requirements SET
      status = 'complete',
      completed_at = CURRENT_TIMESTAMP,
      completed_by = ?
    WHERE id = ?
  `, [completedBy ? JSON.stringify(completedBy) : null, id]);

  return getQuestRequirementById(id);
}

/**
 * Update a quest requirement
 */
export async function updateQuestRequirement(id, data) {
  const req = await getQuestRequirementById(id);
  if (!req) return null;

  const updates = { ...req, ...data };

  await dbRun(`
    UPDATE quest_requirements SET
      requirement_type = ?, description = ?, params = ?,
      status = ?, is_optional = ?
    WHERE id = ?
  `, [
    updates.requirement_type,
    updates.description,
    JSON.stringify(updates.params),
    updates.status,
    updates.is_optional ? 1 : 0,
    id
  ]);

  return getQuestRequirementById(id);
}

/**
 * Delete a quest requirement
 */
export async function deleteQuestRequirement(id) {
  const result = await dbRun('DELETE FROM quest_requirements WHERE id = ?', [id]);
  return result.changes > 0;
}

/**
 * Check if all required requirements for a stage are complete
 */
export async function isStageComplete(questId, stageIndex) {
  const incomplete = await dbGet(`
    SELECT COUNT(*) as count FROM quest_requirements
    WHERE quest_id = ? AND stage_index = ? AND status = 'incomplete' AND is_optional = 0
  `, [questId, stageIndex]);

  return incomplete.count === 0;
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function parseQuestJson(quest) {
  return {
    ...quest,
    antagonist: quest.antagonist ? JSON.parse(quest.antagonist) : null,
    stages: JSON.parse(quest.stages || '[]'),
    completion_criteria: quest.completion_criteria ? JSON.parse(quest.completion_criteria) : null,
    rewards: JSON.parse(quest.rewards || '{}'),
    world_state_changes: JSON.parse(quest.world_state_changes || '[]'),
    time_sensitive: Boolean(quest.time_sensitive)
  };
}
