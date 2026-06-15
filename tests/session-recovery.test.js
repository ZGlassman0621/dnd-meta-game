/**
 * Session recovery sweep tests (Phase 3 — Continuous persistence).
 *
 * Verifies sessionRecoveryService's SELECTION + IDEMPOTENCY logic, which is the
 * load-bearing contract: a session abandoned with status='active'/'paused' and a
 * non-trivial history but NO chronicle is picked up; a session that already has a
 * chronicle is left untouched; and running the sweep twice never double-writes.
 *
 * These assertions are deliberately tested WITHOUT a live Opus/Sonnet call.
 * generateSessionChronicle makes real LLM calls for the recap, which would make
 * the test flaky/unrunnable in CI. So:
 *   - findAbandonedSessions() (pure SELECT + JS count) is asserted directly.
 *   - recoverAbandonedSessions() idempotency is exercised against sessions that
 *     ALREADY have a chronicle row (we seed the chronicle ourselves), which
 *     drives the "chronicle already exists" guard path — no LLM call happens.
 *   - The end-to-end "generates a chronicle for an abandoned session" path is
 *     only run when a Claude provider is available; otherwise we assert the
 *     candidate is correctly SELECTED (the only part that can run offline) and
 *     soft-skip the live-call assertion.
 *
 * TEST_-prefixed, self-cleaning, real DB. Run: node tests/session-recovery.test.js
 */

import { initDatabase, dbRun, dbGet, dbAll } from '../server/database.js';
import {
  recoverAbandonedSessions,
  findAbandonedSessions,
  countConversationMessages,
  MIN_RECOVERABLE_MESSAGES
} from '../server/services/sessionRecoveryService.js';
import { generateSessionChronicle } from '../server/services/storyChronicleService.js';
import { isClaudeAvailable } from '../server/services/claude.js';

let passed = 0;
let failed = 0;
function check(cond, msg) {
  if (cond) { console.log(`  ✓ ${msg}`); passed++; }
  else { console.log(`  ✗ FAIL: ${msg}`); failed++; }
}

// --- seed helpers (TEST_-prefixed, tracked for cleanup) -------------------

const characterIds = [];
const sessionIds = [];
const campaignIds = [];

async function seedCampaign() {
  const r = await dbRun(
    `INSERT INTO campaigns (name, description, setting, tone, starting_location, status)
     VALUES (?, ?, ?, ?, ?, ?)`,
    ['TEST_Recovery_Campaign', 'TEST recovery campaign', 'Forgotten Realms', 'heroic', 'TEST_Recovery_Town', 'active']
  );
  const id = Number(r.lastInsertRowid);
  campaignIds.push(id);
  return id;
}

async function seedCharacter(campaignId) {
  const r = await dbRun(
    `INSERT INTO characters
       (name, class, level, current_hp, max_hp, current_location,
        experience_to_next_level, experience, gold_cp, gold_sp, gold_gp,
        inventory, campaign_id, game_day)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ['TEST_RecoveryHero', 'Fighter', 5, 40, 40, 'TEST_Recovery_Town',
     14000, 0, 0, 0, 0,
     '[]', campaignId ?? null, 7]
  );
  const id = Number(r.lastInsertRowid);
  characterIds.push(id);
  return id;
}

function buildMessages(conversationCount, withSystem = true) {
  const out = [];
  if (withSystem) out.push({ role: 'system', content: 'TEST SYSTEM PROMPT' });
  for (let i = 0; i < conversationCount; i++) {
    out.push({
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: `TEST_RECOVERY message ${i} — the party did a thing worth remembering.`
    });
  }
  return out;
}

async function seedSession(characterId, { status = 'active', conversationCount = 6 } = {}) {
  // NOTE: campaign_id lives on the CHARACTER, not dm_sessions — the chronicle
  // service derives it via the character. We only set what dm_sessions actually has.
  const r = await dbRun(
    `INSERT INTO dm_sessions
       (character_id, status, messages, session_config, model, session_type, title, game_start_day)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      characterId,
      status,
      JSON.stringify(buildMessages(conversationCount)),
      '{}',
      'opus',
      'player',
      'TEST_RecoverySession',
      7
    ]
  );
  const id = Number(r.lastInsertRowid);
  sessionIds.push(id);
  return id;
}

