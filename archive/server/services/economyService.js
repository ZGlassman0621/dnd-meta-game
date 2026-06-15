/**
 * Economy Service — Dynamic economy simulation for merchant pricing.
 *
 * Computes per-category price modifiers based on:
 * 1. Active world events (war → weapons expensive, plague → potions expensive)
 * 2. Regional geography (coastal → trade goods cheap, mountain → metal cheap)
 * 3. Merchant memory (loyalty discounts, demand-based markups)
 * 4. Bulk purchase discounts
 */

import { dbAll, dbGet, dbRun } from '../database.js';
import { safeParse } from '../utils/safeParse.js';
import {
  EVENT_PRICE_EFFECTS,
  REGIONAL_MODIFIERS,
  REVERSE_CATEGORY_LOOKUP,
  BULK_DISCOUNT_TIERS,
  MERCHANT_MEMORY
} from '../config/economyConfig.js';

// ============================================================
// WORLD EVENT PRICE EFFECTS
// ============================================================

/**
 * Look up active world events that affect a merchant's location and compute
 * per-category price modifiers.
 *
 * @param {number} campaignId
 * @param {string|null} merchantLocation - Merchant's location name
 * @returns {{ categoryModifiers: Object, activeEffects: Array }}
 */
export async function getWorldEventPriceEffects(campaignId, merchantLocation) {
  const categoryModifiers = {};
  const activeEffects = [];

  const events = await dbAll(
    "SELECT * FROM world_events WHERE campaign_id = ? AND status = 'active'",
    [campaignId]
  );

  for (const event of events) {
    const affectedLocations = safeParse(event.affected_locations, []);
    const scope = event.scope || 'local';

    // Check if this event affects the merchant's location
    const locationMatch = !merchantLocation
      ? false
      : scope === 'continental' || scope === 'regional'
        ? true
        : affectedLocations.some(loc => {
            if (typeof loc === 'string') {
              return loc.toLowerCase() === merchantLocation.toLowerCase();
            }
            if (typeof loc === 'number') return false;
            if (loc?.name) return loc.name.toLowerCase() === merchantLocation.toLowerCase();
            return false;
          });

    if (!locationMatch && scope === 'local') continue;

    // Look up price effects for this event type and stage
    const eventEffects = EVENT_PRICE_EFFECTS[event.event_type];
    if (!eventEffects) continue;

    const stageEffects = eventEffects[event.current_stage];
    if (!stageEffects || Object.keys(stageEffects).length === 0) continue;

    // Aggregate modifiers
    const affectedCategories = [];
    for (const [category, modifier] of Object.entries(stageEffects)) {
      categoryModifiers[category] = (categoryModifiers[category] || 0) + modifier;
      affectedCategories.push(category);
    }

    activeEffects.push({
      eventTitle: event.title,
      eventType: event.event_type,
      stage: event.current_stage,
      categories: affectedCategories,
      modifiers: stageEffects
    });
  }

  return { categoryModifiers, activeEffects };
}

// ============================================================
// REGIONAL MODIFIERS
// ============================================================

/**
 * Derive price modifiers from the merchant's location geography.
 * Matches location climate and tags against REGIONAL_MODIFIERS config.
 *
 * @param {number} campaignId
 * @param {string|null} merchantLocation - Merchant's location name
 * @returns {{ categoryModifiers: Object, appliedRegions: string[] }}
 */
