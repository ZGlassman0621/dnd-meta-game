/**
 * Loot Drop Service (Phase 3 SC-6.4b)
 *
 * Owns the LOOT_DROP marker handler. Validates dropped items against
 * the loot-table catalog, mutates character inventory, and returns the
 * structured result the route handler uses to assemble the SYSTEM note
 * fed back to the AI ("the following items have been added").
 *
 * Created during SC-6.4b because no existing service owned character
 * inventory mutation for AI-driven drops. Single-purpose module; if
 * future inventory-mutating markers emerge, they can co-locate here.
 */

import { dbGet, dbRun } from '../database.js';
import { safeParse } from '../utils/safeParse.js';
import { lookupItemByName } from '../data/merchantLootTables.js';
import { getLootTableForLevel } from '../config/rewards.js';
import { registerHandler as registerMarkerHandler } from './markerPipeline.js';

/**
 * LOOT_DROP handler. Multi-instance marker — pipeline dispatches the
 * handler once per emitted marker. Each invocation does one read +
 * one write; legacy code did one read + one write per turn (batched
 * across markers). Acceptable cost: LOOT_DROP markers are rare per
 * turn (combat resolutions, treasure finds) and `characters.inventory`
 * is small (typical ~30 items).
 *
 * Returns the structured drop result the route used to assemble the
 * combined SYSTEM note. The route consolidates handlerResults across
 * all LOOT_DROP entries into a single message push (preserves the
 * legacy "items have been added: A, B, C" combined-message shape).
 */
registerMarkerHandler('LOOT_DROP', async (parsed, context) => {
  if (!context?.characterId) return null;
  const character = await dbGet(
    'SELECT id, level, inventory FROM characters WHERE id = ?',
    [context.characterId]
  );
  if (!character) return null;

  const inventory = safeParse(character.inventory, []);
  const knownItem = lookupItemByName(parsed.Item);
  const lootTable = getLootTableForLevel(character.level);
  const isInLootTable = lootTable.includes(parsed.Item);
  const itemName = knownItem ? knownItem.name : parsed.Item;

  const existing = inventory.find(i => i.name.toLowerCase() === itemName.toLowerCase());
  if (existing) {
    existing.quantity = (existing.quantity || 1) + 1;
  } else {
    inventory.push({ name: itemName, quantity: 1 });
  }

  await dbRun(
    'UPDATE characters SET inventory = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [JSON.stringify(inventory), character.id]
  );

  return {
    type: 'loot_drop',
    item: itemName,
    source: parsed.Source,
    known: !!knownItem || isInLootTable
  };
});
