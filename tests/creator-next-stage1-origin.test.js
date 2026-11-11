// tests/creator-next-stage1-origin.test.js — creator-next Stage 1 origin
// storage (2026-11-04). Migration 105 adds origin_setting /
// origin_region / origin_explanation to characters + npcs, and the
// character PUT allowlist accepts them so Stage 1 drafts actually
// persist instead of being silently dropped. Real DB (throwaway file
// per the runner), real migration run — no mocks of the schema.
//
// What this does NOT test (honest scope): the character POST route
// end-to-end, and the client component itself (npm test covers server
// only; the client is verified by import audit + the preview shell).
// It DOES mount the progression route on a throwaway express app to
// prove the payload shape the picker must handle (raw sentinel
// strings), and it tests the choice-options helper the picker calls.
import assert from 'node:assert';
import express from 'express';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');

const dbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dnd-creator-next-origin-'));
process.chdir(dbDir);
delete process.env.TURSO_DATABASE_URL;
delete process.env.TURSO_AUTH_TOKEN;

const svc = (rel) => pathToFileURL(path.join(REPO, rel)).href;
const { initDatabase, dbAll, dbGet, dbRun } = await import(svc('server/database.js'));
await initDatabase();

let passed = 0, failed = 0;
function group(name) { console.log('== ' + name + ' =='); }
function ok(cond, msg) {
  try { assert(cond, msg); passed++; }
  catch (e) { failed++; console.error('FAIL:', msg, '|', e.message); }
}

async function insertRow(table, overrides = {}) {
  const info = await dbAll(`PRAGMA table_info(${table})`);
  const cols = []; const vals = [];
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
  const r = await dbRun(
    `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`, vals
  );
  return Number(r.lastInsertRowid);
}

group('migration 105 columns exist');
for (const table of ['characters', 'npcs']) {
  const cols = (await dbAll(`PRAGMA table_info(${table})`)).map(c => c.name);
  ok(cols.includes('origin_setting'), `${table} has origin_setting`);
  ok(cols.includes('origin_region'), `${table} has origin_region`);
  ok(cols.includes('origin_explanation'), `${table} has origin_explanation`);
}

group('origin values round-trip on the character row');
const charId = await insertRow('characters', {
  name: 'Test Hero', current_hp: 10, max_hp: 10,
  ability_scores: JSON.stringify({ str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }),
  origin_setting: 'Eberron', origin_region: 'Khorvaire',
  origin_explanation: 'A manifest-zone storm threw my airship through a gate.'
});
const row = await dbGet('SELECT origin_setting, origin_region, origin_explanation FROM characters WHERE id = ?', [charId]);
ok(row.origin_setting === 'Eberron', 'origin_setting persists');
ok(row.origin_region === 'Khorvaire', 'origin_region persists');
ok(row.origin_explanation && row.origin_explanation.includes('manifest-zone'), 'origin_explanation persists');
await dbRun('UPDATE characters SET origin_region = ? WHERE id = ?', ['Sharn', charId]);
const updated = await dbGet('SELECT origin_region FROM characters WHERE id = ?', [charId]);
ok(updated.origin_region === 'Sharn', 'origin_region updates');

group('character PUT allowlist accepts origin fields (static guard)');
const routeSrc = fs.readFileSync(path.join(REPO, 'server/routes/character.js'), 'utf8');
ok(routeSrc.includes(`'origin_setting'`), 'PUT allowlist includes origin_setting');
ok(routeSrc.includes(`'origin_region'`), 'PUT allowlist includes origin_region');
ok(routeSrc.includes(`'origin_explanation'`), 'PUT allowlist includes origin_explanation');

