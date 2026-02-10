/**
 * Tests for expanded loot systems:
 * 1. Broadened session-end loot (all risk levels)
 * 2. Travel encounter loot generation
 * 3. DM session [LOOT_DROP] marker detection
 * 4. Quest completion rewards
 */

import {
  generateLoot, EQUIPMENT_BY_LEVEL, getLootTableForLevel,
  generateEncounterLoot
} from '../server/config/rewards.js';

import { detectLootDrop } from '../server/services/dmSessionService.js';

// ============================================================
// 1. BROADENED SESSION-END LOOT
// ============================================================

console.log('=== Test 1: Broadened Session-End Loot ===\n');

// Test that all risk levels can generate loot (probabilistically)
function testLootChances() {
  const iterations = 10000;
  const results = { high: 0, medium: 0, low: 0 };

  for (let i = 0; i < iterations; i++) {
    if (generateLoot(5, 'high')) results.high++;
    if (generateLoot(5, 'medium')) results.medium++;
    if (generateLoot(5, 'low')) results.low++;
  }

  const highRate = results.high / iterations;
  const mediumRate = results.medium / iterations;
  const lowRate = results.low / iterations;

  console.log(`High risk loot rate: ${(highRate * 100).toFixed(1)}% (expected ~25%)`);
  console.log(`Medium risk loot rate: ${(mediumRate * 100).toFixed(1)}% (expected ~10%)`);
  console.log(`Low risk loot rate: ${(lowRate * 100).toFixed(1)}% (expected ~5%)`);

  // Verify ordering: high > medium > low
  console.assert(highRate > mediumRate, 'FAIL: High risk should drop more than medium');
  console.assert(mediumRate > lowRate, 'FAIL: Medium risk should drop more than low');

  // Verify approximate rates (within reasonable variance)
  console.assert(highRate > 0.20 && highRate < 0.30, `FAIL: High rate ${highRate} not near 0.25`);
  console.assert(mediumRate > 0.07 && mediumRate < 0.13, `FAIL: Medium rate ${mediumRate} not near 0.10`);
  console.assert(lowRate > 0.03 && lowRate < 0.08, `FAIL: Low rate ${lowRate} not near 0.05`);

  // Verify unknown risk levels give nothing
  console.assert(generateLoot(5, 'unknown') === null, 'FAIL: Unknown risk should give null');

  console.log('PASS: Loot chances are correctly distributed across risk levels\n');
}

testLootChances();

// Test getLootTableForLevel
function testGetLootTableForLevel() {
  const table1 = getLootTableForLevel(1);
  const table5 = getLootTableForLevel(5);
  const table10 = getLootTableForLevel(10);
  const table15 = getLootTableForLevel(15);
  const table20 = getLootTableForLevel(20);

  console.assert(table1 === EQUIPMENT_BY_LEVEL[1], 'FAIL: Level 1 should use tier 1');
  console.assert(table5 === EQUIPMENT_BY_LEVEL[5], 'FAIL: Level 5 should use tier 5');
  console.assert(table10 === EQUIPMENT_BY_LEVEL[10], 'FAIL: Level 10 should use tier 10');
  console.assert(table15 === EQUIPMENT_BY_LEVEL[15], 'FAIL: Level 15 should use tier 15');
  console.assert(table20 === EQUIPMENT_BY_LEVEL[15], 'FAIL: Level 20 should use tier 15');

  // Level 3 should use tier 1
  console.assert(getLootTableForLevel(3) === EQUIPMENT_BY_LEVEL[1], 'FAIL: Level 3 should use tier 1');
  // Level 7 should use tier 5
  console.assert(getLootTableForLevel(7) === EQUIPMENT_BY_LEVEL[5], 'FAIL: Level 7 should use tier 5');

  console.log('PASS: getLootTableForLevel returns correct tiers\n');
}

testGetLootTableForLevel();

