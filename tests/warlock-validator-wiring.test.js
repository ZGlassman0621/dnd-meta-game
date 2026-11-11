// tests/warlock-validator-wiring.test.js — warlock prepared-spell cap
// validator wiring (2026-11-07).
//
// 2024 PHB rule (Warlock Features table, "Prepared Spells" column,
// PHB-photo-verified 2026-11-06): warlocks PREPARE in 2024 — the cap
// is the fixed table [2, 3, 4, 5, 6, 7, 8, 9, 10, 10, 11, 11, 12, 12,
// 13, 13, 14, 14, 15, 15], 2 at L1 -> 15 at L20, mod-independent.
// The table + the getSpellsPrepared arm landed in the Warlock
// reconciliation (2026-11-07, 8th of 12), but the PUT /:id sheet-save
// and POST /level-up stored-list validators did NOT exist —
// levelProgression.js says so outright ("No PUT/level-up validator
// in this job (follow-up, same honest gap as bard/Profane Soul)").
// This job wires them on the artificer/blackguard/paladin/sorcerer/
// ranger pattern: a new server/services/warlockService.js
// (preparedSpellsMax + validatePreparedSpells + warlockAlwaysPreparedSpells)
// plus the two route blocks in server/routes/character.js.
//
// Three warlock-specific rules, all pinned here:
//  (1) Patron spells are ADDED TO THE WARLOCK SPELL LIST, not always
//      prepared — a patron spell the player prepares COUNTS. No
//      patron-spell exclusion exists on the warlock path.
//  (2) Contact Patron (L9): Contact Other Plane is always prepared
//      and never counts (level-gated to warlock level 9+).
//  (3) Mystic Arcanum (L11 6th, L13 7th, L15 8th, L17 9th): Arcanum
//      spells are separate from the prepared count and must NOT be
//      counted. There is NO Arcanum storage anywhere in the build —
//      no column, no field, no picker — so an Arcanum pick recorded
//      anywhere can only ride in prepared_spells, and the validator
//      excludes it BY CATALOG SPELL LEVEL (one per unlocked tier),
//      never by name-guessing. Fail-closed: a 6th+ spell before its
//      tier unlocks counts; a second spell of the same tier counts.
//
// Honest integration tests: the cap comes from the real
// levelProgression.js table and the real warlockService.js, and every
// PUT/level-up case drives the real character router over HTTP on a
// real throwaway DB (the paladin-l1-cap / ranger-prepared-cap
// harness). If levelProgression.js, warlockService.js, or
// character.js were deleted, the imports fail and the suite fails
// with them.
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

const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'warlock-validator-wiring-test-'));
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
const { preparedSpellsMax, validatePreparedSpells, warlockAlwaysPreparedSpells, spellSlotsForLevel, CONTACT_OTHER_PLANE } = await import(fromRepo('server/services/warlockService.js'));

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

// Cha +3 (score 16) at every level used below, so the cap moves only
// with level — the table is mod-independent, and the mod sweep in
// group (b) proves it.
const CHA3_SCORES = { str: 10, dex: 10, con: 14, int: 10, wis: 10, cha: 16 };

// The 2024 PHB Prepared Spells column for warlock (Warlock Features
// table, PHB-photo-verified 2026-11-06).
const WARLOCK_PREPARED = [2, 3, 4, 5, 6, 7, 8, 9, 10, 10, 11, 11, 12, 12, 13, 13, 14, 14, 15, 15];
// Warlock Pact Magic slots (special progression): 1 slot L1, 2 slots
// L2-10, 3 slots L11-16, 4 slots L17-20; max spell level 5 throughout.
const WARLOCK_SLOTS = (level) => ({
  slots: level === 1 ? 1 : level <= 10 ? 2 : level <= 16 ? 3 : 4, level: level === 1 ? 1 : level <= 2 ? 1 : level <= 4 ? 2 : level <= 6 ? 3 : level <= 8 ? 4 : 5,
});

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

// Warlock spell picks by level (all on the Warlock list in the live
// catalog). Patron spells are in here on purpose: Fireball (Fiend),
// Misty Step (Archfey) — they COUNT when prepared (group (c5)).
const L1 = ['Hex', 'Arms of Hadar', 'Charm Person', 'Bane', 'Cause Fear', 'Comprehend Languages', 'Detect Magic', 'Expeditious Retreat', 'Hellish Rebuke', 'Illusory Script', 'Protection from Evil and Good', 'Armor of Agathys'];
const L2 = ['Darkness', 'Hold Person', 'Invisibility', 'Mirror Image', 'Misty Step', 'Ray of Enfeeblement', 'Shadow Blade', 'Crown of Madness'];
const L3 = ['Counterspell', 'Dispel Magic', 'Fear', 'Fly', 'Gaseous Form', 'Hunger of Hadar', 'Hypnotic Pattern', 'Magic Circle'];
const L4 = ['Banishment', 'Blight', 'Dimension Door', 'Greater Invisibility', 'Shadow of Moil', "Raulothim's Psychic Lance"];
const L5 = ['Hold Monster', 'Scrying', 'Dream', 'Mislead', 'Planar Binding'];
const ARC6 = ['Circle of Death', 'Eyebite', 'Globe of Invulnerability'];
const ARC7 = ['Finger of Death', 'Plane Shift'];
const ARC8 = ['Demiplane', 'Dominate Monster'];
const ARC9 = ['Foresight', 'True Polymorph', 'Power Word Kill'];
// 14 distinct 1st-5th warlock picks (no Contact Other Plane): the
// L17 at-cap list for group (c4).
const FOURTEEN = [...L1.slice(0, 6), ...L2.slice(0, 4), ...L3.slice(0, 2), ...L4.slice(0, 2)];

