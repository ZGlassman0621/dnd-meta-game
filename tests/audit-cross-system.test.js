// tests/audit-cross-system.test.js — deep-audit cross-system test (2026-11-02).
// DIAGNOSTIC ONLY: no product code is changed by this file. It stacks
// several gated systems in single fights, the shape of case the item-8 /
// display gate proved single-system tests miss (companion-OA crash,
// deafened-mook lookup slip). Real services, real DB. Assertions never
// depend on a roll except where the test itself supplies the reported
// outcome (fabricated rollOutcome, same shape the route passes to
// applyPending* handlers). Marker shapes verified against
// server/services/markerSchemas.js and the item-4 / item-7 / display /
// item-8 test files before this file was pushed to the Mac.
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');

const dbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dnd-audit-cross-'));
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
const asvc = await import(svc('server/services/actionStateService.js'));
const ds = await import(svc('server/services/displayService.js'));
const dts = await import(svc('server/services/damageTableService.js'));
const cold = await import(svc('server/services/coldExposureService.js'));
const ses = await import(svc('server/services/sessionEndService.js'));
const pipeline = await import(svc('server/services/markerPipeline.js'));
await import(svc('server/services/combatMarkerService.js')); // registers combat markers
await import(svc('server/services/characterHpService.js')); // registers HP_CHANGE
await import(svc('server/services/rollRequestService.js')); // registers ROLL_REQUEST
await import(svc('server/services/spellCastService.js')); // registers SPELL_CAST
await import(svc('server/services/partyAttackService.js')); // registers ATTACK
await import(svc('server/services/classFeatureService.js')); // registers RAGE etc.
await import(svc('server/services/conditionService.js')); // registers CONDITION_ADD/ESCAPE
await import(svc('server/services/enemySpellService.js')); // registers ENEMY_CAST
await import(svc('server/services/displayService.js')); // registers DISPLAY/ENEMY_DISPLAY
await import(svc('server/services/coldExposureService.js')); // registers COLD_SCENE/COLD_WET

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

async function cfg(sessionId) {
  const row = await dbGet('SELECT session_config FROM dm_sessions WHERE id = ?', [sessionId]);
  try { return JSON.parse(row?.session_config || '{}'); } catch { return {}; }
}
async function pcHp(pcId) {
  return (await dbGet('SELECT current_hp FROM characters WHERE id = ?', [pcId])).current_hp;
}

const gob = (name) => ({ name, maxHp: 60, armorClass: 5, attackBonus: 3, damageDice: '1d6', dexMod: 1,
  statsJson: JSON.stringify({ abilities: { str: 8, dex: 14, con: 10, int: 10, wis: 8, cha: 8 }, cr: '1/4', skills: {} }) });

group('1. Zones + reach + hidden: cross-zone melee refused, hidden companion stored');
{
  const pc = await addPc();
  const sessionId = await addSession(pc.id);
  const lyra = await addCompanion('Lyra', pc.id, {});
  const [gA] = await es.createEncounterEnemies(sessionId, 1, [gob('GobA')]);
  await ct.initializeTurnOrder(sessionId, 1, [
    { name: 'Tester', type: 'player', key: await tl.ledgerKeyForPlayer(pc.id) },
    { name: 'Lyra', type: 'companion', key: await tl.ledgerKeyForCompanion(lyra) },
    { name: 'GobA', type: 'enemy', key: `combat:${sessionId}:1:${gA.id}` },
  ]);
  const zones = await markerResult('[ZONES: Zones="arena,ridge" Edges="arena-ridge:30" Places="Tester:arena,Lyra:arena,GobA:ridge"]', pc.id, sessionId, 'ZONES');
  ok(zones && zones.success === true, 'ZONES declares arena/ridge with a 30 ft edge');
  const far = await markerResult('[ATTACK: Attacker="Player" Target="GobA"]', pc.id, sessionId, 'ATTACK');
  ok(far && far.success === false && /reach/.test(far.reason || ''), '30 ft sword swing refused for reach');
  await ct.advanceTurn(sessionId, 1); // Lyra's turn: HIDE is turn-gated
  const hide = await markerResult('[HIDE: Target="Lyra" Stealth="18"]', pc.id, sessionId, 'HIDE');
  ok(hide && hide.success === true, 'companion HIDE with Stealth override proceeds on her turn');
  const entry = await asvc.getEntry(sessionId, 1, await tl.ledgerKeyForCompanion(lyra));
  ok(entry && entry.hidden && entry.hidden.total >= 15, 'hidden.total stored in action state at/above the DC 15 bar');
  const moved = await markerResult('[MOVE: Target="Lyra" To="ridge"]', pc.id, sessionId, 'MOVE');
  ok(moved && moved.success === true, 'hidden companion can still move to the ridge (movement is not an action refusal)');
}

