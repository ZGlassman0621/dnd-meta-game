// tests/gray-out-client.test.js — gray-out #8 CLIENT side (2026-11-08):
// Magus, Blackguard, Scholar (classes) + Monk Warrior of Waves
// (subclass) are visible but disabled on PC surfaces, and stay open
// on the companion surface. UNWIND 2026-11-08 (Zach ~19:34 EST):
// Fighter Monster Hunter is OUT — it is a subclass, subclasses stay,
// so it is enabled again on PC surfaces (no flag in classes.json).
//
// What this pins:
//   - classes.json carries pcCreatable: false + the Q7 note on the
//     three class entries and the one subclass entry (dual-source
//     flag, Q2/Q9); 23 classes still listed; the Q10 rename leaves
//     no 'Way of Waves' string in classes.json.
//   - Stage2ClassCalling renders the three classes as disabled
//     <option>s (R2-7, 2026-11-09: the Q7 banner/help line under the
//     select is DELETED — a disabled <option> has no hover title,
//     and the one-line explanation now lives in the Class Tip:
//     "Some classes are coming after the MVP and can't be picked
//     yet."), and keeps a stored deferred classId selected (draft
//     edge: no clearing; the server guards refuse it at submit —
//     the species precedent).
//   - LevelUpPage renders 'Warrior of Waves' (monk) as a disabled
//     subclass <option> with the subclass note under the select, and
//     renders 'Monster Hunter' (fighter) enabled again with no note;
//     other subclasses stay enabled.
//   - CompanionEditor does NOT disable them — the companion subclass
//     picker reads the same client list and must stay open. It never
//     reads the pcCreatable flag, so the flag cannot leak into it.
//   - Mutation checks prove the pins are sensitive (exact failing
//     counts): M1 flags stripped from classes.json, M2 the disabled
//     rendering removed from Stage2, M3 the Q10 rename reverted.
//
// How rendering works here (same pattern as the spellbook
// client-sheet suite, taken one step further): the real components
// are bundled with esbuild and CALLED with real props — the bundle
// imports a recording react stand-in (createElement returns a tree
// node; hooks return initial values) instead of react-dom, so the
// test asserts on the actual rendered <option> elements, never on
// re-implemented logic. esbuild's automatic JSX runtime is used
// because the classic transform references a bare `React` global
// the bundle never defines. Hook overrides are positional (call
// order in the component source): LevelUpPage useState #0 is
// levelUpInfo, #1 loading, #4 step, #5 selectedClassOption
// (LevelUpPage.jsx:32-39); CompanionEditor useState #3 is activeTab
// (CompanionEditor.jsx:96-136). If a hook is added above one of
// these, the render precondition (the select is found) fails loudly
// instead of silently asserting on the wrong state.
// No DB, no HTTP: the server guards are the server worker's suite.
//
// Run from the repo root: node tests/gray-out-client.test.js
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

let passed = 0;
let failed = 0;
function check(condition, message) {
  if (condition) { passed++; }
  else { failed++; console.error('  ✗', message); }
}
function group(name) { console.log('\n==', name); }
// Run a failure-list function the way the main groups do: every
// failure is one failed check, an empty list is one passed check.
function reportFailures(label, failures) {
  if (failures.length === 0) check(true, label);
  for (const f of failures) check(false, f);
}

const repoRoot = process.cwd();
const readRepo = (rel) => fs.readFileSync(path.join(repoRoot, rel), 'utf8');
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gray-out-client-test-'));

const CLASS_NOTE = 'Coming after the MVP — NPCs can still be this class.';
const SUBCLASS_NOTE = 'Coming after the MVP — NPCs can still be this subclass.';
const DEFERRED_CLASSES = ['magus', 'blackguard', 'scholar'];

