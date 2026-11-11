// tests/levelup-subclass-prompts.test.js — level-up subclass prompts fire at
// the 2024 levels (Zach, 2026-11-05 23:30 EST, via widget: "Fix the
// level-up prompts too").
//
// The 2024 subclass-level audit corrected the CREATOR to 3rd level for
// cleric, sorcerer, warlock, wizard, and druid (classes.json subclassLevel
// + a creator-local CREATOR_SUBCLASS_LEVELS override in character.js),
// but deliberately left SUBCLASS_LEVELS in server/config/levelProgression.js
// untouched because it drives the level-up flow — so the level-up flow
// kept prompting those five classes at the old 2014 levels (cleric /
// sorcerer / warlock at 1, druid / wizard at 2). This build corrects the
// table itself, which fixes every level-up surface at once:
//   - GET /:id/level-up-info — choices.needsSubclass + subclassLevel
//     (existing-class options AND multiclass options) and the legacy
//     top-level subclassLevel;
//   - POST /:id/level-up — the 422 "Subclass selection required" gate
//     and the subclass write to the legacy top-level field.
// The creator-local override became {...SUBCLASS_LEVELS} with no
// overrides and was removed; the creator wrapper reads SUBCLASS_LEVELS
// directly now (its behavior is unchanged — pinned by the creator
// suites, which must stay green).
//
// Honest integration tests: needsSubclassSelection + SUBCLASS_LEVELS are
// imported from the real levelProgression.js, and the HTTP sections drive
// the real character router over HTTP on a real throwaway DB (the
// stage2-validation-wiring pattern). If levelProgression.js or
// character.js were deleted, the imports fail and the suite fails with
// it. Expected levels are derived from classes.json (the 2024-corrected
// source the audit verified), NOT hardcoded from memory — except the
// five corrected classes, which are pinned by name with their old
// levels, so the correction itself is load-bearing.
//
// Warlord left the known gap 2026-11-06 (gaps-batch item 8b — 8 Presences
// registered, SUBCLASS_LEVELS warlord: 1): it prompts at 1st like
// magus/scholar (coordinator ruling: the 2024 3rd-level rule covers PHB
// classes only; third-party classes follow their own books).
// blood_hunter was the same gap until 2026-11-06, when its 4 Orders were
// registered and it joined SUBCLASS_LEVELS at 3 — see group (a) and
// tests/blood-hunter-subclasses.test.js.
//
// Out of scope, done: CLASS_FEATURES was rebuilt to the 2024 tables
// 2026-11-06 (tests/class-features-2024.test.js, 327 checks) — the
// subclass rows now read '<Class> Subclass' at the selection level
// (all PHB classes at 3rd) and 'Subclass Feature' thereafter, so the
// level-up info's newFeatures list shows the 2024 names at the 2024
// levels. The 5 PHB-photo-verified classes (barbarian, bard, cleric,
// druid, fighter) matched the researched tables exactly; the other 7
// are web-research-only until their PHB photos arrive.
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

const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'levelup-subclass-prompts-test-'));
const tmpDir = repoRoot;
const origCwd = process.cwd();
process.chdir(tmpDir);
delete process.env.TURSO_DATABASE_URL;
delete process.env.TURSO_AUTH_TOKEN;
const fromRepo = (rel) => pathToFileURL(path.join(origCwd, rel)).href;

const db = await import(fromRepo('server/database.js'));
await db.initDatabase();
// The real table + helper, from the real config file.
const { needsSubclassSelection, SUBCLASS_LEVELS } = await import(fromRepo('server/config/levelProgression.js'));
// V8 (2026-11-07): the settled multiclass-into-wizard seed — the
// envelope's wizard option must offer exactly this many book spells.
const { SPELLBOOK_START_SIZE } = await import(fromRepo('server/services/spellbookService.js'));
// The 2024-corrected source the audit verified (all 23 classes).
const classes = (await import(fromRepo('client/src/data/classes.json'), { with: { type: 'json' } })).default;

