// tests/artificer-validator-wiring.test.js — artificer prepared-spell cap
// wiring (2026-11-06): the 2024 formula (Int mod + half artificer level,
// min 1) was enforced only at creation (Stage 4) — the character sheet's
// bare { prepared_spells } PUT sailed through, and a legacy over-cap list
// already on a row could sit there until level-up. This build wires the
// enforcement into the two live surfaces that touch prepared_spells:
//   - PUT /:id — a non-marker body carrying prepared_spells on a
//     primary-artificer row is validated with validatePreparedSpells
//     (always-prepared subclass spells excluded); over cap -> 400 naming
//     preparedSpells, row unchanged. Non-artificers, marker bodies, and
//     artificer-as-secondary multiclass skip entirely.
//   - POST /level-up/:id — leveling up IN artificer (not multiclassing
//     into it) re-checks the STORED list against the new level and the
//     post-ASI Int mod; over cap -> 400 naming preparedSpells, level
//     unchanged (no DB writes happen before the check).
//   - server/services/subclassService.js gains artificerSubclassSpellsAtLevel,
//     mirroring paladinOathSpellsAtLevel (cumulative alwaysPreparedByLevel
//     from the kind-'D' feature). Only Lumberjack has data.
//
// Honest integration tests: preparedSpellsForLevel / validatePreparedSpells
// are imported from the real artificerService.js, artificerSubclassSpellsAtLevel
// from the real subclassService.js, and every PUT/level-up case drives the
// real character router over HTTP on a real throwaway DB (the
// levelup-subclass-prompts harness). Expected caps are derived from the real
// preparedSpellsForLevel, never hardcoded where the service is the authority.
// If artificerService.js, subclassService.js, or character.js were deleted,
// the imports fail and the suite fails with them.
//
// Fixture trap (levelup-subclass-prompts): a row that already spent its
// level-up 400s on XP on the next attempt — every level-up case gets a
// fresh row. Over-cap stored lists are seeded with a direct DB UPDATE,
// never through the PUT — the PUT would (correctly) refuse them, and the
// point of the level-up re-check is exactly the legacy state the PUT
// can no longer create.
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

const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'artificer-validator-wiring-test-'));
const tmpDir = repoRoot;
const origCwd = process.cwd();
process.chdir(tmpDir);
delete process.env.TURSO_DATABASE_URL;
delete process.env.TURSO_AUTH_TOKEN;
const fromRepo = (rel) => pathToFileURL(path.join(origCwd, rel)).href;

const db = await import(fromRepo('server/database.js'));
await db.initDatabase();
// The real services under test — caps come from these, not from literals.
const art = await import(fromRepo('server/services/artificerService.js'));
const { preparedSpellsForLevel, validatePreparedSpells } = art;
const { artificerSubclassSpellsAtLevel } = await import(fromRepo('server/services/subclassService.js'));
const { getXPToNextLevel } = await import(fromRepo('server/config/levelProgression.js'));

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
// with level: L1 -> 3, L5 -> 5, per the 2024 formula.
const INT3_SCORES = { str: 10, dex: 10, con: 14, int: 16, wis: 10, cha: 10 };
const INT_MOD = 3;

