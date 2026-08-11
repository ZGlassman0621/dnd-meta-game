/**
 * Hybrid combat dice (Phase 4) — the player rolls, the AI adjudicates.
 *
 * The ruling being enforced here is Decision 1, Option B: the attack roll and
 * damage the player types are BINDING facts for the turn. The AI adjudicates
 * them against the target's AC and narrates; it never re-rolls them. The
 * server keeps what it already owned — player HP, unconsciousness, death saves.
 *
 * Two layers, because they can break independently:
 *
 *   1. `parsePlayerDiceInput` / `formatPlayerDiceDirective` as pure functions —
 *      what counts as absent, what counts as malformed, and the exact wording
 *      that reaches the model.
 *   2. The real `POST /:sessionId/message` route over HTTP against a real
 *      database with only the Anthropic transport stubbed, per CLAUDE.md rule 3
 *      and `tests/helpers/llmHarness.js`. No billed calls: the stub intercepts
 *      every api.anthropic.com request and forwards none.
 *
 * The route-level claims are the ones worth having. A directive that is built
 * correctly but never reaches the model, or one that reaches the model and then
 * silts up in stored history forever, are both invisible to a unit test.
 */

import { initDatabase, dbRun, dbGet } from '../server/database.js'
import { safeParse } from '../server/utils/safeParse.js'
import {
  parsePlayerDiceInput,
  formatPlayerDiceDirective
} from '../server/services/dmPromptBuilder.js'
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

// ============================================================
// 1. parsePlayerDiceInput — absent, valid, malformed
// ============================================================
function testParse() {
  console.log('\n=== Test 1: parsePlayerDiceInput ===\n')

  // Absent is not invalid. Most turns are not attacks, so the empty shapes
  // have to be the boring, allocation-free path — never a 400.
  for (const [label, body] of [
    ['no body at all', undefined],
    ['empty body', {}],
    ['explicit nulls', { attackRoll: null, damage: null }],
    ['empty strings (an untouched <input type="number">)', { attackRoll: '', damage: '' }]
  ]) {
    const r = parsePlayerDiceInput(body)
    assert(r.ok && r.value.attackRoll === null && r.value.damage === null,
      `${label} → no dice, no error`)
  }

  const both = parsePlayerDiceInput({ attackRoll: 18, damage: 7 })
  assert(both.ok && both.value.attackRoll === 18 && both.value.damage === 7,
    'numbers pass through unchanged')

  // JSON round-trips an <input type="number"> as a string; coercing here is
  // what keeps the client from having to be careful.
  const strings = parsePlayerDiceInput({ attackRoll: '18', damage: ' 7 ' })
  assert(strings.ok && strings.value.attackRoll === 18 && strings.value.damage === 7,
    'numeric strings are coerced to integers')

  // 0 damage is real — resistance, or a table ruling. It must not be confused
  // with "absent", which is the whole reason the client sends null.
  const zero = parsePlayerDiceInput({ damage: 0 })
  assert(zero.ok && zero.value.damage === 0, 'damage 0 is a legitimate value, not absence')

  const attackOnly = parsePlayerDiceInput({ attackRoll: 12 })
  assert(attackOnly.ok && attackOnly.value.attackRoll === 12 && attackOnly.value.damage === null,
    'an attack roll without damage is accepted')

  for (const [label, body] of [
    ['a non-numeric string', { attackRoll: 'nat 20' }],
    ['a fraction', { damage: 7.5 }],
    ['NaN', { attackRoll: NaN }],
    ['Infinity', { damage: Infinity }],
    ['a boolean', { attackRoll: true }],
    ['an object', { damage: { n: 4 } }],
    ['an attack roll below 1', { attackRoll: 0 }],
    ['a negative damage value', { damage: -3 }],
    ['an absurd attack roll', { attackRoll: 4000 }],
    ['absurd damage', { damage: 999999 }]
  ]) {
    const r = parsePlayerDiceInput(body)
    assert(r.ok === false && typeof r.error === 'string' && r.error.length > 0,
      `${label} is rejected with a message`)
  }

  // The rejection has to name the field — "must be a whole number" alone
  // leaves the player guessing which of the two boxes to fix.
  const named = parsePlayerDiceInput({ damage: -3 })
  assert(/damage/i.test(named.error), 'the rejection names the offending field')
}

