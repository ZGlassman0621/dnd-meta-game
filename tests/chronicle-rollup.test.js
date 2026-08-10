/**
 * Phase 4 — chronicle generation repair + campaign rollup.
 *
 * Two things under test, and the first is a prerequisite for the second.
 *
 * 1. `generateSessionChronicle` never worked. Its opening query selected
 *    `campaign_id` and `game_day` from `dm_sessions`, and neither column
 *    exists — so it threw `no such column: campaign_id` on every call while
 *    the sole caller swallowed chronicle errors into a console.error.
 *    `story_chronicles` was therefore always empty, `getSessionSummariesForPrompt`
 *    always returned [], and no canon fact was ever recorded.
 *
 * 2. The rollup itself: chronicles older than the verbatim window compress into
 *    one running "campaign so far" paragraph, so an open-ended campaign keeps a
 *    flat prompt cost without amnesia about its own first act.
 *
 * The rollup makes a real LLM call, so this runs on the stubbed-LLM harness.
 */

import { initDatabase, dbRun, dbGet, dbAll } from '../server/database.js'
import {
  generateSessionChronicle,
  rollUpOldChronicles,
  getCampaignRollup,
  getSessionSummariesForPrompt,
  CHRONICLE_VERBATIM_TAIL,
  MAX_ROLLUP_CHARS
} from '../server/services/storyChronicleService.js'
import { createDMSystemPrompt } from '../server/services/dmPromptBuilder.js'
import { installLlmStub, restoreLlm } from './helpers/llmHarness.js'

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

let CAMPAIGN_ID = null
let CHARACTER_ID = null
const SESSION_IDS = []

async function seed() {
  const campaign = await dbRun(
    'INSERT INTO campaigns (name, setting, status) VALUES (?, ?, ?)',
    ['TEST_ROLLUP Campaign', 'Forgotten Realms', 'active']
  )
  CAMPAIGN_ID = Number(campaign.lastInsertRowid)

  const character = await dbRun(
    `INSERT INTO characters
       (name, class, race, level, current_hp, max_hp, current_location,
        experience_to_next_level, campaign_id, game_day, game_year)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ['TEST_ROLLUP Hero', 'Ranger', 'Half-Elf', 4, 28, 28, 'TEST_ROLLUP_Vale', 2700, CAMPAIGN_ID, 140, 1492]
  )
  CHARACTER_ID = Number(character.lastInsertRowid)
}

/** Insert a completed session with a usable transcript. */
async function makeSession(label, startDay) {
  const r = await dbRun(
    `INSERT INTO dm_sessions
       (character_id, title, status, messages, model, game_start_day, game_start_year)
     VALUES (?, ?, 'active', ?, 'claude-opus-4-7', ?, 1492)`,
    [
      CHARACTER_ID,
      `TEST_ROLLUP ${label}`,
      JSON.stringify([
        { role: 'system', content: 'You are the DM.' },
        { role: 'user', content: `I investigate the ${label}.` },
        { role: 'assistant', content: `The ${label} yields its secret, and a debt is incurred.` }
      ]),
      startDay
    ]
  )
  const id = Number(r.lastInsertRowid)
  SESSION_IDS.push(id)
  return id
}

/** Insert a chronicle row directly — used to build campaign length cheaply. */
async function makeChronicle(sessionNumber, sessionId, summary) {
  await dbRun(
    `INSERT INTO story_chronicles
       (campaign_id, character_id, session_id, session_number,
        game_day_start, game_day_end, summary, key_decisions, mood, cliffhanger)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      CAMPAIGN_ID, CHARACTER_ID, sessionId, sessionNumber,
      100 + sessionNumber, 101 + sessionNumber,
      summary,
      JSON.stringify([{ decision: `choice ${sessionNumber}`, consequence: `outcome ${sessionNumber}` }]),
      'tense',
      `unresolved thread ${sessionNumber}`
    ]
  )
}

async function cleanup() {
  if (CAMPAIGN_ID === null) return
  await dbRun('DELETE FROM campaign_chronicle_rollups WHERE campaign_id = ?', [CAMPAIGN_ID])
  await dbRun('DELETE FROM canon_facts WHERE campaign_id = ?', [CAMPAIGN_ID])
  await dbRun('DELETE FROM story_chronicles WHERE campaign_id = ?', [CAMPAIGN_ID])
  for (const id of SESSION_IDS) {
    await dbRun('DELETE FROM ai_call_log WHERE session_id = ?', [id]).catch(() => {})
    await dbRun('DELETE FROM dm_sessions WHERE id = ?', [id])
  }
  await dbRun('DELETE FROM ai_call_log WHERE campaign_id = ?', [CAMPAIGN_ID]).catch(() => {})
  await dbRun('DELETE FROM characters WHERE id = ?', [CHARACTER_ID])
  await dbRun('DELETE FROM campaigns WHERE id = ?', [CAMPAIGN_ID])
}

