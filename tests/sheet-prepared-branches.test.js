// tests/sheet-prepared-branches.test.js — sheet getMaxPrepared branches
// for bard / warlock / Order of the Profane Soul + the existing wizard
// branch, and the classes.json labels that gate isPreparedCaster()
// (2026-11-07, wizard-validator + sheet-branches job).
//
// What was wrong: bard, warlock and blood_hunter all fell through to
// `return 0` in CharacterSheet.jsx getMaxPrepared, and bard + warlock
// carried the stale "Limited known" label in classes.json — so
// isPreparedCaster() was false for them and the Prepared Spells
// section never rendered. The wizard branch already existed and
// already matched the server formula (Int mod + wizard level, min 1);
// it is pinned here, not added.
//
// Rules pinned (2024 PHB):
//  - Bard: max(1, Cha mod + bard level) — the bardService formula
//    (L1 at Cha +3 = 4). No slot gate.
//  - Warlock: fixed table [2,3,4,5,6,7,8,9,10,10,11,11,12,12,13,13,
//    14,14,15,15] — 2 at L1 -> 15 at L20, Cha mod ignored.
//  - Blood Hunter, Order of the Profane Soul ONLY: fixed table
//    [0,0,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,11] — 2 at 3rd ->
//    11 at 20th. Other Orders (Ghostslayer / Lycan / Mutant) do not
//    cast and keep falling through to 0.
//  - Wizard: max(1, Int mod + wizard level), min 1 (pre-existing).
//
// How this tests the sheet honestly: getMaxPrepared and
// isPreparedCaster are EXTRACTED from the live CharacterSheet.jsx
// source (brace-matched, not hand-copied) and EXECUTED with stubbed
// component state — the numbers below come from running the real
// branch code. The sheet tables are also asserted value-for-value
// against the real server tables imported from
// server/config/levelProgression.js, and the bard/wizard formulas
// are swept against the real getSpellsPrepared at every level and
// mod. A mutation check at the end proves the asserts are
// branch-sensitive: delete a branch from the extracted source and
// the corresponding asserts fail.
//
// Run from the repo root: node tests/sheet-prepared-branches.test.js
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

let passed = 0;
let failed = 0;
function check(condition, message) {
  if (condition) { passed++; }
  else { failed++; console.error('  ✗', message); }
}
function group(name) { console.log('\n==', name); }

const repoRoot = process.cwd();
const readRepo = (rel) => fs.readFileSync(path.join(repoRoot, rel), 'utf8');

const { getSpellsPrepared, WARLOCK_SPELLS_PREPARED, PROFANE_SOUL_SPELLS_PREPARED } =
  await import(pathToFileURL(path.join(repoRoot, 'server/config/levelProgression.js')).href);

// --- Extract a function body from the sheet source, brace-matched,
// skipping // comments and '...' / "..." / `...` strings so a brace
// inside a comment or string cannot end the match early. -----------
function extractFnBody(src, marker) {
  const start = src.indexOf(marker);
  assert(start !== -1, `sheet defines ${marker}`);
  const open = src.indexOf('{', start);
  let depth = 0;
  let i = open;
  let state = null; // null | "'" | '"' | '`' | '//' | '/*'
  while (i < src.length) {
    const c = src[i];
    const next = src[i + 1];
    if (state === '//') { if (c === '\n') state = null; i++; continue; }
    if (state === '/*') { if (c === '*' && next === '/') { state = null; i += 2; continue; } i++; continue; }
    if (state === "'" || state === '"' || state === '`') {
      if (c === '\\') { i += 2; continue; }
      if (c === state) state = null;
      i++; continue;
    }
    if (c === '/' && next === '/') { state = '//'; i += 2; continue; }
    if (c === '/' && next === '*') { state = '/*'; i += 2; continue; }
    if (c === "'" || c === '"' || c === '`') { state = c; i++; continue; }
    if (c === '{') depth++;
    if (c === '}') { depth--; if (depth === 0) return src.slice(open + 1, i); }
    i++;
  }
  throw new Error(`unbalanced braces after ${marker}`);
}

const sheetSrc = readRepo('client/src/components/CharacterSheet.jsx');
const classesJson = JSON.parse(readRepo('client/src/data/classes.json'));

