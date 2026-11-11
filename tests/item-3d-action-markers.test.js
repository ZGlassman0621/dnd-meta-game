// tests/item-3d-action-markers.test.js — combat item 3, Tier 3:
// Dodge / Disengage / Help / Hide / Ready v1 markers + effects.
// Real services, real DB. Deterministic by construction: companion
// attacks use AC 5 targets (a miss is only a nat 1), PC paths use
// reported dice, and mode assertions never depend on a roll.
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');

const dbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dnd-item3d-'));
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
const ast = await import(svc('server/services/actionStateService.js'));
const rs = await import(svc('server/services/reactionService.js'));
const scs = await import(svc('server/services/spellCastService.js'));
const pipeline = await import(svc('server/services/markerPipeline.js'));
await import(svc('server/services/combatMarkerService.js')); // registers DODGE / DISENGAGE / HELP / HIDE / READY / OA
const rrs = await import(svc('server/services/rollRequestService.js')); // registers ROLL_REQUEST + HELP_CHECK

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

group('1. Dodge state expires at the setter next turn');
{
  const pc = await addPc();
  const sessionId = await addSession(pc.id);
  const [goblin] = await es.createEncounterEnemies(sessionId, 1, [gob('Dodge Goblin')]);
  const dodger = await addCompanion('Dodger', pc.id, {
    companion_class: 'Fighter', companion_level: 3,
    equipment: JSON.stringify({ mainHand: { name: 'Longsword' } })
  });
  const key = await wid.assignWorldId('npcs', dodger.npc_id);
  await ct.initializeTurnOrder(sessionId, 1, [
    { name: 'Dodger', type: 'companion', key },
    { name: 'Dodge Goblin', type: 'enemy', key: `combat:${sessionId}:1:${goblin.id}` },
  ]);
  const d = await markerResult('[DODGE: Target="Dodger"]', pc.id, sessionId, 'DODGE');
  ok(d && d.success === true, 'dodge marker succeeds on the dodger turn');
  ok((await ast.getEntry(sessionId, 1, key)).dodge, 'dodge state is set');
  await ct.advanceTurn(sessionId, 1); // Goblin turn: dodge still live.
  ok((await ast.getEntry(sessionId, 1, key)).dodge, 'dodge survives intervening turns');
  await ct.advanceTurn(sessionId, 1); // Back to Dodger: next turn starts.
  ok(!(await ast.getEntry(sessionId, 1, key)).dodge, 'dodge expires at the start of the dodger next turn');
}

group('2. Dodge effects: party attacks, enemy attacks, DEX saves');
{
  const pc = await addPc();
  const sessionId = await addSession(pc.id);
  const [goblin] = await es.createEncounterEnemies(sessionId, 1, [gob('Dodge Goblin 2')]);
  const fighter = await addCompanion('Dodgy', pc.id, {
    companion_class: 'Fighter', companion_level: 3,
    equipment: JSON.stringify({ mainHand: { name: 'Longsword' } })
  });
  const key = await wid.assignWorldId('npcs', fighter.npc_id);
  await ct.initializeTurnOrder(sessionId, 1, [
    { name: 'Dodgy', type: 'companion', key },
    { name: 'Dodge Goblin 2', type: 'enemy', key: `combat:${sessionId}:1:${goblin.id}` },
  ]);
  // Enemy dodges (DM-governed: no identity gate even off its turn).
  const ed = await markerResult('[DODGE: Target="Dodge Goblin 2"]', pc.id, sessionId, 'DODGE');
  ok(ed && ed.success === true, 'enemy dodge marker succeeds');
  const e = await enemyRow(goblin.id);
  const atk = await pas.resolveCompanionAttack(sessionId, pc.id, fighter, e, {});
  ok(atk.success && atk.mode === 'disadvantage' && atk.dice.length === 2, 'party attack vs a dodging enemy rolls at disadvantage');
  // Party member dodges: enemy attacks at disadvantage.
  const d = await markerResult('[DODGE: Target="Dodgy"]', pc.id, sessionId, 'DODGE');
  ok(d && d.success === true, 'party dodge marker succeeds');
  const ea = await es.resolveEnemyAttack(sessionId, 1, 'Dodge Goblin 2', { type: 'companion', id: fighter.id, armorClass: 14 });
  ok(ea && ea.attackMode === 'disadvantage' && ea.attackRolls.length === 2, 'enemy attack vs a dodging party member rolls at disadvantage');
  // Dodging enemy rolls DEX saves with advantage.
  const cleric = await addCompanion('Clericy', pc.id, {
    companion_class: 'Cleric', companion_level: 3,
    companion_ability_scores: JSON.stringify({ str: 10, dex: 12, con: 14, int: 10, wis: 16, cha: 12 }),
    equipment: JSON.stringify({})
  });
  const save = await scs.resolveSpellSave({ sessionId, casterCharacterId: pc.id, casterKind: 'companion', casterRow: cleric, spellName: 'Sacred Flame', targetName: 'Dodge Goblin 2' });
  ok(save && save.dice.length === 2 && save.takenDie === Math.max(...save.dice), 'dodging enemy rolls its DEX save with advantage');
}

group('3. Disengage refuses the OA without burning the reaction');
{
  const pc = await addPc();
  const sessionId = await addSession(pc.id);
  const [goblin] = await es.createEncounterEnemies(sessionId, 1, [gob('OA Goblin')]);
  const mover = await addCompanion('Mover', pc.id, {
    companion_class: 'Fighter', companion_level: 3,
    equipment: JSON.stringify({ mainHand: { name: 'Longsword' } })
  });
  const key = await wid.assignWorldId('npcs', mover.npc_id);
  await ct.initializeTurnOrder(sessionId, 1, [
    { name: 'Mover', type: 'companion', key },
    { name: 'OA Goblin', type: 'enemy', key: `combat:${sessionId}:1:${goblin.id}` },
  ]);
  const dis = await markerResult('[DISENGAGE: Target="Mover"]', pc.id, sessionId, 'DISENGAGE');
  ok(dis && dis.success === true, 'disengage marker succeeds');
  const oa = await markerResult('[OPPORTUNITY_ATTACK: Attacker="OA Goblin" Target="Mover"]', pc.id, sessionId, 'OPPORTUNITY_ATTACK');
  ok(oa && oa.success === false && /Disengaged/.test(oa.reason) && oa.reactionConsumed === false, 'OA against a Disengaged mover refused, reaction untouched');
  ok(await rs.hasReactionAvailable(sessionId, 1, 'OA Goblin'), 'goblin reaction still available after the refused OA');
  await ct.advanceTurn(sessionId, 1); // Goblin turn.
  await ct.advanceTurn(sessionId, 1); // Back to Mover: disengage expired.
  ok(!(await ast.getEntry(sessionId, 1, key)).disengage, 'disengage expired at the mover next turn');
  const oa2 = await markerResult('[OPPORTUNITY_ATTACK: Attacker="OA Goblin" Target="Mover"]', pc.id, sessionId, 'OPPORTUNITY_ATTACK');
  ok(oa2 && oa2.success === true && oa2.reactionConsumed === true && oa2.attack && typeof oa2.attack.hit === 'boolean', 'OA resolves normally once Disengage has expired');
}

