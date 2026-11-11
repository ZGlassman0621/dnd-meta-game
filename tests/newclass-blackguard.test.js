// tests/newclass-blackguard.test.js — Blackguard (digest-only build).
//
// Honest-integration rules: every assertion calls the REAL blackguardService /
// merged levelProgression / subclass-file exports — never a re-implementation. If the service
// file is deleted, the static import below fails and the suite fails. Expected
// values are literals taken from digests/blackguard.md.
// What this does NOT test: DB load/save against a live database (database.js is
// absent from this mirror), cast-time slot spending (spellCastService path), or
// the interleaved Vice feature detail (digest UNRESOLVED 3 — re-read from the
// PDF before build) and the Domination/Fury Channel Divinity mapping
// (the SPELL mapping was resolved 2026-11-06, item 25: Conquest/
// Vengeance lists at oath tiers; Channel Divinity still UNRESOLVED).
import assert from 'node:assert';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  preparedSpellsMax, validatePreparedSpells, unholyVigorTempHp,
  dreadSmiteDiceCount, dreadSmiteDice, improvedDreadSmiteDice,
  spellSlotsForLevel, vileTouchUsesMax, auraOfHateBonus, auraOfHateRange,
  validateNoPaladinBlackguardOverlap, hasPaladinAndBlackguard, darkBlessingStatus,
  defaultBlackguardState, useUnholyVigor, useChannelDivinity, useVileTouch,
  onLongRest, onShortRest, dreadSmiteTypeForVice,
  registerBlackguardMarkers, loadBlackguardState,
} from '../server/services/blackguardService.js';
import { BLACKGUARD_SUBCLASSES } from '../server/data/subclasses/blackguard.js';

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

// --- Prepared-count formula (Cha mod + half level, min 1; vice spells excluded) ---
// L1 RECONCILIATION (2026-11-06): preparedSpellsMax(0, 1) is 0, NOT 1 — the
// service was the outlier. Blackguard has no 1st-level spell slots, and the
// printed rule prepares spells "of a level you have slots for", so L1
// prepares 0, agreeing with levelProgression.getSpellsPrepared (zero-slot
// override), GET /api/spells, and the Stage 4 creator validator. The
// Cha-mod + half-level formula (min 1) is unchanged at every level WITH slots.
await check('preparedSpellsMax: cha3/lvl5->5, cha0/lvl1->0 (no L1 slots), cha-1/lvl4->1, cha4/lvl20->14', () => {
  assert.equal(preparedSpellsMax(3, 5), 5);
  assert.equal(preparedSpellsMax(0, 1), 0);
  assert.equal(preparedSpellsMax(-1, 4), 1);
  assert.equal(preparedSpellsMax(4, 20), 14);
});
await check('validatePreparedSpells at L1: max 0 — a 1-spell list refuses, empty passes', () => {
  const over = validatePreparedSpells(3, 1, ['hex'], []);
  assert.equal(over.max, 0); assert.equal(over.ok, false); assert.equal(over.over, 1);
  const empty = validatePreparedSpells(3, 1, [], []);
  assert.equal(empty.max, 0); assert.equal(empty.ok, true);
});
await check('validatePreparedSpells does not count always-prepared vice spells', () => {
  const ok = validatePreparedSpells(3, 5, ['bane', 'inflict wounds', 'hex', 'command', 'shield of faith', 'wrathful smite', 'cause fear'], ['bane', 'inflict wounds']);
  assert.equal(ok.max, 5); assert.equal(ok.counted, 5); assert.equal(ok.ok, true);
  const over = validatePreparedSpells(3, 5, ['bane', 'hex', 'command', 'shield of faith', 'wrathful smite', 'cause fear', 'charm person'], ['bane']);
  assert.equal(over.ok, false); assert.equal(over.over, 1);
});

// --- Unholy Vigor (Cha mod + level temp HP, 1/short-or-long rest) ---
await check('unholyVigorTempHp: cha3/lvl5->8, cha0/lvl1->1', () => {
  assert.equal(unholyVigorTempHp(3, 5), 8);
  assert.equal(unholyVigorTempHp(0, 1), 1);
});
await check('useUnholyVigor once per rest; short rest refreshes it, as does long rest', () => {
  let r = useUnholyVigor(defaultBlackguardState());
  assert.equal(r.success, true);
  assert.equal(useUnholyVigor(r.state).success, false);
  assert.equal(onShortRest(r.state).state.unholyVigorUsed, false);
  assert.equal(onLongRest(useUnholyVigor(defaultBlackguardState()).state, { chaMod: 3, level: 5 }).state.unholyVigorUsed, false);
});
await check('useChannelDivinity once per rest; short rest refreshes it', () => {
  const used = useChannelDivinity(defaultBlackguardState()).state;
  assert.equal(useChannelDivinity(used).success, false);
  assert.equal(onShortRest(used).state.channelDivinityUsed, false);
});

