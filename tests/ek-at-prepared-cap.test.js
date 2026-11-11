// tests/ek-at-prepared-cap.test.js — Eldritch Knight / Arcane Trickster
// prepared-spell cap (2026-11-07, 2024 PHB).
//
// What changed: EK/AT PREPARE in 2024 — one shared fixed Prepared
// Spells column, 3 at 3rd -> 13 at 20th (identical values to
// WARDEN_SPELLS_KNOWN, but a separate named constant: EK/AT prepare,
// the Warden Calls know). The single-class slot gap is closed too:
// getSpellSlots now returns THIRD_CASTER_SPELL_SLOTS for EK/AT (the
// deliberate-exclusion comment is gone). Cantrips are per-subclass:
// EK 2 at 3rd, 3rd at 10th; AT Mage Hand + 2 at 3rd (= 3 total),
// 4th at 10th. thirdCasterService.preparedSpellsMax /
// validatePreparedSpells enforce the cap (no always-prepared levelled
// spells exist for either subclass — the exclusion list is []), the
// PUT + level-up validators refuse over-cap lists, canLearnSpell
// gates GET /api/spells (EK: Wizard list, Abjuration/Evocation for
// levelled spells; AT: Wizard list, no school restriction), and the
// sheet renders the spells tab for EK/AT via subclass-aware gating.
//
// Honest integration tests: getSpellsPrepared / getSpellsKnown /
// getSpellSlots / getCantripsKnown / spellcastingAbilityFor are
// imported from the real levelProgression.js, preparedSpellsMax from
// the real thirdCasterService.js, canLearnSpell from the real
// spellSelectionService.js, and every PUT/level-up/GET-spells case
// drives the real routers over HTTP on a real throwaway DB (the
// sorcerer-prepared-cap harness). If levelProgression.js,
// thirdCasterService.js, spellSelectionService.js, or character.js
// were deleted, the imports fail and the suite fails with them. The
// PHB table below is the external truth both arms are checked
// against, so a drift in either trips this suite.
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

const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ek-at-prepared-cap-test-'));
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
// from literals invented in the test (the PHB table below is the
// book truth both arms are checked against).
const {
  getSpellsPrepared, getSpellsKnown, getSpellSlots, getCantripsKnown,
  spellcastingAbilityFor, getXPToNextLevel,
  ELDRITCH_KNIGHT_ARCANE_TRICKSTER_SPELLS_PREPARED,
  THIRD_CASTER_SPELL_SLOTS,
} = await import(fromRepo('server/config/levelProgression.js'));
const {
  preparedSpellsMax, validatePreparedSpells, cantripsKnownForSubclass,
} = await import(fromRepo('server/services/thirdCasterService.js'));
const { canLearnSpell } = await import(fromRepo('server/services/spellSelectionService.js'));
const {
  eldritchKnightSpellsAtLevel, arcaneTricksterSpellsAtLevel,
} = await import(fromRepo('server/services/subclassService.js'));

// 2024 PHB Eldritch Knight / Arcane Trickster Spellcasting tables,
// Prepared Spells column, L1->20. No formula — fixed table,
// mod-independent. Casting begins at 3rd.
const PHB_PREPARED = [0, 0, 3, 4, 4, 4, 5, 6, 6, 7, 8, 8, 9, 10, 10, 11, 11, 11, 12, 13];
// 2024 PHB third-caster slot table (already exact in the codebase).
const PHB_SLOTS = {
  1: {}, 2: {},
  3: { 1: 2 }, 4: { 1: 3 }, 5: { 1: 3 }, 6: { 1: 3 },
  7: { 1: 4, 2: 2 }, 8: { 1: 4, 2: 2 }, 9: { 1: 4, 2: 2 },
  10: { 1: 4, 2: 3 }, 11: { 1: 4, 2: 3 }, 12: { 1: 4, 2: 3 },
  13: { 1: 4, 2: 3, 3: 2 }, 14: { 1: 4, 2: 3, 3: 2 }, 15: { 1: 4, 2: 3, 3: 2 },
  16: { 1: 4, 2: 3, 3: 3 }, 17: { 1: 4, 2: 3, 3: 3 }, 18: { 1: 4, 2: 3, 3: 3 },
  19: { 1: 4, 2: 3, 3: 3, 4: 1 }, 20: { 1: 4, 2: 3, 3: 3, 4: 1 },
};
const EK_CANTRIPS = [0, 0, 2, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3];
const AT_CANTRIPS = [0, 0, 3, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4];

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

// Int +3 (score 16) at every level used below. The cap must NOT move
// with it — that is the point of the fixed table.
const INT3_SCORES = { str: 10, dex: 10, con: 14, int: 16, wis: 10, cha: 10 };

// Distinct Wizard spell names; the PUT/level-up paths validate the
// prepared count, not the names themselves.
const EK_3 = ['Shield', 'Magic Missile', 'Burning Hands'];
const EK_4 = ['Shield', 'Magic Missile', 'Burning Hands', 'Absorb Elements'];
const EK_6 = [...EK_4, 'Thunderwave', 'Mage Armor'];
const EK_7 = [...EK_6, 'Scorching Ray'];