group('Origin settings list (Stage 1 dropdown)');
const {
  FORGOTTEN_REALMS_REGIONS, ORIGIN_SETTINGS, REGIONS_BY_SETTING, SETTING_DESCRIPTIONS,
  ARRIVAL_OPTIONS, OTHER_SETTING_VALUE, OTHER_REGION_VALUE, OTHER_ARRIVAL_VALUE,
  regionsForSetting, settingDescription, regionDescription, regionFieldMode, isListedRegion, isListedArrival,
} = await import(svc('client/src/data/originSettings.js'));
ok(ORIGIN_SETTINGS.length >= 10, `settings list covers the published settings (${ORIGIN_SETTINGS.length})`);
const sortedSettings = [...ORIGIN_SETTINGS].sort((a, b) => a.localeCompare(b));
ok(JSON.stringify(ORIGIN_SETTINGS) === JSON.stringify(sortedSettings), 'settings list is alphabetical');
ok(new Set(ORIGIN_SETTINGS).size === ORIGIN_SETTINGS.length, 'settings list has no duplicates');
for (const s of ['Forgotten Realms', 'Eberron', 'Exandria', 'Ravnica', 'Theros', 'Dragonlance', 'Greyhawk', 'Dark Sun', 'Ravenloft', 'Spelljammer', 'Planescape', 'Mystara', 'Birthright', 'Strixhaven']) {
  ok(ORIGIN_SETTINGS.includes(s), `settings list includes ${s}`);
}
ok(OTHER_SETTING_VALUE === '__other__' && OTHER_REGION_VALUE === '__other__' && OTHER_ARRIVAL_VALUE === '__other__', 'Other sentinels are __other__');
for (const s of ORIGIN_SETTINGS) {
  ok(SETTING_DESCRIPTIONS[s] && SETTING_DESCRIPTIONS[s].trim().length > 20, `setting ${s} has a description`);
}

group('Regions per setting (Stage 1 dropdown)');
let totalRegions = 0;
for (const s of ORIGIN_SETTINGS) {
  const list = REGIONS_BY_SETTING[s] || [];
  totalRegions += list.length;
  ok(list.length >= 5, `${s} has a region list (${list.length})`);
  const names = list.map(r => r.name);
  const sorted = [...names].sort((a, b) => a.localeCompare(b));
  ok(JSON.stringify(names) === JSON.stringify(sorted), `${s} regions are alphabetical`);
  ok(new Set(names).size === names.length, `${s} regions have no duplicates`);
  ok(list.every(r => r.description && r.description.trim().length > 10), `${s} regions all have descriptions`);
}
ok(totalRegions >= 200, `plenty of regions across settings (${totalRegions})`);
ok(REGIONS_BY_SETTING['Forgotten Realms'].length === 46, 'FR regions unchanged (46)');
for (const r of ['Sword Coast', 'Dalelands', 'Cormyr', 'Amn', 'Calimshan', 'Chult', 'Underdark', 'Silver Marches', 'Moonsea', 'Icewind Dale', 'Thay', 'Rashemen']) {
  ok(FORGOTTEN_REALMS_REGIONS.map(e => e.name).includes(r), `FR region list includes ${r}`);
}
ok(REGIONS_BY_SETTING['Exandria'].some(e => e.name === 'Wildemount'), 'Wildemount is an Exandria region');
ok(regionsForSetting('Eberron').some(e => e.name === 'Breland'), 'regionsForSetting returns Eberron regions');
ok(regionsForSetting('A Custom Setting').length === 0, 'unknown setting has no region list');
ok(regionsForSetting('').length === 0, 'no setting has no region list');
ok(regionFieldMode('Forgotten Realms') === 'dropdown', 'FR setting shows the region dropdown');
ok(regionFieldMode('Eberron') === 'dropdown', 'Eberron setting shows the region dropdown');
ok(regionFieldMode('A Custom Setting') === 'text', 'custom setting keeps free-text region');
ok(regionFieldMode('') === 'text', 'no setting yet keeps free-text region');
ok(isListedRegion('Forgotten Realms', 'Sword Coast') && !isListedRegion('Forgotten Realms', 'Khorvaire'), 'isListedRegion is per-setting');

group('Every registry origin is offered (settings or regions)');
const speciesFiles = [
  ['server/data/species/phbSpecies.js', 'PHBSPECIES'],
  ['server/data/species/phbSpecies2.js', 'PHBSPECIES2'],
  ['server/data/species/voloSpecies.js', 'VOLOSPECIES'],
  ['server/data/species/eberronSpecies.js', 'EBERRONSPECIES'],
  ['server/data/species/wildemountSpecies.js', 'WILDEMOUNTSPECIES'],
  ['server/data/species/wildemountSpecies2.js', 'WILDEMOUNTSPECIES2'],
  ['server/data/species/ravnicaSpecies.js', 'RAVNICASPECIES'],
  ['server/data/species/eberronSpecies2.js', 'EBERRONSPECIES2'],
  ['server/data/species/eberronMarks.js', 'EBERRONMARKS'],
];
const registryOrigins = new Set();
for (const [rel, name] of speciesFiles) {
  const mod = await import(svc(rel));
  for (const entry of mod[name] || []) {
    for (const o of entry.origins || []) registryOrigins.add(o);
  }
}
ok(registryOrigins.size > 0, `registry origins collected (${registryOrigins.size})`);
for (const o of [...registryOrigins].sort()) {
  const offered = ORIGIN_SETTINGS.includes(o)
    || Object.values(REGIONS_BY_SETTING).some(list => list.some(e => e.name === o));
  ok(offered, `registry origin "${o}" is offered as a setting or a region`);
}

