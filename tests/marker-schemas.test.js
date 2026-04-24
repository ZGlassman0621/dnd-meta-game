/**
 * Tests for server/services/markerSchemas.js and ruleVerifiers.js.
 *
 * Guards the underlying fix for Weakness 5 (marker silent failures) and
 * Weakness 6 (code-verified rules). If a malformed marker sneaks past
 * these, it'll fail silently again — that's the whole class of bug this
 * file exists to catch.
 */

import assert from 'node:assert/strict';
import {
  parseMarkerBody,
  parseAllMarkers,
  extractMarkerBodies,
  validateDmMarkers,
  buildCorrectionMessage,
  MARKER_SCHEMAS
} from '../server/services/markerSchemas.js';
import {
  verifyHardStops,
  verifyMetaCommentary,
  verifyDmResponse,
  buildRuleCorrectionMessage
} from '../server/services/ruleVerifiers.js';

let passed = 0;
let failed = 0;
function test(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); passed++; }
  catch (err) { console.log(`  ✗ FAIL: ${name}`); console.log(`    ${err.message}`); failed++; }
}

console.log('\n=== markerSchemas: extraction & basic parsing ===\n');

test('extractMarkerBodies finds a single marker body', () => {
  const txt = 'prose prose [LOOT_DROP: Item="Gold Ring" Source="chest"] more prose';
  assert.equal(extractMarkerBodies(txt, 'LOOT_DROP'), 'Item="Gold Ring" Source="chest"');
});

test('extractMarkerBodies returns null when marker absent', () => {
  assert.equal(extractMarkerBodies('no marker here', 'LOOT_DROP'), null);
});

test('extractMarkerBodies handles markers with no colon body', () => {
  assert.equal(extractMarkerBodies('foo [COMBAT_END] bar', 'COMBAT_END'), '');
});

test('extractMarkerBodies all=true returns every instance', () => {
  const txt = '[LOOT_DROP: Item="A"] middle [LOOT_DROP: Item="B"]';
  const bodies = extractMarkerBodies(txt, 'LOOT_DROP', { all: true });
  assert.deepEqual(bodies, ['Item="A"', 'Item="B"']);
});

console.log('\n=== PROMISE_MADE schema validation ===\n');

test('valid PROMISE_MADE parses cleanly', () => {
  const body = 'NPC="Elara" Promise="Return the amulet" Deadline=10 Weight="major"';
  const result = parseMarkerBody(body, 'PROMISE_MADE');
  assert.equal(result.ok, true);
  assert.deepEqual(result.data, {
    NPC: 'Elara',
    Promise: 'Return the amulet',
    Deadline: 10,
    Weight: 'major'
  });
});

test('PROMISE_MADE without Weight fails with useful error', () => {
  const body = 'NPC="Elara" Promise="Return the amulet"';
  const result = parseMarkerBody(body, 'PROMISE_MADE');
  assert.equal(result.ok, false);
  assert.equal(result.errors[0].field, 'Weight');
  assert.match(result.errors[0].reason, /required/);
});

test('PROMISE_MADE with invalid Weight enum is flagged', () => {
  const body = 'NPC="Elara" Promise="Return X" Weight="huge"';
  const result = parseMarkerBody(body, 'PROMISE_MADE');
  assert.equal(result.ok, false);
  assert.equal(result.errors[0].field, 'Weight');
  assert.match(result.errors[0].reason, /trivial.*minor.*moderate.*major.*critical/);
});

test('PROMISE_MADE Deadline is optional', () => {
  const body = 'NPC="Elara" Promise="Help my son" Weight="moderate"';
  const result = parseMarkerBody(body, 'PROMISE_MADE');
  assert.equal(result.ok, true);
  assert.equal(result.data.Deadline, undefined);
});

console.log('\n=== NOTORIETY_GAIN schema validation ===\n');

test('valid NOTORIETY_GAIN parses', () => {
  const body = 'source="City Watch" amount=15 category="criminal"';
  const result = parseMarkerBody(body, 'NOTORIETY_GAIN');
  assert.equal(result.ok, true);
  assert.deepEqual(result.data, { source: 'City Watch', amount: 15, category: 'criminal' });
});

test('NOTORIETY_GAIN with invalid category fails', () => {
  const body = 'source="Watch" amount=15 category="bad-guys"';
  const result = parseMarkerBody(body, 'NOTORIETY_GAIN');
  assert.equal(result.ok, false);
  assert.ok(result.errors.some(e => e.field === 'category'));
});

test('NOTORIETY_GAIN with non-integer amount fails', () => {
  const body = 'source="Watch" amount="a lot" category="criminal"';
  const result = parseMarkerBody(body, 'NOTORIETY_GAIN');
  assert.equal(result.ok, false);
  assert.ok(result.errors.some(e => e.field === 'amount'));
});

test('NOTORIETY_GAIN amount over 50 fails', () => {
  const body = 'source="Watch" amount=999 category="criminal"';
  const result = parseMarkerBody(body, 'NOTORIETY_GAIN');
  assert.equal(result.ok, false);
});

console.log('\n=== CONDITION_ADD schema validation ===\n');

test('valid CONDITION_ADD with standard condition', () => {
  const r = parseMarkerBody('Target="Player" Condition="frightened"', 'CONDITION_ADD');
  assert.equal(r.ok, true);
  assert.equal(r.data.Condition, 'frightened');
});

