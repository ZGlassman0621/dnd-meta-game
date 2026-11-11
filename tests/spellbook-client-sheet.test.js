// tests/spellbook-client-sheet.test.js — wizard spellbook CLIENT side
// (2026-11-07): the sheet's Spellbook section + the client helpers it
// reads, and the draft save / resume path carrying both spell lists.
//
// What this pins:
//   - client/src/components/spellbookHelpers.js mirrors the real
//     server/services/spellbookService.js constants and formulas —
//     every value is asserted against the REAL server module, so a
//     drift fails loudly instead of silently mispricing a copy.
//   - copyableSpellCandidates / memorizeSwapOptions are the real
//     helpers the sheet calls, exercised on stub catalog data (the
//     catalog shape is the client's own spells/index.js shape).
//   - The draft save body carries both lists and the server-row
//     rehydration reads both back (real stage1Persistence.js).
//   - The sheet's free-text "+ Add to Spellbook" prompt is gone and
//     the validated routes are wired (static pins on the live
//     CharacterSheet.jsx source + a real esbuild bundle of it).
//   - Memorize Spell is BANKED (rest consolidation, 2026-11-07): the
//     sheet POSTs the pick to /memorize-bank (DELETE clears it) and
//     the next DM short rest applies it — the deleted POST /:id/rest
//     call, the rest-and-swap button, and the false half-HP promise
//     are all gone, pinned statically + in the bundle.
//   - Spellbook replacement + backup (2026-11-07): the sheet shows a
//     lost book's replacement cost up front (per spell + total, at
//     the 1h + 10 gp replace rate), offers memory vs backup restore,
//     names what a restore would drop, surfaces server refusals
//     verbatim, and renders the backup book with a copy-into-backup
//     control — pinned statically + in the bundle, with the
//     preview helpers unit-tested on stub data.
//   - Fixed materials table (2026-11-08): the blank book's price
//     comes from a five-tier table (vellum 25 / standard 50 /
//     fine-leather 100 / gilt-edged 250 / dragonhide 500) — the
//     sheet sends only the materials key, the server derives the
//     price; the table is cross-pinned server↔client, and the
//     derived totals (210 / 410 / 660 gp) are pinned in (a).
//   - Spellbook section re-gated on wizard levels (2026-11-08):
//     a fighter-first wizard sees the section and can bank Arcane
//     Recovery; Memorize / Mastery / Signature gate on wizard
//     level, not the row total — pinned in (g).
//   - LevelUpPage multiclass-into-wizard seeds 6 spells
//     (SPELLBOOK_START_SIZE from the shared helpers): the picker
//     caps at 6 and blocks Review until all 6 are picked — pinned
//     statically + in the bundle.
//   - Mutation checks prove the pins are sensitive: a 40-gp client
//     constant disagrees with the server's 50, a 50-gp client
//     REPLACE constant disagrees with the server's 10, and a
//     deleted copy label / deleted wizard-seed branch fails the
//     bundle / source pin.
//
// Honest integration tests: the helpers, the persistence module, and
// the server service are the real modules, imported — never
// re-implemented. Deleting any of them fails the import and the suite
// with it. No DB, no HTTP: the sheet's routes are pinned statically
// here and exercised over real HTTP in tests/spellbook-routes.test.js.
// Footer is the runner-matching `Results:` form so the count aggregates.
//
// Run from the repo root: node tests/spellbook-client-sheet.test.js
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

let passed = 0;
let failed = 0;
function check(condition, message) {
  if (condition) { passed++; }
  else { failed++; console.error('  ✗', message); }
}
function group(name) { console.log('\n==', name); }

const repoRoot = process.cwd();
const readRepo = (rel) => fs.readFileSync(path.join(repoRoot, rel), 'utf8');
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spellbook-client-sheet-test-'));

// The real modules under test.
const helpers = await import(pathToFileURL(path.join(repoRoot, 'client/src/components/spellbookHelpers.js')).href);
const serverSvc = await import(pathToFileURL(path.join(repoRoot, 'server/services/spellbookService.js')).href);
const { rehydrateStateFromServerRow, buildStage1ProgressBody } = await import(pathToFileURL(path.join(repoRoot, 'client/src/components/creator-next/stage1Persistence.js')).href);

