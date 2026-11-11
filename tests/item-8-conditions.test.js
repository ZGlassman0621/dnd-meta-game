// tests/item-8-conditions.test.js — combat item 8: charmed / deafened /
// grappled / incapacitated carry real engine effects. Real services,
// real DB. Assertions never depend on a roll except where the test
// itself supplies the reported outcome (applyPendingEscape is called
// directly with a fabricated rollOutcome, the same shape the route
// passes it).
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');

const dbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dnd-item8-'));
process.chdir(dbDir);
delete process.env.TURSO_DATABASE_URL;
delete process.env.TURSO_AUTH_TOKEN;

const svc = (rel) => pathToFileURL(path.join(REPO, rel)).href;
const { initDatabase, dbAll, dbGet, dbRun } = await import(svc('server/database.js'));
await initDatabase();
const tl = await import(svc('server/services/turnLedgerService.js'));
const ct = await import(svc('server/services/combatTurnService.js'));
const es = await import(svc('server/services/enemyCombatService.js'));
const wid = await import(svc('server/services/worldIdService.js'));
const cs = await import(svc('server/services/conditionService.js'));
const rr = await import(svc('server/services/rollRequestService.js'));
const pipeline = await import(svc('server/services/markerPipeline.js'));
await import(svc('server/services/combatMarkerService.js')); // registers combat markers
await import(svc('server/services/characterHpService.js')); // registers HP_CHANGE
await import(svc('server/services/rollRequestService.js')); // registers ROLL_REQUEST
await import(svc('server/services/spellCastService.js')); // registers SPELL_CAST
await import(svc('server/services/partyAttackService.js')); // registers ATTACK
await import(svc('server/services/classFeatureService.js')); // registers RAGE etc.
await import(svc('server/services/conditionService.js')); // registers CONDITION_ADD/ESCAPE
await import(svc('server/services/enemySpellService.js')); // registers ENEMY_CAST

let passed = 0, failed = 0;
function group(name) { console.log('== ' + name + ' =='); }
function ok(cond, msg) {
  try { assert(cond, msg); passed++; }
  catch (e) { failed++; console.error('FAIL:', msg, '|', e.message); }
}

async function insertRow(table, overrides = {}) {
  const info = await dbAll(`PRAGMA table_info(${table})`);
  const cols = [];
  const vals = [];
  for (const c of info) {
    if (c.name === 'id') continue;
    if (Object.prototype.hasOwnProperty.call(overrides, c.name)) {
      cols.push(c.name); vals.push(overrides[c.name]); continue;
    }
    if (c.notnull && c.dflt_value == null) {
      const t = (c.type || '').toUpperCase();
      cols.push(c.name); vals.push(t.includes('INT') ? 1 : `TEST_${c.name}`);
    }
  }
  const r = await dbRun(
    `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`, vals
  );
  return Number(r.lastInsertRowid);
}

async function addPc(over = {}) {
  const id = await insertRow('characters', {
    name: 'Tester', class: 'Fighter', level: 5,
    current_hp: 40, max_hp: 40, armor_class: 16,
    ability_scores: JSON.stringify({ str: 16, dex: 16, con: 14, int: 10, wis: 12, cha: 8 }),
    skills: JSON.stringify([]),
    spell_slots: JSON.stringify({ 1: 4, 2: 3, 3: 2 }),
    spell_slots_used: JSON.stringify({}),
    ...over
  });
  return dbGet('SELECT * FROM characters WHERE id = ?', [id]);
}

async function addCompanion(name, pcId, over = {}) {
  const npcId = await insertRow('npcs', { name });
  await wid.assignWorldId('npcs', npcId);
  const id = await insertRow('companions', {
    npc_id: npcId, recruited_by_character_id: pcId, status: 'active',
    companion_spell_slots_used: JSON.stringify({}),
    progression_type: 'class_based', companion_level: 3,
    companion_ability_scores: JSON.stringify({ str: 16, dex: 16, con: 14, int: 10, wis: 12, cha: 8 }),
    companion_current_hp: 24, companion_max_hp: 24, armor_class: 14,
    ...over
  });
  const row = await dbGet('SELECT * FROM companions WHERE id = ?', [id]);
  return { ...row, display_name: name };
}

async function addSession(pcId) {
  return insertRow('dm_sessions', { character_id: pcId, status: 'active' });
}

