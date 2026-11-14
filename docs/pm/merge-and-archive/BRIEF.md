# Brief — merge-and-archive: finish the 19 deferred docs (fortress, prologue, downtime, synergies, Mythic)

## Status — AUTHORIZED 2026-11-14

**Drafted:** 2026-11-13, by Muse (PM). **Revised + authorized:**
2026-11-14.
On 2026-11-13 Zach asked Muse to adjudicate the 19 documents the
docs-cleanup job opted not to archive. Muse proposed dispositions
(archive 7, merge 5 files into 4 new shelf docs, keep 7). On
2026-11-14 Zach approved tackling the cleanup with one caveat: DM
Mode comes out of the code entirely. The dispositions are APPROVED
as proposed, WITH the caveat applied: `DM_MODE.md` ARCHIVES
instead of keeping (its system is removed by the separate removal
job, which runs before this one), and `DM_MODE_REVIEW.md` archives
alongside it as the same removed system's review. Final counts:
archive 8 + 1 review file, merge 5 files into 4 shelf docs, keep
6. If any verdict changes, revise this brief to match before
handover — do not courier dispositions Zach has not agreed to.

## Goal (in play)
Nothing the player sees changes. What changes is what the next
builder reads: 19 deferred-system documents sit in the live repo
as separate, overlapping, partly stale files — a fortress spec, a
prologue plan, a downtime design, two synergy designs, two Mythic
docs, and their reviews — plus 8 files whose only live content is
a residue worth extracting. When this job is done, each deferred
system has ONE shelf doc that holds its full design plus its
review's open issues, the 8 archivable files are preserved
byte-identical in `archive/`, the 6 kept files are untouched except
for the named folds, and every live residue is named in the report
so the PM can file it in the post-MVP plan — nothing live is lost
with a move.

## Background
- A read-only audit of every `.md` file in the repo ran 2026-11-11
  (62 files in scope). Verdicts: 11 KEEP, 16 KEEP-DEFERRED
  (post-MVP systems, keep for later), 35 STALE. The docs-cleanup
  job (brief `docs-cleanup-BRIEF-DRAFT.md`, 2026-11-11) archived
  27 stale files byte-identical (2 held back with cause),
  refreshed 5 live docs, and made small edits to 4 KEEP files — and OPTED NOT to touch these 19, which are the
  deferred-system docs. Its report (commit 6556e5c, builder green
  247/247) is the record of what it did. This job is the follow-up
  Zach asked for on 2026-11-13: finish those 19.
- There is no separate previous build. It is one continuous repo
  on one branch — the April–June docs are this project's early
  design history, not another program's documents. The test per
  doc is live, deferred, or dead — not "previous program vs
  current program."
- The 19 documents, with Muse's PROPOSED dispositions (pending
  Zach's verdicts):
  - **Archive — 8:** `Phase_3_Closeout.md`,
    `PROJECT_BRIEF.md`, `OPEN_QUESTIONS.md`, `KNOWN_BUGS.md`,
    `FUTURE_FEATURES.md`, `CUSTOM_CLASSES.md`,
    `ANCESTRY_FEATS_REDESIGN_DEFERRED.md`, `DM_MODE.md` (system
    removed — see the caveat above). `DM_MODE_REVIEW.md` (at
    `Claude PM Review Docs/DM_MODE_REVIEW.md`) archives alongside
    `DM_MODE.md`.
  - **Merge into 4 new shelf docs — 5 files:**
    `PHASE_3_7_SPEC.md` → fortress doc;
    `PRELUDE_IMPLEMENTATION_PLAN.md` → prologue doc;
    `DOWNTIME_DESIGN.md` → downtime doc;
    `PARTY_SYNERGIES.md` + `SUBCLASS_THEME_SYNERGIES.md` →
    one synergies doc.
  - **Keep — 6:** `THEME_DESIGNS.md`;
    `MYTHIC_PROGRESSION_GUIDE.md` +
    `MYTHIC_THEME_AMPLIFICATIONS.md` (as a pair);
    `COMPANIONS.md`; `CLAUDE.md`; `AI_NARRATIVE_PERSISTENCE.md`.
