// tests/item-3c-bonus-action.test.js — combat item 3, Tier 2:
// bonus-action charging against the Tier 1 ledger. Real services,
// real DB. Deterministic by construction where it matters: PC paths
// use reported dice; companion paths use AC 5 targets (a miss is
// only a nat 1) and short loops where a hit is required.
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');

const dbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dnd-item3c-'));
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
const cfs = await import(svc('server/services/classFeatureService.js')); // registers RAGE / INSPIRATION / SECOND_WIND
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

async function markerResult(text, characterId, sessionId, key) {
  const res = await pipeline.processResponseMarkers(text, { characterId, sessionId });
  const h = res.handlerResults.filter((hr) => hr.schemaKey === key);
  return h.length ? h[0].result : null;
}

group('1. Pure bonus decision');
{
  ok(tl.bonusDecision({}).allowed, 'fresh budget: bonus free');
  const d = tl.bonusDecision({ bonusSpent: true, bonusSpentBy: 'Rage' });
  ok(!d.allowed && /bonus action already spent/.test(d.reason) && /Rage/.test(d.reason) && /next turn/.test(d.remedy), 'spent bonus refused, names the spender, gives the remedy');
}

group('2. Off-hand charges the bonus; Nick frees it');
{
  const pc = await addPc();
  // Non-Nick dual wielder: main + off, then the bonus is gone.
  const sessionId = await addSession(pc.id);
  const [gob] = await es.createEncounterEnemies(sessionId, 1, [
    { name: 'Off Goblin', maxHp: 60, armorClass: 5, attackBonus: 3, damageDice: '1d6', dexMod: 1 }
  ]);
  const dual = await addCompanion('Dual', pc.id, {
    companion_class: 'Fighter', companion_level: 3,
    equipment: JSON.stringify({ mainHand: { name: 'Shortsword' }, offHand: { name: 'Dagger' } }),
    mastered_weapons: JSON.stringify(['Shortsword'])
  });
  ok(pas.buildAttackProfile('companion', dual, { hand: 'off' }).profile.nickFree !== true, 'Shortsword main hand is not Nick-free');
  const dualKey = await wid.assignWorldId('npcs', dual.npc_id);
  await ct.initializeTurnOrder(sessionId, 1, [
    { name: 'Dual', type: 'companion', key: dualKey },
    { name: 'Off Goblin', type: 'enemy', key: `combat:${sessionId}:1:${gob.id}` },
  ]);
  const e = await enemyRow(gob.id);
  const main = await pas.resolveCompanionAttack(sessionId, pc.id, dual, e, {});
  ok(main.success, 'dual main-hand resolves');
  const off = await pas.resolveCompanionAttack(sessionId, pc.id, dual, e, { hand: 'off' });
  ok(off.success, 'dual off-hand resolves');
  const budget = await tl.getBudget(sessionId, 1, dualKey);
  ok(budget && budget.bonusSpent === true && budget.bonusSpentBy === 'off-hand attack', 'off-hand charges the bonus, named');
  const extra = await pas.resolveCompanionAttack(sessionId, pc.id, dual, e, { bonusAttack: true });
  ok(!extra.success && /bonus action already spent/.test(extra.reason), 'second bonus spend refused after off-hand');
  // Nick (ruling 2026-11-01): OFF-hand Dagger mastered — main-hand
  // Shortsword (Light), off-hand Dagger. Same weapons as the dual
  // case above; only the mastered list differs, and the result flips.
  const sessionId2 = await addSession(pc.id);
  const [gob2] = await es.createEncounterEnemies(sessionId2, 1, [
    { name: 'Nick Goblin', maxHp: 60, armorClass: 5, attackBonus: 3, damageDice: '1d6', dexMod: 1 }
  ]);
  const nick = await addCompanion('Nicker', pc.id, {
    companion_class: 'Rogue', companion_level: 3,
    equipment: JSON.stringify({ mainHand: { name: 'Shortsword' }, offHand: { name: 'Dagger' } }),
    mastered_weapons: JSON.stringify(['Dagger'])
  });
  ok(pas.buildAttackProfile('companion', nick, { hand: 'off' }).profile.nickFree === true, 'mastered Dagger off hand is Nick-free');
  const nickKey = await wid.assignWorldId('npcs', nick.npc_id);
  await ct.initializeTurnOrder(sessionId2, 1, [
    { name: 'Nicker', type: 'companion', key: nickKey },
    { name: 'Nick Goblin', type: 'enemy', key: `combat:${sessionId2}:1:${gob2.id}` },
  ]);
  const e2 = await enemyRow(gob2.id);
  const nMain = await pas.resolveCompanionAttack(sessionId2, pc.id, nick, e2, {});
  ok(nMain.success, 'Nick main-hand resolves');
  const nOff = await pas.resolveCompanionAttack(sessionId2, pc.id, nick, e2, { hand: 'off' });
  ok(nOff.success, 'Nick off-hand resolves');
  const nBudget = await tl.getBudget(sessionId2, 1, nickKey);
  ok(nBudget && !nBudget.bonusSpent, 'Nick off-hand spends no bonus action');
  const nBonus = await pas.resolveCompanionAttack(sessionId2, pc.id, nick, e2, { bonusAttack: true });
  ok(nBonus.success, 'bonus still free after a Nick off-hand attack');
  const nBonus2 = await pas.resolveCompanionAttack(sessionId2, pc.id, nick, e2, { bonusAttack: true });
  ok(!nBonus2.success && /bonus action already spent/.test(nBonus2.reason), 'second bonus attack refused once the bonus is spent');
}

