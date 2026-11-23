# Brief — H2+H3: 2024 rules corrections (long-rest Hit Dice + prepared-spell caps)

## Goal (in play)
Two 2014 rules still in the build become 2024 rules. A long rest
regains ALL spent Hit Dice — a character who spent dice getting
through the day wakes up with the full pool back. And a prepared
caster's cap is the number printed in the class table's Prepared
Spells column — the same number at every ability modifier, so a
1st-level bard, cleric, druid, or wizard prepares 4 spells whether
their modifier is +2 or +5. Nothing else about rests or prepared
spells changes.

## Background
- Audit findings H2 + H3 (full-codebase audit, 2026-11-12, commit
  6084b18, PM-verified against live bytes): H2 — long rests give
  back half the Hit Dice, the 2014 rule. H3 — the prepared-spell
  caps for Bard, Cleric, Druid, and Wizard use the 2014 formula
  (ability mod + level), not the 2024 class-table column.
  Evidence below is starting points from the 2026-11-12 record and
  the rest-consolidation recon — verify each against live bytes
  before trusting it.
- H2 evidence: the DM rest path (`server/services/restTimeService.js`,
  ~660 lines) — long rest for a PC restores full HP, all slots,
  **Hit Dice regain half total, min 1**, temp HP cleared,
  class-resource reset, concentration broken, exhaustion −1; short
  rest heals via Hit Dice only. The audit confirmed the half rule on all three call paths —
  player (:378), companions (:603), and downtime rests (:814),
  line numbers from 6084b18 — and the survey re-verifies each
  against live bytes. The sheet rest route
  was removed by rest consolidation; the survey confirms no second
  long-rest implementation survives anywhere.
- H3 evidence: `getSpellsPrepared` in
  `server/config/levelProgression.js` — the cleric/druid/wizard arm
  is mod + level (min 1); the bard arm is `Math.max(1, mod + lvl)`
  (built 2026-11-06); the wizard arm is Int mod + level, which
  happens to reproduce the printed column at the standard ASI
  progression (L1 = 4 at +3, L5 = 9 at +4, L20 = 25 at +5) but is
  still the 2014 formula and diverges at any other modifier. The
  sheet's `getMaxPrepared` in
  `client/src/components/CharacterSheet.jsx` mirrors the server
  arms per class. GET /api/spells and the Stage 4 creator validator
  both flow through `getSpellsPrepared` (Stage 4 calls it at L1
  only). `server/services/bardService.js` carries the 2014 formula
  too — cap `max(1, Cha mod + bard level)` plus its
  `validatePreparedSpells`, wired into PUT /:id and POST /level-up
  (built 2026-11-07). As of 2026-11-06 only two
  `validatePreparedSpells` existed (artificer, blackguard); bard /
  Profane Soul / warlock validators were built 2026-11-07, and no
  cleric/druid/wizard validator is recorded — the survey
  enumerates what exists now.
- Zach's rulings, 2026-11-12 (audit Q&A, recorded in the report):
  long rest regains ALL spent Hit Dice; the 2024 prepared-spell
  caps are the class-table Prepared Spells column, NOT ability mod
  + level. Settled; this job implements them, it does not
  re-decide anything.
- The 2024 tables, verified against Zach's 2024 PHB class-table
  photos exactly (2026-11-12). Build from these tables, never from
  memory. L1–20, mod-independent:
  - Bard / Cleric / Druid: 4, 5, 6, 7, 9, 10, 11, 12, 14, 15, 16,
    16, 17, 17, 18, 18, 19, 20, 21, 22
  - Wizard: 4, 5, 6, 7, 9, 10, 11, 12, 14, 15, 16, 16, 17, 18, 19,
    21, 22, 23, 24, 25
  - Note the shape: L1 is 4 at EVERY modifier (a +2-mod L1 caster
    goes 3 → 4; a +5-mod L1 caster goes 6 → 4). The tables are the
    whole rule — no formula, no modifier input.
- NOT affected, do not touch: Artificer — Int mod + half level
  (min 1) is a recorded Zach ruling, and its service, validator,
  and Stage 4 rows already implement it. Paladin, Ranger,
  Warlock, and Sorcerer — already table-based (paladin
  [2,3,4,5,6,6,7,7,9,10,10,11,11,12,12,14,14,14,15,15], ranger and
  sorcerer own tables, warlock table-based). Blackguard — Cha mod
  + half level per its own book, with its own validator.

## What to build
1. **Survey the live repo first, then build.** On the PC, branch
   `phase-4-hybrid-combat`, verify every evidence point above
   against live bytes, and enumerate (a) EVERY path by which Hit
   Dice are restored — long-rest arms, companion rest, any other
   restore, and any DM-prompt text stating the half rule; and
   (b) EVERY place the 2014 prepared formula lives — server arms
   in `getSpellsPrepared`, per-class services and validators,
   sheet `getMaxPrepared` branches, the Stage 4 creator validator
   and its no-endpoint fallback, GET /api/spells, any generated
   dataset or `classes.json` field embedding a cap, and every test
   asserting the formula. Report both full lists, with file and
   line, before changing anything. Workspace mirrors are staging
   copies, not the repo.
2. **H2 — the long-rest rule.** A long rest regains ALL spent Hit
   Dice, up to the character's maximum — on all three paths the
   audit confirmed (player, companion, and downtime rests).
   Fix it where the rest is applied, not per caller: if one
   service owns the long rest, the rule lives there and every
   caller inherits it. Short rests are unchanged: they still spend
   Hit Dice to heal. A character with no spent dice regains none.
   If the survey shows a second long-rest implementation, report
   it with evidence instead of silently leaving it half.