// Counted (non-always-prepared) artificer spells, all real artificer
// spells; the validator counts by name, so the exact spells only need
// to be distinct strings.
const COUNTED_3 = ['Cure Wounds', 'Faerie Fire', 'Grease'];
const COUNTED_5 = [...COUNTED_3, 'Alarm', 'Feather Fall'];
const COUNTED_6 = [...COUNTED_5, 'Detect Magic'];
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
// (a) Helper: artificerSubclassSpellsAtLevel — real import, real data
// ===========================================================================
group('(a) artificerSubclassSpellsAtLevel (real subclassService import)');
{
  const l3 = artificerSubclassSpellsAtLevel('artificer', 'lumberjack', 3);
  check(JSON.stringify(l3) === JSON.stringify(['Beast Bond', 'Speak with Animals']),
    `lumberjack L3: Beast Bond + Speak with Animals (got ${JSON.stringify(l3)})`);
  const l5 = artificerSubclassSpellsAtLevel('artificer', 'lumberjack', 5);
  check(JSON.stringify(l5) === JSON.stringify(['Beast Bond', 'Speak with Animals', 'Barkskin', 'Beast Sense']),
    `lumberjack L5 cumulative adds Barkskin + Beast Sense (got ${JSON.stringify(l5)})`);
  const l9 = artificerSubclassSpellsAtLevel('artificer', 'lumberjack', 9);
  check(l9.length === 6 && l9.includes('Conjure Animals') && l9.includes('Plant Growth'),
    `lumberjack L9 cumulative is 6 incl. Conjure Animals + Plant Growth (got ${JSON.stringify(l9)})`);
  check(JSON.stringify(artificerSubclassSpellsAtLevel('artificer', 'lumberjack', 2)) === JSON.stringify([]),
    'lumberjack L2 (before subclass level 3): []');
  check(JSON.stringify(artificerSubclassSpellsAtLevel('artificer', 'alchemist', 5)) ===
    JSON.stringify(['Healing Word', 'Ray of Sickness', 'Flaming Sphere', "Melf's Acid Arrow"]),
    `alchemist L5 cumulative is the Eberron list (got ${JSON.stringify(artificerSubclassSpellsAtLevel('artificer', 'alchemist', 5))})`);
  check(JSON.stringify(artificerSubclassSpellsAtLevel('artificer', 'lumberjack', 1)) === JSON.stringify([]),
    'lumberjack L1: []');
  // Sanity: the service-level validator the routes call agrees with the
  // formula at the two levels the route tests below use as boundaries.
  check(preparedSpellsForLevel(1, INT_MOD) === 3, 'cap source: preparedSpellsForLevel(1, +3) = 3');
  check(preparedSpellsForLevel(5, INT_MOD) === 5, 'cap source: preparedSpellsForLevel(5, +3) = 5');
  const v = validatePreparedSpells(5, [...COUNTED_5, 'Beast Bond'], ['Beast Bond'], INT_MOD);
  check(v.ok && v.counted === 5 && v.max === 5, 'validator excludes an always-prepared name from the count');
}

// ===========================================================================
// (b) PUT path — the character sheet save
// ===========================================================================
group('(b) PUT refuses over-cap, persists at-cap (artificer L5, Int +3)');
{
  const cap5 = preparedSpellsForLevel(5, INT_MOD);
  const art5 = await makeCharacter({ name: 'ArtFive', cls: 'artificer', level: 5, intScores: INT3_SCORES });
  // Seed a valid list first so the refusal case can prove the row is unchanged.
  const seed = await req('PUT', `/api/character/${art5}`, { prepared_spells: J(COUNTED_5) });
  check(seed.status === 200, `PUT at-cap (${cap5} spells) persists 200 (got ${seed.status})`);
  check(JSON.stringify(await readPrepared(art5)) === JSON.stringify(COUNTED_5), 'at-cap list persisted and reads back');
  // One over the cap: 400, error names preparedSpells, row untouched.
  const over = await req('PUT', `/api/character/${art5}`, { prepared_spells: J(COUNTED_6) });
  check(over.status === 400, `PUT ${COUNTED_6.length} spells (cap ${cap5}) refuses 400 (got ${over.status})`);
  check(typeof over.json?.error === 'string' && over.json.error.includes('preparedSpells'),
    `PUT refusal names preparedSpells (got ${JSON.stringify(over.json?.error)})`);
  check(typeof over.json?.error === 'string' && over.json.error.includes(`at most ${cap5}`) && over.json.error.includes('got 6'),
    `PUT refusal states the cap and count (got ${JSON.stringify(over.json?.error)})`);
  check(JSON.stringify(await readPrepared(art5)) === JSON.stringify(COUNTED_5),
    'refused PUT left the stored prepared list unchanged');
  // A different at-cap list still saves after the refusal.
  const again = await req('PUT', `/api/character/${art5}`, { prepared_spells: J([...COUNTED_3, 'Detect Magic', 'Feather Fall']) });
  check(again.status === 200, 'PUT at-cap again after a refusal persists 200');
  check(JSON.stringify(await readPrepared(art5)) === JSON.stringify([...COUNTED_3, 'Detect Magic', 'Feather Fall']),
    'second at-cap list persisted and reads back');
  // The camelCase alias the sheet also sends is validated the same way.
  const camel = await req('PUT', `/api/character/${art5}`, { preparedSpells: J(COUNTED_6) });
  check(camel.status === 400, `PUT via preparedSpells (camelCase) over cap refuses 400 (got ${camel.status})`);
  check(typeof camel.json?.error === 'string' && camel.json.error.includes('preparedSpells'),
    'camelCase refusal names preparedSpells');
}

