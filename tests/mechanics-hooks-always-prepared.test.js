// tests/mechanics-hooks-always-prepared.test.js — mechanics hooks
// Family 3: cleric + druid prepared-spell validators and the
// GET /api/spells alwaysPrepared envelope (2026-11-09, staged —
// NOT pushed, NOT gated).
//
// 2024 PHB rule (verified at build against the live build, not
// carried from the 2014 table): a cleric prepares Wis mod +
// cleric level spells, min 1; a druid prepares Wis mod + druid
// level, min 1. The caps in the new services agree with
// levelProgression.getSpellsPrepared at every level and mod
// (group (a) pins that agreement, so a drift in either file
// fails here). Domain / circle spells are ALWAYS PREPARED and
// never count — the lists come from
// subclassService.clericDomainSpellsAtLevel /
// druidCircleSpellsAtLevel, the same helpers the validators use.
//
// Three Family 3 rules, all pinned here:
//  (1) Land druid reads its stored land type from
//      subclass_choices_json (migration 103, key land_type). No
//      stored land type -> NO exclusion (fail-closed, never a
//      default land): the land spells count.
//  (2) "Always prepared" and "added to the list" are different
//      gates and must never be conflated. Warlock patron spells
//      are added-to-list, not always prepared: a patron spell the
//      player prepares COUNTS, and the /api/spells envelope lists
//      only Contact Other Plane at 9th+ for warlocks.
//  (3) Multiclass levels count via class_levels (D6): a
//      cleric-3 / fighter-2 caps at Wis mod + 3 (the cleric
//      level), not Wis mod + 5 (the total level).
//
// Honest integration tests: the caps come from the real
// levelProgression.js tables and the real clericService.js /
// druidService.js, and every PUT/level-up case drives the real
// character router over HTTP on a real throwaway DB (the
// warlock-validator-wiring harness). If levelProgression.js,
// clericService.js, druidService.js, or character.js were deleted,
// the imports fail and the suite fails with them.
import assert from 'node:assert';
import express from 'express';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

let passed = 0;
let failed = 0;
function check(condition, message) {
  if (condition) { passed++; }
  else { failed++; console.error('  ✗', message); }
}
function group(name) { console.log('\n==', name); }

const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mechanics-hooks-always-prepared-test-'));
const tmpDir = repoRoot;
const origCwd = process.cwd();
process.chdir(tmpDir);
delete process.env.TURSO_DATABASE_URL;
delete process.env.TURSO_AUTH_TOKEN;
const fromRepo = (rel) => pathToFileURL(path.join(origCwd, rel)).href;
const readRepo = (rel) => fs.readFileSync(path.join(origCwd, rel), 'utf8');

const db = await import(fromRepo('server/database.js'));
await db.initDatabase();
// The real server functions under test — caps come from these, not
// from literals invented in the test (the formula is asserted
// against levelProgression at every level and mod).
const { getSpellsPrepared, getXPToNextLevel } = await import(fromRepo('server/config/levelProgression.js'));
const { preparedSpellsMax: clericPreparedMax, validatePreparedSpells: validateCleric } = await import(fromRepo('server/services/clericService.js'));
const { preparedSpellsMax: druidPreparedMax, validatePreparedSpells: validateDruid } = await import(fromRepo('server/services/druidService.js'));
const { clericDomainSpellsAtLevel, druidCircleSpellsAtLevel } = await import(fromRepo('server/services/subclassService.js'));

