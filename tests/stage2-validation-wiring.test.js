// tests/stage2-validation-wiring.test.js — creator-next Stage 2 validation
// wiring (Zach, 2026-11-05; picked first over the Stage 3 mappings).
//
// validateCreatorNextStage2 used to be exported but called by NO route:
// Stage 2 picks never reached the server at all (the shell saved
// Stage-1-only fields; class/subclass mirrored to localStorage only).
// This build wires it in:
//   - stage1Persistence.js sends body.creator === 'creator-next' plus
//     the Stage 2 picks (class/subclass) on every creator-next save;
//   - POST / and PUT /:id run validateCreatorNextStage2 ONLY when that
//     marker is present, and refuse invalid picks with a 400 naming the
//     field (classId / subclassId). No marker, no validation — Prelude,
//     seeds, tests, and the character sheet are unaffected.
//   - the shell already surfaces a refused save ("Couldn't save: ..."
//     + "Your input is preserved") and blocks the advance, so no shell
//     redesign was needed.
//
// The wrapper is draft-tolerant by design: an absent pick is not an
// invalid pick (Stage 2 saves are draft autosaves; the hard gate is
// Review, Stage 6). What it refuses: an unknown class; a subclass
// that is not that class's subclass (or not in the registry); a
// subclass sent for a class that does not choose one at level 1
// (after the 2024-accuracy audit, 2026-11-05, Stage 2 only collects a
// subclass for level-1 classes: magus, scholar — cleric, sorcerer,
// warlock, wizard, druid all choose at 3rd under the 2024 PHB).
//
// Honest integration tests: the wrapper is imported from the real
// route file, and the HTTP sections drive the real router over HTTP
// on a real throwaway DB. If character.js were deleted, the import
// fails and the suite fails with it. No totals are hardcoded from
// memory — registry names asserted here (Champion, Life Domain,
// Ritualist) are the same pairs the Stage 2 suite already proves
// against the live registry.
//
// Isolated throwaway DB (perception-pre-roll / mvp pattern): temp dir
// becomes CWD before database.js loads, and the runner's shared TURSO
// env is deleted so database.js uses the local file.
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

const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'stage2-validation-wiring-test-'));
const tmpDir = repoRoot;
const origCwd = process.cwd();
process.chdir(tmpDir);
delete process.env.TURSO_DATABASE_URL;
delete process.env.TURSO_AUTH_TOKEN;
const fromRepo = (rel) => pathToFileURL(path.join(origCwd, rel)).href;
const readRepo = (rel) => fs.readFileSync(path.join(origCwd, rel), 'utf-8');

const db = await import(fromRepo('server/database.js'));
await db.initDatabase();
// The real wrapper, from the real route file.
const { validateCreatorNextStage2 } = await import(fromRepo('server/routes/character.js'));

// --- HTTP harness: the real character router on a real express app ----
const app = express();
app.use(express.json());
const characterRouter = (await import(fromRepo('server/routes/character.js'))).default;
app.use('/api/character', characterRouter);
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
async function characterCountByName(name) {
  const row = await db.dbGet('SELECT COUNT(*) AS n FROM characters WHERE name = ?', [name]);
  return row?.n ?? 0;
}
async function characterClassByName(name) {
  const row = await db.dbGet('SELECT class, subclass FROM characters WHERE name = ?', [name]);
  return row || null;
}

const MARKER = 'creator-next';

