// tests/item-3b-turn-ledger.test.js — combat item 3, Tier 1:
// turn ledger (migration 093), Q1 hard-refuse identity gate, Extra
// Attack / Action Surge grants, off-hand gate, Loading, Next Turn
// server state, and the PC flag fix (GWM) — real services, real DB.
// Deterministic by construction: refusals happen before dice, and
// the PC paths use reported dice, so no assert depends on a roll.
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');

const dbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dnd-item3b-'));
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
await import(svc('server/services/classFeatureService.js')); // registers ACTION_SURGE
const pipeline = await import(svc('server/services/markerPipeline.js'));

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

group('1. Pure budget decisions');
{
  ok(tl.slotKeyFor(1, 2, 0) === '1:r2:i0', 'slot key shape');
  const d = tl.attackBudgetDecision;
  ok(d({}, { extraAttacks: 0 }).allowed, 'fresh budget: first swing allowed');
  ok(!d({ attacksTaken: 1 }, { extraAttacks: 0 }).allowed, 'no Extra Attack: second swing refused');
  ok(d({ attacksTaken: 1 }, { extraAttacks: 1 }).allowed, 'Extra Attack: second swing allowed');
  ok(!d({ attacksTaken: 2 }, { extraAttacks: 1 }).allowed, 'Extra Attack: third swing refused');
  ok(d({ attacksTaken: 1, surgesSpent: 1 }, { extraAttacks: 0 }).allowed, 'surge: second action grants a second swing');
  ok(!d({ attacksTaken: 2, surgesSpent: 1 }, { extraAttacks: 0 }).allowed, 'surge: third swing refused');
  ok(!d({ loadingShots: 1 }, { extraAttacks: 1, isLoading: true }).allowed, 'Loading: second shot refused despite Extra Attack');
  ok(d({ loadingShots: 1, surgesSpent: 1 }, { extraAttacks: 1, isLoading: true }).allowed, 'Loading: surge action permits a second shot');
  ok(!d({ loadingShots: 2, surgesSpent: 1 }, { extraAttacks: 1, isLoading: true }).allowed, 'Loading: third shot refused after surge');
  const offNoMain = d({}, { hand: 'off' });
  ok(!offNoMain.allowed && /Attack action first/.test(offNoMain.reason), 'off-hand before any main-hand attack refused');
  ok(!d({ attackActionTaken: true, offHandUsed: true }, { hand: 'off' }).allowed, 'second off-hand refused');
  ok(d({ attackActionTaken: true }, { hand: 'off' }).allowed, 'off-hand after main-hand allowed');
  ok(d({ attacksTaken: 5 }, { cleave: true }).allowed, 'Cleave follow-up never consumes the swing budget');
  const block = tl.formatTurnStateBlock({ turnOrder: [{ name: 'A' }, { name: 'B' }], currentIndex: 1, currentTurn: { name: 'B' }, round: 3 });
  ok(block.includes("It is B's turn") && block.includes('Round 3') && block.includes('▶ B'), 'turn block names current combatant, round, order');
  ok(tl.formatTurnStateBlock({ turnOrder: [] }) === '', 'empty order formats to nothing');
}

