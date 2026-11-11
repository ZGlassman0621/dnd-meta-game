// tests/newclass-blood-hunter.test.js — Blood Hunter (GM Binder 2024 fan conversion).
// Honest-integration rules: every assertion below calls the REAL
// bloodHunterService.js / blood_hunter.js registry / levelProgression.js.
// Nothing here re-implements service logic; deleting the service file
// makes this suite fail at import.
// Coverage: Hemocraft die, Maledict maxima (Ghostslayer + Vermillion),
// curses known, rites known, mutagen tables, Hybrid/Aether Walk/Exalted
// maxima, rite activation (Rite Focus), Maledict spend, mutagen
// concoct/consume/flush, the once-per-rest features, pure rest resets,
// the DM prompt section, DB load/save (injected fake client), and the
// registry match (20 Mutagen Formulas, Curse Specialist 3rd, Aether
// Walk 7th). Group 11 runs the DM rest through the REAL
// restTimeService.js on a throwaway DB (rest-time.test.js pattern);
// it needs the repo DB, so it is skipped with a loud note in a mirror
// that has no database.js — it MUST run in Zach's npm test.
// What this does NOT cover (honest scope): marker handlers (none in
// v1), rite combat damage / curse effects (registry + DM-prompt in
// v1), Profane Soul spellcasting (profaneSoulService.js, untouched),
// the DM prompt builder / companion prompt dispatch (the prompt
// sections themselves are asserted here; the dispatchers call them).
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');
const svc = (rel) => pathToFileURL(path.join(REPO, rel)).href;

const bh = await import(svc('server/services/bloodHunterService.js'));
const { BLOOD_HUNTER_SUBCLASSES } = await import(svc('server/data/subclasses/blood_hunter.js'));
const { SUBCLASS_LEVELS } = await import(svc('server/config/levelProgression.js'));

// --- Pure math tables (PDF values, no guessing) ---
assert.equal(bh.hemocraftDieForLevel(1), '1d4');
assert.equal(bh.hemocraftDieForLevel(4), '1d4');
assert.equal(bh.hemocraftDieForLevel(5), '1d6');
assert.equal(bh.hemocraftDieForLevel(9), '1d6');
assert.equal(bh.hemocraftDieForLevel(10), '1d8');
assert.equal(bh.hemocraftDieForLevel(14), '1d8');
assert.equal(bh.hemocraftDieForLevel(15), '1d10');
assert.equal(bh.hemocraftDieForLevel(20), '1d10');
assert.equal(bh.hemocraftDieForLevel(0), '1d4'); // clamped to 1st
assert.equal(bh.hemocraftDieForLevel(99), '1d10'); // clamped to 20th

// Maledict: 1/2/3/4 at 1/6/13/17; Ghostslayer Curse Specialist +1 from 3rd;
// Vermillion mutagen +1 while active.
assert.equal(bh.bloodMaledictUsesMax(1), 1);
assert.equal(bh.bloodMaledictUsesMax(6), 2);
assert.equal(bh.bloodMaledictUsesMax(13), 3);
assert.equal(bh.bloodMaledictUsesMax(17), 4);
assert.equal(bh.bloodMaledictUsesMax(3, { subclass: 'Order of the Ghostslayer' }), 2);
assert.equal(bh.bloodMaledictUsesMax(6, { subclass: 'Ghostslayer' }), 3);
assert.equal(bh.bloodMaledictUsesMax(2, { subclass: 'Ghostslayer' }), 1); // +1 starts at 3rd, not 1st
assert.equal(bh.bloodMaledictUsesMax(6, { subclass: 'Lycan' }), 2); // no Ghostslayer bonus
assert.equal(bh.bloodMaledictUsesMax(6, { vermillionActive: true }), 3);
assert.equal(bh.bloodMaledictUsesMax(6, { subclass: 'Ghostslayer', vermillionActive: true }), 4);

assert.equal(bh.bloodCursesKnownForLevel(1), 1);
assert.equal(bh.bloodCursesKnownForLevel(6), 2);
assert.equal(bh.bloodCursesKnownForLevel(10), 3);
assert.equal(bh.bloodCursesKnownForLevel(14), 4);
assert.equal(bh.bloodCursesKnownForLevel(18), 5);

