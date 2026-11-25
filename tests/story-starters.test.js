// tests/story-starters.test.js — story-starters job (2026-11-25).
//
// Stage 5's story fields offer the orphaned starter files as choice
// lists, driven by theme (personality / ideals / bonds / flaws /
// backstory) and by species + size (appearance), with "Other / write
// your own" beside every list.
//
//   (a) inventory: every starter file, counted
//   (b) driver filtering (theme, species, size, mixed, no driver data)
//   (c) free-text survival per field (pick / other / blank)
//   (d) backstory moments keep the player's own lines
//   (e) Stage 5 wiring (source): lists + Other; no-set fields unchanged
//   (f) blank tolerance in the save body
//   (g) save → resume → rehydrate round trip (real router + real DB)
//   (h) Review shows every story field verbatim
import express from 'express';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

let passed = 0;
let failed = 0;
function check(condition, message) {
  if (condition) passed++;
  else { failed++; console.error('  ✗', message); }
}
function group(name) { console.log('\n==', name); }

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'story-starters-test-'));
const origCwd = process.cwd();
process.chdir(tmpDir);
delete process.env.TURSO_DATABASE_URL;
delete process.env.TURSO_AUTH_TOKEN;
const fromRepo = (rel) => pathToFileURL(path.join(origCwd, rel)).href;
const readRepo = (rel) => fs.readFileSync(path.join(origCwd, rel), 'utf-8');

const S = await import(fromRepo('client/src/components/creator-next/storyStarters.js'));
const P = await import(fromRepo('client/src/components/creator-next/stage1Persistence.js'));
const { THEME_PERSONALITY_PROMPTS } = await import(fromRepo('client/src/data/themePersonalityPrompts.js'));
const { THEME_IDEALS_PROMPTS } = await import(fromRepo('client/src/data/themeIdealsPrompts.js'));
const { THEME_BONDS_PROMPTS } = await import(fromRepo('client/src/data/themeBondsPrompts.js'));
const { THEME_FLAWS_PROMPTS } = await import(fromRepo('client/src/data/themeFlawsPrompts.js'));
const { THEME_BACKSTORY_MOMENTS } = await import(fromRepo('client/src/data/themeBackstoryMoments.js'));
const { RACE_COLOR_TRAITS } = await import(fromRepo('client/src/data/raceColorTraits.js'));
const { RACE_DEMOGRAPHICS } = await import(fromRepo('client/src/data/raceDemographics.js'));
const { storyStarterOptions: opts, pickerState, checkedMoments, toggleMoment } = S;
const count = (o) => Object.values(o).reduce((n, a) => n + a.length, 0);

// ---------------------------------------------------------------- (a)
group('(a) inventory');
check(Object.keys(THEME_PERSONALITY_PROMPTS).length === 21 && count(THEME_PERSONALITY_PROMPTS) === 189, '189 personality starters across 21 themes');
check(count(THEME_IDEALS_PROMPTS) === 136 && count(THEME_BONDS_PROMPTS) === 126 && count(THEME_FLAWS_PROMPTS) === 106, '136 ideals, 126 bonds, 106 flaws');
check(count(THEME_BACKSTORY_MOMENTS) === 168, '168 backstory moments');
const SPECIES = ['human', 'dwarf', 'elf', 'half-elf', 'half-orc', 'halfling', 'tiefling', 'aasimar', 'dragonborn', 'warforged'];
check(SPECIES.every((k) => RACE_COLOR_TRAITS[k] && RACE_DEMOGRAPHICS[k]), 'appearance data for the 10 species it was written for');
const themes = (await import(fromRepo('server/data/themes.js')));
const liveThemeIds = (themes.THEMES || themes.default || []).map?.((t) => t.id) || [];
if (liveThemeIds.length) check(Object.keys(THEME_PERSONALITY_PROMPTS).every((k) => liveThemeIds.includes(k)), 'every starter theme id is a live theme id');

