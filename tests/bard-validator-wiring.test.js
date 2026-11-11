// tests/bard-validator-wiring.test.js — bard prepared-spell cap wiring
// (2026-11-06): the 2024 formula (Cha mod + bard level, min 1; L1 = 4
// at Cha +3) was enforced only at creation (Stage 4) — the character
// sheet's bare { prepared_spells } PUT sailed through, and a legacy
// over-cap list already on a row could sit there until level-up. This
// build wires the enforcement into the two live surfaces that touch
// prepared_spells, mirroring the artificer / blackguard / paladin /
// sorcerer / ranger wiring:
//   - PUT /:id — a non-marker body carrying prepared_spells on a
//     primary-bard row is validated with bardService
//     .validatePreparedSpells (chaMod FIRST — the arg order matches the
//     paladin/blackguard validators); over cap -> 400 naming
//     preparedSpells, row unchanged. Non-bards, marker bodies, and
//     bard-as-secondary multiclass skip entirely. College of the Moon's
//     Moonbeam (always-prepared, L6) is excluded via subclassService.
//     bardSubclassSpellsAtLevel.
//   - POST /level-up/:id — leveling up IN bard (not multiclassing
//     into it) re-checks the STORED list against the new level and the
//     post-ASI Cha mod; over cap -> 400 naming preparedSpells, level
//     unchanged (no DB writes happen before the check).
//   - server/services/bardService.js preparedSpellsMax is the plain
//     2024 formula and agrees with levelProgression.getSpellsPrepared
//     at every level (bards have full-caster slots at every level, so
//     the arm's slot gate never fires for bard).
//   - Magical Secrets (L10) picks are prepared spells: they COUNT
//     against the cap (the 2024 text lets the bard choose new prepared
//     spells from the Cleric/Druid/Wizard lists). Only always-prepared
//     spells are excluded — the book's own rule.
//   - The sheet's getMaxPrepared HAS a bard branch (returns
//     Math.max(1, Cha mod + bard level); label is "All prepared") —
//     landed by the sheet job 2026-11-07; NOT asserted here (the
//     sheet-prepared-branches suite owns the sheet assertions).
//
// Honest integration tests: preparedSpellsMax / validatePreparedSpells
// are imported from the real bardService.js, bardSubclassSpellsAtLevel
// from the real subclassService.js, getXPToNextLevel / getSpellsPrepared
// from the real levelProgression.js, and every PUT/level-up case drives
// the real character router over HTTP on a real throwaway DB (the
// levelup-subclass-prompts harness). Expected caps are derived from the
// real preparedSpellsMax, never hardcoded where the service is the
// authority. If bardService.js, subclassService.js, or character.js were
// deleted, the imports fail and the suite fails with them.
//
// Fixture trap (levelup-subclass-prompts): a row that already spent its
// level-up 400s on XP on the next attempt — every level-up case gets a
// fresh row. Over-cap stored lists are seeded with a direct DB UPDATE,
// never through the PUT — the PUT would (correctly) refuse them, and the
// point of the level-up re-check is exactly the legacy state the PUT
// can no longer create.
//
// Marker note: a creator-marker body goes through the Stage 4 validator,
// whose L1 count for bard is ALSO 4 at Cha +3 (getSpellsPrepared at
// level 1) — so a 5-spell marker list is Stage 4's refusal ('bard picks
// 4 spells at level 1, got 5'), proving the marker body is governed by
// Stage 4, NOT by the new block's 'may prepare at most' refusal.
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

const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'bard-validator-wiring-test-'));
const tmpDir = repoRoot;
const origCwd = process.cwd();
process.chdir(tmpDir);
delete process.env.TURSO_DATABASE_URL;
delete process.env.TURSO_AUTH_TOKEN;
const fromRepo = (rel) => pathToFileURL(path.join(origCwd, rel)).href;

const db = await import(fromRepo('server/database.js'));
await db.initDatabase();
// The real services under test — caps come from these, not from literals.
const bard = await import(fromRepo('server/services/bardService.js'));
const { preparedSpellsMax, validatePreparedSpells } = bard;
const { bardSubclassSpellsAtLevel } = await import(fromRepo('server/services/subclassService.js'));
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

