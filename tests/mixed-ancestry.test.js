// tests/mixed-ancestry.test.js — Mixed Ancestry system (2026-11-06).
//
// Source: the GM Binder homebrew "Mixed Ancestry for D&D 5r (2024)"
// (EmberBoar Creations) — trait costs transcribed exactly as printed,
// never re-balanced. Covers, against the real code on a real
// throwaway DB:
//   (a) transcription: all 10 species tables, every trait name +
//       cost exactly as printed in the doc extract;
//   (b) the 4 doc examples validate with exactly budget 7 (Half-Elf,
//       Dragondwarf, Elf-man, Orcling — Orcling's orc parent is
//       MVP-deferred, so it FAILS the PC-creatable check while its
//       budget math still passes at 7);
//   (c) refusals: budget 8, trait from a non-parent, duplicate
//       trait, size that is neither parent's size, speed 35 without
//       the Speed trait, unknown parent, same parent twice;
//   (d) the 120→60 darkvision downgrade costs 1 (and refuses on a
//       trait that is already 60 ft);
//   (e) Goliath traits transcribed but the parent refused (not in
//       the registry yet); the forgo-Origin-Feat trade caps at 11
//       and refuses an origin-feat grant (direct validator + HTTP);
//   (f) HTTP: POST persists the mixed JSON + derives the stored
//       species string "Mixed Ancestry (A / B)" and speed; PUT
//       updates it; the ancestry-feat list is either parent's list;
//       GET /api/mixed-ancestry serves the tables;
//   (g) DM prompt: the mixed line prints parents + traits + budget.
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

const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mixed-ancestry-test-'));
const tmpDir = repoRoot;
const origCwd = process.cwd();
process.chdir(tmpDir);
delete process.env.TURSO_DATABASE_URL;
delete process.env.TURSO_AUTH_TOKEN;
const fromRepo = (rel) => pathToFileURL(path.join(origCwd, rel)).href;

const db = await import(fromRepo('server/database.js'));
await db.initDatabase();
const ma = await import(fromRepo('server/services/mixedAncestryService.js'));
const { validateMixedAncestry, ancestryFeatListsFor, mixedAncestrySpeciesLabel, formatMixedAncestryLine, traitTableFor } = ma;
const { MIXED_ANCESTRY_TRAIT_TABLES } = await import(fromRepo('server/data/mixedAncestry.js'));
const { validateCreatorNextStage3 } = await import(fromRepo('server/routes/character.js'));
const { createDMSystemPrompt } = await import(fromRepo('server/services/dmPromptBuilder.js'));
const { seedProgressionData } = await import(fromRepo('server/services/progressionSeedService.js'));
const { getCharacterProgression } = await import(fromRepo('server/services/progressionService.js'));

