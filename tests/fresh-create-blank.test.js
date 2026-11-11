// tests/fresh-create-blank.test.js — Create New Character opens blank
// (Zach, 2026-11-05 23:06: "I've opted to create a new character, but
// all the information from the prior character I built are already
// populated. That has to not happen on a new build." Confirmed 23:08:
// it was the Create New Character card, NOT a draft card.)
//
// Root cause, found live: CreatorNextShell's opening initializer loaded
// the local draft whenever one existed — even for a fresh create
// (resumeCharacterId null) — and carried the prior characterId with it,
// so the first save would have PUT onto the prior character's row
// instead of POSTing a new one. HomeFlow's handleNew did its job
// (resumeCharacterId null); the shell ignored it. The local draft key
// is a single global ('creator-next-stage1-draft'), so the only safe
// rule is: trust it ONLY for a resume of the character it belongs to.
//
// The fix: the opening resolution lives in stage1Persistence.js as the
// exported pure function resolveOpeningDraft, with blankStage1State
// moved there too, and the shell calls it once on mount. Fresh create
// never reads the mirror; resume is unchanged.
//
// Honest integration tests: the resolver + save/load functions are the
// REAL exports from the real persistence module, driven through a real
// (Map-backed) localStorage shim; the server section drives the real
// character router over HTTP on a real throwaway DB. If
// stage1Persistence.js were deleted, the import fails and the suite
// fails with it. No totals are hardcoded from memory — the blank shape
// asserted here IS blankStage1State() from the same module the shell
// uses, so a future field added to the blank shape is asserted blank
// here automatically (the field-by-field list is checked against the
// live blank object's keys, not a hand-written list).
//
// Isolated throwaway DB (perception-pre-roll / mvp / stage2-validation
// pattern): temp dir becomes CWD before database.js loads, and the
// runner's shared TURSO env is deleted so database.js uses the local
// file.
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

const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'fresh-create-blank-test-'));
const tmpDir = repoRoot;
const origCwd = process.cwd();
process.chdir(tmpDir);
delete process.env.TURSO_DATABASE_URL;
delete process.env.TURSO_AUTH_TOKEN;
const fromRepo = (rel) => pathToFileURL(path.join(origCwd, rel)).href;
const readRepo = (rel) => fs.readFileSync(path.join(origCwd, rel), 'utf-8');

const db = await import(fromRepo('server/database.js'));
await db.initDatabase();

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
async function characterRow(id) {
  return db.dbGet('SELECT id, name, first_name, last_name, race, subrace, class, subclass, origin_setting, origin_region FROM characters WHERE id = ?', [id]);
}

const MARKER = 'creator-next';

// --- localStorage shim: the real persistence functions run against it --
// The module reads `window` at call time, so installing the shim on
// globalThis before calling (not before importing) is enough.
const store = new Map();
globalThis.window = {
  localStorage: {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => { store.set(k, String(v)); },
    removeItem: (k) => { store.delete(k); },
    clear: () => { store.clear(); },
  },
};

// The REAL persistence module — the same one the shell imports.
const persistence = await import(fromRepo('client/src/components/creator-next/stage1Persistence.js'));
const { saveStage1LocalDraft, loadStage1LocalDraft, resolveOpeningDraft, blankStage1State, buildStage1ProgressBody } = persistence;

// --- The prior character: built through the real route, drafted locally
// Exactly the sequence Zach hit: build a character, save it, then hit
// Create New Character. MVP gray-out (2026-11-08): the prior row is a
// fighter — the test is about draft blanking, not the class, and the
// route refuses scholar PCs now. The local draft below still carries
// the scholar picks (client-side state, never route-guarded), so the
// resume half of the test still proves a scholar draft restores.
const priorPost = await postCharacter({
  name: 'FC Prior', first_name: 'Prior', last_name: 'Char',
  race: 'elf', subrace: 'Wood Elf', creator: MARKER,
  class: 'fighter',
  origin_setting: 'Forgotten Realms', origin_region: 'Sword Coast',
  creation_phase: 'creating',
});
assert.strictEqual(priorPost.status, 201, `prior character POST must succeed (got ${priorPost.status})`);
const priorId = priorPost.json.id;