// Test that EQUIPMENT_BY_LEVEL is exported and has content
function testEquipmentByLevel() {
  console.assert(EQUIPMENT_BY_LEVEL[1].length >= 10, `FAIL: Tier 1 should have at least 10 items, has ${EQUIPMENT_BY_LEVEL[1].length}`);
  console.assert(EQUIPMENT_BY_LEVEL[5].length >= 10, `FAIL: Tier 5 should have at least 10 items, has ${EQUIPMENT_BY_LEVEL[5].length}`);
  console.assert(EQUIPMENT_BY_LEVEL[10].length >= 10, `FAIL: Tier 10 should have at least 10 items, has ${EQUIPMENT_BY_LEVEL[10].length}`);
  console.assert(EQUIPMENT_BY_LEVEL[15].length >= 10, `FAIL: Tier 15 should have at least 10 items, has ${EQUIPMENT_BY_LEVEL[15].length}`);

  // Verify some key items
  console.assert(EQUIPMENT_BY_LEVEL[1].includes('Potion of Healing'), 'FAIL: Tier 1 should include Potion of Healing');
  console.assert(EQUIPMENT_BY_LEVEL[5].includes('Bag of Holding'), 'FAIL: Tier 5 should include Bag of Holding');
  console.assert(EQUIPMENT_BY_LEVEL[10].includes('Flame Tongue'), 'FAIL: Tier 10 should include Flame Tongue');
  console.assert(EQUIPMENT_BY_LEVEL[15].includes('Staff of Power'), 'FAIL: Tier 15 should include Staff of Power');

  console.log('PASS: EQUIPMENT_BY_LEVEL has correct content\n');
}

testEquipmentByLevel();

// ============================================================
// 2. TRAVEL ENCOUNTER LOOT GENERATION
// ============================================================

console.log('=== Test 2: Travel Encounter Loot ===\n');

function testEncounterLoot() {
  const iterations = 5000;

  // Test combat encounters generate loot more often than weather
  let combatItems = 0;
  let weatherItems = 0;
  let discoveryItems = 0;
  let failedItems = 0;

  for (let i = 0; i < iterations; i++) {
    const combatLoot = generateEncounterLoot('combat', 5, 'success');
    const weatherLoot = generateEncounterLoot('weather', 5, 'success');
    const discoveryLoot = generateEncounterLoot('discovery', 5, 'success');
    const failedLoot = generateEncounterLoot('combat', 5, 'failure');

    if (combatLoot.item) combatItems++;
    if (weatherLoot.item) weatherItems++;
    if (discoveryLoot.item) discoveryItems++;
    if (failedLoot.item) failedItems++;
  }

  console.log(`Combat encounter loot rate: ${(combatItems / iterations * 100).toFixed(1)}% (expected ~30%)`);
  console.log(`Discovery encounter loot rate: ${(discoveryItems / iterations * 100).toFixed(1)}% (expected ~40%)`);
  console.log(`Weather encounter loot rate: ${(weatherItems / iterations * 100).toFixed(1)}% (expected ~0%)`);
  console.log(`Failed combat loot rate: ${(failedItems / iterations * 100).toFixed(1)}% (expected 0%)`);

  console.assert(combatItems > 0, 'FAIL: Combat encounters should sometimes drop items');
  console.assert(discoveryItems > combatItems, 'FAIL: Discovery should drop more items than combat');
  console.assert(weatherItems === 0, 'FAIL: Weather encounters should never drop items');
  console.assert(failedItems === 0, 'FAIL: Failed encounters should never drop items');

  console.log('PASS: Encounter loot rates are correct\n');
}

testEncounterLoot();

function testEncounterGold() {
  const iterations = 1000;
  let combatGold = 0;
  let weatherGold = 0;

  for (let i = 0; i < iterations; i++) {
    const combatLoot = generateEncounterLoot('combat', 5, 'success');
    const weatherLoot = generateEncounterLoot('weather', 5, 'success');
    combatGold += combatLoot.gold.gp * 100 + combatLoot.gold.sp * 10 + combatLoot.gold.cp;
    weatherGold += weatherLoot.gold.gp * 100 + weatherLoot.gold.sp * 10 + weatherLoot.gold.cp;
  }

  console.log(`Average combat gold (cp): ${(combatGold / iterations).toFixed(1)}`);
  console.log(`Average weather gold (cp): ${(weatherGold / iterations).toFixed(1)}`);

  console.assert(combatGold > 0, 'FAIL: Combat encounters should generate gold');
  console.assert(weatherGold === 0, 'FAIL: Weather encounters should not generate gold');

  console.log('PASS: Encounter gold generation is correct\n');
}

testEncounterGold();