// (a) Client helpers pinned against the real server service.
group('(a) Client spellbook constants + formulas agree with the server');
{
  check(helpers.SPELLBOOK_START_SIZE === serverSvc.SPELLBOOK_START_SIZE && helpers.SPELLBOOK_START_SIZE === 6,
    `client SPELLBOOK_START_SIZE is 6, like the server (got ${helpers.SPELLBOOK_START_SIZE})`);
  check(helpers.SPELLBOOK_SPELLS_PER_LEVEL === serverSvc.SPELLBOOK_SPELLS_PER_LEVEL && helpers.SPELLBOOK_SPELLS_PER_LEVEL === 2,
    'client SPELLBOOK_SPELLS_PER_LEVEL is 2, like the server');
  check(helpers.COPY_GOLD_PER_SPELL_LEVEL === serverSvc.COPY_GOLD_PER_SPELL_LEVEL && helpers.COPY_GOLD_PER_SPELL_LEVEL === 50,
    'client COPY_GOLD_PER_SPELL_LEVEL is 50, like the server');
  check(helpers.COPY_HOURS_PER_SPELL_LEVEL === serverSvc.COPY_HOURS_PER_SPELL_LEVEL && helpers.COPY_HOURS_PER_SPELL_LEVEL === 2,
    'client COPY_HOURS_PER_SPELL_LEVEL is 2, like the server');
  check(helpers.SPELL_MASTERY_LEVEL === serverSvc.SPELL_MASTERY_LEVEL && helpers.SPELL_MASTERY_LEVEL === 18,
    'client SPELL_MASTERY_LEVEL is 18, like the server');
  check(helpers.SIGNATURE_SPELLS_LEVEL === serverSvc.SIGNATURE_SPELLS_LEVEL && helpers.SIGNATURE_SPELLS_LEVEL === 20,
    'client SIGNATURE_SPELLS_LEVEL is 20, like the server');
  check(helpers.SPELL_MASTERY_MAX === serverSvc.SPELL_MASTERY_MAX && helpers.SPELL_MASTERY_MAX === 2,
    'client SPELL_MASTERY_MAX is 2, like the server');
  check(helpers.SIGNATURE_SPELLS_MAX === serverSvc.SIGNATURE_SPELLS_MAX && helpers.SIGNATURE_SPELLS_MAX === 2,
    'client SIGNATURE_SPELLS_MAX is 2, like the server');
  check(JSON.stringify(helpers.NEW_SLOT_LEVELS) === JSON.stringify(serverSvc.NEW_SLOT_LEVELS),
    `client NEW_SLOT_LEVELS match the server (${JSON.stringify(helpers.NEW_SLOT_LEVELS)})`);
  for (let level = 1; level <= 20; level++) {
    check(helpers.spellbookSizeForLevel(level) === serverSvc.spellbookSizeForLevel(level),
      `spellbookSizeForLevel(${level}) is ${serverSvc.spellbookSizeForLevel(level)} on both sides`);
  }
  check(helpers.spellbookSizeForLevel(1) === 6 && helpers.spellbookSizeForLevel(20) === 44,
    'book size runs 6 at L1 to 44 at L20');
  for (let level = 1; level <= 9; level++) {
    check(JSON.stringify(helpers.copyCostForSpellLevel(level)) === JSON.stringify(serverSvc.copyCostForSpellLevel(level)),
      `copyCostForSpellLevel(${level}) is ${JSON.stringify(serverSvc.copyCostForSpellLevel(level))} on both sides`);
  }
  check(helpers.copyCostForSpellLevel(3).gold === 150 && helpers.copyCostForSpellLevel(3).hours === 6,
    'copying a 3rd-level spell costs 150 gp + 6 h');
  check(helpers.copyCostForSpellLevel(0) === null && serverSvc.copyCostForSpellLevel(0) === null,
    'copy cost is null for a cantrip on both sides');
  // Replacement / backup rate (2026-11-07): 1h + 10 gp per level —
  // a DIFFERENT rate from copying a new spell in (2h + 50 gp).
  // The client mirrors the server's REPLACE_* names exactly, so a
  // drift fails here, not in a player's purse.
  check(helpers.REPLACE_GOLD_PER_SPELL_LEVEL === serverSvc.REPLACE_GOLD_PER_SPELL_LEVEL && helpers.REPLACE_GOLD_PER_SPELL_LEVEL === 10,
    'client REPLACE_GOLD_PER_SPELL_LEVEL is 10, like the server');
  check(helpers.REPLACE_HOURS_PER_SPELL_LEVEL === serverSvc.REPLACE_HOURS_PER_SPELL_LEVEL && helpers.REPLACE_HOURS_PER_SPELL_LEVEL === 1,
    'client REPLACE_HOURS_PER_SPELL_LEVEL is 1, like the server');
  // Blank-book price (V5, 2026-11-08): the standard 50 gp, charged
  // once per book. The client mirrors the server's
  // STANDARD_SPELLBOOK_COST_GP name exactly, so a drift fails here.
  check(helpers.STANDARD_SPELLBOOK_COST_GP === serverSvc.STANDARD_SPELLBOOK_COST_GP && helpers.STANDARD_SPELLBOOK_COST_GP === 50,
    'client STANDARD_SPELLBOOK_COST_GP is 50, like the server');
  // Fixed materials table (2026-11-08, five tiers decided by Zach):
  // the client mirrors the server's SPELLBOOK_MATERIALS exactly —
  // same keys, labels, prices. There is NO waived tier and
  // dragonhide is 500 gp, not 200. The server-presence check fails
  // cleanly (not a crash) if the server half of the table has not
  // landed yet — the rest of the suite still runs.
  const tableTiers = {
    vellum: { label: 'Vellum bound with twine', cost: 25 },
    standard: { label: 'Standard spellbook', cost: 50 },
    'fine-leather': { label: 'Fine leather-bound', cost: 100 },
    'gilt-edged': { label: 'Gilt-edged tome', cost: 250 },
    dragonhide: { label: 'Dragonhide-bound', cost: 500 },
  };
  check(JSON.stringify(Object.keys(helpers.SPELLBOOK_MATERIALS)) === JSON.stringify(Object.keys(tableTiers)),
    `client SPELLBOOK_MATERIALS has exactly the five tiers, in table order (got ${JSON.stringify(Object.keys(helpers.SPELLBOOK_MATERIALS))})`);
  for (const [key, row] of Object.entries(tableTiers)) {
    check(helpers.SPELLBOOK_MATERIALS[key]?.label === row.label && helpers.SPELLBOOK_MATERIALS[key]?.cost === row.cost,
      `client ${key} is '${row.label}' at ${row.cost} gp`);
  }
  check(serverSvc.SPELLBOOK_MATERIALS != null,
    'the server carries SPELLBOOK_MATERIALS (the server half of the table)');
  for (const [key, row] of Object.entries(tableTiers)) {
    check(serverSvc.SPELLBOOK_MATERIALS?.[key]?.label === row.label && serverSvc.SPELLBOOK_MATERIALS?.[key]?.cost === row.cost
      && helpers.SPELLBOOK_MATERIALS[key]?.label === serverSvc.SPELLBOOK_MATERIALS?.[key]?.label
      && helpers.SPELLBOOK_MATERIALS[key]?.cost === serverSvc.SPELLBOOK_MATERIALS?.[key]?.cost,
      `server ${key} is '${row.label}' at ${row.cost} gp, like the client`);
  }
  check(helpers.SPELLBOOK_MATERIALS.standard.cost === helpers.STANDARD_SPELLBOOK_COST_GP,
    'the standard tier costs the shared standard 50 gp');
  check(helpers.spellbookMaterialCost('standard') === 50 && helpers.spellbookMaterialCost('vellum') === 25
    && helpers.spellbookMaterialCost('fine-leather') === 100 && helpers.spellbookMaterialCost('gilt-edged') === 250
    && helpers.spellbookMaterialCost('dragonhide') === 500,
    'spellbookMaterialCost reads every tier price from the table');
  check(helpers.spellbookMaterialCost(undefined) === 50 && helpers.spellbookMaterialCost('unicorn-hide') === 50
    && helpers.spellbookMaterialCost('') === 50,
    'spellbookMaterialCost falls back to the standard 50 gp with no key (or an unknown key)');
  check(helpers.spellbookMaterialLabel('dragonhide') === 'Dragonhide-bound'
    && helpers.spellbookMaterialLabel('gilt-edged') === 'Gilt-edged tome'
    && helpers.spellbookMaterialLabel('dragonhide-bound, gold-leafed pages') === 'dragonhide-bound, gold-leafed pages',
    'spellbookMaterialLabel prints the table label for a known key and a legacy free-text row verbatim');
  // Derived totals: the recon example (9 prepared, 160 gp
  // transcription) plus the blank book — standard 210, gilt-edged
  // 410, dragonhide 660. There is NO 0-cost case any more.
  const reconTranscription = helpers.replaceCostForSpells([1, 1, 1, 1, 2, 2, 2, 3, 3]).gold;
  check(reconTranscription === 160, 'the recon example still transcribes at 160 gp');
  check(reconTranscription + helpers.spellbookMaterialCost('standard') === 210,
    'a full replace with a standard book costs 210 gp (160 + 50)');
  check(reconTranscription + helpers.spellbookMaterialCost('gilt-edged') === 410,
    'a full replace with a gilt-edged tome costs 410 gp (160 + 250)');
  check(reconTranscription + helpers.spellbookMaterialCost('dragonhide') === 660,
    'a full replace with a dragonhide-bound book costs 660 gp (160 + 500)');
  check(reconTranscription + helpers.spellbookMaterialCost('vellum') === 185,
    'a full replace with a vellum book costs 185 gp (160 + 25)');
  // A stored materials KEY rides parseSpellbookState like the
  // legacy free text did — present only when set, on both sides.
  const keyJson = '{"status":"lost","mastery":[],"signature":[],"bookCost":500,"bookMaterials":"dragonhide"}';
  check(JSON.stringify(helpers.parseSpellbookState(keyJson)) === JSON.stringify(serverSvc.parseSpellbookState(keyJson))
    && helpers.parseSpellbookState(keyJson).bookMaterials === 'dragonhide'
    && helpers.parseSpellbookState(keyJson).bookCost === 500,
    'parseSpellbookState carries a stored materials key + derived cost identically to the server');
  for (let level = 1; level <= 9; level++) {
    check(JSON.stringify(helpers.replaceCostForSpellLevel(level)) === JSON.stringify(serverSvc.replaceCostForSpellLevel(level)),
      `replaceCostForSpellLevel(${level}) is ${JSON.stringify(serverSvc.replaceCostForSpellLevel(level))} on both sides`);
  }
  check(helpers.replaceCostForSpellLevel(3).gold === 30 && helpers.replaceCostForSpellLevel(3).hours === 3,
    'replacing a 3rd-level spell costs 30 gp + 3 h (not the 150 gp + 6 h copy rate)');
  check(helpers.replaceCostForSpellLevel(0) === null && serverSvc.replaceCostForSpellLevel(0) === null,
    'replace cost is null for a cantrip on both sides');
  check(JSON.stringify(helpers.replaceCostForSpells([1, 1, 1, 1, 2, 2, 2, 3, 3])) === JSON.stringify(serverSvc.replaceCostForSpells([1, 1, 1, 1, 2, 2, 2, 3, 3])),
    'replaceCostForSpells sums a whole prepared list identically to the server');
  check(JSON.stringify(helpers.replaceCostForSpells([1, 1, 1, 1, 2, 2, 2, 3, 3])) === JSON.stringify({ gold: 160, hours: 16 }),
    'the recon example (9 prepared, levels 1,1,1,1,2,2,2,3,3) costs 160 gp + 16 h');
  check(helpers.replaceCostForSpells([1, 0]) === null && serverSvc.replaceCostForSpells([1, 0]) === null,
    'replaceCostForSpells is null when any level is bad, on both sides');
  check(helpers.replaceCostForSpells('nope') === null && serverSvc.replaceCostForSpells('nope') === null,
    'replaceCostForSpells is null for a non-array, on both sides');
  check(helpers.replaceCostForSpells([]).gold === 0 && helpers.replaceCostForSpells([]).hours === 0,
    'replaceCostForSpells is 0 gp + 0 h for an empty list (the backup path)');
  // Backup + replaced marker ride parseSpellbookState exactly like
  // the server — present only when set, so the blank state keeps
  // its exact old shape.
  const backupJson = '{"status":"lost","mastery":[],"signature":[],"backup":["Magic Missile","Shield"]}';
  check(JSON.stringify(helpers.parseSpellbookState(backupJson)) === JSON.stringify(serverSvc.parseSpellbookState(backupJson)),
    'parseSpellbookState carries a backup list identically to the server');
  const replacedJson = '{"status":"intact","mastery":[],"signature":[],"backup":["Magic Missile"],"replaced":"backup"}';
  check(JSON.stringify(helpers.parseSpellbookState(replacedJson)) === JSON.stringify(serverSvc.parseSpellbookState(replacedJson))
    && helpers.parseSpellbookState(replacedJson).replaced === 'backup',
    'parseSpellbookState carries the replaced marker identically to the server');
  check(helpers.parseSpellbookState('{"status":"intact","mastery":[],"signature":[],"replaced":"scroll"}').replaced === undefined
    && serverSvc.parseSpellbookState('{"status":"intact","mastery":[],"signature":[],"replaced":"scroll"}').replaced === undefined,
    'an unknown replaced value is dropped, never thrown, on both sides');
  // V5: bookCost + bookMaterials ride parseSpellbookState exactly
  // like the server — present only when set, so the blank state
  // keeps its exact old shape.
  const costJson = '{"status":"lost","mastery":[],"signature":[],"bookCost":50,"bookMaterials":"dragonhide-bound, gold-leafed pages"}';
  check(JSON.stringify(helpers.parseSpellbookState(costJson)) === JSON.stringify(serverSvc.parseSpellbookState(costJson))
    && helpers.parseSpellbookState(costJson).bookCost === 50
    && helpers.parseSpellbookState(costJson).bookMaterials === 'dragonhide-bound, gold-leafed pages',
    'parseSpellbookState carries bookCost + bookMaterials identically to the server');
  check(helpers.parseSpellbookState('{"status":"intact","mastery":[],"signature":[],"bookCost":0}').bookCost === 0
    && serverSvc.parseSpellbookState('{"status":"intact","mastery":[],"signature":[],"bookCost":0}').bookCost === 0,
    'a stored book cost of 0 is a real charge, not absence, on both sides');
  check(helpers.parseSpellbookState('{"status":"intact","mastery":[],"signature":[],"bookCost":-5}').bookCost === undefined
    && serverSvc.parseSpellbookState('{"status":"intact","mastery":[],"signature":[],"bookCost":-5}').bookCost === undefined,
    'a negative stored book cost is dropped, never thrown, on both sides');
  check(helpers.parseSpellbookState('{"status":"intact","mastery":[],"signature":[],"bookMaterials":"  "}').bookMaterials === undefined
    && serverSvc.parseSpellbookState('{"status":"intact","mastery":[],"signature":[],"bookMaterials":"  "}').bookMaterials === undefined,
    'blank materials parse away, on both sides');
  check(helpers.parseSpellbookState('{}').bookCost === undefined && helpers.parseSpellbookState('{}').bookMaterials === undefined,
    'the blank state carries no book cost and no materials');
  check(JSON.stringify(helpers.parseSpellbookState('{"status":"intact","mastery":[],"signature":[],"backup":[]}')) === JSON.stringify(helpers.parseSpellbookState('{}')),
    'an empty backup parses away — the blank state keeps its old shape');
  check(JSON.stringify(helpers.parseSpellbookState('{}')) === JSON.stringify(serverSvc.parseSpellbookState('{}')),
    'parseSpellbookState({}) agrees with the server');
  check(JSON.stringify(helpers.parseSpellbookState(null)) === JSON.stringify(serverSvc.parseSpellbookState(null)),
    'parseSpellbookState(null) agrees with the server');
  // Banked Memorize Swap (rest consolidation, 2026-11-07): the client
  // helper carries the bank exactly like the server — only while a
  // valid swap is banked, so the blank state keeps its old shape.
  const bankedJson = '{"status":"intact","mastery":[],"signature":[],"pendingMemorizeSwap":{"oldSpell":"Magic Missile","newSpell":"Shield"}}';
  check(JSON.stringify(helpers.parseSpellbookState(bankedJson)) === JSON.stringify(serverSvc.parseSpellbookState(bankedJson)),
    'parseSpellbookState carries a banked swap identically to the server');
  check(JSON.stringify(helpers.pendingMemorizeSwap(bankedJson)) === JSON.stringify(serverSvc.pendingMemorizeSwap(bankedJson))
    && helpers.pendingMemorizeSwap(bankedJson)?.oldSpell === 'Magic Missile'
    && helpers.pendingMemorizeSwap(bankedJson)?.newSpell === 'Shield',
    'pendingMemorizeSwap reads the banked pair');
  check(helpers.pendingMemorizeSwap('{}') === null && serverSvc.pendingMemorizeSwap('{}') === null,
    'pendingMemorizeSwap is null when no swap is banked, on both sides');
  check(helpers.parsePendingMemorizeSwap({ oldSpell: '  ', newSpell: 'Shield' }) === null
    && serverSvc.parsePendingMemorizeSwap({ oldSpell: '  ', newSpell: 'Shield' }) === null,
    'an invalid bank (blank old spell) is dropped, never thrown, on both sides');
  check(helpers.parsePendingMemorizeSwap({ oldSpell: 'Magic Missile' }) === null,
    'a bank missing the new spell is dropped');
  check(JSON.stringify(helpers.setPendingMemorizeSwap('{}', { oldSpell: 'Magic Missile', newSpell: 'Shield' }))
    === JSON.stringify(serverSvc.setPendingMemorizeSwap('{}', { oldSpell: 'Magic Missile', newSpell: 'Shield' })),
    'setPendingMemorizeSwap banks a swap identically to the server');
  check(JSON.stringify(helpers.setPendingMemorizeSwap(bankedJson, null))
    === JSON.stringify(serverSvc.setPendingMemorizeSwap(bankedJson, null))
    && JSON.stringify(helpers.setPendingMemorizeSwap(bankedJson, null)) === JSON.stringify(helpers.parseSpellbookState('{}')),
    'clearing the bank restores the blank shape on both sides');
  const lost = helpers.parseSpellbookState('{"status":"lost","mastery":["Magic Missile"],"signature":[]}');
  check(lost.status === 'lost' && lost.mastery.length === 1 && lost.mastery[0] === 'Magic Missile' && lost.signature.length === 0,
    `parseSpellbookState reads a lost book with its Mastery pick (got ${JSON.stringify(lost)})`);
  check(JSON.stringify(serverSvc.parseSpellbookState('{"status":"lost","mastery":["Magic Missile"],"signature":[]}')) === JSON.stringify(lost),
    'the server parses the same lost-book state identically');
  check(helpers.parseSpellbookState('not json').status === 'intact',
    'parseSpellbookState on garbage reads as intact, never an invented loss');
  check(helpers.parseSpellbookState('{"status":"banana"}').status === 'intact',
    'parseSpellbookState on an unknown status reads as intact');
  check(helpers.spellLevelNumber('1st') === 1 && helpers.spellLevelNumber('2nd') === 2
    && helpers.spellLevelNumber('3rd') === 3 && helpers.spellLevelNumber('9th') === 9,
    'spellLevelNumber reads ordinal labels');
  check(helpers.spellLevelNumber('cantrip') === 0 && helpers.spellLevelNumber(3) === 3,
    'spellLevelNumber reads cantrip as 0 and a bare number as itself');
  check(helpers.spellLevelNumber('nope') === null, 'spellLevelNumber returns null for an unreadable label');
  check(helpers.spellLevelLabel(1) === '1st' && helpers.spellLevelLabel(2) === '2nd'
    && helpers.spellLevelLabel(3) === '3rd' && helpers.spellLevelLabel(9) === '9th',
    'spellLevelLabel writes ordinal labels');
}

