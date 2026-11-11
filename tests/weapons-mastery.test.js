/**
 * tests/weapons-mastery.test.js — weapons step-up (Step 2 of the
 * 2026-10-21 book-data order, v1.0.195; design:
 * weapons-stepup-design.md).
 *
 * Pins:
 *   - WEAPON_DATA is the 2024 PHB table plus 3 setting weapons
 *     (Yklwa, Double-Bladed Scimitar, Hoopak — 2026-11-08 job (c)):
 *     41 weapons, every one carrying category, properties, and its
 *     mastery property; the 2024 corrections land (Lance 1d10/Heavy,
 *     Trident 1d8 with versatile 1d10, Shortsword piercing, Musket +
 *     Pistol present);
 *   - Versatile: a table-driven weapon wielded two-handed (off hand
 *     empty) deals its versatile die; a shield drops it back; an
 *     item's own damage field owns its dice outright;
 *   - mastery gating: only fighter/barbarian/paladin/ranger/rogue
 *     profiles carry a mastery; npc_stats companions never do;
 *   - Sap: a hit flags the enemy; its next attack is disadvantaged
 *     exactly once (flag consumed in resolveEnemyAttack);
 *   - Vex: a damaging hit grants the attacker's next attack against
 *     the SAME enemy advantage; wrong target doesn't consume it,
 *     using it does;
 *   - Topple: CON save at DC 8 + ability mod + PB with snapshot save
 *     modifiers; both branches pinned deterministically (a -10 save
 *     always fails, a +20 always saves); failure applies Prone;
 *   - Graze: a miss still deals the ability modifier through the
 *     typed-damage path (immunity zeroes it);
 *   - Heavy (2024): disadvantage below STR/DEX 13;
 *   - the PC reported-dice path carries mastery end to end (pending
 *     stores mastery + toppleDc; reported miss grazes; reported hit
 *     saps; the PC's own Vex is consumed at pending creation).
 *
 * System-rolled branches are asserted by branching on the outcome
 * (never by assuming one roll), per the repo's test rule.
 *
 * Isolated throwaway DB (clock-unification pattern).
 */
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');

const dbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dnd-weapons-'));
process.chdir(dbDir);
delete process.env.TURSO_DATABASE_URL;
delete process.env.TURSO_AUTH_TOKEN;

const dbModule = await import(pathToFileURL(path.join(REPO, 'server', 'database.js')).href);
const { initDatabase, dbGet, dbRun, dbAll } = dbModule;
await initDatabase();

const svc = (p) => pathToFileURL(path.join(REPO, p)).href;
const stats = await import(svc('server/services/combatStatsService.js'));
const pas = await import(svc('server/services/partyAttackService.js'));
const es = await import(svc('server/services/enemyCombatService.js'));
const cs = await import(svc('server/services/conditionService.js'));

let passed = 0;
let failed = 0;
function assert(cond, msg) {
  if (cond) { passed++; } else { failed++; console.log(`  ✗ ${msg}`); }
}
function group(name) { console.log(`\n== ${name}`); }

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
    name: 'Tester', class: 'Fighter', level: 3,
    current_hp: 40, max_hp: 40, armor_class: 10,
    ability_scores: JSON.stringify({ str: 16, dex: 16, con: 14, int: 10, wis: 12, cha: 8 }),
    skills: JSON.stringify([]),
    ...over
  });
  return dbGet('SELECT * FROM characters WHERE id = ?', [id]);
}

async function addCompanion(name, over = {}) {
  const npcId = await insertRow('npcs', { name });
  const id = await insertRow('companions', {
    npc_id: npcId, recruited_by_character_id: pc.id, status: 'active',
    companion_spell_slots_used: JSON.stringify({}),
    progression_type: 'class_based', companion_level: 3,
    companion_ability_scores: JSON.stringify({ str: 16, dex: 16, con: 14, int: 10, wis: 12, cha: 8 }),
    companion_current_hp: 24, companion_max_hp: 24, armor_class: 14,
    ...over
  });
  const row = await dbGet('SELECT * FROM companions WHERE id = ?', [id]);
  return { ...row, display_name: name };
}

async function addSession() {
  return insertRow('dm_sessions', { character_id: pc.id, status: 'active' });
}

async function enemyRow(id) {
  return dbGet('SELECT * FROM combat_enemies WHERE id = ?', [id]);
}

