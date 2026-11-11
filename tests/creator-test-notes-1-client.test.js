// tests/creator-test-notes-1-client.test.js — creator test-notes job
// (Zach's 2026-11-09 test), CLIENT items.
//
// Honest integration tests: every behavior pin calls the REAL module
// (references.js SKILLS, deities.json, speciesAdapter.js,
// stage1Persistence.js, server/data/themes.js) or reads the REAL
// stage source the browser renders. No logic is re-implemented —
// if a service file were deleted, these imports fail and the suite
// fails with it. Registry totals are derived from the source itself,
// never hardcoded as the behavior under test (the Faerûnian count
// is asserted from the JSON the picker reads).
//
// Pure client + data only: no database is touched, so this runs with
// plain `node tests/creator-test-notes-1-client.test.js`.
//
// Coverage, by test-note item:
//   #1 silent resume restore, #2 interim note deleted, #3 single
//   tooltip layer, #4 arrival prompt hidden for FR-born, #6 one
//   term ("ancestry feats"), #7 deferred note above the picker,
//   #8 helper rewrite without Quick Build, #9 Quick Build gone,
//   #10 god picker (Faerûnian + None, setting-aware), #11 pact
//   picker (3 Pacts only), #12 subclass description render + follow-up
//   origin suffix (in addition to the description, non-FR/null only),
//   #5 follow-up (resume prefers the stored feat_id),
//   #13/#18/#19 shared checkbox-row style + skill descriptions,
//   #15 theme preview expandable, #16 scroll to top on advance,
//   #17 traits as bullets.

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');
const svc = (rel) => pathToFileURL(path.join(REPO, rel)).href;
const readRepo = (rel) => fs.readFileSync(path.join(REPO, rel), 'utf8');

const { SKILLS, lookupReference } = await import(svc('client/src/data/references.js'));
const deities = (await import(svc('client/src/data/deities.json'), { with: { type: 'json' } })).default;
const { isOutsideFR, resolveOriginSetting } = await import(svc('client/src/components/creator-next/speciesAdapter.js'));
const { blankStage1State, buildStage1ProgressBody, rehydrateStateFromServerRow, rehydrateFromServerCharacter } = await import(svc('client/src/components/creator-next/stage1Persistence.js'));
const { subclassOriginSuffix } = await import(svc('client/src/components/creator-next/subclassOrigin.js'));
const { THEMES } = await import(svc('server/data/themes.js'));

const stage1 = readRepo('client/src/components/creator-next/Stage1OriginIdentity.jsx');
const stage2 = readRepo('client/src/components/creator-next/Stage2ClassCalling.jsx');
const stage3 = readRepo('client/src/components/creator-next/Stage3PastPath.jsx');
const stage4 = readRepo('client/src/components/creator-next/Stage4AbilitiesSkillsSpells.jsx');
const shell = readRepo('client/src/components/creator-next/CreatorNextShell.jsx');
const tooltip = readRepo('client/src/components/creator-next/Tooltip.jsx');
const adapter = readRepo('client/src/components/creator-next/speciesAdapter.js');

let passed = 0, failed = 0;
function group(name) { console.log('== ' + name + ' =='); }
function ok(cond, msg) {
  try { assert(cond, msg); passed++; }
  catch (e) { failed++; console.error('FAIL:', msg, '|', e.message); }
}
function creatorFiles() {
  const out = [];
  for (const dir of ['client/src/components/creator-next', 'client/src/components/creator']) {
    for (const f of fs.readdirSync(path.join(REPO, dir)).filter(x => x.endsWith('.jsx') || x.endsWith('.js'))) {
      out.push([`${dir}/${f}`, fs.readFileSync(path.join(REPO, dir, f), 'utf8')]);
    }
  }
  return out;
}

// --- #3: one tooltip layer -------------------------------------------------
group('#3 double tooltip — custom bubble only');
{
  ok(!tooltip.includes('title={text}'), 'Tip button carries no native title= (the duplicate layer is gone)');
  ok(tooltip.includes('aria-label={label}'), 'Tip button keeps its aria-label');
  ok(tooltip.includes('role="tooltip"'), 'Tip button keeps its custom bubble');
}

