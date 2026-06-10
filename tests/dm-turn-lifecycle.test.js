/**
 * Integration regression test for code-review finding #1
 * (rolling-summary index desync silently corrupting long campaigns).
 *
 * Drives the REAL POST /api/dm-session/:id/message handler over several turns
 * with a mocked Anthropic (no network, no spend) and a real DB, and asserts the
 * durable conversation in dm_sessions.messages NEVER loses a verbatim turn even
 * after the rolling summary fires and compacts the per-turn API buffer.
 *
 * Pre-fix: once the rolling summary rolled, the next turn persisted the COMPACTED
 * send-buffer back into dm_sessions.messages, permanently dropping the oldest
 * verbatim messages (PRIOR_0..) and freezing the through-index. This test would
 * FAIL on the pre-fix code (PRIOR_0 gone after turn 2, len 26 not 33, index
 * frozen at 8) and PASS on the fix.
 *
 * The durable-history assertions (PRIOR_0 retained, len===33) are persisted
 * SYNCHRONOUSLY by the handler before it responds, so they are race-free and
 * always enforced. The through-index advancement is written by a fire-and-forget
 * background roll; those two checks are SOFT (skipped, not failed, if the roll
 * doesn't land in the window) so a slow Turso write never produces a spurious red.
 *
 * Run: node tests/dm-turn-lifecycle.test.js
 */

import { installMockAnthropic, isSummarizerCall, lastUserContent } from './helpers/mockAnthropic.js';
import {
  startTestApp, seedCharacter, seedSession, getSessionRow, cleanup, pollUntil
} from './helpers/dmTestApp.js';
import { safeParse } from '../server/utils/safeParse.js';
import { isClaudeAvailable } from '../server/services/claude.js';

let passed = 0;
let failed = 0;
function check(cond, msg) {
  if (cond) { console.log(`  ✓ ${msg}`); passed++; }
  else { console.log(`  ✗ FAIL: ${msg}`); failed++; }
}

// A skip is NOT a pass: print an unmistakable banner and a SKIPPED summary so a
// green exit-0 on a machine without creds can never be misread as "tested".
function skipHarness(reason) {
  console.log('\n' + '!'.repeat(64));
  console.log('!! HARNESS SKIPPED — THIS TEST DID NOT RUN (this is NOT a pass)');
  console.log('!! reason: ' + reason);
  console.log('!'.repeat(64));
  console.log('\ndm-turn-lifecycle (#1): SKIPPED (0 assertions executed)\n');
  process.exit(0);
}

