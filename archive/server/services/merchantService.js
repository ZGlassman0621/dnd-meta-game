/**
 * Merchant Service — CRUD operations for persistent merchant inventories.
 * Bridges loot tables, database, and campaign plan generation.
 */

import { dbGet, dbRun, dbAll } from '../database.js';
import { generateInventory, generateBuybackPrices, PROSPERITY_CONFIG, buildCustomItem, lookupItemByName } from '../data/merchantLootTables.js';
import { registerHandler as registerMarkerHandler } from './markerPipeline.js';
import { extractMarkerBodies, parseMarkerBody } from './markerSchemas.js';

/**
 * Create merchant inventory entries from a campaign plan.
 * Called after campaign plan generation. Idempotent — skips existing merchants.
 */
export async function createMerchantsFromPlan(campaignId, plan) {
  if (!plan.merchants || plan.merchants.length === 0) return [];

  const created = [];
  for (const merchant of plan.merchants) {
    // Skip if already exists for this campaign
    const existing = await dbGet(
      'SELECT id FROM merchant_inventories WHERE campaign_id = ? AND merchant_name = ?',
      [campaignId, merchant.name]
    );
    if (existing) {
      created.push({ id: existing.id, name: merchant.name, existed: true });
      continue;
    }

    const prosperity = merchant.prosperity_level || 'comfortable';
    const config = PROSPERITY_CONFIG[prosperity] || PROSPERITY_CONFIG.comfortable;
    const inventory = generateInventory(merchant.type || 'general', prosperity, 1);

    const result = await dbRun(`
      INSERT INTO merchant_inventories
        (campaign_id, merchant_name, merchant_type, location, specialty, personality, prosperity, inventory, gold_gp, last_restocked)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      campaignId,
      merchant.name,
      merchant.type || 'general',
      merchant.location || null,
      merchant.specialty || null,
      merchant.personality || null,
      prosperity,
      JSON.stringify(inventory),
      config.goldPurse,
      new Date().toISOString()
    ]);

    created.push({ id: Number(result.lastInsertRowid), name: merchant.name });
  }
  return created;
}

/**
 * Look up a merchant's inventory by campaign and name.
 * Case-insensitive partial match on merchant name.
 */
export async function getMerchantInventory(campaignId, merchantName) {
  // Try exact match first, then partial
  let merchant = await dbGet(
    'SELECT * FROM merchant_inventories WHERE campaign_id = ? AND LOWER(merchant_name) = LOWER(?)',
    [campaignId, merchantName]
  );
  if (!merchant) {
    merchant = await dbGet(
      'SELECT * FROM merchant_inventories WHERE campaign_id = ? AND LOWER(merchant_name) LIKE LOWER(?)',
      [campaignId, `%${merchantName}%`]
    );
  }
  if (!merchant) return null;

  return {
    ...merchant,
    inventory: JSON.parse(merchant.inventory || '[]')
  };
}

/**
 * Auto-create a merchant discovered during gameplay.
 * Called when the AI emits a MERCHANT_SHOP marker for a merchant not in the DB.
 * Uses loot tables to generate inventory instantly — no AI cost.
 */
export async function createMerchantOnTheFly(campaignId, merchantName, merchantType, location, characterLevel = 1) {
  const type = merchantType || 'general';
  const prosperity = 'comfortable'; // Default for ad-hoc merchants

  const config = PROSPERITY_CONFIG[prosperity] || PROSPERITY_CONFIG.comfortable;
  const inventory = generateInventory(type, prosperity, characterLevel);

  const result = await dbRun(`
    INSERT INTO merchant_inventories
      (campaign_id, merchant_name, merchant_type, location, specialty, personality, prosperity, inventory, gold_gp, last_restocked)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    campaignId,
    merchantName,
    type,
    location || null,
    null, // no specialty for ad-hoc merchants
    null, // no personality — AI is already role-playing them
    prosperity,
    JSON.stringify(inventory),
    config.goldPurse,
    new Date().toISOString()
  ]);

  return {
    id: Number(result.lastInsertRowid),
    campaign_id: campaignId,
    merchant_name: merchantName,
    merchant_type: type,
    location: location || null,
    specialty: null,
    personality: null,
    prosperity,
    inventory,
    gold_gp: config.goldPurse
  };
}

