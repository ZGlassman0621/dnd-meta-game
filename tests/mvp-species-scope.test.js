// tests/mvp-species-scope.test.js — MVP player-species scope (Zach, 2026-11-05).
//
// Player characters are limited to the 11 pre-expansion (v1) species.
// The 18 outside-FR species are GRAYED OUT, not removed: they stay in
// the registry (NPCs can still be any of them) and are only disabled in
// the player creator. Reversible by design — putting a species back is
// deleting one line from MVP_DEFERRED_SPECIES in speciesService.js.
//
// Gnome gets one ancestry list (15 feats, tiers 1/3/7/13/18, shared by
// Forest / Rock / Scribing), so all 11 PC species have lists.
//
// Covers, against the real code on a real throwaway DB:
//   (a) gray-out: all 18 flagged, all 11 PC species creatable,
//       /api/species still returns 29 with the flag present;
//   (b) gnome list: 15 feats, 3 per tier, choice_index 1–3, no empty
//       name/description/mechanics, no tier-1 ASI, list resolves for
//       species 'gnome' through the real seed + the real progression
//       route the picker calls;
//   (c) POST guard: the real character router refuses a grayed-out
//       species with a clear error naming it, and accepts PC species,
//       PC-species variants, and unknown (free-text) species;
//   (d) picker wiring: static guard that Stage 1 disables grayed chips
//       with the MVP note, and the interim adapter (no flag) still
//       treats every entry as creatable.
//
// Isolated throwaway DB (perception-pre-roll pattern): temp dir becomes
// CWD before database.js loads, and the runner's shared TURSO env is
// deleted so database.js uses the local file.
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

const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mvp-species-scope-test-'));
const tmpDir = repoRoot;
const origCwd = process.cwd();
process.chdir(tmpDir);
delete process.env.TURSO_DATABASE_URL;
delete process.env.TURSO_AUTH_TOKEN;
const fromRepo = (rel) => pathToFileURL(path.join(origCwd, rel)).href;
const readRepo = (rel) => fs.readFileSync(path.join(origCwd, rel), 'utf-8');

const db = await import(fromRepo('server/database.js'));
await db.initDatabase();
const species = await import(fromRepo('server/services/speciesService.js'));
const { ANCESTRY_FEATS } = await import(fromRepo('server/data/ancestryFeats.js'));
const { seedProgressionData } = await import(fromRepo('server/services/progressionSeedService.js'));
const { adaptLegacySpecies } = await import(fromRepo('client/src/components/creator-next/speciesAdapter.js'));

// The ruling, named literally: the 11 PC species and the 18 deferred ones.
const PC_SPECIES = ['dragonborn', 'dwarf', 'elf', 'gnome', 'half-elf', 'half-orc', 'halfling', 'human', 'tiefling', 'aasimar', 'warforged'];
const DEFERRED_SPECIES = ['aarakocra', 'firbolg', 'genasi', 'goblin', 'bugbear', 'hobgoblin', 'kenku', 'tabaxi', 'tortle', 'centaur', 'loxodon', 'minotaur', 'simic-hybrid', 'vedalken', 'changeling', 'kalashtar', 'shifter', 'orc'];

// --- HTTP harness: the real routers on a real express app -----------------
const app = express();
app.use(express.json());
const speciesRouter = (await import(fromRepo('server/routes/species.js'))).default;
const characterRouter = (await import(fromRepo('server/routes/character.js'))).default;
const progressionRouter = (await import(fromRepo('server/routes/progression.js'))).default;
app.use('/api/species', speciesRouter);
app.use('/api/character', characterRouter);
app.use('/api/progression', progressionRouter);
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
async function getJson(url) {
  const res = await fetch(`${base}${url}`);
  let json = null;
  try { json = await res.json(); } catch {}
  return { status: res.status, json };
}
async function characterCountByName(name) {
  const row = await db.dbGet('SELECT COUNT(*) AS n FROM characters WHERE name = ?', [name]);
  return row?.n ?? 0;
}

