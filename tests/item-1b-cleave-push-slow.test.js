// tests/item-1b-cleave-push-slow.test.js — combat item 1,
// part 2 of 2: weapon properties (Cleave, Push, Slow as real
// mechanics) + the DM fact block.
// Throwaway-DB pattern, real services, real DB — same harness as
// tests/weapons-mastery.test.js. Every assert reads persisted state
// back where the claim is about state, and branches on outcomes
// rather than assuming rolls (server-rolled companion attacks).
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');

const dbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dnd-item1-'));
process.chdir(dbDir);
delete process.env.TURSO_DATABASE_URL;
delete process.env.TURSO_AUTH_TOKEN;

const svc = (rel) => pathToFileURL(path.join(REPO, rel)).href;
const { initDatabase, dbAll, dbGet, dbRun } = await import(svc('server/database.js'));
await initDatabase();
const pas = await import(svc('server/services/partyAttackService.js'));
const es = await import(svc('server/services/enemyCombatService.js'));
const cs = await import(svc('server/services/combatStatsService.js'));
const ts = await import(svc('server/services/combatTurnService.js'));
const mp = await import(svc('server/services/markerPipeline.js'));

let passed = 0, failed = 0;
function group(name) { console.log(`\n== ${name} ==`); }
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
    name: 'Test PC', class: 'Fighter', level: 3, current_hp: 30, max_hp: 30,
    armor_class: 16, ability_scores: JSON.stringify({ str: 16, dex: 16, con: 14, int: 10, wis: 12, cha: 8 }),
    skills: JSON.stringify([]), ...over
  });
  return dbGet('SELECT * FROM characters WHERE id = ?', [id]);
}
async function addCompanion(name, over = {}) {
  const npcId = await insertRow('npcs', { name });
  const id = await insertRow('companions', {
    npc_id: npcId, recruited_by_character_id: pc.id, status: 'active',
    progression_type: 'class_based', companion_class: 'Fighter', companion_level: 3,
    companion_ability_scores: JSON.stringify({ str: 16, dex: 16, con: 14, int: 10, wis: 12, cha: 8 }),
    companion_current_hp: 20, companion_max_hp: 20, armor_class: 15,
    companion_spell_slots_used: JSON.stringify({}), ...over
  });
  const row = await dbGet('SELECT * FROM companions WHERE id = ?', [id]);
  return { ...row, display_name: name };
}
async function addSession() {
  return insertRow('dm_sessions', { character_id: pc.id, status: 'active' });
}
async function enemyRow(id) { return dbGet('SELECT * FROM combat_enemies WHERE id = ?', [id]); }
async function sessionConfig(sessionId) {
  const s = await dbGet('SELECT session_config FROM dm_sessions WHERE id = ?', [sessionId]);
  try { return JSON.parse(s?.session_config || '{}'); } catch { return {}; }
}
async function inventoryOf(kind, id) {
  const table = kind === 'player' ? 'characters' : 'companions';
  const row = await dbGet(`SELECT inventory FROM ${table} WHERE id = ?`, [id]);
  return typeof row?.inventory === 'string' ? JSON.parse(row.inventory || '[]') : (row?.inventory || []);
}

const pc = await addPc();

