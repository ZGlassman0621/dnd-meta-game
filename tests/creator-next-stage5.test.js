// tests/creator-next-stage5.test.js — creator-next Stage 5
// ("Gear & Story") build (Zach, 2026-11-07).
//
// What this build wires in:
//   - NEW client/src/components/creator-next/Stage5GearStory.jsx —
//     package picker from GET /api/starting-packages/:classId
//     (contract: { classId, options: [{id, items, gold}], goldOption }),
//     gold fork (packages OR gold = class baseline x theme modifier,
//     display only, server authoritative), derived HP/AC/speed display
//     (display only — the server derives them at submit), story +
//     appearance text inputs on the existing plain story columns.
//   - Shell step 4 + stage1Persistence.js Stage 5 fields
//     (gear_choice / package_id / package_picks as a JSON string,
//     story fields as plain strings) + choiceOptions.js package
//     sentinels (any_simple_weapon, any_weapon, any_armor, any_pack,
//     any_tool_kit, any_gaming_set, focuses, any_musical_instrument).
//   - STAGE_NOTES key 4 drops the heirloom mention: heirloom is
//     DEFERRED (no server home, no design for what one is
//     mechanically) — no heirloom picker exists anywhere in the build.
//
// The route IS landed (verified 2026-11-07: mounted at
// server/index.js:130, data in server/data/startingPackages.js, 23
// classes). Fixtures below are VERBATIM copies of the live route
// data for the classes they cover (fighter A/B + goldOption 155,
// bard A + instrument choice, monk A + toolOrInstrument fork,
// blackguard c1 bundle forks, warden c1 condition branches, magus
// c3 nested focus choices) — not transcriptions from photos. The
// HTTP group tests what the client owns: the save body round-trips
// through the real character router (gear fields ride as
// validation-only picks, story columns persist).
//
// Honest integration tests: the real stage1Persistence / choiceOptions
// / Stage 5 modules, driven over real HTTP against a real throwaway
// DB (Stage 3/4 harness). The Stage 5 component's pure helpers are
// tested from a real esbuild bundle of the staged JSX (group (k)),
// not from a re-implementation. Footer is the runner-matching
// `Results:` form so the count aggregates.
import assert from 'node:assert';
import express from 'express';
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

const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'creator-next-stage5-test-'));
const tmpDir = repoRoot;
const origCwd = process.cwd();
process.chdir(tmpDir);
delete process.env.TURSO_DATABASE_URL;
delete process.env.TURSO_AUTH_TOKEN;
const fromRepo = (rel) => pathToFileURL(path.join(origCwd, rel)).href;
const readRepo = (rel) => fs.readFileSync(path.join(origCwd, rel), 'utf-8');

const db = await import(fromRepo('server/database.js'));
await db.initDatabase();
// The real modules under test.
const { buildStage1ProgressBody, blankStage1State } = await import(fromRepo('client/src/components/creator-next/stage1Persistence.js'));
const { resolveChoiceOptions, isHeldOption, describeSentinel, normalizeChoiceValues } = await import(fromRepo('client/src/components/creator-next/choiceOptions.js'));
// The Stage 5 component is JSX: Node cannot import it directly, so
// its pure helpers are tested from a real esbuild bundle of the staged
// JSX (built once up front, Stage 4's group-(k) pattern) — the
// helpers are the component's own code, not a re-implementation.
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
    // Windows: .bin/esbuild is a shell shim execFileSync cannot run — use the real binary.
    ...(process.platform === 'win32' ? [path.join(origCwd, 'client', 'node_modules', '@esbuild', `win32-${process.arch}`, 'esbuild.exe')] : []),
    path.join(origCwd, 'client', 'node_modules', '.bin', 'esbuild'),
    path.join(origCwd, 'node_modules', '.bin', 'esbuild'),
  ];
  for (const c of cands) if (fs.existsSync(c)) return { bin: c, prefix: [] };
  return { bin: 'npx', prefix: ['--yes', 'esbuild'] };
}
function bundle(entryRel, outName) {
  const { bin, prefix } = findEsbuild();
  const out = path.join(tmpDir, outName);
  execFileSync(bin, [...prefix, path.join(origCwd, entryRel), '--bundle', '--format=esm', `--outfile=${out}`, `--alias:react=${stubPath}`, '--log-level=warning'], { stdio: 'pipe' });
  return out;
}
const stage5BundleOut = bundle('client/src/components/creator-next/Stage5GearStory.jsx', 'stage5.bundle.mjs');
const stage5 = await import(pathToFileURL(stage5BundleOut).href);
const {
  GOLD_SILENT_CLASSES, abilityModifier, goldOptionBaseline, computedGold,
  normalizePackageData, parsePackageItem, priceForItem, armorEntryFor,
  deriveLevel1Stats, alternativeLabel, alternativeCondition,
  reachableChoiceKeys, prunePicks, selectedFixedItems,
} = stage5;

// --- HTTP harness: the real character router on one app ---------------
const app = express();
app.use(express.json());
const characterRouter = (await import(fromRepo('server/routes/character.js'))).default;
app.use('/api/character', characterRouter);
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
async function readCharacter(id) {
  return db.dbGet('SELECT * FROM characters WHERE id = ?', [id]);
}
async function characterCountByName(name) {
  const row = await db.dbGet('SELECT COUNT(*) AS n FROM characters WHERE name = ?', [name]);
  return row?.n ?? 0;
}

const MARKER = 'creator-next';
const J = (v) => JSON.stringify(v); // the wire format for JSON columns: strings, not raw arrays

