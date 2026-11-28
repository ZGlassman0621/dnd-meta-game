/**
 * Stabilize recovery alignment (brief docs/pm/stabilize-recovery-alignment;
 * 2024 PHB, book rule, no flag): every stabilization starts the 1d4-hours
 * recovery, and a stable companion is stored one way.
 *
 * On the real services, the real companion router, and a real (throwaway) DB:
 *  - Medicine-check route: the companion holds successes 3 / failures 0 at
 *    0 HP and the engine rolls its d4 (1–4 hours out); it regains 1 HP when
 *    session time passes the hour;
 *  - three death-save successes, companion (route): same state, engine d4;
 *  - three death-save successes, player (rollDeathSave): the player's d4 is
 *    asked (pendingRecoveryDie), the player's number sets the hour, and the
 *    recovery fires when the clock passes it; with no session nothing is asked;
 *  - damage at 0 HP clears the stable state and the recovery hour on every
 *    route, and no HP comes back when the hour passes;
 *  - the death-save route refuses for any stable companion.
 * Run: npm test stabilize-recovery
 */
import express from 'express';
import { initDatabase, dbRun, dbGet, dbAll } from '../server/database.js';
import { absoluteHour } from '../server/services/healersKitService.js';
import { applyHpChange, applyCompanionDamage, rollDeathSave } from '../server/services/characterHpService.js';
import { advanceClockForSession } from '../server/services/restTimeService.js';
import { settleOutOfCombatRoll, outOfCombatRollPrompts } from '../server/services/playerRollService.js';
import { formatCompanionDeathSavesLine } from '../server/services/dmPromptBuilder.js';
import { getClock } from '../server/services/scheduleService.js';
import companionRouter from '../server/routes/companion.js';

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
  const id = await insertRow('campaigns', { name: `TEST_SRA ${name}`, status: 'active' });
  made.campaigns.push(id);
  return id;
}
async function pc(name, { hp = 20, campaignId = null, s = 0, f = 0 } = {}) {
  const id = await insertRow('characters', {
    name: `TEST_SRA ${name}`, class: 'Fighter', race: 'Human', level: 3, current_hp: hp, max_hp: 20,
    current_location: 'TEST_SRA Road', experience_to_next_level: 900, campaign_id: campaignId,
    is_unconscious: hp === 0 ? 1 : 0, is_dead: 0, death_save_successes: s, death_save_failures: f,
    inventory: '[]',
  });
  made.chars.push(id);
  return id;
}
async function companion(name, ownerId, { hp = 15, s = 0, f = 0 } = {}) {
  const npcId = await insertRow('npcs', { name, race: 'Human' });
  made.npcs.push(npcId);
  const id = await insertRow('companions', {
    npc_id: npcId, recruited_by_character_id: ownerId, status: 'active', companion_class: 'Ranger', companion_level: 3,
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
const pcState = (id) => dbGet('SELECT current_hp AS hp, is_unconscious AS unc, is_dead AS dead, death_save_successes AS s, death_save_failures AS f, stable_recover_at AS rec FROM characters WHERE id = ?', [id]);
const compState = (id) => dbGet('SELECT companion_current_hp AS hp, death_save_successes AS s, death_save_failures AS f, stable_recover_at AS rec FROM companions WHERE id = ?', [id]);
const compRow = (id) => dbGet('SELECT companion_current_hp, death_save_successes, death_save_failures FROM companions WHERE id = ?', [id]);
const cfgOf = async (sid) => JSON.parse((await dbGet('SELECT session_config FROM dm_sessions WHERE id = ?', [sid])).session_config || '{}');
const nowOf = async (camp) => absoluteHour(await getClock(camp));

const realRandom = Math.random;
const forceDie = (face, sides) => { Math.random = () => (face - 1) / sides + 1e-9; };
const restoreDice = () => { Math.random = realRandom; };

const app = express();
app.use(express.json());
app.use('/api/companion', companionRouter);
const server = await new Promise((res) => { const s = app.listen(0, () => res(s)); });
const base = `http://127.0.0.1:${server.address().port}/api/companion`;
const post = async (path, body) => {
  const r = await fetch(`${base}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, body: await r.json() };
};

try {
  // =========================================================================
  group('1. Medicine-check route: stable state + the engine\'s 1d4, then the recovery');
  {
    const camp = await campaign('Med');
    const hero = await pc('Hero Med', { campaignId: camp });
    const sid = await session(hero, camp);
    const lyra = await companion('TEST_SRA Lyra Med', hero, { hp: 0, s: 1, f: 2 });
    const now = await nowOf(camp);
    forceDie(2, 4);
    const r = await post(`/${lyra}/stabilize`);
    restoreDice();
    const st = await compState(lyra);
    check(r.status === 200 && r.body.stabilized === true && r.body.successes === 3 && r.body.failures === 0, 'the route answers stabilized, successes 3, failures 0');
    check(st.hp === 0 && st.s === 3 && st.f === 0, 'stored: still 0 HP, successes 3, failures 0 — the kit\'s stable state');
    check(r.body.recovery?.hours === 2 && st.rec === now + 2, 'the engine rolls the companion\'s d4 (forced 2): recovery hour = now + 2');
    check(/Stable at 0 HP/.test(formatCompanionDeathSavesLine(await compRow(lyra))), 'the DM prompt shows the companion as stable, not dying');

    const ds = await post(`/${lyra}/death-save`, { roll: 15 });
    check(ds.status === 400 && (await compState(lyra)).s === 3, 'a death save for a Medicine-stable companion is refused; the stable state holds');

    await advanceClockForSession({ sessionId: sid, characterId: hero, hours: 1, reason: 'test' });
    check((await compState(lyra)).hp === 0, 'after 1 hour: still stable at 0 HP');
    const adv = await advanceClockForSession({ sessionId: sid, characterId: hero, hours: 1, reason: 'test' });
    const woke = await compState(lyra);
    check(woke.hp === 1 && woke.s === 0 && woke.f === 0 && woke.rec === null, 'after 2 hours: the companion regains 1 HP; counters and recovery cleared');
    check((adv.stableRecoveries || []).some((x) => x.kind === 'companion' && x.id === lyra), 'the clock advance reports the recovery');

    // The unforced die lands 1–4 hours out.
    const bram = await companion('TEST_SRA Bram Med', hero, { hp: 0 });
    const now2 = await nowOf(camp);
    const r2 = await post(`/${bram}/stabilize`);
    const st2 = await compState(bram);
    check(Number.isInteger(r2.body.recovery?.hours) && r2.body.recovery.hours >= 1 && r2.body.recovery.hours <= 4 && st2.rec === now2 + r2.body.recovery.hours, `an unforced d4 (${r2.body.recovery?.hours}) sets the hour 1–4 hours out`);
  }

  // =========================================================================
  group('2. Three death-save successes, companion: stable state + the engine\'s 1d4');
  {
    const camp = await campaign('Comp3');
    const hero = await pc('Hero Comp3', { campaignId: camp });
    const sid = await session(hero, camp);
    const ann = await companion('TEST_SRA Ann Three', hero, { hp: 0, s: 2, f: 1 });
    const now = await nowOf(camp);
    forceDie(4, 4);
    const r = await post(`/${ann}/death-save`, { outcome: 'success' });
    restoreDice();
    const st = await compState(ann);
    check(r.status === 200 && r.body.stabilized === true && r.body.successes === 3 && r.body.failures === 0, 'the third success: stabilized, successes 3, failures 0');
    check(st.hp === 0 && st.s === 3 && st.f === 0, 'stored: 0 HP, successes 3, failures 0');
    check(r.body.recovery?.hours === 4 && st.rec === now + 4, 'the engine rolls the d4 (forced 4): recovery hour = now + 4');
    const again = await post(`/${ann}/death-save`, { outcome: 'success' });
    check(again.status === 400 && (await compState(ann)).s === 3, 'a further death save is refused; the stable state holds');
    const two = await companion('TEST_SRA Ann Two', hero, { hp: 0, s: 1 });
    const r2 = await post(`/${two}/death-save`, { outcome: 'success' });
    check(r2.status === 200 && r2.body.successes === 2 && !r2.body.stabilized && !r2.body.recovery && (await compState(two)).rec === null, 'a second success is not stable: no recovery hour');
    await advanceClockForSession({ sessionId: sid, characterId: hero, hours: 4, reason: 'test' });
    check((await compState(ann)).hp === 1, 'after 4 hours: the companion regains 1 HP');
  }

  // =========================================================================
  group('3. Three death-save successes, player: the player\'s d4 is asked');
  {
    const camp = await campaign('PC3');
    const hero = await pc('Hero PC3', { hp: 0, campaignId: camp, s: 2, f: 1 });
    const sid = await session(hero, camp);
    const now = await nowOf(camp);
    const r = await rollDeathSave(hero, 15, { sessionId: sid });
    const st = await pcState(hero);
    check(r?.stabilised === true && r.successes === 3 && st.s === 3 && st.hp === 0 && st.unc === 1, 'the third success: stable at 0 HP, unconscious, successes 3');
    const cfg = await cfgOf(sid);
    check(cfg.pendingRecoveryDie?.characterId === hero && cfg.pendingRecoveryDie.stabilizedAt === now && r.recovery?.pendingPlayerDie === true, 'the player\'s d4 is asked, not rolled (pendingRecoveryDie, stamped with the stabilized hour)');
    check(st.rec === null, 'no recovery hour until the player reports the die');
    const prompts = await outOfCombatRollPrompts(sid);
    check(prompts.length === 1 && /Roll a d4/.test(prompts[0]), 'the player is told to roll a d4');
    const bad = await settleOutOfCombatRoll(sid, '5');
    check(bad?.error && (await cfgOf(sid)).pendingRecoveryDie, 'a 5 is not a d4: refused, the ask stays');
    const good = await settleOutOfCombatRoll(sid, '3');
    check(good?.kind === 'recovery_die' && (await pcState(hero)).rec === now + 3 && !(await cfgOf(sid)).pendingRecoveryDie, 'the player reports 3: recovery hour = stabilized hour + 3; the ask is settled');
    await advanceClockForSession({ sessionId: sid, characterId: hero, hours: 2, reason: 'test' });
    check((await pcState(hero)).hp === 0, 'after 2 hours: still stable at 0 HP');
    await advanceClockForSession({ sessionId: sid, characterId: hero, hours: 1, reason: 'test' });
    const woke = await pcState(hero);
    check(woke.hp === 1 && woke.unc === 0 && woke.s === 0 && woke.f === 0 && woke.rec === null, 'after 3 hours: the player regains 1 HP and wakes; counters and recovery cleared');

    const solo = await pc('Hero Solo', { hp: 0, s: 2 });
    const rs = await rollDeathSave(solo, 12);
    check(rs?.stabilised === true && rs.recovery?.pendingPlayerDie === false && (await pcState(solo)).rec === null, 'with no session: stable, nothing asked, no hour set');
    const mid = await pc('Hero Mid', { hp: 0, campaignId: camp, s: 0 });
    const sid2 = await session(mid, camp);
    const rm = await rollDeathSave(mid, 12, { sessionId: sid2 });
    check(rm?.successes === 1 && !rm.stabilised && !rm.recovery && !(await cfgOf(sid2)).pendingRecoveryDie, 'a first success is not stable: no ask');
  }

  // =========================================================================
  group('4. Damage at 0 HP clears the stable state and the recovery hour, every route');
  {
    const camp = await campaign('Dmg');
    const hero = await pc('Hero Dmg', { campaignId: camp });
    const sid = await session(hero, camp);
    const med = await companion('TEST_SRA Med Hit', hero, { hp: 0 });
    forceDie(1, 4);
    await post(`/${med}/stabilize`);
    restoreDice();
    const three = await companion('TEST_SRA Three Hit', hero, { hp: 0, s: 2 });
    forceDie(1, 4);
    await post(`/${three}/death-save`, { outcome: 'success' });
    restoreDice();
    check((await compState(med)).rec != null && (await compState(three)).rec != null, 'both companions are stable with a recovery hour set');
    const h1 = await applyCompanionDamage(med, 3);
    const h2 = await applyCompanionDamage(three, 3);
    const a = await compState(med); const b = await compState(three);
    check(h1.stabilisationCleared && a.s === 0 && a.f === 1 && a.rec === null, 'Medicine-stable companion hit at 0 HP: stable state cleared, one failure, recovery hour cleared');
    check(h2.stabilisationCleared && b.s === 0 && b.f === 1 && b.rec === null, 'three-successes companion hit at 0 HP: stable state cleared, one failure, recovery hour cleared');
    const ds = await post(`/${med}/death-save`, { outcome: 'failure' });
    check(ds.status === 200 && ds.body.failures === 2, 'death saves resume for the hit companion');

    const pcHit = await pc('Hero Hit', { hp: 0, campaignId: camp, s: 2 });
    const sidP = await session(pcHit, camp);
    await rollDeathSave(pcHit, 14, { sessionId: sidP });
    await settleOutOfCombatRoll(sidP, '1');
    check((await pcState(pcHit)).rec != null, 'the player is stable with a recovery hour set');
    await applyHpChange(pcHit, -2, 'arrow');
    const p = await pcState(pcHit);
    check(p.s === 0 && p.f === 1 && p.rec === null && p.hp === 0, 'player hit at 0 HP: stable state cleared, one failure, recovery hour cleared');

    await advanceClockForSession({ sessionId: sid, characterId: hero, hours: 5, reason: 'test' });
    await advanceClockForSession({ sessionId: sidP, characterId: pcHit, hours: 5, reason: 'test' });
    check((await compState(med)).hp === 0 && (await compState(three)).hp === 0 && (await pcState(pcHit)).hp === 0, 'when the old hour passes, nobody regains HP');
  }
} catch (e) {
  failed++;
  console.log(`  ✗ unexpected error: ${e.stack || e.message}`);
} finally {
  restoreDice();
  await new Promise((res) => server.close(res));
  const del = async (sql, ids) => { if (ids.length) await dbRun(sql.replace('?', ids.map(() => '?').join(',')), ids).catch(() => {}); };
  await del('DELETE FROM dm_sessions WHERE id IN (?)', made.sessions);
  await del('DELETE FROM companions WHERE id IN (?)', made.comps);
  await del('DELETE FROM npcs WHERE id IN (?)', made.npcs);
  await del('DELETE FROM characters WHERE id IN (?)', made.chars);
  await del('DELETE FROM world_clock WHERE campaign_id IN (?)', made.campaigns);
  await del('DELETE FROM campaigns WHERE id IN (?)', made.campaigns);
}

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
process.exit(failed ? 1 : 0);