// ===========================================================================
// (a) Wrapper, direct — draft-tolerant, field-named refusals
// ===========================================================================
group('(a) validateCreatorNextStage2 — unit, real route export');
{
  check(validateCreatorNextStage2({}).ok === true, 'empty body is a draft, not invalid');
  check(validateCreatorNextStage2({ class: 'creating' }).ok === true, "'creating' placeholder passes");
  check(validateCreatorNextStage2({ class: 'prelude' }).ok === true, "'prelude' placeholder passes");
  check(validateCreatorNextStage2({ classId: 'fighter' }).ok === true, 'L3 class with no subclass passes');
  check(validateCreatorNextStage2({ classId: 'cleric' }).ok === true, 'cleric with no subclass yet passes (draft)');
  check(validateCreatorNextStage2({ classId: 'druid' }).ok === true, 'druid with no subclass yet passes (draft)');
  check(validateCreatorNextStage2({ classId: 'wizard' }).ok === true, 'wizard with no subclass yet passes (draft)');
  // 2024 audit: all five corrected classes refuse a subclass at level 1.
  for (const [cls, sub] of [
    ['cleric', 'Life Domain'], ['sorcerer', 'Aberrant Sorcery'],
    ['warlock', 'Archfey Patron'], ['wizard', 'Abjurer'],
    ['druid', 'Circle of the Land'],
  ]) {
    const r = validateCreatorNextStage2({ classId: cls, subclassName: sub });
    check(r.ok === false, `${cls} + ${sub} is refused (subclass not due at level 1)`);
    check(r.errors.join(' ').includes('subclassId:'), `${cls} refusal names subclassId`);
    check(r.errors.join(' ').includes('level 3'), `${cls} refusal states the subclass level (level 3)`);
  }
  check(validateCreatorNextStage2({ classId: 'scholar', subclassName: 'Ritualist' }).ok === true,
    'scholar + Ritualist passes');
  check(validateCreatorNextStage2({ classId: 'magus', subclassName: 'The Arcane Order' }).ok === true,
    'magus + The Arcane Order passes (still level 1)');
  check(validateCreatorNextStage2({ classId: 'blood_hunter' }).ok === true, 'blood_hunter passes (client-only class)');
  check(validateCreatorNextStage2({ classId: 'keeper' }).ok === true, 'keeper passes (client-only class)');
  check(validateCreatorNextStage2({ classId: 'warlord' }).ok === true, 'warlord passes (client-only class)');

  const unknownClass = validateCreatorNextStage2({ classId: 'not-a-class' });
  check(unknownClass.ok === false, 'unknown class is refused');
  check(unknownClass.errors.join(' ').includes('classId:'), 'unknown-class refusal names classId');

  const crossClass = validateCreatorNextStage2({ classId: 'cleric', subclassName: 'Champion' });
  check(crossClass.ok === false, 'cleric + Champion is refused');
  check(crossClass.errors.join(' ').includes('subclassId:'), 'cross-class refusal names subclassId');

  const tooEarly = validateCreatorNextStage2({ classId: 'fighter', subclassName: 'Champion' });
  check(tooEarly.ok === false, 'fighter + Champion is refused (subclass not due at level 1)');
  check(tooEarly.errors.join(' ').includes('subclassId:'), 'too-early-subclass refusal names subclassId');
  check(tooEarly.errors.join(' ').includes('level 3'), 'too-early refusal states the subclass level');

  const l2 = validateCreatorNextStage2({ classId: 'wizard', subclassName: 'Evocation' });
  check(l2.ok === false && l2.errors.join(' ').includes('subclassId:'),
    'wizard + Evocation is refused (level 3) naming subclassId');
  check(l2.errors.join(' ').includes('level 3'), 'wizard refusal states the subclass level (level 3, not the old level 2)');

  const artificer = validateCreatorNextStage2({ classId: 'artificer', subclassName: 'Alchemist' });
  check(artificer.ok === false && artificer.errors.join(' ').includes('subclassId:'),
    'artificer + Alchemist is refused (level 3, unverifiable) naming subclassId');

  const bh = validateCreatorNextStage2({ classId: 'blood_hunter', subclassName: 'Order of the Ghostslayer' });
  check(bh.ok === false && bh.errors.join(' ').includes('subclassId:'),
    'blood_hunter + subclass is refused naming subclassId');

  const alias = validateCreatorNextStage2({ class: 'Fighter', subclass: 'Champion' });
  check(alias.ok === false && alias.errors.join(' ').includes('subclassId:'),
    'class/subclass aliases work (case-insensitive class), still refused');
}

