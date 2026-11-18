# Brief — registry origin-rule cleanup

## Goal (in play)
A player picks any subclass — Warlord, or any subclass from a setting
outside the Forgotten Realms — and is never asked why their character
has it, never blocked at Review, and never refused at commit for not
explaining it. Nothing in the game, its tests, or its own rules text
says otherwise anymore. The dead rule is gone everywhere, not just
in the creator screen.

## Background
- Zach's ruling, 2026-11-12 (main chat, during job 1): "a class is a
  class" — NO subclass from any setting needs an origin explanation.
  This REVERSES the creator plan §12 rule, which required an
  explanation whenever a subclass came from outside the Forgotten
  Realms. It arose because job 1's wiring made every Warlord (subclass
  at level 1, all 8 Presences marked KibblesTasty / setting-neutral =
  outside-FR) write one.
- What job 1 already removed (follow-up commit 8d586ac, built
  2026-11-12, gated green on Zach's full run 2026-11-17): the requirement itself, the Stage 2
  explanation box, the Review check, the server refusal, and the
  DM-prompt line. The creator no longer asks, and nothing enforces it.
- What is still left, per the 2026-11-12 record (PM decision
  2026-11-12, queued after docs-cleanup): `subclassService.
  validateSelection` still treats an outside-FR subclass with no
  explanation as "incomplete" — the creator now ignores that half and
  nothing enforces it — and about 9 subclass test files plus comments
  in fighter.js / spellshot.js / warden.js still describe the dead
  rule. Claude Code left this residue for a brief rather than widening
  job 1. This job is the mechanical sweep that finishes it.
- Unchanged by the ruling, and unchanged by this job: the character's
  own Stage 1 origin explanation (how *they* came to the Realms) is
  still collected and still required for outside-FR origins, and the
  origin label still shows on the subclass note.
- The column `characters.subclass_origin_explanation` (migration 114)
  stays, unused, with its save / resume / commit plumbing intact.
  The calling-question job (drafted, queued after this one) reuses
  that column and plumbing — this cleanup goes first precisely so
  the column's fate is settled before that job touches it. Do not
  drop the column, rename it, or wire anything new into it here.

## What to build
1. **Survey the live repo first, then sweep.** On the PC, branch
   `phase-4-hybrid-combat`, search the whole repo for the dead rule
   before changing anything: `subclass_origin_explanation`,
   `origin_explanation` in subclass context, `validateSelection`,
   "outside-FR" / "outside FR" / "setting-neutral" near subclass,
   and any test or comment asserting a subclass needs an explanation.
   Starting points from the 2026-11-12 record (verify each against
   live bytes — workspace mirrors are staging copies, not the repo):
   `server/services/subclassService.js` (`validateSelection`),
   ~9 subclass test files, and comments in fighter.js, spellshot.js
   and warden.js. Report the full list found in the report, with
   file and line, before listing what was changed.
2. **Remove the dead half of `validateSelection`.** An outside-FR
   subclass with no explanation must no longer count as
   "incomplete". Keep whatever else `validateSelection` enforces —
   subclass selection level, and anything else live — untouched.
   If the origin half is the function's only remaining purpose, say
   so in the report with the caller evidence and remove the function
   (and its callers' dead branches) rather than leaving a hollow
   shell; if it still has live purpose, remove only the origin half.
   Do not change the commit path's behaviour for anything else.
3. **Fix the tests to assert the ruling, not just delete them.**
   Every test that described the dead rule becomes a test of the
   ruling: an outside-FR subclass (Warlord is the concrete case —
   subclass at level 1, all 8 Presences outside-FR) commits with no
   explanation, passes Review, and is never refused server-side.
   Where a test file's only purpose was the dead rule, remove the
   file and say so; where it also covers live behaviour, keep the
   live half.
4. **Fix the comments and rules text in the repo.** Comments in
   fighter.js, spellshot.js, warden.js and anywhere else the survey
   finds, plus any repo doc / registry text that still states the
   dead rule, must be corrected to the ruling — not just deleted
   where the sentence carries meaning. One line stating the ruling
   ("a class is a class" — no subclass needs an origin explanation,
   Zach 2026-11-12) where the rule used to be stated is enough.
   The workspace design doc (creator plan §12) is PM-owned; flag it
   in the report if repo text points at it, but do not edit
   workspace docs — Muse corrects those.
5. **Prove nothing else broke.** Full `npm test` green on the
   builder's run. At :5173 (never :3000): create a Warlord with no
   subclass explanation, commit, and confirm no prompt, no Review
   block, no refusal; create a second character with an outside-FR
   origin and confirm the *character's* Stage 1 origin explanation
   is still required and still prints.

## Out of scope
- The calling question (separate drafted brief, queued after this
  job) — no Stage 5 field, no printing of the column, no change to
  what the column stores.
- Any change to subclass mechanics, subclass selection levels, or
  which subclasses exist.
- S1, S2, H2+H3, H1, creator round 3, or any other queued job.
- Any change to the 11-species MVP scope or the grayed-out classes.
- Any change to the character's Stage 1 origin explanation, the
  origin label on the subclass note, or the origin-setting / region
  pickers.

## Acceptance criteria
- `validateSelection` no longer returns "incomplete" (or any
  failure) for an outside-FR subclass with no explanation; subclass
  selection-level enforcement still works.
- A Warlord (and any other outside-FR subclass) commits with no
  subclass explanation: no box, no Review block, no server refusal.
- The character's Stage 1 origin explanation is still required for
  outside-FR origins and still prints; the subclass origin label
  still shows.
- Migration 114's column and its save / resume / commit plumbing are
  intact and still unused (nothing fills it, nothing prints it).
- A repo-wide search for the dead-rule phrases (listed in the
  report) returns zero hits in code, tests, comments and repo docs.
- Full `npm test` green on the builder's run; new/updated suites
  cover each item above.

## Verification
- Run the full `npm test` yourself from the repo root on the PC
  and iterate until green. Zach's full run is the gate — never
  claim it.
- At :5173 (never :3000): Warlord with no explanation commits
  cleanly; outside-FR origin still asks for the character's
  explanation on Stage 1.
- Note the known runner flag: spellbook-routes takes ~158s against
  the runner's 120s per-file cap — a timeout artifact, not a
  failure, if it trips.

## Decisions already made
- "A class is a class" — no subclass from any setting needs an
  origin explanation (Zach, 2026-11-12). Settled; this job removes
  residue, it does not re-decide anything.
- Character's Stage 1 origin explanation unchanged; origin label
  still shows on the subclass note (Zach, 2026-11-12).
- Migration 114 column kept, unused, plumbing intact (job 1
  follow-up; PM decision, vetoable at the gate — the calling
  question reuses it next).
- Queue placement (PM decision 2026-11-12): after docs-cleanup,
  before S1; before the calling-question job, which touches the
  same column. A request for a plan is not approval — this brief
  is drafted, not couriered, until Zach says the word.
- Fix-as-you-find-it (Zach, 2026-11-06): same defect in a sibling
  gets fixed in this job and reported.
- Do not guess (Zach, 2026-11-07): if information is needed, ask
  before building. Never invent data — a gap is stated as a gap.
- The 2024 book wins on conflict.

## Report
- §3 format from `claude-code-handoff.md`, plus per-item verdicts
  for the five items above (built / already-present / still-open
  with evidence), the full survey list (file + line for every
  dead-rule reference found), and the dead-rule search terms used
  for the zero-hits check.
- Any question for Zach in full plain terms, one per item, with
  what was checked and what is still unclear.
- How to verify: gate command + what to look for at :5173 (never
  :3000).

## Setup — CONFIRMED 2026-11-10 (Zach)
- Claude Code is installed on Zach's PC. Zach couriers this brief
  to Claude Code and carries the report back to Muse.
- Staging is PC-only (Zach, 2026-11-12). Gate = Zach's `npm test` +
  :5173 checks on the PC.
- Place this brief at `docs/pm/registry-origin-rule-cleanup/BRIEF.md`
  in the repo when handing it over. Reports live in
  `docs/pm/reports/`.
