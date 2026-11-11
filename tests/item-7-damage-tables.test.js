// tests/item-7-damage-tables.test.js — combat item 7, declared damage
// tables: falls, traps, and hazards roll in the engine instead of the
// DM inventing a number. Real services, real DB. Assertions never depend
// on a roll: damage ranges, half/full relationships, budgets, reasons,
// and flags are asserted — never a save outcome or a rolled total,
// except where the test itself supplies the reported total.
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');

const dbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dnd-item7-'));
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
const ld = await import(svc('server/services/lastDamageService.js'));
const dts = await import(svc('server/services/damageTableService.js'));
const rr = await import(svc('server/services/rollRequestService.js'));
const pipeline = await import(svc('server/services/markerPipeline.js'));
await import(svc('server/services/combatMarkerService.js')); // registers combat markers
await import(svc('server/services/characterHpService.js')); // registers HP_CHANGE
await import(svc('server/services/rollRequestService.js')); // registers ROLL_REQUEST

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
  return (await dbGet('SELECT current_hp FROM characters WHERE id = ?', [pcId]))?.current_hp;
}

async function compHp(compId) {
  return (await dbGet('SELECT companion_current_hp FROM companions WHERE id = ?', [compId]))?.companion_current_hp;
}

async function enemyHp(enemyRowId) {
  return (await dbGet('SELECT current_hp FROM combat_enemies WHERE id = ?', [enemyRowId]))?.current_hp;
}

const gob = (name) => ({ name, maxHp: 60, armorClass: 5, attackBonus: 3, damageDice: '1d6', dexMod: 1 });

async function order(sessionId, entries) {
  await ct.initializeTurnOrder(sessionId, 1, entries);
}
async function pcKey(pc) { return tl.ledgerKeyForPlayer(pc.id); }
async function compKey(comp) { return tl.ledgerKeyForCompanion(comp); }
function enemyKey(sessionId, row) { return `combat:${sessionId}:1:${row.id}`; }

group('1. Pure table math: fall dice, trap tiers, hazard table, cause resolution');
{
  ok(dts.fallDiceForFeet(0).count === 0, '0 ft falls 0 dice');
  ok(dts.fallDiceForFeet(9).count === 0, '9 ft falls 0 dice');
  ok(dts.fallDiceForFeet(10).dice === '1d6', '10 ft falls 1d6');
  ok(dts.fallDiceForFeet(30).dice === '3d6', '30 ft falls 3d6');
  ok(dts.fallDiceForFeet(250).count === 20, 'fall dice cap at 20d6');
  ok(dts.fallDiceForFeet(30).type === 'bludgeoning', 'falls are bludgeoning');
  const setback = dts.trapTierSpec('setback');
  ok(setback && setback.dc === 11 && setback.dice === '1d10', 'setback is 1d10 vs DC 11');
  const dangerous = dts.trapTierSpec('DANGEROUS');
  ok(dangerous && dangerous.dc === 13 && dangerous.dice === '3d10', 'tier names are case-insensitive');
  const deadly = dts.trapTierSpec('deadly');
  ok(deadly && deadly.dc === 16 && deadly.dice === '6d10', 'deadly is 6d10 vs DC 16');
  ok(dts.trapTierSpec('pit trap') === null, 'a trap name is not a tier');
  const fire = dts.hazardSpec('fire', 'moderate');
  ok(fire && fire.dice === '3d6' && fire.type === 'fire', 'fire moderate is 3d6 fire');
  ok(dts.hazardSpec('fire', 'extreme') === null, 'unknown severity is no entry');
  ok(dts.hazardSpec('quicksand', 'minor') === null, 'unknown hazard is no entry');
  ok(dts.resolveTableCause({}) === null, 'no table field means legacy path');
  const neg = dts.resolveTableCause({ fall: -5 });
  ok(neg && neg.refusal && /feet/.test(neg.refusal.remedy), 'negative fall refused with remedy');
  const badTier = dts.resolveTableCause({ trap: 'Pit trap' });
  ok(badTier && badTier.refusal && /setback/.test(badTier.refusal.remedy), 'trap name refused with tier remedy');
  const badSave = dts.resolveTableCause({ trap: 'dangerous', save: 'full' });
  ok(badSave && badSave.refusal, 'unknown trap save mode refused');
  const cold = dts.resolveTableCause({ hazard: 'cold', severity: 'moderate' });
  ok(cold && cold.refusal && /cold system/.test(cold.refusal.reason), 'cold refused toward the cold system');
  const flagged = dts.resolveTableCause({ hazard: 'quicksand', amount: 7 });
  ok(flagged && flagged.flagged === true && flagged.amount === 7 && flagged.type === null, 'unknown hazard with amount is flagged declared, untyped');
  const flaggedFire = dts.resolveTableCause({ hazard: 'fire', amount: 7 });
  ok(flaggedFire && flaggedFire.flagged === true && flaggedFire.type === 'fire', 'known hazard with amount keeps its type, flagged');
  const noAmt = dts.resolveTableCause({ hazard: 'fire' });
  ok(noAmt && noAmt.refusal && /Severity/.test(noAmt.refusal.remedy), 'hazard without severity or amount refused with remedy');
}