// --- Recording react stand-in (written to tmpDir, aliased in) ---
const stubPath = path.join(tmpDir, 'react-stub.mjs');
fs.writeFileSync(stubPath, [
  '// Minimal React stand-in for rendering: createElement/jsx record',
  '// the element tree (function components are NOT invoked); hooks',
  '// return initial values, overridable per render via a global pass.',
  'export const useState = (initial) => {',
  '  const pass = globalThis.__GRAYOUT_HOOK_PASS__;',
  '  if (pass) {',
  '    const i = pass.index++;',
  '    const v = pass.overrides[i] !== undefined ? pass.overrides[i] : initial;',
  '    return [v, () => {}];',
  '  }',
  '  return [initial, () => {}];',
  '};',
  'export const useEffect = () => {};',
  'export const useMemo = (f) => f();',
  'export const useRef = (v) => ({ current: v });',
  'export const useCallback = (f) => f;',
  "export const Fragment = 'react.fragment';",
  'export function createElement(type, props, ...children) {',
  '  return { type, props: props || {}, children: children.flat(Infinity).filter((c) => c !== null && c !== undefined && c !== false) };',
  '}',
  'export function jsx(type, props) {',
  '  const { children, ...rest } = props || {};',
  '  const kids = children === undefined ? [] : (Array.isArray(children) ? children : [children]);',
  '  return { type, props: rest, children: kids.flat(Infinity).filter((c) => c !== null && c !== undefined && c !== false) };',
  '}',
  'export const jsxs = jsx;',
  'export default { createElement, jsx, jsxs, Fragment };',
  '',
].join('\n'));

function findEsbuild() {
  const cands = [
    // Windows: .bin/esbuild is a shell shim execFileSync cannot run — use the real binary.
    ...(process.platform === 'win32' ? [path.join(repoRoot, 'client', 'node_modules', '@esbuild', `win32-${process.arch}`, 'esbuild.exe')] : []),
    path.join(repoRoot, 'client', 'node_modules', '.bin', 'esbuild'),
    path.join(repoRoot, 'node_modules', '.bin', 'esbuild'),
  ];
  for (const c of cands) if (fs.existsSync(c)) return { bin: c, prefix: [] };
  return { bin: 'npx', prefix: ['--yes', 'esbuild'] };
}
function bundleAbs(entryAbs, outName) {
  const { bin, prefix } = findEsbuild();
  const out = path.join(tmpDir, outName);
  execFileSync(bin, [...prefix, entryAbs, '--bundle', '--format=esm', `--outfile=${out}`,
    '--jsx=automatic', `--alias:react=${stubPath}`, `--alias:react/jsx-runtime=${stubPath}`,
    '--log-level=warning'], { stdio: 'pipe' });
  return out;
}
async function importBundle(outPath) {
  return (await import(pathToFileURL(outPath).href)).default;
}
function renderComponent(Component, props, overrides = []) {
  globalThis.__GRAYOUT_HOOK_PASS__ = { overrides, index: 0 };
  return Component(props);
}

// --- Tree helpers (walk the recorded element tree) ---
function textOf(node) {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (!node || typeof node !== 'object') return '';
  return (node.children || []).map(textOf).join('');
}
function walkNodes(node, out) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) { node.forEach((n) => walkNodes(n, out)); return; }
  out.push(node);
  (node.children || []).forEach((n) => walkNodes(n, out));
}
function allNodes(tree) { const out = []; walkNodes(tree, out); return out; }
function findSelect(tree, pred) {
  return allNodes(tree).find((n) => n.type === 'select' && (!pred || pred(n)));
}
function optionsOf(selectNode) {
  const opts = [];
  (function find(n) {
    if (!n || typeof n !== 'object') return;
    if (Array.isArray(n)) return n.forEach(find);
    if (n.type === 'option') opts.push(n);
    (n.children || []).forEach(find);
  })(selectNode);
  return opts;
}
function helpTexts(tree) {
  return allNodes(tree)
    .filter((n) => (n.type === 'div' || n.type === 'p') && (n.props.className === 'help' || n.props.className === 'subclass-note'))
    .map(textOf);
}

