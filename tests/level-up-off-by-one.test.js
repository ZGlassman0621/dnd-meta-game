/**
 * Level-up off-by-one fix — level-up-off-by-one-fix (PM option b, 2026-11-27).
 *
 * A level that session end gives a newly created character can actually
 * be taken. Creation writes class_levels (the record of levels taken), so
 * the level-up route counts the applied level from it rather than from
 * characters.level, which session end has already raised.
 *
 *   [create]    POST /api/character writes one class_levels entry
 *               { class, level, subclass } for a playable character; a
 *               creator-next draft gets none until its commit.
 *   [1->2]      the probed case: a new Fighter, real POST → real
 *               awardSessionXP to level 2 → real GET level-up-info + POST
 *               level-up. HP, features and the waiting choice land.
 *   [3->4]      the probed case: a Fighter created at level 3 reaching 4,
 *               with its ability-score choice taken at level-up.
 *   [backfill]  migration 118: a playable level-1 character with empty
 *               class_levels gets its record, then levels up after session
 *               end raises it; a level-2 character with empty class_levels
 *               is left untouched; a row already set is untouched.
 *
 * Every test character is invented and TEST_-prefixed; all rows are removed.
 */

import express from 'express'
import { initDatabase, dbRun, dbGet } from '../server/database.js'
import * as dbModule from '../server/database.js'
import { awardSessionXP, parsePendingChoices } from '../server/services/xpService.js'
import { getXPToNextLevel } from '../server/config/levelProgression.js'

let passed = 0
let failed = 0
function check(cond, msg) {
  if (cond) { passed++; console.log(`  ✓ ${msg}`) } else { failed++; console.log(`  ✗ ${msg}`) }
}
const J = JSON.stringify
const keys = (list) => (list || []).map((c) => `${c.level}:${c.type}`)
// A modest session: well under one level's XP at levels 1-3, so each award
// below crosses exactly the one threshold the character sits just under.
const SCORES = { combat: 6, exploration: 7, quests: 8, discovery: null, social: 5 }
const DB = { get: dbGet, run: dbRun }
const SCORES_ABIL = J({ str: 16, dex: 14, con: 14, int: 10, wis: 12, cha: 10 })

await initDatabase()
const ids = []

const app = express()
app.use(express.json())
app.use('/api/character', (await import('../server/routes/character.js')).default)
const server = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)) })
const base = `http://127.0.0.1:${server.address().port}`
async function req(method, url, body) {
  const res = await fetch(`${base}${url}`, { method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : J(body) })
  let json = null; try { json = await res.json() } catch {}
  return { status: res.status, json }
}
const row = (id) => dbGet('SELECT level, experience, max_hp, current_hp, class_levels, hit_dice, ability_scores, level_up_pending_choices FROM characters WHERE id = ?', [id])
const levelsOf = async (id) => { const r = await row(id); return r.class_levels ? JSON.parse(r.class_levels) : null }