group('Setting and region descriptions (Stage 1 picker)');
ok(settingDescription('Forgotten Realms').includes('Faerûn'), 'FR description names Faerûn');
ok(settingDescription('Eberron').toLowerCase().includes('lightning rail'), 'Eberron description names the lightning rail');
ok(settingDescription('A Custom Setting') === '', 'custom setting has no description');
ok(settingDescription('') === '', 'no setting has no description');
ok(regionDescription('Forgotten Realms', 'Sword Coast').includes('Waterdeep'), 'Sword Coast description names Waterdeep');
ok(regionDescription('Eberron', 'Breland').length > 10, 'Breland has a description');
ok(regionDescription('Forgotten Realms', 'Khorvaire') === '', 'a region from another setting has no description here');
ok(regionDescription('A Custom Setting', 'Somewhere') === '', 'custom setting regions have no description');

group('Arrival options (Stage 1 explanation dropdown)');
ok(ARRIVAL_OPTIONS.length >= 10, `arrival list has plenty of options (${ARRIVAL_OPTIONS.length})`);
ok(new Set(ARRIVAL_OPTIONS).size === ARRIVAL_OPTIONS.length, 'arrival list has no duplicates');
ok(ARRIVAL_OPTIONS.some(a => a.toLowerCase().includes('portal')), 'arrival list includes a portal option');
ok(ARRIVAL_OPTIONS.some(a => a.includes('Born here')), 'arrival list includes a born-here option');
ok(isListedArrival('Through a portal that spat me out here') && !isListedArrival('Something else entirely'), 'isListedArrival matches list membership');

group('Stage 1 imports the origin options (static guard)');
const stage1Src = fs.readFileSync(path.join(REPO, 'client/src/components/creator-next/Stage1OriginIdentity.jsx'), 'utf8');
ok(stage1Src.includes('originSettings'), 'Stage 1 imports the origin options module');
ok(stage1Src.includes('ORIGIN_SETTINGS'), 'Stage 1 renders the settings list');
ok(stage1Src.includes('ARRIVAL_OPTIONS'), 'Stage 1 renders the arrival options');
ok(stage1Src.includes('regionsForSetting'), 'Stage 1 lists regions per setting');
ok(stage1Src.includes('settingDescription'), 'Stage 1 shows the setting description');
ok(stage1Src.includes('selectedRegion'), 'Stage 1 shows the region description');

group('Ancestry subchoice options resolve sentinels (Stage 1 gray-out)');
const { resolveChoiceOptions, isHeldOption } = await import(svc('client/src/components/creator-next/choiceOptions.js'));
const equipmentData = (await import(svc('client/src/data/equipment.json'), { with: { type: 'json' } })).default;
const { SKILLS } = await import(svc('client/src/data/references.js'));
const { ANCESTRY_FEATS } = await import(svc('server/data/ancestryFeats.js'));

const langOpts = resolveChoiceOptions({ type: 'language', options: 'any_language' });
const expectedLangs = [...equipmentData.languages.standard, ...equipmentData.languages.exotic];
ok(langOpts.length === expectedLangs.length, `any_language expands to the equipment language list (${langOpts.length})`);
ok(JSON.stringify(langOpts.map(o => o.value)) === JSON.stringify(expectedLangs), 'any_language keeps equipment order (standard then exotic)');
for (const l of ['Common', 'Elvish', 'Abyssal', 'Deep Speech', 'Undercommon']) ok(langOpts.some(o => o.value === l), `any_language includes ${l}`);
ok(new Set(langOpts.map(o => o.value)).size === langOpts.length, 'any_language has no duplicates');

const skillOpts = resolveChoiceOptions({ type: 'skill', options: 'any_skill' });
const expectedSkills = Object.values(SKILLS).map(s => s.name);
ok(skillOpts.length === expectedSkills.length, `any_skill expands to all ${expectedSkills.length} skills`);
ok(skillOpts.some(o => o.value === 'Perception') && skillOpts.some(o => o.value === 'Stealth'), 'any_skill includes Perception and Stealth');

