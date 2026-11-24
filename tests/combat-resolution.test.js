/**
 * Combat resolution (2026-11-23) — docs/pm/combat-resolution/BRIEF.md.
 *
 * Zach: "Fights need some sort of resolution. If both thugs are still
 * standing, there has to be a reason for it — they ran off, we ended up
 * talking things out; something must happen in order for that outcome."
 *
 * Drives tavern fights through the real POST /:sessionId/message route
 * over the stubbed-LLM harness:
 *   1  [COMBAT_END] with both thugs standing is refused; the DM is told
 *      who stands and which resolutions exist; the fight goes on.
 *   2  a thug flees ([ENEMY_FLEE], one path with morale flight), a thug
 *      surrenders ([ENEMY_SURRENDER]), a fight is talked down
 *      ([COMBAT_SETTLE]) — each recorded on the enemy, marked out of the
 *      turn order.
 *   3  the fight ends cleanly on its last resolution: combatEnd, the
 *      turn state cleared, the outcome recorded for player, DM and
 *      history.
 * Plus migration 115 (the widened status CHECK) and morale flight
 * writing through the same helper. The test character is invented
 * (Dara Fenwick).
 */
import { initDatabase, dbRun, dbGet, dbAll } from '../server/database.js'
import { safeParse } from '../server/utils/safeParse.js'
import { installLlmStub, restoreLlm, startTurnServer, seedTurnFixture, cleanupTurnFixture } from './helpers/llmHarness.js'

let passed = 0
let failed = 0
function assert(condition, message) {
  if (condition) { passed++; console.log(`  ✓ ${message}`) } else { failed++; console.log(`  ✗ ${message}`) }
}

await initDatabase()
const resolution = await import('../server/services/combatResolutionService.js')
const morale = await import('../server/services/moraleService.js')