test('CONDITION_ADD with exhaustion level parses', () => {
  const r = parseMarkerBody('Target="Player" Condition="exhaustion_3"', 'CONDITION_ADD');
  assert.equal(r.ok, true);
});

test('CONDITION_ADD with invalid condition fails', () => {
  const r = parseMarkerBody('Target="Player" Condition="confused"', 'CONDITION_ADD');
  assert.equal(r.ok, false);
});

console.log('\n=== validateDmMarkers — whole-response scan ===\n');

test('Valid response: no failures', () => {
  const txt = `You strike the bandit. [COMBAT_START: Enemies="Bandit Leader, Bandit Thug"]`;
  const { failures, validByKey } = validateDmMarkers(txt);
  assert.equal(failures.length, 0);
  assert.ok(validByKey.COMBAT_START);
});

test('Malformed marker flagged as failure', () => {
  const txt = `Elara nods. [PROMISE_MADE: NPC="Elara" Promise="Find the sword"]`;  // missing Weight
  const { failures } = validateDmMarkers(txt);
  assert.equal(failures.length, 1);
  assert.equal(failures[0].schemaKey, 'PROMISE_MADE');
});

test('Multiple markers in one response — mix of valid and invalid', () => {
  const txt = `[LOOT_DROP: Item="Dagger"] prose [NOTORIETY_GAIN: source="Watch" amount=10 category="bogus"]`;
  const { failures, validByKey } = validateDmMarkers(txt);
  assert.equal(failures.length, 1);
  assert.equal(failures[0].schemaKey, 'NOTORIETY_GAIN');
  assert.ok(validByKey.LOOT_DROP);
});

test('buildCorrectionMessage produces one line per failure', () => {
  const failures = [
    { schemaKey: 'PROMISE_MADE', errors: [{ field: 'Weight', reason: 'required field missing' }] },
    { schemaKey: 'NOTORIETY_GAIN', errors: [{ field: 'category', reason: 'invalid enum value' }] }
  ];
  const msg = buildCorrectionMessage(failures);
  assert.ok(msg.includes('PROMISE_MADE'));
  assert.ok(msg.includes('NOTORIETY_GAIN'));
  assert.equal(msg.split('\n').length, 2);
});

console.log('\n=== ruleVerifiers: hard-stop detection (Cardinal Rule 2) ===\n');

test('Clean roll request at end of response is fine', () => {
  const txt = 'The lock is old and corroded. Make a Thieves\' Tools check.';
  const result = verifyHardStops(txt);
  assert.equal(result.ok, true);
});

test('Narration AFTER roll request is flagged', () => {
  const txt = 'Make a Thieves\' Tools check. The tumblers grind against your picks as you work.';
  const result = verifyHardStops(txt);
  assert.equal(result.ok, false);
  assert.equal(result.violations[0].rule, 'hard_stop_after_roll');
});

test('Short trailing fragment after roll is tolerated (< 5 words)', () => {
  const txt = 'Make an attack roll. Good luck.';
  const result = verifyHardStops(txt);
  assert.equal(result.ok, true);
});

test('Markers after roll request do not false-flag', () => {
  const txt = 'Make a Perception check. [COMBAT_END]';
  const result = verifyHardStops(txt);
  assert.equal(result.ok, true);
});

console.log('\n=== ruleVerifiers: meta-commentary detection (Cardinal Rule 4) ===\n');

test('Parenthetical DM note is flagged', () => {
  const txt = 'Moss glances over the ledger. (Note: this establishes the bandit raids from last week.)';
  const result = verifyMetaCommentary(txt);
  assert.equal(result.ok, false);
  assert.equal(result.violations[0].rule, 'meta_parenthetical');
});

test('"You succeed on your check" is flagged', () => {
  const txt = 'You succeed on your Perception check and notice the tripwire.';
  const result = verifyMetaCommentary(txt);
  assert.equal(result.ok, false);
  assert.equal(result.violations[0].rule, 'narrated_check_result');
});

test('Clean in-fiction narration passes', () => {
  const txt = 'At the far end of the alley, a silhouette shifts behind a stack of crates. A boot scrapes wet stone.';
  const result = verifyMetaCommentary(txt);
  assert.equal(result.ok, true);
});

console.log('\n=== verifyDmResponse + buildRuleCorrectionMessage ===\n');

test('verifyDmResponse combines multiple verifiers', () => {
  const txt = 'Make a Persuasion check. You succeed on your check and she lets you in.';
  const result = verifyDmResponse(txt);
  assert.equal(result.ok, false);
  // Should catch BOTH the hard-stop violation AND the narrated check result.
  assert.ok(result.violations.length >= 2);
});

test('buildRuleCorrectionMessage quotes the violating trigger for hard-stop', () => {
  const txt = 'Make a Perception check. The guard watches you carefully from across the room.';
  const { violations } = verifyDmResponse(txt);
  const msg = buildRuleCorrectionMessage(violations);
  assert.ok(msg.includes('Cardinal Rule 2'));
  assert.ok(msg.includes('Perception check'));
});

test('buildRuleCorrectionMessage returns null when no violations', () => {
  assert.equal(buildRuleCorrectionMessage([]), null);
  assert.equal(buildRuleCorrectionMessage(null), null);
});

console.log(`\n==================================================`);
console.log(`Marker Schema + Rule Verifier Tests: ${passed} passed, ${failed} failed`);
console.log(`==================================================\n`);
process.exit(failed === 0 ? 0 : 1);
