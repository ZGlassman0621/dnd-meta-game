// tests/creator-test-notes-2-client.test.js — creator test-notes
// ROUND 2 (Zach's 2026-11-09 notes), CLIENT items.
//
// Honest integration tests: every behavior pin calls the REAL module
// or reads the REAL stage source the browser renders. No logic is
// re-implemented — if a service file were deleted, these imports fail
// and the suite fails with it. Registry totals are derived from the
// source itself, never hardcoded as the behavior under test (the
// 18-language count is asserted from the LANGUAGES object the picker
// reads; the Eberron/Realms region counts from originSettings.js).
//
// Plain node cannot import .jsx, so the .jsx helpers
// (fightingStyleByName / fightingStyleGate, spellDescriptionFor,
// deriveLevel1Stats) are called from REAL esbuild bundles of the
// staged files — the repo's own pattern (tests/creator-next-stage4.
// test.js group (k)): React is stubbed (hooks only; the component is
// never rendered), so the bundle proves every import resolves and the
// helpers are the component's own code, not a re-implementation.
// esbuild is found at client/node_modules/.bin/esbuild, then
// node_modules/.bin/esbuild, else npx --yes esbuild.
//
// Pure client + data only: no database is touched, so this runs with
// plain `node tests/creator-test-notes-2-client.test.js`.
//
// Coverage, by round-2 item:
//   R2-1 unavailable-parents line deleted, R2-2 flex rows (Stage 1
//   mixed traits + Stage 5 equipment), R2-3 power-budget explanation
//   at the top, R2-4 size never changes speed (no slider), R2-5 mixed
//   Versatile aligned with the single-human rule, R2-6 internal-line
//   sweep + INVARIANT (no player-facing dev-marker strings),
//   R2-7 deferred banner deleted + Tip clause, R2-8 fighting-style
//   effects, R2-9 Pact Boon label + warlock patron line, R2-11(a)
//   Magic Initiate spell descriptions, R2-11(b)-(g) generic
//   path-choice render + origin regions + Soldier second field,
//   R2-12 equipment layout (with R2-2/R2-6), R2-13 HP display,
//   R2-14 inline story descriptions + personality guide, R2-15
//   language picker.

import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');
const svc = (rel) => pathToFileURL(path.join(REPO, rel)).href;
const readRepo = (rel) => fs.readFileSync(path.join(REPO, rel), 'utf8');

const { LANGUAGES, concreteLanguages, isChoiceLanguage, languageChoiceCount } = await import(svc('client/src/data/references.js'));
const { blankStage1State, buildStage1ProgressBody, rehydrateStateFromServerRow, rehydrateFromServerCharacter } = await import(svc('client/src/components/creator-next/stage1Persistence.js'));
const { versatileThemeConflict } = await import(svc('client/src/components/creator-next/mixedAncestry.js'));
const { regionsForSetting } = await import(svc('client/src/data/originSettings.js'));
const { isOutsideFR } = await import(svc('client/src/components/creator-next/speciesAdapter.js'));

const stage1 = readRepo('client/src/components/creator-next/Stage1OriginIdentity.jsx');
const stage2 = readRepo('client/src/components/creator-next/Stage2ClassCalling.jsx');
const stage3 = readRepo('client/src/components/creator-next/Stage3PastPath.jsx');
const stage4 = readRepo('client/src/components/creator-next/Stage4AbilitiesSkillsSpells.jsx');
const stage5 = readRepo('client/src/components/creator-next/Stage5GearStory.jsx');
const stage6 = readRepo('client/src/components/creator-next/Stage6ReviewCommit.jsx');
const shell = readRepo('client/src/components/creator-next/CreatorNextShell.jsx');

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
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|\n)[ \t]*\/\/[^\n]*/g, '$1');

