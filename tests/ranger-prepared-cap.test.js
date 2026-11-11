// tests/ranger-prepared-cap.test.js — ranger prepared-spell cap +
// Favored Enemy (2026-11-06, 2024 PHB photos pp. 119-120).
//
// What was wrong: Ranger was still a 2014 known-caster in the build
// — SPELLS_KNOWN held the 2014 known table [0, 2, 3, ...], the shared
// HALF_CASTER slot table was the paladin table (wrong at L1/L8/L10/
// L12/L14/L16), getSpellsPrepared had no ranger arm (null at every
// level), the sheet capped ranger picks at 0, and Stage 4 refused
// any ranger spell pick. A Ranger at creation could not pick any
// spell. Favored Enemy had no implementation at all.
//
// 2024 PHB rule (photos): prepared spells are TABLE-DRIVEN — the L1
// text states no formula ("as shown in the Prepared Spells column"):
// [2, 3, 4, 5, 6, 6, 7, 7, 9, 10, 10, 11, 11, 12, 12, 14, 14, 14,
// 15, 15], L1 = 2 (identical column to paladin). Ranger slots are
// their own table (RANGER_SPELL_SLOTS — L1 {1: 2}). Hunter's Mark
// is always prepared via Favored Enemy and never counts against
// the cap; it can be cast without a slot 2/3/4/5/6 times per Long
// Rest (L1-4 / L5-8 / L9-12 / L13-16 / L17-20).
//
// Honest integration tests: getSpellsPrepared / getSpellsKnown /
// getSpellSlots come from the real levelProgression.js, the cap
// validator from the real rangerService.js, and every PUT/level-up
// case drives the real character router over HTTP on a real
// throwaway DB (the paladin-l1-cap harness). If levelProgression.js,
// rangerService.js, or character.js were deleted, the imports fail
// and the suite fails with them.
//
// MUTATION CHECK (2026-11-06): this suite was run against the
// pre-fix model (2014 known row restored, no ranger arm, no
// rangerService, no PUT/level-up wiring) and FAILED there —
// groups (a)/(b)/(c2)/(c3)/(c5)/(d)/(e) all trip on the old model.
// A passing run therefore proves the fix, not the test's shape.
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

const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ranger-prepared-cap-test-'));
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
// from literals invented in the test (the table literal below is the
// PHB column, asserted against them at every level and mod).
const { getSpellsPrepared, getSpellsKnown, getSpellSlots, getXPToNextLevel } = await import(fromRepo('server/config/levelProgression.js'));
const { preparedSpellsMax, validatePreparedSpells, favoredEnemyFreeCasts, rangerAlwaysPreparedSpells } = await import(fromRepo('server/services/rangerService.js'));
const { canLearnSpell } = await import(fromRepo('server/services/spellSelectionService.js'));

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
function readKnown(id) {
  return readCharacter(id).then((r) => JSON.parse(r.known_spells || '[]'));
}

// Wis +3 (score 16) at every level used below, so the cap moves only
// with level — the table is mod-independent, and the mod sweep in
// group (b) proves it.
const WIS3_SCORES = { str: 10, dex: 16, con: 14, int: 10, wis: 16, cha: 10 };

// The 2024 PHB Prepared Spells column for ranger (photos pp. 119-120).
const RANGER_PREPARED = [2, 3, 4, 5, 6, 6, 7, 7, 9, 10, 10, 11, 11, 12, 12, 14, 14, 14, 15, 15];
// The 2024 PHB ranger slot table (photos pp. 119-120).
const RANGER_SLOTS = {
  1: { 1: 2 }, 2: { 1: 2 }, 3: { 1: 3 }, 4: { 1: 3 },
  5: { 1: 4, 2: 2 }, 6: { 1: 4, 2: 2 }, 7: { 1: 4, 2: 3 },
  8: { 1: 4, 2: 3, 3: 2 }, 9: { 1: 4, 2: 3, 3: 2 },
  10: { 1: 4, 2: 3, 3: 3 }, 11: { 1: 4, 2: 3, 3: 3 },
  12: { 1: 4, 2: 3, 3: 3, 4: 1 }, 13: { 1: 4, 2: 3, 3: 3, 4: 1 },
  14: { 1: 4, 2: 3, 3: 3, 4: 2 }, 15: { 1: 4, 2: 3, 3: 3, 4: 2 },
  16: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 1 }, 17: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 1 },
  18: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 1 }, 19: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2 },
  20: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2 },
};
// Favored Enemy free Hunter's Mark casts (PHB p. 120).
const FAVORED_ENEMY_FREE_CASTS = [2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 6, 6, 6, 6];

