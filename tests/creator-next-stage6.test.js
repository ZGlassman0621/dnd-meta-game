// tests/creator-next-stage6.test.js — creator-next Stage 6
// ("Review & Commit" + edit mode) build (Zach, 2026-11-07).
//
// What this build wires in:
//   - NEW client/src/components/creator-next/Stage6ReviewCommit.jsx —
//     Page 12 readout (head line, scores breakdown, derived numbers,
//     traits, languages/proficiencies, spells, features, equipment +
//     gold, story), validation grouped by stage with a jump button
//     each, one server-validated commit (POST /api/character/:id/
//     commit — the 404 → PUT fallback is deleted, 2026-11-07
//     follow-up), edit-mode preservation line. No heirloom section (deferred, no design),
//     no distinguishing-features field (the column exists —
//     migration 060 — and the commit persists it when sent; the
//     client simply does not collect it in Review yet).
//   - Shell: step 5 renders Stage 6 (stub guard + "Not built yet"
//     panel gone), crumbs "Stages 1–6 built", WizardFoot isLast at
//     step 5 with nextLabel 'Commit character', Continue at step 5 IS
//     the commit (commitRef), onCommitted + mode props (mode threaded
//     to Stage 1 instead of hardcoded "manual").
//   - 2026-11-07 follow-up: Stage 2 picks cantrips (GET
//     /api/spells?class=X&level=0) + fighting style (GET
//     /api/fighting-styles); the save/commit bodies carry
//     fighting_style + subclass_choices + known_cantrips; Review
//     blocks on an incomplete cantrip list or a missing prepared
//     list before the server 400; the 404 → PUT fallback is deleted
//     (the route exists live — a 404 means an unknown id).
//   - HomeFlow: onCommitted reloads the roster and routes home WITHOUT
//     calling App's handleCharacterCreated (plan: submit does NOT start
//     play); Edit routing (creatorMode) + handleEditCharacter.
//   - HomeScreenV2: Edit affordance on active cards only (sibling of
//     the card button, stops propagation — never hijacks the whole-card
//     click). CharacterSheet: "Edit in creator" next to "Edit Details"
//     (onEditInCreator prop). App: editCharacterId renders the shell
//     in edit mode for that character.
//   - The 8 stub-string pins in stage3/stage4/stage5 tests move to the
//     new shell state in the same pass (see those files).
//
// Honest integration tests: the real Stage 6 module (pure helpers from
// a real esbuild bundle of the staged JSX, Stage 4/5 group-(k)
// pattern) + the real character router over real HTTP against a real
// throwaway DB (Stage 3/4/5 harness). The commit route landed
// 2026-11-07 (server worker), so group (h) exercises the real
// endpoint: an incomplete draft gets the real 400, a completed draft
// commits and flips to active. The 404 → PUT fallback is deleted
// (2026-11-07 follow-up): the route exists, so group (h) pins its
// absence statically in group (d) instead of exercising it. Footer
// is the runner-matching `Results:` form so the count aggregates.
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

const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'creator-next-stage6-test-'));
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
const { buildStage1ProgressBody, blankStage1State, saveStage1Progress, rehydrateStateFromServerRow } = await import(fromRepo('client/src/components/creator-next/stage1Persistence.js'));
// The Stage 6 component is JSX: Node cannot import it directly, so its
// pure helpers are tested from a real esbuild bundle of the staged JSX
// (built once up front, Stage 4's group-(k) pattern) — the helpers are
// the component's own code, not a re-implementation.
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
const stage6BundleOut = bundle('client/src/components/creator-next/Stage6ReviewCommit.jsx', 'stage6.bundle.mjs');
const stage6 = await import(pathToFileURL(stage6BundleOut).href);
const {
  formatOriginLine, deriveScoreBreakdown, renderTrait, grantedSpells,
  validateReview, stageForServerError, buildCommitBody, commitCharacter,
  cantripCompleteness, classLevelFor: reviewClassLevelFor,
} = stage6;
// Stage 2 is JSX too: its real picker gate is tested from a real
// esbuild bundle the same way (Stage 4's group-(k) pattern) — the
// gate is the component's own code, not a re-implementation.
const stage2BundleOut = bundle('client/src/components/creator-next/Stage2ClassCalling.jsx', 'stage2.bundle.mjs');
const stage2 = await import(pathToFileURL(stage2BundleOut).href);
const { fightingStyleGate, classLevelFor: stage2ClassLevelFor } = stage2;

// --- HTTP harness: the real character router on one app ---------------
const app = express();
app.use(express.json());
const characterRouter = (await import(fromRepo('server/routes/character.js'))).default;
app.use('/api/character', characterRouter);
// The Stage 2 picker reads the real lists, so the fixtures derive
// their cantrips + styles from the live endpoints, not literals.
const spellsRouter = (await import(fromRepo('server/routes/spells.js'))).default;
app.use('/api/spells', spellsRouter);
const fightingStylesRouter = (await import(fromRepo('server/routes/fightingStyles.js'))).default;
app.use('/api/fighting-styles', fightingStylesRouter);
const server = await new Promise((resolve) => {
  const s = app.listen(0, '127.0.0.1', () => resolve(s));
});
const base = `http://127.0.0.1:${server.address().port}`;
// The client modules fetch relative URLs (same-origin in the browser);
// — in Node, prefix them with the test server's base.
const nodeFetch = globalThis.fetch;
globalThis.fetch = (url, opts) => {
  const u = typeof url === 'string' && url.startsWith('/') ? base + url : url;
  return nodeFetch(u, opts);
};
async function readCharacter(id) {
  return db.dbGet('SELECT * FROM characters WHERE id = ?', [id]);
}
async function characterCountByName(name) {
  const row = await db.dbGet('SELECT COUNT(*) AS n FROM characters WHERE name = ?', [name]);
  return row?.n ?? 0;
}

const MARKER = 'creator-next';
const J = (v) => JSON.stringify(v); // the wire format for JSON columns: strings, not raw arrays

// --- Fixtures ----------------------------------------------------------
// Dwarf cleric body, verbatim from the Stage 5 test's known-good
// marker POST (group (h)) — the server accepts it, so the commit
// tests below start from a row the validators already bless.
const DWARF_BASE = { str: 12, dex: 10, con: 13, int: 8, wis: 15, cha: 14 };
const DWARF_FINAL = { str: 14, dex: 10, con: 16, int: 8, wis: 16, cha: 14 };
const DWARF_PREPARED = ['bless', 'cure wounds', 'guiding bolt', 'shield of faith'];
// Minimal species entry for the score-breakdown tests: fixed +2 Con,
// no variant, no choice ASI. Theme: fixed +2 Str / +1 Wis.
const DWARF_ENTRY = { id: 'dwarf', name: 'Dwarf', abilityScoreIncrease: { con: 2 }, languages: ['Common', 'Dwarvish'], traits: ['Darkvision — you can see in dim light within 60 feet as if it were bright light.'] };
const SOLDIER_THEME = { id: 'soldier', name: 'Soldier', ability_score_increase: { str: 2, wis: 1 }, signature_skills: ['Athletics', 'Intimidation'], abilities: [{ tier: 1, name: 'Battle-Tested', mechanics: 'You have advantage on saving throws against being frightened.' }], origin_feat: 'alert', origin_feat_name: 'Alert' };

function completeState() {
  return {
    ...blankStage1State(),
    first_name: 'S6', last_name: 'Review', nickname: 'Six', gender: 'Female',
    race: 'dwarf', subrace: 'Hill Dwarf', ancestry_feat_id: 7,
    ancestry_feat_choices: { languages: ['Elvish'] },
    origin_setting: 'Forgotten Realms', origin_region: 'Sword Coast',
    classId: 'fighter', subclassName: '', fightingStyle: 'Defense',
    themeId: 'soldier', originFeat: 'alert', originFeatChoices: {},
    generation_method: 'point_buy',
    base_scores: { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 },
    ability_scores: { str: 17, dex: 14, con: 15, int: 12, wis: 11, cha: 8 },
    skills: ['Athletics', 'Intimidation', 'Perception'],
    tool_proficiencies: ["Smith's Tools"], languages: ['Common', 'Dwarvish'],
    known_spells: [], prepared_spells: [],
    gear_choice: 'packages', package_id: 'A', package_picks: {},
    alignment: 'Lawful Good', faith: 'Moradin', lifestyle: 'Modest',
    age: '27', height: "5'9\"", weight: '180 lb',
    eye_color: 'Brown', hair_color: 'Black', skin_color: 'Tan', physical_build: 'Wiry',
    personality_traits: 'Laughs at danger.', ideals: 'Freedom.',
    bonds: 'My sister.', flaws: 'Too trusting.',
  };
}

function draftClericState() {
  // Deliberately INCOMPLETE draft: no gender, origin, origin feat,
  // ancestry feat, or full story — group (h1) commits it and expects
  // the real 400 naming the missing fields. Mirrors the Stage 5
  // known-good body otherwise, as draft state.
  return {
    ...blankStage1State(),
    first_name: 'S6', last_name: 'Dwarf Cleric',
    race: 'dwarf', subrace: 'Hill Dwarf',
    classId: 'cleric',
    themeId: 'soldier',
    themePathChoice: 'sergeant', themePathData: 'active',
    generation_method: 'point_buy',
    base_scores: DWARF_BASE, ability_scores: DWARF_FINAL,
    skills: ['Athletics', 'Intimidation', 'Religion'],
    languages: ['Common', 'Dwarvish'],
    prepared_spells: DWARF_PREPARED,
    gear_choice: 'packages', package_id: 'A',
    package_picks: { A: { holy: { alternative: 0 } } },
    alignment: 'Lawful Good', faith: 'Moradin', lifestyle: 'Modest',
    backstory: 'Left the hold at sixteen.', eye_color: 'Brown',
  };
}

// A COMPLETE draft the client can actually commit end-to-end (group
// (h2)): a dwarf ROGUE. Rogue needs no cantrips and no fighting
// style. Values mirror the server commit suite's known-good dwarf
// draft: soldier theme (feat savage_attacker, ASI Str +2 / Con +1),
// dwarf +2 Con, legal point-buy base, gold fork (rogue: 100 gp,
// soldier modifier 0). Cleric (h3) and fighter (h4) commit
// end-to-end below now that the client sends cantrips + style.
const ROGUE_BASE = { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 };
const ROGUE_FINAL = { str: 17, dex: 14, con: 16, int: 12, wis: 11, cha: 8 };
const ROGUE_SKILLS = ['Athletics', 'Intimidation', 'Perception', 'Stealth', 'Sleight of Hand', 'Investigation'];
function draftRogueState(stoutHeartedId) {
  return {
    ...blankStage1State(),
    first_name: 'S6', last_name: 'Rogue', gender: 'Female',
    race: 'dwarf', subrace: 'Hill Dwarf',
    ancestry_feat_id: stoutHeartedId, ancestry_feat_choices: {},
    origin_setting: 'Forgotten Realms', origin_region: 'Sword Coast',
    origin_explanation: 'Born in the Sword Coast.',
    classId: 'rogue',
    themeId: 'soldier', originFeat: 'savage_attacker', originFeatChoices: {},
    themePathChoice: 'sergeant', themePathData: 'active',
    generation_method: 'point_buy',
    base_scores: ROGUE_BASE, ability_scores: ROGUE_FINAL,
    skills: [...ROGUE_SKILLS],
    tool_proficiencies: ["Smith's Tools"], languages: ['Common', 'Dwarvish'],
    known_spells: [], prepared_spells: [],
    gear_choice: 'gold',
    alignment: 'Lawful Good', faith: 'Moradin', lifestyle: 'Modest',
    age: '58', height: `4'3"`, weight: '180 lb',
    eye_color: 'Brown', hair_color: 'Black', skin_color: 'Tan', physical_build: 'Sturdy',
    personality_traits: 'Laughs at danger.', ideals: 'Freedom.',
    bonds: 'My sister.', flaws: 'Too trusting.',
  };
}

