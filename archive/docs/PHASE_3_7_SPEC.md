# PHASE_3_7_SPEC.md

**Status:** Drafted, ready for Code execution.
**Phase:** 3.7 of 7+ (mini-phase between Phase 3.5 close-out at v1.0.163 and Phase 4).
**Authored:** 2026-05-06.
**Sequencing gate:** Phase 3.5 closed at v1.0.163. Phase 3.7 unblocked. No Design dependency this phase — pure backend work plus documentation.
**Inputs inherited from Phase 3:**
- Marker pipeline foundation (`markerPipeline.js`, schemas-without-handlers precedent, `processResponseMarkers` dispatch)
- `base_threats` table and full `baseThreatService.js` lifecycle (spawn → approaching → defending/resolving → resolved)
- `KNOWN_BUGS.md` file structure with active + Resolved archive sections
- "Fix-along-the-way" methodology validated across five Phase 3 instances
- One-pass execution cadence from Phase 3.5 — Code drives end-to-end, single review gate at end

---

## §1. Overview

### §1.1 What Phase 3.7 is

Foundation work on the fortress system that lays groundwork for the eventual full fortress system design phase (Phase 5 candidate). Three sub-checkpoints:

- **SC-3.7.1 — Marker-driven fortress threats.** Reframe threat creation: AI DM emits markers, handler creates `base_threats` rows. Architecturally correct; current world-event-tick threat creation is dead code in production today (per `triage/kingdom-management-survey.md` §0).
- **SC-3.7.2 — Mechanical-damage asymmetry fix.** Player-led defense (`defending` → `resolved` via `[BASE_DEFENSE_RESULT]` marker) currently doesn't apply mechanical damage to buildings/treasury/garrison; only auto-resolve does. Close the asymmetry per user's 2026-05-05 ruling: damage is always mechanical regardless of resolution path.
- **SC-3.7.3 — Documentation + KNOWN_BUGS update.** Three KNOWN_BUGS entries filed for fortress system gaps that aren't being fixed in Phase 3.7. CLAUDE.md updated to reflect marker-driven threat origination as canonical.

### §1.2 What Phase 3.7 explicitly does NOT do

- **Holdings purpose data primitives.** Framework work whose consumers (holdings management UX, building-purpose mechanics) don't exist yet. Designing the data shape now means guessing at consumer needs. Defers to the fortress system design phase where the framework gets designed alongside its first real consumer.
- **Region-state primitives.** Same logic. Region semantics (geographic? political? hybrid?) are real design questions that belong to the fortress phase, not Phase 3.7.
- **Recapture quest framework.** A real campaign feature per user's 2026-05-05 vision: multi-session arc, ally requirements, coordination beats. Substantial design and implementation work; belongs to the fortress system design phase.
- **Fortress intensity dial.** Pulled from Phase 3.5 entirely. The dial sits honestly only after the fortress system has been designed; speccing it now means dialing a system about to change.
- **Holdings management UI.** Not in any current phase. Future fortress system phase territory.
- **Secondary holdings system (watchtowers, forward camps, etc. as a coherent system).** Mentioned in user's fortress vision; belongs to the full fortress phase.
- **Replacing or removing the world-event-tick threat creation path.** SC-3.7.1 introduces marker-driven threats as the new canonical path, but the existing world-event path stays in place (deprecated, not removed). Removing it would touch the living-world tick architecture — out of scope.

### §1.3 Decision summary going into Phase 3.7

Calls already made before this spec was authored (2026-05-05 to 2026-05-06):

| Call | Decision |
|---|---|
| Phase 3.7 framing | Foundation/groundwork phase. Distinct from full fortress system phase (Phase 5 candidate). |
| Speculative-vs-safe groundwork | Ship safe groundwork only (marker-driven threats, damage-fix, KNOWN_BUGS). Defer speculative groundwork (holdings purpose data, region primitives) to fortress phase. |
| One-pass execution | Code drives end-to-end. Single end-of-phase review gate. Internal ship cadence Code's call. |
| Damage asymmetry stance | Damage is always mechanical, regardless of resolution path. Close the asymmetry. |
| Threat creation pipeline | Marker-driven (AI DM emits, handler creates threat row). World-event-tick path deprecated but not removed in Phase 3.7. |