group('2. Ledger + identity on a live turn order');
{
  const pc = await addPc();
  const pcKey = await wid.assignWorldId('characters', pc.id);
  const sessionId = await addSession(pc.id);
  const npcId = await insertRow('npcs', { name: 'Comp' });
  const compKey = await wid.assignWorldId('npcs', npcId);
  await ct.initializeTurnOrder(sessionId, 1, [
    { name: 'Tester', type: 'player', key: pcKey },
    { name: 'Comp', type: 'companion', key: compKey },
    { name: 'Goblin', type: 'enemy', key: 'combat:1:1:9' },
  ]);
  const row = await dbGet('SELECT turn_budget_json FROM combat_turn_state WHERE session_id = ? AND encounter_seq = ?', [sessionId, 1]);
  ok(row && row.turn_budget_json === '{}', 'fresh order starts with an empty ledger');
  const idPc = await tl.checkTurnIdentity(sessionId, 1, pcKey);
  ok(idPc.allowed, 'current combatant passes the identity gate');
  const idComp = await tl.checkTurnIdentity(sessionId, 1, compKey);
  ok(!idComp.allowed && /Out of turn/.test(idComp.reason) && /Next Turn/.test(idComp.remedy), 'out-of-turn refusal names reason + remedy');
  const idBoot = await tl.checkTurnIdentity(sessionId, 99, pcKey);
  ok(idBoot.allowed && idBoot.bootstrap, 'no turn order: bootstrap allows (identity skipped)');
  ok((await tl.getBudget(sessionId, 99, pcKey)) === null, 'no order: no budget to read');
  // Fighter 5: 2 swings. Third record refuses and leaves the count.
  const b1 = await tl.recordAttack(sessionId, 1, pcKey, { extraAttacks: 1 });
  ok(b1.attacksTaken === 1 && b1.attackActionTaken, 'first swing recorded');
  const b2 = await tl.recordAttack(sessionId, 1, pcKey, { extraAttacks: 1 });
  ok(b2.attacksTaken === 2, 'Extra Attack swing recorded');
  const b3 = await tl.recordAttack(sessionId, 1, pcKey, { extraAttacks: 1 });
  ok(b3.refused && b3.attacksTaken === 2, 'third swing refused, count unchanged');
  // Slot refresh: a full round later the same combatant is fresh.
  await tl.updateBudget(sessionId, 1, pcKey, { sneakUsed: true });
  await ct.advanceTurn(sessionId, 1);
  await ct.advanceTurn(sessionId, 1);
  await ct.advanceTurn(sessionId, 1);
  const fresh = await tl.getBudget(sessionId, 1, pcKey);
  ok(fresh && !fresh.sneakUsed && !fresh.attacksTaken, 'new slot: flags and swing count are fresh');
  const idRound2 = await tl.checkTurnIdentity(sessionId, 1, pcKey);
  ok(idRound2.allowed, 'round 2: PC is current again');
  // Legacy unkeyed order: allowed, never bricked on a guessed name.
  await ct.initializeTurnOrder(sessionId, 2, [{ name: 'Tester', type: 'player' }]);
  const idLegacy = await tl.checkTurnIdentity(sessionId, 2, pcKey);
  ok(idLegacy.allowed && idLegacy.legacyUnkeyed, 'unkeyed legacy order runs ungated');
}