// Cha +3 (score 16) at every level used below, so the cap moves only
// with level: L1 -> 4, L2 -> 5, L5 -> 8, L6 -> 9, L10 -> 13, per the
// 2024 formula (Cha mod + bard level, min 1).
const CHA3_SCORES = { str: 10, dex: 10, con: 14, int: 10, wis: 10, cha: 16 };
const CHA_MOD = 3;

// Counted bard spells; the validator counts by name, so the exact
// spells only need to be distinct strings — real L1-L3 bard spells
// here (all learnable by a bard, so the Stage 4 marker case also
// exercises the count error, not a learnability error). None is
// 'Moonbeam', the one always-prepared name.
const COUNTED_4 = ['Healing Word', 'Dissonant Whispers', 'Charm Person', 'Faerie Fire'];
const COUNTED_5 = [...COUNTED_4, 'Thunderwave'];
const COUNTED_8 = [...COUNTED_5, 'Sleep', 'Bane', 'Cure Wounds'];
const COUNTED_9 = [...COUNTED_8, 'Heroism'];
const COUNTED_10 = [...COUNTED_9, 'Invisibility'];
const COUNTED_13 = [...COUNTED_10, 'Hold Person', 'Shatter', 'Hypnotic Pattern'];
const COUNTED_14 = [...COUNTED_13, 'Fireball'];
const CLERIC_10 = ['Cure Wounds', 'Bless', 'Guiding Bolt', 'Healing Word', 'Shield of Faith',
  'Sanctuary', 'Command', 'Inflict Wounds', 'Protection from Evil and Good', 'Detect Magic'];
// Magical Secrets picks (L10): two spells from other lists — Fireball
// (Wizard) and Spirit Guardians (Cleric) — sitting INSIDE the cap.
const MS_13 = [...COUNTED_10, 'Hold Person', 'Fireball', 'Spirit Guardians'];
const MS_14 = [...MS_13, 'Shatter'];

