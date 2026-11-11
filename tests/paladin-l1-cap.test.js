// tests/paladin-l1-cap.test.js — paladin prepared-spell cap on the
// character sheet (2026-11-06, Zach's standing fix-as-you-find-it
// permission).
//
// PHB CORRECTION (2026-11-06, 2024 PHB pp. 109-110, verified from
// the book): the old rule this suite pinned — L1 prepares 0 (no
// 1st-level slots) and Cha mod + half level at L2-20 — was the 2014
// rule, and it is retired. The 2024 table reads Prepared Spells 2
// at L1, the L1 Spellcasting text says "To start, choose two level
// 1 Paladin spells", and the count increases "as shown in the
// Prepared Spells column of the Paladin Features table" — the book
// states NO Cha-mod formula. The honest implementation follows the
// printed rule: the table column (2, 3, 4, 5, 6, 6, 7, 7, 9, 10, 10,
// 11, 11, 12, 12, 14, 14, 14, 15, 15 for levels 1-20; the book's
// own example: a level 5 Paladin prepares six spells). A 2024 L1
// paladin HAS two 1st-level slots, so the slot gate is gone for
// paladin. Mechanism (coordinator decision, reversible): fixed
// per-level tables, mirroring the existing Theologian / Profane Soul
// fixed-table arms in getSpellsPrepared — no derived formula.
//
// History: this suite first pinned the sheet/server disagreement
// (sheet >= 1 at L1 vs server 0), then the 2026-11-06 server fix
// that gave paladin its own half-level arm after the slot gate
// (L1 0, L2-20 mod + half level). Both were the 2014 rule; the
// PHB photo read supersedes them, and every group below is
// rewritten to pin the table instead.
//
// Honest integration tests: getSpellsPrepared / getXPToNextLevel are
// imported from the real levelProgression.js, and every PUT/level-up
// case drives the real character router over HTTP on a real throwaway
// DB (the levelup-subclass-prompts / blackguard-validator-wiring
// harness). If levelProgression.js or character.js were deleted, the
// imports fail and the suite fails with them.
//
// Server-enforcement statement (2026-11-06, item 26): the paladin
// prepared-spell validator IS wired into PUT /:id and POST
// /level-up, mirroring the artificer/blackguard blocks (table cap:
// 2 at L1, 3 at L2; oath spells excluded). Groups (c2)/(c3) below
// assert the enforcement: an over-cap list saved on the sheet
// refuses 400 naming preparedSpells and leaves the row unchanged,
// and a level-up with an over-cap stored list refuses 400 with the
// level unchanged. Groups (c4)/(c5) assert the oath-spell exclusion
// on both paths (2026-11-07 verification job); group (c6) asserts
// multiclassing into paladin is never blocked.
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

const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'paladin-l1-cap-test-'));
const tmpDir = repoRoot;
const origCwd = process.cwd();
process.chdir(tmpDir);
delete process.env.TURSO_DATABASE_URL;
delete process.env.TURSO_AUTH_TOKEN;
const fromRepo = (rel) => pathToFileURL(path.join(origCwd, rel)).href;
const readRepo = (rel) => fs.readFileSync(path.join(origCwd, rel), 'utf8');

const db = await import(fromRepo('server/database.js'));
await db.initDatabase();
// The real server function under test — caps come from this, not
// from literals invented in the test.
const { getSpellsPrepared, getXPToNextLevel } = await import(fromRepo('server/config/levelProgression.js'));
// The real validator + oath-spell lookup under test in groups
// (c4)/(c5) — the route calls these, the test pins them directly.
const { validatePreparedSpells: validatePaladinPreparedSpells } = await import(fromRepo('server/services/paladinService.js'));
const { paladinOathSpellsAtLevel } = await import(fromRepo('server/services/subclassService.js'));

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
// with level.
const CHA3_SCORES = { str: 10, dex: 10, con: 14, int: 10, wis: 10, cha: 16 };
const CHA_MOD = 3;

// The 2024 PHB Prepared Spells column (pp. 109-110), levels 1-20.
// The test pins the server/sheet against THIS table, not a formula.
const PALADIN_TABLE = [2, 3, 4, 5, 6, 6, 7, 7, 9, 10, 10, 11, 11, 12, 12, 14, 14, 14, 15, 15];

