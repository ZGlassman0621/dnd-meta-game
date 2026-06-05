# PHASE_3_REFACTOR_SPEC.md

**Status:** Locked. PM-authored against Code's survey package dated 2026-05-03.
**Phase:** 3 of 7 (per `CONSOLIDATED_TODO.md`).
**Authored:** 2026-05-03.
**Sequencing gate:** Phase 2 close-out work and smoke run completed at v1.0.143. Phase 3 implementation is unblocked.
**Inputs inherited from Phase 2:** Canon transfer service exists; mentor imprint seeding pattern available; three-state `creation_phase` enum in place (now four-state with `'prelude_setup'` from v1.0.138); editorial aesthetic locked as project default; Opus-default for all gameplay sessions established.
**Clean slate confirmed:** No in-flight campaign data to preserve across this refactor.

---

## §1. Overview

### §1.1 What Phase 3 is

Two foundation refactors on existing systems, motivated by repeated structural patterns surfaced across nine system reviews and confirmed by Code's audit:

- **§3.1 — Standing-scalar abstraction.** Five existing systems (companion loyalty, faction standing, NPC disposition, Mythic piety, DM Mode bond-shifts) all track "an integer score representing a relationship + a label + an audit trail of changes." Each does this with a different schema, different range, different label cuts, and different audit-trail strategy. This phase builds shared behavioral infrastructure that the systems migrate to incrementally, without forcing schema convergence.

- **§3.2 — Marker pipeline consolidation.** Two pipelines for processing AI-emitted markers run in parallel today, neither aware of the other: a newer schema-driven validation pipeline (`markerSchemas.js` + `ruleVerifiers.js` + correction-loop) that doesn't drive side effects, and an older sprawl of ~28 ad-hoc `detect*()` functions in `dmSessionService.js` that does drive side effects but lacks validation. This phase elevates the schema-driven pipeline to canonical status, sequences the detect-function sprawl into it over time, and ports the Prelude marker pipeline to the same pattern.

### §1.2 What Phase 3 explicitly does NOT do

Surfaced from the bootstrap framing, the audit, and Code's survey:

- **Pattern F class features.** Keeper Eidetic Memory, Sage L5 lore queries, defeated_log, encountered_texts log. Need playtest evidence to design correctly. Phase 7.
- **AI shelter-behavior counter-mechanisms.** Phase 4's diagnostic.
- **Party Synergies AI integration.** Phase 5 candidate.
- **Themes AI-trigger specs.** Phase 5 candidate.
- **Inter-companion `party_relationships` port from DM Mode JSON to player-mode table.** Phase 5 (Companions wound representation focus area) or Phase 6 (DM Mode dedicated pass).
- **Time-bounded state primitives** (Quick Study 24-hour, Tiefling 1-week debts, per-arc gating). Separate refactor; own phase.
- **Drow Lolth standing tracker.** Parked to FUTURE_FEATURES per 2026-05-03 DECISION_LOG entry; user does not play Drow.
- **Companion thread activation pattern (event-bus, not markers).** Different paradigm. Stays as-is in `companionTriggerChecker.js`. Forcing alignment to the marker pipeline would distort one or both systems.
- **DM Mode bond-shifts schema migration (JSON-blob to dedicated table).** The behavioral migration to the standing-scalar abstraction is in Phase 3 scope; the storage migration to a real `party_relationships` table is deferred to Phase 6, where it pairs naturally with the player-mode port.
- **Companion loyalty and Mythic piety prompt-injection backlog at the consumer level beyond the abstraction's hook.** The hook is in scope; downstream prompt-builder polish for these systems is bounded by "wire the hook into existing prompt-builder injection points" — not "redesign how loyalty or piety should surface in narration."
- **100% detect-function deprecation.** SC-6.4 takes a judgment call; not all 28 must migrate. The pipeline becomes canonical; remaining detect-functions become legacy/exception with documented rationale.

### §1.3 Inputs Phase 3 inherits from Phase 2

- **Canon transfer service** (`campaignCanonTransferService.js`) exists. Phase 3 NPC-related work has a working precedent for "data flows from one campaign-shaped context to another."
- **Mentor imprint seeding** is wired. Cross-context handoff is no longer a parallel-build concern.
- **`creation_phase` enum is four-state** (`'active' | 'creating' | 'ready_for_primary' | 'prelude_setup'`). No Tranche 1/2 service file consults `creation_phase` directly; impact on Phase 3 design is nil. Listed for awareness.
- **Editorial aesthetic** is the project default for any UI surface Phase 3 might touch. Phase 3 does not currently expect to touch UI surfaces; if a sub-checkpoint surfaces one, editorial register applies.
- **Opus is default for all gameplay sessions** (per 2026-05-03 DECISION_LOG entry). Marker pipeline work in §3.2 should assume Opus output characteristics; non-prose validation work continues to use Sonnet (or Haiku where appropriate per the prose-vs-non-prose principle).

### §1.4 Decisions made before drafting

Five PM calls were made on 2026-05-03 before this spec was authored:

| Call | Decision |
|---|---|
| 1 — Abstraction shape | **Parameterize.** Each consumer keeps its own schema; abstraction provides shared behavior. |
| 2 — Prompt-injection hook | **In scope from day one.** The abstraction provides a `formatForPrompt()`-shape method; companion loyalty and piety get first injection during their migrations. |
| 3 — DM Mode bond-shifts | **Behavioral migration to abstraction in Phase 3; schema migration (JSON to table) deferred to Phase 6.** Abstraction must natively support directional pairs and dual scalars even though only DM Mode currently exercises those features. |
| 4 — Marker pipeline canonical foundation | **Extend `markerSchemas.js` as canonical.** Sequence detect-function deprecation deliberately; standing-scalar markers migrate as part of §3.1. Other detect-functions migrate in §3.2 with explicit deferral for any that don't fit the schema model. |
| 5 — Companion threads | **Out of Phase 3.2 scope.** Event-bus pattern stays in `companionTriggerChecker.js` unchanged. |

These calls shape every section that follows.

### §1.5 Cadence and sub-checkpoints

Phase 2's chunked-shipping discipline carries forward. Phase 3 is sequenced into sixteen sub-checkpoints across three refactor families:

SC-1     §3.1 abstraction foundation                     [API review gate]
SC-6.1   §3.2 pipeline foundation                        [API review gate]
SC-2     §3.1 companion loyalty migration                [smoke gate]
SC-3     §3.1 faction standing migration                 [snapshot gate]
SC-4     §3.1 piety + NPC disposition migration          [smoke + snapshot]
SC-5     §3.1 DM Mode bond-shifts behavioral migration   [smoke gate]
SC-6.3   §3.2 Prelude marker port                        [smoke + DECISION_LOG]
SC-6.4   §3.2 detect-function sprawl survey              [DECISION_LOG]
SC-6.5   §3.2 documentation                              [final §3.2 ship]
SC-7.1   §3.3 abstraction foundation                     [API review gate]
SC-7.2   §3.3 companion mood migration                   [smoke gate]
SC-7.3   §3.3 NPC absence cluster                        [smoke gate]
SC-7.4   §3.3 notoriety migration                        [smoke gate]
SC-7.5   §3.3 threshold-crossed cluster (4 consumers)    [smoke gate]
SC-7.6   §3.3 survival timer cleanup                     [smoke gate]
SC-7.7   §3.3 world event clock fix                      [smoke + DECISION_LOG]
[final §3.3 ship]

This sequencing puts the lowest-risk migrations first within each refactor family. Each sub-checkpoint is a real ship with a real review gate. SC-1 + SC-6.1 are batched into one ship per the 2026-05-04 batching call; otherwise sub-checkpoints ship individually.

§3.3 work sequences after §3.1 is complete (§3.1 already done at v1.0.148) and runs in parallel with the final §3.2 sub-checkpoints (SC-6.4, SC-6.5). The two refactor families don't depend on each other; sequencing them in parallel saves no real time but doesn't cost any either.

---

## §2. Standing-scalar abstraction (Refactor 3.1)

### §2.1 What the abstraction is

A behavioral library — not a schema, not a single source of truth, not a centralized service. Each existing standing-scalar consumer keeps its own table, its own column names, its own range, its own defaults, its own label-band cuts, its own audit-trail strategy. What the abstraction provides is **shared behavior** that today is implemented inconsistently across consumers.

The abstraction's responsibilities:

- **Range clamping.** Apply min/max to every score change. (Currently each consumer implements this inline with `Math.max(...) + Math.min(...)` calls.)
- **Label mapping.** Given a score and a label-band configuration, return the current label. (Currently each consumer hardcodes its `getLoyaltyLabel`, `getStandingLabel`, `getDispositionLabel`, etc.)
- **Audit-trail recording.** Append change events to the consumer's audit trail with consistent shape and timestamp. (Currently each consumer rolls its own JSON-array push or history-table insert.)
- **Threshold detection.** When a score change crosses a configured threshold (in either direction), surface that crossing for downstream side effects. (Currently each consumer has its own threshold check, e.g., `checkSecretReveals`, `checkNewThreshold` for piety.)
- **Side-effect dispatch.** Allow consumers to register handlers that fire on threshold crossings without each consumer building its own dispatch.
- **Prompt-injection hook.** Provide a consistent `formatForPrompt()`-shape method that prompt builders can call to render a standing into the AI's context window. Per-consumer formatting still configurable; the hook is the consistent call site.

