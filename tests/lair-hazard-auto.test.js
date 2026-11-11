// tests/lair-hazard-auto.test.js — lair hazard auto-wiring (2026-11-04).
// Hazards drawn on the durability tick during turn advance APPLY
// damage, symmetrically to party and enemies, with an avoidance roll
// each; the DM-called marker path stays reported-only. Real services,
// real DB. Every random input is controlled (forced hazard rolls,
// forced save rolls, explicit hazard damage where the amount itself
// is asserted) — never a live random roll, never real elapsed time.
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');

const dbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dnd-hazard-auto-'));
process.chdir(dbDir);
delete process.env.TURSO_DATABASE_URL;
delete process.env.TURSO_AUTH_TOKEN;

const svc = (rel) => pathToFileURL(path.join(REPO, rel)).href;
const { initDatabase, dbAll, dbGet, dbRun } = await import(svc('server/database.js'));
await initDatabase();
const lair = await import(svc('server/services/lairDurabilityService.js'));
const { initializeTurnOrder, advanceTurn } = await import(svc('server/services/combatTurnService.js'));
await import(svc('server/services/lairDurabilityService.js')); // registers LAIR_* markers

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

let lairSeq = 0;
async function makeLair({ hp = 1000, maxHp = 1000, features = [], sceneId = null, sceneRoomId = null } = {}) {
  lairSeq += 1;
  const key = `lair-auto-${lairSeq}`;
  const r = await lair.createLair({
    lairKey: key, name: `Lair ${lairSeq}`, sceneId, sceneRoomId,
    features, maxHp,
  });
  if (hp !== maxHp) await dbRun('UPDATE lair_durability SET env_hp = ? WHERE lair_key = ?', [hp, key]);
  return key;
}

async function makeSceneRoom({ features = [] } = {}) {
  const sceneId = await insertRow('scenes', { name: 'Cave', kind: 'dungeon', seed_json: '{}' });
  const roomId = await insertRow('scene_rooms', {
    scene_id: sceneId, room_key: 'r1', name: 'Cave',
    features_json: JSON.stringify(features),
  });
  return { sceneId, roomId };
}

async function makeSession() {
  const charId = await insertRow('characters', {
    name: 'Hero', current_hp: 50, max_hp: 50,
    ability_scores: JSON.stringify({ str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }),
  });
  const sessId = await insertRow('dm_sessions', { character_id: charId, status: 'active' });
  return { charId, sessId };
}

async function hazardState(key) {
  const row = await dbGet('SELECT hazard_state_json FROM lair_durability WHERE lair_key = ?', [key]);
  try { return JSON.parse(row?.hazard_state_json || '{}'); } catch { return {}; }
}

const HAZARD_FEATURES = [
  { name: 'Unstable ceiling', kind: 'hazard_zone' },
  { name: 'Gas pocket', kind: 'flammable' },
  { name: 'Underground stream', kind: 'water' },
  { name: 'High ledge', kind: 'elevation' },
];

group('1. No roll at full durability; decay still runs on the same tick');
{
  const full = await makeLair({ hp: 1000, maxHp: 1000, features: HAZARD_FEATURES });
  const r = await lair.tickRoundAuto(full, { hazardRoll: 1 });
  ok(r.hazard === null && r.decayed === 0, '1000/1000 throws no environmental hazard even on a forced roll');
  const low = await makeLair({ hp: 90, maxHp: 1000, features: HAZARD_FEATURES });
  const d = await lair.tickRoundAuto(low, { hazardRoll: 99 });
  ok(d.decayed === 20 && d.hazard === null, 'decay (20 HP) runs on the same tick a hazard does not fire');
  const row = await lair.getLair(low);
  ok(row.hp === 70, 'decayed HP recorded (90 -> 70)');
}

