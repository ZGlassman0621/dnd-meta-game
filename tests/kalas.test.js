/*
 * tests/kalas.test.js — The Town of Kalas data module.
 *
 * MAC-READY, STAGING ONLY: this file is written to be copied unchanged
 * to tests/kalas.test.js on the Mac. Its import is the Mac path
 * (../server/data/kalas.js), so in staging it is syntax-checked
 * only (node --check) and is NOT runnable here — the Mac path does not
 * exist on the VM. The Mac gate (npm test -- kalas) is the
 * real run. This module is pure data, so no database is needed.
 *
 * Pins (same assert/group style as tests/quick-threats.test.js):
 *   - 59 locations, in book order, first entry the Laughing
 *     Hippocampus, last entries the three unnumbered dungeon sites
 *     (Sewers, Sunken Ship, Haunted House)
 *   - every location/NPC/faction/hook object has exactly its required
 *     keys, and no key name is or contains a stat/price key
 *     (hp/ac/dc/gp/xp/reward/level/save/stat exact-matched, and
 *     damage/reward/stat substring-matched — short fragments 'ac'/'dc'
 *     are exact-matched only, since a legitimate key could contain
 *     them)
 *   - every location has non-empty name, type, description; every
 *     NPC has non-empty name and role; npcsAtLocation returns at
 *     least one NPC for the Laughing Hippocampus, verified from the
 *     sort as having people (landlord, wife, wenches, bouncer, and
 *     the hippocampus)
 *   - locationById('laughing-hippocampus') returns the inn entry;
 *     locationById('nope') returns null
 *   - KALAS_META.reskinStatus contains 'pending' (the reskin is
 *     recorded as pending, not silently done or silently dropped)
 *   - KALAS_TRADES is a non-empty array of strings; KALAS_HOOKS is
 *     non-empty
 *   - locations() and npcs() return copies, not the live arrays
 *   - every NPC locationId is either null or a real location id
 *     (no guessed or dangling location link)
 */
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');

const svc = (p) => pathToFileURL(path.join(REPO, p)).href;
const {
  KALAS_META,
  KALAS_LOCATIONS,
  KALAS_NPCS,
  KALAS_FACTIONS,
  KALAS_HOOKS,
  KALAS_TRADES,
  locations,
  locationById,
  locationsByType,
  npcs,
  npcsAtLocation,
  factions,
  trades,
  hooks,
} = await import(svc('server/data/kalas.js'));

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

const LOCATION_KEYS = ['description', 'hook', 'id', 'name', 'proprietor', 'type'];
const NPC_KEYS = ['appearance', 'hook', 'locationId', 'name', 'personality', 'role'];
const FACTION_KEYS = ['description', 'leader', 'name', 'relationships', 'type'];
const HOOK_KEYS = ['description', 'title'];
const FORBIDDEN_KEY_EXACT = ['hp', 'ac', 'damage', 'dc', 'gp', 'xp', 'reward', 'level', 'save', 'stat'];
const FORBIDDEN_KEY_SUBSTRINGS = ['damage', 'reward', 'stat'];

function checkNoStatKeys(obj, label) {
  for (const k of Object.keys(obj)) {
    const lower = k.toLowerCase();
    assert(
      !FORBIDDEN_KEY_EXACT.includes(lower) && !FORBIDDEN_KEY_SUBSTRINGS.some((f) => lower.includes(f)),
      `${label}: key '${k}' is not a stat/reward key`
    );
  }
}

group('Count and book order');
assert(KALAS_LOCATIONS.length === 59, `59 locations, got ${KALAS_LOCATIONS.length}`);
assert(
  KALAS_LOCATIONS[0].name === 'The Laughing Hippocampus',
  `first entry is the Laughing Hippocampus, got ${KALAS_LOCATIONS[0].name}`
);
assert(
  eq(
    JSON.stringify(KALAS_LOCATIONS.slice(-3).map((l) => l.name)),
    JSON.stringify(['The Sewers', 'Sunken Ship', 'Haunted House'])
  ),
  `last entries are the three unnumbered dungeon sites, got ${KALAS_LOCATIONS.slice(-3).map((l) => l.name).join(' / ')}`
);
assert(
  new Set(KALAS_LOCATIONS.map((l) => l.id)).size === KALAS_LOCATIONS.length,
  'no duplicate location ids'
);

