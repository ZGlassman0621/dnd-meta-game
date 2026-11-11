// tests/newclass-scholar.test.js — Scholar (digest-only build).
//
// Honest-integration rules: every assertion calls the REAL scholarService /
// merged levelProgression / subclass-file exports — never a re-implementation. If the service
// file is deleted, the static import below fails and the suite fails. Expected
// values are literals taken from digests/scholar.md, not computed by copied logic.
// What this does NOT test: DB load/save against a live database (database.js is
// absent from this mirror — load/save degrade to default state / false here and
// are covered by Zach's full run on the Mac), the DM-prompt rendering path, or
// spell-name validation (newClassSpellLists.js is another agent's file).
import assert from 'node:assert';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  sageAdviceUsesMax, eruditeApplicationsKnownForLevel, ERUDITE_APPLICATIONS,
  analyzeEnemyBonusDamage, physicianPointsMax, brilliantMindUsesMax,
  flashOfGeniusUsesMax, spellSlotsForSubclassLevel, cantripsKnownForSubclass,
  spellsKnownOrPreparedForSubclass, defaultScholarState, learnApplication,
  useSageAdvice, spendPhysicianPoint, useBrilliantMind, useFlashOfGenius,
  onLongRest, onShortRest, scholarPromptSection, MULTICLASS_GRANT,
  registerScholarMarkers, loadScholarState,
} from '../server/services/scholarService.js';
import { SCHOLAR_SUBCLASSES } from '../server/data/subclasses/scholar.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');
const svc = (rel) => pathToFileURL(path.join(REPO, rel)).href;

const F = await import(svc('server/config/levelProgression.js'));
const SUBCLASS_SERVICE = await import(svc('server/services/subclassService.js'));

const results = [];
async function check(name, fn) {
  try { await fn(); results.push([name, true]); console.log(`ok - ${name}`); }
  catch (e) { results.push([name, false]); console.log(`FAIL - ${name}: ${e.message}`); }
}

// --- Sage Advice uses (digest: Int mod, min 1, per long rest) ---
await check('sageAdviceUsesMax: intMod 3 -> 3, 0 -> 1, -2 -> 1', () => {
  assert.equal(sageAdviceUsesMax(3), 3);
  assert.equal(sageAdviceUsesMax(0), 1);
  assert.equal(sageAdviceUsesMax(-2), 1);
});
await check('useSageAdvice spends until empty, then fails', () => {
  let r = useSageAdvice(defaultScholarState(), 2);
  assert.equal(r.success, true); assert.equal(r.usesLeft, 1);
  r = useSageAdvice(r.state, 2);
  assert.equal(r.success, true); assert.equal(r.usesLeft, 0);
  r = useSageAdvice(r.state, 2);
  assert.equal(r.success, false); assert.equal(r.reason, 'no_uses_left');
});
await check('onLongRest refills Sage Advice; onShortRest only from 5th (Sagacious Font)', () => {
  const spent = { ...defaultScholarState(), sageAdviceUsesMax: 3, sageAdviceUsesLeft: 0 };
  assert.equal(onLongRest(spent, { level: 5, intMod: 3 }).state.sageAdviceUsesLeft, 3);
  assert.equal(onShortRest(spent, { level: 4, intMod: 3 }).state.sageAdviceUsesLeft, 0);
  assert.equal(onShortRest(spent, { level: 5, intMod: 3 }).state.sageAdviceUsesLeft, 3);
});

