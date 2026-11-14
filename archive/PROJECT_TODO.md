# Project To-Do

**Read this at the start of every session.** It's the single map of where things stand. Updated whenever active/blocked/parked items move between states.

**New here?** Start with [`PROJECT_BRIEF.md`](PROJECT_BRIEF.md) for the strategic context, then come back to this file. [`DECISION_LOG.md`](DECISION_LOG.md) explains why things are built the way they are.

**Last updated:** 2026-05-02 (Phase 2 shipped at v1.0.114; entering Phase 3)

---

## Where we are in the consolidated phase plan

Phase 0 ✓ shipped (v1.0.103, commit `099a22a`). Phase 1 ✓ complete (game design only; no version bump). Phase 2 ✓ shipped (v1.0.114, 2026-05-02 — Prelude → Primary transition + character creator rebuild). Currently entering **Phase 3** (AI Narrative Persistence foundation refactors) in a fresh chat.

Full phase sequence in [`CONSOLIDATED_TODO.md`](CONSOLIDATED_TODO.md):
- ✓ Phase 0 — Stop-the-bleeding fixes
- ✓ Phase 1 — Prelude reframe (game design)
- ✓ Phase 2 — Prelude → Primary transition (engineering)
- **Phase 3** — AI Narrative Persistence foundation refactors ← *next, fresh chat*
- Phase 4 — AI behavior diagnostic
- Phase 5 — Focus-area execution (selection deferred to end-of-Phase-4)
- Phase 6 — DM Mode dedicated pass
- Phase 7 — Playing mode

Strict sequencing throughout — each phase ships before the next begins.

## Active right now

What we're working on this session. Should be 1–3 items max.

- [ ] **Phase 3 bootstrap** — open a fresh chat with the Phase 3 bootstrap prompt. Phase 3 is AI Narrative Persistence foundation refactors: unified standing-scalar abstraction (companion loyalty, faction standing, Mythic piety, NPC disposition, DM Mode bond-shifts → single mechanism) and unified marker → state pipeline (replacing five different per-system implementations). Different shape from Phase 2 — refactor work on existing systems rather than greenfield design. Inputs: `AI_NARRATIVE_PERSISTENCE.md` is the design brief; Phase 2 ship state (canon transfer service, mentor imprints, three-state `creation_phase` enum) is the inherited foundation.

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

> **Note (2026-05-02):** Phase 2 established editorial & literary as the project's default hi-fi aesthetic (per DECISION_LOG 2026-05-02 entry, Decision 6). Any of the parked hi-fi work below should default to that register when picked up, with parchment / dark variants exposed as tweaks if visual comparison would help.

- [ ] **Session Hi-Fi implementation** — see "Session Hi-Fi implementation" entry in [`FUTURE_FEATURES.md`](FUTURE_FEATURES.md). Three-column cockpit redesign of `DMSession.jsx`. Design landed; scope analyzed; 5 open questions captured. Path A (phased, 3 commits) recommended over Path B (one-shot).
- [ ] **Origin & Identity hi-fi tab** — design discussed in chat (not yet built). Replaces the standard "Background" tab; surfaces the Themes system. See `Claude UX Design/D&D Meta Game (Remix)/Themes-Replace-Backgrounds.md` for the system spec. Natural follow-on after Session Hi-Fi commit 1.
- [ ] **Progression hi-fi tab** — design discussed in chat (not yet built). Three parallel rails: Class / Theme / Ancestry. Most novel design problem of the set. Needs Themes spec which already exists.

---

## Backlog (FUTURE_FEATURES)

Items in `FUTURE_FEATURES.md`. Skim that file periodically; pull items here when they become active.

- Themes System full implementation (Starfinder-inspired progression replacing 5e backgrounds)
- ~~Prelude → Primary Campaign Handoff~~ ✓ shipped in Phase 2 (2026-05-02, v1.0.114)
- Tone presets in main campaign (currently prelude-only)
- Unify Opus + Lean Prompt toggles across main + prelude
- Theme Interactions / party-level synergies (companions invoke synergies based on personality)
- Ancestry Feats progression layer (Pathfinder 2e–inspired)

---

## Recently shipped

- **Phase 2 — Prelude → Primary transition + character creator rebuild (2026-05-02)** — shipped at v1.0.114 across 6 commits (v1.0.109 → v1.0.114). 8-step rebuilt creator (manual + handoff modes), editorial aesthetic as project visual default, six PM-authored content data files (~620 entries: gold modifiers, personality / ideals / bonds / flaws prompts, backstory moments, narrative-continuity copy), race demographics with dual-unit display, save/resume across both modes via three-state `creation_phase` enum (`'active' | 'creating' | 'ready_for_primary'`), server-side canon transfer (NPCs / locations / threads / mentor imprints), redesigned home page + Screen 2, migrations 049 + 050. Old creator (`CharacterCreationWizard.jsx` + `CharacterManager.jsx`) hidden but retained per "deprecate by hiding nav" discipline. 2036 assertions across 15 suites. Six parking-lot items captured in `CONSOLIDATED_TODO.md`. Spec doc `PHASE_2_CREATOR_SPEC.md` carries four implementation-deviation annotations dated 2026-05-02. Single consolidated DECISION_LOG entry covers six structural decisions made during spec authoring.

- **Phase 1 — Prelude reframe (2026-04-29)** — game-design-only phase; no version bump. Six structural decisions logged in `DECISION_LOG.md` (Decisions 1-6 dated 2026-04-29) plus tone description sub-deliverable. Outputs: locked outputs spec, three-chapter structure (Ch1 / Ch2 / Ch3; Ch4 collapsed), machinery audit (values + tone-tags + Ch4 transient flag cut; theme ceremony simplified; backstory repurposed as biography seed; chapter promises shifted to Ch2/Ch3; tally re-tuned), Ch3 beat sequence (irreversible act → theme commitment → departure), pacing (4 sessions: 1/1/2; intra-Ch2 AGE_ADVANCE), `[CANON_THREAD]` marker for long-term thread seeding, asymmetric NPC memory model parked for Phase 3, "epic fantasy in a lived-in world" tone description locked. `PRELUDE_IMPLEMENTATION_PLAN.md` rewritten as v4 (replaces v3 + three rounds of design history; DECISION_LOG carries the institutional memory).

Three or four most recent versions. Older history in `CHANGELOG.md`.

- **v1.0.114 (2026-05-02)** — Phase 2 final ship. Save/resume + canon transfer + migration 050 + cutover. New creator + home flow is the live path; `?creator=v2` preview routing retired.
- **v1.0.113 / 112 / 111 / 110 / 109 (2026-05-02)** — Phase 2 staged ship. v1.0.109: migration 049 + payload contract reshape + 6 content data files. v1.0.110-113: incremental component tree shipping (Steps 1-4, 5-6, 7-8, home + Screen 2).

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
| `PRELUDE_IMPLEMENTATION_PLAN.md` | Detailed prelude system plan (v4 — implemented in Phase 2; now historical reference) |
| `PHASE_2_CREATOR_SPEC.md` | Phase 2 character creator + home page spec (shipped 2026-05-02 with implementation annotations) |
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