// --- HTTP harness: the real routers on a real express app -----------------
const app = express();
app.use(express.json());
const characterRouter = (await import(fromRepo('server/routes/character.js'))).default;
const mixedRouter = (await import(fromRepo('server/routes/mixedAncestry.js'))).default;
const progressionRouter = (await import(fromRepo('server/routes/progression.js'))).default;
app.use('/api/character', characterRouter);
app.use('/api/mixed-ancestry', mixedRouter);
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
// (a) Transcription — every trait name + cost exactly as printed
// ===========================================================================
group('(a) trait tables transcribed exactly as printed');
{
  // Expected values are the doc extract, verbatim: trait name + cost.
  const EXPECTED = {
    aasimar: [['Celestial Resistance', 2], ['Darkvision', 1], ['Healing Hands', 2], ['Light Bearer', 1], ['Celestial Revelation', 2]],
    dragonborn: [['Breath Weapon', 3], ['Damage Resistance', 1], ['Darkvision', 1], ['Draconic Flight', 2]],
    dwarf: [['Darkvision', 2], ['Dwarven Resilience', 2], ['Dwarven Toughness', 2], ['Stonecunning', 1]],
    elf: [['Darkvision', 1], ['Elven Lineage', 5], ['Fey Ancestry', 1], ['Keen Senses', 1], ['Trance', 1]],
    gnome: [['Darkvision', 1], ['Gnomish Cunning', 3], ['Gnomish Lineage', 3]],
    goliath: [['Speed', 1], ['Giant Ancestry', 3], ['Large Form', 2], ['Powerful Build', 1]],
    halfling: [['Brave', 1], ['Halfling Nimbleness', 1], ['Luck', 4], ['Naturally Stealthy', 1]],
    human: [['Resourceful', 2], ['Skillful', 1], ['Versatile', 4]],
    orc: [['Adrenaline Rush', 2], ['Darkvision', 2], ['Relentless Endurance', 3]],
    tiefling: [['Darkvision', 1], ['Fiendish Legacy', 5], ['Otherworldly Presence', 1]],
  };
  check(Object.keys(MIXED_ANCESTRY_TRAIT_TABLES).length === 10, `10 species tables (got ${Object.keys(MIXED_ANCESTRY_TRAIT_TABLES).length})`);
  for (const [species, traits] of Object.entries(EXPECTED)) {
    const table = MIXED_ANCESTRY_TRAIT_TABLES[species];
    check(!!table, `table exists for ${species}`);
    if (!table) continue;
    check(table.traits.length === traits.length, `${species} has ${traits.length} traits (got ${table.traits.length})`);
    for (const [name, cost] of traits) {
      const found = table.traits.find((t) => t.name === name);
      check(!!found, `${species} has trait '${name}'`);
      if (found) {
        check(found.cost === cost, `${species} '${name}' costs ${cost} (got ${found.cost})`);
        check(typeof found.description === 'string' && found.description.length > 0, `${species} '${name}' carries a description`);
      }
    }
  }
  // The two 120 ft darkvisions are the only downgrade candidates.
  const darkvision120 = [];
  for (const [species, table] of Object.entries(MIXED_ANCESTRY_TRAIT_TABLES)) {
    for (const t of table.traits) if (t.name === 'Darkvision' && t.darkvisionFt === 120) darkvision120.push(species);
  }
  try {
    assert.deepStrictEqual(darkvision120.sort(), ['dwarf', 'orc']);
    check(true, 'exactly dwarf + orc carry a 120 ft Darkvision');
  } catch {
    check(false, `exactly dwarf + orc carry a 120 ft Darkvision (got ${darkvision120})`);
  }
}

