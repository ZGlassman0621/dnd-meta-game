// tests/mechanics-hooks-crit.test.js — Mechanics hooks, Family 1
// (crit threshold): judgeAttack's optional threshold, both resolve
// paths, the PC pending block, and the enemy DM-declared threshold
// read side. Throwaway-DB pattern, real services, real DB — same
// harness as tests/item-1b-cleave-push-slow.test.js. System-rolled
// outcomes branch on the roll (a 19 is 1-in-20, so loops retry
// ACROSS attacks with no turn order — never within a turn waiting
// for a hit, per the item-1b Slow lesson; with no turn order there
// is no attack budget, so repeated attacks are legal here).
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');

const dbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dnd-hooks-crit-'));
process.chdir(dbDir);
delete process.env.TURSO_DATABASE_URL;
delete process.env.TURSO_AUTH_TOKEN;

const svc = (rel) => pathToFileURL(path.join(REPO, rel)).href;
const { initDatabase, dbAll, dbGet, dbRun } = await import(svc('server/database.js'));
await initDatabase();
const pas = await import(svc('server/services/partyAttackService.js'));
const es = await import(svc('server/services/enemyCombatService.js'));

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

const pc = await addPc();

// ---------------------------------------------------------------------------
group('1. judgeAttack: threshold, nat 1, nat 20 (pure)');
{
  // Champion at 3rd: 19 crits; at 15th: 18 crits.
  const at19 = pas.judgeAttack({ takenDie: 19, attackBonus: 5, targetAc: 15, critThreshold: 19 });
  ok(at19.hit === true && at19.critical === 'hit', 'a 19 at threshold 19 is a critical hit');
  const at18 = pas.judgeAttack({ takenDie: 18, attackBonus: 5, targetAc: 15, critThreshold: 18 });
  ok(at18.hit === true && at18.critical === 'hit', 'an 18 at threshold 18 is a critical hit');
  // A crit is a hit even when the total would miss the AC.
  const critVsHighAc = pas.judgeAttack({ takenDie: 19, attackBonus: 0, targetAc: 99, critThreshold: 19 });
  ok(critVsHighAc.hit === true && critVsHighAc.critical === 'hit', 'a threshold crit hits even against an unreachable AC');
  // Below the threshold: an ordinary hit or miss by the total.
  const below = pas.judgeAttack({ takenDie: 18, attackBonus: 5, targetAc: 15, critThreshold: 19 });
  ok(below.hit === true && below.critical === null, 'an 18 at threshold 19 is an ordinary hit, not a crit');
  const belowMiss = pas.judgeAttack({ takenDie: 18, attackBonus: 0, targetAc: 99, critThreshold: 19 });
  ok(belowMiss.hit === false && belowMiss.critical === null, 'an 18 at threshold 19 against AC 99 misses');
  // Nat 1 still always misses, even at threshold 18 — a 1 can never
  // meet a threshold of 18+, and the law is explicit.
  const nat1 = pas.judgeAttack({ takenDie: 1, attackBonus: 5, targetAc: 5, critThreshold: 18 });
  ok(nat1.hit === false && nat1.critical === 'miss', 'a nat 1 at threshold 18 is still a miss');
  // Nat 20 still always crits, whatever the threshold.
  const nat20 = pas.judgeAttack({ takenDie: 20, attackBonus: 0, targetAc: 99, critThreshold: 20 });
  ok(nat20.hit === true && nat20.critical === 'hit', 'a nat 20 still always crits');
  // Default threshold is 20: the old call shape still works.
  const def = pas.judgeAttack({ takenDie: 19, attackBonus: 5, targetAc: 15 });
  ok(def.hit === true && def.critical === null, 'no threshold passed means 20 — a 19 is an ordinary hit');
}