group('(b2) PUT cap grows with level — L1 boundary, same Int +3');
{
  const cap1 = preparedSpellsForLevel(1, INT_MOD);
  const art1 = await makeCharacter({ name: 'ArtOne', cls: 'artificer', level: 1, intScores: INT3_SCORES });
  const over1 = await req('PUT', `/api/character/${art1}`, { prepared_spells: J([...COUNTED_3, 'Alarm']) });
  check(over1.status === 400, `PUT ${COUNTED_3.length + 1} spells at L1 (cap ${cap1}) refuses 400 (got ${over1.status})`);
  check(typeof over1.json?.error === 'string' && over1.json.error.includes(`at most ${cap1}`),
    `L1 refusal states cap ${cap1} (got ${JSON.stringify(over1.json?.error)})`);
  const at1 = await req('PUT', `/api/character/${art1}`, { prepared_spells: J(COUNTED_3) });
  check(at1.status === 200, `PUT ${cap1} spells at L1 persists 200 (got ${at1.status})`);
  check(JSON.stringify(await readPrepared(art1)) === JSON.stringify(COUNTED_3), 'L1 at-cap list persisted');
  // Same Int mod, higher level, bigger cap: the L1-refused 4-spell list
  // is legal at L5 — the boundary moves with the formula, not the mod.
  check(preparedSpellsForLevel(5, INT_MOD) > cap1, 'cap at L5 exceeds cap at L1 with the same Int mod (+3)');
}

group('(b3) PUT — Lumberjack always-prepared spells do not count');
{
  const cap5 = preparedSpellsForLevel(5, INT_MOD);
  const jack5 = await makeCharacter({
    name: 'JackFive', cls: 'artificer', level: 5, subclass: 'lumberjack', intScores: INT3_SCORES,
  });
  const always5 = artificerSubclassSpellsAtLevel('artificer', 'lumberjack', 5);
  check(always5.length === 4, `lumberjack always-prepared at L5 is 4 spells (got ${JSON.stringify(always5)})`);
  // 5 counted + 2 always-prepared names in the list: counted stays 5.
  const withAlways = await req('PUT', `/api/character/${jack5}`, {
    prepared_spells: J([...COUNTED_5, 'Beast Bond', 'Speak with Animals']),
  });
  check(withAlways.status === 200,
    `PUT 5 counted + 2 always-prepared persists 200 (got ${withAlways.status}: ${JSON.stringify(withAlways.json?.error || '')})`);
  check((await readPrepared(jack5)).length === 7, 'all 7 sent names persisted (always-prepared are stored, just not counted)');
  // 6 counted + the same 2 always-prepared: counted 6 > cap 5 -> 400.
  const overJack = await req('PUT', `/api/character/${jack5}`, {
    prepared_spells: J([...COUNTED_6, 'Beast Bond', 'Speak with Animals']),
  });
  check(overJack.status === 400, `PUT 6 counted + always-prepared refuses 400 (got ${overJack.status})`);
  check(typeof overJack.json?.error === 'string' && overJack.json.error.includes('preparedSpells') && overJack.json.error.includes('got 6'),
    `lumberjack refusal names preparedSpells and counts 6 (got ${JSON.stringify(overJack.json?.error)})`);
  check((await readPrepared(jack5)).length === 7, 'refused lumberjack PUT left the stored list unchanged');
}

