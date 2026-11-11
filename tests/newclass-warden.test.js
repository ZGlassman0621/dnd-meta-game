// tests/newclass-warden.test.js — Warden (Mage Hand Press 2019,
// 2014-era) honest integration tests. Every assertion calls the REAL
// service, merged levelProgression, or subclass-file code — never a re-implementation.
// If the service file is deleted, these imports fail and the suite
// fails; that is the point. Numbers are digest-verbatim (see
// ~/workspace/dnd-app-review/new-classes-staging/digests/warden.md).
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');
const svc = (rel) => pathToFileURL(path.join(REPO, rel)).href;

const W = await import(svc('server/services/wardenService.js'));
const F = await import(svc('server/config/levelProgression.js'));
const SUBCLASS_SERVICE = await import(svc('server/services/subclassService.js'));
const { WARDEN_SUBCLASSES } = await import(svc('server/data/subclasses/warden.js'));
const clientClasses = JSON.parse(fs.readFileSync(path.join(REPO, 'client/src/data/classes.json'), 'utf8'));

let passed = 0, failed = 0;
function group(name) { console.log('== ' + name + ' =='); }
function ok(cond, msg) {
  try { assert(cond, msg); passed++; }
  catch (e) { failed++; console.error('FAIL:', msg, '|', e.message); }
}

group('Base class has NO spellcasting');
ok(W.baseCastsSpells() === false, 'baseCastsSpells() is false');
for (const l of [1, 3, 10, 20]) ok(W.baseCantripsKnownForLevel(l) === 0, `base cantrips at L${l} is 0`);
ok(!('spellcasting' in clientClasses.warden), 'merged classes.json base entry has NO spellcasting block');

group('Font of Life — 1/short-or-long rest, 15th daily heal');
{
  const early = W.useFontOfLife(W.defaultWardenState(), 3);
  ok(!early.success && early.reason === 'font_of_life_not_yet_gained', 'Font of Life not gained before 4th');
  let s = W.defaultWardenState();
  const u1 = W.useFontOfLife(s, 4); s = u1.state;
  ok(u1.success, 'Font of Life usable at 4th');
  const u2 = W.useFontOfLife(s, 4);
  ok(!u2.success && u2.reason === 'font_of_life_already_used_this_rest', 'second use before a rest refused');
  s = W.onShortRest(s, { level: 4 }).state;
  ok(W.useFontOfLife(s, 4).success, 'short rest restores Font of Life');
  const dailyEarly = W.useFontOfLife(W.defaultWardenState(), 14, { dailyHeal: true });
  ok(!dailyEarly.success && dailyEarly.reason === 'font_daily_heal_requires_level_15', 'daily half-max heal requires 15th');
  let d = W.defaultWardenState();
  const d1 = W.useFontOfLife(d, 15, { dailyHeal: true }); d = d1.state;
  ok(d1.success && d1.healsToHalfMax, '15th daily heal grants half-max restoration');
  d = W.onShortRest(d, { level: 15 }).state;
  const d2 = W.useFontOfLife(d, 15, { dailyHeal: true });
  ok(!d2.success && d2.reason === 'font_daily_heal_already_used_today', 'daily heal once per day even after a short rest');
  d = W.onLongRest(d, { level: 15 }).state;
  ok(W.useFontOfLife(d, 15, { dailyHeal: true }).success, 'long rest restores the daily heal');
}

group('Undying — 1/long rest, not when killed outright');
{
  const early = W.useUndying(W.defaultWardenState(), 8);
  ok(!early.success && early.reason === 'undying_not_yet_gained', 'Undying not gained before 9th');
  const killed = W.useUndying(W.defaultWardenState(), 9, { killedOutright: true });
  ok(!killed.success && killed.reason === 'killed_outright', 'Undying refuses killed-outright');
  let s = W.defaultWardenState();
  const u1 = W.useUndying(s, 9); s = u1.state;
  ok(u1.success && u1.hp === 1, 'Undying drops to 1 hp');
  ok(!W.useUndying(s, 9).success, 'second Undying before a long rest refused');
  s = W.onShortRest(s, { level: 9 }).state;
  ok(!W.useUndying(s, 9).success, 'short rest does NOT restore Undying');
  s = W.onLongRest(s, { level: 9 }).state;
  ok(W.useUndying(s, 9).success, 'long rest restores Undying');
}