/**
 * List all merchants for a campaign (summary — no full inventory).
 */
export async function getMerchantsByCampaign(campaignId) {
  const rows = await dbAll(
    'SELECT id, merchant_name, merchant_type, location, specialty, personality, prosperity, gold_gp, last_restocked FROM merchant_inventories WHERE campaign_id = ? ORDER BY merchant_name',
    [campaignId]
  );
  return rows;
}

/**
 * Restock a merchant's inventory from loot tables.
 * Existing items have 50% chance to persist, new items are added.
 * Merchant gold is reset to prosperity-based purse.
 */
export async function restockMerchant(merchantId, characterLevel = 1) {
  const merchant = await dbGet('SELECT * FROM merchant_inventories WHERE id = ?', [merchantId]);
  if (!merchant) throw new Error('Merchant not found');

  const config = PROSPERITY_CONFIG[merchant.prosperity] || PROSPERITY_CONFIG.comfortable;
  const oldInventory = JSON.parse(merchant.inventory || '[]');

  // 50% of existing items persist (simulates some stock remaining)
  const persisted = oldInventory.filter(() => Math.random() < 0.5);

  // Smart restocking: analyze transaction history to stock more of what sells
  let popularCategories = {};
  try {
    const history = JSON.parse(merchant.transaction_history || '[]');
    for (const tx of history) {
      for (const item of (tx.bought || [])) {
        const cat = item.category || 'misc';
        popularCategories[cat] = (popularCategories[cat] || 0) + (item.qty || 1);
      }
    }
  } catch (e) { /* ignore parse errors */ }

  // Generate fresh stock
  const freshStock = generateInventory(merchant.merchant_type, merchant.prosperity, characterLevel);

  // If there are popular categories, generate extra items from those categories
  // Add 1-3 bonus items from the top selling category
  const topCategory = Object.entries(popularCategories).sort((a, b) => b[1] - a[1])[0];
  if (topCategory && topCategory[1] >= 3) {
    const bonusStock = generateInventory(merchant.merchant_type, merchant.prosperity, characterLevel);
    const categoryItems = bonusStock.filter(i => i.category === topCategory[0]);
    const bonusItems = categoryItems.slice(0, Math.min(3, categoryItems.length));
    freshStock.push(...bonusItems);
  }

  // Merge: persisted items stay, fresh items fill remaining slots
  const merged = [...persisted];
  for (const item of freshStock) {
    const exists = merged.find(m => m.name.toLowerCase() === item.name.toLowerCase());
    if (exists) {
      // Add fresh quantity to existing
      exists.quantity = (exists.quantity || 1) + (item.quantity || 1);
    } else {
      merged.push(item);
    }
  }

  await dbRun(`
    UPDATE merchant_inventories
    SET inventory = ?, gold_gp = ?, last_restocked = ?, inventory_version = inventory_version + 1, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [JSON.stringify(merged), config.goldPurse, new Date().toISOString(), merchantId]);

  return { inventory: merged, gold_gp: config.goldPurse };
}

/**
 * Update merchant inventory and gold after a transaction.
 * Uses optimistic locking on both gold AND inventory_version to prevent concurrent overwrites.
 */
export async function updateMerchantAfterTransaction(merchantId, updatedInventory, newGold, expectedGold = null, expectedVersion = null) {
  if (expectedGold !== null) {
    // Full optimistic locking: check gold AND inventory version
    const whereClause = expectedVersion !== null
      ? 'WHERE id = ? AND gold_gp = ? AND inventory_version = ?'
      : 'WHERE id = ? AND gold_gp = ?';
    const args = [
      JSON.stringify(updatedInventory), Math.max(0, newGold), merchantId, expectedGold,
      ...(expectedVersion !== null ? [expectedVersion] : [])
    ];

    const result = await dbRun(`
      UPDATE merchant_inventories
      SET inventory = ?, gold_gp = ?, inventory_version = inventory_version + 1, updated_at = CURRENT_TIMESTAMP
      ${whereClause}
    `, args);
    if (Number(result.changes) === 0) {
      throw new Error('Transaction conflict: merchant inventory was modified by another transaction. Please retry.');
    }
  } else {
    await dbRun(`
      UPDATE merchant_inventories
      SET inventory = ?, gold_gp = ?, inventory_version = inventory_version + 1, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [JSON.stringify(updatedInventory), Math.max(0, newGold), merchantId]);
  }
}