async function markerResult(text, characterId, sessionId, key) {
  const res = await pipeline.processResponseMarkers(text, { characterId, sessionId });
  const h = res.handlerResults.filter((hr) => hr.schemaKey === key);
  return h.length ? h[0].result : null;
}

async function cfg(sessionId) {
  const row = await dbGet('SELECT session_config FROM dm_sessions WHERE id = ?', [sessionId]);
  try { return JSON.parse(row?.session_config || '{}'); } catch { return {}; }
}

async function pcConds(pcId) { return cs.getConditions('player', pcId); }
async function compConds(compId) { return cs.getConditions('companion', compId); }
async function enemyConds(rowId) { return cs.getConditions('enemy', rowId); }

const gob = (name) => ({ name, maxHp: 60, armorClass: 5, attackBonus: 3, damageDice: '1d6', dexMod: 1,
  statsJson: JSON.stringify({ abilities: { str: 8, dex: 14, con: 10, int: 10, wis: 8, cha: 8 }, cr: '1/4', skills: {} }) });

async function order(sessionId, entries) {
  await ct.initializeTurnOrder(sessionId, 1, entries);
}
async function pcKey(pc) { return tl.ledgerKeyForPlayer(pc.id); }
async function compKey(comp) { return tl.ledgerKeyForCompanion(comp); }
function enemyKey(sessionId, row) { return `combat:${sessionId}:1:${row.id}`; }

group('1. CONDITION_ADD source requirements: charmed needs Charmer, grappled needs Grappler');
{
  const pc = await addPc();
  const sessionId = await addSession(pc.id);
  const [g] = await es.createEncounterEnemies(sessionId, 1, [gob('GobA')]);
  const noCharmer = await markerResult('[CONDITION_ADD: Target="Tester" Condition="charmed"]', pc.id, sessionId, 'CONDITION_ADD');
  ok(noCharmer && noCharmer.success === false && /Charmer/.test(noCharmer.remedy || ''), 'charmed without Charmer refused with remedy');
  ok(!(await pcConds(pc.id)).includes('charmed'), 'refused charmed stores nothing');
  const withCharmer = await markerResult('[CONDITION_ADD: Target="Tester" Condition="charmed" Charmer="GobA"]', pc.id, sessionId, 'CONDITION_ADD');
  ok(withCharmer && withCharmer.success === true, 'charmed with Charmer applies');
  ok((await pcConds(pc.id)).includes('charmed'), 'charmed stored on PC');
  const meta = await cs.getConditionMeta('player', pc.id, 'charmed');
  ok(meta && meta.charmer && meta.charmer.kind === 'enemy' && meta.charmer.id === g.id, 'charmer metadata records the enemy row');
  const noGrappler = await markerResult('[CONDITION_ADD: Target="Tester" Condition="grappled"]', pc.id, sessionId, 'CONDITION_ADD');
  ok(noGrappler && noGrappler.success === false && /Grappler/.test(noGrappler.remedy || ''), 'grappled without Grappler refused with remedy');
  const withGrappler = await markerResult('[CONDITION_ADD: Target="Tester" Condition="grappled" Grappler="GobA"]', pc.id, sessionId, 'CONDITION_ADD');
  ok(withGrappler && withGrappler.success === true, 'grappled with Grappler applies');
  const gmeta = await cs.getConditionMeta('player', pc.id, 'grappled');
  ok(gmeta && gmeta.grappler && gmeta.grappler.kind === 'enemy' && gmeta.grappler.id === g.id, 'grappler metadata records the enemy row');
  const unknown = await markerResult('[CONDITION_ADD: Target="Tester" Condition="charmed" Charmer="Nobody"]', pc.id, sessionId, 'CONDITION_ADD');
  ok(unknown && unknown.success === false && /unknown charmer/.test(unknown.reason || ''), 'unresolvable charmer refused');
  const removed = await markerResult('[CONDITION_REMOVE: Target="Tester" Condition="charmed"]', pc.id, sessionId, 'CONDITION_REMOVE');
  ok(removed && removed.success === true, 'charmed removal applies');
  ok((await cs.getConditionMeta('player', pc.id, 'charmed')) == null, 'removal clears metadata');
}

