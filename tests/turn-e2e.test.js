/**
 * End-to-end turn-loop tests over the stubbed-LLM harness.
 *
 * This is the test CLAUDE.md called "the highest-value testing work
 * outstanding": `POST /:sessionId/message` driven through a real HTTP request,
 * against a real database, with only the model transport (Ollama) replaced. No
 * billed API calls, and no source-text assertions — every claim here is about
 * observed behaviour.
 *
 * `tests/turn-write-ordering.test.js` still earns its place: it guards the
 * *ordering* of dispatch-before-persist structurally, which a behavioural test
 * cannot see (both orderings produce identical output on the happy path). This
 * file covers what that one cannot — that the effects actually happen, that the
 * narrative reaching the player is marker-free, and that a failed turn writes
 * nothing.
 */

import { initDatabase, dbRun, dbGet } from '../server/database.js'
import { safeParse } from '../server/utils/safeParse.js'
import { modelFor, contextWindow } from '../server/services/localModels.js'
import {
  installLlmStub,
  restoreLlm,
  startTurnServer,
  seedTurnFixture,
  cleanupTurnFixture
} from './helpers/llmHarness.js'

let passed = 0
let failed = 0

function assert(condition, message) {
  if (condition) {
    passed++
    console.log(`  ✓ ${message}`)
  } else {
    failed++
    console.log(`  ✗ ${message}`)
  }
}

function assertEqual(actual, expected, message) {
  assert(actual === expected, `${message} (got ${JSON.stringify(actual)})`)
}

const fixtures = []

async function freshFixture(opts) {
  const f = await seedTurnFixture(dbRun, opts)
  fixtures.push(f)
  return f
}

async function readSession(sessionId) {
  const row = await dbGet('SELECT * FROM dm_sessions WHERE id = ?', [sessionId])
  return { ...row, parsedMessages: safeParse(row.messages, []) }
}