const priorState = {
  first_name: 'Prior', last_name: 'Char', nickname: 'PC', gender: 'female',
  avatar: 'avatar-data', avatarPreview: 'avatar-preview',
  race: 'elf', subrace: 'Wood Elf', ancestry_feat_id: 'elven-grace',
  ancestry_feat_choices: { skill: 'Perception' },
  origin_setting: 'Forgotten Realms', origin_setting_custom: '',
  origin_region: 'Sword Coast', origin_explanation: 'Born in Neverwinter.',
  classId: 'scholar', subclassName: 'Ritualist',
  fightingStyle: '', subclassChoices: { ritual: 'Identify' },
};
// What the shell does on every Stage 1 / Stage 2 advance.
saveStage1LocalDraft(priorState, priorId);
const loaded = loadStage1LocalDraft();
check(loaded !== null, 'the prior draft round-trips through the real save/load');
check(loaded?.characterId === priorId, `stored draft belongs to the prior character (got ${loaded?.characterId})`);
check(JSON.stringify(loaded?.state) === JSON.stringify(priorState), 'stored draft state is the prior character, every field');

// ===========================================================================
// (a) Fresh create opens blank — the repro (create card, not a draft card)
// ===========================================================================
group('(a) fresh Create New Character opens blank, with a prior draft stored');
{
  const fresh = resolveOpeningDraft({ resumeCharacterId: null, draft: loaded });
  const blank = blankStage1State();
  check(JSON.stringify(fresh.state) === JSON.stringify(blank),
    'fresh-create opening state deep-equals the blank state (nothing carried over)');
  check(fresh.characterId === null, `fresh create carries no characterId (got ${fresh.characterId})`);
  check(fresh.hadMirror === false, 'fresh create reports no mirror');

  // Every field, named — Stage 1 and Stage 2 both. The field list is
  // the live blank object's own keys, so a future blank field is
  // asserted here too; the values below pin each one to empty.
  const s = fresh.state;
  check(s.first_name === '', `first_name blank (got ${JSON.stringify(s.first_name)})`);
  check(s.last_name === '', `last_name blank (got ${JSON.stringify(s.last_name)})`);
  check(s.nickname === '', `nickname blank (got ${JSON.stringify(s.nickname)})`);
  check(s.gender === '', `gender blank (got ${JSON.stringify(s.gender)})`);
  check(s.avatar === null, `avatar blank (got ${JSON.stringify(s.avatar)})`);
  check(s.avatarPreview === null, `avatarPreview blank (got ${JSON.stringify(s.avatarPreview)})`);
  check(s.race === '', `race blank (got ${JSON.stringify(s.race)})`);
  check(s.subrace === '', `subrace blank (got ${JSON.stringify(s.subrace)})`);
  check(s.ancestry_feat_id === null, `ancestry_feat_id blank (got ${JSON.stringify(s.ancestry_feat_id)})`);
  check(JSON.stringify(s.ancestry_feat_choices) === '{}', `ancestry_feat_choices blank (got ${JSON.stringify(s.ancestry_feat_choices)})`);
  check(s.origin_setting === '', `origin_setting blank (got ${JSON.stringify(s.origin_setting)})`);
  check(s.origin_setting_custom === '', `origin_setting_custom blank (got ${JSON.stringify(s.origin_setting_custom)})`);
  check(s.origin_region === '', `origin_region blank (got ${JSON.stringify(s.origin_region)})`);
  check(s.origin_explanation === '', `origin_explanation blank (got ${JSON.stringify(s.origin_explanation)})`);
  check(s.classId === '', `classId blank (got ${JSON.stringify(s.classId)})`);
  check(s.subclassName === '', `subclassName blank (got ${JSON.stringify(s.subclassName)})`);
  check(s.fightingStyle === '', `fightingStyle blank (got ${JSON.stringify(s.fightingStyle)})`);
  check(JSON.stringify(s.subclassChoices) === '{}', `subclassChoices blank (got ${JSON.stringify(s.subclassChoices)})`);

  // Defaults: no args at all, and an undefined resume id, are both a
  // fresh create — never a resume.
  const bare = resolveOpeningDraft();
  check(JSON.stringify(bare.state) === JSON.stringify(blank) && bare.characterId === null,
    'resolveOpeningDraft() with no args opens blank');
  const undef = resolveOpeningDraft({ resumeCharacterId: undefined, draft: loaded });
  check(JSON.stringify(undef.state) === JSON.stringify(blank) && undef.characterId === null,
    'resumeCharacterId undefined + stored draft still opens blank');
  const noDraft = resolveOpeningDraft({ resumeCharacterId: null, draft: null });
  check(JSON.stringify(noDraft.state) === JSON.stringify(blank) && noDraft.characterId === null,
    'fresh create with no stored draft opens blank');

  // The blank-save guard still means exactly what it meant: a blank
  // state builds an empty body, so a resume with nothing picked skips
  // the save instead of PUTting an empty body (a 400).
  check(JSON.stringify(buildStage1ProgressBody(blank)) === '{}',
    'blank state still builds an empty progress body (blank-save guard intact)');
}