assert.deepEqual(bh.ritesKnownForLevel(1), { primal: 0, esoteric: 0, total: 0 });
assert.deepEqual(bh.ritesKnownForLevel(2), { primal: 1, esoteric: 0, total: 1 });
assert.deepEqual(bh.ritesKnownForLevel(7), { primal: 2, esoteric: 0, total: 2 });
assert.deepEqual(bh.ritesKnownForLevel(14), { primal: 2, esoteric: 1, total: 3 });

assert.equal(bh.mutagenFormulasKnownForLevel(2), 0);
assert.equal(bh.mutagenFormulasKnownForLevel(3), 4);
assert.equal(bh.mutagenFormulasKnownForLevel(7), 5);
assert.equal(bh.mutagenFormulasKnownForLevel(11), 6);
assert.equal(bh.mutagenFormulasKnownForLevel(15), 7);
assert.equal(bh.mutagenFormulasKnownForLevel(18), 8);
assert.equal(bh.mutagensCreatedForLevel(2), 0);
assert.equal(bh.mutagensCreatedForLevel(3), 1);
assert.equal(bh.mutagensCreatedForLevel(7), 2);
assert.equal(bh.mutagensCreatedForLevel(11), 2);
assert.equal(bh.mutagensCreatedForLevel(15), 3);
assert.equal(bh.mutagensCreatedForLevel(18), 3);

assert.equal(bh.hybridTransformationUsesMax(2), 0);
assert.equal(bh.hybridTransformationUsesMax(3), 1);
assert.equal(bh.hybridTransformationUsesMax(11), 2);
assert.equal(bh.hybridTransformationUsesMax(18), Infinity);
assert.equal(bh.aetherWalkUsesMax(6), 0);
assert.equal(bh.aetherWalkUsesMax(7), 1);
assert.equal(bh.aetherWalkUsesMax(15), 2);
assert.equal(bh.exaltedMutationUsesMax(3), 3);
assert.equal(bh.exaltedMutationUsesMax(0), 1); // Int mod, min 1
assert.equal(bh.exaltedMutationUsesMax(-2), 1);

// --- Registry consistency: 4 Orders, 25 features, selection at 3rd ---
assert.equal(BLOOD_HUNTER_SUBCLASSES.length, 4);
assert.deepEqual(BLOOD_HUNTER_SUBCLASSES.map((e) => e.key).sort(), ['ghostslayer', 'lycan', 'mutant', 'profane_soul']);
for (const entry of BLOOD_HUNTER_SUBCLASSES) {
  assert.equal(entry.class, 'blood_hunter');
  assert.equal(entry.gateCheckRequired, true);
}
assert.equal(BLOOD_HUNTER_SUBCLASSES.reduce((n, e) => n + e.features.length, 0), 26); // design said 25 — the registry holds 26 (node-imported count)
assert.equal(SUBCLASS_LEVELS.blood_hunter, 3);
// Design corrections, pinned against the registry (not the design file):
// Curse Specialist is 3rd (not 7th); Aether Walk is 7th.
const ghost = BLOOD_HUNTER_SUBCLASSES.find((e) => e.key === 'ghostslayer');
assert.equal(ghost.features.find((f) => f.key === 'curse_specialist').level, 3);
assert.equal(ghost.features.find((f) => f.key === 'aether_walk').level, 7);
assert.equal(ghost.features.find((f) => f.key === 'rite_revival').level, 18);
const lycan = BLOOD_HUNTER_SUBCLASSES.find((e) => e.key === 'lycan');
assert.equal(lycan.features.find((f) => f.key === 'hybrid_transformation').level, 3);
const mutant = BLOOD_HUNTER_SUBCLASSES.find((e) => e.key === 'mutant');
assert.equal(mutant.features.find((f) => f.key === 'exalted_mutation').level, 18);
// The 20 Mutagen Formulas + prerequisites match the registry exactly —
// the two lists cannot drift silently.
const regFormulas = mutant.features.find((f) => f.key === 'mutagen_formulas').mechanics.formulas;
assert.equal(regFormulas.length, 20);
assert.equal(bh.MUTAGEN_FORMULAS.length, 20);
const prereqOf = (f) => (f.prerequisite ? parseInt(f.prerequisite, 10) : 0);
assert.deepEqual(
  [...bh.MUTAGEN_FORMULAS].map((f) => [f.name, f.prerequisiteLevel]).sort(),
  [...regFormulas].map((f) => [f.name, prereqOf(f)]).sort(),
);

