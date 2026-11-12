// tests/creator-test-notes-5-ancestry-feat-resume.test.js — creator
// test-notes item 5 (Zach, 2026-11-09): after resuming draft #1203,
// Stage 1 still lists "Ancestry feat" under "Still needed before
// Review", with the picker empty — even though the feat was picked.
//
// REPRO (proved by this file, against the real routes + real DB):
// the resume path resolves the feat id ONLY by exact name-match — the
// progression snapshot carries the feat NAME + list, never the id
// (rehydrateFromServerCharacter matches tier1.feat_name through the
// ancestry-feats endpoint). The snapshot's name and the endpoint's
// name both come from the same ancestry_feats seed table, so the match
// itself is sound for a current-build draft — group (a) proves it.
// The symptom occurs exactly when the side-table row is ABSENT:
// group (b) proves a draft saved without the pick rehydrates with no
// ancestry entry at all, so there is nothing to match and the id
// stays unresolved — which is precisely what the Stage 1 validator
// lists (group (b) pins the exact 'Ancestry feat' line with the real
// validateStage1). A draft saved before the ancestry persist existed,
// or a pick made after the last save, leaves no row; no store holds
// the pick, so it cannot be recovered — that draft needs a re-pick.
// Group (d) rules out the other candidates: a later save that omits
// the id does NOT clear the persisted feat (there is no DELETE path),
// so a species/variant change after picking yields a STALE feat on
// resume, not the missing-feat line.
//
// FIX (server side, in this job): getCharacterProgression now carries
// feat_id (character_ancestry_feats.feat_id) on each ancestry entry —
// group (c) pins it — so the resume can resolve by id when stored,
// with the name-match as fallback. The client half (prefer
// tier1.feat_id in rehydrateFromServerCharacter) belongs to the
// client worker; this file pins the server contract it reads.
//
// Honest integration tests: the real character + progression routers
// over real HTTP against a real throwaway DB, the real
// getCharacterProgression snapshot, and the real client validateStage1
// for the displayed line. If any real module were deleted, the imports
// fail and the suite fails with them.
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

const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'creator-test-notes-5-test-'));
const tmpDir = repoRoot;
const origCwd = process.cwd();
process.chdir(tmpDir);
delete process.env.TURSO_DATABASE_URL;
delete process.env.TURSO_AUTH_TOKEN;
const fromRepo = (rel) => pathToFileURL(path.join(origCwd, rel)).href;

const db = await import(fromRepo('server/database.js'));
await db.initDatabase();
// The real modules under test.
const { validateStage1 } = await import(fromRepo('client/src/components/creator-next/stage1Validation.js'));

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

// --- Verified-good fixture (creator-next-stage4.test.js) -------------
const DWARF_BASE = { str: 12, dex: 10, con: 13, int: 8, wis: 15, cha: 14 };
const DWARF_FINAL = { str: 14, dex: 10, con: 16, int: 8, wis: 16, cha: 14 };
const DWARF_PREPARED = ['bless', 'cure wounds', 'guiding bolt', 'shield of faith'];
function dwarfClericBody(overrides = {}) {
  return {
    creator: MARKER, class: 'cleric', race: 'dwarf', subrace: 'Hill Dwarf',
    theme_id: 'soldier', generation_method: 'point_buy',
    base_scores: DWARF_BASE, ability_scores: DWARF_FINAL,
    skills: ['Athletics', 'Intimidation', 'Religion'],
    languages: ['Common', 'Dwarvish'],
    prepared_spells: DWARF_PREPARED,
    ...overrides,
  };
}

// The dwarf tier-1 ancestry feat with no subchoices (same id the
// server commit suite resolves).
const stoutRow = await db.dbGet(
  "SELECT id FROM ancestry_feats WHERE list_id = 'dwarf' AND tier = 1 AND feat_name = 'Stout-Hearted'"
);
check(stoutRow?.id != null, 'Stout-Hearted tier-1 dwarf feat resolves from the seed table');
const stoutId = stoutRow?.id;