group('(b4) PUT skips: non-artificer, secondary artificer, no list, marker');
{
  // Control-cleric Wisdom (2026-11-09, gate fix): the control
  // cleric must be legal under the CLERIC cap too (Wis mod + cleric
  // level, #10 cleric PUT validator, character.js) — a Wis-10 L5
  // cleric caps at 5, so the 10-spell list 400s naming 'cleric' and
  // the skip under test is never reached. Wis 20 -> cap 10 at L5
  // (exactly at cap), cap 9 at L4, so the PUT returns 200 only if
  // the validator under test skips; if it misfired it would still
  // 400 (its own cap is 5 or less at these levels).
  // Non-artificer (cleric) with a 10-spell list: no artificer cap applies.
  const cleric5 = await makeCharacter({ name: 'ClericFive', cls: 'cleric', level: 5, intScores: { ...INT3_SCORES, wis: 20 } });
  const clericPut = await req('PUT', `/api/character/${cleric5}`, { prepared_spells: J(CLERIC_10) });
  check(clericPut.status === 200, `cleric PUT with ${CLERIC_10.length} prepared spells is unaffected, 200 (got ${clericPut.status})`);
  check(JSON.stringify(await readPrepared(cleric5)) === JSON.stringify(CLERIC_10), 'cleric long list persisted');
  // Artificer-as-secondary multiclass: primary cleric governs the shared
  // column, so the artificer cap does not fire on the PUT.
  const multi = await makeCharacter({
    name: 'ClericArt', cls: 'cleric', level: 5, intScores: { ...INT3_SCORES, wis: 20 },
    classLevels: [{ class: 'cleric', level: 4, subclass: null }, { class: 'artificer', level: 1, subclass: null }],
  });
  const multiPut = await req('PUT', `/api/character/${multi}`, { prepared_spells: J(COUNTED_6) });
  check(multiPut.status === 200, `multiclass (cleric primary, artificer secondary) PUT over the artificer cap is skipped, 200 (got ${multiPut.status})`);
  // No prepared_spells in the body: a plain field update is unaffected.
  const art5 = await makeCharacter({ name: 'ArtNoList', cls: 'artificer', level: 5, intScores: INT3_SCORES });
  await seedStoredPrepared(art5, COUNTED_5);
  const plain = await req('PUT', `/api/character/${art5}`, { name: 'ArtNoList Renamed' });
  check(plain.status === 200, `PUT with no prepared_spells is unaffected, 200 (got ${plain.status})`);
  check((await readCharacter(art5)).name === 'ArtNoList Renamed', 'plain PUT still persisted the name change');
  check(JSON.stringify(await readPrepared(art5)) === JSON.stringify(COUNTED_5), 'plain PUT left the stored prepared list alone');
  // Creator-marker PUT goes through the Stage 4 validator, not the new
  // block: a valid at-cap list passes (the new block must not interfere).
  // Stage 4 is level-1 creation only (its spell check hardcodes level 1),
  // so the valid marker case is a level-1 artificer at its L1 cap.
  const markerArt = await makeCharacter({ name: 'ArtMarker', cls: 'artificer', level: 1, intScores: INT3_SCORES });
  const markerPut = await req('PUT', `/api/character/${markerArt}`, {
    creator: 'creator-next', prepared_spells: J(COUNTED_3),
  });
  check(markerPut.status === 200,
    `creator-marker PUT with a valid at-cap list passes 200 (got ${markerPut.status}: ${JSON.stringify(markerPut.json?.error || '')})`);
  check(JSON.stringify(await readPrepared(markerArt)) === JSON.stringify(COUNTED_3), 'marker PUT persisted the list');
}