// ===========================================================================
// (b) The 4 doc examples validate with exactly budget 7
// ===========================================================================
group('(b) doc examples — budget exactly 7');
{
  const examples = [
    ['Half-Elf', { parents: ['human', 'elf'], size: 'Medium', speed: 30, traits: [
      { species: 'elf', trait: 'Elven Lineage', cost: 5 },
      { species: 'human', trait: 'Resourceful', cost: 2 },
    ] }],
    ['Dragondwarf', { parents: ['dragonborn', 'dwarf'], size: 'Medium', speed: 30, traits: [
      { species: 'dragonborn', trait: 'Breath Weapon', cost: 3 },
      { species: 'dragonborn', trait: 'Darkvision', cost: 1 },
      { species: 'dwarf', trait: 'Dwarven Toughness', cost: 2 },
      { species: 'dwarf', trait: 'Stonecunning', cost: 1 },
    ] }],
    // Elf-man's TRAITS budget at 7; its size (Small) is handled
    // below — Small is a human-parent size under the 2024 rule
    // (PHB p. 194: human size is a choice), so it validates now.
    ['Elf-man (Medium)', { parents: ['human', 'elf'], size: 'Medium', speed: 30, traits: [
      { species: 'elf', trait: 'Darkvision', cost: 1 },
      { species: 'elf', trait: 'Fey Ancestry', cost: 1 },
      { species: 'elf', trait: 'Trance', cost: 1 },
      { species: 'human', trait: 'Versatile', cost: 4 },
    ] }],
  ];
  for (const [name, record] of examples) {
    const r = validateMixedAncestry(record);
    check(r.ok === true, `${name} validates (errors: ${r.errors.join('; ')})`);
    check(r.budgetUsed === 7, `${name} budget is exactly 7 (got ${r.budgetUsed})`);
    check(r.budgetCap === 7, `${name} cap is 7 (got ${r.budgetCap})`);
  }
  // RESOLVED 2026-11-06 (2024 PHB p. 194, Zach's photo): the human
  // size is a CHOICE — Medium or Small, chosen at selection — so
  // Small IS a size of the human parent and the doc's Elf-man
  // example validates exactly as printed (budget 7). The earlier
  // discrepancy (doc rule 3 vs printed Small, both parents Medium
  // in the 2014 registry) dissolves under the 2024 rule.
  const elfManPrinted = validateMixedAncestry({ parents: ['human', 'elf'], size: 'Small', speed: 30, traits: [
    { species: 'elf', trait: 'Darkvision', cost: 1 },
    { species: 'elf', trait: 'Fey Ancestry', cost: 1 },
    { species: 'elf', trait: 'Trance', cost: 1 },
    { species: 'human', trait: 'Versatile', cost: 4 },
  ] });
  check(elfManPrinted.ok === true, `Elf-man as printed validates — Small is a human-parent size (errors: ${elfManPrinted.errors.join('; ')})`);
  check(elfManPrinted.budgetUsed === 7, `Elf-man budget still passes at 7 (got ${elfManPrinted.budgetUsed})`);
  check(elfManPrinted.normalized?.size === 'Small', `Elf-man stores size Small (got ${elfManPrinted.normalized?.size})`);
  // MVP-deferred, so the record as a whole refuses.
  const orcling = validateMixedAncestry({ parents: ['orc', 'halfling'], size: 'Small', speed: 30, traits: [
    { species: 'halfling', trait: 'Luck', cost: 4 },
    { species: 'orc', trait: 'Relentless Endurance', cost: 3 },
  ] });
  check(orcling.ok === false, 'Orcling refuses (orc parent is MVP-deferred)');
  check(orcling.budgetUsed === 7, `Orcling budget math still passes at 7 (got ${orcling.budgetUsed})`);
  check(orcling.errors.some((e) => e.includes('Orc') && e.includes('mixedAncestry.parents')), `Orcling error names the orc parent (got: ${orcling.errors.join('; ')})`);
  // Labels.
  check(mixedAncestrySpeciesLabel(['human', 'elf']) === 'Mixed Ancestry (Human / Elf)', 'label is "Mixed Ancestry (Human / Elf)"');
  check(mixedAncestrySpeciesLabel(['dragonborn', 'dwarf']) === 'Mixed Ancestry (Dragonborn / Dwarf)', 'label follows parent order');
}

