// tests/spellbook-service.test.js — wizard spellbook system, pure-service
// + validator / DM-prompt / spells-envelope units (2026-11-07).
//
// The book lives in known_spells (6 at L1, +2 per wizard level); the
// one new column, spellbook_json (migration 111), holds only
// { status: 'intact'|'lost', mastery: [], signature: [] }. This suite
// tests the real spellbookService.js helpers, the real Stage 4 /
// Stage 6 validators, the real DM-prompt builder, and the real
// /api/spells envelope — no logic is re-implemented here. Slot-table
// facts (new-slot levels, max slot level) are derived from the real
// FULL_CASTER_SPELL_SLOTS table, and fixture spells are pinned
// against the real catalog first, so a catalog change fails loudly
// instead of silently changing what a case means. If
// spellbookService.js were deleted, the imports below fail and the
// suite fails with it.
import assert from 'node:assert';
import express from 'express';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

let passed = 0;
let failed = 0;
function check(condition, message) {
  if (condition) { passed++; }
  else { failed++; console.error('  ✗', message); }
}
function group(name) { console.log('\n==', name); }

const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'spellbook-service-test-'));
const tmpDir = repoRoot;
const origCwd = process.cwd();
process.chdir(tmpDir);
delete process.env.TURSO_DATABASE_URL;
delete process.env.TURSO_AUTH_TOKEN;
const fromRepo = (rel) => pathToFileURL(path.join(origCwd, rel)).href;

const db = await import(fromRepo('server/database.js'));
await db.initDatabase();

const sb = await import(fromRepo('server/services/spellbookService.js'));
const {
  SPELLBOOK_START_SIZE, SPELLBOOK_SPELLS_PER_LEVEL, COPY_GOLD_PER_SPELL_LEVEL,
  COPY_HOURS_PER_SPELL_LEVEL, REPLACE_GOLD_PER_SPELL_LEVEL,
  REPLACE_HOURS_PER_SPELL_LEVEL, STANDARD_SPELLBOOK_COST_GP,
  SPELLBOOK_MATERIALS,
  SAVANT_SCHOOL_BY_SUBCLASS, NEW_SLOT_LEVELS,
  SPELL_MASTERY_LEVEL, SIGNATURE_SPELLS_LEVEL, SPELL_MASTERY_MAX, SIGNATURE_SPELLS_MAX,
  spellbookSizeForLevel, copyCostForSpellLevel, replaceCostForSpellLevel,
  replaceCostForSpells, parseBookMaterialsParam,
  savantSchoolForSubclass,
  maxSpellSlotLevel, savantFreeCountAtLevelUp, savantFreeMaxSpellLevel,
  parseSpellbookState, serializeSpellbookState, alwaysPreparedSpells,
  parsePendingMemorizeSwap, pendingMemorizeSwap, setPendingMemorizeSwap,
  arcaneRecoveryBudget, parsePendingArcaneRecovery, pendingArcaneRecovery,
  setPendingArcaneRecovery, arcaneRecoveryUsed, setArcaneRecoveryUsed,
  arcaneRecoveryMaxSlots, applyArcaneRecovery,
  validateBookMembership, validateBookAdds, validateSavantSpells,
  applyMemorizeSwap, wizardLevelFromClassLevels,
  wizardSubclassFromClassLevels, parseScrollName,
  warlockLevelFromClassLevels, pactSlotsForWarlockLevel, resetPactSlots,
} = sb;
const { FULL_CASTER_SPELL_SLOTS } = await import(fromRepo('server/config/levelProgression.js'));
const { SPELL_DATA_ENTRIES } = await import(fromRepo('server/data/spellCatalogData.js'));
const { canonicalizeSpellName } = await import(fromRepo('server/services/spellSelectionService.js'));
const { validateCreatorNextStage4, validateCreatorNextStage6 } = await import(fromRepo('server/routes/character.js'));
const { createDMSystemPrompt } = await import(fromRepo('server/services/dmPromptBuilder.js'));

// --- HTTP harness: the real spells router, for the envelope test ----
const app = express();
app.use(express.json());
const spellsRouter = (await import(fromRepo('server/routes/spells.js'))).default;
app.use('/api/spells', spellsRouter);
const server = await new Promise((resolve) => {
  const s = app.listen(0, '127.0.0.1', () => resolve(s));
});
const base = `http://127.0.0.1:${server.address().port}`;
async function getApi(pathQuery) {
  const res = await fetch(`${base}${pathQuery}`);
  let json = null;
  try { json = await res.json(); } catch {}
  return { status: res.status, json };
}

// --- Catalog pins: every fixture spell below is what the catalog says
// it is (level / school / wizard list). If the catalog ever changes,
// these fail first, instead of a later case silently changing meaning.
const cat = (name) => SPELL_DATA_ENTRIES[canonicalizeSpellName(name)];
function catPin(name, level, school, onWizard) {
  const e = cat(name);
  const ok = e && Number(e.level) === level && e.school === school
    && (onWizard ? (e.classes || []).includes('Wizard') : !(e.classes || []).includes('Wizard'));
  check(!!ok, `catalog pin: ${name} is L${level} ${school}${onWizard ? ', on the wizard list' : ', NOT on the wizard list'} (got ${JSON.stringify(e && { level: e.level, school: e.school, classes: e.classes })})`);
}
catPin('Fireball', 3, 'Evocation', true);
catPin('Counterspell', 3, 'Abjuration', true);
catPin('Misty Step', 2, 'Conjuration', true);
catPin('Scorching Ray', 2, 'Evocation', true);
catPin('Darkness', 2, 'Evocation', true);
catPin('Shield', 1, 'Abjuration', true);
catPin('Magic Missile', 1, 'Evocation', true);
catPin('Cure Wounds', 1, 'Abjuration', false);
catPin('Fire Bolt', 0, 'Evocation', true);
catPin('Blindness/Deafness', 2, 'Transmutation', true);
catPin('Detect Magic', 1, 'Divination', true);
catPin('Comprehend Languages', 1, 'Divination', true);
catPin('False Life', 1, 'Necromancy', true);
catPin('Wish', 9, 'Conjuration', true);
catPin('Meteor Swarm', 9, 'Evocation', true);

// ===========================================================================
// (a) Book size + copy cost: 6 at L1, +2 per level; 50 gp + 2h per level
// ===========================================================================
group('(a) book size + copy cost');
{
  for (let level = 1; level <= 20; level++) {
    const want = 6 + 2 * (level - 1);
    check(spellbookSizeForLevel(level) === want, `book size at L${level} is ${want} (got ${spellbookSizeForLevel(level)})`);
  }
  check(spellbookSizeForLevel(1) === SPELLBOOK_START_SIZE, 'book size at L1 is SPELLBOOK_START_SIZE (6)');
  check(SPELLBOOK_SPELLS_PER_LEVEL === 2, 'SPELLBOOK_SPELLS_PER_LEVEL is 2');
  check(copyCostForSpellLevel(1)?.gold === 50 && copyCostForSpellLevel(1)?.hours === 2, 'copying a L1 spell costs 50 gp + 2h');
  check(copyCostForSpellLevel(3)?.gold === 150 && copyCostForSpellLevel(3)?.hours === 6, 'copying a L3 spell costs 150 gp + 6h');
  check(copyCostForSpellLevel(9)?.gold === 450 && copyCostForSpellLevel(9)?.hours === 18, 'copying a L9 spell costs 450 gp + 18h');
  check(COPY_GOLD_PER_SPELL_LEVEL === 50 && COPY_HOURS_PER_SPELL_LEVEL === 2, 'copy constants are 50 gp / 2h per level');
  check(copyCostForSpellLevel(0) === null, 'copying a cantrip has no cost — null, the route refuses it');
  check(copyCostForSpellLevel(-1) === null && copyCostForSpellLevel('x') === null, 'copy cost of an invalid level is null');
  // Scroll-name parsing (2026-11-08, D1): the spell rides the row
  // name, canonical form `Spell Scroll of <Spell>`.
  check(parseScrollName('Spell Scroll of Fireball') === 'Fireball', 'parseScrollName reads the spell from the canonical scroll name');
  check(parseScrollName('spell scroll of fireball') === 'fireball', 'parseScrollName is case-insensitive on the prefix and keeps the row spelling');
  check(parseScrollName('Spell Scroll of  Counterspell ') === 'Counterspell', 'parseScrollName trims the spell');
  check(parseScrollName('Spell Scroll (1st Level)') === null, 'a level-named scroll names no spell');
  check(parseScrollName('Spell Scroll') === null, 'a bare scroll names no spell');
  check(parseScrollName('Spell Scroll of ') === null, 'a scroll naming nothing names no spell');
  check(parseScrollName(null) === null && parseScrollName(42) === null, 'parseScrollName of a non-string is null');
  // Wizard subclass read (D3): the wizard entry's subclass wins;
  // the row subclass fills in only when wizard is primary — a
  // fighter-primary wizard's row subclass is the fighter's, never
  // the wizard's.
  check(wizardSubclassFromClassLevels([{ class: 'wizard', level: 5, subclass: 'hedge_mage' }], 'wizard', null) === 'hedge_mage',
    'the subclass read takes the wizard entry subclass');
  check(wizardSubclassFromClassLevels([{ class: 'fighter', level: 3, subclass: 'champion' }, { class: 'wizard', level: 3 }], 'fighter', 'champion') === null,
    'a fighter-primary wizard with no wizard-entry subclass has no wizard subclass (the row subclass is the fighter\'s)');
  check(wizardSubclassFromClassLevels(null, 'wizard', 'evoker') === 'evoker',
    'with no class_levels, a primary wizard falls back to the row subclass');
  check(wizardSubclassFromClassLevels('[{"class":"wizard","level":5,"subclass":"hedge_mage"}]', 'wizard', null) === 'hedge_mage',
    'the subclass read accepts a JSON string');
  check(wizardSubclassFromClassLevels([{ class: 'wizard', level: 5 }], 'wizard', null) === null,
    'a wizard with no subclass anywhere reads null');
}

