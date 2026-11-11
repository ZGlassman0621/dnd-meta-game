// tests/item-1a-picks-ammo-thrown-offhand.test.js — combat item 1,
// part 1 of 2: weapon properties (ammunition, thrown, off-hand/Light)
// + per-weapon mastery picks (Zach, 2026-10-29).
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
group('1. Mastery picks: canonical matching + gating in profiles');
{
  ok(cs.weaponIsMastered(['Longsword'], 'Longsword'), 'Longsword pick matches Longsword');
  ok(cs.weaponIsMastered(['Shamshir'], 'Scimitar'), 'variant pick Shamshir matches canonical Scimitar');
  ok(cs.weaponIsMastered(['Scimitar'], 'Shamshir'), 'canonical pick matches a variant weapon');
  ok(!cs.weaponIsMastered(['Halberd'], 'Greataxe'), 'Halberd pick does not match Greataxe');
  ok(!cs.weaponIsMastered(null, 'Longsword'), 'no list (NULL) means no mastery');
  ok(!cs.weaponIsMastered([], 'Longsword'), 'empty list means no mastery');
  ok(cs.parseMasteredWeapons(null) === null, 'parse: NULL stays NULL');
  ok(JSON.stringify(cs.parseMasteredWeapons('["Longsword"]')) === '["Longsword"]', 'parse: JSON list parses');
  ok(JSON.stringify(cs.parseMasteredWeapons('[]')) === '[]', 'parse: empty list parses to []');

  const mastered = await addCompanion('PickFighter', {
    equipment: JSON.stringify({ mainHand: { name: 'Longsword' } }),
    mastered_weapons: JSON.stringify(['Longsword'])
  });
  ok(pas.buildAttackProfile('companion', mastered, {}).profile.mastery === 'sap', 'mastered longsword: Sap live');
  const unmastered = await addCompanion('OtherFighter', {
    equipment: JSON.stringify({ mainHand: { name: 'Longsword' } }),
    mastered_weapons: JSON.stringify(['Maul'])
  });
  ok(pas.buildAttackProfile('companion', unmastered, {}).profile.mastery === null, 'longsword not on the list: no mastery');
  const noList = await addCompanion('NoListFighter', {
    equipment: JSON.stringify({ mainHand: { name: 'Longsword' } })
  });
  ok(pas.buildAttackProfile('companion', noList, {}).profile.mastery === null, 'no list recorded: no mastery (approximation retired)');
  const wizard = await addCompanion('PickWizard', {
    companion_class: 'Wizard',
    equipment: JSON.stringify({ mainHand: { name: 'Longsword' } }),
    mastered_weapons: JSON.stringify(['Longsword'])
  });
  ok(pas.buildAttackProfile('companion', wizard, {}).profile.mastery === null, 'wizard: picks do not grant a feature the class lacks');
}

// ---------------------------------------------------------------------------
group('2. Mastery picks: setting them (function + MASTERY_SET marker)');
{
  const fighter = await addCompanion('SetFighter', {
    equipment: JSON.stringify({ mainHand: { name: 'Longsword' } })
  });
  const set = await pas.setMasteredWeapons('companion', fighter.id, ['Longsword', 'Warhammer']);
  ok(set.success === true, 'setMasteredWeapons accepts known weapons');
  ok(JSON.stringify(await pas.getMasteredWeapons('companion', fighter.id)) === '["Longsword","Warhammer"]', 'picks persist on the companion row');
  const bad = await pas.setMasteredWeapons('companion', fighter.id, ['Halberdd']);
  ok(bad.success === false && bad.reason.includes('unknown weapon'), 'a typo weapon is refused, not stored silently');
  ok(JSON.stringify(await pas.getMasteredWeapons('companion', fighter.id)) === '["Longsword","Warhammer"]', 'the refused set left the old list intact');

  const sessionId = await addSession();
  const res = await mp.processResponseMarkers(
    '[MASTERY_SET: Target="SetFighter" Weapons="Greataxe, Maul"]', { characterId: pc.id, sessionId });
  const h = res.handlerResults.find(r => r.schemaKey === 'MASTERY_SET');
  ok(h && h.ok && h.result && h.result.success === true, 'MASTERY_SET marker sets picks through the pipeline');
  ok(JSON.stringify(await pas.getMasteredWeapons('companion', fighter.id)) === '["Greataxe","Maul"]', 'marker set persisted');
  const res2 = await mp.processResponseMarkers(
    '[MASTERY_SET: Target="Nobody Here" Weapons="Longsword"]', { characterId: pc.id, sessionId });
  const h2 = res2.handlerResults.find(r => r.schemaKey === 'MASTERY_SET');
  ok(h2 && h2.result && h2.result.success === false, 'MASTERY_SET with an unknown target fails, it does not invent one');
}