// --- HTTP harness: the real character + spells routers on a real express app ----
const app = express();
app.use(express.json());
const characterRouter = (await import(fromRepo('server/routes/character.js'))).default;
app.use('/api/character', characterRouter);
const spellsRouter = (await import(fromRepo('server/routes/spells.js'))).default;
app.use('/api/spells', spellsRouter);
const server = await new Promise((resolve) => {
  const s = app.listen(0, '127.0.0.1', () => resolve(s));
});
const base = `http://127.0.0.1:${server.address().port}`;
const J = (v) => JSON.stringify(v);
async function req(method, url, body) {
  const res = await fetch(`${base}${url}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json = null;
  try { json = await res.json(); } catch {}
  return { status: res.status, json };
}
async function readCharacter(id) {
  return db.dbGet('SELECT * FROM characters WHERE id = ?', [id]);
}
function readPrepared(id) {
  return readCharacter(id).then((r) => JSON.parse(r.prepared_spells || '[]'));
}

// Wis +3 (score 16) at every level used below, so the cap moves
// only with level.
const WIS3_SCORES = { str: 10, dex: 10, con: 14, int: 10, wis: 16, cha: 10 };
const CHA3_SCORES = { str: 10, dex: 10, con: 14, int: 10, wis: 10, cha: 16 };

// Life Domain always-prepared at L5 (registry, via the helper):
// Aid, Bless, Cure Wounds, Lesser Restoration (L3) + Mass Healing
// Word, Revivify (L5). Spiritual Weapon is NOT a Life domain spell
// in the registry — the design doc's §1 example names it, but the
// registry is authoritative and the validator follows the helper.
const LIFE_L5 = ['Aid', 'Bless', 'Cure Wounds', 'Lesser Restoration', 'Mass Healing Word', 'Revivify'];
// Circle of the Land (polar) always-prepared at L5: Fog Cloud,
// Hold Person, Ray of Frost (L3) + Sleet Storm (L5).
const LAND_POLAR_L5 = ['Fog Cloud', 'Hold Person', 'Ray of Frost', 'Sleet Storm'];
// Circle of the Moon always-prepared at L5.
const MOON_L5 = ['Cure Wounds', 'Moonbeam', 'Starry Wisp', 'Conjure Animals'];

// 8 counted cleric picks — none is a Life domain spell.
const CLERIC8 = ['Guiding Bolt', 'Healing Word', 'Shield of Faith', 'Command', 'Hold Person', 'Spiritual Weapon', 'Sanctuary', 'Detect Magic'];
// 8 counted druid picks — none is a Land (polar) spell.
const DRUID8 = ['Entangle', 'Faerie Fire', 'Goodberry', 'Healing Word', 'Moonbeam', 'Flaming Sphere', 'Pass without Trace', 'Call Lightning'];
// 8 counted druid picks for the Moon test — Moonbeam excluded from
// the counted set because it IS a Moon circle spell.
const DRUID8_MOON = ['Entangle', 'Faerie Fire', 'Goodberry', 'Healing Word', 'Flaming Sphere', 'Pass without Trace', 'Call Lightning', 'Conjure Animals'];

async function makeCharacter({ name, cls, level, scores = null, subclass = null, classLevels = null }) {
  const created = await req('POST', '/api/character', { name, class: cls, race: 'human' });
  assert(created.status === 201, `fixture POST creates ${name} (${cls}) — got ${created.status}`);
  const id = created.json.id;
  const put = await req('PUT', `/api/character/${id}`, {
    level,
    experience: getXPToNextLevel(level - 1) || 0,
    max_hp: 20,
    current_hp: 20,
    ...(scores ? { ability_scores: J(scores) } : {}),
    class_levels: J(classLevels || [{ class: cls, level, subclass }]),
  });
  assert(put.status === 200, `fixture PUT sets ${name} to level ${level} — got ${put.status}: ${JSON.stringify(put.json?.error || '')}`);
  return id;
}

// Seed a stored prepared list directly — bypasses the route on purpose,
// like a row written before this build existed.
async function seedStoredPrepared(id, list) {
  await db.dbRun('UPDATE characters SET prepared_spells = ? WHERE id = ?', [J(list), id]);
  const back = await readPrepared(id);
  assert.deepStrictEqual(back, list, 'seeded stored prepared list reads back');
}

// Seed a stored subclass choice directly (the PUT's allowedFields
// do not include subclass_choices_json — the route reads it from
// the row, never the body).
async function seedSubclassChoices(id, choices) {
  await db.dbRun('UPDATE characters SET subclass_choices_json = ? WHERE id = ?', [J(choices), id]);
  const back = await readCharacter(id);
  assert.deepStrictEqual(JSON.parse(back.subclass_choices_json), choices, 'seeded subclass choices read back');
}

// ===========================================================================
// (a) Server caps: Wis mod + class level, min 1 — agreeing with
// getSpellsPrepared at every level and mod
// ===========================================================================
group('(a) preparedSpellsMax agrees with getSpellsPrepared (cleric + druid)');
{
  let mismatches = 0;
  for (const mod of [-2, -1, 0, 1, 3, 5]) {
    for (let level = 1; level <= 20; level++) {
      if (getSpellsPrepared('cleric', level, mod) !== clericPreparedMax(mod, level)) mismatches++;
      if (getSpellsPrepared('druid', level, mod) !== druidPreparedMax(mod, level)) mismatches++;
    }
  }
  check(mismatches === 0, `cleric/druid preparedSpellsMax = getSpellsPrepared at L1-20, mods [-2,-1,0,1,3,5] (${mismatches} mismatches)`);
  check(clericPreparedMax(3, 1) === 4, 'spot: cleric L1 at Wis +3 prepares 4');
  check(clericPreparedMax(3, 5) === 8, 'spot: cleric L5 at Wis +3 prepares 8');
  check(druidPreparedMax(3, 5) === 8, 'spot: druid L5 at Wis +3 prepares 8');
  check(clericPreparedMax(5, 20) === 25, 'spot: cleric L20 at Wis +5 prepares 25');
  check(clericPreparedMax(-1, 1) === 1, 'spot: cleric L1 at Wis -1 still prepares 1 (min 1)');
  check(druidPreparedMax(-2, 2) === 1, 'spot: druid L2 at Wis -2 still prepares 1 (min 1)');
  // The always-prepared lists the validators exclude come from the
  // registry helpers (verified live in the smoke run): Life L5 is
  // the six spells above; Land polar L5 is the four polar spells;
  // Land with no land type is [] (fail-closed in the helper).
  check(JSON.stringify(clericDomainSpellsAtLevel('cleric', 'Life Domain', 5)) === JSON.stringify(LIFE_L5),
    `clericDomainSpellsAtLevel Life L5 is the six domain spells (got ${JSON.stringify(clericDomainSpellsAtLevel('cleric', 'Life Domain', 5))})`);
  check(JSON.stringify(clericDomainSpellsAtLevel('cleric', 'Life Domain', 1)) === JSON.stringify([]),
    'clericDomainSpellsAtLevel Life L1 is [] (domain spells start at 3rd)');
  check(JSON.stringify(druidCircleSpellsAtLevel('druid', 'Circle of the Land', 5, 'polar')) === JSON.stringify(LAND_POLAR_L5),
    `druidCircleSpellsAtLevel Land polar L5 is the four polar spells (got ${JSON.stringify(druidCircleSpellsAtLevel('druid', 'Circle of the Land', 5, 'polar'))})`);
  check(JSON.stringify(druidCircleSpellsAtLevel('druid', 'Circle of the Land', 5, null)) === JSON.stringify([]),
    'druidCircleSpellsAtLevel Land with no land type is [] (fails closed, never defaults)');
  check(JSON.stringify(druidCircleSpellsAtLevel('druid', 'Circle of the Moon', 5, null)) === JSON.stringify(MOON_L5),
    'druidCircleSpellsAtLevel Moon L5 is the four Moon spells (no land type needed)');
  // Validator shape: over-cap refused with max/counted/over, and
  // the always-prepared exclusion is case-insensitive.
  const over = validateCleric(3, 5, [...CLERIC8, 'Zone of Truth'], []);
  check(over.max === 8 && over.counted === 9 && over.ok === false && over.over === 1,
    `validatePreparedSpells over-cap returns {max 8, counted 9, ok false, over 1} (got ${JSON.stringify(over)})`);
  const excluded = validateCleric(3, 5, [...CLERIC8, ...LIFE_L5], LIFE_L5);
  check(excluded.max === 8 && excluded.counted === 8 && excluded.ok === true,
    `validatePreparedSpells excludes all six Life spells (got ${JSON.stringify(excluded)})`);
  const cased = validateDruid(3, 5, [...DRUID8, 'fog cloud'], LAND_POLAR_L5);
  check(cased.counted === 8 && cased.ok === true,
    `validatePreparedSpells excludes 'fog cloud' typed lowercase (got ${JSON.stringify(cased)})`);
}

// ===========================================================================
// (b) GET /api/spells envelope carries the always-prepared list
// ===========================================================================
group('(b) GET /api/spells envelope carries alwaysPrepared');
{
  const life = await req('GET', `/api/spells?class=cleric&level=5&subclass=${encodeURIComponent('Life Domain')}&abilityMod=3`);
  check(life.status === 200, `/api/spells cleric Life L5 returns 200 (got ${life.status})`);
  check(JSON.stringify(life.json?.alwaysPrepared) === JSON.stringify(LIFE_L5),
    `/api/spells cleric Life L5 alwaysPrepared is the six domain spells (got ${JSON.stringify(life.json?.alwaysPrepared)})`);
  check(life.json?.spellsPrepared === 8, `/api/spells cleric L5 spellsPrepared at Wis +3 is 8 (got ${life.json?.spellsPrepared})`);
  const noSub = await req('GET', '/api/spells?class=cleric&level=5&abilityMod=3');
  check(JSON.stringify(noSub.json?.alwaysPrepared) === JSON.stringify([]),
    '/api/spells cleric with no subclass has alwaysPrepared []');
  const landPolar = await req('GET', `/api/spells?class=druid&level=5&subclass=${encodeURIComponent('Circle of the Land')}&landType=polar&abilityMod=3`);
  check(JSON.stringify(landPolar.json?.alwaysPrepared) === JSON.stringify(LAND_POLAR_L5),
    `/api/spells druid Land polar L5 alwaysPrepared is the four polar spells (got ${JSON.stringify(landPolar.json?.alwaysPrepared)})`);
  const landNone = await req('GET', `/api/spells?class=druid&level=5&subclass=${encodeURIComponent('Circle of the Land')}&abilityMod=3`);
  check(JSON.stringify(landNone.json?.alwaysPrepared) === JSON.stringify([]),
    '/api/spells druid Land with no landType has alwaysPrepared [] (fail-closed)');
  const moon = await req('GET', `/api/spells?class=druid&level=5&subclass=${encodeURIComponent('Circle of the Moon')}&abilityMod=3`);
  check(JSON.stringify(moon.json?.alwaysPrepared) === JSON.stringify(MOON_L5),
    `/api/spells druid Moon L5 alwaysPrepared is the four Moon spells (got ${JSON.stringify(moon.json?.alwaysPrepared)})`);
  // Warlock: patron spells are added-to-list, NOT always prepared —
  // the envelope must not list them. Only Contact Other Plane at 9+.
  const fiend3 = await req('GET', `/api/spells?class=warlock&level=3&subclass=${encodeURIComponent('Fiend Patron')}&abilityMod=3`);
  check(JSON.stringify(fiend3.json?.alwaysPrepared) === JSON.stringify([]),
    `/api/spells warlock Fiend L3 alwaysPrepared is [] (patron spells are added-to-list, got ${JSON.stringify(fiend3.json?.alwaysPrepared)})`);
  const fiend9 = await req('GET', `/api/spells?class=warlock&level=9&subclass=${encodeURIComponent('Fiend Patron')}&abilityMod=3`);
  check(JSON.stringify(fiend9.json?.alwaysPrepared) === JSON.stringify(['Contact Other Plane']),
    `/api/spells warlock Fiend L9 alwaysPrepared is ['Contact Other Plane'] (got ${JSON.stringify(fiend9.json?.alwaysPrepared)})`);
  // Wizard: Spell Mastery / Signature picks are per-character
  // spellbook state, not derivable here — [] on this route.
  const wiz = await req('GET', `/api/spells?class=wizard&level=5&subclass=${encodeURIComponent('Evoker')}&abilityMod=3`);
  check(JSON.stringify(wiz.json?.alwaysPrepared) === JSON.stringify([]),
    '/api/spells wizard L5 alwaysPrepared is [] (spellbook state, not derivable)');
}

// ===========================================================================
// (c) PUT /:id enforces the cleric cap, domain spells excluded
// ===========================================================================
group('(c) PUT /:id enforces the cleric cap');
{
  // L5 Life cleric, Wis +3: cap 8. Eight picks save; nine refuse
  // 400 naming preparedSpells, and the row is unchanged.
  const cle5 = await makeCharacter({ name: 'CleFive', cls: 'cleric', level: 5, scores: WIS3_SCORES, subclass: 'Life Domain' });
  const ok8 = await req('PUT', `/api/character/${cle5}`, { prepared_spells: J(CLERIC8) });
  check(ok8.status === 200, `PUT 8 spells on an L5 Life cleric (cap 8) persists 200 (got ${ok8.status}: ${JSON.stringify(ok8.json?.error || '')})`);
  check(JSON.stringify(await readPrepared(cle5)) === JSON.stringify(CLERIC8),
    'at-cap L5 PUT stored the 8 picks');
  const over9 = await req('PUT', `/api/character/${cle5}`, { prepared_spells: J([...CLERIC8, 'Zone of Truth']) });
  check(over9.status === 400,
    `PUT 9 spells on an L5 Life cleric (cap 8) refuses 400 (got ${over9.status})`);
  check(typeof over9.json?.error === 'string' && over9.json.error.includes('preparedSpells') && over9.json.error.includes('at most 8') && over9.json.error.includes('got 9'),
    `L5 PUT refusal names preparedSpells, cap 8, got 9 (got ${JSON.stringify(over9.json?.error)})`);
  check(JSON.stringify(await readPrepared(cle5)) === JSON.stringify(CLERIC8),
    'refused L5 PUT left the stored prepared list unchanged');
  // Domain spells do not count: 8 picks + all six Life spells save
  // (counted 8); 9 picks + all six refuse (counted 9).
  const withDomain = await req('PUT', `/api/character/${cle5}`, { prepared_spells: J([...CLERIC8, ...LIFE_L5]) });
  check(withDomain.status === 200, `PUT 8 picks + six Life domain spells on an L5 Life cleric persists 200 (got ${withDomain.status}: ${JSON.stringify(withDomain.json?.error || '')})`);
  const overDomain = await req('PUT', `/api/character/${cle5}`, { prepared_spells: J([...CLERIC8, 'Zone of Truth', ...LIFE_L5]) });
  check(overDomain.status === 400,
    `PUT 9 picks + six Life domain spells on an L5 Life cleric refuses 400 (got ${overDomain.status})`);
  check(typeof overDomain.json?.error === 'string' && overDomain.json.error.includes('at most 8') && overDomain.json.error.includes('got 9'),
    `L5 PUT refusal counts 9 against cap 8 with domain spells present (got ${JSON.stringify(overDomain.json?.error)})`);
  // Case-insensitive exclusion: 'bless' typed lowercase is still a
  // domain spell and does not count.
  const lowerDomain = await req('PUT', `/api/character/${cle5}`, { prepared_spells: J([...CLERIC8, 'bless']) });
  check(lowerDomain.status === 200, `PUT 8 picks + 'bless' (lowercase) on an L5 Life cleric persists 200 (got ${lowerDomain.status}: ${JSON.stringify(lowerDomain.json?.error || '')})`);
}

// ===========================================================================
// (d) PUT /:id enforces the druid cap; Land fails closed with no land
// ===========================================================================
group('(d) PUT /:id enforces the druid cap (Land fail-closed)');
{
  // L5 Land druid, Wis +3, stored land_type polar: cap 8. Eight
  // picks + the four polar spells save (counted 8).
  const dru5 = await makeCharacter({ name: 'DruFive', cls: 'druid', level: 5, scores: WIS3_SCORES, subclass: 'Circle of the Land' });
  await seedSubclassChoices(dru5, { land_type: 'polar' });
  const ok8 = await req('PUT', `/api/character/${dru5}`, { prepared_spells: J([...DRUID8, ...LAND_POLAR_L5]) });
  check(ok8.status === 200, `PUT 8 picks + four polar spells on an L5 Land druid (polar stored) persists 200 (got ${ok8.status}: ${JSON.stringify(ok8.json?.error || '')})`);
  // A temperate land spell is NOT excluded by a polar choice: 8
  // picks + Lightning Bolt (temperate) is counted 9 and refuses.
  const wrongLand = await req('PUT', `/api/character/${dru5}`, { prepared_spells: J([...DRUID8, 'Lightning Bolt']) });
  check(wrongLand.status === 400,
    `PUT 8 picks + Lightning Bolt (temperate, not the stored polar land) refuses 400 (got ${wrongLand.status})`);
  check(typeof wrongLand.json?.error === 'string' && wrongLand.json.error.includes('at most 8') && wrongLand.json.error.includes('got 9'),
    `polar-stored PUT refusal counts the temperate spell (got ${JSON.stringify(wrongLand.json?.error)})`);
  // No stored land type: the polar spells COUNT. Eight picks + Fog
  // Cloud is counted 9 and refuses.
  const druNoLand = await makeCharacter({ name: 'DruNoLand', cls: 'druid', level: 5, scores: WIS3_SCORES, subclass: 'Circle of the Land' });
  const noLandOk = await req('PUT', `/api/character/${druNoLand}`, { prepared_spells: J(DRUID8) });
  check(noLandOk.status === 200, `PUT 8 picks on an L5 Land druid with no stored land type persists 200 (got ${noLandOk.status}: ${JSON.stringify(noLandOk.json?.error || '')})`);
  const noLandOver = await req('PUT', `/api/character/${druNoLand}`, { prepared_spells: J([...DRUID8, 'Fog Cloud']) });
  check(noLandOver.status === 400,
    `PUT 8 picks + Fog Cloud on an L5 Land druid with no stored land type refuses 400 (got ${noLandOver.status})`);
  check(typeof noLandOver.json?.error === 'string' && noLandOver.json.error.includes('at most 8') && noLandOver.json.error.includes('got 9'),
    `no-land PUT refusal counts Fog Cloud (got ${JSON.stringify(noLandOver.json?.error)})`);
  check(JSON.stringify(await readPrepared(druNoLand)) === JSON.stringify(DRUID8),
    'refused no-land PUT left the stored prepared list unchanged');
  // Moon druid: 8 picks + the four Moon spells save (counted 8).
  const moon5 = await makeCharacter({ name: 'DruMoon', cls: 'druid', level: 5, scores: WIS3_SCORES, subclass: 'Circle of the Moon' });
  const moonOk = await req('PUT', `/api/character/${moon5}`, { prepared_spells: J([...DRUID8_MOON, ...MOON_L5]) });
  check(moonOk.status === 200, `PUT 8 picks + four Moon spells on an L5 Moon druid persists 200 (got ${moonOk.status}: ${JSON.stringify(moonOk.json?.error || '')})`);
}

// ===========================================================================
// (e) PUT skips: non-cleric/druid, secondary multiclass, no-list, creator marker
// ===========================================================================
group('(e) PUT skips: the validator only governs primary clerics/druids');
{
  // (i) A fighter-primary character's prepared list is not governed
  // by either cap — 9 spells persist 200.
  const fig = await makeCharacter({ name: 'FigNoCle', cls: 'fighter', level: 5, scores: WIS3_SCORES });
  const fig9 = [...CLERIC8, 'Zone of Truth'];
  const put9 = await req('PUT', `/api/character/${fig}`, { prepared_spells: J(fig9) });
  check(put9.status === 200,
    `PUT 9 spells on a fighter-primary character persists 200 (got ${put9.status}: ${JSON.stringify(put9.json?.error || '')})`);
  check(JSON.stringify(await readPrepared(fig)) === JSON.stringify(fig9),
    'fighter-primary 9-spell PUT stored the list');
  // (ii) Same, with cleric as the SECONDARY class: the shared
  // prepared_spells column is governed by the primary class's editor.
  await db.dbRun('UPDATE characters SET class_levels = ? WHERE id = ?', [J([{ class: 'fighter', level: 5, subclass: null }, { class: 'cleric', level: 1, subclass: null }]), fig]);
  const put9b = await req('PUT', `/api/character/${fig}`, { prepared_spells: J(fig9) });
  check(put9b.status === 200,
    `PUT 9 spells on a fighter-primary / cleric-secondary character persists 200 (got ${put9b.status}: ${JSON.stringify(put9b.json?.error || '')})`);
  check(JSON.stringify(await readPrepared(fig)) === JSON.stringify(fig9),
    'fighter-primary / cleric-secondary 9-spell PUT stored the list');
  // (iii) No prepared_spells in the body: a plain field update is
  // unaffected.
  const cle5 = await makeCharacter({ name: 'CleNoList', cls: 'cleric', level: 5, scores: WIS3_SCORES, subclass: 'Life Domain' });
  await seedStoredPrepared(cle5, [...CLERIC8]);
  const plain = await req('PUT', `/api/character/${cle5}`, { name: 'CleNoList Renamed' });
  check(plain.status === 200, `PUT with no prepared_spells is unaffected, 200 (got ${plain.status})`);
  check((await readCharacter(cle5)).name === 'CleNoList Renamed', 'plain PUT still persisted the name change');
  check(JSON.stringify(await readPrepared(cle5)) === JSON.stringify([...CLERIC8]), 'plain PUT left the stored prepared list alone');
  // (iv) Creator-marker PUT goes through the Stage 4 validator, not
  // the new block: the empty list passes, and an over-cap marker list
  // refuses with Stage 4's wording, not the new block's
  // 'may prepare at most'.
  const markerCle = await makeCharacter({ name: 'CleMarker', cls: 'cleric', level: 1, scores: WIS3_SCORES, subclass: 'Life Domain' });
  const markerPut = await req('PUT', `/api/character/${markerCle}`, {
    creator: 'creator-next', prepared_spells: J([]),
  });
  check(markerPut.status === 200,
    `creator-marker PUT with an empty list passes 200 (got ${markerPut.status}: ${JSON.stringify(markerPut.json?.error || '')})`);
  check(JSON.stringify(await readPrepared(markerCle)) === JSON.stringify([]), 'marker PUT persisted the empty list');
  const markerOver = await req('PUT', `/api/character/${markerCle}`, {
    // All 1st-level cleric spells, so the only possible refusal is
    // the count (L1 cap 4) — never a spell-level refusal.
    creator: 'creator-next', prepared_spells: J(['Guiding Bolt', 'Healing Word', 'Shield of Faith', 'Command', 'Sanctuary']),
  });
  check(markerOver.status === 400,
    `creator-marker PUT with 5 spells on an L1 cleric (cap 4) refuses 400 via Stage 4 (got ${markerOver.status})`);
  check(typeof markerOver.json?.error === 'string' && markerOver.json.error.includes('preparedSpells'),
    `marker refusal names preparedSpells (got ${JSON.stringify(markerOver.json?.error)})`);
  check(typeof markerOver.json?.error === 'string' && !markerOver.json.error.includes('may prepare at most'),
    `marker refusal is Stage 4's wording, not the new block's (got ${JSON.stringify(markerOver.json?.error)})`);
  check(JSON.stringify(await readPrepared(markerCle)) === JSON.stringify([]),
    'refused marker PUT left the stored prepared list unchanged');
}

// ===========================================================================
// (f) Level-up path — stored-list re-check on leveling up IN cleric/druid
// ===========================================================================
group('(f) level-up re-check: over-cap stored list blocks, level unchanged');
{
  // Cleric L5 -> L6, Wis +3, with 10 spells stored: over the L6 cap
  // (9). Refuses 400, the level stays 5, the list is unchanged.
  const cle = await makeCharacter({ name: 'CleLevel', cls: 'cleric', level: 5, scores: WIS3_SCORES, subclass: 'Life Domain' });
  await db.dbRun('UPDATE characters SET experience = ? WHERE id = ?', [getXPToNextLevel(5), cle]);
  await seedStoredPrepared(cle, [...CLERIC8, 'Zone of Truth', 'Dispel Magic']);
  const up = await req('POST', `/api/character/level-up/${cle}`, {});
  check(up.status === 400,
    `level-up L5->6 with 10 stored spells (L6 cap 9) refuses 400 (got ${up.status}: ${JSON.stringify(up.json?.error || '')})`);
  check(typeof up.json?.error === 'string' && up.json.error.includes('preparedSpells'),
    `level-up refusal names preparedSpells (got ${JSON.stringify(up.json?.error)})`);
  check(typeof up.json?.error === 'string' && up.json.error.includes('fix the prepared list on the character sheet'),
    `level-up refusal carries the fix-on-the-sheet message (got ${JSON.stringify(up.json?.error)})`);
  const row = await readCharacter(cle);
  check(row.level === 5, 'refused level-up left the level at 5');
  check(JSON.parse(row.prepared_spells).length === 10,
    'refused level-up left the over-cap stored prepared list unchanged');
  // Domain spells do not block the L5 -> L6 level-up: 8 counted
  // picks + the six Life spells count 8 against the L6 cap of 9.
  const cleOk = await makeCharacter({ name: 'CleLevelOk', cls: 'cleric', level: 5, scores: WIS3_SCORES, subclass: 'Life Domain' });
  await db.dbRun('UPDATE characters SET experience = ? WHERE id = ?', [getXPToNextLevel(5), cleOk]);
  await seedStoredPrepared(cleOk, [...CLERIC8, ...LIFE_L5]);
  const upOk = await req('POST', `/api/character/level-up/${cleOk}`, {});
  check(upOk.status === 200,
    `level-up L5->6 with 8 picks + six Life spells (counted 8 = L6 cap 9) succeeds 200 (got ${upOk.status}: ${JSON.stringify(upOk.json?.error || '')})`);
  check((await readCharacter(cleOk)).level === 6, 'domain-excluded level-up raised the level to 6');
  // Druid Land L5 -> L6 with a stored polar land: 8 counted picks
  // + the four polar spells count 8 against the L6 cap of 9.
  const dru = await makeCharacter({ name: 'DruLevel', cls: 'druid', level: 5, scores: WIS3_SCORES, subclass: 'Circle of the Land' });
  await db.dbRun('UPDATE characters SET experience = ? WHERE id = ?', [getXPToNextLevel(5), dru]);
  await seedSubclassChoices(dru, { land_type: 'polar' });
  await seedStoredPrepared(dru, [...DRUID8, ...LAND_POLAR_L5]);
  const upDru = await req('POST', `/api/character/level-up/${dru}`, {});
  check(upDru.status === 200,
    `level-up L5->6 with 8 picks + four polar spells (stored polar, counted 8 = L6 cap 9) succeeds 200 (got ${upDru.status}: ${JSON.stringify(upDru.json?.error || '')})`);
  check((await readCharacter(dru)).level === 6, 'land-excluded level-up raised the level to 6');
  // Control: the same stored list with NO stored land type blocks
  // the same level-up (the polar spells count: 12 > L6 cap 9).
  const druNoLand = await makeCharacter({ name: 'DruLevelNoLand', cls: 'druid', level: 5, scores: WIS3_SCORES, subclass: 'Circle of the Land' });
  await db.dbRun('UPDATE characters SET experience = ? WHERE id = ?', [getXPToNextLevel(5), druNoLand]);
  await seedStoredPrepared(druNoLand, [...DRUID8, ...LAND_POLAR_L5]);
  const upNoLand = await req('POST', `/api/character/level-up/${druNoLand}`, {});
  check(upNoLand.status === 400,
    `level-up L5->6 with 8 picks + four polar spells and NO stored land type refuses 400 (got ${upNoLand.status})`);
  check((await readCharacter(druNoLand)).level === 5, 'refused no-land level-up left the level at 5');
}

// ===========================================================================
// (g) Multiclass: cleric/druid levels count via class_levels (D6)
// ===========================================================================
group('(g) multiclass: the cap reads the class level from class_levels');
{
  // Primary cleric, class_levels cleric 3 / fighter 2 (total level
  // 5), Wis +3: the cleric cap is Wis mod + CLERIC level 3 = 6,
  // not Wis mod + total level 5 = 8. Six picks save; seven refuse.
  const multi = await makeCharacter({
    name: 'CleMulti', cls: 'cleric', level: 5, scores: WIS3_SCORES,
    classLevels: [{ class: 'cleric', level: 3, subclass: 'Life Domain' }, { class: 'fighter', level: 2, subclass: null }],
  });
  const six = CLERIC8.slice(0, 6);
  const ok6 = await req('PUT', `/api/character/${multi}`, { prepared_spells: J(six) });
  check(ok6.status === 200, `PUT 6 spells on a cleric-3 / fighter-2 (cleric cap 6) persists 200 (got ${ok6.status}: ${JSON.stringify(ok6.json?.error || '')})`);
  const seven = CLERIC8.slice(0, 7);
  const over7 = await req('PUT', `/api/character/${multi}`, { prepared_spells: J(seven) });
  check(over7.status === 400,
    `PUT 7 spells on a cleric-3 / fighter-2 (cleric cap 6) refuses 400 (got ${over7.status})`);
  check(typeof over7.json?.error === 'string' && over7.json.error.includes('at most 6') && over7.json.error.includes('got 7'),
    `multiclass PUT refusal names cap 6, got 7 (got ${JSON.stringify(over7.json?.error)})`);
  check(JSON.stringify(await readPrepared(multi)) === JSON.stringify(six),
    'refused multiclass PUT left the stored prepared list unchanged');
  // Same for druid: primary druid, druid 3 / fighter 2, Wis +3:
  // cap 6. Seven picks + a polar spell with NO stored land refuse
  // (counted 8); with polar stored the polar spell is excluded and
  // seven picks still refuse (counted 7 > 6).
  const druMulti = await makeCharacter({
    name: 'DruMulti', cls: 'druid', level: 5, scores: WIS3_SCORES,
    classLevels: [{ class: 'druid', level: 3, subclass: 'Circle of the Land' }, { class: 'fighter', level: 2, subclass: null }],
  });
  const druSeven = DRUID8.slice(0, 7);
  const druOver = await req('PUT', `/api/character/${druMulti}`, { prepared_spells: J(druSeven) });
  check(druOver.status === 400,
    `PUT 7 spells on a druid-3 / fighter-2 (druid cap 6) refuses 400 (got ${druOver.status})`);
  check(typeof druOver.json?.error === 'string' && druOver.json.error.includes('at most 6') && druOver.json.error.includes('got 7'),
    `multiclass druid PUT refusal names cap 6, got 7 (got ${JSON.stringify(druOver.json?.error)})`);
  // Leveling up INTO cleric is never blocked: a fighter L1 with 10
  // stored spells levels into cleric. Wis 16 meets the cleric
  // multiclass requirement (Wis 13).
  const fig2 = await makeCharacter({ name: 'FigMultiCle', cls: 'fighter', level: 1, scores: WIS3_SCORES });
  await db.dbRun('UPDATE characters SET experience = ? WHERE id = ?', [getXPToNextLevel(1), fig2]);
  await seedStoredPrepared(fig2, [...CLERIC8, 'Zone of Truth', 'Dispel Magic']);
  const up = await req('POST', `/api/character/level-up/${fig2}`, { selectedClass: 'cleric' });
  check(up.status === 200,
    `level-up fighter L1 -> cleric L1 with 10 stored spells succeeds 200 (got ${up.status}: ${JSON.stringify(up.json?.error || '')})`);
  const row = await readCharacter(fig2);
  check(row.level === 2, 'multiclass level-up raised the total level to 2');
  const levels = JSON.parse(row.class_levels || '[]');
  check(levels.some((e) => String(e?.class ?? '').toLowerCase() === 'cleric' && Number(e?.level) === 1),
    'multiclass level-up added cleric at level 1');
  check(JSON.stringify(await readPrepared(fig2)) === JSON.stringify([...CLERIC8, 'Zone of Truth', 'Dispel Magic']),
    'multiclass level-up left the 10-spell stored list unchanged');
}

// ===========================================================================
// (h) Warlock patron spells still count (added-to-list, not excluded)
// ===========================================================================
group('(h) warlock patron spells still count (regression guard)');
{
  // Fiend L3 warlock, cap 4: Fireball is a Fiend patron spell. Four
  // picks incl. Fireball save (at cap); five picks incl. Fireball
  // refuse (counted 5 — no exclusion). The warlock PUT block is
  // untouched by this job; this group pins the distinction it
  // preserves.
  const wlk3 = await makeCharacter({ name: 'WlkThree', cls: 'warlock', level: 3, scores: CHA3_SCORES, classLevels: [{ class: 'warlock', level: 3, subclass: 'Fiend Patron' }] });
  const fireball4 = ['Hex', 'Arms of Hadar', 'Charm Person', 'Fireball'];
  const okFb4 = await req('PUT', `/api/character/${wlk3}`, { prepared_spells: J(fireball4) });
  check(okFb4.status === 200, `PUT 4 picks incl. Fireball on a Fiend L3 warlock (cap 4) persists 200 (got ${okFb4.status}: ${JSON.stringify(okFb4.json?.error || '')})`);
  const fireball5 = ['Hex', 'Arms of Hadar', 'Charm Person', 'Bane', 'Fireball'];
  const overFb = await req('PUT', `/api/character/${wlk3}`, { prepared_spells: J(fireball5) });
  check(overFb.status === 400,
    `PUT 5 picks incl. Fireball on a Fiend L3 warlock refuses 400 (got ${overFb.status})`);
  check(typeof overFb.json?.error === 'string' && overFb.json.error.includes('at most 4') && overFb.json.error.includes('got 5'),
    `L3 PUT refusal counts the patron spell (got 5, got ${JSON.stringify(overFb.json?.error)})`);
  check(JSON.stringify(await readPrepared(wlk3)) === JSON.stringify(fireball4),
    'refused L3 PUT left the stored prepared list unchanged');
}

// ===========================================================================
// (i) Kind-F reclassification (Amendment 2): the four wizard Savants
// are kind D — static pin, no registry count drift unnoticed
// ===========================================================================
group('(i) wizard Savants reclassified F -> D (static pin)');
{
  const wizardSrc = readRepo('server/data/subclasses/wizard.js');
  for (const savant of ['Abjuration Savant', 'Divination Savant', 'Evocation Savant', 'Illusion Savant']) {
    const nameIdx = wizardSrc.indexOf(`name: '${savant}'`);
    check(nameIdx !== -1, `wizard.js contains ${savant}`);
    const block = wizardSrc.slice(Math.max(0, nameIdx - 400), nameIdx + 1200);
    check(block.includes("kind: 'D'"), `${savant} is kind 'D'`);
    check(!block.includes("kind: 'F'"), `${savant} is no longer kind 'F'`);
    check(!block.includes('no spellbook system exists'), `${savant} engine note no longer says no spellbook system exists`);
    check(block.includes('spellbookService.js'), `${savant} engine note points at the spellbook system`);
  }
  const { WIZARD_SUBCLASSES } = await import(fromRepo('server/data/subclasses/wizard.js'));
  const savants = WIZARD_SUBCLASSES.flatMap((s) => s.features || []).filter((f) => String(f.name || '').endsWith('Savant'));
  check(savants.length === 4, `exactly four Savant features in the wizard registry (got ${savants.length})`);
  check(savants.every((f) => f.kind === 'D'), 'all four Savants are kind D in the live registry data');
  check(savants.every((f) => f.kind !== 'F'), 'no Savant remains kind F in the live registry data');
}

server.close();
console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
process.exit(failed > 0 ? 1 : 0);
