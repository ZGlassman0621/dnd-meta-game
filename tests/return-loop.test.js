/**
 * Return-loop suite — leave, come back, keep playing, and the world remembers.
 *
 * Brief: docs/pm/return-loop/BRIEF.md (2026-11-25). The MVP promise "create a
 * character, play, leave, return, play again ... memory retained without loss"
 * (Zach, 2026-11-11), proved outside of play, step by step:
 *
 *   STEP 1 [end]      a session with pending state ends through the real route
 *   STEP 2 [clock]    the campaign clock advanced by the session-end span
 *   STEP 3 [tick]     what session end resolves (the deferred sweep, MVP posture)
 *   STEP 4 [persist]  the state is on disk: read back through a NEW connection
 *                     in a separate process, not from this process's memory
 *   STEP 5 [return]   a summary is waiting on return and names what changed
 *   PROTECT [protect] the PC is never harmed, killed or robbed by the end-of-
 *                     session machinery; no downtime without the opt-in; a
 *                     failed XP score never blocks the return
 *
 * Every assertion carries its step tag, so a failure names the step. An
 * assertion tagged "GAP G-n" is a product gap: the design says one thing and
 * the product does another. It is a real assertion of the design and it fails
 * until a follow-up job fixes the product (brief item 4: gaps are reported,
 * not fixed, and never papered green). The gap list, with file and line, is in
 * docs/pm/reports/return-loop-REPORT.md.
 *
 * Runs over the stubbed-LLM harness. Replies are dispatched by what each
 * prompt asks for, not by call order, so a change in how many model calls
 * session end makes cannot silently feed one step another step's reply.
 *
 * Every test character is invented and TEST_-prefixed; all rows are removed.
 */

import path from 'node:path'
import fs from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { initDatabase, dbRun, dbGet, dbAll } from '../server/database.js'
import { FEATURE_FLAGS } from '../server/config/featureFlags.js'
import { installLlmStub, restoreLlm, startTurnServer, seedTurnFixture, cleanupTurnFixture } from './helpers/llmHarness.js'
import { advanceTimeForSession } from '../server/services/restTimeService.js'
import { calculateSessionRewards, xpToNext } from '../server/services/xpService.js'
import { endSession as orchestrateEnd } from '../server/services/sessionEndService.js'

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (rel) => fs.readFileSync(path.join(REPO, rel), 'utf8')

let passed = 0
let failed = 0
function check(cond, msg) {
  if (cond) { passed++; console.log(`  ✓ ${msg}`) } else { failed++; console.log(`  ✗ ${msg}`) }
}
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b)
const show = (v) => JSON.stringify(v)

// ─── Scripted model replies, dispatched by prompt content ──────────────────

const SUMMARY = 'TEST_RL Hero recovered the bell of Harrowmere and agreed to leave at dawn.'
const CHRONICLE_SUMMARY = 'Chronicle: TEST_RL Hero recovered the bell of Harrowmere from the drowned chapel.'
const REUNION = 'TEST_RL reunion: I found the old ford, and it is passable.'

const ANALYSIS = `SUMMARY: ${SUMMARY}
COMBAT: 6
EXPLORATION: 7
QUESTS: 8
DISCOVERY: 0
SOCIAL: 5
DANGER: 4
ITEMS_CONSUMED: [none]
GOLD_SPENT: [none]
ITEMS_GAINED: [none]`

// The XP scorer's reply: discovery had no opportunity (excluded, not zero).
const SCORER_JSON = JSON.stringify({
  combat: { opportunity: true, score: 6 },
  exploration: { opportunity: true, score: 7 },
  quests: { opportunity: true, score: 8 },
  discovery: { opportunity: false, score: null },
  social: { opportunity: true, score: 5 }
})
const SCORES = { combat: 6, exploration: 7, quests: 8, discovery: null, social: 5 }

const CHRONICLE_JSON = JSON.stringify({
  summary: CHRONICLE_SUMMARY,
  key_decisions: [], npcs_involved: [], locations_visited: ['Harrowmere'],
  quests_progressed: [], combat_encounters: [], items_gained: [], items_lost: [],
  gold_change: 0, player_death: false, companion_deaths: [], mood: 'hopeful',
  cliffhanger: 'They leave at dawn.', canon_facts: [], npc_conversations: [],
  companion_mood_changes: [], npc_deaths: []
})

const COMPANION_OUTCOME = JSON.stringify({
  success_level: 'full',
  story_summary: 'TEST_RL Mira scouted the river road and found the old ford.',
  reunion_narrative: REUNION,
  mood_change: { new_mood: 'content', cause: 'a good scouting run', intensity: 2 },
  loyalty_change: { amount: 2, reason: 'trusted with the scouting' },
  xp_gained: 20, items_found: [], injuries: null, story_development: null
})

let xpMode = 'ok' // 'ok' → valid scorer JSON; 'down' → the model answers HTTP 500
const purposes = []

