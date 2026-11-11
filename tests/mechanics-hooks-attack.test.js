// tests/mechanics-hooks-attack.test.js — Mechanics hooks, Family 4
// (attack passives / conditionals): Divine Fury settle-time math,
// Survivor turn-start heal, the PC pending-instruction split,
// computeAttackMode's subclass advantage source, the Kind-F
// proficiency grants on the profile, and Improved Circle Forms'
// conditional modifiers. Throwaway-DB pattern, real services, real
// DB — same harness as tests/item-1b-cleave-push-slow.test.js.
// The item-1b Slow lesson applies throughout: retry attacks ACROSS
// turns/attacks, never loop within a turn waiting for a hit; with
// no turn order there is no attack budget, so repeated attacks are
// legal here. Every assert on a system-rolled outcome models the
// branches (crits double dice; a nat 1 misses; the once-per-turn
// flag is consumed on the first hit, not on a miss).
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');

const dbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dnd-hooks-attack-'));
process.chdir(dbDir);
delete process.env.TURSO_DATABASE_URL;
delete process.env.TURSO_AUTH_TOKEN;

const svc = (rel) => pathToFileURL(path.join(REPO, rel)).href;
const { initDatabase, dbAll, dbGet, dbRun } = await import(svc('server/database.js'));
await initDatabase();
const pas = await import(svc('server/services/partyAttackService.js'));
const es = await import(svc('server/services/enemyCombatService.js'));
const ts = await import(svc('server/services/combatTurnService.js'));

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
async function addSession(characterId = pc.id) {
  return insertRow('dm_sessions', { character_id: characterId, status: 'active' });
}
async function enemyRow(id) { return dbGet('SELECT * FROM combat_enemies WHERE id = ?', [id]); }
function pcRow(over = {}) {
  return {
    class: 'Fighter', subclass: null, level: 3,
    ability_scores: JSON.stringify({ str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }),
    equipment: JSON.stringify({}), feats: JSON.stringify([]),
    class_resources_json: JSON.stringify({}), mastered_weapons: JSON.stringify([]),
    frost_exhaustion: 0, ...over,
  };
}

const pc = await addPc();