// --- Contract fixtures (verbatim from server/data/startingPackages.js) -
// Fighter: (A) Chain Mail, Greatsword, Flail, 8 Javelins,
// Dungeoneer's Pack, 4 GP; (B) Studded Leather, Scimitar, Shortsword,
// Longbow, Arrows (20), Quiver, Dungeoneer's Pack, 11 GP; (C) 155 GP
// is goldOption, NOT a package option — the only class with three
// options, and the third is the gold fork.
const FIGHTER_PACKAGES = {
  classId: 'fighter',
  options: [
    {
      id: 'A',
      gold: 4,
      items: [
        { name: 'Chain Mail', quantity: 1 },
        { name: 'Greatsword', quantity: 1 },
        { name: 'Flail', quantity: 1 },
        { name: 'Javelin', quantity: 8 },
        { name: "Dungeoneer's Pack", quantity: 1 },
      ],
    },
    {
      id: 'B',
      gold: 11,
      items: [
        { name: 'Studded Leather', quantity: 1 },
        { name: 'Scimitar', quantity: 1 },
        { name: 'Shortsword', quantity: 1 },
        { name: 'Longbow', quantity: 1 },
        { name: 'Arrows (20)', quantity: 1 },
        { name: 'Quiver', quantity: 1 },
        { name: "Dungeoneer's Pack", quantity: 1 },
      ],
    },
  ],
  goldOption: 155,
};
// Same fighter, reading 1: (C) served as an option with no items
// (defensive fold — the live route serves goldOption 155 instead).
const FIGHTER_PACKAGES_C_OPTION = {
  classId: 'fighter',
  options: [
    {
      id: 'A',
      gold: 4,
      items: [
        { name: 'Chain Mail', quantity: 1 },
        { name: 'Greatsword', quantity: 1 },
        { name: 'Flail', quantity: 1 },
        { name: 'Javelin', quantity: 8 },
        { name: "Dungeoneer's Pack", quantity: 1 },
      ],
    },
    {
      id: 'B',
      gold: 11,
      items: [
        { name: 'Studded Leather', quantity: 1 },
        { name: 'Scimitar', quantity: 1 },
        { name: 'Shortsword', quantity: 1 },
        { name: 'Longbow', quantity: 1 },
        { name: 'Arrows (20)', quantity: 1 },
        { name: 'Quiver', quantity: 1 },
        { name: "Dungeoneer's Pack", quantity: 1 },
      ],
    },
    { id: 'C', items: [], gold: 155 },
  ],
  goldOption: null,
};
// Bard: (A) Leather, 2 Daggers, Musical Instrument choice,
// Entertainer's Pack, 19 GP; goldOption 90.
const BARD_PACKAGES = {
  classId: 'bard',
  options: [
    {
      id: 'A',
      gold: 19,
      items: [
        { name: 'Leather', quantity: 1 },
        { name: 'Dagger', quantity: 2 },
        { key: 'instrument', choose: 1, count: 1, label: 'Musical Instrument', from: 'any_musical_instrument' },
        { name: "Entertainer's Pack", quantity: 1 },
      ],
    },
  ],
  goldOption: 90,
};
// Monk: (A) Spear, 5 Daggers, Artisan's Tools OR Musical Instrument
// (a fork of two nested choices), Explorer's Pack, 11 GP;
// goldOption 50.
const MONK_PACKAGES = {
  classId: 'monk',
  options: [
    {
      id: 'A',
      gold: 11,
      items: [
        { name: 'Spear', quantity: 1 },
        { name: 'Dagger', quantity: 5 },
        {
          key: 'toolOrInstrument',
          choose: 1,
          count: 1,
          label: "Artisan's Tools or Musical Instrument",
          from: [
            [{ key: 'tool', choose: 1, count: 1, label: "Artisan's Tools", from: 'any_artisan_tool' }],
            [{ key: 'instrument', choose: 1, count: 1, label: 'Musical Instrument', from: 'any_musical_instrument' }],
          ],
        },
        { name: "Explorer's Pack", quantity: 1 },
      ],
    },
  ],
  goldOption: 50,
};
// Blackguard (A): c1 Weapons is a fork of two BUNDLES, each carrying
// a nested choice (martial weapon + shield, or two martial weapons);
// goldOption null (source-silent).
const BLACKGUARD_PACKAGES = {
  classId: 'blackguard',
  options: [
    {
      id: 'A',
      gold: 0,
      items: [
        {
          key: 'c1', choose: 1, count: 1, label: 'Weapons',
          from: [
            { items: [{ key: 'c1a', choose: 1, count: 1, label: 'Martial Weapon', from: 'any_martial_weapon' }, { name: 'Shield', quantity: 1 }] },
            { items: [{ key: 'c1b', choose: 1, count: 2, label: 'Martial Weapons', from: 'any_martial_weapon' }] },
          ],
        },
        { name: 'Chain Mail', quantity: 1 },
      ],
    },
  ],
  goldOption: null,
};
// Warden (A): c1 Armor has a third alternative gated by a
// display-only condition ("Proficient with heavy armor").
const WARDEN_PACKAGES = {
  classId: 'warden',
  options: [
    {
      id: 'A',
      gold: 0,
      items: [
        {
          key: 'c1', choose: 1, count: 1, label: 'Armor',
          from: [
            [{ name: 'Chain Shirt', quantity: 1 }],
            { items: [{ name: 'Leather', quantity: 1 }, { name: 'Spear', quantity: 1 }] },
            { items: [{ name: 'Chain Mail', quantity: 1 }], condition: 'Proficient with heavy armor' },
          ],
        },
        { name: 'Shield', quantity: 1 },
      ],
    },
  ],
  goldOption: null,
};
// Magus (A): c3 Focus is a fork of nested focus choices (arcane /
// druidic) or a fixed Component Pouch.
const MAGUS_PACKAGES = {
  classId: 'magus',
  options: [
    {
      id: 'A',
      gold: 0,
      items: [
        {
          key: 'c3', choose: 1, count: 1, label: 'Focus',
          from: [
            [{ key: 'c3a', choose: 1, count: 1, label: 'Arcane Focus', from: 'any_arcane_focus' }],
            [{ key: 'c3b', choose: 1, count: 1, label: 'Druidic Focus', from: 'any_druidic_focus' }],
            [{ name: 'Component Pouch', quantity: 1 }],
          ],
        },
        { name: "Explorer's Pack", quantity: 1 },
      ],
    },
  ],
  goldOption: null,
};
// Verified-good Stage 4 fixture, reused for the marker HTTP group:
// dwarf (Hill) / soldier cleric, point-buy bases cost exactly 27,
// finals = base + Hill variant total {con:2, wis:1} + soldier theme
// {str:2, con:1}. Wis 16 -> mod +3 -> cleric prepares 4.
const DWARF_BASE = { str: 12, dex: 10, con: 13, int: 8, wis: 15, cha: 14 };
const DWARF_FINAL = { str: 14, dex: 10, con: 16, int: 8, wis: 16, cha: 14 };
const DWARF_PREPARED = ['bless', 'cure wounds', 'guiding bolt', 'shield of faith'];

