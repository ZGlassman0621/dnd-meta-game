// tests/item-4-movement.test.js — combat item 4, movement v1 (zones).
// Real services, real DB. Deterministic by construction: companion
// attacks use AC 5 targets, PC paths use reported dice, and mode
// assertions never depend on a roll.
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');

const dbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dnd-item4-'));
process.chdir(dbDir);
delete process.env.TURSO_DATABASE_URL;
delete process.env.TURSO_AUTH_TOKEN;

const svc = (rel) => pathToFileURL(path.join(REPO, rel)).href;
const { initDatabase, dbAll, dbGet, dbRun } = await import(svc('server/database.js'));
await initDatabase();
const pas = await import(svc('server/services/partyAttackService.js'));
const tl = await import(svc('server/services/turnLedgerService.js'));
const ct = await import(svc('server/services/combatTurnService.js'));
const es = await import(svc('server/services/enemyCombatService.js'));
const wid = await import(svc('server/services/worldIdService.js'));
const mv = await import(svc('server/services/movementService.js'));
const pipeline = await import(svc('server/services/markerPipeline.js'));
await import(svc('server/services/combatMarkerService.js')); // registers ZONES / MOVE / DASH + the rest

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

async function enemyRow(id) {
  return dbGet('SELECT * FROM combat_enemies WHERE id = ?', [id]);
}

async function markerResult(text, characterId, sessionId, key) {
  const res = await pipeline.processResponseMarkers(text, { characterId, sessionId });
  const h = res.handlerResults.filter((hr) => hr.schemaKey === key);
  return h.length ? h[0].result : null;
}

const gob = (name) => ({ name, maxHp: 60, armorClass: 5, attackBonus: 3, damageDice: '1d6', dexMod: 1 });

async function compKey(comp) {
  return tl.ledgerKeyForCompanion(comp);
}

group('1. ZONES declares the graph; no zones = one area');
{
  const pc = await addPc();
  const sessionId = await addSession(pc.id);
  const [ga] = await es.createEncounterEnemies(sessionId, 1, [gob('GobA')]);
  const mover = await addCompanion('Mover', pc.id, { companion_class: 'Fighter', equipment: JSON.stringify({ mainHand: { name: 'Longsword' } }) });
  const mk = await compKey(mover);
  const gk = `combat:${sessionId}:1:${ga.id}`;
  await ct.initializeTurnOrder(sessionId, 1, [
    { name: 'Mover', type: 'companion', key: mk },
    { name: 'GobA', type: 'enemy', key: gk },
  ]);
  const d0 = await mv.distanceBetween(sessionId, 1, mk, gk);
  ok(d0.feet === 5, 'no zones declared = one area, 5 ft apart');
  const z = await markerResult('[ZONES: Zones="arena,ridge" Edges="arena-ridge:30" Places="Mover:arena,GobA:ridge"]', pc.id, sessionId, 'ZONES');
  ok(z && z.success === true, 'ZONES declares arena + ridge');
  const d1 = await mv.distanceBetween(sessionId, 1, mk, gk);
  ok(d1.feet === 30, 'declared edge distance is 30 ft');
  const badEdge = await markerResult('[ZONES: Zones="arena,ridge" Edges="arena-nowhere:10"]', pc.id, sessionId, 'ZONES');
  ok(badEdge && badEdge.success === false, 'edge naming an undeclared area is refused');
  const badPlace = await markerResult('[ZONES: Zones="arena,ridge" Places="Nobody:arena"]', pc.id, sessionId, 'ZONES');
  ok(badPlace && badPlace.success === false, 'placement naming an unknown combatant is refused');
  const d2 = await mv.distanceBetween(sessionId, 1, mk, gk);
  ok(d2.feet === 30, 'refused re-declarations leave the graph untouched');
}

