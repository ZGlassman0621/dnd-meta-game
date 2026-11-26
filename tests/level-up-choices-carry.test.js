/**
 * Waiting level-up choices carry — PM decision, 2026-11-26 (follow-up to
 * return-loop-xp-fixes).
 *
 *   [merge]    the list rules, as pure functions: waiting choices first and
 *              untouched, new ones appended in order, no duplicates; making
 *              a choice removes only that one.
 *   [award]    the session-end award (awardSessionXP) against the database:
 *              no new level → the waiting list is left exactly as it was;
 *              a new level → its choices are added after the waiting ones;
 *              a choice already waiting is not added twice.
 *   [queue]    the choices a new level brings follow the book's class-level
 *              ability-increase rules, from the level-up screen's own hasASI
 *              (PM decision 2, 2026-11-26): Fighter 6 and 14, Rogue 10, none
 *              for a multiclass level that is not an ASI level of its class.
 *   [levelup]  the real level-up route (PM decision 1, 2026-11-26): taking a
 *              level-up makes that level's review choice; taking the ASI/feat
 *              makes that level's ability choice; an ability choice the
 *              levelled class does not grant goes; one it grants but was not
 *              taken stays waiting; nothing else changes.
 *
 * Every test character is invented and TEST_-prefixed; all rows are removed.
 */

import express from 'express'
import { initDatabase, dbRun, dbGet } from '../server/database.js'
import {
  awardSessionXP, mergePendingChoices, removePendingChoice, parsePendingChoices, serializePendingChoices, queueLevelUpChoices
} from '../server/services/xpService.js'
import { getXPToNextLevel } from '../server/config/levelProgression.js'

let passed = 0
let failed = 0
function check(cond, msg) {
  if (cond) { passed++; console.log(`  ✓ ${msg}`) } else { failed++; console.log(`  ✗ ${msg}`) }
}
const J = JSON.stringify
const keys = (list) => (list || []).map((c) => `${c.level}:${c.type}`)

const ASI = (level) => ({ level, type: 'asi_or_feat', prompt: 'Choose: Ability Score Improvement or a feat.' })
const REVIEW = (level) => ({ level, type: 'level_up_review', prompt: `Review level ${level} features with the DM.` })
// Scores that award a few hundred to ~1,300 XP at levels 3-4.
const SCORES = { combat: 6, exploration: 7, quests: 8, discovery: null, social: 5 }
const DB = { get: dbGet, run: dbRun }

await initDatabase()
const ids = []

console.log('\n=== [merge] the list rules ===\n')
{
  const waiting = [REVIEW(3), ASI(4)]
  const merged = mergePendingChoices(waiting, [ASI(4), REVIEW(4), REVIEW(5)])
  check(J(keys(merged)) === J(['3:level_up_review', '4:asi_or_feat', '4:level_up_review', '5:level_up_review']),
    `[merge] waiting choices stay first, new ones follow in order, a duplicate is skipped (${keys(merged).join(', ')})`)
  check(J(merged.slice(0, 2)) === J(waiting), '[merge] the waiting choices are untouched')
  check(J(mergePendingChoices(waiting, [])) === J(waiting), '[merge] adding nothing leaves the list as it was')
  check(J(keys(mergePendingChoices([], [REVIEW(6), REVIEW(6)]))) === J(['6:level_up_review']), '[merge] a duplicate inside one award is added once')

  const after = removePendingChoice([REVIEW(3), ASI(4), REVIEW(4)], { level: 4, type: 'asi_or_feat' })
  check(J(keys(after)) === J(['3:level_up_review', '4:level_up_review']), `[merge] making a choice removes only that one (${keys(after).join(', ')})`)
  check(J(keys(removePendingChoice([REVIEW(3)], { level: 8, type: 'asi_or_feat' }))) === J(['3:level_up_review']),
    '[merge] removing a choice that is not waiting changes nothing')

  check(J(parsePendingChoices(null)) === '[]' && J(parsePendingChoices('not json')) === '[]' && J(parsePendingChoices('{"a":1}')) === '[]',
    '[merge] an empty or unreadable stored value reads as no waiting choices')
  check(serializePendingChoices([]) === null && serializePendingChoices([REVIEW(3)]) === J([REVIEW(3)]),
    '[merge] an empty list is stored as null')
}

