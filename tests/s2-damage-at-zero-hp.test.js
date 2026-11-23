/**
 * S2 — damage at 0 HP (brief docs/pm/s2-damage-at-zero-hp/BRIEF.md; Zach's rulings 2026-11-12).
 *
 * Every branch, PC and companion, on the real services and a real DB:
 *  - the hit that drops a character to 0 adds NO failure;
 *  - a hit while already at 0 adds one failed death save, a crit adds two;
 *  - three failures kill through the existing columns (is_dead / the companion
 *    death-save outcome), and the dead stay dead;
 *  - NO massive damage: no hit, however large, kills outright;
 *  - temp HP absorbs first; damage to a stabilised PC clears stabilisation;
 *  - healing from 0 resets the counters exactly as before;
 *  - crits arrive both ways: the DM's HP_CHANGE crit=true, and the engine's own
 *    crit on an enemy attack (a forced natural 20);
 *  - the turn route announces a death caused by damage at 0 HP.
 * Rolled saves (nat 1 = two failures, nat 20 = revive) are unchanged; they are
 * pinned by tests/character-hp.test.js, re-checked here with forced dice.
 */
import { initDatabase, dbRun, dbGet } from '../server/database.js';
import { applyHpChange, applyCompanionDamage, rollDeathSave } from '../server/services/characterHpService.js';
import { processResponseMarkers } from '../server/services/markerPipeline.js';
import { createEncounterEnemies, resolveEnemyAttack } from '../server/services/enemyCombatService.js';
import { damageToCompanion } from '../server/services/enemySpellService.js';
import { installLlmStub, restoreLlm, startTurnServer, seedTurnFixture, cleanupTurnFixture } from './helpers/llmHarness.js';

let passed = 0;
let failed = 0;
function check(cond, msg) {
  if (cond) { passed++; console.log(`  ✓ ${msg}`); } else { failed++; console.log(`  ✗ ${msg}`); }
}

await initDatabase();
const made = { chars: [], comps: [], npcs: [] };

async function pc(prefix, { hp = 0, max = 20, temp = 0, s = 0, f = 0, unconscious = hp === 0 ? 1 : 0 } = {}) {
  const r = await dbRun(
    `INSERT INTO characters (name, class, race, level, current_hp, max_hp, temp_hp, current_location, experience_to_next_level,
       is_unconscious, is_dead, death_save_successes, death_save_failures)
     VALUES (?, 'Fighter', 'Human', 3, ?, ?, ?, 'TEST_S2_Town', 900, ?, 0, ?, ?)`,
    [`TEST_S2 ${prefix}`, hp, max, temp, unconscious, s, f]
  );
  const id = Number(r.lastInsertRowid);
  made.chars.push(id);
  return id;
}
const state = (id) => dbGet('SELECT current_hp, temp_hp, is_unconscious, is_dead, death_save_successes AS s, death_save_failures AS f FROM characters WHERE id = ?', [id]);

async function companion(prefix, ownerId, { hp = 0, max = 20, temp = 0, s = 0, f = 0, status = 'active' } = {}) {
  const npc = await dbRun('INSERT INTO npcs (name, race) VALUES (?, ?)', [`TEST_S2 ${prefix}`, 'Human']);
  made.npcs.push(Number(npc.lastInsertRowid));
  const r = await dbRun(
    `INSERT INTO companions (npc_id, recruited_by_character_id, status, companion_class, companion_level,
       companion_current_hp, companion_max_hp, companion_temp_hp, death_save_successes, death_save_failures)
     VALUES (?, ?, ?, 'Ranger', 3, ?, ?, ?, ?, ?)`,
    [Number(npc.lastInsertRowid), ownerId, status, hp, max, temp, s, f]
  );
  const id = Number(r.lastInsertRowid);
  made.comps.push(id);
  return id;
}
const cstate = (id) => dbGet('SELECT companion_current_hp AS hp, companion_temp_hp AS temp, death_save_successes AS s, death_save_failures AS f, status FROM companions WHERE id = ?', [id]);

// Force every die to its maximum (a natural 20; max damage).
const realRandom = Math.random;
const forceMaxDice = () => { Math.random = () => 0.9999; };
const forceMinDice = () => { Math.random = () => 0; };
const restoreDice = () => { Math.random = realRandom; };

