/**
 * Tests for server/utils/llmJson.js — the shared LLM JSON extractor that
 * replaces the ad-hoc parsers across services. These guard the cases
 * that actually show up in production: multi-block Opus responses, code
 * fences, braces inside string values, and trailing commas.
 */

import assert from 'node:assert/strict';
import { extractLLMJson, tryExtractLLMJson } from '../server/utils/llmJson.js';

let passed = 0;
let failed = 0;
function test(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); passed++; }
  catch (err) { console.log(`  ✗ FAIL: ${name}`); console.log(`    ${err.message}`); failed++; }
}

console.log('\n=== extractLLMJson: happy paths ===\n');

test('Plain object', () => {
  assert.deepEqual(extractLLMJson('{"a": 1}'), { a: 1 });
});

test('Object with nested structure', () => {
  const raw = '{"a": 1, "b": {"c": [1,2,3], "d": "hi"}}';
  assert.deepEqual(extractLLMJson(raw), { a: 1, b: { c: [1, 2, 3], d: 'hi' } });
});

test('Whitespace around JSON', () => {
  assert.deepEqual(extractLLMJson('   \n{"a": 1}\n  '), { a: 1 });
});

test('Strips ```json fences', () => {
  assert.deepEqual(extractLLMJson('```json\n{"a": 1}\n```'), { a: 1 });
});

test('Strips bare ``` fences', () => {
  assert.deepEqual(extractLLMJson('```\n{"a": 1}\n```'), { a: 1 });
});

test('Accepts preamble prose', () => {
  const raw = 'Here is the result:\n\n{"a": 1}';
  assert.deepEqual(extractLLMJson(raw), { a: 1 });
});

console.log('\n=== extractLLMJson: brace-in-string safety ===\n');

test('Closing brace inside a string does not end the object', () => {
  const raw = '{"note": "this } is inside"}';
  assert.deepEqual(extractLLMJson(raw), { note: 'this } is inside' });
});

test('Escaped quote inside a string handled', () => {
  const raw = '{"note": "she said \\"hi\\""}';
  assert.deepEqual(extractLLMJson(raw), { note: 'she said "hi"' });
});

test('Brackets inside strings do not confuse array detection', () => {
  const raw = '[{"note": "contains ] and ] more"}]';
  assert.deepEqual(extractLLMJson(raw, { expect: 'array' }), [{ note: 'contains ] and ] more' }]);
});

console.log('\n=== extractLLMJson: multi-block merge (the original bug) ===\n');

test('Two sequential objects are shallow-merged', () => {
  // This is the exact failure mode that broke arc-plan generation —
  // Opus emitted tone_reflection separately from the main body.
  const raw = '{"tone_reflection": "hopeful"}\n{"home_world": {"description": "a place"}}';
  assert.deepEqual(extractLLMJson(raw), {
    tone_reflection: 'hopeful',
    home_world: { description: 'a place' }
  });
});

test('Three objects merge in order, later keys override', () => {
  const raw = '{"a": 1}\n{"b": 2}\n{"a": 99}';
  assert.deepEqual(extractLLMJson(raw), { a: 99, b: 2 });
});

test('merge=false returns the first object only', () => {
  const raw = '{"a": 1}\n{"b": 2}';
  assert.deepEqual(extractLLMJson(raw, { merge: false }), { a: 1 });
});

console.log('\n=== extractLLMJson: trailing commas ===\n');

test('Trailing comma before } is repaired', () => {
  assert.deepEqual(extractLLMJson('{"a": 1,}'), { a: 1 });
});

test('Trailing comma before ] is repaired', () => {
  assert.deepEqual(extractLLMJson('{"xs": [1,2,3,]}'), { xs: [1, 2, 3] });
});

test('repair=false preserves the comma and throws', () => {
  assert.throws(() => extractLLMJson('{"a": 1,}', { repair: false }));
});

console.log('\n=== extractLLMJson: array mode ===\n');

test('Plain array', () => {
  assert.deepEqual(extractLLMJson('[1,2,3]', { expect: 'array' }), [1, 2, 3]);
});

test('Array of objects', () => {
  const raw = '[{"a":1},{"a":2}]';
  assert.deepEqual(extractLLMJson(raw, { expect: 'array' }), [{ a: 1 }, { a: 2 }]);
});

test('Array with preamble', () => {
  assert.deepEqual(extractLLMJson('Result:\n[1,2]', { expect: 'array' }), [1, 2]);
});

console.log('\n=== extractLLMJson: error cases ===\n');

test('Empty string throws', () => {
  assert.throws(() => extractLLMJson(''), /Empty or non-string/);
});

test('Null throws', () => {
  assert.throws(() => extractLLMJson(null), /Empty or non-string/);
});

test('No object throws with helpful message', () => {
  assert.throws(() => extractLLMJson('just prose, no json here'), /No JSON object found/);
});

test('Malformed JSON throws with first-error context', () => {
  assert.throws(
    () => extractLLMJson('{not valid json at all}'),
    /No parseable JSON object/
  );
});

test('Array mode throws when no array present', () => {
  assert.throws(
    () => extractLLMJson('{"a":1}', { expect: 'array' }),
    /No JSON array found/
  );
});

console.log('\n=== tryExtractLLMJson fallback ===\n');

test('Returns fallback on parse failure', () => {
  assert.equal(tryExtractLLMJson('not json', 'fallback'), 'fallback');
});

test('Returns fallback null by default', () => {
  assert.equal(tryExtractLLMJson('not json'), null);
});

test('Returns parsed value on success', () => {
  assert.deepEqual(tryExtractLLMJson('{"a":1}', 'fallback'), { a: 1 });
});

console.log(`\n==================================================`);
console.log(`LLM JSON Extractor Tests: ${passed} passed, ${failed} failed`);
console.log(`==================================================\n`);

process.exit(failed === 0 ? 0 : 1);