// ===========================================================================
// (b) Resume is unchanged — the regression guard
// ===========================================================================
group('(b) resume of an existing draft still restores it');
{
  const blank = blankStage1State();
  const resume = resolveOpeningDraft({ resumeCharacterId: priorId, draft: loaded });
  check(JSON.stringify(resume.state) === JSON.stringify({ ...blank, ...priorState }),
    'matching resume restores the full prior draft over blank');
  check(resume.characterId === priorId, `matching resume keeps the characterId (got ${resume.characterId})`);
  check(resume.hadMirror === true, 'matching resume reports hadMirror');
  check(resume.state.race === 'elf' && resume.state.subrace === 'Wood Elf', 'resumed race/subrace are the prior ones');
  check(resume.state.classId === 'scholar' && resume.state.subclassName === 'Ritualist', 'resumed class/subclass are the prior ones');
  check(resume.state.first_name === 'Prior' && resume.state.origin_region === 'Sword Coast', 'resumed name/origin are the prior ones');

  // A resume whose id does not match the stored draft opens blank ON
  // THAT ROW — never another character's draft.
  const otherId = priorId + 100;
  const mismatch = resolveOpeningDraft({ resumeCharacterId: otherId, draft: loaded });
  check(JSON.stringify(mismatch.state) === JSON.stringify(blank),
    'mismatched resume opens blank (no other character\'s draft leaks in)');
  check(mismatch.characterId === otherId, `mismatched resume keeps the requested row id (got ${mismatch.characterId})`);
  check(mismatch.hadMirror === false, 'mismatched resume reports no mirror');

  // No stored draft at all: resume opens blank on the row.
  store.clear();
  check(loadStage1LocalDraft() === null, 'cleared storage loads no draft');
  const noMirror = resolveOpeningDraft({ resumeCharacterId: priorId, draft: loadStage1LocalDraft() });
  check(JSON.stringify(noMirror.state) === JSON.stringify(blank) && noMirror.characterId === priorId && noMirror.hadMirror === false,
    'resume with no stored draft opens blank on the same row');

  // A draft saved before any server save (characterId null) never
  // matches a resume id — null is not a character.
  saveStage1LocalDraft(priorState, null);
  const nullIdDraft = loadStage1LocalDraft();
  check(nullIdDraft?.characterId === null, 'pre-save draft stores a null characterId');
  const nullIdResume = resolveOpeningDraft({ resumeCharacterId: priorId, draft: nullIdDraft });
  check(JSON.stringify(nullIdResume.state) === JSON.stringify(blank),
    'null-characterId draft does not resume onto a row');

  // The stale draft is replaced, not merged, at the new character's
  // first save — the single key holds one draft, the newest one.
  const newState = { ...blankStage1State(), first_name: 'Fresh', race: 'human', classId: 'fighter' };
  saveStage1LocalDraft(newState, priorId + 1);
  const replaced = loadStage1LocalDraft();
  check(replaced?.characterId === priorId + 1 && replaced?.state.first_name === 'Fresh',
    'a new save overwrites the stale draft with the new character');
  check(replaced?.state.race === 'human' && replaced?.state.subrace === '' && replaced?.state.classId === 'fighter',
    'the overwritten draft carries none of the prior character\'s picks');
}