// --- Shared fixtures ---
const stage2BaseState = { classId: '', subclassName: '', subclassChoices: {}, knownCantrips: [] };
function stage2Props(state) {
  return {
    state, set: () => {}, classes: null, subclassesByClass: {}, subclasses: null,
    speciesEntry: null, featCantrips: [], characterLevel: 1, classLevels: null,
  };
}
function levelUpInfoFor(className, level = 2) {
  return {
    classLevels: [{ class: className, level }],
    newLevel: level + 1,
    proficiencyBonus: { increased: false, current: 2, new: 2 },
    classOptions: [{ type: 'existing', class: className, currentLevel: level, newLevel: level + 1, subclass: null, newFeatures: [], hpGain: { average: 6 } }],
  };
}
function levelUpOptionFor(className, level = 2) {
  return {
    type: 'existing', class: className, currentLevel: level, newLevel: level + 1,
    subclassLevel: 3, subclass: null, newFeatures: [],
    hpGain: { hitDie: className === 'Monk' ? 8 : 10, average: 6 },
    choices: { needsSubclass: true, needsASI: false, newCantrips: 0, newSpellsKnown: 0 },
  };
}
function levelUpCharacter(className) {
  return {
    id: 1, name: 'Test', class: className,
    ability_scores: '{"str":16,"dex":12,"con":14,"int":10,"wis":10,"cha":10}',
    known_cantrips: '[]',
  };
}
function levelUpOverrides(className) {
  // LevelUpPage useState order (LevelUpPage.jsx:32-39): #0 levelUpInfo,
  // #1 loading, #4 step, #5 selectedClassOption.
  const ov = [];
  ov[0] = levelUpInfoFor(className);
  ov[1] = false;
  ov[4] = 'choices';
  ov[5] = levelUpOptionFor(className);
  return ov;
}
function companionFor(className, level = 3) {
  return {
    id: 1, npc_id: 1, progression_type: 'class_based', companion_class: className,
    companion_level: level, companion_subclass: '', nickname: '',
    companion_inventory: '[]', gold_gp: 0, gold_sp: 0, gold_cp: 0,
  };
}
function companionOverrides() {
  // CompanionEditor useState order (CompanionEditor.jsx:96-136):
  // #3 is activeTab — the subclass block lives under 'abilities'.
  const ov = [];
  ov[3] = 'abilities';
  return ov;
}

// --- Failure-list functions (shared by the main run and mutations) ---
function classesJsonFailures(data, raw) {
  const failures = [];
  const fail = (cond, msg) => { if (!cond) failures.push(msg); };
  fail(Object.keys(data).length === 23, `classes.json lists 23 classes (got ${Object.keys(data).length})`);
  for (const key of DEFERRED_CLASSES) {
    fail(data[key]?.pcCreatable === false, `classes.json: ${key} carries pcCreatable: false`);
    fail(data[key]?.pcCreatableNote === CLASS_NOTE, `classes.json: ${key} carries the Q7 class note`);
  }
  // UNWIND 2026-11-08: Monster Hunter is back to creatable — no flag.
  const mh = data.fighter?.subclasses?.find((s) => s.name === 'Monster Hunter');
  fail(mh !== undefined, 'classes.json: fighter still lists Monster Hunter (not removed)');
  fail(!('pcCreatable' in (mh || {})), 'classes.json: fighter Monster Hunter carries no pcCreatable field (back to creatable)');
  fail(!('pcCreatableNote' in (mh || {})), 'classes.json: fighter Monster Hunter carries no pcCreatableNote field');
  const wow = data.monk?.subclasses?.find((s) => s.name === 'Warrior of Waves');
  fail(wow?.pcCreatable === false, 'classes.json: monk Warrior of Waves carries pcCreatable: false');
  fail(wow?.pcCreatableNote === SUBCLASS_NOTE, 'classes.json: monk Warrior of Waves carries the Q7 subclass note');
  fail(data.fighter?.subclasses?.length === 10, `fighter still lists 10 subclasses (got ${data.fighter?.subclasses?.length})`);
  fail(data.monk?.subclasses?.length === 11, `monk still lists 11 subclasses (got ${data.monk?.subclasses?.length})`);
  fail(data.magus?.subclasses?.some((s) => s.name === 'The Arcane Order'), 'magus still lists its societies (The Arcane Order present)');
  fail(data.scholar?.subclasses?.some((s) => s.name === 'Ritualist') && data.scholar?.subclasses?.some((s) => s.name === 'Theologian'),
    'scholar still lists its Fields (Ritualist + Theologian present)');
  fail(!raw.includes('Way of Waves'), "Q10: no 'Way of Waves' string remains in classes.json");
  fail(data.monk?.subclasses?.some((s) => s.name === 'Warrior of Waves'), "Q10: monk lists 'Warrior of Waves'");
  fail(!('pcCreatable' in (data.fighter || {})) && !('pcCreatable' in (data.wizard || {})) && !('pcCreatable' in (data.monk || {})),
    'fighter / wizard / monk carry no pcCreatable field (still creatable)');
  const champ = data.fighter?.subclasses?.find((s) => s.name === 'Champion');
  const openHand = data.monk?.subclasses?.find((s) => s.name === 'Way of the Open Hand');
  fail(!('pcCreatable' in (champ || {})) && !('pcCreatable' in (openHand || {})),
    'Champion and Way of the Open Hand carry no pcCreatable field (still pickable)');
  return failures;
}