// --- HTTP harness: the real character router on a real express app ----
const app = express();
app.use(express.json());
const characterRouter = (await import(fromRepo('server/routes/character.js'))).default;
app.use('/api/character', characterRouter);
const server = await new Promise((resolve) => {
  const s = app.listen(0, '127.0.0.1', () => resolve(s));
});
const base = `http://127.0.0.1:${server.address().port}`;
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
async function makeLeveled({ name, cls, level, xp, subclass = null }) {
  // POST with the real route (defaults cover every NOT NULL column),
  // then PUT the level/XP/class_levels the scenario needs. No creator
  // marker, so no creator validation touches these fixtures.
  const created = await req('POST', '/api/character', { name, class: cls, race: 'human' });
  assert(created.status === 201, `fixture POST creates ${name} (${cls}) — got ${created.status}`);
  const id = created.json.id;
  const put = await req('PUT', `/api/character/${id}`, {
    level,
    experience: xp,
    max_hp: 20,
    current_hp: 20,
    subclass,
    class_levels: JSON.stringify([{ class: cls, level, subclass }]),
  });
  assert(put.status === 200, `fixture PUT sets ${name} to level ${level} (${xp} XP) — got ${put.status}`);
  return id;
}
async function readCharacter(id) {
  return db.dbGet('SELECT * FROM characters WHERE id = ?', [id]);
}
function existingOption(info) {
  return info.json.classOptions.find((o) => o.type === 'existing');
}
function multiclassOption(info, cls) {
  return info.json.classOptions.find((o) => o.type === 'multiclass' && o.class.toLowerCase() === cls);
}

// XP thresholds from the real table: L1->2 needs 300, L2->3 needs 900,
// L5->6 needs 14000 (XP_THRESHOLDS in levelProgression.js).
const XP = { to2: 300, to3: 900, to6: 14000 };

// ===========================================================================
// (a) needsSubclassSelection + SUBCLASS_LEVELS — unit, real config import
// ===========================================================================
group('(a) needsSubclassSelection fires at the 2024 level, not the old one');
{
  // The five corrected classes, named with their old levels: the
  // correction itself is pinned, not just cross-source agreement.
  for (const [cls, oldLevel] of Object.entries({ cleric: 1, sorcerer: 1, warlock: 1, wizard: 2, druid: 2 })) {
    check(needsSubclassSelection(cls, 3) === true, `${cls} prompts at 3rd (2024)`);
    check(needsSubclassSelection(cls, oldLevel) === false, `${cls} does NOT prompt at ${oldLevel} (old 2014 level)`);
  }
  // The table agrees with classes.json (the 2024-corrected source) for
  // every class the table covers — 23 entries.
  for (const [id, level] of Object.entries(SUBCLASS_LEVELS)) {
    check(level === classes[id]?.subclassLevel, `SUBCLASS_LEVELS says ${level} for ${id} (classes.json: ${classes[id]?.subclassLevel})`);
  }
  // Every in-table class prompts exactly at its level — and nowhere else
  // in the 1-2 range where the old prompts used to fire.
  for (const [id, level] of Object.entries(SUBCLASS_LEVELS)) {
    check(needsSubclassSelection(id, level) === true, `${id} prompts at its level ${level}`);
  }
  for (const [id, level] of Object.entries(SUBCLASS_LEVELS)) {
    if (level !== 1) check(needsSubclassSelection(id, 1) === false, `${id} does NOT prompt at 1 (level ${level})`);
  }
  for (const [id] of Object.entries(SUBCLASS_LEVELS)) {
    check(needsSubclassSelection(id, 2) === false, `${id} does NOT prompt at 2 (no class chooses at 2nd in 2024)`);
  }
  // Unchanged classes, named: magus/scholar still prompt at 1, keeper at 6.
  for (const cls of ['magus', 'scholar']) {
    check(needsSubclassSelection(cls, 1) === true, `${cls} still prompts at 1 (own book)`);
    check(needsSubclassSelection(cls, 3) === false, `${cls} does NOT prompt at 3`);
  }
  check(needsSubclassSelection('keeper', 6) === true, 'keeper prompts at 6 (Specialization)');
  check(needsSubclassSelection('keeper', 3) === false, 'keeper does NOT prompt at 3');
  // Blood Hunter joined SUBCLASS_LEVELS 2026-11-06 (4 Orders registered):
  // it prompts at 3rd now. Warlord joined 2026-11-06 too (gaps-batch
  // item 8b): it prompts at 1st — its own book prints the Presence
  // choice at 1st — like magus/scholar.
  check(SUBCLASS_LEVELS.blood_hunter === 3, 'blood_hunter is in SUBCLASS_LEVELS at 3 (Orders registered 2026-11-06)');
  check(needsSubclassSelection('blood_hunter', 3) === true, 'blood_hunter prompts at 3 (was the known gap)');
  check(SUBCLASS_LEVELS.warlord === 1, 'warlord is in SUBCLASS_LEVELS at 1 (Presences registered 2026-11-06)');
  check(needsSubclassSelection('warlord', 1) === true, 'warlord prompts at 1 (Presence choice)');
  check(needsSubclassSelection('warlord', 3) === false, 'warlord does NOT prompt at 3');
}