function dispatch(call) {
  const last = String(call.lastUserMessage || '')
  const all = [call.system, ...(call.messages || []).map((m) => m.content)].join('\n')
  let purpose = 'other'
  let reply = 'You wake at dawn in Harrowmere; the bell is safe in your pack.'
  if (last.includes('The session is ending. Analyze what the party ACTUALLY accomplished')) {
    purpose = 'analysis'; reply = ANALYSIS
  } else if (last.includes('impartial session scorer')) {
    purpose = 'xp_scorer'; reply = xpMode === 'ok' ? SCORER_JSON : { status: 500, error: 'model down' }
  } else if (last.includes('independent companion activity')) {
    purpose = 'companion_outcome'; reply = COMPANION_OUTCOME
  } else if (last.includes('Extract ONLY the important details from this session')) {
    purpose = 'notes'; reply = 'NPCS MET:\n- None of note this session.'
  } else if (last.includes('List ALL named NPCs')) {
    purpose = 'npcs'; reply = 'NONE'
  } else if (last.includes('CHARACTER PERSONALITY observations')) {
    purpose = 'memories'; reply = 'NO_NEW_MEMORIES'
  } else if (all.includes('Guidelines for canon_facts')) {
    purpose = 'chronicle'; reply = CHRONICLE_JSON
  }
  purposes.push(purpose)
  return reply
}

// ─── Fixture building ───────────────────────────────────────────────────────

// A campaign one year in: the absolute day counter (entity_schedule's scale)
// has passed 365, while the Harptos day-of-year (characters.game_day and the
// deadline columns) reset at the new year. Both scales are always in sync
// (scheduleService.js header), so this is an ordinary world clock.
const ABS_START = 465
const DOY_START = 100
const SPAN_DAYS = 3

const cleanup = { fixtures: [], schedules: [], orders: [], merchants: [], companions: [], npcs: [], runs: [] }

const PROTECTED = ['current_hp', 'max_hp', 'gold_cp', 'gold_sp', 'gold_gp', 'inventory', 'equipment',
  'death_save_successes', 'death_save_failures', 'is_unconscious', 'active_conditions', 'current_location']
async function protectedSnapshot(characterId) {
  const row = await dbGet(`SELECT ${PROTECTED.join(', ')} FROM characters WHERE id = ?`, [characterId])
  return JSON.stringify(row)
}

function cumulativeToReach(level) {
  let n = 0
  for (let l = 1; l < level; l++) n += xpToNext(l)
  return n
}

async function buildLoopFixture(prefix, { withPendingState = true } = {}) {
  const f = await seedTurnFixture(dbRun, { prefix, playerTurns: 2, hp: 22, maxHp: 30 })
  cleanup.fixtures.push(f)

  // The campaign's world clock, before anything else touches it.
  await dbRun(
    `INSERT INTO world_clock (campaign_id, current_day, current_day_of_year, current_year, current_hour)
     VALUES (?, ?, ?, 1492, 8)`,
    [f.campaignId, ABS_START, DOY_START]
  )

  // An unspent XP award waiting at session end: one point short of level 4.
  const experience = cumulativeToReach(4) - 1
  await dbRun(
    `UPDATE characters SET game_hour = 8, gold_gp = 37, gold_sp = 4, gold_cp = 9, experience = ?,
       inventory = ?, ability_scores = ? WHERE id = ?`,
    [experience,
      JSON.stringify([{ name: 'Rope (50 ft)', quantity: 1 }, { name: 'Potion of Healing', quantity: 2 }]),
      JSON.stringify({ str: 16, dex: 12, con: 14, int: 10, wis: 12, cha: 10 }),
      f.characterId]
  )
  f.experienceBefore = experience

  if (!withPendingState) return f

  // A companion away on an in-flight scouting schedule that comes due during
  // the session (absolute days 460 → 467; the session ends on 468).
  const npc = await dbRun('INSERT INTO npcs (name, race, occupation) VALUES (?, ?, ?)', [`${prefix} Mira`, 'Human', 'Scout'])
  f.npcId = Number(npc.lastInsertRowid); cleanup.npcs.push(f.npcId)
  const comp = await dbRun(
    "INSERT INTO companions (npc_id, recruited_by_character_id, status) VALUES (?, ?, 'away')",
    [f.npcId, f.characterId]
  )
  f.companionId = Number(comp.lastInsertRowid); cleanup.companions.push(f.companionId)
  f.companionName = `${prefix} Mira`
  const act = await dbRun(
    `INSERT INTO entity_schedule (entity_type, entity_id, entity_name, activity, location, start_day, end_day, status, details_json)
     VALUES ('companion', ?, ?, 'scouting', 'the river road', ?, ?, 'active', ?)`,
    [f.companionId, f.companionName, ABS_START - 5, ABS_START + 2,
      JSON.stringify({ campaign_id: f.campaignId, character_id: f.characterId, companion_id: f.companionId, description: 'Scout the river road.' })]
  )
  f.activityId = Number(act.lastInsertRowid); cleanup.schedules.push(f.activityId)
  await dbRun('UPDATE companions SET away_activity_id = ? WHERE id = ?', [f.activityId, f.companionId])

  // An NPC's in-flight schedule over the same days (not a companion).
  const npcSched = await dbRun(
    `INSERT INTO entity_schedule (entity_type, entity_id, entity_name, activity, start_day, end_day, status, details_json)
     VALUES ('npc', NULL, ?, 'ferrying', ?, ?, 'active', ?)`,
    [`${prefix} Ferryman`, ABS_START - 5, ABS_START + 2, JSON.stringify({ campaign_id: f.campaignId })]
  )
  f.npcScheduleId = Number(npcSched.lastInsertRowid); cleanup.schedules.push(f.npcScheduleId)

  // Two commissions with the smith, deadlines on the day-of-year scale
  // (merchantOrderService places them on characters.game_day): one due
  // during the session (day 102), one not due for weeks (day 150).
  const m = await dbRun(
    "INSERT INTO merchant_inventories (campaign_id, merchant_name, merchant_type) VALUES (?, ?, 'blacksmith')",
    [f.campaignId, `${prefix} Smith`]
  )
  f.merchantId = Number(m.lastInsertRowid); cleanup.merchants.push(f.merchantId)
  const order = async (item, deadline) => {
    const r = await dbRun(
      `INSERT INTO merchant_orders (merchant_id, character_id, item_name, quoted_price_cp, deposit_paid_cp, balance_cp,
         commissioned_game_day, deadline_game_day, status)
       VALUES (?, ?, ?, 5000, 2500, 2500, 95, ?, 'pending')`,
      [f.merchantId, f.characterId, item, deadline]
    )
    const id = Number(r.lastInsertRowid); cleanup.orders.push(id); return id
  }
  f.dueOrderId = await order(`${prefix} longsword`, DOY_START + 2)
  f.laterOrderId = await order(`${prefix} shield`, DOY_START + 50)
  await addScenes(f)
  return f
}

