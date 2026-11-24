/**
 * Player rolls out of combat (2026-11-23) —
 * docs/pm/player-rolls-out-of-combat/BRIEF.md.
 *
 * Zach: "ALWAYS — as a rule, the DM never rolls for the player." Each
 * item's "fixed looks like", driven through the real POST /:sessionId/
 * message route over the stubbed-LLM harness where the roll happens in
 * play, and through the service where it does not (crafting):
 *
 *   1  a short rest asks for the player's Hit Dice; their numbers heal
 *      die + CON each.
 *   2  a cold march asks for ONE batch of hourly CON saves; each hour
 *      resolves from the player's number, in order.
 *   3  finishing a craft asks for the player's d20; the outcome follows
 *      it.
 *   5  (survey find) a lair hazard asks for the player's save; the
 *      hazard's damage applies on a failure.
 *
 * Every step also checks the engine's roll log: no die is rolled for the
 * player. The test character is invented (Brin Halloway).
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
const rng = await import('../server/utils/rng.js')
const prs = await import('../server/services/playerRollService.js')
const cold = await import('../server/services/coldExposureService.js')
const crafting = await import('../server/services/craftingService.js')
const lair = await import('../server/services/lairDurabilityService.js')
const sched = await import('../server/services/scheduleService.js')

const cfgOf = async (sid) => safeParse((await dbGet('SELECT session_config FROM dm_sessions WHERE id = ?', [sid]))?.session_config, {})
const pcRow = async (cid) => dbGet('SELECT current_hp, max_hp, hit_dice_used, frost_exhaustion FROM characters WHERE id = ?', [cid])
const rolledFor = (re) => rng.getRollLog().filter((r) => re.test(String(r.reason || '')))

// ---------------------------------------------------------------------------
console.log('\n=== Reading the player\'s numbers ===\n')
{
  const l = prs.reportedNumberList
  assert(JSON.stringify(l('7 4')) === '[7,4]', '"7 4" → [7, 4]')
  assert(JSON.stringify(l('12, 7, 15 and 3')) === '[12,7,15,3]', '"12, 7, 15 and 3" → four numbers')
  assert(JSON.stringify(l('0')) === '[0]', '"0" → [0] (spend none)')
  assert(l('I take a short rest.') === null && l('7 goblins') === null, 'a sentence is not a number list')
}

const llm = installLlmStub()
const server = await startTurnServer()
const fixtures = []
try {
  const f = await seedTurnFixture(dbRun, { prefix: 'TEST_PROC', hp: 10, maxHp: 30 })
  fixtures.push(f)
  const cid = f.characterId
  const sid = f.sessionId
  await dbRun(
    `UPDATE characters SET name = ?, ability_scores = ?, hit_dice = ?, hit_dice_used = '{}', current_location = ?,
       inventory = '[]', equipment = '{}', frost_exhaustion = 0, cold_wet_status = 'dry' WHERE id = ?`,
    ['Brin Halloway', JSON.stringify({ str: 14, dex: 18, con: 14, int: 10, wis: 12, cha: 8 }),
      JSON.stringify({ d10: 3 }), 'the open tundra north of the pass', cid])
  const post = (body) => server.post(`/api/dm-session/${sid}/message`, body)

  // -------------------------------------------------------------------------
  console.log('\n=== Item 1: a short rest asks for the player\'s Hit Dice ===\n')
  rng.clearRollLog()
  llm.reply('You find a sheltered hollow and catch your breath. [REST: Type=short Dice=2]')
  let res = await post({ action: 'I take a short rest.' })
  assert(res.status === 200, `the rest turn returns 200 (got ${res.status})`)
  let pc = await pcRow(cid)
  assert(pc.current_hp === 10 && pc.hit_dice_used === '{}', 'the rest spends no Hit Die and heals nothing by itself')
  assert(rolledFor(/hit-die/).length === 0, 'the engine rolled no Hit Die')
  let cfg = await cfgOf(sid)
  assert(cfg.pendingHitDice?.dice?.join(',') === 'd10,d10,d10' && cfg.pendingHitDice.conMod === 2, 'the ask is posted: three d10s, +2 CON after')
  const ask = (res.body.rollPrompts || []).join('\n')
  assert(/Short rest: you're at 10\/30 HP with 3 Hit Dice left \(d10, d10, d10\)/.test(ask), 'the player is told their HP and the dice they can spend')
  assert(/send 0 to spend none/.test(ask) && /adds \+2 \(CON\) to each after/.test(ask), 'the ask offers 0 and says the engine adds CON after')
  assert(/Short rest:/.test(res.body.narrative), 'the ask is in the narrative')

  llm.reply('You shake out your sword arm.')
  res = await post({ action: '12' })
  assert(/Hit Dice not spent: a d10 can't roll 12/.test(res.body.narrative), 'a face the die cannot roll is refused in plain words')
  assert(!!(await cfgOf(sid)).pendingHitDice && (await pcRow(cid)).current_hp === 10, 'the ask stays for a re-report; HP unchanged')

  // The live probe's DM restated the rest's hour on the settling reply;
  // that hour has already passed, so the clock must not move again.
  llm.reply('Warmth creeps back into your limbs. [TIME_ADVANCE: Hours=1 Reason="short rest"]')
  const clockBefore = await sched.getClock(f.campaignId)
  const before = llm.callCount
  res = await post({ action: '7 4' })
  const clockAfter = await sched.getClock(f.campaignId)
  assert(clockAfter.hour === clockBefore.hour && clockAfter.dayOfYear === clockBefore.dayOfYear, 'a TIME_ADVANCE on the Hit Dice reply does not count the rest\'s hour twice')
  assert(/ALREADY passed on the clock/.test(llm.lastCall.lastUserMessage), 'the fact tells the DM the rest\'s hour has passed')
  pc = await pcRow(cid)
  assert(pc.current_hp === 25, `the reported 7 and 4 heal (7+2) + (4+2) = 15: 10 → 25 (got ${pc.current_hp})`)
  assert(JSON.parse(pc.hit_dice_used).d10 === 2, 'two Hit Dice are spent')
  assert(/⚙ Hit Dice: d10 7 \+ 2 \(CON\) = 9, d10 4 \+ 2 \(CON\) = 6 → \+15 HP \(10 → 25\/30\); 1 left/.test(res.body.narrative), 'the ⚙ line shows the math after the roll')
  assert(!(await cfgOf(sid)).pendingHitDice, 'the ask clears')
  assert(llm.callCount === before + 1 && /HIT DICE — system fact/.test(llm.lastCall.lastUserMessage), 'the DM is told the result this turn, as a fact')
  assert(!(res.body.rollMath || []).length, 'the combat math panel stays combat-only')
  const stored = safeParse((await dbGet('SELECT messages FROM dm_sessions WHERE id = ?', [sid])).messages, [])
  assert(stored.some((m) => m.role === 'user' && m.content === '7 4') && !stored.some((m) => m.role === 'user' && m.content.startsWith('7 4\n')), 'the clean action is stored; the fact rides as a system note')
  assert(rolledFor(/hit-die/).length === 0, 'still no engine-rolled Hit Die')

  // "0" spends none.
  await dbRun('UPDATE characters SET current_hp = 20 WHERE id = ?', [cid])
  llm.reply('A brief halt. [REST: Type=short]')
  await post({ action: 'Another short rest.' })
  llm.reply('You save your strength.')
  res = await post({ action: '0' })
  assert(/⚙ Hit Dice: none spent — 20\/30 HP, 1 left/.test(res.body.narrative) && !(await cfgOf(sid)).pendingHitDice, '"0" spends none and clears the ask')

  // -------------------------------------------------------------------------
  console.log('\n=== Item 2: a cold march asks for ONE batch of hourly saves ===\n')
  rng.clearRollLog()
  await cold.setColdScene(sid, { baseColdLevel: 2 })
  llm.reply('The wind knifes through you as the road climbs. [TIME_ADVANCE: Hours=4 Reason="the march north"]')
  res = await post({ action: 'We march north into the snow.' })
  cfg = await cfgOf(sid)
  assert(cfg.pendingColdSaves?.segments?.[0]?.hours === 4, 'four hours of cold are waiting on the player')
  assert(rolledFor(/cold-exposure/).length === 0, 'the engine rolled no cold save for the player')
  const coldAsk = (res.body.rollPrompts || []).join('\n')
  assert(/4 hours in the cold — roll 4 Constitution saving throws/.test(coldAsk) && /send all 4 numbers in one message/.test(coldAsk), 'ONE ask: four saves, all numbers in one message')
  assert(!/\bDC\b/.test(coldAsk), 'the ask hides the DC')
  assert(Number(pc.frost_exhaustion || 0) === 0 && Number((await pcRow(cid)).frost_exhaustion || 0) === 0, 'no frost before the player rolls')

  llm.reply('You grit your teeth against the cold.')
  res = await post({ action: '20 15 1 20' })
  const coldPc = await pcRow(cid)
  assert(Number(coldPc.frost_exhaustion) >= 1, `the reported natural 1 fails its hour: frost ≥ 1 (got ${coldPc.frost_exhaustion})`)
  assert(/⚙ Cold saves: hour 1: d20 20 \+ 2 \(CON\) = 22 — held; hour 2: d20 15/.test(res.body.narrative), 'each hour resolves from the player\'s number, in order')
  assert(/hour 3: d20 1 [+−] \d \(CON\) = -?\d+ — failed/.test(res.body.narrative), 'hour 3 (the 1) fails')
  assert(!/Cold saves[^\n]*\bDC\b/.test(res.body.narrative), 'the ⚙ line shows no DC')
  assert(!(await cfgOf(sid)).pendingColdSaves && /COLD EXPOSURE — system fact/.test(llm.lastCall.lastUserMessage), 'the ask clears and the DM gets the fact')
  await cold.clearColdScene(sid)
  await dbRun('UPDATE characters SET frost_exhaustion = 0 WHERE id = ?', [cid])

  // -------------------------------------------------------------------------
  console.log('\n=== Item 3: finishing a craft asks for the player\'s d20 ===\n')
  rng.clearRollLog()
  const rec = await dbRun(
    `INSERT INTO crafting_recipes (name, category, craft_time_hours, difficulty_dc, ability_check, output_item, is_default)
     VALUES (?, ?, ?, ?, ?, ?, 0)`,
    ['TEST_PROC Dagger', 'weapon', 1, 12, 'dexterity', JSON.stringify({ name: 'Dagger' })])
  const recipeId = Number(rec.lastInsertRowid)
  const mkProject = async () => Number((await dbRun(
    `INSERT INTO crafting_projects (character_id, recipe_id, status, hours_invested, hours_required) VALUES (?, ?, 'in_progress', 1, 1)`,
    [cid, recipeId])).lastInsertRowid)
  const p1 = await mkProject()
  const askRes = await crafting.completeProject(p1, 100)
  assert(askRes.needsRoll === true && askRes.modifier === 4, 'with no die the engine asks: d20, +4 (DEX) after')
  assert(/Roll a d20 for the Dexterity check to finish TEST_PROC Dagger — the engine adds \+4 \(DEX\) after/.test(askRes.prompt) && !/\bDC\b/.test(askRes.prompt), 'the ask says what to roll and hides the DC')
  assert((await dbGet('SELECT status FROM crafting_projects WHERE id = ?', [p1])).status === 'in_progress', 'the project waits on the roll')
  assert((await crafting.completeProject(p1, 100, 25)).error, 'a 25 is refused (a d20 rolls 1–20)')
  const done = await crafting.completeProject(p1, 100, 15)
  assert(done.success === true && done.roll.d20 === 15 && done.roll.total === 19 && done.quality === 'fine', 'the reported 15 + 4 = 19 succeeds (margin 7 → fine)')
  const p2 = await mkProject()
  const flop = await crafting.completeProject(p2, 100, 3)
  assert(flop.success === false && flop.roll.total === 7, 'the reported 3 + 4 = 7 fails')
  assert(rolledFor(/crafting/).length === 0, 'the engine rolled no crafting check')
  await dbRun('DELETE FROM crafting_projects WHERE recipe_id = ?', [recipeId])
  await dbRun('DELETE FROM crafting_recipes WHERE id = ?', [recipeId])

  // -------------------------------------------------------------------------
  console.log('\n=== Item 5 (survey find): a lair hazard asks for the player\'s save ===\n')
  rng.clearRollLog()
  await dbRun('UPDATE characters SET current_hp = 30 WHERE id = ?', [cid])
  const struck = await lair.strikeHazard('TEST_PROC lair', { kind: 'rockfall', name: 'rockfall', dc: 13, saveAbility: 'dex', damage: 7 },
    { sessionId: sid, combatants: [{ type: 'player', key: `player:${cid}`, name: 'Brin Halloway' }] })
  assert(struck.results[0]?.pending === true && struck.awaitingPlayerSave === true, 'the player\'s save is asked for, not rolled')
  assert(rolledFor(/lair hazard save/).length === 0, 'the engine rolled no save for the player')
  cfg = await cfgOf(sid)
  assert(cfg.pendingTrapSave?.fixedDamage === 7 && cfg.pendingRoll?.effectKey === cfg.pendingTrapSave.key && cfg.pendingRoll.dc === 13, 'the save rides the trap-save slot with the hazard\'s damage')
  assert((await pcRow(cid)).current_hp === 30, 'no damage before the player rolls')
  llm.reply('Stone crashes down around you.')
  res = await post({ action: '5' })
  assert((await pcRow(cid)).current_hp === 23, `the reported 5 + 4 = 9 fails DC 13: 7 damage, 30 → 23 (got ${(await pcRow(cid)).current_hp})`)
  assert(!(await cfgOf(sid)).pendingTrapSave, 'the pending hazard save clears')

  // -------------------------------------------------------------------------
  console.log('\n=== Fix-as-found: a check the DM asks for is shown to the player ===\n')
  llm.reply('The ledge is slick with ice. [ROLL_REQUEST: Skill="Athletics" DC=15 Looks="a hard climb up wet ice"]')
  res = await post({ action: 'I try to climb the icy ledge.' })
  const checkAsk = (res.body.rollPrompts || []).join('\n')
  assert(/🎲 Roll a d20 for an Athletics check — the engine adds \+\d after\./.test(checkAsk), 'the player is told what to roll and what the engine adds')
  assert(!/\bDC\b|15/.test(checkAsk), 'the ask shows no DC')
  llm.reply('You haul yourself up.')
  res = await post({ action: '12' })
  assert(!(await cfgOf(sid)).pendingRoll, 'the reported 12 settles the check')

  // -------------------------------------------------------------------------
  console.log('\n=== PM decision: the first open Perception ask with no bank opens the bank ===\n')
  llm.reply('Something glints in the snow ahead. [ROLL_REQUEST: Skill="Perception" DC=13 Looks="a half-buried glint"]')
  res = await post({ action: 'I trudge on through the drifts.' })
  cfg = await cfgOf(sid)
  assert(cfg.pendingRoll?.bank === 'perception' && cfg.pendingRoll.trigger === 'first_ask' && cfg.pendingRoll.count === 3, 'the open ask is refused and the player is asked for their 3 numbers instead')
  assert((res.body.rollPrompts || []).some((p) => /🎲 Perception for the open tundra north of the pass: roll 3 d20s/.test(p)), 'the player sees the bank ask for this place (not a check)')
  const firstNotes = safeParse((await dbGet('SELECT messages FROM dm_sessions WHERE id = ?', [sid])).messages, [])
  assert(firstNotes.some((m) => m.role === 'user' && /no banked Perception, so the engine is asking/.test(m.content) && /PERCEPTION_USE/.test(m.content)), 'the DM is told to read the bank once the numbers are in')
  llm.reply('You shade your eyes against the glare.')
  await post({ action: '13 6 18' })
  assert((await dbGet("SELECT banked_die FROM perception_pre_rolls WHERE session_id = ? AND actor_type = 'pc' AND dungeon_key = 'the open tundra north of the pass'", [sid]))?.banked_die === 13, 'the player\'s 13 is banked for this place')

  // -------------------------------------------------------------------------
  console.log('\n=== Item 4: the Perception bank — 3 numbers at the door, secret reads ===\n')
  rng.clearRollLog()
  llm.reply('The mine mouth gapes before you, black and cold. [PERCEPTION_PREROLL: Dungeon="Old Mine"]')
  res = await post({ action: 'I light a torch and step into the old mine.' })
  const doorAsk = (res.body.rollPrompts || []).join('\n')
  assert(/At the door of Old Mine: roll 3 d20s for Perception and send all 3 numbers in one message/.test(doorAsk), 'the door asks for 3 numbers in one message')
  assert(!/\bDC\b/.test(doorAsk), 'the door ask shows no DC')
  llm.reply('You steady the torch.')
  res = await post({ action: '14' })
  assert(/Perception not banked: send 3 numbers/.test(res.body.narrative) && (await cfgOf(sid)).pendingRoll?.bank === 'perception', 'one number is refused in plain words; the ask stays')
  llm.reply('Your eyes adjust to the dark.')
  res = await post({ action: '14 8 17' })
  cfg = await cfgOf(sid)
  const pcBank = await dbGet("SELECT banked_die FROM perception_pre_rolls WHERE session_id = ? AND dungeon_key = 'Old Mine' AND actor_type = 'pc'", [sid])
  assert(pcBank?.banked_die === 14 && JSON.stringify(cfg.perceptionSpares?.['Old Mine']?.dice) === '[8,17]', 'the 14 is banked; 8 and 17 wait as spares')
  // The session's rolling summary also calls the model now; read the DM's call.
  const dmCall = [...llm.calls].reverse().find((c) => /Dungeon Master/.test(c.system))
  assert(/PERCEPTION BANKED/.test(dmCall?.system || '') && /Tell the player their banked number/.test(dmCall?.system || ''), 'the DM is told the banked number and the secrecy rule')
  // The live probe's DM asked an open Perception roll at a hidden trap
  // while the bank was active — the tell. The engine refuses it.
  llm.reply('A faint seam crosses the floor ahead. [ROLL_REQUEST: Skill="Perception" DC=15 Looks="a seam in the floor"]')
  res = await post({ action: 'I walk on down the tunnel.' })
  assert(!(await cfgOf(sid)).pendingRoll && !(res.body.rollPrompts || []).some((p) => /Perception/.test(p)), 'an open Perception ask during the bank is refused: no pending roll, no prompt')
  const notes = safeParse((await dbGet('SELECT messages FROM dm_sessions WHERE id = ?', [sid])).messages, [])
  assert(notes.some((m) => m.role === 'user' && /Perception ROLL_REQUEST was NOT sent/.test(m.content) && /PERCEPTION_USE/.test(m.content)), 'the DM is told why, and to read the bank instead')
  llm.reply('You run your fingers along the stone. [ROLL_REQUEST: Skill="Perception" DC=13 Looks="old scratches"]')
  res = await post({ action: 'I search the walls for hidden switches.' })
  assert((await cfgOf(sid)).pendingRoll?.name === 'Perception', 'a search the player declares still asks for the roll openly')
  llm.reply('Nothing but old scratches.')
  await post({ action: '9' })
  // The DM reads the number in secret: the player sees nothing about it.
  llm.reply('The passage narrows; loose stones skitter underfoot. [PERCEPTION_USE: Target="Brin Halloway" Trigger="trap" DC=12]')
  res = await post({ action: 'I keep walking down the tunnel.' })
  assert(!/Perception|banked|PERCEPTION_USE|🎲/.test(res.body.narrative), 'the player sees no read, no number and no ask')
  const pcBank2 = await dbGet("SELECT banked_die FROM perception_pre_rolls WHERE session_id = ? AND dungeon_key = 'Old Mine' AND actor_type = 'pc'", [sid])
  assert(pcBank2?.banked_die === 8, 'the used 14 is replaced by the player\'s own spare 8')
  assert(rolledFor(/perception-preroll:Brin/).length === 0, 'the engine rolled no Perception die for the player')
} finally {
  for (const fx of fixtures) await cleanupTurnFixture(dbRun, fx).catch(() => {})
  await server.close()
  restoreLlm()
}

console.log(`\nplayer-rolls-out-of-combat: ${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)
