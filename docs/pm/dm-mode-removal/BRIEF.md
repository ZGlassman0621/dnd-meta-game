# Brief — dm-mode-removal: DM Mode comes out of the code entirely

**Status: AUTHORIZED 2026-11-14 (Zach: "I want to remove DM Mode from
the code. It serves no purpose and I don't need it."). REVISED
2026-11-14 (v2): adds `dmCoachingService.js` to the delete list
(missed in v1 — the PM's filename grep didn't match it) and updates
the head to `a04d39f`. This v2 SUPERSEDES the v1 handover copy; do
not courier v1. Ready to hand over. One job at a time — this is
the active job.**

**Job type: BUILD (deletion).** Product code, client UI, tests, live
docs. No migration — migrations are never touched in this job (see
Decision 2).

**Branch:** `phase-4-hybrid-combat`. Head at briefing: `a04d39f`
(local-model-only, v1.0.195). Pull latest before starting; a fresh
clone lands on stale `main` — check out `phase-4-hybrid-combat`.

**Start condition:** docs-cleanup built + pushed + report back — MET
(commit 6556e5c). Local-model-only built + pushed (`a04d39f`) —
this job removes the DM Mode code that build ported. Zach's gate
run covers this job with the jobs before it; this brief does not
gate on it.

**Inputs (read both):**
- `docs/pm/HANDOFF.md` (merged handoff — standing rules, report
  requirements, verification bar).
- This brief.

**Outputs:** deletions + edits in the repo; brief placed at
`docs/pm/dm-mode-removal/BRIEF.md`; report at
`docs/pm/reports/dm-mode-removal-REPORT.md`.

## Goal (in play)

DM Mode disappears completely: no card on the home screen, no
screens, no API route, no services, no tests. Everything else plays
exactly as before — the main game (create, play, leave, return,
loot, XP, level, quests, companions, roleplay, combat, story,
memory) is untouched. The removal is recoverable: delete outright,
git history is the archive.

## Background

- DM Mode is the "You DM for 4 AI player characters" mode,
  reachable from the home screen (`showDMMode`). It has been
  post-MVP since the 2026-11-11 scope lock. Zach decided
  2026-11-14 it serves no purpose and he does not need it.
- DM Mode was ported to the local model in commit `a04d39f`
  (local-model-only, built before this removal was decided). Its
  files now call the local model, not Claude. Deleting them
  removes the ported code; nothing about the removal changes.
- The post-MVP plan's "DM Mode tutorial" item is struck by this
  decision (the PM handles the plan — it is not in the repo and
  not yours to edit).
- The proposal for local-model-only
  (`docs/pm/reports/local-model-only-PROPOSAL.md`) names DM Mode
  files, but its list is incomplete: it misses four services
  (`dmModeService.js`, `dmModePromptBuilder.js`,
  `dmModePrepService.js`, `dmModeBondShiftService.js`). Use the
  live tree, not the proposal, for the DM Mode inventory. Do NOT
  edit the proposal — it is history.

## Decisions (Zach + PM — vetoable at the gate)

1. **Delete outright**, per CLAUDE.md rule 2 — git history is the
   archive. No archive copies of code, no commented-out DM Mode
   code left behind.
2. **Migrations and tables stay.** Never edit, delete, or add a
   migration in this job. The DM Mode tables remain in the schema,
   empty and harmless. No drop migration. Report any DM-Mode-only
   tables left behind as findings.
3. **Shared code and data stay.** The spell list at
   `client/src/data/spells/` is SHARED with the main game
   (CharacterSheet, LevelUpPage, creator stages, spellbook
   helpers, reference panels) — do NOT delete it. NPC codex data
   and services stay unless item 0 proves a file is DM-Mode-only.
   When in doubt, STOP and ask — do not guess-delete shared code.
4. **The docs are a separate job.** `DM_MODE.md` and
   `Claude PM Review Docs/DM_MODE_REVIEW.md` are NOT touched in
   this job — the merge-and-archive job archives them after this
   job lands. This job fixes only the three live docs named in
   item 4.

## Item 0 — Inventory + classify every DM Mode touchpoint (do not skip)

Before deleting anything, grep the live tree for `dmMode`,
`DMMode`, `dm-mode`, `DM Mode`, `dmCoaching`, `DMCoaching`, and
`showDMMode` (in `server/`,
`client/src/`, `tests/`, and live docs) and classify EVERY hit:

- **DELETE** — a file that exists only for DM Mode.
- **CLEAN** — a shared file: remove the DM Mode references only,
  keep everything else working.
- **LEAVE** — migrations, history, shared data, and the two docs
  named in Decision 4.

The PM's inventory against commit `006346b` is the starting list;
item 0's classification governs and the report lists every file
with its classification + evidence. Discrepancies from this list
are reported, never silently acted on.

Starting list — DELETE candidates:
- Server: `server/routes/dmMode.js`;
  `server/services/dmCoachingService.js`,
  `dmModeService.js`, `dmModePromptBuilder.js`,
  `dmModeChronicleService.js`, `dmModeNpcService.js`,
  `dmModePrepService.js`, `dmModeBondShiftService.js`,
  `partyGeneratorService.js` (zero consumers found — verify).
- Client (closed cluster — `DMMode.jsx` is the only consumer;
  verify): `client/src/components/DMMode.jsx`,
  `DMCoachingPanel.jsx`, `CampaignPrepScreen.jsx`,
  `NPCCodexPanel.jsx`, `PlotThreadPanel.jsx`,
  `PrepReferencePanel.jsx`.
- Tests: `tests/dm-mode.test.js`,
  `tests/dm-mode-bond-shift.test.js`.

Starting list — CLEAN candidates (shared files, references only):
- `server/index.js` (the `dmModeRoutes` import + the
  `/api/dm-mode` mount).
- `client/src/App.jsx` (the lazy `DMMode` import, the
  `showDMMode` view, the home-screen DM Mode card).
- `client/src/components/NavigationMenu.jsx` (routing/comment
  references to `showDMMode`).
- `client/src/components/SessionSetup.jsx` (a `DMMode` reference
  appeared here in the local-model port — verify and clean).
- `server/services/markerSchemas.js`,
  `promptShapeAccounting.js`, `ruleVerifiers.js` (comment and
  reference cleanup only — these services stay).
- `server/utils/playtestLogger.js`,
  `server/scripts/purge-gameplay-state.js` (classify each
  reference; leave table handling alone unless it imports
  deleted code).
- `tests/integration.test.js`, `tests/session-transcript.test.js`
  (remove DM Mode cases/references; the suites stay green).

Starting list — LEAVE:
- ALL migrations (`001`, `014`–`018`, `021`, `022`, `079`, and
  every other) — history, never touched.
- `client/src/data/spells/*` (shared — Decision 3).
- `docs/`, `archive/`, historical reports (never touched).
- `DM_MODE.md`, `Claude PM Review Docs/DM_MODE_REVIEW.md`
  (Decision 4).

## Item 1 — Delete the server side

Delete the DELETE-classified server files (item 0 governs) and
remove the route mount + import from `server/index.js`. No dead
imports left behind anywhere: every import of a deleted module
goes with it. The `/api/dm-mode` route must stop existing
entirely (not return an error page — the mount is gone).

## Item 2 — Delete the client side

Delete the DELETE-classified client files (item 0 governs) and
clean `App.jsx` + `NavigationMenu.jsx`: no lazy import, no
`showDMMode` view, no home-screen card, no routing reference.
The home screen shows the remaining modes exactly as before.
No other screen changes.

## Item 3 — Delete the tests, clean the shared suites

Delete the DELETE-classified test files. Clean the shared suites
(item 0's list): remove DM Mode cases and references, keep the
suites green and asserting what they claim. Do not weaken a
shared suite to make it pass — if a shared test cannot pass
without DM Mode, STOP and report it.

## Item 4 — Live docs: DM Mode is no longer a live system

Remove DM Mode as a live system from exactly three live docs:
`README.md` (the out-of-scope line naming DM Mode), `CLAUDE.md`
(status / feature-flag mentions), `LLM_SETUP.md` (DM Mode
mentions). Report every OTHER live mention found (e.g.
`AI_NARRATIVE_PERSISTENCE.md`, `Themes-Replace-Backgrounds.md`)
as findings with file + line — do not rewrite docs outside
these three. Do NOT touch `DM_MODE.md` or `DM_MODE_REVIEW.md`
(Decision 4). Do NOT touch `docs/`, `archive/`, or historical
reports.

## Out of scope

- Migrations, table drops, or any schema change (Decision 2).
- Archiving `DM_MODE.md` / `DM_MODE_REVIEW.md` (the
  merge-and-archive job, after this one lands).
- Prelude, NPC mail, campaign generation, or any other system.
- The local-model port (the next job) — this job only deletes.
- Any behavior change to the main game. If removing a reference
  would change main-game behavior, STOP and report it.
- Hard-deleting history. Deletion here means `git rm` of live
  code — recoverable through git, per Decision 1.
- Fix-as-you-find-it applies ONLY to sibling defects in files
  this job already touches — fix them in this job and report
  them; anything else goes in the report as a finding, not a
  fix.

## Verification (builder runs all of it)

- Pull latest on `phase-4-hybrid-combat` before starting.
- Full `npm test` on the PC, green. Report the file + assertion
  counts.
- Static-check every import this job touches against the target
  module's actual exports (`node --check` proves syntax only —
  link errors surface at module load). No dangling import of a
  deleted module may remain.
- Grep proof: no `dmMode`, `DMMode`, `dm-mode`, `dmCoaching`,
  `DMCoaching`, `showDMMode`, or `DM Mode` in `server/` +
  `client/src/` + `tests/` — except
  justified remainders, each one listed with its justification
  (migrations are excluded from this grep: they are history and
  stay untouched — state that in the report). The report shows
  the greps AND the remainder list.
- `:5173` checks (exact steps in the report): the home screen
  shows no DM Mode card; no DM Mode route or view is reachable;
  start a session and confirm a full turn runs; end a session
  and confirm a chronicle is written; open the character sheet
  and the creator and confirm the shared spell data still
  loads. The main game is unaffected, shown, not assumed.

## Report

Opens with an Understanding section (in the builder's own words:
what the project is, what this job asks for). Then: the item-0
inventory + classifications + every discrepancy from this brief's
starting list; every file deleted (path, pre-deletion SHA-256,
line count) and every file edited (path, SHA-256 after); the
greps + remainders justified; the DM-Mode-only tables left in
the schema; the other live doc mentions found (item 4); test
counts; `:5173` steps + results; findings. A claim without its
evidence is reported as unverified, not done. Report at
`docs/pm/reports/dm-mode-removal-REPORT.md`. Brief placed at
`docs/pm/dm-mode-removal/BRIEF.md`.