group('4. Help: advantage once, then consumed; expiry at the helper next turn');
{
  const pc = await addPc();
  // Consumption case.
  const sessionId = await addSession(pc.id);
  const [goblin] = await es.createEncounterEnemies(sessionId, 1, [gob('Help Goblin')]);
  const helper = await addCompanion('Helper', pc.id, {
    companion_class: 'Fighter', companion_level: 3,
    equipment: JSON.stringify({ mainHand: { name: 'Longsword' } })
  });
  const ally = await addCompanion('Ally', pc.id, {
    companion_class: 'Fighter', companion_level: 3,
    equipment: JSON.stringify({ mainHand: { name: 'Longsword' } })
  });
  const helperKey = await wid.assignWorldId('npcs', helper.npc_id);
  const allyKey = await wid.assignWorldId('npcs', ally.npc_id);
  await ct.initializeTurnOrder(sessionId, 1, [
    { name: 'Helper', type: 'companion', key: helperKey },
    { name: 'Ally', type: 'companion', key: allyKey },
    { name: 'Help Goblin', type: 'enemy', key: `combat:${sessionId}:1:${goblin.id}` },
  ]);
  const h = await markerResult('[HELP: Helper="Helper" Target="Help Goblin" Ally="Ally"]', pc.id, sessionId, 'HELP');
  ok(h && h.success === true && h.ally === 'Ally', 'help marker succeeds');
  await ct.advanceTurn(sessionId, 1); // Ally turn.
  const e = await enemyRow(goblin.id);
  const helped = await pas.resolveCompanionAttack(sessionId, pc.id, ally, e, {});
  ok(helped.success && helped.mode === 'advantage' && helped.dice.length === 2, 'helped ally attacks at advantage');
  // Expiry case, fresh session: grant, then a full round with no
  // ally attack — the help is gone by the helper's next turn.
  const sessionId2 = await addSession(pc.id);
  const [goblin2] = await es.createEncounterEnemies(sessionId2, 1, [gob('Help Goblin 2')]);
  const helper2 = await addCompanion('Helper2', pc.id, {
    companion_class: 'Fighter', companion_level: 3,
    equipment: JSON.stringify({ mainHand: { name: 'Longsword' } })
  });
  const ally2 = await addCompanion('Ally2', pc.id, {
    companion_class: 'Fighter', companion_level: 3,
    equipment: JSON.stringify({ mainHand: { name: 'Longsword' } })
  });
  const helperKey2 = await wid.assignWorldId('npcs', helper2.npc_id);
  const allyKey2 = await wid.assignWorldId('npcs', ally2.npc_id);
  await ct.initializeTurnOrder(sessionId2, 1, [
    { name: 'Helper2', type: 'companion', key: helperKey2 },
    { name: 'Ally2', type: 'companion', key: allyKey2 },
    { name: 'Help Goblin 2', type: 'enemy', key: `combat:${sessionId2}:1:${goblin2.id}` },
  ]);
  const h2 = await markerResult('[HELP: Helper="Helper2" Target="Help Goblin 2" Ally="Ally2"]', pc.id, sessionId2, 'HELP');
  ok(h2 && h2.success === true, 'second help marker succeeds');
  await ct.advanceTurn(sessionId2, 1); // Ally2.
  await ct.advanceTurn(sessionId2, 1); // Goblin.
  await ct.advanceTurn(sessionId2, 1); // Helper2 next turn: help expires.
  ok(!(await ast.getEntry(sessionId2, 1, allyKey2)).help, 'help expired at the helper next turn');
  await ct.advanceTurn(sessionId2, 1); // Ally2 turn.
  const e2 = await enemyRow(goblin2.id);
  const unhelped = await pas.resolveCompanionAttack(sessionId2, pc.id, ally2, e2, {});
  ok(unhelped.success && unhelped.mode !== 'advantage', 'expired help gives no advantage');
}

group('5. Hide: advantage once, consumed; Bonus variant charges the bonus');
{
  const pc = await addPc();
  const sessionId = await addSession(pc.id);
  const [goblin] = await es.createEncounterEnemies(sessionId, 1, [gob('Hide Goblin')]);
  const hider = await addCompanion('Hider', pc.id, {
    companion_class: 'Rogue', companion_level: 3,
    equipment: JSON.stringify({ mainHand: { name: 'Shortsword' } })
  });
  const key = await wid.assignWorldId('npcs', hider.npc_id);
  await ct.initializeTurnOrder(sessionId, 1, [
    { name: 'Hider', type: 'companion', key },
    { name: 'Hide Goblin', type: 'enemy', key: `combat:${sessionId}:1:${goblin.id}` },
  ]);
  const hide = await markerResult('[HIDE: Target="Hider" Stealth="18"]', pc.id, sessionId, 'HIDE');
  ok(hide && hide.success === true, 'hide marker succeeds');
  const e = await enemyRow(goblin.id);
  const fromHiding = await pas.resolveCompanionAttack(sessionId, pc.id, hider, e, {});
  ok(fromHiding.success && fromHiding.mode === 'advantage' && fromHiding.dice.length === 2, 'attack from hiding rolls at advantage');
  await ct.advanceTurn(sessionId, 1); // Goblin.
  await ct.advanceTurn(sessionId, 1); // Hider next turn: fresh swing, no hidden left.
  const plain = await pas.resolveCompanionAttack(sessionId, pc.id, hider, e, {});
  ok(plain.success && plain.mode !== 'advantage', 'hidden is consumed by the first attack');
  // Bonus variant: Hide as a bonus action charges the bonus.
  const sessionId2 = await addSession(pc.id);
  const [goblin2] = await es.createEncounterEnemies(sessionId2, 1, [gob('Hide Goblin 2')]);
  const sneaky = await addCompanion('Sneaky', pc.id, {
    companion_class: 'Rogue', companion_level: 3,
    equipment: JSON.stringify({ mainHand: { name: 'Shortsword' } })
  });
  const key2 = await wid.assignWorldId('npcs', sneaky.npc_id);
  await ct.initializeTurnOrder(sessionId2, 1, [
    { name: 'Sneaky', type: 'companion', key: key2 },
    { name: 'Hide Goblin 2', type: 'enemy', key: `combat:${sessionId2}:1:${goblin2.id}` },
  ]);
  const hb = await markerResult('[HIDE: Target="Sneaky" Bonus="true" Stealth="18"]', pc.id, sessionId2, 'HIDE');
  ok(hb && hb.success === true, 'bonus hide marker succeeds');
  const budget = await tl.getBudget(sessionId2, 1, key2);
  ok(budget && budget.bonusSpent === true && budget.bonusSpentBy === 'Hide', 'bonus hide charges the bonus action');
  // PC hide: the pending attack carries advantage at declaration.
  const paladin = await addPc({ name: 'Sneak PC', class: 'Rogue', level: 3,
    equipment: JSON.stringify({ mainHand: { name: 'Dagger' } }) });
  const palKey = await wid.assignWorldId('characters', paladin.id);
  const sessionId3 = await addSession(paladin.id);
  const [goblin3] = await es.createEncounterEnemies(sessionId3, 1, [gob('Hide Goblin 3')]);
  await ct.initializeTurnOrder(sessionId3, 1, [
    { name: 'Sneak PC', type: 'player', key: palKey },
    { name: 'Hide Goblin 3', type: 'enemy', key: `combat:${sessionId3}:1:${goblin3.id}` },
  ]);
  const ph = await markerResult('[HIDE: Target="Sneak PC" Stealth="18"]', paladin.id, sessionId3, 'HIDE');
  ok(ph && ph.success === true, 'PC hide marker succeeds');
  const e3 = await enemyRow(goblin3.id);
  const pend = await pas.createPcPendingAttack(sessionId3, paladin.id, paladin, e3, {});
  ok(pend.pending && pend.pending.mode === 'advantage', 'PC pending attack from hiding is at advantage');
  ok(!(await ast.getEntry(sessionId3, 1, palKey)).hidden, 'PC hidden consumed at declaration');
}

group('6. Ready: stored, refused without one, fired off-turn on a reaction');
{
  const pc = await addPc();
  const sessionId = await addSession(pc.id);
  const [goblin] = await es.createEncounterEnemies(sessionId, 1, [gob('Ready Goblin')]);
  const ready = await addCompanion('ReadyComp', pc.id, {
    companion_class: 'Fighter', companion_level: 3,
    equipment: JSON.stringify({ mainHand: { name: 'Longsword' } })
  });
  const noready = await addCompanion('NoReady', pc.id, {
    companion_class: 'Fighter', companion_level: 3,
    equipment: JSON.stringify({ mainHand: { name: 'Longsword' } })
  });
  const readyKey = await wid.assignWorldId('npcs', ready.npc_id);
  const noreadyKey = await wid.assignWorldId('npcs', noready.npc_id);
  await ct.initializeTurnOrder(sessionId, 1, [
    { name: 'ReadyComp', type: 'companion', key: readyKey },
    { name: 'NoReady', type: 'companion', key: noreadyKey },
    { name: 'Ready Goblin', type: 'enemy', key: `combat:${sessionId}:1:${goblin.id}` },
  ]);
  const r = await markerResult('[READY: Target="ReadyComp" Action="shoot the goblin" Trigger="when it moves"]', pc.id, sessionId, 'READY');
  ok(r && r.success === true && r.action === 'shoot the goblin', 'ready marker stores action + trigger');
  ok((await ast.getEntry(sessionId, 1, readyKey)).ready?.trigger === 'when it moves', 'stored ready is readable');
  const nofire = await markerResult('[ATTACK: Attacker="NoReady" Target="Ready Goblin" Ready="true"]', pc.id, sessionId, 'ATTACK');
  ok(nofire && nofire.success === false && /no readied action/.test(nofire.reason), 'firing without a stored ready is refused');
  await ct.advanceTurn(sessionId, 1); // NoReady turn.
  await ct.advanceTurn(sessionId, 1); // Goblin turn: ReadyComp fires off-turn.
  const fired = await markerResult('[ATTACK: Attacker="ReadyComp" Target="Ready Goblin" Ready="true"]', pc.id, sessionId, 'ATTACK');
  ok(fired && fired.success === true && fired.readyFired === true, 'readied attack fires off-turn');
  ok(!(await ast.getEntry(sessionId, 1, readyKey)).ready, 'stored ready is cleared on firing');
  ok(!(await rs.hasReactionAvailable(sessionId, 1, 'ReadyComp')), 'firing spent the reaction');
  const fired2 = await markerResult('[ATTACK: Attacker="ReadyComp" Target="Ready Goblin" Ready="true"]', pc.id, sessionId, 'ATTACK');
  ok(fired2 && fired2.success === false && /no readied action/.test(fired2.reason), 'second firing refused: nothing stored');
  // PC ready: pending attack fires off-turn, reaction spent.
  const paladin = await addPc({ name: 'Ready PC', class: 'Fighter', level: 5,
    equipment: JSON.stringify({ mainHand: { name: 'Longsword' } }) });
  const palKey = await wid.assignWorldId('characters', paladin.id);
  const sessionId2 = await addSession(paladin.id);
  const [goblin2] = await es.createEncounterEnemies(sessionId2, 1, [gob('Ready Goblin 2')]);
  await ct.initializeTurnOrder(sessionId2, 1, [
    { name: 'Ready PC', type: 'player', key: palKey },
    { name: 'Ready Goblin 2', type: 'enemy', key: `combat:${sessionId2}:1:${goblin2.id}` },
  ]);
  const pr = await markerResult('[READY: Target="Ready PC" Action="shoot" Trigger="when it moves"]', paladin.id, sessionId2, 'READY');
  ok(pr && pr.success === true, 'PC ready marker succeeds');
  await ct.advanceTurn(sessionId2, 1); // Goblin turn.
  const e2 = await enemyRow(goblin2.id);
  const pend = await pas.createPcPendingAttack(sessionId2, paladin.id, paladin, e2, { readyFired: true });
  ok(pend.pending && pend.pending.readyFired === true, 'PC readied pending attack declares');
  const rep = await pas.resolveReportedAttack(sessionId2, paladin.id, [15], 10);
  ok(rep && rep.readyFired === true, 'PC readied attack resolves with the flag');
  ok(!(await rs.hasReactionAvailable(sessionId2, 1, 'Ready PC')), 'PC firing spent the reaction');
}