group('2. Grappled boss + display placement + lair as environment (not boss-gated)');
{
  const pc = await addPc();
  const sessionId = await addSession(pc.id);
  const [gA] = await es.createEncounterEnemies(sessionId, 1, [gob('GobA')]);
  await ct.initializeTurnOrder(sessionId, 1, [
    { name: 'Tester', type: 'player', key: await tl.ledgerKeyForPlayer(pc.id) },
    { name: 'GobA', type: 'enemy', key: `combat:${sessionId}:1:${gA.id}` },
  ]);
  const grappled = await markerResult('[CONDITION_ADD: Target="GobA" Condition="grappled" Grappler="Tester"]', pc.id, sessionId, 'CONDITION_ADD');
  ok(grappled && grappled.success === true, 'boss grappled with Grappler applies');
  const disp = await markerResult('[DISPLAY: Spell="Fireball" Target="floor beside GobA" Beside="GobA"]', pc.id, sessionId, 'DISPLAY');
  ok(disp && disp.success === true && disp.pending === true, 'display posts a pending placement roll');
  const c = await cfg(sessionId);
  ok(c.pendingDisplay && c.pendingDisplay.spell === 'Fireball' && c.pendingDisplay.stage === 'placement', 'pendingDisplay stored');
  const placed = await ds.applyPendingDisplay(sessionId, c.pendingDisplay.key, { outcome: 'success', takenDie: 10, total: 12 });
  ok(placed && placed.placed === true && !placed.mishap && !placed.surge, 'mid-range placement lands where meant (fabricated outcome, no live roll)');
  ok(!(await cfg(sessionId)).pendingDisplay, 'pendingDisplay cleared after resolution');
  await markerResult('[CONDITION_ADD: Target="GobA" Condition="incapacitated"]', pc.id, sessionId, 'CONDITION_ADD');
  const eCast = await markerResult('[ENEMY_CAST: Enemy="GobA" Spell="Fireball" Level=3 Target="Tester"]', pc.id, sessionId, 'ENEMY_CAST');
  ok(eCast && eCast.success === false && /incapacitated/.test(eCast.reason || ''), 'incapacitated enemy cast refused');
  // Corrected model (audit fix 2026-11-02, superseded by lair durability):
  // a lair action is the ENVIRONMENT acting, not the boss — the item-5 test
  // uses Lair="Cave". Knocking out the boss does not stop the cave, and
  // lair hazards are now durability-driven (see lair-durability.test.js),
  // not boss-gated. Legendary spend, by contrast, still refuses.
  const lair = await markerResult('[LAIR_ACTION: Lair="Cave" Effect="Tremor"]', pc.id, sessionId, 'LAIR_ACTION');
  ok(lair && lair.success === true, 'lair action still fires while boss incapacitated (environment, not boss)');
}

