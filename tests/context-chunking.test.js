/**
 * Unit test for contextManager.chunkMessagesByChars() — the map-phase splitter
 * behind the fix for code-review finding #2 (reactive compressor deleting the
 * MIDDLE of a long transcript before summarizing).
 *
 * The decisive property: chunking partitions the messages with NO loss and NO
 * reordering — the concatenation of all chunks, in order, equals the input. That
 * is the opposite of the old head+tail-keep / middle-delete behavior.
 *
 * Pure function, no DB/LLM. Run: node tests/context-chunking.test.js
 */

import assert from 'node:assert/strict';
import { chunkMessagesByChars } from '../server/utils/contextManager.js';

let passed = 0;
let failed = 0;
function test(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); passed++; }
  catch (err) { console.log(`  ✗ FAIL: ${name}`); console.log(`    ${err.message}`); failed++; }
}

function mkMessages(n, contentLen = 100) {
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push({ role: i % 2 === 0 ? 'user' : 'assistant', content: `M${i}_` + 'x'.repeat(contentLen) });
  }
  return out;
}

console.log('\n=== chunkMessagesByChars ===\n');

test('empty / null input → []', () => {
  assert.deepEqual(chunkMessagesByChars([], 1000), []);
  assert.deepEqual(chunkMessagesByChars(null, 1000), []);
  assert.deepEqual(chunkMessagesByChars(undefined, 1000), []);
});

test('everything under the cap → a single chunk with all messages', () => {
  const msgs = mkMessages(5, 50);
  const chunks = chunkMessagesByChars(msgs, 100000);
  assert.equal(chunks.length, 1);
  assert.equal(chunks[0].length, 5);
});

test('NO message is lost or reordered (concat of chunks === input)', () => {
  const msgs = mkMessages(50, 200); // ~50 * ~208 chars ≈ 10.4k
  const chunks = chunkMessagesByChars(msgs, 2000);
  assert.ok(chunks.length > 1, 'should split into multiple chunks');
  const flat = chunks.flat();
  assert.equal(flat.length, msgs.length, 'no message dropped (this is the #2 fix — middle preserved)');
  for (let i = 0; i < msgs.length; i++) {
    assert.equal(flat[i].content, msgs[i].content, `message ${i} preserved in order`);
  }
});

test('each chunk respects the cap (unless it is a single oversized message)', () => {
  const msgs = mkMessages(40, 300);
  const cap = 2000;
  const chunks = chunkMessagesByChars(msgs, cap);
  for (const chunk of chunks) {
    const len = chunk.reduce((sum, m) => sum + String(m.content).length + 8, 0);
    assert.ok(len <= cap || chunk.length === 1, `chunk length ${len} <= ${cap} or is a lone message`);
  }
});

test('a single message larger than the cap becomes its own chunk (never split mid-message)', () => {
  const msgs = [
    { role: 'user', content: 'small' },
    { role: 'assistant', content: 'X'.repeat(5000) }, // bigger than cap
    { role: 'user', content: 'also small' }
  ];
  const chunks = chunkMessagesByChars(msgs, 1000);
  assert.equal(chunks.flat().length, 3, 'all three messages retained');
  // The oversized message is alone in its chunk.
  const big = chunks.find(c => c.length === 1 && c[0].content.length === 5000);
  assert.ok(big, 'oversized message is isolated in its own chunk');
});

console.log(`\n${'='.repeat(50)}`);
console.log(`context-chunking (#2): ${passed} passed, ${failed} failed`);
console.log('='.repeat(50));
process.exit(failed === 0 ? 0 : 1);
