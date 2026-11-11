// tests/creator-test-notes-12-subclass-descriptions.test.js — creator test-notes #12
// (subclass descriptions, server side).
//
// What this pins (sources: creator-test-notes-1/server/notes.md §12 and the
// live registry under server/data/subclasses/ — NOT memory):
//   - every one of the 181 subclass entries carries a non-empty player-facing
//     `description`, authored from that entry's own feature text;
//   - the INVARIANT: no description shown to the player contains
//     origin-metadata boilerplate ("(setting-neutral)", "an origin
//     explanation is required") — the formatter bug (#12b) and the
//     doubled Warlord origin suffix are pinned here too;
//   - descriptions flow through the live read path: listSubclasses (the
//     function server/routes/subclasses.js serves) spreads each entry
//     whole, so a description on the registry entry reaches Stage 2.
//
// Honest integration tests: the registry arrays and the real
// subclassService are imported — no logic is re-implemented in this
// file. If the service or any registry file were deleted, the imports
// fail and the suite fails with them. The 181 total is pinned (registry
// size at authoring time); if the registry grows, update the pin.
// Mutation checks (group (d)): reintroducing boilerplate into a copy,
// or blanking a description, must trip the invariant checker.
import assert from 'node:assert';
import { ARTIFICER_SUBCLASSES } from '../server/data/subclasses/artificer.js';
import { BARBARIAN_SUBCLASSES } from '../server/data/subclasses/barbarian.js';
import { BARD_SUBCLASSES } from '../server/data/subclasses/bard.js';
import { BLACKGUARD_SUBCLASSES } from '../server/data/subclasses/blackguard.js';
import { BLOOD_HUNTER_SUBCLASSES } from '../server/data/subclasses/blood_hunter.js';
import { CLERIC_SUBCLASSES } from '../server/data/subclasses/cleric.js';
import { DRUID_SUBCLASSES } from '../server/data/subclasses/druid.js';
import { DUELIST_SUBCLASSES } from '../server/data/subclasses/duelist.js';
import { FIGHTER_SUBCLASSES } from '../server/data/subclasses/fighter.js';
import { MAGUS_SUBCLASSES } from '../server/data/subclasses/magus.js';
import { MONK_SUBCLASSES } from '../server/data/subclasses/monk.js';
import { PALADIN_SUBCLASSES } from '../server/data/subclasses/paladin.js';
import { PUGILIST_SUBCLASSES } from '../server/data/subclasses/pugilist.js';
import { RANGER_SUBCLASSES } from '../server/data/subclasses/ranger.js';
import { ROGUE_SUBCLASSES } from '../server/data/subclasses/rogue.js';
import { SCHOLAR_SUBCLASSES } from '../server/data/subclasses/scholar.js';
import { SORCERER_SUBCLASSES } from '../server/data/subclasses/sorcerer.js';
import { SPELLSHOT_SUBCLASSES } from '../server/data/subclasses/spellshot.js';
import { WARDEN_SUBCLASSES } from '../server/data/subclasses/warden.js';
import { WARLOCK_SUBCLASSES } from '../server/data/subclasses/warlock.js';
import { WARLORD_SUBCLASSES } from '../server/data/subclasses/warlord.js';
import { WIZARD_SUBCLASSES } from '../server/data/subclasses/wizard.js';
import {
  listSubclasses,
  getSubclass,
  formatSubclassOrigin,
} from '../server/services/subclassService.js';

let passed = 0;
let failed = 0;
function check(condition, message) {
  if (condition) { passed++; }
  else { failed++; console.error('  ✗', message); }
}
function group(name) { console.log('\n==', name); }

// The invariant, as a pure function over entries so the mutation checks
// in group (d) can run it against tampered copies.
const BOILERPLATE = ['(setting-neutral)', 'setting-neutral', 'an origin explanation is required', 'origin explanation'];
function findBoilerplate(entries) {
  return entries
    .filter((e) => typeof e.description === 'string' && BOILERPLATE.some((b) => e.description.includes(b)))
    .map((e) => `${e.class}:${e.key}`);
}
function findUndescribed(entries) {
  return entries
    .filter((e) => typeof e.description !== 'string' || e.description.trim().length === 0)
    .map((e) => `${e.class}:${e.key}`);
}