// No MULTICLASS_GRANT export: the grant lives in levelProgression.js
// (single source of truth); this service must not duplicate it.
assert.equal(bh.MULTICLASS_GRANT, undefined);
assert.equal(typeof bh.default.hemocraftDieForLevel, 'function');

// --- Crimson Rite: activation, Rite Focus, one rite per weapon ---
let st = bh.defaultBloodHunterState();
let r = bh.activateRite(st, { weapon: 'Longsword', rite: 'Flame', level: 2, intMod: 3 });
assert.equal(r.success, true);
assert.equal(r.selfDamageDie, '1d4');
assert.equal(r.selfDamageReduction, 0); // Rite Focus starts at 5th
assert.equal(r.selfDamageMinimum, 1);
assert.deepEqual(r.state.activeRites, [{ weapon: 'Longsword', rite: 'Flame', damageType: 'Fire' }]);
assert.deepEqual(r.state.ritesKnown, ['Flame']);
st = r.state;
r = bh.activateRite(st, { weapon: 'Longsword', rite: 'Storm', level: 2, intMod: 3 });
assert.equal(r.success, false); assert.equal(r.reason, 'weapon_already_has_rite');
r = bh.activateRite(st, { weapon: 'Shortbow', rite: 'Storm', level: 2, intMod: 3 });
assert.equal(r.success, true); // a second weapon can hold its own rite
assert.equal(r.state.activeRites.length, 2);
st = r.state;
assert.equal(bh.activateRite(st, { weapon: 'Dagger', rite: 'Dead', level: 13, intMod: 3 }).reason, 'esoteric_rite_locked');
r = bh.activateRite(st, { weapon: 'Dagger', rite: 'Dead', level: 14, intMod: 3 });
assert.equal(r.success, true); assert.equal(r.state.activeRites[2].damageType, 'Necrotic');
assert.equal(bh.activateRite(st, { weapon: 'Dagger', rite: 'Frost', level: 5, intMod: 3 }).reason, 'unknown_rite');
assert.equal(bh.activateRite(st, { weapon: '', rite: 'Flame', level: 5, intMod: 3 }).reason, 'no_weapon');
assert.equal(bh.activateRite(st, { weapon: 'Dagger', rite: 'Flame', level: 1, intMod: 3 }).reason, 'level_too_low');
// Rite Focus (5th): self-damage reduced by Int mod, min 1 damage.
r = bh.activateRite(bh.defaultBloodHunterState(), { weapon: 'Rapier', rite: 'Frozen', level: 5, intMod: 3 });
assert.equal(r.selfDamageDie, '1d6'); assert.equal(r.selfDamageReduction, 3);
r = bh.activateRite(bh.defaultBloodHunterState(), { weapon: 'Rapier', rite: 'Frozen', level: 5, intMod: -1 });
assert.equal(r.selfDamageReduction, 0); // never a negative reduction
// Ending a rite.
r = bh.endRite(st, { weapon: 'Longsword' });
assert.equal(r.success, true); assert.equal(r.state.activeRites.length, 1);
assert.equal(bh.endRite(r.state, { weapon: 'Longsword' }).reason, 'no_active_rite');

