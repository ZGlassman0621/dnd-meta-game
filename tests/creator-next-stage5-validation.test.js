// tests/creator-next-stage5-validation.test.js — creator-next Stage 5
// ("Gear & Story") build (Zach, 2026-11-06).
//
// What this build wires in:
//   - NEW server/data/themeGoldModifiers.js — THEME_GOLD_MODIFIERS +
//     applyGoldModifier, verbatim from the client Stage-3 as-built
//     values (21 themes, no value changes); themeService.js
//     toClientShape gains a `goldModifier` field (additive only), so
//     /api/themes serves the same number the gold fork computes from.
//   - server/routes/character.js: exported validateCreatorNextStage5,
//     wired into POST + PUT after Stage 4; POST/PUT derive HP/AC/
//     speed server-side from the resolved package (never trust
//     client-resolved items); gold fork via computeGoldFork; warlord
//     added to HIT_DICE in server/config/levelProgression.js (8,
//     ending the accidental fallback — no behavior change).
//   - Heirloom is NOT built (no server home for manual heirloom
//     authoring) — recorded as deferred, not tested here.
//
// REAL MODULES: server/data/startingPackages.js and
// server/services/packageResolutionService.js are the package
// worker's real modules, landed on the live Mac 2026-11-07 and
// copied verbatim into this mirror (md5 c45d448f… / 441f9fbc…).
// The resolver's picks shape is keyed by choice-entry `key`:
// sentinel categories take an array of `count` names
// ({instrument: ['Lute']}); array `from` alternatives take
// {alternative: <index>}, with nested choices answered under their
// own key (monk {toolOrInstrument: {alternative: 0}, tool: [...]}).
// Missing picks FAIL in the resolver — the Stage 5 validator
// therefore judges picks only when the reached choice keys are
// all answered (an incomplete set is a draft, never a refusal).
// Dedup is grant-once in the real resolver: a picked item that is
// also granted is given once, at the greater quantity — there is
// no replacement-pick rule. Within one count-2 pick, the same name
// twice SUMS (two physical items). Both are pinned below, since
// they differ from the brief's stand-in assumption.
//
// Equipment slots store CANONICAL 2024 armor names ('Leather',
// 'Studded Leather', 'Chain Mail' — the chapter's names, and the
// ARMOR_DATA keys calculateCombatStats resolves). The 2014 bank's
// 'X Armor' spellings do NOT resolve in combat (resolveArmorVariant
// has no 'Leather Armor' entry and ARMOR_DATA has no such key), so
// storing them would leave the equipment-source AC at 10 + Dex.
// The stored armor_class column and the equipment-source AC are
// pinned to agree (group (e)).
//
// Honest integration tests: the validator, derivation, theme +
// package services, species service, and both routers are the real
// modules, driven over real HTTP against a real throwaway DB
// (Stage 3/4 harness). If any real module were deleted, the imports
// fail and the suite fails with them. Footer is the runner-matching
// `Results:` form so the count aggregates.
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

const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'creator-next-stage5-test-'));
const tmpDir = repoRoot;
const origCwd = process.cwd();
process.chdir(tmpDir);
delete process.env.TURSO_DATABASE_URL;
delete process.env.TURSO_AUTH_TOKEN;
const fromRepo = (rel) => pathToFileURL(path.join(origCwd, rel)).href;
const readRepo = (rel) => fs.readFileSync(path.join(origCwd, rel), 'utf-8');

const db = await import(fromRepo('server/database.js'));
await db.initDatabase();
// The real modules under test.
const { validateCreatorNextStage5, deriveCreatorNextStage5 } = await import(fromRepo('server/routes/character.js'));
const { validateCreatorNextStage4 } = await import(fromRepo('server/routes/character.js'));
const { THEME_GOLD_MODIFIERS, applyGoldModifier } = await import(fromRepo('server/data/themeGoldModifiers.js'));
const { resolveTheme, toClientShape, listThemes } = await import(fromRepo('server/services/themeService.js'));
// Stand-in package modules (see header) — imported as the real
// modules are: the real files landed 2026-11-07 and are copied
// verbatim into this mirror.
const packageService = await import(fromRepo('server/services/packageResolutionService.js'));
const { resolvePackage, validatePackageChoice, listPackageOptions, computeGoldFork } = packageService;
const { STARTING_PACKAGES } = await import(fromRepo('server/data/startingPackages.js'));
const { getPlayerCombatAc } = await import(fromRepo('server/services/combatStatsService.js'));

