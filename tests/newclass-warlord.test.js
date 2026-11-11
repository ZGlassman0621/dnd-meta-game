// tests/newclass-warlord.test.js — Warlord (KibblesTasty v1.5).
// Honest-integration rules: every assertion below calls the REAL
// warlordService.js / subclassService.leadershipDice / warlord.js
// registry / levelProgression.js. Nothing here re-implements service
// logic; deleting the service file makes this suite fail at import.
// Coverage: Leadership Dice maxima (via the imported leadershipDice,
// never reimplemented), Bloody Victory maxima, base maneuvers, dice
// spend (pool + per-turn limit + Dreadlord Demoralization gain),
// Battlefield Grace regain, Demoralization spend, the once-per-rest
// features, Warlord of the Wilds list + Packleader picks, pure rest
// resets, the DM prompt section, DB load/save (injected fake client),
// and the registry match (Booming Shout 15th, Grand Decree 18th).
// Group 11 runs the DM rest through the REAL restTimeService.js on a
// throwaway DB (rest-time.test.js pattern); it needs the repo DB, so
// it is skipped with a loud note in a mirror that has no database.js
// — it MUST run in Zach's npm test.
// What this does NOT cover (honest scope): marker handlers (none in
// v1), dice-as-slot casting / Battlefield Presence / the 64 subclass
// features (registry + DM-prompt in v1), the DM prompt builder /
// companion prompt dispatch (the prompt section itself is asserted
// here; the dispatchers call it).
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');
const svc = (rel) => pathToFileURL(path.join(REPO, rel)).href;

const wl = await import(svc('server/services/warlordService.js'));
const { WARLORD_SUBCLASSES } = await import(svc('server/data/subclasses/warlord.js'));
const { SUBCLASS_LEVELS } = await import(svc('server/config/levelProgression.js'));

// --- Leadership Dice maxima come from subclassService.leadershipDice ---
assert.deepEqual(wl.leadershipDiceMax(1), { count: 0, die: 6, perTurnLimit: 0 });
assert.deepEqual(wl.leadershipDiceMax(2), { count: 2, die: 6, perTurnLimit: 1 });
assert.deepEqual(wl.leadershipDiceMax(6), { count: 6, die: 6, perTurnLimit: 2 });
assert.deepEqual(wl.leadershipDiceMax(9), { count: 9, die: 8, perTurnLimit: 2 });
assert.deepEqual(wl.leadershipDiceMax(11), { count: 11, die: 8, perTurnLimit: 3 });
assert.deepEqual(wl.leadershipDiceMax(13), { count: 13, die: 10, perTurnLimit: 3 });
assert.deepEqual(wl.leadershipDiceMax(17), { count: 17, die: 12, perTurnLimit: 4 });
// Noble (Destined Leader): +1 die at 3rd, 9th, 15th — cumulative.
assert.equal(wl.leadershipDiceMax(2, 'Noble').count, 2); // +1 starts at 3rd
assert.equal(wl.leadershipDiceMax(3, 'Noble').count, 4);
assert.equal(wl.leadershipDiceMax(9, 'Noble').count, 11);
assert.equal(wl.leadershipDiceMax(15, 'Noble').count, 18);
assert.equal(wl.leadershipDiceMax(15, 'Chieftain').count, 15); // no Noble bonus
assert.equal(wl.leadershipDiceMax(15, "Noble's Presence").count, 18); // registry-form name, apostrophe included

// Bloody Victory: Cha mod uses, 18th only, long rest only.
assert.equal(wl.bloodyVictoryUsesMax(3, 18), 3);
assert.equal(wl.bloodyVictoryUsesMax(0, 18), 0);
assert.equal(wl.bloodyVictoryUsesMax(-1, 18), 0);
assert.equal(wl.bloodyVictoryUsesMax(4, 17), 0);

// Base maneuvers: no registry entry exists, so the prompt section carries them.
assert.equal(Object.keys(wl.BASE_MANEUVERS).sort().join(','), 'helpfulWord,rallyingMark,urgentOrders');
assert.ok(wl.BASE_MANEUVERS.rallyingMark.includes('60 ft'));
assert.ok(wl.BASE_MANEUVERS.urgentOrders.includes('without provoking opportunity attacks'));
assert.ok(wl.BASE_MANEUVERS.helpfulWord.includes('30 ft'));

