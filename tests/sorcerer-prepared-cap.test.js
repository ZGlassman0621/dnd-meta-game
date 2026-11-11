// tests/sorcerer-prepared-cap.test.js — sorcerer prepared-spell cap
// (2026-11-06 PHB reconciliation, 2024 PHB photos).
//
// What changed: sorcerers PREPARE in 2024 — the 2024 PHB Sorcerer
// Features table carries a fixed "Prepared Spells" column, 2 at 1st
// -> 22 at 20th, and the L1 Spellcasting text states NO formula.
// The old model (known caster, SPELLS_KNOWN row, Cha-mod formula)
// is gone: 'sorcerer' is in PREPARED_CASTERS, the SORCERER_SPELLS_PREPARED
// table governs getSpellsPrepared, sorcererService.preparedSpellsMax /
// validatePreparedSpells enforce the cap (subclass spells always
// prepared and excluded), the PUT + level-up validators refuse
// over-cap lists, and the sheet's SORCERER_PREPARED table agrees.
//
// Honest integration tests: getSpellsPrepared / getSpellsKnown /
// SPELLS_KNOWN are imported from the real levelProgression.js,
// preparedSpellsMax from the real sorcererService.js, and every
// PUT/level-up case drives the real character router over HTTP on a
// real throwaway DB (the paladin-l1-cap harness). If
// levelProgression.js, sorcererService.js, or character.js were
// deleted, the imports fail and the suite fails with them. The PHB
// table below is the external truth (photographed 2026-11-06); both
// the server arm and the sheet table are asserted against it, so a
// drift in either trips this suite.
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

const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sorcerer-prepared-cap-test-'));
const tmpDir = repoRoot;
const origCwd = process.cwd();
process.chdir(tmpDir);
delete process.env.TURSO_DATABASE_URL;
delete process.env.TURSO_AUTH_TOKEN;
const fromRepo = (rel) => pathToFileURL(path.join(origCwd, rel)).href;
const readRepo = (rel) => fs.readFileSync(path.join(origCwd, rel), 'utf8');

const db = await import(fromRepo('server/database.js'));
await db.initDatabase();
// The real server functions under test — caps come from these, not
// from literals invented in the test (the PHB table below is the
// photographed book truth both arms are checked against).
const { getSpellsPrepared, getSpellsKnown, SPELLS_KNOWN, getXPToNextLevel } = await import(fromRepo('server/config/levelProgression.js'));
const { preparedSpellsMax } = await import(fromRepo('server/services/sorcererService.js'));

// 2024 PHB Sorcerer Features table, Prepared Spells column, L1->20.
// No formula — fixed table, mod-independent.
const PHB_PREPARED = [2, 4, 6, 7, 9, 10, 11, 12, 14, 15, 16, 16, 17, 17, 18, 18, 19, 20, 21, 22];

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

// Cha +3 (score 16) at every level used below. The cap must NOT move
// with it — that is the point of the fixed table.
const CHA3_SCORES = { str: 10, dex: 10, con: 14, int: 10, wis: 10, cha: 16 };

// Distinct sorcerer spell names; the PUT/level-up paths validate the
// prepared count, not the names themselves.
const SORC_2 = ['Magic Missile', 'Shield'];
const SORC_3 = ['Magic Missile', 'Shield', 'Burning Hands'];
const SORC_6 = ['Magic Missile', 'Shield', 'Burning Hands', 'Sleep', 'Mage Armor', 'Thunderwave'];
const SORC_7 = [...SORC_6, 'Scorching Ray'];
// Draconic L3 always-prepared spells — excluded from the counted total.
const DRA_ALWAYS = ['Alter Self', 'Chromatic Orb', 'Command', "Dragon's Breath"];

async function makeCharacter({ name, cls, level, chaScores = null, subclass = null }) {
  const created = await req('POST', '/api/character', { name, class: cls, race: 'human' });
  assert(created.status === 201, `fixture POST creates ${name} (${cls}) — got ${created.status}`);
  const id = created.json.id;
  const put = await req('PUT', `/api/character/${id}`, {
    level,
    experience: getXPToNextLevel(level - 1) || 0,
    max_hp: 20,
    current_hp: 20,
    ...(chaScores ? { ability_scores: J(chaScores) } : {}),
    class_levels: J([{ class: cls, level, subclass }]),
  });
  assert(put.status === 200, `fixture PUT sets ${name} to level ${level} — got ${put.status}: ${JSON.stringify(put.json?.error || '')}`);
  return id;
}

// Seed a stored prepared list directly — bypasses the route on purpose,
// like a row written before this build existed.
async function seedStoredPrepared(id, list) {
  await db.dbRun('UPDATE characters SET prepared_spells = ? WHERE id = ?', [J(list), id]);
  const back = await readPrepared(id);
  assert.deepStrictEqual(back, list, 'seeded stored prepared list reads back');
}

