/*
 * tests/quick-threats.test.js — Quick Threats & Side Treks data module.
 *
 * MAC-READY, STAGING ONLY: this file is written to be copied unchanged
 * to tests/quick-threats.test.js on the Mac. Its import is the Mac path
 * (../server/data/quickThreats.js), so in staging it is syntax-checked
 * only (node --check) and is NOT runnable here — the Mac path does not
 * exist on the VM. The Mac gate (npm test -- quick-threats) is the
 * real run. This module is pure data, so no database is needed.
 *
 * Pins (same assert/group style as tests/npc-banks.test.js):
 *   - 18 treks, in source order, titles matching the sort's §1 list
 *   - every trek object has exactly the required keys, no stat/reward
 *     keys (asserted by key list, and no key exactly named
 *     hp/ac/damage/dc/gp/xp/reward/level/save/stat, and no key
 *     containing damage/reward/stat — short fragments 'ac'/'dc' are
 *     exact-matched only, since the legitimate key 'places' contains
 *     'ac')
 *   - every trek has non-empty premise, hook, twist, and at least one
 *     outcome; npcs/places/monsters are arrays
 *   - playableTreks() equals, independently computed in the test from
 *     the module's own monster statuses, the treks whose monsters are
 *     all 2024/reskin (no hardcoded count)
 *   - blockedTreks() includes Trek 1 (boggart/korred) and Trek 15
 *     (trikill) at minimum, and every blocked trek has at least one
 *     monster with status 'blocked'
 *   - trekById('a-delightful-evening') returns the Bottomless Mug trek
 *     with Weldon Shacklesbeard among its NPCs; trekById('nope')
 *     returns null
 *   - no monster object has keys beyond name/status (no statblock
 *     fragment)
 */
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');

