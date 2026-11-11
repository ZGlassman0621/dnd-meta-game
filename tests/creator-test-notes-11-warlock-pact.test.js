// tests/creator-test-notes-11-warlock-pact.test.js — creator
// test-notes item 11 (Zach, 2026-11-09): the creator's Stage 2 pact
// picker needs persistence for the chosen Pact. The 2024 PHB has
// THREE Pacts (Blade / Chain / Tome — Talisman is 2014-only and is
// never stored); the Pact IS an L1 invocation, and no invocation data
// exists in the app. Persistence decision (recorded in
// server/notes.md BEFORE building): a plain `pact` TEXT column on
// `characters` (migration 113), CHECK-constrained to the three 2024
// keys, NULL for non-warlocks — a single choice per warlock, exactly
// like `subclass`. The full 28-invocation registry + picker is a
// follow-up, NOT this job; the follow-up reads characters.pact as
// the L1 invocation or migrates one row per character.
//
// Wire contract: `pact: 'blade' | 'chain' | 'tome'` (lowercase keys
// only; the server normalizes case/whitespace and refuses anything
// else 400). Read-back: the row GET is SELECT * so the pact flows to
// the creator resume automatically; the progression snapshot carries
// it too (same shape as subclass).
//
// Honest integration tests: the real character + progression routers
// over real HTTP against a real throwaway DB (migrations run, so 113
// applies), the real validateCreatorNextStage2 for the refusals, and
// the real normWarlockPact / WARLOCK_PACTS for the canonical values.
// If any real module were deleted, the imports fail and the suite
// fails with them.
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

const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'creator-test-notes-11-test-'));
const tmpDir = repoRoot;
const origCwd = process.cwd();
process.chdir(tmpDir);
delete process.env.TURSO_DATABASE_URL;
delete process.env.TURSO_AUTH_TOKEN;
const fromRepo = (rel) => pathToFileURL(path.join(origCwd, rel)).href;

const db = await import(fromRepo('server/database.js'));
await db.initDatabase();
// The real modules under test.
const {
  validateCreatorNextStage2, WARLOCK_PACTS, normWarlockPact,
} = await import(fromRepo('server/routes/character.js'));

