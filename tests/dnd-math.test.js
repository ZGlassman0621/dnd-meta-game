/**
 * Equivalence + correctness test for the shared D&D math helpers.
 *
 * Proves abilityModifier() reproduces the legacy inline formulas byte-for-byte
 * across the full valid domain, and that proficiencyBonus()/hitDieFor() match
 * the authoritative tables. This is the safety net that lets scattered copies
 * be replaced by the shared module without behavior change.
 */

import assert from 'node:assert/strict';
import {
  abilityModifier, formatModifier, proficiencyBonus, hitDieFor,
  spellSaveDC, spellAttackBonus
} from '../server/utils/dndMath.js';
import { PROFICIENCY_BONUS, HIT_DICE } from '../server/config/levelProgression.js';

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); passed++; }
  catch (e) { console.log(`  ✗ FAIL: ${name}\n    ${e.message}`); failed++; }
}

// The two legacy inline forms abilityModifier must reproduce for VALID scores.
const legacyDefensive = (s) => Math.floor(((Number(s) || 10) - 10) / 2); // character.js / gameStateMarkerService.js
const legacyBare      = (s) => Math.floor((s - 10) / 2);                  // CompanionSheet / LevelUpPage / etc.

console.log('\n=== abilityModifier matches legacy formulas across valid domain ===\n');

test('matches both legacy forms for every valid score 1..30', () => {
  for (let s = 1; s <= 30; s++) {
    assert.equal(abilityModifier(s), legacyDefensive(s), `defensive form @${s}`);
    assert.equal(abilityModifier(s), legacyBare(s), `bare form @${s}`);
  }
});

test('reproduces the defensive guard for falsy/invalid input', () => {
  // character.js/gameState used Number(score)||10 → treat missing as 10 (mod 0)
  assert.equal(abilityModifier(undefined), 0);
  assert.equal(abilityModifier(null), 0);
  assert.equal(abilityModifier(0), 0);
  assert.equal(abilityModifier('14'), 2); // numeric strings coerce, as before
});

test('spot-check known modifiers', () => {
  assert.equal(abilityModifier(10), 0);
  assert.equal(abilityModifier(8), -1);
  assert.equal(abilityModifier(20), 5);
  assert.equal(abilityModifier(7), -2);
});

console.log('\n=== formatModifier ===\n');
test('signs modifiers for display', () => {
  assert.equal(formatModifier(3), '+3');
  assert.equal(formatModifier(0), '+0');
  assert.equal(formatModifier(-1), '-1');
});

console.log('\n=== proficiencyBonus matches the authoritative table 1..20 ===\n');
test('matches PROFICIENCY_BONUS for every level 1..20', () => {
  for (let lvl = 1; lvl <= 20; lvl++) {
    assert.equal(proficiencyBonus(lvl), PROFICIENCY_BONUS[lvl], `level ${lvl}`);
  }
});
test('matches the classic ceil(level/4)+1 for 1..20', () => {
  for (let lvl = 1; lvl <= 20; lvl++) {
    assert.equal(proficiencyBonus(lvl), Math.ceil(lvl / 4) + 1, `level ${lvl}`);
  }
});

console.log('\n=== hitDieFor matches HIT_DICE table ===\n');
test('matches HIT_DICE for known classes, defaults 8 for unknown', () => {
  for (const [cls, die] of Object.entries(HIT_DICE)) {
    assert.equal(hitDieFor(cls), die, cls);
  }
  assert.equal(hitDieFor('barbarian'), 12);
  assert.equal(hitDieFor('nonexistent'), 8);
  assert.equal(hitDieFor(undefined), 8);
});

console.log('\n=== derived caster math ===\n');
test('spellSaveDC and spellAttackBonus compose correctly', () => {
  // INT 16 (+3), level 5 (prof +3): DC = 8+3+3 = 14, attack = +6
  assert.equal(spellSaveDC(16, 5), 14);
  assert.equal(spellAttackBonus(16, 5), 6);
});

console.log(`\n==================================================`);
console.log(`dndMath: ${passed} passed, ${failed} failed`);
console.log(`==================================================\n`);
process.exit(failed === 0 ? 0 : 1);