// --- Real esbuild bundles of the staged .jsx files (group (k) pattern) -----
// React is stubbed (hooks only; no component is ever rendered), so the
// bundle proves every import resolves and the helpers called below are
// the stages' own exported functions.
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'creator-test-notes-2-'));
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
    path.join(REPO, 'client', 'node_modules', '.bin', 'esbuild'),
    path.join(REPO, 'node_modules', '.bin', 'esbuild'),
  ];
  for (const c of cands) if (fs.existsSync(c)) return { bin: c, prefix: [] };
  return { bin: 'npx', prefix: ['--yes', 'esbuild'] };
}
function bundle(entryRel, outName) {
  const { bin, prefix } = findEsbuild();
  const out = path.join(tmpDir, outName);
  execFileSync(bin, [...prefix, path.join(REPO, entryRel), '--bundle', '--format=esm', `--outfile=${out}`, `--alias:react=${stubPath}`, '--log-level=warning'], { stdio: 'pipe' });
  return out;
}
let stage2Mod = null, stage3Mod = null, stage5Mod = null;
let bundleErrors = [];
for (const [entry, outName, key] of [
  ['client/src/components/creator-next/Stage2ClassCalling.jsx', 'stage2.bundle.mjs', 'stage2'],
  ['client/src/components/creator-next/Stage3PastPath.jsx', 'stage3.bundle.mjs', 'stage3'],
  ['client/src/components/creator-next/Stage5GearStory.jsx', 'stage5.bundle.mjs', 'stage5'],
]) {
  try {
    const out = bundle(entry, outName);
    if (!(fs.existsSync(out) && fs.statSync(out).size > 1000)) throw new Error('bundle too small');
    const mod = await import(pathToFileURL(out).href);
    if (key === 'stage2') stage2Mod = mod;
    if (key === 'stage3') stage3Mod = mod;
    if (key === 'stage5') stage5Mod = mod;
  } catch (e) {
    bundleErrors.push(`${entry}: ${e.message}`);
  }
}

// --- R2-1: unavailable-parents line deleted ---------------------------------
group('R2-1 unavailable-parents line deleted, per-option text stays');
{
  ok(!stage1.includes('Not available as a parent yet'), 'the "Not available as a parent yet" div is gone');
  ok(stage1.includes('${t.name} — ${t.unavailableReason}'), 'the per-option disabled text still names the reason');
  ok(stage1.includes('t.available === false'), 'the options still disable unavailable parents');
}

// --- R2-2: flex rows ---------------------------------------------------------
group('R2-2 flex rows — Stage 1 mixed traits + Stage 5 equipment');
{
  // Stage 1 mixed-ancestry trait label: flex row, checkbox fixed-width.
  const traitLabel = stage1.slice(stage1.indexOf('table.traits.map'), stage1.indexOf('Power budget:'));
  ok(traitLabel.includes("display: 'flex'") && traitLabel.includes("alignItems: 'center'"), 'mixed trait labels are flex rows');
  ok(traitLabel.includes("flex: '0 0 auto'"), 'mixed trait checkboxes are fixed-width');
  ok(!traitLabel.includes("display: 'block'"), 'no block trait label remains in the mixed section');
  // Darkvision downgrade row: indent on the wrapper, flex on the label.
  ok(stage1.includes("marginLeft: 24"), 'the downgrade row keeps its indent on the wrapper');
  ok(stage1.includes('Take as 60 ft darkvision instead (cost 1, not 2)'), 'the downgrade row text is unchanged');
  // Forgo-trade row: flex.
  const forgoAt = stage1.indexOf('Forgo the theme origin feat for +4 power budget');
  ok(stage1.slice(Math.max(0, forgoAt - 600), forgoAt).includes("display: 'flex'"), 'the forgo-trade row is a flex row');
  // Stage 5: checkStyle is the flex row; radios carry the fixed-width style.
  ok(stage5.includes("const checkStyle = { display: 'flex', alignItems: 'center', gap: 8"), 'Stage 5 checkStyle is the flex row');
  ok(stage5.includes('checkInputStyle'), 'Stage 5 defines the fixed-width input style');
  ok((stage5.match(/style=\{checkInputStyle\}/g) || []).length >= 3, 'package radios + sub-option radios carry the fixed-width style');
  // Holy Symbol sub-options: indent on the group container, not per-label margins.
  ok(stage5.includes('<div role="group" aria-label={parsed.label} style={{ marginLeft: 12 }}>'), 'the sub-option indent lives on the group container');
  ok(!stage5.includes('{...checkStyle, marginLeft: 12}'), 'no per-label marginLeft:12 remains on sub-options');
  // Shot 2 cantrips were ALREADY fixed in live source (round-1 push) —
  // verify the flex row is present, do not rebuild. Visual confirmation
  // is for Zach's retest on a fresh build, not claimed here.
  ok(stage2.includes('style={checkRowStyle}'), 'Stage 2 cantrip rows still use the flex row (already fixed, verified only)');
  ok(stage2.includes("flex: '0 0 auto'"), 'Stage 2 checkboxes stay fixed-width');
}