group('3. Companion gates through the real attack path');
{
  const pc = await addPc({ name: 'Gate PC' });
  const sessionId = await addSession(pc.id);
  const [gob] = await es.createEncounterEnemies(sessionId, 1, [
    { name: 'Gate Goblin', maxHp: 60, armorClass: 5, attackBonus: 3, damageDice: '1d6', dexMod: 1 }
  ]);
  const fighter = await addCompanion('Gate Fighter', pc.id, {
    companion_class: 'Fighter', companion_level: 5,
    equipment: JSON.stringify({ mainHand: { name: 'Longsword' } })
  });
  const fighterKey = await wid.assignWorldId('npcs', fighter.npc_id);
  await ct.initializeTurnOrder(sessionId, 1, [
    { name: 'Gate Fighter', type: 'companion', key: fighterKey },
    { name: 'Gate Goblin', type: 'enemy', key: `combat:${sessionId}:1:${gob.id}` },
  ]);
  const e = await enemyRow(gob.id);
  const a1 = await pas.resolveCompanionAttack(sessionId, pc.id, fighter, e, {});
  ok(a1.success, 'fighter swing 1 resolves');
  const a2 = await pas.resolveCompanionAttack(sessionId, pc.id, fighter, e, {});
  ok(a2.success, 'fighter swing 2 (Extra Attack) resolves');
  const a3 = await pas.resolveCompanionAttack(sessionId, pc.id, fighter, e, {});
  ok(!a3.success && /no attacks left/.test(a3.reason), 'fighter swing 3 refused by the cap');
  // Off-hand gate: fresh companion, fresh session/encounter.
  const sessionId2 = await addSession(pc.id);
  const [gob2] = await es.createEncounterEnemies(sessionId2, 1, [
    { name: 'Off Goblin', maxHp: 60, armorClass: 5, attackBonus: 3, damageDice: '1d6', dexMod: 1 }
  ]);
  const dual = await addCompanion('Dual Wielder', pc.id, {
    companion_class: 'Fighter', companion_level: 3,
    equipment: JSON.stringify({ mainHand: { name: 'Shortsword' }, offHand: { name: 'Dagger' } })
  });
  const dualKey = await wid.assignWorldId('npcs', dual.npc_id);
  await ct.initializeTurnOrder(sessionId2, 1, [
    { name: 'Dual Wielder', type: 'companion', key: dualKey },
    { name: 'Off Goblin', type: 'enemy', key: `combat:${sessionId2}:1:${gob2.id}` },
  ]);
  const e2 = await enemyRow(gob2.id);
  const offFirst = await pas.resolveCompanionAttack(sessionId2, pc.id, dual, e2, { hand: 'off' });
  ok(!offFirst.success && /Attack action first/.test(offFirst.reason), 'off-hand before main-hand refused');
  const main = await pas.resolveCompanionAttack(sessionId2, pc.id, dual, e2, {});
  ok(main.success, 'main-hand attack resolves');
  const off = await pas.resolveCompanionAttack(sessionId2, pc.id, dual, e2, { hand: 'off' });
  ok(off.success, 'off-hand after main-hand resolves');
  const offAgain = await pas.resolveCompanionAttack(sessionId2, pc.id, dual, e2, { hand: 'off' });
  ok(!offAgain.success && /already been used/.test(offAgain.reason), 'second off-hand refused');
  // Loading gate + surge grant.
  const sessionId3 = await addSession(pc.id);
  const [gob3] = await es.createEncounterEnemies(sessionId3, 1, [
    { name: 'Load Goblin', maxHp: 60, armorClass: 5, attackBonus: 3, damageDice: '1d6', dexMod: 1 }
  ]);
  // Light Crossbow is an ammunition weapon (item 1: zero ammo = hard
  // refuse), so the test fighter must carry bolts — otherwise shot 1
  // fails on ammo, not on Loading, and masks the gate under test.
  const cross = await addCompanion('Crossbow Fighter', pc.id, {
    companion_class: 'Fighter', companion_level: 5,
    equipment: JSON.stringify({ mainHand: { name: 'Light Crossbow' } }),
    inventory: JSON.stringify([{ name: 'Bolts', quantity: 10 }])
  });
  const crossKey = await wid.assignWorldId('npcs', cross.npc_id);
  await ct.initializeTurnOrder(sessionId3, 1, [
    { name: 'Crossbow Fighter', type: 'companion', key: crossKey },
    { name: 'Load Goblin', type: 'enemy', key: `combat:${sessionId3}:1:${gob3.id}` },
  ]);
  const e3 = await enemyRow(gob3.id);
  const s1 = await pas.resolveCompanionAttack(sessionId3, pc.id, cross, e3, {});
  ok(s1.success, 'crossbow shot 1 resolves');
  const s2 = await pas.resolveCompanionAttack(sessionId3, pc.id, cross, e3, {});
  ok(!s2.success && /Loading/.test(s2.reason), 'crossbow shot 2 refused by Loading despite Extra Attack');
  const surges = await tl.recordSurge(sessionId3, 1, crossKey);
  ok(surges === 1, 'surge recorded in the ledger');
  const s3 = await pas.resolveCompanionAttack(sessionId3, pc.id, cross, e3, {});
  ok(s3.success, 'surge action permits a second Loading shot');
  const s4 = await pas.resolveCompanionAttack(sessionId3, pc.id, cross, e3, {});
  ok(!s4.success && /Loading/.test(s4.reason), 'third Loading shot refused after surge');
  // Reaction exemption: enemy's turn, companion reaction fires.
  const sessionId4 = await addSession(pc.id);
  const [gob4] = await es.createEncounterEnemies(sessionId4, 1, [
    { name: 'React Goblin', maxHp: 60, armorClass: 5, attackBonus: 3, damageDice: '1d6', dexMod: 1 }
  ]);
  const react = await addCompanion('Reactive', pc.id, {
    companion_class: 'Fighter', companion_level: 3,
    equipment: JSON.stringify({ mainHand: { name: 'Longsword' } })
  });
  const reactKey = await wid.assignWorldId('npcs', react.npc_id);
  await ct.initializeTurnOrder(sessionId4, 1, [
    { name: 'React Goblin', type: 'enemy', key: `combat:${sessionId4}:1:${gob4.id}` },
    { name: 'Reactive', type: 'companion', key: reactKey },
  ]);
  const e4 = await enemyRow(gob4.id);
  const normal = await pas.resolveCompanionAttack(sessionId4, pc.id, react, e4, {});
  ok(!normal.success && /Out of turn/.test(normal.reason), 'non-reaction attack on the enemy turn refused');
  const reacted = await pas.resolveCompanionAttack(sessionId4, pc.id, react, e4, { reaction: true });
  ok(reacted.success, 'reaction attack on the enemy turn resolves (exempt)');
}

