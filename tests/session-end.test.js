/**
 * Session-End Flow tests.
 *
 * Verifies endSession(): all stages in order, idempotency, downtime opt-in,
 * skip phrases, PC protection. Domain/digest are stubs.
 *
 * Run: npm test session-end — NEVER bare `node` (writes to live DB).
 */

import { initDatabase, dbRun, dbGet } from '../server/database.js';
import { endSession, getEndStatus } from '../server/services/sessionEndService.js';
import { isSkipResponse, promptDowntimeOptIn, parseDowntimeAssignments, scheduleDowntime } from '../server/services/downtimeService.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) { console.log(`  ✓ ${message}`); passed++; }
  else { console.error(`  ✗ ${message}`); failed++; }
}

function assertEqual(actual, expected, message) {
  if (actual === expected) { console.log(`  ✓ ${message}`); passed++; }
  else { console.error(`  ✗ ${message} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`); failed++; }
}

async function fakeScorer(prompt) {
  return JSON.stringify({
    combat: { opportunity: true, score: 7 },
    exploration: { opportunity: true, score: 5 },
    quests: { opportunity: false, score: null },
    discovery: { opportunity: true, score: 8 },
    social: { opportunity: true, score: 6 },
  });
}

const SID1 = 'TEST_session_end_1';
const SID2 = 'TEST_session_end_2';

async function ensureTables() {
  await dbRun(`CREATE TABLE IF NOT EXISTS session_end_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT, session_id TEXT NOT NULL, stage TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'started', detail_json TEXT,
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP, completed_at DATETIME,
    UNIQUE(session_id, stage))`);
  await dbRun(`CREATE TABLE IF NOT EXISTS characters (
    id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, level INTEGER DEFAULT 1,
    experience INTEGER DEFAULT 0, experience_to_next_level INTEGER, level_up_pending_choices TEXT)`);
}

async function cleanup() {
  await dbRun(`DELETE FROM session_end_runs WHERE session_id LIKE 'TEST_%'`);
  await dbRun(`DELETE FROM entity_schedule WHERE entity_name LIKE 'TEST_%'`);
  await dbRun(`DELETE FROM characters WHERE name LIKE 'TEST_%'`);
}

async function main() {
  try {
    await initDatabase();
    await ensureTables();
    await cleanup();
    const c = await dbRun(`INSERT INTO characters (name, class, level, current_hp, max_hp, current_location, experience, experience_to_next_level) VALUES ('TEST_XP Hero', 'Fighter', 5, 40, 40, 'TEST_Town', 0, 7500)`);
    const characterId = Number(c.lastInsertRowid);

    console.log('\n=== Test 1: endSession runs all stages in order ===\n');
    {
      const result = await endSession(SID1, {
        characterId, campaignId: 1,
        sessionData: { narrative: 'The party fought goblins and talked to the mayor.', characterLevel: 5 },
        llmCall: fakeScorer, downtimeChoice: { path: 'clean' },
      });
      assert(result.xp.status === 'complete', 'XP stage completes');
      assert(result.xp.xpAwarded > 0, `XP awarded (${result.xp.xpAwarded})`);
      assertEqual(result.downtime.path, 'clean', 'Downtime path is clean');
      assertEqual(result.domains.stub, true, 'Domains stage is stub');
      assertEqual(result.digest.stub, true, 'Digest stage is stub');
      assert(result.sweep.status === 'complete' || result.sweep.status === 'failed', 'Sweep stage ran');
      const char = await dbGet(`SELECT experience FROM characters WHERE id = ?`, [characterId]);
      assertEqual(char.experience, result.xp.xpAwarded, 'Character XP matches award');
    }

    console.log('\n=== Test 2: Idempotency ===\n');
    {
      const before = await dbGet(`SELECT experience FROM characters WHERE id = ?`, [characterId]);
      const result2 = await endSession(SID1, {
        characterId, campaignId: 1,
        sessionData: { narrative: 'x', characterLevel: 5 },
        llmCall: fakeScorer, downtimeChoice: { path: 'clean' },
      });
      const after = await dbGet(`SELECT experience FROM characters WHERE id = ?`, [characterId]);
      assertEqual(result2.xp.skipped, true, 'XP stage skipped on re-run');
      assertEqual(after.experience, before.experience, 'No double XP on re-run');
      const status = await getEndStatus(SID1);
      assertEqual(status.xp, 'complete', 'getEndStatus: xp complete');
      assertEqual(status.sweep, 'complete', 'getEndStatus: sweep complete');
    }

    console.log('\n=== Test 3: Downtime opt-in prompt ===\n');
    {
      const prompt = promptDowntimeOptIn('Sean');
      assert(prompt.includes('Sean'), 'Prompt names the steward');
      assert(prompt.includes("What should everyone be doing while you're away?"), 'Has the steward question');
      assert(prompt.includes("I'll be right back"), 'Mentions the skip phrase');
      assert(promptDowntimeOptIn(null).includes('Your steward'), 'Falls back to generic steward');
    }

    console.log('\n=== Test 4: Skip phrases ===\n');
    {
      assert(isSkipResponse("I'll be right back") === true, '"I\'ll be right back" skips');
      assert(isSkipResponse('just a short break') === true, '"just a short break" skips');
      assert(isSkipResponse('Sean, fortify the walls for 30 days') === false, 'Real assignment does not skip');
      assert(isSkipResponse('') === true, 'Empty = clean end');
      assert(isSkipResponse(null) === true, 'Null = clean end');
    }

    console.log('\n=== Test 5: Downtime parsing + PC protection ===\n');
    {
      const roster = [
        { id: 101, name: 'TEST_Lyra', type: 'companion' },
        { id: 102, name: 'TEST_Sean', type: 'companion' },
      ];
      const assignments = parseDowntimeAssignments(
        'TEST_Lyra should scout the northern woods. TEST_Sean will spend the month training the troops.',
        roster, 30, 1);
      assertEqual(assignments.length, 2, 'Two assignments parsed');
      assertEqual(assignments[0].activity, 'scouting', 'Lyra → scouting');
      assertEqual(assignments[1].activity, 'training', 'Sean → training');
      const { scheduled, protectEntityIds } = await scheduleDowntime(assignments, characterId);
      assertEqual(scheduled, 2, 'Two schedule rows written');
      assert(protectEntityIds.includes(characterId), 'PC is in the protect list');
      const row = await dbGet(`SELECT details_json FROM entity_schedule WHERE entity_name = 'TEST_Lyra' ORDER BY id DESC LIMIT 1`);
      const details = JSON.parse(row.details_json);
      assert(details.protect_entity_ids.includes(characterId), 'Protect list persisted in details_json');
      assertEqual(details.downtime, true, 'Marked as downtime assignment');
    }

    console.log('\n=== Test 6: Short skip ===\n');
    {
      const result = await endSession(SID2, {
        characterId, campaignId: 1, llmCall: null,
        downtimeChoice: { path: 'short', days: 2 },
      });
      assertEqual(result.xp.status, 'pending_llm', 'No scorer → pending_llm (not blocked)');
      assertEqual(result.downtime.path, 'short', 'Short-skip path taken');
      assertEqual(result.downtime.daysAdvanced, 2, 'Clock advanced 2 days');
    }

    console.log(`\n${passed} passed, ${failed} failed\n`);
  } catch (error) {
    console.error('Test suite error:', error);
    failed++;
  } finally {
    await cleanup();
    console.log('='.repeat(50));
    console.log(`Session End: ${passed} passed, ${failed} failed`);
    console.log('='.repeat(50));
    process.exit(failed > 0 ? 1 : 0);
  }
}

main();