// --- R2-3: power-budget explanation at the top --------------------------------
group('R2-3 power-budget explanation at the top of Mixed Ancestry');
{
  const expl = 'You have 7 points to spend across both parents&apos; traits.';
  ok(stage1.includes(expl), 'the top explanation states the 7-point budget in plain terms');
  ok(stage1.includes('Each trait costs the points shown next to it'), 'the explanation defines the per-trait cost');
  ok(stage1.includes('You can spend up to 11 if you give up your theme&apos;s origin feat (below)'), 'the explanation states the 11-point trade');
  const explAt = stage1.indexOf(expl);
  const firstParentAt = stage1.indexOf('First parent');
  ok(explAt !== -1 && firstParentAt !== -1 && explAt < firstParentAt, 'the explanation sits BEFORE the first parent picker');
  ok(stage1.includes('— {tr.cost} power'), 'the per-trait "— N powers —" labels stay');
  ok(stage1.includes('Power budget:'), 'the bottom budget line stays');
}

// --- R2-4: size never changes speed, no slider ----------------------------------
group('R2-4 size never changes speed — explanation, not a slider');
{
  ok(stage1.includes('Size never changes your speed.'), 'the top explanation states size never changes speed');
  ok(stage1.includes('Speed: {mixedSpeed(mixedRecord, mixedTableList)} ft'), 'the mixed speed line still renders');
  const speedAt = stage1.indexOf('Speed: {mixedSpeed(mixedRecord, mixedTableList)} ft');
  ok(stage1.slice(speedAt, speedAt + 300).includes('Size never changes your speed.'), 'the speed line itself states it');
  ok(stage1.includes('Size never changes your speed. Locked at creation.'), 'the mixed Size Tip states it');
  ok(stage1.includes('It never changes your speed.'), 'the single-species Size Tip states it');
  ok(!stage5.includes('type="range"'), 'no height slider exists on Stage 5 (height stays free text)');
  ok(stage5.includes("textField('height', 'Height'"), 'height is still a free-text flavor field');
}

// --- R2-5: mixed Versatile aligned ----------------------------------------------
group('R2-5 mixed Versatile aligned with the single-human rule');
{
  // The real helper (no logic re-implemented): same feat conflicts,
  // different feat does not, missing feat never conflicts.
  ok(typeof versatileThemeConflict('Lucky', 'lucky') === 'string', 'versatileThemeConflict: same feat (any case) conflicts');
  ok(versatileThemeConflict('Lucky', 'Tough') === null, 'versatileThemeConflict: different feats do not conflict');
  ok(versatileThemeConflict('', 'lucky') === null, 'versatileThemeConflict: no pick never conflicts');
  ok(versatileThemeConflict('Lucky', '') === null, 'versatileThemeConflict: no theme feat never conflicts');
  // The mixed exemption is gone from the Tip and the checks read both slots.
  ok(!stage1.includes('does not need to differ from your theme'), 'the mixed Tip no longer exempts the duplicate');
  ok(stage1.includes('like that pick it must differ from your theme'), 'the mixed Tip states the aligned rule');
  ok(stage3.includes('state.mixedAncestry?.versatileFeat'), 'Stage 3 reads the mixed Versatile pick too');
  ok(stage3.includes('versatileThemeConflict(state.mixedAncestry?.versatileFeat, featKey)'), 'Stage 3 judges the mixed slot with the shared helper');
  ok(shell.includes('versatileThemeConflict(state.mixedAncestry?.versatileFeat, state.originFeat)'), 'the shell save gate judges the mixed slot too');
  ok(stage1.includes('versatileThemeConflict(f.key, state.originFeat)'), 'the mixed dropdown grays out the theme feat');
}

