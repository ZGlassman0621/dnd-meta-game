/**
 * Combat-loop fix (2026-11-23) — docs/pm/combat-loop-fix/BRIEF.md.
 *
 * Drives one tavern fight through the real POST /:sessionId/message route
 * over the stubbed-LLM harness, and checks each item's "fixed looks like":
 *
 *   P1  the engine runs the turns: one DM call per NPC turn, the DM
 *       choosing the action; back to the player afterwards.
 *   P2  combat results and refusals reach the player the same turn, in
 *       plain words; a blow is never counted twice.
 *   P3  a partial player name ("Kell") resolves to the player.
 *   P4  the engine never rolls for the player: initiative, the attack
 *       d20, the damage dice and death saves are the player's numbers.
 *   P5  every response carries the live turn state for the tracker.
 *   F2  an HP_CHANGE naming the player as the attacker is refused.
 *   F3  same-name enemies get distinct names.
 *   7   the roll math reaches the client (rollMath).
 *
 * The test character is invented (Kell Varrow).
 */
import { initDatabase, dbRun, dbGet } from '../server/database.js'
import { safeParse } from '../server/utils/safeParse.js'
import { installLlmStub, restoreLlm, startTurnServer, seedTurnFixture, cleanupTurnFixture } from './helpers/llmHarness.js'

let passed = 0
let failed = 0
function assert(condition, message) {
  if (condition) { passed++; console.log(`  ✓ ${message}`) } else { failed++; console.log(`  ✗ ${message}`) }
}

await initDatabase()
const { isPlayerRef } = await import('../server/utils/playerName.js')
const loop = await import('../server/services/combatLoopService.js')
const { processResponseMarkers } = await import('../server/services/markerPipeline.js')
const { rollDeathSave } = await import('../server/services/characterHpService.js')

const cfgOf = async (sid) => safeParse((await dbGet('SELECT session_config FROM dm_sessions WHERE id = ?', [sid]))?.session_config, {})
const hpOf = async (cid) => (await dbGet('SELECT current_hp FROM characters WHERE id = ?', [cid])).current_hp

// ---------------------------------------------------------------------------
console.log('\n=== P3: tolerant player-name matching ===\n')
assert(isPlayerRef('Kell', 'Kell Varrow'), 'a first name matches the full name')
assert(isPlayerRef('varrow', 'Kell Varrow'), 'a surname matches, case-insensitive')
assert(isPlayerRef('Kell Varrow', 'Kell Varrow'), 'the full name matches')
assert(isPlayerRef('Player', 'Kell Varrow') && isPlayerRef('you', 'Kell Varrow'), 'the aliases match')
assert(!isPlayerRef('Kel', 'Kell Varrow'), 'a word fragment does not match')
assert(isPlayerRef('TEST_COMBAT', 'TEST_COMBAT Brawler'), 'the brief\'s case: Attacker="TEST_COMBAT" for "TEST_COMBAT Brawler"')
assert(!isPlayerRef('Thug 1', 'Kell Varrow'), 'an enemy name does not match')

// ---------------------------------------------------------------------------
console.log('\n=== The dispatch filter (B3 double count; the engine owns turns) ===\n')
{
  const a = loop.combatDispatchText('Swing. [ENEMY_ATTACK: Enemy="Thug 1" Target="Kell"] [HP_CHANGE: delta=-5 reason="club"] [TURN_ADVANCE]', { combatActive: true })
  assert(!/HP_CHANGE/.test(a.text), 'a damaging HP_CHANGE beside an ENEMY_ATTACK is dropped')
  assert(!/TURN_ADVANCE/.test(a.text), 'TURN_ADVANCE is dropped')
  assert(/ENEMY_ATTACK/.test(a.text), 'the ENEMY_ATTACK stays')
  const b = loop.combatDispatchText('[ENEMY_ATTACK: Enemy="Thug 1"] [HP_CHANGE: delta=4 reason="potion"]', { combatActive: true })
  assert(/delta=4/.test(b.text), 'a healing HP_CHANGE stays')
  const c = loop.combatDispatchText('A trap! [HP_CHANGE: delta=-5 reason="dart"]', { combatActive: true })
  assert(/delta=-5/.test(c.text), 'an HP_CHANGE with no ENEMY_ATTACK beside it stays')
}