async function makeChar(name, { level, experience, waiting, cls = 'Fighter', classLevels = null }) {
  const r = await dbRun(
    `INSERT INTO characters (name, class, race, level, current_hp, max_hp, current_location, experience, experience_to_next_level, level_up_pending_choices, class_levels)
     VALUES (?, ?, 'Human', ?, 30, 30, 'TEST_LC_Keep', ?, 0, ?, ?)`,
    [name, cls, level, experience, waiting ? J(waiting) : null, classLevels ? J(classLevels) : null])
  const id = Number(r.lastInsertRowid); ids.push(id); return id
}

const stored = async (id) => (await dbGet('SELECT level, experience, level_up_pending_choices FROM characters WHERE id = ?', [id]))

console.log('\n=== [queue] new choices follow the class-level ASI rules ===\n')
{
  const q = (cls, classLevels, from, to) => keys(queueLevelUpChoices({ class: cls, class_levels: classLevels ? J(classLevels) : null }, from, to))
  check(J(q('Fighter', null, 5, 6)) === J(['6:asi_or_feat', '6:level_up_review']), `[queue] Fighter 6 is an ASI level (${q('Fighter', null, 5, 6).join(', ')})`)
  check(J(q('Fighter', null, 13, 14)) === J(['14:asi_or_feat', '14:level_up_review']), '[queue] Fighter 14 is an ASI level')
  check(J(q('Rogue', null, 9, 10)) === J(['10:asi_or_feat', '10:level_up_review']), '[queue] Rogue 10 is an ASI level')
  check(J(q('Wizard', null, 5, 6)) === J(['6:level_up_review']), '[queue] Wizard 6 is not an ASI level')
  check(J(q('Wizard', null, 3, 4)) === J(['4:asi_or_feat', '4:level_up_review']), '[queue] Wizard 4 is an ASI level')
  // Fighter 2 / Rogue 1 reaching total level 4: the new level goes to the
  // Fighter (the route's default class) as Fighter 3 — not an ASI level.
  const multi = q('Fighter', [{ class: 'Fighter', level: 2 }, { class: 'Rogue', level: 1 }], 3, 4)
  check(J(multi) === J(['4:level_up_review']), `[queue] a multiclass level that is not an ASI level of its class queues no ASI (${multi.join(', ')})`)
  // class_levels behind the level (session end raised it before a level-up):
  // Fighter 3 applied, level 4 → 6 queues 4 (Fighter 4) and 6 (Fighter 6).
  const behind = q('Fighter', [{ class: 'Fighter', level: 3 }], 4, 6)
  check(J(behind) === J(['5:level_up_review', '6:asi_or_feat', '6:level_up_review']), `[queue] class levels are counted from the applied class levels (${behind.join(', ')})`)
  const two = q('Fighter', null, 3, 5)
  check(J(two) === J(['4:asi_or_feat', '4:level_up_review', '5:level_up_review']), '[queue] two levels at once queue in level order')

  // Through the real award: a level-5 Fighter reaching 6 queues the ASI.
  const h = await makeChar('TEST_LC_H Hero', { level: 5, experience: 13999, waiting: null })
  const resH = await awardSessionXP(h, SCORES, DB)
  const listH = keys(parsePendingChoices((await stored(h)).level_up_pending_choices))
  check(resH.leveledUp && J(listH) === J(['6:asi_or_feat', '6:level_up_review']), `[queue] the session-end award queues the Fighter's level-6 ASI (${listH.join(', ')})`)
  const w = await makeChar('TEST_LC_W Hero', { level: 5, experience: 13999, waiting: null, cls: 'Wizard' })
  await awardSessionXP(w, SCORES, DB)
  const listW = keys(parsePendingChoices((await stored(w)).level_up_pending_choices))
  check(J(listW) === J(['6:level_up_review']), `[queue] the award queues no ASI for a Wizard reaching 6 (${listW.join(', ')})`)
}