// ===========================================================================
// (b) Slot-table-derived facts: new-slot levels, max slot level, Savant
// ===========================================================================
group('(b) new-slot levels + max slot level derived from FULL_CASTER_SPELL_SLOTS');
{
  // New-slot levels: the levels AFTER 1st where the slot table gains
  // a slot level it did not have at the previous level. (L1 is the
  // baseline, not a gain — no Savant frees are due at 1st.)
  const derived = [];
  let prevCount = Object.keys(FULL_CASTER_SPELL_SLOTS[1] || {}).length;
  for (let level = 2; level <= 20; level++) {
    const count = Object.keys(FULL_CASTER_SPELL_SLOTS[level] || {}).length;
    if (count > prevCount) derived.push(level);
    prevCount = count;
  }
  check(JSON.stringify(NEW_SLOT_LEVELS) === JSON.stringify(derived),
    `NEW_SLOT_LEVELS matches the table-derived list ${JSON.stringify(derived)} (got ${JSON.stringify(NEW_SLOT_LEVELS)})`);
  for (const level of [1, 2, 3, 5, 7, 9, 11, 13, 15, 17, 20]) {
    const want = Math.max(...Object.keys(FULL_CASTER_SPELL_SLOTS[level]).map(Number));
    check(maxSpellSlotLevel(level) === want, `max slot level at wizard L${level} is ${want} (got ${maxSpellSlotLevel(level)})`);
  }
  check(savantFreeCountAtLevelUp(3) === 2, 'Savant frees at L3: 2 (the two free spells ARE the new-slot grant for 2nd-level slots, not 2+1)');
  for (const level of [5, 7, 9, 11, 13, 15, 17]) {
    check(savantFreeCountAtLevelUp(level) === 1, `Savant frees at L${level}: 1`);
  }
  for (const level of [1, 2, 4, 6, 8, 18, 19, 20]) {
    check(savantFreeCountAtLevelUp(level) === 0, `Savant frees at L${level}: 0`);
  }
  check(savantFreeMaxSpellLevel(3) === 2, 'Savant max spell level at L3 is 2');
  check(savantFreeMaxSpellLevel(5) === 3 && savantFreeMaxSpellLevel(9) === 5 && savantFreeMaxSpellLevel(17) === 9,
    'Savant max spell level follows the new slot level (L5: 3, L9: 5, L17: 9)');
}

// ===========================================================================
// (c) Savant schools: registry keys + display forms, non-PHB -> null
// ===========================================================================
group('(c) Savant schools');
{
  check(SAVANT_SCHOOL_BY_SUBCLASS.evoker === 'Evocation'
    && SAVANT_SCHOOL_BY_SUBCLASS.abjurer === 'Abjuration'
    && SAVANT_SCHOOL_BY_SUBCLASS.diviner === 'Divination'
    && SAVANT_SCHOOL_BY_SUBCLASS.illusionist === 'Illusion',
    'SAVANT_SCHOOL_BY_SUBCLASS holds the four PHB schools');
  check(savantSchoolForSubclass('evoker') === 'Evocation', "savantSchoolForSubclass('evoker') is Evocation");
  check(savantSchoolForSubclass('Evoker') === 'Evocation', 'key lookup is case-insensitive');
  check(savantSchoolForSubclass('School of Evocation') === 'Evocation', "display form 'School of Evocation' maps to Evocation (pre-audit rows stored that string)");
  check(savantSchoolForSubclass('Evocation') === 'Evocation', 'bare school name maps too');
  check(savantSchoolForSubclass('abjurer') === 'Abjuration' && savantSchoolForSubclass('diviner') === 'Divination' && savantSchoolForSubclass('illusionist') === 'Illusion',
    'the other three PHB schools map');
  for (const sub of ['war_magic', 'hedge_mage', 'bladesinger', 'runecrafter', 'fighter', '']) {
    check(savantSchoolForSubclass(sub) === null, `savantSchoolForSubclass('${sub}') is null — no Savant feature`);
  }
  check(savantSchoolForSubclass(null) === null && savantSchoolForSubclass(undefined) === null, 'null/undefined subclass maps to null');
}

// ===========================================================================
// (d) spellbook_json parse / serialize
// ===========================================================================
group('(d) spellbook_json state');
{
  const blank = { status: 'intact', mastery: [], signature: [] };
  check(JSON.stringify(parseSpellbookState(null)) === JSON.stringify(blank), 'parse(null) is the blank intact state');
  check(JSON.stringify(parseSpellbookState(undefined)) === JSON.stringify(blank), 'parse(undefined) is blank');
  check(JSON.stringify(parseSpellbookState('{}')) === JSON.stringify(blank), "parse('{}') is blank");
  check(JSON.stringify(parseSpellbookState('{"status":"lost"}')) === JSON.stringify({ status: 'lost', mastery: [], signature: [] }),
    'parse keeps lost + empty lists');
  check(JSON.stringify(parseSpellbookState('not json')) === JSON.stringify(blank), 'parse of garbage is blank (never throws)');
  check(JSON.stringify(parseSpellbookState({ status: 'lost', mastery: ['Fireball'], signature: ['Wish'] })) === JSON.stringify({ status: 'lost', mastery: ['Fireball'], signature: ['Wish'] }),
    'parse of an object passes through');
  check(parseSpellbookState({ status: 'stolen' }).status === 'intact', 'an unknown status value falls back to intact');
  check(JSON.stringify(parseSpellbookState({ mastery: [' Fireball ', 7, null, ''] }).mastery) === JSON.stringify(['Fireball']),
    'parse trims names and drops non-string/empty entries');
  const round = serializeSpellbookState({ status: 'lost', mastery: ['Fireball'], signature: [] });
  check(JSON.stringify(parseSpellbookState(round)) === JSON.stringify({ status: 'lost', mastery: ['Fireball'], signature: [] }),
    'serialize round-trips through parse');
  check(serializeSpellbookState(null) === JSON.stringify(blank), 'serialize(null) is the blank state JSON');

  // Banked Memorize Swap (rest consolidation, 2026-11-07): the key is
  // present ONLY while a swap is banked, so the blank shape above is
  // untouched, and every serialize round-trip preserves a live bank
  // (the status / always-prepared / discard routes must never
  // silently wipe one).
  check(pendingMemorizeSwap(null) === null && pendingMemorizeSwap('{}') === null,
    'no bank by default');
  check(parsePendingMemorizeSwap({ oldSpell: ' Sleep ', newSpell: 'Misty Step' }).oldSpell === 'Sleep'
    && parsePendingMemorizeSwap({ oldSpell: 'Sleep', newSpell: 'Misty Step' }).newSpell === 'Misty Step',
    'a valid bank parses, trimmed');
  check(parsePendingMemorizeSwap(null) === null && parsePendingMemorizeSwap('nope') === null
    && parsePendingMemorizeSwap({ oldSpell: 'Sleep' }) === null
    && parsePendingMemorizeSwap({ oldSpell: '', newSpell: 'Misty Step' }) === null
    && parsePendingMemorizeSwap(['Sleep', 'Misty Step']) === null,
    'an invalid bank is dropped, never thrown');
  const banked = { status: 'intact', mastery: [], signature: [], pendingMemorizeSwap: { oldSpell: 'Sleep', newSpell: 'Misty Step' } };
  check(JSON.stringify(parseSpellbookState(serializeSpellbookState(banked))) === JSON.stringify(banked),
    'a banked swap round-trips through serialize + parse');
  check(JSON.stringify(parseSpellbookState(serializeSpellbookState(setPendingMemorizeSwap(banked, null)))) === JSON.stringify(blank),
    'clearing the bank restores the exact blank shape');
  check(pendingMemorizeSwap(setPendingMemorizeSwap('{}', { oldSpell: 'Sleep', newSpell: 'Misty Step' })).oldSpell === 'Sleep',
    'setPendingMemorizeSwap banks onto a blank state');

  // Arcane Recovery (2026-11-08): the used-flag + the bank ride the
  // same column in the same present-only-when-set shape, so the
  // blank state above is untouched and every serialize round-trip
  // preserves a live bank/flag (the status / always-prepared /
  // discard / replace routes must never silently wipe one — the
  // routes pin the live behaviour in spellbook-routes.test.js).
  check(pendingArcaneRecovery(null) === null && pendingArcaneRecovery('{}') === null,
    'no Arcane bank by default');
  check(arcaneRecoveryUsed(null) === false && arcaneRecoveryUsed('{}') === false,
    'Arcane Recovery is available by default (no used-flag)');
  check(JSON.stringify(parsePendingArcaneRecovery({ slots: [2, 1] })) === JSON.stringify({ slots: [2, 1] }),
    'a valid Arcane bank parses as a list of slot levels');
  check(JSON.stringify(parsePendingArcaneRecovery({ levels: [3] })) === JSON.stringify({ slots: [3] }),
    "a 'levels' key parses as the same bank (alias for hand-written rows)");
  check(parsePendingArcaneRecovery(null) === null && parsePendingArcaneRecovery('nope') === null
    && parsePendingArcaneRecovery({ slots: [] }) === null
    && parsePendingArcaneRecovery({ slots: [0] }) === null
    && parsePendingArcaneRecovery({ slots: [1.5] }) === null
    && parsePendingArcaneRecovery({ slots: 'x' }) === null
    && parsePendingArcaneRecovery([2, 1]) === null,
    'an invalid Arcane bank is dropped, never thrown');
  check(JSON.stringify(parsePendingArcaneRecovery({ slots: [6] })) === JSON.stringify({ slots: [6] }),
    'a 6th-level bank parses — validation refuses it, parse does not silently drop it');
  const arcBanked = { status: 'intact', mastery: [], signature: [], pendingArcaneRecovery: { slots: [2, 1] } };
  check(JSON.stringify(parseSpellbookState(serializeSpellbookState(arcBanked))) === JSON.stringify(arcBanked),
    'a banked recovery round-trips through serialize + parse');
  const arcUsed = { status: 'intact', mastery: [], signature: [], arcaneRecoveryUsed: true };
  check(JSON.stringify(parseSpellbookState(serializeSpellbookState(arcUsed))) === JSON.stringify(arcUsed),
    'the used-flag round-trips through serialize + parse');
  const arcBoth = { status: 'intact', mastery: [], signature: [], arcaneRecoveryUsed: true, pendingArcaneRecovery: { slots: [1] } };
  check(JSON.stringify(parseSpellbookState(serializeSpellbookState(arcBoth))) === JSON.stringify(arcBoth),
    'bank + flag together round-trip through serialize + parse');
  check(JSON.stringify(parseSpellbookState(serializeSpellbookState(setPendingArcaneRecovery(arcBanked, null)))) === JSON.stringify(blank),
    'clearing the Arcane bank restores the exact blank shape');
  check(JSON.stringify(parseSpellbookState(serializeSpellbookState(setArcaneRecoveryUsed(arcUsed, false)))) === JSON.stringify(blank),
    'clearing the used-flag restores the exact blank shape');
  check(JSON.stringify(parseSpellbookState(serializeSpellbookState(setArcaneRecoveryUsed(arcBoth, false)))) === JSON.stringify({ status: 'intact', mastery: [], signature: [], pendingArcaneRecovery: { slots: [1] } }),
    'clearing the flag leaves a live bank alone');
  check(pendingArcaneRecovery(setPendingArcaneRecovery('{}', { slots: [2, 1] })).slots.join(',') === '2,1',
    'setPendingArcaneRecovery banks onto a blank state');
  check(arcaneRecoveryUsed(setArcaneRecoveryUsed('{}', true)) === true,
    'setArcaneRecoveryUsed sets the flag on a blank state');
  // A status flip / always-prepared set round-trips through the same
  // parse/serialize pair the routes use, so it must preserve both
  // keys — the discard/status routes rely on exactly this.
  const flipped = { ...parseSpellbookState(serializeSpellbookState(arcBoth)), status: 'lost' };
  check(JSON.stringify(parseSpellbookState(serializeSpellbookState(flipped))) === JSON.stringify({ status: 'lost', mastery: [], signature: [], arcaneRecoveryUsed: true, pendingArcaneRecovery: { slots: [1] } }),
    'flipping the book to lost preserves the bank + flag');
  check(parseSpellbookState({ arcaneRecoveryUsed: 'yes' }).arcaneRecoveryUsed === undefined,
    'a non-boolean used-flag is dropped, never trusted');
}