const svc = (p) => pathToFileURL(path.join(REPO, p)).href;
const { QUICK_THREATS, treks, trekById, playableTreks, blockedTreks } = await import(
  svc('server/data/quickThreats.js')
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

const EXPECTED_TITLES = [
  'A Delightful Evening',
  'A Devil of a Time',
  'A Terrible Swift Death',
  "Cupid's Arrow",
  'Dance Party',
  'Duty Calls',
  'Horde',
  'In the Valley of Evil',
  'One Puddle Too Far',
  'Rocky Foundations',
  'Scrambled Eggs',
  'Stripes and Arrows',
  'The Desolate Mesa',
  'The Endless Chatter of the Marsh',
  'The Rot Is More Than Skin Deep',
  'The Terror on Bentbill Hill',
  'Two Heads Are Better Than One',
  'Without Crime and With Punishment',
];
const EXPECTED_KEYS = ['id', 'title', 'premise', 'hook', 'npcs', 'places', 'twist', 'outcomes', 'monsters'];
const FORBIDDEN_KEY_EXACT = ['hp', 'ac', 'damage', 'dc', 'gp', 'xp', 'reward', 'level', 'save', 'stat'];
const FORBIDDEN_KEY_SUBSTRINGS = ['damage', 'reward', 'stat'];

group('Count and source order');
assert(QUICK_THREATS.length === 18, `18 treks, got ${QUICK_THREATS.length}`);
assert(
  QUICK_THREATS.every((t, i) => t.title === EXPECTED_TITLES[i]),
  'titles match the sort §1 list exactly, in source order'
);

group('Exact key shape, no stat/reward keys');
for (const t of QUICK_THREATS) {
  const keys = Object.keys(t).sort();
  assert(
    eq(JSON.stringify(keys), JSON.stringify([...EXPECTED_KEYS].sort())),
    `${t.title}: keys are exactly id/title/premise/hook/npcs/places/twist/outcomes/monsters, got ${keys.join(',')}`
  );
  for (const k of Object.keys(t)) {
    const lower = k.toLowerCase();
    assert(
      !FORBIDDEN_KEY_EXACT.includes(lower) && !FORBIDDEN_KEY_SUBSTRINGS.some((f) => lower.includes(f)),
      `${t.title}: key '${k}' is not a stat/reward key`
    );
  }
  for (const n of t.npcs) {
    assert(
      eq(JSON.stringify(Object.keys(n).sort()), JSON.stringify(['motive', 'name', 'role'])),
      `${t.title}: NPC object keys are exactly name/role/motive`
    );
  }
  for (const m of t.monsters) {
    assert(
      eq(JSON.stringify(Object.keys(m).sort()), JSON.stringify(['name', 'status'])),
      `${t.title}: monster object keys are exactly name/status (no statblock fragment)`
    );
    assert(
      ['2024', 'reskin', 'blocked'].includes(m.status),
      `${t.title}: monster ${m.name} status is 2024/reskin/blocked, got ${m.status}`
    );
  }
}

group('Non-empty core fields, array fields');
for (const t of QUICK_THREATS) {
  assert(typeof t.premise === 'string' && t.premise.length > 0, `${t.title}: non-empty premise`);
  assert(typeof t.hook === 'string' && t.hook.length > 0, `${t.title}: non-empty hook`);
  assert(typeof t.twist === 'string' && t.twist.length > 0, `${t.title}: non-empty twist`);
  assert(Array.isArray(t.outcomes) && t.outcomes.length >= 1, `${t.title}: at least one outcome`);
  assert(Array.isArray(t.npcs), `${t.title}: npcs is an array`);
  assert(Array.isArray(t.places), `${t.title}: places is an array`);
  assert(Array.isArray(t.monsters), `${t.title}: monsters is an array`);
}

group('playableTreks() derived independently from monster statuses');
const derivedPlayable = QUICK_THREATS.filter((t) =>
  t.monsters.every((m) => m.status === '2024' || m.status === 'reskin')
);
const actualPlayable = playableTreks();
assert(
  eq(JSON.stringify(actualPlayable.map((t) => t.id)), JSON.stringify(derivedPlayable.map((t) => t.id))),
  `playableTreks() equals the independently derived set (${derivedPlayable.length} treks)`
);
assert(
  actualPlayable.every((t) => t.monsters.every((m) => m.status === '2024' || m.status === 'reskin')),
  'every playable trek has only 2024/reskin monsters'
);

group('blockedTreks() includes Trek 1 and Trek 15, all blocked by a monster');
const blocked = blockedTreks();
assert(blocked.some((t) => t.id === 'a-delightful-evening'), 'blockedTreks() includes Trek 1 (boggart/korred)');
assert(blocked.some((t) => t.id === 'the-rot-is-more-than-skin-deep'), 'blockedTreks() includes Trek 15 (trikill)');
assert(
  blocked.every((t) => t.monsters.some((m) => m.status === 'blocked')),
  'every blocked trek has at least one monster with status blocked'
);
assert(
  blocked.every((t) => !actualPlayable.some((p) => p.id === t.id)),
  'no trek is both playable and blocked'
);
assert(
  blocked.length + actualPlayable.length === 18,
  `playable (${actualPlayable.length}) + blocked (${blocked.length}) = 18`
);

group('trekById and treks() copy');
const delightful = trekById('a-delightful-evening');
assert(delightful !== null, 'trekById(a-delightful-evening) returns a trek');
assert(delightful && delightful.title === 'A Delightful Evening', 'trekById returns the Bottomless Mug trek');
assert(
  delightful && delightful.npcs.some((n) => n.name === 'Weldon Shacklesbeard'),
  'Bottomless Mug trek includes Weldon Shacklesbeard among its NPCs'
);
assert(trekById('nope') === null, 'trekById(nope) returns null');
const copy = treks();
assert(copy.length === 18, 'treks() returns 18 treks');
assert(copy !== QUICK_THREATS, 'treks() returns a copy, not the live array');
assert(copy[0] !== QUICK_THREATS[0], 'treks() copies trek objects, not just the array');

console.log(`\n=== Results: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