group('3. Bonus-action attacks do not consume Attack-action swings');
{
  const pc = await addPc();
  const sessionId = await addSession(pc.id);
  const [gob] = await es.createEncounterEnemies(sessionId, 1, [
    { name: 'Bonus Goblin', maxHp: 60, armorClass: 5, attackBonus: 3, damageDice: '1d6', dexMod: 1 }
  ]);
  const fighter = await addCompanion('Bonusy', pc.id, {
    companion_class: 'Fighter', companion_level: 5,
    equipment: JSON.stringify({ mainHand: { name: 'Longsword' } })
  });
  const key = await wid.assignWorldId('npcs', fighter.npc_id);
  await ct.initializeTurnOrder(sessionId, 1, [
    { name: 'Bonusy', type: 'companion', key },
    { name: 'Bonus Goblin', type: 'enemy', key: `combat:${sessionId}:1:${gob.id}` },
  ]);
  const e = await enemyRow(gob.id);
  // Bonus attack via the ATTACK marker proves the Bonus field dispatches.
  const m = await markerResult(`[ATTACK: Attacker="Bonusy" Target="Bonus Goblin" Bonus="true"]`, pc.id, sessionId, 'ATTACK');
  ok(m && m.success === true && m.bonusAttack === true, 'Bonus="true" ATTACK marker resolves as a bonus attack');
  const afterBonus = await tl.getBudget(sessionId, 1, key);
  ok(afterBonus && afterBonus.bonusSpent === true && !afterBonus.attackActionTaken && !afterBonus.attacksTaken, 'bonus attack spends the bonus but no swing and no Attack action');
  const s1 = await pas.resolveCompanionAttack(sessionId, pc.id, fighter, e, {});
  const s2 = await pas.resolveCompanionAttack(sessionId, pc.id, fighter, e, {});
  ok(s1.success && s2.success, 'fighter still gets both Extra Attack swings after a bonus attack');
  const s3 = await pas.resolveCompanionAttack(sessionId, pc.id, fighter, e, {});
  ok(!s3.success && /no attacks left/.test(s3.reason), 'third swing refused by the cap, not by the bonus attack');
}

