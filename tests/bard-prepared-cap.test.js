// tests/bard-prepared-cap.test.js — bard prepared-spell cap (2026-11-06).
//
// 2024 PHB rule (H3, Zach 2026-11-12; corrected 2026-11-23): a bard
// prepares the number in the Bard table's Prepared Spells column —
// 4, 5, 6, 7, 9, 10, 11, 12, 14, 15, 16, 16, 17, 17, 18, 18, 19, 20,
// 21, 22 — at EVERY Cha mod. The 2014 formula (Cha mod + bard level)
// that this suite used to pin is retired. Bards PREPARE in 2024 —
// the 2014 known-spells row is removed from SPELLS_KNOWN, so a bard is
// a prepared caster, never both (keeping the row made Stage 4 route
// bards as known casters while /api/spells served both counts).
//
// Honest tests: getSpellsPrepared / getSpellsKnown come from the real
// server/config/levelProgression.js — no re-implemented logic. The
// sweep's expectation is the printed column as a literal (from the
// brief, checked against Zach's PHB photos), not the code's own
// constant, and the generated-dataset group reads the real
// client/src/data/spellCatalog.generated.json and checks it against
// the live function. If levelProgression.js were deleted, the imports
// fail and the suite fails with it.
//
// The PUT /:id sheet-save and POST /level-up stored-list validators
// for bard now exist (server/routes/character.js bard blocks,
// 2026-11-06/07; tests/bard-validator-wiring.test.js). The gap is
// now wizard-only — see tests/wizard-validator-wiring.test.js.
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

let passed = 0;
let failed = 0;
function check(condition, message) {
  if (condition) { passed++; }
  else { failed++; console.error('  ✗', message); }
}
function group(name) { console.log('\n==', name); }

const repoRoot = process.cwd();
const fromRepo = (rel) => pathToFileURL(path.join(repoRoot, rel)).href;

const { getSpellsPrepared, getSpellsKnown } = await import(fromRepo('server/config/levelProgression.js'));

// (a) The arm is the printed column at every level and mod.
const BARD_COLUMN = [4, 5, 6, 7, 9, 10, 11, 12, 14, 15, 16, 16, 17, 17, 18, 18, 19, 20, 21, 22];
group('(a) bard arm: the 2024 Prepared Spells column, levels 1-20, mod-independent');
{
  let mismatches = 0;
  for (let level = 1; level <= 20; level++) {
    for (const mod of [-5, -1, 0, 1, 3, 5]) {
      const want = BARD_COLUMN[level - 1];
      const got = getSpellsPrepared('bard', level, mod);
      if (got !== want) {
        mismatches++;
        console.error(`  ✗ bard L${level} mod ${mod}: want ${want}, got ${got}`);
      }
    }
  }
  check(mismatches === 0, `bard arm equals the printed column at all 20 levels x mods [-5, -1, 0, 1, 3, 5] (${mismatches} mismatches)`);
}

// (b) PHB pins: L1 = 4 at every mod; the printed L5 / L20 values.
group('(b) PHB pins');
{
  check(getSpellsPrepared('bard', 1, 3) === 4, 'bard L1 at Cha +3 prepares 4 (2024 PHB table)');
  check(getSpellsPrepared('bard', 1, 0) === 4, 'bard L1 at Cha +0 prepares 4 (table; the 2014 formula said 1)');
  check(getSpellsPrepared('bard', 1, -1) === 4, 'bard L1 at Cha -1 prepares 4 (table, mod-independent)');
  check(getSpellsPrepared('bard', 1, 5) === 4, 'bard L1 at Cha +5 prepares 4 (table; the 2014 formula said 6)');
  check(getSpellsPrepared('bard', 5, 0) === 9, 'bard L5 prepares 9 (printed column)');
  check(getSpellsPrepared('bard', 20, 5) === 22, 'bard L20 prepares 22 (printed column; the 2014 formula said 25 at +5)');
}