group('Exact key shape, no stat/reward keys');
for (const l of KALAS_LOCATIONS) {
  assert(
    eq(JSON.stringify(Object.keys(l).sort()), JSON.stringify(LOCATION_KEYS)),
    `${l.name}: keys are exactly id/name/type/description/proprietor/hook, got ${Object.keys(l).join(',')}`
  );
  checkNoStatKeys(l, l.name);
}
for (const n of KALAS_NPCS) {
  assert(
    eq(JSON.stringify(Object.keys(n).sort()), JSON.stringify(NPC_KEYS)),
    `${n.name}: keys are exactly name/role/locationId/appearance/personality/hook, got ${Object.keys(n).join(',')}`
  );
  checkNoStatKeys(n, n.name);
}
for (const f of KALAS_FACTIONS) {
  assert(
    eq(JSON.stringify(Object.keys(f).sort()), JSON.stringify(FACTION_KEYS)),
    `${f.name}: keys are exactly name/type/leader/description/relationships, got ${Object.keys(f).join(',')}`
  );
  checkNoStatKeys(f, f.name);
}
for (const h of KALAS_HOOKS) {
  assert(
    eq(JSON.stringify(Object.keys(h).sort()), JSON.stringify(HOOK_KEYS)),
    `${h.title}: keys are exactly title/description, got ${Object.keys(h).join(',')}`
  );
  checkNoStatKeys(h, h.title);
}

group('Non-empty core fields');
for (const l of KALAS_LOCATIONS) {
  assert(typeof l.name === 'string' && l.name.length > 0, `${l.id}: non-empty name`);
  assert(typeof l.type === 'string' && l.type.length > 0, `${l.id}: non-empty type`);
  assert(typeof l.description === 'string' && l.description.length > 0, `${l.id}: non-empty description`);
}
for (const n of KALAS_NPCS) {
  assert(typeof n.name === 'string' && n.name.length > 0, 'NPC: non-empty name');
  assert(typeof n.role === 'string' && n.role.length > 0, `${n.name}: non-empty role`);
}
assert(KALAS_NPCS.length === 106, `106 NPCs (91 people + 10 named creatures + 5 background mentions), got ${KALAS_NPCS.length}`);

group('NPC location links are real or null, never dangling');
for (const n of KALAS_NPCS) {
  assert(
    n.locationId === null || locationById(n.locationId) !== null,
    `${n.name}: locationId '${n.locationId}' is null or a real location id`
  );
}

group('locationById, locationsByType, npcsAtLocation');
const inn = locationById('laughing-hippocampus');
assert(inn !== null, "locationById('laughing-hippocampus') returns an entry");
assert(inn && inn.name === 'The Laughing Hippocampus', 'locationById returns the inn entry');
assert(locationById('nope') === null, "locationById('nope') returns null");
const innStaff = npcsAtLocation('laughing-hippocampus');
assert(innStaff.length >= 1, `npcsAtLocation('laughing-hippocampus') returns at least one NPC, got ${innStaff.length}`);
assert(
  innStaff.some((n) => n.name === 'Gleethorpe Perkins'),
  'Laughing Hippocampus staff includes landlord Gleethorpe Perkins'
);
assert(
  locationsByType('inn/tavern').some((l) => l.id === 'laughing-hippocampus'),
  "locationsByType('inn/tavern') includes the Laughing Hippocampus"
);

group('Meta reskin status is pending, not done or dropped');
assert(
  typeof KALAS_META.reskinStatus === 'string' && KALAS_META.reskinStatus.includes('pending'),
  `KALAS_META.reskinStatus contains 'pending', got ${KALAS_META.reskinStatus}`
);
assert(KALAS_META.name === 'Kalas', `KALAS_META.name is Kalas, got ${KALAS_META.name}`);

group('Trades and hooks are non-empty');
assert(Array.isArray(KALAS_TRADES) && KALAS_TRADES.length > 0, `KALAS_TRADES is non-empty, got ${KALAS_TRADES.length}`);
assert(
  KALAS_TRADES.every((t) => typeof t === 'string' && t.length > 0),
  'every trade is a non-empty string'
);
assert(Array.isArray(KALAS_HOOKS) && KALAS_HOOKS.length > 0, `KALAS_HOOKS is non-empty, got ${KALAS_HOOKS.length}`);
assert(
  KALAS_HOOKS.every((h) => typeof h.description === 'string' && h.description.length > 0),
  'every hook has a non-empty description'
);
assert(
  trades().length === KALAS_TRADES.length && hooks().length === KALAS_HOOKS.length,
  'trades() and hooks() return the full lists'
);
assert(factions().length === KALAS_FACTIONS.length, 'factions() returns the full list');

group('locations() and npcs() return copies, not the live arrays');
const locCopy = locations();
assert(locCopy.length === 59, 'locations() returns 59 locations');
assert(locCopy !== KALAS_LOCATIONS, 'locations() returns a copy, not the live array');
assert(locCopy[0] !== KALAS_LOCATIONS[0], 'locations() copies location objects, not just the array');
const npcCopy = npcs();
assert(npcCopy.length === KALAS_NPCS.length, 'npcs() returns all NPCs');
assert(npcCopy !== KALAS_NPCS, 'npcs() returns a copy, not the live array');
assert(npcCopy[0] !== KALAS_NPCS[0], 'npcs() copies NPC objects, not just the array');

console.log(`\n=== Results: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