group('2. Charmed: cannot attack the charmer, can attack anyone else');
{
  const pc = await addPc();
  const sessionId = await addSession(pc.id);
  const lyra = await addCompanion('Lyra', pc.id, {});
  const [gA, gB] = await es.createEncounterEnemies(sessionId, 1, [gob('GobA'), gob('GobB')]);
  await order(sessionId, [
    { name: 'Tester', type: 'player', key: await pcKey(pc) },
    { name: 'Lyra', type: 'companion', key: await compKey(lyra) },
    { name: 'GobA', type: 'enemy', key: enemyKey(sessionId, gA) },
    { name: 'GobB', type: 'enemy', key: enemyKey(sessionId, gB) },
  ]);
  await markerResult('[CONDITION_ADD: Target="Tester" Condition="charmed" Charmer="GobA"]', pc.id, sessionId, 'CONDITION_ADD');
  const blocked = await markerResult('[ATTACK: Attacker="Player" Target="GobA"]', pc.id, sessionId, 'ATTACK');
  ok(blocked && blocked.success === false && /charmed/.test(blocked.reason || ''), 'PC attack vs charmer refused');
  const allowed = await markerResult('[ATTACK: Attacker="Player" Target="GobB"]', pc.id, sessionId, 'ATTACK');
  ok(allowed && allowed.success !== false, 'PC attack vs non-charmer proceeds');
  await markerResult('[CONDITION_ADD: Target="Lyra" Condition="charmed" Charmer="GobA"]', pc.id, sessionId, 'CONDITION_ADD');
  const compBlocked = await markerResult('[ATTACK: Attacker="Lyra" Target="GobA"]', pc.id, sessionId, 'ATTACK');
  ok(compBlocked && compBlocked.success === false && /charmed/.test(compBlocked.reason || ''), 'companion attack vs charmer refused');
}

group('3. Charmed spells: harmful vs charmer refused (slot kept), healing allowed');
{
  const pc = await addPc();
  const sessionId = await addSession(pc.id);
  const [gA] = await es.createEncounterEnemies(sessionId, 1, [gob('GobA')]);
  await markerResult('[CONDITION_ADD: Target="Tester" Condition="charmed" Charmer="GobA"]', pc.id, sessionId, 'CONDITION_ADD');
  const slotsBefore = JSON.parse((await dbGet('SELECT spell_slots_used FROM characters WHERE id = ?', [pc.id])).spell_slots_used || '{}');
  const blocked = await markerResult('[SPELL_CAST: Spell="Magic Missile" Level=1 Target="GobA"]', pc.id, sessionId, 'SPELL_CAST');
  ok(blocked && blocked.success === false && /charmed/.test(blocked.reason || ''), 'harmful spell vs charmer refused');
  const slotsAfter = JSON.parse((await dbGet('SELECT spell_slots_used FROM characters WHERE id = ?', [pc.id])).spell_slots_used || '{}');
  ok(JSON.stringify(slotsBefore) === JSON.stringify(slotsAfter), 'refused spell spends no slot');
  const healed = await markerResult('[SPELL_CAST: Spell="Healing Word" Level=1 Target="Tester"]', pc.id, sessionId, 'SPELL_CAST');
  ok(healed && healed.success === true, 'healing spell while charmed proceeds');
}