// --- Erudite Applications count (digest table: 0,2,2,2,3,...,8) ---
await check('eruditeApplicationsKnownForLevel: 1->0, 2->2, 5->3, 8->4, 20->8', () => {
  assert.equal(eruditeApplicationsKnownForLevel(1), 0);
  assert.equal(eruditeApplicationsKnownForLevel(2), 2);
  assert.equal(eruditeApplicationsKnownForLevel(5), 3);
  assert.equal(eruditeApplicationsKnownForLevel(8), 4);
  assert.equal(eruditeApplicationsKnownForLevel(20), 8);
});
await check('ERUDITE_APPLICATIONS has exactly 29 entries', () => {
  assert.equal(ERUDITE_APPLICATIONS.length, 29);
});
await check('learnApplication enforces the known cap at level 2', () => {
  let s = { ...defaultScholarState(), field: 'Diplomat' };
  let r = learnApplication(s, 2, 'bonus_languages'); assert.equal(r.success, true);
  r = learnApplication(r.state, 2, 'well_educated'); assert.equal(r.success, true);
  r = learnApplication(r.state, 2, 'expertise');
  assert.equal(r.success, false); assert.equal(r.reason, 'applications_known_cap');
});
await check('learnApplication enforces field prerequisites unless ignored (Esoteric)', () => {
  const s = { ...defaultScholarState(), field: 'Culinarian' };
  let r = learnApplication(s, 2, 'diehard');
  assert.equal(r.success, false); assert.equal(r.reason, 'field_prerequisite_not_met');
  r = learnApplication(s, 2, 'diehard', { ignorePrerequisite: true });
  assert.equal(r.success, true); assert.deepEqual(r.state.esotericApplications, ['diehard']);
});

// --- Analyze Enemy / Physician / late features ---
await check('analyzeEnemyBonusDamage: 4->0, 5->1d10, 11->2d10, 17->3d10', () => {
  assert.equal(analyzeEnemyBonusDamage(4), '0');
  assert.equal(analyzeEnemyBonusDamage(5), '1d10');
  assert.equal(analyzeEnemyBonusDamage(11), '2d10');
  assert.equal(analyzeEnemyBonusDamage(17), '3d10');
});
await check('physicianPointsMax equals scholar level; spend + long rest refill', () => {
  assert.equal(physicianPointsMax(7), 7);
  let r = spendPhysicianPoint(defaultScholarState(), 7);
  assert.equal(r.success, true); assert.equal(r.pointsLeft, 6);
  assert.equal(onLongRest(r.state, { level: 7, intMod: 3 }).state.physicianPointsLeft, 7);
});
await check('Brilliant Mind (10th) and Flash of Genius (18th) gates', () => {
  assert.equal(brilliantMindUsesMax(9), 0); assert.equal(brilliantMindUsesMax(10), 1);
  assert.equal(flashOfGeniusUsesMax(17), 0); assert.equal(flashOfGeniusUsesMax(18), 1);
  assert.equal(useBrilliantMind(defaultScholarState(), 9).success, false);
  assert.equal(useFlashOfGenius(defaultScholarState(), 18).success, true);
  assert.equal(useFlashOfGenius(useFlashOfGenius(defaultScholarState(), 18).state, 18).success, false);
});

// --- Subclass spellcasting (slots/cantrips/endpoints only) ---
await check('spellSlotsForSubclassLevel: non-caster {}, Ritualist 3->{1:2}, 19->{1:4,2:3,3:3,4:1}', () => {
  assert.deepEqual(spellSlotsForSubclassLevel('Culinarian', 10), {});
  assert.deepEqual(spellSlotsForSubclassLevel('Ritualist', 3), { 1: 2 });
  assert.deepEqual(spellSlotsForSubclassLevel('Theologian', 19), { 1: 4, 2: 3, 3: 3, 4: 1 });
  assert.deepEqual(spellSlotsForSubclassLevel('Ritualist', 2), {});
});
await check('cantripsKnownForSubclass: 3->2, 9->3, non-caster 0', () => {
  assert.equal(cantripsKnownForSubclass('Ritualist', 3), 2);
  assert.equal(cantripsKnownForSubclass('Theologian', 9), 3);
  assert.equal(cantripsKnownForSubclass('Tactician', 20), 0);
});
await check('spellsKnownOrPrepared: endpoints 3->3, 20->13; intermediate is null (unknown, not guessed)', () => {
  assert.equal(spellsKnownOrPreparedForSubclass('Ritualist', 3), 3);
  assert.equal(spellsKnownOrPreparedForSubclass('Theologian', 20), 13);
  assert.equal(spellsKnownOrPreparedForSubclass('Ritualist', 10), null);
  assert.equal(spellsKnownOrPreparedForSubclass('Physician', 10), 0);
});