async function makeCharacter({ name, cls, level, scores = null, subclass = null }) {
  const created = await req('POST', '/api/character', { name, class: cls, race: 'human' });
  assert(created.status === 201, `fixture POST creates ${name} (${cls}) — got ${created.status}`);
  const id = created.json.id;
  const put = await req('PUT', `/api/character/${id}`, {
    level,
    experience: getXPToNextLevel(level - 1) || 0,
    max_hp: 20,
    current_hp: 20,
    ...(scores ? { ability_scores: J(scores) } : {}),
    class_levels: J([{ class: cls, level, subclass }]),
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

// ===========================================================================
// (a) The fixed PHB table: getSpellsPrepared for EK/AT at every level
//     3-20 and every mod — no formula, no mod dependence; null below 3rd
// ===========================================================================
group('(a) getSpellsPrepared EK/AT is the PHB fixed table at every level and mod');
{
  for (const [cls, sub] of [['fighter', 'Eldritch Knight'], ['rogue', 'Arcane Trickster']]) {
    for (const mod of [-1, 0, 3, 5]) {
      let mismatches = 0;
      for (let level = 3; level <= 20; level++) {
        if (getSpellsPrepared(cls, level, mod, sub) !== PHB_PREPARED[level - 1]) {
          mismatches++;
          console.error(`  ✗ ${sub} mod ${mod} level ${level}: getSpellsPrepared=${getSpellsPrepared(cls, level, mod, sub)}, expected ${PHB_PREPARED[level - 1]}`);
        }
      }
      check(mismatches === 0, `getSpellsPrepared('${cls}', L3-20, mod ${mod}, '${sub}') = PHB table (${mismatches} mismatches)`);
    }
    check(getSpellsPrepared(cls, 1, 0, sub) === null, `${sub} L1 prepares null (no casting before 3rd)`);
    check(getSpellsPrepared(cls, 2, 0, sub) === null, `${sub} L2 prepares null (no casting before 3rd)`);
    check(getSpellsPrepared(cls, 3, 3, sub) === 3, `spot: ${sub} L3 is 3 even at mod +3 (no Int mod in the rule)`);
    check(getSpellsPrepared(cls, 20, -1, sub) === 13, `spot: ${sub} L20 is 13 even at mod -1`);
  }
  // No casting subclass, no casting — a Champion fighter / Thief rogue
  // prepares nothing at any level.
  let nonCasterNonNull = 0;
  for (let level = 1; level <= 20; level++) {
    if (getSpellsPrepared('fighter', level, 0, 'Champion') !== null) nonCasterNonNull++;
    if (getSpellsPrepared('rogue', level, 0, 'Thief') !== null) nonCasterNonNull++;
    if (getSpellsPrepared('fighter', level, 0, null) !== null) nonCasterNonNull++;
    if (getSpellsPrepared('rogue', level, 0, null) !== null) nonCasterNonNull++;
  }
  check(nonCasterNonNull === 0, `getSpellsPrepared is null for non-casting fighter/rogue at all 20 levels (${nonCasterNonNull} non-null)`);
  // The named constant itself is the PHB table.
  check(JSON.stringify(ELDRITCH_KNIGHT_ARCANE_TRICKSTER_SPELLS_PREPARED) === JSON.stringify(PHB_PREPARED),
    'ELDRITCH_KNIGHT_ARCANE_TRICKSTER_SPELLS_PREPARED equals the PHB table');
}

// ===========================================================================
// (b) Slots: getSpellSlots EK/AT is the third-caster table at every level
// ===========================================================================
group('(b) getSpellSlots EK/AT is the third-caster table at every level');
{
  check(JSON.stringify(THIRD_CASTER_SPELL_SLOTS) === JSON.stringify(PHB_SLOTS),
    'THIRD_CASTER_SPELL_SLOTS equals the PHB third-caster slot table');
  for (const [cls, sub] of [['fighter', 'Eldritch Knight'], ['rogue', 'Arcane Trickster']]) {
    let mismatches = 0;
    for (let level = 1; level <= 20; level++) {
      if (JSON.stringify(getSpellSlots(cls, level, sub)) !== JSON.stringify(PHB_SLOTS[level])) mismatches++;
    }
    check(mismatches === 0, `getSpellSlots('${cls}', L1-20, '${sub}') = third-caster table (${mismatches} mismatches)`);
    check(JSON.stringify(getSpellSlots(cls, 1, sub)) === JSON.stringify({}), `${sub} L1 slots are {} (casting begins at 3rd)`);
    check(JSON.stringify(getSpellSlots(cls, 2, sub)) === JSON.stringify({}), `${sub} L2 slots are {} (casting begins at 3rd)`);
    check(JSON.stringify(getSpellSlots(cls, 20, sub)) === JSON.stringify({ 1: 4, 2: 3, 3: 3, 4: 1 }), `spot: ${sub} L20 slots are 4/3/3/1`);
  }
  let nonCasterSlots = 0;
  for (let level = 1; level <= 20; level++) {
    if (JSON.stringify(getSpellSlots('fighter', level, 'Champion')) !== JSON.stringify({})) nonCasterSlots++;
    if (JSON.stringify(getSpellSlots('rogue', level, 'Thief')) !== JSON.stringify({})) nonCasterSlots++;
    if (JSON.stringify(getSpellSlots('fighter', level, null)) !== JSON.stringify({})) nonCasterSlots++;
    if (JSON.stringify(getSpellSlots('rogue', level, null)) !== JSON.stringify({})) nonCasterSlots++;
  }
  check(nonCasterSlots === 0, `getSpellSlots is {} for non-casting fighter/rogue at all 20 levels (${nonCasterSlots} non-empty)`);
}

// ===========================================================================
// (c) Cantrips: EK 2->3 at L10, AT 3->4 at L10 (Mage Hand counts)
// ===========================================================================
group('(c) cantrip counts: EK 2 at L3 / 3 at L10, AT 3 at L3 / 4 at L10');
{
  for (let level = 1; level <= 20; level++) {
    check(getCantripsKnown('fighter', level, 'Eldritch Knight') === EK_CANTRIPS[level - 1],
      `EK cantrips at L${level} is ${EK_CANTRIPS[level - 1]}`);
    check(getCantripsKnown('rogue', level, 'Arcane Trickster') === AT_CANTRIPS[level - 1],
      `AT cantrips at L${level} is ${AT_CANTRIPS[level - 1]}`);
  }
  check(getCantripsKnown('fighter', 3, 'Eldritch Knight') === 2, 'spot: EK L3 knows 2 cantrips');
  check(getCantripsKnown('rogue', 3, 'Arcane Trickster') === 3, 'spot: AT L3 knows 3 cantrips (Mage Hand + 2)');
  check(getCantripsKnown('fighter', 9, 'Eldritch Knight') === 2, 'spot: EK L9 still 2 (third cantrip at 10th, not 9th)');
  check(getCantripsKnown('rogue', 9, 'Arcane Trickster') === 3, 'spot: AT L9 still 3 (fourth cantrip at 10th)');
  check(getCantripsKnown('fighter', 10, 'Eldritch Knight') === 3, 'spot: EK L10 knows 3 cantrips');
  check(getCantripsKnown('rogue', 10, 'Arcane Trickster') === 4, 'spot: AT L10 knows 4 cantrips');
  check(getCantripsKnown('fighter', 3, 'Champion') === 0, 'Champion fighter L3 knows 0 cantrips');
  check(getCantripsKnown('rogue', 3, 'Thief') === 0, 'Thief rogue L3 knows 0 cantrips');
  // The service helpers agree with the getter at every level.
  let serviceMismatches = 0;
  for (let level = 1; level <= 20; level++) {
    if (cantripsKnownForSubclass('Eldritch Knight', level) !== EK_CANTRIPS[level - 1]) serviceMismatches++;
    if (cantripsKnownForSubclass('Arcane Trickster', level) !== AT_CANTRIPS[level - 1]) serviceMismatches++;
  }
  check(serviceMismatches === 0, `thirdCasterService.cantripsKnownForSubclass agrees with getCantripsKnown at all 20 levels (${serviceMismatches} mismatches)`);
  check(cantripsKnownForSubclass('Champion', 3) === 0, 'service: non-casting subclass knows 0 cantrips');
}

// ===========================================================================
// (d) EK/AT prepare, they do not know; ability is Intelligence
// ===========================================================================
group('(d) getSpellsKnown is null for EK/AT; spellcastingAbilityFor is Int');
{
  let nonNull = 0;
  for (let level = 1; level <= 20; level++) {
    if (getSpellsKnown('fighter', level, 'Eldritch Knight') !== null) nonNull++;
    if (getSpellsKnown('rogue', level, 'Arcane Trickster') !== null) nonNull++;
  }
  check(nonNull === 0, `getSpellsKnown is null for EK/AT at all 20 levels (${nonNull} non-null)`);
  check(spellcastingAbilityFor('fighter', 'Eldritch Knight') === 'int', "spellcastingAbilityFor('fighter', 'Eldritch Knight') is 'int'");
  check(spellcastingAbilityFor('rogue', 'Arcane Trickster') === 'int', "spellcastingAbilityFor('rogue', 'Arcane Trickster') is 'int'");
  check(spellcastingAbilityFor('fighter', 'Champion') === null, "spellcastingAbilityFor('fighter', 'Champion') is null");
  check(spellcastingAbilityFor('rogue', 'Thief') === null, "spellcastingAbilityFor('rogue', 'Thief') is null");
  check(spellcastingAbilityFor('fighter', null) === null, "spellcastingAbilityFor('fighter', null) is null");
  check(spellcastingAbilityFor('rogue', null) === null, "spellcastingAbilityFor('rogue', null) is null");
}

// ===========================================================================
// (e) thirdCasterService agrees with the getter; no always-prepared spells
// ===========================================================================
group('(e) thirdCasterService caps agree with getSpellsPrepared; exclusion list is []');
{
  let maxMismatches = 0;
  for (let level = 1; level <= 20; level++) {
    if (preparedSpellsMax(level) !== (level < 3 ? 0 : PHB_PREPARED[level - 1])) maxMismatches++;
    if (preparedSpellsMax(level) !== (getSpellsPrepared('fighter', level, 0, 'Eldritch Knight') ?? 0)) maxMismatches++;
  }
  check(maxMismatches === 0, `thirdCasterService.preparedSpellsMax agrees with getSpellsPrepared at all 20 levels (${maxMismatches} mismatches)`);
  check(preparedSpellsMax(2) === 0, 'preparedSpellsMax(2) is 0 (fail-closed below 3rd)');
  check(preparedSpellsMax(0) === 0, 'preparedSpellsMax(0) is 0 (fail-closed out of range)');
  check(preparedSpellsMax(21) === 0, 'preparedSpellsMax(21) is 0 (fail-closed out of range)');
  const over = validatePreparedSpells(3, EK_4, []);
  check(over.max === 3 && over.counted === 4 && over.ok === false && over.over === 1,
    `validatePreparedSpells(3, 4 spells, []) is { max 3, counted 4, ok false, over 1 } (got ${JSON.stringify(over)})`);
  const atCap = validatePreparedSpells(3, EK_3, []);
  check(atCap.max === 3 && atCap.counted === 3 && atCap.ok === true && atCap.over === 0,
    `validatePreparedSpells(3, 3 spells, []) is ok at cap (got ${JSON.stringify(atCap)})`);
  // Neither subclass has always-prepared levelled spells.
  check(JSON.stringify(eldritchKnightSpellsAtLevel('fighter', 'Eldritch Knight', 20)) === JSON.stringify([]),
    'eldritchKnightSpellsAtLevel returns [] at L20 (no always-prepared levelled spells)');
  check(JSON.stringify(arcaneTricksterSpellsAtLevel('rogue', 'Arcane Trickster', 20)) === JSON.stringify([]),
    'arcaneTricksterSpellsAtLevel returns [] at L20 (no always-prepared levelled spells)');
  check(JSON.stringify(eldritchKnightSpellsAtLevel('fighter', 'Eldritch Knight', 3)) === JSON.stringify([]),
    'eldritchKnightSpellsAtLevel returns [] at L3');
}

// ===========================================================================
// (f) Server/sheet agreement: the sheet tables equal the server table
// ===========================================================================
group('(f) server/sheet agreement: sheet tables = server table = PHB table');
{
  const sheetSrc = readRepo('client/src/components/CharacterSheet.jsx');
  const m = sheetSrc.match(/const THIRD_CASTER_PREPARED_SPELLS = \[([^\]]+)\]/);
  check(m !== null, 'CharacterSheet.jsx defines THIRD_CASTER_PREPARED_SPELLS');
  const sheetTable = m[1].split(',').map((s) => Number(s.trim()));
  check(sheetTable.length === 20 && sheetTable.every((v, i) => v === PHB_PREPARED[i]),
    'sheet THIRD_CASTER_PREPARED_SPELLS equals the PHB table (20 entries, element-wise)');
  const ekM = sheetSrc.match(/const ELDRITCH_KNIGHT_CANTRIPS = \[([^\]]+)\]/);
  const atM = sheetSrc.match(/const ARCANE_TRICKSTER_CANTRIPS = \[([^\]]+)\]/);
  check(ekM !== null && atM !== null, 'CharacterSheet.jsx defines ELDRITCH_KNIGHT_CANTRIPS and ARCANE_TRICKSTER_CANTRIPS');
  const ekSheet = ekM[1].split(',').map((s) => Number(s.trim()));
  const atSheet = atM[1].split(',').map((s) => Number(s.trim()));
  check(ekSheet.every((v, i) => v === EK_CANTRIPS[i]), 'sheet ELDRITCH_KNIGHT_CANTRIPS equals the EK cantrip table');
  check(atSheet.every((v, i) => v === AT_CANTRIPS[i]), 'sheet ARCANE_TRICKSTER_CANTRIPS equals the AT cantrip table');
  check(sheetSrc.includes('isThirdCaster'), 'sheet defines isThirdCaster (subclass-aware gating)');
  check(sheetSrc.includes('effectiveSpellcasting'), 'sheet defines effectiveSpellcasting (subclass spellcasting record)');
  check(sheetSrc.includes("if (isThirdCaster) return THIRD_CASTER_PREPARED_SPELLS[character.level - 1]"),
    'getMaxPrepared has a third-caster branch reading THIRD_CASTER_PREPARED_SPELLS');
  check(sheetSrc.includes('if (isThirdCaster) return true') || sheetSrc.includes("isPreparedCaster") && sheetSrc.includes('isThirdCaster'),
    'isPreparedCaster returns true for EK/AT');
  // classes.json: War Bond (2024 name), EK/AT subclass spellcasting present.
  const classesSrc = readRepo('client/src/data/classes.json');
  check(!classesSrc.includes('Weapon Bond'), 'classes.json no longer says "Weapon Bond"');
  check(classesSrc.includes('War Bond'), 'classes.json EK feature is "War Bond" (2024 name)');
  const classes = JSON.parse(classesSrc);
  const ekEntry = classes.fighter.subclasses.find((sc) => sc.name === 'Eldritch Knight');
  const atEntry = classes.rogue.subclasses.find((sc) => sc.name === 'Arcane Trickster');
  check(ekEntry?.spellcasting?.ability === 'int', 'classes.json EK subclass spellcasting ability is int');
  check(atEntry?.spellcasting?.ability === 'int', 'classes.json AT subclass spellcasting ability is int');
  check(classes.fighter.spellcasting === null || classes.fighter.spellcasting === undefined,
    'classes.json fighter base class stays a non-caster (spellcasting null)');
  check(classes.rogue.spellcasting === null || classes.rogue.spellcasting === undefined,
    'classes.json rogue base class stays a non-caster (spellcasting null)');
  // cantrips.json: base fighter/rogue stay empty — the picker maps
  // EK/AT to the Wizard list in the sheet instead of mislabeling
  // the base classes as casters.
  const cantrips = JSON.parse(readRepo('client/src/data/spells/cantrips.json'));
  check(Array.isArray(cantrips.fighter) && cantrips.fighter.length === 0, 'cantrips.json fighter stays [] (base class does not cast)');
  check(Array.isArray(cantrips.rogue) && cantrips.rogue.length === 0, 'cantrips.json rogue stays [] (base class does not cast)');
  check(Array.isArray(cantrips.wizard) && cantrips.wizard.length > 0, 'cantrips.json wizard list is non-empty (the EK/AT picker source)');
  check(sheetSrc.includes('spellsData.cantrips.wizard'), 'sheet cantrip picker reads the Wizard list for EK/AT');
}