/** Insert a chronicle row directly (no LLM) to simulate an already-recapped session. */
async function seedChronicle(sessionId, characterId, campaignId) {
  await dbRun(
    `INSERT INTO story_chronicles
       (campaign_id, character_id, session_id, session_number, summary)
     VALUES (?, ?, ?, ?, ?)`,
    [campaignId, characterId, sessionId, 1, 'TEST_RECOVERY pre-existing chronicle']
  );
}

async function chronicleCount(sessionId) {
  const row = await dbGet('SELECT COUNT(*) AS c FROM story_chronicles WHERE session_id = ?', [sessionId]);
  return Number(row?.c || 0);
}

async function cleanup() {
  const swallow = (p) => p.catch(() => {});
  for (const id of sessionIds) {
    await swallow(dbRun('DELETE FROM canon_facts WHERE source_session_id = ?', [id]));
    await swallow(dbRun('DELETE FROM story_chronicles WHERE session_id = ?', [id]));
    await swallow(dbRun('DELETE FROM session_message_summaries WHERE session_id = ?', [id]));
    await swallow(dbRun('DELETE FROM ai_call_log WHERE session_id = ?', [id]));
    await swallow(dbRun('DELETE FROM dm_sessions WHERE id = ?', [id]));
  }
  for (const id of characterIds) {
    await swallow(dbRun('DELETE FROM canon_facts WHERE character_id = ?', [id]));
    await swallow(dbRun('DELETE FROM characters WHERE id = ?', [id]));
  }
  for (const id of campaignIds) {
    await swallow(dbRun('DELETE FROM canon_facts WHERE campaign_id = ?', [id]));
    await swallow(dbRun('DELETE FROM story_chronicles WHERE campaign_id = ?', [id]));
    await swallow(dbRun('DELETE FROM campaigns WHERE id = ?', [id]));
  }
}