group('4. RAGE charges the bonus; out-of-turn rage is refused clean');
{
  const pc = await addPc();
  const sessionId = await addSession(pc.id);
  const [gob] = await es.createEncounterEnemies(sessionId, 1, [
    { name: 'Rage Goblin', maxHp: 60, armorClass: 5, attackBonus: 3, damageDice: '1d6', dexMod: 1 }
  ]);
  const rager = await addCompanion('Rager', pc.id, {
    companion_class: 'Barbarian', companion_level: 5,
    equipment: JSON.stringify({ mainHand: { name: 'Greataxe' } })
  });
  const key = await wid.assignWorldId('npcs', rager.npc_id);
  await ct.initializeTurnOrder(sessionId, 1, [
    { name: 'Rager', type: 'companion', key },
    { name: 'Rage Goblin', type: 'enemy', key: `combat:${sessionId}:1:${gob.id}` },
  ]);
  const e = await enemyRow(gob.id);
  const r = await markerResult('[RAGE: Target="Rager"]', pc.id, sessionId, 'RAGE');
  ok(r && r.success === true && r.raging === true, 'rage entry succeeds on the barbarian turn');
  const rb = await tl.getBudget(sessionId, 1, key);
  ok(rb && rb.bonusSpent === true && rb.bonusSpentBy === 'Rage', 'rage entry charges the bonus, named');
  const ba = await pas.resolveCompanionAttack(sessionId, pc.id, rager, e, { bonusAttack: true });
  ok(!ba.success && /bonus action already spent/.test(ba.reason), 'bonus attack refused after rage entry');
  // Out of turn: PC goes first, rager second — rage is refused and
  // spends neither the rage use nor the bonus.
  const sessionId2 = await addSession(pc.id);
  const [gob2] = await es.createEncounterEnemies(sessionId2, 1, [
    { name: 'Rage Goblin 2', maxHp: 60, armorClass: 5, attackBonus: 3, damageDice: '1d6', dexMod: 1 }
  ]);
  const rager2 = await addCompanion('Rager2', pc.id, {
    companion_class: 'Barbarian', companion_level: 5,
    equipment: JSON.stringify({ mainHand: { name: 'Greataxe' } })
  });
  const pcKey = await wid.assignWorldId('characters', pc.id);
  const key2 = await wid.assignWorldId('npcs', rager2.npc_id);
  await ct.initializeTurnOrder(sessionId2, 1, [
    { name: 'Tester', type: 'player', key: pcKey },
    { name: 'Rager2', type: 'companion', key: key2 },
    { name: 'Rage Goblin 2', type: 'enemy', key: `combat:${sessionId2}:1:${gob2.id}` },
  ]);
  const r2 = await markerResult('[RAGE: Target="Rager2"]', pc.id, sessionId2, 'RAGE');
  ok(r2 && r2.success === false && /Out of turn/.test(r2.reason), 'out-of-turn rage refused');
  const res2 = await cfs.getClassResources('companion', rager2.id);
  ok(Number(res2.resources.used.rage || 0) === 0, 'refused rage spends no rage use');
  const b2 = await tl.getBudget(sessionId2, 1, key2);
  ok(!b2 || !b2.bonusSpent, 'refused rage spends no bonus action');
}

group('5. SECOND_WIND charges the bonus');
{
  const pc = await addPc();
  const sessionId = await addSession(pc.id);
  const [gob] = await es.createEncounterEnemies(sessionId, 1, [
    { name: 'Wind Goblin', maxHp: 60, armorClass: 5, attackBonus: 3, damageDice: '1d6', dexMod: 1 }
  ]);
  const windy = await addCompanion('Windy', pc.id, {
    companion_class: 'Fighter', companion_level: 5,
    equipment: JSON.stringify({ mainHand: { name: 'Longsword' } })
  });
  const key = await wid.assignWorldId('npcs', windy.npc_id);
  await ct.initializeTurnOrder(sessionId, 1, [
    { name: 'Windy', type: 'companion', key },
    { name: 'Wind Goblin', type: 'enemy', key: `combat:${sessionId}:1:${gob.id}` },
  ]);
  const e = await enemyRow(gob.id);
  const w = await markerResult('[SECOND_WIND: Target="Windy"]', pc.id, sessionId, 'SECOND_WIND');
  ok(w && w.success === true && w.heal > 0, 'second wind heals on the fighter turn');
  const ba = await pas.resolveCompanionAttack(sessionId, pc.id, windy, e, { bonusAttack: true });
  ok(!ba.success && /bonus action already spent/.test(ba.reason), 'bonus attack refused after second wind');
}