// ============================================================
// 2. formatPlayerDiceDirective — wording per shape
// ============================================================
function testDirective() {
  console.log('\n=== Test 2: formatPlayerDiceDirective ===\n')

  assertEqual(formatPlayerDiceDirective({ attackRoll: null, damage: null }), '',
    'no dice produces no directive')
  assertEqual(formatPlayerDiceDirective(), '', 'no argument produces no directive')

  const both = formatPlayerDiceDirective({ attackRoll: 18, damage: 7 })
  assert(both.includes('attack roll is 18'), 'the attack roll appears verbatim')
  assert(both.includes('damage is 7'), 'the damage appears verbatim')
  assert(/authoritative/i.test(both), 'the numbers are declared authoritative')
  assert(/do not re-roll/i.test(both), 'the model is told not to re-roll')
  assert(/AC/.test(both), "adjudication against the target's AC is requested")

  // 0 is falsy. A truthiness check instead of Number.isInteger would drop a
  // legitimate 0-damage roll and hand the number back to the AI.
  const zero = formatPlayerDiceDirective({ attackRoll: 15, damage: 0 })
  assert(zero.includes('damage is 0'), 'damage 0 still reaches the directive')

  const attackOnly = formatPlayerDiceDirective({ attackRoll: 12, damage: null })
  assert(attackOnly.includes('attack roll is 12'), 'attack-only names the roll')
  assert(!/damage is/.test(attackOnly), 'attack-only invents no damage number')
  assert(/ask them/i.test(attackOnly),
    'attack-only tells the DM to ask for damage rather than roll it')

  const damageOnly = formatPlayerDiceDirective({ attackRoll: null, damage: 9 })
  assert(damageOnly.includes('damage roll is 9'), 'damage-only names the damage')
  assert(!/attack roll is/.test(damageOnly), 'damage-only invents no attack roll')
}

