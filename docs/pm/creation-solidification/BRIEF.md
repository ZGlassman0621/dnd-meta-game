# Brief — creation-solidification: make creation choices stick

## Goal (in play)
When a player finishes creating a character, everything they answered actually
matters in play. Their theme choices (a Soldier's rank, a Guild Artisan's
trade, a Folk Hero's home region) show up on the sheet and in what the DM
knows about them. Their ancestry-feat pick is saved, not silently lost.
A human who is promised one extra language has to pick it before Review
lets them through. A wizard who takes starting gold instead of a gear
package still owns a physical spellbook. And the subclass rules the server
already knows are actually enforced when the character is committed —
not just displayed. A Fighter's Fighting Style pick actually works —
in combat, on the sheet, and in what the DM knows about them.

## Background
- The 6-stage creator is built and gated green; creator rounds 1 + 2 are
  on the Mac, joint-run green (246 suites, 32,768 passed, E2E 51/51).
  Zach's full `npm test` covering rounds 1 + 2 together — the gate for
  that work — came back all green 2026-11-10 ("All green"), so the gate
  precondition for this job is met.
- Theme choices are stored but never read downstream. `progressionService`
  SELECTs `path_data` but never reads it; nothing prints it on the sheet
  or in the DM prompt (creator-test-notes-2 notes.md, "Still open").
  Storage: single-choice theme fields ride `character_themes.path_choice`;
  the Soldier second field rides existing `character_themes.path_data`
  JSON (migration 023, no migration needed). `persistThemeSelection`
  writes `path_data` with preserve-on-same-theme / clear-on-change
  semantics. 8 of 21 themes now carry a creation choice.
- Draft #1203: its ancestry-feat pick was never persisted — no side-table
  row, no store holds it (creator-test-notes-1 notes.md, #5). The server
  fix landed in round 1 (`getCharacterProgression` selects
  `caf.feat_id`; client resume prefers `tier1.feat_id`). The draft itself
  still needs a re-pick; no pick may be invented for it.
- R2-15: the language picker exists on Stage 1 (18-language `LANGUAGES`
  list minus already-known; storage already existed, no migration).
  But Review does NOT force the human extra-language pick — there is no
  count rule (creator-test-notes-2 notes.md, "Still open"). Zach decided
  2026-11-10 this is built: the pick is forced at Review.
- Spellbook as a physical item: the replacement route adds a Spellbook
  inventory row when the character has none left
  (`server-character.js`, replacement handler). Whether a wizard created
  on the gold fork (gold instead of a gear package) receives that row at
  creation is unverified — check the live creation path first.
- `validateSelection` (`server/services/subclassService.js`) enforces
  subclass selection level and origin-explanation requirements, but has
  **no live callers** in server or client (creator-gaps-batch recon:
  "only comments + export"); the creator gate uses the class record
  instead. Wiring it into the commit path needs a client
  subclass-origin-explanation field first — the client collects none
  anywhere today (creator-test-notes-1 notes.md, #5 follow-up).
- Full-codebase audit (Claude Code, read-only, 2026-11-12, commit
  6084b18) confirmed item 5's premise against live code:
  `validateSelection` has no callers, and the client collects no
  *subclass* origin explanation (Stage 1 collects the *character's*
  origin explanation — a different field). The audit's finding S3 is
  the same "creation choice doesn't stick" shape and joins this job
  as item 6: the creator saves the Fighting Style pick to the
  `fighting_style` column only, while the engine reads styles from
  the `feats` list — nothing reads the column, so the pick does
  nothing in combat, on the sheet, or in the DM prompt.

## What to build
1. **Theme choices read downstream.** Print each stored theme choice
   where the player and the DM can see it: the character sheet and the
   DM prompt (theme/origin line). Soldier rank + active duty, guild
   trade, home/seclusion region, City Watch / Urchin city. Read from
   `path_choice` / `path_data` as stored; do not re-ask the player.
   Also fix the known edge if it falls out of this work: changing origin
   after a region pick leaves a stale `themePathChoice` (select shows
   blank; Review/server validation refuses it; no auto-clear built).
   If the auto-clear is bigger than this job, report it as still open
   with the evidence — do not silently widen scope.
2. **Draft #1203 ancestry-feat re-pick.** Verify the resume/re-pick
   path for a draft whose pick was never persisted: the draft must be
   able to re-pick and the pick must persist (side-table row present
   after save). Do NOT invent or restore a pick for #1203 — the player
   re-picks. Report whether #1203 itself can now re-pick, or what
   still blocks it.
3. **R2-15: force the human extra-language pick at Review.** Human
   (+ half-elf, same promise) must pick the promised extra language
   before Review passes — a count rule, following the existing §6
   Review-required pattern used for Soldier rank + active duty.
4. **Gold-fork physical Spellbook row.** Verify against the live build:
   does a wizard created on the gold fork get a physical Spellbook
   inventory row, as the package path provides? If missing, add it at
   creation (same shape as the replacement route's row:
   `{ name: 'Spellbook', quantity: 1, ... }`). If already present,
   report that with the evidence and build nothing.
5. **Wire `validateSelection` into the commit path.** The server must
   enforce subclass selection level + origin-explanation requirements
   at character commit, not only display them. This includes collecting
   a subclass origin explanation in the client where the rules require
   one (no such field exists today). Follow the existing server
   validation pattern; a refusal must name the reason and the legal
   alternative, not fail bare.
6. **Fighting Style picked in the creator must work (audit finding
   S3).** At commit, write the style into `feats` (or have the engine
   read the `fighting_style` column — builder's call, one mechanism,
   not both); show the style on the character sheet and in the DM
   prompt. Verify at :5173: a level-1 Fighter with Defense in chain
   mail shows base AC +1. The level-up half (Paladin 2 / Ranger 2
   never offered a style) is class-audit ground — report it as still
   open, do not build the level-up picker here.

## Out of scope
- Wizard +2 spells picker on in-class level-up (next job after this one).
- Class-by-class level-up / prepared / spellbook audit (next job after that).
- Reactions running post-cast hooks (separate job).
- Return-loop test suite (separate job).
- Knowledge-ignorance design (design job, not a build).
- #12 origin-suffix reversal — DECIDED 2026-11-11 (suffix renders in addition to description; PM-decided per Zach's delegation, veto not exercised).
- Goliath, ancestry feats for the 18 deferred species, Metamagic,
  Cosmic Omen (book text received 2026-11-10 — photo; unblocks the
  mechanics-hooks follow-up, separate job).
- Any change to the 11-species MVP scope or the grayed-out classes.

## Acceptance criteria
- A character created with a Soldier theme shows rank + active duty on
  the sheet and in the DM prompt; same for guild trade, home region,
  seclusion region, and city where the theme carries one.
- Draft #1203 (or an equivalent draft with a missing ancestry-feat row)
  can re-pick its ancestry feat and the pick persists across resume.
- A human character cannot pass Review without picking the promised
  extra language; the refusal names the missing pick.
- A wizard created on the gold fork has a physical Spellbook row in
  inventory at creation; a wizard on a package fork is unchanged.
- Committing a character with a subclass below its selection level, or
  a non-FR subclass without an origin explanation, is refused server-side
  with a named reason; legal selections pass unchanged.
- A Fighter created with Defense shows +1 AC on the sheet while
  wearing armor, and the chosen style is listed on the sheet and in
  the DM prompt; Archery's +2 applies to ranged attacks. The
  Paladin 2 / Ranger 2 level-up offering is reported as still open
  (class-audit ground), not built here.
- Full `npm test` green on the builder's run; new/updated suites cover
  each item above.

## Verification
- Run the full `npm test` yourself (`cd ~/Documents/DnD\ Meta\ Game && npm test`)
  and iterate until green. Zach's full run is the gate — never claim it.
- Note the known runner flag: spellbook-routes takes ~158s against the
  runner's 120s per-file cap — a timeout artifact, not a failure, if it trips.

## Decisions already made
- Creation solidification runs after the full-codebase audit (Zach ran
  the audit first, 2026-11-12; report:
  `docs/pm/full-codebase-audit/REPORT.md`). It is the next build job
  after the round-2 gate (Zach, 2026-11-10, walkthrough Part 3).
- S3 Fighting Style folded into this job as item 6 (PM decision
  2026-11-12, vetoable at the gate): same goal and same files as items
  1–5. The level-up half stays with the class-audit work.
- R2-15 language pick forced at Review (Zach, 2026-11-10).
- Soldier rank + active duty BOTH required at Review (Zach, round 2;
  behavior change; DECIDED 2026-11-11 to keep both required — PM-decided
  per Zach's delegation).
- Fix-as-you-find-it (Zach, 2026-11-06): same defect in a sibling gets
  fixed in this job and reported.
- Do not guess (Zach, 2026-11-07): if information is needed, ask before
  building. Never invent data — a gap is stated as a gap.
- Multiclass prerequisites removed (Zach, 2026-11-08); nothing here
  reintroduces one.
- The 2024 book wins on conflict. Theme choices are player answers —
  print them as stored, never rewrite them.

## Report
- §3 format from `claude-code-handoff.md`, plus per-item verdicts for
  the six items above (built / already-present / still-open with evidence).
- Any question for Zach in full plain terms, one per item, with what was
  checked and what is still unclear.
- How to verify: gate command + what to look for at :5173 (never :3000).

## Setup — CONFIRMED 2026-11-10 (Zach)
- Claude Code is installed on Zach's PC. Zach couriers this brief to
  Claude Code and carries the report back to Muse.
- This job's gate precondition is met: Zach's round-1+2 full `npm test`
  came back all green 2026-11-10. Handover: Zach reviews this draft,
  then couriers it to Claude Code on the PC.
- Repo sync CONFIRMED 2026-11-10: the project lives on GitHub; Zach
  keeps the Mac and PC copies in sync. Claude Code builds on the PC
  copy and pushes to GitHub; Zach pulls to the Mac for the gate test.
- Place this brief at `docs/pm/creation-solidification/BRIEF.md` in the
  repo when handing it over.