// --- R2-6: sweep + INVARIANT ------------------------------------------------------
group('R2-6 internal-line sweep — named removals + rewrites');
{
  // S1 + S2: the two named removals. (S1's wording survives only in a
  // header comment — comments are not player-facing, so the check
  // strips them; the INVARIANT group below pins the same rule.)
  ok(!stripComments(stage2).includes('Blood hunter names a fighting style'), 'S1 blood-hunter line deleted');
  ok(!stage5.includes('Display only: the theme modifier is a client number'), 'S2 gold-fork line deleted');
  // S3–S17: the rewrites, one short player-facing sentence each.
  // (JSX text spells the apostrophe as &apos;; JS string literals as \'.)
  ok(stage2.includes("Couldn&apos;t load the subclass list"), 'S3 subclass list rewrite');
  ok(stage2.includes('No subclasses listed for'), 'S4 no-registry-entry rewrite');
  ok(stage2.includes("Couldn\\'t load the fighting-style list"), 'S5 fighting-style rewrite');
  ok(stage2.includes("Couldn\\'t load the cantrip list"), 'S6 cantrip rewrite');
  ok(stage2.includes('No cantrips listed for this class yet.'), 'S7 no-cantrips rewrite');
  ok(stage2.includes('it will appear here once it is added.'), 'S8 subclass-grants rewrite');
  ok(stage3.includes("Couldn&apos;t load the theme list"), 'S9 theme list rewrite');
  ok(stage3.includes('no description listed for this feat yet.'), 'S10 feat-effect rewrite');
  ok(stage4.includes("Couldn&apos;t load the spell list"), 'S11 spell list rewrite');
  ok(stage4.includes('Showing the built-in spell list while the server is unreachable'), 'S12 bundled-catalog rewrite');
  ok(stage5.includes("Couldn&apos;t load the starting packages"), 'S13 packages rewrite');
  ok(stage1.includes("Couldn&apos;t load the Mixed Ancestry trait tables"), 'S14 trait-tables rewrite');
  ok(stage1.includes("doesn&apos;t say which base traits this variant replaces"), 'S15 variant-replaces rewrite');
  ok(shell.includes("Couldn&apos;t reach the server"), 'S16 shell banner rewrite');
  ok(stage6.includes('No traits listed for this species yet.'), 'S17 traits rewrite');
  // Borderline "served / none served" phrasing, in plain terms.
  ok(stage4.includes("Theme increase: ${formatAsi(themeASI) || 'not listed yet'}"), 'Stage 4 theme-increase phrasing rewritten');
  ok(stage4.includes('No signature skills listed for this theme yet.'), 'Stage 4 signature-skills phrasing rewritten');
  ok(stage4.includes("Languages: {speciesLanguages.length ? speciesLanguages.join(', ') : 'no languages listed'}"), 'Stage 4 languages phrasing rewritten');
  ok(stage6.includes("no languages listed'}. A language already known"), 'Stage 6 species-languages phrasing rewritten');
  // No "Start the server / npm run dev" instruction reaches the player.
  ok(!stage2.includes('Start the server') && !stage5.includes('Start the server') && !shell.includes('Start the server'), 'no "Start the server" instruction in any creator stage');
  ok(!stage2.includes('npm run dev') && !stage5.includes('npm run dev') && !shell.includes('npm run dev'), 'no "npm run dev" instruction in any creator stage');
}

group('R2-6 INVARIANT — no player-facing dev-marker strings');
{
  // Pin the invariant, not a list of individual strings: strip code
  // comments (they are not player-facing) and assert NO creator
  // source renders an internal/dev-marker string. A new dev string
  // added to any stage fails this group until it is rewritten.
  const markers = [
    'not reachable', 'Start the server', 'npm run dev', 'not served', 'none served',
    'nothing is invented', 'not invented', 'no list is shown rather than', 'in the mirror',
    'registry truth', 'registry gap', 'Display only', 'server is authoritative',
    'legacy species list', 'legacy list', 'server row', 'Not available as a parent yet',
    'Blood hunter names a fighting style', 'does not need to differ',
    'effect text not served', 'No traits served', 'No cantrips were served',
    'No signature skills served', 'Showing the bundled spell catalog',
    'subclass registry is not reachable', 'theme registry is not reachable',
    'spell list is not reachable', 'trait tables could not be loaded',
    'does not record which base traits', 'server subclass registry',
    'server theme registry', 'server spell list', 'could not be loaded from the server',
    'not available for player characters yet', 'No subclass list is shown',
    'No theme list is shown', 'No spell list is shown', 'No package is shown here',
    'starting packages are unavailable', 'Subclasses and themes are unavailable',
  ];
  for (const [name, src] of creatorFiles()) {
    const code = stripComments(src);
    for (const m of markers) {
      ok(!code.includes(m), `${name} renders no "${m}"`);
    }
  }
}

// --- R2-7: deferred banner deleted --------------------------------------------------
group('R2-7 deferred-classes banner deleted, Tip clause carries it');
{
  ok(!stage2.includes('deferredClasses.map(c => c.name).join'), 'the banner is gone');
  ok(!stage2.includes('not available for player characters yet'), 'the banner text is gone with it');
  ok(stage2.includes("Some classes are coming after the MVP and can't be picked yet."), 'the Class Tip carries the gray-out clause');
  ok(stage2.includes('disabled={c.pcCreatable === false}'), 'the gray-out itself stays (disabled options)');
}

