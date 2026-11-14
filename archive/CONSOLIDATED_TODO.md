# Consolidated Project To-Do

**Status:** Phase 2 shipped at v1.0.114 (2026-05-02). Phase 3 is next.
**Supersedes:** `PM_TODO.md` queue (PM_TODO described itself as ephemeral end-of-review state; this is the durable sequence)
**Complements:** `PROJECT_TODO.md` (which remains the per-session active/blocked/parked map)
**Sequencing decision:** Foundation-first (Option B). Logged in `DECISION_LOG.md`.

---

## How to read this

Phases sequenced strictly — each phase ships before the next begins, with the gating reason called out per phase. Within a phase, items are ordered by dependency where it matters, and unordered where it doesn't. Phase 3 grew sub-phases (3.5, 3.7) as foundation refactors revealed adjacent UI + groundwork that wanted to land before Phase 4's AI-behavior diagnostic.

Severity tags from the Code audit carry through: 🔴 real bug, 🟡 doc-vs-code drift or scope-not-built, 🟢 heads-up.

The trade this sequence makes: AI behavior diagnostic happens *before* commitment to a focus area, inverting the bootstrap prompt's instinct. Reasoning: three candidate focus areas (Prelude AI behavior, Companions wound representation, Themes AI integration) share the same diagnostic. One investigation feeds three execution paths.

---

## Phase 0 — Stop the bleeding ✓ SHIPPED

Shipped at v1.0.103 (commit `099a22a`, 2026-04-29). Keeper `CASTER_TYPE` bug fixed; CLAUDE.md `creation_phase` enum reduced to two values to match code; ANCESTRY_FEATS.md count reconciled to 195; PM_TODO.md retired; PRELUDE_IMPLEMENTATION_PLAN rule #23 flagged design-only inline.

---

## Phase 1 — Prelude reframe (game design) ✓ SHIPPED

Game-design-only phase shipped 2026-04-29. Six structural decisions in `DECISION_LOG.md` (entries dated 2026-04-29) plus tone description sub-deliverable. `PRELUDE_IMPLEMENTATION_PLAN.md` rewritten as v4. Key outputs: three-chapter structure (Ch1/Ch2/Ch3; Ch4 collapsed), four-session pacing (1/1/2 + intra-Ch2 AGE_ADVANCE), `[CANON_THREAD]` marker for long-term thread seeding, biography seed (replaces "remembered-voice backstory"), "epic fantasy in a lived-in world" tone description.

---

## Phase 2 — Prelude → Primary transition (engineering) ✓ SHIPPED

**Status:** Shipped 2026-05-02 at v1.0.114 across 6 commits (v1.0.109 → v1.0.114). 2036 assertions across 15 suites, all green.

**What was built:**

- **8-step rebuilt character creator** (manual + handoff modes) with editorial aesthetic as the project's hi-fi visual default going forward. New `CharacterCreatorV2.jsx` plus 8 step components and primitives. Old `CharacterCreationWizard.jsx` (4392 lines) hidden but retained; slated for deletion after 2-3 playtest cycles confirm no regressions.
- **Six content data files** (~620 player-facing entries): theme gold modifiers (21), personality prompts (63), ideals prompts (~136), bonds prompts (~126), flaws prompts (~106), backstory moments (168). Plus 19 narrative-continuity copy lines for Step 4 handoff mode. All authored in-voice, second-person, alignment-tagged where the field calls for it.
- **Race demographics** with dual-unit display and custom override (10 races × 3 fields).
- **Save/resume** wired across both modes. Persistence-on-every-step-advance to the character row (single source of truth, no parallel JSON blob). New `creation_phase` enum values: `'creating'` (manual mid-creator) and `'ready_for_primary'` (Prelude-played, creator-unfinished). Final enum: `'active' | 'creating' | 'ready_for_primary'`.
- **Server-side canon transfer service** — handoff submit copies `prelude_canon_npcs` / `_locations` / `_threads` into campaign-side tables. Idempotent. Mentor imprint seeding when applicable.
- **Migrations 049 + 050** — heirloom table (`prelude_canon_heirlooms`) + `physical_build` column.
- **Redesigned home page** — single-section "Your Characters" grid with three card states (active, in-progress manual, in-progress Prelude handoff). Diablo-4-pattern "Create New Character" entry as first card.
- **Screen 2 path choice** — two-card layout between home and creator entry (Prelude / Campaign).
- **Spec annotations** — four implementation-deviation notes added to `PHASE_2_CREATOR_SPEC.md` (§5.2.5 reorder, §5.7.3 expansions-closed, §5.6.3 + §8.1.2 heirloom-producer-deferred).