function stage2Failures(tree) {
  const failures = [];
  const fail = (cond, msg) => { if (!cond) failures.push(msg); };
  const select = findSelect(tree, (s) => s.props.id === 'stage2-class');
  fail(!!select, 'Stage2 render: the #stage2-class select is present (render precondition)');
  if (!select) return failures;
  const opts = optionsOf(select);
  fail(opts.length === 24, `Stage2 render: 24 options (placeholder + 23 classes, got ${opts.length})`);
  for (const key of DEFERRED_CLASSES) {
    const opt = opts.find((o) => o.props.value === key);
    fail(opt?.props.disabled === true, `Stage2 render: ${key} option is disabled`);
  }
  const others = opts.filter((o) => o.props.value && !DEFERRED_CLASSES.includes(o.props.value));
  fail(others.length === 20 && others.every((o) => o.props.disabled !== true),
    `Stage2 render: the other 20 class options stay enabled (got ${others.length} others, ${others.filter((o) => o.props.disabled === true).length} disabled)`);
  const helps = helpTexts(tree);
  // R2-7 (2026-11-09): the Q7 banner/help line under the select is
  // deleted — no rendered help line may carry the note. The one-line
  // explanation lives in the Class Tip instead (pinned in group (b)).
  fail(!helps.some((t) => t.includes(CLASS_NOTE)), 'Stage2 render: no Q7 class note is rendered under the select (R2-7: banner deleted)');
  fail(!helps.some((t) => t.includes('Blackguard') && t.includes('Magus') && t.includes('Scholar')),
    'Stage2 render: no help line names Blackguard, Magus and Scholar (R2-7: banner deleted)');
  return failures;
}

function levelUpFailures(tree, className, deferredName, expectedOptions) {
  const failures = [];
  const fail = (cond, msg) => { if (!cond) failures.push(msg); };
  const select = findSelect(tree, (s) => s.props.className === 'subclass-select');
  fail(!!select, `LevelUpPage render (${className}): the subclass select is present (render precondition)`);
  if (!select) return failures;
  const opts = optionsOf(select);
  fail(opts.length === expectedOptions, `LevelUpPage render (${className}): ${expectedOptions} options (placeholder + subclasses, got ${opts.length})`);
  const deferred = opts.find((o) => textOf(o) === deferredName);
  fail(deferred?.props.disabled === true, `LevelUpPage render (${className}): '${deferredName}' option is disabled`);
  const others = opts.filter((o) => textOf(o) && textOf(o) !== deferredName);
  fail(others.every((o) => o.props.disabled !== true),
    `LevelUpPage render (${className}): every other subclass stays enabled (${others.filter((o) => o.props.disabled === true).map(textOf).join(', ') || 'none'} disabled)`);
  const notes = helpTexts(tree);
  fail(notes.some((t) => t.includes(SUBCLASS_NOTE)), `LevelUpPage render (${className}): the Q7 subclass note is visible under the select`);
  fail(!opts.some((o) => textOf(o) === 'Way of Waves'), `LevelUpPage render (${className}): no 'Way of Waves' option is offered`);
  return failures;
}

function levelUpOpenFailures(tree, className, openName, expectedOptions) {
  const failures = [];
  const fail = (cond, msg) => { if (!cond) failures.push(msg); };
  const select = findSelect(tree, (s) => s.props.className === 'subclass-select');
  fail(!!select, `LevelUpPage render (${className}): the subclass select is present (render precondition)`);
  if (!select) return failures;
  const opts = optionsOf(select);
  fail(opts.length === expectedOptions, `LevelUpPage render (${className}): ${expectedOptions} options (placeholder + subclasses, got ${opts.length})`);
  const open = opts.find((o) => textOf(o) === openName);
  fail(open?.props.disabled !== true, `LevelUpPage render (${className}): '${openName}' option is enabled again`);
  fail(opts.every((o) => o.props.disabled !== true),
    `LevelUpPage render (${className}): no subclass option is disabled (${opts.filter((o) => o.props.disabled === true).map(textOf).join(', ') || 'none'} disabled)`);
  const notes = helpTexts(tree);
  fail(!notes.some((t) => t.includes(SUBCLASS_NOTE)), `LevelUpPage render (${className}): no subclass note shows (nothing deferred here)`);
  fail(!opts.some((o) => textOf(o) === 'Way of Waves'), `LevelUpPage render (${className}): no 'Way of Waves' option is offered`);
  return failures;
}

