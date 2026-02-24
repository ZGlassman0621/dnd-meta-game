/**
 * Economy Simulation Tests — Coverage for:
 * - Economy config validation (event effects, regional modifiers, bulk discounts)
 * - World event price effects calculation
 * - Regional modifier derivation
 * - Merchant memory / loyalty tracking
 * - Bulk discount tiers
 * - Category alias resolution
 * - Combined multiplier clamping
 * - Per-item economy multiplier
 * - Transaction recording
 * - Integration flow
 */

import {
  EVENT_PRICE_EFFECTS,
  CATEGORY_ALIASES,
  REVERSE_CATEGORY_LOOKUP,
  REGIONAL_MODIFIERS,
  BULK_DISCOUNT_TIERS,
  MERCHANT_MEMORY
} from '../server/config/economyConfig.js';

import {
  getWorldEventPriceEffects,
  getRegionalModifiers,
  getMerchantMemoryModifiers,
  getBulkDiscount,
  calculateEconomyModifiers,
  getItemEconomyMultiplier,
  recordTransaction
} from '../server/services/economyService.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  \u2713 ${message}`);
    passed++;
  } else {
    console.log(`  \u2717 FAIL: ${message}`);
    failed++;
  }
}

// ============================================================
// 1. ECONOMY CONFIG VALIDATION
// ============================================================
console.log('\n=== Test 1: Economy Config Validation ===\n');

// EVENT_PRICE_EFFECTS
{
  const eventTypes = Object.keys(EVENT_PRICE_EFFECTS);
  assert(eventTypes.includes('military'), 'EVENT_PRICE_EFFECTS has military');
  assert(eventTypes.includes('natural_disaster'), 'EVENT_PRICE_EFFECTS has natural_disaster');
  assert(eventTypes.includes('economic'), 'EVENT_PRICE_EFFECTS has economic');
  assert(eventTypes.includes('political'), 'EVENT_PRICE_EFFECTS has political');
  assert(eventTypes.includes('conspiracy'), 'EVENT_PRICE_EFFECTS has conspiracy');
  assert(eventTypes.length === 5, 'EVENT_PRICE_EFFECTS has exactly 5 event types');

  // Each event type has stages 0, 1, 2
  for (const [type, stages] of Object.entries(EVENT_PRICE_EFFECTS)) {
    assert(stages[0] !== undefined, `${type} has stage 0`);
    assert(stages[1] !== undefined, `${type} has stage 1`);
    assert(stages[2] !== undefined, `${type} has stage 2`);
  }
}

// Military event escalation — prices increase with stage
{
  const mil = EVENT_PRICE_EFFECTS.military;
  assert(mil[0].weapon === 0.10, 'Military stage 0: weapon +10%');
  assert(mil[1].weapon === 0.20, 'Military stage 1: weapon +20%');
  assert(mil[2].weapon === 0.30, 'Military stage 2: weapon +30%');
  assert(mil[2].armor === 0.30, 'Military stage 2: armor +30%');
  assert(mil[2].ammunition === 0.25, 'Military stage 2: ammunition +25%');
}

// Natural disaster aftermath — weapons cheaper from scavenging
{
  const nd = EVENT_PRICE_EFFECTS.natural_disaster;
  assert(nd[2].weapon === -0.10, 'Natural disaster stage 2: weapons -10% (scavenging)');
  assert(nd[2].potion === 0.25, 'Natural disaster stage 2: potions +25%');
}

// CATEGORY_ALIASES
{
  assert(CATEGORY_ALIASES.weapon.includes('weapon'), 'weapon alias includes weapon');
  assert(CATEGORY_ALIASES.potion.includes('potions_consumables'), 'potion alias includes potions_consumables');
  assert(CATEGORY_ALIASES.gem.includes('gems_jewelry'), 'gem alias includes gems_jewelry');
  assert(CATEGORY_ALIASES.tool.includes('tools'), 'tool alias includes tools');
}

