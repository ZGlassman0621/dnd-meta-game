// tests/human-2024.test.js — 2024 human species entry (2026-11-06).
//
// Source: the 2024 PHB, p. 194 (Human Traits), Zach-provided photo
// (~/workspace/user/files/80D18EAB-...-photo-4F285613-...jpg, read
// 2026-11-06): Creature Type Humanoid; Size Medium (about 4–7 feet
// tall) or Small (about 2–4 feet tall), chosen when you select this
// species; Speed 30 feet; Resourceful — "You gain Heroic Inspiration
// whenever you finish a Long Rest"; Skillful — "You gain proficiency
// in one skill of your choice"; Versatile — "You gain an Origin feat
// of your choice (see chapter 5). Skilled is recommended."
//
// What this rebuilds, against the real code on a real throwaway DB:
//   (a) registry: the human entry is the 2024 entry (traits verbatim,
//       Skillful as a structured skill grant, no ASI, no 2014
//       Standard/Variant Human variants, sizes [Medium, Small],
//       source Player's Handbook (2024));
//   (b) legacy: old rows storing 'Standard Human' / 'Variant Human'
//       still resolve to the human entry with no variant applied
//       (no ASI, no free feat);
//   (c) HTTP: the size choice validates on POST/PUT (field-named
//       `size`), persists on the row (migration 110), clears on an
//       explicit null, and resets when a species change makes the
//       stored size impossible;
//   (d) Stage 4: human finals are base + theme only (no species ASI),
//       including under a legacy 'Standard Human' subrace;
//   (e) DM prompt: the species line prints the stored size when one
//       is recorded and omits it otherwise;
//   (f) mixed ancestry: the doc's Elf-man example as printed (Small
//       for Human/Elf parents) now validates — Small IS a size of
//       the human parent under the 2024 rule, which resolves the
//       doc discrepancy the mixed-ancestry suite recorded;
//   (g) migration 110: the size column exists.
//
// Languages are NOT on the photographed page: the entry keeps
// ["Common", "One extra language of your choice"] unchanged and
// this suite does not claim PHB confirmation for it.
//
// Isolated throwaway DB (perception-pre-roll pattern): temp dir
// becomes CWD before database.js loads, and the runner's shared
// TURSO env is deleted so database.js uses the local file.
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

const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'human-2024-test-'));
const tmpDir = repoRoot;
const origCwd = process.cwd();
process.chdir(tmpDir);
delete process.env.TURSO_DATABASE_URL;
delete process.env.TURSO_AUTH_TOKEN;
const fromRepo = (rel) => pathToFileURL(path.join(origCwd, rel)).href;

const db = await import(fromRepo('server/database.js'));
await db.initDatabase();
const species = await import(fromRepo('server/services/speciesService.js'));
const { validateCreatorNextStage4 } = await import(fromRepo('server/routes/character.js'));
const { createDMSystemPrompt } = await import(fromRepo('server/services/dmPromptBuilder.js'));
const { validateMixedAncestry } = await import(fromRepo('server/services/mixedAncestryService.js'));

const app = express();
app.use(express.json());
const characterRouter = (await import(fromRepo('server/routes/character.js'))).default;
const speciesRouter = (await import(fromRepo('server/routes/species.js'))).default;
app.use('/api/character', characterRouter);
app.use('/api/species', speciesRouter);
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
async function getJson(url) {
  const res = await fetch(`${base}${url}`);
  let json = null;
  try { json = await res.json(); } catch {}
  return { status: res.status, json };
}

