# Brief — full-codebase-audit: find what we'd have to go back and fix, before we build on it

## Goal (in play)
Nothing the player sees changes in this job. What changes is what we know: when this job is done, we have one ordered list of everything in the game today that is broken, half-built, unwired, or wrong against the book — so the next build fixes things in severity order instead of tripping over them later. No code is written here. The audit only finds and reports.

## Background
- Zach asked for this audit 2026-11-11 (main chat, 00:57 UTC 2026-11-12): Claude Code should "give a report back on what it understands of the project and perform an audit on what we have currently in the game files for quality, content, and to ensure we don't have to go back to fix anything." The Understanding part is already in the handoff (§3 — every report starts with it). This brief is the audit part, drafted 2026-11-12 so the order call can be made.
- Two narrower audits already exist and are NOT redone here:
  - Class audit, 2026-11-10 (`class-audit-2026-11-10.md`): 23 classes, 22 gaps ordered by severity. The severe seven have their own brief (`class-audit-severe-seven-BRIEF-DRAFT.md`), which already tells Claude Code to verify those 22 gaps against live code before building. Do not re-audit the classes item by item; if a possible class gap shows up while auditing another system, report it with file + line and flag it as a possible class-audit overlap — the PM reconciles overlaps, since the class-audit report lives in the PM's workspace, not the repo. Do not go looking for it.
  - .md-files audit, 2026-11-11 (`md-files-audit-2026-11-11.md`): 62 repo .md files, 11 keep / 16 keep-deferred / 35 stale. Docs-cleanup has its own brief (`docs-cleanup-BRIEF-DRAFT.md`). Do not audit documentation here.
- The pattern this audit follows is the class audit's: read-only, findings only, ordered by severity, every finding carrying live file-and-line evidence. Fixes become later jobs.
- Known examples of the defect pattern this audit hunts (do not treat these as the full list — find the rest the same way): `validateSelection` had no live callers; artificer `learnPlan`/`replacePlan` existed as pure functions with zero callers; the Known Spells sheet section never rendered because its gate string appears nowhere in live data. The audit's job is to find every other instance of that shape.

## What to audit
Read-only. Change no code, no data, no tests. Work from the live PC copy on branch `phase-4-hybrid-combat` (see Setup). For each finding, give: severity, the live file + line, what breaks in play (in gameplay terms), and what a fix job would need to do (one line — do not build it).

**1. Quality — across the systems the MVP builds on.**
- Dead code: services, routes, functions, and data files with no live callers, and UI that never renders (gates that can never pass, pickers with no path to them).
- Unwired systems: a service/validator/hook exists but nothing calls it; a stored field is written but never read downstream (the creation-solidification pattern: theme choices stored, never printed on the sheet or in the DM prompt).
- Missing validators: a rule the book or a settled decision requires that nothing enforces at save, level-up, or commit — server-side, not just displayed.
- Client/server mismatches: the sheet or creator says one thing, the server enforces another (caps, counts, allowed picks, prepared totals).
- Tests that don't assert what they claim: suites that pass while the behaviour they name is untested, stubbed, or asserted only on a mock.
- Placeholders, TODOs, and invented-looking data: anything marked TODO / placeholder / TBD in code or data, and any number or list with no book or settled-decision source. Never invent a replacement — report the gap with what would resolve it.

**2. Content — registry completeness and correctness against the book.**
- Species (29 in the registry), spells (583 in the catalog), subclasses (181), magic items in the wired loot banks, and any other registry the MVP reads. Check: entries that are incomplete, duplicated, or wrong against the 2024 book where the book is the authority; entries the creator/sheet/DM prompt cannot reach even though the registry holds them.
- Do NOT re-derive the class audit's 22 gaps, and do NOT re-audit the .md files. Where content overlaps those audits, report the finding with file + line and flag the overlap — the PM reconciles it against the audit reports, which live in the PM's workspace, not the repo.
- Shelved content is not a gap: loot banks deliberately held for later eras, the 18 deferred species and the grayed-out classes (Magus, Blackguard, Scholar, Warrior of Waves) are MVP scope decisions, not missing content. Note them as shelved/deferred where they surface, do not list them as defects.

**3. Systems in scope (MVP only).**
Character creator (6 stages, resume, edit mode), character sheet and progression/level-up, spells / spellbook / prepared casters, rest, combat / dungeon / scene layer, loot discovery, companions and NPCs, DM prompt, time/clock and session persistence (the leave-and-return path). The return-loop test suite is a separate queued job — if the audit finds the persistence path broken, report it as a finding for that job, do not build the suite here.