// A COMPLETE cleric draft the client can commit end-to-end (group
// (h3)): the (h1) draft completed — gender, origin, origin feat,
// ancestry feat, physical story fields — plus the 3 real cleric
// cantrips (keys from the live /api/spells?level=0 list, passed in
// by the group). Mirrors the server commit suite's known-good dwarf
// cleric: soldier theme (savage_attacker, ASI Str +2 / Wis +1),
// dwarf +2 Con, DWARF_PREPARED (4 = Wis mod +3 + level 1).
function draftClericCompleteState(stoutHeartedId, cantripKeys) {
  return {
    ...draftClericState(),
    first_name: 'S6', last_name: 'Cleric', gender: 'Female',
    origin_setting: 'Forgotten Realms', origin_region: 'Sword Coast',
    origin_explanation: 'Born in the Sword Coast.',
    ancestry_feat_id: stoutHeartedId, ancestry_feat_choices: {},
    originFeat: 'savage_attacker', originFeatChoices: {},
    knownCantrips: [...cantripKeys],
    age: '58', height: `4'3"`, weight: '180 lb',
    hair_color: 'Black', skin_color: 'Tan', physical_build: 'Sturdy',
  };
}

// A COMPLETE fighter draft (group (h4)): soldier sigs + 2 fighter
// picks (Acrobatics, Perception), fighting style Defense, gold fork.
// A fighter has no cantrips at level 1 — knownCantrips stays empty,
// and the commit must not require any.
function draftFighterState(stoutHeartedId) {
  return {
    ...blankStage1State(),
    first_name: 'S6', last_name: 'Fighter', gender: 'Female',
    race: 'dwarf', subrace: 'Hill Dwarf',
    ancestry_feat_id: stoutHeartedId, ancestry_feat_choices: {},
    origin_setting: 'Forgotten Realms', origin_region: 'Sword Coast',
    origin_explanation: 'Born in the Sword Coast.',
    classId: 'fighter', fightingStyle: 'Defense',
    themeId: 'soldier', originFeat: 'savage_attacker', originFeatChoices: {},
    themePathChoice: 'sergeant', themePathData: 'active',
    generation_method: 'point_buy',
    base_scores: ROGUE_BASE, ability_scores: ROGUE_FINAL,
    skills: ['Athletics', 'Intimidation', 'Acrobatics', 'Perception'],
    tool_proficiencies: ["Smith's Tools"], languages: ['Common', 'Dwarvish'],
    known_spells: [], prepared_spells: [], knownCantrips: [],
    gear_choice: 'gold',
    alignment: 'Lawful Good', faith: 'Moradin', lifestyle: 'Modest',
    age: '58', height: `4'3"`, weight: '180 lb',
    eye_color: 'Brown', hair_color: 'Black', skin_color: 'Tan', physical_build: 'Sturdy',
    personality_traits: 'Laughs at danger.', ideals: 'Freedom.',
    bonds: 'My sister.', flaws: 'Too trusting.',
  };
}

// A COMPLETE paladin draft (group (h5)): the §11 flag made concrete
// — a level-1 paladin prepares 2 spells (fixed 2024 table) and the
// commit refuses without the prepared list, even though Stage 4
// alone tolerates an empty one. Prepared keys come from the live
// /api/spells?level=1 list, passed in by the group.
const PALADIN_BASE = { str: 15, dex: 10, con: 13, int: 8, wis: 12, cha: 14 };
// Finals under the REAL soldier theme (Str +2 / Con +1 — the
// SOLDIER_THEME fixture above is a synthetic {str:2, wis:1} for the
// pure-helper tests only) + Hill Dwarf (+2 Con, +1 Wis): str 17,
// con 16, wis 13.
const PALADIN_FINAL = { str: 17, dex: 10, con: 16, int: 8, wis: 13, cha: 14 };
function draftPaladinState(stoutHeartedId, preparedKeys) {
  return {
    ...blankStage1State(),
    first_name: 'S6', last_name: 'Paladin', gender: 'Female',
    race: 'dwarf', subrace: 'Hill Dwarf',
    ancestry_feat_id: stoutHeartedId, ancestry_feat_choices: {},
    origin_setting: 'Forgotten Realms', origin_region: 'Sword Coast',
    origin_explanation: 'Born in the Sword Coast.',
    classId: 'paladin',
    themeId: 'soldier', originFeat: 'savage_attacker', originFeatChoices: {},
    themePathChoice: 'sergeant', themePathData: 'active',
    generation_method: 'point_buy',
    base_scores: PALADIN_BASE, ability_scores: PALADIN_FINAL,
    skills: ['Athletics', 'Intimidation', 'Insight', 'Religion'],
    tool_proficiencies: ["Smith's Tools"], languages: ['Common', 'Dwarvish'],
    known_spells: [], prepared_spells: [...preparedKeys], knownCantrips: [],
    gear_choice: 'gold',
    alignment: 'Lawful Good', faith: 'Moradin', lifestyle: 'Modest',
    age: '58', height: `4'3"`, weight: '180 lb',
    eye_color: 'Brown', hair_color: 'Black', skin_color: 'Tan', physical_build: 'Sturdy',
    personality_traits: 'Laughs at danger.', ideals: 'Freedom.',
    bonds: 'My sister.', flaws: 'Too trusting.',
  };
}
// A COMPLETE ranger draft (group (j)): same dwarf/soldier shape as the
// paladin, with ranger-legal skills (the server commit suite's (q)
// list: soldier sigs + Perception/Survival/Nature) and 2 prepared
// spells from the live /api/spells?class=ranger&level=1 list.
function draftRangerState(stoutHeartedId, preparedKeys) {
  return {
    ...draftPaladinState(stoutHeartedId, preparedKeys),
    first_name: 'S6', last_name: 'Ranger',
    classId: 'ranger',
    skills: ['Athletics', 'Intimidation', 'Perception', 'Survival', 'Nature'],
  };
}
// A COMPLETE wizard draft (group (h7)): the two-list spellbook made
// concrete — a 6-spell book in known_spells and a prepared subset
// (first 3 — Int mod +2 at L1) in prepared_spells, both drawn from
// the live /api/spells?level=1 list, plus the 3 wizard cantrips from
// the live level-0 list. Point buy: 8/14/13/15/12/10 = 27. Finals
// under the REAL soldier theme (Str +2 / Con +1) + Hill Dwarf
// (+2 Con, +1 Wis): str 10, con 16, wis 13, int 15 (mod +2 → 3
// prepared at L1).
const WIZARD_BASE = { str: 8, dex: 14, con: 13, int: 15, wis: 12, cha: 10 };
const WIZARD_FINAL = { str: 10, dex: 14, con: 16, int: 15, wis: 13, cha: 10 };
function draftWizardState(stoutHeartedId, cantripKeys, bookKeys, preparedKeys) {
  return {
    ...blankStage1State(),
    first_name: 'S6', last_name: 'Wizard', gender: 'Female',
    race: 'dwarf', subrace: 'Hill Dwarf',
    ancestry_feat_id: stoutHeartedId, ancestry_feat_choices: {},
    origin_setting: 'Forgotten Realms', origin_region: 'Sword Coast',
    origin_explanation: 'Born in the Sword Coast.',
    classId: 'wizard',
    themeId: 'soldier', originFeat: 'savage_attacker', originFeatChoices: {},
    themePathChoice: 'sergeant', themePathData: 'active',
    generation_method: 'point_buy',
    base_scores: WIZARD_BASE, ability_scores: WIZARD_FINAL,
    skills: ['Athletics', 'Intimidation', 'Arcana', 'Investigation'],
    tool_proficiencies: ["Smith's Tools"], languages: ['Common', 'Dwarvish'],
    known_spells: [...bookKeys], prepared_spells: [...preparedKeys], knownCantrips: [...cantripKeys],
    gear_choice: 'gold',
    alignment: 'Lawful Good', faith: 'Moradin', lifestyle: 'Modest',
    age: '58', height: `4'3"`, weight: '180 lb',
    eye_color: 'Brown', hair_color: 'Black', skin_color: 'Tan', physical_build: 'Sturdy',
    personality_traits: 'Laughs at danger.', ideals: 'Freedom.',
    bonds: 'My sister.', flaws: 'Too trusting.',
  };
}
group('(a) Origin line + score breakdown');
{
  check(formatOriginLine({ origin_setting: 'Forgotten Realms', origin_region: 'Sword Coast', origin_explanation: '' })
    === 'Origin: Forgotten Realms — Sword Coast',
    'origin line joins setting + region with em dashes');
  check(formatOriginLine({ origin_setting: 'Eberron', origin_setting_custom: '', origin_region: 'Sharn', origin_explanation: 'Came through a portal' })
    === 'Origin: Eberron — Sharn — Came through a portal',
    'origin line carries the outside-FR explanation verbatim');
  check(formatOriginLine({}) === 'Origin: not picked yet',
    'origin line says so plainly when nothing is picked');

  const bd = deriveScoreBreakdown(completeState(), DWARF_ENTRY, SOLDIER_THEME);
  check(bd.complete === true, 'breakdown is complete once all six bases are placed');
  const byAb = Object.fromEntries(bd.rows.map(r => [r.ab, r]));
  check(byAb.str.final === 17 && byAb.str.base === 15 && byAb.str.species === 0 && byAb.str.theme === 2,
    `Str breakdown is base 15 + species 0 + theme 2 = 17 (got ${JSON.stringify(byAb.str)})`);
  check(byAb.con.final === 15 && byAb.con.species === 2 && byAb.con.mod === 2,
    `Con breakdown is base 13 + species 2 = 15, mod +2 (got ${JSON.stringify(byAb.con)})`);
  check(byAb.wis.final === 11 && byAb.wis.theme === 1,
    'Wis breakdown carries the theme +1');
  check(bd.clamped.length === 0, 'no clamped abilities in the normal case');

  // Clamp: base 17 + species +2 = 19 clamps at 18 and is named.
  const clampState = { ...completeState(), base_scores: { str: 17, dex: 14, con: 13, int: 12, wis: 10, cha: 8 } };
  const clampEntry = { ...DWARF_ENTRY, abilityScoreIncrease: { str: 2, con: 2 } };
  const cl = deriveScoreBreakdown(clampState, clampEntry, SOLDIER_THEME);
  const clStr = cl.rows.find(r => r.ab === 'str');
  check(clStr.final === 18 && clStr.clamped === true, 'a 19 final clamps to 18');
  check(cl.clamped.includes('Strength'), 'the clamped ability is named (Strength)');

  // Mixed ancestry: species ASI is 0, theme still applies.
  const mixedState = { ...completeState(), race: '', mixedAncestry: { parents: ['human', 'elf'], traits: [], size: 'Medium', speed: 30, forgoOriginFeat: false, versatileFeat: '' } };
  const mixedBd = deriveScoreBreakdown(mixedState, null, SOLDIER_THEME);
  const mixedStr = mixedBd.rows.find(r => r.ab === 'str');
  check(mixedStr.species === 0 && mixedStr.final === 17,
    'mixed ancestry: species ASI is 0, theme +2 still applies (Str 15 + 0 + 2 = 17)');

  // Incomplete: point buy DISPLAYS unplaced scores as 8 (Stage 4's
  // preview floor) but stores nothing — completeness comes from
  // scoresComplete, and the row knows it was never placed.
  const partial = { ...completeState(), base_scores: { str: 15, dex: 14 } };
  const pb = deriveScoreBreakdown(partial, DWARF_ENTRY, SOLDIER_THEME);
  check(pb.complete === false && pb.rows.find(r => r.ab === 'con').placed === false,
    'unplaced bases leave the breakdown incomplete and the row unplaced');

  // Traits render from either shape, never crash.
  check(renderTrait('Darkvision').name === 'Darkvision' && renderTrait('Darkvision').note === '',
    'string trait renders as its own name');
  check(renderTrait({ name: 'Fey Ancestry', description: 'Advantage vs charm.' }).note === 'Advantage vs charm.',
    'object trait renders name + in-play note');
  check(renderTrait(null) === null, 'null trait renders null, not a crash');
}