try {
  console.log('\n=== PC: the dropping hit, hits at 0, crits, death ===\n');
  {
    const a = await pc('Drop', { hp: 5, max: 20 });
    const r1 = await applyHpChange(a, -8, 'goblin blade');
    const s1 = await state(a);
    check(r1.droppedToZero === true && s1.current_hp === 0 && s1.is_unconscious === 1, 'the hit that drops the PC to 0 leaves them unconscious at 0');
    check(s1.f === 0 && s1.s === 0 && r1.deathSaveFailuresAdded === undefined, 'the dropping hit adds NO failure');

    const r2 = await applyHpChange(a, -3, 'goblin blade again');
    const s2 = await state(a);
    check(r2.deathSaveFailuresAdded === 1 && s2.f === 1 && s2.is_dead === 0, 'a hit while already at 0 adds one failed death save');
    check(s2.current_hp === 0, 'HP stays clamped at 0');

    const b = await pc('Crit', { hp: 0 });
    const r3 = await applyHpChange(b, -4, 'critical stab', { crit: true });
    check(r3.deathSaveFailuresAdded === 2 && (await state(b)).f === 2 && r3.died === false, 'a critical hit at 0 adds two failures');

    const r4 = await applyHpChange(a, -2, 'third', { crit: true });
    const s4 = await state(a);
    check(r4.died === true && s4.f === 3 && s4.is_dead === 1, 'one + crit (two) = three failures: the PC dies (is_dead, the column rolled saves use)');
    check(await rollDeathSave(a) === null, 'the dead PC rolls no more death saves (the existing death path)');
    const r5 = await applyHpChange(a, -5, 'insult to injury');
    check(r5.applied === false && r5.reason === 'character_is_dead', 'damage to the dead does nothing');
    const r6 = await applyHpChange(a, 10, 'too late');
    check(r6.applied === false && (await state(a)).is_dead === 1, 'and healing does not bring them back (resurrection stays explicit)');
  }

  console.log('\n=== PC: no massive damage, ever ===\n');
  {
    const m = await pc('Massive', { hp: 10, max: 10 });
    const r = await applyHpChange(m, -1000, 'a falling castle');
    const st = await state(m);
    check(r.droppedToZero === true && st.current_hp === 0 && st.is_dead === 0, 'a hit of 1000 on a 10-HP PC drops them to 0 — not dead');
    check(st.f === 0, 'and adds no failure (it is the dropping hit)');
    const r2 = await applyHpChange(m, -1000, 'another castle');
    check((await state(m)).f === 1 && r2.died === false, 'a second huge hit at 0 is still just one failure');
  }

  console.log('\n=== PC: temp HP absorbs first; stabilisation clears; healing resets ===\n');
  {
    const t = await pc('Temp', { hp: 0, temp: 5 });
    const r1 = await applyHpChange(t, -3, 'absorbed');
    const s1 = await state(t);
    check(s1.temp_hp === 2 && s1.f === 0 && r1.deathSaveFailuresAdded === undefined, 'damage fully absorbed by temp HP adds no failure');
    const r2 = await applyHpChange(t, -4, 'breaks through');
    const s2 = await state(t);
    check(s2.temp_hp === 0 && s2.f === 1 && r2.deathSaveFailuresAdded === 1, 'damage that gets past temp HP adds the failure');

    const st = await pc('Stable', { hp: 0, s: 3, f: 1 });
    const r3 = await applyHpChange(st, -2, 'kicked while down');
    const s3 = await state(st);
    check(r3.stabilisationCleared === true && s3.s === 0 && s3.f === 2, 'damage to a stabilised PC adds a failure and clears stabilisation');
    const partly = await pc('Partly', { hp: 0, s: 2, f: 0 });
    await applyHpChange(partly, -2, 'hit');
    check((await state(partly)).s === 2, 'successes short of stable are kept (only stabilisation is cleared)');

    const h = await pc('Heal', { hp: 0, s: 1, f: 2 });
    const r4 = await applyHpChange(h, 6, 'healing word');
    const s4 = await state(h);
    check(r4.roseAboveZero === true && s4.current_hp === 6 && s4.s === 0 && s4.f === 0 && s4.is_unconscious === 0, 'healing from 0 resets both counters and wakes the PC, as before');
  }

  console.log('\n=== PC: reported saves judged unchanged ===\n');
  {
    const n1 = await pc('Nat1', { hp: 0 });
    // Combat-loop fix P4: the death save is the player's reported d20.
    const r1 = await rollDeathSave(n1, 1);
    check(r1.roll === 1 && r1.failures === 2, 'a natural 1 still counts as two failures');
    const n20 = await pc('Nat20', { hp: 0, f: 2 });
    const r2 = await rollDeathSave(n20, 20);
    check(r2.roll === 20 && r2.outcome === 'revived' && (await state(n20)).current_hp === 1, 'a natural 20 still revives at 1 HP');
  }

  console.log('\n=== Crits, both kinds ===\n');
  {
    // DM-declared: HP_CHANGE crit=true through the real marker pipeline.
    const d = await pc('MarkerCrit', { hp: 0 });
    const res = await processResponseMarkers('The ogre brings the club down. [HP_CHANGE: delta=-9 crit=true reason="critical club"]', { characterId: d });
    const hr = res.handlerResults.find((h) => h.schemaKey === 'HP_CHANGE');
    check(hr?.ok && hr.result.crit === true && hr.result.deathSaveFailuresAdded === 2, 'HP_CHANGE crit=true at 0 HP adds two failures');
    const d2 = await pc('MarkerPlain', { hp: 0 });
    const res2 = await processResponseMarkers('[HP_CHANGE: delta=-9 reason="club"]', { characterId: d2 });
    check(res2.handlerResults.find((h) => h.schemaKey === 'HP_CHANGE')?.result.deathSaveFailuresAdded === 1, 'HP_CHANGE without crit adds one');

    // Engine-judged: an enemy attack that rolls a natural 20 against a downed PC.
    const fx = await seedTurnFixture(dbRun, { prefix: 'TEST_S2_ENC' });
    made.fixture = fx;
    await dbRun('UPDATE characters SET current_hp = 0, is_unconscious = 1, death_save_failures = 0 WHERE id = ?', [fx.characterId]);
    await createEncounterEnemies(fx.sessionId, 1, [{ name: 'TEST_S2 Ogre', maxHp: 30, armorClass: 11, attackBonus: 6, damageDice: '2d8+4', dexMod: 0 }]);
    forceMaxDice();
    const atk = await resolveEnemyAttack(fx.sessionId, 1, 'TEST_S2 Ogre', { type: 'player', id: fx.characterId, name: 'Player', armorClass: 15 });
    restoreDice();
    check(atk?.isCrit === true && atk.hit === true, `the engine rolled a critical hit (d20 ${atk?.attackRoll})`);
    check(atk?.hpResult?.crit === true && atk.hpResult.deathSaveFailuresAdded === 2, 'the engine crit reaches the rule with no DM flag: two failures');
  }

  console.log('\n=== Companions: the same rule ===\n');
  {
    const owner = await pc('Owner', { hp: 20, max: 20, unconscious: 0 });
    const c1 = await companion('Drop', owner, { hp: 4, s: 2, f: 1 });
    const r1 = await applyCompanionDamage(c1, 9);
    const s1 = await cstate(c1);
    check(r1.droppedToZero === true && s1.hp === 0 && s1.f === 0 && s1.s === 0 && r1.deathSaveFailuresAdded === undefined,
      'the dropping hit on a companion adds no failure and starts fresh counters (stale 2/1 cleared)');
    const r2 = await applyCompanionDamage(c1, 3);
    check(r2.deathSaveFailuresAdded === 1 && (await cstate(c1)).f === 1, 'a hit on a companion already at 0 adds one failure');
    const r3 = await applyCompanionDamage(c1, 3, { crit: true });
    check(r3.deathSaveFailuresAdded === 2 && r3.dead === true && (await cstate(c1)).f === 3, 'a crit adds two: three failures, the companion death-save outcome (dead)');
    const c2 = await companion('Massive', owner, { hp: 8 });
    await applyCompanionDamage(c2, 500);
    check((await cstate(c2)).hp === 0 && (await cstate(c2)).f === 0, 'no massive damage for companions either');
    const c3 = await companion('Temp', owner, { hp: 0, temp: 4 });
    const r4 = await applyCompanionDamage(c3, 3);
    check((await cstate(c3)).temp === 1 && r4.deathSaveFailuresAdded === undefined, 'companion temp HP absorbs first: no failure');
    const r5 = await applyCompanionDamage(c3, 3);
    check((await cstate(c3)).temp === 0 && r5.deathSaveFailuresAdded === 1, 'damage past companion temp HP adds the failure');
    const c4 = await companion('Dead', owner, { hp: 0, f: 3, status: 'deceased' });
    const r6 = await applyCompanionDamage(c4, 5);
    check(r6.applied === 0 && (await cstate(c4)).f === 3, 'a deceased companion takes no further damage');
    // The spell damage path (also used by damage tables and displays) goes through the same helper.
    const c5 = await companion('Spell', owner, { hp: 0 });
    const r7 = await damageToCompanion(made.fixture.sessionId, 1, c5, 6, { crit: true });
    check(r7.deathSaveFailuresAdded === 2 && (await cstate(c5)).f === 2, 'enemy spell damage on a downed companion adds two on a crit');
    // The engine attack path, companion target.
    await dbRun('UPDATE companions SET companion_current_hp = 0, death_save_failures = 0 WHERE id = ?', [c5]);
    forceMaxDice();
    const atk = await resolveEnemyAttack(made.fixture.sessionId, 1, 'TEST_S2 Ogre', { type: 'companion', id: c5, name: 'TEST_S2 Spell', armorClass: 14 });
    restoreDice();
    check(atk?.isCrit === true && atk.hpResult?.deathSaveFailuresAdded === 2, 'an enemy crit on a downed companion adds two failures');
  }

  console.log('\n=== The turn route announces a death caused by damage at 0 HP ===\n');
  {
    const llm = installLlmStub({ strict: false, fallback: 'The scene continues.' });
    const server = await startTurnServer();
    try {
      const fx = await seedTurnFixture(dbRun, { prefix: 'TEST_S2_TURN' });
      made.turnFixture = fx;
      await dbRun('UPDATE characters SET current_hp = 0, is_unconscious = 1, death_save_failures = 2 WHERE id = ?', [fx.characterId]);
      llm.reply('The goblin drives its blade down into you. [HP_CHANGE: delta=-5 reason="goblin blade"]');
      const res = await server.post(`/api/dm-session/${fx.sessionId}/message`, { action: 'I lie still.' });
      check(res.status === 200, `the turn runs (got ${res.status})`);
      const st = await state(fx.characterId);
      check(st.is_dead === 1 && st.f === 3, 'the hit at 0 HP made the third failure: the player is dead');
      check(res.body?.deathSave === undefined, 'no death save was rolled after the fatal hit');
      const msgs = JSON.parse((await dbGet('SELECT messages FROM dm_sessions WHERE id = ?', [fx.sessionId])).messages);
      check(msgs.some((m) => typeof m.content === 'string' && m.content.includes('took damage while at 0 HP') && m.content.includes('THE PLAYER CHARACTER HAS DIED')),
        'the session records a system note that the player died from damage at 0 HP');
    } finally {
      restoreLlm();
      await server.close();
    }
  }

  console.log('\n=== The prompt tells the DM how ===\n');
  {
    const fs = await import('node:fs');
    const src = fs.readFileSync(new URL('../server/services/dmPromptBuilder.js', import.meta.url), 'utf8');
    check(src.includes('crit=true') && src.includes('Each hit while at 0 HP is one failed death save (crit=true makes it two)'),
      'the HP rules tell the DM to mark crits and that hits at 0 HP are failed death saves');
    check(src.includes('There is no instant death from a single big hit.'), 'the HP rules say there is no massive-damage death');
  }
} finally {
  restoreDice();
  if (made.fixture) await cleanupTurnFixture(dbRun, made.fixture).catch(() => {});
  if (made.turnFixture) await cleanupTurnFixture(dbRun, made.turnFixture).catch(() => {});
  for (const id of made.comps) await dbRun('DELETE FROM companions WHERE id = ?', [id]).catch(() => {});
  for (const id of made.npcs) await dbRun('DELETE FROM npcs WHERE id = ?', [id]).catch(() => {});
  for (const id of made.chars) await dbRun('DELETE FROM characters WHERE id = ?', [id]).catch(() => {});
}

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
if (failed > 0) process.exit(1);