// (b) Copy candidates + Memorize options (the real sheet helpers).
group('(b) Copy candidates + Memorize options');
{
  // Stub catalog in the client spells/index.js shape: entries carry
  // title-case names and lowercase class tags. Spells are real and in
  // their real level buckets (no invented entries).
  const catalog = {
    '1st': [
      { name: 'Magic Missile', school: 'Evocation', classes: ['wizard', 'sorcerer'] },
      { name: 'Shield', school: 'Abjuration', classes: ['wizard', 'sorcerer'] },
      { name: 'Cure Wounds', school: 'Abjuration', classes: ['cleric', 'bard'] },
      { name: 'Burning Hands', school: 'Evocation', classes: ['wizard', 'sorcerer'] },
    ],
    '2nd': [
      { name: 'Misty Step', school: 'Conjuration', classes: ['wizard', 'sorcerer', 'warlock'] },
      { name: 'Scorching Ray', school: 'Evocation', classes: ['wizard', 'sorcerer'] },
    ],
    '3rd': [
      { name: 'Fireball', school: 'Evocation', classes: ['wizard', 'sorcerer'] },
    ],
  };
  const book = ['magic missile'];
  const l1 = helpers.copyableSpellCandidates({ spellsByLevel: catalog, slotLevels: [1], bookNames: book });
  check(JSON.stringify(l1.map(c => c.name)) === JSON.stringify(['Burning Hands', 'Shield']),
    `L1 candidates exclude the book spell and non-wizard spells (got ${JSON.stringify(l1.map(c => c.name))})`);
  check(l1.every(c => c.gold === 50 && c.hours === 2), 'L1 candidates cost 50 gp + 2 h each');
  const l2 = helpers.copyableSpellCandidates({ spellsByLevel: catalog, slotLevels: [1, 2], bookNames: book });
  check(l2.some(c => c.name === 'Misty Step' && c.gold === 100 && c.hours === 4),
    'a 2nd-level candidate costs 100 gp + 4 h once the wizard has 2nd-level slots');
  check(!l2.some(c => c.name === 'Fireball'), 'a 3rd-level spell is not offered without 3rd-level slots');
  const l3 = helpers.copyableSpellCandidates({ spellsByLevel: catalog, slotLevels: [1, 2, 3], bookNames: book });
  check(l3.some(c => c.name === 'Fireball' && c.gold === 150 && c.hours === 6),
    'a 3rd-level candidate costs 150 gp + 6 h once the wizard has 3rd-level slots');
  check(JSON.stringify(l3.map(c => c.level)) === JSON.stringify([...l3.map(c => c.level)].sort((a, b) => a - b)),
    'candidates sort by level, then name');
  const searched = helpers.copyableSpellCandidates({ spellsByLevel: catalog, slotLevels: [1], bookNames: book, search: 'burn' });
  check(JSON.stringify(searched.map(c => c.name)) === JSON.stringify(['Burning Hands']),
    'search filters candidates by substring');
  const searchedCase = helpers.copyableSpellCandidates({ spellsByLevel: catalog, slotLevels: [1], bookNames: book, search: 'SHIELD' });
  check(JSON.stringify(searchedCase.map(c => c.name)) === JSON.stringify(['Shield']),
    'search is case-insensitive');
  const fullBook = helpers.copyableSpellCandidates({ spellsByLevel: catalog, slotLevels: [1], bookNames: ['magic missile', 'shield', 'burning hands'] });
  check(fullBook.length === 0, 'no candidates when every L1 wizard spell is already in the book');

  // Scroll copying (2026-11-08): the real picker helpers — the
  // spell rides the inventory row NAME, canonical form
  // `Spell Scroll of <Spell>` (D1). Level-named rows hold no spell.
  check(helpers.scrollSpellFromName('Spell Scroll of Fireball') === 'Fireball',
    'a canonical scroll row parses to its spell');
  check(helpers.scrollSpellFromName('spell scroll of fireball') === 'fireball',
    'the scroll parse is case-insensitive on the fixed prefix and keeps the spell as written');
  check(helpers.scrollSpellFromName('  Spell Scroll of   Misty Step  ') === 'Misty Step',
    'the scroll parse trims the name and the spell');
  check(helpers.scrollSpellFromName('Spell Scroll (1st Level)') === null,
    'a level-named scroll holds no spell — it parses to null');
  check(helpers.scrollSpellFromName('Spell Scroll') === null,
    'a bare scroll name with no spell parses to null');
  check(helpers.scrollSpellFromName('Spell Scroll of ') === null,
    'a scroll named of nothing parses to null');
  check(helpers.scrollSpellFromName('Potion of Healing') === null,
    'a non-scroll row parses to null');
  check(helpers.scrollSpellFromName(null) === null && helpers.scrollSpellFromName(42) === null,
    'the scroll parse on a non-string is null, never a throw');
  const scrollRows = helpers.spellScrollRows([
    { name: 'Spell Scroll of Fireball', quantity: 2 },
    { name: 'Spell Scroll (1st Level)', quantity: 1 },
    { name: 'Rope', quantity: 1 },
    'Spell Scroll of Misty Step',
    { name: 'spell scroll of SHIELD', quantity: 1 },
  ]);
  check(JSON.stringify(scrollRows) === JSON.stringify([
    { name: 'Spell Scroll of Fireball', spell: 'Fireball', quantity: 2 },
    { name: 'Spell Scroll of Misty Step', spell: 'Misty Step', quantity: 1 },
    { name: 'spell scroll of SHIELD', spell: 'SHIELD', quantity: 1 },
  ]), `scroll rows list with their spells, level-named and non-scroll rows left out (got ${JSON.stringify(scrollRows)})`);
  check(helpers.spellScrollRows(null).length === 0 && helpers.spellScrollRows('nope').length === 0,
    'scroll rows on a non-array inventory is an empty list, never a throw');
  check(JSON.stringify(helpers.spellScrollRows([
    { name: 'Spell Scroll of Fireball', quantity: 1 },
    { name: 'Spell Scroll of Fireball', quantity: 1 },
  ]).map((r) => r.name)) === JSON.stringify(['Spell Scroll of Fireball', 'Spell Scroll of Fireball']),
    'two rows with the same scroll name are both listed — the server matches by name');
  const opts = helpers.memorizeSwapOptions({
    prepared: ['magic missile', 'shield'],
    book: ['magic missile', 'shield', 'misty step'],
    alwaysPrepared: ['shield'],
  });
  check(JSON.stringify(opts.oldOptions) === JSON.stringify(['magic missile']),
    `Memorize swap-out excludes the always-prepared pick (got ${JSON.stringify(opts.oldOptions)})`);
  check(JSON.stringify(opts.newOptions) === JSON.stringify(['misty step']),
    `Memorize swap-in offers only book spells not already prepared (got ${JSON.stringify(opts.newOptions)})`);
  const empty = helpers.memorizeSwapOptions({ prepared: [], book: [], alwaysPrepared: [] });
  check(empty.oldOptions.length === 0 && empty.newOptions.length === 0,
    'Memorize options are empty lists for an empty book');

  // Replacement + backup previews (2026-11-07): the real helpers
  // the sheet prices its panels with. Levels come from a stub
  // levelOf here; the sheet passes its catalog lookup.
  const levelOf = (name) => ({ 'magic missile': 1, shield: 1, 'mage armor': 1, 'misty step': 2, fireball: 3 }[String(name).toLowerCase()] ?? null);
  const preview = helpers.replacementPreview({ prepared: ['Magic Missile', 'Shield', 'Misty Step', 'Fireball'], alwaysPrepared: [], levelOf });
  check(JSON.stringify(preview.entries.map(e => [e.name, e.level, e.gold, e.hours])) === JSON.stringify([['Magic Missile', 1, 10, 1], ['Shield', 1, 10, 1], ['Misty Step', 2, 20, 2], ['Fireball', 3, 30, 3]]),
    `replacement preview prices each prepared spell at 1h + 10 gp/level (got ${JSON.stringify(preview.entries)})`);
  check(preview.totalGold === 70 && preview.totalHours === 7,
    'replacement preview totals 70 gp + 7 h for levels 1,1,2,3');
  const previewWithPick = helpers.replacementPreview({ prepared: ['Magic Missile'], alwaysPrepared: ['Shield'], levelOf });
  check(previewWithPick.entries.length === 2 && previewWithPick.totalGold === 20,
    'an always-prepared pick rides the transcription and is costed like any prepared spell');
  const previewDupe = helpers.replacementPreview({ prepared: ['Magic Missile', 'magic missile'], alwaysPrepared: ['Magic Missile'], levelOf });
  check(previewDupe.entries.length === 1, 'the preview dedupes by canonical name, prepared first');
  const previewUnknown = helpers.replacementPreview({ prepared: ['Magic Missile', 'Weird Spell'], levelOf });
  check(previewUnknown.unknownLevels.length === 1 && previewUnknown.unknownLevels[0] === 'Weird Spell' && previewUnknown.totalGold === 10,
    'a spell the catalog cannot price is listed unknown and never guessed');
  // V6 (spell by spell, 2026-11-08): the preview takes a
  // `transcribed` list — spells already transcribed into the new
  // book are left out, so it prices only what is still to
  // transcribe.
  const previewSubset = helpers.replacementPreview({ prepared: ['Magic Missile', 'Shield', 'Misty Step', 'Fireball'], alwaysPrepared: [], levelOf, transcribed: ['Magic Missile', 'Shield'] });
  check(JSON.stringify(previewSubset.entries.map(e => e.name)) === JSON.stringify(['Misty Step', 'Fireball']),
    `a subset preview prices only the spells not yet transcribed (got ${JSON.stringify(previewSubset.entries.map(e => e.name))})`);
  check(previewSubset.totalGold === 50 && previewSubset.totalHours === 5,
    'a subset preview totals 50 gp + 5 h for levels 2,3');
  const previewDone = helpers.replacementPreview({ prepared: ['Magic Missile', 'Shield'], alwaysPrepared: [], levelOf, transcribed: ['Magic Missile', 'Shield'] });
  check(previewDone.entries.length === 0 && previewDone.totalGold === 0 && previewDone.totalHours === 0,
    'a fully transcribed preview is empty — nothing left to price');
  const previewNoTranscribed = helpers.replacementPreview({ prepared: ['Magic Missile', 'Shield'], alwaysPrepared: [], levelOf });
  check(previewNoTranscribed.entries.length === 2, 'no transcribed list means the whole prepared list, as before');
  // The replacement episode (V6): the server's in-progress
  // detector, mirrored — the stored book is the transcribed set
  // only while an episode is under way, and the blank book is
  // charged only on the first memory-path call for a book.
  const freshLost = helpers.parseSpellbookState('{"status":"lost","mastery":[],"signature":[]}');
  const progressFresh = helpers.replaceEpisodeProgress({ state: freshLost, book: ['Magic Missile', 'Shield', 'Misty Step', 'Fireball'], prepared: ['Magic Missile', 'Shield', 'Misty Step', 'Fireball'], alwaysPrepared: [] });
  check(progressFresh.inProgress === false && progressFresh.transcribed.length === 0 && progressFresh.bookCostDue === true,
    'a fresh loss is no episode — the old book is gone, not transcribed, and the blank book is due');
  const inProgressState = helpers.parseSpellbookState('{"status":"lost","mastery":[],"signature":[],"bookCost":50}');
  const progressIn = helpers.replaceEpisodeProgress({ state: inProgressState, book: ['Fireball'], prepared: ['Magic Missile', 'Shield', 'Misty Step', 'Fireball'], alwaysPrepared: [] });
  check(progressIn.inProgress === true && JSON.stringify(progressIn.transcribed) === JSON.stringify(['Fireball']) && progressIn.bookCostDue === false,
    'a stored book cost + a prepared-only book means an episode in progress — the book is the transcribed set and the blank book is paid');
  const doneState = helpers.parseSpellbookState('{"status":"intact","mastery":[],"signature":[],"bookCost":50,"replaced":"prepared"}');
  const progressDone = helpers.replaceEpisodeProgress({ state: doneState, book: ['Magic Missile', 'Shield'], prepared: ['Magic Missile', 'Shield'], alwaysPrepared: [] });
  check(progressDone.inProgress === false && progressDone.bookCostDue === false,
    'a completed replacement carries the marker, so no new book cost is due');
  const relossState = helpers.parseSpellbookState('{"status":"lost","mastery":[],"signature":[],"bookCost":50}');
  const progressReloss = helpers.replaceEpisodeProgress({ state: relossState, book: ['Magic Missile', 'Weird Spell'], prepared: ['Magic Missile', 'Shield'], alwaysPrepared: [] });
  check(progressReloss.inProgress === false && progressReloss.transcribed.length === 0 && progressReloss.bookCostDue === true,
    'a book holding an unprepared spell is no episode — the old contents are gone and the blank book is due again');
  const restore = helpers.backupRestorePreview({ prepared: ['Magic Missile', 'Shield', 'Fireball'], backup: ['Magic Missile', 'Shield', 'Misty Step'], alwaysPrepared: ['Fireball'] });
  check(JSON.stringify(restore.spells) === JSON.stringify(['Magic Missile', 'Shield', 'Misty Step']),
    'a backup restore is the full backup contents');
  check(JSON.stringify(restore.droppedPrepared) === JSON.stringify(['Fireball']),
    'the restore preview names the prepared spell the backup lacks');
  check(JSON.stringify(restore.droppedAlwaysPrepared) === JSON.stringify(['Fireball']),
    'the restore preview names the always-prepared pick the backup lacks');
  const restoreFull = helpers.backupRestorePreview({ prepared: ['Magic Missile'], backup: ['Magic Missile', 'Shield'], alwaysPrepared: [] });
  check(restoreFull.droppedPrepared.length === 0, 'no drops when the backup covers the prepared list');
  const backupCands = helpers.backupCopyCandidates({ book: ['Magic Missile', 'Shield', 'Misty Step', 'Fireball'], backup: ['Shield'], levelOf });
  check(JSON.stringify(backupCands.candidates.map(c => [c.name, c.level, c.gold, c.hours])) === JSON.stringify([['Magic Missile', 1, 10, 1], ['Misty Step', 2, 20, 2], ['Fireball', 3, 30, 3]]),
    `backup copy candidates exclude the backed-up spell and price the rest at the replace rate (got ${JSON.stringify(backupCands.candidates)})`);
  const backupCandsUnknown = helpers.backupCopyCandidates({ book: ['Magic Missile', 'Weird Spell'], backup: [], levelOf });
  check(backupCandsUnknown.candidates.length === 1 && backupCandsUnknown.unknownLevels[0] === 'Weird Spell',
    'a book spell the catalog cannot price is listed unknown, not offered without a cost');
}