async function sessionConfig(sessionId) {
  const s = await dbGet('SELECT session_config FROM dm_sessions WHERE id = ?', [sessionId]);
  try { return JSON.parse(s?.session_config || '{}'); } catch { return {}; }
}

const pc = await addPc({ name: 'Garrick' });

// ---------------------------------------------------------------------------
group('1. WEAPON_DATA is the 2024 table + 3 setting weapons');
{
  const W = stats.WEAPON_DATA;
  const book = Object.entries(W).filter(([k]) => k !== 'Unarmed Strike');
  assert(book.length === 41, `41 weapons — 38 chapter + 3 setting (got ${book.length})`);
  assert(book.every(([, w]) => w.mastery && w.category && Array.isArray(w.properties)),
    'every weapon carries mastery + category + properties');
  const count = (m) => book.filter(([, w]) => w.mastery === m).length;
  assert(count('sap') === 7 && count('vex') === 8 && count('nick') === 4 && count('topple') === 6
    && count('graze') === 3 && count('cleave') === 2 && count('push') === 4 && count('slow') === 7,
    `mastery distribution matches (sap7 vex8 nick4 topple6 graze3 cleave2 push4 slow7; got sap${count('sap')} vex${count('vex')} nick${count('nick')} topple${count('topple')} graze${count('graze')} cleave${count('cleave')} push${count('push')} slow${count('slow')})`);
  assert(W['Lance'].damage === '1d10' && W['Lance'].properties.includes('heavy') && W['Lance'].mastery === 'topple',
    'Lance: 1d10, Heavy, Topple (2024)');
  assert(W['Trident'].damage === '1d8' && W['Trident'].versatile === '1d10' && W['Trident'].mastery === 'topple',
    'Trident: 1d8, versatile 1d10, Topple (2024)');
  assert(W['Shortsword'].damageType === 'piercing' && W['Shortsword'].mastery === 'vex', 'Shortsword: piercing, Vex');
  assert(W['Musket'].damage === '1d12' && W['Musket'].mastery === 'slow' && W['Pistol'].damage === '1d10' && W['Pistol'].mastery === 'vex',
    'Musket + Pistol join the table');
  assert(W['War Pick'].mastery === 'sap' && W['War Pick'].versatile === '1d10', 'War Pick: versatile 1d10, Sap');
  assert(W['Quarterstaff'].versatile === '1d8' && W['Spear'].versatile === '1d8' && W['Spear'].range === '20/60',
    'Quarterstaff / Spear versatile + ranges');
  assert(W['Longbow'].range === '150/600' && W['Heavy Crossbow'].range === '100/400', 'ranged ranges recorded');
  assert(W['Greatsword'].damage === '2d6' && W['Greataxe'].mastery === 'cleave' && W['Glaive'].mastery === 'graze',
    'great weapons spot values');
  // Setting weapons (job (c), D1–D3): resolve by name with their assigned masteries.
  assert(stats.lookupWeaponData('Yklwa')?.damage === '1d8' && stats.lookupWeaponData('Yklwa')?.mastery === 'sap',
    'Yklwa resolves: 1d8 piercing, Sap');
  assert(stats.lookupWeaponData('Double-Bladed Scimitar')?.damage === '2d4' && stats.lookupWeaponData('Double-Bladed Scimitar')?.mastery === 'graze',
    'Double-Bladed Scimitar resolves: 2d4 slashing, Graze');
  assert(stats.lookupWeaponData('Hoopak')?.damage === '1d6' && stats.lookupWeaponData('Hoopak')?.mastery === 'topple',
    'Hoopak resolves: 1d6 piercing, Topple');
  assert(stats.lookupWeaponData('Double-Bladed Scimitar')?.properties.includes('special')
    && stats.lookupWeaponData('Hoopak')?.properties.includes('special'),
    'setting Special weapons carry special in WEAPON_DATA');
  assert(stats.lookupWeaponData('Yklwa')?.range === '10/30',
    'yklwa thrown range 10/30 resolves');
}

