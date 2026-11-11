// tests/wizard-validator-wiring.test.js — wizard prepared-spell cap wiring
// (2026-11-07): the 2024 formula (Int mod + wizard level, min 1; L1 = 4
// at Int +3, L5 = 9 at Int +4, L20 = 25 at Int +5) was enforced only at
// creation (Stage 4) — the character sheet's bare { prepared_spells }
// PUT sailed through, and a legacy over-cap list already on a row could
// sit there until level-up. This build wires the enforcement into the
// two live surfaces that touch prepared_spells, mirroring the
// artificer / blackguard / paladin / sorcerer / ranger / bard /
// warlock / profane soul wiring:
//   - PUT /:id — a non-marker body carrying prepared_spells on a
//     primary-wizard row is validated with wizardService
//     .validatePreparedSpells (intMod FIRST — the arg order matches
//     the bard/warlock validators); over cap -> 400 naming
//     preparedSpells, row unchanged. Non-wizards, marker bodies, and
//     wizard-as-secondary multiclass skip entirely.
//   - POST /level-up/:id — leveling up IN wizard (not multiclassing
//     into it) re-checks the STORED list against the new level and the
//     post-ASI Int mod; over cap -> 400 naming preparedSpells, level
//     unchanged (no DB writes happen before the check).
//   - server/services/wizardService.js preparedSpellsMax is the plain
//     2024 formula and agrees with levelProgression.getSpellsPrepared
//     at every level (wizards have full-caster slots at every level,
//     so the arm's slot gate never fires for wizard). No fixed table
//     is stored — the printed column is reproduced at the book's
//     implied ASI progression, the same rule-vs-table treatment as
//     cleric/druid/bard.
//   - There IS an always-prepared exclusion on the wizard path since
//     the spellbook system (2026-11-07): Spell Mastery (L18) /
//     Signature Spells (L20) picks live in spellbook_json
//     (server/services/spellbookService.js) and the routes pass that
//     list; Savant spells go INTO the spellbook rather than being
//     always prepared — so a prepared Savant spell counts.
//   - The validator is count-only BY DESIGN: membership (prepared ⊆
//     book) is enforced by the routes through
//     spellbookService.validateBookMembership against known_spells
//     (the book), not here. The PUT block and the level-up re-check
//     both run the membership check alongside the cap.
//   - The sheet's getMaxPrepared already HAS a wizard branch
//     (CharacterSheet.jsx:633, same formula) — nothing to fix there.
//
// Honest integration tests: preparedSpellsMax / validatePreparedSpells
// are imported from the real wizardService.js, getXPToNextLevel /
// getSpellsPrepared from the real levelProgression.js, and every
// PUT/level-up case drives the real character router over HTTP on a
// real throwaway DB (the levelup-subclass-prompts harness). Expected
// caps are derived from the real preparedSpellsMax, never hardcoded
// where the service is the authority. If wizardService.js or
// character.js were deleted, the imports fail and the suite fails
// with them.
//
// Fixture trap (levelup-subclass-prompts): a row that already spent its
// level-up 400s on XP on the next attempt — every level-up case gets a
// fresh row. Over-cap stored lists are seeded with a direct DB UPDATE,
// never through the PUT — the PUT would (correctly) refuse them, and the
// point of the level-up re-check is exactly the legacy state the PUT
// can no longer create.
//
// Marker note: a creator-marker body goes through the Stage 4 validator,
// whose L1 count for wizard is ALSO 4 at Int +3 (getSpellsPrepared at
// level 1) — so a 5-spell marker list is Stage 4's refusal ('wizard
// picks 4 spells at level 1, got 5'), proving the marker body is
// governed by Stage 4, NOT by the new block's 'may prepare at most'
// refusal. The 5 marker spells are all L1 wizard spells, so the count
// error — not a learnability error — is what fires.
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

const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'wizard-validator-wiring-test-'));
const tmpDir = repoRoot;
const origCwd = process.cwd();
process.chdir(tmpDir);
delete process.env.TURSO_DATABASE_URL;
delete process.env.TURSO_AUTH_TOKEN;
const fromRepo = (rel) => pathToFileURL(path.join(origCwd, rel)).href;

const db = await import(fromRepo('server/database.js'));
await db.initDatabase();
// The real services under test — caps come from these, not from literals.
const wizard = await import(fromRepo('server/services/wizardService.js'));
const { preparedSpellsMax, validatePreparedSpells } = wizard;
const { getXPToNextLevel, getSpellsPrepared } = await import(fromRepo('server/config/levelProgression.js'));