// ===========================================================================
// (a) Service flag
// ===========================================================================
group('(a) service flag — isPcCreatable + toClientShape');
check(species.MVP_DEFERRED_SPECIES.size === 18, `deferred set has 18 ids (got ${species.MVP_DEFERRED_SPECIES.size})`);
for (const id of DEFERRED_SPECIES) {
  check(species.MVP_DEFERRED_SPECIES.has(id), `deferred set contains ${id}`);
}
for (const id of PC_SPECIES) {
  check(!species.MVP_DEFERRED_SPECIES.has(id), `deferred set does not contain PC species ${id}`);
}
check(species.listSpecies().length === 29, `registry still returns 29 species (got ${species.listSpecies().length})`);
for (const id of PC_SPECIES) {
  check(species.isPcCreatable(id, null) === true, `${id} is PC-creatable`);
}
for (const id of DEFERRED_SPECIES) {
  check(species.isPcCreatable(id, null) === false, `${id} is NOT PC-creatable`);
}
// Variant strings judge by their entry, not by the string.
check(species.isPcCreatable('Air Genasi', null) === false, "'Air Genasi' (variant string) resolves to deferred genasi");
check(species.isPcCreatable('genasi', 'Air Genasi') === false, "genasi + 'Air Genasi' subrace is deferred");
check(species.isPcCreatable('elf', 'Sea Elf') === true, "elf + 'Sea Elf' variant stays creatable (PC-species variant)");
check(species.isPcCreatable('Mark of Scribing', null) === true, "'Mark of Scribing' resolves to creatable gnome");
check(species.isPcCreatable('orc', null) === false, 'orc is deferred');
check(species.isPcCreatable('half-orc', null) === true, 'half-orc stays creatable (distinct from orc)');
check(species.isPcCreatable('something-made-up', null) === true, 'unknown species stays creatable (v1 no-rejection rule)');
check(species.isPcCreatable('', null) === true, 'empty race stays creatable');
const genasiShape = species.toClientShape(species.resolveSpecies('genasi', null).entry);
check(genasiShape.pcCreatable === false, 'toClientShape(genasi).pcCreatable is false');
check(genasiShape.pcCreatableNote === species.MVP_DEFERRED_NOTE, 'toClientShape(genasi) carries the MVP note');
const gnomeShape = species.toClientShape(species.resolveSpecies('gnome', null).entry);
check(gnomeShape.pcCreatable === true, 'toClientShape(gnome).pcCreatable is true');
check(gnomeShape.pcCreatableNote === null, 'toClientShape(gnome).pcCreatableNote is null');

// ===========================================================================
// (a2) Species HTTP route — the flag reaches the client
// ===========================================================================
group('(a2) GET /api/species — 29 entries, flag present');
{
  const { status, json } = await getJson('/api/species');
  check(status === 200, `GET /api/species returns 200 (got ${status})`);
  const list = json?.species || [];
  check(list.length === 29, `GET /api/species returns 29 entries (got ${list.length})`);
  const flagged = list.filter((s) => s.pcCreatable === false).map((s) => s.id).sort();
  check(JSON.stringify(flagged) === JSON.stringify([...DEFERRED_SPECIES].sort()),
    `exactly the 18 deferred species are flagged (got ${flagged.join(', ')})`);
  for (const id of PC_SPECIES) {
    const entry = list.find((s) => s.id === id);
    check(entry?.pcCreatable === true, `GET /api/species: ${id} is pcCreatable`);
  }
  const genasi = await getJson('/api/species/genasi');
  check(genasi.status === 200 && genasi.json?.species?.pcCreatable === false, 'GET /api/species/genasi is flagged');
  check(typeof genasi.json?.species?.pcCreatableNote === 'string' && genasi.json.species.pcCreatableNote.length > 0,
    'GET /api/species/genasi carries the note');
  const gnome = await getJson('/api/species/gnome');
  check(gnome.status === 200 && gnome.json?.species?.pcCreatable === true, 'GET /api/species/gnome is creatable');
}