group('4. Incapacitated sweep: no actions, movement untouched, enemies gated');
{
  const pc = await addPc();
  const sessionId = await addSession(pc.id);
  const [gA] = await es.createEncounterEnemies(sessionId, 1, [gob('GobA')]);
  const lyra = await addCompanion('Lyra', pc.id, {});
  await order(sessionId, [
    { name: 'Tester', type: 'player', key: await pcKey(pc) },
    { name: 'Lyra', type: 'companion', key: await compKey(lyra) },
    { name: 'GobA', type: 'enemy', key: enemyKey(sessionId, gA) },
  ]);
  await markerResult('[CONDITION_ADD: Target="Tester" Condition="incapacitated"]', pc.id, sessionId, 'CONDITION_ADD');
  const refusedMarkers = [
    ['[ATTACK: Attacker="Player" Target="GobA"]', 'ATTACK'],
    ['[SPELL_CAST: Spell="Magic Missile" Level=1 Target="GobA"]', 'SPELL_CAST'],
    ['[DODGE: Target="Tester"]', 'DODGE'],
    ['[DISENGAGE: Target="Tester"]', 'DISENGAGE'],
    ['[HELP: Helper="Tester" Ally="Lyra" Target="GobA"]', 'HELP'],
    ['[HIDE: Target="Tester"]', 'HIDE'],
    ['[READY: Target="Tester" Action="Attack" Trigger="an enemy moves"]', 'READY'],
    ['[DASH: Target="Tester"]', 'DASH'],
    ['[SEARCH: Searcher="Tester" Target="GobA"]', 'SEARCH'],
    ['[RAGE: Target="Tester"]', 'RAGE'],
    ['[SECOND_WIND: Target="Tester"]', 'SECOND_WIND'],
  ];
  for (const [text, key] of refusedMarkers) {
    const r = await markerResult(text, pc.id, sessionId, key);
    ok(r && r.success === false && /incapacitated/.test(r.reason || ''), `${key} refused while incapacitated`);
  }
  // Enemy side: incapacitated GobA cannot attack or cast.
  await markerResult('[CONDITION_ADD: Target="GobA" Condition="incapacitated"]', pc.id, sessionId, 'CONDITION_ADD');
  const eAtk = await markerResult('[ENEMY_ATTACK: Enemy="GobA" Target="Player"]', pc.id, sessionId, 'ENEMY_ATTACK');
  ok(eAtk && eAtk.success === false && /incapacitated/.test(eAtk.reason || ''), 'enemy attack refused while incapacitated');
  const eCast = await markerResult('[ENEMY_CAST: Enemy="GobA" Spell="Fireball" Level=3 Target="Player"]', pc.id, sessionId, 'ENEMY_CAST');
  ok(eCast && eCast.success === false && /incapacitated/.test(eCast.reason || ''), 'enemy cast refused while incapacitated');
  const { checkEnemyAction } = await import(svc('server/services/enemyEconomyService.js'));
  const econ = await checkEnemyAction(sessionId, 1, enemyKey(sessionId, gA), 'GobA', gA.id, {});
  ok(econ && econ.error && /incapacitated/.test(econ.error), 'enemy economy refused while incapacitated');
  // Movement is not an action: the speed check does not see incapacitated.
  ok(!(await cs.hasIncapacitatingCondition('player', pc.id)) === false, 'PC still reads incapacitated (control)');
}

group('5. Concentration breaks the moment an incapacitating condition lands');
{
  const pc = await addPc();
  const sessionId = await addSession(pc.id);
  const lyra = await addCompanion('Lyra', pc.id, {});
  const [gA] = await es.createEncounterEnemies(sessionId, 1, [gob('GobA')]);
  await dbRun('UPDATE characters SET concentrating_on = ? WHERE id = ?', ['Bless', pc.id]);
  await dbRun('UPDATE companions SET concentrating_on = ? WHERE id = ?', ['Bless', lyra.id]);
  await dbRun('UPDATE combat_enemies SET concentrating_on = ? WHERE id = ?', ['Fireball', gA.id]);
  const pcBreak = await markerResult('[CONDITION_ADD: Target="Tester" Condition="incapacitated"]', pc.id, sessionId, 'CONDITION_ADD');
  ok(pcBreak && pcBreak.concentrationBroken === true, 'PC incapacitated breaks concentration');
  ok((await dbGet('SELECT concentrating_on FROM characters WHERE id = ?', [pc.id])).concentrating_on == null, 'PC concentrating_on cleared');
  const compBreak = await markerResult('[CONDITION_ADD: Target="Lyra" Condition="paralyzed"]', pc.id, sessionId, 'CONDITION_ADD');
  ok(compBreak && compBreak.concentrationBroken === true, 'companion paralyzed breaks concentration');
  ok((await dbGet('SELECT concentrating_on FROM companions WHERE id = ?', [lyra.id])).concentrating_on == null, 'companion concentrating_on cleared');
  const enemyBreak = await markerResult('[CONDITION_ADD: Target="GobA" Condition="stunned"]', pc.id, sessionId, 'CONDITION_ADD');
  ok(enemyBreak && enemyBreak.concentrationBroken === true, 'enemy stunned breaks concentration');
  ok((await dbGet('SELECT concentrating_on FROM combat_enemies WHERE id = ?', [gA.id])).concentrating_on == null, 'enemy concentrating_on cleared');
}

