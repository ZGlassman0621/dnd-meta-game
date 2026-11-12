// tests/creator-next-stage4.test.js — creator-next Stage 4
// ("Abilities, Skills, & Spells") build (Zach, 2026-11-06).
//
// What this build wires in (sources: stage4-build/server/notes.md
// §1–§3 and stage4-build/client/notes.md — NOT memory):
//   - server/config/levelProgression.js: SPELLCASTING_ABILITY,
//     SPELLCASTING_ABILITY_BY_SUBCLASS, spellcastingAbilityFor,
//     getSpellsPrepared (artificer follows the 2024 book formula —
//     Int mod + half level, min 1 — Zach, 2026-11-06: the 2024 book
//     always wins; the Forge table is gone);
//   - NEW server/routes/spells.js (GET /api/spells, leveled picks
//     only, cantrips excluded) mounted in server/index.js;
//   - server/routes/character.js: exported validateCreatorNextStage4,
//     wired into POST + PUT after Stage 3; POST INSERT gains
//     prepared_spells (62 -> 63 columns; Stage 6 adds physical_build,
//     63 -> 64);
//   - client Stage4AbilitiesSkillsSpells.jsx + shell step 3 +
//     stage1Persistence.js Stage 4 fields (stringified on the wire,
//     score fields ride only when scores are complete).
//
// Expected values below are copied from the server notes §1 L1 table
// (artificer follows the 2024 book formula: Int mod + half level, min 1)
// and the smoke fixtures (dwarf/soldier cleric, half-elf
// Mark-of-Detection/sage wizard) — cross-checked live in the mirror
// before this file was written. Fixture traps (server notes §6):
// base human ASI is {} (the 2024 human has no ASI at all — PHB
// p. 194; the 2014 Standard/Variant Human entry is retired);
// dragonmark variants REPLACE the base ASI; the dwarf point-buy bases
// happen to be the standard-array multiset; list columns must be sent
// as JSON STRINGS over HTTP (raw arrays 500 at bind — pre-existing).
//
// Honest integration tests: the validator, levelProgression config,
// artificerService, species/theme services, and both routers are the
// real modules, driven over real HTTP against a real throwaway DB
// (Stage 3 harness). The Stage 4 component's pure helpers are tested
// from a real esbuild bundle of the staged JSX (group (k)), not from
// a re-implementation. If any real module were deleted, the imports
// fail and the suite fails with them. Footer is the runner-matching
// `Results:` form so the count aggregates.
import assert from 'node:assert';
import express from 'express';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

let passed = 0;
let failed = 0;
function check(condition, message) {
  if (condition) { passed++; }
  else { failed++; console.error('  ✗', message); }
}
function group(name) { console.log('\n==', name); }

const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'creator-next-stage4-test-'));
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
const { validateCreatorNextStage4 } = await import(fromRepo('server/routes/character.js'));
const levelProgression = await import(fromRepo('server/config/levelProgression.js'));
const { getSpellsKnown, getSpellsPrepared, getCantripsKnown, spellcastingAbilityFor } = levelProgression;
const speciesService = await import(fromRepo('server/services/speciesService.js'));
const { resolvedASIFor, innateSpellsFor } = speciesService;
const themeService = await import(fromRepo('server/services/themeService.js'));
const { resolveTheme } = themeService;
const artificerService = await import(fromRepo('server/services/artificerService.js'));
const { preparedSpellsForLevel } = artificerService;
const { canLearnSpell } = await import(fromRepo('server/services/spellSelectionService.js'));
const { resolveChoiceOptions, isHeldOption } = await import(fromRepo('client/src/components/creator-next/choiceOptions.js'));
const { buildStage1ProgressBody, blankStage1State } = await import(fromRepo('client/src/components/creator-next/stage1Persistence.js'));