// ===========================================================================
// (c) Server — a fresh create cannot overwrite the prior row
// ===========================================================================
group('(c) fresh-create first save POSTs a new row; resume PUTs the old one');
{
  const freshPost = await postCharacter({
    name: 'FC Fresh', first_name: 'Fresh', race: 'human', creator: MARKER,
    class: 'fighter', creation_phase: 'creating',
  });
  check(freshPost.status === 201, `fresh-create POST accepted with 201 (got ${freshPost.status})`);
  check(freshPost.json?.id !== priorId, `fresh-create POST made a new row (got id ${freshPost.json?.id}, prior was ${priorId})`);

  const priorAfter = await characterRow(priorId);
  check(priorAfter?.name === 'FC Prior', `prior row name untouched (got ${priorAfter?.name})`);
  check(priorAfter?.race === 'elf' && priorAfter?.subrace === 'Wood Elf', `prior row race/subrace untouched (got ${priorAfter?.race}/${priorAfter?.subrace})`);
  check(priorAfter?.class === 'fighter' && (priorAfter?.subclass === null || priorAfter?.subclass === undefined), `prior row class/subclass untouched (got ${priorAfter?.class}/${priorAfter?.subclass})`);
  check(priorAfter?.origin_setting === 'Forgotten Realms' && priorAfter?.origin_region === 'Sword Coast',
    `prior row origin untouched (got ${priorAfter?.origin_setting}/${priorAfter?.origin_region})`);
  const priorNameCount = await db.dbGet('SELECT COUNT(*) AS n FROM characters WHERE name = ?', ['FC Prior']);
  check(priorNameCount?.n === 1, `exactly one 'FC Prior' row exists (got ${priorNameCount?.n})`);

  const freshRow = await characterRow(freshPost.json.id);
  check(freshRow?.name === 'FC Fresh' && freshRow?.race === 'human' && freshRow?.class === 'fighter',
    `fresh row holds only its own picks (got ${freshRow?.name}/${freshRow?.race}/${freshRow?.class})`);

  // Resume PUT still updates only the prior row.
  const put = await putCharacter(priorId, { last_name: 'Changed', creator: MARKER });
  check(put.status === 200, `resume PUT accepted with 200 (got ${put.status})`);
  const priorPut = await characterRow(priorId);
  check(priorPut?.last_name === 'Changed', `resume PUT updated the prior row (got ${priorPut?.last_name})`);
  const freshPut = await characterRow(freshPost.json.id);
  check(freshPut?.last_name !== 'Changed', 'resume PUT left the fresh row alone');
}

// ===========================================================================
// (d) Client — the create-card path delegates to the resolver
// ===========================================================================
group('(d) client wiring — static guards');
{
  const shell = readRepo('client/src/components/creator-next/CreatorNextShell.jsx');
  check(shell.includes("resolveOpeningDraft } from './stage1Persistence.js'"),
    'shell imports resolveOpeningDraft from stage1Persistence');
  check(shell.includes('resolveOpeningDraft({ resumeCharacterId, draft: loadStage1LocalDraft() })'),
    'shell opening calls the resolver with the resume id + the stored draft');
  check(!shell.includes('draft?.state'),
    'shell holds no draft-state branch of its own (the old unconditional load is gone)');
  check(!shell.includes('function blankStage1State'),
    'shell no longer defines its own blank state (moved to the persistence module)');

  const persistenceSrc = readRepo('client/src/components/creator-next/stage1Persistence.js');
  check(persistenceSrc.includes('export function resolveOpeningDraft'),
    'resolveOpeningDraft is exported from the persistence module');
  check(persistenceSrc.includes('export function blankStage1State'),
    'blankStage1State is exported from the persistence module');
  check(persistenceSrc.includes('if (resumeCharacterId)'),
    'the resolver gates the draft on a resume id (fresh create never reads it)');

  const homeFlow = readRepo('client/src/components/creator/HomeFlow.jsx');
  check(homeFlow.includes('setResumeCharacterId(null)') && homeFlow.includes("setRoute('wizard.next')"),
    'HomeFlow fresh create clears the resume id and routes to the new creator');
  check(homeFlow.includes('setResumeCharacterId(character.id)'),
    'HomeFlow draft-card click still passes that row\'s id (resume path untouched)');
  const homeScreen = readRepo('client/src/components/creator/HomeScreenV2.jsx');
  check(homeScreen.includes('onClick={onNew}'),
    'Create New Character card still fires onNew');
}

// ---------------------------------------------------------------------------
server.close();
console.log(`\n fresh-create-blank: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