group('2. MOVE spends the budget; DASH doubles it; moves are turn-gated');
{
  const pc = await addPc();
  const sessionId = await addSession(pc.id);
  const [g] = await es.createEncounterEnemies(sessionId, 1, [gob('Goblin')]);
  const walker = await addCompanion('Walker', pc.id, { companion_class: 'Fighter', equipment: JSON.stringify({ mainHand: { name: 'Longsword' } }) });
  const watcher = await addCompanion('Watcher', pc.id, { companion_class: 'Fighter', equipment: JSON.stringify({ mainHand: { name: 'Longsword' } }) });
  const wk = await compKey(walker);
  const wak = await compKey(watcher);
  await ct.initializeTurnOrder(sessionId, 1, [
    { name: 'Walker', type: 'companion', key: wk },
    { name: 'Watcher', type: 'companion', key: wak },
    { name: 'Goblin', type: 'enemy', key: `combat:${sessionId}:1:${g.id}` },
  ]);
  await markerResult('[ZONES: Zones="arena,ridge,far" Edges="arena-ridge:20,ridge-far:20" Places="Walker:arena"]', pc.id, sessionId, 'ZONES');
  const gated = await markerResult('[MOVE: Target="Watcher" To="ridge"]', pc.id, sessionId, 'MOVE');
  ok(gated && gated.success === false, 'a non-current party member cannot move');
  const m1 = await markerResult('[MOVE: Target="Walker" To="ridge"]', pc.id, sessionId, 'MOVE');
  ok(m1 && m1.success === true && m1.feet === 20 && m1.remaining === 10, '20 ft move leaves 10 ft of a 30 ft budget');
  const m2 = await markerResult('[MOVE: Target="Walker" To="far"]', pc.id, sessionId, 'MOVE');
  ok(m2 && m2.success === false && /10 ft of movement left/.test(m2.reason), 'a 20 ft move on 10 ft left is refused with the remainder named');
  const dash = await markerResult('[DASH: Target="Walker"]', pc.id, sessionId, 'DASH');
  ok(dash && dash.success === true && dash.budget === 60, 'Dash doubles the 30 ft budget to 60');
  const m3 = await markerResult('[MOVE: Target="Walker" To="far"]', pc.id, sessionId, 'MOVE');
  ok(m3 && m3.success === true && m3.remaining === 20, 'dashed move lands with 20 ft left (60 - 20 - 20)');
  const dash2 = await markerResult('[DASH: Target="Walker"]', pc.id, sessionId, 'DASH');
  ok(dash2 && dash2.success === false && /already dashed/.test(dash2.reason), 'a second Dash in the same turn is refused');
  const m4 = await markerResult('[MOVE: Target="Walker" To="arena"]', pc.id, sessionId, 'MOVE');
  ok(m4 && m4.success === false, 'the 40 ft walk home on 20 ft left is refused');
}