// ===========================================================================
// (a) Registry — the 2024 entry
// ===========================================================================
group('(a) registry — human is the 2024 entry (PHB p. 194)');
{
  const human = species.resolveSpecies('human', null).entry;
  check(human?.source === "Player's Handbook (2024)", `source is Player's Handbook (2024) (got ${human?.source})`);
  check(human?.size === 'Medium', 'default size is Medium');
  try {
    assert.deepStrictEqual(human?.sizes, ['Medium', 'Small']);
    check(true, 'sizes choice is [Medium, Small]');
  } catch {
    check(false, `sizes choice is [Medium, Small] (got ${JSON.stringify(human?.sizes)})`);
  }
  check(human?.speeds?.walk === 30, 'speed is 30');
  check(human?.traits?.includes('Resourceful - You gain Heroic Inspiration whenever you finish a Long Rest'), 'Resourceful wording is verbatim (Heroic Inspiration on Long Rest finish)');
  check(human?.traits?.includes('Skillful - You gain proficiency in one skill of your choice'), 'Skillful wording is verbatim (one skill of your choice)');
  check(human?.traits?.includes('Versatile - You gain an Origin feat of your choice (Skilled is recommended)'), 'Versatile wording is verbatim (any Origin feat; Skilled recommended)');
  check(human?.traits?.length === 3, `exactly 3 traits (got ${human?.traits?.length})`);
  try {
    assert.deepStrictEqual(human?.grants, { skills: [{ choose: 1, from: 'any_skill' }] });
    check(true, 'Skillful is a structured grant: 1 skill of any choice');
  } catch {
    check(false, `Skillful grant shape (got ${JSON.stringify(human?.grants)})`);
  }
  check(Object.keys(human?.abilityScoreIncrease || {}).length === 0, 'no ability score increase (2024 human has no ASI)');
  check(human?.asiLegacy !== true, 'asiLegacy is gone (no 2014 ASI)');
  const variantNames = (human?.variants || []).map((v) => v.name);
  check(!variantNames.includes('Standard Human') && !variantNames.includes('Variant Human'), `no Standard/Variant Human variants (got ${JSON.stringify(variantNames)})`);
  check(human?.versatile2024 === true, 'versatile2024 flag still set');
  // Client shape + helpers.
  const shape = species.toClientShape(human);
  try {
    assert.deepStrictEqual(shape.sizes, ['Medium', 'Small']);
    check(true, 'toClientShape exposes sizes [Medium, Small]');
  } catch {
    check(false, `toClientShape sizes (got ${JSON.stringify(shape.sizes)})`);
  }
  check(shape.size === 'Medium', 'toClientShape size stays the Medium default');
  try {
    assert.deepStrictEqual(species.allowedSizesFor('human', null), ['Medium', 'Small']);
    check(true, 'allowedSizesFor(human) is [Medium, Small]');
  } catch {
    check(false, `allowedSizesFor(human) (got ${JSON.stringify(species.allowedSizesFor('human', null))})`);
  }
  try {
    assert.deepStrictEqual(species.allowedSizesFor('elf', null), ['Medium']);
    check(true, 'allowedSizesFor(elf) is [Medium] (single-size species unchanged)');
  } catch {
    check(false, `allowedSizesFor(elf) (got ${JSON.stringify(species.allowedSizesFor('elf', null))})`);
  }
  const viaHttp = await getJson('/api/species/human');
  try {
    assert.deepStrictEqual(viaHttp.json?.species?.sizes, ['Medium', 'Small']);
    check(true, 'GET /api/species/human exposes sizes');
  } catch {
    check(false, `GET /api/species/human sizes (got ${JSON.stringify(viaHttp.json?.species?.sizes)})`);
  }
}

// ===========================================================================
// (b) Legacy — old Standard/Variant Human rows still resolve
// ===========================================================================
group('(b) legacy — Standard/Variant Human resolve to the 2024 entry');
{
  for (const sub of ['Standard Human', 'Variant Human']) {
    const resolved = species.resolveSpecies('human', sub);
    check(resolved?.entry?.id === 'human', `'${sub}' resolves to the human entry`);
    check(resolved?.variant == null, `'${sub}' applies no variant (got ${JSON.stringify(resolved?.variant)})`);
    try {
      assert.deepStrictEqual(species.resolvedASIFor('human', sub), {});
      check(true, `resolvedASIFor('human', '${sub}') is {} (no 2014 ASI)`);
    } catch {
      check(false, `resolvedASIFor('human', '${sub}') is {} (got ${JSON.stringify(species.resolvedASIFor('human', sub))})`);
    }
  }
  check(species.resolveSpecies('variant-human')?.entry?.id === 'human', "'variant-human' alias still resolves");
  check(species.resolveSpecies('standard-human')?.entry?.id === 'human', "'standard-human' alias still resolves");
}