// --- HTTP harness: the real character router on a real express app ----
const app = express();
app.use(express.json());
const characterRouter = (await import(fromRepo('server/routes/character.js'))).default;
app.use('/api/character', characterRouter);
const server = await new Promise((resolve) => {
  const s = app.listen(0, '127.0.0.1', () => resolve(s));
});
const base = `http://127.0.0.1:${server.address().port}`;
const J = (v) => JSON.stringify(v);
async function req(method, url, body) {
  const res = await fetch(`${base}${url}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json = null;
  try { json = await res.json(); } catch {}
  return { status: res.status, json };
}
async function readCharacter(id) {
  return db.dbGet('SELECT * FROM characters WHERE id = ?', [id]);
}
function readPrepared(id) {
  return readCharacter(id).then((r) => JSON.parse(r.prepared_spells || '[]'));
}

// Int +3 (score 16) at every level used below, so the cap moves only
// with level: L1 -> 4, L2 -> 5, L5 -> 8, per the 2024 formula (Int mod
// + wizard level, min 1).
const INT3_SCORES = { str: 10, dex: 10, con: 14, int: 16, wis: 10, cha: 10 };
const INT4_SCORES = { str: 10, dex: 10, con: 14, int: 18, wis: 10, cha: 10 };
const INT_MOD = 3;

// Counted wizard spells; the validator counts by name, so the exact
// spells only need to be distinct strings — real L1-L3 wizard spells
// here (all learnable by a wizard, so the Stage 4 marker case also
// exercises the count error, not a learnability error). COUNTED_5 is
// all L1, for the marker case.
const COUNTED_4 = ['Magic Missile', 'Shield', 'Mage Armor', 'Sleep'];
const COUNTED_5 = [...COUNTED_4, 'Burning Hands'];
const COUNTED_6 = [...COUNTED_5, 'Thunderwave'];
const COUNTED_8 = [...COUNTED_6, 'Detect Magic', 'Feather Fall'];
const COUNTED_9 = [...COUNTED_8, 'Misty Step'];
const COUNTED_10 = [...COUNTED_9, 'Fireball'];
const CLERIC_10 = ['Cure Wounds', 'Bless', 'Guiding Bolt', 'Healing Word', 'Shield of Faith',
  'Sanctuary', 'Command', 'Inflict Wounds', 'Protection from Evil and Good', 'Detect Magic'];

async function makeCharacter({ name, cls, level, subclass = null, intScores = null, classLevels = null }) {
  const created = await req('POST', '/api/character', { name, class: cls, race: 'human' });
  assert(created.status === 201, `fixture POST creates ${name} (${cls}) — got ${created.status}`);
  const id = created.json.id;
  const put = await req('PUT', `/api/character/${id}`, {
    level,
    experience: getXPToNextLevel(level - 1) || 0,
    max_hp: 20,
    current_hp: 20,
    subclass,
    ...(intScores ? { ability_scores: J(intScores) } : {}),
    class_levels: J(classLevels || [{ class: cls, level, subclass }]),
  });
  assert(put.status === 200, `fixture PUT sets ${name} to level ${level} — got ${put.status}: ${JSON.stringify(put.json?.error || '')}`);
  // Spellbook (2026-11-07): a wizard fixture needs a book, or the
  // PUT/level-up membership checks refuse every prepared list. Seed
  // it directly (bypasses the route, like seedStoredPrepared) — a
  // level-appropriate book covering every list this suite uses, so
  // the suite keeps testing the CAP, not the book. L1: COUNTED_6,
  // L3: COUNTED_8, L4: COUNTED_9, L5+: COUNTED_10.
  if (cls === 'wizard') {
    const book = level >= 5 ? COUNTED_10 : level >= 4 ? COUNTED_9 : level >= 3 ? COUNTED_8 : COUNTED_6;
    await db.dbRun('UPDATE characters SET known_spells = ? WHERE id = ?', [J(book), id]);
    const back = JSON.parse((await readCharacter(id)).known_spells || '[]');
    assert.deepStrictEqual(back, book, 'seeded wizard spellbook reads back');
  }
  return id;
}

// Seed a stored prepared list directly (legacy state the PUT can no
// longer create) — bypasses the route on purpose, like a row written
// before this build existed.
async function seedStoredPrepared(id, list) {
  await db.dbRun('UPDATE characters SET prepared_spells = ? WHERE id = ?', [J(list), id]);
  const back = await readPrepared(id);
  assert.deepStrictEqual(back, list, 'seeded stored prepared list reads back');
}

// ===========================================================================
// (a) Service level: cap pins + validator behaviour (real wizardService)
// ===========================================================================
group('(a) preparedSpellsMax pins + validatePreparedSpells (real wizardService import)');
{
  check(preparedSpellsMax(INT_MOD, 1) === 4, 'cap source: preparedSpellsMax(+3, L1) = 4');
  check(preparedSpellsMax(INT_MOD, 2) === 5, 'cap source: preparedSpellsMax(+3, L2) = 5');
  check(preparedSpellsMax(INT_MOD, 5) === 8, 'cap source: preparedSpellsMax(+3, L5) = 8');
  check(preparedSpellsMax(4, 5) === 9, 'cap source: preparedSpellsMax(+4, L5) = 9 (recon pin)');
  check(preparedSpellsMax(5, 20) === 25, 'cap source: preparedSpellsMax(+5, L20) = 25 (recon pin)');
  check(preparedSpellsMax(INT_MOD, 20) === 23, 'cap source: preparedSpellsMax(+3, L20) = 23');
  check(preparedSpellsMax(-5, 1) === 1, 'cap source: min-1 floor (Int -5, L1) = 1, never 0');
  check(preparedSpellsMax(-1, 2) === 1, 'cap source: min-1 floor (Int -1, L2) = 1, never 0');
  check(preparedSpellsMax(0, 1) === 1, 'cap source: min-1 floor (Int 0, L1) = 1, never 0');
  // No always-prepared exclusion on the wizard path: with [] every
  // name counts, so 9 spells at a cap of 8 refuse with counted 9.
  const v = validatePreparedSpells(INT_MOD, 5, COUNTED_9, []);
  check(!v.ok && v.max === 8 && v.counted === 9 && v.over === 1,
    `validator with [] exclusion: 9 spells at cap 8 refuse, counted 9, over 1 (got max ${v.max}, counted ${v.counted}, over ${v.over})`);
  const vAt = validatePreparedSpells(INT_MOD, 5, COUNTED_8, []);
  check(vAt.ok && vAt.counted === 8 && vAt.max === 8, 'validator with [] exclusion: 8 spells at cap 8 pass');
  // The exclusion mechanism itself still works if a list is passed
  // (Spell Mastery / Signature Spells picks from spellbook_json —
  // the routes pass that list since the spellbook system, 2026-11-07).
  const vEx = validatePreparedSpells(INT_MOD, 5, [...COUNTED_8, 'Fireball'], ['Fireball']);
  check(vEx.ok && vEx.counted === 8 && vEx.max === 8,
    'validator honours a passed always-prepared list (exclusion mechanism live, routes pass [])');
  const vEmpty = validatePreparedSpells(INT_MOD, 5, [], []);
  check(vEmpty.ok && vEmpty.counted === 0, 'validator: empty list passes');
  const vNull = validatePreparedSpells(INT_MOD, 5, null, null);
  check(vNull.ok && vNull.counted === 0, 'validator: null list counts 0, passes');
}

// ===========================================================================
// (b) PUT path — the character sheet save
// ===========================================================================
group('(b) PUT refuses over-cap, persists at-cap (wizard L5, Int +3)');
{
  const cap5 = preparedSpellsMax(INT_MOD, 5);
  const wiz5 = await makeCharacter({ name: 'WizFive', cls: 'wizard', level: 5, intScores: INT3_SCORES });
  // Seed a valid list first so the refusal case can prove the row is unchanged.
  const seed = await req('PUT', `/api/character/${wiz5}`, { prepared_spells: J(COUNTED_8) });
  check(seed.status === 200, `PUT at-cap (${cap5} spells) persists 200 (got ${seed.status})`);
  check(JSON.stringify(await readPrepared(wiz5)) === JSON.stringify(COUNTED_8), 'at-cap list persisted and reads back');
  // One over the cap: 400, error names preparedSpells, row untouched.
  const over = await req('PUT', `/api/character/${wiz5}`, { prepared_spells: J(COUNTED_9) });
  check(over.status === 400, `PUT ${COUNTED_9.length} spells (cap ${cap5}) refuses 400 (got ${over.status})`);
  check(typeof over.json?.error === 'string' && over.json.error.includes('preparedSpells'),
    `PUT refusal names preparedSpells (got ${JSON.stringify(over.json?.error)})`);
  check(typeof over.json?.error === 'string' && over.json.error.includes(`at most ${cap5}`) && over.json.error.includes('got 9'),
    `PUT refusal states the cap and count (got ${JSON.stringify(over.json?.error)})`);
  check(typeof over.json?.error === 'string' && over.json.error.includes('wizard level 5') && over.json.error.includes('Int mod 3'),
    `PUT refusal names the wizard level and Int mod (got ${JSON.stringify(over.json?.error)})`);
  check(JSON.stringify(await readPrepared(wiz5)) === JSON.stringify(COUNTED_8),
    'refused PUT left the stored prepared list unchanged');
  // A different at-cap list still saves after the refusal.
  const again = await req('PUT', `/api/character/${wiz5}`, { prepared_spells: J([...COUNTED_8.slice(0, 7), 'Misty Step']) });
  check(again.status === 200, 'PUT at-cap again after a refusal persists 200');
  check(JSON.stringify(await readPrepared(wiz5)) === JSON.stringify([...COUNTED_8.slice(0, 7), 'Misty Step']),
    'second at-cap list persisted and reads back');
  // The camelCase alias the sheet also sends is validated the same way.
  const camel = await req('PUT', `/api/character/${wiz5}`, { preparedSpells: J(COUNTED_9) });
  check(camel.status === 400, `PUT via preparedSpells (camelCase) over cap refuses 400 (got ${camel.status})`);
  // The status alone does not discriminate: a camelCase-only body with no
  // wiring ALSO 400s ('No valid fields to update' — the generic UPDATE
  // does not know the camelCase key). The error text is the proof the
  // camelCase body went through the wizard validator instead.
  check(typeof camel.json?.error === 'string' && camel.json.error.includes('preparedSpells') && camel.json.error.includes('may prepare at most 8') && camel.json.error.includes('got 9'),
    `camelCase refusal is the wizard cap error, not 'No valid fields' (got ${JSON.stringify(camel.json?.error)})`);
}

group('(b2) PUT — L1 boundary: cap 4, a 5-spell list refuses, 4 + empty pass');
{
  const cap1 = preparedSpellsMax(INT_MOD, 1);
  check(cap1 === 4, `cap source: preparedSpellsMax(+3, L1) = 4 (got ${cap1})`);
  const wiz1 = await makeCharacter({ name: 'WizOne', cls: 'wizard', level: 1, intScores: INT3_SCORES });
  const over1 = await req('PUT', `/api/character/${wiz1}`, { prepared_spells: J(COUNTED_5) });
  check(over1.status === 400, `PUT 5 spells at L1 (cap ${cap1}) refuses 400 (got ${over1.status})`);
  check(typeof over1.json?.error === 'string' && over1.json.error.includes('preparedSpells') && over1.json.error.includes('at most 4') && over1.json.error.includes('got 5'),
    `L1 refusal names preparedSpells, cap 4, got 5 (got ${JSON.stringify(over1.json?.error)})`);
  check(JSON.stringify(await readPrepared(wiz1)) === JSON.stringify([]),
    'refused L1 PUT left the stored prepared list empty');
  const at1 = await req('PUT', `/api/character/${wiz1}`, { prepared_spells: J(COUNTED_4) });
  check(at1.status === 200, `PUT 4 spells at L1 (cap ${cap1}) persists 200 (got ${at1.status})`);
  check(JSON.stringify(await readPrepared(wiz1)) === JSON.stringify(COUNTED_4), 'L1 at-cap list persisted');
  const empty = await req('PUT', `/api/character/${wiz1}`, { prepared_spells: J([]) });
  check(empty.status === 200, `PUT empty list at L1 persists 200 (got ${empty.status})`);
  check(JSON.stringify(await readPrepared(wiz1)) === JSON.stringify([]), 'empty L1 list persisted');
}

group('(b3) PUT cap grows with level and with Int mod — L1 vs L5, +3 vs +4');
{
  const cap1 = preparedSpellsMax(INT_MOD, 1);
  const cap5 = preparedSpellsMax(INT_MOD, 5);
  const cap5Int4 = preparedSpellsMax(4, 5);
  check(cap1 === 4 && cap5 === 8 && cap5Int4 === 9,
    `cap source: L1 cap ${cap1}, L5 cap ${cap5}, L5 Int+4 cap ${cap5Int4} (got ${cap1}/${cap5}/${cap5Int4})`);
  const wiz1 = await makeCharacter({ name: 'WizOneB', cls: 'wizard', level: 1, intScores: INT3_SCORES });
  const over1 = await req('PUT', `/api/character/${wiz1}`, { prepared_spells: J(COUNTED_5) });
  check(over1.status === 400, `PUT ${COUNTED_5.length} spells at L1 (cap ${cap1}) refuses 400 (got ${over1.status})`);
  const at1 = await req('PUT', `/api/character/${wiz1}`, { prepared_spells: J(COUNTED_4) });
  check(at1.status === 200, `PUT ${cap1} spells at L1 persists 200 (got ${at1.status})`);
  check(JSON.stringify(await readPrepared(wiz1)) === JSON.stringify(COUNTED_4), 'L1 at-cap list persisted');
  // Same Int mod, higher level, bigger cap: the L1-refused 5-spell list
  // is legal at L5 — the boundary moves with the formula, not the mod.
  const wiz5b = await makeCharacter({ name: 'WizFiveB', cls: 'wizard', level: 5, intScores: INT3_SCORES });
  const at5 = await req('PUT', `/api/character/${wiz5b}`, { prepared_spells: J(COUNTED_5) });
  check(at5.status === 200, `PUT ${COUNTED_5.length} spells at L5 (cap ${cap5}) persists 200 (got ${at5.status})`);
  check(preparedSpellsMax(INT_MOD, 5) > preparedSpellsMax(INT_MOD, 1), 'cap at L5 exceeds cap at L1 with the same Int mod (+3)');
  // Same level, higher Int mod, bigger cap: the 9-spell list that
  // refuses at Int +3 (cap 8) is exactly at cap at Int +4 (cap 9).
  const wiz5Int4 = await makeCharacter({ name: 'WizFiveInt4', cls: 'wizard', level: 5, intScores: INT4_SCORES });
  const at5Int4 = await req('PUT', `/api/character/${wiz5Int4}`, { prepared_spells: J(COUNTED_9) });
  check(at5Int4.status === 200, `PUT 9 spells at L5 Int +4 (cap ${cap5Int4}) persists 200 (got ${at5Int4.status})`);
  check(JSON.stringify(await readPrepared(wiz5Int4)) === JSON.stringify(COUNTED_9), 'L5 Int+4 at-cap list persisted');
  const over5Int4 = await req('PUT', `/api/character/${wiz5Int4}`, { prepared_spells: J(COUNTED_10) });
  check(over5Int4.status === 400, `PUT 10 spells at L5 Int +4 (cap ${cap5Int4}) refuses 400 (got ${over5Int4.status})`);
}

group('(b4) PUT skips: non-wizard, secondary wizard, no list, marker');
{
  // Control-cleric Wisdom (2026-11-09, gate fix): the control
  // cleric must be legal under the CLERIC cap too (Wis mod + cleric
  // level, #10 cleric PUT validator, character.js) — a Wis-10 L5
  // cleric caps at 5, so the 10-spell list 400s naming 'cleric' and
  // the skip under test is never reached. Wis 20 -> cap 10 at L5
  // (exactly at cap), cap 9 at L4, so the PUT returns 200 only if
  // the validator under test skips; if it misfired it would still
  // 400 (its own cap is 5 or less at these levels).
  // Non-wizard (cleric) with a 10-spell list: no wizard cap applies.
  const cleric5 = await makeCharacter({ name: 'ClericFive', cls: 'cleric', level: 5, intScores: { ...INT3_SCORES, wis: 20 } });
  const clericPut = await req('PUT', `/api/character/${cleric5}`, { prepared_spells: J(CLERIC_10) });
  check(clericPut.status === 200, `cleric PUT with ${CLERIC_10.length} prepared spells is unaffected, 200 (got ${clericPut.status})`);
  check(JSON.stringify(await readPrepared(cleric5)) === JSON.stringify(CLERIC_10), 'cleric long list persisted');
  // Wizard-as-secondary multiclass: primary cleric governs the shared
  // column, so the wizard cap does not fire on the PUT — a 5-spell
  // list sails through even though the wizard entry is L1 (cap 4).
  const multi = await makeCharacter({
    name: 'ClericWiz', cls: 'cleric', level: 5, intScores: { ...INT3_SCORES, wis: 20 },
    classLevels: [{ class: 'cleric', level: 4, subclass: null }, { class: 'wizard', level: 1, subclass: null }],
  });
  const multiPut = await req('PUT', `/api/character/${multi}`, { prepared_spells: J(COUNTED_5) });
  check(multiPut.status === 200, `multiclass (cleric primary, wizard secondary L1) PUT over the wizard cap is skipped, 200 (got ${multiPut.status})`);
  check(JSON.stringify(await readPrepared(multi)) === JSON.stringify(COUNTED_5), 'multiclass long list persisted');
  // No prepared_spells in the body: a plain field update is unaffected.
  const wiz5 = await makeCharacter({ name: 'WizNoList', cls: 'wizard', level: 5, intScores: INT3_SCORES });
  await seedStoredPrepared(wiz5, COUNTED_8);
  const plain = await req('PUT', `/api/character/${wiz5}`, { name: 'WizNoList Renamed' });
  check(plain.status === 200, `PUT with no prepared_spells is unaffected, 200 (got ${plain.status})`);
  check((await readCharacter(wiz5)).name === 'WizNoList Renamed', 'plain PUT still persisted the name change');
  check(JSON.stringify(await readPrepared(wiz5)) === JSON.stringify(COUNTED_8), 'plain PUT left the stored prepared list alone');
  // Creator-marker PUT goes through the Stage 4 validator, not the new
  // block: the empty list passes, and a 5-spell marker list is Stage 4's
  // refusal ('wizard picks 4 spells at level 1, got 5'), with Stage 4's
  // wording, not the new block's 'may prepare at most'.
  const markerWiz = await makeCharacter({ name: 'WizMarker', cls: 'wizard', level: 1, intScores: INT3_SCORES });
  const markerPut = await req('PUT', `/api/character/${markerWiz}`, {
    creator: 'creator-next', prepared_spells: J([]),
  });
  check(markerPut.status === 200,
    `creator-marker PUT with an empty list passes 200 (got ${markerPut.status}: ${JSON.stringify(markerPut.json?.error || '')})`);
  check(JSON.stringify(await readPrepared(markerWiz)) === JSON.stringify([]), 'marker PUT persisted the empty list');
  const markerOver = await req('PUT', `/api/character/${markerWiz}`, {
    creator: 'creator-next', prepared_spells: J(COUNTED_5),
  });
  check(markerOver.status === 400,
    `creator-marker PUT with 5 spells refuses 400 via Stage 4 (got ${markerOver.status})`);
  check(typeof markerOver.json?.error === 'string' && markerOver.json.error.includes('preparedSpells'),
    `marker refusal names preparedSpells (got ${JSON.stringify(markerOver.json?.error)})`);
  check(typeof markerOver.json?.error === 'string' && markerOver.json.error.includes('picks 4 spells at level 1') && !markerOver.json.error.includes('may prepare at most'),
    `marker refusal is Stage 4's wording, not the new block's (got ${JSON.stringify(markerOver.json?.error)})`);
  check(JSON.stringify(await readPrepared(markerWiz)) === JSON.stringify([]),
    'refused marker PUT left the stored prepared list unchanged');
}

// ===========================================================================
// (c) Level-up path — stored-list re-check on leveling up IN wizard
// ===========================================================================
group('(c) level-up re-check: over-cap stored list blocks, level unchanged');
{
  // Wizard L4 -> L5, Int +3: new cap is preparedSpellsMax(+3, 5) = 8.
  const cap5 = preparedSpellsMax(INT_MOD, 5);
  const over = await makeCharacter({
    name: 'WizLevelOver', cls: 'wizard', level: 4, subclass: 'School of Evocation', intScores: INT3_SCORES,
  });
  await db.dbRun('UPDATE characters SET experience = ? WHERE id = ?', [getXPToNextLevel(4), over]);
  await seedStoredPrepared(over, COUNTED_9);
  const blocked = await req('POST', `/api/character/level-up/${over}`, {});
  check(blocked.status === 400, `level-up with stored ${COUNTED_9.length} spells (new cap ${cap5}) refuses 400 (got ${blocked.status})`);
  check(typeof blocked.json?.error === 'string' && blocked.json.error.includes('preparedSpells'),
    `level-up refusal names preparedSpells (got ${JSON.stringify(blocked.json?.error)})`);
  check(typeof blocked.json?.error === 'string' && blocked.json.error.includes('fix the prepared list'),
    'level-up refusal tells the player to fix the list on the character sheet');
  check(typeof blocked.json?.error === 'string' && blocked.json.error.includes(`at most ${cap5}`) && blocked.json.error.includes('got 9'),
    `level-up refusal states the cap and count (got ${JSON.stringify(blocked.json?.error)})`);
  const overRow = await readCharacter(over);
  check(overRow.level === 4, 'blocked level-up left the level at 4');
  check(JSON.stringify(JSON.parse(overRow.prepared_spells)) === JSON.stringify(COUNTED_9),
    'blocked level-up left the stored prepared list unchanged');

  // Same shape, valid stored list: 200, level increases to 5.
  const valid = await makeCharacter({
    name: 'WizLevelOk', cls: 'wizard', level: 4, subclass: 'School of Evocation', intScores: INT3_SCORES,
  });
  await db.dbRun('UPDATE characters SET experience = ? WHERE id = ?', [getXPToNextLevel(4), valid]);
  await seedStoredPrepared(valid, COUNTED_8);
  const ok = await req('POST', `/api/character/level-up/${valid}`, {});
  check(ok.status === 200, `level-up with a valid stored list succeeds 200 (got ${ok.status}: ${JSON.stringify(ok.json?.error || '')})`);
  const okRow = await readCharacter(valid);
  check(okRow.level === 5, 'valid level-up raised the level to 5');
  check(JSON.stringify(JSON.parse(okRow.prepared_spells)) === JSON.stringify(COUNTED_8),
    'valid level-up kept the stored prepared list');
}

group('(c2) level-up re-check at L1 -> L2 (new cap 5, same Int +3)');
{
  const cap2 = preparedSpellsMax(INT_MOD, 2);
  check(cap2 === 5, `cap source: preparedSpellsMax(+3, L2) = 5 (got ${cap2})`);
  const over = await makeCharacter({ name: 'WizLevelOneOver', cls: 'wizard', level: 1, intScores: INT3_SCORES });
  await db.dbRun('UPDATE characters SET experience = ? WHERE id = ?', [getXPToNextLevel(1), over]);
  // 6 stored spells: over the L2 cap of 5. (At L1 the same list could
  // never have been saved through the PUT — it is legacy state.)
  await seedStoredPrepared(over, COUNTED_6);
  const blocked = await req('POST', `/api/character/level-up/${over}`, {});
  check(blocked.status === 400, `L1->2 level-up with 6 stored spells (new cap ${cap2}) refuses 400 (got ${blocked.status})`);
  check(typeof blocked.json?.error === 'string' && blocked.json.error.includes('preparedSpells'),
    `L1->2 refusal names preparedSpells (got ${JSON.stringify(blocked.json?.error)})`);
  check((await readCharacter(over)).level === 1, 'blocked L1->2 level-up left the level at 1');
  check(JSON.stringify(await readPrepared(over)) === JSON.stringify(COUNTED_6),
    'blocked L1->2 level-up left the stored prepared list unchanged');
}

group('(c3) level-up skips multiclass INTO wizard');
{
  // Cleric 3 -> total 4 by multiclassing into wizard, with a stored
  // 5-spell list from the cleric side. The list belongs to the other
  // class, so the re-check must not fire (wizard L1 cap would be 4).
  // The level-up carries the now-required 6-spell seed (replacement
  // build, 2026-11-07: an empty multiclass seed refuses) — the seed
  // is orthogonal to the re-check gating this group pins.
  const capWiz1 = preparedSpellsMax(INT_MOD, 1);
  check(capWiz1 === 4, `cap source: wizard L1 cap is ${capWiz1} at Int +3 (the stored 5 would fail it)`);
  const cleric = await makeCharacter({ name: 'ClericMultiWiz', cls: 'cleric', level: 3, intScores: INT3_SCORES });
  await db.dbRun('UPDATE characters SET experience = ? WHERE id = ?', [getXPToNextLevel(3), cleric]);
  await seedStoredPrepared(cleric, COUNTED_5);
  const multi = await req('POST', `/api/character/level-up/${cleric}`, {
    selectedClass: 'Wizard',
    newSpells: ['Magic Missile', 'Shield', 'Mage Armor', 'Sleep', 'Burning Hands', 'Thunderwave'],
  });
  check(multi.status === 200,
    `multiclass into wizard with a stored 5-spell list is NOT blocked, 200 (got ${multi.status}: ${JSON.stringify(multi.json?.error || '')})`);
  const multiRow = await readCharacter(cleric);
  check(multiRow.level === 4, 'multiclass level-up raised the total level to 4');
  const levels = JSON.parse(multiRow.class_levels || '[]');
  const wizEntry = levels.find((c) => String(c.class).toLowerCase() === 'wizard');
  check(wizEntry?.level === 1, 'multiclass wizard entry stored at level 1');
  check(JSON.stringify(JSON.parse(multiRow.prepared_spells)) === JSON.stringify(COUNTED_5),
    'multiclass level-up kept the stored prepared list');
  check(JSON.stringify(JSON.parse(multiRow.known_spells)) === JSON.stringify(['Magic Missile', 'Shield', 'Mage Armor', 'Sleep', 'Burning Hands', 'Thunderwave']),
    'the 6-spell seed became the wizard book');
}

group('(c4) level-up uses the POST-ASI Int mod (L3 -> L4, ASI at 4th)');
{
  // Wizard L3 -> L4, Int +3, 8 stored spells. Without an ASI the new
  // cap is preparedSpellsMax(+3, 4) = 7, so 8 stored spells refuse.
  // With +2 Int from the L4 ASI the post-ASI mod is +4 and the new
  // cap is preparedSpellsMax(+4, 4) = 8, so the same 8 stored spells
  // pass — proving the re-check reads the post-ASI mod, not the old one.
  const capNoAsi = preparedSpellsMax(INT_MOD, 4);
  const capAsi = preparedSpellsMax(4, 4);
  check(capNoAsi === 7 && capAsi === 8,
    `cap source: L4 cap ${capNoAsi} at Int +3, ${capAsi} at Int +4 (got ${capNoAsi}/${capAsi})`);
  const noAsi = await makeCharacter({
    name: 'WizAsiNo', cls: 'wizard', level: 3, subclass: 'School of Evocation', intScores: INT3_SCORES,
  });
  await db.dbRun('UPDATE characters SET experience = ? WHERE id = ?', [getXPToNextLevel(3), noAsi]);
  await seedStoredPrepared(noAsi, COUNTED_8);
  const blocked = await req('POST', `/api/character/level-up/${noAsi}`, {});
  check(blocked.status === 400, `L3->4 level-up with 8 stored spells and no ASI (new cap ${capNoAsi}) refuses 400 (got ${blocked.status})`);
  check(typeof blocked.json?.error === 'string' && blocked.json.error.includes('preparedSpells') && blocked.json.error.includes('got 8'),
    `no-ASI refusal names preparedSpells and counts 8 (got ${JSON.stringify(blocked.json?.error)})`);
  check((await readCharacter(noAsi)).level === 3, 'blocked no-ASI level-up left the level at 3');
  const withAsi = await makeCharacter({
    name: 'WizAsiYes', cls: 'wizard', level: 3, subclass: 'School of Evocation', intScores: INT3_SCORES,
  });
  await db.dbRun('UPDATE characters SET experience = ? WHERE id = ?', [getXPToNextLevel(3), withAsi]);
  await seedStoredPrepared(withAsi, COUNTED_8);
  const ok = await req('POST', `/api/character/level-up/${withAsi}`, {
    asiChoice: { type: 'asi', increases: { int: 2 } },
  });
  check(ok.status === 200,
    `L3->4 level-up with 8 stored spells and +2 Int ASI (new cap ${capAsi}) succeeds 200 (got ${ok.status}: ${JSON.stringify(ok.json?.error || '')})`);
  const okRow = await readCharacter(withAsi);
  check(okRow.level === 4, 'ASI level-up raised the level to 4');
  const storedScores = JSON.parse(okRow.ability_scores || '{}');
  check(Number(storedScores.int) === 18, `ASI level-up stored Int 18 (got ${storedScores.int})`);
  check(JSON.stringify(JSON.parse(okRow.prepared_spells)) === JSON.stringify(COUNTED_8),
    'ASI level-up kept the stored prepared list');
}

// ===========================================================================
// (d) Cap agreement: preparedSpellsMax == getSpellsPrepared, every level
// ===========================================================================
group('(d) preparedSpellsMax agrees with getSpellsPrepared at every level 1-20');
{
  let mismatches = 0;
  for (const mod of [-5, -1, 0, 1, 3, 5]) {
    for (let level = 1; level <= 20; level++) {
      const a = preparedSpellsMax(mod, level);
      const b = getSpellsPrepared('wizard', level, mod);
      if (a !== b) {
        mismatches++;
        console.error(`  ✗ mismatch mod ${mod} level ${level}: preparedSpellsMax=${a}, getSpellsPrepared=${b}`);
      }
    }
  }
  check(mismatches === 0, `preparedSpellsMax == getSpellsPrepared('wizard', …) at all 20 levels × mods [-5, -1, 0, 1, 3, 5] (${mismatches} mismatches)`);
}

server.close();
console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
process.exit(failed > 0 ? 1 : 0);