// ===========================================================================
// (e) Always-prepared gates: L18 Mastery, L20 Signature, below = inert
// ===========================================================================
group('(e) always-prepared gates');
{
  const state = { status: 'intact', mastery: ['Fireball', 'Counterspell'], signature: ['Wish', 'Meteor Swarm'] };
  check(SPELL_MASTERY_LEVEL === 18 && SIGNATURE_SPELLS_LEVEL === 20, 'gates are L18 Mastery / L20 Signature');
  check(SPELL_MASTERY_MAX === 2 && SIGNATURE_SPELLS_MAX === 2, 'each list holds at most 2');
  check(JSON.stringify(alwaysPreparedSpells(state, 17)) === JSON.stringify([]), 'at L17 both stored lists are inert');
  check(JSON.stringify(alwaysPreparedSpells(state, 18)) === JSON.stringify(['Fireball', 'Counterspell']),
    'at L18 only the Mastery picks are always prepared');
  check(JSON.stringify(alwaysPreparedSpells(state, 20)) === JSON.stringify(['Fireball', 'Counterspell', 'Wish', 'Meteor Swarm']),
    'at L20 both lists are always prepared');
  check(JSON.stringify(alwaysPreparedSpells({ status: 'intact', mastery: ['A', 'B', 'C'], signature: [] }, 20)) === JSON.stringify(['A', 'B']),
    'always-prepared slices each list to its max of 2');
  check(JSON.stringify(alwaysPreparedSpells(null, 20)) === JSON.stringify([]), 'null state yields no picks');
  check(wizardLevelFromClassLevels(JSON.stringify([{ class: 'wizard', level: 5 }])) === 5,
    'wizardLevelFromClassLevels reads a JSON string');
  check(wizardLevelFromClassLevels([{ class: 'cleric', level: 3 }]) === null, 'no wizard entry yields null');
  check(wizardLevelFromClassLevels('garbage') === null, 'unparseable class_levels yields null');
}

// ===========================================================================
// (f) validateBookMembership: prepared ⊆ book, minus always-prepared
// ===========================================================================
group('(f) book membership');
{
  const book = ['Magic Missile', 'Shield', 'Mage Armor', 'Sleep', 'Burning Hands', 'Thunderwave'];
  const mOk = validateBookMembership(['Shield', 'Sleep'], book, []);
  check(mOk.ok && mOk.missing.length === 0, 'prepared subset of the book passes');
  const mMissing = validateBookMembership(['Shield', 'Fireball', 'Counterspell'], book, []);
  check(!mMissing.ok && JSON.stringify(mMissing.missing) === JSON.stringify(['Fireball', 'Counterspell']),
    'missing spells are listed in first-seen order');
  const mDupe = validateBookMembership(['Fireball', 'Fireball', 'Shield'], book, []);
  check(JSON.stringify(mDupe.missing) === JSON.stringify(['Fireball']), 'a missing spell is listed once even when prepared twice');
  const mExcl = validateBookMembership(['Shield', 'Fireball'], book, ['Fireball']);
  check(mExcl.ok, 'an always-prepared pick outside the book is excluded from membership');
  check(validateBookMembership([], book, []).ok, 'an empty prepared list passes');
  check(validateBookMembership(['Shield'], [], []).missing.length === 1, 'against an empty book every prepared spell is missing');
  const mCase = validateBookMembership(['shield', 'SLEEP'], book, []);
  check(mCase.ok, 'membership is case-insensitive (canonicalized both sides)');
  const mNonString = validateBookMembership(['Shield', null, 7, ''], book, []);
  check(mNonString.ok, 'non-string / empty entries in the prepared list are skipped, not treated as missing');
}

// ===========================================================================
// (g) validateBookAdds: +2 cap, wizard-list, castable level, no dupes
// ===========================================================================
group('(g) level-up book adds');
{
  const book = ['Magic Missile', 'Shield', 'Mage Armor', 'Sleep', 'Burning Hands', 'Thunderwave'];
  const aOk = validateBookAdds({ spells: ['Detect Magic', 'Feather Fall'], bookList: book, wizardLevel: 2 });
  check(aOk.ok, 'two L1 adds at L2 pass');
  const aThree = validateBookAdds({ spells: ['Detect Magic', 'Feather Fall', 'Grease'], bookList: book, wizardLevel: 2 });
  check(!aThree.ok && aThree.errors.some((e) => e.includes('at most 2')), 'three adds refuse with the +2 cap');
  const aMulti = validateBookAdds({ spells: ['Detect Magic', 'Feather Fall', 'Grease', 'Identify', 'Alarm', 'Comprehend Languages'], bookList: book, wizardLevel: 1, maxCount: 6 });
  check(aMulti.ok, 'multiclass seed (maxCount 6) accepts exactly 6 spells — a 1st-level wizard\'s book');
  const aMultiSeven = validateBookAdds({ spells: ['Detect Magic', 'Feather Fall', 'Grease', 'Identify', 'Alarm', 'Comprehend Languages', 'False Life'], bookList: book, wizardLevel: 1, maxCount: 6 });
  check(!aMultiSeven.ok && aMultiSeven.errors.some((e) => e.includes('at most 6')), 'a 7-spell multiclass seed refuses with the 6 cap');
  // V4 (2026-11-08): the multiclass seed is exactly 6, not a max —
  // a 5-spell seed refuses naming the count.
  const aMultiFive = validateBookAdds({ spells: ['Detect Magic', 'Feather Fall', 'Grease', 'Identify', 'Alarm'], bookList: book, wizardLevel: 1, maxCount: 6, minCount: 6 });
  check(!aMultiFive.ok && aMultiFive.errors.some((e) => e.includes('exactly 6') && e.includes('got 5')),
    'a 5-spell multiclass seed refuses naming the exact count of 6');
  const aMultiExact = validateBookAdds({ spells: ['Detect Magic', 'Feather Fall', 'Grease', 'Identify', 'Alarm', 'Comprehend Languages'], bookList: book, wizardLevel: 1, maxCount: 6, minCount: 6 });
  check(aMultiExact.ok, 'a 6-spell seed with the exact-count floor passes');
  const aMinOnly = validateBookAdds({ spells: ['Detect Magic'], bookList: book, wizardLevel: 2, maxCount: null, minCount: 2 });
  check(!aMinOnly.ok && aMinOnly.errors.some((e) => e.includes('at least 2')),
    'a floor without a cap refuses below the floor, naming the floor');
  // In-class adds pass no floor (max-only, as before): a 1-spell
  // in-class add still passes — the exact-2 sibling was recorded,
  // not fixed, in the veto-fixes job (the client sends no newSpells
  // at all for an in-class wizard level-up).
  const aOne = validateBookAdds({ spells: ['Detect Magic'], bookList: book, wizardLevel: 2 });
  check(aOne.ok, 'an in-class 1-spell add still passes — max-only, no floor');
  const aMultiNull = validateBookAdds({ spells: ['Detect Magic', 'Feather Fall', 'Grease', 'Identify', 'Alarm', 'Comprehend Languages', 'False Life'], bookList: book, wizardLevel: 1, maxCount: null });
  check(aMultiNull.ok, 'maxCount null still means no cap for callers that pass it explicitly');
  const aNonWiz = validateBookAdds({ spells: ['Cure Wounds'], bookList: book, wizardLevel: 5 });
  check(!aNonWiz.ok && aNonWiz.errors.some((e) => e.includes('Cure Wounds')), 'a non-wizard spell refuses');
  const aOver = validateBookAdds({ spells: ['Fireball'], bookList: book, wizardLevel: 1 });
  check(!aOver.ok && aOver.errors.some((e) => e.includes('Fireball')), 'a spell above the castable level refuses at L1');
  const aOverOk = validateBookAdds({ spells: ['Fireball'], bookList: book, wizardLevel: 5 });
  check(aOverOk.ok, 'the same spell passes once the wizard can cast it (L5)');
  const aDupe = validateBookAdds({ spells: ['Shield'], bookList: book, wizardLevel: 5 });
  check(!aDupe.ok && aDupe.errors.some((e) => e.includes('already in the spellbook')), 'a spell already in the book refuses');
  const aTwice = validateBookAdds({ spells: ['Detect Magic', 'Detect Magic'], bookList: book, wizardLevel: 2 });
  check(!aTwice.ok && aTwice.errors.some((e) => e.includes('picked twice')), 'picking the same spell twice refuses');
  const aCantrip = validateBookAdds({ spells: ['Fire Bolt'], bookList: book, wizardLevel: 5 });
  check(!aCantrip.ok && aCantrip.errors.some((e) => e.includes('cantrip')), 'a cantrip refuses — the book holds leveled spells only');
  const aUnknown = validateBookAdds({ spells: ['Not A Spell'], bookList: book, wizardLevel: 5 });
  check(!aUnknown.ok, 'an unknown spell name refuses');
}

