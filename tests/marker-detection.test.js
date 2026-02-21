/**
 * Marker Detection Tests — Comprehensive coverage for all AI marker parsing functions.
 * Tests the shared parseMarkerPairs utility and all 8 detection functions.
 */

import {
  parseMarkerPairs,
  parseNpcJoinMarker,
  detectMerchantShop,
  detectMerchantRefer,
  detectAddItem,
  detectLootDrop,
  detectCombatStart,
  detectCombatEnd
} from '../server/services/dmSessionService.js';

import { detectConditionChanges } from '../server/data/conditions.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passed++;
  } else {
    console.log(`  ✗ FAIL: ${message}`);
    failed++;
  }
}

// ============================================================
// 1. parseMarkerPairs — shared utility
// ============================================================
console.log('\n=== Test 1: parseMarkerPairs — Core Parsing ===\n');

// Standard double-quoted values
let result = parseMarkerPairs('Merchant="Garrick" Type="blacksmith" Location="Main Street"');
assert(result.merchant === 'Garrick', 'Double-quoted: Merchant=Garrick');
assert(result.type === 'blacksmith', 'Double-quoted: Type=blacksmith');
assert(result.location === 'Main Street', 'Double-quoted: Location=Main Street');

// Single-quoted values
result = parseMarkerPairs("Name='Healing Potion' Price_GP='50'");
assert(result.name === 'Healing Potion', 'Single-quoted: Name=Healing Potion');
assert(result.price_gp === '50', 'Single-quoted: Price_GP=50');

// Unquoted bare words
result = parseMarkerPairs('Name=Sword Price_GP=25');
assert(result.name === 'Sword', 'Unquoted: Name=Sword');
assert(result.price_gp === '25', 'Unquoted: Price_GP=25');

// Spaces around =
result = parseMarkerPairs('Merchant = "Garrick" Type = "general"');
assert(result.merchant === 'Garrick', 'Spaces around =: Merchant=Garrick');
assert(result.type === 'general', 'Spaces around =: Type=general');

// Empty quoted values
result = parseMarkerPairs('Name="" Description=""');
assert(result.name === '', 'Empty double-quoted: Name=""');
assert(result.description === '', 'Empty double-quoted: Description=""');

// Mixed formats
result = parseMarkerPairs('Name="Flame Tongue" Price_GP=5000 Quality=\'masterwork\'');
assert(result.name === 'Flame Tongue', 'Mixed: double-quoted name');
assert(result.price_gp === '5000', 'Mixed: unquoted number');
assert(result.quality === 'masterwork', 'Mixed: single-quoted quality');

// Keys are lowercased
result = parseMarkerPairs('MERCHANT="Test" Type="weapon"');
assert(result.merchant === 'Test', 'Key case: MERCHANT lowercased');
assert(result.type === 'weapon', 'Key case: Type lowercased');

// Empty string input
result = parseMarkerPairs('');
assert(Object.keys(result).length === 0, 'Empty string returns empty object');

// ============================================================
// 2. detectMerchantShop
// ============================================================
console.log('\n=== Test 2: detectMerchantShop ===\n');

let shop = detectMerchantShop('The blacksmith greets you. [MERCHANT_SHOP: Merchant="Garrick" Type="blacksmith" Location="Ironworks"]');
assert(shop !== null, 'Detects standard marker');
assert(shop.merchantName === 'Garrick', 'Parses merchant name');
assert(shop.merchantType === 'blacksmith', 'Parses merchant type');
assert(shop.location === 'Ironworks', 'Parses location');

// Spaces around =
shop = detectMerchantShop('[MERCHANT_SHOP: Merchant = "Garrick" Type = "blacksmith"]');
assert(shop !== null, 'Detects with spaces around =');
assert(shop.merchantName === 'Garrick', 'Parses merchant with spaces');

// Single quotes
shop = detectMerchantShop("[MERCHANT_SHOP: Merchant='Elara' Type='alchemist']");
assert(shop !== null, 'Detects with single quotes');
assert(shop.merchantName === 'Elara', 'Parses single-quoted merchant');

// Missing required field
shop = detectMerchantShop('[MERCHANT_SHOP: Type="blacksmith"]');
assert(shop === null, 'Returns null when Merchant missing');

// Null/empty input
assert(detectMerchantShop(null) === null, 'Null input returns null');
assert(detectMerchantShop('') === null, 'Empty input returns null');
assert(detectMerchantShop('No markers here') === null, 'No marker returns null');

// Case insensitive
shop = detectMerchantShop('[merchant_shop: Merchant="Test"]');
assert(shop !== null, 'Case-insensitive marker detection');