// (a) Contract normalization -----------------------------------------
group('(a) Starting-packages contract shape');
{
  const fighter = normalizePackageData(FIGHTER_PACKAGES);
  check(fighter && fighter.classId === 'fighter', 'fighter fixture normalizes with its classId');
  check(fighter && fighter.options.length === 2 && fighter.options[0].id === 'A' && fighter.options[1].id === 'B',
    `fighter fixture keeps options A + B (got ${JSON.stringify(fighter?.options?.map(o => o.id))})`);
  check(fighter && fighter.options[0].gold === 4 && fighter.options[1].gold === 11,
    'fighter package gold rides per option (A 4 GP, B 11 GP)');
  check(goldOptionBaseline(fighter?.goldOption) === 155, 'fighter goldOption baseline is 155 GP (a NUMBER, not an object)');
  // Reading 1: (C) served as an option folds into goldOption.
  const folded = normalizePackageData(FIGHTER_PACKAGES_C_OPTION);
  check(folded && folded.options.length === 2 && folded.options.every(o => o.id !== 'C'),
    'gold-only (C) option folds out of the package cards');
  check(goldOptionBaseline(folded?.goldOption) === 155,
    'gold-only (C) option folds into the goldOption baseline (155 GP)');
  check(JSON.stringify(folded?.options.map(o => o.id)) === JSON.stringify(['A', 'B']),
    'both route readings normalize to the same options (A, B)');
  const bard = normalizePackageData(BARD_PACKAGES);
  check(bard && bard.options.length === 1 && goldOptionBaseline(bard.goldOption) === 90,
    'bard fixture: one package (A) + 90 GP gold option');
  check(normalizePackageData(null) === null, 'null response normalizes to null (no invented packages)');
  check(normalizePackageData({ classId: 'fighter', options: [] }) === null, 'empty options normalizes to null');
  check(normalizePackageData({ classId: 'fighter' }) === null, 'missing options normalizes to null');
  check(normalizePackageData({ classId: 'fighter', options: [{ id: 'A', items: 'not-an-array' }] }) === null,
    'non-array items normalizes to null');
}