// ===========================================================================
// (a) Sheet branch, pinned statically: getMaxPrepared HAS a warlock branch
// ===========================================================================
group('(a) CharacterSheet getMaxPrepared warlock branch (static pin — sheet job landed 2026-11-07)');
{
  const sheetSrc = readRepo('client/src/components/CharacterSheet.jsx');
  const fnStart = sheetSrc.indexOf('const getMaxPrepared');
  check(fnStart !== -1, 'CharacterSheet.jsx defines getMaxPrepared');
  const fnEnd = sheetSrc.indexOf('const isPreparedCaster', fnStart);
  const fnSrc = fnEnd !== -1 ? sheetSrc.slice(fnStart, fnEnd) : sheetSrc.slice(fnStart, fnStart + 2000);
  // FLIPPED 2026-11-07 (was a gap pin: no warlock branch, 'Limited
  // known'): the sheet job landed the warlock branch, so a warlock now
  // returns the fixed 2024 Prepared Spells column (2 at L1 -> 15 at
  // L20) instead of falling through to `return 0`, and classes.json
  // labels warlock 'All prepared', so isPreparedCaster is true and
  // the Prepared Spells section renders. Recorded here so the branch
  // cannot silently drift; the server validator below remains the
  // enforcement point.
  check(fnSrc.indexOf("className === 'warlock'") !== -1
    && fnSrc.indexOf('return WARLOCK_PREPARED[character.level - 1]') !== -1,
    'getMaxPrepared HAS a warlock branch returning WARLOCK_PREPARED[character.level - 1] (the table value at the character level)');
  const classesJson = JSON.parse(readRepo('client/src/data/classes.json'));
  check(classesJson.warlock?.spellcasting?.spellsKnown === 'All prepared',
    "classes.json warlock spellsKnown is 'All prepared' (the Prepared section renders for warlocks)");
  check(JSON.stringify(classesJson.warlock?.spellcasting?.spellsKnownByLevel) === JSON.stringify(WARLOCK_PREPARED),
    'classes.json warlock spellsKnownByLevel already IS the 2024 prepared table (right numbers, right label now)');
}

