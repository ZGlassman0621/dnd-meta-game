// tests/creator-test-notes-2-server.test.js — creator test-notes ROUND 2,
// server side (2026-11-09).
//
// Covers, against the real code on a real throwaway DB:
//   (a) R2-11(b)–(f) theme data: the five new creation choices in
//       server/data/themes.js + toClientShape passthrough (incl. the
//       new creation_choice_source flag and soldier's second field),
//       served over GET /api/themes;
//   (b) R2-5 mixed Versatile: the different-feats rule extended to
//       the mixed record's versatileFeat (validator unit + HTTP POST
//       + HTTP PUT + forgo guard), and the "any origin feat,
//       independent of parents/powers" answer holding server-side;
//   (c) R2-11 Review §6 + storage over HTTP commit: origin_regions
//       presence-only (a non-FR region value commits; a missing pick
//       refuses), soldier's path_data round-trip / preserve / clear;
//   (d) R2-15 languages: a human "one extra language of your choice"
//       resolves to a concrete pick and passes validation; a bogus
//       language and the literal placeholder both refuse;
//   (e) R2-6 plain language: the server error/validation strings
//       that reach the player, rewritten out of dev-marker
//       vocabulary ("registry", "server class registry", "no server
//       subclass registry entry");
//   (f) R2-13 HP: the minimum-1 floor is on the TOTAL
//       (d6 + Con −1 = 5, not 6 + 1 = 7);
//   (g) R2-4 speed: per-species walk speeds in feet (dwarf 25,
//       human 30); size never changes speed (mixed Small, speed 30);
//   (h) R2-9 warlock: patron subclass entries + subclass level 3 +
//       pact column CHECK over exactly Blade/Chain/Tome.
//
// Honest integration tests: the real validators, the real routers
// over real HTTP, the real services and the real DB. Registry
// totals are derived from the source the test loads, never
// hardcoded where the source is the authority. If any real module
// were deleted, the imports fail and the suite fails with them.
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

const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'creator-test-notes-2-server-'));
const tmpDir = repoRoot;
const origCwd = process.cwd();
process.chdir(tmpDir);
delete process.env.TURSO_DATABASE_URL;
delete process.env.TURSO_AUTH_TOKEN;
const fromRepo = (rel) => pathToFileURL(path.join(origCwd, rel)).href;

const db = await import(fromRepo('server/database.js'));
await db.initDatabase();
const characterModule = await import(fromRepo('server/routes/character.js'));
const { validateCreatorNextStage3, validateCreatorNextStage4 } = characterModule;
const { THEMES } = await import(fromRepo('server/data/themes.js'));
const { resolveTheme, toClientShape, listThemes } = await import(fromRepo('server/services/themeService.js'));
const { validateMixedAncestry, traitTableFor } = await import(fromRepo('server/services/mixedAncestryService.js'));
const { validateClassSubclass } = await import(fromRepo('server/services/classValidationService.js'));
const { walkSpeedFor } = await import(fromRepo('server/services/speciesService.js'));
const { listSubclasses } = await import(fromRepo('server/services/subclassService.js'));
const { SUBCLASS_LEVELS } = await import(fromRepo('server/config/levelProgression.js'));