// (b) Package entry parsing ------------------------------------------
group('(b) Package entry parsing');
{
  // Object shapes — the live route's only shapes.
  const sword = parsePackageItem({ name: 'Longsword', quantity: 1 });
  check(sword.kind === 'fixed' && sword.name === 'Longsword' && sword.quantity === 1,
    'object {name, quantity} parses as fixed');
  const javelins = parsePackageItem({ name: 'Javelin', quantity: 8 });
  check(javelins.kind === 'fixed' && javelins.quantity === 8, 'object {name: Javelin, quantity: 8} parses to quantity 8');
  const instr = parsePackageItem(BARD_PACKAGES.options[0].items[2]);
  check(instr.kind === 'choice' && instr.key === 'instrument' && instr.count === 1 && instr.from === 'any_musical_instrument',
    `bard instrument entry parses as a choice keyed 'instrument' on any_musical_instrument (got ${JSON.stringify(instr)})`);
  const holy = parsePackageItem({
    key: 'holy', choose: 1, count: 1, label: 'Holy Symbol',
    from: [{ name: 'Amulet', quantity: 1 }, { name: 'Emblem', quantity: 1 }, { name: 'Reliquary', quantity: 1 }],
  });
  check(holy.kind === 'choice' && Array.isArray(holy.from) && holy.from.length === 3,
    'holy-symbol entry parses as a choice over 3 fixed alternatives');
  const bundle = parsePackageItem({ items: [{ name: 'Shield', quantity: 1 }, { name: 'Longsword', quantity: 1 }] });
  check(bundle.kind === 'bundle' && bundle.entries.length === 2, 'object {items} parses as a bundle');
  const arrayEntry = parsePackageItem([{ name: 'Chain Shirt', quantity: 1 }]);
  check(arrayEntry.kind === 'bundle' && arrayEntry.entries.length === 1, 'a bare array entry parses as a bundle');
  const goldEntry = parsePackageItem({ gold: 7 });
  check(goldEntry.kind === 'gold' && goldEntry.amount === 7, 'object {gold} parses as package gold');
  // Alternative labels + conditions (the radio list text).
  check(alternativeLabel({ name: 'Longsword', quantity: 1 }) === 'Longsword',
    'a fixed alternative labels as its name');
  check(alternativeLabel({ items: [{ name: 'Light Crossbow', quantity: 1 }, { name: 'Crossbow Bolts (20)', quantity: 1 }] }) === 'Light Crossbow + Crossbow Bolts (20)',
    'a bundle alternative labels as its items joined with +');
  check(alternativeLabel([{ key: 'tool', choose: 1, count: 1, label: "Artisan's Tools", from: 'any_artisan_tool' }]) === "Artisan's Tools",
    'a nested-choice alternative labels as its label');
  check(alternativeCondition(WARDEN_PACKAGES.options[0].items[0].from[2]) === 'Proficient with heavy armor',
    'warden heavy-armor alternative carries its display-only condition');
  check(alternativeCondition(WARDEN_PACKAGES.options[0].items[0].from[0]) === null,
    'an unconditioned alternative carries no condition');
  // Reachable keys + stale-branch pruning (the resolver refuses a
  // pick that does not apply to the selected alternative).
  const monkItems = MONK_PACKAGES.options[0].items;
  check(reachableChoiceKeys(monkItems, { toolOrInstrument: { alternative: 0 } }).has('tool')
    && !reachableChoiceKeys(monkItems, { toolOrInstrument: { alternative: 0 } }).has('instrument'),
    'monk fork 0: the tool key is reachable, the instrument key is not');
  check(reachableChoiceKeys(monkItems, { toolOrInstrument: { alternative: 1 } }).has('instrument')
    && !reachableChoiceKeys(monkItems, { toolOrInstrument: { alternative: 1 } }).has('tool'),
    'monk fork 1: the instrument key is reachable, the tool key is not');
  check(reachableChoiceKeys(monkItems, {}).size === 1 && reachableChoiceKeys(monkItems, {}).has('toolOrInstrument'),
    'monk with no fork taken: only the fork key itself is reachable');
  const pruned = prunePicks(monkItems, { toolOrInstrument: { alternative: 1 }, tool: ['Hammer'], instrument: ['Lute'] });
  check(!('tool' in pruned) && pruned.instrument[0] === 'Lute',
    'switching the monk fork prunes the abandoned tool pick and keeps the instrument pick');
  const blackguardItems = BLACKGUARD_PACKAGES.options[0].items;
  check(reachableChoiceKeys(blackguardItems, { c1: { alternative: 0 } }).has('c1a')
    && !reachableChoiceKeys(blackguardItems, { c1: { alternative: 0 } }).has('c1b'),
    'blackguard fork 0: nested c1a reachable, c1b not');
  // Fixed items under the current picks (the AC display's input).
  const fighterA = selectedFixedItems(FIGHTER_PACKAGES.options[0], {});
  check(fighterA.some(i => i.name === 'Chain Mail') && fighterA.some(i => i.name === 'Javelin' && i.quantity === 8),
    'fighter (A) fixed items include Chain Mail and 8 Javelins');
  const wardenNoPick = selectedFixedItems(WARDEN_PACKAGES.options[0], {});
  check(!wardenNoPick.some(i => i.name === 'Chain Mail') && wardenNoPick.some(i => i.name === 'Shield'),
    'warden with no armor fork taken grants no armor yet (Shield is fixed)');
  const wardenHeavy = selectedFixedItems(WARDEN_PACKAGES.options[0], { c1: { alternative: 2 } });
  check(wardenHeavy.some(i => i.name === 'Chain Mail'),
    'warden with the heavy-armor alternative taken grants Chain Mail');
  const magusNoPick = selectedFixedItems(MAGUS_PACKAGES.options[0], {});
  check(!magusNoPick.some(i => i.name === 'Component Pouch'),
    'magus with no focus fork taken grants no focus yet');
  // String entries are a fallback only (the route sends objects).
  check(parsePackageItem('2 Daggers').kind === 'fixed' && parsePackageItem('2 Daggers').quantity === 2,
    'string fallback: "2 Daggers" parses to quantity 2');
  check(parsePackageItem('15 GP').kind === 'gold' && parsePackageItem('15 GP').amount === 15,
    'string fallback: "15 GP" parses as package gold, not an item');
  const instrStr = parsePackageItem('Musical Instrument of your choice');
  check(instrStr.kind === 'choice' && instrStr.from === 'any_musical_instrument',
    'string fallback: instrument-of-choice parses as any_musical_instrument');
  const anyTwo = parsePackageItem('any two simple weapons');
  check(anyTwo.kind === 'choice' && anyTwo.from === 'any_simple_weapon' && anyTwo.count === 2,
    'string fallback: "any two simple weapons" parses as any_simple_weapon x2');
  check(parsePackageItem(null).kind === 'text', 'null entry degrades to text, never throws');
  check(parsePackageItem('').kind === 'text', 'empty entry degrades to text, never throws');
}

