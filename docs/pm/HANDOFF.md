# Claude Code Handoff — DnD Meta Game

**Read this before every job. The brief is the job. The report is how the job comes back.**

**Roles:** Muse is the project manager. Claude Code builds. Zach decides and gates. The PM guide (`pm-guide.md`, in Muse's workspace) states the overarching goals, systems, and MVP — this document states how a single job moves between PM and builder.

**Where things live:**
- Repo: `~/Documents/DnD Meta Game/` on the Mac, live branch `phase-4-hybrid-combat` (main is stale since June 2026 — never use it). Claude Code works on the PC copy of the repo; the two copies stay in sync via GitHub (Zach keeps both updated).
- Briefs: `docs/pm/<job-slug>/BRIEF.md` (PM writes). Reports: all in one folder, `docs/pm/reports/<job-slug>-REPORT.md` (Claude Code writes), so Zach knows exactly which file to carry back (Zach, 2026-11-12).
- This handoff doc: `docs/pm/HANDOFF.md` in the repo (copy in Muse's workspace as `claude-code-handoff.md`).
- The PM's live state note stays in Muse's workspace (`current-build-state.md`). Each brief carries the settled decisions its job needs — do not go hunting for them elsewhere.

---

## 1. The workflow (one job, start to finish)

1. **PM writes the brief** (`docs/pm/<job-slug>/BRIEF.md`) and gives the file to Zach. Zach hands it to Claude Code on the PC. Nothing is built until the brief exists.
2. **Claude Code pulls the latest on the live branch first** (`git pull origin phase-4-hybrid-combat`), so it builds on the newest code. Then it reads the brief + this handoff doc, then the files the brief names. If the brief is unclear or contradicts the live build, stop and say so in the report — do not guess past it.
3. **Claude Code implements** on the live branch, in small targeted edits (see §4).
4. **Claude Code runs the full test suite itself** (`npm test` in the repo on the PC) and iterates until it is green — or until it hits a genuine blocker, which it reports instead of working around.
5. **Claude Code writes the report** (`docs/pm/reports/<job-slug>-REPORT.md`) in the format in §3, and pushes the work to GitHub so it reaches the Mac (Zach keeps the Mac copy synced).
6. **Zach carries the report back to Muse.** The PM reads it, verifies it against the brief, and tells Zach what's next and when to run the gate.
7. **Zach runs the gate** (his full `npm test` on the Mac). Green closes the job. Red goes back to step 1 with a fix brief.

**One job at a time.** One migration sequence, one serial gate, no parallel edits to the same file. A second job starts only when the first is built + pushed, or the PM explicitly says otherwise.

**No chat reporting.** The report file IS the report. Do not rely on a chat message to carry status — write it to the report file, where the PM will read it. If a build goes quiet for more than an hour, update the report with where it stands.

## 2. The brief (what the PM owes the builder)

Every brief has these sections, in this order. A brief missing any of them is incomplete — say so before building.

- **Job + goal in gameplay terms.** What the player experiences when this is done. One paragraph, no technical shape.
- **Background.** What already exists, with file paths and line references from the live build. Which settled decisions apply (with their source — e.g. "multiclass prerequisites removed, Zach 2026-11-08").
- **What to build.** Gameplay terms first, then the technical shape. File list where known. What "done" looks like in play.
- **What NOT to touch / out of scope.** Named explicitly. Sibling systems, deferred items, and anything Zach parked.
- **Acceptance criteria.** Observable in play AND in tests. Numbers where they exist (suite counts, assertion counts, exact values from the book).
- **Verification.** Run the full `npm test` yourself. What green means for this job. What to do on red (fix, don't work around).
- **Decisions already made.** Rulings that settle what would otherwise be a judgment call, with who decided and when. Nothing here is re-decided by the builder.
- **What the report must contain.** The §3 format, plus anything job-specific the PM needs back.

## 3. The report (what the builder owes back)

Every report has these sections, in this order. Zach hands this report to the PM — it must be readable by a non-technical person and verifiable by the PM.

- **Understanding first:** in your own words, what this project is (one paragraph, in gameplay terms) and what this job asks for. If your understanding differs from the brief, or the brief contradicts what you see in the live code, say so here — before anything else. A misunderstanding caught here is cheaper than a build on a wrong assumption.
- **Verdict, one line:** BUILT + GREEN / BUILT + RED / PARTIAL / BLOCKED.
- **Files changed.** Every file, with path and size. New vs edited. Migrations numbered.
- **What was built, in gameplay terms.** What the player experiences now. No technical shape as the headline.
- **Test results.** Full `npm test` output summary: files green/total, assertions passed/failed. Per-suite counts for the suites the job touched. If anything is red, the exact failure and what it means.
- **Cost and usage.** This session's estimated cost and the usage remaining against the $30/month cap, if you can measure it. (Cap: Claude Code Pro plan, $30/month — Zach 2026-11-11.)
- **What was NOT done / still open.** Named, with why. Never silently drop an item from the brief.
- **Decisions made inside the brief's latitude.** Each one stated as a reversible call with its reversal cost, flagged for Zach's veto at the gate.
- **Anything needing Zach's decision.** Only what the PM cannot decide: the gate itself, things only Zach can supply, and spend that would break the $30/month Claude Code cap. Each question in full plain terms — never shorthand — with what was checked and what is still unclear. One question per item. Everything else the PM decides inside the brief's latitude and lists under Decisions made, with reversal costs, for veto at the gate.
- **Verification evidence.** The PM verifies from this report, not from the repo — so every claim carries its evidence: commit hash + branch + the PC repo path; SHA-256 hash for every changed file; test names and counts for behavior; exact :5173 steps for visible changes. A claim without evidence is reported as unverified, not as done.

**Report rules:** never report a job as done when its tests are red. Never claim a gate — only Zach's run gates. Never credit Zach for code or tests. Never hide a failure behind a passing total. Never report a claim without its evidence (hash, test count, or verification step).

## 4. Build rules (hard-won, non-negotiable)

These are lessons paid for in failed gates. Follow them on every job.

- **Migrations:** write through the runner's transaction only — `up(db)` + `db.execute(...)`. Never import `dbAll`/`dbRun` inside a migration (it escapes the transaction onto another connection and deadlocks).
- **`node --check` proves syntax only.** Static-check every named import against the target module's actual `export` lines. Named-import link errors surface only at module load.
- **Test raw INSERTs must list EVERY NOT NULL column with no default.** The insert helper fills them automatically; hand-written SQL does not.
- **Test asserts on system-rolled outcomes must model EVERY branch** — crits double damage dice; a companion opportunity attack can kill; death saves nat-1 = two failure pips, nat-20 = revive; HP pools floor at 0. Enumerate the outcome space before asserting.
- **Never invent data.** No invented spell numbers, no invented lists, no invented prices. A gap is stated plainly as a gap, with what would resolve it. The 2024 book wins on conflict.
- **Small targeted edits only.** Never a full-file rewrite. One edit, verify, next edit.
- **Never build on assumptions.** If the brief doesn't settle it and the live build doesn't answer it, stop and put it in the report as a blocking question. A guess that has to be fixed later is more work than asking.
- **Fix-as-you-find-it:** when a fix reveals the same defect in a sibling, fix it in the same job and report it.
- **Back up before deleting.** Before deleting data or wiping a database, make a backup first (export/download a copy). Only delete what is genuinely unneeded.
- **Don't over-engineer rare edge cases.** Leave ultra-rare corners as known edges, stated in the report.
- **Attribution:** the codebase and tests are Claude Code's work under Zach's direction. Never credit Zach for code or tests.
- **Test characters are invented.** Garrick, Lyra, Toma, Seraphine are playtest figures, not Zach's characters. Zach has no active campaign. No game exists until the full build is up and running.
- **Player/character data in the live DB is test data.** Never treat it as a campaign to preserve.

## 5. When blocked

Stop. Write in the report (`docs/pm/reports/<job-slug>-REPORT.md`): what blocks you, what you already tried (with the evidence), and exactly what you need — a decision, a document, a value from Zach's physical book. Do not work around a blocker by inventing data, weakening a test, or silently dropping scope. A blocked report is a good report; a guessed build is not.

## 6. Templates

### Brief template (copy into `docs/pm/<job-slug>/BRIEF.md`)

```markdown
# Brief — <job slug>: <title in gameplay terms>

## Goal (in play)
<What the player experiences when this is done.>

## Background
<What exists, with file paths + line refs. Settled decisions that apply.>

## What to build
<Gameplay terms first, then technical shape. File list where known.>

## Out of scope
<Named explicitly.>

## Acceptance criteria
<Observable in play + in tests. Numbers where they exist.>

## Verification
<Run the full npm test yourself. What green means here.>

## Decisions already made
<Rulings with who/when. Not re-decided by the builder.>

## Report
<§3 format, plus anything job-specific the PM needs back.>
```

### Report template (copy into `docs/pm/reports/<job-slug>-REPORT.md`)

```markdown
# Report — <job slug>: <title>

## Understanding
<What this project is and what this job asks for, in your own words. Any difference from the brief, stated here.>

## Verdict
<BUILT + GREEN / BUILT + RED / PARTIAL / BLOCKED — one line.>

## Files changed
<Every file, path + size. New vs edited. Migrations numbered.>

## What was built (in play)
<What the player experiences now.>

## Test results
<Full npm test summary: files green/total, assertions passed/failed.
Per-suite counts for touched suites. Exact failures, if any.>

## Not done / still open
<Named, with why.>

## Decisions made (reversible, for veto)
<Each with its reversal cost.>

## Needs Zach's decision
<Full plain-terms questions, one per item, with what was checked.>

## How to verify
<Gate command + what to look for in the browser (:5173).>
```

## 7. Setup — CONFIRMED 2026-11-10 (Zach)

- Claude Code is installed on Zach's PC. Zach couriers briefs from Muse to Claude Code and carries Claude Code's reports back to Muse.
- Briefs live in the repo under `docs/pm/<job-slug>/`. Reports live together in `docs/pm/reports/`, one `<job-slug>-REPORT.md` per job; Claude Code writes it there and Zach carries it back.
- Repo sync CONFIRMED 2026-11-10 (Zach): the project lives on GitHub; Zach keeps the Mac and PC copies in sync. Claude Code pushes to GitHub; Zach pulls to the Mac for the gate test.
- Git remote (recorded 2026-11-11, from Zach): `https://github.com/ZGlassman0621/dnd-meta-game.git`. A pull needs no URL — the clone stores it under `origin`. A FRESH clone: `git clone https://github.com/ZGlassman0621/dnd-meta-game.git`, then `git checkout phase-4-hybrid-combat` (the live branch — do not stay on main, stale since June 2026).