// ===========================================================================
// (b) POST — the marker gates it; invalid picks refused, valid pass
// ===========================================================================
group('(b) POST /api/character — marker-gated validation');
{
  const badCleric = await postCharacter({ name: 'W2 Cleric', race: 'human', creator: MARKER, class: 'cleric', subclass: 'Life Domain' });
  check(badCleric.status === 400, `marker + cleric/Life Domain refused with 400 (got ${badCleric.status})`);
  check(typeof badCleric.json?.error === 'string' && badCleric.json.error.includes('subclassId:'),
    `cleric refusal names subclassId (got ${JSON.stringify(badCleric.json)})`);
  check(typeof badCleric.json?.error === 'string' && badCleric.json.error.includes('level 3'),
    `cleric refusal states level 3 (got ${JSON.stringify(badCleric.json)})`);
  check(await characterCountByName('W2 Cleric') === 0, 'refused cleric/Life Domain created no row');

  // A second corrected class over HTTP (unit group covers all five).
  const badDruid = await postCharacter({ name: 'W2 Druid', race: 'human', creator: MARKER, class: 'druid', subclass: 'Circle of the Land' });
  check(badDruid.status === 400, `marker + druid/Circle of the Land refused with 400 (got ${badDruid.status})`);
  check(typeof badDruid.json?.error === 'string' && badDruid.json.error.includes('subclassId:'),
    `druid refusal names subclassId (got ${JSON.stringify(badDruid.json)})`);
  check(await characterCountByName('W2 Druid') === 0, 'refused druid/Circle of the Land created no row');

  // The two remaining level-1 classes still pass over HTTP — except
  // magus, grayed out for the MVP (2026-11-08): the route-level class
  // guard refuses it with 400 naming the class, and no row is made.
  // (The Stage 2 validator above still passes magus + The Arcane
  // Order at the unit level — the refusal lives in the route, not
  // in the validator.)
  const okMagus = await postCharacter({ name: 'W2 Magus', race: 'human', creator: MARKER, class: 'magus', subclass: 'The Arcane Order' });
  check(okMagus.status === 400, `marker + magus/The Arcane Order refused with 400 (MVP gray-out, got ${okMagus.status})`);
  check(typeof okMagus.json?.error === 'string' && okMagus.json.error.includes('Class Magus is not available for player characters yet'),
    `magus refusal names the class (got ${JSON.stringify(okMagus.json)})`);
  check(await characterCountByName('W2 Magus') === 0, 'refused magus created no row');

  const okFighter = await postCharacter({ name: 'W2 Fighter', race: 'human', creator: MARKER, class: 'fighter' });
  check(okFighter.status === 201, `marker + fighter (no subclass) accepted with 201 (got ${okFighter.status})`);

  const okDraft = await postCharacter({ name: 'W2 Draft', race: 'human', creator: MARKER });
  check(okDraft.status === 201, `marker + Stage-1-only body accepted with 201 (got ${okDraft.status})`);

  for (const cls of ['blood_hunter', 'keeper', 'warlord']) {
    const r = await postCharacter({ name: `W2 ${cls}`, race: 'human', creator: MARKER, class: cls });
    check(r.status === 201, `marker + ${cls} accepted with 201 (got ${r.status})`);
  }

  const badClass = await postCharacter({ name: 'W2 Bad Class', race: 'human', creator: MARKER, class: 'not-a-class' });
  check(badClass.status === 400, `marker + unknown class refused with 400 (got ${badClass.status})`);
  check(typeof badClass.json?.error === 'string' && badClass.json.error.includes('classId:'),
    `unknown-class refusal names classId (got ${JSON.stringify(badClass.json)})`);
  check(await characterCountByName('W2 Bad Class') === 0, 'refused unknown class created no row');

  const badSub = await postCharacter({ name: 'W2 Bad Sub', race: 'human', creator: MARKER, class: 'fighter', subclass: 'Champion' });
  check(badSub.status === 400, `marker + fighter/Champion refused with 400 (got ${badSub.status})`);
  check(typeof badSub.json?.error === 'string' && badSub.json.error.includes('subclassId:'),
    `too-early-subclass refusal names subclassId (got ${JSON.stringify(badSub.json)})`);
  check(await characterCountByName('W2 Bad Sub') === 0, 'refused fighter/Champion created no row');

  const badCross = await postCharacter({ name: 'W2 Bad Cross', race: 'human', creator: MARKER, class: 'cleric', subclass: 'Champion' });
  check(badCross.status === 400, `marker + cleric/Champion refused with 400 (got ${badCross.status})`);
  check(typeof badCross.json?.error === 'string' && badCross.json.error.includes('subclassId:'),
    `cross-class refusal names subclassId (got ${JSON.stringify(badCross.json)})`);
  check(await characterCountByName('W2 Bad Cross') === 0, 'refused cleric/Champion created no row');

  // The gate: no marker, no validation — old-path behavior preserved.
  const noMarkerBadClass = await postCharacter({ name: 'W2 No Marker Class', race: 'human', class: 'not-a-class' });
  check(noMarkerBadClass.status === 201, `no marker + unknown class still accepted with 201 (got ${noMarkerBadClass.status})`);
  const noMarkerBadSub = await postCharacter({ name: 'W2 No Marker Sub', race: 'human', class: 'fighter', subclass: 'Champion' });
  check(noMarkerBadSub.status === 201, `no marker + fighter/Champion still accepted with 201 (got ${noMarkerBadSub.status})`);
  const noMarkerOther = await postCharacter({ name: 'W2 No Marker Other', race: 'human', creator: 'something-else', class: 'not-a-class' });
  check(noMarkerOther.status === 201, `other creator value + unknown class still accepted with 201 (got ${noMarkerOther.status})`);
}

