# Project To-Do

**Read this at the start of every session.** It's the single map of where things stand. Updated whenever active/blocked/parked items move between states.

**New here?** Start with [`PROJECT_BRIEF.md`](PROJECT_BRIEF.md) for the strategic context, then come back to this file. [`DECISION_LOG.md`](DECISION_LOG.md) explains why things are built the way they are.

**Last updated:** 2026-04-30 (Phase 1 complete; Phase 2 pre-engineering closed; engineering bootstrap drafted; per-step creator spec in design)

---

## Where we are in the consolidated phase plan

Phase 0 ✓ shipped (v1.0.103, commit `099a22a`). Phase 1 ✓ complete (game design only; no version bump). Currently entering **Phase 2** (Prelude → Primary transition engineering) in a fresh chat.

Full phase sequence in [`CONSOLIDATED_TODO.md`](CONSOLIDATED_TODO.md):
- ✓ Phase 0 — Stop-the-bleeding fixes
- ✓ Phase 1 — Prelude reframe (game design)
- **Phase 2** — Prelude → Primary transition (engineering) ← *next, fresh chat*
- Phase 3 — AI Narrative Persistence foundation refactors
- Phase 4 — AI behavior diagnostic
- Phase 5 — Focus-area execution (selection deferred to end-of-Phase-4)
- Phase 6 — DM Mode dedicated pass
- Phase 7 — Playing mode

Strict sequencing throughout — each phase ships before the next begins.

## Active right now

What we're working on this session. Should be 1–3 items max.

- [ ] **Phase 2 PM design — per-step creator spec.** Continuing in the PM chat that drafted the engineering bootstrap. Closes Decision B by walking the 7-step creator structure step-by-step (each step's fields, manual vs. handoff modes, validation, help text); follows with empty-state home page design and full spec doc. Spec then goes to Claude Design as a clickable mockup brief. ~10–12 message rounds estimated. Gates Phase 2 engineering chunk 5 (main creator integration + home page redesign).

- [ ] **Phase 2 engineering — chunks 1–4.** Fresh Code chat opening with the engineering bootstrap drafted in PM chat 2026-04-30. Chunks: setup wizard rebuild (per Decision A), transition service (`creation_phase` migration to three-state enum, payload persistence, gap-period UX with partial pre-fill), prompt builder (authority_figure + origin_freeform integration, mentor NPC trigger), marker handling (`[ANCESTRY_HINT].feat_id` server validation, `[NPC_CANON]` / `[CANON_THREAD]` / `[PRELUDE_END]` per plan §6). Chunk 5 stays gated until per-step creator spec is locked and mockup is approved. Living biography schema: `character_biography` table built in chunk 1, seeded in chunk 2.

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

- **Phase 1 — Prelude reframe (2026-04-29)** — game-design-only phase; no version bump. Six structural decisions logged in `DECISION_LOG.md` (Decisions 1-6 dated 2026-04-29) plus tone description sub-deliverable. Outputs: locked outputs spec, three-chapter structure (Ch1 / Ch2 / Ch3; Ch4 collapsed), machinery audit (values + tone-tags + Ch4 transient flag cut; theme ceremony simplified; backstory repurposed as biography seed; chapter promises shifted to Ch2/Ch3; tally re-tuned), Ch3 beat sequence (irreversible act → theme commitment → departure), pacing (4 sessions: 1/1/2; intra-Ch2 AGE_ADVANCE), `[CANON_THREAD]` marker for long-term thread seeding, asymmetric NPC memory model parked for Phase 3, "epic fantasy in a lived-in world" tone description locked. `PRELUDE_IMPLEMENTATION_PLAN.md` rewritten as v4 (replaces v3 + three rounds of design history; DECISION_LOG carries the institutional memory).

Three or four most recent versions. Older history in `CHANGELOG.md`.

- **v1.0.103 (2026-04-29)** — Phase 0 stop-the-bleeding cleanup shipped (commit `099a22a`). Keeper `CASTER_TYPE` bug fixed: surfaced as third-caster (not full) per design; subclasses registered in `SPELLCASTING_SUBCLASSES`; multiclass math now correct. CLAUDE.md `creation_phase` enum reduced to two values to match code. ANCESTRY_FEATS.md count reconciled to 195 with Path Less Walked cross-pick deferred for Phase 7. PM_TODO.md retired. PRELUDE_IMPLEMENTATION_PLAN rule #23 flagged design-only inline. **Phase 0 gate complete; Phase 1 unblocked.**
- **v1.0.102 (2026-04-27)** — LLM Setup tagged-error pattern shipped on `/message` path. `AUTH_FAILURE` / `RATE_LIMITED` / `OVERLOADED` tags wired through `claude.chat()` and surfaced to users at the dominant route. Coverage gaps remain at `/start`, `/restart`, DM Mode routes, 11 generator services — parked for later phase.
- **v1.0.101 (2026-04-27)** — H7 + H8 production fixes shipped. PLAYER OBSERVATION = ALWAYS A CHECK is now verb-gated (only injects when the player commits to perception/investigation/stealth-class verbs); Cardinal Rule 2 softened to "ROLL REQUESTS — DON'T SPOIL OUTCOMES." A/B harness validated both fixes. **Prose-quality triage closes with this release.**
- **v1.0.100 (2026-04-27)** — Lean Prompt toggle retired from the home-page UI. `applyLeanTransforms()` and the `leanPrompt: true` API path stay as a diagnostic harness.
- **v1.0.99 (2026-04-26)** — Opus is now the production default for main DM session continuations. All three UI surfaces default to Opus; Sonnet is the opt-down.

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