// ===========================================================================
// (c) Level-up path — stored-list re-check on leveling up IN artificer
// ===========================================================================
group('(c) level-up re-check: over-cap stored list blocks, level unchanged');
{
  // Artificer L4 -> L5, Int +3: new cap is preparedSpellsForLevel(5, +3).
  const cap5 = preparedSpellsForLevel(5, INT_MOD);
  const over = await makeCharacter({
    name: 'ArtLevelOver', cls: 'artificer', level: 4, subclass: 'lumberjack', intScores: INT3_SCORES,
  });
  await db.dbRun('UPDATE characters SET experience = ? WHERE id = ?', [getXPToNextLevel(4), over]);
  await seedStoredPrepared(over, COUNTED_6);
  const blocked = await req('POST', `/api/character/level-up/${over}`, {});
  check(blocked.status === 400, `level-up with stored ${COUNTED_6.length} spells (new cap ${cap5}) refuses 400 (got ${blocked.status})`);
  check(typeof blocked.json?.error === 'string' && blocked.json.error.includes('preparedSpells'),
    `level-up refusal names preparedSpells (got ${JSON.stringify(blocked.json?.error)})`);
  check(typeof blocked.json?.error === 'string' && blocked.json.error.includes('fix the prepared list'),
    'level-up refusal tells the player to fix the list on the character sheet');
  const overRow = await readCharacter(over);
  check(overRow.level === 4, 'blocked level-up left the level at 4');
  check(JSON.stringify(JSON.parse(overRow.prepared_spells)) === JSON.stringify(COUNTED_6),
    'blocked level-up left the stored prepared list unchanged');

  // Same shape, valid stored list: 200, level increases to 5.
  const valid = await makeCharacter({
    name: 'ArtLevelOk', cls: 'artificer', level: 4, subclass: 'lumberjack', intScores: INT3_SCORES,
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

group('(c2) level-up re-check at L1 -> L2 (cap 3, same Int +3)');
{
  const cap2 = preparedSpellsForLevel(2, INT_MOD);
  check(cap2 === 4, `cap source: preparedSpellsForLevel(2, +3) = 4 (got ${cap2})`);
  const over = await makeCharacter({ name: 'ArtLevelOneOver', cls: 'artificer', level: 1, intScores: INT3_SCORES });
  await db.dbRun('UPDATE characters SET experience = ? WHERE id = ?', [getXPToNextLevel(1), over]);
  // 5 stored spells: over the L2 cap of 4.
  await seedStoredPrepared(over, COUNTED_5);
  const blocked = await req('POST', `/api/character/level-up/${over}`, {});
  check(blocked.status === 400, `L1->2 level-up with 5 stored spells (new cap ${cap2}) refuses 400 (got ${blocked.status})`);
  check((await readCharacter(over)).level === 1, 'blocked L1->2 level-up left the level at 1');
}

group('(c3) level-up skips multiclass INTO artificer');
{
  // Cleric 3 -> total 4 by multiclassing into artificer, with a stored
  // 4-spell list from the cleric side. The list belongs to the other
  // class, so the re-check must not fire (artificer L1 cap would be 3).
  const capArt1 = preparedSpellsForLevel(1, INT_MOD);
  check(capArt1 === 3, `cap source: artificer L1 cap is ${capArt1} at Int +3 (the stored 4 would fail it)`);
  const cleric = await makeCharacter({ name: 'ClericMulti', cls: 'cleric', level: 3, intScores: INT3_SCORES });
  await db.dbRun('UPDATE characters SET experience = ? WHERE id = ?', [getXPToNextLevel(3), cleric]);
  await seedStoredPrepared(cleric, [...COUNTED_3, 'Alarm']);
  const multi = await req('POST', `/api/character/level-up/${cleric}`, { selectedClass: 'Artificer' });
  check(multi.status === 200,
    `multiclass into artificer with a stored 4-spell list is NOT blocked, 200 (got ${multi.status}: ${JSON.stringify(multi.json?.error || '')})`);
  const multiRow = await readCharacter(cleric);
  check(multiRow.level === 4, 'multiclass level-up raised the total level to 4');
  const levels = JSON.parse(multiRow.class_levels || '[]');
  const artEntry = levels.find((c) => String(c.class).toLowerCase() === 'artificer');
  check(artEntry?.level === 1, 'multiclass artificer entry stored at level 1');
  check(JSON.stringify(JSON.parse(multiRow.prepared_spells)) === JSON.stringify([...COUNTED_3, 'Alarm']),
    'multiclass level-up kept the stored prepared list');
}

server.close();
console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
process.exit(failed > 0 ? 1 : 0);
