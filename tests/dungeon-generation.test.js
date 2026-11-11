// tests/dungeon-generation.test.js — dungeon generation wiring (2026-11-02).
// DIAGNOSTIC + BUILD test: the generation pipeline (seed -> skeleton ->
// content -> stored scene) already existed, tested, with no production
// caller. This file tests the new caller + coherence guardrail + time
// anchor + deduplication. Real services, real DB. Site dice are pinned
// with a deterministic picker wherever an assert depends on them
// (the services support a custom pickFn); live-rolled content is
// never asserted on beyond what validation itself guarantees
// (structure, era, budgets). No roll-dependent asserts.
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');

const dbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dnd-dungeon-gen-'));
process.chdir(dbDir);
delete process.env.TURSO_DATABASE_URL;
delete process.env.TURSO_AUTH_TOKEN;

const svc = (rel) => pathToFileURL(path.join(REPO, rel)).href;
const { initDatabase, dbAll, dbGet, dbRun } = await import(svc('server/database.js'));
await initDatabase();
const dg = await import(svc('server/services/dungeonGenerationService.js'));
const ss = await import(svc('server/services/dungeonSceneStorageService.js'));
const wid = await import(svc('server/services/worldIdService.js'));
const pipeline = await import(svc('server/services/markerPipeline.js'));
await import(svc('server/services/dungeonGenerationService.js')); // registers GENERATE_DUNGEON

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

// Deterministic picker: always the first element. Pins every site die:
// temple / dwarves / war / goblins / a hidden heir / water.
const first = (arr) => arr[0];

group('1. Full pipeline via marker: seed -> skeleton -> content -> stored scene, no auto-entry');
{
  const pc = await addPc();
  const sessionId = await addSession(pc.id);
  const r = await markerResult('[GENERATE_DUNGEON: Name="Test Dungeon" Purpose="rescue" Region="Sword Coast" SiteEra="sealed"]', pc.id, sessionId, 'GENERATE_DUNGEON');
  ok(r && r.success === true && r.stored === true && Number.isInteger(r.sceneId), 'marker generation stores a scene');
  ok(r.roomCount >= 8 && r.roomCount <= 16 && r.roomKeys.length === r.roomCount, 'stored room count within the level band and room keys match');
  ok(r.roomKeys.includes('r1'), 'entrance room key r1 stored');
  ok(r.sceneEra === 'sealed', 'sealed site era carried through to the stored scene');
  const loaded = await ss.loadScene(r.sceneId);
  ok(loaded && loaded.rooms.length === r.roomCount, 'loadScene returns the stored rooms');
  ok(loaded.scene.seedPacket && loaded.scene.seedPacket.party.level === 5, 'stored seed packet carries the session party level (auto, not a form)');
  ok(loaded.scene.seedPacket.party.size === 1, 'stored seed packet carries party size 1 (PC alone, no companions)');
  ok(loaded.scene.seedPacket.siteDice && Object.keys(loaded.scene.seedPacket.siteDice).length === 6, 'stored seed packet carries all six site dice');
  const links = await dbAll('SELECT * FROM encounter_scene_rooms WHERE session_id = ?', [sessionId]);
  ok(links.length === 0, 'generation alone creates no encounter link — the party is NOT placed inside');
  const sessionRow = await dbGet('SELECT character_id FROM dm_sessions WHERE id = ?', [sessionId]);
  ok(sessionRow && sessionRow.character_id === pc.id, 'generation alone changes no session party state');
}

group('2. Party auto: companion count changes party size, level comes from the sheet');
{
  const pc = await addPc();
  const sessionId = await addSession(pc.id);
  await addCompanion('Lyra', pc.id, {});
  const r = await dg.generateDungeon({ sessionId, characterId: pc.id, name: 'Companion Dungeon', pickFn: first });
  ok(r && r.success === true && r.party.level === 5 && r.party.size === 2, 'party size 2 with one active companion, level from the PC sheet');
  const loaded = await ss.loadScene(r.sceneId);
  ok(loaded.scene.seedPacket.party.size === 2, 'stored seed packet records the companion-inclusive party size');
}