group('2. No roll when collapsed or escape-pending; telegraph lapses on collapse');
{
  const key = await makeLair({ hp: 600, maxHp: 1000, features: HAZARD_FEATURES });
  const tele = await lair.tickRoundAuto(key, { hazardRoll: 1 });
  ok(tele.telegraphed && tele.telegraphed.severity === 'major', 'dangerous band telegraphs a major hazard (setup)');
  await lair.applyEnvironmentalDamage(key, 600);
  const afterDamage = await lair.getLair(key);
  ok(afterDamage.escapePending === true, 'damage to 0 puts collapse pending (setup)');
  const t = await lair.tickRoundAuto(key, {});
  ok(t.hazard === null && t.struck === undefined, 'collapse-pending lair rolls no hazard and strikes no telegraph');
  ok((await hazardState(key)).telegraph == null, 'pending telegraph lapsed on collapse-pending');
  await lair.resolveCollapseEscape(key, { escaped: true });
  const c = await lair.tickRoundAuto(key, { hazardRoll: 1 });
  ok(c.hazard === null, 'collapsed lair rolls nothing');
}

group('3. Exactly one hazard per tick; severity ceiling by stability band');
{
  const many = await makeLair({ hp: 800, maxHp: 1000, features: HAZARD_FEATURES });
  const one = await lair.tickRoundAuto(many, { hazardRoll: 1, combatants: [] });
  const events = [one.struck, one.telegraphed, one.hazard?.precursor ? one.hazard : null].filter(Boolean);
  ok(events.length === 1 && one.struck?.hazard?.severity === 'minor', 'four hazard features, one hazard event: a minor strike (unstable band)');
  const worn = await makeLair({ hp: 950, maxHp: 1000, features: [{ name: 'Loose pebbles', kind: 'hazard_zone' }] });
  const w = await lair.tickRoundAuto(worn, { hazardRoll: 1 });
  ok(w.hazard?.severity === 'benign' && w.hazard?.precursor === true, 'near-full (worn) lair can only throw a benign precursor, never worse');
  const dangerous = await makeLair({ hp: 600, maxHp: 1000, features: HAZARD_FEATURES });
  const dg = await lair.tickRoundAuto(dangerous, { hazardRoll: 1 });
  ok(dg.telegraphed?.severity === 'major' && dg.hazard === null, 'dangerous band telegraphs major, does not strike immediately');
  const ruin = await makeLair({ hp: 100, maxHp: 1000, features: HAZARD_FEATURES });
  const ru = await lair.tickRoundAuto(ruin, { hazardRoll: 1 });
  ok(ru.telegraphed?.severity === 'life-threatening', 'ruin band can throw life-threatening (telegraphed, not immediate)');
}

group('4. Benign precursor warns, then escalates the same family');
{
  const key = await makeLair({ hp: 950, maxHp: 1000, features: [{ name: 'Loose pebbles', kind: 'hazard_zone' }] });
  const pre = await lair.tickRoundAuto(key, { hazardRoll: 1, combatants: [] });
  ok(pre.hazard?.precursor === true && pre.hazard?.damage === 0, 'benign precursor deals no damage');
  ok((await hazardState(key)).precursor?.kind === 'hazard_zone', 'precursor recorded for the hazard_zone family');
  const next = await lair.tickRoundAuto(key, { hazardRoll: 1, combatants: [] });
  ok(next.struck?.hazard?.severity === 'minor', 'precursor escalates the same-family hazard benign -> minor, striking immediately');
  ok((await hazardState(key)).precursor == null, 'precursor consumed by the escalated hazard');
}