group('3. MOVE provokes; Disengage and hiding suppress');
{
  // (a) Leaving reach provokes the enemy left behind, not the one entered.
  const pc = await addPc();
  const sessionId = await addSession(pc.id);
  const [g1, g2] = await es.createEncounterEnemies(sessionId, 1, [gob('G1'), gob('G2')]);
  const runner = await addCompanion('Runner', pc.id, { companion_class: 'Fighter', equipment: JSON.stringify({ mainHand: { name: 'Longsword' } }) });
  const rk = await compKey(runner);
  await ct.initializeTurnOrder(sessionId, 1, [
    { name: 'Runner', type: 'companion', key: rk },
    { name: 'G1', type: 'enemy', key: `combat:${sessionId}:1:${g1.id}` },
    { name: 'G2', type: 'enemy', key: `combat:${sessionId}:1:${g2.id}` },
  ]);
  await markerResult('[ZONES: Zones="arena,ridge" Edges="arena-ridge:10" Places="Runner:arena,G1:arena,G2:ridge"]', pc.id, sessionId, 'ZONES');
  const m = await markerResult('[MOVE: Target="Runner" To="ridge"]', pc.id, sessionId, 'MOVE');
  ok(m && m.success === true, 'the provoking move succeeds');
  ok(m.provoked.includes('G1'), 'the enemy left behind is provoked');
  ok(!m.provoked.includes('G2'), 'the enemy entered is not provoked');
  // (b) Disengaged movers provoke nobody.
  const pc2 = await addPc();
  const s2 = await addSession(pc2.id);
  const [h1] = await es.createEncounterEnemies(s2, 1, [gob('H1')]);
  const runner2 = await addCompanion('Runner', pc2.id, { companion_class: 'Fighter', equipment: JSON.stringify({ mainHand: { name: 'Longsword' } }) });
  const rk2 = await compKey(runner2);
  await ct.initializeTurnOrder(s2, 1, [
    { name: 'Runner', type: 'companion', key: rk2 },
    { name: 'H1', type: 'enemy', key: `combat:${s2}:1:${h1.id}` },
  ]);
  await markerResult('[ZONES: Zones="arena,ridge" Edges="arena-ridge:10" Places="Runner:arena,H1:arena"]', pc2.id, s2, 'ZONES');
  await markerResult('[DISENGAGE: Target="Runner"]', pc2.id, s2, 'DISENGAGE');
  const mDis = await markerResult('[MOVE: Target="Runner" To="ridge"]', pc2.id, s2, 'MOVE');
  ok(mDis && mDis.success === true && mDis.provoked.length === 0, 'a Disengaged mover provokes nobody');
  // (c) Hidden movers provoke nobody.
  const pc3 = await addPc();
  const s3 = await addSession(pc3.id);
  const [i1] = await es.createEncounterEnemies(s3, 1, [gob('I1')]);
  const runner3 = await addCompanion('Runner', pc3.id, { companion_class: 'Fighter', equipment: JSON.stringify({ mainHand: { name: 'Longsword' } }) });
  const rk3 = await compKey(runner3);
  await ct.initializeTurnOrder(s3, 1, [
    { name: 'Runner', type: 'companion', key: rk3 },
    { name: 'I1', type: 'enemy', key: `combat:${s3}:1:${i1.id}` },
  ]);
  await markerResult('[ZONES: Zones="arena,ridge" Edges="arena-ridge:10" Places="Runner:arena,I1:arena"]', pc3.id, s3, 'ZONES');
  const hide = await markerResult('[HIDE: Target="Runner" Stealth="18"]', pc3.id, s3, 'HIDE');
  ok(hide && hide.success === true, 'the runner hides before moving');
  const mHid = await markerResult('[MOVE: Target="Runner" To="ridge"]', pc3.id, s3, 'MOVE');
  ok(mHid && mHid.success === true && mHid.provoked.length === 0, 'a hidden mover provokes nobody');
}

group('4. Reach: melee refused across zones, reach weapons reach 10 ft');
{
  // (a) A longsword cannot cross 10 ft.
  const pc = await addPc();
  const sessionId = await addSession(pc.id);
  const [near, far] = await es.createEncounterEnemies(sessionId, 1, [gob('Near'), gob('Far')]);
  const swordsman = await addCompanion('Swordsman', pc.id, { companion_class: 'Fighter', equipment: JSON.stringify({ mainHand: { name: 'Longsword' } }) });
  const sk = await compKey(swordsman);
  await ct.initializeTurnOrder(sessionId, 1, [
    { name: 'Swordsman', type: 'companion', key: sk },
    { name: 'Near', type: 'enemy', key: `combat:${sessionId}:1:${near.id}` },
    { name: 'Far', type: 'enemy', key: `combat:${sessionId}:1:${far.id}` },
  ]);
  await markerResult('[ZONES: Zones="arena,ridge" Edges="arena-ridge:10" Places="Swordsman:arena,Near:arena,Far:ridge"]', pc.id, sessionId, 'ZONES');
  const aNear = await markerResult('[ATTACK: Attacker="Swordsman" Target="Near"]', pc.id, sessionId, 'ATTACK');
  ok(aNear && aNear.success === true, 'the same-area sword swing resolves');
  const aFar = await markerResult('[ATTACK: Attacker="Swordsman" Target="Far"]', pc.id, sessionId, 'ATTACK');
  ok(aFar && aFar.success === false && /reach/.test(aFar.reason), 'the 10 ft sword swing is refused for reach');
  // (b) A glaive reaches 10 ft but not 20 ft; enemies move gate-free.
  const pc2 = await addPc();
  const s2 = await addSession(pc2.id);
  const [f2] = await es.createEncounterEnemies(s2, 1, [gob('Far')]);
  const pikeman = await addCompanion('Pikeman', pc2.id, { companion_class: 'Fighter', equipment: JSON.stringify({ mainHand: { name: 'Glaive' } }) });
  const pk = await compKey(pikeman);
  await ct.initializeTurnOrder(s2, 1, [
    { name: 'Pikeman', type: 'companion', key: pk },
    { name: 'Far', type: 'enemy', key: `combat:${s2}:1:${f2.id}` },
  ]);
  await markerResult('[ZONES: Zones="arena,ridge,far" Edges="arena-ridge:10,ridge-far:10" Places="Pikeman:arena,Far:far"]', pc2.id, s2, 'ZONES');
  const pFar = await markerResult('[ATTACK: Attacker="Pikeman" Target="Far"]', pc2.id, s2, 'ATTACK');
  ok(pFar && pFar.success === false && /reach/.test(pFar.reason), 'the 20 ft glaive swing is refused for reach');
  const em = await markerResult('[MOVE: Target="Far" To="ridge"]', pc2.id, s2, 'MOVE');
  ok(em && em.success === true, 'an enemy move is gate-free (DM-governed)');
  const pNear = await markerResult('[ATTACK: Attacker="Pikeman" Target="Far"]', pc2.id, s2, 'ATTACK');
  ok(pNear && pNear.success === true, 'the 10 ft glaive swing resolves');
}