**Phase 2 parking lot** (active; reactivate when relevant):

- 🟡 **Heirloom handoff producer.** Table and consumer-side empty-state shipped; producer-side wiring (mechanism choice — play-time `[OBJECT_HINT]` marker, post-Prelude extraction, or hybrid) deferred. Manual-mode heirloom flow unaffected. Reactivate when user wants Prelude-derived heirloom candidates surfacing in handoff mode.
- 🟡 **Deity worship-contract content authoring.** 53 deities × ~150-250 words (alignment-relationship + worship contract). Not creator-blocking. Reactivate when piety mechanics surface in primary campaign play, or when deity selection at Step 7 should carry more weight.
- 🟡 **Alignment-coverage gap-fills for §7.3-§7.5 prompts.** Coverage matrix exists at `triage/alignment-coverage-matrix.md` (43% of 9-square cells filled across themes × fields). PM authors gap-fills where genuinely absent (not every empty cell needs filling per the principle); Code transcribes into data files.
- 🟡 **CharacterCreatorV2 "edit existing character" surface.** Currently the new creator is creation-only; editing an existing character routes to the legacy `CharacterManager.jsx`. Half-day of work to add edit-mode to v2.
- 🟡 **Campaign-id linkage on transferred canon NPCs/locations.** Canon transfer copies the records but the campaign-id linkage happens later in the existing flow. Cleanup to consolidate.
- 🟢 **Delete deprecated creator + manager files.** `CharacterCreationWizard.jsx` + `CharacterManager.jsx` retained for 2-3 playtest cycles; delete when stable.

**Gate to Phase 3:** Phase 2 is shipped. Phase 3 unblocked.

---

## Phase 3 — AI Narrative Persistence: foundation refactors ✓ SHIPPED (closed at v1.0.162)

**Status:** Phase 3.1 (standing-scalar abstraction, SC-1 → SC-5), Phase 3.2 (marker → state pipeline, SC-6.1 → SC-6.5), and Phase 3.3 (time-bounded state primitives, SC-7.1 → SC-7.7 + SC-7.6.5 player-tunable survival intensity) all shipped across v1.0.144 → v1.0.162 between 2026-05-03 and 2026-05-05. Five fix-along-the-way bugs surfaced + resolved through the refactor mechanism (notoriety silent-drop, NPC absence ×2, dehydration weather modulation, world event clock standardization). Close-out DECISION_LOG entry shipped 2026-05-06.

The reviews surfaced that the AI must do more sustained, attentive, world-aware work over hundreds of sessions than current infrastructure assumes. Code's audit translated this into concrete refactors. Two are load-bearing.

**Inputs Phase 3 inherits from Phase 2 ship:**
- Canon transfer service exists (NPCs, locations, threads from Prelude → primary campaign). Phase 3's NPC/location/thread persistence work has a working precedent to build on.
- Mentor imprint seeding wired (when applicable). Pattern available for other "Prelude inputs that shape primary campaign" work.
- `creation_phase` enum is three-state. Any Phase 3 work that touches character-state machinery needs to be aware of the `'creating'` and `'ready_for_primary'` intermediate states.
- Editorial aesthetic is the project's hi-fi visual default (per 2026-05-02 DECISION_LOG entry, Decision 6). Any Phase 3 surface touching UI follows this register.

**Refactor 3.1 — Unified standing-scalar abstraction.**