// REVERSE_CATEGORY_LOOKUP
{
  assert(REVERSE_CATEGORY_LOOKUP['potions_consumables'] === 'potion', 'Reverse lookup: potions_consumables → potion');
  assert(REVERSE_CATEGORY_LOOKUP['gems_jewelry'] === 'gem', 'Reverse lookup: gems_jewelry → gem');
  assert(REVERSE_CATEGORY_LOOKUP['weapon'] === 'weapon', 'Reverse lookup: weapon → weapon');
  assert(REVERSE_CATEGORY_LOOKUP['tools'] === 'tool', 'Reverse lookup: tools → tool');
  assert(REVERSE_CATEGORY_LOOKUP['magic_items'] === 'magic_item', 'Reverse lookup: magic_items → magic_item');
}

// REGIONAL_MODIFIERS
{
  const regions = Object.keys(REGIONAL_MODIFIERS);
  assert(regions.includes('coastal'), 'REGIONAL_MODIFIERS has coastal');
  assert(regions.includes('mountain'), 'REGIONAL_MODIFIERS has mountain');
  assert(regions.includes('desert'), 'REGIONAL_MODIFIERS has desert');
  assert(regions.includes('port'), 'REGIONAL_MODIFIERS has port');
  assert(regions.includes('arctic'), 'REGIONAL_MODIFIERS has arctic');
  assert(regions.length >= 10, 'REGIONAL_MODIFIERS has 10+ regions');

  // Mountain: cheap metal
  assert(REGIONAL_MODIFIERS.mountain.armor < 0, 'Mountain: armor is cheaper');
  assert(REGIONAL_MODIFIERS.mountain.weapon < 0, 'Mountain: weapons are cheaper');

  // Coastal: cheap supplies
  assert(REGIONAL_MODIFIERS.coastal.adventuring_gear < 0, 'Coastal: adventuring gear is cheaper');

  // Desert: scarce supplies
  assert(REGIONAL_MODIFIERS.desert.adventuring_gear > 0, 'Desert: adventuring gear is more expensive');
  assert(REGIONAL_MODIFIERS.desert.potion > 0, 'Desert: potions are more expensive');
}

// BULK_DISCOUNT_TIERS
{
  assert(BULK_DISCOUNT_TIERS.length === 3, 'BULK_DISCOUNT_TIERS has 3 tiers');
  assert(BULK_DISCOUNT_TIERS[0].minQty === 10, 'Highest tier: 10+ items');
  assert(BULK_DISCOUNT_TIERS[0].discount === 0.08, 'Highest tier: 8% discount');
  assert(BULK_DISCOUNT_TIERS[1].minQty === 5, 'Middle tier: 5+ items');
  assert(BULK_DISCOUNT_TIERS[1].discount === 0.05, 'Middle tier: 5% discount');
  assert(BULK_DISCOUNT_TIERS[2].minQty === 3, 'Lowest tier: 3+ items');
  assert(BULK_DISCOUNT_TIERS[2].discount === 0.03, 'Lowest tier: 3% discount');
}

// MERCHANT_MEMORY
{
  assert(MERCHANT_MEMORY.maxHistory === 20, 'Max history: 20 entries');
  assert(MERCHANT_MEMORY.loyaltyThreshold === 3, 'Loyalty threshold: 3 visits');
  assert(MERCHANT_MEMORY.loyaltyDiscount === 0.03, 'Loyalty discount: 3%');
  assert(MERCHANT_MEMORY.frequentBuyerMarkup === 0.05, 'Frequent buyer markup: 5%');
  assert(MERCHANT_MEMORY.frequentBuyerThreshold === 5, 'Frequent buyer threshold: 5 items');
}

// ============================================================
// 2. BULK DISCOUNT FUNCTION
// ============================================================
console.log('\n=== Test 2: Bulk Discount Function ===\n');