export async function getRegionalModifiers(campaignId, merchantLocation) {
  const categoryModifiers = {};
  const appliedRegions = [];

  if (!merchantLocation) return { categoryModifiers, appliedRegions };

  // Look up the location in the database
  const location = await dbGet(
    'SELECT climate, tags FROM locations WHERE campaign_id = ? AND LOWER(name) LIKE LOWER(?) LIMIT 1',
    [campaignId, `%${merchantLocation}%`]
  );

  if (!location) return { categoryModifiers, appliedRegions };

  // Collect all keywords to match against: climate + tags
  const keywords = [];
  if (location.climate) keywords.push(location.climate.toLowerCase());

  const tags = safeParse(location.tags, []);
  for (const tag of tags) {
    if (typeof tag === 'string') keywords.push(tag.toLowerCase());
  }

  // Match keywords against REGIONAL_MODIFIERS keys
  for (const [regionKey, modifiers] of Object.entries(REGIONAL_MODIFIERS)) {
    const matches = keywords.some(kw =>
      kw.includes(regionKey) || regionKey.includes(kw)
    );

    if (matches) {
      appliedRegions.push(regionKey);
      for (const [category, modifier] of Object.entries(modifiers)) {
        categoryModifiers[category] = (categoryModifiers[category] || 0) + modifier;
      }
    }
  }

  return { categoryModifiers, appliedRegions };
}

// ============================================================
// MERCHANT MEMORY
// ============================================================

/**
 * Compute price modifiers based on merchant's transaction history with this character.
 *
 * @param {number} merchantId
 * @param {number} characterId
 * @returns {{ loyaltyDiscount: number, categoryModifiers: Object, visitCount: number }}
 */
export async function getMerchantMemoryModifiers(merchantId, characterId) {
  const categoryModifiers = {};
  let loyaltyDiscount = 0;
  let visitCount = 0;

  const merchant = await dbGet(
    'SELECT transaction_history FROM merchant_inventories WHERE id = ?',
    [merchantId]
  );

  if (!merchant) return { loyaltyDiscount, categoryModifiers, visitCount };

  const history = safeParse(merchant.transaction_history, []);
  const charHistory = history.filter(h => h.character_id === characterId);
  visitCount = charHistory.length;

  // Loyalty discount for frequent customers
  if (visitCount >= MERCHANT_MEMORY.loyaltyThreshold) {
    loyaltyDiscount = MERCHANT_MEMORY.loyaltyDiscount;
  }

  // Count items bought/sold per category
  const boughtByCategory = {};
  const soldByCategory = {};

  for (const tx of charHistory) {
    for (const item of (tx.bought || [])) {
      const cat = item.category || 'misc';
      boughtByCategory[cat] = (boughtByCategory[cat] || 0) + (item.qty || 1);
    }
    for (const item of (tx.sold || [])) {
      const cat = item.category || 'misc';
      soldByCategory[cat] = (soldByCategory[cat] || 0) + (item.qty || 1);
    }
  }

  // Frequent buyer markup — merchant charges more for categories in high demand
  for (const [cat, count] of Object.entries(boughtByCategory)) {
    if (count >= MERCHANT_MEMORY.frequentBuyerThreshold) {
      // Resolve to economy category key
      const econKey = REVERSE_CATEGORY_LOOKUP[cat] || cat;
      categoryModifiers[econKey] = (categoryModifiers[econKey] || 0) + MERCHANT_MEMORY.frequentBuyerMarkup;
    }
  }

  // Frequent seller discount — merchant pays less for categories they're flooded with
  // (This affects buyback prices, not buying prices — tracked for DM prompt context)
  for (const [cat, count] of Object.entries(soldByCategory)) {
    if (count >= MERCHANT_MEMORY.frequentSellerThreshold) {
      const econKey = REVERSE_CATEGORY_LOOKUP[cat] || cat;
      categoryModifiers[econKey] = (categoryModifiers[econKey] || 0) - MERCHANT_MEMORY.frequentSellerDiscount;
    }
  }

  return { loyaltyDiscount, categoryModifiers, visitCount };
}

// ============================================================
// BULK DISCOUNTS
// ============================================================

/**
 * Get bulk discount percentage for a total item count.
 * @param {number} totalItemCount - Total items being purchased
 * @returns {number} Discount as decimal (0.05 = 5% off)
 */
export function getBulkDiscount(totalItemCount) {
  for (const tier of BULK_DISCOUNT_TIERS) {
    if (totalItemCount >= tier.minQty) return tier.discount;
  }
  return 0;
}

// ============================================================
// COMBINED ECONOMY MODIFIERS
// ============================================================

