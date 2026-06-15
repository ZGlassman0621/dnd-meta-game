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
    time_ratio = 'normal',
    user_id = null
  } = data;

  const result = await dbRun(`
    INSERT INTO campaigns (name, description, setting, tone, starting_location, time_ratio, user_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [name, description, setting, tone, starting_location, time_ratio, user_id]);

  return getCampaignById(result.lastInsertRowid);
}

/**
 * Get a campaign by ID. Optionally scope to a user — the route layer
 * should ALWAYS pass userId for any endpoint reachable by a logged-in
 * user. Omitting userId returns the campaign regardless of owner, which
 * is only safe for internal service calls that have already verified
 * ownership some other way.
 */
export async function getCampaignById(id, userId = null) {
  if (userId) {
    return dbGet('SELECT * FROM campaigns WHERE id = ? AND user_id = ?', [id, userId]);
  }
  return dbGet('SELECT * FROM campaigns WHERE id = ?', [id]);
}

/**
 * Get all campaigns. Requires a userId to return results; callers without
 * a user context get an empty list rather than leaking every user's data.
 */
export async function getAllCampaigns(userId = null) {
  if (!userId) return [];
  return dbAll('SELECT * FROM campaigns WHERE user_id = ? ORDER BY updated_at DESC', [userId]);
}

/**
 * Get active campaigns. Same user-required contract as getAllCampaigns.
 */
export async function getActiveCampaigns(userId = null) {
  if (!userId) return [];
  return dbAll("SELECT * FROM campaigns WHERE user_id = ? AND status = 'active' ORDER BY updated_at DESC", [userId]);
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

  // 3. Clear self-references that would otherwise block their own table's delete.
  await dbRun('UPDATE world_events SET triggered_by_event_id = NULL WHERE campaign_id = ?', [id]);
  await dbRun('UPDATE locations SET parent_location_id = NULL WHERE campaign_id = ?', [id]);

  // 4. Delete from every table that declares a foreign key to `campaigns`
  //    (except `characters`, which we UNASSIGN above rather than delete).
  //    Discovered dynamically from the schema so new campaign-scoped tables are
  //    handled automatically — the prior hand-written list missed tables like
  //    `campaign_weather` and 500'd on a FOREIGN KEY constraint. The retry loop
  //    lets chained FKs resolve across passes; ON DELETE CASCADE handles
  //    grandchildren (faction_goals, quest_requirements, event_effects, …).
  const tables = await dbAll(
    `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT IN ('campaigns','characters')`
  );
  const holders = [];
  for (const t of tables) {
    const fks = await dbAll(`PRAGMA foreign_key_list(${t.name})`);
    const fk = fks.find(f => f.table === 'campaigns');
    if (fk) holders.push({ table: t.name, column: fk.from });
  }
  for (let pass = 0; pass < holders.length + 2; pass++) {
    let blocked = 0;
    for (const { table, column } of holders) {
      try {
        await dbRun(`DELETE FROM ${table} WHERE ${column} = ?`, [id]);
      } catch (e) {
        if (String(e?.message || '').includes('FOREIGN KEY')) blocked++;
        else throw e;
      }
    }
    if (blocked === 0) break;
  }

  // 5. Finally delete the campaign.
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