// ===========================================================================
// (b) Server table: prepared column, known=null, pact slots, service agreement
// ===========================================================================
group('(b) getSpellsPrepared warlock is the PHB table at every level and mod');
{
  let mismatches = 0;
  for (const mod of [-1, 0, 3, 5]) {
    for (let level = 1; level <= 20; level++) {
      if (getSpellsPrepared('warlock', level, mod) !== WARLOCK_PREPARED[level - 1]) {
        mismatches++;
        console.error(`  ✗ warlock L${level} mod ${mod}: got ${getSpellsPrepared('warlock', level, mod)}, expected ${WARLOCK_PREPARED[level - 1]}`);
      }
    }
  }
  check(mismatches === 0, `getSpellsPrepared('warlock', L1-20, mod) = PHB column at mods [-1, 0, 3, 5] (${mismatches} mismatches)`);
  check(getSpellsPrepared('warlock', 1, 3) === 2, 'spot: warlock L1 at Cha +3 prepares 2');
  check(getSpellsPrepared('warlock', 5, 3) === 6, 'spot: warlock L5 prepares 6');
  check(getSpellsPrepared('warlock', 20, 3) === 15, 'spot: warlock L20 prepares 15');
  let knownNonNull = 0;
  for (let level = 1; level <= 20; level++) {
    if (getSpellsKnown('warlock', level) !== null) knownNonNull++;
  }
  check(knownNonNull === 0, `getSpellsKnown('warlock', L1-20) is null at every level (${knownNonNull} non-null — the 2014 known row is gone)`);
  let slotMismatches = 0;
  for (let level = 1; level <= 20; level++) {
    if (JSON.stringify(getSpellSlots('warlock', level)) !== JSON.stringify(WARLOCK_SLOTS(level))) {
      slotMismatches++;
      console.error(`  ✗ warlock slots L${level}: got ${JSON.stringify(getSpellSlots('warlock', level))}, expected ${JSON.stringify(WARLOCK_SLOTS(level))}`);
    }
  }
  check(slotMismatches === 0, `getSpellSlots('warlock', L1-20) = pact slots 1/2/3/4, max level 5 (${slotMismatches} mismatches)`);
  check(JSON.stringify(spellSlotsForLevel(1)) === JSON.stringify({ slots: 1, level: 1 }), 'warlockService L1 slots are {slots: 1, level: 1}');
  check(JSON.stringify(spellSlotsForLevel(11)) === JSON.stringify({ slots: 3, level: 5 }), 'warlockService L11 slots are {slots: 3, level: 5}');
  let serviceMismatches = 0;
  for (let level = 1; level <= 20; level++) {
    if (preparedSpellsMax(3, level) !== WARLOCK_PREPARED[level - 1]) serviceMismatches++;
    if (preparedSpellsMax(-2, level) !== WARLOCK_PREPARED[level - 1]) serviceMismatches++;
  }
  check(serviceMismatches === 0, `warlockService.preparedSpellsMax agrees with the table at every level (mods +3 and -2, ${serviceMismatches} mismatches)`);
  // Contact Patron: the always-prepared list is empty before L9 and
  // exactly [Contact Other Plane] from L9 on.
  check(JSON.stringify(warlockAlwaysPreparedSpells(8)) === JSON.stringify([]),
    'warlockAlwaysPreparedSpells at L8 is [] (Contact Patron not yet gained)');
  check(JSON.stringify(warlockAlwaysPreparedSpells(9)) === JSON.stringify(['Contact Other Plane']),
    "warlockAlwaysPreparedSpells at L9 is ['Contact Other Plane']");
  check(JSON.stringify(warlockAlwaysPreparedSpells(20)) === JSON.stringify(['Contact Other Plane']),
    "warlockAlwaysPreparedSpells at L20 is still ['Contact Other Plane']");
  check(CONTACT_OTHER_PLANE === 'Contact Other Plane', 'CONTACT_OTHER_PLANE export is the PHB spell name');
  // The validator excludes Contact Other Plane even when the caller
  // passes no alwaysPreparedList at all (class-level grant, not
  // caller data) — and only at L9+.
  const vContact = validatePreparedSpells(3, 9, [...L1.slice(0, 8), 'Contact Other Plane'], []);
  check(vContact.max === 10 && vContact.counted === 8 && vContact.ok === true,
    `validatePreparedSpells excludes Contact Other Plane at L9 with an empty alwaysPreparedList (got ${JSON.stringify(vContact)})`);
  const vContactEarly = validatePreparedSpells(3, 8, [...L1.slice(0, 8), 'Contact Other Plane'], []);
  check(vContactEarly.counted === 9 && vContactEarly.ok === true,
    `validatePreparedSpells COUNTS Contact Other Plane at L8 (pre-Contact Patron, got ${JSON.stringify(vContactEarly)})`);
  // The validator excludes one Arcanum spell per unlocked tier, by
  // catalog level — and a 6th-level spell before L11 counts.
  const vArc = validatePreparedSpells(3, 11, [...L1.slice(0, 10), 'Circle of Death'], []);
  check(vArc.max === 11 && vArc.counted === 10 && vArc.ok === true,
    `validatePreparedSpells excludes Circle of Death (6th) at L11 (got ${JSON.stringify(vArc)})`);
  const vArcEarly = validatePreparedSpells(3, 10, [...L1.slice(0, 10), 'Circle of Death'], []);
  check(vArcEarly.counted === 11 && vArcEarly.ok === false,
    `validatePreparedSpells COUNTS Circle of Death at L10 (tier not unlocked, got ${JSON.stringify(vArcEarly)})`);
  const vArcTwo = validatePreparedSpells(3, 11, [...L1.slice(0, 10), 'Circle of Death', 'Eyebite'], []);
  check(vArcTwo.counted === 11 && vArcTwo.ok === true,
    `validatePreparedSpells counts the SECOND 6th-level spell at L11 (got ${JSON.stringify(vArcTwo)})`);
}