// --- HTTP harness: the real character + spells routers on one app ----
const app = express();
app.use(express.json());
const characterRouter = (await import(fromRepo('server/routes/character.js'))).default;
const spellsRouter = (await import(fromRepo('server/routes/spells.js'))).default;
app.use('/api/character', characterRouter);
app.use('/api/spells', spellsRouter);
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
async function getSpells(query) {
  const res = await fetch(`${base}/api/spells${query}`);
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

const MARKER = 'creator-next';
const J = (v) => JSON.stringify(v); // the wire format for JSON columns: strings, not raw arrays

// --- Verified-good fixtures (server notes §6) -------------------------
// Dwarf (Hill) / soldier cleric. Point-buy bases cost exactly 27
// (12:4 + 10:2 + 13:5 + 8:0 + 15:9 + 14:7). Finals = base + Hill
// variant total {con:2, wis:1} + soldier theme {str:2, con:1}.
// Wis 16 -> mod +3 -> cleric prepares 4.
const DWARF_BASE = { str: 12, dex: 10, con: 13, int: 8, wis: 15, cha: 14 };
const DWARF_FINAL = { str: 14, dex: 10, con: 16, int: 8, wis: 16, cha: 14 };
const DWARF_PREPARED = ['bless', 'cure wounds', 'guiding bolt', 'shield of faith'];
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
// Half-elf Mark of Detection / sage wizard. Variant ASI REPLACES the
// base half-elf {cha:2, choice:2} with {wis:2, choice:1}; the one
// choice pick goes to Int. Finals = base + {wis:2} + choice int +1
// + sage theme {int:2, wis:1}. Int 18 -> mod +4 -> wizard prepares 5.
// NOTE: Detect Magic is a granted L1 innate spell for this mark, so
// it must NOT appear in the prepared list (Alarm is the 5th pick).
const MARK_BASE = { str: 8, dex: 13, con: 12, int: 15, wis: 14, cha: 10 };
const MARK_FINAL = { str: 8, dex: 13, con: 12, int: 18, wis: 17, cha: 10 };
const MARK_PREPARED = ['magic missile', 'shield', 'mage armor', 'sleep', 'alarm'];
function markWizardBody(overrides = {}) {
  return {
    creator: MARKER, class: 'wizard', race: 'half-elf', subrace: 'Mark of Detection',
    theme_id: 'sage', generation_method: 'point_buy',
    base_scores: MARK_BASE, ability_choice_picks: { int: 1 }, ability_scores: MARK_FINAL,
    skills: ['Arcana', 'History', 'Investigation'],
    languages: ['Common', 'Elvish', 'Dwarvish'],
    prepared_spells: MARK_PREPARED,
    ...overrides,
  };
}
function errText(r) { return (r.errors || []).join(' '); }

// (a) Level-1 table — getSpellsKnown / getSpellsPrepared /
// getCantripsKnown / spellcastingAbilityFor (server notes §1;
// artificer follows the 2024 book formula: Int mod + half level,
// min 1 — Zach, 2026-11-06: the 2024 book always wins).
group('(a) Level-1 per-class table (unit)');
{
  const table = [
    // [class, cantrips, known (null = prepares), prepared at mod 0, prepared at mod +3]
    // Bard (2026-11-06): bards PREPARE in 2024 (Cha mod + bard level) —
    // the 2014 known-spells row is gone from SPELLS_KNOWN.
    ['bard', 2, null, 1, 4],
    ['cleric', 3, null, 1, 4],
    ['druid', 2, null, 1, 4],
    ['sorcerer', 4, null, 2, 2],
    // Warlock (2026-11-06): warlocks PREPARE in 2024 (fixed Prepared
    // Spells column — table 2 at L1, mod-independent, same pattern
    // as the existing bard comment above).
    ['warlock', 2, null, 2, 2],
    ['wizard', 3, null, 1, 4],
    ['artificer', 2, null, 1, 3],
    ['paladin', 0, null, 2, 2],
    // Ranger (2026-11-06): rangers PREPARE in 2024 — table-driven
    // prepared column [2, 3, ...], L1 = 2 at every mod; the 2014
    // known-spells row is gone from SPELLS_KNOWN.
    ['ranger', 0, null, 2, 2],
    ['spellshot', 0, 0, null, null],
    ['magus', 2, 0, null, null],
    ['blackguard', 0, null, 0, 0],
    ['fighter', 0, null, null, null],
    ['rogue', 0, null, null, null],
    ['barbarian', 0, null, null, null],
    ['monk', 0, null, null, null],
    ['pugilist', 0, null, null, null],
    ['duelist', 0, null, null, null],
    ['keeper', 0, null, null, null],
    ['warden', 0, null, null, null],
    ['scholar', 0, null, null, null],
    ['blood_hunter', 0, null, null, null],
    ['warlord', 0, null, null, null],
  ];
  for (const [cls, cantrips, known, prep0, prep3] of table) {
    check(getCantripsKnown(cls, 1) === cantrips, `${cls} cantrips known at L1 is ${cantrips} (got ${getCantripsKnown(cls, 1)})`);
    check(getSpellsKnown(cls, 1) === known, `${cls} spells known at L1 is ${known} (got ${getSpellsKnown(cls, 1)})`);
    check(getSpellsPrepared(cls, 1, 0) === prep0, `${cls} prepared at L1 mod 0 is ${prep0} (got ${getSpellsPrepared(cls, 1, 0)})`);
    check(getSpellsPrepared(cls, 1, 3) === prep3, `${cls} prepared at L1 mod +3 is ${prep3} (got ${getSpellsPrepared(cls, 1, 3)})`);
  }
  const abilities = {
    artificer: 'int', bard: 'cha', blackguard: 'cha', cleric: 'wis', druid: 'wis',
    paladin: 'cha', ranger: 'wis', sorcerer: 'cha', spellshot: 'int', warlock: 'cha', wizard: 'int',
  };
  for (const [cls, ab] of Object.entries(abilities)) {
    check(spellcastingAbilityFor(cls) === ab, `${cls} casts with ${ab} (got ${spellcastingAbilityFor(cls)})`);
  }
  check(spellcastingAbilityFor('fighter') === null, 'fighter has no spellcasting ability');
  check(spellcastingAbilityFor('magus') === null, 'magus without a society has no single ability');
  check(spellcastingAbilityFor('magus', 'Arcane Order') === 'int', 'magus Arcane Order casts with int');
  check(spellcastingAbilityFor('magus', 'Knights Stygian') === 'cha', 'magus Knights Stygian casts with cha');
  check(spellcastingAbilityFor('magus', 'Primordial Seal') === 'cha', 'magus Primordial Seal casts with cha');
  check(spellcastingAbilityFor('magus', 'Shadow Court') === 'int', 'magus Shadow Court casts with int');
  check(spellcastingAbilityFor('magus', 'Sidereal Cabal') === 'int', 'magus Sidereal Cabal casts with int');
  check(spellcastingAbilityFor('magus', 'Sylvan Circle') === 'wis', 'magus Sylvan Circle casts with wis');
  check(spellcastingAbilityFor('warden') === null, 'warden without a casting Call has no ability');
  check(spellcastingAbilityFor('warden', 'Loreseeker') === 'int', 'warden Loreseeker casts with int');
  check(spellcastingAbilityFor('warden', 'Soulblood Shaman') === 'wis', 'warden Soulblood Shaman casts with wis');
  check(spellcastingAbilityFor('scholar') === null, 'scholar without a Field has no ability');
  check(spellcastingAbilityFor('scholar', 'Ritualist') === 'int', 'scholar Ritualist casts with int');
  check(spellcastingAbilityFor('scholar', 'Theologian') === 'int', 'scholar Theologian casts with int');
  // The L1 counts are only as rich as the catalog's class tags
  // (server notes §4.6) — spot-check the gate itself, not the tags.
  check(canLearnSpell({ classId: 'cleric', level: 1, spellName: 'cure wounds' }).ok === true, 'canLearnSpell: cure wounds is a cleric L1 spell');
  check(canLearnSpell({ classId: 'cleric', level: 1, spellName: 'fireball' }).ok === false, 'canLearnSpell: fireball is not a cleric spell');
  check(canLearnSpell({ classId: 'wizard', level: 1, spellName: 'fireball' }).ok === false, 'canLearnSpell: fireball is above the wizard L1 max');
}

// (b) Scores: point-buy, standard array, manual, variant totals,
// theme +2/+1 breakdown, no origin-feat ASI.
group('(b) Scores + variant ASI + theme ASI (validator unit)');
{
  check(validateCreatorNextStage4(dwarfClericBody()).ok === true,
    `dwarf/soldier cleric fixture passes (${errText(validateCreatorNextStage4(dwarfClericBody()))})`);
  check(validateCreatorNextStage4(markWizardBody()).ok === true,
    `mark-of-detection/sage wizard fixture passes (${errText(validateCreatorNextStage4(markWizardBody()))})`);

  // Variant total, not base + variant: the Hill Dwarf variant total
  // is {con:2, wis:1}. A final built from the base dwarf ASI only
  // (con:2, no wis) refuses, naming the missing wis.
  const baseOnly = validateCreatorNextStage4(dwarfClericBody({ ability_scores: { ...DWARF_FINAL, wis: 15 } }));
  check(baseOnly.ok === false && errText(baseOnly).includes('abilityScores:') && errText(baseOnly).includes('wis: expected 16'),
    `variant total wins: wis 15 refused, expected 16 (got ${errText(baseOnly)})`);
  // Dragonmark REPLACE: base half-elf is {cha:2, choice:2}; the mark
  // is {wis:2, choice:1}. A final that double-counts the base ASI
  // (cha 12 = base 10 + base cha 2, on top of the resolved total)
  // refuses, naming cha expected 10.
  const doubleCount = validateCreatorNextStage4(markWizardBody({
    ability_scores: { ...MARK_FINAL, cha: 12 },
  }));
  check(doubleCount.ok === false && errText(doubleCount).includes('abilityScores:') && errText(doubleCount).includes('cha: expected 10'),
    `mark replaces base ASI: cha 12 (base ASI double-counted) refused (got ${errText(doubleCount)})`);
  // A final that uses the BASE half-elf choice count (2 picks) also
  // refuses — the resolved count is 1.
  const baseChoiceCount = validateCreatorNextStage4(markWizardBody({
    ability_choice_picks: { int: 1, dex: 1 },
    ability_scores: { ...MARK_FINAL, dex: 14 },
  }));
  check(baseChoiceCount.ok === false && errText(baseChoiceCount).includes('abilityChoicePicks:') && errText(baseChoiceCount).includes('grants 1 choice'),
    `mark choice count is 1, not the base half-elf 2 (got ${errText(baseChoiceCount)})`);
  // Base human ASI is {} — and since the 2024 rebuild (PHB p. 194)
  // there is no Standard Human variant to carry the +1-all: a human
  // / soldier fighter whose finals are base + theme passes, and
  // finals built with the old +1-all refuse, with or without the
  // legacy 'Standard Human' subrace (it resolves to the entry).
  const stdHumanBase = { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 }; // point-buy 27
  const stdHumanFinal = { str: 17, dex: 14, con: 14, int: 12, wis: 10, cha: 8 }; // base + soldier {str:2, con:1}, no species ASI
  check(resolvedASIFor('human', null) && Object.keys(resolvedASIFor('human', null)).length === 0,
    'base human resolved ASI is {} (the 2024 human has no ASI)');
  check(validateCreatorNextStage4({
    creator: MARKER, class: 'fighter', race: 'human', subrace: 'Standard Human',
    theme_id: 'soldier', generation_method: 'point_buy',
    base_scores: stdHumanBase, ability_scores: stdHumanFinal,
    skills: ['Athletics', 'Intimidation'], languages: ['Common', 'Dwarvish'],
  }).ok === true, "legacy 'Standard Human' subrace + 2024 finals pass (finals = base + theme)");
  const stdHumanBaseOnly = validateCreatorNextStage4({
    creator: MARKER, class: 'fighter', race: 'human', subrace: 'Standard Human',
    theme_id: 'soldier', generation_method: 'point_buy',
    base_scores: stdHumanBase, ability_scores: { str: 18, dex: 15, con: 15, int: 13, wis: 11, cha: 9 },
    skills: ['Athletics', 'Intimidation'], languages: ['Common', 'Dwarvish'],
  });
  check(stdHumanBaseOnly.ok === false && errText(stdHumanBaseOnly).includes('abilityScores:'),
    `old +1-all finals refuse under the 2024 human (got ${errText(stdHumanBaseOnly)})`);

  // Theme +2/+1 breakdown: soldier {str:2, con:1} is already in the
  // dwarf finals. A final off by the theme amount refuses.
  const noTheme = validateCreatorNextStage4(dwarfClericBody({ ability_scores: { ...DWARF_FINAL, str: 12 } }));
  check(noTheme.ok === false && errText(noTheme).includes('str: expected 14'),
    `theme ASI is in the breakdown: str 12 refused, expected 14 (got ${errText(noTheme)})`);
  // NO origin-feat ASI in 2024: the soldier feat is Savage Attacker.
  // Correct finals + the feat pass; finals inflated by a phantom +1
  // (as if the feat granted an ASI) refuse.
  check(validateCreatorNextStage4(dwarfClericBody({ origin_feat: 'savage_attacker' })).ok === true,
    'origin feat present + correct finals passes (feat grants no ASI)');
  const featAsi = validateCreatorNextStage4(dwarfClericBody({
    origin_feat: 'savage_attacker', ability_scores: { ...DWARF_FINAL, str: 15 },
  }));
  check(featAsi.ok === false && errText(featAsi).includes('abilityScores:') && errText(featAsi).includes('str: expected 14'),
    `phantom feat ASI refused: str 15 with Savage Attacker (got ${errText(featAsi)})`);
  // Theme ASI resolves from the live registry, not a hardcoded copy.
  check(JSON.stringify(resolveTheme('soldier')?.ability_score_increase) === JSON.stringify({ str: 2, con: 1 }),
    'soldier theme ASI is {str:2, con:1} in the live registry');
  check(JSON.stringify(resolveTheme('sage')?.ability_score_increase) === JSON.stringify({ int: 2, wis: 1 }),
    'sage theme ASI is {int:2, wis:1} in the live registry');

  // Generation methods.
  const methodBody = (method, bases) => ({
    creator: MARKER, class: 'fighter', race: 'human',
    generation_method: method, base_scores: bases,
  });
  check(validateCreatorNextStage4(methodBody('point_buy', DWARF_BASE)).ok === true, 'point-buy 27 exactly passes');
  check(validateCreatorNextStage4(methodBody('point_buy', { str: 15, dex: 15, con: 13, int: 10, wis: 12, cha: 8 })).ok === false,
    'point-buy 29 (over budget) refuses');
  const overBudget = validateCreatorNextStage4(methodBody('point_buy', { str: 15, dex: 15, con: 13, int: 10, wis: 12, cha: 8 }));
  check(errText(overBudget).includes('baseScores:') && errText(overBudget).includes('27-point budget'),
    `over-budget names baseScores + the 27 budget (got ${errText(overBudget)})`);
  check(validateCreatorNextStage4(methodBody('point_buy', { ...DWARF_BASE, str: 16 })).ok === false, 'point-buy base 16 refuses');
  check(validateCreatorNextStage4(methodBody('point_buy', { ...DWARF_BASE, str: 7 })).ok === false, 'point-buy base 7 refuses');
  check(validateCreatorNextStage4(methodBody('standard_array', { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 })).ok === true,
    'standard array {15,14,13,12,10,8} passes');
  // (The dwarf point-buy bases ARE the standard-array multiset —
  // server notes §6 — so they pass under standard_array too; the
  // rejection case below uses a genuinely different multiset.)
  check(validateCreatorNextStage4(methodBody('standard_array', { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 9 })).ok === false,
    'standard array rejects {15,14,13,12,10,9}');
  check(validateCreatorNextStage4(methodBody('manual', { str: 18, dex: 18, con: 18, int: 18, wis: 18, cha: 18 })).ok === true,
    'manual all-18 passes');
  check(validateCreatorNextStage4(methodBody('manual', { str: 19, dex: 10, con: 10, int: 10, wis: 10, cha: 10 })).ok === false, 'manual 19 refuses');
  check(validateCreatorNextStage4(methodBody('manual', { str: 2, dex: 10, con: 10, int: 10, wis: 10, cha: 10 })).ok === false, 'manual 2 refuses');
  const badMethod = validateCreatorNextStage4(methodBody('rolled', DWARF_BASE));
  check(badMethod.ok === false && errText(badMethod).includes('generationMethod:'),
    `unknown generation method names generationMethod (got ${errText(badMethod)})`);
  // Consistent over-18 final passes arithmetic (cap clamps at submit/Review, not here).
  check(validateCreatorNextStage4({
    creator: MARKER, class: 'fighter', race: 'elf', generation_method: 'manual',
    base_scores: { str: 18, dex: 18, con: 18, int: 18, wis: 18, cha: 18 },
    ability_scores: { str: 18, dex: 20, con: 18, int: 18, wis: 18, cha: 18 },
  }).ok === true, 'consistent over-18 final (elf dex 20) passes arithmetic');
  // Choice picks: count, distinctness, dwarf (choice 0) refuses any pick.
  check(validateCreatorNextStage4(dwarfClericBody({ ability_choice_picks: { str: 1 } })).ok === false,
    'dwarf (choice 0) sending a choice pick refuses');
  const dupPick = validateCreatorNextStage4(markWizardBody({ ability_choice_picks: ['int', 'int'] }));
  check(dupPick.ok === false && errText(dupPick).includes('abilityChoicePicks:') && errText(dupPick).includes('distinct'),
    `duplicate choice pick names abilityChoicePicks + distinct (got ${errText(dupPick)})`);
  const badPickVal = validateCreatorNextStage4(markWizardBody({ ability_choice_picks: { int: 2 } }));
  check(badPickVal.ok === false && errText(badPickVal).includes('abilityChoicePicks:'),
    `choice pick value 2 refuses (got ${errText(badPickVal)})`);
  check(validateCreatorNextStage4(markWizardBody({ ability_choice_picks: ['int'] })).ok === true,
    'choice picks accept the array form too');
  // Wire-format regression (test-worker fix, 2026-11-06): the client
  // stringifies ability_choice_picks on the wire, like every other
  // Stage 4 JSON field — the validator must accept the JSON string
  // holding the object/list, not only the object/list itself.
  // (The staged validator refused both string forms before the fix,
  // so any real save for a choice-granting species would 400.)
  check(validateCreatorNextStage4(markWizardBody({ ability_choice_picks: JSON.stringify({ int: 1 }) })).ok === true,
    'choice picks accept a JSON string holding the object');
  check(validateCreatorNextStage4(markWizardBody({ ability_choice_picks: JSON.stringify(['int']) })).ok === true,
    'choice picks accept a JSON string holding the array');
  const garbagePicks = validateCreatorNextStage4(markWizardBody({ ability_choice_picks: 'not json {' }));
  check(garbagePicks.ok === false && errText(garbagePicks).includes('abilityChoicePicks:'),
    `unparseable choice-picks string still refuses (got ${errText(garbagePicks)})`);
  const numberPicks = validateCreatorNextStage4(markWizardBody({ ability_choice_picks: JSON.stringify(42) }));
  check(numberPicks.ok === false && errText(numberPicks).includes('abilityChoicePicks:'),
    `JSON number as choice picks still refuses (got ${errText(numberPicks)})`);
}

// (c) Proficiencies + dedup: duplicate becomes a replacement pick,
// never expertise; held options grayed + disabled, never hidden;
// consolidation across species + theme + class + feat grants.
group('(c) Proficiencies + dedup (validator unit + client rules)');
{
  const dupSkill = validateCreatorNextStage4(dwarfClericBody({ skills: ['Athletics', 'Athletics', 'Intimidation'] }));
  check(dupSkill.ok === false && errText(dupSkill).includes('skills:') && errText(dupSkill).includes('picked twice'),
    `duplicate skill names skills + picked twice (got ${errText(dupSkill)})`);
  const unknownSkill = validateCreatorNextStage4(dwarfClericBody({ skills: ['Athletics', 'Intimidation', 'Swordsmanship'] }));
  check(unknownSkill.ok === false && errText(unknownSkill).includes('skills:') && errText(unknownSkill).includes('not a known skill'),
    `unknown skill names skills (got ${errText(unknownSkill)})`);
  const missingSig = validateCreatorNextStage4(dwarfClericBody({ skills: ['Religion', 'Insight'] }));
  check(missingSig.ok === false && errText(missingSig).includes('skills:') && errText(missingSig).includes('signature'),
    `skills missing the soldier signature skills refuse (got ${errText(missingSig)})`);
  const dupLang = validateCreatorNextStage4(dwarfClericBody({ languages: ['Common', 'Common', 'Dwarvish'] }));
  check(dupLang.ok === false && errText(dupLang).includes('languages:') && errText(dupLang).includes('picked twice'),
    `duplicate language names languages (got ${errText(dupLang)})`);
  const missingSpeciesLang = validateCreatorNextStage4(dwarfClericBody({ languages: ['Common'] }));
  check(missingSpeciesLang.ok === false && errText(missingSpeciesLang).includes('languages:') && errText(missingSpeciesLang).includes('Dwarvish'),
    `languages missing the species language refuse (got ${errText(missingSpeciesLang)})`);
  const unknownLang = validateCreatorNextStage4(dwarfClericBody({ languages: ['Common', 'Dwarvish', 'Klingon'] }));
  check(unknownLang.ok === false && errText(unknownLang).includes('languages:'),
    `unknown language refuses (got ${errText(unknownLang)})`);
  const dupTool = validateCreatorNextStage4(dwarfClericBody({ tool_proficiencies: ["Smith's Tools", "Smith's Tools"] }));
  check(dupTool.ok === false && errText(dupTool).includes('tool_proficiencies:') && errText(dupTool).includes('picked twice'),
    `duplicate tool names tool_proficiencies (got ${errText(dupTool)})`);
  const unknownTool = validateCreatorNextStage4(dwarfClericBody({ tool_proficiencies: ['Laser Cutter'] }));
  check(unknownTool.ok === false && errText(unknownTool).includes('tool_proficiencies:'),
    `unknown tool refuses (got ${errText(unknownTool)})`);
  // Class skill-pick COUNT and MEMBERSHIP are server-enforced (item 22,
  // 2026-11-06): the chassis registry governs the class picks. A cleric
  // sending 5 skills (class picks 3: History, Insight, Medicine) refuses
  // the count, and 'Perception' — not a cleric class skill — refuses on
  // membership. The old "server does NOT enforce" assert is retired.
  const overCount = validateCreatorNextStage4(dwarfClericBody({
    skills: ['Athletics', 'Intimidation', 'History', 'Insight', 'Medicine'],
  }));
  check(overCount.ok === false && errText(overCount).includes('skills:') && errText(overCount).includes('picks at most 2'),
    `server enforces the class skill-pick count: cleric 3 picks refuses (got ${errText(overCount)})`);
  const wrongClassSkill = validateCreatorNextStage4(dwarfClericBody({
    skills: ['Athletics', 'Intimidation', 'Perception'],
  }));
  check(wrongClassSkill.ok === false && errText(wrongClassSkill).includes('skills:') && errText(wrongClassSkill).includes("'Perception' is not a cleric class skill"),
    `server enforces class skill membership: 'Perception' is not a cleric skill (got ${errText(wrongClassSkill)})`);
  // Held-option semantics from the real choiceOptions module: the
  // full list is returned, held options are flagged, never filtered.
  const langOpts = resolveChoiceOptions({ type: 'language', options: 'any_language' });
  check(Array.isArray(langOpts) && langOpts.some((o) => o.value === 'Elvish'),
    'any_language still lists Elvish even when held (never hidden)');
  check(isHeldOption('Elvish', ['Common', 'Elvish']) === true, 'isHeldOption flags a held language');
  check(isHeldOption('elvish', ['Elvish']) === true, 'isHeldOption is case-insensitive');
  check(isHeldOption('Dwarvish', ['Common', 'Elvish']) === false, 'isHeldOption is false for an unheld language');
  // Static: the component states the dedup rule and renders held
  // options disabled with the "already granted" suffix, never hidden.
  const stage4Src = readRepo('client/src/components/creator-next/Stage4AbilitiesSkillsSpells.jsx');
  check(stage4Src.includes('never a free expertise'), 'Stage 4 states the no-free-expertise rule');
  check(stage4Src.includes('— already granted'), 'Stage 4 marks held options "— already granted"');
  check(stage4Src.includes('disabled={held}'), 'Stage 4 renders held skill options disabled={held}');
  check(stage4Src.includes('pick a replacement of the same type'), 'Stage 4 tells the player to pick a same-type replacement');
  check(stage4Src.includes('does not count against the class total'), 'Stage 4: a held pick does not count against the class total');
}

// (d) Spell choices saved and gated.
group('(d) Spell gating (validator unit)');
{
  // Valid picks save (unit level); counts are the L1 counts.
  // Bard (2026-11-06): bards PREPARE in 2024 — the DWARF_BASE finals
  // give Cha 14 (+2), so a bard prepares 3 at L1, not 4 known.
  check(validateCreatorNextStage4({
    creator: MARKER, class: 'bard', race: 'human', generation_method: 'point_buy',
    base_scores: DWARF_BASE, ability_scores: DWARF_BASE,
    prepared_spells: ['charm person', 'cure wounds', 'faerie fire'],
  }).ok === true, 'bard prepared 3 passes (2024: bards prepare; Cha +2 → 3)');
  const bardShort = validateCreatorNextStage4({
    creator: MARKER, class: 'bard', race: 'human', generation_method: 'point_buy',
    base_scores: DWARF_BASE, ability_scores: DWARF_BASE,
    prepared_spells: ['charm person', 'cure wounds'],
  });
  check(bardShort.ok === false && errText(bardShort).includes('preparedSpells:') && errText(bardShort).includes('picks 3 spells'),
    `bard prepared 2 refuses the count (got ${errText(bardShort)})`);
  const bardWrongList = validateCreatorNextStage4({
    creator: MARKER, class: 'bard', race: 'human', generation_method: 'point_buy',
    base_scores: DWARF_BASE, ability_scores: DWARF_BASE,
    prepared_spells: ['charm person', 'cure wounds', 'fireball'],
  });
  check(bardWrongList.ok === false && errText(bardWrongList).includes('preparedSpells:') && errText(bardWrongList).includes('fireball'),
    `bard picking fireball (L3) refuses field-named (got ${errText(bardWrongList)})`);
  const clericWrongList = validateCreatorNextStage4(dwarfClericBody({
    prepared_spells: ['bless', 'cure wounds', 'guiding bolt', 'fireball'],
  }));
  check(clericWrongList.ok === false && errText(clericWrongList).includes('preparedSpells:') && errText(clericWrongList).includes('fireball'),
    `cleric picking fireball refuses, naming the spell (got ${errText(clericWrongList)})`);
  const wizardWrongList = validateCreatorNextStage4(markWizardBody({
    prepared_spells: ['magic missile', 'shield', 'mage armor', 'sleep', 'cure wounds'],
  }));
  check(wizardWrongList.ok === false && errText(wizardWrongList).includes('preparedSpells:') && errText(wizardWrongList).includes('cure wounds'),
    `wizard picking cure wounds refuses (not on the Wizard list) (got ${errText(wizardWrongList)})`);
  const dupSpell = validateCreatorNextStage4(dwarfClericBody({
    prepared_spells: ['bless', 'bless', 'cure wounds', 'guiding bolt'],
  }));
  check(dupSpell.ok === false && errText(dupSpell).includes('preparedSpells:') && errText(dupSpell).includes('picked twice'),
    `duplicate spell pick refuses (got ${errText(dupSpell)})`);
  // Count needs the final scores' casting-ability modifier; without
  // finals the count is skipped (draft) while each spell is gated.
  check(validateCreatorNextStage4({
    creator: MARKER, class: 'cleric', race: 'dwarf', subrace: 'Hill Dwarf', theme_id: 'soldier',
    prepared_spells: ['bless'],
  }).ok === true, 'cleric 1 prepared spell with no final scores passes (count skipped, draft)');
  const clericShort = validateCreatorNextStage4(dwarfClericBody({
    prepared_spells: ['bless', 'cure wounds', 'guiding bolt'],
  }));
  check(clericShort.ok === false && errText(clericShort).includes('preparedSpells:') && errText(clericShort).includes('picks 4 spells'),
    `cleric prepared 3 with Wis +3 refuses the count (got ${errText(clericShort)})`);
  // Cross-type refusals.
  // Bard (2026-11-06): a prepared caster now — sending known_spells
  // refuses, the mirror of the cleric case below.
  const bardKnown = validateCreatorNextStage4({
    creator: MARKER, class: 'bard', race: 'human',
    known_spells: ['charm person', 'cure wounds', 'faerie fire'],
  });
  check(bardKnown.ok === false && errText(bardKnown).includes('knownSpells:') && errText(bardKnown).includes('prepares spells instead'),
    `prepared-caster bard sending known_spells refuses (got ${errText(bardKnown)})`);
  const prepCasterKnown = validateCreatorNextStage4(dwarfClericBody({ known_spells: ['bless'] }));
  check(prepCasterKnown.ok === false && errText(prepCasterKnown).includes('knownSpells:') && errText(prepCasterKnown).includes('prepares spells instead'),
    `prepared-caster sending known_spells refuses (got ${errText(prepCasterKnown)})`);
  // Non-casters at L1 (incl. keeper, warden/scholar before L3).
  for (const cls of ['fighter', 'rogue', 'keeper', 'warden', 'scholar', 'blood_hunter', 'warlord']) {
    const r = validateCreatorNextStage4({ creator: MARKER, class: cls, race: 'human', prepared_spells: ['cure wounds'] });
    check(r.ok === false && errText(r).includes('preparedSpells:') && errText(r).includes('has no spells to pick at level 1'),
      `${cls} sending a prepared spell at L1 refuses (got ${errText(r)})`);
  }
  // Known-0 casters (spellshot/magus know 0 at L1) refuse a
  // prepared list as the wrong spell kind, not as "no spells".
  // Ranger left this group 2026-11-06: rangers PREPARE in 2024.
  for (const cls of ['spellshot', 'magus']) {
    const r = validateCreatorNextStage4({ creator: MARKER, class: cls, race: 'human', prepared_spells: ['cure wounds'] });
    check(r.ok === false && errText(r).includes('preparedSpells:') && errText(r).includes('knows spells instead'),
      `${cls} sending a prepared spell at L1 refuses as a known-caster (got ${errText(r)})`);
  }
  // Paladin (2024 PHB, pp. 109-110): L1 prepares 2 from the table —
  // a 1-spell draft list accepts (the count is skipped without final
  // scores; 'cure wounds' is learnable at L1 now that paladin has
  // 1st-level slots), while a 3-spell list with final scores refuses
  // the exact count. Blackguard still refuses at L1 (0 slots).
  {
    const r = validateCreatorNextStage4({ creator: MARKER, class: 'paladin', race: 'human', prepared_spells: ['cure wounds'] });
    check(r.ok === true,
      `paladin sending a prepared spell at L1 accepts a 1-spell list (cap 2; got ${errText(r)})`);
  }
  {
    const r = validateCreatorNextStage4({
      creator: MARKER, class: 'paladin', race: 'human', generation_method: 'point_buy',
      base_scores: DWARF_BASE, ability_scores: DWARF_BASE,
      prepared_spells: ['cure wounds', 'bless', 'shield of faith'],
    });
    check(r.ok === false && errText(r).includes('preparedSpells:') && errText(r).includes('picks 2 spells'),
      `paladin sending 3 prepared spells at L1 refuses the count (got ${errText(r)})`);
  }
  {
    const r = validateCreatorNextStage4({ creator: MARKER, class: 'blackguard', race: 'human', prepared_spells: ['cure wounds'] });
    check(r.ok === false && errText(r).includes('preparedSpells:') && errText(r).includes('not on the Blackguard spell list'),
      `blackguard sending a prepared spell at L1 refuses (got ${errText(r)})`);
  }
  const rangerKnown = validateCreatorNextStage4({ creator: MARKER, class: 'ranger', race: 'human', known_spells: ['cure wounds'] });
  check(rangerKnown.ok === false && errText(rangerKnown).includes('knownSpells:') && errText(rangerKnown).includes('prepares spells instead'),
    `ranger sending a known spell at L1 refuses as a prepared caster (got ${errText(rangerKnown)})`);
  // Ranger prepared list at L1: 2 picks, and Hunter's Mark is
  // already granted (Favored Enemy) — listing it refuses as granted.
  const rangerPrep = validateCreatorNextStage4({ creator: MARKER, class: 'ranger', race: 'human', prepared_spells: ['cure wounds', "hunter's mark"] });
  check(rangerPrep.ok === false && errText(rangerPrep).includes('preparedSpells:') && errText(rangerPrep).includes('already granted'),
    `ranger listing Hunter's Mark among prepared spells refuses as already granted (got ${errText(rangerPrep)})`);
  // Granted-spell exclusion: Mark of Detection grants Detect Magic
  // at L1 (innateSpellsFor), so picking it refuses as already granted.
  check(JSON.stringify((innateSpellsFor('half-elf', 'Mark of Detection') || []).map((s) => s.name)).includes('Detect Magic'),
    'Mark of Detection innate spells include Detect Magic at L1 (live registry)');
  const grantedPick = validateCreatorNextStage4(markWizardBody({
    prepared_spells: ['magic missile', 'shield', 'mage armor', 'sleep', 'detect magic'],
  }));
  check(grantedPick.ok === false && errText(grantedPick).includes('preparedSpells:') && errText(grantedPick).includes('already granted'),
    `granted innate spell refuses as already granted (got ${errText(grantedPick)})`);
  // Magic Initiate L1 spell is granted too (sage MI list is Wizard).
  const miGranted = validateCreatorNextStage4(markWizardBody({
    origin_feat: 'magic_initiate',
    origin_feat_choices: {
      spell_list: 'Wizard', spellcasting_ability: 'Intelligence',
      cantrips: ['fire bolt', 'mage hand'], level1_spell: 'magic missile',
    },
    prepared_spells: ['magic missile', 'shield', 'mage armor', 'sleep', 'alarm'],
  }));
  check(miGranted.ok === false && errText(miGranted).includes('preparedSpells:') && errText(miGranted).includes('Magic Initiate'),
    `Magic Initiate L1 spell refuses as already granted (got ${errText(miGranted)})`);
  // See Invisibility (atLevel 3) is NOT granted yet at L1 — it is
  // refused by canLearnSpell (L2), not by the granted rule.
  const seeInvis = validateCreatorNextStage4(markWizardBody({
    prepared_spells: ['magic missile', 'shield', 'mage armor', 'sleep', 'see invisibility'],
  }));
  check(seeInvis.ok === false && !errText(seeInvis).includes('already granted') && errText(seeInvis).includes('preparedSpells:'),
    `See Invisibility (granted at 3rd) is NOT an already-granted refusal (got ${errText(seeInvis)})`);
  // Cantrips untouched by Stage 4: known_cantrips is never validated
  // here, even with nonsense in it (Stage 2's territory).
  check(validateCreatorNextStage4(dwarfClericBody({ known_cantrips: ['fire bolt', 'not a real spell'] })).ok === true,
    'known_cantrips is not validated by Stage 4');
  // Sorcerer / warlock known counts. Sorcerers PREPARE in 2024 —
  // the 2014 known-spells row is gone from SPELLS_KNOWN, so the
  // sorcerer asserts flip to prepared. The count check needs final
  // scores (modKnown); ability_scores alone engages it with no
  // base/theme arithmetic to satisfy. Cha 16 -> mod +3 -> prepares 2.
  check(validateCreatorNextStage4({
    creator: MARKER, class: 'sorcerer', race: 'human',
    ability_scores: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 16 },
    prepared_spells: ['magic missile', 'shield'],
  }).ok === true, 'sorcerer prepared 2 passes');
  // Warlock PREPARES in 2024 (fixed table, 2 at L1, mod-independent
  // — the count needs final scores, so the refusal cases carry
  // DWARF_BASE like the bard cases above).
  check(validateCreatorNextStage4({
    creator: MARKER, class: 'warlock', race: 'human', prepared_spells: ['hex', 'armor of agathys'],
  }).ok === true, 'warlock prepared 2 passes (2024: warlocks prepare; table 2 at L1, mod-independent)');
  const warlockShort = validateCreatorNextStage4({
    creator: MARKER, class: 'warlock', race: 'human', generation_method: 'point_buy',
    base_scores: DWARF_BASE, ability_scores: DWARF_BASE,
    prepared_spells: ['hex'],
  });
  check(warlockShort.ok === false && errText(warlockShort).includes('preparedSpells:') && errText(warlockShort).includes('picks 2 spells'),
    `warlock prepared 1 refuses the count (got ${errText(warlockShort)})`);
  const warlockOver = validateCreatorNextStage4({
    creator: MARKER, class: 'warlock', race: 'human', generation_method: 'point_buy',
    base_scores: DWARF_BASE, ability_scores: DWARF_BASE,
    prepared_spells: ['hex', 'armor of agathys', 'arms of hadar'],
  });
  check(warlockOver.ok === false && errText(warlockOver).includes('preparedSpells:') && errText(warlockOver).includes('picks 2 spells'),
    `warlock prepared 3 refuses over-cap (got ${errText(warlockOver)})`);
  const sorcShort = validateCreatorNextStage4({
    creator: MARKER, class: 'sorcerer', race: 'human',
    ability_scores: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 16 },
    prepared_spells: ['magic missile'],
  });
  check(sorcShort.ok === false && errText(sorcShort).includes('preparedSpells:') && errText(sorcShort).includes('picks 2 spells'),
    `sorcerer prepared 1 refuses the count (got ${errText(sorcShort)})`);
  const sorcKnown = validateCreatorNextStage4({
    creator: MARKER, class: 'sorcerer', race: 'human', known_spells: ['magic missile', 'shield'],
  });
  check(sorcKnown.ok === false && errText(sorcKnown).includes('knownSpells:') && errText(sorcKnown).includes('prepares spells instead of knowing them'),
    `sorcerer known_spells refuses — sorcerers prepare (got ${errText(sorcKnown)})`);
}