// ===========================================================================
// (b) Review validation, grouped by stage
// ===========================================================================
group('(b) Review validation, grouped by stage');
{
  const ctx = { speciesEntry: DWARF_ENTRY, speciesEntries: [DWARF_ENTRY], mixedTables: null, themes: [SOLDIER_THEME], subclassesByClass: {} };
  const ok = validateReview(completeState(), ctx);
  check(ok.canCommit === true && ok.errors.length === 0,
    `a complete draft validates clean (got ${JSON.stringify(ok.errors)})`);

  const noName = validateReview({ ...completeState(), first_name: '' }, ctx);
  check(noName.canCommit === false && noName.errors.some(e => e.stageIndex === 0),
    'a missing first name blocks at Stage 1 (stageIndex 0)');

  const noClass = validateReview({ ...completeState(), classId: '', fightingStyle: '' }, ctx);
  check(noClass.errors.some(e => e.stageIndex === 1 && e.field === 'class'),
    'a missing class blocks at Stage 2 (stageIndex 1)');

  const noTheme = validateReview({ ...completeState(), themeId: '', originFeat: '' }, ctx);
  check(noTheme.errors.some(e => e.stageIndex === 2 && e.field === 'theme'),
    'a missing theme blocks at Stage 3 (stageIndex 2)');

  const noScores = validateReview({ ...completeState(), base_scores: {} }, ctx);
  check(noScores.errors.some(e => e.stageIndex === 3 && e.field === 'base_scores'),
    'unplaced scores block at Stage 4 (stageIndex 3)');

  const noGear = validateReview({ ...completeState(), gear_choice: '', alignment: '', faith: '', lifestyle: '' }, ctx);
  check(noGear.errors.some(e => e.stageIndex === 4 && e.field === 'gear_choice')
    && noGear.errors.some(e => e.stageIndex === 4 && e.field === 'alignment'),
    'missing gear + story anchors block at Stage 5 (stageIndex 4)');

  // Outside-FR origin without its explanation blocks at Stage 1, in
  // plain words naming the reason (the origin gate).
  const outside = validateReview({
    ...completeState(), origin_setting: 'Eberron', origin_region: 'Sharn', origin_explanation: '',
  }, ctx);
  check(outside.errors.some(e => e.stageIndex === 0 && /outside the Forgotten Realms/.test(e.message)),
    'outside-FR origin without an explanation blocks at Stage 1 in plain words');

  // Fighter without a fighting style blocks at Stage 2.
  const noStyle = validateReview({ ...completeState(), fightingStyle: '' }, ctx);
  check(noStyle.errors.some(e => e.stageIndex === 1 && e.field === 'fightingStyle'),
    'a fighter without a fighting style blocks at Stage 2');

  // A level-1 subclass class without a subclass blocks at Stage 2
  // (magus picks at 1st; PHB classes pick at 3rd — cleric included).
  const magusNoSub = validateReview({ ...completeState(), classId: 'magus', subclassName: '', fightingStyle: '' }, ctx);
  check(magusNoSub.errors.some(e => e.stageIndex === 1 && e.field === 'subclass'),
    'a magus (subclass at level 1) without a subclass blocks at Stage 2');

  // Cantrip completeness (2026-11-07 follow-up): the final list must
  // be complete before commit, or the server refuses naming
  // knownCantrips. A cleric with no cantrips blocks at Stage 2; with
  // exactly 3 it passes. A fighter (no cantrip source at level 1)
  // needs none and passes with an empty list.
  const clericNoCantrips = validateReview({
    ...completeState(), classId: 'cleric', fightingStyle: '',
    base_scores: DWARF_BASE, ability_scores: DWARF_FINAL,
    skills: ['Athletics', 'Intimidation', 'Religion'],
    known_spells: [], prepared_spells: [...DWARF_PREPARED], knownCantrips: [],
  }, ctx);
  check(clericNoCantrips.errors.some(e => e.stageIndex === 1 && e.field === 'knownCantrips'),
    'a cleric with no cantrips blocks at Stage 2 (field knownCantrips)');
  const clericWithCantrips = validateReview({
    ...completeState(), classId: 'cleric', fightingStyle: '',
    base_scores: DWARF_BASE, ability_scores: DWARF_FINAL,
    skills: ['Athletics', 'Intimidation', 'Religion'],
    known_spells: [], prepared_spells: [...DWARF_PREPARED],
    knownCantrips: ['guidance', 'sacred flame', 'thaumaturgy'],
  }, ctx);
  check(clericWithCantrips.canCommit === true && clericWithCantrips.errors.length === 0,
    `a cleric with exactly 3 cantrips validates clean (got ${JSON.stringify(clericWithCantrips.errors)})`);
  const clericShort = validateReview({
    ...completeState(), classId: 'cleric', fightingStyle: '',
    base_scores: DWARF_BASE, ability_scores: DWARF_FINAL,
    skills: ['Athletics', 'Intimidation', 'Religion'],
    known_spells: [], prepared_spells: [...DWARF_PREPARED],
    knownCantrips: ['guidance', 'sacred flame'],
  }, ctx);
  check(clericShort.errors.some(e => e.stageIndex === 1 && e.field === 'knownCantrips'),
    'a cleric 2 of 3 cantrips blocks at Stage 2 (exact count, not just presence)');

  // cantripCompleteness, direct: the numbers behind the check.
  const cc = cantripCompleteness({
    ...completeState(), classId: 'cleric', knownCantrips: ['guidance', 'sacred flame', 'thaumaturgy'],
  }, ctx);
  check(cc.classCount === 3 && cc.grantedCount === 0 && cc.pendingTotal === 0
    && cc.expected === 3 && cc.actual === 3 && cc.required === true && cc.skipCount === false && cc.complete === true,
    `cleric completeness is 3 class + 0 granted + 0 pending = 3 (got ${JSON.stringify(cc)})`);
  const ccFighter = cantripCompleteness(completeState(), ctx);
  check(ccFighter.required === false && ccFighter.complete === true,
    'a fighter requires no cantrips (no class count, no grant, no pending choice)');
  const ccMagus = cantripCompleteness({ ...completeState(), classId: 'magus', knownCantrips: ['fire bolt'] }, ctx);
  check(ccMagus.skipCount === true && ccMagus.complete === true,
    'a magus skips the exact count (every society carries the choice phrase) — presence only');
  const highElfEntry = { id: 'elf', name: 'Elf', abilityScoreIncrease: { dex: 2 }, languages: ['Common', 'Elvish'], innateSpells: [{ choose: 1, class: 'wizard', level: 0 }] };
  const ccHighElfFighter = cantripCompleteness(
    { ...completeState(), race: 'elf', subrace: 'High Elf', knownCantrips: [] },
    { ...ctx, speciesEntry: highElfEntry });
  check(ccHighElfFighter.classCount === 0 && ccHighElfFighter.pendingTotal === 1
    && ccHighElfFighter.expected === 1 && ccHighElfFighter.required === true && ccHighElfFighter.complete === false,
    `a High Elf fighter needs its 1 species cantrip choice (got ${JSON.stringify(ccHighElfFighter)})`);
  const ccHighElfPicked = cantripCompleteness(
    { ...completeState(), race: 'elf', subrace: 'High Elf', knownCantrips: ['fire bolt'] },
    { ...ctx, speciesEntry: highElfEntry });
  check(ccHighElfPicked.complete === true,
    'a High Elf fighter with its 1 species cantrip picked is complete');

  // Prepared-list presence (§11 flag): a paladin with no prepared
  // spells blocks at Stage 4 even though Stage 4 alone tolerates an
  // empty list — the commit would refuse naming preparedSpells.
  // With 2 prepared it passes.
  const paladinNoPrepared = validateReview({
    ...completeState(), classId: 'paladin', fightingStyle: '',
    base_scores: PALADIN_BASE, ability_scores: PALADIN_FINAL,
    skills: ['Athletics', 'Intimidation', 'Insight', 'Religion'],
    known_spells: [], prepared_spells: [],
  }, ctx);
  check(paladinNoPrepared.errors.some(e => e.stageIndex === 3 && e.field === 'prepared_spells'),
    'a paladin with no prepared spells blocks at Stage 4 (field prepared_spells)');
  const paladinPrepared = validateReview({
    ...completeState(), classId: 'paladin', fightingStyle: '',
    base_scores: PALADIN_BASE, ability_scores: PALADIN_FINAL,
    skills: ['Athletics', 'Intimidation', 'Insight', 'Religion'],
    known_spells: [], prepared_spells: ['bless', 'cure wounds'],
  }, ctx);
  check(paladinPrepared.canCommit === true && paladinPrepared.errors.length === 0,
    `a paladin with 2 prepared spells validates clean (got ${JSON.stringify(paladinPrepared.errors)})`);

  // Error messages are plain words, grouped by stage, each with a jump.
  for (const e of noGear.errors) {
    check(typeof e.stage === 'string' && typeof e.stageIndex === 'number' && typeof e.message === 'string'
      && e.message.startsWith('Stage '), `error carries stage + plain message (${JSON.stringify(e)})`);
  }

  // Server-error → stage mapping for the 400 jump button.
  check(stageForServerError('Species: origin explanation is required because your origin is outside the Forgotten Realms') === 0,
    'server species error maps to Stage 1');
  check(stageForServerError('class: unknown class') === 1, 'server class error maps to Stage 2');
  check(stageForServerError('theme_id: unknown theme') === 2, 'server theme error maps to Stage 3');
  check(stageForServerError('ability_scores: base score out of range') === 3, 'server score error maps to Stage 4');
  check(stageForServerError('alignment: required') === 4, 'server alignment error maps to Stage 5');
  check(stageForServerError('something unrecognizable') === null, 'an unmapped server error maps to no stage');
  check(stageForServerError('knownCantrips: cleric has cantrips to record at Review') === 1,
    'a server cantrip refusal maps to Stage 2 (where the picker lives), not Stage 4');
  check(stageForServerError('preparedSpells: paladin prepares 2 spells at level 1') === 3,
    'a server prepared-spells refusal maps to Stage 4');
  check(stageForServerError('fightingStyle: fighter picks a fighting style at level 1') === 1,
    'a server fighting-style refusal maps to Stage 2');
}

