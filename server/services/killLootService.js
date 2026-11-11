/**
 * Kill Loot Service (Combat Pipeline #9).
 * When an enemy dies, automatically roll loot from their CR-appropriate table.
 * Server-rolled via rng.js. Uses existing loot table validation.
 */
import { dbGet, dbRun } from '../database.js';
import { safeParse } from '../utils/safeParse.js';
import { getLootTableForLevel } from '../config/rewards.js';
import { roll } from '../utils/rng.js';
// Loot wiring (R-02): no-repeat deal + unidentified stamp. Rewards-table
// items are magic by construction, so every rolled item is stamped
// unidentified; the dealt record lives in class_resources_json.loot.
import {
  stampDealtItem, availableToDeal, loadLootState, saveLootState, recordDealt,
} from './magicItemDiscoveryService.js';

/**
 * Generate loot for a killed enemy.
 * @param {number} characterId - Who gets the loot
 * @param {number} deathEventId - The death event to mark as looted
 * @param {string} enemyName
 * @param {number} characterLevel - For loot table selection
 * @returns {Promise<object>} Loot result
 */
export async function generateKillLoot(characterId, deathEventId, enemyName, characterLevel = 1) {
  if (!characterId || !deathEventId) return null;
  
  // Check if already looted
  const evt = await dbGet('SELECT looted FROM combat_death_events WHERE id = ?', [deathEventId]);
  if (!evt || evt.looted) return { type: 'kill_loot', alreadyLooted: true };
  
  const lootTable = getLootTableForLevel(characterLevel) || [];
  if (lootTable.length === 0) return { type: 'kill_loot', noLoot: true };

  // Loot wiring (R-02): never deal the same named item twice — exclude
  // names already dealt (class_resources_json.loot) and names already
  // owned (in inventory). If nothing new is available, the kill was
  // still looted, there is just nothing new to give.
  const char = await dbGet('SELECT inventory, class_resources_json FROM characters WHERE id = ?', [characterId]);
  if (!char) return null;
  const inventory = safeParse(char.inventory, []);
  const lootState = await loadLootState('character', characterId);
  const available = availableToDeal(lootTable, lootState, inventory);
  if (available.length === 0) {
    await dbRun('UPDATE combat_death_events SET looted = 1 WHERE id = ?', [deathEventId]);
    return { type: 'kill_loot', enemyName, items: [], noNewLoot: true, deathEventId };
  }

  // Roll 1-2 items, without replacement inside the roll
  const numItems = Math.min(roll(2).total, available.length);
  const items = [];
  const pool = [...available];
  for (let i = 0; i < numItems; i++) {
    const idx = roll(pool.length).total - 1;
    items.push(pool.splice(idx, 1)[0]);
  }

  // Add to inventory, stamped unidentified (R-02: never hand out a name)
  for (const itemName of items) {
    const existing = inventory.find(i => i.name.toLowerCase() === itemName.toLowerCase());
    if (existing) {
      existing.quantity = (existing.quantity || 1) + 1;
    } else {
      inventory.push(stampDealtItem({ name: itemName, quantity: 1 }));
    }
  }
  await dbRun('UPDATE characters SET inventory = ? WHERE id = ?', [JSON.stringify(inventory), characterId]);
  await saveLootState('character', characterId, recordDealt(lootState, items));

  // Mark as looted
  await dbRun('UPDATE combat_death_events SET looted = 1 WHERE id = ?', [deathEventId]);

  return { type: 'kill_loot', enemyName, items, deathEventId };
}

export default { generateKillLoot };