group('5. Major telegraph strikes on the next tick, never double-fires, lapses on encounter end');
{
  const { charId, sessId } = await makeSession();
  const enemyId = await insertRow('combat_enemies', {
    session_id: sessId, encounter_seq: 1, name: 'Goblin', max_hp: 50, current_hp: 50,
    armor_class: 12, attack_bonus: 3, damage_dice: '1d6', dex_mod: 0, status: 'active',
  });
  const order = [
    { name: 'Hero', type: 'player', key: `player:${charId}` },
    { name: 'Goblin', type: 'enemy', key: 'enemy:goblin' },
  ];
  const key = await makeLair({ hp: 600, maxHp: 1000, features: HAZARD_FEATURES });
  const t1 = await lair.tickRoundAuto(key, { sessionId: sessId, encounterSeq: 1, combatants: order, hazardRoll: 1 });
  ok(t1.telegraphed?.severity === 'major' && t1.hazard === null, 'major hazard telegraphed, no HP changed yet');
  const heroBefore = (await dbGet('SELECT current_hp FROM characters WHERE id = ?', [charId])).current_hp;
  const t2 = await lair.tickRoundAuto(key, { sessionId: sessId, encounterSeq: 1, combatants: order, saveRolls: { Hero: 1, Goblin: 20 } });
  ok(t2.struck != null, 'telegraph strikes on the next tick for the same encounter');
  const heroAfter = (await dbGet('SELECT current_hp FROM characters WHERE id = ?', [charId])).current_hp;
  const enemyAfter = (await dbGet('SELECT current_hp FROM combat_enemies WHERE id = ?', [enemyId])).current_hp;
  ok(heroAfter === heroBefore - t2.struck.damage, 'caught party member takes exactly the hazard damage (failed save)');
  ok(enemyAfter === 50, 'avoiding enemy takes no damage (passed save)');
  const t3 = await lair.tickRoundAuto(key, { sessionId: sessId, encounterSeq: 1, combatants: order, hazardRoll: 99 });
  ok(t3.struck === undefined && t3.hazard === null, 'telegraph never double-fires');
  // Encounter-end lapse: a fresh telegraph, explicitly lapsed, never strikes.
  const key2 = await makeLair({ hp: 600, maxHp: 1000, features: HAZARD_FEATURES });
  await lair.tickRoundAuto(key2, { sessionId: sessId, encounterSeq: 1, combatants: order, hazardRoll: 1 });
  const lapsed = await lair.lapseTelegraph(key2);
  ok(lapsed.lapsed === true, 'lapseTelegraph reports the lapsed telegraph');
  const t4 = await lair.tickRoundAuto(key2, { sessionId: sessId, encounterSeq: 1, combatants: order, hazardRoll: 99 });
  ok(t4.struck === undefined && t4.hazard === null, 'lapsed telegraph never strikes');
  // Different-encounter tick lapses the old telegraph instead of striking it.
  const key3 = await makeLair({ hp: 600, maxHp: 1000, features: HAZARD_FEATURES });
  await lair.tickRoundAuto(key3, { sessionId: sessId, encounterSeq: 1, combatants: order, hazardRoll: 1 });
  const t5 = await lair.tickRoundAuto(key3, { sessionId: sessId, encounterSeq: 2, combatants: order, hazardRoll: 99 });
  ok(t5.struck === undefined, 'telegraph for another encounter lapses rather than striking');
}

group('6. Avoidance for party, companion, and enemy; HP floors at 0; marker path stays reported-only');
{
  const { charId, sessId } = await makeSession();
  const npcId = await insertRow('npcs', { name: 'Bram' });
  const compId = await insertRow('companions', {
    npc_id: npcId, recruited_by_character_id: charId, status: 'active',
    companion_current_hp: 40, companion_max_hp: 40,
    companion_ability_scores: JSON.stringify({ str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }),
  });
  await insertRow('combat_enemies', {
    session_id: sessId, encounter_seq: 1, name: 'Goblin', max_hp: 50, current_hp: 50,
    armor_class: 12, attack_bonus: 3, damage_dice: '1d6', dex_mod: 0, status: 'active',
  });
  const order = [
    { name: 'Hero', type: 'player', key: `player:${charId}` },
    { name: 'Bram', type: 'companion', key: `companion:${compId}` },
    { name: 'Goblin', type: 'enemy', key: 'enemy:goblin' },
  ];
  // Direct strike with explicit damage: avoids dice randomness in the amount asserted.
  const struck = await lair.strikeHazard('unused-key', {
    feature: 'Falling rubble', kind: 'hazard_zone', type: 'bludgeoning',
    severity: 'minor', dice: '2d6', damage: 9, saveAbility: 'dex', dc: 12,
  }, { sessionId: sessId, encounterSeq: 1, combatants: order, saveRolls: { Hero: 1, Bram: 20, Goblin: 1 } });
  const byName = Object.fromEntries(struck.results.map((r) => [r.name, r]));
  ok(byName.Hero && !byName.Hero.avoided && byName.Hero.damageTaken === 9, 'failed party save takes the hazard damage');
  ok(byName.Bram && byName.Bram.avoided && byName.Bram.damageTaken === 0, 'passed companion save takes nothing');
  ok(byName.Goblin && !byName.Goblin.avoided && byName.Goblin.damageTaken === 9, 'failed enemy save takes the hazard damage (symmetric)');
  const heroHp = (await dbGet('SELECT current_hp FROM characters WHERE id = ?', [charId])).current_hp;
  const compHp = (await dbGet('SELECT companion_current_hp FROM companions WHERE id = ?', [compId])).companion_current_hp;
  const gobHp = (await dbGet('SELECT current_hp FROM combat_enemies WHERE session_id = ? AND encounter_seq = ? AND name = ?', [sessId, 1, 'Goblin'])).current_hp;
  ok(heroHp === 41 && compHp === 40 && gobHp === 41, 'HP writes landed on all three paths (50-9, 40, 50-9)');
  // HP floor: a 1-HP character caught by a 50-damage hazard ends at 0, never negative.
  await dbRun('UPDATE characters SET current_hp = 1 WHERE id = ?', [charId]);
  const floored = await lair.strikeHazard('unused-key', {
    feature: 'Cave-in', kind: 'hazard_zone', type: 'bludgeoning',
    severity: 'major', dice: '3d6', damage: 50, saveAbility: 'dex', dc: 12,
  }, { sessionId: sessId, encounterSeq: 1, combatants: order.slice(0, 1), saveRolls: { Hero: 1 } });
  const afterFloor = (await dbGet('SELECT current_hp FROM characters WHERE id = ?', [charId])).current_hp;
  ok(afterFloor === 0 && floored.results[0].hpAfter === 0, 'HP floors at 0 on a lethal hazard');
  // Marker path: tickRound still reports, never applies.
  const markerKey = await makeLair({ hp: 600, maxHp: 1000, features: HAZARD_FEATURES });
  const heroPre = (await dbGet('SELECT current_hp FROM characters WHERE id = ?', [charId])).current_hp;
  const m = await lair.tickRound(markerKey, { hazardRoll: 1 });
  ok(m.hazard != null && /reported, not applied/.test(m.hazard.note), 'marker tick still reports its hazard');
  const heroPost = (await dbGet('SELECT current_hp FROM characters WHERE id = ?', [charId])).current_hp;
  ok(heroPost === heroPre, 'marker hazard changes no party HP');
}