group('2. Falls: enemy, PC, companion, short fall, legacy paths unchanged');
{
  const pc = await addPc();
  const sessionId = await addSession(pc.id);
  const lyra = await addCompanion('Lyra', pc.id, {});
  const [g] = await es.createEncounterEnemies(sessionId, 1, [gob('GobA')]);
  await order(sessionId, [
    { name: 'Tester', type: 'player', key: await pcKey(pc) },
    { name: 'Lyra', type: 'companion', key: await compKey(lyra) },
    { name: 'GobA', type: 'enemy', key: enemyKey(sessionId, g) },
  ]);
  const gobBefore = await enemyHp(g.id);
  const r = await markerResult('[ENEMY_DAMAGE: Enemy="GobA" Fall=30]', pc.id, sessionId, 'ENEMY_DAMAGE');
  ok(r && r.success === true && r.cause === 'fall', 'enemy fall resolves as a fall');
  ok(r.applied >= 3 && r.applied <= 18, 'enemy fall damage is 3d6 range');
  ok((await enemyHp(g.id)) === gobBefore - r.applied, 'enemy HP drops by exactly the fall damage');
  const rec = await ld.peekDamage(sessionId, 'enemy', g.id);
  ok(rec && rec.type === 'bludgeoning' && rec.attackerKind == null, 'enemy fall records bludgeoning, unattributed');
  const pcBefore = await pcHp(pc.id);
  const p = await markerResult('[HP_CHANGE: Fall=30]', pc.id, sessionId, 'HP_CHANGE');
  ok(p && p.success === true && p.cause === 'fall' && p.applied >= 3 && p.applied <= 18, 'PC fall is 3d6 range');
  ok((await pcHp(pc.id)) === pcBefore - p.applied, 'PC HP drops by exactly the fall damage');
  const prec = await ld.peekDamage(sessionId, 'player', pc.id);
  ok(prec && prec.type === 'bludgeoning' && prec.attackerKind == null, 'PC fall records bludgeoning, unattributed');
  const lyraBefore = await compHp(lyra.id);
  const c = await markerResult('[HP_CHANGE: Target="Lyra" Fall=20]', pc.id, sessionId, 'HP_CHANGE');
  ok(c && c.success === true && c.applied >= 2 && c.applied <= 12, 'companion fall is 2d6 range');
  ok((await compHp(lyra.id)) === lyraBefore - c.applied, 'companion HP drops by exactly the fall damage');
  const short = await markerResult('[HP_CHANGE: Fall=5]', pc.id, sessionId, 'HP_CHANGE');
  ok(short && short.success === true && short.applied === 0, 'a fall under 10 ft deals 0');
  const unk = await markerResult('[HP_CHANGE: Target="Nobody" Fall=30]', pc.id, sessionId, 'HP_CHANGE');
  ok(unk && unk.success === false, 'unknown companion target refused');
  const legacy = await markerResult('[ENEMY_DAMAGE: Enemy="GobA" Amount=8]', pc.id, sessionId, 'ENEMY_DAMAGE');
  ok(legacy && legacy.damageDealt === 8, 'legacy declared enemy damage unchanged');
  const lrec = await ld.peekDamage(sessionId, 'enemy', g.id);
  ok(lrec && lrec.attackerKind === 'player', 'legacy declared damage stays player-dealt');
  const lpcBefore = await pcHp(pc.id);
  const lpc = await markerResult('[HP_CHANGE: delta=-5]', pc.id, sessionId, 'HP_CHANGE');
  ok(lpc && lpc.applied === true && (await pcHp(pc.id)) === lpcBefore - 5, 'legacy declared PC delta unchanged');
  const beats = await markerResult('[ENEMY_DAMAGE: Enemy="GobA" Amount=8 Fall=30]', pc.id, sessionId, 'ENEMY_DAMAGE');
  ok(beats && beats.cause === 'fall' && beats.applied >= 3 && beats.applied <= 18, 'a table field beats a declared amount');
}