// ===========================================================================
// (c) PUT — same gate on the draft-update path; refusals leave the row alone
// ===========================================================================
group('(c) PUT /api/character/:id — marker-gated validation');
{
  const created = await postCharacter({ name: 'W2 Put Row', race: 'human', class: 'fighter' });
  check(created.status === 201, `PUT fixture row created (got ${created.status})`);
  const id = created.json?.id;
  check(typeof id === 'number', `PUT fixture row has an id (got ${JSON.stringify(created.json?.id)})`);

  const badPut = await putCharacter(id, { creator: MARKER, class: 'cleric', subclass: 'Life Domain' });
  check(badPut.status === 400, `PUT marker + cleric/Life Domain refused with 400 (got ${badPut.status})`);
  check(typeof badPut.json?.error === 'string' && badPut.json.error.includes('subclassId:'),
    `PUT cleric refusal names subclassId (got ${JSON.stringify(badPut.json)})`);
  const afterBadPut = await characterClassByName('W2 Put Row');
  check(afterBadPut?.class === 'fighter' && (afterBadPut?.subclass === null || afterBadPut?.subclass === undefined),
    `refused cleric PUT left the row unchanged (got ${afterBadPut?.class}/${afterBadPut?.subclass})`);

  const badClassPut = await putCharacter(id, { creator: MARKER, class: 'not-a-class' });
  check(badClassPut.status === 400, `PUT marker + unknown class refused with 400 (got ${badClassPut.status})`);
  check(typeof badClassPut.json?.error === 'string' && badClassPut.json.error.includes('classId:'),
    `PUT refusal names classId (got ${JSON.stringify(badClassPut.json)})`);
  const afterBad = await characterClassByName('W2 Put Row');
  check(afterBad?.class === 'fighter', `refused PUT left the row unchanged (class still ${afterBad?.class})`);

  const badSubPut = await putCharacter(id, { creator: MARKER, class: 'fighter', subclass: 'Champion' });
  check(badSubPut.status === 400, `PUT marker + fighter/Champion refused with 400 (got ${badSubPut.status})`);
  const afterBadSub = await characterClassByName('W2 Put Row');
  check(afterBadSub?.class === 'fighter' && (afterBadSub?.subclass === null || afterBadSub?.subclass === undefined),
    `refused subclass PUT left the row unchanged (got ${afterBadSub?.class}/${afterBadSub?.subclass})`);

  // Scholar is grayed out for the MVP (2026-11-08): the route-level
  // class guard refuses the PUT with 400 naming the class, and the
  // row is unchanged. (The Stage 2 validator above still passes
  // scholar + Ritualist at the unit level — the refusal lives in
  // the route, not in the validator.)
  const okPut = await putCharacter(id, { creator: MARKER, class: 'scholar', subclass: 'Ritualist' });
  check(okPut.status === 400, `PUT marker + scholar/Ritualist refused with 400 (MVP gray-out, got ${okPut.status})`);
  check(typeof okPut.json?.error === 'string' && okPut.json.error.includes('Class Scholar is not available for player characters yet'),
    `PUT scholar refusal names the class (got ${JSON.stringify(okPut.json)})`);
  const afterOk = await characterClassByName('W2 Put Row');
  check(afterOk?.class === 'fighter' && (afterOk?.subclass === null || afterOk?.subclass === undefined),
    `refused scholar PUT left the row unchanged (got ${afterOk?.class}/${afterOk?.subclass})`);

  // The gate on PUT too: no marker, no validation.
  const noMarkerPut = await putCharacter(id, { class: 'not-a-class' });
  check(noMarkerPut.status === 200, `PUT no marker + unknown class still accepted with 200 (got ${noMarkerPut.status})`);
  const afterNoMarker = await characterClassByName('W2 Put Row');
  check(afterNoMarker?.class === 'not-a-class', `unmarked PUT wrote the class (old-path behavior, got ${afterNoMarker?.class})`);
}

