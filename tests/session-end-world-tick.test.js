/**
 * Phase 4 — the living world advances with in-game time, at session end.
 *
 * Before this, `processLivingWorldTick` had no caller on the normal play path.
 * It ran only from two debug endpoints and the meta-game "advance time" screen,
 * so a player who never opened those screens played in a world frozen since
 * session one. Session end is now the driver: it is the moment the campaign
 * clock moves, and it moves by exactly `daysElapsed`.
 *
 * End-to-end over the stubbed-LLM harness, because session end makes five
 * sequential model calls before it ever reaches the tick.
 */

import { initDatabase, dbRun, dbGet, dbAll } from '../server/database.js'
import { FEATURE_FLAGS } from '../server/config/featureFlags.js'
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

/**
 * Session-end analysis response. All four scored dimensions at 10 give
 * activityLevel = 40/40 = 1, so calculateGameTimeAdvance returns
 * ceil(1 * 3) = 3 in-game days — a known, asserted-on value rather than
 * whatever the model felt like.
 */
const ANALYSIS = `SUMMARY: The party cleared the ridge and struck a bargain.
COMBAT: 10
EXPLORATION: 10
QUESTS: 10
DISCOVERY: 5
SOCIAL: 10
DANGER: 6
ITEMS_CONSUMED: [none]
GOLD_SPENT: [none]
ITEMS_GAINED: [none]`

const EXPECTED_DAYS = 3

const CHRONICLE_JSON = JSON.stringify({
  summary: 'The party cleared the ridge.',
  key_decisions: [],
  npcs_involved: [],
  locations_visited: [],
  quests_progressed: [],
  combat_encounters: [],
  items_gained: [],
  items_lost: [],
  gold_change: 0,
  player_death: false,
  companion_deaths: [],
  mood: 'triumphant',
  cliffhanger: null,
  canon_facts: [],
  npc_conversations: [],
  companion_mood_changes: [],
  npc_deaths: []
})

/** Script the five calls session end makes, in order. */
function scriptSessionEnd(llm) {
  llm.reply(ANALYSIS)                 // 1. rewards analysis
  llm.reply('NPCS MET:\n- None of note')  // 2. campaign notes extraction
  llm.reply('[]')                     // 3. NPC extraction
  llm.reply('NO_NEW_MEMORIES')        // 4. character memory extraction
  llm.reply(CHRONICLE_JSON)           // 5. chronicle extraction
}

const fixtures = []

async function endSession(server, fixture) {
  return await server.post(`/api/dm-session/${fixture.sessionId}/end`, {})
}