group('5. Cleave needs the second target near the first and in reach');
{
  const pc = await addPc({
    equipment: JSON.stringify({ mainHand: { name: 'Greataxe' } }),
    mastered_weapons: JSON.stringify(['Greataxe']),
  });
  const sessionId = await addSession(pc.id);
  const [ga, gb, gc] = await es.createEncounterEnemies(sessionId, 1, [gob('GobA'), gob('GobB'), gob('GobC')]);
  const pk = await tl.ledgerKeyForPlayer(pc.id);
  await ct.initializeTurnOrder(sessionId, 1, [
    { name: 'Tester', type: 'player', key: pk },
    { name: 'GobA', type: 'enemy', key: `combat:${sessionId}:1:${ga.id}` },
    { name: 'GobB', type: 'enemy', key: `combat:${sessionId}:1:${gb.id}` },
    { name: 'GobC', type: 'enemy', key: `combat:${sessionId}:1:${gc.id}` },
  ]);
  await markerResult('[ZONES: Zones="arena,ridge" Edges="arena-ridge:60" Places="Tester:arena,GobA:arena,GobB:arena,GobC:ridge"]', pc.id, sessionId, 'ZONES');
  const decl = await markerResult('[ATTACK: Attacker="Tester" Target="GobA"]', pc.id, sessionId, 'ATTACK');
  ok(decl && decl.pending === true, 'the Cleave hit is declared');
  const rep = await pas.resolveReportedAttack(sessionId, pc.id, [20], 10);
  ok(rep && rep.hit === true, 'the reported natural 20 hits, arming Cleave');
  const far = await markerResult('[ATTACK: Attacker="Tester" Target="GobC" Cleave="true"]', pc.id, sessionId, 'ATTACK');
  ok(far && far.success === false && /within 5 ft/.test(far.reason), 'the 60 ft follow-up is refused (not within 5 ft of the first target)');
  const near = await markerResult('[ATTACK: Attacker="Tester" Target="GobB" Cleave="true"]', pc.id, sessionId, 'ATTACK');
  ok(near && near.success === true && near.pending === true, 'the refused follow-up left the flag intact — the near follow-up declares');
}

group('6. Help needs the helper near the target');
{
  const pc = await addPc();
  const sessionId = await addSession(pc.id);
  const [g] = await es.createEncounterEnemies(sessionId, 1, [gob('Goblin')]);
  const helper = await addCompanion('Helper', pc.id, { companion_class: 'Fighter', equipment: JSON.stringify({ mainHand: { name: 'Longsword' } }) });
  const ally = await addCompanion('Ally', pc.id, { companion_class: 'Fighter', equipment: JSON.stringify({ mainHand: { name: 'Longsword' } }) });
  const hk = await compKey(helper);
  const ak = await compKey(ally);
  await ct.initializeTurnOrder(sessionId, 1, [
    { name: 'Helper', type: 'companion', key: hk },
    { name: 'Ally', type: 'companion', key: ak },
    { name: 'Goblin', type: 'enemy', key: `combat:${sessionId}:1:${g.id}` },
  ]);
  await markerResult('[ZONES: Zones="arena,ridge" Edges="arena-ridge:30" Places="Helper:arena,Ally:arena,Goblin:ridge"]', pc.id, sessionId, 'ZONES');
  const hFar = await markerResult('[HELP: Helper="Helper" Target="Goblin" Ally="Ally"]', pc.id, sessionId, 'HELP');
  ok(hFar && hFar.success === false && /within 5 ft/.test(hFar.reason), 'Help from 30 ft away is refused');
  const mv1 = await markerResult('[MOVE: Target="Helper" To="ridge"]', pc.id, sessionId, 'MOVE');
  ok(mv1 && mv1.success === true && mv1.provoked.length === 0, 'closing in provokes nobody (the helper entered reach, never left it)');
  const hNear = await markerResult('[HELP: Helper="Helper" Target="Goblin" Ally="Ally"]', pc.id, sessionId, 'HELP');
  ok(hNear && hNear.success === true, 'Help from the same area succeeds');
}