group('4. PC reported-dice paths: Sneak pinning + GWM gate');
{
  const rogue = await addPc({ name: 'Sneak PC', class: 'Rogue', level: 3,
    equipment: JSON.stringify({ mainHand: { name: 'Dagger' } }) });
  const rogueKey = await wid.assignWorldId('characters', rogue.id);
  const sessionId = await addSession(rogue.id);
  const [gob] = await es.createEncounterEnemies(sessionId, 1, [
    { name: 'Sneak Goblin', maxHp: 60, armorClass: 5, attackBonus: 3, damageDice: '1d6', dexMod: 1 }
  ]);
  await ct.initializeTurnOrder(sessionId, 1, [
    { name: 'Sneak PC', type: 'player', key: rogueKey },
    { name: 'Sneak Goblin', type: 'enemy', key: `combat:${sessionId}:1:${gob.id}` },
  ]);
  const e = await enemyRow(gob.id);
  // Declare on the rogue's turn (slot A), report two slots later:
  // the flag must land on slot A, not on the report-time slot.
  const p1 = await pas.createPcPendingAttack(sessionId, rogue.id, rogue, e, { allyAdjacent: true });
  ok(p1.pending && p1.pending.sneakDice, 'rogue pending carries sneak dice');
  ok(p1.pending.slotKey, 'pending pins its declaration slot');
  await ct.advanceTurn(sessionId, 1);
  await ct.advanceTurn(sessionId, 1);
  const r1 = await pas.resolveReportedAttack(sessionId, rogue.id, [15], 10);
  ok(r1 && r1.sneakAttack && r1.sneakAttack.applied === true, 'reported hit applies sneak (slot A)');
  const p2 = await pas.createPcPendingAttack(sessionId, rogue.id, rogue, e, { allyAdjacent: true });
  ok(!p2.error, 'second declaration on the fresh slot is allowed');
  const r2 = await pas.resolveReportedAttack(sessionId, rogue.id, [15], 10);
  ok(r2 && r2.sneakAttack && r2.sneakAttack.applied === true, 'sneak is fresh on the new slot despite the pinned report');
  // Same-slot double sneak denied.
  const p3 = await pas.createPcPendingAttack(sessionId, rogue.id, rogue, e, { allyAdjacent: true });
  ok(p3.error && /no attacks left/.test(p3.error), 'rogue has no second swing to declare this turn');
  // GWM: fighter PC, Maul, feat — first hit applies, second denied.
  const fighter = await addPc({ name: 'GWM PC', class: 'Fighter', level: 5,
    feats: JSON.stringify(['Great Weapon Master']),
    equipment: JSON.stringify({ mainHand: { name: 'Maul' } }) });
  const fighterKey = await wid.assignWorldId('characters', fighter.id);
  const sessionId2 = await addSession(fighter.id);
  const [gob2] = await es.createEncounterEnemies(sessionId2, 1, [
    { name: 'GWM Goblin', maxHp: 60, armorClass: 5, attackBonus: 3, damageDice: '1d6', dexMod: 1 }
  ]);
  await ct.initializeTurnOrder(sessionId2, 1, [
    { name: 'GWM PC', type: 'player', key: fighterKey },
    { name: 'GWM Goblin', type: 'enemy', key: `combat:${sessionId2}:1:${gob2.id}` },
  ]);
  const e2 = await enemyRow(gob2.id);
  const g1 = await pas.createPcPendingAttack(sessionId2, fighter.id, fighter, e2, {});
  ok(g1.pending && g1.pending.gwmBonus != null, 'GWM pending carries the bonus');
  const gr1 = await pas.resolveReportedAttack(sessionId2, fighter.id, [15], 10);
  ok(gr1 && gr1.gwm && gr1.gwm.applied === true, 'first GWM hit applies');
  const g2 = await pas.createPcPendingAttack(sessionId2, fighter.id, fighter, e2, {});
  ok(!g2.error, 'fighter second swing (Extra Attack) declares');
  const gr2 = await pas.resolveReportedAttack(sessionId2, fighter.id, [15], 10);
  ok(gr2 && gr2.gwm && gr2.gwm.applied === false, 'second GWM hit this turn denied');
}