// ---------------------------------------------------------------------------
group('7. Cleave: flag, real follow-up, validations, once per turn');
{
  const sessionId = await addSession();
  const [a, b] = await es.createEncounterEnemies(sessionId, 1, [
    { name: 'Cleave A', maxHp: 500, armorClass: 5, attackBonus: 2, damageDice: '1d4', dexMod: 0 },
    { name: 'Cleave B', maxHp: 500, armorClass: 5, attackBonus: 2, damageDice: '1d4', dexMod: 0 }
  ]);
  const cleaver = await addCompanion('Cleaver', {
    equipment: JSON.stringify({ mainHand: { name: 'Greataxe' } }),
    mastered_weapons: JSON.stringify(['Greataxe'])
  });
  const noFlag = await pas.resolveCompanionAttack(sessionId, pc.id, cleaver, await enemyRow(b.id), { cleave: true });
  ok(noFlag.success === false && noFlag.reason.includes('no Cleave'), 'a Cleave follow-up with no flag is refused');
  let hitOutcome = null;
  for (let i = 0; i < 60 && !hitOutcome; i++) {
    const o = await pas.resolveCompanionAttack(sessionId, pc.id, cleaver, await enemyRow(a.id), {});
    if (o.hit) hitOutcome = o;
  }
  ok(hitOutcome && hitOutcome.cleaveReady === true, 'a Greataxe hit offers Cleave');
  ok(hitOutcome.masteryNote && hitOutcome.masteryNote.includes('within 5 feet'), 'the Cleave fact states the positioning condition');
  const sameTarget = await pas.resolveCompanionAttack(sessionId, pc.id, cleaver, await enemyRow(a.id), { cleave: true });
  ok(sameTarget.success === false && sameTarget.reason.includes('second creature'), 'a Cleave follow-up may not target the first creature');
  const follow = await pas.resolveCompanionAttack(sessionId, pc.id, cleaver, await enemyRow(b.id), { cleave: true });
  ok(follow.success === true && follow.cleave === true, 'the Cleave follow-up on the second creature goes through');
  if (follow.hit) {
    const diceSum = (follow.damageRolls || []).reduce((x, y) => x + y, 0);
    ok(follow.damage === diceSum, 'Cleave damage equals the dice alone (no ability modifier)');
  }
  const spent = await pas.resolveCompanionAttack(sessionId, pc.id, cleaver, await enemyRow(b.id), { cleave: true });
  ok(spent.success === false && spent.reason.includes('no Cleave'), 'the spent flag does not grant a second follow-up');
  // Once per turn: another hit this turn offers nothing new.
  let secondHit = null;
  for (let i = 0; i < 60 && !secondHit; i++) {
    const o = await pas.resolveCompanionAttack(sessionId, pc.id, cleaver, await enemyRow(a.id), {});
    if (o.hit) secondHit = o;
  }
  ok(secondHit && !secondHit.cleaveReady && secondHit.masteryNote && secondHit.masteryNote.includes('already used'), 'Cleave already used this turn is surfaced, not silently dropped');
  // A non-Cleave weapon cannot spend a Cleave flag at all.
  const swordsman = await addCompanion('SwordCleaver', {
    equipment: JSON.stringify({ mainHand: { name: 'Longsword' } }),
    mastered_weapons: JSON.stringify(['Longsword'])
  });
  const wrongWeapon = await pas.resolveCompanionAttack(sessionId, pc.id, swordsman, await enemyRow(b.id), { cleave: true });
  ok(wrongWeapon.success === false && wrongWeapon.reason.includes('not a Cleave weapon'), 'a longsword cannot make a Cleave follow-up');
}

// ---------------------------------------------------------------------------
group('8. Cleave on the PC reported-dice path');
{
  const sessionId = await addSession();
  const [a, b] = await es.createEncounterEnemies(sessionId, 1, [
    { name: 'PC Cleave A', maxHp: 500, armorClass: 5, attackBonus: 2, damageDice: '1d4', dexMod: 0 },
    { name: 'PC Cleave B', maxHp: 500, armorClass: 5, attackBonus: 2, damageDice: '1d4', dexMod: 0 }
  ]);
  const pcCleaver = await addPc({
    name: 'PC Cleaver',
    equipment: JSON.stringify({ mainHand: { name: 'Greataxe' } }),
    mastered_weapons: JSON.stringify(['Greataxe'])
  });
  await pas.createPcPendingAttack(sessionId, pcCleaver.id, pcCleaver, await enemyRow(a.id), {});
  const r1 = await pas.resolveReportedAttack(sessionId, pcCleaver.id, [20], 10);
  ok(r1 && r1.hit === true && r1.cleaveReady === true, 'a reported PC Greataxe hit offers Cleave');
  const p2 = await pas.createPcPendingAttack(sessionId, pcCleaver.id, pcCleaver, await enemyRow(b.id), { cleave: true });
  ok(p2.pending && p2.pending.cleave === true && p2.pending.damageModifier === 0, 'the PC Cleave pending carries no ability modifier');
  const r2 = await pas.resolveReportedAttack(sessionId, pcCleaver.id, [15], null);
  ok(r2 && r2.hit === true && r2.cleave === true, 'the reported Cleave follow-up resolves as a Cleave attack');
  if (r2.hit) {
    const diceSum = (r2.damageRolls || []).reduce((x, y) => x + y, 0);
    ok(r2.damage === diceSum, 'reported Cleave damage equals the dice alone');
  }
}