group('7. No turn order: states set, ready fires without reactions');
{
  const pc = await addPc();
  const sessionId = await addSession(pc.id);
  const [goblin] = await es.createEncounterEnemies(sessionId, 1, [gob('Free Goblin')]);
  const comp = await addCompanion('FreeComp', pc.id, {
    companion_class: 'Fighter', companion_level: 3,
    equipment: JSON.stringify({ mainHand: { name: 'Longsword' } })
  });
  const key = await wid.assignWorldId('npcs', comp.npc_id);
  // No initializeTurnOrder: pre-combat behavior, ungated.
  const d = await markerResult('[DODGE: Target="FreeComp"]', pc.id, sessionId, 'DODGE');
  ok(d && d.success === true, 'dodge succeeds with no turn order');
  ok((await ast.getEntry(sessionId, 1, key)).dodge, 'dodge state set with no order');
  const r = await markerResult('[READY: Target="FreeComp" Action="shoot" Trigger="when it moves"]', pc.id, sessionId, 'READY');
  ok(r && r.success === true, 'ready stores with no turn order');
  const fired = await markerResult('[ATTACK: Attacker="FreeComp" Target="Free Goblin" Ready="true"]', pc.id, sessionId, 'ATTACK');
  ok(fired && fired.success === true && fired.readyFired === true, 'readied attack fires with no order (no reactions to track)');
}

group('8. Enemy Disengage refuses the party OA');
{
  const pc = await addPc();
  const sessionId = await addSession(pc.id);
  const [goblin] = await es.createEncounterEnemies(sessionId, 1, [gob('Flee Goblin')]);
  const comp = await addCompanion('Chaser', pc.id, {
    companion_class: 'Fighter', companion_level: 3,
    equipment: JSON.stringify({ mainHand: { name: 'Longsword' } })
  });
  const key = await wid.assignWorldId('npcs', comp.npc_id);
  await ct.initializeTurnOrder(sessionId, 1, [
    { name: 'Chaser', type: 'companion', key },
    { name: 'Flee Goblin', type: 'enemy', key: `combat:${sessionId}:1:${goblin.id}` },
  ]);
  const dis = await markerResult('[DISENGAGE: Target="Flee Goblin"]', pc.id, sessionId, 'DISENGAGE');
  ok(dis && dis.success === true, 'enemy disengage marker succeeds (DM-governed)');
  const oa = await markerResult('[OPPORTUNITY_ATTACK: Attacker="Chaser" Target="Flee Goblin"]', pc.id, sessionId, 'OPPORTUNITY_ATTACK');
  ok(oa && oa.success === false && /Disengaged/.test(oa.reason) && oa.reactionConsumed === false, 'OA vs a Disengaged enemy refused, reaction untouched');
  ok(await rs.hasReactionAvailable(sessionId, 1, 'Chaser'), 'chaser reaction still available');
}

group('9. Enemy Hide and Ready are mechanical (Zach veto of party-only)');
{
  // Enemy Hide: next enemy attack advantaged, then consumed.
  const pc = await addPc();
  const sessionId = await addSession(pc.id);
  const [goblin] = await es.createEncounterEnemies(sessionId, 1, [gob('Hide Goblin E')]);
  const target = await addCompanion('Target', pc.id, {
    companion_class: 'Fighter', companion_level: 3,
    equipment: JSON.stringify({ mainHand: { name: 'Longsword' } })
  });
  const key = await wid.assignWorldId('npcs', target.npc_id);
  await ct.initializeTurnOrder(sessionId, 1, [
    { name: 'Target', type: 'companion', key },
    { name: 'Hide Goblin E', type: 'enemy', key: `combat:${sessionId}:1:${goblin.id}` },
  ]);
  const hide = await markerResult('[HIDE: Target="Hide Goblin E" Stealth="18"]', pc.id, sessionId, 'HIDE');
  ok(hide && hide.success === true, 'enemy hide marker succeeds (no longer party-only)');
  const fromHiding = await markerResult('[ENEMY_ATTACK: Enemy="Hide Goblin E" Target="Target"]', pc.id, sessionId, 'ENEMY_ATTACK');
  ok(fromHiding && fromHiding.attackMode === 'advantage' && fromHiding.attackRolls.length === 2, 'hidden enemy attacks at advantage');
  const plain = await markerResult('[ENEMY_ATTACK: Enemy="Hide Goblin E" Target="Target"]', pc.id, sessionId, 'ENEMY_ATTACK');
  ok(plain && plain.attackMode !== 'advantage', 'enemy hidden consumed by the first attack');
  // Enemy Ready: stored, refused without one, fired on a reaction.
  const sessionId2 = await addSession(pc.id);
  const [readyGoblin, plainGoblin] = await es.createEncounterEnemies(sessionId2, 1, [gob('Ready Goblin E'), gob('Plain Goblin E')]);
  const watcher = await addCompanion('Watcher', pc.id, {
    companion_class: 'Fighter', companion_level: 3,
    equipment: JSON.stringify({ mainHand: { name: 'Longsword' } })
  });
  const wKey = await wid.assignWorldId('npcs', watcher.npc_id);
  await ct.initializeTurnOrder(sessionId2, 1, [
    { name: 'Watcher', type: 'companion', key: wKey },
    { name: 'Ready Goblin E', type: 'enemy', key: `combat:${sessionId2}:1:${readyGoblin.id}` },
    { name: 'Plain Goblin E', type: 'enemy', key: `combat:${sessionId2}:1:${plainGoblin.id}` },
  ]);
  const r = await markerResult('[READY: Target="Ready Goblin E" Action="shoot" Trigger="when it moves"]', pc.id, sessionId2, 'READY');
  ok(r && r.success === true, 'enemy ready marker succeeds (no longer party-only)');
  const nofire = await markerResult('[ENEMY_ATTACK: Enemy="Plain Goblin E" Target="Watcher" Ready="true"]', pc.id, sessionId2, 'ENEMY_ATTACK');
  ok(nofire && nofire.success === false && /no readied action/.test(nofire.reason), 'enemy firing without a stored ready is refused');
  const fired = await markerResult('[ENEMY_ATTACK: Enemy="Ready Goblin E" Target="Watcher" Ready="true"]', pc.id, sessionId2, 'ENEMY_ATTACK');
  ok(fired && fired.success === true && fired.readyFired === true && fired.reactionConsumed === true && fired.attack && typeof fired.attack.hit === 'boolean', 'enemy readied attack fires on a reaction');
  ok(!(await ast.getEntry(sessionId2, 1, `combat:${sessionId2}:1:${readyGoblin.id}`)).ready, 'enemy stored ready cleared on firing');
  ok(!(await rs.hasReactionAvailable(sessionId2, 1, 'Ready Goblin E')), 'enemy firing spent the reaction');
  const fired2 = await markerResult('[ENEMY_ATTACK: Enemy="Ready Goblin E" Target="Watcher" Ready="true"]', pc.id, sessionId2, 'ENEMY_ATTACK');
  ok(fired2 && fired2.success === false && /no readied action/.test(fired2.reason), 'enemy second firing refused: nothing stored');
  // Enemy Bonus flag: noted, never charged (no enemy bonus budget
  // until item 5).
  const hb = await markerResult('[HIDE: Target="Plain Goblin E" Bonus="true" Stealth="18"]', pc.id, sessionId2, 'HIDE');
  ok(hb && hb.success === true && hb.bonusIgnored, 'enemy bonus hide succeeds with the ignored bonus noted');
  const plainKey = wid.combatFallbackId(sessionId2, 1, plainGoblin.id);
  const budget = await tl.getBudget(sessionId2, 1, plainKey);
  ok(!budget?.bonusSpent, 'enemy bonus hide charged no bonus');
}

