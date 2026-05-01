/**
 * Phase 2 chunk 4 — preludeCanonThreadService validation tests.
 *
 * Pure-logic checks against the kind/weight/status enums exposed by the
 * service. The DB round-trip (recordCanonThread) is exercised by
 * integration tests when run; this file covers the cheap edges.
 */

import { _internals } from '../server/services/preludeCanonThreadService.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) { console.log(`  ✓ ${message}`); passed++; }
  else { console.error(`  ✗ ${message}`); failed++; }
}

console.log('\n=== VALID_KINDS ===\n');
{
  const expected = [
    'unresolved_loss',
    'blood_debt',
    'unfulfilled_oath',
    'unpaid_crime',
    'unfinished_relationship',
    'held_object',
    'held_secret'
  ];
  assert(Array.isArray(_internals.VALID_KINDS), 'VALID_KINDS exported as array');
  assert(_internals.VALID_KINDS.length === 7, 'exactly 7 kinds (matches Phase 1 Decision 6)');
  for (const k of expected) {
    assert(_internals.VALID_KINDS.includes(k), `kind "${k}" present`);
  }
  // Reject obvious typos
  assert(!_internals.VALID_KINDS.includes('unresolved_los'), 'typo not in enum');
  assert(!_internals.VALID_KINDS.includes('blood-debt'), 'hyphen variant not in enum (snake_case canonical)');
}

console.log('\n=== VALID_WEIGHTS ===\n');
{
  assert(_internals.VALID_WEIGHTS.length === 3, 'exactly 3 weight levels');
  assert(_internals.VALID_WEIGHTS.includes('minor'), 'minor present');
  assert(_internals.VALID_WEIGHTS.includes('notable'), 'notable present');
  assert(_internals.VALID_WEIGHTS.includes('major'), 'major present');
  // Default in service code is 'notable' — explicit assertion guards against drift
  const defaultWeight = 'notable';
  assert(_internals.VALID_WEIGHTS.includes(defaultWeight), 'default weight is in the enum');
}

console.log('\n=== VALID_STATUSES ===\n');
{
  const expected = ['active', 'ripened', 'resolved', 'decayed'];
  assert(_internals.VALID_STATUSES.length === expected.length, `exactly ${expected.length} statuses`);
  for (const s of expected) {
    assert(_internals.VALID_STATUSES.includes(s), `status "${s}" present`);
  }
}

console.log('\n==================================================');
console.log(`Prelude Canon Thread Tests: ${passed} passed, ${failed} failed`);
console.log('==================================================\n');

if (failed > 0) process.exit(1);