// ============================================================
// 3–7. The real route
// ============================================================
async function testRoute() {
  const llm = installLlmStub()
  const server = await startTurnServer()

  try {
    // ============================================================
    console.log('\n=== Test 3: dice reach the model, and the player HP path still works ===\n')
    // ============================================================

    const f1 = await freshFixture({ prefix: 'TEST_DICE_1', hp: 30, maxHp: 30 })

    // The counter-attack is what item 4 of the plan is about: the player's own
    // numbers are advisory to the AI, but damage the player TAKES still has to
    // come back as an HP_CHANGE marker and move characters.current_hp.
    llm.reply(
      'Your blade turns the ogre\'s guard aside and opens its shoulder. ' +
      'It roars and swings back. [HP_CHANGE: delta=-6 reason="ogre counterswing"] ' +
      'You give ground, bleeding.'
    )

    const res = await server.post(`/api/dm-session/${f1.sessionId}/message`, {
      action: 'I swing at the ogre with my longsword.',
      attackRoll: 18,
      damage: 7
    })

    assertEqual(res.status, 200, 'the turn succeeds')

    const sent = llm.lastCall.lastUserMessage
    assert(sent.includes('I swing at the ogre with my longsword.'),
      "the player's own words reach the model")
    assert(sent.includes('attack roll is 18') && sent.includes('damage is 7'),
      'both numbers reach the model')
    assert(/authoritative/i.test(sent), 'the binding instruction reaches the model')

    // Recency: the directive is the last thing the model reads. It describes
    // THIS action, so it sits next to it rather than in the system prompt —
    // which `applyLeanTransforms` is free to strip whole sections out of.
    assert(sent.trimEnd().endsWith(']'), 'the directive is the tail of the user turn')
    assert(!/attack roll is 18/.test(llm.lastCall.system),
      'the directive is not smuggled into the system prompt')

    const hp = await dbGet('SELECT current_hp FROM characters WHERE id = ?', [f1.characterId])
    assertEqual(Number(hp.current_hp), 24, 'damage taken by the player still applies via HP_CHANGE')

    // ============================================================
    console.log('\n=== Test 4: stored history keeps the clean action ===\n')
    // ============================================================

    // The directive is a fact about one turn. Persisting it would replay
    // "these numbers are authoritative" against a roll that resolved turns ago,
    // and would feed the phrase to the chronicle extractor as if it were prose.
    const after = await readSession(f1.sessionId)
    const stored = after.parsedMessages.filter(m => m.role === 'user')
    const playerTurn = stored[stored.length - 1]

    assertEqual(playerTurn.content, 'I swing at the ogre with my longsword.',
      'the persisted player turn is exactly what the player typed')
    assert(
      !after.parsedMessages.some(m => /authoritative/i.test(m.content || '')),
      'no dice directive survives anywhere in stored history'
    )
    assert(
      after.parsedMessages.some(m => m.role === 'assistant' && /ogre's guard/.test(m.content || '')),
      'the narrative persisted, markers and all'
    )

    // ============================================================
    console.log('\n=== Test 5: a turn without dice is unchanged ===\n')
    // ============================================================

    const f2 = await freshFixture({ prefix: 'TEST_DICE_2' })
    llm.reply('The innkeeper looks up from the tap and nods at you.')

    const plain = await server.post(`/api/dm-session/${f2.sessionId}/message`, {
      action: 'I ask the innkeeper about the road north.'
    })

    assertEqual(plain.status, 200, 'a dice-free turn succeeds')
    assertEqual(llm.lastCall.lastUserMessage, 'I ask the innkeeper about the road north.',
      'nothing is appended when no dice were supplied')

    // ============================================================
    console.log('\n=== Test 6: malformed dice are rejected before the model is called ===\n')
    // ============================================================

    const f3 = await freshFixture({ prefix: 'TEST_DICE_3' })
    const callsBefore = llm.callCount

    for (const [label, body] of [
      ['a non-numeric attack roll', { action: 'I attack.', attackRoll: 'nat 20' }],
      ['a fractional damage value', { action: 'I attack.', damage: 3.5 }],
      ['a negative damage value', { action: 'I attack.', damage: -4 }],
      ['an out-of-range attack roll', { action: 'I attack.', attackRoll: 9001 }]
    ]) {
      const bad = await server.post(`/api/dm-session/${f3.sessionId}/message`, body)
      assertEqual(bad.status, 400, `${label} is rejected with 400`)
      assert(typeof bad.body?.error === 'string' && bad.body.error.length > 0,
        `${label} returns an explanatory error`)
    }

    assertEqual(llm.callCount, callsBefore, 'no rejection spent a model call')

    const untouched = await readSession(f3.sessionId)
    assert(
      !untouched.parsedMessages.some(m => /I attack\./.test(m.content || '')),
      'no rejected turn was persisted'
    )

    // The session lock is released on the 400 path — otherwise one fat-fingered
    // damage value would wedge the session until the lock went stale.
    llm.reply('You lunge. The goblin sidesteps.')
    const recovered = await server.post(`/api/dm-session/${f3.sessionId}/message`, {
      action: 'I attack.',
      attackRoll: 14,
      damage: 5
    })
    assertEqual(recovered.status, 200, 'a corrected turn goes through immediately afterwards')

    // ============================================================
    console.log('\n=== Test 7: a failed turn with dice writes nothing ===\n')
    // ============================================================

    const f4 = await freshFixture({ prefix: 'TEST_DICE_4' })
    // 401 is the non-retryable error path — see the llmHarness caveat about
    // 429/529/503/500 retrying with real backoff.
    llm.reply({ status: 401, error: 'invalid api key' })

    const failedTurn = await server.post(`/api/dm-session/${f4.sessionId}/message`, {
      action: 'I hurl the torch into the oil.',
      attackRoll: 20,
      damage: 12
    })
    assert(failedTurn.status >= 400, 'a failed model call fails the turn')

    const nothing = await readSession(f4.sessionId)
    assert(
      !nothing.parsedMessages.some(m => /hurl the torch/.test(m.content || '')),
      'the failed dice turn persisted nothing'
    )
  } finally {
    await server.close()
    restoreLlm()
  }
}

async function run() {
  await initDatabase()

  testParse()
  testDirective()
  await testRoute()

  console.log('\n=== Cleanup ===\n')
  for (const f of fixtures) {
    await cleanupTurnFixture(dbRun, f)
  }
  const leftover = await dbGet(
    "SELECT COUNT(*) AS n FROM characters WHERE name LIKE 'TEST_DICE%'"
  )
  assertEqual(Number(leftover.n), 0, 'test characters removed')

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`)
  if (failed > 0) process.exit(1)
}

await run()
