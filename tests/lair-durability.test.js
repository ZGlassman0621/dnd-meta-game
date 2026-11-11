// tests/lair-durability.test.js — lair durability (2026-11-02, Zach-approved).
// Real service, real DB. No roll-dependent assert except where the test
// itself supplies the outcome (tickRound hazardRoll, resolveCollapseEscape
// escaped) — the same fabricated-outcome shape other tests use for pending
// rolls. Party HP is never touched by this service: collapse records an
// escape/buried flag only, and the test asserts party HP is unchanged.
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');

const dbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dnd-lair-'));
process.chdir(dbDir);
delete process.env.TURSO_DATABASE_URL;
delete process.env.TURSO_AUTH_TOKEN;

const svc = (rel) => pathToFileURL(path.join(REPO, rel)).href;
const { initDatabase, dbAll, dbGet, dbRun } = await import(svc('server/database.js'));
await initDatabase();
const ld = await import(svc('server/services/lairDurabilityService.js'));
const es = await import(svc('server/services/enemyCombatService.js'));
const pipeline = await import(svc('server/services/markerPipeline.js'));
await import(svc('server/services/lairDurabilityService.js')); // registers LAIR_* handlers

let passed = 0, failed = 0;
function group(name) { console.log('== ' + name + ' =='); }
function ok(cond, msg) {
  try { assert(cond, msg); passed++; }
  catch (e) { failed++; console.error('FAIL:', msg, '|', e.message); }
}

