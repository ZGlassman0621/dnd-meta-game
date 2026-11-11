// tests/creator-next-stage1-mixed-ancestry.test.js — creator-next Stage 1
// client UI for Mixed Ancestry + Human Versatile + human size choice
// (2026-11-06, item 19 client UI). Real DB (throwaway file per the
// runner), real migrations incl. 108/109/110, real server validators,
// real routers on a throwaway express app, real client persistence
// functions — no mocks of the logic under test. The only stubs are
// fetch at the boundary (see groups (f) and (g)): the client code
// calls fetch with relative URLs, so the test forwards those calls to
// the local test server, or serves canned list payloads for the union
// fetch — the union/dedup logic itself is the real code.
//
// What this does NOT test: the JSX components themselves (npm test
// covers server only; the client is verified by import audit +
// esbuild + the preview shell). What it DOES test: every pure helper
// the JSX calls, the save-body shapes the JSX produces, the
// rehydration the shell runs on resume, and the full client→server
// handshake (buildStage1ProgressBody output POSTed to the real
// character route and read back from the real row).
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

const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'creator-next-stage1-ma-'));
const tmpDir = repoRoot;
const origCwd = process.cwd();
process.chdir(tmpDir);
delete process.env.TURSO_DATABASE_URL;
delete process.env.TURSO_AUTH_TOKEN;
const fromRepo = (rel) => pathToFileURL(path.join(origCwd, rel)).href;

const db = await import(fromRepo('server/database.js'));
await db.initDatabase();
const { dbAll, dbGet } = db;

// Real client code under test.
const maClient = await import(fromRepo('client/src/components/creator-next/mixedAncestry.js'));
const { validateStage1 } = await import(fromRepo('client/src/components/creator-next/stage1Validation.js'));
const persistence = await import(fromRepo('client/src/components/creator-next/stage1Persistence.js'));
const { blankStage1State, buildStage1ProgressBody, rehydrateStateFromServerRow, saveStage1Progress } = persistence;

// Real server code the client must agree with.
const maService = await import(fromRepo('server/services/mixedAncestryService.js'));
const { validateMixedAncestry, traitTablesForAllParents } = maService;
const { listSpecies, toClientShape } = await import(fromRepo('server/services/speciesService.js'));
const { SUBCLASS_LEVELS, needsSubclassSelection } = await import(fromRepo('server/config/levelProgression.js'));