group('10. Enemy Help: monsters helping monsters, consumed, expiring, side rules');
{
  const pc = await addPc();
  const sessionId = await addSession(pc.id);
  const [helperGoblin, allyGoblin] = await es.createEncounterEnemies(sessionId, 1, [gob('Helper Goblin'), gob('Ally Goblin')]);
  const victim = await addCompanion('Victim', pc.id, {
    companion_class: 'Fighter', companion_level: 3,
    equipment: JSON.stringify({ mainHand: { name: 'Longsword' } })
  });
  const victimKey = await wid.assignWorldId('npcs', victim.npc_id);
  await ct.initializeTurnOrder(sessionId, 1, [
    { name: 'Victim', type: 'companion', key: victimKey },
    { name: 'Helper Goblin', type: 'enemy', key: `combat:${sessionId}:1:${helperGoblin.id}` },
    { name: 'Ally Goblin', type: 'enemy', key: `combat:${sessionId}:1:${allyGoblin.id}` },
  ]);
  // Mixed sides are refused, both directions.
  const mixed1 = await markerResult('[HELP: Helper="Helper Goblin" Target="Victim" Ally="Victim"]', pc.id, sessionId, 'HELP');
  ok(mixed1 && mixed1.success === false && /same side/.test(mixed1.reason), 'enemy helper + party ally refused (same-side rule)');
  const mixed2 = await markerResult('[HELP: Helper="Victim" Target="Helper Goblin" Ally="Ally Goblin"]', pc.id, sessionId, 'HELP');
  ok(mixed2 && mixed2.success === false && /same side/.test(mixed2.reason), 'party helper + enemy ally refused (same-side rule)');
  // Wrong-side target refused: enemy ally needs a party target.
  const wrongTarget = await markerResult('[HELP: Helper="Helper Goblin" Target="Helper Goblin" Ally="Ally Goblin"]', pc.id, sessionId, 'HELP');
  ok(wrongTarget && wrongTarget.success === false && /opposite sides/.test(wrongTarget.reason), 'enemy ally + enemy target refused (opposite-side rule)');
  // Real enemy help: advantaged once, then consumed.
  const h = await markerResult('[HELP: Helper="Helper Goblin" Target="Victim" Ally="Ally Goblin"]', pc.id, sessionId, 'HELP');
  ok(h && h.success === true && h.helper === 'Helper Goblin' && h.ally === 'Ally Goblin', 'enemy help marker succeeds');
  const helped = await markerResult('[ENEMY_ATTACK: Enemy="Ally Goblin" Target="Victim"]', pc.id, sessionId, 'ENEMY_ATTACK');
  ok(helped && helped.attackMode === 'advantage' && helped.attackRolls.length === 2, 'helped enemy attacks at advantage');
  const plain = await markerResult('[ENEMY_ATTACK: Enemy="Ally Goblin" Target="Victim"]', pc.id, sessionId, 'ENEMY_ATTACK');
  ok(plain && plain.attackMode !== 'advantage', 'enemy help consumed by the first attack');
  // Enemy help vs the PC: the stored name must be resolvePartyTarget's
  // 'Player', not the character name.
  const paladin = await addPc({ name: 'Helped PC', class: 'Fighter', level: 5,
    equipment: JSON.stringify({ mainHand: { name: 'Longsword' } }) });
  const palKey = await wid.assignWorldId('characters', paladin.id);
  const sessionId2 = await addSession(paladin.id);
  const [helper2, ally2] = await es.createEncounterEnemies(sessionId2, 1, [gob('Helper Goblin 2'), gob('Ally Goblin 2')]);
  await ct.initializeTurnOrder(sessionId2, 1, [
    { name: 'Helped PC', type: 'player', key: palKey },
    { name: 'Helper Goblin 2', type: 'enemy', key: `combat:${sessionId2}:1:${helper2.id}` },
    { name: 'Ally Goblin 2', type: 'enemy', key: `combat:${sessionId2}:1:${ally2.id}` },
  ]);
  const hp = await markerResult('[HELP: Helper="Helper Goblin 2" Target="Player" Ally="Ally Goblin 2"]', paladin.id, sessionId2, 'HELP');
  ok(hp && hp.success === true, 'enemy help vs the PC succeeds');
  const helpedPc = await markerResult('[ENEMY_ATTACK: Enemy="Ally Goblin 2" Target="Player"]', paladin.id, sessionId2, 'ENEMY_ATTACK');
  ok(helpedPc && helpedPc.attackMode === 'advantage', 'helped enemy attacks the PC at advantage');
  // Expiry at the helper's next turn: grant, then advance past it
  // with no ally attack — the help is gone.
  const sessionId3 = await addSession(pc.id);
  const [helper3, ally3] = await es.createEncounterEnemies(sessionId3, 1, [gob('Helper Goblin 3'), gob('Ally Goblin 3')]);
  const victim3 = await addCompanion('Victim3', pc.id, {
    companion_class: 'Fighter', companion_level: 3,
    equipment: JSON.stringify({ mainHand: { name: 'Longsword' } })
  });
  const victimKey3 = await wid.assignWorldId('npcs', victim3.npc_id);
  await ct.initializeTurnOrder(sessionId3, 1, [
    { name: 'Victim3', type: 'companion', key: victimKey3 },
    { name: 'Helper Goblin 3', type: 'enemy', key: `combat:${sessionId3}:1:${helper3.id}` },
    { name: 'Ally Goblin 3', type: 'enemy', key: `combat:${sessionId3}:1:${ally3.id}` },
  ]);
  const h3 = await markerResult('[HELP: Helper="Helper Goblin 3" Target="Victim3" Ally="Ally Goblin 3"]', pc.id, sessionId3, 'HELP');
  ok(h3 && h3.success === true, 'third enemy help marker succeeds');
  await ct.advanceTurn(sessionId3, 1); // Helper Goblin 3 turn: help expires.
  ok(!(await ast.getEntry(sessionId3, 1, `combat:${sessionId3}:1:${ally3.id}`)).help, 'enemy help expired at the helper next turn');
  await ct.advanceTurn(sessionId3, 1); // Ally Goblin 3 turn.
  const unhelped = await markerResult('[ENEMY_ATTACK: Enemy="Ally Goblin 3" Target="Victim3"]', pc.id, sessionId3, 'ENEMY_ATTACK');
  ok(unhelped && unhelped.attackMode !== 'advantage', 'expired enemy help gives no advantage');
}