// The two component-level table consts getMaxPrepared closes over.
const thirdCasterDecl = sheetSrc.match(/const THIRD_CASTER_PREPARED_SPELLS = \[[^\]]*\]/);
const paladinDecl = sheetSrc.match(/const PALADIN_PREPARED_SPELLS = \[[^\]]*\]/);
assert(thirdCasterDecl, 'sheet defines THIRD_CASTER_PREPARED_SPELLS');
assert(paladinDecl, 'sheet defines PALADIN_PREPARED_SPELLS');

// Build the real getMaxPrepared / isPreparedCaster as callable
// functions over stubbed component state. `body` is the extracted
// source, not a hand copy — if the sheet changes, this tests the new
// code (or fails to extract).
function buildSheetFns(source) {
  const prepBody = extractFnBody(source, 'const getMaxPrepared = () => {');
  const casterBody = extractFnBody(source, 'const isPreparedCaster = () => {');
  const getMaxPrepared = new Function(
    'isThirdCaster', 'isProfaneSoul', 'classData', 'abilities', 'character',
    `${thirdCasterDecl[0]};\n${paladinDecl[0]};\n${prepBody}`,
  );
  const isPreparedCaster = new Function(
    'isThirdCaster', 'isProfaneSoul', 'classData',
    casterBody,
  );
  return { getMaxPrepared, isPreparedCaster };
}

const sheet = buildSheetFns(sheetSrc);

// Mirror of the sheet's own flag wiring (isThirdCaster /
// isProfaneSoul consts in the component): the flags are computed
// from class + subclass + level exactly as the sheet computes them,
// and the static checks in group (a) pin the sheet's own wording.
function flagsFor(cls, subclass, level) {
  return {
    isThirdCaster: ((cls === 'fighter' && subclass === 'Eldritch Knight') ||
      (cls === 'rogue' && subclass === 'Arcane Trickster')) && level >= 3,
    isProfaneSoul: cls === 'blood_hunter' && subclass === 'Order of the Profane Soul' && level >= 3,
  };
}
function capFor({ cls, subclass = null, level, scores }) {
  const { isThirdCaster, isProfaneSoul } = flagsFor(cls, subclass, level);
  return sheet.getMaxPrepared(isThirdCaster, isProfaneSoul, classesJson[cls] || {}, scores, { class: cls, subclass, level });
}
function isPreparedFor({ cls, subclass = null, level }) {
  const { isThirdCaster, isProfaneSoul } = flagsFor(cls, subclass, level);
  return sheet.isPreparedCaster(isThirdCaster, isProfaneSoul, classesJson[cls] || {});
}

const CHA3 = { str: 10, dex: 10, con: 14, int: 10, wis: 10, cha: 16 };
const CHA4 = { str: 10, dex: 10, con: 14, int: 10, wis: 10, cha: 18 };
const CHA5 = { str: 10, dex: 10, con: 14, int: 10, wis: 10, cha: 20 };
const CHA0 = { str: 10, dex: 10, con: 14, int: 10, wis: 10, cha: 10 };
const INT3 = { str: 10, dex: 10, con: 14, int: 16, wis: 10, cha: 10 };
const INT5 = { str: 10, dex: 10, con: 14, int: 20, wis: 10, cha: 10 };
const INT0 = { str: 10, dex: 10, con: 14, int: 10, wis: 10, cha: 10 };