// ===========================================================================
// (h) validateSavantSpells: school, level, count, due level
// ===========================================================================
group('(h) Savant free-adds');
{
  const book = ['Magic Missile', 'Shield', 'Mage Armor', 'Sleep', 'Burning Hands', 'Thunderwave'];
  const sOk = validateSavantSpells({ spells: ['Scorching Ray', 'Darkness'], subclass: 'evoker', newClassLevel: 3, bookList: book });
  check(sOk.ok && sOk.school === 'Evocation' && sOk.freeCount === 2 && sOk.maxSpellLevel === 2,
    'two L2 Evocation frees at L3 pass for an evoker');
  const sAlias = validateSavantSpells({ spells: ['Scorching Ray', 'Darkness'], subclass: 'School of Evocation', newClassLevel: 3, bookList: book });
  check(sAlias.ok, "the display form 'School of Evocation' also passes");
  const sWrong = validateSavantSpells({ spells: ['Misty Step'], subclass: 'evoker', newClassLevel: 3, bookList: book });
  check(!sWrong.ok && sWrong.errors.some((e) => e.includes('Conjuration') && e.includes('Evocation')),
    'a wrong-school spell refuses naming both schools');
  const sOver = validateSavantSpells({ spells: ['Fireball'], subclass: 'evoker', newClassLevel: 3, bookList: book });
  check(!sOver.ok && sOver.errors.some((e) => e.includes('level 3') && e.includes('level 2 or lower')),
    'a spell above the Savant max level refuses at L3');
  const sThree = validateSavantSpells({ spells: ['Scorching Ray', 'Darkness', 'Burning Hands'], subclass: 'evoker', newClassLevel: 3, bookList: book });
  check(!sThree.ok && sThree.errors.some((e) => e.includes('2 free Evocation')),
    'three frees at L3 refuse — only two are due');
  const sNone = validateSavantSpells({ spells: ['Scorching Ray'], subclass: 'evoker', newClassLevel: 4, bookList: book });
  check(!sNone.ok && sNone.freeCount === 0 && sNone.errors.some((e) => e.includes('no Savant spells are due')),
    'no frees are due at L4');
  const sNonPhb = validateSavantSpells({ spells: ['Scorching Ray'], subclass: 'war_magic', newClassLevel: 3, bookList: book });
  check(!sNonPhb.ok && sNonPhb.school === null && sNonPhb.errors.some((e) => e.includes('no Savant feature')),
    'a non-PHB-school subclass has no Savant feature');
  const sFive = validateSavantSpells({ spells: ['Fireball'], subclass: 'evoker', newClassLevel: 5, bookList: book });
  check(sFive.ok && sFive.freeCount === 1 && sFive.maxSpellLevel === 3,
    'one L3 Evocation free at L5 passes (new-slot level)');
  const sDupe = validateSavantSpells({ spells: ['Shield'], subclass: 'abjurer', newClassLevel: 3, bookList: book });
  check(!sDupe.ok && sDupe.errors.some((e) => e.includes('already in the spellbook')),
    'a Savant spell already in the book refuses');
  const sCantrip = validateSavantSpells({ spells: ['Fire Bolt'], subclass: 'evoker', newClassLevel: 3, bookList: book });
  check(!sCantrip.ok && sCantrip.errors.some((e) => e.includes('cantrip')),
    'a cantrip refuses as a Savant free-add');
  const sAbj = validateSavantSpells({ spells: ['Shield', 'Alarm'], subclass: 'abjurer', newClassLevel: 3, bookList: [] });
  check(sAbj.ok && sAbj.school === 'Abjuration',
    'two L1 Abjuration frees at L3 pass for an abjurer (empty book — nothing is a dupe)');
}

// ===========================================================================
// (i) applyMemorizeSwap: Short Rest single-swap inside the book
// ===========================================================================
group('(i) Memorize Spell swap');
{
  const book = ['Magic Missile', 'Shield', 'Mage Armor', 'Sleep', 'Burning Hands', 'Thunderwave', 'Detect Magic'];
  const prepared = ['Magic Missile', 'Shield', 'Mage Armor', 'Sleep'];
  const wOk = applyMemorizeSwap({ preparedList: prepared, bookList: book, oldSpell: 'Sleep', newSpell: 'Burning Hands' });
  check(wOk.ok && JSON.stringify(wOk.prepared) === JSON.stringify(['Magic Missile', 'Shield', 'Mage Armor', 'Burning Hands']),
    'a swap replaces the old spell in place');
  check(JSON.stringify(prepared) === JSON.stringify(['Magic Missile', 'Shield', 'Mage Armor', 'Sleep']),
    'the swap is pure — the input list is not mutated');
  const wNotPrep = applyMemorizeSwap({ preparedList: prepared, bookList: book, oldSpell: 'Fireball', newSpell: 'Burning Hands' });
  check(!wNotPrep.ok && wNotPrep.error.includes('not prepared'), 'swapping out a spell that is not prepared refuses');
  const wNotBook = applyMemorizeSwap({ preparedList: prepared, bookList: book, oldSpell: 'Sleep', newSpell: 'Fireball' });
  check(!wNotBook.ok && wNotBook.error.includes('not in the spellbook'), 'swapping in a spell outside the book refuses');
  const wAlready = applyMemorizeSwap({ preparedList: prepared, bookList: book, oldSpell: 'Sleep', newSpell: 'Shield' });
  check(!wAlready.ok && wAlready.error.includes('already prepared'), 'swapping in a spell already prepared refuses');
  const wSame = applyMemorizeSwap({ preparedList: prepared, bookList: book, oldSpell: 'Sleep', newSpell: 'Sleep' });
  check(!wSame.ok && wSame.error.includes('same spell'), 'swapping a spell for itself refuses');
  const wAlways = applyMemorizeSwap({ preparedList: ['Fireball', 'Shield'], bookList: book, oldSpell: 'Fireball', newSpell: 'Sleep', alwaysPreparedList: ['Fireball'] });
  check(!wAlways.ok && wAlways.error.includes('always prepared'), 'an always-prepared pick cannot be swapped out');
  const wMissing = applyMemorizeSwap({ preparedList: prepared, bookList: book, oldSpell: '', newSpell: 'Sleep' });
  check(!wMissing.ok && wMissing.error.includes('oldSpell is required'), 'a missing oldSpell refuses');
  const wCantripBook = applyMemorizeSwap({ preparedList: prepared, bookList: [...book, 'Fire Bolt'], oldSpell: 'Sleep', newSpell: 'Fire Bolt' });
  check(!wCantripBook.ok && wCantripBook.error.includes('cantrip'), 'a cantrip in the book still cannot be swapped in as prepared');
}