// --- HTTP harness: the real routers on a real express app -------------
const app = express();
app.use(express.json());
const characterRouter = (await import(fromRepo('server/routes/character.js'))).default;
const mixedRouter = (await import(fromRepo('server/routes/mixedAncestry.js'))).default;
app.use('/api/character', characterRouter);
app.use('/api/mixed-ancestry', mixedRouter);
const server = await new Promise((resolve) => {
  const s = app.listen(0, '127.0.0.1', () => resolve(s));
});
const base = `http://127.0.0.1:${server.address().port}`;
const realFetch = globalThis.fetch;
async function getJson(url) {
  const res = await fetch(`${base}${url}`);
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

// Real tables + real species entries — the fixtures the UI reads.
const TABLES = traitTablesForAllParents();
const SPECIES = listSpecies().map(toClientShape);
const humanEntry = SPECIES.find((e) => e.id === 'human');
const elfEntry = SPECIES.find((e) => e.id === 'elf');

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

// ===========================================================================
// (a) Migrations 108/109/110 applied on the real DB
// ===========================================================================
group('(a) migrations applied');
{
  const charCols = (await dbAll('PRAGMA table_info(characters)')).map((c) => c.name);
  check(charCols.includes('mixed_ancestry_json'), 'characters has mixed_ancestry_json (108)');
  check(charCols.includes('size'), 'characters has size (110)');
  const featCols = (await dbAll('PRAGMA table_info(character_origin_feats)')).map((c) => c.name);
  check(featCols.includes('slot'), 'character_origin_feats has slot (109)');
  check(Array.isArray(TABLES) && TABLES.length === 10, `trait tables: 10 parents (got ${TABLES.length})`);
  check(!!humanEntry, 'real species list has human');
  check(Array.isArray(humanEntry?.sizes) && humanEntry.sizes.includes('Small'), 'human entry carries sizes [Medium, Small]');
  check(humanEntry?.versatile2024 === true, 'human entry carries versatile2024: true');
}

// ===========================================================================
// (b) Pure helpers — budget, downgrade, duplicates, size, speed
// ===========================================================================
group('(b) pure helpers');
{
  const b7 = maClient.mixedBudget([{ cost: 5 }, { cost: 2 }], false);
  check(b7.used === 7 && b7.cap === 7 && b7.remaining === 0 && b7.over === false, 'budget 7/7 at cap, not over');
  const b11 = maClient.mixedBudget([{ cost: 5 }, { cost: 2 }, { cost: 4 }], true);
  check(b11.used === 11 && b11.cap === 11 && b11.over === false, 'forgo trade raises cap 7 -> 11');
  const bOver = maClient.mixedBudget([{ cost: 5 }, { cost: 3 }], false);
  check(bOver.over === true && bOver.remaining === -1, '8/7 is over budget');
  check(maClient.ORIGIN_FEAT_KEYS.length === 10, 'exactly 10 origin feats');
  check(maClient.ORIGIN_FEAT_KEYS.includes('lucky') && maClient.ORIGIN_FEAT_KEYS.includes('magic_initiate'), 'origin list includes lucky + magic_initiate');
  check(maClient.isOriginFeatKey('Lucky') === true, 'origin-feat check is case-insensitive');
  check(maClient.isOriginFeatKey('fireball') === false, 'fireball is not an origin feat');

  // Darkvision downgrade: dwarf 120 ft as 60 ft costs 1.
  const dwarfTable = maClient.traitTableFor(TABLES, 'dwarf');
  const dv = maClient.findTraitInTables(TABLES, 'dwarf', 'Darkvision');
  check(dv?.darkvisionFt === 120 && dv?.cost === 2, 'dwarf Darkvision is 120 ft, cost 2');
  check(maClient.isDowngradableDarkvision(dv) === true, 'dwarf Darkvision is downgradable');
  check(maClient.effectiveTraitCost(dv, 'darkvision60') === 1, 'downgraded Darkvision costs 1');
  check(maClient.effectiveTraitCost(dv, null) === 2, 'full Darkvision costs 2');
  const elfDv = maClient.findTraitInTables(TABLES, 'elf', 'Darkvision');
  check(maClient.isDowngradableDarkvision(elfDv) === false, 'elf 60 ft Darkvision is not downgradable');

  // Size union: human/elf parents offer Medium + Small (human choice).
  const sizes = maClient.allowedSizesForParents(['human', 'elf'], SPECIES);
  check(sizes.includes('Medium') && sizes.includes('Small'), `human/elf sizes include Medium + Small (got ${sizes})`);
  const dwarfSizes = maClient.allowedSizesForParents(['dwarf', 'elf'], SPECIES);
  check(!dwarfSizes.includes('Small'), 'dwarf/elf sizes do not include Small');

  // Speed: 30 default; 35 only with the Goliath Speed trait.
  check(maClient.mixedSpeed(validMixedRecord(), TABLES) === 30, 'mixed speed defaults to 30');
  check(maClient.mixedSpeed({ ...validMixedRecord(), traits: [{ species: 'goliath', trait: 'Speed', cost: 1 }] }, TABLES) === 35, 'Goliath Speed trait derives speed 35');

  // Versatile-theme conflict (coordinator ruling).
  check(maClient.versatileThemeConflict('lucky', 'lucky')?.includes('versatileFeat'), 'equal versatile + theme feat conflicts');
  check(maClient.versatileThemeConflict('Lucky', 'lucky') !== null, 'conflict check is case-insensitive');
  check(maClient.versatileThemeConflict('lucky', 'tough') === null, 'different feats do not conflict');
  check(maClient.versatileThemeConflict('', 'lucky') === null, 'no versatile pick, no conflict');
  check(maClient.versatileThemeConflict('lucky', '') === null, 'no theme yet, no conflict');

  // Server error strings split into per-field pairs.
  const parsed = maClient.parseServerValidationErrors('mixedAncestry.budget: traits cost 8 power budget, over the 7 limit; versatileFeat: foo is not a 2024 origin feat');
  check(parsed.length === 2 && parsed[0].field === 'mixedAncestry.budget' && parsed[1].field === 'versatileFeat', 'server 400 string parses into field pairs');
  check(maClient.parseServerValidationErrors('').length === 0, 'empty error string parses to []');
}

// ===========================================================================
// (c) Client validation mirrors the server validator
// ===========================================================================
group('(c) client validation');
{
  const errs = (rec) => maClient.validateMixedAncestryClient(rec, TABLES, SPECIES);
  check(errs(null).length === 0, 'absent record is a draft, not an error');
  check(errs({ parents: [], traits: [], size: '', speed: 30, forgoOriginFeat: false, versatileFeat: '' }).length === 0, 'blank record is a draft, not an error');
  check(errs(validMixedRecord()).length === 0, 'valid 7/7 record passes client validation');
  check(errs(validMixedRecord({ parents: ['human'] })).some((e) => e.startsWith('mixedAncestry.parents')), 'one parent is refused');
  check(errs(validMixedRecord({ parents: ['human', 'human'] })).some((e) => e.includes('picked twice')), 'same parent twice is refused');
  check(errs(validMixedRecord({ parents: ['human', 'orc'] })).some((e) => e.startsWith('mixedAncestry.parents')), 'deferred orc parent is refused');
  check(errs(validMixedRecord({ parents: ['human', 'goliath'] })).some((e) => e.startsWith('mixedAncestry.parents')), 'goliath parent (not in registry) is refused');
  // Duplicate trait name across parents: Darkvision from elf + dwarf.
  const dup = validMixedRecord({
    parents: ['elf', 'dwarf'],
    traits: [
      { species: 'elf', trait: 'Darkvision', cost: 1 },
      { species: 'dwarf', trait: 'Darkvision', cost: 2 },
    ],
  });
  check(errs(dup).some((e) => e.includes('picked twice')), 'Darkvision from both parents is a duplicate');
  // Over budget.
  const over = validMixedRecord({
    traits: [
      { species: 'elf', trait: 'Elven Lineage', cost: 5 },
      { species: 'human', trait: 'Resourceful', cost: 2 },
      { species: 'elf', trait: 'Fey Ancestry', cost: 1 },
    ],
  });
  check(errs(over).some((e) => e.startsWith('mixedAncestry.budget')), '8/7 is refused on budget');
  // Forgo trade covers the same traits.
  check(errs({ ...over, forgoOriginFeat: true }).length === 0, '8/11 under the forgo trade passes');
  // Wrong cost.
  const wrongCost = validMixedRecord({ traits: [{ species: 'elf', trait: 'Elven Lineage', cost: 4 }] });
  check(errs(wrongCost).some((e) => e.includes('costs 5')), 'wrong trait cost is refused with the table cost');
  // Downgraded Darkvision at cost 1 passes.
  const down = validMixedRecord({
    parents: ['dwarf', 'elf'],
    traits: [{ species: 'dwarf', trait: 'Darkvision', cost: 1, form: 'darkvision60' }],
  });
  check(errs(down).length === 0, 'downgraded 120 ft Darkvision at cost 1 passes');
  // Downgrade on a 60 ft Darkvision is refused.
  const badDown = validMixedRecord({
    traits: [{ species: 'elf', trait: 'Darkvision', cost: 1, form: 'darkvision60' }],
  });
  check(errs(badDown).some((e) => e.includes('already 60 ft')), 'downgrade on 60 ft Darkvision is refused');
  // Trait from a non-parent.
  const outsider = validMixedRecord({ traits: [{ species: 'dwarf', trait: 'Stonecunning', cost: 1 }] });
  check(errs(outsider).some((e) => e.includes('not one of the parents')), 'trait from a non-parent is refused');
  // Size outside the parents.
  check(errs(validMixedRecord({ parents: ['dwarf', 'elf'], size: 'Small' })).some((e) => e.startsWith('mixedAncestry.size')), 'Small is not a dwarf/elf size');
  // Mixed Versatile pick without the trait / with a non-origin feat.
  const noTrait = validMixedRecord({ versatileFeat: 'lucky' });
  check(errs(noTrait).some((e) => e.startsWith('mixedAncestry.versatileFeat')), 'versatile pick without the trait is refused');
  const withTrait = validMixedRecord({
    traits: [
      { species: 'human', trait: 'Versatile', cost: 4 },
      { species: 'elf', trait: 'Keen Senses', cost: 1 },
      { species: 'elf', trait: 'Trance', cost: 1 },
    ],
    versatileFeat: 'lucky',
  });
  check(errs(withTrait).length === 0, 'Versatile trait + origin-feat pick passes (6/7)');
  check(errs({ ...withTrait, versatileFeat: 'fireball' }).some((e) => e.startsWith('mixedAncestry.versatileFeat')), 'non-origin versatile pick is refused');

  // The client validator and the REAL server validator agree on the
  // valid record and on the over-budget record.
  const serverOk = validateMixedAncestry(validMixedRecord());
  check(serverOk.ok === true && serverOk.budgetUsed === 7 && serverOk.budgetCap === 7, 'real server validator accepts the valid record (7/7)');
  const serverOver = validateMixedAncestry(over);
  check(serverOver.ok === false && serverOver.errors.some((e) => e.startsWith('mixedAncestry.budget')), 'real server validator refuses the over-budget record');
}

// ===========================================================================
// (d) Tables + ancestry-lists endpoints (real router, real HTTP)
// ===========================================================================
group('(d) mixed-ancestry endpoints');
{
  const tablesRes = await getJson('/api/mixed-ancestry');
  check(tablesRes.status === 200, 'GET /api/mixed-ancestry is 200');
  check(tablesRes.json?.baseBudget === 7, 'tables baseBudget is 7');
  check(tablesRes.json?.forgoOriginFeatBonus === 4, 'tables forgo bonus is 4');
  check(tablesRes.json?.defaultSpeed === 30, 'tables defaultSpeed is 30');
  check(Array.isArray(tablesRes.json?.tables) && tablesRes.json.tables.length === 10, 'tables endpoint serves 10 tables');
  const goliath = tablesRes.json.tables.find((t) => t.speciesId === 'goliath');
  check(goliath?.available === false && !!goliath?.unavailableReason, 'goliath table is unavailable with a reason');
  const orc = tablesRes.json.tables.find((t) => t.speciesId === 'orc');
  check(orc?.available === false && !!orc?.unavailableReason, 'orc table is unavailable with a reason');
  const human = tablesRes.json.tables.find((t) => t.speciesId === 'human');
  check(human?.available === true && human.traits.some((t) => t.name === 'Versatile' && t.cost === 4), 'human table is available with Versatile cost 4');

  const listsRes = await getJson('/api/mixed-ancestry/ancestry-lists?parents=human,elf');
  check(listsRes.status === 200, 'ancestry-lists is 200');
  check(listsRes.json?.lists?.includes('human') && listsRes.json?.lists?.includes('elf'), 'human,elf lists include both parents');
  const aasimarRes = await getJson('/api/mixed-ancestry/ancestry-lists?parents=aasimar,elf');
  check(aasimarRes.json?.lists?.includes('aasimar_protector') && aasimarRes.json?.lists?.includes('aasimar_scourge') && aasimarRes.json?.lists?.includes('aasimar_fallen'), 'aasimar parent yields all three aasimar lists');
}

// ===========================================================================
// (e) Save-body shapes (the contract the JSX produces)
// ===========================================================================
group('(e) save-body shapes');
{
  const blank = blankStage1State();
  check(blank.mixedAncestry === null && blank.size === '' && blank.versatileFeat === '' && blank.versatileFeatChoices && typeof blank.versatileFeatChoices === 'object', 'blank state carries the new keys (null/empty, never defaulted)');
  check(Object.keys(buildStage1ProgressBody(blank)).length === 0, 'a blank state still builds an empty body');

  // Human + Small + Versatile pick.
  const humanState = { ...blank, first_name: 'Test', race: 'human', size: 'Small', versatileFeat: 'lucky' };
  const humanBody = buildStage1ProgressBody(humanState);
  check(humanBody.race === 'human' && humanBody.size === 'Small', 'human body sends race + size');
  check(humanBody.versatile_feat === 'lucky', 'human body sends versatile_feat');
  check(!('mixed_ancestry' in humanBody), 'human body sends no mixed_ancestry');

  // Versatile subchoices ride along.
  const miState = { ...humanState, versatileFeat: 'magic_initiate', versatileFeatChoices: { spell_list: 'wizard', spellcasting_ability: 'Intelligence', cantrips: ['Fire Bolt', 'Mage Hand'], level1_spell: 'Magic Missile' } };
  check(buildStage1ProgressBody(miState).versatile_feat_choices?.spell_list === 'wizard', 'versatile MI subchoices ride the body');

  // Complete mixed record: placeholder race + record, no body size.
  const mixedState = { ...blank, first_name: 'Test', mixedAncestry: validMixedRecord() };
  const mixedBody = buildStage1ProgressBody(mixedState);
  check(mixedBody.race === 'human', 'mixed body sends the human display placeholder race');
  check(mixedBody.mixed_ancestry?.parents?.join(',') === 'human,elf', 'mixed body sends the record parents');
  check(mixedBody.mixed_ancestry?.traits?.length === 2, 'mixed body sends the traits');
  check(!('size' in mixedBody), 'mixed body sends no body-level size (the record owns size)');
  check(!('versatile_feat' in mixedBody), 'mixed body sends no standalone versatile_feat');
  check(!('mixed_ancestry_json' in mixedBody), 'mixed body NEVER sends mixed_ancestry_json');

  // Incomplete mixed record stays local-only (never half-sent).
  const halfState = { ...blank, first_name: 'Test', mixedAncestry: validMixedRecord({ parents: ['human'] }) };
  const halfBody = buildStage1ProgressBody(halfState);
  check(!('mixed_ancestry' in halfBody) && !('race' in halfBody), 'incomplete mixed record is omitted from the save body');
  // Over-budget mixed record stays local-only too.
  const overState = { ...blank, mixedAncestry: validMixedRecord({ traits: [{ species: 'elf', trait: 'Elven Lineage', cost: 5 }, { species: 'human', trait: 'Resourceful', cost: 2 }, { species: 'elf', trait: 'Fey Ancestry', cost: 1 }] }) };
  check(!('mixed_ancestry' in buildStage1ProgressBody(overState)), 'over-budget mixed record is omitted from the save body');

  // Forgo trade: the theme origin feat does NOT ride the body (the
  // server refuses the grant while the trade is on); the theme does.
  const forgoState = {
    ...blank, first_name: 'Test', themeId: 'soldier', originFeat: 'savage_attacker',
    mixedAncestry: validMixedRecord({ forgoOriginFeat: true }),
  };
  const forgoBody = buildStage1ProgressBody(forgoState);
  check(forgoBody.theme_id === 'soldier', 'forgo body still sends the theme');
  check(!('origin_feat' in forgoBody), 'forgo body omits the theme origin feat');
  // Trade off: the feat rides again.
  const noForgoBody = buildStage1ProgressBody({ ...forgoState, mixedAncestry: validMixedRecord({ forgoOriginFeat: false }) });
  check(noForgoBody.origin_feat === 'savage_attacker', 'trade off: the theme origin feat rides again');

  // The client save shape passes the REAL server validator.
  const serverCheck = validateMixedAncestry(mixedBody.mixed_ancestry);
  check(serverCheck.ok === true && serverCheck.normalized?.budgetUsed === 7, 'client mixed save shape passes the real server validator');
}

// ===========================================================================
// (f) Stage 1 validation — mixed / versatile / size gates
// ===========================================================================
group('(f) stage 1 validation gates');
{
  const v = (state, opts = {}) => validateStage1(state, { featListAvailable: false, mixedTables: TABLES, speciesEntries: SPECIES, speciesEntry: null, ...opts });
  const base = { ...blankStage1State(), first_name: 'Test', gender: 'Female', origin_setting: 'Forgotten Realms', origin_region: 'Sword Coast' };
  check(v({ ...base, race: 'human' }).blocking.length === 0, 'plain human passes Stage 1 validation');
  check(v({ ...base, race: 'human' }).needed.length === 0, 'plain human has nothing needed (feat list unavailable in this call)');
  // Mixed incomplete blocks; mixed valid does not.
  const mixedBad = v({ ...base, mixedAncestry: validMixedRecord({ parents: ['human'] }) });
  check(mixedBad.blocking.some((m) => m.startsWith('mixedAncestry.parents')), 'incomplete mixed record blocks advancing');
  check(mixedBad.needed.includes('Species') === false, 'mixed character is not listed as needing a Species');
  const mixedGood = v({ ...base, mixedAncestry: validMixedRecord() });
  check(mixedGood.blocking.length === 0, 'valid mixed record does not block');
  // Versatile equal to the theme feat blocks (theme known).
  const conflict = v({ ...base, race: 'human', versatileFeat: 'lucky', originFeat: 'lucky' }, { speciesEntry: humanEntry });
  check(conflict.blocking.some((m) => m.startsWith('versatileFeat')), 'versatile == theme feat blocks');
  // Versatile different from the theme feat does not block.
  check(v({ ...base, race: 'human', versatileFeat: 'lucky', originFeat: 'tough' }, { speciesEntry: humanEntry }).blocking.length === 0, 'versatile != theme feat does not block');
  // Versatile on a non-human blocks; on a mixed character blocks.
  check(v({ ...base, race: 'elf', versatileFeat: 'lucky' }, { speciesEntry: elfEntry }).blocking.some((m) => m.startsWith('versatileFeat')), 'versatile on an elf blocks');
  check(v({ ...base, mixedAncestry: validMixedRecord(), versatileFeat: 'lucky' }).blocking.some((m) => m.startsWith('versatileFeat')), 'standalone versatile on a mixed character blocks');
  // Invalid size blocks.
  check(v({ ...base, race: 'human', size: 'Large' }, { speciesEntry: humanEntry }).blocking.some((m) => m.startsWith('size:')), 'Large size for a human blocks');
  check(v({ ...base, race: 'human', size: 'Small' }, { speciesEntry: humanEntry }).blocking.length === 0, 'Small size for a human does not block');
}

// ===========================================================================
// (g) Rehydration — resume reads the stored record back
// ===========================================================================
group('(g) rehydration');
{
  const row = {
    first_name: 'Test', race: 'Mixed Ancestry (Human / Elf)', size: 'Medium',
    mixed_ancestry_json: JSON.stringify({
      parents: ['human', 'elf'], size: 'Medium', speed: 30,
      traits: [{ species: 'elf', trait: 'Elven Lineage', cost: 5 }],
      budgetUsed: 5, budgetCap: 7, forgoOriginFeat: false, versatileFeat: null,
    }),
  };
  const patch = rehydrateStateFromServerRow(row, { versatile_feat: { feat_key: 'lucky', choices_data: null } });
  check(patch.mixedAncestry?.parents?.join(',') === 'human,elf', 'mixed record rehydrates parents');
  check(patch.mixedAncestry?.traits?.length === 1, 'mixed record rehydrates traits');
  check(patch.size === 'Medium', 'stored size rehydrates');
  check(!('race' in patch), 'mixed row race label is NOT normalized into state.race');
  check(patch.versatileFeat === 'lucky', 'progression versatile_feat rehydrates');
  const plainRow = { first_name: 'Test', race: 'human', size: 'Small' };
  const plainPatch = rehydrateStateFromServerRow(plainRow, null);
  check(plainPatch.race === 'human' && plainPatch.size === 'Small', 'plain human row rehydrates race + size');
}

// ===========================================================================
// (h) Client -> server handshake over real HTTP (fetch forwarded to the
//     local test server at the boundary; the bodies are the real
//     buildStage1ProgressBody output)
// ===========================================================================
group('(h) client-server handshake');
{
  globalThis.fetch = (url, opts) => {
    if (typeof url === 'string' && url.startsWith('/api/')) return realFetch(base + url, opts);
    return realFetch(url, opts);
  };
  try {
    // Mixed human/elf 7/7 POST.
    const mixedState = { ...blankStage1State(), first_name: 'Mara', last_name: 'Mixed', gender: 'Female', origin_setting: 'Forgotten Realms', origin_region: 'Sword Coast', mixedAncestry: validMixedRecord() };
    const mixedRes = await saveStage1Progress({ state: mixedState, characterId: null });
    check(typeof mixedRes.character_id === 'number', 'mixed POST returns a character id');
    const mixedRow = await dbGet('SELECT race, speed, mixed_ancestry_json FROM characters WHERE id = ?', [mixedRes.character_id]);
    check(mixedRow?.race === 'Mixed Ancestry (Human / Elf)', `mixed row race is the derived label (got ${mixedRow?.race})`);
    check(mixedRow?.speed === 30, 'mixed row speed is 30');
    const stored = JSON.parse(mixedRow.mixed_ancestry_json);
    check(stored?.budgetUsed === 7 && stored?.budgetCap === 7, 'stored mixed record is 7/7');

    // PUT mixed_ancestry: null clears the record.
    const cleared = await putCharacter(mixedRes.character_id, { mixed_ancestry: null, creator: 'creator-next' });
    check(cleared.status === 200, `PUT mixed_ancestry null is 200 (got ${cleared.status})`);
    const clearedRow = await dbGet('SELECT mixed_ancestry_json FROM characters WHERE id = ?', [mixedRes.character_id]);
    check(clearedRow?.mixed_ancestry_json == null, 'mixed record clears on PUT null');

    // Human Small + Versatile Lucky POST.
    const humanState = { ...blankStage1State(), first_name: 'Hana', gender: 'Female', origin_setting: 'Forgotten Realms', origin_region: 'Sword Coast', race: 'human', size: 'Small', versatileFeat: 'lucky' };
    const humanRes = await saveStage1Progress({ state: humanState, characterId: null });
    check(typeof humanRes.character_id === 'number', 'human versatile POST returns a character id');
    const humanRow = await dbGet('SELECT size FROM characters WHERE id = ?', [humanRes.character_id]);
    check(humanRow?.size === 'Small', 'human row stores size Small');
    const vRow = await dbGet("SELECT feat_key FROM character_origin_feats WHERE character_id = ? AND slot = 'versatile'", [humanRes.character_id]);
    check(vRow?.feat_key === 'lucky', 'versatile slot persists as lucky');

    // Forgo trade + theme POST: theme saves, origin feat is forgone.
    const forgoState = {
      ...blankStage1State(), first_name: 'Forgo', gender: 'Female', origin_setting: 'Forgotten Realms', origin_region: 'Sword Coast',
      themeId: 'soldier', originFeat: 'savage_attacker',
      mixedAncestry: validMixedRecord({ forgoOriginFeat: true }),
    };
    const forgoRes = await saveStage1Progress({ state: forgoState, characterId: null });
    check(typeof forgoRes.character_id === 'number', 'forgo + theme POST succeeds (feat omitted, not 400)');
    const themeRow = await dbGet('SELECT theme_id FROM character_themes WHERE character_id = ?', [forgoRes.character_id]);
    check(themeRow?.theme_id === 'soldier', 'forgo character keeps the soldier theme');
    const themeFeatRow = await dbGet("SELECT feat_key FROM character_origin_feats WHERE character_id = ? AND slot = 'theme'", [forgoRes.character_id]);
    check(!themeFeatRow, 'forgo character has no theme origin-feat row');

    // Versatile == theme feat POST: the server 400s, field versatileFeat.
    const conflictState = {
      ...blankStage1State(), first_name: 'Clash', gender: 'Female', origin_setting: 'Forgotten Realms', origin_region: 'Sword Coast',
      race: 'human', versatileFeat: 'lucky', themeId: 'far_traveler', originFeat: 'lucky',
    };
    let threw = null;
    try { await saveStage1Progress({ state: conflictState, characterId: null }); } catch (e) { threw = e; }
    check(threw && String(threw.message).includes('versatileFeat'), `equal versatile + theme feat POST fails naming versatileFeat (got ${threw?.message || 'no error'})`);
  } finally {
    globalThis.fetch = realFetch;
  }
}

// ===========================================================================
// (i) Ancestry-feat union fetch (fetch stubbed at the boundary; the
//     union + dedup is the real fetchMixedAncestryFeatUnion)
// ===========================================================================
group('(i) mixed ancestry-feat union');
{
  const seenUrls = [];
  globalThis.fetch = async (url) => {
    seenUrls.push(String(url));
    const u = String(url);
    const okJson = (data) => ({ ok: true, json: async () => data });
    if (u.includes('/api/mixed-ancestry/ancestry-lists')) {
      const m = u.match(/parents=([^&]*)/);
      const ps = m ? decodeURIComponent(m[1]).split(',').filter(Boolean) : [];
      return okJson({ parents: ps, lists: ps });
    }
    if (u.includes('/ancestry-feats/human')) return okJson([{ id: 'h1', feat_name: 'Human Gift' }, { id: 'shared', feat_name: 'Shared Gift' }]);
    if (u.includes('/ancestry-feats/elf')) return okJson([{ id: 'e1', feat_name: 'Elf Gift' }, { id: 'shared', feat_name: 'Shared Gift' }]);
    return { ok: false, json: async () => ({}) };
  };
  try {
    const union = await maClient.fetchMixedAncestryFeatUnion(['human', 'elf']);
    check(union.length === 3, `union has 3 feats (got ${union.length})`);
    check(union.filter((f) => f.id === 'shared').length === 1, 'a feat on both lists appears once');
    check(seenUrls.some((u) => u.includes('ancestry-lists?parents=human,elf')), 'union fetch hits the lists endpoint with both parents');
    check(seenUrls.some((u) => u.includes('/ancestry-feats/human?tier=1')) && seenUrls.some((u) => u.includes('/ancestry-feats/elf?tier=1')), 'union fetch hits EACH list at tier 1');
    // The helper fetches whatever lists the endpoint returns (the
    // two-parent gate lives in the component, not here): one parent
    // yields that parent's list only.
    const single = await maClient.fetchMixedAncestryFeatUnion(['human']);
    check(single.length === 2, `one parent yields that parent's 2 feats (got ${single.length})`);
  } finally {
    globalThis.fetch = realFetch;
  }
}

// ===========================================================================
// (j) Blood Hunter picker check — Stage 2 gate + level-up prompt
//     (behavior is covered by tests/levelup-subclass-prompts.test.js;
//     this pins the two facts the gate depends on, so a drift fails
//     here instead of silently offering a 1st-level Order picker)
// ===========================================================================
group('(j) blood hunter picker check');
{
  const classes = JSON.parse(fs.readFileSync(path.join(origCwd, 'client/src/data/classes.json'), 'utf8'));
  check(classes.blood_hunter?.subclassLevel === 3, 'classes.json: blood_hunter subclassLevel is 3');
  check(SUBCLASS_LEVELS.blood_hunter === 3, 'SUBCLASS_LEVELS: blood_hunter is 3');
  check(needsSubclassSelection('blood_hunter', 3) === true, 'level-up prompts for the Order at 3rd level');
  check(needsSubclassSelection('blood_hunter', 2) === false, 'level-up does not prompt for the Order at 2nd level');
  check(needsSubclassSelection('blood_hunter', 1) === false, 'level-up does not prompt for the Order at 1st level');
  const stage2 = fs.readFileSync(path.join(origCwd, 'client/src/components/creator-next/Stage2ClassCalling.jsx'), 'utf8');
  check(stage2.includes('showSubclassPicker = subclassLevel === 1'), 'Stage 2 picker gate is subclassLevel === 1 only');
  check(classes.magus?.subclassLevel === 1 && classes.scholar?.subclassLevel === 1, 'magus/scholar still pick at 1st (gate unchanged)');
}

server.close();
console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
process.exit(failed ? 1 : 0);