async function insertRow(table, overrides = {}) {
  const info = await dbAll(`PRAGMA table_info(${table})`);
  const cols = []; const vals = [];
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

async function markerResult(text, characterId, sessionId, key) {
  const res = await pipeline.processResponseMarkers(text, { characterId, sessionId });
  const h = res.handlerResults.filter((hr) => hr.schemaKey === key);
  return h.length ? h[0].result : null;
}

const gob = (name) => ({ name, maxHp: 60, armorClass: 5, attackBonus: 3, damageDice: '1d6', dexMod: 1,
  statsJson: JSON.stringify({ abilities: { str: 8, dex: 14, con: 10, int: 10, wis: 8, cha: 8 }, cr: '1/4', skills: {} }) });

group('1. Damage from three source types moves a high pool by exact amounts, bands transition');
{
  const c = await ld.createLair({ lairKey: 'cave-1', name: 'Ember Cave' });
  ok(c.success === true && c.hp === 1000 && c.maxHp === 1000 && c.percent === 100 && c.band === 'sound', 'new lair starts at 1000/1000, sound');
  const a = await ld.applyEnvironmentalDamage('cave-1', 50, { source: 'boss shake' });
  ok(a.success === true && a.hp === 950 && a.percent === 95 && a.band === 'worn', 'boss shake: 50 damage -> 95% worn');
  const b = await ld.applyEnvironmentalDamage('cave-1', 200, { source: 'missed spell' });
  ok(b.success === true && b.hp === 750 && b.percent === 75 && b.band === 'unstable', 'missed spell: 200 damage -> 75% unstable');
  const d = await ld.applyEnvironmentalDamage('cave-1', 300, { source: 'axe strike on wall' });
  ok(d.success === true && d.hp === 450 && d.percent === 45 && d.band === 'collapsing', 'axe strike: 300 damage -> 45% collapsing');
  const bad = await ld.applyEnvironmentalDamage('no-such-lair', 10, {});
  ok(bad.success === false && /unknown lair/.test(bad.reason || ''), 'damage to an unknown lair refused, never invents a lair');
  const zero = await ld.applyEnvironmentalDamage('cave-1', 0, {});
  ok(zero.success === false, 'zero damage refused');
}

group('2. Hazards draw only from held features; secret and non-hazard features never hazard');
{
  await ld.createLair({
    lairKey: 'cave-2', name: 'Stalactite Cave',
    features: [
      { name: 'Stalactites', kind: 'elevation' },
      { name: 'Torch sconce', kind: 'flammable' },
      { name: 'Hidden panel', kind: 'secret' },
      { name: 'Loose rubble', kind: 'difficult_terrain' },
    ],
    exits: ['tunnel out'],
  });
  await ld.applyEnvironmentalDamage('cave-2', 300, { source: 'explosive' }); // 70% dangerous
  const t = await ld.tickRound('cave-2', { hazardRoll: 1 }); // fires at any non-zero chance
  ok(t.hazard && t.hazard.feature === 'Stalactites' && t.hazard.kind === 'elevation', 'hazard draws the first held hazard feature, not the secret or rubble');
  ok(t.hazard && t.hazard.dice === '3d6', 'dangerous band hazard rolls 3d6');
  await ld.createLair({
    lairKey: 'cave-2b', name: 'Quiet Cave',
    features: [{ name: 'Hidden panel', kind: 'secret' }, { name: 'Loose rubble', kind: 'difficult_terrain' }],
  });
  await ld.applyEnvironmentalDamage('cave-2b', 300, { source: 'explosive' });
  const t2 = await ld.tickRound('cave-2b', { hazardRoll: 1 });
  ok(t2.hazard === null, 'hazard rolled but no hazard features held -> no hazard, nothing invented');
  const t3 = await ld.tickRound('cave-2', { hazardRoll: 100 });
  ok(t3.hazard === null, 'a roll above the band chance fires no hazard');
}

group('3. Decay under 10% and magical hold stopping it; magic restores no HP');
{
  await ld.createLair({ lairKey: 'cave-3', name: 'Failing Cave' });
  await ld.applyEnvironmentalDamage('cave-3', 910, { source: 'dragon shake' }); // 90 HP, 9%
  const before = await ld.getLair('cave-3');
  ok(before.percent === 9 && before.band === 'ruin', '90 HP is 9% ruin band');
  const t = await ld.tickRound('cave-3', { hazardRoll: 100 });
  ok(t.decayed === 20 && t.hp === 70, 'under 10% decays 20 HP per round without a magical hold');
  const m = await ld.stabilizeMagic('cave-3');
  ok(m.success === true && m.hp === 70 && m.magicallyStabilized === true, 'magical stabilization holds the score and restores no HP');
  const t2 = await ld.tickRound('cave-3', { hazardRoll: 100 });
  ok(t2.decayed === 0 && t2.hp === 70, 'magically stabilized room does not decay');
  await ld.clearMagicalHold('cave-3');
  const t3 = await ld.tickRound('cave-3', { hazardRoll: 100 });
  ok(t3.decayed === 20 && t3.hp === 50, 'hold released, decay resumes');
}

group('4. Collapse gives an escape chance, never instantly kills; mechanical restore reopens a ruin');
{
  const pcId = await insertRow('characters', {
    name: 'Tester', class: 'Fighter', level: 5, current_hp: 40, max_hp: 40, armor_class: 16,
    ability_scores: JSON.stringify({ str: 16, dex: 16, con: 14, int: 10, wis: 12, cha: 8 }),
    skills: JSON.stringify([]), spell_slots: JSON.stringify({}), spell_slots_used: JSON.stringify({}),
  });
  await ld.createLair({ lairKey: 'cave-4', name: 'Doomed Cave' });
  await ld.applyEnvironmentalDamage('cave-4', 1000, { source: 'explosive' });
  const atZero = await ld.getLair('cave-4');
  ok(atZero.hp === 0 && atZero.escapePending === true && atZero.collapsed === false, 'at 0 HP the room is collapse-pending, not yet sealed');
  const hpBefore = (await dbGet('SELECT current_hp FROM characters WHERE id = ?', [pcId])).current_hp;
  const esc = await ld.resolveCollapseEscape('cave-4', { escaped: true });
  ok(esc.success === true && esc.escaped === true && esc.collapsed === true && esc.buried === false, 'escaped collapse seals the room, nobody buried');
  const hpAfter = (await dbGet('SELECT current_hp FROM characters WHERE id = ?', [pcId])).current_hp;
  ok(hpAfter === hpBefore, 'collapse changes no party HP by itself');
  const dmg = await ld.applyEnvironmentalDamage('cave-4', 10, {});
  ok(dmg.success === false && /already collapsed/.test(dmg.reason || ''), 'collapsed room refuses further damage');
  const magic = await ld.stabilizeMagic('cave-4');
  ok(magic.success === false && /Mechanically/.test(magic.remedy || ''), 'magic alone cannot reopen a collapsed room');
  const mech = await ld.stabilizeMechanical('cave-4', { amount: 100 });
  ok(mech.success === true && mech.hp === 100 && mech.collapsed === false && mech.buried === false, 'mechanical work restores HP and reopens the room');
  await ld.createLair({ lairKey: 'cave-4b', name: 'Burial Cave' });
  await ld.applyEnvironmentalDamage('cave-4b', 1000, { source: 'explosive' });
  const buried = await ld.resolveCollapseEscape('cave-4b', { escaped: false });
  ok(buried.success === true && buried.collapsed === true && buried.buried === true, 'failed escape records buried, still without touching party HP');
}

group('5. Durability is independent of the boss row; markers work end to end');
{
  const pcId = await insertRow('characters', {
    name: 'Tester2', class: 'Fighter', level: 5, current_hp: 40, max_hp: 40, armor_class: 16,
    ability_scores: JSON.stringify({ str: 16, dex: 16, con: 14, int: 10, wis: 12, cha: 8 }),
    skills: JSON.stringify([]), spell_slots: JSON.stringify({}), spell_slots_used: JSON.stringify({}),
  });
  const sessionId = await insertRow('dm_sessions', { character_id: pcId, status: 'active' });
  const created = await markerResult('[LAIR_CREATE: Lair="cave-5" Name="Dragon Cave" Features="Stalactites:elevation" Exits="tunnel out"]', pcId, sessionId, 'LAIR_CREATE');
  ok(created && created.success === true && created.hp === 1000, 'LAIR_CREATE marker creates the lair at full HP');
  const [gA] = await es.createEncounterEnemies(sessionId, 1, [gob('GobA')]);
  const dmg = await markerResult('[LAIR_DAMAGE: Lair="cave-5" Amount=250 Source="boss shake"]', pcId, sessionId, 'LAIR_DAMAGE');
  ok(dmg && dmg.success === true && dmg.hp === 750 && dmg.band === 'unstable', 'LAIR_DAMAGE marker applies 250 -> 75% unstable');
  await dbRun('DELETE FROM combat_enemies WHERE id = ?', [gA.id]);
  const after = await ld.getLair('cave-5');
  ok(after.hp === 750 && after.percent === 75, 'boss row deleted, durability unchanged');
  const stab = await markerResult('[LAIR_STABILIZE: Lair="cave-5" Method="mechanical" Amount=100]', pcId, sessionId, 'LAIR_STABILIZE');
  ok(stab && stab.success === true && stab.hp === 850, 'LAIR_STABILIZE mechanical restores 100 HP via marker');
  const roll = await markerResult('[LAIR_HAZARD_ROLL: Lair="cave-5"]', pcId, sessionId, 'LAIR_HAZARD_ROLL');
  ok(roll && roll.success === true, 'LAIR_HAZARD_ROLL marker dispatches');
  const disp = (await ld.getLair('cave-5')).display;
  ok(disp && disp.percent === 85 && disp.band === 'unstable' && typeof disp.bar === 'string' && disp.bar.length === 10, 'UI display exposes percent, band, and a 10-block bar');
}

console.log(`\nlair-durability: ${passed} passed, ${failed} failed`);
if (failed) process.exitCode = 1;
