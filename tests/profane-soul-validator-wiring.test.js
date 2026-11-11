// tests/profane-soul-validator-wiring.test.js — Order of the Profane Soul
// (Blood Hunter subclass) prepared-spell cap wiring (2026-11-07).
//
// There was NO validator at all: no bloodHunterService.js exists, and
// character.js enforced the cap only for artificer / blackguard /
// paladin / sorcerer / ranger. The cap is the fixed Profane Soul table
// (2 at 3rd -> 11 at 20th, PROFANE_SOUL_SPELLS_PREPARED) — no ability
// mod, no Warlock one-third rule (that rule governs pact slots only,
// levelProgression.getMulticlassSpellSlots). This build wires the
// enforcement into the two live surfaces that touch prepared_spells,
// mirroring the ranger wiring:
//   - PUT /:id — a non-marker body carrying prepared_spells on a
//     primary-blood_hunter row whose subclass is the Order of the
//     Profane Soul is validated with profaneSoulService
//     .validatePreparedSpells (level FIRST, no mod — unlike
//     blackguard's chaMod-first order); over cap -> 400 naming
//     preparedSpells, row unchanged. Other Orders (Ghostslayer /
//     Lycan / Mutant), marker bodies, and blood_hunter-as-secondary
//     multiclass skip entirely. Revealed Arcana (7th) and Unsealed
//     Arcana (15th) spells are always prepared and excluded via
//     subclassService.profaneSoulArcanaSpellsAtLevel, keyed by the
//     stored patron choice (subclass_choices_json).
//   - POST /level-up/:id — leveling up IN blood_hunter while ALREADY
//     Profane Soul re-checks the STORED list against the new level;
//     over cap -> 400 naming preparedSpells, level unchanged (no DB
//     writes happen before the check). Leveling INTO Profane Soul at
//     3rd is NEVER blocked — the stored list had no cap before the
//     subclass existed. Multiclassing into blood_hunter never blocks.
//   - server/services/profaneSoulService.js preparedSpellsMax is the
//     table lookup and agrees with levelProgression.getSpellsPrepared
//     at every level 3-20 (null / 0 below 3rd).
//   - The sheet's getMaxPrepared has NO blood_hunter branch (returns
//     0) — recorded by the static guard, NOT rebuilt in this job.
//
// Honest integration tests: preparedSpellsMax / validatePreparedSpells
// are imported from the real profaneSoulService.js,
// profaneSoulArcanaSpellsAtLevel from the real subclassService.js,
// getSpellsPrepared / getXPToNextLevel from the real
// levelProgression.js, and every PUT/level-up case drives the real
// character router over HTTP on a real throwaway DB (the
// levelup-subclass-prompts harness). Expected caps are derived from the
// real preparedSpellsMax, never hardcoded where the service is the
// authority. If profaneSoulService.js, subclassService.js, or
// character.js were deleted, the imports fail and the suite fails with
// them.
//
// Fixture trap (levelup-subclass-prompts): a row that already spent its
// level-up 400s on XP on the next attempt — every level-up case gets a
// fresh row. Over-cap stored lists are seeded with a direct DB UPDATE,
// never through the PUT — the PUT would (correctly) refuse them, and
// the point of the level-up re-check is exactly the legacy state the
// PUT can no longer create. Patron choices are seeded the same way
// (direct UPDATE of subclass_choices_json — the PUT's allowedFields do
// not include it).
//
// Marker note: a creator-marker body goes through the Stage 4
// validator, which at level 1 refuses any prepared spell for a
// non-caster ('has no spells to pick at level 1') — so the marker
// case here is the empty list (200, proving the marker path works)
// plus a 1-spell marker list (400 from Stage 4, proving the marker
// body is governed by Stage 4, NOT by the new block's 'may prepare
// at most' refusal).
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

const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'profane-soul-validator-wiring-test-'));
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
const ps = await import(fromRepo('server/services/profaneSoulService.js'));
const { preparedSpellsMax, validatePreparedSpells } = ps;
const { profaneSoulArcanaSpellsAtLevel } = await import(fromRepo('server/services/subclassService.js'));
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

const PROFANE_SOUL = 'Order of the Profane Soul';

// Counted (non-always-prepared) Profane Soul spells; the validator
// counts by name, so the exact spells only need to be distinct strings.
// None of these collides with an Arcana spell name below.
const COUNTED_2 = ['Hex', 'Armor of Agathys'];
const COUNTED_3 = [...COUNTED_2, 'Hellish Rebuke'];
const COUNTED_4 = [...COUNTED_3, 'Misty Step'];
const COUNTED_5 = [...COUNTED_4, 'Counterspell'];
const COUNTED_8 = [...COUNTED_5, 'Hunger of Hadar', 'Dimension Door', 'Hold Monster'];
const COUNTED_9 = [...COUNTED_8, 'Eldritch Blast'];
const CLERIC_10 = ['Cure Wounds', 'Bless', 'Guiding Bolt', 'Healing Word', 'Shield of Faith',
  'Sanctuary', 'Command', 'Inflict Wounds', 'Protection from Evil and Good', 'Detect Magic'];