// ===========================================================================
// (c) Refusals
// ===========================================================================
group('(c) refusals — budget, parent, duplicate, size, speed');
{
  const base = { parents: ['human', 'elf'], size: 'Medium', speed: 30, traits: [
    { species: 'elf', trait: 'Elven Lineage', cost: 5 },
    { species: 'human', trait: 'Resourceful', cost: 2 },
  ] };
  const over = validateMixedAncestry({ ...base, traits: [...base.traits, { species: 'elf', trait: 'Darkvision', cost: 1 }] });
  check(over.ok === false, 'budget 8 refuses');
  check(over.budgetUsed === 8, `budget 8 reports used 8 (got ${over.budgetUsed})`);
  check(over.errors.some((e) => e.startsWith('mixedAncestry.budget')), 'budget error is field-named mixedAncestry.budget');
  const nonParent = validateMixedAncestry({ ...base, traits: [
    { species: 'elf', trait: 'Elven Lineage', cost: 5 },
    { species: 'dwarf', trait: 'Stonecunning', cost: 1 },
  ] });
  check(nonParent.ok === false, 'trait from a non-parent refuses');
  check(nonParent.errors.some((e) => e.startsWith('mixedAncestry.traits') && e.includes('Stonecunning')), 'non-parent error names the trait');
  const dup = validateMixedAncestry({ ...base, traits: [
    { species: 'elf', trait: 'Darkvision', cost: 1 },
    { species: 'human', trait: 'Resourceful', cost: 2 },
    { species: 'elf', trait: 'Darkvision', cost: 1 },
    { species: 'elf', trait: 'Fey Ancestry', cost: 1 },
    { species: 'elf', trait: 'Trance', cost: 1 },
    { species: 'human', trait: 'Skillful', cost: 1 },
  ] });
  check(dup.ok === false, 'duplicate trait refuses');
  check(dup.errors.some((e) => e.includes('picked twice')), 'duplicate error says picked twice');
  const badSize = validateMixedAncestry({ ...base, size: 'Large' });
  check(badSize.ok === false, 'size Large refuses for Medium parents');
  check(badSize.errors.some((e) => e.startsWith('mixedAncestry.size')), 'size error is field-named');
  const badSpeed = validateMixedAncestry({ ...base, speed: 35 });
  check(badSpeed.ok === false, 'speed 35 without the Speed trait refuses');
  check(badSpeed.errors.some((e) => e.startsWith('mixedAncestry.speed')), 'speed error is field-named');
  const slow = validateMixedAncestry({ ...base, speed: 25 });
  check(slow.ok === false, 'speed 25 refuses (mixed speed is 30 unless a speed trait is taken)');
  const unknownParent = validateMixedAncestry({ parents: ['human', 'goliath'], size: 'Medium', traits: [] });
  check(unknownParent.ok === false, 'goliath parent refuses (not a known species yet)');
  check(unknownParent.errors.some((e) => e.includes('goliath') && e.includes('is not a known species yet')), 'goliath error says not a known species yet');
  const sameParent = validateMixedAncestry({ parents: ['human', 'human'], traits: [] });
  check(sameParent.ok === false, 'same parent twice refuses');
  const oneParent = validateMixedAncestry({ parents: ['human'], traits: [] });
  check(oneParent.ok === false, 'one parent refuses (exactly two required)');
  const wrongCost = validateMixedAncestry({ ...base, traits: [
    { species: 'elf', trait: 'Elven Lineage', cost: 4 },
    { species: 'human', trait: 'Resourceful', cost: 2 },
  ] });
  check(wrongCost.ok === false, 'sent cost that is not the table cost refuses');
  check(wrongCost.errors.some((e) => e.includes('costs 5')), 'wrong-cost error names the table cost');
  const unknownTrait = validateMixedAncestry({ ...base, traits: [
    { species: 'elf', trait: 'Elven Lineage', cost: 5 },
    { species: 'elf', trait: 'Not A Trait', cost: 1 },
  ] });
  check(unknownTrait.ok === false, 'unknown trait name refuses');
  // Draft tolerance: absent record, and parents with nothing else yet.
  const absent = validateMixedAncestry(null);
  check(absent.ok === true && absent.normalized === null, 'absent record is not mixed (ok, normalized null)');
  const draft = validateMixedAncestry({ parents: ['human', 'elf'] });
  check(draft.ok === true, 'parents-only draft validates (nothing else chosen yet)');
  check(draft.normalized.speed === 30, 'draft defaults speed 30');
}

// ===========================================================================
// (d) 120→60 darkvision downgrade
// ===========================================================================
group('(d) darkvision downgrade — 120 ft as 60 ft for 1');
{
  const downgraded = validateMixedAncestry({ parents: ['dragonborn', 'dwarf'], size: 'Medium', traits: [
    { species: 'dragonborn', trait: 'Breath Weapon', cost: 3 },
    { species: 'dwarf', trait: 'Darkvision', cost: 1, form: 'darkvision60' },
    { species: 'dwarf', trait: 'Dwarven Toughness', cost: 2 },
    { species: 'dwarf', trait: 'Stonecunning', cost: 1 },
  ] });
  check(downgraded.ok === true, `dwarf Darkvision as 60 ft validates (errors: ${downgraded.errors.join('; ')})`);
  check(downgraded.budgetUsed === 7, `downgraded record budgets at 7 (got ${downgraded.budgetUsed})`);
  check(downgraded.normalized.traits.find((t) => t.trait === 'Darkvision')?.form === 'darkvision60', 'downgrade form is stored on the trait');
  const fullPrice = validateMixedAncestry({ parents: ['dragonborn', 'dwarf'], size: 'Medium', traits: [
    { species: 'dragonborn', trait: 'Breath Weapon', cost: 3 },
    { species: 'dwarf', trait: 'Darkvision', cost: 2 },
    { species: 'dwarf', trait: 'Dwarven Toughness', cost: 2 },
  ] });
  check(fullPrice.ok === true && fullPrice.budgetUsed === 7, '120 ft Darkvision at full cost 2 still validates');
  const badForm = validateMixedAncestry({ parents: ['human', 'elf'], traits: [
    { species: 'elf', trait: 'Darkvision', cost: 1, form: 'darkvision60' },
  ] });
  check(badForm.ok === false, 'downgrade form on an already-60 ft Darkvision refuses');
  const badFormCost = validateMixedAncestry({ parents: ['dragonborn', 'dwarf'], traits: [
    { species: 'dwarf', trait: 'Darkvision', cost: 2, form: 'darkvision60' },
  ] });
  check(badFormCost.ok === false, 'downgraded Darkvision sent at cost 2 refuses (effective cost is 1)');
}