group('7. Thrown bands: melee crowd, long range, beyond long range');
{
  // (a) Same area: thrown in melee is disadvantaged (the crowd rule).
  const pc = await addPc();
  const sessionId = await addSession(pc.id);
  const [near] = await es.createEncounterEnemies(sessionId, 1, [gob('Near')]);
  const thrower = await addCompanion('Thrower', pc.id, { companion_class: 'Fighter', equipment: JSON.stringify({ mainHand: { name: 'Dagger' } }) });
  const tk = await compKey(thrower);
  await ct.initializeTurnOrder(sessionId, 1, [
    { name: 'Thrower', type: 'companion', key: tk },
    { name: 'Near', type: 'enemy', key: `combat:${sessionId}:1:${near.id}` },
  ]);
  const tNear = await markerResult('[ATTACK: Attacker="Thrower" Target="Near" Thrown="true"]', pc.id, sessionId, 'ATTACK');
  ok(tNear && tNear.success === true && tNear.mode === 'disadvantage', 'a thrown dagger in melee is disadvantaged');
  ok((tNear.modeReasons || []).includes('Ranged attack in melee'), 'the melee-crowd reason is named');
  // (b) 30 ft: beyond the dagger short range (20), inside long (60).
  const pc2 = await addPc();
  const s2 = await addSession(pc2.id);
  const [mid] = await es.createEncounterEnemies(s2, 1, [gob('Mid')]);
  const thrower2 = await addCompanion('Thrower', pc2.id, { companion_class: 'Fighter', equipment: JSON.stringify({ mainHand: { name: 'Dagger' } }) });
  const tk2 = await compKey(thrower2);
  await ct.initializeTurnOrder(s2, 1, [
    { name: 'Thrower', type: 'companion', key: tk2 },
    { name: 'Mid', type: 'enemy', key: `combat:${s2}:1:${mid.id}` },
  ]);
  await markerResult('[ZONES: Zones="arena,mid" Edges="arena-mid:30" Places="Thrower:arena,Mid:mid"]', pc2.id, s2, 'ZONES');
  const tMid = await markerResult('[ATTACK: Attacker="Thrower" Target="Mid" Thrown="true"]', pc2.id, s2, 'ATTACK');
  ok(tMid && tMid.success === true && tMid.mode === 'disadvantage', 'a 30 ft throw is disadvantaged (long range)');
  ok((tMid.modeReasons || []).some((r) => /long range \(30 ft\)/.test(r)), 'the long-range reason names the distance');
  ok(!(tMid.modeReasons || []).includes('Ranged attack in melee'), 'no crowd penalty when nobody shares the thrower area');
  // (c) 70 ft: beyond the dagger long range (60).
  const pc3 = await addPc();
  const s3 = await addSession(pc3.id);
  const [far] = await es.createEncounterEnemies(s3, 1, [gob('Far')]);
  const thrower3 = await addCompanion('Thrower', pc3.id, { companion_class: 'Fighter', equipment: JSON.stringify({ mainHand: { name: 'Dagger' } }) });
  const tk3 = await compKey(thrower3);
  await ct.initializeTurnOrder(s3, 1, [
    { name: 'Thrower', type: 'companion', key: tk3 },
    { name: 'Far', type: 'enemy', key: `combat:${s3}:1:${far.id}` },
  ]);
  await markerResult('[ZONES: Zones="arena,mid,far" Edges="arena-mid:30,mid-far:40" Places="Thrower:arena,Far:far"]', pc3.id, s3, 'ZONES');
  const tFar = await markerResult('[ATTACK: Attacker="Thrower" Target="Far" Thrown="true"]', pc3.id, s3, 'ATTACK');
  ok(tFar && tFar.success === false && /long range/.test(tFar.reason), 'a 70 ft throw is refused (beyond long range)');
}