// (c) Draft save / resume carries both lists (real stage1Persistence).
group('(c) Draft save + rehydration carry the book and the prepared subset');
{
  const book = ['magic missile', 'shield', 'mage armor', 'sleep', 'alarm', 'burning hands'];
  const prepared = ['magic missile', 'shield', 'mage armor'];
  const row = {
    first_name: 'Wren', class: 'wizard', race: 'human',
    known_spells: JSON.stringify(book), prepared_spells: JSON.stringify(prepared),
  };
  const patch = rehydrateStateFromServerRow(row, null);
  check(JSON.stringify(patch.known_spells) === JSON.stringify(book),
    'rehydration reads the 6-spell book back from the server row');
  check(JSON.stringify(patch.prepared_spells) === JSON.stringify(prepared),
    'rehydration reads the prepared subset back from the server row');
  check(patch.stage4PicksClass === 'wizard',
    'rehydration records the picks class so Stage 4 does not clear them on mount');
  const body = buildStage1ProgressBody({ known_spells: book, prepared_spells: prepared });
  check(JSON.stringify(JSON.parse(body.known_spells)) === JSON.stringify(book),
    'the save body carries the 6-spell book as a JSON string');
  check(JSON.stringify(JSON.parse(body.prepared_spells)) === JSON.stringify(prepared),
    'the save body carries the prepared subset as a JSON string');
  const emptyBody = buildStage1ProgressBody({ known_spells: [], prepared_spells: prepared });
  check(!('known_spells' in emptyBody),
    'an empty book sends no known_spells key — the draft stays draft-tolerant, never an empty overwrite');
  const bareRow = { first_name: 'Wren', class: 'wizard', race: 'human', known_spells: '[]', prepared_spells: '[]' };
  const barePatch = rehydrateStateFromServerRow(bareRow, null);
  check(!('known_spells' in barePatch) && !('prepared_spells' in barePatch),
    'rehydration leaves absent lists blank instead of writing empty lists over picks');
}