// ---------------------------------------------------------------------------
group('2. Versatile + classHasMastery (pure)');
{
  const base = { ability_scores: { str: 16, dex: 12 }, level: 3 };
  let s = stats.calculateCombatStats({ ...base, equipment: { mainHand: { name: 'Longsword' } } });
  assert(s.weapon.damageDice === '1d10', `two-handed longsword deals 1d10 (got ${s.weapon.damageDice})`);
  assert(s.weapon.mastery === 'sap' && s.weapon.properties.includes('versatile'), 'weapon info carries mastery + properties');
  s = stats.calculateCombatStats({ ...base, equipment: { mainHand: { name: 'Longsword' }, offHand: { name: 'Shield', acBonus: 2 } } });
  assert(s.weapon.damageDice === '1d8', 'longsword with a shield stays 1d8');
  s = stats.calculateCombatStats({ ...base, equipment: { mainHand: { name: 'Longsword', damage: '1d8' } } });
  assert(s.weapon.damageDice === '1d8', "an item's own damage field owns its dice (no versatile swap)");
  assert(stats.classHasMastery('Fighter') && stats.classHasMastery(' paladin ') && stats.classHasMastery('rogue')
    && !stats.classHasMastery('wizard') && !stats.classHasMastery('cleric') && !stats.classHasMastery(null),
    'mastery classes: fighter/barbarian/paladin/ranger/rogue only');
}

// ---------------------------------------------------------------------------
group('3. Mastery gating in attack profiles');
{
  const fighter = await addCompanion('Bram', {
    companion_class: 'Fighter',
    equipment: JSON.stringify({ mainHand: { name: 'Longsword' }, offHand: { name: 'Shield', acBonus: 2 } }),
    mastered_weapons: JSON.stringify(['Longsword'])
  });
  const fProfile = pas.buildAttackProfile('companion', fighter, {}).profile;
  assert(fProfile.mastery === 'sap' && fProfile.damageDice === '1d8', 'fighter + longsword: Sap live, shield keeps 1d8');

  const wizard = await addCompanion('Wren', {
    companion_class: 'Wizard',
    equipment: JSON.stringify({ mainHand: { name: 'Quarterstaff' } })
  });
  const wProfile = pas.buildAttackProfile('companion', wizard, {}).profile;
  assert(wProfile.mastery === null, 'wizard + quarterstaff: no mastery (no Weapon Mastery feature)');
  assert(wProfile.damageDice === '1d8', 'wizard quarterstaff still gets versatile 1d8 two-handed');

  const npcPal = await addCompanion('Statblock Friend', {
    progression_type: 'npc_stats', original_stats_snapshot: JSON.stringify({ cr: 1 }),
    equipment: JSON.stringify({ mainHand: { name: 'Longsword' } })
  });
  const nProfile = pas.buildAttackProfile('companion', npcPal, {}).profile;
  assert(!nProfile.mastery, 'npc_stats companion: CR profile carries no mastery');
}

// ---------------------------------------------------------------------------
group('3b. Setting weapons: DBS mastery gating, yklwa range, hoopak finesse');
{
  // calculateCombatStats (pure, group-2 pattern): a name-only DBS deals
  // 2d4 slashing and carries Graze.
  const base = { ability_scores: { str: 16, dex: 12 }, level: 3 };
  let s = stats.calculateCombatStats({ ...base, equipment: { mainHand: { name: 'Double-Bladed Scimitar' } } });
  assert(s.weapon.damageDice === '2d4' && s.weapon.damageType === 'slashing' && s.weapon.mastery === 'graze',
    `name-only DBS deals 2d4 slashing with Graze (got ${s.weapon.damageDice} ${s.weapon.damageType} ${s.weapon.mastery})`);
  // Mastery gating (group-3 pattern): a fighter with the DBS mastered
  // has Graze live; a wizard with the same weapon has no mastery.
  const dbsFighter = await addCompanion('DbsFighter', {
    companion_class: 'Fighter',
    equipment: JSON.stringify({ mainHand: { name: 'Double-Bladed Scimitar' } }),
    mastered_weapons: JSON.stringify(['Double-Bladed Scimitar'])
  });
  const fProfile = pas.buildAttackProfile('companion', dbsFighter, {}).profile;
  assert(fProfile.mastery === 'graze' && fProfile.damageDice === '2d4', 'fighter + DBS: Graze live, 2d4');
  const dbsWizard = await addCompanion('DbsWizard', {
    companion_class: 'Wizard',
    equipment: JSON.stringify({ mainHand: { name: 'Double-Bladed Scimitar' } })
  });
  const wProfile = pas.buildAttackProfile('companion', dbsWizard, {}).profile;
  assert(wProfile.mastery === null, 'wizard + DBS: no mastery (no Weapon Mastery feature)');
  assert(wProfile.damageDice === '2d4', 'wizard DBS still deals 2d4');
  // Yklwa thrown range resolves through combat stats.
  s = stats.calculateCombatStats({ ...base, equipment: { mainHand: { name: 'Yklwa' } } });
  assert(s.weapon.damageDice === '1d8' && s.weapon.range === '10/30' && s.weapon.mastery === 'sap',
    `name-only yklwa deals 1d8 at range 10/30, Sap (got ${s.weapon.damageDice} ${s.weapon.range} ${s.weapon.mastery})`);
  // Hoopak finesse uses DEX: STR 10 / DEX 16 -> damage modifier +3.
  s = stats.calculateCombatStats({ ability_scores: { str: 10, dex: 16 }, level: 3, equipment: { mainHand: { name: 'Hoopak' } } });
  assert(s.weapon.damageDice === '1d6' && s.weapon.damageType === 'piercing' && s.weapon.damageModifier === 3 && s.weapon.mastery === 'topple',
    `hoopak finesse uses DEX (+3, got ${s.weapon.damageModifier})`);
}