// ---------------------------------------------------------------------------
group('3. Ammunition: spend, refuse at zero, spent tracked, refusal is clean');
{
  ok(pas.ammoTypeForWeapon('Longbow', ['ammunition', 'two-handed']) === 'arrows', 'longbow → arrows');
  ok(pas.ammoTypeForWeapon('Light Crossbow', ['ammunition', 'loading']) === 'bolts', 'light crossbow → bolts (checked before bows)');
  ok(pas.ammoTypeForWeapon('Sling', ['ammunition']) === 'bullets', 'sling → bullets');
  ok(pas.ammoTypeForWeapon('Blowgun', ['ammunition']) === 'needles', 'blowgun → needles');
  ok(pas.ammoTypeForWeapon('Musket', ['ammunition']) === 'bullets', 'musket → bullets');
  ok(pas.ammoTypeForWeapon('Hoopak', ['ammunition', 'finesse', 'special', 'two-handed']) === 'bullets', 'hoopak → bullets (sling bullets, setting weapon)');
  ok(pas.ammoTypeForWeapon('Double-Bladed Scimitar', ['special', 'two-handed']) === null, 'DBS has no ammunition property, no ammo gate');
  ok(pas.ammoTypeForWeapon('Yklwa', ['thrown']) === null, 'yklwa is thrown, not ammunition — no ammo gate');
  ok(pas.ammoTypeForWeapon('Longsword', ['versatile']) === null, 'a non-ammunition weapon has no ammo gate');
  ok(pas.ammoTypeForWeapon('Homebrew Bow', ['ammunition']) === null, 'an ammunition weapon with no known ammo is not gated on a guess');

  const sessionId = await addSession();
  const [dummy] = await es.createEncounterEnemies(sessionId, 1, [
    { name: 'Ammo Dummy', maxHp: 500, armorClass: 5, attackBonus: 2, damageDice: '1d4', dexMod: 0 }
  ]);
  const archer = await addCompanion('Archer', {
    companion_class: 'Ranger',
    equipment: JSON.stringify({ mainHand: { name: 'Longbow' } }),
    mastered_weapons: JSON.stringify(['Longbow']),
    inventory: JSON.stringify([{ name: 'Arrows', quantity: 2 }])
  });
  const o1 = await pas.resolveCompanionAttack(sessionId, pc.id, archer, await enemyRow(dummy.id), {});
  ok(o1.success === true && o1.ammo && o1.ammo.remaining === 1, 'first arrow spent (1 left)');
  const o2 = await pas.resolveCompanionAttack(sessionId, pc.id, archer, await enemyRow(dummy.id), {});
  ok(o2.success === true && o2.ammo && o2.ammo.remaining === 0, 'second arrow spent (0 left)');
  const o3 = await pas.resolveCompanionAttack(sessionId, pc.id, archer, await enemyRow(dummy.id), {});
  ok(o3.success === false && o3.reason && o3.reason.includes('out of arrows'), 'third attack refused at zero — out of ammo is out of ammo');
  const inv = await inventoryOf('companion', archer.id);
  ok(inv.find(i => i.name === 'Arrows')?.quantity === 0, 'inventory reads 0 after the last arrow');
  ok(JSON.stringify(await pas.getAmmoSpent(sessionId, 1)) === '{"arrows":2}', 'spent ammo tracked per encounter for the looting scene');
  const invAfter = await inventoryOf('companion', archer.id);
  ok(invAfter.find(i => i.name === 'Arrows')?.quantity === 0, 'the refused attack spent nothing (still 0, no auto-recovery)');

  // Refusal must not eat Vex: plant a Vex flag, then refuse, then check.
  const [vexDummy] = await es.createEncounterEnemies(sessionId, 2, [
    { name: 'Vex Dummy', maxHp: 500, armorClass: 5, attackBonus: 2, damageDice: '1d4', dexMod: 0 }
  ]);
  const key = `companion:${archer.id}`;
  await dbRun('UPDATE dm_sessions SET session_config = ? WHERE id = ?', [
    JSON.stringify({ masteryVex: { [key]: vexDummy.id } }), sessionId]);
  const refused = await pas.resolveCompanionAttack(sessionId, pc.id, archer, await enemyRow(vexDummy.id), {});
  ok(refused.success === false, 'the out-of-ammo attack is refused');
  const cfg = await sessionConfig(sessionId);
  ok(cfg.masteryVex && cfg.masteryVex[key] === vexDummy.id, 'the refused attack left the Vex flag untouched');
}