// ===========================================================================
// (g) GET /api/spells serves EK/AT (and stays empty for non-casters)
// ===========================================================================
group('(g) GET /api/spells serves EK/AT');
{
  const ek = await req('GET', '/api/spells?class=fighter&level=3&subclass=Eldritch%20Knight');
  check(ek.status === 200, `GET /api/spells EK L3 returns 200 (got ${ek.status})`);
  check(ek.json?.spellsPrepared === 3, `EK L3 spellsPrepared is 3 (got ${ek.json?.spellsPrepared})`);
  check(ek.json?.cantripsKnown === 2, `EK L3 cantripsKnown is 2 (got ${ek.json?.cantripsKnown})`);
  check(ek.json?.spellsKnown === null, `EK L3 spellsKnown is null (got ${ek.json?.spellsKnown})`);
  check(ek.json?.spellcastingAbility === 'int', `EK L3 spellcastingAbility is int (got ${ek.json?.spellcastingAbility})`);
  check(Array.isArray(ek.json?.spells) && ek.json.spells.length > 0, `EK L3 spell list is non-empty (got ${ek.json?.spells?.length})`);
  const ekNames = (ek.json.spells || []).map((s) => s.name);
  check(ekNames.includes('Shield'), 'EK L3 list includes Shield (Abjuration 1st)');
  check(!ekNames.includes('Charm Person'), 'EK L3 list excludes Charm Person (Enchantment — school restriction)');
  check(!ekNames.includes('Fireball'), 'EK L3 list excludes Fireball (3rd level — above the L3 max of 1st)');
  check((ek.json.spells || []).every((s) => s.level <= 1), 'every EK L3 spell is 1st level or below');
  check((ek.json.spells || []).every((s) => s.school === 'Abjuration' || s.school === 'Evocation'),
    'every EK L3 spell is Abjuration or Evocation');

  const at = await req('GET', '/api/spells?class=rogue&level=3&subclass=Arcane%20Trickster');
  check(at.status === 200, `GET /api/spells AT L3 returns 200 (got ${at.status})`);
  check(at.json?.spellsPrepared === 3, `AT L3 spellsPrepared is 3 (got ${at.json?.spellsPrepared})`);
  check(at.json?.cantripsKnown === 3, `AT L3 cantripsKnown is 3 (got ${at.json?.cantripsKnown})`);
  check(at.json?.spellsKnown === null, `AT L3 spellsKnown is null (got ${at.json?.spellsKnown})`);
  check(at.json?.spellcastingAbility === 'int', `AT L3 spellcastingAbility is int (got ${at.json?.spellcastingAbility})`);
  const atNames = (at.json.spells || []).map((s) => s.name);
  check(atNames.includes('Charm Person'), 'AT L3 list includes Charm Person (no school restriction)');
  check(atNames.includes('Shield'), 'AT L3 list includes Shield');
  check(!atNames.includes('Fireball'), 'AT L3 list excludes Fireball (3rd level — above the L3 max of 1st)');
  check((at.json.spells || []).every((s) => s.level <= 1), 'every AT L3 spell is 1st level or below');

  const champ = await req('GET', '/api/spells?class=fighter&level=3&subclass=Champion');
  check(champ.status === 200, `GET /api/spells Champion L3 returns 200 (got ${champ.status})`);
  check(champ.json?.spellsPrepared === null, `Champion L3 spellsPrepared is null (got ${champ.json?.spellsPrepared})`);
  check(champ.json?.cantripsKnown === 0, `Champion L3 cantripsKnown is 0 (got ${champ.json?.cantripsKnown})`);
  check(champ.json?.spellcastingAbility === null, `Champion L3 spellcastingAbility is null (got ${champ.json?.spellcastingAbility})`);
  check(Array.isArray(champ.json?.spells) && champ.json.spells.length === 0, `Champion L3 spell list is empty (got ${champ.json?.spells?.length})`);
}