group('6. Grappler incapacitated releases every grapple it holds');
{
  const pc = await addPc();
  const sessionId = await addSession(pc.id);
  const lyra = await addCompanion('Lyra', pc.id, {});
  const [gA] = await es.createEncounterEnemies(sessionId, 1, [gob('GobA')]);
  await markerResult('[CONDITION_ADD: Target="Tester" Condition="grappled" Grappler="GobA"]', pc.id, sessionId, 'CONDITION_ADD');
  await markerResult('[CONDITION_ADD: Target="Lyra" Condition="grappled" Grappler="GobA"]', pc.id, sessionId, 'CONDITION_ADD');
  ok((await pcConds(pc.id)).includes('grappled') && (await compConds(lyra.id)).includes('grappled'), 'both grappled before release');
  const rel = await markerResult('[CONDITION_ADD: Target="GobA" Condition="incapacitated"]', pc.id, sessionId, 'CONDITION_ADD');
  ok(rel && Array.isArray(rel.released) && rel.released.length === 2, 'grappler incapacitated releases both victims');
  ok(!(await pcConds(pc.id)).includes('grappled') && !(await compConds(lyra.id)).includes('grappled'), 'grappled cleared on both victims');
}

group('7. ESCAPE: refusals, pending PC roll, DC math, one attempt per turn');
{
  const pc = await addPc();
  const sessionId = await addSession(pc.id);
  const [gA] = await es.createEncounterEnemies(sessionId, 1, [gob('GobA')]);
  await order(sessionId, [
    { name: 'Tester', type: 'player', key: await pcKey(pc) },
    { name: 'GobA', type: 'enemy', key: enemyKey(sessionId, gA) },
  ]);
  const notGrappled = await markerResult('[ESCAPE: Target="Tester" Skill="Athletics"]', pc.id, sessionId, 'ESCAPE');
  ok(notGrappled && notGrappled.success === false && /not grappled/.test(notGrappled.reason || ''), 'escape while not grappled refused');
  await markerResult('[CONDITION_ADD: Target="Tester" Condition="grappled" Grappler="GobA"]', pc.id, sessionId, 'ESCAPE');
  const noSkill = await markerResult('[ESCAPE: Target="Tester"]', pc.id, sessionId, 'ESCAPE');
  ok(noSkill && noSkill.success === false && /Skill/.test(noSkill.remedy || ''), 'escape without Skill refused with remedy');
  const pending = await markerResult('[ESCAPE: Target="Tester" Skill="Athletics"]', pc.id, sessionId, 'ESCAPE');
  ok(pending && pending.success === true && pending.pending === true, 'PC escape posts a pending roll');
  // Goblin warrior: STR 8 (-1), CR 1/4 -> PB +2 -> escape DC 9.
  ok(pending.dc === 9, `enemy grappler escape DC is 9 (got ${pending.dc})`);
  const second = await markerResult('[ESCAPE: Target="Tester" Skill="Acrobatics"]', pc.id, sessionId, 'ESCAPE');
  ok(second && second.success === false && /already attempted/.test(second.reason || ''), 'second escape same turn refused');
  const c = await cfg(sessionId);
  ok(c.pendingEscape && c.pendingEscape.escapeeName === 'Tester', 'pendingEscape stored');
  const resolved = await cs.applyPendingEscape(sessionId, c.pendingEscape.key, { outcome: 'success', takenDie: 15, total: 18 });
  ok(resolved && resolved.escaped === true, 'successful escape roll clears grappled');
  ok(!(await pcConds(pc.id)).includes('grappled'), 'grappled cleared after successful escape');
  // A failed escape leaves the grapple. Fresh turn slot first: the
  // successful attempt spent this turn's one escape flag.
  await ct.advanceTurn(sessionId, 1); // GobA
  await ct.advanceTurn(sessionId, 1); // Tester, round 2
  await markerResult('[CONDITION_ADD: Target="Tester" Condition="grappled" Grappler="GobA"]', pc.id, sessionId, 'ESCAPE');
  await markerResult('[ESCAPE: Target="Tester" Skill="Athletics"]', pc.id, sessionId, 'ESCAPE');
  const c2 = await cfg(sessionId);
  const failed = await cs.applyPendingEscape(sessionId, c2.pendingEscape.key, { outcome: 'failure', takenDie: 5, total: 8 });
  ok(failed && failed.escaped === false, 'failed escape roll reports no escape');
  ok((await pcConds(pc.id)).includes('grappled'), 'grappled remains after failed escape');
  // DC math, direct: PC grappler STR 16 (+3), level 5 (PB +3) -> 14.
  const pcDc = await cs.computeEscapeDc({ kind: 'player', id: pc.id });
  ok(pcDc === 14, `PC grappler escape DC is 14 (got ${pcDc})`);
  const enemyDc = await cs.computeEscapeDc({ kind: 'enemy', id: gA.id });
  ok(enemyDc === 9, `enemy grappler escape DC is 9 (got ${enemyDc})`);
  // Unknown grappler with a declared DC still escapes.
  await markerResult('[CONDITION_REMOVE: Target="Tester" Condition="grappled"]', pc.id, sessionId, 'CONDITION_REMOVE');
  await dbRun('DELETE FROM condition_meta WHERE kind = ? AND owner_id = ? AND condition = ?', ['player', pc.id, 'grappled']);
  await markerResult('[CONDITION_ADD: Target="Tester" Condition="grappled" Grappler="GobA"]', pc.id, sessionId, 'ESCAPE');
  await dbRun('DELETE FROM condition_meta WHERE kind = ? AND owner_id = ? AND condition = ?', ['player', pc.id, 'grappled']);
  const noMeta = await markerResult('[ESCAPE: Target="Tester" Skill="Athletics"]', pc.id, sessionId, 'ESCAPE');
  ok(noMeta && noMeta.success === false && /Dc=/.test(noMeta.remedy || ''), 'escape with no grappler on record refuses with Dc remedy');
}