/**
 * Two places in the campaign (G-7): one generated six years before the
 * session (a "minor" band crossed, no history yet → an evolution
 * candidate) and one generated on the session's start day (stable → not).
 */
async function addScenes(f) {
  const scene = async (name, generatedDay) => Number((await dbRun(
    "INSERT INTO scenes (campaign_id, name, kind, status, generated_world_day, generated_world_year) VALUES (?, ?, 'dungeon', 'skeleton', ?, ?)",
    [f.campaignId, name, generatedDay, 1492]
  )).lastInsertRowid)
  f.oldSceneId = await scene(`${f.prefix || 'TEST_RL'} Old Watchtower`, ABS_START - 6 * 365)
  f.freshSceneId = await scene(`${f.prefix || 'TEST_RL'} New Barrow`, ABS_START)
}

/** Time passes in play through the same service the [TIME_ADVANCE] marker uses. */
async function playThreeDays(f) {
  await advanceTimeForSession({
    sessionId: f.sessionId, characterId: f.characterId,
    hours: SPAN_DAYS * 24, reason: 'the road to Harrowmere and back'
  })
}

function freshRead(queries) {
  const r = spawnSync(process.execPath, [path.join(REPO, 'tests', 'helpers', 'freshDbRead.mjs'), JSON.stringify(queries)], {
    cwd: REPO, env: process.env, encoding: 'utf8', timeout: 60000
  })
  const line = (r.stdout || '').trim().split('\n').pop()
  try { return JSON.parse(line) } catch { return { error: r.stderr || r.stdout || `exit ${r.status}` } }
}

// ─── Run ────────────────────────────────────────────────────────────────────

await initDatabase()
delete process.env.FF_LIVING_WORLD_TICK // MVP posture: the living-world tick is off
const llm = installLlmStub({ strict: false, fallback: 'The road is quiet.' })
for (let i = 0; i < 400; i++) llm.reply(dispatch)
const server = await startTurnServer()