// ---------------------------------------------------------------------------
group('4. Sap: hit flags the enemy; its next attack is disadvantaged once');
{
  const sessionId = await addSession();
  const [gob] = await es.createEncounterEnemies(sessionId, 1, [
    { name: 'Sap Target', maxHp: 60, armorClass: 5, attackBonus: 4, damageDice: '1d6+2', dexMod: 2 }
  ]);
  const bram = await addCompanion('Bram', {
    companion_class: 'Fighter',
    equipment: JSON.stringify({ mainHand: { name: 'Longsword' }, offHand: { name: 'Shield', acBonus: 2 } }),
    mastered_weapons: JSON.stringify(['Longsword'])
  });
  let hitOutcome = null;
  for (let i = 0; i < 60 && !hitOutcome; i++) {
    const o = await pas.resolveCompanionAttack(sessionId, pc.id, bram, await enemyRow(gob.id), {});
    if (o.hit) hitOutcome = o;
  }
  assert(hitOutcome && hitOutcome.sappedTarget === true, 'the Sap hit marks the target');
  const cfg = await sessionConfig(sessionId);
  assert(cfg.masterySap && cfg.masterySap[gob.id] === true, 'sap flag stored on the session');
  const atk = await es.resolveEnemyAttack(sessionId, 1, 'Sap Target',
    { type: 'player', id: pc.id, armorClass: 30, name: 'Garrick' });
  assert(atk.sapped === true && atk.attackMode === 'disadvantage'
    && Array.isArray(atk.attackRolls) && atk.attackRoll === Math.min(...atk.attackRolls),
    'the sapped enemy attacks at disadvantage, taking the lower die');
  const cfgAfter = await sessionConfig(sessionId);
  assert(!cfgAfter.masterySap || !cfgAfter.masterySap[gob.id], 'sap flag consumed by that attack');
  const atk2 = await es.resolveEnemyAttack(sessionId, 1, 'Sap Target',
    { type: 'player', id: pc.id, armorClass: 30, name: 'Garrick' });
  assert(atk2.sapped === undefined && atk2.attackRolls === undefined, 'the following attack is clean');
  const block = await pas.formatAttackOutcomeBlock(sessionId);
  assert(block.includes('Sap:'), 'the DM block narrates the Sap fact');
}