// ===========================================================================
// (c) HTTP — size choice validates, persists, clears, resets
// ===========================================================================
group('(c) HTTP — size validates on POST/PUT, persists, clears, resets');
{
  const small = await postCharacter({ name: 'H Small', race: 'human', size: 'Small' });
  check(small.status === 201, `human Small POST accepted with 201 (got ${small.status}: ${JSON.stringify(small.json)})`);
  check(small.json?.size === 'Small', `stored size is Small (got ${small.json?.size})`);
  const smallId = small.json?.id;

  const large = await postCharacter({ name: 'H Large', race: 'human', size: 'Large' });
  check(large.status === 400, `human Large POST refused with 400 (got ${large.status})`);
  check(JSON.stringify(large.json).includes('size:'), 'Large refusal is field-named size');
  check(JSON.stringify(large.json).includes('Medium or Small'), 'Large refusal names the allowed sizes');

  const elfSmall = await postCharacter({ name: 'E Small', race: 'elf', size: 'Small' });
  check(elfSmall.status === 400, `elf Small POST refused with 400 (got ${elfSmall.status})`);

  const noSize = await postCharacter({ name: 'H NoSize', race: 'human' });
  check(noSize.status === 201, `human without a size POST accepted (draft, got ${noSize.status})`);
  check(noSize.json?.size == null, `no-size POST stores NULL (got ${JSON.stringify(noSize.json?.size)})`);

  // PUT: change, clear, invalid.
  const putMedium = await putCharacter(smallId, { size: 'Medium' });
  check(putMedium.status === 200, `PUT size Medium accepted (got ${putMedium.status})`);
  check(putMedium.json?.size === 'Medium', `PUT stores Medium (got ${putMedium.json?.size})`);
  const putSmall = await putCharacter(smallId, { size: 'Small' });
  check(putSmall.status === 200 && putSmall.json?.size === 'Small', 'PUT size Small re-applies');
  const putLarge = await putCharacter(smallId, { size: 'Large' });
  check(putLarge.status === 400, `PUT size Large refused with 400 (got ${putLarge.status})`);
  const putClear = await putCharacter(smallId, { size: null });
  check(putClear.status === 200 && putClear.json?.size == null, `PUT size null clears the choice (got ${JSON.stringify(putClear.json?.size)})`);
  // A PUT carrying only a size is a real update, not "no fields".
  const putOnly = await putCharacter(smallId, { size: 'Small' });
  check(putOnly.status === 200 && putOnly.json?.size === 'Small', 'size-only PUT is a real update');

  // Species change resets an impossible stored size; a possible one stays.
  const toElf = await putCharacter(smallId, { race: 'elf' });
  check(toElf.status === 200, `PUT race elf accepted (got ${toElf.status})`);
  check(toElf.json?.size == null, `race change to elf clears the Small size (got ${JSON.stringify(toElf.json?.size)})`);
  const backHuman = await putCharacter(smallId, { race: 'human', size: 'Small' });
  check(backHuman.status === 200 && backHuman.json?.size === 'Small', 'race back to human + Small re-applies');
  const toElfWithSize = await putCharacter(smallId, { race: 'elf', size: 'Small' });
  check(toElfWithSize.status === 400, `PUT race elf + size Small refused (got ${toElfWithSize.status})`);
}

// ===========================================================================
// (d) Stage 4 — human finals are base + theme only
// ===========================================================================
group('(d) Stage 4 — human finals are base + theme only');
{
  // Point-buy 27 bases; soldier theme ASI is {str:2, con:1}.
  const base = { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 };
  const final2024 = { str: 17, dex: 14, con: 14, int: 12, wis: 10, cha: 8 };
  const body = (overrides) => ({
    creator: 'creator-next', class: 'fighter', race: 'human',
    theme_id: 'soldier', generation_method: 'point_buy',
    base_scores: base, ability_scores: final2024,
    skills: ['Athletics', 'Intimidation'], languages: ['Common', 'Dwarvish'],
    ...overrides,
  });
  check(validateCreatorNextStage4(body()).ok === true, '2024 human finals (base + theme) pass');
  check(validateCreatorNextStage4(body({ subrace: 'Standard Human' })).ok === true,
    "legacy 'Standard Human' subrace + 2024 finals pass (no variant ASI)");
  const oldFinal = { str: 18, dex: 15, con: 15, int: 13, wis: 11, cha: 9 }; // base +1 all + theme
  const oldRes = validateCreatorNextStage4(body({ ability_scores: oldFinal }));
  check(oldRes.ok === false && JSON.stringify(oldRes.errors).includes('abilityScores:'),
    `old +1-all finals refuse (got ${JSON.stringify(oldRes.errors)})`);
  const oldWithSub = validateCreatorNextStage4(body({ subrace: 'Standard Human', ability_scores: oldFinal }));
  check(oldWithSub.ok === false, "legacy 'Standard Human' subrace no longer grants the +1-all");
}

