# PHASE_3_5_SPEC.md

**Status:** Drafted, pending Design dependency.
**Phase:** 3.5 of 7+ (mini-phase between Phase 3 close-out at v1.0.162 and Phase 4).
**Authored:** 2026-05-05.
**Sequencing gate:** Phase 3 closed at v1.0.162. Phase 3.5 unblocks once Design completes Settings page visual direction. Code execution ships end-to-end after Design output lands.
**Inputs inherited from Phase 3:**
- `survival_intensity` column on `characters` table (Migration 052, default 'standard')
- `STARVATION_THRESHOLD_CONSUMER` and `DEHYDRATION_THRESHOLD_CONSUMER` reading intensity at evaluation time
- Editorial aesthetic locked as project default
- Per-ship review gate cadence is the project default; Phase 3.5 is shipping with single end-of-phase review per user's "one pass for Code" call (2026-05-05)

---

## §1. Overview

### §1.1 What Phase 3.5 is

A focused mini-phase that delivers the Settings page UI. Two controls populate it at launch:
- **Survival intensity** — active control surfacing the SC-7.6.5 mechanism to the player
- **Combat difficulty** — placeholder control, visually present but disabled, labeled as "coming with future updates"

A third surface (fortress intensity) was originally scoped for Phase 3.5 but pulled to a separate Phase 3.7 (Fortress groundwork) per 2026-05-05 design discussion. Fortress mechanics turned out to need their own design phase before a difficulty dial can sit honestly on top.

### §1.2 What Phase 3.5 explicitly does NOT do