// ---------------------------------------------------------------------------
group('5. Vex: advantage against the same enemy only, consumed on use');
{
  const sessionId = await addSession();
  const [a, b] = await es.createEncounterEnemies(sessionId, 1, [
    { name: 'Vex Alpha', maxHp: 80, armorClass: 5, attackBonus: 3, damageDice: '1d6', dexMod: 1 },
    { name: 'Vex Beta', maxHp: 80, armorClass: 5, attackBonus: 3, damageDice: '1d6', dexMod: 1 }
  ]);
  const lyra = await addCompanion('Lyra', {
    companion_class: 'Ranger',
    companion_ability_scores: JSON.stringify({ str: 12, dex: 16, con: 14, int: 10, wis: 14, cha: 8 }),
    equipment: JSON.stringify({ mainHand: { name: 'Shortsword' } }),
    mastered_weapons: JSON.stringify(['Shortsword'])
  });
  let hitOutcome = null;
  for (let i = 0; i < 60 && !hitOutcome; i++) {
    const o = await pas.resolveCompanionAttack(sessionId, pc.id, lyra, await enemyRow(a.id), {});
    if (o.hit && (o.damageDealt ?? o.damage) > 0) hitOutcome = o;
  }
  assert(hitOutcome && hitOutcome.vexGained === true, 'the damaging Vex hit grants Vex');
  const key = `companion:${lyra.id}`;
  const cfg = await sessionConfig(sessionId);
  assert(cfg.masteryVex && cfg.masteryVex[key] === a.id, 'vex flag stored against the struck enemy');

  const vsBeta = await pas.computeAttackMode('companion', lyra.id, await enemyRow(b.id), {}, sessionId, null);
  assert(vsBeta.mode !== 'advantage', 'no advantage against a different enemy');
  const cfgStill = await sessionConfig(sessionId);
  assert(cfgStill.masteryVex && cfgStill.masteryVex[key] === a.id, 'the wrong target did not consume Vex');

  const vsAlpha = await pas.computeAttackMode('companion', lyra.id, await enemyRow(a.id), {}, sessionId, null);
  assert(vsAlpha.mode === 'advantage' && vsAlpha.reasons.includes('Vex'), 'advantage against the vexed enemy');
  const vsAlpha2 = await pas.computeAttackMode('companion', lyra.id, await enemyRow(a.id), {}, sessionId, null);
  assert(vsAlpha2.mode !== 'advantage', 'Vex consumed after one use');
}

// ---------------------------------------------------------------------------
group('6. Topple: snapshot CON saves, both branches deterministic');
{
  const sessionId = await addSession();
  const snap = (conSave) => JSON.stringify({
    name: 'Brute', abilities: { str: 16, dex: 10, con: 16, int: 6, wis: 10, cha: 6 },
    saves: { con: conSave }, resistances: [], vulnerabilities: [], immunities: [], conditionImmunities: []
  });
  const [frail, steady] = await es.createEncounterEnemies(sessionId, 1, [
    { name: 'Frail Brute', maxHp: 200, armorClass: 5, attackBonus: 5, damageDice: '1d8+3', dexMod: 0, statsJson: snap(-10) },
    { name: 'Steady Brute', maxHp: 200, armorClass: 5, attackBonus: 5, damageDice: '1d8+3', dexMod: 0, statsJson: snap(20) }
  ]);
  const mauler = await addCompanion('Mauler', {
    companion_class: 'Fighter',
    equipment: JSON.stringify({ mainHand: { name: 'Maul' } }),
    mastered_weapons: JSON.stringify(['Maul'])
  });
  let frailOutcome = null;
  for (let i = 0; i < 60 && !frailOutcome; i++) {
    const o = await pas.resolveCompanionAttack(sessionId, pc.id, mauler, await enemyRow(frail.id), {});
    if (o.hit) frailOutcome = o;
  }
  assert(frailOutcome && frailOutcome.topple && frailOutcome.topple.dc === 13,
    `topple DC = 8 + STR 3 + PB 2 = 13 (got ${frailOutcome?.topple?.dc})`);
  assert(frailOutcome.topple.saved === false && frailOutcome.topple.applied === true,
    'a -10 CON save always fails and applies');
  const frailConds = await cs.getConditions('enemy', frail.id);
  assert(frailConds.includes('prone'), 'the frail brute is prone');

  let steadyOutcome = null;
  for (let i = 0; i < 60 && !steadyOutcome; i++) {
    const o = await pas.resolveCompanionAttack(sessionId, pc.id, mauler, await enemyRow(steady.id), {});
    if (o.hit) steadyOutcome = o;
  }
  assert(steadyOutcome && steadyOutcome.topple && steadyOutcome.topple.saved === true
    && steadyOutcome.topple.applied === false, 'a +20 CON save always saves');
  const steadyConds = await cs.getConditions('enemy', steady.id);
  assert(!steadyConds.includes('prone'), 'the steady brute stays standing');
}