group('Grey Watchman battle dice — maxima, die steps, rest recovery');
ok(W.battleDiceMaxForLevel(3) === 4 && W.battleDiceMaxForLevel(6) === 5 && W.battleDiceMaxForLevel(13) === 6, 'battle dice 4 -> 5 at 6th -> 6 at 13th');
ok(W.battleDieForLevel(12) === 'd8' && W.battleDieForLevel(13) === 'd10' && W.battleDieForLevel(20) === 'd12', 'battle die d8 -> d10 at 13th -> d12 at 20th');
ok(W.battleManeuversKnownForLevel(3) === 3 && W.battleManeuversKnownForLevel(6) === 5 && W.battleManeuversKnownForLevel(13) === 7, 'maneuvers 3 -> 5 -> 7');
ok(W.GREY_WATCHMAN_MANEUVERS.length === 9, '9 maneuvers listed');
{
  let s = W.onLongRest(W.defaultWardenState(), { level: 13, subclass: 'Grey Watchman' }).state;
  ok(s.battleDiceLeft === 6 && s.battleDie === 'd10', 'long rest fills 6 d10 at 13th');
  const spent = W.spendBattleDie(s, 13);
  ok(spent.success && spent.battleDiceLeft === 5, 'spend leaves 5');
  s = W.onShortRest(spent.state, { level: 13, subclass: 'Grey Watchman' }).state;
  ok(s.battleDiceLeft === 6, 'short rest refills battle dice');
  const nonGrey = W.onLongRest(W.defaultWardenState(), { level: 13, subclass: 'Godsworn' }).state;
  ok(nonGrey.battleDiceLeft === 0, 'non-Grey-Watchman gains no battle dice');
  let m = W.defaultWardenState();
  for (const man of ['Cleave', 'Bulwark', 'Skull Bash']) { const r = W.learnManeuver(m, 3, man); m = r.state; ok(r.success, `learn ${man}`); }
  ok(!W.learnManeuver(m, 3, 'Cleave').success, 'duplicate maneuver refused');
  ok(!W.learnManeuver(m, 3, 'Avenging Strike').success, '4th maneuver at 3rd refused (cap 3)');
  ok(!W.learnManeuver(m, 3, 'Not A Maneuver').success, 'unknown maneuver refused');
}

group('Casting subclasses — endpoints ONLY, no interpolated rows');
ok(W.cantripsKnownForCastingSubclass(2) === 0, 'no casting before 3rd (no subclass yet)');
ok(W.cantripsKnownForCastingSubclass(3) === 2 && W.cantripsKnownForCastingSubclass(10) === 3, 'cantrips 2 at 3rd, 3 from 10th');
ok(W.spellsKnownForCastingSubclass(3) === 3 && W.spellsKnownForCastingSubclass(20) === 13, 'spells known endpoints 3 at 3rd, 13 at 20th');
ok(W.spellsKnownForCastingSubclass(10) === null, 'spells known at 10th is NULL (row not printed — not interpolated)');
ok(JSON.stringify(W.spellSlotsForCastingSubclass(3)) === JSON.stringify({ 1: 2 }), 'slots at 3rd: 2 first-level');
ok(JSON.stringify(W.spellSlotsForCastingSubclass(20)) === JSON.stringify({ 1: 4, 2: 3, 3: 3, 4: 1 }), 'slots at 20th: 4/3/3/1');
ok(W.spellSlotsForCastingSubclass(10) === null, 'slots at 10th are NULL (row not printed — not interpolated)');
ok(W.CASTING_SUBCLASS_ABILITY.loreseeker === 'int' && W.CASTING_SUBCLASS_ABILITY.soulblood_shaman === 'wis', 'Loreseeker Int, Soulblood Wis');
ok(W.CASTING_SUBCLASS_LIST.loreseeker === 'wizard' && W.CASTING_SUBCLASS_LIST.soulblood_shaman === 'druid', 'Loreseeker wizard list, Soulblood druid list');
ok(W.castingSubclassSaveDc(4, 3) === 15, 'casting save DC 8 + PB + mod');

group('Base options, alternate sets, Grasp range, pools');
ok(W.FIGHTING_STYLES.length === 4 && W.FIGHTING_STYLES.includes('Titan Fighting'), '4 fighting styles');
ok(W.ALTERNATE_SETS.length === 5, '5 alternate core-feature sets');
ok(W.ALTERNATE_SETS.map((a) => a.key).join('|') === 'champion|hunt|maneater|paragon|penumbral', 'alternate set keys match digest');
ok(W.ALTERNATE_SETS.every((a) => a.replaces.length === 3), 'every alternate set replaces Grasp/Mark/Resolve');
ok(W.graspRangeForLevel(13) === 5 && W.graspRangeForLevel(14) === 10, 'Grasp range 5 feet, 10 feet at 14th');
ok(W.graspRangeForLevel(14, 'champion') === null, 'alternate sets define their own ranges (null, not base range)');
ok(W.paragonFontPoolForLevel(10) === 50, "Paragon's Font pool = level x 5");
ok(W.hunterResistancePoints(5) === 6, "Hunter's Resistance points = 2 x PB (6 at 5th)");