function companionFailures(tree, className, deferredName, expectedOptions) {
  const failures = [];
  const fail = (cond, msg) => { if (!cond) failures.push(msg); };
  const selects = allNodes(tree).filter((n) => n.type === 'select');
  const select = selects.find((s) => optionsOf(s).some((o) => textOf(o) === deferredName));
  fail(!!select, `CompanionEditor render (${className}): the subclass select listing '${deferredName}' is present (render precondition)`);
  if (!select) return failures;
  const opts = optionsOf(select);
  fail(opts.length === expectedOptions, `CompanionEditor render (${className}): ${expectedOptions} options (placeholder + subclasses, got ${opts.length})`);
  const deferred = opts.find((o) => textOf(o) === deferredName);
  fail(deferred?.props.disabled !== true, `CompanionEditor render (${className}): '${deferredName}' stays enabled for companions`);
  fail(opts.every((o) => o.props.disabled !== true),
    `CompanionEditor render (${className}): no subclass option is disabled for companions`);
  return failures;
}

// (a) classes.json flags (the real data file).
group('(a) classes.json flags + Q10 rename');
{
  const raw = readRepo('client/src/data/classes.json');
  const data = JSON.parse(raw);
  reportFailures('classes.json: all flag + rename checks pass', classesJsonFailures(data, raw));
}

// (b) Stage2ClassCalling — true render + static pins + real bundle.
group('(b) Stage2 class picker (true render)');
{
  const src = readRepo('client/src/components/creator-next/Stage2ClassCalling.jsx');
  check(src.includes('disabled={c.pcCreatable === false}'),
    'Stage2 source disables the option from the classes.json flag, not a hardcoded list');
  // R2-7 (2026-11-09): the deferred-classes banner is deleted — no
  // deferredClasses assembly from the flagged entries survives in
  // Stage 2. The gray-out itself (above) is untouched, and the one
  // remaining explanation is the Class Tip clause.
  check(!src.includes('deferredClasses'),
    'Stage2 source carries no deferred-classes banner assembly (R2-7: banner deleted)');
  check(src.includes("Some classes are coming after the MVP and can't be picked yet."),
    'Stage2 Class Tip carries the R2-7 clause explaining the gray-out');

  let bundle = null;
  try {
    bundle = fs.readFileSync(bundleAbs(path.join(repoRoot, 'client/src/components/creator-next/Stage2ClassCalling.jsx'), 'stage2.bundle.mjs'), 'utf-8');
    check(bundle.length > 1000, 'Stage2 bundles against the real Tooltip/speciesAdapter/classes.json imports');
  } catch (e) {
    check(false, `Stage2 esbuild bundle failed: ${e.message}`);
  }
  if (bundle) {
    check(bundle.includes('pcCreatable'), 'bundled Stage2 contains the flag read');
    // esbuild escapes the em-dash as \u2014 in bundle text, so the
    // note is pinned on its two ASCII halves (the render checks
    // below assert the exact runtime string).
    check(bundle.includes('Coming after the MVP') && bundle.includes('NPCs can still be this class'),
      'bundled Stage2 contains the Q7 class note');
    const Stage2 = await importBundle(path.join(tmpDir, 'stage2.bundle.mjs'));
    const tree = renderComponent(Stage2, stage2Props(stage2BaseState));
    reportFailures('Stage2 render: 3 deferred classes disabled, 23 listed, note visible', stage2Failures(tree));
    // Draft edge: a draft saved before the gray-out keeps its stored
    // classId selected — the select still shows the disabled option
    // as its value; nothing here clears it.
    const draftTree = renderComponent(Stage2, stage2Props({ ...stage2BaseState, classId: 'magus' }));
    const draftSelect = findSelect(draftTree, (s) => s.props.id === 'stage2-class');
    check(draftSelect?.props.value === 'magus', 'draft edge: a stored magus classId stays the select value');
    const draftMagus = draftSelect ? optionsOf(draftSelect).find((o) => o.props.value === 'magus') : null;
    check(draftMagus?.props.disabled === true, 'draft edge: the stored magus option is present and disabled, not removed');
    check(!helpTexts(draftTree).some((t) => t.includes(CLASS_NOTE)), 'draft edge: no Q7 note is rendered under a deferred draft (R2-7: banner deleted)');
    const scholarTree = renderComponent(Stage2, stage2Props({ ...stage2BaseState, classId: 'scholar' }));
    check(findSelect(scholarTree, (s) => s.props.id === 'stage2-class')?.props.value === 'scholar',
      'draft edge: a stored scholar classId stays the select value too');
  }
}

