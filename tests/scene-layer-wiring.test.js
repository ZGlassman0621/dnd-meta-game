// tests/scene-layer-wiring.test.js — scene layer wiring (2026-11-02).
// DIAGNOSTIC + BUILD test: the scene layer already had a link table and
// a setter, but nothing in play ever called them. This test proves the
// wiring: dungeon-room auto-link at COMBAT_START, the SET_ROOM DM marker
// (existing room and simple-room creation), re-link on a declared room
// move, and no-link legacy behaviour. Real services, real DB. Assertions
// never depend on a roll (initiative rolls in COMBAT_START are never
// asserted on); the only roll-dependent step, MOVE, asserts on the
// returned move + link, not on any die.
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');

const dbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dnd-scene-link-'));
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
const dss = await import(svc('server/services/dungeonSceneStorageService.js'));
const pipeline = await import(svc('server/services/markerPipeline.js'));
await import(svc('server/services/combatMarkerService.js')); // registers COMBAT_START/MOVE/SET_COVER/ZONES
await import(svc('server/services/sceneLinkService.js')); // registers SET_ROOM

let passed = 0, failed = 0;
function group(name) { console.log('== ' + name + ' =='); }
function ok(cond, msg) {
  try { assert(cond, msg); passed++; }
  catch (e) { failed++; console.error('FAIL:', msg, '|', e.message); }
}