// Default type
shop = detectMerchantShop('[MERCHANT_SHOP: Merchant="Garrick"]');
assert(shop.merchantType === 'general', 'Default type is general');
assert(shop.location === 'Unknown shop', 'Default location is Unknown shop');

// ============================================================
// 3. detectMerchantRefer
// ============================================================
console.log('\n=== Test 3: detectMerchantRefer ===\n');

let refer = detectMerchantRefer('[MERCHANT_REFER: From="Garrick" To="Elara" Item="Healing Potion"]');
assert(refer !== null, 'Detects standard referral');
assert(refer.fromMerchant === 'Garrick', 'Parses from');
assert(refer.toMerchant === 'Elara', 'Parses to');
assert(refer.item === 'Healing Potion', 'Parses item');

// Missing required fields
refer = detectMerchantRefer('[MERCHANT_REFER: From="Garrick"]');
assert(refer === null, 'Returns null when To and Item missing');

refer = detectMerchantRefer('[MERCHANT_REFER: To="Elara"]');
assert(refer === null, 'Returns null when Item missing');

// From is optional
refer = detectMerchantRefer('[MERCHANT_REFER: To="Elara" Item="Sword"]');
assert(refer !== null, 'From field is optional');
assert(refer.fromMerchant === null, 'From defaults to null');

// Spaces around =
refer = detectMerchantRefer('[MERCHANT_REFER: From = "A" To = "B" Item = "C"]');
assert(refer !== null, 'Handles spaces around =');
assert(refer.toMerchant === 'B', 'Parses with spaces');

// ============================================================
// 4. detectAddItem
// ============================================================
console.log('\n=== Test 4: detectAddItem ===\n');

let items = detectAddItem('[ADD_ITEM: Name="Holy Symbol" Price_GP=25 Quality="fine" Category="adventuring_gear"]');
assert(items.length === 1, 'Detects single item');
assert(items[0].name === 'Holy Symbol', 'Parses item name');
assert(items[0].price_gp === 25, 'Parses price as number');
assert(items[0].quality === 'fine', 'Parses quality');
assert(items[0].category === 'adventuring_gear', 'Parses category');

// Multiple items
items = detectAddItem('Found items: [ADD_ITEM: Name="Sword" Price_GP=50] and [ADD_ITEM: Name="Shield" Price_GP=10]');
assert(items.length === 2, 'Detects multiple items');
assert(items[0].name === 'Sword', 'First item name correct');
assert(items[1].name === 'Shield', 'Second item name correct');

// Defaults
items = detectAddItem('[ADD_ITEM: Name="Mystery Object"]');
assert(items[0].price_gp === 0, 'Default price is 0');
assert(items[0].quality === 'standard', 'Default quality is standard');
assert(items[0].category === 'adventuring_gear', 'Default category is adventuring_gear');
assert(items[0].description === '', 'Default description is empty');

// Missing name
items = detectAddItem('[ADD_ITEM: Price_GP=50 Quality="fine"]');
assert(items.length === 0, 'Returns empty when Name missing');

// Unquoted numeric price
items = detectAddItem('[ADD_ITEM: Name="Dagger" Price_GP=15]');
assert(items[0].price_gp === 15, 'Unquoted numeric Price_GP parsed');

// Null/empty
assert(detectAddItem(null).length === 0, 'Null input returns empty array');
assert(detectAddItem('').length === 0, 'Empty input returns empty array');

// ============================================================
// 5. detectLootDrop
// ============================================================
console.log('\n=== Test 5: detectLootDrop ===\n');

let drops = detectLootDrop('[LOOT_DROP: Item="Gold Necklace" Source="Goblin Chief"]');
assert(drops.length === 1, 'Detects single drop');
assert(drops[0].item === 'Gold Necklace', 'Parses item name');
assert(drops[0].source === 'Goblin Chief', 'Parses source');

// Default source
drops = detectLootDrop('[LOOT_DROP: Item="Old Key"]');
assert(drops[0].source === 'found', 'Default source is "found"');

// Multiple drops
drops = detectLootDrop('[LOOT_DROP: Item="Sword"] [LOOT_DROP: Item="Shield" Source="Chest"]');
assert(drops.length === 2, 'Detects multiple drops');
assert(drops[1].source === 'Chest', 'Second drop source parsed');

// Missing item
drops = detectLootDrop('[LOOT_DROP: Source="Monster"]');
assert(drops.length === 0, 'Returns empty when Item missing');

