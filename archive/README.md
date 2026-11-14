# Archive — project history, not current guidance

These files were moved here on 2026-11-13 by the docs-cleanup job. A
repo-wide audit of `.md` files (run 2026-11-11) found them stale or
spent: they describe plans that already shipped, phases that ran
differently, character creators that were scrapped and rebuilt, or a
model and provider setup the project has moved past.

**Do not treat anything in this folder as current guidance.** It is
kept so the history stays readable and so code comments that cite these
documents (for example "see DECISION_LOG 2026-04-30") can still be
followed. Every file keeps its original name and relative path, so a
file that lived at `triage/pattern-d-survey.md` is now at
`archive/triage/pattern-d-survey.md`. The move was byte-identical; git
history shows each file's full past.

What's here:
- **Plans and specs that already ran:** the Phase 2, 3, 3.5 and 4 specs,
  `IMPLEMENTATION_PLAN.md`, `PROJECT_TODO.md`, `CONSOLIDATED_TODO.md`.
- **Point-in-time audits and reviews:** `CAMPAIGN_READINESS_AUDIT.md`,
  `CHAR_CREATOR_DESCRIPTIONS_AUDIT.md`, and four files from
  `Claude PM Review Docs/`.
- **The v1-era records:** `DECISION_LOG.md` (last entry May 2026) and
  `CHANGELOG.md` (last entry 1.0.0.194, 2026-11-12). Neither is
  maintained any more.
- **Survey and triage inputs** from `triage/`, the old-creator design
  questions, a Claude Design handoff bundle, and the April 2026
  prose-quality analysis.

Where current information lives: decisions and the work queue are kept
by the project manager (Muse), outside this repo. Each job's brief and
report are in `docs/pm/`, and the reports, all in `docs/pm/reports/`,
are the living record of what was built.