// --- Registry consistency: 8 Presences, 64 features, selection at 1st ---
assert.equal(WARLORD_SUBCLASSES.length, 8);
for (const key of ['commander', 'chieftain', 'noble', 'packleader', 'paragon', 'dreadlord']) {
  assert.ok(WARLORD_SUBCLASSES.some((e) => e.key === key), `warlord registry has ${key}`);
}
for (const entry of WARLORD_SUBCLASSES) {
  assert.equal(entry.class, 'warlord');
  assert.equal(entry.gateCheckRequired, true);
}
assert.equal(WARLORD_SUBCLASSES.reduce((n, e) => n + e.features.length, 0), 69); // design said 64 — the registry holds 69 (node-imported count)
assert.equal(SUBCLASS_LEVELS.warlord, 1);
// Design corrections, pinned against the registry (not the design file):
// Booming Shout is 15th (not 7th); Grand Decree is 18th.
const findFeature = (key) => {
  for (const e of WARLORD_SUBCLASSES) {
    const f = e.features.find((x) => x.key === key);
    if (f) return f;
  }
  return null;
};
assert.equal(findFeature('booming_shout').level, 15);
assert.equal(findFeature('bloody_victory').level, 18);
assert.equal(findFeature('grand_decree').level, 18);
assert.equal(findFeature('warlord_of_the_wilds').level, 18);
assert.equal(findFeature('stand_defiant').level, 7);
assert.equal(findFeature('dauntless_resolve').level, 15);
assert.equal(findFeature('battlefield_grace').level, 7);
// Battlefield Grace belongs to the DANCER, not the Paragon (registry +
// PDF-verified 2026-11-09) — the service gate follows the registry.
assert.ok(WARLORD_SUBCLASSES.find((e) => e.key === 'dancer').features.some((f) => f.key === 'battlefield_grace'));
assert.ok(!WARLORD_SUBCLASSES.find((e) => e.key === 'paragon').features.some((f) => f.key === 'battlefield_grace'));
assert.equal(findFeature('supernatural_dread').level, 7);

// No MULTICLASS_GRANT export: WARLORD_MULTICLASS_GRANT lives in
// levelProgression.js (added by job #9, single source of truth).
assert.equal(wl.MULTICLASS_GRANT, undefined);
assert.equal(typeof wl.default.spendLeadershipDie, 'function');

// --- Leadership Dice spend: pool, per-turn limit, Dreadlord gain ---
let st = wl.defaultWarlordState();
let r = wl.spendLeadershipDie(st, { count: 1, level: 1 });
assert.equal(r.success, false); assert.equal(r.reason, 'level_too_low');
assert.equal(wl.spendLeadershipDie(st, { count: 0, level: 2 }).reason, 'invalid_count');
r = wl.spendLeadershipDie(st, { count: 1, level: 2 });
assert.equal(r.success, true); assert.equal(r.diceLeft, 1); assert.equal(r.demoralizationGained, 0);
assert.equal(r.state.leadershipDiceMax, 2);
st = r.state;
assert.equal(wl.spendLeadershipDie(st, { count: 1, level: 2, spentThisTurn: 1 }).reason, 'per_turn_limit');
assert.equal(wl.spendLeadershipDie(wl.defaultWarlordState(), { count: 2, level: 2 }).reason, 'per_turn_limit'); // limit 1 at 2nd, with both dice still in the pool
r = wl.spendLeadershipDie(st, { count: 1, level: 2 });
assert.equal(r.success, true); assert.equal(r.diceLeft, 0);
assert.equal(wl.spendLeadershipDie(r.state, { count: 1, level: 2 }).reason, 'no_dice_left');
// Dreadlord: spending a Leadership Die gains a Demoralization Die of equal size.
st = wl.defaultWarlordState();
r = wl.spendLeadershipDie(st, { count: 1, level: 5, subclassName: "Dreadlord's Presence" });
assert.equal(r.success, true); assert.equal(r.demoralizationGained, 1);
assert.equal(r.state.demoralizationDice, 1);
r = wl.spendLeadershipDie(wl.defaultWarlordState(), { count: 1, level: 5, subclassName: 'Chieftain' });
assert.equal(r.demoralizationGained, 0); assert.equal(r.state.demoralizationDice, 0);

