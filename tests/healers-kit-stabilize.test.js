/**
 * Healer's Kit — stabilize with no check (brief docs/pm/healers-kit-stabilize,
 * Part 1; 2024 PHB Healer's Kit, book rule).
 *
 * On the real services and a real (throwaway) DB:
 *  - the three directions: the player on a downed companion, a companion on
 *    the downed player, a companion on a downed companion — one use spent,
 *    no check, stable at 0 HP (successes 3, failures 0), still unconscious;
 *  - every refusal spends nothing: no kit, kit spent, target not at 0 HP,
 *    target dead, target already stable, user at 0 HP, user incapacitated,
 *    user out of turn in a fight;
 *  - uses: ten in a fresh kit (an entry with no record is fresh), a stack
 *    opens the next kit, the last kit counts down to 0 and then refuses;
 *  - the 1d4 hours: a companion's die is the engine's, the player's die is
 *    asked and settled from the player's number; the recovery fires when
 *    session time passes the hour; damage at 0 clears it;
 *  - the marker through the real pipeline, the engine line, the DM prompt
 *    line, and the companion turn directive;
 *  - the Medicine-check stabilize route is unchanged.
 * Run: npm test healers-kit
 */
import express from 'express';
import { initDatabase, dbRun, dbGet, dbAll } from '../server/database.js';
import {
  spendKitUse, kitUsesLeft, kitTotalUses, isHealersKit, useHealersKit, absoluteHour,
  processStableRecoveries, healersKitResultText, KIT_USES, dyingPartyCue,
} from '../server/services/healersKitService.js';
import { applyHpChange, applyCompanionDamage } from '../server/services/characterHpService.js';
import { processResponseMarkers } from '../server/services/markerPipeline.js';
import { validateDmMarkers } from '../server/services/markerSchemas.js';
import { advanceClockForSession } from '../server/services/restTimeService.js';
import { settleOutOfCombatRoll, outOfCombatRollPrompts } from '../server/services/playerRollService.js';
import { addCondition } from '../server/services/conditionService.js';
import { initializeTurnOrder } from '../server/services/combatTurnService.js';
import { createEncounterEnemies } from '../server/services/enemyCombatService.js';
import { npcTurnDirective, setPendingDeathSave } from '../server/services/combatLoopService.js';
import { getClock } from '../server/services/scheduleService.js';
import companionRouter from '../server/routes/companion.js';
import fs from 'node:fs';

let passed = 0;
let failed = 0;
function check(cond, msg) {
  if (cond) { passed++; console.log(`  ✓ ${msg}`); } else { failed++; console.log(`  ✗ ${msg}`); }
}
function group(name) { console.log(`\n== ${name}`); }

await initDatabase();
const made = { chars: [], comps: [], npcs: [], sessions: [], campaigns: [] };

// Insert a row listing every NOT NULL column with no default.
async function insertRow(table, overrides) {
  const info = await dbAll(`PRAGMA table_info(${table})`);
  const cols = []; const vals = [];
  for (const c of info) {
    if (c.name === 'id') continue;
    if (Object.prototype.hasOwnProperty.call(overrides, c.name)) { cols.push(c.name); vals.push(overrides[c.name]); continue; }
    if (c.notnull && c.dflt_value == null) {
      const t = (c.type || '').toUpperCase();
      cols.push(c.name); vals.push(t.includes('INT') || t.includes('REAL') ? 1 : `TEST_${c.name}`);
    }
  }
  const r = await dbRun(`INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`, vals);
  return Number(r.lastInsertRowid);
}