async function makeCharacter({ name, cls, level, scores = null, classLevels = null }) {
  const created = await req('POST', '/api/character', { name, class: cls, race: 'human' });
  assert(created.status === 201, `fixture POST creates ${name} (${cls}) — got ${created.status}`);
  const id = created.json.id;
  const put = await req('PUT', `/api/character/${id}`, {
    level,
    experience: getXPToNextLevel(level - 1) || 0,
    max_hp: 20,
    current_hp: 20,
    ...(scores ? { ability_scores: J(scores) } : {}),
    class_levels: J(classLevels || [{ class: cls, level, subclass: null }]),
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
async function seedStoredKnown(id, list) {
  await db.dbRun('UPDATE characters SET known_spells = ? WHERE id = ?', [J(list), id]);
  const back = await readKnown(id);
  assert.deepStrictEqual(back, list, 'seeded stored known list reads back');
}

// ===========================================================================
// (a) Static guard: the sheet's getMaxPrepared has a table-driven ranger branch
// ===========================================================================
group('(a) CharacterSheet getMaxPrepared ranger branch (static guard)');
{
  const sheetSrc = readRepo('client/src/components/CharacterSheet.jsx');
  const fnStart = sheetSrc.indexOf('const getMaxPrepared');
  check(fnStart !== -1, 'CharacterSheet.jsx defines getMaxPrepared');
  const fnEnd = sheetSrc.indexOf('const isPreparedCaster', fnStart);
  const fnSrc = fnEnd !== -1 ? sheetSrc.slice(fnStart, fnEnd) : sheetSrc.slice(fnStart, fnStart + 2000);
  const rngStart = fnSrc.indexOf("className === 'ranger'");
  check(rngStart !== -1, 'getMaxPrepared has a ranger branch');
  const rngSrc = fnSrc.slice(rngStart);
  check(rngSrc.includes('[2, 3, 4, 5, 6, 6, 7, 7, 9, 10, 10, 11, 11, 12, 12, 14, 14, 14, 15, 15]'),
    'ranger branch uses the PHB prepared column (table-driven, not the half-caster formula)');
  check(rngSrc.includes('return RANGER_PREPARED[character.level - 1]'),
    'ranger branch indexes the table by level (L1 prepares 2)');
  check(!rngSrc.includes('Math.max(1, mod + Math.floor(character.level / 2))'),
    'ranger branch does NOT use the half-caster formula (which would give 0 at L1 and 11 at L16)');
  // The sheet only renders the Prepared section for 'All prepared'
  // classes — the classes.json flip is what opens it for rangers.
  const classesJson = JSON.parse(readRepo('client/src/data/classes.json'));
  check(classesJson.ranger?.spellcasting?.spellsKnown === 'All prepared',
    "classes.json ranger spellsKnown is 'All prepared' (opens the Prepared section)");
  check(JSON.stringify(classesJson.ranger?.spellcasting?.spellsKnownByLevel) === JSON.stringify(RANGER_PREPARED),
    'classes.json ranger spellsKnownByLevel is the PHB prepared column');
}

// ===========================================================================
// (b) Server table: prepared column, known=null, slots, service agreement
// ===========================================================================
group('(b) getSpellsPrepared ranger is the PHB table at every level and mod');
{
  let mismatches = 0;
  for (const mod of [-1, 0, 3, 5]) {
    for (let level = 1; level <= 20; level++) {
      if (getSpellsPrepared('ranger', level, mod) !== RANGER_PREPARED[level - 1]) {
        mismatches++;
        console.error(`  ✗ ranger L${level} mod ${mod}: got ${getSpellsPrepared('ranger', level, mod)}, expected ${RANGER_PREPARED[level - 1]}`);
      }
    }
  }
  check(mismatches === 0, `getSpellsPrepared('ranger', L1-20, mod) = PHB column at mods [-1, 0, 3, 5] (${mismatches} mismatches)`);
  check(getSpellsPrepared('ranger', 1, 3) === 2, 'spot: ranger L1 at Wis +3 prepares 2 (ranger HAS 1st-level slots)');
  check(getSpellsPrepared('ranger', 16, 3) === 14, 'spot: ranger L16 prepares 14');
  check(getSpellsPrepared('ranger', 20, 3) === 15, 'spot: ranger L20 prepares 15');
  let knownNonNull = 0;
  for (let level = 1; level <= 20; level++) {
    if (getSpellsKnown('ranger', level) !== null) knownNonNull++;
  }
  check(knownNonNull === 0, `getSpellsKnown('ranger', L1-20) is null at every level (${knownNonNull} non-null — the 2014 known row is gone)`);
  let slotMismatches = 0;
  for (let level = 1; level <= 20; level++) {
    if (JSON.stringify(getSpellSlots('ranger', level)) !== JSON.stringify(RANGER_SLOTS[level])) {
      slotMismatches++;
      console.error(`  ✗ ranger slots L${level}: got ${JSON.stringify(getSpellSlots('ranger', level))}, expected ${JSON.stringify(RANGER_SLOTS[level])}`);
    }
  }
  check(slotMismatches === 0, `getSpellSlots('ranger', L1-20) = RANGER_SPELL_SLOTS (${slotMismatches} mismatches)`);
  let serviceMismatches = 0;
  for (let level = 1; level <= 20; level++) {
    if (preparedSpellsMax(3, level) !== RANGER_PREPARED[level - 1]) serviceMismatches++;
    if (preparedSpellsMax(-2, level) !== RANGER_PREPARED[level - 1]) serviceMismatches++;
  }
  check(serviceMismatches === 0, `rangerService.preparedSpellsMax agrees with the table at every level (mods +3 and -2, ${serviceMismatches} mismatches)`);
  // Paladin has its OWN 2024 tables now (Paladin reconciliation,
  // 2026-11-06 — same Prepared column as ranger, 2 at L1; its own
  // slot table, L1 {1: 2}, L4 {1: 4, 2: 2}). The shared HALF_CASTER
  // table is untouched and serves blackguard only.
  check(JSON.stringify(getSpellSlots('paladin', 1)) === JSON.stringify({ 1: 2 }), 'paladin L1 slots are {1: 2} (own PALADIN_SPELL_SLOTS table)');
  check(getSpellsPrepared('paladin', 1, 3) === 2, 'paladin L1 prepared is 2 (own table, mod-independent)');
  check(JSON.stringify(getSpellSlots('paladin', 4)) === JSON.stringify({ 1: 4, 2: 2 }), 'paladin L4 slots are {1: 4, 2: 2} (ranger L4 is {1: 3} — the tables genuinely differ here)');
  check(JSON.stringify(getSpellSlots('blackguard', 1)) === JSON.stringify({}), 'blackguard L1 slots still {} (shared HALF_CASTER table untouched)');
  check(JSON.stringify(getSpellSlots('ranger', 4)) === JSON.stringify({ 1: 3 }), 'ranger L4 slots are {1: 3}');
  // canLearnSpell gates on the ranger table now: L1 learns 1st-level
  // ranger spells, L8 learns 3rd-level ones, L16 learns 5th-level ones.
  check(canLearnSpell({ classId: 'ranger', level: 1, spellName: 'cure wounds' }).ok === true,
    "canLearnSpell lets a L1 ranger learn Cure Wounds (was rejected: slots {} -> max 0)");
  check(canLearnSpell({ classId: 'ranger', level: 1, spellName: 'pass without trace' }).ok === false,
    'canLearnSpell refuses a 2nd-level spell for a L1 ranger');
  check(canLearnSpell({ classId: 'ranger', level: 8, spellName: 'conjure animals' }).ok === true,
    'canLearnSpell lets a L8 ranger learn a 3rd-level spell (shared table capped L8 at 2nd)');
  check(canLearnSpell({ classId: 'ranger', level: 16, spellName: 'swift quiver' }).ok === true,
    'canLearnSpell lets a L16 ranger learn a 5th-level spell (shared table capped L16 at 4th)');
}

// ===========================================================================
// (c) L1 server coverage is the Stage 4 suite's (cited by reference)
// ===========================================================================
group('(c) L1 server coverage is the Stage 4 suite’s (cited by reference)');
{
  const stage4Src = readRepo('tests/creator-next-stage4.test.js');
  check(stage4Src.includes("['ranger', 0, null, 2, 2],"),
    'Stage 4 suite pins the L1 table row (ranger prepares 2 at mod 0 and mod +3)');
  check(stage4Src.includes("['ranger', 18, null, 2],"),
    'Stage 4 suite pins GET /api/spells L1 (18 ranger spells listed, spellsPrepared 2)');
  check(stage4Src.includes('ranger sending a known spell at L1 refuses as a prepared caster'),
    'Stage 4 suite asserts the creator-validator refusal (ranger known_spells refuses)');
  check(stage4Src.includes("ranger listing Hunter's Mark among prepared spells refuses as already granted"),
    'Stage 4 suite asserts the Favored Enemy grant (Hunter\'s Mark refuses as already granted)');
}

group('(c2) PUT /:id enforces the ranger cap');
{
  // L1 ranger, Wis +3: cap 2. Two picks save; three refuse 400
  // naming preparedSpells, and the row is unchanged.
  const rng1 = await makeCharacter({ name: 'RngOne', cls: 'ranger', level: 1, scores: WIS3_SCORES });
  const ok2 = await req('PUT', `/api/character/${rng1}`, { prepared_spells: J(['Cure Wounds', 'Ensnaring Strike']) });
  check(ok2.status === 200, `PUT 2 spells on an L1 ranger (cap 2) persists 200 (got ${ok2.status}: ${JSON.stringify(ok2.json?.error || '')})`);
  check(JSON.stringify(await readPrepared(rng1)) === JSON.stringify(['Cure Wounds', 'Ensnaring Strike']),
    'at-cap L1 PUT stored the 2 picks');
  const over3 = await req('PUT', `/api/character/${rng1}`, { prepared_spells: J(['Cure Wounds', 'Ensnaring Strike', 'Animal Friendship']) });
  check(over3.status === 400,
    `PUT 3 spells on an L1 ranger (cap 2) refuses 400 (got ${over3.status})`);
  check(typeof over3.json?.error === 'string' && over3.json.error.includes('preparedSpells') && over3.json.error.includes('at most 2') && over3.json.error.includes('got 3'),
    `L1 PUT refusal names preparedSpells, cap 2, got 3 (got ${JSON.stringify(over3.json?.error)})`);
  check(JSON.stringify(await readPrepared(rng1)) === JSON.stringify(['Cure Wounds', 'Ensnaring Strike']),
    'refused L1 PUT left the stored prepared list unchanged');
  // Hunter's Mark never counts: 2 picks + Hunter's Mark saves.
  const withHM = await req('PUT', `/api/character/${rng1}`, { prepared_spells: J(['Cure Wounds', 'Ensnaring Strike', "Hunter's Mark"]) });
  check(withHM.status === 200, `PUT 2 picks + Hunter's Mark on an L1 ranger persists 200 (got ${withHM.status}: ${JSON.stringify(withHM.json?.error || '')})`);
  // Subclass spells never count: L5 Fey Wanderer, cap 6 — 6 picks +
  // Misty Step saves; 7 picks without it refuses.
  const rng5 = await makeCharacter({ name: 'RngFive', cls: 'ranger', level: 5, scores: WIS3_SCORES, classLevels: [{ class: 'ranger', level: 5, subclass: 'Fey Wanderer' }] });
  const feyOk = await req('PUT', `/api/character/${rng5}`, { prepared_spells: J(['Cure Wounds', 'Ensnaring Strike', 'Animal Friendship', 'Longstrider', 'Pass without Trace', 'Spike Growth', 'Misty Step']) });
  check(feyOk.status === 200, `PUT 6 picks + Misty Step on an L5 Fey Wanderer (cap 6) persists 200 (got ${feyOk.status}: ${JSON.stringify(feyOk.json?.error || '')})`);
  const feyOver = await req('PUT', `/api/character/${rng5}`, { prepared_spells: J(['Cure Wounds', 'Ensnaring Strike', 'Animal Friendship', 'Longstrider', 'Pass without Trace', 'Spike Growth', 'Darkvision']) });
  check(feyOver.status === 400, `PUT 7 picks on an L5 ranger (cap 6) refuses 400 (got ${feyOver.status})`);
  check(typeof feyOver.json?.error === 'string' && feyOver.json.error.includes('at most 6') && feyOver.json.error.includes('got 7'),
    `L5 PUT refusal counts 7 against cap 6 (got ${JSON.stringify(feyOver.json?.error)})`);
}

group('(c3) Level-up re-checks the ranger list');
{
  // Ranger L1 -> L2, Wis +3, with 6 spells stored: over the L2 cap
  // (3). Refuses 400, the level stays 1, the list is unchanged.
  const rng = await makeCharacter({ name: 'RngLevel', cls: 'ranger', level: 1, scores: WIS3_SCORES });
  await db.dbRun('UPDATE characters SET experience = ? WHERE id = ?', [getXPToNextLevel(1), rng]);
  await seedStoredPrepared(rng, ['Cure Wounds', 'Ensnaring Strike', 'Animal Friendship', 'Longstrider', 'Pass without Trace', 'Spike Growth']);
  const up = await req('POST', `/api/character/level-up/${rng}`, {});
  check(up.status === 400,
    `level-up L1->2 with 6 stored spells (L2 cap 3) refuses 400 (got ${up.status}: ${JSON.stringify(up.json?.error || '')})`);
  check(typeof up.json?.error === 'string' && up.json.error.includes('preparedSpells'),
    `level-up refusal names preparedSpells (got ${JSON.stringify(up.json?.error)})`);
  const row = await readCharacter(rng);
  check(row.level === 1, 'refused level-up left the level at 1');
  check(JSON.parse(row.prepared_spells).length === 6,
    'refused level-up left the over-cap stored prepared list unchanged');
  // An at-cap stored list levels up cleanly: 3 spells at L2 cap 3.
  const rngOk = await makeCharacter({ name: 'RngLevelOk', cls: 'ranger', level: 1, scores: WIS3_SCORES });
  await db.dbRun('UPDATE characters SET experience = ? WHERE id = ?', [getXPToNextLevel(1), rngOk]);
  await seedStoredPrepared(rngOk, ['Cure Wounds', 'Ensnaring Strike', 'Animal Friendship']);
  const upOk = await req('POST', `/api/character/level-up/${rngOk}`, {});
  check(upOk.status === 200,
    `level-up L1->2 with 3 stored spells (L2 cap 3) succeeds 200 (got ${upOk.status}: ${JSON.stringify(upOk.json?.error || '')})`);
  check((await readCharacter(rngOk)).level === 2, 'at-cap level-up raised the level to 2');
}

// ===========================================================================
// (c4) Favored Enemy: free-cast table + Hunter's Mark always prepared
// ===========================================================================
group('(c4) Favored Enemy: free casts + always-prepared grant');
{
  let feMismatches = 0;
  for (let level = 1; level <= 20; level++) {
    if (favoredEnemyFreeCasts(level) !== FAVORED_ENEMY_FREE_CASTS[level - 1]) feMismatches++;
  }
  check(feMismatches === 0, `favoredEnemyFreeCasts matches the PHB table at every level (${feMismatches} mismatches)`);
  check(favoredEnemyFreeCasts(1) === 2, 'spot: L1 free-casts 2 Hunter\'s Marks without a slot');
  check(favoredEnemyFreeCasts(5) === 3, 'spot: L5 free-casts 3');
  check(favoredEnemyFreeCasts(17) === 6, 'spot: L17 free-casts 6');
  check(JSON.stringify(rangerAlwaysPreparedSpells(null, 1)) === JSON.stringify(["Hunter's Mark"]),
    'rangerAlwaysPreparedSpells at L1 with no subclass is [Hunter\'s Mark]');
  check(JSON.stringify(rangerAlwaysPreparedSpells('Fey Wanderer', 9)) === JSON.stringify(["Hunter's Mark", 'Charm Person', 'Misty Step', 'Summon Fey']),
    'rangerAlwaysPreparedSpells Fey Wanderer L9 is Hunter\'s Mark + the subclass list (Summon Fey at 9th, not Dispel Magic)');
  check(JSON.stringify(rangerAlwaysPreparedSpells('Gloom Stalker', 3)) === JSON.stringify(["Hunter's Mark", 'Disguise Self']),
    'rangerAlwaysPreparedSpells Gloom Stalker L3 is Hunter\'s Mark + Disguise Self');
  check(JSON.stringify(rangerAlwaysPreparedSpells('Hunter', 9)) === JSON.stringify(["Hunter's Mark"]),
    'rangerAlwaysPreparedSpells Hunter L9 is Hunter\'s Mark only (no subclass spell list)');
  // The validator excludes Hunter's Mark even when the caller passes
  // no alwaysPreparedList at all (class-level grant, not caller data).
  const v = validatePreparedSpells(3, 1, ['Cure Wounds', 'Ensnaring Strike', "Hunter's Mark"], []);
  check(v.max === 2 && v.counted === 2 && v.ok === true,
    `validatePreparedSpells excludes Hunter's Mark with an empty alwaysPreparedList (got ${JSON.stringify(v)})`);
  const vOver = validatePreparedSpells(3, 1, ['Cure Wounds', 'Ensnaring Strike', 'Animal Friendship'], []);
  check(vOver.ok === false && vOver.over === 1,
    `validatePreparedSpells still catches a genuinely over-cap list (got ${JSON.stringify(vOver)})`);
}

// ===========================================================================
// (c5) swapSpell routes to prepared_spells for a prepared caster
// ===========================================================================
group('(c5) swapSpell routes to the prepared list (PHB: one prepared spell per Long Rest)');
{
  // Ranger L1 -> L2: swap Cure Wounds for Animal Friendship. The
  // prepared list changes; known_spells stays empty. (Pre-fix the
  // swap edited known_spells and the prepared list never changed.)
  const rng = await makeCharacter({ name: 'RngSwap', cls: 'ranger', level: 1, scores: WIS3_SCORES });
  await db.dbRun('UPDATE characters SET experience = ? WHERE id = ?', [getXPToNextLevel(1), rng]);
  await seedStoredPrepared(rng, ['Cure Wounds', 'Ensnaring Strike']);
  const up = await req('POST', `/api/character/level-up/${rng}`, { swapSpell: { old: 'Cure Wounds', new: 'Animal Friendship' } });
  check(up.status === 200,
    `ranger level-up with a swap succeeds 200 (got ${up.status}: ${JSON.stringify(up.json?.error || '')})`);
  check(JSON.stringify(await readPrepared(rng)) === JSON.stringify(['Ensnaring Strike', 'Animal Friendship']),
    'ranger swap replaced Cure Wounds with Animal Friendship in prepared_spells');
  check(JSON.stringify(await readKnown(rng)) === JSON.stringify([]),
    'ranger swap left known_spells empty (no longer the wrong column)');
  // Control: a known caster still swaps in known_spells (spellshot —
  // sorcerer AND warlock can no longer play this role: both PREPARE
  // in 2024 since their 2026-11-06 reconciliations, so their swaps
  // route to prepared_spells instead — asserted just below).
  const ss = await makeCharacter({ name: 'SsSwap', cls: 'spellshot', level: 1 });
  await db.dbRun('UPDATE characters SET experience = ? WHERE id = ?', [getXPToNextLevel(1), ss]);
  await seedStoredKnown(ss, ['Magic Missile', 'Burning Hands']);
  const upSs = await req('POST', `/api/character/level-up/${ss}`, { swapSpell: { old: 'Magic Missile', new: 'Witch Bolt' } });
  check(upSs.status === 200,
    `spellshot level-up with a swap succeeds 200 (got ${upSs.status}: ${JSON.stringify(upSs.json?.error || '')})`);
  check(JSON.stringify(await readKnown(ss)) === JSON.stringify(['Burning Hands', 'Witch Bolt']),
    'spellshot swap replaced Magic Missile with Witch Bolt in known_spells');
  check(JSON.stringify(await readPrepared(ss)) === JSON.stringify([]),
    'spellshot swap left prepared_spells empty');
  // Second prepared-caster control: sorcerer swaps in prepared_spells.
  const sorc = await makeCharacter({ name: 'SorcSwap', cls: 'sorcerer', level: 1 });
  await db.dbRun('UPDATE characters SET experience = ? WHERE id = ?', [getXPToNextLevel(1), sorc]);
  await seedStoredPrepared(sorc, ['Magic Missile', 'Shield']);
  const upSorc = await req('POST', `/api/character/level-up/${sorc}`, { swapSpell: { old: 'Magic Missile', new: 'Sleep' } });
  check(upSorc.status === 200,
    `sorcerer level-up with a swap succeeds 200 (got ${upSorc.status}: ${JSON.stringify(upSorc.json?.error || '')})`);
  check(JSON.stringify(await readPrepared(sorc)) === JSON.stringify(['Shield', 'Sleep']),
    'sorcerer swap replaced Magic Missile with Sleep in prepared_spells');
  check(JSON.stringify(await readKnown(sorc)) === JSON.stringify([]),
    'sorcerer swap left known_spells empty');
  // Third prepared-caster control: warlock swaps in prepared_spells
  // (warlocks PREPARE in 2024 since the 2026-11-06 reconciliation).
  const lk = await makeCharacter({ name: 'LkSwap', cls: 'warlock', level: 1 });
  await db.dbRun('UPDATE characters SET experience = ? WHERE id = ?', [getXPToNextLevel(1), lk]);
  await seedStoredPrepared(lk, ['Hex', 'Armor of Agathys']);
  const upLk = await req('POST', `/api/character/level-up/${lk}`, { swapSpell: { old: 'Hex', new: 'Witch Bolt' } });
  check(upLk.status === 200,
    `warlock level-up with a swap succeeds 200 (got ${upLk.status}: ${JSON.stringify(upLk.json?.error || '')})`);
  check(JSON.stringify(await readPrepared(lk)) === JSON.stringify(['Armor of Agathys', 'Witch Bolt']),
    'warlock swap replaced Hex with Witch Bolt in prepared_spells');
  check(JSON.stringify(await readKnown(lk)) === JSON.stringify([]),
    'warlock swap left known_spells empty');
}

// ===========================================================================
// (d) GET /api/spells serves the ranger model (real HTTP)
// ===========================================================================
group('(d) GET /api/spells serves ranger: 18 L1 spells, prepared 2');
{
  const r = await req('GET', '/api/spells?class=ranger&level=1&abilityMod=3');
  check(r.status === 200, `/api/spells ranger L1 returns 200 (got ${r.status})`);
  check(r.json?.spells?.length === 18, `/api/spells ranger L1 lists 18 spells (got ${r.json?.spells?.length})`);
  check(r.json?.spellsKnown === null, `/api/spells ranger spellsKnown is null (got ${r.json?.spellsKnown})`);
  check(r.json?.spellsPrepared === 2, `/api/spells ranger spellsPrepared at mod +3 is 2 (got ${r.json?.spellsPrepared})`);
  check(Array.isArray(r.json?.spells) && r.json.spells.every((s) => Number(s.level) === 1),
    '/api/spells ranger L1 list is all 1st-level spells');
  const names = (r.json?.spells || []).map((s) => s.name);
  check(names.includes("Hunter's Mark"), "L1 list includes Hunter's Mark");
  check(names.includes('Dispel Magic') === false, 'L1 list does not include Dispel Magic (3rd level)');
  const r8 = await req('GET', '/api/spells?class=ranger&level=8&abilityMod=3');
  check(r8.json?.spells?.some((s) => s.name === 'Conjure Animals'), 'L8 list includes a 3rd-level spell (Conjure Animals)');
  const r16 = await req('GET', '/api/spells?class=ranger&level=16&abilityMod=3');
  check(r16.json?.spells?.some((s) => s.name === 'Swift Quiver'), 'L16 list includes a 5th-level spell (Swift Quiver)');
  check(r16.json?.spellsPrepared === 14, `/api/spells ranger L16 spellsPrepared is 14 (got ${r16.json?.spellsPrepared})`);
  // The three catalog tag gaps are closed (checked at the first
  // level whose slots reach each spell's level).
  const r8d = await req('GET', '/api/spells?class=ranger&level=8&abilityMod=3');
  check(r8d.json?.spells?.some((s) => s.name === 'Dispel Magic'), 'L8 list includes Dispel Magic (Ranger tag added)');
  const r13 = await req('GET', '/api/spells?class=ranger&level=13&abilityMod=3');
  check(r13.json?.spells?.some((s) => s.name === 'Dominate Beast'), 'L13 list includes Dominate Beast (Ranger tag added)');
  const r17 = await req('GET', '/api/spells?class=ranger&level=17&abilityMod=3');
  check(r17.json?.spells?.some((s) => s.name === 'Greater Restoration'), 'L17 list includes Greater Restoration (Ranger tag added)');
}

// ===========================================================================
// (e) Generated dataset agrees with the live functions
// ===========================================================================
group('(e) spellCatalog.generated.json agrees with the live model');
{
  const generated = JSON.parse(readRepo('client/src/data/spellCatalog.generated.json'));
  const rng = generated.level1ByClass?.ranger;
  check(rng?.spellsKnown === null, `generated ranger spellsKnown is null (got ${rng?.spellsKnown})`);
  check(rng?.spellsPrepared?.kind === 'table' && Object.values(rng?.spellsPrepared?.byMod || {}).every((v) => v === 2),
    `generated ranger spellsPrepared is kind table, 2 at every mod (got ${JSON.stringify(rng?.spellsPrepared)})`);
  check(JSON.stringify(rng?.spellSlots) === JSON.stringify({ 1: 2 }),
    `generated ranger spellSlots are {1: 2} (got ${JSON.stringify(rng?.spellSlots)})`);
  check(rng?.spellcastingAbility === 'wis', `generated ranger ability is wis (got ${rng?.spellcastingAbility})`);
  const byKey = Object.fromEntries((generated.spells || []).map((s) => [s.key, s]));
  for (const key of ['dispel magic', 'dominate beast', 'greater restoration']) {
    check((byKey[key]?.classes || []).includes('Ranger'),
      `generated catalog tags ${key} as Ranger`);
  }
  check((byKey["hunter's mark"]?.classes || []).includes('Ranger'),
    "generated catalog tags hunter's mark as Ranger");
}

server.close();
console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
process.exit(failed > 0 ? 1 : 0);