// Distinct paladin spell names; the PUT path validates the prepared
// count (item 26), not the names themselves.
const PAL_1 = ['Bless'];
const PAL_2 = ['Bless', 'Cure Wounds'];
const PAL_3 = ['Bless', 'Cure Wounds', 'Shield of Faith'];
const PAL_6 = ['Bless', 'Cure Wounds', 'Shield of Faith', 'Command', 'Detect Magic', 'Protection from Evil and Good'];

// Oath spells for a Devotion paladin (PHB 2024, Oath of Devotion
// Spells): L3 Protection from Evil and Good + Shield of Faith.
// DEV_4/5/6 are non-oath paladin spells, so a list of DEV_n plus
// the two oath spells counts as n against the cap.
const DEVOTION_OATH_L3 = ['Protection from Evil and Good', 'Shield of Faith'];
const DEV_4 = ['Bless', 'Cure Wounds', 'Command', 'Detect Magic'];
const DEV_5 = [...DEV_4, 'Divine Favor'];
const DEV_6 = [...DEV_5, 'Heroism'];

async function makeCharacter({ name, cls, level, chaScores = null, classLevels = null }) {
  const created = await req('POST', '/api/character', { name, class: cls, race: 'human' });
  assert(created.status === 201, `fixture POST creates ${name} (${cls}) — got ${created.status}`);
  const id = created.json.id;
  const put = await req('PUT', `/api/character/${id}`, {
    level,
    experience: getXPToNextLevel(level - 1) || 0,
    max_hp: 20,
    current_hp: 20,
    ...(chaScores ? { ability_scores: J(chaScores) } : {}),
    class_levels: J(classLevels || [{ class: cls, level, subclass: null }]),
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

// The sheet's rule, as static-guarded in group (a): the PHB table,
// mod-independent. Group (b) asserts the server's
// getSpellsPrepared agrees with it at every level and mod.
const sheetPaladinRule = (level) => PALADIN_TABLE[level - 1];

// ===========================================================================
// (a) Static guard: the sheet's getMaxPrepared has a table-driven
//     paladin branch (2024 PHB, pp. 109-110) — no L1 -> 0, no formula
// ===========================================================================
group('(a) CharacterSheet getMaxPrepared paladin branch (static guard)');
{
  const sheetSrc = readRepo('client/src/components/CharacterSheet.jsx');
  const fnStart = sheetSrc.indexOf('const getMaxPrepared');
  check(fnStart !== -1, 'CharacterSheet.jsx defines getMaxPrepared');
  const fnEnd = sheetSrc.indexOf('const isPreparedCaster', fnStart);
  const fnSrc = fnEnd !== -1 ? sheetSrc.slice(fnStart, fnEnd) : sheetSrc.slice(fnStart, fnStart + 2000);
  const palStart = fnSrc.indexOf("className === 'paladin'");
  check(palStart !== -1, 'getMaxPrepared has a paladin branch');
  // The table constant lives above getMaxPrepared: L1 value 2, L5
  // value 6 (the book's own example), 20 entries.
  const constIdx = sheetSrc.indexOf('PALADIN_PREPARED_SPELLS');
  check(constIdx !== -1 && constIdx < fnStart,
    'CharacterSheet.jsx defines a PALADIN_PREPARED_SPELLS table above getMaxPrepared');
  const constSrc = sheetSrc.slice(constIdx, sheetSrc.indexOf('\n', constIdx));
  check(constSrc.includes('[2, 3, 4, 5, 6, 6, 7, 7, 9, 10, 10, 11, 11, 12, 12, 14, 14, 14, 15, 15]'),
    'PALADIN_PREPARED_SPELLS is the PHB table (2 at L1, 6 at L5, 20 entries)');
  // Scope to the paladin branch only (up to the artificer branch):
  // the blackguard branch below still carries its own L1 -> 0.
  const artStart = fnSrc.indexOf("className === 'artificer'", palStart);
  const palSrc = artStart !== -1 ? fnSrc.slice(palStart, artStart) : fnSrc.slice(palStart);
  check(palSrc.includes('PALADIN_PREPARED_SPELLS[character.level - 1]'),
    'paladin branch returns the table value by character.level');
  check(!palSrc.includes('if (character.level === 1) return 0'),
    'paladin branch has no L1 -> 0 special case (2024 L1 prepares 2)');
  check(!palSrc.includes('Math.floor(character.level / 2)'),
    'paladin branch uses no half-level formula (the book states none)');
}

// ===========================================================================
// (b) Server/sheet agreement: getSpellsPrepared('paladin', …) is the
//     PHB table at every level, at every mod — mod-independent
// ===========================================================================
group('(b) getSpellsPrepared paladin: the PHB table at every level and mod');
{
  let mismatches = 0;
  for (const mod of [-1, 0, 3, 5]) {
    for (let level = 1; level <= 20; level++) {
      if (getSpellsPrepared('paladin', level, mod) !== PALADIN_TABLE[level - 1]) {
        mismatches++;
        console.error(`  ✗ mod ${mod} level ${level}: getSpellsPrepared=${getSpellsPrepared('paladin', level, mod)}, expected table ${PALADIN_TABLE[level - 1]}`);
      }
    }
  }
  check(mismatches === 0, `getSpellsPrepared('paladin', L1-20, mod) = PHB table at mods [-1, 0, 3, 5] (${mismatches} mismatches)`);
  check(getSpellsPrepared('paladin', 1, CHA_MOD) === 2,
    `spot: server paladin L1 mod +3 is 2 (was 0 under the retired 2014 slot gate)`);
  check(getSpellsPrepared('paladin', 1, -1) === 2,
    'spot: server paladin L1 mod -1 is still 2 (table, not mod-based)');
  check(getSpellsPrepared('paladin', 5, CHA_MOD) === 6,
    `spot: server paladin L5 mod +3 is 6 — the book's own example (was 5 under the retired half-level formula)`);
  check(getSpellsPrepared('paladin', 20, 5) === 15,
    'spot: server paladin L20 mod +5 is 15 (table end)');
  let divergences = 0;
  for (let level = 1; level <= 20; level++) {
    if (getSpellsPrepared('paladin', level, CHA_MOD) !== sheetPaladinRule(level)) divergences++;
  }
  check(divergences === 0,
    `server vs sheet table diverge on ${divergences} of 20 levels (expected 0 — full agreement)`);
}

// ===========================================================================
// (c) Server side: creation paths already cover L1 (cited, not
//     duplicated) — the Stage 4 suite asserts the new table facts
// ===========================================================================
group('(c) L1 server coverage is the Stage 4 suite’s (cited by reference)');
{
  // The Stage 4 suite already asserts both L1 server facts; this
  // guard fails if that suite ever drops them, so the coverage cannot
  // silently vanish. Do not re-drive them here.
  const stage4Src = readRepo('tests/creator-next-stage4.test.js');
  check(stage4Src.includes('paladin sending a prepared spell at L1 accepts a 1-spell list'),
    'Stage 4 suite asserts the creator-validator accepts a 1-spell L1 paladin list (cap 2)');
  check(stage4Src.includes('paladin spellsPrepared is 2 at L1 even at mod +3'),
    'Stage 4 suite asserts GET /api/spells paladin spellsPrepared 2 at L1');
}

group('(c2) PUT /:id enforces the paladin cap (item 26)');
{
  // L1 paladin, Cha +3: the cap is 2 (PHB table). A 1-spell sheet
  // save persists 200, a 2-spell save persists 200, a 3-spell save
  // refuses 400 naming preparedSpells and "at most 2", and the row
  // is unchanged.
  const pal1 = await makeCharacter({ name: 'PalOne', cls: 'paladin', level: 1, chaScores: CHA3_SCORES });
  const one1 = await req('PUT', `/api/character/${pal1}`, { prepared_spells: J(PAL_1) });
  check(one1.status === 200,
    `PUT 1 spell on an L1 paladin (cap 2) persists 200 (got ${one1.status}: ${JSON.stringify(one1.json?.error || '')})`);
  check(JSON.stringify(await readPrepared(pal1)) === JSON.stringify(PAL_1),
    '1-spell L1 PUT stored the list');
  const two1 = await req('PUT', `/api/character/${pal1}`, { prepared_spells: J(PAL_2) });
  check(two1.status === 200,
    `PUT 2 spells on an L1 paladin (cap 2) persists 200 (got ${two1.status}: ${JSON.stringify(two1.json?.error || '')})`);
  check(JSON.stringify(await readPrepared(pal1)) === JSON.stringify(PAL_2),
    '2-spell L1 PUT stored the list');
  const over3 = await req('PUT', `/api/character/${pal1}`, { prepared_spells: J(PAL_3) });
  check(over3.status === 400,
    `PUT 3 spells on an L1 paladin (cap 2) refuses 400 (got ${over3.status})`);
  check(typeof over3.json?.error === 'string' && over3.json.error.includes('preparedSpells') && over3.json.error.includes('at most 2') && over3.json.error.includes('got 3'),
    `L1 PUT refusal names preparedSpells, cap 2, got 3 (got ${JSON.stringify(over3.json?.error)})`);
  check(JSON.stringify(await readPrepared(pal1)) === JSON.stringify(PAL_2),
    'refused 3-spell L1 PUT left the stored prepared list at the 2-spell list');
  // Six spells at L1: wildly over any cap, refused, row unchanged.
  const pal1b = await makeCharacter({ name: 'PalOneB', cls: 'paladin', level: 1, chaScores: CHA3_SCORES });
  const over6 = await req('PUT', `/api/character/${pal1b}`, { prepared_spells: J(PAL_6) });
  check(over6.status === 400, `PUT 6 spells on an L1 paladin refuses 400 (got ${over6.status})`);
  check(typeof over6.json?.error === 'string' && over6.json.error.includes('preparedSpells') && over6.json.error.includes('got 6'),
    `L1 6-spell refusal counts 6 (got ${JSON.stringify(over6.json?.error)})`);
  check(JSON.stringify(await readPrepared(pal1b)) === JSON.stringify([]),
    'refused 6-spell L1 PUT left the stored prepared list empty');
}

group('(c3) Level-up re-checks the paladin list (item 26)');
{
  // Paladin L1 -> L2, Cha +3, with 6 spells stored: over the L2 cap
  // of 3 (PHB table). The level stays 1 and the stored list is
  // unchanged.
  const pal = await makeCharacter({ name: 'PalLevel', cls: 'paladin', level: 1, chaScores: CHA3_SCORES });
  await db.dbRun('UPDATE characters SET experience = ? WHERE id = ?', [getXPToNextLevel(1), pal]);
  await seedStoredPrepared(pal, PAL_6);
  const up = await req('POST', `/api/character/level-up/${pal}`, {});
  check(up.status === 400,
    `level-up L1->2 with 6 stored spells (L2 cap 3) refuses 400 (got ${up.status}: ${JSON.stringify(up.json?.error || '')})`);
  check(typeof up.json?.error === 'string' && up.json.error.includes('preparedSpells'),
    `level-up refusal names preparedSpells (got ${JSON.stringify(up.json?.error)})`);
  const row = await readCharacter(pal);
  check(row.level === 1, 'refused level-up left the level at 1');
  check(JSON.stringify(JSON.parse(row.prepared_spells)) === JSON.stringify(PAL_6),
    'refused level-up left the over-cap stored prepared list unchanged');
  // An at-cap stored list levels up cleanly: 3 spells at L2 cap 3.
  const palOk = await makeCharacter({ name: 'PalLevelOk', cls: 'paladin', level: 1, chaScores: CHA3_SCORES });
  await db.dbRun('UPDATE characters SET experience = ? WHERE id = ?', [getXPToNextLevel(1), palOk]);
  await seedStoredPrepared(palOk, PAL_3);
  const upOk = await req('POST', `/api/character/level-up/${palOk}`, {});
  check(upOk.status === 200,
    `level-up L1->2 with 3 stored spells (L2 cap 3) succeeds 200 (got ${upOk.status}: ${JSON.stringify(upOk.json?.error || '')})`);
  check((await readCharacter(palOk)).level === 2, 'at-cap level-up raised the level to 2');
}

group('(c4) PUT /:id excludes oath spells from the count (item 26)');
{
  // Devotion paladin L3, Cha +3: the cap is 4 (PHB table). Four
  // non-oath spells PLUS the two L3 oath spells (6 total) count as
  // 4 — the oath spells are always prepared and never count.
  const dev = await makeCharacter({ name: 'PalDev', cls: 'paladin', level: 3, chaScores: CHA3_SCORES, classLevels: [{ class: 'paladin', level: 3, subclass: 'oath_of_devotion' }] });
  const sixList = [...DEV_4, ...DEVOTION_OATH_L3];
  const put6 = await req('PUT', `/api/character/${dev}`, { prepared_spells: J(sixList) });
  check(put6.status === 200,
    `PUT 4 non-oath + 2 oath spells on a Devotion L3 paladin (cap 4) persists 200 (got ${put6.status}: ${JSON.stringify(put6.json?.error || '')})`);
  check(JSON.stringify(await readPrepared(dev)) === JSON.stringify(sixList),
    '4-non-oath + 2-oath L3 PUT stored the full 6-spell list');
  // Five non-oath + 2 oath = 7 total, counted 5 > cap 4: refused.
  const sevenList = [...DEV_5, ...DEVOTION_OATH_L3];
  const over7 = await req('PUT', `/api/character/${dev}`, { prepared_spells: J(sevenList) });
  check(over7.status === 400,
    `PUT 5 non-oath + 2 oath spells on a Devotion L3 paladin (cap 4) refuses 400 (got ${over7.status})`);
  check(typeof over7.json?.error === 'string' && over7.json.error.includes('preparedSpells') && over7.json.error.includes('at most 4') && over7.json.error.includes('got 5'),
    `L3 PUT refusal names preparedSpells, cap 4, got 5 (got ${JSON.stringify(over7.json?.error)})`);
  check(JSON.stringify(await readPrepared(dev)) === JSON.stringify(sixList),
    'refused 5-non-oath L3 PUT left the stored prepared list at the 6-spell list');
  // Service-level pin: the exclusion canonicalizes both sides — a
  // print-spelled oath spell ('Create Food or Water', Oath of
  // Charity L9) is excluded even though the data carries the catalog
  // spelling ('Create Food and Water').
  const charity9 = paladinOathSpellsAtLevel('paladin', 'Oath of Charity', 9);
  check(Array.isArray(charity9) && charity9.includes('Create Food and Water'),
    'Charity L9 oath list carries the catalog spelling Create Food and Water');
  const canonCheck = validatePaladinPreparedSpells(3, 9, [...DEV_5, 'Create Food or Water'], charity9);
  check(canonCheck.counted === 5,
    `print-spelled oath spell excluded from the count (counted ${canonCheck.counted}, expected 5)`);
  check(canonCheck.ok === true,
    'print-spelled oath spell list is within the L9 cap of 9');
  const canonControl = validatePaladinPreparedSpells(3, 9, [...DEV_5, 'Heroism'], charity9);
  check(canonControl.counted === 6,
    `a 6th non-oath spell counts (counted ${canonControl.counted}, expected 6)`);
}

group('(c5) Level-up re-check excludes oath spells (item 26)');
{
  // Devotion L3 -> L4, Cha +3, with 5 non-oath + 2 oath stored
  // (7 total, counted 5 = L4 cap 5): levels up cleanly.
  const dev = await makeCharacter({ name: 'PalDevUp', cls: 'paladin', level: 3, chaScores: CHA3_SCORES, classLevels: [{ class: 'paladin', level: 3, subclass: 'oath_of_devotion' }] });
  await db.dbRun('UPDATE characters SET experience = ? WHERE id = ?', [getXPToNextLevel(3), dev]);
  const stored7 = [...DEV_5, ...DEVOTION_OATH_L3];
  await seedStoredPrepared(dev, stored7);
  const up = await req('POST', `/api/character/level-up/${dev}`, {});
  check(up.status === 200,
    `level-up L3->4 with 5 non-oath + 2 oath stored (counted 5 = L4 cap 5) succeeds 200 (got ${up.status}: ${JSON.stringify(up.json?.error || '')})`);
  check((await readCharacter(dev)).level === 4, 'oath-excluded level-up raised the level to 4');
  check(JSON.stringify(await readPrepared(dev)) === JSON.stringify(stored7),
    'oath-excluded level-up left the 7-spell stored list unchanged');
  // Control: 6 non-oath + 2 oath (counted 6 > L4 cap 5) refuses.
  const dev2 = await makeCharacter({ name: 'PalDevUp2', cls: 'paladin', level: 3, chaScores: CHA3_SCORES, classLevels: [{ class: 'paladin', level: 3, subclass: 'oath_of_devotion' }] });
  await db.dbRun('UPDATE characters SET experience = ? WHERE id = ?', [getXPToNextLevel(3), dev2]);
  const stored8 = [...DEV_6, ...DEVOTION_OATH_L3];
  await seedStoredPrepared(dev2, stored8);
  const up2 = await req('POST', `/api/character/level-up/${dev2}`, {});
  check(up2.status === 400,
    `level-up L3->4 with 6 non-oath + 2 oath stored (counted 6 > L4 cap 5) refuses 400 (got ${up2.status}: ${JSON.stringify(up2.json?.error || '')})`);
  check(typeof up2.json?.error === 'string' && up2.json.error.includes('preparedSpells'),
    `oath-excluded level-up refusal names preparedSpells (got ${JSON.stringify(up2.json?.error)})`);
  check((await readCharacter(dev2)).level === 3, 'refused oath-excluded level-up left the level at 3');
  check(JSON.stringify(await readPrepared(dev2)) === JSON.stringify(stored8),
    'refused oath-excluded level-up left the 8-spell stored list unchanged');
}

group('(c6) Multiclassing into paladin is never blocked (item 26)');
{
  // (i) PUT: a fighter-primary character's prepared list is not
  // governed by the paladin cap — 6 spells persist 200.
  const fig = await makeCharacter({ name: 'FigMulti', cls: 'fighter', level: 1, chaScores: CHA3_SCORES });
  const put6 = await req('PUT', `/api/character/${fig}`, { prepared_spells: J(PAL_6) });
  check(put6.status === 200,
    `PUT 6 spells on a fighter-primary character persists 200 (got ${put6.status}: ${JSON.stringify(put6.json?.error || '')})`);
  check(JSON.stringify(await readPrepared(fig)) === JSON.stringify(PAL_6),
    'fighter-primary 6-spell PUT stored the list');
  // (ii) Same, with paladin as the SECONDARY class: the shared
  // prepared_spells column is governed by the primary class's editor.
  await db.dbRun('UPDATE characters SET class_levels = ? WHERE id = ?', [J([{ class: 'fighter', level: 1, subclass: null }, { class: 'paladin', level: 1, subclass: null }]), fig]);
  const put6b = await req('PUT', `/api/character/${fig}`, { prepared_spells: J(PAL_6) });
  check(put6b.status === 200,
    `PUT 6 spells on a fighter-primary / paladin-secondary character persists 200 (got ${put6b.status}: ${JSON.stringify(put6b.json?.error || '')})`);
  check(JSON.stringify(await readPrepared(fig)) === JSON.stringify(PAL_6),
    'fighter-primary / paladin-secondary 6-spell PUT stored the list');
  // (iii) Level-up INTO paladin with an over-cap stored list: the
  // paladin re-check is skipped for multiclassing (the stored list
  // belongs to the other class), so the level-up succeeds.
  const fig2 = await makeCharacter({ name: 'FigMultiUp', cls: 'fighter', level: 1, chaScores: CHA3_SCORES });
  await db.dbRun('UPDATE characters SET experience = ? WHERE id = ?', [getXPToNextLevel(1), fig2]);
  await seedStoredPrepared(fig2, PAL_6);
  const up = await req('POST', `/api/character/level-up/${fig2}`, { selectedClass: 'paladin' });
  check(up.status === 200,
    `level-up fighter L1 -> paladin L1 with 6 stored spells succeeds 200 (got ${up.status}: ${JSON.stringify(up.json?.error || '')})`);
  const row = await readCharacter(fig2);
  check(row.level === 2, 'multiclass level-up raised the total level to 2');
  const levels = JSON.parse(row.class_levels || '[]');
  check(levels.some((e) => String(e?.class ?? '').toLowerCase() === 'paladin' && Number(e?.level) === 1),
    'multiclass level-up added paladin at level 1');
  check(JSON.stringify(await readPrepared(fig2)) === JSON.stringify(PAL_6),
    'multiclass level-up left the 6-spell stored list unchanged');
}

server.close();
console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
process.exit(failed > 0 ? 1 : 0);