group('8. Deafened: hearing checks auto-fail, everything else rolls');
{
  const pc = await addPc();
  const sessionId = await addSession(pc.id);
  const lyra = await addCompanion('Lyra', pc.id, {});
  const [gA] = await es.createEncounterEnemies(sessionId, 1, [gob('GobA')]);
  await markerResult('[CONDITION_ADD: Target="Tester" Condition="deafened"]', pc.id, sessionId, 'CONDITION_ADD');
  await markerResult('[CONDITION_ADD: Target="Lyra" Condition="deafened"]', pc.id, sessionId, 'CONDITION_ADD');
  await markerResult('[CONDITION_ADD: Target="GobA" Condition="deafened"]', pc.id, sessionId, 'CONDITION_ADD');
  ok((await cs.getConditions('enemy', gA.id)).includes('deafened'), 'enemy carries deafened before the hearing roll');
  const hearing = await markerResult('[ROLL_REQUEST: Skill="Perception" DC=15 Looks="listening for the patrol" Hearing="true"]', pc.id, sessionId, 'ROLL_REQUEST');
  ok(hearing && hearing.pending === false && hearing.outcome === 'failure', 'deafened PC hearing check auto-fails, no pending roll');
  const notHearing = await markerResult('[ROLL_REQUEST: Skill="Perception" DC=15 Looks="looking for tracks"]', pc.id, sessionId, 'ROLL_REQUEST');
  ok(notHearing && notHearing.pending === true, 'deafened PC non-hearing check still rolls');
  const compRoll = await rr.rollForNpc({ sessionId, characterId: pc.id, actorName: 'Lyra', kind: 'skill', name: 'Perception', dc: 15, hearing: true });
  ok(compRoll && compRoll.autoFail === true && compRoll.outcome === 'failure', 'deafened companion hearing check auto-fails');
  const enemyRoll = await rr.rollForNpc({ sessionId, characterId: pc.id, actorName: 'GobA', kind: 'skill', name: 'Perception', dc: 15, hearing: true });
  ok(enemyRoll && enemyRoll.autoFail === true && enemyRoll.outcome === 'failure', 'deafened enemy hearing check auto-fails');
  const enemyNoHearing = await rr.rollForNpc({ sessionId, characterId: pc.id, actorName: 'GobA', kind: 'skill', name: 'Perception', dc: 15, hearing: false });
  ok(enemyNoHearing && !enemyNoHearing.autoFail, 'deafened enemy non-hearing check still rolls');
}

console.log(`\nitem-8: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
