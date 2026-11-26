/**
 * Session XP lands exactly once — return-loop-xp-fixes (2026-11-26).
 *
 * Brief: docs/pm/return-loop-xp-fixes/BRIEF.md. The return-loop suite holds
 * the two gap checks (G-1, G-2); this file covers what the brief adds on top:
 *
 *   [once]     end → claim: the player character's XP is the session-end
 *              total, the level agrees with it, and each active class-based
 *              companion gains the session award exactly once (item 2, 3).
 *   [held]     the scorer is down at end: the session still ends and the
 *              return is not blocked; a retry that fails again blocks nothing
 *              and awards nothing; the next successful retry awards the PC
 *              and the companion once; a later start awards nothing more
 *              (item 4).
 *   [race]     two retries of the same held award at once award it once.
 *
 * Runs over the stubbed-LLM harness. Replies are dispatched by what each
 * prompt asks for, not by call order (the return-loop lesson), so a change in
 * how many model calls session end or start makes cannot shift a reply.
 *
 * Every test row is invented and TEST_-prefixed; all rows are removed.
 */

import { initDatabase, dbRun, dbGet, dbAll } from '../server/database.js'
import { installLlmStub, restoreLlm, startTurnServer, seedTurnFixture, cleanupTurnFixture } from './helpers/llmHarness.js'
import { calculateSessionRewards, xpToNext } from '../server/services/xpService.js'
import { retryHeldXpAwards } from '../server/services/sessionEndService.js'

let passed = 0
let failed = 0
function check(cond, msg) {
  if (cond) { passed++; console.log(`  ✓ ${msg}`) } else { failed++; console.log(`  ✗ ${msg}`) }
}

const SCORER_JSON = JSON.stringify({
  combat: { opportunity: true, score: 6 },
  exploration: { opportunity: true, score: 7 },
  quests: { opportunity: true, score: 8 },
  discovery: { opportunity: false, score: null },
  social: { opportunity: true, score: 5 }
})
const SCORES = { combat: 6, exploration: 7, quests: 8, discovery: null, social: 5 }
const ANALYSIS = `SUMMARY: TEST_XO Hero held the bridge.
COMBAT: 6
EXPLORATION: 7
QUESTS: 8
DISCOVERY: 0
SOCIAL: 5
DANGER: 4
ITEMS_CONSUMED: [none]
GOLD_SPENT: [none]
ITEMS_GAINED: [none]`

let xpMode = 'ok'
let scorerCalls = 0
function dispatch(call) {
  const last = String(call.lastUserMessage || '')
  if (last.includes('The session is ending. Analyze what the party ACTUALLY accomplished')) return ANALYSIS
  if (last.includes('impartial session scorer')) {
    scorerCalls++
    return xpMode === 'ok' ? SCORER_JSON : { status: 500, error: 'model down' }
  }
  if (last.includes('List ALL named NPCs')) return 'NONE'
  if (last.includes('CHARACTER PERSONALITY observations')) return 'NO_NEW_MEMORIES'
  if (last.includes('Extract ONLY the important details from this session')) return 'NPCS MET:\n- None of note this session.'
  return 'You wake at dawn; the road is quiet.'
}

// Level implied by an XP total, on the same table awardSessionXP uses.
function levelFor(xp) {
  let level = 1; let cum = 0
  while (level < 50 && xp >= cum + xpToNext(level)) { cum += xpToNext(level); level++ }
  return level
}
const cumulativeToReach = (level) => { let c = 0; for (let l = 1; l < level; l++) c += xpToNext(l); return c }

await initDatabase()
const llm = installLlmStub({ strict: false, fallback: 'The road is quiet.' })
const refill = () => { llm.reset(); for (let i = 0; i < 400; i++) llm.reply(dispatch) }
refill()
const server = await startTurnServer()
const fixtures = []
const npcIds = []
const companionIds = []