group('3. Coherence: flagged combination refuses to store without justification, stores with one');
{
  const pc = await addPc();
  const sessionId = await addSession(pc.id);
  // With the first-picker, hazard family is 'water'; a desert region clashes.
  const blocked = await dg.generateDungeon({ sessionId, characterId: pc.id, name: 'Desert Water Dungeon', region: 'Anauroch desert', pickFn: first });
  ok(blocked && blocked.success === false && blocked.needsJustification === true && blocked.stored === false, 'climate clash blocks storage without justification');
  ok(blocked.coherence && blocked.coherence.some((f) => f.code === 'climate_hazard_clash'), 'blocked result names the climate_hazard_clash flag');
  const none = await dbAll('SELECT id FROM scenes WHERE name = ?', ['Desert Water Dungeon']);
  ok(none.length === 0, 'blocked generation stores nothing');
  const justified = await dg.generateDungeon({ sessionId, characterId: pc.id, name: 'Desert Water Dungeon', region: 'Anauroch desert', justification: 'An ancient irrigation curse keeps the water flowing.', pickFn: first });
  ok(justified && justified.success === true && justified.stored === true, 'same combination stores with a justifying story');
  const loaded = await ss.loadScene(justified.sceneId);
  ok(loaded.scene.seedPacket.coherence && loaded.scene.seedPacket.coherence.justification === 'An ancient irrigation curse keeps the water flowing.', 'justification is recorded in the stored seed packet');
  ok(loaded.scene.seedPacket.coherence.flags.some((f) => f.code === 'climate_hazard_clash'), 'flag is recorded alongside its justification, not erased');
}

group('4. Deduplication: second generation for the same place surfaces the existing scene, never overwrites');
{
  const pc = await addPc();
  const sessionId = await addSession(pc.id);
  const firstGen = await dg.generateDungeon({ sessionId, characterId: pc.id, name: 'Dup Dungeon', pickFn: first });
  ok(firstGen && firstGen.success === true && firstGen.stored === true, 'first generation stores');
  const second = await dg.generateDungeon({ sessionId, characterId: pc.id, name: 'Dup Dungeon', pickFn: first });
  ok(second && second.success === true && second.existing === true && second.stored === false && second.sceneId === firstGen.sceneId, 'second generation surfaces the existing scene, same id, stored false');
  const rows = await dbAll('SELECT id FROM scenes WHERE name = ?', ['Dup Dungeon']);
  ok(rows.length === 1, 'still exactly one scene row for that name');
}

group('5. Sealed vs active eras, stored packet matches the skeleton, world-day time anchor');
{
  const pc = await addPc();
  const sessionId = await addSession(pc.id);
  const sealed = await dg.generateDungeon({ sessionId, characterId: pc.id, name: 'Sealed Dungeon', siteEra: 'sealed', pickFn: first });
  const active = await dg.generateDungeon({ sessionId, characterId: pc.id, name: 'Active Dungeon', siteEra: 'active', pickFn: first });
  ok(sealed && sealed.sceneEra === 'sealed' && active && active.sceneEra === 'active', 'site era flows through to each stored scene');
  const loaded = await ss.loadScene(sealed.sceneId);
  ok(loaded.scene.era === 'sealed', 'loaded sealed scene reports its era');
  for (const room of loaded.rooms) {
    const treasure = room.treasure;
    if (treasure) {
      for (const v of treasure.valuables || []) ok(v.eraTag !== 'current', 'sealed treasure holds no current-era valuables');
      for (const g of treasure.gear || []) ok(g.eraTag !== 'current', 'sealed treasure holds no current-era gear');
    }
  }
  ok(sealed.timeAnchor && typeof sealed.timeAnchor.worldDay === 'number', 'generation returns a world-day time anchor');
  ok(loaded.scene.seedPacket.timeAnchor && loaded.scene.seedPacket.timeAnchor.worldDay === sealed.timeAnchor.worldDay, 'stored seed packet carries the same time anchor');
  const sceneRow = await dbGet('SELECT generated_world_day, generated_world_year FROM scenes WHERE id = ?', [sealed.sceneId]);
  ok(sceneRow && sceneRow.generated_world_day === sealed.timeAnchor.worldDay && sceneRow.generated_world_year === sealed.timeAnchor.year, 'migration 101 mirror columns carry the anchor');
  const refused = await dg.generateDungeon({ sessionId, characterId: pc.id, name: '', pickFn: first });
  ok(refused && refused.success === false && /Name/.test(refused.reason || ''), 'generation without a name is refused with a remedy');
}

console.log(`\ndungeon-generation: ${passed} passed, ${failed} failed`);
if (failed) process.exitCode = 1;