// --- Battlefield Grace regain (Dancer 7th — NOT Paragon; registry +
// PDF-verified 2026-11-09: the feature sits under Dancer's Presence) ---
st = wl.defaultWarlordState();
assert.equal(wl.regainLeadershipDie(st, { level: 6, subclassName: 'Dancer' }).reason, 'level_too_low');
assert.equal(wl.regainLeadershipDie(st, { level: 7, subclassName: 'Chieftain' }).reason, 'wrong_subclass');
assert.equal(wl.regainLeadershipDie(st, { level: 7, subclassName: 'Paragon' }).reason, 'wrong_subclass');
assert.equal(wl.regainLeadershipDie(st, { level: 7, subclassName: 'Dancer' }).reason, 'no_spent_dice'); // pool is full
st = wl.spendLeadershipDie(st, { count: 1, level: 7, subclassName: 'Dancer' }).state;
assert.equal(st.leadershipDiceLeft, 6); // pool 7 at 7th
r = wl.regainLeadershipDie(st, { level: 7, subclassName: 'Dancer' });
assert.equal(r.success, true); assert.equal(r.diceLeft, 7);
// No subclass supplied = unknown, allowed (the DM adjudicates).
st = wl.spendLeadershipDie(wl.defaultWarlordState(), { count: 1, level: 7 }).state;
r = wl.regainLeadershipDie(st, { level: 7 });
assert.equal(r.success, true);

// --- Demoralization Dice (Dreadlord 3rd): gain + spend ---
st = wl.defaultWarlordState();
assert.equal(wl.gainDemoralizationDie(st, { count: 1, level: 2, subclassName: 'Dreadlord' }).reason, 'level_too_low');
assert.equal(wl.gainDemoralizationDie(st, { count: 1, level: 3, subclassName: 'Paragon' }).reason, 'wrong_subclass');
r = wl.gainDemoralizationDie(st, { count: 2, level: 3, subclassName: 'Dreadlord' });
assert.equal(r.success, true); assert.equal(r.demoralizationDice, 2);
st = r.state;
assert.equal(wl.spendDemoralizationDie(st, { count: 1, level: 2, subclassName: 'Dreadlord' }).reason, 'level_too_low');
assert.equal(wl.spendDemoralizationDie(st, { count: 1, level: 5, subclassName: 'Paragon' }).reason, 'wrong_subclass');
assert.equal(wl.spendDemoralizationDie(st, { count: 2, level: 5, subclassName: 'Dreadlord' }).reason, 'per_turn_limit'); // limit 1 at 5th
r = wl.spendDemoralizationDie(st, { count: 1, level: 5, subclassName: 'Dreadlord' });
assert.equal(r.success, true); assert.equal(r.demoralizationDice, 1);
assert.equal(wl.spendDemoralizationDie({ ...wl.defaultWarlordState(), demoralizationDice: 0 }, { count: 1, level: 5, subclassName: 'Dreadlord' }).reason, 'no_dice_left');

// --- Once-per-rest features (subclass gates enforced when supplied) ---
st = wl.defaultWarlordState();
assert.equal(wl.useBoomingShout(st, { level: 14, subclassName: 'Chieftain' }).reason, 'level_too_low');
assert.equal(wl.useBoomingShout(st, { level: 15, subclassName: 'Paragon' }).reason, 'wrong_subclass');
r = wl.useBoomingShout(st, { level: 15, subclassName: 'Chieftain' });
assert.equal(r.success, true); assert.equal(r.state.boomingShoutUsed, true);
assert.equal(wl.useBoomingShout(r.state, { level: 15, subclassName: 'Chieftain' }).reason, 'already_used_this_rest');
assert.equal(wl.useBoomingShout(wl.defaultWarlordState(), { level: 15 }).success, true); // no subclass = DM adjudicates