### §1.4 Cadence and execution

Same one-pass cadence as Phase 3.5. Code drives end-to-end without per-sub-checkpoint review gates within Phase 3.7. Internal ship cadence is Code's discretion (likely one ship given the bounded scope, but Code may judge two ships cleaner if SC-3.7.1's marker-pipeline work and SC-3.7.2's damage fix want separation).

End-of-phase review covers the cumulative Phase 3.7 state. Phase 3.7 closes when review passes.

---

## §2. SC-3.7.1 — Marker-driven fortress threats

### §2.1 What's wrong today

Per `triage/kingdom-management-survey.md` §0 and §3.1: `RAID_CAPABLE_EVENTS` defines five event types (`bandit_activity`, `war`, `undead_uprising`, `mercenary_incursion`, `cult_activity`), but no production codepath creates `world_events` rows with any of those types. The Opus prompt enum and faction-milestone spawner emit different types entirely. **Threat-from-event spawn is dead code in production.**

This means: today, no fortress threats spawn unless something inserts a `bandit_activity`/`war`/etc. row by hand or via test fixture. Players don't experience fortress threats organically.

### §2.2 What SC-3.7.1 builds

A new marker-driven path for fortress threat creation. The AI DM emits a `[FORTRESS_THREAT]` marker (or similar — exact name in §2.3); a handler in `baseThreatService.js` parses the marker and creates a `base_threats` row directly. The world-event-tick path stays but is no longer the canonical origin.

Architectural correctness: this aligns with user's 2026-05-05 design vision — fortress threats are narrative-driven (AI DM decides when the world threatens the player's holdings based on quest context, regional state, story beats), not probability-driven (per-tick rolls against fixed probabilities).

### §2.3 Marker schema

Add to `markerSchemas.js`:

```js
FORTRESS_THREAT: {
  required: ['BaseId', 'EventType', 'Force', 'WarningDays'],
  optional: ['Source', 'Category', 'Reason'],
  fields: {
    BaseId: { type: 'integer', min: 1 },
    EventType: { type: 'enum', values: ['bandit_activity', 'war', 'undead_uprising', 'mercenary_incursion', 'cult_activity'] },
    Force: { type: 'integer', min: 1, max: 30 },
    WarningDays: { type: 'integer', min: 1, max: 30 },
    Source: { type: 'string', maxLength: 80 },
    Category: { type: 'enum', values: ['criminal', 'political', 'arcane', 'religious', 'military'] },
    Reason: { type: 'string', maxLength: 200 },
  },
},
```

Field semantics:
- `BaseId` — which of the player's bases is being threatened. AI DM identifies via context.
- `EventType` — picked from `RAID_CAPABLE_EVENTS` keys. Determines target preference logic, default force range, default warning days (overridable by Force/WarningDays).
- `Force` — attacker strength (drives raid vs siege determination via `SIEGE_FORCE_THRESHOLD`).
- `WarningDays` — game-days until deadline.
- `Source` — display label (e.g., "Bandit Raiders," "Restless Dead"). Falls back to `RAID_CAPABLE_EVENTS[EventType].sourceLabel` if absent.
- `Category` — preserves notoriety category enum. Falls back to event type's default category if absent.
- `Reason` — narrative justification ("rivals of the warlord you defeated last month seek vengeance"). Stored on the threat row for later prompt injection during the threat's lifecycle.

### §2.4 Handler implementation

In `baseThreatService.js`, register the handler:

```js
import { registerMarkerHandler } from './markerPipeline.js';

registerMarkerHandler('FORTRESS_THREAT', async (parsed, ctx) => {
  // Validate base belongs to this character's campaign
  // Validate base is active (not abandoned/captured)
  // Check no existing approaching/defending/resolving threat on this base (single-active-threat invariant)
  // Compute threat_type (raid vs siege) from Force + SIEGE_FORCE_THRESHOLD
  // Insert base_threats row with status='approaching'
  // Create narrative_queue entry (priority by threat type)
  // Return { threatId, threatType, deadline } for the route to pass through
});
```

Same shape as SC-4 piety, SC-5 bond-shifts handlers — registered at module-load, dispatched via `processResponseMarkers`.

### §2.5 What stays the same

- The threat lifecycle (approaching → defending/resolving → resolved) is unchanged. Only the *origination* changes.
- Auto-resolve math, damage application logic, recapture window mechanic — all unchanged.
- The `world_events`-driven path (`generateThreatsForCampaign` reading raid-capable events from world_events table) stays in place. Marked deprecated in code comments; not removed.

### §2.6 What this enables for the AI DM

Once the marker is registered, the AI DM can emit fortress threats narratively. Example prompts the DM might compose around:
- "Your scouts at the watchtower report an approaching warband. `[FORTRESS_THREAT: BaseId=3 EventType="bandit_activity" Force=8 WarningDays=4 Source="Hill Reavers" Reason="rivals of the warlord you defeated last month"]`"
- "A messenger from the temple arrives with grim news: undead are massing in the catacombs. `[FORTRESS_THREAT: BaseId=2 EventType="undead_uprising" Force=12 WarningDays=3 Reason="the seal you broke last session is unraveling"]`"

Phase 4's AI behavior diagnostic work will tune *how* the DM decides when to emit these. Phase 3.7 just builds the marker.

### §2.7 Acceptance criteria

- `FORTRESS_THREAT` schema added to `markerSchemas.js`
- Handler registered in `baseThreatService.js` via `registerMarkerHandler`
- Handler validates base ownership and active status
- Handler enforces single-active-threat-per-base invariant
- Handler creates `base_threats` row + `narrative_queue` entry on success
- Handler returns structured result for route handler to pass through
- Tests cover: valid marker → threat created; invalid BaseId → error in handlerResults; existing threat → skipped; raid vs siege determination
- Existing world-event-driven `generateThreatsForCampaign` still works (no regression)
- DECISION_LOG entry on the architectural reframe

### §2.8 What SC-3.7.1 explicitly does NOT do

- Doesn't update Opus's living-world-generator prompt to emit raid-capable event_types. The producer gap (per kingdom survey §0) is now resolved by a different mechanism (markers); the world-event path stays unchanged but unused for threat creation in practice.
- Doesn't remove `generateThreatsForCampaign` or its consumers in the living-world tick.
- Doesn't add new `RAID_CAPABLE_EVENTS` entries or change existing ones.
- Doesn't change threat resolution, damage, or recapture logic.

---

## §3. SC-3.7.2 — Mechanical-damage asymmetry fix

### §3.1 What's wrong today

Per `triage/kingdom-management-survey.md` §1.6: when a threat auto-resolves with `damaged` outcome, `computeDamageFromOutcome` mutates buildings, treasury, and garrison (real mechanical loss). When the player engages via `defending` flow and the marker reports `damaged` outcome, `recordPlayerDefenseOutcome` writes the outcome and damage_report JSON blob but **does not mutate base buildings/treasury/garrison.** Only narrative damage is recorded.

This creates a perverse incentive: engaging defense is mechanically free (worst case: no mechanical damage), while ignoring threats can cost real resources (worst case: real garrison/treasury loss). Player should always engage to minimize mechanical loss, even when narratively engaging makes no sense.

User's 2026-05-05 ruling: **damage is always mechanical, regardless of resolution path.** Close the asymmetry.

### §3.2 What SC-3.7.2 builds

