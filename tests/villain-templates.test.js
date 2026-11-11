/*
 * tests/villain-templates.test.js — D&D Villain Guide data module.
 *
 * MAC-READY, STAGING ONLY: this file is written to be copied unchanged
 * to tests/villain-templates.test.js on the Mac. Its import is the Mac
 * path (../server/data/villainTemplates.js), so in staging it is
 * syntax-checked only (node --check) and is NOT runnable here — the
 * Mac path does not exist on the VM. The Mac gate
 * (npm test -- villain-templates) is the real run. This module is pure
 * data, so no database is needed. A local runner (not pushed) imports
 * the staging module directly and runs the same assertions on the VM.
 *
 * Pins (same assert/group style as tests/quick-threats.test.js):
 *   - 10 villains, in source order, names matching the sort's list
 *   - every villain object has exactly the required keys, no
 *     stat/reward keys (asserted by key list, and no key exactly named
 *     hp/ac/damage/dc/gp/xp/reward/level/save/stat, and no key
 *     containing damage/reward/stat — 'sourceTier' is allowed: it is
 *     a tier hint, not a stat, and is checked separately below)
 *   - every villain has non-empty appearance, personality, origin,
 *     personalGoal, lair, hook, and at least one alternative ending;
 *     minions is a non-empty array; faction is an object with
 *     name/relationship/goal, all non-empty
 *   - no string field contains a statblock fragment: 'Hit Points',
 *     'Armor Class', 'Saving Throws', 'Legendary Actions', or a
 *     'Challenge ' figure — sourceTier carries the tier hint instead
 *   - sourceTier is an integer 3-20 for every villain
 *   - villainById('selene-nightshade') returns Selene; villainById
 *     ('nope') returns null; villains() returns a copy, not the live
 *     array, and copies nested objects
 *   - no villain is filed as ally/villain/patron: that stance is
 *     player-relative and derived at deal time, so no field may be
 *     named stance, role-as-ally, or similar — asserted by the exact
 *     key list, not by a separate scan
 */
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');

const svc = (p) => pathToFileURL(path.join(REPO, p)).href;
const { VILLAIN_TEMPLATES, villains, villainById, villainIds } = await import(
  svc('server/data/villainTemplates.js')
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

const EXPECTED_NAMES = [
  'Selene Nightshade',
  'Thaddeus Swiftblade',
  'Zephyrion',
  'Lady Evangeline Blackthorn',
  'Kharok Ironblood',
  'Rak’Thar',
  'Bloodclaw',
  'Baroness Seraphina Shadowheart',
  'Brother Percival Brightmore',
  'Vossan Kragmire',
];
const EXPECTED_KEYS = [
  'alternativeEndings',
  'appearance',
  'faction',
  'hook',
  'id',
  'lair',
  'minions',
  'name',
  'origin',
  'personalGoal',
  'personality',
  'reskinNote',
  'sourceTier',
  'title',
];
const FORBIDDEN_KEY_EXACT = ['hp', 'ac', 'damage', 'dc', 'gp', 'xp', 'reward', 'level', 'save', 'stat', 'stance'];
const FORBIDDEN_KEY_SUBSTRINGS = ['damage', 'reward', 'stat'];
const FORBIDDEN_STRINGS = ['Hit Points', 'Armor Class', 'Saving Throws', 'Legendary Actions', 'Challenge '];

group('Count and source order');
assert(VILLAIN_TEMPLATES.length === 10, `10 villains, got ${VILLAIN_TEMPLATES.length}`);
assert(
  VILLAIN_TEMPLATES.every((v, i) => v.name === EXPECTED_NAMES[i]),
  'names match the sort list exactly, in source order'
);
assert(
  eq(JSON.stringify(villainIds()), JSON.stringify(VILLAIN_TEMPLATES.map((v) => v.id))),
  'villainIds() matches the module order'
);

group('Exact key shape, no stat/reward/stance keys');
for (const v of VILLAIN_TEMPLATES) {
  const keys = Object.keys(v).sort();
  assert(
    eq(JSON.stringify(keys), JSON.stringify([...EXPECTED_KEYS].sort())),
    `${v.name}: keys are exactly the 14 template keys, got ${keys.join(',')}`
  );
  for (const k of Object.keys(v)) {
    const lower = k.toLowerCase();
    assert(
      !FORBIDDEN_KEY_EXACT.includes(lower) && !FORBIDDEN_KEY_SUBSTRINGS.some((f) => lower.includes(f)),
      `${v.name}: key '${k}' is not a stat/reward/stance key`
    );
  }
  assert(
    eq(JSON.stringify(Object.keys(v.faction).sort()), JSON.stringify(['goal', 'name', 'relationship'])),
    `${v.name}: faction keys are exactly name/relationship/goal`
  );
  for (const m of v.minions) {
    assert(
      eq(JSON.stringify(Object.keys(m).sort()), JSON.stringify(['name', 'role'])),
      `${v.name}: minion keys are exactly name/role`
    );
  }
}

group('Non-empty core fields, no statblock fragments in strings');
for (const v of VILLAIN_TEMPLATES) {
  for (const f of ['appearance', 'personality', 'origin', 'personalGoal', 'lair', 'hook', 'reskinNote', 'title']) {
    assert(typeof v[f] === 'string' && v[f].length > 0, `${v.name}: non-empty ${f}`);
  }
  assert(Array.isArray(v.minions) && v.minions.length >= 1, `${v.name}: at least one minion`);
  assert(
    Array.isArray(v.alternativeEndings) && v.alternativeEndings.length >= 1,
    `${v.name}: at least one alternative ending`
  );
  assert(
    typeof v.faction.name === 'string' && v.faction.name.length > 0 &&
      typeof v.faction.relationship === 'string' && v.faction.relationship.length > 0 &&
      typeof v.faction.goal === 'string' && v.faction.goal.length > 0,
    `${v.name}: faction name/relationship/goal all non-empty`
  );
  const allStrings = [
    v.appearance, v.personality, v.origin, v.personalGoal, v.lair, v.hook, v.reskinNote,
    v.faction.name, v.faction.goal, ...v.minions.map((m) => m.role), ...v.alternativeEndings,
  ].join(' ');
  for (const bad of FORBIDDEN_STRINGS) {
    assert(!allStrings.includes(bad), `${v.name}: no statblock fragment '${bad}' in strings`);
  }
  assert(
    Number.isInteger(v.sourceTier) && v.sourceTier >= 3 && v.sourceTier <= 20,
    `${v.name}: sourceTier is an integer 3-20, got ${v.sourceTier}`
  );
}

group('villainById and villains() copy');
const selene = villainById('selene-nightshade');
assert(selene !== null, 'villainById(selene-nightshade) returns a villain');
assert(selene && selene.title === 'The Mistress of Shadows', 'Selene title matches');
assert(
  selene && selene.minions.some((m) => m.name === 'Shadowstalkers'),
  'Selene includes Shadowstalkers among minions'
);
assert(villainById('nope') === null, 'villainById(nope) returns null');
const copy = villains();
assert(copy.length === 10, 'villains() returns 10 villains');
assert(copy !== VILLAIN_TEMPLATES, 'villains() returns a copy, not the live array');
assert(copy[0] !== VILLAIN_TEMPLATES[0], 'villains() copies villain objects, not just the array');
assert(copy[0].faction !== VILLAIN_TEMPLATES[0].faction, 'villains() copies faction objects');
assert(copy[0].minions !== VILLAIN_TEMPLATES[0].minions, 'villains() copies minion arrays');

console.log(`\n=== Results: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