// ===========================================================================
// (c2) PUT /:id enforces the warlock cap
// ===========================================================================
group('(c2) PUT /:id enforces the warlock cap');
{
  // L1 warlock, Cha +3: cap 2. Two picks save; three refuse 400
  // naming preparedSpells, and the row is unchanged.
  const wlk1 = await makeCharacter({ name: 'WlkOne', cls: 'warlock', level: 1, scores: CHA3_SCORES });
  const ok2 = await req('PUT', `/api/character/${wlk1}`, { prepared_spells: J(['Hex', 'Arms of Hadar']) });
  check(ok2.status === 200, `PUT 2 spells on an L1 warlock (cap 2) persists 200 (got ${ok2.status}: ${JSON.stringify(ok2.json?.error || '')})`);
  check(JSON.stringify(await readPrepared(wlk1)) === JSON.stringify(['Hex', 'Arms of Hadar']),
    'at-cap L1 PUT stored the 2 picks');
  const over3 = await req('PUT', `/api/character/${wlk1}`, { prepared_spells: J(['Hex', 'Arms of Hadar', 'Charm Person']) });
  check(over3.status === 400,
    `PUT 3 spells on an L1 warlock (cap 2) refuses 400 (got ${over3.status})`);
  check(typeof over3.json?.error === 'string' && over3.json.error.includes('preparedSpells') && over3.json.error.includes('at most 2') && over3.json.error.includes('got 3'),
    `L1 PUT refusal names preparedSpells, cap 2, got 3 (got ${JSON.stringify(over3.json?.error)})`);
  check(JSON.stringify(await readPrepared(wlk1)) === JSON.stringify(['Hex', 'Arms of Hadar']),
    'refused L1 PUT left the stored prepared list unchanged');
  // Cap growth: L2 warlock, cap 3 — 3 picks save, 4 refuse.
  const wlk2 = await makeCharacter({ name: 'WlkTwo', cls: 'warlock', level: 2, scores: CHA3_SCORES });
  const ok3 = await req('PUT', `/api/character/${wlk2}`, { prepared_spells: J(['Hex', 'Arms of Hadar', 'Charm Person']) });
  check(ok3.status === 200, `PUT 3 spells on an L2 warlock (cap 3) persists 200 (got ${ok3.status}: ${JSON.stringify(ok3.json?.error || '')})`);
  const over4 = await req('PUT', `/api/character/${wlk2}`, { prepared_spells: J(['Hex', 'Arms of Hadar', 'Charm Person', 'Bane']) });
  check(over4.status === 400,
    `PUT 4 spells on an L2 warlock (cap 3) refuses 400 (got ${over4.status})`);
  check(typeof over4.json?.error === 'string' && over4.json.error.includes('at most 3') && over4.json.error.includes('got 4'),
    `L2 PUT refusal names cap 3, got 4 (got ${JSON.stringify(over4.json?.error)})`);
}

// ===========================================================================
// (c3) PUT: Contact Other Plane never counts (L9+); it counts before L9
// ===========================================================================
group('(c3) PUT Contact Other Plane exclusion (Contact Patron, L9+)');
{
  // L9 warlock, cap 10: 9 picks + Contact Other Plane saves (counted
  // 9); 11 picks + it refuses (counted 11).
  const wlk9 = await makeCharacter({ name: 'WlkNine', cls: 'warlock', level: 9, scores: CHA3_SCORES });
  const ninePlus = [...L1.slice(0, 5), ...L2.slice(0, 3), 'Counterspell', 'Contact Other Plane'];
  const withContact = await req('PUT', `/api/character/${wlk9}`, { prepared_spells: J(ninePlus) });
  check(withContact.status === 200, `PUT 9 picks + Contact Other Plane on an L9 warlock persists 200 (got ${withContact.status}: ${JSON.stringify(withContact.json?.error || '')})`);
  check(JSON.stringify(await readPrepared(wlk9)) === JSON.stringify(ninePlus),
    'L9 PUT stored the full 10-spell list incl. Contact Other Plane');
  const elevenPlus = [...L1.slice(0, 6), ...L2.slice(0, 4), 'Counterspell', 'Contact Other Plane'];
  const overContact = await req('PUT', `/api/character/${wlk9}`, { prepared_spells: J(elevenPlus) });
  check(overContact.status === 400,
    `PUT 11 picks + Contact Other Plane on an L9 warlock (cap 10) refuses 400 (got ${overContact.status})`);
  check(typeof overContact.json?.error === 'string' && overContact.json.error.includes('at most 10') && overContact.json.error.includes('got 11'),
    `L9 PUT refusal counts 11 against cap 10 (got ${JSON.stringify(overContact.json?.error)})`);
  check(JSON.stringify(await readPrepared(wlk9)) === JSON.stringify(ninePlus),
    'refused L9 PUT left the stored prepared list unchanged');
  // Before L9 the same spell counts: L8 warlock, cap 9 — 9 picks +
  // Contact Other Plane is 10 counted and refuses.
  const wlk8 = await makeCharacter({ name: 'WlkEight', cls: 'warlock', level: 8, scores: CHA3_SCORES });
  const eightPlus = [...L1.slice(0, 4), ...L2.slice(0, 3), 'Counterspell', 'Contact Other Plane'];
  const ok8 = await req('PUT', `/api/character/${wlk8}`, { prepared_spells: J(eightPlus) });
  check(ok8.status === 200, `PUT 8 picks + Contact Other Plane on an L8 warlock (counted 9 = cap 9) persists 200 (got ${ok8.status}: ${JSON.stringify(ok8.json?.error || '')})`);
  const nineAt8 = [...L1.slice(0, 5), ...L2.slice(0, 3), 'Counterspell', 'Contact Other Plane'];
  const over8 = await req('PUT', `/api/character/${wlk8}`, { prepared_spells: J(nineAt8) });
  check(over8.status === 400,
    `PUT 9 picks + Contact Other Plane on an L8 warlock refuses 400 (got ${over8.status})`);
  check(typeof over8.json?.error === 'string' && over8.json.error.includes('at most 9') && over8.json.error.includes('got 10'),
    `L8 PUT refusal counts Contact Other Plane (got 10, got ${JSON.stringify(over8.json?.error)})`);
}