// ---------------------------------------------------------------------------
group('4. PC pending path spends ammo at declaration');
{
  const sessionId = await addSession();
  const [dummy] = await es.createEncounterEnemies(sessionId, 1, [
    { name: 'PC Dummy', maxHp: 500, armorClass: 5, attackBonus: 2, damageDice: '1d4', dexMod: 0 }
  ]);
  const pcArcher = await addPc({
    name: 'PC Archer', class: 'Ranger',
    ability_scores: JSON.stringify({ str: 10, dex: 16, con: 14, int: 10, wis: 14, cha: 8 }),
    equipment: JSON.stringify({ mainHand: { name: 'Shortbow' } }),
    mastered_weapons: JSON.stringify(['Shortbow']),
    inventory: JSON.stringify([{ name: 'Arrows', quantity: 1 }])
  });
  const p1 = await pas.createPcPendingAttack(sessionId, pcArcher.id, pcArcher, await enemyRow(dummy.id), {});
  ok(p1.pending && p1.pending.ammo && p1.pending.ammo.remaining === 0, 'pending PC attack spends its arrow at declaration');
  const p2 = await pas.createPcPendingAttack(sessionId, pcArcher.id, pcArcher, await enemyRow(dummy.id), {});
  ok(p2.error && p2.error.includes('out of arrows'), 'second pending PC attack refused at zero');
}

// ---------------------------------------------------------------------------
group('5. Thrown: declaration, math, and refusal');
{
  const thrower = await addCompanion('Thrower', {
    equipment: JSON.stringify({ mainHand: { name: 'Handaxe' } }),
    mastered_weapons: JSON.stringify(['Handaxe'])
  });
  const prof = pas.buildAttackProfile('companion', thrower, { thrown: true }).profile;
  ok(prof.thrown === true, 'thrown flag recorded on the profile');
  ok(prof.damageModifier === 3, 'thrown handaxe still uses STR (3), not DEX');
  const dagger = await addCompanion('DaggerThrower', {
    equipment: JSON.stringify({ mainHand: { name: 'Dagger' } }),
    mastered_weapons: JSON.stringify(['Dagger'])
  });
  const dProf = pas.buildAttackProfile('companion', dagger, { thrown: true }).profile;
  ok(dProf.damageModifier === 3, 'thrown dagger (finesse) uses the better of STR/DEX (3)');
  const swordsman = await addCompanion('SwordThrower', {
    equipment: JSON.stringify({ mainHand: { name: 'Longsword' } }),
    mastered_weapons: JSON.stringify(['Longsword'])
  });
  const bad = pas.buildAttackProfile('companion', swordsman, { thrown: true });
  ok(bad.error && bad.error.includes('not a thrown weapon'), 'a longsword cannot be declared thrown');
}

