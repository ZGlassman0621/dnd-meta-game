/**
 * Phase 1.1 — Halt Context Collapse
 *
 * Covers the four bounds that stop the DM system prompt growing without limit:
 *   1. getSessionSummariesForPrompt returns at most N chronicles, newest-N,
 *      still ordered oldest-first.
 *   2. calculateChronicleBudget is clamped by MAX_CHRONICLE_BUDGET.
 *   3. checkPromptSize classifies prompt sizes and never throws.
 *   4. sliceTailByTokens caps campaign_notes / character_memories at render time.
 *
 * The ordering assertion is the load-bearing one: routes/dmSession.js treats the
 * LAST element as the most recent session. A future "optimisation" that drops
 * the outer ORDER BY would make the DM recap the oldest session instead of the
 * newest, with no error anywhere.
 */

import { initDatabase, dbRun, dbAll } from '../server/database.js';
import {
  getSessionSummariesForPrompt,
  SESSION_SUMMARY_PROMPT_LIMIT,
} from '../server/services/storyChronicleService.js';
import {
  calculateChronicleBudget,
  getModelLimits,
  MAX_CHRONICLE_BUDGET,
  sliceTailByTokens,
  estimateTokens,
  MAX_NOTES_TOKENS,
  MAX_MEMORIES_TOKENS,
} from '../server/utils/contextManager.js';
import { contextWindow } from '../server/services/localModels.js';
import { checkPromptSize } from '../server/services/aiCallLogger.js';

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

// story_chronicles has FKs to campaigns/characters/dm_sessions and a NOT NULL
// UNIQUE session_id, so every chronicle needs a real parent session row.
let CAMPAIGN_ID = null;
let CHARACTER_ID = null;

async function seed() {
  const campaign = await dbRun(
    'INSERT INTO campaigns (name, setting, status) VALUES (?, ?, ?)',
    ['TEST_ContextBounds Campaign', 'Forgotten Realms', 'active']
  );
  CAMPAIGN_ID = Number(campaign.lastInsertRowid);

  const character = await dbRun(
    `INSERT INTO characters
       (name, class, race, level, current_hp, max_hp, current_location,
        experience_to_next_level, campaign_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ['TEST_ContextBounds Hero', 'Fighter', 'Human', 3, 24, 24, 'TEST_Waypoint', 900, CAMPAIGN_ID]
  );
  CHARACTER_ID = Number(character.lastInsertRowid);
}

/** Insert `count` chronicles with session_numbers 1..count, each with its own session row. */
async function seedChronicles(count) {
  await dbRun('DELETE FROM story_chronicles WHERE campaign_id = ?', [CAMPAIGN_ID]);
  for (let n = 1; n <= count; n++) {
    // dm_sessions has no campaign_id column — sessions hang off the character.
    const session = await dbRun(
      'INSERT INTO dm_sessions (character_id, status) VALUES (?, ?)',
      [CHARACTER_ID, 'completed']
    );
    await dbRun(
      `INSERT INTO story_chronicles
         (campaign_id, character_id, session_id, session_number, summary, mood, key_decisions)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [CAMPAIGN_ID, CHARACTER_ID, Number(session.lastInsertRowid), n,
       `Summary of session ${n}`, 'tense', '[]']
    );
  }
}

async function cleanup() {
  if (CAMPAIGN_ID === null) return;
  await dbRun('DELETE FROM story_chronicles WHERE campaign_id = ?', [CAMPAIGN_ID]);
  await dbRun('DELETE FROM dm_sessions WHERE character_id = ?', [CHARACTER_ID]);
  await dbRun('DELETE FROM characters WHERE campaign_id = ?', [CAMPAIGN_ID]);
  await dbRun('DELETE FROM campaigns WHERE id = ?', [CAMPAIGN_ID]);
}