// ===========================================================================
// (c4) PUT: Mystic Arcanum spells never count (one per unlocked tier)
// ===========================================================================
group('(c4) PUT Mystic Arcanum exclusion (by catalog spell level)');
{
  // L11 warlock, cap 11: 10 picks + Circle of Death (6th) saves
  // (counted 10); a second 6th-level spell counts (11 = cap, saves);
  // 11 picks + two 6th-level spells refuses (counted 12).
  const wlk11 = await makeCharacter({ name: 'WlkEleven', cls: 'warlock', level: 11, scores: CHA3_SCORES });
  const tenPlusArc = [...L1.slice(0, 5), ...L2.slice(0, 3), 'Counterspell', 'Banishment', 'Circle of Death'];
  const withArc = await req('PUT', `/api/character/${wlk11}`, { prepared_spells: J(tenPlusArc) });
  check(withArc.status === 200, `PUT 10 picks + Circle of Death on an L11 warlock persists 200 (got ${withArc.status}: ${JSON.stringify(withArc.json?.error || '')})`);
  const tenPlusTwoArc = [...L1.slice(0, 5), ...L2.slice(0, 3), 'Counterspell', 'Banishment', 'Circle of Death', 'Eyebite'];
  const withTwoArc = await req('PUT', `/api/character/${wlk11}`, { prepared_spells: J(tenPlusTwoArc) });
  check(withTwoArc.status === 200, `PUT 10 picks + two 6th-level spells on an L11 warlock (counted 11 = cap 11) persists 200 (got ${withTwoArc.status}: ${JSON.stringify(withTwoArc.json?.error || '')})`);
  const elevenPlusTwoArc = [...L1.slice(0, 5), ...L2.slice(0, 3), 'Counterspell', 'Banishment', 'Blight', 'Circle of Death', 'Eyebite'];
  const overArc = await req('PUT', `/api/character/${wlk11}`, { prepared_spells: J(elevenPlusTwoArc) });
  check(overArc.status === 400,
    `PUT 11 picks + two 6th-level spells on an L11 warlock refuses 400 (got ${overArc.status})`);
  check(typeof overArc.json?.error === 'string' && overArc.json.error.includes('at most 11') && overArc.json.error.includes('got 12'),
    `L11 PUT refusal counts 12 against cap 11 (got ${JSON.stringify(overArc.json?.error)})`);
  // Before the tier unlocks the 6th-level spell counts: L10 warlock,
  // cap 10 — 10 picks + Circle of Death is 11 counted and refuses.
  const wlk10 = await makeCharacter({ name: 'WlkTen', cls: 'warlock', level: 10, scores: CHA3_SCORES });
  const tenAt10 = [...L1.slice(0, 5), ...L2.slice(0, 3), 'Counterspell', 'Banishment', 'Circle of Death'];
  const over10 = await req('PUT', `/api/character/${wlk10}`, { prepared_spells: J(tenAt10) });
  check(over10.status === 400,
    `PUT 10 picks + Circle of Death on an L10 warlock refuses 400 (got ${over10.status})`);
  check(typeof over10.json?.error === 'string' && over10.json.error.includes('at most 10') && over10.json.error.includes('got 11'),
    `L10 PUT refusal counts the 6th-level spell (tier not unlocked, got ${JSON.stringify(over10.json?.error)})`);
  // All four tiers at once: L17 warlock, cap 14 — 14 picks + Contact
  // Other Plane + one 6th + one 7th + one 8th + one 9th saves
  // (counted 14); one more ordinary pick refuses (counted 15).
  const wlk17 = await makeCharacter({ name: 'WlkSeventeen', cls: 'warlock', level: 17, scores: CHA3_SCORES });
  const seventeenList = [...FOURTEEN, 'Contact Other Plane', 'Circle of Death', 'Finger of Death', 'Demiplane', 'Foresight'];
  const withAllArc = await req('PUT', `/api/character/${wlk17}`, { prepared_spells: J(seventeenList) });
  check(withAllArc.status === 200, `PUT 14 picks + Contact + all four Arcanum tiers on an L17 warlock persists 200 (got ${withAllArc.status}: ${JSON.stringify(withAllArc.json?.error || '')})`);
  const seventeenOver = [...FOURTEEN, 'Hold Monster', 'Contact Other Plane', 'Circle of Death', 'Finger of Death', 'Demiplane', 'Foresight'];
  const over17 = await req('PUT', `/api/character/${wlk17}`, { prepared_spells: J(seventeenOver) });
  check(over17.status === 400,
    `PUT 15 picks + Contact + all four Arcanum tiers on an L17 warlock refuses 400 (got ${over17.status})`);
  check(typeof over17.json?.error === 'string' && over17.json.error.includes('at most 14') && over17.json.error.includes('got 15'),
    `L17 PUT refusal counts 15 against cap 14 (got ${JSON.stringify(over17.json?.error)})`);
}