// ---------------------------------------------------------------------------
group('7. Graze: a miss still deals the ability modifier; immunity zeroes it');
{
  const sessionId = await addSession();
  const [wall, ghost] = await es.createEncounterEnemies(sessionId, 1, [
    { name: 'Iron Wall', maxHp: 60, armorClass: 30, attackBonus: 3, damageDice: '1d6', dexMod: 0 },
    {
      name: 'Slash Ghost', maxHp: 60, armorClass: 30, attackBonus: 3, damageDice: '1d6', dexMod: 0,
      statsJson: JSON.stringify({
        name: 'Slash Ghost', abilities: { str: 10, dex: 14, con: 10, int: 10, wis: 10, cha: 10 },
        saves: {}, resistances: [], vulnerabilities: [], immunities: ['slashing'], conditionImmunities: []
      })
    }
  ]);
  const glaive = await addCompanion('Glaive', {
    companion_class: 'Fighter',
    equipment: JSON.stringify({ mainHand: { name: 'Glaive' } }),
    mastered_weapons: JSON.stringify(['Glaive'])
  });
  const hpBefore = (await enemyRow(wall.id)).current_hp;
  let missOutcome = null;
  let expectedLoss = 0;
  for (let i = 0; i < 40 && !missOutcome; i++) {
    const o = await pas.resolveCompanionAttack(sessionId, pc.id, glaive, await enemyRow(wall.id), {});
    if (!o.hit) { missOutcome = o; expectedLoss += o.grazeDealt ?? 0; }
    else {
      assert(o.grazeDamage === undefined, 'a (crit) hit carries no graze packet');
      expectedLoss += o.damageDealt ?? o.damage;
    }
  }
  assert(missOutcome && missOutcome.grazeDamage === 3, 'graze packet = STR modifier 3');
  assert(missOutcome.grazeDealt === 3, 'graze damage dealt in full against a neutral enemy');
  assert((await enemyRow(wall.id)).current_hp === hpBefore - expectedLoss,
    'the wall lost exactly the accounted damage (crit packets + the graze)');

  const ghostHp = (await enemyRow(ghost.id)).current_hp;
  let ghostMiss = null;
  for (let i = 0; i < 40 && !ghostMiss; i++) {
    const o = await pas.resolveCompanionAttack(sessionId, pc.id, glaive, await enemyRow(ghost.id), {});
    if (!o.hit) ghostMiss = o;
  }
  assert(ghostMiss && ghostMiss.grazeAdjustment === 'immune' && ghostMiss.grazeDealt === 0,
    'graze against a slashing-immune enemy deals 0');
  assert((await enemyRow(ghost.id)).current_hp === ghostHp, 'the ghost lost no HP');
}

// ---------------------------------------------------------------------------
group('8. Heavy (2024): disadvantage below the ability threshold');
{
  const weak = await addCompanion('Weak', {
    companion_class: 'Fighter',
    companion_ability_scores: JSON.stringify({ str: 12, dex: 14, con: 14, int: 10, wis: 10, cha: 8 }),
    equipment: JSON.stringify({ mainHand: { name: 'Maul' } }),
    mastered_weapons: JSON.stringify(['Maul'])
  });
  const weakProfile = pas.buildAttackProfile('companion', weak, {}).profile;
  assert(weakProfile.heavyDisadvantage === true, 'STR 12 with a maul: Heavy disadvantage applies');
  const strong = await addCompanion('Strong', {
    companion_class: 'Fighter',
    companion_ability_scores: JSON.stringify({ str: 13, dex: 14, con: 14, int: 10, wis: 10, cha: 8 }),
    equipment: JSON.stringify({ mainHand: { name: 'Maul' } }),
    mastered_weapons: JSON.stringify(['Maul'])
  });
  const strongProfile = pas.buildAttackProfile('companion', strong, {}).profile;
  assert(!strongProfile.heavyDisadvantage, 'STR 13 with a maul: no disadvantage');
  const sessionId = await addSession();
  const [dummy] = await es.createEncounterEnemies(sessionId, 1, [
    { name: 'Dummy', maxHp: 20, armorClass: 10, attackBonus: 2, damageDice: '1d4', dexMod: 0 }
  ]);
  const mode = await pas.computeAttackMode('companion', weak.id, await enemyRow(dummy.id), {}, sessionId, weakProfile);
  assert(mode.mode === 'disadvantage' && mode.reasons.some(r => r.includes('Heavy')),
    'computeAttackMode merges the Heavy disadvantage with its reason');
}

