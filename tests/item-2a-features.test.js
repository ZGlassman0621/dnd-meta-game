// tests/item-2a-features.test.js — combat item 2, Tier 1:
// class-feature math in the attack paths (companion math, PC
// instructions) + fighting styles + 2024 table corrections.
// Throwaway-DB pattern, real services, real DB — same harness as
// tests/item-1a-*.test.js. Companion damage is system-rolled, so
// asserts on outcomes are branch-aware (a natural 1 always misses,
// and a miss consumes no feature) rather than assuming a hit.
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');

const dbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dnd-item2a-'));
process.chdir(dbDir);
delete process.env.TURSO_DATABASE_URL;
delete process.env.TURSO_AUTH_TOKEN;

const svc = (rel) => pathToFileURL(path.join(REPO, rel)).href;
const { initDatabase, dbAll, dbGet, dbRun } = await import(svc('server/database.js'));
await initDatabase();
const pas = await import(svc('server/services/partyAttackService.js'));
const es = await import(svc('server/services/enemyCombatService.js'));
const cs = await import(svc('server/services/combatStatsService.js'));
const cf = await import(svc('server/services/classFeatureService.js'));

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
async function addSession() { return insertRow('dm_sessions', { character_id: pc.id, status: 'active' }); }
async function enemyRow(id) { return dbGet('SELECT * FROM combat_enemies WHERE id = ?', [id]); }

const pc = await addPc();

// ---------------------------------------------------------------------------
group('1. Pure 2024 tables (corrections, not 2014 carry-overs)');
{
  ok(cf.sneakAttackDice(1) === 1 && cf.sneakAttackDice(5) === 3 && cf.sneakAttackDice(20) === 10, 'sneak dice 1/3/10 at L1/5/20');
  ok(cf.rageDamage(1) === 2 && cf.rageDamage(9) === 3 && cf.rageDamage(16) === 4, 'rage damage 2/3/4');
  ok(cf.rageUses(1) === 2 && cf.rageUses(3) === 3 && cf.rageUses(6) === 4 && cf.rageUses(12) === 5 && cf.rageUses(17) === 6 && cf.rageUses(20) === 6, 'rage uses 2/3/4/5/6 — L20 is 6, not Unlimited');
  ok(cf.martialArtsDie(1) === 'd6' && cf.martialArtsDie(5) === 'd8' && cf.martialArtsDie(11) === 'd10' && cf.martialArtsDie(17) === 'd12', 'martial arts die is the 2024 d6/d8/d10/d12 ladder');
  ok(cf.bardicDie(1) === 'd6' && cf.bardicDie(5) === 'd8' && cf.bardicDie(10) === 'd10' && cf.bardicDie(15) === 'd12', 'bardic die ladder');
  ok(cf.smiteDice(1).dice === '2d8' && cf.smiteDice(2).dice === '3d8' && cf.smiteDice(3, { fiendOrUndead: true }).dice === '5d8', 'smite dice 2d8 / 3d8 / 5d8 vs fiend at 3rd');
  ok(cf.extraAttackCount('Fighter', 5) === 1 && cf.extraAttackCount('Fighter', 11) === 2 && cf.extraAttackCount('Fighter', 20) === 3, 'fighter extra attack count recorded (not granted)');
  ok(cf.extraAttackCount('Paladin', 5) === 1 && cf.extraAttackCount('Wizard', 5) === 0, 'non-fighter extra attack count');
}