Pattern A in `AI_NARRATIVE_PERSISTENCE.md`. Today: companion loyalty, faction standing, Mythic piety, NPC disposition, DM Mode bond-shifts all repeat the same shape with different schemas. Drow Lolth standing has zero footprint despite being designed.

Build: a single mechanism for "scalar + label + audit trail" relationships. Existing systems migrate to it incrementally. Net: Lolth, Aasimar arc gating, Folk Hero fame, Urchin network, faction-NPC standing parity all become trivially addable. Without it, each is a new bespoke schema.

Sequencing: design-doc the abstraction, then migrate companion loyalty as the first port (lowest risk, well-understood shape), then faction standing, then Mythic piety. DM Mode bond-shifts ports last (JSON-blob storage shape is more invasive to extract).

**Refactor 3.2 — Unified marker → state pipeline.**

The "trigger, not activate" / ambient-pattern-matching shape. Today: five reviewed systems, five different implementations (companion event-bus regex, prelude marker regex, DM Mode marker regex, Themes implicit prompt-only, Party Synergies absent). Code's audit confirms these are not unified.

Build: a single pipeline where AI emits markers, server detects via shared infrastructure, effect applied via system-specific handler. New systems plug into the pipeline rather than reinventing.

Sequencing: design-doc the pipeline, port DM Mode markers first (cleanest existing implementation), then Prelude markers, then companion threads. Party Synergies markers get added in Phase 5 as part of the Party Synergies revival.

**What Phase 3 explicitly does NOT do:**
- Doesn't build Pattern F class features (Keeper Eidetic Memory, Sage L5 lore queries) — those need playing-mode evidence to design correctly. Parking lot.
- Doesn't fix the AI shelter-behavior — that's Phase 4.
- Doesn't fix Party Synergies AI integration — that's Phase 5, and it lands on the marker pipeline.

**Phase 3 deliverables:**
- Standing-scalar abstraction module + migration plan
- Marker pipeline module + migration plan
- Documentation updates to `AI_NARRATIVE_PERSISTENCE.md` reflecting which patterns the new abstractions cover
- DECISION_LOG entries per significant architectural call

---

## Phase 3.5 — Settings page UI ✓ SHIPPED (closed at v1.0.163)

**Status:** Shipped 2026-05-05 at v1.0.163 against [`settings/SETTINGS_DESIGN_BRIEF.md`](settings/SETTINGS_DESIGN_BRIEF.md). Two-control scope confirmed 2026-05-05 (no fortress/kingdom dial — that work is fully Phase 3.7 at earliest).

**What shipped:**
- Centered editorial overlay sheet (`SettingsOverlay.jsx`) reachable from a `Settings` link in the appbar on home and mid-session alike. Editorial palette via `.settings-overlay-root` token block in `creator-theme.css`; reads correctly when summoned from either the editorial HomeFlow appbar or the legacy dark dashboard chrome.
- **Survival intensity** dial — wired end-to-end against the SC-7.6.5 mechanism (PUT `/api/character/:id` with `survival_intensity`). Apply-on-click contract, optimistic local state with rollback on failure, `Saved · just now` stamp with relative-time decay.
- **Combat difficulty** dial — drawn quietly per design §6 (dashed track, neutral ticks, "Coming soon" right-margin). Mechanism activation belongs to Phase 4 (prompt-injection territory; needs the AI behavior diagnostic to determine the right counter-mechanism shape).
- `FourPosDial` primitive (active + disabled variants, structurally identical), per-character scope, mid-session safety contract honored (overlay above session DOM; no route change; `Back to game` exit label in-session vs. `Done` from home).
- Close-out DECISION_LOG entry shipped 2026-05-06.

**What was explicitly NOT in scope** (per PM clarification 2026-05-05):
- No fortress/kingdom dial. The producer-gap and recapture-mechanism findings from [`triage/kingdom-management-survey.md`](triage/kingdom-management-survey.md) belong to Phase 3.7.

---

## Phase 3.7 — Fortress groundwork ← ACTIVE

Lands the groundwork that makes a real "fortress system design" Phase 5 candidate viable. Three sub-checkpoints, spec drafting in flight:

- **SC-3.7.1 — Marker-driven threats.** Closes the producer gap [`triage/kingdom-management-survey.md`](triage/kingdom-management-survey.md) §1.2 surfaced (`RAID_CAPABLE_EVENTS` in `raidConfig.js` defines five event types that no production codepath creates). Wires AI-emitted markers (or Opus-prompt fix, per spec call) to actually create `world_events` rows whose `event_type` triggers base-threat spawn.
- **SC-3.7.2 — Mechanical-damage fix.** Resolves the player-led-defense damage asymmetry surfaced in survey §5.3 (auto-resolve and player-led-defense paths apply different damage/defense math; player-led path under-penalizes failure relative to the auto-resolve baseline).
- **SC-3.7.3 — Documentation + KNOWN_BUGS.** Files three KNOWN_BUGS Resolved-archive entries against the survey findings (producer gap, mechanical-damage asymmetry, recapture-window-without-recapture-mechanism). Updates [`triage/kingdom-management-survey.md`](triage/kingdom-management-survey.md) with the post-Phase-3.7 state. Recapture-mechanism itself stays a known limitation in this phase — the player-side codepath for the existing 14-day window is Phase 5 fortress-system territory.

**Out of scope for Phase 3.7** (those belong to the Phase 5 fortress system design candidate, if selected): full fortress UI redesign, multi-base orchestration, kingdom-tier mechanics that don't exist today, player-side recapture codepath.

**Phase 3.7 deliverables:**
- Per-sub-checkpoint code ships + tests
- DECISION_LOG entries per significant call
- Three KNOWN_BUGS Resolved-archive entries (filed in SC-3.7.3)
- Update to [`triage/kingdom-management-survey.md`](triage/kingdom-management-survey.md) reflecting post-Phase-3.7 state

**Gate to Phase 4:** Phase 3.7 ships in full before Phase 4 begins.

---

## Phase 4 — AI behavior diagnostic + combat difficulty mechanism activation

The Prelude/Companions/Themes/DM-Mode shelter-and-shape concern. Three reviews flagged the same pattern: the AI shelters or smooths content when it should not. DM Mode's prompt has the most explicit and best-handled counter-mechanisms.

**Diagnostic scope:**

- Reproduce the behavior in each of three contexts: Prelude (child PC sheltering), Companions (companion content smoothing), Themes (proactive ability surfacing failure)
- Compare prompt structures across all four contexts (the three failing ones plus DM Mode as the reference)
- Identify which DM Mode counter-mechanisms transfer (ABSOLUTE RULES at primacy/recency, FINAL REMINDER doubling, RIGHT-vs-WRONG examples)
- Identify which counter-mechanisms need to be context-specific (a Prelude RIGHT-vs-WRONG example differs from a DM Mode one)
- Output: a counter-mechanism playbook applicable to all four contexts, plus context-specific instances drafted

**Combat difficulty mechanism activation** — Phase 3.5 ships the storage column + UI placeholder; Phase 4 wires the actual prompt-injection mechanism that translates the dial into AI-side combat behavior. Folded into Phase 4 because the right counter-mechanism shape comes out of the diagnostic — combat difficulty is fundamentally an AI-behavior knob, not a numeric multiplier.

**Why diagnostic before execution:**
- All three focus-area candidates share the diagnostic
- Running it once is more efficient than three times
- Findings determine which focus area actually needs the most work — may shift priority

**Phase 4 deliverables:**
- Diagnostic report (markdown doc, project root)
- Counter-mechanism playbook (becomes a reference doc going forward)
- Severity-ranked list of fixes per context
- DECISION_LOG entry on which focus area becomes Phase 5

**Gate to Phase 5:** Phase 4 must complete before Phase 5 commits to a focus area.

---

## Phase 5 — Focus-area execution

Commitment determined by Phase 4 findings. Three candidates exist; ordering and selection are deferred to end-of-Phase-4. Phase 4's diagnostic report determines which focus area becomes Phase 5's headline work.