assert.equal(wl.useStandDefiant(st, { level: 6, subclassName: 'Paragon' }).reason, 'level_too_low');
assert.equal(wl.useStandDefiant(st, { level: 7, subclassName: 'Chieftain' }).reason, 'wrong_subclass');
r = wl.useStandDefiant(st, { level: 7, subclassName: 'Paragon' });
assert.equal(r.success, true);
assert.equal(wl.useStandDefiant(r.state, { level: 7, subclassName: 'Paragon' }).reason, 'already_used_this_rest');

assert.equal(wl.useDauntlessResolve(st, { level: 14, subclassName: 'Paragon' }).reason, 'level_too_low');
r = wl.useDauntlessResolve(st, { level: 15, subclassName: 'Paragon' });
assert.equal(r.success, true);
assert.equal(wl.useDauntlessResolve(r.state, { level: 15, subclassName: 'Paragon' }).reason, 'already_used_this_rest');

assert.equal(wl.useGrandDecree(st, { level: 17, subclassName: 'Noble' }).reason, 'level_too_low');
r = wl.useGrandDecree(st, { level: 18, subclassName: 'Noble' });
assert.equal(r.success, true);
assert.equal(wl.useGrandDecree(r.state, { level: 18, subclassName: 'Noble' }).reason, 'already_used_this_rest');

assert.equal(wl.useSupernaturalDreadFear(st, { level: 6, subclassName: 'Dreadlord' }).reason, 'level_too_low');
assert.equal(wl.useSupernaturalDreadFear(st, { level: 7, subclassName: 'Paragon' }).reason, 'wrong_subclass');
r = wl.useSupernaturalDreadFear(st, { level: 7, subclassName: 'Dreadlord' });
assert.equal(r.success, true);
assert.equal(wl.useSupernaturalDreadFear(r.state, { level: 7, subclassName: 'Dreadlord' }).reason, 'already_used_this_rest');

// Bloody Victory (Chieftain 18th): Cha mod uses, long rest only.
assert.equal(wl.useBloodyVictory(st, { chaMod: 3, level: 17, subclassName: 'Chieftain' }).reason, 'level_too_low');
assert.equal(wl.useBloodyVictory(st, { chaMod: 3, level: 18, subclassName: 'Paragon' }).reason, 'wrong_subclass');
r = wl.useBloodyVictory(st, { chaMod: 3, level: 18, subclassName: 'Chieftain' });
assert.equal(r.success, true); assert.equal(r.usesLeft, 2);
st = wl.useBloodyVictory(r.state, { chaMod: 3, level: 18, subclassName: 'Chieftain' }).state;
st = wl.useBloodyVictory(st, { chaMod: 3, level: 18, subclassName: 'Chieftain' }).state;
assert.equal(st.bloodyVictoryUsesLeft, 0);
assert.equal(wl.useBloodyVictory(st, { chaMod: 3, level: 18, subclassName: 'Chieftain' }).reason, 'no_uses_left');
assert.equal(wl.useBloodyVictory(wl.defaultWarlordState(), { chaMod: 0, level: 18, subclassName: 'Chieftain' }).reason, 'no_uses_left');

