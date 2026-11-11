// tests/bard-prepared-cap.test.js — bard prepared-spell cap (2026-11-06).
//
// 2024 PHB rule: a bard prepares Cha mod + bard level spells, min 1.
// (PHB prepared column 4-22; L1 = 4 at Cha +3.) Bards PREPARE in 2024 —
// the 2014 known-spells row is removed from SPELLS_KNOWN, so a bard is
// a prepared caster, never both (keeping the row made Stage 4 route
// bards as known casters while /api/spells served both counts).
//
// Honest tests: getSpellsPrepared / getSpellsKnown come from the real
// server/config/levelProgression.js — no re-implemented logic. The
// formula sweep derives the expectation from the rule itself
// (max(1, mod + level)), and the generated-dataset group reads the
// real client/src/data/spellCatalog.generated.json and checks it
// against the live function. If levelProgression.js were deleted, the
// imports fail and the suite fails with it.
//
// NOTE on the printed PHB column: the book's per-level table bakes in
// its assumed ASI progression, so its values (9 at L5, 22 at L20) do
// not equal mod + level at any single fixed mod. The arm implements
// the book's RULE text (Cha mod + bard level), the same treatment as
// the cleric/druid/wizard arms — so only the coordinator-named pin
// (L1 = 4 at Cha +3) is asserted against the table, plus the formula
// sweep. Do not "fix" the arm to the printed column.
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

// (a) The arm is Cha mod + bard level, min 1, at every level and mod.
group('(a) bard arm formula: max(1, Cha mod + bard level), levels 1-20');
{
  let mismatches = 0;
  for (let level = 1; level <= 20; level++) {
    for (const mod of [-5, -1, 0, 1, 3, 5]) {
      const want = Math.max(1, mod + level);
      const got = getSpellsPrepared('bard', level, mod);
      if (got !== want) {
        mismatches++;
        console.error(`  ✗ bard L${level} mod ${mod}: want ${want}, got ${got}`);
      }
    }
  }
  check(mismatches === 0, `bard arm equals max(1, mod + level) at all 20 levels x mods [-5, -1, 0, 1, 3, 5] (${mismatches} mismatches)`);
}

// (b) PHB pins (coordinator-named: L1 = 4 at Cha +3) + the min-1 floor.
group('(b) PHB pins + min-1 floor');
{
  check(getSpellsPrepared('bard', 1, 3) === 4, 'bard L1 at Cha +3 prepares 4 (2024 PHB table)');
  check(getSpellsPrepared('bard', 1, 0) === 1, 'bard L1 at Cha +0 prepares 1 (floor, not 0)');
  check(getSpellsPrepared('bard', 1, -1) === 1, 'bard L1 at Cha -1 prepares 1 (min 1, never 0 or negative)');
  check(getSpellsPrepared('bard', 10, 5) === 15, 'bard L10 at Cha +5 prepares 15');
  check(getSpellsPrepared('bard', 20, 5) === 25, 'bard L20 at Cha +5 prepares 25 (formula; the printed column assumes ASI progression, see header)');
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
  check(getSpellsPrepared('cleric', 1, 3) === 4 && getSpellsPrepared('wizard', 5, 2) === 7,
    'cleric/wizard still max(1, mod + level)');
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
  check(bard.spellsPrepared?.kind === 'modPlusLevel', `dataset bard prepared rule is modPlusLevel (got ${bard.spellsPrepared?.kind})`);
  let mismatches = 0;
  for (const mod of [-1, 0, 3, 5]) {
    if (bard.spellsPrepared?.byMod?.[String(mod)] !== getSpellsPrepared('bard', 1, mod)) mismatches++;
  }
  check(mismatches === 0, `dataset bard byMod matches getSpellsPrepared at L1 for mods [-1, 0, 3, 5] (${mismatches} mismatches)`);
}

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
process.exit(failed > 0 ? 1 : 0);