group('11. Help for ability checks: scoped, unscoped, consumed, never for saves');
{
  const pc = await addPc();
  const lyra = await addCompanion('Lyra', pc.id, {
    companion_class: 'Rogue', companion_level: 3,
    companion_ability_scores: JSON.stringify({ str: 10, dex: 16, con: 12, int: 10, wis: 12, cha: 10 }),
    equipment: JSON.stringify({ mainHand: { name: 'Shortsword' } })
  });
  const pcKey = await tl.ledgerKeyForPlayer(pc.id);
  // (a) Scoped help: advantaged once, then consumed.
  const sA = await addSession(pc.id);
  const hA = await markerResult('[HELP_CHECK: Helper="Lyra" Ally="Player" Skill="Perception"]', pc.id, sA, 'HELP_CHECK');
  ok(hA && hA.success === true, 'scoped check-help marker succeeds');
  const reqA = await markerResult('[ROLL_REQUEST: Skill="Perception" DC=10 Looks="a faint trail"]', pc.id, sA, 'ROLL_REQUEST');
  ok(reqA && reqA.pending === true && reqA.advantage === 'advantage', 'helped PC check is advantaged');
  const resA = await rrs.resolveReportedRoll(sA, [8, 15]);
  ok(resA && resA.takenDie === 15, 'helped check takes the higher die');
  const reqA2 = await markerResult('[ROLL_REQUEST: Skill="Perception" DC=10 Looks="a faint trail"]', pc.id, sA, 'ROLL_REQUEST');
  ok(reqA2 && reqA2.advantage == null, 'check-help consumed by the first check');
  // (b) A different check neither uses nor spends the help.
  const sB = await addSession(pc.id);
  await markerResult('[HELP_CHECK: Helper="Lyra" Ally="Player" Skill="Perception"]', pc.id, sB, 'HELP_CHECK');
  const reqB = await markerResult('[ROLL_REQUEST: Skill="Investigation" DC=10 Looks="a cluttered desk"]', pc.id, sB, 'ROLL_REQUEST');
  ok(reqB && reqB.advantage == null, 'unrelated check gets no advantage');
  await rrs.resolveReportedRoll(sB, [10]);
  ok((await ast.getEntry(sB, 0, pcKey)).checkHelp, 'unrelated check does not spend the help');
  const reqB2 = await markerResult('[ROLL_REQUEST: Skill="Perception" DC=10 Looks="a faint trail"]', pc.id, sB, 'ROLL_REQUEST');
  ok(reqB2 && reqB2.advantage === 'advantage', 'help still applies to the matching check');
  // (c) Unscoped help: the next check of any kind.
  const sC = await addSession(pc.id);
  await markerResult('[HELP_CHECK: Helper="Lyra" Ally="Player"]', pc.id, sC, 'HELP_CHECK');
  const reqC = await markerResult('[ROLL_REQUEST: Ability="Strength" DC=10 Looks="a stuck door"]', pc.id, sC, 'ROLL_REQUEST');
  ok(reqC && reqC.advantage === 'advantage', 'unscoped help applies to the next check');
  // (d) Save scope refused; (e) a save request never uses or spends help.
  const sD = await addSession(pc.id);
  const saveScope = await markerResult('[HELP_CHECK: Helper="Lyra" Ally="Player" Save="Dexterity"]', pc.id, sD, 'HELP_CHECK');
  ok(saveScope && saveScope.success === false && /saving throws/.test(saveScope.reason), 'Help never applies to saving throws (scope refused)');
  const sE = await addSession(pc.id);
  await markerResult('[HELP_CHECK: Helper="Lyra" Ally="Player" Skill="Perception"]', pc.id, sE, 'HELP_CHECK');
  const reqE = await markerResult('[ROLL_REQUEST: Save="Dexterity" DC=10 Looks="a falling rock"]', pc.id, sE, 'ROLL_REQUEST');
  ok(reqE && reqE.advantage == null, 'saving throw gets no help advantage');
  ok((await ast.getEntry(sE, 0, pcKey)).checkHelp, 'saving throw does not spend the help');
  // (f) Companion ally: server roll at advantage.
  const sF = await addSession(pc.id);
  const hF = await markerResult('[HELP_CHECK: Helper="Player" Ally="Lyra" Skill="Stealth"]', pc.id, sF, 'HELP_CHECK');
  ok(hF && hF.success === true, 'companion check-help marker succeeds');
  const rollF = await markerResult('[ROLL_REQUEST: Actor="Lyra" Skill="Stealth" DC=10 Looks="a sleeping guard"]', pc.id, sF, 'ROLL_REQUEST');
  ok(rollF && rollF.dice && rollF.dice.length === 2 && rollF.takenDie === Math.max(...rollF.dice), 'helped companion rolls two dice, takes the higher');
  // (g) Marker disadvantage + help = straight roll, help still spent.
  const sG = await addSession(pc.id);
  await markerResult('[HELP_CHECK: Helper="Lyra" Ally="Player" Skill="Perception"]', pc.id, sG, 'HELP_CHECK');
  const reqG = await markerResult('[ROLL_REQUEST: Skill="Perception" DC=10 Looks="a faint trail" Disadvantage="heavy load"]', pc.id, sG, 'ROLL_REQUEST');
  ok(reqG && reqG.advantage == null, 'help + disadvantage cancel to a straight roll');
  await rrs.resolveReportedRoll(sG, [10]);
  const reqG2 = await markerResult('[ROLL_REQUEST: Skill="Perception" DC=10 Looks="a faint trail"]', pc.id, sG, 'ROLL_REQUEST');
  ok(reqG2 && reqG2.advantage == null, 'cancelled help is still spent');
  // (h) Non-party helper/ally refused.
  const sH = await addSession(pc.id);
  const badHelper = await markerResult('[HELP_CHECK: Helper="Nobody" Ally="Player" Skill="Perception"]', pc.id, sH, 'HELP_CHECK');
  ok(badHelper && badHelper.success === false && /party member/.test(badHelper.reason), 'non-party helper refused');
  const badAlly = await markerResult('[HELP_CHECK: Helper="Lyra" Ally="Nobody" Skill="Perception"]', pc.id, sH, 'HELP_CHECK');
  ok(badAlly && badAlly.success === false && /party member/.test(badAlly.reason), 'non-party ally refused');
}

