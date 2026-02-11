/**
 * Tests for condition tracking: data validation, marker detection, auto-clear, prompt formatting.
 * Run: node tests/condition-tracking.test.js
 */

import { detectConditionChanges, formatConditionsForAI, CONDITION_NAMES } from '../server/data/conditions.js';

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

function assertEqual(actual, expected, message) {
  if (actual === expected) {
    console.log(`  ✓ ${message}`);
    passed++;
  } else {
    console.error(`  ✗ ${message} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    failed++;
  }
}

// ===== CONDITION_NAMES =====
console.log('\nCONDITION_NAMES:');

{
  assertEqual(CONDITION_NAMES.length, 20, 'Has 20 condition names (14 base + 6 exhaustion)');
  assert(CONDITION_NAMES.includes('Blinded'), 'Includes Blinded');
  assert(CONDITION_NAMES.includes('Charmed'), 'Includes Charmed');
  assert(CONDITION_NAMES.includes('Deafened'), 'Includes Deafened');
  assert(CONDITION_NAMES.includes('Frightened'), 'Includes Frightened');
  assert(CONDITION_NAMES.includes('Grappled'), 'Includes Grappled');
  assert(CONDITION_NAMES.includes('Incapacitated'), 'Includes Incapacitated');
  assert(CONDITION_NAMES.includes('Invisible'), 'Includes Invisible');
  assert(CONDITION_NAMES.includes('Paralyzed'), 'Includes Paralyzed');
  assert(CONDITION_NAMES.includes('Petrified'), 'Includes Petrified');
  assert(CONDITION_NAMES.includes('Poisoned'), 'Includes Poisoned');
  assert(CONDITION_NAMES.includes('Prone'), 'Includes Prone');
  assert(CONDITION_NAMES.includes('Restrained'), 'Includes Restrained');
  assert(CONDITION_NAMES.includes('Stunned'), 'Includes Stunned');
  assert(CONDITION_NAMES.includes('Unconscious'), 'Includes Unconscious');
  assert(CONDITION_NAMES.includes('Exhaustion 1'), 'Includes Exhaustion 1');
  assert(CONDITION_NAMES.includes('Exhaustion 6'), 'Includes Exhaustion 6');
}

// ===== detectConditionChanges =====
console.log('\ndetectConditionChanges:');

{
  const result = detectConditionChanges('The poison takes hold. [CONDITION_ADD: Target="Player" Condition="poisoned"]');
  assertEqual(result.applied.length, 1, 'Detects single CONDITION_ADD');
  assertEqual(result.applied[0].target, 'Player', 'Target is Player');
  assertEqual(result.applied[0].condition, 'poisoned', 'Condition is poisoned');
  assertEqual(result.removed.length, 0, 'No removals');
}

{
  const result = detectConditionChanges('The spell fades. [CONDITION_REMOVE: Target="Player" Condition="frightened"]');
  assertEqual(result.removed.length, 1, 'Detects single CONDITION_REMOVE');
  assertEqual(result.removed[0].target, 'Player', 'Target is Player');
  assertEqual(result.removed[0].condition, 'frightened', 'Condition is frightened');
  assertEqual(result.applied.length, 0, 'No additions');
}

{
  const result = detectConditionChanges(
    'Chaos erupts! [CONDITION_ADD: Target="Player" Condition="prone"] [CONDITION_ADD: Target="Elara" Condition="charmed"]'
  );
  assertEqual(result.applied.length, 2, 'Detects multiple CONDITION_ADD markers');
  assertEqual(result.applied[0].target, 'Player', 'First target is Player');
  assertEqual(result.applied[0].condition, 'prone', 'First condition is prone');
  assertEqual(result.applied[1].target, 'Elara', 'Second target is Elara');
  assertEqual(result.applied[1].condition, 'charmed', 'Second condition is charmed');
}

{
  const result = detectConditionChanges(
    '[CONDITION_ADD: Target="Player" Condition="poisoned"] The battle continues. [CONDITION_REMOVE: Target="Elara" Condition="grappled"]'
  );
  assertEqual(result.applied.length, 1, 'Detects ADD and REMOVE in same text');
  assertEqual(result.removed.length, 1, 'Detects REMOVE alongside ADD');
  assertEqual(result.applied[0].condition, 'poisoned', 'Added condition correct');
  assertEqual(result.removed[0].target, 'Elara', 'Removed target correct');
  assertEqual(result.removed[0].condition, 'grappled', 'Removed condition correct');
}

{
  const result = detectConditionChanges('Just a normal narrative with no markers.');
  assertEqual(result.applied.length, 0, 'No markers: empty applied');
  assertEqual(result.removed.length, 0, 'No markers: empty removed');
}

{
  const result = detectConditionChanges(null);
  assertEqual(result.applied.length, 0, 'Null input: empty applied');
  assertEqual(result.removed.length, 0, 'Null input: empty removed');
}

{
  const result = detectConditionChanges('');
  assertEqual(result.applied.length, 0, 'Empty string: empty applied');
  assertEqual(result.removed.length, 0, 'Empty string: empty removed');
}

{
  // Exhaustion level conversion (spaces → underscores)
  const result = detectConditionChanges('[CONDITION_ADD: Target="Player" Condition="Exhaustion 2"]');
  assertEqual(result.applied[0].condition, 'exhaustion_2', 'Exhaustion space converted to underscore');
}

{
  // Case insensitive matching
  const result = detectConditionChanges('[condition_add: Target="Player" Condition="Blinded"]');
  assertEqual(result.applied.length, 1, 'Case insensitive detection');
  assertEqual(result.applied[0].condition, 'blinded', 'Condition lowercased');
}

// ===== formatConditionsForAI =====
console.log('\nformatConditionsForAI:');

{
  const result = formatConditionsForAI(['poisoned', 'frightened'], {});
  assert(result !== null, 'Returns non-null for player conditions');
  assert(result.includes('Player is currently: Poisoned, Frightened'), 'Formats player conditions with proper case');
  assert(result.includes('[SYSTEM NOTE'), 'Includes SYSTEM NOTE prefix');
}

{
  const result = formatConditionsForAI([], { 'Elara': ['grappled', 'prone'] });
  assert(result !== null, 'Returns non-null for companion conditions');
  assert(result.includes('Elara is currently: Grappled, Prone'), 'Formats companion conditions');
}

{
  const result = formatConditionsForAI(
    ['poisoned'],
    { 'Elara': ['charmed'], 'Grimjaw': ['stunned'] }
  );
  assert(result.includes('Player is currently: Poisoned'), 'Mixed: has player conditions');
  assert(result.includes('Elara is currently: Charmed'), 'Mixed: has Elara conditions');
  assert(result.includes('Grimjaw is currently: Stunned'), 'Mixed: has Grimjaw conditions');
}

{
  const result = formatConditionsForAI([], {});
  assertEqual(result, null, 'Empty conditions returns null');
}

{
  const result = formatConditionsForAI(null, null);
  assertEqual(result, null, 'Null conditions returns null');
}

{
  const result = formatConditionsForAI([], { 'Elara': [] });
  assertEqual(result, null, 'Empty companion array returns null');
}

{
  // Exhaustion formatting
  const result = formatConditionsForAI(['exhaustion_3'], {});
  assert(result.includes('Exhaustion 3'), 'Exhaustion underscore converted to proper case');
}

// ===== Summary =====
console.log(`\n${'='.repeat(40)}`);
console.log(`Condition Tracking: ${passed} passed, ${failed} failed`);
console.log('='.repeat(40));

if (failed > 0) process.exit(1);