// --- Blood Maledict: lazy init, Ghostslayer bonus, depletion ---
st = bh.defaultBloodHunterState();
r = bh.useBloodMaledict(st, { level: 6, subclass: 'Ghostslayer' });
assert.equal(r.success, true); assert.equal(r.usesLeft, 2); // max 3 (2 + Ghostslayer)
st = r.state;
r = bh.useBloodMaledict(st, { level: 6, subclass: 'Ghostslayer' });
assert.equal(r.usesLeft, 1);
st = bh.useBloodMaledict(r.state, { level: 6, subclass: 'Ghostslayer' }).state;
assert.equal(st.maledictUsesLeft, 0);
r = bh.useBloodMaledict(st, { level: 6, subclass: 'Ghostslayer' });
assert.equal(r.success, false); assert.equal(r.reason, 'no_uses_left');
assert.equal(r.state.maledictUsesLeft, 0);
st = bh.defaultBloodHunterState();
r = bh.useBloodMaledict(st, { level: 1 });
assert.equal(r.success, true); assert.equal(r.usesLeft, 0); // max 1 at 1st

// --- Mutagens: concoct cap + prerequisites, consume, flush ---
st = bh.defaultBloodHunterState();
assert.equal(bh.concoctMutagen(st, { formula: 'Aether', level: 3 }).reason, 'formula_prerequisite_not_met');
assert.equal(bh.concoctMutagen(st, { formula: 'Foo', level: 11 }).reason, 'unknown_formula');
assert.equal(bh.concoctMutagen(st, { formula: 'Vermillion', level: 2 }).reason, 'level_too_low');
r = bh.concoctMutagen(st, { formula: 'vermillion', level: 3 }); // case-insensitive, stored canonical
assert.equal(r.success, true); assert.deepEqual(r.state.mutagensConcocted, ['Vermillion']);
assert.equal(r.concocted, 1); assert.equal(r.cap, 1);
assert.equal(bh.concoctMutagen(r.state, { formula: 'Embers', level: 3 }).reason, 'mutagen_cap_reached');
st = bh.concoctMutagen(bh.defaultBloodHunterState(), { formula: 'Aether', level: 11 }).state;
assert.deepEqual(st.mutagensConcocted, ['Aether']); // prerequisite met at 11th
st = bh.concoctMutagen(st, { formula: 'Reconstruction', level: 11 }).state;
assert.equal(st.mutagensConcocted.length, 2); // cap 2 at 11th
assert.equal(bh.consumeMutagen(st, { formula: 'Embers' }).reason, 'mutagen_not_concocted');
r = bh.consumeMutagen(st, { formula: 'Aether' });
assert.equal(r.success, true);
assert.deepEqual(r.state.mutagensConcocted, ['Reconstruction']);
assert.deepEqual(r.active, ['Aether']); // consumeMutagen returns the active list on the result, not on state
assert.deepEqual(r.state.mutagensActive, ['Aether']);
r = bh.flushMutagens(r.state);
assert.equal(r.success, true); assert.equal(r.flushed, 1);
assert.deepEqual(r.state.mutagensActive, []);
assert.equal(bh.flushMutagens(r.state).flushed, 0);

// --- Once-per-rest features ---
st = bh.defaultBloodHunterState();
assert.equal(bh.useHybridTransformation(st, { level: 2 }).reason, 'level_too_low');
r = bh.useHybridTransformation(st, { level: 3 });
assert.equal(r.success, true); assert.equal(r.usesLeft, 0);
assert.equal(bh.useHybridTransformation(r.state, { level: 3 }).reason, 'no_uses_left');
r = bh.useHybridTransformation(bh.defaultBloodHunterState(), { level: 11 });
assert.equal(r.success, true); assert.equal(r.usesLeft, 1); // max 2 at 11th
r = bh.useHybridTransformation(bh.defaultBloodHunterState(), { level: 18 });
assert.equal(r.success, true); assert.equal(r.usesLeft, null); // unlimited at 18th
assert.equal(r.state.hybridUsesMax, null); assert.equal(r.state.hybridUsesLeft, null);
assert.equal(bh.useHybridTransformation(r.state, { level: 18 }).success, true); // still unlimited

assert.equal(bh.useAetherWalk(st, { level: 6 }).reason, 'level_too_low');
r = bh.useAetherWalk(st, { level: 7 });
assert.equal(r.success, true); assert.equal(r.usesLeft, 0);
assert.equal(bh.useAetherWalk(r.state, { level: 7 }).reason, 'no_uses_left');
r = bh.useAetherWalk(bh.defaultBloodHunterState(), { level: 15 });
assert.equal(r.success, true); assert.equal(r.usesLeft, 1); // twice between rests at 15th

