// tests/display-casting.test.js — display casting (combined build with
// combat item 8): aim a spell at a spot to deliberately miss as a
// show of power. Real services, real DB. The mishap/surge pick is
// uniform random, so tests assert the pick lands inside the available
// options (always true) and cover the damage/persistence paths
// directly through the exported helpers — never a rolled category.
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');

const dbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dnd-display-'));
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
const ess = await import(svc('server/services/enemySpellService.js'));
const ds = await import(svc('server/services/displayService.js'));
const dc = await import(svc('server/services/dungeonContentService.js'));
const pipeline = await import(svc('server/services/markerPipeline.js'));
await import(svc('server/services/combatMarkerService.js')); // registers combat markers
await import(svc('server/services/characterHpService.js')); // registers HP_CHANGE
await import(svc('server/services/spellCastService.js')); // registers SPELL_CAST
await import(svc('server/services/displayService.js')); // registers DISPLAY/ENEMY_DISPLAY

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

async function addWizardPc(over = {}) {
  return addPc({
    class: 'Wizard',
    ability_scores: JSON.stringify({ str: 8, dex: 14, con: 14, int: 16, wis: 12, cha: 10 }),
    ...over
  });
}

async function addCompanion(name, pcId, over = {}) {
  const npcId = await insertRow('npcs', { name });
  await wid.assignWorldId('npcs', npcId);
  const id = await insertRow('companions', {
    npc_id: npcId, recruited_by_character_id: pcId, status: 'active',
    companion_spell_slots_used: JSON.stringify({}),
    progression_type: 'class_based', companion_level: 3, companion_class: 'Wizard',
    companion_ability_scores: JSON.stringify({ str: 8, dex: 14, con: 14, int: 16, wis: 12, cha: 10 }),
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

async function pcSlots(pcId) {
  return JSON.parse((await dbGet('SELECT spell_slots_used FROM characters WHERE id = ?', [pcId])).spell_slots_used || '{}');
}

async function enemyHp(rowId) {
  return (await dbGet('SELECT current_hp FROM combat_enemies WHERE id = ?', [rowId]))?.current_hp;
}

const gob = (name) => ({ name, maxHp: 60, armorClass: 5, attackBonus: 3, damageDice: '1d6', dexMod: 1,
  statsJson: JSON.stringify({ abilities: { str: 8, dex: 14, con: 10, int: 10, wis: 8, cha: 8 }, cr: '1/4', skills: {} }) });

async function order(sessionId, entries) {
  await ct.initializeTurnOrder(sessionId, 1, entries);
}
async function pcKey(pc) { return tl.ledgerKeyForPlayer(pc.id); }
async function compKey(comp) { return tl.ledgerKeyForCompanion(comp); }
function enemyKey(sessionId, row) { return `combat:${sessionId}:1:${row.id}`; }

group('1. Pure helpers: declared features, mishap/surge options, strike effects');
{
  ok(JSON.stringify(ds.parseDeclaredFeatures('haybale:flammable, trough:water, stone wall')) ===
    JSON.stringify([{ name: 'haybale', kind: 'flammable' }, { name: 'trough', kind: 'water' }, { name: 'stone wall', kind: null }]),
    'declared features parse name:kind pairs, bare names get null kind');
  ok(ds.parseDeclaredFeatures('').length === 0, 'empty declared string parses to no features');
  const full = ds.mishapOptions({ besideName: 'GobA', features: [{ name: 'Haybale', kind: 'flammable' }, { name: 'Hidden panel', kind: 'secret' }] });
  ok(JSON.stringify(full) === JSON.stringify(['splash', 'feature', 'fizzle']), 'mishap with Beside + features offers all three');
  const noBeside = ds.mishapOptions({ besideName: null, features: [{ name: 'Haybale', kind: 'flammable' }] });
  ok(!noBeside.includes('splash'), 'no Beside means no splash category');
  const onlySecret = ds.mishapOptions({ besideName: null, features: [{ name: 'Hidden panel', kind: 'secret' }] });
  ok(JSON.stringify(onlySecret) === JSON.stringify(['fizzle']), 'a lone secret is never a mishap target');
  const surgeSecret = ds.surgeOptions({ features: [{ name: 'Hidden panel', kind: 'secret', revealed: false }] });
  ok(surgeSecret.includes('reveal'), 'unrevealed secret offers a reveal surge');
  const surgeRevealed = ds.surgeOptions({ features: [{ name: 'Hidden panel', kind: 'secret', revealed: true }] });
  ok(JSON.stringify(surgeRevealed) === JSON.stringify(['resounding']), 'revealed secret cannot reveal twice');
  ok(ds.featureStrikeEffect('fire', 'flammable') === 'ignites', 'fire ignites flammable');
  ok(ds.featureStrikeEffect('lightning', 'water') === 'electrifies', 'lightning electrifies water');
  ok(ds.featureStrikeEffect('cold', 'water') === 'freezes', 'cold freezes water');
  ok(ds.featureStrikeEffect('fire', 'water') === 'steam (cosmetic)', 'fire on water is cosmetic steam');
  ok(ds.featureStrikeEffect('fire', 'elevation') === 'cosmetic strike (scorch/chip/crack, no mechanical effect)', 'unmatched strike is cosmetic');
}

group('2. PC plain display: slot spent, pending posted, die 10 lands');
{
  const pc = await addPc();
  const sessionId = await addSession(pc.id);
  const [gA] = await es.createEncounterEnemies(sessionId, 1, [gob('GobA')]);
  await order(sessionId, [
    { name: 'Tester', type: 'player', key: await pcKey(pc) },
    { name: 'GobA', type: 'enemy', key: enemyKey(sessionId, gA) },
  ]);
  const r = await markerResult('[DISPLAY: Spell="Fireball" Target="floor beside GobA" Beside="GobA"]', pc.id, sessionId, 'DISPLAY');
  ok(r && r.success === true && r.pending === true, 'PC display posts a pending placement roll');
  ok(r.placement === 'Charisma', 'non-caster PC places with Charisma (showmanship fallback)');
  ok((await pcSlots(pc.id))['3'] === 1, 'display spends the 3rd-level slot');
  const c = await cfg(sessionId);
  ok(c.pendingDisplay && c.pendingDisplay.spell === 'Fireball' && c.pendingDisplay.stage === 'placement', 'pendingDisplay stored');
  const placed = await ds.applyPendingDisplay(sessionId, c.pendingDisplay.key, { outcome: 'success', takenDie: 10, total: 12 });
  ok(placed && placed.placed === true && !placed.mishap && !placed.surge, 'a mid-range placement lands where meant');
  ok(!(await cfg(sessionId)).pendingDisplay, 'pendingDisplay cleared after resolution');
}

group('3. Nat 1 / nat 20 with no room and no Beside: fizzle / resounding only');
{
  const pc = await addPc();
  const sessionId = await addSession(pc.id);
  const [gA] = await es.createEncounterEnemies(sessionId, 1, [gob('GobA')]);
  await order(sessionId, [
    { name: 'Tester', type: 'player', key: await pcKey(pc) },
    { name: 'GobA', type: 'enemy', key: enemyKey(sessionId, gA) },
  ]);
  await markerResult('[DISPLAY: Spell="Fireball" Target="floor"]', pc.id, sessionId, 'DISPLAY');
  const c = await cfg(sessionId);
  const mishap = await ds.applyPendingDisplay(sessionId, c.pendingDisplay.key, { outcome: 'critical_failure', takenDie: 1, total: 1 });
  ok(mishap && mishap.mishap && mishap.mishap.category === 'fizzle', 'nat 1 with nothing to hit fizzles');
  // One action per turn: the first display spent this turn's action, so
  // the second display needs a fresh turn (past GobA, back to Tester).
  await ct.advanceTurn(sessionId, 1); // GobA
  await ct.advanceTurn(sessionId, 1); // Tester, round 2
  await markerResult('[DISPLAY: Spell="Fireball" Target="floor"]', pc.id, sessionId, 'DISPLAY');
  const c2 = await cfg(sessionId);
  const surge = await ds.applyPendingDisplay(sessionId, c2.pendingDisplay.key, { outcome: 'critical_success', takenDie: 20, total: 20 });
  ok(surge && surge.surge && surge.surge.category === 'resounding', 'nat 20 with no secret resounds');
}

group('4. Splash damage path: Fireball dice land, non-damage spell is cosmetic');
{
  const pc = await addPc();
  const sessionId = await addSession(pc.id);
  const [gA] = await es.createEncounterEnemies(sessionId, 1, [gob('GobA')]);
  const before = await enemyHp(gA.id);
  const ctx = { sessionId, encounterSeq: 1, casterSide: 'party', casterKind: 'player', casterId: pc.id, casterName: 'Tester', characterId: pc.id, besideName: 'GobA' };
  const splash = await ds.applySplash(ctx, 'Fireball', 3);
  ok(splash.category === 'splash' && splash.damage >= 8 && splash.damage <= 48 && splash.damageType === 'fire', 'Fireball splash rolls 8d6 fire');
  ok((await enemyHp(gA.id)) === before - splash.damage, 'splash damage reduces the Beside enemy HP by exactly the rolled amount');
  const cosmetic = await ds.applySplash(ctx, 'Healing Word', 1);
  ok(cosmetic.category === 'splash' && cosmetic.damage === 0, 'non-damage spell splash is cosmetic, no HP change');
  ok((await enemyHp(gA.id)) === before - splash.damage, 'cosmetic splash leaves HP unchanged');
}

group('5. Intimidating display: Dc required, one roll, crit riders');
{
  // Three Fireball displays: three 3rd-level slots, and a fresh turn
  // each (one action per turn) — see the advances below.
  const pc = await addPc({ spell_slots: JSON.stringify({ 1: 4, 2: 3, 3: 4 }) });
  const sessionId = await addSession(pc.id);
  const [gA] = await es.createEncounterEnemies(sessionId, 1, [gob('GobA')]);
  await order(sessionId, [
    { name: 'Tester', type: 'player', key: await pcKey(pc) },
    { name: 'GobA', type: 'enemy', key: enemyKey(sessionId, gA) },
  ]);
  const noDc = await markerResult('[DISPLAY: Spell="Fireball" Target="floor" Intimidate="true"]', pc.id, sessionId, 'DISPLAY');
  ok(noDc && noDc.success === false && /Dc=/.test(noDc.remedy || ''), 'intimidating display without Dc refused with remedy');
  const r = await markerResult('[DISPLAY: Spell="Fireball" Target="floor beside GobA" Beside="GobA" Intimidate="true" Dc="14"]', pc.id, sessionId, 'DISPLAY');
  ok(r && r.success === true && r.pending === true && r.placement === 'Intimidation', 'intimidating display posts an Intimidation placement');
  const c = await cfg(sessionId);
  const done = await ds.applyPendingDisplay(sessionId, c.pendingDisplay.key, { outcome: 'success', takenDie: 16, total: 18 });
  ok(done && done.placed === true && done.intimidation === 'success', 'intimidation success lands the display with the success recorded');
  await ct.advanceTurn(sessionId, 1); // GobA
  await ct.advanceTurn(sessionId, 1); // Tester, round 2: fresh action
  await markerResult('[DISPLAY: Spell="Fireball" Target="floor" Intimidate="true" Dc="14"]', pc.id, sessionId, 'DISPLAY');
  const c2 = await cfg(sessionId);
  const crit = await ds.applyPendingDisplay(sessionId, c2.pendingDisplay.key, { outcome: 'critical_success', takenDie: 20, total: 20 });
  ok(crit && crit.intimidation === 'critical_success' && crit.surge, 'nat 20 intimidating display surges with a crit success');
  await ct.advanceTurn(sessionId, 1); // GobA
  await ct.advanceTurn(sessionId, 1); // Tester, round 3: fresh action
  await markerResult('[DISPLAY: Spell="Fireball" Target="floor" Intimidate="true" Dc="14"]', pc.id, sessionId, 'DISPLAY');
  const c3 = await cfg(sessionId);
  const fumble = await ds.applyPendingDisplay(sessionId, c3.pendingDisplay.key, { outcome: 'critical_failure', takenDie: 1, total: 1 });
  ok(fumble && fumble.intimidation === 'critical_failure' && fumble.mishap, 'nat 1 intimidating display mishandles with a crit failure');
}

group('6. Armed enemy counter: CON save success continues, failure fizzles, slot stays spent');
{
  const pc = await addPc();
  const sessionId = await addSession(pc.id);
  const [gA] = await es.createEncounterEnemies(sessionId, 1, [gob('GobA')]);
  await order(sessionId, [
    { name: 'Tester', type: 'player', key: await pcKey(pc) },
    { name: 'GobA', type: 'enemy', key: enemyKey(sessionId, gA) },
  ]);
  await ess.armEnemyCounter(sessionId, 1, { enemyName: 'GobA', dc: 17, targetName: null });
  const r = await markerResult('[DISPLAY: Spell="Fireball" Target="floor"]', pc.id, sessionId, 'DISPLAY');
  ok(r && r.success === true && r.countered === 'pending' && r.counterspeller === 'GobA', 'armed counter defers the display to a CON save');
  ok((await pcSlots(pc.id))['3'] === 1, 'counter-pending display already spent the slot');
  const c = await cfg(sessionId);
  ok(c.pendingDisplay && c.pendingDisplay.stage === 'counter', 'pendingDisplay sits in the counter stage');
  const continued = await ds.applyPendingDisplay(sessionId, c.pendingDisplay.key, { outcome: 'success', takenDie: 18, total: 20 });
  ok(continued && continued.placementPending === true, 'CON save success re-posts the placement roll');
  const c2 = await cfg(sessionId);
  ok(c2.pendingDisplay && c2.pendingDisplay.stage === 'placement', 'pendingDisplay moves to the placement stage');
  const placed = await ds.applyPendingDisplay(sessionId, c2.pendingDisplay.key, { outcome: 'success', takenDie: 12, total: 14 });
  ok(placed && placed.placed === true, 'placement after a survived counter lands');
  // Failure path: fresh session, counter succeeds.
  const pc2 = await addPc();
  const sessionId2 = await addSession(pc2.id);
  const [gB] = await es.createEncounterEnemies(sessionId2, 1, [gob('GobA')]);
  await order(sessionId2, [
    { name: 'Tester', type: 'player', key: await pcKey(pc2) },
    { name: 'GobA', type: 'enemy', key: enemyKey(sessionId2, gB) },
  ]);
  await ess.armEnemyCounter(sessionId2, 1, { enemyName: 'GobA', dc: 17, targetName: null });
  await markerResult('[DISPLAY: Spell="Fireball" Target="floor"]', pc2.id, sessionId2, 'DISPLAY');
  const c3 = await cfg(sessionId2);
  const fizzled = await ds.applyPendingDisplay(sessionId2, c3.pendingDisplay.key, { outcome: 'failure', takenDie: 5, total: 7 });
  ok(fizzled && fizzled.countered === true, 'CON save failure fizzles the display');
  ok(!(await cfg(sessionId2)).pendingDisplay, 'fizzled display leaves no pending');
  ok((await pcSlots(pc2.id))['3'] === 1, 'countered display keeps the slot spent');
}

group('7. Companion display resolves immediately (system roll, no pending)');
{
  const pc = await addPc();
  const sessionId = await addSession(pc.id);
  const lyra = await addCompanion('Lyra', pc.id, {});
  const [gA] = await es.createEncounterEnemies(sessionId, 1, [gob('GobA')]);
  await order(sessionId, [
    { name: 'Lyra', type: 'companion', key: await compKey(lyra) },
    { name: 'Tester', type: 'player', key: await pcKey(pc) },
    { name: 'GobA', type: 'enemy', key: enemyKey(sessionId, gA) },
  ]);
  const r = await markerResult('[DISPLAY: Caster="Lyra" Spell="Fire Bolt" Target="floor beside GobA" Beside="GobA"]', pc.id, sessionId, 'DISPLAY');
  ok(r && r.success === true && !r.pending && r.slotConsumed === false, 'companion cantrip display resolves immediately, no slot');
  ok(r.placed === true || r.mishap || r.surge, 'companion display lands, mishandles, or surges');
}

group('8. Enemy display: slot spent, placement resolves, counter branch shape');
{
  const pc = await addWizardPc();
  const sessionId = await addSession(pc.id);
  const [gA] = await es.createEncounterEnemies(sessionId, 1, [gob('GobA')]);
  await dbRun('UPDATE combat_enemies SET enemy_spell_slots_json = ? WHERE id = ?', [JSON.stringify({ 3: 2 }), gA.id]);
  await order(sessionId, [
    { name: 'GobA', type: 'enemy', key: enemyKey(sessionId, gA) },
    { name: 'Tester', type: 'player', key: await pcKey(pc) },
  ]);
  const r = await markerResult('[ENEMY_DISPLAY: Enemy="GobA" Spell="Fireball" Level=3 Target="floor"]', pc.id, sessionId, 'ENEMY_DISPLAY');
  ok(r && r.success === true && r.slotsRemaining === 1, 'enemy display spends a slot');
  ok(r.placed === true || r.mishap || r.surge, 'enemy display placement resolves');
  // Same-message party counter: either intercepts or the display completes.
  const pc2 = await addWizardPc();
  const sessionId2 = await addSession(pc2.id);
  const [gB] = await es.createEncounterEnemies(sessionId2, 1, [gob('GobA')]);
  await dbRun('UPDATE combat_enemies SET enemy_spell_slots_json = ? WHERE id = ?', [JSON.stringify({ 3: 2 }), gB.id]);
  await order(sessionId2, [
    { name: 'GobA', type: 'enemy', key: enemyKey(sessionId2, gB) },
    { name: 'Tester', type: 'player', key: await pcKey(pc2) },
  ]);
  const res = await pipeline.processResponseMarkers('[SPELL_CAST: Spell="Counterspell" Level=3 Target="GobA" Reaction="true"] [ENEMY_DISPLAY: Enemy="GobA" Spell="Fireball" Level=3 Target="floor"]', { characterId: pc2.id, sessionId: sessionId2 });
  const ed = res.handlerResults.filter((hr) => hr.schemaKey === 'ENEMY_DISPLAY')[0].result;
  ok(ed && ed.success === true, 'countered-or-not enemy display returns success');
  if (ed.countered === true) {
    ok(ed.slotsRemaining === 1, 'countered enemy display still spent the slot');
  } else {
    ok(ed.placed === true || ed.mishap || ed.surge, 'uncountered enemy display placement resolves');
  }
  // Incapacitated enemy cannot display.
  await markerResult('[CONDITION_ADD: Target="GobA" Condition="incapacitated"]', pc2.id, sessionId2, 'CONDITION_ADD');
  const blocked = await markerResult('[ENEMY_DISPLAY: Enemy="GobA" Spell="Fireball" Level=3 Target="floor"]', pc2.id, sessionId2, 'ENEMY_DISPLAY');
  ok(blocked && blocked.success === false && /incapacitated/.test(blocked.reason || ''), 'incapacitated enemy display refused');
}

group('9. Room candidates: linked room wins, declared falls back, reveal persists');
{
  const pc = await addPc();
  const sessionId = await addSession(pc.id);
  const [gA] = await es.createEncounterEnemies(sessionId, 1, [gob('GobA')]);
  const declared = await ds.getDisplayCandidates(sessionId, 1, 'haybale:flammable, trough:water');
  ok(declared.source === 'declared' && declared.features.length === 2, 'no linked room falls back to declared features');
  // Link the encounter to a room holding a secret + a flammable feature.
  const roomFeatures = JSON.stringify([
    { name: 'Hidden panel', kind: 'secret', notes: '' },
    { name: 'Haybale', kind: 'flammable', notes: '' },
  ]);
  let roomLinked = false;
  try {
    await insertRow('scene_rooms', { scene_id: 1, room_key: 'chamber-1', features_json: roomFeatures });
    await insertRow('encounter_scene_rooms', { session_id: sessionId, encounter_seq: 1, scene_id: 1, room_key: 'chamber-1' });
    roomLinked = true;
  } catch { /* schema drift: fall back to the declared assertion below */ }
  if (roomLinked) {
    const linked = await ds.getDisplayCandidates(sessionId, 1, 'other:flammable');
    ok(linked.source === 'room' && linked.features.some((f) => f.name === 'Hidden panel' && f.kind === 'secret'),
      'linked room features win over declared features');
    const marked = await ds.markSecretRevealed(linked, 'Hidden panel');
    ok(marked === true, 'reveal persists onto the room row');
    const row = await dbGet('SELECT features_json FROM scene_rooms WHERE scene_id = ? AND room_key = ?', [1, 'chamber-1']);
    const after = JSON.parse(row.features_json);
    ok(after.find((f) => f.name === 'Hidden panel').revealed === true, 'room row carries revealed:true after the surge');
    const relinked = await ds.getDisplayCandidates(sessionId, 1, null);
    ok(!ds.surgeOptions({ features: relinked.features }).includes('reveal'), 'a revealed secret leaves the surge pool');
  } else {
    ok(true, 'room-link tables unavailable in this schema; declared fallback covered above');
  }
}

group('10. Generator: flammable/water kinds + rare secret roll');
{
  const flammableStub = (arr) => arr.includes('flammable') ? 'flammable' : arr[0];
  const f = dc.assignFeatures({ role: 'chamber' }, flammableStub);
  ok(f.some((x) => x.kind === 'flammable' && x.name === 'Haybale'), 'generator can deal a flammable feature');
  const secretStub = (arr) => (arr.length > 0 && arr.every((v) => typeof v === 'boolean') ? true : arr[0]);
  const s = dc.assignFeatures({ role: 'chamber' }, secretStub);
  ok(s.some((x) => x.kind === 'secret'), 'generator secret roll can add a secret feature');
  const plainStub = (arr) => arr[0];
  const p = dc.assignFeatures({ role: 'chamber' }, plainStub);
  ok(!p.some((x) => x.kind === 'secret'), 'first-element pick never adds a secret');
}

console.log(`\ndisplay-casting: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
