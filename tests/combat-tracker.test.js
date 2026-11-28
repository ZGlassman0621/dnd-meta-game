/**
 * Tests for enemy initiative (DEX) estimation. The legacy combat marker
 * detect-functions were deleted in l1-l6-cleanup (v1.0.229); COMBAT_START /
 * COMBAT_END are covered by the marker pipeline suites.
 * Run: npm test combat-tracker   — NEVER `node tests/combat-tracker.test.js` directly:
 *      only run-tests.js redirects TURSO_DATABASE_URL to a throwaway
 *      file, so a bare `node` run writes into the LIVE campaign database.
 */

import { estimateEnemyDexMod } from '../server/services/dmSessionService.js';

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