console.log('\n=== [award] the session-end award carries waiting choices ===\n')
{
  // Level 4, two waiting choices from reaching 4; this award gains no level.
  const waiting = [ASI(4), REVIEW(4)]
  const a = await makeChar('TEST_LC_A Hero', { level: 4, experience: 2700, waiting })
  const before = (await stored(a)).level_up_pending_choices
  const res = await awardSessionXP(a, SCORES, DB)
  const row = await stored(a)
  check(res.xpAwarded > 0 && !res.leveledUp && row.level === 4, `[award] the award lands with no new level (+${res.xpAwarded}, level ${row.level})`)
  check(row.level_up_pending_choices === before, '[award] no new level: the waiting choices are left exactly as they were')
  check(J(keys(res.pendingChoices)) === J(keys(waiting)) && res.newChoices.length === 0, '[award] the award reports the same waiting list and nothing new')

  // Level 3 with an unresolved level-3 review; this award reaches level 4.
  const b = await makeChar('TEST_LC_B Hero', { level: 3, experience: 2699, waiting: [REVIEW(3)] })
  const resB = await awardSessionXP(b, SCORES, DB)
  const rowB = await stored(b)
  check(resB.leveledUp && rowB.level === 4, `[award] the award reaches level 4 (level ${rowB.level})`)
  check(J(keys(parsePendingChoices(rowB.level_up_pending_choices))) === J(['3:level_up_review', '4:asi_or_feat', '4:level_up_review']),
    `[award] the older unresolved choice is kept and the new ones follow it in order (${keys(parsePendingChoices(rowB.level_up_pending_choices)).join(', ')})`)
  check(J(parsePendingChoices(rowB.level_up_pending_choices)[0]) === J(REVIEW(3)), '[award] the older choice is stored unchanged')

  // A choice already waiting for the level being reached is not added twice.
  const c = await makeChar('TEST_LC_C Hero', { level: 3, experience: 2699, waiting: [ASI(4)] })
  await awardSessionXP(c, SCORES, DB)
  const listC = keys(parsePendingChoices((await stored(c)).level_up_pending_choices))
  check(J(listC) === J(['4:asi_or_feat', '4:level_up_review']), `[award] no duplicates: the waiting level-4 ASI stays once (${listC.join(', ')})`)

  // No waiting list at all, no new level: the column stays empty.
  const d = await makeChar('TEST_LC_D Hero', { level: 4, experience: 2700, waiting: null })
  await awardSessionXP(d, SCORES, DB)
  check((await stored(d)).level_up_pending_choices === null, '[award] no waiting choices and no new level: nothing is written')
}

