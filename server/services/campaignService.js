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
 * Hard delete a campaign (use with caution)
 */
export async function deleteCampaign(id) {
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
  await dbRun(`
    UPDATE characters SET campaign_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
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