// ---------------------------------------------------------------- (b)
group('(b) driver filtering');
const acolyte = { themeId: 'acolyte' };
check(opts('personality_traits', acolyte).options.length === 9 && opts('personality_traits', acolyte).options[0].value === THEME_PERSONALITY_PROMPTS.acolyte[0].text, 'personality: the acolyte theme gets its own nine starters');
check(!opts('personality_traits', acolyte).options.some((o) => THEME_PERSONALITY_PROMPTS.urchin.some((u) => u.text === o.value)), 'personality: another theme\'s starter never shows');
for (const f of ['personality_traits', 'ideals', 'bonds', 'flaws', 'backstory']) check(opts(f, {}) === null, `${f}: no theme picked → no list (free text)`);
check(opts('backstory', acolyte).multi === true && opts('backstory', acolyte).options.length === 8, 'backstory: eight acolyte moments, multi-pick');
check(opts('ideals', { themeId: 'charlatan' }).options.every((o) => typeof o.alignment === 'string'), 'theme starters carry their alignment tag');
const dwarf = { race: 'dwarf' };
check(JSON.stringify(opts('eye_color', dwarf).options.map((o) => o.value)) === JSON.stringify(RACE_COLOR_TRAITS.dwarf.eyes.map((o) => o.value)), 'eyes: a dwarf gets the dwarf list');
check(opts('height', dwarf, { size: 'Medium' }).options[0].value === RACE_DEMOGRAPHICS.dwarf.height[0].value, 'height: a dwarf gets the dwarf range');
for (const f of ['age', 'height', 'weight', 'eye_color', 'hair_color', 'skin_color', 'physical_build']) {
  check(opts(f, { race: 'goliath' }) === null, `${f}: a species with no data (goliath) → no list, no fallback to human`);
  check(opts(f, { race: '' }) === null, `${f}: no species yet → no list`);
}
const mixed = { race: '', mixedAncestry: { parents: [{ species: 'elf' }, { species: 'human' }] } };
check(opts('eye_color', mixed) === null, 'mixed ancestry → appearance stays free text');
const humanEntry = { id: 'human', size: 'Medium', sizes: ['Medium', 'Small'] };
check(opts('height', { race: 'human', size: 'Small' }, humanEntry) === null && opts('weight', { race: 'human', size: 'Small' }, humanEntry) === null, 'size: a Small human gets no height/weight list (the ranges are Medium)');
check(opts('eye_color', { race: 'human', size: 'Small' }, humanEntry) !== null && opts('age', { race: 'human', size: 'Small' }, humanEntry) !== null, 'size: a Small human still gets eyes and age (not size-driven)');
check(opts('height', { race: 'human', size: 'Medium' }, humanEntry) !== null && opts('height', { race: 'human', size: '' }, humanEntry) !== null, 'size: Medium or not yet picked → height list shows');
check(opts('height', { race: 'halfling', size: '' }, { id: 'halfling', size: 'Small' }) !== null, 'size: a halfling (usually Small) gets its range');
for (const f of ['organizations', 'allies', 'enemies', 'other_notes', 'alignment', 'faith', 'lifestyle']) check(opts(f, { themeId: 'acolyte', race: 'dwarf' }) === null, `${f}: no starter set → unchanged`);

// ---------------------------------------------------------------- (c)
group('(c) free-text survival per field');
const LIST_FIELDS = ['personality_traits', 'ideals', 'bonds', 'flaws', 'age', 'height', 'weight', 'eye_color', 'hair_color', 'skin_color', 'physical_build'];
const ctx = { themeId: 'acolyte', race: 'dwarf' };
for (const f of LIST_FIELDS) {
  const st = opts(f, ctx, { size: 'Medium' });
  check(pickerState(st.options[0].value, st).mode === 'pick', `${f}: a listed value shows as the pick`);
  check(pickerState('Something entirely my own', st).mode === 'other' && pickerState('Something entirely my own', st).value === 'Something entirely my own', `${f}: own words show as Other, verbatim`);
  check(pickerState('', st).mode === 'blank' && pickerState(undefined, st).mode === 'blank', `${f}: blank stays blank`);
}
check(pickerState(THEME_IDEALS_PROMPTS.acolyte[0].text + ' And more.', opts('ideals', ctx)).mode === 'other', 'an edited starter is the player\'s own words');

// ---------------------------------------------------------------- (d)
group('(d) backstory moments');
const bs = opts('backstory', ctx);
const [m1, m2] = [bs.options[0].value, bs.options[1].value];
let text = toggleMoment('I grew up by the river.', m1, true);
check(text === `I grew up by the river.\n${m1}`, 'ticking a moment appends it as its own line');
text = toggleMoment(text, m2, true);
check(JSON.stringify(checkedMoments(text, bs)) === JSON.stringify([m1, m2]), 'checked moments rehydrate from the text');
text = toggleMoment(text, m1, false);
check(text === `I grew up by the river.\n${m2}` && checkedMoments(text, bs).length === 1, 'unticking removes only that line; own words stay');
check(toggleMoment('', m1, true) === m1 && toggleMoment(m1, m1, false) === '', 'moments alone, in and out');

// ---------------------------------------------------------------- (e)
group('(e) Stage 5 wiring');
const stage5 = readRepo('client/src/components/creator-next/Stage5GearStory.jsx');
for (const f of [...LIST_FIELDS, 'backstory']) check(stage5.includes(`starterField('${f}',`), `${f} renders through starterField`);
for (const f of ['organizations', 'allies', 'enemies', 'other_notes']) check(stage5.includes(`textField('${f}',`), `${f} keeps its plain text box`);
check(stage5.includes('Other — write your own') && stage5.includes('Other… (type your own)'), 'both list kinds carry an Other entry');
check(stage5.includes('if (!starters) return textField(key, label, tip, multiline, guide)'), 'no starter set → the unchanged text box');
check(stage5.includes('data-starter-source'), 'each list shows its source line');
check(S.THEME_SOURCE_NOTE.includes('not book text') && S.SPECIES_SOURCE_NOTE.includes('not 2024 book text') && S.MOMENTS_SOURCE_NOTE.includes('not book text'), 'source lines say the starters are not book text');