// (e) Draft tolerance + the creator-next marker gate.
group('(e) Draft tolerance + marker gate (unit + HTTP)');
{
  check(validateCreatorNextStage4({}).ok === true, 'empty body passes (draft)');
  check(validateCreatorNextStage4({ creator: MARKER }).ok === true, 'marker-only body passes (draft)');
  check(validateCreatorNextStage4({ creator: MARKER, class: 'cleric' }).ok === true, 'class-only body passes (draft)');
  check(validateCreatorNextStage4(dwarfClericBody({ skills: [], languages: [], prepared_spells: [] })).ok === true,
    'empty lists pass (no picks yet is a draft, not a refusal)');
  check(validateCreatorNextStage4({ creator: MARKER, class: 'cleric', race: 'dwarf', prepared_spells: [] }).ok === true,
    'empty prepared list passes');
  // Invalid picks WITHOUT the marker still create (201) — the gate
  // is the marker, same as Stages 2/3. Lists ride as JSON strings.
  const noMarker = await postCharacter({
    name: 'S4 NoMarker Bad', race: 'dwarf', subrace: 'Hill Dwarf', class: 'cleric',
    theme_id: 'soldier', prepared_spells: J(['fireball']),
  });
  check(noMarker.status === 201, `no-marker invalid picks still create (got ${noMarker.status}: ${JSON.stringify(noMarker.json?.error || noMarker.json?.id)})`);
  check(await characterCountByName('S4 NoMarker Bad') === 1, 'no-marker bad body created exactly one row');
  // The SAME body WITH the marker refuses with a field-named 400
  // and creates no row.
  const markerBad = await postCharacter({
    name: 'S4 Marker Bad', creator: MARKER, race: 'dwarf', subrace: 'Hill Dwarf', class: 'cleric',
    theme_id: 'soldier', prepared_spells: J(['fireball']),
  });
  check(markerBad.status === 400, `marker invalid picks refuse 400 (got ${markerBad.status})`);
  check(typeof markerBad.json?.error === 'string' && markerBad.json.error.includes('preparedSpells:'),
    `marker refusal names preparedSpells (got ${JSON.stringify(markerBad.json?.error)})`);
  check(await characterCountByName('S4 Marker Bad') === 0, 'refused POST created no row');
  // Marker-gate static guard: Stage 4 reuses the two existing gates.
  const routeSrc = readRepo('server/routes/character.js');
  const gates = (routeSrc.match(/req\.body\.creator === 'creator-next'/g) || []).length;
  check(gates === 2, `POST and PUT carry exactly 2 marker gates (found ${gates})`);
  const stage4Calls = (routeSrc.match(/validateCreatorNextStage4\(req\.body/g) || []).length;
  check(stage4Calls === 2, `Stage 4 validator is called from POST and PUT (found ${stage4Calls})`);
}

// (f) HTTP persist: stringified save round-trips, POST gains
// prepared_spells, PUT persists + refuses cleanly, PUT resolves the
// row's class when the body omits it.
group('(f) HTTP persist (real router + real DB)');
{
  // POST the full dwarf/soldier cleric body the way the client sends
  // it: JSON columns as JSON strings, validation-only fields raw.
  const created = await postCharacter({
    name: 'S4 Dwarf Cleric', ...dwarfClericBody(),
    base_scores: DWARF_BASE, ability_scores: J(DWARF_FINAL),
    skills: J(['Athletics', 'Intimidation', 'Religion']),
    languages: J(['Common', 'Dwarvish']),
    prepared_spells: J(DWARF_PREPARED),
  });
  check(created.status === 201, `stringified Stage 4 POST creates 201 (got ${created.status}: ${JSON.stringify(created.json?.error || '')})`);
  const clericId = created.json?.id;
  check(typeof clericId === 'number', `created cleric row has an id (got ${JSON.stringify(created.json?.id)})`);
  const clericRow = await readCharacter(clericId);
  check(JSON.stringify(JSON.parse(clericRow.prepared_spells)) === JSON.stringify(DWARF_PREPARED),
    'prepared_spells persisted and reads back as the 4 sent spells');
  check(JSON.stringify(JSON.parse(clericRow.ability_scores)) === JSON.stringify(DWARF_FINAL),
    'ability_scores finals persisted and read back');
  check(JSON.stringify(JSON.parse(clericRow.skills)) === JSON.stringify(['Athletics', 'Intimidation', 'Religion']),
    'skills persisted and read back');
  const themeRow = await db.dbGet('SELECT theme_id FROM character_themes WHERE character_id = ?', [clericId]);
  check(themeRow?.theme_id === 'soldier', `theme soldier persisted for the cleric (got ${themeRow?.theme_id})`);
  // POST INSERT balance: 64 columns / 64 placeholders, prepared_spells +
  // physical_build in the list (Stage 6 adds physical_build — the draft
  // POST used to drop it, so an empty-body commit could never succeed).
  const routeSrc = readRepo('server/routes/character.js');
  const insertMatch = routeSrc.match(/INSERT INTO characters \(\s*([\s\S]*?)\s*\) VALUES \(([\s\S]*?)\)/);
  check(insertMatch !== null, 'POST INSERT statement found in character.js');
  if (insertMatch) {
    const cols = insertMatch[1].split(',').map((c) => c.trim()).filter(Boolean);
    const placeholders = (insertMatch[2].match(/\?/g) || []).length;
    check(cols.length === 64 && placeholders === 64,
      `POST INSERT is balanced at 64 columns / 64 placeholders (got ${cols.length} / ${placeholders})`);
    check(cols.includes('prepared_spells'), 'POST INSERT column list includes prepared_spells');
    check(cols.includes('physical_build'), 'POST INSERT column list includes physical_build (Stage 6: the draft POST stores it)');
  }
  // PUT a good change: skills gain a pick (theme sigs still present).
  const putGood = await putCharacter(clericId, {
    creator: MARKER, skills: J(['Athletics', 'Intimidation', 'Religion', 'Insight']),
  });
  check(putGood.status === 200, `good PUT persists 200 (got ${putGood.status}: ${JSON.stringify(putGood.json?.error || '')})`);
  check(JSON.stringify(JSON.parse((await readCharacter(clericId)).skills)) === JSON.stringify(['Athletics', 'Intimidation', 'Religion', 'Insight']),
    'PUT skills persisted and read back');
  // PUT a refusal: dropping a theme signature skill leaves the row unchanged.
  const beforeBadPut = await readCharacter(clericId);
  const putBad = await putCharacter(clericId, {
    creator: MARKER, skills: J(['Religion', 'Insight']),
  });
  check(putBad.status === 400, `PUT dropping theme sig skills refuses 400 (got ${putBad.status})`);
  check(typeof putBad.json?.error === 'string' && putBad.json.error.includes('skills:'),
    `PUT refusal names skills (got ${JSON.stringify(putBad.json?.error)})`);
  const afterBadPut = await readCharacter(clericId);
  check(afterBadPut.skills === beforeBadPut.skills, 'refused PUT left the row unchanged');
  // PUT resolves the ROW's class when the body omits it: a wizard
  // row created without the marker, then a marker PUT of 5 valid
  // prepared spells with no class in the body.
  const wizCreated = await postCharacter({
    name: 'S4 Put Wizard', race: 'half-elf', subrace: 'Mark of Detection', class: 'wizard',
    theme_id: 'sage', ability_scores: J(MARK_FINAL),
    skills: J(['Arcana', 'History', 'Investigation']),
    languages: J(['Common', 'Elvish', 'Dwarvish']),
    prepared_spells: J(MARK_PREPARED),
  });
  check(wizCreated.status === 201, `PUT-fixture wizard POST creates 201 (got ${wizCreated.status})`);
  const wizId = wizCreated.json?.id;
  const putNoClass = await putCharacter(wizId, {
    creator: MARKER, prepared_spells: J(['magic missile', 'shield', 'mage armor', 'sleep', 'alarm']),
  });
  check(putNoClass.status === 200, `PUT without class resolves the row wizard class, 200 (got ${putNoClass.status}: ${JSON.stringify(putNoClass.json?.error || '')})`);
  const wizBefore = await readCharacter(wizId);
  const putBadCount = await putCharacter(wizId, {
    creator: MARKER, prepared_spells: J(['magic missile', 'shield']),
  });
  check(putBadCount.status === 400, `PUT with 2 prepared spells for an Int-18 wizard refuses 400 (got ${putBadCount.status})`);
  check(typeof putBadCount.json?.error === 'string' && putBadCount.json.error.includes('preparedSpells:'),
    `PUT count refusal names preparedSpells (got ${JSON.stringify(putBadCount.json?.error)})`);
  check((await readCharacter(wizId)).prepared_spells === wizBefore.prepared_spells,
    'refused PUT left the wizard prepared_spells unchanged');
  // Mark wizard over HTTP too: the full stringified body round-trips.
  const markCreated = await postCharacter({
    name: 'S4 Mark Wizard', ...markWizardBody(),
    base_scores: MARK_BASE, ability_choice_picks: J({ int: 1 }), ability_scores: J(MARK_FINAL),
    skills: J(['Arcana', 'History', 'Investigation']),
    languages: J(['Common', 'Elvish', 'Dwarvish']),
    prepared_spells: J(MARK_PREPARED),
  });
  check(markCreated.status === 201, `stringified mark-wizard POST creates 201 (got ${markCreated.status}: ${JSON.stringify(markCreated.json?.error || '')})`);
  const markRow = await readCharacter(markCreated.json?.id);
  check(JSON.stringify(JSON.parse(markRow.prepared_spells)) === JSON.stringify(MARK_PREPARED),
    'mark wizard prepared_spells persisted and read back');
  check(JSON.stringify(JSON.parse(markRow.ability_scores)) === JSON.stringify(MARK_FINAL),
    'mark wizard ability_scores persisted and read back');
}

// (g) Artificer mirror agreement: getSpellsPrepared('artificer')
// equals preparedSpellsForLevel(level, intMod) at every level 1–20,
// at every mod — both follow the 2024 book formula (Int mod + half
// level, min 1). The Forge table is gone.
group('(g) Artificer 2024-formula mirror (unit)');
{
  check(preparedSpellsForLevel(1, 3) === 3 && preparedSpellsForLevel(1, 0) === 1 && preparedSpellsForLevel(1, -1) === 1,
    'artificer L1: 3 at Int +3, 1 at Int +0, 1 at Int -1 (minimum 1)');
  for (let lvl = 1; lvl <= 20; lvl++) {
    for (const mod of [-1, 0, 3, 5]) {
      check(getSpellsPrepared('artificer', lvl, mod) === preparedSpellsForLevel(lvl, mod),
        `artificer L${lvl} mod ${mod}: getSpellsPrepared equals preparedSpellsForLevel (${preparedSpellsForLevel(lvl, mod)})`);
      check(getSpellsPrepared('artificer', lvl, mod) === Math.max(1, mod + Math.floor(lvl / 2)),
        `artificer L${lvl} mod ${mod}: formula Int mod + half level, min 1`);
    }
  }
  check(getSpellsPrepared('artificer', 1, 5) === 5, 'artificer L1 prepares 5 at Int +5 (2024 formula, not the Forge 2)');
  // The validator enforces the 2024 count: an Int-15 (+2) artificer
  // prepares 2 at L1; 3 refuses.
  const artBase = { str: 12, dex: 10, con: 13, int: 15, wis: 14, cha: 8 };
  const artFinal = { str: 14, dex: 10, con: 16, int: 15, wis: 15, cha: 8 };
  check(validateCreatorNextStage4({
    creator: MARKER, class: 'artificer', race: 'dwarf', subrace: 'Hill Dwarf',
    theme_id: 'soldier', generation_method: 'point_buy',
    base_scores: artBase, ability_scores: artFinal,
    skills: ['Athletics', 'Intimidation'], languages: ['Common', 'Dwarvish'],
    prepared_spells: ['cure wounds', 'faerie fire'],
  }).ok === true, 'artificer prepared 2 passes at Int 15');
  const artThree = validateCreatorNextStage4({
    creator: MARKER, class: 'artificer', race: 'dwarf', subrace: 'Hill Dwarf',
    theme_id: 'soldier', generation_method: 'point_buy',
    base_scores: artBase, ability_scores: artFinal,
    skills: ['Athletics', 'Intimidation'], languages: ['Common', 'Dwarvish'],
    prepared_spells: ['cure wounds', 'faerie fire', 'absorb elements'],
  });
  check(artThree.ok === false && errText(artThree).includes('preparedSpells:') && errText(artThree).includes('picks 2 spells'),
    `artificer prepared 3 refuses at Int 15 (max 2 at Int +2, got ${errText(artThree)})`);
  // 2024 book formula through the real validator: an Int-16 (+3)
  // artificer prepares 3 at L1 (manual bases, so int 16 is legal).
  const artThreePass = validateCreatorNextStage4({
    creator: MARKER, class: 'artificer', race: 'dwarf', subrace: 'Hill Dwarf',
    theme_id: 'soldier', generation_method: 'manual',
    base_scores: { ...artBase, int: 16 }, ability_scores: { ...artFinal, int: 16 },
    skills: ['Athletics', 'Intimidation'], languages: ['Common', 'Dwarvish'],
    prepared_spells: ['cure wounds', 'faerie fire', 'absorb elements'],
  });
  check(artThreePass.ok === true, `artificer prepared 3 passes at Int 16 (2024: Int mod + half level, got ${errText(artThreePass)})`);
  const artFour = validateCreatorNextStage4({
    creator: MARKER, class: 'artificer', race: 'dwarf', subrace: 'Hill Dwarf',
    theme_id: 'soldier', generation_method: 'manual',
    base_scores: { ...artBase, int: 16 }, ability_scores: { ...artFinal, int: 16 },
    skills: ['Athletics', 'Intimidation'], languages: ['Common', 'Dwarvish'],
    prepared_spells: ['cure wounds', 'faerie fire', 'absorb elements', 'alarm'],
  });
  check(artFour.ok === false && errText(artFour).includes('preparedSpells:') && errText(artFour).includes('picks 3 spells'),
    `artificer prepared 4 refuses at Int 16 (max 3, got ${errText(artFour)})`);
}

// (h) GET /api/spells — the per-class L1 table, abilityMod counts,
// cantrip exclusion, magus societies, error cases.
group('(h) GET /api/spells (real HTTP)');
{
  const counts = [
    ['bard', 28, null, 4], ['cleric', 18, null, 4], ['druid', 22, null, 4],
    ['sorcerer', 30, null, 2], ['warlock', 16, null, 2], ['wizard', 44, null, 4],
    ['artificer', 18, null, 3],
    ['paladin', 20, null, 2], ['ranger', 18, null, 2], ['spellshot', 0, 0, null],
    ['magus', 0, 0, null], ['blackguard', 0, null, 0],
    ['fighter', 0, null, null], ['keeper', 0, null, null], ['warden', 0, null, null],
    ['scholar', 0, null, null], ['blood_hunter', 0, null, null], ['warlord', 0, null, null],
  ];
  for (const [cls, n, known, prep] of counts) {
    const r = await getSpells(`?class=${cls}&level=1&abilityMod=3`);
    check(r.status === 200, `/api/spells ${cls} returns 200 (got ${r.status})`);
    check(r.json?.spells?.length === n, `/api/spells ${cls} L1 lists ${n} spells (got ${r.json?.spells?.length})`);
    check(r.json?.spellsKnown === known, `/api/spells ${cls} spellsKnown is ${known} (got ${r.json?.spellsKnown})`);
    check(r.json?.spellsPrepared === prep, `/api/spells ${cls} spellsPrepared at mod +3 is ${prep} (got ${r.json?.spellsPrepared})`);
    check(Array.isArray(r.json?.spells) && r.json.spells.every((s) => Number(s.level) >= 1),
      `/api/spells ${cls} list has no cantrips (all level >= 1)`);
  }
  const cleric0 = await getSpells('?class=cleric&level=1');
  check(cleric0.json?.spellsPrepared === 1, 'cleric spellsPrepared defaults to mod 0 -> 1');
  const cleric3 = await getSpells('?class=cleric&level=1&abilityMod=3');
  check(cleric3.json?.spellsPrepared === 4, 'cleric spellsPrepared with abilityMod=3 -> 4');
  const wiz3 = await getSpells('?class=wizard&level=1&abilityMod=3');
  check(wiz3.json?.spellsPrepared === 4, 'wizard spellsPrepared with abilityMod=3 -> 4');
  const art0 = await getSpells('?class=artificer&level=1');
  const art5 = await getSpells('?class=artificer&level=1&abilityMod=5');
  check(art0.json?.spellsPrepared === 1 && art5.json?.spellsPrepared === 5,
    'artificer spellsPrepared follows Int mod + half level (1 at mod 0, 5 at mod +5)');
  const pal3 = await getSpells('?class=paladin&level=1&abilityMod=3');
  check(pal3.json?.spellsPrepared === 2, 'paladin spellsPrepared is 2 at L1 even at mod +3');
  const bg3 = await getSpells('?class=blackguard&level=1&abilityMod=3');
  check(bg3.json?.spellsPrepared === 0, 'blackguard spellsPrepared is 0 at L1 even at mod +3 (no slots)');
  const wizSpell = (await getSpells('?class=wizard&level=1&abilityMod=3')).json?.spells?.find((s) => s.key === 'magic missile');
  check(wizSpell?.name === 'Magic Missile' && wizSpell?.level === 1 && Array.isArray(wizSpell?.classes),
    'spell entries carry key, title-cased name, level, classes');
  check((await getSpells('?class=wizard&level=1')).json?.spellcastingAbility === 'int', 'wizard spellcastingAbility is int');
  check((await getSpells('?class=cleric&level=1')).json?.spellcastingAbility === 'wis', 'cleric spellcastingAbility is wis');
  const magusNone = await getSpells('?class=magus&level=1');
  check(magusNone.json?.spellcastingAbility === null && magusNone.json?.spells?.length === 0,
    'magus without a society reports ability null and an empty list');
  const magusArcane = await getSpells('?class=magus&level=1&subclass=Arcane%20Order&abilityMod=3');
  check(magusArcane.json?.spellcastingAbility === 'int', 'magus Arcane Order reports int');
  const magusSylvan = await getSpells('?class=magus&level=1&subclass=Sylvan%20Circle');
  check(magusSylvan.json?.spellcastingAbility === 'wis', 'magus Sylvan Circle reports wis');
  const wardenLore = await getSpells('?class=warden&level=1&subclass=Loreseeker');
  check(wardenLore.json?.spellcastingAbility === 'int' && wardenLore.json?.spells?.length === 0,
    'warden Loreseeker reports int with an empty L1 list');
  const unknown = await getSpells('?class=nope&level=1');
  check(unknown.status === 400 && typeof unknown.json?.error === 'string',
    `unknown class 400s (got ${unknown.status})`);
  const missingClass = await getSpells('?level=1');
  check(missingClass.status === 400, `missing class 400s (got ${missingClass.status})`);
  const badLevel = await getSpells('?class=wizard&level=99');
  check(badLevel.status === 400, `level 99 400s (got ${badLevel.status})`);
  const badMod = await getSpells('?class=wizard&level=1&abilityMod=abc');
  check(badMod.status === 400, `non-numeric abilityMod 400s (got ${badMod.status})`);
}

// (i) Coordinator fixes: stringified save round-trips (already
// covered in (f)); partial-scores advance does not 400; the
// /api/spells abilityMod count is the enforced count (covered in (h)).
group('(i) Coordinator fixes: partial scores + save-body shape');
{
  // buildStage1ProgressBody on a partial-scores state builds a body
  // WITHOUT the validation-only score fields — so the advance never
  // sends a body carrying only them.
  const partial = {
    ...blankStage1State(),
    first_name: 'S4', race: 'dwarf', subrace: 'Hill Dwarf',
    generation_method: 'point_buy',
    base_scores: { str: 12, dex: 10 }, // only 2 of 6 placed
  };
  const partialBody = buildStage1ProgressBody(partial);
  check(!('generation_method' in partialBody) && !('base_scores' in partialBody) && !('ability_choice_picks' in partialBody),
    `partial-scores body omits generation_method/base_scores/ability_choice_picks (got ${JSON.stringify(partialBody)})`);
  check(partialBody.race === 'dwarf' && partialBody.name === 'S4',
    'partial-scores body still carries the real picks (race, name)');
  // A complete-scores state DOES carry them — as JSON strings.
  const complete = {
    ...blankStage1State(),
    race: 'dwarf', subrace: 'Hill Dwarf',
    generation_method: 'point_buy', base_scores: DWARF_BASE, ability_scores: DWARF_FINAL,
    ability_choice_picks: {}, skills: ['Athletics', 'Intimidation'],
    languages: ['Common', 'Dwarvish'], known_spells: [], prepared_spells: DWARF_PREPARED,
  };
  const completeBody = buildStage1ProgressBody(complete);
  check(typeof completeBody.base_scores === 'string' && JSON.parse(completeBody.base_scores).str === 12,
    'complete-scores body stringifies base_scores');
  check(typeof completeBody.ability_scores === 'string' && JSON.parse(completeBody.ability_scores).wis === 16,
    'complete-scores body stringifies ability_scores');
  check(typeof completeBody.skills === 'string' && JSON.parse(completeBody.skills).includes('Athletics'),
    'complete-scores body stringifies skills');
  check(typeof completeBody.prepared_spells === 'string' && JSON.parse(completeBody.prepared_spells).length === 4,
    'complete-scores body stringifies prepared_spells');
  check(completeBody.generation_method === 'point_buy', 'complete-scores body carries generation_method');
  check(!('ability_choice_picks' in completeBody), 'empty ability_choice_picks stays out of the body');
  // A choice-pick state carries stringified picks too.
  const withPicks = { ...complete, race: 'half-elf', subrace: 'Mark of Detection', ability_choice_picks: { int: 1 } };
  const picksBody = buildStage1ProgressBody(withPicks);
  check(typeof picksBody.ability_choice_picks === 'string' && JSON.parse(picksBody.ability_choice_picks).int === 1,
    'body stringifies ability_choice_picks when picks exist');
  // Blank state still builds {} (the blank-save guard keeps its meaning).
  check(JSON.stringify(buildStage1ProgressBody(blankStage1State())) === '{}', 'blank state builds {}');
  // A partial-scores ADVANCE does not 400: the body the shell would
  // send (builder output + the marker saveStage1Progress adds) PUTs
  // cleanly onto the row, because it carries real fields and no
  // validation-only score fields.
  const advCreated = await postCharacter({ name: 'S4 Partial Advance', race: 'dwarf', subrace: 'Hill Dwarf', class: 'cleric' });
  check(advCreated.status === 201, `partial-advance fixture POST creates 201 (got ${advCreated.status})`);
  const advBody = { ...buildStage1ProgressBody(partial), creator: MARKER };
  const advPut = await putCharacter(advCreated.json.id, advBody);
  check(advPut.status === 200, `partial-scores advance PUT succeeds 200 (got ${advPut.status}: ${JSON.stringify(advPut.json?.error || '')})`);
  // Server behavior, documented not papered over: a PUT carrying
  // ONLY validation-only fields still 400s "No valid fields to
  // update" server-side (server notes §4.4, pre-existing) — the
  // shell flow is protected because the builder above never sends
  // such a body. The refusal must at least leave the row untouched.
  const onlyCreated = await postCharacter({
    name: 'S4 Partial Only', ...dwarfClericBody(),
    base_scores: DWARF_BASE, ability_scores: J(DWARF_FINAL),
    skills: J(['Athletics', 'Intimidation', 'Religion']),
    languages: J(['Common', 'Dwarvish']), prepared_spells: J(DWARF_PREPARED),
  });
  check(onlyCreated.status === 201, `validation-only PUT fixture POST creates 201 (got ${onlyCreated.status})`);
  const onlyId = onlyCreated.json.id;
  const beforeOnly = await readCharacter(onlyId);
  const onlyPut = await putCharacter(onlyId, {
    creator: MARKER, generation_method: 'point_buy', base_scores: DWARF_BASE,
  });
  check(onlyPut.status === 400 && typeof onlyPut.json?.error === 'string' && onlyPut.json.error.includes('No valid fields to update'),
    `PUT with only validation-only fields 400s "No valid fields to update" (got ${onlyPut.status}: ${JSON.stringify(onlyPut.json?.error)})`);
  const afterOnly = await readCharacter(onlyId);
  check(afterOnly.prepared_spells === beforeOnly.prepared_spells && afterOnly.ability_scores === beforeOnly.ability_scores,
    'validation-only PUT refusal left the row unchanged');
  // And the stringified mark-wizard body from (f) already proved the
  // round-trip; here assert the validator accepts the exact body the
  // builder produces for that wizard (stringified picks included).
  const markBody = buildStage1ProgressBody({
    ...blankStage1State(), race: 'half-elf', subrace: 'Mark of Detection',
    generation_method: 'point_buy', base_scores: MARK_BASE,
    ability_choice_picks: { int: 1 }, ability_scores: MARK_FINAL,
    skills: ['Arcana', 'History', 'Investigation'],
    languages: ['Common', 'Elvish', 'Dwarvish'], prepared_spells: MARK_PREPARED,
  });
  const markValid = validateCreatorNextStage4({
    ...markBody, creator: MARKER, class: 'wizard', theme_id: 'sage',
  });
  check(markValid.ok === true, `builder-produced mark-wizard body validates (${errText(markValid)})`);
}

// (j) Shell / persistence / component static guards.
group('(j) Shell + persistence + component static guards');
{
  const shellSrc = readRepo('client/src/components/creator-next/CreatorNextShell.jsx');
  const persistSrc = readRepo('client/src/components/creator-next/stage1Persistence.js');
  const stage4Src = readRepo('client/src/components/creator-next/Stage4AbilitiesSkillsSpells.jsx');
  check(shellSrc.includes("'Abilities, Skills, & Spells'"), 'shell STAGE_LABELS[3] is "Abilities, Skills, & Spells"');
  check(shellSrc.includes('Stages 1–6 built'), 'shell crumbs read "Stages 1–6 built"');
  check(shellSrc.includes('Stage4AbilitiesSkillsSpells'), 'shell imports the Stage 4 component');
  check(shellSrc.includes('{step === 3 && ('), 'shell renders Stage 4 at step 3');
  check(shellSrc.includes('if (step === 5)'), 'shell step-5 branch is the commit (step > 4 stub guard is gone)');
  check(!shellSrc.includes("3: 'Scores (point-buy default)"), 'shell STAGE_NOTES[3] stub note is removed');
  check(shellSrc.includes("step === 1 || step === 2 || step === 3"), 'shell autosaves on the Stage 4 advance too');
  check(shellSrc.includes("nextLabel={saving ? 'Saving…' : step === 5 ? 'Commit character' : 'Continue'}"),
    'shell Continue label becomes Commit character at step 5');
  check(stage4Src.includes('<h1 className="h-step">Abilities, Skills, &amp; Spells</h1>'),
    'Stage 4 renders the "Abilities, Skills, & Spells" heading');
  // Scores breakdown: Base + Species + Choice + Theme + Final, NO feat line.
  const headStart = stage4Src.indexOf('<th');
  const headEnd = stage4Src.indexOf('</tr>', headStart);
  const head = stage4Src.slice(headStart, headEnd);
  for (const col of ['Base', 'Species', 'Choice', 'Theme', 'Final', 'Mod']) {
    check(head.includes(`>${col}</th>`), `Scores table has a ${col} column`);
  }
  check(!head.includes('Feat'), 'Scores table has no Feat column (origin feats grant no ASI in 2024)');
  // Class skill-pick count is client-enforced: the component caps
  // picks at skillChoices and shows the running count.
  check(stage4Src.includes('effectiveClassPicks.length < skillChoices'),
    'class skill toggle caps picks at skillChoices (client-enforced max)');
  check(stage4Src.includes('of {skillChoices} class skills picked'),
    'class skill section shows the pick count against skillChoices');
  check(stage4Src.includes('const skillChoices = cls?.skillChoices ?? 0'),
    'class skill count reads skillChoices from classes.json');
  const classesRaw = JSON.parse(readRepo('client/src/data/classes.json'));
  const classList = Array.isArray(classesRaw) ? classesRaw : Object.entries(classesRaw).map(([id, c]) => ({ id, ...c }));
  check(classList.every((c) => Number.isInteger(c.skillChoices) && c.skillChoices >= 0),
    'every class in classes.json carries a skillChoices count (the client-enforced source)');
  check(classList.find((c) => c.id === 'bard')?.skillChoices === 3, 'bard skillChoices is 3 in classes.json');
  check(classList.find((c) => c.id === 'rogue')?.skillChoices === 4, 'rogue skillChoices is 4 in classes.json');
  check(classList.find((c) => c.id === 'cleric')?.skillChoices === 2, 'cleric skillChoices is 2 in classes.json');
  // /api/spells fetch sends abilityMod and refetches when finals change.
  check(stage4Src.includes("qs.set('abilityMod', String(abilityMod))"),
    'Stage 4 fetch sends abilityMod to /api/spells');
  check(stage4Src.includes('[classId, state.subclassName, finals]'),
    'Stage 4 spell fetch refetches when finals change');
  check(stage4Src.includes('spellsPrepared') && stage4Src.includes('spellData?.spellsPrepared'),
    'Stage 4 takes the prepared count from the endpoint (single source of truth)');
  // Prepared-count fallback is dataset-derived (item 23, 2026-11-06):
  // the stale "mod + 1, artificer + 0" ternary is gone — it gave
  // blackguard mod+1 at L1 where the server says 0 (paladin is table
  // 2 at L1 since the 2024 PHB correction). Stage 4
  // now reads preparedCountFor(classId, castingMod) from the generated
  // dataset (same rules as the server's getSpellsPrepared), and the Tip
  // reads preparedCountRuleText(classId). The dataset/server agreement
  // itself is pinned by the creator-gaps-batch suite.
  check(!stage4Src.includes("String(classId).toLowerCase() === 'artificer' ? 0 : 1"),
    'stale prepared-count ternary (artificer +0, others +1) is gone');
  check(stage4Src.includes('preparedCountFor(classId, castingMod)'),
    'prepared-count fallback is dataset-derived via preparedCountFor(classId, castingMod)');
  check(stage4Src.includes('preparedCountRuleText(classId)'),
    'prepared-count Tip reads the dataset rule via preparedCountRuleText(classId)');
  // Persistence: Stage 4 fields ride the body, stringified; the
  // marker is still sent by saveStage1Progress, not the body builder.
  for (const f of ['base_scores', 'ability_choice_picks', 'ability_scores', 'skills', 'tool_proficiencies', 'known_spells', 'prepared_spells']) {
    check(persistSrc.includes(`JSON.stringify(state.${f})`), `persistence stringifies ${f}`);
  }
  // R2-15: languages ride as the deduped union of the derived list
  // and the Stage 1 extra-language picks — still stringified on the
  // wire, but from bodyLanguages, not state.languages alone.
  check(persistSrc.includes('JSON.stringify(bodyLanguages)') && persistSrc.includes('state.languageChoices'),
    'persistence stringifies languages (derived list + Stage 1 picks union)');
  check(persistSrc.includes("body.creator = 'creator-next'"), 'saveStage1Progress still sends the creator-next marker');
  check(persistSrc.includes('Object.keys(state.ability_scores).length === 6'),
    'persistence gates score fields on all six ability_scores placed');
  check(persistSrc.includes('generation_method') && persistSrc.includes('ability_scores'),
    'persistence body carries the Stage 4 score fields');
  const blankSrc = persistSrc.slice(persistSrc.indexOf('export function blankStage1State'));
  for (const k of ['generation_method', 'base_scores', 'ability_choice_picks', 'ability_scores', 'skills', 'tool_proficiencies', 'languages', 'known_spells', 'prepared_spells']) {
    check(blankSrc.includes(k), `blank state carries Stage 4 key ${k}`);
  }
  check(!readRepo('server/routes/character.js').includes('DELIBERATELY NOT CALLED'),
    'no stale "DELIBERATELY NOT CALLED" marker in the route');
}

// (k) Bundled client logic: the REAL Stage 4 component bundled with
// esbuild against the real Tooltip.jsx, choiceOptions.js,
// classes.json, references.js and equipment.json, and its real pure
// helpers called — the client worker's /tmp pattern, run here inside
// the suite. React is stubbed (hooks only; the component is never
// rendered), so the bundle proves every import resolves and the
// helpers are the component's own code, not a re-implementation.
group('(k) Bundled Stage 4 client logic (real esbuild bundle)');
{
  const stubPath = path.join(tmpDir, 'react-stub.mjs');
  fs.writeFileSync(stubPath, [
    'export const useState = (v) => [v, () => {}];',
    'export const useEffect = () => {};',
    'export const useMemo = (f) => f();',
    'export const useRef = (v) => ({ current: v });',
    'export const useCallback = (f) => f;',
    'export const useContext = () => null;',
    'export function createElement() { return null; }',
    'export default { createElement: () => null };',
    '',
  ].join('\n'));
  function findEsbuild() {
    const cands = [
      // Windows: .bin/esbuild is a shell shim execFileSync cannot run — use the real binary.
      ...(process.platform === 'win32' ? [path.join(origCwd, 'client', 'node_modules', '@esbuild', `win32-${process.arch}`, 'esbuild.exe')] : []),
      path.join(origCwd, 'client', 'node_modules', '.bin', 'esbuild'),
      path.join(origCwd, 'node_modules', '.bin', 'esbuild'),
    ];
    for (const c of cands) if (fs.existsSync(c)) return { bin: c, prefix: [] };
    return { bin: 'npx', prefix: ['--yes', 'esbuild'] };
  }
  function bundle(entryRel, outName) {
    const { bin, prefix } = findEsbuild();
    const out = path.join(tmpDir, outName);
    execFileSync(bin, [...prefix, path.join(origCwd, entryRel), '--bundle', '--format=esm', `--outfile=${out}`, `--alias:react=${stubPath}`, '--log-level=warning'], { stdio: 'pipe' });
    return out;
  }
  let stage4 = null;
  try {
    const out = bundle('client/src/components/creator-next/Stage4AbilitiesSkillsSpells.jsx', 'stage4.bundle.mjs');
    check(fs.existsSync(out) && fs.statSync(out).size > 1000, 'Stage 4 bundles against the real Tooltip/choiceOptions/classes/references/equipment');
    stage4 = await import(pathToFileURL(out).href);
    check(typeof stage4.default === 'function', 'bundled Stage 4 default export is the component');
  } catch (e) {
    check(false, `Stage 4 esbuild bundle failed: ${e.message}`);
  }
  if (stage4) {
    check(stage4.pointBuyCost(15) === 9, 'bundled pointBuyCost(15) is 9');
    check(stage4.pointBuyCost(14) === 7 && stage4.pointBuyCost(8) === 0, 'bundled pointBuyCost(14) is 7, (8) is 0');
    check(stage4.pointsSpent(DWARF_BASE) === 27, 'bundled pointsSpent(dwarf bases) is exactly 27');
    check(stage4.abilityModifier(16) === 3 && stage4.abilityModifier(8) === -1, 'bundled abilityModifier(16) is +3, (8) is -1');
    // Variant resolvedASI wins outright (built from the live registry,
    // not hardcoded): base half-elf {cha:2, choice:2}, mark {wis:2, choice:1}.
    const entry = {
      abilityScoreIncrease: resolvedASIFor('half-elf', null),
      variants: [{ name: 'Mark of Detection', resolvedASI: resolvedASIFor('half-elf', 'Mark of Detection') }],
    };
    const markASI = stage4.resolveSpeciesASI(entry, 'Mark of Detection');
    check(JSON.stringify(markASI.fixed) === JSON.stringify({ wis: 2 }) && markASI.choice === 1 && markASI.fellBackToBase === false,
      `bundled resolveSpeciesASI(mark) is fixed {wis:2}, choice 1, no fallback (got ${JSON.stringify(markASI)})`);
    const baseASI = stage4.resolveSpeciesASI(entry, null);
    check(JSON.stringify(baseASI.fixed) === JSON.stringify({ cha: 2 }) && baseASI.choice === 2,
      `bundled resolveSpeciesASI(base half-elf) is fixed {cha:2}, choice 2 (got ${JSON.stringify(baseASI)})`);
    const adapterEntry = {
      abilityScoreIncrease: resolvedASIFor('half-elf', null),
      variants: [{ name: 'Mark of Detection' }], // interim adapter: no resolvedASI
    };
    const fallbackASI = stage4.resolveSpeciesASI(adapterEntry, 'Mark of Detection');
    check(fallbackASI.fellBackToBase === true && JSON.stringify(fallbackASI.fixed) === JSON.stringify({ cha: 2 }),
      'bundled resolveSpeciesASI falls back to base ASI (flagged) when the variant carries none');
    check(JSON.stringify(stage4.resolveThemeASI(resolveTheme('soldier'))) === JSON.stringify({ str: 2, con: 1 }),
      'bundled resolveThemeASI(soldier) is {str:2, con:1}');
    check(JSON.stringify(stage4.resolveThemeASI(resolveTheme('sage'))) === JSON.stringify({ int: 2, wis: 1 }),
      'bundled resolveThemeASI(sage) is {int:2, wis:1}');
    check(stage4.finalForAbility('str', 12, { con: 2, wis: 1 }, {}, { str: 2, con: 1 }) === 14,
      'bundled finalForAbility str = base 12 + theme 2 = 14');
    check(stage4.finalForAbility('wis', 15, { con: 2, wis: 1 }, {}, { str: 2, con: 1 }) === 16,
      'bundled finalForAbility wis = base 15 + species 1 = 16');
    check(stage4.finalForAbility('int', 15, {}, { int: 1 }, { int: 2, wis: 1 }) === 18,
      'bundled finalForAbility int = base 15 + choice 1 + theme 2 = 18');
    check(stage4.finalForAbility('cha', null, {}, {}, {}) === null,
      'bundled finalForAbility is null when the base is unplaced');
    check(stage4.scoresComplete(DWARF_BASE) === true, 'bundled scoresComplete is true for six placed bases');
    check(stage4.scoresComplete({ str: 12, dex: 10 }) === false, 'bundled scoresComplete is false for two placed bases');
    check(stage4.scoresComplete({}) === false, 'bundled scoresComplete is false for no bases');
    const classesRaw = JSON.parse(readRepo('client/src/data/classes.json'));
    const classList = Array.isArray(classesRaw) ? classesRaw : Object.entries(classesRaw).map(([id, c]) => ({ id, ...c }));
    const wizardCls = classList.find((c) => c.id === 'wizard');
    check(stage4.recommendedArrayOrder(wizardCls)[0] === 'int', 'bundled recommendedArrayOrder(wizard) starts with int');
    const assigned = stage4.assignStandardArray(wizardCls);
    check(assigned.int === 15 && assigned.wis === 14,
      `bundled assignStandardArray(wizard) gives Int 15, Wis 14 (got ${JSON.stringify(assigned)})`);
    check(JSON.stringify(Object.values(assigned).sort((a, b) => a - b)) === JSON.stringify([8, 10, 12, 13, 14, 15]),
      'bundled assignStandardArray uses exactly the standard-array values');
    const featPicks = stage4.classifyFeatPickValues(['Perception', 'perception', "Thieves' Tools", 'Elvish', 'Longsword']);
    check(featPicks.skills.length === 1 && featPicks.skills[0] === 'perception',
      `bundled classifyFeatPickValues dedupes the skill pick (got ${JSON.stringify(featPicks.skills)})`);
    check(featPicks.tools.includes("Thieves' Tools"), 'bundled classifyFeatPickValues classifies the tool pick');
    check(featPicks.languages.includes('Elvish'), 'bundled classifyFeatPickValues classifies the language pick');
    check(!JSON.stringify(featPicks).includes('Longsword'), 'bundled classifyFeatPickValues ignores a weapon pick');
    const split = stage4.splitClassTools(['Herbalism Kit', "One type of artisan's tools of your choice"]);
    check(split.granted.includes('Herbalism Kit') && split.info.length === 1,
      'bundled splitClassTools grants the exact tool and keeps free text informational');
    check(stage4.formatAsi({ str: 2, con: 1 }) === '+2 Str, +1 Con', 'bundled formatAsi renders "+2 Str, +1 Con"');
  }
  // The shell bundles too (it imports Stage 4 + Stages 1–3 +
  // persistence + validation): every import resolves after the
  // coordinator's edits.
  try {
    const out = bundle('client/src/components/creator-next/CreatorNextShell.jsx', 'shell.bundle.mjs');
    check(fs.existsSync(out) && fs.statSync(out).size > 1000, 'shell bundles against the real Stage 4 + Stages 1–3 + persistence');
    const shellMod = await import(pathToFileURL(out).href);
    check(typeof shellMod.default === 'function', 'bundled shell default export is the component');
  } catch (e) {
    check(false, `shell esbuild bundle failed: ${e.message}`);
  }
}

// (l) Wizard spellbook: the two-list picker (2026-11-07). The
// envelope serves spellbookSize (6 at L1, null for non-wizards);
// Stage 4 accepts exactly 6 L1 wizard spells as the book with the
// prepared subset inside it, refuses a prepared spell outside the
// book, a short book, a cantrip in the book, and a granted spell in
// the book — and stays draft-tolerant on an empty book (the commit
// is what refuses that; Stage 6 group (h7b) pins that end). The
// bundled component pins the picker itself; the mutation check
// proves the pins are branch-sensitive.
group('(l) Wizard spellbook: two-list picker (Stage 4)');
{
  const wizEnv = await getSpells('?class=wizard&level=1&abilityMod=3');
  check(wizEnv.json?.spellbookSize === 6, 'wizard envelope serves spellbookSize 6 at L1');
  check(wizEnv.json?.spellsPrepared === 4 && wizEnv.json?.spellsKnown === null,
    'wizard envelope still serves spellsPrepared 4 and spellsKnown null (not repurposed)');
  const clericEnv = await getSpells('?class=cleric&level=1&abilityMod=3');
  check(clericEnv.json?.spellbookSize === null, 'cleric envelope serves spellbookSize null (no book)');
  // The mark wizard's 6-spell book: its 5 prepared spells plus a
  // 6th L1 wizard spell. Both extra names are asserted through the
  // real canLearnSpell first, not assumed.
  check(canLearnSpell({ classId: 'wizard', level: 1, spellName: 'burning hands' }).ok === true,
    'burning hands is a learnable L1 wizard spell for the book fixture');
  check(canLearnSpell({ classId: 'wizard', level: 1, spellName: 'comprehend languages' }).ok === true,
    'comprehend languages is a learnable L1 wizard spell for the outside-book fixture');
  const MARK_BOOK = [...MARK_PREPARED, 'burning hands'];
  const withBook = validateCreatorNextStage4(markWizardBody({ known_spells: MARK_BOOK }));
  check(withBook.ok === true,
    `mark wizard with a 6-spell book and a prepared subset passes Stage 4 (got ${errText(withBook)})`);
  const outsideBook = validateCreatorNextStage4(markWizardBody({
    known_spells: MARK_BOOK,
    prepared_spells: ['magic missile', 'shield', 'mage armor', 'sleep', 'comprehend languages'],
  }));
  check(outsideBook.ok === false && errText(outsideBook).includes('preparedSpells:') && errText(outsideBook).includes('not in the spellbook'),
    `wizard prepared outside the book refuses naming the spellbook (got ${errText(outsideBook)})`);
  const shortBook = validateCreatorNextStage4(markWizardBody({ known_spells: MARK_BOOK.slice(0, 5) }));
  check(shortBook.ok === false && errText(shortBook).includes('knownSpells:') && errText(shortBook).includes('6'),
    `a 5-spell wizard book refuses the count (got ${errText(shortBook)})`);
  const cantripBook = validateCreatorNextStage4(markWizardBody({ known_spells: [...MARK_BOOK.slice(0, 5), 'fire bolt'] }));
  check(cantripBook.ok === false && errText(cantripBook).includes('knownSpells:') && errText(cantripBook).includes('cantrip'),
    `a cantrip in the wizard book refuses (got ${errText(cantripBook)})`);
  // Detect Magic is granted to this Mark of Detection wizard — it
  // must never enter the book (or the prepared list).
  const grantedBook = validateCreatorNextStage4(markWizardBody({ known_spells: [...MARK_BOOK.slice(0, 5), 'detect magic'] }));
  check(grantedBook.ok === false && errText(grantedBook).includes('knownSpells:') && errText(grantedBook).includes('already granted'),
    `a granted spell in the wizard book refuses (got ${errText(grantedBook)})`);
  // Draft-tolerant: prepared spells with no book yet still save at
  // Stage 4 — the commit refusal is what catches it.
  check(validateCreatorNextStage4(markWizardBody()).ok === true,
    'a wizard with prepared spells but no book still passes Stage 4 (draft-tolerant)');
  // Bundled component pins: the real Stage 4 JSX, bundled with
  // esbuild (group (k) pattern, local bundle helper — the (k)
  // helper is block-scoped).
  const stubPathL = path.join(tmpDir, 'react-stub-l.mjs');
  fs.writeFileSync(stubPathL, [
    'export const useState = (v) => [v, () => {}];',
    'export const useEffect = () => {};',
    'export const useMemo = (f) => f();',
    'export const useRef = (v) => ({ current: v });',
    'export const useCallback = (f) => f;',
    'export const useContext = () => null;',
    'export function createElement() { return null; }',
    'export default { createElement: () => null };',
    '',
  ].join('\n'));
  function findEsbuildL() {
    const cands = [
      // Windows: .bin/esbuild is a shell shim execFileSync cannot run — use the real binary.
      ...(process.platform === 'win32' ? [path.join(origCwd, 'client', 'node_modules', '@esbuild', `win32-${process.arch}`, 'esbuild.exe')] : []),
      path.join(origCwd, 'client', 'node_modules', '.bin', 'esbuild'),
      path.join(origCwd, 'node_modules', '.bin', 'esbuild'),
    ];
    for (const c of cands) if (fs.existsSync(c)) return { bin: c, prefix: [] };
    return { bin: 'npx', prefix: ['--yes', 'esbuild'] };
  }
  function bundleAbs(entryAbs, outName) {
    const { bin, prefix } = findEsbuildL();
    const out = path.join(tmpDir, outName);
    execFileSync(bin, [...prefix, entryAbs, '--bundle', '--format=esm', `--outfile=${out}`, `--alias:react=${stubPathL}`, '--log-level=warning'], { stdio: 'pipe' });
    return out;
  }
  let stage4Src = null;
  try {
    const out = bundleAbs(path.join(origCwd, 'client/src/components/creator-next/Stage4AbilitiesSkillsSpells.jsx'), 'stage4-spellbook.bundle.mjs');
    stage4Src = fs.readFileSync(out, 'utf-8');
    check(stage4Src.length > 1000, 'Stage 4 spellbook bundle builds');
  } catch (e) {
    check(false, `Stage 4 spellbook bundle failed: ${e.message}`);
  }
  if (stage4Src) {
    check(stage4Src.includes('Spellbook (choose'), 'bundled Stage 4 renders the spellbook picker');
    check(stage4Src.includes('toggleBookSpell'), 'bundled Stage 4 defines the book toggle');
    check(stage4Src.includes('spellbookSize'), 'bundled Stage 4 reads the envelope spellbookSize');
    check(stage4Src.includes('spellbookSize: spellbookSizeFor(classId)'), 'bundled fallback serves spellbookSize from the bundled catalog');
    check(stage4Src.includes('Pick your spellbook above first'), 'bundled Stage 4 tells a bookless wizard to pick the book first');
    check(stage4Src.includes('Prepared but not in the spellbook'), 'bundled Stage 4 warns on a prepared spell outside the book');
    check(stage4Src.includes('A wizard prepares FROM the spellbook above'), 'bundled Stage 4 prepared Tip names the book rule');
    // Mutation check: delete the picker label from a temp copy — the
    // pin must fail on the mutated bundle, proving it is sensitive
    // to the picker itself and not to a comment or a stale string.
    // The temp copy lives beside the real file (same directory, so
    // its relative imports resolve) and is unlinked in the finally.
    const mutatedPath = path.join(origCwd, 'client/src/components/creator-next/Stage4AbilitiesSkillsSpells.mutated.jsx');
    fs.writeFileSync(mutatedPath, readRepo('client/src/components/creator-next/Stage4AbilitiesSkillsSpells.jsx').replace('Spellbook (choose', 'SpellbookXX (choose'));
    let mutatedSrc = null;
    try {
      mutatedSrc = fs.readFileSync(bundleAbs(mutatedPath, 'stage4-mutated.bundle.mjs'), 'utf-8');
    } catch (e) {
      check(false, `mutated Stage 4 bundle failed: ${e.message}`);
    } finally {
      try { fs.unlinkSync(mutatedPath); } catch {}
    }
    if (mutatedSrc) {
      check(!mutatedSrc.includes('Spellbook (choose'), 'mutation check: the picker-label pin fails when the picker label is deleted');
      check(mutatedSrc.includes('toggleBookSpell'), 'mutation check: the mutated bundle still builds (only the label went)');
    }
  }
}

server.close();
console.log(`=== Results: ${passed} passed, ${failed} failed ===`);
process.exit(failed ? 1 : 0);