group('12. Readied spells: slot spent at ready, release, match, fizzle, expiry');
{
  const pc = await addPc({ name: 'Caster', class: 'Wizard', level: 5,
    ability_scores: JSON.stringify({ str: 10, dex: 14, con: 14, int: 16, wis: 12, cha: 8 }),
    spell_slots: JSON.stringify({ 1: 4, 2: 3, 3: 2 }), spell_slots_used: JSON.stringify({}) });
  const pcKey = await wid.assignWorldId('characters', pc.id);
  const sessionId = await addSession(pc.id);
  const [goblin] = await es.createEncounterEnemies(sessionId, 1, [gob('Goblin')]);
  await ct.initializeTurnOrder(sessionId, 1, [
    { name: 'Caster', type: 'player', key: pcKey },
    { name: 'Goblin', type: 'enemy', key: `combat:${sessionId}:1:${goblin.id}` },
  ]);
  const slotsUsed = async () => JSON.parse((await dbGet('SELECT spell_slots_used FROM characters WHERE id = ?', [pc.id])).spell_slots_used || '{}');
  const conc = async () => (await dbGet('SELECT concentrating_on FROM characters WHERE id = ?', [pc.id])).concentrating_on;
  // (a) Ready Fireball: slot spent now, concentration held.
  const ready = await markerResult('[READY: Target="Caster" Action="Cast Fireball" Spell="Fireball" Level=3 Trigger="goblins bunch up"]', pc.id, sessionId, 'READY');
  ok(ready && ready.success === true && ready.heldSpell === 'Fireball' && ready.heldLevel === 3 && ready.slotConsumed === true, 'spell-ready stores the held spell and level');
  ok((await slotsUsed())[3] === 1, 'readied spell slot spent at ready time');
  ok((await conc()) === 'Fireball', 'holding a readied spell takes concentration');
  // (b) Release off-turn: reaction spent, no second slot, hold ends.
  await ct.advanceTurn(sessionId, 1); // Goblin turn.
  const rel = await markerResult('[SPELL_CAST: Spell="Fireball" Target="Goblin" Ready="true"]', pc.id, sessionId, 'SPELL_CAST');
  ok(rel && rel.success === true && rel.readyFired === true && rel.slotConsumed === false, 'readied spell releases without spending again');
  ok((await slotsUsed())[3] === 1, 'release spends no additional slot');
  ok((await conc()) == null, 'releasing a non-concentration spell ends the hold');
  ok(!(await rs.hasReactionAvailable(sessionId, 1, 'Caster')), 'release spends the reaction');
  ok(!(await ast.getEntry(sessionId, 1, pcKey)).ready, 'release clears the ready');
  // (c) Wrong-spell release refused, ready and slots untouched.
  await ct.advanceTurn(sessionId, 1); // Caster turn, round 2.
  await markerResult('[READY: Target="Caster" Action="Cast Fireball" Spell="Fireball" Level=3 Trigger="goblins bunch up"]', pc.id, sessionId, 'READY');
  const wrong = await markerResult('[SPELL_CAST: Spell="Magic Missile" Target="Goblin" Ready="true"]', pc.id, sessionId, 'SPELL_CAST');
  ok(wrong && wrong.success === false && /Fireball/.test(wrong.reason), 'releasing a different spell is refused, naming the held spell');
  ok((await ast.getEntry(sessionId, 1, pcKey)).ready, 'refused release keeps the ready');
  ok((await slotsUsed())[3] === 2, 'refused release spends nothing extra');
  await ct.advanceTurn(sessionId, 1); // Goblin turn.
  const rel2 = await markerResult('[SPELL_CAST: Spell="Fireball" Target="Goblin" Ready="true"]', pc.id, sessionId, 'SPELL_CAST');
  ok(rel2 && rel2.success === true, 'held spell still releasable after a refused release');
  // (d) No slot, no ready.
  const pc2 = await addPc({ name: 'Spent', class: 'Wizard', level: 5,
    spell_slots: JSON.stringify({ 2: 2, 3: 1 }), spell_slots_used: JSON.stringify({ 3: 1 }) });
  const pc2Key = await wid.assignWorldId('characters', pc2.id);
  const sessionId2 = await addSession(pc2.id);
  const [goblin2] = await es.createEncounterEnemies(sessionId2, 1, [gob('Goblin 2')]);
  await ct.initializeTurnOrder(sessionId2, 1, [
    { name: 'Spent', type: 'player', key: pc2Key },
    { name: 'Goblin 2', type: 'enemy', key: `combat:${sessionId2}:1:${goblin2.id}` },
  ]);
  const noSlot = await markerResult('[READY: Target="Spent" Action="Cast Fireball" Spell="Fireball" Level=3 Trigger="goblins bunch up"]', pc2.id, sessionId2, 'READY');
  ok(noSlot && noSlot.success === false && /no_slots/.test(noSlot.reason), 'readied spell with no slot is refused');
  ok(!(await ast.getEntry(sessionId2, 1, pc2Key)).ready, 'refused ready stores nothing');
  // (e) Cantrip ready: no slot, concentration held, release ends hold.
  const cantrip = await markerResult('[READY: Target="Spent" Action="Cast Fire Bolt" Spell="Fire Bolt" Trigger="a goblin appears"]', pc2.id, sessionId2, 'READY');
  ok(cantrip && cantrip.success === true && cantrip.slotConsumed === false, 'cantrip ready spends no slot');
  ok((await dbGet('SELECT concentrating_on FROM characters WHERE id = ?', [pc2.id])).concentrating_on === 'Fire Bolt', 'holding a cantrip still takes concentration');
  await ct.advanceTurn(sessionId2, 1); // Goblin 2 turn.
  const relCantrip = await markerResult('[SPELL_CAST: Spell="Fire Bolt" Target="Goblin 2" Ready="true"]', pc2.id, sessionId2, 'SPELL_CAST');
  ok(relCantrip && relCantrip.success === true && relCantrip.readyFired === true, 'cantrip release succeeds');
  ok((await dbGet('SELECT concentrating_on FROM characters WHERE id = ?', [pc2.id])).concentrating_on == null, 'cantrip release ends the hold');
  // (f) Broken concentration fizzles the held spell.
  await ct.advanceTurn(sessionId2, 1); // Spent turn, round 2.
  const hold = await markerResult('[READY: Target="Spent" Action="Cast Hold Person" Spell="Hold Person" Level=2 Trigger="a goblin approaches"]', pc2.id, sessionId2, 'READY');
  ok(hold && hold.success === true, 'Hold Person ready succeeds');
  await dbRun('UPDATE characters SET concentrating_on = NULL WHERE id = ?', [pc2.id]);
  const fizzle = await markerResult('[SPELL_CAST: Spell="Hold Person" Target="Goblin 2" Ready="true"]', pc2.id, sessionId2, 'SPELL_CAST');
  ok(fizzle && fizzle.success === false && /fizzled/.test(fizzle.reason), 'broken concentration fizzles the held spell');
  ok(!(await ast.getEntry(sessionId2, 1, pc2Key)).ready, 'fizzled ready clears');
  // (g) Expiry: ready dies at the readier next turn, slot stays spent, hold ends.
  const pc3 = await addPc({ name: 'Waiter', class: 'Wizard', level: 5,
    spell_slots: JSON.stringify({ 3: 2 }), spell_slots_used: JSON.stringify({}) });
  const pc3Key = await wid.assignWorldId('characters', pc3.id);
  const sessionId3 = await addSession(pc3.id);
  const [goblin3] = await es.createEncounterEnemies(sessionId3, 1, [gob('Goblin 3')]);
  await ct.initializeTurnOrder(sessionId3, 1, [
    { name: 'Waiter', type: 'player', key: pc3Key },
    { name: 'Goblin 3', type: 'enemy', key: `combat:${sessionId3}:1:${goblin3.id}` },
  ]);
  await markerResult('[READY: Target="Waiter" Action="Cast Fireball" Spell="Fireball" Level=3 Trigger="never happens"]', pc3.id, sessionId3, 'READY');
  await ct.advanceTurn(sessionId3, 1); // Goblin 3 turn: ready still live.
  ok((await ast.getEntry(sessionId3, 1, pc3Key)).ready, 'ready survives until the readier next turn');
  await ct.advanceTurn(sessionId3, 1); // Waiter turn, round 2: expired.
  ok(!(await ast.getEntry(sessionId3, 1, pc3Key)).ready, 'ready expires at the readier next turn');
  ok((await dbGet('SELECT concentrating_on FROM characters WHERE id = ?', [pc3.id])).concentrating_on == null, 'expiry ends the hold');
  ok(JSON.parse((await dbGet('SELECT spell_slots_used FROM characters WHERE id = ?', [pc3.id])).spell_slots_used || '{}')[3] === 1, 'expired ready gives no slot refund');
  // (h) Companion caster + (i) enemy spell-ready refused.
  const pc4 = await addPc({ name: 'Leader', class: 'Fighter', level: 5 });
  const lyra = await addCompanion('Lyra', pc4.id, {
    companion_class: 'Wizard', companion_level: 5,
    companion_ability_scores: JSON.stringify({ str: 10, dex: 14, con: 12, int: 16, wis: 12, cha: 8 }),
    equipment: JSON.stringify({ mainHand: { name: 'Quarterstaff' } })
  });
  const lyraKey = await wid.assignWorldId('npcs', lyra.npc_id);
  const sessionId4 = await addSession(pc4.id);
  const [goblin4] = await es.createEncounterEnemies(sessionId4, 1, [gob('Goblin 4')]);
  await ct.initializeTurnOrder(sessionId4, 1, [
    { name: 'Lyra', type: 'companion', key: lyraKey },
    { name: 'Goblin 4', type: 'enemy', key: `combat:${sessionId4}:1:${goblin4.id}` },
  ]);
  const lyraReady = await markerResult('[READY: Target="Lyra" Action="Cast Fireball" Spell="Fireball" Level=3 Trigger="goblins bunch up"]', pc4.id, sessionId4, 'READY');
  ok(lyraReady && lyraReady.success === true, 'companion spell-ready succeeds');
  ok(JSON.parse((await dbGet('SELECT companion_spell_slots_used FROM companions WHERE id = ?', [lyra.id])).companion_spell_slots_used || '{}')[3] === 1, 'companion slot spent at ready time');
  ok((await dbGet('SELECT concentrating_on FROM companions WHERE id = ?', [lyra.id])).concentrating_on === 'Fireball', 'companion holds with concentration');
  await ct.advanceTurn(sessionId4, 1); // Goblin 4 turn.
  const lyraRel = await markerResult('[SPELL_CAST: Caster="Lyra" Spell="Fireball" Target="Goblin 4" Ready="true"]', pc4.id, sessionId4, 'SPELL_CAST');
  ok(lyraRel && lyraRel.success === true && lyraRel.readyFired === true, 'companion spell release succeeds');
  ok(JSON.parse((await dbGet('SELECT companion_spell_slots_used FROM companions WHERE id = ?', [lyra.id])).companion_spell_slots_used || '{}')[3] === 1, 'companion release spends no second slot');
  const enemySpell = await markerResult('[READY: Target="Goblin 4" Action="Cast Fireball" Spell="Fireball" Level=3 Trigger="anything"]', pc4.id, sessionId4, 'READY');
  ok(enemySpell && enemySpell.success === false && /enemy spellcasting/.test(enemySpell.reason), 'enemy spell-ready refused (no enemy spell path)');
}