// ===========================================================================
// (j) Stage 4 validator (real validateCreatorNextStage4): the 6-book
// ===========================================================================
group('(j) Stage 4 wizard book');
{
  // Half-elf Mark of Detection / sage wizard, Int 18 -> prepares 5.
  // Detect Magic is granted for this mark and must NOT appear in
  // either list; Alarm is the 5th prepared pick. (Same fixture as
  // creator-next-stage4's markWizardBody.)
  const MARK_BASE = { str: 8, dex: 13, con: 12, int: 15, wis: 14, cha: 10 };
  const MARK_FINAL = { str: 8, dex: 13, con: 12, int: 18, wis: 17, cha: 10 };
  const MARK_PREPARED = ['magic missile', 'shield', 'mage armor', 'sleep', 'alarm'];
  function markWizardBody(overrides = {}) {
    return {
      creator: 'creator-next', class: 'wizard', race: 'half-elf', subrace: 'Mark of Detection',
      theme_id: 'sage', generation_method: 'point_buy',
      base_scores: MARK_BASE, ability_choice_picks: { int: 1 }, ability_scores: MARK_FINAL,
      skills: ['Arcana', 'History', 'Investigation'],
      languages: ['Common', 'Elvish', 'Dwarvish'],
      prepared_spells: MARK_PREPARED,
      ...overrides,
    };
  }
  const errText = (r) => (r.errors || []).join(' | ');
  const has = (r, field) => (r.errors || []).some((e) => e.startsWith(`${field}:`));

  const valid = validateCreatorNextStage4(markWizardBody({ known_spells: [...MARK_PREPARED, 'burning hands'] }));
  check(valid.ok === true, `a 6-spell book holding the prepared 5 passes Stage 4 (${errText(valid)})`);
  const bookless = validateCreatorNextStage4(markWizardBody());
  check(bookless.ok === true && !has(bookless, 'knownSpells'),
    'a wizard draft with prepared spells but no book is draft-tolerant at Stage 4 (the commit refuses it, not the draft save)');
  const short = validateCreatorNextStage4(markWizardBody({ known_spells: MARK_PREPARED }));
  check(short.ok === false && has(short, 'knownSpells') && errText(short).includes('6'),
    `a 5-spell book refuses naming knownSpells and the count 6 (${errText(short)})`);
  const outside = validateCreatorNextStage4(markWizardBody({
    known_spells: ['magic missile', 'shield', 'mage armor', 'sleep', 'grease', 'burning hands'],
  }));
  check(outside.ok === false && has(outside, 'preparedSpells') && errText(outside).includes('not in the spellbook'),
    `a prepared spell outside the book refuses (${errText(outside)})`);
  const granted = validateCreatorNextStage4(markWizardBody({ known_spells: [...MARK_PREPARED, 'detect magic'] }));
  check(granted.ok === false && has(granted, 'knownSpells') && errText(granted).includes('already granted'),
    `a granted spell in the book refuses (${errText(granted)})`);
  const cantripBook = validateCreatorNextStage4(markWizardBody({ known_spells: [...MARK_PREPARED, 'fire bolt'] }));
  check(cantripBook.ok === false && has(cantripBook, 'knownSpells') && errText(cantripBook).includes('cantrip'),
    `a cantrip in the book refuses (${errText(cantripBook)})`);
  const cantripPrep = validateCreatorNextStage4(markWizardBody({
    known_spells: [...MARK_PREPARED, 'burning hands'],
    prepared_spells: ['magic missile', 'shield', 'mage armor', 'sleep', 'fire bolt'],
  }));
  check(cantripPrep.ok === false && has(cantripPrep, 'preparedSpells') && errText(cantripPrep).includes('cantrip'),
    `a cantrip in the prepared list refuses (${errText(cantripPrep)})`);
  const nonWiz = validateCreatorNextStage4(markWizardBody({ class: 'cleric', known_spells: ['bless'] }));
  check(nonWiz.ok === false && has(nonWiz, 'knownSpells') && errText(nonWiz).includes('prepares spells instead of knowing them'),
    'the wizard branch does not leak into other prepared casters');
}

// ===========================================================================
// (k) Stage 6 validator (real validateCreatorNextStage6): commit refusal
// ===========================================================================
group('(k) Stage 6 commit completeness');
{
  const MARK_BASE = { str: 8, dex: 13, con: 12, int: 15, wis: 14, cha: 10 };
  const MARK_FINAL = { str: 8, dex: 13, con: 12, int: 18, wis: 17, cha: 10 };
  const MARK_PREPARED = ['magic missile', 'shield', 'mage armor', 'sleep', 'alarm'];
  function markWizardMerged(overrides = {}) {
    return {
      creator: 'creator-next', name: 'Test Wizard', first_name: 'Test', gender: 'Female',
      class: 'wizard', race: 'half-elf', subrace: 'Mark of Detection',
      theme_id: 'sage', generation_method: 'point_buy',
      base_scores: MARK_BASE, ability_choice_picks: { int: 1 }, ability_scores: MARK_FINAL,
      skills: ['Arcana', 'History', 'Investigation'],
      languages: ['Common', 'Elvish', 'Dwarvish'],
      prepared_spells: MARK_PREPARED,
      gear_choice: 'gold',
      ...overrides,
    };
  }
  const hasBookError = (r) => (r.errors || []).some((e) => e.startsWith('knownSpells:') && e.includes('spellbook'));
  const bookless = await validateCreatorNextStage6(markWizardMerged());
  check(hasBookError(bookless), `commit of a bookless wizard draft refuses with the spellbook error (${(bookless.errors || []).join(' | ')})`);
  check((bookless.errors || []).some((e) => e.includes('never auto-filled')), 'the refusal says the book is never auto-filled');
  const withBook = await validateCreatorNextStage6(markWizardMerged({ known_spells: [...MARK_PREPARED, 'burning hands'] }));
  check(!hasBookError(withBook), `commit with a 6-spell book has no spellbook error (${(withBook.errors || []).join(' | ')})`);
  const noPrep = await validateCreatorNextStage6(markWizardMerged({ prepared_spells: [] }));
  check(!hasBookError(noPrep), 'empty prepared + empty book still passes the book check (same tolerance as other casters)');
}

// ===========================================================================
// (l) DM prompt (real createDMSystemPrompt): Spellbook relabel
// ===========================================================================
group('(l) DM prompt spellbook lines');
{
  function makeCharacter(overrides = {}) {
    return {
      name: 'TEST Hero', first_name: 'TEST', race: 'Human', class: 'Fighter', level: 5,
      hp: 45, max_hp: 45, ac: 16, gender: 'male', game_day: 100, game_hour: 10,
      ability_scores: { str: 16, dex: 14, con: 14, int: 10, wis: 12, cha: 8 },
      inventory: [], skills: [], feats: [], known_cantrips: [], known_spells: [],
      prepared_spells: [], equipment: {}, ...overrides,
    };
  }
  function makeSessionContext(overrides = {}) {
    return {
      companions: [], awayCompanions: [],
      worldState: {
        npcRelationships: [], npcEventEffects: [], currentGameDay: 100,
        factionStandings: [], visibleEvents: [], discoveredLocations: [], activeFactions: [],
      },
      campaignPlanSummary: { setting: 'Forgotten Realms', tone: 'heroic' },
      previousSessionSummaries: [], characterMemories: '', campaignNotes: '',
      continueCampaign: false, pendingDowntimeNarratives: [], ...overrides,
    };
  }
  const BOOK8 = ['Magic Missile', 'Shield', 'Mage Armor', 'Sleep', 'Burning Hands', 'Thunderwave', 'Detect Magic', 'Feather Fall'];
  const wizPrompt = createDMSystemPrompt(makeCharacter({
    class: 'wizard', level: 5, known_spells: BOOK8,
    prepared_spells: ['Shield', 'Mage Armor', 'Sleep', 'Burning Hands'],
    spellbook_json: '{}',
  }), makeSessionContext());
  check(wizPrompt.includes('Spellbook (8):'), 'a wizard book prints as "Spellbook (8)"');
  check(!wizPrompt.includes('Known Spells:'), 'a wizard book is NOT mislabeled "Known Spells"');
  const clericPrompt = createDMSystemPrompt(makeCharacter({
    class: 'cleric', level: 5, known_spells: ['Bless', 'Cure Wounds'],
    prepared_spells: ['Bless', 'Cure Wounds'],
  }), makeSessionContext());
  check(clericPrompt.includes('Known Spells:'), 'a non-wizard still prints "Known Spells"');
  check(!clericPrompt.includes('Spellbook ('), 'a non-wizard prints no Spellbook line');
  const lostPrompt = createDMSystemPrompt(makeCharacter({
    class: 'wizard', level: 5, known_spells: BOOK8, prepared_spells: ['Shield'],
    spellbook_json: JSON.stringify({ status: 'lost', mastery: [], signature: [] }),
  }), makeSessionContext());
  check(lostPrompt.includes('Spellbook: LOST'), 'a lost book prints the LOST line');
  check(lostPrompt.includes('cannot be changed'), 'the LOST line says prepared spells cannot be changed');
  const masteryPrompt = createDMSystemPrompt(makeCharacter({
    class: 'wizard', level: 18, known_spells: BOOK8, prepared_spells: ['Shield'],
    class_levels: JSON.stringify([{ class: 'wizard', level: 18 }]),
    spellbook_json: JSON.stringify({ status: 'intact', mastery: ['Fireball', 'Counterspell'], signature: [] }),
  }), makeSessionContext());
  check(masteryPrompt.includes('Spell Mastery (always prepared): Fireball, Counterspell'),
    'Mastery picks print at L18');
  const gatedPrompt = createDMSystemPrompt(makeCharacter({
    class: 'wizard', level: 5, known_spells: BOOK8, prepared_spells: ['Shield'],
    spellbook_json: JSON.stringify({ status: 'intact', mastery: ['Fireball'], signature: [] }),
  }), makeSessionContext());
  check(!gatedPrompt.includes('Spell Mastery (always prepared):'), 'Mastery picks stored below L18 do NOT print as prepared');
  check(gatedPrompt.includes('below their level gate'), 'below-gate picks print the inert note instead');
  const sigPrompt = createDMSystemPrompt(makeCharacter({
    class: 'wizard', level: 20, known_spells: BOOK8, prepared_spells: ['Shield'],
    class_levels: JSON.stringify([{ class: 'wizard', level: 20 }]),
    spellbook_json: JSON.stringify({ status: 'intact', mastery: ['Fireball', 'Counterspell'], signature: ['Wish', 'Meteor Swarm'] }),
  }), makeSessionContext());
  check(sigPrompt.includes('Signature Spells (always prepared): Wish, Meteor Swarm'),
    'Signature picks print at L20');
  // Fighter-primary wizard (2026-11-08 follow-ups, D1): the
  // spellbook lines gate on wizard LEVELS now, not on the primary
  // class — a fighter 5 / wizard 1 gets the book, the LOST line,
  // and the Spellbook (N) label in the DM prompt.
  const multiPrompt = createDMSystemPrompt(makeCharacter({
    class: 'fighter', level: 6, known_spells: BOOK8,
    prepared_spells: ['Shield', 'Mage Armor', 'Sleep', 'Burning Hands'],
    class_levels: JSON.stringify([{ class: 'fighter', level: 5 }, { class: 'wizard', level: 1 }]),
    spellbook_json: '{}',
  }), makeSessionContext());
  check(multiPrompt.includes('Spellbook (8):'), 'a fighter-primary wizard still gets the Spellbook (N) line');
  check(!multiPrompt.includes('Known Spells:'), 'a fighter-primary wizard book is NOT mislabeled "Known Spells"');
  const multiLostPrompt = createDMSystemPrompt(makeCharacter({
    class: 'fighter', level: 6, known_spells: BOOK8, prepared_spells: ['Shield'],
    class_levels: JSON.stringify([{ class: 'fighter', level: 5 }, { class: 'wizard', level: 1 }]),
    spellbook_json: JSON.stringify({ status: 'lost', mastery: [], signature: [] }),
  }), makeSessionContext());
  check(multiLostPrompt.includes('Spellbook: LOST'), 'a fighter-primary wizard with a lost book gets the LOST line');
  const noWizPrompt = createDMSystemPrompt(makeCharacter({
    class: 'fighter', level: 5, known_spells: ['Bless', 'Cure Wounds'],
    prepared_spells: ['Bless', 'Cure Wounds'],
    class_levels: JSON.stringify([{ class: 'fighter', level: 5 }]),
  }), makeSessionContext());
  check(!noWizPrompt.includes('Spellbook ('), 'a fighter with no wizard levels prints no Spellbook line');
  check(noWizPrompt.includes('Known Spells:'), 'a fighter with no wizard levels still prints "Known Spells"');
}