// (c) LevelUpPage subclass picker — true render + static pins + bundle.
group('(c) LevelUpPage subclass picker (true render)');
{
  const src = readRepo('client/src/components/LevelUpPage.jsx');
  check(src.includes('disabled={subclass.pcCreatable === false}'),
    'LevelUpPage source disables the subclass option from the classes.json flag');
  check(src.includes('deferredSubclassOptions[0].pcCreatableNote'),
    'LevelUpPage source carries the subclass note from the flagged entry');
  check(!src.includes("'Way of Waves'") && !src.includes('"Way of Waves"'),
    "LevelUpPage source never names the old 'Way of Waves' spelling");
  // #9 (2026-11-09, prerequisites removed) replaced the hardcoded
  // ALL_CLASSES list with keys derived from classes.json, and the
  // three deferred classes stay LISTED but DISABLED (pcCreatable
  // false) — the same gray-out pattern as the creator picker, with
  // the server's POST /level-up guard as the enforcement. The old
  // pin ("const ALL_CLASSES = [" + no 'Magus'/'Blackguard'
  // strings) asserted the pre-#9 exclusion design and went red the
  // moment #9 landed; it is replaced by pins on the landed
  // mechanism, not deleted — a PC still cannot take Magus /
  // Blackguard as a multiclass, by render + server refusal.
  check(src.includes('const ALL_CLASSES = Object.keys(classesData)'),
    'LevelUpPage ALL_CLASSES is derived from classes.json keys, not a hardcoded list');
  check(src.includes('const pcCreatable = classesData[classKey]?.pcCreatable !== false'),
    'LevelUpPage multiclass options ride pcCreatable from classes.json');
  check(src.includes("pcCreatable === false ? ' deferred' : ''") && src.includes('option.pcCreatable === false ? undefined : () => handleClassSelect(option)'),
    'LevelUpPage renders deferred multiclass options as disabled cards with no select handler');

  let bundle = null;
  try {
    bundle = fs.readFileSync(bundleAbs(path.join(repoRoot, 'client/src/components/LevelUpPage.jsx'), 'levelup.bundle.mjs'), 'utf-8');
    check(bundle.length > 1000, 'LevelUpPage bundles against the real classes/spells/feats/helpers imports');
  } catch (e) {
    check(false, `LevelUpPage esbuild bundle failed: ${e.message}`);
  }
  if (bundle) {
    check(bundle.includes('pcCreatable'), 'bundled LevelUpPage contains the flag read');
    // esbuild escapes the em-dash as \u2014 in bundle text (see (b)).
    check(bundle.includes('Coming after the MVP') && bundle.includes('NPCs can still be this subclass'),
      'bundled LevelUpPage contains the Q7 subclass note');
    const LevelUpPage = await importBundle(path.join(tmpDir, 'levelup.bundle.mjs'));
    const fighterTree = renderComponent(LevelUpPage,
      { character: levelUpCharacter('Fighter'), onLevelUp: () => {}, onBack: () => {} },
      levelUpOverrides('Fighter'));
    reportFailures("LevelUpPage render (Fighter): 'Monster Hunter' enabled again, 10 subclasses listed, no note",
      levelUpOpenFailures(fighterTree, 'Fighter', 'Monster Hunter', 11));
    const monkTree = renderComponent(LevelUpPage,
      { character: levelUpCharacter('Monk'), onLevelUp: () => {}, onBack: () => {} },
      levelUpOverrides('Monk'));
    reportFailures("LevelUpPage render (Monk): 'Warrior of Waves' disabled, 11 subclasses listed, note visible",
      levelUpFailures(monkTree, 'Monk', 'Warrior of Waves', 12));
  }
}