group('13. Readied actions: Dodge, Disengage, Help, Hide fired off-turn');
{
  const pc = await addPc();
  const pcKey = await wid.assignWorldId('characters', pc.id);
  const lyra = await addCompanion('Lyra', pc.id, {
    companion_class: 'Fighter', companion_level: 3,
    equipment: JSON.stringify({ mainHand: { name: 'Longsword' } })
  });
  const lyraKey = await wid.assignWorldId('npcs', lyra.npc_id);
  const sessionId = await addSession(pc.id);
  const [goblin] = await es.createEncounterEnemies(sessionId, 1, [gob('Goblin')]);
  await ct.initializeTurnOrder(sessionId, 1, [
    { name: 'Tester', type: 'player', key: pcKey },
    { name: 'Lyra', type: 'companion', key: lyraKey },
    { name: 'Goblin', type: 'enemy', key: `combat:${sessionId}:1:${goblin.id}` },
  ]);
  // (a) Readied Dodge fires on the goblin's turn, spending the reaction.
  const readyDodge = await markerResult('[READY: Target="Tester" Action="Dodge" Trigger="goblin approaches"]', pc.id, sessionId, 'READY');
  ok(readyDodge && readyDodge.success === true, 'Dodge ready succeeds');
  await ct.advanceTurn(sessionId, 1); // Lyra turn.
  await ct.advanceTurn(sessionId, 1); // Goblin turn.
  const firedDodge = await markerResult('[DODGE: Target="Tester" Ready="true"]', pc.id, sessionId, 'DODGE');
  ok(firedDodge && firedDodge.success === true && firedDodge.readyFired === true, 'readied Dodge fires off-turn');
  ok((await ast.getEntry(sessionId, 1, pcKey)).dodge, 'fired Dodge sets dodge state');
  ok(!(await rs.hasReactionAvailable(sessionId, 1, 'Tester')), 'fired Dodge spends the reaction');
  // (b) Firing with no ready is refused.
  const noReady = await markerResult('[DISENGAGE: Target="Tester" Ready="true"]', pc.id, sessionId, 'DISENGAGE');
  ok(noReady && noReady.success === false && /no readied/.test(noReady.reason), 'action fired with no ready is refused');
  // (c) A ready-fired Dodge with Bonus does NOT charge the bonus.
  await ct.advanceTurn(sessionId, 1); // Tester turn, round 2 (reaction resets).
  await markerResult('[READY: Target="Tester" Action="Dodge" Trigger="goblin approaches"]', pc.id, sessionId, 'READY');
  await ct.advanceTurn(sessionId, 1); // Lyra turn.
  await ct.advanceTurn(sessionId, 1); // Goblin turn.
  const bonusDodge = await markerResult('[DODGE: Target="Tester" Ready="true" Bonus="true"]', pc.id, sessionId, 'DODGE');
  ok(bonusDodge && bonusDodge.success === true, 'ready-fired Dodge with Bonus succeeds');
  const ledgerC = await tl.readLedger(sessionId, 1);
  const spentOwn = (await tl.budgetIn(ledgerC, tl.slotKeyFor(1, 2, 0), pcKey)).bonusSpent;
  const spentFire = (await tl.budgetIn(ledgerC, tl.slotKeyFor(1, 2, 2), pcKey)).bonusSpent;
  ok(!spentOwn && !spentFire, 'ready-fired action charges no bonus in either slot');
  // (d) Enemy readied Dodge is real: fire it, then the companion attacks at disadvantage.
  const gobReady = await markerResult('[READY: Target="Goblin" Action="Dodge" Trigger="Tester approaches"]', pc.id, sessionId, 'READY');
  ok(gobReady && gobReady.success === true, 'enemy Dodge ready succeeds');
  await ct.advanceTurn(sessionId, 1); // Tester turn, round 3.
  const firedGobDodge = await markerResult('[DODGE: Target="Goblin" Ready="true"]', pc.id, sessionId, 'DODGE');
  ok(firedGobDodge && firedGobDodge.success === true && firedGobDodge.readyFired === true, 'enemy readied Dodge fires off-turn');
  await ct.advanceTurn(sessionId, 1); // Lyra turn.
  const eDodge = await enemyRow(goblin.id);
  const vsDodging = await pas.resolveCompanionAttack(sessionId, pc.id, lyra, eDodge, {});
  ok(vsDodging && vsDodging.mode === 'disadvantage', 'readied enemy Dodge disadvantages the next attack');
  // (e) Readied Help fires off-turn and stores help for the ally.
  await ct.advanceTurn(sessionId, 1); // Goblin turn.
  await ct.advanceTurn(sessionId, 1); // Tester turn, round 4.
  await markerResult('[READY: Target="Tester" Action="Help Lyra" Trigger="Lyra attacks"]', pc.id, sessionId, 'READY');
  await ct.advanceTurn(sessionId, 1); // Lyra turn.
  const firedHelp = await markerResult('[HELP: Helper="Tester" Target="Goblin" Ally="Lyra" Ready="true"]', pc.id, sessionId, 'HELP');
  ok(firedHelp && firedHelp.success === true && firedHelp.readyFired === true, 'readied Help fires off-turn');
  ok((await ast.getEntry(sessionId, 1, lyraKey)).help, 'fired Help stores help for the ally');
  ok(!(await rs.hasReactionAvailable(sessionId, 1, 'Tester')), 'fired Help spends the reaction');
  // (f) Readied Hide fires off-turn.
  await ct.advanceTurn(sessionId, 1); // Goblin turn.
  await ct.advanceTurn(sessionId, 1); // Tester turn, round 5.
  await markerResult('[READY: Target="Tester" Action="Hide" Trigger="goblin looks away"]', pc.id, sessionId, 'READY');
  await ct.advanceTurn(sessionId, 1); // Lyra turn.
  const firedHide = await markerResult('[HIDE: Target="Tester" Ready="true" Stealth="18"]', pc.id, sessionId, 'HIDE');
  ok(firedHide && firedHide.success === true && firedHide.readyFired === true, 'readied Hide fires off-turn');
  ok((await ast.getEntry(sessionId, 1, pcKey)).hidden, 'fired Hide sets hidden state');
  // (g) Readied Disengage fires off-turn.
  await ct.advanceTurn(sessionId, 1); // Goblin turn.
  await ct.advanceTurn(sessionId, 1); // Tester turn, round 6.
  await markerResult('[READY: Target="Tester" Action="Disengage" Trigger="goblin closes in"]', pc.id, sessionId, 'READY');
  await ct.advanceTurn(sessionId, 1); // Lyra turn.
  const firedDis = await markerResult('[DISENGAGE: Target="Tester" Ready="true"]', pc.id, sessionId, 'DISENGAGE');
  ok(firedDis && firedDis.success === true && firedDis.readyFired === true, 'readied Disengage fires off-turn');
  ok((await ast.getEntry(sessionId, 1, pcKey)).disengage, 'fired Disengage sets disengage state');
}