// ===========================================================================
// (h) canLearnSpell: EK school restriction vs AT no restriction;
//     EK any-school exception picks fail closed (pinned behavior)
// ===========================================================================
group('(h) canLearnSpell EK school restriction vs AT no restriction');
{
  // EK passes: Abjuration/Evocation Wizard spells at/below the max level.
  check(canLearnSpell({ classId: 'fighter', level: 3, spellName: 'Shield', subclass: 'Eldritch Knight' }).ok === true,
    "EK L3 can learn Shield (Abjuration 1st)");
  check(canLearnSpell({ classId: 'fighter', level: 3, spellName: 'Burning Hands', subclass: 'Eldritch Knight' }).ok === true,
    "EK L3 can learn Burning Hands (Evocation 1st)");
  check(canLearnSpell({ classId: 'fighter', level: 3, spellName: 'Fire Bolt', subclass: 'Eldritch Knight' }).ok === true,
    "EK L3 can learn Fire Bolt (Wizard cantrip)");
  check(canLearnSpell({ classId: 'fighter', level: 8, spellName: 'Misty Step', subclass: 'Eldritch Knight' }).ok === false,
    "EK L8 cannot learn Misty Step (Conjuration 2nd — school restriction)");
  // EK refused: other-school levelled spell, and above-max-level spell.
  const charmEk = canLearnSpell({ classId: 'fighter', level: 3, spellName: 'Charm Person', subclass: 'Eldritch Knight' });
  check(charmEk.ok === false && /Abjuration or Evocation/.test(charmEk.reason || ''),
    `EK L3 cannot learn Charm Person (Enchantment) — reason names the school rule (got ${JSON.stringify(charmEk.reason)})`);
  const fireballEk = canLearnSpell({ classId: 'fighter', level: 3, spellName: 'Fireball', subclass: 'Eldritch Knight' });
  check(fireballEk.ok === false && /above the Eldritch Knight max of 1/.test(fireballEk.reason || ''),
    `EK L3 cannot learn Fireball (3rd level, max 1st) (got ${JSON.stringify(fireballEk.reason)})`);
  const fireballEk8 = canLearnSpell({ classId: 'fighter', level: 8, spellName: 'Fireball', subclass: 'Eldritch Knight' });
  check(fireballEk8.ok === false && /above the Eldritch Knight max of 2/.test(fireballEk8.reason || ''),
    `EK L8 cannot learn Fireball (3rd level, max 2nd) (got ${JSON.stringify(fireballEk8.reason)})`);
  // EK any-school exception picks (fighter levels 8/14/20): the
  // service has no learning history, so it enforces the school
  // restriction strictly and names the exception in the refusal.
  // PINNED: a legitimate 8th-level any-school pick is REFUSED by
  // this automated check — it must be granted through a path that
  // knows the learning history (or by the DM), never by guessing.
  for (const level of [8, 14, 20]) {
    const r = canLearnSpell({ classId: 'fighter', level, spellName: 'Charm Person', subclass: 'Eldritch Knight' });
    check(r.ok === false && /8, 14, 20/.test(r.reason || '') && /learning history/.test(r.reason || ''),
      `EK L${level} any-school pick Charm Person is REFUSED with the exception named (got ${JSON.stringify(r.reason)})`);
  }
  // EK before 3rd, and non-EK fighter, never cast.
  check(canLearnSpell({ classId: 'fighter', level: 2, spellName: 'Shield', subclass: 'Eldritch Knight' }).ok === false,
    'EK L2 cannot learn Shield (spellcasting begins at 3rd)');
  const champShield = canLearnSpell({ classId: 'fighter', level: 3, spellName: 'Shield', subclass: 'Champion' });
  check(champShield.ok === false && /no spell slots/.test(champShield.reason || ''),
    `Champion fighter cannot learn Shield (got ${JSON.stringify(champShield.reason)})`);
  check(canLearnSpell({ classId: 'fighter', level: 3, spellName: 'Shield', subclass: null }).ok === false,
    'fighter with no subclass cannot learn Shield');
  // AT passes: ANY Wizard spell at/below the max level.
  check(canLearnSpell({ classId: 'rogue', level: 3, spellName: 'Charm Person', subclass: 'Arcane Trickster' }).ok === true,
    "AT L3 can learn Charm Person (Enchantment — no school restriction)");
  check(canLearnSpell({ classId: 'rogue', level: 3, spellName: 'Shield', subclass: 'Arcane Trickster' }).ok === true,
    "AT L3 can learn Shield (Abjuration 1st)");
  check(canLearnSpell({ classId: 'rogue', level: 3, spellName: 'Mage Hand', subclass: 'Arcane Trickster' }).ok === true,
    "AT L3 can learn Mage Hand (Wizard cantrip)");
  check(canLearnSpell({ classId: 'rogue', level: 3, spellName: 'Sleep', subclass: 'Arcane Trickster' }).ok === true,
    "AT L3 can learn Sleep (Enchantment 1st)");
  const fireballAt = canLearnSpell({ classId: 'rogue', level: 3, spellName: 'Fireball', subclass: 'Arcane Trickster' });
  check(fireballAt.ok === false && /above the Arcane Trickster max of 1/.test(fireballAt.reason || ''),
    `AT L3 cannot learn Fireball (3rd level, max 1st) (got ${JSON.stringify(fireballAt.reason)})`);
  check(canLearnSpell({ classId: 'rogue', level: 2, spellName: 'Shield', subclass: 'Arcane Trickster' }).ok === false,
    'AT L2 cannot learn Shield (spellcasting begins at 3rd)');
  const thiefShield = canLearnSpell({ classId: 'rogue', level: 3, spellName: 'Shield', subclass: 'Thief' });
  check(thiefShield.ok === false && /no spell slots/.test(thiefShield.reason || ''),
    `Thief rogue cannot learn Shield (got ${JSON.stringify(thiefShield.reason)})`);
  // Non-Wizard spells are refused for both.
  const cureEk = canLearnSpell({ classId: 'fighter', level: 3, spellName: 'Cure Wounds', subclass: 'Eldritch Knight' });
  check(cureEk.ok === false && /not on the Wizard spell list/.test(cureEk.reason || ''),
    `EK cannot learn Cure Wounds (not a Wizard spell) (got ${JSON.stringify(cureEk.reason)})`);
  const cureAt = canLearnSpell({ classId: 'rogue', level: 3, spellName: 'Cure Wounds', subclass: 'Arcane Trickster' });
  check(cureAt.ok === false && /not on the Wizard spell list/.test(cureAt.reason || ''),
    `AT cannot learn Cure Wounds (not a Wizard spell) (got ${JSON.stringify(cureAt.reason)})`);
}