// Null/empty
assert(detectLootDrop(null).length === 0, 'Null returns empty');
assert(detectLootDrop('').length === 0, 'Empty returns empty');

// ============================================================
// 6. detectCombatStart
// ============================================================
console.log('\n=== Test 6: detectCombatStart ===\n');

let combat = detectCombatStart('[COMBAT_START: Enemies="Goblin, Wolf, Bandit"]');
assert(combat.detected === true, 'Detects combat marker');
assert(combat.enemies.length === 3, 'Parses 3 enemies');
assert(combat.enemies[0] === 'Goblin', 'First enemy correct');
assert(combat.enemies[2] === 'Bandit', 'Last enemy correct');

// Single enemy
combat = detectCombatStart('[COMBAT_START: Enemies="Dragon"]');
assert(combat.enemies.length === 1, 'Single enemy parsed');
assert(combat.enemies[0] === 'Dragon', 'Single enemy name correct');

// Empty enemies
combat = detectCombatStart('[COMBAT_START: Enemies=""]');
assert(combat.detected === true, 'Detected even with empty enemies');
assert(combat.enemies.length === 0, 'Empty enemies list');

// No marker
combat = detectCombatStart('The battle begins!');
assert(combat.detected === false, 'No marker returns detected=false');

// Case insensitive
combat = detectCombatStart('[combat_start: enemies="Orc"]');
assert(combat.detected === true, 'Case-insensitive detection');

// Spaces around =
combat = detectCombatStart('[COMBAT_START: Enemies = "Wolf, Bear"]');
assert(combat.detected === true, 'Spaces around = work');
assert(combat.enemies.length === 2, 'Enemies parsed with spaces');

// Trailing comma in enemies list
combat = detectCombatStart('[COMBAT_START: Enemies="Wolf, Bear,"]');
assert(combat.enemies.length === 2, 'Trailing comma filtered');

// Null
assert(detectCombatStart(null).detected === false, 'Null returns false');

// ============================================================
// 7. detectCombatEnd
// ============================================================
console.log('\n=== Test 7: detectCombatEnd ===\n');

assert(detectCombatEnd('[COMBAT_END]') === true, 'Detects combat end');
assert(detectCombatEnd('The battle ends. [COMBAT_END] The party rests.') === true, 'Detects in context');
assert(detectCombatEnd('[combat_end]') === true, 'Case insensitive');
assert(detectCombatEnd('No combat') === false, 'No marker returns false');
assert(detectCombatEnd(null) === false, 'Null returns false');
assert(detectCombatEnd('') === false, 'Empty returns false');

// ============================================================
// 8. parseNpcJoinMarker
// ============================================================
console.log('\n=== Test 8: parseNpcJoinMarker ===\n');

let join = parseNpcJoinMarker('[NPC_WANTS_TO_JOIN: Name="Elara" Race="Elf" Gender="Female" Occupation="Ranger" Reason="Shared enemy"]');
assert(join !== null, 'Detects join marker');
assert(join.npcName === 'Elara', 'Parses NPC name');
assert(join.npcData.race === 'Elf', 'Parses race');
assert(join.npcData.gender === 'Female', 'Parses gender');
assert(join.npcData.occupation === 'Ranger', 'Parses occupation');
assert(join.npcData.reason === 'Shared enemy', 'Parses reason');
assert(join.trigger === 'structured_marker', 'Trigger is structured_marker');

// Defaults
join = parseNpcJoinMarker('[NPC_WANTS_TO_JOIN: Name="Test"]');
assert(join.npcData.race === 'Human', 'Default race is Human');
assert(join.npcData.gender === null, 'Default gender is null');

// Missing name
join = parseNpcJoinMarker('[NPC_WANTS_TO_JOIN: Race="Dwarf"]');
assert(join === null, 'Returns null when Name missing');

// Spaces around =
join = parseNpcJoinMarker('[NPC_WANTS_TO_JOIN: Name = "Garrick" Race = "Human"]');
assert(join !== null, 'Handles spaces around =');
assert(join.npcName === 'Garrick', 'Name parsed with spaces');

// No marker
assert(parseNpcJoinMarker('No marker here') === null, 'No marker returns null');

// ============================================================
// 9. detectConditionChanges — flexible field order
// ============================================================
console.log('\n=== Test 9: detectConditionChanges — Flexible Parsing ===\n');

// Standard order
let cond = detectConditionChanges('[CONDITION_ADD: Target="Player" Condition="Poisoned"]');
assert(cond.applied.length === 1, 'Detects condition add');
assert(cond.applied[0].target === 'Player', 'Target parsed');
assert(cond.applied[0].condition === 'poisoned', 'Condition lowercased');