Modify `recordPlayerDefenseOutcome` (`baseThreatService.js`) to apply mechanical damage from the outcome the same way `autoResolveThreat` does. The marker reports the outcome (repelled/damaged/captured); `computeDamageFromOutcome` then runs against the threat + base + outcome, mutating buildings/treasury/garrison per the existing logic.

The damage_report JSON blob continues to record narrative damage; mechanical damage now also lands on the actual columns.

### §3.3 Implementation shape

Today:
```js
async function recordPlayerDefenseOutcome(threatId, parsed) {
  // ... validate, fetch threat
  // UPDATE base_threats SET outcome=?, damage_report=?, resolved_game_day=? WHERE id=?
  // (no mechanical mutation)
}
```

After:
```js
async function recordPlayerDefenseOutcome(threatId, parsed) {
  // ... validate, fetch threat
  // Synthesize outcomeCalc from the marker's Outcome value
  const outcomeCalc = synthesizeOutcomeCalcFromMarker(parsed);
  // Run the existing damage application
  await computeDamageFromOutcome(threat, base, outcomeCalc);
  // UPDATE base_threats SET outcome=?, damage_report=?, resolved_game_day=? WHERE id=?
}
```

`synthesizeOutcomeCalcFromMarker` is a small new helper — translates `parsed.Outcome` (string: `repelled` | `damaged` | `captured`) into the shape `computeDamageFromOutcome` expects (which today comes from `computeAutoResolveOutcome`'s return value).

### §3.4 Margin handling for damaged outcome

Auto-resolve's `damaged` outcome has two sub-tiers based on margin:
- `margin >= 0` (mild damaged) → 25% treasury, 20% garrison, 1-2 buildings damaged
- `margin -1..-5` (severe damaged) → 50% treasury, 40% garrison, 2-3 buildings damaged

Player-led defense via marker doesn't have a margin (the AI DM didn't roll dice; it narrated the result). Default for player-led `damaged`: use the **mild** sub-tier (margin treated as 0). Rationale: player engaged with the defense; even a "damaged" outcome reflects active resistance. Penalize players who engaged less harshly than players who didn't.

If the AI wants to signal severe damage in player-led defense, it can do so via a future explicit marker field (`Severity: 'mild'|'severe'`) — but that's out of Phase 3.7 scope. Default to mild for now.

### §3.5 Acceptance criteria

- `recordPlayerDefenseOutcome` runs `computeDamageFromOutcome` for `damaged` and `captured` outcomes
- `repelled` outcome continues to apply zero damage (no change)
- Mild sub-tier used as default for player-led `damaged`
- Existing damage_report JSON blob continues to be written
- Tests cover: each outcome path applies expected mechanical damage; damage_report continues to populate; building/treasury/garrison columns reflect post-damage state
- DECISION_LOG entry on the asymmetry fix
- KNOWN_BUGS archive entry resolved at this ship (per §4 below)

### §3.6 What SC-3.7.2 explicitly does NOT do

- Doesn't add severity options to the `[BASE_DEFENSE_RESULT]` marker (future work)
- Doesn't change auto-resolve damage logic
- Doesn't change capture-window behavior

---

## §4. SC-3.7.3 — Documentation + KNOWN_BUGS update

### §4.1 What ships

Three KNOWN_BUGS entries plus CLAUDE.md updates reflecting Phase 3.7's architectural changes.

### §4.2 KNOWN_BUGS entries

PM has authored three entries — see Artifact 2 for paste-ready content. Code lands them as part of SC-3.7.3:

1. **Active entry: Recapture window without recapture mechanism.** The 14-day recapture grace exists in code (`RECAPTURE_WINDOW_DAYS = 14`, `expireStaleCapturedBases`) but no player-side codepath uses it. Defers to the fortress system design phase.
2. **Active entry: Holdings purpose data is stub.** Holdings (watchtowers, outposts, etc.) currently distinguished only by `subtype`; no data captures what each holding *does* or *produces*. Defers to fortress system design phase.
3. **Resolved archive entry: Producer gap (raid-capable events).** SC-3.7.1's marker-driven threats absorb this. Archived with date + ship version + resolution mechanism.
4. **Resolved archive entry: Mechanical-damage asymmetry.** SC-3.7.2's fix absorbs this. Archived with date + ship version + resolution mechanism.