group('(i) PUT /:id enforces the EK/AT cap');
{
  // L3 Eldritch Knight, Int +3: the cap is 3 — a 4-spell sheet save
  // refuses 400 naming preparedSpells, and the row is unchanged.
  const ek3 = await makeCharacter({ name: 'EkThree', cls: 'fighter', level: 3, scores: INT3_SCORES, subclass: 'Eldritch Knight' });
  const over4 = await req('PUT', `/api/character/${ek3}`, { prepared_spells: J(EK_4) });
  check(over4.status === 400,
    `PUT 4 spells on an L3 EK (cap 3) refuses 400 (got ${over4.status})`);
  check(typeof over4.json?.error === 'string' && over4.json.error.includes('preparedSpells') && over4.json.error.includes('at most 3') && over4.json.error.includes('got 4'),
    `L3 EK PUT refusal names preparedSpells, cap 3, got 4 (got ${JSON.stringify(over4.json?.error)})`);
  check(JSON.stringify(await readPrepared(ek3)) === JSON.stringify([]),
    'refused L3 EK PUT left the stored prepared list empty');
  const atCap = await req('PUT', `/api/character/${ek3}`, { prepared_spells: J(EK_3) });
  check(atCap.status === 200, `PUT 3 spells on an L3 EK (cap 3) persists 200 (got ${atCap.status})`);
  check(JSON.stringify(await readPrepared(ek3)) === JSON.stringify(EK_3),
    'at-cap L3 EK PUT stored the 3-spell list');

  // L3 Arcane Trickster, Int +3: same cap, same behavior.
  const at3 = await makeCharacter({ name: 'AtThree', cls: 'rogue', level: 3, scores: INT3_SCORES, subclass: 'Arcane Trickster' });
  const atOver4 = await req('PUT', `/api/character/${at3}`, { prepared_spells: J(EK_4) });
  check(atOver4.status === 400,
    `PUT 4 spells on an L3 AT (cap 3) refuses 400 (got ${atOver4.status})`);
  check(typeof atOver4.json?.error === 'string' && atOver4.json.error.includes('preparedSpells') && atOver4.json.error.includes('at most 3') && atOver4.json.error.includes('got 4'),
    `L3 AT PUT refusal names preparedSpells, cap 3, got 4 (got ${JSON.stringify(atOver4.json?.error)})`);
  const atCapOk = await req('PUT', `/api/character/${at3}`, { prepared_spells: J(EK_3) });
  check(atCapOk.status === 200, `PUT 3 spells on an L3 AT (cap 3) persists 200 (got ${atCapOk.status})`);
  check(JSON.stringify(await readPrepared(at3)) === JSON.stringify(EK_3),
    'at-cap L3 AT PUT stored the 3-spell list');

  // A non-casting fighter is never capped: a Champion with 6 stored
  // prepared spells saves fine (no EK validator applies).
  const champ = await makeCharacter({ name: 'ChampNoCap', cls: 'fighter', level: 3, scores: INT3_SCORES, subclass: 'Champion' });
  const champPut = await req('PUT', `/api/character/${champ}`, { prepared_spells: J(EK_6) });
  check(champPut.status === 200, `PUT 6 spells on a Champion fighter (no cap) persists 200 (got ${champPut.status}: ${JSON.stringify(champPut.json?.error || '')})`);
  // A non-casting rogue likewise.
  const thief = await makeCharacter({ name: 'ThiefNoCap', cls: 'rogue', level: 3, scores: INT3_SCORES, subclass: 'Thief' });
  const thiefPut = await req('PUT', `/api/character/${thief}`, { prepared_spells: J(EK_6) });
  check(thiefPut.status === 200, `PUT 6 spells on a Thief rogue (no cap) persists 200 (got ${thiefPut.status}: ${JSON.stringify(thiefPut.json?.error || '')})`);
}