// ===========================================================================
// (c) Commit body + granted spells
// ===========================================================================
group('(c) Commit body + granted spells');
{
  const body = buildCommitBody(completeState(), { mode: 'manual' });
  check(body.creation_phase === 'active', 'commit body flips creation_phase to active');
  check(body.creator === 'creator-next', 'commit body carries the creator-next marker');
  check(body.class === 'fighter' && body.first_name === 'S6',
    'commit body carries the draft state (class + name)');
  check(!('distinguishing_features' in body), 'commit body carries no distinguishing-features field (client does not collect it yet — the column exists, migration 060)');

  // Edit mode: gear picks are stripped so the server never re-derives
  // starting inventory/gold over earned gear — but the rest rides.
  const editBody = buildCommitBody(completeState(), { mode: 'edit' });
  check(!('gear_choice' in editBody) && !('package_id' in editBody) && !('package_picks' in editBody),
    'edit-mode commit body strips gear_choice / package_id / package_picks');
  check(editBody.creation_phase === 'active' && editBody.first_name === 'S6',
    'edit-mode commit body still flips phase and carries the definition edits');

  // The Stage 2 picks ride the commit body (2026-11-07 follow-up):
  // fighting_style as a plain string, subclass_choices raw, and
  // known_cantrips stringified like the other JSON columns. The
  // commit body spreads the progress body, so the same three ride
  // both — asserted here on both builders, in both modes.
  const picksState = {
    ...completeState(),
    subclassChoices: { arcane_archer_lore_cantrip: 'Prestidigitation' },
    knownCantrips: ['fire bolt', 'light'],
  };
  const progressBody = buildStage1ProgressBody(picksState);
  check(progressBody.fighting_style === 'Defense',
    'progress body carries fighting_style (Defense)');
  check(JSON.stringify(progressBody.subclass_choices) === JSON.stringify({ arcane_archer_lore_cantrip: 'Prestidigitation' }),
    'progress body carries subclass_choices raw (not stringified)');
  check(progressBody.known_cantrips === JSON.stringify(['fire bolt', 'light']),
    'progress body carries known_cantrips stringified like the other JSON columns');
  const picksBody = buildCommitBody(picksState, { mode: 'manual' });
  check(picksBody.fighting_style === 'Defense' && picksBody.known_cantrips === JSON.stringify(['fire bolt', 'light'])
    && JSON.stringify(picksBody.subclass_choices) === JSON.stringify({ arcane_archer_lore_cantrip: 'Prestidigitation' }),
    'commit body carries fighting_style + subclass_choices + known_cantrips');
  const picksEditBody = buildCommitBody(picksState, { mode: 'edit' });
  check(picksEditBody.fighting_style === 'Defense' && picksEditBody.known_cantrips === JSON.stringify(['fire bolt', 'light']),
    'edit-mode commit body still carries the Stage 2 picks (only gear is stripped)');
  // Empty picks send nothing — a blank Stage 2 still builds a body
  // without the fields, so the blank-save guard keeps its meaning.
  const blankPicksBody = buildStage1ProgressBody({ ...completeState(), fightingStyle: '', subclassChoices: {}, knownCantrips: [] });
  check(!('fighting_style' in blankPicksBody) && !('subclass_choices' in blankPicksBody) && !('known_cantrips' in blankPicksBody),
    'empty Stage 2 picks send none of the three fields');

  // Granted spells: species innate + dragonmark + Magic Initiate,
  // cantrips and spells labeled separately.
  const speciesEntry = {
    ...DWARF_ENTRY,
    innateSpells: [{ name: 'Fire Bolt', level: 0 }, { name: 'Burning Hands', level: 1 }],
    markSpells: ['Mage Armor'],
  };
  const g = grantedSpells(
    { ...completeState(), originFeat: 'magic_initiate', originFeatChoices: { spell: 'Shield', cantrips: ['Light', 'Mage Hand'] } },
    { speciesEntry, subclassesByClass: {}, featCantrips: [] }
  );
  check(g.cantrips.some(c => c.spell === 'Fire Bolt' && c.source === 'species'),
    'species level-0 innate lands in cantrips (granted)');
  check(g.spells.some(s => s.name === 'Burning Hands' && s.level === 1),
    'species level-1 innate lands in granted spells');
  check(g.spells.some(s => s.name === 'Mage Armor' && s.source === 'dragonmark'),
    'dragonmark spells land in granted spells');
  check(g.spells.some(s => s.name === 'Shield' && s.source === 'origin feat (Magic Initiate)'),
    'Magic Initiate level-1 spell lands in granted spells');
  check(g.cantrips.some(c => c.spell === 'Light' && c.source === 'origin feat (Magic Initiate)'),
    'Magic Initiate cantrips land in granted cantrips');
  check(!g.cantrips.some(c => c.spell === 'Burning Hands') && !g.spells.some(s => s.name === 'Fire Bolt'),
    'cantrips and granted spells never mix');
}

// ===========================================================================
// (d) Component static guards — sections, Edit jumps, tooltips, no stubs
// ===========================================================================
group('(d) Component static guards');
{
  const src = readRepo('client/src/components/creator-next/Stage6ReviewCommit.jsx');
  for (const section of ['Who is this?', 'Ability scores', 'Derived numbers', 'Species traits', 'Languages &amp; proficiencies', 'Spells', 'Features', 'Equipment &amp; gold', 'Story']) {
    check(src.includes(section), `Review renders the "${section}" section`);
  }
  check(src.includes('formatOriginLine(state)'), 'head line uses the Origin: setting — region — explanation line');
  check(src.includes('picks subclass at level'), 'head line says "picks subclass at level X" when no subclass is picked');
  check(src.includes('Level 1'), 'head line shows level 1');
  check(src.includes('onJump={onJump}'), 'sections carry an Edit jump (onJump)');
  check(src.includes("label={`Go to ${g.stage}`}"), 'validation groups carry a jump button each');
  check(src.includes('<Tip text='), 'sections carry tooltips (global rule)');
  check(src.includes('Editing changes definition only and preserves earned progression'),
    'edit mode shows the Page 1 preservation rule in one line before commit');
  check(src.includes('no second character is created'), 'edit mode names the no-second-row rule in the UI');
  check(src.includes('Commit character'), 'commit button reads "Commit character"');
  check(src.includes('Save edits'), 'edit-mode commit button reads "Save edits"');
  check(src.includes('commit: {commitError}'), 'a commit refusal shows the field-named error and stays on Review');
  check(src.includes('setCommitError(') && src.includes('onCommitted(row)'),
    'commit failure sets the error (stays on Review); success calls onCommitted with the row');
  check(src.includes("disabled={!validation.canCommit || committing}"),
    'commit is disabled while validation errors exist or a commit is in flight');
  check(src.includes('commitRef.current'), 'the component registers its commit on commitRef for the shell foot button');
  // No heirloom section, no distinguishing-features field: strip
  // comments first (the header documents both as deferred), then the
  // words must be gone entirely (no field, state key, or label).
  const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  const code = stripComments(src);
  check(!/heirloom/i.test(code), 'no heirloom section in code (deferred, no design)');
  check(!/distinguishing_features/i.test(code), 'no distinguishing-features field in code (not collected yet — the column exists, migration 060)');
  check(!code.includes('Not built yet'), 'no "Not built yet" stub text in the component');
  check(src.includes('deriveLevel1Stats({'), 'derived numbers come from the shared Stage 5 helper (HP = hit die + CON min 1, base AC = 10 + DEX)');
  check(src.includes('Base armor class:') && src.includes('Hit points:'),
    'derived numbers render base AC (before armor) and HP');
  // 2026-11-07 follow-up: the cantrip picks are shown, not deferred
  // to play — and the 404 → PUT fallback is gone (route exists live).
  check(src.includes('picked on Stage 2:'), 'Spells section shows the real cantrip picks (picked on Stage 2)');
  check(!src.includes('picked in play, not in the creator'),
    'no "picked in play, not in the creator" line remains');
  check(!src.includes("method: 'PUT'") && !src.includes('post.status === 404'),
    'the 404 → PUT fallback branch is gone (no PUT in the commit path, no 404 branch)');
  check(src.includes("cantripCompleteness(state, { speciesEntry, subclassesByClass })"),
    'Review validates cantrip completeness from the same helper the tests call directly');

  // Stage 2 picker wiring (static: the picker itself renders only in
  // the browser — these guards pin the fetch + the no-hardcode rule).
  const stage2 = readRepo('client/src/components/creator-next/Stage2ClassCalling.jsx');
  check(!stage2.includes('FIGHTING_STYLES'),
    'no hardcoded FIGHTING_STYLES list remains in Stage 2');
  check(stage2.includes("fetch('/api/fighting-styles')"),
    'Stage 2 fetches the fighting-style list from /api/fighting-styles');
  check(stage2.includes("fetch(`/api/spells?${qs.toString()}`)"),
    'Stage 2 fetches cantrip lists from /api/spells (level 0)');
  check(stage2.includes("qs.set('subclass', state.subclassName)"),
    'Stage 2 passes the subclass (magus society) to the cantrip endpoint');
  check(stage2.includes('Pick your society first'),
    'a magus with no society sees the pick-society-first note, not an empty list');
  check(stage2.includes('Cantrips — pick') && stage2.includes('toggleCantrip'),
    'Stage 2 renders a cantrip picker (checkboxes, capped at the class + species total)');
  check(stage2.includes('granted never count against') || stage2.includes('Granted cantrips never count'),
    'the picker states the granted-never-count rule');
  check(!stage2.includes('quickBuild'),
    'no Quick Build auto-fill remains in Stage 2 (cantrip picks stay player-made, creator test-notes #9)');

  // Stage 1 persistence: the new field + the send + the rehydrate.
  const persist = readRepo('client/src/components/creator-next/stage1Persistence.js');
  check(persist.includes('knownCantrips: []'),
    'blankStage1State carries knownCantrips: []');
  check(persist.includes('body.fighting_style = state.fightingStyle')
    && persist.includes('body.subclass_choices = state.subclassChoices')
    && persist.includes('body.known_cantrips = JSON.stringify(state.knownCantrips)'),
    'buildStage1ProgressBody sends fighting_style + subclass_choices + known_cantrips');
  check(persist.includes('patch.fightingStyle = row.fighting_style')
    && persist.includes('patch.subclassChoices = storedChoices')
    && persist.includes('patch.knownCantrips = storedCantrips'),
    'rehydrateStateFromServerRow reads fighting_style + subclass_choices_json + known_cantrips');
  check(!persist.includes('are never sent by the save body'),
    'the stale "never sent by the save body" comment is fixed');

  // Shell: Versatile Magic Initiate cantrips ride the featCantrips
  // prop alongside the origin slot's (server supplies both slots).
  const shellSrc = readRepo('client/src/components/creator-next/CreatorNextShell.jsx');
  check(shellSrc.includes('versatileFeatChoices?.cantrips'),
    'the shell feeds Versatile Magic Initiate cantrips into Stage 2 too');
  check(!shellSrc.includes('have no columns'),
    'the stale "have no columns" claim about the Stage 2 picks is fixed');
}