// ---------------------------------------------------------------------------
group('6. Off-hand: profile math, Light rules, once per turn, Nick');
{
  const dual = await addCompanion('Dual', {
    companion_class: 'Rogue',
    equipment: JSON.stringify({ mainHand: { name: 'Shortsword' }, offHand: { name: 'Dagger' } }),
    mastered_weapons: JSON.stringify(['Shortsword'])
  });
  const off = pas.buildAttackProfile('companion', dual, { hand: 'off' }).profile;
  ok(off.label === 'Dagger' && off.damageDice === '1d4', 'off-hand profile is the off-hand weapon');
  ok(off.damageModifier === 0, 'off-hand damage carries no ability modifier');
  ok(off.attackBonus === 5, 'off-hand attack roll still adds DEX 3 + PB 2 = 5');
  ok(off.mastery === null, 'off-hand attacks carry no mastery');

  const heavyMain = await addCompanion('HeavyMain', {
    equipment: JSON.stringify({ mainHand: { name: 'Longsword' }, offHand: { name: 'Dagger' } }),
    mastered_weapons: JSON.stringify(['Longsword'])
  });
  ok(pas.buildAttackProfile('companion', heavyMain, { hand: 'off' }).error.includes('not Light'), 'a non-Light main hand blocks two-weapon fighting');
  const heavyOff = await addCompanion('HeavyOff', {
    equipment: JSON.stringify({ mainHand: { name: 'Shortsword' }, offHand: { name: 'Longsword' } }),
    mastered_weapons: JSON.stringify(['Shortsword'])
  });
  ok(pas.buildAttackProfile('companion', heavyOff, { hand: 'off' }).error.includes('not a Light weapon'), 'a non-Light off-hand weapon is refused');
  const noOff = await addCompanion('NoOff', {
    equipment: JSON.stringify({ mainHand: { name: 'Shortsword' } }),
    mastered_weapons: JSON.stringify(['Shortsword'])
  });
  ok(pas.buildAttackProfile('companion', noOff, { hand: 'off' }).error.includes('no off-hand weapon'), 'no off-hand weapon, no off-hand attack');

  const sessionId = await addSession();
  const [dummy] = await es.createEncounterEnemies(sessionId, 1, [
    { name: 'Off Dummy', maxHp: 500, armorClass: 5, attackBonus: 2, damageDice: '1d4', dexMod: 0 }
  ]);
  const first = await pas.resolveCompanionAttack(sessionId, pc.id, dual, await enemyRow(dummy.id), { hand: 'off' });
  ok(first.success === true && first.offHandAttack === true, 'first off-hand attack of the turn goes through');
  if (first.hit) {
    const diceSum = (first.damageRolls || []).reduce((a, b) => a + b, 0);
    ok(first.damage === diceSum, 'off-hand damage equals the dice alone (no modifier added)');
  }
  const second = await pas.resolveCompanionAttack(sessionId, pc.id, dual, await enemyRow(dummy.id), { hand: 'off' });
  ok(second.success === false && second.reason.includes('already been used'), 'second off-hand attack this turn refused');

  // Nick (ruling 2026-11-01): the OFF-hand weapon is the Nick weapon
  // — main-hand shortsword (Light), off-hand dagger mastered.
  const nick = await addCompanion('Nicker', {
    companion_class: 'Rogue',
    equipment: JSON.stringify({ mainHand: { name: 'Shortsword' }, offHand: { name: 'Dagger' } }),
    mastered_weapons: JSON.stringify(['Dagger'])
  });
  let nickOutcome = null;
  for (let i = 0; i < 60 && !nickOutcome; i++) {
    const o = await pas.resolveCompanionAttack(sessionId, pc.id, nick, await enemyRow(dummy.id), {});
    if (o.hit) nickOutcome = o;
  }
  ok(nickOutcome && nickOutcome.masteryNote && nickOutcome.masteryNote.includes('Nick'), 'Nick narrated on a hit with a mastered-dagger off hand');
  // Two daggers: same name, two slots — the old name check rejected them.
  const twin = await addCompanion('Twin', {
    companion_class: 'Rogue',
    equipment: JSON.stringify({ mainHand: { name: 'Dagger' }, offHand: { name: 'Dagger' } }),
    mastered_weapons: JSON.stringify(['Dagger'])
  });
  let twinOutcome = null;
  for (let i = 0; i < 60 && !twinOutcome; i++) {
    const o = await pas.resolveCompanionAttack(sessionId, pc.id, twin, await enemyRow(dummy.id), {});
    if (o.hit) twinOutcome = o;
  }
  ok(twinOutcome && twinOutcome.masteryNote && twinOutcome.masteryNote.includes('Nick'), 'two daggers still get Nick (slots differ, names do not matter)');
  // Dagger not mastered: no Nick note.
  const unnicked = await addCompanion('Unnicked', {
    companion_class: 'Rogue',
    equipment: JSON.stringify({ mainHand: { name: 'Dagger' }, offHand: { name: 'Shortsword' } }),
    mastered_weapons: JSON.stringify(['Shortsword'])
  });
  let unOutcome = null;
  for (let i = 0; i < 60 && !unOutcome; i++) {
    const o = await pas.resolveCompanionAttack(sessionId, pc.id, unnicked, await enemyRow(dummy.id), {});
    if (o.hit) unOutcome = o;
  }
  ok(unOutcome && !(unOutcome.masteryNote || '').includes('Nick'), 'an unmastered dagger grants no Nick note');
}

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
process.exit(failed > 0 ? 1 : 0);
