# Brief — L1–L6 cleanup (amended 2026-11-27)

Amendments from the 2026-11-26 draft:
- **Placement (PM decision 2026-11-27, vetoable at the gate):** the 2026-11-26 draft waited for the suite to go green after the return-loop gap fixes. Every fix job that could run has run (experience, the level-up chain, commission deadlines, Healer's Kit, stabilization alignment). The five remaining red checks (four full-downtime, one scene evolution) are blocked on Zach's scope call and are NOT part of this job. This job runs now under the red-with-cause guardrail: the five checks are named and known, so a deletion that causes a new failure is still attributable — which is what the wait was for. Expected gate: red-with-cause with exactly those five checks; any other failure is a new red caused by this job until proven otherwise.
- **Two folds added since the 2026-11-26 draft:** the duplicate definitions in `markerSchemas.js` (observed 2026-11-25) and the docs/ dead-rule sweep residual (the registry cleanup's zero-hits check excluded `docs/`). Both ride the same survey-then-delete rule as everything else in this job.
- Head state: v1.0.228, commit `f73d40e`, branch `phase-4-hybrid-combat`.

Amendments carried from the 2026-11-26 draft (from Zach's rulings):
- No per-job :5173 pass — Zach ruled 2026-11-24: one test once everything is done; per-job gate is `npm test` only. The report lists the exact checks for that final test instead of doing them in this job.
- Gate rule: a report handed over from Claude Code means Zach's gate ran as expected (Zach, 2026-11-24) — here, red-with-cause with exactly the five named checks.

--

## Goal (in play)
Take out the dead code — and only the dead code. Legacy marker
detectors that nothing calls, an orphaned schema nothing reads, and
stale comments that point at files that moved. The suite stays
exactly as red-with-cause as it was (the five named checks, no new
failures), every live caller stays live, and the report names every
single thing removed with the proof that nothing used it. Nothing
the player can see changes.

## Background
- Queue scope (pm-guide queue line): L1–L6 cleanup — delete legacy
  marker detectors + dead code. Folds in: BOND_SHIFT orphan schema
  + 2 assertions, comment retargeting for moved docs (migrations
  EXCLUDED), the PreludeSession "503 OVERLOADED" stale comment,
  the `markerSchemas.js` duplicate definitions, and the docs/
  dead-rule sweep residual.
- Where the folds come from (starting points — verify each against
  live bytes before trusting it): BOND_SHIFT's orphan came out of
  the dm-mode-removal v2 job (the DM Mode service was deleted
  outright, git-recoverable; its migrations/tables stayed; the
  BOND_SHIFT orphan was filed to L1–L6). The comment-retargeting
  fold comes from the docs merge/archive pass (comment-only refs
  decision; residues filed into post-mvp-plan). The duplicate
  definitions were observed in `markerSchemas.js` during the
  class-audit fixes (2026-11-25). The docs/ sweep residual comes
  from the registry cleanup job: its zero-hits check excluded
  `docs/`, so dead-rule text may survive there. The L1–L6 list
  itself lives in the full-codebase audit — the survey in item 1
  enumerates it from `docs/pm/full-codebase-audit/REPORT.md` (audit
  2026-11-12, commit 6084b18) before anything is deleted. Do not
  trust a remembered list.
- Settled decisions that shape this job (do not re-decide):
  - Deletions are git-recoverable; the report must make each one
    restorable in one command (file + what was removed + commit
    to restore from). Back up before deleting/wiping (Zach,
    2026-11-11, decision authority).
  - Migrations are EXCLUDED from comment retargeting — a migration
    file's comments stay exactly as written, even if they point at
    a moved doc.
  - The 2024 book wins on conflict; never invent data.

## What to build
1. **Survey the live repo first, then delete nothing yet.** On the
   PC, branch `phase-4-hybrid-combat`, enumerate L1–L6 from the
   full-codebase-audit REPORT, one item at a time, and for EACH
   item prove against live bytes: what it is (file + line), whether
   anything calls / imports / reads it (every caller listed, or
   zero callers proved by search), and whether any test asserts on
   it. Report the full inventory before deleting anything.
   Workspace mirrors are staging copies, not the repo.
2. **Delete the legacy marker detectors and dead code.** For each
   L1–L6 item the survey proved has zero live callers and zero
   live readers: delete it. For each item with a live caller, a live
   reader, or an uncertain search result: do NOT delete it — report
   it as still-open with the caller cited. Deleting something the
   survey could not prove dead is forbidden in this job.
3. **BOND_SHIFT orphan.** Delete the orphaned BOND_SHIFT schema
   and its 2 assertions, only after the survey proves no live
   reader exists. If a reader exists, report it still-open with the
   reader cited and leave it in place.
4. **Comment retargeting, migrations excluded.** Retarget comments
   that point at moved docs to their new locations, one per
   comment, listed in the report. Migration files are skipped
   entirely — their comments stay as written.
5. **PreludeSession "503 OVERLOADED" stale comment.** Remove or
   correct it per what the survey finds the code actually does —
   if the overload behaviour is gone, the comment goes; if the
   behaviour is still there under another name, the comment is
   corrected to name it. Report which, with the evidence.
6. **`markerSchemas.js` duplicate definitions.** Find the duplicated
   definitions, prove which copy (if either) is read live, and
   remove only what the survey proves unread. If both copies are
   read, or the search is uncertain, report still-open with the
   readers cited and change nothing.
7. **docs/ dead-rule sweep.** Search `docs/` for rule text the
   registry cleanup removed from the live code (the cleanup's
   zero-hits check excluded `docs/`). Report each hit with file +
   line. Delete only text the survey proves describes code that no
   longer exists; anything ambiguous is reported, not deleted.
   Historical reports under `docs/pm/reports/` are records of what
   was true when written — do not edit them; list them as records.
8. **Tests.** The full suite must stay red-with-cause with exactly
   the five standing named checks (below) and no new failures;
   any test that asserted on deleted code is deleted with it and
   listed in the report (the BOND_SHIFT 2 assertions are the named
   case). No test is weakened to stay green. Run suites only
   through `npm test <name>` — never run a test file directly (it
   hits the live database).
9. **No :5173 pass in this job.** Zach ruled 2026-11-24: no :5173
   testing per job; one test once everything is done; per-job gate
   is `npm test` only. Do not drive :5173 in this job. The report
   lists the exact checks for that final test (the app still
   starts, a character still loads, and a session still opens after
   the deletions).

## The five standing named checks (expected red, not caused by this job)

In `return-loop.test.js` (81/86):
1. `[tick] GAP G-7: a world-clock advance at session end evaluates scene evolution`
2. `[protect] GAP G-4: the player's downtime assignment for TEST_RL_D Mira is scheduled`
3. `[protect] GAP G-5: full downtime jumps the clock by its span, 5 days`
4. `[protect] GAP G-6: the client's end-session request can carry the player's downtime choice`
5. `[protect] GAP G-6: the steward's downtime question is put to the player at session end`

## Out of scope
- Deleting anything the survey did not prove dead — reported
  still-open (item 2).
- Any migration file change of any kind, including its comments.
- Any deletion of live code, live data, or a live table — this is
  dead-code removal, not a refactor.
- Deleting the old creators (deletion comes last, only after the
  new creator including edit mode gates green — separate decision,
  not this job).
- Any behaviour change, prompt change, or rules change.
- The downtime + scene-evolution fixes behind the five named
  checks (blocked on Zach's scope call, separate job).
- Any other queued job (tooltip rewrite, the interface build,
  Embervale, or any post-MVP work). Jobs built since 2026-11-22
  are done and are not future work here.

## Acceptance criteria
- Every L1–L6 item is accounted for in the report: deleted (zero
  callers proved) or still-open (caller cited).
- The BOND_SHIFT schema + 2 assertions are deleted, or reported
  still-open with the reader cited.
- The `markerSchemas.js` duplicates are resolved or reported
  still-open with readers cited.
- The docs/ sweep hits are listed; deletions only where proven;
  historical reports untouched.
- Every retargeted comment is listed; no migration file was
  touched.
- The PreludeSession comment is removed or corrected with evidence.
- Full `npm test` red-with-cause with exactly the five named
  checks and no new failures; no test weakened.
- Every deletion is restorable in one command, stated in the
  report.

## Verification
- Run the full `npm test` yourself from the repo root on the PC.
  Zach's full run is the gate — never claim it.
- No :5173 pass (item 9). The report lists the final-test checks.
- Note the known runner flag: spellbook-routes takes ~158s against
  the runner's 120s per-file cap — a timeout artifact, not a
  failure, if it trips.

## Decisions already made
- Placement (PM decision 2026-11-27, vetoable at the gate): runs
  now under the red-with-cause guardrail; the five named checks
  are known and attributable, so a deletion causing a new red is
  identifiable. Supersedes the 2026-11-25 wait-for-green placement.
- Testing (Zach, 2026-11-24): no :5173 testing per job; one test
  once everything is done; per-job gate is `npm test` only. A
  report handed over from Claude Code means the gate ran as
  expected.
- Delete only what the survey proves dead; anything with a live
  caller stays and is reported (PM decision, vetoable — a wrong
  deletion costs more than a leftover).
- Migrations excluded from comment retargeting (pm-guide queue
  line).
- Back up before deleting; every deletion restorable in one command
  (Zach, 2026-11-11).
- Fix-as-you-find-it (Zach, 2026-11-06): same defect in a sibling
  gets fixed in this job and reported.
- Do not guess (Zach, 2026-11-07): if information is needed, ask
  before building. Never invent data — a gap is stated as a gap.

## Report
- §3 format from `claude-code-handoff.md`, plus per-item verdicts
  for the nine items above, the full L1–L6 inventory (file + line,
  callers or zero-callers proof, deleted / still-open), the
  deletion list with one-command restores, and the retargeted
  comments list.
- Any question for Zach in full plain terms, one per item, with
  what was checked and what is still unclear.
- How to verify: gate command + the exact checks for the one
  final :5173 test (listed, not run in this job).

## Setup — CONFIRMED 2026-11-10 (Zach)
- Claude Code is installed on Zach's PC. Zach couriers this brief
  to Claude Code and carries the report back to Muse.
- Staging is PC-only (Zach, 2026-11-12). Gate = Zach's `npm test`
  on the PC; the :5173 pass is the one final test, not per job.
- Place this brief at `docs/pm/l1-l6-cleanup/BRIEF.md`
  in the repo when handing it over. Reports live in
  `docs/pm/reports/`.
