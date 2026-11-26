# Brief — Return-loop test suite (amended 2026-11-25)

Amendments from the 2026-11-22 draft, all from Zach's later rulings:
- Removed the per-job :5173 pass (old item 6, Verification, Setup) — Zach ruled 2026-11-24: no :5173 testing per job; one test once everything is done; per-job gate is `npm test` only. The report now lists the exact checks for that final test instead of doing them in this job.
- Updated stale references: S1 is built and gated green (2026-11-23), not awaiting the gate; the placement question is settled — Zach placed this job next on 2026-11-25, after the mechanical reactions job (built and verified 2026-11-25, v1.0.220). Jobs built since 2026-11-22 are no longer listed as future work.
- Gate rule: a report handed over from Claude Code means Zach's gate ran green (Zach, 2026-11-24). The report lists final-test checks; it does not run them.

## Goal (in play)
The MVP's core promise, proved outside of play: a character can
leave, come back, and keep playing, and the world remembers. End a
session, and the clock advances, the tick runs, the state persists,
and a summary is waiting on return — every step verified by a test
the builder can run, not by a DM narration that says it happened.

## Background
- Queue scope (pm-guide queue line): return-loop test suite —
  session end → clock advance → tick ran → state persisted →
  session summary available on return, all outside of play. Needs
  S1 fixed first.
- S1 is built and gated green (commit ee70403, v1.0.200; gate
  green 2026-11-23 at head c070405, v1.0.201). This job assumes S1
  as built; if the survey finds S1's behaviour differs from its
  report, report that and stop — do not re-fix S1 here.
- Existing machinery it calls (session-end-flow-design.md, starting
  points — verify each against live bytes before trusting it):
  `deferredResolutionSweep.js` already runs at session end and
  resolves stranded companion activities, commissions, and orders;
  `scheduleService.js` owns the clock and schedules; the session-end
  flow schedules assignments and jumps the clock at end, resolving
  nothing yet; session end writes `sessions.pending_downtime`, and
  session start reads it; XP is scored at session end by LLM, with
  a pending-LLM fallback that never blocks session end and retries
  at next start. The return loop is the test that proves this chain
  holds end to end.
- Settled decisions that shape this job (do not re-decide):
  - MVP done means: create a character, play, leave, return, play
    again, loot, XP, level up, quests, companions, roleplay, combat,
    story moments, memory retained without loss (Zach, 2026-11-11).
    This suite is the test for the "leave, return, play again,
    memory retained" part of that sentence.
  - Downtime is opt-in at session end, never automatic; the PC is
    protected (hard invariant) — session-end-flow-design.md.
    The suite must assert the protection holds across the loop.
  - Level at session end, not mid-combat (XP system, locked
    2026-10-19). The suite checks the level lands at end, not in
    the middle of the return.

## What to build
1. **Survey the live repo first, then build.** On the PC, branch
   `phase-4-hybrid-combat`, verify every machinery point above
   against live bytes: the session-end entry point, the clock-advance
   call, the tick (time-evolution / schedule tick) entry point, the
   persistence writes, and the session-start summary read. Report
   the call chain with file and line before writing a test.
   Workspace mirrors are staging copies, not the repo.
2. **The loop, step by step, as tests.** Build a suite that runs
   the whole return outside of play: (a) end a session on a
   fixture character with pending state (a scheduled assignment,
   an in-flight schedule, an unspent XP award); (b) assert the
   clock advanced by the session-end span; (c) assert the tick ran
   (schedules resolved, evolution candidates produced or applied
   per the design — report which, with evidence); (d) assert the
   state persisted (character row, schedules, world state read back
   unchanged from the database, not from memory); (e) assert a
   session summary is available on return and names what changed.
   Each step is its own test group so a failure names the step.
3. **The protection holds.** Assert across the loop: the PC is
   never harmed, killed, or robbed by the tick; no downtime
   resolves without the opt-in; a session with a pending-LLM XP
   award closes normally and retries at next start, never blocking
   the return.