// --- Dread Smite dice ---
await check('dreadSmiteDice: slot1->2d8, slot3->4d8, slot5->5d8, slot5 vs celestial->6d8', () => {
  assert.equal(dreadSmiteDice(1), '2d8');
  assert.equal(dreadSmiteDice(3), '4d8');
  assert.equal(dreadSmiteDice(5), '5d8');
  assert.equal(dreadSmiteDice(5, { vsCelestial: true }), '6d8');
  assert.equal(dreadSmiteDiceCount(2, { vsCelestial: true }), 4);
});
await check('improvedDreadSmiteDice: 10->0, 11->1d8', () => {
  assert.equal(improvedDreadSmiteDice(10), '0');
  assert.equal(improvedDreadSmiteDice(11), '1d8');
});
await check('dreadSmiteTypeForVice: Despair cold, Domination psychic, Fury thunder, Pride radiant, Treachery poison, none necrotic', () => {
  assert.equal(dreadSmiteTypeForVice('Despair'), 'cold');
  assert.equal(dreadSmiteTypeForVice('Domination'), 'psychic');
  assert.equal(dreadSmiteTypeForVice('Fury'), 'thunder');
  assert.equal(dreadSmiteTypeForVice('Pride'), 'radiant');
  assert.equal(dreadSmiteTypeForVice('Treachery'), 'poison');
  assert.equal(dreadSmiteTypeForVice(null), 'necrotic');
});

// --- Slots, Vile Touch, Aura of Hate ---
await check('spellSlotsForLevel: 1->{}, 2->{1:2}, 17->{1:4,2:3,3:3,4:3,5:1}', () => {
  assert.deepEqual(spellSlotsForLevel(1), {});
  assert.deepEqual(spellSlotsForLevel(2), { 1: 2 });
  assert.deepEqual(spellSlotsForLevel(17), { 1: 4, 2: 3, 3: 3, 4: 3, 5: 1 });
});
await check('vileTouchUsesMax: 13->0, 14/cha2->2, 14/cha0->1 (min 1)', () => {
  assert.equal(vileTouchUsesMax(2, 13), 0);
  assert.equal(vileTouchUsesMax(2, 14), 2);
  assert.equal(vileTouchUsesMax(0, 14), 1);
  assert.equal(useVileTouch(defaultBlackguardState(), 2, 13).success, false);
});
await check('auraOfHate: 9->0, 10/cha3->3, 10/cha0->1 (min +1); range 10, 30 at 18', () => {
  assert.equal(auraOfHateBonus(3, 9), 0);
  assert.equal(auraOfHateBonus(3, 10), 3);
  assert.equal(auraOfHateBonus(0, 10), 1);
  assert.equal(auraOfHateRange(10), 10);
  assert.equal(auraOfHateRange(18), 30);
});

// --- Paladin mutual exclusion (the check, not a subclass) ---
await check('validateNoPaladinBlackguardOverlap: both -> fail; either alone -> ok; empty -> ok', () => {
  assert.equal(validateNoPaladinBlackguardOverlap([{ class: 'blackguard', level: 3 }, { class: 'paladin', level: 2 }]).ok, false);
  assert.equal(validateNoPaladinBlackguardOverlap([{ class: 'blackguard', level: 3 }]).ok, true);
  assert.equal(validateNoPaladinBlackguardOverlap([{ class: 'paladin', level: 3 }]).ok, true);
  assert.equal(validateNoPaladinBlackguardOverlap([]).ok, true);
  assert.equal(hasPaladinAndBlackguard(['Blackguard', 'Paladin']), true);
  assert.equal(hasPaladinAndBlackguard(['Blackguard', 'Fighter']), false);
});
await check('darkBlessingStatus: name/level only, text NOT located, never paladin text', () => {
  const s = darkBlessingStatus();
  assert.equal(s.name, 'Dark Blessing'); assert.equal(s.level, 6);
  assert.equal(s.textLocated, false); assert.equal(s.gateCheckRequired, true);
});