group('8. Ranged bands + ranged in melee for bows');
{
  const archerOver = {
    companion_class: 'Fighter',
    equipment: JSON.stringify({ mainHand: { name: 'Shortbow' } }),
    inventory: JSON.stringify([{ name: 'Arrows', quantity: 10 }]),
  };
  // (a) 100 ft: beyond short (80), inside long (320).
  const pc = await addPc();
  const sessionId = await addSession(pc.id);
  const [tgt] = await es.createEncounterEnemies(sessionId, 1, [gob('Target')]);
  const archer = await addCompanion('Archer', pc.id, archerOver);
  const ak = await compKey(archer);
  await ct.initializeTurnOrder(sessionId, 1, [
    { name: 'Archer', type: 'companion', key: ak },
    { name: 'Target', type: 'enemy', key: `combat:${sessionId}:1:${tgt.id}` },
  ]);
  await markerResult('[ZONES: Zones="arena,mid,far" Edges="arena-mid:30,mid-far:70" Places="Archer:arena,Target:far"]', pc.id, sessionId, 'ZONES');
  const aFar = await markerResult('[ATTACK: Attacker="Archer" Target="Target"]', pc.id, sessionId, 'ATTACK');
  ok(aFar && aFar.success === true && aFar.mode === 'disadvantage', 'a 100 ft bow shot is disadvantaged (long range)');
  ok((aFar.modeReasons || []).some((r) => /long range \(100 ft\)/.test(r)), 'the long-range reason names the distance');
  // (b) 400 ft: beyond long range.
  const pc2 = await addPc();
  const s2 = await addSession(pc2.id);
  const [t2] = await es.createEncounterEnemies(s2, 1, [gob('Target')]);
  const archer2 = await addCompanion('Archer', pc2.id, archerOver);
  const ak2 = await compKey(archer2);
  await ct.initializeTurnOrder(s2, 1, [
    { name: 'Archer', type: 'companion', key: ak2 },
    { name: 'Target', type: 'enemy', key: `combat:${s2}:1:${t2.id}` },
  ]);
  await markerResult('[ZONES: Zones="arena,far" Edges="arena-far:400" Places="Archer:arena,Target:far"]', pc2.id, s2, 'ZONES');
  const aTooFar = await markerResult('[ATTACK: Attacker="Archer" Target="Target"]', pc2.id, s2, 'ATTACK');
  ok(aTooFar && aTooFar.success === false && /long range/.test(aTooFar.reason), 'a 400 ft bow shot is refused (beyond long range)');
  // (c) Hostile creature in the archer's area: disadvantaged even in short range.
  const pc3 = await addPc();
  const s3 = await addSession(pc3.id);
  const [g3, t3] = await es.createEncounterEnemies(s3, 1, [gob('Goblin'), gob('Target')]);
  const archer3 = await addCompanion('Archer', pc3.id, archerOver);
  const ak3 = await compKey(archer3);
  await ct.initializeTurnOrder(s3, 1, [
    { name: 'Archer', type: 'companion', key: ak3 },
    { name: 'Goblin', type: 'enemy', key: `combat:${s3}:1:${g3.id}` },
    { name: 'Target', type: 'enemy', key: `combat:${s3}:1:${t3.id}` },
  ]);
  await markerResult('[ZONES: Zones="arena,mid" Edges="arena-mid:30" Places="Archer:arena,Goblin:arena,Target:mid"]', pc3.id, s3, 'ZONES');
  const aCrowd = await markerResult('[ATTACK: Attacker="Archer" Target="Target"]', pc3.id, s3, 'ATTACK');
  ok(aCrowd && aCrowd.success === true && aCrowd.mode === 'disadvantage', 'a bow shot with a goblin in the archer area is disadvantaged');
  ok((aCrowd.modeReasons || []).includes('Ranged attack in melee'), 'the melee-crowd reason is named');
  ok(!(aCrowd.modeReasons || []).some((r) => /long range/.test(r)), '30 ft is inside short range, so no long-range reason');
  // (d) A hidden archer cannot be seen, so no crowd penalty — and the
  // hidden attack itself is advantaged.
  const pc4 = await addPc();
  const s4 = await addSession(pc4.id);
  const [g4, t4] = await es.createEncounterEnemies(s4, 1, [gob('Goblin'), gob('Target')]);
  const archer4 = await addCompanion('Archer', pc4.id, archerOver);
  const ak4 = await compKey(archer4);
  await ct.initializeTurnOrder(s4, 1, [
    { name: 'Archer', type: 'companion', key: ak4 },
    { name: 'Goblin', type: 'enemy', key: `combat:${s4}:1:${g4.id}` },
    { name: 'Target', type: 'enemy', key: `combat:${s4}:1:${t4.id}` },
  ]);
  await markerResult('[ZONES: Zones="arena,mid" Edges="arena-mid:30" Places="Archer:arena,Goblin:arena,Target:mid"]', pc4.id, s4, 'ZONES');
  const hid = await markerResult('[HIDE: Target="Archer" Stealth="18"]', pc4.id, s4, 'HIDE');
  ok(hid && hid.success === true, 'the archer hides before shooting');
  const aHid = await markerResult('[ATTACK: Attacker="Archer" Target="Target"]', pc4.id, s4, 'ATTACK');
  ok(aHid && aHid.success === true && aHid.mode === 'advantage', 'the hidden archer shoots advantaged (no crowd penalty, hidden advantage)');
}

