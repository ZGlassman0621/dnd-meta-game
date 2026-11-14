# Decision Log

Records the meaningful decisions that shape this project — past calls (so you understand *why* it's built the way it is) and pending calls (so you know what's waiting on a judgment).

Format per entry is light by design:

```
## YYYY-MM-DD — Title (Category)
**Context:** what was the situation
**Decision:** what we chose
**Why:** the reasoning
**Implications:** what this means going forward
**Related:** [optional pointers]
```

**Categories:** Architecture · Direction · Prompt design · UX · Infrastructure · Process

**What goes here vs. CHANGELOG:** CHANGELOG records *what shipped*. This file records *why we shipped that and not the alternatives*. If a decision will shape future work or future architectural choices, it belongs here. Bug fixes and routine implementations don't.

---

## Open decisions pending

These are the calls waiting on user input or external evidence. Listed newest-first.

### 🟡 Project rename
**Status:** User flagged the working title "D&D Meta Game" needs replacing. No replacement chosen yet.
**Implications:** Affects package.json, UI brand text, README, and this brief. Defer until a name is picked.

### 🟡 Session Hi-Fi: Path A (phased) or Path B (one-shot)
**Status:** Deferred until prose-quality work closes. Five sub-questions captured in [`FUTURE_FEATURES.md`](FUTURE_FEATURES.md) under "Session Hi-Fi implementation".

---

## Decisions log (newest first)

### 2026-05-06 — Project rebuild decision; v1 enters maintenance state (Direction)

**Context:** The project has been built piecemeal across 7+ phases since the user started building it after a few weeks of unconstrained D&D play with Opus 4.5. The original starting point — a downtime system meant to give a character something to do during the user's workday — was the wrong foundation for what the project became (a system designed to play D&D, not to manage a character outside of D&D). Every phase since has been doing real, valuable work, but each has worked around the absence of an intentional starting point and a defined MVP. Phase 3 made substantial structural progress (standing-scalar abstraction, marker pipeline consolidation, time-bounded state primitives). Phase 4a shipped diagnostic infrastructure that immediately surfaced findings about prompt-shape and AI behavior issues. Test campaigns during Phase 4a revealed combat system gaps and in-window attention failures that informed the user's read of the project's state.

**Decision:** Project rebuild. v1 (current code at v1.0.165) enters maintenance state — playable, available as a fallback, not actively iterating. v2 is a new build with a defined MVP and an intentional foundation. The rebuild is motivated not by structural rot in v1 but by the absence of a foundation phase that a deliberate v2 can provide.