group('3. Traps on enemies: save full/half/avoid/none, type override, refusals');
{
  const pc = await addPc();
  const sessionId = await addSession(pc.id);
  const [g] = await es.createEncounterEnemies(sessionId, 1, [gob('GobA')]);
  await order(sessionId, [
    { name: 'Tester', type: 'player', key: await pcKey(pc) },
    { name: 'GobA', type: 'enemy', key: enemyKey(sessionId, g) },
  ]);
  const r = await markerResult('[ENEMY_DAMAGE: Enemy="GobA" Trap="dangerous"]', pc.id, sessionId, 'ENEMY_DAMAGE');
  ok(r && r.success === true && r.saveSuccess !== null, 'enemy trap rolls a save');
  ok(r.applied >= 1 && r.applied <= 30, 'enemy trap damage is full-or-half 3d10');
  const rec = await ld.peekDamage(sessionId, 'enemy', g.id);
  ok(rec && rec.type === 'bludgeoning' && rec.attackerKind == null, 'enemy trap records bludgeoning, unattributed');
  const n = await markerResult('[ENEMY_DAMAGE: Enemy="GobA" Trap="dangerous" Save="none"]', pc.id, sessionId, 'ENEMY_DAMAGE');
  ok(n && n.success === true && n.saveSuccess === null && n.applied >= 3 && n.applied <= 30, 'Save=none deals full 3d10, no save');
  const a = await markerResult('[ENEMY_DAMAGE: Enemy="GobA" Trap="setback" Save="avoid"]', pc.id, sessionId, 'ENEMY_DAMAGE');
  ok(a && a.success === true && (a.applied === 0 || (a.applied >= 1 && a.applied <= 10)), 'Save=avoid deals 0 or full 1d10');
  const f = await markerResult('[ENEMY_DAMAGE: Enemy="GobA" Trap="dangerous" Type="fire"]', pc.id, sessionId, 'ENEMY_DAMAGE');
  ok(f && f.success === true, 'trap with a type override resolves');
  const frec = await ld.peekDamage(sessionId, 'enemy', g.id);
  ok(frec && frec.type === 'fire', 'type override lands on the record');
  const bad = await markerResult('[ENEMY_DAMAGE: Enemy="GobA" Trap="Pit trap"]', pc.id, sessionId, 'ENEMY_DAMAGE');
  ok(bad && bad.success === false && /setback/.test(bad.remedy || ''), 'trap name refused with tier remedy');
}

group('4. Traps on the PC: pending save, reported full/half/none, no-save immediate');
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
  const c2 = await cfg(sessionId);
  ok(!c2.pendingTrapSave, 'trap slot clears after resolution');
  const p2 = await markerResult('[HP_CHANGE: Trap="dangerous"]', pc.id, sessionId, 'HP_CHANGE');
  ok(p2 && p2.pending === true, 'second PC trap pends again');
  const c3 = await cfg(sessionId);
  const done2 = await dts.applyPendingTrapSave(sessionId, c3.pendingRoll.effectKey, { total: 2, dc: 13 });
  ok(done2 && done2.saveSuccess === false && done2.applied >= 3 && done2.applied <= 30, 'reported failure takes full 3d10');
  const p3 = await markerResult('[HP_CHANGE: Trap="setback" Save="avoid"]', pc.id, sessionId, 'HP_CHANGE');
  ok(p3 && p3.pending === true && p3.saveMode === 'avoid', 'avoid-mode PC trap pends');
  const c4 = await cfg(sessionId);
  const done3 = await dts.applyPendingTrapSave(sessionId, c4.pendingRoll.effectKey, { total: 20, dc: 11 });
  ok(done3 && done3.saveSuccess === true && done3.applied === 0, 'avoid-mode success takes none');
  const hpBefore4 = await pcHp(pc.id);
  const p4 = await markerResult('[HP_CHANGE: Trap="dangerous" Save="none"]', pc.id, sessionId, 'HP_CHANGE');
  ok(p4 && p4.success === true && !p4.pending && p4.applied >= 3 && p4.applied <= 30, 'no-save PC trap applies immediately, full 3d10');
  ok((await pcHp(pc.id)) === hpBefore4 - p4.applied, 'PC HP drops by exactly the no-save damage');
  const wrong = await dts.applyPendingTrapSave(sessionId, 'no-such-key', { total: 20, dc: 13 });
  ok(wrong === false, 'an unmatched effect key resolves nothing');
}