console.log('\n=== [levelup] making a choice removes only that one ===\n')
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
async function fighter(name, level) {
  const created = await req('POST', '/api/character', { name, class: 'Fighter', race: 'human' })
  const id = created.json.id; ids.push(id)
  await req('PUT', `/api/character/${id}`, {
    level, experience: getXPToNextLevel(level), max_hp: 28, current_hp: 28,
    ability_scores: J({ str: 15, dex: 14, con: 14, int: 10, wis: 12, cha: 10 }),
    class_levels: J([{ class: 'Fighter', level, subclass: 'Champion' }])
  })
  return id
}
try {
  // As after session end: the level-4 choices are waiting, plus an older one.
  const e = await fighter('TEST_LC_E Hero', 3)
  await dbRun('UPDATE characters SET level_up_pending_choices = ? WHERE id = ?', [J([REVIEW(3), ASI(4), REVIEW(4)]), e])
  const up = await req('POST', `/api/character/level-up/${e}`, { selectedClass: 'Fighter', hpRoll: 'average', asiChoice: { type: 'asi', increases: { str: 1, con: 1 } } })
  const rowE = await dbGet('SELECT level, level_up_pending_choices FROM characters WHERE id = ?', [e])
  check(up.status === 200 && rowE.level === 4, `[levelup] the level-4 level-up with an ASI succeeds (got ${up.status} ${J(up.json?.error || '')})`)
  const listE = keys(parsePendingChoices(rowE.level_up_pending_choices))
  check(J(listE) === J(['3:level_up_review']),
    `[levelup] taking level 4 with an ASI makes the level-4 review and ability choices, and only those (${listE.join(', ')})`)
  check(J(parsePendingChoices(rowE.level_up_pending_choices)[0]) === J(REVIEW(3)), '[levelup] the older waiting choice is untouched')

  // A level with no ASI (Fighter 4 → 5): the level-5 review is made; an
  // ability choice queued for 5 that Fighter 5 does not grant goes; the
  // older level-4 review stays.
  const f = await fighter('TEST_LC_F Hero', 4)
  await dbRun('UPDATE characters SET level_up_pending_choices = ? WHERE id = ?', [J([REVIEW(4), ASI(5), REVIEW(5)]), f])
  const upF = await req('POST', `/api/character/level-up/${f}`, { selectedClass: 'Fighter', hpRoll: 'average' })
  const rowF = await dbGet('SELECT level, level_up_pending_choices FROM characters WHERE id = ?', [f])
  const listF = keys(parsePendingChoices(rowF.level_up_pending_choices))
  check(upF.status === 200 && rowF.level === 5, `[levelup] the level-5 level-up succeeds (got ${upF.status} ${J(upF.json?.error || '')})`)
  check(J(listF) === J(['4:level_up_review']),
    `[levelup] level 5 makes its review choice, and an ability choice Fighter 5 does not grant goes (${listF.join(', ')})`)

  // Granted but not taken (Fighter 3 → 4 with no ASI sent): the ability
  // choice stays waiting — and is added when it was missing.
  const k = await fighter('TEST_LC_K Hero', 3)
  await dbRun('UPDATE characters SET level_up_pending_choices = ? WHERE id = ?', [J([REVIEW(4)]), k])
  const upK = await req('POST', `/api/character/level-up/${k}`, { selectedClass: 'Fighter', hpRoll: 'average' })
  const listK = keys(parsePendingChoices((await dbGet('SELECT level_up_pending_choices FROM characters WHERE id = ?', [k])).level_up_pending_choices))
  check(upK.status === 200 && J(listK) === J(['4:asi_or_feat']),
    `[levelup] an ASI the level grants but the player did not take stays waiting (${upK.status}; ${listK.join(', ')})`)

  // Nothing waiting, no ASI level: nothing is written.
  const m = await fighter('TEST_LC_M Hero', 4)
  const upM = await req('POST', `/api/character/level-up/${m}`, { selectedClass: 'Fighter', hpRoll: 'average' })
  check(upM.status === 200 && (await dbGet('SELECT level_up_pending_choices FROM characters WHERE id = ?', [m])).level_up_pending_choices === null,
    '[levelup] with nothing waiting and no ASI due, the list stays empty')

  // A refused level-up changes nothing.
  const g = await fighter('TEST_LC_G Hero', 3)
  const waitingG = J([ASI(4), REVIEW(4)])
  await dbRun('UPDATE characters SET experience = 0, level_up_pending_choices = ? WHERE id = ?', [waitingG, g])
  const upG = await req('POST', `/api/character/level-up/${g}`, { selectedClass: 'Fighter', hpRoll: 'average', asiChoice: { type: 'asi', increases: { str: 2 } } })
  check(upG.status === 400 && (await dbGet('SELECT level_up_pending_choices FROM characters WHERE id = ?', [g])).level_up_pending_choices === waitingG,
    `[levelup] a refused level-up leaves the waiting choices as they were (got ${upG.status})`)
} finally {
  await new Promise((resolve) => server.close(resolve))
}

console.log('\n=== Cleanup ===\n')
for (const id of ids) await dbRun('DELETE FROM characters WHERE id = ?', [id]).catch((e) => console.log(`  (cleanup note: ${e.message})`))
const left = await dbGet("SELECT COUNT(*) AS n FROM characters WHERE name LIKE 'TEST_LC_%'")
check(Number(left.n) === 0, 'test characters removed')

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`)
process.exit(failed > 0 ? 1 : 0)