async function run() {
  await initDatabase()

  const llm = installLlmStub()
  const server = await startTurnServer()

  try {
    // ============================================================
    console.log('\n=== Test 1: a full turn — narrative persists, marker applies ===\n')
    // ============================================================

    const f1 = await freshFixture({ prefix: 'TEST_E2E_1', hp: 30, maxHp: 30 })
    const before = await readSession(f1.sessionId)

    llm.reply(
      'The ogre\'s club catches you across the ribs. ' +
      '[HP_CHANGE: delta=-7 reason="ogre club"] ' +
      'You stagger back, breathing hard.'
    )

    const res = await server.post(`/api/dm-session/${f1.sessionId}/message`, {
      action: 'I raise my shield and charge the ogre.'
    })

    assertEqual(res.status, 200, 'the turn returns 200')
    assert(!/\[HP_CHANGE:/.test(res.body.narrative), 'the HP_CHANGE marker is stripped from the player-facing narrative')
    assert(/ogre's club catches you/.test(res.body.narrative), 'the prose itself survives stripping')

    // The marker drove a real database write.
    const char = await dbGet('SELECT current_hp, max_hp FROM characters WHERE id = ?', [f1.characterId])
    assertEqual(char.current_hp, 23, 'HP_CHANGE applied to the database (30 - 7)')
    assert(Array.isArray(res.body.hpChanges) && res.body.hpChanges.length === 1, 'the response reports the HP change')
    assertEqual(res.body.hpChanges[0].currentHp, 23, 'the reported HP matches the database')

    // The narrative persisted, exactly once, with markers INTACT in history
    // (the AI sees its own markers; only the player's copy is stripped).
    const after = await readSession(f1.sessionId)
    const newAssistant = after.parsedMessages.filter(m => m.role === 'assistant')
    const oldAssistant = before.parsedMessages.filter(m => m.role === 'assistant')
    assertEqual(newAssistant.length, oldAssistant.length + 1, 'exactly one assistant message was appended')
    assert(/\[HP_CHANGE:/.test(newAssistant[newAssistant.length - 1].content), 'stored history keeps the raw marker')
    assert(
      after.parsedMessages.some(m => m.role === 'user' && /raise my shield/.test(m.content)),
      'the player action was persisted to history'
    )

    // ============================================================
    console.log('\n=== Test 2: what the model actually received ===\n')
    // ============================================================

    assertEqual(llm.callCount, 1, 'exactly one model call was made for one turn')
    const call = llm.lastCall
    // Asserted against the registry, not a literal: "a gameplay turn uses the
    // DM role's model" stays true across a model change.
    assertEqual(call.model, modelFor('dm'), 'a gameplay turn uses the DM role model')
    assertEqual(call.numCtx, contextWindow(), 'every call sends the context window (num_ctx) — Ollama would otherwise truncate the prompt')
    assert(/CURRENT VITALS/.test(call.system), 'the live vitals block was injected into the system prompt')
    assert(/Hit points: 30\/30/.test(call.system), 'vitals reflect pre-turn HP, read fresh from the database')
    assertEqual(call.lastUserMessage, 'I raise my shield and charge the ogre.', 'the player action was the final user turn')
    assertEqual(
      call.body.messages.filter(m => m.role === 'system').length, 1,
      'the system prompt travels exactly once, as the first (system) message'
    )
    assertEqual(call.body.messages[0].role, 'system', 'the system message leads the request')
    assert(!/CACHE_BREAK/.test(call.system), 'the old prompt-cache markers are stripped before sending')
    assert(llm.statusProbes >= 1, 'local-model availability was probed via /api/tags')

    // ============================================================
    console.log('\n=== Test 3: vitals track state across turns ===\n')
    // ============================================================

    llm.reply('You catch your breath in the lee of the wall.')
    await server.post(`/api/dm-session/${f1.sessionId}/message`, { action: 'I take cover.' })

    assert(/Hit points: 23\/30/.test(llm.lastCall.system), 'turn 2 sees the damage from turn 1')
    assert(
      (llm.lastCall.system.match(/CURRENT VITALS/g) || []).length === 1,
      'the vitals block is replaced, not accreted — one copy after two turns'
    )

    // ============================================================
    console.log('\n=== Test 4: a malformed marker queues a correction for next turn ===\n')
    // ============================================================

    const f2 = await freshFixture({ prefix: 'TEST_E2E_2' })

    // delta is required and must be a number — "lots" fails validation.
    llm.reply('Something hits you hard. [HP_CHANGE: delta=lots reason="mystery"]')
    await server.post(`/api/dm-session/${f2.sessionId}/message`, { action: 'I open the door.' })

    const afterBad = await readSession(f2.sessionId)
    const cfg = safeParse(afterBad.session_config, {})
    assert(!!cfg.pendingMarkerCorrections, 'a malformed marker stashes a correction on session_config')
    // P1-G: pendingMarkerCorrections is now an array of retry entries, not a
    // plain string — check the entry text, which names the offending marker.
    const pendingText = Array.isArray(cfg.pendingMarkerCorrections)
      ? cfg.pendingMarkerCorrections.map(e => e.text).join('\n')
      : cfg.pendingMarkerCorrections
    assert(/HP_CHANGE/.test(pendingText), 'the correction names the offending marker')

    const hpUnchanged = await dbGet('SELECT current_hp FROM characters WHERE id = ?', [f2.characterId])
    assertEqual(hpUnchanged.current_hp, 30, 'a marker that fails validation drives no side effect')

    // Next turn: the correction is injected, then consumed.
    llm.reply('You steady yourself. [HP_CHANGE: delta=-3 reason="splinters"]')
    await server.post(`/api/dm-session/${f2.sessionId}/message`, { action: 'I steady myself.' })

    assert(/MARKER CORRECTION NEEDED/.test(llm.lastCall.system), 'the correction was injected into the next system prompt')

    const afterFix = await readSession(f2.sessionId)
    const cfg2 = safeParse(afterFix.session_config, {})
    assert(!cfg2.pendingMarkerCorrections, 'the correction is consumed, not left to accrete')

    // Third turn confirms the injection stopped.
    llm.reply('The hall is quiet.')
    await server.post(`/api/dm-session/${f2.sessionId}/message`, { action: 'I listen.' })
    assert(!/MARKER CORRECTION NEEDED/.test(llm.lastCall.system), 'no correction is injected once resolved')

    // ============================================================
    console.log('\n=== Test 5: dropping to 0 HP triggers a system-rolled death save ===\n')
    // ============================================================

    const f3 = await freshFixture({ prefix: 'TEST_E2E_3', hp: 6, maxHp: 30 })

    llm.reply('The blade finds the gap in your mail. [HP_CHANGE: delta=-9 reason="assassin"]')
    const dyingRes = await server.post(`/api/dm-session/${f3.sessionId}/message`, { action: 'I press the attack.' })

    assertEqual(dyingRes.status, 200, 'the killing-blow turn still returns 200')
    const dying = await dbGet(
      'SELECT current_hp, is_unconscious, death_save_successes, death_save_failures FROM characters WHERE id = ?',
      [f3.characterId]
    )
    assert(!!dyingRes.body.deathSave, 'the system rolled a death save without being asked')
    // The death save is a real d20 the system rolls, so the asserts must
    // model every outcome branch, not just the middle two (a nat-20 revive
    // flaked this test 2026-10-21 — HP 1, conscious, 0 pips is CORRECT):
    //   20    -> revived at 1 HP, conscious, pips reset to 0/0
    //   10-19 -> one success pip, still down at 0 HP
    //   2-9   -> one failure pip, still down at 0 HP
    //   1     -> TWO failure pips, still down at 0 HP
    const ds = dyingRes.body.deathSave
    if (ds && ds.outcome === 'revived') {
      assertEqual(dying.current_hp, 1, 'a nat-20 death save revives at 1 HP')
      assertEqual(dying.is_unconscious, 0, 'a revived player is conscious')
      assert(ds.successes + ds.failures === 0, 'revive resets the death-save pips')
    } else {
      assertEqual(dying.current_hp, 0, 'HP floors at 0, not 1 — the player can fall')
      assertEqual(dying.is_unconscious, 1, 'falling to 0 HP sets unconscious')
      const expectedPips = ds && ds.roll === 1 ? 2 : 1
      assert(
        !!ds && ds.successes + ds.failures === expectedPips,
        'exactly one death save was rolled for the turn (a nat 1 counts as two failure pips)'
      )
    }

    // The AI is told the outcome so the next turn narrates from truth.
    const afterDying = await readSession(f3.sessionId)
    assert(
      afterDying.parsedMessages.some(m => /Death saving throw rolled/.test(m.content || '')),
      'the death-save result was appended to the history the AI reads'
    )

    // ============================================================
    console.log('\n=== Test 6: a failed LLM call writes nothing ===\n')
    // ============================================================

    const f4 = await freshFixture({ prefix: 'TEST_E2E_4' })
    const beforeFail = await readSession(f4.sessionId)

    // Ollama answers 404 when the model isn't installed; llm.js tags it
    // LOCAL_MODEL_MISSING and does not retry, so this returns at once.
    llm.reply({ status: 404, error: 'model not found' })
    const failRes = await server.post(`/api/dm-session/${f4.sessionId}/message`, { action: 'I speak to the guard.' })

    assertEqual(failRes.status, 503, 'a missing local model surfaces as 503 with a plain-words fix')
    assertEqual(failRes.body.retryable, true, 'the player can resend once the model is installed')
    assert(/ollama pull/.test(failRes.body.message || ''), `the message names the fix (got: ${failRes.body.message})`)

    const afterFail = await readSession(f4.sessionId)
    assertEqual(
      afterFail.parsedMessages.length,
      beforeFail.parsedMessages.length,
      'a failed turn appends no messages'
    )
    assertEqual(afterFail.status, 'active', 'the session stays active and replayable')

    // ============================================================
    console.log('\n=== Test 7: concurrent turns on one session get a 409 ===\n')
    // ============================================================

    const f5 = await freshFixture({ prefix: 'TEST_E2E_5' })

    // Hold the first turn inside the LLM call so the second arrives while the
    // session lock is genuinely held.
    let releaseFirstTurn
    const held = new Promise(resolve => { releaseFirstTurn = resolve })
    let signalStubEntered
    const stubEntered = new Promise(resolve => { signalStubEntered = resolve })
    llm.reply(async () => {
      signalStubEntered()
      await held
      return 'You push the door open.'
    })

    const firstTurn = server.post(`/api/dm-session/${f5.sessionId}/message`, { action: 'I push the door.' })
    // Wait for the SIGNAL that the first turn is inside the model call, not
    // a fixed sleep: the harness records the call before running the
    // responder, and the route takes the session lock before the call, so
    // stub entry means the lock is genuinely held and callCount is final.
    // The old 150ms sleep raced under full-suite load — if it expired
    // before the first request arrived, the second turn could slip in
    // first and the 409 asserts flaked (191 gate). Bounded at 10s so a
    // genuine failure to arrive fails loudly instead of hanging.
    const arrived = await Promise.race([
      stubEntered.then(() => true),
      new Promise(resolve => setTimeout(() => resolve(false), 10000)),
    ])
    assert(arrived, 'the first turn reached the model stub (session lock held) within 10s')

    const callsAtLock = llm.callCount
    const secondTurn = await server.post(`/api/dm-session/${f5.sessionId}/message`, { action: 'I push the door again.' })
    assertEqual(secondTurn.status, 409, 'a concurrent turn on the same session is rejected with 409')
    assertEqual(llm.callCount, callsAtLock, 'the rejected turn never reached the model — the lock is taken before the call')

    releaseFirstTurn()
    const firstResult = await firstTurn
    assertEqual(firstResult.status, 200, 'the in-flight turn completes normally')

    // The lock released — a later turn works.
    llm.reply('The room beyond is dark.')
    const thirdTurn = await server.post(`/api/dm-session/${f5.sessionId}/message`, { action: 'I look around.' })
    assertEqual(thirdTurn.status, 200, 'the lock is released after the turn, so the session is usable again')

    // ============================================================
    console.log('\n=== Test 8: input validation short-circuits before any model call ===\n')
    // ============================================================

    const callsBefore = llm.callCount

    const empty = await server.post(`/api/dm-session/${f5.sessionId}/message`, { action: '   ' })
    assertEqual(empty.status, 400, 'an empty action is rejected with 400')

    const missing = await server.post('/api/dm-session/99999999/message', { action: 'I wave.' })
    assertEqual(missing.status, 404, 'an unknown session is rejected with 404')

    assertEqual(llm.callCount, callsBefore, 'neither rejection spent a model call')

    // ============================================================
    console.log('\n=== Test 9: the harness itself cannot leak a live API call ===\n')
    // ============================================================

    // The cost-safety guarantee has to be verified, not assumed. In strict mode
    // an unscripted model request raises rather than reaching the network,
    // so a test that forgets to script a call fails loudly instead of silently
    // billing. (The turn handler swallows it into a 500 — the point is that no
    // request left the process.)
    assertEqual(llm.pending, 0, 'the script queue is empty going into this check')
    const unscripted = await server.post(`/api/dm-session/${f5.sessionId}/message`, { action: 'I shout for help.' })
    assertEqual(unscripted.status, 500, 'an unscripted model call fails the turn rather than hitting the network')

    // And nothing was written, which is the same dispatch-before-persist
    // guarantee Test 6 asserts, reached by a different failure mode.
    const afterUnscripted = await readSession(f5.sessionId)
    assert(
      !afterUnscripted.parsedMessages.some(m => /shout for help/.test(m.content || '')),
      'the unscripted turn persisted nothing'
    )

    // ============================================================
    console.log('\n=== Cleanup ===\n')
    // ============================================================
  } finally {
    await server.close()
    restoreLlm()
  }

  for (const f of fixtures) {
    await cleanupTurnFixture(dbRun, f)
  }
  const leftover = await dbGet(
    "SELECT COUNT(*) AS n FROM characters WHERE name LIKE 'TEST_E2E%'"
  )
  assertEqual(Number(leftover.n), 0, 'test characters removed')

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`)
  if (failed > 0) process.exit(1)
}

await run()