async function buildFixture(prefix) {
  const f = await seedTurnFixture(dbRun, { prefix, playerTurns: 2 })
  fixtures.push(f)
  await dbRun(
    `INSERT INTO world_clock (campaign_id, current_day, current_day_of_year, current_year, current_hour)
     VALUES (?, 100, 100, 1492, 8)`, [f.campaignId])
  // One point short of level 4, so the session's award levels the PC up.
  f.experienceBefore = cumulativeToReach(4) - 1
  await dbRun('UPDATE characters SET experience = ?, gold_gp = 10 WHERE id = ?', [f.experienceBefore, f.characterId])
  const npc = await dbRun('INSERT INTO npcs (name, race, occupation) VALUES (?, ?, ?)', [`${prefix} Bren`, 'Dwarf', 'Guard'])
  f.npcId = Number(npc.lastInsertRowid); npcIds.push(f.npcId)
  const comp = await dbRun(
    `INSERT INTO companions (npc_id, recruited_by_character_id, status, progression_type, companion_class, companion_level, companion_experience)
     VALUES (?, ?, 'active', 'class_based', 'Fighter', 3, 1000)`, [f.npcId, f.characterId])
  f.companionId = Number(comp.lastInsertRowid); companionIds.push(f.companionId)
  f.award = calculateSessionRewards(SCORES, 3).xp
  return f
}
const pcXp = async (f) => (await dbGet('SELECT experience, level FROM characters WHERE id = ?', [f.characterId]))
const compXp = async (f) => (await dbGet('SELECT companion_experience FROM companions WHERE id = ?', [f.companionId])).companion_experience
const xpStage = async (sessionId) => {
  const r = await dbGet("SELECT status, detail_json FROM session_end_runs WHERE session_id = ? AND stage = 'xp'", [String(sessionId)])
  return r ? { status: r.status, detail: JSON.parse(r.detail_json || '{}') } : null
}
const START_BODY = (f) => ({ characterId: f.characterId, startingLocation: { name: 'TEST_XO Bridge', description: 'A stone bridge.', region: 'Sword Coast' } })
async function startThenAbort(f) {
  const s = await server.post('/api/dm-session/start', START_BODY(f))
  if (s.status === 200) await server.post(`/api/dm-session/${s.body.sessionId}/abort`, {})
  return s
}