// ===========================================================================
// (e) Shell wiring + static guards
// ===========================================================================
group('(e) Shell wiring + static guards');
{
  const shell = readRepo('client/src/components/creator-next/CreatorNextShell.jsx');
  check(shell.includes('Stages 1–6 built'), 'shell crumbs read "Stages 1–6 built"');
  check(!shell.includes('Stages 1–5 built') && !shell.includes('Stage 6 planned') && !shell.includes('Not built yet'),
    'no stub strings remain in the shell');
  check(!shell.includes('step > 4') && !shell.includes('step <= 4'),
    'no stub guard remains in the shell (no step > 4 / step <= 4)');
  check(shell.includes("import Stage6ReviewCommit from './Stage6ReviewCommit.jsx'"),
    'shell imports Stage6ReviewCommit');
  check(shell.includes('step === 5') && shell.includes('<Stage6ReviewCommit'),
    'shell renders Stage 6 at step === 5');
  check(shell.includes("nextLabel={saving ? 'Saving…' : step === 5 ? 'Commit character' : 'Continue'}"),
    'WizardFoot label is Commit character at step 5');
  check(shell.includes('isLast={step === 5}'), 'WizardFoot isLast is true at step 5');
  check(shell.includes('if (step === 5)') && shell.includes('await commitRef.current?.()'),
    'shell Continue at step 5 IS the commit (via commitRef)');
  check(shell.includes('onCommitted') && shell.includes('mode = \'manual\''),
    'shell takes an onCommitted prop and a mode prop (manual default)');
  check(shell.includes('mode={mode}'), 'shell threads mode to Stage 1 instead of hardcoding "manual"');
  check(shell.includes('onCommitted={onCommitted}'), 'shell passes onCommitted to Stage 6');
  check(shell.includes("4: 'Equipment or gold, appearance, and story text.'"),
    'STAGE_NOTES key 4 is preserved (Stage 5 scope line)');
  check(shell.includes("Couldn't save: {saveError}") && shell.includes('Your input is preserved'),
    'shell still renders the save refusal + preserved-input note (stage2-validation-wiring pin)');
  check(shell.includes("resolveOpeningDraft({ resumeCharacterId, draft: loadStage1LocalDraft() })"),
    'shell still resolves the opening draft the same way (fresh-create-blank pin)');
  check(!shell.includes('draft?.state') && !shell.includes('function blankStage1State'),
    'shell still holds no draft-state branch of its own (fresh-create-blank pin)');
}

// ===========================================================================
// (f) HomeFlow wiring — commit lands on the roster, not campaign setup
// ===========================================================================
group('(f) HomeFlow wiring');
{
  const flow = readRepo('client/src/components/creator/HomeFlow.jsx');
  check(flow.includes('onCommitted={handleCommitted}'), 'HomeFlow passes onCommitted to the shell');
  check(flow.includes('mode={creatorMode}'), 'HomeFlow passes mode to the shell');
  check(flow.includes('const handleCommitted'), 'HomeFlow implements handleCommitted');
  const committedBody = flow.split('const handleCommitted')[1]?.split('}, [loadCharacters])')[0] || '';
  check(committedBody.includes('loadCharacters()') && committedBody.includes("setRoute('home')"),
    'handleCommitted reloads the roster and routes home');
  check(!committedBody.includes('onCharacterCreated'),
    'handleCommitted does NOT call onCharacterCreated (submit does not start play)');
  check(!flow.includes('Server-row fields do not rehydrate'),
    'the stale "Server-row fields do not rehydrate" comment is fixed');
  check(flow.includes('handleEditCharacter') && flow.includes("setCreatorMode('edit')"),
    'HomeFlow routes an edit into the creator with mode edit');
  check(flow.includes('onEditCharacter={handleEditCharacter}'),
    'HomeFlow passes onEditCharacter to the roster');
  check(flow.includes('resumeCharacterId={resumeCharacterId}'),
    'edit mode reuses the resumeCharacterId path (existing row, rehydrated)');
}

// ===========================================================================
// (g) Edit entry points — roster card + sheet + App
// ===========================================================================
group('(g) Edit entry points');
{
  const home = readRepo('client/src/components/creator/HomeScreenV2.jsx');
  check(home.includes("state === 'active' && onEditCharacter"),
    'roster Edit affordance renders for active cards only');
  check(home.includes('e.stopPropagation()'),
    'roster Edit click stops propagation (never also opens the dashboard)');
  check(home.includes('<div style={{ position: \'relative\' }}>'),
    'the card button is wrapped so Edit is a sibling, never nested inside the card button');
  check(home.includes('Edit') && home.includes('onEditCharacter(character)'),
    'roster Edit button calls onEditCharacter with the card character');
  check(home.includes('onClick={onClick}') && home.includes("className={`charcard"),
    'the whole-card click that opens the dashboard is untouched');

  const sheet = readRepo('client/src/components/CharacterSheet.jsx');
  check(sheet.includes('onEditInCreator'), 'sheet takes an onEditInCreator prop');
  check(sheet.includes('Edit in creator'), 'sheet renders an "Edit in creator" entry');
  check(sheet.includes('onClick={() => onEditInCreator(character)}'),
    'sheet Edit in creator calls the prop with the character');
  // It sits next to Edit Details (flavor-only inline edit), not in
  // place of it.
  const editDetailsAt = sheet.indexOf('Edit Details');
  const editCreatorAt = sheet.indexOf('Edit in creator');
  check(editDetailsAt > 0 && editCreatorAt > editDetailsAt && editCreatorAt - editDetailsAt < 800,
    '"Edit in creator" sits next to "Edit Details"');

  const app = readRepo('client/src/App.jsx');
  check(app.includes('editCharacterId'), 'App holds editCharacterId state');
  check(app.includes('mode="edit"') && app.includes('resumeCharacterId={editCharacterId}'),
    'App renders the creator in edit mode for that character');
  check(app.includes('onEditInCreator={(character) => setEditCharacterId(character.id)}'),
    'App threads onEditInCreator to the sheet');
  check(app.includes('CreatorNextShell') && app.includes("import CreatorNextShell from './components/creator-next/CreatorNextShell.jsx'"),
    'App imports CreatorNextShell for the edit path');
  check(app.includes('handleCharacterUpdated(row)') && app.includes('setEditCharacterId(null)'),
    'edit commit refreshes the local copy and lands back on the sheet');
}