// --- R2-8: fighting-style effects (bundled Stage 2) ----------------------------------
group('R2-8 fighting-style effects render from the fetched objects');
{
  ok(bundleErrors.length === 0, `Stage 2/3/5 bundles built (${bundleErrors.join('; ') || 'no errors'})`);
  ok(stage2Mod !== null && typeof stage2Mod.default === 'function', 'bundled Stage 2 default export is the component');
  const { fightingStyleByName, fightingStyleGate } = stage2Mod || {};
  // The real lookup (no logic re-implemented): case-insensitive,
  // null when the list has not loaded or names nothing.
  const styles = [
    { key: 'archery', name: 'Archery', effect: '+2 to attack rolls with ranged weapons' },
    { key: 'defense', name: 'Defense', effect: '+1 AC while wearing armor' },
  ];
  ok(fightingStyleByName(styles, 'Archery')?.effect === '+2 to attack rolls with ranged weapons', 'bundled fightingStyleByName finds the effect by name');
  ok(fightingStyleByName(styles, 'defense')?.name === 'Defense', 'bundled fightingStyleByName matches case-insensitively');
  ok(fightingStyleByName(styles, 'Protection') === null, 'bundled fightingStyleByName returns null for a style not in the list');
  ok(fightingStyleByName(null, 'Archery') === null, 'bundled fightingStyleByName returns null before the list loads');
  // The client keeps the full objects (no names-only mapping) and
  // renders the picked style's effect under the select.
  ok(!stage2.includes('d.fightingStyles.map(f => f?.name)'), 'the fetch no longer maps to names only');
  ok(stage2.includes('d.fightingStyles.filter(f => f?.name)'), 'the fetch keeps the full style objects');
  ok(stage2.includes('fightingStyleByName(styleOptions, state.fightingStyle)'), 'the picked style is looked up in the fetched objects');
  ok(stage2.includes('selectedStyle?.effect'), 'the picked style effect renders under the select');
  ok(stage2.includes('fightingStyleNames.map'), 'the select renders names from objects or the Swords pair');
  // The gate itself is unchanged: fighter L1, paladin/ranger L2+.
  ok(fightingStyleGate({ classId: 'fighter', styleOptions: styles }).offersFightingStyle === true, 'bundled gate: fighter is offered a style at L1');
  ok(fightingStyleGate({ classId: 'paladin', characterLevel: 1, styleOptions: styles }).offersFightingStyle === false, 'bundled gate: paladin is not offered a style at L1');
  ok(fightingStyleGate({ classId: 'paladin', characterLevel: 2, styleOptions: styles }).offersFightingStyle === true, 'bundled gate: paladin is offered a style at class level 2');
}

// --- R2-9: Pact Boon label + warlock patron line ------------------------------------------
group('R2-9 Pact Boon label + warlock patron line');
{
  ok(stage2.includes('Pact Boon (Eldritch Invocation)'), 'the picker is labeled "Pact Boon (Eldritch Invocation)"');
  ok(stage2.includes('Choose a pact boon…'), 'the placeholder matches the new label');
  ok(!stage2.includes('>Pact<') && !stage2.includes('\n            Pact\n'), 'no bare "Pact" label remains');
  ok(stage2.includes('Your patron (subclass) — Archfey, Fiend, and the rest — is chosen at level 3.'), 'a warlock sees the patron line at level 3');
  ok(stage2.includes("classId === 'warlock' && subclassLevel === 3"), 'the patron line is warlock-only');
  ok(stage2.includes('You choose your subclass at level ${subclassLevel}'), 'the generic level line stays for other L3 classes');
  ok(stage2.includes("value={state.pactBoon || ''}"), 'the picker still binds state.pactBoon (no storage change)');
}

// --- R2-11(a): Magic Initiate spell descriptions (bundled Stage 3) --------------------------
group('R2-11(a) Magic Initiate spell descriptions render');
{
  ok(stage3Mod !== null && typeof stage3Mod.default === 'function', 'bundled Stage 3 default export is the component');
  const { spellDescriptionFor } = stage3Mod || {};
  // The real lookup over the bundled spells.json (no logic re-implemented).
  ok(spellDescriptionFor('Guidance').includes('roll a d4'), 'bundled spellDescriptionFor: Guidance describes the d4');
  ok(spellDescriptionFor('Alarm').includes('alarm alerts'), 'bundled spellDescriptionFor: Alarm describes the alarm');
  ok(spellDescriptionFor('alarm') === spellDescriptionFor('Alarm'), 'bundled spellDescriptionFor matches case-insensitively');
  ok(spellDescriptionFor('No Such Spell') === '', 'bundled spellDescriptionFor returns empty for an unknown name, never invented');
  ok(spellDescriptionFor('') === '', 'bundled spellDescriptionFor returns empty for a blank name');
  ok(stage3.includes('spellDescriptionFor(choices.spell)'), 'the picked level-1 spell description renders under the select');
  ok(stage3.includes('spellDescriptionFor(c)'), 'each picked cantrip description renders under the checkboxes');
}