4. **Product gaps are reported, not fixed.** Where a step fails
   because the product does not do what the design says (not
   because the test is wrong — prove which, with evidence), report
   it as still-open with file, line, and the failing assertion.
   Do NOT fix product code in this job: the fixes ride as follow-up
   jobs Zach places. Test bugs are fixed in this job, in the open,
   with the before/after in the report.
5. **Full `npm test` green on the builder's run**, with the new
   suite included. A red suite that proves a real gap is reported
   as red-with-cause (the gap named, the step named) — never
   papered green by weakening an assertion.
6. **No :5173 pass in this job.** Zach ruled 2026-11-24: no :5173
   testing per job; one test once everything is done; per-job gate
   is `npm test` only. Do not drive :5173 in this job. The report
   lists the exact checks for that final test (end a session by
   hand, return, confirm the summary is there and the world state
   matches what the tests assert).

## Out of scope
- Any product-code fix for a gap the suite finds — reported
  still-open (item 4).
- Re-fixing S1 — report a divergence, do not rebuild it.
- Downtime resolution itself, stewardship play, or XP scoring
  changes — the suite exercises them, it does not redesign them.
- Any change to the session-end flow's order or to what the tick
  applies.
- The dead-code cleanup, tooltip rewrite, MVP-only UI build, the
  Embervale campaign design, or any other queued job.

## Acceptance criteria
- Every step of the loop has a test group: end → clock → tick →
  persist → summary-on-return, each naming its step on failure.
- The PC-protection and pending-XP assertions pass.
- Every product gap found is listed still-open with file, line, and
  assertion — none is silently fixed and none is silently dropped.
- Full `npm test` green on the builder's run, or red-with-cause
  naming the gap and step.
- The report lists the exact final-test checks for the hand return.

## Verification
- Run the full `npm test` yourself from the repo root on the PC
  and iterate until green (or red-with-cause, item 5). Zach's full
  run is the gate — never claim it.
- No :5173 pass (item 6). The report lists the final-test checks.
- Note the known runner flag: spellbook-routes has tripped the
  runner's per-file cap before — a timeout artifact, not a
  failure, if it trips.

## Decisions already made
- Test suite, not a product fix: product gaps are reported
  still-open (PM decision, vetoable at the gate — the loop's fixes
  are follow-up jobs Zach places, not smuggled into a test job).
- Needs S1 fixed first (pm-guide queue line); S1 as built is the
  assumption, a divergence stops the job (PM decision, vetoable).
- Testing (Zach, 2026-11-24): no :5173 testing per job; one test
  once everything is done; per-job gate is `npm test` only. A
  report handed over from Claude Code means the gate ran green.
- Fix-as-you-find-it (Zach, 2026-11-06): same defect in a sibling
  gets fixed in this job and reported — test bugs included.
- Do not guess (Zach, 2026-11-07): if information is needed, ask
  before building. Never invent data — a gap is stated as a gap.
- The 2024 book wins on conflict.

## Report
- §3 format from `claude-code-handoff.md`, plus per-item verdicts
  for the six items above, the surveyed call chain (file + line per
  step), and the still-open gap list (file, line, failing
  assertion per gap).
- Any question for Zach in full plain terms, one per item, with
  what was checked and what is still unclear.
- How to verify: gate command + the exact final-test checks.

## Setup — CONFIRMED 2026-11-10 (Zach)
- Claude Code is installed on Zach's PC. Zach couriers this brief
  to Claude Code and carries the report back to Muse.
- Staging is PC-only (Zach, 2026-11-12). Gate = Zach's `npm test`
  on the PC; the :5173 pass is the one final test, not per job.
- Place this brief at `docs/pm/return-loop/BRIEF.md`
  in the repo when handing it over. Reports live in
  `docs/pm/reports/`.
