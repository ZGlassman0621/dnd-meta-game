// tests/newclass-magus.test.js — Magus (Sterling Vermin, 2014-era).
// Honest-integration rules: every assertion below calls the REAL
// magusService.js / merged levelProgression.js / magus.js
// subclass file. Nothing here re-implements service logic; deleting
// the service file makes this suite fail at import, by design.
// Coverage: slot table, cantrips/spells known, Mystic Mark uses,
// Mystic Meditation short-rest recovery, Spell Surge + Greater
// Spell Surge recovery, and the empty 5th/17th class-table rows.
// What this does NOT cover (honest scope): DB load/save (the
// mirror has no database.js — load/save here run against the JSON
// blob only), marker handlers (not registered in this mirror —
// see magusService.js header), restTimeService/dmPromptBuilder
// wiring (coordinator merge items), or society spell-list
// validation (another agent's data file, not yet delivered).
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');
const svc = (rel) => pathToFileURL(path.join(REPO, rel)).href;

const magus = await import(svc('server/services/magusService.js'));
const F = await import(svc('server/config/levelProgression.js'));
const SUBCLASS_SERVICE = await import(svc('server/services/subclassService.js'));
const { MAGUS_SUBCLASSES } = await import(svc('server/data/subclasses/magus.js'));
const clientClasses = JSON.parse(fs.readFileSync(path.join(REPO, 'client/src/data/classes.json'), 'utf8'));

// --- Slot table (digest, verbatim) ---
assert.deepEqual(magus.spellSlotsForLevel(1), {});
assert.deepEqual(magus.spellSlotsForLevel(2), { 1: 2 });
assert.deepEqual(magus.spellSlotsForLevel(5), { 1: 4, 2: 2 });
assert.deepEqual(magus.spellSlotsForLevel(9), { 1: 4, 2: 3, 3: 2 });
assert.deepEqual(magus.spellSlotsForLevel(17), { 1: 4, 2: 3, 3: 3, 4: 3, 5: 1 });
assert.deepEqual(magus.spellSlotsForLevel(20), { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2 });
// No 6th-level slot exists at any level — 6th-level casting is
// Greater Spell Surge only.
for (let l = 1; l <= 20; l++) assert.ok(!(magus.spellSlotsForLevel(l)[6]), `level ${l} must have no 6th-level slot`);
// Merged slot table matches the service table exactly.
assert.deepEqual(F.MAGUS_SPELL_SLOTS, magus.MAGUS_SPELL_SLOTS);
assert.deepEqual(F.getSpellSlots('magus', 17), { 1: 4, 2: 3, 3: 3, 4: 3, 5: 1 });

// --- Cantrips / spells known ---
assert.equal(magus.cantripsKnownForLevel(1), 2);
assert.equal(magus.cantripsKnownForLevel(4), 3);
assert.equal(magus.cantripsKnownForLevel(10), 4);
assert.equal(magus.cantripsKnownForLevel(20), 4);
assert.equal(magus.spellsKnownForLevel(2), 3);
assert.equal(magus.spellsKnownForLevel(5), 5);
assert.equal(magus.spellsKnownForLevel(13), 11);
assert.equal(magus.spellsKnownForLevel(20), 16);
assert.deepEqual(F.CANTRIPS_KNOWN.magus, magus.MAGUS_CANTRIPS_KNOWN);
assert.deepEqual(F.SPELLS_KNOWN.magus, magus.MAGUS_SPELLS_KNOWN);

// --- Mystic Mark uses = spellcasting modifier / long rest ---
assert.equal(magus.mysticMarkUsesMax(3), 3);
assert.equal(magus.mysticMarkUsesMax(4), 4);
assert.equal(magus.esotericEyeUsesMax(3), 4); // 1 + modifier
assert.equal(magus.aegisEnspellBonus(2), 1);
assert.equal(magus.aegisEnspellBonus(9), 2);
assert.equal(magus.aegisEnspellBonus(13), 3);
assert.equal(magus.aegisEnspellBonus(20), 3);

// Spend + Mystic Meditation (short rest) + long rest cycle.
let st = magus.defaultMagusState();
let r = magus.onLongRest(st, { level: 6, spellMod: 3 });
assert.equal(r.state.mysticMarkUsesLeft, 3);
assert.equal(r.state.esotericEyeUsesLeft, 4);
st = r.state;
r = magus.spendMysticMark(st, 3, 6);
assert.equal(r.success, true); assert.equal(r.state.mysticMarkUsesLeft, 2);
st = r.state;
r = magus.onShortRest(st, { level: 6, spellMod: 3 });
assert.equal(r.success, true); assert.equal(r.mysticMarksRecovered, true);
assert.equal(r.state.mysticMarkUsesLeft, 3);
assert.equal(r.state.mysticMeditationUsed, true);
st = r.state;
// Second short rest before a long rest does NOT recover again.
r = magus.onShortRest(st, { level: 6, spellMod: 3 });
assert.equal(r.mysticMarksRecovered, false);
// Long rest refills everything and re-arms Meditation.
r = magus.onLongRest(st, { level: 6, spellMod: 3 });
assert.equal(r.state.mysticMarkUsesLeft, 3);
assert.equal(r.state.mysticMeditationUsed, false);
// Exhausted pool refuses a spend.
st = magus.onLongRest(magus.defaultMagusState(), { level: 6, spellMod: 1 }).state;
st = magus.spendMysticMark(st, 1, 6).state;
r = magus.spendMysticMark(st, 1, 6);
assert.equal(r.success, false); assert.equal(r.reason, 'no_mystic_mark_uses_left');