group('5. Traps on companions: server save, full-or-half, unknown target');
{
  const pc = await addPc();
  const sessionId = await addSession(pc.id);
  const lyra = await addCompanion('Lyra', pc.id, {});
  const before = await compHp(lyra.id);
  const r = await markerResult('[HP_CHANGE: Target="Lyra" Trap="dangerous"]', pc.id, sessionId, 'HP_CHANGE');
  ok(r && r.success === true && r.saveSuccess !== null && r.applied >= 1 && r.applied <= 30, 'companion trap is full-or-half 3d10');
  ok((await compHp(lyra.id)) === before - r.applied, 'companion HP drops by exactly the trap damage');
  const rec = await ld.peekDamage(sessionId, 'companion', lyra.id);
  ok(rec && rec.type === 'bludgeoning' && rec.attackerKind == null, 'companion trap records bludgeoning, unattributed');
}

group('6. Hazards: table rolls, flagged declared, cold refusal');
{
  const pc = await addPc();
  const sessionId = await addSession(pc.id);
  const [g] = await es.createEncounterEnemies(sessionId, 1, [gob('GobA')]);
  await order(sessionId, [
    { name: 'Tester', type: 'player', key: await pcKey(pc) },
    { name: 'GobA', type: 'enemy', key: enemyKey(sessionId, g) },
  ]);
  const r = await markerResult('[ENEMY_DAMAGE: Enemy="GobA" Hazard="fire" Severity="moderate"]', pc.id, sessionId, 'ENEMY_DAMAGE');
  ok(r && r.success === true && r.cause === 'hazard' && r.applied >= 3 && r.applied <= 18, 'fire moderate is 3d6 range');
  const rec = await ld.peekDamage(sessionId, 'enemy', g.id);
  ok(rec && rec.type === 'fire' && rec.attackerKind == null, 'hazard records its element, unattributed');
  const pcBefore = await pcHp(pc.id);
  const p = await markerResult('[HP_CHANGE: Hazard="acid" Severity="minor"]', pc.id, sessionId, 'HP_CHANGE');
  ok(p && p.success === true && p.applied >= 1 && p.applied <= 6, 'PC acid minor is 1d6 range');
  ok((await pcHp(pc.id)) === pcBefore - p.applied, 'PC HP drops by exactly the hazard damage');
  const f = await markerResult('[ENEMY_DAMAGE: Enemy="GobA" Hazard="quicksand" Amount=7]', pc.id, sessionId, 'ENEMY_DAMAGE');
  ok(f && f.success === true && f.flagged === true && f.applied === 7, 'unknown hazard with amount is flagged declared, exact');
  const ff = await markerResult('[ENEMY_DAMAGE: Enemy="GobA" Hazard="fire" Amount=7]', pc.id, sessionId, 'ENEMY_DAMAGE');
  ok(ff && ff.success === true && ff.flagged === true && ff.applied === 7, 'known hazard without severity is flagged declared');
  const cold = await markerResult('[ENEMY_DAMAGE: Enemy="GobA" Hazard="cold" Severity="moderate"]', pc.id, sessionId, 'ENEMY_DAMAGE');
  ok(cold && cold.success === false && /cold system/.test(cold.reason || ''), 'cold hazard refused toward the cold system');
  const noSev = await markerResult('[ENEMY_DAMAGE: Enemy="GobA" Hazard="fire"]', pc.id, sessionId, 'ENEMY_DAMAGE');
  ok(noSev && noSev.success === false && /Severity/.test(noSev.remedy || ''), 'hazard without severity or amount refused with remedy');
}

group('7. Single pending slot: a new roll clears a pending trap save');
{
  const pc = await addPc();
  const sessionId = await addSession(pc.id);
  const p = await markerResult('[HP_CHANGE: Trap="dangerous"]', pc.id, sessionId, 'HP_CHANGE');
  ok(p && p.pending === true, 'trap save pends');
  const c1 = await cfg(sessionId);
  ok(!!c1.pendingTrapSave, 'trap slot set');
  const r = await rr.requestPcRoll({ sessionId, characterId: pc.id, kind: 'save', name: 'Dexterity', dc: 10 });
  ok(r && r.success === true, 'a new roll request posts');
  const c2 = await cfg(sessionId);
  ok(!c2.pendingTrapSave, 'the new roll clears the pending trap save');
}

console.log(`Results: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