// --- R2-11(b)-(g): generic path choice + origin regions + Soldier second field ----------------
group('R2-11(b)-(g) generic path choice, origin regions, Soldier second field');
{
  // The path-choice select renders creation_choice generically — no
  // per-theme switch: the new server entries (b)-(f) render through it.
  // Creation-solidification (2026-11-12): the location options/label
  // resolve in the shared themeLocation.js helper (also used by the
  // shell's stale-pick clear); Stage 3 renders what it returns.
  const themeLocationSrc = readRepo('client/src/components/creator-next/themeLocation.js');
  ok(stage3.includes('themeLocationOptions(theme, state)'), 'Stage 3 resolves location options through the shared helper');
  ok(themeLocationSrc.includes('theme?.creation_choice_options'), 'Stage 3 reads the served creation_choice_options (via themeLocation.js)');
  ok(themeLocationSrc.includes('theme?.creation_choice_label'), 'Stage 3 reads the served creation_choice_label (via themeLocation.js)');
  ok(stage3.includes('locationOptions.map'), 'Stage 3 renders the resolved location options');
  // Origin regions (g): the real region data, resolved client-side.
  const eberron = regionsForSetting('Eberron');
  ok(eberron.length === 22, `Eberron carries ${eberron.length} regions (derived from originSettings.js)`);
  ok(eberron.every(r => typeof r.name === 'string' && typeof r.description === 'string' && r.description.length > 0), 'every Eberron region carries a name + description');
  ok(regionsForSetting('Forgotten Realms').length === 46, 'the Realms carry 46 regions (derived)');
  ok(regionsForSetting('No Such Setting').length === 0, 'an unknown setting resolves to no regions (never invented)');
  // The real gate (no logic re-implemented): a non-FR origin IS
  // outside the Realms, an FR origin is not, an unset origin is.
  ok(isOutsideFR('Eberron') === true, 'isOutsideFR: Eberron is outside the Realms');
  ok(isOutsideFR('Forgotten Realms') === false, 'isOutsideFR: the Realms are not outside the Realms');
  ok(isOutsideFR('') === true, 'isOutsideFR: an unset origin counts as outside (served list kept)');
  ok(themeLocationSrc.includes("creation_choice_source === 'origin_regions'"), 'Stage 3 keys the region resolution on creation_choice_source (via themeLocation.js)');
  ok(themeLocationSrc.includes("&& originSetting && isOutsideFR(originSetting)"), 'Stage 3 offers regions exactly to non-FR origins (never FR cities as local)');
  ok(themeLocationSrc.includes("'Home Region'"), 'a non-FR origin labels the field "Home Region"');
  // Soldier second field (e): the SERVER shape — creation_choice_second_field
  // { key, label, options } — bound to path_data as a JSON string.
  // The old client-side two-part shape is struck (seam fix, 2026-11-09).
  ok(stage3.includes('theme?.creation_choice_second_field'), 'Stage 3 reads the second-field shape');
  ok(!stage3.includes('creation_choice_2_'), 'the struck two-part shape is gone from Stage 3');
  ok(stage3.includes('stage3-path-choice-2'), 'Stage 3 renders a second select');
  ok(stage3.includes('value={state.themePathData ||'), 'the second select binds state.themePathData');
  ok(stage3.includes("themePathData: ''"), 'picking a theme clears the second field with the first');
  ok(blankStage1State().themePathData === '', 'blank state carries themePathData: "" (never defaulted)');
  const soldierThemes = [{ id: 'soldier', creation_choice_second_field: { key: 'active_duty', label: 'Active Duty', options: [{ value: 'active', label: 'Still in active duty' }, { value: 'veteran', label: 'No longer in active duty' }] } }];
  const body2 = buildStage1ProgressBody({ themeId: 'soldier', themePathData: 'active' }, soldierThemes);
  ok(body2.theme_path_data === JSON.stringify({ active_duty: 'active' }), 'the save body sends theme_path_data as a JSON string keyed by the theme second-field key');
  const body2Fallback = buildStage1ProgressBody({ themeId: 'soldier', themePathData: 'veteran' });
  ok(body2Fallback.theme_path_data === JSON.stringify({ active_duty: 'veteran' }), 'without the themes list the body falls back to the active_duty key');
  const patch2 = rehydrateStateFromServerRow({}, { theme: { theme_id: 'soldier', path_choice: 'sergeant', path_data: JSON.stringify({ active_duty: 'active' }) } });
  ok(patch2.themePathChoice === 'sergeant', 'rehydration reads path_choice back');
  ok(patch2.themePathData === 'active', 'rehydration reads path_data back into themePathData as a string');
  const patch2Obj = rehydrateStateFromServerRow({}, { theme: { theme_id: 'soldier', path_choice: 'sergeant', path_data: { active_duty: 'veteran' } } });
  ok(patch2Obj.themePathData === 'veteran', 'rehydration also reads an already-parsed object path_data');
}