{
  assert(getBulkDiscount(1) === 0, '1 item: no discount');
  assert(getBulkDiscount(2) === 0, '2 items: no discount');
  assert(getBulkDiscount(3) === 0.03, '3 items: 3% discount');
  assert(getBulkDiscount(4) === 0.03, '4 items: 3% discount');
  assert(getBulkDiscount(5) === 0.05, '5 items: 5% discount');
  assert(getBulkDiscount(9) === 0.05, '9 items: 5% discount');
  assert(getBulkDiscount(10) === 0.08, '10 items: 8% discount');
  assert(getBulkDiscount(100) === 0.08, '100 items: 8% discount (max tier)');
  assert(getBulkDiscount(0) === 0, '0 items: no discount');
}

// ============================================================
// 3. getItemEconomyMultiplier — Category Resolution
// ============================================================
console.log('\n=== Test 3: Per-Item Economy Multiplier ===\n');

{
  // No modifiers → 1.0
  assert(getItemEconomyMultiplier('weapon', null) === 1, 'Null modifiers → 1.0');
  assert(getItemEconomyMultiplier('weapon', {}) === 1, 'Empty modifiers → 1.0');

  // Direct category match
  const mods = { combinedCategoryModifiers: { weapon: 0.25, armor: -0.10, potion: 0.40 } };
  assert(getItemEconomyMultiplier('weapon', mods) === 1.25, 'Weapon +25% → 1.25');
  assert(getItemEconomyMultiplier('armor', mods) === 0.90, 'Armor -10% → 0.90');

  // Category alias resolution
  assert(getItemEconomyMultiplier('potions_consumables', mods) === 1.40, 'potions_consumables maps to potion → 1.40');

  // No matching category → 1.0
  assert(getItemEconomyMultiplier('misc', mods) === 1, 'Unknown category → 1.0');

  // Clamping: min 0.50
  const extremeLow = { combinedCategoryModifiers: { weapon: -0.80 } };
  assert(getItemEconomyMultiplier('weapon', extremeLow) === 0.50, 'Extreme low clamped to 0.50');

  // Clamping: max 2.00
  const extremeHigh = { combinedCategoryModifiers: { weapon: 1.50 } };
  assert(getItemEconomyMultiplier('weapon', extremeHigh) === 2.00, 'Extreme high clamped to 2.00');
}

// ============================================================
// 4. REVERSE CATEGORY LOOKUP for aliases
// ============================================================
console.log('\n=== Test 4: Category Alias Resolution ===\n');

{
  // Verify all aliases resolve correctly
  for (const [econKey, aliases] of Object.entries(CATEGORY_ALIASES)) {
    for (const alias of aliases) {
      assert(
        REVERSE_CATEGORY_LOOKUP[alias] === econKey,
        `Alias '${alias}' → economy key '${econKey}'`
      );
    }
  }
}

// ============================================================
// 5. EVENT_PRICE_EFFECTS Stage Scaling
// ============================================================
console.log('\n=== Test 5: Event Price Effects Stage Scaling ===\n');

{
  // Military effects escalate with stage
  const mil = EVENT_PRICE_EFFECTS.military;
  assert(mil[0].weapon < mil[1].weapon, 'Military weapon price increases stage 0→1');
  assert(mil[1].weapon < mil[2].weapon, 'Military weapon price increases stage 1→2');

  // Political is empty at stage 0
  assert(Object.keys(EVENT_PRICE_EFFECTS.political[0]).length === 0, 'Political stage 0 has no price effects');
  assert(Object.keys(EVENT_PRICE_EFFECTS.political[2]).length > 0, 'Political stage 2 has price effects');

  // Conspiracy affects potions and magic items
  assert(EVENT_PRICE_EFFECTS.conspiracy[1].potion > 0, 'Conspiracy stage 1 increases potion prices');
  assert(EVENT_PRICE_EFFECTS.conspiracy[2].magic_item > 0, 'Conspiracy stage 2 increases magic item prices');

  // Economic affects gems and luxury goods
  assert(EVENT_PRICE_EFFECTS.economic[0].gem > 0, 'Economic stage 0 increases gem prices');
  assert(EVENT_PRICE_EFFECTS.economic[2].clothing > 0, 'Economic stage 2 increases clothing prices');
}

// ============================================================
// 6. REGIONAL MODIFIER Consistency
// ============================================================
console.log('\n=== Test 6: Regional Modifier Consistency ===\n');