// --- Merged levelProgression + subclass-file consistency ---
// (2026-11-05 gate fix: same assertions as the overnight fragment check, now
// against the merged live levelProgression.js. NOTE the caster value: the
// fragment said 'none', but the merge overrode Scholar to 'third' (Eldritch
// Knight / Arcane Trickster pattern, via SPELLCASTING_SUBCLASSES) — 'third'
// is the live value, verified against the pushed bytes.)
await check('merged levelProgression: 20 CLASS_FEATURES levels, subclass level 1, hit die 6, multiclass free (no prerequisites — removed 2026-11-08), caster third (casting-fields override)', () => {
  assert.equal(Object.keys(F.CLASS_FEATURES.scholar).length, 20);
  assert.equal(F.SUBCLASS_LEVELS.scholar, 1);
  assert.equal(F.HIT_DICE.scholar, 6);
  assert.equal(F.CASTER_TYPE.scholar, 'third');
});
await check('MULTICLASS_GRANT: light armor + one class skill', () => {
  assert.deepEqual(MULTICLASS_GRANT.armor, ['light']);
  assert.equal(MULTICLASS_GRANT.skillChoices, 1);
});
await check('subclass file: 6 Fields of Study, Theologian wired as prepared; no per-entry selectionLevel (server derives it, item 29)', () => {
  assert.equal(SCHOLAR_SUBCLASSES.length, 6);
  assert.deepEqual(SCHOLAR_SUBCLASSES.map((s) => s.key),
    ['culinarian', 'diplomat', 'physician', 'ritualist', 'tactician', 'theologian']);
  assert.ok(SCHOLAR_SUBCLASSES.every((s) => !('selectionLevel' in s)));
  assert.ok(SUBCLASS_SERVICE.listSubclasses('scholar').every((s) => s.selectionLevel === 1));
  const theo = SCHOLAR_SUBCLASSES.find((s) => s.key === 'theologian');
  const casting = theo.features.find((f) => f.key === 'theologian_spellcasting');
  assert.equal(casting.mechanics.preparedNotKnown, true);
});
await check('prompt section names the field and the Sage Advice pool', () => {
  const text = scholarPromptSection({ ...defaultScholarState(), field: 'Ritualist' }, { level: 3, intMod: 3 });
  assert.ok(text.includes('Ritualist') && text.includes('Sage Advice'));
});

// --- Marker registration through a fake registrar (no live markerPipeline here) ---
await check('registerScholarMarkers registers 4 markers; SAGE_ADVICE handler spends a real use', async () => {
  const handlers = {};
  const saved = {};
  registerScholarMarkers((name, fn) => { handlers[name] = fn; }, {
    resolveActor: async () => ({ kind: 'player', id: 1, name: 'Test', className: 'scholar', level: 5, intMod: 3 }),
    loadState: async () => defaultScholarState(),
    saveState: async (kind, id, state) => { saved.state = state; return true; },
  });
  assert.deepEqual(Object.keys(handlers).sort(),
    ['SCHOLAR_BRILLIANT_MIND', 'SCHOLAR_FLASH_OF_GENIUS', 'SCHOLAR_PHYSICIAN_POINT', 'SCHOLAR_SAGE_ADVICE']);
  const res = await handlers.SCHOLAR_SAGE_ADVICE({}, { characterId: 1 });
  assert.equal(res.success, true); assert.equal(res.usesLeft, 2);
  assert.equal(saved.state.sageAdviceUsesLeft, 2);
});
await check('loadScholarState degrades to default state without a live database.js', async () => {
  assert.deepEqual(await loadScholarState('player', 999), defaultScholarState());
});

const failed = results.filter(([, ok]) => !ok).length;
console.log(`=== Results: ${results.length - failed} passed, ${failed} failed ===`);
process.exit(failed ? 1 : 0);