group('7. Encounter hook: no linked room / no lair roll nothing; linked lair ticks on round boundary only');
{
  const noRoom = await lair.runEncounterLairTick(999, 1, {});
  ok(noRoom.skipped === 'no-linked-room' && noRoom.success === false, 'no linked room rolls nothing and says so');
  const { charId, sessId } = await makeSession();
  const { sceneId, roomId } = await makeSceneRoom({ features: HAZARD_FEATURES });
  await insertRow('encounter_scene_rooms', { session_id: sessId, encounter_seq: 1, scene_id: sceneId, room_key: 'r1' });
  const noLair = await lair.runEncounterLairTick(sessId, 1, {});
  ok(noLair.skipped === 'no-lair-for-room' && noLair.success === false, 'linked room with no lair rolls nothing and says so');
  const key = await makeLair({ hp: 600, maxHp: 1000, features: HAZARD_FEATURES, sceneId, sceneRoomId: roomId });
  const order = [
    { name: 'Hero', type: 'player', key: `player:${charId}` },
    { name: 'Goblin', type: 'enemy', key: 'enemy:goblin' },
  ];
  await initializeTurnOrder(sessId, 1, order);
  const hooked = await lair.runEncounterLairTick(sessId, 1, { combatants: order, hazardRoll: 1 });
  ok(hooked.success === true && hooked.lairKey === key && hooked.telegraphed?.severity === 'major', 'hook finds the room lair and telegraphs on a forced roll');
  // advanceTurn: mid-round advance attaches nothing; the wrap to a
  // new round runs the hook (lairKey present even when no hazard fires).
  const s1 = await advanceTurn(sessId, 1);
  ok(s1.lairHazard === undefined, 'mid-round advance does not run the lair tick');
  await initializeTurnOrder(sessId, 2, [
    { name: 'Hero', type: 'player', key: `player:${charId}` },
    { name: 'Goblin', type: 'enemy', key: 'enemy:goblin' },
  ]);
  await insertRow('encounter_scene_rooms', { session_id: sessId, encounter_seq: 2, scene_id: sceneId, room_key: 'r1' });
  await advanceTurn(sessId, 2);
  const s2 = await advanceTurn(sessId, 2);
  ok(s2.round === 2 && s2.lairHazard?.lairKey === key && s2.lairHazard?.success === true, 'round-boundary advance runs the encounter lair hook');
}

console.log(`\nlair-hazard-auto: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