group('3. Damage tables + HP floor: pending trap halves on reported success, lethal delta clamps at 0');
{
  const pc = await addPc();
  const sessionId = await addSession(pc.id);
  const hpBefore = await pcHp(pc.id);
  const p = await markerResult('[HP_CHANGE: Trap="dangerous"]', pc.id, sessionId, 'HP_CHANGE');
  ok(p && p.success === true && p.pending === true && p.dc === 13, 'PC trap pends a DC 13 Dex save');
  const c1 = await cfg(sessionId);
  ok(c1.pendingTrapSave && c1.pendingTrapSave.tier === 'dangerous' && c1.pendingTrapSave.saveMode === 'half', 'pending trap effect stored with tier and mode');
  const done = await dts.applyPendingTrapSave(sessionId, c1.pendingRoll.effectKey, { total: 20, dc: 13 });
  ok(done && done.saveSuccess === true && done.applied >= 1 && done.applied <= 15, 'reported success takes half 3d10');
  ok((await pcHp(pc.id)) === hpBefore - done.applied, 'PC HP drops by exactly the halved damage');
  ok(!(await cfg(sessionId)).pendingTrapSave, 'trap slot clears after resolution');
  const low = await addPc({ current_hp: 5 });
  const s2 = await addSession(low.id);
  const lethal = await markerResult('[HP_CHANGE: delta=-999]', low.id, s2, 'HP_CHANGE');
  ok(lethal && lethal.success !== false, 'lethal HP_CHANGE dispatches');
  ok((await pcHp(low.id)) === 0, 'lethal damage clamps PC HP at 0, never below');
}

group('4. Enemy spell economy across turns + incapacitated gate (item 5 + item 6 + item 8 together)');
{
  const pc = await addPc();
  const sessionId = await addSession(pc.id);
  const [gA] = await es.createEncounterEnemies(sessionId, 1, [gob('GobA')]);
  await ct.initializeTurnOrder(sessionId, 1, [
    { name: 'Tester', type: 'player', key: await tl.ledgerKeyForPlayer(pc.id) },
    { name: 'GobA', type: 'enemy', key: `combat:${sessionId}:1:${gA.id}` },
  ]);
  const cast = await markerResult('[ENEMY_CAST: Enemy="GobA" Spell="Fireball" Level=3 Target="Tester"]', pc.id, sessionId, 'ENEMY_CAST');
  ok(cast !== null, 'ENEMY_CAST dispatches in a cross-system fight');
  await ct.advanceTurn(sessionId, 1); // GobA
  await ct.advanceTurn(sessionId, 1); // Tester, round 2
  const cast2 = await markerResult('[ENEMY_CAST: Enemy="GobA" Spell="Fireball" Level=3 Target="Tester"]', pc.id, sessionId, 'ENEMY_CAST');
  ok(cast2 !== null, 'enemy can cast again on a fresh turn (economy reset by advanceTurn)');
}

group('5. Cold + session end: wet status persists, XP defers honestly, stubs stay stubs');
{
  const pc = await addPc();
  const sessionId = await addSession(pc.id);
  const wet = await markerResult('[COLD_WET: Target="Tester" Status="wet"]', pc.id, sessionId, 'COLD_WET');
  ok(wet && wet.success === true && wet.wetStatus === 'wet', 'COLD_WET sets wet status');
  const frost = await cold.getFrostState('player', pc.id);
  ok(frost.wetStatus === 'wet', 'wet status persists in the row');
  await cold.addFrostLevel('player', pc.id, 1);
  ok((await cold.getFrostLevel('player', pc.id)) === 1, 'one frost level persists');
  const end = await ses.endSession(sessionId, { characterId: pc.id, campaignId: null });
  ok(end && end.xp && end.xp.status === 'pending_llm', 'session end without an LLM call defers XP honestly (pending_llm, no invented scores)');
  ok(end.domains && end.domains.stub === true && end.domains.turnsResolved === 0, 'domain stub still reports zero turns, not invented ones');
  ok(end.digest && end.digest.stub === true && end.digest.itemsFrozen === 0, 'digest stub still reports zero items, not invented ones');
  ok(end.sweep, 'sweep stage present in the session-end result');
}

console.log(`\naudit-cross-system: ${passed} passed, ${failed} failed`);
if (failed) process.exitCode = 1;