3. **H3 — the server caps.** Replace the formula arms with table
   lookups for Bard, Cleric, Druid, and Wizard in
   `getSpellsPrepared`, on the paladin/sorcerer/ranger pattern
   (fixed per-level constants, no modifier input). Correct
   `bardService`'s cap and its `validatePreparedSpells` to the
   table, and correct any other existing validator or service the
   survey finds encoding the 2014 formula. Do NOT wire new
   validators for classes that have none — cleric, druid, and
   wizard have no PUT / level-up prepared validator, and wiring
   them is a separate flagged follow-up, not this job. Paladin's
   missing-validator follow-up likewise stays separate: paladin
   is already table-based, nothing changes for it here.
4. **H3 — the sheet and the creator.** The sheet's `getMaxPrepared`
   branches for the four classes use client-side table constants,
   matching the server exactly at every level and modifier. The
   Stage 4 creator validator and its no-endpoint fallback agree
   with the tables (L1 = 4 for all four classes at any modifier).
   GET /api/spells flows through `getSpellsPrepared`, so no route
   change is expected — the survey proves it or lists the gap.
   Regenerate any dataset that embeds a prepared cap, on the
   paladin/sorcerer pattern, and say which datasets were checked.
5. **Tests that model every branch.** Prepared caps at every level
   1–20 × modifiers [-1, 0, +3, +5] (the artificer pattern): L1 =
   4 at every modifier for all four classes; wizard agreement at
   the standard ASI mods (+3/+4/+5) preserved; bard validator
   refuses over-cap and passes at-cap on PUT and level-up; no
   other class's cap moved (artificer, paladin, ranger, sorcerer,
   warlock, blackguard pinned). Hit Dice: long rest with 0 spent
   restores 0; with some spent restores all of them; never above
   maximum; short rest still spends dice to heal; companion
   equivalents of each. Full `npm test` green on the builder's
   run.
6. **Prove it at :5173 (never :3000).** Drive by hand: a character
   who spent Hit Dice takes a long rest and the pool comes back
   full; a 1st-level bard/cleric/druid/wizard sheet shows a
   prepared cap of 4. Exact steps in the report.

## Out of scope
- H1, creator round 3, severe-seven, M1, reactions, return-loop,
  L1–L6, or any other queued job.
- Wiring NEW prepared-spell validators for cleric, druid, or
  wizard — flagged follow-up, separate job. (Correcting an
  existing validator's formula IS this job.)
- Any change to spell slots, cantrips known, or spells-known
  counts — caps only.
- Any change to the Artificer formula, the paladin/ranger/
  sorcerer/warlock/blackguard caps, or short-rest mechanics.
- Any migration. No schema change is expected; if the survey
  shows one is needed anywhere, the builder stops and reports it
  instead of inventing schema.

## Acceptance criteria
- A long rest regains all spent Hit Dice (PCs and companions),
  never above maximum; short rests still spend dice to heal.
- Prepared caps for Bard, Cleric, Druid, and Wizard are the
  tables above at every level and every modifier — L1 = 4 at any
  modifier — on the server, the sheet, the creator, and GET
  /api/spells, all agreeing.
- The bard validator enforces the table on PUT and level-up;
  no new validators were wired for classes that had none.
- Artificer, paladin, ranger, sorcerer, warlock, and blackguard
  caps are byte-identical to before this job.
- No 2014 prepared formula (mod + level) remains for the four
  classes anywhere the survey looked, including tests and
  generated datasets.
- Full `npm test` green on the builder's run; new/updated suites
  cover each item above.

## Verification
- Run the full `npm test` yourself from the repo root on the PC
  and iterate until green. Zach's full run is the gate — never
  claim it.
- At :5173 (never :3000): the long-rest Hit Dice check and the
  L1 prepared-cap check by hand.
- Note the known runner flag: spellbook-routes takes ~158s against
  the runner's 120s per-file cap — a timeout artifact, not a
  failure, if it trips.

## Decisions already made
- Long rest regains ALL spent Hit Dice; prepared caps are the
  2024 class-table columns (Zach, 2026-11-12). Settled.
- Tables are mod-independent; L1 = 4 at any modifier for all four
  classes (PM decision, vetoable at the gate — the direct reading
  of the verified PHB tables).
- Fix at the choke point / table constants on the
  paladin-sorcerer-ranger pattern (PM decision, vetoable).
- Correct existing validators; do not wire new ones (PM decision,
  vetoable — wiring is its own flagged follow-up).
- Fix-as-you-find-it (Zach, 2026-11-06): same defect in a sibling
  gets fixed in this job and reported.
- Do not guess (Zach, 2026-11-07): if information is needed, ask
  before building. Never invent data — a gap is stated as a gap.
- The 2024 book wins on conflict; Zach's PHB photos are the
  verification for the tables above.

## Report
- §3 format from `claude-code-handoff.md`, plus per-item verdicts
  for the six items above (built / already-present / still-open
  with evidence), the full Hit Dice restore-path inventory (file +
  line for every path, with its disposition), and the full
  prepared-cap formula inventory (file + line for every location,
  with its disposition).
- Any question for Zach in full plain terms, one per item, with
  what was checked and what is still unclear.
- How to verify: gate command + what to look for at :5173 (never
  :3000).

## Setup — CONFIRMED 2026-11-10 (Zach)
- Claude Code is installed on Zach's PC. Zach couriers this brief
  to Claude Code and carries the report back to Muse.
- Staging is PC-only (Zach, 2026-11-12). Gate = Zach's `npm test` +
  :5173 checks on the PC.
- Place this brief at `docs/pm/h2-h3-2024-rules-corrections/BRIEF.md`
  in the repo when handing it over. Reports live in
  `docs/pm/reports/`.