**v2 MVP (user's articulation):** "The ability to play a fully self-contained session of D&D with systems that all work as they should: combat, spellcasting, roleplaying. The very basics of D&D and that core gameplay loop: The Dungeon Master describes a situation → The Players describe what they want to do → Dice are rolled to determine whether the players succeed, or if there is a complication. A pre-determined replayable scenario that doesn't change with a DM who can iterate on player actions and follow the above gameplay loop for 20-40 turns."

**Transition path: (c) with (b) elements.** Phase 4b's constraint audit (Investigation #1) runs against v1, with audit findings serving as input to v2's prompt design. Some additional v1 test campaigns may run during the transition; findings from those sessions inform v2's design but are not v1 fixes. Failures observed are errors-to-avoid-in-future, not bugs-to-fix-now.

**What carries forward to v2 (preserved):**
- All project documentation: PROJECT_BRIEF, DECISION_LOG (this entry and prior), AI_NARRATIVE_PERSISTENCE, KNOWN_BUGS, FUTURE_FEATURES, CONSOLIDATED_TODO
- All Phase specs: PHASE_3_REFACTOR_SPEC, PHASE_3_5_SPEC, PHASE_3_7_SPEC, PHASE_4_OVERVIEW, PHASE_4A_SPEC, PHASE_4B_SPEC
- All Design briefs from Phase 2 and Phase 3.5
- The OoDL transcript (`Order_of_Dawn_s_Light_-_Original_Campaign_Conversations_with_Claude.pdf`) as reference texture
- The DM-craft articulation (`triage/DM_CRAFT_ARTICULATION.md`)
- All review documents in `/mnt/project/`
- Editorial aesthetic locked from Phase 2 — non-negotiable carryover
- Phase 3 architectural patterns as proven designs: marker pipeline shape, standing-scalar abstraction, time-bounded state primitives
- The fix-along-the-way methodology and parameterize-not-converge pattern as project-wide methodology calls
- Phase 4 framing: practice-building over one-time fixes, OoDL as reference texture, example-as-hard-fact warning, scope-of-instruction-application as central diagnostic

**What closes with v1 (specific to current implementation, not carried forward):**
- v1 codebase remains as fallback playable state at v1.0.165
- v1 character data, session data, in-progress campaigns — not migrating to v2 (user has nothing in v1 they want to preserve at character/session level)
- The downtime system and prelude system as production code — both reframed as future features for v2 rather than near-term scope
- Phase 4b investigations not yet activated — roster preserved as design input to v2 rather than as v1 work to ship

**v2 case-by-case considerations (user's call at v2 design time):**
- Editorial aesthetic: definitely keep
- Character creator: keep but evaluate against D&D Beyond and BG3 for whether v2 can do better
- Settings page (Phase 3.5): UI shape and four-position labeled register dial proven; reusable
- Combat system: significant rework needed (combat math errors, narration sequencing, defense roll gaps surfaced during Phase 4a testing); v2 should design from scratch
- Marker pipeline: v1 implementation proven; v2 inherits as architectural pattern
- Time-bounded state: v1 implementation proven; v2 inherits as architectural pattern
- Standing-scalar abstraction: v1 implementation proven; v2 inherits as architectural pattern
- AI behavior diagnostic infrastructure (Phase 4a): instrumentation valuable; v2 may rebuild but the signal roster and prompt-shape accounting concepts are proven

**Implications:**
- Phase 4 is sunsetted as a phase. Phase 4a's deliverables are recorded as shipped (v1.0.165). Phase 4b is closed as not-activated; investigations move to v2's project plan as design inputs.
- Phase 5+ original framing (focus areas, fortress system design, Phase 6 DM Mode, Phase 7 long-running play) are sunsetted as v1 phases. Concepts carry to v2's project plan; sequencing and shape will be redetermined in v2's planning.
- All open KNOWN_BUGS in v1 stay documented but are not v1 work to fix. They become "things v2 must handle correctly from the start" rather than "things to patch in v1."
- v1 maintenance state means: keep deployable, fix only critical bugs that prevent fallback playability, no feature work.

**v2 first deliverable (per user's call):** A project brief and architecture document for v2, drafted in a fresh chat context. The user will start that chat with the project knowledge from v1 already imported.

**Related:**
- All v1 phase close-out DECISION_LOG entries
- `triage/DM_CRAFT_ARTICULATION.md` — user's articulation of what good DMing means in this game
- 2026-05-06 conversation transcript on rebuild decision (this conversation)
- v1.0.165 ship summary (Phase 4a final state)

### 2026-05-06 — Phase 4a: AI behavior diagnostic infrastructure shipped (Architecture)

**Context:** Phase 4 splits into Phase 4a (diagnostic infrastructure — structural-refactor-shaped, bounded scope, ships once) and Phase 4b (investigation practice — emergent, recurring). Phase 4a is the foundation that lets the project see what the AI is actually doing across gameplay sessions; without it, prompt tuning is fumbling in the dark. Per [`PHASE_4A_SPEC.md`](PHASE_4A_SPEC.md) §1.2 Phase 4a is **read-only on production prompts** — capture what the AI does; don't change what the AI does. Tuning is Phase 4b.

**Decisions:**

#### Decision 1 — Logger wraps the call site, not the API client (per spec §2.5)

The capture point is `logAiCall(opts, callFn)` — caller passes context (character_id, session_id, prompt_builder, call_purpose, system_prompt, user_message, conversation_history) and a callback that invokes the actual API. Alternative considered: wrap at `claude.chat()` itself with optional logContext. Rejected because each call site has the right context (gameplay turn vs. NPC voice extraction vs. campaign plan generation); the API client doesn't. Spec §2.5 calls out the call-site-wrap pattern explicitly; followed verbatim.

A thin `loggedChat(callContext, ...chatArgs)` drop-in replacement was added on top so generator-style call sites (campaign plan, NPC voice, quest gen, etc.) take a 1-line edit each rather than a full callFn restructure. **All 37 production Claude call sites migrated** in this ship — no un-instrumented surface remains.

#### Decision 2 — Token-count capture via `onApiMeta` callback (additive to claude.chat)

Token counts (`input_tokens`, `output_tokens`, `cache_read_input_tokens`, `cache_creation_input_tokens`) come from the API response's `usage` field. Claude's wrapper functions (`continueSession`, `startSession`) don't return raw API data to callers — they return cleaned text. To capture without restructuring those wrappers' return shapes, added `options.onApiMeta` callback to `chat()`. The logger sets this callback; `chat()` invokes it after the API returns. Existing call sites are unaffected (callback is optional). Cleanest of the alternatives considered (mutate-options pattern, double-return shape, tee'd response).

#### Decision 3 — Section-boundary inference is heuristic, not exact (Q5 ruling, spec §4.4)

Two paths considered:
- **Exact**: modify each prompt builder to emit a structured `{prompt, sections: [{name, tokens}]}` shape alongside the prompt string.
- **Heuristic**: regex-based pattern recognition on existing builder output (`=== SECTION ===`, `ALL CAPS HEADERS:`, `**Bold**`, `# Markdown`).

Chose heuristic. Rationale: exact requires touching every prompt builder (substantial diff) and the project's existing builders already use consistent header conventions that the regex can latch onto. Heuristic gets ~90% of the value at 5% of the cost. Phase 4b investigation #1 (constraint audit) will surface whether v1 accuracy is sufficient; if not, exact annotation lands as a follow-up ship.

Token counting via `chars/4` estimator for pre-API breakdown; actual API token counts still land per-call (in dedicated columns) when available.

#### Decision 4 — Eight signals shipped at SC-4a.2; scope-of-application is the most important

Spec §3.2 lists seven primary signals + scope-of-application (§3.5) as the eight total. All eight implemented in `aiBehaviorSignals.js`:

1. `markerCorrectionLoopHits` — count of correction-loop-triggering turns
2. `ruleViolationRates` — count of rule-flagged calls, bucketed by rule kind
3. `repetitionLedgerTriggers` — repetition-ledger flag counts (sourced from metadata; will move to dedicated column if Phase 4b investigations need it)
4. `responseLengthDistribution` — token-count distributions per call_purpose
5. `markerEmissionRates` — per-marker-type emission counts
6. `nameReuseSignal` — heuristic proper-noun extraction; flags names appearing across multiple character_ids
7. `timeDriftSignal` — heuristic time-mention extraction; flags subject-keyed value drift within a session ("Lyra arrives in 7 days" → "Lyra arrives in 4 days")
8. `scopeOfInstructionApplication` — per the example-as-hard-fact warning ([`PHASE_4_OVERVIEW.md`](PHASE_4_OVERVIEW.md) §6); flags responses violating broad principles even when the narrow example case isn't present

Per spec §3.5 scope-of-application is "the most important signal for Phase 4b's constraint audit." The v1 detector roster covers four autonomy-violation patterns (player_dialogue_attribution, player_thought_attribution, player_emotion_attribution, player_physical_action_directive) — explicit "ship a basic version even if imperfect; refinement happens in Phase 4b investigation #1."

#### Decision 5 — Debug page + CLI tool both ship at SC-4a.4 (per spec §5.2)

Three surfaces in priority order per spec: (a) debug page, (b) CLI, (c) raw SQL. (a) and (b) shipped; (c) is implicit (the data is in SQLite; documenting the schema is the deliverable, done via the migration's column comments + this DECISION_LOG entry).

Page lives at `activeView === 'showAIBehavior'`, accessible from the dashboard nav grid (labeled "AI Behavior (debug)"). Editorial register relaxed per spec §5.3 — plain typography, dense layout, no decorative ornaments. Filter controls (character / session / call_purpose dropdowns) + signal summary panel + call list + per-call detail pane. Two-column layout; signals + list on left, detail on right.

CLI at `server/scripts/ai-behavior.js` with subcommands: `sessions`, `signal`, `calls`, `export`, `shape`, `cumulative`. Pipeable to grep/jq for ad-hoc analysis. Same signal functions backing both surfaces.

**Implications:**

- **All 37 Claude call sites are now logged.** Phase 4b investigations get a complete capture surface from session 1 onwards. No instrumentation gap forces a "wait for more data" period.
- **The `ai_call_log` table is append-only and unbounded** by design (spec §2.4). User's hardware can handle the volume; the diagnostic value is highest when complete; archival is future work via the `archived_at` column already on the schema.
- **Phase 4b is unblocked.** Investigation #1 (constraint audit) consumes scope-of-application + section-contribution; investigation #2 (continuity preservation) consumes name-reuse + time-drift; investigation #3 (shelter-fixation) consumes the captured prompts/responses directly; #4-#8 all benefit from the captured surface.
- **Phase 4a is a single ship.** No internal sub-checkpoint review gates per spec §1.4; one end-of-phase review covers cumulative state. Code's call (Code drove end-to-end).
- **Same-Opus-family advantage applies through Phase 4b.** PM (current Opus) and production-Claude (current Opus) share model family per [`PHASE_4_OVERVIEW.md`](PHASE_4_OVERVIEW.md) §4. PM's intuitions about thresholds and patterns transfer well; threshold tuning during Phase 4b investigations should leverage this.

**Related:** [PHASE_4_OVERVIEW.md](PHASE_4_OVERVIEW.md) framing, [PHASE_4A_SPEC.md](PHASE_4A_SPEC.md) execution spec, [server/migrations/053_ai_call_log.js](server/migrations/053_ai_call_log.js), [server/services/aiCallLogger.js](server/services/aiCallLogger.js), [server/services/aiBehaviorSignals.js](server/services/aiBehaviorSignals.js), [server/services/promptShapeAccounting.js](server/services/promptShapeAccounting.js), [server/routes/aiBehavior.js](server/routes/aiBehavior.js), [server/scripts/ai-behavior.js](server/scripts/ai-behavior.js), [client/src/components/AIBehaviorDebugPage.jsx](client/src/components/AIBehaviorDebugPage.jsx), [tests/ai-behavior-instrumentation.test.js](tests/ai-behavior-instrumentation.test.js).

---

### 2026-05-06 — Phase 3.7 (Fortress groundwork) closed (Direction)

**Context:** Phase 3.7 was scoped on 2026-05-05 as a focused mini-phase between Phase 3.5 close-out and Phase 4. Original framing absorbed five sub-checkpoints (marker-driven threats, holdings purpose data, region-state primitives, mechanical-damage asymmetry fix, documentation + KNOWN_BUGS). User confirmed the speculative-vs-safe groundwork distinction during 2026-05-06 review: holdings purpose data and region-state primitives are framework-shaped but their consumers (holdings management UX, region-driven threat origination) live in the future fortress system design phase. Speccing those frameworks now means guessing at consumer needs. Phase 3.7 stripped speculative groundwork; shipped only safe groundwork plus documentation.

**Decision:** Phase 3.7 closes at v1.0.164. Three sub-checkpoints shipped in a single ship:
- SC-3.7.1 — Marker-driven fortress threats. New `[FORTRESS_THREAT]` marker schema + handler in `baseThreatService.js`. Handler validates ownership + active-status + single-active-threat invariant, computes raid-vs-siege via `SIEGE_FORCE_THRESHOLD`, fallbacks land handler-side per Q3 (lookups against `RAID_CAPABLE_EVENTS[EventType]`), creates row + narrative_queue entry. Legacy `generateThreatsForCampaign` deprecated, not removed.
- SC-3.7.2 — Mechanical-damage symmetry fix. `recordPlayerDefenseOutcome` now runs `computeDamageFromOutcome` for `damaged`/`captured` outcomes via new `synthesizeOutcomeCalcFromMarker` helper. Synthetic rolls flagged for downstream analytics distinguishing marker-driven from auto-resolve. Player-led `damaged` defaults to mild sub-tier (margin treated as 0). Caller-supplied damageReport blobs merge with mechanical mutation. `repelled` continues to apply zero damage.
- SC-3.7.3 — Documentation + KNOWN_BUGS. Four KNOWN_BUGS entries landed (two active: recapture window without recapture mechanism, holdings purpose data is stub; two resolved-archive: producer gap, mechanical-damage asymmetry). CLAUDE.md updated for marker-driven origination canonical and damage symmetry. Kingdom-management survey annotated with post-Phase-3.7 status block.

**One-pass execution:** Phase 3.7 used a single end-of-phase review gate per the cadence inherited from Phase 3.5. Code shipped all three sub-checkpoints as one v1.0.164 bump given the bounded scope. Pattern continues to work cleanly for focused mini-phases; not a precedent for larger phases where intermediate review gates have prevented drift.

**Why review gated on automated tests rather than live gameplay:** Phase 3.7 is backend-only work with no user-facing surface. Live gameplay validation requires either accumulated game state (a campaign with an active fortress, threats accumulated through normal play) or a test-fixture infrastructure that doesn't currently exist. Code's 61 assertions covered the substantive paths: schema validation (15), handler dispatch including error paths and raid-vs-siege and fallback behavior (20), damage symmetry across all outcomes plus caller-merge cases (24). Plus regression suites green across marker-pipeline (44), sc6-4d-combat-mythic-schemas (48), threshold-crossed-cluster (33), survival-intensity (59), time-bounded-state (69). The mechanisms are tested; the experience-layer validation comes naturally during Phase 4's AI behavior diagnostic work, which exercises marker emission heavily. User accepted the trade-off explicitly: "Code's tests are generally good."

**What shipped beyond strict spec scope (worth naming):**
- **Synthetic-roll flagging on player-led damage.** Not specified, but Code's instrumentation choice — synthetic outcomeCalc rolls produced by `synthesizeOutcomeCalcFromMarker` are flagged so downstream analytics can distinguish marker-driven outcomes from auto-resolve outcomes. Phase 4's diagnostic instrumentation will benefit from this distinction. Worth keeping in mind as the project's analytics surface grows.
- **Caller-supplied damageReport merge with mechanical mutation.** Marker can carry narrative damage commentary alongside mechanical effects; both persist. Cleaner than forcing caller to choose.

**Fix-along-the-way pattern: 6 instances across three phases.** SC-3.7.1's producer-gap absorption joins the named pattern (notoriety silent-drop SC-6.4c, NPC absence relocate-prefix-bug + forget-repeat-fire-bug SC-7.3, dehydration weather-modulation SC-7.6, world event clock divergence SC-7.7, producer-gap absorption SC-3.7.1). Methodology is durable across phase boundaries. Future structural refactor work should explicitly survey for adjacent bugs the planned change would naturally subsume. SC-3.7.2's damage-symmetry fix is NOT counted — it was an explicit acceptance criterion of the sub-checkpoint, not an incidental discovery during prep.

**What's pending for downstream phases:**
- **Phase 4 (AI behavior diagnostic):** activates `[FORTRESS_THREAT]` by tuning when and how the AI DM decides to emit fortress threats. Marker mechanism is in place; AI behavior is Phase 4's territory. Combat difficulty mechanism also activates here (placeholder shipped at Phase 3.5).
- **Future fortress system design phase (Phase 5 candidate):** holdings purpose data, region-state primitives, secondary holdings system as a coherent feature, recapture quest framework with multi-session arc and ally requirements. The two active KNOWN_BUGS entries from Phase 3.7 (recapture mechanism, holdings purpose data) are explicitly marked as fortress-phase territory.

**Implications:**
- Fortress threat origination is now marker-driven canonically. The legacy `generateThreatsForCampaign` path stays in code but is unused in production. Future cleanup can remove it when convenient (probably during the fortress system design phase, once that phase confirms the new origination is the only mechanism).
- Damage application across the fortress system is now consistent — both auto-resolve and player-led defense apply mechanical damage. Player choice between engaging and ignoring threats is now a real strategic question rather than a one-sided incentive.
- Phase 4's AI behavior diagnostic work has a real surface to instrument. "When does the AI emit `[FORTRESS_THREAT]`?" becomes a diagnostic question with a concrete signal. Synthetic-roll flagging on player-led damage gives Phase 4 additional analytical leverage.

**Related:**
- `PHASE_3_7_SPEC.md` (the spec this closes)
- `triage/kingdom-management-survey.md` (the survey informing the architectural reframe)
- `KNOWN_BUGS.md` (Phase 3.7 contributed four entries: two active, two resolved-archive)
- DECISION_LOG entry 2026-05-04 "Phase 3.3 (Pattern D / time-bounded state primitives) closed" (predecessor pattern for closing-shape entries)
- DECISION_LOG entry 2026-05-06 "Phase 3.5 (Settings page) closed" (immediate predecessor)
- `CONSOLIDATED_TODO.md` (to be updated to reflect Phase 3.7 closed and Phase 4 active)

### 2026-05-06 — Phase 3.7 close-out: fortress groundwork — marker-driven threats + damage symmetry + KNOWN_BUGS triage (Architecture)

**Context:** Phase 3.7 was scoped as a small "fortress groundwork" mini-phase between Phase 3.5 close (v1.0.163) and Phase 4 entry. Three sub-checkpoints, all backend + documentation work, no Design dependency. Goal: lay foundation for an eventual fortress system design phase (Phase 5 candidate) by absorbing two findings from [`triage/kingdom-management-survey.md`](triage/kingdom-management-survey.md) and triaging the rest into `KNOWN_BUGS.md`.

**Decisions:**

#### Decision 1 — Marker-driven origination over closing the producer gap directly (SC-3.7.1)

The survey's headline finding: `RAID_CAPABLE_EVENTS` defined five event types, but no production codepath created `world_events` rows with any of them. Two options for resolving:

- **Close the producer gap**: update Opus's living-world-generator prompt to emit raid-capable event_types, fix the faction-milestone spawner. Threats originate via the world-event tick the way the original design imagined.
- **Reframe origination**: AI DM emits a marker; handler creates the threat row directly. World-event tick path becomes deprecated.

Chose the second. Architecturally aligns with user's 2026-05-05 fortress vision (threats are narrative-driven by quest context, not probability-driven by per-tick rolls against fixed probabilities). Also matches the Phase 3.2 marker-pipeline precedent — markers that own state transitions are clean, parallel ports to the existing handler shape (PIETY_CHANGE, BOND_SHIFT, LOOT_DROP). The world-event path stays in place per spec §1.2 (removing would touch the living-world tick architecture; out of Phase 3.7 scope), marked deprecated in code comments.

The choice has a forward-looking implication: when Phase 4's AI behavior diagnostic asks "when does the AI emit `[FORTRESS_THREAT]`?", that becomes a tractable diagnostic question with a real signal — the marker is the surface to instrument.

#### Decision 2 — Source/Category fallbacks land handler-side (Q3)

The schema validates structure (BaseId is an integer, EventType is one of five, Force/WarningDays in range). The handler does the lookup against `RAID_CAPABLE_EVENTS[EventType]` for absent optional fields (`Source` falls back to `eventCfg.sourceLabel`; `Category` falls back to `eventCfg.category`). Cleaner separation: schemas validate AI output shape; handlers know about consumer-service domain. If `RAID_CAPABLE_EVENTS` adds entries later, the schema enum needs to grow with it but the fallback logic stays automatic.

#### Decision 3 — Mild sub-tier as default for player-led `damaged` (§3.4)

SC-3.7.2 closes the mechanical-damage asymmetry: player-led defense now applies the same building/treasury/garrison damage as auto-resolve. Auto-resolve's `damaged` outcome has two sub-tiers (mild at margin ≥ 0; severe at margin -1..-5). Player-led defense doesn't roll dice, so there's no margin. Two options:

- **Default to severe**: treat the absence of a roll as worst-case damage.
- **Default to mild**: treat player engagement as inherent partial mitigation.

Chose mild. Rationale: "player engaged with the defense; even a 'damaged' outcome reflects active resistance. Penalize players who engaged less harshly than players who didn't." Future severity field on `[BASE_DEFENSE_RESULT]` (Q4) can override when narrative weight calls for it — out of Phase 3.7 scope.

The mild default produces a 25% treasury / 20% garrison / 1-2 buildings damaged outcome — strictly cheaper than the severe sub-tier (50%/40%/2-3) but still real mechanical loss. Closes the perverse incentive (engagement was previously mechanically free) without making engagement a worse choice than letting auto-resolve run.

#### Decision 4 — Two findings absorbed; two filed as active KNOWN_BUGS

Phase 3.7 absorbed the survey's two architecturally-bounded findings (producer gap → SC-3.7.1; mechanical-damage asymmetry → SC-3.7.2). The other two — recapture-window-without-recapture-mechanism and holdings-purpose-data-is-stub — were filed as active KNOWN_BUGS rather than fixed in scope.

Rationale: both deferred items are *framework* work whose right shape depends on consumer needs that don't exist yet. Recapture is a multi-session quest arc per user's 2026-05-05 vision (allies, coordination beats, dramatic stakes), not a marker handler. Holdings-purpose-data needs to be designed alongside its first real consumer (holdings management UX). Phase 3.7 is "groundwork," not "every gap closed." Designing those frameworks pre-consumer would be guessing.

The fortress system design phase (Phase 5 candidate) inherits a clean threat-origination pipeline + the recapture/holdings-purpose work remaining + a triage doc that's now a tighter input.

**Implications:**

- **`baseThreatService.js` has two origination mechanisms now**, marker-driven (canonical) and world-event-driven (deprecated, unused in production). Same row shape. Future code paths that want to create threats programmatically can use either path; the marker handler exposes the validation + invariants that programmatic call sites would otherwise need to duplicate.
- **Fix-along-the-way pattern reaches 6 instances** in Phase 3 + 3.7. The Phase 3 close-out named five (notoriety silent-drop, NPC absence ×2, dehydration weather modulation, world event clock standardization). SC-3.7.1's producer-gap resolution joins as a sixth — bug surfaced during structural prep work; structural change subsumed the fix. SC-3.7.2's damage symmetry fix is *not* fix-along-the-way; it was an explicit acceptance criterion of the sub-checkpoint.
- **CLAUDE.md updated** to reflect marker-driven threat origination as canonical (DM session markers list + marker pipeline section + Party bases section). The legacy `generateThreatsForCampaign` path's deprecation is documented in code comments referencing this DECISION_LOG entry + spec §1.2.
- **Test coverage:** new `tests/fortress-threat-marker.test.js` (61 assertions) covers schema validation, handler dispatch (all error paths + happy path + raid-vs-siege determination + Source/Category fallback behavior), and the SC-3.7.2 damage-symmetry fix (each outcome path + caller-supplied damageReport merge). All Phase 3 regression suites stay green.
- **Phase 3.7 is closed.** Phase 4 (AI behavior diagnostic + combat difficulty mechanism activation) is unblocked.

**Related:** [PHASE_3_7_SPEC.md](PHASE_3_7_SPEC.md) §1–§4, [server/services/markerSchemas.js](server/services/markerSchemas.js) FORTRESS_THREAT block, [server/services/baseThreatService.js](server/services/baseThreatService.js) (FORTRESS_THREAT handler + `synthesizeOutcomeCalcFromMarker` + updated `recordPlayerDefenseOutcome` + deprecation comment on `generateThreatsForCampaign`), [tests/fortress-threat-marker.test.js](tests/fortress-threat-marker.test.js), [KNOWN_BUGS.md](KNOWN_BUGS.md) (two new active entries + two new resolved-archive entries), [triage/kingdom-management-survey.md](triage/kingdom-management-survey.md) post-Phase-3.7 status update.

---

### 2026-05-06 — Phase 3.5 (Settings page) closed (Direction)

**Context:** Phase 3.5 was conceived during Phase 3.3 implementation as the home for player-facing UI surfacing of `survival_intensity` (mechanism shipped at SC-7.6.5, v1.0.162, server-side only). Initial scoping discussions explored adding fortress/kingdom intensity and combat difficulty alongside survival; both were eventually pulled. Combat difficulty deferred to Phase 4 (combat is AI-narrated; the dial is fundamentally a prompt-injection problem, which Phase 4's AI behavior diagnostic work owns). Fortress intensity deferred entirely after the kingdom-management survey surfaced that the underlying system has structural gaps (producer gap in raid-capable event creation, recapture mechanic without a player-side codepath, mechanical-damage asymmetry between auto-resolve and player-led defense) that make a difficulty dial premature. User confirmed during fortress design discussion that the fortress system needs a dedicated design pass before any difficulty dial sits honestly on top of it; that work parks as Phase 3.7 (Fortress groundwork) plus a future fortress system design phase (Phase 5 candidate).

**Decision:** Phase 3.5 closes at v1.0.163. Settings page UI shipped per Design's brief. Survival intensity is the active control; combat difficulty is a visible placeholder pointing at `standard` for when Phase 4 activates the underlying mechanism. Settings access lives as a text link in the appbar (home + mid-session); the page is a centered overlay sheet over a tinted scrim, save behavior is apply-on-click with a `Saved · just now` stamp that decays to relative time on subsequent renders.

**One-pass execution:** Phase 3.5 used a single end-of-phase review gate per user's 2026-05-05 call rather than per-sub-checkpoint gates. Code drove end-to-end after Design's output landed; v1.0.163 was the entirety of Phase 3.5 in one ship. Pattern worked cleanly for a focused mini-phase with bounded scope; not a precedent for larger phases where intermediate review gates have prevented drift.

**Why the scope reductions:**
- **Combat difficulty deferred to Phase 4.** Combat in this game is AI-narrated, not mechanically simulated. A dial that doesn't reach the AI's prose behavior is cosmetic. Phase 4's AI behavior diagnostic work is the natural home for prompt-injection-shaped controls.
- **Fortress intensity pulled entirely.** The kingdom-management survey (`triage/kingdom-management-survey.md`, 2026-05-05) found the fortress system has structural gaps that need design attention before a difficulty dial makes sense. User's fortress design vision (rare arc-shaped sieges driven by narrative state, secondary holdings driven by quest context not probability tables) is significantly different from current code; speccing a dial for a system about to change is wasted work.

**What shipped:**
- Settings overlay accessible via appbar text link on both home and mid-session contexts
- Survival intensity four-position dial (Off / Lenient / Standard / Strict), reads/writes via `PUT /api/character/:id`
- Combat difficulty placeholder dial, disabled, points at `standard`, marked "Coming soon"
- Per-character context (header reads "Settings for *[character name]*")
- Apply-on-click + `Saved · just now` stamp with relative-time decay
- Esc-to-close + scrim-click dismiss; "Done" / "Back to game" exit affordances per context

**What's pending for downstream phases:**
- **Phase 3.7 (Fortress groundwork):** marker-driven-threats reframe; holdings-purpose data; region-state primitives; mechanical-damage asymmetry fix. Three KNOWN_BUGS entries to file (producer gap, mechanical-damage asymmetry, recapture window without recapture mechanism).
- **Phase 4 (AI behavior diagnostic):** activates combat difficulty by building the prompt-injection mechanism. Settings page UI is ready to receive it.
- **Future fortress system design phase (Phase 5 candidate):** management UX; secondary holdings system with narrative-driven threat generation; recapture quest framework; ally/coordination requirements.

**Implications:**
- Settings page is now the canonical home for any future player-facing toggles. Pattern: section heading with count, four-position labeled register dial component, apply-on-click save behavior. Adding new sections is one new `.settings-section` block; no parent layout change.
- The `FourPosDial` primitive and `.settings-overlay-root` editorial palette are reusable for any future setting that maps to a four-position scale.
- Combat difficulty placeholder pointing at `standard` means when Phase 4 activates the mechanism, the value is meaningful by default rather than null.

**Related:**
- `PHASE_3_5_SPEC.md` (the spec this closes)
- Settings page Design ship brief (Design's authoritative output forwarded to Code)
- `triage/kingdom-management-survey.md` (the survey that informed the fortress-deferral decision)
- DECISION_LOG entry 2026-05-04 "Opus as default model for prelude gameplay sessions; Sonnet/Haiku for non-prose work" (the prose-vs-non-prose principle that frames Phase 4's combat difficulty work)
- Phase 3 close-out DECISION_LOG entry (predecessor; this entry mirrors its closing-shape)
- `CONSOLIDATED_TODO.md` Phase 3.7 entry (the next active phase)

### 2026-05-04 — Phase 3.3 (Pattern D / time-bounded state primitives) closed (Direction)

**Context:** Phase 3.3 was added to Phase 3 mid-flight (2026-05-04 decision) to consolidate time-bounded state logic across the codebase. Code's Pattern D survey (`triage/pattern-d-survey.md`) inventoried 11 surfaces falling into four shape clusters; PM drafted §3.3 with three primitives and seven sub-checkpoints. SC-7.6 and SC-7.7 absorbed two bug fixes that would otherwise have been deferred. SC-7.6.5 added a player-tunable survival intensity layer over the SC-7.6 mechanism. Phase 3.3 ships eight sub-checkpoints total (SC-7.1 through SC-7.7 plus SC-7.6.5) for an effective seven sub-checkpoint cadence given SC-7.6.5's mechanism-only-no-UI status.

**Decision:** Phase 3.3 closes at v1.0.162. All seven per-system migrations complete (SC-7.2 through SC-7.7). Foundation (SC-7.1) and player-tunable layer (SC-7.6.5) shipped. Mechanism-only-no-UI status of SC-7.6.5 is intentional; UI work moves to Phase 3.5 (Settings page).

**Synthesis — three primitives, fully exercised:**

- `daysSince(anchorGameDay, currentGameDay)` — null-safe arithmetic helper. Replaces ~20 inline arithmetic sites across the codebase.
- `registerDecayConsumer(config)` — decay-on-read consumer factory. Three semantics validated against real production consumers: CONSUMED (companion mood, SC-7.2), HIGH_WATER_MARK (NPC absence, SC-7.3), WRITTEN_BACK (notoriety, SC-7.4).
- `registerThresholdConsumer(config)` — threshold-with-effect factory. Eight consumers across six service files exercise deterministic thresholds, stochastic thresholds (NPC relocation 10% roll, SC-7.3), variable per-instance thresholds (promise auto-break, SC-7.5), two-stage pipelines (merchant orders, SC-7.5), weather-modulated thresholds (dehydration, SC-7.6), game-day-clock-standardized thresholds (world events, SC-7.7), and intensity-tunable thresholds (survival, SC-7.6.5).

**Synthesis — nine structural findings accreted across the migration:**

1. **Three-semantics enum fully exercised.** CONSUMED / HIGH_WATER_MARK / WRITTEN_BACK each have a real-world validator. The enum was designed speculatively in SC-7.1 against the survey's observed shapes; SC-7.2 → SC-7.4 prove the shapes were drawn correctly. No semantics added during migration; none removed.

2. **SELECT-pre-filter as a fifth idempotency strategy.** Six of eight threshold consumers use this pattern (the orchestrator's WHERE clause filters to pre-fire status; the abstraction's idempotency callbacks become no-ops). Joins the threshold-handler registry, natural-fired-once-marker, and existing strategies as a documented option.

3. **Per-instance threshold derivation via `repository.readAnchor`.** Variable-deadline promises (SC-7.5) and CON-modifier-dependent starvation thresholds (SC-7.6) handled without API extension. The threshold stays a constant offset; anchor derivation absorbs per-instance variability.

4. **Fix-along-the-way pattern is load-bearing methodology.** Five instances across Phase 3.2 + Phase 3.3 (notoriety silent-drop SC-6.4c; NPC absence relocate-prefix-bug + forget-repeat-fire-bug SC-7.3; dehydration weather-modulation SC-7.6; world event clock divergence SC-7.7). Each surfaced during prep, resolved via the migration mechanism, durably captured in KNOWN_BUGS archive. Pattern's reliability is established enough that prep-survey work for future structural refactors should explicitly look for production bugs the planned change would naturally subsume.

5. **Vestigial-column cleanup pattern.** When migrating from column-as-source-of-truth to anchor-as-source-of-truth (SC-7.6 survival counter columns), columns can stay as fallback cache rather than requiring schema migration. Bridges legacy data without a drop-column ship. Reusable shape for any future similar migration.

6. **Schema migration as rare exception.** Migration 051 (world events game-day columns, SC-7.7) and Migration 052 (survival_intensity column, SC-7.6.5) were Phase 3.3's only schema changes. Default for behavioral refactors is "no schema migration if avoidable"; both ships were legitimate exceptions where standardization required schema work. Migration 051's backfill semantics ("treat existing events as started today in game-time terms; past stage advances stay baked into current_stage") deserve naming as a real call.

7. **Failure-mode policy from SC-7.1.** Probability-before-handler (failed rolls leave idempotency unrecorded for retry); handler-error containment (logged + surfaced as result; idempotency NOT recorded on error); idempotency-record errors don't degrade handler success (returns success with secondary error flag). Coherent stance on "when something goes wrong inside the abstraction, what behavior survives and what gets surfaced."

8. **Two-step write trade-off.** CONSUMED reset (writeValue + consumeAnchor) and WRITTEN_BACK advance both add a write vs. legacy single-UPDATE. Acceptable for non-hot-path consumers (mood decay and notoriety decay are session-start-only). Flagged as known property of the abstraction for any future hot-path consumer.

9. **Orchestrator-stays-consumer-side pattern.** SELECT scope decisions ("which companions to consider," "which active NPCs the character has met," "which open promises") stay in orchestrator wrappers, not pushed into the abstraction. Mirrors Pattern A's wrapper-around-`adjustStanding` shape.

**Cumulative test surface:** ~1080 assertions across 21 test suites for Phase 3 as a whole; ~251 assertions specifically added by Phase 3.3 across 7 new test files.

**Mechanism-without-UI state at close:** SC-7.6.5 ships the survival intensity column with default `'standard'` for all existing characters. Server-side reads work; threshold consumers respond to intensity changes at runtime. The player cannot yet change the value through the UI. **Phase 3.5 (Settings page) owns the player-facing surfacing of this control alongside two additional controls (kingdom/fortress management level, combat difficulty).** Future readers should not assume the survival intensity feature is reachable from the player's seat at v1.0.162.

**Implications:**
- Phase 3.3 sub-checkpoints are complete; no SC-7.x work remains.
- Phase 3 closes pending the Phase 3 close-out brief.
- Phase 3.5 is the next active phase; spec drafting begins after Phase 3 closure.
- Phase 4 (AI behavior diagnostic) sequences after Phase 3.5.

**Related:**
- `PHASE_3_REFACTOR_SPEC.md` §3.3 (the spec section this closes)
- `triage/pattern-d-survey.md` (Code's survey informing the spec)
- `AI_NARRATIVE_PERSISTENCE.md` Pattern D (the requirements addressed)
- DECISION_LOG entries for SC-1 through SC-5, SC-6.3, SC-6.4 close-out, SC-6.5 closing entry
- `KNOWN_BUGS.md` Resolved archive (5 entries from Phase 3 fix-along-the-way pattern)
- 2026-05-04 DECISION_LOG entry "Phase 3.5: Settings page" (when Phase 3.5 spec drafting begins)

### 2026-05-05 — Phase 3.3 SC-7.6.5: player-tunable survival intensity — runtime-read pattern (Architecture)

**Context:** PM-drafted addendum to Phase 3.3 (spec §3.3.10). Survival mechanics ship the same numbers for every character regardless of campaign tone — gritty survival vs. heroic adventure both get 3+CON-mod days to starvation, 1 day to dehydration. Players have asked for a tonal dial. SC-7.6.5 lands a four-position character setting (`off / lenient / standard / strict`) read at decay/threshold evaluation time so the slider can move mid-campaign without rebuilding consumers. Default `'standard'` for all rows — byte-identical behavior to SC-7.6 for anyone who doesn't change the setting. UI was explicitly deferred (no slider component this ship); the column + server logic ship first so the contract is settled before paint.

**Decisions:**

#### Decision 1 — Read intensity at evaluation time, not at consumer registration

The four intensity positions could have produced four sets of registered consumers (one threshold consumer per intensity per mechanic) and dispatched by intensity at orchestration time. Rejected — that bakes intensity into a static module-load shape and makes mid-session tuning awkward (`registerThresholdConsumer` is module-load, not per-character). Instead: a single set of registered consumers reads the character's `survival_intensity` field inside `repository.readAnchor` and `handler`, computing the intensity-adjusted threshold/multiplier per call.

The runtime-read pattern fits the abstraction's contract cleanly. `readAnchor(contextKey)` already gets the character row in `contextKey.character`; reading one more field (`survival_intensity`) and branching on it is the same shape as reading `con` from `ability_scores` to derive starvation threshold. The handler does the same for hot/cold multipliers. **No abstraction extension needed.**

#### Decision 2 — Off short-circuits via `null` anchor

The "Off" position needed a consumer-side disable. Two options:

- **Skip the consumer call from the wrapper**: `checkStarvation` short-circuits before invoking the consumer when intensity = off.
- **Return `null` from `readAnchor`**: the abstraction's existing null-anchor branch returns `{fired: false, reason: 'no_anchor'}` — the standard "no work to do" path.

Chose **both** (defense in depth). The wrapper short-circuit avoids the round-trip when the higher-level callers can already see the gate. The consumer's null-anchor short-circuit covers the case where someone reaches `STARVATION_THRESHOLD_CONSUMER.checkAndFire()` directly (tests, future call sites). The two paths produce identical observable behavior; there is no race condition because intensity is a property of the character row.

The null-anchor path leverages the abstraction's existing semantics — no new branch added to `timeBoundedState.js`. Consumer-side disables are the abstraction's "natural off switch."

#### Decision 3 — Per-position numbers picked to bracket the design space, not exhaustively tuned

The spec left the specific numbers to Code's discretion. Picked:

- **Starvation thresholds** (added to CON mod, min 1): Lenient 6 / Standard 3 / Strict 2. Standard preserves SC-7.6. Lenient doubles tolerance; Strict tightens by 1 day.
- **Dehydration kick-in days**: Lenient 3 / Standard 1 / Strict 1. Lenient is the only intensity that delays dehydration past day 1; Standard and Strict both kick in immediately (Strict's "harsher" expression is the magnitude, not the timing).
- **Hot multipliers**: Lenient 1.5× / Standard 2.0× / Strict 3.0×. Standard preserves SC-7.6's `hot ? × 2 : × 1` exactly.
- **Cold multipliers** (Strict-only addition): Lenient 1.0× / Standard 1.0× / Strict 1.5×. Standard's 1.0× preserves SC-7.6 byte-identity (cold weather wasn't modulated). Strict gets cold modulation as a Strict-only feature.
- **Dehydration tier magnitudes** ({tier1, tier2}): Lenient {1, 1} (capped, no escalation) / Standard {1, 2} / Strict {2, 2}. Strict skips the soft-tier — day 1 dehydration immediately costs 2 levels.

**Bracketed, not tuned.** The numbers cover roughly 2× spread between Lenient and Strict so the slider has visible effect at every position. Whether 6/3/2 starvation is "right" vs. 5/3/2 or 7/3/2 is a tonal-tuning question that benefits from playtesting. PM can iterate after the slider has user-facing surface in a future ship.

#### Decision 4 — UI explicitly out of scope; PUT enum guards integrity

Spec called out UI as a separate work stream. Code lands the column, server logic, and PUT-allowlist enum guard but no slider component. The PUT allowlist accepts `survival_intensity` only when value matches the four-element enum (`off / lenient / standard / strict`); invalid values silently skip the update so a malformed client can't corrupt the row. SQLite ALTER doesn't support inline CHECK constraints; the migration header documents the intended CHECK shape for a future schema-rebuild ship.

The "settle the contract first, paint later" sequencing matches the chunk-5 creator playbook (data files, then components). When UI lands, it consumes a stable column with a stable enum.

**Implications:**

- **Phase 3.3 is now functionally complete.** Six consumer ports (SC-7.2 through SC-7.7) plus this player-tunable extension. The migration sequence is closed; the remaining work is the §3.3 close-out DECISION_LOG entry (next ship) and Phase 3 close itself.
- **Runtime-read becomes a named pattern** for per-character tunable behavior. SC-7.6.5 is the first instance. Future per-character tunables (e.g., piety decay rate, notoriety sensitivity) can follow the same shape: column on `characters`, helper that reads + validates, threshold-consumer reads inside `readAnchor`. The pattern doesn't extend the abstraction, just exercises it.
- **Byte-identity discipline remains a first-class invariant.** The Standard intensity preserves every observable bit of SC-7.6: same threshold calculation, same hot multiplier, same `'DOUBLE water needs'` message string, same cold no-op. `tests/survival-intensity.test.js` Test 3 validates this explicitly. Lenient/Strict are additive; legacy data path is unchanged.
- **No fix-along-the-way this ship** — survival mechanics are now well-trodden ground after SC-7.6's three-deep audit. Pattern D's fix-along-the-way count stays at 5 (SC-6.4c notoriety, SC-7.3 ×2 NPC absence, SC-7.6 dehydration, SC-7.7 world event clock).

**Related:** [PHASE_3_REFACTOR_SPEC.md](PHASE_3_REFACTOR_SPEC.md) §3.3.10, [server/migrations/052_survival_intensity.js](server/migrations/052_survival_intensity.js), [server/services/survivalService.js](server/services/survivalService.js) (intensity infrastructure block + STARVATION/DEHYDRATION consumer updates), [server/routes/character.js](server/routes/character.js) PUT allowlist enum guard, [tests/survival-intensity.test.js](tests/survival-intensity.test.js).

---

### 2026-05-05 — Phase 3.3 SC-7.7: world event clock standardization — final §3.3 ship + migration + fix-along-the-way #5 (Architecture)

**Context:** Final ship in Phase 3.3's per-system migration sequence (SC-7.2 → SC-7.7). World events were the last consumer not on the `currentGameDay` clock — pre-SC-7.7 they used `new Date()` and ISO timestamp arithmetic for both deadline checks and stage-advance calculations. Pattern D survey §1.12 flagged this as a cross-cutting clock-divergence bug ("two clocks, same name" finding). PM Q10 ruling: fix in Phase 3.3 scope rather than parking.

**Decisions:**

#### Decision 1 — Schema migration with best-effort backfill

Migration 051 adds `started_game_day` and `deadline_game_day` integer columns to `world_events`. The backfill question: how to populate these for legacy events created before the migration? Three options considered:

- **Drop existing events**: clean slate. Rejected — destroys campaign data.
- **Try to derive from `started_at`**: the timestamp is real-time; converting to game-day requires a stable mapping the system doesn't have. Rejected.
- **Set `started_game_day = MAX(game_day)` per campaign**: treats existing events as "started today" in game-time terms. Past stage advances stay baked into `current_stage`; future advances measure from the fresh anchor.

Chose the third. It loses historical fidelity (an event that "really" started 30 game days ago looks like it started today) but preserves the consequential state (current_stage). Going forward, the clock is correct. Acceptable trade-off for a clock-standardization fix where the bug we're solving is forward-looking.

`deadline_game_day` stays NULL for legacy events. The threshold consumer's null-anchor short-circuit ungates them (deadline never fires) — strictly safer than re-firing past deadlines on the new clock.

#### Decision 2 — Threshold consumer for deadline; inline daysSince for stage-advance

The deadline check could have been a simple inline `daysSince(deadline_game_day, currentGameDay) >= 0`, but registering it as `WORLD_EVENT_DEADLINE_THRESHOLD_CONSUMER` keeps the architectural shape consistent with SC-7.5's threshold-crossed cluster. Same SELECT-pre-filter idempotency (orchestrator's `status='active'` filter; abstraction's hasFiredRecently is no-op). Same surface as the other 5 SC-7.5 threshold consumers + SC-7.6's two threshold consumers + this one — 8 threshold consumers in Phase 3.3 total.

Stage-advance stays inline (no consumer wrapper) because it's fundamentally a *current-stage-vs-expected-stage* comparison, not a fire-once-when-crossing-threshold mechanic. The consumer abstraction wouldn't have added value beyond the `daysSince` helper which is already used inline. Right call: don't over-fit the abstraction.

#### Decision 3 — `processEventTick` signature changed from delta to absolute

Was `processEventTick(campaignId, gameDaysPassed = 1)` — the real-time delta isn't useful for game-day-clock work. Changed to `processEventTick(campaignId, currentGameDay = 0)`. Single caller (`livingWorldService.js:94`) updated to pass `MAX(game_day)` per campaign. Default `currentGameDay = 0` on the parameter means any caller that hasn't migrated still works (everything no-ops at currentGameDay=0).

**Implications:**

- **Phase 3.3 per-system migrations are complete.** Six consumer ports (mood SC-7.2, absence cluster SC-7.3, notoriety SC-7.4, threshold cluster SC-7.5, survival SC-7.6, world event SC-7.7) covering all 11 surfaces from the Pattern D survey. The DECAY_SEMANTICS enum has each shape exercised against real production code; the threshold consumer pattern has been used 8 times across the migration cluster (5 in SC-7.5 + 2 in SC-7.6 + 1 here). Phase 3.3's remaining work is SC-7.6.5 (player-tunable survival intensity, PM-drafted next) and the close-out DECISION_LOG entry.
- **Migration 051 is the only schema change in Phase 3.3.** Every other migration has been behavioral (config + handler swaps). The world event clock fix required schema work because the legacy table had no game-day columns to migrate to. Future cleanup ship can drop the now-vestigial `deadline` (TEXT) column; `started_at` (DATETIME) stays in use as a created-at timestamp for ordering queries.
- **Fix-along-the-way pattern reaches 5 instances** in Phase 3: notoriety silent-drop (SC-6.4c), NPC absence relocate-prefix-bug + forget-repeat-fire (SC-7.3 ×2), dehydration weather modulation (SC-7.6), and now world event clock divergence. Each surfaced during prep work for a structural refactor and resolved through the refactor's mechanism. The pattern is methodology, not happy accident — worth naming explicitly in the close-out DECISION_LOG entry.

**Related:** [PHASE_3_REFACTOR_SPEC.md](PHASE_3_REFACTOR_SPEC.md) §3.3.5 SC-7.7 + §3.3.7 SC-7.7, [server/migrations/051_world_event_game_day_columns.js](server/migrations/051_world_event_game_day_columns.js), [server/services/worldEventService.js](server/services/worldEventService.js), [tests/world-event-clock-fix.test.js](tests/world-event-clock-fix.test.js), [KNOWN_BUGS.md](KNOWN_BUGS.md) entry resolved at v1.0.161, Pattern D survey [triage/pattern-d-survey.md](triage/pattern-d-survey.md) §1.12.

---

### 2026-05-05 — Phase 3.3 SC-7.3: NPC absence cluster — stochastic threshold support + dual fix-along-the-way (Architecture)

**Context:** SC-7.3 ports the NPC absence cluster (§1.2 + §1.3 + §1.4 + §1.5 from the Pattern D survey) to the time-bounded state abstraction. Four registrations: two `registerDecayConsumer` instances (disposition + trust, both reading the shared `last_interaction_game_day` anchor) plus two `registerThresholdConsumer` instances (relocation 60d + 10% probability roll; forget 120d deterministic). The §1.5 ABSENCE prompt annotation in `dmPromptBuilder.js:1724-1731` is read-only display — reads the same anchor without going through a decay primitive, no migration needed.

This is the **first exercise of the abstraction's `probability` parameter** (Q8 from the survey, named in SC-7.1 DECISION_LOG entry). Relocation is stochastic — 10% roll per session-start tick when threshold + condition hold. Failed rolls leave idempotency unrecorded; next tick can roll again.

**Three structural decisions:**

#### Decision 1 — Stochastic threshold via `probability` parameter validates Q8

The `probability` parameter shipped in SC-7.1 as a "future-facing extension." SC-7.3 is its first real consumer. Implementation worked as designed: `Math.random() >= probability` short-circuits before the handler runs; failed rolls return `{fired: false, reason: 'probability_roll_failed'}` without recording idempotency. Test coverage forces deterministic random (override `Math.random`) to verify both pass and fail paths.

**Cheaper than a separate primitive.** A "stochastic-threshold-consumer" as its own registration API would have duplicated 90% of the threshold-consumer surface. The optional parameter on the existing API is the right shape — consumer just passes `probability: 0.1` for stochastic, omits it for deterministic.

#### Decision 2 — Dual fix-along-the-way for compound-prefix relocate + repeat-fire forget bugs

Both consumers had **no idempotency** in the legacy code. Discovered during SC-7.3 implementation prep:

1. **Relocation compound-prefix bug** (cosmetic): legacy `checkAbsenceThreshold` rolled 10% every tick. Compound rolls produced `Unknown (left Unknown (left Tavern))` → eventually `Unknown (left Unknown (left Unknown (left Tavern)))`. Probability per consecutive 2 sessions ≈ 1%; long-campaign characters were the only ones likely to hit it.
2. **Forget repeat-fire bug** (perf): once disposition+trust hit 0, the legacy condition (`trust_level < 10`) still held, so forget fired every tick — wasted UPDATE per forgotten NPC per session-start.

Both are resolved by the migration mechanism naturally — the abstraction's `idempotency.hasFiredRecently` callback gives a clean place to encode "have we already fired" via state inspection. Relocate uses location-prefix check (`current_location.startsWith('Unknown (left ')`); forget uses both-zero check (`disposition === 0 && trust_level === 0`). Both are pure post-fire state signatures, no separate audit log needed.

**Named pattern reuse.** Phase 3.2 SC-6.4 close-out named "fix-along-the-way" as a reusable pattern: surface a real bug while doing structural work, resolve through the structural mechanism, document in `KNOWN_BUGS.md` Resolved archive. SC-7.3 is the first reuse — two bugs found + fixed via the same mechanism. Both KNOWN_BUGS entries land at v1.0.157.

This validates the pattern's reach. Future Pattern D migrations (SC-7.4 → SC-7.7) and Phase 4 work should keep the pattern in mind during prep work.

#### Decision 3 — Consumer-side condition checks belong in the handler, not the abstraction

Both threshold consumers have a *condition* gate beyond just elapsed-time-vs-threshold:
- Relocation: `disposition < 0` (only relocate alienated NPCs)
- Forget: `trust_level < 10` (only forget low-trust NPCs)

The abstraction's `checkAndFire` doesn't have a `condition` parameter — adding one would have leaked consumer-specific filtering logic into the abstraction. Instead, the consumer's handler does the condition check internally and returns `{fired: false, reason: 'condition_not_met'}` when it shouldn't fire.

The trade-off: idempotency runs BEFORE the condition check (idempotency is checked by the abstraction; condition is checked by the handler). For relocation, this is fine — if location is already prefixed, idempotency blocks; if condition fails, handler returns no-op. For forget, the both-zero idempotency post-fires — fine because once both are 0, the trust-condition (`<10`) is also satisfied (`0 < 10`), so a re-fire would be a no-op anyway.

**Generalization**: consumer-side handler-level filtering is the right pattern when the filter is per-system specific. Abstraction-level `condition` parameter would be premature generalization (YAGNI). If 3+ consumers ever need the same filter shape, revisit.

**Implementation notes worth recording:**

- **Performance cost ~3x per relationship.** Each per-rel processing now does ~6-10 DB round trips (two readAnchor + two readValue + up to two writeValue + two readAnchor for thresholds + two idempotency reads) vs. legacy's ~2-3 (one SELECT loaded all values; per-rel did 0-2 UPDATEs). For 50 relationships at session start, this is 100-300 extra round trips. Acceptable for session-start (already a heavy operation); flag for any future hot-path consumer.
- **Orchestrator-stays-consumer-side pattern (mirrors SC-7.2).** `processAbsenceEffects` SELECTs eligible relationships, iterates, calls each consumer's `applyDecay` / `checkAndFire`. Scope decision (which relationships to process — alive NPCs the character has met) stays in the orchestrator, not pushed into the abstraction.
- **Spec literal "one threshold consumer" interpreted liberally.** Spec §3.3.5 SC-7.3 says "one threshold consumer" but the absence cluster has two distinct threshold-crossing patterns (relocate + forget). Migrating both as separate registrations is more consistent than leaving forget inline. The literal count interpretation would have left forget unmigrated — clearer to follow the spirit.

**Implications:**

- **Pattern D migration cadence validated against second consumer.** SC-7.2 was a single-decay consumer with CONSUMED semantics. SC-7.3 stress-tests dual-decay-from-one-anchor + stochastic threshold + idempotency-as-fix-mechanism. The abstraction handled all three without API extensions — three registrations, four consumers, no new primitives. Foundation is healthy.
- **SC-7.4 (notoriety) is next.** Validates WRITTEN_BACK semantics — anchor advances after each tick (vs. SC-7.2's CONSUMED and SC-7.3's HIGH_WATER_MARK). Three semantics, three migration ships. Pattern D's three-shape design from SC-7.1 is fully exercised after SC-7.4.

**Related:** [PHASE_3_REFACTOR_SPEC.md](PHASE_3_REFACTOR_SPEC.md) §3.3.5 SC-7.3, [server/services/npcAgingService.js](server/services/npcAgingService.js), [tests/npc-absence-cluster.test.js](tests/npc-absence-cluster.test.js), [KNOWN_BUGS.md](KNOWN_BUGS.md) Resolved archive (two new entries at v1.0.157), DECISION_LOG entry 2026-05-05 SC-6.4 close-out (named the "fix-along-the-way" pattern).

---

### 2026-05-05 — Phase 3.3 SC-7.1: time-bounded state primitives — parameterize, don't converge (mirroring §3.1 SC-1's call) (Architecture)

**Context:** SC-7.1 ships the foundation for Phase 3.3 (Pattern D / time-bounded state primitives). Per spec §3.3.5, the same shape as §3.1's SC-1: ship the abstraction, gate on API review, then migrate consumers one at a time across SC-7.2 → SC-7.7. New module: `services/timeBoundedState.js` exporting three primitives (`daysSince`, `registerDecayConsumer`, `registerThresholdConsumer`).

The Pattern D survey (`triage/pattern-d-survey.md`, 2026-05-04) found 11 time-bounded state surfaces with five storage shapes (own-column anchor, dual-column counter+anchor, JSON-blob entry field, structured-row with implicit fallback, real-time string) and four behavior shapes (decay-on-read, threshold-with-effect, stage-advance-on-elapsed, round-bounded session-only). The decision facing SC-7.1 was the same one that opened §3.1's SC-1: **converge the storage shapes into one abstraction-owned schema, or parameterize the abstraction to accommodate divergent storage**.

**Decision: parameterize, don't converge.** Same call as §3.1 SC-1 (DECISION_LOG entry 2026-05-03 Call 1). Each consumer keeps its own anchor column, its own decay function shape, its own idempotency strategy. The abstraction provides the orchestration shell (read → compute → clamp → write); the consumer's `repository` callbacks own storage and the consumer's config functions own the per-system shape decisions.

**Why the same call as Pattern A:**

- **Storage divergence is intentional, not accidental.** NPC absence's `last_interaction_game_day` is denormalized for prompt-builder reads (§1.5 ABSENCE annotation). Notoriety's `last_decay_game_day` is a "last time we ticked" marker, not "last time the event occurred" — different semantics on a similar-looking column. Companion mood's `mood_set_game_day` NULLs at floor — yet a third semantics. Forcing convergence would erase real per-system meaning.
- **Pattern A's repository-callback pattern is a proven shape.** Across SC-2 through SC-5, five standing-scalar consumers migrated to `adjustStanding(config, contextKey, change)` with their own repository.readScore/writeScore/appendAuditEntry. The pattern stress-tested under five consumer divergences (single-scalar, dual-scalar, composite contextKey, separate-table audit, JSON-blob storage). Pattern D's repository callbacks reuse the same shape: `readAnchor / readValue / writeValue` plus semantics-specific `consumeAnchor / advanceAnchor`.
- **YAGNI on convergence.** No consumer has surfaced a need for cross-system queries. Storage convergence would be cost without benefit.

**Three primitives shipped:**

1. **`daysSince(anchorGameDay, currentGameDay)`** — normalized arithmetic helper. Replaces ~20 sites of inline `currentGameDay - someAnchor` arithmetic identified by the survey. Returns null when either arg is null (explicit "no anchor" semantics); returns max(0, elapsed) otherwise (game-day-rollback safety). Per Q11, a future hour-granularity grow would add a unit parameter without breaking call sites.

2. **`registerDecayConsumer(config)`** — decay-on-read consumer factory. Accepts a config with `decayFunction`, `floor`/`ceiling` clamps, `repository` callbacks, and a `semantics` enum distinguishing the three observed behavior shapes:
   - `HIGH_WATER_MARK` (default) — anchor stays put across ticks (NPC disposition / trust)
   - `CONSUMED` — anchor NULLs when value reaches floor (companion mood)
   - `WRITTEN_BACK` — anchor advances to currentGameDay after each tick (notoriety)
   
   Each consumer specifies its semantics; the abstraction dispatches to semantics-specific anchor handling post-decay. Each semantics requires the corresponding repository callback (`consumeAnchor` for CONSUMED, `advanceAnchor` for WRITTEN_BACK); missing callbacks log a warn but don't crash.

3. **`registerThresholdConsumer(config)`** — threshold-crossed-with-effect consumer factory. Accepts a config with `threshold` (in days), `handler`, `idempotency` callbacks, and an optional `probability` parameter for stochastic crossers (Q8 — first exercise in SC-7.3 NPC relocation 10% roll). Idempotency strategy is consumer-owned via `hasFiredRecently` / `recordFired` callbacks — accommodates the three observed strategies (anchor-written-back-post-fire, separate-audit-log-check, status-field-comparison) without picking one.

**Three secondary design decisions worth recording:**

- **Probability roll happens BEFORE handler.** Failed rolls leave idempotency unrecorded — next tick can roll again. This matches the legacy NPC relocation behavior (10% chance every absence tick until the relocation lands).
- **Handler errors are CONTAINED, not propagated.** Logged via `console.error`; surfaced in the `checkAndFire` return as `{fired: false, reason: 'handler_error', error}`. Mirrors §3.1 SC-1's threshold-handler-error containment policy. Idempotency NOT recorded on handler error (allows retry).
- **Idempotency-record errors don't degrade handler success.** If `recordFired` throws after the handler ran successfully, the return is `{fired: true, handlerResult, idempotencyError}` rather than rolling back. Reasoning: the handler's side effect already landed; flagging the idempotency-record failure is more useful than pretending the handler didn't run.

**Implications:**

- **Pattern D migration sub-checkpoints can now begin** (SC-7.2 → SC-7.7 per spec §3.3.5). Companion mood (SC-7.2) is the first port — validates the CONSUMED semantics. NPC absence cluster (SC-7.3) validates dual-decay-from-one-anchor + first stochastic threshold. Notoriety (SC-7.4) validates WRITTEN_BACK semantics. Threshold-crossed cluster (SC-7.5) batches 4 deterministic threshold consumers. Survival timer cleanup (SC-7.6) cleans the redundant counter columns. World event clock fix (SC-7.7) standardizes §1.12's real-time clock to game-day.
- **Pattern A and Pattern D compose naturally.** A standing-scalar with decay (NPC disposition) becomes the SC-7.3 path: registerDecayConsumer's repository.writeValue calls into adjustStanding's repository, OR adjustStanding becomes one consumer of the decay primitive. The exact composition shape lands when SC-7.3 implements; the API surfaces don't conflict.
- **Pattern A precedent extends to Pattern D.** The "behavior abstraction without storage convergence" decision from 2026-05-03 was validated across 5 standing-scalar consumers in Phase 3.1. Phase 3.3's first call reuses the same reasoning. Future framework-shaped abstractions (Pattern C re-meeting, Pattern F long-term campaign history) should default to the same shape unless evidence justifies divergence.

**Tests:** 69 assertions in `tests/time-bounded-state.test.js` covering `daysSince` (null/clamp/edge cases), config validation for both registration APIs (catches malformed configs early via `expectThrow`), three decay semantics divergence (high-water-mark / consumed / written-back), floor/ceiling clamping with no-op-on-clamp behavior, threshold + idempotency + probability + handler-error containment, empty-state safety. All Phase 3 prior suites still green (12 suites + faction-quests).

**Related:** [PHASE_3_REFACTOR_SPEC.md](PHASE_3_REFACTOR_SPEC.md) §3.3, [triage/pattern-d-survey.md](triage/pattern-d-survey.md), [server/services/timeBoundedState.js](server/services/timeBoundedState.js), [tests/time-bounded-state.test.js](tests/time-bounded-state.test.js), DECISION_LOG entry 2026-05-03 Call 1 (parameterize-not-converge for §3.1 standing-scalar — the precedent).

---

### 2026-05-05 — Phase 3.2 closing: marker pipeline consolidation complete — schemas + handlers are the canonical path, detect-function sprawl is legacy (Architecture)

**Context:** Phase 3.2 ("marker pipeline consolidation," PHASE_3_REFACTOR_SPEC.md §3.2) ran across 5 sub-checkpoints with 7 actual ships:
- **SC-6.1** (v1.0.144, batched with SC-1) — pipeline foundation: `markerPipeline.js` with `registerHandler` / `processResponseMarkers` / `buildPendingCorrectionsNote`. NO handlers registered at ship; behavior unchanged. Validated via the integration in SC-2.
- **SC-6.2** (interleaved with SC-3 / SC-4 / SC-5) — standing-scalar marker migrations. Not a separate ship; per-system handlers landed alongside their abstraction migrations (SC-3 had no marker; SC-4 registered PIETY_CHANGE; SC-5 registered BOND_SHIFT). First two production handler call sites (PIETY_CHANGE + BOND_SHIFT) deleted from route handlers.
- **SC-6.3** (v1.0.149) — Prelude marker port: 19 prelude markers added to `MARKER_SCHEMAS` schema-only (parked from independent dispatch). Established the "schemas without handlers" precedent with two rationales (ordering invariants, aggregated returns). Correction-loop feedback active for prelude markers — capability that didn't exist before.
- **SC-6.4** (v1.0.150 / .151 / .152 / .153 — four ships) — detect-function sprawl sweep: 22 markers migrated to handlers across 13 service files; 2 schema-without-handler additions (SWIM, ADD_ITEM); 5 PARK ENTIRELY rulings; ~580 lines deleted from `routes/dmSession.js`. See SC-6.4 close-out entry below for cluster-level detail.
- **SC-6.5** (v1.0.154 — this ship) — documentation closing. `markerSchemas.js` header reflects canonical role; `CLAUDE.md` "DM session markers + marker pipeline" section landed with the four-rationale schemas-without-handlers category as **intentional design** (not reverse-engineered); this consolidated entry.

**Phase 3.2's whole story in one frame:**

The marker landscape pre-Phase-3.2 had two parallel pipelines that didn't know about each other: (a) a schema-driven validation system (`markerSchemas.js` + `ruleVerifiers.js` + correction-loop) that didn't drive side effects; (b) a sprawl of ~28 ad-hoc `detectXxx()` functions in `dmSessionService.js` that did drive side effects but lacked validation. The migration's job was to elevate (a) to canonical status, fold (b)'s side-effect dispatch into the pipeline as registered handlers, and document the legitimate exceptions.

Five sub-checkpoint summary numbers (post all Phase 3.2 work):
- **39 markers in MARKER_SCHEMAS** with schema validation + correction-loop feedback active (player-mode + DM-mode + prelude)
- **24 handlers registered across 13 service files** dispatching real production side effects via `processResponseMarkers`
- **22 detect-function call sites deleted** from `routes/dmSession.js` (~580 lines); 6 deleted from `routes/dmMode.js` (BOND_SHIFT migration); 1 deleted from `routes/dmSession.js` (PIETY_CHANGE migration in SC-4)
- **2 new single-purpose service files** created when handlers didn't co-locate naturally: `lootDropService.js` (SC-6.4b), `combatMarkerService.js` (SC-6.4d). Sets the precedent: when a handler doesn't have an obvious existing consumer, a thin marker-handler module is the right placement.
- **5 PARK ENTIRELY rulings** for non-marker functions (`detectDowntime`, `detectRecruitment`, three utility helpers)
- **1 production bug discovered + fixed via the migration mechanism** (notoriety silent-drop, headlined v1.0.152 — see "fix-along-the-way" pattern in SC-6.4 close-out)

**Three principles validated by Phase 3.2:**

1. **Foundation-first sub-checkpoint cadence works.** SC-6.1 shipped the pipeline with zero behavioral change — pure API foundation. SC-6.2 / SC-6.4 then drove 24 production handlers through it without touching the foundation again. The "lay the foundation, ship it, prove it carries load through subsequent migrations" approach is reusable for future structural work where the API design is the dominant unknown.

2. **Schemas-without-handlers is a first-class end-state, not a half-done migration.** The category accreted four legitimate rationales across SC-6.3 / SC-6.4a / SC-6.4b. Each rationale is principled — "the structural shape of this marker doesn't fit per-handler dispatch, and the schema's correction-loop feedback is itself a full win." Future work should reach for this category confidently rather than treating it as an acknowledgment of incomplete migration.

3. **Schema-direction is a per-marker call.** SC-6.3 tightened (prelude schemas required canonical field names; legacy aliases stayed in detect-functions). SC-6.4b relaxed (MERCHANT_COMMISSION schema gained sp/cp denominations + Description to preserve legacy detect-tolerance). Both are legitimate. Default: relax for behavior-preservation; tighten only when the prompt is already canonical and the looser form is undocumented.

**The "fix-along-the-way" pattern** (named in SC-6.4 close-out, surfaced in SC-6.4c) is the most reusable artifact from Phase 3.2. The notoriety silent-drop bug existed in production for an unknown duration; the SC-6.4 prep survey surfaced it; the migration mechanism resolved it as a side effect; documentation closed it durably in `KNOWN_BUGS.md` Resolved archive. Future structural work — Phase 3.3 (Pattern D), Phase 4 (AI behavior diagnostic), Phase 6 (schema migrations) — should look for this pattern when prep-survey work surfaces production bugs the planned structural change happens to subsume.

**Implications for forward work:**

- **Phase 3.3 (Pattern D / time-bounded state primitives, spec §3.3 locked)** is the next major Phase 3 surface. SC-7.1 (foundation) is unblocked. The Phase 3.2 cadence (foundation → migration sub-checkpoints → docs closing) is the recommended template.
- **Phase 5+ marker content additions** can land cleanly on the Phase 3.2 infrastructure. Adding a `[DOWNTIME]` marker (deferred from SC-6.4 per spec §3.5 "no new markers in Phase 3.2"), or marker layers for Themes / Party Synergies, are now a schema-add-and-handler-register operation rather than a route-handler-edit.
- **The Anthropic tool-use migration** (when it arrives) will reuse `MARKER_SCHEMAS` directly as tool definitions — no rewrite of the schema definitions needed. The pipeline becomes the bridge between tool-call dispatch and consumer-service side effects.

**Related:** [PHASE_3_REFACTOR_SPEC.md](PHASE_3_REFACTOR_SPEC.md) §3.2 + §3.4 + §3.9, [server/services/markerSchemas.js](server/services/markerSchemas.js) header, [server/services/markerPipeline.js](server/services/markerPipeline.js), [CLAUDE.md](CLAUDE.md) "DM session markers + marker pipeline" section, SC-6.4 close-out entry below.

---

### 2026-05-05 — Phase 3 SC-6.4 close-out: detect-function sweep complete (4 ships, 21 markers migrated, 4 structural findings, "fix-along-the-way" named as a pattern) (Architecture)

**Context:** SC-6.4 is Phase 3.2's "detect-function sprawl survey + selective migration" sub-checkpoint. Per the Q6 survey (PM-authored 2026-05-04, filed at `triage/q6-detect-function-survey.md`): 28 detect-functions in `dmSessionService.js` categorized into 22 MIGRATE / 1 SCHEMA-WITHOUT-HANDLER / 5 PARK ENTIRELY (the latter two adjusted from initial 22/2/4 split after PM ruling on `detectDowntime`).

After cluster-1 sizing surfaced significant per-cluster review/documentation surface area (cluster 2 merchant response-payload coupling; cluster 3 notoriety silent-drop bug discovery; cluster 4 mythic trial composition finding), PM and Code agreed (2026-05-05) to split SC-6.4 into four ships:
- v1.0.150 SC-6.4a — survival + crafting cluster (10 markers)
- v1.0.151 SC-6.4b — merchant cluster (5 markers)
- v1.0.152 SC-6.4c — promise + notoriety cluster (4 markers, headlines notoriety silent-drop bug fix)
- v1.0.153 SC-6.4d — combat / mythic / base-defense cluster (6 markers) + this consolidated entry

**Final tally (post all four ships):**
- **MIGRATE → handler registered**: 24 markers across 13 service files (1 already migrated in SC-4: PIETY_CHANGE; 1 in SC-5: BOND_SHIFT; 22 across SC-6.4a/b/c/d).
- **SCHEMA-WITHOUT-HANDLER**: 21 markers — 19 prelude markers (SC-6.3 collective parking) + SWIM (SC-6.4a, no side-effect target) + ADD_ITEM (SC-6.4b, orchestrated by sibling).
- **PARK ENTIRELY**: 5 functions — `detectDowntime` (player input not AI marker), `detectRecruitment` (free-text fallback for unstructured AI prose), `estimateEnemyDexMod` (utility helper), `parseMarkerPairs` + `parseMarkerKeyValue` (shared parsing utilities).

**Structural decisions consolidated from the four ships:**

#### Decision 1 — "Schemas without handlers" precedent now has four distinct rationales

The category was introduced in SC-6.3 (prelude markers) as "ordering invariants make handler dispatch infeasible." Across SC-6.4 it accreted three more legitimate rationales:

1. **Ordering invariants** (SC-6.3) — all 19 prelude markers. The orchestration order between markers (`AGE_ADVANCE → HP_CHANGE`, `CANON_FACT_RETIRE → CANON_FACT`, `CHAPTER_PROMISE → AGE_ADVANCE`) doesn't fit per-handler dispatch where the pipeline iterates in `Object.keys(MARKER_SCHEMAS)` order.
2. **Aggregated returns** (SC-6.3) — same 19 prelude markers. The route handler's HTTP response payload combines per-marker results into one structured object that the per-handler `handlerResults` array doesn't naturally produce.
3. **No side-effect target** (SC-6.4a, SWIM) — schema validation buys correction-loop feedback, but there's no consumer service function to register a handler against. The legacy detect was exported but never invoked.
4. **Orchestrated-with-sibling-marker** (SC-6.4b, ADD_ITEM) — the legacy code processed ADD_ITEM markers ONLY in the context of a sibling MERCHANT_SHOP marker. Migration folded ADD_ITEM processing into the MERCHANT_SHOP handler internally; ADD_ITEM keeps schema for correction-loop validation but doesn't dispatch independently.

**Implication**: "Schemas without handlers" is a first-class end-state, not an admission of incomplete migration. Future SC-7+ work can reach for it confidently when one of these rationales applies.

#### Decision 2 — Schema-relaxation as a legitimate migration pattern

SC-6.3 established the *alias-tightening* pattern: prelude schemas required canonical field names; legacy detect-functions stayed legacy-tolerant. SC-6.4b introduced the opposite — *schema-relaxation*: MERCHANT_COMMISSION's `Price_GP` min relaxed from 1 to 0, plus optional `Price_SP / Price_CP / Deposit_SP / Deposit_CP / Description` fields added. This preserves the legacy detect-function's tolerance for mixed-denomination prices and free-text descriptions, keeping the migration behavior-neutral rather than tightening the AI-facing contract as a side effect.

**Both directions are legitimate.** The choice is per-marker:
- **Tighten** (SC-6.3 prelude aliases) when the migration is also a contract-cleanup opportunity and the canonical form is documented in the system prompt.
- **Relax** (SC-6.4b MERCHANT_COMMISSION) when the migration should land neutral and the legacy tolerance has real production usage.

PM and Code own the per-marker call. Default: relax for behavior-preservation; tighten only when the prompt is already canonical and the relaxed form is undocumented.

#### Decision 3 — Pipeline `context.narrative` extension enables self-orchestrating handlers

SC-6.4b extended the marker pipeline's per-call context to include `narrative` (the AI response text). This lets a handler walk the narrative for sibling markers via `extractMarkerBodies` + `parseMarkerBody` — used by MERCHANT_SHOP to internally process coupled ADD_ITEM markers without requiring per-marker pipeline dispatch order or cross-handler shared state. The mechanism is what makes Decision 1's "orchestrated-with-sibling-marker" category work cleanly.

**API addition**: `processResponseMarkers(narrative, context)` now passes `context.narrative` to each handler invocation. Used by 1 handler this phase (MERCHANT_SHOP); available to future handlers needing the same coupling shape.

#### Decision 4 — "Fix-along-the-way" as a named pattern (notoriety silent-drop)

During SC-6.4 prep work (spot-checking the survey's "alternative parser" PM call against the actual code), Code surfaced a real production bug: `[NOTORIETY_GAIN]` and `[NOTORIETY_LOSS]` markers emitted in the canonical prompt-instructed format (quoted, space-separated) were silently dropped by the legacy `parseMarkerKeyValue` (comma-separated only). Heat never accumulated; AI narrative drifted from DB state.

Resolution path: the SC-6.4c migration replaced the detect-call with a handler backed by `markerSchemas.js`'s `extractField` regex, which natively handles both quoted-space-sep and comma-sep formats. **The migration mechanism itself fixed the bug as a side effect.** No standalone fix ship; no separate diagnostic. Documented in `KNOWN_BUGS.md` Resolved archive entry; headlined in v1.0.152 CHANGELOG above the cluster migration entry.

**Naming the pattern**: "fix-along-the-way" — surface a real bug while doing structural work, resolve it through the structural mechanism, document in `KNOWN_BUGS.md` archive. The pattern is reachable for future refactor work when the same conditions hold:
- The structural change naturally subsumes the bug's failure mode (no incidental coincidence)
- The fix doesn't require a separate review gate (the structural change is already reviewed)
- The bug discovery is durably captured (KNOWN_BUGS archive entry, not just a CHANGELOG mention)

Future Phase 3.3 + Phase 4 work should look for this pattern when prep-survey work surfaces production bugs that the planned structural change happens to subsume.

**Other notable findings (not promoted to structural decisions but worth recording):**

- **detectDowntime PARK ENTIRELY ruling**: initial Q6 survey draft proposed adding a `[DOWNTIME]` marker. PM ruling 2026-05-05 reversed: `detectDowntime` operates on player input (not AI narrative), is fundamentally a player-input classifier rather than a marker detector. Adding a `[DOWNTIME]` marker would be NEW marker semantics, which spec §3.5 excludes from Phase 3.2. Deferred as a clean Phase 5+ candidate when new marker content is in scope.
- **detectMythicTrial composition correction**: Q6 survey draft hypothesized a trial→piety cascade. Code dig confirmed `recordTrial` does NOT touch piety — increments `trials_completed` only. `canAdvance` triggers `advanceTier` (also no piety). Mythic trials and mythic piety are independent paths under the mythic umbrella. Migration in SC-6.4d is structurally clean; no abstraction-bypass risk.

**Cumulative SC-6.4 thinning of `routes/dmSession.js`:**
- Cluster 1 (v1.0.150): ~113 lines deleted
- Cluster 2 (v1.0.151): ~190 lines deleted
- Cluster 3 (v1.0.152): ~135 lines deleted
- Cluster 4 (v1.0.153): ~145 lines deleted
- **Total: ~580 lines** of inline marker dispatch logic moved out of the route handler into consumer services.

**Test surface added in SC-6.4** (cumulative across the 4 ships): 193 new schema/handler/snapshot assertions across 4 test files. All prior Phase 3 suites (10 pre-SC-6.4 + faction-quests) remain green throughout.

**Phase 3.2 (marker pipeline consolidation) is now complete.** SC-6.5 (documentation closing entry) is the remaining sub-checkpoint — `markerSchemas.js` header docs reflecting canonical role + `CLAUDE.md` model split + closing DECISION_LOG entry per spec §3.9.

**Implications:**

- **`dmSessionService.js` is materially thinner.** ~21 detect-functions still exported (per "deprecate by hiding nav") but none invoked from the production route. The file's role is now legacy-tolerance for old transcripts + utility helpers (parseMarkerPairs, parseMarkerKeyValue, estimateEnemyDexMod) + the still-active `detectDowntime` + `detectRecruitment` functions which weren't marker-pattern detectors.
- **The marker pipeline is the canonical path.** `processResponseMarkers` now drives 24 handlers across 13 service files. Schema validation + correction-loop feedback active for all 39 markers in MARKER_SCHEMAS.
- **Three new single-purpose service files were created during SC-6.4** to host handlers for markers without an obvious existing consumer: `lootDropService.js` (SC-6.4b — character-inventory mutation for AI-driven drops), `combatMarkerService.js` (SC-6.4d — initiative orchestration). These set the precedent: when a handler doesn't naturally co-locate with an existing service, a new single-purpose marker-handler module is the right placement.
- **Pipeline foundation laid in SC-6.1 has now driven 24 production handlers** across the four cluster ships. The "no behavioral change at ship; full integration as consumers migrate" approach from SC-1+SC-6.1 batch is fully validated.

**Related:** [PHASE_3_REFACTOR_SPEC.md](PHASE_3_REFACTOR_SPEC.md) §3.2 + §3.4 + §3.9, [triage/q6-detect-function-survey.md](triage/q6-detect-function-survey.md), [KNOWN_BUGS.md](KNOWN_BUGS.md) Resolved archive, CHANGELOG entries v1.0.150–v1.0.153.

---

### 2026-05-04 — KNOWN_BUGS.md created (Direction)

**Context:** Phase 3 Pattern D survey surfaced a real bug (worldEventService.js using real-time clock instead of game-day clock per §1.12 of triage/pattern-d-survey.md). The bug was being weighed for inclusion in §3.3 scope vs. deferral to a later phase. PM and user realized during the discussion that there was no canonical place in the project to track *known but deferred bugs* — `FUTURE_FEATURES.md` is for designed-but-deferred features; `triage/` is for active investigations; `DECISION_LOG.md` is for decisions; `CHANGELOG.md` is for shipped work. Bugs that get noticed but deliberately deferred had nowhere to live durably.

**Decision:** Add `KNOWN_BUGS.md` at repo root. Tracks bugs that are real and reproducible but not currently being fixed. Distinct from FUTURE_FEATURES (features), triage/ (investigations), DECISION_LOG (decisions), CHANGELOG (shipped). Each entry specifies failure mode, code location, severity, deferral rationale, trigger to revisit, and fix shape if known.

**Why:**
- Bug-shaped issues that get surfaced during work on something else (Code surveys, audits, conversations) need a place to land. Otherwise they vanish into "I'll remember it" — and don't get remembered.
- Without this file, deferring a bug fix means either inventing a parking lot ad-hoc or hand-waving toward triage/. Neither is durable.
- Initial example: Phase 3 Pattern D survey surfaced the world event clock bug. That specific bug was absorbed into SC-7.7 (active fix in Phase 3), but it would have been the file's seed entry if deferred. Future work will surface deferred bugs that need this file.

**What this isn't:**
- Not a Jira/issue-tracker. Lightweight markdown, paste-and-grow, same shape as FUTURE_FEATURES.
- Not for active investigations (those stay in triage/).
- Not for shipped fixes (those go in CHANGELOG; once a bug is fixed it moves to KNOWN_BUGS' archive section with its ship version).

**Implications:**
- Code can surface deferred bugs during sub-checkpoint work by adding entries.
- PM can use the file for periodic review — bugs that have aged in the file long enough may warrant active fix scheduling.
- Severity definitions in the file's header set a basic triage shape (cosmetic / functional / data-integrity / blocker).

**Related:**
- `KNOWN_BUGS.md` (the file itself)
- `triage/pattern-d-survey.md` §1.12 (the bug that prompted the file)
- `PHASE_3_REFACTOR_SPEC.md` §3.3 SC-7.7 (where the seed bug got absorbed instead of deferred)
- `FUTURE_FEATURES.md` (the related "designed-deferred" file)
- `CONSOLIDATED_TODO.md` parking lots (the closest existing structure for deferred work)

### 2026-05-04 — Phase 3 SC-6.3: Prelude marker pipeline port — schemas without handlers, ordering invariants force consumer-side dispatch, correction-loop is the real win (Architecture)

**Context:** SC-6.3's spec mandate (PHASE_3_REFACTOR_SPEC.md §3.9) requires every Prelude marker to either get a schema+handler pair, or be documented as parked. The Prelude has 19 markers (a third more than the player-mode pipeline) handled today by `preludeMarkerDetection.js`'s 19 detect functions, dispatched from `preludeSessionService.processMarkersForSession`. Three structural concerns conflict with naive per-marker pipeline dispatch:

1. **Ordering invariants** — `AGE_ADVANCE` writes `prelude_age` + `prelude_chapter` + `max_hp` + `current_hp`. `HP_CHANGE` reads `max_hp` for clamping. `CHAPTER_PROMISE` rejects when `prelude_chapter === 1`. `CANON_FACT_RETIRE` must run before `CANON_FACT` (per the explicit code comment) so a same-turn retire doesn't immediately clear a same-turn record. The pipeline's `processResponseMarkers` iterates `validByKey` in `Object.keys(MARKER_SCHEMAS)` order — same-turn ordering can be partially controlled but is fragile.

2. **Aggregated returns** — `processMarkersForSession` returns one object combining `npcsCreated`, `locationsCreated`, `canonFactsAdded`, `canonFactsRetired`, `offeredEmergences`, `capViolations`, `chapterPromise`, `themeCommitmentOffer`, `preludeEnd`, `nextSceneWeight`, etc. The route handler's HTTP response payload (`POST /api/prelude/session/:id/message`) flattens these into the response. Per-marker pipeline handlers would write into `handlerResults`, not into a single aggregate object — the route handler would have to walk `handlerResults` to reconstitute the same shape, which is more work than the migration buys.

3. **Cross-marker shared state** — multiple markers in one turn read `await getPreludeCharacter(characterId)` snapshots and act on values that earlier-in-the-turn handlers may have just mutated. Per-handler dispatch means each handler does its own load — the snapshots can drift mid-turn. Not catastrophic (each handler is defensive about state) but a behavior change versus the current single-load pattern.

**Decision:** All 19 prelude markers get **schemas in `MARKER_SCHEMAS`**. ZERO handlers registered. Side-effect dispatch stays consumer-side via `processMarkersForSession` + `detectPreludeMarkers`. The pipeline's contribution is **correction-loop feedback ONLY** — when the AI emits a malformed prelude marker, the next prompt gets a `[SYSTEM]` note (a feedback channel that didn't exist for prelude markers before SC-6.3).

The 19 schemas:
- **Standard field-extracted markers** (15): `AGE_ADVANCE`, `CHAPTER_END`, `SESSION_END_CLIFFHANGER`, `NPC_CANON`, `LOCATION_CANON`, `HP_CHANGE`, `CHAPTER_PROMISE`, `STAT_HINT`, `SKILL_HINT`, `CLASS_HINT`, `THEME_HINT`, `ANCESTRY_HINT`, `CANON_THREAD`, `CANON_FACT`, `CANON_FACT_RETIRE`, `DEPARTURE`. Required/optional/enum/min/max all encoded per the canonical form documented in each detect function.
- **Presence-only markers** (3): `THEME_COMMITMENT_OFFERED`, `NEXT_SCENE_WEIGHT`, `PRELUDE_END`. Use `fields: {}` — the parseMarkerBody field-extractor doesn't fit their bareword/free-text bodies; the detect functions do their own value extraction. Schema confirms presence; the detect function extracts the value.
- **Backward-compat aliases not in schema**: `CLASS_HINT.class_id=`, `THEME_HINT.theme_id=`, `ANCESTRY_HINT.feat=`, `CANON_FACT_RETIRE.contains=`. The schemas require the canonical form (`class=`, `theme=`, `feat_id=`, `fact_contains=`). The detect functions still accept the aliases for legacy transcript compatibility. Intentional asymmetry: schemas tighten the AI-facing contract; detect-functions stay legacy-tolerant.

**Wired in `preludeSessionService.sendMessage`:**
- After `processMarkersForSession`, run `validateDmMarkers(result.response)` to capture failures
- Stash `buildCorrectionMessage(failures)` to `session_config.pendingMarkerCorrections` — same key the player-mode pipeline uses
- Before next prompt, read `pendingMarkerCorrections`, push as a `user`-role injected message (matches the existing `pendingCapFeedback` / `pendingViolationNote` patterns)
- Defensive try/catch — validation failures never block the message-flush flow

**Why:**

- **Schemas-without-handlers honors the spec's "parked or migrated" criterion.** The spec acceptance criteria allow either; a schema-only addition is "parked from handler dispatch" with the rationale documented. The detect-function corpus stays in place because handler dispatch doesn't fit prelude's design today. SC-6.4 (detect-function survey) can revisit when a generic dispatch pattern emerges.

- **Correction-loop feedback is a real, missing capability for prelude.** Today, malformed prelude markers silently fail in their detect functions (regex doesn't match → returned as null/empty array → ignored). The AI never learns the marker was malformed. SC-6.3 closes this gap: same `[SYSTEM]` note injection pattern as player-mode means the AI gets explicit field-targeted corrections. This is the SC-6.3 ship's actual UX win.

- **Ordering-driven dispatch is consumer-side knowledge.** The standing-scalar abstraction's lesson generalizes: behavior that depends on consumer-specific shape (here: ordering invariants between specific marker pairs) belongs at the consumer, not in the abstraction. The pipeline owns parsing + validation + correction; the consumer owns side-effect orchestration. Same split as standing-scalar's behavior-vs-storage split.

- **Backward-compat alias asymmetry is intentional.** Schemas codify the canonical form; detect functions tolerate legacy aliases. New AI emissions will be nudged toward canonical via the correction-loop; old transcripts (replayed via the chronicles loader) still work. This matches the codebase's "deprecate by hiding nav, not deleting code" pattern for content that may exist in legacy state.

**Implications:**

- **Player-mode pipeline now schema-validates 38 markers**: 14 player-mode + 5 standing-scalar + 19 prelude. (Adding prelude schemas means a player-mode session that emits a prelude marker — which shouldn't happen but isn't prevented — would also get validated. Since the player-mode AI doesn't emit prelude markers, this is harmless and slightly defensive.)

- **SC-6.4 can survey the detect-functions with sharper criteria.** The spec frames SC-6.4 as "survey + selective migration" — the SC-6.3 parking decision establishes the precedent that "schemas without handlers" is a legitimate end-state. Detect-functions in `dmSessionService.js` that are similarly entangled with ordering/aggregation can park identically. This makes SC-6.4 a content question (which functions to migrate) rather than a methodology question (how to migrate).

- **Two markers fully owned by handlers (`[PIETY_CHANGE]` SC-4, `[BOND_SHIFT]` SC-5); 19 markers schema-validated but parked from handler dispatch (SC-6.3); ~26 detect-functions still in `dmSessionService.js` awaiting SC-6.4 survey.** This is the post-SC-6.3 state of the marker pipeline.

- **No prelude detect functions removed.** Per the parking decision, all 19 stay in `preludeMarkerDetection.js`. The acceptance-criteria phrase "preludeMarkerDetection.js ad-hoc functions removed for migrated markers" applies vacuously (zero markers migrated to handlers).

- **The `pendingMarkerCorrections` key is now shared across both pipelines** — player-mode and prelude both write to the same `session_config.pendingMarkerCorrections` field. Sessions are scoped per `session_type` so there's no cross-pollution risk; the shared key just means the pattern is uniform.

**Related:** [PHASE_3_REFACTOR_SPEC.md](PHASE_3_REFACTOR_SPEC.md) §3.4 + §3.9, [server/services/markerSchemas.js](server/services/markerSchemas.js), [server/services/preludeSessionService.js](server/services/preludeSessionService.js), [tests/prelude-marker-schemas.test.js](tests/prelude-marker-schemas.test.js), [triage/pattern-d-survey.md](triage/pattern-d-survey.md)

---

### 2026-05-04 — Phase 3 SC-5: DM Mode bond-shifts — service extraction, dual-scalar with SHARED audit (NONE strategy), JSON-blob storage repository, three-path convergence (Architecture)

**Context:** SC-5 is the most complex migration in Phase 3. Per spec §2.7: dual-scalar (warmth + trust) per **directional** pair (A→B independent of B→A) stored as a sub-object inside `dm_mode_parties.party_data` JSON blob — not a row. Three application paths converge on the same per-pair sub-object: per-turn `[BOND_SHIFT]` markers (route handler), session-end Sonnet extraction (`extractRelationshipEvolution`), and manual DM adjustment (a separate route handler). The relationship sub-object also carries `attitude` + `tension` text fields (untouched by the abstraction) and a SHARED `history` array (FIFO max 10, one entry per shift, combining warmth + trust deltas).

The shared-history wrinkle is the central design tension. The spec §2.7 step 2 says "audit trail is the in-row history array (FIFO max 10)" + step 4 says "the clamp-to-range and history-append logic is now provided by the abstraction." But a single SHARED column doesn't fit per-config audit — calling `adjustStanding(WARMTH_CONFIG)` then `adjustStanding(TRUST_CONFIG)` would produce two history entries instead of the legacy one. Per Invariant A (preserve AI-facing output), I needed to find a shape that exposes the abstraction's value without changing the history shape that `dmModePromptBuilder.js:333` reads.

**Decisions:**

1. **Service file extracted: `dmModeBondShiftService.js`.** Per spec §2.7 step 1. Owns the configs + the application wrappers + the marker handler. The 35-line inline block in `routes/dmMode.js:295-329` and the duplicate 30-line block in `routes/dmMode.js:1019-1029` (manual route) and the 32-line block in `dmModeChronicleService.js:347-380` all converge on three exported helpers in the new service.

2. **Two configs: `DM_MODE_BOND_WARMTH_CONFIG` + `DM_MODE_BOND_TRUST_CONFIG`.** Both range -5..+5, default 0, no label bands (raw signed integer in prompts), `auditTrail.storage = NONE`. Distinct names so the abstraction's threshold-handler registry treats them as independent. Both repositories implement `readScore` / `writeScore` against the JSON blob (load → parse → walk to `characters[fromCharName].party_relationships[toCharName].warmth|trust` → mutate → stringify → write). No `appendAuditEntry` — NONE strategy skips the audit step entirely.

3. **`AUDIT_STRATEGIES.NONE` for both bond configs.** The shared-history shape doesn't fit per-config audit. Audit lives consumer-side via the wrapper layer. This validates NONE as a real first-class strategy (used differently than SC-4's NPC trust which had no history at all — bond-shifts have history, just not per-scalar history).

4. **`mutateRelationshipScalars(rel, warmthDelta, trustDelta, reason, sessionLabel)` is the shared core.** Single in-memory mutation routine: clamp warmth via `clampToRange(value, DM_MODE_BOND_WARMTH_CONFIG.range)`, clamp trust via the trust config's range, push ONE shared history entry combining both deltas (FIFO max 10). All three application paths call it. The clamp routes through the abstraction's exported `clampToRange` — single source of truth for the [-5, +5] bounds. The history append stays consumer-side (because shared, see decision 3).

5. **Two wrappers around the core: `applyBondShift` (single-shift) + `applyBondShifts` (batched).** Both load party_data once, mutate via `mutateRelationshipScalars`, write back once. Single-shift wrapper used by the marker handler (one call per shift, since the pipeline dispatches per parsed marker) and by the manual relationship route. Batched wrapper exists for callers that want one read/write per turn (currently no caller uses it — kept for SC-7+ if a future path needs it). The chronicle extractor uses `mutateRelationshipScalars` directly inside its own load/write logic, because it ALSO mutates `attitude` + `tension` and needs to preserve the JSON blob's array-vs-object original shape on persist (lines 397-407).

6. **Marker pipeline owns `[BOND_SHIFT]` dispatch.** Schema added to `MARKER_SCHEMAS` (From + To required strings, Warmth/Trust optional signed ints bounded [-5, +5], Reason optional). Handler registered at module-load via `registerMarkerHandler('BOND_SHIFT', ...)` in `dmModeBondShiftService.js`. The inline `detectBondShifts` call site in `routes/dmMode.js:299` and the inline application block at `routes/dmMode.js:301-329` are **deleted** — replaced by `processResponseMarkers(narrative, { partyId, sessionLabel })`. Legacy `detectBondShifts` stays exported in `dmModeService.js` per "deprecate by hiding nav, not deleting code."

7. **Marker pipeline now wired into `routes/dmMode.js` for the first time.** Previously the pipeline was only called from `routes/dmSession.js` (player mode). SC-5 adds the call to dmMode.js (after the OOC gate), routing the BOND_SHIFT handler. This validates the pipeline as a cross-route foundation.

8. **Per-shift dispatch (N reads + N writes per turn) accepted.** The pipeline dispatches the handler once per parsed BOND_SHIFT marker. Multiple shifts per turn → multiple handler invocations → multiple reads + writes. Acceptable because BOND_SHIFTs are rare per turn ("most messages have none" per the system prompt at `dmModePromptBuilder.js:585`). The batched wrapper exists for future need but isn't called today.

9. **Per-path delta clamps preserved at call sites, not abstracted.** Manual route clamps deltas to [-2, +2]; chronicle extraction clamps deltas to [-2, +2]; per-turn marker accepts deltas in [-5, +5] (the schema's marker-level bound). These are per-path policy decisions (manual adjustments tighter than AI markers; Sonnet's session-end synthesis tighter than AI's per-turn calls), not abstraction territory. Kept at call sites with one-line comments explaining why.

10. **Attitude-only history entry preserved as a special case.** The legacy chronicle extractor pushes a `attitude→X` history entry when `warmth_delta = 0 && trust_delta = 0 && new_attitude` (lines 371-378). `mutateRelationshipScalars` doesn't push history when both deltas are zero (cleaner contract). The chronicle extractor handles this special case inline after calling `mutateRelationshipScalars` (zero-no-op for both scalars + a follow-up history push). Documented at the call site.

**Why:**

- **Service extraction is forced by three converging paths.** Two duplicates (route + manual route) plus a near-duplicate (chronicle extraction with extra fields) is a code smell that becomes a maintenance hazard once the abstraction lands. Extracting the service is non-negotiable.

- **NONE audit + consumer-side wrapper is the right shape for shared audit.** The alternative (extending the abstraction to support "shared audit across multiple configs targeting the same row") would leak consumer-specific schema awareness into the abstraction. The contract "abstraction owns behavior, consumer owns storage" extends naturally to "consumer owns audit shape when storage is shared." This validates the design from SC-1 — the abstraction's strategies are an enum the consumer interprets, not a behavior the abstraction enacts.

- **`clampToRange` reuse is the abstraction's real contribution.** Even though audit + storage live consumer-side, the [-5, +5] bound lives in `DM_MODE_BOND_WARMTH_CONFIG.range` and is enforced by the abstraction's exported helper. If a future change moves to [-10, +10] or asymmetric bounds, the change happens in one place. This is the SC-1 design's value-add for SC-5: shared clamp logic without forcing shared storage.

- **JSON-blob storage walked by repository callbacks works cleanly.** The abstraction's `repository.readScore` / `writeScore` see opaque contextKeys; the consumer encodes the load → parse → walk → mutate → stringify → write loop. This is the "json_blob_in_row" pattern Phase 6 will swap for `'dedicated_table'` (per spec §2.7 final paragraph). The swap will change only the repository callbacks, not the abstraction or the application call sites.

- **Per-shift dispatch, despite N reads/writes, is the right cadence.** Multiple BOND_SHIFTs per turn would benefit from batched I/O, but the cost is bounded (BOND_SHIFTs are rare; `party_data` is small; SQLite/libsql writes are sub-millisecond). Optimizing for the rare case at the cost of marker-pipeline architectural cleanliness would be premature. The batched wrapper is there if perf becomes an issue.

- **Wiring the pipeline into dmMode.js validates cross-route generalization.** The pipeline was designed for cross-route use but until now only had one consumer. SC-5 proves it works for both player mode and DM mode without per-route customization beyond the context object's contents.

**Implications:**

- **Phase 6's JSON-blob → `party_relationships` table migration is now isolated to the repository callbacks** (and the chronicle extractor's preserve-original-shape logic at `dmModeChronicleService.js:397-407`). The application call sites and the abstraction's API stay unchanged. This is the design payoff the spec promised in §2.7's final paragraph.

- **All five standing-scalar systems are now migrated** (companion loyalty SC-2, faction standing SC-3, piety SC-4, NPC disposition+trust SC-4, DM Mode bond-shifts SC-5). The abstraction has been exercised against:
  - Single-scalar with INLINE_JSON audit (loyalty)
  - Single-scalar with SPLIT_BY_SIGN audit (faction standing)
  - Single-scalar with SEPARATE_TABLE audit + composite contextKey + threshold dispatch (piety)
  - Dual-scalar with INLINE_JSON + NONE audits on shared row (disposition+trust)
  - Dual-scalar with NONE+NONE audits + JSON-blob storage + directional contextKey (bond-shifts)

  Five distinct audit strategies (INLINE_JSON, SPLIT_BY_SIGN, SEPARATE_TABLE, NONE × 2 different reasons), four storage shapes (column, separate table, shared row, JSON blob), three contextKey shapes (single key, composite, directional triple). The parameterize-don't-converge design from Call 1 (2026-05-03) holds across all five.

- **Two markers fully owned by the marker pipeline** (`[PIETY_CHANGE]` SC-4, `[BOND_SHIFT]` SC-5). Both detect-function call sites deleted from their route handlers. Pipeline now drives real side effects in two routes. Schema validation + correction-loop feedback active for both markers.

- **SC-6.4 detect-function survey is the natural next step** — with two markers fully migrated through the pipeline, the survey can identify which of the remaining ~26 detect-functions (combat, loot, weather, survival, crafting, mythic trial, item awaken, etc.) are good migration candidates. The survey was already PM-flagged as needing PM input on Q6 before proceeding.

**Related:** [PHASE_3_REFACTOR_SPEC.md](PHASE_3_REFACTOR_SPEC.md) §2.7 + §3.6 + §4.1, [server/services/dmModeBondShiftService.js](server/services/dmModeBondShiftService.js), [server/routes/dmMode.js](server/routes/dmMode.js), [server/services/dmModeChronicleService.js](server/services/dmModeChronicleService.js), [tests/dm-mode-bond-shift.test.js](tests/dm-mode-bond-shift.test.js)

---

### 2026-05-04 — Phase 3 SC-4: piety + NPC disposition/trust migration — composite contextKey, separate-table audit, dual-scalar pattern, marker pipeline owns dispatch (Architecture)

**Context:** SC-4 ports two consumers in one sub-checkpoint per spec §2.6. **Mythic piety** brings three new design surfaces — composite contextKey (per-deity scoping), `SEPARATE_TABLE` audit strategy (the only consumer using a dedicated history table), and the first real exercise of the abstraction's threshold-handler dispatch (§2.6 step 5). **NPC disposition + trust** brings the dual-scalar shape — two independent configs operating on the same `npc_relationships` row, validating that the abstraction handles parallel scalars without conflict before SC-5's harder DM Mode bond-shifts (warmth + trust per directional pair).

A fourth, cross-cutting decision: SC-4 is also where the marker pipeline (§3.2) begins owning real dispatch. `[PIETY_CHANGE]` is the first marker whose detect-function call site is removed from `routes/dmSession.js`; the pipeline + handler-registration path replaces it.

**Decisions:**

1. **Composite contextKey for piety.** The contextKey is `{characterId, deityName}` — passed opaquely through `adjustStanding(MYTHIC_PIETY_CONFIG, contextKey, change, options)` per the SC-1 contract. Each repository callback destructures its own keys. Case-insensitive deity matching is preserved via `COLLATE NOCASE` in the repository's SQL; the row creator (`initializePiety`) decides canonical casing. **No schema-level abstraction of compositeness needed** — the abstraction sees an opaque object and the consumer's repository encodes the SQL. This matches the SC-1 design and Q2 of the original spec.

2. **`SEPARATE_TABLE` audit strategy implemented as INSERT-only callback.** The abstraction passes the entry shape `{strategy, change, newScore, reason, sessionId, gameDay, date}` to `appendAuditEntry`, which INSERTs into `piety_history` with the columns it cares about. `readAuditTrail` SELECTs back, mapping `change_amount → change`, `new_score → newScore`, `created_at → date`, etc. The legacy column names (`change_amount`, `new_score`) are preserved on disk; the abstraction sees the standard entry shape.

3. **Threshold dispatch replaces `checkNewThreshold`.** The legacy cascade (cross-up 3/10/25/50 → UPDATE highest_threshold_unlocked) migrates to the abstraction's `up`-direction handler dispatch. Handlers register at module-load via `registerThresholdHandler(MYTHIC_PIETY_CONFIG, threshold, handler, 'up')` for each of {3, 10, 25, 50}. The legacy `checkNewThreshold` export stays for back-compat (no consumers found, but kept per the "deprecate by hiding" policy). Cross-down currently does NOT lock; preserved by registering only `up` handlers.

4. **Piety prompt-injection surfaces all deities.** The gap-fix per spec §2.6.3 lands as a new `pietyContext` slot in the session-context plumbing (parallel-loaded via `getAllCharacterPiety`, formatted via `formatPietyForPrompt`, interpolated below `mythicContext` in dmPromptBuilder). One line per deity: `- {Deity}: N piety (unlocked X, next at Y)`. Renders whenever any piety row exists, regardless of mythic tier — characters can earn piety pre-mythic. Section header `=== PIETY ===` plus a one-line directive about acknowledging unlocked abilities.

5. **Marker pipeline owns `[PIETY_CHANGE]` dispatch.** `PIETY_CHANGE` is added to `MARKER_SCHEMAS` (Deity required, Amount required signed int, Reason optional). `pietyService.js` registers the handler at module-load via `registerMarkerHandler('PIETY_CHANGE', ...)`. The dispatch block in `routes/dmSession.js` (lines 1999-2011) is **deleted** — the pipeline now owns it. The legacy `detectPietyChange` export in `dmSessionService.js` stays for back-compat (deprecate by hiding). The `mythicEvents` array no longer carries per-turn piety entries; verified zero client consumers via grep before the silent drop.

6. **Dual-scalar via two independent configs.** `NPC_DISPOSITION_CONFIG` (INLINE_JSON audit on `witnessed_deeds`) and `NPC_TRUST_CONFIG` (NONE audit) both target the same `npc_relationships` row via the contextKey `{characterId, npcId}`. They're **fully independent** in the abstraction's eyes — different `name`, different threshold registries, different audit strategies. Sharing the row is purely a consumer-side detail encoded in their respective `repository` callbacks. The dual-scalar test suite (`tests/npc-disposition-trust.test.js`) explicitly asserts the two configs' names and audit strategies diverge.

7. **Trust uses `AUDIT_STRATEGIES.NONE`.** The legacy `adjustTrust` recorded no audit; preserved exactly. The abstraction's NONE strategy skips the audit step entirely — the consumer's repository doesn't need to provide `appendAuditEntry` or `readAuditTrail` callbacks. This validates the NONE strategy as a real first-class option, not just a placeholder.

8. **Disposition prompt output unchanged.** The existing NPC line composer in `dmPromptBuilder.js:1650` reads `r.disposition_label` (denormalized column) and `getTrustLabel(r.trust_level)` directly — neither was touched. The migration's writeScore callback uses `mapToLabel(newScore, NPC_DISPOSITION_CONFIG.labelBands)` to compute the label, which produces byte-identical output to the legacy `getDispositionLabel` (proven by full-range parity test, 201 integers, 0 mismatches). No snapshot test of the full NPC line was needed — the line composer wasn't touched.

**Why:**

- **Composite contextKey "just works"** because the abstraction never inspects it. SC-1's "abstraction never builds SQL" contract pays off here: the abstraction sees `{characterId, deityName}` as opaque, and the repository encodes the lookup. Per-deity scoping needed zero abstraction-level changes — confirms the SC-1 design generalizes cleanly.

- **`SEPARATE_TABLE` was not a special case at the abstraction level.** It's just a repository where `appendAuditEntry` happens to INSERT into a different table than `readScore` reads from. The strategy enum (`SEPARATE_TABLE`) is metadata on the entry — the abstraction doesn't branch on it; the repository does. This validates the SC-1 enum-as-passthrough decision (vs. enum-as-dispatch).

- **Threshold dispatch via the abstraction is strictly better than the legacy inline cascade.** The legacy `checkNewThreshold` ran inline in `adjustPiety` and was the only place threshold-crossing logic lived. Migrating to the abstraction's dispatch (registered handlers fire after every adjust) means: (a) future consumers (mythic ability unlocks beyond piety, etc.) can register their own handlers without touching pietyService; (b) the cascade is testable in isolation; (c) the `up`/`down`/`both` direction enum makes intent explicit (the legacy code was implicitly cross-up only via `if (newScore > oldScore)`).

- **The marker pipeline taking ownership of `[PIETY_CHANGE]` is the real proof-of-concept for SC-6.** Until SC-4, the pipeline ran parallel-but-unused. Now there's one marker actively dispatched by the pipeline (and removed from the dmSession.js detect-function path). This validates the SC-1+SC-6.1 batch's "no behavioral change at ship, full integration as consumers migrate" approach. SC-5 ([BOND_SHIFT]) gets the same treatment.

- **Dual-scalar via two configs (rather than one config with multiple scalars) is the right design.** The alternative — a single `NPC_RELATIONSHIP_CONFIG` with multiple sub-scalars — would force the abstraction to model "many scalars per row" as a first-class shape. Two configs sharing a row keeps the abstraction's per-config-static contract simple. Storage co-location is a consumer concern, not an abstraction concern. SC-5 will exercise this further with bond-shifts (warmth + trust per directional pair).

- **Trust having NO audit isn't an oversight to fix; it's the legacy contract preserved.** The legacy `adjustTrust` recorded nothing, so trust history is irrecoverable today. Adding an audit column would be a feature, not a refactor — out of scope per Phase 3 entry call. NONE strategy makes this explicit and migration-stable.

**Implications:**

- **SC-5 inherits the dual-scalar pattern + the marker-pipeline ownership pattern.** DM Mode bond-shifts will register `DM_MODE_BOND_WARMTH_CONFIG` + `DM_MODE_BOND_TRUST_CONFIG` (matching the SC-4 dual-scalar shape) and register `[BOND_SHIFT]` handler in the pipeline (matching the SC-4 `[PIETY_CHANGE]` ownership pattern).
- **The `[PIETY_CHANGE]` schema in MARKER_SCHEMAS now feeds the correction loop.** Malformed PIETY_CHANGE markers (e.g., `Amount="three"`) flow through `validateDmMarkers` → `failures` → `buildPendingCorrectionsNote` → next-turn correction. Previously the legacy `detectPietyChange` silently dropped malformed instances. This is an intentional UX upgrade per spec §4.3.
- **Threshold-handler registration at module-load is now load-bearing.** Previously the abstraction's threshold dispatch was a registered API with no real consumers. SC-4 makes the pietyService → standingScalar wiring a hard dependency. Tests that import pietyService.js inherit 4 threshold-handler registrations (verified via `_getThresholdHandlerCount() >= 4` in the SC-4 test suite).
- **dmSession.js no longer imports adjustPiety directly.** The transitive load via `getAllCharacterPiety` (used by the prompt-injection wiring) keeps pietyService loaded so its module-level handler registrations fire on server boot.

**Related:** [PHASE_3_REFACTOR_SPEC.md](PHASE_3_REFACTOR_SPEC.md) §2.6 + §3.6 + §4.1, [server/services/pietyService.js](server/services/pietyService.js), [server/services/npcRelationshipService.js](server/services/npcRelationshipService.js), [server/services/markerSchemas.js](server/services/markerSchemas.js), [tests/piety-config.test.js](tests/piety-config.test.js), [tests/npc-disposition-trust.test.js](tests/npc-disposition-trust.test.js)

---

### 2026-05-04 — Phase 3 SC-3: faction standing migrates with split_by_sign audit + lossy deed reduction (Architecture)

**Context:** SC-3 migrates `factionService.modifyStanding` to the standingScalar abstraction. Faction standing's audit trail is the dual-array `deeds_for / deeds_against` shape (positive deeds in one column, negative in the other) — fundamentally different from companion loyalty's single `loyalty_events` array (SC-2's INLINE_JSON strategy). PM Q1 ruling 2026-05-04 confirmed `AUDIT_STRATEGIES.SPLIT_BY_SIGN` for this; the question was where the sign-routing lives.

A second wrinkle: legacy callers pass `deed` as an object with arbitrary fields — `{ description, quest_id }` from `questService.advanceFactionGoalFromQuest`, `{ description }` from promise-break consequences, bare strings (`'Failed quest: ...'`) from quest-expiry consequences, or anything from the `POST /api/faction/standing/.../modify` HTTP route. The legacy implementation `{...deed, date}`-spread the full object into the deed array, preserving every field. The standingScalar abstraction's audit entry only carries a string `reason` field.

**Decision:**

1. **`split_by_sign` enacted consumer-side in `appendAuditEntry`.** The strategy is metadata on the entry; the routing is consumer-owned. `FACTION_STANDING_CONFIG.repository.appendAuditEntry` inspects `entry.change` sign and pushes to `deeds_for` (positive) or `deeds_against` (negative). Zero-change calls skip the audit step entirely (no deed to record either way).

2. **`writeScore` updates BOTH `standing` AND `standing_label`** in a single UPDATE — `mapToLabel(newScore, FACTION_STANDING_CONFIG.labelBands)` produces the denormalized label, eliminating the legacy `getStandingLabel` helper. `tests/faction-standing-prompt-snapshot.test.js` walks every integer in [-100, 100] to prove byte-identical band semantics.

3. **Lossy deed reduction.** `normalizeDeedReason()` keeps only `deed.description` (or treats bare strings as the reason). `deed.quest_id` and other ancillary fields are dropped. Verified via grep before deletion: no consumers read fields beyond `description` from `deeds_for / deeds_against`. The columns are debug-only today; lossy migration is acceptable and documented in the function header.

4. **Sync helper `formatFactionStandingFragment(standing)`** ported from SC-2's `formatLoyaltyForPrompt` pattern. Returns `"LABEL (+N)"` from already-loaded standing data without a repository round-trip. `dmPromptBuilder::formatWorldStateSnapshot` composes this with `faction_name + memberNote + behavior` to produce the existing line shape — `getStandingBehavior` stays in `dmPromptBuilder.js` (consumer-specific NPC behavior hint, not part of the abstraction's `formatForPrompt`).

**Why:**

- **Sign routing belongs to the consumer.** The abstraction would have to learn faction's two-column shape to do this generically; that violates the SC-1 "abstraction never builds SQL" contract. The strategy enum (`SPLIT_BY_SIGN`) lets the consumer's callback know what to do without forcing schema knowledge upstream.

- **`writeScore` doing the label cache update is a feature, not a leak.** The denormalized `standing_label` column is read by every prompt build and by some HTTP endpoints. Pushing label computation into the abstraction would force every consumer's `writeScore` to refresh the cache anyway — better to make the consumer's repository own that consistency directly. This matches the SC-1 ethos: the abstraction owns *behavior*, the consumer owns *storage*.

- **Lossy is the right trade.** Preserving every legacy deed field would require either (a) plumbing an extra `options.deed` slot through the abstraction (which leaks consumer-specific shape into the public API) or (b) a closure-captured side-channel from `modifyStanding` to `appendAuditEntry`. Both are worse than dropping unused debug fields. If a future consumer needs to read `quest_id` from a deed, the abstraction can grow a generic `metadata` slot — but until that need is real, YAGNI.

- **Snapshot-as-acceptance-test is the right gate.** Faction standings appear in the DM system prompt on every turn. A subtle band shift would change AI behavior in ways that are hard to debug. Walking the full integer range and asserting line-for-line equality against the legacy composer is cheap insurance.

**Implications:**

- Pattern locks in for SC-4 (NPC disposition's audit) and SC-5 (DM Mode bond-shifts). SC-4 will likely use `INLINE_JSON` (single audit array on `npc_relationships`); SC-5's pattern depends on whether bond-shifts have a persistent audit at all (TBD).
- `getStandingBehavior` staying in `dmPromptBuilder.js` confirms the design split: the abstraction's `formatForPrompt` produces the *standing-only* fragment; consumer-specific composition (faction_name, memberNote, NPC behavior text) lives at the call site.
- The lossy deed reduction creates a one-way bridge: deeds written before SC-3 retain their full object shape; deeds written after SC-3 carry only `{ description, change, newScore, date }`. No migration needed (clean slate per Phase 3 entry call), but downstream consumers that read these columns should not rely on pre-SC-3 schema.

**Related:** [PHASE_3_REFACTOR_SPEC.md](PHASE_3_REFACTOR_SPEC.md) §5.3, [server/services/factionService.js](server/services/factionService.js), [tests/faction-standing-prompt-snapshot.test.js](tests/faction-standing-prompt-snapshot.test.js)

---

### 2026-05-04 — Phase 3 SC-1 + SC-6.1: foundation modules ship together (Architecture)

**Context:** Phase 3 spec (`PHASE_3_REFACTOR_SPEC.md`) authored 2026-05-03 calls for two refactors across nine sub-checkpoints. SC-1 builds the standing-scalar abstraction (`services/standingScalar.js`); SC-6.1 builds the marker pipeline (`services/markerPipeline.js`). Both are API-foundation work — neither does any migration. Spec's §1.5 sequencing put SC-6.1 between SC-1 and SC-2 because handler-registration must exist when systems with markers begin migrating in SC-4 ([PIETY_CHANGE]) and SC-5 ([BOND_SHIFT]).

PM and Code agreed to batch SC-1 + SC-6.1 into a single ship rather than two — both surfaces are reviewed together at the same gate, and SC-2 (the first migration) exercises both APIs anyway. Reviewing the foundations together is honest about the integration. SC-2 onward proceed one ship at a time.

**Decision:** Ship SC-1 + SC-6.1 as a single batch. New modules under `server/services/`:

- **`standingScalar.js`**: per-consumer-static configuration object holds `range / defaultValue / labelBands / thresholds / auditTrail / formatForPrompt / repository`. The `repository` callbacks (`readScore / writeScore / readAuditTrail / appendAuditEntry`) are how the abstraction interacts with storage — the abstraction itself never builds SQL. Public API: `adjustStanding / getStanding / formatStandingForPrompt / registerThresholdHandler`.
- **`markerPipeline.js`**: thin dispatch layer composing existing `markerSchemas.js::validateDmMarkers` + `ruleVerifiers.js::buildRuleCorrectionMessage`. Public API: `registerHandler / processResponseMarkers / buildPendingCorrectionsNote`. Handler errors are CONTAINED — they go in `handlerResults` with `ok: false` but don't throw.

Wired into `routes/dmSession.js` as a parallel call alongside the existing detect-functions. With no handlers registered at SC-1+SC-6.1 ship, the pipeline is a behavioral no-op.

**Why:**
- **Storage staying consumer-side via repository callbacks** (the SC-1 design point worth flagging): the alternative was making the abstraction declarative ("here's a table name and column names; you build the SQL"). Rejected because (a) DM Mode bond-shifts store inside a JSON blob in `dm_mode_parties.party_data` — no clean SQL the abstraction could generate; (b) per Call 1 from 2026-05-03, parameterizing rather than converging means each consumer should own its storage idiosyncrasies. Repository callbacks let the consumer keep its existing repository pattern; the abstraction provides the algorithm.
- **Threshold dispatch existing as future-facing API**: per spec Invariant B, existing per-system cascades (`checkSecretReveals`, etc.) stay consumer-side. The `registerThresholdHandler` API exists in SC-1 but is only actively exercised by piety in SC-4. Building it now (rather than deferring) is cheap and prevents an awkward "add API in SC-4" follow-up that would break the SC-1 review's API freeze.
- **Pipeline runs in parallel with detect-functions, not as a replacement**: every existing detect-function in `dmSessionService.js` continues to fire alongside `processResponseMarkers`. SC-2 through SC-5 will register handlers for the standing-scalar markers; SC-6.4 will sweep remaining detect-functions. The cutover is gradual; no big-bang flip.
- **Handler errors contained, never thrown to the route**: spec Q5 recommended logged-only on the rationale that surfacing engineering bugs to the AI leaks detail into the fiction. Both modules implement this consistently — adjustStanding's threshold handler errors and processResponseMarkers' marker handler errors both log + continue, never block the parent operation.

**Implications:**
- SC-2 through SC-5 will exercise the standing-scalar API against real consumers. If the API needs adjustment (e.g., the `repository` callback shape misses a use case), DECISION_LOG entries during those sub-checkpoints will document the change.
- The `validateDmMarkers` call now happens twice per turn (once via existing `routes/dmSession.js` block, once via `processResponseMarkers`). Wasteful but not incorrect; SC-6.4's route-handler rewrite will collapse this.
- Q1 (faction standing dual-array audit) is still pending PM call before SC-3. Spec §2.2 already names `'split_by_sign'` as the strategy; the abstraction's `auditTrail.storage` recognizes it and passes through to the consumer's repository to enact.
- Q6 (detect-function deferral criteria) still pending PM call before SC-6.4.

**Related:** `PHASE_3_REFACTOR_SPEC.md` §2 (standing-scalar) and §3 (marker pipeline). Tests at `tests/standing-scalar.test.js` (71 assertions) and `tests/marker-pipeline.test.js` (44 assertions). Memory: `project_phase3_scope.md`.

---

### 2026-05-03 — Opus as default model for prelude gameplay sessions; Sonnet/Haiku for non-prose work (Direction)

**Context:** Phase 2 close-out work surfaced a question about model selection in prelude gameplay. PM remembered the project switching to Opus as the primary gameplay model. Code's investigation found the change was real but more limited: the 2026-04-26 (v1.0.99) decision flipped *main DM session* continuations to Opus default. Prelude sessions retained the Sonnet-default auto-picker that escalates to Opus on specific triggers (chapter 4, session wrap, heavy-weight scenes, HP drops, chapter-promise turns; capped at 2 consecutive Opus turns to break feedback loops). The auto-picker logic was last touched at v1.0.66 ("Auto picker: break the Opus-feedback loop") and has shipped unchanged since. The mismatch between PM memory and codebase reality forced the question: was the asymmetry intentional, or should prelude follow main DM's lead?

**Decision:** Prelude gameplay sessions move to Opus default. The auto-picker logic in `preludeSessionService.js::pickAutoModel` is retired (preserved as dead code per "deprecate by hiding, not deleting" discipline). `resolveModel`'s default flips from `'auto'` to `'opus'`. The decision generalizes the v1.0.99 framing — "Opus everywhere for gameplay" — across both prelude and main DM sessions.

**Why:**
- Prose quality. The v1.0.96 prose investigation that drove the main DM session flip established Opus as the prose-quality lever. Prelude is *more* about atmospheric prose than main DM — it's a 5-session character-building arc with heavy literary emphasis, alignment-tagged content, and emerging-character-shape tracking. The case for Opus is arguably stronger in prelude than in main DM, not weaker.
- Consistency of reasoning. "Opus everywhere for gameplay" is simpler to hold in mind than "Opus for main, auto-picker for prelude." The asymmetry was historical (the auto-picker predated the main DM Opus flip), not intentional design.
- User has Claude Max. The cost argument that originally motivated the auto-picker (Opus is ~10× Sonnet per turn; prelude sessions can run long) is bounded for personal-use scope on Max. The trade-off worth optimizing for is no longer cost-vs-quality but quality-vs-latency, and the user explicitly prefers quality.
- Playtest evidence. User's own assessment after running prelude playtests: Opus is the more reliable narrative tool. The auto-picker's escalation triggers can't substitute for uniform Opus presence in moments the picker doesn't classify as "heavy."

**Broader principle established by this decision: prose vs. non-prose model selection.** Opus is the default for any AI work that produces prose the player will read — gameplay sessions (prelude + main DM), session-opening narration, narrative queue beats, biography-seed generation, atmospheric scene generation, anywhere the AI's output is read as in-fiction text. Sonnet (or Haiku, where Haiku can handle the task) is fine for any work that doesn't produce prose the player reads — chronicle extraction, marker validation, schema compliance checks, JSON-shaped data extraction, structured field generation, mechanical parsing. The distinction is not "expensive task vs cheap task" but "is the output prose the player will read." Future model-selection decisions for new systems should default to this framing rather than re-litigating Opus-vs-Sonnet per-system.

**What stays Sonnet under this principle:**
- Chronicle extraction (post-session structured-data extraction from transcripts; not prose for the player)
- Marker validation pipelines (markerSchemas.js correction-loop work, when invoked; not prose)
- Any future structured-extraction or schema-compliance task

**What's eligible for Haiku:** Tasks that are mechanical and high-volume — for example, simple field validation, schema parsing, low-stakes summarization where Sonnet would be overkill. Specific Haiku migrations are not in scope right now; the principle is captured for future use. When a new task is being scoped and the AI work is non-prose, the spec should consider Haiku as an option and only escalate to Sonnet (or Opus) if Haiku proves insufficient.

**What's retired (prelude-specific):** The auto-picker (`pickAutoModel`) and its escalation triggers (chapter 4, session wrap, heavy-weight scenes, HP drops ≤ -3, chapter-promise turns, 2-consecutive-Opus cap). Preserved as dead code; can be reactivated if a future need surfaces. The "Opus-feedback loop" the picker was tuned to avoid (v1.0.66) is now an accepted property of every prelude turn rather than a problem to mitigate.

**Implications:**
- `preludeSessionService.js` resolveModel default flips to `'opus'`.
- CLAUDE.md model-split documentation updates: prelude sessions move from Sonnet-default to Opus-default; chronicle extraction stays Sonnet (for now); the prose-vs-non-prose framing replaces the system-by-system descriptions.
- Latency increases on prelude turns. User has accepted this consciously.
- Per-turn cost increases on prelude. User has Claude Max; cost is bounded for personal-use scope.
- Future model-selection decisions should default to "Opus for prose-the-player-reads, Sonnet/Haiku for everything else." If a future system spec needs to make this call, this entry is the precedent.
- Phase 3 marker pipeline work (§3.2 of the in-progress Phase 3 spec) inherits this framing: marker validation runs on Sonnet (or Haiku where appropriate), since validation is non-prose.

**What this isn't:** Not a step toward eventual custom model. User has separately flagged that long-term goal; this decision is independent. The eventual custom-model question is a much larger lift (training data, infrastructure, evaluation framework) that's not on any current roadmap. This decision is about the right model from the available Anthropic options, today.

**Related:**
- `DECISION_LOG.md` 2026-04-26 entry "Opus as production default for main DM session continuations" (v1.0.99) — the supersession this generalizes
- `DECISION_LOG.md` 2026 (early baseline) entry "Opus for ALL generation, Sonnet for sessions only" (now further superseded for prelude specifically; the prose-vs-non-prose framing also further refines the original baseline)
- `server/services/preludeSessionService.js::resolveModel` (the flipped default)
- `server/services/preludeSessionService.js::pickAutoModel` (now dead code)
- `CLAUDE.md` model-split documentation (updated as part of this ship)

### 2026-05-03 — Phase 2 close-out: alignment coverage rule for theme content prompts (Direction)

**Context:** Post-Phase-2 ship (v1.0.114, 2026-05-02), user picked City Watch in the rebuilt creator and saw all Lawful-coded personality options on Step 7. Coverage scan across all 21 themes confirmed the issue is universal: every theme has at least one alignment with zero personality prompts; most themes cover only 1-3 of the 9 alignment cells. The Phase 2 personality data (3 prompts × 21 themes = 63 total) shipped with a "thin pass, intentionally skewed" annotation reflecting time pressure during chunk 5 ship; the skew was a thinness compromise, not a design call. User overrode the compromise. Four calls were surfaced by Code; this entry captures all four.

**Decisions:**

**Decision 1 — Universal alignment coverage rule for personality prompts.** Every theme × every alignment ≥ 1 prompt is the rule. 21 themes × 9 alignments = 189 prompts minimum (was 63; ~126 net-new). Authoring is PM-authored in one pass, batched per-theme (all 9 alignments for one theme authored in one sitting for voice coherence), delivered in groups of ~7 themes with sanity-check sub-checkpoints between batches. Code transcribes each batch into `client/src/data/themePersonalityPrompts.js` as it lands.

**Decision 2 — Refined character-integrity principle: alignment shifts the institution itself.** The Phase 2 Decision 5 caveat ("believable commitments held by people who think they're doing right") is preserved, but refined for the universal-coverage case: for "naturally aligned" themes, alignment shifts the *shape of the institution, role, or path itself*, not just the character's personal morality within a fixed institution. A Chaotic Evil Knight of the Order isn't a class-betrayer; the order itself is brutal-but-orderly (think Inquisition or fascist enforcement). A Lawful Good Charlatan runs a reformed grift for legitimate charity. A Chaotic Neutral City Watch protects its district through informal networks and bent rules. The institution takes on the character of the alignment, and the prompt expresses a believable commitment held by someone living that version of the theme. This makes authoring against the universal rule tractable rather than forced — voice has more to grip onto when the institution itself flexes with the alignment.

**Decision 3 — Universal rule applies to personality only; ideals / bonds / flaws keep "fill genuine gaps."** Personality is the field where alignment funneling was felt (it's the first field on Step 7, most prominently labeled, and where City Watch surfaced the issue). Ideals / bonds / flaws have more textual variety per prompt; the alignment chips help players steer; the existing coverage matrix at `triage/alignment-coverage-matrix.md` (43% filled, 241/567 cells) keeps its existing principle: "fill where roleplay-believable coverage is genuinely absent." Reactivate the universal rule for those fields if a future playtest surfaces alignment funneling on them the way City Watch surfaced it on personality. The rule adjusts to evidence, not to symmetry.

**Decision 4 — Decision 4 from 2026-05-02 holds: backstory moments stay alignment-agnostic.** Moments are events, not commitments. Two characters can witness the same event ("you watched your home burn") and respond in opposite alignment directions; the alignment isn't in the moment, it's in what the character did about it. Tagging moments by alignment would force a false reading. Personality / ideals / bonds / flaws are commitments where alignment lives in the value expressed; backstory moments are events where alignment lives in the response, not the event itself. The structural distinction holds. The rule does not extend.

**Why these four together:**

The personality coverage problem is real and felt; the universal rule is the right correction. But the symmetric extension to all fields and to moments would have over-applied the principle to surfaces where the original Phase 2 reasoning still holds — coverage matrix pragmatism for ideals/bonds/flaws, event-vs-commitment for moments. Capturing all four calls in one entry preserves the *why* of where the rule applies and where it deliberately doesn't, so future readers see the principle as coherent rather than fragmented.

The refined institution-shifts-with-alignment principle is the substantive new addition. It generalizes beyond personality prompts to any future content authoring against "naturally aligned" themes — if a future surface needs to express a theme through an off-axis alignment, the lever is "what kind of [theme] does this alignment produce" rather than "imagine a [theme] who happens to be [alignment]."

**Implications:**
- Phase 2 close-out workstream gains one item: PM authors ~126 net-new personality prompts. Runs in parallel with smoke run, smoke bug fixes, spec cleanup, Prelude flow editorial reskin, and Phase 3 spec drafting. Lands before Phase 3 implementation begins.
- Existing 63 prompts remain unless PM flags one for replacement during authoring.
- `triage/alignment-coverage-matrix.md` continues to track ideals / bonds / flaws coverage; no extension to those fields.
- The institution-shifts-with-alignment principle is available for future content authoring on any theme-or-class-shaped surface where alignment coverage matters.
- The "rule adjusts to evidence" framing (Decision 3) generalizes — if symmetry is tempting but the original pragmatic compromise still holds, evidence triggers reactivation rather than principle alone.

**Related:**
- `DECISION_LOG.md` 2026-05-02 entry (Decisions 3, 4, 5 — alignment indicators, event-vs-commitment, full-spectrum coverage with character integrity)
- `client/src/data/themePersonalityPrompts.js` (the file Code transcribes into)
- `triage/alignment-coverage-matrix.md` (the ideals / bonds / flaws coverage tracker, kept on existing principle)
- `PHASE_2_CREATOR_SPEC.md` §7.2 (the personality prompts spec section)

**Author note:** This is a single consolidated entry covering four related calls, following the density-over-fragmentation pattern from the 2026-05-02 six-decisions entry. Each decision is summarized with standalone reasoning preserved.

### 2026-05-02 — Phase 3 scope confirmation: standing-scalar + marker pipeline, Lolth deferred (Direction)

**Context:** Phase 3 (AI Narrative Persistence foundation refactors) opened in a fresh PM chat after Phase 2 shipped at v1.0.114. The bootstrap framing carried two refactors from `CONSOLIDATED_TODO.md`: a unified standing-scalar abstraction and a unified marker → state pipeline. PM raised three calls before spec authoring: (1) which existing system migrates to the new abstraction first, (2) how much of the migration ships in one cycle, (3) any in-flight campaign data to preserve across the refactor.

**Decision:** Phase 3 scope locked as follows:

- **Standing-scalar abstraction.** Build the abstraction. Migrate existing systems in this order: companion loyalty (first, as proof-of-concept on a real system) → faction standing → Mythic piety → NPC disposition → DM Mode bond-shifts (last, JSON-blob extraction is more invasive). Aasimar Path's Choice gets built as a new instantiation on the abstraction (user plays Aasimar; this is content the user will actually exercise).
- **Marker → state pipeline.** Build the pipeline. Port DM Mode markers first (cleanest existing implementation), then Prelude markers, then companion threads. Party Synergies markers deferred to Phase 5 per `CONSOLIDATED_TODO.md`.
- **Shipping cadence:** Each migration ships in its own cycle with a sub-checkpoint, mirroring Phase 2's chunk-then-checkpoint discipline. Refactor work specifically benefits from "ship a small change, see what broke, ship the next."
- **In-flight data:** None to preserve. User has no started campaign worth carrying across the refactor.

**Lolth standing tracker explicitly deferred.** The bootstrap and Code's audit both listed Drow Lolth standing as a "trivially addable once the abstraction lands" example consumer. User does not play Drow; Lolth standing has no other consumers. Parked to `FUTURE_FEATURES.md` with a Phase-3-dependency note. Aasimar Path's Choice (which user does play) stays in scope. The principle that surfaced: deferred-content systems don't justify Phase 3's case on their own; the abstraction is justified by the in-use systems migrating to it. Race-or-theme-specific consumers stay or leave Phase 3 based on whether the user actually plays that race or theme.

**Why:** Phase 3's case rests on five existing systems that each repeat the same shape with different schemas. Migrating those is the load-bearing work. New consumers (Lolth, Aasimar Path's Choice, Folk Hero fame, Urchin network) are interchangeable as exemplars of "the abstraction handles new locuses too" — the user's actual character preferences determine which ones merit construction now versus which can wait. Companion-loyalty-first is the right migration order for a clean-slate environment because it stress-tests the abstraction on a real system early, when finding flaws is cheapest.

**Implications:**
- Phase 3 spec is unblocked. Spec doc to follow, same shape as `PHASE_2_CREATOR_SPEC.md`.
- Folk Hero geographic fame and Urchin street children network stay in their existing parking-lot home (Phase 5 candidates if Themes becomes the focus area). Not Phase 3 work.
- Inter-companion `party_relationships` port from DM Mode JSON to player-mode table stays in Phase 5 candidate list (Companions wound representation focus area). Phase 3 builds the abstraction it would later use.
- Time-bounded state primitives (Quick Study, per-arc gating, Tiefling 1-week debts) stay deferred. Separate refactor, separate phase.
- Pattern F class features (Keeper Eidetic Memory, Sage L5 lore queries) remain Phase 7 playtest-dependent.
- The "deferred-content systems don't justify load-bearing refactor scope" principle generalizes: future scope confirmations for cross-cutting work should distinguish in-use consumers (justify the work) from speculative consumers (interchangeable exemplars).

**Related:** `CONSOLIDATED_TODO.md` Phase 3 entry; `AI_NARRATIVE_PERSISTENCE.md` (Patterns A and ambient-pattern-matching); `CODE_AUDIT_FINDINGS.md` Block 2 (Pattern A audit, Pattern matching audit, Cross-cutting refactors); `FUTURE_FEATURES.md` "Drow Lolth Standing Tracker" entry.

### 2026-05-02 — Phase 2 ship: Prelude → Primary transition + main creator rebuild (Milestone)
**Context:** Phase 2 of the consolidated project plan covered the engineering work to ship the Prelude → Primary transition (the highest-priority real bug in the codebase per Code's audit — players who completed a Prelude had no service to flip them to active) plus the rebuild of the character creator the transition feeds into. Authored over a single PM chat, implemented across 6 Code commits over the span of one day.

**Decision:** Ship as v1.0.114 across staged commits (v1.0.109 → v1.0.114). Six structural decisions made during spec authoring (consolidated into a separate log entry on the same date). Three sub-checkpoints during implementation (Step 4 visual direction, home page + Screen 2 visual direction, full integration). Single consolidated entry approach for the spec-time decisions rather than six separate entries — the user's preference for fewer, denser log entries was the right call for capture density.

**What shipped:**
- 8-step rebuilt character creator (manual + handoff modes) replacing the legacy `CharacterCreationWizard.jsx`
- Editorial & literary aesthetic as the project's hi-fi visual default
- Six content data files with ~620 player-facing prompts and moments (gold modifiers, personality / ideals / bonds / flaws, backstory moments, narrative-continuity copy)
- Race demographics with dual-unit display + custom override
- Save/resume across both creator modes via expanded `creation_phase` enum
- Server-side canon transfer service (NPCs / locations / threads / mentor imprints from Prelude → primary campaign)
- Redesigned home page (single-grid character roster) + Screen 2 path-choice screen
- Migrations 049 (heirloom table) + 050 (physical_build column)
- 2036 assertions across 15 test suites, all green

**Why this is a milestone, not just a ship:** Phase 2 is the largest single body of work the project has shipped to date. It locked the project's hi-fi visual direction (editorial) for all future surfaces. It established the spec-doc-as-engineering-contract pattern (`PHASE_2_CREATOR_SPEC.md` carries four implementation-deviation annotations now, preserving the *why* of each Code-side judgment call). It demonstrated the sub-checkpoint cadence works for catching visual drift before downstream work commits to it. And it fixed the highest-priority bug in the codebase — Prelude characters can now actually exit into a campaign.

**Implications:**
- Phase 3 (AI Narrative Persistence foundation refactors) is unblocked. Inputs Phase 3 inherits: canon transfer service exists; mentor imprint seeding pattern available; three-state `creation_phase` enum in place; editorial aesthetic established for any UI surfaces Phase 3 touches.
- Six discrete follow-up items captured in `CONSOLIDATED_TODO.md` parking lot — none Phase-3-blocking, all named with their reactivation triggers.
- Old creator (`CharacterCreationWizard.jsx` + `CharacterManager.jsx`) hidden but retained per "deprecate by hiding nav, not deleting code" discipline. Slated for deletion after 2-3 playtest cycles confirm no regressions in the new creator.
- The PM-Code-Design cadence patterns from Phase 2 (sub-checkpoints on visual-load-bearing surfaces, spec annotations preserving deviation reasoning, parking-lot honesty over backlog guilt) generalize forward.

**Related:** [`PHASE_2_CREATOR_SPEC.md`](PHASE_2_CREATOR_SPEC.md) (v1.1, with four implementation annotations dated 2026-05-02); 2026-05-02 consolidated six-decisions log entry below; [`PRELUDE_IMPLEMENTATION_PLAN.md`](PRELUDE_IMPLEMENTATION_PLAN.md) v4 (Phase 2 implements its §6, now historical reference); [`CONSOLIDATED_TODO.md`](CONSOLIDATED_TODO.md) (Phase 2 parking lot).

### 2026-05-02 — Phase 2 Creator Spec authoring: six structural decisions (Direction / Architecture / UX)
**Context:** Authoring `PHASE_2_CREATOR_SPEC.md` (the Phase 2 main creator design brief — 8-step creator + redesigned home page + Screen 2 path choice + content appendix) surfaced six decisions that shape future work beyond the spec itself. Captured here as one consolidated entry rather than six separate entries. Each is summarized with its standalone reasoning preserved.

**Decision 1 — Manual-mode mid-creator save via new `creation_phase = 'creating'` state (Architecture).** First-pass spec had manual mode as single-session — start, complete all 8 steps, submit, or cancel. Handoff mode (Prelude-played characters) was already designed for mid-creator persistence at `'ready_for_primary'`. Pushback during authoring: manual mode also needs persistence, particularly after authoring effort has gone in (Step 7 expansions, heirloom authoring). Decision: manual mode persists from Step 1 advance onward via a new enum value. Final `creation_phase` enum becomes `'active' | 'creating' | 'ready_for_primary'` (Phase 0 reduced this to two values; Phase 2 adds two back). Same persistence-on-advance code path serves both modes; the home page now differentiates three card states. Cancel/discard semantics differ per mode — manual deletes the partial record; handoff preserves Prelude history but wipes creator-state-since-last-save.

**Decision 2 — Narrative-continuity copy in handoff mode is dismissable, not always-on (UX).** Step 4's per-theme copy card honors what the years did to the character ("the discipline is in your bones — now choose how you'll bring it to a wider fight"). The card is theme-anchored, not class-anchored. Question: when the player overrides the suggested class to something the copy would awkwardly contradict (Soldier + Fiend Warlock), should the copy still display? Decision: dismissable, default-visible. Player is the judge of fit. Encoding every theme × class collision is rabbit-hole work; most combinations work fine with theme-anchored copy. The dismiss affordance is low-cost UX and gives the player agency without requiring the system to anticipate every combination. State semantics: local-session-scoped (single boolean on creator state), not character-persistent — dismissal is "in this pass, I don't want to see it," not "never again." Pattern is reusable for future "trust the player as the judge of fit" UX situations (AI-suggested content the player might reject, recommendations the player should be free to ignore).

**Decision 3 — Alignment indicators on player-facing content prompts (UX).** §7 of the spec produces 431 prompts across personality / ideals / bonds / flaws — too many to scan without navigation aids. Format options considered: 9-square abbreviation, separate-axis indicators, descriptive labels. Decision: standard 5e 9-square abbreviations (`LG` / `NG` / `CG` / `LN` / `N` / `CN` / `LE` / `NE` / `CE`) displayed always-visible inline alongside each prompt, with Design discretion over visual weight. The 9-square already handles every alignment combination including "lawful but morally neutral" cases (`LN`); inventing partial-axis notation was overthinking. Storage shape: `{ text: string, alignment: string }` arrays keyed by theme id. Future content authoring uses this convention — alignment-tag commitment-shaped content; leave event-shaped content untagged.

**Decision 4 — Backstory moments are alignment-agnostic; events ≠ commitments (Direction).** §7.6 authors 168 backstory moments — short past-tense formative-event strings. First-pass spec was going to apply alignment indicators (matching §7.2-§7.5). Pushback: moments are events, not commitments. Two characters can witness the same event ("you watched your home burn") and respond in opposite alignment directions; the alignment isn't in the moment, it's in what the character did about it. Decision: moments stay alignment-agnostic. Storage shape is `{ themeId: [string] }` — strings only, no alignment field. The principle generalizes: in any system that distinguishes "what happened" from "what the character did about it," the *what happened* layer should not pre-commit alignment. Future moment-shaped content (events in a living-world feed, generational-arc beats from lineages work, mid-campaign formative moments in the biography) inherits this discipline. Biography seed generation also inherits — entries describe events; character-shape interpretation lives elsewhere.

**Decision 5 — Full-spectrum alignment coverage in player-facing content prompts (Direction).** First-pass authoring of §7.3-§7.5 biased the alignment distribution toward Good/Neutral options, treating evil-axis prompts as villain manifestos that don't belong in a starter list. Pushback: a player choosing to roleplay an evil character benefits from evil-axis suggestions too. The line between "evil prompt" and "villain manifesto" is whether the prompt reads as something a thoughtful person could believe or carry — not whether it leans toward evil alignment. Decision: author content prompts across the full 9-square. Evil-axis ideals, bonds, and flaws are written as character commitments held by people who think they're doing right, not as declarations of villainy. Final §7 distribution covers the full spectrum. Future player-facing content authoring (more themes, expanded fields, additional creator surfaces) follows the same principle: cover the full alignment spectrum where it can be done with character integrity. The principle is roleplay support, not roleplay endorsement — prompts are starters; the player edits freely from there.

**Decision 6 — Editorial & literary aesthetic direction for hi-fi UX work (Direction).** Phase 2 produced the first hi-fi-mockup-ready design brief. Claude Design surfaced an aesthetic direction question with three options: atmospheric/fantasy parchment, modern dark slate+gold, editorial & literary serif. The project's voice — "the years that shaped you," the Faerûn-anchored "epic fantasy in a lived-in world" tone description from Phase 1 Decision 3 — fits one register more naturally than the others. Decision: editorial & literary as default; parchment and modern dark exposed as tweaks for comparison. Editorial register doesn't fight the prose; the other two risk either tipping into fantasy-genre cliché or fighting the literary voice with a contemporary-RPG-app feel. Subsequent hi-fi design work (Origin & Identity tab, Progression tab, Session Hi-Fi if it touches anything new) defaults to the editorial register too, creating a coherent visual language across the project's surfaces. The aesthetic direction is not yet a design system; if it lands well in mockup, it likely becomes one (typography choices, color treatment, spacing rules) over the next 1-2 design passes. Tweaks-as-comparison is a workable pattern for future Design handoffs when aesthetic direction is genuinely uncertain.

**Implications across the six decisions:**
- Phase 2 Chunk 5 migration adds two values to `creation_phase` (Decision 1) and creates the dedicated heirloom table (specified in spec §8.1.2).
- Six new content data files in `client/src/data/` (Decisions 3, 4) — five with alignment-tagged objects, one with bare strings.
- Three-state home page card differentiation (Decision 1) — Design has discretion over how the states are visually distinguished.
- Editorial & literary aesthetic (Decision 6) becomes the project's default visual register for hi-fi work going forward.
- "Trust the player as the judge of fit" pattern (Decision 2) is available for future UX situations.
- Commitment-shaped vs. event-shaped content distinction (Decisions 3, 4) is a structural rule for any future content authoring.

**Related:** [`PHASE_2_CREATOR_SPEC.md`](PHASE_2_CREATOR_SPEC.md) — the spec itself contains the implementation detail behind each decision; this entry preserves the why for future readers.

**Spec-internal calls intentionally not logged here:** "shaped" vs. "hardened" verb in stat-bump celebration card (§5.5.5); manual-mode score range 3–20 (§5.5.7); specific gold modifier values per theme (§7.1). These are inside the spec doc, not architectural decisions that shape future work.

### 2026-04-30 — Phase 2 Pre-Engineering Decision E: Mythic-tier stat cap raise

**Context:** Step 5 (Ability Scores) of the per-step creator spec walkthrough surfaced a question about stat caps for Prelude-earned bumps. The user proposed raising the lifetime stat cap from 5e's standard 20 to 22, with the reasoning that hero-class protagonists in a multi-year campaign should mechanically reflect their exceptional status — a Fighter at the height of their power should not have the same Strength as a particularly hardy farmer. The trade-off was real: a baseline cap raise would ripple through encounter difficulty math, ancestry feat scaling, AI DM calibration, and save DC tuning, requiring substantial supporting work.

**Decision:** Stat caps follow standard 5e math (lifetime cap 20, L1 cap 18 via Standard Array + racial bonuses) for L1–L20 play. The cap raises to 22 at Mythic tier onset and stays there for the duration of Mythic-tier play. The cap raise is exclusive to Mythic — Ability Score Improvements (ASIs) at L4/L8/L12/L16/L19 cap at 20.

**Specifics:**
- **Trigger:** Mythic Tier 1 onset (the moment the character's Mythic tier first activates). Cap raise applies to all six ability scores.
- **Cap behavior:** Lifetime cap of 22 from Mythic Tier 1 onward. No further raises across Tiers 2–5 — the Tier 1 raise is the binary "no longer mortal" signal; subsequent Mythic tiers escalate via Mythic abilities, not via further cap raises.
- **Sources of stat increases:** Pre-Mythic, ASIs and any other increases cap at 20. At Mythic onset, the 20→22 headroom opens; subsequent ASIs (or any future increase mechanism) can push toward 22. Magical enhancements, ancestry feats with above-cap effects (e.g., Half-Orc Orc Blood Awakened L18, Tiefling Heart of Hell L18), and Mythic abilities continue to interact with the now-higher cap.
- **L1 character creation (Phase 2 scope):** Unaffected. Bumps and Variant Human bonus feats and racial bonuses still cap at 18 at L1.

**Why:**
- The narrative argument for the cap raise is strong: hero-class protagonists in a multi-year campaign deserve mechanical headroom that reflects their exceptional status. Mortal-cap-20 is too restrictive for the project's "play one character for years" framing.
- Gating the cap raise to Mythic onset preserves the bulk of the system's existing balance assumptions. Encounter difficulty, ancestry feat scaling, AI DM calibration, and save DC math all assume cap-20 play through L20. Those assumptions remain valid for the L1–L20 stretch where they were tuned.
- Mythic tier is already the part of the system where exceptional power escalates. The cap raise sits alongside Mythic abilities, Mythic × Theme amplifications, dissonance arcs, and Mythic capstones as a thematically appropriate Mythic feature.
- A character reaching Mythic tier has narratively transcended baseline heroism — moving from "exceptional human" to "legend, demigod, archfey, or worse." The +2 stat headroom signals that transcendence mechanically. The cap raise is *earned* via play, not granted at character creation.

**Implications:**
- **Phase 2 (Prelude → Primary transition):** No engineering work for the cap raise. Step 5's spec uses standard 5e cap math (L1 cap 18, lifetime cap 20).
- **Mythic tier implementation (likely Phase 5 or Phase 7):** Cap raise is one of the threshold effects at Mythic Tier 1 activation. Engineering reads "cap raises from 20 to 22 at Mythic onset, applies to all six stats" and implements as part of Mythic threshold work.
- **Encounter difficulty for Mythic-tier play:** Will need its own calibration pass when Mythic content is fleshed out. The 22 cap means Mythic-tier characters have meaningfully higher save DCs, attack bonuses, and AC than cap-20 baseline assumes. This is on top of the encounter recalibration that Mythic tier already requires (Mythic abilities are powerful in their own right). Worth flagging that Mythic-tier encounter design is a multi-axis problem.
- **Ancestry feat L18 capstones that already break 20 (Half-Orc Orc Blood Awakened max 22, Tiefling Heart of Hell max 22, Human Legend's Prime max 21):** These were originally designed as exceptions to the cap-20 rule. They remain exceptions to the *pre-Mythic* cap-20 rule. With Mythic raising the cap to 22, these capstones now sit at the new ceiling rather than above it. Worth re-examining whether their above-baseline framing still feels exceptional when Mythic-tier characters can reach 22 by other means; possibly an opportunity to revise these capstones as "you reach 22 without needing Mythic onset" or similar lineage-distinct framing. Logged as a follow-up item for the Mythic tier implementation pass.
- **Future opening — Mythic tier triggers:** When Mythic tier triggers for a character, the per-stat cap raise mechanically activates. The conditions under which Mythic triggers (per existing Mythic system design) determine when the cap raise lands. Not Phase 2 work; logged here so the dependency is clear when Mythic implementation picks up.

**Out of scope:**
- Per-Mythic-path stat preferences (Demon-pathed character emphasizing STR/CON, Lich-pathed character emphasizing INT/WIS, etc.). Cap raise is universal across all six stats; per-path mechanical flavor stays in Mythic abilities themselves.
- Gradual cap raises across Mythic tiers (Tier 1 → 21, Tier 3 → 22, etc.). Cap raise is binary at Tier 1; subsequent tiers escalate via abilities, not cap.
- Above-22 caps for any character at any tier. 22 is the ceiling.

**Related:** Phase 2 Pre-Engineering Decision A (setup wizard); Phase 2 Pre-Engineering Decision D (Knight + Haunted One excluded from Prelude); existing Mythic system design (`MYTHIC_REVIEW.md`, `MYTHIC_THEME_AMPLIFICATIONS.md`, `mythicThemeAmplifications.js`); ancestry feat L18 capstones flagged in `ANCESTRY_FEATS_REVIEW.md` Category 2.

### 2026-04-30 — Phase 2 Pre-Engineering Decision D: Knight of the Order and Haunted One excluded from Prelude emergence

**Context:** Phase 2 per-step creator spec walkthrough surfaced that two of the 21 themes don't fit the Prelude's emergent-from-formative-play model. The Prelude produces a character through ages 7–22 of childhood / adolescence / threshold-of-adulthood play; certain themes presuppose conditions that can't reasonably emerge through that arc.

**Decision:** Knight of the Order and Haunted One are manual-mode only. Both are excluded from Prelude `[THEME_HINT]` emission rules and from chapter-weighted theme tally calculation. The Prelude's effective theme pool is 19 themes (out of 21 total).

**Why:**
- **Knight of the Order** requires pre-existing vows or commitment to an order. The path system (true / reformer / martyr / complicit / fallen / redemption) requires time-under-pressure to manifest. A character finishing the Prelude at age 22 hasn't had time to be Fallen, Reformer, Martyr, Complicit, or in Redemption — those paths describe what happens to a True Knight under sustained moral strain. The path defaults to `'true'` for any Knight character (manual mode only); path-shifts continue at runtime via existing DM judgment.
- **Haunted One** requires a player-authored defining traumatic event. The theme's identity presupposes "encountered true horror that fundamentally changed how they perceive reality" — a starting position for play, not an emergence from play. Trauma occurring in the Prelude doesn't automatically make a character a Haunted One; the theme is specifically about being shaped *before* the player meets them.

**Implications:**
- **Chunk 3 (prompt builder):** exclude `knight_of_the_order` and `haunted_one` from `[THEME_HINT]` emission rules. The arc plan generator never pushes the player toward these themes during play.
- **Chunk 4 (marker handling):** exclude these two themes from the chapter-weighted theme tally. If a hint somehow fires for them, ignore.
- **Chunk 5 (creator integration):** the per-theme narrative-continuity copy lookup table for Step 4's handoff-mode framing card has 19 entries (the 19 emergence-eligible themes). Knight and Haunted One have no entry. If a player somehow arrives at Step 4 with one of these themes in handoff mode (not expected per chunks 3/4 rules), the framing card simply doesn't render.
- **No path-locking at handoff for Knight.** The original concern about whether to lock Knight's path at handoff dissolves when Knight can't arrive via handoff. Path management remains entirely runtime.
- **Future opening (not Phase 2 scope):** A "veteran character" creation flow could eventually let manual-mode players commit to non-default Knight paths or pre-authored Haunted-One trauma at character creation. Same general shape — players who want the deeper baggage can author it. Logged for post-MVP consideration if the need emerges.

**Out of scope:** Possible future revisions to the `identity` text on Knight and Haunted One to soften the language that anticipates runtime developments (e.g., Knight's identity currently lists the six paths inline). Code flagged this in passing; not blocking.

**Related:** Phase 2 Pre-Engineering Decision A (setup wizard, 19/21 themes Prelude-eligible aligns with curated theme content); Phase 1 Decision 4 (Ch3 beat sequence — irreversible act → theme commitment → departure, which the 19 emergence-eligible themes support); Phase 2 per-step creator spec Step 3 (Theme handling) and Step 4 (Class & Calling narrative-continuity framing).

### 2026-04-30 — Phase 2 Pre-Engineering Decision C: `creation_phase` Intermediate State

**Context:** The `characters.creation_phase` column currently has two values: `'prelude'` (Prelude in progress) and `'active'` (post-creation, normal play). Phase 1 flagged a possible third value to gate the period between `[PRELUDE_END]` firing and the player completing the main creator. The question is whether the player can break out of the creator handoff and resume later, or whether the handoff is one-shot.

**Decision:** Three states. Add `'ready_for_primary'` as the intermediate value. State transitions:
- New character: `'prelude'` (set when Prelude begins, after setup wizard completes)
- `[PRELUDE_END]` fires: `'prelude'` → `'ready_for_primary'`
- Main creator completed: `'ready_for_primary'` → `'active'`

**Why:** the Prelude is a 4-chapter, multi-hour investment. Gating creator handoff behind "finish in one sitting or lose it" is brittle for a desktop solo game where sessions are interruptible. The intermediate state lets the player close the browser after `[PRELUDE_END]` fires and resume the main creator later without losing Prelude play.

**Player-facing implications:**
- Home page renders two sections when applicable: "Your characters" (state `'active'`) and "In progress" (state `'ready_for_primary'`). Cards in the "In progress" section show name, race, theme, and a "Finish creating" CTA — no level/HP/equipment fields yet because they haven't been chosen. Click → main creator opens at the handoff state for that character.
- Multiplicity handled naturally: a player who has done two Preludes and abandoned both creators sees both cards in the "In progress" section.
- Empty-state home page (no characters at all) shows neither section and surfaces the two-CTA fork (Begin Prelude / Create Character). Once a player has any character — active or in-progress — the home page shifts to section-based layout with a smaller "+ New character" affordance.

**Engineering implications:**
- Database: `creation_phase` column accepts `'prelude' | 'ready_for_primary' | 'active'`. Migration sets existing rows accordingly: any character with `[PRELUDE_END]` fired but no main-creator data → `'ready_for_primary'`; otherwise unchanged. (Edge case probably empty in current DB but the migration should be safe regardless.)
- Transition service (Phase 2 engineering chunk 2): when `[PRELUDE_END]` fires, it now sets `creation_phase = 'ready_for_primary'` rather than triggering creator entry directly. Generates the Prelude payload at this transition and persists it on the character record (so the creator can re-read the payload when the player returns).
- Main creator (rebuild, gated): supports two entry paths — from `[PRELUDE_END]` (initial entry, payload is fresh) and from the home page (resume entry, payload is loaded from persistence). Both paths land on the same Step 1 of the new creator. Submit at Step 8 (Review) flips state to `'active'`.
- Home page (in scope per Decision B): renders the section structure described above. Empty-state and in-progress states are designed in the per-step spec.

**Out of scope:**
- Mid-Prelude abandonment recovery (player closes browser during Ch2, what happens). Currently the Prelude already supports resume via `creation_phase = 'prelude'`; this decision doesn't change that. Any UI improvements to mid-Prelude resume live in a separate design pass.
- Post-creation edit-mode handling. Edit mode runs on a character with `creation_phase = 'active'`; this decision doesn't touch it.

**Related:** PRELUDE_IMPLEMENTATION_PLAN.md §6 (transition flow), §10 (open questions); Phase 2 Pre-Engineering Decision A (setup wizard); Phase 2 Pre-Engineering Decision B (creator rebuild scope, manual + handoff modes).

### 2026-04-30 — Phase 2 Pre-Engineering Decision B: Main Creator Rebuild Scope

**Context:** Phase 1 Decision 1 Consequence 5 surfaced that the existing CharacterCreationWizard.jsx is clunky and cannot cleanly consume the richer character payload the Prelude produces at handoff. Phase 2 needed to decide whether to (A) polish-rebuild the existing 5-step creator, (B) rebuild with a new step structure supporting both manual and Prelude-handoff entry paths, or (C) rebuild as a tabbed character-sheet-shaped creator. The rebuild also has to interact with the future Themes-Replace-Backgrounds character sheet without locking us into a data model that fights it.

**Decision:** Option B. Full rebuild. New step structure designed around the actual decisions a player makes, supporting two co-equal entry paths: manual creation (player builds a character from scratch, no Prelude) and Prelude-handoff (character arrives pre-filled from Prelude emergence; player confirms or edits). Both paths are first-class — every field works in both modes, with locked-but-visible treatment in handoff mode.

**Starting step structure (subject to per-step spec refinement):**
1. Identity — name (with use-name editing affordance), gender, avatar.
2. Ancestry — race, subrace, ancestry feat (with sub-choices). Locked from setup + emergence in handoff mode.
3. Class & Calling — class, subclass, spellcasting selections (cantrips/spells/Keeper texts/Variant Human feat). Free choice in both modes.
4. Theme — theme, theme path choice. Locked from Ch3 commitment in handoff mode.
5. Ability Scores — Standard Array or Manual, ability scores, skill proficiencies. Free choice in both modes; desktop layout uses horizontal real estate (scores + skills side-by-side) instead of stacking.
6. Equipment — current Step 4 redesigned but largely intact. The one part of the existing creator that works.
7. Identity Details — alignment, faith, lifestyle, physical appearance, personality traits/ideals/bonds/flaws. Authoring surface in manual mode; pre-filled with confirm/edit in handoff mode.
8. Review — final summary before save.

**Why Option B over A and C:**
- Option A (polish-rebuild) leaves Step 1's decision-density problem in place and structurally cannot support the locked-from-Prelude affordances cleanly. Cheap but doesn't solve the actual problem.
- Option C (tabbed character sheet as creator) is a hostile first impression for new players who've never made a D&D character. The empty-state entry — first thing a new player sees with no characters — needs a guided flow, not a wall of tabs.
- Option B's "more steps but each smaller" structure correctly diagnoses that the existing creator's problem is decision-density per step, not step count.

**Why two co-equal modes (Possibility 3 of three options considered):**
Not every player wants to play 4 chapters of Prelude before getting to their character. Manual creation must remain a first-class path — the home page exposes both "Begin the Prelude" and "Create a character" as prominent equal-weight CTAs. This means every step has to author cleanly from scratch (manual mode), not just confirm pre-filled fields (handoff mode).

**Empty-state home page redesign:** in scope. Cleaner empty state with the two-CTA fork (Prelude / Manual). The current home page surfacing the creator inline as the first thing a new player sees gets replaced.

**Specific failures of the existing creator the rebuild must fix:**
- Step 1 carries 10+ decisions including the heaviest one (ancestry feat with sub-choices); spread across new Steps 1, 2, 3, 4.
- Theme/background data model is mid-migration with the seam visible in the UI; rebuild commits fully to Theme.
- Ability-score step is a wall (toggle + 6 scores + skills + conditional Variant Human feat picker + conditional Keeper picker + conditional cantrip picker + conditional spell picker); spellcasting selections move into Step 3 (Class & Calling) where they belong.
- Step 3 personality is nine textareas of cold-start fiction; in handoff mode pre-filled from Prelude emergence, in manual mode redesigned with smaller authoring units.
- Conditional UI explodes inside steps with no warning; rebuild surfaces sub-decisions explicitly per step.
- Next button silently disables on chained conditions; rebuild surfaces unmet conditions explicitly.
- Inline `style={}` everywhere with rainbow color schemes; rebuild gets a unified visual system via Claude Design.
- 1500-line single component fuses create-mode and edit-mode; rebuild splits cleanly.
- No support for AI-introduced use-names (e.g. "Aelar of the Silver Glade"); Step 1 includes editable use-name affordance.

**Process commitments:**
- Per-step spec drafted in PM chat with playtester (lock step structure → walk through each step → empty-state home page → full doc).
- Locked spec handed to Claude Design for clickable mockup. Playtester reviews mockup before any engineering wire-up.
- Engineering Phase 2 chunks 1-4 (setup wizard, transition service, prompt builder, marker handling) can start immediately. Chunk 5 (main creator integration) gates on per-step spec being locked AND Claude Design mockup approved.

**Data contract (high level — refined in per-step spec):**
The Prelude payload at handoff includes:
- Locked: race/subrace, theme + theme path, ancestry feat (with feat_id from `[ANCESTRY_HINT]` tally), starting class hint (if emerged), key NPCs (`[NPC_CANON]` entries from the arc).
- Pre-filled but editable: name (including any AI-introduced use-name with revert affordance), suggested alignment, suggested lifestyle, emerged personality traits/ideals/bonds/flaws (as authored sentences, not slot picks), suggested physical appearance details if mentioned in narrative.
- Free choice in both modes: ability scores, skills, spellcasting selections (cantrips/spells/etc.), faith, equipment.

Engineering Chunk 2 (transition service) generates this payload shape; Chunk 5 (creator integration) consumes it. Specific field names and shapes locked in the per-step spec.

**Out of scope (logged for follow-on phases):**
- Post-creation character sheet rebuild (Origin & Identity hi-fi tab, Themes-Replace-Backgrounds full surface). Creator rebuild's data model has to be compatible with that future sheet but the sheet itself is a separate design pass.
- Edit-mode rework. Existing edit-mode logic carries forward into the new creator with minimal changes; full edit-mode UX rethink waits until character sheet design lands.

**Related:** `PRELUDE_IMPLEMENTATION_PLAN.md` §6 (transition flow), §10 (open questions); Phase 1 Decision 1 Consequence 5 (creator rebuild needed); Phase 2 Pre-Engineering Decision A (setup wizard content revisit); `client/src/components/CharacterCreationWizard.jsx`; `Claude UX Design/D&D Meta Game (Remix)/Themes-Replace-Backgrounds.md`.

### 2026-04-30 — Phase 2 Pre-Engineering Decision A: Setup Wizard Content Revisit (Direction)

**Context:** Phase 1 closed 2026-04-29 with `PRELUDE_IMPLEMENTATION_PLAN.md` §10 listing the setup-wizard content revisit as "resolved at Phase 2 start" — a pre-engineering design call that has to happen before Code runs the engineering chat. Two known changes were already committed by Phase 1 (tone-tag question cut per Decision 3; authority-figure question added per Decision 1). The full content + UX pass had been deferred. Current wizard: 11 numbered questions plus two sub-forms (parents, siblings); known to be bloated and partly orphaned (e.g. Q10 "cares" seeded the cut values tracker).

**Decision:** Wizard rebuilt to 10 questions. One optional escape-valve free-text field added. Cuts and adds:

**Cut:**
- Q9 (talents) — pre-loads class/theme expectations against Phase 1's "play sets the character" principle.
- Q10 (cares) — seeded the values tracker cut by Decision 3; orphaned.
- Q11 (tone preset) — replaced by locked tone description per Decision 3.

**Add:**
- Q9 (authority figure) — single-select curated, 8 options. Phase 1 Decision 1 commitment.
- Q10 (anything else?) — optional free-text, 2000 char cap. Escape valve for players with a specific origin fantasy that the curated lists don't capture.

**Restructure:**
- Q8 (siblings) — replace variable-length sub-form (per-sibling: name, nickname, race, gender, relative_age) with single dropdown of 9 options. AI generates names and dynamics during Ch1 narrative play. Free-text override removed (Q10 catches edge cases).

**Carry forward unchanged:**
- Q1 (name), Q2 (gender), Q3 (race/subrace), Q4 (birth circumstance), Q5 (home setting), Q6 (region), Q7 (parents sub-form including per-parent race override).

**Help text additions:**
- Q1: surname-blank guidance (cultures vary; AI may introduce a use-name through play).
- Q3: race-naming-convention heads-up.
- Q8: pointer to Q10 for unusual sibling configurations.

**Wording:** intro paragraph rewritten (4 sessions, 10 questions, "ancestry feat and ability bumps" replacing "values"). Q9 and Q10 stems and option phrasings drafted. Q9 options each get a one-line clarifier rather than a single-word tag.

**Validation rule added:** Q8 "only child" + Q9 "older sibling" produces a warning; one must change.

**Why:** The setup wizard's job is to set the *world* the character was born into; play sets *who the character is*. Talents and cares conflicted with that principle and pre-loaded class/theme expectations the emergence system was designed to handle through play. Tone preset was already locked to the fixed tone description. Sibling sub-form was disproportionate work for a question whose dynamics the AI handles better in narrative. The escape-valve Q10 catches the "I have a specific origin in mind" case that the simplified curated lists can't, without re-bloating every per-question free-text override.

**Implications:**
- Setup data blob schema: drop `talents`, `cares`, `tone_preset`/`tone_tags`, the `_other` free-text fields for siblings; add `authority_figure` (enum), `origin_freeform` (text). Other fields unchanged.
- Prompt builder (chunk 3 of Phase 2 engineering): add `authority_figure` and `origin_freeform` into the arc plan generation prompt. `authority_figure='mentor'` is the precondition for mentor NPC generation and `[NPC_CANON]` emission in early chapters. `origin_freeform`, when present, must be honored over conflicting curated answers — explicit instruction needed.
- Ancestry feat gating throughout the Prelude: `[ANCESTRY_HINT]` markers carry a `feat_id`; server validates `feat_id` is in the player's race's allowed feat list. Required for the chapter-weighted ancestry tally to be coherent at handoff. Cross-cut between chunk 3 (prompt builder) and chunk 4 (marker handling).
- Main creator at handoff (separate decision pending): name field must be editable, including reverting any use-name the AI introduced through play. Logged as a constraint on the main-creator rebuild scope decision.
- Q4 birth circumstance list bias: leans socioeconomic; gappy on flavor/fated origins. Free-text override mitigates. Phase 7 watch-item: if Preludes feel same-y, revisit list breadth.
- Phase 4 diagnostic gains a new test: does the AI honor `origin_freeform` when present, or generic-ify it? If the AI ignores or softens specific origins, that's a prompt-engineering bug.

**Parked for future:**
- Multi-tone selection return — v2.0.0+ (already parked per Decision 3).
- Q4 list breadth revisit — Phase 7, conditional on playtest.

**Related:** PRELUDE_IMPLEMENTATION_PLAN.md §2 (player flow), §6 (transition flow), §10 (open questions); Phase 1 Decision 1 (outputs spec; mentor as setup choice; living biography seeding); Phase 1 Decision 3 (machinery audit; tone-tag cut; values tracker cut); `client/src/components/PreludeSetupWizard.jsx`; `client/src/data/preludeSetup.js`.

### 2026-04-29 — Phase 1 Decision 3 (sub-deliverable): Tone description for "epic fantasy in a lived-in world" (Prompt design)
**Context:** Decision 3 cut the 16-tone-tag system in favor of a single fixed tone for MVP, deferring multi-tone selection to v2.0.0. The fixed tone needed an actual prompt-ready description — a one-line label ("epic fantasy in a lived-in world") doesn't tell the AI anything the words don't already imply. PM brought a first draft (gritty + lived-in), user pushed back: too dark, missing the "epic" of epic fantasy, missing the wonder and weirdness of Faerûn's depth. PM also flagged risk of AI taking concrete tone-description details as canon facts about the player's world. Three mitigation options: (a) abstract language only, (b) mark examples as examples in-prompt, (c) use Faerûn-shaped examples that already exist as types in the world. PM initially mis-rated and recommended (c) while labeling it worst; on re-rating, (c) is best — the Faerûn anchor defangs the canon-seeding risk because the example details already exist in the canonical world.
**Decision:** Lock the three-paragraph tone description (Draft 2) into Phase 1's deliverables. Structure: a guard sentence at the top (concrete details are illustrative, not canon — specific facts come from arc plan and player setup), followed by three paragraphs — *what this tone is* (epic fantasy in the Forgotten Realms; grand and granular share the scene; wonder and mundane both real), *what this tone is not* (not generic, not high-camp, not YA-coded, not grimdark, not safe), *beats this tone reaches for* (quiet scenes earning weight, competent and tired NPCs, fast/dirty combat, magic that costs something, old places that feel old, legends that may or may not be true, knights/monsters/gods/ruins/rumors alongside fields and kitchens). The directive against shelter-behavior (protagonist's age affects what they understand, not what the world is willing to do to them) lives in the second paragraph at tone-setting altitude rather than as a separate Cardinal Rule.

The locked text:

> Concrete details in this description are illustrative of register and texture. They are guidance for what kinds of things belong in scenes; they are not canon facts about the player's world. Specific places, names, NPCs, and circumstances come from the arc plan and the player's setup answers, not from this tone description.
>
> What this tone is. This is epic fantasy in the Forgotten Realms — a world with deep history, real gods, working magic, and ancient places that remember things humans don't. The map has been walked for thousands of years. There are ruins older than nations, artifacts whose owners are long dead, mountain ranges where dragons sleep, and crossroads where small choices have echoed for generations. And this world is also lived in: bread is baked, debts are owed, taverns smell of smoke, knees ache, and most people have never seen a wizard. The grand and the granular share the same scene. A child can grow up watching their father shoe horses and also know that a knight of an ancient order rode through their village last spring. Both things are real. The wonder doesn't make the mundane less true; the mundane doesn't make the wonder less wondrous.
>
> What this tone is not. It is not generic fantasy where the world arranges itself around the protagonist's importance. It is not high-camp parody, video-game-pastiche, or YA-coded fantasy that sands down moral edges to make them easier. It is also not grimdark — this world has light, beauty, decency, and people who help each other for no reason. It is not safe, either. Children in this world get hurt. Parents disappoint. Mentors die. Choices have lasting cost. The protagonist's age affects what they understand and how they feel, not what the world is willing to do to them. Do not soften consequences because the protagonist is young; a coming-of-age story in this world can include real loss, real fear, and real moral weight, and the best ones do.
>
> Beats this tone reaches for. Quiet scenes that earn their weight before the loud ones land. NPCs who are competent at their actual jobs, suspicious of strangers, occasionally generous, often tired — and a few who have seen things they don't talk about. Combat that is fast, dirty, and frightening at any age. Magic that costs something, that feels strange, that doesn't always behave. Old places that feel old. Legends that may or may not be true but are part of the cultural air. Moments of unexpected tenderness in hard places. Choices that cost something whichever way the player goes. Knights, monsters, gods, ruins, and rumors — alongside fields, kitchens, market days, and the work of being alive. The world is real; it does not negotiate. It is also full of wonder; honor that too.

**Why:** Three paragraphs is the minimum length to give the AI usable signal about register and texture; a one-line label is inert. Naming Forgotten Realms explicitly draws on the AI's existing canonical knowledge rather than asking the prompt to bootstrap a world. Folding the shelter-behavior corrective into the tone description (rather than as a separate Cardinal Rule) puts it at tone-setting altitude — the original Cardinal Rule 2 was being misread as "kid-friendly content" rather than "age-appropriate inner voice within an adult-stakes story," and elevating the corrective changes its visibility in the prompt structure. The "not grimdark" line responds to the user's pushback that Draft 1 was too dark and missed the "epic" of epic fantasy. The "wonder doesn't make the mundane less true; the mundane doesn't make the wonder less wondrous" framing makes both registers load-bearing rather than treating one as the dominant note. Faerûn-shaped examples (knights, dragons, ruins, taverns) defang the canon-seeding risk because they are already canonical to the world; category-texture details (bread, knees, smoke) paint register without committing specific facts; the guard sentence catches residual risk.
**Implications:**
- The locked text becomes the tone block in `preludePromptBuilder.js` (Phase 2 engineering work). Wired into the always-on prompt at the position currently occupied by tone-tag injection.
- Cardinal Rule 2 ("age-appropriate everything") in the existing prompt is superseded by the directive within paragraph two of the tone description. Cardinal Rules are reduced by one. Phase 2 prompt builder updates accordingly.
- Phase 4's AI shelter-behavior diagnostic now has a specific artifact to test against. The diagnostic tests whether elevating the corrective to tone-setting altitude (rather than burying it in Cardinal Rules) is sufficient to override the shelter-default. If not, further prompt-engineering work is needed — likely in the form of more explicit framing, repeated reinforcement at scene-open, or per-chapter tone instruction (Ch1 carries the highest shelter risk per Decision 5).
- The tone description is treated as living text, not frozen. Playtesting may surface places where the AI mis-reads, over-leans on Faerûn-typical types, or underdelivers on a specific register. Revisions follow the same loop as the prose-quality H7/H8 work: identify the failure, adjust the text, re-validate. The text should not be treated as untouchable.
- Multi-tone selection remains parked for v2.0.0. When that work resumes, the Faerûn-anchored "epic fantasy in a lived-in world" tone becomes one of several available presets rather than the only available one.
**Related:** PRELUDE_IMPLEMENTATION_PLAN.md (will be updated at end of Phase 1); Decision 3 (machinery audit, parent decision); AI_NARRATIVE_PERSISTENCE.md (Phase 4 shelter-behavior diagnostic); the H7/H8 prose-quality work (precedent for the diagnostic loop).

### 2026-04-29 — Phase 1 Decision 6: Long-term thread seeding from Prelude (Direction)
**Context:** During Decision 5 (pacing), user surfaced a real concern that the current Prelude design under-serves long-term consequence — Prelude beats persist as static canon (NPCs, locations) but don't seed *unresolved threads* that can resurface years into the main campaign. User cited examples: missing parents resurfacing, killed NPCs' children pursuing revenge 30 years later, the law catching up after years of near misses. User also surfaced a related insight that NPC memory could be asymmetric — the world remembers, but individual NPCs forget — which lets us bound the engineering problem rather than seeding every NPC's memory permanently.
**Decision:** Two parts.

**Part 1 — `[CANON_THREAD]` marker (Phase 1 commitment).** New marker fired by the AI during Prelude play when a beat creates an unresolved narrative obligation the world will hold. Separate from `[NPC_CANON]` and `[LOCATION_CANON]` — those persist entities; `[CANON_THREAD]` persists obligations. Four fields per thread:
- `kind` — thread type. Categories: `unresolved_loss`, `blood_debt`, `unfulfilled_oath`, `unpaid_crime`, `unfinished_relationship`, `held_object`, `held_secret`.
- `subject` — references an existing `[NPC_CANON]` / `[LOCATION_CANON]` entity or an abstract noun.
- `condition` — what triggers the thread to ripen ("PC returns to home region after 5+ years," "PC encounters anyone bearing the family name," etc.).
- `weight` — `minor` / `notable` / `major`. Major threads should resurface; minor may.

New table `prelude_canon_threads` (Phase 2 schema work) mirroring the shape of `prelude_canon_npcs` — character_id FK, kind, subject reference, condition, weight, status (active / ripened / resolved / decayed). At handoff, threads transfer to a `campaign_threads` table for main campaign consultation. Prompt builder (Phase 2) needs explicit calibration examples — the AI fires `[CANON_THREAD]` only when a genuinely unresolved obligation is created, not on every beat.

**Part 2 — Asymmetric NPC memory model (parked for Phase 3).** Canon NPCs persist as entities; their *memory of the PC* has a decay model. Strong memories (raised the PC, witnessed killing the PC, married the PC) decay slowly or not at all. Weak memories (sold bread once at age 9, exchanged five words at a market) decay within a few years of in-fiction time. When the PC returns and an NPC's memory has decayed, the NPC behaves like a stranger; the *world* may still hold the thread (the cobbler doesn't remember the PC, but a child the PC saved twelve years ago is now the town guard). This is logged as a design principle here. Engineering shape — likely the "scalar + label + audit trail" abstraction that's already Refactor 3.1 in CONSOLIDATED_TODO.md — is Phase 3 work.

**Why:** The brief's first definition of "done" — *"a single character playable for literal years without the AI losing context"* — explicitly flags long-term entity and thread persistence as load-bearing. Without thread infrastructure, Prelude beats become a microcosm: vivid in the moment, inert afterward. Threads are how the Prelude earns its place as the foundation of a years-long character. Distinguishing **NPC memory** (decays) from **world threads** (don't decay until resolved) bounds the engineering problem — we don't have to seed every Prelude NPC's memory permanently into the AI's context budget. The asymmetric memory model also matches how memory actually works (most strangers don't remember you), which makes the world feel real rather than artificially small.

**Implications:**
- Phase 1 commits `[CANON_THREAD]` as a marker concept with four fields. Schema and prompt-builder work happen in Phase 2 alongside other transition engineering.
- Phase 3 (AI Narrative Persistence foundation refactors) absorbs the asymmetric NPC memory model as a use case for Refactor 3.1 (scalar + label + audit trail). NPC-memory-strength becomes one of the things the unified abstraction handles, alongside companion loyalty, faction standing, Mythic piety, etc.
- Phase 4 (AI behavior diagnostic) inherits the question of whether the AI fires `[CANON_THREAD]` reliably and whether the main campaign AI consults transferred threads correctly. Both are AI-behavior-pattern-matching concerns of the same shape Phase 4 is designed to investigate.
- The thread mechanism strengthens the Prelude's value proposition against "pick a background and start at age 20" (Decision 1, Criterion 4): the Prelude doesn't just give the character a past — it gives the *world* unfinished business with that character. That's a meaningful difference no background mechanic delivers.
- Calibration risk: the AI may over-fire `[CANON_THREAD]` (every beat becomes a thread) or under-fire (genuinely unresolved obligations don't get tagged). This is a prompt-engineering concern for Phase 2; mitigated by explicit examples in the prompt builder of what does and doesn't warrant a thread.
**Related:** PRELUDE_IMPLEMENTATION_PLAN.md (will be updated at end of Phase 1); AI_NARRATIVE_PERSISTENCE.md (asymmetric NPC memory becomes a Phase 3 use case for Pattern A); CONSOLIDATED_TODO.md Refactor 3.1; Decision 5 (where the concern surfaced).

### 2026-04-29 — Phase 1 Decision 5: Pacing across three chapters (Direction)
**Context:** With three-chapter structure (Decision 2) and Ch3 beat sequence (Decision 4) committed, pacing was the remaining structural call. Three sub-questions: (1) sessions per chapter, (2) time-compression techniques per chapter, (3) rhythm guidance per chapter. Initial PM proposal was Ch1=1 / Ch2=1 / Ch3=2 (4 sessions, ~4-7 hours). User pushed back arguing Ch2=2 was needed for short-term consequence breathing room within the chapter. PM brought a compromise — Option C — using intra-Ch2 AGE_ADVANCE to deliver two distinct emotional registers (e.g., ages 11-13 then 13-15) within one session, preserving Decision 2's length discipline.
**Decision:** Option C. **Sessions:** Ch1=1, Ch2=1, Ch3=2 (4 sessions total, ~4-7 hours). **Ch2 internal structure:** explicit intra-session AGE_ADVANCE that splits Ch2 into two halves with different ages and emotional registers, allowing consequences from the first half to land in the second within one session. **Time-compression by chapter:** Ch1 = high (rhythm-compression + multiple AGE_ADVANCE fires carrying ages 6-10); Ch2 = medium (selective-detail + 1-2 AGE_ADVANCE fires, including the deliberate intra-session split); Ch3 = minimal (real-time scene weight; AGE_ADVANCE rare, mostly between Ch3a and Ch3b). **Rhythm by chapter:** Ch1 establishing (short atmospheric scenes, no combat, observational), Ch2 widening (lengthening scenes, rising stakes, combat introduces, theme/class hints accumulate, chapter-promise beat at opening), Ch3 real (full-weight scenes, real stakes, chapter-promise beat at opening, irreversible act builds across Ch3a, theme commitment + departure resolve in Ch3b).
**Why:** Option C honors the user's correct instinct that Ch2 consequences need breathing room without expanding session count to the original 5-session shape. The intra-session AGE_ADVANCE technique already exists and is meant for exactly this — making explicit use of it inside Ch2 is a refinement of existing design, not new machinery. Total length stays at 4 sessions / 4-7 hours, preserving Decision 2's discipline. Splitting Ch2 across two sessions (the rejected Option A) would have walked back from Decision 2, recreated the original "too long" problem, and added session-overhead time without proportional content gain. Splitting Ch2 across one session with internal time-jump is more elegant — it matches what Ch2 *is* (the widening years where the same character is a different person at 11 vs 14).
**Implications:**
- Ch2's prompt builder needs explicit examples of AGE_ADVANCE rendered as compressed prose ("the autumn after that, you turned twelve…") rather than announced as a cut. Prompt-engineering risk: a mid-session time jump that lands wrong is jarring. Playtesting will validate; fallback is splitting Ch2 into two sessions if the prompt-side fix doesn't suffice.
- Cliffhanger marker (`[SESSION_END_CLIFFHANGER]`) fires at end of Sessions 1, 2, and 3. Session 4 ends on `[DEPARTURE]` + `[PRELUDE_END]`, no cliffhanger.
- Chapter promises fire at Ch2 opening and Ch3 opening (per Decision 3). Ch1 opens organically.
- Shelter-behavior risk concentrates in Ch1 (young child, observational, household scenes). Phase 4's diagnostic and prompt-engineering work should focus most energy on Ch1's tone-fidelity instructions. Decision 5's pacing shape is structurally helpful for Phase 4 — it isolates the failure mode.
- Player journey end-to-end: setup wizard → arc plan → arc preview → Session 1 (Ch1, ~1-1.5 hrs, ages 6-10) → Session 2 (Ch2, ~1-1.5 hrs, ages 11-15 split into two halves) → Session 3 (Ch3a, ~1-1.5 hrs, irreversible act builds and lands) → Session 4 (Ch3b, ~1-2 hrs, aftermath, theme commitment, departure, `[PRELUDE_END]`) → transition screen → main creator handoff.
- Each Ch3 session needs explicit pacing guidance: Ch3a builds toward the irreversible act with real-stakes scenes that earn the act when it lands; Ch3b plays the aftermath at full scene weight, gives the theme commitment its quiet moment, and lets the departure breathe rather than rushing it.
**Related:** PRELUDE_IMPLEMENTATION_PLAN.md (will be updated at end of Phase 1); Decision 2 (three-chapter structure); Decision 4 (Ch3 beat sequence).

### 2026-04-29 — Phase 1 Decision 4: Ch3 beat sequence (Direction)
**Context:** Decision 2 collapsed Ch4 into Ch3, which now absorbs three weight-bearing beats: theme commitment, irreversible act, and departure. Decision 3 simplified the theme commitment to a lightweight in-line card (leading theme + 3 alternatives + choose-your-own). The remaining open question was the order in which the three beats land within Ch3. PM brought three orderings: A (act → commitment → departure), B (commitment → act → departure), C (act → departure → commitment).
**Decision:** Option A. Irreversible act fires first; theme commitment surfaces in the aftermath; departure follows from the committed identity.
**Why:** The irreversible act is the felt evidence that earns the commitment — the player ratifies who their character is *because* of what they just did, not as an abstract pick from a list. The departure then takes its tone and shape from the committed theme, preserving the existing `THEME_DEPARTURE_MAP` logic (soldier → enlistment, acolyte → pilgrimage, etc.). The sequence also gives Ch3 narrative rhythm: high-intensity act → quiet reflective commitment → high-stakes departure. Option B would have the AI writing the irreversible act through a pre-chosen theme lens, pre-loading the answer. Option C handles only involuntary departure types (exile, flight) cleanly and breaks for chosen departures.
**Implications:**
- Ch3 prompt builder needs explicit pacing guidance: irreversible act, theme commitment, and departure are three distinct beats, each given its own scene weight. The AI must not compress them into one paragraph or one scene.
- The arc plan generator's Ch3 section should describe the *shape* of the irreversible act (what the act might look like given the player's accumulated character) without naming the theme — the act has to land before the lens is chosen.
- The `[THEME_COMMITMENT_OFFERED]` marker fires *after* the irreversible act resolves, not before.
- The `[DEPARTURE]` marker fires *after* the commitment is made (or, if the player defers commitment, after the AI commits to the trajectory winner per existing fallback logic). Departure tone and reason are shaped by the committed (or trajectory-winning) theme.
- Pacing of Ch3 (one session vs. two) deferred to Decision 5. The three-beat density may warrant Ch3 being two sessions if a single session can't carry act + commitment + departure with appropriate weight.
**Related:** PRELUDE_IMPLEMENTATION_PLAN.md (will be updated at end of Phase 1); Decision 2 (three-chapter structure); Decision 3 (theme commitment ceremony simplification).

### 2026-04-29 — Phase 1 Decision 3: Machinery audit (Direction)
**Context:** With three-chapter structure committed (Decision 2), each piece of existing Prelude machinery needed to be evaluated against the locked outputs and new shape: keep, modify, or cut. Current design has eight load-bearing systems plus several smaller markers and infrastructure pieces.
**Decision:** Eight machinery items resolved as follows.

**Keep as-is:**
- Five emergence markers: `[STAT_HINT]`, `[SKILL_HINT]`, `[CLASS_HINT]`, `[THEME_HINT]`, `[ANCESTRY_HINT]`. Class and ancestry tallies feed handoff suggestions only (not commitment); theme tally drives Ch3 commitment.
- Irreversible act recognition beat at Ch3.
- Arc plan (Opus-generated structured JSON at setup completion) — load-bearing for tone, NPC seeding, recurring threads, departure shape. Regenerated for three chapters.
- Age-scaled provisional stats (HP/AC/weapon damage by age bracket).
- `[SESSION_END_CLIFFHANGER]`, `[NPC_CANON]`, `[LOCATION_CANON]`, `[DEPARTURE]`, `[PRELUDE_END]` markers.

**Keep + simplify:**
- Theme commitment ceremony at Ch3. UI lightens to a single in-line card: leading theme + 3 alternatives + "choose your own." No wildcard, no defer, no full-screen takeover. Integrates into the Ch3 climax cluster (theme commitment + irreversible act + departure) without breaking flow.

**Keep + repurpose:**
- Remembered-voice backstory generation. No longer a one-shot 3-5 paragraph dump at Prelude end. Becomes the *seed entries* for the living biography (per Decision 1's Consequence 3). Output format is appendable — entries timestamped by in-fiction age + chapter, not one continuous prose blob. Voice (remembered, with allowed gentle distortion) preserved as a felt-output mechanism in its own right. Living-biography schema and UI are Phase 2 work.

**Keep + shift:**
- Chapter promises. Now fire at Ch2 + Ch3 openings (was Ch3 + Ch4). Ch1 (ages 6-10) remains too young for self-reflection beats; opens organically. Server-side `[CHAPTER_PROMISE]` validator updates: accepts at Ch2/Ch3, rejects at Ch1 with `[SYSTEM]` injection feedback to AI.

**Modify:**
- Chapter-weighted tally. Three-chapter weights: Ch1 = 1×, Ch2 = 1.5×, Ch3 = 2×. Class and ancestry tallies feed handoff suggestions (not commitment); theme tally drives Ch3 commitment ceremony. Math infrastructure unchanged; targets clarified.

**Cut:**
- `[VALUE_HINT]` marker (values tracker cut in Decision 1).
- Values paragraph generation (no input data anymore).
- Transient-canon flag for Ch4 NPCs (Ch4 is gone; no road-life NPCs to flag). If shipped, leave column unused; otherwise don't add it.
- **Tone tags as a system.** All 16 tone tags cut for MVP. Single fixed tone: "epic fantasy in a lived-in world." Tone description to be drafted as a Phase 1 sub-deliverable before close. Multi-tone selection deferred to v2.0.0 implementation.

**Why:** Cuts (values tracker, tone tags, Ch4 transient flag) align machinery with the locked outputs. Theme commitment ceremony simplification responds to Ch3's three-beat density (commitment + irreversible act + departure) — a full UI takeover would feel stagey when stacked. Repurposing the remembered-voice backstory honors Decision 1's living-biography concept without losing the voice that makes it work. Chapter promise shifting reflects the three-chapter ages: self-reflection beats land naturally at age 11+ (Ch2 opening) and age 16+ (Ch3 opening), not earlier.

**Implications:**
- Setup wizard revisit (mentor question addition, tone-tag removal, possible bloat trimming) parks for Phase 2 start. Phase 2 begins with a content + UX pass on the wizard before engineering work proceeds. Phase 1 records known changes; full content pass deferred. The wizard rebuild interlocks with the broader character creator rebuild flagged in Decision 1's Consequence 5; both designed together at Phase 2 start.
- Tone description for "epic fantasy in a lived-in world" becomes a Phase 1 deliverable, drafted between PM and user before Phase 1 closes. The paragraph describes what the tone *is*, what it *is not*, and what beats it leans toward. Wired into prompt builder during Phase 2 engineering.
- Phase 4 (AI shelter-behavior diagnostic) still required. Eliminating per-player tone choice removes one variable but does not address the AI's default-to-shelter behavior with child protagonists. The fixed tone gives the AI one signal to honor; whether that signal is load-bearing enough to override the shelter-default is what Phase 4 must test.
- Schema impact minimal: `prelude_arc_plans.chapter_4_arc` JSON column stops being populated for new preludes (additive-only schema; harmless). `prelude_values` table can be dropped or left unused. Tone-related columns/JSON stop being read.
- The `[CHAPTER_PROMISE]` server validator and the chapter-weighted tally math both need code updates in Phase 2 engineering. Documented as Phase 2 inputs.
- Ch3 absorbs three weight-bearing beats (theme commitment, irreversible act, departure) plus the simplified theme card. Decision 5 (pacing) must address whether these compress into one session or warrant Ch3 being two sessions, and how the AI sequences them.
- Decision 4 (theme commitment placement) is now a smaller question — the *shape* of the commitment is locked (in-line card, 3 alternatives, choose-your-own); only the *exact* placement within Ch3 remains open.

**Parked for Phase 2 start:**
- Setup wizard content + UX revisit. Includes: drop tone-tag question, add mentor/guardian question (per Decision 1), bloat trimming, possible question consolidation, integration with broader character creator rebuild.

**Parked for v2.0.0:**
- Multi-tone selection (16 tone tags or successor). Re-introduce when MVP is shipping clean; until then, single fixed tone serves.

**Related:** PRELUDE_IMPLEMENTATION_PLAN.md (will be updated at end of Phase 1); Decision 1 (outputs spec); Decision 2 (three-chapter structure).

### 2026-04-29 — Phase 1 Decision 2: Three-chapter structure (Direction)
**Context:** With outputs locked (Decision 1), the question was how many distinct life-stage moments are required to deliver them. Current design is four chapters (Ch1 OBSERVE / Ch2 LEARN / Ch3 DECIDE / Ch4 BECOME-BRIDGE) at 5 sessions, 7-10 hours total — too long for available play sessions. PM brought three options: A (2 chapters, 3-5 hrs), B (3 chapters, 4-7 hrs), C (4 chapters tightened, 5-8 hrs).
**Decision:** Option B — three chapters. **Ch1 Childhood (ages ~6-10):** home, family, place; witnessing more than acting; skill-check tutorial begins; light to no combat. **Ch2 Adolescence (ages ~11-15):** world widens; real choices with smaller stakes; combat introduced (training, schoolyard, first defensive moments); theme affinity accumulates. **Ch3 Threshold (ages ~16-19):** real stakes, real combat, theme commits, irreversible act, departure. Ch4 collapsed entirely. Estimated 4-7 hours across 3-4 sessions.
**Why:** Option B is the only structure where felt output #2 ("NPCs feel real") clears the bar — two chapters compresses NPC scene-time, four is over-scoped now that class commits at handoff. Three chapters honor the original Prelude review diagnosis (design is sound, AI behavior is the problem) — calibration, not teardown. Each NPC gets multiple scenes across multiple life-stages so the player sees them change as the PC grows; that's where "feels real" lives. Theme has sufficient affinity-accumulation runway across Ch1-2 before Ch3 commits. Tutorial paces naturally — skill checks early, combat introduced gradually, real combat in Ch3.
**Implications:**
- The Round 3 reframe (Ch4 as BECOME / bridge to adventuring) is superseded. With class moved to handoff (Decision 1), Ch4's load-bearing reason for existing — "be on the road, realize you've changed, commit-via-action" — no longer applies. Class committing at handoff means the player walks into the main creator already feeling like they've left.
- The "you've been on the road for a while" beat moves to main campaign opener responsibility. Phase 2 (engineering) will need to design the campaign-opener-from-prelude shape: the first session of the primary campaign opens with the character having traveled, not with the moment-of-departure. That's a campaign-design concern, not a Prelude-design concern.
- Ch3 absorbs three weight-bearing beats: theme commitment, irreversible act, departure. This is the packed chapter. Decision 5 (pacing) will need to address whether these compress into one session or warrant Ch3 being two sessions.
- The arc plan generator (`preludeArcService.js`) needs to regenerate against three chapters instead of four. The `chapter_4_arc` JSON column becomes unused; new preludes don't populate it. Schema can stay as-is (additive only after migration 011); existing logic just reads three chapter_arc fields instead of four.
- Chapter promises (currently fire at Ch3 + Ch4 openings) now fire at Ch2 + Ch3 openings. The "what is this chapter about" beat lands when the PC is old enough to self-reflect (~age 11+).
- `[CHAPTER_PROMISE]` server validator updates: rejects firing at Ch1 (too young to self-reflect), accepts at Ch2 and Ch3.
- `THEME_DEPARTURE_MAP` continues to drive the departure type at Ch3's tail, with tone preset modulating feel. No change to the mapping itself.
- The departure beat in Ch3 must give *each* of {theme commitment, irreversible act, departure} its own scene weight — explicit pacing guidance in the AI prompt to prevent compression into one paragraph.
- Length lands at 4-7 hours / 3-4 sessions, closer to actual play-session reality. Still not "play in one sitting" short. If reality forces shorter, Option A (two chapters, 3-5 hrs) is the fallback — re-evaluate at Phase 7 if Option B's length still doesn't fit.
**Related:** PRELUDE_IMPLEMENTATION_PLAN.md (will be updated at end of Phase 1); Round 3 reframe entry within that document (now superseded by this decision); Decision 1 (outputs spec).

### 2026-04-29 — Phase 1 Decision 1: Prelude outputs spec locked (Direction)
**Context:** Phase 1 (Prelude reframe game design) opened. Original Phase 1 question list led with "how many life-stage moments are load-bearing." PM pushed back: that question presupposes a defined output set, which the project did not have. Spec was implicit — abstract success criteria ("allows growth," "feels like an origin story") without a concrete checklist. Decision 1 written to make the spec explicit before structural work begins.
**Decision:** Lock the Prelude outputs as 7 tangible outputs (theme committed, living biography seeded, canon NPCs persisted with status, canon locations persisted, L1 ancestry feat chosen, up-to-+2 in up-to-2 stats, up-to-2 skill profs), 4 felt outputs (formative memories + a few non-formative just-good-or-bad memories, NPCs that feel real, world-shaping lessons that affect how the PC sees other characters and factions, encapsulated origin with who/why/where), and tutorial coverage (basic combat, roleplay, skill checks). Class and L1 choices commit at handoff, not during Prelude. Cut: values tracker as a system, mentor as a required output. Mentor moves to setup wizard choice. Party-combat tutorial dropped.
**Why:** Concrete outputs let structural proposals be evaluated against a checklist instead of an abstract gut check. The original 5-session 4-chapter 7-10 hour Prelude grew that big partly because abstract criteria don't push back when scope expands. A concrete output spec disciplines the design downstream.
**Implications:**
- Mentor becomes a setup-wizard question ("Who looms largest in your early life?" — parent / sibling / mentor / guardian / captor / employer / rival / no one), not an emergent figure. Arc plan generates against that answer. Removes the "no mentor emerged" failure case and honors the street-urchin-with-no-mentor case as a legitimate setup choice.
- Values tracker cut: alignment becomes a manual pick at handoff (standard 5e). The "what does this character believe" weight that the values paragraph used to carry is absorbed by the backstory generation, which becomes correspondingly more important.
- Living biography is a new feature. Phase 1 scope is "generate the first chapters during the Prelude — capture memories during play, not just summarize at the end." Phase 2 builds the schema, service, and UI for the living document (tentatively `character_biography` table + entries + UI surface on Origin & Identity tab).
- Non-formative memorable scenes stay on the felt-output list but get no dedicated structural machinery in Phase 1. Decision 2's structure builds in deliberate breathing room (fewer mandatory beats per session than the current design) to host them. Re-evaluate at Phase 7 based on whether felt-output #1 lands; if not, distinguish AI-side gap (Phase 4 underdelivered) from structure-side gap (explicit affordance needed).
- Class commits at handoff; theme commits during Prelude. The Ch3 irreversible-act beat is now only about theme commitment, simplifying its design. `[CLASS_HINT]` markers stay but no longer determine a winner — they pre-select the suggestion in the handoff creator.
- Handoff wizard rebuild is on the table. Phase 1 doesn't design it. Phase 2 either expands to include it or the rebuild carves off into its own phase. Resolved at Phase 1's end.
- All Decision 2-5 proposals graded against an 8-point checklist: produces all 7 tangible outputs; supports all 4 felt outputs; delivers tutorial coverage; makes room for non-formative scenes; works with mentor as setup choice; works without values tracker; supports living-biography seeding; works with theme-commits-in-Prelude / class-commits-at-handoff.

**Parked for future:**
- Emergent alignment from Prelude play behavior (Opus generates from session transcripts post-Prelude). Phase 7-or-later, gated on having real play data.
- Explicit structural affordance for non-formative memory beats ("the time we got caught in the rain at market"). Re-evaluate at Phase 7.

**Related:** PRELUDE_IMPLEMENTATION_PLAN.md (will be updated at end of Phase 1); PRELUDE_REVIEW.md.

### 2026-04-29 — Keeper is a third caster, not a full caster (Architecture)
**Context:** Phase 0 surfaced a `CASTER_TYPE: 'none'` bug at server/config/levelProgression.js:605. The bug was real — Keeper levels were being treated as non-caster in multiclass spell-slot calculations. The PM handoff assumed the fix was `'full'` based on a doc-vs-code drift framing. Code went to verify against the design and surfaced that the design actually says Keeper is a third caster, not a full caster.
**Decision:** Set Keeper's `CASTER_TYPE` to `'third'`. Register the five Keeper subclasses (Lorewarden, Mythslinger, Rhetorician, Versebinder, Polymath) in `SPELLCASTING_SUBCLASSES`.
**Why:** Third-caster matches the design intent and avoids over-powering Keeper relative to other classes. Multiclass math now works as intended: W1/K19 yields 7 caster-equivalent levels (previously bypassed entirely); W5/K1 yields 5 (a 1-level Keeper dip earns the toolkit but no spell-slot bonus, which is the correct behavior); W5/K6 yields 7. Subclass registration was missing alongside the base-class bug; both shipped together.
**Implications:** Any prior thinking that assumed Keeper was a full caster (including the original PM handoff) should be re-read with this correction. Class-balance evaluation in Phase 7 (playing mode) will be the real test of whether third-caster is the right scale; if Keeper feels underpowered or overpowered in long-running play, this is the lever to revisit. The sibling pattern — base class config and subclass registration drifting together — is worth keeping in mind for any future caster-type changes.
**Related:** Phase 0 handoff (this session); KEEPER_REVIEW.md; server/config/levelProgression.js:605; SPELLCASTING_SUBCLASSES registry.

### 2026-04-29 — `[PARTY_ARGUMENT]` marker: keep, build in Phase 6 (Direction)
**Context:** DM Mode reserves a `[PARTY_ARGUMENT]` marker in code but has no detector and no handler — only a strip regex at dmModeService.js:145. The Code audit confirmed it's reserved-but-unprocessed. Phase 0 required a keep-or-cut design call before Code touches it.
**Decision:** Keep the reservation. Build the detector + handler properly in Phase 6 (DM Mode dedicated pass).
**Why:** Overseeing arguments between the AI party is part of what makes DM Mode the practice ground it's meant to be. A good DM mediates internal party conflict; cutting the feature would shrink what DM Mode teaches and what it can deliver as an experience. The work fits naturally in Phase 6 where DM Mode gets a focused pass.
**Implications:** Phase 0 leaves the reservation intact (no removal). Phase 6 owns the build: detector logic for when an argument should fire, handler service for playing one out, and any needed prompt-side framing for the AI party. Until Phase 6 ships, the marker continues to do nothing in production — same state as today.
**Related:** CONSOLIDATED_TODO.md Phase 0 and Phase 6; CODE_AUDIT_FINDINGS.md (DM Mode section); DM_MODE_REVIEW.md.

### 2026-04-29 — Ancestry feat count: 195 canonical, "Path Less Walked" parks (Direction)
**Context:** Doc drift across the project — CLAUDE.md says 195 ancestry feats, ANCESTRY_FEATS.md says 208. The 13-feat gap is the "Path Less Walked" cross-pick mechanism (a character picking an ancestry feat from outside their own ancestry). Designed but never built. Code matches CLAUDE.md (195).
**Decision:** 195 is canonical. ANCESTRY_FEATS.md gets reconciled to 195 to match code and CLAUDE.md. The "Path Less Walked" cross-pick mechanism parks for Phase 7 — revive or formally retire based on playing-mode evidence.
**Why:** The ancestry feats system is already robust at 195. Phase 0 is for stop-the-bleeding alignment, not for committing to 13 new feats of design + implementation work. Park the cross-pick question until there's lived evidence (a long-running character, real cross-cultural narrative beats) that would tell us whether the mechanism would actually pay off. No prejudice in either direction — easy to revive, easy to retire.
**Implications:** Phase 0 doc cleanup includes the ANCESTRY_FEATS.md reconciliation. Phase 7 picks up "Path Less Walked" as a design question. No code changes required by this decision.
**Related:** CONSOLIDATED_TODO.md Phase 0 and parking lot; CODE_AUDIT_FINDINGS.md (ancestry section); ANCESTRY_FEATS_REVIEW.md.

## 2026-04-29 — Foundation-first sequencing for post-review-phase work (Process)

**Decision:** Adopt foundation-first sequencing (seven phases plus parking lot, strictly sequenced) for the work surfaced by the nine-system review phase and the subsequent Code audit. Captured in `CONSOLIDATED_TODO.md`.

**Phases:**
1. Phase 0 — Stop-the-bleeding fixes (Keeper CASTER_TYPE bug, [PARTY_ARGUMENT] decision, doc drift)
2. Phase 1 — Prelude reframe (game design, PM + user)
3. Phase 2 — Prelude → Primary transition (engineering, conditional on Phase 1 spec)
4. Phase 3 — AI Narrative Persistence foundation refactors (unified standing-scalar abstraction; unified marker → state pipeline)
5. Phase 4 — AI behavior diagnostic (shelter-and-shape concern across Prelude, Companions, Themes; DM Mode as reference)
6. Phase 5 — Focus-area execution (selection and ordering deferred to end-of-Phase-4)
7. Phase 6 — DM Mode dedicated pass
8. Phase 7 — Playing mode (long-running character; several deferred systems become evaluable)

**Sequencing is strict.** Each phase ships in full before the next begins. Earlier draft considered parallelism (Phase 0 / Phase 1, Phase 2 / Phase 3, Phase 3 / Phase 4); user chose strict sequencing for clarity and to avoid context-switching costs.

**Trade made explicit:** AI behavior diagnostic runs *before* commitment to a focus area, inverting the bootstrap prompt's instinct that Prelude / Companions / Themes-AI were leading focus candidates. Reasoning: all three candidates share the diagnostic. One investigation feeds three execution paths. Selection of which candidate becomes Phase 5 headline focus is deferred to end-of-Phase-4 — no leaning committed in advance.

**Why foundation-first over focus-area-first:**
- The two priority refactors (standing-scalar abstraction, marker pipeline) unblock multiple deferred items each. Without them, every deferred item is a new bespoke schema or implementation.
- Code audit identified the Prelude → Primary transition as a routing-level real bug. Fixing it before any new Prelude work prevents shipping a beautifully fixed Prelude that the player can't escape.
- Project owner's stated bias: longer build time is acceptable; "playing mode" eventually replaces "building mode," but not yet.

**Why Prelude reframe enters as Phase 1:**
Project owner confirmed the current 5-session, 4-chapter Prelude is too long for the play sessions actually available, and that the reframe must preserve four success criteria (growth, story beats, origin-story feel, real character-building beyond background-pick). Length is an output of the reframe, not an input. Reframe is structural design work and squarely PM + user territory per project process.

**Why DM Mode gets a dedicated phase:**
Bootstrap prompt flagged DM Mode as possibly underweighted. Earlier draft argued the reweighting resolves implicitly (DM Mode shapes Phase 4, which shapes Phase 5). User pushed back — DM Mode warrants its own phase to make sure deferred work in it is done right rather than handled in passing. Phase 6 sits after the foundation refactors and focus area so DM Mode lands on a codebase where its own patterns have been generalized (e.g., cross-party memory question becomes easier to answer once standing-scalar abstraction exists). Phase 6 covers `[PARTY_ARGUMENT]` implementation, post-session relationship summary view, bond-shift evolution review, cross-party NPC memory, Opus toggle decision, DM Mode product positioning, and confirmation that DM Mode patterns remain consistent with whatever the Phase 3 abstractions ended up being.

**Notable findings from Code audit that shaped the sequence:**
- Mythic is more built than the review framed it (framework + content + markers + prompt injection all wired). Strategic question shifts from "build" to "fill gaps and playtest." Deferred to parking lot / Phase 7.
- Themes content is full content (84 abilities), not shells. Single load-bearing risk is missing AI-trigger specs per ability — focused, scopable. One of three Phase 5 candidates.
- Party Synergies is more broken than reviewed: `partySynergy.js` imported nowhere, system invisible to AI today. Sequenced in parking lot, contingent on marker pipeline (Phase 3).
- Phase 5 of the original Prelude (transition to primary) is the single highest-priority real bug in the codebase. Player who finishes Prelude today has no service to exit. Becomes Phase 2 of the consolidated to-do.

**Re-evaluation point:** End of Phase 4 diagnostic. Findings determine Phase 5 commitment and may reshape parking-lot priorities.

**Supersedes:** PM_TODO's queue (PM_TODO described itself as ephemeral end-of-review state).

**Complements:** PROJECT_TODO (per-session active/blocked/parked map, unchanged role).

### 2026-04-26 — Prose-quality triage closes; thread complete (Process)
**Context**: The prose-quality investigation has been the central engineering thread since v1.0.95. Started with 6 hypotheses; expanded to 8. Closure required four criteria: (1) path decisions made, (2) H7 + H8 production fixes shipped, (3) cost validated in real-session metrics, (4) findings folded into design docs.
**Decision**: Close the prose-quality triage. All four criteria met as of this version.
**Why**: The thread accomplished what it set out to do. Opus is the production default at validated ~$1.30–$2.00/hour; both cache tiers run on 1-hour TTL; Lean Prompt is retired as a production direction; H7 and H8 production fixes shipped and verified by re-running the A/B harness. The investigation produced three pieces of durable institutional knowledge: the three-tier cache architecture is sound and byte-stable (proven in tests/cache-creation-investigation.js), Opus is the prose-quality lever for this project, and the post-process-on-a-copy pattern (applyLeanTransforms()) is preserved as a reusable diagnostic harness for future prompt experiments.
**Implications**: Code's attention is now free for the next thread. Session Hi-Fi implementation moves out of "blocked on prose-quality" status. Remaining items related to this thread (cache_creation cost optimization, Levers 2 and 3) stay parked in PM_TODO as known side-quests if cost ever becomes a forcing function. The triage doc itself can be archived or marked closed.
**Related**: triage/prose-quality-triage.md; v1.0.95 through current changelog entries.

### 2026-04-26 — H8 production fix: soften Cardinal Rule 2 (Prompt design)
**Context**: Cardinal Rule 2 (HARD STOPS) forced the AI DM to end its response immediately after any roll request, compressing cinematic build-ups by cutting off mid-scene to demand the roll. The original prose-quality A/B testing flagged this as a real prose-compression issue, and session 147 caught it firing twice in production play (zero in session 148 — real but not constant).
**Decision**: Replace the strict "HARD STOPS" variant in the always-on prompt with "ROLL REQUESTS — DON'T SPOIL OUTCOMES." This was previously only available via applyLeanTransforms(); it's now production.
**Why**: The actual goal of Cardinal Rule 2 is preventing the AI from narrating outcomes before the roll resolves. The strict version achieved that but at the cost of compressing legitimate cinematic build-ups. The soft variant preserves the goal (don't spoil outcomes) without the compression. A/B harness re-run after shipping confirmed no H8 flags on the relevant scenario.
**Implications**: applyLeanTransforms()'s second transform (strict→soft swap) silently no-ops in production now, since the strict heading no longer appears in the canonical prompt. Wiring is preserved for two reasons: it would still apply if a future revival of the strict rule lands, and the first transform (stripping MECHANICAL MARKERS) remains a real diagnostic lever.
**Related**: triage/prose-quality-triage.md; H7 fix (same release).

### 2026-04-26 — H7 production fix: gate the OBSERVATION-as-check rule (Prompt design)
**Context**: The PLAYER OBSERVATION = ALWAYS A CHECK rule, lived in the always-on formatMechanicalMarkers() block, caused the AI DM to demand a perception/investigation/stealth check on every player observation — including atmospheric scene-opens like "I push open the tavern door" where no check was warranted. Original A/B testing surfaced this; production sessions 147 and 148 didn't catch it firing visibly, but the diagnostic evidence was clear.
**Decision**: Move the rule out of the always-on prompt. Verb-gate it via detectObservationVerbs(action) exported from dmPromptBuilder.js — a narrow word-stem regex against commitment verbs (search, examine, investigate, study, sneak, listen, identify, track, persuade, intimidate, deceive, pick, disarm, climb, etc.). Inject the rule at /message time only when the verb fires; restore the un-injected systemPrompt before persisting so the block doesn't accumulate across turns.
**Why**: The rule was solving a real problem (AI sometimes skips a check the player committed to) but applying it universally compressed atmospheric prose. Gating it on actual verb commitment preserves the rule's value where it matters and removes the compression where it doesn't. A/B harness re-run after shipping confirmed no H7 flags on atmospheric scene-opens.
**Implications**: Pattern of "verb-gated rule injection" is now established and reusable. The injection-then-restore approach (don't accumulate the block in messages[0]) is the same shape as marker-correction injection — consistent with existing patterns. Future prompt rules that should fire situationally rather than always can follow the same structure.
**Related**: triage/prose-quality-triage.md; H8 fix (same release).

### 2026-04-26 — Retire Lean Prompt toggle as production direction (Prompt design)
**Context**: The Lean Prompt toggle was introduced as a diagnostic-only experiment (see earlier 2026-04-26 entry) to A/B-test whether stripping the MECHANICAL MARKERS section and softening Cardinal Rule 2 would improve prose quality. Automated A/B showed it helped edge cases (atmospheric scene-opens, cinematic build) but didn't move the needle in real user playtest at production cadence.
Decision: Retire the Lean Prompt toggle as a production direction. Keep the underlying transform code wired in dmPromptBuilder.js as a debugging tool, but remove the toggle from the home-page surface so it's no longer user-facing.
**Why**: The hypothesis (lean prompt → better prose) didn't hold up in practice. Continuing to surface the toggle invites confusion ("which one should I use?") for a question that has been answered. The H7 and H8 production fixes — currently pending — will address the underlying prose-compression issues directly in the always-on prompt, which is the right shape of fix.
**Implications**: The applyLeanTransforms() post-processor pattern stays available in the codebase as a diagnostic harness — the same shape can be reused for future prompt-design experiments. H7 and H8 production fixes now carry the work the Lean toggle was meant to validate; getting them right matters more.
**Related**: Earlier 2026-04-26 entry "Lean Prompt toggle as a diagnostic-only experiment"; H7/H8 open decisions; triage/prose-quality-triage.md.

### 2026-04-26 (v1.0.99) — Opus as production default for main DM session continuations (Direction)
**Context:** v1.0.96 (cache architecture fix) + v1.0.98 (tier 2 → 1-hour TTL) brought Opus session cost to ~$1.30–$1.50/hour validated against real session 147 data. Original $0.85/session prediction was wrong; corrected numbers logged in CHANGELOG and the character-info-split entry. User's playtest confirmed Opus is the prose-quality lever the project needed; Sonnet is "good enough" for general interaction but doesn't deliver the narrative depth the brief calls for.
**Decision:** Make Opus the default model for main DM session continuations on all three surfaces (home pill, setup screen, in-session info bar). Sonnet stays available via the toggle as an escape hatch.
**Why:** The brief frames this as the user's end-of-world game — playable for years on a single character. Prose quality is the heart of that experience; mechanics exist to support it. ~$1.50/hour is acceptable for that framing, especially given 2–3 sessions/week translates to ~$300–700/year for the user's most-played game. Levers 2 and 3 (rolling summary earlier; tier 3 trim) were considered as further cost reductions but deferred — both trade cost for AI memory quality, which is exactly the central engineering problem the brief flags as load-bearing. Those changes need their own scoped investigation, not casual inclusion here.
**Implications:** Supersedes the earlier "Opus for ALL generation, Sonnet for sessions only" decision (now closed). New baseline cost expectation is ~$1.50/hour of Opus play. Future cost-reduction work happens in a dedicated memory-quality investigation, not in the prose-quality thread. Code change: server `/start` and `/message` both default to Opus; the body param `modelOverride` now accepts `'sonnet'` as the escape-hatch signal (was `'opus' | null`). Client toggle inverted: `forceOpus` boolean → `useSonnet` boolean (semantically: the toggle now selects the override, not the default). localStorage key migrated from `dndForceOpus` to `dndUseSonnet`.
**Related:** v1.0.96 + v1.0.98 changelog entries; v1.0.99 changelog entry; [`triage/prose-quality-triage.md`](triage/prose-quality-triage.md); session 147 playtest data.

### 2026-04-26 — PROJECT_BRIEF.md and DECISION_LOG.md introduced (Process)
**Context:** Project complexity has grown to multiple parallel strategic threads, multi-session investigations, and recurring AI collaborators (Claude Code, Claude Design, Claude PM). Onboarding a strategic-role collaborator was forcing them to re-derive context every time.
**Decision:** Create `PROJECT_BRIEF.md` (strategic orientation, read once) and `DECISION_LOG.md` (this file — record of decisions and rationale).
**Why:** CLAUDE.md is engineering-deep and doesn't serve strategic readers. PROJECT_TODO.md is current-state and doesn't preserve the *why* behind past calls. Without a brief, every new collaborator has to be re-onboarded. Without a decision log, institutional memory leaks at every session boundary.
**Implications:** Adds two docs to maintain. The brief should change rarely (project shape rarely shifts); the log gets a new entry every time a meaningful call lands. Both should be read by any strategic-role collaborator at start.

### 2026-04-26 — Triage folder is for *broken systems being diagnosed*, not for *designed systems being built* (Process)
**Context:** Briefly created `triage/session-hifi-triage.md` for the deferred Session Hi-Fi build, then user pointed out that "triage" should mean "system needs an immediate fix." Design work that's scoped-but-deferred isn't the same thing.
**Decision:** Triage folder reserved for active diagnostic investigations only. Designed-but-deferred work goes in `FUTURE_FEATURES.md`.
**Why:** Keeps the semantic clean. A reader scanning `triage/` should know everything in there is a *problem under investigation*, not a *project on the backlog*.
**Implications:** Session Hi-Fi was moved out of triage into FUTURE_FEATURES. Going forward, the test for "does this go in triage?" is "is something broken or behaving badly that we're trying to fix?" If yes → triage. If "we want to build this thing eventually" → FUTURE_FEATURES.

### 2026-04-26 — PROJECT_TODO.md established as single-entry-point for active work (Process)
**Context:** Active work was scattered across triage docs, FUTURE_FEATURES, in-conversation context, and tribal memory. Coming back to a session meant reconstructing state.
**Decision:** Create `PROJECT_TODO.md` at repo root with sections for Active Right Now (1-3 items), Blocked/Waiting, Parked/On Deck, Backlog (pointer), Recently Shipped, and a Living Docs Map. Read at the start of every session.
**Why:** A single living "where are we" doc reduces session-startup cost and prevents lost work.
**Implications:** Convention: items move *between* sections as state changes; never appended below stale entries. Maintained at session boundaries. PROJECT_TODO is the navigation hub; deeper docs (triage, brief, FUTURE_FEATURES) are pointed to from here.

### 2026-04-26 (v1.0.98) — Tier 2 prompt cache also moves to 1-hour TTL (Architecture)
**Context:** v1.0.96 put tier 1 on 1-hour TTL but kept tier 2 at the default 5 minutes, on the assumption that tier 2's smaller size didn't justify the 2× write premium. The v1.0.97 session-147 playtest (24 turns, Opus) disproved that. Real cache log showed tier 2 re-creating ~6 times during the session — entries like `created 5221`, `created 2973`, `created 1927` at turns 10, 11, 18, 20, 22 — each costing ~$0.05. Pattern: thoughtful play gaps exceed 5 min, tier 2 expires, gets re-created on the next turn.
**Decision:** Tier 2 now also uses `cache_control: { type: 'ephemeral', ttl: '1h' }`. Both tiers on 1-hour TTL.
**Why:** Same reasoning as the v1.0.96 tier 1 decision, just confirmed empirically for tier 2: 2× write cost (1h) is amortized over 60 minutes vs 5; net cheaper for thoughtful play. The "smaller block, premium not worth it" intuition was wrong because tier 2 still gets re-created multiple times per session at 5m TTL during normal play, and each recreation pays the full block cost.
**Implications:** Tier 2 re-creations during long pauses should drop from ~6/session to ~1/session. Per-session cost: ~$2.89 → ~$2.60 (~$0.20–$0.30 savings, depending on session length and pause distribution). Cross-session caching also benefits — the next session start can hit BOTH tiers from the prior session (session 147 t1 already showed 88% cache hit from tier 1 alone with 1-hour TTL; this should improve further now that tier 2 is included).
**Related:** v1.0.98 changelog entry; [`triage/prose-quality-triage.md`](triage/prose-quality-triage.md)

### 2026-04-26 (v1.0.96) — Tier 1 prompt cache uses 1-hour TTL (Architecture)
> *Partially superseded 2026-04-26 (v1.0.98): tier 2 also moves to 1-hour TTL based on session-147 production data. See entry below for the new context.*

**Context:** Production cache logs (session 144, Riv A playtest) showed tier 1 evicting every 5-6 turns. Anthropic's default ephemeral cache TTL is 5 minutes, and thoughtful play exceeds 5-minute boundaries between turns. Each eviction forced a full tier 1 rebuild (~5500 tokens).
**Decision:** Use `cache_control: { type: 'ephemeral', ttl: '1h' }` on tier 1 (universal-static block). Tier 2 keeps the default 5-minute TTL — assumption was that the smaller per-character block didn't justify the 2× write premium.
**Why:** Anthropic charges 2× to write 1-hour cache vs 1.25× for 5-minute, but 1-hour survives between thoughtful turns. Net cheaper for tier 1.
**Implications:** Tier 1 mid-session evictions eliminated. The tier 2 5-min decision turned out to be wrong — see v1.0.98 entry below.
**Related:** v1.0.96 changelog entry; [`triage/prose-quality-triage.md`](triage/prose-quality-triage.md)

### 2026-04-26 — Split character info into static (tier 2) + dynamic (tier 3) for cache stability (Architecture)
**Context:** Tier 2 cache hit rate was inconsistent in production (~55%). Investigation showed the entire character sheet (name, race, abilities, HP, gold, current location, current quest, equipped weapon) was a single block in tier 2. Every state change (every turn) drifted tier 2's content, forcing cache rebuilds.
**Decision:** Split `formatCharacterInfo()` into `staticText` (identity that doesn't change session-to-session: name, race, class, abilities, skills, feats, spells, demographics, personality/ideals/bonds/flaws, backstory) → tier 2; and `dynamicText` (HP, AC, weapon, key equipment, current location, current quest) → tier 3. Backwards-compat: `text` field still returned with the concatenation so any caller still using it works.
**Why:** Per-character cache should hit on every continuation turn within a session. With state mixed in, it never did. The split is the architecturally correct fix.
**Implications:** Predicted at ~95% cache hit rate. Real measurement from session 147 (v1.0.97) was ~71% — close to the ~77% mathematical ceiling for this play pattern, since fresh-input from accumulated message history + tier 3 dynamic content (chronicle context, narrative queue, world state) caps the ratio. The ~95% prediction was wrong; ~71–77% is the realistic range. Pattern is now established — any future per-character static content should land in tier 2; per-turn state in tier 3.
**Related:** v1.0.96 changelog entry; v1.0.97 session-147 production playtest; [`tests/cache-tier-diff.js`](tests/cache-tier-diff.js)

### 2026-04-26 — Sonnet/Opus model selector replaces Auto/Claude/Ollama provider toggle (UX + Direction)
**Context:** During the prose-quality investigation, user needed to A/B Sonnet vs Opus across sessions. The existing setup-screen toggle was for *provider* (Auto/Claude/Ollama), not *model*.
**Decision:** Replace the provider toggle with a Sonnet/Opus model selector on three surfaces: home-page pill, session setup screen, in-session info bar pill. Provider preference stays internally on `auto` so Ollama fallback still works.
**Why:** Model is the lever that affects prose quality, not provider. Surfacing model choice while keeping provider abstracted matches what actually matters.
**Implications:** Three surfaces share `dndForceOpus` localStorage key. Ollama users (offline play) lose explicit provider control but can still rely on auto-fallback. If lean prompt or another model-affecting toggle is added, follow this same pattern.

### 2026-04-26 — Lean Prompt toggle as a diagnostic-only experiment (Prompt design)
**Context:** Two prompt elements (the MECHANICAL MARKERS section and Cardinal Rule 2 HARD STOPS) were hypothesized to compress prose. Needed a way to A/B them without rebuilding.
**Decision:** Add `applyLeanTransforms()` post-processor in `dmPromptBuilder.js`. When body param `leanPrompt: true`, strip MECHANICAL MARKERS section and replace Cardinal Rule 2 with a softer "ROLL REQUESTS — DON'T SPOIL OUTCOMES" variant. Applied per-turn on a copy; full prompt always stays in `messages[0]`. Toggleable mid-session via a home-page pill.
**Why:** Diagnostic, not production. Reversible per-turn. Keeps the experiment cheap.
**Implications:** This toggle is on the open-decisions list above — keep, retire, or fold parts into production permanently is still TBD. Pattern of "post-process the system prompt on a copy at API-call time" is now established and could be reused for other diagnostic experiments.

### 2026-04-25 — Establish the prose-quality investigation as the central narrative-quality work (Direction)
**Context:** User reported sessions read thinner than the original "Order of Dawn's Light" Opus 4.5 baseline (December 2025 PDF in repo root). Started with 6 hypotheses; expanded to 8 after diagnostic surfaced two more (H7 OBSERVATION-as-check, H8 HARD STOPS).
**Decision:** Treat prose quality as the central engineering investment for v1.0.95 → v1.0.96 → forward. Build the diagnostic toolkit (3 dryrun harnesses + 1 A/B harness against Sonnet). Then act on findings.
**Why:** Narrative is the heart of the experience. Mechanics exist to support it. If the AI DM doesn't write well, nothing else matters.
**Implications:** Strategic Thread 1 (per `PROJECT_BRIEF.md`) — the active push. Will likely run for several more versions. Production decisions on Opus default, Lean retire, H7/H8 fixes are downstream.
**Related:** [`triage/prose-quality-triage.md`](triage/prose-quality-triage.md), `tests/output/prose-quality-analysis.md`

### 2026-04-24 — Append-only transcript decoupled from LLM message history (Architecture)
**Context:** `dm_sessions.messages` doubles as the LLM-facing conversation array (gets compacted by rolling summary at message 30+) and the source of truth for "what happened in this session" (used for chronicle gen, recap, transcript display, exports, turn counter). The compaction broke everything that needed the full history.
**Decision:** Add `dm_sessions.transcript` column that grows append-only. `messages` continues to drive what the LLM sees (compacted, bounded). `transcript` is the source of truth for play history.
**Why:** Compaction is correct for LLM cost; lossiness is wrong for everything else. Decoupling fixes both.
**Implications:** All downstream consumers of "what happened" should read from `transcript`. `getTurnCount(sessionId)` is now authoritative. Pattern: when LLM-context concerns and historical-truth concerns conflict, separate the columns.
**Related:** v1.0.95 changelog (migration 046)

### 2026-04 — Themes replace 5e backgrounds as a 4-tier progression layer (Direction)
**Context:** Standard 5e backgrounds front-load all value at L1 then stay static. In a solo AI-DM context, the background needs to be a living signal the AI can reference and react to over time, not a one-time L1 grant.
**Decision:** Replace the standard "Background" character creation step with **Themes** — every D&D 5e background becomes a 4-tier progression (L1 / L5 / L11 / L17). Auto-unlock at milestones, narratively delivered (story-driven preferred, passive-narrative fallback). Signature mechanic: the **Expertise Die** (d4 at T3, scaling to d6 at T4) on the Theme's two key skills.
**Why:** Makes the character's identity progression *mechanically meaningful* over the lifetime of a campaign. Inspired by Starfinder Themes + Pathfinder 2e ancestry feats. Three parallel progression layers (Class / Theme / Ancestry) feel like a *braided* identity rather than three separate menus.
**Implications:** Architecture is locked in (21 themes × 4 tiers = 84 ability shells exist in `server/data/themes.js`). Content for individual abilities is the largest single design lift remaining. Knight Theme has 6 moral paths (template for future moral-fork variants). Background tab in character sheet renamed → "Origin & Identity," Theme progression lives on Progression tab.
**Related:** `Claude UX Design/D&D Meta Game (Remix)/Themes-Replace-Backgrounds.md`, `THEME_DESIGNS.md`, `SUBCLASS_THEME_SYNERGIES.md`, `MYTHIC_THEME_AMPLIFICATIONS.md`, `PARTY_SYNERGIES.md`

### 2026-04 — Hi-fi designs over wireframes for AI-implementer handoff (Process)
**Context:** Wireframes (sketchy / dashed / hand-drawn aesthetic) were intentional "this isn't done" signals. But for handoff to an AI implementer (Claude Code), wireframes get faithfully reproduced as wireframes — the AI doesn't infer "oh, this should be a real portrait."
**Decision:** Iterate designs to hi-fi *before* handing them to Claude Code. Hi-fi locks the visual language (real fonts, real icons, real spacing); the implementer recreates pixel-fidelity rather than re-deriving aesthetic intent.
**Why:** AI implementers are literal. They need the spec to be the artifact, not a sketch of the artifact.
**Implications:** Workflow: Claude Design produces hi-fi HTML/CSS prototypes → exported as a design bundle (with README, chat transcript, source files) → handed to Claude Code with clear scope-confirmation step before implementation. Existing hi-fi pieces: 5 character sheet tabs, 1 session screen. Pending: Origin & Identity tab, Progression tab.
**Related:** `Claude UX Design/D&D Meta Game (Remix)/`

### 2026 (early-mid) — Prelude-forward character creator (5 sessions, ages 5-22, 4 chapters) (Direction)
**Context:** Standard D&D character creation is a stat-block exercise; the character has no lived history when play begins. For an AI-DM-driven solo experience, the AI needs grounding — *who is this person, what shaped them* — to give NPCs something to react to.
**Decision:** Replace the standard one-step character wizard with a **prelude** — a 5-session character-building experience where the player plays the character from age 5 to age 22 across four chapters (OBSERVE → LEARN → DECIDE → COMMIT). The AI shapes them based on choices made in play. Theme commitment lands in Ch3.
**Why:** Builds character depth *through play*, not through form-filling. Generates canon facts, NPCs, and relationships organically. Doubles as a tutorial for D&D itself.
**Implications:** Phases 1-4 shipped. Phase 5 (handoff to main campaign) is the largest pending integration work. Affects everything downstream — main campaign opener now reads from prelude state, NPCs from prelude can recur, Theme is committed before main play begins.
**Related:** `PRELUDE_IMPLEMENTATION_PLAN.md`

### 2026 (earlier) — DM Mode (user as DM, AI as 4 player characters) as a first-class mode (Direction)
**Context:** User has never played D&D with others, partly because of rules complexity. Wanted a way to learn DM-ing without the social commitment of a tabletop session.
**Decision:** Build DM Mode as the inverted of Player Mode. User runs the game; AI plays a party of four distinct characters generated by Opus with class/alignment/voice diversity and inter-party tensions. Separate prompt builder, separate session type, separate UI flow.
**Why:** Tutorial value + dual-purpose codebase. The same engine that supports playing also supports practicing.
**Implications:** All AI-companion infrastructure (voice palettes, personality, decision-making) is reusable in DM Mode. New patterns surfaced here (party dynamics, bond tracking, coaching tips) feed back into Player Mode companions.

### 2026 (earlier) — Three-tier prompt cache architecture (Architecture)
**Context:** Per-turn AI cost is a major concern. Naive sending of the full system prompt every turn is expensive.
**Decision:** Stratify the system prompt into three tiers via `<!-- CACHE_BREAK:AFTER_CORE -->` and `<!-- CACHE_BREAK:AFTER_CHARACTER -->` markers. Tier 1 (universal-static: Cardinal Rules, Craft, Conversation, examples, mechanical markers) — cached across all sessions. Tier 2 (per-character static: world setting, character identity, progression) — cached across turns of one session. Tier 3 (dynamic: live context, world state, chronicles) — uncached.
**Why:** Maximize cache hits while keeping live context fresh.
**Implications:** Any new prompt content must be classified by tier. Putting dynamic state in tier 1 or 2 breaks the cache silently — the v1.0.96 fix corrected exactly this problem in tier 2.
**Related:** [`server/services/claude.js`](server/services/claude.js) `buildSystemParam`

### 2026 (earlier) — Marker-based game-state mutation (Architecture)
**Context:** AI DM's narrative output needs to actually change game state (drop items, deal damage, advance quests, etc.) without breaking immersion.
**Decision:** ~25 game-state markers the DM AI emits inline (`[COMBAT_START]`, `[LOOT_DROP]`, `[MERCHANT_SHOP]`, `[CONDITION_ADD]`, `[PROMISE_MADE]`, etc.). Server-side detection parses them out before display, applies the state change, and (for some markers) injects a system message back into the conversation so the AI references the real outcome.
**Why:** Markers are the only place mechanics surface in the AI's output; everything else stays fictional. Single discipline; auditable; verifiable.
**Implications:** Marker schemas are part of the prompt (in MECHANICAL MARKERS section). Adding a new marker requires: (1) update prompt schema, (2) add detection in `dmSessionService.js`, (3) wire to the action that fires the state change, (4) handle the back-injection if relevant. Verifiers exist to catch malformed markers and feed corrections to the next turn.
**Related:** [`server/services/dmSessionService.js`](server/services/dmSessionService.js), [`server/services/ruleVerifiers.js`](server/services/ruleVerifiers.js)

### 2026 (earlier) — Persistent merchant inventories from loot tables (not AI-generated per visit) (Architecture)
**Context:** AI-generated merchant inventories felt random and disconnected. Players couldn't predict what was where; the world didn't feel like it had a real economy.
**Decision:** Per-merchant persistent `merchant_inventories` table. Inventories generated once from loot tables (DMG + XGtE items across 5 rarities, scaled by prosperity + character level). The AI references the actual inventory; doesn't make items up. `[ADD_ITEM]` marker exists for narrative additions, but the default is "what's on the shelf is what's in the data."
**Why:** Persistent economy. World feels real. Bargaining and price modifiers actually mean something because the items are stable.
**Implications:** Merchant generation happens at campaign-plan time. Restock logic is per-merchant. Cursed items (~13) display as their disguise to maintain the cursed-item experience.
**Related:** [`server/data/merchantLootTables.js`](server/data/merchantLootTables.js), [`server/services/merchantService.js`](server/services/merchantService.js)

### 2026 (earlier) — Living world tick pipeline (between-session world advancement) (Architecture)
**Context:** A static world between sessions feels dead. Without something happening when the player isn't playing, the world doesn't feel alive.
**Decision:** Between-session orchestration pipeline: weather → factions → events → conflict quests → companions → NPC mail → consequences → survival → base income → base threats → notoriety → custom-order delivery → record. Runs when a new session starts; advances world state by elapsed game time.
**Why:** The world is alive. NPCs do things while the player is away. Factions advance their goals. Threats accumulate. The narrative queue surfaces what happened at session start.
**Implications:** Each subsystem (weather, factions, events, etc.) is independently developable. Adding a new world-advancing system means adding it to the tick. Off-screen companion activities, base raids, world events, and NPC mail all flow through this.
**Related:** [`server/services/livingWorldService.js`](server/services/livingWorldService.js)

### 2026 (foundational) — Stack: ES modules, no TypeScript, no CSS framework, SQLite via @libsql/client (Architecture)
**Context:** Baseline tech-stack decisions made early in the project's life.
**Decision:** All JS is ES modules (no CommonJS). No TypeScript. No CSS framework (inline styles or per-component classes only). React 18 + Vite frontend. Node + Express backend. SQLite via `@libsql/client` (local `file:local.db` or Turso cloud — interchangeable).
**Why:** Solo project; aggressive simplicity; minimal toolchain. TypeScript adds friction without enough payoff for this team-of-one. CSS frameworks add lock-in. SQLite scales fine for one user; Turso option exists if cloud sync is wanted later.
**Implications:** Don't introduce TypeScript. Don't introduce a CSS framework. Don't split the largest components (`DMSession.jsx`, `CharacterSheet.jsx`, `CharacterCreationWizard.jsx`) without explicit plan — they're large but cohesive. New JS code is ES modules with `import`/`export`. Migrations are numbered (`server/migrations/NNN_*.js`); after ~011 they're additive only.
**Related:** [`CLAUDE.md`](CLAUDE.md) "Stack & conventions"

### 2026 (foundational) — Custom assertions in tests; no test framework (Process)
**Context:** Solo project; aggressive simplicity.
**Decision:** Tests live in `tests/`; each is a Node script using `assert(condition, message)`. No Jest, no Mocha, no Vitest. Real Turso DB used in integration tests with `TEST_`-prefixed data, cleaned up per run.
**Why:** No framework lock-in. Trivial to debug. Tests are scripts you can read top to bottom.
**Implications:** Adding a test means adding a `.test.js` file under `tests/`. Run with `node tests/<file>.test.js`. Mandatory before push for any non-trivial change (per CLAUDE.md). Results logged to `TEST_RESULTS.md`.

### 2026 (foundational) — Authentication: JWT + bcrypt; campaigns scoped to user (Infrastructure)
**Context:** Even though the project has one user today, the auth model needed to be in place from the start (especially if shared with friends later).
**Decision:** JWT-based auth, bcryptjs for password hashing. JWT secret auto-generated and stored in `_app_settings`. Middleware verifies Bearer token on `/api/*` except `/api/auth/*` and `/api/health`. Campaigns scoped to `user_id`.
**Why:** Standard pattern, low complexity, ready for multi-user without refactor.
**Implications:** Anything new touching `/api/*` automatically requires auth. New tables that store user-specific data should include a `user_id` column.

---

## Closed / superseded

### 2026 (early baseline) — Opus for ALL generation, Sonnet for sessions only (Direction) — SUPERSEDED 2026-04-26 (v1.0.99)
> *Replaced by:* "Opus as production default for main DM session continuations" (newest entry in the Decisions Log section).

**Context:** Cost discipline. Opus is ~10× Sonnet at runtime. Generation tasks (campaign plan, NPCs, quests, locations, companions, adventures, prelude arc) run once and are heavy; sessions run many times and need to be cheap.
**Decision:** Opus handles ALL generation tasks (one-shot heavy lifting). Sonnet handles ALL interactive DM sessions. Exception: the first session opening uses Opus for narrative richness.
**Why:** Cost-aware (principle #3). Sonnet is "good enough" for ongoing interaction.
**Why superseded:** The v1.0.96 prose-quality investigation showed Sonnet's "good enough" wasn't actually good enough for the brief's narrative ambitions. User's session-147 playtest confirmed Opus is the prose-quality lever. Cache architecture fix (v1.0.96) + tier 2 1h TTL (v1.0.98) brought Opus session cost to ~$1.50/hour — acceptable for the user's central-experience hobby project. The "Sonnet good enough" framing was wrong; the actual right framing is "Opus required, with cache discipline making it affordable."
**Implications of supersession:** Generation still uses Opus (no change). Sessions now also use Opus by default. Sonnet is still callable via the toggle as an escape hatch. The "Opus for generation, Sonnet for sessions" mental model no longer applies — it's now "Opus everywhere, with toggle to opt down to Sonnet for cost."