// ===========================================================================
// (c5) PUT: patron spells COUNT when prepared (added-to-list, not always)
// ===========================================================================
group('(c5) PUT patron spells count against the cap');
{
  // Fiend L3 warlock, cap 4: Fireball is a Fiend patron spell. 3
  // picks incl. Fireball save; 4 picks incl. Fireball save (at cap);
  // 5 picks incl. Fireball refuse (counted 5 — no exclusion).
  const wlk3 = await makeCharacter({ name: 'WlkThree', cls: 'warlock', level: 3, scores: CHA3_SCORES, classLevels: [{ class: 'warlock', level: 3, subclass: 'Fiend Patron' }] });
  const fireball3 = ['Hex', 'Arms of Hadar', 'Fireball'];
  const okFb3 = await req('PUT', `/api/character/${wlk3}`, { prepared_spells: J(fireball3) });
  check(okFb3.status === 200, `PUT 3 picks incl. Fireball on a Fiend L3 warlock persists 200 (got ${okFb3.status}: ${JSON.stringify(okFb3.json?.error || '')})`);
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
  // Same for an Archfey patron spell: Misty Step counts too.
  const wlk3b = await makeCharacter({ name: 'WlkThreeB', cls: 'warlock', level: 3, scores: CHA3_SCORES, classLevels: [{ class: 'warlock', level: 3, subclass: 'Archfey Patron' }] });
  const misty5 = ['Hex', 'Arms of Hadar', 'Charm Person', 'Bane', 'Misty Step'];
  const overMisty = await req('PUT', `/api/character/${wlk3b}`, { prepared_spells: J(misty5) });
  check(overMisty.status === 400,
    `PUT 5 picks incl. Misty Step on an Archfey L3 warlock refuses 400 (got ${overMisty.status})`);
  check(typeof overMisty.json?.error === 'string' && overMisty.json.error.includes('got 5'),
    `Archfey PUT refusal counts Misty Step (got ${JSON.stringify(overMisty.json?.error)})`);
}

// ===========================================================================
// (c6) PUT skips: non-warlock, warlock-as-secondary, no-list, creator marker
// ===========================================================================
group('(c6) PUT skips: the validator only governs primary warlocks');
{
  // (i) A fighter-primary character's prepared list is not governed
  // by the warlock cap — 6 spells persist 200.
  const fig = await makeCharacter({ name: 'FigNoWlk', cls: 'fighter', level: 1, scores: CHA3_SCORES });
  const fig6 = [...L1.slice(0, 6)];
  const put6 = await req('PUT', `/api/character/${fig}`, { prepared_spells: J(fig6) });
  check(put6.status === 200,
    `PUT 6 spells on a fighter-primary character persists 200 (got ${put6.status}: ${JSON.stringify(put6.json?.error || '')})`);
  check(JSON.stringify(await readPrepared(fig)) === JSON.stringify(fig6),
    'fighter-primary 6-spell PUT stored the list');
  // (ii) Same, with warlock as the SECONDARY class: the shared
  // prepared_spells column is governed by the primary class's editor.
  await db.dbRun('UPDATE characters SET class_levels = ? WHERE id = ?', [J([{ class: 'fighter', level: 1, subclass: null }, { class: 'warlock', level: 1, subclass: null }]), fig]);
  const put6b = await req('PUT', `/api/character/${fig}`, { prepared_spells: J(fig6) });
  check(put6b.status === 200,
    `PUT 6 spells on a fighter-primary / warlock-secondary character persists 200 (got ${put6b.status}: ${JSON.stringify(put6b.json?.error || '')})`);
  check(JSON.stringify(await readPrepared(fig)) === JSON.stringify(fig6),
    'fighter-primary / warlock-secondary 6-spell PUT stored the list');
  // (iii) No prepared_spells in the body: a plain field update is
  // unaffected.
  const wlk5 = await makeCharacter({ name: 'WlkNoList', cls: 'warlock', level: 5, scores: CHA3_SCORES });
  await seedStoredPrepared(wlk5, [...L1.slice(0, 6)]);
  const plain = await req('PUT', `/api/character/${wlk5}`, { name: 'WlkNoList Renamed' });
  check(plain.status === 200, `PUT with no prepared_spells is unaffected, 200 (got ${plain.status})`);
  check((await readCharacter(wlk5)).name === 'WlkNoList Renamed', 'plain PUT still persisted the name change');
  check(JSON.stringify(await readPrepared(wlk5)) === JSON.stringify([...L1.slice(0, 6)]), 'plain PUT left the stored prepared list alone');
  // (iv) Creator-marker PUT goes through the Stage 4 validator, not
  // the new block: the empty list passes, and an over-cap marker list
  // refuses with Stage 4's wording, not the new block's
  // 'may prepare at most'.
  const markerWlk = await makeCharacter({ name: 'WlkMarker', cls: 'warlock', level: 1, scores: CHA3_SCORES });
  const markerPut = await req('PUT', `/api/character/${markerWlk}`, {
    creator: 'creator-next', prepared_spells: J([]),
  });
  check(markerPut.status === 200,
    `creator-marker PUT with an empty list passes 200 (got ${markerPut.status}: ${JSON.stringify(markerPut.json?.error || '')})`);
  check(JSON.stringify(await readPrepared(markerWlk)) === JSON.stringify([]), 'marker PUT persisted the empty list');
  const markerOver = await req('PUT', `/api/character/${markerWlk}`, {
    creator: 'creator-next', prepared_spells: J(['Hex', 'Arms of Hadar', 'Charm Person']),
  });
  check(markerOver.status === 400,
    `creator-marker PUT with 3 spells refuses 400 via Stage 4 (got ${markerOver.status})`);
  check(typeof markerOver.json?.error === 'string' && markerOver.json.error.includes('preparedSpells'),
    `marker refusal names preparedSpells (got ${JSON.stringify(markerOver.json?.error)})`);
  check(typeof markerOver.json?.error === 'string' && !markerOver.json.error.includes('may prepare at most'),
    `marker refusal is Stage 4's wording, not the new block's (got ${JSON.stringify(markerOver.json?.error)})`);
  check(JSON.stringify(await readPrepared(markerWlk)) === JSON.stringify([]),
    'refused marker PUT left the stored prepared list unchanged');
}

