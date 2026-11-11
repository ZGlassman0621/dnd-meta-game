// tests/newclass-duelist.test.js — Duelist (Overview-only build).
//
// Honest-integration rules: every assertion calls the REAL duelistService /
// merged levelProgression / subclass-file exports — never a re-implementation. If the service
// file is deleted, the static import below fails and the suite fails. Expected
// values are literals taken from digests/duelist.md.
// What this does NOT test: DB load/save against a live database (database.js is
// absent from this mirror), the attack path consuming Martial Advantage dice or
// crit thresholds, or any Overview gap (multiclass, expanded archetype text,
// feats, NPC/DM guidance — none exist in the source to test).
import assert from 'node:assert';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  martialAdvantageDiceForLevel, martialAdvantageDiceString,
  determinedUsesMaxForLevel, criticalStrikesKnownForLevel, critThresholdFor,
  defaultDuelistState, learnCriticalStrike, useDetermined,
  regainDeterminedAtInitiative, onLongRest, duelistPromptSection,
  registerDuelistMarkers, loadDuelistState, CRITICAL_STRIKE_OPTIONS,
} from '../server/services/duelistService.js';
import { DUELIST_SUBCLASSES } from '../server/data/subclasses/duelist.js';

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

// --- Martial Advantage dice (per-turn, NOT expended) ---
await check('martialAdvantageDiceForLevel: 1->2, 5->3, 10->4, 15->5, 20->6', () => {
  assert.equal(martialAdvantageDiceForLevel(1), 2);
  assert.equal(martialAdvantageDiceForLevel(5), 3);
  assert.equal(martialAdvantageDiceForLevel(10), 4);
  assert.equal(martialAdvantageDiceForLevel(15), 5);
  assert.equal(martialAdvantageDiceForLevel(20), 6);
  assert.equal(martialAdvantageDiceString(20), '6d6');
});

// --- Determined rerolls ---
await check('determinedUsesMaxForLevel: 6->0, 7->1, 11->2, 15->3, 18->4', () => {
  assert.equal(determinedUsesMaxForLevel(6), 0);
  assert.equal(determinedUsesMaxForLevel(7), 1);
  assert.equal(determinedUsesMaxForLevel(11), 2);
  assert.equal(determinedUsesMaxForLevel(15), 3);
  assert.equal(determinedUsesMaxForLevel(18), 4);
});
await check('useDetermined spends until empty, then fails; long rest refills', () => {
  let r = useDetermined(defaultDuelistState(), 11);
  assert.equal(r.success, true); assert.equal(r.usesLeft, 1);
  r = useDetermined(r.state, 11);
  assert.equal(r.success, true); assert.equal(r.usesLeft, 0);
  r = useDetermined(r.state, 11);
  assert.equal(r.success, false); assert.equal(r.reason, 'no_uses_left');
  assert.equal(onLongRest(r.state, { level: 11 }).state.determinedUsesLeft, 2);
});
await check('Steely Determination: 20th + empty -> regain 1; non-empty fails; below 20 fails', () => {
  const empty = { ...defaultDuelistState(), determinedUsesMax: 4, determinedUsesLeft: 0 };
  assert.equal(regainDeterminedAtInitiative(empty, 20).usesLeft, 1);
  const full = { ...defaultDuelistState(), determinedUsesMax: 4, determinedUsesLeft: 2 };
  assert.equal(regainDeterminedAtInitiative(full, 20).success, false);
  assert.equal(regainDeterminedAtInitiative(empty, 19).success, false);
});

// --- Critical Strikes ---
await check('criticalStrikesKnownForLevel: 4->0, 5->2, 9->3, 14->4; exactly 5 options', () => {
  assert.equal(criticalStrikesKnownForLevel(4), 0);
  assert.equal(criticalStrikesKnownForLevel(5), 2);
  assert.equal(criticalStrikesKnownForLevel(9), 3);
  assert.equal(criticalStrikesKnownForLevel(14), 4);
  assert.equal(CRITICAL_STRIKE_OPTIONS.length, 5);
});
await check('learnCriticalStrike enforces cap and rejects unknown options', () => {
  let s = defaultDuelistState();
  let r = learnCriticalStrike(s, 5, 'Blinding Strike'); assert.equal(r.success, true);
  r = learnCriticalStrike(r.state, 5, 'Stunning Strike'); assert.equal(r.success, true);
  r = learnCriticalStrike(r.state, 5, 'Menacing Strike');
  assert.equal(r.success, false); assert.equal(r.reason, 'critical_strikes_known_cap');
  assert.equal(learnCriticalStrike(defaultDuelistState(), 5, 'No Such Strike').success, false);
});