// ---------------------------------------------------------------------------
group('1. Divine Fury: companion real math, first hit only');
{
  const sessionId = await addSession();
  const [target] = await es.createEncounterEnemies(sessionId, 1, [
    { name: 'Fury Dummy', maxHp: 100000, armorClass: 5, attackBonus: 2, damageDice: '1d4', dexMod: 0 }
  ]);
  // Level-10 Zealot, Raging: Divine Fury is 1d6 + half level (5).
  // Greataxe, Str 16 (+3), Rage +3 at level 10: weapon modifier +6.
  const zealot = await addCompanion('Zealot', {
    companion_class: 'Barbarian', companion_subclass: 'Path of the Zealot', companion_level: 10,
    class_resources_json: JSON.stringify({ used: {}, raging: true }),
    equipment: JSON.stringify({ mainHand: { name: 'Greataxe' } }),
  });
  let firstHit = null;
  for (let i = 0; i < 200 && !firstHit; i++) {
    const o = await pas.resolveCompanionAttack(sessionId, pc.id, zealot, await enemyRow(target.id), {});
    if (o.hit) firstHit = o;
  }
  ok(firstHit && firstHit.divineFury && firstHit.divineFury.applied === true, 'the first hit while Raging carries Divine Fury');
  ok(firstHit && firstHit.divineFury && firstHit.divineFury.dice === '1d6' && firstHit.divineFury.flat === 5, 'Divine Fury is 1d6 + 5 at barbarian level 10');
  ok(firstHit && firstHit.divineFury && firstHit.divineFury.damageType === 'radiant', 'Divine Fury defaults to Radiant for a server roll (Necrotic is the declared alternative)');
  if (firstHit && firstHit.divineFury) {
    const furySum = firstHit.divineFury.rolls.reduce((a, b) => a + b, 0);
    ok(firstHit.divineFury.damage === furySum + 5, 'Divine Fury damage is the 1d6 roll plus 5');
    const weaponSum = firstHit.damageRolls.reduce((a, b) => a + b, 0);
    // Weapon dice + Str 3 + Rage 3, plus the Fury packet. On a crit
    // the weapon dice are doubled — the sum still accounts for it.
    ok(firstHit.damage === weaponSum + 6 + firstHit.divineFury.damage, 'the total is weapon dice + 6 (Str + Rage) + Divine Fury');
    ok(firstHit.damageDealt === firstHit.damage, 'no resistance on the dummy, so dealt equals rolled');
    ok((firstHit.featureNotes || []).join(' ').includes('Divine Fury'), 'the outcome narrates Divine Fury');
  }
  // Second hit, same turn: the once-per-turn flag is spent.
  let secondHit = null;
  for (let i = 0; i < 200 && !secondHit; i++) {
    const o = await pas.resolveCompanionAttack(sessionId, pc.id, zealot, await enemyRow(target.id), {});
    if (o.hit) secondHit = o;
  }
  ok(secondHit && secondHit.divineFury && secondHit.divineFury.applied === false, 'the second hit this turn does not pay Divine Fury again');
  ok(secondHit && secondHit.divineFury && secondHit.divineFury.reason && secondHit.divineFury.reason.includes('already used'), 'the refusal names the once-per-turn flag');
  if (secondHit) {
    const weaponSum2 = secondHit.damageRolls.reduce((a, b) => a + b, 0);
    ok(secondHit.damage === weaponSum2 + 6, 'the second hit’s total is weapon dice + 6 only — no Fury packet');
  }
  // Not Raging: no Divine Fury at all, even on a hit.
  const calm = await addCompanion('Calm Zealot', {
    companion_class: 'Barbarian', companion_subclass: 'Path of the Zealot', companion_level: 10,
    class_resources_json: JSON.stringify({ used: {} }),
    equipment: JSON.stringify({ mainHand: { name: 'Greataxe' } }),
  });
  let calmHit = null;
  for (let i = 0; i < 200 && !calmHit; i++) {
    const o = await pas.resolveCompanionAttack(sessionId, pc.id, calm, await enemyRow(target.id), {});
    if (o.hit) calmHit = o;
  }
  ok(calmHit && calmHit.divineFury == null, 'a Zealot who is not Raging gets no Divine Fury');
}