const app = express();
app.use(express.json());
app.use('/api/character', characterModule.default);
const themesModule = await import(fromRepo('server/routes/themes.js'));
app.use('/api/themes', themesModule.default);
const server = await new Promise((resolve) => {
  const s = app.listen(0, '127.0.0.1', () => resolve(s));
});
const base = `http://127.0.0.1:${server.address().port}`;
async function postCharacter(body) {
  const res = await fetch(`${base}/api/character`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  let json = null;
  try { json = await res.json(); } catch {}
  return { status: res.status, json };
}
async function putCharacter(id, body) {
  const res = await fetch(`${base}/api/character/${id}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  let json = null;
  try { json = await res.json(); } catch {}
  return { status: res.status, json };
}
async function commitCharacter(id, body) {
  const res = await fetch(`${base}/api/character/${id}/commit`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  let json = null;
  try { json = await res.json(); } catch {}
  return { status: res.status, json };
}
async function getApi(pathQuery) {
  const res = await fetch(`${base}${pathQuery}`);
  let json = null;
  try { json = await res.json(); } catch {}
  return { status: res.status, json };
}
async function readCharacter(id) {
  return db.dbGet('SELECT * FROM characters WHERE id = ?', [id]);
}
function errOf(r) { return typeof r.json?.error === 'string' ? r.json.error : JSON.stringify(r.json); }

const MARKER = 'creator-next';
const J = (v) => JSON.stringify(v);
const WIRE_FIELDS = ['ability_scores', 'skills', 'languages', 'tool_proficiencies', 'known_spells', 'prepared_spells', 'known_cantrips', 'expertise'];
function wireBody(body) {
  const out = { ...body };
  for (const f of WIRE_FIELDS) {
    if (out[f] !== undefined && out[f] !== null && typeof out[f] !== 'string') out[f] = J(out[f]);
  }
  return out;
}
async function postDraft(body) { return postCharacter(wireBody(body)); }
async function expectCommitRefusal(id, body, field, label) {
  const r = await commitCharacter(id, wireBody(body));
  check(r.status === 400, `${label}: commit refuses 400 (got ${r.status}: ${errOf(r)})`);
  check(errOf(r).includes(field), `${label}: refusal names ${field} (got ${errOf(r)})`);
  return r;
}

// --- Ancestry-feat ids, resolved at runtime from the seed table ---
async function ancestryFeatId(listId, featName, tier = 1) {
  const row = await db.dbGet('SELECT id FROM ancestry_feats WHERE list_id = ? AND tier = ? AND feat_name = ?', [listId, tier, featName]);
  assert(row?.id != null, `feat ${featName} (${listId} t${tier}) resolves`);
  return row.id;
}
const STOUT_HEARTED_ID = await ancestryFeatId('dwarf', 'Stout-Hearted');

// --- Verified-good fixtures (Stage 6 commit suite pattern) ---
const DWARF_BASE = { str: 12, dex: 10, con: 13, int: 8, wis: 15, cha: 14 };
const DWARF_CANTRIPS = ['Guidance', 'Sacred Flame', 'Thaumaturgy'];
const STORY = {
  alignment: 'Lawful Good', faith: 'Moradin', lifestyle: 'Modest',
  age: '58', height: `4'3"`, weight: '180 lb', eye_color: 'Brown',
  hair_color: 'Black', skin_color: 'Tan', physical_build: 'Sturdy',
};
const ORIGIN_FR = { origin_setting: 'Forgotten Realms', origin_region: 'Sword Coast', origin_explanation: 'Born in the Sword Coast.' };
const CLERIC_PACKAGE = { gear_choice: 'packages', package_id: 'A', package_picks: J({ holy: { alternative: 0 } }) };

// Per-theme dwarf cleric: finals recomputed from the REAL theme ASI,
// skills = the theme's two signature skills + the first cleric
// option not already among them, prepared count from the resulting
// Wis mod.
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

// A complete, valid mixed record with the Human Versatile trait
// (Elf-man shape): Versatile 4 + Darkvision 1 + Fey Ancestry 1 +
// Trance 1 = 7/7, size Medium.
function mixedVersatileRecord(versatileFeat, overrides = {}) {
  return {
    parents: ['human', 'elf'],
    traits: [
      { species: 'human', trait: 'Versatile', cost: 4 },
      { species: 'elf', trait: 'Darkvision', cost: 1 },
      { species: 'elf', trait: 'Fey Ancestry', cost: 1 },
      { species: 'elf', trait: 'Trance', cost: 1 },
    ],
    size: 'Medium',
    speed: 30,
    forgoOriginFeat: false,
    versatileFeat,
    ...overrides,
  };
}

// ===========================================================================
// (a) R2-11(b)–(f) theme data + toClientShape passthrough
// ===========================================================================
group('(a) theme data — five new creation choices');
{
  check(THEMES.length === 21, `21 themes in the registry (got ${THEMES.length})`);
  const withChoice = THEMES.filter((t) => t.creation_choice_label);
  const withChoiceIds = withChoice.map((t) => t.id).sort();
  check(JSON.stringify(withChoiceIds) === JSON.stringify(['city_watch', 'folk_hero', 'guild_artisan', 'hermit', 'knight_of_the_order', 'outlander', 'soldier', 'urchin']),
    `8 themes carry a creation choice (got ${withChoiceIds.join(', ')})`);

  const soldier = resolveTheme('soldier');
  check(soldier.creation_choice_label === 'Military Rank', 'soldier label is Military Rank');
  check(JSON.stringify(soldier.creation_choice_options.map((o) => o.value)) === JSON.stringify(['private', 'corporal', 'sergeant', 'lieutenant', 'captain', 'major', 'colonel', 'general']),
    'soldier rank ladder is the 8 coordinator-decided ranks in order');
  check(soldier.creation_choice_second_field?.key === 'active_duty', 'soldier second field key is active_duty');
  check(soldier.creation_choice_second_field?.label === 'Active Duty', 'soldier second field label is Active Duty');
  check(JSON.stringify(soldier.creation_choice_second_field.options.map((o) => o.value)) === JSON.stringify(['active', 'veteran']),
    'soldier active-duty options are active / veteran');
  check(soldier.creation_choice_second_field.options.find((o) => o.value === 'active')?.label === 'Still in active duty', 'active label is the coordinator wording');
  check(soldier.creation_choice_second_field.options.find((o) => o.value === 'veteran')?.label === 'No longer in active duty', 'veteran label is the coordinator wording');

  const artisan = resolveTheme('guild_artisan');
  check(artisan.creation_choice_label === 'Guild Trade', 'guild artisan label is Guild Trade');
  check(JSON.stringify(artisan.creation_choice_options.map((o) => o.value)) === JSON.stringify(['potter', 'smith', 'mason', 'glassblower', 'tailor', 'other']),
    'guild artisan options are the 5 description-named trades + Other');

  const hermit = resolveTheme('hermit');
  check(hermit.creation_choice_label === 'Region of Seclusion', 'hermit label is Region of Seclusion');
  check(hermit.creation_choice_source === 'origin_regions', 'hermit source is origin_regions');
  check(hermit.creation_choice_options === null || hermit.creation_choice_options === undefined, 'hermit has no FR city list (regions only, from origin)');

  const folk = resolveTheme('folk_hero');
  check(folk.creation_choice_label === 'Home Region', 'folk hero label is Home Region');
  check(folk.creation_choice_source === 'origin_regions', 'folk hero source is origin_regions');
  check(folk.creation_choice_options === null || folk.creation_choice_options === undefined, 'folk hero has no FR city list (regions only, from origin)');

  const cityWatch = resolveTheme('city_watch');
  const urchin = resolveTheme('urchin');
  check(cityWatch.creation_choice_source === 'origin_regions', 'city watch source is origin_regions');
  check(urchin.creation_choice_source === 'origin_regions', 'urchin source is origin_regions');
  check(urchin.creation_choice_label === 'Home City', 'urchin label is Home City (FR default)');
  check(Array.isArray(urchin.creation_choice_options) && urchin.creation_choice_options.length === 10,
    `urchin carries the 10-city FR default list (got ${urchin.creation_choice_options?.length})`);
  check(JSON.stringify(urchin.creation_choice_options.map((o) => o.value)) === JSON.stringify(cityWatch.creation_choice_options.map((o) => o.value)),
    'urchin FR list is exactly the city watch FR list (one shared list, no drift)');
  check(cityWatch.creation_choice_options[0].value === 'Waterdeep', 'FR list starts with Waterdeep');

  // toClientShape passes the new fields through untouched.
  const soldierShape = toClientShape(soldier);
  check(soldierShape.creation_choice_second_field?.key === 'active_duty'
    && soldierShape.creation_choice_second_field.options.length === 2, 'toClientShape passes the soldier second field through');
  check(toClientShape(hermit).creation_choice_source === 'origin_regions'
    && toClientShape(hermit).creation_choice_options === null, 'toClientShape passes origin_regions + null options through');
  check(toClientShape(resolveTheme('outlander')).creation_choice_source === null
    && toClientShape(resolveTheme('outlander')).creation_choice_options.length === 9, 'outlander is unchanged (no source flag, 9 biomes)');
  check(listThemes().length === THEMES.length, 'listThemes serves all 21 themes');

  // Served over HTTP, the shape the creator actually reads.
  const all = await getApi('/api/themes');
  check(all.status === 200 && Array.isArray(all.json?.themes) && all.json.themes.length === 21,
    `GET /api/themes serves 21 themes (got ${all.json?.themes?.length})`);
  const soldierHttp = await getApi('/api/themes/soldier');
  check(soldierHttp.status === 200 && soldierHttp.json?.theme?.creation_choice_second_field?.key === 'active_duty',
    'GET /api/themes/soldier serves the second field');
  const hermitHttp = await getApi('/api/themes/hermit');
  check(hermitHttp.status === 200 && hermitHttp.json?.theme?.creation_choice_source === 'origin_regions',
    'GET /api/themes/hermit serves the origin_regions flag');
}

// ===========================================================================
// (b) R2-5 mixed Versatile — different-feats rule, extended
// ===========================================================================
group('(b) R2-5 mixed Versatile duplicate');
{
  const SOLDIER_THEME = { theme_id: 'soldier', origin_feat: 'savage_attacker' };
  // Unit: mixed pick equal to the theme feat refuses, field-named.
  const dup = validateCreatorNextStage3({ ...SOLDIER_THEME, mixed_ancestry: mixedVersatileRecord('savage_attacker') });
  check(dup.ok === false, 'mixed Versatile equal to the theme feat refuses');
  check(dup.errors.some((e) => e.startsWith('mixedAncestry.versatileFeat') && e.includes('already the theme')),
    `refusal is field-named mixedAncestry.versatileFeat (got ${dup.errors.join('; ')})`);
  // Unit: a different origin feat passes.
  const diff = validateCreatorNextStage3({ ...SOLDIER_THEME, mixed_ancestry: mixedVersatileRecord('lucky') });
  check(diff.ok === true, `mixed Versatile Lucky + soldier theme passes (got ${diff.errors.join('; ')})`);
  // Unit: resumed-PUT shape — the stored record rides ctx.
  const ctxDup = validateCreatorNextStage3({ ...SOLDIER_THEME }, { mixedAncestry: { versatileFeat: 'savage_attacker' } });
  check(ctxDup.ok === false && ctxDup.errors.some((e) => e.startsWith('mixedAncestry.versatileFeat')),
    'ctx-carried mixed Versatile equal to the theme feat refuses (resumed PUT shape)');
  const ctxDiff = validateCreatorNextStage3({ ...SOLDIER_THEME }, { mixedAncestry: { versatileFeat: 'tough' } });
  check(ctxDiff.ok === true, 'ctx-carried mixed Versatile Tough passes');
  // Unit: forgone theme feat — nothing to duplicate, no refusal.
  const forgo = validateCreatorNextStage3({
    theme_id: 'soldier',
    mixed_ancestry: mixedVersatileRecord('savage_attacker', { forgoOriginFeat: true }),
  });
  check(forgo.ok === true, `forgone theme feat + mixed Versatile Savage Attacker passes (got ${forgo.errors.join('; ')})`);
  // Unit: single-human rule still holds (regression pin).
  const single = validateCreatorNextStage3({ ...SOLDIER_THEME, versatile_feat: 'savage_attacker', race: 'human' });
  check(single.ok === false && single.errors.some((e) => e.startsWith('versatileFeat') && e.includes('already the theme')),
    'single-human Versatile equal to the theme feat still refuses');
  // Unit: eligibility is NOT filtered by parents or other powers —
  // any origin feat validates via the trait alone.
  const anyFeat = validateMixedAncestry(mixedVersatileRecord('tough'));
  check(anyFeat.ok === true, `mixed Versatile Tough validates with unrelated traits (got ${anyFeat.errors.join('; ')})`);
  const noTrait = validateMixedAncestry(mixedVersatileRecord('lucky', { traits: [{ species: 'elf', trait: 'Darkvision', cost: 1 }] }));
  check(noTrait.ok === false && noTrait.errors.some((e) => e.startsWith('mixedAncestry.versatileFeat')),
    'mixed Versatile without the trait still refuses (the trait is the only gate)');
  // HTTP POST: duplicate refused end to end; different feat creates.
  const dupPost = await postCharacter({
    creator: MARKER, name: 'Mixed Dup', race: 'human',
    ...SOLDIER_THEME, mixed_ancestry: mixedVersatileRecord('savage_attacker'),
  });
  check(dupPost.status === 400 && errOf(dupPost).includes('mixedAncestry.versatileFeat'),
    `POST mixed duplicate refuses 400 naming mixedAncestry.versatileFeat (got ${dupPost.status}: ${errOf(dupPost)})`);
  const okPost = await postCharacter({
    creator: MARKER, name: 'Mixed OK', race: 'human',
    ...SOLDIER_THEME, mixed_ancestry: mixedVersatileRecord('lucky'),
  });
  check(okPost.status === 201, `POST mixed Versatile Lucky creates 201 (got ${okPost.status}: ${errOf(okPost)})`);
  // HTTP PUT: re-picking the duplicate on an existing draft refuses.
  const putDup = await putCharacter(okPost.json?.id, {
    creator: MARKER, theme_id: 'soldier', origin_feat: 'savage_attacker',
    mixed_ancestry: mixedVersatileRecord('savage_attacker'),
  });
  check(putDup.status === 400 && errOf(putDup).includes('mixedAncestry.versatileFeat'),
    `PUT mixed duplicate refuses 400 (got ${putDup.status}: ${errOf(putDup)})`);
}

// ===========================================================================
// (c) R2-11 Review §6 + path_data storage, over HTTP commit
// ===========================================================================
group('(c) R2-11 Review §6 + soldier path_data');
{
  // City Watch, non-FR origin: a region value commits.
  const watchDraft = clericBodyForTheme('city_watch', {
    origin_feat: 'alert',
    origin_setting: 'Exandria', origin_region: 'Menagerie Coast',
    origin_explanation: 'Came through a portal from the Menagerie Coast.',
  });
  const watchCreated = await postDraft(watchDraft);
  check(watchCreated.status === 201, `city watch draft POST creates 201 (got ${watchCreated.status}: ${errOf(watchCreated)})`);
  const watchId = watchCreated.json?.id;
  await expectCommitRefusal(watchId, { ...watchDraft }, 'themePathChoice', 'city watch without a location');
  const watchCommitted = await commitCharacter(watchId, wireBody({ ...watchDraft, theme_path_choice: 'Menagerie Coast' }));
  check(watchCommitted.status === 200, `city watch commit with a non-FR region is 200 (got ${watchCommitted.status}: ${errOf(watchCommitted)})`);
  const watchRow = await db.dbGet('SELECT path_choice, path_data FROM character_themes WHERE character_id = ?', [watchId]);
  check(watchRow?.path_choice === 'Menagerie Coast', `city watch region persists (got ${watchRow?.path_choice})`);

  // Urchin, FR origin: an FR city commits.
  const urchinDraft = clericBodyForTheme('urchin', { origin_feat: 'lucky' });
  const urchinCreated = await postDraft(urchinDraft);
  check(urchinCreated.status === 201, `urchin draft POST creates 201 (got ${urchinCreated.status}: ${errOf(urchinCreated)})`);
  const urchinId = urchinCreated.json?.id;
  await expectCommitRefusal(urchinId, { ...urchinDraft }, 'themePathChoice', 'urchin without a city');
  const urchinCommitted = await commitCharacter(urchinId, wireBody({ ...urchinDraft, theme_path_choice: 'Waterdeep' }));
  check(urchinCommitted.status === 200, `urchin commit with Waterdeep is 200 (got ${urchinCommitted.status}: ${errOf(urchinCommitted)})`);

  // Folk Hero + Hermit: regions only, no FR list — a region commits,
  // a missing pick refuses.
  for (const [themeId, feat] of [['folk_hero', 'tough'], ['hermit', 'healer']]) {
    const draft = clericBodyForTheme(themeId, { origin_feat: feat });
    const created = await postDraft(draft);
    check(created.status === 201, `${themeId} draft POST creates 201 (got ${created.status}: ${errOf(created)})`);
    const id = created.json?.id;
    await expectCommitRefusal(id, { ...draft }, 'themePathChoice', `${themeId} without a region`);
    const committed = await commitCharacter(id, wireBody({ ...draft, theme_path_choice: 'Sword Coast' }));
    check(committed.status === 200, `${themeId} commit with a region is 200 (got ${committed.status}: ${errOf(committed)})`);
  }

  // Soldier: rank + active-duty second field.
  const soldierDraft = clericBodyForTheme('soldier', {
    origin_feat: 'savage_attacker', theme_path_choice: 'sergeant',
    theme_path_data: { active_duty: 'active' },
  });
  const soldierCreated = await postDraft(soldierDraft);
  check(soldierCreated.status === 201, `soldier draft POST creates 201 (got ${soldierCreated.status}: ${errOf(soldierCreated)})`);
  const soldierId = soldierCreated.json?.id;
  const storedAfterPost = await db.dbGet('SELECT path_choice, path_data FROM character_themes WHERE character_id = ?', [soldierId]);
  check(storedAfterPost?.path_choice === 'sergeant', `soldier rank persists at POST (got ${storedAfterPost?.path_choice})`);
  check(JSON.parse(storedAfterPost?.path_data || 'null')?.active_duty === 'active',
    `soldier path_data persists at POST (got ${storedAfterPost?.path_data})`);
  // Commit without re-sending path_data keeps the stored value
  // (merged from the stored row); commit without any second field
  // on a fresh draft refuses.
  const committed = await commitCharacter(soldierId, wireBody({ ...soldierDraft }));
  check(committed.status === 200, `soldier commit with rank + active duty is 200 (got ${committed.status}: ${errOf(committed)})`);
  const storedAfterCommit = await db.dbGet('SELECT path_choice, path_data FROM character_themes WHERE character_id = ?', [soldierId]);
  check(JSON.parse(storedAfterCommit?.path_data || 'null')?.active_duty === 'active',
    `soldier path_data survives commit (got ${storedAfterCommit?.path_data})`);
  const noDataDraft = clericBodyForTheme('soldier', { origin_feat: 'savage_attacker', theme_path_choice: 'private' });
  const noDataCreated = await postDraft(noDataDraft);
  check(noDataCreated.status === 201, `soldier draft without path_data POST creates 201 (got ${noDataCreated.status}: ${errOf(noDataCreated)})`);
  await expectCommitRefusal(noDataCreated.json?.id, { ...noDataDraft }, 'themePathData', 'soldier without active-duty');
  const badData = await commitCharacter(noDataCreated.json?.id, wireBody({ ...noDataDraft, theme_path_data: { active_duty: 'bogus' } }));
  check(badData.status === 400 && errOf(badData).includes('themePathData'),
    `soldier with a bogus active-duty value refuses naming themePathData (got ${badData.status}: ${errOf(badData)})`);
  const badRank = await commitCharacter(noDataCreated.json?.id, wireBody({ ...noDataDraft, theme_path_choice: 'bogus', theme_path_data: { active_duty: 'veteran' } }));
  check(badRank.status === 400 && errOf(badRank).includes('themePathChoice'),
    `soldier with a bogus rank refuses naming themePathChoice (got ${badRank.status}: ${errOf(badRank)})`);

  // path_data preserve / clear across PUTs.
  const keepPut = await putCharacter(soldierId, { creator: MARKER, theme_id: 'soldier' });
  check(keepPut.status === 200, `PUT re-saving soldier without path_data is 200 (got ${keepPut.status}: ${errOf(keepPut)})`);
  const kept = await db.dbGet('SELECT path_data FROM character_themes WHERE character_id = ?', [soldierId]);
  check(JSON.parse(kept?.path_data || 'null')?.active_duty === 'active',
    `same-theme PUT preserves path_data (got ${kept?.path_data})`);
  const changePut = await putCharacter(soldierId, { creator: MARKER, theme_id: 'acolyte', origin_feat: 'magic_initiate' });
  check(changePut.status === 200, `PUT changing theme to acolyte is 200 (got ${changePut.status}: ${errOf(changePut)})`);
  const cleared = await db.dbGet('SELECT theme_id, path_data FROM character_themes WHERE character_id = ?', [soldierId]);
  check(cleared?.theme_id === 'acolyte' && cleared?.path_data === null,
    `theme change clears the old second field (got ${cleared?.theme_id} / ${cleared?.path_data})`);
}

// ===========================================================================
// (d) R2-15 languages — a picked language passes validation
// ===========================================================================
group('(d) R2-15 languages');
{
  // Human "one extra language of your choice" resolves to Draconic.
  const human = await postCharacter(wireBody({
    creator: MARKER, name: 'Human Linguist', race: 'human',
    theme_id: 'soldier', origin_feat: 'savage_attacker',
    languages: ['Common', 'Draconic'],
  }));
  check(human.status === 201, `human + Draconic POST creates 201 (got ${human.status}: ${errOf(human)})`);
  const humanRow = await readCharacter(human.json?.id);
  const humanLangs = JSON.parse(humanRow?.languages || '[]');
  check(humanLangs.includes('Draconic') && humanLangs.includes('Common'),
    `picked language persists on the row (got ${humanRow?.languages})`);
  // A bogus language refuses, naming the field.
  const bogus = await postCharacter(wireBody({
    creator: MARKER, name: 'Human Bogus', race: 'human',
    theme_id: 'soldier', origin_feat: 'savage_attacker',
    languages: ['Common', 'Klingon'],
  }));
  check(bogus.status === 400 && errOf(bogus).includes('languages:'),
    `bogus language refuses naming languages (got ${bogus.status}: ${errOf(bogus)})`);
  // The literal placeholder is not a language and cannot satisfy the pick.
  const placeholder = await postCharacter(wireBody({
    creator: MARKER, name: 'Human Placeholder', race: 'human',
    theme_id: 'soldier', origin_feat: 'savage_attacker',
    languages: ['Common', 'One extra language of your choice'],
  }));
  check(placeholder.status === 400 && errOf(placeholder).includes('languages:'),
    `literal placeholder refuses naming languages (got ${placeholder.status}: ${errOf(placeholder)})`);
  // Half-elf carries the same choice grant; a pick passes there too.
  const halfElf = await postCharacter(wireBody({
    creator: MARKER, name: 'Half-Elf Linguist', race: 'half-elf',
    theme_id: 'soldier', origin_feat: 'savage_attacker',
    languages: ['Common', 'Elvish', 'Sylvan'],
  }));
  check(halfElf.status === 201, `half-elf + Sylvan POST creates 201 (got ${halfElf.status}: ${errOf(halfElf)})`);
  // The validator unit: the membership list is the 18 + 7 frozen
  // list, and the species-language rule excludes the placeholder.
  const v = validateCreatorNextStage4({
    race: 'human', class: 'fighter', theme_id: 'soldier',
    generation_method: 'point_buy',
    base_scores: { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 },
    ability_scores: { str: 17, dex: 14, con: 14, int: 12, wis: 10, cha: 8 },
    skills: ['Athletics', 'Intimidation', 'Perception'],
    languages: ['Common', 'Draconic'],
  }, {});
  check(v.ok === true, `Stage 4 validator accepts human + Draconic (got ${v.errors.join('; ')})`);
  const vMissing = validateCreatorNextStage4({
    race: 'human', class: 'fighter', theme_id: 'soldier',
    generation_method: 'point_buy',
    base_scores: { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 },
    ability_scores: { str: 17, dex: 14, con: 14, int: 12, wis: 10, cha: 8 },
    skills: ['Athletics', 'Intimidation', 'Perception'],
    languages: ['Draconic'],
  }, {});
  check(vMissing.ok === false && vMissing.errors.some((e) => e.startsWith('languages:') && e.includes('Common')),
    `Stage 4 validator still requires Common for a human (got ${vMissing.errors.join('; ')})`);
}

// ===========================================================================
// (e) R2-6 plain language — server strings that reach the player
// ===========================================================================
group('(e) R2-6 plain language');
{
  const unknownClass = validateClassSubclass({ classId: 'klingon' });
  check(unknownClass.ok === false && unknownClass.errors.some((e) => e.includes('is not a known class')),
    `unknown class says "not a known class" (got ${unknownClass.errors.join('; ')})`);
  check(!unknownClass.errors.join(' ').includes('registry'), 'unknown-class error never says "registry"');
  const artificer = validateClassSubclass({ classId: 'artificer', subclassId: 'alchemist' });
  check(artificer.ok === false && artificer.errors.some((e) => e.includes('has no subclass list yet')),
    `artificer subclass says "no subclass list yet" (got ${artificer.errors.join('; ')})`);
  check(!artificer.errors.join(' ').includes('registry') && !artificer.errors.join(' ').includes('listSubclasses'),
    'artificer error carries no dev identifiers');
  const unknownSub = validateClassSubclass({ classId: 'fighter', subclassId: 'nope' });
  check(unknownSub.ok === false && unknownSub.errors.some((e) => e.includes('is not a fighter subclass (known fighter subclasses:')),
    `unknown subclass names the known list in plain terms (got ${unknownSub.errors.join('; ')})`);
  check(!unknownSub.errors.join(' ').includes('registry'), 'unknown-subclass error never says "registry"');
  const goliath = traitTableFor('goliath');
  check(goliath?.unavailableReason === 'Not in the species list yet',
    `goliath reason is plain player language (got ${goliath?.unavailableReason})`);
  const goliathParent = validateMixedAncestry({
    parents: ['goliath', 'human'], size: 'Medium', speed: 30,
    traits: [{ species: 'human', trait: 'Resourceful', cost: 2 }],
  });
  check(goliathParent.ok === false && goliathParent.errors.some((e) => e.includes('is not a known species yet')),
    `goliath parent error is plain language (got ${goliathParent.errors.join('; ')})`);
  // Review race error over HTTP: no "registry" reaches the player.
  const weird = await postCharacter({ creator: MARKER, name: 'Weird Race', race: 'klingon' });
  check(weird.status === 201, `unknown-race draft POST creates 201 (got ${weird.status}: ${errOf(weird)})`);
  const refused = await commitCharacter(weird.json?.id, {});
  check(refused.status === 400 && errOf(refused).includes("race: 'klingon' is not a known species — pick a species from the list"),
    `commit race error is plain language (got ${errOf(refused)})`);
}

// ===========================================================================
// (f) R2-13 HP — the minimum-1 floor is on the TOTAL
// ===========================================================================
group('(f) R2-13 HP floor is the total');
{
  // Wizard d6 + Con 8 (−1) = 5. Under the misreading the note
  // suggests (Con modifier minimum 1) it would be 6 + 1 = 7.
  const wizard = await postCharacter(wireBody({
    creator: MARKER, name: 'HP Wizard', first_name: 'HP', gender: 'Female',
    race: 'human', class: 'wizard', theme_id: 'sage', origin_feat: 'magic_initiate',
    generation_method: 'point_buy',
    base_scores: { str: 8, dex: 14, con: 8, int: 15, wis: 13, cha: 10 },
    ability_scores: { str: 8, dex: 14, con: 8, int: 17, wis: 14, cha: 10 },
    skills: ['Arcana', 'History', 'Investigation'],
    languages: ['Common', 'Draconic'],
    known_cantrips: ['Fire Bolt', 'Mage Hand', 'Prestidigitation'],
    gear_choice: 'gold',
    ...STORY, ...ORIGIN_FR,
  }));
  check(wizard.status === 201, `wizard draft POST creates 201 (got ${wizard.status}: ${errOf(wizard)})`);
  const wizardRow = await readCharacter(wizard.json?.id);
  check(wizardRow?.max_hp === 5, `wizard HP is 5 (d6 + Con −1; got ${wizardRow?.max_hp})`);
  // Control: dwarf cleric d8 + Con +3 = 11 (Stage 6 suite pattern).
  const cleric = await postDraft(clericBodyForTheme('soldier', { origin_feat: 'savage_attacker' }));
  check(cleric.status === 201, `dwarf cleric draft POST creates 201 (got ${cleric.status}: ${errOf(cleric)})`);
  const clericRow = await readCharacter(cleric.json?.id);
  check(clericRow?.max_hp === 11, `dwarf cleric HP is 11 (d8 + Con +3; got ${clericRow?.max_hp})`);
}

// ===========================================================================
// (g) R2-4 speed — per-species feet; size never changes speed
// ===========================================================================
group('(g) R2-4 speed');
{
  check(walkSpeedFor('dwarf') === 25, `dwarf walks 25 ft (got ${walkSpeedFor('dwarf')})`);
  check(walkSpeedFor('human') === 30, `human walks 30 ft (got ${walkSpeedFor('human')})`);
  check(walkSpeedFor('gnome') === 25, `gnome walks 25 ft (got ${walkSpeedFor('gnome')})`);
  check(walkSpeedFor('elf', 'Wood Elf') === 35, `wood elf walks 35 ft (got ${walkSpeedFor('elf', 'Wood Elf')})`);
  // Same size, different speed (Medium dwarf 25 vs Medium human
  // 30); different size, same speed (Small gnome 25 = Medium
  // dwarf 25). Size never changes speed: the mixed Elf-man as
  // printed is Small at 30 ft.
  const elfMan = validateMixedAncestry({
    parents: ['human', 'elf'], size: 'Small', speed: 30,
    traits: [
      { species: 'elf', trait: 'Darkvision', cost: 1 },
      { species: 'elf', trait: 'Fey Ancestry', cost: 1 },
      { species: 'elf', trait: 'Trance', cost: 1 },
      { species: 'human', trait: 'Versatile', cost: 4 },
    ],
  });
  check(elfMan.ok === true, `Elf-man as printed validates (got ${elfMan.errors.join('; ')})`);
  check(elfMan.normalized?.size === 'Small' && elfMan.normalized?.speed === 30,
    `mixed Small keeps speed 30 (got size ${elfMan.normalized?.size}, speed ${elfMan.normalized?.speed})`);
}

// ===========================================================================
// (h) R2-9 warlock — patron is the subclass; pact is the L1 invocation
// ===========================================================================
group('(h) R2-9 warlock patrons + pact');
{
  const warlocks = listSubclasses('warlock');
  const keys = warlocks.map((s) => s.key);
  for (const patron of ['archfey_patron', 'celestial_patron', 'fiend_patron', 'great_old_one_patron']) {
    check(keys.includes(patron), `warlock subclass list has ${patron}`);
  }
  check(SUBCLASS_LEVELS.warlock === 3, `warlock chooses its subclass (patron) at level 3 (got ${SUBCLASS_LEVELS.warlock})`);
  // Pact over HTTP: Blade creates; Talisman (2014-only) refuses.
  const blade = await postCharacter({ creator: MARKER, name: 'Blade Warlock', race: 'human', class: 'warlock', pact: 'blade' });
  check(blade.status === 201, `warlock + Blade POST creates 201 (got ${blade.status}: ${errOf(blade)})`);
  const bladeRow = await readCharacter(blade.json?.id);
  check(bladeRow?.pact === 'blade', `pact persists as 'blade' (got ${bladeRow?.pact})`);
  const talisman = await postCharacter({ creator: MARKER, name: 'Talisman Warlock', race: 'human', class: 'warlock', pact: 'talisman' });
  check(talisman.status === 400 && errOf(talisman).includes("pact: 'talisman' is not a warlock pact"),
    `Talisman refuses naming the pact rule (got ${talisman.status}: ${errOf(talisman)})`);
  // DB CHECK backstop (migration 113): a direct write of a
  // fourth pact is refused by the column constraint itself.
  let checkError = null;
  try {
    await db.dbRun('UPDATE characters SET pact = ? WHERE id = ?', ['talisman', blade.json?.id]);
  } catch (e) { checkError = e; }
  check(checkError != null && /CHECK|constraint/i.test(checkError.message || ''),
    `direct talisman write is refused by the DB CHECK (got ${checkError?.message || 'no error'})`);
  const stillBlade = await readCharacter(blade.json?.id);
  check(stillBlade?.pact === 'blade', `pact is still 'blade' after the refused write (got ${stillBlade?.pact})`);
}

server.close();
console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
process.exit(failed > 0 ? 1 : 0);