// ===========================================================================
// (b) GET /:id/level-up-info — the prompt the player actually sees
// ===========================================================================
group('(b) level-up-info prompts at 3rd, not at the old level');
{
  // Cleric 2 -> 3 prompts; cleric 1 -> 2 does not (the old L1 prompt).
  const cleric2 = await makeLeveled({ name: 'ClericTwo', cls: 'cleric', level: 2, xp: XP.to3 });
  const cleric2Info = await req('GET', `/api/character/level-up-info/${cleric2}`);
  check(cleric2Info.status === 200, 'cleric L2 info loads');
  check(existingOption(cleric2Info)?.choices.needsSubclass === true, 'cleric 2->3: needsSubclass true');
  check(existingOption(cleric2Info)?.subclassLevel === 3, 'cleric 2->3: subclassLevel 3');
  check(cleric2Info.json.subclassLevel === 3, 'cleric 2->3: legacy top-level subclassLevel 3');

  const cleric1 = await makeLeveled({ name: 'ClericOne', cls: 'cleric', level: 1, xp: XP.to2 });
  const cleric1Info = await req('GET', `/api/character/level-up-info/${cleric1}`);
  check(cleric1Info.status === 200, 'cleric L1 info loads');
  check(existingOption(cleric1Info)?.choices.needsSubclass === false, 'cleric 1->2: needsSubclass false (no L1 prompt anymore)');
  check(existingOption(cleric1Info)?.subclassLevel === 3, 'cleric 1->2: subclassLevel still 3');

  // Druid + wizard: the old L2 prompt is gone, the L3 prompt is there.
  for (const cls of ['druid', 'wizard']) {
    const at2 = await makeLeveled({ name: `${cls}Two`, cls, level: 2, xp: XP.to3 });
    const info2 = await req('GET', `/api/character/level-up-info/${at2}`);
    check(existingOption(info2)?.choices.needsSubclass === true, `${cls} 2->3: needsSubclass true`);
    check(existingOption(info2)?.subclassLevel === 3, `${cls} 2->3: subclassLevel 3`);
    const at1 = await makeLeveled({ name: `${cls}One`, cls, level: 1, xp: XP.to2 });
    const info1 = await req('GET', `/api/character/level-up-info/${at1}`);
    check(existingOption(info1)?.choices.needsSubclass === false, `${cls} 1->2: needsSubclass false (no L2 prompt anymore)`);
    check(existingOption(info1)?.subclassLevel === 3, `${cls} 1->2: subclassLevel still 3`);
  }

  // Sorcerer + warlock: the old L1 prompt is gone, the L3 prompt is there.
  for (const cls of ['sorcerer', 'warlock']) {
    const at2 = await makeLeveled({ name: `${cls}Two`, cls, level: 2, xp: XP.to3 });
    const info2 = await req('GET', `/api/character/level-up-info/${at2}`);
    check(existingOption(info2)?.choices.needsSubclass === true, `${cls} 2->3: needsSubclass true`);
    const at1 = await makeLeveled({ name: `${cls}One`, cls, level: 1, xp: XP.to2 });
    const info1 = await req('GET', `/api/character/level-up-info/${at1}`);
    check(existingOption(info1)?.choices.needsSubclass === false, `${cls} 1->2: needsSubclass false (no L1 prompt anymore)`);
  }

  // Keeper: still prompts at 6, not at 3.
  const keeper5 = await makeLeveled({ name: 'KeeperFive', cls: 'keeper', level: 5, xp: XP.to6 });
  const keeper5Info = await req('GET', `/api/character/level-up-info/${keeper5}`);
  check(existingOption(keeper5Info)?.choices.needsSubclass === true, 'keeper 5->6: needsSubclass true');
  check(existingOption(keeper5Info)?.subclassLevel === 6, 'keeper 5->6: subclassLevel 6');
  const keeper2 = await makeLeveled({ name: 'KeeperTwo', cls: 'keeper', level: 2, xp: XP.to3 });
  const keeper2Info = await req('GET', `/api/character/level-up-info/${keeper2}`);
  check(existingOption(keeper2Info)?.choices.needsSubclass === false, 'keeper 2->3: needsSubclass false');
  check(existingOption(keeper2Info)?.subclassLevel === 6, 'keeper 2->3: subclassLevel still 6');

  // Multiclass options on a fighter: magus/scholar prompt at 1, the
  // five corrected classes do NOT prompt at 1, keeper not until 6.
  const fighter1 = await makeLeveled({ name: 'FighterOne', cls: 'fighter', level: 1, xp: XP.to2 });
  const fighterInfo = await req('GET', `/api/character/level-up-info/${fighter1}`);
  check(fighterInfo.status === 200, 'fighter L1 info loads');
  check(existingOption(fighterInfo)?.choices.needsSubclass === false, 'fighter 1->2: needsSubclass false');
  check(existingOption(fighterInfo)?.subclassLevel === 3, 'fighter 1->2: subclassLevel 3');
  for (const cls of ['scholar']) {
    const opt = multiclassOption(fighterInfo, cls);
    check(opt !== undefined, `multiclass option exists for ${cls}`);
    check(opt?.choices.needsSubclass === true, `multiclass into ${cls}: needsSubclass true (level 1)`);
    check(opt?.subclassLevel === 1, `multiclass into ${cls}: subclassLevel 1`);
    // MVP gray-out (2026-11-08): the option stays listed but flagged,
    // never removed — the POST /level-up guard is the enforcement.
    check(opt?.pcCreatable === false, `multiclass into ${cls}: pcCreatable false (grayed out)`);
    check(typeof opt?.pcCreatableNote === 'string' && opt.pcCreatableNote.includes('Coming after the MVP'),
      `multiclass into ${cls}: carries the MVP note`);
  }
  // Magus IS in the server's multiclass list (2026-11-08:
  // prerequisites removed — every class is offered, no
  // ability-score gate). Magus prompts at 1, like scholar.
  const magusOpt = multiclassOption(fighterInfo, 'magus');
  check(magusOpt !== undefined, 'multiclass option exists for magus (prerequisites removed — every class offered)');
  check(magusOpt?.choices.needsSubclass === true, 'multiclass into magus: needsSubclass true (level 1)');
  check(magusOpt?.subclassLevel === 1, 'multiclass into magus: subclassLevel 1');
  // MVP gray-out (2026-11-08): the option stays listed but flagged,
  // never removed — the POST /level-up guard is the enforcement.
  check(magusOpt?.pcCreatable === false, 'multiclass into magus: pcCreatable false (grayed out)');
  check(typeof magusOpt?.pcCreatableNote === 'string' && magusOpt.pcCreatableNote.includes('Coming after the MVP'),
    'multiclass into magus: carries the MVP note');
  for (const cls of ['cleric', 'sorcerer', 'warlock', 'wizard', 'druid']) {
    const opt = multiclassOption(fighterInfo, cls);
    check(opt !== undefined, `multiclass option exists for ${cls}`);
    check(opt?.choices.needsSubclass === false, `multiclass into ${cls}: needsSubclass false (not at class level 1 anymore)`);
    check(opt?.subclassLevel === 3, `multiclass into ${cls}: subclassLevel 3`);
  }
  const keeperOpt = multiclassOption(fighterInfo, 'keeper');
  check(keeperOpt !== undefined, 'multiclass option exists for keeper');
  check(keeperOpt?.choices.needsSubclass === false, 'multiclass into keeper: needsSubclass false at class level 1');
  check(keeperOpt?.subclassLevel === 6, 'multiclass into keeper: subclassLevel 6');

  // V8 (2026-11-07, spellbook replacement): the multiclass-into-wizard
  // envelope option offers the settled seed — SPELLBOOK_START_SIZE (6)
  // book spells — not 0. getSpellsKnown returns null for prepared
  // casters, so the pre-fix envelope read 0. Contrasts: cleric (also
  // prepares, no book seed) and magus (a known caster whose L1 row is
  // 0) still read 0 — the wizard branch is special-cased, not a
  // blanket change.
  const wizardOpt = multiclassOption(fighterInfo, 'wizard');
  check(wizardOpt !== undefined, 'multiclass option exists for wizard (V8 seed pin)');
  check(wizardOpt?.choices.newSpellsKnown === SPELLBOOK_START_SIZE, `multiclass into wizard: newSpellsKnown ${SPELLBOOK_START_SIZE} (the settled spellbook seed, not 0)`);
  check(multiclassOption(fighterInfo, 'cleric')?.choices.newSpellsKnown === 0, 'multiclass into cleric: newSpellsKnown 0 (prepares, no book seed)');
  check(multiclassOption(fighterInfo, 'magus')?.choices.newSpellsKnown === 0, 'multiclass into magus: newSpellsKnown 0 (known caster, L1 row is 0)');

  const missing = await req('GET', '/api/character/level-up-info/999999');
  check(missing.status === 404, 'level-up-info 404s for an unknown character');
}

