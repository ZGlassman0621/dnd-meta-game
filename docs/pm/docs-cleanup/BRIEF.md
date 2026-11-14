# Brief — docs-cleanup: stop the repo's docs from lying to builders

## Goal (in play)
Nothing the player sees changes. What changes is what the next builder
reads: today, about ten documents in the repo describe a different game
than the one being built — the wrong AI model, the wrong spell count,
a scrapped character creator, a phase that never happened. A builder
who trusts those docs builds on wrong assumptions. When this job is
done, every document left in the live repo is true, the history is
preserved in one archive folder instead of scattered through the
working tree, and the one file that can be regenerated from a script
is gone instead of stale.

## Background
- A read-only audit of every `.md` file in the repo ran 2026-11-11
  against live Mac bytes (62 files in scope; 431 more under
  `node_modules`, excluded). Verdicts: 11 KEEP, 16 KEEP-DEFERRED
  (post-MVP systems, keep for later), 35 STALE. The full audit
  report travels with this brief — Zach hands it over with the
  brief, and you place a copy at `docs/pm/docs-cleanup/AUDIT.md`
  for the record. This brief also carries the full verdict list
  below, so the job stays self-contained. If the audit, this
  brief, and the live repo disagree on whether a file exists or
  what it says, the live repo wins — stop and report the
  disagreement, do not guess past it.
- The stale docs contradict the build on every count that matters:
  README/CLAUDE.md/LLM_SETUP.md describe Claude Opus/Sonnet + an
  Anthropic API key; the decided DM model is gemma4:12b, offline on
  Zach's PC (2026-11-10). Spell counts read 284–300+; the catalog is
  583. The Phase 4 specs describe an AI-behavior diagnostic phase;
  the Phase 4 that shipped was dungeon + scene layer + combat.
  Six files describe character creators that were scrapped and
  rebuilt from scratch. DECISION_LOG stopped in May 2026 and
  CHANGELOG in October 2026; decisions and ships since then live
  with the PM and in REPORT.md files.