// ===========================================================================
// (e) Goliath table present but parent refused; forgo trade
// ===========================================================================
group('(e) goliath table inert; forgo-Origin-Feat trade');
{
  const table = traitTableFor('goliath');
  check(!!table, 'goliath trait table exists');
  check(table.traits.length === 4, `goliath table has 4 traits (got ${table?.traits.length})`);
  check(table.available === false, 'goliath parent is unavailable');
  check(table.unavailableReason === 'Not in the species list yet', `goliath reason is plain player language (got ${table?.unavailableReason})`);
  const speedTrait = validateMixedAncestry({ parents: ['goliath', 'human'], traits: [
    { species: 'goliath', trait: 'Speed', cost: 1 },
  ], speed: 35 });
  check(speedTrait.ok === false, 'Goliath Speed trait cannot be taken while the parent is unavailable');
  check(speedTrait.errors.some((e) => e.includes('goliath')), 'goliath speed error names goliath');

  // Forgo trade: cap 11, 11 traits pass, 12 refuse.
  const traded = validateMixedAncestry({ parents: ['human', 'elf'], forgoOriginFeat: true, traits: [
    { species: 'elf', trait: 'Elven Lineage', cost: 5 },
    { species: 'elf', trait: 'Fey Ancestry', cost: 1 },
    { species: 'elf', trait: 'Trance', cost: 1 },
    { species: 'human', trait: 'Resourceful', cost: 2 },
    { species: 'human', trait: 'Skillful', cost: 1 },
    { species: 'elf', trait: 'Keen Senses', cost: 1 },
  ] });
  check(traded.ok === true, `forgo trade validates at 11 (errors: ${traded.errors.join('; ')})`);
  check(traded.budgetCap === 11, `forgo cap is 11 (got ${traded.budgetCap})`);
  check(traded.budgetUsed === 11, `forgo record uses 11 (got ${traded.budgetUsed})`);
  check(traded.normalized.forgoOriginFeat === true, 'trade is stored on the record');
  const tradedOver = validateMixedAncestry({ parents: ['human', 'elf'], forgoOriginFeat: true, traits: [
    { species: 'elf', trait: 'Elven Lineage', cost: 5 },
    { species: 'elf', trait: 'Fey Ancestry', cost: 1 },
    { species: 'elf', trait: 'Trance', cost: 1 },
    { species: 'human', trait: 'Resourceful', cost: 2 },
    { species: 'human', trait: 'Skillful', cost: 1 },
    { species: 'elf', trait: 'Keen Senses', cost: 1 },
    { species: 'elf', trait: 'Darkvision', cost: 1 },
  ] });
  check(tradedOver.ok === false, 'forgo trade still refuses at 12');
  check(tradedOver.budgetCap === 11, 'over-trade error caps at 11');

  // Stage 3 refuses an origin-feat grant while the trade is on.
  const stage3 = validateCreatorNextStage3({
    theme_id: 'soldier', origin_feat: 'savage_attacker',
    mixed_ancestry: { parents: ['human', 'elf'], forgoOriginFeat: true, traits: [] },
  });
  check(stage3.ok === false, 'Stage 3 refuses the theme feat while the trade is on');
  check(stage3.errors.some((e) => e.startsWith('originFeat:') && e.includes('forgone')), 'trade refusal is field-named originFeat');
  const stage3NoTrade = validateCreatorNextStage3({
    theme_id: 'soldier', origin_feat: 'savage_attacker',
    mixed_ancestry: { parents: ['human', 'elf'], forgoOriginFeat: false, traits: [] },
  });
  check(stage3NoTrade.ok === true, 'Stage 3 accepts the theme feat without the trade');

  // Ancestry lists: either parent's list.
  try {
    assert.deepStrictEqual(ancestryFeatListsFor(['human', 'elf']), ['human', 'elf']);
    check(true, "ancestry lists for human/elf are ['human', 'elf']");
  } catch {
    check(false, `ancestry lists for human/elf are ['human', 'elf'] (got ${JSON.stringify(ancestryFeatListsFor(['human', 'elf']))})`);
  }
  try {
    assert.deepStrictEqual(ancestryFeatListsFor(['aasimar', 'human']), ['aasimar_protector', 'aasimar_scourge', 'aasimar_fallen', 'human']);
    check(true, 'aasimar parent contributes all three aasimar lists');
  } catch {
    check(false, `aasimar parent contributes all three lists (got ${JSON.stringify(ancestryFeatListsFor(['aasimar', 'human']))})`);
  }
  check(ancestryFeatListsFor(['goliath']).length === 0, 'goliath contributes no ancestry list');
}