// ---------------------------------------------------------------------------
group('2. Sneak Attack: profile eligibility + companion once per turn');
{
  const rogue = await addCompanion('Sneaky', {
    companion_class: 'Rogue', companion_level: 5,
    equipment: JSON.stringify({ mainHand: { name: 'Dagger' } }),
  });
  const prof = pas.buildAttackProfile('companion', rogue, {}).profile;
  ok(prof.sneakEligible === true && prof.sneakDice === '3d6', 'rogue L5 dagger: sneak eligible, 3d6');
  const fighter = await addCompanion('NoSneak', {
    equipment: JSON.stringify({ mainHand: { name: 'Dagger' } }),
  });
  ok(pas.buildAttackProfile('companion', fighter, {}).profile.sneakEligible === false, 'fighter dagger: no sneak');
  const longswordRogue = await addCompanion('LongRogue', {
    companion_class: 'Rogue', companion_level: 5,
    equipment: JSON.stringify({ mainHand: { name: 'Longsword' } }),
  });
  ok(pas.buildAttackProfile('companion', longswordRogue, {}).profile.sneakEligible === false, 'rogue longsword (not finesse/ranged): no sneak');

  const sessionId = await addSession();
  const [dummy] = await es.createEncounterEnemies(sessionId, 1, [
    { name: 'Sneak Dummy', maxHp: 500, armorClass: 5, attackBonus: 2, damageDice: '1d4', dexMod: 0 }
  ]);
  const o1 = await pas.resolveCompanionAttack(sessionId, pc.id, rogue, await enemyRow(dummy.id), { marker: { advantage: true } });
  if (o1.hit) {
    ok(o1.sneakAttack && o1.sneakAttack.dice === '3d6', 'advantage hit applies sneak 3d6');
    const expectedRolls = o1.critical === 'hit' ? 8 : 4;
    ok(o1.damageRolls.length === expectedRolls, `sneak damage rolls present (weapon 1d4 + sneak 3d6${o1.critical === 'hit' ? ', doubled on crit' : ''})`);
  } else {
    ok(o1.sneakAttack === null && o1.damage === 0, 'a miss consumes no sneak');
  }
  const o2 = await pas.resolveCompanionAttack(sessionId, pc.id, rogue, await enemyRow(dummy.id), { marker: { advantage: true } });
  ok(!o1.hit || o2.sneakAttack === null, 'second attack in the same turn does not sneak again (or the first missed)');
}

// ---------------------------------------------------------------------------
group('3. Rage + Improved Divine Smite in profiles');
{
  const barb = await addCompanion('Rager', {
    companion_class: 'Barbarian', companion_level: 5,
    equipment: JSON.stringify({ mainHand: { name: 'Greataxe' } }),
    class_resources_json: JSON.stringify({ used: {}, raging: true, bardicHeld: null }),
  });
  const prof = pas.buildAttackProfile('companion', barb, {}).profile;
  ok(prof.featureDamageBonus === 2, 'raging barbarian L5: +2 rage damage in feature bonus, not in ability modifier');
  ok(prof.damageModifier === 3, 'ability modifier untouched by rage (Topple DC / Cleave zero read it)');
  ok((prof.featureNotes || []).some(n => n.startsWith('Rage:')), 'rage note recorded');
  const calm = await addCompanion('Calm', {
    companion_class: 'Barbarian', companion_level: 5,
    equipment: JSON.stringify({ mainHand: { name: 'Greataxe' } }),
  });
  ok(pas.buildAttackProfile('companion', calm, {}).profile.featureDamageBonus === 0, 'not raging: no rage bonus');

  const paladin = await addCompanion('Smiting', {
    companion_class: 'Paladin', companion_level: 11,
    equipment: JSON.stringify({ mainHand: { name: 'Longsword' } }),
  });
  ok(pas.buildAttackProfile('companion', paladin, {}).profile.improvedSmiteDice === '1d8', 'paladin L11: improved divine smite 1d8');
  const young = await addCompanion('YoungPal', {
    companion_class: 'Paladin', companion_level: 5,
    equipment: JSON.stringify({ mainHand: { name: 'Longsword' } }),
  });
  ok(pas.buildAttackProfile('companion', young, {}).profile.improvedSmiteDice == null, 'paladin L5: no improved smite yet');
}