try {
  // ═══════════════════════════════════════════════════════════════════════
  console.log('\n=== [once] end → claim awards the session XP exactly once ===\n')
  // ═══════════════════════════════════════════════════════════════════════
  {
    const A = await buildFixture('TEST_XO_A')
    const end = await server.post(`/api/dm-session/${A.sessionId}/end`, {})
    check(end.status === 200, `[once] the session ends (got ${end.status})`)
    const afterEnd = await pcXp(A)
    check(afterEnd.experience === A.experienceBefore + A.award, `[once] session end awards the PC's XP (${A.experienceBefore} + ${A.award} → ${afterEnd.experience})`)
    check(afterEnd.level === 4 && afterEnd.level === levelFor(afterEnd.experience), `[once] the level lands at session end and agrees with the total (level ${afterEnd.level})`)
    check(await compXp(A) === 1000, '[once] session end does not award the companion (the claim is its award)')

    const claim = await server.post(`/api/dm-session/${A.sessionId}/claim`, {})
    check(claim.status === 200, `[once] rewards are claimed (got ${claim.status})`)
    const afterClaim = await pcXp(A)
    check(afterClaim.experience === afterEnd.experience, `[once] claiming does not add the PC's XP again (${afterClaim.experience})`)
    check(afterClaim.level === levelFor(afterClaim.experience), `[once] after claim the level agrees with the total (level ${afterClaim.level})`)
    check(await compXp(A) === 1000 + A.award, `[once] the companion gains the session award once at claim (${await compXp(A)})`)
    check(claim.body?.companionXPResults?.[0]?.xpGained === A.award, '[once] the claim response names the companion\'s award')

    const again = await server.post(`/api/dm-session/${A.sessionId}/claim`, {})
    check(again.status === 400 && (await pcXp(A)).experience === afterEnd.experience && await compXp(A) === 1000 + A.award,
      `[once] a second claim is refused and changes nothing (got ${again.status})`)

    const before = scorerCalls
    const s = await startThenAbort(A)
    check(s.status === 200, `[once] the next session starts (got ${s.status})`)
    check(scorerCalls === before, '[once] a scored session is not scored again at the next start')
    check((await pcXp(A)).experience === afterEnd.experience && await compXp(A) === 1000 + A.award,
      '[once] the next start adds no XP to the PC or the companion')
  }

  // ═══════════════════════════════════════════════════════════════════════
  console.log('\n=== [held] a failed score is held, retried at start, and lands once ===\n')
  // ═══════════════════════════════════════════════════════════════════════
  {
    const B = await buildFixture('TEST_XO_B')
    xpMode = 'down'
    const end = await server.post(`/api/dm-session/${B.sessionId}/end`, {})
    const stage = await xpStage(B.sessionId)
    check(end.status === 200 && stage?.status === 'failed', `[held] with the scorer down the session ends and the XP stage is held (${end.status}, ${stage?.status})`)
    check(typeof stage?.detail?.sessionData?.narrative === 'string' && stage.detail.sessionData.narrative.length > 0,
      '[held] the session data the retry scores from is stored with the held stage')
    check((await pcXp(B)).experience === B.experienceBefore, '[held] no XP is written for the unscored session')
    const claim = await server.post(`/api/dm-session/${B.sessionId}/claim`, {})
    check(claim.status === 200 && await compXp(B) === 1000, `[held] the claim goes through and awards the companion nothing yet (${claim.status})`)

    // Retry fails again: start is not blocked, nothing is awarded.
    const s1 = await startThenAbort(B)
    const st1 = await xpStage(B.sessionId)
    check(s1.status === 200, `[held] with the scorer still down, the next start is not blocked (got ${s1.status})`)
    check(st1?.status === 'failed' && st1.detail.retries === 1, `[held] the award stays held after a failed retry (stage ${st1?.status}, retries ${st1?.detail?.retries})`)
    check((await pcXp(B)).experience === B.experienceBefore && await compXp(B) === 1000, '[held] a failed retry awards nothing')

    // Scorer back: the retry lands, once, for the PC and the companion.
    xpMode = 'ok'
    const s2 = await startThenAbort(B)
    const st2 = await xpStage(B.sessionId)
    const after = await pcXp(B)
    check(s2.status === 200 && st2?.status === 'complete' && st2.detail.retried === true, `[held] the next start retries the score and completes the stage (${s2.status}, ${st2?.status})`)
    check(after.experience === B.experienceBefore + B.award, `[held] the PC gains the session award once (${B.experienceBefore} → ${after.experience})`)
    check(after.level === 4 && after.level === levelFor(after.experience), `[held] the level agrees with the total (level ${after.level})`)
    const pending = JSON.parse((await dbGet('SELECT level_up_pending_choices FROM characters WHERE id = ?', [B.characterId])).level_up_pending_choices || '[]')
    check(pending.some((c) => c.level === 4), '[held] the level-up choices are queued with the retried level-up')
    check(await compXp(B) === 1000 + B.award, `[held] the companion gains the session award once (${await compXp(B)})`)
    const rewards = JSON.parse((await dbGet('SELECT rewards FROM dm_sessions WHERE id = ?', [B.sessionId])).rewards)
    check(rewards.xp === B.award && rewards.companionXpAwarded === B.award, '[held] the session\'s rewards record the retried award')

    const before = scorerCalls
    const s3 = await startThenAbort(B)
    check(s3.status === 200 && scorerCalls === before, '[held] a later start does not score the session again')
    check((await pcXp(B)).experience === B.experienceBefore + B.award && await compXp(B) === 1000 + B.award,
      '[held] a later start awards nothing more')
  }

  // ═══════════════════════════════════════════════════════════════════════
  console.log('\n=== [race] two retries of one held award at once ===\n')
  // ═══════════════════════════════════════════════════════════════════════
  {
    const C = await buildFixture('TEST_XO_C')
    await dbRun("UPDATE dm_sessions SET status = 'completed', rewards = ?, rewards_claimed = 1 WHERE id = ?",
      [JSON.stringify({ xp: 0, gold: { cp: 0, sp: 0, gp: 0 }, loot: null }), C.sessionId])
    await dbRun(`INSERT INTO session_end_runs (session_id, stage, status, detail_json, completed_at)
                 VALUES (?, 'xp', 'failed', ?, CURRENT_TIMESTAMP)`,
      [String(C.sessionId), JSON.stringify({ error: 'model down', sessionData: { narrative: 'TEST_XO_C held the bridge.' }, characterId: C.characterId })])
    const call = () => async () => SCORER_JSON
    const [r1, r2] = await Promise.all([
      retryHeldXpAwards(C.characterId, { llmCallFor: call }),
      retryHeldXpAwards(C.characterId, { llmCallFor: call })
    ])
    const landed = [...r1, ...r2].filter((r) => r.status === 'complete').length
    check(landed === 1, `[race] exactly one retry claims and awards the held score (${landed})`)
    check((await pcXp(C)).experience === C.experienceBefore + C.award, `[race] the PC gains the award once (${(await pcXp(C)).experience})`)
    check(await compXp(C) === 1000 + C.award, '[race] the companion gains the award once')
    const r3 = await retryHeldXpAwards(C.characterId, { llmCallFor: call })
    check(r3.length === 0, '[race] a further retry finds nothing held')
    const bad = await retryHeldXpAwards(C.characterId, { llmCallFor: () => { throw new Error('no') } })
    check(Array.isArray(bad), '[race] the retry never throws')
  }
} finally {
  await server.close()
  restoreLlm()
}