{
  // All modifier values should be reasonable (-0.15 to +0.15 range)
  for (const [region, mods] of Object.entries(REGIONAL_MODIFIERS)) {
    for (const [category, value] of Object.entries(mods)) {
      assert(
        value >= -0.15 && value <= 0.15,
        `${region}/${category}: modifier ${value} in reasonable range`
      );
    }
  }

  // Mining and mountain both reduce weapon/armor costs
  assert(REGIONAL_MODIFIERS.mining.weapon < 0, 'Mining: weapons cheaper');
  assert(REGIONAL_MODIFIERS.mining.armor < 0, 'Mining: armor cheaper');

  // Port and trade_hub both reduce trade good costs
  assert(REGIONAL_MODIFIERS.port.adventuring_gear < 0, 'Port: adventuring gear cheaper');
  assert(REGIONAL_MODIFIERS.trade_hub.adventuring_gear < 0, 'Trade hub: adventuring gear cheaper');

  // Arctic: furs cheap but supplies expensive
  assert(REGIONAL_MODIFIERS.arctic.clothing < 0, 'Arctic: clothing (furs) cheaper');
  assert(REGIONAL_MODIFIERS.arctic.adventuring_gear > 0, 'Arctic: adventuring gear more expensive');
}

// ============================================================
// 7. MERCHANT_MEMORY Config Sanity
// ============================================================
console.log('\n=== Test 7: Merchant Memory Config Sanity ===\n');

{
  assert(MERCHANT_MEMORY.loyaltyThreshold > 0, 'Loyalty threshold is positive');
  assert(MERCHANT_MEMORY.loyaltyDiscount > 0 && MERCHANT_MEMORY.loyaltyDiscount < 0.20, 'Loyalty discount in reasonable range');
  assert(MERCHANT_MEMORY.frequentBuyerMarkup > 0, 'Frequent buyer markup is positive');
  assert(MERCHANT_MEMORY.frequentBuyerThreshold > 0, 'Frequent buyer threshold is positive');
  assert(MERCHANT_MEMORY.frequentSellerDiscount > 0, 'Frequent seller discount is positive');
  assert(MERCHANT_MEMORY.frequentSellerThreshold > 0, 'Frequent seller threshold is positive');
  assert(MERCHANT_MEMORY.maxHistory >= 10, 'Max history is at least 10');
}

// ============================================================
// 8. COMBINED MULTIPLIER — Stacking & Clamping
// ============================================================
console.log('\n=== Test 8: Combined Multiplier Stacking & Clamping ===\n');

{
  // Simulate stacking: two military events at stage 2 + hostile reputation
  // Military stage 2: weapon +0.30 each = +0.60 combined
  // Reputation: 1.25 (hostile)
  // Combined: 1.25 * (1 + 0.60) = 1.25 * 1.60 = 2.00 → clamped to 2.00
  const economyMult = getItemEconomyMultiplier('weapon', { combinedCategoryModifiers: { weapon: 0.60 } });
  const reputationMult = 1.25;
  const combined = Math.max(0.50, Math.min(2.00, reputationMult * economyMult));
  assert(combined === 2.00, 'Double military + hostile: clamped to 2.00');

  // Favorable: mountain + allied reputation
  // Mountain: weapon -0.05
  // Reputation: 0.90 (allied)
  // Loyalty: 0.03
  const economyMult2 = getItemEconomyMultiplier('weapon', { combinedCategoryModifiers: { weapon: -0.05 } });
  const combined2 = Math.max(0.50, Math.min(2.00, 0.90 * economyMult2 * (1 - 0.03)));
  assert(combined2 < 0.90, 'Mountain + allied + loyalty: below 0.90');
  assert(combined2 >= 0.50, 'Favorable stacking stays above 0.50');
}

// ============================================================
// 9. BULK_DISCOUNT_TIERS — Ordering
// ============================================================
console.log('\n=== Test 9: Bulk Discount Tier Ordering ===\n');