// ===========================================================================
// (h) HTTP commit — real router + real DB, real commit route
// ===========================================================================
group('(h) HTTP commit (real router + real DB)');
{
  // The dwarf tier-1 ancestry feat with no subchoices (same id the
  // server commit suite resolves).
  const stoutRow = await db.dbGet(
    "SELECT id FROM ancestry_feats WHERE list_id = 'dwarf' AND tier = 1 AND feat_name = 'Stout-Hearted'"
  );
  check(stoutRow?.id != null, 'Stout-Hearted tier-1 dwarf feat resolves from the seed table');
  const stoutId = stoutRow?.id;

  // (h1) Incomplete draft → the real route refuses with a 400
  // naming the missing fields; the row stays in 'creating'.
  const state = draftClericState();
  const saved = await saveStage1Progress({ state, characterId: null });
  const draftId = saved.character_id;
  check(typeof draftId === 'number', 'draft save creates a row (character_id returned)');
  const draftRow = await readCharacter(draftId);
  check(draftRow?.creation_phase === 'creating', 'draft row starts in creation_phase creating');

  let refused = null;
  try {
    await commitCharacter({ state, characterId: draftId, mode: 'manual' });
  } catch (err) { refused = err; }
  check(refused instanceof Error && refused.message.length > 0,
    `an incomplete commit throws instead of flipping (got ${refused?.message || 'no throw'})`);
  // The exact missing-field list the landed route returns for this
  // draft (verified against the live validator): gender, origin,
  // origin feat, ancestry feat, the physical story fields — and
  // knownCantrips, because a cleric has cantrips to record and this
  // draft picks none (the client sends the list when picked — see
  // (h3) — it just has nothing to send here).
  for (const field of ['gender', 'originSetting', 'originRegion', 'originFeat', 'ancestryFeatId',
    'age', 'height', 'weight', 'hair_color', 'skin_color', 'physical_build', 'knownCantrips']) {
    check(refused?.message.includes(field), `the refusal names the missing field ${field}`);
  }
  const stillDraft = await readCharacter(draftId);
  check(stillDraft?.creation_phase === 'creating',
    'a refused commit leaves the row in creating (stays on Review)');
  check(await characterCountByName('S6 Dwarf Cleric') === 1, 'a refused commit creates no second row');

  // (h2) Completed draft → the real route commits and flips to
  // active, exactly once.
  const rogueState = draftRogueState(stoutId);
  const rogueSaved = await saveStage1Progress({ state: rogueState, characterId: null });
  const rogueId = rogueSaved.character_id;
  check(typeof rogueId === 'number', 'completed draft save creates a row');
  const committed = await commitCharacter({ state: rogueState, characterId: rogueId, mode: 'manual' });
  check(committed && (committed.id === rogueId || committed?.creation_phase === 'active'),
    'commit returns the committed row');
  const row = await readCharacter(rogueId);
  check(row?.creation_phase === 'active', 'commit flips the row to active');
  check(await characterCountByName('S6 Rogue') === 1, 'commit creates no second row');
  check(row?.gold_gp === 100, `gold-fork commit derives 100 gp (got ${row?.gold_gp})`);

  // (h3) Completed CLERIC draft → commits end-to-end through the
  // client body: the 3 real cleric cantrips (keys from the live
  // level-0 endpoint) ride known_cantrips, and the row keeps them.
  // Review also passes this state first — the client gate, not just
  // the server's.
  const c0 = await fetch('/api/spells?class=cleric&level=0');
  check(c0.ok, 'the live cantrip endpoint answers for the cleric fixture');
  const clericCantrips = (await c0.json())?.spells?.slice(0, 3).map((s) => s.key) || [];
  check(clericCantrips.length === 3, `the cleric fixture draws 3 cantrip keys from the live list (got ${clericCantrips.length})`);
  const clericState = draftClericCompleteState(stoutId, clericCantrips);
  const clericReview = validateReview(clericState, { speciesEntry: DWARF_ENTRY, speciesEntries: [DWARF_ENTRY], mixedTables: null, themes: [SOLDIER_THEME], subclassesByClass: {} });
  check(clericReview.canCommit === true && clericReview.errors.length === 0,
    `Review passes the complete cleric state (got ${JSON.stringify(clericReview.errors)})`);
  const clericSaved = await saveStage1Progress({ state: clericState, characterId: null });
  const clericId = clericSaved.character_id;
  check(typeof clericId === 'number', 'completed cleric draft save creates a row');
  const clericDraftRow = await readCharacter(clericId);
  check(JSON.stringify(JSON.parse(clericDraftRow?.known_cantrips || '[]')) === JSON.stringify(clericCantrips),
    'the draft save already persists known_cantrips on the row (POST carries it)');
  const clericCommitted = await commitCharacter({ state: clericState, characterId: clericId, mode: 'manual' });
  check(clericCommitted && clericCommitted.id === clericId, 'cleric commit returns the committed row');
  const clericRow = await readCharacter(clericId);
  check(clericRow?.creation_phase === 'active', 'cleric commit flips the row to active');
  check(JSON.stringify(JSON.parse(clericRow?.known_cantrips || '[]')) === JSON.stringify(clericCantrips),
    'cleric commit keeps the 3 cantrips on the row');
  check(await characterCountByName('S6 Cleric') === 1, 'cleric commit creates no second row');

  // (h3b) Missing-pick refusal: the same complete cleric with only
  // 2 of 3 cantrips refuses naming knownCantrips — and Review blocks
  // it first (the player never meets the server 400 first).
  const shortState = { ...clericState, first_name: 'S6', last_name: 'Cleric Short', knownCantrips: clericCantrips.slice(0, 2) };
  const shortReview = validateReview(shortState, { speciesEntry: DWARF_ENTRY, speciesEntries: [DWARF_ENTRY], mixedTables: null, themes: [SOLDIER_THEME], subclassesByClass: {} });
  check(shortReview.canCommit === false && shortReview.errors.some(e => e.field === 'knownCantrips' && e.stageIndex === 1),
    'Review blocks a 2-of-3 cleric at Stage 2 before any commit is attempted');
  const shortSaved = await saveStage1Progress({ state: shortState, characterId: null });
  let shortRefused = null;
  try {
    await commitCharacter({ state: shortState, characterId: shortSaved.character_id, mode: 'manual' });
  } catch (err) { shortRefused = err; }
  check(shortRefused instanceof Error && /knownCantrips/.test(shortRefused.message),
    `a 2-of-3 cantrip commit refuses naming knownCantrips (got ${shortRefused?.message || 'no throw'})`);
  const shortRow = await readCharacter(shortSaved.character_id);
  check(shortRow?.creation_phase === 'creating', 'a refused short-cantrip commit leaves the row in creating');

  // (h4) Completed FIGHTER draft → commits end-to-end: the style
  // rides the commit body and persists on the row. The draft POST
  // persists it too now (joint-run fix 2026-11-07: POST carries
  // fighting_style via the post-insert UPDATE, like the PUT) — the
  // old "POST → null" pin was the gap, not the contract.
  const fighterState = draftFighterState(stoutId);
  const fighterReview = validateReview(fighterState, { speciesEntry: DWARF_ENTRY, speciesEntries: [DWARF_ENTRY], mixedTables: null, themes: [SOLDIER_THEME], subclassesByClass: {} });
  check(fighterReview.canCommit === true && fighterReview.errors.length === 0,
    `Review passes the complete fighter state (got ${JSON.stringify(fighterReview.errors)})`);
  const fighterSaved = await saveStage1Progress({ state: fighterState, characterId: null });
  const fighterId = fighterSaved.character_id;
  check(typeof fighterId === 'number', 'completed fighter draft save creates a row');
  const fighterPostRow = await readCharacter(fighterId);
  check(fighterPostRow?.fighting_style === 'Defense',
    `the draft POST persists fighting_style (got ${fighterPostRow?.fighting_style})`);
  const fighterPut = await saveStage1Progress({ state: fighterState, characterId: fighterId });
  check(fighterPut.character_id === fighterId, 'a follow-up draft save PUTs the same row');
  const fighterPutRow = await readCharacter(fighterId);
  check(fighterPutRow?.fighting_style === 'Defense',
    `the draft PUT persists fighting_style (got ${fighterPutRow?.fighting_style})`);
  const fighterCommitted = await commitCharacter({ state: fighterState, characterId: fighterId, mode: 'manual' });
  check(fighterCommitted && fighterCommitted.id === fighterId, 'fighter commit returns the committed row');
  const fighterRow = await readCharacter(fighterId);
  check(fighterRow?.creation_phase === 'active', 'fighter commit flips the row to active');
  check(fighterRow?.fighting_style === 'Defense', 'fighter commit keeps the fighting style on the row');
  check(await characterCountByName('S6 Fighter') === 1, 'fighter commit creates no second row');

  // (h4b) Fighter without a style: the server refuses naming
  // fightingStyle through the client body (Review would block it
  // first — this pins the server rule on the same path).
  const noStyleState = { ...fighterState, first_name: 'S6', last_name: 'Fighter No Style', fightingStyle: '' };
  const noStyleSaved = await saveStage1Progress({ state: noStyleState, characterId: null });
  let noStyleRefused = null;
  try {
    await commitCharacter({ state: noStyleState, characterId: noStyleSaved.character_id, mode: 'manual' });
  } catch (err) { noStyleRefused = err; }
  check(noStyleRefused instanceof Error && /fightingStyle/.test(noStyleRefused.message),
    `a fighter without a style refuses naming fightingStyle (got ${noStyleRefused?.message || 'no throw'})`);

  // (h5) Completed PALADIN draft → commits end-to-end: the §11 flag
  // made concrete. The prepared list (2 keys from the live level-1
  // endpoint) rides the commit body; without it the commit would
  // refuse naming preparedSpells. Review passes this state first.
  const p1 = await fetch('/api/spells?class=paladin&level=1');
  check(p1.ok, 'the live spells endpoint answers for the paladin fixture');
  const paladinPrepared = (await p1.json())?.spells?.slice(0, 2).map((s) => s.key) || [];
  check(paladinPrepared.length === 2, `the paladin fixture draws 2 prepared keys from the live list (got ${paladinPrepared.length})`);
  const paladinState = draftPaladinState(stoutId, paladinPrepared);
  const paladinReview = validateReview(paladinState, { speciesEntry: DWARF_ENTRY, speciesEntries: [DWARF_ENTRY], mixedTables: null, themes: [SOLDIER_THEME], subclassesByClass: {} });
  check(paladinReview.canCommit === true && paladinReview.errors.length === 0,
    `Review passes the complete paladin state (got ${JSON.stringify(paladinReview.errors)})`);
  const paladinSaved = await saveStage1Progress({ state: paladinState, characterId: null });
  const paladinId = paladinSaved.character_id;
  check(typeof paladinId === 'number', 'completed paladin draft save creates a row');
  const paladinCommitted = await commitCharacter({ state: paladinState, characterId: paladinId, mode: 'manual' });
  check(paladinCommitted && paladinCommitted.id === paladinId, 'paladin commit returns the committed row');
  const paladinRow = await readCharacter(paladinId);
  check(paladinRow?.creation_phase === 'active', 'paladin commit flips the row to active');
  check(JSON.stringify(JSON.parse(paladinRow?.prepared_spells || '[]')) === JSON.stringify(paladinPrepared),
    'paladin commit keeps the 2 prepared spells on the row');
  check(await characterCountByName('S6 Paladin') === 1, 'paladin commit creates no second row');

  // (h5b) Paladin without a prepared list: Review blocks it at
  // Stage 4, and the server refuses naming preparedSpells — the
  // player never meets the 400 first.
  const paladinBare = { ...paladinState, first_name: 'S6', last_name: 'Paladin Bare', prepared_spells: [] };
  const paladinBareReview = validateReview(paladinBare, { speciesEntry: DWARF_ENTRY, speciesEntries: [DWARF_ENTRY], mixedTables: null, themes: [SOLDIER_THEME], subclassesByClass: {} });
  check(paladinBareReview.canCommit === false && paladinBareReview.errors.some(e => e.field === 'prepared_spells' && e.stageIndex === 3),
    'Review blocks a paladin with no prepared spells at Stage 4');
  const paladinBareSaved = await saveStage1Progress({ state: paladinBare, characterId: null });
  let paladinBareRefused = null;
  try {
    await commitCharacter({ state: paladinBare, characterId: paladinBareSaved.character_id, mode: 'manual' });
  } catch (err) { paladinBareRefused = err; }
  check(paladinBareRefused instanceof Error && /preparedSpells/.test(paladinBareRefused.message),
    `a paladin with no prepared list refuses naming preparedSpells (got ${paladinBareRefused?.message || 'no throw'})`);

  // (h6) Rehydration: the server row gives the Stage 2 picks back —
  // an edit-mode resume keeps the fighting style and the cantrips.
  const rehydrated = rehydrateStateFromServerRow(fighterRow, null);
  check(rehydrated.fightingStyle === 'Defense',
    'rehydration reads fighting_style back from the row');
  const rehydratedCleric = rehydrateStateFromServerRow(clericRow, null);
  check(JSON.stringify(rehydratedCleric.knownCantrips) === JSON.stringify(clericCantrips),
    'rehydration reads known_cantrips back from the row');

  // (h7) Completed WIZARD draft → commits end-to-end with the two
  // lists: the 6-spell book rides known_spells and the prepared
  // subset (first 3 — Int mod +2 at L1) rides prepared_spells.
  // Review passes this state first.
  const w0 = await fetch('/api/spells?class=wizard&level=0');
  check(w0.ok, 'the live cantrip endpoint answers for the wizard fixture');
  const wizardCantrips = (await w0.json())?.spells?.slice(0, 3).map((s) => s.key) || [];
  check(wizardCantrips.length === 3, `the wizard fixture draws 3 cantrip keys from the live list (got ${wizardCantrips.length})`);
  const w1 = await fetch('/api/spells?class=wizard&level=1&abilityMod=2');
  check(w1.ok, 'the live spells endpoint answers for the wizard fixture');
  const w1Json = await w1.json();
  const wizardSpells = w1Json?.spells?.map((s) => s.key) || [];
  check(wizardSpells.length === 44, `the wizard fixture draws the live L1 list (got ${wizardSpells.length})`);
  check(w1Json?.spellbookSize === 6, 'the live spells envelope serves spellbookSize 6 for a wizard');
  const wizardBook = wizardSpells.slice(0, 6);
  const wizardPrepared = wizardSpells.slice(0, 3);
  const wizardState = draftWizardState(stoutId, wizardCantrips, wizardBook, wizardPrepared);
  const wizardReview = validateReview(wizardState, { speciesEntry: DWARF_ENTRY, speciesEntries: [DWARF_ENTRY], mixedTables: null, themes: [SOLDIER_THEME], subclassesByClass: {} });
  check(wizardReview.canCommit === true && wizardReview.errors.length === 0,
    `Review passes the complete wizard state (got ${JSON.stringify(wizardReview.errors)})`);
  const wizardSaved = await saveStage1Progress({ state: wizardState, characterId: null });
  const wizardId = wizardSaved.character_id;
  check(typeof wizardId === 'number', 'completed wizard draft save creates a row');
  const wizardCommitted = await commitCharacter({ state: wizardState, characterId: wizardId, mode: 'manual' });
  check(wizardCommitted && wizardCommitted.id === wizardId, 'wizard commit returns the committed row');
  const wizardRow = await readCharacter(wizardId);
  check(wizardRow?.creation_phase === 'active', 'wizard commit flips the row to active');
  check(JSON.stringify(JSON.parse(wizardRow?.known_spells || '[]')) === JSON.stringify(wizardBook),
    'wizard commit keeps the 6-spell book on the row');
  check(JSON.stringify(JSON.parse(wizardRow?.prepared_spells || '[]')) === JSON.stringify(wizardPrepared),
    'wizard commit keeps the 3 prepared spells on the row');
  check(await characterCountByName('S6 Wizard') === 1, 'wizard commit creates no second row');

  // (h7b) Wizard with prepared spells but no book: Review blocks it
  // at Stage 4, and the server refuses naming knownSpells + Stage 4
  // — the book is never auto-filled.
  const wizardBare = { ...wizardState, first_name: 'S6', last_name: 'Wizard Bare', known_spells: [] };
  const wizardBareReview = validateReview(wizardBare, { speciesEntry: DWARF_ENTRY, speciesEntries: [DWARF_ENTRY], mixedTables: null, themes: [SOLDIER_THEME], subclassesByClass: {} });
  check(wizardBareReview.canCommit === false && wizardBareReview.errors.some(e => e.field === 'known_spells' && e.stageIndex === 3),
    'Review blocks a bookless wizard at Stage 4');
  const wizardBareSaved = await saveStage1Progress({ state: wizardBare, characterId: null });
  let wizardBareRefused = null;
  try {
    await commitCharacter({ state: wizardBare, characterId: wizardBareSaved.character_id, mode: 'manual' });
  } catch (err) { wizardBareRefused = err; }
  check(wizardBareRefused instanceof Error && /knownSpells/.test(wizardBareRefused.message) && /Stage 4/.test(wizardBareRefused.message),
    `a bookless wizard commit refuses naming knownSpells + Stage 4 (got ${wizardBareRefused?.message || 'no throw'})`);
  check(stageForServerError(wizardBareRefused?.message || '') === 3,
    'the bookless-wizard refusal jumps to Stage 4');

  // (h7c) Rehydration: the server row gives the book back — an
  // edit-mode resume keeps all 6 book spells and the prepared subset.
  const rehydratedWizard = rehydrateStateFromServerRow(wizardRow, null);
  check(JSON.stringify(rehydratedWizard.known_spells) === JSON.stringify(wizardBook),
    'rehydration reads the 6-spell book back from the row');
  check(JSON.stringify(rehydratedWizard.prepared_spells) === JSON.stringify(wizardPrepared),
    'rehydration reads the prepared subset back from the row');

  // A 400 stays a refusal: the same completed draft with bad scores
  // must throw a field-named error and leave the row untouched
  // (still creating).
  const badState = { ...draftRogueState(stoutId), first_name: 'S6', last_name: 'Bad Scores' };
  const badSaved = await saveStage1Progress({ state: badState, characterId: null });
  const badId = badSaved.character_id;
  const badCommitState = {
    ...badState,
    base_scores: { str: 2, dex: 14, con: 13, int: 12, wis: 10, cha: 8 },
    ability_scores: { str: 4, dex: 14, con: 16, int: 12, wis: 10, cha: 8 },
  };
  let threw = null;
  try {
    await commitCharacter({ state: badCommitState, characterId: badId, mode: 'manual' });
  } catch (err) { threw = err; }
  check(threw instanceof Error && threw.message.length > 0,
    `an invalid commit throws instead of flipping (got ${threw?.message || 'no throw'})`);
  check(/score|ability|base/i.test(threw?.message || ''),
    `the refusal names the field (${threw?.message || ''})`);
  const badRow = await readCharacter(badId);
  check(badRow?.creation_phase === 'creating',
    'a refused commit leaves the row in creating (stays on Review)');

  // Edit mode: commit the active row again with a definition edit —
  // no second row, level / inventory / gold preserved, name changed.
  const before = await readCharacter(rogueId);
  const editState = { ...rogueState, first_name: 'S6', last_name: 'Rogue Edited' };
  const edited = await commitCharacter({ state: editState, characterId: rogueId, mode: 'edit' });
  check(edited && edited.id === rogueId, 'edit-mode commit targets the existing id');
  check(await characterCountByName('S6 Rogue Edited') === 1
    && await characterCountByName('S6 Rogue') === 0,
    'edit-mode commit renames the same row (no second row, old name gone)');
  const after = await readCharacter(rogueId);
  check(after?.level === before?.level, `edit-mode commit preserves level (${before?.level} → ${after?.level})`);
  check((after?.inventory || null) === (before?.inventory || null),
    'edit-mode commit preserves inventory exactly');
  check((after?.gold_gp ?? null) === (before?.gold_gp ?? null),
    'edit-mode commit preserves gold exactly');
  check(after?.creation_phase === 'active', 'edit-mode commit leaves the row active');

  // Fresh create with no row yet: commit saves the draft first, then
  // commits — one row, active.
  const freshState = { ...draftRogueState(stoutId), first_name: 'S6', last_name: 'Fresh Commit' };
  let freshId = null;
  const freshRow = await commitCharacter({
    state: freshState, characterId: null, mode: 'manual',
    onCharacterId: (id) => { freshId = id; },
  });
  check(typeof freshId === 'number' && freshRow?.id === freshId,
    'commit with no row saves the draft first and commits it');
  check(await characterCountByName('S6 Fresh Commit') === 1,
    'fresh-create commit creates exactly one row');
  const fresh = await readCharacter(freshId);
  check(fresh?.creation_phase === 'active', 'fresh-create commit lands active');
}

