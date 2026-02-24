/**
 * Economy Configuration — Constants for the dynamic economy simulation system.
 * Controls how world events, regions, merchant memory, and bulk purchases affect prices.
 */

// ============================================================
// WORLD EVENT PRICE EFFECTS
// ============================================================

/**
 * event_type × stage → item category price modifiers.
 * Modifier is additive percentage: 0.25 = +25% price increase, -0.15 = 15% cheaper.
 * Multiple events stack additively.
 */
export const EVENT_PRICE_EFFECTS = {
  military: {
    0: { weapon: 0.10, armor: 0.10, ammunition: 0.10 },
    1: { weapon: 0.20, armor: 0.20, ammunition: 0.15, adventuring_gear: 0.10 },
    2: { weapon: 0.30, armor: 0.30, ammunition: 0.25, adventuring_gear: 0.15 }
  },
  natural_disaster: {
    0: { adventuring_gear: 0.10 },
    1: { adventuring_gear: 0.20, potion: 0.15, tool: 0.10 },
    2: { adventuring_gear: 0.30, potion: 0.25, tool: 0.20, weapon: -0.10 }
  },
  economic: {
    0: { gem: 0.10 },
    1: { gem: 0.20, clothing: 0.15, leather_goods: 0.10 },
    2: { gem: 0.30, clothing: 0.20, leather_goods: 0.15 }
  },
  political: {
    0: {},
    1: { adventuring_gear: 0.05 },
    2: { weapon: 0.15, armor: 0.10, adventuring_gear: 0.10 }
  },
  conspiracy: {
    0: {},
    1: { potion: 0.10, magic_item: 0.10 },
    2: { potion: 0.20, magic_item: 0.15 }
  }
};

// ============================================================
// CATEGORY ALIASES
// ============================================================

/**
 * Maps economy category keys to actual item category strings used in loot tables.
 * Used to resolve item.category → economy modifier lookup.
 */
export const CATEGORY_ALIASES = {
  weapon: ['weapon'],
  armor: ['armor'],
  ammunition: ['ammunition'],
  potion: ['potions_consumables', 'potion'],
  adventuring_gear: ['adventuring_gear'],
  tool: ['tools', 'tool'],
  magic_item: ['magic_items', 'magic_item'],
  gem: ['gems_jewelry', 'gem'],
  clothing: ['clothing'],
  leather_goods: ['leather_goods']
};

// Build reverse lookup: item category string → economy category key
const _reverseLookup = {};
for (const [econKey, aliases] of Object.entries(CATEGORY_ALIASES)) {
  for (const alias of aliases) {
    _reverseLookup[alias] = econKey;
  }
}
export const REVERSE_CATEGORY_LOOKUP = _reverseLookup;

// ============================================================
// REGIONAL MODIFIERS
// ============================================================

/**
 * climate/tag keywords → category price modifiers.
 * Negative = cheaper (abundant locally), positive = more expensive (scarce).
 * Matched against location climate field and tags JSON array.
 */
export const REGIONAL_MODIFIERS = {
  coastal:      { adventuring_gear: -0.05, weapon: 0.05 },
  mountain:     { armor: -0.08, weapon: -0.05, adventuring_gear: 0.05 },
  forest:       { adventuring_gear: -0.05, armor: 0.05 },
  desert:       { adventuring_gear: 0.10, potion: 0.10 },
  arctic:       { adventuring_gear: 0.15, potion: 0.10, clothing: -0.10 },
  tropical:     { potion: -0.10, gem: -0.05 },
  underground:  { weapon: -0.05, armor: -0.05, adventuring_gear: 0.10 },
  port:         { adventuring_gear: -0.10, gem: -0.10, clothing: -0.05 },
  mining:       { armor: -0.10, weapon: -0.08 },
  farming:      { adventuring_gear: -0.08 },
  trade_hub:    { adventuring_gear: -0.10, gem: -0.08 }
};

// ============================================================
// BULK DISCOUNT TIERS
// ============================================================

/**
 * Quantity thresholds → discount percentage.
 * Sorted descending by minQty — first match wins.
 */
export const BULK_DISCOUNT_TIERS = [
  { minQty: 10, discount: 0.08 },
  { minQty: 5,  discount: 0.05 },
  { minQty: 3,  discount: 0.03 }
];

// ============================================================
// MERCHANT MEMORY
// ============================================================

/**
 * Controls how transaction history affects pricing.
 */
export const MERCHANT_MEMORY = {
  maxHistory: 20,
  loyaltyThreshold: 3,
  loyaltyDiscount: 0.03,
  frequentBuyerMarkup: 0.05,
  frequentBuyerThreshold: 5,
  frequentSellerDiscount: 0.05,
  frequentSellerThreshold: 5
};
