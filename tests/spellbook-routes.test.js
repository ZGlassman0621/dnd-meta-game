// tests/spellbook-routes.test.js — wizard spellbook system, HTTP routes
// (2026-11-07): PUT membership + lost-book + book-content guard,
// level-up +2 adds / Savant frees / swap routing, copy-spell gold +
// clock, loss via discard + status route, Memorize Spell via
// bank + DM short rest (the sheet rest route is gone),
// always-prepared picks, and the commit refusal for a bookless draft.
//
// Honest integration tests: every case drives the real character
// router over HTTP on a real throwaway DB (the
// wizard-validator-wiring harness). Fixture books are seeded with a
// direct DB UPDATE, like seedStoredPrepared in that suite — a row
// written before this build existed, or a book the creator wrote.
// If spellbookService.js or character.js were deleted, the router
// import fails and the suite fails with it.
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

const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'spellbook-routes-test-'));
const tmpDir = repoRoot;
const origCwd = process.cwd();
process.chdir(tmpDir);
delete process.env.TURSO_DATABASE_URL;
delete process.env.TURSO_AUTH_TOKEN;
const fromRepo = (rel) => pathToFileURL(path.join(origCwd, rel)).href;

const db = await import(fromRepo('server/database.js'));
await db.initDatabase();
const { preparedSpellsMax } = await import(fromRepo('server/services/wizardService.js'));
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
  // Connection: close — undici reuses a pooled keep-alive socket even
  // after the server closed it during a long in-process applyRest, and
  // the next fetch then dies with ECONNRESET (2026-11-08: crashed the
  // suite deterministically at the group (o) alias creation). A fresh
  // connection per request avoids the race; this is harness transport,
  // not product behaviour.
  const res = await fetch(`${base}${url}`, {
    method,
    headers: { 'Content-Type': 'application/json', Connection: 'close' },
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
function readBook(id) {
  return readCharacter(id).then((r) => JSON.parse(r.known_spells || '[]'));
}
function readSpellbookState(id) {
  // Mirrors parseSpellbookState's default: a '{}' column is the blank
  // intact state, not a missing status.
  return readCharacter(id).then((r) => {
    let s = {};
    try { s = JSON.parse(r.spellbook_json || '{}'); } catch { s = {}; }
    return { status: s.status === 'lost' ? 'lost' : 'intact', mastery: s.mastery || [], signature: s.signature || [] };
  });
}
function readSpellbookJson(id) {
  // The full spellbook_json object (backup / replaced included),
  // for the replacement groups.
  return readCharacter(id).then((r) => {
    let s = {};
    try { s = JSON.parse(r.spellbook_json || '{}'); } catch { s = {}; }
    return s;
  });
}
function readInventory(id) {
  return readCharacter(id).then((r) => JSON.parse(r.inventory || '[]'));
}
function errOf(r) { return typeof r.json?.error === 'string' ? r.json.error : JSON.stringify(r.json); }

const INT3_SCORES = { str: 10, dex: 10, con: 14, int: 16, wis: 10, cha: 10 };
const INT4_SCORES = { str: 10, dex: 10, con: 14, int: 18, wis: 10, cha: 10 };
const BOOK6 = ['Magic Missile', 'Shield', 'Mage Armor', 'Sleep', 'Burning Hands', 'Thunderwave'];
const BOOK8 = [...BOOK6, 'Detect Magic', 'Feather Fall'];
const BOOK9 = [...BOOK8, 'Misty Step'];
const BOOK10 = [...BOOK9, 'Fireball'];
// Replacement fixtures (groups (l)–(n)): a 12-spell book, 9 prepared
// at levels 1,1,1,1,2,2,2,3,3 (sum 16 -> 160 gp transcription +
// 50 gp for the blank book = 210 gp + 16h at the 1h+10gp replace
// rate, V5). Three spells stay unprepared.
const REPLACE_BOOK12 = ['Magic Missile', 'Shield', 'Mage Armor', 'Sleep', 'Misty Step', 'Scorching Ray', 'Darkness', 'Fireball', 'Counterspell', 'Burning Hands', 'Thunderwave', 'Detect Magic'];
const REPLACE_PREPARED9 = ['Magic Missile', 'Shield', 'Mage Armor', 'Sleep', 'Misty Step', 'Scorching Ray', 'Darkness', 'Fireball', 'Counterspell'];
const COUNTED_4 = ['Magic Missile', 'Shield', 'Mage Armor', 'Sleep'];
const COUNTED_8 = [...BOOK8];

async function seedBook(id, list) {
  await db.dbRun('UPDATE characters SET known_spells = ? WHERE id = ?', [J(list), id]);
  assert.deepStrictEqual(await readBook(id), list, 'seeded spellbook reads back');
}
async function seedStoredPrepared(id, list) {
  await db.dbRun('UPDATE characters SET prepared_spells = ? WHERE id = ?', [J(list), id]);
  assert.deepStrictEqual(await readPrepared(id), list, 'seeded stored prepared list reads back');
}
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
  assert(put.status === 200, `fixture PUT sets ${name} to level ${level} — got ${put.status}: ${errOf(put)}`);
  // A wizard fixture needs a book, or the PUT/level-up membership
  // checks refuse every prepared list. Seed it directly (bypasses
  // the route, like seedStoredPrepared) — level-appropriate, covering
  // every list this suite uses, so the suite keeps testing the new
  // behaviour, not the book.
  if (cls === 'wizard') {
    const book = level >= 5 ? BOOK10 : level >= 4 ? BOOK9 : level >= 2 ? BOOK8 : BOOK6;
    await seedBook(id, book);
  }
  return id;
}
async function levelUp(id, body = {}) {
  return req('POST', `/api/character/level-up/${id}`, body);
}
async function giveXp(id, level) {
  await db.dbRun('UPDATE characters SET experience = ? WHERE id = ?', [getXPToNextLevel(level), id]);
}

// ===========================================================================
// (a) PUT membership: prepared ⊆ book, book-content guard
// ===========================================================================
group('(a) PUT membership + book-content guard (wizard L5, Int +3)');
{
  const wiz5 = await makeCharacter({ name: 'WizPut', cls: 'wizard', level: 5, intScores: INT3_SCORES });
  await seedStoredPrepared(wiz5, COUNTED_8);
  // One spell outside the book, at cap: the count passes, membership refuses.
  const outside = await req('PUT', `/api/character/${wiz5}`, {
    prepared_spells: J([...COUNTED_8.slice(0, 7), 'Cure Wounds']),
  });
  check(outside.status === 400, `PUT with a prepared spell outside the book refuses 400 (got ${outside.status})`);
  check(errOf(outside).includes('preparedSpells') && errOf(outside).includes('not in the spellbook'),
    `membership refusal names preparedSpells and the book (got ${errOf(outside)})`);
  check(JSON.stringify(await readPrepared(wiz5)) === JSON.stringify(COUNTED_8), 'refused PUT left the stored prepared list unchanged');
  const inside = await req('PUT', `/api/character/${wiz5}`, { prepared_spells: J(COUNTED_8) });
  check(inside.status === 200, `PUT with a prepared list inside the book persists 200 (got ${inside.status}: ${errOf(inside)})`);
  // A bare PUT writing the book: a non-wizard spell refuses, a
  // cantrip refuses, a dupe refuses, a valid rewrite persists.
  const badBook = await makeCharacter({ name: 'WizBadBook', cls: 'wizard', level: 5, intScores: INT3_SCORES });
  const cureBook = await req('PUT', `/api/character/${badBook}`, { known_spells: J([...BOOK10, 'Cure Wounds']) });
  check(cureBook.status === 400 && errOf(cureBook).includes('knownSpells'),
    `PUT book with a non-wizard spell refuses (got ${cureBook.status}: ${errOf(cureBook)})`);
  const cantripBook = await req('PUT', `/api/character/${badBook}`, { known_spells: J([...BOOK10, 'Fire Bolt']) });
  check(cantripBook.status === 400 && errOf(cantripBook).includes('cantrip'),
    `PUT book with a cantrip refuses (got ${cantripBook.status}: ${errOf(cantripBook)})`);
  const dupeBook = await req('PUT', `/api/character/${badBook}`, { known_spells: J([...BOOK10, 'Shield']) });
  check(dupeBook.status === 400 && errOf(dupeBook).includes('twice'),
    `PUT book with a duplicate refuses (got ${dupeBook.status}: ${errOf(dupeBook)})`);
  const overLevelBook = await req('PUT', `/api/character/${badBook}`, { known_spells: J(['Wish']) });
  check(overLevelBook.status === 400 && errOf(overLevelBook).includes('knownSpells'),
    `PUT book with an uncastable-level spell refuses (got ${overLevelBook.status})`);
  const goodBook = await req('PUT', `/api/character/${badBook}`, { known_spells: J(BOOK10) });
  check(goodBook.status === 200 && JSON.stringify(await readBook(badBook)) === JSON.stringify(BOOK10),
    `PUT book with a valid rewrite persists 200 (got ${goodBook.status}: ${errOf(goodBook)})`);
  // A L1 wizard cannot hold a L3 spell in the book via PUT.
  const wiz1 = await makeCharacter({ name: 'WizOneBook', cls: 'wizard', level: 1, intScores: INT3_SCORES });
  const l1Fireball = await req('PUT', `/api/character/${wiz1}`, { known_spells: J([...BOOK6, 'Fireball']) });
  check(l1Fireball.status === 400, `PUT book with Fireball at L1 refuses 400 (got ${l1Fireball.status})`);

  // Sibling fix (replacement build): a bare PUT rewriting the book
  // while it is lost refuses — the prepared refusal never covered
  // it, so the book was rewritable while prepared changes were
  // refused.
  const lostBook = await makeCharacter({ name: 'WizLostBook', cls: 'wizard', level: 5, intScores: INT3_SCORES });
  await req('POST', `/api/character/${lostBook}/spellbook-status`, { status: 'lost' });
  const lostRewrite = await req('PUT', `/api/character/${lostBook}`, { known_spells: J(['Magic Missile']) });
  check(lostRewrite.status === 400 && errOf(lostRewrite).includes('knownSpells') && errOf(lostRewrite).includes('lost'),
    `a bare PUT rewriting the book while lost refuses (got ${lostRewrite.status}: ${errOf(lostRewrite)})`);
  check(JSON.stringify(await readBook(lostBook)) === JSON.stringify(BOOK10), 'the refused book rewrite left the book unchanged');
  const lostBoth = await req('PUT', `/api/character/${lostBook}`, { known_spells: J(['Magic Missile']), prepared_spells: J(COUNTED_4) });
  check(lostBoth.status === 400 && errOf(lostBoth).includes('lost'),
    `a PUT with both lists while lost refuses as lost (got ${lostBoth.status}: ${errOf(lostBoth)})`);
}

// ===========================================================================
// (b) Lost book refuses prepared changes; existing list stays castable
// ===========================================================================
group('(b) lost book (status route)');
{
  const wiz5 = await makeCharacter({ name: 'WizLost', cls: 'wizard', level: 5, intScores: INT3_SCORES });
  await seedStoredPrepared(wiz5, COUNTED_8);
  const lost = await req('POST', `/api/character/${wiz5}/spellbook-status`, { status: 'lost' });
  check(lost.status === 200 && lost.json?.spellbook?.status === 'lost', `status route sets lost 200 (got ${lost.status}: ${errOf(lost)})`);
  check((await readSpellbookState(wiz5)).status === 'lost', 'lost status reads back from spellbook_json');
  const change = await req('PUT', `/api/character/${wiz5}`, { prepared_spells: J(COUNTED_4) });
  check(change.status === 400 && errOf(change).includes('lost'),
    `PUT prepared while the book is lost refuses (got ${change.status}: ${errOf(change)})`);
  check(JSON.stringify(await readPrepared(wiz5)) === JSON.stringify(COUNTED_8),
    'the refused change left the existing prepared list castable and unchanged');
  const plain = await req('PUT', `/api/character/${wiz5}`, { name: 'WizLost Renamed' });
  check(plain.status === 200, 'a plain PUT with no prepared list is unaffected by a lost book');
  const badStatus = await req('POST', `/api/character/${wiz5}/spellbook-status`, { status: 'stolen' });
  check(badStatus.status === 400, `an unknown status value refuses 400 (got ${badStatus.status})`);
  const back = await req('POST', `/api/character/${wiz5}/spellbook-status`, { status: 'intact' });
  check(back.status === 200 && (await readSpellbookState(wiz5)).status === 'intact', 'status route restores intact (DM override, not the rules replacement flow)');
  const changeBack = await req('PUT', `/api/character/${wiz5}`, { prepared_spells: J(COUNTED_4) });
  check(changeBack.status === 200, 'prepared changes work again once the book is intact');
  const cleric = await makeCharacter({ name: 'ClericStatus', cls: 'cleric', level: 5, intScores: INT3_SCORES });
  const clericStatus = await req('POST', `/api/character/${cleric}/spellbook-status`, { status: 'lost' });
  check(clericStatus.status === 400 && errOf(clericStatus).includes('wizards only'),
    'the status route refuses a non-wizard');
}

// ===========================================================================
// (c) Level-up: +2 book adds per level after 1st
// ===========================================================================
group('(c) level-up +2 book adds');
{
  const wiz1 = await makeCharacter({ name: 'WizAdd', cls: 'wizard', level: 1, intScores: INT3_SCORES });
  await seedStoredPrepared(wiz1, COUNTED_4);
  await giveXp(wiz1, 1);
  const ok = await levelUp(wiz1, { newSpells: ['Detect Magic', 'Feather Fall'] });
  check(ok.status === 200, `level-up L1->2 with 2 adds succeeds 200 (got ${ok.status}: ${errOf(ok)})`);
  check((await readCharacter(wiz1)).level === 2, 'level-up raised the level to 2');
  check(JSON.stringify(await readBook(wiz1)) === JSON.stringify(BOOK8), 'the book grew 6 -> 8 with the two adds');
  check(JSON.stringify(await readPrepared(wiz1)) === JSON.stringify(COUNTED_4), 'level-up kept the stored prepared list');

  const three = await makeCharacter({ name: 'WizAdd3', cls: 'wizard', level: 1, intScores: INT3_SCORES });
  await seedStoredPrepared(three, COUNTED_4);
  await giveXp(three, 1);
  const over = await levelUp(three, { newSpells: ['Detect Magic', 'Feather Fall', 'Grease'] });
  check(over.status === 400 && errOf(over).includes('at most 2'),
    `level-up with 3 adds refuses (got ${over.status}: ${errOf(over)})`);
  check((await readCharacter(three)).level === 1, 'refused level-up left the level at 1');
  check(JSON.stringify(await readBook(three)) === JSON.stringify(BOOK6), 'refused level-up left the book unchanged');

  const nonWiz = await makeCharacter({ name: 'WizAddCure', cls: 'wizard', level: 1, intScores: INT3_SCORES });
  await seedStoredPrepared(nonWiz, COUNTED_4);
  await giveXp(nonWiz, 1);
  const cure = await levelUp(nonWiz, { newSpells: ['Cure Wounds'] });
  check(cure.status === 400 && errOf(cure).includes('Cure Wounds'), `level-up adding a non-wizard spell refuses (got ${cure.status})`);

  const cantrip = await makeCharacter({ name: 'WizAddCantrip', cls: 'wizard', level: 1, intScores: INT3_SCORES });
  await seedStoredPrepared(cantrip, COUNTED_4);
  await giveXp(cantrip, 1);
  const cant = await levelUp(cantrip, { newSpells: ['Fire Bolt'] });
  check(cant.status === 400 && errOf(cant).includes('cantrip'), `level-up adding a cantrip refuses (got ${cant.status})`);

  const dupe = await makeCharacter({ name: 'WizAddDupe', cls: 'wizard', level: 1, intScores: INT3_SCORES });
  await seedStoredPrepared(dupe, COUNTED_4);
  await giveXp(dupe, 1);
  const dup = await levelUp(dupe, { newSpells: ['Shield'] });
  check(dup.status === 400 && errOf(dup).includes('already in the spellbook'), `level-up adding a spell already in the book refuses (got ${dup.status})`);

  // A lost book does NOT block leveling up: losing the book refuses
  // prepared CHANGES, and leveling up does not change the list.
  const lost = await makeCharacter({ name: 'WizAddLost', cls: 'wizard', level: 1, intScores: INT3_SCORES });
  await seedStoredPrepared(lost, COUNTED_4);
  await req('POST', `/api/character/${lost}/spellbook-status`, { status: 'lost' });
  await giveXp(lost, 1);
  const lostOk = await levelUp(lost, { newSpells: ['Detect Magic', 'Feather Fall'] });
  check(lostOk.status === 200, `level-up with a lost book still succeeds — the prepared list is untouched (got ${lostOk.status}: ${errOf(lostOk)})`);
}

// ===========================================================================
// (d) Level-up: Savant free-adds at 3rd + new-slot levels
// ===========================================================================
group('(d) level-up Savant free-adds');
{
  const evoker = await makeCharacter({
    name: 'WizSavant', cls: 'wizard', level: 2, subclass: 'evoker', intScores: INT3_SCORES,
    classLevels: [{ class: 'wizard', level: 2, subclass: 'evoker' }],
  });
  await seedStoredPrepared(evoker, COUNTED_4);
  await giveXp(evoker, 2);
  const ok = await levelUp(evoker, {
    newSpells: ['Grease', 'Chromatic Orb'],
    savantSpells: ['Scorching Ray', 'Darkness'],
  });
  check(ok.status === 200, `L2->3 evoker with 2 adds + 2 Savant frees succeeds 200 (got ${ok.status}: ${errOf(ok)})`);
  check((await readCharacter(evoker)).level === 3, 'Savant level-up raised the level to 3');
  const book = await readBook(evoker);
  check(book.length === 12, `the book holds 12 after +2 adds and +2 Savant frees (got ${book.length}: ${book.join(', ')})`);
  check(['Scorching Ray', 'Darkness', 'Grease', 'Chromatic Orb'].every((s) => book.includes(s)),
    'the book contains both adds and both Savant frees');
  check(book.includes('Sleep'), 'the book kept the spells it already had');

  const wrong = await makeCharacter({
    name: 'WizSavantWrong', cls: 'wizard', level: 2, subclass: 'evoker', intScores: INT3_SCORES,
    classLevels: [{ class: 'wizard', level: 2, subclass: 'evoker' }],
  });
  await seedStoredPrepared(wrong, COUNTED_4);
  await giveXp(wrong, 2);
  const wrongSchool = await levelUp(wrong, { savantSpells: ['Misty Step', 'Scorching Ray'] });
  check(wrongSchool.status === 400 && errOf(wrongSchool).includes('Conjuration'),
    `a wrong-school Savant spell refuses (got ${wrongSchool.status}: ${errOf(wrongSchool)})`);

  const overLevel = await makeCharacter({
    name: 'WizSavantOver', cls: 'wizard', level: 2, subclass: 'evoker', intScores: INT3_SCORES,
    classLevels: [{ class: 'wizard', level: 2, subclass: 'evoker' }],
  });
  await seedStoredPrepared(overLevel, COUNTED_4);
  await giveXp(overLevel, 2);
  const tooHigh = await levelUp(overLevel, { savantSpells: ['Fireball'] });
  check(tooHigh.status === 400 && errOf(tooHigh).includes('level 2 or lower'),
    `a Savant spell above the L3 max refuses (got ${tooHigh.status}: ${errOf(tooHigh)})`);

  const nonPhb = await makeCharacter({
    name: 'WizSavantWar', cls: 'wizard', level: 2, subclass: 'war_magic', intScores: INT3_SCORES,
    classLevels: [{ class: 'wizard', level: 2, subclass: 'war_magic' }],
  });
  await seedStoredPrepared(nonPhb, COUNTED_4);
  await giveXp(nonPhb, 2);
  const noSavant = await levelUp(nonPhb, { savantSpells: ['Scorching Ray'] });
  check(noSavant.status === 400 && errOf(noSavant).includes('no Savant feature'),
    `a non-PHB-school subclass gets no Savant frees (got ${noSavant.status}: ${errOf(noSavant)})`);

  const notDue = await makeCharacter({
    name: 'WizSavantNotDue', cls: 'wizard', level: 3, subclass: 'evoker', intScores: INT3_SCORES,
    classLevels: [{ class: 'wizard', level: 3, subclass: 'evoker' }],
  });
  await seedStoredPrepared(notDue, COUNTED_4);
  await giveXp(notDue, 3);
  const l4 = await levelUp(notDue, { savantSpells: ['Scorching Ray'] });
  check(l4.status === 400 && errOf(l4).includes('no Savant spells are due'),
    `Savant frees sent at a level with none due refuse (got ${l4.status}: ${errOf(l4)})`);

  // Unclaimed frees are skipped, never refused: no savantSpells in
  // the body at a due level still levels up.
  const skipped = await makeCharacter({
    name: 'WizSavantSkip', cls: 'wizard', level: 2, subclass: 'evoker', intScores: INT3_SCORES,
    classLevels: [{ class: 'wizard', level: 2, subclass: 'evoker' }],
  });
  await seedStoredPrepared(skipped, COUNTED_4);
  await giveXp(skipped, 2);
  const skip = await levelUp(skipped, { newSpells: ['Grease', 'Chromatic Orb'] });
  check(skip.status === 200 && JSON.stringify(await readBook(skipped)) === JSON.stringify([...BOOK8, 'Grease', 'Chromatic Orb']),
    `level-up without savantSpells succeeds and adds only the +2 (got ${skip.status})`);
}

// ===========================================================================
// (e) Level-up swap routing: a wizard swap never tears a page out
// ===========================================================================
group('(e) level-up swap routing (wizard)');
{
  // Swap-only (no newSpells): the swap routes to prepared_spells
  // and the book is untouched.
  const wiz1 = await makeCharacter({ name: 'WizSwap', cls: 'wizard', level: 1, intScores: INT3_SCORES });
  await seedStoredPrepared(wiz1, COUNTED_4);
  await giveXp(wiz1, 1);
  const ok = await levelUp(wiz1, { swapSpell: { old: 'Sleep', new: 'Burning Hands' } });
  check(ok.status === 200, `swap-only level-up succeeds 200 (got ${ok.status}: ${errOf(ok)})`);
  check((await readBook(wiz1)).includes('Sleep'), 'the swapped-out spell STAYS in the book — no page torn out');
  const prep = await readPrepared(wiz1);
  check(prep.includes('Burning Hands') && !prep.includes('Sleep'),
    `the prepared list swapped Sleep -> Burning Hands (got ${prep.join(', ')})`);
  check(JSON.stringify(await readBook(wiz1)) === JSON.stringify(BOOK6), 'a swap-only level-up leaves the book exactly as it was');

  // Combined add+swap to a spell added in THIS level-up passes:
  // the check runs against the book as it stands after the adds.
  const justAdded = await makeCharacter({ name: 'WizSwapNew', cls: 'wizard', level: 1, intScores: INT3_SCORES });
  await seedStoredPrepared(justAdded, COUNTED_4);
  await giveXp(justAdded, 1);
  const added = await levelUp(justAdded, {
    newSpells: ['Detect Magic', 'Feather Fall'],
    swapSpell: { old: 'Sleep', new: 'Detect Magic' },
  });
  check(added.status === 200, `a combined add+swap to a just-added book spell succeeds (got ${added.status}: ${errOf(added)})`);
  check((await readPrepared(justAdded)).includes('Detect Magic'), 'the just-added spell is prepared after the swap');
  check((await readBook(justAdded)).includes('Sleep'), 'the combined path kept the swapped-out spell in the book too');
  check(JSON.stringify(await readBook(justAdded)) === JSON.stringify(BOOK8), 'the combined path grew the book 6 -> 8');

  const notBook = await makeCharacter({ name: 'WizSwapNoBook', cls: 'wizard', level: 1, intScores: INT3_SCORES });
  await seedStoredPrepared(notBook, COUNTED_4);
  await giveXp(notBook, 1);
  const refused = await levelUp(notBook, {
    newSpells: ['Detect Magic', 'Feather Fall'],
    swapSpell: { old: 'Sleep', new: 'Grease' },
  });
  check(refused.status === 400 && errOf(refused).includes('not in the spellbook'),
    `a swap to a spell outside the book refuses (got ${refused.status}: ${errOf(refused)})`);
  check((await readCharacter(notBook)).level === 1, 'the refused swap left the level at 1');
}

// ===========================================================================
// (f) Multiclass into wizard: seed exactly 6 (a 1st-level book,
// V4), empty seed allowed (V3 — an empty book, copied into later)
// ===========================================================================
group('(f) multiclass into wizard');
{
  const SEED6 = ['Magic Missile', 'Shield', 'Mage Armor', 'Sleep', 'Burning Hands', 'Thunderwave'];
  const cleric = await makeCharacter({ name: 'ClericMulti', cls: 'cleric', level: 3, intScores: INT3_SCORES });
  await seedStoredPrepared(cleric, ['Cure Wounds', 'Bless', 'Guiding Bolt', 'Healing Word', 'Shield of Faith']);
  await giveXp(cleric, 3);
  const multi = await levelUp(cleric, {
    selectedClass: 'Wizard',
    newSpells: SEED6,
  });
  check(multi.status === 200, `multiclass into wizard with 6 seed spells succeeds — a 1st-level wizard's book (got ${multi.status}: ${errOf(multi)})`);
  const multiRow = await readCharacter(cleric);
  check(multiRow.level === 4, 'multiclass level-up raised the total level to 4');
  const wizEntry = JSON.parse(multiRow.class_levels || '[]').find((c) => String(c.class).toLowerCase() === 'wizard');
  check(wizEntry?.level === 1, 'multiclass wizard entry stored at level 1');
  check(JSON.stringify(await readBook(cleric)) === JSON.stringify(SEED6),
    'the multiclass seed became the wizard book');
  check(JSON.stringify(await readPrepared(cleric)) === JSON.stringify(['Cure Wounds', 'Bless', 'Guiding Bolt', 'Healing Word', 'Shield of Faith']),
    'multiclass level-up kept the cleric prepared list');

  // The seed is exactly 6 (V4, 2026-11-08): 5 seeds refuse naming
  // the count, and the level is unchanged.
  const cleric5 = await makeCharacter({ name: 'ClericMulti5', cls: 'cleric', level: 3, intScores: INT3_SCORES });
  await giveXp(cleric5, 3);
  const five = await levelUp(cleric5, { selectedClass: 'Wizard', newSpells: SEED6.slice(0, 5) });
  check(five.status === 400 && errOf(five).includes('exactly 6') && errOf(five).includes('got 5'),
    `multiclass into wizard with 5 seed spells refuses — the seed is exactly 6 (got ${five.status}: ${errOf(five)})`);
  check((await readCharacter(cleric5)).level === 3, 'the refused 5-seed left the level at 3');

  // 7 seeds refuse with the 6 cap; the level is unchanged.
  const cleric7 = await makeCharacter({ name: 'ClericMulti7', cls: 'cleric', level: 3, intScores: INT3_SCORES });
  await giveXp(cleric7, 3);
  const seven = await levelUp(cleric7, { selectedClass: 'Wizard', newSpells: [...SEED6, 'Detect Magic'] });
  check(seven.status === 400 && errOf(seven).includes('at most 6'),
    `a 7-spell multiclass seed refuses with the 6 cap (got ${seven.status}: ${errOf(seven)})`);
  check((await readCharacter(cleric7)).level === 3, 'the refused 7-seed left the level at 3');

  // An empty/absent seed succeeds (V3, 2026-11-08) — the wizard
  // starts with an empty book: level 4, wizard 1, known_spells [],
  // status intact, no physical Spellbook row. The spells are copied
  // in later from found books.
  const clericEmpty = await makeCharacter({ name: 'ClericMultiEmpty', cls: 'cleric', level: 3, intScores: INT3_SCORES });
  await giveXp(clericEmpty, 3);
  const empty = await levelUp(clericEmpty, { selectedClass: 'Wizard', newSpells: [] });
  check(empty.status === 200, `a multiclass into wizard with an empty seed succeeds — an empty book (got ${empty.status}: ${errOf(empty)})`);
  const emptyRow = await readCharacter(clericEmpty);
  check(emptyRow.level === 4, 'the empty-seed level-up raised the total level to 4');
  check(JSON.parse(emptyRow.class_levels || '[]').find((c) => String(c.class).toLowerCase() === 'wizard')?.level === 1,
    'the empty-seed multiclass wizard entry stored at level 1');
  check(JSON.stringify(await readBook(clericEmpty)) === JSON.stringify([]), 'the empty seed leaves an empty book');
  check((await readSpellbookState(clericEmpty)).status === 'intact', 'the empty seed leaves the book intact');
  check(JSON.stringify(await readInventory(clericEmpty)) === JSON.stringify([]), 'the empty seed adds no Spellbook row');
  const clericAbsent = await makeCharacter({ name: 'ClericMultiAbsent', cls: 'cleric', level: 3, intScores: INT3_SCORES });
  await giveXp(clericAbsent, 3);
  const absent = await levelUp(clericAbsent, { selectedClass: 'Wizard' });
  check(absent.status === 200, `a multiclass into wizard with no seed at all succeeds too (got ${absent.status}: ${errOf(absent)})`);
  const absentRow = await readCharacter(clericAbsent);
  check(absentRow.level === 4, 'the absent-seed level-up raised the total level to 4');
  check(JSON.parse(absentRow.class_levels || '[]').find((c) => String(c.class).toLowerCase() === 'wizard')?.level === 1,
    'the absent-seed multiclass wizard entry stored at level 1');
  check(JSON.stringify(await readBook(clericAbsent)) === JSON.stringify([]), 'the absent seed leaves an empty book');
  check((await readSpellbookState(clericAbsent)).status === 'intact', 'the absent seed leaves the book intact');
  check(JSON.stringify(await readInventory(clericAbsent)) === JSON.stringify([]), 'the absent seed adds no Spellbook row');

  // An empty book fills from a scroll too (2026-11-08, job (b)):
  // the absent-seed wizard copies Magic Missile in from a
  // 'Spell Scroll of Magic Missile' — book [] -> 1 spell, status
  // stays intact, the scroll row is gone.
  await db.dbRun('UPDATE characters SET gold_gp = ?, inventory = ? WHERE id = ?',
    [500, J([{ name: 'Spell Scroll of Magic Missile', quantity: 1, source: 'dm-grant' }]), clericAbsent]);
  const scrollFill = await req('POST', `/api/character/${clericAbsent}/copy-spell`, {
    spellName: 'Magic Missile', source: 'scroll', scrollName: 'Spell Scroll of Magic Missile',
  });
  check(scrollFill.status === 200, `an empty-book wizard copies a spell in from a scroll (got ${scrollFill.status}: ${errOf(scrollFill)})`);
  check(JSON.stringify(await readBook(clericAbsent)) === JSON.stringify(['Magic Missile']), 'the empty book grew [] -> 1 spell from the scroll');
  check((await readSpellbookState(clericAbsent)).status === 'intact', 'the scroll copy leaves the empty book intact');
  check(Number((await readCharacter(clericAbsent)).gold_gp) === 450, 'the scroll copy charged 50 gp for the L1 spell (500 -> 450)');
  check(JSON.stringify(await readInventory(clericAbsent)) === JSON.stringify([]), 'the scroll row is gone after the copy');
  check(scrollFill.json?.copy?.scrollConsumed === true, 'the scroll copy reports the scroll consumed');

  const cleric2 = await makeCharacter({ name: 'ClericMulti2', cls: 'cleric', level: 3, intScores: INT3_SCORES });
  await giveXp(cleric2, 3);
  const badSeed = await levelUp(cleric2, { selectedClass: 'Wizard', newSpells: ['Cure Wounds'] });
  check(badSeed.status === 400 && errOf(badSeed).includes('Cure Wounds'),
    `a multiclass seed with a non-wizard spell refuses (got ${badSeed.status}: ${errOf(badSeed)})`);
}

// ===========================================================================
// (g) Copy a spell: gold + clock enforced server-side
// ===========================================================================
group('(g) copy-spell');
{
  async function copyWizard(name, gold = 500) {
    const id = await makeCharacter({ name, cls: 'wizard', level: 5, intScores: INT3_SCORES });
    await seedStoredPrepared(id, COUNTED_8);
    await db.dbRun('UPDATE characters SET gold_gp = ? WHERE id = ?', [gold, id]);
    return id;
  }
  async function clockHour() {
    const row = await db.dbGet('SELECT current_hour FROM world_clock WHERE id = 1');
    return Number(row?.current_hour);
  }
  // Success: L3 Counterspell costs 150 gp + 6h; gold deducted in
  // the same transaction as the book write; the clock advances.
  const wiz5 = await copyWizard('WizCopy');
  const hourBefore = await clockHour();
  const copied = await req('POST', `/api/character/${wiz5}/copy-spell`, {
    spellName: 'Counterspell', source: "Mordenkainen's lost spellbook",
  });
  check(copied.status === 200, `copying Counterspell succeeds 200 (got ${copied.status}: ${errOf(copied)})`);
  check(copied.json?.copy?.goldSpent === 150 && copied.json?.copy?.goldRemaining === 350,
    `copy reports 150 gp spent, 350 remaining (got ${JSON.stringify(copied.json?.copy)})`);
  check(copied.json?.copy?.hoursAdvanced === 6 && copied.json?.copy?.clockAdvanced === true,
    'copy reports 6h advanced and the clock advanced');
  check(!copied.json?.copy?.clockError, 'no clock error on the copy');
  const row5 = await readCharacter(wiz5);
  check(Number(row5.gold_gp) === 350, 'gold deducted in the DB (500 -> 350)');
  check((await readBook(wiz5)).includes('Counterspell') && (await readBook(wiz5)).length === 11,
    'the book grew 10 -> 11 with Counterspell');
  check((await clockHour()) === (hourBefore + 6) % 24,
    `the world clock advanced 6h (${hourBefore} -> ${(hourBefore + 6) % 24})`);

  // Refusals: each leaves gold and the book untouched.
  const cases = [
    { name: 'WizCopyCure', body: { spellName: 'Cure Wounds', source: 'A found spellbook' }, match: 'Cure Wounds', label: 'a non-wizard spell' },
    { name: 'WizCopyWish', body: { spellName: 'Wish', source: 'A found spellbook' }, match: 'Wish', label: 'an uncastable-level spell (L9 at wizard L5)' },
    { name: 'WizCopyDupe', body: { spellName: 'Fireball', source: 'A found spellbook' }, match: 'already in the spellbook', label: 'a spell already in the book' },
    { name: 'WizCopyCantrip', body: { spellName: 'Fire Bolt', source: 'A found spellbook' }, match: 'cantrip', label: 'a cantrip' },
    { name: 'WizCopyNoSource', body: { spellName: 'Counterspell' }, match: 'source is required', label: 'a missing source' },
    { name: 'WizCopyUnknown', body: { spellName: 'Not A Spell', source: 'A found spellbook' }, match: 'not in the spell catalog', label: 'an unknown spell' },
  ];
  for (const c of cases) {
    const id = await copyWizard(c.name);
    const r = await req('POST', `/api/character/${id}/copy-spell`, c.body);
    check(r.status === 400 && errOf(r).includes(c.match),
      `copying ${c.label} refuses 400 (got ${r.status}: ${errOf(r)})`);
    check(Number((await readCharacter(id)).gold_gp) === 500, `refused copy (${c.label}) left gold at 500`);
    check(JSON.stringify(await readBook(id)) === JSON.stringify(BOOK10), `refused copy (${c.label}) left the book unchanged`);
  }
  // Insufficient gold: Dispel Magic (L3, 150 gp) with 10 gp.
  const poor = await copyWizard('WizCopyPoor', 10);
  const poorCopy = await req('POST', `/api/character/${poor}/copy-spell`, { spellName: 'Dispel Magic', source: 'A found spellbook' });
  check(poorCopy.status === 400 && errOf(poorCopy).includes('gold_gp') && errOf(poorCopy).includes('150'),
    `copying with 10 gp against a 150 gp cost refuses naming gold_gp (got ${poorCopy.status}: ${errOf(poorCopy)})`);
  check(Number((await readCharacter(poor)).gold_gp) === 10, 'insufficient-gold refusal left gold at 10');
  // A lost book cannot be copied into.
  const lost = await copyWizard('WizCopyLost');
  await req('POST', `/api/character/${lost}/spellbook-status`, { status: 'lost' });
  const lostCopy = await req('POST', `/api/character/${lost}/copy-spell`, { spellName: 'Counterspell', source: 'A found spellbook' });
  check(lostCopy.status === 400 && errOf(lostCopy).includes('lost'),
    `copying into a lost book refuses (got ${lostCopy.status}: ${errOf(lostCopy)})`);
  // A non-wizard has no book to copy into.
  const cleric = await makeCharacter({ name: 'ClericCopy', cls: 'cleric', level: 5, intScores: INT3_SCORES });
  const clericCopy = await req('POST', `/api/character/${cleric}/copy-spell`, { spellName: 'Bless', source: 'A found spellbook' });
  check(clericCopy.status === 400 && errOf(clericCopy).includes('wizard levels'),
    `copying as a non-wizard refuses (got ${clericCopy.status}: ${errOf(clericCopy)})`);

  // Scroll copies (2026-11-08, job (b), D1/D4): the spell rides
  // the row name, canonical form `Spell Scroll of <Spell>`, and
  // the scroll is consumed in the same transaction as the book
  // write — same 50 gp + 2h per level as a found-book copy.
  async function giveScroll(id, name, quantity = 1) {
    await db.dbRun('UPDATE characters SET inventory = ? WHERE id = ?',
      [J([{ name, quantity, source: 'dm-grant' }]), id]);
    assert.deepStrictEqual((await readInventory(id)).map((r) => r.name), [name], 'scroll seeded in inventory');
  }
  const scrollWiz = await copyWizard('WizCopyScroll');
  await giveScroll(scrollWiz, 'Spell Scroll of Counterspell');
  const scrollHourBefore = await clockHour();
  const scrollCopied = await req('POST', `/api/character/${scrollWiz}/copy-spell`, {
    spellName: 'Counterspell', source: 'scroll', scrollName: 'Spell Scroll of Counterspell',
  });
  check(scrollCopied.status === 200, `copying Counterspell from a scroll succeeds 200 (got ${scrollCopied.status}: ${errOf(scrollCopied)})`);
  check(scrollCopied.json?.copy?.goldSpent === 150 && scrollCopied.json?.copy?.goldRemaining === 350,
    `scroll copy reports 150 gp spent, 350 remaining (got ${JSON.stringify(scrollCopied.json?.copy)})`);
  check(scrollCopied.json?.copy?.hoursAdvanced === 6 && scrollCopied.json?.copy?.clockAdvanced === true,
    'scroll copy reports 6h advanced and the clock advanced');
  check(scrollCopied.json?.copy?.scrollConsumed === true && scrollCopied.json?.copy?.scrollName === 'Spell Scroll of Counterspell',
    'scroll copy reports the scroll consumed and names the row');
  check(Number((await readCharacter(scrollWiz)).gold_gp) === 350, 'scroll copy deducted gold in the DB (500 -> 350)');
  check((await readBook(scrollWiz)).includes('Counterspell') && (await readBook(scrollWiz)).length === 11,
    'the book grew 10 -> 11 with Counterspell from the scroll');
  check(JSON.stringify(await readInventory(scrollWiz)) === JSON.stringify([]), 'the scroll row is gone after the copy');
  check((await clockHour()) === (scrollHourBefore + 6) % 24,
    `the world clock advanced 6h for the scroll copy (${scrollHourBefore} -> ${(scrollHourBefore + 6) % 24})`);
  // A quantity-2 scroll row decrements to 1, not to 0.
  const scrollQty2 = await copyWizard('WizCopyScrollQty2');
  await giveScroll(scrollQty2, 'Spell Scroll of Dispel Magic', 2);
  const qty2Copy = await req('POST', `/api/character/${scrollQty2}/copy-spell`, {
    spellName: 'Dispel Magic', source: 'scroll', scrollName: 'Spell Scroll of Dispel Magic',
  });
  check(qty2Copy.status === 200, `copying from a quantity-2 scroll succeeds (got ${qty2Copy.status}: ${errOf(qty2Copy)})`);
  check((await readBook(scrollQty2)).includes('Dispel Magic'), 'the quantity-2 scroll copy landed in the book');
  const qty2Inv = await readInventory(scrollQty2);
  check(qty2Inv.length === 1 && qty2Inv[0].name === 'Spell Scroll of Dispel Magic' && qty2Inv[0].quantity === 1,
    `the quantity-2 scroll row decremented to 1 (got ${JSON.stringify(qty2Inv)})`);
  // The scroll-name match is exact but case-insensitive (D4).
  const scrollCase = await copyWizard('WizCopyScrollCase');
  await giveScroll(scrollCase, 'Spell Scroll of Dispel Magic');
  const caseCopy = await req('POST', `/api/character/${scrollCase}/copy-spell`, {
    spellName: 'Dispel Magic', source: 'scroll', scrollName: 'SPELL SCROLL OF DISPEL MAGIC',
  });
  check(caseCopy.status === 200, `a differently-cased scrollName still matches the row (got ${caseCopy.status}: ${errOf(caseCopy)})`);
  check(JSON.stringify(await readInventory(scrollCase)) === JSON.stringify([]), 'the case-insensitive scroll copy consumed the row');
  // Scroll refusals: each leaves gold, the book, AND the scroll untouched.
  const scrollRefusals = [
    { name: 'WizCopyScrollDupe', scroll: 'Spell Scroll of Fireball', body: { spellName: 'Fireball', source: 'scroll', scrollName: 'Spell Scroll of Fireball' }, match: 'already in the spellbook', label: 'a spell already in the book' },
    { name: 'WizCopyScrollPoor', gold: 10, scroll: 'Spell Scroll of Dispel Magic', body: { spellName: 'Dispel Magic', source: 'scroll', scrollName: 'Spell Scroll of Dispel Magic' }, match: 'gold_gp', label: 'gold short' },
    { name: 'WizCopyScrollCure', scroll: 'Spell Scroll of Cure Wounds', body: { spellName: 'Cure Wounds', source: 'scroll', scrollName: 'Spell Scroll of Cure Wounds' }, match: 'Cure Wounds', label: 'a non-wizard spell' },
    { name: 'WizCopyScrollWish', scroll: 'Spell Scroll of Wish', body: { spellName: 'Wish', source: 'scroll', scrollName: 'Spell Scroll of Wish' }, match: 'Wish', label: 'an uncastable-level spell (L9 at wizard L5)' },
    { name: 'WizCopyScrollCantrip', scroll: 'Spell Scroll of Fire Bolt', body: { spellName: 'Fire Bolt', source: 'scroll', scrollName: 'Spell Scroll of Fire Bolt' }, match: 'cantrip', label: 'a cantrip' },
    { name: 'WizCopyScrollNoRow', scroll: null, body: { spellName: 'Counterspell', source: 'scroll', scrollName: 'Spell Scroll of Counterspell' }, match: 'not in the character', label: 'a missing scroll row' },
    { name: 'WizCopyScrollNoName', scroll: 'Spell Scroll of Counterspell', body: { spellName: 'Counterspell', source: 'scroll' }, match: 'scrollName is required', label: 'a missing scrollName' },
    { name: 'WizCopyScrollLevel', scroll: 'Spell Scroll (1st Level)', body: { spellName: 'Counterspell', source: 'scroll', scrollName: 'Spell Scroll (1st Level)' }, match: 'names no spell', label: 'a level-named scroll (no spell)' },
    { name: 'WizCopyScrollMismatch', scroll: 'Spell Scroll of Lightning Bolt', body: { spellName: 'Counterspell', source: 'scroll', scrollName: 'Spell Scroll of Lightning Bolt' }, match: 'holds Lightning Bolt, not Counterspell', label: 'a scroll holding a different spell' },
  ];
  for (const c of scrollRefusals) {
    const id = await copyWizard(c.name, c.gold ?? 500);
    if (c.scroll) await giveScroll(id, c.scroll);
    const r = await req('POST', `/api/character/${id}/copy-spell`, c.body);
    check(r.status === 400 && errOf(r).includes(c.match),
      `scroll copying ${c.label} refuses 400 (got ${r.status}: ${errOf(r)})`);
    check(Number((await readCharacter(id)).gold_gp) === (c.gold ?? 500), `refused scroll copy (${c.label}) left gold untouched`);
    check(JSON.stringify(await readBook(id)) === JSON.stringify(BOOK10), `refused scroll copy (${c.label}) left the book unchanged`);
    if (c.scroll) {
      check(JSON.stringify(await readInventory(id)) === JSON.stringify([{ name: c.scroll, quantity: 1, source: 'dm-grant' }]),
        `refused scroll copy (${c.label}) left the scroll untouched`);
    }
  }
  // Hedge Mage L3 "Nothing to Waste" (D3): the scroll survives a
  // successful copy. A Hedge Mage below 3rd (the feature's level)
  // destroys it like anyone else.
  const hedge = await makeCharacter({
    name: 'WizCopyHedge', cls: 'wizard', level: 5, subclass: 'hedge_mage', intScores: INT3_SCORES,
    classLevels: [{ class: 'wizard', level: 5, subclass: 'hedge_mage' }],
  });
  await seedStoredPrepared(hedge, COUNTED_8);
  await db.dbRun('UPDATE characters SET gold_gp = ? WHERE id = ?', [500, hedge]);
  await giveScroll(hedge, 'Spell Scroll of Counterspell');
  const hedgeCopy = await req('POST', `/api/character/${hedge}/copy-spell`, {
    spellName: 'Counterspell', source: 'scroll', scrollName: 'Spell Scroll of Counterspell',
  });
  check(hedgeCopy.status === 200, `a Hedge Mage copies from a scroll (got ${hedgeCopy.status}: ${errOf(hedgeCopy)})`);
  check(hedgeCopy.json?.copy?.scrollConsumed === false && hedgeCopy.json?.copy?.scrollKeptReason === 'hedge-mage',
    `the Hedge Mage copy reports the scroll kept (got ${JSON.stringify(hedgeCopy.json?.copy)})`);
  check((await readBook(hedge)).includes('Counterspell'), 'the Hedge Mage copy still landed in the book');
  check(Number((await readCharacter(hedge)).gold_gp) === 350, 'the Hedge Mage copy still charged 150 gp');
  check(JSON.stringify(await readInventory(hedge)) === JSON.stringify([{ name: 'Spell Scroll of Counterspell', quantity: 1, source: 'dm-grant' }]),
    'the Hedge Mage scroll row is still there after the copy');
  const hedgeYoung = await makeCharacter({
    name: 'WizCopyHedge2', cls: 'wizard', level: 2, subclass: 'hedge_mage', intScores: INT3_SCORES,
    classLevels: [{ class: 'wizard', level: 2, subclass: 'hedge_mage' }],
  });
  await seedStoredPrepared(hedgeYoung, COUNTED_4);
  await db.dbRun('UPDATE characters SET gold_gp = ? WHERE id = ?', [500, hedgeYoung]);
  await giveScroll(hedgeYoung, 'Spell Scroll of Grease');
  const youngCopy = await req('POST', `/api/character/${hedgeYoung}/copy-spell`, {
    spellName: 'Grease', source: 'scroll', scrollName: 'Spell Scroll of Grease',
  });
  check(youngCopy.status === 200, `a 2nd-level Hedge Mage copies from a scroll (got ${youngCopy.status}: ${errOf(youngCopy)})`);
  check(youngCopy.json?.copy?.scrollConsumed === true, 'the under-3rd Hedge Mage copy reports the scroll consumed');
  check(JSON.stringify(await readInventory(hedgeYoung)) === JSON.stringify([]), 'the under-3rd Hedge Mage scroll row is gone');
  // Multiclass Hedge Mage: the wizard ENTRY carries the subclass
  // (the row's subclass column is the primary class's — here
  // absent — so only the entry can name it). And the trap in the
  // other direction: a row whose subclass column holds
  // 'hedge_mage' while the primary is NOT a wizard must NOT keep
  // the scroll — the column is the primary class's subclass.
  async function multiHedge(name, wizardEntry, rowSubclass) {
    const id = await makeCharacter({ name, cls: 'cleric', level: 3, intScores: INT3_SCORES });
    await db.dbRun('UPDATE characters SET class_levels = ?, level = ?, subclass = ?, known_spells = ?, prepared_spells = ?, gold_gp = ?, inventory = ? WHERE id = ?',
      [J([{ class: 'cleric', level: 3 }, wizardEntry]), 6, rowSubclass, J(['Magic Missile', 'Shield', 'Mage Armor', 'Sleep', 'Burning Hands', 'Thunderwave']), J(['Cure Wounds']), 500, J([{ name: 'Spell Scroll of Misty Step', quantity: 1, source: 'dm-grant' }]), id]);
    return id;
  }
  const multiKeep = await multiHedge('WizCopyMultiHedge', { class: 'wizard', level: 3, subclass: 'hedge_mage' }, null);
  const multiKeepCopy = await req('POST', `/api/character/${multiKeep}/copy-spell`, {
    spellName: 'Misty Step', source: 'scroll', scrollName: 'Spell Scroll of Misty Step',
  });
  check(multiKeepCopy.status === 200, `a multiclass Hedge Mage copies from a scroll (got ${multiKeepCopy.status}: ${errOf(multiKeepCopy)})`);
  check(multiKeepCopy.json?.copy?.scrollConsumed === false, 'the multiclass Hedge Mage keeps the scroll (subclass read from the wizard entry)');
  check(JSON.stringify(await readInventory(multiKeep)) === JSON.stringify([{ name: 'Spell Scroll of Misty Step', quantity: 1, source: 'dm-grant' }]),
    'the multiclass Hedge Mage scroll row is still there');
  const multiTrap = await multiHedge('WizCopyMultiTrap', { class: 'wizard', level: 3 }, 'hedge_mage');
  const multiTrapCopy = await req('POST', `/api/character/${multiTrap}/copy-spell`, {
    spellName: 'Misty Step', source: 'scroll', scrollName: 'Spell Scroll of Misty Step',
  });
  check(multiTrapCopy.status === 200, `the row-subclass trap copy succeeds (got ${multiTrapCopy.status}: ${errOf(multiTrapCopy)})`);
  check(multiTrapCopy.json?.copy?.scrollConsumed === true, 'a hedge_mage in the ROW subclass column does not keep the scroll when the primary is not a wizard');
  check(JSON.stringify(await readInventory(multiTrap)) === JSON.stringify([]), 'the trap scroll row is gone');

  // Sibling fix (veto fixes, 2026-11-08): copying a spell into a
  // replaced book retires the `replaced` marker — the book now
  // holds spells beyond the replacement. A copy into a
  // never-replaced book reports nothing cleared.
  const repWiz = await copyWizard('WizCopyReplaced');
  await seedBook(repWiz, REPLACE_BOOK12);
  await seedStoredPrepared(repWiz, REPLACE_PREPARED9);
  await req('POST', `/api/character/${repWiz}/spellbook-status`, { status: 'lost' });
  const repDone = await req('POST', `/api/character/${repWiz}/spellbook-replace`, {});
  check(repDone.status === 200 && (await readSpellbookJson(repWiz)).replaced === 'prepared',
    `the fixture replacement sets the marker (got ${repDone.status}: ${errOf(repDone)})`);
  const repCopy = await req('POST', `/api/character/${repWiz}/copy-spell`, { spellName: 'Burning Hands', source: 'A found spellbook' });
  check(repCopy.status === 200, `copying into the replaced book succeeds (got ${repCopy.status}: ${errOf(repCopy)})`);
  check(repCopy.json?.copy?.replacedCleared === true, 'the copy reports the marker cleared');
  check((await readSpellbookJson(repWiz)).replaced === undefined, 'the marker is gone after the copy');
  check((await readSpellbookJson(repWiz)).status === 'intact', 'the copy leaves the book intact');
  check((await readBook(repWiz)).includes('Burning Hands'), 'the copied spell is in the book');
  const plainWiz = await copyWizard('WizCopyPlain');
  const plainCopy = await req('POST', `/api/character/${plainWiz}/copy-spell`, { spellName: 'Invisibility', source: 'A found spellbook' });
  check(plainCopy.status === 200 && plainCopy.json?.copy?.replacedCleared === false,
    `a copy into a never-replaced book reports nothing cleared (got ${plainCopy.status}: ${errOf(plainCopy)})`);
  check((await readSpellbookJson(plainWiz)).replaced === undefined, 'no marker appears on a plain copy');
}

// ===========================================================================
// (h) Loss via discard-item: last Spellbook row flips status to lost
// ===========================================================================
group('(h) loss via discard-item');
{
  const wiz5 = await makeCharacter({ name: 'WizDiscard', cls: 'wizard', level: 5, intScores: INT3_SCORES });
  await db.dbRun('UPDATE characters SET inventory = ? WHERE id = ?',
    [J([{ name: 'Spellbook', quantity: 1, source: 'stage5-package' }, { name: 'Dagger', quantity: 1 }]), wiz5]);
  const discarded = await req('POST', `/api/character/${wiz5}/discard-item`, { itemName: 'Spellbook' });
  check(discarded.status === 200, `discarding the Spellbook succeeds 200 (got ${discarded.status})`);
  const inv = JSON.parse((await readCharacter(wiz5)).inventory || '[]');
  check(inv.length === 1 && inv[0].name === 'Dagger', 'the Spellbook row is gone and the Dagger remains');
  check((await readSpellbookState(wiz5)).status === 'lost', 'discarding the last Spellbook row flipped the status to lost');
  // A lost book refuses prepared changes right after the discard.
  const change = await req('PUT', `/api/character/${wiz5}`, { prepared_spells: J(COUNTED_4) });
  check(change.status === 400 && errOf(change).includes('lost'), 'a prepared change after the discard refuses as lost');

  // Discarding one of two Spellbooks leaves the status alone — a
  // book remains.
  const two = await makeCharacter({ name: 'WizDiscardTwo', cls: 'wizard', level: 5, intScores: INT3_SCORES });
  await db.dbRun('UPDATE characters SET inventory = ? WHERE id = ?',
    [J([{ name: 'Spellbook', quantity: 1 }, { name: 'Spellbook', quantity: 1 }]), two]);
  const one = await req('POST', `/api/character/${two}/discard-item`, { itemName: 'Spellbook' });
  check(one.status === 200, 'discarding one of two Spellbooks succeeds');
  check(JSON.parse((await readCharacter(two)).inventory || '[]').length === 1, 'one Spellbook row remains');
  check((await readSpellbookState(two)).status === 'intact', 'status stays intact while a Spellbook row remains');

  // A quantity-2 row loses one, not the book: status stays intact.
  const qty = await makeCharacter({ name: 'WizDiscardQty', cls: 'wizard', level: 5, intScores: INT3_SCORES });
  await db.dbRun('UPDATE characters SET inventory = ? WHERE id = ?',
    [J([{ name: 'Spellbook', quantity: 2 }]), qty]);
  await req('POST', `/api/character/${qty}/discard-item`, { itemName: 'Spellbook' });
  const qtyInv = JSON.parse((await readCharacter(qty)).inventory || '[]');
  check(qtyInv.length === 1 && qtyInv[0].quantity === 1, 'a quantity-2 row drops to 1, the row stays');
  check((await readSpellbookState(qty)).status === 'intact', 'status stays intact while the row stays');

  // Discarding the last Spellbook with a live Arcane bank + used
  // flag flips the status to lost and preserves both — losing the
  // book does not affect slot recovery, and the parse/serialize
  // round-trip must never silently wipe them.
  const arc = await makeCharacter({ name: 'WizDiscardArc', cls: 'wizard', level: 5, intScores: INT3_SCORES });
  await db.dbRun('UPDATE characters SET inventory = ?, spellbook_json = ? WHERE id = ?',
    [J([{ name: 'Spellbook', quantity: 1 }]),
     J({ status: 'intact', mastery: [], signature: [], pendingArcaneRecovery: { slots: [1] }, arcaneRecoveryUsed: true }), arc]);
  const arcDiscarded = await req('POST', `/api/character/${arc}/discard-item`, { itemName: 'Spellbook' });
  check(arcDiscarded.status === 200, `discarding with a live Arcane bank + flag succeeds 200 (got ${arcDiscarded.status})`);
  const arcJson = await readSpellbookJson(arc);
  check(arcJson.status === 'lost', 'the discard still flipped the status to lost');
  check(JSON.stringify(arcJson.pendingArcaneRecovery) === JSON.stringify({ slots: [1] }), 'the discard preserved the Arcane bank');
  check(arcJson.arcaneRecoveryUsed === true, 'the discard preserved the used-flag');
}

// ===========================================================================
// (i) Memorize Spell — banked (rest consolidation, 2026-11-07)
// ===========================================================================
// The sheet rest route is gone. The player banks the pick with
// POST /:id/memorize-bank; the next DM short rest (applyRest, the
// real service, called directly like rest-time.test.js does)
// validates it again, applies it with the HP write, and clears the
// bank whether it applies or is refused. The old 50%-HP short-rest
// heal is deliberately gone — a DM short rest heals via hit dice
// only, so these cases assert dice healing, not newHp === 15.
group('(i) Memorize Spell — bank + DM short rest');
{
  const rt = await import(fromRepo('server/services/restTimeService.js'));
  const sched = await import(fromRepo('server/services/scheduleService.js'));
  const absHours = (clock) => clock.day * 24 + clock.hour;
  async function readBank(id) {
    const r = await readCharacter(id);
    let s = {};
    try { s = JSON.parse(r.spellbook_json || '{}'); } catch { s = {}; }
    return s.pendingMemorizeSwap ?? null;
  }
  async function makeSession(characterId) {
    // The fallback (campaign-less) clock is this suite's clock.
    const fbRow = await db.dbGet('SELECT id FROM world_clock WHERE campaign_id IS NULL ORDER BY id LIMIT 1');
    if (!fbRow) {
      await db.dbRun('INSERT INTO world_clock (campaign_id, current_day, current_day_of_year, current_year, current_hour) VALUES (NULL, 1, 1, 1492, 8)');
    }
    const clock = await sched.getClock(null);
    const r = await db.dbRun(
      'INSERT INTO dm_sessions (character_id, game_start_day, game_start_year) VALUES (?, ?, ?)',
      [characterId, clock.dayOfYear, clock.year]);
    return Number(r.lastInsertRowid);
  }
  async function restWizard(name, level = 5) {
    const id = await makeCharacter({ name, cls: 'wizard', level, intScores: INT3_SCORES });
    await seedStoredPrepared(id, COUNTED_8);
    await db.dbRun('UPDATE characters SET current_hp = 10, max_hp = 20, hit_dice = ?, hit_dice_used = ? WHERE id = ?',
      [J({ d6: level }), '{}', id]);
    return id;
  }
  async function bank(id, body) {
    return req('POST', `/api/character/${id}/memorize-bank`, body);
  }

  // --- the old route is gone -------------------------------------------
  const goneId = await restWizard('WizRestGone');
  const gone = await req('POST', `/api/character/rest/${goneId}`, { restType: 'short' });
  check(gone.status === 404, `POST /rest/:id is gone (got ${gone.status})`);
  const charSrc = fs.readFileSync(path.join(origCwd, 'server/routes/character.js'), 'utf8');
  check(!charSrc.includes("router.post('/rest/"), 'character.js has no /rest route left');
  check(!charSrc.includes("spell_slots_used = '{}'"), 'character.js has no full slot reset left (the DM path owns it)');

  // --- bank → DM short rest → swap applied ------------------------------
  const wiz5 = await restWizard('WizRest');
  const session5 = await makeSession(wiz5);
  const banked = await bank(wiz5, { oldSpell: 'Sleep', newSpell: 'Misty Step' });
  check(banked.status === 200 && banked.json?.banked?.oldSpell === 'Sleep' && banked.json?.banked?.newSpell === 'Misty Step',
    `banking a valid swap succeeds 200 (got ${banked.status}: ${errOf(banked)})`);
  check(banked.json?.replaced === false, 'a first bank reports replaced: false');
  check(JSON.stringify(await readBank(wiz5)) === JSON.stringify({ oldSpell: 'Sleep', newSpell: 'Misty Step' }),
    'the bank reads back from spellbook_json');
  check((await readCharacter(wiz5)).current_hp === 10, 'banking touches no HP');
  check(JSON.stringify(await readPrepared(wiz5)) === JSON.stringify(COUNTED_8), 'banking touches no prepared list');
  const clockBefore = await sched.getClock(null);
  const rested = await rt.applyRest({ sessionId: session5, characterId: wiz5, type: 'short', dice: 2 });
  const clockAfter = await sched.getClock(null);
  check(rested.success === true, 'the DM short rest succeeds');
  const pcDetail = rested.event.results.find((r) => r.kind === 'pc');
  check(pcDetail?.memorizeSwap?.applied === true && pcDetail.memorizeSwap.oldSpell === 'Sleep' && pcDetail.memorizeSwap.newSpell === 'Misty Step',
    'the DM short rest reports the swap applied');
  const prep = await readPrepared(wiz5);
  check(prep.includes('Misty Step') && !prep.includes('Sleep'), 'the prepared list swapped Sleep -> Misty Step');
  check(await readBank(wiz5) === null, 'the bank is cleared after the rest');
  const wizRow = await readCharacter(wiz5);
  check(wizRow.current_hp > 10 && wizRow.current_hp <= 20, `the short rest healed via hit dice (10 -> ${wizRow.current_hp})`);
  check(Object.values(JSON.parse(wizRow.hit_dice_used || '{}')).reduce((a, b) => a + b, 0) === 2, 'Dice=2 spent exactly 2 hit dice');
  check(absHours(clockAfter) - absHours(clockBefore) === 1, 'the DM short rest advanced the clock 1 hour');
  check(rt.formatTimeEventBlock(rested.event).includes('Memorize Spell: swapped Sleep'), 'the outcome block narrates the swap for the DM');

  // --- a long rest does NOT consume the bank ----------------------------
  const longRest = await restWizard('WizRestLong');
  const sessionLong = await makeSession(longRest);
  await bank(longRest, { oldSpell: 'Sleep', newSpell: 'Misty Step' });
  const longRested = await rt.applyRest({ sessionId: sessionLong, characterId: longRest, type: 'long' });
  check(JSON.stringify(await readPrepared(longRest)) === JSON.stringify(COUNTED_8), 'a long rest does not swap (Memorize is short-rest only)');
  check(JSON.stringify(await readBank(longRest)) === JSON.stringify({ oldSpell: 'Sleep', newSpell: 'Misty Step' }),
    'a long rest leaves the bank for the next short rest');
  check(longRested.event.results.find((r) => r.kind === 'pc')?.memorizeSwap === undefined, 'a long rest reports no swap');
  const shortAfter = await rt.applyRest({ sessionId: sessionLong, characterId: longRest, type: 'short', dice: 2 });
  check(shortAfter.event.results.find((r) => r.kind === 'pc')?.memorizeSwap?.applied === true,
    'the banked swap fires on the next short rest');
  check((await readPrepared(longRest)).includes('Misty Step'), 'the delayed swap applied');
  check(await readBank(longRest) === null, 'the delayed bank is cleared');

  // --- bank-time refusals (same messages as the old route) --------------
  const notBook = await restWizard('WizRestNoBook');
  const refused = await bank(notBook, { oldSpell: 'Sleep', newSpell: 'Counterspell' });
  check(refused.status === 400 && errOf(refused).includes('not in the spellbook'),
    `a bank to a spell outside the book refuses (got ${refused.status}: ${errOf(refused)})`);
  check((await readCharacter(notBook)).current_hp === 10, 'the refused bank left HP untouched');
  check(JSON.stringify(await readPrepared(notBook)) === JSON.stringify(COUNTED_8), 'the refused bank left the prepared list untouched');
  check(await readBank(notBook) === null, 'a refused bank stores nothing');

  const low = await restWizard('WizRestLow', 4);
  const lowBank = await bank(low, { oldSpell: 'Sleep', newSpell: 'Misty Step' });
  check(lowBank.status === 400 && errOf(lowBank).includes('wizard level 5'),
    `banking below wizard L5 refuses (got ${lowBank.status}: ${errOf(lowBank)})`);

  const lost = await restWizard('WizRestLost');
  await req('POST', `/api/character/${lost}/spellbook-status`, { status: 'lost' });
  const lostBank = await bank(lost, { oldSpell: 'Sleep', newSpell: 'Misty Step' });
  check(lostBank.status === 400 && errOf(lostBank).includes('lost'),
    `banking with a lost book refuses (got ${lostBank.status}: ${errOf(lostBank)})`);

  const fighter = await makeCharacter({ name: 'FightBank', cls: 'fighter', level: 5 });
  const fighterBank = await bank(fighter, { oldSpell: 'Sleep', newSpell: 'Misty Step' });
  check(fighterBank.status === 400 && errOf(fighterBank).includes('wizard level 5'),
    `banking as a non-wizard refuses (got ${fighterBank.status}: ${errOf(fighterBank)})`);

  const noChar = await bank(999999, { oldSpell: 'Sleep', newSpell: 'Misty Step' });
  check(noChar.status === 404, `banking for an unknown character 404s (got ${noChar.status})`);

  // --- snake_case alias + re-bank replaces + DELETE clears --------------
  const alias = await restWizard('WizRestAlias');
  const aliasBank = await bank(alias, { memorize_swap: { old: 'Sleep', new: 'Misty Step' } });
  check(aliasBank.status === 200 && aliasBank.json?.banked?.newSpell === 'Misty Step',
    'the memorize_swap snake_case alias with old/new keys works');
  const reBank = await bank(alias, { oldSpell: 'Shield', newSpell: 'Fireball' });
  check(reBank.status === 200 && reBank.json?.replaced === true
    && JSON.stringify(await readBank(alias)) === JSON.stringify({ oldSpell: 'Shield', newSpell: 'Fireball' }),
    'a second bank replaces the first (one pending swap max)');
  const cleared = await req('DELETE', `/api/character/${alias}/memorize-bank`);
  check(cleared.status === 200 && cleared.json?.cleared === true, 'DELETE clears a banked swap');
  check(await readBank(alias) === null, 'the bank is gone after DELETE');
  const clearedAgain = await req('DELETE', `/api/character/${alias}/memorize-bank`);
  check(clearedAgain.status === 200 && clearedAgain.json?.cleared === false, 'DELETE with no bank reports cleared: false');
  const plainSession = await makeSession(alias);
  const plain = await rt.applyRest({ sessionId: plainSession, characterId: alias, type: 'short', dice: 2 });
  check(plain.event.results.find((r) => r.kind === 'pc')?.memorizeSwap === undefined,
    'a short rest with no bank reports no swap');

  // --- apply-time refusals: the bank is cleared, the rest still heals --
  const stale = await restWizard('WizRestStale');
  const sessionStale = await makeSession(stale);
  await bank(stale, { oldSpell: 'Sleep', newSpell: 'Misty Step' });
  // The old spell left the prepared list after banking (direct DB
  // write — a route would refuse the membership break, the point
  // here is the DM path re-validates against live rows).
  await db.dbRun('UPDATE characters SET prepared_spells = ? WHERE id = ?',
    [J(['Magic Missile', 'Shield', 'Mage Armor', 'Burning Hands', 'Detect Magic', 'Feather Fall', 'Misty Step', 'Fireball']), stale]);
  const staleRest = await rt.applyRest({ sessionId: sessionStale, characterId: stale, type: 'short', dice: 2 });
  const staleDetail = staleRest.event.results.find((r) => r.kind === 'pc')?.memorizeSwap;
  check(staleDetail?.applied === false && String(staleDetail?.reason).includes('not prepared'),
    `a bank whose old spell is no longer prepared refuses at rest time (got ${JSON.stringify(staleDetail)})`);
  check(await readBank(stale) === null, 'a refused-at-rest bank is still cleared');
  check((await readCharacter(stale)).current_hp > 10, 'the refused swap leaves the rest itself untouched — it still heals');
  check(JSON.stringify(await readPrepared(stale)) === JSON.stringify(['Magic Missile', 'Shield', 'Mage Armor', 'Burning Hands', 'Detect Magic', 'Feather Fall', 'Misty Step', 'Fireball']),
    'the refused swap left the prepared list untouched');

  const lostAfter = await restWizard('WizRestLostAfter');
  const sessionLostAfter = await makeSession(lostAfter);
  await bank(lostAfter, { oldSpell: 'Sleep', newSpell: 'Misty Step' });
  await req('POST', `/api/character/${lostAfter}/spellbook-status`, { status: 'lost' });
  check(JSON.stringify(await readBank(lostAfter)) === JSON.stringify({ oldSpell: 'Sleep', newSpell: 'Misty Step' }),
    'flipping the book to lost preserves the bank (serialize round-trip)');
  const lostAfterRest = await rt.applyRest({ sessionId: sessionLostAfter, characterId: lostAfter, type: 'short', dice: 2 });
  const lostDetail = lostAfterRest.event.results.find((r) => r.kind === 'pc')?.memorizeSwap;
  check(lostDetail?.applied === false && String(lostDetail?.reason).includes('lost'),
    `a bank on a book lost after banking refuses at rest time (got ${JSON.stringify(lostDetail)})`);
  check(await readBank(lostAfter) === null, 'the lost-book refusal still clears the bank');

  // An old spell that became always-prepared after banking (Mastery
  // L18) refuses at rest time the same way.
  const BOOK22 = ['Magic Missile', 'Shield', 'Mage Armor', 'Sleep', 'Burning Hands', 'Thunderwave',
    'Detect Magic', 'Feather Fall', 'Misty Step', 'Fireball', 'Counterspell', 'Dispel Magic',
    'Invisibility', 'Mirror Image', 'Scorching Ray', 'Web', 'Chromatic Orb', 'Grease',
    'Identify', 'Comprehend Languages', 'Alarm', 'False Life'];
  const wiz18 = await makeCharacter({ name: 'WizRestMastery', cls: 'wizard', level: 18, intScores: INT3_SCORES });
  await seedBook(wiz18, BOOK22);
  await seedStoredPrepared(wiz18, BOOK22.slice(0, 20));
  await db.dbRun('UPDATE characters SET current_hp = 10, max_hp = 20, hit_dice = ?, hit_dice_used = ? WHERE id = ?',
    [J({ d6: 18 }), '{}', wiz18]);
  const session18 = await makeSession(wiz18);
  await bank(wiz18, { oldSpell: 'Sleep', newSpell: 'Alarm' });
  const mastery = await req('POST', `/api/character/${wiz18}/spellbook-always-prepared`, { mastery: ['Sleep'] });
  check(mastery.status === 200, `setting the Mastery pick succeeds (got ${mastery.status}: ${errOf(mastery)})`);
  check(JSON.stringify(await readBank(wiz18)) === JSON.stringify({ oldSpell: 'Sleep', newSpell: 'Alarm' }),
    'setting always-prepared picks preserves the bank');
  const masteryRest = await rt.applyRest({ sessionId: session18, characterId: wiz18, type: 'short', dice: 2 });
  const masteryDetail = masteryRest.event.results.find((r) => r.kind === 'pc')?.memorizeSwap;
  check(masteryDetail?.applied === false && String(masteryDetail?.reason).includes('always prepared'),
    `a bank whose old spell became always-prepared refuses at rest time (got ${JSON.stringify(masteryDetail)})`);
  check(await readBank(wiz18) === null, 'the always-prepared refusal still clears the bank');
}

// ===========================================================================
// (j) Always-prepared picks: Mastery L18 / Signature L20, in the book
// ===========================================================================
group('(j) spellbook-always-prepared');
{
  const BOOK22 = ['Magic Missile', 'Shield', 'Mage Armor', 'Sleep', 'Burning Hands', 'Thunderwave',
    'Detect Magic', 'Feather Fall', 'Misty Step', 'Fireball', 'Counterspell', 'Dispel Magic',
    'Invisibility', 'Mirror Image', 'Scorching Ray', 'Web', 'Chromatic Orb', 'Grease',
    'Identify', 'Comprehend Languages', 'Alarm', 'False Life'];
  const wiz18 = await makeCharacter({ name: 'WizMastery', cls: 'wizard', level: 18, intScores: INT3_SCORES });
  await seedBook(wiz18, BOOK22);
  await seedStoredPrepared(wiz18, BOOK22.slice(0, 20));
  const mastery = await req('POST', `/api/character/${wiz18}/spellbook-always-prepared`, { mastery: ['Fireball', 'Counterspell'] });
  check(mastery.status === 200 && JSON.stringify(mastery.json?.spellbook?.mastery) === JSON.stringify(['Fireball', 'Counterspell']),
    `setting Mastery picks succeeds 200 (got ${mastery.status}: ${errOf(mastery)})`);
  check(JSON.stringify((await readSpellbookState(wiz18)).mastery) === JSON.stringify(['Fireball', 'Counterspell']),
    'Mastery picks read back from spellbook_json');
  // Exclusion in force: 22 prepared spells with Fireball among
  // them count 21 against the L18 cap of 21 — without the
  // exclusion the same list would refuse at 22.
  const cap18 = preparedSpellsMax(3, 18);
  check(cap18 === 21, `cap source: L18 cap at Int +3 is 21 (got ${cap18})`);
  const over = await req('PUT', `/api/character/${wiz18}`, { prepared_spells: J(BOOK22) });
  check(over.status === 200,
    `PUT of 22 spells with 1 always-prepared among them persists — counted 21 at cap 21 (got ${over.status}: ${errOf(over)})`);
  const three = await req('POST', `/api/character/${wiz18}/spellbook-always-prepared`, { mastery: ['Fireball', 'Counterspell', 'Dispel Magic'] });
  check(three.status === 400 && errOf(three).includes('at most 2'), `three Mastery picks refuse (got ${three.status})`);
  const notBook = await req('POST', `/api/character/${wiz18}/spellbook-always-prepared`, { mastery: ['Wish'] });
  check(notBook.status === 400 && errOf(notBook).includes('not in the spellbook'), `a Mastery pick outside the book refuses (got ${notBook.status})`);
  const sigEarly = await req('POST', `/api/character/${wiz18}/spellbook-always-prepared`, { signature: ['Wish'] });
  check(sigEarly.status === 400 && errOf(sigEarly).includes('requires wizard level 20'), `Signature picks at L18 refuse (got ${sigEarly.status})`);
  // Picks are NOT added to prepared_spells by the route.
  check(JSON.stringify(await readPrepared(wiz18)) === JSON.stringify(BOOK22), 'the route did not add picks to prepared_spells (the PUT above set the list, the route left it)');

  const wiz20 = await makeCharacter({ name: 'WizSig', cls: 'wizard', level: 20, intScores: INT3_SCORES });
  await seedBook(wiz20, [...BOOK22, 'Wish', 'Meteor Swarm']);
  const sig = await req('POST', `/api/character/${wiz20}/spellbook-always-prepared`, { signature: ['Wish', 'Meteor Swarm'] });
  check(sig.status === 200 && JSON.stringify(sig.json?.spellbook?.signature) === JSON.stringify(['Wish', 'Meteor Swarm']),
    `setting Signature picks at L20 succeeds (got ${sig.status}: ${errOf(sig)})`);
  const overlap = await req('POST', `/api/character/${wiz20}/spellbook-always-prepared`, { mastery: ['Fireball'], signature: ['Fireball'] });
  check(overlap.status === 400 && errOf(overlap).includes('already a Spell Mastery pick'),
    `a spell in both lists refuses (got ${overlap.status}: ${errOf(overlap)})`);
  // Only sent keys change: setting signature alone keeps mastery.
  const keep = await req('POST', `/api/character/${wiz20}/spellbook-always-prepared`, { mastery: ['Fireball'] });
  check(keep.status === 200 && JSON.stringify(keep.json?.spellbook?.signature) === JSON.stringify(['Wish', 'Meteor Swarm']),
    'setting mastery alone keeps the stored signature picks');
  const cleric = await makeCharacter({ name: 'ClericAP', cls: 'cleric', level: 5, intScores: INT3_SCORES });
  const clericAp = await req('POST', `/api/character/${cleric}/spellbook-always-prepared`, { mastery: ['Bless'] });
  check(clericAp.status === 400 && errOf(clericAp).includes('wizards only'), 'the route refuses a non-wizard');
}

// ===========================================================================
// (k) Commit: a bookless wizard draft refuses; with a book it commits
// ===========================================================================
group('(k) commit refusal for a bookless wizard draft');
{
  const JACK_ID = await (async () => {
    const row = await db.dbGet(
      `SELECT id FROM ancestry_feats WHERE list_id IN ('human') AND tier = 1 AND (choices IS NULL OR choices = '[]') ORDER BY list_id, choice_index LIMIT 1`,
    );
    assert(row?.id != null, 'a no-choice tier-1 human ancestry feat resolves');
    return row.id;
  })();
  const WIRE_FIELDS = ['ability_scores', 'skills', 'languages', 'tool_proficiencies', 'known_spells', 'prepared_spells', 'known_cantrips', 'expertise'];
  function wireBody(body) {
    const out = { ...body };
    for (const f of WIRE_FIELDS) {
      if (out[f] !== undefined && out[f] !== null && typeof out[f] !== 'string') out[f] = J(out[f]);
    }
    return out;
  }
  const WIZ_BASE = { str: 8, dex: 14, con: 13, int: 15, wis: 12, cha: 10 };
  const WIZ_FINAL = { str: 10, dex: 14, con: 14, int: 15, wis: 12, cha: 10 };
  function wizardDraft(overrides = {}) {
    return {
      creator: 'creator-next',
      name: 'Wren Commit', first_name: 'Wren', gender: 'Female',
      race: 'human', size: 'Medium',
      origin_setting: 'Forgotten Realms', origin_region: 'Sword Coast', origin_explanation: 'Born in the Sword Coast.',
      class: 'wizard', theme_id: 'soldier', origin_feat: 'savage_attacker',
      // Round 2 (server): Soldier now requires rank + active-duty at
      // Review (§6) — the draft carries both so the commit reaches
      // the spellbook checks instead of refusing on the theme fields.
      theme_path_choice: 'sergeant', theme_path_data: { active_duty: 'active' },
      generation_method: 'point_buy', base_scores: WIZ_BASE, ability_scores: WIZ_FINAL,
      skills: ['Athletics', 'Intimidation', 'Arcana', 'History'],
      // + 'Giant': the Human species' extra-language pick (R2-15
      // count rule, creation-solidification 2026-11-12).
      languages: ['Common', 'Giant'],
      prepared_spells: ['shield', 'mage armor', 'sleep'],
      known_cantrips: ['Fire Bolt', 'Ray of Frost', 'Mage Hand'],
      ancestry_feat_id: JACK_ID,
      alignment: 'Lawful Good', faith: 'Mystra', lifestyle: 'Modest',
      age: '24', height: `5'6"`, weight: '130 lb', eye_color: 'Brown',
      hair_color: 'Black', skin_color: 'Tan', physical_build: 'Slim',
      gear_choice: 'gold',
      ...overrides,
    };
  }
  async function postDraft(body) {
    return req('POST', '/api/character', wireBody(body));
  }
  async function commitCharacter(id, body) {
    return req('POST', `/api/character/${id}/commit`, wireBody(body));
  }
  const bookless = await postDraft(wizardDraft());
  check(bookless.status === 201, `bookless wizard draft POST creates 201 — the draft save stays tolerant (got ${bookless.status}: ${errOf(bookless)})`);
  const booklessId = bookless.json?.id;
  assert(booklessId != null, 'bookless draft POST returned an id (without it the commit checks below cannot run)');
  const refused = await commitCharacter(booklessId, wizardDraft());
  check(refused.status === 400 && errOf(refused).includes('knownSpells') && errOf(refused).includes('spellbook'),
    `commit of the bookless draft refuses naming knownSpells/the spellbook (got ${refused.status}: ${errOf(refused)})`);
  check(errOf(refused).includes('never auto-filled'), 'the commit refusal says the book is never auto-filled');
  check((await readCharacter(booklessId)).creation_phase !== 'active',
    'the refused commit left the draft uncommitted (creation_phase is not active)');

  const withBook = await postDraft(wizardDraft({
    name: 'Wren With Book',
    known_spells: ['shield', 'mage armor', 'sleep', 'burning hands', 'chromatic orb', 'grease'],
  }));
  check(withBook.status === 201, `wizard draft with a 6-spell book POST creates 201 (got ${withBook.status}: ${errOf(withBook)})`);
  const withBookId = withBook.json?.id;
  assert(withBookId != null, 'with-book draft POST returned an id (without it the commit checks below cannot run)');
  const committed = await commitCharacter(withBookId, wizardDraft({
    name: 'Wren With Book',
    known_spells: ['shield', 'mage armor', 'sleep', 'burning hands', 'chromatic orb', 'grease'],
  }));
  check(committed.status === 200, `commit with a 6-spell book succeeds 200 (got ${committed.status}: ${errOf(committed)})`);
  check((await readCharacter(withBookId)).creation_phase === 'active', 'the successful commit set creation_phase to active');
  check(JSON.stringify(await readBook(withBookId)).length > 2, 'the committed row kept the book');
}

// ===========================================================================
// (l) Replace a lost book: transcribe prepared at 1h + 10 gp/level
// ===========================================================================
group('(l) spellbook-replace (transcribe prepared)');
{
  async function replaceWizard(name, gold = 500) {
    const id = await makeCharacter({ name, cls: 'wizard', level: 5, intScores: INT4_SCORES });
    await seedBook(id, REPLACE_BOOK12);
    await seedStoredPrepared(id, REPLACE_PREPARED9);
    await db.dbRun('UPDATE characters SET gold_gp = ? WHERE id = ?', [gold, id]);
    return id;
  }
  async function clockHour() {
    const row = await db.dbGet('SELECT current_hour FROM world_clock WHERE id = 1');
    return Number(row?.current_hour);
  }

  // Happy path: 9 prepared at levels 1,1,1,1,2,2,2,3,3 (sum 16) ->
  // 160 gp transcription + 50 gp for the blank book (V5, standard
  // price) = 210 gp + 16h; the new book is exactly the prepared list.
  const wiz5 = await replaceWizard('WizReplace');
  await req('POST', `/api/character/${wiz5}/spellbook-status`, { status: 'lost' });
  const hourBefore = await clockHour();
  const replaced = await req('POST', `/api/character/${wiz5}/spellbook-replace`, {});
  check(replaced.status === 200, `replacing a lost book succeeds 200 (got ${replaced.status}: ${errOf(replaced)})`);
  check(replaced.json?.replacement?.source === 'memory', 'the default source is memory');
  check(JSON.stringify(replaced.json?.replacement?.spells) === JSON.stringify(REPLACE_PREPARED9),
    'the new book is exactly the prepared list, in prepared order');
  check(JSON.stringify(replaced.json?.replacement?.spellLevels) === JSON.stringify([1, 1, 1, 1, 2, 2, 2, 3, 3]),
    'the response names the spell levels');
  check(JSON.stringify(replaced.json?.replacement?.bookSpells) === JSON.stringify(REPLACE_PREPARED9),
    'the book so far is the whole prepared list');
  check(JSON.stringify(replaced.json?.replacement?.remainingSpells) === JSON.stringify([]),
    'nothing remains to transcribe on a full replacement');
  check(replaced.json?.replacement?.complete === true, 'a full replacement reports complete');
  check(replaced.json?.replacement?.goldSpent === 210 && replaced.json?.replacement?.goldRemaining === 290,
    'replacement reports 210 gp spent (160 transcription + 50 for the blank book), 290 remaining');
  check(replaced.json?.replacement?.bookCostCharged === 50, 'the replacement charges the standard 50 gp blank-book cost');
  check(replaced.json?.replacement?.hoursAdvanced === 16 && replaced.json?.replacement?.clockAdvanced === true,
    'replacement reports 16h advanced and the clock advanced');
  check(!replaced.json?.replacement?.clockError, 'no clock error on the replacement');
  check(replaced.json?.replacement?.bankCleared === false, 'no bank, nothing cleared');
  check(Number((await readCharacter(wiz5)).gold_gp) === 290, 'gold deducted in the DB (500 -> 290)');
  check((await readSpellbookJson(wiz5)).bookCost === 50, 'the book cost is stored with the book');
  check((await readSpellbookJson(wiz5)).bookMaterials === 'standard', 'the stored materials are the standard KEY (absent key defaults to standard)');
  check(replaced.json?.replacement?.bookMaterials === 'standard', 'the response names the standard materials key');
  check(JSON.stringify(await readBook(wiz5)) === JSON.stringify(REPLACE_PREPARED9), 'the book is now exactly the 9 prepared spells');
  check(!(await readBook(wiz5)).includes('Burning Hands') && !(await readBook(wiz5)).includes('Thunderwave') && !(await readBook(wiz5)).includes('Detect Magic'),
    'the three unprepared spells are gone from the new book');
  check(JSON.stringify(await readPrepared(wiz5)) === JSON.stringify(REPLACE_PREPARED9), 'the prepared list is unchanged');
  check((await readSpellbookJson(wiz5)).status === 'intact', 'status is back to intact');
  check((await readSpellbookJson(wiz5)).replaced === 'prepared', 'the state marks the book replaced-from-prepared');
  check(JSON.stringify(await readInventory(wiz5)) === JSON.stringify([{ name: 'Spellbook', quantity: 1, source: 'spellbook-replacement' }]),
    'a Spellbook inventory row was added (the new book is a physical thing)');
  check((await clockHour()) === (hourBefore + 16) % 24, `the world clock advanced 16h (${hourBefore} -> ${(hourBefore + 16) % 24})`);
  // A second replacement now refuses — the book is no longer lost.
  const again = await req('POST', `/api/character/${wiz5}/spellbook-replace`, {});
  check(again.status === 400 && errOf(again).includes('not lost'), 'replacing an intact book refuses');

  // The status lever is only an override: flipping lost -> intact
  // does NOT re-transcribe — the old book contents stay exactly as
  // they were, unprepared spells included.
  const lever = await replaceWizard('WizReplaceLever');
  await req('POST', `/api/character/${lever}/spellbook-status`, { status: 'lost' });
  const flipped = await req('POST', `/api/character/${lever}/spellbook-status`, { status: 'intact' });
  check(flipped.status === 200, 'the status lever flips back to intact');
  check(JSON.stringify(await readBook(lever)) === JSON.stringify(REPLACE_BOOK12),
    'the lever left the old book contents untouched (all 12, unprepared included)');
  check((await readSpellbookJson(lever)).replaced === undefined, 'the lever sets no replaced marker');
  await req('POST', `/api/character/${lever}/spellbook-status`, { status: 'lost' });
  const leverReplaced = await req('POST', `/api/character/${lever}/spellbook-replace`, {});
  check(leverReplaced.status === 200 && JSON.stringify(await readBook(lever)) === JSON.stringify(REPLACE_PREPARED9),
    'losing it again and replacing transcribes the prepared list');

  // Stale bank: bank a swap, lose the book, replace — the bank is
  // gone and the swap never applies on the next DM short rest.
  const rt = await import(fromRepo('server/services/restTimeService.js'));
  const sched = await import(fromRepo('server/services/scheduleService.js'));
  async function readBank(id) {
    const r = await readCharacter(id);
    let s = {};
    try { s = JSON.parse(r.spellbook_json || '{}'); } catch { s = {}; }
    return s.pendingMemorizeSwap ?? null;
  }
  async function makeSession(characterId) {
    const fbRow = await db.dbGet('SELECT id FROM world_clock WHERE campaign_id IS NULL ORDER BY id LIMIT 1');
    if (!fbRow) {
      await db.dbRun('INSERT INTO world_clock (campaign_id, current_day, current_day_of_year, current_year, current_hour) VALUES (NULL, 1, 1, 1492, 8)');
    }
    const clock = await sched.getClock(null);
    const r = await db.dbRun(
      'INSERT INTO dm_sessions (character_id, game_start_day, game_start_year) VALUES (?, ?, ?)',
      [characterId, clock.dayOfYear, clock.year]);
    return Number(r.lastInsertRowid);
  }
  const bankWiz = await replaceWizard('WizReplaceBank');
  await db.dbRun('UPDATE characters SET current_hp = 10, max_hp = 20, hit_dice = ?, hit_dice_used = ? WHERE id = ?',
    [J({ d6: 5 }), '{}', bankWiz]);
  const banked = await req('POST', `/api/character/${bankWiz}/memorize-bank`, { oldSpell: 'Sleep', newSpell: 'Burning Hands' });
  check(banked.status === 200, `banking a swap succeeds (got ${banked.status}: ${errOf(banked)})`);
  await req('POST', `/api/character/${bankWiz}/spellbook-status`, { status: 'lost' });
  const bankReplaced = await req('POST', `/api/character/${bankWiz}/spellbook-replace`, {});
  check(bankReplaced.status === 200, 'the replacement succeeds with a bank live');
  check(bankReplaced.json?.replacement?.bankCleared === true, 'the replacement reports the bank cleared');
  check(String(bankReplaced.json?.replacement?.bankClearReason || '').includes('lost'), 'the clear reason names the lost book');
  check(await readBank(bankWiz) === null, 'the bank is gone from spellbook_json after the replacement');
  const sessionBank = await makeSession(bankWiz);
  const rested = await rt.applyRest({ sessionId: sessionBank, characterId: bankWiz, type: 'short', dice: 2 });
  check(rested.success === true, 'the DM short rest still succeeds');
  check(rested.event.results.find((r) => r.kind === 'pc')?.memorizeSwap === undefined, 'no swap applies on the short rest after the replacement');
  check(JSON.stringify(await readPrepared(bankWiz)) === JSON.stringify(REPLACE_PREPARED9), 'the prepared list is untouched by the rest');

  // V5 (table, 2026-11-08 follow-ups, D4/D5): the blank-book price
  // comes from the fixed five-tier table — the client sends only a
  // materials KEY. A dragonhide book charges 160 transcription +
  // 500 = 660 gp; an unknown key refuses naming the key; there is
  // NO waived tier (the old `bookCost: 0` pin is deleted, not
  // converted — Zach's table has no 0 tier).
  const lavish = await replaceWizard('WizReplaceLavish', 1000);
  await req('POST', `/api/character/${lavish}/spellbook-status`, { status: 'lost' });
  const lav = await req('POST', `/api/character/${lavish}/spellbook-replace`, { bookMaterials: 'dragonhide' });
  check(lav.status === 200, `a dragonhide replacement succeeds (got ${lav.status}: ${errOf(lav)})`);
  check(lav.json?.replacement?.goldSpent === 660 && lav.json?.replacement?.goldRemaining === 340,
    'a dragonhide book charges 160 transcription + 500 for the blank book');
  check(lav.json?.replacement?.bookCostCharged === 500, 'the response names the dragonhide table price');
  check(lav.json?.replacement?.bookMaterials === 'dragonhide', 'the response names the materials KEY');
  check((await readSpellbookJson(lavish)).bookCost === 500 && (await readSpellbookJson(lavish)).bookMaterials === 'dragonhide',
    'the cost + materials KEY are stored with the book');
  const gilt = await replaceWizard('WizReplaceGilt');
  await req('POST', `/api/character/${gilt}/spellbook-status`, { status: 'lost' });
  const giltR = await req('POST', `/api/character/${gilt}/spellbook-replace`, { bookMaterials: 'gilt-edged' });
  check(giltR.status === 200 && giltR.json?.replacement?.goldSpent === 410 && giltR.json?.replacement?.goldRemaining === 90,
    `a gilt-edged book charges 160 transcription + 250 (got ${giltR.status}: ${errOf(giltR)})`);
  check(giltR.json?.replacement?.bookCostCharged === 250 && (await readSpellbookJson(gilt)).bookMaterials === 'gilt-edged',
    'the gilt-edged tier charges + stores its table price + key');
  const badCost = await replaceWizard('WizReplaceBadCost');
  await req('POST', `/api/character/${badCost}/spellbook-status`, { status: 'lost' });
  const bad = await req('POST', `/api/character/${badCost}/spellbook-replace`, { bookMaterials: 'unicorn-hide' });
  check(bad.status === 400 && errOf(bad).includes('unicorn-hide'),
    `an unknown materials key refuses naming the key (got ${bad.status}: ${errOf(bad)})`);
  check(Number((await readCharacter(badCost)).gold_gp) === 500, 'the refused replace left gold at 500');
  check((await readSpellbookJson(badCost)).status === 'lost', 'the refused replace left the book lost');
  check(JSON.stringify(await readBook(badCost)) === JSON.stringify(REPLACE_BOOK12), 'the refused replace left the book unchanged');

  // V6 subset: transcribe one prepared spell at a time, spell by
  // spell. The book grows per call; status stays lost and the
  // prepared list is untouched until the prepared list is fully
  // transcribed — only then does the book complete.
  const sub = await replaceWizard('WizReplaceSubset');
  await req('POST', `/api/character/${sub}/spellbook-status`, { status: 'lost' });
  const one = await req('POST', `/api/character/${sub}/spellbook-replace`, { spells: ['Fireball'] });
  check(one.status === 200, `transcribing one spell succeeds (got ${one.status}: ${errOf(one)})`);
  check(JSON.stringify(one.json?.replacement?.spells) === JSON.stringify(['Fireball']),
    'the response names the spell transcribed this call');
  check(JSON.stringify(one.json?.replacement?.spellLevels) === JSON.stringify([3]), 'the response names this call\'s spell level');
  check(JSON.stringify(one.json?.replacement?.bookSpells) === JSON.stringify(['Fireball']), 'the book so far is just Fireball');
  check(one.json?.replacement?.complete === false, 'the book is not complete after one spell');
  check(one.json?.replacement?.remainingSpells?.length === 8 && !one.json?.replacement?.remainingSpells.includes('Fireball'),
    'eight prepared spells remain to transcribe');
  check(one.json?.replacement?.goldSpent === 80 && one.json?.replacement?.goldRemaining === 420,
    'the first subset call charges 30 gp transcription + 50 gp for the blank book');
  check(one.json?.replacement?.bookCostCharged === 50, 'the book cost is charged on the first subset call');
  check(one.json?.replacement?.hoursAdvanced === 3, 'the first subset call advances 3h for the L3 spell');
  check((await readSpellbookJson(sub)).status === 'lost', 'status stays lost after a partial transcription');
  check((await readSpellbookJson(sub)).replaced === undefined, 'no replaced marker until the book is complete');
  check((await readSpellbookJson(sub)).bookCost === 50, 'the book cost is stored with the book on the first call');
  check(JSON.stringify(await readBook(sub)) === JSON.stringify(['Fireball']), 'the stored book is just the transcribed spell');
  check(JSON.stringify(await readPrepared(sub)) === JSON.stringify(REPLACE_PREPARED9), 'the prepared list is untouched by a subset call');
  // A subset naming an unprepared spell, a duplicate, or an
  // already-transcribed spell refuses naming it; nothing moves.
  const unprep = await req('POST', `/api/character/${sub}/spellbook-replace`, { spells: ['Burning Hands'] });
  check(unprep.status === 400 && errOf(unprep).includes('Burning Hands'),
    `a subset naming an unprepared spell refuses (got ${unprep.status}: ${errOf(unprep)})`);
  const dupeSub = await req('POST', `/api/character/${sub}/spellbook-replace`, { spells: ['Sleep', 'Sleep'] });
  check(dupeSub.status === 400 && errOf(dupeSub).includes('Sleep'),
    `a subset naming a spell twice refuses (got ${dupeSub.status}: ${errOf(dupeSub)})`);
  const already = await req('POST', `/api/character/${sub}/spellbook-replace`, { spells: ['Fireball'] });
  check(already.status === 400 && errOf(already).includes('Fireball'),
    `re-transcribing an already-transcribed spell refuses (got ${already.status}: ${errOf(already)})`);
  check(Number((await readCharacter(sub)).gold_gp) === 420, 'the refused subsets left gold at 420');
  check(JSON.stringify(await readBook(sub)) === JSON.stringify(['Fireball']), 'the refused subsets left the book unchanged');
  // A second subset accumulates — transcription only, no second
  // book cost — and merges in prepared order.
  const two = await req('POST', `/api/character/${sub}/spellbook-replace`, { spells: ['Sleep', 'Shield'] });
  check(two.status === 200, `a second subset succeeds (got ${two.status}: ${errOf(two)})`);
  check(JSON.stringify(two.json?.replacement?.spells) === JSON.stringify(['Sleep', 'Shield']),
    'the response names this call\'s two spells');
  check(JSON.stringify(two.json?.replacement?.bookSpells) === JSON.stringify(['Shield', 'Sleep', 'Fireball']),
    'the second subset merges into the book, in prepared order');
  check(two.json?.replacement?.complete === false, 'the book is still incomplete after three of nine');
  check(two.json?.replacement?.goldSpent === 20 && two.json?.replacement?.goldRemaining === 400,
    'the second subset charges transcription only (10 + 10 gp, no second book cost)');
  check(two.json?.replacement?.bookCostCharged === 0, 'the book cost is not charged again');
  check((await readSpellbookJson(sub)).status === 'lost', 'status is still lost after three of nine');
  // An empty subset refuses — nothing to transcribe, not a 0-gp success.
  const emptySub = await req('POST', `/api/character/${sub}/spellbook-replace`, { spells: [] });
  check(emptySub.status === 400 && errOf(emptySub).includes('nothing to transcribe'),
    `an empty subset refuses (got ${emptySub.status}: ${errOf(emptySub)})`);
  // Transcribe the rest — completion flips status + sets replaced.
  // Total across the three calls is the same 210 gp as a full
  // replacement (80 + 20 + 110).
  const rest = await req('POST', `/api/character/${sub}/spellbook-replace`, { spells: ['Magic Missile', 'Mage Armor', 'Misty Step', 'Scorching Ray', 'Darkness', 'Counterspell'] });
  check(rest.status === 200, `transcribing the rest succeeds (got ${rest.status}: ${errOf(rest)})`);
  check(rest.json?.replacement?.complete === true && JSON.stringify(rest.json?.replacement?.remainingSpells) === JSON.stringify([]),
    'the book is complete once every prepared spell is transcribed');
  check(JSON.stringify(rest.json?.replacement?.bookSpells) === JSON.stringify(REPLACE_PREPARED9),
    'the completed book is the prepared list, in prepared order');
  check(rest.json?.replacement?.goldSpent === 110 && rest.json?.replacement?.goldRemaining === 290,
    'the final subset charges its six spells only (110 gp), landing on the same 290 gp as a full replacement');
  check((await readSpellbookJson(sub)).status === 'intact', 'status flips to intact on completion');
  check((await readSpellbookJson(sub)).replaced === 'prepared', 'the replaced marker is set only on completion');
  check(JSON.stringify(await readBook(sub)) === JSON.stringify(REPLACE_PREPARED9), 'the stored book is the full prepared list');
  check(JSON.stringify(await readPrepared(sub)) === JSON.stringify(REPLACE_PREPARED9), 'the prepared list is unchanged after completion');
  // The stale bank is cleared on the FIRST subset call only, and
  // reported once.
  const bankSub = await replaceWizard('WizReplaceSubsetBank');
  const bankedSub = await req('POST', `/api/character/${bankSub}/memorize-bank`, { oldSpell: 'Sleep', newSpell: 'Burning Hands' });
  check(bankedSub.status === 200, `banking a swap before the loss succeeds (got ${bankedSub.status}: ${errOf(bankedSub)})`);
  await req('POST', `/api/character/${bankSub}/spellbook-status`, { status: 'lost' });
  const sub1 = await req('POST', `/api/character/${bankSub}/spellbook-replace`, { spells: ['Fireball'] });
  check(sub1.status === 200 && sub1.json?.replacement?.bankCleared === true, 'the first subset call clears the stale bank');
  check(await readBank(bankSub) === null, 'the bank is gone after the first subset call');
  const sub2 = await req('POST', `/api/character/${bankSub}/spellbook-replace`, { spells: ['Sleep'] });
  check(sub2.status === 200 && sub2.json?.replacement?.bankCleared === false, 'the second subset call reports no bank to clear');
}

// ===========================================================================
// (m) Backup copy + restore from backup
// ===========================================================================
group('(m) backup copy + restore from backup');
{
  async function backupWizard(name, gold = 500) {
    const id = await makeCharacter({ name, cls: 'wizard', level: 5, intScores: INT3_SCORES });
    await seedStoredPrepared(id, COUNTED_8);
    await db.dbRun('UPDATE characters SET gold_gp = ? WHERE id = ?', [gold, id]);
    return id;
  }
  async function clockHour() {
    const row = await db.dbGet('SELECT current_hour FROM world_clock WHERE id = 1');
    return Number(row?.current_hour);
  }

  // First copy: Fireball (L3) into an empty backup — 30 gp
  // transcription + 50 gp for the blank backup book (V5) = 80 gp +
  // 3h, and the first copy adds the physical backup row.
  const wiz5 = await backupWizard('WizBackup');
  const hourBefore = await clockHour();
  const first = await req('POST', `/api/character/${wiz5}/spellbook-backup`, { spellName: 'Fireball' });
  check(first.status === 200, `copying Fireball into the backup succeeds (got ${first.status}: ${errOf(first)})`);
  check(first.json?.backup?.goldSpent === 80 && first.json?.backup?.goldRemaining === 420,
    'backup copy reports 80 gp spent (30 transcription + 50 for the blank backup book), 420 remaining');
  check(first.json?.backup?.bookCostCharged === 50, 'the first backup copy charges the standard 50 gp blank-book cost');
  check(first.json?.backup?.bookMaterials === 'standard', 'the first backup copy reports the standard materials key');
  check(first.json?.backup?.hoursAdvanced === 3 && first.json?.backup?.clockAdvanced === true, 'backup copy reports 3h advanced');
  check(JSON.stringify(first.json?.backup?.backupSpells) === JSON.stringify(['Fireball']), 'the backup holds Fireball');
  check(JSON.stringify((await readSpellbookJson(wiz5)).backup) === JSON.stringify(['Fireball']), 'the backup reads back from spellbook_json');
  check(Number((await readCharacter(wiz5)).gold_gp) === 420, 'gold deducted in the DB (500 -> 420)');
  check((await clockHour()) === (hourBefore + 3) % 24, 'the world clock advanced 3h');
  const inv1 = await readInventory(wiz5);
  check(inv1.length === 1 && inv1[0].name === 'Spellbook' && inv1[0].source === 'spellbook-backup',
    'the first backup copy added a Spellbook row tagged spellbook-backup');
  const second = await req('POST', `/api/character/${wiz5}/spellbook-backup`, { spellName: 'Misty Step' });
  check(second.status === 200 && JSON.stringify(second.json?.backup?.backupSpells) === JSON.stringify(['Fireball', 'Misty Step']),
    'a second copy appends to the backup');
  check(second.json?.backup?.goldSpent === 20 && second.json?.backup?.goldRemaining === 400,
    'the second copy charges transcription only (20 gp, no second book cost)');
  check(second.json?.backup?.bookCostCharged === 0, 'the second copy charges no book cost');
  check((await readInventory(wiz5)).length === 1, 'the second copy adds no further row');

  // A table-key price + materials ride the first copy only; the
  // cost is reported, not stored (the stored bookCost describes the
  // main book, not the backup). Dragonhide: 30 transcription + 500.
  const lavishBackup = await backupWizard('WizBackupLavish', 1000);
  const lavishFirst = await req('POST', `/api/character/${lavishBackup}/spellbook-backup`, { spellName: 'Fireball', bookMaterials: 'dragonhide' });
  check(lavishFirst.status === 200, `a dragonhide first backup copy succeeds (got ${lavishFirst.status}: ${errOf(lavishFirst)})`);
  check(lavishFirst.json?.backup?.goldSpent === 530 && lavishFirst.json?.backup?.goldRemaining === 470,
    'a dragonhide backup book charges 30 transcription + 500 for the blank book');
  check(lavishFirst.json?.backup?.bookCostCharged === 500 && lavishFirst.json?.backup?.bookMaterials === 'dragonhide',
    'the response names the dragonhide table price + materials KEY');
  check((await readSpellbookJson(lavishBackup)).bookCost === undefined, 'the backup book cost is not stored as the main book cost');
  const lavishSecond = await req('POST', `/api/character/${lavishBackup}/spellbook-backup`, { spellName: 'Misty Step' });
  check(lavishSecond.json?.backup?.goldSpent === 20 && lavishSecond.json?.backup?.goldRemaining === 450,
    'the second copy after a dragonhide first charges transcription only');

  // Refusals: each leaves gold, the book, and the backup untouched.
  const dupe = await backupWizard('WizBackupDupe');
  await req('POST', `/api/character/${dupe}/spellbook-backup`, { spellName: 'Fireball' });
  const dupeCopy = await req('POST', `/api/character/${dupe}/spellbook-backup`, { spellName: 'Fireball' });
  check(dupeCopy.status === 400 && errOf(dupeCopy).includes('already in the backup'),
    `copying a spell already in the backup refuses (got ${dupeCopy.status}: ${errOf(dupeCopy)})`);
  check(Number((await readCharacter(dupe)).gold_gp) === 420, 'the refused dupe left gold at 420');
  const notBook = await backupWizard('WizBackupNotBook');
  const notBookCopy = await req('POST', `/api/character/${notBook}/spellbook-backup`, { spellName: 'Counterspell' });
  check(notBookCopy.status === 400 && errOf(notBookCopy).includes('not in the spellbook'),
    `copying a spell outside the main book refuses (got ${notBookCopy.status}: ${errOf(notBookCopy)})`);
  const cantrip = await backupWizard('WizBackupCantrip');
  const cantripCopy = await req('POST', `/api/character/${cantrip}/spellbook-backup`, { spellName: 'Fire Bolt' });
  check(cantripCopy.status === 400 && errOf(cantripCopy).includes('cantrip'),
    `copying a cantrip into the backup refuses (got ${cantripCopy.status}: ${errOf(cantripCopy)})`);
  const unknown = await backupWizard('WizBackupUnknown');
  const unknownCopy = await req('POST', `/api/character/${unknown}/spellbook-backup`, { spellName: 'Not A Spell' });
  check(unknownCopy.status === 400 && errOf(unknownCopy).includes('not in the spell catalog'),
    `copying an unknown spell into the backup refuses (got ${unknownCopy.status}: ${errOf(unknownCopy)})`);
  const cure = await backupWizard('WizBackupCure');
  const cureCopy = await req('POST', `/api/character/${cure}/spellbook-backup`, { spellName: 'Cure Wounds' });
  check(cureCopy.status === 400 && errOf(cureCopy).includes('Cure Wounds'),
    `copying a non-wizard spell into the backup refuses (got ${cureCopy.status}: ${errOf(cureCopy)})`);
  const poor = await backupWizard('WizBackupPoor', 10);
  const poorCopy = await req('POST', `/api/character/${poor}/spellbook-backup`, { spellName: 'Fireball' });
  check(poorCopy.status === 400 && errOf(poorCopy).includes('gold_gp') && errOf(poorCopy).includes('80'),
    `copying into the backup with 10 gp against an 80 gp cost refuses naming gold_gp (got ${poorCopy.status}: ${errOf(poorCopy)})`);
  check(Number((await readCharacter(poor)).gold_gp) === 10, 'insufficient-gold refusal left gold at 10');
  const lost = await backupWizard('WizBackupLost');
  await req('POST', `/api/character/${lost}/spellbook-status`, { status: 'lost' });
  const lostCopy = await req('POST', `/api/character/${lost}/spellbook-backup`, { spellName: 'Fireball' });
  check(lostCopy.status === 400 && errOf(lostCopy).includes('lost'),
    `copying into the backup with a lost book refuses (got ${lostCopy.status}: ${errOf(lostCopy)})`);
  const cleric = await makeCharacter({ name: 'ClericBackup', cls: 'cleric', level: 5, intScores: INT3_SCORES });
  const clericCopy = await req('POST', `/api/character/${cleric}/spellbook-backup`, { spellName: 'Bless' });
  check(clericCopy.status === 400 && errOf(clericCopy).includes('wizard levels'),
    `copying into a backup as a non-wizard refuses (got ${clericCopy.status}: ${errOf(clericCopy)})`);
  const noName = await req('POST', `/api/character/${wiz5}/spellbook-backup`, {});
  check(noName.status === 400 && errOf(noName).includes('spellName is required'), 'a backup copy with no spell name refuses');

  // Restore: the new main book becomes the FULL backup contents,
  // cost 0, prepared spells outside the backup are dropped (named).
  const PREPARED8 = ['Magic Missile', 'Shield', 'Mage Armor', 'Sleep', 'Misty Step', 'Fireball', 'Burning Hands', 'Thunderwave'];
  const BACKUP6 = ['Magic Missile', 'Shield', 'Mage Armor', 'Sleep', 'Misty Step', 'Fireball'];
  const rest = await backupWizard('WizRestore');
  await seedBook(rest, REPLACE_BOOK12);
  await seedStoredPrepared(rest, PREPARED8);
  for (const s of BACKUP6) {
    const c = await req('POST', `/api/character/${rest}/spellbook-backup`, { spellName: s });
    check(c.status === 200, `backup copy of ${s} succeeds (got ${c.status}: ${errOf(c)})`);
  }
  check(Number((await readCharacter(rest)).gold_gp) === 360, 'six backup copies cost 140 gp (90 transcription + 50 for the blank backup book, 500 -> 360)');
  await req('POST', `/api/character/${rest}/spellbook-status`, { status: 'lost' });
  const restHourBefore = await clockHour();
  const restored = await req('POST', `/api/character/${rest}/spellbook-replace`, { source: 'backup' });
  check(restored.status === 200, `restoring from the backup succeeds (got ${restored.status}: ${errOf(restored)})`);
  check(restored.json?.replacement?.source === 'backup', 'the response names the backup source');
  check(JSON.stringify(restored.json?.replacement?.spells) === JSON.stringify(BACKUP6), 'the new book is exactly the full backup contents');
  check(restored.json?.replacement?.goldSpent === 0 && restored.json?.replacement?.goldRemaining === 360, 'restoring from a backup costs 0 gp');
  check(restored.json?.replacement?.bookCostCharged === 0, 'restoring from a backup charges no book cost');
  check(restored.json?.replacement?.hoursAdvanced === 0 && restored.json?.replacement?.clockAdvanced === false, 'restoring from a backup advances no clock');
  check(JSON.stringify(restored.json?.replacement?.droppedPrepared) === JSON.stringify(['Burning Hands', 'Thunderwave']),
    'the response names the two prepared spells dropped from the backup-less list');
  check(JSON.stringify(await readBook(rest)) === JSON.stringify(BACKUP6), 'the book is now the backup contents');
  check(JSON.stringify(await readPrepared(rest)) === JSON.stringify(BACKUP6), 'the prepared list dropped to the backup contents');
  check(Number((await readCharacter(rest)).gold_gp) === 360, 'no gold moved on the restore');
  check((await clockHour()) === restHourBefore, 'the clock did not move on the restore');
  check((await readSpellbookJson(rest)).status === 'intact', 'status is back to intact');
  check((await readSpellbookJson(rest)).replaced === 'backup', 'the state marks the book replaced-from-backup');
  check(JSON.stringify((await readSpellbookJson(rest)).backup) === JSON.stringify(BACKUP6), 'the backup itself is NOT consumed by the restore');
  check((await readInventory(rest)).length === 1, 'the restore added no extra Spellbook row (the backup row remains)');

  // Restore with no backup refuses; restore while intact refuses.
  const noBackup = await backupWizard('WizRestoreNone');
  await req('POST', `/api/character/${noBackup}/spellbook-status`, { status: 'lost' });
  const noBackupRestore = await req('POST', `/api/character/${noBackup}/spellbook-replace`, { source: 'backup' });
  check(noBackupRestore.status === 400 && errOf(noBackupRestore).includes('no backup'),
    `restoring with no backup refuses (got ${noBackupRestore.status}: ${errOf(noBackupRestore)})`);
  check((await readSpellbookJson(noBackup)).status === 'lost', 'the refused restore left the book lost');
  const intact = await backupWizard('WizRestoreIntact');
  const intactRestore = await req('POST', `/api/character/${intact}/spellbook-replace`, { source: 'backup' });
  check(intactRestore.status === 400 && errOf(intactRestore).includes('not lost'),
    `restoring an intact book refuses (got ${intactRestore.status}: ${errOf(intactRestore)})`);

  // A gated always-prepared pick outside the backup is dropped from
  // the pick list on a restore (named) — it cannot be prepared from
  // a book that does not hold it.
  const BOOK22 = ['Magic Missile', 'Shield', 'Mage Armor', 'Sleep', 'Burning Hands', 'Thunderwave',
    'Detect Magic', 'Feather Fall', 'Misty Step', 'Fireball', 'Counterspell', 'Dispel Magic',
    'Invisibility', 'Mirror Image', 'Scorching Ray', 'Web', 'Chromatic Orb', 'Grease',
    'Identify', 'Comprehend Languages', 'Alarm', 'False Life'];
  const wiz18 = await makeCharacter({ name: 'WizRestoreMastery', cls: 'wizard', level: 18, intScores: INT3_SCORES });
  await seedBook(wiz18, BOOK22);
  await seedStoredPrepared(wiz18, BOOK22.slice(0, 20));
  await db.dbRun('UPDATE characters SET gold_gp = ? WHERE id = ?', [500, wiz18]);
  const mastery = await req('POST', `/api/character/${wiz18}/spellbook-always-prepared`, { mastery: ['Fireball'] });
  check(mastery.status === 200, `setting the Mastery pick succeeds (got ${mastery.status}: ${errOf(mastery)})`);
  await req('POST', `/api/character/${wiz18}/spellbook-backup`, { spellName: 'Magic Missile' });
  await req('POST', `/api/character/${wiz18}/spellbook-backup`, { spellName: 'Shield' });
  await req('POST', `/api/character/${wiz18}/spellbook-status`, { status: 'lost' });
  const masteryRestored = await req('POST', `/api/character/${wiz18}/spellbook-replace`, { source: 'backup' });
  check(masteryRestored.status === 200, `restoring the L18 wizard from backup succeeds (got ${masteryRestored.status}: ${errOf(masteryRestored)})`);
  check(JSON.stringify(masteryRestored.json?.replacement?.spells) === JSON.stringify(['Magic Missile', 'Shield']),
    'the L18 new book is the backup contents');
  check(JSON.stringify(masteryRestored.json?.replacement?.droppedAlwaysPrepared) === JSON.stringify(['Fireball']),
    'the response names the Mastery pick dropped from the backup-less list');
  check(JSON.stringify((await readSpellbookJson(wiz18)).mastery) === JSON.stringify([]), 'the Mastery pick is gone from spellbook_json after the restore');
  check(JSON.stringify(await readPrepared(wiz18)) === JSON.stringify(['Magic Missile', 'Shield']), 'the L18 prepared list dropped to the backup contents');
}

// ===========================================================================
// (n) Replace refusals: not lost, not wizard, empty prepared, short
// gold (exact numbers), corrupt prepared rows, unknown source
// ===========================================================================
group('(n) spellbook-replace refusals');
{
  async function mkWizard(name, { gold = 500, prepared = REPLACE_PREPARED9, book = REPLACE_BOOK12 } = {}) {
    const id = await makeCharacter({ name, cls: 'wizard', level: 5, intScores: INT4_SCORES });
    await seedBook(id, book);
    await seedStoredPrepared(id, prepared);
    await db.dbRun('UPDATE characters SET gold_gp = ? WHERE id = ?', [gold, id]);
    return id;
  }
  async function lose(id) {
    const r = await req('POST', `/api/character/${id}/spellbook-status`, { status: 'lost' });
    assert(r.status === 200, `fixture: losing the book succeeds (got ${r.status}: ${errOf(r)})`);
  }

  const intact = await mkWizard('WizRefIntact');
  const intactR = await req('POST', `/api/character/${intact}/spellbook-replace`, {});
  check(intactR.status === 400 && errOf(intactR).includes('not lost'),
    `replacing an intact book refuses (got ${intactR.status}: ${errOf(intactR)})`);
  check(JSON.stringify(await readBook(intact)) === JSON.stringify(REPLACE_BOOK12), 'the refused replace left the book unchanged');
  check(Number((await readCharacter(intact)).gold_gp) === 500, 'the refused replace left gold at 500');

  const cleric = await makeCharacter({ name: 'ClericReplace', cls: 'cleric', level: 5, intScores: INT3_SCORES });
  const clericR = await req('POST', `/api/character/${cleric}/spellbook-replace`, {});
  check(clericR.status === 400 && errOf(clericR).includes('wizard levels'),
    `replacing as a non-wizard refuses (got ${clericR.status}: ${errOf(clericR)})`);

  const empty = await mkWizard('WizRefEmpty', { prepared: [] });
  await lose(empty);
  const emptyR = await req('POST', `/api/character/${empty}/spellbook-replace`, {});
  check(emptyR.status === 400 && errOf(emptyR).includes('no prepared spells'),
    `replacing with no prepared spells refuses (got ${emptyR.status}: ${errOf(emptyR)})`);
  check((await readSpellbookJson(empty)).status === 'lost', 'the refused replace left the book lost');

  const poor = await mkWizard('WizRefPoor', { gold: 100 });
  await lose(poor);
  const poorR = await req('POST', `/api/character/${poor}/spellbook-replace`, {});
  check(poorR.status === 400 && errOf(poorR).includes('gold_gp') && errOf(poorR).includes('210') && errOf(poorR).includes('100'),
    `short gold refuses naming 210 needed vs 100 has (got ${poorR.status}: ${errOf(poorR)})`);
  check(Number((await readCharacter(poor)).gold_gp) === 100, 'the refused replace left gold at 100');
  check(JSON.stringify(await readBook(poor)) === JSON.stringify(REPLACE_BOOK12), 'the refused replace left the book unchanged');
  check((await readSpellbookJson(poor)).status === 'lost', 'the refused replace left the book lost');

  // Short gold on a subset names the SUBSET total (two L3 spells =
  // 60 transcription + 50 for the blank book = 110), not the whole
  // prepared list's 210.
  const poorSub = await mkWizard('WizRefPoorSub', { gold: 100 });
  await lose(poorSub);
  const poorSubR = await req('POST', `/api/character/${poorSub}/spellbook-replace`, { spells: ['Fireball', 'Counterspell'] });
  check(poorSubR.status === 400 && errOf(poorSubR).includes('gold_gp') && errOf(poorSubR).includes('110') && errOf(poorSubR).includes('100'),
    `short gold on a subset refuses naming 110 needed vs 100 has (got ${poorSubR.status}: ${errOf(poorSubR)})`);
  check(Number((await readCharacter(poorSub)).gold_gp) === 100, 'the refused subset replace left gold at 100');
  check(JSON.stringify(await readBook(poorSub)) === JSON.stringify(REPLACE_BOOK12), 'the refused subset replace left the book unchanged');
  check((await readSpellbookJson(poorSub)).status === 'lost', 'the refused subset replace left the book lost');

  // Corrupt prepared rows (direct DB writes — a route would refuse
  // the membership break): unknown name, non-wizard spell,
  // uncastable level. Each refuses naming the spell, nothing moves.
  const badRows = [
    { name: 'WizRefUnknown', prepared: [...REPLACE_PREPARED9.slice(0, 8), 'Not A Spell'], match: 'not in the spell catalog', label: 'an unknown prepared spell' },
    { name: 'WizRefCure', prepared: [...REPLACE_PREPARED9.slice(0, 8), 'Cure Wounds'], match: 'Cure Wounds', label: 'a non-wizard prepared spell' },
    { name: 'WizRefWish', prepared: [...REPLACE_PREPARED9.slice(0, 8), 'Wish'], match: 'Wish', label: 'an uncastable-level prepared spell (L9 at wizard L5)' },
  ];
  for (const c of badRows) {
    const id = await mkWizard(c.name, { prepared: c.prepared });
    await lose(id);
    const r = await req('POST', `/api/character/${id}/spellbook-replace`, {});
    check(r.status === 400 && errOf(r).includes(c.match),
      `replacing with ${c.label} refuses 400 (got ${r.status}: ${errOf(r)})`);
    check(JSON.stringify(await readBook(id)) === JSON.stringify(REPLACE_BOOK12), `the refused replace (${c.label}) left the book unchanged`);
    check(Number((await readCharacter(id)).gold_gp) === 500, `the refused replace (${c.label}) left gold at 500`);
    check((await readSpellbookJson(id)).status === 'lost', `the refused replace (${c.label}) left the book lost`);
  }

  // Unknown source (including 'scroll'): the replace route opens no
  // scroll path. The copy route's old scroll refusal is gone —
  // scroll copies live in group (g) — the replace refusal stands.
  const badSource = await mkWizard('WizRefSource');
  await lose(badSource);
  const badSourceR = await req('POST', `/api/character/${badSource}/spellbook-replace`, { source: 'scroll' });
  check(badSourceR.status === 400 && errOf(badSourceR).includes("must be 'memory' or 'backup'"),
    `replacing with source 'scroll' refuses (got ${badSourceR.status}: ${errOf(badSourceR)})`);
  // A spell list on a backup restore refuses — a subset of a backup
  // is meaningless, the backup IS the book.
  const subsetBackup = await mkWizard('WizRefSubsetBackup');
  await lose(subsetBackup);
  const subsetBackupR = await req('POST', `/api/character/${subsetBackup}/spellbook-replace`, { source: 'backup', spells: ['Fireball'] });
  check(subsetBackupR.status === 400 && errOf(subsetBackupR).includes('spells'),
    `a spell list on a backup restore refuses (got ${subsetBackupR.status}: ${errOf(subsetBackupR)})`);
  check((await readSpellbookJson(subsetBackup)).status === 'lost', 'the refused subset restore left the book lost');
  const unknownChar = await req('POST', '/api/character/999999/spellbook-replace', {});
  check(unknownChar.status === 404, `replacing for an unknown character 404s (got ${unknownChar.status})`);
}

// ===========================================================================
// (o) Arcane Recovery — bank + DM short rest (2026-11-08)
// ===========================================================================
// The player banks the pick with POST /:id/arcane-recovery-bank;
// the next DM short rest (applyRest, the real service, called
// directly like rest-time.test.js does) validates it again, applies
// it with the HP write, clears the bank, and sets the used-flag. A
// DM long rest clears the flag; it never consumes the bank. There
// is no L5 gate (Arcane Recovery is L1) and no lost-book gate
// (recovery is slot math, not a prepared change).
group('(o) Arcane Recovery — bank + DM short rest');
{
  const rt = await import(fromRepo('server/services/restTimeService.js'));
  const sched = await import(fromRepo('server/services/scheduleService.js'));
  async function readArcBank(id) {
    const r = await readCharacter(id);
    let s = {};
    try { s = JSON.parse(r.spellbook_json || '{}'); } catch { s = {}; }
    return s.pendingArcaneRecovery ?? null;
  }
  async function readArcFlag(id) {
    const r = await readCharacter(id);
    let s = {};
    try { s = JSON.parse(r.spellbook_json || '{}'); } catch { s = {}; }
    return s.arcaneRecoveryUsed === true;
  }
  async function readUsed(id) {
    const r = await readCharacter(id);
    return JSON.parse(r.spell_slots_used || '{}');
  }
  async function makeSession(characterId) {
    const fbRow = await db.dbGet('SELECT id FROM world_clock WHERE campaign_id IS NULL ORDER BY id LIMIT 1');
    if (!fbRow) {
      await db.dbRun('INSERT INTO world_clock (campaign_id, current_day, current_day_of_year, current_year, current_hour) VALUES (NULL, 1, 1, 1492, 8)');
    }
    const clock = await sched.getClock(null);
    const r = await db.dbRun(
      'INSERT INTO dm_sessions (character_id, game_start_day, game_start_year) VALUES (?, ?, ?)',
      [characterId, clock.dayOfYear, clock.year]);
    return Number(r.lastInsertRowid);
  }
  async function restWizard(name, level = 5) {
    const id = await makeCharacter({ name, cls: 'wizard', level, intScores: INT3_SCORES });
    await seedStoredPrepared(id, COUNTED_8);
    await db.dbRun('UPDATE characters SET current_hp = 10, max_hp = 20, hit_dice = ?, hit_dice_used = ? WHERE id = ?',
      [J({ d6: level }), '{}', id]);
    return id;
  }
  async function seedUsed(id, used) {
    await db.dbRun('UPDATE characters SET spell_slots_used = ? WHERE id = ?', [J(used), id]);
    assert.deepStrictEqual(await readUsed(id), used, 'seeded used slots read back');
  }
  async function bank(id, body) {
    return req('POST', `/api/character/${id}/arcane-recovery-bank`, body);
  }

  // --- bank-time refusals ------------------------------------------------
  const fighter = await makeCharacter({ name: 'FightArcBank', cls: 'fighter', level: 5 });
  const fighterBank = await bank(fighter, { slots: [1] });
  check(fighterBank.status === 400 && errOf(fighterBank).includes('wizard level 1'),
    `banking as a non-wizard refuses (got ${fighterBank.status}: ${errOf(fighterBank)})`);

  const noChar = await bank(999999, { slots: [1] });
  check(noChar.status === 404, `banking for an unknown character 404s (got ${noChar.status})`);
  const noCharDel = await req('DELETE', '/api/character/999999/arcane-recovery-bank');
  check(noCharDel.status === 404, `clearing for an unknown character 404s (got ${noCharDel.status})`);

  const over = await restWizard('WizArcOver');
  await seedUsed(over, { '1': 2, '2': 1 });
  const overBank = await bank(over, { slots: [3, 3] });
  check(overBank.status === 400 && errOf(overBank).includes('over the budget'),
    `banking [3, 3] (total 6) against a L5 budget of 3 refuses (got ${overBank.status}: ${errOf(overBank)})`);
  check(await readArcBank(over) === null, 'a refused bank stores nothing');

  const sixth = await restWizard('WizArcSixth', 11);
  await seedUsed(sixth, { '6': 1 });
  const sixthBank = await bank(sixth, { slots: [6] });
  check(sixthBank.status === 400 && errOf(sixthBank).includes('6th level or higher'),
    `banking a 6th-level slot refuses (got ${sixthBank.status}: ${errOf(sixthBank)})`);

  const unspent = await restWizard('WizArcUnspent');
  const unspentBank = await bank(unspent, { slots: [2] });
  check(unspentBank.status === 400 && errOf(unspentBank).includes('is spent'),
    `banking a level with nothing spent refuses (got ${unspentBank.status}: ${errOf(unspentBank)})`);

  const empty = await restWizard('WizArcEmpty');
  const emptyBank = await bank(empty, {});
  check(emptyBank.status === 400 && errOf(emptyBank).includes('non-empty list'),
    `banking with no slots refuses (got ${emptyBank.status}: ${errOf(emptyBank)})`);

  // --- bank → DM short rest → recovery applied + flag set ---------------
  const wiz5 = await restWizard('WizArc');
  await seedUsed(wiz5, { '1': 2, '2': 1 });
  const session5 = await makeSession(wiz5);
  const banked = await bank(wiz5, { slots: [2, 1] });
  check(banked.status === 200 && JSON.stringify(banked.json?.banked) === JSON.stringify({ slots: [2, 1] }),
    `banking a valid recovery succeeds 200 (got ${banked.status}: ${errOf(banked)})`);
  check(banked.json?.replaced === false, 'a first bank reports replaced: false');
  check(JSON.stringify(await readArcBank(wiz5)) === JSON.stringify({ slots: [2, 1] }),
    'the bank reads back from spellbook_json');
  check((await readCharacter(wiz5)).current_hp === 10, 'banking touches no HP');
  check(JSON.stringify(await readUsed(wiz5)) === JSON.stringify({ '1': 2, '2': 1 }), 'banking touches no used slots');
  const rested = await rt.applyRest({ sessionId: session5, characterId: wiz5, type: 'short', dice: 2 });
  const pcDetail = rested.event.results.find((r) => r.kind === 'pc');
  check(pcDetail?.arcaneRecovery?.applied === true && JSON.stringify(pcDetail.arcaneRecovery.recovered) === JSON.stringify([2, 1]),
    'the DM short rest reports the recovery applied with the recovered levels');
  check(JSON.stringify(await readUsed(wiz5)) === JSON.stringify({ '1': 1 }), 'the used slots dropped from {1: 2, 2: 1} to {1: 1}');
  check(await readArcBank(wiz5) === null, 'the bank is cleared after the rest');
  check(await readArcFlag(wiz5) === true, 'the used-flag is set after the rest');
  const wizRow = await readCharacter(wiz5);
  check(wizRow.current_hp > 10 && wizRow.current_hp <= 20, `the short rest healed via hit dice (10 -> ${wizRow.current_hp})`);
  check(rt.formatTimeEventBlock(rested.event).includes('Arcane Recovery: restored slots of levels 2, 1'),
    'the outcome block narrates the recovery for the DM');

  // --- second short rest: the flag refuses, at bank time AND at rest ---
  const reBank = await bank(wiz5, { slots: [1] });
  check(reBank.status === 400 && errOf(reBank).includes('already been used'),
    `re-banking while the flag is set refuses at bank time (got ${reBank.status}: ${errOf(reBank)})`);
  check(await readArcBank(wiz5) === null, 'the refused re-bank stores nothing');
  // Seeded directly (bypassing the route) the DM path refuses it too.
  await db.dbRun('UPDATE characters SET spellbook_json = ? WHERE id = ?',
    [J({ status: 'intact', mastery: [], signature: [], pendingArcaneRecovery: { slots: [1] }, arcaneRecoveryUsed: true }), wiz5]);
  const second = await rt.applyRest({ sessionId: session5, characterId: wiz5, type: 'short', dice: 2 });
  const secondDetail = second.event.results.find((r) => r.kind === 'pc')?.arcaneRecovery;
  check(secondDetail?.applied === false && String(secondDetail?.reason).includes('already been used'),
    'a banked recovery with the flag set refuses at rest time');
  check(JSON.stringify(await readUsed(wiz5)) === JSON.stringify({ '1': 1 }), 'the refused recovery leaves the slots alone');
  check(await readArcBank(wiz5) === null, 'the refused bank is still cleared');
  check(await readArcFlag(wiz5) === true, 'the flag stays set after the refusal');

  // --- long rest resets the flag; the recovery works again --------------
  const longRested = await rt.applyRest({ sessionId: session5, characterId: wiz5, type: 'long' });
  check(longRested.event.results.find((r) => r.kind === 'pc')?.arcaneRecoveryReset === true,
    'a long rest reports the flag cleared');
  check(await readArcFlag(wiz5) === false, 'the used-flag is gone after the long rest');
  check(await readArcBank(wiz5) === null, 'a long rest with no bank leaves no bank');
  // The bank survives the long rest (it is never consumed by one):
  // bank on a fresh wizard, long rest, and the bank is still there
  // for the next short rest (slots re-spent after it, since the
  // long rest restored them all).
  const longBank = await restWizard('WizArcLongBank');
  await seedUsed(longBank, { '1': 1 });
  const longBankSession = await makeSession(longBank);
  const longBanked = await bank(longBank, { slots: [1] });
  check(longBanked.status === 200, `banking before the long rest succeeds (got ${longBanked.status}: ${errOf(longBanked)})`);
  const longBankRest = await rt.applyRest({ sessionId: longBankSession, characterId: longBank, type: 'long' });
  check(JSON.stringify(await readArcBank(longBank)) === JSON.stringify({ slots: [1] }),
    'a long rest leaves the bank for the next short rest');
  check(longBankRest.event.results.find((r) => r.kind === 'pc')?.arcaneRecoveryReset === undefined,
    'a long rest with no flag set reports no reset');
  await seedUsed(longBank, { '1': 1 });
  const again = await rt.applyRest({ sessionId: longBankSession, characterId: longBank, type: 'short', dice: 2 });
  check(again.event.results.find((r) => r.kind === 'pc')?.arcaneRecovery?.applied === true,
    'after the long rest the recovery works again');
  check(JSON.stringify(await readUsed(longBank)) === JSON.stringify({}), 'the re-applied recovery restored the slot');
  check(await readArcFlag(longBank) === true, 'the flag is set again after the second recovery');

  // --- body shapes: levels alias + arcaneRecovery wrapper ---------------
  const alias = await restWizard('WizArcAlias');
  await seedUsed(alias, { '1': 1, '2': 1 });
  const levelsBank = await bank(alias, { levels: [1] });
  check(levelsBank.status === 200 && JSON.stringify(levelsBank.json?.banked) === JSON.stringify({ slots: [1] }),
    'the { levels: [...] } alias banks as { slots: [...] }');
  const wrapBank = await bank(alias, { arcaneRecovery: { slots: [2] } });
  check(wrapBank.status === 200 && wrapBank.json?.replaced === true
    && JSON.stringify(await readArcBank(alias)) === JSON.stringify({ slots: [2] }),
    'a second bank via the { arcaneRecovery: {...} } wrapper replaces the first (one pending recovery max)');
  const cleared = await req('DELETE', `/api/character/${alias}/arcane-recovery-bank`);
  check(cleared.status === 200 && cleared.json?.cleared === true, 'DELETE clears a banked recovery');
  check(await readArcBank(alias) === null, 'the bank is gone after DELETE');
  const clearedAgain = await req('DELETE', `/api/character/${alias}/arcane-recovery-bank`);
  check(clearedAgain.status === 200 && clearedAgain.json?.cleared === false, 'DELETE with no bank reports cleared: false');

  // --- a lost book does NOT block recovery (slot math, not a prepared change) ---
  const lost = await restWizard('WizArcLost');
  await seedUsed(lost, { '1': 1 });
  await req('POST', `/api/character/${lost}/spellbook-status`, { status: 'lost' });
  const lostBank = await bank(lost, { slots: [1] });
  check(lostBank.status === 200, `banking with a lost book succeeds — no lost-book gate (got ${lostBank.status}: ${errOf(lostBank)})`);
  const lostSession = await makeSession(lost);
  const lostRest = await rt.applyRest({ sessionId: lostSession, characterId: lost, type: 'short', dice: 2 });
  check(lostRest.event.results.find((r) => r.kind === 'pc')?.arcaneRecovery?.applied === true,
    'a wizard with a lost book still recovers the slots on the next short rest');
  check(JSON.stringify(await readUsed(lost)) === JSON.stringify({}), 'the lost-book recovery restored the slot');

  // --- multiclass: wizard levels only (fighter 5 / wizard 1 → budget 1) ---
  const multi = await makeCharacter({
    name: 'WizArcMulti', cls: 'wizard', level: 6, intScores: INT3_SCORES,
    classLevels: [{ class: 'fighter', level: 5 }, { class: 'wizard', level: 1 }],
  });
  await db.dbRun('UPDATE characters SET current_hp = 10, max_hp = 20, hit_dice = ?, hit_dice_used = ? WHERE id = ?',
    [J({ d6: 1, d10: 5 }), '{}', multi]);
  await seedUsed(multi, { '1': 1 });
  const multiOver = await bank(multi, { slots: [1, 1] });
  check(multiOver.status === 400 && errOf(multiOver).includes('over the budget'),
    `fighter 5 / wizard 1 banking [1, 1] (total 2) refuses on the wizard-only budget of 1 (got ${multiOver.status}: ${errOf(multiOver)})`);
  const multiOk = await bank(multi, { slots: [1] });
  check(multiOk.status === 200, `the same wizard banking [1] (total 1) succeeds (got ${multiOk.status}: ${errOf(multiOk)})`);
  const multiSession = await makeSession(multi);
  const multiRest = await rt.applyRest({ sessionId: multiSession, characterId: multi, type: 'short', dice: 2 });
  check(multiRest.event.results.find((r) => r.kind === 'pc')?.arcaneRecovery?.applied === true,
    'the multiclass recovery applies on the DM short rest');
  check(JSON.stringify(await readUsed(multi)) === JSON.stringify({}), 'the multiclass recovery restored the slot');

  // --- warlock-primary wizard: pact reset + banked recovery STACK (2026-11-08 follow-ups, D2) ---
  // The old warlock refusal is gone: a warlock 3 / wizard 3 banks
  // [1] via the route, and the DM short rest returns the 2x L2 pact
  // slots AND restores the L1 wizard slot in the same UPDATE.
  const stack = await makeCharacter({
    name: 'WizArcStack', cls: 'warlock', level: 6, intScores: INT3_SCORES,
    classLevels: [{ class: 'warlock', level: 3 }, { class: 'wizard', level: 3 }],
  });
  await db.dbRun('UPDATE characters SET current_hp = 10, max_hp = 20, hit_dice = ?, hit_dice_used = ? WHERE id = ?',
    [J({ d6: 3, d8: 3 }), '{}', stack]);
  await seedUsed(stack, { '1': 1, '2': 2 });
  const stackSession = await makeSession(stack);
  const stackBank = await bank(stack, { slots: [1] });
  check(stackBank.status === 200, `banking [1] as a warlock-primary wizard succeeds (got ${stackBank.status}: ${errOf(stackBank)})`);
  const stackRest = await rt.applyRest({ sessionId: stackSession, characterId: stack, type: 'short', dice: 2 });
  const stackDetail = stackRest.event.results.find((r) => r.kind === 'pc');
  check(stackDetail?.slotsRestored === true, 'the stacking short rest reports pact slots restored');
  check(stackDetail?.arcaneRecovery?.applied === true && JSON.stringify(stackDetail.arcaneRecovery.recovered) === JSON.stringify([1]),
    'the banked recovery applies on the same short rest as the pact reset');
  check(JSON.stringify(await readUsed(stack)) === JSON.stringify({}), 'pact slots back AND the banked wizard slot back — nothing left spent');
  check(await readArcBank(stack) === null, 'the stacking bank is cleared after the rest');
  check(await readArcFlag(stack) === true, 'the used-flag is set after the stacking recovery');

  // --- replacing a lost book leaves the Arcane bank + flag alone --------
  // (The bank names slot levels, not book spells — replacing the book
  // does not invalidate it. Contrast the Memorize bank, which the
  // replace route clears — pinned in group (l).)
  const rep = await makeCharacter({ name: 'WizArcReplace', cls: 'wizard', level: 5, intScores: INT4_SCORES });
  await seedBook(rep, REPLACE_BOOK12);
  await seedStoredPrepared(rep, REPLACE_PREPARED9);
  await db.dbRun('UPDATE characters SET gold_gp = ?, spell_slots_used = ? WHERE id = ?', [500, J({ '1': 1 }), rep]);
  const repBank = await bank(rep, { slots: [1] });
  check(repBank.status === 200, `banking before the replacement succeeds (got ${repBank.status}: ${errOf(repBank)})`);
  await db.dbRun('UPDATE characters SET spellbook_json = ? WHERE id = ?',
    [J({ status: 'intact', mastery: [], signature: [], pendingArcaneRecovery: { slots: [1] }, arcaneRecoveryUsed: true }), rep]);
  await req('POST', `/api/character/${rep}/spellbook-status`, { status: 'lost' });
  check(JSON.stringify(await readArcBank(rep)) === JSON.stringify({ slots: [1] }) && (await readArcFlag(rep)) === true,
    'flipping the book to lost preserves the bank + flag');
  const repReplaced = await req('POST', `/api/character/${rep}/spellbook-replace`, {});
  check(repReplaced.status === 200, `the replacement succeeds with the Arcane bank live (got ${repReplaced.status}: ${errOf(repReplaced)})`);
  check(JSON.stringify(await readArcBank(rep)) === JSON.stringify({ slots: [1] }),
    'the replacement leaves the Arcane bank alone');
  check((await readArcFlag(rep)) === true, 'the replacement leaves the used-flag alone');
}

server.close();
console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
process.exit(failed > 0 ? 1 : 0);