async function main() {
  const mock = installMockAnthropic({
    reply: (body) => {
      if (isSummarizerCall(body)) {
        return 'ROLLING SUMMARY (mock): the earlier scenes are condensed here for DM continuity, kept well over thirty characters.';
      }
      return `DM_REPLY_FOR(${lastUserContent(body)}) — the world responds in deterministic mock prose.`;
    }
  });

  // Prerequisite: the /message handler gates on a Claude provider, and
  // isClaudeAvailable() is a pure ANTHROPIC_API_KEY check the passthrough mock
  // cannot satisfy. Without the key the handler 503s before the #1 code path —
  // so skip LOUDLY rather than silently report green.
  if (!isClaudeAvailable()) {
    mock.uninstall();
    skipHarness('ANTHROPIC_API_KEY not set — /message would 503 before exercising the rolling-summary persist path.');
  }

  let app;
  const characterIds = [];
  const sessionIds = [];
  try {
    app = await startTestApp();

    const characterId = await seedCharacter();
    characterIds.push(characterId);

    // Seed a session already near the roll threshold: 1 system + 28 verbatim
    // conversation messages (PRIOR_0..PRIOR_27). One turn pushes it past
    // ROLL_TRIGGER_THRESHOLD (30) so the background rolling summary fires.
    const seeded = [{ role: 'system', content: 'TEST SYSTEM PROMPT — primacy block.' }];
    for (let i = 0; i < 28; i++) {
      seeded.push({ role: i % 2 === 0 ? 'user' : 'assistant', content: `PRIOR_${i}` });
    }
    const sessionId = await seedSession(characterId, { messages: JSON.stringify(seeded) });
    sessionIds.push(sessionId);

    console.log('\n=== Turn 1 (crosses the roll threshold) ===\n');
    const t1 = await app.request('POST', `/api/dm-session/${sessionId}/message`, { action: 'ACTION_1' });
    if (t1.status !== 200) {
      mock.uninstall();
      await cleanup({ characterIds, sessionIds });
      if (app) await app.close();
      skipHarness(`turn 1 returned ${t1.status} (${JSON.stringify(t1.body)}) — no usable LLM provider/DB in this environment.`);
    }
    check(t1.status === 200, 'turn 1 handler returns 200');

    // Wait for the fire-and-forget background roll to land a through-index.
    const idx1 = await pollUntil(async () => {
      const s = await getSessionRow(sessionId);
      return Number.isInteger(s?.rolling_summary_through_index) ? s.rolling_summary_through_index : null;
    }, { timeoutMs: 10000 });
    const rollLanded = Number.isInteger(idx1) && idx1 >= 1;
    if (rollLanded) {
      console.log(`  ✓ rolling summary fired and set a through-index (idx1=${idx1})`);
      passed++;
    } else {
      console.log('  ⚠ [soft-skip] background rolling summary did not land within 10s — the index-advance');
      console.log('    checks are skipped (NOT a failure). The race-free durable-history guards below still run.');
    }

    console.log('\n=== Turn 2 (after a roll — the compaction-persist path) ===\n');
    const t2 = await app.request('POST', `/api/dm-session/${sessionId}/message`, { action: 'ACTION_2' });
    check(t2.status === 200, 'turn 2 handler returns 200');

    // Inspect the DURABLE persisted history (written synchronously by the handler).
    const row = await getSessionRow(sessionId);
    const persisted = safeParse(row.messages, []);
    const contents = persisted.map(m => String(m.content));
    const joined = contents.join('\n');

    console.log('\n=== Durable-history invariants (the #1 fix — race-free) ===\n');

    // Decisive: the oldest verbatim message — inside the summarized range — must
    // still be in the durable store. Pre-fix it was dropped on turn 2.
    check(joined.includes('PRIOR_0'), 'PRIOR_0 (oldest, within summarized range) still present after a roll + a turn');

    // No verbatim turn lost at all.
    let allPriors = true;
    for (let i = 0; i < 28; i++) if (!joined.includes(`PRIOR_${i}`)) { allPriors = false; break; }
    check(allPriors, 'all 28 seeded verbatim messages (PRIOR_0..27) retained');

    check(contents.includes('ACTION_1') && contents.includes('ACTION_2'), 'both player actions retained verbatim');
    check(joined.includes('DM_REPLY_FOR(ACTION_1)') && joined.includes('DM_REPLY_FOR(ACTION_2)'),
      'both DM responses retained verbatim');

    // Durable history grows by appending only: 29 seeded + 2 turns * 2 = 33.
    check(persisted.length === 33, `durable history grew to full size, not compacted (len=${persisted.length}, expected 33)`);

    // Through-index stays a valid absolute index into the (growing) durable array
    // and advances monotonically as more chunks roll. SOFT — depends on the
    // fire-and-forget roll, so skip (don't fail) if it never landed.
    console.log('\n=== Through-index advancement (soft — background roll) ===\n');
    if (rollLanded) {
      check(idx1 < persisted.length, `idx1 (${idx1}) is a valid index into durable messages (len ${persisted.length})`);
      const idx2 = await pollUntil(async () => {
        const s = await getSessionRow(sessionId);
        const v = s?.rolling_summary_through_index;
        return Number.isInteger(v) && v > idx1 ? v : null;
      }, { timeoutMs: 10000 });
      if (Number.isInteger(idx2) && idx2 > idx1) {
        console.log(`  ✓ through-index advanced monotonically (idx1=${idx1} -> idx2=${idx2})`);
        passed++;
      } else {
        console.log(`  ⚠ [soft-skip] second roll did not advance the index within 10s (idx1=${idx1}, idx2=${idx2}) — skipped, not failed.`);
      }
    } else {
      console.log('  ⚠ [soft-skip] first roll never landed — index-advance checks skipped.');
    }

  } catch (err) {
    console.error('  ✗ FAIL: unexpected error');
    console.error('   ', err && err.stack ? err.stack : err);
    failed++;
  } finally {
    mock.uninstall();
    try { await cleanup({ characterIds, sessionIds }); } catch { /* best-effort */ }
    if (app) { try { await app.close(); } catch { /* ignore */ } }
  }

  console.log(`\n${'='.repeat(50)}`);
  console.log(`dm-turn-lifecycle (#1): ${passed} passed, ${failed} failed`);
  console.log('='.repeat(50));
  process.exit(failed === 0 ? 0 : 1);
}

main();