- **Combat difficulty mechanism.** Phase 4 territory — combat is AI-narrated, so combat difficulty is fundamentally a prompt-injection problem. Phase 3.5 ships only the placeholder control on the Settings page; the underlying behavior change comes with Phase 4.
- **Fortress intensity dial.** Pulled to Phase 3.7. The current fortress system has structural issues (producer gap, recapture mechanic doesn't exist, mechanical-damage asymmetry) that need addressing before a difficulty dial makes sense.
- **Settings sub-pages or hierarchical navigation.** Single flat page for now. Sectioning may emerge later as settings accumulate.
- **New settings beyond the two named.** Audio settings, accessibility scaling, debug/developer toggles, AI behavior overrides — all are future territory. Don't bake them in.
- **Settings affecting character creation flow.** Survival intensity is set at character creation today via default value (everyone starts at Standard). Whether intensity selection becomes part of character creation is a separate design question, not Phase 3.5 work.

### §1.3 Decision summary going into Phase 3.5

Calls already made before this spec was authored (2026-05-04 to 2026-05-05):

| Call | Decision |
|---|---|
| Phase 3.5 vs. Phase 3.7 split | Settings page is Phase 3.5 (small, focused). Fortress groundwork is Phase 3.7. |
| Combat difficulty | Defer to Phase 4. Settings page shows placeholder. |
| One-pass execution | Code drives end-to-end without per-sub-checkpoint review gates. End-of-phase review is the only gate. Internal ship cadence is Code's call (1 to 3 ships likely). |
| Design dependency | Real. Settings page is a new screen. Design pass gates Code execution. |

### §1.4 Cadence and execution

Unlike Phase 3 which used per-sub-checkpoint review gates, Phase 3.5 ships with **one end-of-phase review gate** per the 2026-05-05 user call. Internal ship cadence is Code's discretion:

- If Code judges the work cleanest as one ship, ship one ship.
- If Code judges it cleaner to ship Settings page structure, then survival control, then combat placeholder as three internal ships, that's also fine.

The sequence is:
1. **Design pass** (gates Code) — Settings page visual direction returns from Design
2. **Code execution** (one or several ships, Code's call) — Settings page + survival surfacing + combat placeholder
3. **End-of-phase review** (PM + user) — full Phase 3.5 review covering all Code's work
4. **Phase 3.5 close-out** — DECISION_LOG entry, brief, transition to Phase 3.7

---

## §2. Settings page

### §2.1 What the page is

The first general-purpose tool screen in the app. Distinct from gameplay screens (DM session, character creation, prelude wizard) and home screen. Lives at a stable URL path (Code's call on the specific path; suggested `/settings`).

The page launches with two controls. Future settings accumulate here over time. Phase 3.5 designs for graceful growth without over-investing in scaffolding for surfaces that don't have content yet.

### §2.2 Visual direction

**Owned by Design.** PM forwards the Settings page Design brief separately; Design returns with:
- Page layout (full-screen vs. modal)
- Information architecture (single page vs. sectioned/tabbed)
- Access pattern (where Settings is reached from in the nav)
- Mid-session safety pattern (how Settings opens during a DM session without losing state)
- Save behavior (apply on click / apply on close / explicit save)
- Return-to-gameplay flow
- Visual treatment of survival intensity control (dropdown / radio / segmented / custom)
- Visual treatment of combat difficulty placeholder

PM forwards Design's output to Code as part of the Phase 3.5 handoff. Code implements per Design's direction.

### §2.3 What the page contains at launch

Two controls, in this order:

**Survival intensity** (active)
- Label: "Survival Intensity" (or per Design's wording)
- Four positions: Off / Lenient / Standard / Strict
- Per-position explanatory copy:
  - **Off** — Survival mechanics fully disabled. No starvation, no dehydration, no weather effects. Useful for narrative-focused play.
  - **Lenient** — Survival exists as flavor. Hunger and thirst rarely punish; weather effects are mild.
  - **Standard** — Realistic survival pressure. Default rules.
  - **Strict** — Survival genuinely matters. Tighter thresholds, harsher weather effects.
- Default: Standard
- Per-character setting

**Combat difficulty** (placeholder)
- Label: "Combat Difficulty" (or per Design's wording)
- Four positions: Off / Lenient / Standard / Strict (same shape as survival, for visual consistency)
- Marked as disabled with copy indicating it's coming with future updates (per Design's treatment)
- No backend behavior change in Phase 3.5

### §2.4 Out of scope for §2

- Implementing combat difficulty's behavior (Phase 4)
- Saving combat difficulty selections to the DB (placeholder doesn't persist user input)
- Any other settings beyond the two named

---

## §3. Survival intensity surfacing

### §3.1 What's already in place from Phase 3

`survival_intensity` column on `characters` table. Default `'standard'`. `STARVATION_THRESHOLD_CONSUMER` and `DEHYDRATION_THRESHOLD_CONSUMER` already read intensity at evaluation time. Existing characters have `'standard'` already; behavior unchanged for them.

`PUT /api/character/:id` already accepts `survival_intensity` with enum guard (silent skip for invalid values).

### §3.2 What Phase 3.5 adds

Wires the existing mechanism to the new Settings page UI:

1. **Read path.** The Settings page reads the active character's `survival_intensity` from `GET /api/character/:id` (or wherever character data is fetched on page load).
2. **Write path.** When the player changes the setting, the page writes via `PUT /api/character/:id` with `{survival_intensity: 'off'|'lenient'|'standard'|'strict'}`.
3. **Apply behavior.** Per Design's call (apply on click / apply on close / explicit save). The change takes effect on the next evaluation tick — survival mechanics check intensity at decay/threshold evaluation time, so the next tick of the living-world loop after the write picks up the new value.
4. **Visual feedback.** When a non-Standard intensity is selected, a brief explanatory note may surface on the Settings page itself (per Design) and/or in the DM session prompt (already implemented in Phase 3.3 — see `formatSurvivalForPrompt` adding a one-line DM hint for non-Standard intensities).

### §3.3 Mid-session safety

The player can change `survival_intensity` mid-DM-session. The change applies at the next evaluation tick. Existing in-flight survival state (current hunger, current thirst, current exhaustion) is unaffected — Off doesn't retroactively undo accumulated exhaustion; it stops new pressure from accumulating.

This matches the SC-7.6.5 implementation. No additional Phase 3.5 work needed for this; the behavior is already correct on the server side.

### §3.4 Edge cases worth naming for Code

- **Multiple characters in one campaign.** Each character has their own `survival_intensity`. Settings page is per-character; the active character's setting is what's read/written.
- **Character switching.** If the player switches characters, the Settings page should reflect the new active character's setting. Standard practice; just naming for completeness.
- **Invalid values.** Backend already silently skips invalid values via enum guard. Frontend should validate before submitting (limit dropdown/radio to the four valid values).

---

## §4. Combat difficulty placeholder

### §4.1 What this is

A visible-but-non-functional control on the Settings page that signals to the player: **"combat difficulty is a real planned setting, not a missing feature."** Sets expectations and demonstrates the Settings page is a growing surface.

### §4.2 What Phase 3.5 implements

- Visual control matching the survival intensity layout (four positions: Off / Lenient / Standard / Strict)
- Disabled state per Design's treatment (greyed out, "coming soon" tag, etc.)
- Optional informational copy: "Combat difficulty controls how challenging encounters feel. Coming with future updates."
- No DB column added in Phase 3.5
- No backend behavior change

### §4.3 What Phase 3.5 does NOT implement

- The mechanism behind combat difficulty (Phase 4)
- Persisting placeholder selections (the placeholder control may default to Standard visually but doesn't write to anywhere)
- Communication to AI prompts that combat difficulty has been "set" (Phase 4 work)

### §4.4 Why a placeholder rather than no control at all

The Settings page launching with one item feels sparse. A second item — even a placeholder — communicates that the page is a real growing surface. Players see "settings exist; more are coming" rather than "this is a one-trick page."

The honest read on this: it's also an explicit signal to PM and Code that combat difficulty has a designated home when Phase 4 builds the mechanism. The Settings page is ready to receive it; only the mechanism needs to ship.

---

## §5. Engineering notes

### §5.1 DB shape decisions

- **No new schema migrations in Phase 3.5.** `survival_intensity` already exists from Migration 052. Combat difficulty is placeholder-only, no column needed.
- **No changes to `characters` table.** All work is read/write of existing data plus new UI surface.

### §5.2 Backwards compatibility

- All existing characters have `survival_intensity = 'standard'` (the column's default value). Settings page launches with Standard pre-selected for them.
- No data migration needed; existing behavior unchanged.

### §5.3 Test strategy

- **Settings page rendering tests.** Page renders correctly with each survival intensity value preselected. Combat difficulty placeholder renders disabled.
- **Survival intensity write tests.** Changing the value via the page persists correctly via `PUT /api/character/:id`. Invalid values are blocked frontend-side before submit.
- **Mid-session safety tests.** Changing survival intensity mid-session doesn't disturb session state (this may be more of a smoke test than an automated test).
- **Combat difficulty placeholder tests.** Control is rendered but non-interactive; doesn't submit any state.

Per the "one pass" cadence, tests can ship alongside their respective code or be batched at the end. Code's call on internal organization.

### §5.4 Sub-checkpoint structure

Phase 3.5 internal sub-checkpoints (informal, Code's discretion to ship as one or batched):

- **3.5.1** — Settings page UI structure (per Design's direction)
- **3.5.2** — Survival intensity control wired to backend
- **3.5.3** — Combat difficulty placeholder

Code may ship these as one v1.0.16x bump or three. The end-of-phase review covers the cumulative state.

### §5.5 What Phase 3.5 makes possible (downstream)

- **Phase 3.7 (Fortress groundwork)** ships fortress-related KNOWN_BUGS and the marker-driven-threats reframe; could surface a third Settings control if/when fortress intensity becomes relevant (it's not in Phase 3.5).
- **Phase 4 (AI behavior diagnostic)** activates the combat difficulty control by building the underlying prompt-injection mechanism. Settings page is ready to receive it.
- **Future settings (audio, accessibility, etc.)** plug into the established Settings page pattern.

---

## §6. Open questions

Resolved or deferred during drafting; no PM calls outstanding for Phase 3.5.

**Q1 — Where does Settings access live in the nav?** Deferred to Design.

**Q2 — Modal vs. full-screen?** Deferred to Design.

**Q3 — Save behavior?** Deferred to Design.

**Q4 — Visual treatment of four-position dial?** Deferred to Design.

**Q5 — Placeholder treatment for combat difficulty?** Deferred to Design.

**Q6 — Per-character vs. per-campaign for combat difficulty when it eventually ships?** Phase 4 question, not Phase 3.5. Survival intensity is per-character; combat difficulty's scope is open until Phase 4 designs it.

**Q7 — Should the Settings page surface "what character am I configuring?"** PM lean: yes, somewhere visible. But Design's call. The page is per-character data; if the player has multiple characters, this matters.

---

## §7. Handoff to Code

### §7.1 What this spec is

A scoping document for Phase 3.5 implementation. PM has authored the spec; Design provides visual direction; Code implements end-to-end.

The same shape as `PHASE_2_CREATOR_SPEC.md` and `PHASE_3_REFACTOR_SPEC.md`, but smaller-scoped — Phase 3.5 is a focused mini-phase, not a major phase.

### §7.2 Sequence Code follows

1. **Wait for Design output.** PM forwards Design brief separately; Design returns with visual direction. Code execution gates on this output landing.
2. **Implement per Design + spec.** Code's discretion on internal ship cadence (one ship or several).
3. **Ship for end-of-phase review.** PM + user review the cumulative Phase 3.5 state.
4. **Iterate per review feedback.** Phase 3.5 closes when review passes.

### §7.3 What Code is being asked to do

- Build the Settings page per Design's visual direction
- Wire survival intensity control to existing `PUT /api/character/:id` endpoint (read on page load, write on user change)
- Build combat difficulty placeholder (visible, disabled, labeled per Design)
- Ensure mid-session access doesn't disturb session state
- Tests per §5.3

### §7.4 What Code is NOT being asked to do

- Implement combat difficulty's behavior (Phase 4)
- Add new schema migrations
- Build settings beyond the two specified
- Implement Settings sub-pages or hierarchical navigation
- Modify the survival intensity backend logic (already shipped at SC-7.6.5)

### §7.5 Standing by

After Design output lands, Code execution begins. PM is available for clarification throughout Code's execution; surface questions when they arise rather than waiting for review.

---

## Document footer

**Authored:** 2026-05-05 by PM.
**Lock date:** TBD pending Design output.
**Supersedes:** Nothing (Phase 3.5 is greenfield UI work).
**Related:**
- `PROJECT_BRIEF.md` — overall project framing
- `PHASE_3_REFACTOR_SPEC.md` — predecessor phase, includes SC-7.6.5 (the mechanism this UI surfaces)
- `PHASE_3_5_DESIGN_BRIEF.md` (forwarded separately to Design)
- `CONSOLIDATED_TODO.md` — to be updated to reflect Phase 3.5 → Phase 3.7 → Phase 4 sequence
- Phase 3 close-out brief — context on what Phase 3 accomplished