// ===========================================================================
// (m) Spells envelope (real /api/spells): spellbookSize for wizards only
// ===========================================================================
group('(m) /api/spells spellbookSize');
{
  const w1 = await getApi('/api/spells?class=wizard&level=1');
  check(w1.status === 200 && w1.json?.spellbookSize === 6, `wizard L1 envelope has spellbookSize 6 (got ${w1.status}: ${JSON.stringify(w1.json?.spellbookSize)})`);
  const w5 = await getApi('/api/spells?class=wizard&level=5');
  check(w5.status === 200 && w5.json?.spellbookSize === 14, `wizard L5 envelope has spellbookSize 14 (got ${JSON.stringify(w5.json?.spellbookSize)})`);
  const w20 = await getApi('/api/spells?class=wizard&level=20');
  check(w20.status === 200 && w20.json?.spellbookSize === 44, `wizard L20 envelope has spellbookSize 44 (got ${JSON.stringify(w20.json?.spellbookSize)})`);
  check(w5.json?.spellsKnown === null, 'spellsKnown stays null for wizard — the client uses null to mean "prepared caster", the book count rides its own field');
  const c5 = await getApi('/api/spells?class=cleric&level=5');
  check(c5.status === 200 && c5.json?.spellbookSize === null, 'a non-wizard envelope has spellbookSize null');
  const b1 = await getApi('/api/spells?class=bard&level=1');
  check(b1.status === 200 && b1.json?.spellbookSize === null, 'a bard envelope has spellbookSize null');
}

// ===========================================================================
// (n) Replace cost + backup / replaced state (replacement build, 2026-11-07)
// ===========================================================================
group('(n) replace cost + backup / replaced state');
{
  // The replace rate is 1h + 10 gp per spell level — a DIFFERENT rate
  // from copying a new spell in (2h + 50 gp); the two must never be conflated.
  check(REPLACE_GOLD_PER_SPELL_LEVEL === 10 && REPLACE_HOURS_PER_SPELL_LEVEL === 1, 'replace constants are 10 gp / 1h per level');
  check(replaceCostForSpellLevel(1)?.gold === 10 && replaceCostForSpellLevel(1)?.hours === 1, 'replacing a L1 spell costs 10 gp + 1h');
  check(replaceCostForSpellLevel(3)?.gold === 30 && replaceCostForSpellLevel(3)?.hours === 3, 'replacing a L3 spell costs 30 gp + 3h');
  check(replaceCostForSpellLevel(9)?.gold === 90 && replaceCostForSpellLevel(9)?.hours === 9, 'replacing a L9 spell costs 90 gp + 9h');
  check(replaceCostForSpellLevel(0) === null, 'a cantrip has no replace cost — null, the route refuses it');
  check(replaceCostForSpellLevel(-1) === null && replaceCostForSpellLevel('x') === null, 'replace cost of an invalid level is null');
  // The recon worked example: L5 wizard, 9 prepared at levels
  // 1,1,1,1,2,2,2,3,3 (sum 16) -> 160 gp + 16h. Levels come from
  // the real catalog here, not literals.
  const prepared9 = ['Magic Missile', 'Shield', 'Mage Armor', 'Sleep', 'Misty Step', 'Scorching Ray', 'Darkness', 'Fireball', 'Counterspell'];
  const levels9 = prepared9.map((n) => Number(cat(n).level));
  check(JSON.stringify(levels9) === JSON.stringify([1, 1, 1, 1, 2, 2, 2, 3, 3]), 'catalog levels for the 9 prepared spells are 1,1,1,1,2,2,2,3,3');
  const batch = replaceCostForSpells(levels9);
  check(batch?.gold === 160 && batch?.hours === 16, 'the 9-spell batch costs 160 gp + 16h');
  check(replaceCostForSpells([])?.gold === 0 && replaceCostForSpells([])?.hours === 0, 'an empty batch costs nothing');
  check(replaceCostForSpells([1, 0]) === null && replaceCostForSpells('x') === null, 'a batch with a bad level (or a non-list) is null');
  // Copy constants untouched by the new rate.
  check(COPY_GOLD_PER_SPELL_LEVEL === 50 && COPY_HOURS_PER_SPELL_LEVEL === 2, 'copy constants are still 50 gp / 2h per level');

  // Blank-book price table (2026-11-08 follow-ups, D4/D5): five
  // fixed tiers, chosen by KEY — the client sends only the key,
  // the server derives the price. The standard spellbook is 50 gp.
  // There is no free-form price and no waived tier.
  check(STANDARD_SPELLBOOK_COST_GP === 50, 'the standard blank spellbook costs 50 gp');
  check(JSON.stringify(Object.keys(SPELLBOOK_MATERIALS)) === JSON.stringify(['vellum', 'standard', 'fine-leather', 'gilt-edged', 'dragonhide']),
    "the materials table has exactly Zach's five tiers, in order");
  check(SPELLBOOK_MATERIALS.vellum.cost === 25 && SPELLBOOK_MATERIALS.vellum.label === 'Vellum bound with twine', 'vellum is 25 gp');
  check(SPELLBOOK_MATERIALS.standard.cost === 50 && SPELLBOOK_MATERIALS.standard.label === 'Standard spellbook', 'standard is 50 gp');
  check(SPELLBOOK_MATERIALS['fine-leather'].cost === 100 && SPELLBOOK_MATERIALS['fine-leather'].label === 'Fine leather-bound', 'fine leather is 100 gp');
  check(SPELLBOOK_MATERIALS['gilt-edged'].cost === 250 && SPELLBOOK_MATERIALS['gilt-edged'].label === 'Gilt-edged tome', 'gilt-edged is 250 gp');
  check(SPELLBOOK_MATERIALS.dragonhide.cost === 500 && SPELLBOOK_MATERIALS.dragonhide.label === 'Dragonhide-bound',
    'dragonhide is 500 gp — not 200, and there is no waived tier');
  check(parseBookMaterialsParam(undefined).materials === 'standard' && parseBookMaterialsParam(undefined).cost === 50 && parseBookMaterialsParam(undefined).provided === false,
    'an absent materials key defaults to standard at 50 gp');
  check(parseBookMaterialsParam(null).materials === 'standard', 'a null materials key defaults too');
  check(parseBookMaterialsParam('  ').materials === 'standard', 'a blank materials key defaults too');
  check(parseBookMaterialsParam('dragonhide').materials === 'dragonhide' && parseBookMaterialsParam('dragonhide').cost === 500 && parseBookMaterialsParam('dragonhide').provided === true,
    'a dragonhide key parses to its 500 gp table price');
  check(parseBookMaterialsParam('vellum').cost === 25 && parseBookMaterialsParam('gilt-edged').cost === 250,
    'every tier key parses to its table price');
  check(parseBookMaterialsParam(' dragonhide ').materials === 'dragonhide', 'materials keys are trimmed');
  check(!parseBookMaterialsParam('unicorn-hide').ok && parseBookMaterialsParam('unicorn-hide').error.includes('unicorn-hide'),
    'an unknown materials key refuses naming the key');
  check(!parseBookMaterialsParam(7).ok && parseBookMaterialsParam(7).error.includes('bookMaterials'),
    'non-text materials refuse naming bookMaterials');
  // The cost + materials ride spellbook_json, present only while
  // set — the blank state keeps its exact old shape, and a stored
  // 0 gp cost survives parse (0 is a charge, not an absence).
  const withBookCost = { status: 'intact', mastery: [], signature: [], bookCost: 50, bookMaterials: 'dragonhide-bound' };
  check(JSON.stringify(parseSpellbookState(serializeSpellbookState(withBookCost))) === JSON.stringify(withBookCost),
    'book cost + materials round-trip through serialize + parse');
  check(parseSpellbookState({ bookCost: 0 }).bookCost === 0, 'a stored 0 gp book cost survives parse');
  check(parseSpellbookState({ bookCost: -5 }).bookCost === undefined, 'a negative stored book cost is dropped');
  check(parseSpellbookState({ bookCost: '50' }).bookCost === undefined, 'a string stored book cost is dropped (numbers only)');
  check(parseSpellbookState({ bookMaterials: '  ' }).bookMaterials === undefined, 'blank stored materials parse to no key');
  const flippedBook = serializeSpellbookState({ ...parseSpellbookState(serializeSpellbookState(withBookCost)), status: 'lost' });
  check(parseSpellbookState(flippedBook).bookCost === 50 && parseSpellbookState(flippedBook).bookMaterials === 'dragonhide-bound',
    'flipping status to lost preserves the book cost + materials');

  // Backup key: carried through parse/serialize, cleaned like
  // mastery/signature, present only while non-empty — the blank
  // state keeps its exact old shape.
  const blank = { status: 'intact', mastery: [], signature: [] };
  check(JSON.stringify(parseSpellbookState(null)) === JSON.stringify(blank), 'parse(null) still has no backup key');
  const withBackup = { status: 'intact', mastery: [], signature: [], backup: ['Fireball', 'Counterspell'] };
  check(JSON.stringify(parseSpellbookState(serializeSpellbookState(withBackup))) === JSON.stringify(withBackup),
    'a backup round-trips through serialize + parse');
  check(JSON.stringify(parseSpellbookState({ backup: [' Fireball ', 7, null, ''] }).backup) === JSON.stringify(['Fireball']),
    'parse trims backup names and drops non-string/empty entries');
  check(parseSpellbookState({ backup: [] }).backup === undefined, 'an empty backup parses to no key');
  check(parseSpellbookState({ backup: 'Fireball' }).backup === undefined, 'a non-array backup parses to no key');
  // A backup survives a status flip (spread + serialize, the same
  // guarantee the bank relies on).
  const flipped = serializeSpellbookState({ ...parseSpellbookState(serializeSpellbookState(withBackup)), status: 'lost' });
  check(JSON.stringify(parseSpellbookState(flipped).backup) === JSON.stringify(['Fireball', 'Counterspell']),
    'flipping status to lost preserves the backup');
  // The bank and the backup ride together (compared field-wise —
  // JSON key order differs from the fixture literal, so a whole-
  // object stringify would fail on order alone).
  const both = { status: 'lost', mastery: [], signature: [], backup: ['Fireball'], pendingMemorizeSwap: { oldSpell: 'Sleep', newSpell: 'Misty Step' } };
  const bothParsed = parseSpellbookState(serializeSpellbookState(both));
  check(JSON.stringify(bothParsed.backup) === JSON.stringify(['Fireball'])
    && JSON.stringify(bothParsed.pendingMemorizeSwap) === JSON.stringify({ oldSpell: 'Sleep', newSpell: 'Misty Step' })
    && bothParsed.status === 'lost',
    'a backup and a bank round-trip together');
  // Replacement marker: only the two real values survive parse.
  check(parseSpellbookState({ replaced: 'prepared' }).replaced === 'prepared', "replaced 'prepared' parses through");
  check(parseSpellbookState({ replaced: 'backup' }).replaced === 'backup', "replaced 'backup' parses through");
  check(parseSpellbookState({ replaced: 'yes' }).replaced === undefined, 'an unknown replaced value is dropped');
  check(parseSpellbookState({}).replaced === undefined, 'no replaced key by default');
}