// ─── Cleanup ────────────────────────────────────────────────────────────────
console.log('\n=== Cleanup ===\n')
const quiet = (p) => p.catch((e) => console.log(`  (cleanup note: ${e.message})`))
const charIds = fixtures.map((f) => f.characterId)
const sessionIds = (await dbAll(`SELECT id FROM dm_sessions WHERE character_id IN (${charIds.map(() => '?').join(',')})`, charIds)).map((r) => r.id)
const tables = (await dbAll("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")).map((r) => r.name)
const purge = async (column, ids, skip = []) => {
  if (ids.length === 0) return
  for (const t of tables) {
    if (skip.includes(t)) continue
    const cols = (await dbAll(`PRAGMA table_info(${t})`)).map((c) => c.name)
    if (!cols.includes(column)) continue
    await quiet(dbRun(`DELETE FROM ${t} WHERE ${column} IN (${ids.map(() => '?').join(',')})`, ids))
  }
}
for (const id of sessionIds) await quiet(dbRun('DELETE FROM session_end_runs WHERE session_id = ?', [String(id)]))
await purge('session_id', sessionIds, ['dm_sessions', 'session_end_runs'])
await purge('companion_id', companionIds, ['companions'])
for (const id of companionIds) await quiet(dbRun('DELETE FROM companions WHERE id = ?', [id]))
await purge('npc_id', npcIds, ['npcs', 'companions'])
for (const id of npcIds) await quiet(dbRun('DELETE FROM npcs WHERE id = ?', [id]))
await purge('character_id', charIds, ['characters'])
for (const f of fixtures) {
  await quiet(dbRun('DELETE FROM world_clock WHERE campaign_id = ?', [f.campaignId]))
  for (const t of tables) {
    if (t === 'campaigns') continue
    const cols = (await dbAll(`PRAGMA table_info(${t})`)).map((c) => c.name)
    if (cols.includes('campaign_id')) await quiet(dbRun(`DELETE FROM ${t} WHERE campaign_id = ?`, [f.campaignId]))
  }
  await quiet(cleanupTurnFixture(dbRun, f))
}
const leftover = await dbGet("SELECT COUNT(*) AS n FROM characters WHERE name LIKE 'TEST_XO_%'")
check(Number(leftover.n) === 0, 'test characters removed')

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`)
process.exit(failed > 0 ? 1 : 0)