async function run() {
  await initDatabase();
  await seed();

  // ============================================================
  console.log('\n=== Test 1: summary cap and ordering ===\n');
  // ============================================================

  // 25 sessions — comfortably more than the cap.
  const TOTAL = 25;
  await seedChronicles(TOTAL);

  const rows = await getSessionSummariesForPrompt(CAMPAIGN_ID, CHARACTER_ID);

  assertEqual(rows.length, SESSION_SUMMARY_PROMPT_LIMIT, 'returns exactly the cap, not all 25');
  assertEqual(rows[0].session_number, TOTAL - SESSION_SUMMARY_PROMPT_LIMIT + 1, 'first row is the oldest of the newest-N');
  assertEqual(rows[rows.length - 1].session_number, TOTAL, 'LAST row is the newest session — dmSession.js depends on this');

  const ascending = rows.every((r, i) => i === 0 || r.session_number > rows[i - 1].session_number);
  assert(ascending, 'rows are in ascending session_number order');

  const explicit = await getSessionSummariesForPrompt(CAMPAIGN_ID, CHARACTER_ID, 3);
  assertEqual(explicit.length, 3, 'explicit limit is honoured');
  assertEqual(explicit[explicit.length - 1].session_number, TOTAL, 'explicit limit still ends on the newest');

  // Fewer rows than the cap must not pad or misorder.
  await seedChronicles(2);
  const few = await getSessionSummariesForPrompt(CAMPAIGN_ID, CHARACTER_ID);
  assertEqual(few.length, 2, 'under-cap campaigns return every row');
  assertEqual(few[few.length - 1].session_number, 2, 'under-cap ordering still newest-last');

  // ============================================================
  console.log('\n=== Test 2: chronicle budget is clamped ===\n');
  // ============================================================

  // Limits come from the local model's window (OLLAMA_NUM_CTX, default
  // 65,536), not a per-model table. Read the live values rather than literals.
  const { contextWindow: window, safeBudget } = getModelLimits();
  assertEqual(window, contextWindow(), 'the context window is the one sent to Ollama (num_ctx)');
  assertEqual(safeBudget, Math.floor(window * 0.85), 'the safe budget is 85% of the window');

  // A near-empty prompt at the default window would yield ~22k without the
  // cap; the cap is what bounds it.
  const generous = calculateChronicleBudget(500, 0);
  assert(generous <= MAX_CHRONICLE_BUDGET, `budget is capped at ${MAX_CHRONICLE_BUDGET} (got ${generous})`);

  // A real DM prompt (~13k tokens, measured 2026-11-13) still leaves a
  // sizeable chronicle budget at the default window.
  const typical = calculateChronicleBudget(13000, 0);
  assert(typical > 2000 && typical <= MAX_CHRONICLE_BUDGET, `a ~13k-token prompt gets a real chronicle budget (got ${typical})`);

  // "Nearly full" is derived from the safe budget rather than hardcoded.
  const squeezed = calculateChronicleBudget(safeBudget - 1000, 0);
  assertEqual(squeezed, 2000, 'a nearly-full context falls back to the 2000 floor');

  // ============================================================
  console.log('\n=== Test 3: prompt size guard ===\n');
  // ============================================================

  // estimateTokens is chars/4, so build strings of a known token size.
  const tokensToChars = (t) => 'x'.repeat(t * 4);

  // Thresholds follow the local window: warn at half, error at three quarters
  // (32,768 / 49,152 at the default 65,536).
  const win = contextWindow();
  assertEqual(checkPromptSize(tokensToChars(1000), 'test').level, 'ok', 'small prompt is ok');
  assertEqual(checkPromptSize(tokensToChars(Math.floor(win * 0.6)), 'test').level, 'warn', 'a prompt at 60% of the window warns');
  assertEqual(checkPromptSize(tokensToChars(Math.floor(win * 0.8)), 'test').level, 'error', 'a prompt at 80% of the window errors');

  let threw = false;
  try {
    checkPromptSize(tokensToChars(500000), 'test');
  } catch {
    threw = true;
  }
  assert(!threw, 'guard never throws — instrumentation must not break gameplay');
  assertEqual(checkPromptSize('', 'test').tokens, 0, 'empty prompt is zero tokens');

  // ============================================================
  console.log('\n=== Test 4: notes/memories tail-slicing ===\n');
  // ============================================================

  // estimateTokens is chars/4, so build strings of a known token size.
  const t2c = (t) => 'x'.repeat(t * 4);

  assertEqual(sliceTailByTokens('', 100), '', 'empty string stays empty');
  assertEqual(sliceTailByTokens(null, 100), '', 'null stays empty');
  assertEqual(sliceTailByTokens(t2c(50), 100), t2c(50), 'under-budget text is returned unchanged');
  assert(!sliceTailByTokens(t2c(50), 100).includes('omitted'), 'under-budget text carries no omission marker');

  // Over budget: tail is kept, head is dropped, marker is prepended.
  const sliced = sliceTailByTokens(t2c(1000), 100);
  assert(sliced.startsWith('[earlier entries omitted'), 'truncated output carries the omission marker');
  assert(sliced.endsWith('x'.repeat(400)), 'tail is preserved to the budget');
  assert(estimateTokens(sliced) <= 150, `sliced output stays near the budget (got ${estimateTokens(sliced)} tokens)`);

  // Cut happens at a line boundary, never mid-line.
  const lines = Array.from({ length: 200 }, (_, i) => `line-${String(i).padStart(3, '0')}-` + 'y'.repeat(20)).join('\n');
  const slicedLines = sliceTailByTokens(lines, 100);
  const firstContentLine = slicedLines.slice(slicedLines.indexOf('\n') + 1).split('\n')[0];
  assert(/^line-\d{3}-y+$/.test(firstContentLine), `slice starts at a full line boundary (got "${firstContentLine.slice(0, 30)}\u2026")`);

  // Realistic shape: session-delimited notes keep the newest session.
  const notes = '--- Session: One ---\n' + 'a'.repeat(4000) + '\n--- Session: Two ---\n' + 'b'.repeat(4000);
  const slicedNotes = sliceTailByTokens(notes, 1100);
  assert(slicedNotes.includes('Session: Two'), 'newest session section survives the slice');
  assert(!slicedNotes.includes('Session: One'), 'oldest session section is dropped');

  // The render-time caps exist and are sane.
  assertEqual(MAX_NOTES_TOKENS, 4000, 'notes cap is 4000 tokens');
  assertEqual(MAX_MEMORIES_TOKENS, 2000, 'memories cap is 2000 tokens');

  // ============================================================
  console.log('\n=== Cleanup ===\n');
  // ============================================================
  await cleanup();
  const left = await dbAll('SELECT id FROM story_chronicles WHERE campaign_id = ?', [CAMPAIGN_ID]);
  assertEqual(left.length, 0, 'test chronicles removed');

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
  if (failed > 0) process.exit(1);
}

await run();