// --- Warlord of the Wilds list + Packleader picks (preserved by rests) ---
st = wl.defaultWarlordState();
assert.equal(wl.setWarlordOfTheWildsSpells(st, { spells: ['Cure Wounds'], level: 17, subclassName: 'Packleader' }).reason, 'level_too_low');
assert.equal(wl.setWarlordOfTheWildsSpells(st, { spells: ['Cure Wounds'], level: 18, subclassName: 'Paragon' }).reason, 'wrong_subclass');
assert.equal(wl.setWarlordOfTheWildsSpells(st, { spells: ['a', 'b', 'c', 'd', 'e', 'f'], level: 18, subclassName: 'Packleader' }).reason, 'too_many_spells');
r = wl.setWarlordOfTheWildsSpells(st, { spells: ['Cure Wounds', 'Entangle', 'Goodberry'], level: 18, subclassName: 'Packleader' });
assert.equal(r.success, true); assert.deepEqual(r.spells, ['Cure Wounds', 'Entangle', 'Goodberry']);
assert.deepEqual(r.state.warlordOfTheWildsSpells, ['Cure Wounds', 'Entangle', 'Goodberry']);
r = wl.setWarlordOfTheWildsSpells(r.state, { spells: [], level: 18, subclassName: 'Packleader' });
assert.equal(r.success, true); assert.deepEqual(r.state.warlordOfTheWildsSpells, []);
r = wl.setPackleaderPicks(st, { cantrip: 'Druidcraft', spell: 'Goodberry' });
assert.equal(r.success, true);
assert.equal(r.state.packleaderCantrip, 'Druidcraft'); assert.equal(r.state.packleaderSpell, 'Goodberry');
r = wl.setPackleaderPicks(r.state, { cantrip: '' });
assert.equal(r.state.packleaderCantrip, null); assert.equal(r.state.packleaderSpell, 'Goodberry');

// --- Pure rests: both refill dice + clear Booming Shout / Stand Defiant;
// long rest only refills Bloody Victory and clears Dauntless / Grand Decree / Dread fear.
// Wilds list + Packleader picks are NEVER wiped; Demoralization Dice untouched.
const spent = {
  ...wl.defaultWarlordState(),
  leadershipDiceLeft: 0, leadershipDiceMax: 18,
  demoralizationDice: 2,
  boomingShoutUsed: true, standDefiantUsed: true,
  dauntlessResolveUsed: true, grandDecreeUsed: true,
  bloodyVictoryUsesLeft: 0, bloodyVictoryUsesMax: 4,
  dreadFearUsed: true,
  warlordOfTheWildsSpells: ['Cure Wounds', 'Entangle'],
  packleaderCantrip: 'Druidcraft', packleaderSpell: 'Goodberry',
};
r = wl.onLongRest(spent, { level: 18, subclass: 'Chieftain', chaMod: 4 });
assert.equal(r.state.leadershipDiceMax, 18); assert.equal(r.state.leadershipDiceLeft, 18);
assert.equal(r.state.boomingShoutUsed, false); assert.equal(r.state.standDefiantUsed, false);
assert.equal(r.state.dauntlessResolveUsed, false); assert.equal(r.state.grandDecreeUsed, false);
assert.equal(r.state.bloodyVictoryUsesMax, 4); assert.equal(r.state.bloodyVictoryUsesLeft, 4);
assert.equal(r.state.dreadFearUsed, false);
assert.equal(r.state.demoralizationDice, 2); // 1-minute expiry, not rest
assert.deepEqual(r.state.warlordOfTheWildsSpells, ['Cure Wounds', 'Entangle']);
assert.equal(r.state.packleaderCantrip, 'Druidcraft'); assert.equal(r.state.packleaderSpell, 'Goodberry');
r = wl.onShortRest(spent, { level: 18, subclass: 'Chieftain', chaMod: 4 });
assert.equal(r.state.leadershipDiceLeft, 18); // dice refill on a short rest too
assert.equal(r.state.boomingShoutUsed, false); assert.equal(r.state.standDefiantUsed, false);
assert.equal(r.state.dauntlessResolveUsed, true); // long-rest flags survive a short rest
assert.equal(r.state.grandDecreeUsed, true);
assert.equal(r.state.bloodyVictoryUsesLeft, 0); // Bloody Victory does NOT refill
assert.equal(r.state.bloodyVictoryUsesMax, 4);
assert.equal(r.state.dreadFearUsed, true);
assert.equal(r.state.demoralizationDice, 2);
assert.deepEqual(r.state.warlordOfTheWildsSpells, ['Cure Wounds', 'Entangle']);
// Noble long rest: pool includes the +3 Destined Leader dice.
r = wl.onLongRest(wl.defaultWarlordState(), { level: 15, subclass: 'Noble', chaMod: 2 });
assert.equal(r.state.leadershipDiceMax, 18); assert.equal(r.state.leadershipDiceLeft, 18);