// ===========================================================================
// (e) DM prompt — stored size prints, absent size omits
// ===========================================================================
group('(e) DM prompt — species line prints the stored size');
{
  const char = {
    name: 'TEST Hero', first_name: 'TEST', race: 'Human', class: 'Fighter', level: 5, gender: 'male',
    ability_scores: { str: 16, dex: 14, con: 14, int: 10, wis: 12, cha: 8 },
    inventory: [], skills: [], feats: [], known_cantrips: [], known_spells: [], prepared_spells: [], equipment: {},
  };
  const ctx = {
    companions: [], awayCompanions: [],
    worldState: { npcRelationships: [], npcEventEffects: [], currentGameDay: 100, factionStandings: [], visibleEvents: [], discoveredLocations: [], activeFactions: [] },
    campaignPlanSummary: { setting: 'Forgotten Realms', tone: 'heroic' },
    previousSessionSummaries: [], characterMemories: '', campaignNotes: '', continueCampaign: false, pendingDowntimeNarratives: [],
  };
  const smallPrompt = createDMSystemPrompt({ ...char, size: 'Small' }, ctx);
  check(smallPrompt.includes('Species: Human — Size Small'), 'DM prompt prints Size Small for a Small human');
  check(smallPrompt.includes('Resourceful - You gain Heroic Inspiration whenever you finish a Long Rest'), 'DM prompt prints the 2024 Resourceful text');
  check(smallPrompt.includes('Skillful - You gain proficiency in one skill of your choice'), 'DM prompt prints the 2024 Skillful text');
  const noSizePrompt = createDMSystemPrompt({ ...char, size: null }, ctx);
  check(noSizePrompt.includes('Species: Human'), 'DM prompt still prints the species line with no size recorded');
  check(!noSizePrompt.includes('Size Small') && !noSizePrompt.includes('Size Medium'), 'DM prompt omits the Size segment when no size is recorded');
}

// ===========================================================================
// (f) Mixed ancestry — Elf-man as printed now validates
// ===========================================================================
group('(f) mixed ancestry — Elf-man as printed (Small) validates');
{
  // The 2024 human size choice resolves the doc discrepancy: Small
  // IS a size of the human parent now, so the doc's Elf-man example
  // validates exactly as printed (budget 7).
  const elfMan = validateMixedAncestry({ parents: ['human', 'elf'], size: 'Small', speed: 30, traits: [
    { species: 'elf', trait: 'Darkvision', cost: 1 },
    { species: 'elf', trait: 'Fey Ancestry', cost: 1 },
    { species: 'elf', trait: 'Trance', cost: 1 },
    { species: 'human', trait: 'Versatile', cost: 4 },
  ] });
  check(elfMan.ok === true, `Elf-man as printed validates (errors: ${elfMan.errors.join('; ')})`);
  check(elfMan.budgetUsed === 7, `Elf-man budget is 7 (got ${elfMan.budgetUsed})`);
  check(elfMan.normalized?.size === 'Small', `Elf-man stores size Small (got ${elfMan.normalized?.size})`);
}

// ===========================================================================
// (g) Migration 110 — size column exists
// ===========================================================================
group('(g) migration 110 — size column on characters');
{
  const cols = await db.dbAll("SELECT name FROM pragma_table_info('characters')");
  check(cols.some((c) => c.name === 'size'), 'migration 110 added size to characters');
}

// ---------------------------------------------------------------------------
server.close();
console.log(`\n human-2024: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