// (a) The round-trip is sound for a current-build draft: a POST that
// carries the feat id persists it, the progression snapshot names it,
// and the endpoint's list contains the same name under the same id —
// the client's exact name-match resolves.
group('(a) Round-trip sound: name-match resolves a persisted pick');
{
  const created = await postCharacter({
    name: 'T5 With Feat', ...dwarfClericBody(),
    ancestry_feat_id: stoutId,
    base_scores: DWARF_BASE, ability_scores: J(DWARF_FINAL),
    skills: J(['Athletics', 'Intimidation', 'Religion']),
    languages: J(['Common', 'Dwarvish']),
    prepared_spells: J(DWARF_PREPARED),
  });
  check(created.status === 201, `draft POST with the feat id creates 201 (got ${created.status}: ${JSON.stringify(created.json?.error || '')})`);
  const charId = created.json?.id;
  check(typeof charId === 'number', `created row has an id (got ${JSON.stringify(created.json?.id)})`);
  const sideRow = await db.dbGet('SELECT feat_id FROM character_ancestry_feats WHERE character_id = ?', [charId]);
  check(Number(sideRow?.feat_id) === Number(stoutId),
    `the side table holds the feat id (got ${JSON.stringify(sideRow?.feat_id)})`);
  const prog = await getJson(`/api/character/${charId}/progression`);
  check(prog.status === 200, `progression snapshot answers 200 (got ${prog.status})`);
  const feats = prog.json?.ancestry_feats;
  check(Array.isArray(feats) && feats.length === 1,
    `snapshot carries one ancestry feat (got ${JSON.stringify(feats)})`);
  const tier1 = (Array.isArray(feats) ? feats.find((f) => f?.tier === 1) : null) || (Array.isArray(feats) ? feats[0] : null);
  check(tier1?.list_id === 'dwarf' && tier1?.feat_name === 'Stout-Hearted',
    `snapshot names the feat (list_id ${tier1?.list_id}, feat_name ${tier1?.feat_name})`);
  const list = await getJson(`/api/progression/ancestry-feats/${encodeURIComponent(tier1.list_id)}?tier=${tier1.tier || 1}`);
  check(list.status === 200, `ancestry-feats endpoint answers 200 (got ${list.status})`);
  // The client's exact match, applied to the real responses.
  const match = (Array.isArray(list.json) ? list.json : []).find((f) => f?.feat_name === tier1.feat_name);
  check(match?.id != null && Number(match.id) === Number(stoutId),
    `the name-match resolves to the posted id (got ${JSON.stringify(match?.id)})`);
  // And with the id resolved, Stage 1 no longer lists the feat.
  const v = validateStage1({ race: 'dwarf', subrace: 'Hill Dwarf', ancestry_feat_id: match.id }, { featListAvailable: true });
  check(!v.needed.includes('Ancestry feat'),
    `a resolved id clears the 'Ancestry feat' line (needed: ${v.needed.join(', ')})`);
}

// (b) THE REPRO: a draft saved without the pick has no side-table row,
// so the snapshot carries no ancestry entry — there is nothing for the
// name-match to match, the id stays unresolved, and Stage 1 lists
// 'Ancestry feat' with an empty picker. This is exactly Zach's symptom.
group('(b) Repro: no persisted pick, no ancestry entry, line shows');
{
  const created = await postCharacter({
    name: 'T5 Without Feat', ...dwarfClericBody(),
    base_scores: DWARF_BASE, ability_scores: J(DWARF_FINAL),
    skills: J(['Athletics', 'Intimidation', 'Religion']),
    languages: J(['Common', 'Dwarvish']),
    prepared_spells: J(DWARF_PREPARED),
  });
  check(created.status === 201, `draft POST without the feat id creates 201 (got ${created.status}: ${JSON.stringify(created.json?.error || '')})`);
  const charId = created.json?.id;
  const prog = await getJson(`/api/character/${charId}/progression`);
  check(prog.status === 200, `progression snapshot answers 200 (got ${prog.status})`);
  check(Array.isArray(prog.json?.ancestry_feats) && prog.json.ancestry_feats.length === 0,
    `snapshot carries NO ancestry feat (got ${JSON.stringify(prog.json?.ancestry_feats)})`);
  // The client's lookup, applied to this snapshot: no tier1, no fetch, no id.
  const ancestryRows = Array.isArray(prog.json?.ancestry_feats) ? prog.json.ancestry_feats : [];
  const tier1 = ancestryRows.find((f) => f?.tier === 1) || ancestryRows[0];
  check(tier1 == null, 'the resume lookup finds no tier-1 entry to resolve');
  // The exact line Zach saw, from the real Stage 1 validator.
  const v = validateStage1({ race: 'dwarf', subrace: 'Hill Dwarf', ancestry_feat_id: null }, { featListAvailable: true });
  check(v.needed.includes('Ancestry feat'),
    `Stage 1 lists 'Ancestry feat' when the id is unresolved (needed: ${v.needed.join(', ')})`);
  // Control: a list that never loads hides the line instead — so a
  // failed fetch alone cannot produce Zach's symptom.
  const vHidden = validateStage1({ race: 'dwarf', subrace: 'Hill Dwarf', ancestry_feat_id: null }, { featListAvailable: false });
  check(!vHidden.needed.includes('Ancestry feat'),
    'a failed feats fetch hides the line (it cannot be the trigger)');
}

// (c) The fix: the snapshot now carries the stored feat id, so the
// resume can resolve by id when stored instead of depending on the
// name-match.
group('(c) Snapshot carries feat_id (resolve by id)');
{
  const row = await db.dbGet("SELECT character_id FROM character_ancestry_feats WHERE feat_id = ? ORDER BY character_id DESC LIMIT 1", [stoutId]);
  check(row?.character_id != null, 'a character with the persisted feat exists for the snapshot check');
  const prog = await getJson(`/api/character/${row.character_id}/progression`);
  const tier1 = (Array.isArray(prog.json?.ancestry_feats) ? prog.json.ancestry_feats.find((f) => f?.tier === 1) : null)
    || (Array.isArray(prog.json?.ancestry_feats) ? prog.json.ancestry_feats[0] : null);
  check(tier1?.feat_id != null && Number(tier1.feat_id) === Number(stoutId),
    `snapshot ancestry entry carries feat_id ${tier1?.feat_id} (expected ${stoutId})`);
}