// ===========================================================================
// (o) DM prompt backup + replaced lines
// ===========================================================================
group('(o) DM prompt backup + replaced lines');
{
  function makeCharacter(overrides = {}) {
    return {
      name: 'TEST Hero', first_name: 'TEST', race: 'Human', class: 'Fighter', level: 5,
      hp: 45, max_hp: 45, ac: 16, gender: 'male', game_day: 100, game_hour: 10,
      ability_scores: { str: 16, dex: 14, con: 14, int: 10, wis: 12, cha: 8 },
      inventory: [], skills: [], feats: [], known_cantrips: [], known_spells: [],
      prepared_spells: [], equipment: {}, ...overrides,
    };
  }
  function makeSessionContext(overrides = {}) {
    return {
      companions: [], awayCompanions: [],
      worldState: {
        npcRelationships: [], npcEventEffects: [], currentGameDay: 100,
        factionStandings: [], visibleEvents: [], discoveredLocations: [], activeFactions: [],
      },
      campaignPlanSummary: { setting: 'Forgotten Realms', tone: 'heroic' },
      previousSessionSummaries: [], characterMemories: '', campaignNotes: '',
      continueCampaign: false, pendingDowntimeNarratives: [], ...overrides,
    };
  }
  const BOOK8 = ['Magic Missile', 'Shield', 'Mage Armor', 'Sleep', 'Burning Hands', 'Thunderwave', 'Detect Magic', 'Feather Fall'];
  const backupPrompt = createDMSystemPrompt(makeCharacter({
    class: 'wizard', level: 5, known_spells: BOOK8,
    prepared_spells: ['Shield', 'Mage Armor', 'Sleep', 'Burning Hands'],
    spellbook_json: JSON.stringify({ status: 'intact', mastery: [], signature: [], backup: ['Fireball', 'Counterspell', 'Misty Step'] }),
  }), makeSessionContext());
  check(backupPrompt.includes('Backup spellbook (3): Fireball, Counterspell, Misty Step'), 'a backup prints its size and contents');
  const noBackupPrompt = createDMSystemPrompt(makeCharacter({
    class: 'wizard', level: 5, known_spells: BOOK8, prepared_spells: ['Shield'],
    spellbook_json: '{}',
  }), makeSessionContext());
  check(!noBackupPrompt.includes('Backup spellbook'), 'no backup prints no backup line');
  const replacedPrompt = createDMSystemPrompt(makeCharacter({
    class: 'wizard', level: 5, known_spells: BOOK8, prepared_spells: ['Shield'],
    spellbook_json: JSON.stringify({ status: 'intact', mastery: [], signature: [], replaced: 'prepared' }),
  }), makeSessionContext());
  check(replacedPrompt.includes('Spellbook: REPLACED — re-transcribed from prepared spells'), 'a transcribed replacement prints the REPLACED line');
  check(replacedPrompt.includes('Spellbook (8):'), 'the REPLACED line sits beside the Spellbook (N) line, not instead of it');
  const backupReplacedPrompt = createDMSystemPrompt(makeCharacter({
    class: 'wizard', level: 5, known_spells: BOOK8, prepared_spells: ['Shield'],
    spellbook_json: JSON.stringify({ status: 'intact', mastery: [], signature: [], replaced: 'backup' }),
  }), makeSessionContext());
  check(backupReplacedPrompt.includes('Spellbook: REPLACED — restored from the backup spellbook'), 'a backup restore prints the REPLACED line');
  const plainPrompt = createDMSystemPrompt(makeCharacter({
    class: 'wizard', level: 5, known_spells: BOOK8, prepared_spells: ['Shield'],
    spellbook_json: '{}',
  }), makeSessionContext());
  check(!plainPrompt.includes('REPLACED'), 'a never-replaced book prints no REPLACED line');
  // V5: a book with a stored cost/materials prints them (beside the
  // REPLACED line when there is one); a book with neither stored
  // prints no materials line.
  const materialsPrompt = createDMSystemPrompt(makeCharacter({
    class: 'wizard', level: 5, known_spells: BOOK8, prepared_spells: ['Shield'],
    spellbook_json: JSON.stringify({ status: 'intact', mastery: [], signature: [], replaced: 'prepared', bookCost: 50, bookMaterials: 'dragonhide-bound, gold-leafed pages' }),
  }), makeSessionContext());
  check(materialsPrompt.includes('Spellbook materials: dragonhide-bound, gold-leafed pages, 50 gp'),
    'a replaced book prints its materials + blank-book price');
  // D6: a stored table KEY prints its label, not the bare key —
  // the legacy free-text row above still prints verbatim.
  const keyPrompt = createDMSystemPrompt(makeCharacter({
    class: 'wizard', level: 5, known_spells: BOOK8, prepared_spells: ['Shield'],
    spellbook_json: JSON.stringify({ status: 'intact', mastery: [], signature: [], replaced: 'prepared', bookCost: 500, bookMaterials: 'dragonhide' }),
  }), makeSessionContext());
  check(keyPrompt.includes('Spellbook materials: Dragonhide-bound, 500 gp'),
    'a stored materials KEY prints the table label + price');
  const costOnlyPrompt = createDMSystemPrompt(makeCharacter({
    class: 'wizard', level: 5, known_spells: BOOK8, prepared_spells: ['Shield'],
    spellbook_json: JSON.stringify({ status: 'lost', mastery: [], signature: [], bookCost: 200 }),
  }), makeSessionContext());
  check(costOnlyPrompt.includes('Spellbook materials: 200 gp'),
    'a book cost with no materials still prints (a subset replacement in progress)');
  check(!plainPrompt.includes('Spellbook materials'), 'a book with no stored cost prints no materials line');
}