// --- Blade crit thresholds (archetype-only, not whole class) ---
await check('critThresholdFor: Blade 3->19, 17->18; Mask/Acrobat always 20', () => {
  assert.equal(critThresholdFor('Blade', 3), 19);
  assert.equal(critThresholdFor('Blade', 17), 18);
  assert.equal(critThresholdFor('Mask', 17), 20);
  assert.equal(critThresholdFor('Acrobat', 17), 20);
  assert.equal(critThresholdFor('Blade', 2), 20);
});

// --- Merged levelProgression + subclass-file consistency ---
// (2026-11-05 gate fix: same assertions as the overnight fragment check, now
// against the merged live levelProgression.js — the staging fragment lived only
// on the VM, so its absolute path could never resolve on the Mac.)
await check('merged levelProgression: 20 levels, subclass level 3, hit die 10, ASI includes 10th, caster none, multiclass free (no prerequisites — removed 2026-11-08)', () => {
  assert.equal(Object.keys(F.CLASS_FEATURES.duelist).length, 20);
  assert.equal(F.SUBCLASS_LEVELS.duelist, 3);
  assert.equal(F.HIT_DICE.duelist, 10);
  assert.equal(F.hasASI('duelist', 10), true);
  assert.equal(F.CASTER_TYPE.duelist, 'none');
});
await check('subclass file: 3 archetypes; Blade carries the Additional Fighting Style choice; no per-entry selectionLevel (server derives it, item 29)', () => {
  assert.equal(DUELIST_SUBCLASSES.length, 3);
  assert.deepEqual(DUELIST_SUBCLASSES.map((s) => s.key), ['blade', 'mask', 'acrobat']);
  assert.ok(DUELIST_SUBCLASSES.every((s) => !('selectionLevel' in s)));
  assert.ok(SUBCLASS_SERVICE.listSubclasses('duelist').every((s) => s.selectionLevel === 3));
  const blade = DUELIST_SUBCLASSES.find((s) => s.key === 'blade');
  assert.deepEqual(blade.choices[0].options, ['Defense', 'Dueling', 'Protection', 'Two-weapon Fighting']);
});
await check('prompt section states Martial Advantage is not expended', () => {
  const text = duelistPromptSection({ ...defaultDuelistState(), archetype: 'Blade' }, { level: 5 });
  assert.ok(text.includes('3d6') && text.includes('NOT expended'));
});

// --- Marker registration through a fake registrar ---
await check('registerDuelistMarkers registers 3 markers; DETERMINED handler spends a real use', async () => {
  const handlers = {};
  const saved = {};
  registerDuelistMarkers((name, fn) => { handlers[name] = fn; }, {
    resolveActor: async () => ({ kind: 'player', id: 1, name: 'Test', className: 'duelist', level: 7 }),
    loadState: async () => defaultDuelistState(),
    saveState: async (kind, id, state) => { saved.state = state; return true; },
  });
  assert.deepEqual(Object.keys(handlers).sort(),
    ['DUELIST_CRITICAL_STRIKE', 'DUELIST_DETERMINED', 'DUELIST_STEELY']);
  const res = await handlers.DUELIST_DETERMINED({}, { characterId: 1 });
  assert.equal(res.success, true); assert.equal(res.usesLeft, 0);
  assert.equal(saved.state.determinedUsesLeft, 0);
});
await check('loadDuelistState degrades to default state without a live database.js', async () => {
  assert.deepEqual(await loadDuelistState('player', 999), defaultDuelistState());
});

const failed = results.filter(([, ok]) => !ok).length;
console.log(`=== Results: ${results.length - failed} passed, ${failed} failed ===`);
process.exit(failed ? 1 : 0);