// ===========================================================================
// (a) Branches exist in the sheet, in the right shape
// ===========================================================================
group('(a) getMaxPrepared has the bard / warlock / Profane Soul branches; wizard branch intact');
{
  const fnStart = sheetSrc.indexOf('const getMaxPrepared');
  const fnEnd = sheetSrc.indexOf('const isPreparedCaster', fnStart);
  const fnSrc = sheetSrc.slice(fnStart, fnEnd);
  check(fnSrc.indexOf("className === 'wizard'") !== -1, 'wizard branch present');
  check(fnSrc.indexOf("if (className === 'wizard') return Math.max(1, mod + character.level)") !== -1,
    'wizard branch is the server formula (Int mod + level, min 1), untouched');
  check((fnSrc.match(/className === 'wizard'/g) || []).length === 1, 'exactly one wizard branch (no duplicate)');
  check(fnSrc.indexOf("className === 'bard'") !== -1, 'bard branch present');
  check(fnSrc.indexOf("if (className === 'bard') return Math.max(1, mod + character.level)") !== -1,
    'bard branch is max(1, Cha mod + level)');
  check(fnSrc.indexOf("className === 'warlock'") !== -1, 'warlock branch present');
  check(fnSrc.replace(/\s+/g, '').includes(JSON.stringify(WARLOCK_SPELLS_PREPARED)),
    'warlock table literal in the sheet IS the server WARLOCK_SPELLS_PREPARED table');
  check(fnSrc.indexOf('isProfaneSoul') !== -1, 'Profane Soul branch present (gated on isProfaneSoul)');
  check(fnSrc.replace(/\s+/g, '').includes(JSON.stringify(PROFANE_SOUL_SPELLS_PREPARED)),
    'Profane Soul table literal in the sheet IS the server PROFANE_SOUL_SPELLS_PREPARED table');
  // The Profane Soul check must sit BEFORE the `!classData?.spellcasting`
  // guard — the blood_hunter base class carries spellcasting: null, so
  // a branch placed after the guard could never run.
  check(fnSrc.indexOf('isProfaneSoul') < fnSrc.indexOf('if (!classData?.spellcasting) return 0'),
    'Profane Soul branch runs before the spellcasting-null guard');
  // The sheet's own isProfaneSoul flag: exact subclass name from
  // classes.json, level-gated to 3rd like the third-caster flag.
  const flagLine = sheetSrc.match(/const isProfaneSoul = [^\n]*/);
  check(flagLine !== null, 'sheet defines isProfaneSoul');
  check(flagLine[0].includes("'Order of the Profane Soul'"), 'isProfaneSoul checks the exact subclass name');
  check(flagLine[0].includes('character.level >= 3'), 'isProfaneSoul is level-gated to 3rd');
  check(sheetSrc.indexOf('if (isProfaneSoul) return true') !== -1,
    'isPreparedCaster has the Profane Soul carve-out (else the branch could never render)');
  // Stale section comment fixed: it used to list only
  // Cleric, Druid, Paladin, Wizard, Artificer.
  check(!sheetSrc.includes('Prepared Spells - for Cleric, Druid, Paladin, Wizard, Artificer */'),
    'stale Prepared Spells section comment (5 classes only) is gone');
  check(sheetSrc.includes('Bard') && sheetSrc.includes('Warlock') && sheetSrc.includes('Profane Soul'),
    'Prepared Spells section comment now names the new casters');
}

// ===========================================================================
// (b) Executed caps at representative levels / mods
// ===========================================================================
group('(b) Executed getMaxPrepared caps: bard / warlock / Profane Soul / wizard');
{
  check(capFor({ cls: 'bard', level: 1, scores: CHA3 }) === 4, 'bard L1 Cha+3 = 4');
  check(capFor({ cls: 'bard', level: 5, scores: CHA4 }) === 9, 'bard L5 Cha+4 = 9');
  check(capFor({ cls: 'bard', level: 20, scores: CHA5 }) === 25, 'bard L20 Cha+5 = 25');
  check(capFor({ cls: 'bard', level: 1, scores: CHA0 }) === 1, 'bard L1 Cha+0 = 1 (min 1)');
  check(capFor({ cls: 'warlock', level: 1, scores: CHA3 }) === 2, 'warlock L1 = 2');
  check(capFor({ cls: 'warlock', level: 10, scores: CHA3 }) === 10, 'warlock L10 = 10');
  check(capFor({ cls: 'warlock', level: 20, scores: CHA5 }) === 15, 'warlock L20 = 15');
  check(capFor({ cls: 'warlock', level: 1, scores: CHA0 }) === 2, 'warlock L1 Cha+0 still 2 (mod ignored)');
  check(capFor({ cls: 'warlock', level: 20, scores: CHA0 }) === 15, 'warlock L20 Cha+0 still 15 (mod ignored)');
  check(capFor({ cls: 'blood_hunter', subclass: 'Order of the Profane Soul', level: 3, scores: INT3 }) === 2,
    'Profane Soul L3 = 2');
  check(capFor({ cls: 'blood_hunter', subclass: 'Order of the Profane Soul', level: 10, scores: INT3 }) === 5,
    'Profane Soul L10 = 5');
  check(capFor({ cls: 'blood_hunter', subclass: 'Order of the Profane Soul', level: 20, scores: INT5 }) === 11,
    'Profane Soul L20 = 11');
  check(capFor({ cls: 'blood_hunter', subclass: 'Order of the Profane Soul', level: 2, scores: INT3 }) === 0,
    'Profane Soul L2 = 0 (no casting before 3rd)');
  check(capFor({ cls: 'blood_hunter', subclass: 'Order of the Ghostslayer', level: 10, scores: INT3 }) === 0,
    'Ghostslayer L10 = 0 (does not cast)');
  check(capFor({ cls: 'blood_hunter', subclass: 'Order of the Lycan', level: 5, scores: INT3 }) === 0,
    'Lycan L5 = 0 (does not cast)');
  check(capFor({ cls: 'blood_hunter', subclass: 'Order of the Mutant', level: 20, scores: INT5 }) === 0,
    'Mutant L20 = 0 (does not cast)');
  check(capFor({ cls: 'blood_hunter', subclass: null, level: 10, scores: INT3 }) === 0,
    'blood_hunter with no subclass = 0');
  check(capFor({ cls: 'wizard', level: 1, scores: INT3 }) === 4, 'wizard L1 Int+3 = 4');
  check(capFor({ cls: 'wizard', level: 20, scores: INT5 }) === 25, 'wizard L20 Int+5 = 25');
  check(capFor({ cls: 'wizard', level: 1, scores: INT0 }) === 1, 'wizard L1 Int+0 = 1 (min 1)');
}