async function insertRow(table, overrides = {}) {
  const info = await dbAll(`PRAGMA table_info(${table})`);
  const cols = []; const vals = [];
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

async function addSession(pcId) {
  return insertRow('dm_sessions', { character_id: pcId, status: 'active' });
}

async function markerResult(text, characterId, sessionId, key) {
  const res = await pipeline.processResponseMarkers(text, { characterId, sessionId });
  const h = res.handlerResults.filter((hr) => hr.schemaKey === key);
  return h.length ? h[0].result : null;
}

const gob = (name) => ({ name, maxHp: 60, armorClass: 5, attackBonus: 3, damageDice: '1d6', dexMod: 1,
  statsJson: JSON.stringify({ abilities: { str: 8, dex: 14, con: 10, int: 10, wis: 8, cha: 8 }, cr: '1/4', skills: {} }) });

async function makeSceneWithRooms(roomDefs) {
  const sceneId = await insertRow('scenes', { name: 'Test Scene', kind: 'dungeon', status: 'content' });
  for (const [key, features] of roomDefs) {
    await insertRow('scene_rooms', { scene_id: sceneId, room_key: key, role: 'room', label: key, features_json: JSON.stringify(features), state: 'discovered' });
  }
  return sceneId;
}

const pillar = (name) => ({ name, kind: 'cover_half', coverTier: 'half', acBonus: 2 });

group('1. SET_ROOM creates a simple room, and cover then validates against it');
{
  const pc = await addPc();
  const sessionId = await addSession(pc.id);
  const [gA] = await es.createEncounterEnemies(sessionId, 1, [gob('GobA')]);
  await ct.initializeTurnOrder(sessionId, 1, [
    { name: 'Tester', type: 'player', key: await tl.ledgerKeyForPlayer(pc.id) },
    { name: 'GobA', type: 'enemy', key: `combat:${sessionId}:1:${gA.id}` },
  ]);
  const linked = await markerResult('[SET_ROOM: Name="Tavern" Features="Bar:cover_half:half, Fireplace:flammable" Exits="North:street"]', pc.id, sessionId, 'SET_ROOM');
  ok(linked && linked.success === true && linked.created === true, 'SET_ROOM creates and links a simple room');
  ok(linked && linked.roomKey === 'tavern', 'simple room key is the slug of its name');
  const roomRow = await dbGet('SELECT * FROM scene_rooms WHERE scene_id = ? AND room_key = ?', [linked.sceneId, 'tavern']);
  const feats = JSON.parse(roomRow.features_json);
  ok(feats.some((f) => f.name === 'Bar' && f.coverTier === 'half'), 'simple room stores the cover feature with its tier');
  const exits = JSON.parse(roomRow.exits_json);
  ok(exits.some((e) => e.direction === 'North' && e.roomKey === 'street'), 'simple room stores its exits');
  const granted = await markerResult('[SET_COVER: Target="GobA" Cover="half" Feature="Bar"]', pc.id, sessionId, 'SET_COVER');
  ok(granted && granted.success === true && granted.featureVerified === true, 'cover from a linked-room feature grants, verified');
  const refused = await markerResult('[SET_COVER: Target="GobA" Cover="half" Feature="Wall"]', pc.id, sessionId, 'SET_COVER');
  ok(refused && refused.success === false && refused.reason === 'feature_not_found', 'cover from a feature not in the room is refused');
}

group('2. SET_ROOM links an existing scene room, and a bad link stores nothing');
{
  const pc = await addPc();
  const sessionId = await addSession(pc.id);
  const [gA] = await es.createEncounterEnemies(sessionId, 1, [gob('GobA')]);
  await ct.initializeTurnOrder(sessionId, 1, [
    { name: 'Tester', type: 'player', key: await tl.ledgerKeyForPlayer(pc.id) },
    { name: 'GobA', type: 'enemy', key: `combat:${sessionId}:1:${gA.id}` },
  ]);
  const sceneId = await makeSceneWithRooms([['r1', [pillar('Pillar')]], ['r2', [pillar('Column')]]]);
  const linked = await markerResult(`[SET_ROOM: Scene=${sceneId} Room="r1"]`, pc.id, sessionId, 'SET_ROOM');
  ok(linked && linked.success === true && linked.sceneId === sceneId && linked.roomKey === 'r1', 'SET_ROOM links an existing scene room');
  const bad = await markerResult(`[SET_ROOM: Scene=${sceneId} Room="nope"]`, pc.id, sessionId, 'SET_ROOM');
  ok(bad && bad.success === false, 'link to a nonexistent room is refused');
  const current = await dss.getEncounterRoom(sessionId, 1);
  ok(current && current.roomKey === 'r1', 'failed link leaves the previous link intact — never a lying link');
  const granted = await markerResult('[SET_COVER: Target="GobA" Cover="half" Feature="Pillar"]', pc.id, sessionId, 'SET_COVER');
  ok(granted && granted.success === true && granted.featureVerified === true, 'cover validates against the linked dungeon room');
}

group('3. Re-link: SET_ROOM replaces the room, and MOVE with Room= re-links it');
{
  const pc = await addPc();
  const sessionId = await addSession(pc.id);
  const [gA] = await es.createEncounterEnemies(sessionId, 1, [gob('GobA')]);
  await ct.initializeTurnOrder(sessionId, 1, [
    { name: 'Tester', type: 'player', key: await tl.ledgerKeyForPlayer(pc.id) },
    { name: 'GobA', type: 'enemy', key: `combat:${sessionId}:1:${gA.id}` },
  ]);
  const sceneId = await makeSceneWithRooms([['r1', [pillar('Pillar')]], ['r2', [pillar('Column')]]]);
  await markerResult(`[SET_ROOM: Scene=${sceneId} Room="r1"]`, pc.id, sessionId, 'SET_ROOM');
  const relinked = await markerResult(`[SET_ROOM: Scene=${sceneId} Room="r2"]`, pc.id, sessionId, 'SET_ROOM');
  ok(relinked && relinked.success === true, 'SET_ROOM to a second room succeeds');
  ok((await dss.getEncounterRoom(sessionId, 1)).roomKey === 'r2', 're-link replaces the room (the party moved)');
  await markerResult('[ZONES: Zones="arena,ridge" Edges="arena-ridge:30" Places="Tester:arena,GobA:arena"]', pc.id, sessionId, 'ZONES');
  const moved = await markerResult('[MOVE: Target="Tester" To="ridge" Room="r1"]', pc.id, sessionId, 'MOVE');
  ok(moved && moved.success === true, 'MOVE with a declared room succeeds');
  ok(moved && moved.roomLink && moved.roomLink.success === true, 'MOVE Room= re-links the encounter');
  ok((await dss.getEncounterRoom(sessionId, 1)).roomKey === 'r1', 'after the room move, cover/display/durability read the new room');
  const oldCover = await markerResult('[SET_COVER: Target="GobA" Cover="half" Feature="Column"]', pc.id, sessionId, 'SET_COVER');
  ok(oldCover && oldCover.success === false, 'cover from the previous room no longer validates after the move');
}

group('4. COMBAT_START auto-links a dungeon room when Scene=/Room= are given');
{
  const pc = await addPc();
  const sessionId = await addSession(pc.id);
  const sceneId = await makeSceneWithRooms([['r1', [pillar('Pillar')]]]);
  const started = await markerResult(`[COMBAT_START: Enemies="GobA" Scene=${sceneId} Room="r1"]`, pc.id, sessionId, 'COMBAT_START');
  ok(started && started.combatStart, 'COMBAT_START still starts combat with room fields present');
  ok(started && started.roomLink && started.roomLink.success === true, 'COMBAT_START auto-links the dungeon room');
  const seq = started.combatStart.encounterSeq;
  const current = await dss.getEncounterRoom(sessionId, seq);
  ok(current && current.roomKey === 'r1' && current.sceneId === sceneId, 'link is stored against the new encounter');
  const pc2 = await addPc();
  const s2 = await addSession(pc2.id);
  const startedBad = await markerResult(`[COMBAT_START: Enemies="GobA" Scene=${sceneId} Room="nope"]`, pc2.id, s2, 'COMBAT_START');
  ok(startedBad && startedBad.combatStart, 'a bad room link does not block combat starting');
  ok(startedBad && startedBad.roomLink && startedBad.roomLink.success === false, 'a bad room link surfaces as a failed roomLink');
  ok((await dss.getEncounterRoom(s2, startedBad.combatStart.encounterSeq)) === null, 'a failed auto-link stores no link (legacy, not a wrong room)');
}

group('5. No link: legacy cover grant stands, featureVerified false');
{
  const pc = await addPc();
  const sessionId = await addSession(pc.id);
  const [gA] = await es.createEncounterEnemies(sessionId, 1, [gob('GobA')]);
  await ct.initializeTurnOrder(sessionId, 1, [
    { name: 'Tester', type: 'player', key: await tl.ledgerKeyForPlayer(pc.id) },
    { name: 'GobA', type: 'enemy', key: `combat:${sessionId}:1:${gA.id}` },
  ]);
  const granted = await markerResult('[SET_COVER: Target="GobA" Cover="half" Feature="Bar"]', pc.id, sessionId, 'SET_COVER');
  ok(granted && granted.success === true && granted.featureVerified === false, 'unlinked fight keeps the pre-Phase-B cover grant, unverified');
}

console.log(`\nscene-layer-wiring: ${passed} passed, ${failed} failed`);
if (failed) process.exitCode = 1;