// Reversed field order
cond = detectConditionChanges('[CONDITION_ADD: Condition="Frightened" Target="Elara"]');
assert(cond.applied.length === 1, 'Reversed order: detected');
assert(cond.applied[0].target === 'Elara', 'Reversed order: target correct');
assert(cond.applied[0].condition === 'frightened', 'Reversed order: condition correct');

// Spaces around =
cond = detectConditionChanges('[CONDITION_ADD: Target = "Player" Condition = "Stunned"]');
assert(cond.applied.length === 1, 'Spaces around =: detected');
assert(cond.applied[0].condition === 'stunned', 'Spaces around =: condition correct');

// Single quotes
cond = detectConditionChanges("[CONDITION_ADD: Target='Player' Condition='Blinded']");
assert(cond.applied.length === 1, 'Single quotes: detected');
assert(cond.applied[0].condition === 'blinded', 'Single quotes: condition correct');

// Remove
cond = detectConditionChanges('[CONDITION_REMOVE: Target="Player" Condition="Poisoned"]');
assert(cond.removed.length === 1, 'Detects condition remove');
assert(cond.removed[0].condition === 'poisoned', 'Remove: condition correct');

// Multiple conditions
cond = detectConditionChanges(
  '[CONDITION_ADD: Target="Player" Condition="Prone"] ' +
  '[CONDITION_ADD: Target="Elara" Condition="Charmed"] ' +
  '[CONDITION_REMOVE: Target="Player" Condition="Poisoned"]'
);
assert(cond.applied.length === 2, 'Multiple adds detected');
assert(cond.removed.length === 1, 'Mixed add/remove detected');

// Exhaustion space → underscore
cond = detectConditionChanges('[CONDITION_ADD: Target="Player" Condition="Exhaustion 1"]');
assert(cond.applied[0].condition === 'exhaustion_1', 'Exhaustion space converted to underscore');

// Missing fields
cond = detectConditionChanges('[CONDITION_ADD: Target="Player"]');
assert(cond.applied.length === 0, 'Missing Condition: not added');

cond = detectConditionChanges('[CONDITION_ADD: Condition="Poisoned"]');
assert(cond.applied.length === 0, 'Missing Target: not added');

// Null/empty
cond = detectConditionChanges(null);
assert(cond.applied.length === 0 && cond.removed.length === 0, 'Null returns empty arrays');

cond = detectConditionChanges('');
assert(cond.applied.length === 0 && cond.removed.length === 0, 'Empty returns empty arrays');

// ============================================================
// 10. Detection/Stripping consistency
// ============================================================
console.log('\n=== Test 10: Detection/Stripping Consistency ===\n');

// All detectable markers should also be strippable
const stripRegexes = [
  /\[MERCHANT_SHOP:[^\]]+\]\s*/gi,
  /\[MERCHANT_REFER:[^\]]+\]\s*/gi,
  /\[ADD_ITEM:[^\]]+\]\s*/gi,
  /\[LOOT_DROP:[^\]]+\]\s*/gi,
  /\[COMBAT_START:[^\]]+\]\s*/gi,
  /\[COMBAT_END\]\s*/gi,
  /\[CONDITION_ADD:[^\]]+\]\s*/gi,
  /\[CONDITION_REMOVE:[^\]]+\]\s*/gi,
  /\[NPC_WANTS_TO_JOIN:[^\]]+\]\s*/gi
];

const testMarkers = [
  '[MERCHANT_SHOP: Merchant="Test" Type="general"]',
  '[MERCHANT_REFER: From="A" To="B" Item="C"]',
  '[ADD_ITEM: Name="Sword" Price_GP=50]',
  '[LOOT_DROP: Item="Gold" Source="Chest"]',
  '[COMBAT_START: Enemies="Goblin, Wolf"]',
  '[COMBAT_END]',
  '[CONDITION_ADD: Target="Player" Condition="Poisoned"]',
  '[CONDITION_REMOVE: Target="Player" Condition="Poisoned"]',
  '[NPC_WANTS_TO_JOIN: Name="Elara" Race="Elf"]'
];

for (const marker of testMarkers) {
  let stripped = marker;
  for (const regex of stripRegexes) {
    stripped = stripped.replace(regex, '');
  }
  assert(stripped.trim() === '', `Marker stripped cleanly: ${marker.substring(0, 30)}...`);
}

// ============================================================
// Results
// ============================================================
console.log(`\n${'='.repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log('='.repeat(50));
process.exit(failed > 0 ? 1 : 0);