/**
 * Add a custom item to a merchant's inventory.
 * Used when the AI creates a narrative item (e.g. "Lathanderian cloak pin")
 * and needs it to appear in the actual shop inventory.
 */
export async function addItemToMerchant(merchantId, { name, price_gp, quality, category, description }) {
  const merchant = await dbGet('SELECT * FROM merchant_inventories WHERE id = ?', [merchantId]);
  if (!merchant) throw new Error('Merchant not found');

  const inventory = JSON.parse(merchant.inventory || '[]');

  // Check if already in stock
  const existing = inventory.find(i => i.name.toLowerCase() === name.toLowerCase());
  if (existing) {
    existing.quantity = (existing.quantity || 1) + 1;
  } else {
    const item = buildCustomItem({ name, price_gp, quality, category, description });
    inventory.push(item);
  }

  await dbRun(`
    UPDATE merchant_inventories
    SET inventory = ?, inventory_version = inventory_version + 1, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [JSON.stringify(inventory), merchantId]);

  return inventory;
}

/**
 * Ensure a specific item exists at a merchant (for cross-merchant referrals).
 * If the item isn't in the merchant's stock, create it from loot tables or as custom.
 */
export async function ensureItemAtMerchant(campaignId, merchantName, itemName, itemCategory) {
  let merchant = await getMerchantInventory(campaignId, merchantName);
  if (!merchant) return null; // Merchant doesn't exist

  const inventory = merchant.inventory;

  // Check if item (or close match) already exists
  const lower = itemName.toLowerCase();
  const existing = inventory.find(i => i.name.toLowerCase().includes(lower) || lower.includes(i.name.toLowerCase()));
  if (existing) return existing;

  // Try to build from known items first
  const known = lookupItemByName(itemName);
  const config = PROSPERITY_CONFIG[merchant.prosperity] || PROSPERITY_CONFIG.comfortable;

  const newItem = known
    ? {
      name: known.cursed ? known.appears_as : known.name,
      price_gp: Math.round(known.price_gp * config.priceMultiplier * 100) / 100,
      price_sp: Math.round((known.price_sp || 0) * config.priceMultiplier),
      price_cp: Math.round((known.price_cp || 0) * config.priceMultiplier),
      category: known.category,
      description: known.description || '',
      quantity: 1,
      rarity: known.rarity,
      ...(known.cursed ? {
        cursed: true,
        true_name: known.name,
        curse_description: known.curse_description
      } : {})
    }
    : buildCustomItem({ name: itemName, price_gp: 0, category: itemCategory || 'adventuring_gear' });

  inventory.push(newItem);

  await dbRun(`
    UPDATE merchant_inventories
    SET inventory = ?, inventory_version = inventory_version + 1, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [JSON.stringify(inventory), merchant.id]);

  return newItem;
}

export { generateBuybackPrices };

// ============================================================
// SC-6.4b — Merchant cluster marker handlers
// ============================================================

/**
 * MERCHANT_SHOP handler — orchestrates the full merchant-shop activation
 * sequence. Replaces the inline dispatch at the pre-SC-6.4b
 * routes/dmSession.js:1500-1591 site.
 *
 * Per the SC-6.4b cluster-2 design (DECISION_LOG entry, consolidated at
 * v1.0.153): this handler INTERNALLY processes the coupled ADD_ITEM
 * markers from the same narrative because the legacy code orchestrated
 * them together (ADD_ITEM only does anything when MERCHANT_SHOP set the
 * "current merchant" context). Splitting into independent handlers
 * would break the implicit ordering. ADD_ITEM stays as schema-only
 * (parked from independent dispatch) — schema validation still fires
 * for correction-loop feedback on malformed item markers.
 *
 * Returns a structured object the route handler reads from
 * handlerResults to assemble the final inventoryContext system note +
 * persist to dm_sessions.messages. Side effects done in handler;
 * AI-context message construction stays at the route call site so the
 * messages-array reference (closed over in the route) gets the push.
 */