// ---------------------------------------------------------------------------
group('9. PC reported-dice path carries mastery end to end');
{
  const sessionId = await addSession();
  const [ogre] = await es.createEncounterEnemies(sessionId, 1, [
    { name: 'Ogre', maxHp: 59, armorClass: 11, attackBonus: 6, damageDice: '2d8+4', dexMod: -1 }
  ]);
  const ogreRow = await enemyRow(ogre.id);

  // Sap via a reported hit.
  const swordsman = await addPc({
    name: 'Swordsman', equipment: JSON.stringify({ mainHand: { name: 'Longsword' }, offHand: { name: 'Shield', acBonus: 2 } }), mastered_weapons: JSON.stringify(['Longsword'])
  });
  const p1 = await pas.createPcPendingAttack(sessionId, swordsman.id, swordsman, ogreRow, {});
  assert(p1.pending && p1.pending.mastery === 'sap', 'the pending attack carries the weapon mastery');
  const r1 = await pas.resolveReportedAttack(sessionId, swordsman.id, [15], 8);
  assert(r1 && r1.hit === true && r1.sappedTarget === true, 'reported hit applies Sap');
  const cfg = await sessionConfig(sessionId);
  assert(cfg.masterySap && cfg.masterySap[ogre.id] === true, 'sap flag set from the reported path');

  // Topple DC rides the pending for a maul.
  const maulPc = await addPc({ name: 'Mauler', equipment: JSON.stringify({ mainHand: { name: 'Maul' } }), mastered_weapons: JSON.stringify(['Maul']) });
  const p2 = await pas.createPcPendingAttack(sessionId, maulPc.id, maulPc, ogreRow, {});
  assert(p2.pending && p2.pending.mastery === 'topple' && p2.pending.toppleDc === 13,
    `maul pending stores toppleDc 13 (got ${p2.pending?.toppleDc})`);
  await pas.resolveReportedAttack(sessionId, maulPc.id, [1], null); // burn the pending (nat 1 miss)

  // Graze via a reported miss.
  const glaivePc = await addPc({ name: 'Glaiver', equipment: JSON.stringify({ mainHand: { name: 'Glaive' } }), mastered_weapons: JSON.stringify(['Glaive']) });
  const hpBefore = (await enemyRow(ogre.id)).current_hp;
  await pas.createPcPendingAttack(sessionId, glaivePc.id, glaivePc, ogreRow, {});
  const r3 = await pas.resolveReportedAttack(sessionId, glaivePc.id, [2], null);
  assert(r3 && r3.hit === false && r3.grazeDamage === 3 && r3.grazeDealt === 3,
    'reported miss with a glaive grazes for 3');
  assert((await enemyRow(ogre.id)).current_hp === hpBefore - 3, 'the ogre lost exactly the graze amount');
  const block = await pas.formatAttackOutcomeBlock(sessionId);
  assert(block.includes('Graze:'), 'the DM block narrates the Graze fact');

  // The PC's own Vex: granted by a reported rapier hit, consumed at
  // the next pending creation against the same enemy.
  const duelist = await addPc({
    name: 'Duelist', ability_scores: JSON.stringify({ str: 10, dex: 16, con: 14, int: 10, wis: 12, cha: 8 }),
    equipment: JSON.stringify({ mainHand: { name: 'Rapier' } }), mastered_weapons: JSON.stringify(['Rapier'])
  });
  await pas.createPcPendingAttack(sessionId, duelist.id, duelist, ogreRow, {});
  const r4 = await pas.resolveReportedAttack(sessionId, duelist.id, [14], 6);
  assert(r4 && r4.hit === true && r4.vexGained === true, 'reported rapier hit grants the PC Vex');
  const p5 = await pas.createPcPendingAttack(sessionId, duelist.id, duelist, ogreRow, {});
  assert(p5.pending.mode === 'advantage' && p5.pending.modeReasons.includes('Vex'),
    'the next pending attack against the ogre is advantaged by Vex');
  await pas.resolveReportedAttack(sessionId, duelist.id, [2, 3], null); // burn it with a miss (no re-grant)
  const p6 = await pas.createPcPendingAttack(sessionId, duelist.id, duelist, ogreRow, {});
  assert(p6.pending.mode !== 'advantage', 'Vex does not linger after use');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
