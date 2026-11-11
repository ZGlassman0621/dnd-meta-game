/*
 * tests/gear-items.test.js — Tools and Gear bank.
 *
 * MAC-READY, STAGING ONLY: this file is written to be copied unchanged
 * to tests/gear-items.test.js on the Mac. Its import is the Mac
 * path (../server/data/gearItems.js), so in staging it is
 * syntax-checked only (node --check) and is NOT runnable here — the
 * Mac path does not exist on the VM. The Mac gate
 * (npm test -- gear-items) is the real run. This module is pure
 * data, so no database is needed. A local runner (not pushed) imports
 * the staging module directly and runs the same assertions on the VM.
 *
 * Pins (same assert/group style as tests/villain-templates.test.js):
 *   - 282 items total, counts per category: general-item 127,
 *     equipment-pack 34, container 29, magical-implement 32,
 *     artisan-tool 19, gaming-set 11, musical-instrument 22,
 *     misc-tool 8 — the book's priced tables, no entry dropped
 *   - every item has exactly the 7 keys id/name/category/cost/
 *     weight/costBasis/sourceBook, no mechanics keys (no dc/damage/
 *     effect/stat) and no description field carrying book prose
 *   - ids are unique, slug-form, and match gearIds() order
 *   - cost matches +?N gp/sp/cp or '—'; weight matches N lb. (with
 *     fractions and '+' allowed) or '—'; costBasis is 'book' for
 *     every entry (book prices, NOT claimed as verified 2024 PHB
 *     prices — see the module header for the precedence rule)
 *   - spot checks against the book tables: bedroll 1 gp / 7 lb.,
 *     spyglass 1,000 gp / 1 lb., clothes-camouflage 10 gp / 3 lb.,
 *     arcane-focus-crystal 10 gp / 1 lb., backpack 2 gp / 5 lb.,
 *     artisans-pack 38 gp / 41+ lb., emblem +5 gp / '—'
 *   - helpers: gearById returns a copy or null, gearItems() returns
 *     a copy, gearByCategory filters exactly, unknown category is []
 */
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');

const svc = (p) => pathToFileURL(path.join(REPO, p)).href;
const { GEAR_ITEMS, gearItems, gearById, gearIds, gearByCategory } = await import(
  svc('server/data/gearItems.js')
);

let passed = 0;
let failed = 0;
function assert(cond, msg) {
  if (cond) {
    passed++;
  } else {
    failed++;
    console.log(`  ✗ ${msg}`);
  }
}
function group(name) {
  console.log(`\n== ${name}`);
}
const eq = (a, b) => a === b;

const EXPECTED_COUNTS = {
  'general-item': 127,
  'equipment-pack': 34,
  container: 29,
  'magical-implement': 32,
  'artisan-tool': 19,
  'gaming-set': 11,
  'musical-instrument': 22,
  'misc-tool': 8,
};
const EXPECTED_KEYS = ['category', 'cost', 'costBasis', 'id', 'name', 'sourceBook', 'weight'];
const COST_RE = /^(?:\+?[\d,]+\s*(?:gp|sp|cp)|—)$/;
const WEIGHT_RE = /^(?:[\d½¼¾\/\.]+\+?\s*lb\.|—)$/;
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

group('Count and category counts');
assert(GEAR_ITEMS.length === 282, `282 items, got ${GEAR_ITEMS.length}`);
for (const [cat, count] of Object.entries(EXPECTED_COUNTS)) {
  const got = GEAR_ITEMS.filter((g) => g.category === cat).length;
  assert(got === count, `${cat}: ${count}, got ${got}`);
  assert(gearByCategory(cat).length === count, `gearByCategory(${cat}) returns ${count}`);
}
assert(gearByCategory('nope').length === 0, 'gearByCategory(unknown) returns []');

group('Exact key shape, formats, uniqueness');
const ids = GEAR_ITEMS.map((g) => g.id);
assert(new Set(ids).size === ids.length, 'ids are unique');
assert(new Set(GEAR_ITEMS.map((g) => g.name)).size === GEAR_ITEMS.length, 'names are unique');
assert(
  eq(JSON.stringify(gearIds()), JSON.stringify(ids)),
  'gearIds() matches module order'
);
for (const g of GEAR_ITEMS) {
  const keys = Object.keys(g).sort();
  assert(
    eq(JSON.stringify(keys), JSON.stringify(EXPECTED_KEYS)),
    `${g.name}: keys are exactly the 7 gear keys, got ${keys.join(',')}`
  );
  assert(typeof g.name === 'string' && g.name.length > 0, `${g.id}: non-empty name`);
  assert(SLUG_RE.test(g.id), `${g.name}: id '${g.id}' is slug-form`);
  assert(COST_RE.test(g.cost), `${g.name}: cost '${g.cost}' matches cost format`);
  assert(WEIGHT_RE.test(g.weight), `${g.name}: weight '${g.weight}' matches weight format`);
  assert(g.costBasis === 'book', `${g.name}: costBasis is 'book', not a 2024-PHB claim`);
  assert(
    g.sourceBook === 'Tools and Gear (Wraith Wright, v5.1, 2022)',
    `${g.name}: sourceBook matches`
  );
}

group('Spot checks against the book tables');
const check = (id, cost, weight) => {
  const g = gearById(id);
  assert(g !== null, `gearById(${id}) returns an item`);
  if (g) {
    assert(g.cost === cost, `${id}: cost ${cost}, got ${g.cost}`);
    assert(g.weight === weight, `${id}: weight ${weight}, got ${g.weight}`);
  }
};
check('bedroll', '1 gp', '7 lb.');
check('spyglass', '1,000 gp', '1 lb.');
check('clothes-camouflage', '10 gp', '3 lb.');
check('arcane-focus-crystal', '10 gp', '1 lb.');
check('backpack', '2 gp', '5 lb.');
check('artisans-pack', '38 gp', '41+ lb.');
check('holy-symbol-emblem', '+5 gp', '—');
check('tent-pavilion', '30 gp', '350 lb.');
check('rations-1-day', '5 sp', '1 lb.');
check('alchemists-supplies', '50 gp', '8 lb.');
check('thieves-tools', '25 gp', '1 lb.');
check('spellbook-travelling', '30 gp', '2 lb.');

group('Helpers copy, unknown id is null');
assert(gearById('nope') === null, 'gearById(nope) returns null');
const copy = gearItems();
assert(copy.length === 282, 'gearItems() returns 282 items');
assert(copy !== GEAR_ITEMS, 'gearItems() returns a copy, not the live array');
assert(copy[0] !== GEAR_ITEMS[0], 'gearItems() copies item objects');
const bedroll = gearById('bedroll');
assert(bedroll !== null && bedroll !== GEAR_ITEMS.find((g) => g.id === 'bedroll'), 'gearById returns a copy');

console.log(`\n=== Results: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