group('14. Hide v2 + Search: DC 15 check, stored total, passive spot, finding, verbal end');
{
  // (a) A failed Stealth check hides nothing.
  const pc = await addPc();
  const pcKey = await wid.assignWorldId('characters', pc.id);
  const sessionId = await addSession(pc.id);
  const [goblin] = await es.createEncounterEnemies(sessionId, 1, [gob('Spot Goblin')]);
  await ct.initializeTurnOrder(sessionId, 1, [
    { name: 'Tester', type: 'player', key: pcKey },
    { name: 'Spot Goblin', type: 'enemy', key: `combat:${sessionId}:1:${goblin.id}` },
  ]);
  const fail = await markerResult('[HIDE: Target="Tester" Stealth="12"]', pc.id, sessionId, 'HIDE');
  ok(fail && fail.success === false && /DC 15/.test(fail.reason), 'hide below DC 15 fails');
  ok(!(await ast.getEntry(sessionId, 1, pcKey)).hidden, 'failed hide stores nothing');
  // (b) A passed check stores the total as the find DC.
  const hide = await markerResult('[HIDE: Target="Tester" Stealth="18"]', pc.id, sessionId, 'HIDE');
  ok(hide && hide.success === true && hide.stealthTotal === 18, 'hide at DC 15+ stores the total');
  ok((await ast.getEntry(sessionId, 1, pcKey)).hidden?.total === 18, 'stored hidden carries the Stealth total');
  // (c) A sharp-eyed enemy spots the hider on the spot: fresh
  // session with a perceptive PC (passive 18) vs a total of 17.
  const watchful = await addPc({ name: 'Watchful',
    ability_scores: JSON.stringify({ str: 10, dex: 14, con: 12, int: 10, wis: 20, cha: 8 }),
    skills: JSON.stringify(['Perception']) });
  const wKey = await wid.assignWorldId('characters', watchful.id);
  const sessionId2 = await addSession(watchful.id);
  const [goblin2] = await es.createEncounterEnemies(sessionId2, 1, [gob('Sneak Goblin')]);
  await ct.initializeTurnOrder(sessionId2, 1, [
    { name: 'Watchful', type: 'player', key: wKey },
    { name: 'Sneak Goblin', type: 'enemy', key: `combat:${sessionId2}:1:${goblin2.id}` },
  ]);
  const spotted = await markerResult('[HIDE: Target="Sneak Goblin" Stealth="17"]', watchful.id, sessionId2, 'HIDE');
  ok(spotted && spotted.success === false && /spotted by Watchful/.test(spotted.reason), 'passive 18 spots a total-17 hide at once');
  ok(!(await ast.getEntry(sessionId2, 1, `combat:${sessionId2}:1:${goblin2.id}`)).hidden, 'spotted hide stores nothing');
  // (d) SEARCH finds a hidden creature; (e) a failed search leaves
  // them hidden. The goblin hides on the Tester's turn (enemies
  // skip the identity gate); the Tester searches on their turn.
  const found = await markerResult('[HIDE: Target="Spot Goblin" Stealth="18"]', pc.id, sessionId, 'HIDE');
  ok(found && found.success === true, 'goblin hide succeeds (total above party passives)');
  const search = await markerResult('[SEARCH: Searcher="Tester" Target="Spot Goblin" Perception="19"]', pc.id, sessionId, 'SEARCH');
  ok(search && search.success === true && search.found === true, 'search above the total finds the hider');
  ok(!(await ast.getEntry(sessionId, 1, `combat:${sessionId}:1:${goblin.id}`)).hidden, 'found hidden clears');
  await markerResult('[HIDE: Target="Spot Goblin" Stealth="18"]', pc.id, sessionId, 'HIDE');
  const missed = await markerResult('[SEARCH: Searcher="Tester" Target="Spot Goblin" Perception="12"]', pc.id, sessionId, 'SEARCH');
  ok(missed && missed.success === false, 'search below the total fails');
  ok((await ast.getEntry(sessionId, 1, `combat:${sessionId}:1:${goblin.id}`)).hidden, 'failed search leaves them hidden');
  // (f) Attacks against a hidden creature are disadvantaged, and
  // attacking one does not unhide them.
  const lyra = await addCompanion('Lyra', pc.id, {
    companion_class: 'Fighter', companion_level: 3,
    equipment: JSON.stringify({ mainHand: { name: 'Longsword' } })
  });
  const lyraKey = await wid.assignWorldId('npcs', lyra.npc_id);
  const sessionId3 = await addSession(pc.id);
  const [goblin3] = await es.createEncounterEnemies(sessionId3, 1, [gob('Hidden Goblin')]);
  await ct.initializeTurnOrder(sessionId3, 1, [
    { name: 'Lyra', type: 'companion', key: lyraKey },
    { name: 'Hidden Goblin', type: 'enemy', key: `combat:${sessionId3}:1:${goblin3.id}` },
  ]);
  await markerResult('[HIDE: Target="Hidden Goblin" Stealth="18"]', pc.id, sessionId3, 'HIDE');
  const e3 = await enemyRow(goblin3.id);
  const vsHidden = await pas.resolveCompanionAttack(sessionId3, pc.id, lyra, e3, {});
  ok(vsHidden && vsHidden.mode === 'disadvantage' && vsHidden.dice.length === 2, 'attack vs a hidden creature rolls at disadvantage');
  ok((await ast.getEntry(sessionId3, 1, `combat:${sessionId3}:1:${goblin3.id}`)).hidden, 'attacking a hidden creature does not unhide them');
  // (g) A verbal spell ends hidden: the companion Wizard hides,
  // then casts Magic Missile (verbal).
  const leader = await addPc({ name: 'Leader', class: 'Fighter', level: 5 });
  const wiz = await addCompanion('Wiz', leader.id, {
    companion_class: 'Wizard', companion_level: 5,
    companion_ability_scores: JSON.stringify({ str: 10, dex: 14, con: 12, int: 16, wis: 12, cha: 8 }),
    equipment: JSON.stringify({ mainHand: { name: 'Quarterstaff' } })
  });
  const wizKey = await wid.assignWorldId('npcs', wiz.npc_id);
  const sessionId4 = await addSession(leader.id);
  const [goblin4] = await es.createEncounterEnemies(sessionId4, 1, [gob('Spell Goblin')]);
  await ct.initializeTurnOrder(sessionId4, 1, [
    { name: 'Wiz', type: 'companion', key: wizKey },
    { name: 'Spell Goblin', type: 'enemy', key: `combat:${sessionId4}:1:${goblin4.id}` },
  ]);
  await markerResult('[HIDE: Target="Wiz" Stealth="18"]', leader.id, sessionId4, 'HIDE');
  ok((await ast.getEntry(sessionId4, 1, wizKey)).hidden, 'wizard hidden before casting');
  const cast = await markerResult('[SPELL_CAST: Caster="Wiz" Spell="Magic Missile" Target="Spell Goblin"]', leader.id, sessionId4, 'SPELL_CAST');
  ok(cast && cast.success === true, 'companion Magic Missile casts');
  ok(!(await ast.getEntry(sessionId4, 1, wizKey)).hidden, 'verbal spell ends hidden');
  // (h) HIDE End clears, and ending what is not hidden is refused.
  await markerResult('[HIDE: Target="Wiz" Stealth="18"]', leader.id, sessionId4, 'HIDE');
  const ended = await markerResult('[HIDE: Target="Wiz" End="true"]', leader.id, sessionId4, 'HIDE');
  ok(ended && ended.success === true && ended.ended === true, 'HIDE End clears hidden');
  ok(!(await ast.getEntry(sessionId4, 1, wizKey)).hidden, 'hidden gone after End');
  const noEnd = await markerResult('[HIDE: Target="Wiz" End="true"]', leader.id, sessionId4, 'HIDE');
  ok(noEnd && noEnd.success === false && /not hidden/.test(noEnd.reason), 'ending a non-hidden creature is refused');
  // (i) A failed hide still spends the bonus action: the action
  // was taken, failing the check does not refund it.
  const sessionId5 = await addSession(pc.id);
  const [goblin5] = await es.createEncounterEnemies(sessionId5, 1, [gob('Bonus Goblin')]);
  await ct.initializeTurnOrder(sessionId5, 1, [
    { name: 'Tester', type: 'player', key: pcKey },
    { name: 'Bonus Goblin', type: 'enemy', key: `combat:${sessionId5}:1:${goblin5.id}` },
  ]);
  const bonusFail = await markerResult('[HIDE: Target="Tester" Bonus="true" Stealth="12"]', pc.id, sessionId5, 'HIDE');
  ok(bonusFail && bonusFail.success === false, 'bonus hide below DC 15 fails');
  const ledger5 = await tl.readLedger(sessionId5, 1);
  ok((await tl.budgetIn(ledger5, tl.slotKeyFor(1, 1, 0), pcKey)).bonusSpent, 'failed hide still spends the bonus');
}

group('15. Dodging saves: DEX saves advantaged, others straight, dodge not consumed');
{
  // (a) A dodging PC's Dexterity save is requested at advantage.
  const pc = await addPc();
  const pcKey = await wid.assignWorldId('characters', pc.id);
  const sessionId = await addSession(pc.id);
  const [goblin] = await es.createEncounterEnemies(sessionId, 1, [gob('Save Goblin')]);
  await ct.initializeTurnOrder(sessionId, 1, [
    { name: 'Tester', type: 'player', key: pcKey },
    { name: 'Save Goblin', type: 'enemy', key: `combat:${sessionId}:1:${goblin.id}` },
  ]);
  await markerResult('[DODGE: Target="Tester"]', pc.id, sessionId, 'DODGE');
  ok((await ast.getEntry(sessionId, 1, pcKey)).dodge, 'dodge set before the save');
  const dex = await markerResult('[ROLL_REQUEST: Save="Dexterity" Actor="Tester" DC="15" Looks="a fireball bursts"]', pc.id, sessionId, 'ROLL_REQUEST');
  ok(dex && dex.success === true && dex.pending === true && dex.advantage === 'advantage', 'dodging PC DEX save requested at advantage');
  // (b) A dodging PC's Strength save is straight.
  const str = await markerResult('[ROLL_REQUEST: Save="Strength" Actor="Tester" DC="15" Looks="a boulder pins you"]', pc.id, sessionId, 'ROLL_REQUEST');
  ok(str && str.success === true && str.pending === true && str.advantage !== 'advantage', 'dodging PC STR save stays straight');
  // (c) A dodging companion's Dexterity save is system-rolled at advantage.
  const lyra = await addCompanion('Lyra', pc.id, {
    companion_class: 'Fighter', companion_level: 3,
    equipment: JSON.stringify({ mainHand: { name: 'Longsword' } })
  });
  const lyraKey = await wid.assignWorldId('npcs', lyra.npc_id);
  const sessionId2 = await addSession(pc.id);
  const [goblin2] = await es.createEncounterEnemies(sessionId2, 1, [gob('Save Goblin 2')]);
  await ct.initializeTurnOrder(sessionId2, 1, [
    { name: 'Lyra', type: 'companion', key: lyraKey },
    { name: 'Save Goblin 2', type: 'enemy', key: `combat:${sessionId2}:1:${goblin2.id}` },
  ]);
  await markerResult('[DODGE: Target="Lyra"]', pc.id, sessionId2, 'DODGE');
  const lyraDex = await markerResult('[ROLL_REQUEST: Save="Dexterity" Actor="Lyra" DC="15" Looks="a fireball bursts"]', pc.id, sessionId2, 'ROLL_REQUEST');
  ok(lyraDex && lyraDex.success === true && lyraDex.pending === false && lyraDex.dice.length === 2 && lyraDex.takenDie === Math.max(...lyraDex.dice), 'dodging companion DEX save rolled at advantage');
  // (d) The save does not consume the dodge.
  ok((await ast.getEntry(sessionId2, 1, lyraKey)).dodge, 'dodge still set after the save');
  // (e) Dodge advantage plus a disadvantage source cancels to straight.
  const cancel = await markerResult('[ROLL_REQUEST: Save="Dexterity" Actor="Tester" DC="15" Disadvantage="blinded" Looks="a fireball bursts"]', pc.id, sessionId, 'ROLL_REQUEST');
  ok(cancel && cancel.success === true && cancel.pending === true && cancel.advantage !== 'advantage', 'dodge advantage plus disadvantage cancels to straight');
  // (f) Control: no dodge, no advantage.
  const sessionId3 = await addSession(pc.id);
  const [goblin3] = await es.createEncounterEnemies(sessionId3, 1, [gob('Save Goblin 3')]);
  await ct.initializeTurnOrder(sessionId3, 1, [
    { name: 'Tester', type: 'player', key: pcKey },
    { name: 'Save Goblin 3', type: 'enemy', key: `combat:${sessionId3}:1:${goblin3.id}` },
  ]);
  const plain = await markerResult('[ROLL_REQUEST: Save="Dexterity" Actor="Tester" DC="15" Looks="a fireball bursts"]', pc.id, sessionId3, 'ROLL_REQUEST');
  ok(plain && plain.success === true && plain.pending === true && plain.advantage !== 'advantage', 'non-dodging DEX save stays straight');
}

console.log('Results: ' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