// (d) Sheet static pins + real esbuild bundle (the live CharacterSheet.jsx).
group('(d) Sheet Spellbook section (static pins + real bundle)');
{
  const sheetSrc = readRepo('client/src/components/CharacterSheet.jsx');
  check(!sheetSrc.includes("prompt('Enter spell name to add to your spellbook"),
    'the free-text Add to Spellbook prompt is gone (no unvalidated book write)');
  check(!sheetSrc.includes('>+ Add to Spellbook</button>'),
    'no Add to Spellbook button remains');
  check(sheetSrc.includes('/copy-spell'), 'the sheet calls POST /:id/copy-spell');
  check(sheetSrc.includes('/spellbook-always-prepared'), 'the sheet calls POST /:id/spellbook-always-prepared');
  check(sheetSrc.includes('/spellbook-status'), 'the sheet calls POST /:id/spellbook-status');
  // Memorize Spell, banked (rest consolidation, 2026-11-07): the sheet
  // no longer takes a rest at all — it banks the swap and the next DM
  // short rest applies it. The deleted POST /:id/rest call, the old
  // handler, the old button, and the false half-HP promise are all gone.
  check(sheetSrc.includes('/memorize-bank'), 'the sheet calls the memorize-bank endpoints');
  check(sheetSrc.includes('memorizeSwap'), 'the sheet banks Memorize Spell as a memorizeSwap pick');
  check(sheetSrc.includes('bankMemorizeSwap'), 'the sheet banks the swap instead of resting');
  check(sheetSrc.includes('clearMemorizeBank'), 'the sheet can clear a banked swap');
  check(sheetSrc.includes('pendingMemorizeSwap'), 'the sheet reads the banked swap back from spellbook_json');
  check(!sheetSrc.includes('takeShortRestAndSwap'), 'the old rest-and-swap handler is gone');
  check(!sheetSrc.includes("restType: 'short'"), 'the Memorize surface sends no restType any more');
  check(!sheetSrc.includes('`/api/character/${character.id}/rest`'), 'the sheet never calls the deleted POST /:id/rest route');
  check(!sheetSrc.includes('Take a short rest & swap'), 'the old rest-and-swap button is gone');
  check(!sheetSrc.includes('restores half your missing HP'), 'no copy still promises the deleted flat half-HP short-rest heal');
  check(sheetSrc.includes('Bank swap for next short rest'), 'the sheet renders the bank-swap button');
  check(sheetSrc.includes('Banked: swap'), 'the sheet shows the banked swap');
  check(sheetSrc.includes('Clear bank'), 'the sheet offers clearing the bank');
  check(sheetSrc.includes('applies at your next short rest'), 'the sheet says plainly the swap applies at the next short rest');
  check(sheetSrc.includes('heals through hit dice only'), 'the sheet states the DM short rest heals through hit dice only');
  check(sheetSrc.includes('parseSpellbookState(character.spellbook_json)'),
    'the sheet parses spellbook_json from the fetched row');
  check(sheetSrc.includes('SPELL_MASTERY_LEVEL') && sheetSrc.includes('SIGNATURE_SPELLS_LEVEL'),
    'the sheet gates Mastery/Signature on the level constants');
  check(sheetSrc.includes('Spellbook ({knownSpells.length}'),
    'the sheet renders the book count against the expected size');
  check(sheetSrc.includes('Copy a spell into your spellbook'),
    'the sheet renders the copy action');
  check(sheetSrc.includes('Copied from — name the spellbook'),
    'the copy panel requires naming the source spellbook');
  check(sheetSrc.includes('Mark book lost') && sheetSrc.includes('Mark book recovered'),
    'the sheet surfaces the DM status lever');
  check(sheetSrc.includes('Bank swap for next short rest') && sheetSrc.includes('Memorize Spell — bank a Short Rest swap'),
    'the sheet renders the banked Memorize Spell surface');
  check(sheetSrc.includes('always prepared — Spell Mastery') && sheetSrc.includes('always prepared — Signature Spells'),
    'the book list marks always-prepared picks');
  check(sheetSrc.includes('★ prepared'),
    'the book list marks prepared spells');
  check(sheetSrc.includes('spellSaveError'),
    'the sheet surfaces refused saves instead of replacing the character with an error body');
  check(sheetSrc.includes('response.ok'),
    'the sheet checks the save responses before trusting them');
  check(sheetSrc.includes('spellbook is lost'),
    'the sheet states the lost-book consequence in plain words');
  // Spellbook replacement + backup (2026-11-07): the sheet calls
  // both new routes, shows the replacement cost up front, names
  // what a backup restore would drop, and surfaces server refusals
  // verbatim. The old "no replacement UI" pin is retired — the
  // sidebar is verified and the UI is built.
  check(sheetSrc.includes('/spellbook-replace'), 'the sheet calls POST /:id/spellbook-replace');
  check(sheetSrc.includes('/spellbook-backup'), 'the sheet calls POST /:id/spellbook-backup');
  check(sheetSrc.includes('Replace the spellbook'), 'the sheet renders the replacement panel');
  check(sheetSrc.includes("source: replaceSource"), 'the replacement sends the chosen source (memory | backup)');
  check(sheetSrc.includes('setReplaceError(data?.error'), 'a replacement refusal surfaces the server error verbatim');
  check(sheetSrc.includes('setBackupError(data?.error'), 'a backup refusal surfaces the server error verbatim');
  check(sheetSrc.includes('Total: {replacePreview.totalGold}'), 'the replacement panel shows the total gold + hours before confirm');
  check(sheetSrc.includes('From memory — transcribe my prepared spells'), 'the replacement panel offers re-transcribing from memory');
  check(sheetSrc.includes('From my backup spellbook — restore the whole backup'), 'the replacement panel offers restoring from the backup');
  check(sheetSrc.includes('will be dropped from your prepared list'), 'the backup-restore preview names the prepared spells it would drop');
  check(sheetSrc.includes('Backup spellbook'), 'the sheet renders the backup surface in the Spellbook section');
  check(sheetSrc.includes('Copy into backup'), 'the sheet renders the copy-into-backup control');
  check(sheetSrc.includes('copySpellIntoBackup'), 'the sheet wires the backup-copy handler');
  check(sheetSrc.includes('replaceCostForSpellLevel'), 'the sheet prices replacement + backup at the replace rate');
  check(sheetSrc.includes('replacementPreview'), 'the sheet previews the transcription cost with the real helper');
  check(sheetSrc.includes('backupRestorePreview'), 'the sheet previews a backup restore with the real helper');
  check(sheetSrc.includes('backupCopyCandidates'), 'the sheet lists backup-copy candidates with the real helper');
  check(sheetSrc.includes('replaceSpellbook') && sheetSrc.includes('setCharacter(data.character)'),
    'a successful replacement re-reads the character so book, prepared list, and status update');
  // V5 + V6 (2026-11-08): the replace panel transcribes a picked
  // subset, stays open after a partial transcription, names what is
  // still to transcribe, and charges the blank book once.
  check(sheetSrc.includes('replaceSelected'), 'the replace panel tracks a picked subset to transcribe');
  check(sheetSrc.includes('Transcribe selected'), 'the replace panel confirms a picked subset');
  check(sheetSrc.includes('Transcribe all remaining'), 'the replace panel keeps the transcribe-all-remaining flow');
  check(sheetSrc.includes('Select all remaining'), 'the replace panel offers selecting every spell still to transcribe');
  check(sheetSrc.includes('replaceEpisodeProgress'), 'the sheet reads the replacement episode with the real helper');
  check(sheetSrc.includes('bookCostDue'), 'the sheet knows whether the blank book is still to be paid for');
  check(sheetSrc.includes('body.spells = replaceSelected'), 'the replacement sends the picked subset to the server');
  check(sheetSrc.includes('remainingSpells'), 'the outcome names the spells still to transcribe');
  check(sheetSrc.includes('Still to transcribe:'), 'the result line names the remaining spells in plain words');
  check(sheetSrc.includes('Transcribed so far:'), 'the panel shows the spells already transcribed into the new book');
  check(sheetSrc.includes('Blank spellbook'), 'the replace panel shows the blank-book cost line');
  check(sheetSrc.includes('bookMaterials'), 'the replace panel takes the book materials');
  check(sheetSrc.includes('SPELLBOOK_MATERIALS'), 'the sheet prices the blank book from the fixed materials table');
  check(sheetSrc.includes('spellbookMaterialCost'), 'the sheet derives blank-book totals from the table');
  check(sheetSrc.includes('spellbookMaterialLabel'), 'the sheet prints the table label for a stored materials key');
  check(sheetSrc.includes('Object.entries(SPELLBOOK_MATERIALS)'), 'both book panels build the materials dropdown from the table');
  check(sheetSrc.includes('body.bookMaterials = replaceBookMaterials'), 'the replacement sends only the materials key on the charging call');
  check(sheetSrc.includes('backupBody.bookMaterials = backupBookMaterials'), 'the backup copy sends only the materials key on the first copy');
  check(!sheetSrc.includes('body.bookCost') && !sheetSrc.includes('backupBody.bookCost'), 'the sheet never sends a bookCost number any more — the server derives the price');
  check(!sheetSrc.includes('value={replaceBookCost}') && !sheetSrc.includes('value={backupBookCost}'), 'no typed price input remains in either book panel');
  check(!sheetSrc.includes('What is it made of?'), 'no free-text materials input remains in either book panel');
  check(sheetSrc.includes('value={replaceBookMaterials}') && sheetSrc.includes('value={backupBookMaterials}'), 'both panels hold the picked materials key in state');
  check(sheetSrc.includes("useState('standard')"), 'the materials pick defaults to standard (50 gp)');
  check(sheetSrc.includes('{row.label} — {row.cost} gp'), 'each dropdown option shows its label and price');
  check(sheetSrc.includes('bookCostCharged'), 'the outcome names the blank-book charge from the server response');
  check(sheetSrc.includes('lands in the new book at once'), 'the panel Tip says a transcribed spell lands in the book at once');
  check(sheetSrc.includes('becomes usable when every prepared spell is transcribed'), 'the panel Tip says the book becomes usable when every prepared spell is transcribed');
  check(sheetSrc.includes('Blank backup book'), 'the backup panel shows the blank-book cost line on the first copy');
  check(sheetSrc.includes('replacedCleared'), 'the sheet surfaces a cleared replaced marker after a copy into a replaced book');
  // Scroll copying (2026-11-08): the copy panel gains a scroll
  // picker over the wizard's inventory rows, and the copy body
  // carries the scroll identity. The found-book path is unchanged.
  check(sheetSrc.includes('spellScrollRows'), 'the sheet lists scroll rows with the real picker helper');
  check(sheetSrc.includes('spellScrollRows(inventory)'), 'the scroll picker reads the wizard\'s inventory rows');
  check(sheetSrc.includes('scrollCopyCandidates'), 'the sheet derives scroll-copy candidates beside the found-book candidates');
  check(sheetSrc.includes('scrollRows'), 'the sheet tracks which inventory rows are spell scrolls');
  check(sheetSrc.includes('From a spell scroll in your inventory'), 'the sheet renders the scroll picker section');
  check(sheetSrc.includes('From a found spellbook'), 'the sheet labels the found-book path beside the scroll picker');
  check(sheetSrc.includes('Your scrolls hold no spell you can copy yet'), 'the sheet says plainly when owned scrolls hold no copyable spell');
  check(!sheetSrc.includes('Scrolls cannot be copied yet'), 'the old Tip saying scrolls cannot be copied is gone');
  check(sheetSrc.includes('Spell Scroll of Fireball'), 'the reworded Tip names the canonical scroll form');
  check(sheetSrc.includes('Spell Scroll (1st Level)'), 'the reworded Tip says a level-named scroll holds no spell');
  check(sheetSrc.includes('A scroll copy consumes the scroll'), 'the reworded Tip says a scroll copy consumes the scroll');
  check(sheetSrc.includes('Nothing to Waste'), 'the panel names the Hedge Mage exception');
  check(sheetSrc.includes("source: 'scroll'"), 'a scroll copy sends source: \'scroll\'');
  check(sheetSrc.includes('scrollName: copySelected.scrollName'), 'a scroll copy sends the exact inventory row name as scrollName');
  check(sheetSrc.includes("source: copySource.trim()"), 'a found-book copy still sends the free-text source');
  check(sheetSrc.includes('copyIsScroll'), 'the sheet branches the scroll path on the picked scroll, not separate state');
  check(sheetSrc.includes('!copyIsScroll && !copySource.trim()'), 'confirm needs a source only for a found-book copy — a scroll pick needs none');
  check(sheetSrc.includes('Copying from {copySelected.scrollName}'), 'a scroll pick shows which scroll the copy comes from');
  check(sheetSrc.includes('scrollConsumed'), 'the sheet renders the scroll\'s fate from the server response');
  check(sheetSrc.includes('was consumed'), 'the result line names the scroll consumed');
  check(sheetSrc.includes('was kept'), 'the result line names the scroll kept (Hedge Mage)');
  check(sheetSrc.includes('the scroll is consumed'), 'each scroll row says the scroll is consumed');
  check(sheetSrc.includes('Copied from — name the spellbook'), 'the found-book path still asks for the source spellbook by name');
  // Stay-open: the replace handler must not close the panel — a
  // partial transcription leaves it open for the next subset.
  // (The Cancel button still closes it; that close is outside the
  // handler.)
  const replaceStart = sheetSrc.indexOf('const replaceSpellbook');
  const replaceEnd = sheetSrc.indexOf('const copySpellIntoBackup', replaceStart);
  const replaceRegion = replaceStart >= 0 && replaceEnd > replaceStart ? sheetSrc.slice(replaceStart, replaceEnd) : '';
  check(replaceStart >= 0 && !replaceRegion.includes('setShowReplacePanel(false)'),
    'the replace handler never closes the panel — it stays open after a partial transcription');
  check(!sheetSrc.includes('prompt('), 'the sheet adds no free-text prompt() — the count stays 0');

  // Real bundle: the sheet + its real imports (Tip, helpers, data)
  // must resolve — a broken named import fails the bundle, not a
  // runtime render the tests never see.
  const stubPath = path.join(tmpDir, 'react-stub.mjs');
  fs.writeFileSync(stubPath, [
    'export const useState = (v) => [v, () => {}];',
    'export const useEffect = () => {};',
    'export const useMemo = (f) => f();',
    'export const useRef = (v) => ({ current: v });',
    'export const useCallback = (f) => f;',
    'export const useContext = () => null;',
    'export function createElement() { return null; }',
    'export default { createElement: () => null };',
    '',
  ].join('\n'));
  function findEsbuild() {
    const cands = [
      path.join(repoRoot, 'client', 'node_modules', '.bin', 'esbuild'),
      path.join(repoRoot, 'node_modules', '.bin', 'esbuild'),
    ];
    for (const c of cands) if (fs.existsSync(c)) return { bin: c, prefix: [] };
    return { bin: 'npx', prefix: ['--yes', 'esbuild'] };
  }
  function bundleAbs(entryAbs, outName) {
    const { bin, prefix } = findEsbuild();
    const out = path.join(tmpDir, outName);
    execFileSync(bin, [...prefix, entryAbs, '--bundle', '--format=esm', `--outfile=${out}`, `--alias:react=${stubPath}`, '--log-level=warning'], { stdio: 'pipe' });
    return out;
  }
  let sheetBundle = null;
  try {
    sheetBundle = fs.readFileSync(bundleAbs(path.join(repoRoot, 'client/src/components/CharacterSheet.jsx'), 'sheet.bundle.mjs'), 'utf-8');
    check(sheetBundle.length > 1000, 'CharacterSheet bundles against the real Tip/helpers/data imports');
  } catch (e) {
    check(false, `CharacterSheet esbuild bundle failed: ${e.message}`);
  }
  if (sheetBundle) {
    check(sheetBundle.includes('/copy-spell'), 'bundled sheet contains the copy-spell route');
    check(sheetBundle.includes('memorizeSwap'), 'bundled sheet contains the Memorize swap param');
    check(sheetBundle.includes('/memorize-bank'), 'bundled sheet contains the memorize-bank route');
    check(!sheetBundle.includes('Take a short rest & swap'), 'bundled sheet contains no rest-and-swap button');
    check(sheetBundle.includes('Copy a spell into your spellbook'), 'bundled sheet contains the copy action label');
    check(sheetBundle.includes('/spellbook-replace'), 'bundled sheet contains the spellbook-replace route');
    check(sheetBundle.includes('/spellbook-backup'), 'bundled sheet contains the spellbook-backup route');
    check(sheetBundle.includes('Replace the spellbook'), 'bundled sheet contains the replacement panel label');
    check(sheetBundle.includes('Copy into backup'), 'bundled sheet contains the backup-copy label');
    check(sheetBundle.includes('Backup spellbook'), 'bundled sheet contains the backup surface label');
    check(sheetBundle.includes('Transcribe selected'), 'bundled sheet contains the subset-confirm label');
    check(sheetBundle.includes('Transcribe all remaining'), 'bundled sheet contains the transcribe-all label');
    check(sheetBundle.includes('Blank spellbook'), 'bundled sheet contains the blank-book line');
    check(sheetBundle.includes('Blank backup book'), 'bundled sheet contains the blank backup-book line');
    check(sheetBundle.includes('Dragonhide-bound'), 'bundled sheet contains the dragonhide table label');
    check(sheetBundle.includes('Gilt-edged tome'), 'bundled sheet contains the gilt-edged table label');
    check(sheetBundle.includes('Vellum bound with twine'), 'bundled sheet contains the vellum table label');
    check(sheetBundle.includes('From a spell scroll in your inventory'), 'bundled sheet contains the scroll picker section');
    check(sheetBundle.includes('From a found spellbook'), 'bundled sheet contains the found-book label');
    check(sheetBundle.includes('Your scrolls hold no spell you can copy yet'), 'bundled sheet contains the no-copyable-scroll note');
    check(sheetBundle.includes('scrollConsumed'), 'bundled sheet contains the scroll-fate report');
    check(!sheetBundle.includes('Scrolls cannot be copied yet'), 'bundled sheet contains no copy of the old scroll refusal');
    // Mutation check: delete the copy label from a temp copy — the
    // pin must fail on the mutated bundle, proving it is sensitive
    // to the copy action itself. The temp copy lives beside the
    // real file (same directory, so its relative imports resolve)
    // and is unlinked in the finally below.
    const mutatedPath = path.join(repoRoot, 'client/src/components/CharacterSheet.mutated.jsx');
    fs.writeFileSync(mutatedPath, sheetSrc.replace('Copy a spell into your spellbook', 'CopyXX a spell into your spellbook'));
    let mutatedBundle = null;
    try {
      mutatedBundle = fs.readFileSync(bundleAbs(mutatedPath, 'sheet-mutated.bundle.mjs'), 'utf-8');
    } catch (e) {
      check(false, `mutated sheet bundle failed: ${e.message}`);
    } finally {
      try { fs.unlinkSync(mutatedPath); } catch {}
    }
    if (mutatedBundle) {
      check(!mutatedBundle.includes('Copy a spell into your spellbook'),
        'mutation check: the copy-label pin fails when the copy action is deleted');
      check(mutatedBundle.includes('/copy-spell'),
        'mutation check: the mutated bundle still builds (only the label went)');
    }
    // Mutation check: delete the subset-confirm label from a temp
    // copy — the pin must fail, proving it is sensitive to the
    // subset picker itself. The temp copy lives beside the real
    // file (same directory, so its relative imports resolve) and is
    // unlinked in the finally below.
    const mutatedSubsetPath = path.join(repoRoot, 'client/src/components/CharacterSheet.subset-mutated.jsx');
    fs.writeFileSync(mutatedSubsetPath, sheetSrc.replace('Transcribe selected', 'TranscribeXX selected'));
    let mutatedSubsetBundle = null;
    try {
      mutatedSubsetBundle = fs.readFileSync(bundleAbs(mutatedSubsetPath, 'sheet-subset-mutated.bundle.mjs'), 'utf-8');
    } catch (e) {
      check(false, `mutated subset sheet bundle failed: ${e.message}`);
    } finally {
      try { fs.unlinkSync(mutatedSubsetPath); } catch {}
    }
    if (mutatedSubsetBundle) {
      check(!mutatedSubsetBundle.includes('Transcribe selected'),
        'mutation check: the subset-confirm pin fails when the subset picker is deleted');
      check(mutatedSubsetBundle.includes('Transcribe all remaining'),
        'mutation check: the mutated bundle still builds (only the subset label went)');
    }
  }
}