const CHRONICLE_JSON = JSON.stringify({
  summary: 'The party descended into the flooded crypt and struck a bargain with something patient.',
  key_decisions: [{ decision: 'Took the bargain', context: 'No other way out', consequence: 'A debt is owed' }],
  npcs_involved: [{ name: 'The Patient Thing', role: 'creditor' }],
  locations_visited: [{ name: 'Flooded Crypt', events: 'the bargain' }],
  quests_progressed: [],
  combat_encounters: [],
  items_gained: ['Silver Key'],
  items_lost: [],
  gold_change: -25,
  player_death: false,
  companion_deaths: [],
  mood: 'tense',
  cliffhanger: 'The debt has not been called in.',
  canon_facts: [
    { category: 'promise', subject: 'The Patient Thing', fact: 'The hero owes a debt to the Patient Thing.', importance: 'major' },
    { category: 'item', subject: 'Silver Key', fact: 'The hero carries a silver key from the flooded crypt.', importance: 'minor' }
  ],
  npc_conversations: [],
  companion_mood_changes: [],
  npc_deaths: []
})

async function run() {
  await initDatabase()
  await seed()

  const llm = installLlmStub()

  try {
    // ============================================================
    console.log('\n=== Test 1: chronicle generation actually works now ===\n')
    // ============================================================

    const sessionId = await makeSession('flooded crypt', 140)

    llm.reply(CHRONICLE_JSON)
    const chronicle = await generateSessionChronicle(sessionId)

    assert(chronicle !== null, 'generateSessionChronicle returns a record instead of throwing on a missing column')

    const stored = await dbGet('SELECT * FROM story_chronicles WHERE session_id = ?', [sessionId])
    assert(!!stored, 'a story_chronicles row was actually written')
    assertEqual(Number(stored.campaign_id), CAMPAIGN_ID, 'campaign_id resolved through characters, not dm_sessions')
    assertEqual(Number(stored.session_number), 1, 'this is session number 1 for the campaign')
    assertEqual(Number(stored.game_day_start), 140, 'game_day_start came from dm_sessions.game_start_day')
    assertEqual(Number(stored.game_day_end), 140, 'game_day_end fell back to the character clock')
    assert(/flooded crypt/.test(stored.summary), 'the model summary was stored')

    const facts = await dbAll(
      'SELECT * FROM canon_facts WHERE campaign_id = ? ORDER BY id',
      [CAMPAIGN_ID]
    )
    assertEqual(facts.length, 2, 'canon facts were recorded — they never were before')
    assert(facts.some(f => /owes a debt/.test(f.fact)), 'the promise fact survived')

    // Re-running must not duplicate.
    const again = await generateSessionChronicle(sessionId)
    assert(!!again, 'a second call returns the existing chronicle')
    const count = await dbGet('SELECT COUNT(*) AS n FROM story_chronicles WHERE session_id = ?', [sessionId])
    assertEqual(Number(count.n), 1, 'and does not write a duplicate row')

    // ============================================================
    console.log('\n=== Test 2: a character with no campaign bails before spending tokens ===\n')
    // ============================================================

    const orphan = await dbRun(
      `INSERT INTO characters
         (name, class, race, level, current_hp, max_hp, current_location, experience_to_next_level)
       VALUES ('TEST_ROLLUP Orphan', 'Bard', 'Human', 1, 8, 8, 'TEST_ROLLUP_Nowhere', 300)`
    )
    const orphanId = Number(orphan.lastInsertRowid)
    const orphanSession = await dbRun(
      `INSERT INTO dm_sessions (character_id, title, status, messages, game_start_day)
       VALUES (?, 'TEST_ROLLUP Orphan Session', 'active', ?, 1)`,
      [orphanId, JSON.stringify([
        { role: 'user', content: 'hello' },
        { role: 'assistant', content: 'hi' }
      ])]
    )
    const orphanSessionId = Number(orphanSession.lastInsertRowid)
    SESSION_IDS.push(orphanSessionId)

    const callsBefore = llm.callCount
    const orphanResult = await generateSessionChronicle(orphanSessionId)
    assertEqual(orphanResult, null, 'a campaign-less character produces no chronicle')
    assertEqual(llm.callCount, callsBefore, 'and costs no LLM call — it bails before the extraction')

    await dbRun('DELETE FROM dm_sessions WHERE id = ?', [orphanSessionId])
    await dbRun('DELETE FROM characters WHERE id = ?', [orphanId])

    // ============================================================
    console.log('\n=== Test 3: no rollup until the campaign outgrows the window ===\n')
    // ============================================================

    // Fill up to exactly the verbatim window (session 1 already exists).
    for (let n = 2; n <= CHRONICLE_VERBATIM_TAIL; n++) {
      const sid = await makeSession(`session ${n}`, 140 + n)
      await makeChronicle(n, sid, `Session ${n}: the party pressed on and something was owed.`)
    }

    const tooShort = await rollUpOldChronicles(CAMPAIGN_ID, CHARACTER_ID)
    assertEqual(tooShort.rolled, false, `no rollup at exactly ${CHRONICLE_VERBATIM_TAIL} sessions`)
    assert(/shorter than the verbatim window/.test(tooShort.reason), 'and it says why')
    assertEqual(await getCampaignRollup(CAMPAIGN_ID, CHARACTER_ID), null, 'no rollup row exists yet')

    // ============================================================
    console.log('\n=== Test 4: crossing the window rolls up the overflow ===\n')
    // ============================================================

    // Three more sessions push sessions 1-3 out of the verbatim window.
    for (let n = CHRONICLE_VERBATIM_TAIL + 1; n <= CHRONICLE_VERBATIM_TAIL + 3; n++) {
      const sid = await makeSession(`session ${n}`, 140 + n)
      await makeChronicle(n, sid, `Session ${n}: later events.`)
    }

    llm.reply('The hero began in the flooded crypt, where a bargain with the Patient Thing left a debt still uncalled. Across the sessions that followed they carried a silver key north.')
    const rolled = await rollUpOldChronicles(CAMPAIGN_ID, CHARACTER_ID)

    assertEqual(rolled.rolled, true, 'the overflow rolled up')
    assertEqual(rolled.throughSession, 3, 'sessions 1-3 aged out and were compressed')
    assertEqual(rolled.newlyRolled, 3, 'three chronicles were folded in')

    const rollup = await getCampaignRollup(CAMPAIGN_ID, CHARACTER_ID)
    assert(!!rollup, 'a rollup row now exists')
    assertEqual(Number(rollup.through_session_number), 3, 'the resume point is stored')
    assertEqual(Number(rollup.sessions_rolled), 3, 'the compressed session count is stored')
    assert(/Patient Thing/.test(rollup.summary), 'the compressed summary preserved the creditor')

    // The verbatim window is untouched — this is compression, not deletion.
    const stillVerbatim = await getSessionSummariesForPrompt(CAMPAIGN_ID, CHARACTER_ID)
    assertEqual(stillVerbatim.length, CHRONICLE_VERBATIM_TAIL, 'the verbatim window is still full')
    assertEqual(Number(stillVerbatim[0].session_number), 4, 'and now starts at session 4')
    const allChronicles = await dbGet(
      'SELECT COUNT(*) AS n FROM story_chronicles WHERE campaign_id = ?', [CAMPAIGN_ID]
    )
    assertEqual(Number(allChronicles.n), CHRONICLE_VERBATIM_TAIL + 3, 'no chronicle row was deleted')

    // ============================================================
    console.log('\n=== Test 5: the rollup is incremental, not a full re-read ===\n')
    // ============================================================

    const noNewOverflow = await rollUpOldChronicles(CAMPAIGN_ID, CHARACTER_ID)
    assertEqual(noNewOverflow.rolled, false, 'calling again with nothing newly aged out is a no-op')
    assert(/aged out since the last rollup/.test(noNewOverflow.reason), 'and it says why')

    // Two more sessions -> sessions 4-5 age out.
    for (let n = CHRONICLE_VERBATIM_TAIL + 4; n <= CHRONICLE_VERBATIM_TAIL + 5; n++) {
      const sid = await makeSession(`session ${n}`, 140 + n)
      await makeChronicle(n, sid, `Session ${n}: even later events.`)
    }

    llm.reply('Updated: the debt to the Patient Thing remains, and the silver key opened a door in the north.')
    const second = await rollUpOldChronicles(CAMPAIGN_ID, CHARACTER_ID)

    assertEqual(second.rolled, true, 'the next overflow rolls too')
    assertEqual(second.throughSession, 5, 'the resume point advanced to session 5')
    assertEqual(second.newlyRolled, 2, 'only the two NEWLY aged-out sessions were sent')
    assertEqual(second.sessionsRolled, 5, 'the cumulative compressed count is 5')

    // The prompt sent to the model is the proof of incrementality: it must
    // carry the previous rollup plus sessions 4-5, and NOT sessions 1-3.
    const rollPrompt = llm.lastCall.lastUserMessage
    assert(/Patient Thing/.test(rollPrompt), 'the previous rollup was fed back in')
    assert(/Session 4:/.test(rollPrompt) && /Session 5:/.test(rollPrompt), 'the newly aged-out sessions were included')
    assert(!/Session 1:/.test(rollPrompt), 'already-compressed sessions were NOT re-sent — cost stays flat')

    // ============================================================
    console.log('\n=== Test 6: a failed or empty rollup does not advance the pointer ===\n')
    // ============================================================

    for (let n = CHRONICLE_VERBATIM_TAIL + 6; n <= CHRONICLE_VERBATIM_TAIL + 7; n++) {
      const sid = await makeSession(`session ${n}`, 140 + n)
      await makeChronicle(n, sid, `Session ${n}: yet more.`)
    }

    llm.reply('   ')
    const empty = await rollUpOldChronicles(CAMPAIGN_ID, CHARACTER_ID)
    assertEqual(empty.rolled, false, 'an empty model response is refused')

    const unchanged = await getCampaignRollup(CAMPAIGN_ID, CHARACTER_ID)
    assertEqual(Number(unchanged.through_session_number), 5, 'the resume point did NOT advance past uncompressed material')
    assert(/Patient Thing/.test(unchanged.summary), 'the previous good summary survived')

    llm.reply({ status: 401, error: 'nope' })
    const errored = await rollUpOldChronicles(CAMPAIGN_ID, CHARACTER_ID)
    assertEqual(errored.rolled, false, 'an LLM failure is caught, not thrown')
    const stillUnchanged = await getCampaignRollup(CAMPAIGN_ID, CHARACTER_ID)
    assertEqual(Number(stillUnchanged.through_session_number), 5, 'and still does not advance the resume point')

    // ============================================================
    console.log('\n=== Test 7: an over-long rollup is truncated ===\n')
    // ============================================================

    llm.reply('x'.repeat(MAX_ROLLUP_CHARS + 5000))
    const huge = await rollUpOldChronicles(CAMPAIGN_ID, CHARACTER_ID)
    assertEqual(huge.rolled, true, 'an over-long summary still rolls')
    const truncated = await getCampaignRollup(CAMPAIGN_ID, CHARACTER_ID)
    assertEqual(truncated.summary.length, MAX_ROLLUP_CHARS, 'the stored rollup is capped — the compressed half cannot grow unbounded')

    // ============================================================
    console.log('\n=== Test 8: the prompt renders both tiers, distinctly ===\n')
    // ============================================================

    const verbatim = await getSessionSummariesForPrompt(CAMPAIGN_ID, CHARACTER_ID)
    const rollupRow = await getCampaignRollup(CAMPAIGN_ID, CHARACTER_ID)

    const CHAR = {
      name: 'TEST_ROLLUP Hero', class: 'Ranger', race: 'Half-Elf', level: 4,
      current_hp: 28, max_hp: 28, current_location: 'TEST_ROLLUP_Vale'
    }
    const prompt = createDMSystemPrompt(CHAR, {
      continueCampaign: true,
      chronicleSummaries: verbatim,
      campaignRollup: rollupRow
    })

    assert(/THE CAMPAIGN SO FAR/.test(prompt), 'the compressed tier is rendered')
    assert(/sessions 1-7, compressed/.test(prompt), 'labelled with the span it covers')
    assert(/RECENT SESSIONS \(in full\)/.test(prompt), 'the verbatim tier is labelled separately')
    assert(
      prompt.indexOf('THE CAMPAIGN SO FAR') < prompt.indexOf('RECENT SESSIONS (in full)'),
      'compressed history is placed before recent history — chronological order'
    )
    assert(/no less canon/.test(prompt), 'the DM is told compressed does not mean optional')

    // Without a rollup, the section must look exactly as it did before Phase 4.
    const legacyPrompt = createDMSystemPrompt(CHAR, {
      continueCampaign: true,
      chronicleSummaries: verbatim,
      campaignRollup: null
    })
    assert(!/THE CAMPAIGN SO FAR/.test(legacyPrompt), 'no rollup means no compressed block')
    assert(!/RECENT SESSIONS \(in full\)/.test(legacyPrompt), 'and no redundant "recent" header either')
    assert(/PREVIOUS ADVENTURES/.test(legacyPrompt), 'the original history section is unchanged')

    // ============================================================
    console.log('\n=== Cleanup ===\n')
    // ============================================================
  } finally {
    restoreLlm()
  }

  await cleanup()
  const gone = await dbGet('SELECT id FROM campaigns WHERE id = ?', [CAMPAIGN_ID])
  assert(!gone, 'test campaign removed')

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`)
  if (failed > 0) process.exit(1)
}

await run()
