/**
 * Integration regression test for code-review finding #3
 * (/claim double-awards XP/gold/loot on retry — non-idempotent, non-atomic).
 *
 * Fires two CONCURRENT POST /api/dm-session/:id/claim requests at the real
 * handler (real DB) and asserts the rewards are applied EXACTLY ONCE.
 *
 * Pre-fix: a check-then-act race (read rewards_claimed, ~90 lines, set the flag
 * LAST, bare dbRun writes) let both requests pass the guard and double-apply —
 * experience would become 200, gold 100. Post-fix: one atomic withTransaction
 * with a conditional `WHERE rewards_claimed = 0` guard applies once; the loser
 * gets a 400/conflict and no second award lands.
 *
 * No Anthropic calls happen on this path, but we still install the passthrough
 * mock so a stray probe never hits the network.
 *
 * Run: node tests/claim-idempotency.test.js
 */

import { installMockAnthropic } from './helpers/mockAnthropic.js';
import {
  startTestApp, seedCharacter, seedSession, getCharacterRow, cleanup
} from './helpers/dmTestApp.js';
import { safeParse } from '../server/utils/safeParse.js';

let passed = 0;
let failed = 0;
function check(cond, msg) {
  if (cond) { console.log(`  ✓ ${msg}`); passed++; }
  else { console.log(`  ✗ FAIL: ${msg}`); failed++; }
}

// A skip is NOT a pass: print an unmistakable banner so a green exit-0 on a
// machine without a reachable DB can never be misread as "tested".
function skipHarness(reason) {
  console.log('\n' + '!'.repeat(64));
  console.log('!! HARNESS SKIPPED — THIS TEST DID NOT RUN (this is NOT a pass)');
  console.log('!! reason: ' + reason);
  console.log('!'.repeat(64));
  console.log('\nclaim-idempotency (#3): SKIPPED (0 assertions executed)\n');
  process.exit(0);
}

const REWARDS = { xp: 100, gold: { gp: 50 }, loot: 'TEST_Sword' };

async function main() {
  const mock = installMockAnthropic();

  let app;
  const characterIds = [];
  const sessionIds = [];
  try {
    app = await startTestApp();

    const characterId = await seedCharacter({ experience: 0, gold_gp: 0, inventory: '[]', current_hp: 30, max_hp: 40 });
    characterIds.push(characterId);
    const sessionId = await seedSession(characterId, {
      status: 'completed',
      rewards: JSON.stringify(REWARDS),
      rewards_claimed: 0,
      hp_change: 0
    });
    sessionIds.push(sessionId);

    console.log('\n=== Two concurrent /claim requests ===\n');
    const [a, b] = await Promise.all([
      app.request('POST', `/api/dm-session/${sessionId}/claim`),
      app.request('POST', `/api/dm-session/${sessionId}/claim`)
    ]);
    const statuses = [a.status, b.status];
    console.log(`    [info] concurrent claim statuses: ${JSON.stringify(statuses)}`);

    const successes = statuses.filter(s => s === 200).length;
    check(successes === 1, `exactly one claim succeeds (got ${successes} successes: ${JSON.stringify(statuses)})`);
    const loser = statuses.find(s => s !== 200);
    check(loser === undefined || [400, 409, 500, 503].includes(loser),
      `the other claim is rejected, not a second success (loser status=${loser})`);

    console.log('\n=== Rewards applied exactly once ===\n');
    const ch = await getCharacterRow(characterId);
    check(ch.experience === REWARDS.xp, `experience credited once (got ${ch.experience}, expected ${REWARDS.xp})`);
    check(ch.gold_gp === REWARDS.gold.gp, `gold credited once (got ${ch.gold_gp}, expected ${REWARDS.gold.gp})`);
    const inv = safeParse(ch.inventory, []);
    const swords = inv.filter(it => it && it.name === 'TEST_Sword').length;
    check(swords === 1, `loot added exactly once (TEST_Sword count=${swords})`);

    console.log('\n=== A third claim is now a clean 400 (idempotent) ===\n');
    const third = await app.request('POST', `/api/dm-session/${sessionId}/claim`);
    check(third.status === 400, `re-claim after success returns 400 (got ${third.status})`);
    const ch2 = await getCharacterRow(characterId);
    check(ch2.experience === REWARDS.xp, `experience unchanged by the rejected re-claim (got ${ch2.experience})`);

  } catch (err) {
    // A bare connection failure (no DB) → loud skip rather than false-fail.
    if (String(err?.message || '').match(/ECONNREFUSED|fetch failed|ENOTFOUND/i)) {
      mock.uninstall();
      try { await cleanup({ characterIds, sessionIds }); } catch { /* ignore */ }
      if (app) { try { await app.close(); } catch { /* ignore */ } }
      skipHarness(`environment cannot reach the DB/app: ${err.message}`);
    }
    console.error('  ✗ FAIL: unexpected error');
    console.error('   ', err && err.stack ? err.stack : err);
    failed++;
  } finally {
    mock.uninstall();
    try { await cleanup({ characterIds, sessionIds }); } catch { /* best-effort */ }
    if (app) { try { await app.close(); } catch { /* ignore */ } }
  }

  console.log(`\n${'='.repeat(50)}`);
  console.log(`claim-idempotency (#3): ${passed} passed, ${failed} failed`);
  console.log('='.repeat(50));
  process.exit(failed === 0 ? 0 : 1);
}

main();