// ===========================================================================
// (d) Level-up path — stored-list re-check on leveling up IN warlock
// ===========================================================================
group('(d) level-up re-check: over-cap stored list blocks, level unchanged');
{
  // Warlock L1 -> L2, Cha +3, with 6 spells stored: over the L2 cap
  // (3). Refuses 400, the level stays 1, the list is unchanged.
  const wlk = await makeCharacter({ name: 'WlkLevel', cls: 'warlock', level: 1, scores: CHA3_SCORES });
  await db.dbRun('UPDATE characters SET experience = ? WHERE id = ?', [getXPToNextLevel(1), wlk]);
  await seedStoredPrepared(wlk, [...L1.slice(0, 6)]);
  const up = await req('POST', `/api/character/level-up/${wlk}`, {});
  check(up.status === 400,
    `level-up L1->2 with 6 stored spells (L2 cap 3) refuses 400 (got ${up.status}: ${JSON.stringify(up.json?.error || '')})`);
  check(typeof up.json?.error === 'string' && up.json.error.includes('preparedSpells'),
    `level-up refusal names preparedSpells (got ${JSON.stringify(up.json?.error)})`);
  check(typeof up.json?.error === 'string' && up.json.error.includes('fix the prepared list on the character sheet'),
    `level-up refusal carries the fix-on-the-sheet message (got ${JSON.stringify(up.json?.error)})`);
  const row = await readCharacter(wlk);
  check(row.level === 1, 'refused level-up left the level at 1');
  check(JSON.parse(row.prepared_spells).length === 6,
    'refused level-up left the over-cap stored prepared list unchanged');
  // An at-cap stored list levels up cleanly: 3 spells at L2 cap 3.
  const wlkOk = await makeCharacter({ name: 'WlkLevelOk', cls: 'warlock', level: 1, scores: CHA3_SCORES });
  await db.dbRun('UPDATE characters SET experience = ? WHERE id = ?', [getXPToNextLevel(1), wlkOk]);
  await seedStoredPrepared(wlkOk, ['Hex', 'Arms of Hadar', 'Charm Person']);
  const upOk = await req('POST', `/api/character/level-up/${wlkOk}`, {});
  check(upOk.status === 200,
    `level-up L1->2 with 3 stored spells (L2 cap 3) succeeds 200 (got ${upOk.status}: ${JSON.stringify(upOk.json?.error || '')})`);
  check((await readCharacter(wlkOk)).level === 2, 'at-cap level-up raised the level to 2');
  // Contact Other Plane does not block the L8 -> L9 level-up: 9
  // picks + Contact Other Plane count 9 against the L9 cap of 10.
  const wlk89 = await makeCharacter({ name: 'WlkLevel89', cls: 'warlock', level: 8, scores: CHA3_SCORES });
  await db.dbRun('UPDATE characters SET experience = ? WHERE id = ?', [getXPToNextLevel(8), wlk89]);
  await seedStoredPrepared(wlk89, [...L1.slice(0, 5), ...L2.slice(0, 3), 'Counterspell', 'Contact Other Plane']);
  const up89 = await req('POST', `/api/character/level-up/${wlk89}`, {});
  check(up89.status === 200,
    `level-up L8->9 with 9 picks + Contact Other Plane (counted 9 = L9 cap 10) succeeds 200 (got ${up89.status}: ${JSON.stringify(up89.json?.error || '')})`);
  check((await readCharacter(wlk89)).level === 9, 'Contact-excluded level-up raised the level to 9');
  // Control: 11 picks + Contact Other Plane block the same level-up
  // (counted 11 > L9 cap 10).
  const wlk89b = await makeCharacter({ name: 'WlkLevel89b', cls: 'warlock', level: 8, scores: CHA3_SCORES });
  await db.dbRun('UPDATE characters SET experience = ? WHERE id = ?', [getXPToNextLevel(8), wlk89b]);
  await seedStoredPrepared(wlk89b, [...L1.slice(0, 6), ...L2.slice(0, 4), 'Counterspell', 'Contact Other Plane']);
  const up89b = await req('POST', `/api/character/level-up/${wlk89b}`, {});
  check(up89b.status === 400,
    `level-up L8->9 with 11 picks + Contact Other Plane refuses 400 (got ${up89b.status})`);
  check((await readCharacter(wlk89b)).level === 8, 'refused Contact-control level-up left the level at 8');
  // Mystic Arcanum does not block the L10 -> L11 level-up: 10 picks
  // + Circle of Death count 10 against the L11 cap of 11.
  const wlk1011 = await makeCharacter({ name: 'WlkLevel1011', cls: 'warlock', level: 10, scores: CHA3_SCORES });
  await db.dbRun('UPDATE characters SET experience = ? WHERE id = ?', [getXPToNextLevel(10), wlk1011]);
  await seedStoredPrepared(wlk1011, [...L1.slice(0, 5), ...L2.slice(0, 3), 'Counterspell', 'Banishment', 'Circle of Death']);
  const up1011 = await req('POST', `/api/character/level-up/${wlk1011}`, {});
  check(up1011.status === 200,
    `level-up L10->11 with 10 picks + Circle of Death (counted 10 = L11 cap 11) succeeds 200 (got ${up1011.status}: ${JSON.stringify(up1011.json?.error || '')})`);
  check((await readCharacter(wlk1011)).level === 11, 'Arcanum-excluded level-up raised the level to 11');
  // Control: 12 picks + Circle of Death block it (counted 12 > 11).
  const wlk1011b = await makeCharacter({ name: 'WlkLevel1011b', cls: 'warlock', level: 10, scores: CHA3_SCORES });
  await db.dbRun('UPDATE characters SET experience = ? WHERE id = ?', [getXPToNextLevel(10), wlk1011b]);
  await seedStoredPrepared(wlk1011b, [...L1.slice(0, 6), ...L2.slice(0, 3), 'Counterspell', 'Banishment', 'Blight', 'Circle of Death']);
  const up1011b = await req('POST', `/api/character/level-up/${wlk1011b}`, {});
  check(up1011b.status === 400,
    `level-up L10->11 with 11 picks + Circle of Death refuses 400 (got ${up1011b.status})`);
  check((await readCharacter(wlk1011b)).level === 10, 'refused Arcanum-control level-up left the level at 10');
}