group('Namespaced state parse — never parseClassResources');
{
  const blob = JSON.stringify({ used: { rage: 1 }, warden: { undyingUsed: true } });
  ok(W.loadWardenState(blob).undyingUsed === true, 'own parse reads .warden');
  const out = JSON.parse(W.serializeWardenState(blob, { ...W.loadWardenState(blob), undyingUsed: false }));
  ok(out.used.rage === 1 && out.warden.undyingUsed === false, 'serialize preserves unrelated top-level keys');
  const svcSrc = fs.readFileSync(path.join(REPO, 'server/services/wardenService.js'), 'utf8');
  ok(!svcSrc.includes('parseClassResources('), 'service never calls parseClassResources (header mentions it only in prose)');
}

group("Champion's Calls registry — 15 Calls, levels 3/6/13/20");
ok(WARDEN_SUBCLASSES.length === 15, '15 Calls wired');
ok(WARDEN_SUBCLASSES.every((c) => c.class === 'warden'), 'all Calls are warden class');
// Item 29: no per-entry selectionLevel in the data file — the server
// derives it from SUBCLASS_LEVELS (warden 3).
ok(WARDEN_SUBCLASSES.every((c) => !('selectionLevel' in c)), 'no Call carries a per-entry selectionLevel (item 29)');
ok(SUBCLASS_SERVICE.listSubclasses('warden').every((c) => c.selectionLevel === 3), 'all Calls derive selectionLevel 3');
ok(WARDEN_SUBCLASSES.every((c) => c.features.every((f) => [3, 6, 13, 20].includes(f.level))), 'all Call features at 3/6/13/20');
const callFeatureComplete = (f) => Boolean(f.key && f.name && f.mechanics && f.prompt && f.engine);
ok(WARDEN_SUBCLASSES.every((c) => c.features.every(callFeatureComplete)), 'every Call feature carries key/name/mechanics/prompt/engine');
{
  const grey = WARDEN_SUBCLASSES.find((c) => c.key === 'grey_watchman');
  ok(grey.choices.length === 1 && grey.choices[0].options.length === 9 && grey.choices[0].maxCount === 7, 'Grey Watchman maneuvers choice: 9 options, max 7');
  const lore = WARDEN_SUBCLASSES.find((c) => c.key === 'loreseeker');
  const soul = WARDEN_SUBCLASSES.find((c) => c.key === 'soulblood_shaman');
  ok(lore.features.some((f) => f.kind === 'D' && f.mechanics.schools.includes('Abjuration')), 'Loreseeker kind D, Abjuration/Evocation');
  ok(soul.features.some((f) => f.kind === 'D' && f.mechanics.schools.includes('Transmutation')), 'Soulblood kind D, Evocation/Transmutation');
  ok(lore.features.find((f) => f.kind === 'D').mechanics.fixedList.includes('NONE PRINTED'), 'Loreseeker has NO fixed list (not invented)');
  const base = WARDEN_SUBCLASSES.filter((c) => !['loreseeker', 'soulblood_shaman'].includes(c.key));
  ok(base.every((c) => !c.features.some((f) => f.kind === 'D')), 'no other Call grants spellcasting');
}

group('Merged levelProgression + classes.json');
ok(Object.keys(F.CLASS_FEATURES.warden).length === 20, 'merged CLASS_FEATURES has 20 levels');
ok(F.HIT_DICE.warden === 10 && F.SUBCLASS_LEVELS.warden === 3, 'merged hit die 10, subclass at 3rd');
ok(F.CASTER_TYPE.warden === 'third', 'merged CASTER_TYPE third (casting Calls use the Eldritch Knight / Arcane Trickster pattern; base still casts nothing)');
ok(F.SPELLCASTING_SUBCLASSES.warden.includes('Loreseeker') && F.SPELLCASTING_SUBCLASSES.warden.includes('Soulblood Shaman'), 'merged SPELLCASTING_SUBCLASSES lists both casting Calls');
ok(JSON.stringify(F.getMulticlassSpellSlots([{ class: 'warden', level: 6, subclass: 'Loreseeker' }]).spellSlots) === JSON.stringify(F.FULL_CASTER_SPELL_SLOTS[2]), 'warden third-caster multiclass: Loreseeker L6 contributes 2 caster levels');
ok(clientClasses.warden.subclasses.length === 15, 'merged classes.json entry lists 15 Calls');
ok(clientClasses.warden.subclasses.filter((s) => s.spellcasting).length === 2, 'merged classes.json entry gives spellcasting notes to exactly the 2 casting Calls');

console.log(`=== Results: ${passed} passed, ${failed} failed ===`);
process.exit(failed ? 1 : 0);