group('6. INSPIRATION grant charges the BARD, not the target');
{
  const pc = await addPc();
  const sessionId = await addSession(pc.id);
  const [gob] = await es.createEncounterEnemies(sessionId, 1, [
    { name: 'Bard Goblin', maxHp: 60, armorClass: 5, attackBonus: 3, damageDice: '1d6', dexMod: 1 }
  ]);
  const bard = await addCompanion('Bardy', pc.id, {
    companion_class: 'Bard', companion_level: 5,
    equipment: JSON.stringify({ mainHand: { name: 'Rapier' } })
  });
  const target = await addCompanion('Targety', pc.id, {
    companion_class: 'Fighter', companion_level: 3,
    equipment: JSON.stringify({ mainHand: { name: 'Longsword' } })
  });
  const bardKey = await wid.assignWorldId('npcs', bard.npc_id);
  const targetKey = await wid.assignWorldId('npcs', target.npc_id);
  await ct.initializeTurnOrder(sessionId, 1, [
    { name: 'Bardy', type: 'companion', key: bardKey },
    { name: 'Targety', type: 'companion', key: targetKey },
    { name: 'Bard Goblin', type: 'enemy', key: `combat:${sessionId}:1:${gob.id}` },
  ]);
  const e = await enemyRow(gob.id);
  const g = await markerResult('[INSPIRATION: Target="Targety" Bard="Bardy"]', pc.id, sessionId, 'INSPIRATION');
  ok(g && g.success === true && g.die, 'bardic grant succeeds on the bard turn');
  const bb = await tl.getBudget(sessionId, 1, bardKey);
  ok(bb && bb.bonusSpent === true && bb.bonusSpentBy === 'Bardic Inspiration', 'grant charges the bard bonus');
  const bardBa = await pas.resolveCompanionAttack(sessionId, pc.id, bard, e, { bonusAttack: true });
  ok(!bardBa.success && /bonus action already spent/.test(bardBa.reason), 'bard bonus attack refused after granting');
  // The grant charged the bard's budget in the bard's slot — the
  // target's budget in that same slot is untouched.
  const ledger = await tl.readLedger(sessionId, 1);
  const targetInBardSlot = tl.budgetIn(ledger, tl.slotKeyFor(1, 1, 0), targetKey);
  ok(!targetInBardSlot.bonusSpent, 'target bonus untouched in the bard turn slot');
  await ct.advanceTurn(sessionId, 1);
  const targetBa = await pas.resolveCompanionAttack(sessionId, pc.id, target, e, { bonusAttack: true });
  ok(targetBa.success, 'target bonus attack succeeds on the target turn'); 
}