// (d) CompanionEditor — true render: the companion surface stays open.
group('(d) CompanionEditor subclass picker stays open (true render)');
{
  const src = readRepo('client/src/components/CompanionEditor.jsx');
  check(!src.includes('pcCreatable'),
    'CompanionEditor source never reads pcCreatable — the flag cannot leak into the companion picker');
  check(src.includes('<option key={sub.name} value={sub.name}>{sub.name}</option>'),
    'CompanionEditor source renders the plain subclass option map (no disabled logic)');

  let bundle = null;
  try {
    bundle = fs.readFileSync(bundleAbs(path.join(repoRoot, 'client/src/components/CompanionEditor.jsx'), 'companion.bundle.mjs'), 'utf-8');
    check(bundle.length > 1000, 'CompanionEditor bundles against the real classes/equipment imports');
  } catch (e) {
    check(false, `CompanionEditor esbuild bundle failed: ${e.message}`);
  }
  if (bundle) {
    const CompanionEditor = await importBundle(path.join(tmpDir, 'companion.bundle.mjs'));
    const fighterTree = renderComponent(CompanionEditor,
      { companion: companionFor('Fighter'), onSave: () => {}, onCancel: () => {} },
      companionOverrides());
    reportFailures("CompanionEditor render (Fighter): 'Monster Hunter' stays enabled",
      companionFailures(fighterTree, 'Fighter', 'Monster Hunter', 11));
    const monkTree = renderComponent(CompanionEditor,
      { companion: companionFor('Monk'), onSave: () => {}, onCancel: () => {} },
      companionOverrides());
    reportFailures("CompanionEditor render (Monk): 'Warrior of Waves' stays enabled",
      companionFailures(monkTree, 'Monk', 'Warrior of Waves', 12));
  }
}