- Zach approved this cleanup 2026-11-11 ("delete everything that's
  stale or have Claude Code do it"). The PM's execution decision,
  under Zach's backup rule, is archive-not-delete for the history:
  29 files move to `archive/`, byte-identical and recoverable
  through git; only one regenerable file is actually deleted.
  Hard-deleting the history was NOT authorized. If Zach redirects
  this at the gate, the archive move reverses with one `git mv` back.
- `CLAUDE.md` is the highest-priority refresh: it auto-loads for
  builders, so a stale copy actively misleads the next job. That is
  why this job runs right after creation-solidification and before
  creator round 3.

## What to build
0. **Audit the audit first — before moving anything.** Independently
   verify the audit's verdicts against the live files: for each
   STALE file, its stated reason (wrong model/counts, scrapped
   creator, spent plan) checks out against the file's actual
   content; for each KEEP / KEEP-DEFERRED file, leaving it alone
   is still right. Report the item-0 verdicts in the report
   (exceptions in full, confirmations summarized). If a verdict
   does not hold, leave that file exactly where it is and report
   it — no file moves on an unconfirmed verdict. Do not silently
   widen scope to files the audit did not list. (Zach, 2026-11-10,
   on the class audit: have Claude Code audit the audit to check
   the PM's work. Same pattern here.)
1. **Verify before moving anything.** Confirm every file named in
   items 2–5 exists at the stated path. Grep the whole repo
   (excluding `node_modules` and `.git`) for references to each
   moved/deleted filename and path — in code, tests, and remaining
   docs. If live code or a live test references a file this brief
   says to move or delete, leave that file exactly where it is and
   report it with the referencing file and line. References inside
   other archived files do not block a move (they move together).
   References from a KEEP file to an archived file: report them,
   do not rewrite the KEEP file beyond item 4's named edits.
   Also verify the audit's structural claims: no `.md` files under
   `server/`, `client/`, or `scripts/`. (`docs/` may now exist —
   job 1 creates `docs/pm/`. NEVER touch `docs/`; briefs, reports,
   and the handoff live there.)
2. **Archive 29 files** with `git mv` to `archive/` at the repo
   root, preserving each file's relative path (e.g.
   `archive/Claude PM Review Docs/CODE_AUDIT_FINDINGS.md`). Every
   move must be byte-identical — SHA-256 before and after must
   match, and the report lists both. Add `archive/README.md` (new
   file): what the archive is, that these files were moved
   2026-11-11 because a repo audit found them stale or spent,
   that they are project history and must NOT be treated as
   current guidance, and that live decisions/queue live with the
   PM. Do not invent pointers to repo files that do not exist.
   Archive list (29):
   - Root (16): `PROJECT_TODO.md`, `CONSOLIDATED_TODO.md`,
     `TEST_RESULTS.md`, `CAMPAIGN_READINESS_AUDIT.md`,
     `CHAR_CREATOR_DESCRIPTIONS_AUDIT.md`, `PHASE_4_OVERVIEW.md`,
     `PHASE_4A_SPEC.md`, `PHASE_4B_SPEC.md`, `PHASE_3_5_SPEC.md`,
     `PHASE_3_REFACTOR_SPEC.md`, `PHASE_2_CREATOR_SPEC.md`,
     `Phase_2_Creator_Spec_Drafted_Content.md`,
     `IMPLEMENTATION_PLAN.md`, `DECISION_LOG.md`, `CHANGELOG.md`,
     `Character Creator Questions.md`
   - `Claude PM Review Docs/` (4): `CODE_AUDIT_FINDINGS.md`,
     `KEEPER_REVIEW.md`, `LLM_SETUP_REVIEW.md`,
     `PHASE_2_SHIP_NOTE.md`
   - `triage/` (4): `PHASE_3_5_DESIGN_BRIEF.md`,
     `pattern-d-survey.md`, `prose-quality-triage.md`,
     `q6-detect-function-survey.md`
   - `Claude UX Design/D&D Meta Game (Remix)/` (3):
     `Session-Design-Bundle/README.md`,
     `Session-Design-Bundle/chat-transcript.md`,
     `Themes-Replace-Backgrounds.md` — NOTE: the audit corrected
     this file's location to the `(Remix)/` root, NOT inside
     `Session-Design-Bundle/`. Verify the actual path before
     moving; if it is elsewhere, move it from where it is and
     report the real path.
   - `tests/output/` (2): `prose-quality-analysis.md`,
     `prose-quality-results.md`
3. **Refresh 5 files** so each is true again. Work file by file;
   read each finished file back before moving on. The current
   facts to write from are in "Decisions already made" and
   "Background" — verify counts and flag/model claims against
   the live code before writing them down; if a claim does not
   check out, leave that line out and report what was checked.
   - `README.md` — rewrite for the current product: solo forever
     game, gemma4:12b offline DM model, 583 spells, MVP scope,
     PC-native run (`npm run dev`, :3000/:5173), GitHub + live
     branch. No Anthropic API key as a requirement; no Mythic
     as a current feature (post-MVP).
   - `CLAUDE.md` — refresh the model, flag, and status sections
     to the handoff + gemma4:12b + current pipeline. KEEP its
     working rules (verify before edit, delete outright, tests
     gate). Verify the flag posture (LIVING_WORLD_TICK,
     PROGRESSION_AWARDS) against live code before writing it;
     do not copy the old file's claims.
   - `LLM_SETUP.md` — rewrite for gemma4:12b via Ollama on the
     PC; per-role models open; cloud pool is a fallback only.
     Verify the module-structure table against live file names
     before keeping any of it. Verify the fallback pool's
     address in live config before writing it down — never
     invent an endpoint.
   - `ANCESTRY_FEATS.md` — status header ONLY (counts: 210 feats,
     14 lists; Path Less Walked status verified against the
     live ancestry data). Do NOT touch the feat catalog text —
     it is the design source for the registry.
   - `PROJECT_BRIEF.md` — principles section ONLY. Replace
     "Narrative beats mechanics" with the settled rule "nothing
     mechanical is narrative-only" and the current principles.
     Vision portions stay untouched. Do not present DM Mode +
     Prelude as built: Prelude is post-MVP; DM Mode exists in
     code but is out of MVP scope — state it exactly that way.
4. **Small edits on 4 KEEP files** (nothing else in them changes):
   - `DM_MODE.md` — model-split sections to gemma4:12b; "Spells
     (300+)" to 583; party generator "background" to theme.
   - `COMPANIONS.md` — Opus references to the current model;
     synergies section must state Party Synergies' AI integration
     is unbuilt; garrison/base-roles section marked post-MVP
     fortress.
   - `CUSTOM_CLASSES.md` — the `MULTICLASS_REQUIREMENTS` line
     contradicts the removal of all multiclass prerequisites
     (Zach, 2026-11-08): verify against live
     `levelProgression.js` first, then fix the DOC line. Do NOT
     change code tables in this job — report any code-side
     residue found. Remove or correct dead old-wizard references.
   - `THEME_DESIGNS.md` — status line only: all 21 themes are
     built (the April 2026 "first batch of 4" line is stale).
5. **Delete exactly 1 file:** `triage/alignment-coverage-matrix.md`
   — ONLY after proving it regenerates: verify
   `tests/coverage-matrix.js` exists, run it, and confirm the
   matrix regenerates. Record the PM ruling it carries
   ("roleplay-believable coverage, not every cell") verbatim in
   the report before deleting. If the generator is missing or
   broken, do NOT delete — archive the matrix with the other
   triage files instead and report why.
6. **Carry-forwards — check before archiving, report every one.**
   Open items buried in the stale docs must not be lost with the
   move. For EACH item below, check it against the live build
   and state in the report where it now lives (built / still open
   + what would resolve it). Do NOT build any of them in this job
   and do NOT edit any file outside items 2–5 to record them —
   the report is the record; the PM files them in the queue.
   - From `CONSOLIDATED_TODO.md` parking lot: Keeper
     genre-bonus texts + Eidetic Memory + Unwritten Knowledge;
     Aasimar Path's Choice persistence; Drow Lolth standing /
     House Heritage; Human Quick Study time-bounded persistence;
     deity worship-contract authoring; heirloom handoff producer;
     unreviewed-systems list (living-world tick, merchant
     economy, bases, NPC lifecycle, notoriety, quest ecosystem);
     orphaned `partySynergy.js` import.
   - From `CAMPAIGN_READINESS_AUDIT.md`: ai_call_log archival;
     post-level-20 progression (Mythic, post-MVP — record only).
   - From `KEEPER_REVIEW.md` / `CODE_AUDIT_FINDINGS.md`: the 8
     Keeper genre-bonus texts vs live `keeperTexts.js` — the
     code audit confirmed them missing and the 2026-11-10 class
     audit does not mention them. Check the live file and report
     missing or present, with evidence. (The Keeper CASTER_TYPE
     bug itself was fixed in Phase 0 — do not re-open it.)
   - From `PHASE_4B_SPEC.md` roster #4: combat difficulty
     mechanism activation for the Phase 3.5 placeholder dial.
   - From `DECISION_LOG.md` open decisions: project rename
     (Zach's call, blocks nothing — record as still open, do
     NOT decide it); Session Hi-Fi Path A/B — DECIDED post-MVP
     2026-11-11 (PM decision note; Path A standing). Do not
     re-open Session Hi-Fi; record it as settled.
   - From `q6-detect-function-survey.md`: `detectDowntime`
     deferral belongs to the downtime phase (post-MVP — record
     only).

## Out of scope
- The 11 KEEP files except item 4's named edits, and all 16
  KEEP-DEFERRED files (prologue, downtime, Mythic, fortress,
  synergies, ancestry redesign, FUTURE_FEATURES parking lot,
  DM_MODE_REVIEW, kingdom survey): do not move, edit, or delete
  any of them. KEEP list: `OPEN_QUESTIONS.md`,
  `Phase_3_Closeout.md`, `DM_MODE.md`, `COMPANIONS.md`,
  `CUSTOM_CLASSES.md`, `THEME_DESIGNS.md`,
  `AI_NARRATIVE_PERSISTENCE.md`,
  `Claude PM Review Docs/COMPANIONS_REVIEW.md`,
  `Claude PM Review Docs/THEMES_REVIEW.md`,
  `triage/DM_CRAFT_ARTICULATION.md`,
  `dnd-documents/Lost_Mine_of_Phandelver_Clean.md`.
- `docs/` — never touch it (briefs, reports, handoff).
- ANY code, test, data, or config change: no `.js`/`.jsx`/`.json`
  /`.sql` edits, no migrations, no test edits. Docs only. If a
  test fails because it referenced a moved doc, restore that doc
  to its original path and report — never edit the test to fit.
- CHANGELOG/DECISION_LOG revival: both archive as v1-era records
  in this job. The REPORT.md pipeline is the living record now
  (PM decision, vetoable at the gate). Do not backfill either file.
- Building any carry-forward item (item 6 is check-and-report only).
- Project rename decision. Session Hi-Fi re-open. Any change to
  MVP scope, grayed-out classes/species, or the queue order.

## Acceptance criteria
- All 29 archive files sit under `archive/` at their preserved
  relative paths, byte-identical (SHA-256 before = after), and
  none remains at its old path — except any file held back by a
  live reference, which stays put and is named in the report.
- `archive/README.md` exists and states the archive's meaning.
- The 5 refreshed files read true against the live build: no
  Opus/Sonnet-as-production, no Anthropic-key requirement, no
  stale counts, no "Narrative beats mechanics", no scrapped
  creator presented as live.
- `triage/alignment-coverage-matrix.md` is deleted ONLY with
  regeneration proof + the ruling quoted in the report; otherwise
  it is archived and the report says why.
- The 4 KEEP-file edits contain only the named corrections.
- Zero code/test/data/config files changed (report proves it with
  the changed-file list).
- Every carry-forward item in item 6 has a disposition in the
  report (built / still open + resolver).
- Item 0 complete: every audit verdict confirmed or flagged with
  evidence; no file moved on an unconfirmed verdict.
- Full `npm test` green on the builder's run.

## Verification
- Run the full `npm test` yourself and iterate until green.
  Zach's full run is the gate — never claim it.
- Note the known runner flag: spellbook-routes takes ~158s against
  the runner's 120s per-file cap — a timeout artifact, not a
  failure, if it trips.
- Grep evidence: the report names the reference check run for the
  moved/deleted files and its result (clean, or each live
  reference found).
- Read-back: each refreshed file was read in full after editing;
  the report confirms it per file.

## Decisions already made
- Cleanup approved (Zach, 2026-11-11): "delete everything that's
  stale or have Claude Code do it."
- Archive-not-delete execution (PM, under Zach's backup rule,
  2026-11-11): 29 files archived recoverably; 1 file deleted only
  with regeneration proof. Reversal cost: one `git mv` back per
  file. Vetoable at the gate.
- Product (settled): solo D&D forever game — one human player
  character; DM, NPCs, companions, enemies all AI; persistent
  world on canonical Forgotten Realms history, playable
  essentially forever. The five problems (context loss, made-up
  rules, no stakes, broken time, fortress tedium) were problems
  building it the first time — not what the app is for.
- DM model DECIDED (Zach, 2026-11-10): gemma4:12b, offline via
  Ollama on his PC. Secret-holding leak test is its acceptance
  check. Single-model assumption dropped; per-role models open.
  Harness bake-off cancelled as the decider.
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
  standing when built, Path B vetoed. Decision note:
  `session-hifi-decision-2026-11-11.md` (PM workspace).
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
  - Item-0 audit verdicts: exceptions in full with evidence,
    confirmations summarized; any file held back, named.
  - Per-file manifest: every archived file (old path → new path,
    SHA-256 before + after), every refreshed file (SHA-256 after,
    what changed), the deleted file (regeneration proof + ruling
    quote) or why it was archived instead, the 4 KEEP edits.
  - Carry-forward disposition table: each item-6 entry with its
    verdict (built / still open + resolver) and evidence.
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
- This job starts after creation-solidification is built + pushed
  (one job at a time). Zach hands this brief + the audit report
  over when job 1's report is back.
- Staging is PC-only (Zach, 2026-11-12): the project lives on
  GitHub; Claude Code builds on the PC copy and pushes. Gate =
  Zach's `npm test` on the PC. The Mac copy is backup/sync only.
- Place this brief at `docs/pm/docs-cleanup/BRIEF.md` in the repo
  when handing it over.
