// tests/creator-next-stage6-commit.test.js — creator-next Stage 6
// ("Review & Commit" + edit mode) build (Zach, 2026-11-07).
//
// What this build wires in (server side only):
//   - server/routes/character.js: exported validateCreatorNextStage6
//     (composes the Stage 2–5 validators on a MERGED body — stored
//     row + side tables + request body, body wins — plus the
//     commit-only completeness checks), POST /api/character/:id/commit
//     (validates first, then applies definition fields only, re-runs
//     the idempotent persists from merged state at level 1, clears
//     the theme origin-feat row on a forgo trade, flips
//     creation_phase to 'active'), and the commit-only write path
//     for the local-only fields (fighting_style, expertise,
//     subclass_choices_json — the columns exist, the creator routes
//     just never wrote them; NO migration 111 was needed).
//   - Two Stage 4 fixes found while building the commit (same
//     defect class: the human Versatile slot was not accounted in
//     Stage 4's grant accounting): a versatile Magic Initiate
//     level-1 spell is now a granted spell (it wrongly consumed a
//     prepared pick), and versatile Skilled picks are now subtracted
//     when deriving class picks (a human with Versatile Skilled was
//     refused for "too many class picks"). Both are pinned below.
//
// Stage 6 follow-up (2026-11-07, cantrip + fighting-style
// collection path) — groups (p)–(t):
//   - the fighting-style level gate: fighter L1 only; paladin /
//     ranger at L2+ (an L1 paladin/ranger commits with no style),
//     plus registry membership by key or display name;
//   - cantrip mode on GET /api/spells (?level=0) and the new
//     GET /api/fighting-styles, with per-class L1 counts driven by
//     the real getCantripsKnown (never hardcoded from memory);
//   - the PUT allowlist now persists fighting_style and
//     subclass_choices_json on draft saves (known_cantrips was
//     already allowlisted — pinned, not changed);
//   - magus / scholar with a subclass name but no choices commit
//     (warlord already pinned in (l)); the count skip is pinned
//     over HTTP for mixed ancestry and for a subclass-pending magus.
//
// Honest integration tests: the validator, the commit route, the
// real services (species, theme, package resolver, cantrip
// resolution, subclass, mixed ancestry) and the real DB are driven
// over real HTTP, exactly like the Stage 5 suite. Ancestry-feat ids
// are resolved at runtime from the seeded ancestry_feats table (no
// hardcoded ids); expected gold / prepared counts are derived from
// the real services (computeGoldFork, getSpellsPrepared), never
// from memory. If any real module were deleted, the imports fail
// and the suite fails with them. Footer is the runner-matching
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

const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'creator-next-stage6-test-'));
const tmpDir = repoRoot;
const origCwd = process.cwd();
process.chdir(tmpDir);
delete process.env.TURSO_DATABASE_URL;
delete process.env.TURSO_AUTH_TOKEN;
const fromRepo = (rel) => pathToFileURL(path.join(origCwd, rel)).href;

const db = await import(fromRepo('server/database.js'));
await db.initDatabase();
// The real modules under test.
const characterModule = await import(fromRepo('server/routes/character.js'));
const { validateCreatorNextStage6 } = characterModule;
const { resolveTheme } = await import(fromRepo('server/services/themeService.js'));
const { computeGoldFork } = await import(fromRepo('server/services/packageResolutionService.js'));
const { getCantripsKnown, getSpellsPrepared, spellcastingAbilityFor } = await import(fromRepo('server/config/levelProgression.js'));
const { listFightingStyleFeats } = await import(fromRepo('server/data/featRegistry.js'));
const { canLearnSpell } = await import(fromRepo('server/services/spellSelectionService.js'));
const { CLASS_CHASSIS } = await import(fromRepo('server/data/classChassis.js'));