const REGISTRY = {
  artificer: ARTIFICER_SUBCLASSES,
  barbarian: BARBARIAN_SUBCLASSES,
  bard: BARD_SUBCLASSES,
  blackguard: BLACKGUARD_SUBCLASSES,
  blood_hunter: BLOOD_HUNTER_SUBCLASSES,
  cleric: CLERIC_SUBCLASSES,
  druid: DRUID_SUBCLASSES,
  duelist: DUELIST_SUBCLASSES,
  fighter: FIGHTER_SUBCLASSES,
  magus: MAGUS_SUBCLASSES,
  monk: MONK_SUBCLASSES,
  paladin: PALADIN_SUBCLASSES,
  pugilist: PUGILIST_SUBCLASSES,
  ranger: RANGER_SUBCLASSES,
  rogue: ROGUE_SUBCLASSES,
  scholar: SCHOLAR_SUBCLASSES,
  sorcerer: SORCERER_SUBCLASSES,
  spellshot: SPELLSHOT_SUBCLASSES,
  warden: WARDEN_SUBCLASSES,
  warlock: WARLOCK_SUBCLASSES,
  warlord: WARLORD_SUBCLASSES,
  wizard: WIZARD_SUBCLASSES,
};
const ALL = Object.values(REGISTRY).flat();

// (a) Every registry entry has a non-empty description; total pinned at 181.
group('(a) registry coverage');
check(ALL.length === 181, `registry total is 181 (got ${ALL.length})`);
const undescribed = findUndescribed(ALL);
check(undescribed.length === 0, `every entry described (undescribed: ${undescribed.join(', ') || 'none'})`);
for (const [cls, arr] of Object.entries(REGISTRY)) {
  check(arr.length > 0, `${cls} has entries (${arr.length})`);
  check(findUndescribed(arr).length === 0, `${cls}: all ${arr.length} described`);
}

// (b) The invariant, over the registry arrays themselves.
group('(b) invariant over the registry');
const boilerplate = findBoilerplate(ALL);
check(boilerplate.length === 0, `no description carries origin boilerplate (offenders: ${boilerplate.join(', ') || 'none'})`);

// (c) The invariant + coverage through the live read path (listSubclasses,
// the function the /api/subclasses route serves — entries spread whole).
group('(c) live read path (listSubclasses)');
let served = 0;
for (const cls of Object.keys(REGISTRY)) {
  const listed = listSubclasses(cls);
  check(listed.length === REGISTRY[cls].length, `listSubclasses(${cls}) serves ${REGISTRY[cls].length} (got ${listed.length})`);
  check(findUndescribed(listed).length === 0, `listSubclasses(${cls}): all described`);
  check(findBoilerplate(listed).length === 0, `listSubclasses(${cls}): no boilerplate`);
  served += listed.length;
}
check(served === 181, `listSubclasses serves 181 total (got ${served})`);
const inquisitive = getSubclass('rogue', 'Inquisitive');
check(inquisitive && typeof inquisitive.description === 'string' && inquisitive.description.length > 0,
  'getSubclass(rogue, Inquisitive) carries a description');
const commander = getSubclass('warlord', 'Commander');
check(commander && typeof commander.description === 'string' && commander.description.length > 0,
  'getSubclass(warlord, Commander) carries a description');
// Warden flows through base(): the description must survive the helper.
const wardenListed = listSubclasses('warden');
check(wardenListed.length === 15, `listSubclasses(warden) serves 15 (got ${wardenListed.length})`);
check(findUndescribed(wardenListed).length === 0, 'warden: all 15 described via base()');

// (d) Mutation checks: the invariant checker must trip on tampering.
group('(d) mutation checks');
const tamperedBoilerplate = ALL.map((e, i) => (i === 0
  ? { ...e, description: `${e.description} (setting-neutral)` }
  : e));
check(findBoilerplate(tamperedBoilerplate).length === 1,
  'mutation check: boilerplate reintroduced into one description is caught');
const tamperedBlank = ALL.map((e, i) => (i === 0 ? { ...e, description: '' } : e));
check(findUndescribed(tamperedBlank).length === 1,
  'mutation check: one blanked description is caught');
check(findBoilerplate(ALL).length === 0 && findUndescribed(ALL).length === 0,
  'mutation check: the untampered registry still passes both checkers');

// (e) The formatter fix (#12b): no doubled origin, null reads as unspecified.
group('(e) formatSubclassOrigin dedup');
const warlordEntry = { origin_setting: 'KibblesTasty (setting-neutral)', origin_region: 'KibblesTasty (setting-neutral)' };
check(formatSubclassOrigin(warlordEntry) === 'KibblesTasty (setting-neutral)',
  `warlord origin renders once (got ${JSON.stringify(formatSubclassOrigin(warlordEntry))})`);
check(formatSubclassOrigin({ origin_setting: null, origin_region: null }) === 'unspecified setting',
  'null origin renders as "unspecified setting"');
check(formatSubclassOrigin({ origin_setting: 'Forgotten Realms', origin_region: 'Forgotten Realms' }) === 'Forgotten Realms',
  'FR origin renders as "Forgotten Realms"');
check(formatSubclassOrigin({ origin_setting: 'Exandria', origin_region: 'Wildemount' }) === 'Exandria (Wildemount)',
  'distinct region still renders once after the setting');

console.log(`=== Results: ${passed} passed, ${failed} failed ===`);
process.exit(failed ? 1 : 0);
