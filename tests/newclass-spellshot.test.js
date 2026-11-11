// tests/newclass-spellshot.test.js — Spellshot (v0.5 homebrew) honest
// integration tests. Every assertion calls the REAL service, merged
// levelProgression, or subclass-file code — never a re-implementation. If the service
// file is deleted, these imports fail and the suite fails; that is
// the point. Numbers are digest-verbatim (see
// ~/workspace/dnd-app-review/new-classes-staging/digests/spellshot.md).
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');
const svc = (rel) => pathToFileURL(path.join(REPO, rel)).href;

const S = await import(svc('server/services/spellshotService.js'));
const F = await import(svc('server/config/levelProgression.js'));
const SUBCLASS_SERVICE = await import(svc('server/services/subclassService.js'));
const { SPELLSHOT_SUBCLASSES } = await import(svc('server/data/subclasses/spellshot.js'));
const clientClasses = JSON.parse(fs.readFileSync(path.join(REPO, 'client/src/data/classes.json'), 'utf8'));

let passed = 0, failed = 0;
function group(name) { console.log('== ' + name + ' =='); }
function ok(cond, msg) {
  try { assert(cond, msg); passed++; }
  catch (e) { failed++; console.error('FAIL:', msg, '|', e.message); }
}

group('Dynamo limit progression (digest-verbatim)');
ok(S.dynamoLimitForLevel(1) === 3, 'L1 Dynamo limit 3');
ok(S.dynamoLimitForLevel(5) === 8, 'L5 Dynamo limit 8');
ok(S.dynamoLimitForLevel(9) === 13, 'L9 Dynamo limit 13');
ok(S.dynamoLimitForLevel(19) === 25, 'L19 Dynamo limit 25');
ok(S.dynamoLimitForLevel(20) === Infinity, 'L20 Dynamo Unlimited (Infinity)');
ok(S.isDynamoUnlimited(20) && !S.isDynamoUnlimited(19), 'only 20th is Unlimited');
ok(S.DYNAMO_LIMIT.length === 20, 'Dynamo table has 20 rows');

group('Spells known / spell level limit / Dynamo costs');
ok(S.spellsKnownForLevel(1) === 0, 'L1 knows 0 spells (Battery begins at 2nd)');
ok(S.spellsKnownForLevel(2) === 2 && S.spellsKnownForLevel(20) === 13, 'spells known 2 at 2nd, 13 at 20th');
ok(S.spellsKnownForLevel(10) === 7 && S.spellsKnownForLevel(13) === 9, 'spells known 7 at 10th, 9 at 13th');
ok(S.spellLevelLimitForLevel(1) === 0 && S.spellLevelLimitForLevel(4) === 1, 'limit none at 1st, 1st-level spells at 4th');
ok(S.spellLevelLimitForLevel(5) === 2 && S.spellLevelLimitForLevel(9) === 3, 'limit 2nd at 5th, 3rd at 9th');
ok(S.spellLevelLimitForLevel(13) === 4 && S.spellLevelLimitForLevel(17) === 5, 'limit 4th at 13th, 5th at 17th');
ok(S.dynamoCostForSpellLevel(1) === 4 && S.dynamoCostForSpellLevel(2) === 6, 'costs 1st=4, 2nd=6');
ok(S.dynamoCostForSpellLevel(3) === 10 && S.dynamoCostForSpellLevel(4) === 12 && S.dynamoCostForSpellLevel(5) === 14, 'costs 3rd=10, 4th=12, 5th=14');

group('NO cantrips — flagged gap, wired as zero (digest UNRESOLVED 2)');
for (const l of [1, 2, 5, 10, 20]) ok(S.cantripsKnownForLevel(l) === 0, `cantrips known at L${l} is 0`);
ok(S.CANTRIPS_KNOWN_SPELLSHOT.every((n) => n === 0), 'cantrip table is all zeros');