try {
  console.log('\n=== [create] creation writes class_levels ===\n')
  {
    const c = await req('POST', '/api/character', { name: 'TEST_OB1 Created', class: 'Fighter', race: 'human' })
    ids.push(c.json.id)
    check(c.status === 201 && J(await levelsOf(c.json.id)) === J([{ class: 'Fighter', level: 1, subclass: null }]),
      `[create] a new Fighter is born with class_levels [Fighter 1] (got ${c.status} ${J(await levelsOf(c.json.id))})`)

    const d = await req('POST', '/api/character', { name: 'TEST_OB1 Draft', class: 'creating', creator: 'creator-next' })
    if (d.json?.id) ids.push(d.json.id)
    check(d.status === 201 && (await levelsOf(d.json.id)) === null,
      `[create] a creator-next draft gets no class_levels yet (got ${d.status} ${J(d.json?.id ? await levelsOf(d.json.id) : d.json)})`)

    // The PUT that flips a row to 'active' writes the record from the
    // row's class at that moment (manual creator submit / Prelude handoff).
    await req('PUT', `/api/character/${d.json.id}`, { class: 'Fighter' })
    check((await levelsOf(d.json.id)) === null, '[create] a draft PUT that picks a class still writes no record (not playable yet)')
    await req('PUT', `/api/character/${d.json.id}`, { creation_phase: 'active' })
    check(J(await levelsOf(d.json.id)) === J([{ class: 'Fighter', level: 1, subclass: null }]),
      `[create] flipping the draft to active writes class_levels [Fighter 1] (got ${J(await levelsOf(d.json.id))})`)
  }

  console.log('\n=== [1->2] a new Fighter takes the level session end gave ===\n')
  {
    const c = await req('POST', '/api/character', { name: 'TEST_OB2 Fighter', class: 'Fighter', race: 'human', max_hp: 12, current_hp: 12, ability_scores: SCORES_ABIL })
    const id = c.json.id; ids.push(id)
    await dbRun('UPDATE characters SET experience = ? WHERE id = ?', [getXPToNextLevel(1) - 1, id])
    const award = await awardSessionXP(id, SCORES, DB)
    const afterAward = await row(id)
    check(award.leveledUp && award.newLevel === 2 && afterAward.level === 2,
      `[1->2] session end raises the level to 2 (xp ${award.xpAwarded}, level ${afterAward.level})`)
    check(J(keys(parsePendingChoices(afterAward.level_up_pending_choices))) === J(['2:level_up_review']),
      `[1->2] the level-2 review choice is waiting (${keys(parsePendingChoices(afterAward.level_up_pending_choices)).join(', ')})`)

    const info = await req('GET', `/api/character/level-up-info/${id}`)
    check(info.status === 200, `[1->2] level-up info is offered, not refused (got ${info.status} ${J(info.json?.error || '')})`)

    const up = await req('POST', `/api/character/level-up/${id}`, { selectedClass: 'Fighter', hpRoll: 'average' })
    const r = await row(id)
    check(up.status === 200, `[1->2] the level-up is applied (got ${up.status} ${J(up.json?.error || '')})`)
    // Fighter d10 average 6 + CON +2 = 8 (2024 PHB, Fighter Hit Points).
    check(r.max_hp === 20 && r.current_hp === 20, `[1->2] hit points rise by 8, 12 → 20 (got max ${r.max_hp}, current ${r.current_hp})`)
    check(r.level === 2 && J(JSON.parse(r.class_levels)) === J([{ class: 'Fighter', level: 2, subclass: null }]),
      `[1->2] the sheet is level 2 and class_levels records Fighter 2 (${r.class_levels})`)
    check(J(JSON.parse(r.hit_dice)) === J({ d10: 2 }), `[1->2] hit dice are 2d10 (${r.hit_dice})`)
    const feats = (up.json?.newFeatures || up.json?.levelUpSummary?.newFeatures || []).map((f) => (typeof f === 'string' ? f : f?.name)).join(', ')
    check(/Action Surge/i.test(feats), `[1->2] the level-2 features land, Action Surge among them (${feats || J(Object.keys(up.json || {}))})`)
    check(parsePendingChoices(r.level_up_pending_choices).length === 0, '[1->2] the level-2 review choice is made by the level-up')
  }

  console.log('\n=== [3->4] a Fighter at 3 takes level 4 and its ability choice ===\n')
  {
    const c = await req('POST', '/api/character', { name: 'TEST_OB3 Fighter', class: 'Fighter', subclass: 'Champion', race: 'human', level: 3, max_hp: 28, current_hp: 28, ability_scores: SCORES_ABIL })
    const id = c.json.id; ids.push(id)
    check(J(await levelsOf(id)) === J([{ class: 'Fighter', level: 3, subclass: 'Champion' }]),
      `[3->4] created at level 3, class_levels records Fighter 3 (${J(await levelsOf(id))})`)
    await dbRun('UPDATE characters SET experience = ? WHERE id = ?', [2700 - 1, id])
    const award = await awardSessionXP(id, SCORES, DB)
    const afterAward = await row(id)
    check(award.newLevel === 4 && afterAward.level === 4, `[3->4] session end raises the level to 4 (level ${afterAward.level})`)
    check(J(keys(parsePendingChoices(afterAward.level_up_pending_choices))) === J(['4:asi_or_feat', '4:level_up_review']),
      `[3->4] the level-4 ability and review choices are waiting (${keys(parsePendingChoices(afterAward.level_up_pending_choices)).join(', ')})`)

    const info = await req('GET', `/api/character/level-up-info/${id}`)
    check(info.status === 200, `[3->4] level-up info is offered, not refused (got ${info.status} ${J(info.json?.error || '')})`)

    const up = await req('POST', `/api/character/level-up/${id}`, { selectedClass: 'Fighter', hpRoll: 'average', asiChoice: { type: 'asi', increases: { str: 1, con: 1 } } })
    const r = await row(id)
    check(up.status === 200, `[3->4] the level-up is applied (got ${up.status} ${J(up.json?.error || '')})`)
    const abil = JSON.parse(r.ability_scores)
    check(abil.str === 17 && abil.con === 15, `[3->4] the ability choice lands: STR 17, CON 15 (got STR ${abil.str}, CON ${abil.con})`)
    // d10 average 6 + CON +2 (CON 15 still +2) = 8.
    check(r.max_hp === 36, `[3->4] hit points rise by 8, 28 → 36 (got ${r.max_hp})`)
    check(r.level === 4 && J(JSON.parse(r.class_levels)) === J([{ class: 'Fighter', level: 4, subclass: 'Champion' }]),
      `[3->4] the sheet is level 4 and class_levels records Fighter 4 (${r.class_levels})`)
    check(parsePendingChoices(r.level_up_pending_choices).length === 0,
      `[3->4] both waiting level-4 choices are made (${keys(parsePendingChoices(r.level_up_pending_choices)).join(', ') || 'none left'})`)
  }

  console.log('\n=== [backfill] migration 118 ===\n')
  {
    // Rows as they were before this fix: no class_levels written at creation.
    const ins = async (name, level, classLevels) => {
      const r = await dbRun(
        `INSERT INTO characters (name, class, race, level, current_hp, max_hp, current_location, experience, experience_to_next_level, ability_scores, creation_phase, class_levels)
         VALUES (?, 'Fighter', 'Human', ?, 12, 12, 'TEST_OB_Keep', ?, 0, ?, 'active', ?)`,
        [name, level, getXPToNextLevel(1) - 1, SCORES_ABIL, classLevels])
      const id = Number(r.lastInsertRowid); ids.push(id); return id
    }
    const a = await ins('TEST_OB4 Old L1', 1, null)
    const b = await ins('TEST_OB4 Old L2', 2, null)
    const setLevels = J([{ class: 'Fighter', level: 1, subclass: 'Champion' }])
    const s = await ins('TEST_OB4 Already set', 1, setLevels)

    const mig = await import('../server/migrations/118_class_levels_backfill.js')
    await mig.up(dbModule.default)
    check(J(await levelsOf(a)) === J([{ class: 'Fighter', level: 1, subclass: null }]), `[backfill] a level-1 character with no record gets [Fighter 1] (${J(await levelsOf(a))})`)
    check((await levelsOf(b)) === null, '[backfill] a level-2 character with no record is left untouched (applied level not knowable)')
    check((await row(s)).class_levels === setLevels, '[backfill] a character whose class_levels is already set is untouched')
    await mig.up(dbModule.default)
    check(J(await levelsOf(a)) === J([{ class: 'Fighter', level: 1, subclass: null }]), '[backfill] re-running the migration is a no-op')

    await awardSessionXP(a, SCORES, DB)
    check((await row(a)).level === 2, '[backfill] session end raises the backfilled character to level 2')
    const up = await req('POST', `/api/character/level-up/${a}`, { selectedClass: 'Fighter', hpRoll: 'average' })
    const r = await row(a)
    check(up.status === 200 && r.max_hp === 20 && JSON.parse(r.class_levels)[0].level === 2,
      `[backfill] after backfill the level-2 level-up applies (got ${up.status} ${J(up.json?.error || '')}, max HP ${r.max_hp})`)
  }
} finally {
  await new Promise((resolve) => server.close(resolve))
}

console.log('\n=== Cleanup ===\n')
for (const id of ids) await dbRun('DELETE FROM characters WHERE id = ?', [id]).catch((e) => console.log(`  (cleanup note: ${e.message})`))
const left = await dbGet("SELECT COUNT(*) AS n FROM characters WHERE name LIKE 'TEST_OB%'")
check(Number(left.n) === 0, 'test characters removed')

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`)
process.exit(failed > 0 ? 1 : 0)