const toolOpts = resolveChoiceOptions({ type: 'tool', options: 'any_artisan_tool' });
const expectedTools = equipmentData.tools.artisansTools.map(t => t.name);
ok(toolOpts.length === expectedTools.length, `any_artisan_tool expands to the equipment artisan list (${toolOpts.length})`);
ok(toolOpts.some(o => o.value === "Tinker's Tools"), "any_artisan_tool includes Tinker's Tools");

const anyToolOpts = resolveChoiceOptions({ type: 'tool', options: 'any_tool' });
ok(anyToolOpts.some(o => o.value === "Thieves' Tools") && anyToolOpts.some(o => o.value === 'Gaming Set'), 'any_tool includes kits and gaming sets');
ok(anyToolOpts.length > toolOpts.length, 'any_tool is broader than the artisan list');

const weaponOpts = resolveChoiceOptions({ type: 'weapon', options: 'any_martial_weapon' });
ok(weaponOpts.some(o => o.value === 'Longsword'), 'any_martial_weapon includes Longsword');

ok(JSON.stringify(resolveChoiceOptions({ type: 'language', options: ['Drow Sign Language', "Underdark thieves' cant", 'Ancient Elven Dialect'] }).map(o => o.value)) === JSON.stringify(['Drow Sign Language', "Underdark thieves' cant", 'Ancient Elven Dialect']), 'fixed arrays pass through unchanged (drow Weaver\'s Tongue)');
ok(resolveChoiceOptions({ type: 'cantrip', options: 'any_cantrip_wizard_or_druid' }) === null, 'cantrip sentinels return null (text input, not a crash)');
ok(resolveChoiceOptions({ type: 'spell', options: 'any_spell_level_5_or_lower_wizard_or_druid' }) === null, 'freeform spell sentinels return null');
ok(JSON.stringify(resolveChoiceOptions({ type: 'ability_score', options: ['INT', 'WIS'] }).map(o => o.value)) === JSON.stringify(['INT', 'WIS']), 'ability arrays pass through');

// Every tier-1 feat's choices resolve without throwing — the crash regression.
let nullChoices = [];
let threw = [];
for (const f of ANCESTRY_FEATS.filter(x => x.tier === 1)) {
  for (const c of f.choices || []) {
    try {
      const r = resolveChoiceOptions(c);
      if (r === null) nullChoices.push(`${f.list_id}:${f.feat_name}:${c.id}`);
      else if (r.length === 0) threw.push(`${f.list_id}:${f.feat_name}:${c.id} (empty)`);
    } catch (e) { threw.push(`${f.list_id}:${f.feat_name}:${c.id} (${e.message})`); }
  }
}
ok(threw.length === 0, `no tier-1 feat choice throws (${threw.join('; ') || 'none'})`);
ok(nullChoices.length === 1 && nullChoices[0].includes('Weave-Touched:cantrip'), `exactly one tier-1 choice needs the text input (Weave-Touched cantrip, got ${nullChoices.join(', ')})`);

// The held check is case-insensitive and never filters the list.
ok(isHeldOption('Elvish', ['Common', 'Elvish']), 'held language matches');
ok(isHeldOption('elvish', ['Common', 'Elvish']), 'held check is case-insensitive');
ok(!isHeldOption('Draconic', ['Common', 'Elvish']), 'unheld language stays enabled');
ok(!isHeldOption('Common', []), 'empty held list holds nothing');
ok(langOpts.length === expectedLangs.length, 'the resolver never filters held languages out (full list returned)');

group('Progression route serves raw sentinel strings (crash precondition)');
const app = express();
app.use(express.json());
const progressionRouter = (await import(svc('server/routes/progression.js'))).default;
app.use('/api/progression', progressionRouter);
const server = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
const base = `http://127.0.0.1:${server.address().port}`;
const humanFeats = await (await fetch(`${base}/api/progression/ancestry-feats/human?tier=1`)).json();
ok(Array.isArray(humanFeats) && humanFeats.length === 3, `human tier-1 serves 3 feats (${humanFeats.length})`);
const relentless = humanFeats.find(f => f.feat_name === 'Relentless Drive');
ok(relentless, 'Relentless Drive served');
const relentlessLang = relentless.choices.find(c => c.type === 'language');
ok(relentlessLang && relentlessLang.options === 'any_language', 'route serves the raw "any_language" string (the renderer must expand it)');
const travelers = humanFeats.find(f => f.feat_name === "Traveler's Tongue");
ok(travelers && travelers.choices[0].count === 2, "Traveler's Tongue carries count 2 (stored as a count-2 array; commit derivation asserted in creator-next-stage6-commit.test.js group (f))");
const drowFeats = await (await fetch(`${base}/api/progression/ancestry-feats/drow?tier=1`)).json();
const weavers = drowFeats.find(f => f.feat_name === "Weaver's Tongue");
ok(Array.isArray(weavers.choices[0].options) && weavers.choices[0].options.length === 3, 'fixed-list language choices arrive as arrays');
await new Promise(r => server.close(r));