group('Dynamo gain / spend / Spell Battery casting');
{
  const s0 = S.defaultSpellshotState();
  const g = S.gainDynamo(s0, 5, 4);
  ok(g.dynamo === 4 && s0.dynamo === 0, 'gain returns new state, does not mutate caller state');
  const capped = S.gainDynamo(g.state, 5, 99);
  ok(capped.dynamo === 8, 'gain caps at L5 limit 8');
  const spent = S.spendDynamo(capped.state, 5, 6);
  ok(spent.success && spent.dynamo === 2, 'spend 6 from 8 leaves 2');
  const broke = S.spendDynamo(spent.state, 5, 3);
  ok(!broke.success && broke.reason === 'insufficient_dynamo', 'spend beyond pool fails (hard refuse)');
  const cast = S.castSpellBatterySpell(S.defaultSpellshotState(), 5, 2);
  ok(!cast.success, 'cannot cast with empty pool');
  const rich = S.gainDynamo(S.defaultSpellshotState(), 5, 8);
  const cast2 = S.castSpellBatterySpell(rich.state, 5, 2);
  ok(cast2.success && cast2.dynamo === 2, '2nd-level cast at L5 costs 6 Dynamo');
  const over = S.castSpellBatterySpell(rich.state, 5, 3);
  ok(!over.success && over.reason === 'spell_level_above_limit', '3rd-level cast at L5 refused (limit 2nd)');
  const early = S.castSpellBatterySpell(S.defaultSpellshotState(), 1, 1);
  ok(!early.success && early.reason === 'spell_battery_not_yet_gained', 'no Spell Battery at 1st');
  const god = S.gainDynamo(S.defaultSpellshotState(), 20, 2);
  ok(god.gained === 3, '20th Determined Desperado: a gain of 2 yields 3');
  const godSpend = S.spendDynamo(S.defaultSpellshotState(), 20, 999);
  ok(godSpend.success, 'Unlimited Dynamo: spend never fails at 20th');
}

group('Skill Shots, arsenal, special bullets');
ok(S.SKILL_SHOTS.length === 16, '16 Skill Shots listed');
ok(S.skillShotsKnownForLevel(1) === 3 && S.skillShotsKnownForLevel(5) === 4, 'Skill Shots 3 at 1st, 4 at 5th');
ok(S.skillShotsKnownForLevel(17) === 7, 'Skill Shots 7 at 17th');
ok(S.skillShotsPerAttack(19) === 1 && S.skillShotsPerAttack(20) === Infinity, 'one Skill Shot per attack, any number at 20th');
{
  let s = S.defaultSpellshotState();
  const pre = S.learnSkillShot(s, 1, 'Spell and Shot');
  ok(!pre.success && pre.reason === 'spell_and_shot_requires_level_5', 'Spell and Shot requires 5th level');
  for (const shot of ['Burst of Speed', 'Cauterize', 'Countershot']) { const r = S.learnSkillShot(s, 1, shot); s = r.state; ok(r.success, `learn ${shot}`); }
  const over = S.learnSkillShot(s, 1, 'Fan the Hammer');
  ok(!over.success && over.reason === 'skill_shots_known_cap', '4th Skill Shot at 1st refused (cap 3)');
  const dup = S.learnSkillShot(s, 1, 'Burst of Speed');
  ok(!dup.success, 'duplicate Skill Shot refused');
  const unk = S.learnSkillShot(s, 1, 'Arcane Tinkerer Trick');
  ok(!unk.success && unk.reason === 'unknown_skill_shot', 'unknown Skill Shot refused');
  const ars = S.setArsenal(S.defaultSpellshotState(), 1, ['Pistol', 'Revolver', 'Musket']);
  ok(!ars.success && ars.reason === 'arsenal_exceeds_proficiency_bonus', 'arsenal above proficiency bonus (2 at 1st) refused');
  ok(S.arsenalSizeForLevel(1) === 2 && S.arsenalSizeForLevel(9) === 4, 'arsenal size = proficiency bonus');
  let b = S.defaultSpellshotState();
  for (let i = 0; i < 5; i++) { const r = S.craftSpecialBullet(b); b = r.state; ok(r.success, `special bullet ${i + 1}/5`); }
  const b6 = S.craftSpecialBullet(b);
  ok(!b6.success && b6.reason === 'special_bullets_exhausted', '6th special bullet refused (max 5/long rest)');
  ok(S.elementalArsenalDice(4) === '1d6' && S.elementalArsenalDice(10) === '2d6' && S.elementalArsenalDice(11) === '3d6', 'Elemental Arsenal dice by Dynamo spent');
}

group('Rest recovery — Grit rules');
{
  const s = (d) => ({ ...S.defaultSpellshotState(), dynamo: d });
  ok(S.onShortRest(s(7), { level: 1 }).state.dynamo === 0, 'L1 loses all Dynamo on short rest');
  ok(S.onLongRest(s(7), { level: 1 }).state.dynamo === 0, 'L1 loses all Dynamo on long rest');
  ok(S.onShortRest(s(10), { level: 9 }).state.dynamo === 4, 'L9 Unshakeable Grit keeps up to PB (4)');
  ok(S.onLongRest(s(2), { level: 9 }).state.dynamo === 2, 'L9 keeps what it has below PB');
  ok(S.onLongRest(s(20), { level: 18 }).state.dynamo === 12, 'L18 Unrelenting Grit keeps up to 2x PB (12)');
  ok(S.onLongRest(s(1), { level: 18 }).state.dynamo === 6, 'L18 long rest floors Dynamo to PB (6)');
  ok(S.onShortRest(s(1), { level: 18 }).state.dynamo === 1, 'L18 short rest has NO floor (long-rest floor only)');
  ok(S.initiativeDynamoFloor(18) === 3, 'L18 initiative floor is half PB, floored (3)');
  ok(S.applyInitiativeFloor(s(0), 18).state.dynamo === 3, 'initiative floor raises 0 to 3 at 18th');
}