## Out of scope
- Any fix, however small. Findings only. (Fix-as-you-find-it does not apply to a read-only audit — a fix here would be unreviewed code with no brief.)
- Post-MVP systems: prologue, full downtime, fortress/domain, Mythic, legacy, Session Hi-Fi, DM Mode tutorial, companion switch / settlement-roster driving, published-module pipeline. If a post-MVP file contradicts the MVP build, note it in one line under "Deferred, not defects" — do not list it as a gap.
- FR history v2 (parked — do not ask about it), Daggerheart / Cosmere (closed — do not re-propose).
- The .md files, the class audit's 22 gaps, and the docs-cleanup verdicts (see Background).
- Goliath (parked), ancestry feats for the 18 deferred species, Metamagic, Cosmic Omen (separate follow-up job).

## Acceptance criteria
- One report, `docs/pm/full-codebase-audit/REPORT.md`, with findings ordered by severity (severe / high / medium / lower), each with live file + line evidence, the in-play consequence, and a one-line fix-job pointer.
- Severe means: a player can reach it in MVP play and it breaks a promised behaviour (a class, spell, item, quest, or save that does not work as the book or the creator promises).
- Every system in §3 is covered or explicitly marked "checked, no findings" — no system silently skipped.
- No code, data, or test file changed. `git status` clean apart from the report itself.
- The Understanding section (§3 of the handoff) comes first in the report, before any finding.

## Verification
- No build, no `npm test` gate claim. This job does not change behaviour, so there is nothing to gate in play. If a finding is uncertain, verify it by reading the live code a second time and say so in the report — do not run a speculative fix to check.
- The PM verifies the report the same way as the class audit: spot-check findings against the live Mac build before queuing fix jobs. A finding without file-and-line evidence is reported as unverified, not as done.

## Decisions already made
- Read-only audit, findings only, ordered by severity (Zach, 2026-11-11; pattern from the class audit, Zach 2026-11-10).
- MVP scope locked 2026-11-11: adventuring and core gameplay only; prologue, full downtime, fortress/domain, Mythic, legacy are post-MVP. Deferred is not defective.
- The 2024 book wins on conflict. Never invent data — a gap is stated as a gap.
- Do not guess (Zach, 2026-11-07): if information is needed, ask before building. In this job there is no building — an unanswerable question goes in the report as a blocking question, in full plain terms.
- Sequencing is Zach's call, still open: the PM's recommendation is audit first, then creation-solidification — because the audit's whole point is catching things before we build on them, and creation-solidification builds on the creator. The alternative is creation-solidification first, audit next. This brief works in either order; nothing in it assumes it runs first.

## Report
- §3 format from `claude-code-handoff.md` (Understanding first, then verdict, files changed — the report file only — test results N/A for a read-only audit, cost and usage, not done / still open, decisions made, anything needing Zach's decision), plus:
  - The severity-ordered findings list (§What to audit), with file + line per finding.
  - A "Checked, no findings" list naming each §3 system with no findings.
  - A "Deferred, not defects" list for post-MVP / shelved items that surfaced.
  - A proposed fix order: which findings should become the next fix jobs, in what order, and which can wait for the gate.
- Any question for Zach in full plain terms, one per item, with what was checked and what is still unclear.

## Setup — CONFIRMED 2026-11-10 (Zach)
- Claude Code is installed on Zach's PC. Zach couriers this brief to Claude Code and carries the report back to Muse.
- Repo: `https://github.com/ZGlassman0621/dnd-meta-game.git`, live branch `phase-4-hybrid-combat` (main is stale since June 2026 — never use it). Fresh clone: `git clone https://github.com/ZGlassman0621/dnd-meta-game.git`, then `git checkout phase-4-hybrid-combat`. Otherwise pull latest first (`git pull origin phase-4-hybrid-combat`), then read the brief + handoff, then the files the brief names.
- Place this brief at `docs/pm/full-codebase-audit/BRIEF.md` in the repo when handing it over; the report goes at `docs/pm/full-codebase-audit/REPORT.md`.
- Cost and usage: include this session's estimated cost and usage remaining against the $30/month Claude Code cap, if it can be measured (cap: Pro plan, $30/month — Zach 2026-11-11).