// (c) Category sentinels (choiceOptions.js Stage 5 extension) --------
group('(c) Package category sentinels');
{
  const count = (s) => (resolveChoiceOptions({ options: s }) || []).length;
  check(count('any_simple_weapon') === 15, `any_simple_weapon resolves 15 (got ${count('any_simple_weapon')})`);
  check(count('any_simple_melee_weapon') === 11, 'any_simple_melee_weapon resolves 11');
  check(count('any_simple_ranged_weapon') === 4, 'any_simple_ranged_weapon resolves 4');
  check(count('any_martial_melee_weapon') === 20, 'any_martial_melee_weapon resolves 20');
  check(count('any_martial_ranged_weapon') === 6, 'any_martial_ranged_weapon resolves 6');
  check(count('any_weapon') === 41, `any_weapon resolves all 41 — 38 chapter + 3 setting (got ${count('any_weapon')})`);
  check(count('any_martial_weapon') === 26, 'any_martial_weapon still resolves 26 (20 + 6, Musket/Pistol in)');
  check(count('any_light_armor') === 3, 'any_light_armor resolves 3');
  check(count('any_medium_armor') === 5, 'any_medium_armor resolves 5');
  check(count('any_heavy_armor') === 4, 'any_heavy_armor resolves 4');
  check(count('any_armor') === 12, 'any_armor resolves 12');
  check(count('any_pack') === 7, 'any_pack resolves 7');
  check(count('any_tool_kit') === 6, 'any_tool_kit resolves 6');
  check(count('any_gaming_set') === 4, 'any_gaming_set resolves 4');
  check(count('any_arcane_focus') === 5, 'any_arcane_focus resolves 5');
  check(count('any_druidic_focus') === 3, 'any_druidic_focus resolves 3 (Totem is gone from the 2024 bank)');
  check(count('any_holy_symbol') === 3, 'any_holy_symbol resolves 3');
  check(count('any_instrument') === 10, 'any_instrument still resolves 10');
  check(count('any_musical_instrument') === 10, 'any_musical_instrument (the route key) resolves 10, same list as any_instrument');
  check(JSON.stringify(resolveChoiceOptions({ options: 'any_musical_instrument' })) === JSON.stringify(resolveChoiceOptions({ options: 'any_instrument' })),
    'any_musical_instrument and any_instrument resolve to the same list');
  check(describeSentinel('any_simple_weapon') === 'any simple weapon', 'describeSentinel labels the simple-weapon category');
  check(describeSentinel('any_musical_instrument') === 'any musical instrument', 'describeSentinel labels the route instrument key');
  check(resolveChoiceOptions({ options: 'any_not_a_sentinel' }) === null, 'an unknown sentinel still returns null (free-text input, never a crash)');
  // Dedup gray-out: the composition the picker uses.
  const instruments = resolveChoiceOptions({ options: 'any_musical_instrument' }) || [];
  check(isHeldOption('Lute', ['Lute']) && !isHeldOption('Lute', ['Drum']),
    'isHeldOption matches a held instrument case-insensitively and misses an unheld one');
  check(instruments.some(o => o.value === 'Lute') && instruments.filter(o => isHeldOption(o.value, ['Lute'])).length === 1,
    'exactly one instrument grays out against a held Lute');
  check(normalizeChoiceValues(['Lute', 'lute', 'Drum'], 2).join('|') === 'Lute|Drum',
    'category slots dedupe case-insensitively and cap at the count');
}

// (d) Gold fork -------------------------------------------------------
group('(d) Gold fork: baseline, theme modifier, silent classes');
{
  check(goldOptionBaseline(null) === null, 'goldOption null -> no baseline');
  check(goldOptionBaseline(155) === 155, 'bare number 155 -> baseline 155');
  check(goldOptionBaseline(90) === 90, 'bare number 90 -> baseline 90');
  check(goldOptionBaseline({ gold: 155 }) === 155, '{gold: 155} -> baseline 155');
  check(goldOptionBaseline({ average: 50 }) === 50, '{average: 50} -> baseline 50');
  check(goldOptionBaseline({ gold: null }) === null, '{gold: null} -> no baseline');
  check(computedGold(null, 'noble') === null, 'no baseline -> no computed gold, whatever the theme');
  check(computedGold(90, 'noble') === 135, 'noble +50%: 90 GP -> 135 GP');
  check(computedGold(50, 'urchin') === 25, 'urchin -50%: 50 GP -> 25 GP');
  check(computedGold(100, 'soldier') === 100, 'soldier 0%: 100 GP unchanged');
  check(computedGold(155, 'charlatan') === 202, 'charlatan +30%: 155 GP -> 202 GP (round(155 x 1.3))');
  check(computedGold(50, 'hermit') === 33, 'hermit -35%: 50 GP -> 33 GP (round(50 x 0.65))');
  check(computedGold(90, 'unknown-theme') === 90, 'unknown theme -> no modifier, baseline stands');
  check(JSON.stringify([...GOLD_SILENT_CLASSES].sort()) === JSON.stringify(['blackguard', 'magus', 'pugilist', 'scholar', 'spellshot', 'warden']),
    `the six source-silent classes are exactly the gold-silent set (got ${JSON.stringify(GOLD_SILENT_CLASSES)})`);
  for (const cls of GOLD_SILENT_CLASSES) {
    check(goldOptionBaseline(normalizePackageData({ classId: cls, options: [{ id: 'A', items: [{ name: 'Leather', quantity: 1 }], gold: 0 }], goldOption: null })?.goldOption) === null,
      `${cls} with goldOption null has no gold baseline (grayed-out fork)`);
  }
  const bardGold = computedGold(goldOptionBaseline(BARD_PACKAGES.goldOption), 'noble');
  check(bardGold === 135, 'bard gold fork: 90 GP x noble +50% = 135 GP display');
}

// (e) Display prices/weights (corrected 2024 equipment.json) ---------
group('(e) Display prices/weights from the corrected bank');
{
  const lance = priceForItem('Lance');
  check(lance && lance.costGp === 10, `Lance prices at 10 gp in the corrected bank (got ${JSON.stringify(lance)})`);
  const priest = priceForItem("Priest's Pack");
  check(priest && priest.costGp === 33 && priest.weight === 29,
    `Priest's Pack prices at 33 gp / 29 lb in the corrected bank (got ${JSON.stringify(priest)})`);
  const lute = priceForItem('Lute');
  check(lute && lute.costGp === 35 && lute.weight === 2, 'Lute prices at 35 gp / 2 lb (priced instrument)');
  const crystal = priceForItem('Arcane Focus (crystal)');
  check(crystal && crystal.costGp === 10, 'Arcane Focus (crystal) prices as the Crystal focus, 10 gp');
  const mistletoe = priceForItem('Druidic Focus (sprig of mistletoe)');
  check(mistletoe && mistletoe.costGp === 1, 'Druidic Focus (sprig of mistletoe) prices at 1 gp');
  const arrows = priceForItem('20 Arrows');
  check(arrows && arrows.costGp === 1, '"20 Arrows" prices as the Arrows (20) bundle, 1 gp');
  const bolts = priceForItem('20 Bolts');
  check(bolts && bolts.costGp === 1, '"20 Bolts" prices as the Crossbow Bolts (20) bundle, 1 gp');
  const book = priceForItem('Book');
  check(book && book.costGp === 25 && book.weight === 5, 'Book prices at 25 gp / 5 lb (warlock package item)');
  const leather = priceForItem('Leather');
  check(leather && leather.costGp === 10, 'Leather (chapter name) prices at 10 gp');
  check(priceForItem('Sabre') === null, 'Sabre (chapter-external duelist weapon) shows no price, never invented');
  check(priceForItem('A Worn Leather-Bound Journal') === null, 'the keeper journal (chapter-external) shows no price, never invented');
  const studded = armorEntryFor('Studded Leather Armor');
  check(studded && studded.baseAC === 12 && studded.armorType === 'light',
    '"Studded Leather Armor" (package spelling) resolves to the Studded Leather bank row, base AC 12');
  const chainMail = armorEntryFor('Chain Mail');
  check(chainMail && chainMail.baseAC === 16 && chainMail.armorType === 'heavy',
    'Chain Mail resolves, base AC 16, heavy');
  check(armorEntryFor('Leather Armor')?.baseAC === 11, 'Leather Armor resolves, base AC 11');
  check(armorEntryFor('Not Armor') === null, 'an unknown armor name resolves to null, never invented');
  check(priceForItem('Bag of 1000 Ball Bearings') === null,
    'an item the bank cannot price shows no price, never a guessed one');
  check(priceForItem('Book (occult lore)') === null, 'a flavor item with no bank row shows no price');
}