group('5. ACTION_SURGE marker end to end');
{
  const fighter = await addPc({ name: 'Surge PC', class: 'Fighter', level: 5 });
  const fighterKey = await wid.assignWorldId('characters', fighter.id);
  const sessionId = await addSession(fighter.id);
  const [gob] = await es.createEncounterEnemies(sessionId, 1, [
    { name: 'Surge Goblin', maxHp: 60, armorClass: 5, attackBonus: 3, damageDice: '1d6', dexMod: 1 }
  ]);
  await ct.initializeTurnOrder(sessionId, 1, [
    { name: 'Surge PC', type: 'player', key: fighterKey },
    { name: 'Surge Goblin', type: 'enemy', key: `combat:${sessionId}:1:${gob.id}` },
  ]);
  const d1 = await pipeline.processResponseMarkers('[ACTION_SURGE: Target="Surge PC"]', { characterId: fighter.id, sessionId });
  const h1 = d1.handlerResults.filter((hr) => hr.schemaKey === 'ACTION_SURGE');
  ok(h1.length === 1 && h1[0].ok && h1[0].result.success && h1[0].result.usesUsed === 1, 'surge marker spends use 1');
  const budget = await tl.getBudget(sessionId, 1, fighterKey);
  ok(budget && budget.surgesSpent === 1, 'surge lands in the turn ledger');
  const d2 = await pipeline.processResponseMarkers('[ACTION_SURGE: Target="Surge PC"]', { characterId: fighter.id, sessionId });
  const h2 = d2.handlerResults.filter((hr) => hr.schemaKey === 'ACTION_SURGE');
  ok(h2.length === 1 && h2[0].result.success === false, 'second surge refused: fighter 5 has one use');
  const d3 = await pipeline.processResponseMarkers('[ACTION_SURGE: Target="Surge PC"]', { characterId: fighter.id, sessionId });
  ok(d3.handlerResults.filter((hr) => hr.schemaKey === 'ACTION_SURGE').length === 1, 'schema dispatches the marker (no silent drop)');
  const rogue = await addPc({ name: 'NoSurge PC', class: 'Rogue', level: 5 });
  const d4 = await pipeline.processResponseMarkers('[ACTION_SURGE: Target="NoSurge PC"]', { characterId: rogue.id, sessionId });
  const h4 = d4.handlerResults.filter((hr) => hr.schemaKey === 'ACTION_SURGE');
  ok(h4.length === 1 && h4[0].result.success === false && /not a fighter/.test(h4[0].result.reason), 'non-fighter surge refused');
}

console.log('Results: ' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