async function campaign(name) {
  const id = await insertRow('campaigns', { name: `TEST_HK ${name}`, status: 'active' });
  made.campaigns.push(id);
  return id;
}
async function pc(name, { hp = 20, campaignId = null, inventory = [], s = 0, f = 0 } = {}) {
  const id = await insertRow('characters', {
    name: `TEST_HK ${name}`, class: 'Fighter', race: 'Human', level: 3, current_hp: hp, max_hp: 20,
    current_location: 'TEST_HK Road', experience_to_next_level: 900, campaign_id: campaignId,
    is_unconscious: hp === 0 ? 1 : 0, is_dead: 0, death_save_successes: s, death_save_failures: f,
    inventory: JSON.stringify(inventory),
  });
  made.chars.push(id);
  return id;
}
async function companion(name, ownerId, { hp = 15, s = 0, f = 0, status = 'active' } = {}) {
  const npcId = await insertRow('npcs', { name, race: 'Human' });
  made.npcs.push(npcId);
  const id = await insertRow('companions', {
    npc_id: npcId, recruited_by_character_id: ownerId, status, companion_class: 'Ranger', companion_level: 3,
    companion_current_hp: hp, companion_max_hp: 15, death_save_successes: s, death_save_failures: f,
  });
  made.comps.push(id);
  return id;
}
async function session(characterId, campaignId = null) {
  const id = await insertRow('dm_sessions', { character_id: characterId, campaign_id: campaignId, status: 'active', session_config: '{}' });
  made.sessions.push(id);
  return id;
}
const pcState = (id) => dbGet('SELECT current_hp AS hp, is_unconscious AS unc, is_dead AS dead, death_save_successes AS s, death_save_failures AS f, stable_recover_at AS rec, inventory FROM characters WHERE id = ?', [id]);
const compState = (id) => dbGet('SELECT companion_current_hp AS hp, death_save_successes AS s, death_save_failures AS f, stable_recover_at AS rec FROM companions WHERE id = ?', [id]);
const kitOf = async (pcId) => JSON.parse((await dbGet('SELECT inventory FROM characters WHERE id = ?', [pcId])).inventory).find(isHealersKit);
const cfgOf = async (sid) => JSON.parse((await dbGet('SELECT session_config FROM dm_sessions WHERE id = ?', [sid])).session_config || '{}');

const realRandom = Math.random;
const forceDie = (face, sides) => { Math.random = () => (face - 1) / sides + 1e-9; };
const restoreDice = () => { Math.random = realRandom; };

