/**
 * Survival System Tests — hunger, thirst, spoilage, exposure, foraging, marker detection.
 */

import {
  checkFoodSpoilage,
  checkStarvation,
  checkDehydration,
  getSurvivalStatus,
  getForageDC
} from '../server/services/survivalService.js';

import {
  detectEat,
  detectDrink,
  detectForage
} from '../server/services/dmSessionService.js';

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
// Mock data
// ============================================================

function makeMockCharacter(overrides = {}) {
  return {
    id: 1,
    days_without_food: 0,
    days_without_water: 0,
    last_meal_game_day: 10,
    last_drink_game_day: 10,
    game_day: 10,
    level: 5,
    ability_scores: JSON.stringify({ str: 10, dex: 14, con: 14, int: 10, wis: 12, cha: 8 }),
    inventory: JSON.stringify([
      { name: 'Rations (1 day)', quantity: 5, category: 'food', nutrition_days: 1, perishable: false },
      { name: 'Waterskin', quantity: 2, category: 'water', hydration_days: 1 },
      { name: 'Fresh Bread', quantity: 2, category: 'food', nutrition_days: 1, perishable: true, spoils_in_days: 3, acquired_game_day: 8 }
    ]),
    shelter_type: 'none',
    current_location: 'forest',
    ...overrides
  };
}

// ============================================================
// 1. checkFoodSpoilage
// ============================================================
console.log('\n=== Test 1: checkFoodSpoilage ===\n');

// Non-perishable food doesn't spoil
let inventory = [
  { name: 'Rations (1 day)', quantity: 5, category: 'food', nutrition_days: 1, perishable: false }
];
let result = checkFoodSpoilage(inventory, 100, null);
assert(result.spoiled.length === 0, 'Non-perishable rations do not spoil');
assert(result.updated_inventory.length === 1, 'Inventory unchanged for non-perishable');

// Perishable food spoils after spoils_in_days
inventory = [
  { name: 'Fresh Bread', quantity: 2, category: 'food', nutrition_days: 1, perishable: true, spoils_in_days: 3, acquired_game_day: 5 }
];
result = checkFoodSpoilage(inventory, 9, null);
assert(result.spoiled.length === 1, 'Fresh Bread spoils after 4 days (5+3 < 9)');
assert(result.spoiled[0] === 'Fresh Bread', 'Spoiled item is Fresh Bread');

// Not yet spoiled
result = checkFoodSpoilage(inventory, 7, null);
assert(result.spoiled.length === 0, 'Fresh Bread not spoiled at day 7 (5+3=8 > 7)');

// Heat wave accelerates spoilage (param is weather type string, not object)
result = checkFoodSpoilage(inventory, 7, 'heat_wave');
assert(result.spoiled.length === 1, 'Heat wave halves spoils_in_days (3→1, spoiled at day 7 since 7-5=2 >= 1)');

// Normal weather doesn't accelerate
result = checkFoodSpoilage(inventory, 7, 'clear');
assert(result.spoiled.length === 0, 'Clear weather does not accelerate spoilage');

// Empty inventory
result = checkFoodSpoilage([], 10, null);
assert(result.spoiled.length === 0, 'Empty inventory has no spoilage');
assert(result.updated_inventory.length === 0, 'Empty inventory returns empty');

// ============================================================
// 2. checkStarvation
// ============================================================
console.log('\n=== Test 2: checkStarvation ===\n');

// Character with no hunger
let char = makeMockCharacter({ days_without_food: 0 });
result = checkStarvation(char);
assert(!result.starving, 'days_without_food=0 → not starving');
assert(!result.hungry || result.hungry === false, 'days_without_food=0 → not hungry');

// Character hungry but not starving (CON 14 → mod +2, threshold = 3+2=5)
char = makeMockCharacter({ days_without_food: 3 });
result = checkStarvation(char);
assert(!result.starving, 'days_without_food=3, threshold=5 → not yet starving');

// Character at threshold
char = makeMockCharacter({ days_without_food: 5 });
result = checkStarvation(char);
assert(!result.starving, 'days_without_food=5, threshold=5 → at limit but not beyond');

// Character beyond threshold → starving
char = makeMockCharacter({ days_without_food: 6 });
result = checkStarvation(char);
assert(result.starving === true, 'days_without_food=6 > threshold=5 → starving');

// Low CON character (CON 8 → mod -1, threshold = 3+(-1)=2, min 1)
char = makeMockCharacter({
  days_without_food: 3,
  ability_scores: JSON.stringify({ str: 10, dex: 10, con: 8, int: 10, wis: 10, cha: 10 })
});
result = checkStarvation(char);
assert(result.starving === true, 'CON 8 (threshold=2): days_without_food=3 → starving');

// ============================================================
// 3. checkDehydration
// ============================================================
console.log('\n=== Test 3: checkDehydration ===\n');

// Not dehydrated
char = makeMockCharacter({ days_without_water: 0 });
result = checkDehydration(char, null);
assert(!result.dehydrated, 'days_without_water=0 → not dehydrated');

// Dehydrated after 1 day
char = makeMockCharacter({ days_without_water: 1 });
result = checkDehydration(char, null);
assert(result.dehydrated === true, 'days_without_water=1 → dehydrated');

// Severely dehydrated
char = makeMockCharacter({ days_without_water: 3 });
result = checkDehydration(char, null);
assert(result.dehydrated === true, 'days_without_water=3 → dehydrated');

// ============================================================
// 4. getSurvivalStatus
// ============================================================
console.log('\n=== Test 4: getSurvivalStatus ===\n');

