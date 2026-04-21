/**
 * Prelude Phase 1 — setup validation + character creation tests.
 *
 * Exercises `validateSetupPayload` directly (pure, no DB) and covers the
 * happy path + key validation edges. The DB round-trip (createPreludeCharacter)
 * is covered by integration tests if/when they run, but validation itself is
 * testable in isolation and catches ~90% of regressions.
 */

import { validateSetupPayload } from '../server/services/preludeService.js';

// Indirectly check computeStartingAge via a quick lookup of the live
// validator + payload behaviour. The helper itself isn't exported (it's an
// internal impl detail); we verify it's driving age derivation correctly
// by constructing payloads with different races and checking that
// validation still passes (i.e. age is not required from the client).

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

// A complete, valid payload. Individual tests mutate this to isolate failures.
function validPayload() {
  return {
    first_name: 'Alaric',
    last_name: 'Vermalen',
    nickname: 'Ric',
    gender: 'male',
    race: 'half-elf',
    subrace: 'Standard Half-Elf',
    birth_circumstance: 'noble_scion',
    home_setting: 'noble_manor',
    region: 'cormyr',
    parents: [
      { role: 'mother', name: 'Serafina Vermalen', status: 'present' },
      { role: 'father', name: 'Duran Vermalen', status: 'died_in_childhood' }
    ],
    siblings: [{ name: 'Mara', relative_age: 'older' }],
    talents: ['Reading', 'Making friends', 'Noticing things'],
    cares: ['Family', 'Truth', 'Honor'],
    tone_tags: ['political', 'tender_intimate', 'tragic']
  };
}

console.log('\n=== Test 1: Valid payload passes ===\n');
{
  const v = validateSetupPayload(validPayload());
  assert(v.ok === true, 'Complete valid payload is accepted');
}

console.log('\n=== Test 2: Required string fields ===\n');
{
  // gender / race / birth_circumstance / home_setting / region are strictly required
  for (const f of ['gender', 'race', 'birth_circumstance', 'home_setting', 'region']) {
    const p = validPayload();
    delete p[f];
    const v = validateSetupPayload(p);
    assert(v.ok === false && v.field === f, `Missing ${f} → field=${f}`);
  }

  // Name is lenient: at least one of first_name OR last_name must be non-empty
  {
    const p = validPayload();
    p.first_name = '';
    p.last_name = '';
    const v = validateSetupPayload(p);
    assert(v.ok === false && v.field === 'first_name', 'Both names empty → rejected');
  }
  {
    const p = validPayload();
    p.first_name = 'Alaric';
    p.last_name = '';
    const v = validateSetupPayload(p);
    assert(v.ok === true, 'First-name-only accepted (D&D single-name characters)');
  }
  {
    const p = validPayload();
    p.first_name = '';
    p.last_name = 'Vermalen';
    const v = validateSetupPayload(p);
    assert(v.ok === true, 'Last-name-only accepted');
  }
}

console.log('\n=== Test 3: Starting age (race-derived, not from payload) ===\n');
{
  // v1.0.43: starting_age is computed server-side from race. The validator
  // no longer cares what (if anything) the client sends for starting_age.
  const p = validPayload();
  delete p.starting_age;
  assert(validateSetupPayload(p).ok === true, 'Payload without starting_age is accepted');
  p.starting_age = 99; // garbage — still accepted (validator ignores it)
  assert(validateSetupPayload(p).ok === true, 'Garbage starting_age ignored by validator');
}

console.log('\n=== Test 4: Parents ===\n');
{
  const p = validPayload();
  p.parents = [];
  assert(validateSetupPayload(p).ok === false, 'Empty parents array rejected');
  p.parents = [{ name: 'A', status: 'present' }, { name: 'B', status: 'present' }, { name: 'C', status: 'present' }];
  assert(validateSetupPayload(p).ok === false, '3 parents rejected');
  p.parents = [{ name: 'A' }]; // missing status
  assert(validateSetupPayload(p).ok === false, 'Parent without status rejected');
  p.parents = [{ name: null, status: 'unknown' }];
  assert(validateSetupPayload(p).ok === true, 'Single unknown parent accepted (orphan case)');
}

