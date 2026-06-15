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
  verifyNoMechanicalRoll,
  verifyNoStillFreezeTic,
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

// NOTE: these sections previously exercised PROMISE_MADE / NOTORIETY_GAIN,
// which were removed from MARKER_SCHEMAS in the v2.0 MVP reduction (their
// consumer services live in /archive). The parser CAPABILITIES they checked
// (required-field, enum + reason, integer, range, optional-absent) are now
// asserted against LIVE markers so coverage is preserved without resurrecting
// archived schemas. See tests/archive for the original promise/notoriety suite.
console.log('\n=== required + enum + optional field validation (live markers) ===\n');

test('valid ROLL_REQUEST parses cleanly with all fields', () => {
  const body = 'Kind="check" Ability="Perception" DC=15 Advantage="advantage" Label="Spot the wire"';
  const result = parseMarkerBody(body, 'ROLL_REQUEST');
  assert.equal(result.ok, true);
  assert.deepEqual(result.data, {
    Kind: 'check', Ability: 'Perception', DC: 15, Advantage: 'advantage', Label: 'Spot the wire'
  });
});

test('CONDITION_ADD without required Target fails with useful error', () => {
  const result = parseMarkerBody('Condition="poisoned"', 'CONDITION_ADD');
  assert.equal(result.ok, false);
  assert.equal(result.errors[0].field, 'Target');
  assert.match(result.errors[0].reason, /required/);
});

test('CONDITION_ADD with invalid Condition enum lists the allowed values', () => {
  const result = parseMarkerBody('Target="Player" Condition="confused"', 'CONDITION_ADD');
  assert.equal(result.ok, false);
  assert.equal(result.errors[0].field, 'Condition');
  assert.match(result.errors[0].reason, /poisoned/); // enum list quoted in the reason
});

test('ROLL_REQUEST optional fields may be omitted', () => {
  const result = parseMarkerBody('Kind="save"', 'ROLL_REQUEST');
  assert.equal(result.ok, true);
  assert.equal(result.data.DC, undefined);
  assert.equal(result.data.Ability, undefined);
});

console.log('\n=== integer field + range validation (live markers) ===\n');

test('valid HP_CHANGE with negative integer Delta parses', () => {
  const result = parseMarkerBody('Target="Player" Delta=-8 Reason="ogre club"', 'HP_CHANGE');
  assert.equal(result.ok, true);
  assert.equal(result.data.Delta, -8);
});

test('HP_CHANGE with non-integer Delta fails', () => {
  const result = parseMarkerBody('Target="Player" Delta="a lot"', 'HP_CHANGE');
  assert.equal(result.ok, false);
  assert.ok(result.errors.some(e => e.field === 'Delta'));
});

test('TURN with Round below the minimum (1) is flagged', () => {
  const result = parseMarkerBody('Combatant="Goblin" Round=0', 'TURN');
  assert.equal(result.ok, false);
  assert.ok(result.errors.some(e => e.field === 'Round'));
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
  const txt = `The toxin takes hold. [CONDITION_ADD: Target="Player"]`;  // missing required Condition
  const { failures } = validateDmMarkers(txt);
  assert.equal(failures.length, 1);
  assert.equal(failures[0].schemaKey, 'CONDITION_ADD');
});

test('Multiple markers in one response — mix of valid and invalid', () => {
  const txt = `[LOOT_DROP: Item="Dagger"] prose [CONDITION_ADD: Target="Player" Condition="bogus"]`;
  const { failures, validByKey } = validateDmMarkers(txt);
  assert.equal(failures.length, 1);
  assert.equal(failures[0].schemaKey, 'CONDITION_ADD');
  assert.ok(validByKey.LOOT_DROP);
});