// (c) Bard is a prepared caster, never a known caster.
group('(c) bard prepares — getSpellsKnown returns null at every level');
{
  let nonNull = 0;
  for (let level = 1; level <= 20; level++) {
    if (getSpellsKnown('bard', level) !== null) nonNull++;
  }
  check(nonNull === 0, `getSpellsKnown('bard', level) is null at all 20 levels (${nonNull} non-null)`);
  check(getSpellsKnown('bard', 1) === null, "bard L1 spellsKnown is null (the 2014 known-spells row is gone)");
}

// (d) No regression on the sibling arms.
group('(d) sibling arms unchanged');
{
  check(getSpellsPrepared('cleric', 1, 0) === 4 && getSpellsPrepared('wizard', 5, 2) === 9 && getSpellsPrepared('wizard', 16, 0) === 21,
    'cleric/wizard are their 2024 tables too (H3: cleric L1 4, wizard L5 9, wizard L16 21 — any mod)');
  check(getSpellsPrepared('paladin', 1, 3) === 2 && getSpellsPrepared('paladin', 2, 3) === 3,
    'paladin is the 2024 PHB table now (2 at L1, 3 at L2 — mod-independent)');
  check(getSpellsPrepared('artificer', 1, 3) === 3 && getSpellsPrepared('artificer', 10, 2) === 7,
    'artificer still Int + half level');
  check(getSpellsPrepared('blackguard', 1, 3) === 0 && getSpellsPrepared('blackguard', 10, 2) === 7,
    'blackguard still 0 at L1, Cha + half level after');
  // Ranger left this list in the 2026-11-06 reconciliation (rangers
  // PREPARE in 2024 — table-driven column, 6 at L5 at any mod), and
  // warlock left it the same day (warlocks PREPARE in 2024 — fixed
  // column, 6 at L5). Both flips are the same stale pin, fixed here
  // because they share this exact list.
  for (const cls of ['fighter', 'rogue', 'monk', 'barbarian']) {
    check(getSpellsPrepared(cls, 5, 3) === null, `${cls} still returns null (not a prepared caster)`);
  }
  check(getSpellsPrepared('ranger', 5, 3) === 6, 'ranger now prepares (2024 table: 6 at L5, any mod)');
  check(getSpellsPrepared('warlock', 5, 3) === 6, 'warlock now prepares (2024 table: 6 at L5, any mod)');
  // Sorcerer left this list in the 2026-11-06 reconciliation: sorcerers
  // PREPARE in 2024 (fixed table, 9 at L5 at any mod) — pinned by
  // tests/sorcerer-prepared-cap.test.js, not here.
  check(getSpellsPrepared('sorcerer', 5, 3) === 9, 'sorcerer prepares 9 at L5 (fixed PHB table, mod-independent)');
}

// (e) The generated dataset agrees with the live arm (regenerated by
// scripts/generate-spell-catalog.js after the arm landed).
group('(e) generated dataset agrees with the live arm');
{
  const generated = JSON.parse(fs.readFileSync(path.join(repoRoot, 'client/src/data/spellCatalog.generated.json'), 'utf8'));
  const bard = generated.level1ByClass.bard;
  check(bard.spellsKnown === null, 'dataset bard spellsKnown is null');
  check(bard.spellsPrepared?.kind === 'table', `dataset bard prepared rule is table (got ${bard.spellsPrepared?.kind})`);
  let mismatches = 0;
  for (const mod of [-1, 0, 3, 5]) {
    if (bard.spellsPrepared?.byMod?.[String(mod)] !== getSpellsPrepared('bard', 1, mod)) mismatches++;
  }
  check(mismatches === 0, `dataset bard byMod matches getSpellsPrepared at L1 for mods [-1, 0, 3, 5] (${mismatches} mismatches)`);
}

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
process.exit(failed > 0 ? 1 : 0);
