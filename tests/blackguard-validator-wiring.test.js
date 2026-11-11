// tests/blackguard-validator-wiring.test.js — blackguard prepared-spell cap
// wiring (2026-11-06): the slot-gated 2024 formula (Cha mod + half blackguard
// level, min 1; 0 at L1 — no 1st-level slots) was enforced only at creation
// (Stage 4) — the character sheet's bare { prepared_spells } PUT sailed
// through, and a legacy over-cap list already on a row could sit there until
// level-up. This build wires the enforcement into the two live surfaces
// that touch prepared_spells, mirroring the artificer wiring:
//   - PUT /:id — a non-marker body carrying prepared_spells on a
//     primary-blackguard row is validated with blackguardService
//     .validatePreparedSpells (chaMod FIRST — the arg order differs from
//     the artificer validator); over cap -> 400 naming preparedSpells, row
//     unchanged. Non-blackguards, marker bodies, and blackguard-as-secondary
//     multiclass skip entirely. Vice spells (always-prepared, kind-'D')
//     are excluded via subclassService.blackguardViceSpellsAtLevel.
//   - POST /level-up/:id — leveling up IN blackguard (not multiclassing
//     into it) re-checks the STORED list against the new level and the
//     post-ASI Cha mod; over cap -> 400 naming preparedSpells, level
//     unchanged (no DB writes happen before the check).
//   - server/services/blackguardService.js preparedSpellsMax is slot-gated
//     and agrees with levelProgression.getSpellsPrepared at every level.
//   - The sheet's getMaxPrepared gained a blackguard branch (0 at L1).
//
// Honest integration tests: preparedSpellsMax / validatePreparedSpells are
// imported from the real blackguardService.js, blackguardViceSpellsAtLevel
// from the real subclassService.js, getSpellsPrepared / getXPToNextLevel
// from the real levelProgression.js, and every PUT/level-up case drives the
// real character router over HTTP on a real throwaway DB (the
// levelup-subclass-prompts harness). Expected caps are derived from the real
// preparedSpellsMax, never hardcoded where the service is the authority.
// If blackguardService.js, subclassService.js, or character.js were deleted,
// the imports fail and the suite fails with them.
//
// Fixture trap (levelup-subclass-prompts): a row that already spent its
// level-up 400s on XP on the next attempt — every level-up case gets a
// fresh row. Over-cap stored lists are seeded with a direct DB UPDATE,
// never through the PUT — the PUT would (correctly) refuse them, and the
// point of the level-up re-check is exactly the legacy state the PUT
// can no longer create.
//
// Marker note: a creator-marker body goes through the Stage 4 validator,
// whose L1 cap for blackguard is ALSO 0 (getSpellsPrepared at level 1) —
// so no non-empty marker list can be a 200 for a blackguard the way the
// artificer's 3-spell L1 list was. The marker case here is therefore the
// empty list (200, proving the marker path works) plus a 1-spell marker
// list (400 from Stage 4 — 'picks 0 spells at level 1' — proving the
// marker body is governed by Stage 4, NOT by the new block's
// 'may prepare at most' refusal).
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

const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'blackguard-validator-wiring-test-'));
const tmpDir = repoRoot;
const origCwd = process.cwd();
process.chdir(tmpDir);
delete process.env.TURSO_DATABASE_URL;
delete process.env.TURSO_AUTH_TOKEN;
const fromRepo = (rel) => pathToFileURL(path.join(origCwd, rel)).href;
const readRepo = (rel) => fs.readFileSync(path.join(origCwd, rel), 'utf8');

const db = await import(fromRepo('server/database.js'));
await db.initDatabase();
// The real services under test — caps come from these, not from literals.
const bg = await import(fromRepo('server/services/blackguardService.js'));
const { preparedSpellsMax, validatePreparedSpells } = bg;
const { blackguardViceSpellsAtLevel } = await import(fromRepo('server/services/subclassService.js'));
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
// with level: L1 -> 0 (no slots), L2 -> 4, L5 -> 5, per the 2024 formula.
const CHA3_SCORES = { str: 10, dex: 10, con: 14, int: 10, wis: 10, cha: 16 };
const CHA_MOD = 3;

// Counted (non-always-prepared) blackguard spells; the validator counts
// by name, so the exact spells only need to be distinct strings —
// title-cased here so none collides with the lowercase vice-spell names
// in the registry ('bane', 'inflict wounds', ...).
const COUNTED_1 = ['Hex'];
const COUNTED_4 = ['Hex', 'Command', 'Shield of Faith', 'Wrathful Smite'];
const COUNTED_5 = [...COUNTED_4, 'Cause Fear'];
const COUNTED_6 = [...COUNTED_5, 'Hold Person'];
const CLERIC_10 = ['Cure Wounds', 'Bless', 'Guiding Bolt', 'Healing Word', 'Shield of Faith',
  'Sanctuary', 'Command', 'Inflict Wounds', 'Protection from Evil and Good', 'Detect Magic'];