group('9. Movement budget resets on the next turn');
{
  const pc = await addPc();
  const sessionId = await addSession(pc.id);
  const [g] = await es.createEncounterEnemies(sessionId, 1, [gob('Goblin')]);
  const walker = await addCompanion('Walker', pc.id, { companion_class: 'Fighter', equipment: JSON.stringify({ mainHand: { name: 'Longsword' } }) });
  const wk = await compKey(walker);
  await ct.initializeTurnOrder(sessionId, 1, [
    { name: 'Walker', type: 'companion', key: wk },
    { name: 'Goblin', type: 'enemy', key: `combat:${sessionId}:1:${g.id}` },
  ]);
  await markerResult('[ZONES: Zones="arena,ridge" Edges="arena-ridge:20" Places="Walker:arena"]', pc.id, sessionId, 'ZONES');
  const m1 = await markerResult('[MOVE: Target="Walker" To="ridge"]', pc.id, sessionId, 'MOVE');
  ok(m1 && m1.success === true && m1.remaining === 10, 'first turn: 20 ft leaves 10 ft');
  await ct.advanceTurn(sessionId, 1);
  await ct.advanceTurn(sessionId, 1);
  const m2 = await markerResult('[MOVE: Target="Walker" To="arena"]', pc.id, sessionId, 'MOVE');
  ok(m2 && m2.success === true && m2.remaining === 10, 'next turn: the budget is fresh, 20 ft leaves 10 ft again');
}