// ===========================================================================
// (c) Full sweeps against the real server source of truth
// ===========================================================================
group('(c) Sweeps: sheet caps agree with the server at every level');
{
  let warlockMismatch = 0;
  let profaneMismatch = 0;
  for (let level = 1; level <= 20; level++) {
    if (capFor({ cls: 'warlock', level, scores: CHA0 }) !== WARLOCK_SPELLS_PREPARED[level - 1]) warlockMismatch++;
    if (capFor({ cls: 'blood_hunter', subclass: 'Order of the Profane Soul', level, scores: INT0 }) !== PROFANE_SOUL_SPELLS_PREPARED[level - 1]) profaneMismatch++;
  }
  check(warlockMismatch === 0, `sheet warlock cap == WARLOCK_SPELLS_PREPARED at all 20 levels (${warlockMismatch} mismatches)`);
  check(profaneMismatch === 0, `sheet Profane Soul cap == PROFANE_SOUL_SPELLS_PREPARED at all 20 levels (${profaneMismatch} mismatches)`);
  // Bard / wizard formulas swept against the real getSpellsPrepared
  // at every level and every mod from -1 to +5.
  let bardMismatch = 0;
  let wizardMismatch = 0;
  for (let level = 1; level <= 20; level++) {
    for (let mod = -1; mod <= 5; mod++) {
      const scores = { str: 10, dex: 10, con: 10, int: 10 + mod * 2, wis: 10, cha: 10 + mod * 2 };
      if (capFor({ cls: 'bard', level, scores }) !== getSpellsPrepared('bard', level, mod)) bardMismatch++;
      if (capFor({ cls: 'wizard', level, scores }) !== getSpellsPrepared('wizard', level, mod)) wizardMismatch++;
    }
  }
  check(bardMismatch === 0, `sheet bard cap == getSpellsPrepared('bard') at all 20 levels x 7 mods (${bardMismatch} mismatches)`);
  check(wizardMismatch === 0, `sheet wizard cap == getSpellsPrepared('wizard') at all 20 levels x 7 mods (${wizardMismatch} mismatches)`);
}