// ---------------------------------------------------------------------------
group('4. Fighting styles: Archery, Dueling, TWF, GWF, Defense, Unarmed');
{
  const archer = await addCompanion('StyleArcher', {
    companion_class: 'Ranger',
    equipment: JSON.stringify({ mainHand: { name: 'Longbow' } }),
    companion_feats: JSON.stringify(['Archery']),
  });
  ok(pas.buildAttackProfile('companion', archer, {}).profile.attackBonus === 7, 'archery: +2 ranged attack (DEX 3 + PB 2 + 2)');

  const duelist = await addCompanion('Duelist', {
    equipment: JSON.stringify({ mainHand: { name: 'Longsword' }, offHand: { name: 'Shield' } }),
    companion_feats: JSON.stringify(['Dueling']),
  });
  const dProf = pas.buildAttackProfile('companion', duelist, {}).profile;
  ok(dProf.featureDamageBonus === 2, 'dueling with sword + shield: +2 damage');
  const twoHanded = await addCompanion('TwoHander', {
    equipment: JSON.stringify({ mainHand: { name: 'Longsword' } }),
    companion_feats: JSON.stringify(['Dueling']),
  });
  ok(pas.buildAttackProfile('companion', twoHanded, {}).profile.featureDamageBonus === 0, 'dueling does NOT apply to a versatile weapon wielded two-handed');

  const dual = await addCompanion('DualStyle', {
    equipment: JSON.stringify({ mainHand: { name: 'Dagger' }, offHand: { name: 'Dagger' } }),
    companion_feats: JSON.stringify(['Two-Weapon Fighting']),
  });
  ok(pas.buildAttackProfile('companion', dual, { hand: 'off' }).profile.damageModifier === 3, 'two-weapon fighting restores the off-hand ability modifier');
  const dualPlain = await addCompanion('DualPlain', {
    equipment: JSON.stringify({ mainHand: { name: 'Dagger' }, offHand: { name: 'Dagger' } }),
  });
  ok(pas.buildAttackProfile('companion', dualPlain, { hand: 'off' }).profile.damageModifier === 0, 'without the style, off-hand damage still carries no modifier');

  const gwf = await addCompanion('Gwf', {
    equipment: JSON.stringify({ mainHand: { name: 'Greataxe' } }),
    companion_feats: JSON.stringify(['Great Weapon Fighting']),
  });
  ok(pas.buildAttackProfile('companion', gwf, {}).profile.gwfFloor === true, 'great weapon fighting flags the damage floor');
  let floorHeld = true;
  for (let i = 0; i < 30; i++) {
    const rolled = pas.rollDamageFor({ label: 'Greataxe', damageDice: '1d12', damageModifier: 0, gwfFloor: true }, null);
    if (rolled.rolls.some(v => v < 3)) floorHeld = false;
  }
  ok(floorHeld, 'great weapon fighting: no damage die rolls below 3 in 30 trials');

  // 'Leather Armor' is the PHB display name; it now resolves via the
  // armsArmorVariants aliases (2026-10-31 fix) instead of silently
  // falling back to unarmored AC. This assert proves it end to end.
  const armored = cs.calculateCombatStats({
    ability_scores: JSON.stringify({ str: 10, dex: 16, con: 14, int: 10, wis: 12, cha: 8 }),
    equipment: { armor: { name: 'Leather Armor' } }, level: 3, feats: ['Defense'],
  });
  const unarmored = cs.calculateCombatStats({
    ability_scores: JSON.stringify({ str: 10, dex: 16, con: 14, int: 10, wis: 12, cha: 8 }),
    equipment: { armor: { name: 'Leather Armor' } }, level: 3, feats: [],
  });
  ok(armored.ac === unarmored.ac + 1 && armored.ac === 15, 'defense: +1 AC while wearing armor (14 → 15)');
  const noArmor = cs.calculateCombatStats({
    ability_scores: JSON.stringify({ str: 10, dex: 16, con: 14, int: 10, wis: 12, cha: 8 }),
    equipment: {}, level: 3, feats: ['Defense'],
  });
  ok(noArmor.ac === 13, 'defense: no bonus without armor');

  const brawler = await addCompanion('Brawler', {
    companion_feats: JSON.stringify(['Unarmed Fighting']),
  });
  ok(pas.buildAttackProfile('companion', brawler, {}).profile.damageDice === '1d6', 'unarmed fighting: unarmed strikes deal 1d6');
}