group('Namespaced state parse — never parseClassResources');
{
  const blob = JSON.stringify({ used: { rage: 1 }, spellshot: { dynamo: 5, skillShots: ['Cauterize'] } });
  const loaded = S.loadSpellshotState(blob);
  ok(loaded.dynamo === 5 && loaded.skillShots.includes('Cauterize'), 'own parse reads .spellshot');
  const out = JSON.parse(S.serializeSpellshotState(blob, { ...loaded, dynamo: 6 }));
  ok(out.used.rage === 1 && out.spellshot.dynamo === 6, 'serialize preserves unrelated top-level keys');
  const svcSrc = fs.readFileSync(path.join(REPO, 'server/services/spellshotService.js'), 'utf8');
  ok(!svcSrc.includes('parseClassResources('), 'service never calls parseClassResources (header mentions it only in prose)');
  ok(!svcSrc.includes("from '../database.js'") && !svcSrc.includes("from './markerPipeline.js'"), 'no static imports of mirror-missing modules (dynamic DB import only)');
}

group('Drives registry — 4 body Drives only, no Arcane Tinkerer');
ok(SPELLSHOT_SUBCLASSES.length === 4, '4 Drives wired');
ok(SPELLSHOT_SUBCLASSES.map((d) => d.name).join('|') === 'Bullet Weaver|Thrill Seeker|Virtuoso|Wildcard', 'Drive names match digest order');
ok(!SPELLSHOT_SUBCLASSES.some((d) => d.name === 'Arcane Tinkerer'), 'Arcane Tinkerer NOT wired (changelog-only, digest UNRESOLVED 1)');
ok(SPELLSHOT_SUBCLASSES.every((d) => d.class === 'spellshot'), 'all Drives are spellshot class');
// Item 29: no per-entry selectionLevel in the data file — the server
// derives it from SUBCLASS_LEVELS (spellshot 3).
ok(SPELLSHOT_SUBCLASSES.every((d) => !('selectionLevel' in d)), 'no Drive carries a per-entry selectionLevel (item 29)');
ok(SUBCLASS_SERVICE.listSubclasses('spellshot').every((d) => d.selectionLevel === 3), 'all Drives derive selectionLevel 3');
ok(SPELLSHOT_SUBCLASSES.every((d) => d.features.every((f) => [3, 7, 10, 15].includes(f.level))), 'all Drive features at 3/7/10/15');
const driveFeatureComplete = (f) => Boolean(f.key && f.name && f.mechanics && f.prompt && f.engine);
ok(SPELLSHOT_SUBCLASSES.every((d) => d.features.every(driveFeatureComplete)), 'every Drive feature carries key/name/mechanics/prompt/engine');

group('Merged levelProgression + classes.json');
ok(Object.keys(F.CLASS_FEATURES.spellshot).length === 20, 'merged CLASS_FEATURES has 20 levels');
ok(F.HIT_DICE.spellshot === 8 && F.SUBCLASS_LEVELS.spellshot === 3, 'merged hit die 8, subclass at 3rd');
ok(F.CASTER_TYPE.spellshot === 'none', 'merged CASTER_TYPE none (Dynamo, not slots)');
ok(JSON.stringify(F.getSpellSlots('spellshot', 5)) === '{}', 'getSpellSlots has NO branch for spellshot (Dynamo, not slots)');
ok(clientClasses.spellshot.hitDie === 8 && clientClasses.spellshot.spellcasting.system.includes('Dynamo'), 'merged classes.json entry is a Dynamo caster');
ok(!('spellSlots' in clientClasses.spellshot.spellcasting), 'merged classes.json entry has NO slot table for Spellshot');
ok(clientClasses.spellshot.subclasses.length === 4, 'merged classes.json entry lists 4 Drives');
ok(S.NORMAL_FIREARMS.length === 5, '5 Normal firearms wired (Improved/Mastered rows NOT invented)');

console.log(`=== Results: ${passed} passed, ${failed} failed ===`);
process.exit(failed ? 1 : 0);