/**
 * Calculate all economy modifiers for a merchant.
 * Merges world events, regional geography, and merchant memory into
 * per-category price modifiers.
 *
 * @param {number} campaignId
 * @param {number} merchantId
 * @param {string|null} merchantLocation
 * @param {number} characterId
 * @returns {Object} Combined economy modifiers
 */
export async function calculateEconomyModifiers(campaignId, merchantId, merchantLocation, characterId) {
  const [eventEffects, regionalModifiers, merchantMemory] = await Promise.all([
    getWorldEventPriceEffects(campaignId, merchantLocation),
    getRegionalModifiers(campaignId, merchantLocation),
    getMerchantMemoryModifiers(merchantId, characterId)
  ]);

  // Merge all category modifiers (additive)
  const combinedCategoryModifiers = {};
  const allSources = [
    eventEffects.categoryModifiers,
    regionalModifiers.categoryModifiers,
    merchantMemory.categoryModifiers
  ];

  for (const source of allSources) {
    for (const [category, modifier] of Object.entries(source)) {
      combinedCategoryModifiers[category] = (combinedCategoryModifiers[category] || 0) + modifier;
    }
  }

  return {
    eventEffects,
    regionalModifiers,
    merchantMemory,
    combinedCategoryModifiers,
    loyaltyDiscount: merchantMemory.loyaltyDiscount
  };
}

// ============================================================
// PER-ITEM ECONOMY MULTIPLIER
// ============================================================

/**
 * Get the economy price multiplier for a specific item based on its category.
 * Resolves item category strings to economy category keys via REVERSE_CATEGORY_LOOKUP.
 *
 * @param {string} itemCategory - Item's category from loot tables
 * @param {Object} economyModifiers - Result from calculateEconomyModifiers()
 * @returns {number} Multiplier (1.0 = no change, 1.25 = +25%, 0.90 = -10%)
 */
export function getItemEconomyMultiplier(itemCategory, economyModifiers) {
  if (!economyModifiers?.combinedCategoryModifiers) return 1;

  // Resolve item category to economy key
  const econKey = REVERSE_CATEGORY_LOOKUP[itemCategory] || itemCategory;
  const modifier = economyModifiers.combinedCategoryModifiers[econKey] || 0;

  // Clamp individual item multiplier to [0.50, 2.00]
  return Math.max(0.50, Math.min(2.00, 1 + modifier));
}

// ============================================================
// TRANSACTION RECORDING
// ============================================================

/**
 * Record a merchant transaction for memory/loyalty tracking.
 *
 * @param {number} merchantId
 * @param {number} characterId
 * @param {Array} bought - Items bought: [{ name, category, quantity }]
 * @param {Array} sold - Items sold: [{ name, category, quantity }]
 * @param {number|null} gameDay - Current game day
 */
export async function recordTransaction(merchantId, characterId, bought, sold, gameDay, totals = {}) {
  const merchant = await dbGet(
    'SELECT transaction_history FROM merchant_inventories WHERE id = ?',
    [merchantId]
  );
  if (!merchant) return;

  const history = safeParse(merchant.transaction_history, []);

  const entry = {
    character_id: characterId,
    game_day: gameDay || null,
    date: new Date().toISOString(),
    at: new Date().toISOString(), // M4: alias used by merchantRelationshipService
    total_spent_cp: totals.total_spent_cp || 0, // M4
    total_earned_cp: totals.total_earned_cp || 0, // M4
    bought: (bought || []).map(i => ({
      name: i.name,
      category: i.category || 'misc',
      qty: i.quantity || 1
    })),
    sold: (sold || []).map(i => ({
      name: i.name,
      category: i.category || 'misc',
      qty: i.quantity || 1
    }))
  };

  history.push(entry);

  // Trim to max history
  while (history.length > MERCHANT_MEMORY.maxHistory) {
    history.shift();
  }

  await dbRun(
    'UPDATE merchant_inventories SET transaction_history = ? WHERE id = ?',
    [JSON.stringify(history), merchantId]
  );
}