try {
  const A = await buildLoopFixture('TEST_RL_A')
  const BY = await seedTurnFixture(dbRun, { prefix: 'TEST_RL_BY' }) // a bystander in another campaign
  cleanup.fixtures.push(BY)
  const expectedXp = calculateSessionRewards(SCORES, 3).xp

  // ═════════════════════════════════════════════════════════════════════════
  console.log('\n=== STEP 1 [end] — a session with pending state ends ===\n')
  // ═════════════════════════════════════════════════════════════════════════
  await playThreeDays(A)
  const midSession = await dbGet('SELECT level, experience FROM characters WHERE id = ?', [A.characterId])
  check(midSession.level === 3 && midSession.experience === A.experienceBefore,
    `[end] before the session ends, time passing in play changes neither level nor XP (level ${midSession.level})`)
  check(expectedXp >= 1, `[end] the scored session is worth XP (${expectedXp}), enough to cross into level 4`)

  const protectBefore = await protectedSnapshot(A.characterId)
  const bystanderBefore = await dbGet('SELECT game_day, game_year, game_hour FROM characters WHERE id = ?', [BY.characterId])

  purposes.length = 0
  const endRes = await server.post(`/api/dm-session/${A.sessionId}/end`, {}) // exactly what the client sends
  check(endRes.status === 200, `[end] POST /end answers 200 (got ${endRes.status})`)
  const endedSession = await dbGet('SELECT status, summary, rewards, game_end_day, game_end_year FROM dm_sessions WHERE id = ?', [A.sessionId])
  check(endedSession.status === 'completed', `[end] the session row is completed (got ${endedSession.status})`)
  check(endedSession.summary === SUMMARY, `[end] the session summary is stored (got ${show(endedSession.summary)})`)
  const runs = await dbAll('SELECT stage, status FROM session_end_runs WHERE session_id = ? ORDER BY id', [String(A.sessionId)])
  cleanup.runs.push(String(A.sessionId))
  check(eq(runs.map((r) => r.stage), ['xp', 'downtime', 'domains', 'digest', 'sweep']),
    `[end] the orchestrator ran its five stages in order (${runs.map((r) => r.stage).join(' → ')})`)
  check(runs.every((r) => r.status === 'complete'), `[end] every stage completed (${runs.map((r) => `${r.stage}:${r.status}`).join(', ')})`)
  check(endRes.body?.rewards?.xp === expectedXp, `[end] the XP award is reported to the player (${endRes.body?.rewards?.xp} of ${expectedXp})`)
  for (const p of ['analysis', 'xp_scorer', 'companion_outcome', 'notes', 'npcs', 'memories', 'chronicle']) {
    check(purposes.includes(p), `[end] session end asked the model for: ${p}`)
  }
  check(!purposes.includes('other'), `[end] session end made no model call outside the known set (${purposes.join(', ')})`)

  // ═════════════════════════════════════════════════════════════════════════
  console.log('\n=== STEP 2 [clock] — the clock advanced by the session-end span ===\n')
  // ═════════════════════════════════════════════════════════════════════════
  check(endRes.body?.daysElapsed === SPAN_DAYS, `[clock] the session-end span is the ${SPAN_DAYS} days that passed in play (got ${endRes.body?.daysElapsed})`)
  const clockA = await dbGet('SELECT current_day, current_day_of_year, current_year FROM world_clock WHERE campaign_id = ?', [A.campaignId])
  check(clockA.current_day_of_year === DOY_START + SPAN_DAYS && clockA.current_year === 1492,
    `[clock] the campaign clock reads day ${DOY_START + SPAN_DAYS} of 1492 (got ${clockA.current_day_of_year}/${clockA.current_year})`)
  check(clockA.current_day === ABS_START + SPAN_DAYS, `[clock] the absolute day counter moved by the same span (${ABS_START} → ${clockA.current_day})`)
  const charA = await dbGet('SELECT game_day, game_year FROM characters WHERE id = ?', [A.characterId])
  check(charA.game_day === DOY_START + SPAN_DAYS, `[clock] the character's date moved with it (day ${charA.game_day})`)
  check(endedSession.game_end_day === DOY_START + SPAN_DAYS && endedSession.game_end_year === 1492,
    `[clock] the session row records where it ended (day ${endedSession.game_end_day})`)
  const bystanderAfter = await dbGet('SELECT game_day, game_year, game_hour FROM characters WHERE id = ?', [BY.characterId])
  check(eq(bystanderAfter, bystanderBefore), '[clock] S1 invariant holds across the loop: a character in another campaign did not move')

  // ═════════════════════════════════════════════════════════════════════════
  console.log('\n=== STEP 3 [tick] — what session end resolves ===\n')
  // ═════════════════════════════════════════════════════════════════════════
  check(FEATURE_FLAGS.LIVING_WORLD_TICK === false, '[tick] MVP posture: the living-world tick flag is off')
  check(endRes.body?.worldTick === undefined, '[tick] so session end runs no living-world tick (none reported)')
  const sweep = await dbGet("SELECT status, detail_json FROM session_end_runs WHERE session_id = ? AND stage = 'sweep'", [String(A.sessionId)])
  const sweepDetail = JSON.parse(sweep?.detail_json || '{}')
  check(sweep?.status === 'complete', '[tick] the deferred-resolution sweep ran at session end')
  check(sweepDetail.activitiesResolved === 1, `[tick] the sweep resolved the companion's due scouting run (resolved ${sweepDetail.activitiesResolved})`)
  const act = await dbGet('SELECT status, details_json FROM entity_schedule WHERE id = ?', [A.activityId])
  check(act.status === 'completed', `[tick] the companion's schedule is completed (got ${act.status})`)
  check(JSON.parse(act.details_json).reunion_narrative === REUNION, '[tick] the outcome (reunion line) is stored on the schedule')
  const compA = await dbGet('SELECT status, away_activity_id FROM companions WHERE id = ?', [A.companionId])
  check(compA.status === 'active' && compA.away_activity_id === null, `[tick] the companion is back with the party (status ${compA.status})`)
  const reunionQ = await dbGet("SELECT status FROM narrative_queue WHERE character_id = ? AND title = ?", [A.characterId, `${A.companionName} returns`])
  check(reunionQ?.status === 'pending', '[tick] the companion\'s return is queued for the next session')
  const dueOrder = await dbGet('SELECT status, ready_game_day FROM merchant_orders WHERE id = ?', [A.dueOrderId])
  check(dueOrder.status === 'ready', `[tick] the commission due on day ${DOY_START + 2} is ready (got ${dueOrder.status})`)
  check(dueOrder.ready_game_day === DOY_START + SPAN_DAYS,
    `[tick] GAP G-3: the commission is stamped ready on the day-of-year scale its deadline uses, day ${DOY_START + SPAN_DAYS} (got ${dueOrder.ready_game_day} — the absolute day counter)`)
  const laterOrder = await dbGet('SELECT status FROM merchant_orders WHERE id = ?', [A.laterOrderId])
  check(laterOrder.status === 'pending',
    `[tick] GAP G-3: the commission not due until day ${DOY_START + 50} is still being made (got ${laterOrder.status} — the sweep compares a day-of-year deadline with the absolute day counter)`)
  const npcSched = await dbGet('SELECT status FROM entity_schedule WHERE id = ?', [A.npcScheduleId])
  check(npcSched.status === 'active',
    '[tick] by design ("resolving nothing yet"): a non-companion schedule that came due stays active — session end resolves only companion activities and commissions')
  // G-7 behaviour check (replaces the old source check): the session's
  // world-clock advance evaluated the campaign's scenes and produced the
  // one candidate whose band was crossed. Candidates are written nowhere
  // (tickEvolution writes nothing by design); they ride the response.
  const evoCands = endRes.body?.sceneEvolution?.candidates || []
  check(evoCands.some((c) => c.sceneId === A.oldSceneId && c.band === 'minor') && !evoCands.some((c) => c.sceneId === A.freshSceneId),
    `[tick] GAP G-7: a world-clock advance at session end evaluates scene evolution (got ${show(evoCands)})`)
  check(endRes.body?.sceneEvolution?.worldDay === ABS_START + SPAN_DAYS,
    `[tick] scene evolution was evaluated against the clock where the session left it, day ${ABS_START + SPAN_DAYS} (got ${endRes.body?.sceneEvolution?.worldDay})`)
  const evoWrites = await dbGet(
    `SELECT (SELECT COUNT(*) FROM scene_evolution_history WHERE scene_id IN (?, ?)) AS h,
            (SELECT COUNT(*) FROM scene_evolution_news WHERE scene_id IN (?, ?)) AS n`,
    [A.oldSceneId, A.freshSceneId, A.oldSceneId, A.freshSceneId])
  check(Number(evoWrites.h) === 0 && Number(evoWrites.n) === 0,
    '[tick] a candidate is not an evolution: no chapter and no news were written (application stays DM-proposed)')
  {
    // A session in which no world time passed evaluates nothing.
    const N = await buildLoopFixture('TEST_RL_N', { withPendingState: false })
    await addScenes(N)
    const res = await server.post(`/api/dm-session/${N.sessionId}/end`, {})
    cleanup.runs.push(String(N.sessionId))
    check(res.status === 200 && res.body?.daysElapsed === 0 && res.body?.sceneEvolution === undefined,
      `[tick] a session end that does not advance the world clock evaluates no scene evolution (days ${res.body?.daysElapsed}, sceneEvolution ${show(res.body?.sceneEvolution)})`)
  }

  // ═════════════════════════════════════════════════════════════════════════
  console.log('\n=== STEP 4 [persist] — the state is on disk, read through a new connection ===\n')
  // ═════════════════════════════════════════════════════════════════════════
  const Q = [
    ['SELECT id, level, experience, level_up_pending_choices, game_day, game_year, current_hp, max_hp, gold_gp, gold_sp, gold_cp, inventory FROM characters WHERE id = ?', [A.characterId]],
    ['SELECT campaign_id, current_day, current_day_of_year, current_year FROM world_clock WHERE campaign_id = ?', [A.campaignId]],
    ['SELECT id, status FROM entity_schedule WHERE id IN (?, ?) ORDER BY id', [A.activityId, A.npcScheduleId]],
    ['SELECT id, status, ready_game_day FROM merchant_orders WHERE id IN (?, ?) ORDER BY id', [A.dueOrderId, A.laterOrderId]],
    ['SELECT id, status, summary, game_end_day, game_end_year FROM dm_sessions WHERE id = ?', [A.sessionId]],
    ['SELECT stage, status FROM session_end_runs WHERE session_id = ? ORDER BY id', [String(A.sessionId)]],
    ['SELECT session_id, summary FROM story_chronicles WHERE session_id = ?', [A.sessionId]],
    ['SELECT title, status FROM narrative_queue WHERE character_id = ? ORDER BY id', [A.characterId]],
    ['SELECT status, away_activity_id FROM companions WHERE id = ?', [A.companionId]]
  ]
  const fresh = freshRead(Q)
  check(Array.isArray(fresh), `[persist] a separate process opened the database file and read it back${Array.isArray(fresh) ? '' : ` (error: ${show(fresh.error).slice(0, 300)})`}`)
  if (Array.isArray(fresh)) {
    const labels = ['character', 'world clock', 'schedules', 'commissions', 'session', 'session-end stages', 'chronicle', 'narrative queue', 'companion']
    for (let i = 0; i < Q.length; i++) {
      const mine = await dbAll(Q[i][0], Q[i][1])
      check(eq(fresh[i], mine) && fresh[i].length > 0, `[persist] ${labels[i]}: the fresh read matches (${fresh[i].length} row(s))`)
    }
    const ch = fresh[0][0]
    check(ch.level === 4 && ch.experience === A.experienceBefore + expectedXp,
      `[persist] the level-up is on disk: level ${ch.level}, XP ${ch.experience}`)
    check(fresh[6][0]?.summary === CHRONICLE_SUMMARY, '[persist] the session chronicle (the DM\'s memory of the session) is on disk')
  }

  // ═════════════════════════════════════════════════════════════════════════
  console.log('\n=== STEP 5 [return] — a summary is waiting on return and names what changed ===\n')
  // ═════════════════════════════════════════════════════════════════════════
  const xpAfterEnd = (await dbGet('SELECT experience FROM characters WHERE id = ?', [A.characterId])).experience
  const claim = await server.post(`/api/dm-session/${A.sessionId}/claim`, {}) // the client's "claim rewards" button
  check(claim.status === 200, `[return] the ended session's rewards are claimed (got ${claim.status})`)
  const xpAfterClaim = (await dbGet('SELECT experience FROM characters WHERE id = ?', [A.characterId])).experience
  check(xpAfterClaim === xpAfterEnd,
    `[return] GAP G-1: the session's XP is awarded once — claiming does not add it again (XP after end ${xpAfterEnd}, after claim ${xpAfterClaim}, award ${expectedXp})`)

  const ctx = await server.get(`/api/dm-session/campaign-context/${A.characterId}`)
  check(ctx.status === 200 && ctx.body?.hasPreviousSessions === true, '[return] the campaign page knows there was a previous session')
  check(ctx.body?.lastSession?.summary === SUMMARY, `[return] the last session's summary is there (got ${show(ctx.body?.lastSession?.summary)})`)
  check(ctx.body?.lastSession?.gameEndDay === DOY_START + SPAN_DAYS, '[return] with the date the session ended')
  const hist = await server.get(`/api/dm-session/history/${A.characterId}`)
  const histRow = (hist.body?.sessions || []).find((s) => s.id === A.sessionId)
  check(histRow?.summary === SUMMARY && histRow?.rewards?.xp === expectedXp, '[return] the session history lists the session, its summary and its XP')

  const queuedBefore = await dbAll("SELECT id, title FROM narrative_queue WHERE character_id = ? AND status = 'pending'", [A.characterId])
  llm.reset(); for (let i = 0; i < 400; i++) llm.reply(dispatch)
  const start = await server.post('/api/dm-session/start', {
    characterId: A.characterId,
    startingLocation: { name: 'Harrowmere', description: 'A river town.', region: 'Sword Coast' },
    continueCampaign: true,
    previousSessionSummaries: ctx.body?.recentSummaries || []
  })
  check(start.status === 200 && Number.isInteger(start.body?.sessionId), `[return] the character starts playing again (got ${start.status} ${show(start.body?.error || '')})`)
  const opening = llm.calls.find((c) => String(c.lastUserMessage).includes('CONTINUATION from the previous session'))
  check(!!opening, '[return] the opening scene is asked for as a continuation of the last session')
  check(!!opening && String(opening.lastUserMessage).includes(CHRONICLE_SUMMARY),
    '[return] the DM is told what happened last time (the session chronicle)')
  check(!!opening && String(opening.system).includes(REUNION),
    '[return] the DM is told the companion came back, with the companion\'s own line')
  check(!!opening && String(opening.system).includes(`TEST_RL_A longsword`),
    '[return] the DM is told the commission is ready to collect')
  const delivered = await dbAll(
    `SELECT id FROM narrative_queue WHERE character_id = ? AND status = 'delivered' AND id IN (${queuedBefore.map(() => '?').join(',') || 'NULL'})`,
    [A.characterId, ...queuedBefore.map((q) => q.id)]
  )
  check(queuedBefore.length >= 2 && delivered.length === queuedBefore.length,
    `[return] every waiting item was delivered into the new session (${delivered.length} of ${queuedBefore.length})`)
  const newSession = await dbGet('SELECT game_start_day, game_start_year FROM dm_sessions WHERE id = ?', [start.body?.sessionId])
  check(newSession?.game_start_day === DOY_START + SPAN_DAYS && newSession?.game_start_year === 1492,
    `[return] the new session starts on the day the last one ended (day ${newSession?.game_start_day})`)
  const levelOnReturn = await dbGet('SELECT level FROM characters WHERE id = ?', [A.characterId])
  check(levelOnReturn.level === 4, '[return] the level gained at session end is still there; the return itself changes no level')

  // ═════════════════════════════════════════════════════════════════════════
  console.log('\n=== PROTECT [protect] — the PC is safe; downtime only on opt-in; XP never blocks ===\n')
  // ═════════════════════════════════════════════════════════════════════════
  check(await protectedSnapshot(A.characterId) === protectBefore,
    '[protect] across end → claim → return, the PC\'s HP, gold, gear, death saves, conditions and location are untouched')
  const charLevel = await dbGet('SELECT level, level_up_pending_choices FROM characters WHERE id = ?', [A.characterId])
  check(midSession.level === 3 && charLevel.level === 4 && !!charLevel.level_up_pending_choices,
    '[protect] the level landed at session end (3 during play → 4 at end), with its level-up choices queued')
  const dtA = await dbGet("SELECT detail_json FROM session_end_runs WHERE session_id = ? AND stage = 'downtime'", [String(A.sessionId)])
  check(eq(JSON.parse(dtA.detail_json), { path: 'clean', scheduled: 0 }), '[protect] with no opt-in, the downtime stage took the clean path and scheduled nothing')
  const dtRows = await dbAll("SELECT id FROM entity_schedule WHERE json_extract(details_json, '$.downtime') = 1 AND entity_name LIKE 'TEST_RL_A%'")
  check(dtRows.length === 0, '[protect] no downtime schedule exists for the character\'s people')

  // The world tick ON: the PC is still protected when every tick step runs.
  {
    const T = await buildLoopFixture('TEST_RL_T', { withPendingState: false })
    await playThreeDays(T)
    const before = await protectedSnapshot(T.characterId)
    process.env.FF_LIVING_WORLD_TICK = 'true'
    let res
    try { res = await server.post(`/api/dm-session/${T.sessionId}/end`, {}) } finally { delete process.env.FF_LIVING_WORLD_TICK }
    cleanup.runs.push(String(T.sessionId))
    check(res.status === 200 && !!res.body?.worldTick, `[protect] with the living-world tick switched on, the session ends and the tick runs (got ${res.status})`)
    check(await protectedSnapshot(T.characterId) === before, '[protect] and the tick leaves the PC\'s HP, gold, gear, death saves, conditions and location untouched')
  }

  // Opt-in honoured: a short skip moves the clock by the skip, on top of play.
  {
    const S = await buildLoopFixture('TEST_RL_S', { withPendingState: false })
    await playThreeDays(S)
    const res = await server.post(`/api/dm-session/${S.sessionId}/end`, { downtimeChoice: { path: 'short', days: 2 } })
    cleanup.runs.push(String(S.sessionId))
    check(res.status === 200 && res.body?.daysElapsed === SPAN_DAYS + 2,
      `[protect] when the player opts in to a short skip, the clock moves by play plus the skip (${res.body?.daysElapsed} days)`)
  }

  // A "be right back" answer is a clean end, even on the full-downtime path.
  {
    const K = await buildLoopFixture('TEST_RL_K', { withPendingState: false })
    await playThreeDays(K)
    const res = await server.post(`/api/dm-session/${K.sessionId}/end`, { downtimeChoice: { path: 'full', text: "I'll be right back", spanDays: 10 } })
    cleanup.runs.push(String(K.sessionId))
    const dt = await dbGet("SELECT detail_json FROM session_end_runs WHERE session_id = ? AND stage = 'downtime'", [String(K.sessionId)])
    check(res.status === 200 && JSON.parse(dt.detail_json).path === 'clean' && res.body?.daysElapsed === SPAN_DAYS,
      '[protect] "I\'ll be right back" schedules nothing and adds no time')
  }

  // Full downtime through the route: the player's assignment must be scheduled.
  {
    const D = await buildLoopFixture('TEST_RL_D')
    await playThreeDays(D)
    const res = await server.post(`/api/dm-session/${D.sessionId}/end`, {
      downtimeChoice: { path: 'full', text: `${D.companionName} scouts the ford.`, spanDays: 5 }
    })
    cleanup.runs.push(String(D.sessionId))
    const dt = JSON.parse((await dbGet("SELECT detail_json FROM session_end_runs WHERE session_id = ? AND stage = 'downtime'", [String(D.sessionId)]))?.detail_json || '{}')
    check(res.status === 200 && dt.path === 'full', '[protect] a full-downtime choice reaches the downtime stage')
    check(dt.scheduled >= 1,
      `[protect] GAP G-4: the player's downtime assignment for ${D.companionName} is scheduled (scheduled ${dt.scheduled} — the route passes no roster)`)
    const rows = await dbAll("SELECT details_json FROM entity_schedule WHERE json_extract(details_json, '$.downtime') = 1 AND entity_name = ?", [D.companionName])
    check(rows.every((r) => (JSON.parse(r.details_json).protect_entity_ids || []).includes(D.characterId)),
      '[protect] every downtime schedule that exists names the PC as protected')
  }

  // Full downtime at the service: the assignment is scheduled, the PC protected, the clock jumps.
  {
    const V = await buildLoopFixture('TEST_RL_V')
    const runId = `TEST_RL_SVC_${V.sessionId}`
    cleanup.runs.push(runId)
    const clockBefore = await dbGet('SELECT current_day FROM world_clock WHERE campaign_id = ?', [V.campaignId])
    const out = await orchestrateEnd(runId, {
      characterId: V.characterId, campaignId: V.campaignId, llmCall: null,
      downtimeChoice: { path: 'full', text: `${V.companionName} trains with the town guard.`, spanDays: 5 },
      roster: [{ id: V.companionId, name: V.companionName, type: 'companion' }]
    })
    check(out.downtime.scheduled === 1 && eq(out.downtime.protectEntityIds, [V.characterId]),
      '[protect] given a roster, the downtime stage schedules the assignment and protects the PC')
    const row = await dbGet("SELECT id, entity_type, entity_id, details_json FROM entity_schedule WHERE entity_name = ? AND json_extract(details_json, '$.downtime') = 1", [V.companionName])
    if (row) cleanup.schedules.push(row.id)
    check(row?.entity_type === 'companion' && row?.entity_id === V.companionId && eq(JSON.parse(row.details_json).protect_entity_ids, [V.characterId]),
      '[protect] the schedule row is the companion\'s, and carries the PC in protect_entity_ids')
    check(!(await dbGet("SELECT id FROM entity_schedule WHERE entity_type = 'character' AND entity_id = ? AND json_extract(details_json, '$.downtime') = 1", [V.characterId])),
      '[protect] the PC is never given a downtime schedule')
    const clockAfter = await dbGet('SELECT current_day FROM world_clock WHERE campaign_id = ?', [V.campaignId])
    check(clockAfter.current_day === clockBefore.current_day + 5,
      `[protect] GAP G-5: full downtime jumps the clock by its span, 5 days (moved ${clockAfter.current_day - clockBefore.current_day})`)
    check(out.xp.status === 'pending_llm', '[protect] with no model to score it, the XP stage is held as pending, not lost')
  }

  // The opt-in can be offered in play.
  {
    const client = read('client/src/components/DMSession.jsx')
    const endCall = client.slice(client.indexOf('const endSession = async'), client.indexOf('const endSession = async') + 600)
    check(/downtimeChoice/.test(endCall),
      '[protect] GAP G-6: the client\'s end-session request can carry the player\'s downtime choice (it posts /end with no body)')
    const offered = ['server/routes/dmSession.js', 'client/src/components/DMSession.jsx'].some((f) => /promptDowntimeOptIn|What should everyone be doing while you're away/.test(read(f)))
    check(offered, '[protect] GAP G-6: the steward\'s downtime question is put to the player at session end (promptDowntimeOptIn has no caller)')
  }

  // A failed XP score never blocks the return, and is retried at the next start.
  {
    const X = await buildLoopFixture('TEST_RL_X', { withPendingState: false })
    await playThreeDays(X)
    xpMode = 'down'
    let res
    try { res = await server.post(`/api/dm-session/${X.sessionId}/end`, {}) } finally { xpMode = 'ok' }
    cleanup.runs.push(String(X.sessionId))
    const xpRun = await dbGet("SELECT status FROM session_end_runs WHERE session_id = ? AND stage = 'xp'", [String(X.sessionId)])
    const sess = await dbGet('SELECT status FROM dm_sessions WHERE id = ?', [X.sessionId])
    check(res.status === 200 && sess.status === 'completed', '[protect] with the XP scorer down, the session still ends normally')
    check(xpRun.status !== 'complete', `[protect] the XP award is held back, not invented (stage ${xpRun.status})`)
    const others = await dbAll("SELECT status FROM session_end_runs WHERE session_id = ? AND stage != 'xp'", [String(X.sessionId)])
    check(others.length === 4 && others.every((r) => r.status === 'complete'), '[protect] the other four stages still completed')
    const xpBefore = (await dbGet('SELECT experience FROM characters WHERE id = ?', [X.characterId])).experience
    check(xpBefore === X.experienceBefore, '[protect] no XP was written for the unscored session')
    const c = await server.post(`/api/dm-session/${X.sessionId}/claim`, {})
    const s2 = await server.post('/api/dm-session/start', {
      characterId: X.characterId,
      startingLocation: { name: 'Harrowmere', description: 'A river town.', region: 'Sword Coast' }
    })
    check(c.status === 200 && s2.status === 200, `[protect] the return is not blocked: claim ${c.status}, next start ${s2.status}`)
    const xpRunAfter = await dbGet("SELECT status FROM session_end_runs WHERE session_id = ? AND stage = 'xp'", [String(X.sessionId)])
    const xpAfter = (await dbGet('SELECT experience FROM characters WHERE id = ?', [X.characterId])).experience
    check(xpRunAfter.status === 'complete' && xpAfter === X.experienceBefore + expectedXp,
      `[protect] GAP G-2: the held XP award is retried at the next session start (stage ${xpRunAfter.status}, XP ${xpBefore} → ${xpAfter})`)
  }
} finally {
  await server.close()
  restoreLlm()
  delete process.env.FF_LIVING_WORLD_TICK
}

// ─── Cleanup ────────────────────────────────────────────────────────────────
console.log('\n=== Cleanup ===\n')
const quiet = (p) => p.catch((e) => console.log(`  (cleanup note: ${e.message})`))
const _dbRun = dbRun
// Label each cleanup failure with the statement that hit it.
const cleanupRun = (sql, args) => _dbRun(sql, args).catch((e) => { throw new Error(`${e.message} [${sql.slice(0, 60)}]`) })
for (const id of cleanup.runs) await quiet(cleanupRun('DELETE FROM session_end_runs WHERE session_id = ?', [id]))
for (const id of cleanup.orders) await quiet(cleanupRun('DELETE FROM merchant_orders WHERE id = ?', [id]))
for (const id of cleanup.merchants) await quiet(cleanupRun('DELETE FROM merchant_inventories WHERE id = ?', [id]))
for (const id of cleanup.schedules) await quiet(cleanupRun('DELETE FROM entity_schedule WHERE id = ?', [id]))
await quiet(cleanupRun("DELETE FROM entity_schedule WHERE entity_name LIKE 'TEST_RL_%'"))
// Session end and session start write into many side tables (achievements,
// conversations, transcripts, mood, ...). Remove every row in any table that
// points at one of THIS suite's sessions, companions or characters, children
// first, so the parent deletes below are not blocked by a foreign key.
{
  const charIds = cleanup.fixtures.map((f) => f.characterId)
  const sessionIds = (await dbAll(
    `SELECT id FROM dm_sessions WHERE character_id IN (${charIds.map(() => '?').join(',')})`, charIds
  )).map((r) => r.id)
  const tables = (await dbAll("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")).map((r) => r.name)
  const purge = async (column, ids, skip = []) => {
    if (ids.length === 0) return
    for (const t of tables) {
      if (skip.includes(t)) continue
      const cols = (await dbAll(`PRAGMA table_info(${t})`)).map((c) => c.name)
      if (!cols.includes(column)) continue
      await quiet(cleanupRun(`DELETE FROM ${t} WHERE ${column} IN (${ids.map(() => '?').join(',')})`, ids))
    }
  }
  await purge('session_id', sessionIds, ['session_end_runs'])
  await purge('companion_id', cleanup.companions)
  await purge('character_id', charIds, ['dm_sessions'])
  for (const id of cleanup.companions) await quiet(cleanupRun('DELETE FROM companions WHERE id = ?', [id]))
}
for (const id of cleanup.npcs) await quiet(cleanupRun('DELETE FROM npcs WHERE id = ?', [id]))
for (const f of cleanup.fixtures) {
  await quiet(cleanupRun('DELETE FROM narrative_queue WHERE character_id = ?', [f.characterId]))
  await quiet(cleanupRun('DELETE FROM canon_facts WHERE campaign_id = ?', [f.campaignId]))
  await quiet(cleanupRun('DELETE FROM story_chronicles WHERE campaign_id = ?', [f.campaignId]))
  await quiet(cleanupRun('DELETE FROM campaign_weather WHERE campaign_id = ?', [f.campaignId]))
  await quiet(cleanupRun('DELETE FROM world_clock WHERE campaign_id = ?', [f.campaignId]))
  await quiet(cleanupRun('DELETE FROM scenes WHERE campaign_id = ?', [f.campaignId]))
  const extra = await dbAll('SELECT id FROM dm_sessions WHERE character_id = ? AND id != ?', [f.characterId, f.sessionId])
  for (const s of extra) {
    await quiet(cleanupRun('DELETE FROM ai_call_log WHERE session_id = ?', [s.id]))
    await quiet(cleanupRun('DELETE FROM dm_sessions WHERE id = ?', [s.id]))
  }
  await quiet(cleanupTurnFixture(dbRun, f))
}
const leftover = await dbGet("SELECT COUNT(*) AS n FROM characters WHERE name LIKE 'TEST_RL_%'")
check(Number(leftover.n) === 0, 'test characters removed')

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`)
process.exit(failed > 0 ? 1 : 0)