// ---------------------------------------------------------------------------
group('2. Survivor turn-start heal via advanceTurn (PC + companion)');
{
  // (a) PC Champion 18, bloodied at 12/40, Con 16 (+3): heals 8.
  const champPc = await addPc({
    name: 'Champ Survivor', class: 'Fighter', subclass: 'Champion', level: 18,
    current_hp: 12, max_hp: 40,
    ability_scores: JSON.stringify({ str: 16, dex: 16, con: 16, int: 10, wis: 12, cha: 8 }),
  });
  const s1 = await addSession(champPc.id);
  await es.createEncounterEnemies(s1, 1, [
    { name: 'Survivor Goblin', maxHp: 100, armorClass: 5, attackBonus: 2, damageDice: '1d4', dexMod: 0 }
  ]);
  await ts.initializeTurnOrder(s1, 1, [
    { name: 'Survivor Goblin', type: 'enemy', roll: 5, modifier: 0, initiative: 5 },
    { name: 'Champ Survivor', type: 'player', roll: 10, modifier: 0, initiative: 10 },
  ]);
  const afterTurn = await ts.advanceTurn(s1, 1);
  ok(afterTurn && afterTurn.turnStartHeal && afterTurn.turnStartHeal.amount === 8, 'Survivor heals 5 + Con mod (8) at the start of the Champion’s turn');
  ok(afterTurn && afterTurn.turnStartHeal && afterTurn.turnStartHeal.actor === 'Champ Survivor', 'the heal names its actor');
  const healedPc = await dbGet('SELECT current_hp FROM characters WHERE id = ?', [champPc.id]);
  ok(healedPc && healedPc.current_hp === 20, 'the PC’s HP moves 12 → 20 (read back from the row)');
  // (b) Not bloodied at 30/40: no heal, HP untouched.
  const healthyPc = await addPc({
    name: 'Healthy Champ', class: 'Fighter', subclass: 'Champion', level: 18,
    current_hp: 30, max_hp: 40,
    ability_scores: JSON.stringify({ str: 16, dex: 16, con: 16, int: 10, wis: 12, cha: 8 }),
  });
  const s2 = await addSession(healthyPc.id);
  await es.createEncounterEnemies(s2, 1, [
    { name: 'Healthy Goblin', maxHp: 100, armorClass: 5, attackBonus: 2, damageDice: '1d4', dexMod: 0 }
  ]);
  await ts.initializeTurnOrder(s2, 1, [
    { name: 'Healthy Goblin', type: 'enemy', roll: 5, modifier: 0, initiative: 5 },
    { name: 'Healthy Champ', type: 'player', roll: 10, modifier: 0, initiative: 10 },
  ]);
  const afterHealthy = await ts.advanceTurn(s2, 1);
  ok(!afterHealthy?.turnStartHeal, 'a Champion above half HP gets no Survivor heal');
  const stillHealthy = await dbGet('SELECT current_hp FROM characters WHERE id = ?', [healthyPc.id]);
  ok(stillHealthy && stillHealthy.current_hp === 30, 'HP is untouched when not bloodied');
  // (c) Companion Champion 18, bloodied at 10/40, Con 16: heals 8.
  const s3 = await addSession();
  await es.createEncounterEnemies(s3, 1, [
    { name: 'Comp Goblin', maxHp: 100, armorClass: 5, attackBonus: 2, damageDice: '1d4', dexMod: 0 }
  ]);
  const survComp = await addCompanion('Survivor Comp', {
    companion_class: 'Fighter', companion_subclass: 'Champion', companion_level: 18,
    companion_ability_scores: JSON.stringify({ str: 16, dex: 16, con: 16, int: 10, wis: 12, cha: 8 }),
    companion_current_hp: 10, companion_max_hp: 40,
  });
  await ts.initializeTurnOrder(s3, 1, [
    { name: 'Comp Goblin', type: 'enemy', roll: 5, modifier: 0, initiative: 5 },
    { name: 'Survivor Comp', type: 'companion', roll: 10, modifier: 0, initiative: 10 },
  ]);
  const afterComp = await ts.advanceTurn(s3, 1);
  ok(afterComp && afterComp.turnStartHeal && afterComp.turnStartHeal.amount === 8, 'a bloodied Champion companion heals 8 at turn start');
  const healedComp = await dbGet('SELECT companion_current_hp FROM companions WHERE id = ?', [survComp.id]);
  ok(healedComp && healedComp.companion_current_hp === 18, 'the companion’s HP moves 10 → 18 (read back from the row)');
  // (d) A non-Champion at the same table gets nothing.
  const plainPc = await addPc({
    name: 'Plain Survivor', class: 'Fighter', subclass: 'Battle Master', level: 18,
    current_hp: 12, max_hp: 40,
    ability_scores: JSON.stringify({ str: 16, dex: 16, con: 16, int: 10, wis: 12, cha: 8 }),
  });
  const s4 = await addSession(plainPc.id);
  await es.createEncounterEnemies(s4, 1, [
    { name: 'Plain Goblin', maxHp: 100, armorClass: 5, attackBonus: 2, damageDice: '1d4', dexMod: 0 }
  ]);
  await ts.initializeTurnOrder(s4, 1, [
    { name: 'Plain Goblin', type: 'enemy', roll: 5, modifier: 0, initiative: 5 },
    { name: 'Plain Survivor', type: 'player', roll: 10, modifier: 0, initiative: 10 },
  ]);
  const afterPlain = await ts.advanceTurn(s4, 1);
  ok(!afterPlain?.turnStartHeal, 'a bloodied Battle Master gets no Survivor heal');
}