assert.equal(bh.useRiteRevival(st, { level: 17 }).reason, 'level_too_low');
assert.equal(bh.useRiteRevival(st, { level: 18 }).reason, 'no_active_rite');
st = bh.activateRite(bh.defaultBloodHunterState(), { weapon: 'Longsword', rite: 'Flame', level: 18, intMod: 3 }).state;
r = bh.useRiteRevival(st, { level: 18 });
assert.equal(r.success, true); assert.equal(r.ritesEnded, 1);
assert.deepEqual(r.state.activeRites, []); assert.equal(r.state.riteRevivalUsed, true);
assert.equal(bh.useRiteRevival(r.state, { level: 18 }).reason, 'already_used_this_rest');

assert.equal(bh.useStrangeMetabolism(st, { level: 6 }).reason, 'level_too_low');
r = bh.useStrangeMetabolism(st, { level: 7 });
assert.equal(r.success, true);
assert.equal(bh.useStrangeMetabolism(r.state, { level: 7 }).reason, 'already_used_this_rest');

assert.equal(bh.useExaltedMutation(st, { level: 17, intMod: 3, fromFormula: 'Vermillion', toFormula: 'Embers' }).reason, 'level_too_low');
st = bh.defaultBloodHunterState();
st = bh.concoctMutagen(st, { formula: 'Vermillion', level: 18 }).state;
st = bh.consumeMutagen(st, { formula: 'Vermillion' }).state;
assert.equal(bh.useExaltedMutation(st, { level: 18, intMod: 3, fromFormula: 'Embers', toFormula: 'Potency' }).reason, 'mutagen_not_active');
assert.equal(bh.useExaltedMutation(st, { level: 18, intMod: 3, fromFormula: 'Vermillion', toFormula: 'Foo' }).reason, 'unknown_formula');
assert.equal(bh.useExaltedMutation(st, { level: 18, intMod: 3, fromFormula: 'Vermillion', toFormula: 'Vermillion' }).reason, 'same_mutagen');
r = bh.useExaltedMutation(st, { level: 18, intMod: 3, fromFormula: 'Vermillion', toFormula: 'Embers' });
assert.equal(r.success, true); assert.equal(r.usesLeft, 2); // Int mod 3 max
assert.deepEqual(r.state.mutagensActive, ['Embers']);

assert.equal(bh.amplifySoulEater(st, { level: 17 }).reason, 'level_too_low');
r = bh.amplifySoulEater(st, { level: 18 });
assert.equal(r.success, true);
assert.equal(bh.amplifySoulEater(r.state, { level: 18 }).reason, 'already_used_this_rest');