// ===========================================================================
// (d) classes.json labels gate isPreparedCaster(); numbers untouched
// ===========================================================================
group('(d) classes.json labels + isPreparedCaster() flow-through');
{
  check(classesJson.bard?.spellcasting?.spellsKnown === 'All prepared', "bard spellsKnown is 'All prepared'");
  check(classesJson.warlock?.spellcasting?.spellsKnown === 'All prepared', "warlock spellsKnown is 'All prepared'");
  check(classesJson.sorcerer?.spellcasting?.spellsKnown === 'All prepared', "sorcerer spellsKnown still 'All prepared' (precedent)");
  check(classesJson.wizard?.spellcasting?.spellsKnown === 'Spellbook', "wizard spellsKnown still 'Spellbook'");
  check(!JSON.stringify(classesJson).includes('"Limited known"'), 'no "Limited known" label remains anywhere in classes.json');
  check(JSON.stringify(classesJson.bard?.spellcasting?.spellsKnownByLevel) ===
    JSON.stringify([4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 15, 15, 16, 18, 19, 19, 20, 22, 22, 22]),
    'bard spellsKnownByLevel numbers unchanged (4 at L1 -> 22 at L20)');
  check(JSON.stringify(classesJson.warlock?.spellcasting?.spellsKnownByLevel) === JSON.stringify(WARLOCK_SPELLS_PREPARED),
    'warlock spellsKnownByLevel numbers unchanged (== WARLOCK_SPELLS_PREPARED)');
  // isPreparedCaster() reads spellsKnown === 'All prepared' ||
  // 'Spellbook' — with the labels fixed, the Prepared Spells section
  // now renders for bard and warlock; wizard is unchanged.
  const casterSrc = sheetSrc.slice(sheetSrc.indexOf('const isPreparedCaster'));
  check(casterSrc.includes("spellsKnown === 'All prepared'") && casterSrc.includes("spellsKnown === 'Spellbook'"),
    "isPreparedCaster reads spellsKnown === 'All prepared' || 'Spellbook'");
  check(isPreparedFor({ cls: 'bard', level: 1 }) === true, 'isPreparedCaster: bard renders the Prepared section');
  check(isPreparedFor({ cls: 'warlock', level: 1 }) === true, 'isPreparedCaster: warlock renders the Prepared section');
  check(isPreparedFor({ cls: 'wizard', level: 1 }) === true, 'isPreparedCaster: wizard still renders the Prepared section');
  check(isPreparedFor({ cls: 'blood_hunter', subclass: 'Order of the Profane Soul', level: 3 }) === true,
    'isPreparedCaster: Profane Soul L3 renders the Prepared section');
  check(isPreparedFor({ cls: 'blood_hunter', subclass: 'Order of the Profane Soul', level: 2 }) === false,
    'isPreparedCaster: Profane Soul L2 does NOT render (no casting yet)');
  check(isPreparedFor({ cls: 'blood_hunter', subclass: 'Order of the Ghostslayer', level: 10 }) === false,
    'isPreparedCaster: Ghostslayer does NOT render');
  check(isPreparedFor({ cls: 'blood_hunter', subclass: null, level: 10 }) === false,
    'isPreparedCaster: subclass-less blood_hunter does NOT render');
}

// ===========================================================================
// (e) Mutation check — the asserts above are branch-sensitive
// ===========================================================================
group('(e) Mutation check: deleting a branch breaks its asserts');
{
  const without = (snippet) => {
    const mutated = sheetSrc.replace(snippet, '');
    assert(mutated !== sheetSrc, `mutation snippet found: ${snippet.slice(0, 60)}…`);
    return buildSheetFns(mutated);
  };
  const mutatedWarlock = without("if (className === 'warlock') return WARLOCK_PREPARED[character.level - 1] ?? 0");
  check(mutatedWarlock.getMaxPrepared(false, false, classesJson.warlock, CHA3, { class: 'warlock', subclass: null, level: 10 }) === 0,
    'warlock branch deleted -> warlock L10 cap is 0 (asserts would fail)');
  const mutatedBard = without("if (className === 'bard') return Math.max(1, mod + character.level)");
  check(mutatedBard.getMaxPrepared(false, false, classesJson.bard, CHA3, { class: 'bard', subclass: null, level: 1 }) === 0,
    'bard branch deleted -> bard L1 cap is 0 (asserts would fail)');
  const mutatedProfane = without(`    if (isProfaneSoul) {
      const PROFANE_SOUL_PREPARED = [0, 0, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 11]
      return PROFANE_SOUL_PREPARED[character.level - 1] ?? 0
    }`);
  check(mutatedProfane.getMaxPrepared(false, true, classesJson.blood_hunter, INT3, { class: 'blood_hunter', subclass: 'Order of the Profane Soul', level: 10 }) === 0,
    'Profane Soul branch deleted -> PS L10 cap is 0 (asserts would fail)');
  const mutatedWizard = without("if (className === 'wizard') return Math.max(1, mod + character.level)");
  check(mutatedWizard.getMaxPrepared(false, false, classesJson.wizard, INT3, { class: 'wizard', subclass: null, level: 1 }) === 0,
    'wizard branch deleted -> wizard L1 cap is 0 (asserts would fail)');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