// ===========================================================================
// (a) The fixed PHB table: getSpellsPrepared('sorcerer', L, mod) at
//     every level 1-20 and every mod — no formula, no mod dependence
// ===========================================================================
group('(a) getSpellsPrepared sorcerer is the PHB fixed table at every level and mod');
{
  for (const mod of [-1, 0, 3, 5]) {
    let mismatches = 0;
    for (let level = 1; level <= 20; level++) {
      if (getSpellsPrepared('sorcerer', level, mod) !== PHB_PREPARED[level - 1]) {
        mismatches++;
        console.error(`  ✗ mod ${mod} level ${level}: getSpellsPrepared=${getSpellsPrepared('sorcerer', level, mod)}, expected ${PHB_PREPARED[level - 1]}`);
      }
    }
    check(mismatches === 0, `getSpellsPrepared('sorcerer', L1-20, mod ${mod}) = PHB table (${mismatches} mismatches)`);
  }
  check(getSpellsPrepared('sorcerer', 1, 5) === 2, 'spot: sorcerer L1 is 2 even at mod +5 (no Cha mod in the rule)');
  check(getSpellsPrepared('sorcerer', 9, -1) === 14, 'spot: sorcerer L9 is 14 even at mod -1');
  check(getSpellsPrepared('sorcerer', 20, 3) === 22, 'spot: sorcerer L20 is 22 at mod +3');
}

// ===========================================================================
// (b) No longer a known caster: getSpellsKnown is null, and the
//     SPELLS_KNOWN row is gone
// ===========================================================================
group('(b) getSpellsKnown sorcerer is null at every level; no SPELLS_KNOWN row');
{
  let nonNull = 0;
  for (let level = 1; level <= 20; level++) {
    if (getSpellsKnown('sorcerer', level) !== null) nonNull++;
  }
  check(nonNull === 0, `getSpellsKnown('sorcerer', level) is null at all 20 levels (${nonNull} non-null)`);
  check(!('sorcerer' in SPELLS_KNOWN), 'SPELLS_KNOWN has no sorcerer row (the 2014 known-spells row is removed)');
}

// ===========================================================================
// (c) Server/sheet agreement: the sheet's SORCERER_PREPARED table
//     equals the server table, and preparedSpellsMax agrees with
//     getSpellsPrepared at every level. L1 creator coverage is the
//     Stage 4 suite's (cited by reference).
// ===========================================================================
group('(c) server/sheet agreement: sheet table = server table = PHB table');
{
  const sheetSrc = readRepo('client/src/components/CharacterSheet.jsx');
  const m = sheetSrc.match(/const SORCERER_PREPARED = \[([^\]]+)\]/);
  check(m !== null, 'CharacterSheet.jsx defines SORCERER_PREPARED');
  const sheetTable = m[1].split(',').map((s) => Number(s.trim()));
  check(sheetTable.length === 20 && sheetTable.every((v, i) => v === PHB_PREPARED[i]),
    'sheet SORCERER_PREPARED equals the PHB table (20 entries, element-wise)');
  check(sheetSrc.includes("if (className === 'sorcerer') return SORCERER_PREPARED[character.level - 1]"),
    'getMaxPrepared has a sorcerer branch reading SORCERER_PREPARED');
  let divergences = 0;
  for (const mod of [-1, 0, 3, 5]) {
    for (let level = 1; level <= 20; level++) {
      if (getSpellsPrepared('sorcerer', level, mod) !== sheetTable[level - 1]) divergences++;
    }
  }
  check(divergences === 0,
    `server vs sheet table diverge on ${divergences} of 80 level/mod combos (expected 0 — full agreement)`);
  let maxMismatches = 0;
  for (let level = 1; level <= 20; level++) {
    if (preparedSpellsMax(level) !== getSpellsPrepared('sorcerer', level, 0)) maxMismatches++;
  }
  check(maxMismatches === 0, `sorcererService.preparedSpellsMax agrees with getSpellsPrepared at all 20 levels (${maxMismatches} mismatches)`);
  // The Stage 4 suite already asserts both L1 server facts; this
  // guard fails if that suite ever drops them, so the coverage cannot
  // silently vanish. Do not re-drive them here.
  const stage4Src = readRepo('tests/creator-next-stage4.test.js');
  check(stage4Src.includes('sorcerer prepared 2 passes'),
    'Stage 4 suite asserts the creator-validator pass (2-spell L1 sorcerer list passes)');
  check(stage4Src.includes('sorcerer prepared 1 refuses the count'),
    'Stage 4 suite asserts the creator-validator refusal (1-spell L1 sorcerer list refuses)');
}