// --- Pure rests: both clear rites + mutagens and refill Maledict/Hybrid/Aether;
// long rest only clears the long-rest flags and refills Exalted Mutation.
const spent = {
  ...bh.defaultBloodHunterState(),
  activeRites: [{ weapon: 'Longsword', rite: 'Flame', damageType: 'Fire' }],
  maledictUsesLeft: 0, maledictUsesMax: 5,
  mutagensConcocted: ['Embers'], mutagensActive: ['Vermillion'],
  hybridUsesLeft: 0, hybridUsesMax: 2,
  aetherWalkUsesLeft: 0, aetherWalkUsesMax: 2,
  riteRevivalUsed: true, strangeMetabolismUsed: true,
  exaltedMutationUsesLeft: 0, exaltedMutationUsesMax: 3,
  soulEaterAmplifyUsed: true,
};
r = bh.onLongRest(spent, { level: 18, subclass: 'Order of the Ghostslayer', intMod: 3 });
assert.deepEqual(r.state.activeRites, []);
assert.equal(r.state.maledictUsesMax, 5); assert.equal(r.state.maledictUsesLeft, 5);
// Post-rest Vermillion rule: the active mutagen's effects end at the rest,
// so its +1 Maledict use does NOT survive it (4 base + Ghostslayer 1 = 5).
assert.deepEqual(r.state.mutagensConcocted, []); assert.deepEqual(r.state.mutagensActive, []);
assert.equal(r.state.hybridUsesMax, null); assert.equal(r.state.hybridUsesLeft, null); // unlimited at 18th
assert.equal(r.state.aetherWalkUsesMax, 2); assert.equal(r.state.aetherWalkUsesLeft, 2);
assert.equal(r.state.riteRevivalUsed, false); assert.equal(r.state.strangeMetabolismUsed, false);
assert.equal(r.state.exaltedMutationUsesMax, 3); assert.equal(r.state.exaltedMutationUsesLeft, 3);
assert.equal(r.state.soulEaterAmplifyUsed, false);
r = bh.onShortRest(spent, { level: 18, subclass: 'Order of the Ghostslayer', intMod: 3 });
assert.deepEqual(r.state.activeRites, []);
assert.equal(r.state.maledictUsesLeft, 5); // Maledict refills on a short rest too
assert.deepEqual(r.state.mutagensConcocted, []); assert.deepEqual(r.state.mutagensActive, []);
assert.equal(r.state.aetherWalkUsesLeft, 2);
assert.equal(r.state.riteRevivalUsed, true); // long-rest flags survive a short rest
assert.equal(r.state.strangeMetabolismUsed, true);
assert.equal(r.state.exaltedMutationUsesLeft, 0); // Exalted Mutation does NOT refill
assert.equal(r.state.soulEaterAmplifyUsed, true);
// Short rest at 6th: Maledict 3/3 for a Ghostslayer (2 base + 1).
r = bh.onShortRest(bh.defaultBloodHunterState(), { level: 6, subclass: 'Ghostslayer', intMod: 3 });
assert.equal(r.state.maledictUsesMax, 3); assert.equal(r.state.maledictUsesLeft, 3);
assert.equal(r.state.hybridUsesMax, 1); assert.equal(r.state.hybridUsesLeft, 1);
assert.equal(r.state.aetherWalkUsesMax, 0); assert.equal(r.state.aetherWalkUsesLeft, 0);

// --- DM prompt section: never crashes on empty state, level-gated lines ---
let txt = bh.bloodHunterPromptSection(null, { level: 1, intMod: 2 });
assert.ok(txt.includes('Blood Hunter (level 1, Int mod 2, Hemocraft die 1d4)'));
assert.ok(txt.includes('Blood Maledict uses left: 1/1'));
assert.ok(!txt.includes('Aether Walk'));
assert.ok(!txt.includes('Rite Revival'));
txt = bh.bloodHunterPromptSection(null, { level: 6, intMod: 3, name: 'Bram', subclass: 'Order of the Ghostslayer' });
assert.ok(txt.includes('Blood Hunter Bram (level 6, Int mod 3, Hemocraft die 1d6)'));
assert.ok(txt.includes('Blood Maledict uses left: 3/3')); // Ghostslayer +1
assert.ok(!txt.includes('Aether Walk'));
txt = bh.bloodHunterPromptSection(
  { ...bh.defaultBloodHunterState(), activeRites: [{ weapon: 'Longsword', rite: 'Flame', damageType: 'Fire' }], mutagensActive: ['Vermillion'] },
  { level: 6, intMod: 3, subclass: 'Ghostslayer' },
);
assert.ok(txt.includes('Longsword: Flame (Fire)'));
assert.ok(txt.includes('Blood Maledict uses left: 4/4')); // Vermillion +1 while active
txt = bh.bloodHunterPromptSection(null, { level: 18, intMod: 4 });
assert.ok(txt.includes('Aether Walk uses left: 2/2'));
assert.ok(txt.includes('Rite Revival: available'));
assert.ok(txt.includes('Exalted Mutation uses left: 4/4'));
assert.ok(txt.includes('Soul Eater amplify: available'));
assert.ok(txt.includes('Strange Metabolism: available'));
// After a rest the 18th-level Hybrid pool is stored as null = unlimited.
const rested18 = bh.onLongRest(bh.defaultBloodHunterState(), { level: 18, intMod: 4 }).state;
txt = bh.bloodHunterPromptSection(rested18, { level: 18, intMod: 4 });
assert.ok(txt.includes('Hybrid Transformation uses left: unlimited (unlimited at 18th)'));

