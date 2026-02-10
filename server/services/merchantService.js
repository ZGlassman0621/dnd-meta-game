/**
 * Merchant Service — CRUD operations for persistent merchant inventories.
 * Bridges loot tables, database, and campaign plan generation.
 */

import { dbGet, dbRun, dbAll } from '../database.js';
import { generateInventory, generateBuybackPrices, PROSPERITY_CONFIG, buildCustomItem, lookupItemByName } from '../data/merchantLootTables.js';

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

  // Generate fresh stock
  const freshStock = generateInventory(merchant.merchant_type, merchant.prosperity, characterLevel);

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
    SET inventory = ?, gold_gp = ?, last_restocked = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [JSON.stringify(merged), config.goldPurse, new Date().toISOString(), merchantId]);

  return { inventory: merged, gold_gp: config.goldPurse };
}

/**
 * Update merchant inventory and gold after a transaction.
 */
export async function updateMerchantAfterTransaction(merchantId, updatedInventory, newGold) {
  await dbRun(`
    UPDATE merchant_inventories
    SET inventory = ?, gold_gp = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [JSON.stringify(updatedInventory), Math.max(0, newGold), merchantId]);
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
    SET inventory = ?, updated_at = CURRENT_TIMESTAMP
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
    SET inventory = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [JSON.stringify(inventory), merchant.id]);

  return newItem;
}

export { generateBuybackPrices };