What the abstraction does NOT do:

- **Storage.** Each consumer keeps its own table, its own column names, its own row shape. The abstraction reads and writes through the consumer's existing repository functions.
- **Migration of legacy data.** Clean slate per Phase 3 entry call. No existing in-flight data needs preserving.
- **Cross-consumer queries.** "Show me everyone whose standing toward X has shifted this session" is an artifact of schema convergence (Call 1's rejected option) and not in scope.
- **Range/label/threshold convergence.** A 0–100 loyalty stays 0–100 with 6 bands. A -100..+100 disposition stays -100..+100 with 7 bands. Piety stays 0-to-no-cap with threshold cuts at 3/10/25/50. The abstraction parameterizes these; it does not normalize them.

### §2.2 The standing-scalar configuration object

Each consumer instantiates the abstraction by passing a configuration object describing its specific shape. Configuration is per-consumer-static (defined once in the consumer's service file) — not stored in DB, not editable at runtime.

Configuration shape (specification, not final API):

```js
const COMPANION_LOYALTY_CONFIG = {
  // Identity
  name: 'companion_loyalty',                    // for logging, debugging, prompt-section labeling

  // Range and default
  range: { min: 0, max: 100 },
  defaultValue: 50,

  // Label-band mapping. Cuts are in descending order; first match wins.
  // Each cut is { atOrAbove: number, label: string }.
  labelBands: [
    { atOrAbove: 90, label: 'devoted' },
    { atOrAbove: 75, label: 'loyal' },
    { atOrAbove: 50, label: 'trusted' },
    { atOrAbove: 25, label: 'uncertain' },
    { atOrAbove: 10, label: 'distrustful' },
    { atOrAbove: 0,  label: 'hostile' },
  ],

  // Threshold-crossing detection. Each threshold can fire on cross-up, cross-down, or both.
  thresholds: [
    // Companion loyalty currently uses per-secret thresholds; the consumer
    // handles the dispatch downstream. This array can be empty when the
    // consumer doesn't want abstraction-level threshold dispatch.
  ],

  // Audit-trail strategy.
  auditTrail: {
    storage: 'inline_json',                     // 'inline_json' | 'separate_table' | 'split_by_sign' | 'none'
    column: 'loyalty_events',                   // when 'inline_json'
    eventShape: ['event', 'change', 'new_total', 'date'],
  },

  // Prompt-injection formatting. Returns a string fragment for prompt builders.
  formatForPrompt: (current) => {
    // returns: "Loyalty: TRUSTED (62/100). Recent: defended in tavern brawl (+5)."
  },
};
```

Faction standing's configuration would differ in `range` (-100..+100), `defaultValue` (0), `labelBands` (9 bands instead of 6), `auditTrail.storage` (`'split_by_sign'` with `positiveColumn: 'deeds_for'` and `negativeColumn: 'deeds_against'`), and `formatForPrompt` (existing `getStandingBehavior` mapping). Same shape; different parameters.

DM Mode bond-shifts's configuration is the most divergent — see §2.7 for its multi-scalar and directional-pair extensions.

### §2.3 Public API

The abstraction exposes a small, deliberately constrained surface:

adjustStanding(config, contextKey, change, options)

config: the consumer's configuration object
contextKey: identifies the specific row (e.g., {companionId: 7})
change: signed integer
options: { reason: string, sessionId?, gameDay? }
returns: { oldScore, newScore, change, label, thresholdsCrossed: [...] }

getStanding(config, contextKey)

returns: { score, label, recentAuditEntries }

formatStandingForPrompt(config, contextKey)

returns: string fragment, or empty string if no standing exists for this context

registerThresholdHandler(config, threshold, handler)

handler(crossingEvent) called when threshold crossed in dispatched direction

**Internal helpers** (not exported, private to the module): `clampToRange`, `mapToLabel`, `recordAuditEntry`, `detectThresholdCrossings`. Each implements one of the responsibilities in §2.1 generically across configurations.

### §2.4 Per-system migration: companion loyalty (SC-2, first port)

**Pre-migration state** (per Code's survey):

- Storage: `companion_backstories.loyalty INTEGER DEFAULT 50`, audit trail in `companion_backstories.loyalty_events JSON array`.
- Service: `companionBackstoryService.adjustLoyalty()` does the math, the audit append, and calls `checkSecretReveals` for the threshold cascade.
- Prompt injection: **none.** This is the loyalty surfacing gap from Code's orientation note #2.

**Migration steps:**

1. **Create configuration object.** `COMPANION_LOYALTY_CONFIG` lands in `companionBackstoryService.js` with the shape from §2.2. Range 0–100, default 50, the 6 existing label bands, audit trail in `loyalty_events` JSON column.

2. **Replace internal logic in `adjustLoyalty`.** The function's body changes from inline math + audit append to a single call to the abstraction's `adjustStanding(COMPANION_LOYALTY_CONFIG, {companionId}, change, {reason})`. The `checkSecretReveals` call at the end remains — that's a consumer-specific side effect, not abstraction territory.

3. **Replace `getLoyaltyLabel` callers.** Anywhere the consumer or downstream code computed labels via the consumer's hardcoded function, replace with `getStanding(COMPANION_LOYALTY_CONFIG, ...).label`.

4. **Wire prompt-injection.** This is the gap fix. In `dmPromptBuilder.js::formatCompanions()` (lines 688-845 per Code's survey), add a call to `formatStandingForPrompt(COMPANION_LOYALTY_CONFIG, {companionId})` for each companion being formatted. The output is a one-line "Loyalty: TRUSTED (62/100). Recent: ..." fragment that surfaces companion loyalty to the AI for the first time.

5. **Test passes.** Existing tests around companion loyalty stay green. New test: prompt injection produces expected fragment for a companion with non-default loyalty.

**Acceptance criteria (SC-2):**

- All existing companion-loyalty-touching tests pass
- New test confirms prompt injection works for companion loyalty
- Companion mood decay (separate code path, not standing-scalar) unchanged
- Secret-reveal cascade (`checkSecretReveals`) still fires correctly
- Companion-level UI surfaces (any place loyalty is rendered to the user) unchanged
- DECISION_LOG entry if any abstraction-shape decision changes during migration

### §2.5 Per-system migration: faction standing (SC-3)

**Pre-migration state:**

- Storage: `faction_standings.standing INTEGER DEFAULT 0`, range -100..+100, audit trail split across two JSON arrays (`deeds_for`, `deeds_against`).
- Service: `factionService.modifyStanding()` does the math, decides which audit array to push to based on amount sign.
- Prompt injection: **works today** in `dmPromptBuilder.js::formatWorldStateSnapshot()` lines 1572-1583. The 6-standing display cap and `getStandingBehavior` mapping are existing functionality.

**Migration steps:**

1. **Create configuration object.** `FACTION_STANDING_CONFIG`. Range -100..+100, default 0, 9 label bands. Audit trail uses the `'split_by_sign'` strategy (Q1 from §6 surfaces this requirement).

2. **Replace internal logic in `modifyStanding`.** Same pattern as companion loyalty.

3. **Preserve `getStandingBehavior`.** This function maps labels to NPC-behavior hints ("Helpful but with limits", "Actively obstructive"). It's consumer-specific; the abstraction's labelBands return the label, but the consumer's prompt-injection function calls `getStandingBehavior(label)` to render the full prompt fragment.

4. **Migrate prompt injection to use abstraction's hook.** The existing prompt-builder code at lines 1572-1583 is rewritten to call `formatStandingForPrompt(FACTION_STANDING_CONFIG, ...)` for each faction. Output shape stays identical to current prompt output (no AI-facing change).

5. **Register marker handler if applicable.** If faction-standing has its own emission marker, register handler via §3.2 SC-6.1's pipeline.

6. **Test passes** including prompt-output snapshot tests if any exist; otherwise add one.

**Acceptance criteria (SC-3):**

- All existing faction-standing tests pass
- Snapshot test confirms prompt output is byte-identical (or sub-checkpoint flags an intentional change)
- 6-standing display cap preserved
- `getStandingBehavior` mapping preserved
- Membership flag (`is_member`) and rank still work end-to-end

### §2.6 Per-system migration: Mythic piety + NPC disposition (SC-4)

Two consumers in one sub-checkpoint because each surfaces a separate complexity that benefits from validation in the same review:

**Mythic piety** — adds prompt-injection (currently absent, same gap as companion loyalty). Tests dual-direction concerns: per-deity scoping (each character has multiple piety relationships), unbounded upper range, and the piety-history-table audit strategy (the only consumer using a separate history table instead of inline JSON).

**NPC disposition** — exercises the abstraction against a row that has *two* parallel standing scalars: `disposition` AND `trust_level`. This is the dual-scalar pattern that DM Mode bond-shifts will rely on more heavily in SC-5. Validating it against NPC disposition first lets us catch dual-scalar problems on a simpler shape before the harder one.

**Mythic piety migration steps:**

1. Configuration: `MYTHIC_PIETY_CONFIG`. Range 0-to-no-cap, default 1, no label bands (use threshold-crossing behavior instead). Audit trail strategy: `'separate_table'` pointing to `piety_history`. Thresholds: `[3, 10, 25, 50]`, fire on cross-up only (per-consumer threshold-handler dispatch maps these to ability unlocks).

2. Replace `pietyService.adjustPiety` internal logic with abstraction call. The threshold-crossing-detection that lives in `checkNewThreshold` migrates into the abstraction's threshold dispatch system, with per-consumer handler registration.

3. Wire prompt injection. New code in `dmPromptBuilder.js` at the appropriate section. The injection should surface piety per-deity for the active character: deity name, piety score, highest unlocked threshold, recent reason.

4. Register `[PIETY_CHANGE]` marker handler in §3.2's pipeline (replacing `dmSessionService.detectPietyChange`).

5. Test piety threshold-crossing fires correctly when standing crosses 3, 10, 25, 50 in either direction (cross-up unlocks; cross-down does not currently lock, but threshold tracking on `highest_threshold_unlocked` still records the highest reached).

**NPC disposition migration steps:**

1. Configuration: `NPC_DISPOSITION_CONFIG` AND `NPC_TRUST_CONFIG` — two separate configurations, both pointing at the same `npc_relationships` row, each managing its own column.

2. Replace `npcRelationshipService.adjustDisposition` and `adjustTrust` with abstraction calls.

3. Migrate the existing prompt-injection block (`dmPromptBuilder.js` lines 1608-1722) to use the abstraction's hook. Both disposition AND trust are rendered into each NPC's per-line output. Existing 25-NPC display cap preserved. Existing complex filter (lines 1608-1622) preserved — filter logic is consumer-specific, not abstraction territory.

4. Register marker handler if NPC disposition has its own emission marker.

5. Test passes including snapshot of NPC prompt output.

**Acceptance criteria (SC-4):**

- All piety tests pass; new test for piety prompt injection
- All NPC disposition tests pass; snapshot of NPC prompt output identical (or intentional change documented)
- Threshold cascade for piety fires correctly
- Dual-scalar shape validates: confirms abstraction handles two configs against one row without conflict
- Per-deity scoping for piety works (a character with piety to multiple deities sees all of them in prompts)
- `[PIETY_CHANGE]` handler registered and verified

### §2.7 Per-system migration: DM Mode bond-shifts (SC-5, last and most complex)

**Pre-migration state:**

- Storage: JSON blob inside `dm_mode_parties.party_data`, structure documented in Code's Tranche 1 §5. **Schema migration to a real table is deferred to Phase 6.** The behavioral migration in this sub-checkpoint operates on the JSON-blob storage as it exists today.
- Two scalars per directed pair (warmth, trust), both range -5..+5, default 0.
- Two application paths: per-turn `[BOND_SHIFT]` markers (in route handler `routes/dmMode.js`) AND session-end Sonnet-extracted `relationship_shifts` (in `dmModeChronicleService.extractRelationshipEvolution`).
- Prompt injection: works today in `dmModePromptBuilder.js` lines 321-338.

**This sub-checkpoint's complexity:**

- Multi-scalar (two scalars per pair, not one)
- Directional pair semantics (A→B and B→A are independently tracked)
- Two application paths — the abstraction's `adjustStanding` API needs to support both immediate-from-AI-marker and after-session-Sonnet-extraction
- Storage is JSON-blob, not a row column — abstraction's read/write needs to walk into the blob and back out
- Application happens in a route handler, not a service file — refactor opportunity to extract a `dmModeBondShiftService.js`

**Migration steps:**

1. **Extract a service file** — `dmModeBondShiftService.js`. Move the bond-shift application logic out of `routes/dmMode.js` lines 295-329 into the new service. Same logic, same JSON-blob storage; just relocated.

2. **Create configuration objects.** Both `DM_MODE_BOND_WARMTH_CONFIG` and `DM_MODE_BOND_TRUST_CONFIG`. Range -5..+5, default 0, no label bands (rendered as raw +/− numbers in prompts), audit trail is the in-row history array (FIFO max 10).

3. **Add directional-pair support to abstraction.** The contextKey for these configs is `{partyId, fromCharName, toCharName}` — the abstraction has to walk the JSON blob to find the right pair, update warmth/trust, and write back. This is the most complex storage path the abstraction supports; document carefully.

4. **Migrate the per-turn application path.** `detectBondShifts` continues to extract markers; now it dispatches each shift through `adjustStanding` calls (one for warmth, one for trust). The clamp-to-range and history-append logic is now provided by the abstraction.

5. **Migrate the session-end synthesis path.** `extractRelationshipEvolution` continues to call Sonnet to extract relationship shifts; the application of those shifts now goes through the same `adjustStanding` API as the per-turn path. Both paths converge on the abstraction.

6. **Migrate prompt injection.** `dmModePromptBuilder.js` lines 321-338 use `formatStandingForPrompt` for each pair. Existing output format preserved — `attitude` and `tension` are free-text fields not in the abstraction's scope, but warmth/trust numbers and recent-history rendering all flow through the hook.

7. **Register `[BOND_SHIFT]` handler** in §3.2's pipeline.

**Schema migration to dedicated table is OUT of this sub-checkpoint.** The `party_relationships` table that Phase 6 will build is not in Phase 3 scope. The abstraction is designed to support that future migration (its parameterized storage strategy includes a `'json_blob_in_row'` option that Phase 6 will swap for `'dedicated_table'`), but the swap itself is Phase 6 work.

**Acceptance criteria (SC-5):**

- All DM Mode bond-shift tests pass
- Both per-turn and session-end application paths converge on abstraction
- Directional-pair semantics preserved (A's warmth toward B is independent of B's toward A)
- 10-entry FIFO history preserved
- Free-text `attitude` and `tension` fields preserved (these stay outside the abstraction)
- Service file extraction completes (`dmModeBondShiftService.js` exists, route handler is thin)
- `[BOND_SHIFT]` handler registered and verified
- DECISION_LOG entry covering the dual-scalar parameterization shape, since it's structural

### §2.8 Cross-system invariants

Two invariants that hold across all five migrations:

**Invariant A: AI-facing output unchanged unless explicitly intended.** Every prompt-injection migration (or addition) should produce output the AI sees as the same shape it saw before — *except* for companion loyalty and Mythic piety, where the gap fix is explicitly intended to add new content the AI didn't previously see. For the other three (faction standing, NPC disposition, DM Mode bond-shifts), snapshot tests should confirm no regression.

**Invariant B: Side-effect cascades preserved.** Every consumer has downstream effects that fire on standing changes (loyalty drives secret reveals; piety drives ability unlocks; NPC disposition drives lifecycle propagations; etc.). These cascades stay consumer-side. The abstraction's `registerThresholdHandler` provides a hook for cleaner future implementations, but Phase 3 doesn't migrate existing cascades to it — they keep working as they do today, called from consumer code after the standing changes.

---

## §3. Marker pipeline consolidation (Refactor 3.2)

### §3.2.1 What §3.2 is

A consolidation of two parallel marker-processing pipelines that today run on the same response text without awareness of each other. Phase 3.2 elevates the schema-driven pipeline (`markerSchemas.js` + `ruleVerifiers.js` + correction-loop) to canonical status, sequences the older detect-function sprawl in `dmSessionService.js` into it over time, and ports the Prelude marker pipeline to the same pattern.

The decision to extend `markerSchemas.js` rather than retreat to detect-functions or maintain both was made on 2026-05-03. Three architectural facts make this the right move:

- The schema-driven pipeline has a working correction-loop that asks the AI to re-emit malformed markers next turn. The detect-function sprawl has no validation feedback at all — silent drops. The correction-loop is too valuable to leave unwired to real behavior.
- The schema-driven pipeline has a single source of truth (one schema per marker, one parser, one validator). The detect-function sprawl has 28 separate parser implementations with inconsistent error handling, no shared abstraction, and no enforcement of consistency.
- The project's own code (`markerSchemas.js` header docs) explicitly names this direction: *"This is the intermediate step toward full tool-use migration."* The schema-driven pipeline is where the project wants to be.

§3.2 makes that direction real.

### §3.2.2 The pipeline's shape

A marker's lifecycle through the consolidated pipeline:

AI emits response text containing zero or more markers
SCHEMA-DRIVEN VALIDATION: Each schema in MARKER_SCHEMAS attempts to parse
any instances of its marker in the text. Result is { validByKey, failures }.
SIDE-EFFECT DISPATCH: For each successfully-parsed marker, the pipeline
dispatches to a registered handler. Handler applies the side effect
(DB write, state mutation, marker-scoped cascade).
CORRECTION FEEDBACK: Failures (malformed markers) are formatted into a
correction note, stored on session_config.pendingMarkerCorrections, and
prepended to the next turn's prompt as a [SYSTEM] note asking the AI
to re-emit correctly.
RULE VERIFICATION: ruleVerifiers.js runs in parallel — verifies the AI
didn't break Cardinal Rules (HARD STOPS, meta commentary, mechanical-roll
leakage, still-freeze tic). Violations also feed into pendingRuleCorrections
(combined with marker corrections in a single SYSTEM note).
STRIPPED-OUTPUT RENDERING: Markers and any narrative-leaked machinery are
stripped from the displayed text. Player sees clean prose; the AI sees
the system note next turn.

The newer pipeline already does steps 2, 4, 5, and 6 today. The gap is step 3: side-effect dispatch is currently fragmented across the 28 detect-functions, and those detect-functions don't go through validation.

§3.2's work is making step 3 part of the pipeline, then migrating detect-functions into schema-handler pairs that hang off it.

### §3.2.3 Schema-handler model

Each marker has two declarations:

**Schema** (where it lives now, in `markerSchemas.js`): structural definition. Required/optional fields, types, enums, ranges. Used for parsing and validation.

**Handler** (new in §3.2): the side-effect function that runs when a marker is successfully parsed. Pure function from parsed marker data + context to state mutations. Registered against the schema by key.

Specification (not final API):

```js
// In a service file, e.g., pietyService.js
import { registerHandler } from '../services/markerPipeline.js';
import { MARKER_SCHEMAS } from '../services/markerSchemas.js';

registerHandler('PIETY_CHANGE', async (parsed, ctx) => {
  // parsed = { Deity: 'Lathander', Amount: +3, Reason: '...' }
  // ctx = { characterId, sessionId, gameDay, ... }
  return adjustStanding(MYTHIC_PIETY_CONFIG, 
    { characterId: ctx.characterId, deityName: parsed.Deity }, 
    parsed.Amount, 
    { reason: parsed.Reason, sessionId: ctx.sessionId, gameDay: ctx.gameDay });
});
```

The handler is the migration target. Today's `detectPietyChange()` in `dmSessionService.js` does its own regex parsing, validates ad-hoc, applies the change, and returns. Tomorrow's pipeline parses through the schema, dispatches to the registered handler, and the handler is the only place that knows about pietyService specifics.

This is the integration point with §3.1's standing-scalar abstraction. Standing-scalar markers (`[BOND_SHIFT]`, `[PIETY_CHANGE]`, and any new ones) are exactly the markers whose handlers call `adjustStanding(...)`. The two refactors interlock here.

### §3.2.4 Sequencing within §3.2

Recap from §1.5 with internal expansion:

- **SC-6.1** — pipeline foundation (front-loaded between SC-1 and SC-2 of §3.1)
- **SC-6.2** — standing-scalar marker migration (interlocks with §3.1's SC-3 through SC-5; not a separate ship)
- **SC-6.3** — Prelude marker pipeline port (after §3.1 fully done)
- **SC-6.4** — detect-function sprawl survey + selective migration (after SC-6.3)
- **SC-6.5** — pipeline documentation + closing DECISION_LOG entry

SC-6.2 is intentionally not a standalone sub-checkpoint in the §1.5 cadence — it lands within §3.1's SC-3, SC-4, and SC-5 as those systems migrate. The reason: it would be a half-implementation if a system migrated to the abstraction without also migrating its marker handler. They move together.

### §3.2.5 What §3.2 explicitly does NOT do

- **Doesn't migrate companion threads** — `companionTriggerChecker.js` uses an event-bus pattern, not markers. Different paradigm. Stays as-is per Call 5 from 2026-05-03.
- **Doesn't add Themes AI-trigger specs** — Phase 5 candidate. The pipeline being in place makes Phase 5's work easier (Themes markers can plug in), but Phase 3 doesn't author them.
- **Doesn't add Party Synergies marker layer** — Phase 5 candidate. Same logic as Themes.
- **Doesn't migrate every detect-function** — SC-6.4 is "survey and migrate what fits, park what doesn't." Phase 3 does not commit to 100% detect-function deprecation. The pipeline becomes canonical; detect-functions become legacy/exception.
- **Doesn't add new markers beyond what's necessary** — the migration is mechanism work, not content work. New marker semantics are out of scope unless they're necessary for an existing system's migration.

### §3.2.6 Cross-cutting interactions with §3.1

§3.1 (standing-scalar abstraction) and §3.2 (marker pipeline) interlock at the standing-scalar markers — `[PIETY_CHANGE]`, `[BOND_SHIFT]`, and any others surfaced during migration. The interaction is sequenced:

- §3.1's SC-1 (abstraction foundation) lands first. Provides the `adjustStanding` API.
- §3.2's SC-6.1 (pipeline foundation) lands next. Provides the handler-registration API.
- §3.1's SC-2 through SC-5 migrate the consumer systems. Each migration's marker handler is registered as part of the same sub-checkpoint, not a separate ship.
- §3.2's SC-6.3 (Prelude port) and SC-6.4 (detect-function survey) land after §3.1 is fully done.

Total: nine sub-checkpoints. Each is a real ship with a real review gate. Companion loyalty is the cleanest first migration; DM Mode bond-shifts is the messiest last migration. Pipeline foundation lands between SC-1 and SC-2 to ensure handler-registration is available when systems with markers start migrating.

### §3.2.7 Pipeline foundation: API specification

Specification, not final API. SC-6.1's deliverable.

```js
// services/markerPipeline.js

/**
 * Register a handler for a marker schema. Called at module-load time.
 * One handler per schema key. Handlers are pure functions from
 * (parsedMarker, context) to side-effect promises.
 */
export function registerHandler(schemaKey, handler);

/**
 * Process all markers in a response text against registered handlers.
 * Returns a result object with which markers fired, which failed validation,
 * and which had handler errors.
 */
export async function processResponseMarkers(text, context) {
  const { validByKey, failures } = validateDmMarkers(text);
  const handlerResults = [];
  
  for (const [schemaKey, instances] of Object.entries(validByKey)) {
    const handler = HANDLER_REGISTRY[schemaKey];
    if (!handler) continue; // Schema exists but no handler registered yet
    
    for (const parsed of instances) {
      try {
        const result = await handler(parsed, context);
        handlerResults.push({ schemaKey, parsed, result, ok: true });
      } catch (err) {
        handlerResults.push({ schemaKey, parsed, error: err.message, ok: false });
      }
    }
  }
  
  return { handlerResults, failures };
}

/**
 * Build the correction message that gets prepended to next turn's prompt.
 * Combines marker validation failures with rule violations from ruleVerifiers.js.
 */
export function buildPendingCorrectionsNote({ markerFailures, ruleViolations }) {
  // Reuses buildCorrectionMessage and buildRuleCorrectionMessage from
  // existing markerSchemas.js / ruleVerifiers.js. New helper just combines them.
}
```

The route handler in `routes/dmSession.js` changes from calling 28 detect-functions to:

```js
const { handlerResults, failures } = await processResponseMarkers(narrative, {
  characterId, sessionId, gameDay
});
const { violations: ruleViolations } = verifyDmResponse(narrative);
const pendingCorrections = buildPendingCorrectionsNote({ 
  markerFailures: failures, 
  ruleViolations 
});
// Persist pendingCorrections to session_config for next turn's prompt
```

Existing detect-function calls remain in the route handler during SC-6.1 and SC-6.2 (parallel pipelines). Each migration in SC-6.2 removes the corresponding detect-function call as its handler is registered. By the end of SC-5, the route handler should be calling fewer detect-functions than it started with — the standing-scalar ones are gone.

By end of SC-6.4, the only remaining detect-function calls in the route handler are the explicitly-parked ones with documented rationale. The pipeline is the canonical path.

### §3.2.8 What §3.2 inherits from existing infrastructure

`markerSchemas.js`'s parsing and validation logic carries forward unchanged. The 14+ existing schemas (MERCHANT_SHOP, COMBAT_START, LOOT_DROP, PROMISE_MADE, NOTORIETY_GAIN, etc.) keep their schemas. New schemas are added during migration as needed.

`ruleVerifiers.js` carries forward unchanged. Rule verification continues to run in parallel with marker processing. The combined-correction-note logic is new (§3.7's `buildPendingCorrectionsNote`), but it composes existing helpers.

`session_config.pendingMarkerCorrections` continues to be the persistence point for cross-turn correction feedback. No schema change.

The correction-loop behavior — failures → SYSTEM note → next-turn injection — is preserved end-to-end. Players don't see machinery; the AI sees corrections; the gameplay surface is unchanged.

### §3.2.9 Acceptance criteria for §3.2 sub-checkpoints

**SC-6.1:** Pipeline foundation
- `markerPipeline.js` module exists with `registerHandler`, `processResponseMarkers`, `buildPendingCorrectionsNote`
- Route handler in `routes/dmSession.js` calls `processResponseMarkers` after existing detect-function calls (parallel)
- No registered handlers yet; behavior is unchanged
- Tests confirm pipeline doesn't crash on empty handler registry, doesn't double-fire, returns expected shape
- DECISION_LOG entry on the parallel-not-replacing strategy

**SC-6.3:** Prelude marker port
- All Prelude markers either have a schema + handler, or are documented as parked
- `preludeMarkerDetection.js` ad-hoc functions removed for migrated markers
- Existing Prelude tests pass
- DECISION_LOG entry on which Prelude markers were parked (if any) and why

**SC-6.4:** Detect-function sprawl survey
- All 28 detect-functions surveyed against the schema-handler model
- Migrated detect-functions removed from `dmSessionService.js`
- Parked detect-functions documented inline with rationale
- `dmSessionService.js` is materially thinner; all standing-scalar markers are out
- DECISION_LOG entry summarizing which detect-functions migrated, which parked

**SC-6.5:** Documentation
- `markerSchemas.js` header docs reflect canonical role
- `CLAUDE.md` model split + marker pipeline sections updated
- DECISION_LOG entry consolidating §3.2's migration story (separate from the per-sub-checkpoint entries; this is the closing entry)

## §3.3 — Time-bounded state primitives (Refactor 3.3)

### §3.3.1 What §3.3 is

A consolidation of time-bounded state logic — code shaped as *"wait N game-time units, then do X"* — across 11 surfaces in the codebase. Today, each consumer implements its own game-day arithmetic, its own threshold detection, its own decay function, its own side-effect dispatch. Code's survey (`triage/pattern-d-survey.md`, 2026-05-04) identified four shape clusters (decay-on-read, threshold-with-effect, stage-advance-on-elapsed, round-bounded session state) sharing a common underlying primitive: **(start_marker, threshold, current_clock) → status / effect**.

§3.3 builds shared behavioral infrastructure that the consumers migrate to incrementally, without forcing schema convergence. Same parameterize-not-converge approach as §3.1 (standing-scalar abstraction), validated against five consumers and now extending to time-bounded state.

The decision to add §3.3 to Phase 3 was made on 2026-05-04 by user. Reasoning preserved in DECISION_LOG. Three architectural facts make this the right move:

- Time-bounded state is structurally framework-shaped, like the standing-scalar abstraction. Multiple existing consumers each implement the same primitive with subtle inconsistencies; future consumers (per-arc abilities, time-bounded debts, ability-with-game-day-expiry patterns) will need it.
- It composes naturally with the standing-scalar abstraction. A piety score that decays after game-time absence. A loyalty score that softens after long companion separation. The standing-scalar abstraction already supports threshold detection; adding "thresholds can fire on time elapsed" extends it cleanly.
- Designing it correctly today is feasible. Unlike Pattern C (NPC re-meeting) and Pattern F (long-term campaign history as resource) which need playtest evidence, Pattern D's shape is well-understood from existing consumers. The migration is mechanism-consolidation, not greenfield design.

### §3.3.2 Three primitives, per Code's recommended scope

§3.3 builds three primitives. Code's survey recommended this scope; PM concurs.

**Primitive 1 — `daysSince(anchorGameDay, currentGameDay)` helper.** A normalized one-line helper that replaces ~20 sites of inline `currentGameDay - someAnchor` arithmetic. Smallest piece, biggest leverage — every existing time-bounded consumer either uses this directly today (open-coded) or could benefit from using it. Paves the way for hour-granularity timers in the future without touching call sites: if/when needed, the helper grows a parameter for unit selection while every existing call site continues to work.

```js
// services/timeBoundedState.js — primitive 1
export function daysSince(anchorGameDay, currentGameDay) {
  if (anchorGameDay == null) return null;  // explicit "no anchor set" semantics
  return Math.max(0, currentGameDay - anchorGameDay);
}
```

**Primitive 2 — Decay-on-read consumer.** A configurable decay function applied lazily when a consumer reads its state. Targets §1.2 (NPC disposition decay), §1.3 (NPC trust decay), §1.9 (notoriety decay), and the variant case §1.1 (companion mood, "decay-until-consumed").

The configuration object specifies: anchor reference (which column or path holds the start marker), decay function (piecewise-linear, by-tier, or custom), floor/ceiling (clamps), high-trust modifier hook (some decays slow for high-trust state — survey §1.2 noted disposition decay rate halves for high-trust NPCs), and "consumed" semantics (whether the anchor NULLs out when decay reaches floor — distinguishes the §1.1 mood "decay-until-consumed" pattern from the §1.2/§1.3/§1.9 high-water-mark pattern).

```js
// services/timeBoundedState.js — primitive 2
export function registerDecayConsumer(config) {
  // Returns a consumer-facing API that performs decay-on-read against config.
  // Reads anchor via config.repository.readAnchor(contextKey)
  // Applies config.decayFunction(daysElapsed, currentValue, contextHints)
  // Clamps to config.floor / config.ceiling
  // Writes via config.repository.writeValue(contextKey, newValue)
  // Optionally NULLs anchor via config.repository.consumeAnchor(contextKey) if config.semantics === 'consumed'
}
```

**Primitive 3 — Threshold-crossed-with-effect consumer.** A configurable threshold detector that fires a registered side-effect handler when a consumer's elapsed-time crosses a threshold for the first time. Targets §1.7 (promise auto-break), §1.8 (quest auto-fail), §1.10 (merchant order due/expired), §1.11 (base recapture expiry).

The configuration specifies: anchor reference, threshold (in days), side-effect handler, idempotency strategy (how does the consumer know "fired-once-per-period"? options: anchor written-back post-fire, separate audit-log check, status field comparison), and optional probability parameter for stochastic threshold-crossers (§1.4 NPC relocation 10% roll).

```js
// services/timeBoundedState.js — primitive 3
export function registerThresholdConsumer(config) {
  // Returns a consumer-facing API that performs threshold-crossing detection.
  // Reads anchor, computes daysSince, compares to config.threshold.
  // Checks idempotency via config.idempotency.hasFiredRecently(contextKey)
  // If threshold crossed AND not idempotent-blocked:
  //   — Optionally rolls config.probability if specified
  //   — Calls config.handler(contextKey, daysElapsed, contextHints)
  //   — Writes idempotency marker via config.idempotency.recordFired(contextKey)
}
```

### §3.3.3 What §3.3 explicitly does NOT do

- **Game-clock advancement itself.** `metaGame.js::advanceGameTime` is the canonical writer; multiple inline advancers exist but consolidating them is a separate refactor. §3.3 *consumes* the clock; it doesn't own the clock.
- **Combat effect rounds (§1.14).** Client-side only, no server persistence, round-granularity not day-granularity. Different abstraction entirely. Excluded from §3.3.
- **Companion activity completion (§1.13).** Lazy-poll, not auto-tick. Different pattern (the player-driven "is this ready yet?" check is a different shape from "fire when threshold crosses"). Stays as-is in §3.3 scope; could potentially be revisited in future work as a "scheduled work" abstraction separate from time-bounded state.

### §3.3.4 Open questions (resolved during drafting)

Pattern D survey surfaced 7 open questions for PM. All resolved during §3.3 drafting; no PM calls outstanding for §3.3 except the SC-7.6 weather-modulation wrinkle (decided when SC-7.6 starts).

**Q7 — `daysSince` helper claimed by Pattern D.** Helper ships with SC-7.1 foundation. Centralizing now creates one canonical reference for time arithmetic; future hour-granularity work, future game-time-unit changes happen in one place.

**Q8 — Stochastic threshold support: optional `probability` parameter on threshold descriptor.** First exercise in SC-7.3 (NPC relocation 10% roll). Cheaper extension than a separate primitive for stochastic vs. deterministic thresholds.

**Q9 — Counter-style timer cleanup IN scope.** Survival's dual-column shape (`days_without_food` + `last_meal_game_day`) gets cleaned up cleanly via SC-7.6 rather than left as deferred technical debt. Same reasoning as Q10 below: work is in flight, fix is bounded, deferring adds it to a list nobody comes back to.

**Q10 — World event clock fix IN scope.** §1.12's real-time-clock usage is a consumer-side bug; fixing it via SC-7.7 standardizes all consumers on game-day. Scope absorption rather than parking lot.

**Q11 — Hour-granularity timer support deferred via API design.** Today's API is day-granularity; future hour-granularity grows a unit parameter without breaking call sites. YAGNI today, no future migration cost.

**Q12 — Consumer ordering (session-start vs. living-world tick) preserved as consumer concern.** Abstraction provides primitives; *when* a consumer calls them is the consumer's call. Preserves the deliberate npcAgingService trigger choice ("Called at session start, NOT during living world tick, to avoid compounding decay during long real-world breaks").

**Pattern D shape (Q1 from survey, renumbered for spec context).** Parameterize, same as §3.1. Storage diverges, behavior converges; intentional consumer divergence isn't erased by abstraction.

### §3.3.5 Per-system migration plans

Seven sub-checkpoints, sequenced by complexity (simplest first), mirroring §3.1's approach.

**SC-7.1 — Pattern D foundation.** Build the three primitives; no consumer migrations yet. Same shape as §3.1's SC-1: ship the abstraction, have a sub-checkpoint review the API shape, then migrate consumers one at a time. Land `daysSince` and the consumer-registration APIs. Tests confirm: empty registration doesn't break anything; primitive APIs return expected shapes; configuration validation catches malformed configs.

**SC-7.2 — Companion mood decay (§1.1).** First port. Validates the "consumed-anchor" semantics distinct from "high-water-mark" semantics. `companionBackstoryService.decayMoods` migrates to `registerDecayConsumer({...})` with `semantics: 'consumed'` (anchor NULLs at floor). Existing `decayMoods` callsite from `routes/dmSession.js:773` continues to work; mood decay behavior unchanged from player perspective. (Note: PM's earlier line reference of 460-489 was stale; correct location is 608-645 per Code's survey.)

**SC-7.3 — NPC absence cluster (§1.2 + §1.3 + §1.4 + §1.5).** Second port. Validates: dual-scalar reading from one anchor (disposition + trust both decay against `last_interaction_game_day`); third-consumer `dmPromptBuilder.js` ABSENCE annotation reads the same anchor without going through a decay primitive (it's read-only display, not behavior change); stochastic threshold (§1.4 relocation 10% roll) is the first exercise of the optional `probability` parameter on `registerThresholdConsumer`. `npcAgingService.processAbsenceEffects` becomes a thin orchestrator over `registerDecayConsumer` (×2) + `registerThresholdConsumer` (relocation + forget).

**SC-7.4 — Notoriety decay (§1.9).** Third port. Validates the "written-back anchor" semantics distinct from absence's "high-water-mark" — notoriety updates `last_decay_game_day = currentGameDay` after each tick, so its anchor moves forward whether or not anything fires. Same `registerDecayConsumer` API; different config semantics.

**SC-7.5 — Threshold-crossed cluster (§1.7 promise auto-break, §1.8 quest auto-fail, §1.10 merchant order due/expired, §1.11 base recapture expiry).** Fourth port. Four consumers batched per user's "batching is always the right call" principle (2026-05-04). All four are clean threshold-crossers with deterministic effects; the abstraction's `registerThresholdConsumer` API handles all of them with consumer-specific handler functions. The merchant order's two-stage pipeline (§1.10) is the most complex of the four — pending → ready (stage 1) → expired (stage 2) — but each stage is its own threshold consumer registration. Idempotency strategies vary across the four; each consumer specifies its own.

**SC-7.6 — Survival timer cleanup (§1.6 starvation + §1.6.1 dehydration).** Fifth port. Both timers port to `registerThresholdConsumer` with anchor-only storage. The redundant counter columns (`days_without_food`, `days_without_water`) get dropped or made vestigial via consumer-side computation from the anchor. Survival prompt-builder and exhaustion logic update to read from anchor.

PM call needed before SC-7.6 implementation: §1.6.1 has an unimplemented "weather-modulated timer" wrinkle Code surfaced — the docs say hot weather accelerates the dehydration counter; the code doesn't actually accelerate. SC-7.6 should either fix the bug (implement weather modulation) or confirm and document that the docs are aspirational. Surface to PM when SC-7.6 starts.

**SC-7.7 — World event clock fix (§1.12).** Sixth-and-final port. Ports `worldEventService.js` stage-advance + deadline check from real-time clock to game-day clock (matches the rest of the codebase). Implements deadline check via `registerThresholdConsumer`. Stage-advance becomes its own threshold consumer per stage boundary, or stays inline depending on implementation review. DECISION_LOG entry covering the bug fix and the clock-standardization rationale.

### §3.3.6 Cross-cutting interactions

§3.3 interacts with §3.1 (standing-scalar abstraction) and §3.2 (marker pipeline) at known points:

**With §3.1.** Standing-scalar consumers that have decay (NPC disposition, via §1.2) compose §3.3's `registerDecayConsumer` with §3.1's `adjustStanding`. The decay consumer reads the standing's score, computes the new value, and writes back via the standing-scalar abstraction's repository callbacks. Two abstractions, one consumer surface.

**With §3.2.** No direct interaction. Marker pipeline consumes AI emissions; time-bounded state consumes game-day elapse. Different inputs, different outputs. They co-exist without coupling.

**With existing infrastructure.** §3.3 consumes `characters.game_day` (and friends) without owning it. The clock has multiple writers per the survey (`metaGame.advanceGameTime` plus inline increments); §3.3 doesn't try to consolidate that. `livingWorldService` continues to be the orchestrator that calls most §3.3 consumers (per the existing trigger pattern from Q12); §3.3 just makes its callees thinner.

### §3.3.7 Acceptance criteria per sub-checkpoint

**SC-7.1** — Foundation
- `services/timeBoundedState.js` exports `daysSince`, `registerDecayConsumer`, `registerThresholdConsumer`
- Tests confirm primitive API shapes and configuration validation
- DECISION_LOG entry on the parameterize-not-converge call (mirroring Pattern A's call from SC-1)
- No consumer migrations yet; behavior unchanged everywhere

**SC-7.2** — Companion mood
- `companionBackstoryService.decayMoods` delegates to `registerDecayConsumer`
- "Consumed" semantics validated (anchor NULLs at intensity 0)
- Existing mood-decay tests pass; new test for consumed-vs-high-water distinction
- Behavior unchanged from player perspective

**SC-7.3** — NPC absence cluster
- `npcAgingService.processAbsenceEffects` orchestrates two decay consumers + one threshold consumer
- Stochastic threshold (relocation 10% roll) exercises the `probability` parameter
- ABSENCE prompt annotation reads the same anchor; abstraction doesn't reshape it
- DECISION_LOG entry on stochastic threshold support
- Behavior unchanged from player perspective

**SC-7.4** — Notoriety
- `notorietyService.decayScores` delegates to `registerDecayConsumer`
- "Written-back anchor" semantics validated
- Existing notoriety tests pass

**SC-7.5** — Threshold-crossed cluster
- Promise, quest, merchant order, base recapture all use `registerThresholdConsumer`
- Idempotency strategies vary per consumer; each documented in config
- Two-stage merchant order pipeline (pending → ready → expired) handled with two registrations
- Behavior unchanged from player perspective

**SC-7.6** — Survival timer cleanup
- `survivalService.checkStarvation` and `checkDehydration` delegate to `registerThresholdConsumer`
- `days_without_food` and `days_without_water` columns either dropped or computed-from-anchor
- Survival prompt-builder and exhaustion logic updated
- PM call resolved on weather-modulation wrinkle (fix or document as aspirational)
- DECISION_LOG entry on counter-column cleanup decision

**SC-7.7** — World event clock fix
- `worldEventService.js` deadline + stage-advance use `currentGameDay` instead of `new Date()`
- Deadline check implemented via `registerThresholdConsumer`
- All world-event consumers run on the same game-day clock as the rest of the codebase
- DECISION_LOG entry covering the bug fix and clock-standardization rationale (final §3.3 ship)

### §3.3.8 What §3.3 makes possible (downstream)

- **Quick Study 24-hour proficiency, Tiefling 1-week debts, Aasimar Scourge per-arc abilities.** The original Phase 7 ambitions per `AI_NARRATIVE_PERSISTENCE.md` Pattern D requirements. Each becomes a `registerThresholdConsumer` registration with consumer-specific handlers.
- **Holiday and festival system** (FUTURE_FEATURES.md). Calendar-aware NPC behavior; date-trigger primitive composes with the threshold-crossed pattern.
- **Personal date tracking** (FUTURE_FEATURES.md). Birthdays, anniversaries; same primitive shape.
- **Future "weather-modulated timer" support** if §1.6.1's hot-conditions-accelerate-counter ever gets implemented properly. The decay-function hook is the right extension point.

### §3.3.9 Storage shape decisions

Per the parameterize-not-converge principle, §3.3 makes minimal storage assumptions:

- Anchor columns stay consumer-owned. The abstraction reads/writes via repository callbacks (mirroring §3.1's pattern).
- Five existing storage shapes (own-column anchor, dual-column counter+anchor, JSON-blob entry field, structured-row with implicit fallback, real-time string) all accommodated through callbacks. The real-time-string shape (§1.12 world events) is fixed by SC-7.7's standardization on game-day, not by abstraction extension.
- No new tables introduced. Anchor columns that already exist stay; redundant counter columns get cleaned up where touched (SC-7.6).

### §3.3.10 Player-tunable survival intensity (SC-7.6.5)

#### What this sub-checkpoint is

A difficulty layer over the survival timer cleanup completed in SC-7.6. SC-7.6 implemented weather-modulated dehydration ("Standard" behavior); SC-7.6.5 wraps that behavior in a player-controlled intensity slider so the player can dial survival mechanics up or down — or off entirely — based on what kind of session they want to play.

The decision to add SC-7.6.5 was made on 2026-05-04 by user during SC-7.5 review. Reasoning preserved in DECISION_LOG. Survival mechanics should add texture to play, not nag the player out of enjoying themselves; a single-player game with a player who wants narrative-focused sessions some weeks and survival-pressure sessions other weeks deserves a runtime control rather than a hardcoded difficulty.

#### Four-position intensity slider

Survival intensity is a single character-level setting with four positions, scoped to *survival mechanics as a whole* rather than per-system. Multi-level intensity rather than binary on/off (player who wants "realistic but forgiving" gets a middle ground); single dial rather than per-system toggles (no per-mechanic decision burden).

**Off.** Survival mechanics fully disabled. No starvation, no dehydration, no weather modulation. Threshold consumers short-circuit to `{ fired: false, reason: 'survival_disabled' }`. Useful for narrative-focused play and accessibility.

**Lenient.** Thresholds extended to roughly half-strictness. Hunger threshold becomes 6 + CON modifier (legacy 3 + CON). Dehydration threshold becomes 3 days (legacy 1). Weather modulation reduced to 1.5× (legacy 2.0×). Survival exists as flavor; rarely punishes.

**Standard.** Current rules as documented in §3.3 + SC-7.6. Weather modulation at 2.0×. Hunger at 3 + CON. Dehydration at 1 day. This is the SC-7.6 shipped behavior; SC-7.6.5 doesn't change Standard's numbers, just exposes them as the named middle position.

**Strict.** Tightened thresholds for players who want survival to genuinely matter. Hunger threshold becomes 2 + CON modifier (minimum 1). Dehydration threshold stays at 1 day but weather modulation increases to 3.0× in hot conditions and adds 1.5× in cold conditions. Stacking exhaustion penalties accelerate (current dehydration code already has stacking — Strict raises the rate from 1 level/day past threshold to 2 levels/day past threshold).

The Off / Lenient / Standard / Strict numbers above are draft defaults; final numbers should be reviewed during SC-7.6.5 implementation against playtest sensibilities. PM call if Code's read suggests different cuts.

#### Storage shape

Add column `survival_intensity` to the `characters` table with default value `'standard'`. Allowed values: `'off' | 'lenient' | 'standard' | 'strict'` enforced via CHECK constraint. Migration 052 (the second schema migration in Phase 3 after migration 051's world-event game-day columns).

Backfill for existing characters: all rows default to `'standard'` on migration. No behavioral change for any character who hasn't explicitly chosen a different setting; the runtime continues to apply Standard-shaped rules everywhere.

The intensity is per-character rather than per-campaign or global because in this codebase the character is the primary unit of save state; per-character lets the same player run different characters with different intensities.

#### Implementation pattern

The intensity setting is read at decay-evaluation time and at threshold-evaluation time, not at consumer-registration time. This means the player can change the setting mid-campaign without rebuilding consumers; the next decay/threshold evaluation reads the new value.

Read pattern:

```js
// In starvation threshold consumer's repository.readAnchor:
const character = await getCharacter(characterId);
const intensity = character.survival_intensity || 'standard';
if (intensity === 'off') return null;  // null anchor = consumer no-ops
const conMod = getCONModifier(character);
const baseThreshold = INTENSITY_THRESHOLDS.starvation[intensity];  // 6/3/2 + conMod
const lastMeal = character.last_meal_game_day;
return lastMeal != null ? lastMeal + Math.max(1, baseThreshold + conMod) : null;
```

Same pattern for dehydration. The `INTENSITY_THRESHOLDS` map (per-mechanic, per-intensity) lives in `survivalService.js` as a module-level constant. No new abstraction; the existing Pattern D primitives accommodate the multiplier read via consumer-side configuration.

For weather modulation, the multiplier read happens in the dehydration handler (the function that reads `hint.weather`):

```js
// In dehydration threshold consumer's handler:
const intensity = hints.character.survival_intensity || 'standard';
const tempMultiplier = isHotWeather(hints.weather)
  ? INTENSITY_HOT_MULTIPLIERS[intensity]   // 0/1.5/2.0/3.0
  : 1.0;
const coldMultiplier = isColdWeather(hints.weather) && intensity === 'strict'
  ? 1.5
  : 1.0;
const effectiveDays = rawDaysElapsed * tempMultiplier * coldMultiplier;
// ... existing exhaustion-tier logic against effectiveDays
```

`Off` short-circuits via the null anchor in `readAnchor`; the handler never gets called. No special-casing inside the handler is needed.

#### UI surface

Out of SC-7.6.5 scope. The intensity setting is server-side data; surfacing it in the UI (a settings panel, a dropdown, a per-character configuration screen) is independent UI work that can land in any future ship that's already touching settings UI surfaces, or as its own small dedicated ship.

Default state at v1.0.16x post-SC-7.6.5: every character has `survival_intensity = 'standard'`. Behavior identical to SC-7.6's shipped state. The toggle exists but isn't yet user-facing.

PM recommendation: capture the UI work as a small follow-up entry in `FUTURE_FEATURES.md` or `CONSOLIDATED_TODO.md` so it doesn't get lost. The mechanism without the UI is a release-half-shipped state worth tracking until the UI lands.

#### Acceptance criteria

- Migration 052 adds `survival_intensity` column with CHECK constraint and default value
- `INTENSITY_THRESHOLDS` and `INTENSITY_HOT_MULTIPLIERS` constants land in `survivalService.js`
- `STARVATION_THRESHOLD_CONSUMER` and `DEHYDRATION_THRESHOLD_CONSUMER` read intensity at evaluation time
- `Off` short-circuits both threshold consumers via null anchor
- `Lenient` / `Standard` / `Strict` produce different effective threshold values per the spec table
- Weather modulation respects intensity per `INTENSITY_HOT_MULTIPLIERS`
- Tests cover all four intensity positions across both consumers (~8 scenarios per consumer plus weather-modulation cross-product)
- Behavior parity vs. SC-7.6: any existing character with `survival_intensity = 'standard'` (the default) sees byte-identical behavior to SC-7.6's shipped state
- DECISION_LOG entry covering the four-position design choice, the runtime-read pattern, and the deferred UI surfacing

#### What this sub-checkpoint does NOT do

- **UI surface for the intensity setting.** Server-side mechanism only; UI is follow-up work in any future settings-touching ship.
- **Per-system intensity overrides.** The slider is whole-system; player who wants "Strict starvation but Lenient dehydration" doesn't get that granularity. Per-system would add real surface; multi-level is sufficient and intuitive.
- **Per-campaign or global intensity.** Per-character only. Same player can run different intensities on different characters.
- **Companion / NPC survival mechanics.** Companions don't have their own survival timers; this is character-only.

---

## §4. Cross-cutting interactions

§3.1 and §3.2 interact in three places.

### §4.1 Standing-scalar markers as the integration point

`[PIETY_CHANGE]` and `[BOND_SHIFT]` (and any future markers like a hypothetical `[NPC_DISPOSITION_SHIFT]`) are dispatched through §3.2's pipeline to handlers that call §3.1's `adjustStanding`. The interlock is clean: pipeline routes, abstraction applies. Neither knows about the other except through the handler signature.

### §4.2 Migration ordering matters

If a system migrates to the standing-scalar abstraction (§3.1) without its marker handler also migrating (§3.2), the result is half-done: the abstraction tracks the standing correctly, but the marker is still being processed by an ad-hoc detect-function that knows nothing about the abstraction. The detect-function might call the standing service directly, bypassing the abstraction's audit-trail/threshold-detection wrappers.

So per-system migrations move the abstraction call AND the marker handler in the same sub-checkpoint. SC-3 (faction standing migration) ports the system to the abstraction AND registers the faction-standing marker handler (if such a marker exists). SC-4 (piety + NPC disposition) ports both AND registers `[PIETY_CHANGE]` AND any NPC-disposition marker handler. SC-5 (DM Mode bond-shifts) ports the system AND registers `[BOND_SHIFT]`.

This keeps the codebase honest: at end of each sub-checkpoint, the migrated system is fully on the new abstractions, with no half-implementations bleeding across the boundary.

### §4.3 Correction-loop interaction with standing failures

If a `[PIETY_CHANGE]` marker is malformed (e.g., the AI emits `[PIETY_CHANGE: god="Lathander" amount="three"]` with a non-integer amount), the schema parser fails at validation. The failure feeds the correction-loop. Next turn, the AI is told: "PIETY_CHANGE expects an integer Amount; you sent 'three'."

What this means for §3.1: the abstraction's `adjustStanding` is never called when validation fails. The piety doesn't change. The handler is never invoked. State stays consistent.

This is a meaningful improvement over the current ad-hoc detect-function model, where malformed markers might silently fall through (undefined behavior). Schema-driven validation makes failure modes explicit and recoverable.

---

## §5. Engineering notes

### §5.1 DB shape decisions

Phase 3 makes minimal DB changes:

- **No standing-scalar schema changes** in Phase 3. Each consumer keeps its existing table. The abstraction is behavioral, not structural. (Per Call 1 from 2026-05-03: parameterize, don't converge.)
- **No marker pipeline schema changes** in Phase 3. `session_config.pendingMarkerCorrections` exists already; the pipeline reuses it. No new tables, no new columns.
- **Audit-trail strategy choice per consumer.** Most consumers use existing JSON arrays on the row (companion loyalty, faction standing, NPC disposition, DM Mode bond-shifts inside the JSON blob). Mythic piety has its existing `piety_history` separate table. The abstraction supports both via the `auditTrail.storage` configuration parameter. Per Call 1 reasoning, this divergence is intentional and preserved.

The one DB-related change worth flagging:

- **DM Mode bond-shifts JSON-to-table migration is OUT of Phase 3.** Per Call 3 from 2026-05-03, the abstraction is *designed* to support directional pairs and dual scalars, but DM Mode keeps its JSON-blob storage in `dm_mode_parties.party_data`. The schema migration to a real `party_relationships` table is deferred to Phase 6 where it pairs with the player-mode port.

### §5.2 Backwards compatibility

Per the entry-call confirmation: clean slate. No in-flight campaign data to preserve.

- No migration scripts needed for existing data (because there isn't any to preserve).
- No feature flagging for parallel-old-and-new behavior. The abstraction replaces the inline math; the pipeline absorbs detect-functions one at a time. Each ship is internally consistent.

### §5.3 Test strategy

Phase 2's pattern carries forward:

- **Unit tests** for the abstraction module (`services/standingScalar.js`): label-band mapping, threshold detection, audit-trail write across both strategies (inline JSON, separate table, split-by-sign), range clamping, dispatch.
- **Unit tests** for the pipeline module (`services/markerPipeline.js`): handler registration, parallel-validation behavior, error containment in handler failures.
- **Integration tests** per migrated system: companion-loyalty after SC-2, faction-standing after SC-3, etc. Existing tests should continue to pass; new tests confirm the migration didn't regress any existing behavior, plus tests for newly-added prompt injection (loyalty + piety surfacing).
- **Snapshot tests** for prompt output: SC-3 (faction standing) and SC-4 (NPC disposition) need byte-identical output snapshots to confirm migration didn't change AI-facing prompts. SC-2 (companion loyalty) needs new snapshot covering the newly-added loyalty injection.

### §5.4 Sub-checkpoint cadence

Reaffirmed from §1.5 with Phase 3.2 sub-checkpoints layered in:

SC-1     §3.1 abstraction foundation                     [API review gate]
SC-6.1   §3.2 pipeline foundation                        [API review gate]
SC-2     §3.1 companion loyalty migration                [smoke gate]
SC-3     §3.1 faction standing migration                 [snapshot gate]
SC-4     §3.1 piety + NPC disposition migration          [smoke + snapshot]
SC-5     §3.1 DM Mode bond-shifts behavioral migration   [smoke gate]
SC-6.3   §3.2 Prelude marker port                        [smoke + DECISION_LOG]
SC-6.4   §3.2 detect-function sprawl survey              [DECISION_LOG]
SC-6.5   §3.2 documentation                              [final §3.2 ship]
SC-7.1   §3.3 abstraction foundation                     [API review gate]
SC-7.2   §3.3 companion mood migration                   [smoke gate]
SC-7.3   §3.3 NPC absence cluster                        [smoke gate]
SC-7.4   §3.3 notoriety migration                        [smoke gate]
SC-7.5   §3.3 threshold-crossed cluster (4 consumers)    [smoke gate]
SC-7.6   §3.3 survival timer cleanup                     [smoke gate]
SC-7.7   §3.3 world event clock fix                      [smoke + DECISION_LOG]
[final §3.3 ship]

Nine sub-checkpoints. Each gates the next. Real review at each.

Estimated total Phase 3 implementation time: bounded by Code's pace, but plausibly 2–3 weeks of working time end-to-end given the migration count.

### §5.5 What Phase 3 makes possible (downstream)

- **Phase 4** (AI behavior diagnostic) gets the consolidated marker pipeline as a foundation for its diagnostic instrumentation. Counter-mechanisms can be added at the pipeline layer rather than scattered across detect-functions.
- **Phase 5** (focus-area execution) — if Themes wins, AI-trigger specs plug into the pipeline as schema-handler pairs. If Companions wins, inter-companion `party_relationships` ports to the standing-scalar abstraction. If Prelude shelter-fix wins, counter-mechanism playbook lands at the prompt layer (independent of Phase 3).
- **Phase 6** (DM Mode dedicated pass) — the DM Mode bond-shifts JSON-to-table migration completes against an abstraction that already supports the shape. Cross-party NPC memory question becomes "does the standing-scalar abstraction extend to cross-party context-keys?" — answerable cleanly because the abstraction parameterizes context-keys.
- **Phase 7** (playing mode) — exercises the full integrated system. Surfaces gaps that Phase 3's scope deliberately didn't address (Pattern F class features, time-bounded state primitives) — and the abstractions Phase 3 built are the foundation those gaps eventually plug into.

---

## §6. Open questions

Six questions surfaced during drafting. Two need PM calls during specific sub-checkpoints; four are mostly settled with PM recommendations.

**Q1 — Faction standing dual-array audit trail.** `faction_standings` splits its audit into `deeds_for` and `deeds_against`. The abstraction's `auditTrail` configuration includes a `'split_by_sign'` strategy. **PM call needed before SC-3.** Recommendation: extend the configuration (already specified in §2.2 above).

**Q2 — Per-deity scoping for piety.** Composite context-keys (`{characterId, deityName}`) — abstraction needs to handle generically. Implementation detail; flagged for design awareness.

**Q3 — Threshold-handler registration timing.** Module-load vs. lazy. Recommendation: module-load.

**Q4 — Pipeline interaction with `verifyDmResponse`'s rule violations.** Currently rule verification runs separately and produces `pendingRuleCorrections`. Question: should rule verification *also* be event-driven through the pipeline, or stay as a parallel sibling system? Recommendation: keep as parallel sibling; rule verification is a categorically different operation (text pattern detection, no schema). Don't unify what isn't actually unified.

**Q5 — Runtime handler errors.** If a handler throws, the marker doesn't apply but validation didn't fail. Question: should runtime handler errors surface as logged errors only, or feed back to the AI as a SYSTEM note? Recommendation: logged errors only — telling the AI about server-side bugs leaks engineering detail into the fiction. Test coverage prevents this in practice.

**Q6 — Detect-function deferral criteria.** SC-6.4's "survey and migrate what fits, park what doesn't" is the only sub-checkpoint where Phase 3 takes a meaningful judgment call. **PM call needed before SC-6.4.** Recommendation: PM authors a survey doc of all 28 detect-functions with explicit migrate-or-park rationale per function before SC-6.4 implementation begins; survey reviewed by user; Code implements per the survey.

---

## §7. Handoff to Code

### §7.1 What this spec is

A scoping document for Phase 3 implementation, not a step-by-step. The sub-checkpoint structure is the implementation roadmap; per-sub-checkpoint design decisions live in this doc; PM is available throughout for clarification, scope amendment, and PM calls when they surface.

The same shape as `PHASE_2_CREATOR_SPEC.md` for Phase 2. Code reads it, confirms scope, asks clarifying questions, and starts SC-1 when ready.

### §7.2 What Code is being asked to do

Refactor work on existing code. Not greenfield design. Two abstractions built and migrated to incrementally:

- **Standing-scalar abstraction** (§2): one mechanism, five existing systems migrate to it, prompt-injection hook surfaces the missing companion-loyalty and Mythic-piety standing to the AI for the first time.
- **Marker pipeline consolidation** (§3): elevate the schema-driven pipeline to canonical, sequence detect-functions into it, port Prelude markers to the same pattern.

Total scope across nine sub-checkpoints. Each sub-checkpoint is a real ship. Each gates the next.

### §7.3 What Code is NOT being asked to do

Stated explicitly in §1.2 and §3.5. Re-stated here:

- Pattern F class features (Phase 7)
- AI shelter-behavior counter-mechanisms (Phase 4)
- Themes AI-trigger specs (Phase 5)
- Party Synergies marker layer (Phase 5)
- DM Mode bond-shifts JSON-to-table migration (Phase 6)
- Inter-companion `party_relationships` port (Phase 5 or Phase 6)
- Time-bounded state primitives
- Drow Lolth standing tracker (FUTURE_FEATURES)
- Companion thread event-bus migration (different paradigm; stays as-is)
- 100% detect-function deprecation (SC-6.4 takes a judgment call; not all 28 must migrate)

### §7.4 Sub-checkpoint deliverables

Per sub-checkpoint:

1. Implementation against the spec's API definitions (§2.3, §3.7)
2. Tests passing per acceptance criteria (§2.4–§2.7, §3.9)
3. Sub-checkpoint review with PM + user
4. DECISION_LOG entry where structural decisions land (or where structural decisions changed mid-implementation; Phase 2's pattern of "spec deviation annotations" applies)
5. Update to `AI_NARRATIVE_PERSISTENCE.md` after major sub-checkpoints to reflect what's now solved

### §7.5 Cadence and PM availability

PM mediates throughout. Code surfaces questions; PM answers or surfaces calls to user. Sub-checkpoint reviews are real review gates — drift caught early avoids rebuilds.

PM is also tracking: Q1 from §6 (faction standing dual-array audit) and Q6 from §6 (detect-function deferral criteria) — both will need PM calls during the relevant sub-checkpoints. Not blockers for SC-1; surface ahead of SC-3 (Q1) and SC-6.4 (Q6).

### §7.6 Standing by

After Code confirms scope and the spec is locked, SC-1 begins.

---

## Document footer

**Authored:** 2026-05-03 by PM, against Code's survey package and across multiple drafting sessions in chat.
**Signed off section by section** by user before consolidation.
**Lock date:** 2026-05-03.
**Supersedes:** Nothing (Phase 3 is greenfield refactor specification work).
**Related:** `CONSOLIDATED_TODO.md` (Phase 3 entry), `AI_NARRATIVE_PERSISTENCE.md` (the requirements doc Phase 3 addresses), `CODE_AUDIT_FINDINGS.md` (Block 2: Pattern A, Pattern matching audit, Cross-cutting refactors), `DECISION_LOG.md` (multiple 2026-05-03 entries codifying calls referenced throughout this spec), `PHASE_2_CREATOR_SPEC.md` (the spec doc this one mirrors structurally).