// ===========================================================================
// (f) HTTP — persist, derive, PUT, ancestry lists, tables endpoint
// ===========================================================================
group('(f) HTTP — POST persists + derives, PUT updates, lists enforced');
{
  await seedProgressionData(db.default);
  const elfFeats = await getJson('/api/progression/ancestry-feats/elf?tier=1');
  const elfFeatId = elfFeats.json?.[0]?.id;
  check(typeof elfFeatId === 'number', `seeded elf tier-1 feat id resolves (got ${JSON.stringify(elfFeatId)})`);
  const dwarfFeats = await getJson('/api/progression/ancestry-feats/dwarf?tier=1');
  const dwarfFeatId = dwarfFeats.json?.[0]?.id;
  check(typeof dwarfFeatId === 'number', `seeded dwarf tier-1 feat id resolves (got ${JSON.stringify(dwarfFeatId)})`);

  const halfElf = await postCharacter({
    name: 'MA Half-Elf', race: 'human', creator: 'creator-next',
    mixed_ancestry: { parents: ['human', 'elf'], size: 'Medium', speed: 30, traits: [
      { species: 'elf', trait: 'Elven Lineage', cost: 5 },
      { species: 'human', trait: 'Resourceful', cost: 2 },
    ] },
  });
  check(halfElf.status === 201, `mixed Half-Elf POST accepted with 201 (got ${halfElf.status}: ${JSON.stringify(halfElf.json)})`);
  const halfElfId = halfElf.json?.id;
  check(halfElf.json?.race === 'Mixed Ancestry (Human / Elf)', `stored race derives to the label (got ${halfElf.json?.race})`);
  check(halfElf.json?.speed === 30, `stored speed is 30 (got ${halfElf.json?.speed})`);
  check(halfElf.json?.subrace === null, `stored subrace is null (got ${JSON.stringify(halfElf.json?.subrace)})`);
  const storedRow = await db.dbGet('SELECT mixed_ancestry_json FROM characters WHERE id = ?', [halfElfId]);
  const stored = storedRow?.mixed_ancestry_json ? JSON.parse(storedRow.mixed_ancestry_json) : null;
  check(stored?.budgetUsed === 7 && stored?.budgetCap === 7, `mixed JSON persists with budget 7/7 (got ${storedRow?.mixed_ancestry_json})`);
  try {
    assert.deepStrictEqual(stored?.parents, ['human', 'elf']);
    check(true, 'mixed JSON persists canonical parents');
  } catch {
    check(false, `mixed JSON persists canonical parents (got ${JSON.stringify(stored?.parents)})`);
  }

  // Orc parent refused over HTTP; over-budget refused over HTTP.
  const orcPost = await postCharacter({
    name: 'MA Orcling', race: 'human', creator: 'creator-next',
    mixed_ancestry: { parents: ['orc', 'halfling'], size: 'Small', traits: [
      { species: 'halfling', trait: 'Luck', cost: 4 },
      { species: 'orc', trait: 'Relentless Endurance', cost: 3 },
    ] },
  });
  check(orcPost.status === 400, `orc-parent POST refused with 400 (got ${orcPost.status})`);
  check(JSON.stringify(orcPost.json).includes('Orc'), 'orc refusal names Orc');
  const overPost = await postCharacter({
    name: 'MA Over', race: 'human', creator: 'creator-next',
    mixed_ancestry: { parents: ['human', 'elf'], traits: [
      { species: 'elf', trait: 'Elven Lineage', cost: 5 },
      { species: 'human', trait: 'Resourceful', cost: 2 },
      { species: 'elf', trait: 'Darkvision', cost: 1 },
    ] },
  });
  check(overPost.status === 400, `over-budget POST refused with 400 (got ${overPost.status})`);

  // Forgo trade + theme feat refused over HTTP (marker body).
  const tradePost = await postCharacter({
    name: 'MA Trade', race: 'human', creator: 'creator-next',
    theme_id: 'soldier', origin_feat: 'savage_attacker',
    mixed_ancestry: { parents: ['human', 'elf'], forgoOriginFeat: true, traits: [
      { species: 'elf', trait: 'Elven Lineage', cost: 5 },
      { species: 'human', trait: 'Resourceful', cost: 2 },
    ] },
  });
  check(tradePost.status === 400, `trade + theme feat POST refused with 400 (got ${tradePost.status})`);
  check(JSON.stringify(tradePost.json).includes('forgone'), 'trade refusal mentions the forgone feat');

  // PUT updates the record (traits change, budget re-checked).
  const put = await putCharacter(halfElfId, {
    creator: 'creator-next',
    mixed_ancestry: { parents: ['human', 'elf'], size: 'Medium', speed: 30, traits: [
      { species: 'elf', trait: 'Darkvision', cost: 1 },
      { species: 'elf', trait: 'Fey Ancestry', cost: 1 },
      { species: 'elf', trait: 'Trance', cost: 1 },
      { species: 'human', trait: 'Versatile', cost: 4 },
    ] },
  });
  check(put.status === 200, `mixed PUT accepted with 200 (got ${put.status}: ${JSON.stringify(put.json)})`);
  check(put.json?.race === 'Mixed Ancestry (Human / Elf)', 'PUT keeps the derived race label');
  const putRow = await db.dbGet('SELECT mixed_ancestry_json FROM characters WHERE id = ?', [halfElfId]);
  const putStored = putRow?.mixed_ancestry_json ? JSON.parse(putRow.mixed_ancestry_json) : null;
  check(putStored?.size === 'Medium', `PUT persists the new size (got ${putStored?.size})`);
  check(putStored?.traits?.some((t) => t.trait === 'Versatile'), 'PUT persists the Versatile trait');

  // Ancestry-feat list: an elf-list feat is allowed, a dwarf-list
  // feat is refused for a human/elf mixed character.
  const elfAllowed = await postCharacter({
    name: 'MA Elf Feat', race: 'human', creator: 'creator-next',
    mixed_ancestry: { parents: ['human', 'elf'], traits: [
      { species: 'elf', trait: 'Fey Ancestry', cost: 1 },
    ] },
    ancestry_feat_id: elfFeatId,
  });
  check(elfAllowed.status === 201, `elf-list ancestry feat accepted for human/elf mix (got ${elfAllowed.status}: ${JSON.stringify(elfAllowed.json)})`);
  const dwarfRefused = await postCharacter({
    name: 'MA Dwarf Feat', race: 'human', creator: 'creator-next',
    mixed_ancestry: { parents: ['human', 'elf'], traits: [
      { species: 'elf', trait: 'Fey Ancestry', cost: 1 },
    ] },
    ancestry_feat_id: dwarfFeatId,
  });
  check(dwarfRefused.status === 400, `dwarf-list ancestry feat refused for human/elf mix (got ${dwarfRefused.status})`);
  check(JSON.stringify(dwarfRefused.json).includes('ancestryFeatId'), 'list refusal is field-named ancestryFeatId');

  // Tables endpoint serves the transcribed tables.
  const tables = await getJson('/api/mixed-ancestry');
  check(tables.status === 200, `GET /api/mixed-ancestry returns 200 (got ${tables.status})`);
  check(tables.json?.baseBudget === 7, 'tables endpoint reports base budget 7');
  check(tables.json?.forgoOriginFeatBonus === 4, 'tables endpoint reports forgo bonus +4');
  check(Array.isArray(tables.json?.tables) && tables.json.tables.length === 10, `tables endpoint serves 10 tables (got ${tables.json?.tables?.length})`);
  const goliathTable = (tables.json?.tables || []).find((t) => t.speciesId === 'goliath');
  check(goliathTable?.available === false, 'tables endpoint marks goliath unavailable');
  const lists = await getJson('/api/mixed-ancestry/ancestry-lists?parents=human,elf');
  check(lists.status === 200, 'ancestry-lists endpoint returns 200');
  try {
    assert.deepStrictEqual(lists.json?.lists, ['human', 'elf']);
    check(true, "ancestry-lists endpoint returns ['human', 'elf']");
  } catch {
    check(false, `ancestry-lists endpoint returns ['human', 'elf'] (got ${JSON.stringify(lists.json?.lists)})`);
  }

  // Migration 108: the column exists on the live schema.
  const cols = await db.dbAll("SELECT name FROM pragma_table_info('characters')");
  check(cols.some((c) => c.name === 'mixed_ancestry_json'), 'migration 108 added mixed_ancestry_json to characters');
}