// --- DM prompt section: never crashes on empty state, level-gated lines ---
let txt = wl.warlordPromptSection(null, { level: 2, chaMod: 3, name: 'Durnan' });
assert.ok(txt.includes('Warlord Durnan (level 2, Cha mod 3):'));
assert.ok(txt.includes('Leadership Dice: 2/2 (d6, up to 1 per turn; regain all on a Short or Long Rest)'));
assert.ok(txt.includes('Rallying Mark (bonus action)'));
assert.ok(txt.includes('Urgent Orders (bonus action)'));
assert.ok(txt.includes('Helpful Word (bonus action)'));
assert.ok(!txt.includes('Demoralization Dice'));
assert.ok(!txt.includes('Bloody Victory'));
txt = wl.warlordPromptSection(null, { level: 5, chaMod: 3, subclass: 'Dreadlord' });
assert.ok(txt.includes('Demoralization Dice: 0 (d6;'));
txt = wl.warlordPromptSection(
  { ...wl.defaultWarlordState(), warlordOfTheWildsSpells: ['Cure Wounds', 'Entangle'], packleaderCantrip: 'Druidcraft' },
  { level: 18, chaMod: 4, subclass: 'Chieftain' },
);
assert.ok(txt.includes('Leadership Dice: 18/18 (d12, up to 4 per turn;'));
assert.ok(txt.includes('Bloody Victory uses left: 4/4'));
assert.ok(txt.includes('Grand Decree: available'));
assert.ok(txt.includes('Booming Shout: available'));
assert.ok(txt.includes('Stand Defiant: available'));
assert.ok(txt.includes('Dauntless Resolve: available'));
assert.ok(txt.includes('Warlord of the Wilds spells: Cure Wounds, Entangle'));
assert.ok(txt.includes('Packleader picks: cantrip Druidcraft, spell —'));

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
  let loaded = await wl.loadWarlordState('character', 1, fake);
  assert.deepEqual(loaded, wl.defaultWarlordState()); // no row -> default
  const toSave = { ...wl.defaultWarlordState(), leadershipDiceLeft: 5, leadershipDiceMax: 7, demoralizationDice: 2 };
  assert.equal(await wl.saveWarlordState('character', 1, toSave, fake), true);
  loaded = await wl.loadWarlordState('character', 1, fake);
  assert.equal(loaded.leadershipDiceLeft, 5);
  assert.equal(loaded.demoralizationDice, 2);
  // Sibling keys in the blob survive the save (own full parse, never parseClassResources).
  store.set(1, JSON.stringify({ used: { action_surge: 1 } }));
  assert.equal(await wl.saveWarlordState('character', 1, toSave, fake), true);
  const blob = JSON.parse(store.get(1));
  assert.deepEqual(blob.used, { action_surge: 1 });
  assert.equal(blob.warlord.leadershipDiceLeft, 5);
  // Garbage JSON in the blob degrades to default, never throws.
  store.set(1, '{not json');
  loaded = await wl.loadWarlordState('character', 1, fake);
  assert.deepEqual(loaded, wl.defaultWarlordState());
  // Companion table is the other home.
  assert.equal(await wl.saveWarlordState('companion', 7, toSave, fake), true);
  loaded = await wl.loadWarlordState('companion', 7, fake);
  assert.equal(loaded.leadershipDiceMax, 7);
}