**Candidates (no ordering implied — list is alphabetical for stability):**

**Companions wound representation + backstory generation principles.**

Audit finding: no `core_wound` field on `companion_backstories`. No explicit prompt-engineering principles for BioWare-tier backstory generation. Inter-companion `party_relationships` absent in player mode.

Possible work: design the wound representation, build the schema, port the DM Mode `party_relationships` JSON-blob pattern to a player-mode table, draft the backstory generation principles. The port is the main engineering lift.

**Prelude AI shelter-behavior fix.**

Phase 4 diagnostic produces the counter-mechanism set. Application would land in `preludeArcPromptBuilder.js`, applied to the reframed Prelude (Phase 1 output).

**Themes AI-trigger specs.**

Audit finding: 84 abilities are full content. Single load-bearing risk is no AI-trigger specs per ability. The system is invisible to the AI today not because of missing content but because the prompt doesn't tell the AI when to fire each ability.

Possible work: per-ability trigger specs (Folk Hero L11 fame recognition, Urchin L11 street-children network, Sage L5 lore consultation, Acolyte L5 emotional read, Far Traveler L11 "notice one thing out of place," etc.). Lands on Phase 3's marker pipeline if helpful, or stays prompt-side if simpler.

**Fortress system design.**

Added 2026-05-05 as a fourth candidate. Phase 3.7's groundwork (producer-gap fix, recapture player-codepath, etc.) lands the prerequisites; Phase 5 fortress work would build the cohesive system-design layer the [`triage/kingdom-management-survey.md`](triage/kingdom-management-survey.md) §0 + §6 finding identified as missing today. Scope shape: design pass (does the existing base/threat/garrison vertical want to grow into a real kingdom layer, or stay a fortress-vertical with a polished single dial?), then implementation. Picks up from wherever Phase 3.7 leaves off.

**Phase 5 picks one of these as headline focus** — call made at end of Phase 4. Others move to parking lot or shift to a later phase depending on Phase 4 findings and Phase 7 viability.

**Phase 5 deliverables:**
- Whatever the chosen focus-area requires
- DECISION_LOG entries for each significant call
- Updated review doc (or new addendum) for the focused system

**Gate to Phase 6:** Phase 5 ships before Phase 6 begins. Strict sequencing.

---

## Phase 6 — DM Mode dedicated pass

DM Mode is the most thoroughly engineered system in the codebase and serves as the reference for AI behavior counter-mechanisms (Phase 4 uses it as the model). It also has the most concrete test infrastructure (97 + 17 integration tests) and the cleanest implementation of several patterns the rest of the codebase needs.

But "thoroughly engineered" isn't "complete." The DM Mode review surfaced concrete deferred work that hasn't shipped, and Code's audit confirmed the gaps. Project work has skewed Player Mode; DM Mode warrants its own phase to make sure it's done right rather than handled in passing during other phases.

**What Phase 6 covers:**

- **`[PARTY_ARGUMENT]` decision and implementation.** Phase 0 made the keep-or-cut call; Phase 6 either wires the detector + handler properly or completes the removal cleanly. (If Phase 0 went the "remove" path, this becomes a no-op and gets struck.)
- **Post-session relationship summary view.** Backend extraction exists; dedicated UI summary panel does not. Players see manual relationship editing only. Build the auto-summary panel.
- **Bond-shift evolution review.** The BOND_SHIFT pipeline is wired and working; Phase 6 evaluates whether the warmth/trust ±2 cap and decay rules feel right after seeing them in real DM Mode sessions, and tunes if needed.
- **Cross-party NPC memory.** No mechanism for an NPC to carry between DM Mode parties. Decide whether to build it (and what the shape would be) or formally cut.
- **Opus toggle for continuations.** CLAUDE.md model split is Sonnet-default for DM Mode. Decide whether to add Opus toggle, and under what conditions.
- **DM Mode positioning.** The bootstrap prompt flagged DM Mode as possibly underweighted strategically. Phase 6 is the appropriate moment to evaluate: is DM Mode a tutorial layer, a parallel feature, or a peer mode? Where does it fit in the product narrative? This shapes what Phase 6 builds and how UI surfaces it.
- **Player-mode → DM-mode pattern porting.** Several Phase 3 / Phase 5 abstractions may originate in DM Mode and land in Player Mode (party_relationships, marker pipeline patterns, counter-mechanism playbook). Phase 6 confirms DM Mode's own implementations remain consistent with whatever the abstractions ended up being.

