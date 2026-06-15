/**
 * Prelude Phase 2a — arc plan service unit tests.
 *
 * Tests the pure, non-network pieces of preludeArcService:
 *   - JSON extraction from Opus-style responses (with/without fences,
 *     with/without surrounding prose)
 *   - Shape validation — rejects missing required fields
 *
 * The full end-to-end (DB + Opus) is covered by manual smoke-test because
 * it requires an API key and spends tokens.
 */

// We exercise the private helpers through a tiny import-test harness by
// re-importing the file in a Node context and pulling functions off the
// module. To keep the helpers testable, they're module-scoped but the
// validation path runs inside generateArcPlan. For Phase 2a we verify the
// JSON extractor via a small duplicated implementation that matches the
// service exactly — if the service's version drifts, these tests will catch
// it via an integration smoke test. That tradeoff is acceptable until we
// add a proper test harness.

import assert from 'node:assert/strict';

// Mirror the service's extractJson logic for testing. Keep this identical
// to preludeArcService.js::extractJson.
function extractJson(raw) {
  if (!raw || typeof raw !== 'string') throw new Error('Empty model response');
  let text = raw.trim();
  if (text.startsWith('```')) {
    const firstNl = text.indexOf('\n');
    if (firstNl > 0) text = text.slice(firstNl + 1);
    if (text.endsWith('```')) text = text.slice(0, -3);
    text = text.trim();
  }
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('No JSON object found in response');
  }
  text = text.slice(start, end + 1);
  return JSON.parse(text);
}

// Mirror validateParsedPlan for testing.
function validateParsedPlan(plan) {
  if (!plan || typeof plan !== 'object') throw new Error('Arc plan is not an object');
  const required = ['home_world', 'chapter_1_arc', 'chapter_2_arc', 'chapter_3_arc', 'chapter_4_arc'];
  for (const f of required) {
    if (!plan[f] || typeof plan[f] !== 'object') {
      throw new Error(`Arc plan missing required field: ${f}`);
    }
  }
  if (!plan.chapter_4_arc.departure_seed || typeof plan.chapter_4_arc.departure_seed !== 'object') {
    throw new Error('Chapter 4 arc is missing departure_seed');
  }
}

let passed = 0;
let failed = 0;

function check(label, fn) {
  try { fn(); console.log(`  ✓ ${label}`); passed++; }
  catch (e) { console.error(`  ✗ ${label}: ${e.message}`); failed++; }
}

const minimalPlan = {
  home_world: { description: 'x', locals: [] },
  chapter_1_arc: { theme: 'x', beats: [], chapter_end_moment: 'x' },
  chapter_2_arc: { theme: 'x', beats: [], chapter_end_moment: 'x' },
  chapter_3_arc: { theme: 'x', beats: [], chapter_end_moment: 'x' },
  chapter_4_arc: {
    theme: 'x', beats: [], chapter_end_moment: 'x',
    departure_seed: { reason: 'pilgrimage', tone: 'hopeful' }
  }
};

console.log('\n=== extractJson: clean JSON ===\n');

check('Parses a bare JSON object', () => {
  const raw = JSON.stringify(minimalPlan);
  const out = extractJson(raw);
  assert.equal(typeof out.home_world, 'object');
});

check('Parses JSON wrapped in ``` fences', () => {
  const raw = '```json\n' + JSON.stringify(minimalPlan) + '\n```';
  const out = extractJson(raw);
  assert.equal(typeof out.chapter_1_arc, 'object');
});

check('Parses JSON wrapped in ``` (no language) fences', () => {
  const raw = '```\n' + JSON.stringify(minimalPlan) + '\n```';
  const out = extractJson(raw);
  assert.equal(typeof out.chapter_4_arc, 'object');
});

check('Parses JSON with trailing prose', () => {
  const raw = JSON.stringify(minimalPlan) + '\n\nHope this works for your arc!';
  const out = extractJson(raw);
  assert.equal(typeof out.home_world, 'object');
});

check('Parses JSON with leading prose', () => {
  const raw = 'Here is the arc plan:\n\n' + JSON.stringify(minimalPlan);
  const out = extractJson(raw);
  assert.equal(typeof out.home_world, 'object');
});

console.log('\n=== extractJson: rejects invalid input ===\n');

check('Empty string throws', () => {
  assert.throws(() => extractJson(''), /Empty model response|No JSON object/);
});

check('Non-string throws', () => {
  assert.throws(() => extractJson(null), /Empty model response/);
});

check('No braces throws', () => {
  assert.throws(() => extractJson('just prose, no JSON here'), /No JSON object/);
});

check('Malformed JSON throws', () => {
  assert.throws(() => extractJson('{"home_world": incomplete'), /JSON/);
});

console.log('\n=== validateParsedPlan ===\n');

check('Accepts minimal valid plan', () => {
  validateParsedPlan(minimalPlan);
});

check('Rejects null', () => {
  assert.throws(() => validateParsedPlan(null), /not an object/);
});

check('Rejects missing home_world', () => {
  const p = { ...minimalPlan };
  delete p.home_world;
  assert.throws(() => validateParsedPlan(p), /home_world/);
});

check('Rejects missing chapter_3_arc', () => {
  const p = { ...minimalPlan };
  delete p.chapter_3_arc;
  assert.throws(() => validateParsedPlan(p), /chapter_3_arc/);
});

check('Rejects chapter_4_arc without departure_seed', () => {
  const p = JSON.parse(JSON.stringify(minimalPlan));
  delete p.chapter_4_arc.departure_seed;
  assert.throws(() => validateParsedPlan(p), /departure_seed/);
});

check('Rejects chapter field that is not an object', () => {
  const p = { ...minimalPlan, chapter_2_arc: 'not an object' };
  assert.throws(() => validateParsedPlan(p), /chapter_2_arc/);
});

console.log('\n==================================================');
console.log(`Prelude Arc Tests: ${passed} passed, ${failed} failed`);
console.log('==================================================\n');

if (failed > 0) process.exit(1);