group('(j) Level-up re-checks the EK/AT list; swap routes to prepared_spells');
{
  // EK L4 -> L5, Int +3, with 6 spells stored: over the L5 cap of 4.
  // The level stays 4 and the stored list is unchanged.
  const ek = await makeCharacter({ name: 'EkLevel', cls: 'fighter', level: 4, scores: INT3_SCORES, subclass: 'Eldritch Knight' });
  await db.dbRun('UPDATE characters SET experience = ? WHERE id = ?', [getXPToNextLevel(4), ek]);
  await seedStoredPrepared(ek, EK_6);
  const up = await req('POST', `/api/character/level-up/${ek}`, {});
  check(up.status === 400,
    `level-up L4->5 with 6 stored spells (L5 cap 4) refuses 400 (got ${up.status}: ${JSON.stringify(up.json?.error || '')})`);
  check(typeof up.json?.error === 'string' && up.json.error.includes('preparedSpells'),
    `EK level-up refusal names preparedSpells (got ${JSON.stringify(up.json?.error)})`);
  const row = await readCharacter(ek);
  check(row.level === 4, 'refused EK level-up left the level at 4');
  check(JSON.stringify(JSON.parse(row.prepared_spells)) === JSON.stringify(EK_6),
    'refused EK level-up left the over-cap stored prepared list unchanged');
  // An at-cap stored list levels up cleanly: 4 spells at L5 cap 4.
  const ekOk = await makeCharacter({ name: 'EkLevelOk', cls: 'fighter', level: 4, scores: INT3_SCORES, subclass: 'Eldritch Knight' });
  await db.dbRun('UPDATE characters SET experience = ? WHERE id = ?', [getXPToNextLevel(4), ekOk]);
  await seedStoredPrepared(ekOk, EK_4);
  const upOk = await req('POST', `/api/character/level-up/${ekOk}`, {});
  check(upOk.status === 200,
    `level-up L4->5 with 4 stored spells (L5 cap 4) succeeds 200 (got ${upOk.status}: ${JSON.stringify(upOk.json?.error || '')})`);
  check((await readCharacter(ekOk)).level === 5, 'at-cap EK level-up raised the level to 5');

  // AT L4 -> L5, same shape.
  const at = await makeCharacter({ name: 'AtLevel', cls: 'rogue', level: 4, scores: INT3_SCORES, subclass: 'Arcane Trickster' });
  await db.dbRun('UPDATE characters SET experience = ? WHERE id = ?', [getXPToNextLevel(4), at]);
  await seedStoredPrepared(at, EK_6);
  const upAt = await req('POST', `/api/character/level-up/${at}`, {});
  check(upAt.status === 400,
    `level-up L4->5 with 6 stored spells (L5 cap 4) refuses 400 (got ${upAt.status}: ${JSON.stringify(upAt.json?.error || '')})`);
  check((await readCharacter(at)).level === 4, 'refused AT level-up left the level at 4');
  const atOk = await makeCharacter({ name: 'AtLevelOk', cls: 'rogue', level: 4, scores: INT3_SCORES, subclass: 'Arcane Trickster' });
  await db.dbRun('UPDATE characters SET experience = ? WHERE id = ?', [getXPToNextLevel(4), atOk]);
  await seedStoredPrepared(atOk, EK_4);
  const upAtOk = await req('POST', `/api/character/level-up/${atOk}`, {});
  check(upAtOk.status === 200,
    `level-up L4->5 with 4 stored spells (L5 cap 4) succeeds 200 (got ${upAtOk.status}: ${JSON.stringify(upAtOk.json?.error || '')})`);
  check((await readCharacter(atOk)).level === 5, 'at-cap AT level-up raised the level to 5');

  // Swap routing: an EK leveling up swaps a PREPARED spell, not a
  // known spell — the old spell leaves prepared_spells and the new
  // one lands there.
  const ekSwap = await makeCharacter({ name: 'EkSwap', cls: 'fighter', level: 4, scores: INT3_SCORES, subclass: 'Eldritch Knight' });
  await db.dbRun('UPDATE characters SET experience = ? WHERE id = ?', [getXPToNextLevel(4), ekSwap]);
  await seedStoredPrepared(ekSwap, EK_4);
  const upSwap = await req('POST', `/api/character/level-up/${ekSwap}`, { swapSpell: { old: 'Burning Hands', new: 'Thunderwave' } });
  check(upSwap.status === 200,
    `EK level-up with a prepared-spell swap succeeds 200 (got ${upSwap.status}: ${JSON.stringify(upSwap.json?.error || '')})`);
  const swapped = await readPrepared(ekSwap);
  check(swapped.includes('Thunderwave') && !swapped.includes('Burning Hands') && swapped.length === 4,
    `EK swap replaced Burning Hands with Thunderwave in prepared_spells (got ${JSON.stringify(swapped)})`);
}