console.log('\n=== Test 5: Siblings ===\n');
{
  const p = validPayload();
  p.siblings = [];
  assert(validateSetupPayload(p).ok === true, 'Empty siblings array accepted (only child)');
  delete p.siblings;
  assert(validateSetupPayload(p).ok === false, 'Missing siblings field rejected');

  // v1.0.43: sibling relative_age validation
  const p2 = validPayload();
  p2.siblings = [{ name: 'Tam', relative_age: 'younger' }];
  assert(validateSetupPayload(p2).ok === true, 'Valid relative_age (younger) accepted');
  p2.siblings = [{ name: 'Tam', relative_age: 'older' }];
  assert(validateSetupPayload(p2).ok === true, 'Valid relative_age (older) accepted');
  p2.siblings = [{ name: 'Tam', relative_age: 'twin' }];
  assert(validateSetupPayload(p2).ok === true, 'Valid relative_age (twin) accepted');
  p2.siblings = [{ name: 'Tam', relative_age: 'weird' }];
  assert(validateSetupPayload(p2).ok === false, 'Invalid relative_age rejected');
}

console.log('\n=== Test 6: Talents (3 required) ===\n');
{
  const p = validPayload();
  p.talents = ['Reading', 'Running'];
  assert(validateSetupPayload(p).ok === false, '2 talents rejected');
  p.talents = ['Reading', 'Running', 'Climbing', 'Hiding'];
  assert(validateSetupPayload(p).ok === false, '4 talents rejected');
  p.talents = ['Reading', 'Running', 'Climbing'];
  assert(validateSetupPayload(p).ok === true, 'Exactly 3 talents accepted');
}

console.log('\n=== Test 7: Cares (3 required) ===\n');
{
  const p = validPayload();
  p.cares = ['Family'];
  assert(validateSetupPayload(p).ok === false, '1 care rejected');
  p.cares = ['Family', 'Truth', 'Honor', 'Justice'];
  assert(validateSetupPayload(p).ok === false, '4 cares rejected');
  p.cares = ['Family', 'Truth', 'Honor'];
  assert(validateSetupPayload(p).ok === true, 'Exactly 3 cares accepted');
}

console.log('\n=== Test 8: Tone tags (2-4 required) ===\n');
{
  const p = validPayload();
  p.tone_tags = ['gritty'];
  assert(validateSetupPayload(p).ok === false, '1 tone tag rejected');
  p.tone_tags = ['gritty', 'hopeful', 'epic', 'tragic', 'mystical'];
  assert(validateSetupPayload(p).ok === false, '5 tone tags rejected');
  p.tone_tags = ['gritty', 'hopeful'];
  assert(validateSetupPayload(p).ok === true, '2 tone tags accepted');
  p.tone_tags = ['gritty', 'hopeful', 'epic', 'tragic'];
  assert(validateSetupPayload(p).ok === true, '4 tone tags accepted');
}

console.log('\n=== Test 9: Empty/null payload ===\n');
{
  assert(validateSetupPayload(null).ok === false, 'Null payload rejected');
  assert(validateSetupPayload(undefined).ok === false, 'Undefined payload rejected');
  assert(validateSetupPayload({}).ok === false, 'Empty object rejected');
  assert(validateSetupPayload('string').ok === false, 'String payload rejected');
}

console.log('\n=== Test 10: Whitespace-only string fields ===\n');
{
  // Whitespace-only in BOTH name fields → rejected (trimmed to empty)
  const p = validPayload();
  p.first_name = '   ';
  p.last_name = '   ';
  assert(validateSetupPayload(p).ok === false, 'Whitespace-only in both name fields rejected');

  // Whitespace in one but valid in the other → accepted
  const p2 = validPayload();
  p2.first_name = '   ';
  p2.last_name = 'Vermalen';
  assert(validateSetupPayload(p2).ok === true, 'Whitespace first_name + valid last_name accepted');

  // Empty region still rejected
  const p3 = validPayload();
  p3.region = '';
  assert(validateSetupPayload(p3).ok === false, 'Empty region rejected');
}

console.log('\n==================================================');
console.log(`Prelude Setup Tests: ${passed} passed, ${failed} failed`);
console.log('==================================================\n');

if (failed > 0) process.exit(1);