// ===========================================================================
// (d) Client — the marker + picks ride the save; the shell surfaces refusals
// ===========================================================================
group('(d) client wiring — static guards');
{
  const persistence = readRepo('client/src/components/creator-next/stage1Persistence.js');
  check(persistence.includes("body.creator = 'creator-next'"), 'saveStage1Progress sends the creator-next marker');
  check(persistence.includes('if (state.classId) body.class = state.classId'), 'saveStage1Progress sends the Stage 2 class pick');
  check(persistence.includes('if (state.subclassName) body.subclass = state.subclassName'), 'saveStage1Progress sends the Stage 2 subclass pick');
  const buildFn = persistence.split('export async function saveStage1Progress')[0]
    .split('export function buildStage1ProgressBody(state) {')[1] || '';
  check(!buildFn.includes('body.creator'), 'buildStage1ProgressBody stays marker-free (blank-save guard semantics intact)');

  const shell = readRepo('client/src/components/creator-next/CreatorNextShell.jsx');
  check(shell.includes("Couldn't save: {saveError}"), 'shell renders the save refusal ("Couldn\'t save: {saveError}")');
  check(shell.includes('Your input is preserved'), 'shell tells the player their input is preserved on a refused save');

  const route = readRepo('server/routes/character.js');
  const gates = (route.match(/req\.body\.creator === 'creator-next'/g) || []).length;
  check(gates === 2, `both POST and PUT carry the marker gate (found ${gates})`);
  check(!route.includes('DELIBERATELY NOT CALLED'), 'the stale "DELIBERATELY NOT CALLED" comment is gone');
  // Level-up follow-up (2026-11-05): SUBCLASS_LEVELS itself was
  // corrected to the 2024 levels, so the creator-local override was
  // removed — the wrapper reads the shared table directly.
  check(!route.includes('CREATOR_SUBCLASS_LEVELS'), 'the creator-local override is gone (SUBCLASS_LEVELS now carries the 2024 levels)');
  check(route.includes('const subclassLevel = SUBCLASS_LEVELS[cls]'), 'the wrapper reads SUBCLASS_LEVELS directly');
}

// ---------------------------------------------------------------------------
server.close();
console.log(`\n stage2-validation-wiring: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