// ===========================================================================
// (b) Gnome ancestry list — real seed into the real table
// ===========================================================================
group('(b) gnome ancestry list — seed + table + progression route');
{
  // Expected totals recomputed from the same data source the seed reads.
  const expectedTotal = ANCESTRY_FEATS.length;
  const expectedLists = [...new Set(ANCESTRY_FEATS.map((f) => f.list_id))];
  const expectedGnome = ANCESTRY_FEATS.filter((f) => f.list_id === 'gnome');
  check(expectedTotal === 210, `data file carries 210 ancestry feats (got ${expectedTotal})`);
  check(expectedLists.length === 14, `data file carries 14 lists (got ${expectedLists.length})`);
  check(expectedGnome.length === 15, `data file carries 15 gnome feats (got ${expectedGnome.length})`);

  // initDatabase already seeded; prove the seed (not a stale table) is
  // what produces the gnome rows by deleting and re-seeding. The seed
  // takes the raw libsql client (db.default), not the database module.
  await db.dbRun("DELETE FROM ancestry_feats WHERE list_id = 'gnome'");
  const gone = await db.dbGet("SELECT COUNT(*) AS n FROM ancestry_feats WHERE list_id = 'gnome'");
  check(gone.n === 0, 'gnome rows deleted before re-seed');
  await seedProgressionData(db.default);
  const rows = await db.dbAll("SELECT * FROM ancestry_feats WHERE list_id = 'gnome' ORDER BY tier, choice_index");
  check(rows.length === 15, `re-seed restores 15 gnome rows (got ${rows.length})`);
  const byTier = {};
  for (const r of rows) byTier[r.tier] = (byTier[r.tier] || 0) + 1;
  for (const tier of [1, 3, 7, 13, 18]) {
    check(byTier[tier] === 3, `gnome tier ${tier} has 3 feats (got ${byTier[tier] || 0})`);
    const idx = rows.filter((r) => r.tier === tier).map((r) => r.choice_index).sort();
    check(JSON.stringify(idx) === '[1,2,3]', `gnome tier ${tier} choice_index is 1,2,3 (got ${idx.join(',')})`);
  }
  for (const r of rows) {
    check(r.feat_name?.trim() && r.description?.trim() && r.mechanics?.trim(),
      `gnome feat ${r.tier}/${r.choice_index} has name, description, mechanics`);
  }
  // No ASI at tier 1 — the pattern all 39 existing tier-1 feats follow.
  const asiRe = /increase your (strength|dexterity|constitution|intelligence|wisdom|charisma)|\+1 (to )?(strength|dexterity|constitution|intelligence|wisdom|charisma)/i;
  const tier1Asi = rows.filter((r) => r.tier === 1 && asiRe.test(`${r.description} ${r.mechanics}`));
  check(tier1Asi.length === 0, `no gnome tier-1 feat grants +1 ASI (got ${tier1Asi.length})`);
  const totalRows = await db.dbGet('SELECT COUNT(*) AS n FROM ancestry_feats');
  check(totalRows.n === expectedTotal, `ancestry_feats table holds ${expectedTotal} rows (got ${totalRows.n})`);
  const listRows = await db.dbAll('SELECT DISTINCT list_id FROM ancestry_feats');
  check(listRows.length === expectedLists.length, `ancestry_feats holds ${expectedLists.length} lists (got ${listRows.length})`);
  // Every PC species now has a list (gnome was the last gap).
  for (const id of PC_SPECIES) {
    const listId = id === 'aasimar' ? 'aasimar_protector' : id.replace(/-/g, '_');
    const found = await db.dbGet('SELECT COUNT(*) AS n FROM ancestry_feats WHERE list_id = ?', [listId]);
    check(found.n > 0, `PC species ${id} has an ancestry list (${listId})`);
  }

  // The picker path: the real progression route serves the gnome list.
  const t1 = await getJson('/api/progression/ancestry-feats/gnome?tier=1');
  check(t1.status === 200 && Array.isArray(t1.json) && t1.json.length === 3,
    `GET ancestry-feats/gnome?tier=1 returns 3 (got ${t1.status}/${t1.json?.length})`);
  const all = await getJson('/api/progression/ancestry-feats/gnome');
  check(all.status === 200 && Array.isArray(all.json) && all.json.length === 15,
    `GET ancestry-feats/gnome returns 15 (got ${all.status}/${all.json?.length})`);
  const toolFeat = (all.json || []).find((f) => f.feat_name === "Tinkerer's Hands");
  check(Array.isArray(toolFeat?.choices) && toolFeat.choices.length > 0,
    "Tinkerer's Hands carries its tool subchoice picker through the route");
}