// (f) Derived HP / AC / speed (display only) --------------------------
group('(f) Derived HP/AC/speed display');
{
  const fighter = (over) => deriveLevel1Stats({
    hitDie: 10, conScore: 14, dexScore: 14,
    armorName: 'Chain Mail', hasShield: false, walkSpeed: 30, ...over,
  });
  check(fighter().hp === 12, `fighter Con 14: HP = 10 + 2 = 12 (got ${fighter().hp})`);
  check(fighter().ac === 16, `fighter Chain Mail + Dex 14: AC 16 (got ${fighter().ac})`);
  check(fighter({ armorName: 'Studded Leather Armor', dexScore: 16 }).ac === 15,
    'Studded Leather + Dex 16: AC 12 + 3 = 15');
  check(fighter({ armorName: 'Studded Leather Armor', dexScore: 16, hasShield: true }).ac === 17,
    'Studded Leather + Dex 16 + shield: AC 17');
  check(fighter({ armorName: 'Scale Mail', dexScore: 18 }).ac === 16,
    'Scale Mail + Dex 18: AC 14 + 2 (medium caps Dex at +2) = 16');
  check(fighter({ armorName: null }).ac === 12, 'no armor: AC 10 + Dex 2 = 12 (before armor)');
  check(fighter({ conScore: null }).hp === null, 'no Constitution placed yet: HP shows blank, never 0');
  check(fighter({ dexScore: null }).ac === null, 'no Dexterity placed yet: AC shows blank, never 10');
  check(deriveLevel1Stats({ hitDie: 6, conScore: 1, dexScore: 10, armorName: null, hasShield: false, walkSpeed: 30 }).hp === 1,
    'HP floors at 1 (hit die 6 + Con mod -5)');
  check(deriveLevel1Stats({ hitDie: 12, conScore: 16, dexScore: 10, armorName: null, hasShield: false, walkSpeed: 25 }).speed === 25,
    'walk speed reads the species speed (dwarf 25)');
  check(abilityModifier(16) === 3 && abilityModifier(8) === -1 && abilityModifier(10) === 0,
    'abilityModifier: 16 -> +3, 8 -> -1, 10 -> 0');
}

// (g) Persistence: save-body fields -----------------------------------
group('(g) Save-body fields (buildStage1ProgressBody / blankStage1State)');
{
  const blank = blankStage1State();
  check(blank.gear_choice === '' && blank.package_id === '' && Array.isArray(blank.package_picks) === false && Object.keys(blank.package_picks || {}).length === 0,
    'blank state carries empty gear picks, never a default fork');
  check(blank.stage5PicksClass === '', 'blank state carries an empty stage5PicksClass');
  check(blank.alignment === '' && blank.faith === '' && blank.backstory === '' && blank.other_notes === '',
    'blank state carries empty story fields');
  check(Object.keys(buildStage1ProgressBody(blank)).length === 0,
    'a blank Stage 5 still builds an empty save body (blank-save guard keeps its meaning)');
  const picked = {
    ...blank,
    gear_choice: 'packages', package_id: 'A',
    package_picks: { A: { instrument: ['Lute'] } },
    alignment: 'Chaotic Good', faith: 'Tymora', lifestyle: 'Modest',
    age: '27', height: "5'9\"", weight: '150 lb',
    eye_color: 'Green', hair_color: 'Black', skin_color: 'Tan', physical_build: 'Wiry',
    personality_traits: 'Laughs at danger.', ideals: 'Freedom.', bonds: 'My sister.',
    flaws: 'Too trusting.', organizations: 'Harpers', allies: 'Mira', enemies: 'The Red Wizard',
    backstory: 'Left home at sixteen.', other_notes: 'Afraid of deep water.',
  };
  const body = buildStage1ProgressBody(picked);
  check(body.gear_choice === 'packages', 'packages fork sends gear_choice');
  check(body.package_id === 'A', 'packages fork sends package_id');
  check(body.package_picks === J({ A: { instrument: ['Lute'] } }),
    'package_picks rides as a JSON STRING on the wire (Stage 4 stringify rule), keyed by the choice key');
  check(body.alignment === 'Chaotic Good' && body.faith === 'Tymora' && body.lifestyle === 'Modest',
    'alignment / faith / lifestyle ride the save body as plain strings');
  check(body.backstory === 'Left home at sixteen.' && body.other_notes === 'Afraid of deep water.',
    'backstory / other_notes ride the save body');
  check(body.age === '27' && body.height === "5'9\"" && body.physical_build === 'Wiry',
    'age / height / physical_build ride the save body');
  check(body.eye_color === 'Green' && body.hair_color === 'Black' && body.skin_color === 'Tan',
    'eye / hair / skin color ride the save body');
  check(body.personality_traits === 'Laughs at danger.' && body.ideals === 'Freedom.' && body.bonds === 'My sister.' && body.flaws === 'Too trusting.',
    'personality / ideals / bonds / flaws ride the save body');
  check(body.organizations === 'Harpers' && body.allies === 'Mira' && body.enemies === 'The Red Wizard',
    'organizations / allies / enemies ride the save body');
  check(!('distinguishing_features' in body), 'no distinguishing-features field rides the body (not collected yet — the column exists, migration 060)');
  const forkBody = buildStage1ProgressBody({
    ...blank, gear_choice: 'packages', package_id: 'A',
    package_picks: { A: { toolOrInstrument: { alternative: 1 }, instrument: ['Lute'] } },
  });
  check(forkBody.package_picks === J({ A: { toolOrInstrument: { alternative: 1 }, instrument: ['Lute'] } }),
    'a fork pick rides as { alternative: index } plus the nested choice under its own key');
  const goldBody = buildStage1ProgressBody({
    ...blank, gear_choice: 'gold', package_id: 'A', package_picks: { A: { instrument: ['Lute'] } },
  });
  check(goldBody.gear_choice === 'gold', 'gold fork sends gear_choice');
  check(!('package_id' in goldBody) && !('package_picks' in goldBody),
    'gold fork sends NO package_id / package_picks (the fork is the choice)');
  const storyOnly = buildStage1ProgressBody({ ...blank, backstory: 'Only a story.' });
  check(storyOnly.backstory === 'Only a story.' && Object.keys(storyOnly).length === 1,
    'a story-only body carries just the story field');
}