// --- HTTP harness: the real character + progression routers ----------
const app = express();
app.use(express.json());
const characterRouter = (await import(fromRepo('server/routes/character.js'))).default;
const progressionRouter = (await import(fromRepo('server/routes/progression.js'))).default;
app.use('/api/character', characterRouter);
app.use('/api/progression', progressionRouter);
const server = await new Promise((resolve) => {
  const s = app.listen(0, '127.0.0.1', () => resolve(s));
});
const base = `http://127.0.0.1:${server.address().port}`;
async function postCharacter(body) {
  const res = await fetch(`${base}/api/character`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  let json = null;
  try { json = await res.json(); } catch {}
  return { status: res.status, json };
}
async function putCharacter(id, body) {
  const res = await fetch(`${base}/api/character/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  let json = null;
  try { json = await res.json(); } catch {}
  return { status: res.status, json };
}
async function getJson(path) {
  const res = await fetch(`${base}${path}`);
  let json = null;
  try { json = await res.json(); } catch {}
  return { status: res.status, json };
}
async function readCharacter(id) {
  return db.dbGet('SELECT * FROM characters WHERE id = ?', [id]);
}

const MARKER = 'creator-next';
const J = (v) => JSON.stringify(v); // the wire format for JSON columns: strings, not raw arrays

// --- Verified-good fixture shape (creator-next-stage4.test.js) ------
// Dwarf / soldier, as the cleric fixture — but a warlock: Religion is
// a warlock class skill too, and the warlock prepares exactly 2 spells
// at L1 (hex, armor of agathys — the Stage 4 unit case).
const DWARF_BASE = { str: 12, dex: 10, con: 13, int: 8, wis: 15, cha: 14 };
const DWARF_FINAL = { str: 14, dex: 10, con: 16, int: 8, wis: 16, cha: 14 };
function warlockBody(overrides = {}) {
  return {
    creator: MARKER, class: 'warlock', race: 'dwarf', subrace: 'Hill Dwarf',
    theme_id: 'soldier', generation_method: 'point_buy',
    base_scores: DWARF_BASE, ability_scores: DWARF_FINAL,
    skills: ['Athletics', 'Intimidation', 'Religion'],
    languages: ['Common', 'Dwarvish'],
    prepared_spells: ['hex', 'armor of agathys'],
    ...overrides,
  };
}
function warlockPostBody(name, overrides = {}) {
  return {
    name, ...warlockBody(overrides),
    base_scores: DWARF_BASE, ability_scores: J(DWARF_FINAL),
    skills: J(['Athletics', 'Intimidation', 'Religion']),
    languages: J(['Common', 'Dwarvish']),
    prepared_spells: J(['hex', 'armor of agathys']),
  };
}

// (a) The canonical values come from the source itself, and the
// Stage 2 validator enforces them with field-named refusals.
group('(a) Pact values + Stage 2 validation (real validator)');
{
  check(Array.isArray(WARLOCK_PACTS) && WARLOCK_PACTS.length === 3
    && WARLOCK_PACTS.includes('blade') && WARLOCK_PACTS.includes('chain') && WARLOCK_PACTS.includes('tome'),
    `exactly three 2024 pacts (got ${JSON.stringify(WARLOCK_PACTS)})`);
  check(!WARLOCK_PACTS.includes('talisman'), 'Talisman (2014-only) is not a valid pact');
  check(normWarlockPact('Blade') === 'blade', "normWarlockPact('Blade') normalizes to 'blade'");
  check(normWarlockPact('talisman') === null, "normWarlockPact('talisman') is null");
  check(normWarlockPact('Pact of the Blade') === null, "normWarlockPact('Pact of the Blade') is null (keys only)");
  check(validateCreatorNextStage2({ class: 'warlock', pact: 'blade' }).ok === true,
    'warlock + blade passes Stage 2');
  check(validateCreatorNextStage2({ class: 'warlock' }).ok === true,
    'warlock with no pact yet passes Stage 2 (a draft, not an error)');
  const talisman = validateCreatorNextStage2({ class: 'warlock', pact: 'talisman' });
  check(talisman.ok === false && JSON.stringify(talisman.errors).includes('pact:'),
    `warlock + talisman refuses naming pact (got ${JSON.stringify(talisman.errors)})`);
  const fighter = validateCreatorNextStage2({ class: 'fighter', pact: 'blade' });
  check(fighter.ok === false && JSON.stringify(fighter.errors).includes('pact:')
    && JSON.stringify(fighter.errors).includes('warlock'),
    `fighter + blade refuses naming pact + warlock (got ${JSON.stringify(fighter.errors)})`);
  const noClass = validateCreatorNextStage2({ pact: 'blade' });
  check(noClass.ok === false && JSON.stringify(noClass.errors).includes('pact:'),
    `a pact with no class refuses (got ${JSON.stringify(noClass.errors)})`);
}

// (b) HTTP round-trip: a marker POST persists the pact, and both
// read paths (row GET, progression snapshot) carry it.
group('(b) POST persists the pact; row + snapshot read it back');
{
  const created = await postCharacter({ ...warlockPostBody('T11 Warlock Blade'), pact: 'blade' });
  check(created.status === 201, `warlock POST with pact blade creates 201 (got ${created.status}: ${JSON.stringify(created.json?.error || '')})`);
  const charId = created.json?.id;
  check(typeof charId === 'number', `created row has an id (got ${JSON.stringify(created.json?.id)})`);
  check(created.json?.pact === 'blade', `POST response row carries pact 'blade' (got ${JSON.stringify(created.json?.pact)})`);
  const row = await readCharacter(charId);
  check(row?.pact === 'blade', `characters.pact reads back 'blade' (got ${JSON.stringify(row?.pact)})`);
  const rowGet = await getJson(`/api/character/${charId}`);
  check(rowGet.status === 200 && rowGet.json?.pact === 'blade',
    `row GET carries pact 'blade' (got ${rowGet.status} / ${JSON.stringify(rowGet.json?.pact)})`);
  const prog = await getJson(`/api/character/${charId}/progression`);
  check(prog.status === 200 && prog.json?.character?.pact === 'blade',
    `progression snapshot carries pact 'blade' (got ${prog.status} / ${JSON.stringify(prog.json?.character?.pact)})`);
}

// (c) HTTP refusals: a bad pact value and a pact on a non-warlock
// both 400 with a field-named error and create no row.
group('(c) POST refusals (400, no row)');
{
  const bad = await postCharacter({ ...warlockPostBody('T11 Talisman'), pact: 'talisman' });
  check(bad.status === 400 && typeof bad.json?.error === 'string' && bad.json.error.includes('pact:'),
    `warlock + talisman refuses 400 naming pact (got ${bad.status}: ${JSON.stringify(bad.json?.error || '')})`);
  check((await db.dbGet('SELECT COUNT(*) AS n FROM characters WHERE name = ?', ['T11 Talisman']))?.n === 0,
    'refused talisman POST created no row');
  const fighterBody = warlockPostBody('T11 Fighter Pact', { class: 'fighter' });
  const fighter = await postCharacter({ ...fighterBody, pact: 'blade' });
  check(fighter.status === 400 && typeof fighter.json?.error === 'string' && fighter.json.error.includes('pact:'),
    `fighter + blade refuses 400 naming pact (got ${fighter.status}: ${JSON.stringify(fighter.json?.error || '')})`);
  check((await db.dbGet('SELECT COUNT(*) AS n FROM characters WHERE name = ?', ['T11 Fighter Pact']))?.n === 0,
    'refused fighter-pact POST created no row');
}

// (d) PUT re-pick + clear: a marker PUT carrying only the pact is a
// real update, and null clears the pick.
group('(d) PUT re-picks and clears the pact');
{
  const created = await postCharacter({ ...warlockPostBody('T11 Warlock Repick'), pact: 'chain' });
  check(created.status === 201, `re-pick draft creates 201 (got ${created.status})`);
  const charId = created.json?.id;
  const repick = await putCharacter(charId, { creator: MARKER, pact: 'tome' });
  check(repick.status === 200, `PUT pact tome persists 200 (got ${repick.status}: ${JSON.stringify(repick.json?.error || '')})`);
  check((await readCharacter(charId))?.pact === 'tome', "pact reads back 'tome' after the re-pick PUT");
  const cleared = await putCharacter(charId, { creator: MARKER, pact: null });
  check(cleared.status === 200, `PUT pact null persists 200 (got ${cleared.status}: ${JSON.stringify(cleared.json?.error || '')})`);
  check((await readCharacter(charId))?.pact === null, 'pact reads back null after the clear PUT');
}

// (e) A class change away from warlock clears a stored pact instead
// of leaving a stale claim; and a pact PUT on the resulting fighter
// refuses (the allowlist check covers non-marker callers too).
group('(e) Leaving warlock clears the pact; fighter cannot re-add it');
{
  const created = await postCharacter({ ...warlockPostBody('T11 Warlock Leaves'), pact: 'blade' });
  check(created.status === 201, `leaving draft creates 201 (got ${created.status})`);
  const charId = created.json?.id;
  check((await readCharacter(charId))?.pact === 'blade', "pact 'blade' stored before the class change");
  // Non-marker PUT: skips the Stage 2-5 gates, so the class change
  // itself is judged only by the scope refusals — the pact reset is
  // marker-independent by design.
  const changed = await putCharacter(charId, {
    class: 'fighter',
    skills: J(['Athletics', 'Intimidation', 'Perception']),
    prepared_spells: J([]), known_cantrips: J([]),
  });
  check(changed.status === 200, `class-change PUT persists 200 (got ${changed.status}: ${JSON.stringify(changed.json?.error || '')})`);
  const after = await readCharacter(charId);
  check(after?.class === 'fighter', `class reads back 'fighter' (got ${after?.class})`);
  check(after?.pact === null, `pact cleared on leaving warlock (got ${JSON.stringify(after?.pact)})`);
  const reAdd = await putCharacter(charId, { pact: 'chain' });
  check(reAdd.status === 400 && typeof reAdd.json?.error === 'string' && reAdd.json.error.includes('pact:'),
    `pact PUT on a fighter refuses 400 naming pact (got ${reAdd.status}: ${JSON.stringify(reAdd.json?.error || '')})`);
  check((await readCharacter(charId))?.pact === null, 'pact still null after the refused re-add');
}

server.close();
console.log(`=== Results: ${passed} passed, ${failed} failed ===`);
process.exit(failed ? 1 : 0);