// --- Merged levelProgression + subclass-file consistency ---
// (2026-11-05 gate fix: the overnight test imported the staging fragment by an
// absolute VM path, which does not exist on the Mac. Same assertions, now against
// the merged live levelProgression.js — the fragment was only ever its source.)
await check('merged levelProgression: 20 levels, 9/13/17 empty as printed, hit die 10, caster half, multiclass free (no prerequisites — removed 2026-11-08)', () => {
  assert.equal(Object.keys(F.CLASS_FEATURES.blackguard).length, 20);
  assert.deepEqual(F.CLASS_FEATURES.blackguard[9], []);
  assert.deepEqual(F.CLASS_FEATURES.blackguard[13], []);
  assert.deepEqual(F.CLASS_FEATURES.blackguard[17], []);
  assert.equal(F.HIT_DICE.blackguard, 10);
  assert.equal(F.CASTER_TYPE.blackguard, 'half');
});
await check('subclass file: 5 Vices; Despair capstone key is despair_dread_lord, never bare dread_lord; no per-entry selectionLevel (server derives it)', () => {
  assert.equal(BLACKGUARD_SUBCLASSES.length, 5);
  assert.deepEqual(BLACKGUARD_SUBCLASSES.map((s) => s.key),
    ['despair', 'domination', 'fury', 'pride', 'treachery']);
  const allKeys = BLACKGUARD_SUBCLASSES.flatMap((s) => s.features.map((f) => f.key));
  assert.ok(allKeys.includes('despair_dread_lord'));
  assert.ok(!allKeys.includes('dread_lord'));
  assert.ok(BLACKGUARD_SUBCLASSES.every((s) => s.gateCheckRequired === true));
  // Item 29 (2026-11-06): the per-entry selectionLevel field was
  // removed by design — the server derives it from SUBCLASS_LEVELS
  // (the class record), so entries cannot drift again. The raw data
  // carries no selectionLevel; the derived value is 3 for every vice.
  assert.ok(BLACKGUARD_SUBCLASSES.every((s) => !('selectionLevel' in s)));
  assert.ok(SUBCLASS_SERVICE.listSubclasses('blackguard').every((s) => s.selectionLevel === 3));
});
await check('Domination/Fury: vice-spell lists resolved (item 25), Channel Divinity mapping still unresolved', () => {
  const dom = BLACKGUARD_SUBCLASSES.find((s) => s.key === 'domination');
  // Item 25 added the Vice Spells feature at index 0 (paladin
  // convention: spells feature first) — the oath-features entry is
  // found by key, not by position.
  const domVice = dom.features.find((f) => f.key === 'domination_vice_spells');
  assert.ok(domVice, 'domination carries a domination_vice_spells feature');
  assert.deepEqual(domVice.mechanics.alwaysPreparedByLevel[3], ['Armor of Agathys', 'Command']);
  const domOath = dom.features.find((f) => f.key === 'domination_oath_features');
  assert.ok(domOath.mechanics.mapping.includes('CHANNEL DIVINITY MAPPING STILL UNRESOLVED'));
  const fury = BLACKGUARD_SUBCLASSES.find((s) => s.key === 'fury');
  const furyVice = fury.features.find((f) => f.key === 'fury_vice_spells');
  assert.ok(furyVice, 'fury carries a fury_vice_spells feature');
  assert.deepEqual(furyVice.mechanics.alwaysPreparedByLevel[3], ['Bane', "Hunter's Mark"]);
  const furyOath = fury.features.find((f) => f.key === 'fury_oath_features');
  assert.ok(furyOath.mechanics.mapping.includes('CHANNEL DIVINITY MAPPING STILL UNRESOLVED'));
});

// --- Marker registration through a fake registrar ---
await check('registerBlackguardMarkers registers 3 markers; UNHOLY_VIGOR handler spends a real use', async () => {
  const handlers = {};
  const saved = {};
  registerBlackguardMarkers((name, fn) => { handlers[name] = fn; }, {
    resolveActor: async () => ({ kind: 'player', id: 1, name: 'Test', className: 'blackguard', level: 5, chaMod: 3 }),
    loadState: async () => defaultBlackguardState(),
    saveState: async (kind, id, state) => { saved.state = state; return true; },
  });
  assert.deepEqual(Object.keys(handlers).sort(),
    ['BLACKGUARD_CHANNEL_DIVINITY', 'BLACKGUARD_UNHOLY_VIGOR', 'BLACKGUARD_VILE_TOUCH']);
  const res = await handlers.BLACKGUARD_UNHOLY_VIGOR({}, { characterId: 1 });
  assert.equal(res.success, true);
  assert.equal(saved.state.unholyVigorUsed, true);
});
await check('loadBlackguardState degrades to default state without a live database.js', async () => {
  assert.deepEqual(await loadBlackguardState('player', 999), defaultBlackguardState());
});

const failed = results.filter(([, ok]) => !ok).length;
console.log(`=== Results: ${results.length - failed} passed, ${failed} failed ===`);
process.exit(failed ? 1 : 0);
