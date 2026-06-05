/**
 * Prelude setup validation + character creation tests.
 *
 * Exercises `validateSetupPayload` directly (pure, no DB) and covers the
 * happy path + key validation edges. The DB round-trip (createPreludeCharacter)
 * is covered by integration tests if/when they run, but validation itself is
 * testable in isolation and catches ~90% of regressions.
 *
 * Phase 2 rewrite: Q9 (talents), Q10 (cares), Q11 (tone preset) tests removed;
 * Q8 (siblings as enum), Q9 (authority figure), Q10 (origin freeform), and
 * Q8/Q9 contradiction tests added. See DECISION_LOG 2026-04-30 Decision A.
 */

import { validateSetupPayload } from '../server/services/preludeService.js';

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

// A complete, valid Phase 2 payload. Individual tests mutate this to isolate failures.
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
    siblings: 'older_one',
    authority_figure: 'mentor',
    origin_freeform: null
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

console.log('\n=== Test 5: Siblings (Phase 2 — single enum value) ===\n');
{
  const p = validPayload();
  delete p.siblings;
  assert(validateSetupPayload(p).ok === false, 'Missing siblings field rejected');

  p.siblings = '';
  assert(validateSetupPayload(p).ok === false, 'Empty siblings string rejected');

  p.siblings = 'not_a_real_value';
  assert(validateSetupPayload(p).ok === false, 'Unknown siblings value rejected');

  // Legacy v1.0.73 array shape no longer accepted
  p.siblings = [{ name: 'Tam', relative_age: 'younger' }];
  assert(validateSetupPayload(p).ok === false, 'Legacy array-of-objects sibling shape rejected');

  // Each canonical enum value accepts
  for (const v of ['only_child', 'younger_one', 'younger_many', 'older_one', 'older_many', 'twin', 'mixed', 'lost_one', 'lost_many']) {
    const p2 = validPayload();
    p2.siblings = v;
    // For only_child, default authority is 'mentor' from validPayload — no contradiction
    assert(validateSetupPayload(p2).ok === true, `Sibling enum value "${v}" accepted`);
  }
}

console.log('\n=== Test 6: Authority figure (Phase 2 — required, single enum) ===\n');
{
  const p = validPayload();
  delete p.authority_figure;
  assert(validateSetupPayload(p).ok === false && validateSetupPayload(p).field === 'authority_figure', 'Missing authority_figure rejected');

  p.authority_figure = '';
  assert(validateSetupPayload(p).ok === false, 'Empty authority_figure rejected');

  p.authority_figure = 'not_a_real_value';
  assert(validateSetupPayload(p).ok === false, 'Unknown authority_figure value rejected');

  // Each canonical enum value accepts (using only_child + non-sibling combos
  // to avoid the contradiction rule)
  for (const v of ['parent', 'mentor', 'guardian', 'captor', 'employer', 'rival', 'none']) {
    const p2 = validPayload();
    p2.authority_figure = v;
    assert(validateSetupPayload(p2).ok === true, `authority_figure "${v}" accepted`);
  }
  // 'sibling' specifically — needs siblings to NOT be only_child
  {
    const p2 = validPayload();
    p2.siblings = 'older_one';
    p2.authority_figure = 'sibling';
    assert(validateSetupPayload(p2).ok === true, `authority_figure "sibling" accepted with non-only-child siblings`);
  }
}

console.log('\n=== Test 7: Q8/Q9 contradiction (only_child + sibling-as-authority) ===\n');
{
  const p = validPayload();
  p.siblings = 'only_child';
  p.authority_figure = 'sibling';
  const v = validateSetupPayload(p);
  assert(v.ok === false, 'only_child + sibling-as-authority rejected');
  assert(v.field === 'authority_figure', 'Contradiction field is authority_figure');

  // Non-contradictory combinations should pass
  p.authority_figure = 'parent';
  assert(validateSetupPayload(p).ok === true, 'only_child + parent-as-authority accepted');
  p.authority_figure = 'none';
  assert(validateSetupPayload(p).ok === true, 'only_child + no-one-as-authority accepted');
}

console.log('\n=== Test 8: origin_freeform (Phase 2 — optional, max 2000 chars) ===\n');
{
  const p = validPayload();

  // null/undefined accepted
  p.origin_freeform = null;
  assert(validateSetupPayload(p).ok === true, 'origin_freeform null accepted');
  delete p.origin_freeform;
  assert(validateSetupPayload(p).ok === true, 'origin_freeform missing accepted');

  // Empty string accepted
  p.origin_freeform = '';
  assert(validateSetupPayload(p).ok === true, 'origin_freeform empty string accepted');

  // Short text accepted
  p.origin_freeform = 'A specific origin in mind: my character was raised by ravens.';
  assert(validateSetupPayload(p).ok === true, 'Short origin_freeform accepted');

  // Exactly 2000 chars accepted
  p.origin_freeform = 'a'.repeat(2000);
  assert(validateSetupPayload(p).ok === true, '2000-char origin_freeform accepted');

  // 2001 chars rejected
  p.origin_freeform = 'a'.repeat(2001);
  const over = validateSetupPayload(p);
  assert(over.ok === false && over.field === 'origin_freeform', '2001-char origin_freeform rejected');

  // Non-string rejected when present
  p.origin_freeform = 12345;
  assert(validateSetupPayload(p).ok === false, 'Non-string origin_freeform rejected');
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

console.log('\n=== Test 11: Cut fields (talents/cares/tone_tags) are now ignored ===\n');
{
  // The Phase 2 wizard doesn't send these. The validator should NOT reject
  // a payload that omits them, and SHOULD also not require them if they
  // happen to come in (e.g., from a legacy client).
  const p = validPayload();
  // Inject cut fields with garbage — should be ignored, not rejected
  p.talents = ['anything'];
  p.cares = [];
  p.tone_tags = ['legacy_value'];
  assert(validateSetupPayload(p).ok === true, 'Legacy talents/cares/tone_tags fields ignored (not required, not rejected)');

  // Confirm omitting them entirely is fine
  const p2 = validPayload();
  delete p2.talents;
  delete p2.cares;
  delete p2.tone_tags;
  assert(validateSetupPayload(p2).ok === true, 'Payload omits talents/cares/tone_tags entirely — accepted');
}

console.log('\n==================================================');
console.log(`Prelude Setup Tests: ${passed} passed, ${failed} failed`);
console.log('==================================================\n');

if (failed > 0) process.exit(1);