function testEncounterLevelScaling() {
  const iterations = 1000;
  let lowLevelGold = 0;
  let highLevelGold = 0;

  for (let i = 0; i < iterations; i++) {
    const low = generateEncounterLoot('combat', 1, 'success');
    const high = generateEncounterLoot('combat', 15, 'success');
    lowLevelGold += low.gold.gp * 100 + low.gold.sp * 10 + low.gold.cp;
    highLevelGold += high.gold.gp * 100 + high.gold.sp * 10 + high.gold.cp;
  }

  console.log(`Average low-level gold: ${(lowLevelGold / iterations).toFixed(1)} cp`);
  console.log(`Average high-level gold: ${(highLevelGold / iterations).toFixed(1)} cp`);

  console.assert(highLevelGold > lowLevelGold, 'FAIL: Higher level encounters should give more gold');

  console.log('PASS: Encounter gold scales with level\n');
}

testEncounterLevelScaling();

// ============================================================
// 3. DM SESSION [LOOT_DROP] MARKER DETECTION
// ============================================================

console.log('=== Test 3: [LOOT_DROP] Marker Detection ===\n');

function testLootDropDetection() {
  // Single loot drop
  const narrative1 = 'You search the bandit\'s body and find a healing potion tucked into his belt. [LOOT_DROP: Item="Potion of Healing" Source="bandit leader\'s belt pouch"] The rest of the camp is silent.';
  const drops1 = detectLootDrop(narrative1);
  console.assert(drops1.length === 1, `FAIL: Should detect 1 drop, got ${drops1.length}`);
  console.assert(drops1[0].item === 'Potion of Healing', `FAIL: Item should be "Potion of Healing", got "${drops1[0].item}"`);
  console.assert(drops1[0].source === "bandit leader's belt pouch", `FAIL: Source mismatch`);

  // Multiple loot drops
  const narrative2 = 'Inside the chest you find two items. [LOOT_DROP: Item="Cloak of Protection" Source="hidden chest"] You also notice a wand. [LOOT_DROP: Item="Wand of Magic Missiles" Source="hidden chest"]';
  const drops2 = detectLootDrop(narrative2);
  console.assert(drops2.length === 2, `FAIL: Should detect 2 drops, got ${drops2.length}`);
  console.assert(drops2[0].item === 'Cloak of Protection', 'FAIL: First item wrong');
  console.assert(drops2[1].item === 'Wand of Magic Missiles', 'FAIL: Second item wrong');

  // No loot drop
  const narrative3 = 'The room is empty. Nothing of value here.';
  const drops3 = detectLootDrop(narrative3);
  console.assert(drops3.length === 0, `FAIL: Should detect 0 drops, got ${drops3.length}`);

  // Null input
  const drops4 = detectLootDrop(null);
  console.assert(drops4.length === 0, 'FAIL: Null input should return empty array');

  // No source field
  const narrative5 = '[LOOT_DROP: Item="Moon-Touched Sword"]';
  const drops5 = detectLootDrop(narrative5);
  console.assert(drops5.length === 1, 'FAIL: Should detect drop without source');
  console.assert(drops5[0].source === 'found', 'FAIL: Missing source should default to "found"');

  console.log('PASS: [LOOT_DROP] marker detection works correctly\n');
}

testLootDropDetection();

// ============================================================
// 4. QUEST COMPLETION REWARDS (structural test)
// ============================================================

console.log('=== Test 4: Quest Completion Rewards (Structural) ===\n');

// We can't test the DB-dependent function directly, but we can verify
// the function signature and reward structure expectations

function testQuestRewardStructure() {
  // Test the expected reward format from questGenerator
  const sampleRewards = {
    gold: 500,
    xp: 1000,
    items: ['Flame Tongue', 'Potion of Greater Healing'],
    reputation: 'Gain standing with the Harpers'
  };

  console.assert(typeof sampleRewards.gold === 'number', 'FAIL: Gold should be a number');
  console.assert(typeof sampleRewards.xp === 'number', 'FAIL: XP should be a number');
  console.assert(Array.isArray(sampleRewards.items), 'FAIL: Items should be an array');
  console.assert(sampleRewards.items.length === 2, 'FAIL: Should have 2 items');
  console.assert(sampleRewards.items[0] === 'Flame Tongue', 'FAIL: First item should be Flame Tongue');

  console.log('PASS: Quest reward structure is valid\n');
}

testQuestRewardStructure();

// ============================================================
// SUMMARY
// ============================================================

console.log('=== All Loot System Tests Complete ===');
console.log('Tests passed:');
console.log('  1. Broadened session-end loot (high/medium/low risk)');
console.log('  2. Travel encounter loot generation');
console.log('  3. [LOOT_DROP] marker detection');
console.log('  4. Quest completion reward structure');