// ===========================================================================
// (c) POST /:id/level-up — the 422 gate and the subclass write
// ===========================================================================
group('(c) level-up submit refuses at the old level, requires at 3rd');
{
  // Cleric 2 -> 3 without a subclass is refused, and the row is untouched.
  const cleric2 = await makeLeveled({ name: 'ClericSubmitTwo', cls: 'cleric', level: 2, xp: XP.to3 });
  const refused = await req('POST', `/api/character/level-up/${cleric2}`, {});
  check(refused.status === 422, 'cleric 2->3 without subclass: 422');
  check(String(refused.json?.error || '').includes('Subclass selection required'), 'cleric 2->3 refusal names the subclass requirement');
  const refusedRow = await readCharacter(cleric2);
  check(refusedRow.level === 2 && refusedRow.subclass === null, 'refused level-up leaves the row unchanged');

  // Cleric 2 -> 3 with a real domain succeeds and persists the subclass.
  const ok = await req('POST', `/api/character/level-up/${cleric2}`, { subclass: 'Life Domain' });
  check(ok.status === 200, 'cleric 2->3 with Life Domain: 200');
  const okRow = await readCharacter(cleric2);
  check(okRow.level === 3, 'cleric row is level 3 after the level-up');
  check(okRow.subclass === 'Life Domain', 'cleric row stores Life Domain (legacy field)');
  const okLevels = JSON.parse(okRow.class_levels || '[]');
  check(okLevels[0]?.subclass === 'Life Domain', 'cleric class_levels stores Life Domain');

  // Cleric 1 -> 2 without a subclass now succeeds (the old L1 gate is gone).
  const cleric1 = await makeLeveled({ name: 'ClericSubmitOne', cls: 'cleric', level: 1, xp: XP.to2 });
  const cleric1Up = await req('POST', `/api/character/level-up/${cleric1}`, {});
  check(cleric1Up.status === 200, 'cleric 1->2 without subclass: 200');
  const cleric1Row = await readCharacter(cleric1);
  check(cleric1Row.level === 2 && cleric1Row.subclass === null, 'cleric 1->2 leaves subclass null');

  // Druid + wizard: 2 -> 3 without a subclass is refused (old L2 gate moved).
  for (const cls of ['druid', 'wizard']) {
    const id = await makeLeveled({ name: `${cls}SubmitTwo`, cls, level: 2, xp: XP.to3 });
    const res = await req('POST', `/api/character/level-up/${id}`, {});
    check(res.status === 422, `${cls} 2->3 without subclass: 422`);
  }

  // Sorcerer + warlock: 1 -> 2 without a subclass now succeeds.
  for (const cls of ['sorcerer', 'warlock']) {
    const id = await makeLeveled({ name: `${cls}SubmitOne`, cls, level: 1, xp: XP.to2 });
    const res = await req('POST', `/api/character/level-up/${id}`, {});
    check(res.status === 200, `${cls} 1->2 without subclass: 200`);
  }

  // Multiclass: into cleric at class level 1 no longer requires a
  // subclass (it did before the fix); into magus at 1 the class
  // guard fires first — 400 naming the class, not the 422 subclass
  // gate (MVP gray-out, 2026-11-08).
  const fighter1 = await makeLeveled({ name: 'FighterMulti', cls: 'fighter', level: 1, xp: XP.to2 });
  const multiCleric = await req('POST', `/api/character/level-up/${fighter1}`, { selectedClass: 'Cleric' });
  check(multiCleric.status === 200, 'multiclass into cleric at 1 without subclass: 200');
  const multiRow = await readCharacter(fighter1);
  const multiLevels = JSON.parse(multiRow.class_levels || '[]');
  const clericEntry = multiLevels.find((c) => String(c.class).toLowerCase() === 'cleric');
  check(clericEntry?.level === 1 && clericEntry?.subclass === null, 'multiclass cleric entry stored at level 1 with no subclass');
  // Fresh fighter for the magus attempt: the cleric multiclass above
  // already spent this row's level-up (total level 2 on 300 XP), so
  // reusing it would 400 on XP and mask the subclass gate.
  const fighterMagus = await makeLeveled({ name: 'FighterMagus', cls: 'fighter', level: 1, xp: XP.to2 });
  const multiMagus = await req('POST', `/api/character/level-up/${fighterMagus}`, { selectedClass: 'Magus' });
  check(multiMagus.status === 400, 'multiclass into magus at 1 without subclass: 400 (class gray-out fires before the subclass gate)');
  check(typeof multiMagus.json?.error === 'string' && multiMagus.json.error.includes('Class Magus is not available for player characters yet'),
    `multiclass into magus refusal names the class (got ${JSON.stringify(multiMagus.json)})`);
  const magusRow = await readCharacter(fighterMagus);
  check(magusRow.level === 1, 'refused magus multiclass left the level at 1');

  // Keeper 5 -> 6 without a subclass is refused (still prompts at 6).
  const keeper5 = await makeLeveled({ name: 'KeeperSubmitFive', cls: 'keeper', level: 5, xp: XP.to6 });
  const keeperRes = await req('POST', `/api/character/level-up/${keeper5}`, {});
  check(keeperRes.status === 422, 'keeper 5->6 without subclass: 422');

  const missing = await req('POST', '/api/character/level-up/999999', {});
  check(missing.status === 404, 'level-up 404s for an unknown character');
}

server.close();
console.log(`\n levelup-subclass-prompts: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
