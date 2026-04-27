# Project To-Do

**Read this at the start of every session.** It's the single map of where things stand. Updated whenever active/blocked/parked items move between states.

**New here?** Start with [`PROJECT_BRIEF.md`](PROJECT_BRIEF.md) for the strategic context, then come back to this file. [`DECISION_LOG.md`](DECISION_LOG.md) explains why things are built the way they are.

**Last updated:** 2026-04-26 (v1.0.96)

---

## Active right now

What we're working on this session. Should be 1–3 items max.

- [ ] **Decide on Opus as production default** — see [`triage/prose-quality-triage.md`](triage/prose-quality-triage.md). v1.0.97 session-147 playtest measured ~$2.89/session (~$1.50/hour) at 71% cache hit rate (close to the ~77% ceiling). v1.0.98 lever 1 (tier 2 → 1-hour TTL) should bring per-session cost down ~$0.20–$0.30. Three more levers exist if we want to push lower (rolling-summary-earlier, tier-3-trim).

---

## Blocked / waiting on a decision

Things in progress but waiting on something — a playtest, a user decision, or another piece to land first.

- [ ] **Production decision: Opus vs. Sonnet as default** — waiting on the real-session validation above. User's playtest already confirmed Opus is the prose lever; the open question is whether the cache fix makes it financially tenable as the production default.
- [ ] **Production decision: retire Lean Prompt toggle?** — Lean didn't move the needle in the user's playtest. Likely retire as a production direction, possibly keep the toggle as a debugging tool. Decide after Opus question above.
- [ ] **H7 production fix** — `PLAYER OBSERVATION = ALWAYS A CHECK` rule kills atmospheric scene-opens. Move out of always-on prompt; only inject when player commits to a stealth/investigation/perception verb. Waiting on Opus decision.
- [ ] **H8 production fix** — Cardinal Rule 2 (HARD STOPS) compresses cinematic build. Soften to lean-mode variant in production. Waiting on Opus decision.

---

## Parked / on deck

Designed and ready to build, but not actively in progress. Resume in priority order.

- [ ] **Session Hi-Fi implementation** — see "Session Hi-Fi implementation" entry in [`FUTURE_FEATURES.md`](FUTURE_FEATURES.md). Three-column cockpit redesign of `DMSession.jsx`. Design landed; scope analyzed; 5 open questions captured. Path A (phased, 3 commits) recommended over Path B (one-shot).
- [ ] **Origin & Identity hi-fi tab** — design discussed in chat (not yet built). Replaces the standard "Background" tab; surfaces the Themes system. See `Claude UX Design/D&D Meta Game (Remix)/Themes-Replace-Backgrounds.md` for the system spec. Natural follow-on after Session Hi-Fi commit 1.
- [ ] **Progression hi-fi tab** — design discussed in chat (not yet built). Three parallel rails: Class / Theme / Ancestry. Most novel design problem of the set. Needs Themes spec which already exists.

---

## Backlog (FUTURE_FEATURES)

Items in `FUTURE_FEATURES.md`. Skim that file periodically; pull items here when they become active.

- Themes System full implementation (Starfinder-inspired progression replacing 5e backgrounds)
- Prelude → Primary Campaign Handoff (Phase 5 of `PRELUDE_IMPLEMENTATION_PLAN.md`)
- Tone presets in main campaign (currently prelude-only)
- Unify Opus + Lean Prompt toggles across main + prelude
- Theme Interactions / party-level synergies (companions invoke synergies based on personality)
- Ancestry Feats progression layer (Pathfinder 2e–inspired)

---

## Recently shipped

Three or four most recent versions. Older history in `CHANGELOG.md`.

- **v1.0.98 (2026-04-26)** — Tier 2 prompt cache also moves to 1-hour TTL (was 5m). Lever 1 of three from session-147 cost analysis. Saves ~$0.20–$0.30 per Opus session by consolidating tier 2 re-creations. Cost numbers in CHANGELOG and DECISION_LOG corrected with actual playtest measurements.
- **v1.0.97 (2026-04-26)** — Documentation hygiene: PROJECT_BRIEF, DECISION_LOG, PROJECT_TODO, triage convention.
- **v1.0.96 (2026-04-26)** — Prose-quality diagnostic + prompt cache architecture fix. Opus is the validated narrative lever. Cache hit rate measured at ~71% in production (close to the ~77% mathematical ceiling for thoughtful play); per-session cost ~$2.89 for 24-turn Opus session.
- **v1.0.95 (2026-04-24)** — Playtest fixes round 2 + transcript decoupling.
- **v1.0.94 (2026-04-24)** — Anthropic 529 resilience + cleaner error surface.

---

## Living docs map

Where information lives in this project, and what it's for.

| Doc | Purpose |
|---|---|
| `PROJECT_BRIEF.md` | Strategic orientation — what this project is, why it exists, who it's for, decision principles. Read once when joining. |
| `PROJECT_TODO.md` (this file) | Active/blocked/parked work — read first every session |
| `DECISION_LOG.md` | Why we made the calls we made — past + pending. Read for context. |
| `triage/*-triage.md` | Living state of active diagnoses (broken systems being fixed). Currently: prose-quality. **Not** for design/improvement work — those go in FUTURE_FEATURES. |
| `CHANGELOG.md` | What shipped, per release. Frozen-in-time per version. |
| `TEST_RESULTS.md` | Test pass/fail per release |
| `FUTURE_FEATURES.md` | Backlog of designed-but-deferred features |
| `OPEN_QUESTIONS.md` | Standalone design questions awaiting answers |
| `CLAUDE.md` | Codebase + system architecture snapshot (for AI assistants) |
| `Claude UX Design/` | Design hand-offs from external design tooling — wireframes, hi-fi mockups, design system docs |
| `IMPLEMENTATION_PLAN.md` | Top-level implementation plan |
| `PRELUDE_IMPLEMENTATION_PLAN.md` | Detailed prelude system plan (still active for Phase 5) |
| `THEME_DESIGNS.md` / `ANCESTRY_FEATS.md` / `MYTHIC_*.md` / `SUBCLASS_THEME_SYNERGIES.md` / `PARTY_SYNERGIES.md` / `DOWNTIME_DESIGN.md` | Per-system design specs |
| `tests/output/` | Diagnostic test artifacts (frozen-in-time per run) |

---

## Conventions for keeping this file useful

- **Active right now**: 1–3 items max. If it's longer, move stuff to Parked or Blocked.
- **Move items between sections as they change state**, don't append new entries below stale ones.
- **Link to triage docs** for anything that needs more than a one-line description.
- **Date moved-to-Parked** in the entry text if it's not obvious (so we know what's been sitting).
- **At session boundaries** (whether mine or yours), update *Last updated* + sweep stale entries.
- **When a triage closes**, remove its line from Parked/Blocked here and note it in Recently shipped.