// (e) Mutation check: a drifted client constant must disagree with
// the server (the cross-pin in (a) is what would catch it in CI).
group('(e) Mutation check: client/server constant drift is detectable');
{
  const mutatedPath = path.join(tmpDir, 'spellbookHelpers-mutated.js');
  fs.writeFileSync(mutatedPath, readRepo('client/src/components/spellbookHelpers.js')
    .replace('COPY_GOLD_PER_SPELL_LEVEL = 50', 'COPY_GOLD_PER_SPELL_LEVEL = 40'));
  const mutated = await import(pathToFileURL(mutatedPath).href);
  check(mutated.COPY_GOLD_PER_SPELL_LEVEL !== serverSvc.COPY_GOLD_PER_SPELL_LEVEL,
    'mutation check: a 40-gp client constant disagrees with the server 50-gp constant');
  check(mutated.copyCostForSpellLevel(2).gold === 80 && serverSvc.copyCostForSpellLevel(2).gold === 100,
    'mutation check: the drift changes the priced cost (80 vs 100 gp), not just a label');
  check(mutated.spellbookSizeForLevel(1) === serverSvc.spellbookSizeForLevel(1),
    'mutation check: the untouched size formula still agrees (the drift is localized)');
  // Replacement rate (2026-11-07): the same tripwire at the 1h +
  // 10 gp rate — a 50-gp client replace constant must disagree with
  // the server, or the panel would silently charge the copy rate.
  const mutatedReplacePath = path.join(tmpDir, 'spellbookHelpers-mutated-replace.js');
  fs.writeFileSync(mutatedReplacePath, readRepo('client/src/components/spellbookHelpers.js')
    .replace('REPLACE_GOLD_PER_SPELL_LEVEL = 10', 'REPLACE_GOLD_PER_SPELL_LEVEL = 50'));
  const mutatedReplace = await import(pathToFileURL(mutatedReplacePath).href);
  check(mutatedReplace.REPLACE_GOLD_PER_SPELL_LEVEL !== serverSvc.REPLACE_GOLD_PER_SPELL_LEVEL,
    'mutation check: a 50-gp client replace constant disagrees with the server 10-gp constant');
  check(mutatedReplace.replaceCostForSpells([1, 1, 1, 1, 2, 2, 2, 3, 3]).gold === 800 && serverSvc.replaceCostForSpells([1, 1, 1, 1, 2, 2, 2, 3, 3]).gold === 160,
    'mutation check: the drift reprices the recon example (800 vs 160 gp), not just a label');
  check(mutatedReplace.COPY_GOLD_PER_SPELL_LEVEL === serverSvc.COPY_GOLD_PER_SPELL_LEVEL,
    'mutation check: the untouched copy constant still agrees (the replace drift is localized)');
  // Blank-book price (V5, 2026-11-08): the same tripwire at the
  // standard 50 gp — a 0-gp client constant must disagree with the
  // server, or a new book would be free.
  const mutatedBookPath = path.join(tmpDir, 'spellbookHelpers-mutated-book.js');
  fs.writeFileSync(mutatedBookPath, readRepo('client/src/components/spellbookHelpers.js')
    .replace('STANDARD_SPELLBOOK_COST_GP = 50', 'STANDARD_SPELLBOOK_COST_GP = 0'));
  const mutatedBook = await import(pathToFileURL(mutatedBookPath).href);
  check(mutatedBook.STANDARD_SPELLBOOK_COST_GP !== serverSvc.STANDARD_SPELLBOOK_COST_GP,
    'mutation check: a 0-gp client blank-book constant disagrees with the server 50-gp constant');
  check(mutatedBook.replaceCostForSpells([1, 1, 1, 1, 2, 2, 2, 3, 3]).gold === serverSvc.replaceCostForSpells([1, 1, 1, 1, 2, 2, 2, 3, 3]).gold,
    'mutation check: the untouched transcription total still agrees (the book-cost drift is localized)');
  // Fixed materials table (2026-11-08): the same tripwire at the
  // tier prices — a 400-gp client dragonhide must disagree with
  // the 500-gp tier, or a lavish book would be undercharged.
  const mutatedTablePath = path.join(tmpDir, 'spellbookHelpers-mutated-table.js');
  fs.writeFileSync(mutatedTablePath, readRepo('client/src/components/spellbookHelpers.js')
    .replace("dragonhide:     { label: 'Dragonhide-bound',         cost: 500 }", "dragonhide:     { label: 'Dragonhide-bound',         cost: 400 }"));
  const mutatedTable = await import(pathToFileURL(mutatedTablePath).href);
  check(mutatedTable.SPELLBOOK_MATERIALS.dragonhide.cost === 400 && mutatedTable.SPELLBOOK_MATERIALS.dragonhide.cost !== 500,
    'mutation check: a 400-gp client dragonhide disagrees with the 500-gp tier');
  check(mutatedTable.spellbookMaterialCost('dragonhide') === 400,
    'mutation check: the drift reprices the derived total (560 vs 660 gp for a full replace), not just a label');
  check(serverSvc.SPELLBOOK_MATERIALS == null || mutatedTable.SPELLBOOK_MATERIALS.dragonhide.cost !== serverSvc.SPELLBOOK_MATERIALS.dragonhide.cost,
    'mutation check: the drifted client table disagrees with the server table');
  check(mutatedTable.SPELLBOOK_MATERIALS.standard.cost === 50,
    'mutation check: the untouched standard tier still agrees (the drift is localized)');
}

// (f) LevelUpPage: multiclass-into-wizard seeds 6 spells (2026-11-07).
group('(f) LevelUpPage multiclass-into-wizard seed picker caps at 6');
{
  const levelUpSrc = readRepo('client/src/components/LevelUpPage.jsx');
  check(levelUpSrc.includes("import { SPELLBOOK_START_SIZE } from './spellbookHelpers.js'"),
    'LevelUpPage reads the seed size from the shared helpers, not a magic number');
  check(levelUpSrc.includes("newSpellsKnown: className.toLowerCase() === 'wizard' ? SPELLBOOK_START_SIZE : 0"),
    'a multiclass-into-wizard option carries a 6-spell seed; every other multiclass carries 0');
  check(levelUpSrc.includes("Start a wizard's spellbook: you will pick"),
    'the wizard multiclass card carries a tooltip explaining the 6-spell seed');
  // The picker itself is the shared spells step: it stops offering
  // spells once the seed count is reached and blocks Review until
  // all 6 are picked, so the seed can never exceed 6. V3
  // (2026-11-08): a multiclass wizard may instead start with an
  // EMPTY book — the spells step offers it, Review proceeds with
  // 0 picked, and the submit sends an explicit newSpells: [] which
  // the server accepts.
  check(levelUpSrc.includes('selectedNewSpells.length < activeChoices.newSpellsKnown && ('),
    'the picker stops offering spells once the seed count is reached');
  check(levelUpSrc.includes('(activeChoices.newSpellsKnown > 0 && selectedNewSpells.length < activeChoices.newSpellsKnown)'),
    'Review stays blocked until the full seed is picked');
  check(levelUpSrc.includes('body.newSpells = selectedNewSpells'),
    'the seed is sent as newSpells on submit');
  // V3 (2026-11-08): the empty-book path — the spells step offers
  // starting with no spells, Review proceeds with 0 picked, and
  // the submit sends an explicit empty newSpells.
  check(levelUpSrc.includes('startEmptyBook'),
    'the level-up tracks a start-with-an-empty-book choice for a multiclass wizard');
  check(levelUpSrc.includes('Start with an empty spellbook'),
    'the spells step offers starting with an empty book');
  check(levelUpSrc.includes('body.newSpells = []'),
    'an empty seed is sent as an explicit empty newSpells');
  check(levelUpSrc.includes('!startEmptyBook'),
    'Review is no longer blocked on the seed count once the empty book is chosen');
  check(levelUpSrc.includes('Starts empty — no spells picked'),
    'Review shows the empty starting book');

  // Real bundle: LevelUpPage + its real imports (classes, spells,
  // feats, keeper texts, helpers) must resolve — a broken named
  // import (e.g. a misspelled SPELLBOOK_START_SIZE) fails the
  // bundle, not a runtime render the tests never see.
  const stubPathF = path.join(tmpDir, 'react-stub-f.mjs');
  fs.writeFileSync(stubPathF, [
    'export const useState = (v) => [v, () => {}];',
    'export const useEffect = () => {};',
    'export const useMemo = (f) => f();',
    'export const useRef = (v) => ({ current: v });',
    'export const useCallback = (f) => f;',
    'export const useContext = () => null;',
    'export function createElement() { return null; }',
    'export default { createElement: () => null };',
    '',
  ].join('\n'));
  function findEsbuildF() {
    const cands = [
      path.join(repoRoot, 'client', 'node_modules', '.bin', 'esbuild'),
      path.join(repoRoot, 'node_modules', '.bin', 'esbuild'),
    ];
    for (const c of cands) if (fs.existsSync(c)) return { bin: c, prefix: [] };
    return { bin: 'npx', prefix: ['--yes', 'esbuild'] };
  }
  function bundleAbsF(entryAbs, outName) {
    const { bin, prefix } = findEsbuildF();
    const out = path.join(tmpDir, outName);
    execFileSync(bin, [...prefix, entryAbs, '--bundle', '--format=esm', `--outfile=${out}`, `--alias:react=${stubPathF}`, '--log-level=warning'], { stdio: 'pipe' });
    return out;
  }
  let levelUpBundle = null;
  try {
    levelUpBundle = fs.readFileSync(bundleAbsF(path.join(repoRoot, 'client/src/components/LevelUpPage.jsx'), 'levelup.bundle.mjs'), 'utf-8');
    check(levelUpBundle.length > 1000, 'LevelUpPage bundles against the real classes/spells/feats/helpers imports');
  } catch (e) {
    check(false, `LevelUpPage esbuild bundle failed: ${e.message}`);
  }
  if (levelUpBundle) {
    check(levelUpBundle.includes("Start a wizard's spellbook: you will pick"),
      'bundled LevelUpPage contains the wizard-seed tooltip');
    check(levelUpBundle.includes('New Spellbook Spells'),
      'bundled LevelUpPage contains the wizard spells-step header');
  }
  // Mutation check: delete the wizard-6 branch from a temp copy —
  // the pin must fail, proving it is sensitive to the seed count
  // itself. The temp copy lives beside the real file (same
  // directory, so its relative imports resolve) and is unlinked
  // in the finally below.
  const mutatedLevelUpPath = path.join(repoRoot, 'client/src/components/LevelUpPage.mutated.jsx');
  fs.writeFileSync(mutatedLevelUpPath, levelUpSrc.replace(
    "newSpellsKnown: className.toLowerCase() === 'wizard' ? SPELLBOOK_START_SIZE : 0",
    'newSpellsKnown: 0'));
  try {
    const mutatedLevelUpSrc = fs.readFileSync(mutatedLevelUpPath, 'utf-8');
    check(!mutatedLevelUpSrc.includes("newSpellsKnown: className.toLowerCase() === 'wizard' ? SPELLBOOK_START_SIZE : 0"),
      'mutation check: the wizard-seed pin fails when the 6-spell branch is deleted');
  } finally {
    try { fs.unlinkSync(mutatedLevelUpPath); } catch {}
  }
  // Mutation check: delete the empty-book choice from a temp copy —
  // the pin must fail, proving it is sensitive to the V3 path
  // itself. The temp copy lives beside the real file (same
  // directory, so its relative imports resolve) and is unlinked
  // in the finally below.
  const mutatedEmptyPath = path.join(repoRoot, 'client/src/components/LevelUpPage.empty-mutated.jsx');
  fs.writeFileSync(mutatedEmptyPath, levelUpSrc.replaceAll('Start with an empty spellbook', 'StartXX with an empty spellbook'));
  try {
    const mutatedEmptySrc = fs.readFileSync(mutatedEmptyPath, 'utf-8');
    check(!mutatedEmptySrc.includes('Start with an empty spellbook'),
      'mutation check: the empty-book pin fails when the empty-book choice is deleted');
  } finally {
    try { fs.unlinkSync(mutatedEmptyPath); } catch {}
  }
}