// ---------------------------------------------------------------------------
group('3. PC pending instructions — never a silently added total');
{
  const sessionId = await addSession();
  const [target] = await es.createEncounterEnemies(sessionId, 1, [
    { name: 'PC Fury Dummy', maxHp: 100000, armorClass: 5, attackBonus: 2, damageDice: '1d4', dexMod: 0 }
  ]);
  // Zealot PC, Raging: the pending block instructs; the system adds
  // nothing to the reported total.
  const zealotPc = await addPc({
    name: 'Zealot PC', class: 'Barbarian', subclass: 'Path of the Zealot', level: 10,
    class_resources_json: JSON.stringify({ used: {}, raging: true }),
    equipment: JSON.stringify({ mainHand: { name: 'Greataxe' } }),
    mastered_weapons: JSON.stringify(['Greataxe']),
  });
  const created = await pas.createPcPendingAttack(sessionId, zealotPc.id, zealotPc, await enemyRow(target.id), {});
  ok(created.pending && created.pending.divineFury && created.pending.divineFury.dice === '1d6' && created.pending.divineFury.flat === 5, 'the pending block carries Divine Fury 1d6+5');
  ok(created.pending && (created.pending.featureNotes || []).join(' ').includes('Divine Fury'), 'the pending block instructs the player to add Divine Fury');
  const reported = await pas.resolveReportedAttack(sessionId, zealotPc.id, [15], 12);
  ok(reported && reported.hit === true, 'the reported Zealot attack hits');
  ok(reported && reported.damage === 12, 'the reported total stands untouched — the system adds no Fury dice to it');
  ok(reported && reported.divineFury && reported.divineFury.applied === false, 'the outcome records Divine Fury as player-applied, not system-applied');
  // The profile itself carries no flat Fury bonus: a flat bonus
  // would pay it on every hit. Rage (+3 at level 10) is the only
  // flat subclass-adjacent bonus on the profile.
  // MERGE FIX (2026-11-09): the probe row needs a melee weapon —
  // buildAttackProfile only adds the Rage flat bonus when
  // profile.rangeType is 'melee', and with no weapon equipped the
  // profile has no rangeType, so the bonus was 0, not 3. The
  // DB-backed Zealot above already carries a Greataxe; the probe
  // row must too. Product code unchanged.
  const built = pas.buildAttackProfile('player', pcRow({
    class: 'Barbarian', subclass: 'Path of the Zealot', level: 10,
    ability_scores: JSON.stringify({ str: 16, dex: 16, con: 14, int: 10, wis: 12, cha: 8 }),
    class_resources_json: JSON.stringify({ used: {}, raging: true }),
    equipment: JSON.stringify({ mainHand: { name: 'Greataxe' } }),
    mastered_weapons: JSON.stringify(['Greataxe']),
  }), {});
  ok(built.profile && built.profile.divineFury && built.profile.divineFury.flat === 5, 'the profile records Divine Fury as settle-time data');
  ok(built.profile && built.profile.featureDamageBonus === 3, 'the flat profile bonus is Rage (+3) only — no Fury dice in it');
  // Forge Divine Strike rides the same pending split.
  const forgePc = await addPc({
    name: 'Forge PC', class: 'Cleric', subclass: 'Forge Domain', level: 6,
    ability_scores: JSON.stringify({ str: 14, dex: 10, con: 14, int: 10, wis: 16, cha: 8 }),
    equipment: JSON.stringify({ mainHand: { name: 'Warhammer' } }),
    mastered_weapons: JSON.stringify(['Warhammer']),
  });
  const forgeCreated = await pas.createPcPendingAttack(sessionId, forgePc.id, forgePc, await enemyRow(target.id), {});
  ok(forgeCreated.pending && forgeCreated.pending.divineStrike && forgeCreated.pending.divineStrike.dice === '1d8' && forgeCreated.pending.divineStrike.damageType === 'fire', 'the pending block carries Forge Divine Strike 1d8 fire');
  const forgeReported = await pas.resolveReportedAttack(sessionId, forgePc.id, [15], 9);
  ok(forgeReported && forgeReported.damage === 9, 'a reported Forge total is untouched by Divine Strike');
  ok(forgeReported && forgeReported.divineStrike && forgeReported.divineStrike.applied === false, 'Divine Strike is recorded as player-applied on a reported total');
}