// --- HTTP harness: the real character router on one app ---
const app = express();
app.use(express.json());
const characterRouter = characterModule.default;
app.use('/api/character', characterRouter);
// The read routes the Stage 6 follow-up added (cantrip mode on
// /api/spells, /api/fighting-styles) ride the same harness, so the
// endpoint contracts are tested over real HTTP too.
const spellsModule = await import(fromRepo('server/routes/spells.js'));
const fightingStylesModule = await import(fromRepo('server/routes/fightingStyles.js'));
app.use('/api/spells', spellsModule.default);
app.use('/api/fighting-styles', fightingStylesModule.default);
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
async function commitCharacter(id, body) {
  const res = await fetch(`${base}/api/character/${id}/commit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  let json = null;
  try { json = await res.json(); } catch {}
  return { status: res.status, json };
}
async function readCharacter(id) {
  return db.dbGet('SELECT * FROM characters WHERE id = ?', [id]);
}
async function getApi(pathQuery) {
  const res = await fetch(`${base}${pathQuery}`);
  let json = null;
  try { json = await res.json(); } catch {}
  return { status: res.status, json };
}
function parseCol(row, col) {
  try { return JSON.parse(row[col]); } catch { return undefined; }
}
function errOf(r) { return typeof r.json?.error === 'string' ? r.json.error : JSON.stringify(r.json); }

const MARKER = 'creator-next';
const J = (v) => JSON.stringify(v); // the wire format for JSON columns: strings, not raw arrays

// The client wire format: list columns ride as JSON strings.
const WIRE_FIELDS = ['ability_scores', 'skills', 'languages', 'tool_proficiencies', 'known_spells', 'prepared_spells', 'known_cantrips', 'expertise'];
function wireBody(body) {
  const out = { ...body };
  for (const f of WIRE_FIELDS) {
    if (out[f] !== undefined && out[f] !== null && typeof out[f] !== 'string') out[f] = J(out[f]);
  }
  return out;
}
async function postDraft(body) { return postCharacter(wireBody(body)); }

// --- Ancestry-feat ids, resolved at runtime from the seed table ---
async function ancestryFeatId(listId, featName, tier = 1) {
  const row = await db.dbGet('SELECT id FROM ancestry_feats WHERE list_id = ? AND tier = ? AND feat_name = ?', [listId, tier, featName]);
  assert(row?.id != null, `feat ${featName} (${listId} t${tier}) resolves`);
  return row.id;
}
async function noChoiceAncestryFeatId(listIds) {
  const placeholders = listIds.map(() => '?').join(',');
  const row = await db.dbGet(
    `SELECT id, feat_name FROM ancestry_feats WHERE list_id IN (${placeholders}) AND tier = 1 AND (choices IS NULL OR choices = '[]') ORDER BY list_id, choice_index LIMIT 1`,
    listIds
  );
  assert(row?.id != null, `a no-choice tier-1 feat resolves for ${listIds.join(',')}`);
  return row.id;
}
const STOUT_HEARTED_ID = await ancestryFeatId('dwarf', 'Stout-Hearted');
const TRAVELERS_TONGUE_ID = await ancestryFeatId('human', "Traveler's Tongue");
const JACK_ID = await noChoiceAncestryFeatId(['human']);
const MIXED_NO_CHOICE_ID = await noChoiceAncestryFeatId(['human', 'elf']);
const ELF_NO_CHOICE_ID = await noChoiceAncestryFeatId(['elf']);
const HALF_ELF_NO_CHOICE_ID = await noChoiceAncestryFeatId(['half_elf']);

// --- Verified-good fixtures (Stage 4/5 suites) --------------------
const DWARF_BASE = { str: 12, dex: 10, con: 13, int: 8, wis: 15, cha: 14 };
const DWARF_FINAL = { str: 14, dex: 10, con: 16, int: 8, wis: 16, cha: 14 };
const DWARF_PREPARED = ['bless', 'cure wounds', 'guiding bolt', 'shield of faith'];
const DWARF_CANTRIPS = ['Guidance', 'Sacred Flame', 'Thaumaturgy'];
const STORY = {
  alignment: 'Lawful Good', faith: 'Moradin', lifestyle: 'Modest',
  age: '58', height: `4'3"`, weight: '180 lb', eye_color: 'Brown',
  hair_color: 'Black', skin_color: 'Tan', physical_build: 'Sturdy',
};
const ORIGIN_FR = { origin_setting: 'Forgotten Realms', origin_region: 'Sword Coast', origin_explanation: 'Born in the Sword Coast.' };
const CLERIC_PACKAGE = { gear_choice: 'packages', package_id: 'A', package_picks: J({ holy: { alternative: 0 } }) };

function dwarfClericDraft(overrides = {}) {
  return {
    creator: MARKER,
    name: 'Borin Stonehelm', first_name: 'Borin', gender: 'Male',
    race: 'dwarf', subrace: 'Hill Dwarf',
    ...ORIGIN_FR,
    class: 'cleric', theme_id: 'soldier', origin_feat: 'savage_attacker',
    theme_path_choice: 'sergeant', theme_path_data: { active_duty: 'active' },
    generation_method: 'point_buy', base_scores: DWARF_BASE, ability_scores: DWARF_FINAL,
    skills: ['Athletics', 'Intimidation', 'Religion'],
    languages: ['Common', 'Dwarvish'],
    prepared_spells: DWARF_PREPARED,
    known_cantrips: DWARF_CANTRIPS,
    ancestry_feat_id: STOUT_HEARTED_ID,
    ...STORY,
    ...CLERIC_PACKAGE,
    ...overrides,
  };
}

// Per-theme dwarf cleric: finals recomputed from the REAL theme ASI,
// skills = the theme's two signature skills + the first cleric
// option not already among them, prepared count from the resulting
// Wis mod. (Stage 5 pattern.)
function clericBodyForTheme(themeId, overrides = {}) {
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
  const prepared = ['bless', 'cure wounds', 'guiding bolt', 'shield of faith', 'sanctuary'].slice(0, prepCount);
  return {
    creator: MARKER,
    name: 'Theme Cleric', first_name: 'Theme', gender: 'Female',
    race: 'dwarf', subrace: 'Hill Dwarf',
    ...ORIGIN_FR,
    class: 'cleric', theme_id: themeId,
    generation_method: 'point_buy', base_scores: DWARF_BASE, ability_scores: finals,
    skills: [...sigs, extra],
    languages: ['Common', 'Dwarvish'],
    prepared_spells: prepared,
    known_cantrips: DWARF_CANTRIPS,
    ancestry_feat_id: STOUT_HEARTED_ID,
    ...STORY,
    ...CLERIC_PACKAGE,
    ...overrides,
  };
}

// A complete, valid mixed record (doc example shape): Human/Elf,
// Elven Lineage 5 + Resourceful 2 = 7/7, size Medium.
function validMixedRecord(overrides = {}) {
  return {
    parents: ['human', 'elf'],
    traits: [
      { species: 'elf', trait: 'Elven Lineage', cost: 5 },
      { species: 'human', trait: 'Resourceful', cost: 2 },
    ],
    size: 'Medium',
    speed: 30,
    forgoOriginFeat: false,
    versatileFeat: '',
    ...overrides,
  };
}

async function expectCommitRefusal(id, body, field, label) {
  const r = await commitCharacter(id, wireBody(body));
  check(r.status === 400, `${label}: commit refuses 400 (got ${r.status}: ${errOf(r)})`);
  check(errOf(r).includes(field), `${label}: refusal names ${field} (got ${errOf(r)})`);
  return r;
}
async function sideTableCounts(id) {
  const theme = await db.dbGet('SELECT COUNT(*) AS n FROM character_themes WHERE character_id = ?', [id]);
  const origin = await db.dbGet('SELECT COUNT(*) AS n FROM character_origin_feats WHERE character_id = ? AND slot = \'theme\'', [id]);
  const vers = await db.dbGet('SELECT COUNT(*) AS n FROM character_origin_feats WHERE character_id = ? AND slot = \'versatile\'', [id]);
  const ancestry = await db.dbGet('SELECT COUNT(*) AS n FROM character_ancestry_feats WHERE character_id = ?', [id]);
  const unlocks = await db.dbGet('SELECT COUNT(*) AS n FROM character_theme_unlocks WHERE character_id = ?', [id]);
  return { theme: theme?.n ?? 0, origin: origin?.n ?? 0, versatile: vers?.n ?? 0, ancestry: ancestry?.n ?? 0, unlocks: unlocks?.n ?? 0 };
}

// ===========================================================================
// (a) Happy-path commit: full draft -> active, grants present/idempotent
// ===========================================================================
group('(a) happy-path commit (dwarf cleric)');
{
  const created = await postDraft(dwarfClericDraft());
  check(created.status === 201, `draft POST creates 201 (got ${created.status}: ${errOf(created)})`);
  const id = created.json?.id;
  check(typeof id === 'number', 'draft POST returns an id');
  const draftRow = await readCharacter(id);
  check(draftRow?.max_hp === 11, `draft derives HP 11 (d8 + Con 3; got ${draftRow?.max_hp})`);
  check(draftRow?.armor_class === 15, `draft derives AC 15 (got ${draftRow?.armor_class})`);
  check(draftRow?.gold_gp === 7, `draft derives gold 7 (got ${draftRow?.gold_gp})`);
  check(draftRow?.speed === 25, `draft derives speed 25 (got ${draftRow?.speed})`);
  check(draftRow?.creation_phase === 'creating', `draft phase is 'creating' (got ${draftRow?.creation_phase})`);
  const before = await sideTableCounts(id);
  check(before.theme === 1 && before.origin === 1 && before.ancestry === 1, `draft persists theme + origin feat + ancestry feat once each (got ${JSON.stringify(before)})`);

  // Commit with the full body (the client re-sends the final draft state).
  const committed = await commitCharacter(id, dwarfClericDraft());
  check(committed.status === 200, `full-body commit is 200 (got ${committed.status}: ${errOf(committed)})`);
  check(committed.json?.creation_phase === 'active', `commit flips creation_phase to 'active' (got ${committed.json?.creation_phase})`);
  const row = await readCharacter(id);
  check(row?.creation_phase === 'active', 'stored row is active after commit');
  check(row?.max_hp === 11 && row?.current_hp === 11, `commit keeps derived HP 11 (got ${row?.max_hp}/${row?.current_hp})`);
  check(row?.armor_class === 15 && row?.gold_gp === 7 && row?.speed === 25, 'commit keeps derived AC / gold / speed');
  check(parseCol(row, 'inventory').some((it) => it.name === 'Amulet' && it.source === 'stage5-package'), 'commit keeps the resolved package inventory');
  const after = await sideTableCounts(id);
  check(after.theme === 1 && after.origin === 1 && after.ancestry === 1 && after.unlocks === 1,
    `commit keeps exactly one row per side table (got ${JSON.stringify(after)})`);
  check(after.origin === before.origin, 'commit does not double-apply the origin feat');

  // Commit again: idempotent — still exactly one row per side table.
  const again = await commitCharacter(id, dwarfClericDraft());
  check(again.status === 200, `second commit is 200 (got ${again.status}: ${errOf(again)})`);
  const twice = await sideTableCounts(id);
  check(twice.theme === 1 && twice.origin === 1 && twice.ancestry === 1 && twice.unlocks === 1,
    `second commit adds no rows (got ${JSON.stringify(twice)})`);
}

// ===========================================================================
// (b) Empty-body commit on a fully-saved draft
// ===========================================================================
group('(b) empty-body commit');
{
  const created = await postDraft(dwarfClericDraft({ name: 'Empty Body Hero' }));
  check(created.status === 201, `draft POST creates 201 (got ${created.status}: ${errOf(created)})`);
  const id = created.json?.id;
  const committed = await commitCharacter(id, {});
  check(committed.status === 200, `empty-body commit is 200 (got ${committed.status}: ${errOf(committed)})`);
  check(committed.json?.creation_phase === 'active', 'empty-body commit flips to active');
  const counts = await sideTableCounts(id);
  check(counts.theme === 1 && counts.origin === 1 && counts.ancestry === 1, `empty-body commit persists the stored grants (got ${JSON.stringify(counts)})`);
}

// ===========================================================================
// (c) Refusal directions — one valid draft, many refused commits
// ===========================================================================
group('(c) refusal directions');
{
  const created = await postDraft(dwarfClericDraft({ name: 'Refusal Draft' }));
  check(created.status === 201, `refusal draft POST creates 201 (got ${created.status}: ${errOf(created)})`);
  const id = created.json?.id;

  await expectCommitRefusal(id, { name: '' }, 'name', 'missing name');
  await expectCommitRefusal(id, { name: '(unnamed)' }, 'name', 'placeholder name');
  await expectCommitRefusal(id, { first_name: '' }, 'firstName', 'missing first name');
  await expectCommitRefusal(id, { gender: '' }, 'gender', 'missing gender');
  await expectCommitRefusal(id, { class: '' }, 'classId', 'missing class');
  await expectCommitRefusal(id, { theme_id: '' }, 'themeId', 'missing theme');
  await expectCommitRefusal(id, { origin_feat: null }, 'originFeat', 'missing origin feat');
  await expectCommitRefusal(id, { ancestry_feat_id: null }, 'ancestryFeatId', 'missing ancestry feat');
  await expectCommitRefusal(id, { alignment: '' }, 'alignment', 'missing story field');
  await expectCommitRefusal(id, { origin_setting: 'Eberron', origin_explanation: '' }, 'originExplanation', 'outside-FR without explanation');
  await expectCommitRefusal(id, { origin_setting: '__other__' }, 'originSetting', 'sentinel origin setting');
  await expectCommitRefusal(id, { ability_scores: { str: 15, dex: 10, con: 16, int: 8, wis: 16, cha: 14 } }, 'abilityScores', 'finals changed without bases');
  await expectCommitRefusal(id, { base_scores: DWARF_BASE, ability_scores: { str: 15, dex: 10, con: 16, int: 8, wis: 16, cha: 14 } }, 'abilityScores', 'finals do not match base + species + theme');
  await expectCommitRefusal(id, { prepared_spells: [...DWARF_PREPARED, 'sanctuary'] }, 'preparedSpells', 'spells over cap');
  await expectCommitRefusal(id, { known_cantrips: [] }, 'knownCantrips', 'missing cantrips');
  await expectCommitRefusal(id, { known_cantrips: ['Guidance', 'Sacred Flame'] }, 'knownCantrips', 'cantrip count short');
  await expectCommitRefusal(id, { known_cantrips: ['Guidance', 'Sacred Flame', 'Fireball'] }, 'knownCantrips', 'non-cantrip in the cantrip list');
  await expectCommitRefusal(id, { gear_choice: 'packages', package_id: 'Z' }, 'packageId', 'unknown package id');
  await expectCommitRefusal(id, { gear_choice: 'packages', package_id: 'A', package_picks: J({}) }, 'packageId', 'incomplete package picks');
  await expectCommitRefusal(id, { gear_choice: 'gold', package_id: 'A' }, 'packageId', 'gold fork with a package id');
  await expectCommitRefusal(id, { subclass_choices: { bogus_key: 'x' } }, 'subclassChoices', 'subclass choices without a subclass');

  // Unknown species: bypass the route guard with a direct UPDATE
  // (simulates a legacy / other-path row), then commit must refuse.
  await db.dbRun("UPDATE characters SET race = 'Glimmerfolk' WHERE id = ?", [id]);
  await expectCommitRefusal(id, {}, 'race', 'unknown species');
  await db.dbRun("UPDATE characters SET race = 'dwarf' WHERE id = ?", [id]);
  // MVP-deferred species: same trick.
  await db.dbRun("UPDATE characters SET race = 'aarakocra' WHERE id = ?", [id]);
  await expectCommitRefusal(id, {}, 'race', 'deferred species');
  await db.dbRun("UPDATE characters SET race = 'dwarf' WHERE id = ?", [id]);

  // A refused commit writes nothing: the draft is unchanged and
  // still commits after every refusal above.
  const row = await readCharacter(id);
  check(row?.creation_phase === 'creating', 'refused commits leave the draft in creating');
  check(row?.name === 'Refusal Draft', 'refused commits write no fields');
  const ok = await commitCharacter(id, dwarfClericDraft({ name: 'Refusal Draft' }));
  check(ok.status === 200 && ok.json?.creation_phase === 'active', `draft still commits after refusals (got ${ok.status}: ${errOf(ok)})`);
}

// ===========================================================================
// (d) No-gear draft cannot commit
// ===========================================================================
group('(d) no-gear draft refuses');
{
  const { gear_choice, package_id, package_picks, ...noGear } = dwarfClericDraft({ name: 'No Gear Hero' });
  const created = await postDraft(noGear);
  check(created.status === 201, `no-gear draft POST creates 201 (got ${created.status}: ${errOf(created)})`);
  const id = created.json?.id;
  await expectCommitRefusal(id, {}, 'gearChoice', 'no stored gear and no gear in the body');
}

// ===========================================================================
// (e) Edit-mode commit: progression preserved, definition changes
// ===========================================================================
group('(e) edit-mode commit preserves progression');
{
  const created = await postDraft(dwarfClericDraft({ name: 'Edit Mode Hero' }));
  const id = created.json?.id;
  const c1 = await commitCharacter(id, dwarfClericDraft({ name: 'Edit Mode Hero' }));
  check(c1.status === 200 && c1.json?.creation_phase === 'active', `first commit is 200/active (got ${c1.status})`);
  // Simulate play: level up, earn XP + gold, pick up loot.
  await db.dbRun(
    'UPDATE characters SET level = 3, experience = 900, experience_to_next_level = 2700, gold_gp = 500, inventory = ? WHERE id = ?',
    [J([{ name: 'Potion of Healing', quantity: 2, equipped: false, source: 'loot' }]), id]
  );
  // Edit-mode commit: rename + change a definition field only.
  const c2 = await commitCharacter(id, { name: 'Edit Mode Hero Renamed', faith: 'Clangeddin' });
  check(c2.status === 200, `edit-mode commit is 200 (got ${c2.status}: ${errOf(c2)})`);
  const row = await readCharacter(id);
  check(row?.level === 3, `edit commit keeps level 3 (got ${row?.level})`);
  check(row?.experience === 900, `edit commit keeps XP 900 (got ${row?.experience})`);
  check(row?.experience_to_next_level === 2700, 'edit commit keeps XP-to-next-level');
  check(row?.gold_gp === 500, `edit commit keeps gold 500, not re-derived (got ${row?.gold_gp})`);
  check(parseCol(row, 'inventory').some((it) => it.name === 'Potion of Healing'), 'edit commit keeps played inventory');
  check(row?.max_hp === 11, `edit commit keeps max HP 11 (got ${row?.max_hp})`);
  check(row?.name === 'Edit Mode Hero Renamed', 'edit commit applies the new name');
  check(row?.faith === 'Clangeddin', 'edit commit applies the new faith');
  check(row?.creation_phase === 'active', 'edit commit stays active');
  const counts = await sideTableCounts(id);
  check(counts.theme === 1 && counts.origin === 1 && counts.ancestry === 1, `edit commit adds no side-table rows (got ${JSON.stringify(counts)})`);
}

// ===========================================================================
// (f) Human fighter + Traveler's Tongue (commit-time language derivation)
// ===========================================================================
group('(f) human fighter / Traveler\'s Tongue');
{
  const FIGHTER_BASE = { str: 15, dex: 13, con: 14, int: 10, wis: 12, cha: 8 };
  const FIGHTER_FINAL = { str: 17, dex: 13, con: 15, int: 10, wis: 12, cha: 8 };
  const fighterDraft = (overrides = {}) => ({
    creator: MARKER,
    name: 'Hana Strong', first_name: 'Hana', gender: 'Female',
    race: 'human',
    size: 'Medium',
    ...ORIGIN_FR,
    class: 'fighter', theme_id: 'soldier', origin_feat: 'savage_attacker',
    theme_path_choice: 'sergeant', theme_path_data: { active_duty: 'active' },
    generation_method: 'point_buy', base_scores: FIGHTER_BASE, ability_scores: FIGHTER_FINAL,
    skills: ['Athletics', 'Intimidation', 'Perception', 'Survival'],
    languages: ['Common', 'Elvish', 'Dwarvish'],
    known_cantrips: [],
    ancestry_feat_id: TRAVELERS_TONGUE_ID,
    ancestry_feat_choices: { languages: ['Elvish', 'Dwarvish'] },
    ...STORY,
    gear_choice: 'gold',
    ...overrides,
  });
  const created = await postDraft(fighterDraft());
  check(created.status === 201, `fighter draft POST creates 201 (got ${created.status}: ${errOf(created)})`);
  const id = created.json?.id;
  const fighterGold = computeGoldFork('fighter', 'soldier', 0).gold;
  check((await readCharacter(id))?.gold_gp === fighterGold, `fighter gold fork derives ${fighterGold}`);

  // No fighting style anywhere: the commit must refuse naming it.
  await expectCommitRefusal(id, {}, 'fightingStyle', 'fighter without a fighting style');
  // Commit with the fighting style: the commit-only write path
  // persists it (POST/PUT never wrote the column).
  const committed = await commitCharacter(id, wireBody({ ...fighterDraft(), fighting_style: 'Defense' }));
  check(committed.status === 200, `fighter commit is 200 (got ${committed.status}: ${errOf(committed)})`);
  const row = await readCharacter(id);
  check(row?.fighting_style === 'Defense', `fighting style persists via commit (got ${row?.fighting_style})`);
  check(row?.creation_phase === 'active', 'fighter commits to active');
  const storedChoices = await db.dbGet('SELECT choices_data FROM character_ancestry_feats WHERE character_id = ?', [id]);
  check(JSON.stringify(parseCol({ choices_data: storedChoices?.choices_data }, 'choices_data')) === JSON.stringify({ languages: ['Elvish', 'Dwarvish'] }),
    `Traveler's Tongue stores the count-2 array (got ${storedChoices?.choices_data})`);

  // Traveler's Tongue with a short array: exactly-count refuses at the
  // POST (draft-time) and at the commit (a commit body that shortens the
  // stored choices is refused the same way).
  const short = await postDraft(fighterDraft({
    name: 'Short Tongue',
    ancestry_feat_choices: { languages: ['Elvish'] },
  }));
  check(short.status === 400, `short-array draft POST refuses 400 (got ${short.status}: ${errOf(short)})`);
  check(errOf(short).includes('ancestryFeatChoices'), `short-array draft POST names ancestryFeatChoices (${errOf(short)})`);
  await expectCommitRefusal(id, { fighting_style: 'Defense', ancestry_feat_choices: { languages: ['Elvish'] } }, 'ancestryFeatChoices', "Traveler's Tongue short array");
  // Final languages missing a Traveler's Tongue pick: refused.
  const missingLang = await postDraft(fighterDraft({ name: 'Missing Language' }));
  await expectCommitRefusal(missingLang.json?.id,
    { fighting_style: 'Defense', languages: ['Common', 'Elvish'] }, 'languages', 'final languages missing a feat pick');
}

// ===========================================================================
// (g) Mixed human/elf cleric + forgo clearing
// ===========================================================================
group('(g) mixed ancestry + forgo');
{
  const MIXED_FINAL = { str: 14, dex: 10, con: 14, int: 8, wis: 15, cha: 14 };
  const MIXED_PREPARED = ['bless', 'cure wounds', 'guiding bolt'];
  const mixedDraft = (overrides = {}) => ({
    creator: MARKER,
    name: 'Mara Mixed', first_name: 'Mara', gender: 'Female',
    race: 'human', // display placeholder; the record derives the label
    mixed_ancestry: validMixedRecord(),
    ...ORIGIN_FR,
    class: 'cleric', theme_id: 'soldier', origin_feat: 'savage_attacker',
    theme_path_choice: 'sergeant', theme_path_data: { active_duty: 'active' },
    generation_method: 'point_buy', base_scores: DWARF_BASE, ability_scores: MIXED_FINAL,
    skills: ['Athletics', 'Intimidation', 'Religion'],
    languages: ['Common', 'Elvish'],
    prepared_spells: MIXED_PREPARED,
    known_cantrips: DWARF_CANTRIPS,
    ancestry_feat_id: MIXED_NO_CHOICE_ID,
    ...STORY,
    ...CLERIC_PACKAGE,
    ...overrides,
  });
  const created = await postDraft(mixedDraft());
  check(created.status === 201, `mixed draft POST creates 201 (got ${created.status}: ${errOf(created)})`);
  const id = created.json?.id;
  const draftRow = await readCharacter(id);
  check(draftRow?.race === 'Mixed Ancestry (Human / Elf)', `mixed draft derives the label (got ${draftRow?.race})`);
  check(draftRow?.speed === 30, `mixed draft speed is 30 (got ${draftRow?.speed})`);
  check(draftRow?.size === 'Medium', `mixed draft size is Medium (got ${draftRow?.size})`);

  const committed = await commitCharacter(id, mixedDraft());
  check(committed.status === 200, `mixed commit is 200 (got ${committed.status}: ${errOf(committed)})`);
  const row = await readCharacter(id);
  check(row?.creation_phase === 'active', 'mixed commit flips to active');
  check(row?.race === 'Mixed Ancestry (Human / Elf)', 'mixed commit keeps the label');
  check(row?.speed === 30, `mixed commit speed is 30 (got ${row?.speed})`);
  check(row?.max_hp === 10, `mixed commit HP is 10 (d8 + Con 2; got ${row?.max_hp})`);
  check(row?.armor_class === 15, `mixed commit AC is 15 (got ${row?.armor_class})`);

  // Mixed arithmetic: base + 0 species + 0 picks + theme. A wrong
  // final is refused (this is the branch Stage 4 never runs).
  const wrongFinal = await postDraft(mixedDraft({ name: 'Mixed Wrong Final' }));
  await expectCommitRefusal(wrongFinal.json?.id,
    { base_scores: DWARF_BASE, ability_scores: { str: 15, dex: 10, con: 14, int: 8, wis: 15, cha: 14 } },
    'abilityScores', 'mixed finals do not match base + theme');
  // Mixed budget over: 5 + 2 + 1 + 1 = 9 over the 7 cap.
  const overBudget = await postDraft(mixedDraft({ name: 'Mixed Over Budget' }));
  await expectCommitRefusal(overBudget.json?.id,
    { mixed_ancestry: validMixedRecord({ traits: [
      { species: 'elf', trait: 'Elven Lineage', cost: 5 },
      { species: 'human', trait: 'Resourceful', cost: 2 },
      { species: 'elf', trait: 'Fey Ancestry', cost: 1 },
      { species: 'elf', trait: 'Keen Senses', cost: 1 },
    ] }) },
    'mixedAncestry.budget', 'mixed budget over');

  // Forgo: a theme feat stored BEFORE the trade was turned on is a
  // grandfathered row — the commit clears it (not a refusal).
  const forgoDraft = await postDraft(mixedDraft({ name: 'Forgo Hero' }));
  check(forgoDraft.status === 201, `forgo draft POST creates 201 (got ${forgoDraft.status})`);
  const fid = forgoDraft.json?.id;
  const themeRowBefore = await db.dbGet("SELECT feat_key FROM character_origin_feats WHERE character_id = ? AND slot = 'theme'", [fid]);
  check(themeRowBefore?.feat_key === 'savage_attacker', `forgo draft has the theme feat row (got ${themeRowBefore?.feat_key})`);
  const putForgo = await putCharacter(fid, {
    creator: MARKER,
    mixed_ancestry: validMixedRecord({
      forgoOriginFeat: true,
      traits: [
        { species: 'elf', trait: 'Elven Lineage', cost: 5 },
        { species: 'human', trait: 'Resourceful', cost: 2 },
        { species: 'elf', trait: 'Fey Ancestry', cost: 1 },
      ],
    }),
  });
  check(putForgo.status === 200, `PUT turning the trade on is 200 (got ${putForgo.status}: ${errOf(putForgo)})`);
  const themeRowKept = await db.dbGet("SELECT feat_key FROM character_origin_feats WHERE character_id = ? AND slot = 'theme'", [fid]);
  check(themeRowKept?.feat_key === 'savage_attacker', 'PUT keeps the grandfathered theme row (commit-only clearing)');
  // Claiming the feat while the trade is on is still a refusal.
  await expectCommitRefusal(fid, { origin_feat: 'savage_attacker' }, 'originFeat', 'forgo + claiming the feat');
  // Commit without it: 200, and the row is gone.
  const { origin_feat, ...forgoCommitBody } = mixedDraft({ name: 'Forgo Hero' });
  const forgoCommit = await commitCharacter(fid, wireBody({ ...forgoCommitBody, mixed_ancestry: validMixedRecord({
    forgoOriginFeat: true,
    traits: [
      { species: 'elf', trait: 'Elven Lineage', cost: 5 },
      { species: 'human', trait: 'Resourceful', cost: 2 },
      { species: 'elf', trait: 'Fey Ancestry', cost: 1 },
    ],
  }) }));
  check(forgoCommit.status === 200, `forgo commit is 200 (got ${forgoCommit.status}: ${errOf(forgoCommit)})`);
  const themeRowAfter = await db.dbGet("SELECT feat_key FROM character_origin_feats WHERE character_id = ? AND slot = 'theme'", [fid]);
  check(!themeRowAfter, 'forgo commit deletes the theme origin-feat row');
}

// ===========================================================================
// (h) Versatile slot: Magic Initiate grant + Skilled subtraction (Stage 4)
// ===========================================================================
group('(h) versatile slot fixes');
{
  // Versatile Magic Initiate: its level-1 spell is granted, never
  // counted against prepared. A wizard listing it prepares one too
  // many; a wizard NOT listing it prepares exactly 3.
  const WIZ_BASE = { str: 8, dex: 14, con: 13, int: 15, wis: 12, cha: 10 };
  const WIZ_FINAL = { str: 10, dex: 14, con: 14, int: 15, wis: 12, cha: 10 };
  const MI_CHOICES = { spell_list: 'Wizard', spellcasting_ability: 'Intelligence', cantrips: ['Fire Bolt', 'Prestidigitation'], level1_spell: 'Magic Missile' };
  const wizardDraft = (overrides = {}) => ({
    creator: MARKER,
    name: 'Wren Versatile', first_name: 'Wren', gender: 'Female',
    race: 'human',
    size: 'Medium',
    ...ORIGIN_FR,
    class: 'wizard', theme_id: 'soldier', origin_feat: 'savage_attacker',
    theme_path_choice: 'sergeant', theme_path_data: { active_duty: 'active' },
    versatile_feat: 'magic_initiate', versatile_feat_choices: MI_CHOICES,
    generation_method: 'point_buy', base_scores: WIZ_BASE, ability_scores: WIZ_FINAL,
    skills: ['Athletics', 'Intimidation', 'Arcana', 'History'],
    languages: ['Common'],
    // Spellbook (2026-11-07): 6 L1 wizard spells, none of them the
    // granted 'magic missile' — the prepared 3 are a subset of it.
    known_spells: ['shield', 'mage armor', 'sleep', 'burning hands', 'chromatic orb', 'grease'],
    prepared_spells: ['shield', 'mage armor', 'sleep'],
    known_cantrips: ['Fire Bolt', 'Prestidigitation', 'Ray of Frost', 'Mage Hand', 'Light'],
    ancestry_feat_id: JACK_ID,
    ...STORY,
    gear_choice: 'gold',
    ...overrides,
  });
  const withMI = await postDraft(wizardDraft({ name: 'MI Listed', prepared_spells: ['magic missile', 'shield', 'mage armor', 'sleep'] }));
  check(withMI.status === 400, `versatile MI spell in prepared refuses 400 (got ${withMI.status})`);
  check(errOf(withMI).includes('preparedSpells'), `versatile MI refusal names preparedSpells (got ${errOf(withMI)})`);
  const created = await postDraft(wizardDraft());
  check(created.status === 201, `versatile MI draft POST creates 201 (got ${created.status}: ${errOf(created)})`);
  const id = created.json?.id;
  const wizardGold = computeGoldFork('wizard', 'soldier', 0).gold;
  check((await readCharacter(id))?.gold_gp === wizardGold, `wizard gold fork derives ${wizardGold}`);
  const committed = await commitCharacter(id, wizardDraft());
  check(committed.status === 200, `versatile MI commit is 200 (got ${committed.status}: ${errOf(committed)})`);
  const versRow = await db.dbGet("SELECT feat_key FROM character_origin_feats WHERE character_id = ? AND slot = 'versatile'", [id]);
  check(versRow?.feat_key === 'magic_initiate', `versatile slot persists as magic_initiate (got ${versRow?.feat_key})`);
  const knownRow = await readCharacter(id);
  check(parseCol(knownRow, 'known_cantrips').length === 5, 'versatile MI commit keeps all 5 cantrips (3 class + 2 granted)');

  // Versatile Skilled: its 3 picks are feat grants, not class picks.
  // Fighter picks 2 class skills; the list is 2 theme + 3 Skilled + 2 class.
  const FIGHTER_BASE = { str: 15, dex: 13, con: 14, int: 10, wis: 12, cha: 8 };
  const FIGHTER_FINAL = { str: 17, dex: 13, con: 15, int: 10, wis: 12, cha: 8 };
  const skilledDraft = {
    creator: MARKER,
    name: 'Skilled Versatile', first_name: 'Skye', gender: 'Female',
    race: 'human',
    size: 'Medium',
    ...ORIGIN_FR,
    class: 'fighter', theme_id: 'soldier', origin_feat: 'savage_attacker',
    theme_path_choice: 'sergeant', theme_path_data: { active_duty: 'active' },
    versatile_feat: 'skilled', versatile_feat_choices: ['Investigation', 'Medicine', 'Nature'],
    generation_method: 'point_buy', base_scores: FIGHTER_BASE, ability_scores: FIGHTER_FINAL,
    skills: ['Athletics', 'Intimidation', 'Investigation', 'Medicine', 'Nature', 'Perception', 'Survival'],
    languages: ['Common'],
    known_cantrips: [],
    ancestry_feat_id: JACK_ID,
    ...STORY,
    gear_choice: 'gold',
  };
  const skilled = await postDraft(skilledDraft);
  check(skilled.status === 201, `versatile Skilled draft POST creates 201 (got ${skilled.status}: ${errOf(skilled)})`);
  const sid = skilled.json?.id;
  const skilledCommit = await commitCharacter(sid, wireBody({ ...skilledDraft, fighting_style: 'Defense' }));
  check(skilledCommit.status === 200, `versatile Skilled commit is 200 (got ${skilledCommit.status}: ${errOf(skilledCommit)})`);
  const sRow = await readCharacter(sid);
  check(parseCol(sRow, 'skills').length === 7, 'versatile Skilled commit keeps all 7 skills');
}

// ===========================================================================
// (i) Sage cleric: Magic Initiate cantrips must be in the final list
// ===========================================================================
group('(i) sage cleric / Magic Initiate cantrips');
{
  const MI_CHOICES = { spell_list: 'Wizard', spellcasting_ability: 'Intelligence', cantrips: ['Fire Bolt', 'Prestidigitation'], level1_spell: 'Magic Missile' };
  const sageDraft = (overrides = {}) => {
    const base = clericBodyForTheme('sage', {
      name: 'Sage Cleric', origin_feat: 'magic_initiate', origin_feat_choices: MI_CHOICES,
      known_cantrips: ['Fire Bolt', 'Prestidigitation', 'Guidance', 'Sacred Flame', 'Thaumaturgy'],
      prepared_spells: ['bless', 'cure wounds', 'guiding bolt', 'shield of faith'],
    });
    return { ...base, ...overrides };
  };
  const created = await postDraft(sageDraft());
  check(created.status === 201, `sage draft POST creates 201 (got ${created.status}: ${errOf(created)})`);
  const id = created.json?.id;
  // A granted cantrip missing from the final list is refused.
  await expectCommitRefusal(id,
    { known_cantrips: ['Prestidigitation', 'Guidance', 'Sacred Flame', 'Thaumaturgy'] },
    'knownCantrips', 'granted MI cantrip missing from the final list');
  const committed = await commitCharacter(id, sageDraft());
  check(committed.status === 200, `sage commit is 200 (got ${committed.status}: ${errOf(committed)})`);
  check(parseCol(await readCharacter(id), 'known_cantrips').length === 5, 'sage commit keeps 5 cantrips (3 class + 2 granted)');

  // Incomplete MI choices (no level-1 spell) are a draft at POST
  // and a refusal at commit.
  const incomplete = await postDraft(sageDraft({
    name: 'Incomplete MI',
    origin_feat_choices: { spell_list: 'Wizard', spellcasting_ability: 'Intelligence', cantrips: ['Fire Bolt', 'Prestidigitation'] },
  }));
  check(incomplete.status === 201, `incomplete-MI draft POST creates 201 (draft — got ${incomplete.status}: ${errOf(incomplete)})`);
  await expectCommitRefusal(incomplete.json?.id, {}, 'originFeatChoices', 'MI choices incomplete at commit');
}

// ===========================================================================
// (j) High Elf wizard: species cantrip choice consumed from its list
// ===========================================================================
group('(j) high elf species cantrip choice');
{
  const MI_CHOICES = { spell_list: 'Wizard', spellcasting_ability: 'Intelligence', cantrips: ['Fire Bolt', 'Prestidigitation'], level1_spell: 'Magic Missile' };
  const ELF_BASE = { str: 8, dex: 14, con: 12, int: 15, wis: 13, cha: 10 };
  const ELF_FINAL = { str: 8, dex: 16, con: 12, int: 18, wis: 14, cha: 10 };
  const elfDraft = (overrides = {}) => ({
    creator: MARKER,
    name: 'Elwin High', first_name: 'Elwin', gender: 'Male',
    race: 'elf', subrace: 'High Elf',
    ...ORIGIN_FR,
    class: 'wizard', theme_id: 'sage', origin_feat: 'magic_initiate', origin_feat_choices: MI_CHOICES,
    generation_method: 'point_buy', base_scores: ELF_BASE, ability_scores: ELF_FINAL,
    skills: ['Arcana', 'History', 'Investigation', 'Insight'],
    languages: ['Common', 'Elvish'],
    // Spellbook (2026-11-07): the prepared 5 plus one more L1 wizard
    // spell, exactly 6 — none of them the granted 'magic missile'.
    known_spells: ['shield', 'mage armor', 'sleep', 'charm person', 'detect magic', 'burning hands'],
    prepared_spells: ['shield', 'mage armor', 'sleep', 'charm person', 'detect magic'],
    known_cantrips: ['Fire Bolt', 'Prestidigitation', 'Ray of Frost', 'Mage Hand', 'Light', 'Shocking Grasp'],
    ancestry_feat_id: ELF_NO_CHOICE_ID,
    ...STORY,
    gear_choice: 'gold',
    ...overrides,
  });
  const created = await postDraft(elfDraft());
  check(created.status === 201, `high elf draft POST creates 201 (got ${created.status}: ${errOf(created)})`);
  const id = created.json?.id;
  // The species choice (1 wizard cantrip) unfilled: 5 total, the
  // remainder is 2 against the 3 class picks.
  await expectCommitRefusal(id,
    { known_cantrips: ['Fire Bolt', 'Prestidigitation', 'Ray of Frost', 'Mage Hand', 'Light'] },
    'knownCantrips', 'species cantrip choice unfilled');
  const committed = await commitCharacter(id, elfDraft());
  check(committed.status === 200, `high elf commit is 200 (got ${committed.status}: ${errOf(committed)})`);
}

// ===========================================================================
// (k) Half-elf bard: ability-choice picks required + verified
// ===========================================================================
group('(k) half-elf ability-choice picks');
{
  const HALF_BASE = { str: 8, dex: 14, con: 13, int: 10, wis: 12, cha: 15 };
  const HALF_FINAL = { str: 10, dex: 15, con: 15, int: 10, wis: 12, cha: 17 };
  const bardDraft = (overrides = {}) => ({
    creator: MARKER,
    name: 'Lia Half', first_name: 'Lia', gender: 'Female',
    race: 'half-elf',
    ...ORIGIN_FR,
    class: 'bard', theme_id: 'soldier', origin_feat: 'savage_attacker',
    theme_path_choice: 'sergeant', theme_path_data: { active_duty: 'active' },
    generation_method: 'point_buy', base_scores: HALF_BASE, ability_scores: HALF_FINAL,
    skills: ['Athletics', 'Intimidation', 'Performance', 'Persuasion', 'Deception'],
    languages: ['Common', 'Elvish'],
    prepared_spells: ['cure wounds', 'dissonant whispers', 'healing word', 'faerie fire'],
    known_cantrips: ['Vicious Mockery', 'Prestidigitation'],
    ancestry_feat_id: HALF_ELF_NO_CHOICE_ID,
    ...STORY,
    gear_choice: 'gold',
    ...overrides,
  });
  const created = await postDraft(bardDraft());
  check(created.status === 201, `half-elf draft POST creates 201 (draft — got ${created.status}: ${errOf(created)})`);
  const id = created.json?.id;
  // Bases present but no choice picks: the arithmetic cannot run,
  // so the commit refuses naming the picks. (The commit body must carry
  // base_scores — the POST does not store them, so an empty commit body
  // cannot trigger this branch.)
  await expectCommitRefusal(id, { base_scores: HALF_BASE }, 'abilityChoicePicks', 'choice picks missing with bases present');
  const committed = await commitCharacter(id, wireBody({ ...bardDraft(), ability_choice_picks: J(['dex', 'con']) }));
  check(committed.status === 200, `half-elf commit with picks is 200 (got ${committed.status}: ${errOf(committed)})`);
  check(parseCol(await readCharacter(id), 'ability_scores').cha === 17, 'half-elf commit keeps Cha 17 (base 15 + 2)');
}

// ===========================================================================
// (l) Warlord: L1 subclass required + subclass choices registry-checked
// ===========================================================================
group('(l) warlord L1 subclass');
{
  const warlordDraft = (overrides = {}) => ({
    creator: MARKER,
    name: 'Wren Warlord', first_name: 'Wren', gender: 'Female',
    race: 'dwarf', subrace: 'Hill Dwarf',
    ...ORIGIN_FR,
    class: 'warlord', theme_id: 'soldier', origin_feat: 'savage_attacker',
    theme_path_choice: 'sergeant', theme_path_data: { active_duty: 'active' },
    generation_method: 'point_buy', base_scores: DWARF_BASE, ability_scores: DWARF_FINAL,
    skills: ['Athletics', 'Intimidation', 'History', 'Insight', 'Medicine'],
    languages: ['Common', 'Dwarvish'],
    known_cantrips: [],
    ancestry_feat_id: STOUT_HEARTED_ID,
    ...STORY,
    gear_choice: 'gold',
    ...overrides,
  });
  const noSub = await postDraft(warlordDraft({ name: 'Warlord No Subclass' }));
  check(noSub.status === 201, `warlord draft without subclass POST creates 201 (draft — got ${noSub.status}: ${errOf(noSub)})`);
  await expectCommitRefusal(noSub.json?.id, {}, 'subclassId', 'L1 class without its subclass');
  const created = await postDraft(warlordDraft({ subclass: 'commander' }));
  check(created.status === 201, `warlord draft with subclass POST creates 201 (got ${created.status}: ${errOf(created)})`);
  const id = created.json?.id;
  const warlordGold = computeGoldFork('warlord', 'soldier', 0).gold;
  check((await readCharacter(id))?.gold_gp === warlordGold, `warlord gold fork derives ${warlordGold}`);
  await expectCommitRefusal(id, { subclass_choices: { bogus_key: 'x' } }, 'subclassChoices.bogus_key', 'unknown subclass choice key');
  const committed = await commitCharacter(id, warlordDraft({ subclass: 'commander' }));
  check(committed.status === 200, `warlord commit is 200 (got ${committed.status}: ${errOf(committed)})`);
  check((await readCharacter(id))?.subclass === 'commander', 'warlord commit keeps the subclass');
}

// ===========================================================================
// (m) Outlander theme path choice required at commit
// ===========================================================================
group('(m) theme creation choice');
{
  const MI_DRUID = { spell_list: 'Druid', spellcasting_ability: 'Wisdom', cantrips: ['Druidcraft', 'Guidance'], level1_spell: 'Cure Wounds' };
  const outlanderDraft = () => {
    const base = clericBodyForTheme('outlander', {
      name: 'Outlander No Biome', origin_feat: 'magic_initiate', origin_feat_choices: MI_DRUID,
      // 'Cure Wounds' is the MI spell (granted) — it must not be
      // among the prepared picks.
      prepared_spells: ['bless', 'guiding bolt', 'shield of faith', 'sanctuary'],
      known_cantrips: ['Druidcraft', 'Guidance', 'Sacred Flame', 'Thaumaturgy', 'Light'],
    });
    return base;
  };
  const created = await postDraft(outlanderDraft());
  check(created.status === 201, `outlander draft POST creates 201 (draft — got ${created.status}: ${errOf(created)})`);
  const id = created.json?.id;
  await expectCommitRefusal(id, {}, 'themePathChoice', 'theme creation choice missing');
  const withChoice = await commitCharacter(id, wireBody({ ...outlanderDraft(), theme_path_choice: 'forest' }));
  check(withChoice.status === 200, `outlander commit with a biome is 200 (got ${withChoice.status}: ${errOf(withChoice)})`);
  const themeRow = await db.dbGet('SELECT path_choice FROM character_themes WHERE character_id = ?', [id]);
  check(themeRow?.path_choice === 'forest', `theme path choice persists (got ${themeRow?.path_choice})`);
}

// ===========================================================================
// (n) Magus: subclass cantrip choice phrase skips the exact count
// ===========================================================================
group('(n) magus subclass-pending count skip (validator unit)');
{
  // The Arcane Order grants "2 society cantrips at 1st" as a choice
  // phrase — the server cannot count it structurally, so the commit
  // validates shape + granted + pending only, never the count. A
  // magus with 4 cantrips (2 class + 2 society) must pass.
  const MAGUS_BASE = { str: 8, dex: 14, con: 12, int: 15, wis: 13, cha: 10 };
  const MAGUS_FINAL = { str: 10, dex: 14, con: 15, int: 15, wis: 14, cha: 10 };
  const merged = {
    creator: MARKER,
    name: 'Magus Test', first_name: 'Magus', gender: 'Male',
    race: 'dwarf', subrace: 'Hill Dwarf',
    origin_setting: 'Forgotten Realms', origin_region: 'Sword Coast',
    class: 'magus', subclass: 'arcane_order', theme_id: 'soldier', origin_feat: 'savage_attacker',
    theme_path_choice: 'sergeant', theme_path_data: { active_duty: 'active' },
    generation_method: 'point_buy', base_scores: MAGUS_BASE, ability_scores: MAGUS_FINAL,
    skills: ['Athletics', 'Intimidation', 'Arcana'],
    languages: ['Common', 'Dwarvish'],
    known_spells: [],
    known_cantrips: ['Fire Bolt', 'Ray of Frost', 'Mage Hand', 'Light'],
    ancestry_feat_id: STOUT_HEARTED_ID,
    alignment: 'Lawful Neutral', faith: 'Mystra', lifestyle: 'Modest',
    age: '30', height: `5'6"`, weight: '150 lb', eye_color: 'Blue',
    hair_color: 'Brown', skin_color: 'Fair', physical_build: 'Lean',
    gear_choice: 'gold',
  };
  // No gear fields resolve for a magus (no gold option, no package
  // picks here), so the unit check uses a stored-gear row for the
  // gear-evidence branch.
  const ctx = {
    row: { ability_scores: J(MAGUS_FINAL), inventory: J([{ name: 'Dagger', quantity: 1 }]), equipment: '{}', gold_gp: 0 },
    mixedAncestry: null,
  };
  // The gear fork is 'gold' for a magus — no baseline — so this
  // merged body must refuse on gearChoice only. Remove the fork to
  // isolate the cantrip branch.
  //
  // MVP gray-out (2026-11-08): the §5 class refusal now fires for
  // this magus body too, so "passes" becomes "refused ONLY on the
  // class gray-out" — the count-skip assertion is unchanged (no
  // knownCantrips error), and the single error proves nothing else
  // in the body trips the validator.
  const { gear_choice, ...noGear } = merged;
  const checkNoGear = await validateCreatorNextStage6(noGear, ctx);
  check(checkNoGear.ok === false && checkNoGear.errors.length === 1
    && checkNoGear.errors[0].includes('Class Magus is not available for player characters yet'),
    `magus 4-cantrip body refused only on the class gray-out — count skip still holds (got ${checkNoGear.errors.join('; ')})`);
  const checkGear = await validateCreatorNextStage6(merged, ctx);
  check(checkGear.ok === false && checkGear.errors.join(' ').includes('gearChoice')
    && checkGear.errors.join(' ').includes('Class Magus is not available for player characters yet'),
    `same body with a gold fork refuses on gearChoice + the class gray-out (got ${checkGear.errors.join('; ')})`);
}

// ===========================================================================
// (o) Prelude phases refuse; unknown id 404s
// ===========================================================================
group('(o) phase gate + 404');
{
  const created = await postDraft(dwarfClericDraft({ name: 'Prelude Phase Hero' }));
  const id = created.json?.id;
  await db.dbRun("UPDATE characters SET creation_phase = 'ready_for_primary' WHERE id = ?", [id]);
  const r = await commitCharacter(id, {});
  check(r.status === 400, `ready_for_primary commit refuses 400 (got ${r.status})`);
  check(errOf(r).includes('creationPhase'), `phase refusal names creationPhase (got ${errOf(r)})`);
  await db.dbRun("UPDATE characters SET creation_phase = 'creating' WHERE id = ?", [id]);
  const ok = await commitCharacter(id, dwarfClericDraft({ name: 'Prelude Phase Hero' }));
  check(ok.status === 200, 'row restored to creating commits fine');

  const missing = await commitCharacter(999999, {});
  check(missing.status === 404, `unknown id 404s (got ${missing.status})`);
}

// ===========================================================================
// (p) Endpoint contracts: cantrip mode + fighting styles
// ===========================================================================
group('(p) endpoint contracts: cantrip mode + fighting styles');
{
  // The L1 cantrip counts (coordinator spec, 2026-11-07): the test
  // asserts the REAL getCantripsKnown returns them — the table is
  // the claim, the function is the evidence.
  const CANTRIP_TABLE = { bard: 2, cleric: 3, druid: 2, sorcerer: 4, warlock: 2, wizard: 3, artificer: 2, magus: 2 };
  for (const [cls, expected] of Object.entries(CANTRIP_TABLE)) {
    check(getCantripsKnown(cls, 1) === expected, `getCantripsKnown('${cls}', 1) is ${expected} (got ${getCantripsKnown(cls, 1)})`);
    const r = await getApi(`/api/spells?class=${cls}&level=0`);
    check(r.status === 200, `GET /api/spells ${cls} level=0 is 200 (got ${r.status})`);
    check(r.json?.cantripsKnown === expected, `/api/spells ${cls} level=0 cantripsKnown is ${expected} (got ${r.json?.cantripsKnown})`);
    check(r.json?.level === 0, `/api/spells ${cls} level=0 echoes level 0 (got ${r.json?.level})`);
    const spells = r.json?.spells || [];
    // Magus without a society lists nothing (no list to offer) —
    // that case is pinned separately below; every other class with
    // a positive count lists at least that many.
    if (cls === 'magus') {
      check(spells.length === 0, `/api/spells magus level=0 without a society lists nothing (got ${spells.length})`);
    } else {
      check(spells.length >= expected, `/api/spells ${cls} level=0 lists at least ${expected} cantrips (got ${spells.length})`);
    }
    check(spells.every((s) => s.level === 0), `/api/spells ${cls} level=0 lists only cantrips`);
    // Every listed cantrip really is learnable by the class at L1
    // (the same gate the commit validator applies to each pick).
    let bad = null;
    for (const s of spells) {
      if (!canLearnSpell({ classId: cls, level: 1, spellName: s.key }).ok) { bad = s.key; break; }
    }
    check(bad === null, `/api/spells ${cls} level=0 list all pass canLearnSpell at L1${bad ? ` (bad: ${bad})` : ''}`);
  }
  // Magus without a society has no list to offer; with one, it does.
  const magusBare = await getApi('/api/spells?class=magus&level=0');
  check(magusBare.status === 200 && (magusBare.json?.spells || []).length === 0, `magus level=0 without a society lists nothing (got ${(magusBare.json?.spells || []).length})`);
  check(magusBare.json?.cantripsKnown === 2, `magus level=0 without a society still reports cantripsKnown 2 (got ${magusBare.json?.cantripsKnown})`);
  const magusSoc = await getApi('/api/spells?class=magus&level=0&subclass=arcane_order');
  check(magusSoc.status === 200 && (magusSoc.json?.spells || []).length >= 2, `magus level=0 with Arcane Order lists cantrips (got ${(magusSoc.json?.spells || []).length})`);
  // Key form and display form are the same society (regression:
  // spellSelectionService.normalizeSubclass used to keep underscores,
  // so 'arcane_order' never matched 'Arcane Order' and the list came
  // back empty — 2026-11-07).
  const magusDisplay = await getApi('/api/spells?class=magus&level=0&subclass=The%20Arcane%20Order');
  check(magusDisplay.status === 200 && JSON.stringify((magusDisplay.json?.spells || []).map((s) => s.key).sort()) === JSON.stringify((magusSoc.json?.spells || []).map((s) => s.key).sort()),
    'magus level=0 key form and display form list the same cantrips');
  // The same normalization covers the other key-form multiword
  // subclasses (direct canLearnSpell pins — the endpoint only serves
  // L1, where EK/AT/Profane Soul do not cast yet).
  check(canLearnSpell({ classId: 'fighter', level: 3, spellName: 'Fire Bolt', subclass: 'eldritch_knight' }).ok === true, "canLearnSpell accepts EK key form 'eldritch_knight'");
  check(canLearnSpell({ classId: 'fighter', level: 3, spellName: 'Fire Bolt', subclass: 'Eldritch Knight' }).ok === true, "canLearnSpell still accepts EK display form 'Eldritch Knight'");
  check(canLearnSpell({ classId: 'rogue', level: 3, spellName: 'Mage Hand', subclass: 'arcane_trickster' }).ok === true, "canLearnSpell accepts AT key form 'arcane_trickster'");
  check(canLearnSpell({ classId: 'blood_hunter', level: 3, spellName: 'Eldritch Blast', subclass: 'profane_soul' }).ok === true, "canLearnSpell accepts Profane Soul key form 'profane_soul'");
  check(canLearnSpell({ classId: 'blood_hunter', level: 3, spellName: 'Eldritch Blast', subclass: 'Order of the Profane Soul' }).ok === true, "canLearnSpell still accepts Profane Soul display form");
  check(canLearnSpell({ classId: 'warden', level: 3, spellName: 'Druidcraft', subclass: 'soulblood_shaman' }).ok === true, "canLearnSpell accepts Warden key form 'soulblood_shaman'");
  // Non-casters get an empty list with count 0.
  for (const cls of ['fighter', 'paladin', 'ranger']) {
    const r = await getApi(`/api/spells?class=${cls}&level=0`);
    check(r.status === 200 && (r.json?.spells || []).length === 0 && r.json?.cantripsKnown === 0, `${cls} level=0 lists nothing, cantripsKnown 0`);
  }
  // Leveled behavior is unchanged: level 1 still excludes cantrips.
  const wiz1 = await getApi('/api/spells?class=wizard&level=1');
  check(wiz1.status === 200 && (wiz1.json?.spells || []).every((s) => s.level >= 1), 'wizard level=1 still lists no cantrips');
  check(wiz1.json?.cantripsKnown === 3, `wizard level=1 cantripsKnown is still 3 (got ${wiz1.json?.cantripsKnown})`);
  // Bad requests still 400.
  for (const q of ['/api/spells?level=0', '/api/spells?class=nope&level=0', '/api/spells?class=wizard&level=-1', '/api/spells?class=wizard&level=21']) {
    const r = await getApi(q);
    check(r.status === 400, `GET ${q} is 400 (got ${r.status})`);
  }
  // Fighting styles: the full registry list, verbatim.
  const styles = await getApi('/api/fighting-styles');
  check(styles.status === 200, `GET /api/fighting-styles is 200 (got ${styles.status})`);
  const served = styles.json?.fightingStyles || [];
  const registry = listFightingStyleFeats();
  check(served.length === registry.length, `fighting-styles serves ${registry.length} entries (got ${served.length})`);
  const servedKeys = served.map((s) => s.key).sort();
  const registryKeys = registry.map((s) => s.key).sort();
  check(JSON.stringify(servedKeys) === JSON.stringify(registryKeys), `fighting-styles keys match listFightingStyleFeats (${servedKeys.join(',')})`);
  check(served.every((s) => typeof s.key === 'string' && typeof s.name === 'string' && typeof s.effect === 'string'), 'every fighting style has key + name + effect');
  const defense = served.find((s) => s.key === 'defense');
  check(defense?.name === 'Defense', `fighting-styles includes Defense (got ${JSON.stringify(defense)})`);
}

// ===========================================================================
// (q) Fighting-style level gate + membership (commit over HTTP)
// ===========================================================================
group('(q) fighting-style level gate + membership');
{
  const Q_BASE = { str: 15, dex: 13, con: 14, int: 10, wis: 12, cha: 8 };
  const Q_FINAL = { str: 17, dex: 13, con: 15, int: 10, wis: 12, cha: 8 };
  const abilityMod = (score) => Math.floor((score - 10) / 2);
  // Prepared lists for the two prepared martials, taken from the
  // real L1 endpoint (never invented spell picks).
  async function l1SpellNames(cls, count) {
    const r = await getApi(`/api/spells?class=${cls}&level=1`);
    assert(r.status === 200, `/api/spells ${cls} level=1 is 200 for the fixture`);
    const names = (r.json?.spells || []).map((s) => s.name);
    assert(names.length >= count, `${cls} L1 list has ${count} spells (got ${names.length})`);
    return names.slice(0, count);
  }
  const PALADIN_PREPARED = await l1SpellNames('paladin', getSpellsPrepared('paladin', 1, abilityMod(Q_FINAL.cha), null));
  const RANGER_PREPARED = await l1SpellNames('ranger', getSpellsPrepared('ranger', 1, abilityMod(Q_FINAL.wis), null));
  const MARTIAL_SKILLS = {
    fighter: ['Athletics', 'Intimidation', 'Perception', 'Survival'],
    paladin: ['Athletics', 'Intimidation', 'Insight', 'Religion'],
    ranger: ['Athletics', 'Intimidation', 'Perception', 'Survival', 'Nature'],
    duelist: ['Athletics', 'Intimidation', 'Acrobatics', 'Animal Handling', 'Persuasion'],
  };
  const martialDraft = (cls, overrides = {}) => ({
    creator: MARKER,
    name: `${cls} Martial`, first_name: 'Martial', gender: 'Female',
    race: 'human',
    size: 'Medium',
    ...ORIGIN_FR,
    class: cls, theme_id: 'soldier', origin_feat: 'savage_attacker',
    theme_path_choice: 'sergeant', theme_path_data: { active_duty: 'active' },
    generation_method: 'point_buy', base_scores: Q_BASE, ability_scores: Q_FINAL,
    skills: MARTIAL_SKILLS[cls],
    languages: ['Common', 'Elvish', 'Dwarvish'],
    known_cantrips: [],
    ...(cls === 'paladin' ? { prepared_spells: PALADIN_PREPARED } : {}),
    ...(cls === 'ranger' ? { prepared_spells: RANGER_PREPARED } : {}),
    ancestry_feat_id: TRAVELERS_TONGUE_ID,
    ancestry_feat_choices: { languages: ['Elvish', 'Dwarvish'] },
    ...STORY,
    gear_choice: 'gold',
    ...overrides,
  });

  // L1 paladin commits with NO fighting style (it gains one at L2).
  const pal = await postDraft(martialDraft('paladin', { name: 'Paladin No Style' }));
  check(pal.status === 201, `paladin draft POST creates 201 (got ${pal.status}: ${errOf(pal)})`);
  const palId = pal.json?.id;
  const palCommit = await commitCharacter(palId, martialDraft('paladin', { name: 'Paladin No Style' }));
  check(palCommit.status === 200, `L1 paladin commit without a fighting style is 200 (got ${palCommit.status}: ${errOf(palCommit)})`);
  check((await readCharacter(palId))?.creation_phase === 'active', 'L1 paladin commits to active with no style');

  // L1 ranger: same — no style yet.
  const rng = await postDraft(martialDraft('ranger', { name: 'Ranger No Style' }));
  check(rng.status === 201, `ranger draft POST creates 201 (got ${rng.status}: ${errOf(rng)})`);
  const rngId = rng.json?.id;
  const rngCommit = await commitCharacter(rngId, martialDraft('ranger', { name: 'Ranger No Style' }));
  check(rngCommit.status === 200, `L1 ranger commit without a fighting style is 200 (got ${rngCommit.status}: ${errOf(rngCommit)})`);
  check((await readCharacter(rngId))?.creation_phase === 'active', 'L1 ranger commits to active with no style');

  // L1 fighter without one still refuses (the contrast case).
  const fig = await postDraft(martialDraft('fighter', { name: 'Fighter Gate' }));
  check(fig.status === 201, `fighter draft POST creates 201 (got ${fig.status}: ${errOf(fig)})`);
  const figId = fig.json?.id;
  await expectCommitRefusal(figId, {}, 'fightingStyle', 'L1 fighter without a fighting style');
  // A bogus style name refuses naming the field.
  await expectCommitRefusal(figId, { fighting_style: 'Swordmaster' }, 'fightingStyle', 'bogus fighting style name');
  // Membership accepts the key, the display name, and the key with
  // underscores — all three spellings land on the row.
  for (const [sent, stored] of [['defense', 'defense'], ['Great Weapon Fighting', 'Great Weapon Fighting'], ['great_weapon_fighting', 'great_weapon_fighting']]) {
    const r = await commitCharacter(figId, wireBody({ ...martialDraft('fighter', { name: 'Fighter Gate' }), fighting_style: sent }));
    check(r.status === 200, `fighter commit with style '${sent}' is 200 (got ${r.status}: ${errOf(r)})`);
    check((await readCharacter(figId))?.fighting_style === stored, `style '${sent}' persists as '${stored}' (got ${(await readCharacter(figId))?.fighting_style})`);
    // A committed row re-commits (edit mode) with the stored style.
    await db.dbRun("UPDATE characters SET creation_phase = 'creating' WHERE id = ?", [figId]);
  }

  // L2 paladin: the gate turns on — no style refuses naming level 2.
  const pal2 = await postDraft(martialDraft('paladin', { name: 'Paladin L2' }));
  check(pal2.status === 201, `L2 paladin draft POST creates 201 (got ${pal2.status}: ${errOf(pal2)})`);
  const pal2Id = pal2.json?.id;
  await db.dbRun('UPDATE characters SET level = 2 WHERE id = ?', [pal2Id]);
  const pal2Refused = await commitCharacter(pal2Id, martialDraft('paladin', { name: 'Paladin L2' }));
  check(pal2Refused.status === 400, `L2 paladin without a style refuses 400 (got ${pal2Refused.status}: ${errOf(pal2Refused)})`);
  check(errOf(pal2Refused).includes('fightingStyle'), `L2 paladin refusal names fightingStyle (got ${errOf(pal2Refused)})`);
  check(errOf(pal2Refused).includes('level 2'), `L2 paladin refusal names level 2 (got ${errOf(pal2Refused)})`);
  const pal2Ok = await commitCharacter(pal2Id, wireBody({ ...martialDraft('paladin', { name: 'Paladin L2' }), fighting_style: 'Defense' }));
  check(pal2Ok.status === 200, `L2 paladin with a style commits 200 (got ${pal2Ok.status}: ${errOf(pal2Ok)})`);

  // Multiclass corner: paladin 1 / rogue 1 is total level 2 but has
  // not reached paladin 2 yet — no fighting style is due (§13 reads
  // the CLASS level from class_levels, not the row total).
  const mcPal = await postDraft(martialDraft('paladin', { name: 'Paladin Rogue MC' }));
  check(mcPal.status === 201, `multiclass paladin draft POST creates 201 (got ${mcPal.status}: ${errOf(mcPal)})`);
  const mcPalId = mcPal.json?.id;
  await db.dbRun('UPDATE characters SET level = 2, class_levels = ? WHERE id = ?', [J([{ class: 'paladin', level: 1, subclass: null }, { class: 'rogue', level: 1, subclass: null }]), mcPalId]);
  const mcPalCommit = await commitCharacter(mcPalId, martialDraft('paladin', { name: 'Paladin Rogue MC' }));
  check(mcPalCommit.status === 200, `paladin 1 / rogue 1 commit without a fighting style is 200 (got ${mcPalCommit.status}: ${errOf(mcPalCommit)})`);
  check((await readCharacter(mcPalId))?.creation_phase === 'active', 'paladin 1 / rogue 1 commits to active with no style');

  // The same row at paladin 2 DOES owe a style — the class-level
  // read, not the fallback, turns the gate on.
  await db.dbRun("UPDATE characters SET creation_phase = 'creating', class_levels = ? WHERE id = ?", [J([{ class: 'paladin', level: 2, subclass: null }]), mcPalId]);
  await expectCommitRefusal(mcPalId, {}, 'fightingStyle', 'paladin 2 (class_levels) without a fighting style');

  // Ranger 2 via class_levels: same refusal.
  const rng2 = await postDraft(martialDraft('ranger', { name: 'Ranger L2 CL' }));
  check(rng2.status === 201, `ranger L2 draft POST creates 201 (got ${rng2.status}: ${errOf(rng2)})`);
  const rng2Id = rng2.json?.id;
  await db.dbRun('UPDATE characters SET level = 2, class_levels = ? WHERE id = ?', [J([{ class: 'ranger', level: 2, subclass: null }]), rng2Id]);
  await expectCommitRefusal(rng2Id, {}, 'fightingStyle', 'ranger 2 (class_levels) without a fighting style');

  // Fighter 1 via class_levels still refuses — the class-level read
  // must not un-require the L1 fighter style.
  const figCL = await postDraft(martialDraft('fighter', { name: 'Fighter CL Gate' }));
  check(figCL.status === 201, `fighter draft POST creates 201 (got ${figCL.status}: ${errOf(figCL)})`);
  const figCLId = figCL.json?.id;
  await db.dbRun('UPDATE characters SET class_levels = ? WHERE id = ?', [J([{ class: 'fighter', level: 1, subclass: null }]), figCLId]);
  await expectCommitRefusal(figCLId, {}, 'fightingStyle', 'fighter 1 (class_levels) without a fighting style');

  // Duelist gains a style at L1 too, but has no creator picker yet:
  // unrequired by coordinator decision (2026-11-07, reversible).
  const due = await postDraft(martialDraft('duelist', { name: 'Duelist No Style' }));
  check(due.status === 201, `duelist draft POST creates 201 (got ${due.status}: ${errOf(due)})`);
  const dueId = due.json?.id;
  const dueCommit = await commitCharacter(dueId, martialDraft('duelist', { name: 'Duelist No Style' }));
  check(dueCommit.status === 200, `L1 duelist commit without a fighting style is 200 (got ${dueCommit.status}: ${errOf(dueCommit)})`);
}

// ===========================================================================
// (r) PUT allowlist: draft saves persist fighting style + subclass choices
// ===========================================================================
group('(r) PUT allowlist persists fighting style + subclass choices');
{
  const created = await postDraft(dwarfClericDraft({ name: 'PUT Allowlist Hero' }));
  check(created.status === 201, `PUT fixture POST creates 201 (got ${created.status}: ${errOf(created)})`);
  const id = created.json?.id;

  // known_cantrips was already allowlisted — pin it, don't change it.
  const cantripPut = await putCharacter(id, { creator: MARKER, known_cantrips: J(['Guidance', 'Sacred Flame', 'Thaumaturgy']) });
  check(cantripPut.status === 200, `PUT known_cantrips is 200 (got ${cantripPut.status}: ${errOf(cantripPut)})`);
  check(JSON.stringify(parseCol(await readCharacter(id), 'known_cantrips')) === JSON.stringify(['Guidance', 'Sacred Flame', 'Thaumaturgy']), 'PUT persists known_cantrips');

  // A PUT carrying ONLY a fighting style is a real update now (the
  // recon hazard: it used to 400 "No valid fields to update").
  const stylePut = await putCharacter(id, { creator: MARKER, fighting_style: 'Defense' });
  check(stylePut.status === 200, `PUT with only fighting_style is 200 (got ${stylePut.status}: ${errOf(stylePut)})`);
  check((await readCharacter(id))?.fighting_style === 'Defense', `PUT persists fighting_style (got ${(await readCharacter(id))?.fighting_style})`);
  // The camelCase spelling works too (the commit route accepts both).
  const camelPut = await putCharacter(id, { creator: MARKER, fightingStyle: 'Archery' });
  check(camelPut.status === 200, `PUT fightingStyle (camelCase) is 200 (got ${camelPut.status}: ${errOf(camelPut)})`);
  check((await readCharacter(id))?.fighting_style === 'Archery', 'PUT persists camelCase fightingStyle');
  // Empty clears (same semantics as the size choice).
  const clearPut = await putCharacter(id, { creator: MARKER, fighting_style: '' });
  check(clearPut.status === 200, `PUT fighting_style '' is 200 (got ${clearPut.status}: ${errOf(clearPut)})`);
  check((await readCharacter(id))?.fighting_style === null, 'PUT fighting_style \'\' clears the column');

  // Subclass choices: the PUT stores them raw (draft-tolerant — the
  // commit still refuses an unknown key, pinned in (l)).
  const choicesPut = await putCharacter(id, { creator: MARKER, subclass_choices: { bogus_key: 'x' } });
  check(choicesPut.status === 200, `PUT subclass_choices is 200 (got ${choicesPut.status}: ${errOf(choicesPut)})`);
  check((await readCharacter(id))?.subclass_choices_json === JSON.stringify({ bogus_key: 'x' }), `PUT persists subclass_choices_json (got ${(await readCharacter(id))?.subclass_choices_json})`);

  // End to end: a PUT-persisted style satisfies the commit gate, so
  // an empty-body commit (the refresh-resume path) passes. A real
  // fighter draft — not a flipped cleric row (its skills and spells
  // would fail Stage 4 as a fighter).
  const fighterDraft = (overrides = {}) => ({
    creator: MARKER,
    name: 'PUT Style Fighter', first_name: 'Put', gender: 'Female',
    race: 'human',
    size: 'Medium',
    ...ORIGIN_FR,
    class: 'fighter', theme_id: 'soldier', origin_feat: 'savage_attacker',
    theme_path_choice: 'sergeant', theme_path_data: { active_duty: 'active' },
    generation_method: 'point_buy',
    base_scores: { str: 15, dex: 13, con: 14, int: 10, wis: 12, cha: 8 },
    ability_scores: { str: 17, dex: 13, con: 15, int: 10, wis: 12, cha: 8 },
    skills: ['Athletics', 'Intimidation', 'Perception', 'Survival'],
    languages: ['Common', 'Elvish', 'Dwarvish'],
    known_cantrips: [],
    ancestry_feat_id: TRAVELERS_TONGUE_ID,
    ancestry_feat_choices: { languages: ['Elvish', 'Dwarvish'] },
    ...STORY,
    gear_choice: 'gold',
    ...overrides,
  });
  const fighterPost = await postDraft(fighterDraft());
  check(fighterPost.status === 201, `PUT e2e fixture POST creates 201 (got ${fighterPost.status}: ${errOf(fighterPost)})`);
  const fid = fighterPost.json?.id;
  const savePut = await putCharacter(fid, { creator: MARKER, fighting_style: 'Defense' });
  check(savePut.status === 200, `PUT stores the fighter style (got ${savePut.status}: ${errOf(savePut)})`);
  const emptyCommit = await commitCharacter(fid, {});
  check(emptyCommit.status === 200, `empty-body commit after a PUT-persisted style is 200 (got ${emptyCommit.status}: ${errOf(emptyCommit)})`);
}

// ===========================================================================
// (r2) POST persists fighting style + subclass choices (joint-run fix
// 2026-11-07: the draft POST used to drop both — the row came back
// with NULLs until the first PUT. They now ride the post-insert
// UPDATE, like the origin/size fields.)
// ===========================================================================
group('(r2) POST persists fighting style + subclass choices');
{
  const created = await postDraft(dwarfClericDraft({ name: 'POST Style Hero', fighting_style: 'Defense', subclass_choices: { bogus_key: 'x' } }));
  check(created.status === 201, `POST fixture creates 201 (got ${created.status}: ${errOf(created)})`);
  const id = created.json?.id;
  const row = await readCharacter(id);
  check(row?.fighting_style === 'Defense', `POST persists fighting_style (got ${row?.fighting_style})`);
  check(row?.subclass_choices_json === JSON.stringify({ bogus_key: 'x' }), `POST persists subclass_choices_json (got ${row?.subclass_choices_json})`);
  // CamelCase spelling, and a trimmed value with surrounding space.
  const camel = await postDraft(dwarfClericDraft({ name: 'POST Style Camel', fightingStyle: '  Archery ' }));
  check(camel.status === 201, `POST camelCase fixture creates 201 (got ${camel.status}: ${errOf(camel)})`);
  check((await readCharacter(camel.json?.id))?.fighting_style === 'Archery', 'POST persists camelCase fightingStyle, trimmed');
  // Absent sends nothing — the columns stay NULL, not '' or '{}'.
  const bare = await postDraft(dwarfClericDraft({ name: 'POST Style Bare' }));
  check(bare.status === 201, `POST bare fixture creates 201 (got ${bare.status}: ${errOf(bare)})`);
  const bareRow = await readCharacter(bare.json?.id);
  check(bareRow?.fighting_style == null && bareRow?.subclass_choices_json == null, 'POST without a style or choices leaves both columns NULL');
}

// ===========================================================================
// (s) Cantrip counts per class, via the real validator over HTTP
// ===========================================================================
group('(s) cantrip counts per class via commit');
{
  // One generic L1 caster draft per class: every number (finals,
  // prepared count, cantrip count, skill picks, spell picks) comes
  // from the real services / endpoints at runtime — the only
  // literals are the base scores.
  const CASTER_BASES = {
    bard: { str: 8, dex: 14, con: 13, int: 10, wis: 12, cha: 15 },
    cleric: DWARF_BASE,
    druid: { str: 10, dex: 14, con: 13, int: 10, wis: 15, cha: 8 },
    sorcerer: { str: 8, dex: 14, con: 13, int: 10, wis: 12, cha: 15 },
    warlock: { str: 8, dex: 14, con: 13, int: 10, wis: 12, cha: 15 },
    wizard: { str: 8, dex: 14, con: 12, int: 15, wis: 13, cha: 10 },
    artificer: { str: 10, dex: 14, con: 13, int: 15, wis: 12, cha: 8 },
  };
  const CANTRIP_TABLE = { bard: 2, cleric: 3, druid: 2, sorcerer: 4, warlock: 2, wizard: 3, artificer: 2 };
  const soldier = resolveTheme('soldier');
  const soldierAsi = soldier.ability_score_increase || {};
  const soldierSigs = [soldier.signature_skill_1, soldier.signature_skill_2];
  async function casterDraft(cls) {
    const base = CASTER_BASES[cls];
    const finals = {};
    for (const k of ['str', 'dex', 'con', 'int', 'wis', 'cha']) {
      finals[k] = base[k] + (k === 'con' ? 2 : 0) + (k === 'wis' ? 1 : 0) + (Number(soldierAsi[k]) || 0);
    }
    const ability = spellcastingAbilityFor(cls, null);
    const mod = Math.floor((finals[ability] - 10) / 2);
    const prepCount = getSpellsPrepared(cls, 1, mod, null);
    const cantripCount = getCantripsKnown(cls, 1, null);
    check(cantripCount === CANTRIP_TABLE[cls], `${cls} draft cantrip count is ${CANTRIP_TABLE[cls]} via getCantripsKnown (got ${cantripCount})`);
    const l1 = await getApi(`/api/spells?class=${cls}&level=1`);
    assert(l1.status === 200, `/api/spells ${cls} level=1 is 200 for the fixture`);
    const prepared = (l1.json?.spells || []).slice(0, prepCount).map((s) => s.name);
    assert(prepared.length === prepCount, `${cls} L1 list yields ${prepCount} prepared spells (got ${prepared.length})`);
    // Spellbook (2026-11-07): a wizard draft commits only with a
    // 6-spell book holding the prepared list. The book is the first 6
    // of the same sorted L1 list, so the prepared subset is inside it.
    const book = cls === 'wizard'
      ? (l1.json?.spells || []).slice(0, 6).map((s) => s.name)
      : null;
    if (book) assert(book.length === 6, `wizard L1 list yields a 6-spell book (got ${book.length})`);
    const c0 = await getApi(`/api/spells?class=${cls}&level=0`);
    assert(c0.status === 200, `/api/spells ${cls} level=0 is 200 for the fixture`);
    const cantrips = (c0.json?.spells || []).slice(0, cantripCount).map((s) => s.name);
    assert(cantrips.length === cantripCount, `${cls} level=0 list yields ${cantripCount} cantrips (got ${cantrips.length})`);
    const chassis = CLASS_CHASSIS[cls];
    const picks = chassis.skillOptions.filter((s) => !soldierSigs.includes(s)).slice(0, chassis.skillChoices);
    return {
      creator: MARKER,
      name: `${cls} Counter`, first_name: 'Counter', gender: 'Female',
      race: 'dwarf', subrace: 'Hill Dwarf',
      ...ORIGIN_FR,
      class: cls, theme_id: 'soldier', origin_feat: 'savage_attacker',
      theme_path_choice: 'sergeant', theme_path_data: { active_duty: 'active' },
      generation_method: 'point_buy', base_scores: base, ability_scores: finals,
      skills: [...soldierSigs, ...picks],
      languages: ['Common', 'Dwarvish'],
      prepared_spells: prepared,
      ...(book ? { known_spells: book } : {}),
      known_cantrips: cantrips,
      ancestry_feat_id: STOUT_HEARTED_ID,
      ...STORY,
      gear_choice: 'gold',
    };
  }
  for (const cls of Object.keys(CASTER_BASES)) {
    const draft = await casterDraft(cls);
    const n = CANTRIP_TABLE[cls];
    const created = await postDraft(draft);
    check(created.status === 201, `${cls} count draft POST creates 201 (got ${created.status}: ${errOf(created)})`);
    const id = created.json?.id;
    // One short refuses naming the field.
    await expectCommitRefusal(id, { known_cantrips: draft.known_cantrips.slice(0, n - 1) }, 'knownCantrips', `${cls} cantrip count short (${n - 1} of ${n})`);
    // Exactly N commits.
    const committed = await commitCharacter(id, draft);
    check(committed.status === 200, `${cls} commit with ${n} cantrips is 200 (got ${committed.status}: ${errOf(committed)})`);
    check(parseCol(await readCharacter(id), 'known_cantrips').length === n, `${cls} commit keeps ${n} cantrips`);
  }
}

// ===========================================================================
// (t) Magus / scholar: subclass name, no choices — and the count skip
// ===========================================================================
group('(t) magus / scholar subclass name without choices + count skip');
{
  // MVP gray-out (2026-11-08): magus/scholar drafts can no longer
  // POST (400), so their commit refusals are proven on a commit
  // VEHICLE — an ordinary dwarf-cleric draft that would commit
  // cleanly — committed with the deferred-class body. The body
  // wins in the merged commit body, so §5 judges the magus/scholar
  // class. Nothing is written before validation passes, so the
  // vehicle row survives all three refusals and is reused.
  const vehicleCreated = await postDraft(dwarfClericDraft({ name: 'Commit Vehicle' }));
  check(vehicleCreated.status === 201, `commit vehicle (dwarf cleric) POST creates 201 (got ${vehicleCreated.status}: ${errOf(vehicleCreated)})`);
  const vehicleId = vehicleCreated.json?.id;
  const MAGUS_BASE = { str: 8, dex: 14, con: 12, int: 15, wis: 13, cha: 10 };
  const MAGUS_FINAL = { str: 10, dex: 14, con: 15, int: 15, wis: 14, cha: 10 };
  const magusCantrips = (await getApi('/api/spells?class=magus&level=0&subclass=arcane_order')).json?.spells?.map((s) => s.name) || [];
  assert(magusCantrips.length >= 2, `magus Arcane Order list yields 2 cantrips (got ${magusCantrips.length})`);
  const magusDraft = (overrides = {}) => ({
    creator: MARKER,
    name: 'Magus No Choices', first_name: 'Magus', gender: 'Male',
    race: 'dwarf', subrace: 'Hill Dwarf',
    ...ORIGIN_FR,
    class: 'magus', subclass: 'arcane_order', theme_id: 'soldier', origin_feat: 'savage_attacker',
    theme_path_choice: 'sergeant', theme_path_data: { active_duty: 'active' },
    generation_method: 'point_buy', base_scores: MAGUS_BASE, ability_scores: MAGUS_FINAL,
    skills: ['Athletics', 'Intimidation', 'Acrobatics'],
    languages: ['Common', 'Dwarvish'],
    known_spells: [],
    known_cantrips: magusCantrips.slice(0, 2),
    ancestry_feat_id: STOUT_HEARTED_ID,
    ...STORY,
    ...overrides,
  });
  const magusCreated = await postDraft(magusDraft());
  check(magusCreated.status === 400, `magus draft POST refused 400 (MVP gray-out, got ${magusCreated.status}: ${errOf(magusCreated)})`);
  check(typeof magusCreated.json?.error === 'string' && magusCreated.json.error.includes('Class Magus is not available for player characters yet'),
    `magus draft refusal names the class (got ${errOf(magusCreated)})`);
  const magusCount = await db.dbGet('SELECT COUNT(*) AS n FROM characters WHERE name = ?', ['Magus No Choices']);
  check(magusCount?.n === 0, 'refused magus draft created no row');
  const magusCommit = await commitCharacter(vehicleId, magusDraft());
  check(magusCommit.status === 400, `magus commit refused 400 (MVP gray-out, got ${magusCommit.status}: ${errOf(magusCommit)})`);
  check(typeof magusCommit.json?.error === 'string' && magusCommit.json.error.includes('Class Magus is not available for player characters yet'),
    `magus commit refusal names the class (got ${errOf(magusCommit)})`);

  // Subclass-pending count skip, over HTTP: 5 cantrips on a magus
  // whose Arcane Order choice phrase skips the exact count.
  const magusFive = await postDraft(magusDraft({ name: 'Magus Five Cantrips' }));
  check(magusFive.status === 400, `magus five-cantrip draft POST refused 400 (MVP gray-out, got ${magusFive.status}: ${errOf(magusFive)})`);
  check(typeof magusFive.json?.error === 'string' && magusFive.json.error.includes('Class Magus is not available for player characters yet'),
    `magus five-cantrip refusal names the class (got ${errOf(magusFive)})`);
  const extraWizard = (await getApi('/api/spells?class=wizard&level=0')).json?.spells?.map((s) => s.name) || [];
  const five = [...new Set([...magusCantrips.slice(0, 2), ...extraWizard])].slice(0, 5);
  assert(five.length === 5, `five distinct cantrips assembled for the magus skip pin (got ${five.length})`);
  const fiveCommit = await commitCharacter(vehicleId, magusDraft({ name: 'Magus Five Cantrips', known_cantrips: five }));
  check(fiveCommit.status === 400, `magus with 5 cantrips commit refused 400 — class gray-out, not the count skip (got ${fiveCommit.status}: ${errOf(fiveCommit)})`);
  check(typeof fiveCommit.json?.error === 'string' && fiveCommit.json.error.includes('Class Magus is not available for player characters yet'),
    `magus five-cantrip commit refusal names the class (got ${errOf(fiveCommit)})`);

  // Scholar (Culinarian — non-casting): subclass name, no choices,
  // no cantrips at all.
  const SCHOLAR_BASE = { str: 10, dex: 14, con: 13, int: 15, wis: 12, cha: 8 };
  const SCHOLAR_FINAL = { str: 12, dex: 14, con: 16, int: 15, wis: 13, cha: 8 };
  const scholarDraft = (overrides = {}) => ({
    creator: MARKER,
    name: 'Scholar No Choices', first_name: 'Scholar', gender: 'Female',
    race: 'dwarf', subrace: 'Hill Dwarf',
    ...ORIGIN_FR,
    class: 'scholar', subclass: 'culinarian', theme_id: 'soldier', origin_feat: 'savage_attacker',
    theme_path_choice: 'sergeant', theme_path_data: { active_duty: 'active' },
    generation_method: 'point_buy', base_scores: SCHOLAR_BASE, ability_scores: SCHOLAR_FINAL,
    skills: ['Athletics', 'Intimidation', 'Animal Handling', 'Arcana', 'History'],
    languages: ['Common', 'Dwarvish'],
    known_cantrips: [],
    ancestry_feat_id: STOUT_HEARTED_ID,
    ...STORY,
    ...overrides,
  });
  const scholarCreated = await postDraft(scholarDraft());
  check(scholarCreated.status === 400, `scholar draft POST refused 400 (MVP gray-out, got ${scholarCreated.status}: ${errOf(scholarCreated)})`);
  check(typeof scholarCreated.json?.error === 'string' && scholarCreated.json.error.includes('Class Scholar is not available for player characters yet'),
    `scholar draft refusal names the class (got ${errOf(scholarCreated)})`);
  const scholarCount = await db.dbGet('SELECT COUNT(*) AS n FROM characters WHERE name = ?', ['Scholar No Choices']);
  check(scholarCount?.n === 0, 'refused scholar draft created no row');
  const scholarCommit = await commitCharacter(vehicleId, scholarDraft());
  check(scholarCommit.status === 400, `scholar commit refused 400 (MVP gray-out, got ${scholarCommit.status}: ${errOf(scholarCommit)})`);
  check(typeof scholarCommit.json?.error === 'string' && scholarCommit.json.error.includes('Class Scholar is not available for player characters yet'),
    `scholar commit refusal names the class (got ${errOf(scholarCommit)})`);

  // Mixed-ancestry count skip, over HTTP: a mixed cleric with FIVE
  // cantrips (class count 3) still commits — the count is skipped
  // for mixed characters. The non-mixed contrast refuses (below).
  const MIXED_FINAL = { str: 14, dex: 10, con: 14, int: 8, wis: 15, cha: 14 };
  const mixedFiveDraft = (overrides = {}) => ({
    creator: MARKER,
    name: 'Mixed Five Cantrips', first_name: 'Mixed', gender: 'Female',
    race: 'human',
    mixed_ancestry: validMixedRecord(),
    ...ORIGIN_FR,
    class: 'cleric', theme_id: 'soldier', origin_feat: 'savage_attacker',
    theme_path_choice: 'sergeant', theme_path_data: { active_duty: 'active' },
    generation_method: 'point_buy', base_scores: DWARF_BASE, ability_scores: MIXED_FINAL,
    skills: ['Athletics', 'Intimidation', 'Religion'],
    languages: ['Common', 'Elvish'],
    prepared_spells: ['bless', 'cure wounds', 'guiding bolt'],
    known_cantrips: ['Guidance', 'Sacred Flame', 'Thaumaturgy', 'Light', 'Mending'],
    ancestry_feat_id: MIXED_NO_CHOICE_ID,
    ...STORY,
    ...CLERIC_PACKAGE,
    ...overrides,
  });
  const mixedCreated = await postDraft(mixedFiveDraft());
  check(mixedCreated.status === 201, `mixed five-cantrip draft POST creates 201 (got ${mixedCreated.status}: ${errOf(mixedCreated)})`);
  const mixedId = mixedCreated.json?.id;
  const mixedCommit = await commitCharacter(mixedId, mixedFiveDraft());
  check(mixedCommit.status === 200, `mixed cleric with 5 cantrips commits 200 — mixed count skip (got ${mixedCommit.status}: ${errOf(mixedCommit)})`);
  // The contrast: the same 5 on a non-mixed dwarf cleric refuses.
  const plainCreated = await postDraft(dwarfClericDraft({ name: 'Plain Five Cantrips' }));
  check(plainCreated.status === 201, `plain five-cantrip draft POST creates 201 (got ${plainCreated.status}: ${errOf(plainCreated)})`);
  await expectCommitRefusal(plainCreated.json?.id,
    { known_cantrips: ['Guidance', 'Sacred Flame', 'Thaumaturgy', 'Light', 'Mending'] },
    'knownCantrips', 'non-mixed cleric with 5 cantrips refuses');
}

await new Promise((r) => server.close(r));
console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
process.exit(failed ? 1 : 0);
