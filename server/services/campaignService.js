import { dbAll, dbGet, dbRun } from '../database.js';

/**
 * Campaign Service - CRUD operations for campaigns
 */

/**
 * Create a new campaign
 */
export async function createCampaign(data) {
  const {
    name,
    description = null,
    setting = 'Forgotten Realms',
    tone = 'heroic fantasy',
    starting_location = null,
    time_ratio = 'normal'
  } = data;

  const result = await dbRun(`
    INSERT INTO campaigns (name, description, setting, tone, starting_location, time_ratio)
    VALUES (?, ?, ?, ?, ?, ?)
  `, [name, description, setting, tone, starting_location, time_ratio]);

  return getCampaignById(result.lastInsertRowid);
}

/**
 * Get a campaign by ID
 */
export async function getCampaignById(id) {
  return dbGet('SELECT * FROM campaigns WHERE id = ?', [id]);
}

/**
 * Get all campaigns
 */
export async function getAllCampaigns() {
  return dbAll('SELECT * FROM campaigns ORDER BY updated_at DESC');
}

/**
 * Get active campaigns
 */
export async function getActiveCampaigns() {
  return dbAll("SELECT * FROM campaigns WHERE status = 'active' ORDER BY updated_at DESC");
}

/**
 * Update a campaign
 */
export async function updateCampaign(id, data) {
  const campaign = await getCampaignById(id);
  if (!campaign) return null;

  const {
    name = campaign.name,
    description = campaign.description,
    setting = campaign.setting,
    tone = campaign.tone,
    starting_location = campaign.starting_location,
    status = campaign.status,
    time_ratio = campaign.time_ratio
  } = data;

  await dbRun(`
    UPDATE campaigns
    SET name = ?, description = ?, setting = ?, tone = ?,
        starting_location = ?, status = ?, time_ratio = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [name, description, setting, tone, starting_location, status, time_ratio, id]);

  return getCampaignById(id);
}

/**
 * Delete a campaign (soft delete by setting status to 'archived')
 */
export async function archiveCampaign(id) {
  await dbRun(`
    UPDATE campaigns SET status = 'archived', updated_at = CURRENT_TIMESTAMP WHERE id = ?
  `, [id]);
  return getCampaignById(id);
}

/**
 * Hard delete a campaign and all related records (use with caution)
 * Cleans up foreign key references in the correct order to avoid constraint violations.
 */
export async function deleteCampaign(id) {
  // 1. Unassign characters (don't delete them, just remove campaign link)
  await dbRun('UPDATE characters SET campaign_id = NULL, current_location_id = NULL WHERE campaign_id = ?', [id]);

  // 2. Clear location references in non-campaign tables
  const locationIds = (await dbAll('SELECT id FROM locations WHERE campaign_id = ?', [id])).map(r => r.id);
  if (locationIds.length > 0) {
    const placeholders = locationIds.map(() => '?').join(',');
    await dbRun(`UPDATE adventures SET location_id = NULL WHERE location_id IN (${placeholders})`, locationIds);
    await dbRun(`UPDATE npc_relationships SET first_met_location_id = NULL WHERE first_met_location_id IN (${placeholders})`, locationIds);
  }

  // 3. Delete narrative queue items
  await dbRun('DELETE FROM narrative_queue WHERE campaign_id = ?', [id]);

  // 4. Delete journeys (journey_encounters cascade via ON DELETE CASCADE)
  await dbRun('DELETE FROM journeys WHERE campaign_id = ?', [id]);

  // 5. Clear self-references in world_events, then delete (event_effects cascade)
  await dbRun('UPDATE world_events SET triggered_by_event_id = NULL WHERE campaign_id = ?', [id]);
  await dbRun('DELETE FROM world_events WHERE campaign_id = ?', [id]);

  // 6. Delete factions (faction_goals, faction_standings cascade via ON DELETE CASCADE)
  await dbRun('DELETE FROM factions WHERE campaign_id = ?', [id]);

  // 7. Delete quests (quest_requirements cascade via ON DELETE CASCADE)
  await dbRun('DELETE FROM quests WHERE campaign_id = ?', [id]);

  // 8. Clear self-references in locations, then delete
  await dbRun('UPDATE locations SET parent_location_id = NULL WHERE campaign_id = ?', [id]);
  await dbRun('DELETE FROM locations WHERE campaign_id = ?', [id]);

  // 9. Finally delete the campaign
  const result = await dbRun('DELETE FROM campaigns WHERE id = ?', [id]);
  return result.changes > 0;
}

/**
 * Get all characters in a campaign
 */
export async function getCampaignCharacters(campaignId) {
  return dbAll('SELECT * FROM characters WHERE campaign_id = ?', [campaignId]);
}

/**
 * Assign a character to a campaign
 */
export async function assignCharacterToCampaign(characterId, campaignId) {
  // Clear campaign_config when switching campaigns so stale settings don't persist
  await dbRun(`
    UPDATE characters SET campaign_id = ?, campaign_config = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?
  `, [campaignId, characterId]);
  return dbGet('SELECT * FROM characters WHERE id = ?', [characterId]);
}

/**
 * Get campaign statistics
 */
export async function getCampaignStats(campaignId) {
  const [characters, locations, quests, companions] = await Promise.all([
    dbAll('SELECT COUNT(*) as count FROM characters WHERE campaign_id = ?', [campaignId]),
    dbAll('SELECT COUNT(*) as count FROM locations WHERE campaign_id = ?', [campaignId]),
    dbAll('SELECT COUNT(*) as count FROM quests WHERE campaign_id = ?', [campaignId]),
    dbAll(`
      SELECT COUNT(*) as count FROM companions c
      JOIN characters ch ON c.recruited_by_character_id = ch.id
      WHERE ch.campaign_id = ?
    `, [campaignId])
  ]);

  return {
    characters: characters[0]?.count || 0,
    locations: locations[0]?.count || 0,
    quests: quests[0]?.count || 0,
    companions: companions[0]?.count || 0
  };
}
