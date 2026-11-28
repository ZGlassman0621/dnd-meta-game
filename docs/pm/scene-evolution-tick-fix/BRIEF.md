# Brief — scene-evolution-tick-fix: evaluate scene evolution when the world clock advances at session end

**Job slug:** `scene-evolution-tick-fix`
**Brief placement:** `docs/pm/scene-evolution-tick-fix/BRIEF.md`
**Report placement:** `docs/pm/reports/scene-evolution-tick-fix-REPORT.md`
**Branch:** `phase-4-hybrid-combat` (pull latest first; head is v1.0.229, code commit `4862489` plus its report commit)
**Source:** the return-loop report (2026-11-26), gap G-7. Zach's instruction 2026-11-27: send the fixes one at a time. This is the first — the scene-evolution check only. The four downtime checks stay red and are a later job.

## Understanding (required in your report)

Open your report with an Understanding section: what this job is, what you found in the live code, and where your understanding differs from this brief. A claim without evidence (commit hash, file hashes, test counts) is reported as unverified, not done.

## The gap

The locked time-evolution design says the tick trigger is `tickEvolution()` (`server/services/timeEvolutionService.js`, function at `:191` as of the return-loop report — verify against live bytes), which "evaluates every scene in a campaign on world-clock advance." It has no caller anywhere: not session end, not the orchestrator, not the living-world tick, not the sweep. No evolution candidates are produced or applied when the clock moves. `tickEvolution` writes nothing by design — it produces candidates — so the failing return-loop assertion is a source check that some session-end path calls it:

`[tick] GAP G-7: a world-clock advance at session end evaluates scene evolution`

## What to build

### 1. Survey first

Against live bytes, establish:
- What `tickEvolution` actually does: what it reads, what candidates it produces, what shape they have, and what (if anything) consumes or applies them today.
- Where the world clock advances at session end (the session-end path and the one place session time moves), and which of those is the right call site for "on world-clock advance."
- Whether the living-world tick or the deferred-resolution sweep already advance the clock in a way that should also evaluate — report what you find; wire only the session-end path in this job unless the survey proves another path is the same code path.

### 2. Wire the call

Call `tickEvolution` from the session-end world-clock advance, for the campaign whose clock moved, so that a session end that advances the clock evaluates that campaign's scenes. Candidates produced must go wherever the design says they go (per your survey). If the survey proves the candidates have no consumer and applying them needs new machinery beyond the call itself, stop and report — do not invent an applier in this job; the evaluation wiring plus an honest report of the candidate sink is the deliverable.

### 3. Replace the source check with a behavior check

Per the return-loop report's own instruction (decision 4): when a fix job wires G-7, replace the source check in `tests/return-loop.test.js` with a behavior check — a world-clock advance at session end produces evolution candidates for the campaign's scenes (or, if the survey proves candidates are applied somewhere, that the application happened). The check must fail against the pre-fix code; say so in the report with the count.

## Fences

- No downtime work. The four downtime checks stay red exactly as named; do not touch the downtime path, the session-end downtime question, or `pending_downtime_narratives`.
- No new evolution rules or design. Wire the locked design's trigger only; do not change what `tickEvolution` evaluates or how candidates are scored.
- The evolution-news → DM prompt wiring is post-MVP (Wave 1) and out of scope. If candidates currently die on the floor, that is reported, not fixed here.
- No new migration unless the live code proves one is needed — if it does, stop and report before writing it.
- Source tag: the locked time-evolution design in the code, no feature flag.

## Tests

- The replaced behavior check in `return-loop.test.js` (item 3), plus any small suite needed to prove the wiring (session end advances the clock → candidates produced for the campaign's scenes; a session end that does not advance the clock does not evaluate, if the design says so — per your survey).
- Run suites only through `npm test <name>` — never run a test file directly (it hits the live database).

## Gate

Full `npm test` from the repo root. Expected after this job: red-with-cause with **exactly the four standing named downtime checks** in `return-loop.test.js` (G-4, G-5, G-6 ×2) and no other failures. The G-7 check passes. Any other count is a new red — report it as such.

## Report

Write the report to `docs/pm/reports/scene-evolution-tick-fix-REPORT.md`: Understanding first, then per-item verdicts, files changed with SHA-256s, test counts (full run + touched suites), anything not done named honestly, and decisions made (reversible, for veto). Cost/usage: report what you can measure; "unknown" is an acceptable answer.