// ---------------------------------------------------------------------------
group('5. Divine Smite: companion slot spend on a hit only');
{
  const sessionId = await addSession();
  const [dummy] = await es.createEncounterEnemies(sessionId, 1, [
    { name: 'Smite Dummy', maxHp: 500, armorClass: 5, attackBonus: 2, damageDice: '1d4', dexMod: 0 }
  ]);
  const paladin = await addCompanion('Smiter', {
    companion_class: 'Paladin', companion_level: 5,
    equipment: JSON.stringify({ mainHand: { name: 'Longsword' } }),
    companion_spell_slots_used: JSON.stringify({}),
  });
  const before = await dbGet('SELECT companion_spell_slots_used FROM companions WHERE id = ?', [paladin.id]);
  const o = await pas.resolveCompanionAttack(sessionId, pc.id, paladin, await enemyRow(dummy.id), { smiteSlot: 2 });
  const after = await dbGet('SELECT companion_spell_slots_used FROM companions WHERE id = ?', [paladin.id]);
  if (o.hit) {
    ok(o.smite && o.smite.spent === true && o.smite.dice === '3d8', 'hit with smite slot 2: +3d8, slot spent');
    ok(JSON.parse(after.companion_spell_slots_used)['2'] === 1, 'slot use persisted');
  } else {
    ok(o.smite === null && after.companion_spell_slots_used === before.companion_spell_slots_used, 'a miss spends no slot');
  }
}

// ---------------------------------------------------------------------------
group('6. PC track: features are instructions, never added to the report');
{
  const sessionId = await addSession();
  const [dummy] = await es.createEncounterEnemies(sessionId, 1, [
    { name: 'PC Dummy', maxHp: 500, armorClass: 5, attackBonus: 2, damageDice: '1d4', dexMod: 0 }
  ]);
  const pcRogue = await addPc({
    name: 'PC Rogue', class: 'Rogue', level: 5,
    ability_scores: JSON.stringify({ str: 10, dex: 16, con: 14, int: 10, wis: 12, cha: 8 }),
    equipment: JSON.stringify({ mainHand: { name: 'Dagger' } }),
  });
  const p1 = await pas.createPcPendingAttack(sessionId, pcRogue.id, pcRogue, await enemyRow(dummy.id), { marker: { advantage: true } });
  ok(p1.pending && p1.pending.sneakDice === '3d6', 'PC pending attack records sneak 3d6 as an instruction');
  ok(p1.pending.attackBonus === 6, 'PC attack bonus is not inflated by sneak (DEX 3 + PB 3)');
  const r1 = await pas.resolveReportedAttack(sessionId, pcRogue.id, [15, 10], 8);
  ok(r1 && r1.hit && r1.damage === 8, 'PC reported total is trusted as-is — sneak is NOT added on top');
  ok(r1.sneakAttack && r1.sneakAttack.applied === true, 'first hit consumes the once-per-turn sneak flag');
  const p2 = await pas.createPcPendingAttack(sessionId, pcRogue.id, pcRogue, await enemyRow(dummy.id), { marker: { advantage: true } });
  const r2 = await pas.resolveReportedAttack(sessionId, pcRogue.id, [15, 10], 8);
  ok(r2 && r2.sneakAttack && r2.sneakAttack.applied === false, 'second hit in the same turn: sneak already used');

  const pcPaladin = await addPc({
    name: 'PC Paladin', class: 'Paladin', level: 5,
    ability_scores: JSON.stringify({ str: 16, dex: 10, con: 14, int: 10, wis: 12, cha: 14 }),
    equipment: JSON.stringify({ mainHand: { name: 'Longsword' } }),
    spell_slots: JSON.stringify({}), spell_slots_used: JSON.stringify({}),
  });
  const p3 = await pas.createPcPendingAttack(sessionId, pcPaladin.id, pcPaladin, await enemyRow(dummy.id), { smiteSlot: 1 });
  ok(p3.pending && p3.pending.smite && p3.pending.smite.dice === '2d8', 'PC pending attack records smite 2d8 as an instruction');
  const r3 = await pas.resolveReportedAttack(sessionId, pcPaladin.id, [15], 10);
  ok(r3 && r3.smite && r3.smite.spent === true, 'PC smite slot spent on a hit');
  const used = await dbGet('SELECT spell_slots_used FROM characters WHERE id = ?', [pcPaladin.id]);
  ok(JSON.parse(used.spell_slots_used)['1'] === 1, 'PC slot use persisted');
}

console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