registerMarkerHandler('MERCHANT_SHOP', async (parsed, context) => {
  if (!context?.characterId) return null;
  const character = await dbGet('SELECT campaign_id, level FROM characters WHERE id = ?', [context.characterId]);
  if (!character?.campaign_id) return null;

  const merchantName = parsed.Merchant;
  const merchantType = parsed.Type;
  const location = parsed.Location;

  console.log(`🏪 MERCHANT_SHOP detected: "${merchantName}" (${merchantType}) at ${location}`);

  let dbMerchant = await getMerchantInventory(character.campaign_id, merchantName);
  if (!dbMerchant) {
    dbMerchant = await createMerchantOnTheFly(
      character.campaign_id, merchantName, merchantType, location, character.level || 1
    );
  }

  // Process coupled ADD_ITEM markers from the same narrative. ADD_ITEM
  // schema is registered (correction loop active); independent handler
  // dispatch is parked because it requires the MERCHANT_SHOP-established
  // "current merchant" context.
  const addItemBodies = extractMarkerBodies(context.narrative || '', 'ADD_ITEM', { all: true });
  const addedItems = [];
  for (const body of addItemBodies) {
    const parseResult = parseMarkerBody(body, 'ADD_ITEM');
    if (!parseResult.ok) continue;
    try {
      await addItemToMerchant(dbMerchant.id, {
        name: parseResult.data.Name,
        price_gp: parseResult.data.Price_GP,
        quality: parseResult.data.Quality,
        category: parseResult.data.Category
      });
      addedItems.push(parseResult.data.Name);
    } catch (e) {
      console.error('Error adding item to merchant:', e);
    }
  }

  // Re-fetch inventory after any additions so the inventoryContext
  // reflects the post-ADD_ITEM state.
  if (addedItems.length > 0) {
    dbMerchant = await getMerchantInventory(character.campaign_id, merchantName);
  }

  // Build the inventoryContext system note. Route handler appends to
  // result.messages and persists.
  const itemList = dbMerchant.inventory
    .map(i => {
      let line = `- ${i.name} (${i.price_gp}gp${i.quantity > 1 ? `, qty: ${i.quantity}` : ''}${i.quality ? ` [${i.quality}]` : ''})`;
      if (i.cursed && i.true_name) {
        line += ` [CURSED: actually ${i.true_name} — ${i.curse_description}]`;
      }
      return line;
    })
    .join('\n');
  const hasCursedItems = dbMerchant.inventory.some(i => i.cursed);
  const cursedInstructions = hasCursedItems
    ? '\nCURSED ITEMS: Items marked [CURSED] APPEAR to the player as the normal item listed. Do NOT reveal the curse — describe it convincingly as the item it appears to be. The curse reveals itself only when used or identified with Identify/Detect Magic. If the player casts Identify, THEN reveal the true nature.'
    : '';
  const inventoryContext = `[SYSTEM: ${merchantName}'s actual inventory — ONLY reference these items when the player asks what's available:\n${itemList}\nMerchant gold: ${dbMerchant.gold_gp}gp. Do NOT invent items not on this list. The shop UI shows this inventory to the player. If an item isn't here, suggest an alternative or refer to another merchant with [MERCHANT_REFER]. You can add fitting custom items with [ADD_ITEM].${cursedInstructions}]`;

  return {
    type: 'merchant_shop',
    merchantId: dbMerchant.id,
    merchantName,
    merchantType,
    location,
    addedItems,
    inventoryContext // route handler appends to result.messages + persists
  };
});

/**
 * MERCHANT_REFER handler — ensure the referenced item exists at the
 * destination merchant before the player travels there. Simple,
 * single-purpose; no AI-context message push.
 */
registerMarkerHandler('MERCHANT_REFER', async (parsed, context) => {
  if (!context?.characterId) return null;
  const character = await dbGet('SELECT campaign_id FROM characters WHERE id = ?', [context.characterId]);
  if (!character?.campaign_id) return null;
  try {
    await ensureItemAtMerchant(character.campaign_id, parsed.To, parsed.Item);
    return { type: 'merchant_refer', from: parsed.From, to: parsed.To, item: parsed.Item };
  } catch (e) {
    console.error('Error ensuring item at referred merchant:', e);
    return null;
  }
});