// ===========================================================================
// (c) Character POST guard — the real router over HTTP
// ===========================================================================
group('(c) POST /api/character guard');
{
  const refused = await postCharacter({ name: 'Gray Genasi', race: 'genasi' });
  check(refused.status === 400, `POST genasi refused with 400 (got ${refused.status})`);
  check(typeof refused.json?.error === 'string' && refused.json.error.includes('Genasi'),
    `genasi refusal names the species (got ${JSON.stringify(refused.json)})`);
  check(await characterCountByName('Gray Genasi') === 0, 'refused genasi created no row');

  const refusedVariant = await postCharacter({ name: 'Gray Air', race: 'Air Genasi' });
  check(refusedVariant.status === 400, `POST 'Air Genasi' refused with 400 (got ${refusedVariant.status})`);
  check(await characterCountByName('Gray Air') === 0, "refused 'Air Genasi' created no row");

  const refusedOrc = await postCharacter({ name: 'Gray Orc', race: 'orc' });
  check(refusedOrc.status === 400, `POST orc refused with 400 (got ${refusedOrc.status})`);
  check(await characterCountByName('Gray Orc') === 0, 'refused orc created no row');

  const okGnome = await postCharacter({ name: 'Good Gnome', race: 'gnome' });
  check(okGnome.status === 201, `POST gnome accepted with 201 (got ${okGnome.status})`);
  const gnomeRow = await db.dbGet('SELECT race FROM characters WHERE name = ?', ['Good Gnome']);
  check(gnomeRow?.race === 'gnome', 'gnome row persisted with race gnome');

  const okSeaElf = await postCharacter({ name: 'Good Sea Elf', race: 'elf', subrace: 'Sea Elf' });
  check(okSeaElf.status === 201, `POST elf + Sea Elf accepted with 201 (got ${okSeaElf.status})`);

  const okHalfOrc = await postCharacter({ name: 'Good Half-Orc', race: 'half-orc' });
  check(okHalfOrc.status === 201, `POST half-orc accepted with 201 (got ${okHalfOrc.status})`);

  const okUnknown = await postCharacter({ name: 'Good Unknown', race: 'something-made-up' });
  check(okUnknown.status === 201, `POST unknown species accepted with 201 (got ${okUnknown.status})`);

  const okHuman = await postCharacter({ name: 'Good Human', race: 'human' });
  check(okHuman.status === 201, `POST human accepted with 201 (got ${okHuman.status})`);
}

// ===========================================================================
// (d) Picker wiring — static guard + adapter fallback
// ===========================================================================
group('(d) Stage 1 picker wiring + adapter fallback');
{
  const stage1 = readRepo('client/src/components/creator-next/Stage1OriginIdentity.jsx');
  check(stage1.includes('pcCreatable === false'), 'Stage 1 tests pcCreatable === false');
  check(stage1.includes('pcCreatableNote'), 'Stage 1 reads pcCreatableNote for the tooltip');
  check(stage1.includes('disabled={isHandoff || grayed}'), 'Stage 1 disables grayed chips');
  check(stage1.includes('Coming after the MVP'), 'Stage 1 carries the MVP note as fallback text');

  // The interim adapter has no flag: every entry must read as creatable
  // under the picker's `=== false` test.
  const adapted = adaptLegacySpecies({
    human: { name: 'Human', description: 'd', size: 'Medium', speed: 30, languages: ['Common'], traits: [], abilityScoreIncrease: {}, subraces: [] },
    elf: { name: 'Elf', description: 'd', size: 'Medium', speed: 30, languages: ['Common'], traits: [], abilityScoreIncrease: {}, subraces: [] },
  });
  check(adapted.length === 2, 'adapter produces entries for the legacy races');
  for (const entry of adapted) {
    check(entry.pcCreatable === undefined, `adapter entry ${entry.id} carries no pcCreatable flag`);
    check(entry.pcCreatable === false ? false : true, `adapter entry ${entry.id} is creatable under the === false test`);
  }
}

// ---------------------------------------------------------------------------
server.close();
console.log(`\n mvp-species-scope: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