// ---------------------------------------------------------------------------
group('4. computeAttackMode: subclass advantage source (Assassinate)');
{
  const assassinPc = await addPc({
    name: 'Assassin PC', class: 'Rogue', subclass: 'Assassin', level: 3,
  });
  // Round 1, target has not acted: advantage.
  const s1 = await addSession(assassinPc.id);
  const [target] = await es.createEncounterEnemies(s1, 1, [
    { name: 'Mark Dummy', maxHp: 100000, armorClass: 5, attackBonus: 2, damageDice: '1d4', dexMod: 0 }
  ]);
  await ts.initializeTurnOrder(s1, 1, [
    { name: 'Assassin PC', type: 'player', roll: 10, modifier: 0, initiative: 10 },
    { name: 'Mark Dummy', type: 'enemy', roll: 5, modifier: 0, initiative: 5 },
  ]);
  const withOrder = await pas.computeAttackMode('player', assassinPc.id, await enemyRow(target.id), {}, s1);
  ok(withOrder.mode === 'advantage', 'Assassinate grants advantage in round 1 against a target that has not acted');
  ok(withOrder.reasons.join(' ').includes('Assassinate'), 'the reason names Assassinate');
  // No turn order: the trigger cannot be evaluated, so no advantage
  // is granted (fail closed — the mode never guesses).
  const s2 = await addSession(assassinPc.id);
  const [target2] = await es.createEncounterEnemies(s2, 1, [
    { name: 'Mark Dummy 2', maxHp: 100000, armorClass: 5, attackBonus: 2, damageDice: '1d4', dexMod: 0 }
  ]);
  const noOrder = await pas.computeAttackMode('player', assassinPc.id, await enemyRow(target2.id), {}, s2);
  ok(noOrder.mode === null, 'with no turn order Assassinate grants no advantage (fail closed)');
  // A non-Assassin in the same round-1 seat gets no advantage.
  const plainPc = await addPc({
    name: 'Plain Rogue', class: 'Rogue', subclass: 'Thief', level: 3,
  });
  const s3 = await addSession(plainPc.id);
  const [target3] = await es.createEncounterEnemies(s3, 1, [
    { name: 'Mark Dummy 3', maxHp: 100000, armorClass: 5, attackBonus: 2, damageDice: '1d4', dexMod: 0 }
  ]);
  await ts.initializeTurnOrder(s3, 1, [
    { name: 'Plain Rogue', type: 'player', roll: 10, modifier: 0, initiative: 10 },
    { name: 'Mark Dummy 3', type: 'enemy', roll: 5, modifier: 0, initiative: 5 },
  ]);
  const plainMode = await pas.computeAttackMode('player', plainPc.id, await enemyRow(target3.id), {}, s3);
  ok(plainMode.mode === null, 'a Thief in the same seat gets no Assassinate advantage');
}