group('10. Difficult terrain, organic zones, speed 0');
{
  // (a) Difficult edges cost double.
  const pc = await addPc();
  const sessionId = await addSession(pc.id);
  const [g] = await es.createEncounterEnemies(sessionId, 1, [gob('Goblin')]);
  const walker = await addCompanion('Walker', pc.id, { companion_class: 'Fighter', equipment: JSON.stringify({ mainHand: { name: 'Longsword' } }) });
  const wk = await compKey(walker);
  await ct.initializeTurnOrder(sessionId, 1, [
    { name: 'Walker', type: 'companion', key: wk },
    { name: 'Goblin', type: 'enemy', key: `combat:${sessionId}:1:${g.id}` },
  ]);
  await markerResult('[ZONES: Zones="arena,ridge" Edges="arena-ridge:20:difficult" Places="Walker:arena"]', pc.id, sessionId, 'ZONES');
  const dRef = await markerResult('[MOVE: Target="Walker" To="ridge"]', pc.id, sessionId, 'MOVE');
  ok(dRef && dRef.success === false, '20 ft of difficult terrain costs 40, over a 30 ft budget');
  await markerResult('[DASH: Target="Walker"]', pc.id, sessionId, 'DASH');
  const dOk = await markerResult('[MOVE: Target="Walker" To="ridge"]', pc.id, sessionId, 'MOVE');
  ok(dOk && dOk.success === true && dOk.remaining === 20, 'dashed, the difficult crossing lands with 20 ft left (60 - 40)');
  // (b) Moving to an undeclared area creates it; the edge persists.
  const pc2 = await addPc();
  const s2 = await addSession(pc2.id);
  const [g2] = await es.createEncounterEnemies(s2, 1, [gob('Goblin')]);
  const walker2 = await addCompanion('Walker', pc2.id, { companion_class: 'Fighter', equipment: JSON.stringify({ mainHand: { name: 'Longsword' } }) });
  const wk2 = await compKey(walker2);
  await ct.initializeTurnOrder(s2, 1, [
    { name: 'Walker', type: 'companion', key: wk2 },
    { name: 'Goblin', type: 'enemy', key: `combat:${s2}:1:${g2.id}` },
  ]);
  const o1 = await markerResult('[MOVE: Target="Walker" To="ridge" Distance="20"]', pc2.id, s2, 'MOVE');
  ok(o1 && o1.success === true && o1.remaining === 10, 'an organic move creates the area on a declared edge');
  const o2 = await markerResult('[MOVE: Target="Walker" To="the fight"]', pc2.id, s2, 'MOVE');
  ok(o2 && o2.success === false, 'walking back on 10 ft left is refused (the organic edge costs 20)');
  await markerResult('[DASH: Target="Walker"]', pc2.id, s2, 'DASH');
  const o3 = await markerResult('[MOVE: Target="Walker" To="the fight"]', pc2.id, s2, 'MOVE');
  ok(o3 && o3.success === true, 'dashed, the walk back lands');
  // (c) Grappled = speed 0 = no move; clearing the condition restores it.
  const pc3 = await addPc();
  const s3 = await addSession(pc3.id);
  const [g3] = await es.createEncounterEnemies(s3, 1, [gob('Goblin')]);
  const walker3 = await addCompanion('Walker', pc3.id, { companion_class: 'Fighter', equipment: JSON.stringify({ mainHand: { name: 'Longsword' } }) });
  const wk3 = await compKey(walker3);
  await ct.initializeTurnOrder(s3, 1, [
    { name: 'Walker', type: 'companion', key: wk3 },
    { name: 'Goblin', type: 'enemy', key: `combat:${s3}:1:${g3.id}` },
  ]);
  await markerResult('[ZONES: Zones="arena,ridge" Edges="arena-ridge:10" Places="Walker:arena"]', pc3.id, s3, 'ZONES');
  await dbRun('UPDATE companions SET active_conditions = ? WHERE id = ?', [JSON.stringify(['grappled']), walker3.id]);
  const s0 = await markerResult('[MOVE: Target="Walker" To="ridge"]', pc3.id, s3, 'MOVE');
  ok(s0 && s0.success === false && /speed 0/.test(s0.reason), 'a grappled mover is refused (speed 0)');
  await dbRun('UPDATE companions SET active_conditions = ? WHERE id = ?', [JSON.stringify([]), walker3.id]);
  const s1 = await markerResult('[MOVE: Target="Walker" To="ridge"]', pc3.id, s3, 'MOVE');
  ok(s1 && s1.success === true, 'clearing the condition restores movement');
}

group('11. Enemy attacks are NOT range-gated (DM-governed, Q2)');
{
  const pc = await addPc();
  const sessionId = await addSession(pc.id);
  const [g] = await es.createEncounterEnemies(sessionId, 1, [gob('Goblin')]);
  const pk = await tl.ledgerKeyForPlayer(pc.id);
  await ct.initializeTurnOrder(sessionId, 1, [
    { name: 'Tester', type: 'player', key: pk },
    { name: 'Goblin', type: 'enemy', key: `combat:${sessionId}:1:${g.id}` },
  ]);
  await markerResult('[ZONES: Zones="arena,ridge" Edges="arena-ridge:30" Places="Tester:arena,Goblin:ridge"]', pc.id, sessionId, 'ZONES');
  const atk = await markerResult('[ENEMY_ATTACK: Enemy="Goblin" Target="Player"]', pc.id, sessionId, 'ENEMY_ATTACK');
  ok(atk && atk.type === 'enemy_attack' && atk.hit !== undefined, 'an enemy attack across zones still resolves — enemies carry no weapon model, so their ranges stay DM-side until item 5');
}

console.log(`Results: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