test('buildCorrectionMessage produces one line per failure', () => {
  const failures = [
    { schemaKey: 'CONDITION_ADD', errors: [{ field: 'Condition', reason: 'required field missing' }] },
    { schemaKey: 'HP_CHANGE', errors: [{ field: 'Delta', reason: 'expected integer' }] }
  ];
  const msg = buildCorrectionMessage(failures);
  assert.ok(msg.includes('CONDITION_ADD'));
  assert.ok(msg.includes('HP_CHANGE'));
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

console.log('\n=== verifyNoMechanicalRoll — Cardinal Rule 13b ===\n');

// The actual v1.0.94 playtest violation:
test('Playtest case: "You rolled an 11" is flagged', () => {
  const txt = 'You rolled an 11. The spoke seats — mostly. It\'s in the groove, it\'s not walking.';
  const r = verifyNoMechanicalRoll(txt);
  assert.equal(r.ok, false);
  assert.equal(r.violations[0].rule, 'mechanical_roll_leak');
});

test('"With a 14, you" is flagged', () => {
  const txt = 'You step into the alley. With a 14, you spot the wire.';
  assert.equal(verifyNoMechanicalRoll(txt).ok, false);
});

test('"Your roll of 19" is flagged', () => {
  const txt = 'Your roll of 19 is nearly perfect — the lock springs open.';
  assert.equal(verifyNoMechanicalRoll(txt).ok, false);
});

test('"You succeed on your Perception check" is flagged', () => {
  const txt = 'You succeed on your Perception check. There\'s a hairline crack along the wall.';
  assert.equal(verifyNoMechanicalRoll(txt).ok, false);
});

test('"Your check succeeds" is flagged', () => {
  const txt = 'Your Stealth check succeeds and the guard turns away.';
  assert.equal(verifyNoMechanicalRoll(txt).ok, false);
});

test('"On your 8" is flagged', () => {
  const txt = 'On your 8, the door resists you.';
  assert.equal(verifyNoMechanicalRoll(txt).ok, false);
});

test('"the dice land" is flagged', () => {
  const txt = 'The dice land at 17 — you spot the loose tile.';
  assert.equal(verifyNoMechanicalRoll(txt).ok, false);
});

test('Pure fictional outcome passes', () => {
  const txt = 'The spoke seats — mostly. There\'s a fraction of tilt still in it. Toren brings the mallet down once, sharp.';
  assert.equal(verifyNoMechanicalRoll(txt).ok, true);
});

test('Pre-roll narration without a number passes', () => {
  const txt = 'You grip the spoke and press it into the hub. The wood is cold and smooth. Make an Athletics check.';
  assert.equal(verifyNoMechanicalRoll(txt).ok, true);
});

test('Mention of a number that isn\'t a roll passes', () => {
  const txt = 'There are six children in the room. The youngest is three.';
  assert.equal(verifyNoMechanicalRoll(txt).ok, true);
});

console.log('\n=== verifyNoStillFreezeTic — Rule 19a extensions ===\n');

test('Playtest case: "Toren is very still" is flagged', () => {
  const txt = 'Toren is very still as the spoke seats.';
  const r = verifyNoStillFreezeTic(txt);
  assert.equal(r.ok, false);
  assert.equal(r.violations[0].rule, 'still_freeze_tic');
});

test('Playtest case: "Vess\'s spoon stops" is flagged', () => {
  const txt = 'Vess\'s spoon stops mid-stir. She looks up at you.';
  assert.equal(verifyNoStillFreezeTic(txt).ok, false);
});

test('"X goes very still" still flagged (existing pattern)', () => {
  const txt = 'Moss goes very still at the sound.';
  assert.equal(verifyNoStillFreezeTic(txt).ok, false);
});

test('"X stills" still flagged', () => {
  const txt = 'Halgrim stills, hand frozen on the latch.';
  assert.equal(verifyNoStillFreezeTic(txt).ok, false);
});

test('"X freezes" flagged', () => {
  const txt = 'Brann freezes when he sees you.';
  assert.equal(verifyNoStillFreezeTic(txt).ok, false);
});

test('"his hand stops" flagged', () => {
  const txt = 'His hand stops on the door handle.';
  assert.equal(verifyNoStillFreezeTic(txt).ok, false);
});

test('"her sewing stops" flagged', () => {
  const txt = 'Her sewing stops. She glances toward the window.';
  assert.equal(verifyNoStillFreezeTic(txt).ok, false);
});

test('Specific physical detail passes', () => {
  const txt = 'Moss sets the ladle down on the counter. Carefully. The way she does when she doesn\'t want someone downstairs to hear her put a thing down.';
  assert.equal(verifyNoStillFreezeTic(txt).ok, true);
});

test('Lake/scene description with "still" passes', () => {
  const txt = 'The lake is still. Mist rises off it.';
  assert.equal(verifyNoStillFreezeTic(txt).ok, true);
});

test('NPC stopping the wagon — "stops" without action-freeze pattern passes', () => {
  const txt = 'Toren stops the wagon at the crossroads.';
  assert.equal(verifyNoStillFreezeTic(txt).ok, true);
});

console.log(`\n==================================================`);
console.log(`Marker Schema + Rule Verifier Tests: ${passed} passed, ${failed} failed`);
console.log(`==================================================\n`);
process.exit(failed === 0 ? 0 : 1);
