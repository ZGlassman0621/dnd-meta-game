// tests/newclass-pugilist.test.js — Pugilist (Sterling Vermin, 2014-era).
// Honest-integration rules: every assertion below calls the REAL
// pugilistService.js / merged levelProgression.js /
// pugilist.js subclass file. Nothing here re-implements service
// logic; deleting the service file makes this suite fail at import.
// Coverage: Moxie maxima (printed values only), Fisticuffs die
// progression, moxie spend/gain, Bloodied But Unbowed, Arena Royale
// persona points, Fighting Spirit, and the club registry.
// What this does NOT cover (honest scope): DB load/save (the
// mirror has no database.js — load/save here run against the JSON
// blob only), marker handlers (not registered in this mirror —
// see pugilistService.js header), restTimeService/dmPromptBuilder
// wiring, Extra Attack engine wiring (coordinator merge item in
// classFeatureService.js), or the hound entity row (named
// follow-up, not built by the registry).
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');
const svc = (rel) => pathToFileURL(path.join(REPO, rel)).href;

const pug = await import(svc('server/services/pugilistService.js'));
const F = await import(svc('server/config/levelProgression.js'));
const SUBCLASS_SERVICE = await import(svc('server/services/subclassService.js'));
const { PUGILIST_SUBCLASSES } = await import(svc('server/data/subclasses/pugilist.js'));
const clientClasses = JSON.parse(fs.readFileSync(path.join(REPO, 'client/src/data/classes.json'), 'utf8'));

// --- Fisticuffs die progression (digest bands, verbatim) ---
assert.equal(pug.fisticuffsDie(1), '1d6');
assert.equal(pug.fisticuffsDie(4), '1d6');
assert.equal(pug.fisticuffsDie(5), '1d8');
assert.equal(pug.fisticuffsDie(10), '1d8');
assert.equal(pug.fisticuffsDie(11), '1d10');
assert.equal(pug.fisticuffsDie(16), '1d10');
assert.equal(pug.fisticuffsDie(17), '1d12');
assert.equal(pug.fisticuffsDie(20), '1d12');
// (2026-11-05 gate fix: the overnight version also asserted these two rows
// against the staging fragment's FISTICUFFS_DIE table. That table has no live
// second source — it is in neither the merged levelProgression nor the service
// exports — so the lines are dropped; fisticuffsDie() above already asserts
// both levels through the real service.)

// --- Moxie maxima: printed even levels ONLY ---
assert.deepEqual(pug.MOXIE_MAX_PRINTED, { 2: 2, 4: 3, 6: 4, 8: 5, 10: 6, 12: 7, 14: 8, 16: 9, 18: 10, 20: 12 });
for (const [level, max] of Object.entries(pug.MOXIE_MAX_PRINTED)) {
  assert.equal(pug.moxieMaxForLevel(Number(level)), max);
}
// Unlisted levels return null rather than an interpolated guess —
// including 3rd (flagged in the brief) and 19th (10 -> 12 jump).
assert.equal(pug.moxieMaxForLevel(1), 0); // no pool before 2nd
assert.equal(pug.moxieMaxForLevel(3), null);
assert.equal(pug.moxieMaxForLevel(19), null);
assert.equal(pug.moxieMaxForLevel(5), null);

// --- Moxie spend / gain / rest refill ---
let st = pug.onLongRest(pug.defaultPugilistState(), { level: 6 }).state;
assert.equal(st.moxieLeft, 4); assert.equal(st.moxieMax, 4);
let r = pug.spendMoxie(st, 6, 2);
assert.equal(r.success, true); assert.equal(r.state.moxieLeft, 2);
st = r.state;
r = pug.spendMoxie(st, 6, 3);
assert.equal(r.success, false); assert.equal(r.reason, 'not_enough_moxie');
r = pug.gainMoxie(st, 6, 1);
assert.equal(r.state.moxieLeft, 3);
r = pug.gainMoxie(r.state, 6, 99);
assert.equal(r.state.moxieLeft, 4); // capped at max, never above
st = pug.onShortRest(r.state, { level: 6 }).state;
assert.equal(st.moxieLeft, 4); // regain ALL on a short rest too
// Spend at an unresolved level refuses instead of guessing a max.
r = pug.spendMoxie(pug.defaultPugilistState(), 3, 1);
assert.equal(r.success, false); assert.equal(r.reason, 'moxie_max_unresolved_for_level');

// --- Bloodied But Unbowed (3rd): temp HP + full moxie, 1/rest ---
st = pug.onLongRest(pug.defaultPugilistState(), { level: 6 }).state;
st = pug.spendMoxie(st, 6, 4).state;
assert.equal(st.moxieLeft, 0);
r = pug.bloodiedButUnbowed(st, { level: 6, conMod: 3 });
assert.equal(r.success, true);
assert.equal(r.tempHp, 9); // level + Con mod
assert.equal(r.state.moxieLeft, 4);
assert.equal(r.state.bloodiedButUnbowedUsed, true);
r = pug.bloodiedButUnbowed(r.state, { level: 6, conMod: 3 });
assert.equal(r.success, false); // once per rest
st = pug.onShortRest(r.state, { level: 6 }).state;
assert.equal(st.bloodiedButUnbowedUsed, false); // resets on a SHORT rest too
assert.equal(pug.bloodiedButUnbowed(pug.defaultPugilistState(), { level: 2, conMod: 3 }).reason, 'level_too_low');
// Down But Not Out (9th) rides the use, long-rest reuse only.
st = pug.onLongRest(pug.defaultPugilistState(), { level: 10 }).state;
r = pug.bloodiedButUnbowed(st, { level: 10, conMod: 2, addProficiencyDamage: true });
assert.equal(r.success, true); assert.equal(r.downButNotOut, true);
assert.equal(pug.bloodiedButUnbowed(r.state, { level: 10, conMod: 2, addProficiencyDamage: true }).success, false);