async function makeCharacter({ name, cls, level, subclass = null, chaScores = null, classLevels = null }) {
  const created = await req('POST', '/api/character', { name, class: cls, race: 'human' });
  assert(created.status === 201, `fixture POST creates ${name} (${cls}) — got ${created.status}`);
  const id = created.json.id;
  const put = await req('PUT', `/api/character/${id}`, {
    level,
    experience: getXPToNextLevel(level - 1) || 0,
    max_hp: 20,
    current_hp: 20,
    subclass,
    ...(chaScores ? { ability_scores: J(chaScores) } : {}),
    class_levels: J(classLevels || [{ class: cls, level, subclass }]),
  });
  assert(put.status === 200, `fixture PUT sets ${name} to level ${level} — got ${put.status}: ${JSON.stringify(put.json?.error || '')}`);
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
// (a) Helper: bardSubclassSpellsAtLevel — real import, real data
// ===========================================================================
group('(a) bardSubclassSpellsAtLevel (real subclassService import)');
{
  check(JSON.stringify(bardSubclassSpellsAtLevel('bard', 'College of the Moon', 5)) === JSON.stringify([]),
    'Moon L5 (before Blessing of Moonlight at 6): []');
  check(JSON.stringify(bardSubclassSpellsAtLevel('bard', 'College of the Moon', 6)) === JSON.stringify(['Moonbeam']),
    `Moon L6: Moonbeam (got ${JSON.stringify(bardSubclassSpellsAtLevel('bard', 'College of the Moon', 6))})`);
  check(JSON.stringify(bardSubclassSpellsAtLevel('bard', 'College of the Moon', 14)) === JSON.stringify(['Moonbeam']),
    'Moon L14: still just Moonbeam (cumulative, one spell)');
  check(JSON.stringify(bardSubclassSpellsAtLevel('bard', 'college_of_the_moon', 6)) === JSON.stringify(['Moonbeam']),
    'Moon L6 resolves by registry key as well as display name');
  for (const sub of ['College of Dance', 'College of Glamour', 'College of Lore', 'College of Valor']) {
    check(JSON.stringify(bardSubclassSpellsAtLevel('bard', sub, 10)) === JSON.stringify([]),
      `${sub} L10: no always-prepared spells (got ${JSON.stringify(bardSubclassSpellsAtLevel('bard', sub, 10))})`);
  }
  check(JSON.stringify(bardSubclassSpellsAtLevel('bard', null, 10)) === JSON.stringify([]),
    'no subclass: []');
  // Sanity: the service-level validator the routes call agrees with the
  // formula at the levels the route tests below use as boundaries, and
  // excludes an always-prepared name from the count.
  check(preparedSpellsMax(CHA_MOD, 1) === 4, 'cap source: preparedSpellsMax(+3, L1) = 4');
  check(preparedSpellsMax(CHA_MOD, 2) === 5, 'cap source: preparedSpellsMax(+3, L2) = 5');
  check(preparedSpellsMax(CHA_MOD, 5) === 8, 'cap source: preparedSpellsMax(+3, L5) = 8');
  check(preparedSpellsMax(CHA_MOD, 10) === 13, 'cap source: preparedSpellsMax(+3, L10) = 13');
  check(preparedSpellsMax(CHA_MOD, 20) === 23, 'cap source: preparedSpellsMax(+3, L20) = 23');
  check(preparedSpellsMax(-5, 1) === 1, 'cap source: min-1 floor (Cha -5, L1) = 1, never 0');
  const v = validatePreparedSpells(CHA_MOD, 5, [...COUNTED_8, 'Moonbeam'], ['Moonbeam']);
  check(v.ok && v.counted === 8 && v.max === 8, 'validator excludes an always-prepared name from the count');
  const v1 = validatePreparedSpells(CHA_MOD, 1, COUNTED_5, []);
  check(!v1.ok && v1.max === 4 && v1.counted === 5, 'validator at L1: max 4, a 5-spell list refuses');
}

// ===========================================================================
// (b) PUT path — the character sheet save
// ===========================================================================
group('(b) PUT refuses over-cap, persists at-cap (bard L5, Cha +3)');
{
  const cap5 = preparedSpellsMax(CHA_MOD, 5);
  const bard5 = await makeCharacter({ name: 'BardFive', cls: 'bard', level: 5, chaScores: CHA3_SCORES });
  // Seed a valid list first so the refusal case can prove the row is unchanged.
  const seed = await req('PUT', `/api/character/${bard5}`, { prepared_spells: J(COUNTED_8) });
  check(seed.status === 200, `PUT at-cap (${cap5} spells) persists 200 (got ${seed.status})`);
  check(JSON.stringify(await readPrepared(bard5)) === JSON.stringify(COUNTED_8), 'at-cap list persisted and reads back');
  // One over the cap: 400, error names preparedSpells, row untouched.
  const over = await req('PUT', `/api/character/${bard5}`, { prepared_spells: J(COUNTED_9) });
  check(over.status === 400, `PUT ${COUNTED_9.length} spells (cap ${cap5}) refuses 400 (got ${over.status})`);
  check(typeof over.json?.error === 'string' && over.json.error.includes('preparedSpells'),
    `PUT refusal names preparedSpells (got ${JSON.stringify(over.json?.error)})`);
  check(typeof over.json?.error === 'string' && over.json.error.includes(`at most ${cap5}`) && over.json.error.includes('got 9'),
    `PUT refusal states the cap and count (got ${JSON.stringify(over.json?.error)})`);
  check(typeof over.json?.error === 'string' && over.json.error.includes('bard level 5') && over.json.error.includes('Cha mod 3'),
    `PUT refusal names the bard level and Cha mod (got ${JSON.stringify(over.json?.error)})`);
  check(JSON.stringify(await readPrepared(bard5)) === JSON.stringify(COUNTED_8),
    'refused PUT left the stored prepared list unchanged');
  // A different at-cap list still saves after the refusal.
  const again = await req('PUT', `/api/character/${bard5}`, { prepared_spells: J([...COUNTED_8.slice(0, 7), 'Heroism']) });
  check(again.status === 200, 'PUT at-cap again after a refusal persists 200');
  check(JSON.stringify(await readPrepared(bard5)) === JSON.stringify([...COUNTED_8.slice(0, 7), 'Heroism']),
    'second at-cap list persisted and reads back');
  // The camelCase alias the sheet also sends is validated the same way.
  const camel = await req('PUT', `/api/character/${bard5}`, { preparedSpells: J(COUNTED_9) });
  check(camel.status === 400, `PUT via preparedSpells (camelCase) over cap refuses 400 (got ${camel.status})`);
  // The status alone does not discriminate: a camelCase-only body with no
  // wiring ALSO 400s ('No valid fields to update' — the generic UPDATE
  // does not know the camelCase key). The error text is the proof the
  // camelCase body went through the bard validator instead.
  check(typeof camel.json?.error === 'string' && camel.json.error.includes('preparedSpells') && camel.json.error.includes('may prepare at most 8') && camel.json.error.includes('got 9'),
    `camelCase refusal is the bard cap error, not 'No valid fields' (got ${JSON.stringify(camel.json?.error)})`);
}

group('(b2) PUT — L1 boundary: cap 4, a 5-spell list refuses, 4 + empty pass');
{
  const cap1 = preparedSpellsMax(CHA_MOD, 1);
  check(cap1 === 4, `cap source: preparedSpellsMax(+3, L1) = 4 (got ${cap1})`);
  const bard1 = await makeCharacter({ name: 'BardOne', cls: 'bard', level: 1, chaScores: CHA3_SCORES });
  const over1 = await req('PUT', `/api/character/${bard1}`, { prepared_spells: J(COUNTED_5) });
  check(over1.status === 400, `PUT 5 spells at L1 (cap ${cap1}) refuses 400 (got ${over1.status})`);
  check(typeof over1.json?.error === 'string' && over1.json.error.includes('preparedSpells') && over1.json.error.includes('at most 4') && over1.json.error.includes('got 5'),
    `L1 refusal names preparedSpells, cap 4, got 5 (got ${JSON.stringify(over1.json?.error)})`);
  check(JSON.stringify(await readPrepared(bard1)) === JSON.stringify([]),
    'refused L1 PUT left the stored prepared list empty');
  const at1 = await req('PUT', `/api/character/${bard1}`, { prepared_spells: J(COUNTED_4) });
  check(at1.status === 200, `PUT 4 spells at L1 (cap ${cap1}) persists 200 (got ${at1.status})`);
  check(JSON.stringify(await readPrepared(bard1)) === JSON.stringify(COUNTED_4), 'L1 at-cap list persisted');
  const empty = await req('PUT', `/api/character/${bard1}`, { prepared_spells: J([]) });
  check(empty.status === 200, `PUT empty list at L1 persists 200 (got ${empty.status})`);
  check(JSON.stringify(await readPrepared(bard1)) === JSON.stringify([]), 'empty L1 list persisted');
}

group('(b3) PUT cap grows with level — L1 vs L5, same Cha +3');
{
  const cap1 = preparedSpellsMax(CHA_MOD, 1);
  const cap5 = preparedSpellsMax(CHA_MOD, 5);
  check(cap1 === 4 && cap5 === 8, `cap source: L1 cap ${cap1}, L5 cap ${cap5} (got ${cap1}/${cap5})`);
  const bard1 = await makeCharacter({ name: 'BardOneB', cls: 'bard', level: 1, chaScores: CHA3_SCORES });
  const over1 = await req('PUT', `/api/character/${bard1}`, { prepared_spells: J(COUNTED_5) });
  check(over1.status === 400, `PUT ${COUNTED_5.length} spells at L1 (cap ${cap1}) refuses 400 (got ${over1.status})`);
  const at1 = await req('PUT', `/api/character/${bard1}`, { prepared_spells: J(COUNTED_4) });
  check(at1.status === 200, `PUT ${cap1} spells at L1 persists 200 (got ${at1.status})`);
  check(JSON.stringify(await readPrepared(bard1)) === JSON.stringify(COUNTED_4), 'L1 at-cap list persisted');
  // Same Cha mod, higher level, bigger cap: the L1-refused 5-spell list
  // is legal at L5 — the boundary moves with the formula, not the mod.
  const bard5b = await makeCharacter({ name: 'BardFiveB', cls: 'bard', level: 5, chaScores: CHA3_SCORES });
  const at5 = await req('PUT', `/api/character/${bard5b}`, { prepared_spells: J(COUNTED_5) });
  check(at5.status === 200, `PUT ${COUNTED_5.length} spells at L5 (cap ${cap5}) persists 200 (got ${at5.status})`);
  check(preparedSpellsMax(CHA_MOD, 5) > preparedSpellsMax(CHA_MOD, 1), 'cap at L5 exceeds cap at L1 with the same Cha mod (+3)');
}

group('(b4) PUT — Moon Moonbeam does not count (always prepared, L6)');
{
  const cap6 = preparedSpellsMax(CHA_MOD, 6);
  const moon6 = await makeCharacter({
    name: 'MoonSix', cls: 'bard', level: 6, subclass: 'College of the Moon', chaScores: CHA3_SCORES,
  });
  const always6 = bardSubclassSpellsAtLevel('bard', 'College of the Moon', 6);
  check(always6.length === 1 && always6[0] === 'Moonbeam',
    `Moon always-prepared at L6 is just Moonbeam (got ${JSON.stringify(always6)})`);
  // 9 counted + Moonbeam: counted stays 9 = cap 9.
  const withAlways = await req('PUT', `/api/character/${moon6}`, {
    prepared_spells: J([...COUNTED_9, 'Moonbeam']),
  });
  check(withAlways.status === 200,
    `PUT 9 counted + Moonbeam persists 200 (got ${withAlways.status}: ${JSON.stringify(withAlways.json?.error || '')})`);
  check((await readPrepared(moon6)).length === 10, 'all 10 sent names persisted (always-prepared are stored, just not counted)');
  // Lowercase 'moonbeam' is excluded too (canonicalized match).
  const lowerAlways = await req('PUT', `/api/character/${moon6}`, {
    prepared_spells: J([...COUNTED_9, 'moonbeam']),
  });
  check(lowerAlways.status === 200,
    `PUT 9 counted + lowercase 'moonbeam' persists 200 (got ${lowerAlways.status}: ${JSON.stringify(lowerAlways.json?.error || '')})`);
  // 10 counted + Moonbeam: counted 10 > cap 9 -> 400.
  const overMoon = await req('PUT', `/api/character/${moon6}`, {
    prepared_spells: J([...COUNTED_10, 'Moonbeam']),
  });
  check(overMoon.status === 400, `PUT 10 counted + Moonbeam refuses 400 (got ${overMoon.status})`);
  check(typeof overMoon.json?.error === 'string' && overMoon.json.error.includes('preparedSpells') && overMoon.json.error.includes('got 10'),
    `Moon refusal names preparedSpells and counts 10 (got ${JSON.stringify(overMoon.json?.error)})`);
  check((await readPrepared(moon6)).length === 10, 'refused Moon PUT left the stored list unchanged');
}

group('(b5) PUT — Magical Secrets picks COUNT against the cap (L10)');
{
  // 2024 PHB: Magical Secrets lets the bard choose new PREPARED spells
  // from the Cleric/Druid/Wizard lists — the picks are prepared spells,
  // not always-prepared extras. Fireball (Wizard) + Spirit Guardians
  // (Cleric) inside a 13-name list at L10 (cap 13) is legal; a 14th
  // name is not, even though two of the names are off-list picks.
  const cap10 = preparedSpellsMax(CHA_MOD, 10);
  check(cap10 === 13, `cap source: preparedSpellsMax(+3, L10) = 13 (got ${cap10})`);
  const ms10 = await makeCharacter({ name: 'MsTen', cls: 'bard', level: 10, chaScores: CHA3_SCORES });
  const msAt = await req('PUT', `/api/character/${ms10}`, { prepared_spells: J(MS_13) });
  check(msAt.status === 200,
    `PUT 13 incl. Fireball + Spirit Guardians (Magical Secrets picks) persists 200 (got ${msAt.status}: ${JSON.stringify(msAt.json?.error || '')})`);
  check(JSON.stringify(await readPrepared(ms10)) === JSON.stringify(MS_13),
    'Magical Secrets picks persisted as part of the prepared list');
  const msOver = await req('PUT', `/api/character/${ms10}`, { prepared_spells: J(MS_14) });
  check(msOver.status === 400, `PUT 14 incl. Magical Secrets picks refuses 400 (got ${msOver.status})`);
  check(typeof msOver.json?.error === 'string' && msOver.json.error.includes('preparedSpells') && msOver.json.error.includes('got 14'),
    `Magical Secrets refusal counts all 14 (got ${JSON.stringify(msOver.json?.error)})`);
  check(JSON.stringify(await readPrepared(ms10)) === JSON.stringify(MS_13),
    'refused Magical Secrets PUT left the stored list unchanged');
}

group('(b6) PUT skips: non-bard, secondary bard, no list, marker');
{
  // Control-cleric Wisdom (2026-11-09, gate fix): the control
  // cleric must be legal under the CLERIC cap too (Wis mod + cleric
  // level, #10 cleric PUT validator, character.js) — a Wis-10 L5
  // cleric caps at 5, so the 10-spell list 400s naming 'cleric' and
  // the skip under test is never reached. Wis 20 -> cap 10 at L5
  // (exactly at cap), cap 9 at L4, so the PUT returns 200 only if
  // the validator under test skips; if it misfired it would still
  // 400 (its own cap is 5 or less at these levels).
  // Non-bard (cleric) with a 10-spell list: no bard cap applies.
  const cleric5 = await makeCharacter({ name: 'ClericFive', cls: 'cleric', level: 5, chaScores: { ...CHA3_SCORES, wis: 20 } });
  const clericPut = await req('PUT', `/api/character/${cleric5}`, { prepared_spells: J(CLERIC_10) });
  check(clericPut.status === 200, `cleric PUT with ${CLERIC_10.length} prepared spells is unaffected, 200 (got ${clericPut.status})`);
  check(JSON.stringify(await readPrepared(cleric5)) === JSON.stringify(CLERIC_10), 'cleric long list persisted');
  // Bard-as-secondary multiclass: primary cleric governs the shared
  // column, so the bard cap does not fire on the PUT — a 5-spell
  // list sails through even though the bard entry is L1 (cap 4).
  const multi = await makeCharacter({
    name: 'ClericBard', cls: 'cleric', level: 5, chaScores: { ...CHA3_SCORES, wis: 20 },
    classLevels: [{ class: 'cleric', level: 4, subclass: null }, { class: 'bard', level: 1, subclass: null }],
  });
  const multiPut = await req('PUT', `/api/character/${multi}`, { prepared_spells: J(COUNTED_5) });
  check(multiPut.status === 200, `multiclass (cleric primary, bard secondary L1) PUT over the bard cap is skipped, 200 (got ${multiPut.status})`);
  check(JSON.stringify(await readPrepared(multi)) === JSON.stringify(COUNTED_5), 'multiclass long list persisted');
  // No prepared_spells in the body: a plain field update is unaffected.
  const bard5 = await makeCharacter({ name: 'BardNoList', cls: 'bard', level: 5, chaScores: CHA3_SCORES });
  await seedStoredPrepared(bard5, COUNTED_8);
  const plain = await req('PUT', `/api/character/${bard5}`, { name: 'BardNoList Renamed' });
  check(plain.status === 200, `PUT with no prepared_spells is unaffected, 200 (got ${plain.status})`);
  check((await readCharacter(bard5)).name === 'BardNoList Renamed', 'plain PUT still persisted the name change');
  check(JSON.stringify(await readPrepared(bard5)) === JSON.stringify(COUNTED_8), 'plain PUT left the stored prepared list alone');
  // Creator-marker PUT goes through the Stage 4 validator, not the new
  // block: the empty list passes, and a 5-spell marker list is Stage 4's
  // refusal ('bard picks 4 spells at level 1, got 5'), with Stage 4's
  // wording, not the new block's 'may prepare at most'.
  const markerBard = await makeCharacter({ name: 'BardMarker', cls: 'bard', level: 1, chaScores: CHA3_SCORES });
  const markerPut = await req('PUT', `/api/character/${markerBard}`, {
    creator: 'creator-next', prepared_spells: J([]),
  });
  check(markerPut.status === 200,
    `creator-marker PUT with an empty list passes 200 (got ${markerPut.status}: ${JSON.stringify(markerPut.json?.error || '')})`);
  check(JSON.stringify(await readPrepared(markerBard)) === JSON.stringify([]), 'marker PUT persisted the empty list');
  const markerOver = await req('PUT', `/api/character/${markerBard}`, {
    creator: 'creator-next', prepared_spells: J(COUNTED_5),
  });
  check(markerOver.status === 400,
    `creator-marker PUT with 5 spells refuses 400 via Stage 4 (got ${markerOver.status})`);
  check(typeof markerOver.json?.error === 'string' && markerOver.json.error.includes('preparedSpells'),
    `marker refusal names preparedSpells (got ${JSON.stringify(markerOver.json?.error)})`);
  check(typeof markerOver.json?.error === 'string' && markerOver.json.error.includes('picks 4 spells at level 1') && !markerOver.json.error.includes('may prepare at most'),
    `marker refusal is Stage 4's wording, not the new block's (got ${JSON.stringify(markerOver.json?.error)})`);
  check(JSON.stringify(await readPrepared(markerBard)) === JSON.stringify([]),
    'refused marker PUT left the stored prepared list unchanged');
}

// ===========================================================================
// (c) Level-up path — stored-list re-check on leveling up IN bard
// ===========================================================================
group('(c) level-up re-check: over-cap stored list blocks, level unchanged');
{
  // Bard L4 -> L5, Cha +3: new cap is preparedSpellsMax(+3, 5) = 8.
  const cap5 = preparedSpellsMax(CHA_MOD, 5);
  const over = await makeCharacter({
    name: 'BardLevelOver', cls: 'bard', level: 4, chaScores: CHA3_SCORES,
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
    name: 'BardLevelOk', cls: 'bard', level: 4, chaScores: CHA3_SCORES,
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

group('(c2) level-up re-check at L1 -> L2 (new cap 5, same Cha +3)');
{
  const cap2 = preparedSpellsMax(CHA_MOD, 2);
  check(cap2 === 5, `cap source: preparedSpellsMax(+3, L2) = 5 (got ${cap2})`);
  const over = await makeCharacter({ name: 'BardLevelOneOver', cls: 'bard', level: 1, chaScores: CHA3_SCORES });
  await db.dbRun('UPDATE characters SET experience = ? WHERE id = ?', [getXPToNextLevel(1), over]);
  // 6 stored spells: over the L2 cap of 5. (At L1 the same list could
  // never have been saved through the PUT — it is legacy state.)
  await seedStoredPrepared(over, [...COUNTED_5, 'Sleep']);
  const blocked = await req('POST', `/api/character/level-up/${over}`, {});
  check(blocked.status === 400, `L1->2 level-up with 6 stored spells (new cap ${cap2}) refuses 400 (got ${blocked.status})`);
  check(typeof blocked.json?.error === 'string' && blocked.json.error.includes('preparedSpells'),
    `L1->2 refusal names preparedSpells (got ${JSON.stringify(blocked.json?.error)})`);
  check((await readCharacter(over)).level === 1, 'blocked L1->2 level-up left the level at 1');
  check(JSON.stringify(await readPrepared(over)) === JSON.stringify([...COUNTED_5, 'Sleep']),
    'blocked L1->2 level-up left the stored prepared list unchanged');
}

group('(c3) level-up skips multiclass INTO bard');
{
  // Cleric 3 -> total 4 by multiclassing into bard, with a stored
  // 5-spell list from the cleric side. The list belongs to the other
  // class, so the re-check must not fire (bard L1 cap would be 4).
  const capBard1 = preparedSpellsMax(CHA_MOD, 1);
  check(capBard1 === 4, `cap source: bard L1 cap is ${capBard1} at Cha +3 (the stored 5 would fail it)`);
  const cleric = await makeCharacter({ name: 'ClericMultiBard', cls: 'cleric', level: 3, chaScores: CHA3_SCORES });
  await db.dbRun('UPDATE characters SET experience = ? WHERE id = ?', [getXPToNextLevel(3), cleric]);
  await seedStoredPrepared(cleric, COUNTED_5);
  const multi = await req('POST', `/api/character/level-up/${cleric}`, { selectedClass: 'Bard' });
  check(multi.status === 200,
    `multiclass into bard with a stored 5-spell list is NOT blocked, 200 (got ${multi.status}: ${JSON.stringify(multi.json?.error || '')})`);
  const multiRow = await readCharacter(cleric);
  check(multiRow.level === 4, 'multiclass level-up raised the total level to 4');
  const levels = JSON.parse(multiRow.class_levels || '[]');
  const bardEntry = levels.find((c) => String(c.class).toLowerCase() === 'bard');
  check(bardEntry?.level === 1, 'multiclass bard entry stored at level 1');
  check(JSON.stringify(JSON.parse(multiRow.prepared_spells)) === JSON.stringify(COUNTED_5),
    'multiclass level-up kept the stored prepared list');
}

group('(c4) level-up Moon exclusion: 9 counted + Moonbeam passes at L6');
{
  // Moon bard L5 -> L6, Cha +3: new cap is preparedSpellsMax(+3, 6) = 9.
  // Moonbeam becomes always-prepared at 6, so 9 counted + Moonbeam is
  // exactly at cap; 10 counted + Moonbeam is over.
  const cap6 = preparedSpellsMax(CHA_MOD, 6);
  check(cap6 === 9, `cap source: preparedSpellsMax(+3, L6) = 9 (got ${cap6})`);
  const moonOk = await makeCharacter({
    name: 'MoonLevelOk', cls: 'bard', level: 5, subclass: 'College of the Moon', chaScores: CHA3_SCORES,
  });
  await db.dbRun('UPDATE characters SET experience = ? WHERE id = ?', [getXPToNextLevel(5), moonOk]);
  await seedStoredPrepared(moonOk, [...COUNTED_9, 'Moonbeam']);
  const ok = await req('POST', `/api/character/level-up/${moonOk}`, {});
  check(ok.status === 200,
    `Moon L5->6 level-up with 9 counted + Moonbeam succeeds 200 (got ${ok.status}: ${JSON.stringify(ok.json?.error || '')})`);
  check((await readCharacter(moonOk)).level === 6, 'Moon level-up raised the level to 6');
  const moonOver = await makeCharacter({
    name: 'MoonLevelOver', cls: 'bard', level: 5, subclass: 'College of the Moon', chaScores: CHA3_SCORES,
  });
  await db.dbRun('UPDATE characters SET experience = ? WHERE id = ?', [getXPToNextLevel(5), moonOver]);
  await seedStoredPrepared(moonOver, [...COUNTED_10, 'Moonbeam']);
  const blocked = await req('POST', `/api/character/level-up/${moonOver}`, {});
  check(blocked.status === 400, `Moon L5->6 level-up with 10 counted + Moonbeam refuses 400 (got ${blocked.status})`);
  check(typeof blocked.json?.error === 'string' && blocked.json.error.includes('preparedSpells') && blocked.json.error.includes('got 10'),
    `Moon level-up refusal names preparedSpells and counts 10 (got ${JSON.stringify(blocked.json?.error)})`);
  check((await readCharacter(moonOver)).level === 5, 'blocked Moon level-up left the level at 5');
  check(JSON.stringify(await readPrepared(moonOver)) === JSON.stringify([...COUNTED_10, 'Moonbeam']),
    'blocked Moon level-up left the stored prepared list unchanged');
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
      const b = getSpellsPrepared('bard', level, mod);
      if (a !== b) {
        mismatches++;
        console.error(`  ✗ mismatch mod ${mod} level ${level}: preparedSpellsMax=${a}, getSpellsPrepared=${b}`);
      }
    }
  }
  check(mismatches === 0, `preparedSpellsMax == getSpellsPrepared('bard', …) at all 20 levels × mods [-5, -1, 0, 1, 3, 5] (${mismatches} mismatches)`);
}

server.close();
console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
process.exit(failed > 0 ? 1 : 0);
