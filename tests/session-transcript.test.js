/**
 * Tests for server/utils/sessionTranscript.js — append-only transcript that
 * survives rolling-summary compaction (migration 046).
 *
 * Uses the real DB with TEST_-prefixed sessions cleaned up at the end.
 */

import assert from 'node:assert/strict';
import { dbRun, dbGet } from '../server/database.js';
import {
  initTranscript,
  appendToTranscript,
  getTranscript,
  getTurnCount
} from '../server/utils/sessionTranscript.js';

let passed = 0;
let failed = 0;
async function test(name, fn) {
  try { await fn(); console.log(`  ✓ ${name}`); passed++; }
  catch (err) { console.log(`  ✗ FAIL: ${name}`); console.log(`    ${err.message}`); failed++; }
}

// Helper — create a minimal dm_sessions row for testing
async function createTestSession(opts = {}) {
  const { messages = '[]' } = opts;
  const result = await dbRun(
    `INSERT INTO dm_sessions (character_id, title, model, status, messages, start_time, session_config, session_type)
     VALUES (NULL, 'TEST_transcript_helper', 'sonnet', 'active', ?, datetime('now'), '{}', 'dm_mode')`,
    [messages]
  );
  return Number(result.lastInsertRowid);
}

async function deleteTestSession(sessionId) {
  await dbRun(`DELETE FROM dm_sessions WHERE id = ?`, [sessionId]);
}

console.log('\n=== sessionTranscript helpers ===\n');

await test('initTranscript with empty session writes a clean array', async () => {
  const id = await createTestSession();
  await initTranscript(id, [
    { role: 'system', content: 'system prompt — should be filtered out' },
    { role: 'assistant', content: 'opening scene' }
  ]);
  const t = await getTranscript(id);
  assert.equal(t.length, 1);
  assert.equal(t[0].role, 'assistant');
  assert.equal(t[0].content, 'opening scene');
  await deleteTestSession(id);
});

await test('appendToTranscript adds new messages', async () => {
  const id = await createTestSession();
  await initTranscript(id, [{ role: 'assistant', content: 'opening' }]);
  await appendToTranscript(id, [
    { role: 'user', content: 'I look around.' },
    { role: 'assistant', content: 'You see a tavern.' }
  ]);
  const t = await getTranscript(id);
  assert.equal(t.length, 3);
  assert.equal(t[1].content, 'I look around.');
  assert.equal(t[2].content, 'You see a tavern.');
  await deleteTestSession(id);
});

await test('appendToTranscript bootstraps from messages when transcript is null', async () => {
  // Create a session WITHOUT calling initTranscript — simulates an
  // existing pre-migration session.
  const messagesBlob = JSON.stringify([
    { role: 'system', content: 'old system prompt' },
    { role: 'user', content: 'old turn 1 user' },
    { role: 'assistant', content: 'old turn 1 assistant' },
    { role: 'user', content: 'old turn 2 user' },
    { role: 'assistant', content: 'old turn 2 assistant' }
  ]);
  const id = await createTestSession({ messages: messagesBlob });
  // Verify transcript is null going in
  const before = await dbGet(`SELECT transcript FROM dm_sessions WHERE id = ?`, [id]);
  assert.equal(before.transcript, null);
  // Append the new turn — should bootstrap from messages first
  await appendToTranscript(id, [
    { role: 'user', content: 'new user' },
    { role: 'assistant', content: 'new assistant' }
  ]);
  const t = await getTranscript(id);
  // Should have: 4 bootstrapped (system filtered) + 2 new = 6
  assert.equal(t.length, 6);
  assert.equal(t[0].content, 'old turn 1 user');
  assert.equal(t[5].content, 'new assistant');
  await deleteTestSession(id);
});

await test('getTurnCount counts only assistant messages', async () => {
  const id = await createTestSession();
  await initTranscript(id, [
    { role: 'assistant', content: 'opening' }
  ]);
  await appendToTranscript(id, [
    { role: 'user', content: 'turn 1 player' },
    { role: 'assistant', content: 'turn 1 ai' }
  ]);
  await appendToTranscript(id, [
    { role: 'user', content: 'turn 2 player' },
    { role: 'assistant', content: 'turn 2 ai' }
  ]);
  const count = await getTurnCount(id);
  assert.equal(count, 3); // opening + 2 turns
  await deleteTestSession(id);
});

await test('getTurnCount returns 0 for empty transcript', async () => {
  const id = await createTestSession();
  const count = await getTurnCount(id);
  assert.equal(count, 0);
  await deleteTestSession(id);
});

await test('Append survives rolling-summary compaction simulation', async () => {
  // Simulate the failure mode: messages blob gets compacted by rolling
  // summary, but transcript should still grow with full history.
  const id = await createTestSession();
  await initTranscript(id, [{ role: 'assistant', content: 'opening' }]);
  // Append 5 turns
  for (let i = 1; i <= 5; i++) {
    await appendToTranscript(id, [
      { role: 'user', content: `user turn ${i}` },
      { role: 'assistant', content: `assistant turn ${i}` }
    ]);
  }
  // Simulate rolling-summary compaction: the messages blob shrinks to
  // [system, summary, recent_tail...] but transcript should be unaffected.
  await dbRun(
    `UPDATE dm_sessions SET messages = ? WHERE id = ?`,
    [JSON.stringify([
      { role: 'system', content: 'sys' },
      { role: 'user', content: '[SUMMARY] earlier scenes...' },
      { role: 'assistant', content: 'recent assistant' }
    ]), id]
  );
  // Append one more turn — transcript should still grow on top of all history
  await appendToTranscript(id, [
    { role: 'user', content: 'post-compaction user' },
    { role: 'assistant', content: 'post-compaction assistant' }
  ]);
  const t = await getTranscript(id);
  // Should have: opening + 5 turn pairs + 1 post-compaction pair = 1 + 10 + 2 = 13
  assert.equal(t.length, 13);
  // First message should still be the opening
  assert.equal(t[0].content, 'opening');
  // Last should be post-compaction
  assert.equal(t[12].content, 'post-compaction assistant');
  // Turn count should be 7 (1 opening + 5 mid + 1 post)
  assert.equal(await getTurnCount(id), 7);
  await deleteTestSession(id);
});

await test('appendToTranscript no-ops on empty/missing arrays', async () => {
  const id = await createTestSession();
  await initTranscript(id, [{ role: 'assistant', content: 'opening' }]);
  await appendToTranscript(id, []);
  await appendToTranscript(id, null);
  const t = await getTranscript(id);
  assert.equal(t.length, 1);
  await deleteTestSession(id);
});

await test('appendToTranscript filters system messages from new pair', async () => {
  const id = await createTestSession();
  await initTranscript(id, [{ role: 'assistant', content: 'opening' }]);
  await appendToTranscript(id, [
    { role: 'system', content: 'should be filtered' },
    { role: 'user', content: 'kept user' },
    { role: 'assistant', content: 'kept assistant' }
  ]);
  const t = await getTranscript(id);
  assert.equal(t.length, 3);
  assert.equal(t.filter(m => m.role === 'system').length, 0);
  await deleteTestSession(id);
});

console.log('\n==================================================');
console.log(`Session Transcript Tests: ${passed} passed, ${failed} failed`);
console.log('==================================================\n');
process.exit(failed === 0 ? 0 : 1);