// --- #1: silent resume restore --------------------------------------------
group('#1 resumed-draft wording — silent restore');
{
  ok(!shell.includes('Resumed draft #'), 'no "Resumed draft #" notice reaches the player');
  ok(!shell.includes('Resuming draft #'), 'no "Resuming draft #" notice reaches the player');
  ok(!shell.includes('(character ${characterId})'), 'the Stage 1-done notice names no character number');
  // The only "server row" hits left are developer comments, never JSX.
  const jsxLines = shell.split('\n').filter(l => l.includes('server row') && !l.trim().startsWith('*') && !l.trim().startsWith('//'));
  ok(jsxLines.length === 0, `no "server row" in JSX/code lines (found ${jsxLines.length})`);
}

// --- #16: scroll to top ----------------------------------------------------
group('#16 scroll to top on advance');
{
  ok((shell.match(/window\.scrollTo\(0, 0\)/g) || []).length >= 3, 'window.scrollTo(0, 0) is called on advance, back, and jumps');
  ok(shell.includes('const advance = ()'), 'next() advances through one advance() helper that scrolls');
  ok(shell.includes('const jumpTo = (s)'), 'Stepper/Review jumps go through one jumpTo() helper that scrolls');
  ok(shell.includes('setStep={jumpTo}'), 'the Stepper jumps through jumpTo (scrolls)');
  ok(shell.includes('onJump={jumpTo}'), 'Review jumps through jumpTo (scrolls)');
}

// --- #2: interim note deleted ----------------------------------------------
group('#2 species-list interim note — deleted');
{
  ok(!adapter.includes('INTERIM_SPECIES_NOTE'), 'speciesAdapter no longer defines INTERIM_SPECIES_NOTE');
  ok(!stage1.includes('INTERIM_SPECIES_NOTE'), 'Stage 1 no longer references the interim note');
  ok(!stage1.includes('Species list is interim'), 'the interim note text is gone from Stage 1');
}

// --- #6: one term ----------------------------------------------------------
group('#6 "heritage gift" → "ancestry feats"');
{
  // Comments quote old copy (CelebrationCard.jsx documents the opening
  // strings callers pass); #6 renamed the player-facing term, so the
  // scan reads code/JSX text, not comments.
  const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|\n)[ \t]*\/\/[^\n]*/g, '$1');
  for (const [name, src] of creatorFiles()) {
    ok(!/heritage gift/i.test(stripComments(src)), `${name} contains no "heritage gift"`);
  }
  ok(stage1.includes('Choose an ancestry feat…'), 'Stage 1 picker placeholder says "Choose an ancestry feat…"');
  ok(stage1.includes('An ancestry feat — a small mechanical advantage'), 'Stage 1 Ancestry feat Tip uses the one term');
}

// --- #4: arrival prompt hidden for FR-born ----------------------------------
group('#4 arrival prompt hidden for FR-born');
{
  ok(stage1.includes('{outsideFR && ('), 'the arrival Field renders only when outsideFR');
  ok(stage1.includes('How did you come to be in the Forgotten Realms?'), 'the arrival prompt still exists for outside-FR characters');
  ok(!stage1.includes('Optional for Realms-born characters.'), 'the FR-born optional note is gone with the always-rendered Field');
  ok(!stage1.includes('Anything worth knowing about where you come from.'), 'the FR-born free-text fallback is gone');
  ok(isOutsideFR('Forgotten Realms') === false, 'isOutsideFR: Forgotten Realms is not outside');
  ok(isOutsideFR('Eberron') === true, 'isOutsideFR: Eberron is outside');
  ok(isOutsideFR('') === true, 'isOutsideFR: no setting yet counts as outside');
  ok(isOutsideFR('__other__') === true, 'isOutsideFR: Other counts as outside');
}

// --- #7 + #8: class screen (ROUND 2, R2-7: banner deleted) ----------------
// R2-7 deleted the deferred-classes banner above the picker; the
// gray-out itself stays (disabled options + server refusal) and the
// explanation is one clause in the existing Class Tip.
group('#7 deferred banner deleted, Tip clause carries it; #8 helper rewrite');
{
  ok(!stage2.includes('deferredClasses.map(c => c.name).join'), 'the deferred-classes banner is gone');
  ok(!stage2.includes('not available for player characters yet'), 'the banner text is gone with it');
  ok(stage2.includes("Some classes are coming after the MVP and can't be picked yet."), 'the Class Tip carries the gray-out clause');
  ok(stage2.includes('disabled={c.pcCreatable === false}'), 'the gray-out itself stays (disabled options)');
  ok(!stage2.includes('Quick Build'), 'the class-screen helper no longer mentions Quick Build');
  ok(stage2.includes('Nothing here is pre-picked'), 'the rewritten helper keeps the no-pre-pick rule');
}