// ---------------------------------------------------------------------------
group('9. Push: size gate, unknown size, no push on a kill');
{
  const sessionId = await addSession();
  const [large, huge, custom, frail] = await es.createEncounterEnemies(sessionId, 1, [
    { name: 'Large Brute', maxHp: 500, armorClass: 5, attackBonus: 2, damageDice: '1d4', dexMod: 0,
      statsJson: JSON.stringify({ name: 'Large Brute', size: 'Large', abilities: {}, saves: {}, resistances: [], vulnerabilities: [], immunities: [], conditionImmunities: [] }) },
    { name: 'Huge Brute', maxHp: 500, armorClass: 5, attackBonus: 2, damageDice: '1d4', dexMod: 0,
      statsJson: JSON.stringify({ name: 'Huge Brute', size: 'Huge', abilities: {}, saves: {}, resistances: [], vulnerabilities: [], immunities: [], conditionImmunities: [] }) },
    { name: 'Custom Brute', maxHp: 500, armorClass: 5, attackBonus: 2, damageDice: '1d4', dexMod: 0 },
    { name: 'Frail Brute', maxHp: 1, armorClass: 5, attackBonus: 2, damageDice: '1d4', dexMod: 0 }
  ]);
  const pusher = await addCompanion('Pusher', {
    equipment: JSON.stringify({ mainHand: { name: 'Warhammer' } }),
    mastered_weapons: JSON.stringify(['Warhammer'])
  });
  let largeHit = null;
  for (let i = 0; i < 60 && !largeHit; i++) {
    const o = await pas.resolveCompanionAttack(sessionId, pc.id, pusher, await enemyRow(large.id), {});
    if (o.hit) largeHit = o;
  }
  ok(largeHit && largeHit.pushed && largeHit.pushed.distanceFt === 10, 'a Large target is pushed 10 feet');
  let hugeHit = null;
  for (let i = 0; i < 60 && !hugeHit; i++) {
    const o = await pas.resolveCompanionAttack(sessionId, pc.id, pusher, await enemyRow(huge.id), {});
    if (o.hit) hugeHit = o;
  }
  ok(hugeHit && hugeHit.pushDenied && hugeHit.pushDenied.size === 'Huge', 'a Huge target is refused, with the size stated');
  let customHit = null;
  for (let i = 0; i < 60 && !customHit; i++) {
    const o = await pas.resolveCompanionAttack(sessionId, pc.id, pusher, await enemyRow(custom.id), {});
    if (o.hit) customHit = o;
  }
  ok(customHit && customHit.pushUnverified === true, 'an unknown-size target is left to the DM, not granted silently');
  let killOutcome = null;
  for (let i = 0; i < 60 && !killOutcome; i++) {
    const o = await pas.resolveCompanionAttack(sessionId, pc.id, pusher, await enemyRow(frail.id), {});
    if (o.killed) killOutcome = o;
  }
  ok(killOutcome && !killOutcome.pushed, 'a killing blow does not push the corpse');
}