const enemiesOf = async (sid) => dbAll('SELECT name, status FROM combat_enemies WHERE session_id = ? AND encounter_seq = (SELECT MAX(encounter_seq) FROM combat_enemies WHERE session_id = ?) ORDER BY id', [sid, sid])
const statusOf = async (sid, name) => (await enemiesOf(sid)).find((e) => e.name === name)?.status
const turnRow = async (sid) => dbGet('SELECT turn_order_json FROM combat_turn_state WHERE session_id = ? ORDER BY encounter_seq DESC LIMIT 1', [sid])
const storedNotes = async (sid) => safeParse((await dbGet('SELECT messages FROM dm_sessions WHERE id = ?', [sid])).messages, []).filter((m) => m.role === 'user').map((m) => m.content)
/** An NPC-turn responder: answers for whichever thug's turn it is. */
const npc = (byName) => (call) => {
  const m = String(call.lastUserMessage || '').match(/It is (.+?)'s turn/)
  return byName[m?.[1]] ?? 'The figure hesitates.'
}

// ---------------------------------------------------------------------------
console.log('\n=== Migration 115: the status CHECK takes the new resolutions ===\n')
{
  const t = await dbGet("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'combat_enemies'")
  assert(/'surrendered'/.test(t.sql) && /'settled'/.test(t.sql) && /'fled'/.test(t.sql), 'combat_enemies.status allows active, dead, fled, surrendered, settled')
  assert(/cover/.test(t.sql) && /stats_json/.test(t.sql) && /concentrating_on/.test(t.sql), 'the rebuild kept the columns later migrations added')
  const idx = await dbAll("SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'combat_enemies'")
  assert(idx.some((i) => i.name === 'idx_combat_enemies_session') && idx.some((i) => i.name === 'idx_combat_enemies_name'), 'both indexes are back')
}

// ---------------------------------------------------------------------------
console.log('\n=== Fix-as-found: a nested quote inside a marker value no longer cuts it ===\n')
{
  const { parseMarkerBody } = await import('../server/services/markerSchemas.js')
  const { parseEnemyStats } = await import('../server/services/enemyCombatService.js')
  // The live probe's DM wrote exactly this; the old parser made ONE enemy
  // named 'Thug 3 (HP 14, AC 12, ATK +4, DMG 1d8+2, Weapon='.
  const p = parseMarkerBody('Enemies="Thug 3 (HP 14, AC 12, ATK +4, DMG 1d8+2, Weapon="Club"), Thug 4 (HP 10, AC 12, ATK +3, DMG 1d6+1, Weapon="Club")"', 'COMBAT_START')
  const foes = parseEnemyStats(p.data?.Enemies || '')
  assert(foes.length === 2 && foes[0].name === 'Thug 3' && foes[0].maxHp === 14 && foes[1].name === 'Thug 4' && foes[1].maxHp === 10, 'Weapon="Club" inside Enemies="…" keeps both thugs, named and statted')
  const plain = parseMarkerBody('Item="Gold" Source="chest"', 'LOOT_DROP')
  assert(plain.data?.Item === 'Gold' && plain.data?.Source === 'chest', 'plain two-field markers parse as before')
}

const llm = installLlmStub()
const server = await startTurnServer()
const fixtures = []
try {
  const f = await seedTurnFixture(dbRun, { prefix: 'TEST_CRES', hp: 60, maxHp: 60 })
  fixtures.push(f)
  await dbRun(`UPDATE characters SET name = ?, ability_scores = ?, equipment = ? WHERE id = ?`,
    ['Dara Fenwick', JSON.stringify({ str: 16, dex: 14, con: 14, int: 10, wis: 12, cha: 10 }),
      JSON.stringify({ mainHand: { name: 'Longsword', damage: '1d8', damageType: 'slashing' } }), f.characterId])
  const sid = f.sessionId
  const post = (body) => server.post(`/api/dm-session/${sid}/message`, body)
  const startFight = async () => {
    llm.reply('Two thugs kick back their chairs, knives out. [COMBAT_START: Enemies="Thug (HP 11, AC 12, ATK +4, DMG 1d6+2), Thug (HP 11, AC 12, ATK +4, DMG 1d6+2)"]')
    await post({ action: 'I stand and draw my sword.' })
    llm.reply('You move first.')
    return post({ action: '20' }) // initiative 20 + 2: the player acts first
  }

  // -------------------------------------------------------------------------
  console.log('\n=== Item 1: COMBAT_END with both thugs standing is refused ===\n')
  let res = await startFight()
  assert(res.body.turnState?.turnOrder?.length === 3, 'the fight is running (player + two thugs)')
  llm.reply('You lower your blade and step back. "Enough." [COMBAT_END]')
  llm.reply(npc({ 'Thug 1': 'Thug 1 sneers and circles.', 'Thug 2': 'Thug 2 spits on the floor.' }))
  llm.reply(npc({ 'Thug 1': 'Thug 1 sneers and circles.', 'Thug 2': 'Thug 2 spits on the floor.' }))
  res = await post({ action: 'I lower my weapon and step back. "We call it off."' })
  assert(!res.body.combatEnd, 'the fight does NOT end')
  assert(!!(await turnRow(sid)), 'the turn state is still there')
  assert((await enemiesOf(sid)).every((e) => e.status === 'active'), 'both thugs are still active')
  assert(/⚙ The fight isn't over — Thug 1 and Thug 2 are still standing\./.test(res.body.narrative), 'the player sees why, in plain words')
  let notes = await storedNotes(sid)
  const refusal = notes.find((n) => /\[COMBAT_END\] was REFUSED/.test(n))
  assert(!!refusal && /Thug 1, Thug 2 are still standing/.test(refusal), 'the DM is told the fight is not over and who stands')
  assert(/ENEMY_FLEE/.test(refusal) && /ENEMY_SURRENDER/.test(refusal) && /COMBAT_SETTLE/.test(refusal), 'the DM is told the resolutions that exist')
  assert(res.body.turnState?.turnOrder?.[res.body.turnState.currentTurn]?.type === 'player', 'the NPCs took their turns; it is the player\'s turn again')

  // -------------------------------------------------------------------------
  console.log('\n=== Item 2: a thug flees on its turn; the other fights on ===\n')
  llm.reply('You hold your ground.')
  llm.reply(npc({ 'Thug 1': 'Thug 1 takes one look at your blade and bolts for the door. [ENEMY_FLEE: Enemy="Thug 1"]', 'Thug 2': 'Thug 2 growls and holds his ground.' }))
  llm.reply(npc({ 'Thug 1': 'Thug 1 takes one look at your blade and bolts for the door. [ENEMY_FLEE: Enemy="Thug 1"]', 'Thug 2': 'Thug 2 growls and holds his ground.' }))
  res = await post({ action: 'I wait, sword ready.' })
  assert(await statusOf(sid, 'Thug 1') === 'fled' && await statusOf(sid, 'Thug 2') === 'active', 'Thug 1 is recorded as fled; Thug 2 still stands')
  assert(/⚙ Thug 1 flees the fight\./.test(res.body.narrative), 'the player sees Thug 1 flee')
  assert(!res.body.combatEnd, 'one thug still stands: the fight goes on')
  const out1 = (res.body.turnState?.turnOrder || []).find((c) => c.name === 'Thug 1')
  assert(out1?.out === 'fled', 'the tracker marks Thug 1 out of the fight (fled)')
  notes = await storedNotes(sid)
  assert(notes.some((n) => /Thug 1 has FLED — out of the fight\. Still standing: Thug 2/.test(n)), 'the DM is told Thug 1 fled and who still stands')

  // -------------------------------------------------------------------------
  console.log('\n=== Items 2 + 3: the last thug surrenders; the fight ends cleanly ===\n')
  llm.reply('You press the point toward the last thug.')
  llm.reply(npc({ 'Thug 2': 'Thug 2 drops his knife and raises his hands. "I yield!" [ENEMY_SURRENDER: Enemy="Thug 2"]' }))
  res = await post({ action: '"Drop it," I tell the last one.' })
  assert(await statusOf(sid, 'Thug 2') === 'surrendered', 'Thug 2 is recorded as surrendered, not standing')
  assert(res.body.combatEnd === true, 'the fight ends on its last resolution')
  assert(!(await turnRow(sid)), 'the turn state is cleared (the tracker clears)')
  assert(!res.body.turnState, 'no turn state goes to the tracker')
  assert(/⚙ Thug 2 surrenders\./.test(res.body.narrative) && /⚙ The fight is over: Thug 1 fled; Thug 2 surrendered\./.test(res.body.narrative), 'the player sees the surrender and the recorded outcome')
  notes = await storedNotes(sid)
  assert(notes.some((n) => /COMBAT OVER — system fact: Thug 1 fled; Thug 2 surrendered/.test(n)), 'the outcome is in the stored history (the chronicle reads it)')

  // -------------------------------------------------------------------------
  console.log('\n=== Item 2: a fight is talked down ===\n')
  res = await startFight()
  const callsBefore = llm.callCount
  // The live probe's DM wrote the settlement AND a COMBAT_END in one reply:
  // the settlement resolves first, so the end is accepted, not refused.
  llm.reply('They trade a look, pocket the coin, and slide their knives away. [COMBAT_SETTLE: Terms="ten gold to walk away"] [COMBAT_END]')
  res = await post({ action: 'I toss ten gold on the table. "Walk away and it\'s yours."' })
  const settled = await enemiesOf(sid)
  assert(settled.length === 2 && settled.every((e) => e.status === 'settled'), 'both thugs are recorded as settled')
  assert(res.body.combatEnd === true && !(await turnRow(sid)), 'the fight ends; the turn state is cleared')
  assert(!/isn't over/.test(res.body.narrative), 'a COMBAT_END beside the settlement is accepted — no contradictory refusal line')
  assert(llm.callCount === callsBefore + 1 || llm.calls.slice(callsBefore).filter((c) => /COMBAT TURN/.test(c.lastUserMessage)).length === 0, 'no NPC turn runs after the settlement')
  assert(/⚙ The fight is settled — Thug 1 and Thug 2 stand down\./.test(res.body.narrative) && /⚙ The fight is over: Thug 1 stood down \(settled\); Thug 2 stood down \(settled\)\./.test(res.body.narrative), 'the player sees the settlement and the outcome')
  notes = await storedNotes(sid)
  assert(notes.some((n) => /SETTLED by agreement \(ten gold to walk away\)/.test(n)), 'the DM is told the terms')

  // -------------------------------------------------------------------------
  console.log('\n=== COMBAT_END is accepted once no enemy stands; bad names are refused ===\n')
  res = await startFight()
  llm.reply('Thug 3 is nowhere in the room. [ENEMY_SURRENDER: Enemy="Thug 9"]')
  llm.reply(npc({ 'Thug 1': 'Thug 1 lunges.', 'Thug 2': 'Thug 2 feints.' }))
  llm.reply(npc({ 'Thug 1': 'Thug 1 lunges.', 'Thug 2': 'Thug 2 feints.' }))
  res = await post({ action: 'I shout for the watch.' })
  notes = await storedNotes(sid)
  assert(notes.some((n) => /ENEMY_SURRENDER not applied: no standing enemy named "Thug 9" \(standing: Thug 1, Thug 2\)/.test(n)), 'a surrender for an enemy who is not there is refused, with the names that are')
  const seq = (await dbGet('SELECT MAX(encounter_seq) AS m FROM combat_enemies WHERE session_id = ?', [sid])).m
  await dbRun("UPDATE combat_enemies SET status = 'dead', current_hp = 0 WHERE session_id = ? AND encounter_seq = ?", [sid, seq])
  llm.reply('The last of them lies still. [COMBAT_END]')
  res = await post({ action: 'I wipe my blade.' })
  assert(res.body.combatEnd === true && /⚙ The fight is over: Thug 1 is dead; Thug 2 is dead\./.test(res.body.narrative), 'with every enemy dead, COMBAT_END ends the fight and records it')

  // -------------------------------------------------------------------------
  console.log('\n=== Morale flight writes through the same path as ENEMY_FLEE ===\n')
  res = await startFight()
  const mseq = (await dbGet('SELECT MAX(encounter_seq) AS m FROM combat_enemies WHERE session_id = ?', [sid])).m
  await dbRun("UPDATE combat_enemies SET status = 'dead', current_hp = 0 WHERE session_id = ? AND encounter_seq = ? AND name = 'Thug 1'", [sid, mseq])
  const m = await morale.checkMorale(sid, mseq)
  const check = (m?.breakChecks || []).find((c) => c.name === 'Thug 2')
  // The break save is the engine's d20 (an enemy's roll): model both branches.
  const t2 = (safeParse((await turnRow(sid))?.turn_order_json, [])).find((c) => c.name === 'Thug 2')
  if (check?.outcome === 'fled') {
    assert(await statusOf(sid, 'Thug 2') === 'fled' && t2?.out === 'fled', 'morale flight: Thug 2 fled — same status and turn-order mark as ENEMY_FLEE')
  } else {
    assert(check?.outcome === 'held' && await statusOf(sid, 'Thug 2') === 'active' && !t2?.out, 'morale held: Thug 2 stays active and in the order')
  }
  assert(m?.triggered === true, 'morale triggers at 50% casualties, as before')
  // Deterministic flight: pin the engine's d20 to a natural 1 for one check.
  // (End the fight above first — a COMBAT_START during a running fight
  // would make its enemies JOIN it.)
  await dbRun('DELETE FROM combat_turn_state WHERE session_id = ?', [sid])
  res = await startFight()
  const fseq = (await dbGet('SELECT MAX(encounter_seq) AS m FROM combat_enemies WHERE session_id = ?', [sid])).m
  await dbRun("UPDATE combat_enemies SET status = 'dead', current_hp = 0 WHERE session_id = ? AND encounter_seq = ? AND name = 'Thug 1'", [sid, fseq])
  const realRandom = Math.random
  Math.random = () => 0
  let fm
  try { fm = await morale.checkMorale(sid, fseq) } finally { Math.random = realRandom }
  const ft2 = (safeParse((await turnRow(sid))?.turn_order_json, [])).find((c) => c.name === 'Thug 2')
  assert(fm?.breakChecks?.[0]?.outcome === 'fled' && await statusOf(sid, 'Thug 2') === 'fled' && ft2?.out === 'fled',
    'a broken morale save (natural 1): Thug 2 fled — the same status and turn-order mark as ENEMY_FLEE')
  // -------------------------------------------------------------------------
  console.log('\n=== PM decision: enemies arriving mid-fight JOIN it; the party escapes ===\n')
  await dbRun('DELETE FROM combat_turn_state WHERE session_id = ?', [sid])
  res = await startFight()
  const jseq = (await dbGet('SELECT MAX(encounter_seq) AS m FROM combat_enemies WHERE session_id = ?', [sid])).m
  const generic = npc({ 'Thug 1': 'Thug 1 circles.', 'Thug 2': 'Thug 2 circles.', 'Thug 3': 'Thug 3 circles.', 'Thug 4': 'Thug 4 circles.', 'Thug 5': 'Thug 5 circles.' })
  // The live DM re-listed the whole fight when two joined: Thug 1 and 2 are
  // the ones already fighting, Thug 3 and 4 are new.
  llm.reply('The door bangs open — two more thugs push in. [COMBAT_START: Enemies="Thug 2 (HP 11, AC 12, ATK +4, DMG 1d6+2), Thug 1 (HP 11, AC 12, ATK +4, DMG 1d6+2), Thug 3 (HP 11, AC 12, ATK +4, DMG 1d6+2), Thug 4 (HP 11, AC 12, ATK +4, DMG 1d6+2)"]')
  for (let i = 0; i < 4; i++) llm.reply(generic)
  res = await post({ action: 'I back toward the bar.' })
  const joinedRows = await enemiesOf(sid)
  assert((await dbGet('SELECT MAX(encounter_seq) AS m FROM combat_enemies WHERE session_id = ?', [sid])).m === jseq, 'no new fight: the encounter is the same')
  assert(joinedRows.map((e) => e.name).join(',') === 'Thug 1,Thug 2,Thug 3,Thug 4', `the joiners are numbered on: Thug 3, Thug 4 (got ${joinedRows.map((e) => e.name).join(',')})`)
  const jorder = safeParse((await turnRow(sid))?.turn_order_json, [])
  assert(jorder.length === 5 && jorder.some((c) => c.name === 'Thug 3' && Number.isInteger(c.initiative)) && jorder.some((c) => c.type === 'player'), 'the joiners have initiative and sit in the running order with the player and the first two')
  assert(!(await dbGet('SELECT session_config FROM dm_sessions WHERE id = ?', [sid])).session_config.includes('pendingInitiative'), 'the player is not asked for initiative again')
  notes = await storedNotes(sid)
  assert(notes.some((n) => /Thug 3 \(initiative -?\d+\), Thug 4 \(initiative -?\d+\) JOINED the fight already running — no new fight started \(2 of those you listed were already in it\)/.test(n)), 'the DM is told they joined the active fight (and that two it listed were already in it)')
  assert(res.body.turnState?.turnOrder?.[res.body.turnState.currentTurn]?.type === 'player', 'after the NPC turns it is the player\'s turn again')
  // An unnumbered newcomer is numbered on from the fight: Thug 5.
  llm.reply('A fifth thug drops from the balcony. [COMBAT_START: Enemies="Thug (HP 11, AC 12, ATK +4, DMG 1d6+2)"]')
  for (let i = 0; i < 5; i++) llm.reply(generic)
  res = await post({ action: 'I keep my back to the wall.' })
  assert((await enemiesOf(sid)).map((e) => e.name).join(',') === 'Thug 1,Thug 2,Thug 3,Thug 4,Thug 5', 'a lone unnumbered "Thug" joins as Thug 5')
  llm.reply('You vault the bar, crash through the kitchen and out into the night. [COMBAT_ESCAPE: How="out through the kitchen"]')
  res = await post({ action: 'I vault the bar and run for the kitchen door.' })
  assert(res.body.combatEnd === true && !(await turnRow(sid)), 'the escape ends the fight; the tracker clears')
  assert((await enemiesOf(sid)).every((e) => e.status === 'active'), 'all five thugs stay standing where they were (status active), no pursuit')
  assert(/⚙ You get away — Thug 1 and Thug 2 and Thug 3 and Thug 4 and Thug 5 are left behind, still standing\./.test(res.body.narrative), 'the player sees the escape')
  assert(/⚙ The fight is over: the party escaped — Thug 1 still standing \(the party got away\)/.test(res.body.narrative), 'the outcome records the escape')
  notes = await storedNotes(sid)
  assert(notes.some((n) => /The party ESCAPED \(out through the kitchen\)/.test(n)) && notes.some((n) => /COMBAT OVER — system fact: the party escaped/.test(n)), 'the DM and the stored history get the escape')
  llm.reply('Three more thugs appear in the street. [COMBAT_START: Enemies="Thug (HP 11, AC 12, ATK +4, DMG 1d6+2)"]')
  res = await post({ action: 'I keep running.' })
  assert((await dbGet('SELECT MAX(encounter_seq) AS m FROM combat_enemies WHERE session_id = ?', [sid])).m === jseq + 1, 'with no fight running, COMBAT_START starts a fresh fight')

  // Unit: setEnemyStatus refuses a status that is not a live resolution.
  let threw = false
  try { await resolution.setEnemyStatus(sid, mseq, 1, 'dead') } catch { threw = true }
  assert(threw, 'setEnemyStatus takes only fled / surrendered / settled (death stays with the damage path)')
} finally {
  for (const fx of fixtures) {
    await dbRun('DELETE FROM combat_enemies WHERE session_id = ?', [fx.sessionId]).catch(() => {})
    await dbRun('DELETE FROM combat_turn_state WHERE session_id = ?', [fx.sessionId]).catch(() => {})
    await cleanupTurnFixture(dbRun, fx).catch(() => {})
  }
  await server.close()
  restoreLlm()
}

console.log(`\ncombat-resolution: ${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)