- Sequencing note: docs-cleanup refreshed `PROJECT_BRIEF.md`
  (principles section) and edited `CUSTOM_CLASSES.md`
  (multiclass-requirements line). This job archives both files
  AFTER docs-cleanup lands — the refreshed text is what gets
  archived, byte-identical. That refresh is not wasted: it was
  the live-true state at the time, and archiving preserves it.
  Docs-cleanup also edited `DM_MODE.md` (model-split notes,
  spell count 297); this job archives that post-cleanup text —
  the removal job does not edit `DM_MODE.md`. Docs-cleanup also
  edited `COMPANIONS.md` and `THEME_DESIGNS.md`; this job must
  NOT redo those edits.

## What to build
0. **Audit the adjudication first — before moving or merging
   anything.** Independently verify each proposed disposition
   against the live files: for each ARCHIVE file, its stated
   reason (spent history, superseded record, module system
   removed in v1.0.180, Keeper built, vision gated on legacy
   infrastructure that does not exist, DM Mode system removed
   per Zach 2026-11-14) checks out against the
   file's actual content; for `DM_MODE.md` specifically, verify
   the removal job has landed (no DM Mode code remains) before
   archiving its doc — if it has not landed, leave `DM_MODE.md`
   and `DM_MODE_REVIEW.md` in place and report it; for each MERGE source, the merge
   target named in item 3 is the right home; for each KEEP file,
   leaving it alone (except item 4's named folds) is still
   right. Report the item-0 verdicts in the report (exceptions
   in full, confirmations summarized). If a disposition does not
   hold, leave that file exactly where it is and report it — no
   file moves or merges on an unconfirmed disposition. Do not
   silently widen scope to files Zach did not adjudicate — the
   one exception is `DM_MODE_REVIEW.md` (at `Claude PM Review
   Docs/`), which archives with
   `DM_MODE.md` under the removal decision; item 0 verifies it
   is cited by nothing live except `DM_MODE.md`. (Same
   pattern as docs-cleanup item 0 and the 2026-11-10 class audit:
   Claude Code audits the PM's work before building on it.)
1. **Verify before moving or merging anything.** Confirm every
   file named in items 2–4 exists at its stated path — locate
   each by filename search in the live repo and record its
   actual path in the report; do NOT assume the paths in this
   brief, which were written from the PM workspace without a
   live repo read. Grep the whole repo (excluding
   `node_modules` and `.git`) for references to each
   moved/merged filename and path — in code, tests, and
   remaining docs. If live code or a live test references a file
   this brief says to move or merge away, leave that file
   exactly where it is and report it with the referencing file
   and line. References inside other archived files do not block
   a move (they move together). References from a KEEP file to
   an archived file: report them, do not rewrite the KEEP file
   beyond item 4's named folds. NEVER touch `docs/`; briefs,
   reports, and the handoff live there.
2. **Archive 8 files (+ 1 review file)** with `git mv` to `archive/` at the repo
   root, preserving each file's relative path (same pattern as
   docs-cleanup). Every move must be byte-identical — SHA-256
   before and after must match, and the report lists both. The
   archive folder already exists from docs-cleanup (with its
   `archive/README.md`); do NOT rewrite that README — if it
   needs a line noting this second batch, propose the line in
   the report and let the PM add it. Archive list (8 + review):
   - `Phase_3_Closeout.md` — history, not a guide. What it
     records lives in code and the state note.
   - `PROJECT_BRIEF.md` — v1-era doc, refreshed by
     docs-cleanup, but the pm-guide is the live brief now and
     carries the same vision. Archive with a pointer to it.
     Archive the POST-docs-cleanup version.
   - `OPEN_QUESTIONS.md` — entirely about the published-module
     system, removed in v1.0.180. Its level-scaling analysis is
     a live residue: quote it in full in the report (see item 5)
     for the PM to file in the post-MVP plan's module-pipeline
     item. Do NOT delete the residue with the file.
   - `KNOWN_BUGS.md` — last touched May 2026. Two active
     entries, both fortress gaps, not bugs. They fold into the
     fortress doc (item 3); live gaps live in the queue and
     audit reports now. Do NOT archive until the fortress merge
     has absorbed those two entries and the report says where
     each landed.
   - `FUTURE_FEATURES.md` — mixed. Live ideas (Nardo's Manual,
     Treat Wounds, dungeon gen, image gen, world map, tavern
     games, PWA) are residues: list each verbatim in the report
     (see item 5) for the PM to file in the post-MVP plan. The
     self-hostability and LLM entries are overtaken by the
     gemma4:12b decision, and the Themes entry calls a built
     system "not ready to implement" — report those as dead,
     with the evidence, do not carry them forward.
   - `CUSTOM_CLASSES.md` — Keeper is built and the class audit
     is the live gap record. Its two live residues (8 missing
     genre-bonus texts, confirmed; Keeper creator gap) are in
     the docs-cleanup report and queued — verify they are still
     named there and report the check; do not re-derive them.
     Archive the POST-docs-cleanup version.
   - `ANCESTRY_FEATS_REDESIGN_DEFERRED.md` — uncommitted vision
     from April 26, gated on legacy infrastructure that does
     not exist; its "pause new races" guidance was superseded
     when the registry grew to 29. Its framing paragraph is a
     residue: quote it in the report (see item 5) for the PM to
     file in the post-MVP plan's legacy item.
   - `DM_MODE.md` — its system was removed from the code by the
     removal job (Zach, 2026-11-14). Archive the POST-docs-cleanup
     version, byte-identical. Do NOT archive until item 0 has
     verified the removal job landed (no DM Mode code remains).
   - `DM_MODE_REVIEW.md` (at `Claude PM Review Docs/DM_MODE_REVIEW.md`)
     — the removed system's review. Archives alongside `DM_MODE.md`
     at its preserved path (`archive/Claude PM Review Docs/DM_MODE_REVIEW.md`),
     byte-identical, after item 0 verifies
     it is cited by nothing live except `DM_MODE.md`.
3. **Merge 5 files into 4 shelf docs.** For each merge: write
   the merged doc FIRST, verify it (item 3's check below), and
   only then archive the sources byte-identical under item 2's
   pattern. A merge is not a rewrite: the merged doc keeps the
   sources' substantive content — design decisions, numbers,
   open issues, and review findings — and says at the top which
   source files it consolidates and when. Model references
   (Opus/Sonnet/Claude-as-production) are updated to gemma4:12b
   at merge time; anything else stale is flagged in the merged
   doc as needing re-verification at build time, not silently
   fixed. Verification per merge: the report carries a
   traceability list — every substantive section of each source
   appears in the merged doc or is listed as dropped with a
   reason. If a source section cannot be placed, stop and report
   it; do not drop it silently.
   - **Fortress — new `FORTRESS_DESIGN.md` (repo root)** from
     `PHASE_3_7_SPEC.md` + `triage/kingdom-management-survey.md`
     + the two `KNOWN_BUGS.md` fortress entries (recapture
     window without a mechanism; holdings-purpose stub). The
     shipped parts (SC-3.7.1/3.7.2, kingdom-management survey
     post-3.7 update) are in code; only the deferred inheritance
     is worth keeping: recapture quest framework,
     holdings-purpose data, fortress intensity dial. The
     post-MVP plan covers it in one paragraph — the merged doc
     is the design record, not a second plan. Sources archived
     after the merge verifies.
   - **Prologue — new `PROLOGUE_DESIGN.md` (repo root)** from
     `PRELUDE_IMPLEMENTATION_PLAN.md` +
     `PRELUDE_REVIEW.md`. Still the only full prologue design
     (v4: 4 sessions across 3 chapters, emergence mechanics,
     handoff contract). The review's sheltering finding — the AI
     shelters the child PC from stakes regardless of tone signal
     — becomes the merged doc's open-issues section, stated as
     the key design input for the prologue build. Update Opus
     references to gemma4:12b at merge. Sources archived after
     the merge verifies.
   - **Downtime — `DOWNTIME_DESIGN.md`, refreshed in place**
     (do NOT create a second downtime file) from
     `DOWNTIME_DESIGN.md` + `DOWNTIME_REVIEW.md`. The v3 design
     stands (30+ activities, vignette narration,
     parallel-limited). Fold the review in as open issues:
     origin-alignment question (v3 session-driven vs original
     time-driven use case), heavy AI-memory dependencies, and
     "downtime activation pairs with starting an actual
     long-running character." Archive `DOWNTIME_REVIEW.md`
     after the merge verifies.
   - **Synergies — new `SYNERGIES_DESIGN.md` (repo root)** from
     `PARTY_SYNERGIES.md` + `SUBCLASS_THEME_SYNERGIES.md` +
     `PARTY_SYNERGIES_REVIEW.md`. Three-tier synergy design
     (Gear/Positioning, Theme, Team Tactics) + ~40
     subclass×theme pairings. Fold the review's AI-integration
     backlog in as the open-issues section, and state plainly:
     the data is seeded in code; the DM-prompt integration is
     what is unbuilt. Sources archived after the merge verifies.
4. **Keep 6 — untouched except the named folds.** Do not move,
   rename, or rewrite these. The only edits allowed are:
   - `THEME_DESIGNS.md` — NO edit in this job. It is the catalog
     the registry was built from (21 themes, 84 tier entries
     verified against code). One open question rides with it:
     theme tiers auto-unlock one ability in code while the
     design says the player picks at tier crossings — that needs
     Zach's ruling eventually. Do NOT decide it here; record it
     in the report as still open, with what was checked.
   - `MYTHIC_PROGRESSION_GUIDE.md` +
     `MYTHIC_THEME_AMPLIFICATIONS.md` — keep as a pair, the only
     complete Mythic write-up. ONE fold: the Tier 5 flags from
     `MYTHIC_REVIEW.md` (Lich "Final Equation" and Trickster
     "Narrative Authority" flagged as broken/unbounded) go into
     the guide as a design-debt section. Do NOT move or edit
     `MYTHIC_REVIEW.md` itself — it is not one of the 19. Note
     in the guide that its campaign framing (Order of Dawn's
     Light, Riv, The Master) predates the Embervale MVP campaign
     and needs re-grounding at revisit.
   - `COMPANIONS.md` — ONE fold: absorb the
     `COMPANIONS_REVIEW.md` wound problem (no `core_wound`
     field; backstory generator has no prompt-engineering
     principles; no wound-surfacing mechanism) as open design
     work. Do NOT move or edit `COMPANIONS_REVIEW.md` itself.
     Do NOT redo docs-cleanup's refresh.
   - `CLAUDE.md` — NO edit in this job. It is the auto-loaded
     builder instructions; docs-cleanup refreshed it. Leave it
     exactly as docs-cleanup left it.
   - `AI_NARRATIVE_PERSISTENCE.md` — NO edit in this job. It is
     the requirements list for the queued knowledge-ignorance
     design job. Keep until that job strikes what is now built
     and folds the rest in, then archive — not in this job.
5. **Residues — report, do not file.** The post-MVP plan
   (`~/workspace/dnd-app-review/post-mvp-plan.md` in the PM
   workspace) is NOT in the repo and NOT yours to edit. For each
   residue below, put the verbatim text (or a precise pointer:
   file + section) in the report under a "Residues for the PM"
   heading, and the PM files it. Residues:
   - `OPEN_QUESTIONS.md`: level-scaling analysis → post-MVP
     plan's module-pipeline item. NOTE: the post-MVP plan's
     Wave 2 item 7 currently cites `OPEN_QUESTIONS.md` as the
     module-pipeline reference — flag in the report that the
     PM must update that pointer after this archive.
   - `FUTURE_FEATURES.md`: live ideas (Nardo's Manual, Treat
     Wounds, dungeon gen, image gen, world map, tavern games,
     PWA) → post-MVP plan; self-hostability Milestone A
     (provider abstraction) is still open work — flag that the
     post-MVP plan's "Throughout" section already carries it
     and the PM must check for duplication, not double-file it.
   - `ANCESTRY_FEATS_REDESIGN_DEFERRED.md`: framing paragraph
     → post-MVP plan's legacy item (ancestry redesign rides
     lineage infrastructure).
   - `KNOWN_BUGS.md`: fortress entries → fortress doc (item 3),
     not the report; report only where each landed.
   - `CUSTOM_CLASSES.md`: Keeper residues — verify against the
     docs-cleanup report only (item 2), do not re-file.

## Out of scope
- The docs-cleanup job itself: this job starts only after
  docs-cleanup AND the DM Mode removal job are built, pushed, and
  their reports are back. Do not
  re-archive, re-refresh, or re-edit anything docs-cleanup
  already handled, except archiving the two post-cleanup files
  named in item 2.
- `docs/` — never touch it (briefs, reports, handoff).
- ANY code, test, data, or config change: no `.js`/`.jsx`/`.json`
  /`.sql` edits, no migrations, no test edits. Docs only. If a
  test fails because it referenced a moved doc, restore that doc
  to its original path and report — never edit the test to fit.
- Deciding the theme-tier open question (item 4), the project
  rename, or Session Hi-Fi (settled post-MVP, Path A standing).
  Any change to MVP scope, grayed-out classes/species, or the
  queue order.
- Building any deferred system (fortress, prologue, downtime,
  synergies, Mythic). Merges are docs only; the systems stay
  post-MVP.
- Hard-deleting any file. Archive-not-delete, recoverable
  through git. Hard-deleting the history was NOT authorized.

## Acceptance criteria
- All 8 archive files (+ `DM_MODE_REVIEW.md`) sit under `archive/` at their preserved
  relative paths, byte-identical (SHA-256 before = after), and
  none remains at its old path — except any file held back by a
  live reference, which stays put and is named in the report.
- The 4 shelf docs exist and read true: fortress, prologue,
  downtime (refreshed in place), synergies — each naming its
  sources, each with its review's open issues folded in, no
  Opus/Sonnet-as-production model references left unflagged.
- Merge sources are archived only after their merge verifies
  (traceability list complete, no section dropped silently) —
  except `DOWNTIME_DESIGN.md`, which is refreshed in place and
  stays at its path.
- The 6 KEEP files are untouched except item 4's named folds
  (Mythic Tier 5 flags, Companions wound problem);
  `THEME_DESIGNS.md`, `CLAUDE.md`, and
  `AI_NARRATIVE_PERSISTENCE.md` byte-identical to before.
- Every residue in item 5 is quoted or precisely pointed to in
  the report under "Residues for the PM" — nothing live is lost
  with a move.
- Zero code/test/data/config files changed (report proves it
  with the changed-file list).
- Item 0 complete: every proposed disposition confirmed or
  flagged with evidence; no file moved or merged on an
  unconfirmed disposition.
- Full `npm test` green on the builder's run.

## Verification
- Run the full `npm test` yourself and iterate until green.
  Zach's full run is the gate — never claim it.
- Note the known runner flag: spellbook-routes takes ~158s
  against the runner's 120s per-file cap — a timeout artifact,
  not a failure, if it trips.
- Grep evidence: the report names the reference check run for
  the moved/merged files and its result (clean, or each live
  reference found).
- Read-back: each merged doc and each folded KEEP file was read
  in full after editing; the report confirms it per file.

## Decisions already made
- Adjudication requested (Zach, 2026-11-13): the 19 documents
  Muse opted not to archive in docs-cleanup — combine what can
  combine, archive the rest. Dispositions PROPOSED by Muse the
  same day; APPROVED by Zach 2026-11-14 with one caveat: DM Mode
  comes out of the code entirely (separate removal job, runs
  before this one), so `DM_MODE.md` archives instead of keeping
  and its review archives with it.
- DM Mode REMOVED from the code (Zach, 2026-11-14): "It serves no
  purpose and I don't need it." Separate removal job, delete
  outright, recoverable through git. The post-MVP plan's DM Mode
  tutorial item is struck (PM handles the plan — it is not in
  the repo).
- Archive-not-delete execution (PM, under Zach's backup rule,
  2026-11-11, carried from docs-cleanup): files move to
  `archive/`, byte-identical, recoverable through git; reversal
  cost one `git mv` back per file. Vetoable at the gate.
- Product (settled): solo D&D forever game — one human player
  character; DM, NPCs, companions, enemies all AI; persistent
  world on canonical Forgotten Realms history, playable
  essentially forever.
- DM model DECIDED (Zach, 2026-11-10): gemma4:12b, offline via
  Ollama on his PC. Secret-holding leak test is its acceptance
  check. Single-model assumption dropped; per-role models open.
- Current counts (verify against live code before writing):
  583 spells, 181 subclasses, 29 species (11 MVP PC species),
  23 classes, 210 ancestry feats in 14 lists, migrations
  through 114, 41 weapons (38 book + 3 setting).
- MVP scope LOCKED (Zach, 2026-11-11): prologue, full downtime,
  fortress/domain, Mythic, legacy all post-MVP. MVP = a
  self-contained one-shot test campaign (Embervale), core
  gameplay only. MVP done = create, play, leave, return, loot,
  XP, level, quests, companions, roleplay, combat, story, memory
  retained — full suite green.
- Session Hi-Fi DECIDED post-MVP (PM, under delegation,
  2026-11-11): three-column in-session cockpit, Path A (phased)
  standing when built, Path B vetoed.
- Nothing mechanical is narrative-only (Zach, 2026-11-08,
  system-wide rule). Multiclass prerequisites removed (Zach,
  2026-11-08). The 2024 book wins on conflict.
- Do not guess (Zach, 2026-11-07): a gap is stated as a gap.
  Never invent data, counts, endpoints, or prices.
- Fix-as-you-find-it (Zach, 2026-11-06), bounded to docs in this
  job: a stale line found in a file this job already touches gets
  fixed and reported. Do not expand into code fixes or untouched
  files.
- Repo: GitHub `https://github.com/ZGlassman0621/dnd-meta-game.git`,
  live branch `phase-4-hybrid-combat` (main stale since June
  2026 — never use it). Game runs natively on the PC
  (`npm run dev`, :3000/:5173). Browser checks at :5173, never
  :3000.

## Report
- §3 format from `claude-code-handoff.md`, starting with
  "Understanding first". Plus, job-specific:
  - Item-0 adjudication verdicts: exceptions in full with
    evidence, confirmations summarized; any file held back, named.
  - Per-file manifest: every archived file (old path → new path,
    SHA-256 before + after), every merged doc (sources, what was
    kept verbatim vs summarized, traceability list), the 2 KEEP
    folds (SHA-256 after, what changed).
  - "Residues for the PM" section: every item-5 residue quoted
    or precisely pointed to, plus the two post-MVP-plan pointer
    flags (module-pipeline citation, Milestone A duplication
    check).
  - Reference-check evidence: what was grepped, what was found.
  - Any question for Zach in full plain terms, one per item,
    with what was checked and what is still unclear.
  - Cost + usage-remaining estimate against the $30/month cap,
    if measurable.
  - How to verify: gate command only — docs-only job, no visible
    change at :5173. State that plainly; do not invent :5173 steps.

## Setup — CONFIRMED 2026-11-10 (Zach)
- Claude Code is installed on Zach's PC. Zach couriers this brief
  to Claude Code and carries the report back to Muse.
- This job starts after docs-cleanup AND the DM Mode removal job
  are built + pushed (one job at a time; removal lands first so
  `DM_MODE.md`'s archive reason holds). Zach hands this brief +
  the .md audit over when the removal job's report is back. The .md audit
  (`md-files-audit-2026-11-11.md`) travels with this brief as the
  source record for the 19 files.
- The PC is the only working copy (Zach, 2026-11-13): the
  project lives on GitHub; Claude Code builds on the PC copy
  and pushes. Gate = Zach's `npm test` on the PC. The Mac copy
  is not a working copy and is not used.
- Place this brief at `docs/pm/merge-and-archive/BRIEF.md` in the
  repo when handing it over.