group('7. Divine Smite: PC report charges, spent bonus refuses');
{
  // PC paladin, reported dice: smite applies and charges the bonus.
  const paladin = await addPc({ name: 'Smite PC', class: 'Paladin', level: 5,
    equipment: JSON.stringify({ mainHand: { name: 'Longsword' } }) });
  const palKey = await wid.assignWorldId('characters', paladin.id);
  const sessionId = await addSession(paladin.id);
  const [gob] = await es.createEncounterEnemies(sessionId, 1, [
    { name: 'Smite Goblin', maxHp: 60, armorClass: 5, attackBonus: 3, damageDice: '1d6', dexMod: 1 }
  ]);
  await ct.initializeTurnOrder(sessionId, 1, [
    { name: 'Smite PC', type: 'player', key: palKey },
    { name: 'Smite Goblin', type: 'enemy', key: `combat:${sessionId}:1:${gob.id}` },
  ]);
  const e = await enemyRow(gob.id);
  const p1 = await pas.createPcPendingAttack(sessionId, paladin.id, paladin, e, { smiteSlot: 1 });
  ok(p1.pending && p1.pending.smite, 'paladin pending carries the smite declaration');
  const r1 = await pas.resolveReportedAttack(sessionId, paladin.id, [20], 10);
  ok(r1 && r1.smite && r1.smite.spent === true, 'reported hit spends the smite slot');
  const sb = await tl.getBudget(sessionId, 1, palKey);
  ok(sb && sb.bonusSpent === true && sb.bonusSpentBy === 'Divine Smite', 'smite cast charges the PC bonus in the declaration slot');
  const p2 = await pas.createPcPendingAttack(sessionId, paladin.id, paladin, e, { bonusAttack: true });
  ok(p2.error && /bonus action already spent/.test(p2.error), 'PC bonus attack refused after smiting');
  // Companion paladin: bonus already spent, so a hit smite is refused
  // and spends no slot. AC 5 means only a nat 1 misses; two swings
  // (Extra Attack) is enough for a hit in all but a 1-in-400 run.
  const pc2 = await addPc({ name: 'Smite PC 2', class: 'Fighter', level: 5 });
  const sessionId2 = await addSession(pc2.id);
  const [gob2] = await es.createEncounterEnemies(sessionId2, 1, [
    { name: 'Smite Goblin 2', maxHp: 60, armorClass: 5, attackBonus: 3, damageDice: '1d6', dexMod: 1 }
  ]);
  const spal = await addCompanion('SmitePal', pc2.id, {
    companion_class: 'Paladin', companion_level: 5,
    equipment: JSON.stringify({ mainHand: { name: 'Longsword' } })
  });
  const spalKey = await wid.assignWorldId('npcs', spal.npc_id);
  await ct.initializeTurnOrder(sessionId2, 1, [
    { name: 'SmitePal', type: 'companion', key: spalKey },
    { name: 'Smite Goblin 2', type: 'enemy', key: `combat:${sessionId2}:1:${gob2.id}` },
  ]);
  const e2 = await enemyRow(gob2.id);
  const first = await pas.resolveCompanionAttack(sessionId2, pc2.id, spal, e2, { bonusAttack: true });
  ok(first.success, 'companion bonus attack spends the bonus first');
  let hitSmite = null;
  for (let i = 0; i < 2 && !hitSmite; i++) {
    const o = await pas.resolveCompanionAttack(sessionId2, pc2.id, spal, e2, { smiteSlot: 1 });
    if (o.hit) hitSmite = o;
  }
  ok(hitSmite && hitSmite.smite && hitSmite.smite.spent === false && /bonus action already spent/.test(hitSmite.smite.reason), 'smite refused when the bonus is already spent, slot untouched');
}

group('8. No turn order: no bonus is tracked (legacy)');
{
  const pc = await addPc();
  const sessionId = await addSession(pc.id);
  const [gob] = await es.createEncounterEnemies(sessionId, 1, [
    { name: 'Free Goblin', maxHp: 60, armorClass: 5, attackBonus: 3, damageDice: '1d6', dexMod: 1 }
  ]);
  const dual = await addCompanion('FreeDual', pc.id, {
    companion_class: 'Fighter', companion_level: 3,
    equipment: JSON.stringify({ mainHand: { name: 'Shortsword' }, offHand: { name: 'Dagger' } })
  });
  const key = await wid.assignWorldId('npcs', dual.npc_id);
  const e = await enemyRow(gob.id);
  // No initializeTurnOrder: pre-combat behavior, ungated.
  const main = await pas.resolveCompanionAttack(sessionId, pc.id, dual, e, {});
  const off = await pas.resolveCompanionAttack(sessionId, pc.id, dual, e, { hand: 'off' });
  const ba = await pas.resolveCompanionAttack(sessionId, pc.id, dual, e, { bonusAttack: true });
  ok(main.success && off.success && ba.success, 'off-hand and bonus attack both pass with no turn order');
  ok((await tl.getBudget(sessionId, 1, key)) === null, 'no order means no ledger budget at all');
  // Marker without order: rage succeeds, bonus untracked.
  const barb = await addCompanion('FreeRager', pc.id, {
    companion_class: 'Barbarian', companion_level: 5,
    equipment: JSON.stringify({ mainHand: { name: 'Greataxe' } })
  });
  const r = await markerResult('[RAGE: Target="FreeRager"]', pc.id, sessionId, 'RAGE');
  ok(r && r.success === true && r.raging === true, 'rage succeeds with no turn order (bootstrap)');
}

console.log('Results: ' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