// ---------------------------------------------------------------------------
group('2. critThresholdForActor: Champion 3/15, multiclass, non-Champion');
{
  ok(pas.critThresholdForActor({ className: 'Fighter', subclassName: 'Champion', level: 3 }) === 19, 'Champion 3 crits on 19');
  ok(pas.critThresholdForActor({ className: 'Fighter', subclassName: 'Champion', level: 14 }) === 19, 'Champion 14 still crits on 19');
  ok(pas.critThresholdForActor({ className: 'Fighter', subclassName: 'Champion', level: 15 }) === 18, 'Champion 15 crits on 18');
  ok(pas.critThresholdForActor({ className: 'Fighter', subclassName: 'Champion', level: 20 }) === 18, 'Champion 20 crits on 18');
  ok(pas.critThresholdForActor({ className: 'Fighter', subclassName: 'Champion', level: 2 }) === 20, 'Champion 2 (before the feature) stays 20');
  ok(pas.critThresholdForActor({ className: 'Fighter', subclassName: 'Battle Master', level: 15 }) === 20, 'a non-Champion fighter stays 20');
  ok(pas.critThresholdForActor({ className: 'Rogue', subclassName: 'Assassin', level: 10 }) === 20, 'a non-Champion class stays 20');
  ok(pas.critThresholdForActor({}) === 20, 'no class at all stays 20');
  // D6: multiclass reads class_levels — the LOWEST threshold across
  // the actor's classes wins (a fighter-15 Champion / rogue-3).
  const multi = pas.critThresholdForActor({
    className: 'Fighter', subclassName: 'Champion', level: 18,
    classLevels: [{ class: 'Fighter', level: 15, subclass: 'Champion' }, { class: 'Rogue', level: 3, subclass: 'Assassin' }],
  });
  ok(multi === 18, 'multiclass Champion 15 / Rogue 3 crits on 18 (lowest across classes)');
  const multiLow = pas.critThresholdForActor({
    className: 'Rogue', subclassName: 'Assassin', level: 10,
    classLevels: [{ class: 'Rogue', level: 7, subclass: 'Assassin' }, { class: 'Fighter', level: 3, subclass: 'Champion' }],
  });
  ok(multiLow === 19, 'multiclass Rogue 7 / Champion 3 crits on 19');
  ok(pas.hasSubclassFeature({ className: 'Fighter', subclassName: 'Champion', level: 3 }, 'improved_critical') === true, 'hasSubclassFeature finds Improved Critical on a Champion');
  ok(pas.hasSubclassFeature({ className: 'Fighter', subclassName: 'Battle Master', level: 3 }, 'improved_critical') === false, 'hasSubclassFeature does not find it on a Battle Master');
  const feat = pas.featureByKey({ className: 'Fighter', subclassName: 'Champion', level: 15 }, 'superior_critical');
  ok(feat && feat.kind === 'A', 'featureByKey returns Superior Critical at 15');
}

// ---------------------------------------------------------------------------
group('3. Companion real crit doubles the dice (threshold 19)');
{
  const sessionId = await addSession();
  const [target] = await es.createEncounterEnemies(sessionId, 1, [
    { name: 'Crit Dummy', maxHp: 100000, armorClass: 5, attackBonus: 2, damageDice: '1d4', dexMod: 0 }
  ]);
  const champ = await addCompanion('Champ', {
    companion_subclass: 'Champion',
    equipment: JSON.stringify({ mainHand: { name: 'Longsword' } }),
  });
  // Loop until a 19 is rolled: a 19 is 1-in-20 per attack, so 200
  // attacks bound the wait (a miss on a 1 simply does not count).
  let crit19 = null;
  for (let i = 0; i < 200 && !crit19; i++) {
    const o = await pas.resolveCompanionAttack(sessionId, pc.id, champ, await enemyRow(target.id), {});
    if (o.takenDie === 19) crit19 = o;
  }
  ok(crit19 && crit19.critical === 'hit', 'a companion Champion rolling 19 crits (threshold 19)');
  ok(crit19 && crit19.critThreshold === 19, 'the outcome records the threshold it was judged against');
  // A crit doubles the dice: a Longsword is 1d8, so two rolls.
  ok(crit19 && crit19.damageRolls && crit19.damageRolls.length === 2, 'a crit doubles the damage dice (1d8 becomes two rolls)');
  if (crit19) {
    const diceSum = crit19.damageRolls.reduce((a, b) => a + b, 0);
    // Longsword, Str 16 (+3), no other bonus: damage is dice + 3.
    ok(crit19.damage === diceSum + 3, 'crit damage is the doubled dice plus the Strength modifier');
    ok(crit19.damageDealt === crit19.damage, 'no resistance on the dummy, so dealt equals rolled');
  }
  // An 18 for the same Champion is an ordinary hit, not a crit.
  let hit18 = null;
  for (let i = 0; i < 200 && !hit18; i++) {
    const o = await pas.resolveCompanionAttack(sessionId, pc.id, champ, await enemyRow(target.id), {});
    if (o.takenDie === 18) hit18 = o;
  }
  ok(hit18 && hit18.hit === true && hit18.critical === null, 'an 18 for a level-3 Champion is an ordinary hit');
  ok(hit18 && hit18.damageRolls && hit18.damageRolls.length === 1, 'an ordinary hit rolls the dice once');
}

// ---------------------------------------------------------------------------
group('4. Non-Champion stays 20');
{
  const sessionId = await addSession();
  const [target] = await es.createEncounterEnemies(sessionId, 1, [
    { name: 'Plain Dummy', maxHp: 100000, armorClass: 5, attackBonus: 2, damageDice: '1d4', dexMod: 0 }
  ]);
  const bm = await addCompanion('BattleMaster', {
    companion_subclass: 'Battle Master',
    equipment: JSON.stringify({ mainHand: { name: 'Longsword' } }),
  });
  let hit19 = null;
  for (let i = 0; i < 200 && !hit19; i++) {
    const o = await pas.resolveCompanionAttack(sessionId, pc.id, bm, await enemyRow(target.id), {});
    if (o.takenDie === 19) hit19 = o;
  }
  ok(hit19 && hit19.hit === true && hit19.critical === null, 'a 19 for a Battle Master is an ordinary hit (threshold 20)');
  ok(hit19 && hit19.critThreshold === 20, 'the outcome records threshold 20 for a non-Champion');
  ok(hit19 && hit19.damageRolls && hit19.damageRolls.length === 1, 'a non-crit rolls the dice once');
}