// (g) Arcane Recovery client (wizard L1, 2026-11-08).
group('(g) Arcane Recovery client: budget + bank + picker + sheet surface');
{
  // Budget + bank/flag helpers pinned against the real server
  // service — the client mirrors the server verbatim, so a drift
  // fails here, not in a player's banked pick.
  for (let level = 1; level <= 20; level++) {
    check(helpers.arcaneRecoveryBudget(level) === serverSvc.arcaneRecoveryBudget(level),
      `arcaneRecoveryBudget(${level}) is ${serverSvc.arcaneRecoveryBudget(level)} on both sides`);
  }
  check(helpers.arcaneRecoveryBudget(1) === 1 && helpers.arcaneRecoveryBudget(5) === 3
    && helpers.arcaneRecoveryBudget(20) === 10,
    'the budget display reads L1 → 1, L5 → 3, L20 → 10 slot levels (ceil(wizard level / 2))');
  check(helpers.arcaneRecoveryBudget(0) === 0 && helpers.arcaneRecoveryBudget('nope') === 0
    && serverSvc.arcaneRecoveryBudget(0) === 0,
    'the budget is 0 for an invalid wizard level on both sides');
  check(JSON.stringify(helpers.parsePendingArcaneRecovery({ slots: [2, 1] }))
    === JSON.stringify(serverSvc.parsePendingArcaneRecovery({ slots: [2, 1] }))
    && JSON.stringify(helpers.parsePendingArcaneRecovery({ slots: [2, 1] })) === JSON.stringify({ slots: [2, 1] }),
    'a banked recovery parses as { slots: [2, 1] } on both sides');
  check(JSON.stringify(helpers.parsePendingArcaneRecovery({ levels: [1, 2] }))
    === JSON.stringify(serverSvc.parsePendingArcaneRecovery({ levels: [1, 2] })),
    'the levels key parses as an alias for slots, on both sides');
  check(helpers.parsePendingArcaneRecovery({ slots: [] }) === null
    && serverSvc.parsePendingArcaneRecovery({ slots: [] }) === null,
    'an empty bank is dropped, never thrown, on both sides');
  check(helpers.parsePendingArcaneRecovery({ slots: [0] }) === null
    && helpers.parsePendingArcaneRecovery({ slots: [1.5] }) === null
    && helpers.parsePendingArcaneRecovery('nope') === null
    && helpers.parsePendingArcaneRecovery(null) === null,
    'a bank with a bad level (or a non-object) is dropped, never thrown');
  check(JSON.stringify(helpers.parsePendingArcaneRecovery({ slots: [6] }))
    === JSON.stringify(serverSvc.parsePendingArcaneRecovery({ slots: [6] }))
    && JSON.stringify(helpers.parsePendingArcaneRecovery({ slots: [6] })) === JSON.stringify({ slots: [6] }),
    'a 6th-level slot parses fine — validation refuses it, parse never silently drops it, on both sides');
  // parseSpellbookState carries the bank + flag exactly like the
  // server — present only when set, so the blank state keeps its
  // exact old shape.
  const arcJson = '{"status":"intact","mastery":[],"signature":[],"pendingArcaneRecovery":{"slots":[2,1]},"arcaneRecoveryUsed":true}';
  check(JSON.stringify(helpers.parseSpellbookState(arcJson)) === JSON.stringify(serverSvc.parseSpellbookState(arcJson))
    && helpers.parseSpellbookState(arcJson).pendingArcaneRecovery?.slots.join(',') === '2,1'
    && helpers.parseSpellbookState(arcJson).arcaneRecoveryUsed === true,
    'parseSpellbookState carries a banked recovery + the used flag identically to the server');
  check(JSON.stringify(helpers.parseSpellbookState('{}')) === JSON.stringify(helpers.parseSpellbookState('{}'))
    && helpers.parseSpellbookState('{}').pendingArcaneRecovery === undefined
    && helpers.parseSpellbookState('{}').arcaneRecoveryUsed === undefined,
    'the blank state has no bank and no used flag — its old shape is untouched');
  check(JSON.stringify(helpers.pendingArcaneRecovery(arcJson)) === JSON.stringify(serverSvc.pendingArcaneRecovery(arcJson))
    && helpers.pendingArcaneRecovery(arcJson)?.slots.join(',') === '2,1',
    'pendingArcaneRecovery reads the banked slot levels');
  check(helpers.pendingArcaneRecovery('{}') === null && serverSvc.pendingArcaneRecovery('{}') === null,
    'pendingArcaneRecovery is null when nothing is banked, on both sides');
  check(JSON.stringify(helpers.setPendingArcaneRecovery('{}', { slots: [2, 1] }))
    === JSON.stringify(serverSvc.setPendingArcaneRecovery('{}', { slots: [2, 1] })),
    'setPendingArcaneRecovery banks a recovery identically to the server');
  check(JSON.stringify(helpers.setPendingArcaneRecovery(arcJson, null))
    === JSON.stringify(serverSvc.setPendingArcaneRecovery(arcJson, null))
    && helpers.setPendingArcaneRecovery(arcJson, null).pendingArcaneRecovery === undefined,
    'clearing the bank drops the bank (the used flag stays — clearing is not a long rest)');
  check(helpers.arcaneRecoveryUsed(arcJson) === true && serverSvc.arcaneRecoveryUsed(arcJson) === true,
    'arcaneRecoveryUsed reads the flag on both sides');
  check(helpers.arcaneRecoveryUsed('{}') === false && serverSvc.arcaneRecoveryUsed('{}') === false,
    'arcaneRecoveryUsed is false when the flag is absent, on both sides');
  check(JSON.stringify(helpers.setArcaneRecoveryUsed('{}', true))
    === JSON.stringify(serverSvc.setArcaneRecoveryUsed('{}', true)),
    'setArcaneRecoveryUsed sets the flag identically to the server');
  check(JSON.stringify(helpers.setArcaneRecoveryUsed(arcJson, false))
    === JSON.stringify(serverSvc.setArcaneRecoveryUsed(arcJson, false))
    && helpers.setArcaneRecoveryUsed(arcJson, false).arcaneRecoveryUsed === undefined
    && helpers.setArcaneRecoveryUsed(arcJson, false).pendingArcaneRecovery?.slots.join(',') === '2,1',
    'clearing the flag leaves a live bank alone, on both sides');
  check(helpers.parseSpellbookState('{"arcaneRecoveryUsed":"yes"}').arcaneRecoveryUsed === undefined
    && serverSvc.parseSpellbookState('{"arcaneRecoveryUsed":"yes"}').arcaneRecoveryUsed === undefined,
    'a non-boolean used flag is dropped, never trusted, on both sides');
  const lostArcJson = '{"status":"lost","mastery":[],"signature":[],"pendingArcaneRecovery":{"slots":[1]},"arcaneRecoveryUsed":true}';
  check(JSON.stringify(helpers.parseSpellbookState(lostArcJson)) === JSON.stringify(serverSvc.parseSpellbookState(lostArcJson))
    && helpers.parseSpellbookState(lostArcJson).status === 'lost'
    && helpers.parseSpellbookState(lostArcJson).pendingArcaneRecovery?.slots.join(',') === '1'
    && helpers.parseSpellbookState(lostArcJson).arcaneRecoveryUsed === true,
    'a lost book keeps the bank + the flag — losing the book never wipes the recovery, on both sides');
  // Wizard level: CLASS level, not the row total. The client helper
  // mirrors the server's wizardLevelFromClassLevels + the
  // single-class fallback the rest path uses.
  check(helpers.wizardLevelFor({ characterClass: 'wizard', characterLevel: 5 }) === 5,
    'a pure L5 wizard has wizard level 5');
  check(helpers.wizardLevelFor({ characterClass: 'wizard', characterLevel: 1 }) === 1,
    'a pure L1 wizard has wizard level 1 (budget 1)');
  check(helpers.wizardLevelFor({ classLevels: JSON.stringify([{ class: 'fighter', level: 5 }, { class: 'wizard', level: 1 }]), characterClass: 'fighter', characterLevel: 6 }) === 1,
    'a fighter 5 / wizard 1 has wizard level 1 — not 6, not 3');
  check(helpers.wizardLevelFor({ classLevels: [{ class: 'wizard', level: 3 }, { class: 'fighter', level: 5 }], characterClass: 'wizard', characterLevel: 8 }) === 3,
    'a wizard 3 / fighter 5 has wizard level 3');
  check(helpers.wizardLevelFor({ classLevels: JSON.stringify([{ class: 'fighter', level: 5 }]), characterClass: 'fighter', characterLevel: 5 }) === 0,
    'class_levels with no wizard entry means no wizard levels — not the row total');
  check(helpers.wizardLevelFor({ characterClass: 'sorcerer', characterLevel: 5 }) === 0,
    'a non-wizard has wizard level 0, so the section never renders');
  check(helpers.wizardLevelFor({}) === 0, 'no class and no class_levels means no wizard levels');
  check(helpers.wizardLevelFor({ classLevels: 'not json', characterClass: 'wizard', characterLevel: 5 }) === 5,
    'a corrupt class_levels string falls back to the primary-class total for a wizard');
  for (const cl of [JSON.stringify([{ class: 'wizard', level: 5 }]), JSON.stringify([{ class: 'fighter', level: 5 }, { class: 'wizard', level: 1 }]), JSON.stringify([{ class: 'fighter', level: 5 }]), null]) {
    check((serverSvc.wizardLevelFromClassLevels(cl) ?? 0) === helpers.wizardLevelFor({ classLevels: cl, characterClass: 'fighter', characterLevel: 6 }),
      `wizardLevelFor agrees with the server's wizardLevelFromClassLevels on ${cl ?? 'null'} (null reads as 0)`);
  }
  check(serverSvc.wizardLevelFromClassLevels(null) === null
    && helpers.wizardLevelFor({ classLevels: null, characterClass: 'wizard', characterLevel: 5 }) === 5,
    'the server leaves the single-class fallback to the caller — the client fallback is that caller expression');
  // Picker options: spent levels only, 6th+ never, budget accounting.
  const opts = helpers.arcaneRecoveryOptions({ used: { 1: 2, 2: 1, 3: 0 }, max: { 1: 4, 2: 3, 3: 2 }, picked: [], budget: 3 });
  check(JSON.stringify(opts.options.map(o => o.level)) === JSON.stringify([1, 2]),
    `the picker offers only spent levels 1–2 (not unspent 3rd) (got ${JSON.stringify(opts.options.map(o => o.level))})`);
  check(opts.options[0].spent === 2 && opts.options[0].max === 4 && opts.options[0].remaining === 2,
    'a 1st-level option carries its spent count, max, and pickable copies');
  check(opts.options[0].label === '1st' && opts.options[1].label === '2nd',
    'options carry ordinal labels for the select');
  check(opts.pickedTotal === 0 && opts.budgetLeft === 3, 'no picks yet: 0 spent of a 3-level budget');
  const opts6 = helpers.arcaneRecoveryOptions({ used: { 6: 1 }, max: { 6: 1 }, picked: [], budget: 10 });
  check(opts6.options.length === 0, 'a spent 6th-level slot is never offered — 6th+ never recovers');
  const optsPicked = helpers.arcaneRecoveryOptions({ used: { 1: 2 }, max: { 1: 4 }, picked: [1], budget: 3 });
  check(optsPicked.options[0].remaining === 1 && optsPicked.options[0].picked === 1
    && optsPicked.pickedTotal === 1 && optsPicked.budgetLeft === 2,
    'one picked copy leaves one pickable and 2 of the budget left');
  const optsFull = helpers.arcaneRecoveryOptions({ used: { 1: 2 }, max: { 1: 4 }, picked: [1, 1], budget: 3 });
  check(optsFull.options[0].remaining === 0 && optsFull.pickedTotal === 2 && optsFull.budgetLeft === 1,
    'both copies picked leaves none pickable; the budget counts the picks, not the level');
  const optsCapped = helpers.arcaneRecoveryOptions({ used: { 1: 2 }, max: { 1: 1 }, picked: [], budget: 3 });
  check(optsCapped.options[0].remaining === 1,
    'a spent slot beyond the character max is not offered — the server would refuse it too');
  const optsNoBudget = helpers.arcaneRecoveryOptions({ used: { 1: 1 }, max: { 1: 4 }, picked: [] });
  check(optsNoBudget.budgetLeft === null, 'budgetLeft is null when no budget was passed');
  const optsEmpty = helpers.arcaneRecoveryOptions({ used: {}, max: {}, picked: [], budget: 3 });
  check(optsEmpty.options.length === 0 && optsEmpty.pickedTotal === 0,
    'no spent slots means no options, whatever the budget');

  // Sheet surface (static pins on the live CharacterSheet.jsx).
  const sheetSrc = readRepo('client/src/components/CharacterSheet.jsx');
  const arcStart = sheetSrc.indexOf('Arcane Recovery — recover spent slots on a Short Rest');
  const arcEnd = sheetSrc.indexOf('DM status lever', arcStart);
  const arcRegion = arcStart >= 0 && arcEnd > arcStart ? sheetSrc.slice(arcStart, arcEnd) : '';
  check(arcStart >= 0, 'the sheet renders the Arcane Recovery section inside the Spellbook block');
  check(sheetSrc.includes('/arcane-recovery-bank'), 'the sheet calls the arcane-recovery-bank endpoints');
  check(sheetSrc.includes('bankArcaneRecovery'), 'the sheet banks the recovery instead of resting');
  check(sheetSrc.includes('clearArcaneRecoveryBank'), 'the sheet can clear a banked recovery');
  check(sheetSrc.includes('pendingArcaneRecovery'), 'the sheet reads the banked recovery back from spellbook_json');
  check(sheetSrc.includes('arcaneRecoveryUsed'), 'the sheet reads the used flag back from spellbook_json');
  check(sheetSrc.includes('Bank recovery for next short rest'), 'the sheet renders the bank-recovery button');
  check(sheetSrc.includes('Banked: recover slots of levels'), 'the sheet shows the banked pick');
  check(sheetSrc.includes('spellbookState.pendingArcaneRecovery.slots.join'), 'the banked line lists the banked slot levels');
  check(sheetSrc.includes('Recover up to {arcaneBudget} slot level'), 'the sheet shows the budget in plain words (Recover up to N slot levels)');
  check(sheetSrc.includes('Arcane Recovery used — returns after your next long rest'),
    'the sheet shows the used state in plain words');
  check(sheetSrc.includes('{wizardLevel >= 1 && ('), 'the section renders only for a wizard (wizard level 1+) — a non-wizard sees nothing');
  check(sheetSrc.includes('wizardLevelFor({ classLevels: character.class_levels, characterClass: character.class, characterLevel: character.level })'),
    'the sheet derives the wizard level from class_levels, not the row total');
  check(sheetSrc.includes('arcaneRecoveryOptions'), 'the sheet offers picks with the real options helper');
  check(sheetSrc.includes('arcaneRecoveryBudget'), 'the sheet reads the budget from the real helper');
  check(sheetSrc.includes('disabled={arcanePickerDisabled}'), 'the picker disables while the feature is used or a bank call is in flight');
  check(sheetSrc.includes('arcaneBusy || spellbookState.arcaneRecoveryUsed === true'),
    'the used flag is what disables the picker');
  check(sheetSrc.includes('Add to recovery'), 'the sheet renders the add-pick button');
  check(sheetSrc.includes('arcaneOpts.pickedTotal + level > arcaneBudget'),
    'a pick that would go over budget is refused client-side');
  check(sheetSrc.includes('only recovers up to ${arcaneBudget} at wizard level ${wizardLevel}'),
    'the over-budget refusal says the budget in plain words');
  check(sheetSrc.includes('if (total > arcaneBudget)'),
    'the bank button guards the total against the budget too — the server is still the authority');
  check(sheetSrc.includes('refreshCharacterRow()') && sheetSrc.includes('bankArcaneRecovery'),
    'banking re-reads the character row so the banked pick shows, and clearing does the same');
  check(sheetSrc.includes("Losing your spellbook doesn't stop this"),
    'the sheet says plainly that a lost book does not block recovery');
  check(!arcRegion.includes("status === 'lost'"),
    'the Arcane block has no lost-book gate — the section stays available while the book is lost');
  check(!arcRegion.includes('/spell-slots/') && !arcRegion.includes('restoreSpellSlot'),
    'the Arcane block never touches the per-level +1 restore route');
  check(arcRegion.includes('Clear bank'), 'the banked line offers clearing the bank');
  check(arcRegion.includes('— spent slot level —'), 'the pick select offers spent slot levels');
  check(arcRegion.includes('Banking only stores the pick'), 'the Arcane block says banking only stores the pick');
  check(sheetSrc.includes('arcaneRecoveryUsed') && sheetSrc.includes('arcanePickerDisabled'),
    'the used flag and the picker-disabled state are wired together');

  // Spellbook section re-gated on wizard levels (2026-11-08, D1):
  // a fighter-first wizard sees the section and can bank Arcane
  // Recovery (budget 1); a non-wizard still sees nothing.
  check(sheetSrc.includes('{wizardLevel >= 1 && (\n                  <section className="sheet-section">\n                    <h3>Spellbook ({knownSpells.length}/{spellbookSizeForLevel(wizardLevel)}'),
    'the Spellbook section gates on wizard level — a fighter-first wizard sees it, not just a primary wizard');
  check(sheetSrc.split("effectiveSpellcasting?.spellsKnown === 'Spellbook'").length - 1 === 5,
    'only five spellsKnown gates remain, all in the Prepared Spells section — the Spellbook section gate is gone');
  check(sheetSrc.includes('const copyCandidates = wizardLevel >= 1')
    && sheetSrc.includes('const memorizeOpts = wizardLevel >= 1')
    && sheetSrc.includes("const replaceEpisode = wizardLevel >= 1 && spellbookState.status === 'lost'")
    && sheetSrc.includes("const replacePreview = wizardLevel >= 1 && spellbookState.status === 'lost'")
    && sheetSrc.includes('const backupRestore = wizardLevel >= 1')
    && sheetSrc.includes('const backupCopy = wizardLevel >= 1')
    && sheetSrc.includes('const backupIsFirstCopy = wizardLevel >= 1'),
    'every section-feeding derivation gates on wizard level too — copy, Memorize, replace, backup');
  check(sheetSrc.includes('const isWizardSheet') && sheetSrc.includes('if (isWizardSheet)'),
    'isWizardSheet stays for its one remaining use (the Prepared-section helper), not the Spellbook section');
  // The fighter-first case, end to end at the helper level: wizard
  // level 1, budget 1, section gate true.
  const fighterFirst = { classLevels: [{ class: 'fighter', level: 5 }, { class: 'wizard', level: 1 }], characterClass: 'fighter', characterLevel: 6 };
  check(helpers.wizardLevelFor(fighterFirst) === 1 && helpers.arcaneRecoveryBudget(helpers.wizardLevelFor(fighterFirst)) === 1,
    'a fighter 5 / wizard 1 has wizard level 1 and an Arcane budget of 1 — it can bank a recovery from the section');
  check(helpers.wizardLevelFor({ characterClass: 'sorcerer', characterLevel: 5 }) === 0,
    'a non-wizard still has wizard level 0, so the re-gated section never renders for one');
  // S3 — Memorize opens at WIZARD level 5, not total level 5.
  check(sheetSrc.includes('{wizardLevel < 5 ? (')
    && sheetSrc.includes('Memorize Spell opens at wizard level 5 (you are wizard level {wizardLevel})'),
    'the Memorize picker gates on wizard level 5 and says so in plain words');
  check(!sheetSrc.includes('{character.level < 5 ? ('),
    'no total-level Memorize gate remains');
  check(helpers.wizardLevelFor({ classLevels: [{ class: 'fighter', level: 4 }, { class: 'wizard', level: 5 }], characterClass: 'fighter', characterLevel: 9 }) === 5,
    'a fighter 4 / wizard 5 has wizard level 5 — the Memorize picker shows');
  check(helpers.wizardLevelFor({ classLevels: [{ class: 'wizard', level: 4 }, { class: 'fighter', level: 1 }], characterClass: 'wizard', characterLevel: 5 }) === 4,
    'a wizard 4 / fighter 1 has wizard level 4 — the Memorize picker stays hidden at total level 5');
  // S4 — Mastery / Signature open at WIZARD level 18 / 20.
  check(sheetSrc.includes('{wizardLevel < SPELL_MASTERY_LEVEL ? (')
    && sheetSrc.includes('{wizardLevel < SIGNATURE_SPELLS_LEVEL ? ('),
    'the Mastery / Signature pickers gate on wizard level 18 / 20');
  check(!sheetSrc.includes('{character.level < SPELL_MASTERY_LEVEL ? (')
    && !sheetSrc.includes('{character.level < SIGNATURE_SPELLS_LEVEL ? ('),
    'no total-level Mastery / Signature gate remains');
  check(helpers.wizardLevelFor({ classLevels: [{ class: 'fighter', level: 2 }, { class: 'wizard', level: 18 }], characterClass: 'fighter', characterLevel: 20 }) === 18,
    'a fighter 2 / wizard 18 has wizard level 18 — the Mastery picker shows at total level 20');
  check(helpers.wizardLevelFor({ classLevels: [{ class: 'wizard', level: 17 }, { class: 'fighter', level: 3 }], characterClass: 'wizard', characterLevel: 20 }) === 17,
    'a wizard 17 / fighter 3 has wizard level 17 — the Mastery picker stays hidden at total level 20');
  check(helpers.wizardLevelFor({ classLevels: [{ class: 'wizard', level: 19 }, { class: 'fighter', level: 1 }], characterClass: 'wizard', characterLevel: 20 }) === 19,
    'a wizard 19 / fighter 1 has wizard level 19 — the Signature picker stays hidden at total level 20');
  // Mutation check: revert the section gate to spellsKnown — the
  // fighter-first pins above must fail on the reverted source.
  const gateReverted = sheetSrc.replace('{wizardLevel >= 1 && (\n                  <section className="sheet-section">\n                    <h3>Spellbook ({knownSpells.length}/{spellbookSizeForLevel(wizardLevel)}',
    "effectiveSpellcasting?.spellsKnown === 'Spellbook' && (\n                  <section className=\"sheet-section\">\n                    <h3>Spellbook ({knownSpells.length}/{spellbookSizeForLevel(wizardLevel)}");
  check(gateReverted !== sheetSrc,
    'mutation check: the reverted copy actually changed the gate');
  check(!gateReverted.includes('{wizardLevel >= 1 && (\n                  <section className="sheet-section">\n                    <h3>Spellbook ({knownSpells.length}/{spellbookSizeForLevel(wizardLevel)}'),
    'mutation check: reverting the section gate to spellsKnown removes the wizard-level gate the fighter-first pins require');
  check(gateReverted.split("effectiveSpellcasting?.spellsKnown === 'Spellbook'").length - 1 === 6,
    'mutation check: the reverted gate adds back a sixth spellsKnown gate — the count pin would fail');

  // Real bundle: the sheet + its real imports must resolve — a
  // broken named import fails the bundle, not a runtime render.
  const stubPathG = path.join(tmpDir, 'react-stub-g.mjs');
  fs.writeFileSync(stubPathG, [
    'export const useState = (v) => [v, () => {}];',
    'export const useEffect = () => {};',
    'export const useMemo = (f) => f();',
    'export const useRef = (v) => ({ current: v });',
    'export const useCallback = (f) => f;',
    'export const useContext = () => null;',
    'export function createElement() { return null; }',
    'export default { createElement: () => null };',
    '',
  ].join('\n'));
  function findEsbuildG() {
    const cands = [
      path.join(repoRoot, 'client', 'node_modules', '.bin', 'esbuild'),
      path.join(repoRoot, 'node_modules', '.bin', 'esbuild'),
    ];
    for (const c of cands) if (fs.existsSync(c)) return { bin: c, prefix: [] };
    return { bin: 'npx', prefix: ['--yes', 'esbuild'] };
  }
  function bundleAbsG(entryAbs, outName) {
    const { bin, prefix } = findEsbuildG();
    const out = path.join(tmpDir, outName);
    execFileSync(bin, [...prefix, entryAbs, '--bundle', '--format=esm', `--outfile=${out}`, `--alias:react=${stubPathG}`, '--log-level=warning'], { stdio: 'pipe' });
    return out;
  }
  let arcBundle = null;
  try {
    arcBundle = fs.readFileSync(bundleAbsG(path.join(repoRoot, 'client/src/components/CharacterSheet.jsx'), 'sheet-arcane.bundle.mjs'), 'utf-8');
    check(arcBundle.length > 1000, 'CharacterSheet bundles against the real Tip/helpers/data imports (Arcane build)');
  } catch (e) {
    check(false, `CharacterSheet esbuild bundle failed (Arcane build): ${e.message}`);
  }
  if (arcBundle) {
    check(arcBundle.includes('/arcane-recovery-bank'), 'bundled sheet contains the arcane-recovery-bank route');
    check(arcBundle.includes('Arcane Recovery used'), 'bundled sheet contains the used-state line');
    check(arcBundle.includes('Bank recovery for next short rest'), 'bundled sheet contains the bank-recovery button');
    check(arcBundle.includes('Recover up to '), 'bundled sheet contains the budget line');
    check(arcBundle.includes('Add to recovery'), 'bundled sheet contains the add-pick button');
    check(arcBundle.includes('Banked: recover slots of levels'), 'bundled sheet contains the banked-pick line');
    // Mutation check: delete the bank-recovery label from a temp
    // copy — the pin must fail, proving it is sensitive to the
    // button itself. The temp copy lives beside the real file
    // (same directory, so its relative imports resolve) and is
    // unlinked in the finally below.
    const mutatedPath = path.join(repoRoot, 'client/src/components/CharacterSheet.arcane-mutated.jsx');
    fs.writeFileSync(mutatedPath, sheetSrc.replace('Bank recovery for next short rest', 'BankXX recovery for next short rest'));
    let mutatedBundle = null;
    try {
      mutatedBundle = fs.readFileSync(bundleAbsG(mutatedPath, 'sheet-arcane-mutated.bundle.mjs'), 'utf-8');
    } catch (e) {
      check(false, `mutated sheet bundle failed: ${e.message}`);
    } finally {
      try { fs.unlinkSync(mutatedPath); } catch {}
    }
    if (mutatedBundle) {
      check(!mutatedBundle.includes('Bank recovery for next short rest'),
        'mutation check: the bank-button pin fails when the button label is deleted');
      check(mutatedBundle.includes('/arcane-recovery-bank'),
        'mutation check: the mutated bundle still builds (only the label went)');
    }
  }
  // Mutation check: a drifted client budget must disagree with the
  // server — the cross-pin above is what would catch it in CI.
  const mutatedBudgetPath = path.join(tmpDir, 'spellbookHelpers-mutated-arcane.js');
  fs.writeFileSync(mutatedBudgetPath, readRepo('client/src/components/spellbookHelpers.js')
    .replace('return Math.ceil(l / 2)', 'return 99'));
  const mutatedBudget = await import(pathToFileURL(mutatedBudgetPath).href);
  check(mutatedBudget.arcaneRecoveryBudget(5) !== serverSvc.arcaneRecoveryBudget(5),
    'mutation check: a 99-level client budget disagrees with the server budget of 3');
  check(mutatedBudget.arcaneRecoveryBudget(1) === 99 && serverSvc.arcaneRecoveryBudget(1) === 1,
    'mutation check: the drift changes the priced budget (99 vs 1), not just a label');
}

console.log(`=== Results: ${passed} passed, ${failed} failed ===`);
process.exit(failed ? 1 : 0);