// ---------------------------------------------------------------- (f)
group('(f) blank tolerance');
const blank = P.blankStage1State();
const body = P.buildStage1ProgressBody({ ...blank, personality_traits: THEME_PERSONALITY_PROMPTS.acolyte[0].text, ideals: 'My own ideal.' });
check(body.personality_traits === THEME_PERSONALITY_PROMPTS.acolyte[0].text && body.ideals === 'My own ideal.' && !('bonds' in body), 'a pick and own words are sent; a blank field is simply absent');
check(P.STAGE5_STORY_KEYS.length === 19, 'the 19 Stage 5 story columns');

// ---------------------------------------------------------------- (g)
group('(g) save → resume → rehydrate (real router + real DB)');
const db = await import(fromRepo('server/database.js'));
await db.initDatabase();
const app = express();
app.use(express.json());
app.use('/api/character', (await import(fromRepo('server/routes/character.js'))).default);
const server = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
const base = `http://127.0.0.1:${server.address().port}`;
try {
  const pick = THEME_PERSONALITY_PROMPTS.acolyte[2].text;
  const moment = THEME_BACKSTORY_MOMENTS.acolyte[0];
  const story = {
    personality_traits: pick,
    ideals: 'I keep my word, even when it costs me.',
    backstory: `Raised by the river.\n${moment}`,
    eye_color: 'Hazel',
    height: RACE_DEMOGRAPHICS.dwarf.height[3].value,
    alignment: 'Lawful Good', lifestyle: 'Modest',
  };
  const res = await fetch(`${base}/api/character`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'TEST_StoryStarters', race: 'dwarf', class: 'cleric', ...P.buildStage1ProgressBody({ ...blank, ...story }) }),
  });
  const created = await res.json();
  check(res.status === 201 && typeof created.id === 'number', `draft saves (got ${res.status})`);
  const got = await (await fetch(`${base}/api/character/${created.id}`)).json();
  for (const [k, v] of Object.entries(story)) check(got[k] === v, `${k} persists verbatim`);
  check(got.bonds == null || got.bonds === '', 'the blank field stays blank');
  // Resume: the shell rehydrates from the row (no local draft).
  const patch = P.rehydrateStateFromServerRow(got, null, null);
  for (const [k, v] of Object.entries(story)) check(patch[k] === v, `${k} rehydrates on resume`);
  const state = P.mergeRehydratedPatch({ ...blank, themeId: 'acolyte', race: 'dwarf' }, patch);
  check(pickerState(state.personality_traits, opts('personality_traits', state)).mode === 'pick', 'the personality pick shows as the pick after resume');
  check(pickerState(state.ideals, opts('ideals', state)).mode === 'other', 'the written ideal shows as Other after resume');
  check(pickerState(state.bonds, opts('bonds', state)).mode === 'blank', 'the blank bond is still blank after resume');
  check(JSON.stringify(checkedMoments(state.backstory, opts('backstory', state))) === JSON.stringify([moment]), 'the ticked moment is still ticked after resume');
  check(pickerState(state.eye_color, opts('eye_color', state)).mode === 'pick' && pickerState(state.height, opts('height', state, { size: 'Medium' })).mode === 'pick', 'species picks show after resume');
  // Edit: a later PUT keeps the other fields.
  const put = await fetch(`${base}/api/character/${created.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ flaws: THEME_FLAWS_PROMPTS.acolyte[0].text }) });
  const after = await (await fetch(`${base}/api/character/${created.id}`)).json();
  check(put.status === 200 && after.flaws === THEME_FLAWS_PROMPTS.acolyte[0].text && after.personality_traits === pick, 'an edit adds a pick without losing earlier ones');
  await db.dbRun('DELETE FROM characters WHERE id = ?', [created.id]);
} finally {
  await new Promise((r) => server.close(r));
}

// ---------------------------------------------------------------- (h)
group('(h) Review shows every story field verbatim');
const stage6 = readRepo('client/src/components/creator-next/Stage6ReviewCommit.jsx');
for (const k of P.STAGE5_STORY_KEYS) check(stage6.includes(`state.${k}]`), `Review lists ${k}`);
check(stage6.includes('storyText.map(([k, v]) => <div key={k} style={{ marginTop: 6 }}>{k}: {v}</div>)') && stage6.includes('storyFields.map(([k, v]) => <div key={k}>{k}: {v}</div>)'), 'Review prints each value as stored (no rewording)');

process.chdir(origCwd);
console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
process.exit(failed > 0 ? 1 : 0);