// --- Arena Royale persona points: 3 + Cha, min 1, long rest ---
assert.equal(pug.personaPointsMax(2), 5);
assert.equal(pug.personaPointsMax(-5), 1);
st = pug.onLongRest({ ...pug.defaultPugilistState(), club: 'arena_royale', personaAdopted: true }, { level: 6, chaMod: 2 }).state;
assert.equal(st.personaPointsLeft, 5);
r = pug.spendPersonaPoint(st);
assert.equal(r.success, true); assert.equal(r.state.personaPointsLeft, 4);
assert.equal(pug.spendPersonaPoint({ ...pug.defaultPugilistState(), personaAdopted: false }).reason, 'persona_not_adopted');

// --- Fighting Spirit (18th) ---
st = pug.onLongRest(pug.defaultPugilistState(), { level: 20 }).state;
r = pug.fightingSpirit(st, { level: 20, maxHp: 100, exhaustionLevels: 4 });
assert.equal(r.success, true);
assert.equal(r.hpRegained, 50); // half max hp (Math.floor — see conversions file)
assert.equal(r.moxieRegained, 6); // half max moxie (12 -> 6)
assert.equal(r.exhaustionGained, 1);
assert.equal(pug.fightingSpirit(r.state, { level: 20, maxHp: 100, exhaustionLevels: 5 }).reason, 'fighting_spirit_already_used_this_long_rest');
assert.equal(pug.fightingSpirit(pug.defaultPugilistState(), { level: 20, maxHp: 100, exhaustionLevels: 5 }).reason, 'too_exhausted_for_fighting_spirit');
assert.equal(pug.fightingSpirit(pug.defaultPugilistState(), { level: 17, maxHp: 100, exhaustionLevels: 0 }).reason, 'level_too_low');

// --- Moxie features: starters + Squared Circle additions ONLY ---
assert.deepEqual(pug.moxieFeaturesFor({ level: 2, club: null }), ['brace_up', 'the_old_one_two', 'stick_and_move']);
assert.deepEqual(pug.moxieFeaturesFor({ level: 20, club: 'sweet_science' }), ['brace_up', 'the_old_one_two', 'stick_and_move']);
assert.deepEqual(pug.moxieFeaturesFor({ level: 3, club: 'squared_circle' }),
  ['brace_up', 'the_old_one_two', 'stick_and_move', 'compression_lock', 'quick_pin', 'to_the_mat']);
// No general moxie-feature progression is claimed for other clubs:
// a 20th-level non-Squared-Circle pugilist still lists only the
// starters — the gap is UNRESOLVED, not silently filled.

// --- Merged levelProgression + registry ---
// (2026-11-05 gate fix: same assertions as the overnight fragment check, now
// against the merged live levelProgression.js.)
assert.equal(F.SUBCLASS_LEVELS.pugilist, 3);
assert.equal(F.HIT_DICE.pugilist, 8);
assert.equal(F.CASTER_TYPE.pugilist, 'none');
assert.deepEqual(F.CLASS_FEATURES.pugilist[5], ['Extra Attack', 'Haymaker']);
assert.equal(PUGILIST_SUBCLASSES.length, 6);
for (const entry of PUGILIST_SUBCLASSES) {
  assert.equal(entry.class, 'pugilist');
  // Item 29: no per-entry selectionLevel in the data file — the
  // server derives it from SUBCLASS_LEVELS (pugilist 3).
  assert.ok(!('selectionLevel' in entry));
  assert.equal(entry.gateCheckRequired, true);
  assert.deepEqual(entry.features.map((f) => f.level), [3, 6, 11, 17]);
  for (const f of entry.features) assert.equal(f.gateCheck, true);
}
assert.ok(SUBCLASS_SERVICE.listSubclasses('pugilist').every((e) => e.selectionLevel === 3));
assert.ok(!PUGILIST_SUBCLASSES.some((e) => e.key === 'hand_of_dread'), 'Hand of Dread is not in the digest and must not appear');
assert.deepEqual(pug.MULTICLASS_GRANT, { hitDie: 8, armor: ['light'], weapons: ['improvised'] });

// --- Namespaced state parse (own parse, never parseClassResources) ---
const blob = JSON.stringify({ used: {}, pugilist: { club: 'arena_royale', moxieLeft: 1 } });
assert.equal(pug.loadPugilistState(blob).club, 'arena_royale');
const saved = pug.savePugilistState(blob, { ...pug.defaultPugilistState(), club: 'sweet_science' });
assert.equal(saved.pugilist.club, 'sweet_science');
assert.deepEqual(saved.used, {});

// --- Merged client classes.json sanity ---
assert.ok(!('spellcasting' in clientClasses.pugilist), 'merged classes.json pugilist entry must NOT carry a spellcasting block');
assert.equal(clientClasses.pugilist.hitDie, 8);
assert.equal(clientClasses.pugilist.subclasses.length, 6);
assert.ok(!clientClasses.pugilist.subclasses.some((s) => s.name === 'Hand of Dread'));

console.log('newclass-pugilist: all assertions passed');