// ===========================================================================
// (g) DM prompt — the mixed line prints
// ===========================================================================
group('(g) DM prompt — mixed line');
{
  const char = {
    name: 'TEST Hero', first_name: 'TEST', race: 'Mixed Ancestry (Human / Elf)',
    class: 'Fighter', level: 5, gender: 'male',
    ability_scores: { str: 16, dex: 14, con: 14, int: 10, wis: 12, cha: 8 },
    inventory: [], skills: [], feats: [], known_cantrips: [], known_spells: [],
    prepared_spells: [], equipment: {},
    mixed_ancestry_json: JSON.stringify({ parents: ['human', 'elf'], size: 'Medium', speed: 30, traits: [
      { species: 'elf', trait: 'Elven Lineage', cost: 5 },
      { species: 'human', trait: 'Resourceful', cost: 2 },
    ], budgetUsed: 7, budgetCap: 7, forgoOriginFeat: false, versatileFeat: null }),
  };
  const ctx = {
    companions: [], awayCompanions: [],
    worldState: { npcRelationships: [], npcEventEffects: [], currentGameDay: 100, factionStandings: [], visibleEvents: [], discoveredLocations: [], activeFactions: [] },
    campaignPlanSummary: { setting: 'Forgotten Realms', tone: 'heroic' },
    previousSessionSummaries: [], characterMemories: '', campaignNotes: '', continueCampaign: false, pendingDowntimeNarratives: [],
  };
  const line = formatMixedAncestryLine(char.mixed_ancestry_json);
  check(line === 'Mixed Ancestry: Human / Elf — Size Medium, Speed 30 ft — Traits: Elven Lineage (5), Resourceful (2) — Power budget 7/7',
    `formatter line is exact (got ${line})`);
  check(formatMixedAncestryLine(null) === '', 'formatter returns empty for no record');
  const prompt = createDMSystemPrompt(char, ctx);
  check(prompt.includes('Mixed Ancestry: Human / Elf'), 'DM prompt carries the mixed line');
  check(prompt.includes('Elven Lineage (5), Resourceful (2)'), 'DM prompt carries the chosen traits + costs');
  check(prompt.includes('Power budget 7/7'), 'DM prompt carries the budget');
  const plain = createDMSystemPrompt({ ...char, mixed_ancestry_json: null, race: 'Human' }, ctx);
  check(!plain.includes('Mixed Ancestry:'), 'DM prompt omits the mixed line for a non-mixed character');
}

// ---------------------------------------------------------------------------
server.close();
console.log(`\n mixed-ancestry: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