// --- Spell Surge / Greater Spell Surge recovery ---
assert.equal(magus.spellSurgeUsesMax(10), 1);
assert.equal(magus.spellSurgeUsesMax(19), 1);
assert.equal(magus.spellSurgeUsesMax(20), 2);
assert.equal(magus.greaterSpellSurgeUsesMax(20), 2);
st = magus.onLongRest(magus.defaultMagusState(), { level: 20, spellMod: 4 }).state;
assert.equal(st.spellSurgeUsesLeft, 2);
assert.equal(st.greaterSpellSurgeUsesLeft, 2);
r = magus.useSpellSurge(st, 20);
assert.equal(r.success, true); assert.equal(r.castAsSlotLevel, 5);
assert.equal(r.state.spellSurgeUsesLeft, 1);
// Greater Surge refuses before a spell is chosen.
r = magus.useGreaterSpellSurge(st, 20);
assert.equal(r.success, false); assert.equal(r.reason, 'greater_spell_surge_spell_not_chosen');
st = magus.setGreaterSpellSurgeSpell(st, 'Chain Lightning').state;
r = magus.useGreaterSpellSurge(st, 20);
assert.equal(r.success, true); assert.equal(r.spell, 'Chain Lightning');
assert.equal(r.state.greaterSpellSurgeUsesLeft, 1);
// Below-level guards.
assert.equal(magus.useSpellSurge(magus.defaultMagusState(), 9).reason, 'level_too_low');
assert.equal(magus.useGreaterSpellSurge(magus.defaultMagusState(), 17).reason, 'level_too_low');

// --- Empty 5th/17th rows, as printed ---
// (2026-11-05 gate fix: these read the merged live levelProgression.js — the
// overnight version read the staging fragment by a VM-only absolute path.)
assert.deepEqual(F.CLASS_FEATURES.magus[5], []);
assert.deepEqual(F.CLASS_FEATURES.magus[17], []);
assert.equal(F.SUBCLASS_LEVELS.magus, 1);
assert.equal(F.HIT_DICE.magus, 8);
assert.equal(F.CASTER_TYPE.magus, 'magus'); // NEW type, merged as its own caster branch

// --- Societies: ability map, focus, multiclass ---
assert.equal(magus.spellcastingAbilityForSociety('arcane_order'), 'int');
assert.equal(magus.spellcastingAbilityForSociety('sylvan_circle'), 'wis');
assert.equal(magus.spellcastingAbilityForSociety('knights_stygian'), 'cha');
assert.equal(magus.SOCIETY_FOCUS.primordial_seal, null); // UNRESOLVED, not invented
// (2026-11-08: multiclass prerequisites removed — Zach: all classes
// multiclass freely. The per-society check function and the ability
// map are deleted with the table; the Sidereal Con 13 + Int 13
// adoption is moot by the same rule, not by a ruling. The casting
// ability per society — SOCIETY_SPELLCASTING_ABILITY, asserted just
// above — is a different thing and it stays.)
assert.equal(magus.meetsMagusMulticlassRequirements, undefined);
assert.equal(magus.SOCIETY_MULTICLASS_ABILITY, undefined);
assert.deepEqual(magus.MULTICLASS_GRANT, { hitDie: 8, armor: ['light', 'medium', 'shields'], weapons: ['simple', 'martial'] });

// --- Subclass registry: 6 societies, features at 1/3/7/14 only ---
assert.equal(MAGUS_SUBCLASSES.length, 6);
for (const entry of MAGUS_SUBCLASSES) {
  assert.equal(entry.class, 'magus');
  // Item 29: no per-entry selectionLevel in the data file — the
  // server derives it from SUBCLASS_LEVELS (magus 1).
  assert.ok(!('selectionLevel' in entry));
  assert.equal(entry.gateCheckRequired, true);
  assert.deepEqual(entry.features.map((f) => f.level), [1, 3, 7, 14]);
  for (const f of entry.features) assert.equal(f.gateCheck, true);
}
assert.ok(SUBCLASS_SERVICE.listSubclasses('magus').every((e) => e.selectionLevel === 1));
assert.equal(MAGUS_SUBCLASSES.find((e) => e.key === 'primordial_seal').features[0].mechanics.focus, null);

// --- Namespaced state parse (own parse, never parseClassResources) ---
const blob = JSON.stringify({ used: {}, magus: { society: 'shadow_court', mysticMarkUsesLeft: 2 } });
assert.equal(magus.loadMagusState(blob).society, 'shadow_court');
assert.equal(magus.loadMagusState(blob).mysticMarkUsesLeft, 2);
const saved = magus.saveMagusState(blob, { ...magus.defaultMagusState(), society: 'sylvan_circle' });
assert.equal(saved.magus.society, 'sylvan_circle');
assert.deepEqual(saved.used, {}); // unrelated keys survive

// --- Merged client classes.json sanity ---
assert.ok(clientClasses.magus.spellcasting, 'merged classes.json magus entry must carry a spellcasting block');
assert.equal(clientClasses.magus.hitDie, 8);
assert.equal(clientClasses.magus.subclasses.length, 6);
assert.equal(clientClasses.magus.spellcastingFocusBySociety.primordial_seal, null);

console.log('newclass-magus: all assertions passed');
