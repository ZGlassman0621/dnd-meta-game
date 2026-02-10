/**
 * Tests for combat marker detection and initiative rolling.
 * Run: node tests/combat-tracker.test.js
 */

import { detectCombatStart, detectCombatEnd, estimateEnemyDexMod } from '../server/services/dmSessionService.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passed++;
  } else {
    console.error(`  ✗ ${message}`);
    failed++;
  }
}

// ===== detectCombatStart =====
console.log('\ndetectCombatStart:');

{
  const result = detectCombatStart('The goblins leap out! [COMBAT_START: Enemies="Goblin 1, Goblin 2, Goblin Shaman"]');
  assert(result.detected === true, 'Detects combat start marker');
  assert(result.enemies.length === 3, 'Parses 3 enemies');
  assert(result.enemies[0] === 'Goblin 1', 'First enemy is Goblin 1');
  assert(result.enemies[2] === 'Goblin Shaman', 'Third enemy is Goblin Shaman');
}

{
  const result = detectCombatStart('[COMBAT_START: Enemies="Bandit Leader"]');
  assert(result.detected === true, 'Works with single enemy');
  assert(result.enemies.length === 1, 'Parses 1 enemy');
  assert(result.enemies[0] === 'Bandit Leader', 'Enemy is Bandit Leader');
}

{
  const result = detectCombatStart('Just a normal narrative with no combat.');
  assert(result.detected === false, 'Returns false when no marker present');
}

{
  const result = detectCombatStart(null);
  assert(result.detected === false, 'Handles null input');
}

{
  const result = detectCombatStart('');
  assert(result.detected === false, 'Handles empty string');
}

{
  const result = detectCombatStart('[combat_start: enemies="Wolf, Dire Wolf"]');
  assert(result.detected === true, 'Case-insensitive detection');
  assert(result.enemies.length === 2, 'Parses enemies case-insensitively');
}

// ===== detectCombatEnd =====
console.log('\ndetectCombatEnd:');

assert(detectCombatEnd('The last goblin falls. [COMBAT_END]') === true, 'Detects combat end marker');
assert(detectCombatEnd('[COMBAT_END]') === true, 'Detects bare combat end marker');
assert(detectCombatEnd('[combat_end]') === true, 'Case-insensitive detection');
assert(detectCombatEnd('No combat happening here.') === false, 'Returns false when no marker');
assert(detectCombatEnd(null) === false, 'Handles null input');
assert(detectCombatEnd('') === false, 'Handles empty string');

// ===== estimateEnemyDexMod =====
console.log('\nestimateEnemyDexMod:');

assert(estimateEnemyDexMod('Goblin Scout') === 2, 'Goblins get +2 DEX');
assert(estimateEnemyDexMod('Wolf') === 3, 'Wolves get +3 DEX');
assert(estimateEnemyDexMod('Ogre') === -1, 'Ogres get -1 DEX');
assert(estimateEnemyDexMod('Bandit') === 1, 'Bandits get +1 DEX');
assert(estimateEnemyDexMod('Rogue Assassin') === 4, 'Rogues get +4 DEX');
assert(estimateEnemyDexMod('Unknown Creature') === 1, 'Unknown defaults to +1');
assert(estimateEnemyDexMod('') === 1, 'Empty string defaults to +1');
assert(estimateEnemyDexMod(null) === 1, 'Null defaults to +1');

// ===== Summary =====
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