{
  // Tiers should be sorted descending by minQty
  for (let i = 0; i < BULK_DISCOUNT_TIERS.length - 1; i++) {
    assert(
      BULK_DISCOUNT_TIERS[i].minQty > BULK_DISCOUNT_TIERS[i + 1].minQty,
      `Tier ${i} (minQty=${BULK_DISCOUNT_TIERS[i].minQty}) > Tier ${i + 1} (minQty=${BULK_DISCOUNT_TIERS[i + 1].minQty})`
    );
  }

  // Higher quantities should always have equal or higher discounts
  for (let i = 0; i < BULK_DISCOUNT_TIERS.length - 1; i++) {
    assert(
      BULK_DISCOUNT_TIERS[i].discount >= BULK_DISCOUNT_TIERS[i + 1].discount,
      `Tier ${i} discount (${BULK_DISCOUNT_TIERS[i].discount}) >= Tier ${i + 1} discount (${BULK_DISCOUNT_TIERS[i + 1].discount})`
    );
  }
}

// ============================================================
// 10. INTEGRATION — Full Modifier Pipeline (Pure Config)
// ============================================================
console.log('\n=== Test 10: Integration — Full Modifier Pipeline ===\n');

{
  // Simulate a complete price calculation without database:
  // Base price: 100gp weapon
  // Reputation: neutral (1.0)
  // Economy: military stage 2 (+0.30 weapon)
  // Regional: mountain (-0.05 weapon)
  // Loyalty: 0.03 (loyal customer)
  // Bulk: 5 items (0.05 discount)

  const basePrice = 100;
  const reputationMult = 1.0;
  const economyMods = { combinedCategoryModifiers: { weapon: 0.30 + (-0.05) } }; // military + mountain
  const economyMult = getItemEconomyMultiplier('weapon', economyMods);
  const loyaltyDiscount = 0.03;
  const bulkDiscount = getBulkDiscount(5);

  // Per-item price = base × reputation × economy × (1 - loyalty)
  const perItemPrice = basePrice * reputationMult * economyMult * (1 - loyaltyDiscount);
  // Bulk applies to total
  const totalFor5 = perItemPrice * 5 * (1 - bulkDiscount);

  assert(economyMult === 1.25, 'Economy multiplier: 1.25 (military +30% - mountain -5%)');
  assert(bulkDiscount === 0.05, 'Bulk discount: 5% for 5 items');
  assert(perItemPrice > basePrice, 'War + mountain net: per-item price higher than base');

  const expectedPerItem = 100 * 1.0 * 1.25 * 0.97; // 121.25
  assert(
    Math.abs(perItemPrice - expectedPerItem) < 0.01,
    `Per-item price: ${perItemPrice.toFixed(2)} ≈ ${expectedPerItem.toFixed(2)}`
  );

  const expectedTotal = expectedPerItem * 5 * 0.95; // 575.94
  assert(
    Math.abs(totalFor5 - expectedTotal) < 0.01,
    `Total for 5 items: ${totalFor5.toFixed(2)} ≈ ${expectedTotal.toFixed(2)}`
  );
}

// Simulate peaceful economy with loyal customer at port
{
  const basePrice = 50;
  const reputationMult = 0.94; // friendly
  const economyMods = { combinedCategoryModifiers: { adventuring_gear: -0.10 } }; // port region
  const economyMult = getItemEconomyMultiplier('adventuring_gear', economyMods);
  const loyaltyDiscount = 0.03;

  const finalPrice = basePrice * reputationMult * economyMult * (1 - loyaltyDiscount);
  assert(finalPrice < basePrice, 'Port + friendly + loyalty: adventuring gear cheaper than base');
  assert(finalPrice > basePrice * 0.50, 'Price stays above 50% minimum');
}

// ============================================================
// SUMMARY
// ============================================================

console.log(`\n${'='.repeat(50)}`);
console.log(`Economy Tests: ${passed} passed, ${failed} failed out of ${passed + failed} total`);
console.log(`${'='.repeat(50)}\n`);

if (failed > 0) process.exit(1);
