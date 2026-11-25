# Brief — M1: wire the story starters into Stage 5

## Goal (in play)
The story prompts the game already holds stop being orphaned text
and start doing work. When the player reaches Stage 5 (Gear &
Story), the story fields offer real choice lists drawn from those
starters — shaped by who the character is (species, size, theme) —
instead of nine blank boxes. The player still writes their own story
where they want to: free text survives alongside the picks. Nothing
is invented — every choice comes from text the repo or a book
already holds.

## Background
- Settled decision (PM decision 2026-11-12, recorded in pm-guide):
  wire the story starters in, do NOT delete them. Expanded
  2026-11-14: the starters become the choice lists for story
  answers, driven by species / size / theme. Sourcing rule:
  existing repo / book text only, never invented.
- The orphaned material: ~1,500 lines of story starters, orphaned
  (class-background-tables-coverage-map-2026-11-17.md, "Adjacent, not
  coverage" — story prompts, not personality/class tables). The
  coverage map does not name the file they live in — the survey in
  item 1 locates them against live bytes and reports the file, line
  range, and shape before anything is wired. Do not trust a
  remembered path.
- What Stage 5 is today (current-build-state.md, verified from live
  bytes at the time of writing): `Stage5GearStory.jsx` — package
  picker, gold-fork toggle, "any <category>" pickers, tooltips on
  every choice, dedup rule, read-only derived HP/AC/speed, and 19
  story fields wired. Creator round 3 (item 8, amended brief
  2026-11-22) rewrites the story-field helpers in professional,
  player-facing wording — Personality traits plus its 3 prompt
  questions, Ideals, Bonds, Flaws, Organizations, Allies, Enemies,
  Backstory, Other notes — and removes one sentence from the
  appearance helpers. Do not reword any helper in this job; build on
  round 3's copy.
- Placement: after creator round 3 and the MVP-only UI build
  (pm-guide queue line; mvp-only-ui-AUDIT-DRAFT.md: "M1 stays after
  the strip… M1 building on a post-strip Stage 5 is cleaner").
  This job assumes round 3's Stage 5 copy is in place; if the
  survey finds it is not, report that and stop — do not build on
  the old copy.
- Settled decisions that shape this job (do not re-decide):
  - Homebrew / house rules stay separate from 2024 rules, source-
    tagged (Zach, 2026-11-12). Story-starter text that is authored
    rather than book text carries its source tag; nothing is
    presented as book text unless it is.
  - The 2024 book wins on conflict; never invent data — a gap is
    stated as a gap.
  - Held options are grayed out and disabled, never hidden
    (proficiency dedup rule, Zach 2026-11-05) — the same
    presentation applies to a story choice the character already
    holds, where a choice list overlaps a pick made earlier.
  - Free text only through "Other" (the origin-settings rule,
    Zach 2026-11-05) is the pattern this job follows for
    free-text survival — see Decisions below.

## What to build
1. **Survey the live repo first, then build.** On the PC, branch
   `phase-4-hybrid-combat`, locate the ~1,500 lines of orphaned
   story starters (file, line range, structure: how they are grouped,
   what each entry holds, which fields they map to). Inventory them
   against Stage 5's 19 story fields: which fields have starter
   sets, which have none, and what drives each set today (if
   anything). Also survey how Stage 5 currently saves the story
   fields (columns, validation, Review display). Report the full
   inventory before changing anything. Workspace mirrors are staging
   copies, not the repo.
2. **Wire the choice lists, driven by species / size / theme.**
   For each story field that has a starter set, Stage 5 offers that
   set as a choice list, filtered by the character's species, size,
   and theme where the starters carry that driver — a starter that
   names no driver shows for everyone; a starter that names a driver
   shows only where it applies. The driver mapping is reported
   field by field, with the source text cited per set. A field with
   no starter set keeps its current free-text box unchanged — no
   list is invented for it.
3. **Free text survives.** Every field that gains a choice list
   keeps a free-text "Other / write your own" entry alongside the
   picks, in the same pattern as the origin-settings "Other" rule.
   A player who picks from the list, writes their own, or leaves the
   field blank all reach Review cleanly; validation stays
   draft-tolerant (hard gate is Review at Stage 6), matching Stages
   2–4. The report states the field-by-field mapping — which fields
   got lists, which stayed free-text-only — so Zach can veto any
   single field at the gate.
4. **Save, rehydrate, and show it.** Picks and free text save
   through the existing Stage 5 save path (no new columns unless the
   survey proves the current ones cannot hold a pick — then report
   the schema need and stop, do not migrate here), rehydrate on
   resume/edit, and display verbatim on the Review screen. A pick
   made in an earlier session still shows after a resume.
5. **Tests.** One suite covering: driver filtering (a species- or
   theme-gated starter shows only where it applies, an undriven one
   shows for everyone), free-text survival per field, blank-field
   tolerance, save/rehydrate round-trip, and Review display. Full
   `npm test` green on the builder's run.
6. **Prove it at :5173 (never :3000).** Create a character through
   Stage 5 by hand on the PC: pick from a story list, write free
   text in another field, leave a third blank, and confirm Review
   shows all three correctly. Exact steps in the report.

## Out of scope
- Rewording any Stage 5 helper, description, or story-field prompt —
  that is creator round 3.
- Inventing any story-starter text, or adding a choice list to a
  field with no starter set.
- Any new story field, any new column or migration (report the need,
  do not build it — item 4).
- Any change to species, size, or theme data, or to the theme
  package itself.
- The calling question (separate draft brief, needs Zach's
  go-ahead) — do not add a "why your class" question here.
- H2+H3, H1, creator round 3, MVP-only UI, tooltip rewrite,
  severe-seven + H4, reactions, return-loop, L1–L6, or any other
  queued job.

## Acceptance criteria
- Every story-starter line is accounted for in the report: wired
  (field + drivers cited), or still-orphaned with the reason (no
  matching field / no driver data).
- Every field that gained a list offers free text alongside it; no
  field lost free text it had.
- No invented text anywhere; every choice traces to repo or book
  text, cited in the report.
- Picks survive save → resume → Review unchanged.
- Full `npm test` green on the builder's run.

## Verification
- Run the full `npm test` yourself from the repo root on the PC
  and iterate until green. Zach's full run is the gate — never
  claim it.
- :5173 by hand (item 6, never :3000).
- Note the known runner flag: spellbook-routes takes ~158s against
  the runner's 120s per-file cap — a timeout artifact, not a
  failure, if it trips.

## Decisions already made
- Wire, not delete (PM decision 2026-11-12); choice lists driven by
  species / size / theme; repo/book text only, never invented (PM
  expansion 2026-11-14).
- Builds on post-strip Stage 5, after round 3 and the MVP-only UI
  build (pm-guide queue order).
- Free text survives as an "Other / write your own" entry per listed
  field (PM decision, vetoable at the gate — it follows the
  origin-settings "Other" pattern Zach approved 2026-11-05, and the
  field-by-field mapping is in the report for Zach to veto).
- Fix-as-you-find-it (Zach, 2026-11-06): same defect in a sibling
  gets fixed in this job and reported.
- Do not guess (Zach, 2026-11-07): if information is needed, ask
  before building. Never invent data — a gap is stated as a gap.
- The 2024 book wins on conflict.

## Report
- §3 format from `claude-code-handoff.md`, plus per-item verdicts
  for the six items above, the full starter inventory (file + line,
  field, drivers, wired / still-orphaned with reason), and the
  field-by-field mapping table (list vs free-text-only).
- Any question for Zach in full plain terms, one per item, with
  what was checked and what is still unclear.
- How to verify: gate command + what to look for at :5173 (never
  :3000).

## Setup — CONFIRMED 2026-11-10 (Zach)
- Claude Code is installed on Zach's PC. Zach couriers this brief
  to Claude Code and carries the report back to Muse.
- Staging is PC-only (Zach, 2026-11-12). Gate = Zach's `npm test` +
  :5173 checks on the PC.
- Place this brief at `docs/pm/m1-story-starters/BRIEF.md`
  in the repo when handing it over. Reports live in
  `docs/pm/reports/`.