// ---------------------------------------------------------------------------
group('5. Kind-F reclassifications land on the profile as grants, not math');
{
  // Martial Training (Valor bard): medium armor, shields, simple +
  // martial weapons, plus weapon-as-focus.
  const bard = pas.buildAttackProfile('player', pcRow({
    class: 'Bard', subclass: 'College of Valor', level: 3,
    ability_scores: JSON.stringify({ str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 16 }),
  }), {});
  const martial = (bard.profile.subclassProficiencies || []).find((p) => p.feature === 'martial_training');
  ok(martial && martial.grants.includes('martial weapons') && martial.grants.includes('medium armor'), 'Martial Training grants martial weapons + medium armor on the profile');
  ok(martial && martial.focus && martial.focus.includes('spellcasting focus'), 'Martial Training records the weapon-as-focus limb');
  ok(bard.profile.featureDamageBonus === 0, 'Martial Training adds no damage bonus to the profile');
  ok(!(bard.profile.featureNotes || []).join(' ').includes('Martial Training'), 'the grant is profile data, not narrated attack math');
  // Student of War (Battle Master fighter): artisan tools.
  const fighter = pas.buildAttackProfile('player', pcRow({
    class: 'Fighter', subclass: 'Battle Master', level: 3,
  }), {});
  const student = (fighter.profile.subclassProficiencies || []).find((p) => p.feature === 'student_of_war');
  ok(student && student.grants.join(' ').includes('artisan tools'), 'Student of War grants artisan tools on the profile');
  ok(fighter.profile.featureDamageBonus === 0, 'Student of War adds no damage bonus');
  // Assassin's Tools (Assassin rogue): both kits.
  const rogue = pas.buildAttackProfile('player', pcRow({
    class: 'Rogue', subclass: 'Assassin', level: 3,
  }), {});
  const tools = (rogue.profile.subclassProficiencies || []).find((p) => p.feature === 'assassins_tools');
  ok(tools && tools.grants.includes('Disguise Kit') && tools.grants.includes("Poisoner's Kit"), 'Assassin’s Tools grants both kits on the profile');
  ok(rogue.profile.featureDamageBonus === 0, 'Assassin’s Tools adds no damage bonus');
}

// ---------------------------------------------------------------------------
group('6. Improved Circle Forms: conditional modifiers, gated on form state');
{
  const inForm = pas.buildAttackProfile('player', pcRow({
    class: 'Druid', subclass: 'Circle of the Moon', level: 6,
    ability_scores: JSON.stringify({ str: 10, dex: 10, con: 14, int: 10, wis: 16, cha: 10 }),
    transformed_form: JSON.stringify({ kind: 'wild_shape', until: 'start of next turn' }),
  }), {});
  ok(inForm.profile && inForm.profile.formMagicalAttacks === true, 'in a Wild Shape form, the druid’s attacks count as magical');
  ok(inForm.profile && inForm.profile.lunarRadiance === true, 'in a form, the Radiant damage choice is recorded');
  ok(inForm.profile && (inForm.profile.featureNotes || []).join(' ').includes('Radiant'), 'the pending notes state the Radiant choice');
  const outOfForm = pas.buildAttackProfile('player', pcRow({
    class: 'Druid', subclass: 'Circle of the Moon', level: 6,
    ability_scores: JSON.stringify({ str: 10, dex: 10, con: 14, int: 10, wis: 16, cha: 10 }),
  }), {});
  ok(outOfForm.profile && !outOfForm.profile.formMagicalAttacks, 'out of a form, attacks are not magical');
  ok(outOfForm.profile && !outOfForm.profile.lunarRadiance, 'out of a form, no Radiant choice is recorded');
  // Lunar Form (Moon 14): once-per-turn +2d10 Radiant on a form hit.
  const lunar = pas.buildAttackProfile('player', pcRow({
    class: 'Druid', subclass: 'Circle of the Moon', level: 14,
    ability_scores: JSON.stringify({ str: 10, dex: 10, con: 14, int: 10, wis: 16, cha: 10 }),
    transformed_form: JSON.stringify({ kind: 'wild_shape', until: 'start of next turn' }),
  }), {});
  ok(lunar.profile && lunar.profile.lunarRadianceBonus && lunar.profile.lunarRadianceBonus.dice === '2d10', 'Lunar Form records +2d10 Radiant once per turn (dice parsed from the registry feature)');
  const lunarOut = pas.buildAttackProfile('player', pcRow({
    class: 'Druid', subclass: 'Circle of the Moon', level: 14,
    ability_scores: JSON.stringify({ str: 10, dex: 10, con: 14, int: 10, wis: 16, cha: 10 }),
  }), {});
  ok(lunarOut.profile && !lunarOut.profile.lunarRadianceBonus, 'Lunar Form pays nothing out of a form');
}

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
process.exit(failed > 0 ? 1 : 0);