// (e) Mutation checks — exact failing counts prove the pins bite.
group('(e) Mutation checks (exact failing counts)');
{
  // M1: strip all four flags from a temp copy of classes.json and
  // render the REAL Stage2 against it (temp tree preserves the
  // relative import layout; the repo files are never touched).
  const mut1Root = path.join(tmpDir, 'mut1');
  fs.cpSync(path.join(repoRoot, 'client/src/components/creator-next'), path.join(mut1Root, 'components/creator-next'), { recursive: true });
  fs.mkdirSync(path.join(mut1Root, 'data'), { recursive: true });
  fs.copyFileSync(path.join(repoRoot, 'client/src/data/references.js'), path.join(mut1Root, 'data/references.js'));
  // Stage2 also imports deities.json (the #10 god picker); the
  // temp tree must stage it or the bundle cannot resolve it.
  fs.copyFileSync(path.join(repoRoot, 'client/src/data/deities.json'), path.join(mut1Root, 'data/deities.json'));
  const mut1Data = JSON.parse(readRepo('client/src/data/classes.json'));
  for (const key of DEFERRED_CLASSES) { delete mut1Data[key].pcCreatable; delete mut1Data[key].pcCreatableNote; }
  for (const sub of mut1Data.fighter.subclasses) { delete sub.pcCreatable; delete sub.pcCreatableNote; }
  for (const sub of mut1Data.monk.subclasses) { delete sub.pcCreatable; delete sub.pcCreatableNote; }
  const mut1Raw = JSON.stringify(mut1Data, null, 2);
  fs.writeFileSync(path.join(mut1Root, 'data/classes.json'), mut1Raw);
  const mut1DataFailures = classesJsonFailures(mut1Data, mut1Raw);
  let mut1RenderFailures = ['M1 bundle failed — render not reached'];
  try {
    const mut1BundlePath = bundleAbs(path.join(mut1Root, 'components/creator-next/Stage2ClassCalling.jsx'), 'stage2-mut1.bundle.mjs');
    const Mut1Stage2 = await importBundle(mut1BundlePath);
    const mut1Tree = renderComponent(Mut1Stage2, stage2Props(stage2BaseState));
    mut1RenderFailures = stage2Failures(mut1Tree);
  } catch (e) {
    check(false, `M1 mutated bundle failed: ${e.message}`);
  }
  // 8 data failures (3 class flags + 3 class notes + 1 subclass
  // flag + 1 subclass note — Monster Hunter carries no flag since
  // the unwind) + 3 render failures (the 3 disabled options; R2-7
  // deleted the banner, so there is no help-line check left to fail)
  // = 11.
  check(mut1DataFailures.length === 8, `M1: flag strip fails exactly 8 data checks (got ${mut1DataFailures.length}: ${mut1DataFailures.join(' | ')})`);
  check(mut1RenderFailures.length === 3, `M1: flag strip fails exactly 3 Stage2 render checks (got ${mut1RenderFailures.length}: ${mut1RenderFailures.join(' | ')})`);
  check(mut1DataFailures.length + mut1RenderFailures.length === 11, 'M1 total: 11 failing checks');

  // M2: delete the disabled rendering from a temp copy of Stage2
  // (same directory, so its relative imports resolve) and render it.
  const stage2Src = readRepo('client/src/components/creator-next/Stage2ClassCalling.jsx');
  assert.strictEqual((stage2Src.match(/disabled=\{c\.pcCreatable === false\}/g) || []).length, 1,
    'M2 precondition: the class-select disabled expression occurs exactly once');
  const mutatedStage2Path = path.join(repoRoot, 'client/src/components/creator-next/Stage2ClassCalling.mutated.jsx');
  fs.writeFileSync(mutatedStage2Path, stage2Src.replace('disabled={c.pcCreatable === false}', 'disabled={false}'));
  let mut2Failures = ['M2 bundle failed — render not reached'];
  try {
    const mut2BundlePath = bundleAbs(mutatedStage2Path, 'stage2-mut2.bundle.mjs');
    const Mut2Stage2 = await importBundle(mut2BundlePath);
    const mut2Tree = renderComponent(Mut2Stage2, stage2Props(stage2BaseState));
    mut2Failures = stage2Failures(mut2Tree);
  } catch (e) {
    check(false, `M2 mutated bundle failed: ${e.message}`);
  } finally {
    try { fs.unlinkSync(mutatedStage2Path); } catch {}
  }
  // Only the 3 disabled-option checks fail — there is no help line
  // left to render since R2-7 deleted the banner.
  check(mut2Failures.length === 3, `M2: disabled-rendering removal fails exactly 3 Stage2 render checks (got ${mut2Failures.length}: ${mut2Failures.join(' | ')})`);

  // M3: revert the Q10 rename in a temp copy of classes.json and
  // render the REAL LevelUpPage (monk) against it.
  const mut3Root = path.join(tmpDir, 'mut3');
  fs.cpSync(path.join(repoRoot, 'client/src/data'), path.join(mut3Root, 'data'), { recursive: true });
  fs.mkdirSync(path.join(mut3Root, 'components'), { recursive: true });
  fs.copyFileSync(path.join(repoRoot, 'client/src/components/LevelUpPage.jsx'), path.join(mut3Root, 'components/LevelUpPage.jsx'));
  fs.copyFileSync(path.join(repoRoot, 'client/src/components/spellbookHelpers.js'), path.join(mut3Root, 'components/spellbookHelpers.js'));
  const mut3Raw = readRepo('client/src/data/classes.json').replaceAll('Warrior of Waves', 'Way of Waves');
  assert.strictEqual((readRepo('client/src/data/classes.json').match(/Warrior of Waves/g) || []).length, 2,
    'M3 precondition: the real file names Warrior of Waves exactly twice');
  fs.writeFileSync(path.join(mut3Root, 'data/classes.json'), mut3Raw);
  const mut3Data = JSON.parse(mut3Raw);
  const mut3DataFailures = classesJsonFailures(mut3Data, mut3Raw).filter((m) => m.includes('Way of Waves') || m.includes('Warrior of Waves'));
  let mut3RenderFailures = ['M3 bundle failed — render not reached'];
  try {
    const mut3BundlePath = bundleAbs(path.join(mut3Root, 'components/LevelUpPage.jsx'), 'levelup-mut3.bundle.mjs');
    const Mut3LevelUp = await importBundle(mut3BundlePath);
    const mut3Tree = renderComponent(Mut3LevelUp,
      { character: levelUpCharacter('Monk'), onLevelUp: () => {}, onBack: () => {} },
      levelUpOverrides('Monk'));
    mut3RenderFailures = levelUpFailures(mut3Tree, 'Monk', 'Warrior of Waves', 12);
  } catch (e) {
    check(false, `M3 mutated bundle failed: ${e.message}`);
  }
  // 4 data failures (monk 'Warrior of Waves' flag + note unreadable
  // under the reverted name; 'Way of Waves' present in the raw text;
  // no 'Warrior of Waves' in the monk list) + 3 render failures (no
  // 'Warrior of Waves' option to disable; 'Way of Waves' offered;
  // 'Way of Waves' disabled yet not the deferred name) = 7.
  check(mut3DataFailures.length === 4, `M3: rename revert fails exactly 4 rename data checks (got ${mut3DataFailures.length}: ${mut3DataFailures.join(' | ')})`);
  check(mut3RenderFailures.length === 3, `M3: rename revert fails exactly 3 LevelUpPage render checks (got ${mut3RenderFailures.length}: ${mut3RenderFailures.join(' | ')})`);
  check(mut3DataFailures.length + mut3RenderFailures.length === 7, 'M3 total: 7 failing checks');
}

console.log(`=== Results: ${passed} passed, ${failed} failed ===`);
process.exit(failed ? 1 : 0);