const llm = installLlmStub()
const server = await startTurnServer()
const fixtures = []
try {
  const f = await seedTurnFixture(dbRun, { prefix: 'TEST_CLF', hp: 60, maxHp: 60 })
  fixtures.push(f)
  await dbRun(
    `UPDATE characters SET name = ?, ability_scores = ?, equipment = ?, skills = '[]' WHERE id = ?`,
    ['Kell Varrow', JSON.stringify({ str: 16, dex: 18, con: 14, int: 10, wis: 12, cha: 8 }),
      JSON.stringify({ mainHand: { name: 'Longsword', damage: '1d8', damageType: 'slashing' }, armor: { name: 'Chain Mail' } }),
      f.characterId])
  const sid = f.sessionId
  const post = (body) => server.post(`/api/dm-session/${sid}/message`, body)

  // -------------------------------------------------------------------------
  console.log('\n=== P4 initiative + F3 names: COMBAT_START asks the player for a d20 ===\n')
  llm.reply('Two thugs kick back their chairs. [COMBAT_START: Enemies="Thug (HP 11, AC 12, ATK +4, DMG 1d6+2), Thug (HP 11, AC 12, ATK +4, DMG 1d6+2)"]')
  let calls = llm.callCount
  let res = await post({ action: 'I draw my longsword.' })
  assert(res.status === 200, `the turn returns 200 (got ${res.status})`)
  const names = (await (await import('../server/database.js')).dbAll(
    'SELECT name FROM combat_enemies WHERE session_id = ? ORDER BY id', [sid])).map((r) => r.name)
  assert(names.join(',') === 'Thug 1,Thug 2', `same-name enemies are numbered (got ${names.join(',')})`)
  let cfg = await cfgOf(sid)
  assert(!!cfg.pendingInitiative, 'the player\'s initiative is pending, not rolled')
  assert((res.body.rollPrompts || []).some((p) => /Roll a d20 for initiative/.test(p) && /\+4/.test(p)), 'the player is told to roll a d20 for initiative (+4 Dex after)')
  assert(/Roll a d20 for initiative/.test(res.body.narrative), 'the roll prompt is in the narrative')
  assert(res.body.turnState?.awaitingInitiative === 'Kell Varrow', 'the tracker state says initiative is awaited')
  assert(!(res.body.turnState?.turnOrder || []).some((c) => c.type === 'player'), 'the player is not in the order until they roll')
  assert(llm.callCount === calls + 1, 'no NPC turn runs while initiative is awaited')

  // -------------------------------------------------------------------------
  console.log('\n=== P4: the player\'s d20 sets their initiative ===\n')
  llm.reply('You are quicker than they are.')
  calls = llm.callCount
  res = await post({ action: '20' })
  cfg = await cfgOf(sid)
  assert(!cfg.pendingInitiative, 'the pending initiative is settled')
  assert((res.body.rollMath || []).some((m) => m === 'Initiative: d20 20 + 4 (Dex) = 24'), 'the math panel shows d20 20 + 4 = 24')
  const ts = res.body.turnState
  assert(ts && ts.turnOrder[ts.currentTurn]?.type === 'player', 'P5: the turn state says it is the player\'s turn')
  assert(ts.turnOrder.length === 3, 'the order holds the player and both thugs')
  assert(/INITIATIVE — system fact/.test(llm.lastCall.lastUserMessage), 'the DM is told the initiative result this turn')
  assert(llm.callCount === calls + 1, 'the player acts first, so no NPC turn runs')

  // -------------------------------------------------------------------------
  console.log('\n=== P1 fallback: an attack with no ATTACK marker still asks for the d20 ===\n')
  llm.reply('You lunge at the nearer thug.')
  calls = llm.callCount
  res = await post({ action: 'I attack Thug 1 with my longsword.' })
  cfg = await cfgOf(sid)
  assert(cfg.pendingAttack?.target === 'Thug 1', `the engine opened the attack on Thug 1 (got ${cfg.pendingAttack?.target})`)
  assert((res.body.rollPrompts || []).some((p) => /Roll a d20 to attack Thug 1/.test(p)), 'the player is told to roll a d20 to attack')
  assert(llm.callCount === calls + 1, 'the turn waits on the d20: no NPC turn runs')

  // -------------------------------------------------------------------------
  console.log('\n=== P4 damage: a hit asks for the damage dice ===\n')
  llm.reply('Your blade finds a gap in his guard. [ATTACK RESULT: Hit]')
  calls = llm.callCount
  res = await post({ action: '15' })
  // P2: the DM narrates the engine's judged result this same turn — the
  // ATTACK RESULT block was an unawaited Promise before this job.
  assert(/Kell Varrow attacked Thug 1 with Longsword[^\n]*= 20 vs AC 12 — HIT/.test(llm.lastCall.system) && !/\[object Promise\]/.test(llm.lastCall.system), 'the DM is shown the judged hit in the same turn (not "[object Promise]")')
  assert(!/\[ATTACK RESULT/.test(res.body.narrative) && /finds a gap/.test(res.body.narrative), 'an echoed [ATTACK RESULT: …] header is removed from what the player sees')
  cfg = await cfgOf(sid)
  assert(!!cfg.pendingDamage && !cfg.pendingAttack, 'the hit waits on the player\'s damage dice')
  assert((res.body.rollMath || []).some((m) => /d20 15 \+ 5 = 20 vs AC 12 — HIT/.test(m)), 'the math shows d20 15 + 5 = 20 vs AC 12 — HIT')
  assert((res.body.rollPrompts || []).some((p) => /Roll 1d8 for damage — the engine adds \+3 after/.test(p)), 'the player is told to roll 1d8 (+3 after)')
  assert(llm.callCount === calls + 1, 'no NPC turn runs while damage is awaited')

  // -------------------------------------------------------------------------
  console.log('\n=== P1/P2: the damage ends the turn; the engine runs both thugs ===\n')
  const hpBefore = await hpOf(f.characterId)
  llm.reply('The thug reels, bleeding.')
  // The thugs' initiative is the engine's roll, so either may act first:
  // each NPC reply answers for whichever thug the engine names.
  const npcReply = (call) => {
    const who = (call.lastUserMessage.match(/It is (Thug \d)'s turn/) || [])[1] || 'Thug 1'
    return who === 'Thug 1'
      ? 'Thug 1 swings a cudgel at Kell. [ENEMY_ATTACK: Enemy="Thug 1" Target="Kell"]'
      : 'Thug 2 stabs at Kell. [ENEMY_ATTACK: Enemy="Thug 2" Target="Kell"] [HP_CHANGE: delta=-5 reason="thug knife"]'
  }
  llm.reply(npcReply)
  llm.reply(npcReply)
  calls = llm.callCount
  res = await post({ action: '6' })
  const thug1 = await dbGet("SELECT current_hp FROM combat_enemies WHERE session_id = ? AND name = 'Thug 1'", [sid])
  assert(thug1.current_hp === 2, `Thug 1 takes 6 + 3 = 9 (11 → ${thug1.current_hp})`)
  assert((res.body.rollMath || []).some((m) => /damage: rolled 6 \+ 3 = 9/.test(m)), 'the math shows damage rolled 6 + 3 = 9')
  assert(llm.callCount === calls + 3, `one DM call for the player\'s turn and one per thug (got ${llm.callCount - calls})`)
  const npcCalls = llm.calls.slice(calls + 1)
  const turnNames = npcCalls.map((c) => (c.lastUserMessage.match(/It is (Thug \d)'s turn/) || [])[1]).sort().join(',')
  assert(turnNames === 'Thug 1,Thug 2', `each NPC call names that NPC's turn (got ${turnNames})`)
  assert(npcCalls.every((c) => /You control Thug \d: choose what Thug \d does now/.test(c.lastUserMessage)), 'the DM is told it controls the NPC and chooses its action')
  const lines = (res.body.narrative.match(/⚙ Thug \d attacks Kell Varrow: [^\n]*/g) || [])
  assert(lines.length === 2, `both thug attacks are stated in plain words (got ${lines.length})`)
  assert(!/did not go through/.test(res.body.narrative), 'P3: Target="Kell" resolved to the player (no refusal)')
  const dealt = lines.reduce((n, l) => n + (Number((l.match(/for (\d+) damage/) || [])[1]) || 0), 0)
  const hpAfter = await hpOf(f.characterId)
  assert(hpBefore - hpAfter === dealt, `the player loses exactly the engine's damage (${hpBefore} → ${hpAfter}, engine ${dealt}; the DM's HP_CHANGE -5 was not added)`)
  assert(!/\[ENEMY_ATTACK/.test(res.body.narrative), 'NPC markers never reach the player')
  assert(res.body.npcTurns?.length === 2, 'the response lists the two NPC turns')
  const ts2 = res.body.turnState
  assert(ts2.turnOrder[ts2.currentTurn]?.type === 'player' && ts2.round === 2, `P5: back to the player, round 2 (round ${ts2.round})`)
  const stored = safeParse((await dbGet('SELECT messages FROM dm_sessions WHERE id = ?', [sid])).messages, [])
  assert(stored.some((m) => m.role === 'user' && /Thug 1 attacked Kell Varrow: rolled \d+ vs AC/.test(m.content)), 'the DM gets each result as a system note')

  // -------------------------------------------------------------------------
  console.log('\n=== P2: an off-turn enemy attack is refused, in words ===\n')
  const hpBeforeOff = await hpOf(f.characterId)
  llm.reply('Thug 2 lunges as you glance around. [ENEMY_ATTACK: Enemy="Thug 2" Target="Player"]')
  llm.reply('Thug 1 circles, wary.')
  llm.reply('Thug 2 spits and edges closer.')
  res = await post({ action: 'I look for the exit.' })
  const refusedOk = /⚙ Thug 2's attack did not go through: Out of turn/.test(res.body.narrative)
  assert(refusedOk, 'the refusal is stated to the player')
  if (!refusedOk) console.log(JSON.stringify(res.body.narrative))
  assert(await hpOf(f.characterId) === hpBeforeOff, 'the refused attack did no damage')

  // -------------------------------------------------------------------------
  console.log('\n=== P4 concentration: damage asks for the CON save; settling it keeps the turn ===\n')
  {
    await dbRun("UPDATE characters SET concentrating_on = 'Bless' WHERE id = ?", [f.characterId])
    // Damage on the player's turn (a 10-foot fall: 1d6, so DC 10), then
    // both thugs act.
    llm.reply('The floor gives way under you. [HP_CHANGE: Fall=10]')
    llm.reply('Thug 1 circles, wary.')
    llm.reply('Thug 2 spits and edges closer.')
    let r = await post({ action: 'I shove the table toward them.' })
    let c = await cfgOf(sid)
    assert(c.pendingConcentration?.dcs?.[0] === 10, 'the damage queues a DC 10 concentration save — nothing rolled')
    assert((await dbGet('SELECT concentrating_on FROM characters WHERE id = ?', [f.characterId])).concentrating_on === 'Bless', 'concentration holds until the player rolls')
    assert((r.body.rollPrompts || []).some((p) => /Roll a d20 Constitution saving throw to keep concentration on Bless — DC 10; the engine adds \+2 \(CON\)/.test(p)), 'the player is told the save, its DC and the +2 the engine adds')
    llm.reply('You grit your teeth and hold the blessing.')
    const before = llm.callCount
    r = await post({ action: '9' })
    c = await cfgOf(sid)
    assert(!c.pendingConcentration && (r.body.rollMath || []).some((m) => /Concentration \(Bless\): d20 9 \+ 2 \(CON\) = 11 vs DC 10 — kept/.test(m)), 'the reported 9 + 2 = 11 keeps Bless')
    assert(!llm.calls.slice(before).some((c) => /COMBAT TURN/.test(c.lastUserMessage)) && r.body.turnState.turnOrder[r.body.turnState.currentTurn]?.type === 'player', 'settling the save leaves the player\'s turn open (no NPC turn)')
    await dbRun('UPDATE characters SET concentrating_on = NULL WHERE id = ?', [f.characterId])
  }

  // -------------------------------------------------------------------------
  console.log('\n=== P4 Second Wind: the player rolls the 1d10 ===\n')
  {
    await dbRun('UPDATE characters SET current_hp = 30 WHERE id = ?', [f.characterId])
    llm.reply('You draw a ragged breath and steady yourself. [SECOND_WIND: Target="Kell"]')
    let r = await post({ action: 'I use Second Wind.' })
    assert((await cfgOf(sid)).pendingHeal?.dice === '1d10', 'Second Wind waits on the player\'s 1d10')
    assert(await hpOf(f.characterId) === 30, 'no heal is rolled for the player')
    assert((r.body.rollPrompts || []).some((p) => /Roll 1d10 for Second Wind — the engine adds \+3 after/.test(p)), 'the player is told to roll 1d10 (+3 fighter level after)')
    llm.reply('Strength floods back into your limbs.')
    const before = llm.callCount
    r = await post({ action: '7' })
    assert(await hpOf(f.characterId) === 40, `the reported 7 + 3 = 10 heals (30 → ${await hpOf(f.characterId)})`)
    assert((r.body.rollMath || []).some((m) => /Second Wind: rolled 7 \+ 3 = 10 HP/.test(m)), 'the math panel shows 7 + 3 = 10')
    assert(!llm.calls.slice(before).some((c) => /COMBAT TURN/.test(c.lastUserMessage)), 'a bonus-action heal leaves the player\'s turn open')
  }

  // -------------------------------------------------------------------------
  console.log('\n=== F2: an HP_CHANGE naming the player as attacker is refused ===\n')
  {
    // Outside a fight (no session context): the reason check itself.
    const before = await hpOf(f.characterId)
    const ctx = { characterId: f.characterId, narrative: '' }
    const r1 = await processResponseMarkers('[HP_CHANGE: delta=-8 reason="Kell\'s longsword"]', ctx)
    assert(r1.handlerResults[0]?.result?.refusedSelfDamage === true, 'reason "Kell\'s longsword" is refused')
    const r2 = await processResponseMarkers('[HP_CHANGE: delta=-4 reason="the player\'s arrow"]', ctx)
    assert(r2.handlerResults[0]?.result?.refusedSelfDamage === true, 'reason "the player\'s arrow" is refused')
    assert(await hpOf(f.characterId) === before, 'neither refused change touched the player\'s HP')
    const r3 = await processResponseMarkers('[HP_CHANGE: delta=-2 reason="falling beam"]', ctx)
    assert(r3.handlerResults[0]?.result?.applied === true && await hpOf(f.characterId) === before - 2, 'an ordinary damage reason still applies')
  }

  // -------------------------------------------------------------------------
  console.log('\n=== B3 (live probe): in a fight, a plain damaging HP_CHANGE is refused ===\n')
  {
    // Live run 2: the DM restated the thug's applied hit next turn
    // ("Thug 1's mace", counted twice) and put the player's own blow on the
    // player ("Longsword strike") — neither names the player as attacker.
    const before = await hpOf(f.characterId)
    llm.reply('The thug\'s mace connects again. [HP_CHANGE: delta=-5 reason="Thug 1\'s mace"] [HP_CHANGE: delta=-9 reason="Longsword strike"]')
    llm.reply('Thug 1 circles, wary.')
    llm.reply('Thug 2 spits and edges closer.')
    const r = await post({ action: 'I watch them both.' })
    assert(await hpOf(f.characterId) === before, `neither HP_CHANGE touched the player during the fight (${before} → ${await hpOf(f.characterId)})`)
    const stored = safeParse((await dbGet('SELECT messages FROM dm_sessions WHERE id = ?', [sid])).messages, [])
    assert(stored.some((m) => m.role === 'user' && /HP_CHANGE refused: a fight is running/.test(m.content)), 'the DM is told why, in its history')
    assert(!/\[SYSTEM:/.test(r.body.narrative), 'no "[SYSTEM: …]" reconciliation note reaches the player')
    const trap = await processResponseMarkers('[HP_CHANGE: Fall=10]', { characterId: f.characterId, sessionId: sid, narrative: '' })
    assert(trap.handlerResults[0]?.result && trap.handlerResults[0].result.success !== false && await hpOf(f.characterId) < before, 'a fall (table cause) still damages the player mid-fight')
  }

  // -------------------------------------------------------------------------
  console.log('\n=== P1: thugs first — they act before the player; one turn each ===\n')
  {
    const h = await seedTurnFixture(dbRun, { prefix: 'TEST_CLF_SLOW', hp: 60, maxHp: 60 })
    fixtures.push(h)
    // DEX 1 (−5) and a reported 1: initiative −4, so both thugs go first.
    await dbRun(`UPDATE characters SET name = 'Orin Slate', ability_scores = ?, equipment = ? WHERE id = ?`,
      [JSON.stringify({ str: 14, dex: 1, con: 14, int: 10, wis: 10, cha: 10 }), JSON.stringify({ mainHand: { name: 'Mace' } }), h.characterId])
    const hpost = (body) => server.post(`/api/dm-session/${h.sessionId}/message`, body)
    llm.reply('Two thugs rise from a corner table. [COMBAT_START: Enemies="Thug (HP 11, AC 12, ATK +4, DMG 1d6+2), Thug (HP 11, AC 12, ATK +4, DMG 1d6+2)"]')
    await hpost({ action: 'I stand my ground.' })
    // The initiative turn's own reply narrates the first thug's swing (the
    // model often does): that IS the first thug's turn, so the engine must
    // not ask for it again.
    const firstThug = (call) => (call.system.match(/It is (Thug \d)'s turn/) || [])[1] || 'Thug 1'
    llm.reply((call) => `The first thug lunges. [ENEMY_ATTACK: Enemy="${firstThug(call)}" Target="Orin"]`)
    llm.reply((call) => { const who = (call.lastUserMessage.match(/It is (Thug \d)'s turn/) || [])[1]; return `${who} slashes at Orin. [ENEMY_ATTACK: Enemy="${who}" Target="Orin"]` })
    const before = llm.callCount
    const r = await hpost({ action: '1' })
    const npcCalls = llm.calls.slice(before).filter((c) => /COMBAT TURN/.test(c.lastUserMessage))
    assert(r.body.turnState.turnOrder.at(-1)?.name === 'Orin Slate', 'the player (−4) is last in the order')
    assert(npcCalls.length === 1, `the thug that already acted in the initiative reply gets no second call (NPC calls: ${npcCalls.length})`)
    assert(!/already used its action/.test(r.body.narrative), 'no "already used its action" refusal reaches the player')
    assert((r.body.narrative.match(/⚙ Thug \d attacks Orin Slate/g) || []).length === 2, 'both thugs attack before the player\'s first action')
    assert(r.body.turnState.turnOrder[r.body.turnState.currentTurn]?.name === 'Orin Slate', 'then it is the player\'s turn')
  }

  // -------------------------------------------------------------------------
  console.log('\n=== P4 death saves: the player rolls them ===\n')
  {
    const g = await seedTurnFixture(dbRun, { prefix: 'TEST_CLF_DS', hp: 0, maxHp: 20 })
    fixtures.push(g)
    await dbRun('UPDATE characters SET is_unconscious = 1, death_save_successes = 0, death_save_failures = 0 WHERE id = ?', [g.characterId])
    assert(await rollDeathSave(g.characterId) === null, 'rollDeathSave without the player\'s die rolls nothing')
    llm.reply('You lie still on the cold flagstones.')
    let r = await server.post(`/api/dm-session/${g.sessionId}/message`, { action: 'I hold on.' })
    let row = await dbGet('SELECT death_save_successes AS s, death_save_failures AS f FROM characters WHERE id = ?', [g.characterId])
    assert(row.s === 0 && row.f === 0, 'no death save was rolled for the player')
    assert((r.body.rollPrompts || []).some((p) => /Roll a d20 for your death saving throw/.test(p)), 'the player is asked for the death save d20')
    llm.reply('Your breath steadies.')
    r = await server.post(`/api/dm-session/${g.sessionId}/message`, { action: '12' })
    row = await dbGet('SELECT death_save_successes AS s, death_save_failures AS f FROM characters WHERE id = ?', [g.characterId])
    assert(r.body.deathSave?.roll === 12 && row.s === 1 && row.f === 0, 'the reported 12 is the save: one success')
    assert((r.body.rollMath || []).some((m) => /Death save: d20 12 vs DC 10 — success/.test(m)), 'the math panel shows the save')
    assert(/DEATH SAVE — system fact: the player rolled 12/.test(llm.lastCall.lastUserMessage), 'the DM is told the save result')
    assert(!(await cfgOf(g.sessionId)).pendingDeathSave, 'with no turn since, the next save is not asked yet')
  }
} finally {
  await server.close()
  restoreLlm()
  for (const fx of fixtures) await cleanupTurnFixture(dbRun, fx).catch(() => {})
}

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`)
if (failed > 0) process.exit(1)