async function main() {
  await initDatabase();

  try {
    // ---- countConversationMessages (pure) -------------------------------
    console.log('\n=== countConversationMessages ===\n');
    check(
      countConversationMessages(JSON.stringify(buildMessages(6))) === 6,
      'counts only non-system messages (6 conversation + 1 system → 6)'
    );
    check(countConversationMessages('not json') === 0, 'bad JSON → 0 (defensive, never throws)');
    check(countConversationMessages(null) === 0, 'null → 0');
    check(countConversationMessages('[]') === 0, 'empty array → 0');

    // ---- findAbandonedSessions (SELECTION) ------------------------------
    console.log('\n=== findAbandonedSessions selection ===\n');
    const campaignId = await seedCampaign();
    const charId = await seedCharacter(campaignId);

    const activeNoChronicle = await seedSession(charId, { status: 'active', conversationCount: 6 });
    const pausedNoChronicle = await seedSession(charId, { status: 'paused', conversationCount: 6 });
    const tooShort = await seedSession(charId, { status: 'active', conversationCount: MIN_RECOVERABLE_MESSAGES - 1 });
    const completed = await seedSession(charId, { status: 'completed', conversationCount: 6 });
    const activeWithChronicle = await seedSession(charId, { status: 'active', conversationCount: 6 });
    await seedChronicle(activeWithChronicle, charId, campaignId);

    const found = await findAbandonedSessions();
    const foundIds = new Set(found.map(f => f.id));

    check(foundIds.has(activeNoChronicle), "active session w/ >=4 msgs & no chronicle IS selected");
    check(foundIds.has(pausedNoChronicle), "paused session w/ >=4 msgs & no chronicle IS selected");
    check(!foundIds.has(tooShort), 'session below the message floor is NOT selected');
    check(!foundIds.has(completed), "completed session is NOT selected (status filter)");
    check(!foundIds.has(activeWithChronicle), 'session that already has a chronicle is NOT selected');

    // ---- idempotency guard (already-chronicled session untouched) -------
    // This is the exact per-session call the sweep makes. A session that already
    // has a chronicle must stay at exactly one chronicle — the "chronicle already
    // exists" guard short-circuits and returns the existing row (no LLM, no write,
    // no duplicate). Provider-independent, scoped to our test session.
    console.log('\n=== generateSessionChronicle idempotency guard (already-chronicled session) ===\n');
    check(await chronicleCount(activeWithChronicle) === 1, 'precondition: already-chronicled session has exactly 1 chronicle');
    const guardResult = await generateSessionChronicle(activeWithChronicle);
    check(!!guardResult, 'guard returns the existing chronicle row (truthy), not null');
    check(!guardResult?.sessionNumber, 'guard result is the existing row (no sessionNumber — generation was skipped)');
    check(await chronicleCount(activeWithChronicle) === 1, 'already-chronicled session STILL has exactly 1 chronicle (no double-write)');

    // ---- end-to-end: abandoned session GETS a chronicle (scoped) --------
    // We scope the generating call to OUR test session — the exact per-session
    // unit recoverAbandonedSessions() invokes (generateSessionChronicle) — so the
    // test never writes chronicles into, or spends LLM tokens on, unrelated REAL
    // abandoned sessions that may exist in the shared Turso DB. (Running the
    // global sweep with a live provider would chronicle every real abandoned
    // session, which is correct production behavior but an unacceptable test
    // side effect.)
    console.log('\n=== abandoned session gets a chronicle (scoped, live provider) ===\n');
    if (isClaudeAvailable()) {
      check(await chronicleCount(activeNoChronicle) === 0, 'precondition: abandoned session has no chronicle yet');
      const gen = await generateSessionChronicle(activeNoChronicle);
      check(!!gen, 'generateSessionChronicle returned a result for the abandoned session');
      check(!!gen?.sessionNumber, 'result is a freshly generated chronicle (has sessionNumber)');
      check(await chronicleCount(activeNoChronicle) === 1, 'abandoned session now has exactly 1 chronicle after recovery');

      // Idempotency: a SECOND recovery of the same session must not duplicate.
      const again = await generateSessionChronicle(activeNoChronicle);
      check(!again?.sessionNumber, 'second recovery hits the guard (no new generation)');
      check(await chronicleCount(activeNoChronicle) === 1, 'recovering the same session twice does NOT duplicate the chronicle');

      // The too-short session is never a candidate, so it stays chronicle-free.
      check(await chronicleCount(tooShort) === 0, 'too-short session still has NO chronicle (never selected)');
    } else {
      // Offline: the GLOBAL sweep provably writes nothing (every per-session
      // generateSessionChronicle returns null because the LLM is unavailable), so
      // it's safe to exercise the real recoverAbandonedSessions() path here and
      // prove it is crash-safe + idempotent without mutating any real data.
      console.log('  ⚠ [soft-skip] no Claude provider (ANTHROPIC_API_KEY) — the LLM-backed recap');
      console.log('    cannot run offline. Exercising the GLOBAL sweep (writes nothing offline) for crash-safety:');
      const sweep1 = await recoverAbandonedSessions();
      const sweep2 = await recoverAbandonedSessions();
      check(typeof sweep1 === 'object' && typeof sweep1.scanned === 'number', 'global sweep returns a summary object and does not throw');
      check(typeof sweep2 === 'object', 'second global sweep also returns cleanly (idempotent, crash-safe)');
      check(await chronicleCount(activeWithChronicle) === 1, 'already-chronicled session STILL untouched after two full sweeps');

      const offlineGen = await generateSessionChronicle(activeNoChronicle);
      check(offlineGen === null, 'offline: generateSessionChronicle returns null (LLM extraction unavailable)');
      check(await chronicleCount(activeNoChronicle) === 0, 'offline: no chronicle written (sweep stayed crash-safe, dropped nothing)');
      const stillFound = await findAbandonedSessions();
      check(new Set(stillFound.map(f => f.id)).has(activeNoChronicle), 'offline: abandoned session remains a recovery candidate (will recover once a provider is available)');
    }

  } catch (err) {
    console.error('  ✗ FAIL: unexpected error');
    console.error('   ', err && err.stack ? err.stack : err);
    failed++;
  } finally {
    await cleanup();
  }

  console.log(`\n${'='.repeat(50)}`);
  console.log(`session-recovery: ${passed} passed, ${failed} failed`);
  console.log('='.repeat(50));
  process.exit(failed === 0 ? 0 : 1);
}

main();