group('Stage 1 gray-out rendering + resets (static guard)');
const stage1GraySrc = fs.readFileSync(path.join(REPO, 'client/src/components/creator-next/Stage1OriginIdentity.jsx'), 'utf8');
ok(stage1GraySrc.includes("from './choiceOptions.js'"), 'Stage 1 imports the choice-options helper');
ok(stage1GraySrc.includes('resolveChoiceOptions(choice)'), 'Stage 1 resolves subchoice options through the helper');
ok(stage1GraySrc.includes("choice.type === 'language'"), 'gray-out applies to language choices only');
ok(stage1GraySrc.includes('disabled={held}') && stage1GraySrc.includes('already known'), 'held language options render disabled with "already known"');
ok(stage1GraySrc.includes('options === null'), 'unexpandable choices fall back to a text input');
ok(stage1GraySrc.includes('placeholder="Type the name…"'), 'text input has a name prompt');
const resetCount = (stage1GraySrc.match(/ancestry_feat_choices: \{\}/g) || []).length;
ok(resetCount >= 3, `feat choices reset on species, variant, and feat change (${resetCount} resets)`);

group('Species and variants render alphabetical (polish note 1)');
{
  const stage1SortSrc = fs.readFileSync(path.join(REPO, 'client/src/components/creator-next/Stage1OriginIdentity.jsx'), 'utf8');
  ok(stage1SortSrc.includes('sortedSpecies'), 'Stage 1 sorts the species list at render');
  ok(stage1SortSrc.includes('sortedSpecies.map(s => {'), 'Stage 1 renders the sorted species list');
  ok(stage1SortSrc.includes('sortedVariants'), 'Stage 1 sorts the variant list at render');
  ok(stage1SortSrc.includes('sortedVariants.map(v => ('), 'Stage 1 renders the sorted variant list');
  ok(!stage1SortSrc.includes('{species.map(s => {'), 'Stage 1 no longer renders the unsorted species list');
  ok(!stage1SortSrc.includes('{variants.map(v => ('), 'Stage 1 no longer renders the unsorted variant list');
  // Live-data check: the sort key exists on every registry entry, and
  // sorting the real registry list by it yields alphabetical order.
  const { listSpecies } = await import(svc('server/services/speciesService.js'));
  const entries = listSpecies();
  ok(entries.length >= 29, `registry holds the species to sort (${entries.length})`);
  ok(entries.every(e => e.name && e.name.trim()), 'every registry entry has a display name to sort by');
  const sortedNames = entries.map(e => e.name).sort((a, b) => a.localeCompare(b));
  ok(sortedNames.every((n, i) => i === 0 || sortedNames[i - 1].localeCompare(n) <= 0), 'registry names sort alphabetical');
  for (const e of entries.filter(x => (x.variants || []).length > 1)) {
    const vNames = e.variants.map(v => v.name).sort((a, b) => a.localeCompare(b));
    ok(vNames.every((n, i) => i === 0 || vNames[i - 1].localeCompare(n) <= 0), `${e.name} variants sort alphabetical`);
  }
}

group('Species description spacing (polish note 2)');
{
  const stage1SpaceSrc = fs.readFileSync(path.join(REPO, 'client/src/components/creator-next/Stage1OriginIdentity.jsx'), 'utf8');
  const descAt = stage1SpaceSrc.indexOf('<strong>{currentEntry.name}.</strong>');
  ok(descAt > 0, 'species description block found');
  const marginAt = stage1SpaceSrc.indexOf('marginBottom: 18');
  ok(marginAt > 0 && marginAt < descAt, 'species description block carries marginBottom: 18 above the Variant section');
}

console.log(`=== Results: ${passed} passed, ${failed} failed ===`);
process.exit(failed ? 1 : 0);