// (i) Wizard spellbook at Review (pure helpers + static pins,
// 2026-11-07): the book shows distinctly from the prepared subset,
// Review blocks a bookless wizard and a prepared-outside-book wizard
// at Stage 4, and every spellbook server refusal jumps to Stage 4.
group('(i) Wizard spellbook at Review (pure helpers + static pins)');
{
  const ctx = { speciesEntry: DWARF_ENTRY, speciesEntries: [DWARF_ENTRY], mixedTables: null, themes: [SOLDIER_THEME], subclassesByClass: {} };
  const wizardBase = {
    ...completeState(),
    classId: 'wizard', subclassName: '', fightingStyle: '',
    knownCantrips: ['fire bolt', 'mage hand', 'prestidigitation'],
    known_spells: ['magic missile', 'shield', 'mage armor', 'sleep', 'alarm', 'burning hands'],
    prepared_spells: ['magic missile', 'shield', 'mage armor'],
  };
  const spellErrors = (r) => r.errors.filter(e => e.field === 'known_spells' || e.field === 'prepared_spells');
  check(spellErrors(validateReview(wizardBase, ctx)).length === 0,
    `Review raises no spell errors for a wizard with a 6-spell book and a prepared subset (got ${JSON.stringify(spellErrors(validateReview(wizardBase, ctx)))})`);
  const bookless = validateReview({ ...wizardBase, known_spells: [] }, ctx);
  check(bookless.canCommit === false && bookless.errors.some(e => e.field === 'known_spells' && e.stageIndex === 3 && /Spellbook/.test(e.message)),
    'Review blocks a wizard with prepared spells but no book (known_spells, Stage 4)');
  const outside = validateReview({ ...wizardBase, prepared_spells: ['magic missile', 'shield', 'mage armor', 'fireball'] }, ctx);
  check(outside.canCommit === false && outside.errors.some(e => e.field === 'prepared_spells' && e.stageIndex === 3 && /spellbook/.test(e.message)),
    'Review blocks a wizard with a prepared spell outside the book (prepared_spells, Stage 4)');
  // The exact server refusal strings (server/routes/character.js):
  // the commit refusal, the membership refusal, and the lost-book
  // refusal — all three must jump to Stage 4.
  check(stageForServerError("knownSpells: wizard's spellbook is empty — pick 6 spells for the spellbook on Stage 4 (prepared spells must come from the book); the book is never auto-filled") === 3,
    'the bookless-wizard commit refusal jumps to Stage 4');
  check(stageForServerError("preparedSpells: 'fireball' is not in the spellbook — prepared spells must come from the book (known_spells)") === 3,
    'the prepared-outside-book refusal jumps to Stage 4');
  check(stageForServerError('preparedSpells: the spellbook is lost — prepared spells cannot be changed until the spellbook is recovered or replaced') === 3,
    'the lost-book refusal jumps to Stage 4');
  // The Review Spells section renders the book distinctly from the
  // prepared subset for a wizard (not the generic "Spells known" line).
  const stage6Src = readRepo('client/src/components/creator-next/Stage6ReviewCommit.jsx');
  check(stage6Src.includes('Spellbook ({(state.known_spells'),
    'Review renders the wizard spellbook as "Spellbook (N of 6 spells)"');
  check(stage6Src.includes('Spells prepared ({(state.prepared_spells'),
    'Review renders the wizard prepared subset as "Spells prepared (N — from the book above)"');
}