// ===========================================================================
// (e) Multiclassing into warlock is never blocked
// ===========================================================================
group('(e) multiclassing into warlock is never blocked');
{
  // Level-up INTO warlock with an over-cap stored list: the warlock
  // re-check is skipped for multiclassing (the stored list belongs
  // to the other class), so the level-up succeeds. Cha 16 meets the
  // warlock multiclass requirement (Cha 13).
  const fig2 = await makeCharacter({ name: 'FigMultiWlk', cls: 'fighter', level: 1, scores: CHA3_SCORES });
  await db.dbRun('UPDATE characters SET experience = ? WHERE id = ?', [getXPToNextLevel(1), fig2]);
  await seedStoredPrepared(fig2, [...L1.slice(0, 6)]);
  const up = await req('POST', `/api/character/level-up/${fig2}`, { selectedClass: 'warlock' });
  check(up.status === 200,
    `level-up fighter L1 -> warlock L1 with 6 stored spells succeeds 200 (got ${up.status}: ${JSON.stringify(up.json?.error || '')})`);
  const row = await readCharacter(fig2);
  check(row.level === 2, 'multiclass level-up raised the total level to 2');
  const levels = JSON.parse(row.class_levels || '[]');
  check(levels.some((e) => String(e?.class ?? '').toLowerCase() === 'warlock' && Number(e?.level) === 1),
    'multiclass level-up added warlock at level 1');
  check(JSON.stringify(await readPrepared(fig2)) === JSON.stringify([...L1.slice(0, 6)]),
    'multiclass level-up left the 6-spell stored list unchanged');
}

// ===========================================================================
// (f) GET /api/spells serves the warlock model (real HTTP)
// ===========================================================================
group('(f) GET /api/spells serves warlock: 16 L1 spells, prepared 2');
{
  const r = await req('GET', '/api/spells?class=warlock&level=1&abilityMod=3');
  check(r.status === 200, `/api/spells warlock L1 returns 200 (got ${r.status})`);
  check(r.json?.spells?.length === 16, `/api/spells warlock L1 lists 16 spells (got ${r.json?.spells?.length})`);
  check(r.json?.spellsKnown === null, `/api/spells warlock spellsKnown is null (got ${r.json?.spellsKnown})`);
  check(r.json?.spellsPrepared === 2, `/api/spells warlock spellsPrepared at mod +3 is 2 (got ${r.json?.spellsPrepared})`);
  check(Array.isArray(r.json?.spells) && r.json.spells.every((s) => Number(s.level) === 1),
    '/api/spells warlock L1 list is all 1st-level spells');
  const r5 = await req('GET', '/api/spells?class=warlock&level=5&abilityMod=3');
  check(r5.json?.spellsPrepared === 6, `/api/spells warlock L5 spellsPrepared is 6 (got ${r5.json?.spellsPrepared})`);
  check(r5.json?.spells?.some((s) => String(s.name).toLowerCase() === 'hunger of hadar'), 'L5 list includes a 3rd-level warlock spell (Hunger of Hadar)');
}

server.close();
console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
process.exit(failed > 0 ? 1 : 0);
