/**
 * Fiction-Marker Reconciliation tests (Structural #9: P2-A).
 * Verifies strict both-directions reconciliation for HP/damage.
 */
import { extractDamageClaims, extractDeathClaims, narrationMentionsEffect } from '../server/services/fictionMarkerReconciliation.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) { console.log(`  ✓ ${message}`); passed++; }
  else { console.error(`  ✗ ${message}`); failed++; }
}

console.log('\n=== Test 1: extractDamageClaims ===\n');
{
  const c1 = extractDamageClaims('The goblin takes 8 damage from your sword.');
  assert(c1.length === 1 && c1[0].amount === 8, 'takes X damage');
  const c2 = extractDamageClaims('It hits for 5 more.');
  assert(c2.length === 1 && c2[0].amount === 5, 'hits for X');
  const c3 = extractDamageClaims('The dragon deals 12 damage to the party.');
  assert(c3.length === 1 && c3[0].amount === 12, 'deals X damage (deduplicated)');
  const c4 = extractDamageClaims('You walk through the forest.');
  assert(c4.length === 0, 'no false positive');
}

console.log('\n=== Test 2: extractDeathClaims ===\n');
{
  const d1 = extractDeathClaims('The goblin falls dead.');
  assert(d1.length >= 1, 'falls dead detected');
  const d2 = extractDeathClaims('You kill the orc.');
  assert(d2.length >= 1, 'kill X detected');
}

console.log('\n=== Test 3: narrationMentionsEffect ===\n');
{
  assert(narrationMentionsEffect('The goblin hits you for 8 damage', { type: 'hp_change', delta: -8 }), 'damage narration detected');
  assert(!narrationMentionsEffect('You walk through the forest.', { type: 'hp_change', delta: -8 }), 'no false positive');
  assert(narrationMentionsEffect('The goblin staggers, blood pouring from the wound', { type: 'enemy_damage', enemyName: 'goblin' }), 'enemy damage detected');
}

console.log(`\n${'='.repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log(`${'='.repeat(50)}\n`);
process.exit(failed > 0 ? 1 : 0);