// (j) Edit-mode L2 fighting-style picker (2026-11-08): a level-2
// paladin in edit mode gets the picker, picks a style, saves, and the
// row reads it back; L1 paladin/ranger get no picker and save without
// a style; a stored style rehydrates pre-selected; a ranger at L2
// gets the picker too; Review blocks a style-less L2 paladin naming
// fightingStyle. The picker gate is the real fightingStyleGate from
// the Stage 2 bundle (not a re-implementation); the level is the real
// row level read back over HTTP, the way the shell fetches it.
group('(j) Edit-mode L2 fighting-style picker');
{
  const reviewCtx = (extra = {}) => ({ speciesEntry: DWARF_ENTRY, speciesEntries: [DWARF_ENTRY], mixedTables: null, themes: [SOLDIER_THEME], subclassesByClass: {}, ...extra });
  const stoutRowJ = await db.dbGet(
    "SELECT id FROM ancestry_feats WHERE list_id = 'dwarf' AND tier = 1 AND feat_name = 'Stout-Hearted'"
  );
  check(stoutRowJ?.id != null, 'Stout-Hearted tier-1 dwarf feat resolves for the L2 fixtures');
  const stoutJ = stoutRowJ?.id;

  // The live list is the picker's only source: the gate returns it
  // verbatim, never a hardcoded copy.
  const fsRes = await fetch('/api/fighting-styles');
  check(fsRes.ok, 'the live fighting-styles endpoint answers for the gate fixtures');
  const liveStyles = (await fsRes.json())?.fightingStyles?.map((f) => f?.name).filter(Boolean) || [];
  check(liveStyles.length === 10, `the live list serves 10 styles (got ${liveStyles.length})`);
  check(liveStyles.includes('Defense') && liveStyles.includes('Archery'),
    'the live list includes Defense and Archery');

  // (j1) THE test Zach asked for: level-2 paladin in edit mode.
  const p1 = await fetch('/api/spells?class=paladin&level=1');
  check(p1.ok, 'the live spells endpoint answers for the L2 paladin fixture');
  const paladinPrepared = (await p1.json())?.spells?.slice(0, 2).map((s) => s.key) || [];
  check(paladinPrepared.length === 2, `the L2 paladin fixture draws 2 prepared keys (got ${paladinPrepared.length})`);
  const paladinL2State = { ...draftPaladinState(stoutJ, paladinPrepared), first_name: 'S6', last_name: 'Paladin L2' };
  const paladinL2Saved = await saveStage1Progress({ state: paladinL2State, characterId: null });
  const paladinL2Id = paladinL2Saved.character_id;
  check(typeof paladinL2Id === 'number', 'L2 paladin draft save creates a row');
  await db.dbRun('UPDATE characters SET level = 2 WHERE id = ?', [paladinL2Id]);
  // Open edit mode: the shell's row fetch reads the level back over HTTP.
  const editRowRes = await fetch(`/api/character/${paladinL2Id}`);
  check(editRowRes.ok, 'edit mode reads the row back over HTTP');
  const editRow = await editRowRes.json();
  check(editRow?.level === 2, `edit mode sees level 2 on the row (got ${editRow?.level})`);
  check(editRow?.class === 'paladin', `edit mode sees the paladin class on the row (got ${editRow?.class})`);
  // The picker appears: the real gate, fed that level, offers the live list.
  const gateL2 = fightingStyleGate({ classId: 'paladin', characterLevel: editRow.level, classLevels: editRow.class_levels, styleOptions: liveStyles });
  check(gateL2.offersFightingStyle === true, 'the picker appears for a level-2 paladin in edit mode');
  check(JSON.stringify(gateL2.fightingStyles) === JSON.stringify(liveStyles),
    'the picker offers the live 10-style list verbatim');
  // Pick a style and save: the PUT accepts it on the same row.
  const pickedState = { ...paladinL2State, fightingStyle: 'Defense' };
  const pickedSaved = await saveStage1Progress({ state: pickedState, characterId: paladinL2Id });
  check(pickedSaved.character_id === paladinL2Id, 'the style pick saves onto the same row (no second row)');
  const pickedRow = await readCharacter(paladinL2Id);
  check(pickedRow?.fighting_style === 'Defense', `the row reads the picked style back (got ${pickedRow?.fighting_style})`);
  // Review passes it, and the edit-mode commit accepts it, still level 2.
  const pickedReview = validateReview(pickedState, reviewCtx({ characterLevel: 2 }));
  check(pickedReview.canCommit === true && pickedReview.errors.length === 0,
    `Review passes the L2 paladin with a style (got ${JSON.stringify(pickedReview.errors)})`);
  const pickedCommitted = await commitCharacter({ state: pickedState, characterId: paladinL2Id, mode: 'edit' });
  check(pickedCommitted && pickedCommitted.id === paladinL2Id, 'edit-mode commit accepts the L2 paladin with a style');
  const committedRow = await readCharacter(paladinL2Id);
  check(committedRow?.fighting_style === 'Defense', 'the committed row keeps the style');
  check(committedRow?.level === 2, `the edit-mode commit preserves level 2 (got ${committedRow?.level})`);
  check(committedRow?.creation_phase === 'active', 'the edit-mode commit lands active');
  check(await characterCountByName('S6 Paladin L2') === 1, 'the L2 paladin edit creates no second row');

  // (j2) A stored style rehydrates pre-selected: the row gives the
  // style back, the gate shows the picker at L2, and the select binds
  // the stored value (the binding half is pinned statically in (j8)).
  const rehydratedL2 = rehydrateStateFromServerRow(committedRow, null);
  check(rehydratedL2.fightingStyle === 'Defense',
    'rehydration reads the stored fighting style back from the row');
  const gateRehydrated = fightingStyleGate({ classId: 'paladin', characterLevel: committedRow.level, classLevels: committedRow.class_levels, styleOptions: liveStyles });
  check(gateRehydrated.offersFightingStyle === true && gateRehydrated.fightingStyles?.includes('Defense'),
    'the picker shows for the rehydrated L2 paladin with its stored style in the list');

  // (j3) L1 paladin: NO picker, and it saves without a style.
  const gateL1Pal = fightingStyleGate({ classId: 'paladin', characterLevel: 1, styleOptions: liveStyles });
  check(gateL1Pal.offersFightingStyle === false && gateL1Pal.fightingStyles === null,
    'a level-1 paladin sees no fighting-style picker');
  const l1PalState = { ...paladinL2State, first_name: 'S6', last_name: 'Paladin L1' };
  const l1PalReview = validateReview(l1PalState, reviewCtx({ characterLevel: 1 }));
  check(!l1PalReview.errors.some((e) => e.field === 'fightingStyle'),
    `Review does not block a level-1 paladin without a style (got ${JSON.stringify(l1PalReview.errors)})`);
  const l1PalSaved = await saveStage1Progress({ state: l1PalState, characterId: null });
  const l1PalRow = await readCharacter(l1PalSaved.character_id);
  check(l1PalRow?.fighting_style == null, `a level-1 paladin saves without a style (row holds ${l1PalRow?.fighting_style})`);

  // (j4) L1 ranger: NO picker, and it commits without a style.
  const r1 = await fetch('/api/spells?class=ranger&level=1');
  check(r1.ok, 'the live spells endpoint answers for the ranger fixture');
  const rangerPrepared = (await r1.json())?.spells?.slice(0, 2).map((s) => s.key) || [];
  check(rangerPrepared.length === 2, `the ranger fixture draws 2 prepared keys (got ${rangerPrepared.length})`);
  const rangerL1State = { ...draftRangerState(stoutJ, rangerPrepared), first_name: 'S6', last_name: 'Ranger L1' };
  const gateL1Rng = fightingStyleGate({ classId: 'ranger', characterLevel: 1, styleOptions: liveStyles });
  check(gateL1Rng.offersFightingStyle === false && gateL1Rng.fightingStyles === null,
    'a level-1 ranger sees no fighting-style picker');
  const rangerL1Review = validateReview(rangerL1State, reviewCtx({ characterLevel: 1 }));
  check(rangerL1Review.canCommit === true && rangerL1Review.errors.length === 0,
    `Review passes the complete level-1 ranger without a style (got ${JSON.stringify(rangerL1Review.errors)})`);
  const rangerL1Saved = await saveStage1Progress({ state: rangerL1State, characterId: null });
  const rangerL1Committed = await commitCharacter({ state: rangerL1State, characterId: rangerL1Saved.character_id, mode: 'manual' });
  check(rangerL1Committed && rangerL1Committed.id === rangerL1Saved.character_id,
    'a level-1 ranger commits without a style');
  const rangerL1Row = await readCharacter(rangerL1Saved.character_id);
  check(rangerL1Row?.fighting_style == null, 'the committed L1 ranger row holds no style');

  // (j5) Ranger at L2 gets the picker too — and Review + the server
  // both refuse without a style, then accept with one.
  const rangerL2State = { ...draftRangerState(stoutJ, rangerPrepared), first_name: 'S6', last_name: 'Ranger L2' };
  const gateL2Rng = fightingStyleGate({ classId: 'ranger', characterLevel: 2, styleOptions: liveStyles });
  check(gateL2Rng.offersFightingStyle === true && JSON.stringify(gateL2Rng.fightingStyles) === JSON.stringify(liveStyles),
    'the picker appears for a level-2 ranger');
  const rangerL2NoStyleReview = validateReview(rangerL2State, reviewCtx({ characterLevel: 2 }));
  check(rangerL2NoStyleReview.canCommit === false
    && rangerL2NoStyleReview.errors.some((e) => e.field === 'fightingStyle' && e.stageIndex === 1 && /level 2/.test(e.message)),
    `Review blocks a style-less level-2 ranger naming fightingStyle at Stage 2 (got ${JSON.stringify(rangerL2NoStyleReview.errors)})`);
  const rangerL2Saved = await saveStage1Progress({ state: rangerL2State, characterId: null });
  const rangerL2Id = rangerL2Saved.character_id;
  await db.dbRun('UPDATE characters SET level = 2 WHERE id = ?', [rangerL2Id]);
  let rangerL2Refused = null;
  try {
    await commitCharacter({ state: rangerL2State, characterId: rangerL2Id, mode: 'edit' });
  } catch (err) { rangerL2Refused = err; }
  check(rangerL2Refused instanceof Error && /fightingStyle/.test(rangerL2Refused.message) && /level 2/.test(rangerL2Refused.message),
    `the server refuses a style-less L2 ranger naming fightingStyle + level 2 (got ${rangerL2Refused?.message || 'no throw'})`);
  const rangerL2Picked = { ...rangerL2State, fightingStyle: 'Archery' };
  const rangerL2Committed = await commitCharacter({ state: rangerL2Picked, characterId: rangerL2Id, mode: 'edit' });
  check(rangerL2Committed && rangerL2Committed.id === rangerL2Id, 'edit-mode commit accepts the L2 ranger with a style');
  const rangerL2Row = await readCharacter(rangerL2Id);
  check(rangerL2Row?.fighting_style === 'Archery', `the committed L2 ranger row keeps Archery (got ${rangerL2Row?.fighting_style})`);
  check(rangerL2Row?.level === 2, `the ranger edit-mode commit preserves level 2 (got ${rangerL2Row?.level})`);

  // (j6) Review blocks a style-less L2 paladin naming fightingStyle —
  // and the server agrees, so the player meets the block at Review
  // instead of a commit 400 with nowhere to pick.
  const paladinL2NoStyleReview = validateReview(paladinL2State, reviewCtx({ characterLevel: 2 }));
  check(paladinL2NoStyleReview.canCommit === false
    && paladinL2NoStyleReview.errors.some((e) => e.field === 'fightingStyle' && e.stageIndex === 1 && /level 2/.test(e.message)),
    `Review blocks a style-less level-2 paladin naming fightingStyle at Stage 2 (got ${JSON.stringify(paladinL2NoStyleReview.errors)})`);
  check(stageForServerError('fightingStyle: paladin picks a fighting style at level 2 — send one at Review') === 1,
    'the L2 paladin server refusal jumps to Stage 2');
  // A fresh style-less L2 paladin row refuses at commit naming the field.
  const paladinL2BareState = { ...paladinL2State, first_name: 'S6', last_name: 'Paladin L2 Bare' };
  const paladinL2BareSaved = await saveStage1Progress({ state: paladinL2BareState, characterId: null });
  const paladinL2BareId = paladinL2BareSaved.character_id;
  await db.dbRun('UPDATE characters SET level = 2 WHERE id = ?', [paladinL2BareId]);
  let paladinL2Refused = null;
  try {
    await commitCharacter({ state: paladinL2BareState, characterId: paladinL2BareId, mode: 'edit' });
  } catch (err) { paladinL2Refused = err; }
  check(paladinL2Refused instanceof Error && /fightingStyle/.test(paladinL2Refused.message) && /level 2/.test(paladinL2Refused.message),
    `the server refuses a style-less L2 paladin naming fightingStyle + level 2 (got ${paladinL2Refused?.message || 'no throw'})`);

  // (j7) Multiclass corner (client mirrors the server §13 class-level
  // rule): paladin 1 / rogue 1 (row total 2) gets NO picker and NO
  // Review block — the style is not hers yet.
  const multiLevels = [{ class: 'paladin', level: 1 }, { class: 'rogue', level: 1 }];
  const gateMulti = fightingStyleGate({ classId: 'paladin', characterLevel: 2, classLevels: multiLevels, styleOptions: liveStyles });
  check(gateMulti.offersFightingStyle === false && gateMulti.fightingStyles === null,
    'a paladin 1 / rogue 1 sees no picker (paladin level 1, not the row total 2)');
  const gateMultiStr = fightingStyleGate({ classId: 'paladin', characterLevel: 2, classLevels: JSON.stringify(multiLevels), styleOptions: liveStyles });
  check(gateMultiStr.offersFightingStyle === false,
    'the gate reads class_levels as a JSON string too (the row wire shape)');
  const multiReview = validateReview(paladinL2State, reviewCtx({ characterLevel: 2, classLevels: multiLevels }));
  check(!multiReview.errors.some((e) => e.field === 'fightingStyle'),
    `Review does not block a paladin 1 / rogue 1 without a style (got ${JSON.stringify(multiReview.errors)})`);
  // And the class-level helpers agree with each other on both sides.
  check(stage2ClassLevelFor('paladin', 2, multiLevels) === 1, 'Stage 2 class level reads paladin 1 from class_levels');
  check(reviewClassLevelFor('paladin', 2, multiLevels) === 1, 'Review class level reads paladin 1 from class_levels');
  check(stage2ClassLevelFor('paladin', 2, null) === 2, 'no class_levels falls back to the row total');
  check(reviewClassLevelFor('ranger', 2, [{ class: 'ranger', level: 2 }]) === 2, 'Review class level reads ranger 2 from class_levels');

  // (j8) Static pins: the shell plumbs the level, the select binds the
  // stored style, and no auto-fill picks a style for the player
  // (Quick Build removed, creator test-notes #9).
  const shellSrc = readRepo('client/src/components/creator-next/CreatorNextShell.jsx');
  check(shellSrc.includes('fetch(`/api/character/${resumeCharacterId}`)'),
    'the shell fetches the row for the level in edit/resume mode');
  check((shellSrc.match(/if \(!resumeCharacterId \|\| opening\.hadMirror\) return/g) || []).length === 1,
    'the hadMirror guard exists once (rehydration only) — the level fetch runs even with a mirror');
  check(shellSrc.includes('characterLevel={characterLevel ?? 1}') && shellSrc.includes('classLevels={classLevels}'),
    'the shell passes characterLevel + classLevels to Stage 2 and Review');
  const stage2Src = readRepo('client/src/components/creator-next/Stage2ClassCalling.jsx');
  check(stage2Src.includes("value={state.fightingStyle || ''}"),
    'the Stage 2 select binds the stored fighting style (pre-selected in edit mode)');
  check(!stage2Src.includes('quickBuild'),
    'no Quick Build auto-fill remains — no style is ever auto-picked, paladin/ranger included');
  // Fighter is unchanged: still L1, still the live list.
  const gateFighter = fightingStyleGate({ classId: 'fighter', characterLevel: 1, styleOptions: liveStyles });
  check(gateFighter.offersFightingStyle === true && JSON.stringify(gateFighter.fightingStyles) === JSON.stringify(liveStyles),
    'a level-1 fighter still gets the picker with the live list');
  const gateSwords = fightingStyleGate({ classId: 'bard', subclassName: 'College of Swords', characterLevel: 1, styleOptions: liveStyles });
  check(JSON.stringify(gateSwords.fightingStyles) === JSON.stringify(['Dueling', 'Two-Weapon Fighting']),
    'a Swords bard still gets its own two-style list');
}

// ---------------------------------------------------------------------------
server.close();
console.log(`\n creator-next-stage6: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