// (h) HTTP persist: Stage 5 body round-trips --------------------------
group('(h) HTTP persist (real router + real DB)');
{
  // Marker POST: the passing dwarf/soldier cleric body + Stage 5
  // fields. Gear fields are validation-only picks — the Stage 2/3/4
  // validators must not trip on them, and the story columns must land.
  const created = await postCharacter({
    name: 'S5 Dwarf Cleric', creator: MARKER, class: 'cleric', race: 'dwarf', subrace: 'Hill Dwarf',
    theme_id: 'soldier', generation_method: 'point_buy',
    base_scores: J(DWARF_BASE), ability_scores: J(DWARF_FINAL),
    skills: J(['Athletics', 'Intimidation', 'Religion']),
    languages: J(['Common', 'Dwarvish']),
    prepared_spells: J(DWARF_PREPARED),
    gear_choice: 'packages', package_id: 'A', package_picks: J({ A: { holy: { alternative: 0 } } }),
    alignment: 'Lawful Good', faith: 'Moradin', lifestyle: 'Modest',
    backstory: 'Left the hold at sixteen.', eye_color: 'Brown',
  });
  check(created.status === 201, `marker POST with Stage 5 fields creates 201 (got ${created.status}: ${JSON.stringify(created.json?.error || '')})`);
  const clericId = created.json?.id;
  check(typeof clericId === 'number', 'created row has an id');
  const row = await readCharacter(clericId);
  check(row?.alignment === 'Lawful Good' && row?.faith === 'Moradin' && row?.lifestyle === 'Modest',
    'story columns persist on the row (alignment/faith/lifestyle)');
  check(row?.backstory === 'Left the hold at sixteen.' && row?.eye_color === 'Brown',
    'backstory / eye_color persist on the row');
  // PUT: story edit + gold fork switch persists, still 200.
  const put = await putCharacter(clericId, {
    creator: MARKER, gear_choice: 'gold',
    backstory: 'Left the hold at sixteen, and never looked back.',
    flaws: 'Too trusting.',
  });
  check(put.status === 200, `PUT with Stage 5 fields returns 200 (got ${put.status}: ${JSON.stringify(put.json?.error || '')})`);
  const rowAfter = await readCharacter(clericId);
  check(rowAfter?.backstory === 'Left the hold at sixteen, and never looked back.' && rowAfter?.flaws === 'Too trusting.',
    'PUT persists the edited story fields');
  // Story-only POST without the marker still creates (no validation
  // gate on plain story columns).
  const storyOnly = await postCharacter({
    name: 'S5 Story Only', race: 'human', class: 'fighter',
    alignment: 'True Neutral', backstory: 'No gear yet.',
  });
  check(storyOnly.status === 201, `story-only POST creates 201 (got ${storyOnly.status})`);
  check(await characterCountByName('S5 Story Only') === 1, 'story-only POST created exactly one row');
  const storyRow = await readCharacter(storyOnly.json?.id);
  check(storyRow?.alignment === 'True Neutral' && storyRow?.backstory === 'No gear yet.',
    'story-only row carries its story columns');
}