// (d) Rules out the variant-change candidate: a later save that omits
// the id does NOT clear the persisted feat — there is no DELETE path —
// so changing species/variant after picking yields a STALE feat on
// resume, not the missing-feat line.
group('(d) A save omitting the id leaves the persisted feat standing');
{
  const row = await db.dbGet("SELECT character_id FROM character_ancestry_feats WHERE feat_id = ? ORDER BY character_id DESC LIMIT 1", [stoutId]);
  const charId = row.character_id;
  const putGood = await putCharacter(charId, {
    creator: MARKER, skills: J(['Athletics', 'Intimidation', 'Religion', 'Insight']),
  });
  check(putGood.status === 200, `PUT omitting the feat id persists 200 (got ${putGood.status}: ${JSON.stringify(putGood.json?.error || '')})`);
  const prog = await getJson(`/api/character/${charId}/progression`);
  const tier1 = (Array.isArray(prog.json?.ancestry_feats) ? prog.json.ancestry_feats.find((f) => f?.tier === 1) : null)
    || (Array.isArray(prog.json?.ancestry_feats) ? prog.json.ancestry_feats[0] : null);
  check(tier1?.feat_name === 'Stout-Hearted' && Number(tier1?.feat_id) === Number(stoutId),
    `the persisted feat still stands after the omitting PUT (got ${tier1?.feat_name} / ${tier1?.feat_id})`);
}

// (e) Creation-solidification item 2 (2026-11-12): the RE-PICK path
// for a draft like #1203 — saved with no ancestry-feat row. The player
// picks again on Stage 1; the next draft save (PUT) must persist the
// side-table row, the snapshot must carry the id, and the REAL client
// resume (rehydrateFromServerCharacter) must restore the pick so the
// 'Ancestry feat' line clears. No pick is invented: the test draft
// starts empty and only the explicit re-pick fills it.
group('(e) Re-pick on a draft with no persisted row persists across resume');
{
  const created = await postCharacter({
    name: 'T5 Re-pick', ...dwarfClericBody(),
    base_scores: DWARF_BASE, ability_scores: J(DWARF_FINAL),
    skills: J(['Athletics', 'Intimidation', 'Religion']),
    languages: J(['Common', 'Dwarvish']),
    prepared_spells: J(DWARF_PREPARED),
  });
  check(created.status === 201, `#1203-shaped draft (no feat) creates 201 (got ${created.status})`);
  const charId = created.json?.id;
  const before = await db.dbGet('SELECT COUNT(*) AS n FROM character_ancestry_feats WHERE character_id = ?', [charId]);
  check(Number(before?.n) === 0, `the draft starts with no ancestry-feat row (got ${before?.n})`);

  // The re-pick: a Stage 1 save carrying the chosen id.
  const repick = await putCharacter(charId, { creator: MARKER, race: 'dwarf', subrace: 'Hill Dwarf', ancestry_feat_id: stoutId });
  check(repick.status === 200, `re-pick PUT persists 200 (got ${repick.status}: ${JSON.stringify(repick.json?.error || '')})`);
  const sideRow = await db.dbGet('SELECT feat_id, tier FROM character_ancestry_feats WHERE character_id = ?', [charId]);
  check(Number(sideRow?.feat_id) === Number(stoutId) && Number(sideRow?.tier) === 1,
    `the side-table row is present after the re-pick save (got ${JSON.stringify(sideRow)})`);

  // The real client resume, with its relative fetches pointed at this server.
  const realFetch = globalThis.fetch;
  globalThis.fetch = (url, opts) => realFetch(typeof url === 'string' && url.startsWith('/') ? `${base}${url}` : url, opts);
  let resumed = null;
  try {
    const { rehydrateFromServerCharacter } = await import(fromRepo('client/src/components/creator-next/stage1Persistence.js'));
    resumed = await rehydrateFromServerCharacter(charId);
  } finally {
    globalThis.fetch = realFetch;
  }
  check(resumed?.restored === true, `the client resume restores the draft (got ${JSON.stringify(resumed?.restored)})`);
  check(Number(resumed?.patch?.ancestry_feat_id) === Number(stoutId),
    `the resumed draft carries the re-picked feat id (got ${JSON.stringify(resumed?.patch?.ancestry_feat_id)})`);
  const v = validateStage1({ race: 'dwarf', subrace: 'Hill Dwarf', ancestry_feat_id: resumed?.patch?.ancestry_feat_id ?? null }, { featListAvailable: true });
  check(!v.needed.includes('Ancestry feat'),
    `after resume, Stage 1 no longer lists 'Ancestry feat' (needed: ${v.needed.join(', ')})`);
}

server.close();
console.log(`=== Results: ${passed} passed, ${failed} failed ===`);
process.exit(failed ? 1 : 0);
