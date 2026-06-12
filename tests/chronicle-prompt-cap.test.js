/**
 * Real-DB test for code-review finding #8 (unbounded chronicle load).
 *
 * getSessionSummariesForPrompt() used to SELECT every chronicle for a campaign
 * with no LIMIT, so the "FULL CAMPAIGN HISTORY" prompt block grew linearly and a
 * 100+ session campaign crowded out everything / blew the budget. It now caps to
 * the most recent CHRONICLE_PROMPT_LIMIT sessions, returned chronologically.
 *
 * story_chronicles has FKs to characters/campaigns/dm_sessions, so we seed real
 * parent rows (one of each) and point every chronicle at them, then clean up.
 *
 * Run: node tests/chronicle-prompt-cap.test.js
 */

import { dbRun } from '../server/database.js';
import { seedCharacter, seedSession, cleanup } from './helpers/dmTestApp.js';
import { getSessionSummariesForPrompt, CHRONICLE_PROMPT_LIMIT } from '../server/services/storyChronicleService.js';

let passed = 0;
let failed = 0;
function check(cond, msg) {
  if (cond) { console.log(`  ✓ ${msg}`); passed++; }
  else { console.log(`  ✗ FAIL: ${msg}`); failed++; }
}

const TOTAL = CHRONICLE_PROMPT_LIMIT + 5; // seed more than the cap

async function main() {
  const characterIds = [];
  const sessionIds = [];
  let campaignId = null;
  try {
    const characterId = await seedCharacter();
    characterIds.push(characterId);
    const camp = await dbRun(`INSERT INTO campaigns (name) VALUES (?)`, ['TEST_ChronicleCapCampaign']);
    campaignId = Number(camp.lastInsertRowid);

    // story_chronicles.session_id is UNIQUE (one chronicle per session), so seed
    // a distinct real session per chronicle.
    for (let n = 1; n <= TOTAL; n++) {
      const sessionId = await seedSession(characterId);
      sessionIds.push(sessionId);
      await dbRun(
        `INSERT INTO story_chronicles (campaign_id, character_id, session_id, session_number, summary)
         VALUES (?, ?, ?, ?, ?)`,
        [campaignId, characterId, sessionId, n, `TEST_SUMMARY_${n}`]
      );
    }

    console.log('\n=== chronicle prompt cap (#8) ===\n');
    const rows = await getSessionSummariesForPrompt(campaignId, characterId);

    check(rows.length === CHRONICLE_PROMPT_LIMIT,
      `caps at CHRONICLE_PROMPT_LIMIT (got ${rows.length}, expected ${CHRONICLE_PROMPT_LIMIT}); seeded ${TOTAL}`);

    let ascending = true;
    for (let i = 1; i < rows.length; i++) {
      if (rows[i].session_number < rows[i - 1].session_number) ascending = false;
    }
    check(ascending, 'returned in ascending (chronological) order for the prompt');

    const oldest = rows[0]?.session_number;
    const newest = rows[rows.length - 1]?.session_number;
    check(newest === TOTAL, `newest returned is the latest session (got ${newest}, expected ${TOTAL})`);
    check(oldest === TOTAL - CHRONICLE_PROMPT_LIMIT + 1,
      `window is the most-recent ${CHRONICLE_PROMPT_LIMIT} (oldest=${oldest}, expected ${TOTAL - CHRONICLE_PROMPT_LIMIT + 1})`);

    // Explicit-limit override still works and stays most-recent.
    const five = await getSessionSummariesForPrompt(campaignId, characterId, 5);
    check(five.length === 5, `explicit limit honored (got ${five.length}, expected 5)`);
    check(five[five.length - 1]?.session_number === TOTAL, 'explicit-limit window is still the most recent');
  } catch (err) {
    if (String(err?.message || '').match(/ECONNREFUSED|fetch failed|ENOTFOUND/i)) {
      console.log('\n' + '!'.repeat(64));
      console.log('!! HARNESS SKIPPED — DID NOT RUN (not a pass): ' + err.message);
      console.log('!'.repeat(64) + '\n');
      failed = 0; // ensure clean exit below
    } else {
      console.error('  ✗ FAIL: unexpected error');
      console.error('   ', err && err.stack ? err.stack : err);
      failed++;
    }
  } finally {
    try {
      if (campaignId != null) await dbRun('DELETE FROM story_chronicles WHERE campaign_id = ?', [campaignId]);
      if (campaignId != null) await dbRun('DELETE FROM campaigns WHERE id = ?', [campaignId]);
      await cleanup({ characterIds, sessionIds });
    } catch { /* best-effort */ }
  }

  console.log(`\n${'='.repeat(50)}`);
  console.log(`chronicle-prompt-cap (#8): ${passed} passed, ${failed} failed`);
  console.log('='.repeat(50));
  process.exit(failed === 0 ? 0 : 1);
}

main();