// --- Group 11: DM rest through restTimeService (needs the repo DB) ---
// Throwaway-DB pattern from rest-time.test.js. In a mirror without
// database.js this group logs a loud skip and the pure groups above
// still stand; on the Mac it MUST run.
{
  let dbOk = true;
  let dbModule; let rt; let sched;
  try {
    const dbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dnd-wl-rest-'));
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
      warlord: {
        ...wl.defaultWarlordState(),
        leadershipDiceLeft: 0, leadershipDiceMax: 18,
        demoralizationDice: 2,
        boomingShoutUsed: true, standDefiantUsed: true,
        dauntlessResolveUsed: true, grandDecreeUsed: true,
        bloodyVictoryUsesLeft: 0, bloodyVictoryUsesMax: 4,
        dreadFearUsed: true,
        warlordOfTheWildsSpells: ['Cure Wounds', 'Entangle'],
        packleaderCantrip: 'Druidcraft', packleaderSpell: 'Goodberry',
        ...over,
      },
    });
    // A plain Fighter hosts the party; the Warlord is the companion.
    const pcId = await insertRow('characters', {
      name: 'Garrick', class: 'fighter', level: 5,
      ability_scores: JSON.stringify({ str: 16, dex: 12, con: 16, int: 10, wis: 11, cha: 8 }),
      current_hp: 30, max_hp: 30,
      hit_dice: JSON.stringify({ d10: 5 }), hit_dice_used: '{}', spell_slots_used: '{}',
    });
    const sessionId = await insertRow('dm_sessions', {
      character_id: pcId, game_start_day: startClock.dayOfYear, game_start_year: startClock.year,
    });
    const npcId = await insertRow('npcs', { name: 'Durnan' });
    const compId = await insertRow('companions', {
      npc_id: npcId, recruited_by_character_id: pcId, status: 'active',
      companion_class: 'warlord', companion_subclass: 'Chieftain', companion_level: 18,
      companion_current_hp: 30, companion_max_hp: 40,
      companion_ability_scores: JSON.stringify({ str: 14, dex: 12, con: 14, int: 10, wis: 12, cha: 18 }),
      companion_hit_dice: JSON.stringify({ d8: 18 }), companion_hit_dice_used: '{}',
      class_resources_json: spentBlob(),
    });
    const readBlob = async () => JSON.parse(
      (await dbGet('SELECT class_resources_json FROM companions WHERE id = ?', [compId])).class_resources_json,
    ).warlord;
    // Companion-only long rest: everything refills / clears, list + picks survive.
    const longR = await rt.applyRest({ sessionId, characterId: pcId, type: 'long', actor: 'Durnan' });
    assert.equal(longR.success, true);
    assert.equal(longR.event.results.length, 1);
    let blob = await readBlob();
    assert.equal(blob.leadershipDiceLeft, 18); assert.equal(blob.leadershipDiceMax, 18);
    assert.equal(blob.boomingShoutUsed, false); assert.equal(blob.standDefiantUsed, false);
    assert.equal(blob.dauntlessResolveUsed, false); assert.equal(blob.grandDecreeUsed, false);
    assert.equal(blob.bloodyVictoryUsesLeft, 4); // Cha mod 4
    assert.equal(blob.dreadFearUsed, false);
    assert.equal(blob.demoralizationDice, 2); // untouched by rest
    assert.deepEqual(blob.warlordOfTheWildsSpells, ['Cure Wounds', 'Entangle']);
    assert.equal(blob.packleaderCantrip, 'Druidcraft'); assert.equal(blob.packleaderSpell, 'Goodberry');
    // Companion-only short rest: dice refill, either-rest flags clear,
    // long-rest-only flags and Bloody Victory do NOT.
    await dbRun('UPDATE companions SET class_resources_json = ? WHERE id = ?', [spentBlob(), compId]);
    const shortR = await rt.applyRest({ sessionId, characterId: pcId, type: 'short', actor: 'Durnan' });
    assert.equal(shortR.success, true);
    blob = await readBlob();
    assert.equal(blob.leadershipDiceLeft, 18);
    assert.equal(blob.boomingShoutUsed, false); assert.equal(blob.standDefiantUsed, false);
    assert.equal(blob.dauntlessResolveUsed, true); // long-rest-only flag survives a short rest
    assert.equal(blob.grandDecreeUsed, true);
    assert.equal(blob.bloodyVictoryUsesLeft, 0); // Bloody Victory does NOT refill
    assert.equal(blob.dreadFearUsed, true);
    assert.equal(blob.demoralizationDice, 2);
    assert.deepEqual(blob.warlordOfTheWildsSpells, ['Cure Wounds', 'Entangle']);
  }
}

console.log('newclass-warlord: all assertions passed');