// ===========================================================================
// (p) Arcane Recovery — budget, bank validation, maxima (2026-11-08)
// ===========================================================================
group('(p) Arcane Recovery budget + apply');
{
  // Budget: ceil(wizard level / 2) — L1 → 1, L5 → 3, L10 → 5, L20 → 10.
  for (const [level, want] of [[1, 1], [2, 1], [3, 2], [4, 2], [5, 3], [6, 3], [10, 5], [11, 6], [19, 10], [20, 10]]) {
    check(arcaneRecoveryBudget(level) === want, `Arcane Recovery budget at wizard L${level} is ${want} (got ${arcaneRecoveryBudget(level)})`);
  }
  check(arcaneRecoveryBudget(0) === 0 && arcaneRecoveryBudget(null) === 0 && arcaneRecoveryBudget('x') === 0,
    'an invalid wizard level has budget 0 — never a recovery');

  // Maxima: single-class is the wizard table; multiclass is the
  // shared multiclass caster table (a wizard 5 / fighter 5 has the
  // L5 table, not the total-level L10 table).
  check(JSON.stringify(arcaneRecoveryMaxSlots(null, 5)) === JSON.stringify({ 1: 4, 2: 3, 3: 2 }),
    'single-class wizard L5 maxima are the wizard table (4/3/2)');
  check(JSON.stringify(arcaneRecoveryMaxSlots(null, 1)) === JSON.stringify({ 1: 2 }),
    'single-class wizard L1 maxima are 2 first-level slots');
  check(JSON.stringify(arcaneRecoveryMaxSlots([{ class: 'wizard', level: 5 }, { class: 'fighter', level: 5 }], 5)) === JSON.stringify({ 1: 4, 2: 3, 3: 2 }),
    'wizard 5 / fighter 5 maxima are the L5 table, not the total-level L10 table (4/3/3/3/2)');
  check(JSON.stringify(arcaneRecoveryMaxSlots([{ class: 'wizard', level: 3 }, { class: 'fighter', level: 5 }], 3)) === JSON.stringify({ 1: 4, 2: 2 }),
    'wizard 3 / fighter 5 maxima are the L3 table (4/2)');
  check(JSON.stringify(arcaneRecoveryMaxSlots(JSON.stringify([{ class: 'wizard', level: 5 }, { class: 'fighter', level: 5 }]), 5)) === JSON.stringify({ 1: 4, 2: 3, 3: 2 }),
    'a JSON-string class_levels parses the same way');

  // applyArcaneRecovery: happy path + every refusal, in order.
  const used = { '1': 2, '2': 1 };
  const max = { 1: 4, 2: 3, 3: 2 };
  const happy = applyArcaneRecovery({ usedSlots: used, maxSlots: max, bankedLevels: [2, 1], budget: 3 });
  check(happy.ok && JSON.stringify(happy.usedSlots) === JSON.stringify({ '1': 1 }),
    'recovering [2, 1] from {1: 2, 2: 1} leaves {1: 1}');
  check(JSON.stringify(used) === JSON.stringify({ '1': 2, '2': 1 }),
    'the apply is pure — the input used map is not mutated');
  const dropZero = applyArcaneRecovery({ usedSlots: { '1': 1 }, maxSlots: max, bankedLevels: [1], budget: 3 });
  check(dropZero.ok && JSON.stringify(dropZero.usedSlots) === JSON.stringify({}),
    'a level that hits 0 used is dropped from the map (absent = 0 used)');
  const keepZero = applyArcaneRecovery({ usedSlots: { '1': 1, '3': 0 }, maxSlots: max, bankedLevels: [1], budget: 3 });
  check(keepZero.ok && JSON.stringify(keepZero.usedSlots) === JSON.stringify({ '3': 0 }),
    'an untouched 0-valued key passes through as stored');
  const empty = applyArcaneRecovery({ usedSlots: used, maxSlots: max, bankedLevels: [], budget: 3 });
  check(!empty.ok && empty.error.includes('no slots banked'), 'an empty bank refuses');
  const over = applyArcaneRecovery({ usedSlots: { '1': 4, '2': 3 }, maxSlots: max, bankedLevels: [2, 2], budget: 3 });
  check(!over.ok && over.error.includes('over the budget'),
    'over-budget refuses, never trims — [2, 2] totals 4 against a budget of 3');
  const exact = applyArcaneRecovery({ usedSlots: { '1': 2, '2': 1 }, maxSlots: max, bankedLevels: [2, 1], budget: 3 });
  check(exact.ok, 'a bank totalling exactly the budget applies');
  const sixth = applyArcaneRecovery({ usedSlots: { '6': 1 }, maxSlots: { 6: 1 }, bankedLevels: [6], budget: 6 });
  check(!sixth.ok && sixth.error.includes('6th level or higher'), 'a 6th-level slot refuses');
  const ninth = applyArcaneRecovery({ usedSlots: { '9': 1 }, maxSlots: { 9: 1 }, bankedLevels: [9], budget: 10 });
  check(!ninth.ok && ninth.error.includes('6th level or higher'), 'a 9th-level slot refuses too');
  const unspent = applyArcaneRecovery({ usedSlots: { '1': 1 }, maxSlots: max, bankedLevels: [2], budget: 3 });
  check(!unspent.ok && unspent.error.includes('is spent'), 'an unspent level refuses');
  const partlySpent = applyArcaneRecovery({ usedSlots: { '1': 1 }, maxSlots: max, bankedLevels: [1, 1], budget: 3 });
  check(!partlySpent.ok && partlySpent.error.includes('is spent'),
    'recovering two 1st-level slots when only one is spent refuses — the whole bank, not one slot');
  const aboveMax = applyArcaneRecovery({ usedSlots: { '1': 2 }, maxSlots: { 1: 1 }, bankedLevels: [1, 1], budget: 3 });
  check(!aboveMax.ok && aboveMax.error.includes('at most 1'),
    'recovering more slots of a level than the character has refuses');
  // Order pin: an over-budget bank that ALSO names an unspent level
  // refuses on budget first.
  const order = applyArcaneRecovery({ usedSlots: { '1': 1 }, maxSlots: max, bankedLevels: [2, 2], budget: 3 });
  check(!order.ok && order.error.includes('over the budget'), 'budget is checked before spent (order pin)');
}

// ===========================================================================
// (q) Pact-slot scoped reset — warlock level + reset math (2026-11-08 follow-ups, D2)
// ===========================================================================
group('(q) pact-slot scoped reset');
{
  // Pact slots come from the real WARLOCK_SPELL_SLOTS table, via
  // the same lookup getMulticlassSpellSlots consults.
  check(JSON.stringify(pactSlotsForWarlockLevel(1)) === JSON.stringify({ slots: 1, level: 1 }), 'warlock L1 has 1x L1 pact slot');
  check(JSON.stringify(pactSlotsForWarlockLevel(2)) === JSON.stringify({ slots: 2, level: 1 }), 'warlock L2 has 2x L1 pact slots');
  check(JSON.stringify(pactSlotsForWarlockLevel(3)) === JSON.stringify({ slots: 2, level: 2 }), 'warlock L3 has 2x L2 pact slots');
  check(JSON.stringify(pactSlotsForWarlockLevel(5)) === JSON.stringify({ slots: 2, level: 3 }), 'warlock L5 has 2x L3 pact slots');
  check(JSON.stringify(pactSlotsForWarlockLevel(11)) === JSON.stringify({ slots: 3, level: 5 }), 'warlock L11 has 3x L5 pact slots');
  check(JSON.stringify(pactSlotsForWarlockLevel(17)) === JSON.stringify({ slots: 4, level: 5 }), 'warlock L17 has 4x L5 pact slots');
  check(pactSlotsForWarlockLevel(0) === null && pactSlotsForWarlockLevel(null) === null && pactSlotsForWarlockLevel(21) === null,
    'an invalid warlock level has no pact slots');
  // Warlock level reads from class_levels, bare keys only.
  check(warlockLevelFromClassLevels([{ class: 'warlock', level: 3 }, { class: 'wizard', level: 3 }]) === 3,
    'warlock level reads from a class_levels entry');
  check(warlockLevelFromClassLevels(JSON.stringify([{ class: 'fighter', level: 5 }, { class: 'warlock', level: 1 }])) === 1,
    'a JSON-string class_levels parses the same way');
  check(warlockLevelFromClassLevels([{ class: 'wizard', level: 5 }]) === null,
    'no warlock entry means no warlock level');
  check(warlockLevelFromClassLevels(null) === null && warlockLevelFromClassLevels('x') === null,
    'an absent or unparseable class_levels means no warlock level');
  // resetPactSlots: zeroes the pact COUNT at the pact level only.
  check(JSON.stringify(resetPactSlots({ '1': 2, '2': 1, '3': 2 }, 5)) === JSON.stringify({ '1': 2, '2': 1 }),
    'warlock 5 zeroes the 2x L3 pact slots and leaves the L1/L2 slots spent (recon example 1)');
  check(JSON.stringify(resetPactSlots({ '1': 1 }, 1)) === JSON.stringify({}),
    'a level that hits 0 used is dropped from the map');
  check(JSON.stringify(resetPactSlots({ '3': 1 }, 5)) === JSON.stringify({}),
    'spending fewer pact slots than the pact count still returns them all');
  check(JSON.stringify(resetPactSlots({ '1': 1, '2': 0 }, 5)) === JSON.stringify({ '1': 1, '2': 0 }),
    'an untouched 0-valued key passes through as stored');
  check(JSON.stringify(resetPactSlots({ '2': 2 }, 3)) === JSON.stringify({}),
    'warlock 3 zeroes both L2 pact slots (the collision case: nothing left for Arcane to recover)');
  const untouched = { '1': 1 };
  check(JSON.stringify(resetPactSlots(untouched, 0)) === JSON.stringify({ '1': 1 }) && JSON.stringify(untouched) === JSON.stringify({ '1': 1 }),
    'an invalid warlock level leaves the map unchanged — and the apply is pure, the input is not mutated');
}

server.close();
console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
process.exit(failed > 0 ? 1 : 0);