// ---------------------------------------------------------------------------
group('10. Slow: state, non-stacking, expiry by turn and by proxy');
{
  const sessionId = await addSession();
  const [dummy, other] = await es.createEncounterEnemies(sessionId, 1, [
    { name: 'Slow Dummy', maxHp: 500, armorClass: 5, attackBonus: 2, damageDice: '1d4', dexMod: 0 },
    { name: 'Slow Other', maxHp: 500, armorClass: 5, attackBonus: 2, damageDice: '1d4', dexMod: 0 }
  ]);
  const slower = await addCompanion('Slower', {
    companion_class: 'Ranger',
    equipment: JSON.stringify({ mainHand: { name: 'Whip' } }),
    mastered_weapons: JSON.stringify(['Whip'])
  });
  let slowHit = null;
  for (let i = 0; i < 60 && !slowHit; i++) {
    const o = await pas.resolveCompanionAttack(sessionId, pc.id, slower, await enemyRow(dummy.id), {});
    if (o.hit && (o.damageDealt ?? o.damage) > 0) slowHit = o;
  }
  ok(slowHit && slowHit.slowed && slowHit.slowed.amount === 10, 'a Whip hit slows by 10 feet');
  const slowed = await pas.getSlowedEnemies(sessionId);
  ok(slowed[dummy.id] && slowed[dummy.id].ownerKey === `companion:${slower.id}`, 'Slow state persists keyed by enemy, owned by the slower');
  // Non-stacking: another hit refreshes, it does not double.
  let slowHit2 = null;
  for (let i = 0; i < 60 && !slowHit2; i++) {
    const o = await pas.resolveCompanionAttack(sessionId, pc.id, slower, await enemyRow(dummy.id), {});
    if (o.hit && (o.damageDealt ?? o.damage) > 0) slowHit2 = o;
  }
  const slowed2 = await pas.getSlowedEnemies(sessionId);
  ok(slowed2[dummy.id] && slowed2[dummy.id].amount === 10, 'a second Slow does not stack to 20');
  // Proxy expiry (no turn order): the slower's next attack on another
  // target clears the old Slow.
  await pas.resolveCompanionAttack(sessionId, pc.id, slower, await enemyRow(other.id), {});
  const slowed3 = await pas.getSlowedEnemies(sessionId);
  ok(!slowed3[dummy.id], 'with no turn order, the slower’s next attack clears the old Slow (proxy for their next turn)');

  // Turn-order expiry: initialize the order, slow, then advance to the
  // slower's next turn and watch it expire.
  const sessionId2 = await addSession();
  const [td] = await es.createEncounterEnemies(sessionId2, 1, [
    { name: 'Turn Dummy', maxHp: 500, armorClass: 5, attackBonus: 2, damageDice: '1d4', dexMod: 0 }
  ]);
  await ts.initializeTurnOrder(sessionId2, 1, [
    { name: 'Slower', type: 'companion', roll: 10, modifier: 0, initiative: 10 },
    { name: 'Turn Dummy', type: 'enemy', roll: 5, modifier: 0, initiative: 5 }
  ]);
  // Under turn order a level-3 companion gets ONE swing per turn, so
  // retrying in the same turn can never land a hit after a miss
  // (a nat 1, 1-in-20, is what flaked this group). Retry across
  // turns instead: a miss consumes the turn, so advance past the
  // enemy back to the slower and swing again.
  let turnHit = null;
  for (let r = 0; r < 20 && !turnHit; r++) {
    const o = await pas.resolveCompanionAttack(sessionId2, pc.id, slower, await enemyRow(td.id), {});
    if (o.hit && (o.damageDealt ?? o.damage) > 0) turnHit = o;
    else { await ts.advanceTurn(sessionId2, 1); await ts.advanceTurn(sessionId2, 1); }
  }
  ok(turnHit && turnHit.slowed, 'Slow applied under turn order');
  await ts.advanceTurn(sessionId2, 1);
  const mid = await pas.getSlowedEnemies(sessionId2);
  ok(mid[td.id], 'Slow survives the enemy’s turn (it ends at the slower’s next turn, not the target’s)');
  await ts.advanceTurn(sessionId2, 1);
  const after = await pas.getSlowedEnemies(sessionId2);
  ok(!after[td.id], 'Slow expires when the order lands back on the slower');
}

// ---------------------------------------------------------------------------
group('11. DM fact block narrates the new facts');
{
  const block = await pas.formatAttackOutcomeBlock([
    { hit: true, attacker: 'Archer', target: 'Goblin', weapon: 'Longbow', dice: [12], takenDie: 12, attackBonus: 5, total: 17, targetAc: 15, damage: 6, damageRolls: [6], damageType: 'piercing', ammo: { type: 'arrows', remaining: 11 } },
    { hit: true, attacker: 'Thrower', target: 'Goblin', weapon: 'Handaxe', dice: [14], takenDie: 14, attackBonus: 5, total: 19, targetAc: 15, damage: 5, damageRolls: [5], damageType: 'slashing', thrown: true, thrownRange: '20/60' },
    { hit: true, attacker: 'Dual', target: 'Goblin', weapon: 'Dagger', dice: [10], takenDie: 10, attackBonus: 5, total: 15, targetAc: 15, damage: 3, damageRolls: [3], damageType: 'piercing', offHandAttack: true },
    { hit: true, attacker: 'Cleaver', target: 'Goblin B', weapon: 'Greataxe', dice: [16], takenDie: 16, attackBonus: 5, total: 21, targetAc: 15, damage: 9, damageRolls: [9], damageType: 'slashing', cleave: true, masteryNote: 'Cleave: test note.' }
  ]);
  ok(block.includes('Ammo: arrows spent'), 'block narrates spent ammo');
  ok(block.includes('Thrown attack'), 'block narrates a thrown attack');
  ok(block.includes('Off-hand attack'), 'block narrates an off-hand attack');
  ok(block.includes('Cleave follow-up'), 'block narrates a Cleave follow-up');
}

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
process.exit(failed > 0 ? 1 : 0);