**Why Phase 6 sits here, not earlier:**

DM Mode is functional today. The gaps are real but not blocking other work. Putting it after the foundation refactors (Phase 3), the AI behavior diagnostic (Phase 4), and the focus area (Phase 5) means Phase 6 lands on a codebase where DM Mode's patterns have been generalized — the cross-party memory question, for instance, is much easier to answer once the standing-scalar abstraction exists.

**Phase 6 deliverables:**
- Per-item decisions and implementations
- DM Mode positioning doc (where it sits in the product)
- Updated DM_MODE_REVIEW addendum reflecting post-Phase-6 state
- DECISION_LOG entries per significant call

**Gate to Phase 7:** Phase 6 ships before Phase 7 begins. Strict sequencing.

---

## Phase 7 — Playing mode

The trigger PM_TODO mentioned. With Prelude reframed and operable, transition fixed, AI behavior addressed, focus area shipped, and DM Mode completed, you start a long-running character.

**Why Phase 7 is its own phase rather than a sequel:**

Several systems can only be properly evaluated with a long-running character, not a manufactured test:
- Downtime activity catalog depth (what's missing, what's overweighted, what feels shallow)
- Companions inter-party relationships in practice (does the ported pattern actually surface BioWare-tier banter?)
- Mythic playtest (does any of the path content past Hierophant feel right?)
- Pattern F class features (Keeper Eidetic Memory, Sage L5 — can only design correctly with chronicle data to query)
- Living World tick balance (is the cadence right? are the consequences too sparse, too dense?)
- Party Synergies emergent behavior (now that AI can see them — depending on what Phase 5 picked)

**Phase 7 process:**
- Start a character. Play through Prelude, exit cleanly (Phase 2 confirmed), proceed to primary campaign
- Note frictions, missing beats, surprising successes, surprising failures as a play journal
- Per-system evaluation passes happen in response to journal evidence, not in a pre-ordained order
- Some parking-lot items reactivate based on play; others stay parked

**Out of Phase 7 (deferred to whenever they bubble up):**
- Mythic Tier 5 broken-mechanics rebalance (Lich Final Equation, Trickster Narrative Authority)
- Mythic path content depth past Hierophant
- Companion mythic interactions
- Lineages-of-characters infrastructure

---

## Parking lot

Items that are real work, not currently sequenced, will reactivate based on Phase 6 evidence or design pivots:

**From Phase 2 (added 2026-05-02):**

- **Heirloom handoff producer.** `prelude_canon_heirlooms` table and consumer-side empty-state shipped in Chunk 5. Producer-side wiring (mechanism choice — play-time `[OBJECT_HINT]` marker, post-Prelude extraction, or hybrid) deferred. Manual-mode heirloom flow unaffected. Reactivate when user wants Prelude-derived heirloom candidates surfacing in handoff mode.
- **Deity worship-contract content authoring.** Phase 2 shipped with deity selection at Step 7 surfacing alignment chip + 1-line description from `deities.json`. Deeper content — what each deity expects from worshippers, how worshipper-deity alignment matters, deity-specific piety thresholds and consequences — is its own scoped content authoring pass. Not creator-blocking. Scope: 53 deities × ~150-250 words each.
- **Alignment-coverage gap-fills for §7.3-§7.5 prompts.** Coverage matrix at `triage/alignment-coverage-matrix.md` (43% of cells filled). Principle: not every empty cell needs filling — fill where roleplay-believable coverage is genuinely absent. PM authors gap-fills, Code transcribes.
- **CharacterCreatorV2 "edit existing character" surface.** New creator is creation-only; editing routes to legacy `CharacterManager.jsx`. Half-day to add edit-mode to v2.
- **Campaign-id linkage on transferred canon NPCs/locations.** Cleanup follow-up.
- **Delete deprecated creator + manager files.** `CharacterCreationWizard.jsx` + `CharacterManager.jsx` retained for 2-3 playtest cycles per "deprecate by hiding nav, not deleting code" discipline. Delete when stable.

