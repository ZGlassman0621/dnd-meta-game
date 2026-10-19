/**
 * Kill Loot Service (Combat Pipeline #9).
 * When an enemy dies, automatically roll loot from their CR-appropriate table.
 * Server-rolled via rng.js. Uses existing loot table validation.
 */
import { dbGet, dbRun } from '../database.js';
import { safeParse } from '../utils/safeParse.js';
import { getLootTableForLevel } from '../config/rewards.js';
import { roll } from '../utils/rng.js';

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
  
  // Roll 1-2 items
  const numItems = roll(2).total;
  const items = [];
  for (let i = 0; i < numItems; i++) {
    const idx = roll(lootTable.length).total - 1;
    items.push(lootTable[idx]);
  }
  
  // Add to inventory
  const char = await dbGet('SELECT inventory FROM characters WHERE id = ?', [characterId]);
  if (!char) return null;
  const inventory = safeParse(char.inventory, []);
  for (const itemName of items) {
    const existing = inventory.find(i => i.name.toLowerCase() === itemName.toLowerCase());
    if (existing) {
      existing.quantity = (existing.quantity || 1) + 1;
    } else {
      inventory.push({ name: itemName, quantity: 1 });
    }
  }
  await dbRun('UPDATE characters SET inventory = ? WHERE id = ?', [JSON.stringify(inventory), characterId]);
  
  // Mark as looted
  await dbRun('UPDATE combat_death_events SET looted = 1 WHERE id = ?', [deathEventId]);
  
  return { type: 'kill_loot', enemyName, items, deathEventId };
}

export default { generateKillLoot };