// --- HTTP harness: the real character + themes routers on one app ---
const app = express();
app.use(express.json());
const characterRouter = (await import(fromRepo('server/routes/character.js'))).default;
const themesRouter = (await import(fromRepo('server/routes/themes.js'))).default;
app.use('/api/character', characterRouter);
app.use('/api/themes', themesRouter);
const server = await new Promise((resolve) => {
  const s = app.listen(0, '127.0.0.1', () => resolve(s));
});
const base = `http://127.0.0.1:${server.address().port}`;
async function postCharacter(body) {
  const res = await fetch(`${base}/api/character`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  let json = null;
  try { json = await res.json(); } catch {}
  return { status: res.status, json };
}
async function putCharacter(id, body) {
  const res = await fetch(`${base}/api/character/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  let json = null;
  try { json = await res.json(); } catch {}
  return { status: res.status, json };
}
async function getThemes() {
  const res = await fetch(`${base}/api/themes`);
  let json = null;
  try { json = await res.json(); } catch {}
  return { status: res.status, json };
}
async function characterCountByName(name) {
  const row = await db.dbGet('SELECT COUNT(*) AS n FROM characters WHERE name = ?', [name]);
  return row?.n ?? 0;
}
async function readCharacter(id) {
  return db.dbGet('SELECT * FROM characters WHERE id = ?', [id]);
}
function parseCol(row, col) {
  try { return JSON.parse(row[col]); } catch { return undefined; }
}

const MARKER = 'creator-next';
const J = (v) => JSON.stringify(v); // the wire format for JSON columns: strings, not raw arrays

// --- Verified-good Stage 1–4 fixtures (Stage 4 suite) -------------
// Dwarf (Hill) / soldier cleric. Point-buy bases cost exactly 27.
// Finals = base + Hill variant total {con:2, wis:1} + soldier theme
// {str:2, con:1}. Wis 16 -> mod +3 -> cleric prepares 4.
const DWARF_BASE = { str: 12, dex: 10, con: 13, int: 8, wis: 15, cha: 14 };
const DWARF_FINAL = { str: 14, dex: 10, con: 16, int: 8, wis: 16, cha: 14 };
const DWARF_PREPARED = ['bless', 'cure wounds', 'guiding bolt', 'shield of faith'];
const CLERIC_SPELLS_5 = [...DWARF_PREPARED, 'sanctuary'];
function dwarfClericBody(overrides = {}) {
  return {
    creator: MARKER, class: 'cleric', race: 'dwarf', subrace: 'Hill Dwarf',
    theme_id: 'soldier', generation_method: 'point_buy',
    base_scores: DWARF_BASE, ability_scores: DWARF_FINAL,
    skills: ['Athletics', 'Intimidation', 'Religion'],
    languages: ['Common', 'Dwarvish'],
    prepared_spells: DWARF_PREPARED,
    ...overrides,
  };
}
// Per-theme dwarf/soldier-shaped cleric: finals recomputed from the
// REAL theme ASI (resolveTheme), skills = the theme's two signature
// skills + the first cleric option not already among them, prepared
// count from the resulting Wis mod (cleric prepares Wis mod + 1).
function clericBodyForTheme(themeId) {
  const theme = resolveTheme(themeId);
  assert(theme, `fixture theme ${themeId} resolves`);
  const asi = theme.ability_score_increase || {};
  const finals = {};
  for (const k of ['str', 'dex', 'con', 'int', 'wis', 'cha']) {
    finals[k] = DWARF_BASE[k] + (k === 'con' ? 2 : 0) + (k === 'wis' ? 1 : 0) + (Number(asi[k]) || 0);
  }
  const sigs = [theme.signature_skill_1, theme.signature_skill_2];
  const extra = ['History', 'Insight', 'Medicine', 'Persuasion', 'Religion'].find((s) => !sigs.includes(s));
  const prepCount = Math.max(1, Math.floor((finals.wis - 10) / 2) + 1);
  return {
    creator: MARKER, class: 'cleric', race: 'dwarf', subrace: 'Hill Dwarf',
    theme_id: themeId, generation_method: 'point_buy',
    base_scores: DWARF_BASE, ability_scores: finals,
    skills: [...sigs, extra],
    languages: ['Common', 'Dwarvish'],
    prepared_spells: CLERIC_SPELLS_5.slice(0, prepCount),
  };
}
function dwarfFighterBody(overrides = {}) {
  return {
    creator: MARKER, class: 'fighter', race: 'dwarf', subrace: 'Hill Dwarf',
    theme_id: 'soldier', generation_method: 'point_buy',
    base_scores: DWARF_BASE, ability_scores: DWARF_FINAL,
    skills: ['Athletics', 'Intimidation', 'Perception', 'Survival'],
    languages: ['Common', 'Dwarvish'],
    ...overrides,
  };
}
function dwarfBardBody(overrides = {}) {
  return {
    creator: MARKER, class: 'bard', race: 'dwarf', subrace: 'Hill Dwarf',
    theme_id: 'soldier', generation_method: 'point_buy',
    base_scores: DWARF_BASE, ability_scores: DWARF_FINAL,
    skills: ['Athletics', 'Intimidation', 'Performance'],
    languages: ['Common', 'Dwarvish'],
    prepared_spells: ['cure wounds', 'dissonant whispers', 'healing word'],
    ...overrides,
  };
}
function dwarfWarlordBody(overrides = {}) {
  return {
    creator: MARKER, class: 'warlord', race: 'dwarf', subrace: 'Hill Dwarf',
    theme_id: 'soldier', generation_method: 'point_buy',
    base_scores: DWARF_BASE, ability_scores: DWARF_FINAL,
    skills: ['Athletics', 'Intimidation', 'History'],
    languages: ['Common', 'Dwarvish'],
    ...overrides,
  };
}
function dwarfBlackguardBody(overrides = {}) {
  return {
    creator: MARKER, class: 'blackguard', race: 'dwarf', subrace: 'Hill Dwarf',
    theme_id: 'soldier', generation_method: 'point_buy',
    base_scores: DWARF_BASE, ability_scores: DWARF_FINAL,
    skills: ['Athletics', 'Intimidation', 'Religion'],
    languages: ['Common', 'Dwarvish'],
    prepared_spells: [],
    ...overrides,
  };
}
function humanRogueBody(overrides = {}) {
  return {
    creator: MARKER, class: 'rogue', race: 'human',
    theme_id: 'soldier', generation_method: 'manual',
    base_scores: { str: 10, dex: 16, con: 12, int: 10, wis: 12, cha: 14 },
    ability_scores: { str: 12, dex: 16, con: 13, int: 10, wis: 12, cha: 14 },
    skills: ['Athletics', 'Intimidation', 'Stealth', 'Sleight of Hand'],
    languages: ['Common'],
    ...overrides,
  };
}
function woodElfWizardBody(overrides = {}) {
  return {
    creator: MARKER, class: 'wizard', race: 'elf', subrace: 'Wood Elf',
    theme_id: 'sage', generation_method: 'point_buy',
    base_scores: { str: 8, dex: 14, con: 12, int: 15, wis: 13, cha: 10 },
    ability_scores: { str: 8, dex: 16, con: 12, int: 17, wis: 15, cha: 10 },
    skills: ['Arcana', 'History', 'Investigation'],
    languages: ['Common', 'Elvish'],
    prepared_spells: ['magic missile', 'shield', 'mage armor', 'sleep'],
    ...overrides,
  };
}
function manualDexClericBody(overrides = {}) {
  // Dex 16 (+3) cleric: Chain Shirt caps Dex at +2, Shield adds +2.
  return {
    creator: MARKER, class: 'cleric', race: 'dwarf', subrace: 'Hill Dwarf',
    theme_id: 'soldier', generation_method: 'manual',
    base_scores: { str: 12, dex: 16, con: 13, int: 8, wis: 15, cha: 14 },
    ability_scores: { str: 14, dex: 16, con: 16, int: 8, wis: 16, cha: 14 },
    skills: ['Athletics', 'Intimidation', 'Religion'],
    languages: ['Common', 'Dwarvish'],
    prepared_spells: DWARF_PREPARED,
    ...overrides,
  };
}
function manualWeakStrFighterBody(overrides = {}) {
  // Str 12 final vs Chain Mail's Str 13: speed −10 (PHB p. 219).
  return {
    creator: MARKER, class: 'fighter', race: 'dwarf', subrace: 'Hill Dwarf',
    theme_id: 'soldier', generation_method: 'manual',
    base_scores: { str: 10, dex: 14, con: 13, int: 8, wis: 12, cha: 13 },
    ability_scores: { str: 12, dex: 14, con: 16, int: 8, wis: 13, cha: 13 },
    skills: ['Athletics', 'Intimidation', 'Perception', 'Survival'],
    languages: ['Common', 'Dwarvish'],
    ...overrides,
  };
}
// POST a full valid Stage 1–4 body the way the client sends it:
// JSON columns as JSON strings, validation-only fields raw.
async function postFull(name, body, extra = {}) {
  return postCharacter({
    name, ...body,
    base_scores: body.base_scores, ability_scores: J(body.ability_scores),
    skills: J(body.skills), languages: J(body.languages),
    ...(body.prepared_spells !== undefined ? { prepared_spells: J(body.prepared_spells) } : {}),
    ...extra,
  });
}
function errOf(r) { return typeof r.json?.error === 'string' ? r.json.error : JSON.stringify(r.json); }

// Direct-insert helper (blackguard-validator-wiring.test.js pattern):
// the PRAGMA read fills every NOT NULL column with no default, so the
// insert never misses a required column.
async function insertRow(table, overrides = {}) {
  const info = await db.dbAll(`PRAGMA table_info(${table})`);
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
  const r = await db.dbRun(
    `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`, vals
  );
  return Number(r.lastInsertRowid);
}

// MVP gray-out (2026-11-08): a blackguard PC can no longer be created
// through the route (POST refuses 400), so blackguard fixture rows are
// seeded directly — legacy state, the same justification
// blackguard-validator-wiring uses. The PUTs under test still drive the
// real route over HTTP; only the fixture setup bypasses it. The JSON
// columns the PUT path parses are set explicitly (the filler would
// leave them as 'TEST_<col>' strings); the row otherwise matches what
// dwarfBlackguardBody() POSTed before the gray-out (dwarf / Hill
// Dwarf, soldier-shaped scores, empty prepared list).
async function seedBlackguardRow(name) {
  return insertRow('characters', {
    name, class: 'blackguard', race: 'dwarf', subrace: 'Hill Dwarf',
    level: 1, experience: 0, max_hp: 0, current_hp: 0,
    ability_scores: J(DWARF_FINAL), skills: J(['Athletics', 'Intimidation', 'Religion']),
    languages: J(['Common', 'Dwarvish']), prepared_spells: J([]),
    class_levels: J([{ class: 'blackguard', level: 1, subclass: null }]),
    inventory: J([]), equipment: J({}),
  });
}

// (a) Validator unit — draft tolerance, refusal directions ---------
group('(a) Stage 5 validator (unit)');
{
  check(validateCreatorNextStage5({}).ok === true, 'empty body passes (draft)');
  check(validateCreatorNextStage5({ creator: MARKER }).ok === true, 'marker-only body passes (draft)');
  check(validateCreatorNextStage5({ creator: MARKER, class: 'fighter' }).ok === true, 'class-only body passes (draft)');
  check(validateCreatorNextStage5({ creator: MARKER, class: 'fighter', gear_choice: 'packages' }).ok === true,
    'packages choice with no package yet passes (draft)');
  check(validateCreatorNextStage5({ creator: MARKER, class: 'fighter', gear_choice: 'packages', package_id: 'A' }).ok === true,
    'fighter package A passes');
  check(validateCreatorNextStage5({ creator: MARKER, class: 'fighter', gear_choice: 'packages', package_id: 'B' }).ok === true,
    'fighter package B passes');
  check(validateCreatorNextStage5({ creator: MARKER, class: 'fighter', gear_choice: 'gold' }).ok === true,
    'fighter gold fork passes (baseline 155)');
  const badGear = validateCreatorNextStage5({ creator: MARKER, class: 'fighter', gear_choice: 'stuff' });
  check(badGear.ok === false && errOf({ json: { error: badGear.errors.join('; ') } }).includes('gearChoice:'),
    `bad gear_choice refuses naming gearChoice (got ${badGear.errors.join('; ')})`);
  const unknownOpt = validateCreatorNextStage5({ creator: MARKER, class: 'fighter', gear_choice: 'packages', package_id: 'Z' });
  check(unknownOpt.ok === false && unknownOpt.errors.join(' ').includes('packageId:'),
    `unknown package option refuses naming packageId (got ${unknownOpt.errors.join('; ')})`);
  const mismatch = validateCreatorNextStage5({ creator: MARKER, class: 'fighter', gear_choice: 'gold', package_id: 'A' });
  check(mismatch.ok === false && mismatch.errors.join(' ').includes('packageId:'),
    `gold fork with a package id refuses naming packageId (got ${mismatch.errors.join('; ')})`);
  // Gold-for-null-baseline: all six source-silent classes refuse,
  // each naming the class.
  for (const cls of ['blackguard', 'magus', 'pugilist', 'scholar', 'spellshot', 'warden']) {
    const r = validateCreatorNextStage5({ creator: MARKER, class: cls, gear_choice: 'gold' });
    check(r.ok === false && r.errors.join(' ').includes('gearChoice:') && r.errors.join(' ').includes(`'${cls}'`),
      `${cls} gold fork refuses naming gearChoice + class (got ${r.errors.join('; ')})`);
    check(STARTING_PACKAGES[cls]?.goldOption == null, `${cls} goldOption is null (source-silent)`);
  }
  // Package picks: valid, out-of-category, stale-branch, unknown,
  // partial (draft), and the real resolver's grant-once rule.
  const lute = validateCreatorNextStage5({ creator: MARKER, class: 'bard', gear_choice: 'packages', package_id: 'A', package_picks: J({ instrument: ['Lute'] }) });
  check(lute.ok === true, `bard instrument Lute passes (${lute.errors.join('; ')})`);
  const badPick = validateCreatorNextStage5({ creator: MARKER, class: 'bard', gear_choice: 'packages', package_id: 'A', package_picks: J({ instrument: ['Longsword'] }) });
  check(badPick.ok === false && badPick.errors.join(' ').includes('picks.instrument'),
    `bard instrument Longsword refuses naming picks.instrument (got ${badPick.errors.join('; ')})`);
  // Blackguard A, complete picks (alt 0: martial weapon + Shield):
  // c1a is the nested martial pick inside alternative 0.
  const bgPicks = { c1: { alternative: 0 }, c1a: ['Warhammer'], c2: { alternative: 0 }, c3: { alternative: 0 }, holy: { alternative: 0 } };
  const bgValid = validateCreatorNextStage5({ creator: MARKER, class: 'blackguard', gear_choice: 'packages', package_id: 'A', package_picks: J(bgPicks) });
  check(bgValid.ok === true, `blackguard complete picks pass (${bgValid.errors.join('; ')})`);
  // Out-of-category: a simple weapon where a martial is required.
  const bgBad = validateCreatorNextStage5({ creator: MARKER, class: 'blackguard', gear_choice: 'packages', package_id: 'A', package_picks: J({ ...bgPicks, c1a: ['Club'] }) });
  check(bgBad.ok === false && bgBad.errors.join(' ').includes('picks.c1a'),
    `blackguard martial pick Club refuses naming picks.c1a (got ${bgBad.errors.join('; ')})`);
  // Stale branch: c1b answers the alternative NOT taken (alt 0 was).
  const bgStale = validateCreatorNextStage5({ creator: MARKER, class: 'blackguard', gear_choice: 'packages', package_id: 'A', package_picks: J({ ...bgPicks, c1b: ['Battleaxe', 'Longsword'] }) });
  check(bgStale.ok === false && bgStale.errors.join(' ').includes('picks.c1b'),
    `blackguard stale-branch c1b refuses naming picks.c1b (got ${bgStale.errors.join('; ')})`);
  // Unknown pick key refuses even in an otherwise-complete set.
  const bgUnknown = validateCreatorNextStage5({ creator: MARKER, class: 'blackguard', gear_choice: 'packages', package_id: 'A', package_picks: J({ ...bgPicks, bogus: ['Lute'] }) });
  check(bgUnknown.ok === false && bgUnknown.errors.join(' ').includes('picks.bogus'),
    `blackguard unknown pick key refuses naming picks.bogus (got ${bgUnknown.errors.join('; ')})`);
  // Partial picks are a draft, never a refusal — the resolver would
  // fail on the missing choice, but the validator only judges a
  // complete set (the hard gate is Review / Stage 6).
  const bgPartial = validateCreatorNextStage5({ creator: MARKER, class: 'blackguard', gear_choice: 'packages', package_id: 'A', package_picks: J({ c1: { alternative: 0 } }) });
  check(bgPartial.ok === true, `blackguard partial picks pass (draft — ${bgPartial.errors.join('; ')})`);
  // Monk nested choice: the nested key is required only when its
  // alternative is taken; without it the set is a draft.
  const monkPartial = validateCreatorNextStage5({ creator: MARKER, class: 'monk', gear_choice: 'packages', package_id: 'A', package_picks: J({ toolOrInstrument: { alternative: 0 } }) });
  check(monkPartial.ok === true, `monk nested pick missing passes (draft — ${monkPartial.errors.join('; ')})`);
  const monkFull = validateCreatorNextStage5({ creator: MARKER, class: 'monk', gear_choice: 'packages', package_id: 'A', package_picks: J({ toolOrInstrument: { alternative: 0 }, tool: ["Smith's Tools"] }) });
  check(monkFull.ok === true, `monk nested tool pick passes (${monkFull.errors.join('; ')})`);
  // Grant-once (real resolver): a pick naming an already-granted
  // item is given once, at the greater quantity — keeper grants
  // Dagger x2 fixed, so picking Dagger resolves to Dagger x2, not x3.
  const keeperDup = resolvePackage('keeper', 'A', { c1: { alternative: 1 }, c1b: ['Dagger'], c2: { alternative: 0 } });
  check(keeperDup.ok === true, `keeper Dagger pick resolves ok (${keeperDup.errors.map((e) => e.message).join('; ')})`);
  check(keeperDup.items.find((it) => it.name === 'Dagger')?.quantity === 2,
    `keeper grant-once: Dagger quantity is 2, not 3 (got ${JSON.stringify(keeperDup.items)})`);
  // Same name twice in one count-2 pick SUMS (two physical items).
  const bhDup = resolvePackage('blood_hunter', 'A', { weapons: ['Longsword', 'Longsword'] });
  check(bhDup.ok === true, `blood hunter double Longsword resolves ok (${bhDup.errors.map((e) => e.message).join('; ')})`);
  check(bhDup.items.find((it) => it.name === 'Longsword')?.quantity === 2,
    `blood hunter same pick twice sums to 2 (got ${JSON.stringify(bhDup.items)})`);
  const malformed = validateCreatorNextStage5({ creator: MARKER, class: 'fighter', gear_choice: 'packages', package_id: 'A', package_picks: '{oops' });
  check(malformed.ok === false && malformed.errors.join(' ').includes('packagePicks:'),
    `malformed package_picks JSON refuses naming packagePicks (got ${malformed.errors.join('; ')})`);
  const noClass = validateCreatorNextStage5({ creator: MARKER, gear_choice: 'packages', package_id: 'A' });
  check(noClass.ok === true, 'package id with no class yet passes (draft — Stage 2 owns the class)');
}

// (a2) Client nested picks shape (2026-11-07 integration fix) ------
// The client keeps picks nested per option card — package_picks =
// { [optionId]: { <choiceKey>: <pick> } } — and sends that whole
// object as a JSON string (Stage5GearStory.jsx, stage1Persistence.js).
// The resolver's contract is flat, keyed by choice key. The server
// unwraps the single-key nesting in validate + derive (knows
// package_id); the resolver itself is untouched. A nested shape that
// reached the resolver raw 400d the marker POST with `picks.holy:
// Choose one option` + `picks.A: Unknown pick "A"`.
group('(a2) Client nested picks shape (unwrap at the seam)');
{
  const clericBody = { creator: MARKER, class: 'cleric', gear_choice: 'packages', package_id: 'A' };
  const nestedCleric = validateCreatorNextStage5({ ...clericBody, package_picks: J({ A: { holy: { alternative: 0 } } }) });
  check(nestedCleric.ok === true, `nested cleric picks pass the validator (${nestedCleric.errors.join('; ')})`);
  const nestedBard = validateCreatorNextStage5({ creator: MARKER, class: 'bard', gear_choice: 'packages', package_id: 'A', package_picks: J({ A: { instrument: ['Lute'] } }) });
  check(nestedBard.ok === true, `nested bard picks pass the validator (${nestedBard.errors.join('; ')})`);
  const nestedUnknown = validateCreatorNextStage5({ ...clericBody, package_picks: J({ A: { bogus: ['Lute'] } }) });
  check(nestedUnknown.ok === false && nestedUnknown.errors.join(' ').includes('picks.bogus'),
    `nested unknown inner key still refuses naming picks.bogus (got ${nestedUnknown.errors.join('; ')})`);
  const wrongOption = validateCreatorNextStage5({ ...clericBody, package_picks: J({ B: { holy: { alternative: 0 } } }) });
  check(wrongOption.ok === false && wrongOption.errors.join(' ').includes('picks.B'),
    `picks nested under the wrong option id still refuse naming picks.B (got ${wrongOption.errors.join('; ')})`);
  const nestedNonObject = validateCreatorNextStage5({ ...clericBody, package_picks: J({ A: 'Lute' }) });
  check(nestedNonObject.ok === false && nestedNonObject.errors.join(' ').includes('picks.A'),
    `a non-object nested value is not unwrapped and still refuses naming picks.A (got ${nestedNonObject.errors.join('; ')})`);
  // Route: nested shape POST 201s and resolves (derive unwraps too).
  const nested = await postFull('S5 Nested Cleric', dwarfClericBody(), { gear_choice: 'packages', package_id: 'A', package_picks: J({ A: { holy: { alternative: 0 } } }) });
  check(nested.status === 201, `nested-shape POST creates 201 (got ${nested.status}: ${errOf(nested)})`);
  const nestedRow = await readCharacter(nested.json?.id);
  check(nestedRow?.gold_gp === 7, `nested POST derives cleric A gold 7 (got ${nestedRow?.gold_gp})`);
  check(parseCol(nestedRow, 'inventory').some((it) => it.name === 'Amulet' && it.source === 'stage5-package'),
    `nested POST resolves the holy pick to an Amulet (got ${JSON.stringify(parseCol(nestedRow, 'inventory').map((i) => i.name))})`);
  check(nestedRow?.armor_class === 15, `nested POST derives AC 15 (Chain Shirt 13 + Shield 2, Dex 0; got ${nestedRow?.armor_class})`);
  // Route: flat shape POST 201s (back-compat — the resolver contract).
  const flat = await postFull('S5 Flat Cleric', dwarfClericBody(), { gear_choice: 'packages', package_id: 'A', package_picks: J({ holy: { alternative: 0 } }) });
  check(flat.status === 201, `flat-shape POST creates 201 (got ${flat.status}: ${errOf(flat)})`);
  const flatRow = await readCharacter(flat.json?.id);
  check(flatRow?.gold_gp === 7 && parseCol(flatRow, 'inventory').some((it) => it.name === 'Amulet'),
    `flat POST resolves the same (gold ${flatRow?.gold_gp}, Amulet in inventory)`);
  // Route: an unknown key is still refused, nested or flat.
  const badNested = await postFull('S5 Nested Unknown', dwarfClericBody(), { gear_choice: 'packages', package_id: 'A', package_picks: J({ A: { bogus: ['Lute'] } }) });
  check(badNested.status === 400, `nested unknown-key POST refuses 400 (got ${badNested.status})`);
  check(errOf(badNested).includes('picks.bogus'), `nested unknown-key refusal names picks.bogus (got ${errOf(badNested)})`);
  check(await characterCountByName('S5 Nested Unknown') === 0, 'refused nested POST created no row');
}

// (b) Gold fork arithmetic -----------------------------------------
group('(b) Gold fork arithmetic');
{
  // Theme table verbatim: 21 values, same formula as the client.
  check(Object.keys(THEME_GOLD_MODIFIERS).length === 21, `theme table has 21 values (got ${Object.keys(THEME_GOLD_MODIFIERS).length})`);
  check(applyGoldModifier(100, 'noble') === 150, 'noble +50%: 100 -> 150');
  check(applyGoldModifier(100, 'urchin') === 50, 'urchin −50%: 100 -> 50');
  check(applyGoldModifier(100, 'soldier') === 100, 'soldier 0%: 100 -> 100');
  check(applyGoldModifier(100, 'hermit') === 65, 'hermit −35%: 100 -> 65');
  check(applyGoldModifier(100, 'unknown-theme') === 100, 'unknown theme modifies by 0');
  // computeGoldFork mirrors applyGoldModifier at every theme for a
  // class with a baseline, and fails (ok false, baseline null) for
  // the six without one. It returns { ok, gold, baseline, ... } —
  // never a bare number.
  for (const themeId of Object.keys(THEME_GOLD_MODIFIERS)) {
    const fork = computeGoldFork('fighter', themeId, THEME_GOLD_MODIFIERS[themeId]);
    check(fork.ok === true && fork.gold === applyGoldModifier(155, themeId),
      `fighter gold fork at ${themeId} is ${applyGoldModifier(155, themeId)} (got ${JSON.stringify(fork)})`);
  }
  for (const cls of ['blackguard', 'magus', 'pugilist', 'scholar', 'spellshot', 'warden']) {
    const fork = computeGoldFork(cls, 'soldier', 0);
    check(fork.ok === false && fork.baseline === null, `computeGoldFork(${cls}) fails with null baseline (got ${JSON.stringify(fork)})`);
  }
  check(computeGoldFork('ranger', 'soldier', 0).gold === 150, 'ranger gold fork is the fixed 150');
  check(computeGoldFork('cleric', 'noble', 0.5).gold === 165, 'cleric noble: round(110 x 1.5) = 165');
  check(computeGoldFork('cleric', 'urchin', -0.5).gold === 55, 'cleric urchin: round(110 x 0.5) = 55');
  check(computeGoldFork('fighter', 'noble', 0.5).gold === 233, 'fighter noble: round(155 x 1.5) = 233 (half-up)');
}

// (c) Gold fork at save (route) ------------------------------------
group('(c) Gold fork at save (route)');
{
  const noble = await postFull('S5 Gold Noble', clericBodyForTheme('noble'), { gear_choice: 'gold' });
  check(noble.status === 201, `noble cleric gold POST creates 201 (got ${noble.status}: ${errOf(noble)})`);
  const nobleRow = await readCharacter(noble.json?.id);
  check(nobleRow.gold_gp === 165, `noble cleric gold_gp is 165 (got ${nobleRow.gold_gp})`);
  check(nobleRow.starting_gold_gp === 165, `noble cleric starting_gold_gp mirrors 165 (got ${nobleRow.starting_gold_gp})`);
  check(nobleRow.max_hp === 10, `noble cleric HP derives 8 + Con 2 = 10 (noble grants no Con; got ${nobleRow.max_hp})`);
  check(nobleRow.current_hp === 10, `noble cleric current_hp derives 10 (got ${nobleRow.current_hp})`);
  check(nobleRow.armor_class === 10, `noble cleric gold fork (no armor) AC is 10 + Dex 0 = 10 (got ${nobleRow.armor_class})`);
  check(nobleRow.speed === 25, `noble cleric speed derives dwarf 25 (got ${nobleRow.speed})`);
  check(nobleRow.inventory === '[]', `gold fork leaves inventory empty (got ${nobleRow.inventory})`);
  const urchin = await postFull('S5 Gold Urchin', clericBodyForTheme('urchin'), { gear_choice: 'gold' });
  check(urchin.status === 201, `urchin cleric gold POST creates 201 (got ${urchin.status}: ${errOf(urchin)})`);
  const urchinRow = await readCharacter(urchin.json?.id);
  check(urchinRow.gold_gp === 55, `urchin cleric gold_gp is 55 (got ${urchinRow.gold_gp})`);
  check(urchinRow.starting_gold_gp === 55, `urchin cleric starting_gold_gp mirrors 55 (got ${urchinRow.starting_gold_gp})`);
  const soldier = await postFull('S5 Gold Soldier', clericBodyForTheme('soldier'), { gear_choice: 'gold' });
  check(soldier.status === 201, `soldier cleric gold POST creates 201 (got ${soldier.status}: ${errOf(soldier)})`);
  const soldierRow = await readCharacter(soldier.json?.id);
  check(soldierRow.gold_gp === 110, `soldier cleric gold_gp is the 110 baseline (got ${soldierRow.gold_gp})`);
  // Null-baseline refusal at the route: seed the blackguard with
  // no gear (direct insert — the POST guard refuses blackguard
  // PCs now), then PUT the gold fork — 400, row unchanged.
  const bgId = await seedBlackguardRow('S5 Blackguard Base');
  check(Number.isInteger(bgId) && bgId > 0, `blackguard base row seeded directly (legacy row — the POST guard refuses blackguard, got id ${bgId})`);
  const bgBefore = await readCharacter(bgId);
  const bgGold = await putCharacter(bgId, { creator: MARKER, gear_choice: 'gold' });
  check(bgGold.status === 400, `blackguard gold PUT refuses 400 (got ${bgGold.status})`);
  check(errOf(bgGold).includes('gearChoice:') && errOf(bgGold).includes('blackguard'),
    `blackguard gold refusal names gearChoice + class (got ${errOf(bgGold)})`);
  const bgAfter = await readCharacter(bgId);
  check(bgAfter.gold_gp === bgBefore.gold_gp && bgAfter.max_hp === bgBefore.max_hp,
    'refused gold PUT left the blackguard row unchanged');
  // Non-marker bodies skip the Stage 5 gate entirely (same marker
  // rule as Stages 2–4): a fighter gold POST without the marker
  // creates. (The class is incidental here — the blackguard variant
  // of this body now 400s on the class guard, marker or not, which
  // mvp-class-scope pins; the marker rule itself is pinned with a
  // PC class.)
  const noMarker = await postCharacter({ name: 'S5 NoMarker Gold', race: 'dwarf', subrace: 'Hill Dwarf', class: 'fighter', gear_choice: 'gold' });
  check(noMarker.status === 201, `no-marker fighter gold POST still creates 201 (got ${noMarker.status}: ${errOf(noMarker)})`);
  check(await characterCountByName('S5 NoMarker Gold') === 1, 'no-marker bad body created exactly one row');
  // Marker-gate static guard: Stage 5 reuses the two existing gates.
  const routeSrc = readRepo('server/routes/character.js');
  const gates = (routeSrc.match(/req\.body\.creator === 'creator-next'/g) || []).length;
  check(gates === 2, `POST and PUT carry exactly 2 marker gates (found ${gates})`);
  const stage5Calls = (routeSrc.match(/validateCreatorNextStage5\(req\.body/g) || []).length;
  check(stage5Calls === 2, `Stage 5 validator is called from POST and PUT (found ${stage5Calls})`);
}

// (d) HP derivation (route + floor unit) ---------------------------
group('(d) HP derivation');
{
  // Fighter: d10 + Con 3 = 13.
  const f = await postFull('S5 HP Fighter', dwarfFighterBody(), { gear_choice: 'packages', package_id: 'B' });
  check(f.status === 201, `fighter package POST creates 201 (got ${f.status}: ${errOf(f)})`);
  const fRow = await readCharacter(f.json?.id);
  check(fRow.max_hp === 13, `fighter HP is d10 + Con 3 = 13 (got ${fRow.max_hp})`);
  check(fRow.current_hp === 13, `fighter current_hp is 13 (got ${fRow.current_hp})`);
  // Warlord: d8 (explicit HIT_DICE entry, not the fallback) + Con 3.
  const w = await postFull('S5 HP Warlord', dwarfWarlordBody(), { gear_choice: 'gold' });
  check(w.status === 201, `warlord gold POST creates 201 (got ${w.status}: ${errOf(w)})`);
  const wRow = await readCharacter(w.json?.id);
  check(wRow.max_hp === 11, `warlord HP is d8 + Con 3 = 11 (got ${wRow.max_hp})`);
  check(wRow.gold_gp === 125, `warlord gold fork is 125 (got ${wRow.gold_gp})`);
  // Wizard: d6 + Con 1 = 7.
  const wiz = await postFull('S5 HP Wizard', woodElfWizardBody(), { gear_choice: 'packages', package_id: 'A' });
  check(wiz.status === 201, `wizard package POST creates 201 (got ${wiz.status}: ${errOf(wiz)})`);
  const wizRow = await readCharacter(wiz.json?.id);
  check(wizRow.max_hp === 7, `wizard HP is d6 + Con 1 = 7 (got ${wizRow.max_hp})`);
  // PUT never clobbers a non-zero max_hp: create with max_hp 20,
  // then save gear — HP stays 20.
  const preset = await postFull('S5 HP Preset', dwarfFighterBody(), { gear_choice: 'packages', package_id: 'B', max_hp: 20, current_hp: 20 });
  check(preset.status === 201, `preset-HP fighter POST creates 201 (got ${preset.status}: ${errOf(preset)})`);
  const presetRow = await readCharacter(preset.json?.id);
  check(presetRow.max_hp === 20, `preset max_hp stays 20 at POST (got ${presetRow.max_hp})`);
  const presetPut = await putCharacter(preset.json?.id, { creator: MARKER, gear_choice: 'packages', package_id: 'A' });
  check(presetPut.status === 200, `preset-HP gear PUT is 200 (got ${presetPut.status}: ${errOf(presetPut)})`);
  const presetAfter = await readCharacter(preset.json?.id);
  check(presetAfter.max_hp === 20 && presetAfter.current_hp === 20,
    `PUT with non-zero max_hp leaves HP at 20/20 (got ${presetAfter.max_hp}/${presetAfter.current_hp})`);
  // PUT derives HP when the stored max_hp is 0 (the normal draft).
  const draft = await postFull('S5 HP Draft', dwarfFighterBody());
  check(draft.status === 201, `draft fighter POST creates 201 (got ${draft.status}: ${errOf(draft)})`);
  check((await readCharacter(draft.json?.id)).max_hp === 0, 'draft fighter stores max_hp 0 before any gear save');
  const draftPut = await putCharacter(draft.json?.id, { creator: MARKER, gear_choice: 'packages', package_id: 'A' });
  check(draftPut.status === 200, `draft gear PUT is 200 (got ${draftPut.status}: ${errOf(draftPut)})`);
  const draftRow = await readCharacter(draft.json?.id);
  check(draftRow.max_hp === 13 && draftRow.current_hp === 13,
    `PUT derives HP 13/13 from stored max_hp 0 (got ${draftRow.max_hp}/${draftRow.current_hp})`);
  // Min-1 floor (unit only: no legal L1 body reaches it — the lowest
  // legal Con still yields HP >= 2 — so the floor is pinned by a
  // direct call with an out-of-range Con, exercising max(1, ...) and
  // nothing else).
  const floor = deriveCreatorNextStage5(
    { class: 'wizard', race: 'human', ability_scores: { str: 8, dex: 10, con: -2, int: 10, wis: 10, cha: 10 }, gear_choice: 'gold' },
    {}, { isPost: true }
  );
  check(floor.maxHp === 1 && floor.currentHp === 1, `HP floor: d6 + Con -6 clamps to 1 (got ${floor.maxHp})`);
  // Incomplete data derives nothing: no scores, no class, no race.
  const incomplete = deriveCreatorNextStage5({ class: 'fighter', race: 'dwarf', gear_choice: 'packages', package_id: 'A' }, {}, { isPost: true });
  check(incomplete.maxHp === null && incomplete.armorClass === null && incomplete.goldGp === null,
    'derivation without final scores derives nothing (draft)');
}

// (e) AC derivation (route) ----------------------------------------
group('(e) AC derivation');
{
  // Heavy: fighter A Chain Mail 16, Dex ignored, no shield.
  const heavy = await postFull('S5 AC Heavy', dwarfFighterBody(), { gear_choice: 'packages', package_id: 'A' });
  check(heavy.status === 201, `fighter A POST creates 201 (got ${heavy.status}: ${errOf(heavy)})`);
  const heavyRow = await readCharacter(heavy.json?.id);
  check(heavyRow.armor_class === 16, `Chain Mail AC is flat 16 (got ${heavyRow.armor_class})`);
  check(heavyRow.gold_gp === 4, `fighter A package gold is 4 (got ${heavyRow.gold_gp})`);
  // Light: fighter B Studded Leather 12 + Dex 0.
  const light = await postFull('S5 AC Light', dwarfFighterBody(), { gear_choice: 'packages', package_id: 'B' });
  check(light.status === 201, `fighter B POST creates 201 (got ${light.status}: ${errOf(light)})`);
  const lightRow = await readCharacter(light.json?.id);
  check(lightRow.armor_class === 12, `Studded Leather AC is 12 + Dex 0 = 12 (got ${lightRow.armor_class})`);
  check(lightRow.gold_gp === 11, `fighter B package gold is 11 (got ${lightRow.gold_gp})`);
  // Medium + shield, Dex capped at +2: manual Dex-16 cleric,
  // Chain Shirt 13 + 2 + Shield 2 = 17. (Holy Symbol is a pick in
  // the real package — Amulet, alternative 0.)
  const med = await postFull('S5 AC Medium', manualDexClericBody(), { gear_choice: 'packages', package_id: 'A', package_picks: J({ holy: { alternative: 0 } }) });
  check(med.status === 201, `medium cleric POST creates 201 (got ${med.status}: ${errOf(med)})`);
  const medRow = await readCharacter(med.json?.id);
  check(medRow.armor_class === 17, `Chain Shirt + Shield AC is 13 + min(Dex 3, 2) + 2 = 17 (got ${medRow.armor_class})`);
  check(medRow.gold_gp === 7, `cleric A package gold is 7 (got ${medRow.gold_gp})`);
  // The equipment-source AC path agrees with the column: the slots
  // Stage 5 populates are what combat actually reads.
  const medCombat = await getPlayerCombatAc(med.json?.id);
  check(medCombat?.ac === 17 && medCombat?.source === 'equipment',
    `equipment-source AC agrees at 17 (got ${JSON.stringify(medCombat)})`);
  const heavyCombat = await getPlayerCombatAc(heavy.json?.id);
  check(heavyCombat?.ac === 16 && heavyCombat?.source === 'equipment',
    `fighter equipment-source AC agrees at 16 (got ${JSON.stringify(heavyCombat)})`);
  // No armor: wood-elf wizard, 10 + Dex 3 = 13.
  const none = await postFull('S5 AC None', woodElfWizardBody(), { gear_choice: 'packages', package_id: 'A' });
  check(none.status === 201, `wizard POST creates 201 (got ${none.status}: ${errOf(none)})`);
  const noneRow = await readCharacter(none.json?.id);
  check(noneRow.armor_class === 13, `no-armor AC is 10 + Dex 3 = 13 (got ${noneRow.armor_class})`);
  // Light with full Dex: human rogue, Leather 11 + Dex 3 = 14.
  const rogue = await postFull('S5 AC Rogue', humanRogueBody(), { gear_choice: 'packages', package_id: 'A' });
  check(rogue.status === 201, `rogue POST creates 201 (got ${rogue.status}: ${errOf(rogue)})`);
  const rogueRow = await readCharacter(rogue.json?.id);
  check(rogueRow.armor_class === 14, `Leather AC is 11 + Dex 3 = 14 (got ${rogueRow.armor_class})`);
  check(rogueRow.gold_gp === 8, `rogue A package gold is 8 (got ${rogueRow.gold_gp})`);
}

// (f) Speed derivation (route) -------------------------------------
group('(f) Speed derivation');
{
  const dwarf = await postFull('S5 Speed Dwarf', dwarfFighterBody(), { gear_choice: 'packages', package_id: 'B' });
  const dwarfRow = await readCharacter(dwarf.json?.id);
  check(dwarfRow.speed === 25, `dwarf speed derives 25, not the 30 default (got ${dwarfRow.speed})`);
  const human = await postFull('S5 Speed Human', humanRogueBody(), { gear_choice: 'packages', package_id: 'A' });
  const humanRow = await readCharacter(human.json?.id);
  check(humanRow.speed === 30, `human speed derives 30 (got ${humanRow.speed})`);
  const elf = await postFull('S5 Speed Elf', woodElfWizardBody(), { gear_choice: 'packages', package_id: 'A' });
  const elfRow = await readCharacter(elf.json?.id);
  check(elfRow.speed === 35, `wood elf speed derives 35 (got ${elfRow.speed})`);
  // Armor Str rule: Str 12 in Chain Mail (Str 13) -> dwarf 25 − 10.
  const weak = await postFull('S5 Speed StrRule', manualWeakStrFighterBody(), { gear_choice: 'packages', package_id: 'A' });
  check(weak.status === 201, `weak-Str fighter POST creates 201 (got ${weak.status}: ${errOf(weak)})`);
  const weakRow = await readCharacter(weak.json?.id);
  check(weakRow.speed === 15, `Str 12 in Chain Mail: speed 25 − 10 = 15 (got ${weakRow.speed})`);
  check(weakRow.armor_class === 16, `weak-Str fighter AC is still Chain Mail 16 (got ${weakRow.armor_class})`);
  // Str met: the same armor at Str 14 keeps 25 (fighter A above).
  const strongRow = await readCharacter((await postFull('S5 Speed StrMet', dwarfFighterBody(), { gear_choice: 'packages', package_id: 'A' })).json?.id);
  check(strongRow.speed === 25, `Str 14 in Chain Mail: speed stays 25 (got ${strongRow.speed})`);
}

// (g) Inventory / equipment shapes (route) -------------------------
group('(g) Inventory / equipment shapes');
{
  const f = await postFull('S5 Inv Fighter', dwarfFighterBody(), { gear_choice: 'packages', package_id: 'A' });
  const fRow = await readCharacter(f.json?.id);
  const inv = parseCol(fRow, 'inventory');
  check(Array.isArray(inv), 'fighter A inventory is a JSON array');
  check(inv.every((it) => it && typeof it === 'object' && it.source === 'stage5-package' && typeof it.name === 'string' && Number.isInteger(it.quantity)),
    `every inventory item carries source 'stage5-package' + name + quantity (got ${JSON.stringify(inv)})`);
  const invNames = inv.map((it) => it.name);
  check(invNames.includes('Greatsword') && invNames.includes('Flail') && invNames.includes('Javelin') && invNames.includes("Dungeoneer's Pack"),
    `weapons + pack land in inventory (got ${JSON.stringify(invNames)})`);
  check(!invNames.includes('Chain Mail'), 'armor does NOT land in inventory (it fills the equipment slot)');
  check(inv.find((it) => it.name === 'Javelin')?.quantity === 8, 'Javelin quantity is 8');
  const eq = parseCol(fRow, 'equipment');
  check(eq && typeof eq === 'object' && !Array.isArray(eq), 'equipment is a JSON object of slots');
  check(eq.armor?.name === 'Chain Mail' && eq.armor?.source === 'stage5-package',
    `equipment.armor is Chain Mail (got ${JSON.stringify(eq.armor)})`);
  check(eq.mainHand === undefined, 'mainHand is NOT set (weapons live in inventory)');
  check(eq.offHand === undefined, 'fighter A has no shield, so offHand stays unset');
  // Cleric A: Shield -> offHand, Chain Shirt -> armor. (Holy Symbol
  // is a pick in the real package — Amulet, alternative 0.)
  const c = await postFull('S5 Inv Cleric', dwarfClericBody(), { gear_choice: 'packages', package_id: 'A', package_picks: J({ holy: { alternative: 0 } }) });
  const cRow = await readCharacter(c.json?.id);
  const cEq = parseCol(cRow, 'equipment');
  check(cEq.armor?.name === 'Chain Shirt', `cleric equipment.armor is Chain Shirt (got ${JSON.stringify(cEq.armor)})`);
  check(cEq.offHand?.name === 'Shield', `cleric equipment.offHand is Shield (got ${JSON.stringify(cEq.offHand)})`);
  const cInvNames = parseCol(cRow, 'inventory').map((it) => it.name);
  check(!cInvNames.includes('Shield') && !cInvNames.includes('Chain Shirt'),
    `shield + armor are NOT in inventory (got ${JSON.stringify(cInvNames)})`);
  check(cInvNames.includes('Mace') && cInvNames.includes('Amulet') && cInvNames.includes("Priest's Pack"),
    `cleric weapons + focus + pack land in inventory (got ${JSON.stringify(cInvNames)})`);
  // Bard A with a pick: the chosen instrument resolves into inventory.
  const b = await postFull('S5 Inv Bard', dwarfBardBody(), { gear_choice: 'packages', package_id: 'A', package_picks: J({ instrument: ['Lute'] }) });
  check(b.status === 201, `bard A + Lute POST creates 201 (got ${b.status}: ${errOf(b)})`);
  const bRow = await readCharacter(b.json?.id);
  const bInv = parseCol(bRow, 'inventory');
  check(bInv.some((it) => it.name === 'Lute' && it.source === 'stage5-package'),
    `chosen Lute resolves into inventory (got ${JSON.stringify(bInv.map((i) => i.name))})`);
  check(parseCol(bRow, 'equipment').armor?.name === 'Leather',
    `bard equipment.armor is Leather (canonical 2024 name — what calculateCombatStats resolves; got ${JSON.stringify(parseCol(bRow, 'equipment').armor)})`);
  // Re-save replaces package items but keeps sheet-added ones: add
  // a Rope via a plain (non-marker) PUT, then re-save package B.
  const r = await postFull('S5 Inv Resave', dwarfFighterBody(), { gear_choice: 'packages', package_id: 'A' });
  const rId = r.json?.id;
  const sheetPut = await putCharacter(rId, { inventory: J([{ name: 'Rope', quantity: 1, equipped: false }, ...parseCol(await readCharacter(rId), 'inventory')]) });
  check(sheetPut.status === 200, `sheet-style inventory PUT is 200 (got ${sheetPut.status})`);
  const resave = await putCharacter(rId, { creator: MARKER, gear_choice: 'packages', package_id: 'B' });
  check(resave.status === 200, `package B re-save PUT is 200 (got ${resave.status}: ${errOf(resave)})`);
  const rRow = await readCharacter(rId);
  const rInv = parseCol(rRow, 'inventory');
  check(rInv.some((it) => it.name === 'Rope'), 'sheet-added Rope survives the package re-save');
  check(!rInv.some((it) => it.name === 'Greatsword'), 'old package Greatsword is replaced by the re-save');
  check(rInv.some((it) => it.name === 'Scimitar' && it.source === 'stage5-package'), 'new package Scimitar lands with the source tag');
  check(rInv.filter((it) => it.name === 'Scimitar').length === 1, 're-save does not duplicate the Scimitar');
  check(parseCol(rRow, 'equipment').armor?.name === 'Studded Leather', `re-save swaps equipment.armor to Studded Leather (got ${JSON.stringify(parseCol(rRow, 'equipment').armor)})`);
  // Blackguard A via PUT: real picks — c1 alt 0 (martial weapon +
  // Shield), c2 alt 0 (Javelins), c3 alt 0 (Priest's Pack), holy
  // alt 0 (Amulet); Chain Mail is fixed. The row is seeded directly
  // (POST guard refuses blackguard PCs now — see seedBlackguardRow).
  const bgId = await seedBlackguardRow('S5 Inv Blackguard');
  const bgPut = await putCharacter(bgId, { creator: MARKER, gear_choice: 'packages', package_id: 'A', package_picks: J({ c1: { alternative: 0 }, c1a: ['Warhammer'], c2: { alternative: 0 }, c3: { alternative: 0 }, holy: { alternative: 0 } }) });
  check(bgPut.status === 200, `blackguard package PUT is 200 (got ${bgPut.status}: ${errOf(bgPut)})`);
  const bgRow = await readCharacter(bgId);
  const bgInvNames = parseCol(bgRow, 'inventory').map((it) => it.name);
  check(bgInvNames.includes('Warhammer'), `picked Warhammer lands in inventory (got ${JSON.stringify(bgInvNames)})`);
  check(bgInvNames.includes('Amulet') && bgInvNames.includes("Priest's Pack") && parseCol(bgRow, 'inventory').find((it) => it.name === 'Javelin')?.quantity === 5,
    `blackguard sidearm + pack + holy pick resolve (got ${JSON.stringify(bgInvNames)})`);
  check(parseCol(bgRow, 'equipment').armor?.name === 'Chain Mail', 'blackguard equipment.armor is Chain Mail');
  check(parseCol(bgRow, 'equipment').offHand?.name === 'Shield', 'blackguard equipment.offHand is Shield');
  check(bgRow.armor_class === 18, `blackguard AC is Chain Mail 16 + Shield 2 = 18 (got ${bgRow.armor_class})`);
  check(bgRow.gold_gp === 0, `blackguard A package gold is 0 (got ${bgRow.gold_gp})`);
  // A refused package PUT leaves the row unchanged.
  const badBefore = await readCharacter(bgId);
  const badPut = await putCharacter(bgId, { creator: MARKER, gear_choice: 'packages', package_id: 'Z' });
  check(badPut.status === 400, `unknown-option PUT refuses 400 (got ${badPut.status})`);
  check(errOf(badPut).includes('packageId:'), `unknown-option refusal names packageId (got ${errOf(badPut)})`);
  const badAfter = await readCharacter(bgId);
  check(badAfter.inventory === badBefore.inventory && badAfter.gold_gp === badBefore.gold_gp,
    'refused package PUT left inventory + gold unchanged');
  // A gear-only draft PUT (choice, no package yet) is a real update,
  // not a 'No valid fields' 400 — and derives what it can.
  const draftOnly = await putCharacter(bgId, { creator: MARKER, gear_choice: 'packages' });
  check(draftOnly.status === 200, `gear-only draft PUT is 200 (got ${draftOnly.status}: ${errOf(draftOnly)})`);
}

// (h) /api/themes serves the gold modifier -------------------------
group('(h) /api/themes serves goldModifier');
{
  const res = await getThemes();
  check(res.status === 200, `GET /api/themes is 200 (got ${res.status})`);
  const themes = res.json?.themes || [];
  check(themes.length === 21, `GET /api/themes serves 21 themes (got ${themes.length})`);
  check(themes.every((t) => typeof t.goldModifier === 'number'),
    'every served theme carries a numeric goldModifier');
  const byId = Object.fromEntries(themes.map((t) => [t.id, t.goldModifier]));
  check(byId.noble === 0.5 && byId.urchin === -0.5 && byId.soldier === 0,
    `noble 0.5 / urchin -0.5 / soldier 0 (got ${byId.noble}/${byId.urchin}/${byId.soldier})`);
  check(themes.every((t) => t.goldModifier === (THEME_GOLD_MODIFIERS[t.id] ?? 0)),
    'served goldModifier matches the server table for every theme');
  check(themes.every((t) => typeof t.origin_feat === 'string' && Array.isArray(t.abilities)),
    'toClientShape still serves the Stage 3 fields alongside goldModifier');
}

server.close();
console.log(`=== Results: ${passed} passed, ${failed} failed ===`);
process.exit(failed ? 1 : 0);