// ---------------------------------------------------------------------------
group('5. PC pending block states the threshold; reported 19 crits');
{
  const sessionId = await addSession();
  const [target] = await es.createEncounterEnemies(sessionId, 1, [
    { name: 'PC Crit Dummy', maxHp: 100000, armorClass: 5, attackBonus: 2, damageDice: '1d4', dexMod: 0 }
  ]);
  const champPc = await addPc({
    name: 'Champ PC', class: 'Fighter', subclass: 'Champion', level: 10,
    equipment: JSON.stringify({ mainHand: { name: 'Longsword' } }),
    mastered_weapons: JSON.stringify(['Longsword']),
  });
  const created = await pas.createPcPendingAttack(sessionId, champPc.id, champPc, await enemyRow(target.id), {});
  ok(created.pending && created.pending.critThreshold === 19, 'the pending block carries threshold 19 for a Champion');
  ok(created.pending && (created.pending.featureNotes || []).join(' ').includes('crit on 19'), 'the pending block tells the player they crit on 19–20');
  const reported = await pas.resolveReportedAttack(sessionId, champPc.id, [19], 10);
  ok(reported && reported.hit === true && reported.critical === 'hit', 'a reported 19 for a Champion PC crits');
  ok(reported && reported.damage === 10, 'a reported total is the player’s — the system does not re-roll it on a crit');
  // An 18 for the same PC is an ordinary hit.
  await pas.createPcPendingAttack(sessionId, champPc.id, champPc, await enemyRow(target.id), {});
  const reported18 = await pas.resolveReportedAttack(sessionId, champPc.id, [18], 10);
  ok(reported18 && reported18.hit === true && reported18.critical === null, 'a reported 18 for a level-10 Champion is an ordinary hit');
  // A nat 1 for a Champion PC still misses.
  await pas.createPcPendingAttack(sessionId, champPc.id, champPc, await enemyRow(target.id), {});
  const reported1 = await pas.resolveReportedAttack(sessionId, champPc.id, [1], 0);
  ok(reported1 && reported1.hit === false && reported1.critical === 'miss', 'a reported nat 1 still misses for a Champion');
  // A non-Champion PC gets no threshold line and no threshold below 20.
  const plainPc = await addPc({
    name: 'Plain PC', class: 'Fighter', subclass: 'Battle Master', level: 10,
    equipment: JSON.stringify({ mainHand: { name: 'Longsword' } }),
    mastered_weapons: JSON.stringify(['Longsword']),
  });
  const plainCreated = await pas.createPcPendingAttack(sessionId, plainPc.id, plainPc, await enemyRow(target.id), {});
  ok(plainCreated.pending && plainCreated.pending.critThreshold === 20, 'the pending block carries threshold 20 for a non-Champion');
  ok(plainCreated.pending && !(plainCreated.pending.featureNotes || []).join(' ').includes('crit on'), 'no crit line is stated for a non-Champion');
  const plainReported = await pas.resolveReportedAttack(sessionId, plainPc.id, [19], 10);
  ok(plainReported && plainReported.hit === true && plainReported.critical === null, 'a reported 19 for a non-Champion PC is an ordinary hit');
}

// ---------------------------------------------------------------------------
group('6. Enemy with a DM-declared threshold crits on it (read side)');
{
  // D5: enemies default to nat-20 only because they have no
  // threshold source — but if the enemy row carries a DM-declared
  // threshold, it applies. This tests the read side + the judge;
  // the enemy attack path that consumes it
  // (enemyCombatService.resolveEnemyAttack, `isCrit = attackRoll
  // === 20`) is a HANDOFF patch, not this file.
  ok(pas.enemyCritThreshold({ crit_threshold: 19 }) === 19, 'a top-level crit_threshold on the enemy row is read');
  ok(pas.enemyCritThreshold({ critThreshold: 18 }) === 18, 'the camelCase spelling is read too');
  ok(pas.enemyCritThreshold({ stats_json: JSON.stringify({ crit_threshold: 18 }) }) === 18, 'a threshold inside stats_json is read');
  ok(pas.enemyCritThreshold({}) === 20, 'an enemy with no declared threshold defaults to nat-20 only');
  ok(pas.enemyCritThreshold(null) === 20, 'a missing enemy row defaults to 20');
  ok(pas.enemyCritThreshold({ crit_threshold: 99 }) === 20, 'an out-of-range declared threshold is ignored, not trusted');
  const judged = pas.judgeAttack({ takenDie: 19, attackBonus: 0, targetAc: 99, critThreshold: pas.enemyCritThreshold({ crit_threshold: 19 }) });
  ok(judged.hit === true && judged.critical === 'hit', 'an enemy with a declared 19 crits on a 19');
}

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
process.exit(failed > 0 ? 1 : 0);