// --- R2-13: HP display (bundled Stage 5) ---------------------------------------------------------
group('R2-13 HP display — total, not the Con modifier');
{
  ok(stage5Mod !== null && typeof stage5Mod.default === 'function', 'bundled Stage 5 default export is the component');
  const { deriveLevel1Stats } = stage5Mod || {};
  // The real function (no logic re-implemented): HP = hit die + Con
  // mod, floored at 1; the note shows the sum, and the minimum-1
  // note only when the floor binds.
  const normal = deriveLevel1Stats({ hitDie: 8, conScore: 18, dexScore: 10, walkSpeed: 30 });
  ok(normal.hp === 12, 'bundled deriveLevel1Stats: 8 hit die + Con +4 is 12 HP');
  ok(normal.hpNote === '8 hit die + 4 Con modifier = 12', `the note reads "8 hit die + 4 Con modifier = 12" (got "${normal.hpNote}")`);
  const negative = deriveLevel1Stats({ hitDie: 8, conScore: 8, dexScore: 10, walkSpeed: 30 });
  ok(negative.hp === 7 && negative.hpNote === '8 hit die - 1 Con modifier = 7', 'a negative Con modifier renders with a minus, never "+ -1"');
  const binds = deriveLevel1Stats({ hitDie: 1, conScore: 8, dexScore: 10, walkSpeed: 30 });
  ok(binds.hp === 1 && binds.hpNote === '1 hit die - 1 Con modifier; minimum 1 HP total', 'the minimum-1 note shows only when the floor binds, attached to the total');
  const unplaced = deriveLevel1Stats({ hitDie: 8, conScore: null, dexScore: 10, walkSpeed: 30 });
  ok(unplaced.hp === null && unplaced.hpNote === '', 'unplaced Constitution still renders no HP note');
  ok(stage5.includes('at least 1 HP total'), 'the Stage 5 Tip states the minimum on the total');
  ok(!stage5.includes('(minimum 1)') && !stage6.includes('(minimum 1)'), 'no "(minimum 1)" dangles after the Con modifier anywhere');
  ok(stage6.includes("from './Stage5GearStory.jsx'") && stage6.includes('deriveLevel1Stats'), 'Review inherits the same deriveLevel1Stats (one string, two stages)');
}

// --- R2-14: inline story descriptions + personality guide ------------------------------------------
group('R2-14 story descriptions inline + personality guide');
{
  ok(stage5.includes("marginTop: 2 }}>{tip}</div>"), 'story field descriptions render inline under the label');
  ok(!stage5.includes('<Tip text={tip} />'), 'no Tip button remains in the story-field helpers');
  ok(stage5.includes('What do people notice about you first?'), 'the personality guide asks what people notice first');
  ok(stage5.includes('What habit gives you away?'), 'the personality guide asks what habit gives you away');
  ok(stage5.includes('What do you do when you\\u2019re nervous?'), 'the personality guide asks what you do when nervous');
  ok(!stage5.includes('sample personality') && !stage5.includes('Sample personalities'), 'the guide is prompt questions, never a sample-personality list');
  ok(stage5.includes('How you act — habits, tics, the things people notice first.'), 'the personality description text itself is unchanged');
}