// --- #9: Quick Build gone -----------------------------------------------------
group('#9 Quick Build removed — complete');
{
  for (const [name, src] of creatorFiles()) {
    ok(!src.includes('Quick Build'), `${name} contains no "Quick Build"`);
    ok(!src.includes('quickBuild'), `${name} contains no "quickBuild"`);
  }
  ok(!stage2.includes('Use recommended'), 'Stage 2 has no "Use recommended" button');
  ok(!stage3.includes('Use recommended'), 'Stage 3 has no "Use recommended" button');
  ok(!stage4.includes('Use recommended'), 'Stage 4 has no "Use recommended" button');
}

// --- #10: god picker ------------------------------------------------------------
group('#10 god picker on Stage 2 (cleric/paladin)');
{
  const entries = Object.values(deities);
  ok(entries.length === 55, `deities.json carries 55 entries (got ${entries.length})`);
  const faerunian = entries.filter(d => d.pantheon === 'Faerûnian');
  ok(faerunian.length === 35, `the Faerûnian pantheon is ${faerunian.length} entries (derived from deities.json)`);
  ok(entries.filter(d => d.pantheon === 'Exandrian').length === 8, 'the Exandrian pantheon is 8 entries (derived)');
  ok(entries.filter(d => d.pantheon === 'Greyhawk').length === 2, 'the Greyhawk pantheon is 2 entries (derived)');
  ok(stage2.includes('SETTING_PANTHEONS'), 'Stage 2 maps origin settings to their own pantheon');
  ok(stage2.includes("Exandria: 'Exandrian'") && stage2.includes("Greyhawk: 'Greyhawk'"), 'Exandria/Greyhawk offer their own pantheon; everything else falls back to Faerûnian');
  ok(stage2.includes('id="stage2-faith"'), 'Stage 2 renders a Faith select');
  ok(stage2.includes("classId === 'cleric' || classId === 'paladin'"), 'the god picker shows for cleric/paladin only');
  ok(stage2.includes("d?.pantheon === godPantheon"), 'the god options filter by the setting pantheon');
  ok(stage2.includes("value={state.faith || ''}"), 'the picker binds the shared state.faith field (same as Stage 5)');
  ok(resolveOriginSetting('__other__', 'Exandria') === 'Exandria', 'a custom-typed Exandria setting resolves for the pantheon rule');
}

// --- #11: pact picker -------------------------------------------------------------
group('#11 pact picker on Stage 2 (warlock)');
{
  ok(stage2.includes('PACT_BOONS'), 'Stage 2 defines the pact list');
  for (const name of ['Pact of the Blade', 'Pact of the Chain', 'Pact of the Tome']) {
    ok(stage2.includes(name), `Stage 2 offers ${name}`);
  }
  // The header comment names Talisman only to document the exclusion;
  // the pin is that no Talisman OPTION value exists.
  ok(!stage2.includes("'Pact of the Talisman'"), 'no Pact of the Talisman option — 2014-only, not built');
  ok(stage2.includes('id="stage2-pact-boon"'), 'Stage 2 renders a Pact select');
  ok(stage2.includes("classId === 'warlock'"), 'the pact picker shows for warlock only');
  ok(stage2.includes("value={state.pactBoon || ''}"), 'the picker binds state.pactBoon');
  ok(blankStage1State().pactBoon === '', 'blank state carries pactBoon: "" (never defaulted)');
  const body = buildStage1ProgressBody({ pactBoon: 'Pact of the Blade' });
  ok(body.pact_boon === 'Pact of the Blade', 'the save body sends pact_boon');
  const patch = rehydrateStateFromServerRow({ pact_boon: 'Pact of the Chain' }, null);
  ok(patch.pactBoon === 'Pact of the Chain', 'rehydration reads pact_boon back into state.pactBoon');
  const faithPatch = rehydrateStateFromServerRow({ faith: 'Tymora' }, null);
  ok(faithPatch.faith === 'Tymora', 'rehydration reads faith back (Stage 2 god pick survives a mirror-less resume)');
}