// --- DB load/save with an injected fake client (no real DB needed) ---
{
  const store = new Map();
  const fake = {
    dbGet: async (sql, params) => {
      const row = store.get(params[0]);
      return row ? { class_resources_json: row } : null;
    },
    dbRun: async (sql, params) => {
      store.set(params[1], params[0]);
      return { changes: 1 };
    },
  };
  let loaded = await bh.loadBloodHunterState('character', 1, fake);
  assert.deepEqual(loaded, bh.defaultBloodHunterState()); // no row -> default
  const toSave = { ...bh.defaultBloodHunterState(), maledictUsesLeft: 2, maledictUsesMax: 3, cursesKnown: ['Blood Curse of the Exorcist'] };
  assert.equal(await bh.saveBloodHunterState('character', 1, toSave, fake), true);
  loaded = await bh.loadBloodHunterState('character', 1, fake);
  assert.equal(loaded.maledictUsesLeft, 2);
  assert.deepEqual(loaded.cursesKnown, ['Blood Curse of the Exorcist']);
  // Sibling keys in the blob survive the save (own full parse, never parseClassResources).
  store.set(1, JSON.stringify({ used: { second_wind: 1 }, artificer: { attunedExternal: ['Cloak'] } }));
  assert.equal(await bh.saveBloodHunterState('character', 1, toSave, fake), true);
  const blob = JSON.parse(store.get(1));
  assert.deepEqual(blob.used, { second_wind: 1 });
  assert.deepEqual(blob.artificer, { attunedExternal: ['Cloak'] });
  assert.equal(blob.blood_hunter.maledictUsesLeft, 2);
  // Garbage JSON in the blob degrades to default, never throws.
  store.set(1, '{not json');
  loaded = await bh.loadBloodHunterState('character', 1, fake);
  assert.deepEqual(loaded, bh.defaultBloodHunterState());
  // Companion table is the other home.
  assert.equal(await bh.saveBloodHunterState('companion', 7, toSave, fake), true);
  loaded = await bh.loadBloodHunterState('companion', 7, fake);
  assert.equal(loaded.maledictUsesMax, 3);
}