group('(d) PUT /:id enforces the sorcerer cap');
{
  // L1 sorcerer, Cha +3: the cap is 2 — a 3-spell sheet save refuses
  // 400 naming preparedSpells, and the row is unchanged.
  const sorc1 = await makeCharacter({ name: 'SorcOne', cls: 'sorcerer', level: 1, chaScores: CHA3_SCORES });
  const over3 = await req('PUT', `/api/character/${sorc1}`, { prepared_spells: J(SORC_3) });
  check(over3.status === 400,
    `PUT 3 spells on an L1 sorcerer (cap 2) refuses 400 (got ${over3.status})`);
  check(typeof over3.json?.error === 'string' && over3.json.error.includes('preparedSpells') && over3.json.error.includes('at most 2') && over3.json.error.includes('got 3'),
    `L1 PUT refusal names preparedSpells, cap 2, got 3 (got ${JSON.stringify(over3.json?.error)})`);
  check(JSON.stringify(await readPrepared(sorc1)) === JSON.stringify([]),
    'refused L1 PUT left the stored prepared list empty');
  // An at-cap list saves.
  const atCap = await req('PUT', `/api/character/${sorc1}`, { prepared_spells: J(SORC_2) });
  check(atCap.status === 200, `PUT 2 spells on an L1 sorcerer (cap 2) persists 200 (got ${atCap.status})`);
  check(JSON.stringify(await readPrepared(sorc1)) === JSON.stringify(SORC_2),
    'at-cap L1 PUT stored the 2-spell list');
  // Draconic L3 (cap 6): the 4 always-prepared subclass spells do not
  // count — 6 chosen + 4 always-prepared saves, 7 chosen + 4 refuses.
  const drac3 = await makeCharacter({ name: 'SorcDrac', cls: 'sorcerer', level: 3, chaScores: CHA3_SCORES, subclass: 'Draconic Sorcery' });
  const dracOk = await req('PUT', `/api/character/${drac3}`, { prepared_spells: J([...SORC_6, ...DRA_ALWAYS]) });
  check(dracOk.status === 200, `PUT 6 chosen + 4 always-prepared on a Draconic L3 sorcerer (counted 6, cap 6) persists 200 (got ${dracOk.status}: ${JSON.stringify(dracOk.json?.error || '')})`);
  const dracOver = await req('PUT', `/api/character/${drac3}`, { prepared_spells: J([...SORC_7, ...DRA_ALWAYS]) });
  check(dracOver.status === 400,
    `PUT 7 chosen + 4 always-prepared on a Draconic L3 sorcerer (counted 7, cap 6) refuses 400 (got ${dracOver.status})`);
  check(typeof dracOver.json?.error === 'string' && dracOver.json.error.includes('preparedSpells') && dracOver.json.error.includes('at most 6') && dracOver.json.error.includes('got 7'),
    `Draconic over-cap refusal names preparedSpells, cap 6, got 7 (got ${JSON.stringify(dracOver.json?.error)})`);
}

group('(e) Level-up re-checks the sorcerer list');
{
  // Sorcerer L1 -> L2, Cha +3, with 6 spells stored: over the L2 cap
  // of 4. The level stays 1 and the stored list is unchanged.
  const sorc = await makeCharacter({ name: 'SorcLevel', cls: 'sorcerer', level: 1, chaScores: CHA3_SCORES });
  await db.dbRun('UPDATE characters SET experience = ? WHERE id = ?', [getXPToNextLevel(1), sorc]);
  await seedStoredPrepared(sorc, SORC_6);
  const up = await req('POST', `/api/character/level-up/${sorc}`, {});
  check(up.status === 400,
    `level-up L1->2 with 6 stored spells (L2 cap 4) refuses 400 (got ${up.status}: ${JSON.stringify(up.json?.error || '')})`);
  check(typeof up.json?.error === 'string' && up.json.error.includes('preparedSpells'),
    `level-up refusal names preparedSpells (got ${JSON.stringify(up.json?.error)})`);
  const row = await readCharacter(sorc);
  check(row.level === 1, 'refused level-up left the level at 1');
  check(JSON.stringify(JSON.parse(row.prepared_spells)) === JSON.stringify(SORC_6),
    'refused level-up left the over-cap stored prepared list unchanged');
  // An at-cap stored list levels up cleanly: 4 spells at L2 cap 4.
  const sorcOk = await makeCharacter({ name: 'SorcLevelOk', cls: 'sorcerer', level: 1, chaScores: CHA3_SCORES });
  await db.dbRun('UPDATE characters SET experience = ? WHERE id = ?', [getXPToNextLevel(1), sorcOk]);
  await seedStoredPrepared(sorcOk, SORC_6.slice(0, 4));
  const upOk = await req('POST', `/api/character/level-up/${sorcOk}`, {});
  check(upOk.status === 200,
    `level-up L1->2 with 4 stored spells (L2 cap 4) succeeds 200 (got ${upOk.status}: ${JSON.stringify(upOk.json?.error || '')})`);
  check((await readCharacter(sorcOk)).level === 2, 'at-cap level-up raised the level to 2');
}

server.close();
console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
process.exit(failed > 0 ? 1 : 0);
