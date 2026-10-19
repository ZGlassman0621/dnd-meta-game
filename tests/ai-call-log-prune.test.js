/**
 * ai_call_log retention (P1-D).
 *
 * The log stores full prompts + full conversation history per call and grows
 * quadratically within a session. pruneAiCallLog NULLs the bulky TEXT content
 * for rows older than the retention window while keeping every row's signal
 * columns (timing, tokens, model, purpose, markers) and stamping archived_at.
 *
 * Covers: old rows pruned, signal columns preserved, recent rows untouched,
 * idempotency (archived rows skipped), and the 0-day disable switch.
 */

import { initDatabase, dbRun, dbGet } from '../server/database.js';
import { pruneAiCallLog } from '../server/services/aiCallLogger.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${message}`);
  } else {
    failed++;
    console.log(`  ✗ ${message}`);
  }
}

function assertEqual(actual, expected, message) {
  assert(actual === expected, `${message} (got ${actual})`);
}

async function seedRow(daysAgo, label) {
  const r = await dbRun(
    `INSERT INTO ai_call_log
       (call_purpose, model_id, input_tokens, output_tokens, latency_ms,
        system_prompt, user_message, conversation_history, response_text,
        prompt_sections, markers_detected, response_status,
        request_started_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
             datetime('now', '-' || ? || ' days'))`,
    [`TEST_prune_${label}`, 'test-model', 100, 50, 123,
     'system prompt content', 'user message', '[]', 'response text',
     '[]', '{}', 'ok',
     daysAgo]
  );
  return { id: Number(r.lastInsertRowid), label };
}

async function run() {
  await initDatabase();

  console.log('\n=== Test: ai_call_log pruning ===\n');

  const oldRows = [await seedRow(40, 'old1'), await seedRow(45, 'old2')];
  const recent = await seedRow(5, 'recent');

  const pruned = await pruneAiCallLog(30);
  assertEqual(pruned, 2, 'prunes exactly the 2 old rows');

  for (const { id, label } of oldRows) {
    const row = await dbGet('SELECT * FROM ai_call_log WHERE id = ?', [id]);
    assertEqual(row.system_prompt, null, `old row ${label}: system_prompt nulled`);
    assertEqual(row.user_message, null, `old row ${label}: user_message nulled`);
    assertEqual(row.conversation_history, null, `old row ${label}: conversation_history nulled`);
    assertEqual(row.response_text, null, `old row ${label}: response_text nulled`);
    assertEqual(row.prompt_sections, null, `old row ${label}: prompt_sections nulled`);
    assert(row.archived_at !== null, `old row ${label}: archived_at stamped`);
    // Signal columns survive the prune.
    assertEqual(row.model_id, 'test-model', `old row ${label}: model_id preserved`);
    assertEqual(row.input_tokens, 100, `old row ${label}: input_tokens preserved`);
    assertEqual(row.call_purpose, `TEST_prune_${label}`, `old row ${label}: call_purpose preserved`);
  }

  const fresh = await dbGet('SELECT * FROM ai_call_log WHERE id = ?', [recent.id]);
  assertEqual(fresh.system_prompt, 'system prompt content', 'recent row: content untouched');
  assertEqual(fresh.archived_at, null, 'recent row: not archived');

  // Idempotent: already-archived rows are skipped on the second run.
  assertEqual(await pruneAiCallLog(30), 0, 'second prune is a no-op');

  // 0 disables pruning entirely.
  assertEqual(await pruneAiCallLog(0), 0, 'retention 0 disables pruning');

  // Cleanup.
  await dbRun(`DELETE FROM ai_call_log WHERE call_purpose LIKE 'TEST_prune_%'`);
  const left = await dbGet(`SELECT COUNT(*) AS n FROM ai_call_log WHERE call_purpose LIKE 'TEST_prune_%'`);
  assertEqual(left.n, 0, 'test rows removed');

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
  if (failed > 0) process.exit(1);
}

await run();