// --- Group 11: DM rest through restTimeService (needs the repo DB) ---
// Throwaway-DB pattern from rest-time.test.js. In a mirror without
// database.js this group logs a loud skip and the pure groups above
// still stand; on the Mac it MUST run.
{
  let dbOk = true;
  let dbModule; let rt; let sched;
  let dbDir;
  try {
    dbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dnd-bh-rest-'));
    process.chdir(dbDir);
    delete process.env.TURSO_DATABASE_URL;
    delete process.env.TURSO_AUTH_TOKEN;
    dbModule = await import(svc('server/database.js'));
    rt = await import(svc('server/services/restTimeService.js'));
    sched = await import(svc('server/services/scheduleService.js'));
  } catch (e) {
    dbOk = false;
    console.log(`  (DB rest group skipped in this mirror: ${e.message})`);
  }
  if (dbOk) {
    const { initDatabase, dbGet, dbRun, dbAll } = dbModule;
    await initDatabase();
    async function insertRow(table, overrides = {}) {
      const info = await dbAll(`PRAGMA table_info(${table})`);
      const cols = []; const vals = [];
      for (const c of info) {
        if (c.name === 'id') continue;
        if (Object.prototype.hasOwnProperty.call(overrides, c.name)) {
          cols.push(c.name); vals.push(overrides[c.name]); continue;
        }
        if (c.notnull && c.dflt_value == null) {
          const t = (c.type || '').toUpperCase();
          cols.push(c.name); vals.push(t.includes('INT') ? 1 : `TEST_${c.name}`);
        }
      }
      const res = await dbRun(`INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`, vals);
      return Number(res.lastInsertRowid);
    }
    const fbRow = await dbGet('SELECT id FROM world_clock WHERE campaign_id IS NULL ORDER BY id LIMIT 1');
    if (!fbRow) {
      await dbRun('INSERT INTO world_clock (campaign_id, current_day, current_day_of_year, current_year, current_hour) VALUES (NULL, 1, 1, 1492, 8)');
    }
    const startClock = await sched.getClock(null);
    const spentBlob = (over = {}) => JSON.stringify({
      blood_hunter: {
        ...bh.defaultBloodHunterState(),
        activeRites: [{ weapon: 'Longsword', rite: 'Flame', damageType: 'Fire' }],
        maledictUsesLeft: 0, maledictUsesMax: 3,
        mutagensConcocted: ['Embers'], mutagensActive: ['Vermillion'],
        hybridUsesLeft: 0, hybridUsesMax: 1,
        aetherWalkUsesLeft: 0, aetherWalkUsesMax: 0,
        riteRevivalUsed: true, strangeMetabolismUsed: true,
        exaltedMutationUsesLeft: 0, exaltedMutationUsesMax: 3,
        soulEaterAmplifyUsed: true,
        ...over,
      },
    });
    const pcId = await insertRow('characters', {
      name: 'Bram', class: 'blood_hunter', subclass: 'Order of the Ghostslayer', level: 6,
      ability_scores: JSON.stringify({ str: 14, dex: 12, con: 14, int: 16, wis: 10, cha: 8 }),
      current_hp: 20, max_hp: 30,
      hit_dice: JSON.stringify({ d10: 6 }), hit_dice_used: '{}',
      spell_slots_used: '{}', class_resources_json: spentBlob(),
    });
    const sessionId = await insertRow('dm_sessions', {
      character_id: pcId, game_start_day: startClock.dayOfYear, game_start_year: startClock.year,
    });
    // Long rest through the DM path: everything refills / clears.
    const longR = await rt.applyRest({ sessionId, characterId: pcId, type: 'long' });
    assert.equal(longR.success, true);
    let blob = JSON.parse((await dbGet('SELECT class_resources_json FROM characters WHERE id = ?', [pcId])).class_resources_json).blood_hunter;
    assert.deepEqual(blob.activeRites, []);
    assert.equal(blob.maledictUsesLeft, 3); assert.equal(blob.maledictUsesMax, 3); // Ghostslayer 6th; Vermillion +1 does NOT survive the rest
    assert.deepEqual(blob.mutagensConcocted, []); assert.deepEqual(blob.mutagensActive, []);
    assert.equal(blob.hybridUsesLeft, 1);
    assert.equal(blob.aetherWalkUsesLeft, 0); // Aether Walk starts at 7th
    assert.equal(blob.riteRevivalUsed, false); assert.equal(blob.strangeMetabolismUsed, false);
    assert.equal(blob.exaltedMutationUsesLeft, 3);
    assert.equal(blob.soulEaterAmplifyUsed, false);
    // Short rest: Maledict/rites/mutagens reset, long-rest flags do NOT.
    await dbRun('UPDATE characters SET class_resources_json = ? WHERE id = ?', [spentBlob(), pcId]);
    const shortR = await rt.applyRest({ sessionId, characterId: pcId, type: 'short' });
    assert.equal(shortR.success, true);
    blob = JSON.parse((await dbGet('SELECT class_resources_json FROM characters WHERE id = ?', [pcId])).class_resources_json).blood_hunter;
    assert.equal(blob.maledictUsesLeft, 3);
    assert.deepEqual(blob.activeRites, []);
    assert.deepEqual(blob.mutagensConcocted, []); assert.deepEqual(blob.mutagensActive, []);
    assert.equal(blob.hybridUsesLeft, 1);
    assert.equal(blob.riteRevivalUsed, true); // long-rest-only flag survives a short rest
    assert.equal(blob.strangeMetabolismUsed, true);
    assert.equal(blob.exaltedMutationUsesLeft, 0); // Exalted Mutation does NOT refill
    assert.equal(blob.soulEaterAmplifyUsed, true);
  }
}

console.log('newclass-blood-hunter: all assertions passed');