try {
  // =========================================================================
  group('1. Kit uses (pure)');
  {
    check(KIT_USES === 10, 'a Healer\'s Kit has ten uses');
    check(isHealersKit({ name: "Healer's Kit" }) && isHealersKit({ name: 'Healer’s kit' }) && isHealersKit({ name: 'healers kit' }), 'the kit is found under any apostrophe or case');
    check(!isHealersKit({ name: "Healer's Pack" }) && !isHealersKit({ name: 'Herbalism Kit' }), 'a Healer\'s Pack or Herbalism Kit is not the kit');
    check(kitUsesLeft({ name: "Healer's Kit" }) === 10, 'a kit with no use record (a saved game\'s kit) counts as fresh: ten uses');
    const one = spendKitUse([{ name: "Healer's Kit", quantity: 1 }]);
    check(one.ok && one.usesLeft === 9 && one.inventory[0].uses === 9 && one.inventory[0].quantity === 1, 'one use spent: 10 → 9');
    const stack = spendKitUse([{ name: "Healer's Kit", quantity: 2, uses: 1 }]);
    check(stack.ok && stack.inventory[0].quantity === 1 && stack.inventory[0].uses === 10 && stack.totalLeft === 10, 'the opened kit\'s last use discards it; the next kit in the stack opens at ten');
    const last = spendKitUse([{ name: "Healer's Kit", quantity: 1, uses: 1 }]);
    check(last.ok && last.usesLeft === 0 && last.inventory.length === 1 && last.totalLeft === 0, 'the last kit\'s last use leaves it in the pack, spent (0 uses)');
    const spent = spendKitUse(last.inventory);
    check(!spent.ok && spent.reason === 'spent', 'a spent kit refuses: spent');
    check(!spendKitUse([{ name: 'Rope', quantity: 1 }]).ok && spendKitUse([]).reason === 'no_kit', 'no kit: no_kit');
    const two = spendKitUse([{ name: "Healer's Kit", quantity: 1, uses: 0 }, { name: "Healer's Kit", quantity: 1, uses: 4 }]);
    check(two.ok && two.inventory[0].uses === 0 && two.inventory[1].uses === 3, 'a spent kit is skipped for one with uses left');
    check(kitTotalUses({ name: "Healer's Kit", quantity: 3, uses: 7 }) === 27, 'uses across a stack: 2 × 10 + 7');
    check(absoluteHour({ dayOfYear: 1, year: 1493, hour: 0 }) - absoluteHour({ dayOfYear: 366, year: 1492, hour: 23 }) === 1, 'the absolute hour runs straight across a year boundary (1492 is a leap year: day 366 → day 1)');
  }

  // =========================================================================
  group('2. Direction 1 — the player uses the kit on a downed companion');
  {
    const camp = await campaign('D1');
    const hero = await pc('Hero One', { campaignId: camp, inventory: [{ name: "Healer's Kit", quantity: 1 }] });
    const lyra = await companion('TEST_HK Lyra One', hero, { hp: 0, s: 1, f: 2 });
    forceDie(3, 4);
    const r = await useHealersKit({ characterId: hero, user: 'player', target: 'TEST_HK Lyra One' });
    restoreDice();
    const st = await compState(lyra);
    check(r?.success === true && r.targetKind === 'companion' && r.userKind === 'player', 'the use succeeds — no check is asked or rolled');
    check(st.hp === 0 && st.s === 3 && st.f === 0, 'the companion is stable: still 0 HP, successes 3, failures 0');
    check((await kitOf(hero)).uses === 9 && r.totalUsesLeft === 9, 'exactly one use spent (10 → 9)');
    const now = absoluteHour(await getClock(camp));
    check(r.recovery?.hours === 3 && st.rec === now + 3, 'the engine rolls the companion\'s 1d4 (forced 3): recovery hour = now + 3');
    const t = healersKitResultText(r, 'Hero');
    check(/stabilized, no check/.test(t.line) && /9 uses left/.test(t.line) && /STABLE/.test(t.note), 'the engine line says stabilized, no check, uses left; the DM note says STABLE');
  }

  // =========================================================================
  group('3. Direction 2 — a companion uses the kit on the downed player (marker pipeline)');
  {
    const camp = await campaign('D2');
    const hero = await pc('Hero Two', { hp: 0, campaignId: camp, s: 1, f: 1, inventory: [{ name: "Healer's Kit", quantity: 1, uses: 6 }] });
    await companion('TEST_HK Bram Two', hero, { hp: 12 });
    const sid = await session(hero, camp);
    await dbRun('UPDATE dm_sessions SET session_config = ? WHERE id = ?', [JSON.stringify({ pendingDeathSave: { characterId: hero, postedAt: 1 } }), sid]);
    const pr = await processResponseMarkers('Bram kneels and works fast. [HEALERS_KIT: User="TEST_HK Bram Two" Target="Player"]', { characterId: hero, sessionId: sid, narrative: '' });
    const hr = (pr.handlerResults || []).find((h) => h.schemaKey === 'HEALERS_KIT');
    const st = await pcState(hero);
    check(hr?.ok && hr.result?.success === true && hr.result.targetKind === 'player', 'the HEALERS_KIT marker dispatches through the real pipeline and succeeds');
    check(st.hp === 0 && st.unc === 1 && st.s === 3 && st.f === 0 && st.dead === 0, 'the player is stable: 0 HP, unconscious, successes 3, failures 0');
    check((await kitOf(hero)).uses === 5, 'one use spent (6 → 5)');
    const cfg = await cfgOf(sid);
    check(!cfg.pendingDeathSave, 'the death save the player was asked for is withdrawn');
    check(cfg.pendingRecoveryDie?.characterId === hero && hr.result.recovery?.pendingPlayerDie === true, 'the player\'s 1d4 is asked, not rolled (the DM never rolls for the player)');
    check(st.rec === null, 'no recovery hour until the player reports the die');
    const prompts = await outOfCombatRollPrompts(sid);
    check(prompts.length === 1 && /Roll a d4/.test(prompts[0]), 'the player is told to roll a d4');

    const bad = await settleOutOfCombatRoll(sid, '7');
    check(bad?.error && (await cfgOf(sid)).pendingRecoveryDie, 'a 7 is not a d4: refused, the ask stays');
    const at = (await cfgOf(sid)).pendingRecoveryDie.stabilizedAt;
    const good = await settleOutOfCombatRoll(sid, '2');
    check(good?.kind === 'recovery_die' && /2 hours/.test(good.line) && /regains 1 HP after 2 hour/.test(good.fact), 'the player reports 2: line and DM fact state it');
    check((await pcState(hero)).rec === at + 2 && !(await cfgOf(sid)).pendingRecoveryDie, 'recovery hour = stabilized hour + 2; the ask is settled');

    await advanceClockForSession({ sessionId: sid, characterId: hero, hours: 1, reason: 'test' });
    check((await pcState(hero)).hp === 0, 'after 1 hour: still stable at 0 HP');
    const adv = await advanceClockForSession({ sessionId: sid, characterId: hero, hours: 1, reason: 'test' });
    const woke = await pcState(hero);
    check(woke.hp === 1 && woke.unc === 0 && woke.s === 0 && woke.f === 0 && woke.rec === null, 'after 2 hours: the player regains 1 HP and wakes; counters and recovery cleared');
    check(adv.stableRecoveries?.some((x) => x.kind === 'player'), 'the clock advance reports the recovery (it reaches the TIME PASSED block)');
  }

  // =========================================================================
  group('4. Direction 3 — a companion uses the kit on a downed companion; recovery and damage');
  {
    const camp = await campaign('D3');
    const hero = await pc('Hero Three', { campaignId: camp, inventory: [{ name: "Healer's Kit", quantity: 1, uses: 2 }] });
    await companion('TEST_HK Mira Three', hero, { hp: 10 });
    const tomas = await companion('TEST_HK Tomas Three', hero, { hp: 0, f: 1 });
    forceDie(1, 4);
    const r = await useHealersKit({ characterId: hero, user: 'TEST_HK Mira Three', target: 'TEST_HK Tomas Three' });
    restoreDice();
    const st = await compState(tomas);
    check(r?.success === true && st.s === 3 && st.f === 0 && st.hp === 0, 'companion on companion: stable, no check');
    check((await kitOf(hero)).uses === 1, 'one use spent (2 → 1)');
    const sid = await session(hero, camp);
    await advanceClockForSession({ sessionId: sid, characterId: hero, hours: 1, reason: 'test' });
    const up = await compState(tomas);
    check(up.hp === 1 && up.s === 0 && up.f === 0 && up.rec === null, 'after the 1d4 (forced 1) hour, the companion regains 1 HP');

    // Damage at 0 HP ends stabilization and its recovery clock.
    const ann = await companion('TEST_HK Ann Three', hero, { hp: 0 });
    const r2 = await useHealersKit({ characterId: hero, user: 'player', target: 'TEST_HK Ann Three' });
    check(r2?.success === true && (await kitOf(hero)).uses === 0, 'the last use stabilizes Ann; the kit reaches 0');
    const hit = await applyCompanionDamage(ann, 4);
    const as = await compState(ann);
    check(hit.deathSaveFailuresAdded === 1 && hit.stabilisationCleared === true && as.s === 0 && as.f === 1 && as.rec === null, 'a hit on the stable companion: one failure, stabilization and recovery cleared');
    const none = await processStableRecoveries(hero, { dayOfYear: 365, year: 1600, hour: 0 });
    check(!none.some((x) => x.id === ann), 'no recovery fires for a companion who lost stabilization');

    const spent = await useHealersKit({ characterId: hero, user: 'player', target: 'TEST_HK Ann Three' });
    check(spent?.success === false && spent.refusal === 'kit_spent' && /no uses left/.test(spent.reason), 'kit at 0 uses: refused, "no uses left — it is spent"');
    check((await compState(ann)).s === 0, 'the refused use stabilizes nobody');
  }

  // =========================================================================
  group('5. Refusals spend nothing');
  {
    const camp = await campaign('R');
    const hero = await pc('Hero Refuse', { campaignId: camp, inventory: [{ name: "Healer's Kit", quantity: 1, uses: 5 }] });
    const up = await companion('TEST_HK Up Refuse', hero, { hp: 9 });
    const down = await companion('TEST_HK Down Refuse', hero, { hp: 0, f: 1 });
    const stable = await companion('TEST_HK Stable Refuse', hero, { hp: 0, s: 3 });
    const dead = await companion('TEST_HK Dead Refuse', hero, { hp: 0, f: 3 });
    const kitBefore = JSON.stringify(await kitOf(hero));
    const unchanged = async () => JSON.stringify(await kitOf(hero)) === kitBefore;

    const r1 = await useHealersKit({ characterId: hero, user: 'player', target: 'TEST_HK Up Refuse' });
    check(r1.success === false && r1.refusal === 'target_not_down' && /not at 0 Hit Points/.test(r1.reason) && await unchanged(), 'target not at 0 HP: refused, nothing spent');
    const r2 = await useHealersKit({ characterId: hero, user: 'player', target: 'TEST_HK Dead Refuse' });
    check(r2.success === false && /dead/.test(r2.reason) && await unchanged(), 'target dead: refused, nothing spent');
    const r3 = await useHealersKit({ characterId: hero, user: 'player', target: 'TEST_HK Stable Refuse' });
    check(r3.success === false && r3.refusal === 'target_already_stable' && await unchanged(), 'target already stable: refused, nothing spent');

    const downUser = await companion('TEST_HK Fallen User', hero, { hp: 0 });
    const r4 = await useHealersKit({ characterId: hero, user: 'TEST_HK Fallen User', target: 'TEST_HK Down Refuse' });
    check(r4.success === false && r4.refusal === 'user_cannot_act' && /0 Hit Points/.test(r4.reason) && await unchanged(), 'user at 0 HP cannot act: refused, nothing spent');
    void downUser;
    const stunned = await companion('TEST_HK Stunned User', hero, { hp: 10 });
    await addCondition('companion', stunned, 'stunned');
    const r5 = await useHealersKit({ characterId: hero, user: 'TEST_HK Stunned User', target: 'TEST_HK Down Refuse' });
    check(r5.success === false && r5.refusal === 'user_cannot_act' && /incapacitated/.test(r5.reason) && await unchanged(), 'user incapacitated (stunned): refused, nothing spent');

    // Out of turn in a fight: the goblin's turn, the player tries to use the kit.
    const sid = await session(hero, camp);
    const [gob] = await createEncounterEnemies(sid, 1, [{ name: 'TEST_HK Goblin', maxHp: 7, armorClass: 13, attackBonus: 4, damageDice: '1d6', dexMod: 2 }]);
    await initializeTurnOrder(sid, 1, [
      { name: 'TEST_HK Goblin', type: 'enemy', key: `combat:${sid}:1:${gob.id}` },
      { name: 'Hero', type: 'player', key: `player:${hero}` },
    ]);
    const r6 = await useHealersKit({ characterId: hero, sessionId: sid, user: 'player', target: 'TEST_HK Down Refuse' });
    check(r6.success === false && r6.refusal === 'user_cannot_act' && /Out of turn/.test(r6.reason) && await unchanged(), 'user out of turn in a fight: refused, nothing spent');
    check((await compState(down)).s === 0 && (await compState(down)).f === 1, 'the refused target\'s death saves are untouched');

    const bare = await pc('Hero Bare', { campaignId: camp, inventory: [{ name: 'Rope', quantity: 1 }] });
    await companion('TEST_HK Down Bare', bare, { hp: 0 });
    const r7 = await useHealersKit({ characterId: bare, user: 'player', target: 'TEST_HK Down Bare' });
    check(r7.success === false && r7.refusal === 'no_kit' && /no Healer's Kit/.test(r7.reason), 'no kit in the party inventory: refused');
    const t = healersKitResultText(r7, 'Hero');
    check(/not used/.test(t.line) && /Nothing was spent/.test(t.note), 'a refusal reaches the player as a ⚙ line and the DM as "nothing was spent"');
    const r8 = await useHealersKit({ characterId: hero, user: 'player', target: 'Nobody Here' });
    check(r8.success === false && /unknown target/.test(r8.reason) && await unchanged(), 'unknown target: refused, nothing spent');
  }

  // =========================================================================
  group('6. Damage at 0 clears the player\'s stabilization and recovery');
  {
    const camp = await campaign('Dmg');
    const hero = await pc('Hero Dmg', { hp: 0, campaignId: camp, inventory: [{ name: "Healer's Kit", quantity: 1 }] });
    await companion('TEST_HK Medic Dmg', hero, { hp: 10 });
    const sid = await session(hero, camp);
    await useHealersKit({ characterId: hero, sessionId: sid, user: 'TEST_HK Medic Dmg', target: 'player' });
    await settleOutOfCombatRoll(sid, '4');
    check((await pcState(hero)).rec != null, 'stable with a recovery hour set');
    const hit = await applyHpChange(hero, -3, 'goblin arrow');
    const st = await pcState(hero);
    check(hit.stabilisationCleared === true && st.s === 0 && st.f === 1 && st.rec === null, 'a hit at 0: one failure, stabilization and recovery hour cleared');

    // Live probe run 5: stabilized, then hit before the d4 was reported.
    const hero2 = await pc('Hero Dmg Two', { hp: 0, campaignId: camp, inventory: [{ name: "Healer's Kit", quantity: 1 }] });
    await companion('TEST_HK Medic Dmg Two', hero2, { hp: 10 });
    const sid2 = await session(hero2, camp);
    await useHealersKit({ characterId: hero2, sessionId: sid2, user: 'TEST_HK Medic Dmg Two', target: 'player' });
    check((await outOfCombatRollPrompts(sid2)).length === 1, 'stable: the d4 is asked');
    await applyHpChange(hero2, -2, 'goblin blade');
    check((await outOfCombatRollPrompts(sid2)).length === 0, 'hit before the d4 is reported: the d4 ask is no longer shown');
    await setPendingDeathSave(sid2, hero2);
    const c2 = await cfgOf(sid2);
    check(c2.pendingDeathSave && !c2.pendingRecoveryDie, 'death saves resume: the recovery ask is withdrawn');
  }

  // =========================================================================
  group('7. The DM is told the true rule');
  {
    const src = fs.readFileSync(new URL('../server/services/dmPromptBuilder.js', import.meta.url), 'utf8');
    check(/A Healer's Kit stabilizes a creature at 0 HP with NO Medicine check and spends one of its ten uses/.test(src), 'the always-on 0 HP rules carry the Healer\'s Kit line');
    const ex = '[HEALERS_KIT: User="Lyra" Target="Player"]';
    check(src.includes(ex) && (validateDmMarkers(ex).failures || []).length === 0, 'the taught example is valid marker syntax');
    check(!/Medicine[^\n]{0,60}(always|required)/i.test(src), 'no prompt text says a Medicine check is always required');
    const dir = npcTurnDirective({ name: 'Lyra', type: 'companion' }, { round: 2 }, 'Hero');
    check(dir.includes('[HEALERS_KIT: User="Lyra" Target="<ally name>"]'), 'a companion\'s combat turn directive offers the kit');
    const enemyDir = npcTurnDirective({ name: 'Goblin', type: 'enemy' }, { round: 2 }, 'Hero');
    check(!enemyDir.includes('HEALERS_KIT'), 'an enemy\'s directive does not');

    // The dying-ally cue (live probe fix): names who is dying and the kit's uses.
    const camp = await campaign('Cue');
    const hero = await pc('Hero Cue', { hp: 0, campaignId: camp, inventory: [{ name: "Healer's Kit", quantity: 1, uses: 4 }] });
    await companion('TEST_HK Cue Medic', hero, { hp: 10 });
    const cue = await dyingPartyCue(hero);
    check(cue?.dying?.length === 1 && cue.dying[0] === 'TEST_HK Hero Cue' && cue.kitUses === 4, 'the cue names the dying player and the kit\'s 4 uses');
    const cued = npcTurnDirective({ name: 'TEST_HK Cue Medic', type: 'companion' }, { round: 1 }, 'Hero', cue);
    check(/at 0 HP and DYING/.test(cued) && cued.includes('[HEALERS_KIT: User="TEST_HK Cue Medic" Target="TEST_HK Hero Cue"]') && /4 uses left/.test(cued), 'a companion\'s turn directive carries the cue: who is dying, the kit, the marker');
    check(!/DYING/.test(npcTurnDirective({ name: 'Goblin', type: 'enemy' }, { round: 1 }, 'Hero', cue)), 'an enemy\'s directive never carries the cue');
    await dbRun('UPDATE characters SET death_save_successes = 3 WHERE id = ?', [hero]);
    check(await dyingPartyCue(hero) === null, 'a stable player is not dying: no cue');
  }

  // =========================================================================
  group('8. The Medicine-check route is unchanged; a kit-stable companion makes no death saves');
  {
    const app = express();
    app.use(express.json());
    app.use('/api/companion', companionRouter);
    const server = await new Promise((res) => { const s = app.listen(0, () => res(s)); });
    const base = `http://127.0.0.1:${server.address().port}/api/companion`;
    try {
      const hero = await pc('Hero Med');
      const c1 = await companion('TEST_HK Med One', hero, { hp: 0, s: 1, f: 2 });
      const r = await fetch(`${base}/${c1}/stabilize`, { method: 'POST' });
      const body = await r.json();
      const st = await compState(c1);
      check(r.status === 200 && body.stabilized === true && body.successes === 0 && body.failures === 0 && st.s === 0 && st.f === 0, 'Medicine stabilize (DC 10 made by the caller): counters reset exactly as before');
      const c2 = await companion('TEST_HK Med Two', hero, { hp: 4 });
      const r2 = await fetch(`${base}/${c2}/stabilize`, { method: 'POST' });
      check(r2.status === 400, 'Medicine stabilize on a companion above 0 HP still refuses');
      const c3 = await companion('TEST_HK Kit Stable', hero, { hp: 0, s: 3 });
      const r3 = await fetch(`${base}/${c3}/death-save`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ roll: 5 }) });
      check(r3.status === 400 && (await compState(c3)).s === 3, 'a death save for a kit-stable companion is refused; the stable state holds');
      const c4 = await companion('TEST_HK Dying', hero, { hp: 0, s: 1 });
      const r4 = await fetch(`${base}/${c4}/death-save`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ outcome: 'success' }) });
      check(r4.status === 200 && (await r4.json()).successes === 2, 'a dying companion\'s death save still records as before');
    } finally {
      await new Promise((res) => server.close(res));
    }
  }
} catch (e) {
  failed++;
  console.log(`  ✗ unexpected error: ${e.stack || e.message}`);
} finally {
  restoreDice();
  const del = async (sql, ids) => { if (ids.length) await dbRun(sql.replace('?', ids.map(() => '?').join(',')), ids).catch(() => {}); };
  await del('DELETE FROM combat_turn_state WHERE session_id IN (?)', made.sessions);
  await del('DELETE FROM combat_enemies WHERE session_id IN (?)', made.sessions);
  await del('DELETE FROM dm_sessions WHERE id IN (?)', made.sessions);
  await del('DELETE FROM companions WHERE id IN (?)', made.comps);
  await del('DELETE FROM npcs WHERE id IN (?)', made.npcs);
  await del('DELETE FROM characters WHERE id IN (?)', made.chars);
  await del('DELETE FROM world_clock WHERE campaign_id IN (?)', made.campaigns);
  await del('DELETE FROM campaigns WHERE id IN (?)', made.campaigns);
}

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
process.exit(failed ? 1 : 0);