// Well-fed and hydrated
char = makeMockCharacter();
result = getSurvivalStatus(char, null);
assert(result.hunger_level === 'fed', 'days_without_food=0 → hunger_level=fed');
assert(result.thirst_level === 'hydrated', 'days_without_water=0 → thirst_level=hydrated');
assert(result.days_without_food === 0, 'days_without_food field present');
assert(result.days_without_water === 0, 'days_without_water field present');
assert(result.food_in_pack !== undefined, 'food_in_pack field present');
assert(result.water_in_pack !== undefined, 'water_in_pack field present');
assert(result.starvation_threshold > 0, 'starvation_threshold is positive');

// Hungry character
char = makeMockCharacter({ days_without_food: 2 });
result = getSurvivalStatus(char, null);
assert(result.hunger_level === 'hungry', 'days_without_food=2 → hungry');

// Critical character
char = makeMockCharacter({ days_without_food: 10 });
result = getSurvivalStatus(char, null);
assert(result.hunger_level === 'critical', 'days_without_food=10 → critical');

// Critical thirst
char = makeMockCharacter({ days_without_water: 3 });
result = getSurvivalStatus(char, null);
assert(result.thirst_level === 'critical', 'days_without_water=3 → critical');

// Food count from inventory
char = makeMockCharacter();
result = getSurvivalStatus(char, null);
assert(result.food_in_pack.total_days >= 5, 'Inventory has at least 5 days food (rations + bread)');
assert(result.water_in_pack.total_days >= 2, 'Inventory has at least 2 days water (waterskins)');

// Warnings when low
char = makeMockCharacter({ inventory: JSON.stringify([]) });
result = getSurvivalStatus(char, null);
assert(result.warnings.length > 0, 'Empty inventory generates warnings');

// ============================================================
// 5. getForageDC
// ============================================================
console.log('\n=== Test 5: getForageDC ===\n');

assert(getForageDC('dense forest') === 10, 'Forest → DC 10');
assert(getForageDC('a river crossing') === 10, 'River → DC 10');
assert(getForageDC('along the coast') === 10, 'Coast → DC 10');
assert(getForageDC('open plains') === 12, 'Plains → DC 12');
assert(getForageDC('swamp lands') === 12, 'Swamp → DC 12');
assert(getForageDC('rolling hills') === 15, 'Hills → DC 15');
assert(getForageDC('a mountain pass') === 15, 'Mountain → DC 15');
assert(getForageDC('arid desert') === 20, 'Desert → DC 20');
assert(getForageDC('arctic tundra') === 20, 'Arctic → DC 20');
assert(getForageDC('underground cavern') === 25, 'Underground → DC 25');
assert(getForageDC(null) === 15, 'null → DC 15 (default)');
assert(getForageDC('') === 15, 'empty string → DC 15 (default)');
assert(getForageDC('mysterious place') === 15, 'Unknown → DC 15 (default)');

// ============================================================
// 6. detectEat — marker detection
// ============================================================
console.log('\n=== Test 6: detectEat ===\n');

result = detectEat('The character sits down and eats. [EAT: Item="Rations (1 day)"] Delicious.');
assert(result.length === 1, 'Detects EAT marker (returns array)');
assert(result[0].item === 'Rations (1 day)', 'Parses item name correctly');

result = detectEat('[EAT: Item="Fresh Bread"]');
assert(result[0].item === 'Fresh Bread', 'Parses Fresh Bread');

result = detectEat('No eating happens here.');
assert(result.length === 0, 'Returns empty array when no marker');

result = detectEat(null);
assert(result.length === 0, 'Returns empty array for null input');

result = detectEat('');
assert(result.length === 0, 'Returns empty array for empty string');

// ============================================================
// 7. detectDrink — marker detection
// ============================================================
console.log('\n=== Test 7: detectDrink ===\n');

result = detectDrink('You drink deeply from your waterskin. [DRINK: Item="Waterskin"] Refreshing.');
assert(result.length === 1, 'Detects DRINK marker (returns array)');
assert(result[0].item === 'Waterskin', 'Parses item name correctly');

result = detectDrink('[DRINK: Item="Ale"]');
assert(result[0].item === 'Ale', 'Parses Ale');

result = detectDrink('No drinking here.');
assert(result.length === 0, 'Returns empty array when no marker');

result = detectDrink(null);
assert(result.length === 0, 'Returns empty array for null input');

result = detectDrink('');
assert(result.length === 0, 'Returns empty array for empty string');

// ============================================================
// 8. detectForage — marker detection
// ============================================================
console.log('\n=== Test 8: detectForage ===\n');

result = detectForage('You search the area. [FORAGE: Terrain="forest" Result="success" Food=2 Water=1]');
assert(result !== null, 'Detects FORAGE marker');
assert(result.terrain === 'forest', 'Parses terrain');
assert(result.result === 'success', 'Parses result');
assert(parseInt(result.food) === 2, 'Parses food count');
assert(parseInt(result.water) === 1, 'Parses water count');

result = detectForage('[FORAGE: Terrain="desert" Result="fail" Food=0 Water=0]');
assert(result.terrain === 'desert', 'Parses desert terrain');
assert(result.result === 'fail', 'Parses fail result');

result = detectForage('No foraging today.');
assert(result === null, 'Returns null when no marker');

result = detectForage(null);
assert(result === null, 'Returns null for null input');

result = detectForage('');
assert(result === null, 'Returns null for empty string');

// ============================================================
// Results
// ============================================================
console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
process.exit(failed > 0 ? 1 : 0);
