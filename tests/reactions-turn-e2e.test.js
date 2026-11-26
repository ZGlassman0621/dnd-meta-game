/**
 * mechanical-reactions — the real turn route over the stubbed-LLM harness.
 * Live probe 2026-11-25 on gemma4:12b: the player said "I cast Shield", the
 * model narrated a shimmering barrier with NO SPELL_CAST marker, and the
 * engine never ran it (no slot, no reaction, no +5 AC). The route now opens
 * the player's declared self-contained reaction spell (same shape as the
 * combat-loop P1 attack fallback) and states the result as a ⚙ line.
 * Also: a countered cast resolved on the player's reported save is a
 * binding engine fact + ⚙ line on that turn.
 */
import { initDatabase, dbRun, dbGet } from '../server/database.js'
import { safeParse } from '../server/utils/safeParse.js'
import { installLlmStub, restoreLlm, startTurnServer, seedTurnFixture, cleanupTurnFixture } from './helpers/llmHarness.js'

let passed = 0
let failed = 0
function assert(condition, message) {
  if (condition) { passed++; console.log(`  ✓ ${message}`) } else { failed++; console.log(`  ✗ ${message}`) }
}

async function run() {
  await initDatabase()
  const es = await import('../server/services/enemyCombatService.js')
  const ct = await import('../server/services/combatTurnService.js')
  const tl = await import('../server/services/turnLedgerService.js')
  const ess = await import('../server/services/enemySpellService.js')
  const rs = await import('../server/services/reactionService.js')
  const llm = installLlmStub()
  const server = await startTurnServer()
  const fixtures = []
  try {
    console.log('\n=== 1. Shield narrated without a marker: the engine opens it ===\n')
    {
      const f = await seedTurnFixture(dbRun, { prefix: 'TEST_RX_1', hp: 30, maxHp: 30 })
      fixtures.push(f)
      await dbRun('UPDATE characters SET class = ?, level = 5, armor_class = 12, spell_slots = ?, spell_slots_used = ? WHERE id = ?',
        ['Wizard', JSON.stringify({ 1: 4, 2: 3, 3: 2 }), '{}', f.characterId])
      const name = 'TEST_RX_1 Hero'
      const [gob] = await es.createEncounterEnemies(f.sessionId, 1, [{ name: 'Goblin', maxHp: 30, armorClass: 13, attackBonus: 4, damageDice: '1d6+2', dexMod: 2 }])
      await ct.initializeTurnOrder(f.sessionId, 1, [
        { name, type: 'player', key: await tl.ledgerKeyForPlayer(f.characterId) },
        { name: 'Goblin', type: 'enemy', key: `combat:${f.sessionId}:1:${gob.id}` },
      ])
      llm.reply('A shimmering veil of arcane force snaps into existence around you as the goblin lunges.')
      llm.reply('The goblin swings its rusted blade at you. [ENEMY_ATTACK: Enemy="Goblin" Target="Player"]')
      const r = await server.post(`/api/dm-session/${f.sessionId}/message`, { action: 'I cast Shield (1st-level slot) as my reaction.' })
      assert(r.status === 200, `turn succeeds (status ${r.status})`)
      const used = safeParse((await dbGet('SELECT spell_slots_used FROM characters WHERE id = ?', [f.characterId]))?.spell_slots_used, {})
      assert(Number(used['1'] || 0) === 1, 'the engine opened Shield: one 1st-level slot spent')
      // The round wraps back to the player, whose turn start ends Shield and
      // resets the reaction — so the proof is the goblin's judged AC.
      const text = String(r.body?.narrative || r.body?.response || '')
      assert(/⚙ Shield: \+5 AC/.test(text), 'the player sees the engine line for Shield')
      assert(/vs AC 17/.test(JSON.stringify(r.body?.rollMath || [])), `the goblin's attack was judged against AC 12 + 5 (rollMath: ${JSON.stringify(r.body?.rollMath)})`)
    }

    console.log('\n=== 2. A marker the DM did write is not doubled ===\n')
    {
      const f = await seedTurnFixture(dbRun, { prefix: 'TEST_RX_2', hp: 30, maxHp: 30 })
      fixtures.push(f)
      await dbRun('UPDATE characters SET class = ?, level = 5, spell_slots = ?, spell_slots_used = ? WHERE id = ?',
        ['Wizard', JSON.stringify({ 1: 4 }), '{}', f.characterId])
      const name = 'TEST_RX_2 Hero'
      const [gob] = await es.createEncounterEnemies(f.sessionId, 1, [{ name: 'Goblin', maxHp: 30, armorClass: 13, attackBonus: 4, damageDice: '1d6+2', dexMod: 2 }])
      await ct.initializeTurnOrder(f.sessionId, 1, [
        { name, type: 'player', key: await tl.ledgerKeyForPlayer(f.characterId) },
        { name: 'Goblin', type: 'enemy', key: `combat:${f.sessionId}:1:${gob.id}` },
      ])
      llm.reply('A veil of force rises. [SPELL_CAST: Spell="Shield" Level=1 Reaction="true"]')
      llm.reply('The goblin hesitates. [ENEMY_ATTACK: Enemy="Goblin" Target="Player"]')
      const r = await server.post(`/api/dm-session/${f.sessionId}/message`, { action: 'I cast Shield as my reaction.' })
      assert(r.status === 200, 'turn succeeds')
      const used = safeParse((await dbGet('SELECT spell_slots_used FROM characters WHERE id = ?', [f.characterId]))?.spell_slots_used, {})
      assert(Number(used['1'] || 0) === 1, 'exactly one slot spent (no double cast)')
    }

    console.log('\n=== 3. A countered cast on the reported save is an engine fact ===\n')
    {
      const f = await seedTurnFixture(dbRun, { prefix: 'TEST_RX_3', hp: 30, maxHp: 30 })
      fixtures.push(f)
      await dbRun('UPDATE characters SET class = ?, level = 5, spell_slots = ?, spell_slots_used = ? WHERE id = ?',
        ['Wizard', JSON.stringify({ 1: 4, 3: 2 }), '{}', f.characterId])
      const name = 'TEST_RX_3 Hero'
      const [mage] = await es.createEncounterEnemies(f.sessionId, 1, [{ name: 'Archmage', maxHp: 99, armorClass: 15, attackBonus: 6, damageDice: '1d8', dexMod: 2 }])
      await dbRun('UPDATE combat_enemies SET enemy_spell_slots_json = ? WHERE id = ?', [JSON.stringify({ 3: 3 }), mage.id])
      await ct.initializeTurnOrder(f.sessionId, 1, [
        { name, type: 'player', key: await tl.ledgerKeyForPlayer(f.characterId) },
        { name: 'Archmage', type: 'enemy', key: `combat:${f.sessionId}:1:${mage.id}` },
      ])
      await ess.armEnemyCounter(f.sessionId, 1, { enemyName: 'Archmage', dc: 17, targetName: null, deferred: true, level: 3, enemyId: mage.id })
      llm.reply('Three darts streak toward the Archmage. [SPELL_CAST: Spell="Magic Missile" Level=1 Target="Archmage"]')
      const r1 = await server.post(`/api/dm-session/${f.sessionId}/message`, { action: 'I cast Magic Missile at the Archmage.' })
      assert(r1.status === 200, 'cast turn succeeds')
      const cfg1 = safeParse((await dbGet('SELECT session_config FROM dm_sessions WHERE id = ?', [f.sessionId]))?.session_config, {})
      assert(!!cfg1.pendingCounteredCast, 'the counter fired: the player owes a Constitution save')
      let seen = null
      llm.reply(async (req) => { seen = JSON.stringify(req); return 'The darts unravel into motes of light.' })
      llm.reply('The Archmage smiles thinly. [ENEMY_ATTACK: Enemy="Archmage" Target="Player"]')
      const r2 = await server.post(`/api/dm-session/${f.sessionId}/message`, { action: '3' })
      assert(r2.status === 200, 'save turn succeeds')
      assert(/COUNTERSPELL — system fact/.test(seen || ''), 'the DM is handed the countered outcome as a binding fact')
      assert(/Your spell is countered/.test(String(r2.body?.narrative || '')), 'the player sees the ⚙ countered line')
      const used = safeParse((await dbGet('SELECT spell_slots_used FROM characters WHERE id = ?', [f.characterId]))?.spell_slots_used, {})
      assert(Number(used['1'] || 0) === 0, 'the countered spell slot is not expended')
      assert((await dbGet('SELECT current_hp FROM combat_enemies WHERE id = ?', [mage.id]))?.current_hp === 99, 'the countered spell did no damage')
    }
  } finally {
    for (const f of fixtures) { try { await cleanupTurnFixture(dbRun, f) } catch { /* best-effort */ } }
    await server.close()
    restoreLlm()
  }
  console.log(`\nreactions-turn-e2e: ${passed} passed, ${failed} failed`)
  process.exit(failed ? 1 : 0)
}

run().catch((e) => { console.error(e); process.exit(1) })