group('(k) Multiclassing INTO EK/AT is never blocked on the stored list');
{
  // Wizard L3 with 10 stored prepared spells multiclasses into
  // fighter/EK: the EK re-check is leveling-up-IN only, so the
  // other class's stored list never blocks the multiclass.
  const wiz = await makeCharacter({ name: 'WizToEk', cls: 'wizard', level: 3, scores: INT3_SCORES });
  await db.dbRun('UPDATE characters SET experience = ? WHERE id = ?', [getXPToNextLevel(3), wiz]);
  await seedStoredPrepared(wiz, ['Shield', 'Magic Missile', 'Burning Hands', 'Sleep', 'Mage Armor', 'Thunderwave', 'Scorching Ray', 'Misty Step', 'Web', 'Fireball']);
  const upEk = await req('POST', `/api/character/level-up/${wiz}`, { selectedClass: 'fighter', subclass: 'Eldritch Knight' });
  check(upEk.status === 200,
    `wizard multiclassing into EK with 10 stored spells succeeds 200 (got ${upEk.status}: ${JSON.stringify(upEk.json?.error || '')})`);
  check((await readCharacter(wiz)).level === 4, 'multiclass-into-EK raised the total level to 4');
  // Same for rogue/AT.
  const wiz2 = await makeCharacter({ name: 'WizToAt', cls: 'wizard', level: 3, scores: INT3_SCORES });
  await db.dbRun('UPDATE characters SET experience = ? WHERE id = ?', [getXPToNextLevel(3), wiz2]);
  await seedStoredPrepared(wiz2, ['Shield', 'Magic Missile', 'Burning Hands', 'Sleep', 'Mage Armor', 'Thunderwave', 'Scorching Ray', 'Misty Step', 'Web', 'Fireball']);
  const upAt = await req('POST', `/api/character/level-up/${wiz2}`, { selectedClass: 'rogue', subclass: 'Arcane Trickster' });
  check(upAt.status === 200,
    `wizard multiclassing into AT with 10 stored spells succeeds 200 (got ${upAt.status}: ${JSON.stringify(upAt.json?.error || '')})`);
  check((await readCharacter(wiz2)).level === 4, 'multiclass-into-AT raised the total level to 4');
}

server.close();
console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
process.exit(failed > 0 ? 1 : 0);