**From earlier phases:**

- Ancestry Feats: Aasimar Path's Choice persistence, Drow Lolth standing tracker (lands on Phase 3 abstraction), Drow House Heritage NPC recognition, Human Quick Study time-bounded persistence (depends on time-bounded state primitives — itself a deferred refactor). **Phase 2 integration:** the existing 195-feat system is now load-bearing for character creation — Step 2 picks/locks a feat from the catalog; the §8.2.1 payload contract emits `ancestry_feat_id` + `ancestry_chapter_beats` from `[ANCESTRY_HINT]` markers; sub-choices within feats remain editable in handoff mode per Phase 1 Decision α. **Redesign vision:** A captured redesign for the entire Ancestry Feats system lives in `ANCESTRY_FEATS_REDESIGN_DEFERRED.md` (4-tier structure with L18 generational-inheritance mechanism tied to lineages-of-characters). Gated on at least two of four triggers landing: lineage infrastructure exists, race quests designed, Themes/Mythic reviews complete, AI Narrative Persistence engineering progressed. Trigger #4 will be met after Phase 3 ships; that's still only 1 of 4. Stays deferred. **Note:** any future redesign is now also gated on what it would mean for the integrated character-creation flow — replacing the L1 ancestry-feat slot affects Step 2's celebration card, the payload contract, the marker tally semantics, and the ~620 prompts/moments that were authored against the current 21-theme × 195-feat shape.
- Keeper: 8 Genre-bonus texts content authoring, L5 Eidetic Memory, L14 Unwritten Knowledge (depend on Pattern F infrastructure)
- Downtime: full v3 activity catalog (Train Team Tactic, Mentor's Imprint, Folk Hero Legend territory, ~30 activities), companion personality-driven request generation, reflection/vignette AI integration
- LLM Setup: tagged-error coverage for `/start`, `/restart`, DM Mode routes, 11 generator services, prelude/message AUTH_FAILURE+RATE_LIMITED handling
- Mythic: path content depth past Hierophant, companion mythic, Tier 5 rebalance, Legend math
- Party Synergies: Tier 3 (gates on Downtime), engagement-likelihood layer, mastery tracking
- Unreviewed systems flagged by Code: Living World tick (highest stakes), merchant economy bundle, party bases/fortresses, NPC lifecycle ecosystem, notoriety, quest ecosystem
- Cross-cutting: time-bounded state primitives (Quick Study, per-arc abilities, Tiefling 1-week debts)
- Doc-level: project rename (low urgency, per PM_TODO)
- Engineering hygiene: fix orphaned `partySynergy.js` import (folded into whichever phase touches Party Synergies first)
- Game-design call queue: `[PARTY_ARGUMENT]` keep-or-cut decision (resolved in Phase 0; Phase 6 implements per the call)

---

## What's NOT here that might be expected

- **No project rename.** Per PM_TODO, low urgency. Stays parked.
- **No design bundle for Claude Design.** UX design is parked until visual surfaces are touched. Phase 1 (Prelude reframe) is structural design, handled PM-and-user. If Phase 5 picks Companions or Themes and surfaces UI changes, or if Phase 6's relationship summary view needs design input, Design enters then.

---

## Operational

- This doc supersedes PM_TODO's queue. PM_TODO retires after user approval.
- PROJECT_TODO continues per its existing role (active/blocked/parked, per session).
- DECISION_LOG entries get written by PM as decisions land. User pastes.
- Phase boundaries are sequencing gates, not calendar gates. No deadlines implied.
- Re-evaluation point: end of Phase 4 diagnostic. Findings may reshape Phase 5 commitment and parking-lot priorities.