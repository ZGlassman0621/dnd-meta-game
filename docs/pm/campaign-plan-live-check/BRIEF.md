# Brief — campaign-plan live check: prove campaign-plan generation works on the local model

**Status: AUTHORIZED 2026-11-14 (PM, under delegation — the
requirement is Zach's own corrected answer, 2026-11-13: Embervale
IS the MVP campaign, and campaign-plan generation is a normal
player path that must work). Ready to hand over. One job at a
time — this is the active job.**

**Job type: VERIFY.** A live check, not a build. No product-code
changes; a live script under `tests/live/` (excluded from `npm
test`, like the leak test) is allowed if one is needed to drive
the path. No migration. If the check finds the port broken,
REPORT it and stop — do not redesign or fix beyond this brief;
the fix is a separate job.

**Branch:** `phase-4-hybrid-combat`. Head at briefing: `bf04caa`
(merge-and-archive). Pull latest before starting; a fresh clone
lands on stale `main` — check out `phase-4-hybrid-combat`.

**Start condition:** local-model-only built + pushed — MET
(commit `a04d39f`). This job verifies one thing that build ported
but never ran live.

**Inputs (read both):**
- `docs/pm/HANDOFF.md` (standing rules, report requirements,
  verification bar).
- This brief. The local-model-only report
  (`docs/pm/reports/local-model-only-REPORT.md`) is background:
  it records that campaign-plan generation was ported
  (generation role, no quality gate) and NOT run live.

**Outputs:** a live script if needed + the report at
`docs/pm/reports/campaign-plan-live-check-REPORT.md`; brief
placed at `docs/pm/campaign-plan-live-check/BRIEF.md`.

## Goal (in play)

The player can ask the game to generate a campaign plan and gets
a real, usable plan back — on the local model, offline, no API
key. This job proves that path works end to end and shows what a
plan looks like, so the PM (and Zach, at the gate) can judge
whether the port is good enough or needs a follow-up.

## Background

- The local-model-only job ported `campaignPlanService.js` to the
  local model (generation role) but never ran it live — its
  Decision 2 said campaign plans were not MVP-critical and needed
  no quality gate.
- Zach corrected that the same night: Embervale IS the MVP
  campaign, and campaign-plan generation is a normal player path
  that must WORK. The revised brief required a sample plan +
  quality assessment; the build predates the revision, so the
  requirement is unmet. This job meets it.
- How Embervale itself comes to exist (written/imported vs
  generated) is UNSETTLED and belongs to the queued
  campaign-design job — NOT this job. This job checks the
  generation machinery, not Embervale's content.

## Decisions (settled — do not re-decide)

- Campaign-plan generation is a normal player path and must work
  (Zach, 2026-11-13, corrected answer).
- This job is evidence, not a gate: a sample plan + quality
  assessment, reported honestly. There is no pass/fail bar on
  quality — the PM judges from the evidence.
- No product-code changes. If generation fails or produces
  garbage, that is the finding; report it verbatim and stop.

## Items

0. **Map the path.** Find the real entry point(s) for
   campaign-plan generation: the service
   (`campaignPlanService.js`), the route that calls it, and the
   client page (`CampaignPlanPage.jsx`) if one drives it.
   Confirm which role/model it uses and what input it needs (a
   seed? a prompt? a form?). Report the path before running
   anything.
1. **Run it live.** With Ollama up and gemma4:12b loaded,
   generate TWO sample plans through the REAL path (route or
   service, as the player would reach it — not a stub, not a
   unit test): (a) one from a plain seed (e.g. "a Sword Coast
   campaign, levels 1–5"), (b) one from a different seed of your
   choice (different region and level range, to show it is not
   canned). Record per run: input, model, latency, token counts
   if available, and whether the output parsed/validated through
   the game's own pipeline.
2. **Report the plans verbatim.** Both sample plans go in the
   report IN FULL (not summarized, not excerpted). If a plan is
   long, the full text goes in the report anyway — the PM reads
   it.
3. **Assess quality, honestly.** For each plan: is the structure
   complete (the sections the service promises)? Is it coherent
   (names, places, hooks consistent within the plan)? Is it
   usable (could a DM run from it, or is it generic filler)?
   Note anything invented that contradicts the input, anything
   truncated, and any marker/JSON failure. No grading scale —
   plain judgments with the evidence quoted.
4. **Live script (only if needed).** If driving the path needs a
   script, put it at `tests/live/campaign-plan-live.mjs`,
   runnable with `npm run test:campaign-plan` (add the script to
   `package.json` if you add the file), using a throwaway DB
   like the leak test. It must NOT run under `npm test`. If the
   route can be driven with curl or a scratch script instead,
   prefer that and report the commands.
5. **Full `npm test`.** The suite must stay green. This job adds
   no counted test files (a `tests/live/` script is not
   counted).

## Verification

- Full `npm test` green on the PC, counts reported.
- Both plans in the report verbatim, with per-run inputs and
  latency.
- No product code changed (report lists every file touched;
  expect: report + brief + at most one live script + at most
  one `package.json` line).
- State the role/model used. No grep proof required (no provider
  change).

## Out of scope

- Fixing or improving generation (report + stop).
- Embervale's content, or how Embervale comes to exist
  (campaign-design job).
- Any `:5173` click-through (route-level check; if you drive
  the page, say so, but it is not required).
- Any other local-model follow-up (leak test, prompt trimming —
  separate/queued).

## Report

Understanding section first (project + job, in your own words).
Then: the path mapped (item 0), the two runs (inputs, latency,
token counts), both plans VERBATIM, the quality assessment with
quoted evidence, the test result, every file touched with
SHA-256, and anything found (blockers, oddities, follow-ups). A
claim without its evidence is unverified, not done.