### §4.3 CLAUDE.md updates

Find the marker pipeline / `dmSessionService` documentation section and append:

- **Fortress threat origination is marker-driven.** AI DM emits `[FORTRESS_THREAT]`; handler in `baseThreatService.js` creates the threat row. The legacy world-event-tick path (`generateThreatsForCampaign` reading raid-capable events from `world_events`) is deprecated and unused in production.
- Add `FORTRESS_THREAT` and `BASE_DEFENSE_RESULT` to the canonical marker list if they're not already there.

Find the fortress / base management section (or create one if it doesn't exist):

- **Damage application is mechanical regardless of resolution path.** Both auto-resolve (`autoResolveThreat`) and player-led defense (`recordPlayerDefenseOutcome` post-SC-3.7.2) mutate buildings/treasury/garrison columns per `computeDamageFromOutcome`.
- **Recapture window exists but no recapture path.** Reference KNOWN_BUGS entry. Note that the fortress system design phase will build the actual recapture flow as a quest framework.

### §4.4 Acceptance criteria

- Three KNOWN_BUGS entries added (two active, two resolved-archive — yes, two of each, four total entries)
- CLAUDE.md updated per §4.3
- DECISION_LOG entry consolidating the three SC-3.7.x ships
- No other documentation work

### §4.5 What SC-3.7.3 explicitly does NOT do

- Doesn't write a fortress system design doc (that's the eventual fortress phase's first deliverable)
- Doesn't add new docstrings to `baseThreatService.js` beyond what's directly relevant to SC-3.7.1 + SC-3.7.2 changes
- Doesn't update `PROJECT_BRIEF.md` or `CONSOLIDATED_TODO.md` (PM owns those updates separately)

---

## §5. Engineering notes

### §5.1 DB shape decisions

- **No new schema migrations in Phase 3.7.** All work uses existing tables.
- `base_threats` table is unchanged. New rows come from a different origin (marker handler) but the row shape is identical to what `generateThreatsForCampaign` produces today.

### §5.2 Backwards compatibility

- The existing `generateThreatsForCampaign` codepath remains; threats from the world-event tick (if any are ever produced) continue to work.
- The new marker-driven path is additive.
- No data migration needed.

### §5.3 Test strategy

- **SC-3.7.1 tests:** marker schema validation (valid + invalid cases per field), handler dispatch (valid base, invalid base, existing-threat-on-base case), raid-vs-siege determination, narrative queue entry creation.
- **SC-3.7.2 tests:** `recordPlayerDefenseOutcome` with each outcome value, damage application matches auto-resolve for equivalent cases, mild sub-tier used by default for `damaged`, damage_report still populates.
- **Regression tests:** existing `baseThreatService` tests stay green. Living-world tick tests confirm `generateThreatsForCampaign` path still works.

### §5.4 Sub-checkpoint structure

Phase 3.7 internal sub-checkpoints (informal, Code's discretion to ship as one or batched):

- **SC-3.7.1** — Marker-driven fortress threats
- **SC-3.7.2** — Mechanical-damage asymmetry fix
- **SC-3.7.3** — Documentation + KNOWN_BUGS

Likely one ship; Code may judge two ships cleaner if SC-3.7.1 (new marker work) and SC-3.7.2 (modifying existing path) want separation. End-of-phase review covers the cumulative state.

### §5.5 What Phase 3.7 makes possible (downstream)

- **Phase 4 (AI behavior diagnostic):** marker-driven fortress threats give Phase 4 a real surface to instrument. "When does the AI emit `[FORTRESS_THREAT]`?" becomes a diagnostic question with a real signal.
- **Future fortress system design phase (Phase 5 candidate):** holdings purpose data and region-state primitives get designed against real consumer needs (the holdings management UI, the region-driven threat origination logic). The fortress phase inherits a clean threat-origination pipeline from Phase 3.7 and builds the management/recapture/region systems on top.

---

## §6. Open questions

Resolved during drafting; no PM calls outstanding for Phase 3.7.

**Q1 — Should `FORTRESS_THREAT` marker support multi-instance (multiple threats in one AI response)?** PM lean: yes, for consistency with other multi-instance markers (LOOT_DROP, NOTORIETY_GAIN, etc.). Code's call on whether the schema declares it explicitly or relies on the pipeline's default multi-instance handling.

**Q2 — Should the deprecated `generateThreatsForCampaign` path be marked deprecated in code comments?** PM lean: yes, with a comment block referencing this spec's §1.2 ("Removing it would touch the living-world tick architecture — out of scope") and noting that marker-driven origination is canonical.

**Q3 — Default Source/Category fallbacks: schema-side or handler-side?** PM lean: handler-side. Schema validates structure; handler does the lookup against `RAID_CAPABLE_EVENTS` for fallbacks. Cleaner separation.

**Q4 — Severity field on `[BASE_DEFENSE_RESULT]` for player-led-damaged sub-tier?** Out of Phase 3.7 scope per §3.4. Defaults to mild. Future enhancement if narrative weight calls for it.

---

## §7. Handoff to Code

### §7.1 What this spec is

A scoping document for Phase 3.7 implementation. PM has authored the spec; Code implements end-to-end. No Design dependency this phase — pure backend + documentation work.

### §7.2 Sequence Code follows

1. **Implement SC-3.7.1, SC-3.7.2, SC-3.7.3** in any order Code judges cleanest. Likely sequence: marker work first (SC-3.7.1), damage fix second (SC-3.7.2), documentation last (SC-3.7.3).
2. **Ship for end-of-phase review.** PM + user review the cumulative Phase 3.7 state.
3. **Iterate per review feedback.** Phase 3.7 closes when review passes.

### §7.3 What Code is being asked to do

- Implement `FORTRESS_THREAT` marker schema and handler per §2
- Modify `recordPlayerDefenseOutcome` per §3
- Land KNOWN_BUGS entries (PM-authored, paste-ready in companion artifact) per §4.2
- Update CLAUDE.md per §4.3
- DECISION_LOG entries: one for SC-3.7.1 architectural reframe; one for SC-3.7.2 asymmetry fix; one closing entry for Phase 3.7
- Tests per §5.3

### §7.4 What Code is NOT being asked to do

- Add new schema migrations
- Build holdings purpose data or region-state primitives (deferred to fortress phase)
- Build recapture quest framework (deferred to fortress phase)
- Update Opus's living-world-generator prompt
- Remove or modify `generateThreatsForCampaign`'s structure (deprecated, not removed)
- Update `PROJECT_BRIEF.md` or `CONSOLIDATED_TODO.md` (PM owns)

### §7.5 Standing by

PM is available throughout Code's execution; surface questions when they arise. Standing by for end-of-phase review when the work is ready.

---

## Document footer

**Authored:** 2026-05-06 by PM.
**Lock date:** 2026-05-06.
**Supersedes:** Nothing.
**Related:**
- `PROJECT_BRIEF.md`
- `PHASE_3_REFACTOR_SPEC.md` — predecessor; established marker pipeline foundation Phase 3.7 builds on
- `PHASE_3_5_SPEC.md` — immediate predecessor; established one-pass execution cadence Phase 3.7 inherits
- `triage/kingdom-management-survey.md` — survey informing this spec's threat-origination reframe
- `KNOWN_BUGS.md` — file Phase 3.7 contributes four entries to (per §4.2)
- `CONSOLIDATED_TODO.md` — to be updated to reflect Phase 3.7 active and Phase 4 pending