// --- #5 follow-up: resume prefers the stored feat_id ----------------------------------
// The server snapshot now carries caf.feat_id (creator test-notes #5
// server half). The real rehydrateFromServerCharacter runs here with
// only the network boundary stubbed (global fetch); the resolution
// logic is the module's own. The "no name lookup" assert is the
// mutation check: deleting the feat_id-first branch re-fetches the
// list endpoint and fails it.
group('#5 follow-up — resume prefers stored feat_id, name-match as fallback');
{
  const realFetch = globalThis.fetch;
  const calls = [];
  const stubFetch = (handlers) => {
    calls.length = 0;
    globalThis.fetch = async (url) => {
      calls.push(String(url));
      const hit = handlers.find(([re]) => re.test(String(url)));
      if (!hit) return { ok: false };
      return { ok: true, json: async () => hit[1] };
    };
  };
  try {
    // (a) Stored feat_id resolves with NO name lookup.
    stubFetch([
      [/\/api\/character\/1203$/, {}],
      [/\/api\/character\/1203\/progression$/, { ancestry_feats: [{ tier: 1, feat_id: 42, list_id: 'elf', feat_name: 'Elven Accuracy' }] }],
    ]);
    const withId = await rehydrateFromServerCharacter(1203);
    ok(withId.patch.ancestry_feat_id === 42, 'stored feat_id resolves the resume pick directly');
    ok(!calls.some(u => u.includes('/ancestry-feats/')), 'no name lookup runs when feat_id is stored');
    // (b) feat_id absent → the exact name-match fallback still works.
    stubFetch([
      [/\/api\/character\/1203$/, {}],
      [/\/api\/character\/1203\/progression$/, { ancestry_feats: [{ tier: 1, list_id: 'elf', feat_name: 'Elven Accuracy' }] }],
      [/\/api\/progression\/ancestry-feats\/elf/, [{ id: 7, feat_name: 'Elven Accuracy' }, { id: 8, feat_name: 'Other Feat' }]],
    ]);
    const byName = await rehydrateFromServerCharacter(1203);
    ok(byName.patch.ancestry_feat_id === 7, 'name-match fallback still resolves when feat_id is absent');
    ok(calls.some(u => u.includes('/ancestry-feats/elf')), 'fallback actually consults the list endpoint');
    // (c) No side-table row at all → nothing invented; that draft needs a re-pick.
    stubFetch([
      [/\/api\/character\/1203$/, {}],
      [/\/api\/character\/1203\/progression$/, { ancestry_feats: [] }],
    ]);
    const none = await rehydrateFromServerCharacter(1203);
    ok(none.patch.ancestry_feat_id == null, 'no side-table row → no id invented (draft needs a re-pick)');
    ok(!calls.some(u => u.includes('/ancestry-feats/')), 'no name lookup runs with no row at all');
    // (d) Server unreachable → blank resume, never throws.
    globalThis.fetch = async () => { throw new Error('down'); };
    const down = await rehydrateFromServerCharacter(1203);
    ok(down.restored === false && Object.keys(down.patch).length === 0, 'unreachable server still returns a blank resume, never throws');
  } finally {
    globalThis.fetch = realFetch;
  }
}