// --- R2-15: language picker ----------------------------------------------------------------------------
group('R2-15 language picker — the 18-language list, held set, existing storage');
{
  // The real helpers (no logic re-implemented): the list is the
  // 18-language LANGUAGES object, derived from the source itself.
  const langKeys = Object.keys(LANGUAGES);
  ok(langKeys.length === 18, `LANGUAGES carries 18 languages (got ${langKeys.length})`);
  ok(langKeys.every(k => typeof LANGUAGES[k] === 'string' && LANGUAGES[k].length > 0), 'every language carries a one-sentence description');
  ok(isChoiceLanguage('One extra language of your choice') === true, 'isChoiceLanguage recognizes the placeholder');
  ok(isChoiceLanguage('Common') === false, 'isChoiceLanguage does not flag a real language');
  ok(JSON.stringify(concreteLanguages(['Common', 'One extra language of your choice'])) === JSON.stringify(['Common']), 'concreteLanguages strips the placeholder');
  ok(languageChoiceCount(['Common', 'Elvish', 'One extra language of your choice']) === 1, 'languageChoiceCount counts one promised slot');
  ok(languageChoiceCount(['Common', 'Dwarvish']) === 0, 'languageChoiceCount is zero with no placeholder');
  // State + save body: the pick rides the existing storage path.
  ok(JSON.stringify(blankStage1State().languageChoices) === JSON.stringify([]), 'blank state carries languageChoices: [] (never defaulted)');
  const body = buildStage1ProgressBody({ languages: ['Common'], languageChoices: ['Draconic'] });
  ok(JSON.stringify(JSON.parse(body.languages)) === JSON.stringify(['Common', 'Draconic']), 'the save body carries the pick with the derived list');
  const bodyOnly = buildStage1ProgressBody({ languageChoices: ['Draconic'] });
  ok(JSON.stringify(JSON.parse(bodyOnly.languages)) === JSON.stringify(['Draconic']), 'the pick rides the body even before Stage 4 runs');
  // The picker renders on Stage 1, beside the species pick, with the held set.
  ok(stage1.includes('Extra language'), 'Stage 1 renders the Extra language picker');
  ok(stage1.includes('Choose a language…'), 'the picker offers a language choice');
  ok(stage1.includes('Object.keys(LANGUAGES)'), 'the picker offers the 18-language LANGUAGES list (nothing invented)');
  ok(stage1.includes('— already known'), 'a language already known grays out, never hidden');
  ok(stage1.includes('languageChoices: []'), 'a species change clears the pick with the old species');
  // Rehydration: the real function recovers the source pick from the
  // stored final list — and never misreads a feat language as the pick.
  const humanEntry = { id: 'human', languages: ['Common', 'One extra language of your choice'] };
  const dwarfEntry = { id: 'dwarf', languages: ['Common', 'Dwarvish'] };
  const humanRow = { race: 'human', languages: JSON.stringify(['Common', 'Draconic']) };
  const rec = rehydrateStateFromServerRow(humanRow, {}, [humanEntry, dwarfEntry]);
  ok(JSON.stringify(rec.languageChoices) === JSON.stringify(['Draconic']), 'rehydration recovers the human pick from the stored list');
  const dwarfRow = { race: 'dwarf', languages: JSON.stringify(['Common', 'Dwarvish']) };
  const recDwarf = rehydrateStateFromServerRow(dwarfRow, {}, [humanEntry, dwarfEntry]);
  ok(recDwarf.languageChoices === undefined, 'a species with no choice slot recovers nothing');
  const featRow = { race: 'human', languages: JSON.stringify(['Common', 'Draconic']) };
  const featProg = { ancestry_feats: [{ tier: 1, choices_data: { language: 'Draconic' } }] };
  const recFeat = rehydrateStateFromServerRow(featRow, featProg, [humanEntry]);
  ok(recFeat.languageChoices === undefined, 'a feat-granted language is never misread as the species pick');
  const bothRow = { race: 'human', languages: JSON.stringify(['Common', 'Draconic', 'Elvish']) };
  const recBoth = rehydrateStateFromServerRow(bothRow, featProg, [humanEntry]);
  ok(JSON.stringify(recBoth.languageChoices) === JSON.stringify(['Elvish']), 'species pick + feat language recover exactly the species pick');
  // Mirror-less resume over the stub-fetch pattern (round-1 #5 shape):
  // row + progression + /api/species all resolve, and the pick lands.
  const realFetch = globalThis.fetch;
  try {
    globalThis.fetch = async (url) => {
      const u = String(url);
      if (/\/api\/character\/1203$/.test(u)) return { ok: true, json: async () => humanRow };
      if (/\/api\/character\/1203\/progression$/.test(u)) return { ok: true, json: async () => ({}) };
      if (/\/api\/species$/.test(u)) return { ok: true, json: async () => ({ species: [humanEntry, dwarfEntry] }) };
      return { ok: false };
    };
    const resumed = await rehydrateFromServerCharacter(1203);
    ok(JSON.stringify(resumed.patch.languageChoices) === JSON.stringify(['Draconic']), 'mirror-less resume recovers the pick via /api/species');
    globalThis.fetch = async () => { throw new Error('down'); };
    const down = await rehydrateFromServerCharacter(1203);
    ok(down.restored === false && Object.keys(down.patch).length === 0, 'unreachable server still returns a blank resume, never throws');
  } finally {
    globalThis.fetch = realFetch;
  }
}

console.log(`\ncreator-test-notes-2-client: ${passed} passed, ${failed} failed`);
process.exitCode = failed ? 1 : 0;