// Despair vice spells, exactly as the registry stores them (lowercase) —
// the validator excludes by exact string match, so the case matters.
const DESPAIR_L3 = ['bane', 'inflict wounds'];
const DESPAIR_L5 = [...DESPAIR_L3, 'darkness', 'ray of enfeeblement'];

async function makeCharacter({ name, cls, level, subclass = null, chaScores = null, classLevels = null }) {
  // MVP gray-out (2026-11-08): a blackguard PC can no longer be
  // created through the routes (POST/PUT refuse it with 400), so
  // blackguard fixtures are seeded directly — legacy state, the same
  // justification seedStoredPrepared uses below ("bypasses the route
  // on purpose, like a row written before this build existed"). The
  // PUTs under test still drive the real route over HTTP; only the
  // fixture setup bypasses it. The PRAGMA-driven filler (copied from
  // subclass-scanned4.test.js) covers every NOT NULL column, so the
  // insert never misses a required column. Non-deferred classes
  // still go through the real POST + PUT.
  if (cls === 'blackguard') {
    const id = await insertRow('characters', {
      name, class: cls, race: 'human',
      level, experience: getXPToNextLevel(level - 1) || 0,
      max_hp: 20, current_hp: 20, subclass,
      ability_scores: J(chaScores || { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }),
      class_levels: J(classLevels || [{ class: cls, level, subclass }]),
    });
    return id;
  }
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

// Direct-insert helper (subclass-scanned4.test.js pattern): the
// PRAGMA read fills every NOT NULL column with no default, so the
// insert never misses a required column.
async function insertRow(table, overrides = {}) {
  const info = await db.dbAll(`PRAGMA table_info(${table})`);
  const cols = [];
  const vals = [];
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
  const r = await db.dbRun(
    `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`, vals
  );
  return Number(r.lastInsertRowid);
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
// (a) Helper: blackguardViceSpellsAtLevel — real import, real data
// ===========================================================================
group('(a) blackguardViceSpellsAtLevel (real subclassService import)');
{
  const d3 = blackguardViceSpellsAtLevel('blackguard', 'despair', 3);
  check(JSON.stringify(d3) === JSON.stringify(DESPAIR_L3),
    `despair L3: bane + inflict wounds (got ${JSON.stringify(d3)})`);
  const d5 = blackguardViceSpellsAtLevel('blackguard', 'despair', 5);
  check(JSON.stringify(d5) === JSON.stringify(DESPAIR_L5),
    `despair L5 cumulative adds darkness + ray of enfeeblement (got ${JSON.stringify(d5)})`);
  const d9 = blackguardViceSpellsAtLevel('blackguard', 'despair', 9);
  check(d9.length === 6 && d9.includes('animate dead') && d9.includes('bestow curse'),
    `despair L9 cumulative is 6 incl. animate dead + bestow curse (got ${JSON.stringify(d9)})`);
  check(JSON.stringify(blackguardViceSpellsAtLevel('blackguard', 'despair', 2)) === JSON.stringify([]),
    'despair L2 (before vice level 3): []');
  check(JSON.stringify(blackguardViceSpellsAtLevel('blackguard', 'pride', 5)) ===
    JSON.stringify(['charm person', 'cure wounds', 'detect thoughts', 'suggestion']),
    `pride L5 cumulative is 4 incl. charm person + suggestion (got ${JSON.stringify(blackguardViceSpellsAtLevel('blackguard', 'pride', 5))})`);
  check(JSON.stringify(blackguardViceSpellsAtLevel('blackguard', 'treachery', 5)) ===
    JSON.stringify(['charm person', 'expeditious retreat', 'invisibility', 'mirror image']),
    'treachery L5 cumulative is 4 incl. invisibility + mirror image');
  // Domination/Fury vice lists are RESOLVED (item 25, coordinator
  // ruling 2026-11-06): Domination = Oath of Conquest, Fury = Oath of
  // Vengeance, at oath tiers (3/5/9/13/17). The helper returns the
  // live lists (Title Case, as the paladin source stores them).
  check(JSON.stringify(blackguardViceSpellsAtLevel('blackguard', 'domination', 5)) ===
    JSON.stringify(['Armor of Agathys', 'Command', 'Hold Person', 'Spiritual Weapon']),
    `domination L5: Conquest list (got ${JSON.stringify(blackguardViceSpellsAtLevel('blackguard', 'domination', 5))})`);
  check(JSON.stringify(blackguardViceSpellsAtLevel('blackguard', 'fury', 5)) ===
    JSON.stringify(['Bane', "Hunter's Mark", 'Hold Person', 'Misty Step']),
    `fury L5: Vengeance list (got ${JSON.stringify(blackguardViceSpellsAtLevel('blackguard', 'fury', 5))})`);
  check(JSON.stringify(blackguardViceSpellsAtLevel('blackguard', null, 5)) === JSON.stringify([]),
    'no subclass: []');
  // Sanity: the service-level validator the routes call agrees with the
  // formula at the levels the route tests below use as boundaries, and
  // excludes an always-prepared name from the count.
  check(preparedSpellsMax(CHA_MOD, 1) === 0, 'cap source: preparedSpellsMax(+3, L1) = 0 (no slots)');
  check(preparedSpellsMax(CHA_MOD, 2) === 4, 'cap source: preparedSpellsMax(+3, L2) = 4');
  check(preparedSpellsMax(CHA_MOD, 5) === 5, 'cap source: preparedSpellsMax(+3, L5) = 5');
  const v = validatePreparedSpells(CHA_MOD, 5, [...COUNTED_5, 'bane'], ['bane']);
  check(v.ok && v.counted === 5 && v.max === 5, 'validator excludes an always-prepared name from the count');
  const v1 = validatePreparedSpells(CHA_MOD, 1, ['Hex'], []);
  check(!v1.ok && v1.max === 0 && v1.counted === 1, 'validator at L1: max 0, a 1-spell list refuses');
}

// ===========================================================================
// (b) PUT path — the character sheet save
// ===========================================================================
group('(b) PUT refuses over-cap, persists at-cap (blackguard L5, Cha +3)');
{
  const cap5 = preparedSpellsMax(CHA_MOD, 5);
  const bg5 = await makeCharacter({ name: 'BgFive', cls: 'blackguard', level: 5, chaScores: CHA3_SCORES });
  // Seed a valid list first so the refusal case can prove the row is unchanged.
  const seed = await req('PUT', `/api/character/${bg5}`, { prepared_spells: J(COUNTED_5) });
  check(seed.status === 200, `PUT at-cap (${cap5} spells) persists 200 (got ${seed.status})`);
  check(JSON.stringify(await readPrepared(bg5)) === JSON.stringify(COUNTED_5), 'at-cap list persisted and reads back');
  // One over the cap: 400, error names preparedSpells, row untouched.
  const over = await req('PUT', `/api/character/${bg5}`, { prepared_spells: J(COUNTED_6) });
  check(over.status === 400, `PUT ${COUNTED_6.length} spells (cap ${cap5}) refuses 400 (got ${over.status})`);
  check(typeof over.json?.error === 'string' && over.json.error.includes('preparedSpells'),
    `PUT refusal names preparedSpells (got ${JSON.stringify(over.json?.error)})`);
  check(typeof over.json?.error === 'string' && over.json.error.includes(`at most ${cap5}`) && over.json.error.includes('got 6'),
    `PUT refusal states the cap and count (got ${JSON.stringify(over.json?.error)})`);
  check(typeof over.json?.error === 'string' && over.json.error.includes('blackguard level 5') && over.json.error.includes('Cha mod 3'),
    `PUT refusal names the blackguard level and Cha mod (got ${JSON.stringify(over.json?.error)})`);
  check(JSON.stringify(await readPrepared(bg5)) === JSON.stringify(COUNTED_5),
    'refused PUT left the stored prepared list unchanged');
  // A different at-cap list still saves after the refusal.
  const again = await req('PUT', `/api/character/${bg5}`, { prepared_spells: J([...COUNTED_4, 'Hold Person']) });
  check(again.status === 200, 'PUT at-cap again after a refusal persists 200');
  check(JSON.stringify(await readPrepared(bg5)) === JSON.stringify([...COUNTED_4, 'Hold Person']),
    'second at-cap list persisted and reads back');
  // The camelCase alias the sheet also sends is validated the same way.
  const camel = await req('PUT', `/api/character/${bg5}`, { preparedSpells: J(COUNTED_6) });
  check(camel.status === 400, `PUT via preparedSpells (camelCase) over cap refuses 400 (got ${camel.status})`);
  // The status alone does not discriminate: a camelCase-only body with no
  // wiring ALSO 400s ('No valid fields to update' — the generic UPDATE
  // does not know the camelCase key). The error text is the proof the
  // camelCase body went through the blackguard validator instead.
  check(typeof camel.json?.error === 'string' && camel.json.error.includes('preparedSpells') && camel.json.error.includes('may prepare at most 5') && camel.json.error.includes('got 6'),
    `camelCase refusal is the blackguard cap error, not 'No valid fields' (got ${JSON.stringify(camel.json?.error)})`);
}

group('(b2) PUT — L1 boundary: cap 0, a 1-spell list refuses, empty passes');
{
  const cap1 = preparedSpellsMax(CHA_MOD, 1);
  check(cap1 === 0, `cap source: preparedSpellsMax(+3, L1) = 0 (got ${cap1})`);
  const bg1 = await makeCharacter({ name: 'BgOne', cls: 'blackguard', level: 1, chaScores: CHA3_SCORES });
  const over1 = await req('PUT', `/api/character/${bg1}`, { prepared_spells: J(COUNTED_1) });
  check(over1.status === 400, `PUT 1 spell at L1 (cap ${cap1}) refuses 400 (got ${over1.status})`);
  check(typeof over1.json?.error === 'string' && over1.json.error.includes('preparedSpells') && over1.json.error.includes('at most 0') && over1.json.error.includes('got 1'),
    `L1 refusal names preparedSpells, cap 0, got 1 (got ${JSON.stringify(over1.json?.error)})`);
  check(JSON.stringify(await readPrepared(bg1)) === JSON.stringify([]),
    'refused L1 PUT left the stored prepared list empty');
  const empty = await req('PUT', `/api/character/${bg1}`, { prepared_spells: J([]) });
  check(empty.status === 200, `PUT empty list at L1 persists 200 (got ${empty.status})`);
  check(JSON.stringify(await readPrepared(bg1)) === JSON.stringify([]), 'empty L1 list persisted');
}

group('(b3) PUT cap grows with level — L2 vs L5, same Cha +3');
{
  const cap2 = preparedSpellsMax(CHA_MOD, 2);
  const cap5 = preparedSpellsMax(CHA_MOD, 5);
  check(cap2 === 4 && cap5 === 5, `cap source: L2 cap ${cap2}, L5 cap ${cap5} (got ${cap2}/${cap5})`);
  const bg2 = await makeCharacter({ name: 'BgTwo', cls: 'blackguard', level: 2, chaScores: CHA3_SCORES });
  const over2 = await req('PUT', `/api/character/${bg2}`, { prepared_spells: J(COUNTED_5) });
  check(over2.status === 400, `PUT ${COUNTED_5.length} spells at L2 (cap ${cap2}) refuses 400 (got ${over2.status})`);
  const at2 = await req('PUT', `/api/character/${bg2}`, { prepared_spells: J(COUNTED_4) });
  check(at2.status === 200, `PUT ${cap2} spells at L2 persists 200 (got ${at2.status})`);
  check(JSON.stringify(await readPrepared(bg2)) === JSON.stringify(COUNTED_4), 'L2 at-cap list persisted');
  // Same Cha mod, higher level, bigger cap: the L2-refused 5-spell list
  // is legal at L5 — the boundary moves with the formula, not the mod.
  const bg5b = await makeCharacter({ name: 'BgFiveB', cls: 'blackguard', level: 5, chaScores: CHA3_SCORES });
  const at5 = await req('PUT', `/api/character/${bg5b}`, { prepared_spells: J(COUNTED_5) });
  check(at5.status === 200, `PUT ${COUNTED_5.length} spells at L5 (cap ${cap5}) persists 200 (got ${at5.status})`);
  check(preparedSpellsMax(CHA_MOD, 5) > preparedSpellsMax(CHA_MOD, 2), 'cap at L5 exceeds cap at L2 with the same Cha mod (+3)');
}

group('(b4) PUT — Despair always-prepared spells do not count');
{
  const cap5 = preparedSpellsMax(CHA_MOD, 5);
  const desp5 = await makeCharacter({
    name: 'DespairFive', cls: 'blackguard', level: 5, subclass: 'despair', chaScores: CHA3_SCORES,
  });
  const always5 = blackguardViceSpellsAtLevel('blackguard', 'despair', 5);
  check(always5.length === 4, `despair always-prepared at L5 is 4 spells (got ${JSON.stringify(always5)})`);
  // 5 counted + 2 always-prepared names in the list: counted stays 5.
  const withAlways = await req('PUT', `/api/character/${desp5}`, {
    prepared_spells: J([...COUNTED_5, 'bane', 'inflict wounds']),
  });
  check(withAlways.status === 200,
    `PUT 5 counted + 2 always-prepared persists 200 (got ${withAlways.status}: ${JSON.stringify(withAlways.json?.error || '')})`);
  check((await readPrepared(desp5)).length === 7, 'all 7 sent names persisted (always-prepared are stored, just not counted)');
  // 6 counted + the same 2 always-prepared: counted 6 > cap 5 -> 400.
  const overDesp = await req('PUT', `/api/character/${desp5}`, {
    prepared_spells: J([...COUNTED_6, 'bane', 'inflict wounds']),
  });
  check(overDesp.status === 400, `PUT 6 counted + always-prepared refuses 400 (got ${overDesp.status})`);
  check(typeof overDesp.json?.error === 'string' && overDesp.json.error.includes('preparedSpells') && overDesp.json.error.includes('got 6'),
    `despair refusal names preparedSpells and counts 6 (got ${JSON.stringify(overDesp.json?.error)})`);
  check((await readPrepared(desp5)).length === 7, 'refused despair PUT left the stored list unchanged');
}

group('(b5) PUT — Domination/Fury vice spells do not count (item 25)');
{
  // The oath mapping is RESOLVED (coordinator ruling 2026-11-06):
  // Domination = Oath of Conquest spells, Fury = Oath of Vengeance
  // spells, at oath tiers (3/5/9/13/17). The helper returns the live
  // lists (Title Case, as the paladin source stores them); the route
  // excludes them case-insensitively, like the other three vices.
  const dom5 = await makeCharacter({
    name: 'DomFive', cls: 'blackguard', level: 5, subclass: 'domination', chaScores: CHA3_SCORES,
  });
  check(JSON.stringify(blackguardViceSpellsAtLevel('blackguard', 'domination', 5)) ===
    JSON.stringify(['Armor of Agathys', 'Command', 'Hold Person', 'Spiritual Weapon']),
    `domination always-prepared at L5 is the Conquest list (got ${JSON.stringify(blackguardViceSpellsAtLevel('blackguard', 'domination', 5))})`);
  // COUNTED_6 carries 'Command' + 'Hold Person' — both Domination
  // vice spells — so counted is 4, under the cap 5: 200, all 6 stored.
  const domOver = await req('PUT', `/api/character/${dom5}`, { prepared_spells: J(COUNTED_6) });
  check(domOver.status === 200, `domination PUT 6 names (2 vice, counted 4) persists 200 (got ${domOver.status}: ${JSON.stringify(domOver.json?.error || '')})`);
  check(JSON.stringify(await readPrepared(dom5)) === JSON.stringify(COUNTED_6),
    'domination 6-name list persisted and reads back');
  // 6 counted (no vice names): counted 6 > cap 5 -> 400, 'got 6'.
  const domCounted6 = ['Hex', 'Shield of Faith', 'Wrathful Smite', 'Cause Fear', 'Bane', 'Inflict Wounds'];
  const domRefused = await req('PUT', `/api/character/${dom5}`, { prepared_spells: J(domCounted6) });
  check(domRefused.status === 400, `domination PUT 6 counted spells refuses 400 (got ${domRefused.status})`);
  check(typeof domRefused.json?.error === 'string' && domRefused.json.error.includes('got 6'),
    `domination refusal counts all 6 (got ${JSON.stringify(domRefused.json?.error)})`);
  check(JSON.stringify(await readPrepared(dom5)) === JSON.stringify(COUNTED_6),
    'refused domination PUT left the stored list unchanged');
  const fury5 = await makeCharacter({
    name: 'FuryFive', cls: 'blackguard', level: 5, subclass: 'fury', chaScores: CHA3_SCORES,
  });
  check(JSON.stringify(blackguardViceSpellsAtLevel('blackguard', 'fury', 5)) ===
    JSON.stringify(['Bane', "Hunter's Mark", 'Hold Person', 'Misty Step']),
    `fury always-prepared at L5 is the Vengeance list (got ${JSON.stringify(blackguardViceSpellsAtLevel('blackguard', 'fury', 5))})`);
  // COUNTED_6 carries 'Hold Person' — a Fury vice spell — so counted
  // is 5, exactly at cap: 200.
  const furyAt = await req('PUT', `/api/character/${fury5}`, { prepared_spells: J(COUNTED_6) });
  check(furyAt.status === 200, `fury PUT 6 names (1 vice, counted 5) persists 200 at cap (got ${furyAt.status}: ${JSON.stringify(furyAt.json?.error || '')})`);
  // 6 counted (no vice names): counted 6 > cap 5 -> 400, 'got 6'.
  const furyCounted6 = ['Hex', 'Command', 'Shield of Faith', 'Wrathful Smite', 'Cause Fear', 'Inflict Wounds'];
  const furyOver = await req('PUT', `/api/character/${fury5}`, { prepared_spells: J(furyCounted6) });
  check(furyOver.status === 400, `fury PUT 6 counted spells refuses 400 (got ${furyOver.status})`);
  check(typeof furyOver.json?.error === 'string' && furyOver.json.error.includes('got 6'),
    `fury refusal counts all 6 (got ${JSON.stringify(furyOver.json?.error)})`);
  check(JSON.stringify(await readPrepared(fury5)) === JSON.stringify(COUNTED_6),
    'refused fury PUT left the stored list unchanged');
}

group('(b6) PUT skips: non-blackguard, secondary blackguard, no list, marker');
{
  // Control-cleric Wisdom (2026-11-09, gate fix): the control
  // cleric must be legal under the CLERIC cap too (Wis mod + cleric
  // level, #10 cleric PUT validator, character.js) — a Wis-10 L5
  // cleric caps at 5, so the 10-spell list 400s naming 'cleric' and
  // the skip under test is never reached. Wis 20 -> cap 10 at L5
  // (exactly at cap), cap 9 at L4, so the PUT returns 200 only if
  // the validator under test skips; if it misfired it would still
  // 400 (its own cap is 5 or less at these levels).
  // Non-blackguard (cleric) with a 10-spell list: no blackguard cap applies.
  const cleric5 = await makeCharacter({ name: 'ClericFive', cls: 'cleric', level: 5, chaScores: { ...CHA3_SCORES, wis: 20 } });
  const clericPut = await req('PUT', `/api/character/${cleric5}`, { prepared_spells: J(CLERIC_10) });
  check(clericPut.status === 200, `cleric PUT with ${CLERIC_10.length} prepared spells is unaffected, 200 (got ${clericPut.status})`);
  check(JSON.stringify(await readPrepared(cleric5)) === JSON.stringify(CLERIC_10), 'cleric long list persisted');
  // Blackguard-as-secondary multiclass: primary cleric governs the shared
  // column, so the blackguard cap does not fire on the PUT — a 6-spell
  // list sails through even though the blackguard entry is L1 (cap 0).
  // MVP gray-out (2026-11-08): the blackguard secondary can no longer
  // be ADDED through a PUT — that PUT refuses 400 first. The cap-skip
  // itself is pinned on a legacy row: the secondary is seeded directly
  // (a row written before the gray-out), then the prepared-spells PUT
  // still sails through.
  const multi = await makeCharacter({
    name: 'ClericBg', cls: 'cleric', level: 5, chaScores: { ...CHA3_SCORES, wis: 20 },
    classLevels: [{ class: 'cleric', level: 4, subclass: null }],
  });
  const addBg = await req('PUT', `/api/character/${multi}`, {
    class_levels: J([{ class: 'cleric', level: 4, subclass: null }, { class: 'blackguard', level: 1, subclass: null }]),
  });
  check(addBg.status === 400, `PUT adding a blackguard secondary to class_levels refuses 400 (got ${addBg.status})`);
  check(typeof addBg.json?.error === 'string' && addBg.json.error.includes('Class Blackguard is not available'),
    `class_levels refusal names Blackguard (got ${JSON.stringify(addBg.json?.error)})`);
  await db.dbRun('UPDATE characters SET class_levels = ? WHERE id = ?', [
    J([{ class: 'cleric', level: 4, subclass: null }, { class: 'blackguard', level: 1, subclass: null }]), multi,
  ]);
  const multiPut = await req('PUT', `/api/character/${multi}`, { prepared_spells: J(COUNTED_6) });
  check(multiPut.status === 200, `multiclass (cleric primary, blackguard secondary L1) PUT over the blackguard cap is skipped, 200 (got ${multiPut.status})`);
  check(JSON.stringify(await readPrepared(multi)) === JSON.stringify(COUNTED_6), 'multiclass long list persisted');
  // No prepared_spells in the body: a plain field update is unaffected.
  const bg5 = await makeCharacter({ name: 'BgNoList', cls: 'blackguard', level: 5, chaScores: CHA3_SCORES });
  await seedStoredPrepared(bg5, COUNTED_5);
  const plain = await req('PUT', `/api/character/${bg5}`, { name: 'BgNoList Renamed' });
  check(plain.status === 200, `PUT with no prepared_spells is unaffected, 200 (got ${plain.status})`);
  check((await readCharacter(bg5)).name === 'BgNoList Renamed', 'plain PUT still persisted the name change');
  check(JSON.stringify(await readPrepared(bg5)) === JSON.stringify(COUNTED_5), 'plain PUT left the stored prepared list alone');
  // Creator-marker PUT goes through the Stage 4 validator, not the new
  // block: the empty list passes (Stage 4's L1 cap is 0 too — see the
  // header note — so a non-empty marker list is Stage 4's refusal, with
  // Stage 4's wording, not the new block's 'may prepare at most').
  const markerBg = await makeCharacter({ name: 'BgMarker', cls: 'blackguard', level: 1, chaScores: CHA3_SCORES });
  const markerPut = await req('PUT', `/api/character/${markerBg}`, {
    creator: 'creator-next', prepared_spells: J([]),
  });
  check(markerPut.status === 200,
    `creator-marker PUT with an empty list passes 200 (got ${markerPut.status}: ${JSON.stringify(markerPut.json?.error || '')})`);
  check(JSON.stringify(await readPrepared(markerBg)) === JSON.stringify([]), 'marker PUT persisted the empty list');
  const markerOver = await req('PUT', `/api/character/${markerBg}`, {
    creator: 'creator-next', prepared_spells: J(COUNTED_1),
  });
  check(markerOver.status === 400,
    `creator-marker PUT with 1 spell refuses 400 via Stage 4 (got ${markerOver.status})`);
  check(typeof markerOver.json?.error === 'string' && markerOver.json.error.includes('preparedSpells'),
    `marker refusal names preparedSpells (got ${JSON.stringify(markerOver.json?.error)})`);
  check(typeof markerOver.json?.error === 'string' && !markerOver.json.error.includes('may prepare at most'),
    `marker refusal is Stage 4's wording, not the new block's (got ${JSON.stringify(markerOver.json?.error)})`);
  check(JSON.stringify(await readPrepared(markerBg)) === JSON.stringify([]),
    'refused marker PUT left the stored prepared list unchanged');
}

// ===========================================================================
// (c) Level-up path — stored-list re-check on leveling up IN blackguard
// ===========================================================================
group('(c) level-up re-check: over-cap stored list blocks, level unchanged');
{
  // Blackguard L4 -> L5, Cha +3: new cap is preparedSpellsMax(+3, 5) = 5.
  const cap5 = preparedSpellsMax(CHA_MOD, 5);
  const over = await makeCharacter({
    name: 'BgLevelOver', cls: 'blackguard', level: 4, subclass: 'despair', chaScores: CHA3_SCORES,
  });
  await db.dbRun('UPDATE characters SET experience = ? WHERE id = ?', [getXPToNextLevel(4), over]);
  await seedStoredPrepared(over, COUNTED_6);
  const blocked = await req('POST', `/api/character/level-up/${over}`, {});
  check(blocked.status === 400, `level-up with stored ${COUNTED_6.length} spells (new cap ${cap5}) refuses 400 (got ${blocked.status})`);
  check(typeof blocked.json?.error === 'string' && blocked.json.error.includes('preparedSpells'),
    `level-up refusal names preparedSpells (got ${JSON.stringify(blocked.json?.error)})`);
  check(typeof blocked.json?.error === 'string' && blocked.json.error.includes('fix the prepared list'),
    'level-up refusal tells the player to fix the list on the character sheet');
  check(typeof blocked.json?.error === 'string' && blocked.json.error.includes(`at most ${cap5}`) && blocked.json.error.includes('got 6'),
    `level-up refusal states the cap and count (got ${JSON.stringify(blocked.json?.error)})`);
  const overRow = await readCharacter(over);
  check(overRow.level === 4, 'blocked level-up left the level at 4');
  check(JSON.stringify(JSON.parse(overRow.prepared_spells)) === JSON.stringify(COUNTED_6),
    'blocked level-up left the stored prepared list unchanged');

  // Same shape, valid stored list: 200, level increases to 5.
  const valid = await makeCharacter({
    name: 'BgLevelOk', cls: 'blackguard', level: 4, subclass: 'despair', chaScores: CHA3_SCORES,
  });
  await db.dbRun('UPDATE characters SET experience = ? WHERE id = ?', [getXPToNextLevel(4), valid]);
  await seedStoredPrepared(valid, COUNTED_5);
  const ok = await req('POST', `/api/character/level-up/${valid}`, {});
  check(ok.status === 200, `level-up with a valid stored list succeeds 200 (got ${ok.status}: ${JSON.stringify(ok.json?.error || '')})`);
  const okRow = await readCharacter(valid);
  check(okRow.level === 5, 'valid level-up raised the level to 5');
  check(JSON.stringify(JSON.parse(okRow.prepared_spells)) === JSON.stringify(COUNTED_5),
    'valid level-up kept the stored prepared list');
}

group('(c2) level-up re-check at L1 -> L2 (new cap 4, same Cha +3)');
{
  const cap2 = preparedSpellsMax(CHA_MOD, 2);
  check(cap2 === 4, `cap source: preparedSpellsMax(+3, L2) = 4 (got ${cap2})`);
  const over = await makeCharacter({ name: 'BgLevelOneOver', cls: 'blackguard', level: 1, chaScores: CHA3_SCORES });
  await db.dbRun('UPDATE characters SET experience = ? WHERE id = ?', [getXPToNextLevel(1), over]);
  // 5 stored spells: over the L2 cap of 4. (At L1 the same list could
  // never have been saved through the PUT — it is legacy state.)
  await seedStoredPrepared(over, COUNTED_5);
  const blocked = await req('POST', `/api/character/level-up/${over}`, {});
  check(blocked.status === 400, `L1->2 level-up with 5 stored spells (new cap ${cap2}) refuses 400 (got ${blocked.status})`);
  check(typeof blocked.json?.error === 'string' && blocked.json.error.includes('preparedSpells'),
    `L1->2 refusal names preparedSpells (got ${JSON.stringify(blocked.json?.error)})`);
  check((await readCharacter(over)).level === 1, 'blocked L1->2 level-up left the level at 1');
  check(JSON.stringify(await readPrepared(over)) === JSON.stringify(COUNTED_5),
    'blocked L1->2 level-up left the stored prepared list unchanged');
}

group('(c3) multiclass INTO blackguard is refused (MVP gray-out)');
{
  // Cleric 3 -> total 4 by multiclassing into blackguard, with a stored
  // 4-spell list from the cleric side. MVP gray-out (2026-11-08): the
  // multiclass itself is refused with 400 naming the class, so the
  // level-up re-check never gets a chance to (not) fire — the list
  // belongs to the other class, and the refusal leaves the row alone.
  // (Before the gray-out this asserted 200: the re-check skipped
  // multiclass-into-blackguard because blackguard L1 cap would be 0.)
  const capBg1 = preparedSpellsMax(CHA_MOD, 1);
  check(capBg1 === 0, `cap source: blackguard L1 cap is ${capBg1} at Cha +3 (the stored 4 would fail it)`);
  const cleric = await makeCharacter({ name: 'ClericMultiBg', cls: 'cleric', level: 3, chaScores: CHA3_SCORES });
  await db.dbRun('UPDATE characters SET experience = ? WHERE id = ?', [getXPToNextLevel(3), cleric]);
  await seedStoredPrepared(cleric, COUNTED_4);
  const multi = await req('POST', `/api/character/level-up/${cleric}`, { selectedClass: 'Blackguard' });
  check(multi.status === 400,
    `multiclass into blackguard refuses 400 (got ${multi.status}: ${JSON.stringify(multi.json?.error || '')})`);
  check(typeof multi.json?.error === 'string' && multi.json.error.includes('Class Blackguard is not available'),
    `multiclass-into-blackguard refusal names the class (got ${JSON.stringify(multi.json?.error)})`);
  const multiRow = await readCharacter(cleric);
  check(multiRow.level === 3, 'refused multiclass left the total level at 3');
  const levels = JSON.parse(multiRow.class_levels || '[]');
  check(!levels.some((c) => String(c.class).toLowerCase() === 'blackguard'),
    'refused multiclass added no blackguard entry');
  check(JSON.stringify(JSON.parse(multiRow.prepared_spells)) === JSON.stringify(COUNTED_4),
    'refused multiclass kept the stored prepared list');
}

// ===========================================================================
// (d) Static guard: the sheet's getMaxPrepared has the blackguard branch
// ===========================================================================
group('(d) CharacterSheet getMaxPrepared blackguard branch (static guard)');
{
  const sheetSrc = readRepo('client/src/components/CharacterSheet.jsx');
  const fnStart = sheetSrc.indexOf('const getMaxPrepared');
  check(fnStart !== -1, 'CharacterSheet.jsx defines getMaxPrepared');
  const fnEnd = sheetSrc.indexOf('const isPreparedCaster', fnStart);
  const fnSrc = fnEnd !== -1 ? sheetSrc.slice(fnStart, fnEnd) : sheetSrc.slice(fnStart, fnStart + 2000);
  check(fnSrc.includes("className === 'blackguard'"), 'getMaxPrepared has a blackguard branch');
  check(fnSrc.includes('if (character.level === 1) return 0'),
    'blackguard branch returns 0 at level 1 (no 1st-level slots)');
  check(fnSrc.includes('Math.max(1, mod + Math.floor(character.level / 2))'),
    'blackguard branch uses the half-caster formula above L1');
}

// ===========================================================================
// (e) Cap agreement: preparedSpellsMax == getSpellsPrepared, every level
// ===========================================================================
group('(e) preparedSpellsMax agrees with getSpellsPrepared at every level 1-20');
{
  let mismatches = 0;
  for (const mod of [-1, 0, 3, 5]) {
    for (let level = 1; level <= 20; level++) {
      const a = preparedSpellsMax(mod, level);
      const b = getSpellsPrepared('blackguard', level, mod);
      if (a !== b) {
        mismatches++;
        console.error(`  ✗ mismatch mod ${mod} level ${level}: preparedSpellsMax=${a}, getSpellsPrepared=${b}`);
      }
    }
  }
  check(mismatches === 0, `preparedSpellsMax == getSpellsPrepared('blackguard', …) at all 20 levels × mods [-1, 0, 3, 5] (${mismatches} mismatches)`);
}

server.close();
console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
process.exit(failed > 0 ? 1 : 0);