async function run() {
  await initDatabase()

  // The route reads the flag at call time, so this is set for the whole file
  // and restored at the end. Test 4 deliberately turns it off again.
  delete process.env.FF_LIVING_WORLD_TICK
  assertEqual(FEATURE_FLAGS.LIVING_WORLD_TICK, true, 'the tick is on by default as of Phase 4')

  const llm = installLlmStub()
  const server = await startTurnServer()

  try {
    // ============================================================
    console.log('\n=== Test 1: ending a session ticks the world by the days that passed ===\n')
    // ============================================================

    const f1 = await seedTurnFixture(dbRun, { prefix: 'TEST_TICK_1', playerTurns: 2 })
    fixtures.push(f1)

    // Seed weather that is overdue for a change. advanceWeather stamps
    // `weather_started_game_day` with MAX(characters.game_day) when it rolls,
    // which makes it a direct probe of the clock the tick saw.
    await dbRun(
      `INSERT INTO campaign_weather
         (campaign_id, weather_type, temperature_f, wind_speed, visibility,
          precipitation, weather_duration_hours, weather_started_game_day,
          last_weather_change_day, region_type)
       VALUES (?, 'clear', 65, 'calm', 'normal', 'none', 24, 1, 1, 'temperate')`,
      [f1.campaignId]
    )

    const before = await dbGet('SELECT game_day FROM characters WHERE id = ?', [f1.characterId])
    assertEqual(Number(before.game_day), 100, 'the character starts on game day 100')

    scriptSessionEnd(llm)
    const res = await endSession(server, f1)

    assertEqual(res.status, 200, 'the session ends cleanly')
    assertEqual(res.body.daysElapsed, EXPECTED_DAYS, 'the analysis scores produced a 3-day advance')

    const after = await dbGet('SELECT game_day FROM characters WHERE id = ?', [f1.characterId])
    assertEqual(Number(after.game_day), 103, 'the character clock advanced by exactly daysElapsed')

    assert(!!res.body.worldTick, 'the response reports that the world ticked')
    assertEqual(res.body.worldTick.daysElapsed, EXPECTED_DAYS, 'the tick ran for the same span as the adventure')

    // ============================================================
    console.log('\n=== Test 2: the tick runs AFTER the game-day write ===\n')
    // ============================================================

    // This is the ordering invariant. The tick derives its clock from
    // MAX(game_day) FROM characters; ticking before the UPDATE would advance
    // the world against the day the session STARTED on, so every deadline
    // would resolve one session late. The weather stamp is the witness.
    const weather = await dbGet(
      'SELECT weather_started_game_day FROM campaign_weather WHERE campaign_id = ?',
      [f1.campaignId]
    )
    assertEqual(
      Number(weather.weather_started_game_day),
      103,
      'the tick saw the POST-advance game day (103), not the pre-advance day (100)'
    )

    // ============================================================
    console.log('\n=== Test 3: tick outcomes reach the narrative queue ===\n')
    // ============================================================

    // A bare campaign has no factions, so the tick spawns nothing and there is
    // nothing to queue — assert that honestly rather than pretending otherwise.
    const queuedForBare = await dbAll(
      "SELECT * FROM narrative_queue WHERE character_id = ? AND event_type = 'world_event_escalated'",
      [f1.characterId]
    )
    assertEqual(queuedForBare.length, 0, 'a factionless campaign queues nothing — no invented noise')

    // Now the real path: feed queueTickHighlights a tick result carrying
    // spawned world events, exactly as processLivingWorldTick returns them.
    const { queueTickHighlights } = await import('../server/services/livingWorldService.js')

    const result = await queueTickHighlights(f1.campaignId, f1.characterId, {
      spawned_events: [
        { event_id: 901, title: 'The Zhentarim Nears Its Goal', milestone: 75, goal_id: 11, faction_id: 3 },
        { event_id: 902, title: 'The Zhentarim Gains Momentum', milestone: 50, goal_id: 11, faction_id: 3 },
        { event_id: 903, title: 'Harpers Make Progress', milestone: 25, goal_id: 12, faction_id: 4 },
        // A faction quest — it queued itself at spawn time and must not double.
        { type: 'faction_quest', quest_id: 55, quest_title: 'Break the Siege', faction_id: 3, goal_id: 11 }
      ]
    })

    assertEqual(result.queued, 2, 'two entries queued: one per GOAL, not one per milestone crossed')
    assertEqual(result.skipped, 0, 'nothing was dropped')

    const queued = await dbAll(
      `SELECT * FROM narrative_queue
        WHERE character_id = ? AND event_type = 'world_event_escalated'
        ORDER BY id`,
      [f1.characterId]
    )
    assertEqual(queued.length, 2, 'the rows are really in the queue')
    assert(
      queued.some(q => /Nears Its Goal/.test(q.title)),
      'the HIGHEST milestone for a goal was kept (75%), not the 50% crescendo step'
    )
    assert(
      !queued.some(q => /Gains Momentum/.test(q.title)),
      'the superseded 50% milestone for the same goal was folded away'
    )
    assert(
      !queued.some(q => /Break the Siege/.test(q.title)),
      'faction quests are NOT re-queued — they queue themselves at spawn'
    )

    const urgent = queued.find(q => /Nears Its Goal/.test(q.title))
    assertEqual(urgent.priority, 'high', 'a 75%+ milestone is high priority')
    assertEqual(urgent.status, 'pending', 'and pending, so the next session picks it up')

    const minor = queued.find(q => /Harpers/.test(q.title))
    assertEqual(minor.priority, 'normal', 'a 25% milestone is normal priority')

    // ============================================================
    console.log('\n=== Test 4: capping is reported, not silent ===\n')
    // ============================================================

    const many = Array.from({ length: 9 }, (_, i) => ({
      event_id: 1000 + i,
      title: `Event ${i}`,
      milestone: 25 + i,
      goal_id: 100 + i,
      faction_id: 7
    }))
    const capped = await queueTickHighlights(f1.campaignId, f1.characterId, { spawned_events: many })
    assertEqual(capped.queued, 5, 'the default cap of 5 holds')
    assertEqual(capped.skipped, 4, 'the overflow is COUNTED and returned, not silently dropped')

    // ============================================================
    console.log('\n=== Test 5: the flag still switches the whole thing off ===\n')
    // ============================================================

    process.env.FF_LIVING_WORLD_TICK = 'false'

    const f2 = await seedTurnFixture(dbRun, { prefix: 'TEST_TICK_2', playerTurns: 2 })
    fixtures.push(f2)

    scriptSessionEnd(llm)
    const offRes = await endSession(server, f2)

    assertEqual(offRes.status, 200, 'the session still ends')
    assertEqual(offRes.body.daysElapsed, EXPECTED_DAYS, 'and time still passes in-game')
    assertEqual(offRes.body.worldTick, undefined, 'but no tick is reported')

    const offChar = await dbGet('SELECT game_day FROM characters WHERE id = ?', [f2.characterId])
    assertEqual(Number(offChar.game_day), 103, 'the calendar advances regardless — it is not part of the tick')

    delete process.env.FF_LIVING_WORLD_TICK

    // ============================================================
    console.log('\n=== Test 6: queue failures are contained ===\n')
    // ============================================================

    // narrative_queue.character_id is a foreign key, so an unknown character is
    // a real INSERT failure — the closest reachable stand-in for "a queue write
    // blew up mid-tick". The tick must absorb it rather than propagating.
    const contained = await queueTickHighlights(f1.campaignId, 99999999, {
      spawned_events: [{ event_id: 2001, title: 'Doomed Entry', milestone: 50, goal_id: 500 }]
    })
    assertEqual(contained.queued, 0, 'a failed queue write is counted as not-queued, not thrown')

    // Degenerate inputs must not throw either — the tick calls this with
    // whatever processLivingWorldTick returned, including the gated no-op shape.
    assertEqual((await queueTickHighlights(null, null, null)).queued, 0, 'null inputs are a no-op')
    assertEqual((await queueTickHighlights(f1.campaignId, f1.characterId, {})).queued, 0, 'a result with no spawned_events is a no-op')
    assertEqual(
      (await queueTickHighlights(f1.campaignId, f1.characterId, { spawned_events: [] })).queued,
      0,
      'the gated tick\'s empty result shape is a no-op'
    )

    // ============================================================
    console.log('\n=== Test 7: a character with no campaign ends cleanly and does not tick ===\n')
    // ============================================================

    const f3 = await seedTurnFixture(dbRun, { prefix: 'TEST_TICK_3', playerTurns: 2 })
    fixtures.push(f3)
    await dbRun('UPDATE characters SET campaign_id = NULL WHERE id = ?', [f3.characterId])

    scriptSessionEnd(llm)
    const orphanRes = await endSession(server, f3)

    assertEqual(orphanRes.status, 200, 'the session ends')
    assertEqual(orphanRes.body.worldTick, undefined, 'with no campaign there is no world to tick')
    const orphanChar = await dbGet('SELECT game_day FROM characters WHERE id = ?', [f3.characterId])
    assertEqual(Number(orphanChar.game_day), 103, 'the game date still advanced')
    const orphanSession = await dbGet('SELECT status FROM dm_sessions WHERE id = ?', [f3.sessionId])
    assertEqual(orphanSession.status, 'completed', 'and the session is properly closed')

    // ============================================================
    console.log('\n=== Cleanup ===\n')
    // ============================================================
  } finally {
    await server.close()
    restoreLlm()
    delete process.env.FF_LIVING_WORLD_TICK
  }

  for (const f of fixtures) {
    await dbRun('DELETE FROM narrative_queue WHERE character_id = ?', [f.characterId])
    await dbRun('DELETE FROM campaign_weather WHERE campaign_id = ?', [f.campaignId])
    await dbRun('DELETE FROM canon_facts WHERE campaign_id = ?', [f.campaignId])
    await dbRun('DELETE FROM story_chronicles WHERE campaign_id = ?', [f.campaignId])
    await cleanupTurnFixture(dbRun, f)
  }
  const leftover = await dbGet("SELECT COUNT(*) AS n FROM characters WHERE name LIKE 'TEST_TICK%'")
  assertEqual(Number(leftover.n), 0, 'test characters removed')

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`)
  if (failed > 0) process.exit(1)
}

await run()
