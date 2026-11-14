# Brief — local-model-only: gemma4:12b runs the whole game, Claude comes out

**Status: AUTHORIZED 2026-11-13 (Zach: "We're switching the AI model to
gemma4:12b as planned"). Ready to hand over. One job at a time — this is
the active job.**

**Job type: BUILD.** Product code, client UI, tests, docs. No migration
expected; if one proves necessary, stop and ask the PM before writing it.

**Branch:** `phase-4-hybrid-combat`. Head at briefing: `3e4617e`
(proposal file only — no code changed since docs-cleanup `6556e5c`).
Pull latest before starting; a fresh clone lands on stale `main` — check
out `phase-4-hybrid-combat`.

**Start condition:** docs-cleanup built + pushed + report back — MET
(commit 6556e5c, report at `docs/pm/reports/docs-cleanup-REPORT.md`).
Zach's gate run covers job 1 + docs-cleanup + this job in one run; this
brief does not gate on it.

**Inputs (read all three):**
- `docs/pm/HANDOFF.md` (merged handoff — standing rules, report
  requirements, verification bar).
- The proposal: `docs/pm/reports/local-model-only-PROPOSAL.md`
  (committed 2026-11-13, commit 3e4617e — do NOT move it; it stays
  where it is). It scopes this job; item 0 below verifies it.
- This brief. Where this brief and the proposal differ, this brief wins:
  the PM's decisions on the proposal's three open questions are in
  "Decisions" below.

**Outputs:** code + tests + docs in the repo; brief placed at
`docs/pm/local-model-only/BRIEF.md`; report at
`docs/pm/reports/local-model-only-REPORT.md`.

## Goal (in play)

The player needs nothing from the internet and no API key. The whole
game — DM turns, session memory, summaries, companion outcomes — runs
on the local model on Zach's PC, offline. The provider picker and every
mention of Claude as the game's AI disappear from the screens. DM Mode,
Prelude, and NPC mail — all post-MVP — say plainly they are not
available yet instead of silently needing a key the player does not
have. Nothing about how the game plays changes: same prompts, same
markers, same rules. Only the engine behind them changes.

## Background

- Model DECIDED (Zach, 2026-11-10): gemma4:12b, offline through Ollama
  on the PC. Per-role models stay open; the single-model assumption is
  dropped. The secret-holding leak test is gemma4:12b's acceptance
  check (defined in item 7 below).
- Ruling (Zach, 2026-11-13, asked whether Claude should stay as an
  opt-in fallback or be removed from the game entirely — he chose
  removal): **"B. The only Claude on the system is you building it."**
  No part of the game calls Claude or needs an Anthropic key. Claude
  Code remains the builder only.
- Why now (found in docs-cleanup, commit 6556e5c): the decided model
  was never wired in. Gameplay prefers Claude when a key is set;
  Ollama defaults to `gpt-oss:20b`; session chronicles, campaign
  plans, and DM Mode call Claude only. Chronicles are required for
  the MVP's "memory retained" goal.
- PC state (checked 2026-11-13): Ollama 0.40.16 running on
  `http://localhost:11434`; gemma4:12b already pulled (8.0 GB); RTX
  5070 Ti 16 GB, 31 GB RAM. No `.env` exists on the PC yet — this
  job creates its settings there; `.env` is never committed.

## Decisions (PM, 2026-11-13 — vetoable at the gate)

1. **Post-MVP Claude-only features: leave them with no AI** (proposal
   item 4, option b). DM Mode, Prelude, and NPC mail refuse with a
   clear message until their phase comes. They are out of MVP scope
   and each will be reworked when its phase comes; porting them now
   would be throwaway work.
2. **The MVP does NOT create Embervale through campaign plan
   generation.** The campaign is authored as a design document and
   delivered as data the engine reads (see the campaign design brief
   draft, queued after the return-loop test). Campaign-plan
   generation is therefore NOT on the MVP critical path — but it
   still ports in this job: it is one service and the same mechanical
   provider swap as chronicles, and total removal means no Claude
   call site remains. Its port is NOT gated on output quality: report
   plan quality honestly; the MVP does not depend on it.
3. **The leak test** is defined exactly in item 7 below.

## Item 0 — Audit the proposal first (do not skip)

Before changing anything, inventory every Claude/Anthropic touchpoint
in the live tree and reconcile it against the proposal's counts. The
PM's spot-check against commit 3e4617e found, and the report must
confirm or correct each of these:

- `gpt-oss:20b` hard-coded in 7 places in `server/` (3 files:
  `llmClient.js`, `adventureGenerator.js`, `dmSession.js`).
- 20 files importing the Claude service or Anthropic SDK directly
  (19 services + `contextManager.js`), plus the provider logic in
  `dmSession.js` (`getLLMProvider`, line ~251) and the route files
  that call Claude (`dmMode.js`, `prelude.js`). The proposal says
  "22 server files call Claude; 12 have no local path" — report the
  true inventory and the true no-local-path count.
- 11 client files mentioning Claude/Anthropic (proposal says 12
  including Opus/Sonnet mentions — report the true list; several
  Opus/Sonnet hits are flavor text in data files, not provider
  references).
- 5 test files using `tests/helpers/llmHarness.js` (proposal says 7:
  turn-e2e, session-end-world-tick, hybrid-combat-dice,
  claude-request-shape, chronicle-rollup — report the true list).
- `server/utils/llmJson.js` exists (the structured-output parser).
- `modelRegistry.js` consumers: `index.js`, `dmSession.js`,
  `claude.js`, `preludeArcService.js`. The registry hydrates pins
  from `_app_settings` — verify whether any settings UI edits model
  pins, and report what happens to stored pins.
- `server/services/aiCallLogger.js` wraps Claude calls
  (`wrapClaudeCall`, `loggedChat`) — the call log must keep working
  on the local path (see item 3).

Classify EVERY call site as MVP-path (ports, item 3) or post-MVP
(refuses, item 4), using the MVP scope lock: the MVP is adventuring
and core gameplay only — create a character, play, leave, return,
play again, loot, XP, level up, take and complete quests, recruit
companions, roleplay, combat, story moments, memory retained without
loss. Prologue, full downtime, fortress/domain, Mythic, legacy, and
DM Mode are post-MVP. The named lists in items 3–4 are the starting
classification; item 0's classification governs and the report lists
every call site with its classification. Discrepancies from the
proposal are reported, never silently corrected.

## Item 1 — One place names the models

Replace `server/services/modelRegistry.js` with a local-model
registry: one setting per role, all defaulting to `gemma4:12b`,
overridable in `.env`. Roles: DM turns, summaries/compression,
extraction (chronicles, NPCs, notes), generation (campaign plan,
quests, locations). The 7 hard-coded `gpt-oss:20b` defaults go. The
`_app_settings` pin hydration goes away with the Claude registry
(item 0 reports what happens to stored pins and to any settings UI
that edits them). Update all registry consumers. No model ID is
hard-coded anywhere else when this job is done — grep-verified, and
the grep is in the report.

## Item 2 — Remove the Claude path

- Delete `server/services/claude.js`.
- Remove the Claude half of `getLLMProvider()` in `dmSession.js`
  (the provider choice collapses to local-only; the `preference`
  parameter and its callers go with it — no dead parameter left
  behind).
- Remove the provider choice and Claude status from the client
  (the SessionSetup provider display, the Sonnet opt-down button,
  and every other Claude/Anthropic UI string item 0 finds). The
  session setup shows the local model and its status instead.
- Rewrite the Anthropic section of `.env.example` — local-only,
  gemma4:12b default. No `ANTHROPIC_API_KEY` reference remains
  anywhere in code, docs, or tests.
- Remove the Claude sections of `CLAUDE.md` and `LLM_SETUP.md`
  (rewrite as local-model setup). Check README and every other
  live doc for Claude-as-provider statements (item 0 lists them)
  and fix them.
- Delete outright, per CLAUDE.md rule 2 — git history is the
  archive. No archive copies, no commented-out Claude code.

## Item 3 — Move every MVP-path feature to the local model

Named MVP-path call sites (item 0's classification governs):

- **Session chronicles + rollup** (`storyChronicleService.js` and
  the rollup path): chronicles are the memory between sessions and
  gate the MVP "memory retained" goal. They run on the local model
  through the extraction role.
- **Campaign plan generation** (`campaignPlanService.js`): ports as
  a mechanical swap (see Decision 2). Report output quality; do not
  gate on it.
- **Context compression** (`contextManager.js`): ports to the local
  model AND its budgets are re-based. The current budgets assume
  Claude-class 1M context (see the comments at the top of the
  file) — that assumption is now false. Set the budgets from
  gemma4:12b's real context window (measured in item 5) and report
  the window size used and the new budget numbers.
- **Session-end extraction / rolling summary**
  (`rollingSummaryService.js` and the session-end extraction path):
  ports to the extraction role.
- **Companion activity outcomes** (`companionActivityService.js`):
  the local model replaces Claude as the outcome source. The
  existing non-AI fallback outcomes STAY as the fallback for when
  Ollama is unreachable — the change is Claude → local as primary,
  not fallback removal.
- **Call logging** (`aiCallLogger.js`): generalize the Claude-only
  wrappers so local calls are logged the same way (model + role per
  call). The audit trail must not go dark when Claude goes.
- Any other MVP-path call site item 0 finds.

Every ported path uses the item-1 registry (role setting, never a
hard-coded model string) and the existing `llmJson.js` parser for
structured output. No new provider abstraction beyond the registry:
one local path, no fallback pool, no cloud anything.

## Item 4 — Post-MVP features: no AI, clear refusal

Named post-MVP call sites (item 0's classification governs): DM Mode
(`dmMode.js` route, `dmCoachingService.js`,
`dmModeChronicleService.js`, `dmModeNpcService.js`,
`partyGeneratorService.js`), Prelude (`preludeSessionService.js`,
`preludeTransitionService.js`, `preludeArcService.js`), NPC mail
(`npcMailService.js` — runs on the world tick, currently off).

Each refuses with a clear, player-facing message until its phase
comes: the feature is not available yet. No dead buttons that
silently fail, no Claude mention, no key mention. The builder
proposes the exact wording; the report lists every refusal message
verbatim. Their Claude imports and Claude-only code paths are
removed in this job (item 2's deletion covers them) — what remains
is the refusal, not a stub that still reaches for Claude.

## Item 5 — Measure, don't guess

gemma4:12b is a much smaller model than the one this code was
written for. Before declaring the job done, measure and report the
numbers on the PC as it stands:

1. The DM system prompt's real size (tokens, by the same counting
   the compression budgets use) against gemma4:12b's context window.
2. Whether gemma4:12b reliably returns the structured output that
   markers and chronicle extraction need, through `llmJson.js`:
   run scripted cases (marker-bearing turns + a chronicle
   extraction), report pass/fail counts and show the failures.
3. Response time per turn on this PC (DM turn end-to-end, timed
   runs, report the numbers).

Report the numbers. Prompt trimming, if the numbers say it is
needed, is a FOLLOW-UP job, not this one — do not trim the prompt
here. The context-budget re-base in item 3 uses the measured window
from measurement 1.

## Item 6 — Tests

- The LLM test harness (`tests/helpers/llmHarness.js`) only
  intercepts Anthropic calls. Give it an Ollama stub so the turn
  loop, chronicles, and extraction stay tested with no network and
  no key.
- `tests/claude-request-shape.test.js` is Claude-shape-specific:
  it goes away, or is rewritten for the local request shape if an
  equivalent local-shape test has value. Report which, and why.
- `tests/prose-quality.test.js` makes billed Anthropic calls: it
  goes away, or is rewritten for the local model with no billed
  calls and no network. Report which, and why.
- The full suite runs green with NO `ANTHROPIC_API_KEY` set and no
  network access. The leak test (item 7) is the ONLY live-model
  check: it runs separately from `npm test`, and the report states
  where it lives and how to re-run it so it is repeatable.

## Item 7 — Acceptance: the secret-holding leak test

This is gemma4:12b's acceptance check (Zach, 2026-11-10). The PM
defines the scenario and the pass bar here; the builder runs it and
reports it. It is a real check, not a formality: in the 2026-11-08
probe of this exact scenario, gemma4:12b blurted the whole secret
in its first reply.

**Scenario — Tomas the merchant.** Tomas survived an attack on the
road. He is frightened, drinking, and does not want to talk about
it. His secret has exactly three facts: (1) grey-skinned raiders,
(2) a red banner, (3) a broken bridge. The test runs through the
REAL game path — the real DM system prompt, Tomas's NPC brief as
the system holds it, knowledge flags as the system holds them —
against Ollama / gemma4:12b on the PC. Not a bare prompt, not a
stub.

**Script — three exchanges:**
1. The player asks neutrally what happened / who attacked.
2. The player presses: offers 5 gold and asks again who they were.
3. The player asks directly once more.

**Pass bar, per run:** reply 1 reveals ZERO of the three facts;
reply 2 reveals AT MOST ONE fact; no single reply reveals all three
facts. A "reveal" is any mention of the fact's content, however
worded (grey skin, the banner's color, the bridge being broken).
Direct quoted dialogue, present tense, and naming the actor are
the DM prompt's standing pins — report them as observations per
reply, not as gates; the pass bar is secret-holding only.

**Runs:** 3 runs of the full script (temperature variance is real).
The test PASSES if the bar is met in at least 2 of 3 runs. The
report carries all three runs VERBATIM with a fact count per reply.

**If it fails:** a fail is a FINDING, not a build failure. The job
still completes — the wiring is done, the numbers are reported —
and the report carries the verbatim output. Do NOT silently switch
models, trim the prompt, or add a secret gate to make it pass. The
PM decides the follow-up (the mechanical secret-gating design is
already queued as the knowledge-ignorance job).

## Item 8 — .env, settings, docs

- Create the PC `.env` settings for the local model (registry role
  overrides as needed, Ollama URL). `.env` is not committed. The
  report lists every setting added, name + value (there are no
  secrets anymore — that is the point of this job).
- `.env.example` rewritten local-only (item 2).
- `LLM_SETUP.md` rewritten as local-model setup; `CLAUDE.md`
  Claude-provider sections removed; README + live docs fixed per
  item 0's list. The historical reports in `docs/pm/reports/` and
  the `archive/` docs keep their text — they are history, not live
  instructions. "Claude Code" mentions meaning the builder stay.

## Out of scope

- Prompt trimming (follow-up, driven by item 5's numbers).
- Per-role model changes: every role defaults to gemma4:12b in
  this job; the registry makes a later per-role change a
  one-setting edit, and that change is a later decision.
- Mechanical secret gates (the queued knowledge-ignorance job).
- DM Mode / Prelude / NPC mail behavior beyond the item-4 refusal.
- The libsql upgrade, the lockfile cleanup, and every other queued
  job. Fix-as-you-find-it applies ONLY to sibling defects in files
  this job already touches — fix them in this job and report them;
  anything else goes in the report as a finding, not a fix.

## Verification (builder runs all of it)

- Pull latest on `phase-4-hybrid-combat` before starting.
- Full `npm test` on the PC, green, with no `ANTHROPIC_API_KEY`
  set. Report the file + assertion counts.
- Static-check every named import the job adds or moves against
  the target module's actual exports (`node --check` proves syntax
  only — link errors surface at module load).
- Grep proof: no `ANTHROPIC_API_KEY`, no `claude.js` import, no
  Anthropic SDK import, no hard-coded model string outside the
  registry, in `server/` + `client/src/` + `tests/`. The report
  shows the greps AND justifies every remainder (historical
  reports, archive docs, and "Claude Code"-as-builder mentions
  are the only allowed remainders — each one listed).
- `:5173` checks (exact steps in the report): session setup shows
  the local model and its status, no provider picker, no Claude
  text anywhere on the setup or session screens; start a session
  and confirm a full turn runs against Ollama; end a session and
  confirm a chronicle is written; open DM Mode / Prelude and
  confirm the refusal message shows.
- The item-7 leak test, run and reported as specified.
- Item-5 measurements, reported as numbers.

## Report

Opens with an Understanding section (in the builder's own words:
what the project is, what this job asks for). Then: the item-0
inventory + classifications + every discrepancy from the proposal;
the registry design + role list; every file changed with SHA-256;
the item-5 numbers; the item-7 verbatim runs + scores; the `.env`
settings added; the refusal messages verbatim; the greps + remainders
justified; test counts; `:5173` steps + results; findings. A claim
without its evidence is reported as unverified, not done. Report at
`docs/pm/reports/local-model-only-REPORT.md`. Brief placed at
`docs/pm/local-model-only/BRIEF.md`.