// --- #12: subclass description + follow-up origin suffix -------------------------------
// REVERSAL of the client worker's #12 decision ("never the origin
// suffix"): the server worker proved the requirement is otherwise
// invisible at pick time — Stage 2 showed no suffix for null-origin
// entries and validateSelection has no callers in the creator flow.
// The suffix now renders AFTER the description, only for non-FR/null
// origins. Description rendering is untouched.
group('#12 subclass description + follow-up origin suffix');
{
  ok(stage2.includes('subclassEntry.description'), 'Stage 2 renders subclassEntry.description');
  ok(stage2.includes("from './subclassOrigin.js'"), 'Stage 2 imports the origin-suffix helper');
  ok(stage2.includes('{subclassOriginSuffix(subclassEntry)}'), 'Stage 2 renders the suffix after the description');
  ok(stage2.includes("takes effect at level {cls?.subclassLevel"), 'the name + level line stays when no description is present');
  // Behavioral pins on the real helper (no logic re-implemented):
  ok(subclassOriginSuffix({ origin_setting: 'Forgotten Realms' }) === '', 'FR entry: no suffix');
  ok(subclassOriginSuffix({ origin_setting: null }) === ' · origin unspecified setting — an origin explanation is required for how its holder came to be in the Forgotten Realms',
    'null origin: suffix reads "unspecified setting"');
  ok(subclassOriginSuffix({}) === ' · origin unspecified setting — an origin explanation is required for how its holder came to be in the Forgotten Realms',
    'missing origin field: same null treatment (fail-closed, like isOutsideFr)');
  ok(subclassOriginSuffix({ origin_setting: 'Eberron', origin_region: 'Khorvaire' }) === ' · origin Eberron (Khorvaire) — an origin explanation is required for how its holder came to be in the Forgotten Realms',
    'named non-FR origin: setting + region');
  ok(subclassOriginSuffix({ origin_setting: 'KibblesTasty (setting-neutral)', origin_region: 'KibblesTasty (setting-neutral)' }) === ' · origin KibblesTasty (setting-neutral) — an origin explanation is required for how its holder came to be in the Forgotten Realms',
    'region equal to setting is not repeated (Warlord doubling fixed)');
  ok(subclassOriginSuffix(null) === '', 'null entry: no suffix, never throws');
}

// --- #13/#18/#19: shared checkbox-row style -------------------------------------------
group('#13/#18/#19 shared checkbox-row style + skill descriptions');
{
  for (const [name, src] of [['Stage2', stage2], ['Stage3', stage3], ['Stage4', stage4]]) {
    ok(src.includes("display: 'flex'") && src.includes("alignItems: 'center'"), `${name} defines a flex checkbox-row style`);
    ok(src.includes("flex: '0 0 auto'"), `${name} keeps the checkbox fixed-width (flex 0 0 auto)`);
  }
  ok(stage4.includes('checkStyleTop'), 'Stage 4 spell rows use the flex-start variant for multi-line rows');
  ok(!stage4.includes('marginLeft: 22'), 'no marginLeft:22 description indent remains (descriptions live in the text wrapper)');
  ok(stage4.includes('SKILLS[k]?.description'), 'Stage 4 skill rows render the skill description');
  ok(stage2.includes('style={checkRowStyle}'), 'Stage 2 cantrip/multi-choice labels use the shared row style');
  const skillKeys = Object.keys(SKILLS);
  ok(skillKeys.length === 18, `references.js carries 18 skills (got ${skillKeys.length})`);
  ok(skillKeys.every(k => typeof SKILLS[k]?.description === 'string' && SKILLS[k].description.length > 0),
    'every skill carries a one-sentence description');
  ok(typeof lookupReference('skill', 'animal_handling') === 'string'
    && lookupReference('skill', 'animal_handling').length > 0,
    'lookupReference resolves the animal_handling description');
}

// --- #15: theme previews ----------------------------------------------------------------
group('#15 theme previews — per-theme expandable');
{
  ok(Array.isArray(THEMES) && THEMES.length === 21, `themes.js carries 21 themes (got ${THEMES?.length})`);
  const tiersOk = THEMES.every(t => [1, 5, 11, 17].every(tier => (t.abilities || []).some(a => a?.tier === tier)));
  ok(tiersOk, 'every theme carries all four tier abilities (1/5/11/17, derived from themes.js)');
  ok(stage3.includes('Full theme preview'), 'Stage 3 renders a full-theme preview');
  ok(stage3.includes('[1, 5, 11, 17]'), 'the preview covers all four tiers');
  ok(stage3.includes('themeAbilities'), 'the preview reads the served theme abilities, sorted by tier');
  ok(stage3.includes('Also in this package:'), 'the preview summarizes feat + ASI + skills + gold');
}

// --- #17: traits as bullets ----------------------------------------------------------------
group('#17 traits as bullets');
{
  ok(!stage4.includes("Traits: {speciesTraits.join('; ')}"), 'the semicolon traits paragraph is gone');
  ok(stage4.includes('speciesTraits.map(t => (<li'), 'Stage 4 renders traits as <li> items');
}

console.log(`\ncreator-test-notes-1-client: ${passed} passed, ${failed} failed`);
process.exitCode = failed ? 1 : 0;