// Arcana spells, exactly as the registry stores them (Title Case).
const FIEND_L7 = ['Scorching Ray'];
const FIEND_L15 = ['Scorching Ray', 'Fireball'];
const CELESTIAL_L7 = ['Lesser Restoration'];
const CELESTIAL_L15 = ['Lesser Restoration', 'Revivify'];
const ARCHFEY_L7 = ['Blur'];
const ARCHFEY_L15 = ['Blur', 'Slow'];
const GOO_L7 = ['Detect Thoughts'];
const GOO_L15 = ['Detect Thoughts', 'Haste'];

async function makeCharacter({ name, cls, level, subclass = null, classLevels = null }) {
  const created = await req('POST', '/api/character', { name, class: cls, race: 'human' });
  assert(created.status === 201, `fixture POST creates ${name} (${cls}) — got ${created.status}`);
  const id = created.json.id;
  const put = await req('PUT', `/api/character/${id}`, {
    level,
    experience: getXPToNextLevel(level - 1) || 0,
    max_hp: 20,
    current_hp: 20,
    subclass,
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

// Seed the stored Otherworldly Patron choice directly — the generic
// PUT's allowedFields do not include subclass_choices_json, so the
// route under test never writes it; the creator / subclass-choice
// flows own that column.
async function seedPatron(id, patron) {
  await db.dbRun('UPDATE characters SET subclass_choices_json = ? WHERE id = ?', [J({ patron }), id]);
  const back = await readCharacter(id);
  assert.deepStrictEqual(JSON.parse(back.subclass_choices_json), { patron }, 'seeded patron reads back');
}

// ===========================================================================
// (a) Helper: profaneSoulArcanaSpellsAtLevel — real import, real data
// ===========================================================================
group('(a) profaneSoulArcanaSpellsAtLevel (real subclassService import)');
{
  check(JSON.stringify(profaneSoulArcanaSpellsAtLevel('blood_hunter', PROFANE_SOUL, 6, 'The Fiend')) === JSON.stringify([]),
    'fiend L6 (before Revealed Arcana): []');
  check(JSON.stringify(profaneSoulArcanaSpellsAtLevel('blood_hunter', PROFANE_SOUL, 7, 'The Fiend')) === JSON.stringify(FIEND_L7),
    `fiend L7: Scorching Ray (got ${JSON.stringify(profaneSoulArcanaSpellsAtLevel('blood_hunter', PROFANE_SOUL, 7, 'The Fiend'))})`);
  check(JSON.stringify(profaneSoulArcanaSpellsAtLevel('blood_hunter', PROFANE_SOUL, 15, 'The Fiend')) === JSON.stringify(FIEND_L15),
    `fiend L15 cumulative: Scorching Ray + Fireball (got ${JSON.stringify(profaneSoulArcanaSpellsAtLevel('blood_hunter', PROFANE_SOUL, 15, 'The Fiend'))})`);
  check(JSON.stringify(profaneSoulArcanaSpellsAtLevel('blood_hunter', PROFANE_SOUL, 7, 'The Celestial')) === JSON.stringify(CELESTIAL_L7),
    'celestial L7: Lesser Restoration');
  check(JSON.stringify(profaneSoulArcanaSpellsAtLevel('blood_hunter', PROFANE_SOUL, 15, 'The Celestial')) === JSON.stringify(CELESTIAL_L15),
    'celestial L15 cumulative: Lesser Restoration + Revivify');
  check(JSON.stringify(profaneSoulArcanaSpellsAtLevel('blood_hunter', PROFANE_SOUL, 7, 'The Archfey')) === JSON.stringify(ARCHFEY_L7),
    'archfey L7: Blur');
  check(JSON.stringify(profaneSoulArcanaSpellsAtLevel('blood_hunter', PROFANE_SOUL, 15, 'The Archfey')) === JSON.stringify(ARCHFEY_L15),
    'archfey L15 cumulative: Blur + Slow');
  check(JSON.stringify(profaneSoulArcanaSpellsAtLevel('blood_hunter', PROFANE_SOUL, 7, 'The Great Old One')) === JSON.stringify(GOO_L7),
    'great old one L7: Detect Thoughts');
  check(JSON.stringify(profaneSoulArcanaSpellsAtLevel('blood_hunter', PROFANE_SOUL, 15, 'The Great Old One')) === JSON.stringify(GOO_L15),
    'great old one L15 cumulative: Detect Thoughts + Haste');
  check(JSON.stringify(profaneSoulArcanaSpellsAtLevel('blood_hunter', PROFANE_SOUL, 14, 'The Fiend')) === JSON.stringify(FIEND_L7),
    'fiend L14 (before Unsealed Arcana): only Scorching Ray');
  check(JSON.stringify(profaneSoulArcanaSpellsAtLevel('blood_hunter', PROFANE_SOUL, 20, 'The Fiend')) === JSON.stringify(FIEND_L15),
    'fiend L20: still just the two Arcana spells');
  check(JSON.stringify(profaneSoulArcanaSpellsAtLevel('blood_hunter', PROFANE_SOUL, 15, null)) === JSON.stringify([]),
    'no patron stored: [] (no exclusion without a patron)');
  check(JSON.stringify(profaneSoulArcanaSpellsAtLevel('blood_hunter', PROFANE_SOUL, 15, 'The Undying')) === JSON.stringify([]),
    'removed patron (Undying): []');
  check(JSON.stringify(profaneSoulArcanaSpellsAtLevel('blood_hunter', PROFANE_SOUL, 7, 'the fiend')) === JSON.stringify(FIEND_L7),
    'patron matched case-insensitively');
  check(JSON.stringify(profaneSoulArcanaSpellsAtLevel('blood_hunter', 'profane_soul', 7, 'The Fiend')) === JSON.stringify(FIEND_L7),
    'subclass resolves by key form too (profane_soul)');
  check(JSON.stringify(profaneSoulArcanaSpellsAtLevel('blood_hunter', 'Order of the Ghostslayer', 15, 'The Fiend')) === JSON.stringify([]),
    'other Order: [] (no Arcana features)');
  check(JSON.stringify(profaneSoulArcanaSpellsAtLevel('blood_hunter', null, 15, 'The Fiend')) === JSON.stringify([]),
    'no subclass: []');
  // Sanity: the service-level validator the routes call agrees with
  // the table at the levels the route tests below use as boundaries,
  // and excludes an always-prepared name from the count.
  check(preparedSpellsMax(1) === 0, 'cap source: preparedSpellsMax(L1) = 0 (no casting before 3rd)');
  check(preparedSpellsMax(2) === 0, 'cap source: preparedSpellsMax(L2) = 0');
  check(preparedSpellsMax(3) === 2, 'cap source: preparedSpellsMax(L3) = 2');
  check(preparedSpellsMax(5) === 3, 'cap source: preparedSpellsMax(L5) = 3');
  check(preparedSpellsMax(7) === 4, 'cap source: preparedSpellsMax(L7) = 4');
  check(preparedSpellsMax(15) === 8, 'cap source: preparedSpellsMax(L15) = 8');
  check(preparedSpellsMax(20) === 11, 'cap source: preparedSpellsMax(L20) = 11');
  check(preparedSpellsMax(21) === 0, 'cap source: preparedSpellsMax(L21, out of range) = 0');
  const v = validatePreparedSpells(7, [...COUNTED_4, 'Scorching Ray'], ['Scorching Ray']);
  check(v.ok && v.counted === 4 && v.max === 4, 'validator excludes an always-prepared name from the count');
  const v1 = validatePreparedSpells(3, COUNTED_3, []);
  check(!v1.ok && v1.max === 2 && v1.counted === 3, 'validator at L3: max 2, a 3-spell list refuses');
  const v2 = validatePreparedSpells(2, ['Hex'], []);
  check(!v2.ok && v2.max === 0 && v2.counted === 1, 'validator at L2: max 0, a 1-spell list refuses');
}

// ===========================================================================
// (b) PUT path — the character sheet save
// ===========================================================================
group('(b) PUT refuses over-cap, persists at-cap (Profane Soul L5, cap 3)');
{
  const cap5 = preparedSpellsMax(5);
  const ps5 = await makeCharacter({ name: 'PsFive', cls: 'blood_hunter', level: 5, subclass: PROFANE_SOUL });
  await seedPatron(ps5, 'The Fiend');
  // Seed a valid list first so the refusal case can prove the row is unchanged.
  const seed = await req('PUT', `/api/character/${ps5}`, { prepared_spells: J(COUNTED_3) });
  check(seed.status === 200, `PUT at-cap (${cap5} spells) persists 200 (got ${seed.status})`);
  check(JSON.stringify(await readPrepared(ps5)) === JSON.stringify(COUNTED_3), 'at-cap list persisted and reads back');
  // One over the cap: 400, error names preparedSpells, row untouched.
  const over = await req('PUT', `/api/character/${ps5}`, { prepared_spells: J(COUNTED_4) });
  check(over.status === 400, `PUT ${COUNTED_4.length} spells (cap ${cap5}) refuses 400 (got ${over.status})`);
  check(typeof over.json?.error === 'string' && over.json.error.includes('preparedSpells'),
    `PUT refusal names preparedSpells (got ${JSON.stringify(over.json?.error)})`);
  check(typeof over.json?.error === 'string' && over.json.error.includes(`at most ${cap5}`) && over.json.error.includes('got 4'),
    `PUT refusal states the cap and count (got ${JSON.stringify(over.json?.error)})`);
  check(typeof over.json?.error === 'string' && over.json.error.includes('blood hunter level 5'),
    `PUT refusal names the blood hunter level (got ${JSON.stringify(over.json?.error)})`);
  check(JSON.stringify(await readPrepared(ps5)) === JSON.stringify(COUNTED_3),
    'refused PUT left the stored prepared list unchanged');
  // A different at-cap list still saves after the refusal.
  const again = await req('PUT', `/api/character/${ps5}`, { prepared_spells: J(['Hex', 'Misty Step', 'Counterspell']) });
  check(again.status === 200, 'PUT at-cap again after a refusal persists 200');
  check(JSON.stringify(await readPrepared(ps5)) === JSON.stringify(['Hex', 'Misty Step', 'Counterspell']),
    'second at-cap list persisted and reads back');
  // The camelCase alias the sheet also sends is validated the same way.
  const camel = await req('PUT', `/api/character/${ps5}`, { preparedSpells: J(COUNTED_4) });
  check(camel.status === 400, `PUT via preparedSpells (camelCase) over cap refuses 400 (got ${camel.status})`);
  // The status alone does not discriminate: a camelCase-only body with no
  // wiring ALSO 400s ('No valid fields to update' — the generic UPDATE
  // does not know the camelCase key). The error text is the proof the
  // camelCase body went through the Profane Soul validator instead.
  check(typeof camel.json?.error === 'string' && camel.json.error.includes('preparedSpells') && camel.json.error.includes('may prepare at most 3') && camel.json.error.includes('got 4'),
    `camelCase refusal is the profane soul cap error, not 'No valid fields' (got ${JSON.stringify(camel.json?.error)})`);
}

group('(b2) PUT — L3 boundary: cap 2, a 2-spell list passes, 3 refuses');
{
  const cap3 = preparedSpellsMax(3);
  check(cap3 === 2, `cap source: preparedSpellsMax(L3) = 2 (got ${cap3})`);
  const ps3 = await makeCharacter({ name: 'PsThree', cls: 'blood_hunter', level: 3, subclass: PROFANE_SOUL });
  await seedPatron(ps3, 'The Celestial');
  const at = await req('PUT', `/api/character/${ps3}`, { prepared_spells: J(COUNTED_2) });
  check(at.status === 200, `PUT ${COUNTED_2.length} spells at L3 (cap ${cap3}) persists 200 (got ${at.status})`);
  const over3 = await req('PUT', `/api/character/${ps3}`, { prepared_spells: J(COUNTED_3) });
  check(over3.status === 400, `PUT ${COUNTED_3.length} spells at L3 (cap ${cap3}) refuses 400 (got ${over3.status})`);
  check(typeof over3.json?.error === 'string' && over3.json.error.includes('preparedSpells') && over3.json.error.includes('at most 2') && over3.json.error.includes('got 3'),
    `L3 refusal names preparedSpells, cap 2, got 3 (got ${JSON.stringify(over3.json?.error)})`);
  check(JSON.stringify(await readPrepared(ps3)) === JSON.stringify(COUNTED_2),
    'refused L3 PUT left the stored prepared list unchanged');
}

group('(b3) PUT — Fiend Arcana spells do not count (Revealed L7, Unsealed L15)');
{
  const cap7 = preparedSpellsMax(7);
  const fiend7 = await makeCharacter({ name: 'FiendSeven', cls: 'blood_hunter', level: 7, subclass: PROFANE_SOUL });
  await seedPatron(fiend7, 'The Fiend');
  const always7 = profaneSoulArcanaSpellsAtLevel('blood_hunter', PROFANE_SOUL, 7, 'The Fiend');
  check(JSON.stringify(always7) === JSON.stringify(FIEND_L7), `fiend always-prepared at L7 is 1 spell (got ${JSON.stringify(always7)})`);
  // 4 counted + Scorching Ray in the list: counted stays 4.
  const withAlways = await req('PUT', `/api/character/${fiend7}`, {
    prepared_spells: J([...COUNTED_4, 'Scorching Ray']),
  });
  check(withAlways.status === 200,
    `PUT 4 counted + Scorching Ray persists 200 (got ${withAlways.status}: ${JSON.stringify(withAlways.json?.error || '')})`);
  check((await readPrepared(fiend7)).length === 5, 'all 5 sent names persisted (always-prepared are stored, just not counted)');
  // 5 counted + Scorching Ray: counted 5 > cap 4 -> 400.
  const overFiend = await req('PUT', `/api/character/${fiend7}`, {
    prepared_spells: J([...COUNTED_5, 'Scorching Ray']),
  });
  check(overFiend.status === 400, `PUT 5 counted + Scorching Ray refuses 400 (got ${overFiend.status})`);
  check(typeof overFiend.json?.error === 'string' && overFiend.json.error.includes('preparedSpells') && overFiend.json.error.includes('got 5'),
    `fiend refusal names preparedSpells and counts 5 (got ${JSON.stringify(overFiend.json?.error)})`);
  check((await readPrepared(fiend7)).length === 5, 'refused fiend PUT left the stored list unchanged');

  // L15: both Arcana spells excluded — 8 counted + Scorching Ray +
  // Fireball persists at the cap of 8.
  const cap15 = preparedSpellsMax(15);
  check(cap15 === 8, `cap source: preparedSpellsMax(L15) = 8 (got ${cap15})`);
  const fiend15 = await makeCharacter({ name: 'FiendFifteen', cls: 'blood_hunter', level: 15, subclass: PROFANE_SOUL });
  await seedPatron(fiend15, 'The Fiend');
  const always15 = profaneSoulArcanaSpellsAtLevel('blood_hunter', PROFANE_SOUL, 15, 'The Fiend');
  check(JSON.stringify(always15) === JSON.stringify(FIEND_L15), `fiend always-prepared at L15 is 2 spells (got ${JSON.stringify(always15)})`);
  const withBoth = await req('PUT', `/api/character/${fiend15}`, {
    prepared_spells: J([...COUNTED_8, 'Scorching Ray', 'Fireball']),
  });
  check(withBoth.status === 200,
    `PUT 8 counted + both Arcana spells persists 200 (got ${withBoth.status}: ${JSON.stringify(withBoth.json?.error || '')})`);
  check((await readPrepared(fiend15)).length === 10, 'all 10 sent names persisted');
  const over15 = await req('PUT', `/api/character/${fiend15}`, {
    prepared_spells: J([...COUNTED_9, 'Scorching Ray', 'Fireball']),
  });
  check(over15.status === 400, `PUT 9 counted + both Arcana spells refuses 400 (got ${over15.status})`);
  check(typeof over15.json?.error === 'string' && over15.json.error.includes('got 9'),
    `L15 refusal counts 9 (got ${JSON.stringify(over15.json?.error)})`);
}

group('(b4) PUT — no stored patron, no exclusion: Scorching Ray counts');
{
  // Same L7 shape as (b3), but the row carries no patron choice: the
  // exclusion is patron-keyed, so without a stored patron Scorching
  // Ray is an ordinary prepared spell and 4 counted + it = 5 > cap 4.
  const noPatron = await makeCharacter({ name: 'NoPatronSeven', cls: 'blood_hunter', level: 7, subclass: PROFANE_SOUL });
  const refused = await req('PUT', `/api/character/${noPatron}`, {
    prepared_spells: J([...COUNTED_4, 'Scorching Ray']),
  });
  check(refused.status === 400, `PUT 4 counted + Scorching Ray with NO stored patron refuses 400 (got ${refused.status})`);
  check(typeof refused.json?.error === 'string' && refused.json.error.includes('got 5'),
    `no-patron refusal counts Scorching Ray (got ${JSON.stringify(refused.json?.error)})`);
  // And the plain 4-counted list still passes without a patron.
  const plain = await req('PUT', `/api/character/${noPatron}`, { prepared_spells: J(COUNTED_4) });
  check(plain.status === 200, `PUT 4 counted spells with no patron persists 200 (got ${plain.status})`);
  // A Celestial patron does NOT exclude the Fiend's Scorching Ray.
  const cel7 = await makeCharacter({ name: 'CelSeven', cls: 'blood_hunter', level: 7, subclass: PROFANE_SOUL });
  await seedPatron(cel7, 'The Celestial');
  const wrongPatron = await req('PUT', `/api/character/${cel7}`, {
    prepared_spells: J([...COUNTED_4, 'Scorching Ray']),
  });
  check(wrongPatron.status === 400, `PUT 4 counted + Scorching Ray under a Celestial patron refuses 400 (got ${wrongPatron.status})`);
  const celPass = await req('PUT', `/api/character/${cel7}`, {
    prepared_spells: J([...COUNTED_4, 'Lesser Restoration']),
  });
  check(celPass.status === 200, `PUT 4 counted + Lesser Restoration under a Celestial patron persists 200 (got ${celPass.status}: ${JSON.stringify(celPass.json?.error || '')})`);
}

group('(b5) PUT skips: other Orders, secondary blood_hunter, no list, marker');
{
  // Other Orders never cast: a 10-spell list sails through.
  for (const order of ['Order of the Ghostslayer', 'Order of the Lycan', 'Order of the Mutant']) {
    const other = await makeCharacter({ name: `Other${order.split(' ').pop()}`, cls: 'blood_hunter', level: 7, subclass: order });
    const put = await req('PUT', `/api/character/${other}`, { prepared_spells: J(CLERK_10_FIXTURE()) });
    check(put.status === 200, `${order} PUT with ${CLERIC_10.length} prepared spells is unaffected, 200 (got ${put.status})`);
    check(JSON.stringify(await readPrepared(other)) === JSON.stringify(CLERIC_10), `${order} long list persisted`);
  }
  // Blood_hunter-as-secondary multiclass: primary cleric governs the
  // shared column, so the Profane Soul cap does not fire on the PUT.
  const multi = await makeCharacter({
    name: 'ClericBh', cls: 'cleric', level: 5,
    classLevels: [{ class: 'cleric', level: 4, subclass: null }, { class: 'blood_hunter', level: 1, subclass: null }],
  });
  const multiPut = await req('PUT', `/api/character/${multi}`, { prepared_spells: J(COUNTED_4) });
  check(multiPut.status === 200, `multiclass (cleric primary, blood_hunter secondary) PUT over the Profane Soul cap is skipped, 200 (got ${multiPut.status})`);
  check(JSON.stringify(await readPrepared(multi)) === JSON.stringify(COUNTED_4), 'multiclass long list persisted');
  // No prepared_spells in the body: a plain field update is unaffected.
  const ps7 = await makeCharacter({ name: 'PsNoList', cls: 'blood_hunter', level: 7, subclass: PROFANE_SOUL });
  await seedPatron(ps7, 'The Fiend');
  await seedStoredPrepared(ps7, COUNTED_4);
  const plain = await req('PUT', `/api/character/${ps7}`, { name: 'PsNoList Renamed' });
  check(plain.status === 200, `PUT with no prepared_spells is unaffected, 200 (got ${plain.status})`);
  check((await readCharacter(ps7)).name === 'PsNoList Renamed', 'plain PUT still persisted the name change');
  check(JSON.stringify(await readPrepared(ps7)) === JSON.stringify(COUNTED_4), 'plain PUT left the stored prepared list alone');
  // Creator-marker PUT goes through the Stage 4 validator, not the new
  // block: the empty list passes (Stage 4's L1 rule for a non-caster
  // blood_hunter allows an empty pick) and a 1-spell marker list is
  // Stage 4's refusal ('has no spells to pick at level 1'), with
  // Stage 4's wording, not the new block's 'may prepare at most'.
  const markerPs = await makeCharacter({ name: 'PsMarker', cls: 'blood_hunter', level: 1 });
  const markerPut = await req('PUT', `/api/character/${markerPs}`, {
    creator: 'creator-next', prepared_spells: J([]),
  });
  check(markerPut.status === 200,
    `creator-marker PUT with an empty list passes 200 (got ${markerPut.status}: ${JSON.stringify(markerPut.json?.error || '')})`);
  check(JSON.stringify(await readPrepared(markerPs)) === JSON.stringify([]), 'marker PUT persisted the empty list');
  const markerOver = await req('PUT', `/api/character/${markerPs}`, {
    creator: 'creator-next', prepared_spells: J(['Hex']),
  });
  check(markerOver.status === 400,
    `creator-marker PUT with 1 spell refuses 400 via Stage 4 (got ${markerOver.status})`);
  check(typeof markerOver.json?.error === 'string' && markerOver.json.error.includes('preparedSpells'),
    `marker refusal names preparedSpells (got ${JSON.stringify(markerOver.json?.error)})`);
  check(typeof markerOver.json?.error === 'string' && !markerOver.json.error.includes('may prepare at most'),
    `marker refusal is Stage 4's wording, not the new block's (got ${JSON.stringify(markerOver.json?.error)})`);
  check(JSON.stringify(await readPrepared(markerPs)) === JSON.stringify([]),
    'refused marker PUT left the stored prepared list unchanged');
}

// The 10-spell list used by the other-Orders skip cases. A function
// (not a shared const) so a careless test cannot mutate the array
// another group reads.
function CLERK_10_FIXTURE() { return [...CLERIC_10]; }

// ===========================================================================
// (c) Level-up path — stored-list re-check on leveling up IN Profane Soul
// ===========================================================================
group('(c) level-up re-check: over-cap stored list blocks, level unchanged');
{
  // Profane Soul L7 -> L8, Fiend patron: new cap is
  // preparedSpellsMax(8) = 4.
  const cap8 = preparedSpellsMax(8);
  check(cap8 === 4, `cap source: preparedSpellsMax(L8) = 4 (got ${cap8})`);
  const over = await makeCharacter({
    name: 'PsLevelOver', cls: 'blood_hunter', level: 7, subclass: PROFANE_SOUL,
  });
  await seedPatron(over, 'The Fiend');
  await db.dbRun('UPDATE characters SET experience = ? WHERE id = ?', [getXPToNextLevel(7), over]);
  await seedStoredPrepared(over, COUNTED_5);
  const blocked = await req('POST', `/api/character/level-up/${over}`, {});
  check(blocked.status === 400, `level-up with stored ${COUNTED_5.length} spells (new cap ${cap8}) refuses 400 (got ${blocked.status})`);
  check(typeof blocked.json?.error === 'string' && blocked.json.error.includes('preparedSpells'),
    `level-up refusal names preparedSpells (got ${JSON.stringify(blocked.json?.error)})`);
  check(typeof blocked.json?.error === 'string' && blocked.json.error.includes('fix the prepared list'),
    'level-up refusal tells the player to fix the list on the character sheet');
  check(typeof blocked.json?.error === 'string' && blocked.json.error.includes(`at most ${cap8}`) && blocked.json.error.includes('got 5'),
    `level-up refusal states the cap and count (got ${JSON.stringify(blocked.json?.error)})`);
  const overRow = await readCharacter(over);
  check(overRow.level === 7, 'blocked level-up left the level at 7');
  check(JSON.stringify(JSON.parse(overRow.prepared_spells)) === JSON.stringify(COUNTED_5),
    'blocked level-up left the stored prepared list unchanged');

  // Same shape, valid stored list: 200, level increases to 8.
  const valid = await makeCharacter({
    name: 'PsLevelOk', cls: 'blood_hunter', level: 7, subclass: PROFANE_SOUL,
  });
  await seedPatron(valid, 'The Fiend');
  await db.dbRun('UPDATE characters SET experience = ? WHERE id = ?', [getXPToNextLevel(7), valid]);
  await seedStoredPrepared(valid, COUNTED_4);
  const ok = await req('POST', `/api/character/level-up/${valid}`, {});
  check(ok.status === 200, `level-up with a valid stored list succeeds 200 (got ${ok.status}: ${JSON.stringify(ok.json?.error || '')})`);
  const okRow = await readCharacter(valid);
  check(okRow.level === 8, 'valid level-up raised the level to 8');
  check(JSON.stringify(JSON.parse(okRow.prepared_spells)) === JSON.stringify(COUNTED_4),
    'valid level-up kept the stored prepared list');

  // Arcana exclusion applies at level-up too: 4 counted + Scorching
  // Ray stored at L7 levels to L8 at cap 4 — 200.
  const arcana = await makeCharacter({
    name: 'PsLevelArcana', cls: 'blood_hunter', level: 7, subclass: PROFANE_SOUL,
  });
  await seedPatron(arcana, 'The Fiend');
  await db.dbRun('UPDATE characters SET experience = ? WHERE id = ?', [getXPToNextLevel(7), arcana]);
  await seedStoredPrepared(arcana, [...COUNTED_4, 'Scorching Ray']);
  const arcOk = await req('POST', `/api/character/level-up/${arcana}`, {});
  check(arcOk.status === 200, `level-up with 4 counted + Scorching Ray stored succeeds 200 (got ${arcOk.status}: ${JSON.stringify(arcOk.json?.error || '')})`);
  check((await readCharacter(arcana)).level === 8, 'arcana level-up raised the level to 8');
}

group('(c2) level-up INTO Profane Soul is never blocked');
{
  // Blood hunter L2 (no subclass yet) with a stored 3-spell list —
  // over the L3 cap of 2 — levels to 3rd choosing Profane Soul.
  // The stored list had no prepared cap before the subclass
  // existed, so the re-check must not fire.
  const cap3 = preparedSpellsMax(3);
  check(cap3 === 2, `cap source: L3 cap is ${cap3} (the stored 3 would fail it)`);
  const bh2 = await makeCharacter({ name: 'BhTwoIntoPs', cls: 'blood_hunter', level: 2 });
  await db.dbRun('UPDATE characters SET experience = ? WHERE id = ?', [getXPToNextLevel(2), bh2]);
  await seedStoredPrepared(bh2, COUNTED_3);
  const into = await req('POST', `/api/character/level-up/${bh2}`, { subclass: PROFANE_SOUL });
  check(into.status === 200,
    `level-up into Profane Soul with a stored 3-spell list is NOT blocked, 200 (got ${into.status}: ${JSON.stringify(into.json?.error || '')})`);
  const intoRow = await readCharacter(bh2);
  check(intoRow.level === 3, 'level-up into Profane Soul raised the level to 3');
  check(intoRow.subclass === PROFANE_SOUL, 'level-up into Profane Soul stored the subclass');
  check(JSON.stringify(JSON.parse(intoRow.prepared_spells)) === JSON.stringify(COUNTED_3),
    'level-up into Profane Soul kept the stored prepared list');
}

group('(c3) level-up skips multiclass INTO blood_hunter');
{
  // Cleric 3 -> total 4 by multiclassing into blood_hunter, with a
  // stored 4-spell list from the cleric side. The list belongs to
  // the other class, so the re-check must not fire (a blood hunter
  // L1 cap would be 0).
  const capBh1 = preparedSpellsMax(1);
  check(capBh1 === 0, `cap source: blood hunter L1 cap is ${capBh1} (the stored 4 would fail it)`);
  const cleric = await makeCharacter({ name: 'ClericMultiBh', cls: 'cleric', level: 3 });
  await db.dbRun('UPDATE characters SET experience = ? WHERE id = ?', [getXPToNextLevel(3), cleric]);
  await seedStoredPrepared(cleric, COUNTED_4);
  const multi = await req('POST', `/api/character/level-up/${cleric}`, { selectedClass: 'Blood Hunter' });
  check(multi.status === 200,
    `multiclass into blood_hunter with a stored 4-spell list is NOT blocked, 200 (got ${multi.status}: ${JSON.stringify(multi.json?.error || '')})`);
  const multiRow = await readCharacter(cleric);
  check(multiRow.level === 4, 'multiclass level-up raised the total level to 4');
  const levels = JSON.parse(multiRow.class_levels || '[]');
  // The new entry stores the selected class as written ('Blood Hunter');
  // normalize spaces/underscores before comparing.
  const norm = (s) => String(s).toLowerCase().replace(/[\s_]+/g, '');
  const bhEntry = levels.find((c) => norm(c.class) === 'bloodhunter');
  check(bhEntry?.level === 1, 'multiclass blood_hunter entry stored at level 1');
  check(JSON.stringify(JSON.parse(multiRow.prepared_spells)) === JSON.stringify(COUNTED_4),
    'multiclass level-up kept the stored prepared list');
}

// ===========================================================================
// (d) Static guard: the sheet's getMaxPrepared has NO blood_hunter branch
// ===========================================================================
group('(d) CharacterSheet getMaxPrepared blood_hunter branch (static guard — recorded, not built)');
{
  const sheetSrc = readRepo('client/src/components/CharacterSheet.jsx');
  const fnStart = sheetSrc.indexOf('const getMaxPrepared');
  check(fnStart !== -1, 'CharacterSheet.jsx defines getMaxPrepared');
  const fnEnd = sheetSrc.indexOf('const isPreparedCaster', fnStart);
  const fnSrc = fnEnd !== -1 ? sheetSrc.slice(fnStart, fnEnd) : sheetSrc.slice(fnStart, fnStart + 2000);
  // This job records the gap instead of rebuilding the sheet model:
  // a Profane Soul currently falls through to `return 0`.
  check(!fnSrc.includes("className === 'blood_hunter'"), 'getMaxPrepared has NO blood_hunter branch (recorded gap — server enforces instead)');
  check(fnSrc.includes('return 0'), 'getMaxPrepared falls through to return 0 for unhandled classes');
}

// ===========================================================================
// (e) Cap agreement: preparedSpellsMax == getSpellsPrepared, levels 3-20
// ===========================================================================
group('(e) preparedSpellsMax agrees with getSpellsPrepared at levels 3-20');
{
  let mismatches = 0;
  for (let level = 3; level <= 20; level++) {
    const a = preparedSpellsMax(level);
    const b = getSpellsPrepared('blood_hunter', level, 0, PROFANE_SOUL);
    if (a !== b) {
      mismatches++;
      console.error(`  ✗ mismatch level ${level}: preparedSpellsMax=${a}, getSpellsPrepared=${b}`);
    }
  }
  check(mismatches === 0, `preparedSpellsMax == getSpellsPrepared('blood_hunter', …, 'Order of the Profane Soul') at levels 3-20 (${mismatches} mismatches)`);
  // Below 3rd there is no casting: getSpellsPrepared returns null and
  // the service reads 0 from the table — the same boundary, two shapes.
  check(getSpellsPrepared('blood_hunter', 1, 0, PROFANE_SOUL) === null, "getSpellsPrepared L1 is null (no casting before 3rd)");
  check(getSpellsPrepared('blood_hunter', 2, 0, PROFANE_SOUL) === null, 'getSpellsPrepared L2 is null');
  check(preparedSpellsMax(1) === 0 && preparedSpellsMax(2) === 0, 'preparedSpellsMax reads 0 at L1-2');
  check(getSpellsPrepared('blood_hunter', 10, 0, 'Order of the Ghostslayer') === null, 'Ghostslayer never casts (getSpellsPrepared null at L10)');
  check(getSpellsPrepared('blood_hunter', 10, 0, 'Order of the Lycan') === null, 'Lycan never casts (getSpellsPrepared null at L10)');
  check(getSpellsPrepared('blood_hunter', 10, 0, 'Order of the Mutant') === null, 'Mutant never casts (getSpellsPrepared null at L10)');
  // The full table, from the real service: 2 at 3rd rising to 11 at 20th.
  const table = [];
  for (let level = 1; level <= 20; level++) table.push(preparedSpellsMax(level));
  check(JSON.stringify(table) === JSON.stringify([0, 0, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 11]),
    `full prepared table is [0,0,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,11] (got ${JSON.stringify(table)})`);
}

server.close();
console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
process.exit(failed > 0 ? 1 : 0);