// (i) Shell + persistence + component static guards -------------------
group('(i) Shell wiring + static guards');
{
  const shellSrc = readRepo('client/src/components/creator-next/CreatorNextShell.jsx');
  check(shellSrc.includes("import Stage5GearStory from './Stage5GearStory.jsx'"),
    'shell imports Stage5GearStory');
  check(shellSrc.includes('step === 4') && shellSrc.includes('<Stage5GearStory'),
    'shell renders Stage 5 at step === 4');
  check(shellSrc.includes('step === 1 || step === 2 || step === 3 || step === 4'),
    'shell autosaves on the Stage 5 advance (step 4 in the save branch)');
  check(!shellSrc.includes('if (step > 4) { setStep(0); return }'),
    'shell stub bounce is gone (no step > 4 return to Stage 1)');
  check(shellSrc.includes('if (step === 5)'),
    'shell step-5 branch is the commit');
  check(shellSrc.includes('Stages 1–6 built'),
    'shell crumbs read Stages 1–6 built');
  check(shellSrc.includes("4: 'Equipment or gold, appearance, and story text.'"),
    'STAGE_NOTES key 4 matches v1 scope (equipment or gold, appearance, story text)');
  const stage5Src = readRepo('client/src/components/creator-next/Stage5GearStory.jsx');
  // Heirloom is documented as deferred in the header comment, but
  // there is no heirloom picker in code: strip comments first, then
  // the word must be gone entirely (no field, state key, or label).
  const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  check(!stripComments(shellSrc).toLowerCase().includes('heirloom'), 'shell code (comments stripped) carries no heirloom');
  check(!stripComments(stage5Src).toLowerCase().includes('heirloom'), 'Stage 5 code (comments stripped) carries no heirloom picker');
  // R2-6 S13: the banner was rewritten to plain player language —
  // the old "Server not reachable" string is gone by decision.
  check(stage5Src.includes('Couldn&apos;t load the starting packages'),
    'Stage 5 shows the visible packages-load-failure banner on fetch failure');
  check(stage5Src.includes('Server-derived at save'), 'Stage 5 labels HP/AC/speed as server-derived at save');
  check(stage5Src.includes("No starting-gold value in"),
    'Stage 5 carries the no-starting-gold tooltip for silent classes');
  check(stage5Src.includes('prunePicks') && stage5Src.includes('reachableChoiceKeys'),
    'Stage 5 prunes stale-branch picks when an alternative changes');
  check(stage5Src.includes('alternativeCondition'),
    'Stage 5 renders the display-only condition on a bundle alternative');
  check(stage5Src.includes('any_musical_instrument'),
    'Stage 5 handles the route instrument sentinel (any_musical_instrument)');
  // Tooltips: most ride the textField/selectField helpers (one <Tip>
  // in code renders one per field), so count literal uses plus the
  // helper call sites that each render one. R2-14 removed one
  // redundant literal <Tip> (story helpers now render the tip as a
  // visible help line), so the literal floor is 8, not 9.
  const tipCount = (stage5Src.match(/<Tip /g) || []).length;
  const fieldTips = (stage5Src.match(/textField\('/g) || []).length + (stage5Src.match(/selectField\('/g) || []).length;
  check(tipCount >= 8 && fieldTips >= 19,
    `Stage 5 carries tooltips on its choices (${tipCount} literal <Tip> uses + ${fieldTips} helper-rendered field tooltips)`);
}

// (j) No new columns needed -------------------------------------------
group('(j) Story columns already exist (no migration)');
{
  const routeSrc = readRepo('server/routes/character.js');
  for (const col of ['alignment', 'faith', 'lifestyle', 'backstory', 'other_notes', 'physical_build']) {
    check(routeSrc.includes(`'${col}'`), `PUT allowlist carries '${col}'`);
  }
}

// (k) Bundled Stage 5 client logic (real esbuild bundle) --------------
group('(k) Bundled Stage 5 client logic (real esbuild bundle)');
{
  const s5 = stage5;
  check(fs.existsSync(stage5BundleOut) && fs.statSync(stage5BundleOut).size > 1000, 'Stage 5 bundles against the real Tooltip/choiceOptions/classes/equipment/themeGoldModifiers/deities');
  check(typeof s5.default === 'function', 'bundled Stage 5 default export is the component');
    check(s5.goldOptionBaseline(155) === 155, 'bundled goldOptionBaseline reads a bare number baseline');
    check(s5.computedGold(90, 'noble') === 135, 'bundled computedGold(90, noble) is 135');
    check(s5.parsePackageItem({ name: 'Javelin', quantity: 8 }).quantity === 8, 'bundled parsePackageItem reads the object quantity');
    check(s5.parsePackageItem(BARD_PACKAGES.options[0].items[2]).from === 'any_musical_instrument',
      'bundled parsePackageItem reads the bard instrument choice');
    check(s5.alternativeLabel({ items: [{ name: 'Shield', quantity: 1 }, { name: 'Longsword', quantity: 1 }] }) === 'Shield + Longsword',
      'bundled alternativeLabel joins bundle items with +');
    check(s5.prunePicks(MONK_PACKAGES.options[0].items, { toolOrInstrument: { alternative: 1 }, tool: ['Hammer'] }).tool === undefined,
      'bundled prunePicks drops the abandoned monk tool pick');
    check(s5.selectedFixedItems(WARDEN_PACKAGES.options[0], { c1: { alternative: 2 } }).some(i => i.name === 'Chain Mail'),
      'bundled selectedFixedItems grants Chain Mail only on the taken warden alternative');
    check(s5.deriveLevel1Stats({ hitDie: 10, conScore: 14, dexScore: 14, armorName: 'Chain Mail', hasShield: false, walkSpeed: 30 }).hp === 12,
      'bundled deriveLevel1Stats gives a fighter HP 12');
    check(s5.normalizePackageData(FIGHTER_PACKAGES_C_OPTION).options.length === 2,
      'bundled normalizePackageData folds the gold-only (C) option');
    check(JSON.stringify(s5.GOLD_SILENT_CLASSES) === JSON.stringify(['blackguard', 'magus', 'pugilist', 'scholar', 'spellshot', 'warden']),
      'bundled GOLD_SILENT_CLASSES lists the six source-silent classes');
  // The shell bundles too (it imports Stage 5 + Stages 1–4 +
  // persistence + validation): every import resolves after the
  // coordinator's edits.
  try {
    const out = bundle('client/src/components/creator-next/CreatorNextShell.jsx', 'shell.bundle.mjs');
    check(fs.existsSync(out) && fs.statSync(out).size > 1000, 'shell bundles against the real Stage 5 + Stages 1–4 + persistence');
    const shellMod = await import(pathToFileURL(out).href);
    check(typeof shellMod.default === 'function', 'bundled shell default export is the component');
  } catch (e) {
    check(false, `shell esbuild bundle failed: ${e.message}`);
  }
}

server.close();
console.log(`=== Results: ${passed} passed, ${failed} failed ===`);
process.exit(failed ? 1 : 0);
